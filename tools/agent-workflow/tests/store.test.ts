import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { SqliteSaver } from '@langchain/langgraph-checkpoint-sqlite';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { digest, makeManifest } from '../src/manifest.js';
import { inspectOwnedProcess, runOwnedProcess } from '../src/process.js';
import { cancelRun } from '../src/recovery.js';
import { RunStore } from '../src/store.js';

function fixture(t: { after(fn: () => void): void }) {
  const temp = mkdtempSync(join(tmpdir(), 'sc-workflow-state-'));
  const root = join(temp, 'repo'); mkdirSync(root);
  const manifest = makeManifest({ repository: 'github.com/example/sc', root,
    commonDir: join(root, '.git'), base: 'a'.repeat(40), scope: 'providers-json',
    limits: { workerInvocations: 2 } });
  const directory = join(temp, 'state');
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  return { manifest, directory, root, temp };
}

test('admission and budgets persist across handles without resetting allowances', t => {
  const { manifest, directory } = fixture(t);
  let store = new RunStore(directory, manifest);
  store.admit(manifest);
  store.reserve(manifest.id, 'worker-1', 'workerInvocations');
  store.reserve(manifest.id, 'worker-1', 'workerInvocations');
  store.close();
  store = new RunStore(directory, manifest); t.after(() => store.close());
  assert.equal(store.get(manifest.id).manifest.id, manifest.id);
  assert.equal(store.usage(manifest.id).workerInvocations, 1);
  store.reserve(manifest.id, 'worker-2', 'workerInvocations');
  assert.throws(() => store.reserve(manifest.id, 'worker-3', 'workerInvocations'), { code: 'budget_exhausted' });
  assert.equal(store.usage(manifest.id).workerInvocations, 2);
  assert.equal(statSync(join(directory, 'journal.sqlite')).mode & 0o777, 0o600);
});

test('an effect precondition can reject safely before the unknown side-effect boundary', async t => {
  const { manifest, directory } = fixture(t);
  const store = new RunStore(directory, manifest); t.after(() => store.close()); store.admit(manifest);
  let allowed = false, executions = 0, reconciliations = 0;
  const actions = { beforeExecute: async () => {
    if (!allowed) throw new Error('policy changed');
  }, execute: async () => { executions++; return 'receipt'; },
  reconcile: async () => { reconciliations++; return null; } };
  await assert.rejects(store.effect(manifest.id, 'precondition', 'test', { id: 1 }, actions));
  assert.equal(store.observedEffect(manifest.id, 'precondition'), null);
  allowed = true;
  assert.equal(await store.effect(manifest.id, 'precondition', 'test', { id: 1 }, actions), 'receipt');
  assert.equal(executions, 1); assert.equal(reconciliations, 0);
});

test('a repository lease excludes another run and releases only its owner', t => {
  const { manifest, directory } = fixture(t);
  const store = new RunStore(directory, manifest); t.after(() => store.close());
  store.admit(manifest); store.claim(manifest.id);
  const second = makeManifest({ repository: manifest.repository, root: manifest.root,
    commonDir: manifest.commonDir, base: manifest.base, scope: 'providers-json' });
  store.admit(second);
  assert.throws(() => store.claim(second.id), { code: 'repository_owned' });
  store.release(second.id);
  assert.throws(() => store.claim(second.id), { code: 'repository_owned' });
  store.release(manifest.id); store.claim(second.id); store.release(second.id);
});

