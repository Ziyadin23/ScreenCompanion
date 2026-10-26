import type { HttpRequest, HttpResponse, HttpTransport, ModelUsage, PipelineEvent } from '../../src/contracts';
import { parseModelResponse } from '../../src/providers';
import { isObject, parseJson } from '../../src/providers/json';
import { parseCanonicalAnswer, type QuestionAnswer } from '../../src/pipeline/answer';
import { extractionObject, type QuestionContent } from '../../src/pipeline/extraction';
import type { CampaignRun } from './cases';
import type { CampaignLedger, ContactStage } from './ledger';

export interface ContactMetadata {
  sequence: number; stage: ContactStage; status: 'returned' | 'failed';
  httpStatus: number | null; elapsedMilliseconds: number; usage: ModelUsage | null;
}
export interface StageMetadata {
  stage: string; attempt: number; status: 'Started' | 'Completed' | 'Failed';
  elapsedMilliseconds: number; httpStatus: number | null;
}
function targets(request: HttpRequest): string[] {
  const root: unknown = parseJson(request.body.toString('utf8'));
  if (!isObject(root) || !Array.isArray(root.input) || !isObject(root.input[1]) || !Array.isArray(root.input[1].content)) return [];
  const part: unknown = root.input[1].content[0];
  if (!isObject(part) || typeof part.text !== 'string') return [];
  const context: unknown = parseJson(part.text);
  if (!isObject(context) || !Array.isArray(context.answer_targets)) return [];
  return context.answer_targets.map(target => isObject(target) && typeof target.question_id === 'string' ? target.question_id : '');
}
function questions(text: string): QuestionContent[] | null {
  const root = extractionObject(text);
  if (!Array.isArray(root.questions)) return null;
  const result: QuestionContent[] = [];
  for (const item of root.questions) {
    if (!isObject(item) || typeof item.question !== 'string' || typeof item.type !== 'string' || !Array.isArray(item.options) || !Array.isArray(item.image_ids)) return null;
    const options: { id: string; text: string }[] = [];
    for (const option of item.options) {
      if (!isObject(option) || typeof option.id !== 'string' || typeof option.text !== 'string') return null;
      options.push({ id: option.id, text: option.text });
    }
    if (!item.image_ids.every(id => typeof id === 'string')) return null;
    result.push({ question_id: typeof item.question_id === 'string' ? item.question_id : null, type: item.type,
      question: item.question, options, code: typeof item.code === 'string' ? item.code : null,
      additional_context: null, image_ids: item.image_ids as string[] });
  }
  return result;
}

/** Inspect real response bytes before sendModel's finally zeroes them. No production hooks or alternate parser. */
export class ObservedTransport implements HttpTransport {
  readonly contacts: ContactMetadata[] = [];
  readonly stages: StageMetadata[] = [];
  answers: QuestionAnswer[] | null = null;
  extracted: QuestionContent[] | null = null;
  refusal = false;
  private stage: ContactStage;
  private sends = 0;
  constructor(private readonly inner: HttpTransport, private readonly ledger: Pick<CampaignLedger, 'reserve'>,
    private readonly run: CampaignRun, private readonly attempt: number) { this.stage = run.group === 'preflight' ? 'Preflight' : 'Answer'; }
  get actualSends(): number { return this.sends; }
  onEvent = (event: PipelineEvent): void => {
    if (event.kind !== 'pipeline') return;
    if (event.outcome === 'Started' && ['Locate', 'Extract', 'Answer'].includes(event.stage)) this.stage = event.stage as ContactStage;
    if (['Locate', 'Crop', 'Extract', 'Answer', 'ValidateAnswer'].includes(event.stage) &&
        ['Started', 'Completed', 'Failed'].includes(event.outcome ?? '')) this.stages.push({ stage: event.stage, attempt: event.attempt,
      status: event.outcome as StageMetadata['status'], elapsedMilliseconds: event.elapsedMilliseconds ?? 0, httpStatus: event.httpStatus ?? null });
  };
  async send(request: HttpRequest, signal?: AbortSignal): Promise<HttpResponse> {
    if (request.url !== 'https://api.deepseek.com/responses' || this.sends >= this.run.expectedCalls) throw new Error('Lab request boundary rejected an unexpected send.');
    signal?.throwIfAborted();
    // Parsing contains no I/O and never prints or persists request content.
    let ids: string[] = [];
    if (this.stage === 'Answer' || this.stage === 'Preflight') { try { ids = targets(request); } catch { /* Production validation owns malformed requests. */ } }
    const reservation = await this.ledger.reserve(this.run.id, this.attempt, this.stage);
    const metadata: ContactMetadata = { sequence: reservation.sequence, stage: this.stage, status: 'failed', httpStatus: null,
      elapsedMilliseconds: 0, usage: null };
    this.contacts.push(metadata);
    const start = performance.now();
    try {
      ++this.sends; // Actual transport invocation, distinct from a pipeline's planned/model-call counters.
      const response = await this.inner.send(request, signal);
      metadata.status = 'returned'; metadata.httpStatus = response.status;
      if (response.status >= 200 && response.status < 300) {
        try {
          const parsed = parseModelResponse(parseJson(response.body.toString('utf8')), 'DeepSeek');
          metadata.usage = parsed.usage;
          if (this.stage === 'Answer' || this.stage === 'Preflight') {
            this.refusal = Boolean(parsed.refusal);
            const answers = parsed.refusal ? null : parseCanonicalAnswer(parsed.text);
            if (Array.isArray(answers) && answers.length === ids.length && new Set(ids).size === ids.length && ids.every(id => answers.filter(answer => answer.question_id === id).length === 1))
              this.answers = ids.map(id => answers.find(answer => answer.question_id === id)!);
            else this.answers = null;
          } else if (this.stage === 'Extract') this.extracted = questions(parsed.text);
        } catch { /* A malformed body is graded as failure; the production parser still handles it. */ }
      }
      return response;
    } finally { metadata.elapsedMilliseconds = Math.floor(performance.now() - start); }
  }
  clearContent(): void { this.answers = null; this.extracted = null; }
}
