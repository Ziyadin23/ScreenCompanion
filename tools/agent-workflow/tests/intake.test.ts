import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { makeManifest } from '../src/manifest.js';
import { RunStore } from '../src/store.js';
import { normalizeFindings, planningOwner, runOracle } from '../src/intake.js';

function fixture(t: { after(fn: () => void): void }) {
  const directory = mkdtempSync(join(tmpdir(), 'sc-intake-'));
  const root = join(directory, 'repo'); mkdirSync(root);
  const git = (...args: string[]) => execFileSync('/usr/bin/git', ['-C', root, '-c', 'user.name=Fixture',
    '-c', 'user.email=fixture@example.invalid', ...args], { encoding: 'utf8', stdio: 'pipe' }).trim();
  git('init', '-b', 'main');
  mkdirSync(join(root, 'desktop/src/providers'), { recursive: true });
  writeFileSync(join(root, 'desktop/src/providers/json.ts'), 'export function parseJson(text: string): unknown { return JSON.parse(text); }\n');
  mkdirSync(join(root, 'docs')); writeFileSync(join(root, 'docs/contract.md'), '# Contract\n\nDuplicate JSON keys are rejected.\n');
  mkdirSync(join(root, 'openspec/changes/linux-platform-support'), { recursive: true });
  writeFileSync(join(root, 'openspec/changes/linux-platform-support/tasks.md'), '# Tasks\n\n- [ ] 4.1 Native evidence still required\n');
  git('add', '.'); git('commit', '-m', 'synthetic contract');
  const manifest = makeManifest({ repository: 'github.com/example/sc', root, commonDir: join(root, '.git'),
    base: git('rev-parse', 'HEAD'), scope: 'providers-json', modelProfile: 'fixture' });
  const store = new RunStore(join(directory, 'state'), manifest); store.admit(manifest);
  t.after(() => { store.close(); rmSync(directory, { recursive: true, force: true }); });
  return { root, git, manifest, store };
}

test('scoped findings deduplicate deterministically and reject injected paths/authority', t => {
  const { manifest } = fixture(t);
  const finding = { path: 'desktop/src/providers/json.ts', description: 'Duplicate fields are accepted.' };
  const results = normalizeFindings(manifest, [finding, finding]);
  assert.equal(results.length, 1); assert.match(results[0]!.id, /^[a-f0-9]{64}$/);
  assert.equal(normalizeFindings(manifest, [finding])[0]!.id, results[0]!.id);
  for (const path of ['../private', '/etc/passwd', 'desktop/src/storage/vault.ts', 'desktop/src/providers/../main/index.ts'])
    assert.throws(() => normalizeFindings(manifest, [{ ...finding, path }]), { code: 'scope_denied' });
  assert.throws(() => normalizeFindings(manifest, [{ ...finding, delivery: 'merge-eligible' }]), { code: 'invalid_finding' });
});

test('existing OpenSpec owner is read from the baseline without editing task progress', t => {
  const { manifest } = fixture(t);
  const owner = planningOwner(manifest, 'Continue openspec/changes/linux-platform-support/tasks.md task 4.1.');
  assert.equal(owner?.change, 'linux-platform-support');
  assert.equal(owner?.provenance, manifest.base);
  assert.equal(owner?.pending.includes('4.1'), true);
  assert.equal(planningOwner(manifest, 'No owner supplied'), null);
  assert.throws(() => planningOwner(manifest, 'openspec/changes/absent/tasks.md'), { code: 'owner_unavailable' });
});

test('a frozen oracle observes a genuine contract failure, pass and unavailable evidence without model verdicts', async t => {
  const { manifest, store, root, git } = fixture(t);
  const oracle = { kind: 'portable-node' as const, contractPaths: ['docs/contract.md'], script:
    `import assert from 'node:assert/strict';
     const {parseJson}=await import('/workspace/desktop/src/providers/json.ts');
     assert.throws(()=>parseJson('{"a":1,"a":2}'));` };
  const failed = await runOracle({ store, runId: manifest.id, workspace: root, revision: manifest.base, oracle });
  assert.equal(failed.outcome, 'failed'); assert.equal(failed.environment, 'linux-portable-synthetic');
  assert.equal(failed.oracleHash, (await runOracle({ store, runId: manifest.id, workspace: root, revision: manifest.base, oracle })).oracleHash);
  writeFileSync(join(root, 'desktop/src/providers/json.ts'), "export function parseJson(text: string): unknown { if(text.includes('\\\"a\\\":1,\\\"a\\\":2')) throw new SyntaxError(); return JSON.parse(text); }\n");
  git('add', '.'); git('commit', '-m', 'different candidate');
  const passed = await runOracle({ store, runId: manifest.id, workspace: root, revision: git('rev-parse', 'HEAD'),
    oracle });
  assert.equal(passed.outcome, 'passed');
  assert.equal(passed.oracleHash, failed.oracleHash); assert.equal(passed.contractHash, failed.contractHash);
  const unavailable = await runOracle({ store, runId: manifest.id, workspace: root, revision: git('rev-parse', 'HEAD'),
    oracle: { ...oracle, script: "throw new Error('Missing target environment');" } });
  assert.equal(unavailable.outcome, 'unavailable');
  assert.throws(() => normalizeFindings(manifest, [{ path: 'desktop/src/providers/json.ts', description: 'one' }], 0), { code: 'budget_exhausted' });
});

test('a proposed exit code or unrelated assertion cannot forge confirmed baseline evidence', async t => {
  const { manifest, store, root } = fixture(t);
  const request = { store, runId: manifest.id, workspace: root, revision: manifest.base };
  await assert.rejects(runOracle({ ...request, oracle: { kind: 'portable-node', contractPaths: ['docs/contract.md'],
    script: 'process.exit(42);' } }), { code: 'invalid_oracle' });
  const unrelated = await runOracle({ ...request, oracle: { kind: 'portable-node', contractPaths: ['docs/contract.md'],
    script: "import assert from 'node:assert/strict';assert.equal(1,2);" } });
  assert.equal(unrelated.outcome, 'unavailable');
  const unusedImport = await runOracle({ ...request, oracle: { kind: 'portable-node', contractPaths: ['docs/contract.md'],
    script: "import assert from 'node:assert/strict';import {parseJson} from '/workspace/desktop/src/providers/json.ts';assert.equal(1,2);" } });
  assert.equal(unusedImport.outcome, 'unavailable');
});
