import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { digest, makeManifest } from '../src/manifest.js';
import { RunStore } from '../src/store.js';
import { executeRun, type Actions } from '../src/graph.js';
import { cancelRun } from '../src/recovery.js';
import { runOwnedProcess, type OwnedProcessResult } from '../src/process.js';

function setup(t: { after(fn: () => void): void }) {
  const temp = mkdtempSync(join(tmpdir(), 'sc-workflow-graph-'));
  const root = join(temp, 'repo'); mkdirSync(root);
  const manifest = makeManifest({ repository: 'github.com/example/sc', root,
    commonDir: join(root, '.git'), base: 'a'.repeat(40), scope: 'providers-json' });
  const store = new RunStore(join(temp, 'state'), manifest); store.admit(manifest);
  t.after(() => { store.close(); rmSync(temp, { recursive: true, force: true }); });
  return { store, manifest };
}

test('a finite report run completes without entering a mutation stage', async t => {
  const { store, manifest } = setup(t);
  const actions: Actions = {
    preflight: async () => ({ next: 'investigate' }),
    investigate: async () => ({ next: 'done', status: 'completed', data: { confirmed: 0 } })
  };
  const result = await executeRun(store, manifest.id, actions);
  assert.equal(result.status, 'completed'); assert.equal(result.data.confirmed, 0);
  assert.equal(store.usage(manifest.id).workerInvocations, 0);
});

test('a wait exits durably and resume starts at the outstanding stage', async t => {
  const { store, manifest } = setup(t);
  let preflights = 0; let ready = false;
  const actions: Actions = {
    preflight: async () => { preflights++; return { next: 'checks' }; },
    checks: async () => ready ? { next: 'done', status: 'completed' } :
      { next: 'checks', status: 'awaiting_external', data: { waitingFor: 'synthetic-check' } }
  };
  assert.equal((await executeRun(store, manifest.id, actions)).status, 'awaiting_external');
  ready = true;
  assert.equal((await executeRun(store, manifest.id, actions)).status, 'completed');
  assert.equal(preflights, 1);
});

test('trusted delivery denies a mutation even if a stage tries to route into it', async t => {
  const { store, manifest } = setup(t);
  let merged = false;
  const result = await executeRun(store, manifest.id, {
    preflight: async () => ({ next: 'merge' }),
    merge: async () => { merged = true; return { next: 'done', status: 'completed' }; }
  });
  assert.equal(result.status, 'failed'); assert.equal(result.error, 'delivery_denied');
  assert.equal(merged, false);
});

test('cancellation prevents new dispatch and leaves a recorded stopped run', async t => {
  const { store, manifest } = setup(t); store.requestCancel(manifest.id);
  let dispatched = false;
  const result = await executeRun(store, manifest.id, {
    preflight: async () => { dispatched = true; return { next: 'done', status: 'completed' }; }
  });
  assert.equal(result.status, 'cancelled'); assert.equal(dispatched, false);
});

test('missing execution capabilities remain an explicit resumable wait', async t => {
  const { store, manifest } = setup(t);
  const result = await executeRun(store, manifest.id, {});
  assert.equal(result.status, 'awaiting_input'); assert.equal(result.error, 'capability_unavailable');
});

test('corrupt checkpoints quarantine the run without dispatch or a leaked lease', async t => {
  const { store, manifest } = setup(t);
  const checkpoint = join(store.directory, 'checkpoints.sqlite');
  writeFileSync(checkpoint, 'corrupt checkpoint', { mode: 0o600 });
  const original = readFileSync(checkpoint);
  let calls = 0;
  const result = await executeRun(store, manifest.id, {
    preflight: async () => { calls++; return { next: 'done', status: 'completed' }; }
  });
  assert.equal(result.status, 'quarantined');
  assert.equal(result.error, 'invalid_checkpoint');
  assert.equal(calls, 0); assert.deepEqual(readFileSync(checkpoint), original);
  await store.backup(join(store.directory, '..', 'quarantine-backup')).catch(error => {
    assert.equal(error.code, 'invalid_state');
  });
});

test('two executions of the same run in one process cannot enter the same stage', async t => {
  const { store, manifest } = setup(t);
  let enter!: () => void;
  let finish!: () => void;
  const entered = new Promise<void>(resolve => { enter = resolve; });
  const held = new Promise<void>(resolve => { finish = resolve; });
  let calls = 0;
  const actions: Actions = { preflight: async () => {
    calls++; enter(); await held; return { next: 'done', status: 'completed' };
  } };
  const first = executeRun(store, manifest.id, actions);
  await entered;
  await assert.rejects(executeRun(store, manifest.id, actions), { code: 'repository_owned' });
  assert.equal(calls, 1);
  finish();
  assert.equal((await first).status, 'completed');
});

test('cancellation during a live stage stays pending and bars a late launch', async t => {
  const { store, manifest } = setup(t);
  let enter!: () => void;
  const entered = new Promise<void>(resolve => { enter = resolve; });
  const execution = executeRun(store, manifest.id, {
    preflight: async ({ signal }) => {
      enter();
      await new Promise<void>(resolve => signal.addEventListener('abort', () => resolve(), { once: true }));
      return { next: 'done', status: 'completed' };
    }
  });
  await entered;
  const pending = await cancelRun(store, manifest.id);
  assert.equal(pending.cancelRequested, true);
  assert.notEqual(pending.status, 'cancelled');
  assert.throws(() => store.registerOwnedProcess(manifest.id, 'worker:too-late',
    join(store.directory, 'runs', manifest.id, 'processes')), { code: 'cancelled' });
  assert.equal((await execution).status, 'cancelled');
});

