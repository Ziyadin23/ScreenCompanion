import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, lstatSync, mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { homedir, tmpdir, userInfo } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

async function fixture(t: { after(fn: () => Promise<void>): void }) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'sc-beta-bus-'))), directory = join(root, 'user');
  mkdirSync(directory, { mode: 0o700 });
  const socket = join(directory, 'bus'), server = createServer();
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(socket, resolve); });
  chmodSync(socket, 0o666);
  t.after(async () => {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    rmSync(root, { recursive: true, force: true });
  });
  return { root, directory, socket };
}

/** Redirect only metadata for the two OS-derived paths; never inspect or connect to a host bus. */
function probe(root: string, source: string, options: {
  wrongOwner?: 'parent' | 'socket'; noncanonical?: 'parent' | 'socket'; deniedStat?: 'parent' | 'socket';
} = {}) {
  const directory = `/run/user/${userInfo().uid}`, socket = `${directory}/bus`, preload = join(root, 'metadata-fixture.mjs');
  writeFileSync(preload, `import fs from 'node:fs';
import {syncBuiltinESMExports} from 'node:module';
const directory=${JSON.stringify(directory)},socket=${JSON.stringify(socket)},source=${JSON.stringify(source)},options=${JSON.stringify(options)};
const stat=fs.lstatSync,realpath=fs.realpathSync;
const target=path=>path===directory?'parent':path===socket?'socket':null;
const mapped=path=>path===directory?source:path===socket?source+'/bus':path;
fs.lstatSync=(path,...args)=>{
  const kind=target(path);
  if(kind&&options.deniedStat===kind){const error=new Error('Synthetic metadata denial');error.code='EACCES';throw error;}
  const value=stat(mapped(path),...args);
  if(kind&&options.wrongOwner===kind)value.uid++;
  return value;
};
fs.realpathSync=(path,...args)=>{
  const kind=target(path),actual=realpath(mapped(path),...args);
  if(kind&&options.noncanonical===kind)return '/synthetic-noncanonical';
  return kind&&actual===mapped(path)?path:actual;
};
syncBuiltinESMExports();\n`);
  const script = `try { const {trustedBetaHelperEnvironment}=await import(process.argv[1]);
    console.log(JSON.stringify({env:trustedBetaHelperEnvironment()})); }
    catch(error){console.log(JSON.stringify({error:error.code}));process.exitCode=2;}`;
  const result = spawnSync(process.execPath, ['--import', preload, '--input-type=module', '-e', script,
    new URL('../src/beta-environment.js', import.meta.url).href], { encoding: 'utf8', timeout: 10_000,
    env: { PATH: '/usr/bin:/bin', HOME: homedir(), USER: 'synthetic-wrong-user', LOGNAME: 'synthetic-wrong-user',
      DBUS_SESSION_BUS_ADDRESS: 'tcp:host=synthetic.invalid,port=1', XDG_RUNTIME_DIR: '/synthetic-wrong-runtime',
      DISPLAY: ':synthetic', SC_BETA_TEST_SECRET: 'must-not-be-projected' } });
  assert.equal(result.stderr, '');
  return { status: result.status, ...JSON.parse(result.stdout) } as { status: number; env?: Record<string, string>; error?: string };
}

test('trusted beta environment projects only the canonical owned Unix bus, allowing socket0666 inside private parent', async t => {
  const f = await fixture(t), result = probe(f.root, f.directory), user = userInfo();
  assert.equal(lstatSync(f.socket).isSocket(), true); assert.equal(lstatSync(f.socket).mode & 0o777, 0o666);
  assert.equal(result.status, 0);
  assert.deepEqual(result.env, { PATH: '/usr/bin:/bin', HOME: homedir(), USER: user.username, LOGNAME: user.username,
    DBUS_SESSION_BUS_ADDRESS: `unix:path=/run/user/${user.uid}/bus` });
  assert.deepEqual(Object.keys(result.env!).sort(), ['DBUS_SESSION_BUS_ADDRESS', 'HOME', 'LOGNAME', 'PATH', 'USER']);
});

test('missing user directory or bus omits the optional transport and ignores ambient bus/display values', async t => {
  const f = await fixture(t), empty = join(f.root, 'empty'); mkdirSync(empty, { mode: 0o700 });
  for (const source of [join(f.root, 'absent'), empty]) {
    const result = probe(f.root, source);
    assert.equal(result.status, 0);
    assert.deepEqual(result.env, { PATH: '/usr/bin:/bin', HOME: homedir(), USER: userInfo().username, LOGNAME: userInfo().username });
  }
});

test('unsafe existing parent or bus fails closed without a connection or secret lookup', async t => {
  const f = await fixture(t);
  chmodSync(f.directory, 0o755);
  assert.deepEqual(probe(f.root, f.directory), { status: 2, error: 'beta_capability_unavailable' });
  chmodSync(f.directory, 0o700);
  for (const options of [
    { wrongOwner: 'parent' as const }, { wrongOwner: 'socket' as const },
    { noncanonical: 'parent' as const }, { noncanonical: 'socket' as const },
    { deniedStat: 'parent' as const }, { deniedStat: 'socket' as const }
  ]) assert.deepEqual(probe(f.root, f.directory, options), { status: 2, error: 'beta_capability_unavailable' });
  const linkedParent = join(f.root, 'linked-parent'); symlinkSync(f.directory, linkedParent);
  assert.deepEqual(probe(f.root, linkedParent), { status: 2, error: 'beta_capability_unavailable' });
  const linkedSocket = join(f.root, 'linked-socket'); mkdirSync(linkedSocket, { mode: 0o700 }); symlinkSync(f.socket, join(linkedSocket, 'bus'));
  assert.deepEqual(probe(f.root, linkedSocket), { status: 2, error: 'beta_capability_unavailable' });
  const regular = join(f.root, 'regular'); mkdirSync(regular, { mode: 0o700 }); writeFileSync(join(regular, 'bus'), 'synthetic', { mode: 0o600 });
  assert.deepEqual(probe(f.root, regular), { status: 2, error: 'beta_capability_unavailable' });
});
