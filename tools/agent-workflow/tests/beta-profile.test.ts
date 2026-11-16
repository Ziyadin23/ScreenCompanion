import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import Database from 'better-sqlite3';
import { chmodSync, existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { inspectRejectedBetaLaunch, MAX_BETA_PROFILE_MS, qualifyConfiguredBeta, selectBetaProfile } from '../src/beta-profile.js';
import { digest, makeManifest, WorkflowError } from '../src/manifest.js';
import { inspectOwnedProcess } from '../src/process.js';
import { RunStore, type BetaPrelaunchBinding } from '../src/store.js';

const sha = (value: string): string => createHash('sha256').update(value).digest('hex');
const version = '0.5.0-beta.12', token = 'synthetic-resource-identity-token';
function fixture(t: { after(fn: () => void): void }, behavior = 'process.exitCode = 7;', timeoutMs = 10_000) {
  const directory = mkdtempSync(join(tmpdir(), 'sc-beta-profile-')), root = join(directory, 'repo');
  mkdirSync(join(root, 'desktop'), { recursive: true });
  writeFileSync(join(root, 'desktop/package.json'), JSON.stringify({ name: 'synthetic-sc', version }));
  const git = (...args: string[]) => execFileSync('/usr/bin/git', ['-C', root, ...args], { encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'], env: { PATH: '/usr/bin:/bin', HOME: '/dev/null', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' } }).trim();
  git('init', '-q'); git('add', '.'); git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'synthetic fixture');
  git('remote', 'add', 'origin', 'https://github.com/example/sc.git');
  const head = git('rev-parse', 'HEAD'), state = join(directory, 'state'), profiles = join(state, 'profiles');
  mkdirSync(profiles, { recursive: true, mode: 0o700 });
  const helper = join(directory, 'helper.mjs'), resourceTokenFile = join(directory, 'resource-token');
  writeFileSync(helper, `import { appendFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
if (process.argv[2] !== '--request' || process.argv.length !== 4) throw new Error('Unexpected helper arguments');
const request = JSON.parse(readFileSync(process.argv[3], 'utf8'));
appendFileSync(join(request.receiptDirectory, 'invoked.jsonl'), JSON.stringify({ args: process.argv.slice(2), environment: Object.keys(process.env), request }) + '\\n', { mode: 0o600 });
${behavior}\n`, { mode: 0o600 });
  writeFileSync(resourceTokenFile, token, { mode: 0o600 });
  const profilePath = join(profiles, 'windows.json'), profile = { version: 1, environmentId: 'synthetic-test-environment',
    targetDirectory: join(directory, 'transfer'), helperPath: helper, timeoutMs, resourceTokenFile };
  writeFileSync(profilePath, JSON.stringify(profile), { mode: 0o600 });
  const selection = selectBetaProfile('windows', state);
  const manifest = makeManifest({ repository: 'github.com/example/sc', root, commonDir: join(root, '.git'), base: head,
    scope: 'pipeline', mode: 'issue', issue: 60, delivery: 'pr', betaProfile: selection });
  const store = new RunStore(state, manifest); store.admit(manifest);
  t.after(() => { store.close(); rmSync(directory, { recursive: true, force: true }); });
  return { directory, root, state, helper, resourceTokenFile, profilePath, profile, selection, manifest, store, head,
    git, request: { store, runId: manifest.id, workspace: root, head, version } };
}
function noQualification(f: ReturnType<typeof fixture>): void {
  for (const kind of ['beta-qualification', 'beta-resource', 'beta'])
    assert.equal(f.store.observedEffect(f.manifest.id, `${kind}:${f.head}:${version}`), null);
  assert.equal(existsSync(f.profile.targetDirectory), false);
}

