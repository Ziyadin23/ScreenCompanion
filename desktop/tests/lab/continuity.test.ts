import * as fs from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HttpTransport } from '../../src/contracts';
import { campaign, type CampaignRun } from './cases';
import { executeCampaign } from './execution';
import { FAKE_IDENTITY, FAKE_REQUIRED_VISUALS, FixtureCropper, FixtureTransport, initializeFakeCampaign } from './fakes';
import { CampaignLedger } from './ledger';
import { measureRun } from './measure';
import { MetadataResults } from './results';
import { CampaignContinuity } from './transport';

type Fault = 'removed' | 'replaced' | 'truncated' | 'modified';
type Target = 'ledger' | 'results';
describe('durable continuity at each synthetic reservation and transport boundary', () => {
  let directory: string, ledger: CampaignLedger, results: MetadataResults, continuity: CampaignContinuity;
  let damaged: { ledger: Buffer | null; results: Buffer | null } | undefined;
  const first = campaign()[0]!, second = campaign()[1]!;
  const balanced = campaign().find(run => run.group === 'main' && run.mode === 'Balanced')!;
  const thorough = campaign().find(run => run.group === 'main' && run.mode === 'Thorough')!;
  beforeEach(async () => {
    directory = await fs.mkdtemp(join(tmpdir(), 'sc-fake-continuity-'));
    await initializeFakeCampaign(directory);
    ledger = await CampaignLedger.open(join(directory, 'campaign.json'), FAKE_IDENTITY);
    results = await MetadataResults.open(join(directory, 'results.jsonl'));
    ledger.reconcile(results.records);
    continuity = new CampaignContinuity(ledger, results);
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(async () => {
    vi.restoreAllMocks(); await results.close(); await ledger.close();
    await fs.rm(directory, { recursive: true, force: true });
  });
  async function snapshot() {
    return { ledger: await fs.readFile(join(directory, 'ledger.jsonl')).catch(() => null),
      results: await fs.readFile(join(directory, 'results.jsonl')).catch(() => null) };
  }
  async function damage(target: Target, fault: Fault): Promise<void> {
    const path = join(directory, `${target}.jsonl`), original = await fs.readFile(path);
    expect(original.length).toBeGreaterThan(1);
    if (fault === 'removed' || fault === 'replaced') {
      await fs.unlink(path);
      if (fault === 'replaced') await fs.writeFile(path, original, { flag: 'wx' });
    } else if (fault === 'truncated') await fs.truncate(path, original.length - 1);
    else {
      const changed = Buffer.from(original); changed[0] = changed[0] === 0x7b ? 0x5b : 0x7b;
      await fs.writeFile(path, changed);
    }
    damaged = await snapshot();
  }
  async function perform(selected: CampaignRun[], hooks: {
    beforeCase?: (run: CampaignRun) => Promise<void>;
    afterSend?: (run: CampaignRun, index: number) => Promise<void>;
    afterReserve?: () => Promise<void>;
  } = {}): Promise<FixtureTransport[]> {
    const transports: FixtureTransport[] = [], signal = new AbortController().signal;
    await executeCampaign({ selected, fullCampaign: false, repeat: false, ledger, signal,
      async execute(run, attempt) {
        await hooks.beforeCase?.(run);
        const fixture = new FixtureTransport(run); transports.push(fixture);
        const transport: HttpTransport = { async send(request, requestSignal) {
          await continuity.verify(); requestSignal?.throwIfAborted();
          const response = await fixture.send(request);
          await hooks.afterSend?.(run, fixture.requests.length);
          return response;
        } };
        return measureRun({ run, attempt, ledger: { identity: ledger.identity, async reserve(...args) {
          const charge = await continuity.reserve(...args); await hooks.afterReserve?.(); return charge;
        } }, transport, cropper: new FixtureCropper(), requiredVisuals: FAKE_REQUIRED_VISUALS,
        jpeg: Buffer.from('synthetic'), apiKey: 'synthetic-only', signal });
      }, async record(metadata) { await continuity.verify(); await results.append(metadata); } });
    return transports;
  }
  for (const target of ['ledger', 'results'] as const) {
    for (const fault of ['removed', 'replaced', 'truncated', 'modified'] as const) {
      it(`blocks ${target} ${fault} between completed cases before another reservation`, async () => {
        await perform([first]);
        await expect(perform([second], { beforeCase: async () => damage(target, fault) })).rejects.toThrow('No new contact');
        expect(ledger.count).toBe(1); expect(ledger.remaining).toBe(119); expect(ledger.completed(second.id)).toBe(false);
        expect(await snapshot()).toEqual(damaged);
      });
      it(`blocks ${target} ${fault} between stages without a second reservation`, async () => {
        await perform([first]);
        let sends = 0;
        await expect(perform([balanced], { afterSend: async (_run, index) => { ++sends; if (index === 1) await damage(target, fault); } })).rejects.toThrow('No new contact');
        expect(sends).toBe(1); expect(ledger.count).toBe(2); expect(ledger.remaining).toBe(118);
        expect(ledger.unresolved(balanced.id)).toBe(true); expect(ledger.completed(balanced.id)).toBe(false);
        expect(await snapshot()).toEqual(damaged);
      });
    }
    it(`rechecks ${target} after a charge and before the underlying transport`, async () => {
      await perform([first]); let underlyingSends = 0, once = false;
      await expect(perform([balanced], { afterReserve: async () => { if (!once) { once = true; await damage(target, 'modified'); } },
        afterSend: async () => { ++underlyingSends; } })).rejects.toThrow('No new contact');
      expect(underlyingSends).toBe(0); expect(ledger.count).toBe(2); expect(ledger.unresolved(balanced.id)).toBe(true);
      expect(await snapshot()).toEqual(damaged);
    });
    it(`keeps ${target} poisoned even if the in-place bytes are restored`, async () => {
      await perform([first]); const original = await snapshot();
      await damage(target, 'modified');
      await expect(continuity.verify()).rejects.toThrow('No new contact');
      await fs.writeFile(join(directory, `${target}.jsonl`), original[target]!);
      await expect(continuity.verify()).rejects.toThrow('No new contact');
      expect(ledger.count).toBe(1); expect(ledger.remaining).toBe(119);
    });
  }
  it('allows normal Thorough and Balanced attempts, then reopens and reconciles the exact history', async () => {
    const transports = await perform([first, thorough, balanced]);
    expect(transports.map(item => item.requests.length)).toEqual([1, 3, 2]);
    expect(ledger.count).toBe(6); expect(ledger.remaining).toBe(114);
    expect(ledger.latestStatus(thorough.id)).toBe('passed'); expect(ledger.latestStatus(balanced.id)).toBe('passed');
    await results.close(); await ledger.close();
    ledger = await CampaignLedger.open(join(directory, 'campaign.json'), FAKE_IDENTITY);
    results = await MetadataResults.open(join(directory, 'results.jsonl'));
    continuity = new CampaignContinuity(ledger, results);
    expect(() => ledger.reconcile(results.records)).not.toThrow();
    await expect(continuity.verify()).resolves.toBeUndefined();
    expect(results.records).toHaveLength(3); expect(ledger.count).toBe(6);
  });
});
