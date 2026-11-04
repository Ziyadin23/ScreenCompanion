import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { makeManifest } from '../src/manifest.js';
import { RunStore } from '../src/store.js';
import { reserveCandidateVersion, prepareVersionRecords, validateVersionChanges, handoffBeta } from '../src/delivery.js';

function fixture(t: { after(fn: () => void): void }) {
  const temp = mkdtempSync(join(tmpdir(), 'sc-delivery-'));
  const root = join(temp, 'repo'); mkdirSync(join(root, 'desktop'), { recursive: true }); mkdirSync(join(root, 'docs'));
  writeFileSync(join(root, 'desktop/package.json'), '{"name":"sc","version":"0.5.0-beta.7","scripts":{"build":"ok"}}\n');
  writeFileSync(join(root, 'desktop/package-lock.json'), '{"name":"sc","version":"0.5.0-beta.7","packages":{"":{"name":"sc","version":"0.5.0-beta.7"}}}\n');
  writeFileSync(join(root, 'README.md'), 'The current source version is **0.5.0-beta.7**, not yet published.\nBuild output: `desktop/dist/SC-Setup-v0.5.0-beta.7.exe`, the portable\n`SC-v0.5.0-beta.7.exe` and its matching two-file ZIP with `README.txt`.\nDated 2026-01-01 0.5.0-beta.7 evidence.\n');
  writeFileSync(join(root, 'docs/PUBLISHING.md'), 'The current source version is 0.5.0-beta.7 and is unpublished.\nVersion 0.5.0-beta.7 historical evidence.\n');
  writeFileSync(join(root, 'docs/STATUS.md'), 'Snapshot: **2026-11-03 UTC**. Application source is **0.5.0-beta.7**; latest published beta.6.\nDated beta.7 evidence remains.\n');
  const manifest = makeManifest({ repository: 'github.com/example/sc', root, commonDir: join(root, '.git'), base: 'a'.repeat(40), scope: 'providers-json' });
  const store = new RunStore(join(temp, 'state'), manifest); store.admit(manifest);
  t.after(() => { store.close(); rmSync(temp, { recursive: true, force: true }); });
  return { temp, root, store, manifest };
}
const sha = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
const inventory = (repository: string, versions = ['0.5.0-beta.8']) =>
  ({ releaseInventory: { repository, complete: true as const, versions } });
async function owned(store: RunStore, manifest: { id: string; repository: string },
  head: string, version: string, id: string, targetDirectory: string, token: string) {
  const ownership = { repository: manifest.repository, runId: manifest.id, head, version,
    profile: 'synthetic' as const, id, targetDirectory, tokenHash: sha(token), state: 'owned' as const };
  await store.effect(manifest.id, `beta-resource:${head}:${version}`, 'beta-resource', ownership,
    { execute: async () => ownership, reconcile: async () => null });
  return ownership;
}

test('reservations are durable, idempotent, and unique across handles', t => {
  const { root, store, manifest, temp } = fixture(t);
  const second = makeManifest({ repository: manifest.repository, root, commonDir: manifest.commonDir, base: manifest.base, scope: 'providers-json' });
  store.admit(second);
  const other = new RunStore(join(temp, 'state'), manifest); t.after(() => other.close());
  assert.throws(() => reserveCandidateVersion(store, manifest.id), { code: 'release_inventory_wait' });
  assert.equal(reserveCandidateVersion(store, manifest.id, inventory(manifest.repository)).version, '0.5.0-beta.9');
  assert.equal(reserveCandidateVersion(other, manifest.id).version, '0.5.0-beta.9');
  assert.equal(reserveCandidateVersion(other, second.id, inventory(manifest.repository)).version, '0.5.0-beta.10');
  assert.throws(() => reserveCandidateVersion(other, second.id, inventory('github.com/elsewhere/sc')),
    { code: 'release_inventory_wait' });
});