// This transaction fixture supplies the trusted binding seam; it does not attest legacy source/runtime bytes.
async function rejectedFixture(t: { after(fn: () => void): void }) {
  const f = fixture(t, undefined, 7_500_000), id = f.manifest.id;
  const identity = { repository: f.manifest.repository, runId: id, workspace: f.root, head: f.head, version,
    profileHash: f.selection.hash, sourceManifestDigest: sha(f.git('ls-tree', '-r', '--full-tree', f.head) + '\n') };
  const key = `beta-process:${digest(identity)}`, processDirectory = join(f.state, 'runs', id, 'processes');
  const receiptDirectory = join(f.state, 'runs', id, 'beta', digest(identity)), requestPath = join(receiptDirectory, 'request.json');
  mkdirSync(receiptDirectory, { recursive: true, mode: 0o700 });
  const helperRequest = { version: 1, repository: identity.repository, runId: id, workspace: f.root, head: f.head,
    candidateVersion: version, environmentId: f.profile.environmentId, sourceManifestDigest: identity.sourceManifestDigest, receiptDirectory };
  writeFileSync(requestPath, JSON.stringify(helperRequest), { mode: 0o600 });
  const binding: BetaPrelaunchBinding = { identity, helperRequest, legacySourceBlobs: {}, historicalRuntimeIdentity: 'not-attested-by-source-blobs',
    processRequest: { stateDirectory: processDirectory, key, command: '/usr/bin/node', args: [f.helper, '--request', requestPath],
      cwd: receiptDirectory, env: { PATH: '/usr/bin:/bin', HOME: process.env.HOME! }, timeoutMs: f.profile.timeoutMs } };
  f.store.registerOwnedProcess(id, key, processDirectory);
  await assert.rejects(f.store.effect(id, key, 'process', identity, {
    execute: async () => { throw new WorkflowError('invalid_process_request', 'Synthetic legacy prelaunch rejection.'); },
    reconcile: async () => null
  }), { code: 'invalid_process_request' });
  const sourceHash = 'a'.repeat(64), diffHash = 'b'.repeat(64), policyHash = f.manifest.policyHash;
  const proof = { base: f.manifest.base, head: f.head, sourceHash, diffHash, policyHash };
  f.store.update(id, { status: 'failed', stage: 'handoff', error: 'invalid_process_request', data: {
    ...f.store.get(id).data, allocation: { path: f.root }, frozen: { ...proof, checks: ['application'] },
    verification: { ...proof, passed: true }, reviewReceipt: { ...proof, clean: true, findings: [] },
    versionPreparation: { reservation: { repository: identity.repository, runId: id, version } }
  } });
  f.store.reserve(id, 'prior-repair', 'repairs'); f.store.reserve(id, 'prior-worker', 'workerInvocations', 7);
  f.store.reserve(id, 'prior-writer', 'writingTasks'); f.store.reserve(id, 'prior-time', 'activeMs', 1000);
  const database = new Database(join(f.state, 'journal.sqlite')); t.after(() => database.close());
  const operation = () => database.prepare('SELECT * FROM operations WHERE run_id=? AND key=?').get(id, key) as Record<string, unknown>;
  const snapshot = () => ({ run: f.store.get(id), usage: f.store.usage(id),
    operations: database.prepare('SELECT * FROM operations WHERE run_id=? ORDER BY key').all(id) });
  return { ...f, id, key, binding, database, operation, snapshot, processDirectory, receiptDirectory, requestPath };
}

test('private profile selection binds helper, Node, configuration and resource digest without serializing the token', t => {
  const f = fixture(t);
  assert.deepEqual(Object.keys(f.selection).sort(), ['hash', 'name']);
  assert.match(f.selection.hash, /^[a-f0-9]{64}$/); assert.equal(f.selection.name, 'windows');
  assert.deepEqual(selectBetaProfile('windows', f.state), f.selection);
  assert.ok(!JSON.stringify(f.selection).includes(token));
  for (const path of [f.helper, f.resourceTokenFile, f.profilePath]) {
    const before = readFileSync(path, 'utf8'); writeFileSync(path, before + '\n');
    assert.notEqual(selectBetaProfile('windows', f.state).hash, f.selection.hash);
    writeFileSync(path, before);
  }
});

