import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import ts from 'typescript';
import { digest, WorkflowError, type Manifest } from './manifest.js';
import { reconcileOwnedProcess, runOwnedProcess } from './process.js';
import { prepareSandbox } from './sandbox.js';
import { type RunStore } from './store.js';

export interface Finding { id: string; path: string; description: string }
export function inScope(manifest: Manifest, path: string): boolean {
  return /^[A-Za-z0-9_.\-/]+$/.test(path) && !path.startsWith('/') &&
    !path.split('/').some(part => part === '.' || part === '..' || !part) &&
    manifest.paths.some(allowed => allowed.endsWith('/') ? path.startsWith(allowed) : path === allowed);
}
export function normalizeFindings(manifest: Manifest, input: unknown, available = manifest.limits.findings): Finding[] {
  const parsed = z.array(z.object({ path: z.string().max(500),
    description: z.string().min(1).max(1000) }).strict()).max(100).safeParse(input);
  if (!parsed.success) throw new WorkflowError('invalid_finding', 'Finding output has invalid fields.');
  const findings = new Map<string, Finding>();
  for (const finding of parsed.data) {
    if (!inScope(manifest, finding.path)) throw new WorkflowError('scope_denied', 'Finding is outside the frozen scope.');
    const id = digest({ repository: manifest.repository, scope: manifest.scope, path: finding.path,
      outcome: finding.description.trim().replace(/\s+/g, ' ').toLowerCase() });
    findings.set(id, { ...finding, id });
  }
  if (findings.size > available) throw new WorkflowError('budget_exhausted', 'Finding allowance is exhausted.', 3);
  return [...findings.values()];
}

