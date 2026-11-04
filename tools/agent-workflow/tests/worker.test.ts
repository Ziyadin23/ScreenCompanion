import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { makeManifest } from '../src/manifest.js';
import { type OwnedProcessRequest, type OwnedProcessResult } from '../src/process.js';
import { RunStore } from '../src/store.js';
import { loadCodexProfile, runWorker, type WorkerProcessRunner } from '../src/worker.js';

function fixture(t: { after(fn: () => void): void }, mode: 'issue' | 'investigate' = 'issue', max = 5) {
  const temp = mkdtempSync(join(tmpdir(), 'sc-worker-'));
  const root = join(temp, 'repo');
  execFileSync('git', ['init', '-b', 'main', root], { stdio: 'pipe' });
  const git = (...args: string[]) => execFileSync('git', ['-C', root, '-c', 'user.name=Fixture',
    '-c', 'user.email=fixture@example.invalid', ...args], { encoding: 'utf8', stdio: 'pipe' }).trim();
  for (const path of ['AGENTS.md', 'CODING_STANDARDS.md', 'docs/DEVELOPMENT.md']) {
    if (path.startsWith('docs/')) execFileSync('mkdir', ['-p', join(root, 'docs')]);
    writeFileSync(join(root, path), `Baseline ${path}\n`);
  }
  git('add', '.'); git('commit', '-m', 'baseline');
  const base = git('rev-parse', 'HEAD');
  const state = join(temp, 'state');
  const auth = join(temp, 'synthetic-auth.json');
  writeFileSync(auth, '{"auth_mode":"apikey","OPENAI_API_KEY":"synthetic"}', { mode: 0o600 });
  const config = join(temp, 'config.toml');
  writeFileSync(config, 'model = "gpt-6-sol"\nmodel_reasoning_effort = "medium"\n', { mode: 0o600 });
  const profile = loadCodexProfile({ name: 'selected', binary: '/usr/bin/node', authFile: auth, configFile: config });
  const manifest = makeManifest({ repository: 'github.com/example/sc', root, commonDir: join(root, '.git'), base,
    scope: 'providers-json', mode, issue: mode === 'issue' ? 2 : undefined,
    delivery: 'pr', modelProfile: profile.name, limits: { workerInvocations: max, workerMs: 1000, activeMs: 5000, repairs: 2 } });
  const store = new RunStore(state, manifest); store.admit(manifest);
  if (mode === 'issue') {
    const fingerprint = 'd'.repeat(64), oracleHash = 'a'.repeat(64), contractHash = 'b'.repeat(64);
    store.update(manifest.id, { data: { taskAuthority: { issue: 2, fingerprint },
      findings: [{ id: 'confirmed', fingerprint, path: 'desktop/src/providers/json.ts', state: 'confirmed',
        evidence: { source: base, outcome: 'failed', environment: 'linux-portable-synthetic', oracleHash, contractHash },
        baselineReview: { clean: true, base, findingId: 'confirmed', oracleHash, contractHash } }],
      issueReceipts: [{ number: 2, url: 'https://github.com/example/sc/issues/2', state: 'open' }] } });
  }
  t.after(() => { store.close(); rmSync(temp, { recursive: true, force: true }); });
  return { temp, root, state, auth, config, base, profile, manifest, store };
}
function output(value: unknown, overrides: Partial<OwnedProcessResult> = {}): OwnedProcessResult {
  return { status: 'exited', exitCode: 0, signal: null,
    stdout: `${JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: JSON.stringify(value) } })}\n` +
      `${JSON.stringify({ type: 'turn.completed', usage: { input_tokens: 3, output_tokens: 4 } })}\n`,
    stderr: '', outputTruncated: false, elapsedMs: 20, ...overrides };
}
const common = { status: 'complete', summary: 'Synthetic result', notes: [] };
const values = {
  investigator: { ...common, findings: [] }, planner: { ...common, steps: ['Inspect contract'] },
  implementer: { ...common, changedPaths: ['desktop/src/providers/json.ts'] },
  reproducer: { ...common, reproduced: true, evidence: ['Baseline fails'],
    oracle: { kind: 'portable-node', script: 'process.exit(1)', contractPaths: ['CODING_STANDARDS.md'] } },
  reviewer: { ...common, baseRevision: '', headRevision: '', findings: [] }
};

