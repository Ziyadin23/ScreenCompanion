import { describe, expect, it } from 'vitest';
import type { PipelineEvent, ResponseMode } from '../../src/contracts';
import { createPipelineRunner } from '../../src/pipeline';
import { canonical, configuration, context, envelope, images, pipelineInput, refusal, StrictTransport, TrackingCropper, type Payload } from './fixtures';

// Synthetic boundary cases, not recovered responses from historical live failures.
const expectedSchema = (targetId: string) => ({
  type: 'object', required: ['results'], additionalProperties: false,
  properties: { results: {
    type: 'array', minItems: 1, maxItems: 1,
    items: {
      type: 'object', required: ['question_id', 'answer', 'answers', 'answer_text', 'explanation', 'confidence', 'status'], additionalProperties: false,
      properties: {
        question_id: { type: 'string', enum: [targetId] }, answer: { type: ['string', 'null'] },
        answers: { type: 'array', items: { type: 'string' }, maxItems: 0 }, answer_text: { type: 'null' },
        explanation: { type: 'string' }, confidence: { type: ['number', 'null'], minimum: 0, maximum: 1 },
        status: { type: 'string', enum: ['answer', 'transformation', 'refusal', 'missing_information'] }
      }
    }
  } }
});

function directRun(respond: (payload: Payload) => unknown, responseMode: ResponseMode = 'Default') {
  const events: PipelineEvent[] = [], cropper = new TrackingCropper();
  const transport = new StrictTransport([payload => envelope('DeepSeek', respond(payload))], 'DeepSeek');
  const input = pipelineInput({ responseMode, onEvent: event => events.push(event),
    customInstruction: responseMode === 'Custom' ? 'Translate the requested source text.' : '',
    configuration: configuration({ provider: 'DeepSeek', answerModel: 'deepseek-flash', mode: 'Direct', assessmentMode: 'qa', enableRefusalRetry: true }) });
  return { transport, cropper, events, input, promise: createPipelineRunner({ transport, cropper }).run(input) };
}

function expectSingleSend(run: ReturnType<typeof directRun>): void {
  run.transport.done(); run.transport.cleared();
  expect(run.cropper.regions).toEqual([]);
  expect(run.events.filter(event => event.kind === 'pipeline_usage').map(event => event.requestCount)).toEqual([1]);
  expect(run.events.every(event => ['Answer', 'ValidateAnswer'].includes(event.stage))).toBe(true);
  expect(images(run.transport.payloads[0]!)).toEqual([`data:image/jpeg;base64,${run.input.jpeg.toString('base64')}`]);
  expect(run.input.jpeg[0]).not.toBe(0);
}

describe('Direct production request contract', () => {
  it.each([false, true])('serializes exactly one current screen-level target, typed=%s', async typed => {
    const transport = new StrictTransport([payload => envelope('DeepSeek', canonical(payload, 'A complete textual answer.'))], 'DeepSeek');
    const cropper = new TrackingCropper();
    const input = pipelineInput({ typedQuestion: typed ? 'Describe the relevant diagram.' : undefined,
      configuration: configuration({ provider: 'DeepSeek', answerModel: 'deepseek-flash', mode: 'Direct', thinking: 'High', answerMaxOutputTokens: 16000 }) });
    expect((await createPipelineRunner({ transport, cropper }).run(input)).text).toBe('A complete textual answer.');
    transport.done(); transport.cleared(); expect(cropper.regions).toEqual([]);
    const payload = transport.payloads[0]!, task = context(payload);
    expect(task.answer_targets).toHaveLength(1);
    const targetId = task.answer_targets[0].question_id;
    expect(targetId).toMatch(/^task_[a-f0-9]{32}_1$/);
    expect(task.answer_targets[0]).toEqual({ question_id: targetId, source_question_index: null, source_question_id: null });
    expect(task.typed_question).toBe(typed ? 'Describe the relevant diagram.' : undefined);
    expect(task.request_source).toBe('direct_screenshot'); expect(task).not.toHaveProperty('task');
    const instruction = payload.input[0].content;
    expect(instruction).toContain('<option ID> — <exact option text>');
    expect(instruction).toContain('comma-separated selected IDs');
    expect(instruction).toContain('Q<number>: <primary answer>');
    expect(payload.text).toEqual({ format: { type: 'json_schema', name: 'sc_response', schema: expectedSchema(targetId) } });
    expect(payload).not.toHaveProperty('strict'); expect(payload).not.toHaveProperty('response_format');
    expect(payload).not.toHaveProperty('previous_response_id'); expect(payload).not.toHaveProperty('conversation');
    expect(payload.reasoning).toEqual({ effort: 'high' }); expect(payload.max_output_tokens).toBe(16000);
    expect(images(payload)).toEqual([`data:image/jpeg;base64,${input.jpeg.toString('base64')}`]);
  });

  it.each([
    ['multiple selections', 'B, D'],
    ['multiple visible questions', 'Q3: A — First option\nQ9: D — Fourth option']
  ])('keeps %s together in primary answer text', async (_, primary) => {
    const run = directRun(payload => canonical(payload, primary, { explanation: 'Supporting details.' }));
    expect((await run.promise).text).toBe(primary + '\nSupporting details.'); expectSingleSend(run);
  });

  it.each([0, .5, 1, null])('accepts confidence %s without altering the primary answer', async confidence => {
    const run = directRun(payload => canonical(payload, 'A textual answer.', { confidence }));
    expect((await run.promise).text).toBe('A textual answer.'); expectSingleSend(run);
  });
});

