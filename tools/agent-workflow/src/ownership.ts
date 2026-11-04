import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, sep } from 'node:path';
import { digest, WorkflowError, type Manifest } from './manifest.js';
import { baselineFile, inScope, planningOwner } from './intake.js';
import { inspectOwnedProcess, reconcileOwnedProcess, runOwnedProcess, type OwnedProcessResult } from './process.js';
import { prepareSandbox } from './sandbox.js';
import { type RunStore } from './store.js';
import { type IssueReceipt, type ConfirmedFailure } from './github.js';

const exec = promisify(execFile);
type Json = Record<string, unknown>;
export interface PlanFile { path: string; content: string; hash: string }
export interface PlanBundle {
  owner: { change: string; path: string; provenance: string; hash: string };
  provenance: { kind: 'local' | 'baseline'; source: string; fingerprint: string; issue: number };
  files: PlanFile[];
}
export interface PlanStep { path: string; text: string }
export interface PlanRequest {
  manifest: Manifest; issue: IssueReceipt | undefined; failure: ConfirmedFailure;
  existingOwner?: { path: string; taskId: string }; steps?: PlanStep[];
}
function fail(code: string, message: string): never { throw new WorkflowError(code, message, 2); }
function object(value: unknown): Json {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail('orca_invalid_response', 'Orca response is invalid.');
  return value as Json;
}
function line(value: string, max = 200): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max ||
      [...value].some(char => char.charCodeAt(0) < 32) ||
      /[<>`$\\]|https?:\/\/|\b(?:token|password|secret|api.?key)\b/i.test(value))
    return fail('plan_scope_denied', 'Planning text exceeds the accepted contract.');
  return value.trim();
}
function issueIdentity(manifest: Manifest, issue: IssueReceipt | undefined): asserts issue is IssueReceipt {
  if (!issue || !Number.isSafeInteger(issue.number) || issue.number < 1 || issue.state !== 'open' ||
      typeof issue.url !== 'string' ||
      issue.url.toLowerCase() !== `https://${manifest.repository}/issues/${issue.number}`)
    fail('issue_required', 'A verified open issue in the selected repository is required.');
}
function validateFailure(manifest: Manifest, failure: ConfirmedFailure): void {
  if (failure.source !== manifest.base || failure.outcome !== 'failed' ||
      ![failure.fingerprint, failure.oracleHash, failure.contractHash, failure.outputHash]
        .every(value => /^[a-f0-9]{64}$/.test(value)) || !inScope(manifest, failure.path))
    fail('scope_denied', 'Confirmed baseline failure does not match the frozen scope.');
  for (const value of [failure.problem, failure.reproduction, failure.acceptance]) line(value, 300);
}
export function resolveExistingOwner(request: { manifest: Manifest; issue: IssueReceipt | undefined;
  existingOwner: { path: string; taskId: string } }) {
  const { manifest, issue, existingOwner: { path, taskId } } = request;
  issueIdentity(manifest, issue);
  if (!/^openspec\/changes\/[a-z0-9][a-z0-9-]*\/tasks\.md$/.test(path) ||
      !/^\d+(?:\.\d+)*$/.test(taskId))
    fail('owner_mismatch', 'OpenSpec owner identity is invalid.');
  const owner = planningOwner(manifest, path);
  if (!owner || owner.path !== path)
    fail('owner_unavailable', 'Existing owner is not present at the frozen baseline.');
  const task = owner.pending.includes(taskId) && baselineFile(manifest, path).split('\n')
    .find(value => value.startsWith(`- [ ] ${taskId} `));
  const taskMention = new RegExp(`\\btask\\s+${taskId.replaceAll('.', '\\.')}\\b(?!\\.\\d)`, 'i');
  if (!task || !task.includes(issue.url) || typeof issue.body !== 'string' ||
      !issue.body.includes(path) || !issue.body.includes(owner.change) ||
      !taskMention.test(issue.body.replaceAll('`', '')))
    fail('owner_mismatch', 'Issue does not link the pending OpenSpec task group.');
  return { change: owner.change, path: owner.path, provenance: owner.provenance, hash: owner.hash,
    taskId, taskText: task.trim(), execution: 'read-only' as const };
}
export function preparePlan(request: PlanRequest): PlanBundle {
  const { manifest, issue, failure } = request;
  issueIdentity(manifest, issue); validateFailure(manifest, failure);
  if (request.existingOwner) {
    const owner = resolveExistingOwner({ manifest, issue, existingOwner: request.existingOwner });
    if (!owner.taskText.includes(failure.path) || !issue.body.includes(failure.path) ||
        !issue.body.includes(failure.fingerprint))
      fail('owner_mismatch', 'Confirmed bug does not match the linked OpenSpec task.');
    return { owner: { change: owner.change, path: owner.path, provenance: owner.provenance, hash: owner.hash },
      provenance: { kind: 'baseline', source: manifest.base, fingerprint: failure.fingerprint, issue: issue.number },
      files: [] };
  }
  const steps = request.steps ?? [];
  if (steps.length > 5) fail('plan_scope_denied', 'Planner supplied too many steps.');
  for (const step of steps) {
    if (step.path !== failure.path || !inScope(manifest, step.path) ||
        /\b(?:add|create|change|set|enable|disable|remove|publish|merge|deploy|run|execute|install|approve|authorize|requirement|permission|scope|policy|command)\b/i.test(step.text))
      fail('plan_scope_denied', 'Planner suggestion changes the accepted scope or authority.');
    line(step.text, 160);
  }
  const change = `fix-confirmed-${failure.fingerprint.slice(0, 12)}`;
  const prefix = `openspec/changes/${change}`;
  const problem = line(failure.problem, 300); const acceptance = line(failure.acceptance, 300);
  const reproduction = line(failure.reproduction, 300);
  const details = `Issue #${issue.number}; baseline ${manifest.base}; finding ${failure.fingerprint}.`;
  const files = [
    ['proposal.md', `# Confirmed bug correction\n\n${details}\n\n## Why\n\n${problem}.\n\n## What changes\n\nCorrect ${failure.path} to satisfy the existing contract.\n\n## Scope\n\nOnly ${manifest.paths.join(', ')}. Existing behavior is the authority; this plan adds no requirement.\n`],
    ['design.md', `# Design\n\nUse the baseline contract and frozen reproducer. ${reproduction}.\n\nKeep the correction inside ${failure.path}; preserve all unrelated behavior. Re-run the independent oracle and affected checks.\n`],
    ['tasks.md', `# Tasks\n\n## 1. Correct the confirmed existing-contract bug\n\n- [ ] 1.1 Reproduce the confirmed failure on baseline ${manifest.base} using oracle ${failure.oracleHash}; record the failing result.\n- [ ] 1.2 Correct ${failure.path} for the existing contract: ${acceptance}; verify the frozen reproducer passes.\n- [ ] 1.3 Run affected checks and independent review; record source and environment limits.\n\nPlanner suggestions (non-authoritative):\n${steps.map(step => `- ${line(step.text, 160)}`).join('\n') || '- None'}\n`],
    ['.openspec.yaml', 'schema: spec-driven\nskip_specs: true\n']
  ] as const;
  const planFiles = files.map(([suffix, content]) => ({ path: `${prefix}/${suffix}`, content, hash: digest(content) }));
  return { owner: { change, path: `${prefix}/tasks.md`, provenance: manifest.base,
    hash: planFiles.find(file => file.path.endsWith('/tasks.md'))!.hash },
    provenance: { kind: 'local', source: manifest.base, fingerprint: failure.fingerprint, issue: issue.number },
    files: planFiles };
}

