import * as fs from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FileHandle } from 'node:fs/promises';
import type { PipelineEvent } from '../../src/contracts';
import { campaign } from './cases';
import { FAKE_IDENTITY, FixtureCropper, FixtureTransport, openFakeLedger } from './fakes';
import { CampaignLedger } from './ledger';
import { measureRun } from './measure';
import { isRunMetadata, MetadataResults, readMetadataResults } from './results';
import { ObservedTransport } from './transport';
import { safePipelineCode } from './technical';

describe('allowlisted schema2 diagnostics and read-only historical metadata', () => {
  let directory: string, ledger: CampaignLedger;
  beforeEach(async () => { directory = await fs.mkdtemp(join(tmpdir(), 'sc-fake-metadata-')); ledger = await openFakeLedger(join(directory, 'ledger.jsonl')); });
  afterEach(async () => { vi.restoreAllMocks(); await ledger.close(); await fs.rm(directory, { recursive: true, force: true }); });
  async function metadata(fail = false) {
    const run = campaign()[0]!;
    return measureRun({ run, attempt: ledger.nextAttempt(run.id), ledger,
      transport: fail ? { async send() { return { status: 503, headers: {}, body: Buffer.from('PRIVATE_NETWORK_BODY') }; } } : new FixtureTransport(run),
      cropper: new FixtureCropper(), jpeg: Buffer.alloc(0), apiKey: 'synthetic-only', signal: new AbortController().signal });
  }
  it('persists only a bounded production pipelineCode, never provider bodies/messages/details', async () => {
    const result = await metadata(true);
    expect(result).toMatchObject({ schema: 2, ...FAKE_IDENTITY, status: 'failed', stage: 'Preflight', pipelineCode: 'HttpFailure', actualSends: 1 });
    expect(isRunMetadata(result)).toBe(true); expect(JSON.stringify(result)).not.toContain('PRIVATE'); expect(safePipelineCode('PRIVATE_EXCEPTION')).toBeNull();
    const path = join(directory, 'results.jsonl'), writer = await MetadataResults.open(path), output = vi.spyOn(console, 'log').mockImplementation(() => {});
    try { await writer.append(result); } finally { await writer.close(); }
    expect(await readMetadataResults(path)).toEqual([result]); expect(output).toHaveBeenCalledTimes(1);
    expect(await fs.readFile(path, 'utf8')).not.toContain('PRIVATE');
  });
  it('fails closed without recreating results removed after a durable append and before completion', async () => {
    const result = await metadata(), path = join(directory, 'results.jsonl');
    const output = vi.spyOn(console, 'log').mockImplementation(() => {});
    const writer = await MetadataResults.open(path);
    await writer.append(result); await writer.close();
    expect(await fs.readFile(path, 'utf8')).toBe(JSON.stringify(result) + '\n');
    expect(output).toHaveBeenCalledTimes(1); expect(ledger.count).toBe(1); expect(ledger.completed(result.runId)).toBe(false);
    await ledger.close(); await fs.unlink(path); ledger = await openFakeLedger(join(directory, 'ledger.jsonl'));
    const opened = await MetadataResults.open(path).then(async value => { await value.close(); return true; }, () => false);
    expect(opened).toBe(false); expect(await fs.stat(path).catch(() => null)).toBeNull();
    expect(ledger.count).toBe(1); expect(ledger.remaining).toBe(119);
  });
  it('appends to existing results without truncating previously flushed records', async () => {
    const path = join(directory, 'results.jsonl'), first = await metadata();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    let writer = await MetadataResults.open(path);
    await writer.append(first); await writer.close(); await ledger.finish(first.runId, first.attempt, first.status);
    const prefix = await fs.readFile(path, 'utf8'), second = await metadata();
    writer = await MetadataResults.open(path);
    expect(writer.records).toEqual([first]); await writer.append(second); await writer.close();
    expect(await fs.readFile(path, 'utf8')).toBe(prefix + JSON.stringify(second) + '\n');
    expect(ledger.count).toBe(2);
  });
  it.each(['removed', 'replaced'])('rejects a results file %s while its writer is open', async fault => {
    const path = join(directory, 'results.jsonl'), result = await metadata(), writer = await MetadataResults.open(path);
    const output = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await fs.unlink(path);
      if (fault === 'replaced') await fs.writeFile(path, '', { flag: 'wx' });
      await expect(writer.append(result)).rejects.toThrow('No new contact');
      expect(await fs.readFile(path, 'utf8').catch(() => null)).toBe(fault === 'replaced' ? '' : null);
      expect(ledger.count).toBe(1); expect(output).not.toHaveBeenCalled();
      await expect(writer.append(result)).rejects.toThrow('Unsafe');
    } finally { await writer.close(); }
  });
  it.each(['truncated', 'modified'])('rejects a results file %s in place after a durable append', async fault => {
    const path = join(directory, 'results.jsonl'), result = await metadata(), writer = await MetadataResults.open(path);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await writer.append(result);
      const original = await fs.readFile(path);
      if (fault === 'truncated') await fs.truncate(path, Math.floor(original.length / 2));
      else {
        const changed = original.toString('utf8').replace('"candidate":"a', '"candidate":"b');
        expect(Buffer.byteLength(changed)).toBe(original.length);
        await fs.writeFile(path, changed);
      }
      const damaged = await fs.readFile(path);
      await expect(writer.append(result)).rejects.toThrow('No new contact');
      expect(await fs.readFile(path)).toEqual(damaged);
    } finally { await writer.close(); }
  });
  it('rejects a non-regular or multiply linked results file without changing its bytes', async () => {
    const path = join(directory, 'results.jsonl'), alias = join(directory, 'alias.jsonl');
    await fs.link(path, alias);
    await expect(MetadataResults.open(path)).rejects.toThrow('No new contact');
    expect(await fs.readFile(path, 'utf8')).toBe('');
    await fs.unlink(alias); await fs.unlink(path); await fs.mkdir(path);
    await expect(MetadataResults.open(path)).rejects.toThrow('No new contact');
    expect((await fs.stat(path)).isDirectory()).toBe(true);
  });
  it('reads historical schema1 records without allowing an append or migration', async () => {
    const current = await metadata(), { candidate: _candidate, phase: _phase, pipelineCode: _pipelineCode, extractionComponents: _components, visualCoverage: _coverage, ...base } = current;
    const historical = { ...base, schema: 1 }, path = join(directory, 'historical.jsonl');
    const bytes = JSON.stringify(historical) + '\n'; await fs.writeFile(path, bytes);
    expect(await readMetadataResults(path)).toEqual([historical]); expect(isRunMetadata(historical)).toBe(false);
    await expect(MetadataResults.open(path)).rejects.toThrow('No new contact'); expect(await fs.readFile(path, 'utf8')).toBe(bytes);
  });
  it.each(['extra-key', 'unknown-code', 'raw-components', 'raw-coverage', 'raw-contact', 'raw-stage', 'invalid-phase', 'invalid-candidate'])('rejects %s before durable output', async fault => {
    const result = await metadata(); const changed: Record<string, unknown> = { ...structuredClone(result) };
    if (fault === 'extra-key') changed.answer = 'PRIVATE';
    if (fault === 'unknown-code') changed.pipelineCode = 'PRIVATE';
    if (fault === 'raw-components') changed.extractionComponents = { observed: true, question: 'PRIVATE' };
    if (fault === 'raw-coverage') changed.visualCoverage = { observed: true, diagram: true, labels: true, coordinates: 'PRIVATE' };
    if (fault === 'raw-contact') changed.contacts = [{ ...result.contacts[0], body: 'PRIVATE' }];
    if (fault === 'raw-stage') changed.stages = [{ stage: 'Extract', attempt: 1, status: 'Failed', elapsedMilliseconds: 0, httpStatus: null, message: 'PRIVATE' }];
    if (fault === 'invalid-phase') changed.phase = 'PRIVATE';
    if (fault === 'invalid-candidate') changed.candidate = 'PRIVATE';
    const path = join(directory, 'results.jsonl'), writer = await MetadataResults.open(path);
    try { await expect(writer.append(changed as unknown as typeof result)).rejects.toThrow('Unsafe'); } finally { await writer.close(); }
    expect(await fs.readFile(path, 'utf8')).toBe('');
  });
  it.each(['truncated', 'invalid', 'historical-extra'])('rejects %s results before any later transport can start', async fault => {
    const path = join(directory, 'results.jsonl'); await fs.writeFile(path, fault === 'truncated' ? '{"schema":2' : JSON.stringify({ schema: fault === 'invalid' ? 2 : 1, private: 'PRIVATE' }) + '\n');
    const bytes = await fs.readFile(path); await expect(MetadataResults.open(path)).rejects.toThrow('No new contact'); expect(await fs.readFile(path)).toEqual(bytes); expect(ledger.count).toBe(0);
  });
  it('rejects concurrent results ownership and poisons writes after an actual fsync failure', async () => {
    const path = join(directory, 'results.jsonl'), writer = await MetadataResults.open(path), result = await metadata();
    await expect(MetadataResults.open(path)).rejects.toThrow('locked');
    const file = (writer as unknown as { durable: { file: FileHandle } }).durable.file;
    vi.spyOn(file, 'sync').mockRejectedValue(new Error('PRIVATE_FILE_EXCEPTION'));
    const output = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await expect(writer.append(result)).rejects.toThrow('No new contact');
      const bytes = await fs.readFile(path); await expect(writer.append(result)).rejects.toThrow('Unsafe'); expect(await fs.readFile(path)).toEqual(bytes); expect(output).not.toHaveBeenCalled();
    } finally { await writer.close(); }
    expect(await fs.readFile(path, 'utf8')).not.toContain('PRIVATE');
  });
  it('detects result changes after write and fsync before reporting a durable result', async () => {
    const path = join(directory, 'results.jsonl'), writer = await MetadataResults.open(path), result = await metadata();
    const file = (writer as unknown as { durable: { file: FileHandle } }).durable.file, sync = file.sync.bind(file);
    vi.spyOn(file, 'sync').mockImplementation(async () => { await sync(); await fs.truncate(path, 1); });
    const output = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await expect(writer.append(result)).rejects.toThrow('No new contact');
      expect(writer.records).toEqual([]); expect(output).not.toHaveBeenCalled();
      await expect(writer.verify()).rejects.toThrow('No new contact');
      expect((await fs.stat(path)).size).toBe(1);
    } finally { await writer.close(); }
  });
  it('reconciles exact completions and charged sends, rejecting lost/conflicting/replayed/cross-candidate records', async () => {
    const first = await metadata(); await ledger.finish(first.runId, first.attempt, first.status);
    expect(() => ledger.reconcile([first])).not.toThrow();
    for (const changed of [[], [first, first], [{ ...first, status: 'failed' as const }], [{ ...first, candidate: 'b'.repeat(64) }],
      [{ ...first, contacts: [{ ...first.contacts[0]!, sequence: 120 }] }]]) expect(() => ledger.reconcile(changed)).toThrow('No new contact');
    const orphan = await metadata(); expect(() => ledger.reconcile([first, orphan])).toThrow('No new contact');
  });
  it.each(['missing', 'empty', 'valid-line-truncated', 'replayed', 'conflicting'])('blocks %s durable result history before another execute callback', async fault => {
    const first = await metadata(); await ledger.finish(first.runId, first.attempt, first.status);
    const second = await metadata(); await ledger.finish(second.runId, second.attempt, second.status);
    const path = join(directory, 'results.jsonl');
    if (fault !== 'missing') {
      const records = fault === 'empty' ? [] : fault === 'valid-line-truncated' ? [first] : fault === 'replayed' ? [first, first] : [first, { ...second, status: 'failed' }];
      await fs.writeFile(path, records.map(item => JSON.stringify(item) + '\n').join(''));
    }
    const execute = vi.fn();
    if (fault === 'missing') {
      await fs.unlink(path);
      await expect(MetadataResults.open(path)).rejects.toThrow('No new contact');
      expect(await fs.stat(path).catch(() => null)).toBeNull(); expect(ledger.count).toBe(2); return;
    }
    const writer = await MetadataResults.open(path);
    try { expect(() => { ledger.reconcile(writer.records); execute(); }).toThrow('No new contact'); } finally { await writer.close(); }
    expect(execute).not.toHaveBeenCalled(); expect(ledger.count).toBe(2);
  });
  it('sanitizes unknown event/provider metadata before it can reach output', async () => {
    const run = campaign()[0]!, observed = new ObservedTransport({ async send() {
      return { status: 200, headers: {}, body: Buffer.from(JSON.stringify({ output: [], usage: { input_tokens: 5, output_tokens: 2, private: 'PRIVATE', output_tokens_details: { reasoning_tokens: 'PRIVATE' } } })) };
    } }, ledger, run, 1);
    observed.onEvent({ kind: 'pipeline', stage: 'Answer', attempt: Number.NaN, outcome: 'Failed', elapsedMilliseconds: Number.POSITIVE_INFINITY,
      httpStatus: 'PRIVATE', requestId: 'PRIVATE', detail: 'PRIVATE', code: 'PRIVATE' } as unknown as PipelineEvent);
    const request = { url: 'https://api.deepseek.com/responses', headers: {}, body: Buffer.from('{}') };
    const response = await observed.send(request); response.body.fill(0); request.body.fill(0);
    expect(observed.stages).toEqual([{ stage: 'Answer', attempt: 0, status: 'Failed', elapsedMilliseconds: 0, httpStatus: null }]);
    expect(observed.contacts[0]!.usage).toEqual({ inputTokens: 5, outputTokens: 2, cachedInputTokens: null, cacheWriteTokens: null, reasoningTokens: null });
    expect(JSON.stringify({ stages: observed.stages, contacts: observed.contacts })).not.toContain('PRIVATE'); observed.clearContent();
  });
});
