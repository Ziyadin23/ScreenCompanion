import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import { SqliteSaver } from '@langchain/langgraph-checkpoint-sqlite';
import { closeSync, existsSync, lstatSync, openSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { join } from 'node:path';
import { z } from 'zod';
import { WorkflowError } from './manifest.js';
import { cancelRun } from './recovery.js';
import { type RunRecord, type RunStore, type RunStatus } from './store.js';

export const STAGES = ['preflight', 'intake', 'investigate', 'reproduce', 'issues', 'plan',
  'worktree', 'implement', 'verify', 'review', 'handoff', 'publish', 'checks', 'merge',
  'postflight', 'finalize', 'done'] as const;
export type Stage = typeof STAGES[number];
export interface StepResult { next: Stage; status?: RunStatus; data?: Record<string, unknown> }
export interface Context { run: RunRecord; store: RunStore; signal: AbortSignal }
export type Actions = Partial<Record<Stage, (context: Context) => Promise<StepResult>>>;

const Channels = Annotation.Root({
  runId: Annotation<string>(), stage: Annotation<Stage>(), status: Annotation<RunStatus>()
});
const minimumDelivery: Partial<Record<Stage, number>> = {
  issues: 1, plan: 2, worktree: 2, implement: 2, handoff: 2, publish: 2,
  merge: 3, postflight: 3, finalize: 3
};
const stepSchema = z.object({ next: z.enum(STAGES),
  status: z.enum(['running', 'awaiting_external', 'awaiting_input', 'budget_exhausted',
    'completed', 'cancelled', 'failed', 'quarantined']).optional(),
  data: z.record(z.string(), z.unknown()).optional() }).strict();

function openCheckpoints(directory: string): SqliteSaver {
  const path = join(directory, 'checkpoints.sqlite');
  let saver: SqliteSaver | undefined;
  try {
    if (!existsSync(path)) closeSync(openSync(path, 'wx', 0o600));
    const info = lstatSync(path);
    if (!info.isFile() || info.isSymbolicLink() || (info.mode & 0o077) ||
        (process.getuid && info.uid !== process.getuid())) throw new Error('Invalid checkpoint file');
    saver = SqliteSaver.fromConnString(path);
    if (saver.db.pragma('quick_check', { simple: true }) !== 'ok') throw new Error('Invalid checkpoint database');
    saver.db.pragma('synchronous = FULL');
    return saver;
  } catch {
    saver?.db.close();
    throw new WorkflowError('invalid_checkpoint', 'Checkpoint state is preserved for recovery.');
  }
}

export async function executeRun(store: RunStore, id: string, actions: Actions,
  externalSignal?: AbortSignal): Promise<RunRecord> {
  const initial = store.get(id);
  if (initial.status === 'completed') return initial;
  if (initial.cancelRequested) return cancelRun(store, id);
  if (!STAGES.includes(initial.stage as Stage)) throw new WorkflowError('invalid_state', 'Saved stage is unknown.');
  store.claim(id);
  let saver: SqliteSaver | undefined;
  let cancelled = false;
  const controller = new AbortController();
  const abort = () => controller.abort(new WorkflowError('cancelled', 'Run cancelled.', 130));
  if (externalSignal?.aborted) abort();
  externalSignal?.addEventListener('abort', abort, { once: true });
  const remaining = initial.manifest.limits.activeMs - store.usage(id).activeMs;
  const deadline = setTimeout(() => controller.abort(new WorkflowError('budget_exhausted', 'Active run allowance exhausted.', 3)), Math.max(1, remaining));
  const poll = setInterval(() => {
    try { if (store.get(id).cancelRequested) abort(); }
    catch { controller.abort(new WorkflowError('invalid_state', 'Cannot observe cancellation state.')); }
  }, 100);
  const invocation = randomUUID();
  let stepNumber = 0;
  // This local development runner never opts into environment-enabled cloud tracing.
  process.env.LANGSMITH_TRACING = 'false';
  process.env.LANGCHAIN_TRACING_V2 = 'false';
  const node = (stage: Stage) => async () => {
    const run = store.get(id);
    if (run.cancelRequested) abort();
    if (controller.signal.aborted) throw controller.signal.reason;
    const authority = ['report', 'issues', 'pr', 'merge-eligible'].indexOf(run.manifest.delivery);
    if (authority < (minimumDelivery[stage] ?? 0))
      throw new WorkflowError('delivery_denied', 'The selected delivery does not authorize this stage.');
    if (stage === 'done') {
      store.update(id, { stage, status: 'completed' });
      return { runId: id, stage, status: 'completed' as const };
    }
    const action = actions[stage];
    if (!action) throw new WorkflowError('capability_unavailable', 'Required execution capability is unavailable.', 2);
    const remainingTime = run.manifest.limits.activeMs - store.usage(id).activeMs;
    const ceiling = Math.min(remainingTime, stage === 'checks' ? run.manifest.limits.ciWaitMs : run.manifest.limits.workerMs);
    if (ceiling <= 0) throw new WorkflowError('budget_exhausted', 'Active run allowance exhausted.', 3);
    const timeKey = `time:${invocation}:${stepNumber++}`;
    store.reserve(id, timeKey, 'activeMs', ceiling);
    const stageController = new AbortController();
    const stageDeadline = setTimeout(() => stageController.abort(new WorkflowError('budget_exhausted', 'Stage duration exhausted.', 3)), ceiling);
    const signal = AbortSignal.any([controller.signal, stageController.signal]);
    const started = performance.now();
    let result: StepResult;
    try { result = stepSchema.parse(await action({ run, store, signal })); }
    finally {
      clearTimeout(stageDeadline);
      store.settleTime(id, timeKey, Math.ceil(performance.now() - started));
    }
    if (signal.aborted) throw signal.reason;
    const status = result.status ?? (result.next === 'done' ? 'completed' : 'running');
    if (Object.hasOwn(result.data ?? {}, 'ownedProcesses'))
      throw new WorkflowError('invalid_state', 'Stage output cannot replace the owned process registry.');
    store.update(id, { stage: result.next, status,
      data: { ...store.get(id).data, ...result.data }, error: null });
    return { runId: id, stage: result.next, status };
  };
  const builder = new StateGraph(Channels)
    .addNode('preflight', node('preflight')).addNode('intake', node('intake'))
    .addNode('investigate', node('investigate')).addNode('reproduce', node('reproduce'))
    .addNode('issues', node('issues')).addNode('plan', node('plan'))
    .addNode('worktree', node('worktree')).addNode('implement', node('implement'))
    .addNode('verify', node('verify')).addNode('review', node('review'))
    .addNode('handoff', node('handoff')).addNode('publish', node('publish'))
    .addNode('checks', node('checks')).addNode('merge', node('merge'))
    .addNode('postflight', node('postflight')).addNode('finalize', node('finalize'))
    .addNode('done', node('done'));
  const route = (state: typeof Channels.State) => state.status === 'running' ? state.stage : END;
  builder.addConditionalEdges(START, route, [...STAGES, END]);
  for (const stage of STAGES) builder.addConditionalEdges(stage, route, [...STAGES, END]);
  try {
    await store.reconcileOwnedExecutions(id);
    saver = openCheckpoints(store.directory);
    const graph = builder.compile({ checkpointer: saver });
    if (remaining <= 0) throw new WorkflowError('budget_exhausted', 'Active run allowance exhausted.', 3);
    store.update(id, { status: 'running', error: null });
    await graph.invoke({ runId: id, stage: initial.stage as Stage, status: 'running' }, {
      configurable: { thread_id: id }, durability: 'sync', recursionLimit: 100, callbacks: []
    });
  } catch (error) {
    const failure = error instanceof WorkflowError ? error : new WorkflowError('execution_failed', 'Execution failed; inspect the local evidence.');
    cancelled = failure.exitCode === 130;
    const status: RunStatus = cancelled ? 'awaiting_input' : failure.exitCode === 3 ? 'budget_exhausted' :
      failure.exitCode === 2 ? 'awaiting_input' : ['owner_unverifiable', 'invalid_checkpoint'].includes(failure.code) ? 'quarantined' : 'failed';
    store.update(id, { status, error: failure.code });
  } finally {
    clearInterval(poll); clearTimeout(deadline);
    externalSignal?.removeEventListener('abort', abort);
    saver?.db.close(); store.release(id);
  }
  if (cancelled) return cancelRun(store, id);
  return store.get(id);
}
