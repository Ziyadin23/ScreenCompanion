import type { CampaignRun } from './cases';
import { phaseRuns } from './campaign';
import type { CampaignLedger } from './ledger';
import type { RunMetadata } from './measure';

const PREFLIGHTS = ['preflight-flash', 'preflight-pro'] as const;
export class CampaignExecutionError extends Error {
  constructor(readonly code: 'preflight-required' | 'allowance' | 'scope' | 'unresolved') { super('The selected campaign scope is blocked before a scenario contact.'); }
}
type Ledger = Pick<CampaignLedger, 'identity' | 'remaining' | 'phaseRemaining' | 'completed' | 'latestStatus' | 'unresolved' | 'claimAttempt' | 'releaseAttempt' | 'finish'>;
/** Model gates are keyed by the same frozen candidate and explicit phase as durable completion. */
export async function executeCampaign(options: {
  selected: readonly CampaignRun[]; fullCampaign: boolean; repeat: boolean; ledger: Ledger; signal: AbortSignal;
  execute(run: CampaignRun, attempt: number): Promise<RunMetadata>;
  record(metadata: RunMetadata): Promise<void>;
}): Promise<void> {
  const { selected, repeat, ledger, signal, execute, record } = options;
  const { phase, candidate } = ledger.identity;
  if (selected.some(run => !phaseRuns(phase).some(item => item.id === run.id)) || new Set(selected.map(run => run.id)).size !== selected.length ||
      (phase === 'reserve' ? !repeat || options.fullCampaign : repeat)) throw new CampaignExecutionError('scope');
  if (ledger.unresolved()) throw new CampaignExecutionError('unresolved');
  const fullCampaign = options.fullCampaign || (phase === 'qualification' || phase === 'diagnostic') && phaseRuns(phase).every(run => selected.some(item => item.id === run.id));
  const gateIdentity = { candidate, phase: phase === 'diagnostic' ? 'initial-preflight' : phase } as const;
  const status = (id: string) => ledger.latestStatus(id, gateIdentity);
  const pending = selected.filter(run => repeat || !ledger.completed(run.id));
  if (fullCampaign && PREFLIGHTS.some(id => status(id) === 'failed')) throw new CampaignExecutionError('preflight-required');
  if (pending.reduce((sum, run) => sum + run.expectedCalls, 0) > Math.min(ledger.remaining, ledger.phaseRemaining)) throw new CampaignExecutionError('allowance');
  for (const run of pending) {
    signal.throwIfAborted();
    const prerequisitePhase = phase === 'reserve' ? ['qualification', 'initial-preflight'] as const : [gateIdentity.phase];
    const required = fullCampaign || run.answerModel === 'deepseek-v4-pro' ? PREFLIGHTS : ['preflight-flash'];
    if (run.group !== 'preflight' && required.some(id => !prerequisitePhase.some(prerequisite =>
      ledger.latestStatus(id, { candidate, phase: prerequisite }) === 'passed'))) throw new CampaignExecutionError('preflight-required');
    const attempt = ledger.claimAttempt(run.id);
    try {
      const metadata = await execute(run, attempt);
      if (metadata.candidate !== candidate || metadata.phase !== phase || metadata.runId !== run.id || metadata.attempt !== attempt) throw new CampaignExecutionError('scope');
      await record(metadata); // No completion or later send is possible after a failed result write.
      await ledger.finish(run.id, attempt, metadata.status);
      if (run.group === 'preflight' && metadata.status !== 'passed') break;
    } finally { ledger.releaseAttempt(run.id, attempt); }
  }
}