test('profile selection rejects unsafe files, source paths and excessive time without creating state', t => {
  const f = fixture(t);
  assert.throws(() => selectBetaProfile('../windows', f.state), { code: 'beta_capability_unavailable' });
  chmodSync(f.profilePath, 0o644);
  assert.throws(() => selectBetaProfile('windows', f.state), { code: 'beta_capability_unavailable' });
  chmodSync(f.profilePath, 0o600);
  const alias = join(f.directory, 'profile-link'); linkSync(f.profilePath, alias);
  assert.throws(() => selectBetaProfile('windows', f.state), { code: 'beta_capability_unavailable' }); rmSync(alias);
  const bytes = readFileSync(f.profilePath); rmSync(f.profilePath); writeFileSync(alias, bytes, { mode: 0o600 }); symlinkSync(alias, f.profilePath);
  assert.throws(() => selectBetaProfile('windows', f.state), { code: 'beta_capability_unavailable' });
  rmSync(f.profilePath); writeFileSync(f.profilePath, bytes, { mode: 0o600 });
  for (const change of [
    { timeoutMs: MAX_BETA_PROFILE_MS + 1 }, { helperPath: join(f.root, 'source-helper.mjs') },
    { resourceTokenFile: join(f.root, 'source-token') }, { targetDirectory: join(f.root, 'transfer') }, { unexpected: 'field' }
  ]) {
    if ('helperPath' in change) writeFileSync(change.helperPath!, 'export {};', { mode: 0o600 });
    if ('resourceTokenFile' in change) writeFileSync(change.resourceTokenFile!, 'synthetic', { mode: 0o600 });
    writeFileSync(f.profilePath, JSON.stringify({ ...f.profile, ...change }));
    assert.throws(() => selectBetaProfile('windows', f.state), { code: 'beta_capability_unavailable' });
  }
  assert.equal(existsSync(join(f.state, 'runs')), false);
});

test('changed or absent profile stops before a helper launch', async t => {
  const f = fixture(t);
  writeFileSync(f.helper, readFileSync(f.helper, 'utf8') + '\n');
  await assert.rejects(() => qualifyConfiguredBeta(f.request), { code: 'beta_profile_changed' });
  assert.deepEqual(f.store.ownedProcesses(f.manifest.id), []); noQualification(f);
  const manifest = makeManifest({ repository: f.manifest.repository, root: f.root, commonDir: f.manifest.commonDir,
    base: f.head, scope: 'pipeline' }); f.store.admit(manifest);
  await assert.rejects(() => qualifyConfiguredBeta({ ...f.request, runId: manifest.id }), { code: 'beta_capability_unavailable' });
  assert.deepEqual(f.store.ownedProcesses(manifest.id), []);
});

test('real harmless helper failure is observed and never becomes Windows qualification', async t => {
  const f = fixture(t);
  await assert.rejects(() => qualifyConfiguredBeta(f.request), { code: 'beta_capability_unavailable' });
  const operation = f.store.ownedProcesses(f.manifest.id)[0]!;
  const observed = f.store.observedEffect(f.manifest.id, operation.key)!;
  assert.equal(observed.kind, 'process'); assert.equal((observed.receipt as { exitCode: number }).exitCode, 7);
  const processRequest = JSON.parse(readFileSync(join(operation.stateDirectory, sha(JSON.stringify(operation.key)), 'request.json'), 'utf8')) as {
    args: string[]; env: Record<string, string>;
  };
  assert.deepEqual(Object.keys(processRequest.env).sort(), ['HOME', 'PATH']);
  assert.equal(processRequest.args[1], '--request');
  const helperRequest = JSON.parse(readFileSync(processRequest.args[2]!, 'utf8')) as { receiptDirectory: string; sourceManifestDigest: string };
  assert.equal(statSync(processRequest.args[2]!).mode & 0o777, 0o600); assert.match(helperRequest.sourceManifestDigest, /^[a-f0-9]{64}$/);
  assert.equal(readFileSync(join(helperRequest.receiptDirectory, 'invoked.jsonl'), 'utf8').trim().split('\n').length, 1);
  assert.ok(!JSON.stringify([processRequest, helperRequest, f.store.get(f.manifest.id), observed]).includes(token));
  await assert.rejects(() => qualifyConfiguredBeta(f.request), { code: 'beta_capability_unavailable' });
  assert.equal(readFileSync(join(helperRequest.receiptDirectory, 'invoked.jsonl'), 'utf8').trim().split('\n').length, 1);
  noQualification(f);
});

