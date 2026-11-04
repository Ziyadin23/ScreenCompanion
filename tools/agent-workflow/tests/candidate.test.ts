import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmodSync, closeSync, constants as fsConstants, fstatSync, mkdirSync, mkdtempSync, openSync,
  readFileSync, readSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { constants, tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { z } from 'zod';
import { makeManifest } from '../src/manifest.js';
import { digest } from '../src/manifest.js';
import { RunStore } from '../src/store.js';
import { assertFrozenSource, attestVerificationDependencies, freezeCandidate, inspectCandidate, pushCandidate,
  selectVerificationCommands, verifyCandidate,
  type PushTransport } from '../src/candidate.js';
import { runOwnedProcess, type OwnedProcessResult } from '../src/process.js';

function fixture(t: { after(fn: () => void): void }) {
  const directory = mkdtempSync(join(tmpdir(), 'sc-candidate-'));
  const root = join(directory, 'repo'); mkdirSync(root);
  const git = (...args: string[]) => execFileSync('/usr/bin/git', ['-C', root, '-c', 'user.name=Fixture',
    '-c', 'user.email=fixture@example.invalid', ...args], { encoding: 'utf8' }).trim();
  git('init', '-b', 'main');
  writeFileSync(join(root, '.gitignore'), 'node_modules/\n.env\n.npmrc\nsecret.bin\n' +
    'tools/agent-workflow/node_modules/\ntools/agent-workflow/dist/\n' +
    'tools/agent-workflow/.cache/\ntools/agent-workflow/private/\n');
  writeFileSync(join(root, 'README.md'), '[user guide](bad.md)\n');
  mkdirSync(join(root, 'docs')); writeFileSync(join(root, 'docs/USER_GUIDE.md'), 'Guide\n');
  mkdirSync(join(root, 'tools/agent-workflow'), { recursive: true });
  writeFileSync(join(root, 'tools/agent-workflow/.gitignore'), 'dist/\n.cache/\n');
  git('add', '.'); git('commit', '-m', 'base');
  const base = git('rev-parse', 'HEAD');
  const manifest = makeManifest({ repository: 'github.com/example/sc', root, commonDir: join(root, '.git'),
    base, scope: 'docs-links', mode: 'investigate', delivery: 'pr' });
  const branch = `sc-agent/issue-28-${manifest.id.slice(0, 8)}`;
  git('switch', '-c', branch);
  const store = new RunStore(join(directory, 'state'), manifest); store.admit(manifest);
  t.after(() => { store.close(); rmSync(directory, { recursive: true, force: true }); });
  const options = { workspace: root, targetExists: () => true };
  const freeze = { ...options, store, manifest, issue: 28, branch, key: 'round-0', timestamp: 1_700_000_000,
    message: 'Fix local guide link' };
  return { directory, root, git, base, manifest, branch, store, options, freeze };
}
function edit(root: string) { writeFileSync(join(root, 'README.md'), '[user guide](docs/USER_GUIDE.md)\n'); }
const passed: OwnedProcessResult = { status: 'exited', exitCode: 0, signal: null, stdout: 'ok', stderr: '',
  outputTruncated: false, elapsedMs: 1 };

const failureDiagnostic = z.object({ phase: z.enum(['group-scan', 'exit-receipt', 'stop-check', 'stop-signal']),
  code: z.string().regex(/^(?:[A-Z0-9_]{1,30}|unknown)$/) }).strict();
const wrapperExitDiagnostic = z.object({ exitCode: z.number().int().min(0).max(255).nullable(),
  signal: z.string().refine(value => value in constants.signals).nullable() }).strict();
function boundedJson(path: string): unknown {
  const fd = openSync(path, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
  try {
    const info = fstatSync(fd);
    if (!info.isFile() || info.size > 512) throw new Error('Invalid diagnostic file');
    const bytes = Buffer.alloc(513);
    const length = readSync(fd, bytes, 0, bytes.length, 0);
    if (length > 512) throw new Error('Oversized diagnostic file');
    return JSON.parse(bytes.subarray(0, length).toString('utf8'));
  } finally { closeSync(fd); }
}
function diagnosticField<T>(path: string, schema: z.ZodType<T>): T | 'unavailable' | null {
  try { return schema.parse(boundedJson(path)); }
  catch (error) { return (error as NodeJS.ErrnoException).code === 'ENOENT' ? null : 'unavailable'; }
}
function processDiagnostic(stateDirectory: string, key: string) {
  for (const name of readdirSync(stateDirectory)) {
    const op = join(stateDirectory, name);
    const intent = boundedJson(join(op, 'intent.json'));
    if (!intent || typeof intent !== 'object' || !('key' in intent) || intent.key !== key) continue;
    const files = readdirSync(op);
    const failure = diagnosticField(join(op, 'failure.json'), failureDiagnostic);
    const wrapperExit = diagnosticField(join(op, 'wrapper-exit.json'), wrapperExitDiagnostic);
    return { key, start: files.includes('start.json'), exit: files.includes('exit.json'), failure, wrapperExit };
  }
  throw new Error('Diagnostic operation not found');
}

test('candidate diagnostic excludes extra and malformed private fields from hosted output', t => {
  const f = fixture(t); const directory = join(f.directory, 'diagnostic'); mkdirSync(directory);
  const op = join(directory, 'op'); mkdirSync(op);
  writeFileSync(join(op, 'intent.json'), JSON.stringify({ key: 'synthetic' }));
  writeFileSync(join(op, 'failure.json'), JSON.stringify({ phase: 'group-scan', code: 'EACCES', env: 'secret' }));
  writeFileSync(join(op, 'wrapper-exit.json'), JSON.stringify({ exitCode: null, signal: 'SIGKILL', stdout: 'secret' }));
  assert.deepEqual(processDiagnostic(directory, 'synthetic'),
    { key: 'synthetic', start: false, exit: false, failure: 'unavailable', wrapperExit: 'unavailable' });
  writeFileSync(join(op, 'failure.json'), '{malformed');
  writeFileSync(join(op, 'wrapper-exit.json'), 'x'.repeat(1024));
  assert.deepEqual(processDiagnostic(directory, 'synthetic'),
    { key: 'synthetic', start: false, exit: false, failure: 'unavailable', wrapperExit: 'unavailable' });
  writeFileSync(join(op, 'failure.json'), JSON.stringify({ phase: 'group-scan', code: 'EACCES' }));
  writeFileSync(join(op, 'wrapper-exit.json'), JSON.stringify({ exitCode: null, signal: 'SIGKILL' }));
  assert.deepEqual(processDiagnostic(directory, 'synthetic'),
    { key: 'synthetic', start: false, exit: false,
      failure: { phase: 'group-scan', code: 'EACCES' }, wrapperExit: { exitCode: null, signal: 'SIGKILL' } });
});

test('full candidate inspection rejects outside scope, ignored surprises, symlinks and binary', t => {
  const f = fixture(t); edit(f.root);
  assert.equal(inspectCandidate(f.manifest, f.options).classification.category, 'local-doc-link-repair');
  writeFileSync(join(f.root, 'unexpected.txt'), 'x');
  assert.throws(() => inspectCandidate(f.manifest, f.options), { code: 'scope_denied' });
  rmSync(join(f.root, 'unexpected.txt'));
  writeFileSync(join(f.root, '.env'), 'private');
  assert.throws(() => inspectCandidate(f.manifest, f.options), { code: 'ignored_surprise' });
  rmSync(join(f.root, '.env'));
  writeFileSync(join(f.root, '.npmrc'), 'registry=https://example.invalid');
  assert.throws(() => inspectCandidate(f.manifest, f.options), { code: 'ignored_surprise' });
  rmSync(join(f.root, '.npmrc'));
  mkdirSync(join(f.root, 'node_modules')); writeFileSync(join(f.root, 'node_modules/generated.js'), 'output');
  assert.equal(inspectCandidate(f.manifest, f.options).ignored[0], 'node_modules/');
  rmSync(join(f.root, 'README.md')); symlinkSync('docs/USER_GUIDE.md', join(f.root, 'README.md'));
  assert.throws(() => inspectCandidate(f.manifest, f.options), { code: 'unsafe_file' });
  rmSync(join(f.root, 'README.md')); writeFileSync(join(f.root, 'README.md'), Buffer.from([0, 1, 2]));
  assert.throws(() => inspectCandidate(f.manifest, f.options), { code: 'unsafe_file' });
  writeFileSync(join(f.root, 'README.md'), '[user guide](docs/USER_GUIDE.md)\n', { mode: 0o755 });
  chmodSync(join(f.root, 'README.md'), 0o755);
  assert.throws(() => inspectCandidate(f.manifest, f.options), { code: 'unsafe_file' });
});

test('staged only and partially staged source cannot escape the full candidate', t => {
  const f = fixture(t); edit(f.root);
  writeFileSync(join(f.root, 'unexpected.txt'), 'staged only');
  f.git('add', 'unexpected.txt'); rmSync(join(f.root, 'unexpected.txt'));
  assert.throws(() => inspectCandidate(f.manifest, f.options), { code: 'index_mismatch' });
  f.git('reset', '--', 'unexpected.txt');
  f.git('add', 'README.md');
  writeFileSync(join(f.root, 'README.md'), '[user guide](other.md)\n');
  assert.throws(() => inspectCandidate(f.manifest, f.options), { code: 'index_mismatch' });
});

test('approved administrative digest and untracked owned record join complete PR source', async t => {
  const f = fixture(t); edit(f.root);
  const record = 'Task checkpoint for candidate\n';
  mkdirSync(join(f.root, 'openspec/changes/task-owner'), { recursive: true });
  writeFileSync(join(f.root, 'openspec/changes/task-owner/tasks.md'), record);
  const options = { ...f.options, owner: 'task-owner',
    administrative: { 'openspec/changes/task-owner/tasks.md': digest(record) } };
  const frozen = await freezeCandidate({ ...f.freeze, ...options });
  assert.deepEqual(frozen.paths, ['README.md', 'openspec/changes/task-owner/tasks.md']);
  assert.equal(f.git('show', `${frozen.head}:openspec/changes/task-owner/tasks.md`), record.trim());
  assert.equal(frozen.sourceHash, assertFrozenSource(f.manifest, frozen, options).sourceHash);
});

test('freeze commits complete owned source through private index and retains unrelated index', async t => {
  const f = fixture(t); edit(f.root);
  const baselineIndex = readFileSync(join(f.root, '.git/index'));
  const frozen = await freezeCandidate(f.freeze);
  assert.equal(f.git('rev-parse', 'HEAD'), frozen.head);
  assert.equal(f.git('show', `${frozen.head}:README.md`), '[user guide](docs/USER_GUIDE.md)');
  assert.equal(frozen.paths.join(','), 'README.md');
  assert.equal(readFileSync(join(f.root, '.git/index')).equals(baselineIndex), false);
  assert.equal(f.git('status', '--porcelain'), '');
  assert.equal(assertFrozenSource(f.manifest, frozen, f.options).sourceHash, frozen.sourceHash);
  writeFileSync(join(f.root, 'README.md'), '[user guide](bad.md)\n');
  assert.throws(() => assertFrozenSource(f.manifest, frozen, f.options), { code: 'stale_source' });
});

test('lost ref acknowledgement reconciles exact commit without duplicate', async t => {
  const f = fixture(t); edit(f.root);
  let once = true;
  await assert.rejects(() => freezeCandidate({ ...f.freeze, beforeRefUpdate: () => {
    if (once) { once = false; throw new Error('lost ack'); }
  } }), /lost ack/);
  const head = f.git('rev-parse', 'HEAD');
  const frozen = await freezeCandidate(f.freeze);
  assert.equal(frozen.head, head);
  assert.equal(f.git('rev-list', '--count', `${f.base}..HEAD`), '1');
  assert.equal(f.git('status', '--porcelain'), '');
});

test('verification uses fixed route, retains failure and binds unchanged source', async t => {
  const f = fixture(t); edit(f.root);
  const frozen = await freezeCandidate(f.freeze);
  const names: string[] = [];
  const runner = async (request: Parameters<typeof runOwnedProcess>[0]) => {
    names.push(request.key.split(':').at(-1)!);
    return request.key.endsWith('workflow-docs') ? { ...passed, exitCode: 7 } : passed;
  };
  const options = { ...f.options, manifest: f.manifest, frozen, store: f.store, key: 'verify-0',
    openspecBinary: '/usr/bin/node', runCheck: runner };
  const result = await verifyCandidate(options);
  assert.equal(result.passed, false);
  assert.deepEqual(names, ['workflow-selftest', 'workflow-docs', 'openspec-strict', 'whitespace']);
  assert.equal(result.checks[1]?.exitCode, 7);
  assert.match(result.environmentIdentity.programs.node!.hash, /^[a-f0-9]{64}$/);
  assert.equal(result.environmentIdentity.programs.openspec?.version, process.version);
  assert.equal(result.environmentIdentity.sandboxProfile.outputs, null);
  assert.ok(result.checks.every(check => check.environmentHash === result.environmentIdentity.hash));
  assert.ok(result.missingCapabilities.includes('native'));
  const replay = await verifyCandidate(options);
  assert.equal(replay.passed, false);
  assert.equal(names.length, 4);
  writeFileSync(join(f.root, 'README.md'), '[user guide](new.md)\n');
  await assert.rejects(() => verifyCandidate(options), { code: 'stale_source' });
});

test('actual harmless credential-free check runs through sandbox and owned process', async t => {
  const f = fixture(t); edit(f.root);
  const frozen = await freezeCandidate(f.freeze);
  const result = await verifyCandidate({ ...f.options, manifest: f.manifest, frozen, store: f.store, key: 'verify-real',
    runCheck: request => request.key.endsWith('whitespace') ? runOwnedProcess(request) : Promise.resolve(passed) });
  assert.equal(result.passed, true);
  assert.equal(result.checks.at(-1)?.passed, true);
  assert.equal(f.git('rev-parse', 'HEAD'), frozen.head);
  assert.equal(result.missingCapabilities.includes('GUI'), true);
});

test('push reads back exact remote head and reconciles lost acknowledgement', async t => {
  const f = fixture(t); edit(f.root);
  f.git('remote', 'add', 'origin', 'https://github.com/example/sc.git');
  const frozen = await freezeCandidate(f.freeze);
  let remote: string | null = null, pushes = 0, lose = true;
  const transport: PushTransport = { async push(_root, _remote, source) {
    pushes++; remote = source;
    if (lose) { lose = false; throw new Error('lost push ack'); }
  }, async read() { return remote; } };
  const options = { ...f.options, manifest: f.manifest, frozen, store: f.store, issue: 28,
    key: 'push-0', transport };
  await assert.rejects(() => pushCandidate(options), /lost push ack/);
  const receipt = await pushCandidate(options);
  assert.equal(receipt.head, frozen.head);
  assert.equal(pushes, 1);
  assert.equal((await pushCandidate(options)).head, frozen.head);
  assert.equal(pushes, 1);
  remote = 'a'.repeat(40);
  await assert.rejects(() => pushCandidate(options), { code: 'remote_conflict' });
});

test('production GitHub auth handle cannot point into candidate workspace', async t => {
  const f = fixture(t); edit(f.root);
  f.git('remote', 'add', 'origin', 'https://github.com/example/sc.git');
  const frozen = await freezeCandidate(f.freeze);
  const previous = process.env.GH_CONFIG_DIR;
  process.env.GH_CONFIG_DIR = f.root;
  try {
    await assert.rejects(() => pushCandidate({ ...f.options, manifest: f.manifest, frozen,
      store: f.store, issue: 28, key: 'push-auth-check', trustedGhBinary: '/usr/bin/node' }),
    { code: 'missing_capability' });
    assert.equal(f.store.observedEffect(f.manifest.id, 'push:push-auth-check'), null);
  } finally {
    if (previous === undefined) delete process.env.GH_CONFIG_DIR;
    else process.env.GH_CONFIG_DIR = previous;
  }
});

test('tool and unknown route runs the tool package verification with the application route', () => {
  const names = selectVerificationCommands(['documentation', 'application', 'agent-workflow'],
    'a'.repeat(40), 'b'.repeat(40)).map(command => command.name);
  assert.deepEqual(names, ['workflow-selftest', 'workflow-docs', 'openspec-strict', 'whitespace',
    'desktop-typecheck', 'desktop-lint', 'desktop-tests', 'desktop-build', 'tool-verify']);
});

test('prewriter attestation catches dependency tampering while excluding isolated caches', t => {
  const f = fixture(t);
  mkdirSync(join(f.root, 'desktop/node_modules/.vite'), { recursive: true });
  writeFileSync(join(f.root, 'desktop/node_modules/check.js'), 'trusted test runner');
  writeFileSync(join(f.root, 'desktop/package.json'), JSON.stringify({ name: 'fixture', version: '1.0.0',
    scripts: { verify: 'node check.js' } }));
  writeFileSync(join(f.root, 'desktop/package-lock.json'), JSON.stringify({ name: 'fixture', version: '1.0.0',
    lockfileVersion: 3, packages: { '': { name: 'fixture', version: '1.0.0', dependencies: { zod: '1.0.0' } } } }));
  const first = attestVerificationDependencies(f.root, ['application']);
  writeFileSync(join(f.root, 'desktop/node_modules/.vite/cache.js'), 'ordinary cache');
  assert.equal(attestVerificationDependencies(f.root, ['application']).hash, first.hash);
  mkdirSync(join(f.root, 'desktop/node_modules/.vite-temp'));
  writeFileSync(join(f.root, 'desktop/node_modules/.vite-temp/vitest.config.mjs'), 'generated config');
  assert.equal(attestVerificationDependencies(f.root, ['application']).hash, first.hash);
  mkdirSync(join(f.root, 'desktop/node_modules/vite/.vite-temp'), { recursive: true });
  writeFileSync(join(f.root, 'desktop/node_modules/vite/.vite-temp/runner.js'), 'dependency bytes');
  assert.notEqual(attestVerificationDependencies(f.root, ['application']).hash, first.hash);
  rmSync(join(f.root, 'desktop/node_modules/vite'), { recursive: true });
  const tool = join(f.root, 'tools/agent-workflow');
  mkdirSync(join(tool, 'node_modules'));
  writeFileSync(join(tool, 'package.json'), '{"name":"tool-fixture"}');
  writeFileSync(join(tool, 'package-lock.json'), '{"name":"tool-fixture","lockfileVersion":3}');
  const toolBefore = attestVerificationDependencies(f.root, ['tool']);
  mkdirSync(join(tool, 'node_modules/.vite-temp'));
  writeFileSync(join(tool, 'node_modules/.vite-temp/runner.js'), 'dependency bytes');
  assert.notEqual(attestVerificationDependencies(f.root, ['tool']).hash, toolBefore.hash);
  writeFileSync(join(f.root, 'desktop/node_modules/check.js'), 'tampered test runner');
  assert.notEqual(attestVerificationDependencies(f.root, ['application']).hash, first.hash);
  writeFileSync(join(f.root, 'desktop/node_modules/check.js'), 'trusted test runner');
  writeFileSync(join(f.root, 'desktop/package-lock.json'), JSON.stringify({ name: 'fixture', version: '1.0.1',
    lockfileVersion: 3, packages: { '': { name: 'fixture', version: '1.0.1', dependencies: { zod: '1.0.0' } } } }));
  assert.equal(attestVerificationDependencies(f.root, ['application']).hash, first.hash);
  writeFileSync(join(f.root, 'desktop/package-lock.json'), JSON.stringify({ name: 'fixture', version: '1.0.1',
    lockfileVersion: 3, packages: { '': { name: 'fixture', version: '1.0.1', dependencies: { zod: '2.0.0' } } } }));
  assert.notEqual(attestVerificationDependencies(f.root, ['application']).hash, first.hash);
});

test('application verifier requires prewriter dependencies and retains postcheck tampering as failure', async t => {
  const f = fixture(t);
  mkdirSync(join(f.root, 'desktop/src/providers'), { recursive: true });
  mkdirSync(join(f.root, 'desktop/node_modules'), { recursive: true });
  writeFileSync(join(f.root, 'desktop/src/providers/json.ts'), 'export const parseJson = JSON.parse;\n');
  writeFileSync(join(f.root, 'desktop/package.json'), JSON.stringify({ name: 'fixture', version: '1.0.0', scripts: {
    verify: 'npm run typecheck && npm run lint && npm test && npm run build',
    typecheck: 'node --version', lint: 'node --version', test: 'node --version', build: 'node --version'
  } }));
  writeFileSync(join(f.root, 'desktop/electron.vite.config.ts'), 'export default {}\n');
  writeFileSync(join(f.root, 'desktop/package-lock.json'), JSON.stringify({ name: 'fixture', version: '1.0.0',
    lockfileVersion: 3, packages: { '': { name: 'fixture', version: '1.0.0' } } }));
  f.git('add', '.'); f.git('commit', '-m', 'application fixture');
  const manifest = makeManifest({ repository: f.manifest.repository, root: f.root, commonDir: f.manifest.commonDir,
    base: f.git('rev-parse', 'HEAD'), scope: 'providers-json', mode: 'investigate', delivery: 'pr' });
  const branch = `sc-agent/issue-28-${manifest.id.slice(0, 8)}`;
  f.git('branch', '-m', branch);
  f.store.admit(manifest);
  writeFileSync(join(f.root, 'desktop/node_modules/runner.js'), 'trusted');
  const trustedDependencies = attestVerificationDependencies(f.root, ['application']);
  writeFileSync(join(f.root, 'desktop/src/providers/json.ts'), 'export const parseJson = (text: string) => JSON.parse(text.trim());\n');
  const options = { workspace: f.root, store: f.store, manifest, issue: 28, branch,
    key: 'app-freeze', timestamp: 1_700_000_001, message: 'Fix parser fixture' };
  const frozen = await freezeCandidate(options);
  const verification = { workspace: f.root, store: f.store, manifest, frozen, key: 'app-verify',
    trustedDependencies, runCheck: async () => passed };
  writeFileSync(join(f.root, 'desktop/node_modules/runner.js'), 'tampered');
  await assert.rejects(() => verifyCandidate(verification), { code: 'stale_environment' });
  writeFileSync(join(f.root, 'desktop/node_modules/runner.js'), 'trusted');
  const clean = await verifyCandidate(verification);
  assert.equal(clean.passed, true);
  assert.deepEqual(clean.checks.slice(-4).map(check => check.name),
    ['desktop-typecheck', 'desktop-lint', 'desktop-tests', 'desktop-build']);
  assert.equal(clean.environmentIdentity.dependencies?.hash, trustedDependencies.hash);
  assert.equal(clean.environmentIdentity.sandboxProfile.outputs, 'application');
  const failed = await verifyCandidate({ ...verification, key: 'app-verify-fail',
    runCheck: async request => request.key.endsWith('desktop-tests') ? { ...passed, exitCode: 9 } : passed });
  assert.equal(failed.passed, false);
  assert.equal(failed.checks.find(check => check.name === 'desktop-tests')?.exitCode, 9);
  const replay = await verifyCandidate({ ...verification, key: 'app-verify-fail' });
  assert.equal(replay.passed, false);
  assert.equal(replay.checks.find(check => check.name === 'desktop-tests')?.exitCode, 9);
  await assert.rejects(() => verifyCandidate({ ...verification, key: 'app-verify-tamper',
    runCheck: async request => {
      if (request.key.endsWith('desktop-build'))
        writeFileSync(join(f.root, 'desktop/node_modules/runner.js'), 'tampered during check');
      return passed;
    } }), { code: 'stale_environment' });
  assert.ok(f.store.observedEffect(manifest.id, 'verification:app-verify-tamper:desktop-build'));
});

test('application checks use fresh read-only sandboxes and build from a copied config', async t => {
  const f = fixture(t);
  mkdirSync(join(f.root, 'desktop/src/providers'), { recursive: true });
  mkdirSync(join(f.root, 'desktop/node_modules'), { recursive: true });
  writeFileSync(join(f.root, 'desktop/src/providers/json.ts'), 'export const parseJson = JSON.parse;\n');
  writeFileSync(join(f.root, 'desktop/electron.vite.config.ts'), 'exact frozen config\n');
  writeFileSync(join(f.root, 'desktop/package.json'), JSON.stringify({ name: 'build-probe', version: '1.0.0', scripts: {
    verify: 'npm run typecheck && npm run lint && npm test && npm run build',
    typecheck: 'node check.mjs typecheck', lint: 'node check.mjs lint',
    test: 'node check.mjs test', build: 'node check.mjs build'
  } }));
  writeFileSync(join(f.root, 'desktop/check.mjs'), `import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
const cache = '/workspace/desktop/node_modules/.cache';
assert.equal(existsSync(cache + '/prior-check'), false);
if (process.argv[2] === 'build') {
  assert.deepEqual(process.argv.slice(3), ['--config', cache + '/sc-electron-vite.config.ts']);
  assert.equal(readFileSync(process.argv[4], 'utf8'), 'exact frozen config\\n');
  assert.throws(() => writeFileSync('/workspace/desktop/electron.vite.config.ts', 'changed'), { code: 'EROFS' });
  writeFileSync('/workspace/desktop/out/bundle', 'ok');
}
writeFileSync(cache + '/prior-check', process.argv[2]);
`);
  writeFileSync(join(f.root, 'desktop/package-lock.json'), JSON.stringify({ name: 'build-probe', version: '1.0.0',
    lockfileVersion: 3, packages: { '': { name: 'build-probe', version: '1.0.0' } } }));
  f.git('add', '.'); f.git('commit', '-m', 'application fixture');
  const manifest = makeManifest({ repository: f.manifest.repository, root: f.root, commonDir: f.manifest.commonDir,
    base: f.git('rev-parse', 'HEAD'), scope: 'providers-json', mode: 'investigate', delivery: 'pr' });
  const branch = `sc-agent/issue-28-${manifest.id.slice(0, 8)}`;
  f.git('branch', '-m', branch); f.store.admit(manifest);
  const trustedDependencies = attestVerificationDependencies(f.root, ['application']);
  writeFileSync(join(f.root, 'desktop/src/providers/json.ts'),
    'export const parseJson = (text: string) => JSON.parse(text.trim());\n');
  const frozen = await freezeCandidate({ workspace: f.root, store: f.store, manifest, issue: 28, branch,
    key: 'app-freeze', timestamp: 1_700_000_001, message: 'Fix parser fixture' });
  const result = await verifyCandidate({ workspace: f.root, store: f.store, manifest, frozen,
    key: 'app-real', trustedDependencies, runCheck: async request => {
      if (!request.key.includes(':desktop-')) return passed;
      try { return await runOwnedProcess(request); }
      catch (error) {
        try {
          console.error('owned process diagnostic', JSON.stringify(processDiagnostic(request.stateDirectory, request.key)));
        } catch { console.error('owned process diagnostic unavailable'); }
        throw error;
      }
    } });
  assert.equal(result.passed, true);
  assert.deepEqual(result.checks.slice(-4).map(check => check.passed), [true, true, true, true]);
  assert.equal(readFileSync(join(f.root, 'desktop/electron.vite.config.ts'), 'utf8'), 'exact frozen config\n');
  assert.equal(f.git('status', '--porcelain'), '');
});

test('application route refuses an unknown aggregate verify layout before launching checks', async t => {
  const f = fixture(t);
  mkdirSync(join(f.root, 'desktop/src/providers'), { recursive: true });
  mkdirSync(join(f.root, 'desktop/node_modules'), { recursive: true });
  writeFileSync(join(f.root, 'desktop/src/providers/json.ts'), 'export const parseJson = JSON.parse;\n');
  writeFileSync(join(f.root, 'desktop/package.json'), JSON.stringify({ name: 'fixture', version: '1.0.0',
    scripts: { verify: 'npm run typecheck && npm run lint && npm test && npm run build && npm run extra' } }));
  writeFileSync(join(f.root, 'desktop/package-lock.json'), JSON.stringify({ name: 'fixture', version: '1.0.0',
    lockfileVersion: 3, packages: { '': { name: 'fixture', version: '1.0.0' } } }));
  f.git('add', '.'); f.git('commit', '-m', 'application fixture');
  const manifest = makeManifest({ repository: f.manifest.repository, root: f.root, commonDir: f.manifest.commonDir,
    base: f.git('rev-parse', 'HEAD'), scope: 'providers-json', mode: 'investigate', delivery: 'pr' });
  const branch = `sc-agent/issue-28-${manifest.id.slice(0, 8)}`;
  f.git('branch', '-m', branch); f.store.admit(manifest);
  writeFileSync(join(f.root, 'desktop/src/providers/json.ts'),
    'export const parseJson = (text: string) => JSON.parse(text.trim());\n');
  const frozen = await freezeCandidate({ workspace: f.root, store: f.store, manifest, issue: 28, branch,
    key: 'app-freeze', timestamp: 1_700_000_001, message: 'Fix parser fixture' });
  let launches = 0;
  await assert.rejects(() => verifyCandidate({ workspace: f.root, store: f.store, manifest, frozen,
    key: 'app-verify', runCheck: async () => { launches++; return passed; } }), { code: 'missing_capability' });
  assert.equal(launches, 0);
});

test('verifyCandidate accepts only canonical ignored tool dependencies and generated outputs', async t => {
  const f = fixture(t); edit(f.root);
  const tool = join(f.root, 'tools/agent-workflow');
  mkdirSync(join(tool, 'node_modules'), { recursive: true });
  mkdirSync(join(tool, '.cache'));
  writeFileSync(join(tool, 'node_modules/package.js'), 'installed');
  writeFileSync(join(tool, '.cache/precheck.json'), '{}');
  assert.deepEqual(inspectCandidate(f.manifest, f.options).ignored,
    ['tools/agent-workflow/.cache/', 'tools/agent-workflow/node_modules/']);
  const frozen = await freezeCandidate(f.freeze);
  const result = await verifyCandidate({ ...f.options, manifest: f.manifest, frozen, store: f.store,
    key: 'tool-ignored-output', runCheck: async request => {
      if (request.key.endsWith('workflow-docs')) {
        mkdirSync(join(tool, 'dist'));
        writeFileSync(join(tool, 'dist/generated.js'), 'isolated output');
      }
      return passed;
    } });
  assert.equal(result.passed, true);
  assert.deepEqual(assertFrozenSource(f.manifest, frozen, f.options).ignored,
    ['tools/agent-workflow/.cache/', 'tools/agent-workflow/dist/', 'tools/agent-workflow/node_modules/']);
  mkdirSync(join(tool, 'private'));
  writeFileSync(join(tool, 'private/secret'), 'unrelated ignored');
  assert.throws(() => inspectCandidate(f.manifest, f.options), { code: 'ignored_surprise' });
});

test('ignored tool allowance rejects symlinked tool root and external target', t => {
  const f = fixture(t); edit(f.root);
  const external = join(f.directory, 'external-tool');
  mkdirSync(join(external, 'node_modules'), { recursive: true });
  writeFileSync(join(external, 'node_modules/package.js'), 'outside');
  rmSync(join(f.root, 'tools/agent-workflow'), { recursive: true });
  symlinkSync(external, join(f.root, 'tools/agent-workflow'));
  assert.throws(() => inspectCandidate(f.manifest, f.options), error =>
    ['ignored_surprise', 'unsafe_file', 'scope_denied'].includes((error as { code?: string }).code ?? ''));
});
