import * as fs from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { FileHandle } from 'node:fs/promises';
import { campaign, CAMPAIGN_CAP } from './cases';

const CAMPAIGN = 'sc-beta4-deepseek-visual-v1';
const RUN_IDS = new Set(campaign().map(run => run.id));
export const STAGES = ['Preflight', 'Locate', 'Extract', 'Answer'] as const;
export type ContactStage = typeof STAGES[number];
export type RunStatus = 'passed' | 'failed';
interface Header { kind: 'header'; schema: 1; campaign: typeof CAMPAIGN; cap: 120; priorCalls: number }
export interface Contact { kind: 'contact'; sequence: number; runId: string; attempt: number; stage: ContactStage }
interface Completed { kind: 'completed'; runId: string; attempt: number; status: RunStatus }
type RecordLine = Header | Contact | Completed;
const validInteger = (value: unknown, min: number, max: number): value is number => Number.isSafeInteger(value) && Number(value) >= min && Number(value) <= max;
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const keys = (value: Record<string, unknown>, names: string[]): boolean => Object.keys(value).sort().join(',') === names.sort().join(',');
const hasCode = (value: unknown, code: string): boolean => object(value) && value.code === code;
export class LedgerError extends Error {
  constructor(readonly code: 'locked' | 'invalid' | 'cap' | 'io' | 'closed') { super(`Campaign ledger ${code}. No new contact is authorized.`); }
}

/** One process owns the entire campaign. No automatic stale-lock removal or ledger repair. */
export class CampaignLedger {
  private records: RecordLine[];
  private queued: Promise<unknown> = Promise.resolve();
  private closed = false;
  private poisoned = false;
  private constructor(private readonly path: string, private readonly file: FileHandle, private readonly lock: FileHandle, records: RecordLine[]) { this.records = records; }

