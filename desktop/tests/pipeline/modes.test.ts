import { describe, expect, it } from 'vitest';
import { PROVIDERS, RESPONSE_MODES, type ApiProvider, type PipelineMode } from '../../src/contracts';
import { createPipelineRunner } from '../../src/pipeline';
import { canonical, combined, configuration, context, detection, envelope, expectFirstLine, expectPrimary, extraction,
  images, noContext, pipelineInput, StrictTransport, TrackingCropper, type FixtureCase, type Payload } from './fixtures';

describe('Thorough/Balanced provider and task parity', () => {
  const cases = PROVIDERS.flatMap(provider => (['Thorough', 'Balanced'] as const).flatMap(mode =>
    [false, true].flatMap(typed => (['multiple', 'multi', 'short', 'code', 'image', 'content'] as FixtureCase[]).map(kind => ({ provider, mode, typed, kind })))));
  it.each(cases)('$provider $mode typed=$typed $kind', async ({ provider, mode, typed, kind }) => {
    const config = configuration({ provider, mode, answerModel: 'answer-fixture', visionModel: 'vision-fixture' });
    const cropper = new TrackingCropper();
    let structured: Payload | undefined;
    const answer = (payload: Payload) => {
      const value = ({ multiple: 'B', short: '42', code: '10', image: '24', content: 'Transformed source', multi: 'A, C' })[kind];
      structured = canonical(payload, kind === 'multi' && !typed ? '' : value,
        kind === 'multi' && !typed ? { answer: null, answers: ['A', 'C'] } : {});
      return envelope(provider, structured);
    };
    const first = mode === 'Thorough' ? [() => envelope(provider, detection()), () => envelope(provider, extraction(kind))] : [() => envelope(provider, combined(kind))];
    const transport = new StrictTransport([...first, answer], provider);
    const input = pipelineInput({ configuration: config, typedQuestion: typed ? 'Use the relevant task context to complete my request.' : undefined });
    const result = await createPipelineRunner({ transport, cropper }).run(input);
    transport.done(); transport.cleared(); cropper.cleared();
    expect(result.requestId).toMatch(/^[a-f0-9]{32}$/);
    expectPrimary(kind === 'multi' && !typed ? structured!.results[0].answers : kind === 'multi' ? structured!.results[0].answer.split(', ') : structured!.results[0].answer, kind);
    expectFirstLine(result.text, kind === 'multiple' && !typed ? 'B — ls' : ({ multiple: 'B', multi: 'A, C', short: '42', code: '10', image: '24', content: 'Transformed source' })[kind]);
    expect(images(transport.payloads[0]!)).toEqual([`data:image/jpeg;base64,${input.jpeg.toString('base64')}`]);
    expect(transport.payloads.slice(0, -1).every(payload => payload.model === 'vision-fixture')).toBe(true);
    const final = transport.payloads.at(-1)!;
    expect(final.model).toBe('answer-fixture');
    expect(context(final).answer_targets).toHaveLength(1);
    expect(context(final).answer_targets[0].question_id).toMatch(/^task_[a-f0-9]{32}_1$/);
    expect(context(final).environment).toEqual({ mode: 'standard' });
    expect(context(final).typed_question).toBe(input.typedQuestion);
    expect(images(final)).toHaveLength(kind === 'image' ? 1 : 0);
    expect(JSON.stringify(final)).not.toContain(input.jpeg.toString('base64'));
    expect(JSON.stringify(final)).not.toContain('previous_response_id');
    expect(JSON.stringify(final)).not.toContain('conversation');
    if (kind === 'code') expect(context(final).task.questions[0].code).toBe('\n  values = [2, 3, 5]\n  print(sum(values))\n');
    if (mode === 'Thorough') {
      expect(images(transport.payloads[1]!)).toEqual([`data:image/jpeg;base64,${Buffer.from('isolated-image-1').toString('base64')}`]);
      expect(cropper.regions[0]).toEqual({ x: .2, y: .2, width: .6, height: .6 });
    }
    expect(input.jpeg.toString()).toBe('ORIGINAL-MONITOR-SENTINEL ASSESSMENT_MODE=qa');
  });
  it.each(['Thorough', 'Balanced'] as const)('%s fixed crop skips locate and is zeroed', async mode => {
    const cropper = new TrackingCropper();
    const transport = new StrictTransport([() => envelope('OpenAI', mode === 'Thorough' ? extraction('image') : combined('image')), payload => envelope('OpenAI', canonical(payload, '24'))]);
    await createPipelineRunner({ transport, cropper }).run(pipelineInput({ configuration: configuration({ mode, questionRegion: { x: .1, y: .2, width: .7, height: .6 } }) }));
    transport.done(); transport.cleared(); cropper.cleared();
    expect(images(transport.payloads[0]!)).toEqual([`data:image/jpeg;base64,${Buffer.from('isolated-image-1').toString('base64')}`]);
    expect(cropper.regions).toHaveLength(2);
  });
  it.each(['Thorough', 'Balanced'] as const)('%s disabled cropping ignores fixed region and excludes monitor from answering', async mode => {
    const cropper = new TrackingCropper();
    const transport = new StrictTransport([() => envelope('OpenAI', mode === 'Thorough' ? extraction('image') : combined('image')), payload => envelope('OpenAI', canonical(payload, '24'))]);
    const input = pipelineInput({ configuration: configuration({ mode, enableQuestionCropping: false, questionRegion: { x: 0, y: 0, width: 1, height: 1 } }) });
    const result = await createPipelineRunner({ transport, cropper }).run(input);
    transport.done(); transport.cleared(); cropper.cleared(); expectFirstLine(result.text, '24');
    expect(images(transport.payloads[0]!)).toEqual([`data:image/jpeg;base64,${input.jpeg.toString('base64')}`]);
    expect(cropper.regions).toHaveLength(1);
    if (mode === 'Thorough') expect(cropper.regions[0]).toEqual({ x: .3, y: .3, width: .3, height: .2 });
    expect(JSON.stringify(transport.payloads[1])).not.toContain(input.jpeg.toString('base64'));
  });
  it.each(['Thorough', 'Balanced'] as const)('%s typed no relevant content answers typed task only in two calls', async mode => {
    const cropper = new TrackingCropper();
    const transport = new StrictTransport([() => envelope('OpenAI', mode === 'Thorough' ? { found: false, region: null } : noContext()), payload => {
      expect(context(payload).task.questions).toEqual([]); expect(images(payload)).toEqual([]);
      expect(context(payload).typed_question).toBe('What is 6 times 7?'); return envelope('OpenAI', canonical(payload, '42'));
    }]);
    expectFirstLine((await createPipelineRunner({ transport, cropper }).run(pipelineInput({ typedQuestion: 'What is 6 times 7?', configuration: configuration({ mode }) }))).text, '42');
    transport.done(); expect(cropper.regions).toEqual([]);
  });
  it.each([false, true])('Thorough typed empty extraction is allowed after configured/disabled crop (disabled=%s)', async disabled => {
    const cropper = new TrackingCropper();
    const transport = new StrictTransport([() => envelope('OpenAI', { questions: [], images: [] }), payload => envelope('OpenAI', canonical(payload, '42'))]);
    await createPipelineRunner({ transport, cropper }).run(pipelineInput({ typedQuestion: 'Compute 6*7', configuration: configuration({ enableQuestionCropping: !disabled, questionRegion: { x: .1, y: .1, width: .8, height: .8 } }) }));
    transport.done(); transport.cleared(); cropper.cleared();
  });
});