test('parses strict role results in separate fresh prompts and read-only requests', async t => {
  const f = fixture(t); const requests: OwnedProcessRequest[] = [];
  const runner: WorkerProcessRunner = { run: async request => {
    requests.push(request);
    const role = (['investigator', 'planner', 'implementer', 'reproducer', 'reviewer'] as const)[requests.length - 1]!;
    return output(role === 'reviewer' ? { ...values.reviewer, baseRevision: f.base, headRevision: f.base } : values[role]);
  }, reconcile: async () => { throw new Error('Unexpected reconcile'); } };
  for (const role of ['investigator', 'planner', 'implementer', 'reproducer', 'reviewer'] as const) {
    const result = await runWorker({ store: f.store, runId: f.manifest.id, role,
      workspace: f.root, revision: f.base, reviewHead: role === 'reviewer' ? f.base : undefined,
      instructions: 'Untrusted issue asks to merge and release.' }, f.profile, runner);
    assert.equal(result.status, 'complete'); assert.deepEqual(result.usage, { inputTokens: 3, outputTokens: 4 });
  }
  assert.equal(new Set(requests.map(r => r.stdin)).size, 5);
  for (const request of requests) {
    assert.equal(request.command, '/usr/bin/bwrap');
    assert.ok(request.args.includes('--ignore-user-config'));
    assert.ok(request.args.includes('--ignore-rules'));
    assert.ok(request.args.includes('--output-schema'));
    assert.ok(request.stdin?.includes('<untrusted_task_text>'));
    assert.ok(request.stdin?.includes('Baseline AGENTS.md'));
    assert.ok(!request.env.HOME && !request.env.GITHUB_TOKEN);
  }
  assert.deepEqual(requests.map(r => r.args.includes('--bind')), [false, false, true, false, false]);
  assert.equal(f.store.usage(f.manifest.id).workerInvocations, 5);
  assert.deepEqual(readdirSync(join(f.state, 'runs', f.manifest.id)).sort(), ['worker-inputs']);
  assert.deepEqual(readdirSync(join(f.state, 'runs', f.manifest.id, 'worker-inputs')), []);
});

test('issue outcome review passes the strict worker JSONL boundary with a source-bound reviewer', async t => {
  const f = fixture(t, 'investigate', 1);
  const identity = { issue: 2, title: 'Synthetic existing task', bodyHash: 'a'.repeat(64),
    base: f.base, path: 'desktop/src/providers/json.ts', fingerprint: 'b'.repeat(64),
    oracleHash: 'c'.repeat(64), contractHash: 'd'.repeat(64), ownerPath: null, taskId: null, taskHash: null };
  const runner: WorkerProcessRunner = { run: async request => {
    assert.ok(request.args.includes('--output-schema'));
    assert.equal(request.args.includes('--bind'), false);
    const inputs = join(f.state, 'runs', f.manifest.id, 'worker-inputs');
    const file = readdirSync(inputs).find(name => name.endsWith('.json'))!;
    const schema = JSON.parse(readFileSync(join(inputs, file), 'utf8')) as Record<string, unknown>;
    const closed = (value: unknown): void => {
      if (!value || typeof value !== 'object') return;
      const row = value as Record<string, unknown>;
      if (row.type === 'object') {
        assert.equal(row.additionalProperties, false);
        assert.deepEqual((row.required as string[]).slice().sort(),
          Object.keys(row.properties as Record<string, unknown>).sort());
      }
      for (const child of Object.values(row)) closed(child);
    };
    closed(schema);
    return output({ ...common, baseRevision: f.base, headRevision: f.base, findings: [],
      issueOutcome: { identity, matched: true, complete: true } });
  }, reconcile: async () => { throw new Error('Unexpected reconcile'); } };
  const result = await runWorker({ store: f.store, runId: f.manifest.id, role: 'reviewer',
    workspace: f.root, revision: f.base, reviewHead: f.base, issueOutcomeReview: true,
    instructions: 'Compare the selected issue and frozen baseline task.' }, f.profile, runner);
  assert.equal(result.status, 'complete');
  assert.deepEqual((result.response as { issueOutcome?: unknown }).issueOutcome,
    { identity, matched: true, complete: true });
});

