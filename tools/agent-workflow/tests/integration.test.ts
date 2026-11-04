import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { digest, makeManifest } from '../src/manifest.js';
import { decideMerge, classifyDiff } from '../src/policy.js';
import { freezeCandidate, selectVerificationCommands, type VerificationReceipt } from '../src/candidate.js';
import { RunStore } from '../src/store.js';
import { integrateCandidate, observePostflight, publishIntegrationIncident, prepareFinalization,
  prepareObservedFinalization,
  type IntegrationTransport, type MergeReceipt } from '../src/integration.js';

const taskPath = 'openspec/changes/fix-confirmed-aaaaaaaaaaaa/tasks.md';
const taskTemplate = '# Tasks\n\n- [ ] 1.1 Reproduce failure.\n- [ ] 1.2 Correct source.\n- [ ] 1.3 Verify and review.\n';
async function syntheticApi(t: { after(fn: () => void): void }, issueLimit = 3) {
  const directory = mkdtempSync(join(tmpdir(), 'sc-integration-')), root = join(directory, 'repo');
  mkdirSync(root);
  const git = (...args: string[]) => execFileSync('/usr/bin/git', ['-C', root, '-c', 'user.name=Fixture',
    '-c', 'user.email=fixture@example.invalid', ...args], { encoding: 'utf8' }).trim();
  git('init', '-b', 'main');
  writeFileSync(join(root, 'README.md'), '[user guide](bad.md)\n');
  mkdirSync(join(root, 'openspec/changes/fix-confirmed-aaaaaaaaaaaa'), { recursive: true });
  writeFileSync(join(root, taskPath), taskTemplate);
  git('add', '.'); git('commit', '-m', 'base');
  const base = git('rev-parse', 'HEAD');
  const manifest = makeManifest({ repository: 'github.com/example/sc', root, commonDir: join(root, '.git'),
    base, scope: 'docs-links', mode: 'investigate', delivery: 'merge-eligible', limits: { issues: issueLimit } });
  const branch = `sc-agent/issue-28-${manifest.id.slice(0, 8)}`;
  git('switch', '-c', branch);
  writeFileSync(join(root, 'README.md'), '[user guide](docs/USER_GUIDE.md)\n');
  const store = new RunStore(join(directory, 'state'), manifest); store.admit(manifest); store.claim(manifest.id);
  t.after(() => { store.release(manifest.id); store.close(); rmSync(directory, { recursive: true, force: true }); });
  const inspection = { workspace: root, targetExists: () => true };
  const frozen = await freezeCandidate({ ...inspection, store, manifest, issue: 28, branch, key: 'round-0',
    timestamp: 1_700_000_000, message: 'Fix local guide link' });
  const envHash = 'e'.repeat(64);
  const checks = [] as VerificationReceipt['checks'];
  for (const command of selectVerificationCommands(frozen.checks, base, frozen.head)) {
    const result = { status: 'exited', exitCode: 0, signal: null, stdout: 'synthetic', stderr: '',
      outputTruncated: false, elapsedMs: 1 };
    await store.effect(manifest.id, `verification:round-0-checks:${command.name}`, 'verification',
      { synthetic: true, command }, { execute: async () => result, reconcile: async () => null });
    checks.push({ name: command.name, commandHash: digest({ command, environmentHash: envHash }),
      resultHash: digest(result), exitCode: 0, status: 'exited', passed: true, outputTruncated: false,
      environment: command.environment, environmentHash: envHash });
  }
  // These are synthetic API boundary records, not real verifier or hosted-CI proof.
  const verification: VerificationReceipt = { base, head: frozen.head, tree: frozen.tree,
    sourceHash: frozen.sourceHash, diffHash: frozen.diffHash, policyHash: frozen.policyHash,
    environment: 'portable-documentation', environmentIdentity: { hash: envHash, fixture: false,
      sandboxHash: 'synthetic', sandboxProfile: { readonlySource: true, network: false, auth: false,
        outputs: null, revision: frozen.head }, programs: {}, dependencies: null },
    checks, passed: true, missingCapabilities: [] };
  const review = { base, head: frozen.head, diffHash: frozen.diffHash, policyHash: frozen.policyHash, clean: true };
  const issue = { number: 28, url: 'https://github.com/example/sc/issues/28', body: '', state: 'open' as const, reused: true };
  const pr = { number: 29, url: 'https://github.com/example/sc/pull/29', head: frozen.head,
    base: 'main', body: '', state: 'open' as const, reused: false };
  const oracleHash = '1'.repeat(64), contractHash = '2'.repeat(64);
  const oracle = async (source: string, exitCode: 0 | 42) => {
    const request = { runId: manifest.id, source, workspace: root, oracleHash, contractHash };
    const operationKey = `oracle:${digest(request)}`;
    const result = { status: 'exited', exitCode, signal: null, stdout: 'synthetic', stderr: '',
      outputTruncated: false, elapsedMs: 1 };
    await store.effect(manifest.id, operationKey, 'verification', request,
      { execute: async () => result, reconcile: async () => null });
    return { source, oracleHash, contractHash, environment: 'linux-portable-synthetic',
      outcome: exitCode === 0 ? 'passed' : 'failed', operationKey, exitCode,
      outputHash: digest([result.stdout, result.stderr]) };
  };
  const failedOracle = await oracle(base, 42), candidateOracle = await oracle(frozen.head, 0);
  store.update(manifest.id, { data: { frozen, verification, reviewReceipt: review, pull: pr, issueReceipts: [issue], round: { number: 0 },
    findings: [{ state: 'confirmed', evidence: failedOracle }], candidateOracle } });
  let main = base, merged = false, puts = 0, protection = true, reviewCount = 1,
    sourceHead = frozen.head, skipMainJobs = false,
    checkState: 'success' | 'pending' | 'failure' = 'success';
  const squash = 'c'.repeat(40), incidents: Record<string, unknown>[] = [];
  const required = ['changes', 'documentation', 'portable', 'windows-build', 'agent-workflow'];
  const transport: IntegrationTransport = async (method, endpoint, body) => {
    if (endpoint === '/repos/example/sc' && method === 'GET') return { default_branch: 'main', allow_squash_merge: true,
      allow_auto_merge: false };
    if (endpoint === '/repos/example/sc/pulls/29' && method === 'GET') return { number: 29,
      html_url: pr.url, state: merged ? 'closed' : 'open', merged_at: merged ? '2026-11-04T00:00:00Z' : null,
      merge_commit_sha: merged ? squash : null, body: '',
      head: { ref: branch, sha: sourceHead, repo: { full_name: 'example/sc' } },
      base: { ref: 'main', sha: main, repo: { full_name: 'example/sc' } } };
    if (endpoint === '/repos/example/sc/branches/main' && method === 'GET') return { commit: { sha: main } };
    if (endpoint === `/repos/example/sc/branches/${branch}` && method === 'GET') return { commit: { sha: sourceHead } };
    if (endpoint === '/repos/example/sc/branches/main/protection' && method === 'GET') {
      if (!protection) throw new Error('missing protection');
      return { required_status_checks: { strict: true, contexts: required }, enforce_admins: { enabled: true },
        allow_force_pushes: { enabled: false }, allow_deletions: { enabled: false },
        required_pull_request_reviews: { url: 'https://api.github.com/review', required_approving_review_count: reviewCount } };
    }
    if (endpoint === '/repos/example/sc/rulesets?includes_parents=true' && method === 'GET') return [];
    if (endpoint === `/repos/example/sc/compare/${squash}...${main}` && method === 'GET')
      return { status: 'ahead', ahead_by: 1, base_commit: { sha: squash },
        merge_base_commit: { sha: squash }, commits: [{ sha: main }], total_commits: 1 };
    if (endpoint.endsWith('/check-runs?per_page=100') && method === 'GET') return { total_count: 5,
      check_runs: required.map((name, id) => ({ id: id + 1, name, head_sha: endpoint.includes(squash) ? squash : frozen.head,
        conclusion: skipMainJobs && endpoint.includes(squash) && ['portable', 'windows-build'].includes(name) ? 'skipped' : checkState })) };
    if (endpoint.endsWith('/statuses?per_page=100') && method === 'GET') return [];
    if (endpoint === '/repos/example/sc/pulls/29/merge' && method === 'PUT') {
      assert.deepEqual(body, { sha: frozen.head, merge_method: 'squash' });
      puts++; merged = true; main = squash;
      return { merged: true, sha: squash };
    }
    if (endpoint.startsWith('/repos/example/sc/issues?') && method === 'GET') return incidents;
    if ((endpoint === '/user' || endpoint === '/users/Ziyadin23') && method === 'GET') return { login: 'Ziyadin23' };
    if (endpoint === '/repos/example/sc/issues' && method === 'POST') {
      const input = body as { body: string; assignees: string[] };
      assert.deepEqual(input.assignees, ['Ziyadin23']);
      const row = { number: 30, html_url: 'https://github.com/example/sc/issues/30', state: 'open',
        body: input.body, assignees: [{ login: 'Ziyadin23' }] };
      incidents.push(row); return row;
    }
    if (endpoint === '/repos/example/sc/issues/30' && method === 'GET') return incidents[0];
    throw new Error(`Unexpected synthetic API ${method} ${endpoint}`);
  };
  const request = { store, runId: manifest.id, frozen, inspection, verification, review, pr, issue, transport };
  return { request, manifest, store, frozen, squash, get puts() { return puts; },
    get incidentCount() { return incidents.length; },
    setProtection(value: boolean) { protection = value; },
    setReviewCount(value: number) { reviewCount = value; },
    setHead(value: string) { sourceHead = value; },
    setMain(value: string) { main = value; },
    setChecks(value: typeof checkState) { checkState = value; },
    skipMainJobs(value: boolean) { skipMainJobs = value; },
    setMerged(value: boolean) { merged = value; } };
}