function git(workspace: string, ...args: string[]): string {
  try { return execFileSync('/usr/bin/git', ['-C', workspace, '-c', 'core.fsmonitor=false', ...args], {
    encoding: 'utf8', timeout: 10_000, maxBuffer: 1_000_000, stdio: ['ignore', 'pipe', 'pipe'],
    env: { PATH: '/usr/bin:/bin', HOME: '/dev/null', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' }
  }).trim(); }
  catch { return fail('workspace_conflict', 'Workspace Git identity cannot be verified.'); }
}
function cleanWorkspace(manifest: Manifest, workspace: string, revision: string, branch?: string): void {
  if (revision !== manifest.base ||
      realpathSync(git(workspace, 'rev-parse', '--path-format=absolute', '--git-common-dir')) !== realpathSync(manifest.commonDir) ||
      git(workspace, 'rev-parse', 'HEAD') !== revision ||
      (branch && git(workspace, 'symbolic-ref', '--short', 'HEAD') !== branch))
    fail('workspace_conflict', 'Workspace source or branch does not match its frozen owner.');
  if (git(workspace, 'status', '--porcelain', '--untracked-files=all'))
    fail('dirty_workspace', 'Workspace has changes outside this operation.');
}
export function materializePlan(request: { plan: PlanBundle; manifest: Manifest; allocation: WorkspaceReceipt;
  revision: string; trusted: Pick<PlanRequest, 'issue' | 'failure' | 'steps'> }):
  { files: { path: string; hash: string }[]; provenance: PlanBundle['provenance'] } {
  const { plan, manifest, allocation, revision } = request;
  const workspace = allocation.path;
  const expectedPlan = preparePlan({ manifest, ...request.trusted });
  if (JSON.stringify(plan) !== JSON.stringify(expectedPlan))
    fail('plan_scope_denied', 'Transferred plan differs from the coordinator-owned template.');
  if (allocation.issue !== plan.provenance.issue || allocation.head !== manifest.base ||
      allocation.branch !== `sc-agent/issue-${allocation.issue}-${manifest.id.slice(0, 8)}` ||
      allocation.marker !== `sc-agent:${manifest.id}:issue-${allocation.issue}`)
    fail('workspace_conflict', 'Plan transfer requires this run’s allocated worktree.');
  if (plan.provenance.source !== manifest.base || revision !== manifest.base ||
      plan.provenance.kind !== 'local' || !plan.owner.change.startsWith('fix-confirmed-') ||
      plan.files.length !== 4) fail('plan_scope_denied', 'Only a local fixed-template plan may be transferred.');
  cleanWorkspace(manifest, workspace, revision, allocation.branch);
  const root = realpathSync(workspace);
  const expected = ['proposal.md', 'design.md', 'tasks.md', '.openspec.yaml']
    .map(suffix => `openspec/changes/${plan.owner.change}/${suffix}`);
  for (let i = 0; i < expected.length; i++) {
    const file = plan.files[i]!;
    if (file.path !== expected[i] || file.hash !== digest(file.content) || Buffer.byteLength(file.content) > 5000)
      fail('plan_scope_denied', 'Plan files do not match the fixed owner template.');
    const target = join(root, file.path);
    if (relative(root, target).startsWith(`..${sep}`) || isAbsolute(relative(root, target)))
      fail('plan_scope_denied', 'Plan file escaped the workspace.');
    for (let parent = dirname(target); parent !== root; parent = dirname(parent))
      if (existsSync(parent) && (lstatSync(parent).isSymbolicLink() || !lstatSync(parent).isDirectory()))
        fail('workspace_conflict', 'Planning path collides with an existing workspace entry.');
    if (existsSync(target)) fail('workspace_conflict', 'Planning file already exists.');
  }
  for (const file of plan.files) {
    const target = join(root, file.path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, file.content, { flag: 'wx', mode: 0o600 });
  }
  return { files: plan.files.map(({ path, hash }) => ({ path, hash })), provenance: plan.provenance };
}

export type OrcaTransport = (args: string[]) => Promise<unknown>;
export async function orcaTransport(args: string[]): Promise<unknown> {
  const { stdout } = await exec('orca-ide', args, { timeout: 15_000, maxBuffer: 1_000_000,
    env: { PATH: process.env.PATH ?? '/usr/bin:/bin', HOME: process.env.HOME ?? '/dev/null' } });
  return JSON.parse(stdout) as unknown;
}
export interface WorkspaceReceipt { id: string; path: string; branch: string; head: string; issue: number; marker: string }
export class OrcaClient {
  constructor(private readonly store: RunStore, private readonly runId: string,
    private readonly transport: OrcaTransport = orcaTransport) {}
  private get manifest(): Manifest { return this.store.get(this.runId).manifest; }
  private async call(args: string[]): Promise<Json> { return object(object(await this.transport(args)).result); }
  private async list(): Promise<unknown[]> {
    const result = await this.call(['worktree', 'list', '--repo', `path:${this.manifest.root}`, '--limit', '1000', '--json']);
    const scope = result.hostScope === undefined ? null : object(result.hostScope);
    if (!Array.isArray(result.worktrees) || result.truncated === true || result.complete === false ||
        (!scope && result.complete !== true) ||
        (scope && (!Array.isArray(scope.omittedHostIds) || scope.omittedHostIds.length > 0)))
      fail('orca_incomplete', 'Orca worktree listing is incomplete.');
    return result.worktrees;
  }
  private identity(issue: IssueReceipt) {
    const suffix = this.runId.slice(0, 8);
    return { branch: `sc-agent/issue-${issue.number}-${suffix}`, name: `issue-${issue.number}-agent-${suffix}`,
      marker: `sc-agent:${this.runId}:issue-${issue.number}` };
  }
  private verify(rowInput: unknown, issue: IssueReceipt, expected: ReturnType<OrcaClient['identity']>): WorkspaceReceipt {
    const row = object(rowInput); const path = row.path;
    const branch = row.branch ?? (row.git && object(row.git).branch);
    const head = row.head ?? (row.git && object(row.git).head);
    const issueNumber = row.issue ?? row.linkedIssue;
    const name = row.name ?? row.displayName;
    const reference = row.reference ?? (Array.isArray(row.linkedItems) ? row.linkedItems.find(item =>
      object(item).provider === 'github' && object(item).type === 'issue' && object(item).number === issue.number &&
      object(item).url === issue.url) && issue.url : undefined);
    if (typeof row.id !== 'string' || !row.id || typeof path !== 'string' || !isAbsolute(path) ||
        (branch !== expected.branch && branch !== `refs/heads/${expected.branch}`) ||
        name !== expected.name || head !== this.manifest.base || issueNumber !== issue.number ||
        reference !== issue.url || typeof row.comment !== 'string' || !row.comment.startsWith(expected.marker) || row.isArchived === true ||
        (row.commonDir && realpathSync(row.commonDir as string) !== realpathSync(this.manifest.commonDir)))
      fail('workspace_conflict', 'Orca workspace is stale or belongs to another task.');
    cleanWorkspace(this.manifest, path, this.manifest.base, expected.branch);
    return { id: row.id, path, branch: expected.branch, head: this.manifest.base,
      issue: issue.number, marker: expected.marker };
  }
  async allocate(issue: IssueReceipt): Promise<WorkspaceReceipt> {
    issueIdentity(this.manifest, issue);
    const expected = this.identity(issue); const rows = await this.list();
    const candidates = rows.filter(input => { const row = object(input);
      return row.branch === expected.branch || object(row.git ?? {}).branch === `refs/heads/${expected.branch}` ||
        row.name === expected.name || row.displayName === expected.name ||
        (typeof row.comment === 'string' && row.comment.startsWith(expected.marker)) ||
        row.issue === issue.number || row.linkedIssue === issue.number; });
    if (candidates.length > 1) fail('workspace_conflict', 'Several workspaces claim the same task.');
    if (candidates.length === 1) {
      const listed = object(candidates[0]);
      const shown = await this.call(['worktree', 'show', '--worktree', `id:${String(listed.id)}`, '--json']);
      return this.verify(shown.worktree, issue, expected);
    }
    const request = { repository: this.manifest.repository, issue: issue.number, branch: expected.branch,
      name: expected.name, base: this.manifest.base, marker: expected.marker };
    return this.store.effect(this.runId, `orca:create:${issue.number}`, 'orca-create', request, {
      execute: async () => {
        try { await this.call(['worktree', 'create', '--repo', `path:${this.manifest.root}`, '--name', expected.name,
          '--no-parent', '--setup', 'skip', '--base-branch', this.manifest.base, '--branch', expected.branch,
          '--reference', issue.url, '--comment', expected.marker, '--json']); }
        catch { /* An acknowledgement loss is resolved by a full read-back below. */ }
        const found = await this.reconcile(issue, expected);
        if (!found) return fail('effect_unknown', 'Orca create outcome is unknown; inspect before retrying.');
        return found;
      },
      reconcile: () => this.reconcile(issue, expected)
    });
  }
  private async reconcile(issue: IssueReceipt, expected: ReturnType<OrcaClient['identity']>): Promise<WorkspaceReceipt | null> {
    const rows = await this.list();
    const matches = rows.filter(input => { const row = object(input);
      return (typeof row.comment === 'string' && row.comment.startsWith(expected.marker)) || row.branch === expected.branch ||
        object(row.git ?? {}).branch === `refs/heads/${expected.branch}` || row.name === expected.name || row.displayName === expected.name; });
    if (matches.length > 1) fail('workspace_conflict', 'Several workspaces claim this create marker.');
    if (!matches.length) return null;
    const row = object(matches[0]);
    const shown = await this.call(['worktree', 'show', '--worktree', `id:${String(row.id)}`, '--json']);
    return this.verify(shown.worktree, issue, expected);
  }
  async setCard(workspace: WorkspaceReceipt, stage: 'todo' | 'in-progress' | 'in-review' | 'completed',
    comment: string): Promise<void> {
    const short = line(comment, 100);
    if (!short.includes(`#${workspace.issue}`)) fail('plan_scope_denied', 'Card comment must link its issue.');
    const shown = await this.call(['worktree', 'show', '--worktree', `id:${workspace.id}`, '--json']);
    const row = object(shown.worktree);
    if (row.id !== workspace.id || row.path !== workspace.path ||
        typeof row.comment !== 'string' || !row.comment.startsWith(workspace.marker) ||
        (row.issue ?? row.linkedIssue) !== workspace.issue)
      fail('workspace_conflict', 'Card target no longer belongs to this task.');
    await this.call(['worktree', 'set', '--worktree', `id:${workspace.id}`, '--workspace-status', stage,
      '--comment', `${workspace.marker} ${short}`, '--json']);
  }
}

export interface SetupResult { ok: boolean; operationKey: string; result: OwnedProcessResult }
export async function runSetup(request: { store: RunStore; runId: string; allocation: WorkspaceReceipt;
  revision: string; plan?: PlanBundle; timeoutMs?: number; signal?: AbortSignal }): Promise<SetupResult> {
  const { store, runId, allocation, revision } = request; const manifest = store.get(runId).manifest;
  const workspace = allocation.path;
  if (allocation.head !== manifest.base || allocation.branch !== `sc-agent/issue-${allocation.issue}-${runId.slice(0, 8)}` ||
      allocation.marker !== `sc-agent:${runId}:issue-${allocation.issue}`)
    fail('workspace_conflict', 'Setup requires this run’s allocated worktree.');
  if (revision !== manifest.base) fail('workspace_conflict', 'Setup requires the allocated baseline.');
  // Planning files may already be transferred; Git identity and source head remain fixed.
  if (realpathSync(git(workspace, 'rev-parse', '--path-format=absolute', '--git-common-dir')) !== realpathSync(manifest.commonDir) ||
      git(workspace, 'rev-parse', 'HEAD') !== revision ||
      git(workspace, 'symbolic-ref', '--short', 'HEAD') !== allocation.branch)
    fail('workspace_conflict', 'Setup workspace does not belong to the frozen repository.');
  const key = `setup:${digest({ runId, workspace: realpathSync(workspace), revision })}`;
  const stateDirectory = join(store.directory, 'runs', runId);
  const processDirectory = join(stateDirectory, 'processes');
  if (inspectOwnedProcess(processDirectory, key).state !== 'exited') {
    const ignored = git(workspace, 'ls-files', '--others', '--ignored', '--exclude-standard', '--directory');
    if (ignored) fail('unsafe_setup_workspace', 'Ignored checkout content must be removed before credential-free setup.');
    const changed = git(workspace, 'status', '--porcelain', '--untracked-files=all').split('\n').filter(Boolean);
    const allowed = request.plan?.files ?? [];
    if (allowed.length && (request.plan?.provenance.source !== revision || request.plan.provenance.kind !== 'local'))
      fail('plan_scope_denied', 'Setup plan provenance is invalid.');
    if (changed.length !== allowed.length || changed.some(entry =>
      !entry.startsWith('?? ') || !allowed.some(file => file.path === entry.slice(3) &&
        file.hash === digest(readFileSync(join(workspace, file.path), 'utf8')))))
      fail('dirty_workspace', 'Setup workspace has unowned changes.');
  }
  mkdirSync(stateDirectory, { recursive: true, mode: 0o700 });
  const sandbox = prepareSandbox({ workspace, revision, writable: true, stateDirectory, network: true });
  const timeoutMs = Math.min(Math.max(request.timeoutMs ?? 120_000, 1_000), 600_000);
  const identity = { workspace: realpathSync(workspace), revision, command: ['npm', '--prefix', 'desktop', 'ci'] };
  let launched = false; let terminal = false;
  try {
    store.registerOwnedProcess(runId, key, processDirectory);
    const result = await store.effect(runId, key, 'setup', identity, {
      execute: async () => { launched = true; return runOwnedProcess({
        ...sandbox.request('/usr/bin/npm', ['--prefix', 'desktop', 'ci']),
        stateDirectory: processDirectory, key, timeoutMs, signal: request.signal }); },
      reconcile: async () => {
        try { return await reconcileOwnedProcess(processDirectory, key); }
        catch (error) { if (error instanceof WorkflowError && error.code === 'operation_not_found') return null; throw error; }
      }
    });
    terminal = true;
    return { ok: result.status === 'exited' && result.exitCode === 0 && !result.outputTruncated,
      operationKey: key, result };
  } finally { if (!launched || terminal) sandbox.dispose(); }
}
