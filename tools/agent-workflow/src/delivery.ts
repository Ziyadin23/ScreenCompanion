import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, existsSync, linkSync, lstatSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { open, stat, copyFile } from 'node:fs/promises';
import { basename, isAbsolute, join } from 'node:path';
import { createInflateRaw } from 'node:zlib';
import { isDeepStrictEqual } from 'node:util';
import { digest, WorkflowError } from './manifest.js';
import type { RunStore } from './store.js';

export interface VersionReservation { repository: string; runId: string; previousVersion: string; version: string }
export interface VersionChange { path: string; before: string; after: string; mode: '100644' }
export interface PreparedVersion { changes: VersionChange[]; versionRecords: Record<string, string>; reservation: VersionReservation }
const beta = /^(\d+)\.(\d+)\.(\d+)-beta\.(\d+)$/;

export interface ReleaseInventory { repository: string; complete: true; versions: string[] }
export function reserveCandidateVersion(store: RunStore, runId: string, options: { releaseInventory?: ReleaseInventory } = {}): VersionReservation {
  const manifest = store.get(runId).manifest;
  const previousVersion = JSON.parse(readFileSync(join(manifest.root, 'desktop/package.json'), 'utf8'))?.version as string;
  const inventory = options.releaseInventory;
  if (inventory && (inventory.complete !== true || inventory.repository !== manifest.repository ||
      !Array.isArray(inventory.versions)))
    throw new WorkflowError('release_inventory_wait', 'Complete release inventory does not match this repository.', 2);
  const reserved = store.reserveCandidateVersion(runId, previousVersion, inventory?.versions);
  return { repository: manifest.repository, runId, ...reserved };
}

function replaceOnce(text: string, from: string, to: string): string {
  if (text.split(from).length !== 2) throw new WorkflowError('version_record_wait', 'Required current-version record is ambiguous.', 2);
  return text.replace(from, to);
}
function assertUniqueVersionRecord(text: string, markers: string[]): void {
  const count = markers.reduce((total, marker) => total + text.split(marker).length - 1, 0);
  if (count !== 1) throw new WorkflowError('version_record_wait', 'Current-version record is unknown or ambiguous.', 2);
}
function versionJson(before: string, path: string, reservation: VersionReservation): string {
  const parsed = JSON.parse(before) as Record<string, unknown>;
  if (parsed.version !== reservation.previousVersion) throw new WorkflowError('version_record_wait', 'Desktop version records disagree.', 2);
  if (path === 'desktop/package-lock.json') {
    const packages = parsed.packages as Record<string, Record<string, unknown>> | undefined;
    if (packages?.['']?.version !== reservation.previousVersion) throw new WorkflowError('version_record_wait', 'Root lockfile version disagrees.', 2);
  }
  const old = `"version": "${reservation.previousVersion}"`, next = `"version": "${reservation.version}"`;
  const compactOld = `"version":"${reservation.previousVersion}"`, compactNext = `"version":"${reservation.version}"`;
  const expected = path === 'desktop/package-lock.json' ? 2 : 1;
  const count = before.split(old).length - 1 + before.split(compactOld).length - 1;
  if (count !== expected) throw new WorkflowError('version_record_wait', 'Manifest version fields are ambiguous.', 2);
  const after = before.replaceAll(old, next).replaceAll(compactOld, compactNext);
  const expectedObject = structuredClone(parsed);
  expectedObject.version = reservation.version;
  if (path === 'desktop/package-lock.json')
    (expectedObject.packages as Record<string, Record<string, unknown>>)['']!.version = reservation.version;
  if (!isDeepStrictEqual(JSON.parse(after), expectedObject))
    throw new WorkflowError('version_record_wait', 'Version text does not identify the approved root fields.', 2);
  return after;
}
function versionDocument(before: string, path: string, reservation: VersionReservation): string {
  const old = reservation.previousVersion, next = reservation.version;
  if (path === 'README.md') {
    assertUniqueVersionRecord(before, ['| Current source, unpublished |', 'The current source version is **']);
    if (before.includes('| Current source, unpublished |')) {
      return replaceOnce(before, `| Current source, unpublished | **${old}** |`,
        `| Current source, unpublished | **${next}** |`);
    }
    let result = replaceOnce(before, `The current source version is **${old}**, not yet published.`,
      `The current source version is **${next}**, not yet published.`);
    result = replaceOnce(result, `Build output: \`desktop/dist/SC-Setup-v${old}.exe\``,
      `Build output: \`desktop/dist/SC-Setup-v${next}.exe\``);
    return replaceOnce(result, `\`SC-v${old}.exe\` and its matching two-file ZIP`,
      `\`SC-v${next}.exe\` and its matching two-file ZIP`);
  }
  if (path === 'docs/PUBLISHING.md') {
    assertUniqueVersionRecord(before, ['The current source version is ']);
    return replaceOnce(before, `The current source version is ${old} and is unpublished.`,
      `The current source version is ${next} and is unpublished.`);
  }
  if (path === 'docs/STATUS.md') {
    assertUniqueVersionRecord(before, ['Source remains unpublished **', 'Application source is **']);
    if (before.includes('Source remains unpublished **')) {
      return replaceOnce(before, `Source remains unpublished **${old}**;`, `Source remains unpublished **${next}**;`);
    }
    return replaceOnce(before, `Application source is **${old}**;`, `Application source is **${next}**;`);
  }
  throw new WorkflowError('invalid_version_change', 'Unexpected version record.');
}
export function prepareVersionRecords(root: string, reservation: VersionReservation): PreparedVersion {
  const paths = ['desktop/package.json', 'desktop/package-lock.json', 'README.md', 'docs/PUBLISHING.md', 'docs/STATUS.md'];
  const changes = paths.map(path => {
    const before = readFileSync(join(root, path), 'utf8');
    const after = path.endsWith('.json') ? versionJson(before, path, reservation) : versionDocument(before, path, reservation);
    return { path, before, after, mode: '100644' as const };
  });
  validateVersionChanges(changes, reservation);
  return { changes, reservation, versionRecords: Object.fromEntries(changes.map(change => [change.path, digest(change.after)])) };
}
export function validateVersionChanges(changes: VersionChange[], reservation: VersionReservation): void {
  const paths = ['desktop/package.json', 'desktop/package-lock.json', 'README.md', 'docs/PUBLISHING.md', 'docs/STATUS.md'];
  if (changes.length !== paths.length || changes.some((change, index) => change.path !== paths[index] || change.mode !== '100644'))
    throw new WorkflowError('invalid_version_change', 'Version changes have unexpected paths or modes.');
  try {
    for (const change of changes) {
      const expected = change.path.endsWith('.json') ? versionJson(change.before, change.path, reservation) :
        versionDocument(change.before, change.path, reservation);
      if (change.after !== expected) throw new Error('Unexpected content change');
    }
  } catch { throw new WorkflowError('invalid_version_change', 'Version changes exceed approved fields or current records.'); }
}