test('the final record is derived only from the saved task template and observed merge', () => {
  const manifest = makeManifest({ repository: 'github.com/example/sc', root: '/tmp/sc', commonDir: '/tmp/sc/.git',
    base: 'a'.repeat(40), scope: 'docs-links', delivery: 'merge-eligible' });
  const task = '# Tasks\n\n- [ ] 1.1 Reproduce failure.\n- [ ] 1.2 Correct source.\n- [ ] 1.3 Verify and review.\n';
  const merge: MergeReceipt = { repository: manifest.repository, base: manifest.base, head: 'b'.repeat(40),
    mergeHead: 'c'.repeat(40), prNumber: 28, prUrl: 'https://github.com/example/sc/pull/28' };
  const result = prepareFinalization({ manifest, taskPath: 'openspec/changes/fix-confirmed-aaaaaaaaaaaa/tasks.md',
    template: task, frozenTask: task, merge, postflight: { state: 'ready', head: merge.mergeHead,
      checksHash: 'd'.repeat(64) } });
  assert.equal(result.path, 'openspec/changes/fix-confirmed-aaaaaaaaaaaa/tasks.md');
  assert.match(result.content, /- \[x\] 1\.1 Reproduce failure\./);
  assert.match(result.content, /Source head: b{40}/);
  assert.doesNotMatch(result.content, /Acceptance:/);
  assert.throws(() => prepareFinalization({ manifest, taskPath: result.path, template: task,
    frozenTask: `${task}Extra permission\n`, merge, postflight: { state: 'ready', head: merge.mergeHead,
      checksHash: 'd'.repeat(64) } }));
});