test('resume quarantines an unacknowledged owned launch before stage dispatch', async t => {
  const { store, manifest } = setup(t);
  const key = 'worker:unacknowledged';
  const stateDirectory = join(store.directory, 'runs', manifest.id, 'processes');
  store.registerOwnedProcess(manifest.id, key, stateDirectory);
  await assert.rejects(store.effect<OwnedProcessResult>(manifest.id, key, 'worker', { role: 'synthetic' }, {
    execute: async () => { throw new Error('lost launch'); }, reconcile: async () => null
  }));
  let calls = 0;
  const result = await executeRun(store, manifest.id, {
    preflight: async () => { calls++; return { next: 'done', status: 'completed' }; }
  });
  assert.equal(result.status, 'quarantined');
  assert.equal(calls, 0);
  assert.equal((await cancelRun(store, manifest.id)).status, 'quarantined');
});

test('malformed owned-process registry quarantines and keeps competing claims out', async t => {
  const { store, manifest } = setup(t);
  store.update(manifest.id, { data: { ownedProcesses: 'malformed-private-registry' } });
  let dispatched = false;
  const result = await executeRun(store, manifest.id, {
    preflight: async () => { dispatched = true; return { next: 'done', status: 'completed' }; }
  });
  assert.equal(result.status, 'quarantined');
  assert.equal(result.error, 'owner_unverifiable');
  assert.equal(result.data.ownedProcesses, 'malformed-private-registry');
  assert.equal(dispatched, false);
  const other = makeManifest({ repository: manifest.repository, root: manifest.root,
    commonDir: manifest.commonDir, base: manifest.base, scope: 'providers-json' });
  store.admit(other);
  assert.throws(() => store.claim(other.id), { code: 'repository_owned' });
  store.update(other.id, { data: { ownedProcesses: null } });
  assert.throws(() => store.ownedProcesses(other.id), { code: 'owner_unverifiable' });
});

test('a persisted prepared execution without registration resumes as pre-dispatch', async t => {
  const { store, manifest } = setup(t);
  const key = 'worker:prepared';
  const request = { role: 'synthetic' };
  const db = new Database(join(store.directory, 'journal.sqlite'));
  db.prepare("INSERT INTO operations(run_id,key,kind,request_hash,state) VALUES (?,?,?,?,'prepared')")
    .run(manifest.id, key, 'worker', digest(request));
  db.close();
  let calls = 0;
  const result = await executeRun(store, manifest.id, {
    preflight: async ({ store: active }) => {
      active.registerOwnedProcess(manifest.id, key, join(store.directory, 'runs', manifest.id, 'processes'));
      await active.effect(manifest.id, key, 'worker', request, {
        execute: async () => { calls++; return { result: 'synthetic' }; }, reconcile: async () => null
      });
      return { next: 'done', status: 'completed' };
    }
  });
  assert.equal(result.status, 'completed');
  assert.equal(calls, 1);
});

test('stage completion keeps the process registry written during the action', async t => {
  const { store, manifest } = setup(t);
  const key = 'worker:registered';
  const stateDirectory = join(store.directory, 'runs', manifest.id, 'processes');
  const result = await executeRun(store, manifest.id, {
    preflight: async ({ store: active }) => {
      active.registerOwnedProcess(manifest.id, key, stateDirectory);
      return { next: 'done', status: 'completed', data: { findingCount: 0 } };
    }
  });
  assert.equal(result.status, 'completed');
  assert.equal(result.data.findingCount, 0);
  assert.deepEqual(result.data.ownedProcesses, [{ key, stateDirectory }]);
});

test('resume records a matching terminal process receipt before dispatch', async t => {
  const { store, manifest } = setup(t);
  const key = 'worker:exited';
  const stateDirectory = join(store.directory, 'runs', manifest.id, 'processes');
  store.registerOwnedProcess(manifest.id, key, stateDirectory);
  let launches = 0;
  await assert.rejects(store.effect<OwnedProcessResult>(manifest.id, key, 'worker', { role: 'synthetic' }, {
    execute: async () => {
      launches++;
      await runOwnedProcess({ stateDirectory, key, command: process.execPath,
        args: ['-e', ''], cwd: manifest.root, env: {} });
      throw new Error('lost acknowledgement');
    }, reconcile: async () => null
  }));
  let dispatched = 0;
  assert.equal((await executeRun(store, manifest.id, {
    preflight: async () => { dispatched++; return { next: 'done', status: 'completed' }; }
  })).status, 'completed');
  assert.equal(dispatched, 1);
  assert.equal(launches, 1);
  const receipt = await store.effect<OwnedProcessResult>(manifest.id, key, 'worker', { role: 'synthetic' }, {
    execute: async () => { launches++; throw new Error('duplicate'); }, reconcile: async () => null
  });
  assert.equal(receipt.status, 'exited');
  assert.equal(launches, 1);
});