test('rejects authority fields, malformed or truncated JSONL, failures and output excess as observed attempts', async t => {
  const f = fixture(t, 'issue', 6);
  const outcomes = [
    output({ ...values.investigator, delivery: 'merge-eligible' }),
    output(values.investigator, { stdout: '{bad}\n' }),
    output(values.investigator, { stdout: '{"type":"item.completed"}' }),
    output(values.investigator, { exitCode: 9 }),
    output(values.investigator, { outputTruncated: true }),
    output(values.investigator, { stdout: 'x'.repeat(1_000_001) + '\n' })
  ];
  let calls = 0;
  const runner: WorkerProcessRunner = { run: async () => outcomes[calls++]!, reconcile: async () => { throw new Error('Unexpected reconcile'); } };
  const failures = [];
  for (let i = 0; i < 6; i++) {
    const result = await runWorker({ store: f.store, runId: f.manifest.id, role: 'investigator',
      workspace: f.root, revision: f.base, instructions: `case ${i}` }, f.profile, runner);
    failures.push(result.failure);
  }
  assert.deepEqual(failures, ['invalid_worker_output', 'invalid_worker_output', 'jsonl_truncated', 'process_nonzero', 'output_truncated', 'output_truncated']);
  assert.equal(calls, 6);
});

test('stable identity reuses observed receipt and cumulative allowance survives resume', async t => {
  const f = fixture(t, 'issue', 1); let calls = 0;
  const runner: WorkerProcessRunner = { run: async () => { calls++; return output(values.investigator); },
    reconcile: async () => { throw new Error('Unexpected reconcile'); } };
  const input = { store: f.store, runId: f.manifest.id, role: 'investigator' as const,
    workspace: f.root, revision: f.base, instructions: 'Inspect' };
  const first = await runWorker(input, f.profile, runner);
  const again = await runWorker(input, f.profile, runner);
  assert.equal(first.operationKey, again.operationKey); assert.equal(calls, 1);
  assert.equal(f.store.usage(f.manifest.id).workerInvocations, 1);
  const resumed = new RunStore(f.state, f.manifest); t.after(() => resumed.close());
  assert.equal((await runWorker({ ...input, store: resumed }, f.profile, runner)).operationKey, first.operationKey);
  assert.equal(resumed.usage(f.manifest.id).workerInvocations, 1);
  assert.deepEqual(resumed.get(f.manifest.id).data.ownedProcesses,
    [{ key: first.operationKey, stateDirectory: first.processDirectory }]);
  await assert.rejects(runWorker({ ...input, instructions: 'Different' }, f.profile, runner), { code: 'budget_exhausted' });
});

test('JSONL uses the last message of the completed turn and refuses events after completion', async t => {
  const f = fixture(t);
  const final = output(values.investigator);
  const prefix = `${JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: 'I will inspect the scoped source.' } })}\n`;
  const valid = await runWorker({ store: f.store, runId: f.manifest.id, role: 'investigator',
    workspace: f.root, revision: f.base, instructions: 'commentary' }, f.profile, {
    run: async () => ({ ...final, stdout: prefix + final.stdout }), reconcile: async () => final
  });
  assert.equal(valid.status, 'complete'); assert.deepEqual(valid.usage, { inputTokens: 3, outputTokens: 4 });
  const duplicate = `${JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: JSON.stringify(values.investigator) } })}\n`;
  const last = output({ ...values.investigator, status: 'needs_decision' });
  const selected = await runWorker({ store: f.store, runId: f.manifest.id, role: 'investigator',
    workspace: f.root, revision: f.base, instructions: 'duplicate-final' }, f.profile, {
    run: async () => ({ ...last, stdout: duplicate + last.stdout }), reconcile: async () => last
  });
  assert.equal(selected.status, 'needs_decision');
  const refused = await runWorker({ store: f.store, runId: f.manifest.id, role: 'investigator',
    workspace: f.root, revision: f.base, instructions: 'event-after-completion' }, f.profile, {
    run: async () => ({ ...final, stdout: final.stdout + duplicate }), reconcile: async () => final
  });
  assert.equal(refused.status, 'failed'); assert.equal(refused.failure, 'events_after_completion');
  assert.deepEqual(refused.usage, { inputTokens: 3, outputTokens: 4 });
});