export function baselineFile(manifest: Manifest, path: string): string {
  if (!/^[A-Za-z0-9_.\-/]+$/.test(path) || path.startsWith('/') || path.split('/').includes('..'))
    throw new WorkflowError('invalid_source', 'Baseline path is invalid.');
  try {
    return execFileSync('/usr/bin/git', ['-C', manifest.root, 'show', `${manifest.base}:${path}`], {
      encoding: 'utf8', timeout: 10_000, maxBuffer: 150_000, stdio: ['ignore', 'pipe', 'pipe'],
      env: { PATH: '/usr/bin:/bin', HOME: '/dev/null', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' }
    });
  } catch { throw new WorkflowError('owner_unavailable', 'Required baseline contract or planning owner is unavailable.', 2); }
}
export function planningOwner(manifest: Manifest, taskText: string) {
  const changes = [...taskText.matchAll(/openspec\/changes\/([a-z0-9][a-z0-9-]*)\/tasks\.md/g)]
    .map(match => match[1]!);
  if (new Set(changes).size > 1) throw new WorkflowError('owner_ambiguous', 'Task has several planning owners.', 2);
  const change = changes[0];
  if (!change) return null;
  const path = `openspec/changes/${change}/tasks.md`;
  const content = baselineFile(manifest, path);
  return { change, path, provenance: manifest.base, hash: digest(content),
    pending: [...content.matchAll(/^- \[ \] (\d+(?:\.\d+)*)\s/gm)].map(match => match[1]!) };
}

export const oracleSchema = z.object({ kind: z.literal('portable-node'), script: z.string().min(1).max(8000),
  contractPaths: z.array(z.string().min(1).max(500)).min(1).max(8) }).strict();
export type Oracle = z.infer<typeof oracleSchema>;
function inspectOracle(manifest: Manifest, script: string): boolean {
  const source = ts.createSourceFile('oracle.mjs', script, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  let importsSource = false, importsAssert = false;
  const scopedNames = new Set<string>();
  const forbidden = new Set(['process', 'global', 'globalThis', 'eval', 'Function', 'Date', 'performance',
    'setTimeout', 'setInterval', 'fetch', 'WebSocket', 'require', 'Atomics']);
  function imported(value: string) {
    if (value === 'node:assert/strict') { importsAssert = true; return; }
    if (manifest.scope === 'docs-links' && ['node:fs', 'node:path'].includes(value)) return;
    const path = value.replace(/^file:\/\//, '').replace(/^\/workspace\//, '');
    if (!value.startsWith('/workspace/') && !value.startsWith('file:///workspace/'))
      throw new WorkflowError('invalid_oracle', 'Oracle imports must name assertion or scoped source modules.');
    if (!inScope(manifest, path)) throw new WorkflowError('invalid_oracle', 'Oracle imports exceed the frozen source scope.');
    importsSource = true;
  }
  function visit(node: ts.Node) {
    if (ts.isIdentifier(node) && forbidden.has(node.text) || ts.isPropertyAccessExpression(node) &&
        ['random', 'constructor', '__proto__'].includes(node.name.text))
      throw new WorkflowError('invalid_oracle', 'Oracle cannot control process outcome or depend on ambient execution state.');
    if (ts.isImportDeclaration(node)) {
      if (!ts.isStringLiteral(node.moduleSpecifier)) throw new WorkflowError('invalid_oracle', 'Oracle import must be literal.');
      imported(node.moduleSpecifier.text);
      if (node.moduleSpecifier.text !== 'node:assert/strict') {
        const clause = node.importClause;
        if (clause?.name) scopedNames.add(clause.name.text);
        if (clause?.namedBindings && ts.isNamespaceImport(clause.namedBindings)) scopedNames.add(clause.namedBindings.name.text);
        if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings))
          for (const element of clause.namedBindings.elements) scopedNames.add(element.name.text);
      }
    }
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const argument = node.arguments[0];
      if (!argument || !ts.isStringLiteral(argument)) throw new WorkflowError('invalid_oracle', 'Oracle import must be literal.');
      imported(argument.text);
      const binding = ts.isAwaitExpression(node.parent) ? node.parent.parent : node.parent;
      if (ts.isVariableDeclaration(binding) && ts.isObjectBindingPattern(binding.name))
        for (const element of binding.name.elements) if (ts.isIdentifier(element.name)) scopedNames.add(element.name.text);
    }
    if (manifest.scope === 'docs-links' && ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === 'readFileSync') {
      const argument = node.arguments[0];
      if (argument && ts.isStringLiteral(argument) && argument.text.startsWith('/workspace/') &&
          inScope(manifest, argument.text.slice('/workspace/'.length))) importsSource = true;
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  // shortcut: only direct references count here; the fresh contract review handles semantic relevance.
  let assertionUsesSource = false;
  function check(node: ts.Node) {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.expression) && node.expression.expression.text === 'assert') {
      const uses = (part: ts.Node): boolean => {
        if (ts.isIdentifier(part) && (scopedNames.has(part.text) ||
            manifest.scope === 'docs-links' && part.text === 'readFileSync')) return true;
        return ts.forEachChild(part, uses) === true;
      };
      if (node.arguments.some(uses)) assertionUsesSource = true;
    }
    ts.forEachChild(node, check);
  }
  check(source);
  return importsSource && importsAssert && assertionUsesSource;
}
export function requireFrozenSource(manifest: Manifest, workspace: string, revision: string): void {
  try {
    const git = (...args: string[]) => execFileSync('/usr/bin/git', ['-C', workspace,
      '-c', 'core.fsmonitor=false', ...args], { encoding: 'utf8', timeout: 10_000,
      maxBuffer: 1_000_000, stdio: ['ignore', 'pipe', 'pipe'], env: {
        PATH: '/usr/bin:/bin', HOME: '/dev/null', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null'
      } }).trim();
    if (realpathSync(git('rev-parse', '--path-format=absolute', '--git-common-dir')) !== realpathSync(manifest.commonDir) ||
        git('rev-parse', 'HEAD') !== revision || git('status', '--porcelain', '--untracked-files=all'))
      throw new Error('Source changed');
  } catch { throw new WorkflowError('source_changed', 'Frozen source is changed or belongs to another repository.', 2); }
}
export interface OracleEvidence {
  source: string; oracleHash: string; contractHash: string;
  environment: 'linux-portable-synthetic'; outcome: 'passed' | 'failed' | 'unavailable';
  operationKey: string; exitCode: number | null; outputHash: string;
}
export async function runOracle(request: {
  store: RunStore; runId: string; workspace: string; revision: string;
  oracle: Oracle; signal?: AbortSignal; timeReservedByStage?: boolean;
}): Promise<OracleEvidence> {
  const { store, runId } = request; const manifest = store.get(runId).manifest;
  const oracle = oracleSchema.parse(request.oracle);
  const scopedAssertion = inspectOracle(manifest, oracle.script);
  if (!/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(request.revision))
    throw new WorkflowError('invalid_source', 'Oracle source must be frozen.');
  requireFrozenSource(manifest, request.workspace, request.revision);
  const contracts = oracle.contractPaths.map(path => {
    if (!(path.endsWith('.md') || path.startsWith('desktop/tests/') || inScope(manifest, path)))
      throw new WorkflowError('scope_denied', 'Oracle contract is outside accepted source.');
    return { path, hash: digest(baselineFile(manifest, path)) };
  });
  const oracleHash = digest(oracle); const contractHash = digest(contracts);
  const identity = { runId, source: request.revision, workspace: request.workspace, oracleHash, contractHash };
  const key = `oracle:${digest(identity)}`;
  const runDirectory = join(store.directory, 'runs', runId);
  const processDirectory = join(runDirectory, 'processes');
  mkdirSync(runDirectory, { recursive: true, mode: 0o700 });
  const timeoutMs = Math.min(20_000, manifest.limits.workerMs);
  if (!request.timeReservedByStage) store.reserve(runId, `time:${key}`, 'activeMs', timeoutMs);
  const inputDirectory = join(runDirectory, 'oracle-inputs');
  mkdirSync(inputDirectory, { recursive: true, mode: 0o700 });
  const scriptFile = join(inputDirectory, `${digest(key)}.mjs`);
  if (existsSync(scriptFile)) {
    if (readFileSync(scriptFile, 'utf8') !== oracle.script)
      throw new WorkflowError('invalid_state', 'Frozen oracle bytes have changed.');
  } else writeFileSync(scriptFile, oracle.script, { mode: 0o600, flag: 'wx' });
  const sandbox = prepareSandbox({ workspace: request.workspace, revision: request.revision,
    writable: false, stateDirectory: runDirectory, network: false, scriptFile });
  // The independent runner classifies assertion failures separately from unavailable runtime evidence.
  const script = `try { await import('file:///run/sc-oracle.mjs'); }
catch (failure) { process.exitCode = failure?.code === 'ERR_ASSERTION' ? 42 : 43; }`;
  let launched = false; let terminal = false;
  try {
    store.registerOwnedProcess(runId, key, processDirectory);
    const receipt = await store.effect(runId, key, 'verification', identity, {
      execute: async () => {
        launched = true;
        return runOwnedProcess({ ...sandbox.request('/usr/bin/node', ['--experimental-strip-types', '--input-type=module', '-']),
          stateDirectory: processDirectory, key, stdin: script, timeoutMs, signal: request.signal });
      },
      reconcile: async () => {
        try { return await reconcileOwnedProcess(processDirectory, key); }
        catch (error) { if (error instanceof WorkflowError && error.code === 'operation_not_found') return null; throw error; }
      }
    });
    terminal = true;
    if (!request.timeReservedByStage) store.settleTime(runId, `time:${key}`, Math.ceil(receipt.elapsedMs));
    const outcome = receipt.status !== 'exited' || receipt.outputTruncated ? 'unavailable' :
      receipt.exitCode === 0 ? 'passed' : receipt.exitCode === 42 && scopedAssertion ? 'failed' : 'unavailable';
    return { source: request.revision, oracleHash, contractHash, environment: 'linux-portable-synthetic',
      outcome, operationKey: key, exitCode: receipt.exitCode, outputHash: digest([receipt.stdout, receipt.stderr]) };
  } finally {
    if (!launched || terminal) { sandbox.dispose(); rmSync(scriptFile, { force: true }); }
  }
}
