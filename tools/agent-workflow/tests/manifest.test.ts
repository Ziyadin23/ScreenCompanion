import assert from 'node:assert/strict';
import test from 'node:test';
import { makeManifest, readManifest } from '../src/manifest.js';

const input = {
  repository: 'github.com/Ziyadin23/ScreenCompanion',
  root: '/synthetic/repository',
  commonDir: '/synthetic/repository/.git',
  base: 'a'.repeat(40),
  scope: 'providers-json'
};

test('admission defaults to a bounded report and a trusted source scope', () => {
  const value = makeManifest(input);
  assert.equal(value.delivery, 'report');
  assert.equal(value.mode, 'investigate');
  assert.deepEqual(value.paths, ['desktop/src/providers/json.ts', 'desktop/tests/providers/']);
  assert.equal(value.limits.workerInvocations, 12);
  assert.equal(value.limits.liveProviderRequests, 0);
  assert.match(value.policyHash, /^[a-f0-9]{64}$/);
});

test('scope, identity and limits cannot be injected through unrecognized manifest fields', () => {
  for (const alteration of [
    { scope: '../../private' }, { base: 'not-a-revision' }, { repository: 'file:///private' },
    { paths: ['/private'] }, { limits: { workerInvocations: -1 } },
    { limits: { liveProviderRequests: 1 } }, { hardCostUsd: 1 }
  ]) assert.throws(() => makeManifest({ ...input, ...alteration }));
});

test('mutating delivery needs an explicit selection and reviews cannot become implementation', () => {
  assert.equal(makeManifest({ ...input, delivery: 'issues' }).delivery, 'issues');
  assert.throws(() => makeManifest({ ...input, mode: 'review', pr: 28, delivery: 'pr' }));
  assert.throws(() => makeManifest({ ...input, mode: 'issue' }));
  assert.throws(() => makeManifest({ ...input, mode: 'review', pr: -1 }));
});

test('admitted scope and resource limits are immutable', () => {
  const value = makeManifest(input);
  assert.throws(() => Object.assign(value, { delivery: 'merge-eligible' }));
  assert.throws(() => Object.assign(value.limits, { workerInvocations: 100 }));
  assert.throws(() => Array.prototype.push.call(value.paths, 'desktop/src/storage/'));
});

test('saved admission retains its identity and rejects changed policy or scope', () => {
  const admitted = makeManifest(input);
  const restored = readManifest(JSON.stringify(admitted));
  assert.equal(restored.id, admitted.id);
  assert.deepEqual(restored.paths, ['desktop/src/providers/json.ts', 'desktop/tests/providers/']);
  for (const patch of [
    { version: 2 }, { policyHash: 'b'.repeat(64) }, { paths: ['desktop/src/storage/'] },
    { id: 'not-a-run' }, { injectedPrivilege: true }
  ]) assert.throws(() => readManifest(JSON.stringify({ ...admitted, ...patch })));
  assert.throws(() => readManifest('not json'));
});