test('policy denies an ineligible parser despite positive model-like evidence', () => {
  const manifest = makeManifest({ repository: 'github.com/example/sc', root: '/tmp/sc', commonDir: '/tmp/sc/.git',
    base: 'a'.repeat(40), scope: 'providers-json', delivery: 'merge-eligible' });
  const classification = classifyDiff(manifest, [{ path: 'desktop/src/providers/json.ts', before: 'x', after: 'y', mode: '100644' }]);
  const binding = { base: manifest.base, head: 'b'.repeat(40), diffHash: classification.diffHash, policyHash: classification.policyHash };
  const decision = decideMerge(manifest, classification, { ...binding,
    verification: { ...binding, passed: true, environment: 'portable-application' },
    review: { ...binding, clean: true }, checks: { head: binding.head, ready: true }, protection: true,
    upToDate: true, integrationHold: false,
    regression: { baselineFailed: true, candidatePassed: true, oracleHash: 'c'.repeat(64) },
    handoff: { head: binding.head, qualified: true, receiptHash: 'd'.repeat(64) } });
  assert.equal(decision.eligible, false);
});

test('synthetic API: missing protection and changed head or base prevent merge', async t => {
  const f = await syntheticApi(t);
  f.setProtection(false);
  assert.deepEqual(await integrateCandidate(f.request), { state: 'wait', reason: 'branch_protection' });
  f.setProtection(true); f.setHead('d'.repeat(40));
  assert.deepEqual(await integrateCandidate(f.request), { state: 'wait', reason: 'source_or_base_changed' });
  f.setHead(f.frozen.head); f.setMain('d'.repeat(40));
  assert.deepEqual(await integrateCandidate(f.request), { state: 'wait', reason: 'source_or_base_changed' });
  assert.equal(f.puts, 0);
});