test('unknown launch stays quarantined and reconciles without a duplicate model launch', async t => {
  const f = fixture(t); let calls = 0; let known: OwnedProcessResult | null = null;
  const runner: WorkerProcessRunner = { run: async () => { calls++; throw new Error('Lost receipt'); },
    reconcile: async () => known ?? Promise.reject(new Error('Unknown')) };
  const input = { store: f.store, runId: f.manifest.id, role: 'investigator' as const,
    workspace: f.root, revision: f.base, instructions: 'Inspect' };
  await assert.rejects(runWorker(input, f.profile, runner));
  await assert.rejects(runWorker(input, f.profile, runner));
  assert.equal(calls, 1);
  known = output(values.investigator);
  assert.equal((await runWorker(input, f.profile, runner)).status, 'complete');
  assert.equal(calls, 1);
});

test('verified setup failure is observed so a bounded repair can launch after resume', async t => {
  const f = fixture(t); let calls = 0;
  const runner: WorkerProcessRunner = { run: async () => { calls++; return output(values.investigator); },
    reconcile: async () => { throw new Error('No process should exist'); } };
  const input = { store: f.store, runId: f.manifest.id, role: 'investigator' as const,
    workspace: f.root, revision: f.base, instructions: 'Inspect' };
  const invalid = { ...f.profile, binary: f.config };
  await assert.rejects(runWorker(input, invalid, runner), { code: 'unsupported_backend' });
  const resumed = new RunStore(f.state, f.manifest); t.after(() => resumed.close());
  await assert.rejects(runWorker({ ...input, store: resumed }, invalid, runner), { code: 'unsupported_backend' });
  assert.equal(calls, 0);
  assert.deepEqual(resumed.ownedProcesses(f.manifest.id), []);
  await resumed.reconcileOwnedExecutions(f.manifest.id);
  assert.equal((await runWorker({ ...input, store: resumed, attempt: 1 }, f.profile, runner)).status, 'complete');
  assert.equal(resumed.usage(f.manifest.id).workerInvocations, 2);
  assert.equal(calls, 1);
});

test('write requests and reviewer source mismatch fail before dispatch', async t => {
  const f = fixture(t, 'investigate'); let calls = 0;
  const runner: WorkerProcessRunner = { run: async () => { calls++; return output(values.investigator); },
    reconcile: async () => { throw new Error('Unexpected'); } };
  const input = { store: f.store, runId: f.manifest.id, workspace: f.root, revision: f.base, instructions: 'Inspect' };
  await assert.rejects(runWorker({ ...input, role: 'investigator', write: true }, f.profile, runner), { code: 'invalid_worker_request' });
  await assert.rejects(runWorker({ ...input, role: 'implementer' }, f.profile, runner), { code: 'needs_decision' });
  await assert.rejects(runWorker({ ...input, role: 'reviewer', reviewHead: 'a'.repeat(40) }, f.profile, runner), { code: 'review_source_mismatch' });
  assert.equal(calls, 0);
});

test('an issue reference with report delivery does not authorize a writing worker', async t => {
  const f = fixture(t);
  const report = makeManifest({ repository: f.manifest.repository, root: f.root, commonDir: f.manifest.commonDir,
    base: f.base, scope: 'providers-json', mode: 'issue', issue: 2, modelProfile: f.profile.name, delivery: 'report' });
  f.store.admit(report); let calls = 0;
  await assert.rejects(runWorker({ store: f.store, runId: report.id, role: 'implementer', workspace: f.root,
    revision: f.base, instructions: 'Read-only issue review' }, f.profile, {
    run: async () => { calls++; return output(values.implementer); }, reconcile: async () => output(values.implementer)
  }), { code: 'delivery_denied' });
  assert.equal(calls, 0); assert.equal(f.store.usage(report.id).workerInvocations, 0);
});

