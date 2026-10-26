import * as fs from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { HttpTransport } from '../../src/contracts';
import type { QuestionAnswer } from '../../src/pipeline/answer';
import { answerInstruction, standardInstruction } from '../../src/pipeline/prompts';
import { campaign, type CampaignRun } from './cases';
import { FixtureCropper } from './fakes';
import { CampaignLedger } from './ledger';
import { measureRun } from './measure';
import { isRunMetadata } from './results';

describe('text-only preflight canonical contract (synthetic responses only)', () => {
  let directory: string;
  let ledger: CampaignLedger;
  beforeAll(async () => {
    directory = await fs.mkdtemp(join(tmpdir(), 'sc-fake-preflight-contract-'));
    ledger = await CampaignLedger.open(join(directory, 'fake-only.jsonl'));
  });
  afterAll(async () => { await ledger.close(); await fs.rm(directory, { recursive: true, force: true }); });

  async function measure(run: CampaignRun, overrides: Partial<QuestionAnswer> = {}) {
    const cropper = new FixtureCropper();
    const requests: Buffer[] = [], responses: Buffer[] = [], ids: string[] = [];
    const transport: HttpTransport = { async send(request) {
      requests.push(request.body);
      const payload = JSON.parse(request.body.toString('utf8'));
      expect(request.url).toBe('https://api.deepseek.com/responses');
      expect(payload.model).toBe(run.answerModel);
      expect(payload.reasoning.effort).toBe(run.thinking.toLowerCase());
      expect(payload.max_output_tokens).toBe(run.answerTokens);
      expect(payload.input).toHaveLength(2);
      // Use the production instructions: the schema alone does not specify the semantics of nullable fields.
      expect(payload.input[0]).toEqual({ role: 'system', content: standardInstruction + answerInstruction });
      expect(payload.input[1].role).toBe('user');
      expect(payload.input[1].content).toHaveLength(1);
      expect(payload.input[1].content[0].type).toBe('input_text');
      const context = JSON.parse(payload.input[1].content[0].text);
      expect(context).toMatchObject({ environment: { mode: 'standard' }, requested_operation: 'AnswerQuestions',
        response_preferences: 'Return only the answer; leave explanation empty.', typed_question: 'Return the number 7.',
        task: { questions: [], additional_context: null, images: [] } });
      expect(context.answer_targets).toHaveLength(1);
      const target = context.answer_targets[0];
      expect(target).toMatchObject({ source_question_id: null, source_question_index: null });
      expect(target.question_id).toMatch(/^task_[a-f0-9]+_1$/);
      ids.push(target.question_id);
      const fields = payload.text.format.schema.properties.results.items;
      expect(fields.properties.question_id.enum).toEqual([target.question_id]);
      expect(fields.required).toEqual(expect.arrayContaining(['question_id', 'answer', 'answers', 'answer_text', 'explanation', 'confidence', 'status']));
      // Derive this synthetic response from the actual task and echo the current target, rather than returning 7 unconditionally.
      const number = /^Return the number (-?\d+)\.$/.exec(context.typed_question)?.[1];
      if (number === undefined) throw new Error('Unexpected synthetic preflight task.');
      const body = Buffer.from(JSON.stringify({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text',
        text: JSON.stringify({ results: [{ question_id: target.question_id, answer: number, answers: [], answer_text: null,
          explanation: '', confidence: null, status: 'answer', ...overrides }] }) }] }], usage: { input_tokens: 322, output_tokens: 61 } }));
      responses.push(body);
      return { status: 200, headers: { 'content-type': 'application/json' }, body };
    } };
    const before = ledger.count;
    const metadata = await measureRun({ run, attempt: ledger.nextAttempt(run.id), ledger, transport, cropper,
      jpeg: Buffer.alloc(0), apiKey: 'synthetic-only', signal: new AbortController().signal });
    expect(ledger.count).toBe(before + 1);
    expect(requests).toHaveLength(1); expect(responses).toHaveLength(1);
    for (const buffer of [...requests, ...responses]) expect(buffer.every(byte => byte === 0)).toBe(true);
    expect(cropper.buffers).toHaveLength(0);
    expect(isRunMetadata(metadata)).toBe(true);
    expect(metadata).toMatchObject({ actualSends: 1, expectedCalls: 1, budgetMatched: true,
      contacts: [{ stage: 'Preflight', status: 'returned', httpStatus: 200, usage: { inputTokens: 322, outputTokens: 61 } }] });
    return { metadata, id: ids[0]! };
  }

  it.each(campaign().filter(run => run.group === 'preflight'))('accepts the requested canonical and displayed 7 for $id with fresh target IDs', async run => {
    const first = await measure(run), second = await measure(run);
    for (const { metadata } of [first, second]) expect(metadata).toMatchObject({ status: 'passed', stage: null,
      canonicalPrimary: true, displayedFirstLine: true, displayedCoverage: true });
    expect(first.id).not.toBe(second.id);
  });

  it.each<[string, Partial<QuestionAnswer>, boolean, string | null]>([
    ['wrong primary with 7 only in explanation', { answer: '0', explanation: 'The expected answer is 7.' }, false, null],
    ['wrong displayed first line with a later 7', { answer: '0\n7' }, false, null],
    ['choice selection in a typed number task', { answer: '7', answers: ['7'] }, false, 'ValidateAnswer'],
    ['inapplicable option text', { answer: '7', answer_text: '7' }, false, 'ValidateAnswer'],
    ['missing primary with 7 only in explanation', { answer: null, explanation: '7' }, false, 'ValidateAnswer'],
    ['wrong task ID', { question_id: '1' }, false, 'ValidateAnswer'],
    ['refusal despite the expected number', { status: 'refusal', answer: '7' }, true, null]
  ])('rejects %s without weakening the oracle or saving content', async (_label, overrides, displayed, stage) => {
    const { metadata } = await measure(campaign()[0]!, overrides);
    expect(metadata).toMatchObject({ status: 'failed', stage, canonicalPrimary: false, displayedFirstLine: displayed, displayedCoverage: displayed });
    expect(JSON.stringify(metadata)).not.toContain('explanation');
  });
});
