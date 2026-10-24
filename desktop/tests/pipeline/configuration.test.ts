import { describe, expect, it } from 'vitest';
import { loadPipelineConfiguration, withSavedSettings } from '../../src/pipeline';
import { defaultModels } from '../../src/contracts/defaults';
import { PROVIDERS, type PipelineConfiguration } from '../../src/contracts';
import { responseInstruction, responseOperation } from '../../src/pipeline/response-modes';
import { validateRegion } from '../../src/pipeline/regions';

describe('trusted configuration and saved compatibility', () => {
  it('retains existing defaults and old settings', () => {
    const config = loadPipelineConfiguration({});
    expect(config).toMatchObject({ provider: 'OpenAI', mode: 'Thorough', assessmentMode: 'standard', answerModel: 'gpt-6-luna', visionModel: 'gpt-6-luna',
      imageRegionPadding: .08, enableQuestionCropping: true, enableRefusalRetry: true, extractionMaxOutputTokens: 6000, answerMaxOutputTokens: 2500, thinking: 'None' });
    expect(withSavedSettings(config, { Models: null, PipelineMode: null })).toEqual(config);
  });
  it.each(PROVIDERS)('loads %s model defaults without network calls', provider => {
    expect(loadPipelineConfiguration({ API_PROVIDER: provider.toLowerCase() })).toMatchObject({ provider, answerModel: defaultModels(provider).AnswerModel });
  });
  it('applies saved models/mode/budgets together and never takes QA state from settings', () => {
    const process = loadPipelineConfiguration({ API_PROVIDER: 'DeepSeek', PIPELINE_MODE: 'direct', ANSWER_MAX_OUTPUT_TOKENS: '4500', ASSESSMENT_MODE: 'standard' });
    const models = { ...defaultModels('DeepSeek'), AnswerModel: 'deepseek-v4-pro', Thinking: 'High' as const, AnswerTokenLimit: 16000 };
    expect(withSavedSettings(process, { Models: models, PipelineMode: 'Balanced' })).toMatchObject({ answerModel: 'deepseek-v4-pro', thinking: 'High', answerMaxOutputTokens: 16000,
      visionModel: 'deepseek-flash', mode: 'Balanced', assessmentMode: 'standard', extractionMaxOutputTokens: 6000 });
    expect(withSavedSettings(process, { Models: { ...models, AnswerTokenLimit: null }, PipelineMode: 'Thorough' }).answerMaxOutputTokens).toBe(4500);
    expect(withSavedSettings(process, { Models: defaultModels('Gemini'), PipelineMode: 'Thorough' }).provider).toBe('Gemini');
  });
  it.each([
    { API_PROVIDER: 'other' }, { PIPELINE_MODE: 'other' }, { PIPELINE_MODE: 'direct' }, { ASSESSMENT_MODE: 'graded' },
    { ENABLE_QUESTION_CROPPING: '1' }, { ENABLE_REFUSAL_RETRY: 'yes' }, { IMAGE_REGION_PADDING: 'NaN' }, { IMAGE_REGION_PADDING: '-.1' }, { IMAGE_REGION_PADDING: '.20001' },
    { EXTRACTION_MAX_OUTPUT_TOKENS: '255' }, { ANSWER_MAX_OUTPUT_TOKENS: '32001' }, { ANSWER_MAX_OUTPUT_TOKENS: '256.0' },
    { QUESTION_REGION: '0,0,1,1' }, { QUESTION_REGION: '0,0,0,.3' }, { QUESTION_REGION: 'NaN,0,.3,.3' }, { QUESTION_REGION: '0,0,.4' },
    { QUESTION_REGION: '0,,.3,.3' }, { QUESTION_REGION: '.8,.8,.3,.3' }, { ANSWER_MODEL: 'https://bad.example' }, { VISION_MODEL: 'bad model' }
  ])('rejects invalid environment %j', env => { expect(() => loadPipelineConfiguration(env)).toThrow(); });
  it('accepts exact configuration boundaries and rejects invalid saved models', () => {
    expect(loadPipelineConfiguration({ QUESTION_REGION: '.1,.2,.5,.6', IMAGE_REGION_PADDING: '.2', ANSWER_MAX_OUTPUT_TOKENS: '32000', EXTRACTION_MAX_OUTPUT_TOKENS: '256' }))
      .toMatchObject({ questionRegion: { x: .1, y: .2, width: .5, height: .6 }, imageRegionPadding: .2 });
    for (const changed of [{ AnswerTokenLimit: 255 }, { AnswerTokenLimit: 32001 }, { AnswerModel: 'bad model' }, { VisionModel: 'https://host' }, { Thinking: 'invalid' }]) {
      expect(() => withSavedSettings(loadPipelineConfiguration({}), { Models: { ...defaultModels('DeepSeek'), ...changed } as ReturnType<typeof defaultModels>, PipelineMode: 'Thorough' })).toThrow();
    }
    expect(() => withSavedSettings(loadPipelineConfiguration({}), { Models: null, PipelineMode: 'Direct' })).toThrow();
  });
  it('allows only bounded normalized regions', () => {
    for (const region of [{ x: NaN, y: 0, width: .2, height: .2 }, { x: -1, y: 0, width: .2, height: .2 }, { x: 1, y: 0, width: .2, height: .2 }, { x: 0, y: 0, width: 1, height: 1 }])
      expect(() => validateRegion(region)).toThrow();
    expect(() => validateRegion({ x: 0, y: 0, width: 1, height: 1 }, true)).not.toThrow();
  });
  it('keeps response operations and typed presentation distinct', () => {
    expect(responseOperation('Translate to English')).toBe('TransformContent'); expect(responseOperation('Summarize')).toBe('TransformContent');
    expect(responseOperation('Custom')).toBe('Custom'); expect(responseOperation('Explain steps')).toBe('AnswerQuestions');
    expect(responseInstruction('Default', '', true)).toBe("Answer the user's question directly. Reply in the user's language.");
    expect(responseInstruction('Custom', 'Preserve source whitespace.', false)).toBe('Preserve source whitespace.');
    expect(() => responseInstruction('Custom', 'x'.repeat(2001), false)).toThrow();
  });
  it('clones process configuration when saved settings are applied', () => {
    const original: PipelineConfiguration = loadPipelineConfiguration({});
    withSavedSettings(original, { Models: defaultModels('DeepSeek'), PipelineMode: 'Direct' });
    expect(original.provider).toBe('OpenAI');
  });
});
