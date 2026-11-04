import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, readlinkSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import test from 'node:test';
import { prepareSandbox } from '../src/sandbox.js';
import { runOwnedProcess } from '../src/process.js';
import { attestVerificationDependencies } from '../src/candidate.js';

function fixture(t: { after(fn: () => void): void }) {
  const root = mkdtempSync(join(tmpdir(), 'sc-sandbox-repo-'));
  const state = mkdtempSync(join(tmpdir(), 'sc-sandbox-private-'));
  const git = (...args: string[]) => execFileSync('git', ['-C', root, '-c', 'user.name=Fixture',
    '-c', 'user.email=fixture@example.invalid', ...args], { encoding: 'utf8', stdio: 'pipe' });
  git('init', '-b', 'main'); writeFileSync(join(root, 'README.md'), '# Synthetic\n');
  git('add', 'README.md'); git('commit', '-m', 'fixture');
  git('config', 'http.extraHeader', 'Authorization: SYNTHETIC_COORDINATOR_SECRET');
  const secret = join(state, 'coordinator-secret'); writeFileSync(secret, 'SYNTHETIC_PRIVATE', { mode: 0o600 });
  const auth = join(state, 'auth.json'); writeFileSync(auth, '{"auth_mode":"apikey","OPENAI_API_KEY":"synthetic-worker-auth"}', { mode: 0o600 });
  t.after(() => { rmSync(root, { recursive: true, force: true }); rmSync(state, { recursive: true, force: true }); });
  return { root, state, secret, auth, revision: git('rev-parse', 'HEAD').trim() };
}

test('read-only worker sees public Git metadata but no coordinator state, auth or original home', async t => {
  const f = fixture(t);
  const sandbox = prepareSandbox({ workspace: f.root, revision: f.revision, writable: false, stateDirectory: f.state });
  t.after(() => sandbox.dispose());
  const program = `const fs=require('fs'), cp=require('child_process');
    let denied=false;try{fs.writeFileSync('/workspace/README.md','changed')}catch{denied=true}
    console.log(JSON.stringify({denied,secret:fs.existsSync(${JSON.stringify(f.secret)}),
      coordinatorConfig:fs.readFileSync('/run/sc-git/config','utf8').includes('SYNTHETIC_COORDINATOR_SECRET'),
      githubToken:!!process.env.GITHUB_TOKEN,status:cp.execFileSync('/usr/bin/git',['status','--porcelain'],{encoding:'utf8'})}));`;
  const request = sandbox.request('/usr/bin/node', ['-e', program]);
  const result = await runOwnedProcess({ ...request, stateDirectory: f.state, key: 'readonly', timeoutMs: 10_000 });
  assert.equal(result.exitCode, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { denied: true, secret: false, coordinatorConfig: false, githubToken: false, status: '' });
  assert.equal(readFileSync(join(f.root, 'README.md'), 'utf8'), '# Synthetic\n');
});

test('sanitized Git mounts permit workspace reads and independent temporary repositories in primary and linked worktrees', async t => {
  const f = fixture(t);
  const linked = join(f.state, 'linked-worktree');
  execFileSync('/usr/bin/git', ['-C', f.root, 'worktree', 'add', '--detach', linked, f.revision], { stdio: 'pipe' });
  for (const [name, workspace] of [['primary', f.root], ['linked', linked]] as const) {
    const sandbox = prepareSandbox({ workspace, revision: f.revision, writable: false, stateDirectory: f.state });
    t.after(() => sandbox.dispose());
    const script = `const fs=require('fs'),cp=require('child_process');
      const git=(...args)=>cp.execFileSync('/usr/bin/git',args,{encoding:'utf8'}).trim();
      const source=git('-C','/workspace','show','HEAD:README.md');
      const head=git('-C','/workspace','rev-parse','HEAD');
      const status=git('-C','/workspace','status','--porcelain');
      git('init','-b','nested','/tmp/nested');
      fs.writeFileSync('/tmp/nested/test.txt','nested source');
      git('-C','/tmp/nested','add','test.txt');
      git('-C','/tmp/nested','-c','user.name=Fixture','-c','user.email=fixture@example.invalid',
        'commit','-m','nested');
      console.log(JSON.stringify({source,head,status,nested:git('-C','/tmp/nested','show','HEAD:test.txt'),
        gitDir:process.env.GIT_DIR??null,gitWorkTree:process.env.GIT_WORK_TREE??null,
        coordinatorConfig:fs.readFileSync('/run/sc-git/config','utf8').includes('SYNTHETIC_COORDINATOR_SECRET'),
        hostSecret:fs.existsSync(${JSON.stringify(f.secret)})}));`;
    const result = await runOwnedProcess({ ...sandbox.request('/usr/bin/node', ['-e', script]),
      stateDirectory: f.state, key: `nested-git-${name}`, timeoutMs: 10_000 });
    assert.equal(result.exitCode, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), { source: '# Synthetic', head: f.revision,
      status: '', nested: 'nested source', gitDir: null, gitWorkTree: null,
      coordinatorConfig: false, hostSecret: false });
  }
});

