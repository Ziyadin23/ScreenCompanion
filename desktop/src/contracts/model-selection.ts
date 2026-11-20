import type { ModelField, ModelSelection } from './index';

export function applyModelEdits(saved: ModelSelection | null, draft: ModelSelection, fields: readonly ModelField[]): ModelSelection {
  if (!saved || saved.Provider !== draft.Provider) return draft;
  return { ...saved, ...Object.fromEntries(fields.map(field => [field, draft[field]])) };
}
