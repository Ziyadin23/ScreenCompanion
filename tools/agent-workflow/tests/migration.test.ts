import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { chmodSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { makeManifest } from '../src/manifest.js';
import { RunStore } from '../src/store.js';
import { migrateState } from '../src/migration.js';

function fixture(t: { after(fn: () => void): void }) {
  const directory = mkdtempSync(join(tmpdir(), 'sc-migration-')), root = join(directory, 'repo'); mkdirSync(root);
  const manifest = makeManifest({ root, commonDir: join(root, '.git'), repository: 'github.com/example/sc',
    base: 'a'.repeat(40), scope: 'providers-json' });
  const state = join(directory, 'state'), backup = join(directory, 'backup'); mkdirSync(state, { mode: 0o700 });
  const db = new Database(join(state, 'journal.sqlite'));
  // Frozen v1 DDL from the earlier trusted RunStore prototype, independent of the v2 writer.
  db.exec(`CREATE TABLE IF NOT EXISTS runs (
    id TEXT PRIMARY KEY, repository TEXT NOT NULL, manifest TEXT NOT NULL,
    status TEXT NOT NULL, stage TEXT NOT NULL, data TEXT NOT NULL DEFAULT '{}',
    cancel_requested INTEGER NOT NULL DEFAULT 0, error TEXT,
    created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS leases (
    repository TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES runs(id),
    pid INTEGER NOT NULL, identity TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS reservations (
    run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    key TEXT NOT NULL, counter TEXT NOT NULL, amount INTEGER NOT NULL,
    PRIMARY KEY(run_id,key)
  );
  CREATE TABLE IF NOT EXISTS operations (
    run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    key TEXT NOT NULL, kind TEXT NOT NULL, request_hash TEXT NOT NULL,
    state TEXT NOT NULL, receipt TEXT,
    PRIMARY KEY(run_id,key)
  );
  CREATE TABLE IF NOT EXISTS timings (
    run_id TEXT NOT NULL, key TEXT NOT NULL, spent_ms INTEGER NOT NULL,
    PRIMARY KEY(run_id,key),
    FOREIGN KEY(run_id,key) REFERENCES reservations(run_id,key) ON DELETE CASCADE
  );
  PRAGMA user_version = 1;`);
  db.prepare(`INSERT INTO runs(id,repository,manifest,status,stage,created_at,updated_at)
    VALUES(?,?,?,'ready','preflight',1,1)`).run(manifest.id, manifest.repository, JSON.stringify(manifest));
  db.prepare('INSERT INTO reservations(run_id,key,counter,amount) VALUES(?,?,?,?)')
    .run(manifest.id, 'consumed', 'workerInvocations', 2);
  db.close(); chmodSync(join(state, 'journal.sqlite'), 0o600);
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return { directory, manifest, state, backup };
}

test('v1 migration backs up first and preserves manifests, observed receipts and consumed limits', async t => {
  const f = fixture(t), path = join(f.state, 'journal.sqlite');
  const db = new Database(path);
  db.prepare('INSERT INTO operations(run_id,key,kind,request_hash,state,receipt) VALUES(?,?,?,?,?,?)')
    .run(f.manifest.id, 'observed', 'github_issue', 'b'.repeat(64), 'observed', '{"number":7}'); db.close();
  const result = migrateState(f.state, f.backup, f.manifest);
  assert.deepEqual(result, { from: 1, to: 2, backup: 'complete', runs: 1, incompatibleManifests: 0 });
  const old = new Database(join(f.backup, 'journal.sqlite'), { readonly: true });
  assert.equal(old.pragma('user_version', { simple: true }), 1); old.close();
  const metadata = JSON.parse(readFileSync(join(f.backup, 'snapshot.json'), 'utf8'));
  assert.equal(metadata.status, 'complete'); assert.equal(metadata.scope, 'sqlite-only');
  const store = new RunStore(f.state, f.manifest);
  assert.equal(store.usage(f.manifest.id).workerInvocations, 2);
  assert.deepEqual(store.observedEffect(f.manifest.id, 'observed')?.receipt, { number: 7 });
  assert.deepEqual(store.get(f.manifest.id).manifest, f.manifest); store.close();
  assert.throws(() => migrateState(f.state, join(f.directory, 'second'), f.manifest), { code: 'incompatible_state' });
});

test('unknown effects and live owners block migration with original state retained', t => {
  for (const kind of ['effect', 'owner'] as const) {
    const f = fixture(t), path = join(f.state, 'journal.sqlite');
    const db = new Database(path);
    if (kind === 'effect') db.prepare('INSERT INTO operations(run_id,key,kind,request_hash,state) VALUES(?,?,?,?,?)')
      .run(f.manifest.id, 'unknown', 'worker', 'b'.repeat(64), 'unknown');
    else {
      // Any old lease is refused; the operator must reconcile it using the original compatible tool.
      db.prepare('INSERT INTO leases(repository,run_id,pid,identity) VALUES(?,?,?,?)')
        .run(f.manifest.repository, f.manifest.id, process.pid, 'old-format');
    }
    db.close(); const before = readFileSync(path);
    assert.throws(() => migrateState(f.state, f.backup, f.manifest), { code: 'migration_unresolved' });
    assert.deepEqual(readFileSync(path), before);
  }
});

test('changed policy is preserved for explicit revalidation and unsafe or unknown schema is refused', t => {
  const f = fixture(t), path = join(f.state, 'journal.sqlite');
  const db = new Database(path);
  const old = { ...f.manifest, policyHash: 'c'.repeat(64) };
  db.prepare('UPDATE runs SET manifest=?').run(JSON.stringify(old)); db.close();
  assert.equal(migrateState(f.state, f.backup, f.manifest).incompatibleManifests, 1);
  const store = new RunStore(f.state, f.manifest);
  assert.throws(() => store.get(f.manifest.id), { code: 'incompatible_state' }); store.close();
  const other = fixture(t), otherPath = join(other.state, 'journal.sqlite');
  const wrong = new Database(otherPath); wrong.exec('CREATE TABLE surprise(secret TEXT);'); wrong.close();
  const before = readFileSync(otherPath);
  assert.throws(() => migrateState(other.state, other.backup, other.manifest), { code: 'incompatible_state' });
  assert.deepEqual(readFileSync(otherPath), before);
  assert.throws(() => migrateState(other.state, join(other.manifest.root, 'backup'), other.manifest), { code: 'unsafe_state_path' });
});

test('v1 lookalikes with changed constraints or indexes are refused before backup', t => {
  for (const change of [
    'DROP TABLE operations; CREATE TABLE operations (run_id TEXT, key TEXT, kind TEXT, request_hash TEXT, state TEXT, receipt TEXT)',
    'DROP TABLE timings; CREATE TABLE timings (run_id TEXT, key TEXT, spent_ms INTEGER, PRIMARY KEY(run_id,key))',
    'CREATE TABLE maintenance (repository TEXT, pid INTEGER, identity TEXT, token TEXT)',
    'CREATE INDEX operations_state ON operations(state)'
  ]) {
    const f = fixture(t), path = join(f.state, 'journal.sqlite');
    const db = new Database(path); db.exec(change); db.close();
    const before = readFileSync(path);
    assert.throws(() => migrateState(f.state, f.backup, f.manifest), { code: 'incompatible_state' });
    assert.deepEqual(readFileSync(path), before);
    assert.equal(existsSync(f.backup), false);
  }
});

test('observed operation identities must belong to an admitted run', t => {
  const f = fixture(t), path = join(f.state, 'journal.sqlite');
  const db = new Database(path);
  db.pragma('foreign_keys=OFF');
  db.prepare('INSERT INTO operations(run_id,key,kind,request_hash,state,receipt) VALUES(?,?,?,?,?,?)')
    .run('00000000-0000-4000-8000-000000000001', 'effect', 'github_issue', 'b'.repeat(64), 'observed', '{}');
  db.close(); const before = readFileSync(path);
  assert.throws(() => migrateState(f.state, f.backup, f.manifest), { code: 'invalid_state' });
  assert.deepEqual(readFileSync(path), before); assert.equal(existsSync(f.backup), false);
});

test('invalid observed operations and budget rows cannot be stamped v2', t => {
  const cases = [
    { table: 'operations', values: ['observed', null], code: 'invalid_state' },
    { table: 'operations', values: ['observed', '{'], code: 'invalid_state' },
    { table: 'operations', values: ['bogus', '{}'], code: 'migration_unresolved' },
    { table: 'reservations', values: ['unknownCounter', 1], code: 'invalid_state' },
    { table: 'reservations', values: ['workerInvocations', -1], code: 'invalid_state' },
    { table: 'reservations', values: ['workerInvocations', 100], code: 'invalid_state' }
  ] as const;
  for (const item of cases) {
    const f = fixture(t), path = join(f.state, 'journal.sqlite');
    const db = new Database(path);
    if (item.table === 'operations') db.prepare(`INSERT INTO operations(run_id,key,kind,request_hash,state,receipt)
      VALUES(?,?,?,?,?,?)`).run(f.manifest.id, 'effect', 'github_issue', 'b'.repeat(64), ...item.values);
    else db.prepare('INSERT INTO reservations(run_id,key,counter,amount) VALUES(?,?,?,?)')
      .run(f.manifest.id, 'extra', ...item.values);
    db.close(); const before = readFileSync(path);
    assert.throws(() => migrateState(f.state, f.backup, f.manifest), { code: item.code });
    assert.deepEqual(readFileSync(path), before); assert.equal(existsSync(f.backup), false);
  }
});

test('owned-process registry requires bounded distinct keys', t => {
  for (const keys of [['x', 'x'], ['x'.repeat(201)]]) {
    const f = fixture(t), path = join(f.state, 'journal.sqlite');
    const db = new Database(path);
    db.prepare('UPDATE runs SET data=?').run(JSON.stringify({ ownedProcesses: keys.map(key =>
      ({ key, stateDirectory: join(f.state, 'runs', f.manifest.id, 'processes') })) }));
    db.close();
    assert.throws(() => migrateState(f.state, f.backup, f.manifest));
    assert.equal(existsSync(f.backup), false);
  }
});

test('corrupt v1 run fields refuse migration without changing journal bytes or version', t => {
  const corrupt = [
    ['status', 'unrecognized'], ['stage', 'unrecognized'], ['stage', ''],
    ['cancel_requested', 2], ['error', 'private message'],
    ['created_at', -1], ['updated_at', 1.5]
  ] as const;
  for (const [field, value] of corrupt) {
    const f = fixture(t), path = join(f.state, 'journal.sqlite');
    const db = new Database(path); db.prepare(`UPDATE runs SET ${field}=?`).run(value); db.close();
    const before = readFileSync(path);
    assert.throws(() => migrateState(f.state, f.backup, f.manifest), { code: 'invalid_state' });
    assert.deepEqual(readFileSync(path), before);
    assert.equal(existsSync(f.backup), false);
    const preserved = new Database(path, { readonly: true });
    assert.equal(preserved.pragma('user_version', { simple: true }), 1); preserved.close();
  }
});

test('valid v1 terminal status, cancellation and error code remain unchanged', t => {
  const f = fixture(t), path = join(f.state, 'journal.sqlite');
  const db = new Database(path);
  db.prepare(`UPDATE runs SET status='failed',stage='verify',cancel_requested=1,
    error='verification_failed',updated_at=2`).run(); db.close();
  migrateState(f.state, f.backup, f.manifest);
  const migrated = new Database(path, { readonly: true });
  const row = migrated.prepare('SELECT status,stage,cancel_requested,error,created_at,updated_at FROM runs').get();
  assert.deepEqual(row, { status: 'failed', stage: 'verify', cancel_requested: 1,
    error: 'verification_failed', created_at: 1, updated_at: 2 });
  migrated.close();
});
