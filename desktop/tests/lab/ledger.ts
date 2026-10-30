import * as fs from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import type { FileHandle } from 'node:fs/promises';
import { campaign, CAMPAIGN_CAP } from './cases';
import { CAMPAIGN_ID, PHASE_LIMITS, candidateAllowed, exactKeys, isCandidate, isIdentity, isObject, phaseRuns, readManifest, samePath,
  type CampaignIdentity, type CampaignManifest, type CampaignPhase } from './campaign';
import type { RunMetadata } from './measure';
import { isRunMetadata } from './results';
import { DurableFile } from './durable';

const RUN_IDS = new Set(campaign().map(run => run.id));
export const STAGES = ['Preflight', 'Locate', 'Extract', 'Answer'] as const;
export type ContactStage = typeof STAGES[number];
export type RunStatus = 'passed' | 'failed';
interface Header { kind: 'header'; schema: 2; campaign: typeof CAMPAIGN_ID; cap: 120; diagnosticCandidate: string; qualificationCandidate: null }
interface Frozen { kind: 'frozen'; candidate: string }
export interface Contact extends CampaignIdentity { kind: 'contact'; sequence: number; runId: string; attempt: number; stage: ContactStage }
interface Completed extends CampaignIdentity { kind: 'completed'; runId: string; attempt: number; status: RunStatus }
type RecordLine = Header | Frozen | Contact | Completed;
const integer = (value: unknown, min: number, max: number): value is number => Number.isSafeInteger(value) && Number(value) >= min && Number(value) <= max;
const hasCode = (value: unknown, code: string): boolean => isObject(value) && value.code === code;
const sameIdentity = (value: CampaignIdentity, identity: CampaignIdentity): boolean => value.phase === identity.phase && value.candidate === identity.candidate;
const attemptContacts = (records: readonly RecordLine[], identity: CampaignIdentity, runId: string, attempt: number): Contact[] =>
  records.filter((item): item is Contact => item.kind === 'contact' && sameIdentity(item, identity) && item.runId === runId && item.attempt === attempt);
export class LedgerError extends Error {
  constructor(readonly code: 'locked' | 'invalid' | 'cap' | 'io' | 'closed' | 'phase' | 'unresolved') { super(`Campaign ledger ${code}. No new contact is authorized.`); }
}

/** Historical beta.4 is strictly read-only. This function never opens an append handle or lock. */
export async function readHistoricalLedger(path: string): Promise<{ schema: 1; count: number }> {
  const text = await fs.readFile(path, 'utf8');
  if (!text.endsWith('\n') || text.length > 512 * 1024) throw new LedgerError('invalid');
  let count = 0;
  const completed = new Set<string>();
  for (const [index, line] of text.slice(0, -1).split('\n').entries()) {
    let value: unknown;
    try { value = JSON.parse(line); } catch { throw new LedgerError('invalid'); }
    if (!isObject(value)) throw new LedgerError('invalid');
    if (index === 0) {
      if (!exactKeys(value, ['kind', 'schema', 'campaign', 'cap', 'priorCalls']) || value.kind !== 'header' || value.schema !== 1 ||
          value.campaign !== 'sc-beta4-deepseek-visual-v1' || value.cap !== 120 || !integer(value.priorCalls, 0, 120)) throw new LedgerError('invalid');
      count = value.priorCalls;
    } else {
      if (typeof value.runId !== 'string' || !RUN_IDS.has(value.runId) || !integer(value.attempt, 1, 121)) throw new LedgerError('invalid');
      const key = `${value.runId}/${value.attempt}`;
      if (value.kind === 'contact') {
        if (!exactKeys(value, ['kind', 'sequence', 'runId', 'attempt', 'stage']) || value.sequence !== ++count || count > 120 || !STAGES.includes(value.stage as ContactStage)) throw new LedgerError('invalid');
      } else if (value.kind === 'completed') {
        if (!exactKeys(value, ['kind', 'runId', 'attempt', 'status']) || !['passed', 'failed'].includes(String(value.status)) || completed.has(key)) throw new LedgerError('invalid');
        completed.add(key);
      } else throw new LedgerError('invalid');
    }
  }
  return { schema: 1, count };
}

