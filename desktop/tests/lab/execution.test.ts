import * as fs from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it, vi } from 'vitest';
import { campaign, type CampaignRun } from './cases';
import { executeCampaign } from './execution';
import { FixtureCropper, FixtureTransport } from './fakes';
import { CampaignLedger } from './ledger';
import { measureRun } from './measure';

describe('persistent model preflight gates (synthetic transport only)', () => {
  it('blocks default/scoped resumes after failed preflights until the required explicit repeats pass', async () => {
    const directory = await fs.mkdtemp(join(tmpdir(), 'sc-fake-preflight-gate-'));
    const path = join(directory, 'fake-only.jsonl');
    let ledger = await CampaignLedger.open(path);
    const runs = campaign(), flash = runs[0]!, pro = runs[1]!;
    const flashCase = runs.find(run => run.id === 'main-numeric-plain-direct')!;
    const proCase = runs.find(run => run.id === 'pro-mcq-proctoring-balanced')!;
    const execute = vi.fn();
    const signal = new AbortController().signal;
    async function perform(selected: CampaignRun[], repeat = false, fail = false, fullCampaign = false): Promise<void> {
      await executeCampaign({ selected, repeat, fullCampaign, ledger, signal,
        async execute(run, attempt) {
          execute(run.id);
          return measureRun({ run, attempt, ledger, transport: fail ? { async send() { throw new Error('Synthetic failure.'); } } : new FixtureTransport(run),
            cropper: new FixtureCropper(), jpeg: Buffer.from('synthetic'), apiKey: 'synthetic-only', signal });
        }, async record() { /* Test metadata stays in memory; only the separate fake ledger is durable. */ } });
    }
    try {
      await perform([flash], false, true); await perform([pro], false, true);
      expect(ledger.count).toBe(2); expect(ledger.latestStatus(flash.id)).toBe('failed'); expect(ledger.latestStatus(pro.id)).toBe('failed');
      await ledger.close(); ledger = await CampaignLedger.open(path);
      execute.mockClear();
      await expect(perform(runs, false, false, true)).rejects.toMatchObject({ code: 'preflight-required' });
      await expect(perform([flashCase])).rejects.toMatchObject({ code: 'preflight-required' });
      await expect(perform([proCase])).rejects.toMatchObject({ code: 'preflight-required' });
      expect(execute).not.toHaveBeenCalled(); expect(ledger.count).toBe(2);
      await perform([flash]); // A default scoped resume does not retry a completed failure.
      expect(execute).not.toHaveBeenCalled(); expect(ledger.count).toBe(2);
      await perform([flash], true, true);
      await expect(perform([flashCase])).rejects.toMatchObject({ code: 'preflight-required' });
      expect(ledger.count).toBe(3); expect(ledger.latestStatus(flash.id)).toBe('failed');
      await perform([flash], true);
      expect(ledger.latestStatus(flash.id)).toBe('passed'); expect(ledger.count).toBe(4);
      await perform([flashCase]); expect(ledger.count).toBe(5);
      execute.mockClear();
      await expect(perform(runs, false, false, true)).rejects.toMatchObject({ code: 'preflight-required' });
      await expect(perform([proCase])).rejects.toMatchObject({ code: 'preflight-required' });
      expect(execute).not.toHaveBeenCalled(); expect(ledger.count).toBe(5);
      await perform([pro], true); await perform([proCase]);
      expect(ledger.count).toBe(8); expect(ledger.latestStatus(proCase.id)).toBe('passed');
      const records = (await fs.readFile(path, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
      expect(records.filter(record => record.kind === 'completed' && record.runId === flash.id).map(record => record.status)).toEqual(['failed', 'failed', 'passed']);
    } finally { await ledger.close(); await fs.rm(directory, { recursive: true, force: true }); }
  });
});
