import type { ApiProvider, AppState, DesktopApi, SettingsDraft, Surface } from '../src/contracts';
import { defaultModels, defaultSettings } from '../src/contracts/defaults';
import { LINUX_ACTION_NAMES, linuxCommand } from '../src/contracts/linux-actions';
import { applyModelPipelineUpdates, rememberModelPipeline } from '../src/contracts/model-pipelines';
import { shortcutsByAction } from '../src/contracts/shortcut-display';
import { version } from '../package.json';

function setupDraft(provider: ApiProvider): SettingsDraft {
  const { ApiKey: _key, ProviderKeys: _keys, ...values } = defaultSettings('');
  values.Models = defaultModels(provider); values.PipelineMode = 'Thorough';
  values.ModelPipelines = rememberModelPipeline([], values.Models, values.PipelineMode);
  const keyPresence = { OpenAI: false, Groq: false, Gemini: false, Mistral: false, OpenRouter: false, DeepSeek: false };
  keyPresence[provider] = true;
  return { session: 0, values, keyPresence, keyUpdates: {}, pipelineUpdates: [] };
}

/** In-memory review fixture. No filesystem, network, or credential-storage path. */
export function previewBridge(surface: Surface = 'settings', platform: AppState['platform'] = 'windows') {
  let draft = setupDraft('OpenAI');
  let state: AppState = {
    platform, ready: true, surface, visible: true, busy: false, settingsSession: surface === 'settings' ? 1 : 0, settingsRevision: 0, settingsFocusRevision: 0, settingsDirty: false, settingsSaving: false,
    settingsKeyPresence: null, settingsModels: null, settingsModelPipelines: null, shortcutRecovery: null,
    answer: 'The answer stays here while you adjust Settings.\n\nThis is synthetic preview text. No screen was captured and no service was contacted.',
    error: null, appearance: { ...draft.values.Appearance },
    shortcuts: shortcutsByAction(draft.values),
    captureProtection: 'Failed', version, setupLegacyNotice: false,
    updates: { status: 'disabled', version: null, progress: null, message: 'Synthetic preview. Updates are disabled.' }
  };
  const listeners = new Set<(state: AppState) => void>();
  function emit(patch: Partial<AppState>) {
    const settingsSession = state.settingsSession + (patch.surface === 'settings' && state.surface !== 'settings' ? 1 : 0);
    state = { ...state, settingsSession, ...patch };
    for (const listener of listeners) listener(structuredClone(state));
  }
  function applyDraft(next: SettingsDraft) {
    draft = next;
    emit({ surface: 'answer', settingsRevision: state.settingsRevision + 1, settingsDirty: false,
      settingsKeyPresence: draft.keyPresence, settingsModels: draft.values.Models, settingsModelPipelines: draft.values.ModelPipelines,
      appearance: { ...draft.values.Appearance }, shortcuts: shortcutsByAction(draft.values) });
  }
  const ownsSettings = (session: number) => state.surface === 'settings' && session === state.settingsSession;
  const api: DesktopApi = {
    getState: async () => structuredClone(state),
    setup: async ({ provider }) => { applyDraft(setupDraft(provider)); },
    command: async (command) => {
      if (command.type === 'copyLinuxCommand') {
        if (state.platform !== 'linux' || state.surface !== 'settings' || !LINUX_ACTION_NAMES.includes(command.action))
          throw new Error('Linux command is unavailable.');
        await navigator.clipboard.writeText(linuxCommand(command.action));
        return 'copied';
      }
      if (command.type === 'settings') emit({ surface: 'settings' });
      if (command.type === 'showInput') emit({ surface: 'input' });
      if (command.type === 'captureTest') emit({ surface: 'captureTest' });
      if (command.type === 'settingsDraftChanged' && ownsSettings(command.session))
        emit({ settingsDirty: command.dirty });
      if (['escape', 'exit', 'submit', 'capture'].includes(command.type)) emit({ surface: 'answer', settingsDirty: false });
      if (command.type === 'submit') return 'clear-question';
    },
    getSettingsDraft: async () => ({ ...structuredClone(draft), session: state.settingsSession }),
    saveSettings: async (next) => {
      if (!ownsSettings(next.session)) throw new Error('This Settings draft is closed. Save from the current window.');
      const keyPresence = { ...draft.keyPresence };
      for (const provider of Object.keys(next.keyUpdates) as Array<keyof SettingsDraft['keyPresence']>) {
        if (next.keyUpdates[provider]?.trim()) keyPresence[provider] = true;
      }
      const pipelines = applyModelPipelineUpdates(draft.values, next.pipelineUpdates, next.values.Models);
      applyDraft({ session: next.session, values: { ...structuredClone(next.values), ...pipelines,
        CustomInstruction: next.values.CustomInstruction.trim() }, keyPresence, keyUpdates: {}, pipelineUpdates: [] });
      return 'saved';
    },
    discardSettings: async (session) => {
      if (ownsSettings(session)) emit({ surface: 'answer', settingsDirty: false });
    },
    chooseColor: async () => null,
    update: async () => {},
    subscribe: (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    onScroll: () => () => {},
    onInputAction: () => () => {}
  };
  return { api, getSurface: () => state.surface, open: (next: Surface) => emit({ surface: next, visible: true, settingsDirty: false }) };
}
