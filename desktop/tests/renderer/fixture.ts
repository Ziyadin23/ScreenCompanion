import { vi } from 'vitest';
import type { AppAction, AppState, DesktopApi, SettingsDraft } from '../../src/contracts';
import { defaultModels, defaultSettings } from '../../src/contracts/defaults';
import { SHORTCUT_FIELDS } from '../../src/renderer/shortcuts';

export function fixture(stateOverrides: Partial<AppState> = {}, draftOverrides: Partial<SettingsDraft> = {}) {
  const { ApiKey: _key, ProviderKeys: _keys, ...values } = defaultSettings('');
  values.Models = defaultModels(); values.PipelineMode = 'Thorough'; values.CommandsShown = true;
  let draft: SettingsDraft = {
    values, keyPresence: { OpenAI: true, Groq: false, Gemini: false, Mistral: false, OpenRouter: false, DeepSeek: false },
    keyUpdates: {}, ...draftOverrides
  };
  let state: AppState = {
    ready: true, surface: 'answer', visible: true, busy: false, answer: 'Synthetic SC answer', error: null,
    appearance: { ...values.Appearance },
    shortcuts: Object.fromEntries(SHORTCUT_FIELDS.map(({ action, field }) => [action, values[field]])) as AppState['shortcuts'],
    captureProtection: 'Excluded', version: '0.5.0-beta.1', setupLegacyNotice: false, ...stateOverrides
  };
  const listeners = new Set<(state: AppState) => void>();
  const scrollListeners = new Set<(delta: number) => void>();
  const saved: SettingsDraft[] = [];
  const emit = (patch: Partial<AppState>) => { state = { ...state, ...patch }; for (const listener of listeners) listener(state); };
  const api = {
    getState: vi.fn(async () => structuredClone(state)),
    setup: vi.fn(async (_replacement: string) => { emit({ surface: 'answer' }); }),
    command: vi.fn(async (command) => {
      if (command.type === 'settings') emit({ surface: 'settings' });
      if (command.type === 'showInput') emit({ surface: 'input' });
      if (command.type === 'captureTest') emit({ surface: 'captureTest' });
      if (command.type === 'escape') emit(state.surface === 'input' || state.surface === 'captureTest' ? { surface: 'answer' } : { visible: false });
      if (command.type === 'submit') emit({ busy: true, surface: 'answer' });
    }),
    getSettingsDraft: vi.fn(async () => structuredClone(draft)),
    saveSettings: vi.fn(async (next: SettingsDraft) => {
      saved.push(structuredClone(next));
      const keyPresence = { ...draft.keyPresence };
      for (const provider of Object.keys(next.keyUpdates) as Array<keyof SettingsDraft['keyPresence']>) keyPresence[provider] = true;
      draft = { ...structuredClone(next), keyPresence, keyUpdates: {} };
      emit({ surface: 'answer', appearance: next.values.Appearance });
    }),
    discardSettings: vi.fn(async () => { emit({ surface: 'answer' }); }),
    chooseColor: vi.fn(async (_initial: string) => '#123456' as string | null),
    subscribe: vi.fn((listener: (value: AppState) => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; }),
    onScroll: vi.fn((listener: (delta: number) => void) => { scrollListeners.add(listener); return () => { scrollListeners.delete(listener); }; })
  } satisfies DesktopApi;
  window.sc = api;
  return { api, saved, emit, getState: () => state, getDraft: () => draft,
    scroll: (delta: number) => { for (const listener of scrollListeners) listener(delta); },
    actions: () => Object.fromEntries(SHORTCUT_FIELDS.map(({ action, field }) => [action, draft.values[field]])) as Record<AppAction, typeof values.Capture>
  };
}