describe('Direct screenshot', () => {
  const cases = [false, true].flatMap(typed => RESPONSE_MODES.flatMap(mode => ['standard', 'qa'].map(assessmentMode => ({ typed, mode, assessmentMode: assessmentMode as 'standard' | 'qa' }))));
  it.each(cases)('one original-image call typed=$typed mode=$mode assessment=$assessmentMode', async ({ typed, mode, assessmentMode }) => {
    const cropper = new TrackingCropper();
    const events: Payload[] = [];
    const transport = new StrictTransport([payload => {
      expect(context(payload).request_source).toBe('direct_screenshot');
      expect(context(payload).requested_operation).toBe(mode === 'Translate to English' || mode === 'Summarize' ? 'TransformContent' : mode === 'Custom' ? 'Custom' : 'AnswerQuestions');
      expect(context(payload).environment).toEqual(assessmentMode === 'qa' ? { mode: 'authorized_university_qa', graded: false, ai_assistance_authorized: true } : { mode: 'standard' });
      expect(context(payload).answer_targets).toHaveLength(1);
      return envelope('DeepSeek', canonical(payload, '42', { status: ['Translate to English', 'Summarize'].includes(mode) ? 'transformation' : 'answer' }));
    }], 'DeepSeek');
    const input = pipelineInput({ configuration: configuration({ provider: 'DeepSeek', mode: 'Direct', answerModel: 'deepseek-flash', assessmentMode,
      visionModel: 'unused-vision', questionRegion: { x: .2, y: .2, width: .3, height: .3 } }), typedQuestion: typed ? 'Compute 6*7' : undefined,
      responseMode: mode, customInstruction: mode === 'Custom' ? 'Output a complete answer.' : '', onEvent: event => events.push(event) });
    const result = await createPipelineRunner({ transport, cropper }).run(input);
    expectFirstLine(result.text, '42'); transport.done(); transport.cleared();
    expect(cropper.regions).toEqual([]);
    expect(images(transport.payloads[0]!)).toEqual([`data:image/jpeg;base64,${input.jpeg.toString('base64')}`]);
    expect(events.every(event => ['Answer', 'ValidateAnswer'].includes(event.stage))).toBe(true);
  });
  it.each(PROVIDERS.filter(provider => provider !== 'DeepSeek'))('rejects %s Direct before transport', async provider => {
    const transport = new StrictTransport([]), cropper = new TrackingCropper();
    await expect(createPipelineRunner({ transport, cropper }).run(pipelineInput({ configuration: configuration({ provider, mode: 'Direct' }) }))).rejects.toThrow('only with DeepSeek');
    transport.done();
  });
  it.each(['None', 'Low', 'High', 'Max'] as const)('sends exact Flash reasoning %s and selected budget', async thinking => {
    const transport = new StrictTransport([payload => {
      expect(payload.reasoning).toEqual({ effort: thinking.toLowerCase() }); expect(payload.max_output_tokens).toBe(16000);
      return envelope('DeepSeek', canonical(payload, '42'));
    }], 'DeepSeek');
    await createPipelineRunner({ transport, cropper: new TrackingCropper() }).run(pipelineInput({ configuration: configuration({ provider: 'DeepSeek', answerModel: 'deepseek-flash', mode: 'Direct', thinking, answerMaxOutputTokens: 16000 }) }));
    transport.done();
  });
});