test('accepted long beta deadlines reach the real helper once and preserve observed failure on replay', async t => {
  for (const timeoutMs of [7_500_000, MAX_BETA_PROFILE_MS]) {
    const f = fixture(t, undefined, timeoutMs);
    await assert.rejects(() => qualifyConfiguredBeta(f.request), { code: 'beta_capability_unavailable' });
    const operation = f.store.ownedProcesses(f.manifest.id)[0]!;
    const observed = f.store.observedEffect(f.manifest.id, operation.key)!;
    assert.equal(observed.kind, 'process');
    assert.equal((observed.receipt as { exitCode: number }).exitCode, 7);
    const saved = JSON.parse(readFileSync(join(operation.stateDirectory, sha(JSON.stringify(operation.key)), 'request.json'), 'utf8'));
    assert.equal(saved.timeoutMs, timeoutMs);
    const request = JSON.parse(readFileSync(saved.args[2], 'utf8'));
    const invocations = join(request.receiptDirectory, 'invoked.jsonl');
    assert.equal(readFileSync(invocations, 'utf8').trim().split('\n').length, 1);
    await assert.rejects(() => qualifyConfiguredBeta(f.request), { code: 'beta_capability_unavailable' });
    assert.equal(readFileSync(invocations, 'utf8').trim().split('\n').length, 1);
    noQualification(f);
  }
});

test('future owned-request validation rejects before a prepared effect becomes unknown', async t => {
  const f = fixture(t), id = f.manifest.id;
  const identity = { repository: f.manifest.repository, runId: id, workspace: f.root, head: f.head, version,
    profileHash: f.selection.hash, sourceManifestDigest: sha(f.git('ls-tree', '-r', '--full-tree', f.head) + '\n') };
  const receiptDirectory = join(f.state, 'runs', id, 'beta', digest(identity));
  mkdirSync(receiptDirectory, { recursive: true, mode: 0o700 });
  symlinkSync(receiptDirectory, join(f.state, 'runs', id, 'processes'));
  await assert.rejects(qualifyConfiguredBeta(f.request), { code: 'unsafe_state_path' });
  const database = new Database(join(f.state, 'journal.sqlite')); t.after(() => database.close());
  assert.deepEqual(database.prepare("SELECT state,receipt FROM operations WHERE run_id=? AND kind='process'").get(id),
    { state: 'prepared', receipt: null });
  assert.equal(existsSync(join(receiptDirectory, 'invoked.jsonl')), false); noQualification(f);
});

test('positively rejected prelaunch transaction preserves history and budgets, replays once and runs the real helper', async t => {
  const f = await rejectedFixture(t), before = f.snapshot(), originalOperation = f.operation();
  await assert.rejects(f.store.reconcileOwnedExecutions(f.id), { code: 'owner_unverifiable' });
  assert.equal(inspectOwnedProcess(f.processDirectory, f.key).state, 'absent');
  f.store.prepareRejectedBetaLaunch(f.id, () => f.binding);
  const admitted = f.snapshot();
  assert.deepEqual(f.operation(), { ...originalOperation, state: 'prepared' });
  assert.deepEqual(admitted.usage, { ...before.usage, repairs: before.usage.repairs + 1 });
  assert.deepEqual(admitted.run.manifest, before.run.manifest);
  assert.equal(admitted.run.error, 'invalid_process_request'); assert.equal(admitted.run.status, 'failed');
  const history = admitted.run.data.betaPrelaunchRetryHistory as { previous: { operation: unknown; usage: unknown } }[];
  assert.equal(history.length, 1); assert.deepEqual(history[0]!.previous.operation, originalOperation);
  assert.deepEqual(history[0]!.previous.usage, before.usage);
  const reopened = new RunStore(f.state, f.manifest); t.after(() => reopened.close());
  reopened.prepareRejectedBetaLaunch(f.id, () => f.binding);
  assert.deepEqual(f.snapshot(), admitted);
  await reopened.reconcileOwnedExecutions(f.id);
  await assert.rejects(qualifyConfiguredBeta({ ...f.request, store: reopened }), { code: 'beta_capability_unavailable' });
  assert.equal((reopened.observedEffect(f.id, f.key)?.receipt as { exitCode: number }).exitCode, 7);
  await assert.rejects(qualifyConfiguredBeta({ ...f.request, store: reopened }), { code: 'beta_capability_unavailable' });
  assert.equal(readFileSync(join(f.receiptDirectory, 'invoked.jsonl'), 'utf8').trim().split('\n').length, 1);
  assert.deepEqual(reopened.get(f.id).data.betaPrelaunchRetryHistory, history);
  assert.throws(() => reopened.update(f.id, { data: { ...reopened.get(f.id).data, betaPrelaunchRetryHistory: [] } }), { code: 'invalid_state' });
  assert.throws(() => reopened.update(f.id, { data: { unrelated: true } }), { code: 'invalid_state' });
  noQualification(f);
});

