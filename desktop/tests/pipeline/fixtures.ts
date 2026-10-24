import { expect } from 'vitest';
import type { ApiProvider, HttpRequest, HttpResponse, HttpTransport, ImageCropper, NormalizedRegion, PipelineConfiguration, PipelineInput } from '../../src/contracts';
import { loadPipelineConfiguration } from '../../src/pipeline';
import { usesResponses } from '../../src/providers';

// Synthetic in-memory fixtures only. Kept distinct from real JPEG/capture or live model evidence.
export type FixtureCase = 'multiple' | 'multi' | 'short' | 'code' | 'image' | 'content';
export interface FixtureQuestion {
  question_id: string | null; type: string; question: string; options: { id: string; text: string }[];
  code: string | null; additional_context: string | null; image_ids: string[];
}
export const questionRegion = { x: .2, y: .2, width: .6, height: .6 };
export function extraction(kind: FixtureCase = 'short') {
  const question: FixtureQuestion = { question_id: kind, type: ({ multiple: 'multiple_choice', multi: 'multiple_selection', short: 'short_answer', code: 'code', image: 'image', content: 'content' })[kind],
    question: ({ multiple: 'Which command lists directory contents?', multi: 'Select all prime numbers.', short: 'What is 6 multiplied by 7?',
      code: 'What does this Python code print?', image: 'What is the area of the rectangle?', content: 'A source sentence to transform.' })[kind],
    options: [], code: kind === 'code' ? '\n  values = [2, 3, 5]\n  print(sum(values))\n' : null, additional_context: null,
    image_ids: kind === 'image' ? ['rectangle'] : [] };
  if (kind === 'multiple' || kind === 'multi') question.options = (kind === 'multiple' ? ['cd', 'ls', 'rm', 'pwd'] : ['2', '4', '5', '9']).map((text, i) => ({ id: String.fromCharCode(65 + i), text }));
  return { questions: [question], images: kind === 'image' ? [{ id: 'rectangle', region: { x: .3, y: .3, width: .3, height: .2 } }] : [] };
}
export const detection = (region = questionRegion) => ({ found: true, region });
export function combined(kind: FixtureCase = 'short') {
  return { ...extraction(kind), status: 'complete', question_region: { ...questionRegion }, evidence: { status: 'complete', region_complete: true,
    questions: [{ index: 1, required_options: kind === 'multiple' || kind === 'multi' ? 4 : 0, requires_code: kind === 'code', requires_visual: kind === 'image',
      transcription_complete: true, visuals_complete: true }] } };
}
export const noContext = () => ({ status: 'no_relevant_content', question_region: null, questions: [], images: [],
  evidence: { status: 'complete', region_complete: true, questions: [] } });
// Payloads are inspected within fake transport sends, before production zeros its byte buffers.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Payload = Record<string, any>;
export function userContent(payload: Payload): Payload[] { return payload.input ? payload.input[1].content : payload.messages[1].content; }
export function context(payload: Payload): Payload { return JSON.parse(userContent(payload)[0]!.text); }
export function images(payload: Payload): string[] {
  return userContent(payload).filter(part => part.type === 'input_image' || part.type === 'image_url')
    .map(part => part.image_url.url ?? part.image_url);
}
export function canonical(payload: Payload, answer = '42', fields: Payload = {}) {
  return { results: context(payload).answer_targets.map((target: Payload) => ({ question_id: target.question_id,
    answer, answers: [], answer_text: null, explanation: '', confidence: null, status: 'answer', ...fields })) };
}
export function envelope(provider: ApiProvider, text: unknown, refusal?: string): Payload {
  const content = typeof text === 'string' ? text : JSON.stringify(text);
  return usesResponses(provider) ? { status: 'completed', output: [{ type: 'message', content: [refusal ? { type: 'refusal', refusal } : { type: 'output_text', text: content }] }] } :
    { choices: [{ finish_reason: 'stop', message: { content: refusal ? null : content, refusal: refusal ?? null } }] };
}
export type FakeStep = (payload: Payload, request: HttpRequest) => Payload | HttpResponse | Promise<Payload | HttpResponse>;
export class StrictTransport implements HttpTransport {
  readonly payloads: Payload[] = [];
  readonly requests: HttpRequest[] = [];
  readonly responseBuffers: Buffer[] = [];
  constructor(readonly steps: FakeStep[], readonly provider: ApiProvider = 'OpenAI') {}
  async send(request: HttpRequest): Promise<HttpResponse> {
    const step = this.steps[this.requests.length];
    this.requests.push(request);
    const payload = JSON.parse(request.body.toString()) as Payload;
    this.payloads.push(payload);
    if (!step) throw new Error('Unexpected provider request');
    const value = await step(payload, request);
    const response: HttpResponse = Buffer.isBuffer(value.body) ? value as HttpResponse :
      { status: 200, headers: { 'content-type': 'application/json' }, body: Buffer.from(JSON.stringify(value)) };
    this.responseBuffers.push(response.body);
    return response;
  }
  done(): void { expect(this.requests).toHaveLength(this.steps.length); }
  cleared(): void {
    for (const request of this.requests) expect(request.body.every(byte => byte === 0)).toBe(true);
    for (const response of this.responseBuffers) expect(response.every(byte => byte === 0)).toBe(true);
  }
}
export class TrackingCropper implements ImageCropper {
  readonly regions: NormalizedRegion[] = [];
  readonly buffers: Buffer[] = [];
  readonly inputs: Buffer[] = [];
  async crop(input: Buffer, region: NormalizedRegion): Promise<Buffer> {
    this.regions.push({ ...region }); this.inputs.push(input);
    const bytes = Buffer.from(`isolated-image-${this.buffers.length + 1}`); this.buffers.push(bytes); return bytes;
  }
  cleared(): void { for (const buffer of this.buffers) expect(buffer.every(byte => byte === 0)).toBe(true); }
}
export function configuration(overrides: Partial<PipelineConfiguration> = {}): PipelineConfiguration { return { ...loadPipelineConfiguration({}), ...overrides }; }
export function pipelineInput(overrides: Partial<PipelineInput> = {}): PipelineInput {
  return { jpeg: Buffer.from('ORIGINAL-MONITOR-SENTINEL ASSESSMENT_MODE=qa'), apiKey: 'synthetic-test-key', responseMode: 'Default', customInstruction: '',
    configuration: configuration(), signal: new AbortController().signal, ...overrides };
}
export const refusal = 'I cannot provide answers to a live proctored assessment.';

/** Grade the primary field independently of explanation and displayed output. */
export function expectPrimary(primary: string | string[], kind: FixtureCase): void {
  const expected = { short: '42', code: '10', image: '24', content: 'Transformed source', multiple: 'B', multi: ['A', 'C'] };
  expect(primary).toEqual(expected[kind]);
}
export function expectFirstLine(displayed: string, expected: string): void { expect(displayed.replaceAll('\r', '').split('\n')[0]).toBe(expected); }
