import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { cancelOwnedProcess, inspectOwnedProcess, reconcileOwnedProcess, runOwnedProcess } from '../src/process.js';

function fixture(t: { after(fn: () => void): void }) {
  const root = mkdtempSync(join(tmpdir(), 'sc-owned-process-'));
  const cwd = join(root, 'work'); mkdirSync(cwd);
  const stateDirectory = join(root, 'private');
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return { root, cwd, stateDirectory };
}
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function until(predicate: () => boolean, ms = 3000) {
  const end = Date.now() + ms;
  while (!predicate()) { if (Date.now() > end) throw new Error('Timed out waiting for child'); await delay(20); }
}

test('executes with direct arguments, explicit environment and private durable receipts', async t => {
  const f = fixture(t);
  const result = await runOwnedProcess({ ...f, key: 'normal', command: process.execPath,
    args: ['-e', 'process.stdout.write(process.argv[1] + ":" + (process.env.ONLY || ""))', 'a;$(touch ignored)'],
    env: { ONLY: 'synthetic' }, timeoutMs: 3000 });
  assert.equal(result.status, 'exited'); assert.equal(result.exitCode, 0);
  assert.equal(result.stdout, 'a;$(touch ignored):synthetic');
  assert.equal(result.stderr, '');
  assert.equal(inspectOwnedProcess(f.stateDirectory, 'normal').state, 'exited');
  assert.equal(statSync(f.stateDirectory).mode & 0o777, 0o700);
  const op = join(f.stateDirectory, readdirSync(f.stateDirectory)[0]!);
  for (const name of readdirSync(op)) assert.equal(statSync(join(op, name)).mode & 0o077, 0);
});

test('wrapper records a bounded cause when its process-group scan fails without claiming exit', async t => {
  const f = fixture(t); const op = join(f.root, 'op'); mkdirSync(op, { mode: 0o700 });
  const preload = join(f.root, 'fail-proc.mjs');
  writeFileSync(preload, `import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
const original = fs.readdirSync;
fs.readdirSync = path => {
  if (path === '/proc') { const error = new Error('injected scan failure'); error.code = 'EACCES'; throw error; }
  return original(path);
};
syncBuiltinESMExports();\n`);
  writeFileSync(join(op, 'request.json'), JSON.stringify({ command: process.execPath,
    args: ['-e', 'setInterval(()=>{},1000)'], cwd: f.cwd, env: {}, timeoutMs: 5000 }));
  const entry = new URL('../src/process-entry.js', import.meta.url);
  const wrapper = spawn(process.execPath, ['--import', preload, entry.pathname, op],
    { detached: true, stdio: 'ignore', env: {} });
  await new Promise<void>((resolve, reject) => { wrapper.once('error', reject); wrapper.once('close', () => resolve()); });
  assert.deepEqual(JSON.parse(readFileSync(join(op, 'failure.json'), 'utf8')),
    { phase: 'group-scan', code: 'EACCES' });
  assert.equal(existsSync(join(op, 'start.json')), true);
  assert.equal(existsSync(join(op, 'exit.json')), false);
});

