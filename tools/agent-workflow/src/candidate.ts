import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, readlinkSync, realpathSync, rmSync, type Stats } from 'node:fs';
import { userInfo } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { digest, WorkflowError, type Manifest } from './manifest.js';
import { classifyDiff, requiredChecks, type Change, type Classification, type InspectionOptions } from './policy.js';
import { durableJson, inspectOwnedProcess, type OwnedProcessRequest, type OwnedProcessResult, runOwnedProcess } from './process.js';
import { prepareSandbox } from './sandbox.js';
import { type RunStore } from './store.js';

const gitEnv = { PATH: '/usr/bin:/bin', HOME: '/nonexistent', GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_SYSTEM: '/dev/null', GIT_OPTIONAL_LOCKS: '0', GIT_CONFIG_NOSYSTEM: '1' };
const oid = /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/;
const safePath = (path: string) => /^[A-Za-z0-9_./-]+$/.test(path) && !path.startsWith('/') &&
  !path.split('/').some(part => part === '..' || part === '.');
function git(root: string, args: string[], input?: Buffer | string, extraEnv: Record<string, string> = {}): Buffer {
  try {
    return execFileSync('/usr/bin/git', ['-C', root, '-c', 'core.fsmonitor=false', '-c', 'core.hooksPath=/dev/null', ...args],
      { input, maxBuffer: 32_000_000, timeout: 30_000, env: { ...gitEnv, ...extraEnv }, stdio: ['pipe', 'pipe', 'pipe'] });
  } catch { throw new WorkflowError('git_unverifiable', 'Candidate Git state cannot be verified.'); }
}
function lines(bytes: Buffer): string[] { return bytes.toString('utf8').split('\0').filter(Boolean); }
function validBytes(bytes: Buffer): string {
  const value = bytes.toString('utf8');
  if (value.includes('\0') || !Buffer.from(value).equals(bytes))
    throw new WorkflowError('unsafe_file', 'Binary or invalid UTF-8 candidate file is outside the supported profile.');
  return value;
}
function treeEntries(root: string, revision: string): Map<string, { mode: string; hash: string }> {
  const result = new Map<string, { mode: string; hash: string }>();
  for (const entry of lines(git(root, ['ls-tree', '-rz', '--full-tree', revision]))) {
    const match = /^(\d{6}) blob ([a-f0-9]+)\t(.+)$/.exec(entry);
    if (!match || !safePath(match[3]!)) throw new WorkflowError('unsafe_file', 'Baseline contains an unsupported path or entry.');
    result.set(match[3]!, { mode: match[1]!, hash: match[2]! });
  }
  return result;
}
function tracked(root: string): Map<string, { mode: string; hash: string }> {
  const result = new Map<string, { mode: string; hash: string }>();
  for (const entry of lines(git(root, ['ls-files', '--stage', '-z']))) {
    const match = /^(\d{6}) ([a-f0-9]+) ([0-3])\t(.+)$/.exec(entry);
    if (!match || match[3] !== '0' || !safePath(match[4]!) || result.has(match[4]!))
      throw new WorkflowError('unsafe_file', 'Candidate index contains an unsupported or unmerged entry.');
    result.set(match[4]!, { mode: match[1]!, hash: match[2]! });
  }
  return result;
}
function allowedIgnored(root: string, path: string): boolean {
  if (/^(?:node_modules|desktop\/(?:node_modules|out|dist))\/$/.test(path)) return true;
  if (!/^tools\/agent-workflow\/(?:node_modules|dist|\.cache)\/$/.test(path)) return false;
  for (const part of ['tools', 'tools/agent-workflow']) {
    const directory = join(root, part);
    try {
      const info = lstatSync(directory);
      if (!info.isDirectory() || info.isSymbolicLink() || realpathSync(directory) !== directory) return false;
    } catch { return false; }
  }
  return true;
}
function rootChecked(manifest: Manifest, workspace: string): string {
  const root = realpathSync(workspace);
  const common = realpathSync(git(root, ['rev-parse', '--path-format=absolute', '--git-common-dir']).toString().trim());
  if (common !== realpathSync(manifest.commonDir))
    throw new WorkflowError('foreign_repository', 'Candidate workspace does not match the admitted repository.');
  return root;
}
export interface CandidateSnapshot {
  base: string; parent: string; branch: string; sourceHash: string; ignored: string[];
  changes: Change[]; classification: Classification; checks: string[];
}
export interface CandidateOptions extends InspectionOptions { workspace: string }
export function inspectCandidate(manifest: Manifest, options: CandidateOptions): CandidateSnapshot {
  const root = rootChecked(manifest, options.workspace);
  const parent = git(root, ['rev-parse', 'HEAD']).toString().trim();
  const branch = git(root, ['symbolic-ref', '--short', 'HEAD']).toString().trim();
  if (!oid.test(parent) || !oid.test(manifest.base)) throw new WorkflowError('invalid_source', 'Invalid source revision.');
  git(root, ['merge-base', '--is-ancestor', manifest.base, parent]);
  const base = treeEntries(root, manifest.base), index = tracked(root);
  const untracked = lines(git(root, ['ls-files', '--others', '--exclude-standard', '-z']));
  const ignored = lines(git(root, ['ls-files', '--others', '--ignored', '--exclude-standard', '--directory', '-z'])).sort();
  if (ignored.some(path => !allowedIgnored(root, path)))
    throw new WorkflowError('ignored_surprise', 'Unexpected ignored candidate files must be resolved before trusted checks.');
  const paths = new Set([...base.keys(), ...index.keys(), ...untracked]);
  const changes: Change[] = [];
  for (const path of [...paths].sort()) {
    if (!safePath(path)) throw new WorkflowError('unsafe_file', 'Candidate path is unsafe.');
    const absolute = join(root, path);
    const before = base.get(path);
    const indexed = index.get(path);
    const mode = indexed?.mode ?? (before?.mode ?? '100644');
    let after = Buffer.alloc(0);
    let present = false;
    let info: Stats | undefined;
    try { info = lstatSync(absolute); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    if (info) {
      if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1 || info.size > 2_000_000 ||
          (info.mode & 0o111) !== 0 || mode !== '100644')
        throw new WorkflowError('unsafe_file', 'Candidate has a symlink, executable, oversized or unsupported file.');
      after = readFileSync(absolute); present = true;
    }
    const prior = before ? git(root, ['cat-file', 'blob', before.hash]) : Buffer.alloc(0);
    const currentHash = present ? git(root, ['hash-object', '--stdin', '--no-filters'], after).toString().trim() : null;
    const sameIndexAsBase = indexed?.hash === before?.hash && indexed?.mode === before?.mode;
    const sameIndexAsWorktree = (!indexed && !present) ||
      (indexed?.hash === currentHash && indexed?.mode === (present ? '100644' : undefined));
    if (!sameIndexAsBase && !sameIndexAsWorktree && (indexed || before))
      throw new WorkflowError('index_mismatch', 'Staged source differs from both baseline and working candidate.');
    if (before && before.mode !== '100644') throw new WorkflowError('unsafe_file', 'Baseline contains an unsupported file mode.');
    if (present && before && prior.equals(after)) continue;
    if (!present && !before) continue;
    changes.push({ path, before: validBytes(prior), after: validBytes(after), mode: present ? mode : '100644' });
  }
  const classification = classifyDiff(manifest, changes, options);
  const denied = classification.reasons.filter(reason => ['outside_scope', 'unsafe_file', 'administrative_record_changed', 'empty_or_duplicate_diff'].includes(reason));
  if (denied.length) throw new WorkflowError('scope_denied', `Candidate scope inspection denied: ${denied.join(', ')}.`);
  const sourceHash = digest({ base: manifest.base, changes });
  return { base: manifest.base, parent, branch, sourceHash, ignored, changes, classification,
    checks: requiredChecks(classification.paths) };
}
export interface FrozenCandidate {
  base: string; parent: string; head: string; tree: string; branch: string; sourceHash: string;
  indexHash: string; diffHash: string; policyHash: string; paths: string[]; ignored: string[]; checks: string[];
}
export interface FreezeOptions extends CandidateOptions { store: RunStore; manifest: Manifest; issue: number; key: string;
  timestamp: number; message: string; branch: string; beforeRefUpdate?: () => void }
