import assert from 'node:assert/strict';
import test from 'node:test';
import { digest, makeManifest } from '../src/manifest.js';
import { classifyDiff, decideMerge, requiredChecks } from '../src/policy.js';

const base = 'a'.repeat(40), head = 'b'.repeat(40);
const manifest = makeManifest({ repository: 'github.com/example/sc', root: '/synthetic/repo',
  commonDir: '/synthetic/repo/.git', base, scope: 'docs-links', delivery: 'merge-eligible' });

test('mechanical Markdown policy preserves visible text/commands/external links and uses canonical owners', () => {
  const fix = { path: 'README.md', before: '[User guide](broken.md)\n', after: '[User guide](docs/USER_GUIDE.md)\n', mode: '100644' };
  const accepted = classifyDiff(manifest, [fix], { targetExists: target => target === 'docs/USER_GUIDE.md' });
  assert.equal(accepted.category, 'local-doc-link-repair'); assert.deepEqual(accepted.reasons, []);
  for (const change of [
    { ...fix, after: '[New behavior](docs/USER_GUIDE.md)\n' },
    { ...fix, after: '[User guide](LICENSE)\n' },
    { ...fix, before: '[User guide](https://example.invalid)\n' },
    { ...fix, before: '```sh\n[User guide](broken.md)\n```\n', after: '```sh\n[User guide](docs/USER_GUIDE.md)\n```\n' },
    { ...fix, mode: '120000' },
    { ...fix, path: 'AGENTS.md' }
  ]) assert.notEqual(classifyDiff(manifest, [change], { targetExists: () => true }).reasons.length, 0);
});

test('administrative allowance is exactly bound to one coordinator-owned plan and complete diff hash', () => {
  const file = { path: 'openspec/changes/agent-fix-7/tasks.md', before: '# Tasks\n', after: '# Tasks\n\n- [ ] 1.1 Verify\n', mode: '100644' };
  const product = { path: 'README.md', before: '[User guide](bad.md)\n', after: '[User guide](docs/USER_GUIDE.md)\n', mode: '100644' };
  const options = { owner: 'agent-fix-7', administrative: { [file.path]: digest(file.after) }, targetExists: () => true };
  const bound = classifyDiff(manifest, [product, file], options);
  assert.deepEqual(bound.reasons, []);
  assert.notEqual(bound.diffHash, classifyDiff(manifest, [product], options).diffHash);
  assert.ok(classifyDiff(manifest, [product, { ...file, after: '# Authority expanded\n' }], options).reasons.length);
  assert.ok(classifyDiff(manifest, [product, { ...file, path: 'openspec/changes/linux-platform-support/tasks.md' }], options).reasons.length);
});

test('parser PR classification preserves interfaces and assertions but never grants merge purity', () => {
  const parser = makeManifest({ repository: manifest.repository, root: manifest.root, commonDir: manifest.commonDir,
    base, scope: 'providers-json', delivery: 'merge-eligible' });
  const source = { path: 'desktop/src/providers/json.ts', before: 'export function parseJson(text: string): unknown { return JSON.parse(text); }\n',
    after: 'export function parseJson(text: string): unknown { return JSON.parse(text.trim()); }\n', mode: '100644' };
  const assertions = { path: 'desktop/tests/providers/json.agent.test.ts', before: '',
    after: "import {it,expect} from 'vitest';import{parseJson}from'../../src/providers/json';it('contract',()=>expect(parseJson('{}')).toEqual({}));\n", mode: '100644' };
  assert.deepEqual(classifyDiff(parser, [source, assertions]).reasons, []);
  for (const after of [source.after.replace('parseJson(', 'renamed('), source.after + "fetch('https://example.invalid');\n",
    source.after + "import fs from 'node:fs';\n"])
    assert.ok(classifyDiff(parser, [{ ...source, after }, assertions]).reasons.length);
  assert.ok(classifyDiff(parser, [source, { ...assertions, before: assertions.after, after: assertions.after.replace('.toEqual({})', '.toBeTruthy()') }]).reasons.length);
  const dynamic = { ...source, after: source.after.replace('JSON.parse(text.trim())',
    "Reflect.get(Reflect.get({}, 'constructor'), 'constructor')('return process')()") };
  assert.notEqual(classifyDiff(parser, [dynamic, assertions]).category, 'portable-json-parser-fix');
  const classification = classifyDiff(parser, [source, assertions]);
  const binding = { base, head, diffHash: classification.diffHash, policyHash: classification.policyHash };
  const allGreen = { ...binding, verification: { ...binding, passed: true, environment: 'portable-application' },
    review: { ...binding, clean: true }, checks: { head, ready: true }, protection: true,
    upToDate: true, integrationHold: false,
    regression: { baselineFailed: true, candidatePassed: true, oracleHash: 'c'.repeat(64) },
    handoff: { head, qualified: true, receiptHash: 'd'.repeat(64) } };
  assert.equal(decideMerge(parser, classification, allGreen).eligible, false);
  assert.ok(decideMerge(parser, classification, allGreen).reasons.includes('parser_purity_policy_pending'));
});

test('merge decision rejects stale evidence, missing protection/beta and all nonpassing checks', () => {
  const classification = classifyDiff(manifest, [{ path: 'README.md', before: '[User guide](bad.md)\n', after: '[User guide](docs/USER_GUIDE.md)\n', mode: '100644' }], { targetExists: () => true });
  const binding = { base, head, diffHash: classification.diffHash, policyHash: classification.policyHash };
  const evidence = { ...binding, verification: { ...binding, passed: true, environment: 'documentation' },
    review: { ...binding, clean: true }, checks: { head, ready: true }, protection: true, upToDate: true, integrationHold: false };
  assert.equal(decideMerge(manifest, classification, evidence).eligible, true);
  for (const changed of [{ ...evidence, head: 'c'.repeat(40) }, { ...evidence, protection: false },
    { ...evidence, integrationHold: true }, { ...evidence, checks: { head, ready: false } },
    { ...evidence, review: { ...evidence.review, head: 'c'.repeat(40) } }])
    assert.equal(decideMerge(manifest, classification, changed).eligible, false);
  assert.deepEqual(requiredChecks(['README.md']), ['documentation']);
  assert.deepEqual(requiredChecks(['desktop/src/providers/json.ts', 'desktop/tests/providers/json.test.ts',
    'openspec/changes/agent-fix/tasks.md', 'README.md']), ['documentation', 'application']);
  assert.deepEqual(requiredChecks(['desktop/src/providers/json.ts', 'docs/VERIFICATION.md']),
    ['documentation', 'application']);
  for (const path of ['tools/agent-workflow/src/candidate.ts', '.github/workflows/desktop.yml',
    'unknown/path'])
    assert.deepEqual(requiredChecks(['desktop/src/providers/json.ts', path]),
      ['documentation', 'application', 'agent-workflow']);
  assert.deepEqual(requiredChecks([]), ['documentation', 'application', 'agent-workflow']);
  assert.ok(requiredChecks(['unknown/path']).includes('application'));
});
