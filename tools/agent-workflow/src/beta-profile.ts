import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import { handoffBeta, type BetaReceipt, type BetaResourceOwnership, type WindowsBetaQualification } from './delivery.js';
import { requireFrozenSource } from './intake.js';
import { digest, WorkflowError } from './manifest.js';
import { durableJson, inspectOwnedProcess, reconcileOwnedProcess, runOwnedProcess } from './process.js';
import type { RunStore } from './store.js';

const sha = (value: Buffer | string): string => createHash('sha256').update(value).digest('hex');
const identifier = z.string().regex(/^[A-Za-z0-9_-]{1,100}$/);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const absolute = z.string().max(4000).refine(isAbsolute);
export const MAX_BETA_PROFILE_MS = 9_000_000;
const profileSchema = z.object({ version: z.literal(1), environmentId: identifier,
  targetDirectory: absolute, helperPath: absolute.refine(path => path.endsWith('.mjs')),
  timeoutMs: z.number().int().positive().max(MAX_BETA_PROFILE_MS), resourceTokenFile: absolute }).strict();
const check = z.object({ exitCode: z.literal(0), evidenceDigest: hash }).strict();
const qualificationSchema = z.object({ repository: z.string().max(300), runId: z.uuid(), head: z.string().regex(/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/),
  version: z.string().regex(/^\d+\.\d+\.\d+-beta\.\d+$/), environmentId: identifier,
  sourceDirectory: absolute, sourceManifestDigest: hash, digests: z.record(z.string().max(200), hash),
  checks: z.object({ verify: check, native: check, vault: check, ui: check, packaged: check }).strict(),
  keyFree: z.literal(true), protectedStateUnchanged: z.literal(true), cleanup: z.literal(true), state: z.literal('qualified') }).strict();
function unavailable(): never {
  throw new WorkflowError('beta_capability_unavailable', 'The configured Windows beta capability or its exact observed proof is unavailable.', 2);
}
function canonical(path: string): string {
  if (!isAbsolute(path) || resolve(path) !== path) unavailable();
  const parts: string[] = []; let parent = path;
  while (!existsSync(parent)) { parts.unshift(basename(parent)); parent = dirname(parent); }
  const result = resolve(realpathSync(parent), ...parts);
  if (result !== path) unavailable();
  return result;
}
function outsideGit(path: string): void {
  let directory = existsSync(path) && lstatSync(path).isDirectory() ? path : dirname(path);
  while (!existsSync(directory)) directory = dirname(directory);
  try {
    const result = execFileSync('/usr/bin/git', ['-C', directory, 'rev-parse', '--is-inside-work-tree', '--is-inside-git-dir'],
      { encoding: 'utf8', timeout: 10_000, stdio: ['ignore', 'pipe', 'pipe'], env: {
        PATH: '/usr/bin:/bin', HOME: '/dev/null', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null'
      } });
    if (result.split(/\s+/).includes('true')) unavailable();
  } catch (error) {
    if (error instanceof WorkflowError) throw error;
    if ((error as { status?: number }).status !== 128) unavailable();
  }
}
function privateDirectory(path: string, create = false): void {
  canonical(path);
  if (create) mkdirSync(path, { recursive: true, mode: 0o700 });
  const info = lstatSync(path);
  if (!info.isDirectory() || info.isSymbolicLink() || info.mode & 0o077 || process.getuid && info.uid !== process.getuid()) unavailable();
}
function privateFile(path: string, maximum: number): Buffer {
  canonical(path); outsideGit(path);
  const info = lstatSync(path);
  if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1 || info.mode & 0o077 || !info.size || info.size > maximum ||
      process.getuid && info.uid !== process.getuid()) unavailable();
  return readFileSync(path);
}
function loadProfile(name: string, stateDirectory: string) {
  try {
    identifier.max(80).parse(name); privateDirectory(stateDirectory); outsideGit(stateDirectory);
    const directory = join(stateDirectory, 'profiles'); privateDirectory(directory);
    const bytes = privateFile(join(directory, `${name}.json`), 64_000);
    const profile = profileSchema.parse(JSON.parse(bytes.toString('utf8')));
    const helperHash = sha(privateFile(profile.helperPath, 1_000_000));
    const token = privateFile(profile.resourceTokenFile, 4096).toString('utf8');
    if (!token.trim()) unavailable();
    canonical(profile.targetDirectory); outsideGit(profile.targetDirectory);
    if (existsSync(profile.targetDirectory) && !lstatSync(profile.targetDirectory).isDirectory()) unavailable();
    const node = realpathSync('/usr/bin/node'), info = lstatSync(node);
    if (!info.isFile() || info.mode & 0o022 || !(info.mode & 0o111) || info.size > 500_000_000) unavailable();
    const identity = { profileHash: sha(bytes), helperHash, node, nodeHash: sha(readFileSync(node)), tokenHash: sha(token) };
    return { ...profile, name, hash: digest(identity), token };
  } catch (error) {
    if (error instanceof WorkflowError) throw error;
    return unavailable();
  }
}
export function selectBetaProfile(name: string, stateDirectory: string): { name: string; hash: string } {
  const profile = loadProfile(name, stateDirectory);
  return { name: profile.name, hash: profile.hash };
}

