import { describe, expect, it } from 'vitest';
import { createPipelineRunner } from '../../src/pipeline';
import { canonical, combined, configuration, context, detection, envelope, extraction, images, pipelineInput,
  StrictTransport, TrackingCropper, type Payload } from './fixtures';

type ExtractionMode = 'Thorough' | 'Balanced';
type Choice = 'multiple' | 'multi';
type Attachment = 'image' | 'code' | 'image+code';
const code = 'values = [12, 24, 36, 48]\nfor value in values:\n    print(value)\n';

function mixedChoice(choice: Choice, attachment: Attachment) {
  const fixture = combined(choice), question = fixture.questions[0]!;
  const target = attachment === 'image' ? "the rectangle's area" : attachment === 'code' ? 'values[1] in the code' : "the rectangle's area and values[1] in the code";
  question.question = choice === 'multiple' ? `Choose the supplied value equal to ${target}.` : `Select all supplied values greater than or equal to ${target}.`;
  question.options = ['12', '24', '36', '48'].map((text, i) => ({ id: String.fromCharCode(65 + i), text }));
  question.code = attachment.includes('code') ? code : null;
  question.image_ids = attachment.includes('image') ? ['rectangle'] : [];
  question.additional_context = attachment.includes('image') ? 'The rectangle labels are 6 cm and 4 cm.' : null;
  fixture.images = attachment.includes('image') ? extraction('image').images : [];
  fixture.evidence.questions[0]!.requires_code = attachment.includes('code');
  fixture.evidence.questions[0]!.requires_visual = attachment.includes('image');
  return fixture;
}

function startRun(mode: ExtractionMode, fixture: ReturnType<typeof mixedChoice>, respond: (payload: Payload) => unknown) {
  const cropper = new TrackingCropper();
  const transport = new StrictTransport([
    ...(mode === 'Thorough' ? [() => envelope('OpenAI', detection())] : []),
    () => envelope('OpenAI', mode === 'Balanced' ? fixture : { questions: fixture.questions, images: fixture.images }),
    payload => envelope('OpenAI', respond(payload))
  ]);
  const input = pipelineInput({ configuration: configuration({ mode }) });
  return { cropper, transport, input, promise: createPipelineRunner({ transport, cropper }).run(input) };
}