test('issue mode requires the same confirmed coordinator binding before launch', async t => {
  const f = fixture(t); const issue = makeManifest({ repository: f.manifest.repository, root: f.root,
    commonDir: f.manifest.commonDir, base: f.base, scope: 'providers-json', mode: 'issue', issue: 7,
    modelProfile: f.profile.name, delivery: 'pr' });
  f.store.admit(issue); let calls = 0; const fingerprint = 'e'.repeat(64);
  const request = { store: f.store, runId: issue.id, role: 'implementer' as const, workspace: f.root,
    revision: f.base, instructions: 'Apply existing issue' };
  const runner = { run: async () => { calls++; return output(values.implementer); },
    reconcile: async () => output(values.implementer) };
  await assert.rejects(runWorker(request, f.profile, runner), { code: 'needs_decision' });
  assert.equal(calls, 0); assert.equal(f.store.usage(issue.id).workerInvocations, 0);
  f.store.update(issue.id, { data: { taskAuthority: { issue: 7, fingerprint },
    findings: [{ id: 'confirmed', fingerprint, path: 'desktop/src/providers/json.ts', state: 'confirmed',
      evidence: { source: f.base, outcome: 'failed', environment: 'linux-portable-synthetic',
        oracleHash: 'a'.repeat(64), contractHash: 'b'.repeat(64) },
      baselineReview: { clean: true, base: f.base, findingId: 'confirmed', oracleHash: 'a'.repeat(64), contractHash: 'b'.repeat(64) } }],
    issueReceipts: [{ number: 7, url: 'https://github.com/example/sc/issues/7', state: 'open' }] } });
  assert.equal((await runWorker(request, f.profile, runner)).status, 'complete'); assert.equal(calls, 1);
});

test('discovery can write only after the coordinator binds a confirmed finding to a verified issue', async t => {
  const f = fixture(t, 'investigate'); const fingerprint = 'c'.repeat(64);
  const request = { store: f.store, runId: f.manifest.id, role: 'implementer' as const,
    workspace: f.root, revision: f.base, instructions: 'Apply accepted correction' };
  const runner = { run: async () => output(values.implementer), reconcile: async () => output(values.implementer) };
  f.store.update(f.manifest.id, { data: { taskAuthority: { issue: 7, fingerprint },
    findings: [{ id: 'confirmed', fingerprint, path: 'desktop/src/providers/json.ts', state: 'confirmed',
      evidence: { source: f.base, outcome: 'failed', environment: 'linux-portable-synthetic',
        oracleHash: 'a'.repeat(64), contractHash: 'b'.repeat(64) },
      baselineReview: { clean: true, base: f.base, findingId: 'confirmed', oracleHash: 'a'.repeat(64), contractHash: 'b'.repeat(64) } }],
    issueReceipts: [{ number: 7, url: 'https://github.com/example/sc/issues/7', state: 'open' }] } });
  assert.equal((await runWorker(request, f.profile, runner)).status, 'complete');
});

test('reviewer rejects a returned head mismatch and timeout or cancellation cannot pass', async t => {
  const f = fixture(t); let calls = 0;
  const outcomes = [output({ ...values.reviewer, baseRevision: f.base, headRevision: 'b'.repeat(40) }),
    output(values.investigator, { status: 'timeout', exitCode: null }),
    output(values.investigator, { status: 'cancelled', exitCode: null })];
  const runner: WorkerProcessRunner = { run: async () => outcomes[calls++]!,
    reconcile: async () => { throw new Error('Unexpected'); } };
  const input = { store: f.store, runId: f.manifest.id, workspace: f.root, revision: f.base, instructions: 'Review' };
  assert.equal((await runWorker({ ...input, role: 'reviewer', reviewHead: f.base }, f.profile, runner)).failure,
    'review_source_mismatch');
  assert.equal((await runWorker({ ...input, role: 'investigator' }, f.profile, runner)).failure, 'process_timeout');
  assert.equal((await runWorker({ ...input, role: 'investigator', attempt: 1 }, f.profile, runner)).failure, 'process_cancelled');
  assert.equal(calls, 3);
});

