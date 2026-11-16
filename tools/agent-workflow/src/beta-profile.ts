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
import { durableJson, inspectOwnedProcess, MAX_PROCESS_TIMEOUT_MS, reconcileOwnedProcess, runOwnedProcess, validateOwnedProcessRequest } from './process.js';
import type { BetaEnvironmentRetryBinding, BetaLaunchBinding, BetaPrelaunchBinding, RunStore } from './store.js';
import { trustedBetaHelperEnvironment } from './beta-environment.js';

const sha = (value: Buffer | string): string => createHash('sha256').update(value).digest('hex');
const identifier = z.string().regex(/^[A-Za-z0-9_-]{1,100}$/);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const absolute = z.string().max(4000).refine(isAbsolute);
export const MAX_BETA_PROFILE_MS = MAX_PROCESS_TIMEOUT_MS;
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
    return { ...profile, name, hash: digest(identity), token, identity };
  } catch (error) {
    if (error instanceof WorkflowError) throw error;
    return unavailable();
  }
}
export function selectBetaProfile(name: string, stateDirectory: string): { name: string; hash: string } {
  const profile = loadProfile(name, stateDirectory);
  return { name: profile.name, hash: profile.hash };
}

interface ConfiguredBetaRequest {
  store: RunStore; runId: string; workspace: string; head: string; version: string; signal?: AbortSignal;
}
function configuredBetaProcess(request: ConfiguredBetaRequest, environment: 'legacy' | 'effective-user-v1' = 'legacy') {
  const { store, runId, workspace, head, version } = request;
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
  const env = environment === 'legacy' ? { PATH: '/usr/bin:/bin', HOME: homedir() } : trustedBetaHelperEnvironment();
  const identity = { repository: manifest.repository, runId, workspace: realpathSync(workspace), head, version,
    profileHash: profile.hash, sourceManifestDigest, ...(environment === 'legacy' ? {} : {
      processEnvironment: { version: 'effective-user-v1' as const, principal: env.USER!, digest: digest(env) } }) };
  const key = `beta-process:${digest(identity)}`, runDirectory = join(store.directory, 'runs', runId);
  const processDirectory = join(runDirectory, 'processes'), receiptDirectory = join(runDirectory, 'beta', digest(identity));
  const helperRequest = { version: 1, repository: manifest.repository, runId, workspace: identity.workspace, head,
    candidateVersion: version, environmentId: profile.environmentId, sourceManifestDigest, receiptDirectory };
  const requestPath = join(receiptDirectory, 'request.json');
  const processRequest = { stateDirectory: processDirectory, key, command: '/usr/bin/node',
    args: [profile.helperPath, '--request', requestPath], cwd: receiptDirectory,
    env, timeoutMs: profile.timeoutMs };
  return { manifest, profile, current, sourceManifestDigest, identity, key, processDirectory,
    receiptDirectory, helperRequest, requestPath, processRequest };
}

function selectedBetaProcess(request: ConfiguredBetaRequest) {
  const legacy = configuredBetaProcess(request), run = request.store.get(request.runId);
  const history = run.data.betaEnvironmentRetryHistory as { binding?: BetaEnvironmentRetryBinding }[] | undefined;
  if (history !== undefined) {
    const next = configuredBetaProcess(request, 'effective-user-v1');
    const binding = history.length === 1 && history[0]?.binding;
    if (!binding || !isDeepStrictEqual(binding.legacy.identity, legacy.identity) ||
        !isDeepStrictEqual(binding.next.identity, next.identity) ||
        !isDeepStrictEqual(binding.next.processRequest, next.processRequest)) unavailable();
    return next;
  }
  const known = request.store.ownedProcesses(request.runId).filter(entry => entry.key.startsWith('beta-process:'));
  if (known.some(entry => entry.key === legacy.key)) {
    if (known.some(entry => entry.key !== legacy.key)) unavailable();
    return legacy;
  }
  const next = configuredBetaProcess(request, 'effective-user-v1');
  if (known.some(entry => entry.key !== next.key)) unavailable();
  return next;
}

const legacyPrelaunchPolicy = '484f45673e1c96edaadf73bf0b5651565db5e5e06e9ccb9c09e1e01a7654d391';
const legacyPrelaunchSources = {
  'tools/agent-workflow/src/process.ts': '988ceace868529569cee8856b58574300e981a4c',
  'tools/agent-workflow/src/beta-profile.ts': '6a05c37e6a4ea2004731e18dba53b27dec792c86',
  'tools/agent-workflow/src/store.ts': '0ae175a6cb346d32d2fe6c352cf32f7c9352de56'
};

