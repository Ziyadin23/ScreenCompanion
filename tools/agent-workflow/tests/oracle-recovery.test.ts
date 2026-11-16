import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { digest, makeManifest, ORACLE_RUNTIME, type Limits } from '../src/manifest.js';
import { normalizeFindings, oracleSchema } from '../src/intake.js';
import { executeRun } from '../src/graph.js';
import { createActions } from '../src/runtime.js';
import { RunStore } from '../src/store.js';
import { currentOracleRetry } from '../src/oracle-recovery.js';
import type { WorkerRequest, WorkerResponse, WorkerResult } from '../src/worker.js';

const production = 'desktop/src/providers/json.ts';
const completeScript = `import assert from 'node:assert/strict';const {parseJson}=await import('/workspace/${production}');assert.throws(()=>parseJson('{"a":1,"a":2}'));`;
const prefix = `import assert from 'node:assert/strict';const {parseJson}=await import('/workspace/${production}');`;
const truncatedScript = prefix + ' '.repeat(8000 - prefix.length - 'assert.ok(c'.length) + 'assert.ok(c';
const oracle = oracleSchema.parse({ kind: 'portable-node', contractPaths: ['docs/contract.md'], script: truncatedScript });

function fixture(t: { after(fn: () => void): void }, limits: Partial<Limits> = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'sc-oracle-recovery-')), root = join(directory, 'repo'); mkdirSync(root);
  const git = (...args: string[]) => execFileSync('/usr/bin/git', ['-C', root, '-c', 'user.name=Fixture',
    '-c', 'user.email=fixture@example.invalid', ...args], { encoding: 'utf8', stdio: 'pipe' }).trim();
  git('init', '-b', 'main'); git('config', 'core.hooksPath', '/dev/null'); git('remote', 'add', 'origin', 'https://github.com/example/sc.git');
  mkdirSync(join(root, 'docs')); mkdirSync(join(root, 'desktop/src/providers'), { recursive: true });
  writeFileSync(join(root, 'docs/contract.md'), 'The parser rejects duplicate JSON fields.\n');
  writeFileSync(join(root, production), 'export const parseJson = (text: string): unknown => JSON.parse(text);\n');
  git('add', '.'); git('commit', '-m', 'baseline');
  const manifest = makeManifest({ repository: 'github.com/example/sc', root, commonDir: join(root, '.git'),
    base: git('rev-parse', 'HEAD'), scope: 'providers-json', mode: 'issue', issue: 7,
    delivery: 'pr', modelProfile: 'fixture', limits: { activeMs: 10_800_000, ...limits } });
  const store = new RunStore(join(directory, 'state'), manifest); store.admit(manifest);
  t.after(() => { store.release(manifest.id); store.close(); rmSync(directory, { recursive: true, force: true }); });
  const issue = { number: 7, html_url: 'https://github.com/example/sc/issues/7', state: 'open', title: 'Reject duplicate JSON fields',
    body: `Scope: ${production}; preserve the existing duplicate-field contract.`, assignees: [{ login: 'Ziyadin23' }] };
  return { directory, root, manifest, store, git, issue };
}

async function observedWorker(f: ReturnType<typeof fixture>, role: WorkerRequest['role'], response: WorkerResponse, attempt = 0, instructions = '') {
  const identity = { runId: f.manifest.id, role, attempt, source: f.manifest.base, instructions };
  const key = `worker:${digest(identity)}`;
  f.store.reserve(f.manifest.id, key, 'workerInvocations');
  if (attempt) f.store.reserve(f.manifest.id, `repair:${f.manifest.id}:${attempt}`, 'repairs');
  const result: WorkerResult = { role, operationKey: key, processDirectory: '', status: 'complete', response,
    elapsedMs: 1, usage: { inputTokens: 1, outputTokens: 1 }, monetaryCost: 'unknown' };
  return f.store.effect(f.manifest.id, key, 'worker', identity, { execute: async () => result, reconcile: async () => null });
}

