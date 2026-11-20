import type { ApiProvider, ModelField, ModelSelection } from './index';

export function applyModelEdits(saved: ModelSelection | null, draft: ModelSelection, fields: readonly ModelField[]): ModelSelection {
  if (!fields.length) return saved ?? draft;
  const merged = saved?.Provider === draft.Provider
    ? { ...saved, ...Object.fromEntries(fields.map(field => [field, draft[field]])) } : draft;
  if (merged.Provider === 'DeepSeek' && merged.Thinking !== 'None' && merged.AnswerTokenLimit === null &&
      fields.includes('Thinking') && !fields.includes('AnswerTokenLimit'))
    return { ...merged, AnswerTokenLimit: 16000 };
  return merged;
}

export function screenModelError(provider: ApiProvider, model: string): string | undefined {
  if (provider === 'DeepSeek' && model.trim().toLowerCase() === 'deepseek-v4-pro')
    return 'DeepSeek Pro supports text answering only. Use deepseek-flash for Direct screenshot and screen reading.';
}
