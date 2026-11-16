import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { digest, makeManifest } from '../src/manifest.js';
import { classifyDiff, decideMerge, requiredChecks, labFidelityFixtureCorrection } from '../src/policy.js';

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
    { ...fix, after: '[User guide](docs/../docs/USER_GUIDE.md)\n' },
    { ...fix, after: '[User guide](docs/USER_GUIDE.md#)\n' },
    { ...fix, after: '[User guide](docs%2FUSER_GUIDE.md%23%23)\n' },
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
  for (const path of ['.github/workflows/desktop.yml', 'openspec/config.yaml', 'openspec/specs/behavior/spec.md',
    'desktop/src/storage/vault.ts', 'tools/agent-workflow/src/policy.ts', 'docs//UNKNOWN.md'])
    assert.ok(classifyDiff(manifest, [product, { ...file, path }], options).reasons.length);
});

test('parser category permits only primitive input normalization and preserves the frozen duplicate scanner', () => {
  const parser = makeManifest({ repository: manifest.repository, root: manifest.root, commonDir: manifest.commonDir,
    base, scope: 'providers-json', delivery: 'merge-eligible' });
  const baseline = readFileSync(new URL('../../../../desktop/src/providers/json.ts', import.meta.url), 'utf8');
  const source = { path: 'desktop/src/providers/json.ts', before: baseline,
    after: baseline.replace('const value: unknown = JSON.parse(text);', 'const value: unknown = JSON.parse(text.trim());'), mode: '100644' };
  const assertions = { path: 'desktop/tests/providers/json.agent.test.ts', before: '',
    after: "import {it,expect} from 'vitest';import{parseJson}from'../../src/providers/json';it('contract',()=>expect(parseJson('{}')).toEqual({}));\n", mode: '100644' };
  assert.deepEqual(classifyDiff(parser, [source, assertions]).reasons, []);
  for (const after of [source.after.replace('parseJson(', 'renamed('), source.after + "fetch('https://example.invalid');\n",
    source.after + "import fs from 'node:fs';\n", source.after.replace('frame.names.has(name)', 'false'),
    source.after.replace('text.match(', "''.match("), source.after.replace('text.trim()', 'text.constructor()'),
    source.after.replace('text.trim()', 'text.replace(/x/, (() => "")())'),
    source.after.replace('text.trim()', 'text["trim"]()'), source.after.replace('text.trim()', 'text.trim.call(text)'),
    source.after.replace('text.trim()', 'text.replace(/answer/, "different")'),
    source.after.replace('value.trim().length', 'value.length'),
    source.after.replace('text.trim()', '(JSON.parse = (() => null), text)')])
    assert.ok(classifyDiff(parser, [{ ...source, after }, assertions]).reasons.length);
  assert.ok(classifyDiff(parser, [source, { ...assertions, before: assertions.after, after: assertions.after.replace('.toEqual({})', '.toBeTruthy()') }]).reasons.length);
  const dynamic = { ...source, after: source.after.replace('JSON.parse(text.trim())',
    "Reflect.get(Reflect.get({}, 'constructor'), 'constructor')('return process')()") };
  assert.notEqual(classifyDiff(parser, [dynamic, assertions]).category, 'portable-json-parser-fix');
  for (const appended of ["it('mutates',()=>{expect = ()=>true;});", "it('hook',()=>process.exit());",
    "it('mocks',()=>expect.extend({}));", "it.only('skips',()=>expect(true).toBe(true));",
    "it('getter',()=>expect({get x(){return 1;}}).toBeTruthy());"])
    assert.notEqual(classifyDiff(parser, [source, { ...assertions, after: assertions.after + appended }]).category,
      'portable-json-parser-fix');
  for (const appended of [
    "it('tagged effect', parseJson.constructor`return process.exit(0)`);",
    "it('nested tagged effect',()=>expect(parseJson.constructor`return process.exit(0)`).toBeTruthy());",
    "it('nested tag value',()=>expect(parseJson`${parseJson.constructor`return process.exit(0)`}`).toBeTruthy());"
  ]) assert.notEqual(classifyDiff(parser, [source, { ...assertions, after: assertions.after + appended }]).category,
    'portable-json-parser-fix');
  const classification = classifyDiff(parser, [source, assertions]);
  const binding = { base, head, diffHash: classification.diffHash, policyHash: classification.policyHash };
  const allGreen = { ...binding, verification: { ...binding, passed: true, environment: 'portable-application' },
    review: { ...binding, clean: true }, checks: { head, ready: true }, protection: true,
    upToDate: true, integrationHold: false,
    regression: { base, head, baselineFailed: true, candidatePassed: true, oracleHash: 'c'.repeat(64), contractHash: 'e'.repeat(64) },
    handoff: { head, qualified: true, receiptHash: 'd'.repeat(64) } };
  assert.equal(decideMerge(parser, classification, allGreen).eligible, true);
  for (const changed of [{ ...allGreen, handoff: undefined },
    { ...allGreen, regression: { ...allGreen.regression, base: 'f'.repeat(40) } },
    { ...allGreen, regression: { ...allGreen.regression, oracleHash: 'unknown' } },
    { ...allGreen, handoff: { ...allGreen.handoff, head: 'f'.repeat(40) } }])
    assert.equal(decideMerge(parser, classification, changed).eligible, false);
});