export async function qualifyConfiguredBeta(request: {
  store: RunStore; runId: string; workspace: string; head: string; version: string; signal?: AbortSignal;
}): Promise<BetaReceipt> {
  const { store, runId, workspace, head, version, signal } = request;
  if (!/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(head) || !/^\d+\.\d+\.\d+-beta\.\d+$/.test(version)) unavailable();
  const manifest = store.get(runId).manifest, selection = manifest.betaProfile;
  if (!selection) unavailable();
  const current = () => {
    const loaded = loadProfile(selection.name, store.directory);
    if (loaded.hash !== selection.hash) throw new WorkflowError('beta_profile_changed', 'The selected Windows beta profile changed; explicit revalidation is required.', 2);
    return loaded;
  };
  const profile = current();
  requireFrozenSource(manifest, workspace, head);
  const git = (...args: string[]) => {
    try { return execFileSync('/usr/bin/git', ['-C', workspace, ...args], {
      encoding: 'utf8', timeout: 10_000, maxBuffer: 10_000_000, stdio: ['ignore', 'pipe', 'pipe'], env: {
        PATH: '/usr/bin:/bin', HOME: '/dev/null', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null'
      } }); }
    catch { return unavailable(); }
  };
  try { if ((JSON.parse(git('show', `${head}:desktop/package.json`)) as { version?: unknown }).version !== version) unavailable(); }
  catch { unavailable(); }
  const sourceManifestDigest = sha(git('ls-tree', '-r', '--full-tree', head));
  const identity = { repository: manifest.repository, runId, workspace: realpathSync(workspace), head, version,
    profileHash: profile.hash, sourceManifestDigest };
  const key = `beta-process:${digest(identity)}`, runDirectory = join(store.directory, 'runs', runId);
  const processDirectory = join(runDirectory, 'processes'), receiptDirectory = join(runDirectory, 'beta', digest(identity));
  signal?.throwIfAborted(); privateDirectory(receiptDirectory, true);
  const helperRequest = { version: 1, repository: manifest.repository, runId, workspace: identity.workspace, head,
    candidateVersion: version, environmentId: profile.environmentId, sourceManifestDigest, receiptDirectory };
  const requestPath = join(receiptDirectory, 'request.json');
  if (existsSync(requestPath)) {
    if (privateFile(requestPath, 64_000).toString('utf8') !== JSON.stringify(helperRequest)) unavailable();
  } else durableJson(requestPath, helperRequest);
  store.registerOwnedProcess(runId, key, processDirectory);
  const result = await store.effect(runId, key, 'process', identity, {
    beforeExecute: async () => { current(); requireFrozenSource(manifest, workspace, head); signal?.throwIfAborted(); },
    execute: () => runOwnedProcess({ stateDirectory: processDirectory, key, command: '/usr/bin/node',
      args: [profile.helperPath, '--request', requestPath], cwd: receiptDirectory,
      env: { PATH: '/usr/bin:/bin', HOME: homedir() }, timeoutMs: profile.timeoutMs, signal }),
    reconcile: async () => {
      try { return await reconcileOwnedProcess(processDirectory, key); }
      catch (error) { if (error instanceof WorkflowError && error.code === 'operation_not_found') return null; throw error; }
    }
  });
  current(); requireFrozenSource(manifest, workspace, head);
  const observed = store.observedEffect(runId, key), execution = inspectOwnedProcess(processDirectory, key);
  if (observed?.kind !== 'process' || observed.requestHash !== digest(identity) || !isDeepStrictEqual(observed.receipt, result) ||
      execution.state !== 'exited' || !isDeepStrictEqual(execution.result, result) || result.status !== 'exited' || result.exitCode !== 0 ||
      result.outputTruncated || Buffer.byteLength(result.stdout) > 64_000 || result.stderr.trim()) unavailable();
  let proof: WindowsBetaQualification;
  try { proof = qualificationSchema.parse(JSON.parse(result.stdout)); }
  catch { unavailable(); }
  const expectedNames = [`SC-v${version}.exe`, `SC-v${version}.zip`, `SC-Setup-v${version}.exe`, 'README.txt'];
  if (proof.repository !== manifest.repository || proof.runId !== runId || proof.head !== head || proof.version !== version ||
      proof.environmentId !== profile.environmentId || proof.sourceManifestDigest !== sourceManifestDigest ||
      Object.keys(proof.digests).sort().join('|') !== expectedNames.sort().join('|')) unavailable();
  try { privateDirectory(proof.sourceDirectory); outsideGit(proof.sourceDirectory); }
  catch { unavailable(); }
  await store.effect(runId, `beta-qualification:${head}:${version}`, 'beta-qualification', proof,
    { execute: async () => proof, reconcile: async () => proof });
  const ownership: BetaResourceOwnership = { repository: manifest.repository, runId, head, version,
    profile: 'real', id: profile.environmentId, targetDirectory: profile.targetDirectory, tokenHash: sha(profile.token), state: 'owned' };
  await store.effect(runId, `beta-resource:${head}:${version}`, 'beta-resource', ownership,
    { execute: async () => ownership, reconcile: async () => ownership });
  current(); requireFrozenSource(manifest, workspace, head);
  return handoffBeta(store, runId, { profile: 'real', head, version, sourceDirectory: proof.sourceDirectory,
    source: { head, version, digests: proof.digests, qualification: { kind: 'windows', keyFree: true, packagedCheck: true } },
    windowsQualification: proof, resource: { id: profile.environmentId, token: profile.token,
      targetDirectory: profile.targetDirectory, ownership } });
}