export interface BetaRequest {
  profile: 'synthetic' | 'real'; head: string; version: string; sourceDirectory: string;
  source: { head: string; version: string; digests: Record<string, string>;
    qualification: { kind: 'synthetic' | 'windows'; keyFree: boolean; packagedCheck: boolean } };
  windowsQualification?: WindowsBetaQualification;
  resource: { id: string; token: string; targetDirectory: string; ownership: BetaResourceOwnership };
}
const WINDOWS_CHECKS = ['verify', 'native', 'vault', 'ui', 'packaged'] as const;
export interface WindowsBetaQualification {
  repository: string; runId: string; head: string; version: string; environmentId: string;
  sourceDirectory: string; sourceManifestDigest: string; digests: Record<string, string>;
  checks: Record<typeof WINDOWS_CHECKS[number], { exitCode: number; evidenceDigest: string }>;
  keyFree: boolean; protectedStateUnchanged: boolean; cleanup: boolean; state: 'qualified';
}
export interface BetaResourceOwnership {
  repository: string; runId: string; head: string; version: string; profile: 'synthetic' | 'real';
  id: string; targetDirectory: string; tokenHash: string; state: 'owned';
}
export interface BetaReceipt {
  public: { head: string; version: string; status: 'transferred'; digests: Record<string, string>;
    qualificationKind: 'synthetic' | 'windows'; qualified: boolean };
  private: { targetDirectory: string; latestRecord: string; resourceId: string; sourceDirectory: string };
}
const MAX_ARTIFACT = 1_000_000_000;
const namesFor = (version: string) => [`SC-v${version}.exe`, `SC-v${version}.zip`, `SC-Setup-v${version}.exe`, 'README.txt'];
async function fileHash(path: string): Promise<string> {
  const info = await stat(path);
  if (!info.isFile() || info.size === 0 || info.size > MAX_ARTIFACT || lstatSync(path).isSymbolicLink())
    throw new WorkflowError('invalid_source', 'Source artifact is absent, unsafe or oversized.');
  const hash = createHash('sha256'); for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}