async function legacy(f: ReturnType<typeof fixture>) {
  const finding = normalizeFindings(f.manifest, [{ path: production, description: 'Duplicate fields are accepted.' }])[0]!;
  const common = { status: 'complete' as const, summary: 'Synthetic oracle proposal', notes: [] };
  const workers = [await observedWorker(f, 'investigator', { ...common, findings: [{ path: production, description: finding.description }] }),
    await observedWorker(f, 'reproducer', { ...common, reproduced: true, evidence: [], oracle })];
  const contractHash = digest([{ path: 'docs/contract.md', hash: digest('The parser rejects duplicate JSON fields.\n') }]);
  const identity = { runId: f.manifest.id, source: f.manifest.base, workspace: f.root, oracleHash: digest(oracle), contractHash, runtime: ORACLE_RUNTIME };
  const operationKey = `oracle:${digest(identity)}`, result = { status: 'exited', exitCode: 43, signal: null,
    stdout: '', stderr: 'synthetic unavailable oracle', outputTruncated: false, elapsedMs: 1 };
  await f.store.effect(f.manifest.id, operationKey, 'verification', identity, { execute: async () => result, reconcile: async () => null });
  f.store.reserve(f.manifest.id, 'historical-active-time', 'activeMs', 728_010);
  f.store.update(f.manifest.id, { stage: 'done', status: 'completed', data: {
    selectedIssue: { ...f.issue, url: f.issue.html_url }, workerResults: workers,
    findings: [{ ...finding, state: 'unconfirmed', oracle, evidence: { source: f.manifest.base,
      oracleHash: digest(oracle), contractHash, environment: 'linux-portable-synthetic', outcome: 'unavailable',
      operationKey, exitCode: 43, outputHash: digest([result.stdout, result.stderr]) } }] } });
  return f.store.get(f.manifest.id);
}

test('explicit legacy oracle retry retains the same run, original evidence and all prior counters', async t => {
  const f = fixture(t), before = await legacy(f), usage = f.store.usage(f.manifest.id);
  let calls = 0;
  assert.equal((await executeRun(f.store, f.manifest.id, { reproduce: async () => { calls++; throw new Error('No normal restart'); } })).status, 'completed');
  assert.equal(calls, 0);
  const reopened = f.store.retryUnavailableOracle(f.manifest.id);
  assert.equal(reopened.stage, 'reproduce'); assert.equal(reopened.status, 'ready');
  assert.deepEqual(reopened.manifest, before.manifest);
  assert.deepEqual(f.store.usage(f.manifest.id), { ...usage, repairs: 1 });
  const retry = currentOracleRetry(reopened)!;
  assert.deepEqual(retry.previous.finding, (before.data.findings as unknown[])[0]);
  assert.equal(retry.previous.status, 'completed'); assert.equal(retry.previous.stage, 'done');
  assert.equal(retry.diagnostics.scriptLength, 8000); assert.equal(retry.diagnostics.exitCode, 43);
  assert.deepEqual(reopened.data.findings, [{ id: retry.diagnostics.findingId, path: production,
    description: 'Duplicate fields are accepted.', state: 'candidate' }]);
  const second = new RunStore(f.store.directory, f.manifest); t.after(() => second.close());
  assert.deepEqual(second.retryUnavailableOracle(f.manifest.id), reopened);
  assert.deepEqual(second.usage(f.manifest.id), { ...usage, repairs: 1 });
  assert.throws(() => f.store.update(f.manifest.id, { data: { ...reopened.data, oracleRetryHistory: [] } }), { code: 'invalid_state' });
});

test('oracle retry admission and its repair reservation roll back together on a checkpoint failure', async t => {
  const f = fixture(t), before = await legacy(f), usage = f.store.usage(f.manifest.id);
  const db = new Database(join(f.store.directory, 'journal.sqlite')); t.after(() => db.close());
  db.exec(`CREATE TRIGGER fail_retry BEFORE UPDATE OF status ON runs WHEN OLD.status='completed' AND NEW.status='ready'
    BEGIN SELECT RAISE(ABORT,'synthetic checkpoint interruption'); END`);
  assert.throws(() => f.store.retryUnavailableOracle(f.manifest.id), /synthetic checkpoint interruption/);
  assert.deepEqual(f.store.usage(f.manifest.id), usage); assert.deepEqual(f.store.get(f.manifest.id), before);
  db.exec('DROP TRIGGER fail_retry');
  assert.equal(f.store.retryUnavailableOracle(f.manifest.id).status, 'ready');
  assert.equal(f.store.usage(f.manifest.id).repairs, 1);
});

