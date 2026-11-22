import type { AppearanceSettings, SettingsDraft, VaultData } from './index';

type Preferences = Pick<VaultData, 'ResponseMode' | 'CustomInstruction' | 'Appearance'>;

export function applyPreferenceEdits(saved: Preferences, draft: SettingsDraft, original: Preferences = draft.values): Preferences {
  const { values, responseEdits, appearanceEdits } = draft;
  const edited = (field: 'ResponseMode' | 'CustomInstruction') => responseEdits?.includes(field) ?? values[field] !== original[field];
  const appearanceFields = appearanceEdits ?? (Object.keys(values.Appearance) as (keyof AppearanceSettings)[])
    .filter(field => values.Appearance[field] !== original.Appearance[field]);
  return {
    ResponseMode: edited('ResponseMode') ? values.ResponseMode : saved.ResponseMode,
    CustomInstruction: edited('CustomInstruction') ? values.CustomInstruction : saved.CustomInstruction,
    Appearance: { ...saved.Appearance, ...Object.fromEntries(appearanceFields.map(field => [field, values.Appearance[field]])) }
  };
}

export function customInstructionError({ ResponseMode, CustomInstruction }: Pick<Preferences, 'ResponseMode' | 'CustomInstruction'>): string | undefined {
  if (ResponseMode === 'Custom' && !CustomInstruction.trim()) return 'Enter a custom instruction or choose another answer mode.';
  if (CustomInstruction.length > 2000) return 'Custom instructions must be 2,000 characters or fewer.';
}