function crcStep(crc: number, bytes: Buffer): number {
  for (const byte of bytes) { crc ^= byte; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0); }
  return crc;
}
async function exactArchive(path: string, expected: Record<string, string>, names: string[]): Promise<void> {
  const handle = await open(path, 'r');
  try {
    const size = (await handle.stat()).size;
    const tail = Buffer.alloc(Math.min(size, 65557)); await handle.read(tail, 0, tail.length, size - tail.length);
    let end = -1; for (let i = tail.length - 22; i >= 0; i--) if (tail.readUInt32LE(i) === 0x06054b50 &&
      i + 22 + tail.readUInt16LE(i + 20) === tail.length) { end = i; break; }
    if (end < 0 || tail.readUInt16LE(end + 4) || tail.readUInt16LE(end + 6) ||
        tail.readUInt16LE(end + 8) !== 2 || tail.readUInt16LE(end + 10) !== 2)
      throw new Error('Invalid ZIP directory');
    const length = tail.readUInt32LE(end + 12), start = tail.readUInt32LE(end + 16);
    if (length > 65536 || start + length !== size - tail.length + end) throw new Error('Invalid ZIP directory bounds');
    const central = Buffer.alloc(length); await handle.read(central, 0, length, start);
    let cursor = 0; const found = new Set<string>(); const spans: [number, number][] = [];
    for (let index = 0; index < 2; index++) {
      if (cursor + 46 > length || central.readUInt32LE(cursor) !== 0x02014b50) throw new Error('Invalid ZIP entry');
      const flags = central.readUInt16LE(cursor + 8), method = central.readUInt16LE(cursor + 10);
      const crc = central.readUInt32LE(cursor + 16), compressed = central.readUInt32LE(cursor + 20), plain = central.readUInt32LE(cursor + 24);
      const nameLength = central.readUInt16LE(cursor + 28), extra = central.readUInt16LE(cursor + 30), comment = central.readUInt16LE(cursor + 32);
      const localOffset = central.readUInt32LE(cursor + 42);
      if (cursor + 46 + nameLength + extra + comment > length || flags & ~0x808 || ![0, 8].includes(method) ||
          !compressed || compressed > MAX_ARTIFACT || !plain || plain > MAX_ARTIFACT || extra || comment ||
          central.readUInt16LE(cursor + 34) || central.readUInt32LE(cursor + 38)) throw new Error('Unsupported ZIP entry');
      const name = central.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8');
      if (!names.includes(name) || found.has(name) || basename(name) !== name || name.includes('\\')) throw new Error('Unexpected ZIP entry');
      found.add(name); cursor += 46 + nameLength;
      const local = Buffer.alloc(30); await handle.read(local, 0, 30, localOffset);
      if (local.readUInt32LE(0) !== 0x04034b50 || local.readUInt16LE(6) !== flags || local.readUInt16LE(8) !== method ||
          local.readUInt16LE(28) || local.readUInt16LE(26) !== nameLength) throw new Error('Invalid local ZIP entry');
      const localName = Buffer.alloc(nameLength); await handle.read(localName, 0, nameLength, localOffset + 30);
      if (localName.toString('utf8') !== name) throw new Error('ZIP names disagree');
      if (!(flags & 8) && (local.readUInt32LE(14) !== crc || local.readUInt32LE(18) !== compressed || local.readUInt32LE(22) !== plain))
        throw new Error('ZIP metadata disagrees');
      const dataStart = localOffset + 30 + nameLength, dataEnd = dataStart + compressed;
      if (dataEnd > start) throw new Error('ZIP entry overlaps directory');
      let entryEnd = dataEnd;
      if (flags & 8) {
        const descriptor = Buffer.alloc(16); await handle.read(descriptor, 0, 16, dataEnd);
        const signed = descriptor.readUInt32LE(0) === 0x08074b50, base = signed ? 4 : 0;
        if (descriptor.readUInt32LE(base) !== crc || descriptor.readUInt32LE(base + 4) !== compressed ||
            descriptor.readUInt32LE(base + 8) !== plain) throw new Error('ZIP descriptor disagrees');
        entryEnd += signed ? 16 : 12;
      }
      spans.push([localOffset, entryEnd]);
      const stream = createReadStream(path, { start: dataStart, end: dataEnd - 1 });
      const decoded = method === 8 ? stream.pipe(createInflateRaw()) : stream;
      const hash = createHash('sha256'); let actualCrc = -1, count = 0;
      for await (const chunk of decoded) { const bytes = Buffer.from(chunk); count += bytes.length;
        if (count > plain) throw new Error('ZIP entry grew beyond declared length');
        hash.update(bytes); actualCrc = crcStep(actualCrc, bytes); }
      if (count !== plain || (actualCrc ^ -1) >>> 0 !== crc || hash.digest('hex') !== expected[name])
        throw new Error('ZIP contents disagree with source');
    }
    spans.sort((a, b) => a[0] - b[0]);
    if (cursor !== length || found.size !== 2 || spans[0]?.[0] !== 0 || spans[1]?.[0] !== spans[0]?.[1] ||
        spans[1]?.[1] !== start) throw new Error('ZIP directory has extra content');
  } catch { throw new WorkflowError('invalid_archive', 'Portable ZIP does not match the exact EXE and README.'); }
  finally { await handle.close(); }
}
function atomicJson(path: string, value: unknown): void {
  atomicText(path, JSON.stringify(value));
}
function atomicText(path: string, value: string): void {
  const temporary = `${path}.${randomUUID()}.tmp`;
  try { writeFileSync(temporary, value, { mode: 0o600, flag: 'wx' }); renameSync(temporary, path); }
  finally { rmSync(temporary, { force: true }); }
}
function observedQualification(store: RunStore, runId: string, request: BetaRequest): WindowsBetaQualification {
  const proof = request.windowsQualification;
  const observed = store.observedEffect(runId, `beta-qualification:${request.head}:${request.version}`);
  if (!proof || proof.repository !== store.get(runId).manifest.repository || proof.runId !== runId ||
      proof.head !== request.head || proof.version !== request.version || proof.environmentId !== request.resource.id ||
      proof.sourceDirectory !== request.sourceDirectory || !isAbsolute(proof.sourceDirectory) ||
      !/^[a-f0-9]{64}$/.test(proof.sourceManifestDigest) || !isDeepStrictEqual(proof.digests, request.source.digests) ||
      proof.state !== 'qualified' || proof.keyFree !== true || proof.protectedStateUnchanged !== true || proof.cleanup !== true ||
      Object.keys(proof.checks ?? {}).sort().join('|') !== [...WINDOWS_CHECKS].sort().join('|') ||
      WINDOWS_CHECKS.some(name => proof.checks?.[name]?.exitCode !== 0 || !/^[a-f0-9]{64}$/.test(proof.checks?.[name]?.evidenceDigest ?? '')) ||
      observed?.kind !== 'beta-qualification' || observed.requestHash !== digest(proof) || !isDeepStrictEqual(observed.receipt, proof))
    throw new WorkflowError('beta_capability_unavailable', 'Exact observed Windows qualification is unavailable.', 2);
  return proof;
}
function targetNames(request: Pick<BetaRequest, 'version' | 'profile'>): string[] {
  return namesFor(request.version).map(name => request.profile === 'real' && name === 'README.txt' ? `SC-v${request.version}-README.txt` : name);
}
function latestText(receipt: BetaReceipt): string {
  return `SC ${receipt.public.version} — local verified beta\nSource: ${receipt.public.head}\nApplication release unpublished.\n\n` +
    Object.entries(receipt.public.digests).map(([name, hash]) => `${name}\nSHA-256: ${hash}\n`).join('\n') +
    '\nChecks: Windows verification, native and vault checks, full UI, isolated key-free packaged startup and cleanup.\n' +
    'Limits: Broader platform, recorder and live-provider qualification remain separate.\n';
}
async function validateCopiedReceipt(receipt: BetaReceipt, names: string[], real: boolean): Promise<void> {
  try {
    for (const name of names) if (await fileHash(join(receipt.private.targetDirectory, name)) !== receipt.public.digests[name])
      throw new Error('Copied bytes disagree');
    if (!existsSync(receipt.private.latestRecord) || !isDeepStrictEqual(
      JSON.parse(readFileSync(receipt.private.latestRecord, 'utf8')), { ...receipt.public, filenames: names }) ||
      real && (!existsSync(join(receipt.private.targetDirectory, 'SC-LATEST.txt')) ||
        readFileSync(join(receipt.private.targetDirectory, 'SC-LATEST.txt'), 'utf8') !== latestText(receipt)))
      throw new Error('Latest record disagrees');
  } catch { throw new WorkflowError('transfer_mismatch', 'Copied bytes or private latest-build records are missing or stale.'); }
}
export async function handoffBeta(store: RunStore, runId: string, request: BetaRequest): Promise<BetaReceipt> {
  const manifest = store.get(runId).manifest;
  const qualification = request.profile === 'real' ? observedQualification(store, runId, request) : undefined;
  if (!['synthetic', 'real'].includes(request.profile) || !/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(request.head) || !beta.test(request.version) ||
      request.source.head !== request.head || request.source.version !== request.version ||
      request.source.qualification.kind !== (request.profile === 'real' ? 'windows' : 'synthetic') || !request.source.qualification.keyFree ||
      !request.source.qualification.packagedCheck || !/^[A-Za-z0-9_-]{1,100}$/.test(request.resource.id) ||
      !request.resource.token || !isAbsolute(request.sourceDirectory) || !isAbsolute(request.resource.targetDirectory))
    throw new WorkflowError('invalid_source', 'Candidate source, version or qualification disagrees.');
  const ownership: BetaResourceOwnership = { repository: manifest.repository, runId, head: request.head,
    version: request.version, profile: request.profile, id: request.resource.id,
    targetDirectory: request.resource.targetDirectory, tokenHash: createHash('sha256').update(request.resource.token).digest('hex'),
    state: 'owned' };
  const observed = store.observedEffect(runId, `beta-resource:${request.head}:${request.version}`);
  if (!isDeepStrictEqual(request.resource.ownership, ownership) || observed?.kind !== 'beta-resource' ||
      observed.requestHash !== digest(ownership) || !isDeepStrictEqual(observed.receipt, ownership))
    throw new WorkflowError('resource_unowned', 'Private transfer ownership receipt does not match this candidate.', 2);
  const sourceNames = namesFor(request.version), names = targetNames(request);
  if (Object.keys(request.source.digests).sort().join('|') !== [...sourceNames].sort().join('|') ||
      sourceNames.some(name => !/^[a-f0-9]{64}$/.test(request.source.digests[name] ?? '')))
    throw new WorkflowError('invalid_source', 'Artifact digest inventory is incomplete.');
  const identity = { head: request.head, version: request.version, sourceDigests: request.source.digests,
    sourceDirectory: request.sourceDirectory, resource: ownership, profile: request.profile,
    ...(qualification ? { qualificationHash: digest(qualification) } : {}) };
  const validateSource = async () => {
    for (const name of sourceNames) if (await fileHash(join(request.sourceDirectory, name)) !== request.source.digests[name])
      throw new WorkflowError('invalid_source', 'Artifact hash disagrees with source provenance.');
    await exactArchive(join(request.sourceDirectory, sourceNames[1]!),
      { [sourceNames[0]!]: request.source.digests[sourceNames[0]!]!, 'README.txt': request.source.digests['README.txt']! }, [sourceNames[0]!, 'README.txt']);
  };
  await validateSource();
  const transfer = async (): Promise<BetaReceipt> => {
    await validateSource();
    mkdirSync(request.resource.targetDirectory, { recursive: true, mode: 0o700 });
    for (const [index, name] of names.entries()) {
      const sourceName = sourceNames[index]!, target = join(request.resource.targetDirectory, name), expected = request.source.digests[sourceName]!;
      if (existsSync(target)) {
        if (await fileHash(target) !== expected) throw new WorkflowError('transfer_conflict', 'Versioned transfer filename has different bytes.');
        continue;
      }
      const temporary = join(request.resource.targetDirectory, `.${name}.${randomUUID()}.tmp`);
      try { await copyFile(join(request.sourceDirectory, sourceName), temporary);
        if (await fileHash(temporary) !== expected) throw new WorkflowError('transfer_mismatch', 'Copied bytes disagree.');
        if (existsSync(target)) { if (await fileHash(target) !== expected) throw new WorkflowError('transfer_conflict', 'Versioned transfer conflict.'); }
        else {
          try { linkSync(temporary, target); }
          catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'EEXIST' || await fileHash(target) !== expected)
              throw new WorkflowError('transfer_conflict', 'Versioned transfer conflict.');
          }
        }
      } finally { rmSync(temporary, { force: true }); }
    }
    const digests = Object.fromEntries(names.map((name, index) => [name, request.source.digests[sourceNames[index]!]!]));
    for (const name of names) if (await fileHash(join(request.resource.targetDirectory, name)) !== digests[name])
      throw new WorkflowError('transfer_mismatch', 'Final copied bytes disagree.');
    const publicReceipt: BetaReceipt['public'] = { head: request.head, version: request.version, status: 'transferred',
      digests, qualificationKind: qualification ? 'windows' : 'synthetic', qualified: !!qualification };
    const latestRecord = join(request.resource.targetDirectory, 'latest-build.json');
    const receipt = { public: publicReceipt, private: { targetDirectory: request.resource.targetDirectory, latestRecord,
      resourceId: request.resource.id, sourceDirectory: request.sourceDirectory } };
    atomicJson(latestRecord, { ...publicReceipt, filenames: names });
    if (qualification) atomicText(join(request.resource.targetDirectory, 'SC-LATEST.txt'), latestText(receipt));
    return receipt;
  };
  const receipt = await store.effect(runId, `beta:${request.head}:${request.version}`, 'beta-transfer', identity,
    { execute: transfer, reconcile: transfer });
  await validateCopiedReceipt(receipt, names, !!qualification);
  return receipt;
}