test('prelaunch preparation refuses changed state, bindings, partial launches, ownership and exhausted allowances without mutation', async t => {
  const variants: { name: string; change(f: Awaited<ReturnType<typeof rejectedFixture>>): void; code?: string }[] = [
    { name: 'stage', change: f => f.store.update(f.id, { stage: 'review' }) },
    { name: 'status', change: f => f.store.update(f.id, { status: 'awaiting_input' }) },
    { name: 'error', change: f => f.store.update(f.id, { error: 'execution_failed' }) },
    { name: 'cancel', change: f => f.store.requestCancel(f.id) },
    { name: 'profile', change: f => { f.binding.identity.profileHash = 'c'.repeat(64); } },
    { name: 'head', change: f => { f.binding.identity.head = 'c'.repeat(40); } },
    { name: 'timeout', change: f => { f.binding.processRequest.timeoutMs = 7_200_000; } },
    { name: 'request', change: f => { f.binding.processRequest.key = 'different-key'; } },
    { name: 'directory', change: f => { f.binding.processRequest.stateDirectory += '-other'; } },
    { name: 'beta', change: f => f.store.update(f.id, { data: { ...f.store.get(f.id).data, betaReceipt: {} } }) },
    { name: 'PR', change: f => f.store.update(f.id, { data: { ...f.store.get(f.id).data, pull: {} } }) },
    { name: 'review', change: f => f.store.update(f.id, { data: { ...f.store.get(f.id).data,
      reviewReceipt: { ...(f.store.get(f.id).data.reviewReceipt as object), clean: false } } }) },
    { name: 'verification', change: f => f.store.update(f.id, { data: { ...f.store.get(f.id).data,
      verification: { ...(f.store.get(f.id).data.verification as object), sourceHash: 'd'.repeat(64) } } }) },
    { name: 'partial', change: f => mkdirSync(join(f.processDirectory, digest(f.key)), { recursive: true, mode: 0o700 }) },
    { name: 'intent', change: f => {
      const op = join(f.processDirectory, digest(f.key)); mkdirSync(op, { recursive: true, mode: 0o700 });
      writeFileSync(join(op, 'intent.json'), JSON.stringify({ key: f.key, requestHash: digest(f.binding.processRequest) }), { mode: 0o600 });
    } },
    { name: 'held lease', change: f => { f.store.claim(f.id); } },
    { name: 'hold', change: f => f.store.update(f.id, { data: { ...f.store.get(f.id).data,
      integrationHold: { active: true, head: f.head, reason: 'synthetic_hold' } } }) },
    { name: 'budget', change: f => f.store.reserve(f.id, 'second-repair', 'repairs'), code: 'budget_exhausted' }
  ];
  for (const variant of variants) {
    const f = await rejectedFixture(t); variant.change(f); const before = f.snapshot();
    assert.throws(() => f.store.prepareRejectedBetaLaunch(f.id, () => f.binding), { code: variant.code ?? 'beta_prelaunch_retry_denied' }, variant.name);
    assert.deepEqual(f.snapshot(), before, variant.name); noQualification(f);
  }
});