// Mocked responses exercise production extraction, crops and answer validation, not model classification.
describe('mixed-feature extraction and choice contracts', () => {
  const cases = (['Thorough', 'Balanced'] as const).flatMap(mode => (['multiple', 'multi'] as const).flatMap(choice =>
    (['image', 'code', 'image+code'] as const).map(attachment => ({ mode, choice, attachment }))));

  it.each(['Thorough', 'Balanced'] as const)('%s sends explicit type precedence in the production extraction instruction', async mode => {
    const run = startRun(mode, mixedChoice('multiple', 'image+code'), payload => canonical(payload, 'B'));
    expect((await run.promise).text).toBe('B — 24');
    run.transport.done(); run.transport.cleared(); run.cropper.cleared();
    const instruction: string = run.transport.payloads[mode === 'Thorough' ? 1 : 0]!.input[0].content;
    expect(instruction).toContain('Use content for source material requested for translation, summarization, or another content transformation, or for non-question source material.');
    expect(instruction).toContain('Otherwise, for questions and solving tasks, choose one type by this precedence:');
    expect(instruction).toContain('multiple_selection when multiple options may be selected; otherwise multiple_choice when one option must be selected.');
    expect(instruction).toContain('These choice types take priority even when code or required visuals are attached.');
    expect(instruction).toContain('For a non-choice task, use code when an actual task-relevant code snippet is present; otherwise use image when a task-relevant visual must be preserved, even for a numeric answer or when its labels or description are transcribed; otherwise use short_answer.');
    expect(instruction).toContain('Question punctuation is not required for a question or solving task.');
    expect(instruction).toContain('Regardless of type, retain all relevant options, code, and image references/crops.');
    expect(instruction).not.toContain('or a task without question punctuation');
    expect(instruction).not.toContain('image only when a visual must be preserved');
  });

  it.each(cases)('$mode keeps $choice validation and all $attachment evidence', async ({ mode, choice, attachment }) => {
    const fixture = mixedChoice(choice, attachment), hasVisual = attachment.includes('image');
    const run = startRun(mode, fixture, payload => {
      expect(context(payload).task.questions).toEqual(fixture.questions);
      expect(context(payload).task.images).toEqual(hasVisual ? [{ id: 'rectangle' }] : []);
      const cropNumber = mode === 'Thorough' ? 2 : 1;
      expect(images(payload)).toEqual(hasVisual ? [`data:image/jpeg;base64,${Buffer.from(`isolated-image-${cropNumber}`).toString('base64')}`] : []);
      expect(JSON.stringify(payload)).not.toContain(run.input.jpeg.toString('base64'));
      return choice === 'multiple' ? canonical(payload, 'b') : canonical(payload, '', { answer: null, answers: ['d', 'b', 'c'] });
    });
    expect((await run.promise).text).toBe(choice === 'multiple' ? 'B — 24' : 'B, C, D');
    expect(run.cropper.regions).toHaveLength((mode === 'Thorough' ? 1 : 0) + (hasVisual ? 1 : 0));
    expect(run.input.jpeg.toString()).toBe('ORIGINAL-MONITOR-SENTINEL ASSESSMENT_MODE=qa');
    run.transport.done(); run.transport.cleared(); run.cropper.cleared();
  });

  const invalid: { choice: Choice; name: string; fields: Payload }[] = [
    { choice: 'multiple', name: 'unknown choice', fields: { answer: 'Z' } },
    { choice: 'multiple', name: 'wrong choice text', fields: { answer: 'B', answer_text: '12' } },
    { choice: 'multi', name: 'unknown selection', fields: { answer: null, answers: ['B', 'Z'] } },
    { choice: 'multi', name: 'duplicate selection', fields: { answer: null, answers: ['B', 'b'] } }
  ];
  it.each((['Thorough', 'Balanced'] as const).flatMap(mode => invalid.map(item => ({ mode, ...item }))))(
    '$mode rejects $name with code and a required visual', async ({ mode, choice, fields }) => {
      const run = startRun(mode, mixedChoice(choice, 'image+code'), payload => canonical(payload, '', fields));
      await expect(run.promise).rejects.toMatchObject({ stage: 'ValidateAnswer', pipelineCode: 'InvalidChoice' });
      run.transport.done(); run.transport.cleared(); run.cropper.cleared();
    });

  it.each((['multiple', 'multi'] as const).flatMap(choice => (['code', 'visual', 'option'] as const).map(missing => ({ choice, missing }))))(
    'Balanced rejects missing $missing required by $choice evidence before answering', async ({ choice, missing }) => {
      const fixture = mixedChoice(choice, 'image+code');
      if (missing === 'code') fixture.questions[0]!.code = null;
      if (missing === 'visual') fixture.questions[0]!.image_ids = [];
      if (missing === 'option') fixture.questions[0]!.options.pop();
      const cropper = new TrackingCropper(), transport = new StrictTransport([() => envelope('OpenAI', fixture)]);
      await expect(createPipelineRunner({ transport, cropper }).run(pipelineInput({ configuration: configuration({ mode: 'Balanced' }) })))
        .rejects.toMatchObject({ stage: 'Extract', pipelineCode: 'IncompleteExtraction' });
      transport.done(); transport.cleared(); cropper.cleared();
    });

  it.each(['Thorough', 'Balanced'] as const)('%s retains code and visual crops for a non-choice code task', async mode => {
    const fixture = mixedChoice('multiple', 'image+code');
    fixture.questions[0]!.type = 'code'; fixture.questions[0]!.options = [];
    fixture.questions[0]!.question = "Compute values[1] using the code and verify it against the rectangle's area.";
    fixture.evidence.questions[0]!.required_options = 0;
    const run = startRun(mode, fixture, payload => {
      expect(context(payload).task.questions).toEqual(fixture.questions);
      expect(images(payload)).toHaveLength(1);
      return canonical(payload, '24');
    });
    expect((await run.promise).text).toBe('24');
    run.transport.done(); run.transport.cleared(); run.cropper.cleared();
  });
});