export async function freezeCandidate(options: FreezeOptions): Promise<FrozenCandidate> {
  const { manifest, store } = options;
  if (!Number.isSafeInteger(options.issue) || options.issue <= 0 ||
      (manifest.issue && manifest.issue !== options.issue) ||
      !['pr', 'merge-eligible'].includes(manifest.delivery))
    throw new WorkflowError('delivery_denied', 'A PR-eligible issue run is required to freeze a candidate.');
  const expectedBranch = `sc-agent/issue-${options.issue}-${manifest.id.slice(0, 8)}`;
  if (options.branch !== expectedBranch || !Number.isSafeInteger(options.timestamp) || options.timestamp < 0 ||
      !options.message || Buffer.byteLength(options.message) > 500 || !/^[a-z0-9-]{1,100}$/.test(options.key))
    throw new WorkflowError('invalid_freeze', 'Freeze identity, message or round key is invalid.');
  const snapshot = inspectCandidate(manifest, options);
  if (snapshot.branch !== expectedBranch) throw new WorkflowError('branch_mismatch', 'Candidate is not on its allocated task branch.');
  const root = realpathSync(options.workspace);
  const initialIndexHash = digest(git(root, ['ls-files', '--stage', '-z']).toString('hex'));
  const intentDirectory = join(store.directory, 'runs', manifest.id, 'processes');
  mkdirSync(intentDirectory, { recursive: true, mode: 0o700 });
  const intentPath = join(intentDirectory, `freeze-${options.key}.json`);
  async function finish(receipt: FrozenCandidate): Promise<FrozenCandidate> {
    if (receipt.sourceHash !== snapshot.sourceHash || receipt.base !== manifest.base || receipt.branch !== expectedBranch ||
        ![receipt.parent, receipt.head].includes(snapshot.parent))
      throw new WorkflowError('stale_source', 'Freeze intent belongs to different candidate source.');
    const ref = `refs/heads/${expectedBranch}`;
    const observed = await store.effect(manifest.id, `freeze:${options.key}`, 'commit', receipt, {
      async execute() {
        const now = inspectCandidate(manifest, options);
        if (now.sourceHash !== receipt.sourceHash || ![receipt.parent, receipt.head].includes(now.parent))
          throw new WorkflowError('stale_source', 'Candidate changed before freeze.');
        if (now.parent === receipt.parent) {
          git(root, ['update-ref', ref, receipt.head, receipt.parent]);
          options.beforeRefUpdate?.();
        }
        return receipt;
      },
      async reconcile() {
        const current = git(root, ['rev-parse', ref]).toString().trim();
        return current === receipt.head ? receipt : null;
      }
    });
    if (git(root, ['rev-parse', ref]).toString().trim() !== receipt.head)
      throw new WorkflowError('stale_source', 'Frozen branch ref changed after acknowledgement.');
    if (git(root, ['write-tree']).toString().trim() !== receipt.tree) {
      const indexHash = digest(git(root, ['ls-files', '--stage', '-z']).toString('hex'));
      if (indexHash !== receipt.indexHash)
        throw new WorkflowError('stale_source', 'Candidate index changed before freeze finalization.');
      const latest = inspectCandidate(manifest, options);
      if (latest.sourceHash !== receipt.sourceHash || latest.parent !== receipt.head)
        throw new WorkflowError('stale_source', 'Candidate changed before index finalization.');
      git(root, ['read-tree', receipt.head]);
    }
    if (git(root, ['write-tree']).toString().trim() !== receipt.tree)
      throw new WorkflowError('stale_source', 'Frozen candidate did not become clean.');
    return observed;
  }
  if (existsSync(intentPath)) {
    const info = lstatSync(intentPath);
    if (!info.isFile() || info.isSymbolicLink() || (info.mode & 0o077) || info.size > 100_000)
      throw new WorkflowError('invalid_state', 'Freeze intent cannot be verified.');
    const saved = JSON.parse(readFileSync(intentPath, 'utf8')) as { receipt: FrozenCandidate;
      timestamp: number; message: string };
    if (saved.timestamp !== options.timestamp || saved.message !== options.message)
      throw new WorkflowError('effect_conflict', 'Freeze round identity was reused with different commit metadata.');
    return finish(saved.receipt);
  }
  const indexDir = mkdtempSync(join(dirname(store.directory), 'candidate-index-'));
  const privateIndex = join(indexDir, 'index');
  try {
    const env = { GIT_INDEX_FILE: privateIndex };
    git(root, ['read-tree', snapshot.parent], undefined, env);
    for (const change of snapshot.changes) {
      const absolute = join(root, change.path);
      if (!existsSync(absolute)) git(root, ['update-index', '--force-remove', '--', change.path], undefined, env);
      else {
        const hash = git(root, ['hash-object', '-w', '--stdin', '--no-filters'], Buffer.from(change.after)).toString().trim();
        git(root, ['update-index', '--add', '--cacheinfo', '100644', hash, change.path], undefined, env);
      }
    }
    const tree = git(root, ['write-tree'], undefined, env).toString().trim();
    const author = 'SC Agent Workflow <sc-agent@users.noreply.github.com>';
    const date = `${options.timestamp} +0000`;
    const commit = Buffer.from(`tree ${tree}\nparent ${snapshot.parent}\nauthor ${author} ${date}\ncommitter ${author} ${date}\n\n${options.message}\n`);
    const head = git(root, ['hash-object', '-w', '-t', 'commit', '--stdin'], commit).toString().trim();
    const receipt: FrozenCandidate = { base: manifest.base, parent: snapshot.parent, head, tree,
      branch: expectedBranch, sourceHash: snapshot.sourceHash, indexHash: initialIndexHash,
      diffHash: snapshot.classification.diffHash,
      policyHash: snapshot.classification.policyHash, paths: snapshot.classification.paths,
      ignored: snapshot.ignored, checks: snapshot.checks };
    durableJson(intentPath, { receipt, timestamp: options.timestamp, message: options.message });
    return finish(receipt);
  } finally { rmSync(indexDir, { recursive: true, force: true }); }
}
export function assertFrozenSource(manifest: Manifest, frozen: FrozenCandidate, options: CandidateOptions): CandidateSnapshot {
  let snapshot: CandidateSnapshot;
  try { snapshot = inspectCandidate(manifest, options); }
  catch (error) {
    if (error instanceof WorkflowError) throw new WorkflowError('stale_source', 'Frozen candidate worktree is no longer valid.');
    throw error;
  }
  const root = realpathSync(options.workspace);
  if (snapshot.parent !== frozen.head || snapshot.base !== frozen.base || snapshot.branch !== frozen.branch ||
      snapshot.sourceHash !== frozen.sourceHash || snapshot.classification.diffHash !== frozen.diffHash ||
      snapshot.classification.policyHash !== frozen.policyHash ||
      git(root, ['rev-parse', `${frozen.head}^{tree}`]).toString().trim() !== frozen.tree ||
      git(root, ['write-tree']).toString().trim() !== frozen.tree)
    throw new WorkflowError('stale_source', 'Frozen candidate source, policy or worktree changed.');
  return snapshot;
}
export type CheckName = 'workflow-selftest' | 'workflow-docs' | 'openspec-strict' | 'whitespace' |
  'desktop-typecheck' | 'desktop-lint' | 'desktop-tests' | 'desktop-build' | 'tool-verify';
