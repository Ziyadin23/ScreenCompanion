import type { AppState, DesktopApi, SettingsDraft, Surface } from '../src/contracts';
import { defaultModels, defaultSettings } from '../src/contracts/defaults';
import { applyModelPipelineUpdates, rememberModelPipeline } from '../src/contracts/model-pipelines';
import { shortcutsByAction } from '../src/contracts/shortcut-display';
import { version } from '../package.json';

/** In-memory review fixture. No filesystem, network, or credential-storage path. */
export function previewBridge(surface: Surface = 'settings', platform: AppState['platform'] = 'windows') {
  const { ApiKey: _key, ProviderKeys: _keys, ...values } = defaultSettings('');
  values.Models = defaultModels(); values.PipelineMode = 'Thorough';
  values.ModelPipelines = rememberModelPipeline([], values.Models, values.PipelineMode);
  let draft: SettingsDraft = {
    session: 0, values, keyPresence: { OpenAI: true, Groq: false, Gemini: false, Mistral: false, OpenRouter: false, DeepSeek: false }, keyUpdates: {}, pipelineUpdates: []
  };
  let state: AppState = {
    platform, ready: true, surface, visible: true, busy: false, settingsSession: surface === 'settings' ? 1 : 0, settingsDirty: false, settingsSaving: false,
    settingsKeyPresence: null, settingsModels: null, settingsModelPipelines: null, shortcutRecovery: null,
    answer: 'The answer stays here while you adjust Settings.\n\nThis is synthetic preview text. No screen was captured and no service was contacted.',
    error: null, appearance: { ...values.Appearance },
    shortcuts: shortcutsByAction(values),
    captureProtection: 'Failed', version, setupLegacyNotice: false,
    updates: { status: 'disabled', version: null, progress: null, message: 'Synthetic preview. Updates are disabled.' }
  };
  const listeners = new Set<(state: AppState) => void>();
  function emit(patch: Partial<AppState>) {
    const settingsSession = state.settingsSession + (patch.surface === 'settings' && state.surface !== 'settings' ? 1 : 0);
    state = { ...state, settingsSession, ...patch };
    for (const listener of listeners) listener(structuredClone(state));
  }
  const api: DesktopApi = {
    getState: async () => structuredClone(state),
    setup: async () => { emit({ surface: 'answer' }); },
    command: async (command) => {
      if (command.type === 'settings') emit({ surface: 'settings' });
      if (command.type === 'showInput') emit({ surface: 'input' });
      if (command.type === 'captureTest') emit({ surface: 'captureTest' });
      if (command.type === 'settingsDraftChanged') emit({ settingsDirty: command.dirty });
      if (['escape', 'exit', 'submit', 'capture'].includes(command.type)) emit({ surface: 'answer', settingsDirty: false });
    },
    getSettingsDraft: async () => ({ ...structuredClone(draft), session: state.settingsSession }),
    saveSettings: async (next) => {
      const keyPresence = { ...draft.keyPresence };
      for (const provider of Object.keys(next.keyUpdates) as Array<keyof SettingsDraft['keyPresence']>) {
        if (next.keyUpdates[provider]?.trim()) keyPresence[provider] = true;
      }
      const pipelines = applyModelPipelineUpdates(draft.values, next.pipelineUpdates, next.values.Models);
      draft = { session: next.session, values: { ...structuredClone(next.values), ...pipelines,
        CustomInstruction: next.values.CustomInstruction.trim() }, keyPresence, keyUpdates: {}, pipelineUpdates: [] };
      emit({ surface: 'answer', settingsDirty: false, settingsKeyPresence: keyPresence, settingsModels: draft.values.Models, settingsModelPipelines: pipelines.ModelPipelines,
        appearance: { ...draft.values.Appearance }, shortcuts: shortcutsByAction(draft.values) });
      return 'saved';
    },
    discardSettings: async (session) => {
      if (state.surface === 'settings' && state.settingsSession === session) emit({ surface: 'answer', settingsDirty: false });
    },
    chooseColor: async () => null,
    update: async () => {},
    subscribe: (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    onScroll: () => () => {},
    onInputAction: () => () => {}
  };
  return { api, open: (next: Surface) => emit({ surface: next, visible: true, settingsDirty: false }) };
}