test('version preparation preserves dated evidence and validates exact JSON fields', t => {
  const { root, store, manifest } = fixture(t);
  const reservation = reserveCandidateVersion(store, manifest.id, inventory(manifest.repository));
  const prepared = prepareVersionRecords(root, reservation);
  assert.deepEqual(prepared.changes.map(change => change.path), ['desktop/package.json', 'desktop/package-lock.json', 'README.md', 'docs/PUBLISHING.md', 'docs/STATUS.md']);
  assert.match(prepared.changes[2]!.after, /Dated 2026-01-01 0\.5\.0-beta\.7 evidence/);
  assert.match(prepared.changes[3]!.after, /Version 0\.5\.0-beta\.7 historical evidence/);
  assert.match(prepared.changes[4]!.after, /Dated beta\.7 evidence remains/);
  assert.match(prepared.changes[4]!.after, /Application source is \*\*0\.5\.0-beta\.9\*\*/);
  assert.equal(prepared.versionRecords['README.md'], sha(JSON.stringify(prepared.changes[2]!.after)));
  assert.doesNotThrow(() => validateVersionChanges(prepared.changes, reservation));
  const tampered = structuredClone(prepared.changes);
  tampered[0]!.after = tampered[0]!.after.replace('"build":"ok"', '"build":"unsafe"');
  assert.throws(() => validateVersionChanges(tampered, reservation), { code: 'invalid_version_change' });
  const lockTampered = structuredClone(prepared.changes);
  lockTampered[1]!.after = lockTampered[1]!.after.replace('"name":"sc"', '"name":"other"');
  assert.throws(() => validateVersionChanges(lockTampered, reservation), { code: 'invalid_version_change' });
  const nested = structuredClone(prepared.changes);
  nested[0]!.before = '{"\\u0076ersion":"0.5.0-beta.7","nested":{"version":"0.5.0-beta.7"}}';
  nested[0]!.after = '{"\\u0076ersion":"0.5.0-beta.7","nested":{"version":"0.5.0-beta.9"}}';
  assert.throws(() => validateVersionChanges(nested, reservation), { code: 'invalid_version_change' });
  const nestedLock = structuredClone(prepared.changes);
  nestedLock[1]!.before = '{"\\u0076ersion":"0.5.0-beta.7","packages":{"":{"\\u0076ersion":"0.5.0-beta.7"},"nested":{"version":"0.5.0-beta.7"}},"other":{"version":"0.5.0-beta.7"}}';
  nestedLock[1]!.after = nestedLock[1]!.before.replaceAll('"version":"0.5.0-beta.7"', '"version":"0.5.0-beta.9"');
  assert.throws(() => validateVersionChanges(nestedLock, reservation), { code: 'invalid_version_change' });
  writeFileSync(join(root, 'docs/STATUS.md'), 'unrecognized status\n');
  assert.throws(() => prepareVersionRecords(root, reservation), { code: 'version_record_wait' });
  writeFileSync(join(root, 'docs/STATUS.md'), prepared.changes[4]!.before);
  writeFileSync(join(root, 'README.md'), 'unknown current record\n');
  assert.throws(() => prepareVersionRecords(root, reservation), { code: 'version_record_wait' });
});

test('synthetic transfer verifies artifacts, keeps paths private, and never qualifies automerge', async t => {
  const { temp, root, store, manifest } = fixture(t);
  const version = '0.5.0-beta.8', head = 'b'.repeat(40);
  const source = join(temp, 'source'), target = join(temp, 'target'); mkdirSync(source); mkdirSync(target);
  const exe = Buffer.from('synthetic portable exe'), readme = Buffer.from('synthetic readme');
  const names = [`SC-v${version}.exe`, `SC-v${version}.zip`, `SC-Setup-v${version}.exe`, 'README.txt'];
  writeFileSync(join(source, names[0]!), exe); writeFileSync(join(source, names[2]!), 'synthetic installer');
  writeFileSync(join(source, names[3]!), readme);
  writeFileSync(join(source, names[1]!), zip([[names[0]!, exe], ['README.txt', readme]]));
  const digests = Object.fromEntries(names.map(name => [name, sha(readFileSync(join(source, name)))]));
  const ownership = await owned(store, manifest, head, version, 'synthetic-private-resource', target, 'owned');
  const request = { head, version, sourceDirectory: source, source: { head, version, digests,
    qualification: { kind: 'synthetic' as const, keyFree: true, packagedCheck: true } },
    resource: { id: 'synthetic-private-resource', token: 'owned', targetDirectory: target, ownership }, profile: 'synthetic' as const };
  const receipt = await handoffBeta(store, manifest.id, request);
  assert.equal(receipt.public.qualified, false);
  assert.equal(receipt.public.qualificationKind, 'synthetic');
  assert.equal(JSON.stringify(receipt.public).includes(temp), false);
  assert.equal(receipt.private.targetDirectory, target);
  assert.deepEqual(await handoffBeta(store, manifest.id, request), receipt);
  assert.deepEqual(JSON.parse(readFileSync(join(target, 'latest-build.json'), 'utf8')).version, version);
  assert.ok(names.every(name => existsSync(join(target, name))));
  assert.throws(() => prepareVersionRecords(root, { version: '0.5.0-beta.100', runId: manifest.id, repository: manifest.repository, previousVersion: version }), { code: 'version_record_wait' });
});

