import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const installer = fileURLToPath(new URL('./install-bubblewrap.mjs', import.meta.url));
const mirrorPath = '/etc/apt/apt-mirrors.txt';
const azure = 'http://azure.archive.ubuntu.com/ubuntu\tpriority:1\r\n';
const remainder = '# retained runner sources\r\nhttps://archive.ubuntu.com/ubuntu\tpriority:2\r\nhttps://security.ubuntu.com/ubuntu\tpriority:3\r\n# retained trailing comment';
const originalMirror = azure + remainder;

function runFixture(t, overrides = {}) {
  const root = mkdtempSync(join(tmpdir(), 'sc-apt-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const config = {
    mirror: originalMirror,
    primary: { update: 0, install: 0 },
    fallback: { update: 0, install: 0 },
    ...overrides,
  };
  writeFileSync(join(root, 'fixture.json'), JSON.stringify(config));
  if (config.mirror !== null) writeFileSync(join(root, 'mirror'), config.mirror);
  const sudo = join(root, 'sudo');
  writeFileSync(sudo, `#!${process.execPath}\n` + String.raw`
const fs = require('node:fs');
const path = require('node:path');
const root = process.env.SC_APT_TEST_FIXTURE;
const config = JSON.parse(fs.readFileSync(path.join(root, 'fixture.json'), 'utf8'));
const statePath = path.join(root, 'state.json');
const state = fs.existsSync(statePath)
  ? JSON.parse(fs.readFileSync(statePath, 'utf8')) : { calls: [], writes: 0, unexpected: [] };
const args = process.argv.slice(2);
const stage = state.writes ? 'fallback' : 'primary';
state.calls.push({ args, stage });
function finish(code, output) {
  fs.writeFileSync(statePath, JSON.stringify(state));
  if (output !== undefined) fs.writeFileSync(1, output);
  process.exit(code);
}
function unexpected() { state.unexpected.push(args); finish(97); }
if (args[0] === 'apt-get') {
  if (args.some(arg => /allow-unauthenticated|allow-insecure|trusted=yes|AllowUnauthenticated=true|AllowInsecureRepositories=true/i.test(arg))) unexpected();
  const operation = args.includes('update') ? 'update' : args.includes('install') && args.includes('bubblewrap') ? 'install' : null;
  if (!operation) unexpected();
  const plan = config[stage];
  const strict = args.includes('--error-on=any') || args.includes('APT::Update::Error-Mode=any');
  const code = operation === 'update' && plan.warning ? strict ? 100 : 0 : plan[operation];
  if (code !== 0 || plan.warning) fs.writeFileSync(2, "Temporary failure resolving 'azure.archive.ubuntu.com'\n");
  finish(code);
}
const fixedPath = args.at(-1) === '/etc/apt/apt-mirrors.txt' && args.length <= 3 && args.slice(1, -1).every(arg => arg === '--');
if (args[0] === 'cat' && fixedPath) {
  if (!fs.existsSync(path.join(root, 'mirror'))) finish(1);
  finish(0, fs.readFileSync(path.join(root, 'mirror')));
}
if (args[0] === 'tee' && fixedPath) {
  const content = fs.readFileSync(0);
  if (config.writeFails) finish(1);
  fs.writeFileSync(path.join(root, 'mirror'), content);
  state.writes++;
  finish(0);
}
unexpected();
`);
  chmodSync(sudo, 0o700);
  const result = spawnSync(process.execPath, [installer], {
    env: { ...process.env, PATH: root, SC_APT_TEST_FIXTURE: root },
    encoding: 'utf8', timeout: 5_000,
  });
  assert.equal(result.error, undefined, result.error?.message);
  const state = JSON.parse(readFileSync(join(root, 'state.json'), 'utf8'));
  assert.deepEqual(state.unexpected, [], 'A privileged operation escaped the fixed test boundary');
  const mirrorFile = join(root, 'mirror');
  return { ...result, ...state, mirror: existsSync(mirrorFile) ? readFileSync(mirrorFile, 'utf8') : null };
}

const aptCalls = result => result.calls.filter(call => call.args[0] === 'apt-get');
const callsOf = (result, stage, operation) => aptCalls(result).filter(call => call.stage === stage && call.args.includes(operation));

test('healthy primary installs without reading or changing mirror configuration', t => {
  const result = runFixture(t);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(aptCalls(result).length, 2);
  assert.equal(result.calls.length, 2);
  assert.equal(result.writes, 0);
  assert.equal(result.mirror, originalMirror);
});

test('strict update rejects stale-index warnings and recovers through the existing official fallbacks', t => {
  const result = runFixture(t, { primary: { warning: true, update: 0, install: 100 } });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(callsOf(result, 'primary', 'install').length, 0, 'Do not install against a failed fresh index');
  assert.equal(callsOf(result, 'fallback', 'install').length, 1);
  assert.equal(result.writes, 1);
  assert.equal(result.mirror, remainder, 'Keep every non-Azure byte, including comments and CRLF');
});

test('a download failure gets one fresh fallback update and install with bounded network settings', t => {
  const result = runFixture(t, { primary: { update: 0, install: 100 } });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(aptCalls(result).length, 4);
  assert.equal(result.writes, 1);
  assert.equal(result.mirror, remainder);
  for (const call of aptCalls(result)) {
    for (const option of ['Acquire::Retries=1', 'Acquire::http::Timeout=15', 'Acquire::https::Timeout=15'])
      assert.ok(call.args.includes(option), `Missing bounded APT setting ${option}`);
  }
  for (const call of aptCalls(result).filter(call => call.args.includes('update')))
    assert.ok(call.args.includes('--error-on=any') || call.args.includes('APT::Update::Error-Mode=any'));
});

test('duplicate known Azure entries are removed while other lines remain byte-identical', t => {
  const comment = '# http://azure.archive.ubuntu.com/ubuntu stays in this comment\r\n';
  const result = runFixture(t, { mirror: azure + comment + azure + remainder, primary: { update: 100, install: 0 } });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.writes, 1);
  assert.equal(result.mirror, comment + remainder);
});

