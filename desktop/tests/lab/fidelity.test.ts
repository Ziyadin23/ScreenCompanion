import * as fs from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { HttpTransport } from '../../src/contracts';
import { campaign, visualCase } from './cases';
import { CropCoverage } from './coverage';
import { FAKE_REQUIRED_VISUALS, FixtureCropper, FixtureTransport, fakeExtraction, openFakeLedger } from './fakes';
import { gradeExtractionComponents } from './oracle';
import { CampaignLedger } from './ledger';
import { measureRun } from './measure';

describe('fixed extraction components and actual production crop coverage (in memory only)', () => {
  let directory: string, ledger: CampaignLedger;
  beforeEach(async () => { directory = await fs.mkdtemp(join(tmpdir(), 'sc-fake-fidelity-')); ledger = await openFakeLedger(join(directory, 'ledger.jsonl')); });
  afterEach(async () => { await ledger.close(); await fs.rm(directory, { recursive: true, force: true }); });
  it.each(['Thorough', 'Balanced'])('fails %s code fidelity with a right primary and never records code/transcription values', async mode => {
    const run = campaign().find(item => item.caseId === 'code' && item.mode === mode && item.layout === 'plain')!;
    const fake = new FixtureTransport(run);
    const transport: HttpTransport = { async send(request) {
      const response = await fake.send(request), envelope = JSON.parse(response.body.toString('utf8')), part = envelope.output[0].content[0], content = JSON.parse(part.text);
      if (Array.isArray(content.questions)) { content.questions[0].code = 'PRIVATE_CHANGED_PROGRAM'; part.text = JSON.stringify(content); response.body.fill(0); response.body = Buffer.from(JSON.stringify(envelope)); fake.responses.push(response.body); }
      return response;
    } };
    const cropper = new FixtureCropper();
    const metadata = await measureRun({ run, attempt: 1, ledger, transport, cropper, jpeg: Buffer.from('synthetic'), apiKey: 'synthetic-only', signal: new AbortController().signal });
    expect(metadata).toMatchObject({ canonicalPrimary: true, displayedFirstLine: true, stage: null, status: 'failed', extractionFidelity: false,
      extractionComponents: { observed: true, taskCount: true, taskTypes: true, questionText: true, optionIds: true, optionText: true, code: false, imageReferences: true } });
    expect(JSON.stringify(metadata)).not.toContain('PRIVATE');
    for (const bytes of [...fake.responses, ...fake.requests.map(request => request.body), ...cropper.buffers]) expect(bytes.every(byte => byte === 0)).toBe(true);
  });
  // Injected type controls test the strict lab gate, not a model's ability to follow the prompt.
  const diagramTypes = campaign().filter(run => run.caseId === 'diagram' && run.mode !== 'Direct').flatMap(run =>
    (['image', 'short_answer', 'content'] as const).map(type => ({ run, type })));
  it.each(diagramTypes)('$run.id grades injected $type independently of a correct numeric answer and transcribed labels', async ({ run, type }) => {
    const fake = new FixtureTransport(run);
    const labels = 'Rectangle labels: 8 cm and 3 cm.';
    const transport: HttpTransport = { async send(request) {
      const response = await fake.send(request), envelope = JSON.parse(response.body.toString('utf8'));
      const part = envelope.output[0].content[0], content = JSON.parse(part.text);
      if (Array.isArray(content.questions)) {
        content.questions[0].type = type; content.questions[0].additional_context = labels;
        part.text = JSON.stringify(content); response.body.fill(0);
        response.body = Buffer.from(JSON.stringify(envelope)); fake.responses.push(response.body);
      }
      return response;
    } };
    const cropper = new FixtureCropper();
    const metadata = await measureRun({ run, attempt: 1, ledger, transport, cropper, jpeg: Buffer.from('synthetic'),
      apiKey: 'synthetic-only', signal: new AbortController().signal, requiredVisuals: FAKE_REQUIRED_VISUALS });
    const correctType = type === 'image';
    expect(metadata).toMatchObject({ status: correctType ? 'passed' : 'failed', stage: null, pipelineCode: null,
      canonicalPrimary: true, displayedFirstLine: true, displayedCoverage: true, budgetMatched: true,
      actualSends: run.expectedCalls, extractionFidelity: correctType,
      extractionComponents: { observed: true, taskCount: true, taskTypes: correctType, questionText: true,
        optionIds: true, optionText: true, code: true, imageReferences: true },
      visualCoverage: { observed: true, diagram: true, labels: true } });
    expect(fake.requests).toHaveLength(run.expectedCalls);
    expect(cropper.buffers).toHaveLength(run.mode === 'Thorough' ? 2 : 1);
    expect(JSON.stringify(metadata)).not.toContain(labels);
    for (const bytes of [...fake.responses, ...fake.requests.map(request => request.body), ...cropper.buffers]) expect(bytes.every(byte => byte === 0)).toBe(true);
  });
  it('distinguishes every fixed component and preserves source ordering', () => {
    const fixture = visualCase('mcq'), baseline = fakeExtraction(fixture).questions;
    expect(gradeExtractionComponents(fixture, null)).toEqual({ observed: false, taskCount: false, taskTypes: false, questionText: false, optionIds: false, optionText: false, code: false, imageReferences: false });
    for (const [flag, mutate] of [
      ['taskTypes', (item: typeof baseline) => { item[0]!.type = 'content'; }],
      ['questionText', (item: typeof baseline) => { item[0]!.question = 'Wrong wording'; }],
      ['optionIds', (item: typeof baseline) => { item[0]!.options[0]!.id = 'Z'; }],
      ['optionText', (item: typeof baseline) => { item[0]!.options[0]!.text = 'Wrong text'; }],
      ['code', (item: typeof baseline) => { item[0]!.code = 'Unexpected program'; }],
      ['imageReferences', (item: typeof baseline) => { item[0]!.image_ids = ['unexpected']; }]
    ] as const) {
      const changed = structuredClone(baseline); mutate(changed); expect(gradeExtractionComponents(fixture, changed)).toMatchObject({ [flag]: false });
    }
    const multiple = visualCase('multiple'); expect(gradeExtractionComponents(multiple, fakeExtraction(multiple).questions.reverse())).toMatchObject({ taskCount: true, questionText: false });
    expect(gradeExtractionComponents(fixture, [])).toMatchObject({ observed: true, taskCount: false });
  });
  it.each(['Thorough', 'Balanced'])('grades %s diagram and both labels independently using production normalized crop calls', async mode => {
    const run = campaign().find(item => item.caseId === 'diagram' && item.mode === mode && item.layout === 'plain')!;
    const runWith = async (requiredVisuals = FAKE_REQUIRED_VISUALS) => {
      const result = await measureRun({ run, attempt: ledger.nextAttempt(run.id), ledger,
        transport: new FixtureTransport(run), cropper: new FixtureCropper(), jpeg: Buffer.from('synthetic'), apiKey: 'synthetic-only', signal: new AbortController().signal, requiredVisuals });
      await ledger.finish(run.id, result.attempt, result.status); return result;
    };
    expect(await runWith()).toMatchObject({ status: 'passed', visualCoverage: { observed: true, diagram: true, labels: true } });
    const missingLabel = [{ ...FAKE_REQUIRED_VISUALS[0]!, labels: [FAKE_REQUIRED_VISUALS[0]!.labels[0]!, { x: .8, y: .8, width: .05, height: .05 }] }];
    expect(await runWith(missingLabel)).toMatchObject({ canonicalPrimary: true, extractionFidelity: true, status: 'failed', visualCoverage: { observed: true, diagram: true, labels: false } });
    const missingDiagram = [{ ...FAKE_REQUIRED_VISUALS[0]!, diagram: { x: .8, y: .8, width: .05, height: .05 } }];
    expect(await runWith(missingDiagram)).toMatchObject({ status: 'failed', visualCoverage: { observed: true, diagram: false, labels: true } });
    const noObserver = await measureRun({ run, attempt: ledger.nextAttempt(run.id), ledger, transport: new FixtureTransport(run), cropper: new FixtureCropper(),
      jpeg: Buffer.from('synthetic'), apiKey: 'synthetic-only', signal: new AbortController().signal });
    expect(noObserver).toMatchObject({ canonicalPrimary: true, extractionFidelity: true, status: 'failed', visualCoverage: { observed: false, diagram: false, labels: false } });
    await ledger.finish(run.id, noObserver.attempt, noObserver.status);
  });
  it('composes nested crop coordinates instead of treating Thorough-local coordinates as monitor coordinates', async () => {
    const input = Buffer.from('synthetic'), cropper = new FixtureCropper(); let extracting = false;
    const observer = new CropCoverage(cropper, input, () => extracting);
    const question = await observer.crop(input, { x: .5, y: .5, width: .4, height: .4 }); extracting = true;
    await observer.crop(question, { x: .25, y: .25, width: .5, height: .5 });
    const covered = { diagram: { x: .61, y: .61, width: .05, height: .05 }, labels: [{ x: .7, y: .7, width: .02, height: .02 }, { x: .75, y: .75, width: .02, height: .02 }] };
    expect(observer.grade([covered])).toEqual({ observed: true, diagram: true, labels: true });
    expect(observer.grade([{ ...covered, diagram: { x: .3, y: .3, width: .05, height: .05 } }]).diagram).toBe(false);
    observer.clear(); expect(observer.grade([covered]).observed).toBe(false);
    for (const buffer of cropper.buffers) buffer.fill(0); input.fill(0);
  });
  it('fails closed when actual visual crop evidence is missing or required label geometry is invalid', async () => {
    const input = Buffer.from('synthetic'), cropper = new FixtureCropper(), observer = new CropCoverage(cropper, input, () => true);
    expect(observer.grade(FAKE_REQUIRED_VISUALS).observed).toBe(false);
    await observer.crop(Buffer.from('unobserved input'), { x: .2, y: .2, width: .6, height: .6 });
    expect(observer.grade(FAKE_REQUIRED_VISUALS)).toEqual({ observed: false, diagram: false, labels: false }); observer.clear();
    const valid = new CropCoverage(cropper, input, () => true); await valid.crop(input, { x: .2, y: .2, width: .6, height: .6 });
    expect(valid.grade([{ ...FAKE_REQUIRED_VISUALS[0]!, labels: [] }]).observed).toBe(false); valid.clear();
    for (const buffer of cropper.buffers) buffer.fill(0); input.fill(0);
  });
});
