import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import Database from 'better-sqlite3';
import { chmodSync, existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { MAX_BETA_PROFILE_MS, qualifyConfiguredBeta, selectBetaProfile } from '../src/beta-profile.js';
import { makeManifest } from '../src/manifest.js';
import { RunStore } from '../src/store.js';

const sha = (value: string): string => createHash('sha256').update(value).digest('hex');
const version = '0.5.0-beta.12', token = 'synthetic-resource-identity-token';
function fixture(t: { after(fn: () => void): void }, behavior = 'process.exitCode = 7;') {
  const directory = mkdtempSync(join(tmpdir(), 'sc-beta-profile-')), root = join(directory, 'repo');
  mkdirSync(join(root, 'desktop'), { recursive: true });
  writeFileSync(join(root, 'desktop/package.json'), JSON.stringify({ name: 'synthetic-sc', version }));
  const git = (...args: string[]) => execFileSync('/usr/bin/git', ['-C', root, ...args], { encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'], env: { PATH: '/usr/bin:/bin', HOME: '/dev/null', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' } }).trim();
  git('init', '-q'); git('add', '.'); git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'synthetic fixture');
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
    targetDirectory: join(directory, 'transfer'), helperPath: helper, timeoutMs: 10_000, resourceTokenFile };
  writeFileSync(profilePath, JSON.stringify(profile), { mode: 0o600 });
  const selection = selectBetaProfile('windows', state);
  const manifest = makeManifest({ repository: 'github.com/example/sc', root, commonDir: join(root, '.git'), base: head,
    scope: 'pipeline', betaProfile: selection });
  const store = new RunStore(state, manifest); store.admit(manifest);
  t.after(() => { store.close(); rmSync(directory, { recursive: true, force: true }); });
  return { directory, root, state, helper, resourceTokenFile, profilePath, profile, selection, manifest, store, head,
    request: { store, runId: manifest.id, workspace: root, head, version } };
}
function noQualification(f: ReturnType<typeof fixture>): void {
  for (const kind of ['beta-qualification', 'beta-resource', 'beta'])
    assert.equal(f.store.observedEffect(f.manifest.id, `${kind}:${f.head}:${version}`), null);
  assert.equal(existsSync(f.profile.targetDirectory), false);
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