test('writer can edit only its mounted workspace and explicit model auth is projected narrowly', async t => {
  const f = fixture(t);
  const sandbox = prepareSandbox({ workspace: f.root, revision: f.revision, writable: true,
    stateDirectory: f.state, authFile: f.auth });
  t.after(() => sandbox.dispose());
  const program = `const fs=require('fs');fs.writeFileSync('/workspace/README.md','# Fixed\\n');
    const auth=JSON.parse(fs.readFileSync('/home/worker/.codex/auth.json','utf8'));
    console.log(JSON.stringify({auth:auth.OPENAI_API_KEY==='synthetic-worker-auth',privateState:fs.existsSync(${JSON.stringify(f.secret)})}));`;
  const result = await runOwnedProcess({ ...sandbox.request('/usr/bin/node', ['-e', program]),
    stateDirectory: f.state, key: 'writer', timeoutMs: 10_000 });
  assert.equal(result.exitCode, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { auth: true, privateState: false });
  assert.equal(readFileSync(join(f.root, 'README.md'), 'utf8'), '# Fixed\n');
});

test('private output schema is mounted read-only without exposing its host directory', async t => {
  const f = fixture(t);
  const schema = join(f.state, 'output-schema.json');
  writeFileSync(schema, '{"type":"object"}', { mode: 0o600 });
  const sandbox = prepareSandbox({ workspace: f.root, revision: f.revision, writable: false,
    stateDirectory: f.state, schemaFile: schema });
  t.after(() => sandbox.dispose());
  const script = `const fs=require('fs');let denied=false;
    try{fs.writeFileSync('/run/sc-output-schema.json','changed')}catch{denied=true}
    console.log(JSON.stringify({schema:fs.readFileSync('/run/sc-output-schema.json','utf8'),
      denied,hostDirectory:fs.existsSync(${JSON.stringify(f.state)})}));`;
  const result = await runOwnedProcess({ ...sandbox.request('/usr/bin/node', ['-e', script]),
    stateDirectory: f.state, key: 'schema', timeoutMs: 10_000 });
  assert.equal(result.exitCode, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { schema: '{"type":"object"}', denied: true, hostDirectory: false });
  assert.equal(readFileSync(schema, 'utf8'), '{"type":"object"}');
});

test('model workers cannot read ignored workspace credentials and ordinary verification has no host network', async t => {
  const f = fixture(t);
  writeFileSync(join(f.root, '.gitignore'), '.env\nprivate/\n');
  writeFileSync(join(f.root, '.env'), 'SYNTHETIC_WORKSPACE_SECRET');
  mkdirSync(join(f.root, 'private')); writeFileSync(join(f.root, 'private', 'credentials'), 'SYNTHETIC_SECRET');
  const model = prepareSandbox({ workspace: f.root, revision: f.revision, writable: false,
    stateDirectory: f.state, authFile: f.auth });
  t.after(() => model.dispose());
  const result = await runOwnedProcess({ ...model.request('/usr/bin/node', ['-e',
    "const fs=require('fs'); console.log(JSON.stringify({env:fs.readFileSync('/workspace/.env','utf8'),private:fs.existsSync('/workspace/private/credentials')}))"]),
  stateDirectory: f.state, key: 'hidden-ignored', timeoutMs: 10_000 });
  assert.equal(result.exitCode, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { env: '', private: false });
  const verification = prepareSandbox({ workspace: f.root, revision: f.revision, writable: false, stateDirectory: f.state });
  t.after(() => verification.dispose());
  const network = await runOwnedProcess({ ...verification.request('/usr/bin/node', ['-e',
    "console.log(require('fs').readlinkSync('/proc/self/ns/net'))"]), stateDirectory: f.state, key: 'no-network', timeoutMs: 10_000 });
  assert.equal(network.exitCode, 0, network.stderr);
  assert.notEqual(network.stdout.trim(), readlinkSync('/proc/self/ns/net'));
});