/** Coordinator initializes the fixed registry/counter once; opening never creates or resets an allowance. */
export class CampaignLedger {
  private queued: Promise<unknown> = Promise.resolve();
  private closed = false;
  private poisoned = false;
  private readonly ownedAttempts = new Set<string>();
  private readonly claimedRuns = new Set<string>();
  readonly resultsPath: string;
  private constructor(private readonly registry: string, private readonly manifest: CampaignManifest,
    readonly identity: CampaignIdentity, private readonly file: DurableFile, private readonly lock: FileHandle,
    private readonly lockPath: string, private readonly records: RecordLine[]) { this.resultsPath = join(dirname(registry), 'results.jsonl'); }

  static async open(registry: string, identity: CampaignIdentity): Promise<CampaignLedger> {
    if (registry !== resolve(registry) || !isIdentity(identity)) throw new LedgerError('invalid');
    let lock: FileHandle;
    const lockPath = join(dirname(registry), 'campaign.lock'), path = join(dirname(registry), 'ledger.jsonl');
    // Canonical parents make path aliases use the same lock and prevent a second output namespace.
    try { if (!samePath(await fs.realpath(dirname(registry)), dirname(registry))) throw new LedgerError('invalid'); }
    catch { throw new LedgerError('invalid'); }
    try { lock = await fs.open(lockPath, 'wx', 0o600); }
    catch (error) { throw new LedgerError(hasCode(error, 'EEXIST') ? 'locked' : 'io'); }
    let file: DurableFile | undefined;
    try {
      await lock.writeFile('{"schema":2}\n'); await lock.sync();
      const manifest = await readManifest(registry);
      if (!candidateAllowed(manifest, identity)) throw new LedgerError('invalid');
      file = await DurableFile.openExisting(path, 512 * 1024);
      const records = CampaignLedger.parse(file.snapshot.toString('utf8'), manifest);
      const ledger = new CampaignLedger(registry, manifest, { ...identity }, file, lock, lockPath, records);
      const frozen = records.find((item): item is Frozen => item.kind === 'frozen');
      if (manifest.qualificationCandidate && !frozen) await ledger.append({ kind: 'frozen', candidate: manifest.qualificationCandidate });
      return ledger;
    } catch (error) {
      await file?.close().catch(() => {}); await lock.close().catch(() => {}); await fs.unlink(lockPath).catch(() => {});
      throw error instanceof LedgerError ? error : new LedgerError('invalid');
    }
  }
  private static parse(text: string, manifest: CampaignManifest): RecordLine[] {
    if (!text.endsWith('\n') || text.length > 512 * 1024) throw new LedgerError('invalid');
    const records: RecordLine[] = [];
    let count = 0, frozen: string | null = null;
    const phaseCounts: Record<CampaignPhase, number> = { 'initial-preflight': 0, diagnostic: 0, qualification: 0, reserve: 0 };
    for (const [index, line] of text.slice(0, -1).split('\n').entries()) {
      let value: unknown;
      try { value = JSON.parse(line); } catch { throw new LedgerError('invalid'); }
      if (!isObject(value)) throw new LedgerError('invalid');
      if (index === 0) {
        if (!exactKeys(value, ['kind', 'schema', 'campaign', 'cap', 'diagnosticCandidate', 'qualificationCandidate']) || value.kind !== 'header' ||
            value.schema !== 2 || value.campaign !== CAMPAIGN_ID || value.cap !== CAMPAIGN_CAP || value.diagnosticCandidate !== manifest.diagnosticCandidate || value.qualificationCandidate !== null) throw new LedgerError('invalid');
      } else if (value.kind === 'frozen') {
        if (!exactKeys(value, ['kind', 'candidate']) || !isCandidate(value.candidate) || frozen !== null || value.candidate !== manifest.qualificationCandidate) throw new LedgerError('invalid');
        frozen = value.candidate;
      } else {
        const identity = { candidate: value.candidate, phase: value.phase };
        if (!isIdentity(identity) || !candidateAllowed(manifest, identity) || identity.phase === 'qualification' && identity.candidate !== frozen ||
            typeof value.runId !== 'string' || !phaseRuns(identity.phase).some(run => run.id === value.runId) || !integer(value.attempt, 1, 121)) throw new LedgerError('invalid');
        if (value.kind === 'contact') {
          if (!exactKeys(value, ['kind', 'candidate', 'phase', 'sequence', 'runId', 'attempt', 'stage']) || value.sequence !== ++count || count > CAMPAIGN_CAP ||
              ++phaseCounts[identity.phase] > PHASE_LIMITS[identity.phase] || !STAGES.includes(value.stage as ContactStage)) throw new LedgerError('invalid');
          if (attemptContacts(records, identity, value.runId, value.attempt).length >= campaign().find(run => run.id === value.runId)!.expectedCalls ||
              records.some(item => item.kind === 'completed' && sameIdentity(item, identity) && item.runId === value.runId && item.attempt === value.attempt)) throw new LedgerError('invalid');
        } else if (value.kind === 'completed') {
          if (!exactKeys(value, ['kind', 'candidate', 'phase', 'runId', 'attempt', 'status']) || !['passed', 'failed'].includes(String(value.status)) ||
              records.some(item => item.kind === 'completed' && sameIdentity(item, identity) && item.runId === value.runId && item.attempt === value.attempt)) throw new LedgerError('invalid');
          if (value.status === 'passed' && attemptContacts(records, identity, value.runId, value.attempt).length !== campaign().find(run => run.id === value.runId)!.expectedCalls) throw new LedgerError('invalid');
        } else throw new LedgerError('invalid');
      }
      records.push(value as unknown as RecordLine);
    }
    return records;
  }
  get count(): number { return this.records.filter(item => item.kind === 'contact').length; }
  get remaining(): number { return CAMPAIGN_CAP - this.count; }
  get phaseRemaining(): number { return PHASE_LIMITS[this.identity.phase] - this.records.filter(item => item.kind === 'contact' && item.phase === this.identity.phase).length; }
  private completions(runId: string, identity = this.identity): Completed[] {
    return this.records.filter((item): item is Completed => item.kind === 'completed' && sameIdentity(item, identity) && item.runId === runId);
  }
  completed(runId: string): boolean { return this.completions(runId).length > 0; }
  latestStatus(runId: string, identity = this.identity): RunStatus | null { return this.completions(runId, identity).at(-1)?.status ?? null; }
  private unresolvedContacts(runId: string | undefined, identity: CampaignIdentity): Contact[] {
    const completed = new Set(this.records.filter((item): item is Completed => item.kind === 'completed' && sameIdentity(item, identity))
      .map(item => `${item.runId}/${item.attempt}`));
    return this.records.filter((item): item is Contact => item.kind === 'contact' && sameIdentity(item, identity) &&
      (runId === undefined || item.runId === runId) && !completed.has(`${item.runId}/${item.attempt}`));
  }
  unresolved(runId?: string, identity = this.identity): boolean { return this.unresolvedContacts(runId, identity).length > 0; }
  qualificationPassed(): boolean {
    const candidate = this.manifest.qualificationCandidate;
    return candidate !== null && !this.unresolved(undefined, { candidate, phase: 'qualification' }) && campaign().every(run => {
      const results = this.completions(run.id, { candidate, phase: 'qualification' });
      return results.length > 0 && results.every(result => result.status === 'passed');
    });
  }
  /** Lost, replayed, conflicting or orphaned metadata cannot be reconstructed by spending again. */
  reconcile(metadata: readonly RunMetadata[]): void {
    const completions = this.records.filter((item): item is Completed => item.kind === 'completed');
    const key = (item: CampaignIdentity & { runId: string; attempt: number }) => `${item.candidate}/${item.phase}/${item.runId}/${item.attempt}`;
    if (metadata.length !== completions.length || new Set(metadata.map(key)).size !== metadata.length) throw new LedgerError('invalid');
    for (const result of metadata) {
      const completed = completions.find(item => key(item) === key(result));
      if (!isRunMetadata(result) || !completed || completed.status !== result.status) throw new LedgerError('invalid');
      const contacts = attemptContacts(this.records, result, result.runId, result.attempt);
      if (result.actualSends > contacts.length || result.contacts.some(contact => !contacts.some(charged => charged.sequence === contact.sequence && charged.stage === contact.stage))) throw new LedgerError('invalid');
    }
  }
  nextAttempt(runId: string): number {
    return 1 + Math.max(0, ...this.records.filter((item): item is Contact | Completed =>
      (item.kind === 'contact' || item.kind === 'completed') && sameIdentity(item, this.identity) && item.runId === runId).map(item => item.attempt));
  }
  /** Claim a single in-process execution; an interrupted charge cannot be reused or advanced. */
  claimAttempt(runId: string): number {
    if (this.closed) throw new LedgerError('closed');
    if (this.claimedRuns.has(runId) || this.unresolved(runId)) throw new LedgerError('unresolved');
    this.claimedRuns.add(runId);
    return this.nextAttempt(runId);
  }
  releaseAttempt(runId: string, attempt: number): void {
    this.ownedAttempts.delete(`${runId}/${attempt}`);
    this.claimedRuns.delete(runId);
  }
  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const pending = this.queued.then(async () => {
      if (this.closed) throw new LedgerError('closed');
      if (this.poisoned) throw new LedgerError('io');
      try {
        if (JSON.stringify(await readManifest(this.registry)) !== JSON.stringify(this.manifest)) throw new LedgerError('invalid');
        await this.file.verify();
      }
      catch { this.poisoned = true; throw new LedgerError('invalid'); }
      return operation();
    });
    this.queued = pending.catch(() => {}); return pending;
  }
  /** Verify again at the actual transport boundary, after any asynchronous reservation guards. */
  verify(): Promise<void> { return this.enqueue(async () => {}); }
  private async append(record: RecordLine): Promise<void> {
    try { await this.file.append(Buffer.from(JSON.stringify(record) + '\n')); }
    catch { this.poisoned = true; throw new LedgerError('io'); }
    this.records.push(record);
  }
  /** MUST complete and flush immediately before an actual transport send. Failed reservations remain charged. */
  reserve(runId: string, attempt: number, stage: ContactStage): Promise<Contact> {
    return this.enqueue(async () => {
      if (!phaseRuns(this.identity.phase).some(run => run.id === runId) || !integer(attempt, 1, 121) || !STAGES.includes(stage)) throw new LedgerError('invalid');
      if (this.count >= CAMPAIGN_CAP) throw new LedgerError('cap');
      const key = `${runId}/${attempt}`;
      if (this.unresolvedContacts(runId, this.identity).some(item => item.attempt !== attempt || !this.ownedAttempts.has(key))) throw new LedgerError('unresolved');
      if (this.completions(runId).some(item => item.attempt === attempt) || attemptContacts(this.records, this.identity, runId, attempt).length >= campaign().find(run => run.id === runId)!.expectedCalls) throw new LedgerError('invalid');
      if (this.phaseRemaining === 0) throw new LedgerError('phase');
      const contact: Contact = { kind: 'contact', ...this.identity, sequence: this.count + 1, runId, attempt, stage };
      await this.append(contact); this.ownedAttempts.add(key); return { ...contact };
    });
  }
  finish(runId: string, attempt: number, status: RunStatus): Promise<void> {
    return this.enqueue(async () => {
      if (!phaseRuns(this.identity.phase).some(run => run.id === runId) || !integer(attempt, 1, 121) || !['passed', 'failed'].includes(status) ||
          this.completions(runId).some(item => item.attempt === attempt)) throw new LedgerError('invalid');
      if (status === 'passed' && attemptContacts(this.records, this.identity, runId, attempt).length !== campaign().find(run => run.id === runId)!.expectedCalls) throw new LedgerError('invalid');
      await this.append({ kind: 'completed', ...this.identity, runId, attempt, status });
      this.ownedAttempts.delete(`${runId}/${attempt}`);
    });
  }
  async close(): Promise<void> {
    await this.queued;
    if (this.closed) return;
    this.closed = true;
    try { await this.file.close(); } finally { try { await this.lock.close(); } finally { await fs.unlink(this.lockPath); } }
  }
}
