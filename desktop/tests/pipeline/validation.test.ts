import { describe, expect, it } from 'vitest';
import { createPipelineRunner } from '../../src/pipeline';
import { canonical, combined, configuration, context, detection, envelope, expectFirstLine, extraction, images, noContext, pipelineInput,
  StrictTransport, TrackingCropper, type Payload } from './fixtures';

async function answerRun(respond: (payload: Payload) => unknown, mode: 'Thorough' | 'Balanced' | 'Direct' = 'Balanced', fixture = combined('short')) {
  const provider = mode === 'Direct' ? 'DeepSeek' : 'OpenAI';
  const steps = mode === 'Direct' ? [] : mode === 'Thorough' ? [() => envelope(provider, detection()), () => envelope(provider, extraction('short'))] : [() => envelope(provider, fixture)];
  const transport = new StrictTransport([...steps, payload => envelope(provider, respond(payload))], provider), cropper = new TrackingCropper();
  const input = pipelineInput({ configuration: configuration({ provider, mode }) });
  return { transport, cropper, input, promise: createPipelineRunner({ transport, cropper }).run(input) };
}
describe('canonical production answer envelope', () => {
  const invalid: [string, (payload: Payload) => unknown, string][] = [
    ['invalid JSON', () => '{"results":[', 'MalformedResponse'], ['plain answer', () => 'The answer is 42.', 'MalformedResponse'],
    ['null root', () => 'null', 'MalformedResponse'], ['array root', () => '[]', 'MalformedResponse'],
    ['alternate container', payload => ({ responses: canonical(payload).results }), 'MalformedResponse'],
    ['object results', () => ({ results: {} }), 'MalformedResponse'],
    ['missing status', payload => { const result = canonical(payload); delete result.results[0].status; return result; }, 'MalformedResponse'],
    ['extra root property', payload => ({ ...canonical(payload), extra: true }), 'MalformedResponse'],
    ['extra result property', payload => canonical(payload, '42', { extra: true }), 'MalformedResponse'],
    ['non-string answer', payload => canonical(payload, '42', { answer: 42 }), 'MalformedResponse'],
    ['non-string ID', payload => canonical(payload, '42', { question_id: 1 }), 'MalformedResponse'],
    ['empty ID', payload => canonical(payload, '42', { question_id: '' }), 'MalformedResponse'],
    ['invalid confidence', payload => canonical(payload, '42', { confidence: 2 }), 'MalformedResponse'],
    ['negative confidence', payload => canonical(payload, '42', { confidence: -.01 }), 'MalformedResponse'],
    ['invalid status', payload => canonical(payload, '42', { status: 'solved' }), 'MalformedResponse'],
    ['invalid selected item', payload => canonical(payload, '42', { answers: [''] }), 'MalformedResponse'],
    ['partial list', payload => ({ results: [...canonical(payload).results, {}] }), 'MalformedResponse'],
    ['duplicate JSON field', payload => JSON.stringify(canonical(payload)).replace('"results":', '"results":[],"results":'), 'MalformedResponse'],
    ['wrong ID', payload => canonical(payload, '42', { question_id: 'previous-task' }), 'TaskMismatch'],
    ['missing coverage', () => ({ results: [] }), 'TaskMismatch'],
    ['extra coverage', payload => ({ results: [...canonical(payload).results, ...canonical(payload).results] }), 'TaskMismatch'],
    ['explanation only', payload => canonical(payload, '', { explanation: '42 is mentioned in an explanation without a primary answer.' }), 'IncompleteAnswer'],
    ['empty primary', payload => canonical(payload, ''), 'IncompleteAnswer'],
    ['conflicting text field', payload => canonical(payload, '42', { answer_text: '42' }), 'InvalidChoice'],
    ['selection in text task', payload => canonical(payload, '', { answer: null, answers: ['42'] }), 'InvalidChoice'],
    ['missing information without primary', payload => canonical(payload, '', { explanation: 'More data required.', status: 'missing_information' }), 'IncompleteAnswer'],
    ['preamble with partial refusal JSON', () => 'I cannot answer a live exam. {"results":[', 'MalformedResponse'],
    ['fence trailing garbage', payload => '```json\n' + JSON.stringify(canonical(payload)) + '\n``` trailing', 'MalformedResponse']
  ];
  it.each(invalid.flatMap(value => (['Thorough', 'Balanced', 'Direct'] as const).map(mode => ({ name: value[0], respond: value[1], code: value[2], mode }))))('$mode rejects $name without repair/retry', async ({ mode, respond, code }) => {
      const run = await answerRun(respond, mode);
      await expect(run.promise).rejects.toMatchObject({ stage: 'ValidateAnswer', pipelineCode: code });
      run.transport.done(); run.transport.cleared(); run.cropper.cleared(); expect(run.input.jpeg[0]).not.toBe(0);
    });
  it('accepts a complete fenced canonical envelope and independently grades primary and display', async () => {
    let primary: string | undefined;
    const run = await answerRun(payload => {
      const value = canonical(payload, '42', { explanation: 'Six groups of seven.' }); primary = value.results[0].answer;
      return '```json\n' + JSON.stringify(value) + '\n```';
    });
    const answer = await run.promise;
    expect(primary).toBe('42'); expectFirstLine(answer.text, '42'); expect(answer.text).toBe('42\nSix groups of seven.');
    run.transport.done();
  });
  it.each(['Thorough', 'Balanced', 'Direct'] as const)('%s rejects an incomplete provider completion before validating answer', async mode => {
    const provider = mode === 'Direct' ? 'DeepSeek' : 'OpenAI';
    const first = mode === 'Direct' ? [] : mode === 'Thorough' ? [() => envelope(provider, detection()), () => envelope(provider, extraction())] : [() => envelope(provider, combined())];
    const transport = new StrictTransport([...first, payload => ({ ...envelope(provider, canonical(payload)), status: 'incomplete' })], provider);
    await expect(createPipelineRunner({ transport, cropper: new TrackingCropper() }).run(pipelineInput({ configuration: configuration({ mode, provider }) })))
      .rejects.toMatchObject({ stage: 'Answer', pipelineCode: 'IncompleteResponse' });
    transport.done(); transport.cleared();
  });
});