test('prelaunch history, original operation and repair reservation roll back atomically on failure', async t => {
  const f = await rejectedFixture(t), before = f.snapshot();
  f.database.exec("CREATE TRIGGER reject_preparation BEFORE UPDATE ON operations WHEN NEW.state='prepared' BEGIN SELECT RAISE(FAIL,'synthetic transaction failure'); END");
  assert.throws(() => f.store.prepareRejectedBetaLaunch(f.id, () => f.binding), /synthetic transaction failure/);
  assert.deepEqual(f.snapshot(), before); noQualification(f);
});

test('real source attestation and ordinary CLI resume refuse unrecognized legacy source before changing the failed run', async t => {
  const f = await rejectedFixture(t), before = f.snapshot();
  assert.throws(() => inspectRejectedBetaLaunch(f.store, f.id), { code: 'beta_prelaunch_retry_denied' });
  assert.deepEqual(f.snapshot(), before);
  const resumed = spawnSync(process.execPath, [new URL('../src/cli.js', import.meta.url).pathname,
    'resume', f.id, '--repo', f.root, '--state-dir', f.state], { encoding: 'utf8', timeout: 10_000 });
  assert.equal(resumed.status, 2, resumed.stderr);
  assert.match(resumed.stderr, /beta_prelaunch_retry_denied/);
  assert.deepEqual(f.snapshot(), before); noQualification(f);
});

test('successful helper exit still rejects malformed, foreign or incomplete qualification', async t => {
  for (const behavior of [
    "console.log('unstructured output');",
    "console.log(JSON.stringify({ state: 'qualified', head: request.head, secret: 'synthetic-extra-field' }));",
    `console.log(JSON.stringify({ repository: request.repository, runId: request.runId, head: 'f'.repeat(40), version: request.candidateVersion,
environmentId: request.environmentId, sourceDirectory: request.receiptDirectory, sourceManifestDigest: request.sourceManifestDigest,
digests: Object.fromEntries(['SC-v' + request.candidateVersion + '.exe', 'SC-v' + request.candidateVersion + '.zip', 'SC-Setup-v' + request.candidateVersion + '.exe', 'README.txt'].map(name => [name, 'a'.repeat(64)])),
checks: Object.fromEntries(['verify','native','vault','ui','packaged'].map(name => [name,{exitCode:0,evidenceDigest:'b'.repeat(64)}])),
keyFree:true,protectedStateUnchanged:true,cleanup:true,state:'qualified' }));`
  ]) {
    const f = fixture(t, behavior);
    await assert.rejects(() => qualifyConfiguredBeta(f.request), { code: 'beta_capability_unavailable' });
    noQualification(f);
  }
});

test('forged journal success and unknown missing execution cannot substitute for observed process files', async t => {
  const f = fixture(t);
  await assert.rejects(() => qualifyConfiguredBeta(f.request), { code: 'beta_capability_unavailable' });
  const operation = f.store.ownedProcesses(f.manifest.id)[0]!, observed = f.store.observedEffect(f.manifest.id, operation.key)!;
  const database = new Database(join(f.state, 'journal.sqlite')); t.after(() => database.close());
  const forged = { ...(observed.receipt as object), status: 'exited', exitCode: 0, stdout: '{}', stderr: '', outputTruncated: false };
  database.prepare('UPDATE operations SET receipt=? WHERE run_id=? AND key=?').run(JSON.stringify(forged), f.manifest.id, operation.key);
  await assert.rejects(() => qualifyConfiguredBeta(f.request), { code: 'beta_capability_unavailable' }); noQualification(f);
  database.prepare("UPDATE operations SET state='unknown',receipt=NULL WHERE run_id=? AND key=?").run(f.manifest.id, operation.key);
  rmSync(join(operation.stateDirectory, sha(JSON.stringify(operation.key))), { recursive: true });
  await assert.rejects(() => qualifyConfiguredBeta(f.request), { code: 'effect_unknown' }); noQualification(f);
});