test('the lab fidelity exception changes exactly the malformed option-text fixture and preserves assertions', () => {
  const before = "it.each(['Thorough'])('fails %s required fidelity when production normalizes an extraction the observer cannot read', async mode => {\n" +
    "content.questions[0].options = [{ id: 'Z', text: null }];\n" +
    '// The actual pipeline accepts/answers this non-choice extraction; missing evidence must independently fail the lab.\n' +
    'expect(metadata.extractionFidelity).toBe(false);\n});\n';
  const change = { path: 'desktop/tests/lab/campaign.test.ts', before,
    after: before.replace('text: null', "text: 'Wrong option text'"), mode: '100644' };
  assert.equal(labFidelityFixtureCorrection(change), true);
  const accurate = { ...change, after: change.after
    .replace('fails %s required fidelity when production normalizes an extraction the observer cannot read',
      'fails %s required fidelity for a well-formed but incorrect extraction')
    .replace('// The actual pipeline accepts/answers this non-choice extraction; missing evidence must independently fail the lab.',
      '// A well-formed extraction can answer correctly; wrong transcription must independently fail the lab.') };
  assert.equal(labFidelityFixtureCorrection(accurate), true);
  const pipeline = makeManifest({ repository: manifest.repository, root: manifest.root, commonDir: manifest.commonDir,
    base, scope: 'pipeline', delivery: 'pr' });
  assert.ok(!classifyDiff(pipeline, [change]).reasons.includes('outside_scope'));
  for (const after of [change.after.replace('toBe(false)', 'toBe(true)'), change.after.replace("id: 'Z'", "id: 'A'"),
    change.after.replace("'Wrong option text'", "''"), `${change.after}process.exit();\n`,
    change.after.replace("'Wrong option text'", 'String(null)'),
    accurate.after.replace('toBe(false)', 'toBe(true)'), accurate.after.replace('wrong transcription', 'all transcription')]) {
    assert.equal(labFidelityFixtureCorrection({ ...change, after }), false);
    assert.ok(classifyDiff(pipeline, [{ ...change, after }]).reasons.includes('outside_scope'));
  }
  assert.equal(classifyDiff(pipeline, [change]).category, null);
});

test('version exceptions validate the entire five-file delta and reservation rather than trusting digests alone', () => {
  const application = makeManifest({ repository: manifest.repository, root: manifest.root, commonDir: manifest.commonDir,
    base, scope: 'providers-json', delivery: 'merge-eligible' });
  const previousVersion = '0.5.0-beta.10', version = '0.5.0-beta.11';
  const reservation = { repository: application.repository, runId: application.id, previousVersion, version };
  const records = [
    ['desktop/package.json', '{"name":"sc","version":"0.5.0-beta.10"}'],
    ['desktop/package-lock.json', '{"version":"0.5.0-beta.10","packages":{"":{"version":"0.5.0-beta.10"}}}'],
    ['README.md', '| Current source, unpublished | **0.5.0-beta.10** |'],
    ['docs/PUBLISHING.md', 'The current source version is 0.5.0-beta.10 and is unpublished.'],
    ['docs/STATUS.md', 'Source remains unpublished **0.5.0-beta.10**;']
  ].map(([path, before]) => ({ path: path!, before: before!, after: before!.replaceAll(previousVersion, version), mode: '100644' }));
  const options = { versionReservation: reservation,
    versionRecords: Object.fromEntries(records.map(file => [file.path, digest(file.after)])) };
  const valid = classifyDiff(application, records, options);
  assert.ok(!valid.reasons.includes('version_record_changed'));
  assert.equal(valid.category, null);
  const altered = records.map(file => file.path === 'desktop/package.json' ?
    { ...file, after: file.after.replace('"name":"sc"', '"name":"changed"') } : file);
  assert.ok(classifyDiff(application, altered, { ...options,
    versionRecords: Object.fromEntries(altered.map(file => [file.path, digest(file.after)])) }).reasons.includes('version_record_changed'));
  for (const invalid of [{ ...options, versionReservation: undefined },
    { ...options, versionReservation: { ...reservation, runId: manifest.id } },
    { ...options, versionRecords: { [records[0]!.path]: digest(records[0]!.after) } }])
    assert.ok(classifyDiff(application, records, invalid).reasons.includes('version_record_changed'));
  assert.ok(classifyDiff(manifest, records, options).reasons.includes('version_record_changed'));
  assert.notEqual(valid.diffHash, classifyDiff(application, records.slice(0, -1), options).diffHash);
  const baseline = readFileSync(new URL('../../../../desktop/src/providers/json.ts', import.meta.url), 'utf8');
  const product = { path: 'desktop/src/providers/json.ts', before: baseline,
    after: baseline.replace('JSON.parse(text);', 'JSON.parse(text.trim());'), mode: '100644' };
  const focused = { path: 'desktop/tests/providers/json.agent.test.ts', before: '',
    after: "import {it,expect} from 'vitest';import{parseJson}from'../../src/providers/json';it('contract',()=>expect(parseJson('{}')).toEqual({}));\n", mode: '100644' };
  const owner = { path: 'openspec/changes/agent-json-fix/tasks.md', before: '', after: '- [ ] 1.1 Preserve duplicate rejection\n', mode: '100644' };
  const complete = classifyDiff(application, [product, focused, owner, ...records], { ...options,
    owner: 'agent-json-fix', administrative: { [owner.path]: digest(owner.after) } });
  assert.equal(complete.category, 'portable-json-parser-fix');
  assert.deepEqual(complete.reasons, []);
  assert.notEqual(complete.diffHash, classifyDiff(application, [product, focused]).diffHash);
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