/** Read-only binding inspection; baseline bytes explain rejection, not the historical runtime's execution identity. */
export function inspectRejectedBetaLaunch(store: RunStore, runId: string): BetaPrelaunchBinding {
  const run = store.get(runId), data = run.data;
  const allocation = data.allocation as { path?: unknown } | undefined;
  const frozen = data.frozen as { head?: unknown } | undefined;
  const reservation = (data.versionPreparation as { reservation?: { repository?: unknown; runId?: unknown; version?: unknown } } | undefined)?.reservation;
  const denied = () => new WorkflowError('beta_prelaunch_retry_denied', 'Only the retained, source-bound beta prelaunch rejection can be prepared again.', 2);
  if (run.manifest.policyHash !== legacyPrelaunchPolicy || typeof allocation?.path !== 'string' ||
      typeof frozen?.head !== 'string' || reservation?.repository !== run.manifest.repository ||
      reservation.runId !== runId || typeof reservation.version !== 'string') throw denied();
  const context = configuredBetaProcess({ store, runId, workspace: allocation.path, head: frozen.head, version: reservation.version });
  if (context.profile.timeoutMs <= 7_200_000 || context.profile.timeoutMs > 9_000_000) throw denied();
  requireFrozenSource(run.manifest, run.manifest.root, run.manifest.base);
  try {
    for (const [path, expected] of Object.entries(legacyPrelaunchSources)) {
      const observed = execFileSync('/usr/bin/git', ['--no-replace-objects', '-C', run.manifest.root,
        'rev-parse', `${run.manifest.base}:${path}`], { encoding: 'utf8', timeout: 10_000, stdio: ['ignore', 'pipe', 'pipe'],
        env: { PATH: '/usr/bin:/bin', HOME: '/dev/null', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' } }).trim();
      if (observed !== expected) throw denied();
      execFileSync('/usr/bin/git', ['--no-replace-objects', '-C', run.manifest.root, 'cat-file', '-e', `${observed}^{blob}`],
        { timeout: 10_000, stdio: 'ignore', env: { PATH: '/usr/bin:/bin', HOME: '/dev/null', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' } });
    }
    privateDirectory(context.receiptDirectory);
    if (privateFile(context.requestPath, 64_000).toString('utf8') !== JSON.stringify(context.helperRequest)) throw denied();
    validateOwnedProcessRequest(context.processRequest);
    context.current();
  } catch { throw denied(); }
  return { identity: context.identity, processRequest: context.processRequest, helperRequest: context.helperRequest,
    legacySourceBlobs: { ...legacyPrelaunchSources }, historicalRuntimeIdentity: 'not-attested-by-source-blobs' };
}

const observedResult = z.object({ status: z.literal('exited'), exitCode: z.literal(2), signal: z.null(),
  stdout: z.string().max(64_000), stderr: z.string().max(64_000), outputTruncated: z.literal(false),
  elapsedMs: z.number().int().nonnegative().max(5000) }).strict();
const preflightEvidence = z.object({ version: z.literal(1), reason: z.literal('vbox-user-environment-preflight'),
  repository: z.string().max(300), runId: z.uuid(), manifestHash: hash, head: z.string().regex(/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/),
  candidateVersion: z.string().max(100), profile: z.object({ name: identifier.max(80), hash, helperHash: hash, nodeHash: hash, tokenHash: hash }).strict(),
  oldProcess: z.object({ key: z.string().max(200), requestHash: hash, requestFileHash: hash, receiptDigest: hash, result: observedResult }).strict(),
  preflight: z.object({ phase: z.literal('host-discovery'), warning: z.literal('vbox-effective-user-environment'),
    rawOutputRows: z.literal(2), runningVmRows: z.literal(1), credentialLookupReached: z.literal(false),
    guestAuthenticationReached: z.literal(false), guestReadinessReached: z.literal(false), guestScriptReached: z.literal(false),
    guestStageCreated: z.literal(false), applicationTestsStarted: z.literal(false), qualificationStarted: z.literal(false), claimStageSet: z.literal(false) }).strict(),
  postflight: z.object({ protectedStateUnchanged: z.literal(true), snapshotsUnchanged: z.literal(true), resourceClean: z.literal(true),
    vmState: z.literal('poweroff'), guestApplications: z.literal(0), guestTestJobs: z.literal(0), heldKeys: z.literal(0) }).strict(),
  artifacts: z.array(z.object({ kind: z.enum(['helper-failure', 'host-discovery', 'process', 'postflight']), path: absolute, sha256: hash }).strict()).min(4).max(20)
}).strict();

/** Facts grant no resources; only the explicit retry CLI action admits one separately authorized repair. */
export function inspectBetaEnvironmentRetry(store: RunStore, runId: string, evidencePath: string): BetaEnvironmentRetryBinding {
  const denied = () => new WorkflowError('beta_environment_retry_denied', 'Exact private evidence of the host-only effective-user preflight failure is required.', 2);
  try {
    const run = store.get(runId), data = run.data;
    const allocation = data.allocation as { path?: unknown } | undefined;
    const frozen = data.frozen as { head?: unknown } | undefined;
    const reservation = (data.versionPreparation as { reservation?: { version?: unknown } } | undefined)?.reservation;
    if (typeof allocation?.path !== 'string' || typeof frozen?.head !== 'string' || typeof reservation?.version !== 'string') throw denied();
    const request = { store, runId, workspace: allocation.path, head: frozen.head, version: reservation.version };
    const legacy = configuredBetaProcess(request), next = configuredBetaProcess(request, 'effective-user-v1');
    requireFrozenSource(run.manifest, run.manifest.root, run.manifest.base);
    const bytes = privateFile(evidencePath, 131_072), evidence = preflightEvidence.parse(JSON.parse(bytes.toString('utf8')));
    const expectedProfile = { name: legacy.profile.name, hash: legacy.profile.hash, helperHash: legacy.profile.identity.helperHash,
      nodeHash: legacy.profile.identity.nodeHash, tokenHash: legacy.profile.identity.tokenHash };
    const observed = store.observedEffect(runId, legacy.key), execution = inspectOwnedProcess(legacy.processDirectory, legacy.key);
    if (evidence.repository !== run.manifest.repository || evidence.runId !== runId || evidence.manifestHash !== digest(run.manifest) ||
        evidence.head !== frozen.head || evidence.candidateVersion !== reservation.version || !isDeepStrictEqual(evidence.profile, expectedProfile) ||
        observed?.kind !== 'process' || observed.requestHash !== digest(legacy.identity) || evidence.oldProcess.key !== legacy.key ||
        evidence.oldProcess.requestHash !== observed.requestHash || evidence.oldProcess.receiptDigest !== digest(observed.receipt) ||
        !isDeepStrictEqual(evidence.oldProcess.result, observed.receipt) || execution.state !== 'exited' ||
        !isDeepStrictEqual(execution.result, observed.receipt)) throw denied();
    const saved = privateFile(join(legacy.processDirectory, digest(legacy.key), 'request.json'), 1_000_000);
    const { key, command, args, cwd, env, timeoutMs } = legacy.processRequest;
    if (sha(saved) !== evidence.oldProcess.requestFileHash || !isDeepStrictEqual(JSON.parse(saved.toString('utf8')),
      { key, command, args, cwd, env, timeoutMs })) throw denied();
    const texts: string[] = [];
    for (const artifact of evidence.artifacts) {
      const value = privateFile(artifact.path, 2_000_000);
      if (sha(value) !== artifact.sha256) throw denied();
      if (['helper-failure', 'host-discovery'].includes(artifact.kind)) texts.push(value.toString('utf8'));
    }
    if (new Set(evidence.artifacts.map(item => item.kind)).size !== 4 ||
        !texts.some(text => text.includes('LOGNAME') && text.includes('USER') && /effective (?:user )?(?:id|uid)/i.test(text))) throw denied();
    privateDirectory(legacy.receiptDirectory);
    if (privateFile(legacy.requestPath, 64_000).toString('utf8') !== JSON.stringify(legacy.helperRequest)) throw denied();
    validateOwnedProcessRequest(legacy.processRequest);
    legacy.current(); next.current();
    const bind = (context: ReturnType<typeof configuredBetaProcess>): BetaLaunchBinding => ({
      identity: context.identity, processRequest: context.processRequest, helperRequest: context.helperRequest });
    return { legacy: bind(legacy), next: bind(next), evidencePath, evidenceDigest: sha(bytes), evidence };
  } catch { throw denied(); }
}

export async function qualifyConfiguredBeta(request: ConfiguredBetaRequest): Promise<BetaReceipt> {
  const { store, runId, workspace, head, version, signal } = request;
  const { manifest, profile, current, sourceManifestDigest, identity, key, processDirectory,
    receiptDirectory, helperRequest, requestPath, processRequest } = selectedBetaProcess(request);
  signal?.throwIfAborted(); privateDirectory(receiptDirectory, true);
  if (existsSync(requestPath)) {
    if (privateFile(requestPath, 64_000).toString('utf8') !== JSON.stringify(helperRequest)) unavailable();
  } else durableJson(requestPath, helperRequest);
  store.registerOwnedProcess(runId, key, processDirectory);
  const result = await store.effect(runId, key, 'process', identity, {
    beforeExecute: async () => {
      current(); requireFrozenSource(manifest, workspace, head); signal?.throwIfAborted();
      if (identity.processEnvironment && !isDeepStrictEqual(processRequest.env, trustedBetaHelperEnvironment())) unavailable();
      validateOwnedProcessRequest(processRequest);
    },
    execute: () => runOwnedProcess({ ...processRequest, signal }),
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