export interface CheckCommand { name: CheckName; program: string; args: string[]; environment: string }
const desktopVerifyScript = 'npm run typecheck && npm run lint && npm test && npm run build';
const desktopBuildScript = `const {copyFileSync}=require('node:fs');const {spawnSync}=require('node:child_process');
copyFileSync('/workspace/desktop/electron.vite.config.ts','/workspace/desktop/node_modules/.cache/sc-electron-vite.config.ts');
const result=spawnSync('/usr/bin/npm',['--prefix','desktop','run','build','--','--config','/workspace/desktop/node_modules/.cache/sc-electron-vite.config.ts'],{stdio:'inherit'});
if(result.error)throw result.error;process.exit(result.status??1);`;
function assertDesktopVerifyLayout(workspace: string): void {
  let scripts: Record<string, unknown>;
  try { scripts = (JSON.parse(readFileSync(join(workspace, 'desktop/package.json'), 'utf8')) as { scripts: Record<string, unknown> }).scripts; }
  catch { throw new WorkflowError('missing_capability', 'Desktop verification manifest cannot be read.', 2); }
  if (!scripts || scripts.verify !== desktopVerifyScript ||
      ['typecheck', 'lint', 'test', 'build'].some(name => typeof scripts[name] !== 'string' || !scripts[name]))
    throw new WorkflowError('missing_capability', 'Desktop aggregate verification layout requires a fixed route update.', 2);
}
export function selectVerificationCommands(checks: string[], base: string, head: string): CheckCommand[] {
  const docs: CheckCommand[] = [
    { name: 'workflow-selftest', program: '/usr/bin/node', args: ['.github/scripts/workflow-checks.mjs', 'selftest'], environment: 'portable-documentation' },
    { name: 'workflow-docs', program: '/usr/bin/node', args: ['.github/scripts/workflow-checks.mjs', 'docs'], environment: 'portable-documentation' },
    { name: 'openspec-strict', program: '/run/sc-openspec', args: ['validate', '--all', '--strict', '--no-interactive'], environment: 'portable-documentation' },
    { name: 'whitespace', program: '/usr/bin/git', args: ['diff', '--check', base, head], environment: 'portable-documentation' }
  ];
  if (checks.includes('application')) docs.push(
    { name: 'desktop-typecheck', program: '/usr/bin/npm', args: ['--prefix', 'desktop', 'run', 'typecheck'], environment: 'portable-application' },
    { name: 'desktop-lint', program: '/usr/bin/npm', args: ['--prefix', 'desktop', 'run', 'lint'], environment: 'portable-application' },
    { name: 'desktop-tests', program: '/usr/bin/npm', args: ['--prefix', 'desktop', 'test'], environment: 'portable-application' },
    { name: 'desktop-build', program: '/usr/bin/node', args: ['-e', desktopBuildScript], environment: 'portable-application' }
  );
  if (checks.includes('agent-workflow'))
    docs.push({ name: 'tool-verify', program: '/usr/bin/npm', args: ['--prefix', 'tools/agent-workflow', 'run', 'verify'], environment: 'portable-tool' });
  return docs;
}
export type DependencyArea = 'application' | 'tool';
export interface DependencyDigest { area: DependencyArea; packageHash: string; lockHash: string; installedHash: string }
export interface DependencyAttestation { version: 1; workspace: string; areas: DependencyDigest[]; hash: string }
const dependencyPath: Record<DependencyArea, string> = { application: 'desktop', tool: 'tools/agent-workflow' };
function sha256(bytes: Buffer | string): string { return createHash('sha256').update(bytes).digest('hex'); }
function normalizedPackage(path: string, lock: boolean): string {
  let parsed: Record<string, unknown>;
  try { parsed = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>; }
  catch { throw new WorkflowError('missing_capability', 'Pinned package metadata cannot be read.', 2); }
  delete parsed.version;
  if (lock && parsed.packages && typeof parsed.packages === 'object') {
    const root = (parsed.packages as Record<string, Record<string, unknown>>)[''];
    if (root) delete root.version;
  }
  return digest(parsed);
}
function installedHash(root: string, area: DependencyArea): string {
  const hash = createHash('sha256');
  const walk = (directory: string, prefix: string) => {
    for (const name of readdirSync(directory).sort()) {
      if (!prefix && (['.vite', '.cache'].includes(name) || (area === 'application' && name === '.vite-temp'))) continue;
      const relativePath = prefix ? `${prefix}/${name}` : name;
      const path = join(directory, name);
      const info = lstatSync(path);
      hash.update(`${relativePath}\0${info.mode & 0o777}\0`);
      if (info.isDirectory()) { hash.update('dir\0'); walk(path, relativePath); }
      else if (info.isSymbolicLink()) {
        const target = readlinkSync(path);
        const resolved = resolve(dirname(path), target);
        if (!resolved.startsWith(`${root}/`))
          throw new WorkflowError('missing_capability', 'Installed dependency links leave the isolated tree.', 2);
        hash.update(`link\0${target}\0`);
      } else if (info.isFile()) { hash.update('file\0'); hash.update(readFileSync(path)); }
      else throw new WorkflowError('missing_capability', 'Installed dependencies contain an unsupported entry.', 2);
    }
  };
  walk(root, '');
  return hash.digest('hex');
}
export function attestVerificationDependencies(workspace: string, areas: DependencyArea[]): DependencyAttestation {
  const root = realpathSync(workspace);
  const unique = [...new Set(areas)].sort();
  const records = unique.map(area => {
    const packageRoot = join(root, dependencyPath[area]);
    const installed = join(packageRoot, 'node_modules');
    if (!existsSync(installed) || !lstatSync(installed).isDirectory() || realpathSync(installed) !== installed)
      throw new WorkflowError('missing_capability', 'Installed dependencies are unavailable in the isolated workspace.', 2);
    return { area, packageHash: normalizedPackage(join(packageRoot, 'package.json'), false),
      lockHash: normalizedPackage(join(packageRoot, 'package-lock.json'), true), installedHash: installedHash(installed, area) };
  });
  return { version: 1, workspace: root, areas: records, hash: digest({ version: 1, workspace: root, areas: records }) };
}
export interface EnvironmentIdentity { hash: string; fixture: boolean; sandboxHash: string;
  sandboxProfile: { readonlySource: true; network: false; auth: false;
    outputs: 'application' | 'tool' | 'both' | null; revision: string };
  programs: Record<string, { path: string; hash: string; version: string }>;
  dependencies: DependencyAttestation | null }