describe('answer-only DeepSeek model options', () => {
  it.each(['Thorough', 'Balanced'] as PipelineMode[])('%s reads with Flash non-thinking and answers with text-only Pro', async mode => {
    const provider: ApiProvider = 'DeepSeek';
    const first = mode === 'Thorough' ? [detection(), extraction('short')] : [combined('short')];
    const transport = new StrictTransport([...first.map(value => (payload: Payload) => {
      expect(payload.model).toBe('deepseek-flash'); expect(payload.reasoning.effort).toBe('none'); expect(payload.max_output_tokens).toBe(6000); return envelope(provider, value);
    }), payload => {
      expect(payload.model).toBe('deepseek-v4-pro'); expect(payload.reasoning.effort).toBe('high'); expect(payload.max_output_tokens).toBe(16000); expect(images(payload)).toEqual([]);
      return envelope(provider, canonical(payload, '42'));
    }], provider);
    expectFirstLine((await createPipelineRunner({ transport, cropper: new TrackingCropper() }).run(pipelineInput({ configuration: configuration({ provider, mode,
      answerModel: 'deepseek-v4-pro', visionModel: 'deepseek-flash', thinking: 'High', answerMaxOutputTokens: 16000 }) }))).text, '42');
    transport.done();
  });
  it('preserves task visuals and fails before sending Pro an image', async () => {
    const cropper = new TrackingCropper();
    const transport = new StrictTransport([() => envelope('DeepSeek', combined('image'))], 'DeepSeek');
    await expect(createPipelineRunner({ transport, cropper }).run(pipelineInput({ configuration: configuration({ provider: 'DeepSeek', mode: 'Balanced', answerModel: 'deepseek-v4-pro', visionModel: 'deepseek-flash' }) })))
      .rejects.toMatchObject({ stage: 'Answer', pipelineCode: 'UnsupportedModel' });
    transport.done(); transport.cleared(); cropper.cleared();
  });
});