test('transfer rejects wrong provenance and wrong archived bytes without completing latest', async t => {
  const { temp, store, manifest } = fixture(t);
  const version = '0.5.0-beta.8', head = 'b'.repeat(40), source = join(temp, 'source'), target = join(temp, 'target'); mkdirSync(source); mkdirSync(target);
  const exe = Buffer.from('exe'), readme = Buffer.from('readme');
  const names = [`SC-v${version}.exe`, `SC-v${version}.zip`, `SC-Setup-v${version}.exe`, 'README.txt'];
  writeFileSync(join(source, names[0]!), exe); writeFileSync(join(source, names[2]!), 'installer'); writeFileSync(join(source, names[3]!), readme);
  writeFileSync(join(source, names[1]!), zip([[names[0]!, Buffer.from('bad')], ['README.txt', readme]]));
  const digests = Object.fromEntries(names.map(name => [name, sha(readFileSync(join(source, name)))]));
  const ownership = await owned(store, manifest, head, version, 'synthetic', target, 'owned');
  const request = { head, version, sourceDirectory: source, source: { head, version, digests,
    qualification: { kind: 'synthetic' as const, keyFree: true, packagedCheck: true } },
    resource: { id: 'synthetic', token: 'owned', targetDirectory: target, ownership }, profile: 'synthetic' as const };
  await assert.rejects(handoffBeta(store, manifest.id, request), { code: 'invalid_archive' });
  assert.equal(existsSync(join(target, 'latest-build.json')), false);
  await assert.rejects(handoffBeta(store, manifest.id, { ...request, head: 'c'.repeat(40) }), { code: 'invalid_source' });
  await assert.rejects(handoffBeta(store, manifest.id, { ...request, version: '0.5.0-beta.9' }), { code: 'invalid_source' });
  await assert.rejects(handoffBeta(store, manifest.id, { ...request, source: { ...request.source, digests: { ...digests, [names[0]!]: '0'.repeat(64) } } }), { code: 'invalid_source' });
  for (const entries of [
    [['../escape', exe], ['README.txt', readme]],
    [[names[0]!, exe], [names[0]!, exe]],
    [[names[0]!, exe], ['README.txt', readme], ['extra.txt', Buffer.from('extra')]]
  ] as [string, Buffer][][]) {
    writeFileSync(join(source, names[1]!), zip(entries));
    const archiveDigests = { ...digests, [names[1]!]: sha(readFileSync(join(source, names[1]!))) };
    await assert.rejects(handoffBeta(store, manifest.id,
      { ...request, source: { ...request.source, digests: archiveDigests } }), { code: 'invalid_archive' });
  }
});

test('real profile waits by default even with synthetic portable evidence', async t => {
  const { temp, store, manifest } = fixture(t);
  await assert.rejects(handoffBeta(store, manifest.id, { profile: 'real', head: 'a'.repeat(40), version: '0.5.0-beta.8', sourceDirectory: temp,
    source: { head: 'a'.repeat(40), version: '0.5.0-beta.8', digests: {}, qualification: { kind: 'synthetic', keyFree: true, packagedCheck: true } },
    resource: { id: 'real', token: 'owned', targetDirectory: join(temp, 'target'), ownership: {} as never } }), { code: 'beta_capability_unavailable' });
});

