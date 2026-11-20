import type { ApiProvider, ModelField, ModelSelection } from './index';

export function applyModelEdits(saved: ModelSelection | null, draft: ModelSelection, fields: readonly ModelField[], original: ModelSelection | null): ModelSelection {
  if (!fields.length) return saved ?? draft;
  if (!saved || saved.Provider !== draft.Provider) return draft;
  const merged = { ...saved, ...Object.fromEntries(fields.map(field => [field, draft[field]])) };
  // Keep the reasoning suggestion only if an earlier save did not supply a different budget.
  if (fields.includes('Thinking') && !fields.includes('AnswerTokenLimit') &&
      original?.Provider === saved.Provider && original.AnswerTokenLimit === saved.AnswerTokenLimit)
    merged.AnswerTokenLimit = draft.AnswerTokenLimit;
  return merged;
}

export function screenModelError(provider: ApiProvider, model: string): string | undefined {
  if (provider === 'DeepSeek' && model.trim().toLowerCase() === 'deepseek-v4-pro')
    return 'DeepSeek Pro supports text answering only. Use deepseek-flash for Direct screenshot and screen reading.';
}
