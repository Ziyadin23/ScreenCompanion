import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { makeManifest } from '../src/manifest.js';
import { RunStore } from '../src/store.js';
import { inspectOwnedProcess, runOwnedProcess } from '../src/process.js';
import { doctor } from '../src/cli.js';

const cli = resolve(process.env.SC_WORKFLOW_CLI_DIST ?? 'dist', 'src/cli.js');
function fixture(t: { after(fn: () => void): void }) {
  const root = mkdtempSync(join(tmpdir(), 'sc-workflow-cli-'));
  const git = (...args: string[]) => execFileSync('git', ['-C', root,
    '-c', 'user.name=Workflow fixture', '-c', 'user.email=fixture@example.invalid', ...args], { encoding: 'utf8', stdio: 'pipe' });
  git('init', '-b', 'main'); git('config', 'core.hooksPath', '/dev/null');
  git('remote', 'add', 'origin', 'https://github.com/example/sc.git');
  writeFileSync(join(root, 'README.md'), '# Synthetic\n'); git('add', 'README.md'); git('commit', '-m', 'fixture');
  const state = `${root}-state`;
  t.after(() => { rmSync(root, { recursive: true, force: true }); rmSync(state, { recursive: true, force: true }); });
  return { root, state, git };
}
function invoke(root: string, ...args: string[]) {
  return spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8', timeout: 10_000,
    env: { PATH: process.env.PATH, HOME: root, CODEX_HOME: join(root, 'no-credentials'), LANGSMITH_TRACING: 'false' } });
}

test('doctor checks capabilities beyond executable presence without claiming live authentication', t => {
  const { root, git } = fixture(t);
  const repository = { root, commonDir: join(root, '.git'), repository: 'github.com/example/sc',
    base: git('rev-parse', 'HEAD').trim(), branch: 'main' };
  const state = `${root}-doctor-state`;
  const probe = (name: string, args: string[]) => ({ status: args[0] === '--version' ? 0 : 1,
    stdout: name === 'node' ? 'v22.12.0' : 'v1.2.3' });
  const result = doctor(repository, state, probe, () => false);
  assert.equal(Object.values(result.tools).every(Boolean), true);
  assert.equal(result.stateAccess, true); assert.equal(result.isolation, false);
  assert.equal(existsSync(state), false);
  assert.equal(result.selectedAuthAvailable, false); assert.equal(result.liveAuthVerified, false);
  assert.equal(result.ready, false); assert.equal(result.mergeEligible, false);
  const isolated = doctor(repository, state, (name, args) =>
    args[0] === '--version' ? probe(name, args) : { status: name === 'bwrap' ? 0 : 1, stdout: '' }, () => true);
  assert.equal(isolated.ready, true); assert.equal(isolated.protectedForMerge, false);
  assert.equal(isolated.mergeEligible, false);
  assert.equal(doctor(repository, join(root, 'state'), probe, () => true).stateAccess, false);
});

test('dry-run resolves trusted scope without creating state or dispatching work', t => {
  const { root, state } = fixture(t);
  const result = invoke(root, 'run', '--scope', 'providers-json', '--state-dir', state, '--dry-run');
  assert.equal(result.status, 0, result.stderr);
  const value = JSON.parse(result.stdout);
  assert.equal(value.dryRun, true); assert.equal(value.delivery, 'report');
  assert.equal(value.repository, 'github.com/example/sc');
  assert.equal(existsSync(state), false);
  const bounded = invoke(root, 'run', '--state-dir', state, '--dry-run', '--workers', '1', '--worker-seconds', '60', '--active-minutes', '2');
  assert.equal(bounded.status, 0, bounded.stderr);
  assert.equal(JSON.parse(bounded.stdout).limits.workerInvocations, 1);
  assert.equal(JSON.parse(bounded.stdout).limits.workerMs, 60_000);
  assert.equal(invoke(root, 'run', '--state-dir', state, '--dry-run', '--workers', '100').status, 4);
});

test('CLI rejects malformed references and authority options before state creation', t => {
  const { root, state } = fixture(t);
  for (const args of [
    ['run', '--scope', '../private', '--dry-run'],
    ['run', '--issue', 'https://github.com/elsewhere/sc/issues/1', '--dry-run'],
    ['run', '--pr', '1', '--delivery', 'merge-eligible', '--dry-run'],
    ['run', '--admin', '--dry-run']
  ]) {
    const result = invoke(root, ...args, '--state-dir', state);
    assert.equal(result.status, 4); assert.equal(existsSync(state), false);
  }
});