export async function requireObservedBetaHandoff(store: RunStore, runId: string, head: string): Promise<BetaReceipt> {
  const receipt = store.get(runId).data.betaReceipt as BetaReceipt | undefined;
  if (!receipt || receipt.public?.head !== head || !beta.test(receipt.public.version) ||
      receipt.public.qualified !== true || receipt.public.qualificationKind !== 'windows')
    throw new WorkflowError('beta_capability_unavailable', 'Exact observed Windows handoff is unavailable.', 2);
  const qualification = store.observedEffect(runId, `beta-qualification:${head}:${receipt.public.version}`)?.receipt as WindowsBetaQualification | undefined;
  const ownership = store.observedEffect(runId, `beta-resource:${head}:${receipt.public.version}`);
  const resource = ownership?.receipt as BetaResourceOwnership | undefined;
  const observed = store.observedEffect(runId, `beta:${head}:${receipt.public.version}`);
  if (!qualification || !resource || ownership?.kind !== 'beta-resource' || ownership.requestHash !== digest(resource) ||
      resource.repository !== store.get(runId).manifest.repository || resource.runId !== runId || resource.head !== head ||
      resource.version !== receipt.public.version || resource.profile !== 'real' || resource.state !== 'owned' ||
      !/^[a-f0-9]{64}$/.test(resource.tokenHash) || resource.id !== receipt.private?.resourceId ||
      resource.targetDirectory !== receipt.private?.targetDirectory || !isAbsolute(resource.targetDirectory) ||
      receipt.private.latestRecord !== join(resource.targetDirectory, 'latest-build.json'))
    throw new WorkflowError('beta_capability_unavailable', 'Observed Windows handoff ownership is unavailable.', 2);
  const request: BetaRequest = { profile: 'real', head, version: receipt.public.version, sourceDirectory: receipt.private.sourceDirectory,
    source: { head, version: receipt.public.version, digests: qualification.digests,
      qualification: { kind: 'windows', keyFree: true, packagedCheck: true } }, windowsQualification: qualification,
    resource: { id: resource.id, token: '', targetDirectory: resource.targetDirectory, ownership: resource } };
  observedQualification(store, runId, request);
  const names = targetNames(request), sourceNames = namesFor(request.version);
  const digests = Object.fromEntries(names.map((name, index) => [name, qualification.digests[sourceNames[index]!]!]));
  const expectedPublic = { head, version: receipt.public.version, status: 'transferred', digests,
    qualificationKind: 'windows', qualified: true };
  const identity = { head, version: receipt.public.version, sourceDigests: qualification.digests,
    sourceDirectory: receipt.private.sourceDirectory, resource, profile: 'real', qualificationHash: digest(qualification) };
  if (!isDeepStrictEqual(receipt.public, expectedPublic) || observed?.kind !== 'beta-transfer' ||
      observed.requestHash !== digest(identity) || !isDeepStrictEqual(observed.receipt, receipt))
    throw new WorkflowError('beta_capability_unavailable', 'Exact observed Windows transfer is unavailable.', 2);
  await validateCopiedReceipt(receipt, names, true);
  return receipt;
}
