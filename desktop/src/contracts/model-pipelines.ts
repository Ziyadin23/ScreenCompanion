import { PROVIDERS, type ModelPipelinePreference, type ModelSelection, type PipelineMode } from './index';

type ModelIdentity = Pick<ModelSelection, 'Provider' | 'AnswerModel'>;
export const MAX_MODEL_PIPELINES = 128;

export function modelPipeline(preferences: readonly ModelPipelinePreference[], model: ModelIdentity): PipelineMode | undefined {
  return preferences.find(item => item.Provider === model.Provider && item.AnswerModel === model.AnswerModel.trim())?.PipelineMode;
}

export function rememberModelPipeline(preferences: readonly ModelPipelinePreference[], model: ModelIdentity, mode: PipelineMode): ModelPipelinePreference[] {
  const entry = { Provider: model.Provider, AnswerModel: model.AnswerModel.trim(), PipelineMode: mode };
  return [...preferences.filter(item => item.Provider !== entry.Provider || item.AnswerModel !== entry.AnswerModel), entry];
}

export function validModelPipelines(value: unknown): value is ModelPipelinePreference[] {
  if (!Array.isArray(value) || value.length > MAX_MODEL_PIPELINES) return false;
  const seen = new Set<string>();
  return value.every((item: unknown) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
    const record = item as Record<string, unknown>;
    if (!PROVIDERS.some(provider => provider === record.Provider) || typeof record.AnswerModel !== 'string' ||
        !/^[\w./:-]{1,160}$/.test(record.AnswerModel) || record.AnswerModel.includes('://') ||
        !['Thorough', 'Direct'].includes(record.PipelineMode as string)) return false;
    const identity = JSON.stringify([record.Provider, record.AnswerModel]);
    if (seen.has(identity)) return false;
    seen.add(identity); return true;
  });
}
