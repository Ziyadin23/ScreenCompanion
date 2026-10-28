import * as fs from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HttpRequest } from '../../src/contracts';
import { campaign } from './cases';
import { CampaignLedger, LedgerError, readHistoricalLedger } from './ledger';
import { DurableFile } from './durable';
import { ObservedTransport } from './transport';
import { privateDestinations } from './results';
import { FAKE_CANDIDATE, FAKE_IDENTITY, initializeFakeCampaign, openFakeLedger } from './fakes';
import { PHASE_LIMITS, phaseRuns, type CampaignPhase } from './campaign';

vi.mock('node:fs/promises', async importOriginal => {
  const original = await importOriginal<typeof import('node:fs/promises')>();
  return { ...original, open: vi.fn(original.open), lstat: vi.fn(original.lstat) };
});

const run = campaign()[0]!;
const request = (): HttpRequest => ({ url: 'https://api.deepseek.com/responses', headers: { Authorization: 'Bearer synthetic-only' }, body: Buffer.from('{}') });
describe('fixed beta5 cumulative campaign counter (fake transports only)', () => {
  let directory: string, path: string, registry: string;
  const opened: CampaignLedger[] = [];
  beforeEach(async () => { directory = await fs.mkdtemp(join(tmpdir(), 'sc-fake-ledger-')); path = join(directory, 'ledger.jsonl'); registry = join(directory, 'campaign.json'); });
  afterEach(async () => { vi.mocked(fs.open).mockReset(); vi.mocked(fs.lstat).mockReset(); vi.restoreAllMocks(); for (const ledger of opened.splice(0)) await ledger.close(); await fs.rm(directory, { recursive: true, force: true }); });
  async function open(phase: CampaignPhase = 'qualification'): Promise<CampaignLedger> {
    const ledger = await openFakeLedger(path, { candidate: FAKE_CANDIDATE, phase }); opened.push(ledger); return ledger;
  }
  it('flushes candidate+phase reservation before the actual send, charging failed preflight', async () => {
    const ledger = await open();
    const send = vi.fn(async () => {
      const persisted = (await fs.readFile(path, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
      expect(persisted.at(-1)).toEqual({ kind: 'contact', ...FAKE_IDENTITY, sequence: 1, runId: 'preflight-flash', attempt: 1, stage: 'Preflight' });
      throw new Error('Synthetic private body must never be persisted.');
    });
    const observed = new ObservedTransport({ send }, ledger, run, 1);
    await expect(observed.send(request())).rejects.toThrow();
    expect(send).toHaveBeenCalledTimes(1); expect(observed.actualSends).toBe(1); expect(ledger.count).toBe(1);
    await ledger.finish(run.id, 1, 'failed'); await ledger.close();
    const resumed = await open();
    expect(resumed.count).toBe(1); expect(resumed.completed(run.id)).toBe(true); expect(resumed.latestStatus(run.id)).toBe('failed'); expect(resumed.nextAttempt(run.id)).toBe(2);
  });
  it('charges interrupted reservation without a completion and preserves count across phases', async () => {
    const ledger = await open('initial-preflight'); await ledger.reserve(run.id, 1, 'Preflight'); await ledger.close();
    const resumed = await open(); expect(resumed.count).toBe(1); expect(resumed.completed(run.id)).toBe(false); expect(resumed.nextAttempt(run.id)).toBe(1);
    expect(resumed.latestStatus(run.id, { candidate: 'b'.repeat(64), phase: 'initial-preflight' })).toBeNull();
  });
  it('uses one exclusive campaign lock across phase/candidate owners', async () => {
    const first = await open();
    await expect(CampaignLedger.open(registry, { candidate: FAKE_CANDIDATE, phase: 'reserve' })).rejects.toMatchObject({ code: 'locked' });
    expect(await fs.readFile(join(directory, 'campaign.lock'), 'utf8')).toBe('{"schema":2}\n');
    await first.close(); expect((await open()).count).toBe(0);
  });
  it('serializes119-to120 and rejects121 across all phases and resumes', async () => {
    for (const phase of Object.keys(PHASE_LIMITS) as CampaignPhase[]) {
      const ledger = await open(phase), seed = phaseRuns(phase)[0]!;
      const count = PHASE_LIMITS[phase] - (phase === 'reserve' ? 1 : 0);
      for (let i = 0; i < count; ++i) {
        await ledger.reserve(seed.id, i + 1, seed.group === 'preflight' ? 'Preflight' : 'Answer');
        await ledger.finish(seed.id, i + 1, 'failed');
      }
      await ledger.close();
    }
    const ledger = await open('reserve'); expect(ledger.count).toBe(119);
    const send = vi.fn(async () => ({ status: 500, headers: {}, body: Buffer.alloc(0) }));
    const one = new ObservedTransport({ send }, ledger, run, 11), two = new ObservedTransport({ send }, ledger, run, 12);
    const settled = await Promise.allSettled([one.send(request()), two.send(request())]);
    expect(settled.filter(item => item.status === 'fulfilled')).toHaveLength(1);
    expect(send).toHaveBeenCalledTimes(1); expect(ledger.count).toBe(120); expect(ledger.remaining).toBe(0);
    await ledger.close(); const resumed = await open('reserve');
    await expect(new ObservedTransport({ send }, resumed, run, 13).send(request())).rejects.toMatchObject({ code: 'cap' });
    expect(send).toHaveBeenCalledTimes(1); expect(resumed.count).toBe(120);
  });
  it('does not transfer a phase allowance or send without flushed reservation', async () => {
    const ledger = await open('initial-preflight'); await ledger.reserve(run.id, 1, 'Preflight'); await ledger.finish(run.id, 1, 'failed');
    await ledger.reserve(run.id, 2, 'Preflight'); await ledger.finish(run.id, 2, 'failed');
    await expect(ledger.reserve(run.id, 3, 'Preflight')).rejects.toMatchObject({ code: 'phase' }); expect(ledger.remaining).toBe(118);
    const send = vi.fn();
    const observed = new ObservedTransport({ send }, { reserve: vi.fn(async () => { throw new LedgerError('io'); }) }, run, 1);
    await expect(observed.send(request())).rejects.toMatchObject({ code: 'io' }); expect(send).not.toHaveBeenCalled();
  });
  it('rejects extra per-mode sends before another reservation', async () => {
    const ledger = await open(), send = vi.fn(async () => ({ status: 500, headers: {}, body: Buffer.alloc(0) }));
    const observed = new ObservedTransport({ send }, ledger, run, 1);
    await observed.send(request()); await expect(observed.send(request())).rejects.toThrow('unexpected send');
    expect(send).toHaveBeenCalledTimes(1); expect(ledger.count).toBe(1);
  });
  it.each(['truncated-counter', 'corrupt-counter', 'truncated-manifest', 'extra-manifest', 'missing-counter', 'cap-change'])('preserves %s and fails closed', async fault => {
    const ledger = await open(); await ledger.reserve(run.id, 1, 'Preflight'); await ledger.close();
    if (fault === 'truncated-counter') await fs.appendFile(path, '{"kind":"contact"');
    if (fault === 'corrupt-counter') await fs.appendFile(path, '{"kind":"unknown"}\n');
    if (fault === 'truncated-manifest') await fs.writeFile(registry, '{"schema":2');
    if (fault === 'missing-counter') await fs.unlink(path);
    if (fault === 'extra-manifest' || fault === 'cap-change') {
      const manifest = JSON.parse(await fs.readFile(registry, 'utf8'));
      if (fault === 'extra-manifest') manifest.authorization = 120; else manifest.maxAdditionalAttempts = 121;
      await fs.writeFile(registry, JSON.stringify(manifest) + '\n');
    }
    const bytes = await fs.readFile(registry); const counter = await fs.readFile(path).catch(() => null);
    await expect(CampaignLedger.open(registry, FAKE_IDENTITY)).rejects.toMatchObject({ code: 'invalid' });
    expect(await fs.readFile(registry)).toEqual(bytes); expect(await fs.readFile(path).catch(() => null)).toEqual(counter);
  });
  it('rejects manifest rewrites during ownership and candidate changes after freeze', async () => {
    const ledger = await open();
    const manifest = JSON.parse(await fs.readFile(registry, 'utf8')); manifest.qualificationCandidate = 'b'.repeat(64);
    await fs.writeFile(registry, JSON.stringify(manifest) + '\n');
    await expect(ledger.reserve(run.id, 1, 'Preflight')).rejects.toMatchObject({ code: 'invalid' });
    expect(ledger.count).toBe(0); await ledger.close();
    await expect(CampaignLedger.open(registry, { candidate: 'b'.repeat(64), phase: 'qualification' })).rejects.toMatchObject({ code: 'invalid' });
  });
  it.each(['removed', 'replaced', 'truncated', 'modified'])('rejects a ledger %s during ownership before another reservation', async fault => {
    const ledger = await open(); await ledger.reserve(run.id, 1, 'Preflight'); await ledger.finish(run.id, 1, 'failed');
    const original = await fs.readFile(path);
    if (fault === 'removed' || fault === 'replaced') {
      await fs.unlink(path);
      if (fault === 'replaced') await fs.writeFile(path, original, { flag: 'wx' });
    } else if (fault === 'truncated') await fs.truncate(path, Math.floor(original.length / 2));
    else {
      const changed = original.toString('utf8').replace('"status":"failed"', '"status":"passed"');
      expect(Buffer.byteLength(changed)).toBe(original.length); await fs.writeFile(path, changed);
    }
    const damaged = await fs.readFile(path).catch(() => null);
    await expect(ledger.reserve(run.id, 2, 'Preflight')).rejects.toThrow('No new contact');
    expect(await fs.readFile(path).catch(() => null)).toEqual(damaged); expect(ledger.count).toBe(1);
  });
  it('never recreates a ledger removed between inspection and open', async () => {
    const ledger = await open(); await ledger.close();
    const realOpen = (await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises')).open;
    vi.mocked(fs.open).mockImplementation(async (name, flags, mode) => {
      if (name === path) await fs.unlink(path);
      return realOpen(name, flags, mode);
    });
    let reopened: CampaignLedger | undefined;
    try { reopened = await CampaignLedger.open(registry, FAKE_IDENTITY); } catch { /* Expected fail-closed open. */ }
    await reopened?.close();
    expect(reopened).toBeUndefined(); expect(await fs.stat(path).catch(() => null)).toBeNull();
  });
  it.each(['dev', 'ino'] as const)('compares full bigint %s values at the path/handle boundary', async field => {
    const ledger = await open(); await ledger.close();
    const real = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
    const stat = await real.lstat(path, { bigint: true }), big = 2n ** 53n;
    const entry = Object.assign(Object.create(Object.getPrototypeOf(stat)), stat, { dev: big, ino: big });
    const opened = Object.assign(Object.create(Object.getPrototypeOf(stat)), stat, { dev: big, ino: big, [field]: big + 1n });
    expect(Number(entry[field])).toBe(Number(opened[field]));
    vi.mocked(fs.lstat).mockResolvedValue(entry);
    let handleStat: ReturnType<typeof vi.spyOn> | undefined;
    vi.mocked(fs.open).mockImplementation(async (name, flags, mode) => {
      const handle = await real.open(name, flags, mode);
      handleStat = vi.spyOn(handle, 'stat').mockResolvedValue(opened);
      return handle;
    });
    await expect(DurableFile.openExisting(path, 512 * 1024)).rejects.toThrow();
    expect(fs.lstat).toHaveBeenCalledWith(path, { bigint: true });
    expect(handleStat).toHaveBeenCalledWith({ bigint: true });
  });
  it('detects ledger changes after a reservation write and fsync before returning the charge', async () => {
    const ledger = await open();
    const file = (ledger as unknown as { file: DurableFile }).file.file, sync = file.sync.bind(file);
    vi.spyOn(file, 'sync').mockImplementation(async () => { await sync(); await fs.truncate(path, 1); });
    await expect(ledger.reserve(run.id, 1, 'Preflight')).rejects.toThrow('No new contact');
    expect(ledger.count).toBe(0); expect((await fs.stat(path)).size).toBe(1);
    await expect(ledger.reserve(run.id, 1, 'Preflight')).rejects.toThrow('No new contact');
  });
  it('detects ledger changes during completion and keeps the charge unresolved', async () => {
    const ledger = await open(); await ledger.reserve(run.id, 1, 'Preflight');
    const file = (ledger as unknown as { file: DurableFile }).file.file, sync = file.sync.bind(file);
    vi.spyOn(file, 'sync').mockImplementation(async () => { await sync(); await fs.truncate(path, 1); });
    await expect(ledger.finish(run.id, 1, 'failed')).rejects.toThrow('No new contact');
    expect(ledger.count).toBe(1); expect(ledger.unresolved(run.id)).toBe(true); expect(ledger.completed(run.id)).toBe(false);
  });
  it('detects ledger changes during the initial frozen-candidate append', async () => {
    await initializeFakeCampaign(directory, null);
    const manifest = JSON.parse(await fs.readFile(registry, 'utf8')); manifest.qualificationCandidate = FAKE_CANDIDATE;
    await fs.writeFile(registry, JSON.stringify(manifest) + '\n');
    const realOpen = (await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises')).open;
    vi.mocked(fs.open).mockImplementation(async (name, flags, mode) => {
      const file = await realOpen(name, flags, mode);
      if (name === path) {
        const sync = file.sync.bind(file);
        vi.spyOn(file, 'sync').mockImplementation(async () => { await sync(); await fs.truncate(path, 1); });
      }
      return file;
    });
    await expect(CampaignLedger.open(registry, FAKE_IDENTITY)).rejects.toThrow('No new contact');
    expect((await fs.stat(path)).size).toBe(1);
    expect(await fs.stat(join(directory, 'campaign.lock')).catch(() => null)).toBeNull();
  });
  it('keeps historical schema1 readable without ever permitting writes', async () => {
    const initialized = await open(); await initialized.close();
    const text = JSON.stringify({ kind: 'header', schema: 1, campaign: 'sc-beta4-deepseek-visual-v1', cap: 120, priorCalls: 120 }) + '\n';
    await fs.writeFile(path, text);
    expect(await readHistoricalLedger(path)).toEqual({ schema: 1, count: 120 });
    await expect(CampaignLedger.open(registry, FAKE_IDENTITY)).rejects.toBeInstanceOf(LedgerError);
    expect(await fs.readFile(path, 'utf8')).toBe(text);
    await fs.appendFile(path, '{'); await expect(readHistoricalLedger(path)).rejects.toMatchObject({ code: 'invalid' });
  });
  it('rejects symlink/hardlink aliases, repository outputs and colliding paths', async () => {
    const ledger = await open(); await ledger.close();
    const root = join(directory, 'checkout'); await fs.mkdir(root);
    await expect(privateDestinations(root, join(root, 'campaign.jsonl'), path)).rejects.toThrow();
    await expect(privateDestinations(root, path, path)).rejects.toThrow();
    await fs.symlink(directory, join(root, 'alias'), process.platform === 'win32' ? 'junction' : 'dir');
    await expect(CampaignLedger.open(join(root, 'alias', 'campaign.json'), FAKE_IDENTITY)).rejects.toMatchObject({ code: 'invalid' });
    await fs.link(registry, join(directory, 'alias.json'));
    await expect(CampaignLedger.open(registry, FAKE_IDENTITY)).rejects.toMatchObject({ code: 'invalid' });
  });
});