describe('current task correspondence and choice validation', () => {
  it.each([
    ['unknown option', { answer: 'Z' }], ['wrong option text', { answer: 'B', answer_text: 'cd' }],
    ['conflicting choice fields', { answer: 'B', answers: ['C'] }], ['missing option', { answer: null, explanation: 'B is correct.' }],
    ['source choice transformed during solving', { answer: 'translated', status: 'transformation' }]
  ] as [string, Payload][])('rejects %s', async (_, fields) => {
    const run = await answerRun(payload => canonical(payload, '', fields), 'Balanced', combined('multiple'));
    await expect(run.promise).rejects.toMatchObject({ stage: 'ValidateAnswer', pipelineCode: fields.answer === null ? 'IncompleteAnswer' : 'InvalidChoice' }); run.transport.done();
  });
  it('normalizes choice ID casing and derives option text from the current extraction', async () => {
    const run = await answerRun(payload => canonical(payload, 'b'), 'Balanced', combined('multiple'));
    expectFirstLine((await run.promise).text, 'B — ls'); run.transport.done();
  });
  it.each([
    { answer: null, answers: ['A', 'A', 'C'] }, { answer: null, answers: ['a', 'A'] }, { answer: null, answers: ['Z'] },
    { answer: 'A', answers: ['C'] }, { answer: null, answers: ['A', 'C'], answer_text: '2, 5' }
  ])('rejects invalid multiple-selection fields %j', async fields => {
    const run = await answerRun(payload => canonical(payload, '', fields), 'Balanced', combined('multi'));
    await expect(run.promise).rejects.toMatchObject({ pipelineCode: 'InvalidChoice' }); run.transport.done();
  });
  it('restores option order and task source order using fresh application IDs', async () => {
    const fixture = combined('multi');
    fixture.questions[0]!.question_id = '7'; fixture.questions.push({ ...extraction('short').questions[0]!, question_id: '12' });
    fixture.evidence.questions.push({ index: 2, required_options: 0, requires_code: false, requires_visual: false, transcription_complete: true, visuals_complete: true });
    const run = await answerRun(payload => {
      const value = canonical(payload);
      value.results[0] = { ...value.results[0], answer: null, answers: ['c', 'a'] };
      value.results.reverse(); return value;
    }, 'Balanced', fixture);
    expect((await run.promise).text).toBe('Q7: A, C\n\nQ12: 42'); run.transport.done();
  });
  it('rejects duplicates/missing tasks even when result count matches', async () => {
    const fixture = combined(); fixture.questions.push(extraction('code').questions[0]!);
    fixture.evidence.questions.push({ index: 2, required_options: 0, requires_code: true, requires_visual: false, transcription_complete: true, visuals_complete: true });
    const run = await answerRun(payload => { const result = canonical(payload); result.results[1].question_id = result.results[0].question_id; return result; }, 'Balanced', fixture);
    await expect(run.promise).rejects.toMatchObject({ pipelineCode: 'TaskMismatch' }); run.transport.done();
  });
  it('new requests reject a replayed canonical answer from another request', async () => {
    let previous: unknown;
    const first = await answerRun(payload => previous = canonical(payload)); await first.promise;
    const second = await answerRun(() => previous); await expect(second.promise).rejects.toMatchObject({ pipelineCode: 'TaskMismatch' });
    expect(context(first.transport.payloads[1]!).answer_targets[0].question_id).not.toBe(context(second.transport.payloads[1]!).answer_targets[0].question_id);
  });
});