test('maintenance excludes claims across both snapshots and a dead owner can be reclaimed', async t => {
  const { manifest, directory, temp } = fixture(t);
  const store = new RunStore(directory, manifest); t.after(() => store.close()); store.admit(manifest);
  const second = new RunStore(directory, manifest); t.after(() => second.close());
  const foreign = makeManifest({ repository: 'github.com/elsewhere/sc', root: manifest.root,
    commonDir: manifest.commonDir, base: manifest.base, scope: 'providers-json' });
  const foreignStore = new RunStore(directory, foreign); t.after(() => foreignStore.close());
  foreignStore.admit(foreign);
  let begin!: () => void;
  let continueCopy!: () => void;
  const copying = new Promise<void>(resolve => { begin = resolve; });
  const held = new Promise<void>(resolve => { continueCopy = resolve; });
  const internal = store as unknown as { db: Database.Database };
  const original = internal.db.backup.bind(internal.db);
  internal.db.backup = async (...args: Parameters<Database.Database['backup']>) => {
    begin(); await held; return original(...args);
  };
  const snapshot = store.backup(join(temp, 'snapshot'));
  await copying;
  assert.throws(() => store.claim(manifest.id), { code: 'repository_owned' });
  assert.throws(() => second.claim(manifest.id), { code: 'repository_owned' });
  assert.throws(() => foreignStore.claim(foreign.id), { code: 'repository_owned' });
  continueCopy(); await snapshot;
  store.claim(manifest.id); store.release(manifest.id);
  const database = new Database(join(directory, 'journal.sqlite'));
  database.prepare('INSERT INTO maintenance(repository,pid,identity,token) VALUES (?,?,?,?)')
    .run('*', 2147483647, 'dead:1', 'stale');
  database.close();
  store.claim(manifest.id); store.release(manifest.id);
  await store.backup(join(temp, 'reclaimed-snapshot'));
});

test('candidate reservation cannot appear after a maintenance snapshot begins', async t => {
  const { manifest, directory, temp } = fixture(t);
  const store = new RunStore(directory, manifest); t.after(() => store.close()); store.admit(manifest);
  let entered!: () => void, release!: () => void;
  const copying = new Promise<void>(resolve => { entered = resolve; });
  const held = new Promise<void>(resolve => { release = resolve; });
  t.after(() => release());
  const internal = store as unknown as { db: Database.Database };
  const original = internal.db.backup.bind(internal.db);
  internal.db.backup = async (...args: Parameters<Database.Database['backup']>) => {
    entered(); await held; return original(...args);
  };
  const backup = store.backup(join(temp, 'version-snapshot'));
  await copying;
  assert.throws(() => store.reserveCandidateVersion(manifest.id, '0.5.0-beta.7', ['0.5.0-beta.8']),
    { code: 'repository_owned' });
  release(); await backup;
  assert.equal(store.reserveCandidateVersion(manifest.id, '0.5.0-beta.7', ['0.5.0-beta.8']).version,
    '0.5.0-beta.9');
  const snapshot = new Database(join(temp, 'version-snapshot', 'journal.sqlite'), { readonly: true });
  assert.equal((snapshot.prepare("SELECT name FROM sqlite_master WHERE name='candidate_versions'").get()), undefined);
  snapshot.close();
});

test('repository integration hold is visible across runs and blocks pruning', async t => {
  const { manifest, directory } = fixture(t);
  const store = new RunStore(directory, manifest); t.after(() => store.close()); store.admit(manifest);
  const second = makeManifest({ repository: manifest.repository, root: manifest.root, commonDir: manifest.commonDir,
    base: manifest.base, scope: 'docs-links' });
  store.admit(second);
  const hold = { active: true, head: 'b'.repeat(40), reason: 'postflight_failed' };
  store.update(manifest.id, { status: 'completed', stage: 'done', data: { integrationHold: hold } });
  const reader = new RunStore(directory, second, { readOnly: true }); t.after(() => reader.close());
  assert.deepEqual(reader.repositoryIntegrationHold(), { runId: manifest.id, head: hold.head, reason: hold.reason });
  assert.equal(await store.prune(Date.now() + 1000), 0);
  store.update(manifest.id, { data: { integrationHold: { ...hold, head: 'bad' } } });
  assert.throws(() => reader.repositoryIntegrationHold(), { code: 'invalid_state' });
  await assert.rejects(store.prune(Date.now() + 1000), { code: 'invalid_state' });
  store.update(manifest.id, { data: { integrationHold: { active: false } } });
  assert.equal(reader.repositoryIntegrationHold(), null);
});