test('selected native runtime helpers are mounted individually and remain read-only', async t => {
  const f = fixture(t);
  const sandbox = prepareSandbox({ workspace: f.root, revision: f.revision, writable: false,
    stateDirectory: f.state, nativeBinary: '/usr/bin/node',
    nativeHelpers: { codeModeHost: '/usr/bin/node', execServer: '/usr/bin/node' } });
  t.after(() => sandbox.dispose());
  const script = `const fs=require('fs'),cp=require('child_process');let denied=false;
    try{fs.writeFileSync('/run/codex-code-mode-host','changed')}catch{denied=true}
    console.log(JSON.stringify({denied,host:cp.execFileSync('/run/codex-code-mode-host',['--version'],{encoding:'utf8'}).trim(),
      executor:cp.execFileSync('/run/codex-exec-server',['--version'],{encoding:'utf8'}).trim()}));`;
  const result = await runOwnedProcess({ ...sandbox.request('/usr/bin/node', ['-e', script]),
    stateDirectory: f.state, key: 'native-helpers', timeoutMs: 10_000 });
  assert.equal(result.exitCode, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { denied: true, host: process.version, executor: process.version });
});

test('an authentication mode requiring broader host access is rejected before execution', t => {
  const f = fixture(t);
  writeFileSync(f.auth, '{"auth_mode":"keychain"}', { mode: 0o600 });
  assert.throws(() => {
    const sandbox = prepareSandbox({ workspace: f.root, revision: f.revision, writable: false,
      stateDirectory: f.state, authFile: f.auth });
    sandbox.dispose();
  }, { code: 'unsafe_model_auth' });
});

test('verification keeps source and dependencies read-only with isolated generated output mounts', async t => {
  const f = fixture(t);
  for (const path of ['desktop/node_modules/.vite', 'desktop/out',
    'tools/agent-workflow/node_modules/.cache'])
    mkdirSync(join(f.root, path), { recursive: true });
  writeFileSync(join(f.root, 'desktop/node_modules/runner.js'), 'trusted');
  writeFileSync(join(f.root, 'desktop/out/old.js'), 'old output');
  mkdirSync(join(f.root, 'tools/agent-workflow/.cache'));
  writeFileSync(join(f.root, 'tools/agent-workflow/.cache/old.json'), 'old cache');
  const sandbox = prepareSandbox({ workspace: f.root, revision: f.revision, writable: false,
    stateDirectory: f.state, verificationOutputs: 'both' });
  t.after(() => sandbox.dispose());
  const script = `const fs=require('fs');let source=false,dependency=false;
    try{fs.writeFileSync('/workspace/README.md','tamper')}catch{source=true}
    try{fs.writeFileSync('/workspace/desktop/node_modules/runner.js','tamper')}catch{dependency=true}
    fs.writeFileSync('/workspace/desktop/out/new.js','generated');
    fs.writeFileSync('/workspace/desktop/node_modules/.vite/cache.js','cache');
    fs.writeFileSync('/workspace/tools/agent-workflow/dist/test.js','generated');
    fs.writeFileSync('/workspace/tools/agent-workflow/.cache/new.json','cache');
    console.log(JSON.stringify({source,dependency,old:fs.existsSync('/workspace/desktop/out/old.js'),
      oldToolCache:fs.existsSync('/workspace/tools/agent-workflow/.cache/old.json')}));`;
  const result = await runOwnedProcess({ ...sandbox.request('/usr/bin/node', ['-e', script]),
    stateDirectory: f.state, key: 'verify-mounts', timeoutMs: 10_000 });
  assert.equal(result.exitCode, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { source: true, dependency: true, old: false, oldToolCache: false });
  assert.equal(readFileSync(join(f.root, 'desktop/node_modules/runner.js'), 'utf8'), 'trusted');
  assert.equal(readFileSync(join(f.root, 'desktop/out/old.js'), 'utf8'), 'old output');
  assert.equal(readFileSync(join(f.root, 'tools/agent-workflow/.cache/old.json'), 'utf8'), 'old cache');
});

