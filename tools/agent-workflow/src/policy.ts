import ts from 'typescript';
import { POLICY_CONFIG } from './policy-config.js';
import { posix } from 'node:path';
import { digest, POLICY_HASH, type Manifest } from './manifest.js';

export interface Change { path: string; before: string; after: string; mode: string }
export interface Classification {
  category: 'local-doc-link-repair' | 'portable-json-parser-fix' | null;
  reasons: string[]; diffHash: string; policyHash: string; paths: string[];
}
export interface InspectionOptions {
  owner?: string; administrative?: Record<string, string>; versionRecords?: Record<string, string>;
  targetExists?: (canonicalTarget: string) => boolean;
}
const targets = POLICY_CONFIG.targets;
export const MERGE_POLICY_HASH = POLICY_HASH;

function links(markdown: string) {
  const found: { label: string; destination: string }[] = [];
  let fenced = false;
  const mask = markdown.split(/(?<=\n)/).map(line => {
    if (/^\s*(?:```|~~~)/.test(line)) { fenced = !fenced; return line; }
    if (fenced) return line;
    return line.split(/(`+[^`\n]*`+)/g).map(part => part.startsWith('`') ? part :
      part.replace(/\[([^\]\n]+)\]\((<[^>\n]+>|[^\s)]+)\)/g, (whole: string, label: string, raw: string) => {
        const destination = raw.replace(/^<|>$/g, '');
        if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(destination)) return whole;
        found.push({ label, destination }); return `[${label}](SC_LOCAL_DESTINATION)`;
      })).join('');
  }).join('');
  return { found, mask };
}
function linkRepair(change: Change, exists?: InspectionOptions['targetExists']): boolean {
  const before = links(change.before), after = links(change.after);
  if (before.mask !== after.mask || before.found.length !== after.found.length || !exists) return false;
  let changed = 0;
  return after.found.every((link, index) => {
    if (link.destination === before.found[index]!.destination) return true;
    changed++;
    try {
      const destination = decodeURIComponent(link.destination);
      if (destination.startsWith('/') || destination.includes('\\')) return false;
      const [path, fragment] = destination.split('#');
      const canonical = `${posix.normalize(posix.join(posix.dirname(change.path), path!))}${fragment ? `#${fragment}` : ''}`;
      return targets[change.path]?.[link.label.toLowerCase()] === canonical && exists(canonical);
    } catch { return false; }
  }) && changed > 0;
}
function parsed(text: string) { return ts.createSourceFile('candidate.ts', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS); }
function boundary(text: string): string[] {
  return parsed(text).statements.flatMap(node => {
    if (ts.isImportDeclaration(node)) return [node.getText()];
    if (!ts.canHaveModifiers(node) || !ts.getModifiers(node)?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)) return [];
    if (ts.isFunctionDeclaration(node)) return [node.getText().slice(0, node.body ? node.body.getStart() - node.getStart() : undefined).trim()];
    if (ts.isVariableStatement(node)) return node.declarationList.declarations.map(declaration => {
      const initializer = declaration.initializer;
      return `${declaration.name.getText()}:${declaration.type?.getText() ?? ''}:${initializer && ts.isArrowFunction(initializer) ?
        initializer.getText().slice(0, initializer.equalsGreaterThanToken.getStart() - initializer.getStart()).trim() : declaration.getText()}`;
    });
    return [node.getText()];
  });
}
function conservativeParserShape(change: Change): boolean {
  if (digest(boundary(change.before)) !== digest(boundary(change.after))) return false;
  const forbidden = new Set(['process', 'global', 'globalThis', 'window', 'document', 'fetch', 'require', 'eval', 'Reflect', 'Proxy',
    'Function', 'WebSocket', 'XMLHttpRequest', 'Deno', 'console', 'Date', 'setTimeout', 'setInterval', 'Promise', 'constructor', '__proto__']);
  let safe = true;
  function visit(node: ts.Node) {
    if ((ts.isIdentifier(node) && forbidden.has(node.text)) ||
        (ts.isStringLiteral(node) && ['constructor', '__proto__', 'prototype'].includes(node.text)) ||
        node.kind === ts.SyntaxKind.ImportKeyword ||
        node.kind === ts.SyntaxKind.AwaitExpression || node.kind === ts.SyntaxKind.YieldExpression) safe = false;
    ts.forEachChild(node, visit);
  }
  const source = parsed(change.after); visit(source);
  return safe && !source.statements.some(statement => ts.isExpressionStatement(statement) || ts.isImportDeclaration(statement));
}
function additiveTests(change: Change): boolean {
  if (!change.after.startsWith(change.before)) return false;
  const addition = parsed(change.after.slice(change.before.length));
  let valid = true;
  function visit(node: ts.Node) {
    if (ts.isIdentifier(node) && ['beforeAll', 'beforeEach', 'afterAll', 'afterEach', 'vi', 'jest'].includes(node.text)) valid = false;
    if (ts.isPropertyAccessExpression(node) && ['skip', 'only', 'todo', 'mock'].includes(node.name.text)) valid = false;
    ts.forEachChild(node, visit);
  }
  visit(addition);
  return valid && addition.statements.length > 0 && addition.statements.every(statement => {
    if (ts.isImportDeclaration(statement)) return ts.isStringLiteral(statement.moduleSpecifier) &&
      ['vitest', 'node:assert/strict', '../../src/providers/json'].includes(statement.moduleSpecifier.text);
    if (!ts.isExpressionStatement(statement) || !ts.isCallExpression(statement.expression)) return false;
    return /^(?:it|test|describe)(?:\.|\()/.test(statement.expression.getText());
  });
}

export function classifyDiff(manifest: Manifest, changes: Change[], options: InspectionOptions = {}): Classification {
  const reasons: string[] = [], product: Change[] = [], administrative: Change[] = [];
  const paths = changes.map(change => change.path).sort();
  if (!changes.length || new Set(paths).size !== paths.length) reasons.push('empty_or_duplicate_diff');
  const ownerRoot = options.owner && /^[a-z0-9][a-z0-9-]*$/.test(options.owner) ? `openspec/changes/${options.owner}/` : null;
  for (const change of changes) {
    if (!/^[A-Za-z0-9_./-]+$/.test(change.path) || change.path.startsWith('/') || change.path.split('/').includes('..') ||
        change.mode !== '100644' || change.before.includes('\0') || change.after.includes('\0')) { reasons.push('unsafe_file'); continue; }
    if (ownerRoot && change.path.startsWith(ownerRoot)) {
      if (!/^(?:proposal\.md|design\.md|tasks\.md|\.openspec\.yaml|specs\/[a-z0-9-]+\/spec\.md)$/.test(change.path.slice(ownerRoot.length)) ||
          options.administrative?.[change.path] !== digest(change.after)) reasons.push('administrative_record_changed');
      administrative.push(change); continue;
    }
    if (['desktop/package.json', 'desktop/package-lock.json', 'README.md', 'docs/STATUS.md', 'docs/PUBLISHING.md'].includes(change.path) &&
        options.versionRecords?.[change.path] === digest(change.after)) continue;
    if (!manifest.paths.some(path => path.endsWith('/') ? change.path.startsWith(path) : change.path === path)) reasons.push('outside_scope');
    product.push(change);
  }
  if (product.length > POLICY_CONFIG.productFiles || product.reduce((sum, file) => sum + Buffer.byteLength(file.after) + Buffer.byteLength(file.before), 0) > POLICY_CONFIG.productBytes ||
      administrative.length > POLICY_CONFIG.administrativeFiles || administrative.reduce((sum, file) => sum + Buffer.byteLength(file.after), 0) > POLICY_CONFIG.administrativeBytes) reasons.push('diff_bound_exceeded');
  let category: Classification['category'] = null;
  if (manifest.scope === 'docs-links' && product.length && product.every(change => linkRepair(change, options.targetExists))) category = 'local-doc-link-repair';
  if (manifest.scope === 'providers-json' && product.some(change => change.path === 'desktop/src/providers/json.ts') &&
      product.some(change => /^desktop\/tests\/providers\/[^/]+\.test\.ts$/.test(change.path)) && product.every(change =>
      change.path === 'desktop/src/providers/json.ts' ? conservativeParserShape(change) :
        /^desktop\/tests\/providers\/[^/]+\.test\.ts$/.test(change.path) && additiveTests(change))) category = 'portable-json-parser-fix';
  if (!category) reasons.push('category_not_eligible');
  return { category, reasons: [...new Set(reasons)], paths, policyHash: MERGE_POLICY_HASH,
    diffHash: digest([...changes].sort((left, right) => left.path.localeCompare(right.path))) };
}
export function requiredChecks(paths: string[]): string[] {
  const documentation = (path: string) => /^(?:(?:README|AGENTS|CODING_STANDARDS)\.md|tests\/README\.md|desktop\/REWRITE\.md|desktop\/tests\/(?:.*\/)?README\.md|docs\/.*\.md|openspec\/changes\/.*\.(?:md|yaml))$/.test(path);
  if (paths.length && paths.every(documentation)) return ['documentation'];
  if (paths.length && paths.every(path => documentation(path) || path.startsWith('desktop/')))
    return ['documentation', 'application'];
  return ['documentation', 'application', 'agent-workflow'];
}
interface Binding { base: string; head: string; diffHash: string; policyHash: string }
export interface MergeEvidence extends Binding {
  verification: Binding & { passed: boolean; environment: string };
  review: Binding & { clean: boolean }; checks: { head: string; ready: boolean };
  protection: boolean; upToDate: boolean; integrationHold: boolean;
  regression?: { baselineFailed: boolean; candidatePassed: boolean; oracleHash: string };
  handoff?: { head: string; qualified: boolean; receiptHash: string };
}
export function decideMerge(manifest: Manifest, classification: Classification, evidence: MergeEvidence) {
  const reasons = [...classification.reasons];
  const binding: Binding = { base: evidence.base, head: evidence.head, diffHash: classification.diffHash, policyHash: classification.policyHash };
  const matches = (other: Binding) => digest({ base: other.base, head: other.head, diffHash: other.diffHash, policyHash: other.policyHash }) === digest(binding);
  if (manifest.delivery !== 'merge-eligible') reasons.push('delivery_denied');
  if (manifest.base !== evidence.base || !matches(evidence) || !matches(evidence.verification) || !matches(evidence.review)) reasons.push('stale_evidence');
  if (!evidence.verification.passed || !evidence.review.clean || !evidence.checks.ready || evidence.checks.head !== evidence.head) reasons.push('checks_not_passed');
  if (!evidence.protection || !evidence.upToDate || evidence.integrationHold) reasons.push('integration_not_ready');
  if (classification.category === 'portable-json-parser-fix' &&
      (!evidence.regression?.baselineFailed || !evidence.regression.candidatePassed || !evidence.regression.oracleHash ||
        evidence.verification.environment !== 'portable-application' || evidence.handoff?.head !== evidence.head ||
        !evidence.handoff.qualified || !/^[a-f0-9]{64}$/.test(evidence.handoff.receiptHash))) reasons.push('application_evidence_missing');
  if (classification.category === 'portable-json-parser-fix' && !POLICY_CONFIG.parserAutoMerge)
    reasons.push('parser_purity_policy_pending');
  return { eligible: reasons.length === 0, reasons: [...new Set(reasons)], ...binding,
    category: classification.category, evidenceHash: digest(evidence) };
}
