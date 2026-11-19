import { describe, expect, it } from 'vitest';
import type { PipelineEvent } from '../../src/contracts';
import { createPipelineRunner, loadPipelineConfiguration } from '../../src/pipeline';
import { canonical, detection, envelope, extraction, images, pipelineInput, refusal, StrictTransport, TrackingCropper, type FakeStep } from './fixtures';

const malformedStatuses = [
  { shape: 'null', status: null },
  { shape: 'numeric', status: 123 },
  { shape: 'array', status: ['SYNTHETIC-STATUS-CONTENT'] },
  { shape: 'object', status: { detail: 'SYNTHETIC-STATUS-CONTENT' } }
];
const modes = ['Direct', 'Thorough'] as const;

describe.each(['OpenAI', 'DeepSeek'] as const)('%s Responses completion status', provider => {
  it.each(modes.flatMap(mode => malformedStatuses.map(test => ({ ...test, mode }))))('$mode rejects malformed $shape status before accepting output or retrying',
    async ({ mode, status }) => {
      const direct = mode === 'Direct';
      const steps: FakeStep[] = direct ? [] : [() => envelope(provider, detection()), () => envelope(provider, extraction('image'))];
      const transport = new StrictTransport([...steps, payload => {
        const response = direct ? envelope(provider, canonical(payload, 'SYNTHETIC-ANSWER-CONTENT')) : envelope(provider, '', refusal);
        return { ...response, status };
      }], provider);
      const events: PipelineEvent[] = [];
      const cropper = new TrackingCropper();
      const input = pipelineInput({
        configuration: loadPipelineConfiguration({ API_PROVIDER: provider, PIPELINE_MODE: mode.toLowerCase(), ASSESSMENT_MODE: 'qa', ENABLE_REFUSAL_RETRY: 'true' }),
        onEvent: event => events.push(event)
      });
      const callerImage = Buffer.from(input.jpeg);

      await expect(createPipelineRunner({ transport, cropper }).run(input)).rejects.toMatchObject({
        stage: 'Answer', attempt: 1, pipelineCode: 'MalformedResponse', code: 'PIPELINE-ANSWER-MALFORMEDRESPONSE', httpStatus: null,
        message: 'The service returned an unreadable response. Try again.'
      });
      expect(events.at(-1)).toMatchObject({ kind: 'pipeline', stage: 'Answer', attempt: 1, outcome: 'Failed', code: 'MalformedResponse' });
      const usageEvents = events.filter(event => event.kind === 'pipeline_usage');
      expect(usageEvents).toHaveLength(direct ? 1 : 3);
      expect(usageEvents.at(-1)).toMatchObject({ stage: 'Answer', provider, attempt: 1, responseReceived: false, usage: null });
      const encodedImages = transport.payloads.flatMap(images).map(image => image.replace('data:image/jpeg;base64,', ''));
      expect(encodedImages).toHaveLength(direct ? 1 : 3);
      const diagnostics = JSON.stringify(events);
      for (const content of ['SYNTHETIC-STATUS-CONTENT', 'SYNTHETIC-ANSWER-CONTENT', refusal, input.apiKey, 'ORIGINAL-MONITOR-SENTINEL', ...encodedImages]) {
        expect(diagnostics).not.toContain(content);
      }
      transport.done();
      transport.cleared();
      expect(cropper.buffers).toHaveLength(direct ? 0 : 2);
      cropper.cleared();
      expect(input.jpeg).toEqual(callerImage);
    });

  it('accepts omitted status through Thorough location, extraction and answering', async () => {
    const transport = new StrictTransport([
      () => ({ output: envelope(provider, detection()).output }),
      () => ({ output: envelope(provider, extraction()).output }),
      payload => ({ output: envelope(provider, canonical(payload)).output })
    ], provider);
    const cropper = new TrackingCropper();
    const input = pipelineInput({ configuration: loadPipelineConfiguration({ API_PROVIDER: provider }) });
    const answer = await createPipelineRunner({ transport, cropper }).run(input);
    expect(answer.text).toBe('42');
    transport.done();
    transport.cleared();
    cropper.cleared();
  });

  it('keeps Direct compatibility with an empty string status', async () => {
    const transport = new StrictTransport([payload => ({ ...envelope(provider, canonical(payload)), status: '' })], provider);
    const input = pipelineInput({ configuration: loadPipelineConfiguration({ API_PROVIDER: provider, PIPELINE_MODE: 'direct' }) });
    const answer = await createPipelineRunner({ transport, cropper: new TrackingCropper() }).run(input);
    expect(answer.text).toBe('42');
    transport.done();
    transport.cleared();
  });
});
