import type { HttpRequest, HttpResponse, HttpTransport, ImageCropper, NormalizedRegion } from '../../src/contracts';
import type { QuestionAnswer } from '../../src/pipeline/answer';
import type { VisualCase, Expected, CampaignRun } from './cases';
import { visualCase } from './cases';

export const QUESTION_REGION = { x: .15, y: .15, width: .7, height: .7 };
export function expectedPrimary(expected: Expected): string {
  return expected.kind === 'number' ? String(expected.value) : expected.kind === 'text' ? expected.alternatives[0]! : expected.ids.join(', ');
}
export function fakeExtraction(fixture: VisualCase) {
  return { questions: fixture.independent ? [] : fixture.questions.map(item => ({ question_id: item.id, type: item.type, question: item.text,
    options: item.options?.map((text, i) => ({ id: String.fromCharCode(65 + i), text })) ?? [], code: item.code ?? null,
    additional_context: null, image_ids: item.diagram ? ['rectangle'] : [] })),
  images: fixture.independent ? [] : fixture.questions.filter(item => item.diagram).map(() => ({ id: 'rectangle', region: { x: .3, y: .3, width: .3, height: .2 } })) };
}
export function fakeAnswer(questionId: string, answer: string, overrides: Partial<QuestionAnswer> = {}): QuestionAnswer {
  return { question_id: questionId, answer, answers: [], answer_text: null, explanation: '', confidence: null, status: 'answer', ...overrides };
}
// Fake-only transport. Unexpected calls throw; it has no fetch, native bridge, sockets or credentials.
export class FixtureTransport implements HttpTransport {
  readonly requests: HttpRequest[] = [];
  readonly responses: Buffer[] = [];
  constructor(readonly run: CampaignRun, private readonly corruptAnswer = false) {}
  async send(request: HttpRequest): Promise<HttpResponse> {
    if (this.requests.length >= this.run.expectedCalls) throw new Error('Unexpected synthetic send.');
    this.requests.push(request);
    const payload = JSON.parse(request.body.toString('utf8'));
    const properties = payload.text.format.schema.properties;
    const fixture = this.run.caseId ? visualCase(this.run.caseId) : null;
    let value: unknown;
    if ('results' in properties) {
      const context = JSON.parse(payload.input[1].content[0].text);
      const targets: { question_id: string }[] = context.answer_targets;
      value = { results: targets.map((target, index) => {
        if (!fixture) {
          const requested = /^Return the number (-?\d+)\.$/.exec(context.typed_question ?? '');
          if (!requested) throw new Error('Unexpected synthetic preflight task.');
          return fakeAnswer(target.question_id, requested[1]!);
        }
        if (this.corruptAnswer) return fakeAnswer(target.question_id, '0', { explanation: 'The explanation mentions 42, 24, 10, 25 and 36.' });
        const expected = fixture.questions[index]!.expected;
        if (this.run.mode === 'Direct' && fixture.questions.length > 1) return fakeAnswer(target.question_id,
          fixture.questions.map((item, i) => `Q${i + 1}: ${expectedPrimary(item.expected)}`).join('\n'));
        const fields: Partial<QuestionAnswer> = fixture.responseMode ? { status: 'transformation' } : {};
        if (expected.kind === 'choice' && this.run.mode !== 'Direct') {
          if (expected.ids.length > 1) return fakeAnswer(target.question_id, '', { ...fields, answer: null, answers: [...expected.ids] });
          return fakeAnswer(target.question_id, expected.ids[0]!, { ...fields, answer_text: expected.labels[expected.ids[0]!]! });
        }
        return fakeAnswer(target.question_id, expectedPrimary(expected), fields);
      }) };
    } else if ('found' in properties) value = fixture?.independent ? { found: false, region: null } : { found: true, region: QUESTION_REGION };
    else {
      if (!fixture) throw new Error('Unexpected extraction in preflight.');
      const extracted = fakeExtraction(fixture);
      value = 'evidence' in properties ? { ...extracted, status: fixture.independent ? 'no_relevant_content' : 'complete',
        question_region: fixture.independent ? null : QUESTION_REGION, evidence: { status: 'complete', region_complete: true,
          questions: extracted.questions.map((item, i) => ({ index: i + 1, required_options: item.options.length,
            requires_code: item.type === 'code', requires_visual: item.type === 'image', transcription_complete: true, visuals_complete: true })) } } : extracted;
    }
    const body = Buffer.from(JSON.stringify({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(value) }] }],
      usage: { input_tokens: 200, output_tokens: 40, input_tokens_details: { cached_tokens: 20 }, output_tokens_details: { reasoning_tokens: 0 } } }));
    this.responses.push(body);
    return { status: 200, headers: { 'content-type': 'application/json' }, body };
  }
}
export class FixtureCropper implements ImageCropper {
  readonly buffers: Buffer[] = [];
  readonly regions: NormalizedRegion[] = [];
  async crop(_jpeg: Buffer, region: NormalizedRegion): Promise<Buffer> {
    this.regions.push({ ...region });
    const buffer = Buffer.from(`synthetic-isolated-crop-${this.buffers.length}`); this.buffers.push(buffer); return buffer;
  }
}