function environmentIdentity(options: VerifyOptions, openspecBinary: string | undefined,
  dependencies: DependencyAttestation | null, outputs: 'application' | 'tool' | 'both' | undefined): EnvironmentIdentity {
  const programs: EnvironmentIdentity['programs'] = {};
  for (const [name, source, args] of [
    ['node', '/usr/bin/node', ['--version']], ['npm', '/usr/bin/npm', ['--version']],
    ['git', '/usr/bin/git', ['--version']], ['bwrap', '/usr/bin/bwrap', ['--version']],
    ['openspec', openspecBinary, ['--version']]
  ] as const) {
    if (!source) {
      if (!options.runCheck) throw new WorkflowError('missing_capability', 'Required OpenSpec runtime is unavailable.', 2);
      programs[name] = { path: 'fixture-unavailable', hash: '', version: '' }; continue;
    }
    const path = realpathSync(source);
    let version: string;
    try { version = execFileSync(path, [...args], { encoding: 'utf8', cwd: '/', timeout: 10_000,
      maxBuffer: 10_000, env: { PATH: '/usr/bin:/bin', HOME: '/nonexistent', OPENSPEC_TELEMETRY: '0' } }).trim(); }
    catch { throw new WorkflowError('missing_capability', `Trusted ${name} runtime version cannot be identified.`, 2); }
    programs[name] = { path, hash: sha256(readFileSync(path)), version };
  }
  const sandboxHash = sha256(readFileSync(fileURLToPath(new URL('./sandbox.js', import.meta.url))));
  const sandboxProfile = { readonlySource: true as const, network: false as const, auth: false as const,
    outputs: outputs ?? null, revision: options.frozen.head };
  const identity = { fixture: Boolean(options.runCheck), sandboxHash, sandboxProfile, programs, dependencies };
  return { ...identity, hash: digest(identity) };
}
export interface CheckReceipt { name: CheckName; commandHash: string; resultHash: string; exitCode: number | null;
  status: OwnedProcessResult['status']; passed: boolean; outputTruncated: boolean; environment: string; environmentHash: string }