test('selected-issue invalid oracle waits for an explicit repair and completes fresh reproduction/review after a cached-worker crash', async t => {
  const f = fixture(t), roles: string[] = []; let launchedRetry = 0, crash = true;
  const actions = createActions({ githubTransport: async (method, endpoint) => {
    assert.equal(method, 'GET'); assert.ok(endpoint.endsWith('/issues/7')); return f.issue;
  }, executeWorker: async request => {
    roles.push(`${request.role}:${request.attempt ?? 0}`);
    const common = { status: 'complete' as const, summary: 'Synthetic selected-issue oracle', notes: [] };
    if (request.role === 'investigator') return observedWorker(f, request.role,
      { ...common, findings: [{ path: production, description: 'Duplicate fields are accepted.' }] });
    if (request.role === 'reviewer') {
      assert.equal(request.attempt, 1); assert.equal(request.baselineContractReview, true);
      return observedWorker(f, request.role, { ...common, baseRevision: f.manifest.base, headRevision: f.manifest.base,
        baselineContract: { valid: true, concerns: [] } }, request.attempt, request.instructions);
    }
    assert.equal(request.role, 'reproducer');
    if (!request.attempt) return observedWorker(f, request.role, { ...common, reproduced: true, evidence: [], oracle });
    assert.equal(request.attempt, 1); assert.match(request.instructions, /never truncate|rather than truncating/);
    assert.match(request.instructions, /"scriptLength":8000/);
    const key = `worker:${digest({ runId: f.manifest.id, role: request.role, attempt: request.attempt,
      source: f.manifest.base, instructions: request.instructions })}`;
    if (!f.store.observedEffect(f.manifest.id, key)) launchedRetry++;
    const result = await observedWorker(f, request.role, { ...common, reproduced: true, evidence: [],
      oracle: { ...oracle, script: completeScript } }, request.attempt, request.instructions);
    if (crash) { crash = false; throw new Error('Synthetic crash after observed worker acknowledgement'); }
    return result;
  } });
  actions.issues = async () => ({ next: 'issues', status: 'awaiting_input', data: { waitingFor: 'fixture_confirmed_without_publication' } });
  const first = await executeRun(f.store, f.manifest.id, actions);
  assert.equal(first.status, 'awaiting_input'); assert.equal(first.stage, 'reproduce'); assert.equal(first.data.waitingFor, 'oracle_retry_required');
  assert.equal((first.data.findings as { reason: string }[])[0]!.reason, 'invalid_proposed_oracle');
  const originalRoles = [...roles];
  assert.equal((await executeRun(f.store, f.manifest.id, actions)).status, 'awaiting_input');
  assert.deepEqual(roles, originalRoles);
  const legacyCompleted = await executeRun(f.store, f.manifest.id, { ...actions,
    reproduce: async () => ({ next: 'done', data: { waitingFor: null } }) });
  assert.equal(legacyCompleted.status, 'completed');
  assert.equal(legacyCompleted.stage, 'done');
  f.store.retryUnavailableOracle(f.manifest.id);
  assert.equal((await executeRun(f.store, f.manifest.id, actions)).status, 'failed');
  f.store.retryUnavailableOracle(f.manifest.id);
  const recovered = await executeRun(f.store, f.manifest.id, actions);
  assert.equal(recovered.status, 'awaiting_input'); assert.equal(recovered.stage, 'issues');
  assert.equal((recovered.data.findings as { state: string }[])[0]!.state, 'confirmed');
  assert.equal(launchedRetry, 1); assert.equal(f.store.usage(f.manifest.id).workerInvocations, 4);
  assert.equal(f.store.usage(f.manifest.id).repairs, 1); assert.equal(f.store.usage(f.manifest.id).issues, 0);
  assert.equal((recovered.data.oracleRetryHistory as unknown[]).length, 1);
  assert.throws(() => f.store.retryUnavailableOracle(f.manifest.id), { code: 'oracle_retry_denied' });
});