test('graph stage owns elapsed time and a repair round is counted once across roles', async t => {
  const f = fixture(t); let calls = 0;
  const runner: WorkerProcessRunner = { run: async () => {
    calls++;
    return output(calls === 1 ? values.implementer : { ...values.reviewer, baseRevision: f.base, headRevision: f.base });
  }, reconcile: async () => { throw new Error('Unexpected'); } };
  f.store.reserve(f.manifest.id, 'stage:repair', 'activeMs', 1000);
  const input = { store: f.store, runId: f.manifest.id, workspace: f.root, revision: f.base,
    instructions: 'Repair existing behavior', attempt: 1, timeReservedByStage: true };
  assert.equal((await runWorker({ ...input, role: 'implementer' }, f.profile, runner)).status, 'complete');
  assert.equal((await runWorker({ ...input, role: 'reviewer', reviewHead: f.base }, f.profile, runner)).status, 'complete');
  f.store.settleTime(f.manifest.id, 'stage:repair', 42);
  assert.equal(f.store.usage(f.manifest.id).activeMs, 42);
  assert.equal(f.store.usage(f.manifest.id).repairs, 1);
  assert.equal(f.store.usage(f.manifest.id).workerInvocations, 2);
});

test('reproducer requires a bounded executable oracle or explicit null', async t => {
  const f = fixture(t); let calls = 0;
  const outcomes = [output({ ...values.reproducer, oracle: null }),
    output({ ...values.reproducer, oracle: { ...values.reproducer.oracle, command: 'shell' } }),
    output({ ...values.reproducer, oracle: { kind: 'portable-node', script: 'x'.repeat(8001), contractPaths: [] } })];
  const runner: WorkerProcessRunner = { run: async () => outcomes[calls++]!,
    reconcile: async () => { throw new Error('Unexpected'); } };
  const input = { store: f.store, runId: f.manifest.id, role: 'reproducer' as const,
    workspace: f.root, revision: f.base, instructions: 'Reproduce' };
  assert.equal((await runWorker(input, f.profile, runner)).status, 'complete');
  assert.equal((await runWorker({ ...input, instructions: 'Reproduce case two' }, f.profile, runner)).failure, 'invalid_worker_output');
  assert.equal((await runWorker({ ...input, instructions: 'Reproduce case three' }, f.profile, runner)).failure, 'invalid_worker_output');
});

test('selected configuration accepts simple standard model and refuses custom or unsupported syntax', t => {
  const f = fixture(t);
  assert.equal(f.profile.model, 'gpt-6-sol'); assert.equal(f.profile.effort, 'medium');
  writeFileSync(f.config, 'model = "gpt-6-sol"\nmodel_reasoning_effort = "max"\n');
  assert.equal(loadCodexProfile({ name: 'selected', binary: '/usr/bin/node', authFile: f.auth, configFile: f.config }).effort, 'max');
  writeFileSync(f.config, "model = 'gpt-6-sol'\nmodel_reasoning_effort = 'max'\n[projects.\"/synthetic/path\"]\ntrust_level = 'trusted'\n[mcp_servers.example]\nargs = [\n 'unrelated',\n]\n");
  assert.equal(loadCodexProfile({ name: 'selected', binary: '/usr/bin/node', authFile: f.auth, configFile: f.config }).effort, 'max');
  writeFileSync(f.config, 'model = "gpt-6-sol"\n[mcp_servers.example]\ncommand = "/usr/bin/false"\nargs = ["one", "two"]\nenabled = true\nstartup_timeout_sec = 5\n');
  assert.equal(loadCodexProfile({ name: 'selected', binary: '/usr/bin/node', authFile: f.auth, configFile: f.config }).model,
    'gpt-6-sol');
  for (const config of ['model_provider = "proxy"\nmodel = "gpt-6-sol"\n',
    'model = "gpt-6-sol"\nmodel_reasoning_effort = ["high"]\n',
    'model = "gpt-6-sol"\n[model_providers.custom]\nbase_url = "https://example.invalid"\n',
    'model = "gpt-6-sol"\n[mcp_servers.example\ncommand = "/usr/bin/false"\n']) {
    writeFileSync(f.config, config);
    assert.throws(() => loadCodexProfile({ name: 'selected', binary: '/usr/bin/node', authFile: f.auth, configFile: f.config }),
      { code: 'unsupported_profile' });
  }
  assert.equal(existsSync(f.auth), true);
});
