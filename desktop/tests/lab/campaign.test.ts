import * as fs from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { HttpTransport } from '../../src/contracts';
import { campaign } from './cases';
import { FixtureCropper, FixtureTransport } from './fakes';
import { CampaignLedger } from './ledger';
import { measureRun, runConfiguration } from './measure';
import { isRunMetadata, MetadataResults } from './results';

describe('production pipeline/provider with synthetic in-memory transport (NOT live model quality)', () => {
  let directory: string;
  let ledger: CampaignLedger;
  beforeAll(async () => { directory = await fs.mkdtemp(join(tmpdir(), 'sc-fake-campaign-')); ledger = await CampaignLedger.open(join(directory, 'fake-only.jsonl')); });
  afterAll(async () => { await ledger.close(); await fs.rm(directory, { recursive: true, force: true }); });
  it.each(campaign())('grades and counts $id with production parsing/cleanup', async run => {
    const transport = new FixtureTransport(run), cropper = new FixtureCropper();
    const jpeg = Buffer.from('ORIGINAL-SYNTHETIC-MONITOR');
    const originalImage = jpeg.toString('base64');
    const checked: HttpTransport = { async send(request, signal) {
      const payload = JSON.parse(request.body.toString('utf8'));
      const answering = 'results' in payload.text.format.schema.properties;
      expect(payload.model).toBe(answering ? run.answerModel : 'deepseek-flash');
      expect(payload.reasoning.effort).toBe(answering ? run.thinking.toLowerCase() : 'none');
      expect(payload.max_output_tokens).toBe(answering ? run.answerTokens : 6000);
      if (answering) {
        const context = JSON.parse(payload.input[1].content[0].text);
        expect(context.environment).toEqual({ mode: 'standard' });
        expect(context.clarification).toBeUndefined();
        expect(context.previous_response).toBeUndefined();
        expect(payload.previous_response_id).toBeUndefined();
        if (run.group !== 'preflight') {
          expect(request.body.toString('utf8').includes(originalImage)).toBe(run.mode === 'Direct');
          expect(context.typed_question !== undefined).toBe(run.group === 'typed');
        }
      }
      signal?.throwIfAborted();
      return transport.send(request);
    } };
    const metadata = await measureRun({ run, attempt: 1, ledger, transport: checked, cropper, jpeg, apiKey: 'synthetic-only', signal: new AbortController().signal });
    expect(metadata).toMatchObject({ status: 'passed', canonicalPrimary: true, displayedFirstLine: true, displayedCoverage: true,
      actualSends: run.expectedCalls, budgetMatched: true, refusal: false, stage: null });
    expect(isRunMetadata(metadata)).toBe(true);
    expect(transport.requests).toHaveLength(run.expectedCalls);
    for (const request of transport.requests) expect(request.body.every(byte => byte === 0)).toBe(true);
    for (const response of transport.responses) expect(response.every(byte => byte === 0)).toBe(true);
    for (const crop of cropper.buffers) expect(crop.every(byte => byte === 0)).toBe(true);
    if (run.mode === 'Direct') expect(cropper.buffers).toHaveLength(0);
    const config = runConfiguration(run);
    expect(config.assessmentMode).toBe('standard'); expect(config.enableRefusalRetry).toBe(false);
    expect(config.visionModel).toBe('deepseek-flash'); expect(config.questionRegion).toBeNull();
    expect(config.extractionMaxOutputTokens).toBe(6000);
    await ledger.finish(run.id, 1, metadata.status); jpeg.fill(0);
  });
  it('has exactly 96 actually invoked fake transport sends after the baseline', () => expect(ledger.count).toBe(96));
  it('preserves a wrong-primary attempt whose explanation contains the expected number', async () => {
    const run = campaign().find(item => item.id === 'main-numeric-plain-direct')!;
    const transport = new FixtureTransport(run, true), cropper = new FixtureCropper();
    const metadata = await measureRun({ run, attempt: 2, ledger, transport, cropper, jpeg: Buffer.from('synthetic'), apiKey: 'synthetic-only', signal: new AbortController().signal });
    expect(metadata.status).toBe('failed'); expect(metadata.canonicalPrimary).toBe(false); expect(metadata.displayedFirstLine).toBe(false);
    expect(metadata.actualSends).toBe(1); expect(ledger.count).toBe(97);
    expect(JSON.stringify(metadata)).not.toContain('explanation');
    await ledger.finish(run.id, 2, 'failed');
    expect(ledger.latestStatus(run.id)).toBe('failed');
  });
  it('never serializes raw network errors or extra result fields', async () => {
    const run = campaign()[0]!;
    const metadata = await measureRun({ run, attempt: 2, ledger, transport: { async send() { throw new Error('PRIVATE_KEY_QUESTION_ANSWER_IMAGE'); } },
      cropper: new FixtureCropper(), jpeg: Buffer.alloc(0), apiKey: 'synthetic-only', signal: new AbortController().signal });
    expect(metadata.status).toBe('failed'); expect(metadata.actualSends).toBe(1); expect(JSON.stringify(metadata)).not.toContain('PRIVATE');
    expect(isRunMetadata({ ...metadata, answer: 'private' })).toBe(false);
    const results = await MetadataResults.open(join(directory, 'metadata-only.jsonl'));
    try { await expect(results.append({ ...metadata, answer: 'private' } as typeof metadata)).rejects.toThrow(); }
    finally { await results.close(); }
    expect(await fs.readFile(join(directory, 'metadata-only.jsonl'), 'utf8')).toBe('');
  });
  it.each(['Thorough', 'Balanced'])('fails %s required fidelity when production normalizes an extraction the observer cannot read', async mode => {
    const run = campaign().find(item => item.caseId === 'numeric' && item.layout === 'plain' && item.mode === mode)!;
    const fake = new FixtureTransport(run);
    const transport: HttpTransport = { async send(request) {
      const response = await fake.send(request);
      const envelope = JSON.parse(response.body.toString('utf8'));
      const part = envelope.output[0].content[0];
      const content = JSON.parse(part.text);
      if (Array.isArray(content.questions)) {
        content.questions[0].question = 'Wrong transcription: what is 2 plus 2?';
        content.questions[0].options = [{ id: 'Z', text: null }];
        if (content.evidence) content.evidence.questions[0].required_options = 1;
        part.text = JSON.stringify(content);
        response.body.fill(0); response.body = Buffer.from(JSON.stringify(envelope));
        fake.responses.push(response.body);
      }
      return response;
    } };
    const metadata = await measureRun({ run, attempt: 2, ledger, transport, cropper: new FixtureCropper(),
      jpeg: Buffer.from('synthetic'), apiKey: 'synthetic-only', signal: new AbortController().signal });
    // The actual pipeline accepts/answers this non-choice extraction; missing evidence must independently fail the lab.
    expect(metadata.stage).toBeNull(); expect(metadata.canonicalPrimary).toBe(true); expect(metadata.displayedFirstLine).toBe(true);
    expect(metadata.extractionFidelity).toBe(false); expect(metadata.status).toBe('failed');
    expect(metadata.actualSends).toBe(run.expectedCalls);
    for (const response of fake.responses) expect(response.every(byte => byte === 0)).toBe(true);
  });
});
