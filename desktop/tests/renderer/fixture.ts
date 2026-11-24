import { vi } from 'vitest';
import type { AppState, DesktopApi, SettingsDraft, SetupRequest } from '../../src/contracts';
import { defaultModels, defaultSettings } from '../../src/contracts/defaults';
import { applyModelPipelineUpdates, rememberModelPipeline } from '../../src/contracts/model-pipelines';
import { shortcutsByAction } from '../../src/contracts/shortcut-display';

export function fixture(stateOverrides: Partial<AppState> = {}, draftOverrides: Partial<SettingsDraft> = {}) {
  const { ApiKey: _key, ProviderKeys: _keys, ...values } = defaultSettings('');
  values.Models = defaultModels(); values.PipelineMode = 'Thorough'; values.CommandsShown = true;
  values.ModelPipelines = rememberModelPipeline([], values.Models, values.PipelineMode);
  let draft: SettingsDraft = {
    session: 0, values, keyPresence: { OpenAI: true, Groq: false, Gemini: false, Mistral: false, OpenRouter: false, DeepSeek: false },
    keyUpdates: {}, pipelineUpdates: [], ...draftOverrides
  };
  let state: AppState = {
    platform: 'windows', ready: true, surface: 'answer', visible: true, busy: false, settingsSession: stateOverrides.surface === 'settings' ? 1 : 0, settingsRevision: 0, settingsFocusRevision: 0, settingsDirty: false, settingsSaving: false,
    settingsKeyPresence: null, settingsModels: null, settingsModelPipelines: null, shortcutRecovery: null, answer: 'Synthetic SC answer', error: null,
    appearance: { ...values.Appearance },
    shortcuts: shortcutsByAction(draft.values),
    captureProtection: 'Excluded', version: '0.5.0-beta.1', setupLegacyNotice: false,
    updates: { status: 'idle', version: null, progress: null, message: 'Check for a newer version of SC.' }, ...stateOverrides
  };
  const listeners = new Set<(state: AppState) => void>();
  const scrollListeners = new Set<(delta: number) => void>();
  const inputListeners = new Set<(submitScreenshot: boolean) => void>();
  const saved: SettingsDraft[] = [];
  const emit = (patch: Partial<AppState>) => {
    const settingsSession = state.settingsSession + (patch.surface === 'settings' && state.surface !== 'settings' ? 1 : 0);
    state = { ...state, settingsSession, ...patch };
    for (const listener of listeners) listener(state);
  };
  const getDraft = () => ({ ...structuredClone(draft), session: state.settingsSession });
  const api = {
    getState: vi.fn(async () => structuredClone(state)),
    setup: vi.fn(async (_request: SetupRequest) => { emit({ surface: 'answer' }); }),
    command: vi.fn<DesktopApi['command']>(async command => {
      if (command.type === 'settings') emit({ surface: 'settings' });
      if (command.type === 'showInput') emit({ surface: 'input' });
      if (command.type === 'captureTest') emit({ surface: 'captureTest' });
      if (command.type === 'escape') emit(state.surface === 'input' || state.surface === 'captureTest' ? { surface: 'answer' } : { visible: false });
      if (command.type === 'submit') emit({ busy: true, surface: 'answer' });
      if (command.type === 'settingsDraftChanged' && state.surface === 'settings' && command.session === state.settingsSession)
        emit({ settingsDirty: command.dirty });
    }),
    getSettingsDraft: vi.fn(async () => getDraft()),
    saveSettings: vi.fn<DesktopApi['saveSettings']>(async (next) => {
      saved.push(structuredClone(next));
      const keyPresence = { ...draft.keyPresence };
      for (const provider of Object.keys(next.keyUpdates) as Array<keyof SettingsDraft['keyPresence']>) keyPresence[provider] = true;
      const pipelines = applyModelPipelineUpdates(draft.values, next.pipelineUpdates, next.values.Models);
      draft = { session: next.session, values: { ...structuredClone(next.values), ...pipelines }, keyPresence, keyUpdates: {}, pipelineUpdates: [] };
      emit({ surface: 'answer', settingsRevision: state.settingsRevision + 1, settingsDirty: false, settingsKeyPresence: keyPresence, settingsModels: draft.values.Models, settingsModelPipelines: pipelines.ModelPipelines,
        appearance: draft.values.Appearance, shortcuts: shortcutsByAction(draft.values) });
      return 'saved';
    }),
    discardSettings: vi.fn<DesktopApi['discardSettings']>(async (session) => {
      if (state.surface === 'settings' && state.settingsSession === session) emit({ surface: 'answer', settingsDirty: false });
    }),
    chooseColor: vi.fn(async (_initial: string) => '#123456' as string | null),
    update: vi.fn(async (_action) => {}),
    subscribe: vi.fn((listener: (value: AppState) => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; }),
    onScroll: vi.fn((listener: (delta: number) => void) => { scrollListeners.add(listener); return () => { scrollListeners.delete(listener); }; }),
    onInputAction: vi.fn((listener: (submitScreenshot: boolean) => void) => { inputListeners.add(listener); return () => { inputListeners.delete(listener); }; })
  } satisfies DesktopApi;
  window.sc = api;
  return { api, saved, emit, getState: () => state, getDraft,
    inputAction: (submitScreenshot: boolean) => { for (const listener of inputListeners) listener(submitScreenshot); },
    scroll: (delta: number) => { for (const listener of scrollListeners) listener(delta); },
    actions: () => shortcutsByAction(draft.values)
  };
}