test('synthetic API: exact frozen evidence merges once, then postflight failure holds the repository', async t => {
  const f = await syntheticApi(t);
  const merged = await integrateCandidate(f.request);
  assert.equal(merged.state, 'merged');
  if (merged.state !== 'merged') return;
  assert.equal(merged.receipt.mergeHead, f.squash);
  assert.equal(f.puts, 1);
  assert.equal((await integrateCandidate(f.request)).state, 'merged');
  assert.equal(f.puts, 1);
  f.setChecks('pending');
  assert.equal((await observePostflight({ store: f.store, runId: f.manifest.id,
    merge: merged.receipt, transport: f.request.transport })).state, 'pending');
  assert.equal(f.store.repositoryIntegrationHold()?.reason, 'postflight_pending');
  f.setChecks('failure');
  const postflight = await observePostflight({ store: f.store, runId: f.manifest.id,
    merge: merged.receipt, transport: f.request.transport });
  assert.equal(postflight.state, 'failed');
  assert.deepEqual(f.store.repositoryIntegrationHold(), { runId: f.manifest.id, head: f.squash,
    reason: 'main_checks_failed' });
  const incident = await publishIntegrationIncident({ store: f.store, runId: f.manifest.id,
    merge: merged.receipt, postflight, transport: f.request.transport });
  assert.equal('number' in incident && incident.number, 30);
  const replay = await publishIntegrationIncident({ store: f.store, runId: f.manifest.id,
    merge: merged.receipt, postflight, transport: f.request.transport });
  assert.equal('number' in replay && replay.number, 30);
  f.setChecks('success');
  assert.equal((await observePostflight({ store: f.store, runId: f.manifest.id,
    merge: merged.receipt, transport: f.request.transport })).state, 'ready');
  assert.equal(f.store.repositoryIntegrationHold()?.reason, 'main_checks_failed');
});

test('synthetic API: exhausted finding issue quota prevents source merge before PUT', async t => {
  const f = await syntheticApi(t, 1);
  f.store.reserve(f.manifest.id, 'intake-used-all-issues', 'issues');
  assert.deepEqual(await integrateCandidate(f.request), { state: 'wait', reason: 'incident_capacity_unavailable' });
  assert.equal(f.puts, 0);
});

test('synthetic API: lost merge acknowledgement reconciles without a second PUT', async t => {
  const f = await syntheticApi(t);
  const original = f.request.transport;
  let lost = false;
  f.request.transport = async (method, endpoint, body) => {
    const result = await original(method, endpoint, body);
    if (method === 'PUT' && !lost) { lost = true; throw new Error('lost acknowledgement'); }
    return result;
  };
  assert.deepEqual(await integrateCandidate(f.request), { state: 'wait', reason: 'merge_outcome_unknown' });
  assert.equal(f.puts, 1);
  const resumed = await integrateCandidate(f.request);
  assert.equal(resumed.state, 'merged');
  assert.equal(f.puts, 1);
});