describe('Direct rejects malformed or inapplicable fields locally', () => {
  const invalid: [string, (payload: Payload) => unknown, string][] = [
    ['missing status', payload => canonical(payload, 'A', { status: undefined }), 'MalformedResponse'],
    ['array status', payload => canonical(payload, 'A', { status: ['answer'] }), 'MalformedResponse'],
    ['unknown status', payload => canonical(payload, 'A', { status: 'solved' }), 'MalformedResponse'],
    ['wrong ID', payload => canonical(payload, 'A', { question_id: 'previous-task' }), 'TaskMismatch'],
    ['missing ID', payload => canonical(payload, 'A', { question_id: undefined }), 'MalformedResponse'],
    ['no result', () => ({ results: [] }), 'TaskMismatch'],
    ['duplicate target', payload => ({ results: [...canonical(payload, 'A').results, ...canonical(payload, 'B').results] }), 'TaskMismatch'],
    ['selection array', payload => canonical(payload, '', { answer: null, answers: ['B', 'D'] }), 'InvalidChoice'],
    ['non-null option text', payload => canonical(payload, 'A', { answer_text: 'Option text' }), 'InvalidChoice'],
    ['empty option text', payload => canonical(payload, 'A', { answer_text: '' }), 'InvalidChoice'],
    ['whitespace option text', payload => canonical(payload, 'A', { answer_text: ' ' }), 'InvalidChoice'],
    ['null primary with correct explanation', payload => canonical(payload, '', { answer: null, explanation: 'The synthetic primary answer should be A.' }), 'IncompleteAnswer'],
    ['blank primary with correct explanation', payload => canonical(payload, ' ', { explanation: 'The synthetic primary answer should be A.' }), 'IncompleteAnswer'],
    ['negative confidence', payload => canonical(payload, 'A', { confidence: -.1 }), 'MalformedResponse'],
    ['confidence above one', payload => canonical(payload, 'A', { confidence: 1.1 }), 'MalformedResponse'],
    ['string confidence', payload => canonical(payload, 'A', { confidence: '1' }), 'MalformedResponse']
  ];
  it.each(invalid)('rejects %s with one send and no repair, fallback or QA retry', async (_, respond, pipelineCode) => {
    const run = directRun(respond);
    await expect(run.promise).rejects.toMatchObject({ stage: 'ValidateAnswer', pipelineCode }); expectSingleSend(run);
  });

  it('rejects an answer status for TransformContent without retrying', async () => {
    const run = directRun(payload => canonical(payload, 'Untransformed source.'), 'Translate to English');
    await expect(run.promise).rejects.toMatchObject({ stage: 'ValidateAnswer', pipelineCode: 'InvalidChoice' }); expectSingleSend(run);
  });

  it('rejects a canonical response replayed from another Direct request', async () => {
    let previous: unknown;
    const first = directRun(payload => previous = canonical(payload, 'A')); await first.promise; expectSingleSend(first);
    const second = directRun(() => previous);
    await expect(second.promise).rejects.toMatchObject({ stage: 'ValidateAnswer', pipelineCode: 'TaskMismatch' }); expectSingleSend(second);
    expect(context(first.transport.payloads[0]!).answer_targets).not.toEqual(context(second.transport.payloads[0]!).answer_targets);
  });
});

describe('Direct transformations and explicit refusal remain visible without retry', () => {
  it.each(['Translate to English', 'Summarize', 'Custom'] as const)('preserves %s with quoted refusal words', async mode => {
    const run = directRun(payload => canonical(payload, refusal, { status: 'transformation' }), mode);
    expect((await run.promise).text).toBe(refusal); expectSingleSend(run);
  });
  it.each([false, true])('allows explicit refusal explanation=%s as the sole refusal exception to primary output', async explanationOnly => {
    const run = directRun(payload => canonical(payload, explanationOnly ? '' : refusal,
      { status: 'refusal', explanation: explanationOnly ? refusal : '' }));
    expect((await run.promise).text).toBe(refusal); expectSingleSend(run);
  });
});
