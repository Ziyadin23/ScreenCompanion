import * as fs from 'node:fs/promises';
import type { FileHandle } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { campaign, visualCase } from './cases';
import type { HistoricalRunMetadata, RunMetadata } from './measure';
import { FIDELITY_FLAGS } from './oracle';
import { exactKeys, isCandidate, isPhase, phaseRuns } from './campaign';
import { PIPELINE_CODES } from './technical';
import { DurableFile } from './durable';

const RUNS = new Set(campaign().map(run => run.id));
const STAGES = new Set(['Preflight', 'Locate', 'Crop', 'Extract', 'Answer', 'ValidateAnswer', 'Harness']);
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const count = (value: unknown): boolean => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const keys = (value: Record<string, unknown>, names: string[]): boolean => Object.keys(value).sort().join(',') === names.sort().join(',');
const usage = (value: unknown): boolean => value === null || object(value) && keys(value, ['inputTokens', 'outputTokens', 'cachedInputTokens', 'cacheWriteTokens', 'reasoningTokens']) && Object.values(value).every(item => item === null || count(item));
export function isHistoricalRunMetadata(value: unknown): value is HistoricalRunMetadata {
  return object(value) && keys(value, ['schema', 'runId', 'attempt', 'status', 'stage', 'elapsedMilliseconds', 'actualSends', 'expectedCalls', 'budgetMatched',
    'canonicalPrimary', 'displayedFirstLine', 'displayedCoverage', 'extractionFidelity', 'refusal', 'cropCount', 'contacts', 'stages']) &&
    value.schema === 1 && typeof value.runId === 'string' && RUNS.has(value.runId) && ['passed', 'failed'].includes(String(value.status)) &&
    (value.stage === null || typeof value.stage === 'string' && STAGES.has(value.stage)) &&
    ['attempt', 'elapsedMilliseconds', 'actualSends', 'expectedCalls', 'cropCount'].every(key => count(value[key])) &&
    ['budgetMatched', 'canonicalPrimary', 'displayedFirstLine', 'displayedCoverage', 'refusal'].every(key => typeof value[key] === 'boolean') &&
    (value.extractionFidelity === null || typeof value.extractionFidelity === 'boolean') && Array.isArray(value.contacts) && value.contacts.every(item =>
      object(item) && keys(item, ['sequence', 'stage', 'status', 'httpStatus', 'elapsedMilliseconds', 'usage']) && count(item.sequence) && typeof item.stage === 'string' && STAGES.has(item.stage) &&
      ['returned', 'failed'].includes(String(item.status)) && (item.httpStatus === null || count(item.httpStatus)) && count(item.elapsedMilliseconds) && usage(item.usage)) &&
    Array.isArray(value.stages) && value.stages.every(item => object(item) && keys(item, ['stage', 'attempt', 'status', 'elapsedMilliseconds', 'httpStatus']) &&
      typeof item.stage === 'string' && STAGES.has(item.stage) && count(item.attempt) && ['Started', 'Completed', 'Failed'].includes(String(item.status)) &&
      count(item.elapsedMilliseconds) && (item.httpStatus === null || count(item.httpStatus)));
}
export function isRunMetadata(value: unknown): value is RunMetadata {
  if (!object(value) || !keys(value, ['schema', 'candidate', 'phase', 'runId', 'attempt', 'status', 'stage', 'pipelineCode', 'extractionComponents', 'visualCoverage',
    'elapsedMilliseconds', 'actualSends', 'expectedCalls', 'budgetMatched', 'canonicalPrimary', 'displayedFirstLine', 'displayedCoverage', 'extractionFidelity',
    'refusal', 'cropCount', 'contacts', 'stages']) || value.schema !== 2 || !isCandidate(value.candidate) || !isPhase(value.phase) ||
    !(value.pipelineCode === null || PIPELINE_CODES.includes(value.pipelineCode as typeof PIPELINE_CODES[number])) ||
    !(value.extractionComponents === null || object(value.extractionComponents) && exactKeys(value.extractionComponents, FIDELITY_FLAGS) && Object.values(value.extractionComponents).every(item => typeof item === 'boolean')) ||
    !(value.visualCoverage === null || object(value.visualCoverage) && keys(value.visualCoverage, ['observed', 'diagram', 'labels']) && Object.values(value.visualCoverage).every(item => typeof item === 'boolean'))) return false;
  const { candidate: _candidate, phase: _phase, pipelineCode: _pipelineCode, extractionComponents: _extractionComponents, visualCoverage: _visualCoverage, ...base } = value;
  if (!isHistoricalRunMetadata({ ...base, schema: 1 })) return false;
  const metadata = value as unknown as RunMetadata, run = phaseRuns(metadata.phase).find(run => run.id === metadata.runId);
  if (!run || metadata.attempt < 1 || metadata.expectedCalls !== run.expectedCalls || metadata.actualSends !== metadata.contacts.length ||
      metadata.budgetMatched !== (metadata.actualSends === metadata.expectedCalls) || new Set(metadata.contacts.map(contact => contact.sequence)).size !== metadata.contacts.length) return false;
  const fixture = run.caseId ? visualCase(run.caseId) : null;
  const extractionApplicable = fixture !== null && run.mode !== 'Direct' && !fixture.typed;
  if ((metadata.extractionComponents !== null) !== extractionApplicable || metadata.extractionFidelity !==
      (metadata.extractionComponents === null ? null : Object.values(metadata.extractionComponents).every(Boolean))) return false;
  if ((metadata.visualCoverage !== null) !== Boolean(fixture?.questions.some(question => question.diagram) && run.mode !== 'Direct')) return false;
  if (metadata.status === 'passed' && (!metadata.canonicalPrimary || !metadata.displayedFirstLine || !metadata.displayedCoverage || !metadata.budgetMatched ||
      metadata.extractionFidelity === false || metadata.visualCoverage !== null && !Object.values(metadata.visualCoverage).every(Boolean) ||
      metadata.stage !== null || metadata.pipelineCode !== null || metadata.refusal)) return false;
  return true;
}
/** Historical schema1 and current schema2 records are readable here without obtaining a writable handle. */
export async function readMetadataResults(path: string): Promise<(HistoricalRunMetadata | RunMetadata)[]> {
  const existing = await fs.readFile(path, 'utf8');
  if (!existing.endsWith('\n') || existing.length > 2 * 1024 * 1024) throw new Error('Invalid metadata results.');
  const records: (HistoricalRunMetadata | RunMetadata)[] = [];
  for (const line of existing.trimEnd().split('\n')) {
    let value: unknown;
    try { value = JSON.parse(line); } catch { throw new Error('Invalid metadata results.'); }
    if (!isHistoricalRunMetadata(value) && !isRunMetadata(value)) throw new Error('Invalid metadata results.');
    records.push(value);
  }
  return records;
}
/** Resolve symlinks in existing parents before rejecting all repository/vault output destinations. */
export async function privateDestinations(projectRoot: string, ledger: string, results: string): Promise<void> {
  const root = await fs.realpath(projectRoot);
  const canonical: string[] = [];
  for (const path of [ledger, results]) {
    if (!isAbsolute(path) || path !== resolve(path)) throw new Error('Private absolute normalized output paths are required.');
    const parent = await fs.realpath(dirname(path));
    const target = resolve(parent, path.slice(dirname(path).length + 1));
    const normalize = (value: string): string => process.platform === 'win32' ? value.toLowerCase() : value;
    const contained = (base: string): boolean => { const part = relative(normalize(base), normalize(target)); return part === '' || part !== '..' && !part.startsWith('..' + sep) && !isAbsolute(part); };
    if (contained(root) || (process.env.LOCALAPPDATA && contained(resolve(process.env.LOCALAPPDATA, 'SC')))) throw new Error('Output paths must be outside the checkout and normal SC vault folder.');
    try { const stat = await fs.lstat(path); if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) throw new Error('Output destination is not a regular private file.'); }
    catch (error) { if (!object(error) || error.code !== 'ENOENT') throw error; }
    canonical.push(normalize(target));
  }
  if (canonical[0] === canonical[1] || canonical[0] + '.lock' === canonical[1] || canonical[1] + '.lock' === canonical[0]) throw new Error('Ledger and results require distinct private files.');
}