test('only the process holding the exact coordinator lease owns integration', t => {
  const { manifest, directory } = fixture(t);
  const store = new RunStore(directory, manifest); t.after(() => store.close());
  store.admit(manifest); store.claim(manifest.id);
  assert.equal(store.ownsCoordinator(manifest.id), true);
  const module = new URL('../src/store.js', import.meta.url).href;
  const script = `import { RunStore } from ${JSON.stringify(module)};
    const store = new RunStore(process.argv[1], JSON.parse(process.argv[2]), { readOnly: true });
    process.stdout.write(String(store.ownsCoordinator(process.argv[3]))); store.close();`;
  const foreign = execFileSync(process.execPath, ['--input-type=module', '-e', script, directory,
    JSON.stringify(manifest), manifest.id], { encoding: 'utf8' });
  assert.equal(foreign, 'false');
  store.release(manifest.id);
  assert.equal(store.ownsCoordinator(manifest.id), false);
});

test('unresolved merge and merged source awaiting postflight block another repository claim', async t => {
  const { manifest, directory } = fixture(t);
  const store = new RunStore(directory, manifest); t.after(() => store.close()); store.admit(manifest);
  const second = makeManifest({ repository: manifest.repository, root: manifest.root, commonDir: manifest.commonDir,
    base: manifest.base, scope: 'docs-links' }); store.admit(second);
  await assert.rejects(store.effect(manifest.id, `merge:29:${'b'.repeat(40)}:${manifest.base}`, 'github_merge',
    { head: 'b'.repeat(40) }, { execute: async () => { throw new Error('lost'); }, reconcile: async () => null }));
  assert.equal(store.repositoryIntegrationHold()?.reason, 'merge_outcome_unknown');
  assert.throws(() => store.claim(second.id), { code: 'repository_owned' });
  const internal = store as unknown as { db: Database.Database };
  internal.db.prepare("UPDATE operations SET state='observed',receipt=? WHERE kind='github_merge'")
    .run(JSON.stringify({ mergeHead: 'c'.repeat(40), head: 'b'.repeat(40) }));
  assert.equal(store.repositoryIntegrationHold()?.reason, 'postflight_pending');
  assert.throws(() => store.claim(second.id), { code: 'repository_owned' });
  store.update(manifest.id, { status: 'completed', stage: 'done' });
  assert.equal(await store.prune(Date.now() + 1000), 0);
  store.update(manifest.id, { data: { postflight: { state: 'ready', head: 'c'.repeat(40) } } });
  assert.equal(store.repositoryIntegrationHold(), null);
  store.claim(second.id); store.release(second.id);
});

test('owned process receipts can be journaled at the raw output cap after JSON escaping', async t => {
  const { manifest, directory } = fixture(t);
  const store = new RunStore(directory, manifest); t.after(() => store.close()); store.admit(manifest);
  const receipt = { status: 'exited', exitCode: 0, signal: null, stdout: '\u0000'.repeat(400_000),
    stderr: '', outputTruncated: false, elapsedMs: 1 };
  assert.ok(Buffer.byteLength(JSON.stringify(receipt)) > 2_000_000);
  await store.effect(manifest.id, 'verification:escaped-output', 'verification', { source: manifest.base },
    { execute: async () => receipt, reconcile: async () => null });
  assert.equal((store.observedEffect(manifest.id, 'verification:escaped-output')?.receipt as typeof receipt).stdout.length, 400_000);
});