test('status and reports never start a missing run or disclose raw private state', t => {
  const { root, state, git } = fixture(t);
  const absent = invoke(root, 'status', 'absent', '--state-dir', state);
  assert.equal(absent.status, 4); assert.equal(existsSync(state), false);
  const manifest = makeManifest({ repository: 'github.com/example/sc', root,
    commonDir: join(root, '.git'), base: git('rev-parse', 'HEAD').trim(), scope: 'providers-json' });
  const store = new RunStore(state, manifest); store.admit(manifest);
  store.update(manifest.id, { status: 'awaiting_input', data: { rawWorkerOutput: 'SYNTHETIC_PRIVATE_CONTENT',
    privatePath: root, roundHistory: [{ number: 0, reason: 'synthetic_failed_check' }] } });
  store.close();
  for (const command of ['status', 'report']) {
    const result = invoke(root, command, manifest.id, '--state-dir', state);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).status, 'awaiting_input');
    assert.equal(JSON.parse(result.stdout).retryCount, 1);
    assert.equal(JSON.parse(result.stdout).interventionRequired, true);
    assert.equal(JSON.parse(result.stdout).interventionCount, null);
    assert.equal(result.stdout.includes('SYNTHETIC_PRIVATE_CONTENT'), false);
    assert.equal(result.stdout.includes(root), false);
  }
});

test('an unavailable executor yields a resumable run and observes cancellation without model calls', t => {
  const { root, state } = fixture(t);
  const started = invoke(root, 'run', '--scope', 'providers-json', '--state-dir', state);
  assert.equal(started.status, 2, started.stderr);
  const run = JSON.parse(started.stdout);
  assert.equal(run.status, 'awaiting_input'); assert.equal(run.usage.workerInvocations, 0);
  assert.equal(invoke(root, 'resume', run.runId, '--state-dir', state).status, 2);
  assert.equal(invoke(root, 'report', run.runId, '--state-dir', state, '--format', 'markdown').status, 0);
  assert.equal(invoke(root, 'cancel', run.runId, '--state-dir', state).status, 0);
  const stopped = invoke(root, 'resume', run.runId, '--state-dir', state);
  assert.equal(stopped.status, 130, stopped.stderr);
  assert.equal(JSON.parse(stopped.stdout).status, 'cancelled');
});

test('cancel stops a recorded worker after coordinator loss and quarantines an uncertain launch', async t => {
  const { root, state, git } = fixture(t);
  const manifest = makeManifest({ repository: 'github.com/example/sc', root,
    commonDir: join(root, '.git'), base: git('rev-parse', 'HEAD').trim(), scope: 'providers-json' });
  const store = new RunStore(state, manifest); t.after(() => store.close()); store.admit(manifest);
  const stateDirectory = join(state, 'runs', manifest.id, 'processes');
  const key = `${manifest.id}:synthetic-worker`;
  store.update(manifest.id, { status: 'running', data: { ownedProcesses: [{ key, stateDirectory }] } });
  const running = runOwnedProcess({ stateDirectory, key, command: process.execPath,
    args: ['-e', 'setInterval(()=>{},1000)'], cwd: root, env: {}, timeoutMs: 10_000 });
  while (inspectOwnedProcess(stateDirectory, key).state !== 'running')
    await new Promise(resolve => setTimeout(resolve, 20));
  const stopped = invoke(root, 'cancel', manifest.id, '--state-dir', state);
  assert.equal(stopped.status, 0, stopped.stderr);
  assert.equal(JSON.parse(stopped.stdout).status, 'cancelled');
  assert.equal((await running).status, 'cancelled');
  assert.equal(inspectOwnedProcess(stateDirectory, key).state, 'exited');
  const other = makeManifest({ repository: manifest.repository, root,
    commonDir: manifest.commonDir, base: manifest.base, scope: 'providers-json' });
  store.admit(other);
  store.update(other.id, { status: 'running', data: { ownedProcesses: [{ key: 'lost-launch',
    stateDirectory: join(state, 'runs', other.id, 'processes') }] } });
  const uncertain = invoke(root, 'cancel', other.id, '--state-dir', state);
  assert.equal(uncertain.status, 4, uncertain.stderr);
  assert.equal(JSON.parse(uncertain.stdout).status, 'quarantined');
});