/** Only this allowlisted metadata schema can reach the durable results file or stdout. */
export class MetadataResults {
  private closed = false;
  private poisoned = false;
  private constructor(private readonly durable: DurableFile, private readonly lock: FileHandle, private readonly lockPath: string,
    readonly records: RunMetadata[]) {}
  static async open(path: string): Promise<MetadataResults> {
    let lock: FileHandle | undefined, durable: DurableFile | undefined;
    try {
      lock = await fs.open(path + '.lock', 'wx', 0o600);
      durable = await DurableFile.openExisting(path, 2 * 1024 * 1024);
      const existing = durable.snapshot.toString('utf8');
      if (existing && (!existing.endsWith('\n') || !existing.trimEnd().split('\n').every(line => isRunMetadata(JSON.parse(line))))) throw new Error('Invalid results file.');
      const records = existing ? existing.trimEnd().split('\n').map(line => JSON.parse(line) as RunMetadata) : [];
      return new MetadataResults(durable, lock, path + '.lock', records);
    } catch {
      await durable?.close().catch(() => {});
      if (lock) { await lock.close().catch(() => {}); await fs.unlink(path + '.lock').catch(() => {}); }
      throw new Error('Private metadata results could not be opened or locked. No new contact is authorized.');
    }
  }
  async verify(): Promise<void> {
    if (this.closed || this.poisoned) throw new Error('Private metadata results are unavailable. No new contact is authorized.');
    try { await this.durable.verify(); }
    catch { this.poisoned = true; throw new Error('Private metadata results changed. No new contact is authorized.'); }
  }
  async append(metadata: RunMetadata): Promise<void> {
    if (this.closed || this.poisoned || !isRunMetadata(metadata)) throw new Error('Unsafe result metadata was rejected.');
    const line = JSON.stringify(metadata);
    try {
      await this.durable.append(Buffer.from(line + '\n'));
    }
    catch { this.poisoned = true; throw new Error('Private metadata result write failed. No new contact is authorized.'); }
    this.records.push(JSON.parse(line) as RunMetadata);
    console.log(line);
  }
  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    try { await this.durable.close(); } finally { try { await this.lock.close(); } finally { await fs.unlink(this.lockPath); } }
  }
}
