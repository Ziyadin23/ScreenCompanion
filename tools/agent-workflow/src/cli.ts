import { execFileSync, spawnSync } from 'node:child_process';
import { accessSync, constants, existsSync, lstatSync, realpathSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { executeRun } from './graph.js';
import { DEFAULT_LIMITS, digest, makeManifest, WorkflowError } from './manifest.js';
import { RunStore, type RunRecord } from './store.js';
import { cancelRun } from './recovery.js';
import { createActions } from './runtime.js';
import { migrateState } from './migration.js';
import { loadCodexProfile } from './worker.js';

type Probe = (name: string, args: string[]) => { status: number | null; stdout: string | Buffer | null };
export function doctor(repository: ReturnType<typeof repositoryAt>, stateDirectory: string,
  probe: Probe = (name, args) => spawnSync(name, args, { encoding: 'utf8', timeout: 10_000 }),
  profileAvailable?: () => boolean) {
  const names = ['node', 'git', 'gh', 'codex', 'orca-ide', 'bwrap'];
  const versions = Object.fromEntries(names.map(name => {
    const result = probe(name, ['--version']);
    const version = String(result.stdout ?? '').match(/(?:^|[^0-9])(\d+)\.(\d+)(?:\.(\d+))?\b/);
    const supported = result.status === 0 && !!version &&
      (name !== 'node' || Number(version[1]) > 22 || Number(version[1]) === 22 && Number(version[2]) >= 12);
    return [name, supported];
  }));
  let stateAccess = false;
  try {
    let parent = stateDirectory;
    while (!existsSync(parent)) { const next = resolve(parent, '..'); if (next === parent) break; parent = next; }
    if (!statSync(parent).isDirectory()) throw new Error('Invalid state directory');
    accessSync(parent, constants.R_OK | constants.W_OK | constants.X_OK);
    const canonical = resolve(realpathSync(parent), relative(parent, stateDirectory));
    const inside = (root: string) => {
      const child = relative(realpathSync(root), canonical);
      return child === '' || !isAbsolute(child) && child !== '..' && !child.startsWith('../');
    };
    if (inside(repository.root) || inside(dirname(repository.commonDir))) throw new Error('State inside source');
    if (existsSync(stateDirectory)) {
      const info = lstatSync(stateDirectory);
      if (!info.isDirectory() || info.isSymbolicLink() || (info.mode & 0o077) ||
          (process.getuid && info.uid !== process.getuid())) throw new Error('Unsafe state directory');
    }
    stateAccess = true;
  } catch { /* The selected private state location cannot be used. */ }
  const isolation = versions.bwrap === true && probe('bwrap', ['--unshare-user', '--unshare-pid', '--unshare-net',
    '--ro-bind', '/', '/', '--proc', '/proc', '/usr/bin/true']).status === 0;
  let selectedAuthAvailable = false;
  try {
    selectedAuthAvailable = profileAvailable ? profileAvailable() : Boolean(loadCodexProfile({ name: 'selected',
      binary: String(probe('which', ['codex']).stdout ?? '').trim(),
      authFile: join(process.env.CODEX_HOME ?? join(homedir(), '.codex'), 'auth.json'),
      configFile: join(process.env.CODEX_HOME ?? join(homedir(), '.codex'), 'config.toml') }));
  } catch { /* File availability is not a claim that live authentication works. */ }
  let protectedForMerge = false;
  try {
    const base = `/repos/${repository.repository.slice('github.com/'.length)}`;
    const read = (path: string): Record<string, unknown> => {
      const response = probe('gh', ['api', '--method', 'GET', path]);
      if (response.status !== 0) throw new Error('Protection unavailable');
      return JSON.parse(String(response.stdout ?? '')) as Record<string, unknown>;
    };
    const repo = read(base), value = read(`${base}/branches/${repository.branch}/protection`);
    const rules = read(`${base}/rulesets?includes_parents=true`);
    const checks = value.required_status_checks as Record<string, unknown> | undefined;
    const reviews = value.required_pull_request_reviews as Record<string, unknown> | undefined;
    const setting = (name: string) => (value[name] as Record<string, unknown> | undefined)?.enabled;
    const required = ['changes', 'documentation', 'portable', 'windows-build', 'agent-workflow'];
    protectedForMerge = repo.default_branch === repository.branch && repo.allow_squash_merge === true &&
      checks?.strict === true && Array.isArray(checks.contexts) && required.every(name => (checks.contexts as unknown[]).includes(name)) &&
      typeof reviews?.url === 'string' && Number.isSafeInteger(reviews.required_approving_review_count) &&
      (reviews.required_approving_review_count as number) >= 0 &&
      ['users', 'teams', 'apps'].every(name => !(reviews.bypass_pull_request_allowances as Record<string, unknown> | undefined)?.[name] ||
        Array.isArray((reviews.bypass_pull_request_allowances as Record<string, unknown>)[name]) &&
        ((reviews.bypass_pull_request_allowances as Record<string, unknown>)[name] as unknown[]).length === 0) &&
      setting('enforce_admins') === true && setting('allow_force_pushes') === false &&
      setting('allow_deletions') === false && Array.isArray(rules) &&
      rules.every(rule => !!rule && typeof rule === 'object' && Array.isArray((rule as Record<string, unknown>).bypass_actors) &&
        ((rule as Record<string, unknown>).bypass_actors as unknown[]).length === 0);
  } catch { /* Unknown protection keeps merge ineligible. */ }
  const ready = process.platform === 'linux' && Object.values(versions).every(Boolean) && stateAccess &&
    isolation && selectedAuthAvailable;
  return { repository: repository.repository, host: process.platform, supportedHost: process.platform === 'linux',
    tools: versions, stateAccess, isolation, selectedAuthAvailable, liveAuthVerified: false,
    protectedForMerge, ready, mergeEligible: ready && protectedForMerge, residentService: false };
}

export function repositoryAt(directory = process.cwd()) {
  const git = (...args: string[]) => execFileSync('git', ['-C', directory, ...args], {
    encoding: 'utf8', timeout: 10_000, maxBuffer: 1_000_000, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' }
  }).trim();
  try {
    const root = realpathSync(git('rev-parse', '--show-toplevel'));
    const remote = git('remote', 'get-url', 'origin');
    const match = /^(?:https:\/\/github\.com\/|git@github\.com:)([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?)(?:\.git)?$/.exec(remote);
    if (!match?.[1]) throw new Error('Unsupported repository');
    return { root, commonDir: realpathSync(git('rev-parse', '--path-format=absolute', '--git-common-dir')),
      repository: `github.com/${match[1]}`.toLowerCase(), base: git('rev-parse', 'HEAD'), branch: 'main' };
  } catch { throw new WorkflowError('invalid_repository', 'Select a GitHub-backed Git checkout.'); }
}

function report(run: RunRecord, store: RunStore) {
  const findings = Array.isArray(run.data.findings) ? run.data.findings : [];
  const workers = Array.isArray(run.data.workerResults) ? run.data.workerResults : [];
  const issues = Array.isArray(run.data.issueReceipts) ? run.data.issueReceipts.filter(issue => Number.isSafeInteger(issue?.number) && issue.number > 0) : [];
  const sha = (value: unknown) => typeof value === 'string' && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(value) ? value : null;
  const safeCode = (value: unknown) => typeof value === 'string' && /^[a-z0-9_]{1,100}$/.test(value) ? value : null;
  const pull = (run.data.pull ?? run.data.selectedPull) as { number?: number; head?: string } | undefined;
  const integration = run.data.integration as { mergeHead?: string; prNumber?: number } | undefined;
  const postflight = run.data.postflight as { state?: string } | undefined;
  const hold = run.data.integrationHold as { active?: boolean; reason?: string } | undefined;
  const review = run.data.pullReview as { head?: string; findings?: unknown[]; evidenceLevel?: string } | undefined;
  const usage = store.usage(run.manifest.id);
  return { runId: run.manifest.id, repository: run.manifest.repository, scope: run.manifest.scope,
    delivery: run.manifest.delivery, base: run.manifest.base, status: run.status, stage: run.stage,
    cancelRequested: run.cancelRequested, error: run.error, usage,
    waitingFor: safeCode(run.data.waitingFor),
    findings: { total: findings.length, confirmed: findings.filter(f => f?.state === 'confirmed').length,
      disproved: findings.filter(f => f?.state === 'disproved').length, unconfirmed: findings.filter(f => f?.state === 'unconfirmed').length },
    workers: { observed: workers.length, failed: workers.filter(worker => worker?.status === 'failed').length },
    issues: issues.map(issue => ({ number: issue.number, reused: issue.reused === true,
      url: `https://${run.manifest.repository}/issues/${issue.number}` })),
    pull: Number.isSafeInteger(pull?.number) && pull!.number! > 0 ? { number: pull!.number,
      url: `https://${run.manifest.repository}/pull/${pull!.number}`, head: sha(pull?.head) } : null,
    sourceMerge: sha(integration?.mergeHead),
    review: review?.evidenceLevel === 'source_inspection' ? { head: sha(review.head),
      findings: Array.isArray(review.findings) ? review.findings.length : 0, verification: 'not_executed' } : null,
    postflight: ['ready', 'pending', 'failed'].includes(postflight?.state ?? '') ? postflight!.state : null,
    integrationHold: hold?.active === true ? { active: true, reason: safeCode(hold.reason) } : null,
    retryCount: Array.isArray(run.data.roundHistory) ? run.data.roundHistory.length : 0,
    interventionCount: null,
    interventionRequired: run.status === 'awaiting_input',
    tokens: { observedInput: workers.reduce((sum, worker) => sum + (Number.isSafeInteger(worker?.usage?.inputTokens) ? worker.usage.inputTokens : 0), 0),
      observedOutput: workers.reduce((sum, worker) => sum + (Number.isSafeInteger(worker?.usage?.outputTokens) ? worker.usage.outputTokens : 0), 0),
      complete: workers.length === usage.workerInvocations && workers.every(worker => worker?.usage != null) },
    costUsd: null, costStatus: 'unknown', nextAction: run.status.startsWith('awaiting_') ? 'inspect_and_resume' : null };
}
function exitFor(run: RunRecord): number {
  if (run.status === 'cancelled') return 130;
  if (run.status === 'budget_exhausted') return 3;
  if (run.status === 'failed' || run.status === 'quarantined') return 4;
  return run.status.startsWith('awaiting_') ? 2 : 0;
}

export async function main(args = process.argv.slice(2)): Promise<number> {
  const { values, positionals } = parseArgs({ args, allowPositionals: true, strict: true, options: {
    repo: { type: 'string' }, scope: { type: 'string' }, mode: { type: 'string' },
    issue: { type: 'string' }, pr: { type: 'string' }, delivery: { type: 'string' },
    'state-dir': { type: 'string' }, 'model-profile': { type: 'string' },
    'dry-run': { type: 'boolean' }, help: { type: 'boolean' }, format: { type: 'string' },
    'retention-days': { type: 'string' }, workers: { type: 'string' },
    'worker-seconds': { type: 'string' }, 'active-minutes': { type: 'string' }
  } });
  const command = positionals[0];
  if (values.help || !command) {
    console.log(JSON.stringify({ commands: ['doctor', 'run', 'status <run-id>', 'report <run-id>',
      'resume <run-id>', 'cancel <run-id>', 'backup <new-private-directory>', 'migrate <new-private-backup-directory>', 'prune --retention-days 30'],
      deliveries: ['report', 'issues', 'pr', 'merge-eligible'] }));
    return 0;
  }
  if (!['doctor', 'run', 'status', 'report', 'resume', 'cancel', 'backup', 'migrate', 'prune'].includes(command) ||
      positionals.length !== (['status', 'report', 'resume', 'cancel', 'backup', 'migrate'].includes(command) ? 2 : 1))
    throw new WorkflowError('invalid_arguments', 'Unknown command or missing run identity.');
  if (values.format && !['json', 'markdown'].includes(values.format))
    throw new WorkflowError('invalid_arguments', 'Report format must be json or markdown.');
  const retentionDays = Number(values['retention-days'] ?? 30);
  if ((values['retention-days'] && command !== 'prune') || !Number.isSafeInteger(retentionDays) ||
      retentionDays < 1 || retentionDays > 3650)
    throw new WorkflowError('invalid_arguments', 'Retention must be between 1 and 3650 days for prune.');
  const repository = repositoryAt(values.repo ? resolve(values.repo) : process.cwd());
  function ceiling(value: string | undefined, maximum: number): number {
    const parsed = Number(value ?? maximum);
    if (!Number.isSafeInteger(parsed) || parsed <= 0 || parsed > maximum)
      throw new WorkflowError('invalid_arguments', 'A CLI resource allowance must be positive and at most the trusted default.');
    return parsed;
  }
  const manifest = makeManifest({ ...repository, scope: values.scope ?? 'providers-json',
    mode: values.mode ?? (values.issue ? 'issue' : values.pr ? 'review' : 'investigate'),
    ...(values.issue ? { issue: /^\d+$/.test(values.issue) ? Number(values.issue) : -1 } : {}),
    ...(values.pr ? { pr: /^\d+$/.test(values.pr) ? Number(values.pr) : -1 } : {}),
    delivery: values.delivery ?? 'report', modelProfile: values['model-profile'] ?? 'selected', limits: {
      workerInvocations: ceiling(values.workers, DEFAULT_LIMITS.workerInvocations),
      workerMs: ceiling(values['worker-seconds'], DEFAULT_LIMITS.workerMs / 1000) * 1000,
      activeMs: ceiling(values['active-minutes'], DEFAULT_LIMITS.activeMs / 60_000) * 60_000
    } });
  if (command !== 'run' && Object.keys(values).some(key =>
    ['scope', 'mode', 'issue', 'pr', 'delivery', 'model-profile', 'dry-run', 'workers', 'worker-seconds', 'active-minutes'].includes(key)))
    throw new WorkflowError('invalid_arguments', 'Saved runs cannot receive new authority options.');
  const stateDirectory = values['state-dir'] ? resolve(values['state-dir']) :
    join(process.env.XDG_STATE_HOME ?? join(homedir(), '.local', 'state'),
      'screencompanion-agent-workflow', digest(repository.repository).slice(0, 24));
  if (command === 'doctor') {
    const result = doctor(repository, stateDirectory);
    console.log(JSON.stringify(result));
    return result.ready ? 0 : 2;
  }
  if (command === 'run' && values['dry-run']) {
    console.log(JSON.stringify({ dryRun: true, repository: manifest.repository, scope: manifest.scope,
      delivery: manifest.delivery, mode: manifest.mode, limits: manifest.limits,
      policyHash: manifest.policyHash, workerCalls: 0, remoteMutations: 0 }));
    return 0;
  }
  const inspection = command === 'status' || command === 'report';
  if (command !== 'run' && !existsSync(join(stateDirectory, 'journal.sqlite')))
    throw new WorkflowError('run_not_found', 'No saved run exists in this repository state.');
  if (command === 'migrate') {
    console.log(JSON.stringify(migrateState(stateDirectory, resolve(positionals[1]!), manifest)));
    return 0;
  }
  const store = new RunStore(stateDirectory, manifest, { readOnly: inspection });
  try {
    if (command === 'backup') {
      await store.backup(resolve(positionals[1]!));
      console.log(JSON.stringify({ snapshot: 'complete', scope: 'sqlite-only', executionReceiptsRetainedAtOriginal: true }));
      return 0;
    }
    if (command === 'prune') {
      console.log(JSON.stringify({ removedRuns: await store.prune(Date.now() - retentionDays * 86_400_000), retentionDays }));
      return 0;
    }
    const id = command === 'run' ? manifest.id : positionals[1]!;
    let run = command === 'run' ? store.admit(manifest) : store.get(id);
    if (inspection) {
      const value = report(run, store);
      console.log(values.format === 'markdown' ?
        `# Workflow run ${value.runId}\n\nRepository: ${value.repository}\nScope: ${value.scope}\nStatus: ${value.status}\nStage: ${value.stage}\n` +
        `Findings: ${value.findings.confirmed} confirmed, ${value.findings.disproved} disproved, ${value.findings.unconfirmed} unconfirmed\n` +
        `Issues: ${value.issues.map(issue => `#${issue.number}${issue.reused ? ' (reused)' : ''}`).join(', ') || 'none'}\n` +
        `PR: ${value.pull?.url ?? 'none'}\nSource merge: ${value.sourceMerge ?? 'none'}\nPostflight: ${value.postflight ?? 'not observed'}\n` +
        (value.review ? `Source inspection: ${value.review.findings} concerns; independent commands not executed\n` : '') +
        `Next gate: ${value.waitingFor ?? 'none'}\nRepairs: ${value.retryCount}; intervention required: ${value.interventionRequired}; human interventions: unknown\n` +
        `Workers: ${value.usage.workerInvocations}; active ms: ${value.usage.activeMs}\n` +
        `Observed tokens: ${value.tokens.observedInput} input, ${value.tokens.observedOutput} output; complete: ${value.tokens.complete}\nCost: unknown\n` : JSON.stringify(value));
      return 0;
    }
    if (command === 'cancel') {
      run = await cancelRun(store, id);
      console.log(JSON.stringify(report(run, store)));
      return run.status === 'quarantined' ? 4 : run.cancelRequested && run.status !== 'cancelled' && run.status !== 'completed' ? 2 : 0;
    }
    const controller = new AbortController();
    const stop = () => controller.abort();
    process.once('SIGINT', stop); process.once('SIGTERM', stop);
    process.stderr.write(`${JSON.stringify({ event: 'admitted', runId: id })}\n`);
    try {
      run = await executeRun(store, id, createActions(), controller.signal);
    } finally { process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop); }
    console.log(JSON.stringify(report(run, store)));
    return exitFor(run);
  } finally { store.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then(code => { process.exitCode = code; }).catch(error => {
    const failure = error instanceof WorkflowError ? error : new WorkflowError('invalid_arguments', 'Invalid command or unavailable local prerequisite.');
    console.error(JSON.stringify({ error: failure.code, message: failure.message }));
    process.exitCode = failure.exitCode;
  });
}
