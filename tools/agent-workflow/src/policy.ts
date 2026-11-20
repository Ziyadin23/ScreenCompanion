import ts from 'typescript';
import { POLICY_CONFIG } from './policy-config.js';
import { posix } from 'node:path';
import { digest, POLICY_HASH, type Manifest } from './manifest.js';
import { validateVersionChanges, type VersionReservation } from './delivery.js';

export interface Change { path: string; before: string; after: string; mode: string }
export interface Classification {
  category: 'local-doc-link-repair' | 'portable-json-parser-fix' | null;
  reasons: string[]; diffHash: string; policyHash: string; paths: string[];
}
export interface InspectionOptions {
  owner?: string; administrative?: Record<string, string>; versionRecords?: Record<string, string>;
  versionReservation?: VersionReservation;
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
      if (/[\s\0?]/.test(destination) || destination.split('#').length > 2) return false;
      const [path, fragment] = destination.split('#');
      const canonical = `${posix.normalize(posix.join(posix.dirname(change.path), path!))}${fragment ? `#${fragment}` : ''}`;
      const relative = `${posix.relative(posix.dirname(change.path), canonical.split('#')[0]!)}${fragment ? `#${fragment}` : ''}`;
      return destination === relative && targets[change.path]?.[link.label.toLowerCase()] === canonical && exists(canonical);
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
  const before = parsed(change.before), after = parsed(change.after);
  if (before.statements.length !== after.statements.length) return false;
  let changed = 0;
  return after.statements.every((node, index) => {
    const previous = before.statements[index]!;
    if (node.getText(after) === previous.getText(before)) return true;
    changed++;
    if (!ts.isFunctionDeclaration(node) || !ts.isFunctionDeclaration(previous) ||
        node.name?.text !== 'parseJson' || previous.name?.text !== 'parseJson' || !node.body || !previous.body) return false;
    const scanner = (body: ts.Block) => body.statements.slice(1).map(statement => statement.getText());
    if (digest(scanner(previous.body)) !== POLICY_CONFIG.parserScanner ||
        digest(scanner(node.body)) !== POLICY_CONFIG.parserScanner) return false;
    const first = node.body.statements[0];
    if (!first || !ts.isVariableStatement(first) || first.declarationList.flags !== ts.NodeFlags.Const ||
        first.declarationList.declarations.length !== 1) return false;
    const value = first.declarationList.declarations[0]!;
    if (value.name.getText() !== 'value' || value.type?.kind !== ts.SyntaxKind.UnknownKeyword ||
        !value.initializer || !ts.isCallExpression(value.initializer) ||
        value.initializer.expression.getText() !== 'JSON.parse' || value.initializer.arguments.length !== 1 ||
        value.initializer.typeArguments?.length) return false;
    // The accepted subset only normalizes the primitive input before the frozen JSON/duplicate checks.
    function input(expression: ts.Expression): boolean {
      if (ts.isIdentifier(expression)) return expression.text === 'text';
      if (!ts.isCallExpression(expression) || expression.typeArguments?.length ||
          !ts.isPropertyAccessExpression(expression.expression) || expression.questionDotToken ||
          expression.expression.questionDotToken || !input(expression.expression.expression)) return false;
      const args = expression.arguments, method = expression.expression.name.text;
      if (method === 'trim') return args.length === 0;
      return method === 'replace' && args.length === 2 && args[0]!.kind === ts.SyntaxKind.RegularExpressionLiteral &&
        ['/^\\uFEFF/', '/^```(?:json)?\\s*|\\s*```$/g'].includes(args[0]!.getText()) &&
        ts.isStringLiteral(args[1]!) && args[1]!.text === '';
    }
    return input(value.initializer.arguments[0]!);
  }) && changed === 1;
}
function additiveTests(change: Change): boolean {
  if (!change.after.startsWith(change.before)) return false;
  const addition = parsed(change.after.slice(change.before.length));
  let valid = true;
  const names = new Set(['it', 'test', 'describe', 'expect', 'assert', 'parseJson', 'isObject', 'hasFields', 'nonblank']);
  const matchers = new Set(['toEqual', 'toStrictEqual', 'toBe', 'toThrow', 'toMatchObject', 'toBeNull', 'toBeUndefined', 'toBeTruthy', 'toBeFalsy']);
  function visit(node: ts.Node) {
    if (ts.isIdentifier(node) && !names.has(node.text) &&
        !(ts.isPropertyAssignment(node.parent) && node.parent.name === node) &&
        !(ts.isPropertyAccessExpression(node.parent) && node.parent.name === node)) valid = false;
    if (ts.isVariableDeclaration(node) || ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isMethodDeclaration(node) ||
        ts.isGetAccessor(node) || ts.isSetAccessor(node) || ts.isNewExpression(node) || ts.isDeleteExpression(node) ||
        ts.isElementAccessExpression(node) || ts.isTaggedTemplateExpression(node) || ts.isAwaitExpression(node) || ts.isYieldExpression(node) ||
        ts.isPostfixUnaryExpression(node) || ts.isPrefixUnaryExpression(node) &&
          [ts.SyntaxKind.PlusPlusToken, ts.SyntaxKind.MinusMinusToken].includes(node.operator) ||
        ts.isBinaryExpression(node) && node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
          node.operatorToken.kind <= ts.SyntaxKind.LastAssignment) valid = false;
    if (ts.isArrowFunction(node) && (node.parameters.length !== 0 || node.modifiers?.length)) valid = false;
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      if (ts.isIdentifier(callee)) {
        if (!names.has(callee.text)) valid = false;
      } else if (ts.isPropertyAccessExpression(callee)) {
        let receiver = callee.expression;
        if (ts.isPropertyAccessExpression(receiver) && receiver.name.text === 'not') receiver = receiver.expression;
        if (!(matchers.has(callee.name.text) && ts.isCallExpression(receiver) && receiver.expression.getText() === 'expect') &&
            !(callee.expression.getText() === 'assert' && ['equal', 'deepEqual', 'strictEqual', 'deepStrictEqual', 'throws'].includes(callee.name.text))) valid = false;
      } else valid = false;
    }
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

/** This existing lab case must retain its fidelity assertions when option text becomes mandatory. */
export function labFidelityFixtureCorrection(change: Change): boolean {
  if (change.path !== 'desktop/tests/lab/campaign.test.ts' || change.mode !== '100644') return false;
  const literal = "content.questions[0].options = [{ id: 'Z', text: null }];";
  if (change.before.split(literal).length !== 2) return false;
  const corrected = change.before.replace(literal, "content.questions[0].options = [{ id: 'Z', text: 'Wrong option text' }];");
  if (change.after === corrected) return true;
  const title = 'fails %s required fidelity when production normalizes an extraction the observer cannot read';
  const comment = '// The actual pipeline accepts/answers this non-choice extraction; missing evidence must independently fail the lab.';
  return change.before.split(title).length === 2 && change.before.split(comment).length === 2 &&
    change.after === corrected.replace(title, 'fails %s required fidelity for a well-formed but incorrect extraction')
      .replace(comment, '// A well-formed extraction can answer correctly; wrong transcription must independently fail the lab.');
}

export function classifyDiff(manifest: Manifest, changes: Change[], options: InspectionOptions = {}): Classification {
  const reasons: string[] = [], product: Change[] = [], administrative: Change[] = [];
  const paths = changes.map(change => change.path).sort();
  if (!changes.length || new Set(paths).size !== paths.length) reasons.push('empty_or_duplicate_diff');
  const ownerRoot = options.owner && /^[a-z0-9][a-z0-9-]*$/.test(options.owner) ? `openspec/changes/${options.owner}/` : null;
  const versionPaths = ['desktop/package.json', 'desktop/package-lock.json', 'README.md', 'docs/PUBLISHING.md', 'docs/STATUS.md'];
  const versionChanges = changes.filter(change => Object.hasOwn(options.versionRecords ?? {}, change.path));
  if (Object.keys(options.versionRecords ?? {}).length) {
    try {
      const previousVersion = /^(\d+\.\d+\.\d+)-beta\.(\d+)$/.exec(options.versionReservation?.previousVersion ?? '');
      const version = /^(\d+\.\d+\.\d+)-beta\.(\d+)$/.exec(options.versionReservation?.version ?? '');
      if (manifest.scope === 'docs-links' || !options.versionReservation ||
          options.versionReservation.repository !== manifest.repository || options.versionReservation.runId !== manifest.id ||
          !previousVersion || !version || previousVersion[1] !== version[1] ||
          !Number.isSafeInteger(Number(previousVersion[2])) || !Number.isSafeInteger(Number(version[2])) ||
          Number(version[2]) <= Number(previousVersion[2]) ||
          digest(Object.keys(options.versionRecords!).sort()) !== digest([...versionPaths].sort())) throw new Error('Invalid version authority');
      validateVersionChanges(versionPaths.map(path => {
        const change = versionChanges.find(file => file.path === path);
        if (!change || change.mode !== '100644' || options.versionRecords![path] !== digest(change.after)) throw new Error('Invalid version record');
        return { ...change, mode: '100644' as const };
      }), options.versionReservation);
    } catch { reasons.push('version_record_changed'); }
  }
  for (const change of changes) {
    if (!/^[A-Za-z0-9_./-]+$/.test(change.path) || change.path.startsWith('/') || change.path.split('/').includes('..') ||
        posix.normalize(change.path) !== change.path || change.mode !== '100644' || change.before.includes('\0') || change.after.includes('\0')) { reasons.push('unsafe_file'); continue; }
    if (ownerRoot && change.path.startsWith(ownerRoot)) {
      if (!/^(?:proposal\.md|design\.md|tasks\.md|\.openspec\.yaml|specs\/[a-z0-9-]+\/spec\.md)$/.test(change.path.slice(ownerRoot.length)) ||
          options.administrative?.[change.path] !== digest(change.after)) reasons.push('administrative_record_changed');
      administrative.push(change); continue;
    }
    if (versionPaths.includes(change.path) &&
        options.versionRecords?.[change.path] === digest(change.after)) continue;
    if (manifest.scope === 'pipeline' && change.path === 'desktop/tests/lab/campaign.test.ts' && !labFidelityFixtureCorrection(change))
      reasons.push('outside_scope');
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
  regression?: { base: string; head: string; baselineFailed: boolean; candidatePassed: boolean; oracleHash: string; contractHash: string };
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
        evidence.regression.base !== evidence.base || evidence.regression.head !== evidence.head ||
        !/^[a-f0-9]{64}$/.test(evidence.regression.oracleHash) || !/^[a-f0-9]{64}$/.test(evidence.regression.contractHash) ||
        evidence.verification.environment !== 'portable-application' || evidence.handoff?.head !== evidence.head ||
        !evidence.handoff.qualified || !/^[a-f0-9]{64}$/.test(evidence.handoff.receiptHash))) reasons.push('application_evidence_missing');
  if (classification.category === 'portable-json-parser-fix' && !POLICY_CONFIG.parserAutoMerge)
    reasons.push('parser_purity_policy_pending');
  return { eligible: reasons.length === 0, reasons: [...new Set(reasons)], ...binding,
    category: classification.category, evidenceHash: digest(evidence) };
}