test('synthetic API: unmergeable unknown outcome stays pending without retry', async t => {
  const f = await syntheticApi(t);
  const original = f.request.transport;
  f.request.transport = async (method, endpoint, body) => {
    if (method === 'PUT') throw new Error('unknown merge');
    return original(method, endpoint, body);
  };
  assert.deepEqual(await integrateCandidate(f.request), { state: 'wait', reason: 'merge_outcome_unknown' });
  assert.deepEqual(await integrateCandidate(f.request), { state: 'wait', reason: 'merge_outcome_unknown' });
  assert.equal(f.puts, 0);
});

test('synthetic API: fixture verification, active hold and delivery limits deny merge', async t => {
  const f = await syntheticApi(t);
  const fixture = { ...f.request.verification,
    environmentIdentity: { ...f.request.verification.environmentIdentity, fixture: true } };
  f.store.update(f.manifest.id, { data: { ...f.store.get(f.manifest.id).data, verification: fixture } });
  await assert.rejects(integrateCandidate({ ...f.request, verification: fixture }), { code: 'stale_evidence' });
  f.store.update(f.manifest.id, { data: { ...f.store.get(f.manifest.id).data,
    verification: f.request.verification, integrationHold: { active: true, head: f.squash, reason: 'main_checks_failed' } } });
  assert.deepEqual(await integrateCandidate(f.request), { state: 'wait', reason: 'repository_integration_hold' });
  assert.equal(f.puts, 0);
});

test('synthetic API: missing or failed source checks cannot authorize merge', async t => {
  const f = await syntheticApi(t);
  f.setChecks('pending');
  assert.deepEqual(await integrateCandidate(f.request), { state: 'wait', reason: 'checks_not_passed' });
  f.setChecks('failure');
  assert.deepEqual(await integrateCandidate(f.request), { state: 'wait', reason: 'checks_not_passed' });
  assert.equal(f.puts, 0);
});

test('synthetic API: unavailable postflight creates a persistent hold', async t => {
  const f = await syntheticApi(t);
  const merged = await integrateCandidate(f.request);
  assert.equal(merged.state, 'merged');
  if (merged.state !== 'merged') return;
  const postflight = await observePostflight({ store: f.store, runId: f.manifest.id,
    merge: merged.receipt, transport: async () => { throw new Error('unavailable'); } });
  assert.deepEqual(postflight, { state: 'pending', head: f.squash, checksHash: digest('unavailable'),
    reason: 'postflight_unavailable' });
  assert.equal(f.store.repositoryIntegrationHold()?.reason, 'postflight_unavailable');
  const second = makeManifest({ repository: f.manifest.repository, root: f.manifest.root,
    commonDir: f.manifest.commonDir, base: f.manifest.base, scope: 'docs-links', delivery: 'report' });
  f.store.admit(second);
  assert.equal(f.store.repositoryIntegrationHold()?.runId, f.manifest.id);
  assert.equal((await observePostflight({ store: f.store, runId: f.manifest.id,
    merge: merged.receipt, transport: f.request.transport })).state, 'ready');
  assert.equal(f.store.repositoryIntegrationHold(), null);
});

test('synthetic API: documentation postflight accepts only deliberate job skips and discovery issue finalizes', async t => {
  const f = await syntheticApi(t); f.skipMainJobs(true);
  const merged = await integrateCandidate(f.request);
  assert.equal(merged.state, 'merged');
  if (merged.state !== 'merged') return;
  const postflight = await observePostflight({ store: f.store, runId: f.manifest.id,
    merge: merged.receipt, transport: f.request.transport });
  assert.equal(postflight.state, 'ready');
  const plan = { owner: { change: 'fix-confirmed-aaaaaaaaaaaa', path: taskPath, provenance: f.manifest.base,
    hash: digest(taskTemplate) }, provenance: { kind: 'local' as const, source: f.manifest.base,
    fingerprint: 'a'.repeat(64), issue: 28 }, files: [{ path: taskPath, content: taskTemplate, hash: digest(taskTemplate) }] };
  f.store.update(f.manifest.id, { data: { ...f.store.get(f.manifest.id).data, plan,
    taskAuthority: { issue: 28, fingerprint: 'a'.repeat(64) } } });
  assert.match(prepareObservedFinalization({ store: f.store, runId: f.manifest.id,
    merge: merged.receipt, postflight, plan }).content, /- \[x\] 1\.3 Verify and review/);
  const mismatched = { ...plan, provenance: { ...plan.provenance, issue: 31 } };
  f.store.update(f.manifest.id, { data: { ...f.store.get(f.manifest.id).data, plan: mismatched } });
  await assert.rejects(async () => prepareObservedFinalization({ store: f.store, runId: f.manifest.id,
    merge: merged.receipt, postflight, plan: mismatched }),
  { code: 'finalization_wait' });
});