describe('extraction consistency stops locally', () => {
  const mutations: [string, (value: Payload) => void][] = [
    ['uncertain extraction', value => value.status = 'uncertain'], ['incomplete extraction', value => value.status = 'incomplete'],
    ['missing evidence', value => delete value.evidence], ['wrong region', value => value.question_region.x = -.1],
    ['whole monitor', value => value.question_region = { x: 0, y: 0, width: 1, height: 1 }],
    ['incomplete evidence', value => value.evidence.status = 'uncertain'], ['missing region evidence', value => value.evidence.region_complete = false],
    ['wrong count', value => value.evidence.questions.push({ ...value.evidence.questions[0], index: 2 })],
    ['wrong ordinal', value => value.evidence.questions[0].index = 0], ['mismatched choices', value => value.evidence.questions[0].required_options = 5],
    ['missing code', value => value.evidence.questions[0].requires_code = true], ['missing visual', value => value.evidence.questions[0].requires_visual = true],
    ['missing transcription', value => value.evidence.questions[0].transcription_complete = false], ['missing visual coverage', value => value.evidence.questions[0].visuals_complete = false],
    ['non-boolean requirement', value => value.evidence.questions[0].requires_code = 'false'],
    ['duplicate option', value => value.questions[0].options[1].id = 'A'], ['lost choice', value => value.questions[0].options.pop()],
    ['lost type', value => delete value.questions[0].type], ['missing wording', value => value.questions[0].question = ''],
    ['missing options', value => delete value.questions[0].options], ['missing visual references', value => delete value.questions[0].image_ids]
  ];
  it.each(mutations)('rejects %s in one call without remote verification/repair/fallback', async (_, mutate) => {
    const value: Payload = combined('multiple'); mutate(value);
    const cropper = new TrackingCropper(), transport = new StrictTransport([() => envelope('OpenAI', value)]);
    await expect(createPipelineRunner({ transport, cropper }).run(pipelineInput({ configuration: configuration({ mode: 'Balanced' }) })))
      .rejects.toMatchObject({ stage: 'Extract', pipelineCode: 'IncompleteExtraction' });
    transport.done(); transport.cleared(); cropper.cleared();
  });
  it.each(['Thorough', 'Balanced'] as const)('%s capture-only absent content stops before answering', async mode => {
    const transport = new StrictTransport([() => envelope('OpenAI', mode === 'Thorough' ? { found: false, region: null } : noContext())]);
    await expect(createPipelineRunner({ transport, cropper: new TrackingCropper() }).run(pipelineInput({ configuration: configuration({ mode }) })))
      .rejects.toMatchObject({ pipelineCode: 'IncompleteExtraction' }); transport.done();
  });
  it('permits a whole input region only for a configured local crop', async () => {
    const value = combined(); value.question_region = { x: 0, y: 0, width: 1, height: 1 };
    const transport = new StrictTransport([() => envelope('OpenAI', value), payload => envelope('OpenAI', canonical(payload))]);
    const cropper = new TrackingCropper();
    await createPipelineRunner({ transport, cropper }).run(pipelineInput({ configuration: configuration({ mode: 'Balanced', questionRegion: { x: .1, y: .1, width: .8, height: .8 } }) }));
    transport.done(); cropper.cleared();
  });
  it('pads a visual relative to its question and clips all four edges', async () => {
    const value = combined('image'); value.images[0]!.region = { x: .25, y: .3, width: .3, height: .2 };
    const cropper = new TrackingCropper(), transport = new StrictTransport([() => envelope('OpenAI', value), payload => envelope('OpenAI', canonical(payload, '24'))]);
    await createPipelineRunner({ transport, cropper }).run(pipelineInput({ configuration: configuration({ mode: 'Balanced', imageRegionPadding: .1 }) }));
    expect(cropper.regions[0]!.x).toBeCloseTo(.2); expect(cropper.regions[0]!.y).toBeCloseTo(.24);
    expect(cropper.regions[0]!.width).toBeCloseTo(.41); expect(cropper.regions[0]!.height).toBeCloseTo(.32);
    cropper.cleared(); transport.done();
  });
  it.each(['outside', 'missing', 'duplicate', 'missing-code', 'evidence', 'second-crop'] as const)('rejects %s visual content and zeroes allocated buffers', async kind => {
    const value: Payload = combined('image');
    if (kind === 'outside') value.images[0].region.x = .1;
    if (kind === 'missing') value.images = [];
    if (kind === 'duplicate') value.images.push({ ...value.images[0] });
    if (kind === 'missing-code') { value.questions[0].type = 'code'; value.questions[0].code = null; }
    if (kind === 'evidence') value.evidence.questions[0].visuals_complete = false;
    if (kind === 'second-crop') { value.questions[0].image_ids.push('bad'); value.images.push({ id: 'bad', region: { x: .1, y: .3, width: .2, height: .2 } }); }
    const cropper = new TrackingCropper(), transport = new StrictTransport([() => envelope('OpenAI', value)]);
    await expect(createPipelineRunner({ transport, cropper }).run(pipelineInput({ configuration: configuration({ mode: 'Balanced' }) })))
      .rejects.toMatchObject({ stage: 'Extract', pipelineCode: 'IncompleteExtraction' });
    transport.done(); transport.cleared(); cropper.cleared();
  });
  it('omits unreferenced decorations while retaining every required visual', async () => {
    const value: Payload = combined('image'); value.images.unshift({ id: 'decoration', region: { x: 0, y: 0, width: 1, height: 1 } });
    const cropper = new TrackingCropper(), transport = new StrictTransport([() => envelope('OpenAI', value), payload => {
      expect(images(payload)).toHaveLength(1); expect(context(payload).task.images).toEqual([{ id: 'rectangle' }]); return envelope('OpenAI', canonical(payload, '24'));
    }]);
    await createPipelineRunner({ transport, cropper }).run(pipelineInput({ configuration: configuration({ mode: 'Balanced' }) }));
    transport.done(); expect(cropper.regions).toHaveLength(1); cropper.cleared();
  });
});