export interface VerificationReceipt { base: string; head: string; tree: string; sourceHash: string;
  diffHash: string; policyHash: string; environment: string; checks: CheckReceipt[]; passed: boolean;
  environmentIdentity: EnvironmentIdentity; missingCapabilities: string[] }
export type CheckRunner = (request: OwnedProcessRequest) => Promise<OwnedProcessResult>;
export interface VerifyOptions extends CandidateOptions { manifest: Manifest; frozen: FrozenCandidate;
  store: RunStore; key: string; runCheck?: CheckRunner; openspecBinary?: string;
  trustedDependencies?: DependencyAttestation;
  signal?: AbortSignal; timeoutMs?: number }
export async function verifyCandidate(options: VerifyOptions): Promise<VerificationReceipt> {
  const { manifest, frozen, store } = options;
  const snapshot = assertFrozenSource(manifest, frozen, options);
  if (!/^[a-z0-9-]{1,100}$/.test(options.key)) throw new WorkflowError('invalid_operation_key', 'Verification round key is invalid.');
  const commands = selectVerificationCommands(snapshot.checks, frozen.base, frozen.head);
  if (snapshot.checks.includes('application')) assertDesktopVerifyLayout(options.workspace);
  const areas: DependencyArea[] = [
    ...(snapshot.checks.includes('application') ? ['application' as const] : []),
    ...(commands.some(command => command.name === 'tool-verify') ? ['tool' as const] : [])
  ];
  if (options.timeoutMs !== undefined && (!Number.isSafeInteger(options.timeoutMs) || options.timeoutMs <= 0))
    throw new WorkflowError('invalid_process_request', 'Verification timeout must be finite and positive.');
  const stateDirectory = join(store.directory, 'runs', manifest.id, 'processes');
  const checks: CheckReceipt[] = [];
  let openspecBinary = options.openspecBinary;
  if (!options.runCheck) {
    if (!openspecBinary) {
      try { openspecBinary = execFileSync('/usr/bin/which', ['openspec'], { encoding: 'utf8',
        timeout: 5000, maxBuffer: 1000 }).trim(); } catch { /* capability reported below */ }
    }
    if (!openspecBinary || !existsSync(openspecBinary) ||
        realpathSync(openspecBinary).startsWith(`${realpathSync(options.workspace)}/`) ||
        commands.some(command => command.name !== 'openspec-strict' && !existsSync(command.program)))
      throw new WorkflowError('missing_capability', 'Required trusted verification runtime is unavailable.', 2);
  }
  let dependencies: DependencyAttestation | null = null;
  if (areas.length) {
    if (!options.trustedDependencies)
      throw new WorkflowError('missing_capability', 'Prewriter dependency attestation is required for trusted verification.', 2);
    dependencies = attestVerificationDependencies(options.workspace, areas);
    if (digest(dependencies) !== digest(options.trustedDependencies))
      throw new WorkflowError('stale_environment', 'Installed dependencies or pinned package metadata changed since setup.');
  }
  const verificationOutputs = areas.length === 2 ? 'both' : areas[0] === 'application' ? 'application' :
    areas[0] === 'tool' ? 'tool' : undefined;
  const identity = environmentIdentity(options, openspecBinary, dependencies, verificationOutputs);
  for (const command of commands) {
    const sandbox = prepareSandbox({ workspace: options.workspace, revision: frozen.head,
      writable: false, verificationOutputs,
      stateDirectory: store.directory, network: false, openspecBinary });
    const processKey = `verification:${options.key}:${command.name}`;
    let retainSandbox = false;
    try {
      if (options.signal?.aborted) throw options.signal.reason;
      const request = sandbox.request(command.program, command.args);
      const full: OwnedProcessRequest = { ...request, key: processKey, stateDirectory,
        timeoutMs: Math.min(options.timeoutMs ?? manifest.limits.workerMs, manifest.limits.workerMs),
        signal: options.signal };
      store.registerOwnedProcess(manifest.id, processKey, stateDirectory);
      const result = await store.effect(manifest.id, processKey, 'verification',
        { head: frozen.head, sourceHash: frozen.sourceHash, environmentHash: identity.hash, command }, {
          execute: () => (options.runCheck ?? runOwnedProcess)(full),
          async reconcile() {
            const current = inspectOwnedProcess(stateDirectory, processKey);
            return current.state === 'exited' ? current.result! : null;
          }
        });
      checks.push({ name: command.name, commandHash: digest({ command, environmentHash: identity.hash }), resultHash: digest(result),
        exitCode: result.exitCode, status: result.status, passed: result.status === 'exited' &&
          result.exitCode === 0 && !result.outputTruncated, outputTruncated: result.outputTruncated,
        environment: command.environment, environmentHash: identity.hash });
      assertFrozenSource(manifest, frozen, options);
    } catch (error) {
      const state = inspectOwnedProcess(stateDirectory, processKey).state;
      retainSandbox = state !== 'exited' && state !== 'absent';
      throw error;
    } finally { if (!retainSandbox) sandbox.dispose(); }
  }
  if (areas.length && digest(attestVerificationDependencies(options.workspace, areas)) !== digest(dependencies))
    throw new WorkflowError('stale_environment', 'Installed dependencies changed during verification.');
  if (environmentIdentity(options, openspecBinary, dependencies, verificationOutputs).hash !== identity.hash)
    throw new WorkflowError('stale_environment', 'Trusted verification runtime changed during execution.');
  const environment = commands.some(command => command.environment === 'portable-application') ?
    'portable-application' : commands.some(command => command.environment === 'portable-tool') ?
      'portable-tool' : 'portable-documentation';
  return { base: frozen.base, head: frozen.head, tree: frozen.tree, sourceHash: frozen.sourceHash,
    diffHash: frozen.diffHash, policyHash: frozen.policyHash, environment, environmentIdentity: identity, checks,
    passed: checks.length === commands.length && checks.every(check => check.passed),
    missingCapabilities: ['native', 'GUI', 'recording', 'live-model', 'beta-handoff'] };
}
export interface PushTransport { push(root: string, remote: string, source: string, target: string): Promise<void>;
  read(remote: string, ref: string): Promise<string | null> }
