import * as fs from 'node:fs/promises';
import type { FileHandle } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { campaign } from './cases';
import type { RunMetadata } from './measure';

const RUNS = new Set(campaign().map(run => run.id));
const STAGES = new Set(['Preflight', 'Locate', 'Crop', 'Extract', 'Answer', 'ValidateAnswer', 'Harness']);
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const count = (value: unknown): boolean => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const keys = (value: Record<string, unknown>, names: string[]): boolean => Object.keys(value).sort().join(',') === names.sort().join(',');
const usage = (value: unknown): boolean => value === null || object(value) && keys(value, ['inputTokens', 'outputTokens', 'cachedInputTokens', 'cacheWriteTokens', 'reasoningTokens']) && Object.values(value).every(item => item === null || count(item));
export function isRunMetadata(value: unknown): value is RunMetadata {
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
  private constructor(private readonly path: string, private readonly file: FileHandle, private readonly lock: FileHandle) {}
  static async open(path: string): Promise<MetadataResults> {
    let lock: FileHandle | undefined, file: FileHandle | undefined;
    try {
      lock = await fs.open(path + '.lock', 'wx', 0o600);
      try {
        const stat = await fs.lstat(path);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > 2 * 1024 * 1024) throw new Error('Invalid results file.');
        const existing = await fs.readFile(path, 'utf8');
        if (existing && (!existing.endsWith('\n') || !existing.trimEnd().split('\n').every(line => isRunMetadata(JSON.parse(line))))) throw new Error('Invalid results file.');
      } catch (error) { if (!object(error) || error.code !== 'ENOENT') throw error; }
      file = await fs.open(path, 'a', 0o600);
      return new MetadataResults(path, file, lock);
    } catch {
      await file?.close().catch(() => {});
      if (lock) { await lock.close().catch(() => {}); await fs.unlink(path + '.lock').catch(() => {}); }
      throw new Error('Private metadata results could not be opened or locked. No new contact is authorized.');
    }
  }
  async append(metadata: RunMetadata): Promise<void> {
    if (!isRunMetadata(metadata)) throw new Error('Unsafe result metadata was rejected.');
    const line = JSON.stringify(metadata);
    await this.file.writeFile(line + '\n'); await this.file.sync();
    console.log(line);
  }
  async close(): Promise<void> { await this.file.close(); await this.lock.close(); await fs.unlink(this.path + '.lock'); }
}
