import * as fs from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HttpRequest } from '../../src/contracts';
import { campaign } from './cases';
import { CampaignLedger, LedgerError } from './ledger';
import { ObservedTransport } from './transport';
import { privateDestinations } from './results';

const run = campaign()[0]!;
const request = (): HttpRequest => ({ url: 'https://api.deepseek.com/responses', headers: { Authorization: 'Bearer synthetic-only' }, body: Buffer.from('{}') });
describe('durable cumulative 120-contact campaign ledger (fake transports only)', () => {
  let directory: string;
  let path: string;
  const opened: CampaignLedger[] = [];
  beforeEach(async () => { directory = await fs.mkdtemp(join(tmpdir(), 'sc-fake-ledger-')); path = join(directory, 'fake-only.jsonl'); });
  afterEach(async () => { for (const ledger of opened.splice(0)) await ledger.close(); await fs.rm(directory, { recursive: true, force: true }); });
  async function open(prior = 0): Promise<CampaignLedger> { const ledger = await CampaignLedger.open(path, prior); opened.push(ledger); return ledger; }
  it('flushes a reservation before the actual send, including a failed preflight', async () => {
    const ledger = await open();
    const send = vi.fn(async () => {
      const persisted = (await fs.readFile(path, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
      expect(persisted.at(-1)).toEqual({ kind: 'contact', sequence: 1, runId: 'preflight-flash', attempt: 1, stage: 'Preflight' });
      throw new Error('Synthetic transport failed before receiving a body.');
    });
    const observed = new ObservedTransport({ send }, ledger, run, 1);
    await expect(observed.send(request())).rejects.toThrow();
    expect(send).toHaveBeenCalledTimes(1); expect(observed.actualSends).toBe(1); expect(ledger.count).toBe(1);
    expect(observed.contacts[0]?.status).toBe('failed');
    await ledger.finish(run.id, 1, 'failed');
    await ledger.close();
    const resumed = await open();
    expect(resumed.count).toBe(1); expect(resumed.completed(run.id)).toBe(true); expect(resumed.latestStatus(run.id)).toBe('failed');
    expect(resumed.nextAttempt(run.id)).toBe(2);
  });
  it('charges an interrupted/reserved contact on resume even without a completion record', async () => {
    const ledger = await open(); await ledger.reserve(run.id, 1, 'Preflight'); await ledger.close();
    const resumed = await open(); expect(resumed.count).toBe(1); expect(resumed.completed(run.id)).toBe(false); expect(resumed.nextAttempt(run.id)).toBe(2);
  });
  it('holds an exclusive OS file lock and refuses a second owner', async () => {
    const first = await open();
    await expect(CampaignLedger.open(path)).rejects.toMatchObject({ code: 'locked' });
    expect(await fs.readFile(path + '.lock', 'utf8')).toBe('{"schema":1}\n');
    await first.close();
    expect((await open()).count).toBe(0);
  });
  it('serializes concurrent last-contact reservations and never sends beyond the hard cap', async () => {
    const ledger = await open(119);
    const send = vi.fn(async () => ({ status: 500, headers: {}, body: Buffer.alloc(0) }));
    const one = new ObservedTransport({ send }, ledger, run, 1), two = new ObservedTransport({ send }, ledger, run, 2);
    const settled = await Promise.allSettled([one.send(request()), two.send(request())]);
    expect(settled.filter(item => item.status === 'fulfilled')).toHaveLength(1);
    expect(send).toHaveBeenCalledTimes(1); expect(ledger.count).toBe(120); expect(ledger.remaining).toBe(0);
    await ledger.close();
    const resumed = await open();
    const blocked = new ObservedTransport({ send }, resumed, run, 3);
    await expect(blocked.send(request())).rejects.toMatchObject({ code: 'cap' });
    expect(blocked.actualSends).toBe(0); expect(send).toHaveBeenCalledTimes(1); expect(resumed.count).toBe(120);
  });
  it('does not send if the reservation cannot be flushed', async () => {
    const send = vi.fn();
    const ledger = { reserve: vi.fn(async () => { throw new LedgerError('io'); }) };
    const observed = new ObservedTransport({ send }, ledger, run, 1);
    await expect(observed.send(request())).rejects.toMatchObject({ code: 'io' });
    expect(send).not.toHaveBeenCalled(); expect(observed.actualSends).toBe(0);
  });
  it('rejects an extra per-run send before reserving or contacting transport', async () => {
    const ledger = await open();
    const send = vi.fn(async () => ({ status: 500, headers: {}, body: Buffer.alloc(0) }));
    const observed = new ObservedTransport({ send }, ledger, run, 1);
    await observed.send(request());
    await expect(observed.send(request())).rejects.toThrow('unexpected send');
    expect(send).toHaveBeenCalledTimes(1); expect(ledger.count).toBe(1);
  });
  it('preserves an invalid/truncated ledger and fails closed rather than resetting its count', async () => {
    const ledger = await open(); await ledger.reserve(run.id, 1, 'Preflight'); await ledger.close();
    await fs.appendFile(path, '{"kind":"contact"');
    const bytes = await fs.readFile(path);
    await expect(CampaignLedger.open(path)).rejects.toMatchObject({ code: 'invalid' });
    expect(await fs.readFile(path)).toEqual(bytes);
  });
  it('keeps prior contacts on resume and rejects a conflicting nonzero seed', async () => {
    const ledger = await open(7); await ledger.reserve(run.id, 1, 'Preflight'); await ledger.close();
    expect((await open()).count).toBe(8);
    await opened.at(-1)!.close();
    await expect(CampaignLedger.open(path, 6)).rejects.toMatchObject({ code: 'invalid' });
  });
  it('rejects repository outputs, aliases and symlink destinations without writing them', async () => {
    const root = join(directory, 'checkout'); await fs.mkdir(root);
    await expect(privateDestinations(root, join(root, 'campaign.jsonl'), join(directory, 'results.jsonl'))).rejects.toThrow();
    await expect(privateDestinations(root, path, path)).rejects.toThrow();
    await fs.symlink(root, join(directory, 'alias'), process.platform === 'win32' ? 'junction' : 'dir');
    await expect(privateDestinations(root, join(directory, 'alias', 'ledger.jsonl'), join(directory, 'results.jsonl'))).rejects.toThrow();
    await privateDestinations(root, path, join(directory, 'results.jsonl'));
  });
});