test('coordinator records wrapper signal as diagnostic while ownership stays unverifiable', async t => {
  const f = fixture(t); const marker = join(f.root, 'child-pid');
  const request = { ...f, key: 'wrapper-killed', command: process.execPath,
    args: ['-e', "require('fs').writeFileSync(process.argv[1],String(process.pid));setTimeout(()=>process.exit(0),1200)", marker],
    env: {}, timeoutMs: 5000 };
  const running = runOwnedProcess(request).catch((error: unknown) => error);
  await until(() => inspectOwnedProcess(f.stateDirectory, request.key).state === 'running');
  await until(() => existsSync(marker));
  const childPid = Number(readFileSync(marker, 'utf8'));
  const childStat = () => {
    try {
      const raw = readFileSync(`/proc/${childPid}/stat`, 'utf8');
      const fields = raw.slice(raw.lastIndexOf(')') + 2).split(' ');
      return { state: fields[0], start: fields[19] };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  };
  const childStart = childStat()?.start;
  assert.ok(childStart);
  const op = join(f.stateDirectory, readdirSync(f.stateDirectory)[0]!);
  const current = inspectOwnedProcess(f.stateDirectory, request.key);
  assert.equal(current.state, 'running');
  process.kill(current.pid!, 'SIGKILL');
  const error = await running as { code?: string };
  assert.equal(error.code, 'owner_unverifiable');
  assert.deepEqual(JSON.parse(readFileSync(join(op, 'wrapper-exit.json'), 'utf8')),
    { exitCode: null, signal: 'SIGKILL' });
  assert.equal(inspectOwnedProcess(f.stateDirectory, request.key).state, 'unverifiable');
  assert.equal(existsSync(join(op, 'exit.json')), false);
  await until(() => {
    const observed = childStat();
    return !observed || observed.start !== childStart || observed.state === 'Z' || observed.state === 'X';
  });
  const observed = childStat();
  assert.ok(!observed || observed.start !== childStart || observed.state === 'Z' || observed.state === 'X');
});

test('returns nonzero exit and caps combined output at two million bytes', async t => {
  const f = fixture(t);
  const result = await runOwnedProcess({ ...f, key: 'nonzero', command: process.execPath,
    args: ['-e', 'process.stdout.write("x".repeat(2100000),()=>{process.stderr.write("error",()=>process.exit(17))})'],
    env: {}, timeoutMs: 5000 });
  assert.equal(result.exitCode, 17);
  assert.ok(Buffer.byteLength(result.stdout) + Buffer.byteLength(result.stderr) <= 2_000_000);
  assert.equal(result.outputTruncated, true);
});

test('stable key reuses an outstanding launch and completed receipt', async t => {
  const f = fixture(t); const marker = join(f.root, 'count');
  const request = { ...f, key: 'once', command: process.execPath,
    args: ['-e', 'require("fs").appendFileSync(process.argv[1],"x");setTimeout(()=>process.stdout.write("done"),300)', marker],
    env: {}, timeoutMs: 5000 };
  const first = runOwnedProcess(request);
  await until(() => readdirSync(f.stateDirectory).length > 0 && inspectOwnedProcess(f.stateDirectory, 'once').state === 'running');
  const second = await runOwnedProcess(request);
  assert.equal(second.stdout, 'done'); assert.deepEqual(await first, second);
  assert.deepEqual(await runOwnedProcess(request), second);
  assert.equal(readFileSync(marker, 'utf8'), 'x');
  await assert.rejects(runOwnedProcess({ ...request, args: ['-e', 'process.exit(0)'] }), { code: 'operation_conflict' });
});

test('lost coordinator acknowledgement is recovered without relaunch', async t => {
  const f = fixture(t); const marker = join(f.root, 'count');
  const request = { ...f, key: 'lost', command: process.execPath,
    args: ['-e', 'require("fs").appendFileSync(process.argv[1],"x");setTimeout(()=>process.stdout.write("recovered"),450)', marker],
    env: {}, timeoutMs: 5000 };
  const moduleUrl = new URL('../src/process.js', import.meta.url).href;
  const coordinator = spawn(process.execPath, ['--input-type=module', '-e',
    'const {runOwnedProcess}=await import(process.argv[1]);runOwnedProcess(JSON.parse(process.argv[2]));setTimeout(()=>process.exit(0),150)',
    moduleUrl, JSON.stringify(request)], { env: {}, stdio: 'ignore' });
  await until(() => existsSync(f.stateDirectory) && readdirSync(f.stateDirectory).length > 0 && inspectOwnedProcess(f.stateDirectory, 'lost').state === 'running');
  await new Promise<void>(resolve => { if (coordinator.exitCode !== null) resolve(); else coordinator.once('exit', () => resolve()); });
  assert.equal((await runOwnedProcess(request)).stdout, 'recovered');
  assert.equal(readFileSync(marker, 'utf8'), 'x');
});

test('cancellation terminates the owned child and grandchild group', async t => {
  const f = fixture(t); const marker = join(f.root, 'grandchild');
  const request = { ...f, key: 'cancel', command: process.execPath,
    args: ['-e', `require("child_process").spawn(process.execPath,["-e","setTimeout(()=>require('fs').writeFileSync(process.argv[1],'bad'),800)",process.argv[1]],{stdio:"ignore"});setInterval(()=>{},1000)`, marker],
    env: {}, timeoutMs: 5000 };
  const running = runOwnedProcess(request);
  await until(() => inspectOwnedProcess(f.stateDirectory, 'cancel').state === 'running');
  const cancelled = await cancelOwnedProcess(f.stateDirectory, 'cancel');
  assert.equal(cancelled.status, 'cancelled');
  assert.equal((await running).status, 'cancelled');
  await delay(950);
  assert.throws(() => readFileSync(marker));
});

test('timeout terminates the owned execution', async t => {
  const f = fixture(t);
  const result = await runOwnedProcess({ ...f, key: 'timeout', command: process.execPath,
    args: ['-e', 'setInterval(()=>{},1000)'], env: {}, timeoutMs: 100 });
  assert.equal(result.status, 'timeout');
  assert.equal(inspectOwnedProcess(f.stateDirectory, 'timeout').state, 'exited');
});

test('reused identity is refused and does not kill an unrelated live process', async t => {
  const f = fixture(t);
  const request = { ...f, key: 'reuse', command: process.execPath,
    args: ['-e', 'setInterval(()=>{},1000)'], env: {}, timeoutMs: 5000 };
  const running = runOwnedProcess(request);
  await until(() => inspectOwnedProcess(f.stateDirectory, 'reuse').state === 'running');
  const op = join(f.stateDirectory, readdirSync(f.stateDirectory)[0]!);
  const startPath = join(op, 'start.json');
  const original = readFileSync(startPath, 'utf8');
  writeFileSync(startPath, JSON.stringify({ ...JSON.parse(original), identity: 'wrong:1' }), { mode: 0o600 });
  assert.equal(inspectOwnedProcess(f.stateDirectory, 'reuse').state, 'unverifiable');
  await assert.rejects(cancelOwnedProcess(f.stateDirectory, 'reuse'), { code: 'owner_unverifiable' });
  writeFileSync(startPath, original, { mode: 0o600 });
  assert.equal((await cancelOwnedProcess(f.stateDirectory, 'reuse')).status, 'cancelled');
  await running;
});

test('abort during wrapper startup waits for owned identity before terminating', async t => {
  const f = fixture(t);
  const controller = new AbortController(); controller.abort();
  const result = await runOwnedProcess({ ...f, key: 'early-abort', command: process.execPath,
    args: ['-e', 'setInterval(()=>{},1000)'], env: {}, timeoutMs: 5000,
    signal: controller.signal });
  assert.equal(result.status, 'cancelled');
  assert.equal(inspectOwnedProcess(f.stateDirectory, 'early-abort').state, 'exited');
});

test('missing start receipt blocks cancellation and duplicate launch', async t => {
  const f = fixture(t);
  const request = { ...f, key: 'missing-start', command: process.execPath,
    args: ['-e', 'setInterval(()=>{},1000)'], env: {}, timeoutMs: 5000 };
  const running = runOwnedProcess(request).catch(error => error);
  await until(() => inspectOwnedProcess(f.stateDirectory, request.key).state === 'running');
  const op = join(f.stateDirectory, readdirSync(f.stateDirectory)[0]!);
  const start = readFileSync(join(op, 'start.json'));
  rmSync(join(op, 'start.json'));
  assert.equal(inspectOwnedProcess(f.stateDirectory, request.key).state, 'pending');
  await assert.rejects(runOwnedProcess(request), { code: 'outstanding_launch' });
  await assert.rejects(cancelOwnedProcess(f.stateDirectory, request.key), { code: 'owner_unverifiable' });
  writeFileSync(join(op, 'start.json'), start, { mode: 0o600 });
  await cancelOwnedProcess(f.stateDirectory, request.key);
  await running;
});


test('reconcile observes a launched operation without creating an absent one', async t => {
  const f = fixture(t);
  await assert.rejects(reconcileOwnedProcess(f.stateDirectory, 'absent'), { code: 'operation_not_found' });
  assert.equal(existsSync(f.stateDirectory), false);
  const request = { ...f, key: 'reconcile', command: process.execPath,
    args: ['-e', 'setTimeout(()=>process.stdout.write("observed"),100)'], env: {}, timeoutMs: 3000 };
  const running = runOwnedProcess(request);
  await until(() => inspectOwnedProcess(f.stateDirectory, request.key).state === 'running');
  assert.equal((await reconcileOwnedProcess(f.stateDirectory, request.key)).stdout, 'observed');
  await running;
});

test('timeout escalates a grandchild that ignores termination', async t => {
  const f = fixture(t); const marker = join(f.root, 'stubborn');
  const childScript = `process.on('SIGTERM',()=>{});setTimeout(()=>require('fs').writeFileSync(process.argv[1],'escaped'),2500);setInterval(()=>{},1000)`;
  const request = { ...f, key: 'stubborn-timeout', command: process.execPath,
    args: ['-e', `require('child_process').spawn(process.execPath,['-e',${JSON.stringify(childScript)},process.argv[1]],{stdio:'ignore'});setInterval(()=>{},1000)`, marker],
    env: {}, timeoutMs: 350 };
  const result = await runOwnedProcess(request);
  assert.equal(result.status, 'timeout');
  await delay(2600);
  assert.equal(existsSync(marker), false);
});

test('wrapper keeps ownership after direct child exits until same-group grandchild finishes', async t => {
  const f = fixture(t); const marker = join(f.root, 'grandchild-done');
  const grandchild = `setTimeout(()=>{require('fs').writeFileSync(process.argv[1],'done')},650)`;
  const request = { ...f, key: 'orphan-natural', command: process.execPath,
    args: ['-e', `require('child_process').spawn(process.execPath,['-e',${JSON.stringify(grandchild)},process.argv[1]],{stdio:'ignore'}).unref();process.exit(0)`, marker],
    env: {}, timeoutMs: 1800 };
  const result = await runOwnedProcess(request);
  assert.equal(result.status, 'exited');
  assert.equal(result.exitCode, 0);
  assert.equal(readFileSync(marker, 'utf8'), 'done');
});

test('wrapper times out a grandchild after direct child exits', async t => {
  const f = fixture(t); const marker = join(f.root, 'orphan-marker');
  const grandchild = `setTimeout(()=>require('fs').writeFileSync(process.argv[1],'escaped'),1500)`;
  const request = { ...f, key: 'orphan-timeout', command: process.execPath,
    args: ['-e', `require('child_process').spawn(process.execPath,['-e',${JSON.stringify(grandchild)},process.argv[1]],{stdio:'ignore'}).unref();process.exit(0)`, marker],
    env: {}, timeoutMs: 300 };
  assert.equal((await runOwnedProcess(request)).status, 'timeout');
  await delay(1600);
  assert.equal(existsSync(marker), false);
});

test('malformed start, exit and outcome receipts remain unverifiable', async t => {
  const f = fixture(t);
  const request = { ...f, key: 'corrupt', command: process.execPath,
    args: ['-e', 'process.stdout.write("ok")'], env: {}, timeoutMs: 3000 };
  await runOwnedProcess(request);
  const op = join(f.stateDirectory, readdirSync(f.stateDirectory)[0]!);
  const startPath = join(op, 'start.json'); const exitPath = join(op, 'exit.json');
  const start = readFileSync(startPath); const exitReceipt = readFileSync(exitPath);
  writeFileSync(startPath, 'null', { mode: 0o600 });
  assert.equal(inspectOwnedProcess(f.stateDirectory, request.key).state, 'unverifiable');
  writeFileSync(startPath, start, { mode: 0o600 });
  writeFileSync(exitPath, JSON.stringify({ identity: JSON.parse(exitReceipt.toString()).identity, status: 'exited' }), { mode: 0o600 });
  assert.equal(inspectOwnedProcess(f.stateDirectory, request.key).state, 'unverifiable');
  writeFileSync(exitPath, exitReceipt, { mode: 0o600 });
  writeFileSync(join(op, 'outcome.json'), '{}', { mode: 0o600 });
  assert.equal(inspectOwnedProcess(f.stateDirectory, request.key).state, 'unverifiable');
});

test('cancellation after a natural exit preserves its observed result', async t => {
  const f = fixture(t);
  const request = { ...f, key: 'late-cancel', command: process.execPath,
    args: ['-e', 'process.exit(23)'], env: {}, timeoutMs: 3000 };
  const first = await runOwnedProcess(request);
  assert.equal(first.status, 'exited');
  const later = await cancelOwnedProcess(f.stateDirectory, request.key);
  assert.deepEqual(later, first);
});

test('coordinator cancellation requests wrapper action without signalling a numeric process group', async t => {
  const f = fixture(t); const marker = join(f.root, 'escaped'); const direct = join(f.root, 'direct-exited');
  const grandchild = `setTimeout(()=>require('fs').writeFileSync(process.argv[1],'escaped'),1100)`;
  const request = { ...f, key: 'wrapper-cancel', command: process.execPath,
    args: ['-e', `require('child_process').spawn(process.execPath,['-e',${JSON.stringify(grandchild)},process.argv[1]],{stdio:'ignore'}).unref();require('fs').writeFileSync(process.argv[2],'done');process.exit(0)`, marker, direct],
    env: {}, timeoutMs: 3000 };
  const running = runOwnedProcess(request);
  await until(() => existsSync(direct));
  await delay(100);
  assert.equal(inspectOwnedProcess(f.stateDirectory, request.key).state, 'running');
  const originalKill = process.kill;
  process.kill = ((pid: number, signal?: NodeJS.Signals | number) => {
    if (pid < 0) throw new Error('Coordinator must not signal a process group by numeric PGID');
    return originalKill(pid, signal);
  }) as typeof process.kill;
  t.after(() => { process.kill = originalKill; });
  assert.equal((await cancelOwnedProcess(f.stateDirectory, request.key)).status, 'cancelled');
  assert.equal((await running).status, 'cancelled');
  await delay(1200);
  assert.equal(existsSync(marker), false);
});