test('partial transfer reconciles and lost acknowledgement reuses verified bytes', async t => {
  const { temp, store, manifest } = fixture(t);
  const version = '0.5.0-beta.8', head = 'c'.repeat(40), source = join(temp, 'source'), target = join(temp, 'target');
  mkdirSync(source); mkdirSync(target);
  const exe = Buffer.from('exe'), readme = Buffer.from('readme');
  const names = [`SC-v${version}.exe`, `SC-v${version}.zip`, `SC-Setup-v${version}.exe`, 'README.txt'];
  writeFileSync(join(source, names[0]!), exe); writeFileSync(join(source, names[1]!), zip([[names[0]!, exe], ['README.txt', readme]]));
  writeFileSync(join(source, names[2]!), 'installer'); writeFileSync(join(source, names[3]!), readme);
  const digests = Object.fromEntries(names.map(name => [name, sha(readFileSync(join(source, name)))]));
  const ownership = await owned(store, manifest, head, version, 'owned', target, 'token');
  const request = { profile: 'synthetic' as const, head, version, sourceDirectory: source,
    source: { head, version, digests, qualification: { kind: 'synthetic' as const, keyFree: true, packagedCheck: true } },
    resource: { id: 'owned', token: 'token', targetDirectory: target, ownership } };
  writeFileSync(join(target, names[2]!), 'conflicting installer');
  await assert.rejects(handoffBeta(store, manifest.id, request), { code: 'transfer_conflict' });
  assert.ok(existsSync(join(target, names[0]!)));
  assert.equal(existsSync(join(target, 'latest-build.json')), false);
  rmSync(join(target, names[2]!));
  const receipt = await handoffBeta(store, manifest.id, request);
  assert.equal(receipt.public.status, 'transferred');
  const before = readFileSync(join(target, names[0]!));
  const db = new Database(join(store.directory, 'journal.sqlite'));
  db.prepare("UPDATE operations SET state='unknown',receipt=NULL WHERE run_id=? AND key=?")
    .run(manifest.id, `beta:${head}:${version}`);
  db.close();
  assert.deepEqual(await handoffBeta(store, manifest.id, request), receipt);
  assert.deepEqual(readFileSync(join(target, names[0]!)), before);
  assert.equal(JSON.parse(readFileSync(join(target, 'latest-build.json'), 'utf8')).version, version);
  writeFileSync(join(target, 'latest-build.json'), JSON.stringify({ ...receipt.public, head: 'd'.repeat(40), filenames: names }));
  await assert.rejects(handoffBeta(store, manifest.id, request), { code: 'transfer_mismatch' });
});

test('transfer rejects absent ownership and changed token or target', async t => {
  const { temp, store, manifest } = fixture(t);
  const version = '0.5.0-beta.8', head = 'd'.repeat(40), source = join(temp, 'source'), target = join(temp, 'target');
  mkdirSync(source); mkdirSync(target);
  const exe = Buffer.from('exe'), readme = Buffer.from('readme');
  const names = [`SC-v${version}.exe`, `SC-v${version}.zip`, `SC-Setup-v${version}.exe`, 'README.txt'];
  writeFileSync(join(source, names[0]!), exe); writeFileSync(join(source, names[1]!), zip([[names[0]!, exe], ['README.txt', readme]]));
  writeFileSync(join(source, names[2]!), 'installer'); writeFileSync(join(source, names[3]!), readme);
  const digests = Object.fromEntries(names.map(name => [name, sha(readFileSync(join(source, name)))]));
  const ownership = { repository: manifest.repository, runId: manifest.id, head, version,
    profile: 'synthetic' as const, id: 'owned', targetDirectory: target, tokenHash: sha('token'), state: 'owned' as const };
  const request = { profile: 'synthetic' as const, head, version, sourceDirectory: source,
    source: { head, version, digests, qualification: { kind: 'synthetic' as const, keyFree: true, packagedCheck: true } },
    resource: { id: 'owned', token: 'token', targetDirectory: target, ownership } };
  await assert.rejects(handoffBeta(store, manifest.id, request), { code: 'resource_unowned' });
  await owned(store, manifest, head, version, 'owned', target, 'token');
  await assert.rejects(handoffBeta(store, manifest.id, { ...request, resource: { ...request.resource, token: 'different' } }),
    { code: 'resource_unowned' });
  await assert.rejects(handoffBeta(store, manifest.id, { ...request, resource: { ...request.resource, targetDirectory: join(temp, 'other') } }),
    { code: 'resource_unowned' });
  assert.equal((await handoffBeta(store, manifest.id, request)).public.status, 'transferred');
  await assert.rejects(handoffBeta(store, manifest.id, { ...request, resource: { ...request.resource, token: 'different' } }),
    { code: 'resource_unowned' });
});

function zip(entries: [string, Buffer][]): Buffer {
  const locals: Buffer[] = [], centrals: Buffer[] = []; let offset = 0;
  for (const [name, bytes] of entries) {
    const filename = Buffer.from(name), crc = crc32(bytes);
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4); local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(bytes.length, 18); local.writeUInt32LE(bytes.length, 22); local.writeUInt16LE(filename.length, 26);
    locals.push(local, filename, bytes);
    const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6);
    central.writeUInt32LE(crc, 16); central.writeUInt32LE(bytes.length, 20); central.writeUInt32LE(bytes.length, 24);
    central.writeUInt16LE(filename.length, 28); central.writeUInt32LE(offset, 42);
    centrals.push(central, filename); offset += local.length + filename.length + bytes.length;
  }
  const centralBytes = Buffer.concat(centrals), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBytes.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralBytes, end]);
}
function crc32(bytes: Buffer): number {
  let crc = -1; for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0); }
  return (crc ^ -1) >>> 0;
}