test('oracle retry refuses downstream work, uncertain effects, active ownership, holds, cancellation and changed terminal evidence', async t => {
  const cases: [string, (f: ReturnType<typeof fixture>) => void | Promise<void>][] = [
    ['confirmed', f => { const data = f.store.get(f.manifest.id).data; f.store.update(f.manifest.id, { data: { ...data,
      findings: (data.findings as object[]).map(value => ({ ...value, state: 'confirmed' })) } }); }],
    ['disproved', f => { const data = f.store.get(f.manifest.id).data; f.store.update(f.manifest.id, { data: { ...data,
      findings: (data.findings as object[]).map(value => ({ ...value, state: 'disproved' })) } }); }],
    ['target', f => { const data = f.store.get(f.manifest.id).data; f.store.update(f.manifest.id, { data: { ...data,
      findings: [{ ...(data.findings as object[])[0], oracle: null, reason: 'target_or_contract_unavailable' }] } }); }],
    ['writer', f => { f.store.reserve(f.manifest.id, 'synthetic-writer', 'writingTasks'); }],
    ['allocation', f => { f.store.update(f.manifest.id, { data: { ...f.store.get(f.manifest.id).data, allocation: { id: 'owned' } } }); }],
    ['issue', f => { f.store.update(f.manifest.id, { data: { ...f.store.get(f.manifest.id).data, issueReceipts: [{ number: 7 }] } }); }],
    ['closed effect', async f => { await f.store.effect(f.manifest.id, 'issue-already-published', 'github_issue', {},
      { execute: async () => ({ number: 7 }), reconcile: async () => null }); }],
    ['unknown effect', async f => { await assert.rejects(f.store.effect(f.manifest.id, 'uncertain-readonly-worker', 'worker', {},
      { execute: async () => { throw new Error('unknown outcome'); }, reconcile: async () => null })); }],
    ['active owner', f => f.store.claim(f.manifest.id)],
    ['hold', f => { f.store.update(f.manifest.id, { data: { ...f.store.get(f.manifest.id).data,
      integrationHold: { active: true, head: f.manifest.base, reason: 'main_checks_failed' } } }); }],
    ['cancellation', f => f.store.requestCancel(f.manifest.id)],
    ['terminal invalidation', f => f.store.update(f.manifest.id, { status: 'cancelled' })],
    ['descendant', f => { f.store.update(f.manifest.id, { status: 'budget_exhausted' });
      const child = makeManifest({ repository: f.manifest.repository, root: f.root, commonDir: f.manifest.commonDir,
        base: f.manifest.base, scope: f.manifest.scope, mode: 'issue', issue: 7, delivery: 'pr', continuationOf: f.manifest.id });
      f.store.admit(child); f.store.update(f.manifest.id, { status: 'completed' }); }]
  ];
  for (const [name, change] of cases) {
    const f = fixture(t); await legacy(f); await change(f);
    assert.throws(() => f.store.retryUnavailableOracle(f.manifest.id), { code: 'oracle_retry_denied' }, name);
    assert.equal(f.store.usage(f.manifest.id).repairs, 0, name);
  }
  const changed = fixture(t); await legacy(changed); writeFileSync(join(changed.root, production), 'changed\n');
  assert.throws(() => changed.store.retryUnavailableOracle(changed.manifest.id), { code: 'source_changed' });
});

test('oracle retry cannot create new worker, repair or active-time allowance', async t => {
  for (const limits of [{ workerInvocations: 3 }, { repairs: 0 }, { activeMs: 728_010 }]) {
    const f = fixture(t, limits); await legacy(f); const usage = f.store.usage(f.manifest.id);
    assert.throws(() => f.store.retryUnavailableOracle(f.manifest.id), { code: 'budget_exhausted' });
    assert.deepEqual(f.store.usage(f.manifest.id), usage);
  }
});

test('CLI oracle retry is explicit, same-run and cannot receive authority options', async t => {
  const f = fixture(t); await legacy(f);
  const cli = resolve(process.env.SC_WORKFLOW_CLI_DIST ?? 'dist', 'src/cli.js');
  const invoke = (...args: string[]) => spawnSync(process.execPath, [cli, ...args, '--state-dir', f.store.directory], {
    cwd: f.root, encoding: 'utf8', timeout: 10_000, env: { PATH: process.env.PATH, HOME: f.root } });
  assert.equal(invoke('resume', f.manifest.id).status, 0);
  assert.equal(f.store.usage(f.manifest.id).repairs, 0);
  assert.equal(invoke('status', f.manifest.id, '--retry-oracle').status, 4);
  assert.equal(invoke('resume', f.manifest.id, '--retry-oracle', '--workers', '12').status, 4);
  const retried = invoke('resume', f.manifest.id, '--retry-oracle');
  assert.equal(retried.status, 2, retried.stderr); // The fixture profile prevents any real model dispatch.
  assert.equal(f.store.get(f.manifest.id).error, 'unsupported_profile');
  assert.equal(f.store.usage(f.manifest.id).workerInvocations, 2); assert.equal(f.store.usage(f.manifest.id).repairs, 1);
  assert.equal(f.store.listRuns().length, 1);
});
