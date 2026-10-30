import * as fs from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { campaign, type CampaignRun } from './cases';
import { executeCampaign } from './execution';
import { FAKE_CANDIDATE, FAKE_REQUIRED_VISUALS, FixtureCropper, FixtureTransport, initializeFakeCampaign } from './fakes';
import { CampaignLedger } from './ledger';
import { measureRun } from './measure';
import { phaseRuns, type CampaignIdentity } from './campaign';
import { MetadataResults } from './results';

describe('phase/candidate scoped preflight and qualification gates (synthetic transport only)', () => {
  let directory: string, registry: string;
  const opened: CampaignLedger[] = [];
  beforeEach(async () => { directory = await fs.mkdtemp(join(tmpdir(), 'sc-fake-phase-')); registry = join(directory, 'campaign.json'); await initializeFakeCampaign(directory, null); });
  afterEach(async () => { for (const ledger of opened) await ledger.close(); opened.length = 0; await fs.rm(directory, { recursive: true, force: true }); });
  async function open(identity: CampaignIdentity): Promise<CampaignLedger> { const ledger = await CampaignLedger.open(registry, identity); opened.push(ledger); return ledger; }
  async function freeze(candidate: string): Promise<void> {
    const value = JSON.parse(await fs.readFile(registry, 'utf8')); value.qualificationCandidate = candidate; await fs.writeFile(registry, JSON.stringify(value) + '\n');
  }
  async function perform(ledger: CampaignLedger, selected: CampaignRun[], options: { repeat?: boolean; full?: boolean; fail?: boolean; writeFailure?: boolean; wrongPrimaryId?: string; calls?: string[] } = {}): Promise<void> {
    const signal = new AbortController().signal;
    await executeCampaign({ selected, ledger, signal, fullCampaign: options.full ?? false, repeat: options.repeat ?? false,
      async execute(run, attempt) {
        options.calls?.push(run.id);
        return measureRun({ run, attempt, ledger, transport: options.fail ? { async send() { throw new Error('Synthetic private failure.'); } } : new FixtureTransport(run, run.id === options.wrongPrimaryId),
          cropper: new FixtureCropper(), requiredVisuals: FAKE_REQUIRED_VISUALS, jpeg: Buffer.from('synthetic'), apiKey: 'synthetic-only', signal });
      }, async record() { if (options.writeFailure) throw new Error('Synthetic result write failure.'); } });
  }
  it.each([FAKE_CANDIDATE, 'b'.repeat(64)])('always runs fresh49/96 after initial2+diagnostic11 with final candidate %s', async candidate => {
    let ledger = await open({ candidate: FAKE_CANDIDATE, phase: 'initial-preflight' }); await perform(ledger, phaseRuns('initial-preflight')); expect(ledger.count).toBe(2); await ledger.close();
    ledger = await open({ candidate: FAKE_CANDIDATE, phase: 'diagnostic' }); await perform(ledger, phaseRuns('diagnostic')); expect(ledger.count).toBe(13); await ledger.close();
    await freeze(candidate); ledger = await open({ candidate, phase: 'qualification' });
    expect(ledger.completed('preflight-flash')).toBe(false); expect(ledger.completed('main-mcq-plain-direct')).toBe(false);
    const calls: string[] = []; await perform(ledger, campaign(), { full: true, calls });
    expect(calls).toEqual(campaign().map(run => run.id)); expect(calls).toHaveLength(49); expect(ledger.count).toBe(109); expect(ledger.qualificationPassed()).toBe(true);
    await ledger.close(); ledger = await open({ candidate, phase: 'qualification' });
    await perform(ledger, campaign(), { full: true, calls }); expect(calls).toHaveLength(49); expect(ledger.count).toBe(109);
  });
  it('blocks qualification/scoped model gates after failed preflight and never silently repeats it', async () => {
    await freeze(FAKE_CANDIDATE); const ledger = await open({ candidate: FAKE_CANDIDATE, phase: 'qualification' });
    const runs = campaign(), flash = runs[0]!, pro = runs[1]!;
    await perform(ledger, [flash], { fail: true }); await perform(ledger, [pro], { fail: true }); expect(ledger.count).toBe(2);
    const calls: string[] = [];
    await expect(perform(ledger, runs, { full: true, calls })).rejects.toMatchObject({ code: 'preflight-required' });
    await expect(perform(ledger, [runs.find(run => run.id === 'main-numeric-plain-direct')!], { calls })).rejects.toMatchObject({ code: 'preflight-required' });
    await expect(perform(ledger, [runs.find(run => run.group === 'pro')!], { calls })).rejects.toMatchObject({ code: 'preflight-required' });
    await perform(ledger, [flash], { calls }); expect(calls).toEqual([]); expect(ledger.count).toBe(2);
    await expect(perform(ledger, [flash], { repeat: true })).rejects.toMatchObject({ code: 'scope' });
  });
  it('uses only same-candidate initial preflights for diagnostics and fresh qualification preflights', async () => {
    let ledger = await open({ candidate: FAKE_CANDIDATE, phase: 'initial-preflight' }); await perform(ledger, phaseRuns('initial-preflight')); await ledger.close();
    ledger = await open({ candidate: FAKE_CANDIDATE, phase: 'diagnostic' }); await perform(ledger, [phaseRuns('diagnostic')[0]!]); await ledger.close();
    const candidate = 'b'.repeat(64); await freeze(candidate); ledger = await open({ candidate, phase: 'qualification' });
    const calls: string[] = []; await expect(perform(ledger, [phaseRuns('diagnostic')[0]!], { calls })).rejects.toMatchObject({ code: 'preflight-required' });
    expect(calls).toHaveLength(0); expect(ledger.count).toBe(3);
  });
  it('allows all stages of a current Thorough and Balanced attempt before completion', async () => {
    await freeze(FAKE_CANDIDATE); const ledger = await open({ candidate: FAKE_CANDIDATE, phase: 'qualification' });
    await perform(ledger, campaign().slice(0, 2));
    const runs = ['Thorough', 'Balanced'].map(mode => campaign().find(run => run.group === 'main' && run.mode === mode)!);
    await perform(ledger, runs);
    const lines = (await fs.readFile(join(directory, 'ledger.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line));
    for (const [index, run] of runs.entries()) {
      const contacts = lines.filter(item => item.kind === 'contact' && item.runId === run.id);
      expect(contacts.map(item => item.stage)).toEqual(index === 0 ? ['Locate', 'Extract', 'Answer'] : ['Extract', 'Answer']);
      expect(contacts.map(item => item.attempt)).toEqual(Array(run.expectedCalls).fill(1));
      expect(ledger.latestStatus(run.id)).toBe('passed'); expect(ledger.unresolved(run.id)).toBe(false);
    }
    expect(ledger.count).toBe(7);
  });
  it('rejects concurrent execution of the same attempt before either callback can duplicate a send', async () => {
    await freeze(FAKE_CANDIDATE); const ledger = await open({ candidate: FAKE_CANDIDATE, phase: 'qualification' });
    const run = campaign()[0]!, signal = new AbortController().signal;
    let release!: () => void;
    const delay = new Promise<void>(resolve => { release = resolve; });
    const execute = vi.fn(async (item: CampaignRun, attempt: number) => {
      await delay;
      return measureRun({ run: item, attempt, ledger, transport: new FixtureTransport(item), cropper: new FixtureCropper(),
        jpeg: Buffer.alloc(0), apiKey: 'synthetic-only', signal });
    });
    const options = { selected: [run], ledger, signal, fullCampaign: false, repeat: false, execute, async record() {} };
    const first = executeCampaign(options);
    try {
      await expect(executeCampaign(options)).rejects.toMatchObject({ code: 'unresolved' });
      expect(execute).toHaveBeenCalledTimes(1);
    } finally { release(); }
    await first; expect(ledger.count).toBe(1); expect(ledger.latestStatus(run.id)).toBe('passed');
  });
  it('retains failed qualification after an explicit passing reserve repeat', async () => {
    await freeze(FAKE_CANDIDATE); let ledger = await open({ candidate: FAKE_CANDIDATE, phase: 'qualification' });
    const run = campaign().find(item => item.id === 'main-numeric-plain-direct')!;
    await perform(ledger, campaign(), { full: true, wrongPrimaryId: run.id });
    expect(ledger.qualificationPassed()).toBe(false); expect(ledger.latestStatus(run.id)).toBe('failed');
    await expect(ledger.finish(run.id, 2, 'passed')).rejects.toMatchObject({ code: 'invalid' }); await ledger.close();
    ledger = await open({ candidate: FAKE_CANDIDATE, phase: 'reserve' }); await perform(ledger, [run], { repeat: true });
    expect(ledger.qualificationPassed()).toBe(false); expect(ledger.count).toBe(97);
  });
  it('stops after a failed result write before completion or any later send', async () => {
    await freeze(FAKE_CANDIDATE); const ledger = await open({ candidate: FAKE_CANDIDATE, phase: 'qualification' });
    const calls: string[] = []; await expect(perform(ledger, campaign(), { full: true, writeFailure: true, calls })).rejects.toThrow('result write');
    expect(calls).toEqual(['preflight-flash']); expect(ledger.count).toBe(1); expect(ledger.completed('preflight-flash')).toBe(false);
    expect(ledger.qualificationPassed()).toBe(false);
    await expect(perform(ledger, [campaign()[0]!], { calls })).rejects.toMatchObject({ code: 'unresolved' });
    await expect(ledger.reserve('preflight-flash', 1, 'Preflight')).rejects.toMatchObject({ code: 'unresolved' });
    expect(calls).toEqual(['preflight-flash']); expect(ledger.count).toBe(1);
  });
  it.each(['qualification', 'reserve'] as const)('blocks %s replay of a charged unfinished attempt even when results exist and are empty', async phase => {
    await freeze(FAKE_CANDIDATE);
    const run = campaign()[0]!, identity = { candidate: FAKE_CANDIDATE, phase };
    let ledger = await open(identity); await ledger.reserve(run.id, 1, 'Preflight'); await ledger.close();
    ledger = await open(identity);
    const writer = await MetadataResults.open(join(directory, 'results.jsonl'));
    try { expect(writer.records).toEqual([]); expect(() => ledger.reconcile(writer.records)).not.toThrow(); }
    finally { await writer.close(); }
    const calls: string[] = [];
    await expect(perform(ledger, [run], { repeat: phase === 'reserve', calls })).rejects.toMatchObject({ code: 'unresolved' });
    await expect(ledger.reserve(run.id, 1, 'Preflight')).rejects.toMatchObject({ code: 'unresolved' });
    await expect(ledger.reserve(run.id, 2, 'Preflight')).rejects.toMatchObject({ code: 'unresolved' });
    expect(calls).toEqual([]); expect(ledger.count).toBe(1); expect(ledger.remaining).toBe(119);
    expect(await fs.readFile(join(directory, 'results.jsonl'), 'utf8')).toBe('');
  });
  it('checks the entire selected scope for unresolved charges before executing any case', async () => {
    await freeze(FAKE_CANDIDATE);
    const runs = campaign().slice(0, 2), identity = { candidate: FAKE_CANDIDATE, phase: 'qualification' as const };
    let ledger = await open(identity); await ledger.reserve(runs[1]!.id, 1, 'Preflight');
    await expect(ledger.reserve(runs[1]!.id, 2, 'Preflight')).rejects.toMatchObject({ code: 'unresolved' });
    await ledger.close(); ledger = await open(identity);
    const calls: string[] = [];
    await expect(perform(ledger, runs, { calls })).rejects.toMatchObject({ code: 'unresolved' });
    expect(calls).toEqual([]); expect(ledger.count).toBe(1); expect(ledger.remaining).toBe(119);
  });
  it.each(['qualification', 'reserve'] as const)('blocks a scoped %s case when another case in that phase is unresolved', async phase => {
    await freeze(FAKE_CANDIDATE);
    const runs = campaign().slice(0, 2), identity = { candidate: FAKE_CANDIDATE, phase };
    let ledger = await open(identity); await ledger.reserve(runs[1]!.id, 1, 'Preflight'); await ledger.close();
    ledger = await open(identity); const calls: string[] = [];
    await expect(perform(ledger, [runs[0]!], { repeat: phase === 'reserve', calls })).rejects.toMatchObject({ code: 'unresolved' });
    expect(calls).toEqual([]); expect(ledger.count).toBe(1); expect(ledger.remaining).toBe(119);
  });
  it('isolates diagnostic orphans from an otherwise complete qualification', async () => {
    const run = phaseRuns('diagnostic')[0]!, calls: string[] = [];
    let ledger = await open({ candidate: FAKE_CANDIDATE, phase: 'diagnostic' });
    await ledger.reserve(run.id, 1, 'Answer');
    await expect(perform(ledger, [run], { calls })).rejects.toMatchObject({ code: 'unresolved' });
    expect(calls).toEqual([]); expect(ledger.count).toBe(1); await ledger.close();
    await freeze(FAKE_CANDIDATE); ledger = await open({ candidate: FAKE_CANDIDATE, phase: 'qualification' });
    await perform(ledger, campaign(), { full: true });
    expect(ledger.qualificationPassed()).toBe(true); expect(ledger.count).toBe(97);
    // A full qualification consumes its entire 96-send phase budget. Exercise the
    // defensive gate with an in-memory synthetic orphan, without another charge.
    const records = (ledger as unknown as { records: { kind: string; phase: string; runId: string; attempt: number }[] }).records;
    const orphan = records.find(item => item.kind === 'contact' && item.phase === 'diagnostic' && item.runId === run.id)!;
    orphan.phase = 'qualification'; orphan.attempt = 2;
    expect(ledger.qualificationPassed()).toBe(false);
    await expect(perform(ledger, [run], { calls })).rejects.toMatchObject({ code: 'unresolved' });
    expect(calls).toEqual([]); expect(ledger.count).toBe(97);
    orphan.phase = 'diagnostic'; orphan.attempt = 1;
    expect(ledger.qualificationPassed()).toBe(true); await ledger.close();
    ledger = await open({ candidate: FAKE_CANDIDATE, phase: 'qualification' });
    expect(ledger.qualificationPassed()).toBe(true); expect(ledger.count).toBe(97);
  });
  it('keeps a charged qualification orphan unresolved across reserve and reopen', async () => {
    await freeze(FAKE_CANDIDATE);
    const run = phaseRuns('diagnostic')[0]!, calls: string[] = [];
    let ledger = await open({ candidate: FAKE_CANDIDATE, phase: 'qualification' });
    await perform(ledger, campaign().slice(0, 2)); await ledger.reserve(run.id, 1, 'Answer');
    expect(ledger.qualificationPassed()).toBe(false); expect(ledger.count).toBe(3); await ledger.close();
    ledger = await open({ candidate: FAKE_CANDIDATE, phase: 'reserve' });
    await perform(ledger, [run], { repeat: true, calls });
    expect(calls).toEqual([run.id]); expect(ledger.count).toBe(4); expect(ledger.qualificationPassed()).toBe(false);
    expect(ledger.unresolved(run.id, { candidate: FAKE_CANDIDATE, phase: 'qualification' })).toBe(true);
    await ledger.close(); ledger = await open({ candidate: FAKE_CANDIDATE, phase: 'qualification' });
    await expect(perform(ledger, [run], { calls })).rejects.toMatchObject({ code: 'unresolved' });
    expect(calls).toEqual([run.id]); expect(ledger.qualificationPassed()).toBe(false);
    expect(ledger.count).toBe(4); expect(ledger.remaining).toBe(116);
  });
  it('rejects cross-identity metadata before writing completion', async () => {
    await freeze(FAKE_CANDIDATE); const ledger = await open({ candidate: FAKE_CANDIDATE, phase: 'qualification' });
    const record = vi.fn(), run = campaign()[0]!;
    await expect(executeCampaign({ selected: [run], ledger, fullCampaign: false, repeat: false, signal: new AbortController().signal,
      async execute() { return { candidate: 'b'.repeat(64), phase: 'diagnostic', runId: run.id, attempt: 1 } as never; }, record })).rejects.toMatchObject({ code: 'scope' });
    expect(record).not.toHaveBeenCalled(); expect(ledger.completed(run.id)).toBe(false);
  });
});