test('backup keeps journal and checkpoint state paired while retention and journal writes contend', async t => {
  const { manifest, directory, temp } = fixture(t);
  const store = new RunStore(directory, manifest); t.after(() => store.close()); store.admit(manifest);
  const { executeRun } = await import('../src/graph.js');
  assert.equal((await executeRun(store, manifest.id, {
    preflight: async () => ({ next: 'done', status: 'completed' })
  })).status, 'completed');
  const before = new Database(join(directory, 'checkpoints.sqlite'), { readonly: true });
  const checkpointCount = (before.prepare('SELECT COUNT(*) AS count FROM checkpoints WHERE thread_id=?')
    .get(manifest.id) as { count: number }).count;
  before.close(); assert.ok(checkpointCount > 0);
  let copied!: () => void;
  let continueBackup!: () => void;
  const journalCopied = new Promise<void>(resolve => { copied = resolve; });
  const hold = new Promise<void>(resolve => { continueBackup = resolve; });
  t.after(() => continueBackup());
  const internal = store as unknown as { db: Database.Database };
  const original = internal.db.backup.bind(internal.db);
  internal.db.backup = async (...args: Parameters<Database.Database['backup']>) => {
    const value = await original(...args); copied(); await hold; return value;
  };
  const snapshotPath = join(temp, 'paired-snapshot');
  const snapshot = store.backup(snapshotPath);
  await journalCopied;
  try {
    const other = makeManifest({ repository: manifest.repository, root: manifest.root,
      commonDir: manifest.commonDir, base: manifest.base, scope: 'providers-json' });
    assert.throws(() => store.admit(other), { code: 'repository_owned' });
    assert.throws(() => store.reserve(manifest.id, 'late-budget', 'findings'), { code: 'repository_owned' });
    assert.throws(() => store.update(manifest.id, { stage: 'late' }), { code: 'repository_owned' });
    assert.throws(() => store.requestCancel(manifest.id), { code: 'repository_owned' });
    await assert.rejects(store.effect(manifest.id, 'late-effect', 'issue', {}, {
      execute: async () => ({ number: 1 }), reconcile: async () => null
    }), { code: 'repository_owned' });
    await assert.rejects(store.prune(Date.now() + 1000), { code: 'repository_owned' });
  } finally { continueBackup(); await snapshot; }
  const snap = new Database(join(snapshotPath, 'checkpoints.sqlite'), { readonly: true });
  assert.equal((snap.prepare('SELECT COUNT(*) AS count FROM checkpoints WHERE thread_id=?')
    .get(manifest.id) as { count: number }).count, checkpointCount);
  snap.close();
  assert.equal(await store.prune(Date.now() + 1000), 1);
});

test('retention holds maintenance until checkpoint cleanup is complete', async t => {
  const { manifest, directory, temp } = fixture(t);
  const store = new RunStore(directory, manifest); t.after(() => store.close()); store.admit(manifest);
  const { executeRun } = await import('../src/graph.js');
  assert.equal((await executeRun(store, manifest.id, {
    preflight: async () => ({ next: 'done', status: 'completed' })
  })).status, 'completed');
  let deleting!: () => void;
  let continueDelete!: () => void;
  const entered = new Promise<void>(resolve => { deleting = resolve; });
  const held = new Promise<void>(resolve => { continueDelete = resolve; });
  t.after(() => continueDelete());
  const original = SqliteSaver.prototype.deleteThread;
  SqliteSaver.prototype.deleteThread = async function (...args) {
    deleting(); await held; return original.apply(this, args);
  };
  t.after(() => { SqliteSaver.prototype.deleteThread = original; });
  const prune = store.prune(Date.now() + 1000);
  await entered;
  try {
    await assert.rejects(store.backup(join(temp, 'racing-backup')), { code: 'repository_owned' });
  } finally { continueDelete(); assert.equal(await prune, 1); }
});