test('application Vite config cache is empty and writable without changing dependency attestation', async t => {
  const f = fixture(t);
  mkdirSync(join(f.root, 'desktop/node_modules/vite/.vite-temp'), { recursive: true });
  writeFileSync(join(f.root, 'desktop/package.json'), '{"name":"fixture"}');
  writeFileSync(join(f.root, 'desktop/package-lock.json'), '{"name":"fixture","lockfileVersion":3}');
  writeFileSync(join(f.root, 'desktop/node_modules/vite/runner.js'), 'trusted');
  const cache = join(f.root, 'desktop/node_modules/.vite-temp');
  const before = attestVerificationDependencies(f.root, ['application']);
  for (const preexisting of [false, true]) {
    if (preexisting) writeFileSync(join(cache, 'writer.mjs'), 'writer-controlled cache');
    const sandbox = prepareSandbox({ workspace: f.root, revision: f.revision, writable: false,
      stateDirectory: f.state, verificationOutputs: 'application' });
    t.after(() => sandbox.dispose());
    assert.equal(existsSync(cache), true);
    assert.deepEqual(attestVerificationDependencies(f.root, ['application']), before);
    const script = `const fs=require('fs');let source=false,dependency=false,nestedCache=false;
      try{fs.writeFileSync('/workspace/README.md','tamper')}catch{source=true}
      try{fs.writeFileSync('/workspace/desktop/node_modules/vite/runner.js','tamper')}catch{dependency=true}
      try{fs.writeFileSync('/workspace/desktop/node_modules/vite/.vite-temp/escape.mjs','tamper')}catch{nestedCache=true}
      const previous=fs.readdirSync('/workspace/desktop/node_modules/.vite-temp');
      fs.writeFileSync('/workspace/desktop/node_modules/.vite-temp/vitest.config.timestamp.mjs','generated');
      console.log(JSON.stringify({source,dependency,nestedCache,previous,
        generated:fs.readFileSync('/workspace/desktop/node_modules/.vite-temp/vitest.config.timestamp.mjs','utf8')}));`;
    const result = await runOwnedProcess({ ...sandbox.request('/usr/bin/node', ['-e', script]),
      stateDirectory: f.state, key: `vite-config-cache-${preexisting}`, timeoutMs: 10_000 });
    assert.equal(result.exitCode, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), { source: true, dependency: true, nestedCache: true,
      previous: [], generated: 'generated' });
    assert.deepEqual(attestVerificationDependencies(f.root, ['application']), before);
    assert.equal(existsSync(join(cache, 'vitest.config.timestamp.mjs')), false);
    if (preexisting) assert.equal(readFileSync(join(cache, 'writer.mjs'), 'utf8'), 'writer-controlled cache');
  }
  assert.equal(readFileSync(join(f.root, 'desktop/node_modules/vite/runner.js'), 'utf8'), 'trusted');
});

