import type { HttpTransport, ImageCropper, PipelineRunner } from '../contracts';
import { answerTask } from './answer';
import { validateConfiguration } from './configuration';
import { extractQuestions, disposeExtracted } from './extraction';
import { responseInstruction, responseOperation } from './response-modes';
import { PipelineTrace } from './trace';

export { loadPipelineConfiguration, withSavedSettings } from './configuration';
export { PipelineFailure, PipelineValidationError } from './trace';

export function createPipelineRunner({ transport, cropper }: { transport: HttpTransport; cropper: ImageCropper }): PipelineRunner {
  return { async run(input) {
    validateConfiguration(input.configuration);
    const config = { ...input.configuration, questionRegion: input.configuration.questionRegion ? { ...input.configuration.questionRegion } : null };
    const typed = input.typedQuestion?.trim() ? input.typedQuestion : undefined;
    const preferences = responseInstruction(input.responseMode, input.customInstruction, Boolean(typed));
    const operation = responseOperation(input.responseMode);
    const trace = new PipelineTrace(input.onEvent);
    if (config.mode === 'Direct') return { text: await answerTask(transport, null, input.jpeg, config, input.apiKey, typed, preferences, operation, trace, input.signal), requestId: trace.requestId };
    const extracted = await extractQuestions(transport, cropper, input.jpeg, config, input.apiKey, typed, preferences, trace, input.signal);
    try { return { text: await answerTask(transport, extracted, null, config, input.apiKey, typed, preferences, operation, trace, input.signal), requestId: trace.requestId }; }
    finally { disposeExtracted(extracted); }
  } };
}