test('a live owned child under a dead coordinator keeps maintenance out so cancel can stop it', async t => {
  const { manifest, directory, temp } = fixture(t);
  const store = new RunStore(directory, manifest); t.after(() => store.close()); store.admit(manifest);
  const key = 'worker:abandoned';
  const stateDirectory = join(directory, 'runs', manifest.id, 'processes');
  store.registerOwnedProcess(manifest.id, key, stateDirectory);
  const db = new Database(join(directory, 'journal.sqlite'));
  db.prepare('INSERT INTO leases(repository,run_id,pid,identity) VALUES (?,?,?,?)')
    .run(manifest.repository, manifest.id, 2147483647, 'dead:1');
  db.close();
  const child = store.effect(manifest.id, key, 'worker', { role: 'synthetic' }, {
    execute: async () => runOwnedProcess({ stateDirectory, key, command: process.execPath,
      args: ['-e', 'setInterval(()=>{},1000)'], cwd: manifest.root, env: {}, timeoutMs: 10_000 }),
    reconcile: async () => null
  });
  const deadline = Date.now() + 5_000;
  while (inspectOwnedProcess(stateDirectory, key).state !== 'running') {
    if (Date.now() > deadline) throw new Error('Harmless child did not start');
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  try {
    await assert.rejects(store.backup(join(temp, 'during-child')), { code: 'repository_owned' });
    await assert.rejects(store.prune(Date.now() + 1000), { code: 'repository_owned' });
  } finally {
    assert.equal((await cancelRun(store, manifest.id)).status, 'cancelled');
    assert.equal((await child).status, 'cancelled');
  }
  await store.backup(join(temp, 'after-child'));
  assert.equal(JSON.parse(readFileSync(join(temp, 'after-child', 'snapshot.json'), 'utf8')).status, 'complete');
});

test('a prepared pre-dispatch execution does not block a snapshot', async t => {
  const { manifest, directory, temp } = fixture(t);
  const store = new RunStore(directory, manifest); t.after(() => store.close()); store.admit(manifest);
  const db = new Database(join(directory, 'journal.sqlite'));
  db.prepare("INSERT INTO operations(run_id,key,kind,request_hash,state) VALUES (?,?,?,?,'prepared')")
    .run(manifest.id, 'worker:prepared', 'worker', digest({ role: 'synthetic' }));
  db.close();
  const backup = join(temp, 'prepared-snapshot');
  await store.backup(backup);
  assert.equal(JSON.parse(readFileSync(join(backup, 'snapshot.json'), 'utf8')).status, 'complete');
});

test('an in-flight effect cannot change the journal after backup has copied it', async t => {
  const { manifest, directory, temp } = fixture(t);
  const store = new RunStore(directory, manifest); t.after(() => store.close()); store.admit(manifest);
  let executing!: () => void;
  let finishEffect!: () => void;
  const enteredEffect = new Promise<void>(resolve => { executing = resolve; });
  const effectHeld = new Promise<void>(resolve => { finishEffect = resolve; });
  let calls = 0;
  const effect = store.effect(manifest.id, 'issue:pending', 'issue', {}, {
    execute: async () => { calls++; executing(); await effectHeld; return { number: 7 }; },
    reconcile: async () => null
  });
  await enteredEffect;
  let copied!: () => void;
  let finishBackup!: () => void;
  const journalCopied = new Promise<void>(resolve => { copied = resolve; });
  const backupHeld = new Promise<void>(resolve => { finishBackup = resolve; });
  const internal = store as unknown as { db: Database.Database };
  const original = internal.db.backup.bind(internal.db);
  internal.db.backup = async (...args: Parameters<Database.Database['backup']>) => {
    const value = await original(...args); copied(); await backupHeld; return value;
  };
  const snapshot = store.backup(join(temp, 'unknown-effect-snapshot'));
  await journalCopied;
  finishEffect();
  try { await assert.rejects(effect, { code: 'repository_owned' }); }
  finally { finishBackup(); await snapshot; }
  const receipt = await store.effect(manifest.id, 'issue:pending', 'issue', {}, {
    execute: async () => { calls++; return { number: 8 }; },
    reconcile: async () => ({ number: 7 })
  });
  assert.deepEqual(receipt, { number: 7 });
  assert.equal(calls, 1);
});

test('a cancel request and process registration serialize without losing either', t => {
  const { manifest, directory } = fixture(t);
  const store = new RunStore(directory, manifest); t.after(() => store.close()); store.admit(manifest);
  const path = join(directory, 'runs', manifest.id, 'processes');
  store.registerOwnedProcess(manifest.id, 'worker:first', path);
  store.requestCancel(manifest.id);
  assert.throws(() => store.registerOwnedProcess(manifest.id, 'worker:second', path), { code: 'cancelled' });
  assert.equal(store.get(manifest.id).cancelRequested, true);
  assert.deepEqual(store.get(manifest.id).data.ownedProcesses, [{ key: 'worker:first', stateDirectory: path }]);
});

test('unknown acknowledged-lost effects are reconciled without duplicate publication', async t => {
  const { manifest, directory } = fixture(t);
  let store = new RunStore(directory, manifest); store.admit(manifest);
  let creations = 0;
  let remote: { number: number } | null = null;
  await assert.rejects(store.effect(manifest.id, 'issue:fingerprint', 'issue', { title: 'Synthetic' }, {
    execute: async () => { creations++; remote = { number: 7 }; throw new Error('Acknowledgement lost'); },
    reconcile: async () => remote
  }));
  store.close(); store = new RunStore(directory, manifest); t.after(() => store.close());
  const receipt = await store.effect(manifest.id, 'issue:fingerprint', 'issue', { title: 'Synthetic' }, {
    execute: async () => { creations++; return { number: 8 }; }, reconcile: async () => remote
  });
  assert.deepEqual(receipt, { number: 7 }); assert.equal(creations, 1);
  await assert.rejects(store.effect(manifest.id, 'issue:fingerprint', 'issue', { title: 'Changed' }, {
    execute: async () => ({ number: 9 }), reconcile: async () => null
  }), { code: 'effect_conflict' });
});

test('an unknown effect with no remote proof stops instead of repeating a create', async t => {
  const { manifest, directory } = fixture(t);
  const store = new RunStore(directory, manifest); t.after(() => store.close()); store.admit(manifest);
  let calls = 0;
  const actions = { execute: async () => { calls++; throw new Error('Unknown'); }, reconcile: async () => null };
  await assert.rejects(store.effect(manifest.id, 'once', 'issue', {}, actions));
  await assert.rejects(store.effect(manifest.id, 'once', 'issue', {}, actions), { code: 'effect_unknown' });
  assert.equal(calls, 1);
  assert.equal(store.observedEffect(manifest.id, 'once'), null);
  await store.effect(manifest.id, 'known-proof', 'verification', { source: manifest.base }, {
    execute: async () => ({ status: 'exited', exitCode: 0 }), reconcile: async () => null
  });
  assert.deepEqual(store.observedEffect(manifest.id, 'known-proof'), { kind: 'verification',
    requestHash: (await import('../src/manifest.js')).digest({ source: manifest.base }), receipt: { status: 'exited', exitCode: 0 } });
});

test('state refuses source directories and preserves corrupt databases', t => {
  const { manifest, directory, root } = fixture(t);
  assert.throws(() => new RunStore(join(root, 'state'), manifest), { code: 'unsafe_state_path' });
  mkdirSync(directory, { mode: 0o700 });
  const path = join(directory, 'journal.sqlite'); writeFileSync(path, 'not a database', { mode: 0o600 });
  const original = readFileSync(path);
  assert.throws(() => new RunStore(directory, manifest), { code: 'invalid_state' });
  assert.deepEqual(readFileSync(path), original);
});

test('cancellation and pruning preserve unfinished work and unknown operations', async t => {
  const { manifest, directory } = fixture(t);
  const store = new RunStore(directory, manifest); t.after(() => store.close()); store.admit(manifest);
  store.requestCancel(manifest.id);
  assert.equal(store.get(manifest.id).cancelRequested, true);
  await assert.rejects(store.effect(manifest.id, 'unknown', 'issue', {}, {
    execute: async () => { throw new Error('Interrupted'); }, reconcile: async () => null
  }));
  store.update(manifest.id, { status: 'completed', stage: 'done' });
  assert.equal(await store.prune(Date.now() + 1000), 0);
  assert.equal(store.get(manifest.id).manifest.id, manifest.id);
});

test('read-only inspection cannot mutate saved run state', t => {
  const { manifest, directory } = fixture(t);
  const writer = new RunStore(directory, manifest); writer.admit(manifest);
  const reader = new RunStore(directory, manifest, { readOnly: true });
  t.after(() => { reader.close(); writer.close(); });
  assert.equal(reader.get(manifest.id).cancelRequested, false);
  assert.throws(() => reader.requestCancel(manifest.id));
  assert.equal(writer.get(manifest.id).cancelRequested, false);
});

test('observed execution refunds unused time while an interrupted reservation stays charged', t => {
  const { manifest, directory } = fixture(t);
  let store = new RunStore(directory, manifest); store.admit(manifest);
  store.reserve(manifest.id, 'time:observed', 'activeMs', 1000);
  store.settleTime(manifest.id, 'time:observed', 12);
  store.settleTime(manifest.id, 'time:observed', 12);
  assert.equal(store.usage(manifest.id).activeMs, 12);
  assert.throws(() => store.settleTime(manifest.id, 'time:observed', 0), { code: 'timing_conflict' });
  store.reserve(manifest.id, 'time:interrupted', 'activeMs', 2000);
  store.close(); store = new RunStore(directory, manifest); t.after(() => store.close());
  assert.equal(store.usage(manifest.id).activeMs, 2012);
  assert.throws(() => store.reserve(manifest.id, 'over-limit', 'activeMs', 7_200_000), { code: 'budget_exhausted' });
});

test('incompatible database versions are preserved and backups retain complete admission', async t => {
  const { manifest, directory, temp } = fixture(t);
  const store = new RunStore(directory, manifest); store.admit(manifest);
  store.reserve(manifest.id, 'worker:spent', 'workerInvocations');
  const backup = join(temp, 'backup');
  await store.backup(backup);
  const restored = new RunStore(backup, manifest, { readOnly: true });
  assert.equal(restored.get(manifest.id).manifest.id, manifest.id);
  assert.equal(restored.usage(manifest.id).workerInvocations, 1);
  restored.close(); store.close();
  const path = join(directory, 'journal.sqlite');
  const database = new Database(path); database.pragma('user_version=99'); database.close();
  const original = readFileSync(path);
  assert.throws(() => new RunStore(directory, manifest), { code: 'incompatible_state' });
  assert.deepEqual(readFileSync(path), original);
});

test('v1 journal remains readable but is not silently migrated on write-open', t => {
  const { manifest, directory } = fixture(t);
  const store = new RunStore(directory, manifest); store.admit(manifest); store.close();
  const path = join(directory, 'journal.sqlite');
  const db = new Database(path); db.pragma('user_version=1'); db.close();
  const original = readFileSync(path);
  const reader = new RunStore(directory, manifest, { readOnly: true });
  assert.equal(reader.get(manifest.id).status, 'ready'); reader.close();
  assert.throws(() => new RunStore(directory, manifest), { code: 'incompatible_state' });
  assert.deepEqual(readFileSync(path), original);
});

test('a dead coordinator does not release authority while its worker launch is unresolved', t => {
  const { manifest, directory } = fixture(t);
  const storeUrl = pathToFileURL(join(process.cwd(), 'dist/src/store.js')).href;
  const manifestUrl = pathToFileURL(join(process.cwd(), 'dist/src/manifest.js')).href;
  const program = `const {RunStore}=await import(process.argv[1]);
    const {readManifest}=await import(process.argv[2]);const m=readManifest(process.argv[4]);
    const s=new RunStore(process.argv[3],m);s.admit(m);s.claim(m.id);
    try{await s.effect(m.id,'worker:unknown','worker',{}, {execute:async()=>{throw new Error('lost launch')},reconcile:async()=>null})}catch{}
    s.close();`;
  execFileSync(process.execPath, ['--input-type=module', '-e', program, storeUrl, manifestUrl, directory, JSON.stringify(manifest)],
    { encoding: 'utf8', timeout: 10_000, stdio: 'pipe' });
  const store = new RunStore(directory, manifest); t.after(() => store.close());
  const other = makeManifest({ repository: manifest.repository, root: manifest.root,
    commonDir: manifest.commonDir, base: manifest.base, scope: 'providers-json' });
  store.admit(other);
  assert.throws(() => store.claim(other.id), { code: 'repository_owned' });
});

test('all cumulative counters keep exact reservations across exhausted resumes', t => {
  const { manifest, directory } = fixture(t);
  let store = new RunStore(directory, manifest); store.admit(manifest);
  const counters = ['findings', 'issues', 'writingTasks', 'workerInvocations', 'repairs', 'activeMs'] as const;
  for (const counter of counters) store.reserve(manifest.id, `exact:${counter}`, counter, manifest.limits[counter]);
  store.close(); store = new RunStore(directory, manifest); t.after(() => store.close());
  for (const counter of counters) {
    store.reserve(manifest.id, `exact:${counter}`, counter, manifest.limits[counter]);
    assert.equal(store.usage(manifest.id)[counter], manifest.limits[counter]);
    assert.throws(() => store.reserve(manifest.id, `extra:${counter}`, counter), { code: 'budget_exhausted' });
  }
});

test('observed effects survive a lost stage checkpoint and prepared intents are safe to execute', async t => {
  const { manifest, directory } = fixture(t);
  let store = new RunStore(directory, manifest); store.admit(manifest);
  let calls = 0;
  const actions = { execute: async () => ({ id: ++calls }), reconcile: async () => null };
  assert.deepEqual(await store.effect(manifest.id, 'effect', 'synthetic', {}, actions), { id: 1 });
  store.close();
  const database = new Database(join(directory, 'journal.sqlite'));
  database.prepare("INSERT INTO operations VALUES (?,?,?,?,'prepared',NULL)")
    .run(manifest.id, 'prepared', 'synthetic', (await import('../src/manifest.js')).digest({}));
  database.close();
  store = new RunStore(directory, manifest); t.after(() => store.close());
  assert.deepEqual(await store.effect(manifest.id, 'effect', 'synthetic', {}, actions), { id: 1 });
  assert.deepEqual(await store.effect(manifest.id, 'prepared', 'synthetic', {}, actions), { id: 2 });
  assert.equal(calls, 2);
});

test('retention removes only settled repository runs and their checkpoint/private output', async t => {
  const { manifest, directory } = fixture(t);
  const store = new RunStore(directory, manifest); t.after(() => store.close()); store.admit(manifest);
  const { executeRun } = await import('../src/graph.js');
  assert.equal((await executeRun(store, manifest.id, {
    preflight: async () => ({ next: 'done', status: 'completed' })
  })).status, 'completed');
  const privateRun = join(directory, 'runs', manifest.id); mkdirSync(privateRun, { recursive: true, mode: 0o700 });
  writeFileSync(join(privateRun, 'output'), 'bounded private output', { mode: 0o600 });
  const other = makeManifest({ repository: 'github.com/another/sc', root: manifest.root,
    commonDir: manifest.commonDir, base: manifest.base, scope: 'docs-links' });
  const foreignStore = new RunStore(directory, other); foreignStore.admit(other);
  foreignStore.update(other.id, { status: 'completed', stage: 'done' }); foreignStore.close();
  assert.equal(await store.prune(Date.now() + 1000), 1);
  assert.throws(() => store.get(manifest.id), { code: 'run_not_found' });
  assert.throws(() => readFileSync(join(privateRun, 'output')));
  const checkpoints = new Database(join(directory, 'checkpoints.sqlite'), { readonly: true });
  assert.equal((checkpoints.prepare('SELECT COUNT(*) AS count FROM checkpoints WHERE thread_id=?').get(manifest.id) as { count: number }).count, 0);
  checkpoints.close();
  const foreignReader = new RunStore(directory, other, { readOnly: true });
  assert.equal(foreignReader.get(other.id).status, 'completed'); foreignReader.close();
});