test('application verification generates isolated certificates and permits a nested RPM opt mount', async t => {
  const f = fixture(t);
  mkdirSync(join(f.root, 'desktop/node_modules'), { recursive: true });
  mkdirSync(join(f.root, 'tools/agent-workflow/node_modules'), { recursive: true });
  const hostOpt = existsSync('/opt') ? readdirSync('/opt') : null;
  const temporary = `/tmp/sc-app-prerequisites-${basename(f.state)}`;
  for (const profile of ['application', 'both'] as const) {
    const sandbox = prepareSandbox({ workspace: f.root, revision: f.revision, writable: false,
      stateDirectory: f.state, verificationOutputs: profile });
    t.after(() => sandbox.dispose());
    const script = `const fs=require('fs'),cp=require('child_process'),crypto=require('crypto');
      const root=${JSON.stringify(temporary)};fs.mkdirSync(root);fs.mkdirSync(root+'/rpm');
      fs.writeFileSync(root+'/rpm/marker','nested RPM payload');
      const certificate=cp.spawnSync('/usr/bin/openssl',['req','-x509','-newkey','rsa:2048','-nodes',
        '-keyout',root+'/key.pem','-out',root+'/cert.pem','-days','1','-subj','/CN=127.0.0.1',
        '-addext','subjectAltName=IP:127.0.0.1'],{encoding:'utf8'});
      const nested=cp.spawnSync('/usr/bin/bwrap',['--unshare-user','--ro-bind','/','/',
        '--bind',root+'/rpm','/opt','--','/bin/cat','/opt/marker'],{encoding:'utf8'});
      let validCertificate=false;
      if(certificate.status===0){
        const cert=new crypto.X509Certificate(fs.readFileSync(root+'/cert.pem'));
        const privateKey=crypto.createPrivateKey(fs.readFileSync(root+'/key.pem'));
        validCertificate=cert.checkIP('127.0.0.1')==='127.0.0.1'&&cert.checkPrivateKey(privateKey);
      }
      console.log(JSON.stringify({configuration:process.env.OPENSSL_CONF??null,
        certificateStatus:certificate.status,certificateError:certificate.status===0?'':certificate.stderr,
        validCertificate,nestedStatus:nested.status,nestedError:nested.stderr,nestedPayload:nested.stdout.trim(),
        opt:fs.existsSync('/opt')?fs.readdirSync('/opt'):null,hostSecret:fs.existsSync(${JSON.stringify(f.secret)}),
        githubToken:!!process.env.GITHUB_TOKEN,network:fs.readlinkSync('/proc/self/ns/net')}));`;
    const result = await runOwnedProcess({ ...sandbox.request('/usr/bin/node', ['-e', script]),
      stateDirectory: f.state, key: `os-prerequisites-${profile}`, timeoutMs: 15_000 });
    assert.equal(result.exitCode, 0, result.stderr);
    const evidence = JSON.parse(result.stdout);
    assert.equal(evidence.certificateStatus, 0, evidence.certificateError);
    assert.equal(evidence.nestedStatus, 0, evidence.nestedError);
    assert.equal(evidence.configuration, '/dev/null');
    assert.equal(evidence.validCertificate, true);
    assert.equal(evidence.nestedPayload, 'nested RPM payload');
    assert.deepEqual(evidence.opt, []);
    assert.equal(evidence.hostSecret, false);
    assert.equal(evidence.githubToken, false);
    assert.notEqual(evidence.network, readlinkSync('/proc/self/ns/net'));
    assert.equal(existsSync(temporary), false);
    assert.equal(existsSync(join(f.root, 'key.pem')), false);
    assert.deepEqual(existsSync('/opt') ? readdirSync('/opt') : null, hostOpt);
  }
});

test('application OS prerequisites do not change setup, model or tool-only profiles', async t => {
  const f = fixture(t);
  mkdirSync(join(f.root, 'tools/agent-workflow/node_modules'), { recursive: true });
  const profiles = [{ writable: true }, { writable: false, authFile: f.auth },
    { writable: false, verificationOutputs: 'tool' as const }];
  for (const [index, profile] of profiles.entries()) {
    const sandbox = prepareSandbox({ workspace: f.root, revision: f.revision,
      stateDirectory: f.state, network: false, ...profile });
    t.after(() => sandbox.dispose());
    const result = await runOwnedProcess({ ...sandbox.request('/usr/bin/node', ['-e',
      "console.log(JSON.stringify({configuration:process.env.OPENSSL_CONF??null,opt:require('fs').existsSync('/opt')}))"]),
    stateDirectory: f.state, key: `unchanged-os-profile-${index}`, timeoutMs: 10_000 });
    assert.equal(result.exitCode, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), { configuration: null, opt: false });
  }
});
