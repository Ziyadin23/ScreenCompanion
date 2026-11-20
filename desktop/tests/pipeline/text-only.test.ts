import { describe, expect, it } from 'vitest';
import { PROVIDERS, RESPONSE_MODES } from '../../src/contracts';
import { createPipelineRunner } from '../../src/pipeline';
import { canonical, configuration, context, envelope, images, pipelineInput, refusal, StrictTransport } from './fixtures';

describe('text-only submissions', () => {
  it.each(PROVIDERS.flatMap(provider => (['Thorough', 'Direct'] as const).flatMap(mode => RESPONSE_MODES.map(responseMode => ({ provider, mode, responseMode })))))('$provider $mode $responseMode answers once without screen processing', async ({ provider, mode, responseMode }) => {
      const transport = new StrictTransport([payload => {
        expect(context(payload)).toMatchObject({ request_source: 'typed_text', typed_question: 'Explain this text.', environment: { mode: 'standard' } });
        expect(context(payload)).not.toHaveProperty('task'); expect(images(payload)).toEqual([]);
        return envelope(provider, canonical(payload, 'A typed answer.', { status: ['Translate to English', 'Summarize'].includes(responseMode) ? 'transformation' : 'answer' }));
      }], provider);
      const cropper = { async crop(): Promise<Buffer> { throw new Error('Text-only must not crop'); } };
      const input = { ...pipelineInput(), jpeg: null, typedQuestion: 'Explain this text.', responseMode,
        customInstruction: responseMode === 'Custom' ? 'Explain the supplied text.' : '', configuration: configuration({ provider, mode }) };
      expect((await createPipelineRunner({ transport, cropper }).run(input)).text).toBe('A typed answer.');
      transport.done(); transport.cleared();
    });
  it.each(['native', 'structured'] as const)('shows a %s refusal without QA retry or capture', async kind => {
    const transport = new StrictTransport([payload => envelope('OpenAI', kind === 'native' ? '' : canonical(payload, refusal, { status: 'refusal' }), kind === 'native' ? refusal : undefined)]);
    const result = await createPipelineRunner({ transport, cropper: { async crop() { throw new Error('No capture'); } } }).run({
      ...pipelineInput(), jpeg: null, typedQuestion: 'A typed task.', configuration: configuration({ assessmentMode: 'qa' }) });
    expect(result.text).toBe(refusal); transport.done(); transport.cleared();
  });
  it('rejects a missing task before any transport or crop', async () => {
    const transport = new StrictTransport([]);
    await expect(createPipelineRunner({ transport, cropper: { async crop() { throw new Error('No capture'); } } })
      .run({ ...pipelineInput(), jpeg: null, typedQuestion: '   ' })).rejects.toThrow('Type a question');
    transport.done();
  });
  it('rejects malformed text-only responses without retry', async () => {
    const transport = new StrictTransport([() => envelope('OpenAI', 'Not structured JSON')]);
    await expect(createPipelineRunner({ transport, cropper: { async crop() { throw new Error('No capture'); } } })
      .run({ ...pipelineInput(), jpeg: null, typedQuestion: 'A typed task.' })).rejects.toMatchObject({ stage: 'ValidateAnswer', pipelineCode: 'MalformedResponse' });
    transport.done(); transport.cleared();
  });
});
