import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import Database from 'better-sqlite3';
import { chmodSync, existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir, userInfo } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { inspectBetaEnvironmentRetry, inspectRejectedBetaLaunch, MAX_BETA_PROFILE_MS, qualifyConfiguredBeta, selectBetaProfile } from '../src/beta-profile.js';
import { executeRun } from '../src/graph.js';
import { digest, makeManifest, WorkflowError } from '../src/manifest.js';
import { inspectOwnedProcess } from '../src/process.js';
import { RunStore, type BetaPrelaunchBinding } from '../src/store.js';

const sha = (value: string | Buffer): string => createHash('sha256').update(value).digest('hex');
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
function launchIdentity(f: ReturnType<typeof fixture>, effective = false) {
  const env = { PATH: '/usr/bin:/bin', HOME: homedir(), USER: userInfo().username, LOGNAME: userInfo().username };
  return { repository: f.manifest.repository, runId: f.manifest.id, workspace: f.root, head: f.head, version,
    profileHash: f.selection.hash, sourceManifestDigest: sha(f.git('ls-tree', '-r', '--full-tree', f.head) + '\n'),
    ...(effective ? { processEnvironment: { version: 'effective-user-v1' as const, principal: userInfo().username, digest: digest(env) } } : {}) };
}

// This transaction fixture supplies the trusted binding seam; it does not attest legacy source/runtime bytes.
async function rejectedFixture(t: { after(fn: () => void): void }, behavior?: string) {
  const f = fixture(t, behavior, 7_500_000), id = f.manifest.id;
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

const fakeVBoxBehavior = `const owner=${JSON.stringify(userInfo().username)};
const rows=process.env.USER===owner&&process.env.LOGNAME===owner ? ['Synthetic VM'] :
  ['WARNING: Environment variable LOGNAME or USER does not correspond to the effective uid.','Synthetic VM'];
appendFileSync(join(request.receiptDirectory,'host-discovery.txt'),rows.join('\\n'),{mode:0o600});
process.exitCode=rows.length===1 ? 7 : 2;`;

async function betaGraphWait(f: ReturnType<typeof fixture>, store = f.store) {
  return executeRun(store, f.manifest.id, { handoff: async context => {
    try {
      await qualifyConfiguredBeta({ ...f.request, store, signal: context.signal });
      return { next: 'done' };
    } catch (error) {
      if (!(error instanceof WorkflowError) || error.code !== 'beta_capability_unavailable') throw error;
      return { next: 'handoff', status: 'awaiting_input', data: { waitingFor: error.code } };
    }
  } });
}

async function environmentFailureFixture(t: { after(fn: () => void): void }) {
  const f = await rejectedFixture(t, fakeVBoxBehavior);
  f.store.prepareRejectedBetaLaunch(f.id, () => f.binding);
  const waited = await betaGraphWait(f);
  assert.equal(waited.status, 'awaiting_input'); assert.equal(waited.stage, 'handoff');
  assert.equal(waited.error, null); assert.equal(waited.data.waitingFor, 'beta_capability_unavailable');
  const old = f.store.observedEffect(f.id, f.key)!;
  assert.equal((old.receipt as { exitCode: number }).exitCode, 2);
  const requestFile = join(f.processDirectory, digest(f.key), 'request.json');
  const failure = join(f.directory, 'helper-failure.json'), postflight = join(f.directory, 'postflight.json');
  writeFileSync(failure, JSON.stringify({ syntheticFixture: true, phase: 'host-discovery',
    output: readFileSync(join(f.receiptDirectory, 'host-discovery.txt'), 'utf8') }), { mode: 0o600 });
  writeFileSync(postflight, JSON.stringify({ syntheticFixture: true, protectedStateUnchanged: true, resourceClean: true }), { mode: 0o600 });
  const evidence = { version: 1, reason: 'vbox-user-environment-preflight', repository: f.manifest.repository,
    runId: f.id, manifestHash: digest(f.manifest), head: f.head, candidateVersion: version,
    profile: { name: f.selection.name, hash: f.selection.hash, helperHash: sha(readFileSync(f.helper)),
      nodeHash: sha(readFileSync(realpathSync('/usr/bin/node'))), tokenHash: sha(readFileSync(f.resourceTokenFile)) },
    oldProcess: { key: f.key, requestHash: old.requestHash, requestFileHash: sha(readFileSync(requestFile)),
      receiptDigest: digest(old.receipt), result: old.receipt },
    preflight: { phase: 'host-discovery', warning: 'vbox-effective-user-environment', rawOutputRows: 2, runningVmRows: 1,
      credentialLookupReached: false, guestAuthenticationReached: false, guestReadinessReached: false, guestScriptReached: false,
      guestStageCreated: false, applicationTestsStarted: false, qualificationStarted: false, claimStageSet: false },
    postflight: { protectedStateUnchanged: true, snapshotsUnchanged: true, resourceClean: true, vmState: 'poweroff',
      guestApplications: 0, guestTestJobs: 0, heldKeys: 0 },
    artifacts: [
      { kind: 'helper-failure', path: failure }, { kind: 'host-discovery', path: join(f.receiptDirectory, 'host-discovery.txt') },
      { kind: 'process', path: requestFile }, { kind: 'postflight', path: postflight }
    ].map(item => ({ ...item, sha256: sha(readFileSync(item.path)) })) };
  const evidencePath = join(f.directory, 'preflight-evidence.json');
  const saveEvidence = () => writeFileSync(evidencePath, JSON.stringify(evidence), { mode: 0o600 }); saveEvidence();
  const inspect = () => inspectBetaEnvironmentRetry(f.store, f.id, evidencePath);
  return { ...f, evidence, evidencePath, saveEvidence, inspect };
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
  assert.deepEqual(Object.keys(processRequest.env).sort(), ['HOME', 'LOGNAME', 'PATH', 'USER']);
  assert.equal(processRequest.env.USER, userInfo().username); assert.equal(processRequest.env.LOGNAME, userInfo().username);
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
  const identity = launchIdentity(f, true);
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
  const waited = await betaGraphWait(f, reopened);
  assert.equal(waited.error, null); assert.equal(waited.data.waitingFor, 'beta_capability_unavailable');
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

test('fresh beta helpers use only the trusted effective user instead of spoofed ambient identity', async t => {
  const prior = { USER: process.env.USER, LOGNAME: process.env.LOGNAME, SC_BETA_TEST_SENTINEL: process.env.SC_BETA_TEST_SENTINEL };
  try {
    process.env.USER = process.env.LOGNAME = 'synthetic-wrong-owner'; process.env.SC_BETA_TEST_SENTINEL = 'must-not-be-projected';
    const f = fixture(t, fakeVBoxBehavior);
    await assert.rejects(qualifyConfiguredBeta(f.request), { code: 'beta_capability_unavailable' });
    const operation = f.store.ownedProcesses(f.manifest.id)[0]!;
    const result = f.store.observedEffect(f.manifest.id, operation.key)?.receipt as { exitCode: number };
    assert.equal(result.exitCode, 7); // Host discovery passed; this synthetic helper deliberately never qualifies Windows.
    assert.equal(operation.key, `beta-process:${digest(launchIdentity(f, true))}`);
    const saved = JSON.parse(readFileSync(join(operation.stateDirectory, digest(operation.key), 'request.json'), 'utf8'));
    assert.deepEqual(saved.env, { PATH: '/usr/bin:/bin', HOME: homedir(), USER: userInfo().username, LOGNAME: userInfo().username });
    noQualification(f);
  } finally {
    for (const [name, value] of Object.entries(prior)) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
});

test('ordinary legacy replay cannot grant a new environment attempt and explicit fact evidence grants exactly one extra repair', async t => {
  const f = await environmentFailureFixture(t), originalOperation = f.operation(), before = f.snapshot();
  const invocations = join(f.receiptDirectory, 'invoked.jsonl');
  assert.deepEqual(f.store.repairAllowance(f.id), { original: 2, additional: 0, used: 2 });
  await assert.rejects(qualifyConfiguredBeta(f.request), { code: 'beta_capability_unavailable' });
  assert.equal(readFileSync(invocations, 'utf8').trim().split('\n').length, 1);
  assert.deepEqual(f.snapshot(), before);
  const binding = f.inspect(); assert.deepEqual(f.snapshot(), before); // Read-only evidence is not authorization.
  f.store.authorizeBetaEnvironmentRetry(f.id, f.inspect);
  const admitted = f.snapshot();
  assert.deepEqual(f.operation(), originalOperation); assert.deepEqual(admitted.run.manifest, before.run.manifest);
  assert.deepEqual(admitted.usage, { ...before.usage, repairs: 3 });
  assert.deepEqual(f.store.repairAllowance(f.id), { original: 2, additional: 1, used: 3 });
  const status = spawnSync(process.execPath, [new URL('../src/cli.js', import.meta.url).pathname,
    'status', f.id, '--repo', f.root, '--state-dir', f.state], { encoding: 'utf8', timeout: 10_000 });
  assert.equal(status.status, 0, status.stderr);
  assert.deepEqual(JSON.parse(status.stdout).repairAllowance, { original: 2, additional: 1, used: 3 });
  assert.throws(() => f.store.reserve(f.id, 'ordinary-third-repair', 'repairs'), { code: 'budget_exhausted' });
  const history = admitted.run.data.betaEnvironmentRetryHistory as { previous: { operation: unknown; usage: unknown } }[];
  assert.equal(history.length, 1); assert.deepEqual(history[0]!.previous.operation, originalOperation);
  assert.deepEqual(history[0]!.previous.usage, before.usage);
  f.store.authorizeBetaEnvironmentRetry(f.id, f.inspect); assert.deepEqual(f.snapshot(), admitted);
  const reopened = new RunStore(f.state, f.manifest); t.after(() => reopened.close());
  reopened.authorizeBetaEnvironmentRetry(f.id, () => inspectBetaEnvironmentRetry(reopened, f.id, f.evidencePath));
  assert.deepEqual(f.snapshot(), admitted);
  await reopened.reconcileOwnedExecutions(f.id);
  const waited = await betaGraphWait(f, reopened);
  assert.equal(waited.error, null); assert.equal(waited.data.waitingFor, 'beta_capability_unavailable');
  assert.equal((reopened.observedEffect(f.id, binding.next.processRequest.key)?.receipt as { exitCode: number }).exitCode, 7);
  await assert.rejects(qualifyConfiguredBeta({ ...f.request, store: reopened }), { code: 'beta_capability_unavailable' });
  assert.equal(readFileSync(join(binding.next.processRequest.cwd, 'invoked.jsonl'), 'utf8').trim().split('\n').length, 1);
  assert.deepEqual(f.operation(), originalOperation);
  assert.throws(() => reopened.authorizeBetaEnvironmentRetry(f.id,
    () => inspectBetaEnvironmentRetry(reopened, f.id, f.evidencePath)), { code: 'beta_environment_retry_exhausted' });
  assert.throws(() => reopened.update(f.id, { data: { unrelated: true } }), { code: 'invalid_state' });
  assert.deepEqual(reopened.get(f.id).data.betaEnvironmentRetryHistory, history); noQualification(f);
});

test('environment retry refuses changed, incomplete, started or unowned preflight evidence without spending or replacing failure', async t => {
  const variants: { name: string; change(f: Awaited<ReturnType<typeof environmentFailureFixture>>): void }[] = [
    { name: 'stage', change: f => f.store.update(f.id, { stage: 'review' }) },
    { name: 'status', change: f => f.store.update(f.id, { status: 'failed' }) },
    { name: 'error instead of graph wait', change: f => f.store.update(f.id, { error: 'beta_capability_unavailable' }) },
    { name: 'wrong graph wait', change: f => f.store.update(f.id, { data: { ...f.store.get(f.id).data, waitingFor: 'other_capability' } }) },
    { name: 'cancel', change: f => f.store.requestCancel(f.id) },
    { name: 'held lease', change: f => f.store.claim(f.id) },
    { name: 'hold', change: f => f.store.update(f.id, { data: { ...f.store.get(f.id).data,
      integrationHold: { active: true, head: f.head, reason: 'synthetic_hold' } } }) },
    { name: 'manifest', change: f => { f.evidence.manifestHash = 'c'.repeat(64); f.saveEvidence(); } },
    { name: 'token', change: f => { f.evidence.profile.tokenHash = 'c'.repeat(64); f.saveEvidence(); } },
    { name: 'receipt', change: f => { f.evidence.oldProcess.receiptDigest = 'c'.repeat(64); f.saveEvidence(); } },
    { name: 'request', change: f => { f.evidence.oldProcess.requestFileHash = 'c'.repeat(64); f.saveEvidence(); } },
    { name: 'guest started', change: f => { f.evidence.preflight.guestScriptReached = true; f.saveEvidence(); } },
    { name: 'acceptance started', change: f => { f.evidence.preflight.applicationTestsStarted = true; f.saveEvidence(); } },
    { name: 'cleanup missing', change: f => { f.evidence.postflight.resourceClean = false; f.saveEvidence(); } },
    { name: 'artifact changed', change: f => { f.evidence.artifacts[0]!.sha256 = 'c'.repeat(64); f.saveEvidence(); } },
    { name: 'unsafe evidence', change: f => chmodSync(f.evidencePath, 0o644) },
    { name: 'authorization in facts', change: f => { Object.assign(f.evidence, { authorization: true }); f.saveEvidence(); } },
    { name: 'old partial receipt', change: f => rmSync(join(f.processDirectory, digest(f.key), 'exit.json')) },
    { name: 'new partial launch', change: f => {
      const binding = f.inspect(); mkdirSync(join(f.processDirectory, digest(binding.next.processRequest.key)), { recursive: true, mode: 0o700 });
    } }
  ];
  for (const variant of variants) {
    const f = await environmentFailureFixture(t); variant.change(f); const before = f.snapshot();
    assert.throws(() => f.store.authorizeBetaEnvironmentRetry(f.id, f.inspect), { code: 'beta_environment_retry_denied' }, variant.name);
    assert.deepEqual(f.snapshot(), before, variant.name); assert.deepEqual(f.store.repairAllowance(f.id), { original: 2, additional: 0, used: 2 }); noQualification(f);
  }
});

test('extra environment authorization rolls back atomically and CLI requires both explicit options', async t => {
  const f = await environmentFailureFixture(t), before = f.snapshot();
  f.database.exec("CREATE TRIGGER reject_extra BEFORE INSERT ON reservations WHEN NEW.key LIKE '%beta-environment-once' BEGIN SELECT RAISE(FAIL,'synthetic extra-repair failure'); END");
  assert.throws(() => f.store.authorizeBetaEnvironmentRetry(f.id, f.inspect), /synthetic extra-repair failure/);
  assert.deepEqual(f.snapshot(), before);
  for (const flags of [['--retry-beta-environment'], ['--preflight-evidence', f.evidencePath],
    ['--retry-beta-environment', '--preflight-evidence', f.evidencePath, '--retry-oracle']]) {
    const result = spawnSync(process.execPath, [new URL('../src/cli.js', import.meta.url).pathname,
      'resume', f.id, '--repo', f.root, '--state-dir', f.state, ...flags], { encoding: 'utf8', timeout: 10_000 });
    assert.equal(result.status, 4, result.stderr); assert.match(result.stderr, /invalid_arguments/);
    assert.deepEqual(f.snapshot(), before);
  }
  const legacy = await rejectedFixture(t), untouched = legacy.snapshot();
  const wrongPhase = spawnSync(process.execPath, [new URL('../src/cli.js', import.meta.url).pathname,
    'resume', legacy.id, '--repo', legacy.root, '--state-dir', legacy.state,
    '--retry-beta-environment', '--preflight-evidence', f.evidencePath], { encoding: 'utf8', timeout: 10_000 });
  assert.equal(wrongPhase.status, 2, wrongPhase.stderr); assert.match(wrongPhase.stderr, /beta_environment_retry_denied/);
  assert.deepEqual(legacy.snapshot(), untouched); // The environment flag cannot consume the older prelaunch repair.
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
