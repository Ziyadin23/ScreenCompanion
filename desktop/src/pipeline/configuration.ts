import type { PipelineConfiguration, VaultData } from '../contracts';
import { PROVIDERS } from '../contracts';
import { defaultModels } from '../contracts/defaults';
import { validModel } from '../providers';
import { validateRegion } from './regions';

export function loadPipelineConfiguration(env: Record<string, string | undefined> = process.env): PipelineConfiguration {
  const value = (name: string, fallback: string): string => env[name]?.trim() || fallback;
  const provider = PROVIDERS.find(item => item.toLowerCase() === value('API_PROVIDER', 'OpenAI').toLowerCase());
  if (!provider) throw new Error('API_PROVIDER must be OpenAI, Groq, Gemini, Mistral, OpenRouter, or DeepSeek.');
  const defaults = defaultModels(provider);
  const assessmentMode = value('ASSESSMENT_MODE', 'standard').toLowerCase();
  if (assessmentMode !== 'qa' && assessmentMode !== 'standard') throw new Error('ASSESSMENT_MODE must be qa or standard.');
  const mode = ({ thorough: 'Thorough', balanced: 'Balanced', direct: 'Direct' } as const)[value('PIPELINE_MODE', 'thorough').toLowerCase() as 'thorough'];
  if (!mode) throw new Error('PIPELINE_MODE must be balanced, thorough, or direct (DeepSeek only).');
  const boolean = (name: string): boolean => {
    const text = value(name, 'true').toLowerCase();
    if (text !== 'true' && text !== 'false') throw new Error(`${name} must be true or false.`);
    return text === 'true';
  };
  const tokens = (name: string, fallback: number): number => {
    const text = value(name, String(fallback)), number = Number(text);
    if (!/^\d+$/.test(text) || !Number.isInteger(number) || number < 256 || number > 32000)
      throw new Error(`${name} must be an integer between 256 and 32000.`);
    return number;
  };
  const imageRegionPadding = Number(value('IMAGE_REGION_PADDING', '0.08'));
  if (!Number.isFinite(imageRegionPadding) || imageRegionPadding < 0 || imageRegionPadding > .2)
    throw new Error('IMAGE_REGION_PADDING must be a finite number between 0 and 0.2.');
  let questionRegion: PipelineConfiguration['questionRegion'] = null;
  if (env.QUESTION_REGION?.trim()) {
    const fields = env.QUESTION_REGION.split(',');
    const numbers = fields.map(field => field.trim() ? Number(field) : NaN);
    if (numbers.length !== 4 || numbers.some(number => !Number.isFinite(number)))
      throw new Error('QUESTION_REGION must contain normalized x,y,width,height coordinates.');
    questionRegion = { x: numbers[0]!, y: numbers[1]!, width: numbers[2]!, height: numbers[3]! };
    validateRegion(questionRegion);
    if (questionRegion.x + questionRegion.width > 1 || questionRegion.y + questionRegion.height > 1)
      throw new Error('QUESTION_REGION must be a valid question-only region inside the capture.');
  }
  const configuration: PipelineConfiguration = {
    provider, answerModel: value('ANSWER_MODEL', defaults.AnswerModel), visionModel: value('VISION_MODEL', defaults.VisionModel), mode,
    assessmentMode, enableQuestionCropping: boolean('ENABLE_QUESTION_CROPPING'), enableRefusalRetry: boolean('ENABLE_REFUSAL_RETRY'),
    imageRegionPadding, questionRegion, extractionMaxOutputTokens: tokens('EXTRACTION_MAX_OUTPUT_TOKENS', 6000),
    answerMaxOutputTokens: tokens('ANSWER_MAX_OUTPUT_TOKENS', 2500), thinking: 'None'
  };
  validateConfiguration(configuration);
  return configuration;
}

export function withSavedSettings(configuration: PipelineConfiguration, settings: Pick<VaultData, 'Models' | 'PipelineMode'>): PipelineConfiguration {
  const models = settings.Models;
  if (models && (!PROVIDERS.includes(models.Provider) || !validModel(models.AnswerModel) || !validModel(models.VisionModel) ||
      !['None', 'Low', 'High', 'Max'].includes(models.Thinking ?? 'None') ||
      (models.AnswerTokenLimit != null && (!Number.isInteger(models.AnswerTokenLimit) || models.AnswerTokenLimit < 256 || models.AnswerTokenLimit > 32000))))
    throw new Error('The saved model selection is invalid.');
  const result = { ...configuration, provider: models?.Provider ?? configuration.provider,
    answerModel: models?.AnswerModel ?? configuration.answerModel, visionModel: models?.VisionModel ?? configuration.visionModel,
    mode: settings.PipelineMode ?? configuration.mode, thinking: models ? models.Thinking ?? 'None' : configuration.thinking,
    answerMaxOutputTokens: models?.AnswerTokenLimit ?? configuration.answerMaxOutputTokens };
  validateConfiguration(result);
  return result;
}

export function validateConfiguration(configuration: PipelineConfiguration): void {
  if (!PROVIDERS.includes(configuration.provider) || !validModel(configuration.answerModel) || !validModel(configuration.visionModel))
    throw new Error('Choose a supported service and valid model IDs in Settings.');
  if (!['Thorough', 'Balanced', 'Direct'].includes(configuration.mode) || (configuration.mode === 'Direct' && configuration.provider !== 'DeepSeek'))
    throw new Error('Choose a supported pipeline. Direct screenshot is available only with DeepSeek.');
  if (!['standard', 'qa'].includes(configuration.assessmentMode) || !['None', 'Low', 'High', 'Max'].includes(configuration.thinking) ||
      typeof configuration.enableQuestionCropping !== 'boolean' || typeof configuration.enableRefusalRetry !== 'boolean')
    throw new Error('The trusted pipeline configuration is invalid.');
  if (!Number.isFinite(configuration.imageRegionPadding) || configuration.imageRegionPadding < 0 || configuration.imageRegionPadding > .2)
    throw new Error('The question image margin must be between 0 and 0.2.');
  for (const limit of [configuration.extractionMaxOutputTokens, configuration.answerMaxOutputTokens])
    if (!Number.isInteger(limit) || limit < 256 || limit > 32000) throw new Error('Output token limits must be integers between 256 and 32000.');
}