test('fallback preserves an existing UTF-8 BOM on a retained comment line', t => {
  const comment = '\ufeff# retained runner comment\r\n';
  const result = runFixture(t, { mirror: comment + azure + remainder, primary: { update: 100, install: 0 } });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.mirror, comment + remainder);
});

test('failure of the fallback update stops before installation', t => {
  const result = runFixture(t, { primary: { update: 100, install: 0 }, fallback: { update: 100, install: 0 } });
  assert.notEqual(result.status, 0);
  assert.equal(aptCalls(result).length, 2);
  assert.equal(callsOf(result, 'fallback', 'install').length, 0);
  assert.equal(result.writes, 1);
});

test('failure of fallback installation remains a bounded nonzero failure', t => {
  const result = runFixture(t, { primary: { update: 0, install: 100 }, fallback: { update: 0, install: 100 } });
  assert.equal(result.status, 100);
  assert.equal(aptCalls(result).length, 4);
  assert.equal(result.writes, 1);
});

test('a missing mirror file fails without a write or another package attempt', t => {
  const result = runFixture(t, { mirror: null, primary: { update: 100, install: 0 } });
  assert.notEqual(result.status, 0);
  assert.equal(result.writes, 0);
  assert.equal(result.mirror, null);
  assert.equal(aptCalls(result).length, 1);
});

test('unknown mirror layouts are retained and fail closed', t => {
  for (const mirror of [
    azure,
    remainder,
    'http://azure.archive.ubuntu.com.evil.example/ubuntu\n' + remainder,
    azure + 'http://archive.ubuntu.com/ubuntu\n',
    azure + 'https://unrecognized.example/ubuntu\n',
    azure + 'https://archive.ubuntu.com.evil.example/ubuntu\n',
  ]) {
    const result = runFixture(t, { mirror, primary: { update: 100, install: 0 } });
    assert.notEqual(result.status, 0);
    assert.equal(result.writes, 0);
    assert.equal(result.mirror, mirror);
    assert.equal(aptCalls(result).length, 1);
  }
});

test('a failed mirror write does not retry package commands', t => {
  const result = runFixture(t, { writeFails: true, primary: { update: 100, install: 0 } });
  assert.notEqual(result.status, 0);
  assert.equal(result.writes, 0);
  assert.equal(result.mirror, originalMirror);
  assert.equal(aptCalls(result).length, 1);
});