test('synthetic API: advanced main retains observed squash identity without another merge', async t => {
  const f = await syntheticApi(t);
  const merged = await integrateCandidate(f.request);
  assert.equal(merged.state, 'merged');
  if (merged.state !== 'merged') return;
  f.setMain('d'.repeat(40));
  const replay = await integrateCandidate(f.request);
  assert.equal(replay.state, 'merged');
  assert.equal(f.puts, 1);
  const postflight = await observePostflight({ store: f.store, runId: f.manifest.id,
    merge: merged.receipt, transport: f.request.transport });
  assert.equal(postflight.state, 'ready');
  assert.equal(postflight.head, f.squash);
});

test('synthetic API: zero incident allowance stops source merge before PUT', async t => {
  const f = await syntheticApi(t, 0);
  assert.deepEqual(await integrateCandidate(f.request), { state: 'wait', reason: 'incident_capacity_unavailable' });
  assert.equal(f.puts, 0);
});

test('synthetic API: existing zero GitHub approvals does not invent a second account requirement', async t => {
  const f = await syntheticApi(t); f.setReviewCount(0);
  assert.equal((await integrateCandidate(f.request)).state, 'merged');
  assert.equal(f.puts, 1);
});

test('synthetic API: incident refuses an unverified configured assignee', async t => {
  const f = await syntheticApi(t);
  const merged = await integrateCandidate(f.request);
  assert.equal(merged.state, 'merged');
  if (merged.state !== 'merged') return;
  f.setChecks('failure');
  const postflight = await observePostflight({ store: f.store, runId: f.manifest.id,
    merge: merged.receipt, transport: f.request.transport });
  const original = f.request.transport;
  await assert.rejects(publishIntegrationIncident({ store: f.store, runId: f.manifest.id,
    merge: merged.receipt, postflight,
    transport: (method, endpoint, body) => endpoint === '/user' ? Promise.resolve({ login: 'Other' }) :
      original(method, endpoint, body) }), { code: 'incident_assignee_unverified' });
});

test('synthetic API: lost incident acknowledgement reconciles one issue', async t => {
  const f = await syntheticApi(t);
  const merged = await integrateCandidate(f.request);
  assert.equal(merged.state, 'merged');
  if (merged.state !== 'merged') return;
  f.setChecks('failure');
  const postflight = await observePostflight({ store: f.store, runId: f.manifest.id,
    merge: merged.receipt, transport: f.request.transport });
  const original = f.request.transport;
  await assert.rejects(publishIntegrationIncident({ store: f.store, runId: f.manifest.id,
    merge: merged.receipt, postflight,
    transport: async (method, endpoint, body) => {
      const result = await original(method, endpoint, body);
      if (method === 'POST' && endpoint === '/repos/example/sc/issues') throw new Error('lost acknowledgement');
      return result;
    } }));
  assert.equal(f.incidentCount, 1);
  const recovered = await publishIntegrationIncident({ store: f.store, runId: f.manifest.id,
    merge: merged.receipt, postflight, transport: original });
  assert.equal('number' in recovered && recovered.number, 30);
  assert.equal(f.incidentCount, 1);
  assert.equal(f.store.observedEffect(f.manifest.id,
    `integration-incident:${f.squash}:${postflight.checksHash}`)?.kind, 'github_integration_incident');
});