  static async open(path: string, priorCalls = 0): Promise<CampaignLedger> {
    if (path !== resolve(path) || !validInteger(priorCalls, 0, CAMPAIGN_CAP)) throw new LedgerError('invalid');
    let lock: FileHandle;
    try { lock = await fs.open(path + '.lock', 'wx', 0o600); }
    catch (error) { throw new LedgerError(hasCode(error, 'EEXIST') ? 'locked' : 'io'); }
    let file: FileHandle | undefined;
    try {
      await lock.writeFile('{"schema":1}\n'); await lock.sync();
      try {
        const stat = await fs.lstat(path);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > 512 * 1024) throw new LedgerError('invalid');
        file = await fs.open(path, 'a+');
      } catch (error) {
        if (!hasCode(error, 'ENOENT')) throw error;
        file = await fs.open(path, 'wx+', 0o600);
        const header: Header = { kind: 'header', schema: 1, campaign: CAMPAIGN, cap: 120, priorCalls };
        await file.writeFile(JSON.stringify(header) + '\n'); await file.sync();
        // Flush creation before a network contact; Windows does not support directory fsync.
        if (process.platform !== 'win32') { const directory = await fs.open(dirname(path), 'r'); try { await directory.sync(); } finally { await directory.close(); } }
      }
      const text = await fs.readFile(path, 'utf8');
      const records = CampaignLedger.parse(text);
      const header = records[0] as Header;
      if (priorCalls !== 0 && priorCalls !== header.priorCalls) throw new LedgerError('invalid');
      return new CampaignLedger(path, file, lock, records);
    } catch (error) {
      await file?.close().catch(() => {}); await lock.close().catch(() => {}); await fs.unlink(path + '.lock').catch(() => {});
      throw error instanceof LedgerError ? error : new LedgerError('io');
    }
  }
  private static parse(text: string): RecordLine[] {
    if (!text.endsWith('\n') || text.length > 512 * 1024) throw new LedgerError('invalid');
    const records: RecordLine[] = [];
    let count = 0;
    for (const [index, line] of text.slice(0, -1).split('\n').entries()) {
      let value: unknown;
      try { value = JSON.parse(line); } catch { throw new LedgerError('invalid'); }
      if (!object(value)) throw new LedgerError('invalid');
      if (index === 0) {
        if (!keys(value, ['kind', 'schema', 'campaign', 'cap', 'priorCalls']) || value.kind !== 'header' || value.schema !== 1 || value.campaign !== CAMPAIGN || value.cap !== CAMPAIGN_CAP || !validInteger(value.priorCalls, 0, CAMPAIGN_CAP)) throw new LedgerError('invalid');
        count = value.priorCalls;
      } else {
        if (typeof value.runId !== 'string' || !RUN_IDS.has(value.runId) || !validInteger(value.attempt, 1, CAMPAIGN_CAP + 1)) throw new LedgerError('invalid');
        if (value.kind === 'contact') {
          if (!keys(value, ['kind', 'sequence', 'runId', 'attempt', 'stage']) || value.sequence !== ++count || count > CAMPAIGN_CAP || !STAGES.includes(value.stage as ContactStage)) throw new LedgerError('invalid');
        } else if (value.kind === 'completed') {
          if (!keys(value, ['kind', 'runId', 'attempt', 'status']) || !['passed', 'failed'].includes(String(value.status))) throw new LedgerError('invalid');
          if (records.some(item => item.kind === 'completed' && item.runId === value.runId && item.attempt === value.attempt)) throw new LedgerError('invalid');
        } else throw new LedgerError('invalid');
      }
      records.push(value as unknown as RecordLine);
    }
    return records;
  }
  get count(): number { return (this.records[0] as Header).priorCalls + this.records.filter(item => item.kind === 'contact').length; }
  get remaining(): number { return CAMPAIGN_CAP - this.count; }
  completed(runId: string): boolean { return this.records.some(item => item.kind === 'completed' && item.runId === runId); }
  latestStatus(runId: string): RunStatus | null {
    return this.records.filter((item): item is Completed => item.kind === 'completed' && item.runId === runId).at(-1)?.status ?? null;
  }
  nextAttempt(runId: string): number {
    return 1 + Math.max(0, ...this.records.filter((item): item is Contact | Completed => item.kind !== 'header' && item.runId === runId).map(item => item.attempt));
  }
  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const pending = this.queued.then(async () => { if (this.closed) throw new LedgerError('closed'); if (this.poisoned) throw new LedgerError('io'); return operation(); });
    this.queued = pending.catch(() => {});
    return pending;
  }
  private async append(record: RecordLine): Promise<void> {
    try { await this.file.writeFile(JSON.stringify(record) + '\n'); await this.file.sync(); }
    catch { this.poisoned = true; throw new LedgerError('io'); }
    this.records.push(record);
  }
  /** The caller MUST await this durable reservation immediately before its actual transport send. */
  reserve(runId: string, attempt: number, stage: ContactStage): Promise<Contact> {
    return this.enqueue(async () => {
      if (!RUN_IDS.has(runId) || !validInteger(attempt, 1, CAMPAIGN_CAP + 1) || !STAGES.includes(stage)) throw new LedgerError('invalid');
      if (this.count >= CAMPAIGN_CAP) throw new LedgerError('cap');
      const contact: Contact = { kind: 'contact', sequence: this.count + 1, runId, attempt, stage };
      await this.append(contact);
      return { ...contact };
    });
  }
  finish(runId: string, attempt: number, status: RunStatus): Promise<void> {
    return this.enqueue(async () => {
      if (!RUN_IDS.has(runId) || !validInteger(attempt, 1, CAMPAIGN_CAP + 1) || !['passed', 'failed'].includes(status) || this.records.some(item => item.kind === 'completed' && item.runId === runId && item.attempt === attempt)) throw new LedgerError('invalid');
      await this.append({ kind: 'completed', runId, attempt, status });
    });
  }
  async close(): Promise<void> {
    await this.queued;
    if (this.closed) return;
    this.closed = true;
    await this.file.close(); await this.lock.close(); await fs.unlink(this.path + '.lock');
  }
}