export interface PushReceipt { repository: string; branch: string; head: string; remote: string; ref: string }
export interface PushOptions extends CandidateOptions { manifest: Manifest; frozen: FrozenCandidate;
  store: RunStore; issue: number; key: string; transport?: PushTransport; trustedGhBinary?: string }
function productionTransport(root: string, binary: string | undefined): PushTransport {
  if (!binary) throw new WorkflowError('missing_capability', 'Selected GitHub credential helper is unavailable.', 2);
  const gh = realpathSync(binary);
  if (!/^[A-Za-z0-9_./-]+$/.test(gh) || gh.startsWith(`${root}/`) ||
      !lstatSync(gh).isFile() || (lstatSync(gh).mode & 0o111) === 0)
    throw new WorkflowError('missing_capability', 'Selected GitHub credential helper is not an executable file.', 2);
  const auth = ['-c', 'credential.helper=', '-c', `credential.helper=!${gh} auth git-credential`,
    '-c', 'push.recurseSubmodules=no'];
  const selectedConfig = process.env.GH_CONFIG_DIR || join(userInfo().homedir, '.config', 'gh');
  if (!isAbsolute(selectedConfig))
    throw new WorkflowError('missing_capability', 'Selected GitHub configuration directory is not absolute.', 2);
  const configDirectory = existsSync(selectedConfig) ? realpathSync(selectedConfig) : resolve(selectedConfig);
  if (configDirectory === root || configDirectory.startsWith(`${root}/`))
    throw new WorkflowError('missing_capability', 'GitHub authentication cannot come from candidate source.', 2);
  // Only the selected coordinator Git transport receives these auth handles; none enters effect requests or receipts.
  const authEnv = { GIT_TERMINAL_PROMPT: '0', GH_PROMPT_DISABLED: '1', GH_CONFIG_DIR: configDirectory,
    ...(process.env.GH_TOKEN ? { GH_TOKEN: process.env.GH_TOKEN } : {}),
    ...(process.env.GITHUB_TOKEN ? { GITHUB_TOKEN: process.env.GITHUB_TOKEN } : {}) };
  return {
    async push(_root, remote, source, target) {
      git(root, [...auth, 'push', '--no-verify', '--porcelain', remote, `${source}:${target}`], undefined, authEnv);
    },
    async read(remote, ref) {
      try {
        const raw = git(root, [...auth, 'ls-remote', '--refs', remote, ref], undefined, authEnv).toString().trim();
        return raw ? raw.split(/\s+/)[0]! : null;
      } catch { throw new WorkflowError('remote_unverifiable', 'Remote ref read-back failed.', 2); }
    }
  };
}
export async function pushCandidate(options: PushOptions): Promise<PushReceipt> {
  const { manifest, frozen, store } = options;
  if (!['pr', 'merge-eligible'].includes(manifest.delivery) || !Number.isSafeInteger(options.issue) ||
      options.issue <= 0 || (manifest.issue && manifest.issue !== options.issue) ||
      frozen.branch !== `sc-agent/issue-${options.issue}-${manifest.id.slice(0, 8)}` ||
      !/^[a-z0-9-]{1,100}$/.test(options.key))
    throw new WorkflowError('delivery_denied', 'Only a frozen issue task branch can be pushed.');
  assertFrozenSource(manifest, frozen, options);
  const root = realpathSync(options.workspace);
  const remote = git(root, ['remote', 'get-url', 'origin']).toString().trim();
  const canonical = `https://${manifest.repository}.git`;
  const ssh = `git@${manifest.repository.replace('/', ':')}.git`;
  if (remote !== canonical && remote !== ssh) throw new WorkflowError('remote_mismatch', 'Origin does not match the admitted canonical GitHub repository.');
  if (!options.transport && remote !== canonical)
    throw new WorkflowError('remote_mismatch', 'Production push requires the selected GitHub HTTPS origin.');
  const pushUrl = git(root, ['remote', 'get-url', '--push', 'origin']).toString().trim();
  if (pushUrl !== remote) throw new WorkflowError('remote_mismatch', 'Origin push URL differs from admitted canonical GitHub repository.');
  const ref = `refs/heads/${frozen.branch}`;
  const receipt = { repository: manifest.repository, branch: frozen.branch, head: frozen.head, remote: 'origin', ref };
  const transport = options.transport ?? productionTransport(root, options.trustedGhBinary);
  const prior = await transport.read(remote, ref);
  if (prior && prior !== frozen.head) throw new WorkflowError('remote_conflict', 'Task remote branch has a different head.');
  const result = await store.effect(manifest.id, `push:${options.key}`, 'push', receipt, {
    async execute() {
      if (prior !== frozen.head) await transport.push(root, remote, frozen.head, ref);
      const observed = await transport.read(remote, ref);
      if (observed !== frozen.head) throw new WorkflowError('remote_unverifiable', 'Push did not read back the exact head.', 2);
      return receipt;
    },
    async reconcile() { return await transport.read(remote, ref) === frozen.head ? receipt : null; }
  });
  assertFrozenSource(manifest, frozen, options);
  return result;
}