test('CLI cancellation remains pending while a coordinator lease is live', t => {
  const { root, state, git } = fixture(t);
  const manifest = makeManifest({ repository: 'github.com/example/sc', root,
    commonDir: join(root, '.git'), base: git('rev-parse', 'HEAD').trim(), scope: 'providers-json' });
  const store = new RunStore(state, manifest); t.after(() => store.close());
  store.admit(manifest); store.claim(manifest.id);
  const pending = invoke(root, 'cancel', manifest.id, '--state-dir', state);
  assert.equal(pending.status, 2, pending.stderr);
  assert.equal(JSON.parse(pending.stdout).cancelRequested, true);
  assert.notEqual(JSON.parse(pending.stdout).status, 'cancelled');
  store.release(manifest.id);
  const stopped = invoke(root, 'cancel', manifest.id, '--state-dir', state);
  assert.equal(stopped.status, 0, stopped.stderr);
  assert.equal(JSON.parse(stopped.stdout).status, 'cancelled');
});

test('maintenance snapshots private databases and retention preserves recent unfinished runs', t => {
  const { root, state } = fixture(t);
  const started = invoke(root, 'run', '--state-dir', state);
  assert.equal(started.status, 2, started.stderr);
  const run = JSON.parse(started.stdout);
  const backup = `${state}-backup`;
  t.after(() => rmSync(backup, { recursive: true, force: true }));
  const saved = invoke(root, 'backup', backup, '--state-dir', state);
  assert.equal(saved.status, 0, saved.stderr); assert.equal(existsSync(join(backup, 'snapshot.json')), true);
  const pruned = invoke(root, 'prune', '--state-dir', state, '--retention-days', '30');
  assert.equal(pruned.status, 0, pruned.stderr); assert.equal(JSON.parse(pruned.stdout).removedRuns, 0);
  assert.equal(invoke(root, 'status', run.runId, '--state-dir', state).status, 0);
  assert.equal(invoke(root, 'prune', '--state-dir', state, '--retention-days', '-1').status, 4);
});


test('explicit CLI migration creates a backup and keeps previously consumed allowances', t => {
  const { root, state, git } = fixture(t), backup = `${state}-backup`;
  t.after(() => rmSync(backup, { recursive: true, force: true }));
  const manifest = makeManifest({ repository: 'github.com/example/sc', root, commonDir: join(root, '.git'),
    base: git('rev-parse', 'HEAD').trim(), scope: 'providers-json' });
  mkdirSync(state, { mode: 0o700 });
  const db = new Database(join(state, 'journal.sqlite'));
  // Historical v1 schema, including timings, before the v2 writer ever opens it.
  db.exec(`CREATE TABLE IF NOT EXISTS runs (
    id TEXT PRIMARY KEY, repository TEXT NOT NULL, manifest TEXT NOT NULL,
    status TEXT NOT NULL, stage TEXT NOT NULL, data TEXT NOT NULL DEFAULT '{}',
    cancel_requested INTEGER NOT NULL DEFAULT 0, error TEXT,
    created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS leases (repository TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES runs(id),
    pid INTEGER NOT NULL, identity TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS reservations (run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    key TEXT NOT NULL, counter TEXT NOT NULL, amount INTEGER NOT NULL, PRIMARY KEY(run_id,key));
  CREATE TABLE IF NOT EXISTS operations (run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    key TEXT NOT NULL, kind TEXT NOT NULL, request_hash TEXT NOT NULL, state TEXT NOT NULL, receipt TEXT,
    PRIMARY KEY(run_id,key));
  CREATE TABLE IF NOT EXISTS timings (run_id TEXT NOT NULL, key TEXT NOT NULL, spent_ms INTEGER NOT NULL,
    PRIMARY KEY(run_id,key), FOREIGN KEY(run_id,key) REFERENCES reservations(run_id,key) ON DELETE CASCADE);
  PRAGMA user_version=1;`);
  db.prepare(`INSERT INTO runs(id,repository,manifest,status,stage,created_at,updated_at)
    VALUES(?,?,?,'ready','preflight',1,1)`).run(manifest.id, manifest.repository, JSON.stringify(manifest));
  db.prepare('INSERT INTO reservations(run_id,key,counter,amount) VALUES(?,?,?,?)')
    .run(manifest.id, 'used-worker', 'workerInvocations', 1);
  db.close(); chmodSync(join(state, 'journal.sqlite'), 0o600);
  const result = invoke(root, 'migrate', backup, '--state-dir', state);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).backup, 'complete');
  assert.equal(existsSync(join(backup, 'journal.sqlite')), true);
  const report = invoke(root, 'status', manifest.id, '--state-dir', state);
  assert.equal(report.status, 0, report.stderr);
  assert.equal(JSON.parse(report.stdout).usage.workerInvocations, 1);
});
