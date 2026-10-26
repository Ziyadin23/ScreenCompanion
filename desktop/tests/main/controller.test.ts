import { describe, expect, it, vi } from 'vitest';
import type { AppState, PipelineConfiguration, PipelineMode, PipelineInput, PipelineResult, VaultData } from '../../src/contracts';
import { PROVIDERS } from '../../src/contracts';
import { withSavedSettings } from '../../src/pipeline/configuration';
import { defaultModels, defaultSettings } from '../../src/contracts/defaults';
import { ApplicationController } from '../../src/main/controller';
import { createPreviewPlatform } from '../../src/main/preview';
import { createDiagnostics } from '../../src/main/diagnostics';

function deferred<T>() { let resolve!: (value: T) => void; let reject!: (error: Error) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function fixture(initial: VaultData | null = { ...defaultSettings('synthetic-key'), CommandsShown: true }, processMode: PipelineMode = 'Thorough') {
  const platform = createPreviewPlatform();
  const jpeg = Buffer.from('synthetic-monitor');
  platform.activeMonitor = vi.fn(() => ({ x: -1920, y: 0, width: 1920, height: 1080 }));
  platform.monitorForWindow = vi.fn(() => ({ x: 0, y: 0, width: 1920, height: 1080 }));
  platform.captureMonitor = vi.fn(async bounds => ({ jpeg, bounds }));
  const applyShortcuts = vi.fn(async () => {});
  platform.applyShortcuts = applyShortcuts;
  platform.setOwnedDialogsVisible = vi.fn();
  platform.closeOwnedDialogs = vi.fn();
  platform.dispose = vi.fn();
  const load = vi.fn(async () => structuredClone(initial));
  const legacyPasswordVaultExists = vi.fn(async () => false);
  const save = vi.fn(async (_value: VaultData) => {});
  const outcome = deferred<PipelineResult>();
  const run = vi.fn((_input: PipelineInput) => outcome.promise);
  const states: AppState[] = [];
  const configuration: PipelineConfiguration = { provider: processMode === 'Direct' ? 'DeepSeek' : 'OpenAI', answerModel: processMode === 'Direct' ? 'deepseek-flash' : 'gpt-6-luna', visionModel: processMode === 'Direct' ? 'deepseek-flash' : 'gpt-6-luna', mode: processMode,
    assessmentMode: 'standard', enableQuestionCropping: true, enableRefusalRetry: true, imageRegionPadding: .08,
    questionRegion: null, extractionMaxOutputTokens: 6000, answerMaxOutputTokens: 2500, thinking: 'None' };
  const controller = new ApplicationController({ platform, store: { load, save,
    loadWindowSize: async () => null, saveWindowSize: async () => true, legacyPasswordVaultExists },
    pipeline: { run }, host: { panelHandle: () => Buffer.from([1, 0, 0, 0, 0, 0, 0, 0]), publish: state => states.push(state), scroll() {}, exit() {} },
    diagnostics: createDiagnostics(null, 'test'), configuration: settings => withSavedSettings(configuration, settings), defaultPipelineMode: processMode, validateSettings() {}, version: 'test', captureDelayMs: 0 });
  return { controller, platform, applyShortcuts, load, legacyPasswordVaultExists, save, run, outcome, states, jpeg };
}
describe('production lifecycle with injected native boundaries', () => {
  it('permits update restart only from idle visible Settings, after settings writes and dialogs finish', async () => {
    const f = fixture(); expect(f.controller.canInstallUpdate()).toBe(false);
    await f.controller.initialize(); expect(f.controller.canInstallUpdate()).toBe(false);
    const request = f.controller.command({ type: 'capture' });
    await vi.waitFor(() => expect(f.run).toHaveBeenCalled());
    await f.controller.command({ type: 'settings' }); expect(f.controller.canInstallUpdate()).toBe(false);
    f.outcome.resolve({ text: 'Retained answer', requestId: 'synthetic' }); await request;
    expect(f.controller.canInstallUpdate()).toBe(true);
    const saved = deferred<void>(); f.save.mockReturnValueOnce(saved.promise);
    const writing = f.controller.saveSettings(f.controller.getSettingsDraft());
    await vi.waitFor(() => expect(f.save).toHaveBeenCalled()); expect(f.controller.canInstallUpdate()).toBe(false);
    saved.resolve(); await writing;
    await f.controller.command({ type: 'settings' });
    const color = deferred<string | null>(); f.platform.chooseColor = vi.fn(() => color.promise);
    const choosing = f.controller.chooseColor('#123456'); expect(f.controller.canInstallUpdate()).toBe(false);
    color.resolve(null); await choosing; expect(f.controller.canInstallUpdate()).toBe(true);
    await f.controller.command({ type: 'toggleVisibility' }); expect(f.controller.canInstallUpdate()).toBe(false);
    f.controller.dispose(); expect(f.controller.canInstallUpdate()).toBe(false);
  });
  it('does not start a capture or write settings once update installation starts', async () => {
    const f = fixture(); await f.controller.initialize(); await f.controller.command({ type: 'settings' });
    const draft = f.controller.getSettingsDraft();
    f.controller.setUpdateState({ status: 'installing', version: '0.5.0-beta.4', progress: 100, message: 'Restarting' });
    await f.controller.command({ type: 'showInput' }); await f.controller.command({ type: 'capture' });
    await expect(f.controller.saveSettings(draft)).rejects.toMatchObject({ code: 'UPDATEBUSY' });
    expect(f.controller.getState().surface).toBe('settings'); expect(f.platform.captureMonitor).not.toHaveBeenCalled(); expect(f.save).not.toHaveBeenCalled();
  });
  it('waits for setup before registering shortcuts and makes no model request', async () => {
    const f = fixture(null); await f.controller.initialize();
    expect(f.controller.getState().surface).toBe('setup'); expect(f.platform.applyShortcuts).not.toHaveBeenCalled();
    await f.controller.setup({ provider: 'OpenAI', apiKey: 'synthetic-new-key' });
    expect(f.save).toHaveBeenCalled(); expect(f.controller.getState().ready).toBe(true); expect(f.run).not.toHaveBeenCalled();
    const state = JSON.stringify(f.controller.getState()); expect(state).not.toContain('synthetic-new-key');
  });
  it.each(PROVIDERS)('saves %s setup with its model defaults and uses that service on the first request', async provider => {
    const f = fixture(null); await f.controller.initialize();
    await f.controller.setup({ provider, apiKey: '  synthetic-service-key  ' });
    expect(f.save.mock.calls[0]?.[0]).toMatchObject({ ApiKey: 'synthetic-service-key', Models: defaultModels(provider),
      ProviderKeys: { [provider]: 'synthetic-service-key' } });
    expect(f.controller.getSettingsDraft()).toMatchObject({ values: { Models: defaultModels(provider) }, keyPresence: { [provider]: true } });
    expect(f.run).not.toHaveBeenCalled();
    const request = f.controller.command({ type: 'capture' });
    await vi.waitFor(() => expect(f.run).toHaveBeenCalledOnce());
    expect(f.run.mock.calls[0]?.[0]).toMatchObject({ apiKey: 'synthetic-service-key', configuration: { provider, answerModel: defaultModels(provider).AnswerModel } });
    f.outcome.resolve({ text: 'Synthetic answer', requestId: 'synthetic' }); await request;
    expect(JSON.stringify(f.controller.getState())).not.toContain('synthetic-service-key');
  });
  it.each(PROVIDERS.flatMap(provider => (['Balanced', 'Direct'] as const).map(processMode => ({ provider, processMode }))))(
    'keeps setup usable for $provider with inherited $processMode, including after restart', async ({ provider, processMode }) => {
      const f = fixture(null, processMode); await f.controller.initialize();
      await f.controller.setup({ provider, apiKey: 'synthetic-provider-key' });
      const expected = processMode === 'Direct' && provider !== 'DeepSeek' ? 'Thorough' : processMode;
      expect(f.controller.getSettingsDraft().values.PipelineMode).toBe(expected);
      const saved = f.save.mock.calls.at(-1)![0];
      const restarted = fixture(saved, processMode); await restarted.controller.initialize();
      expect(restarted.controller.getSettingsDraft()).toMatchObject({ values: { PipelineMode: expected, Models: { Provider: provider } }, keyPresence: { [provider]: true } });
      expect(f.run).not.toHaveBeenCalled(); expect(restarted.run).not.toHaveBeenCalled();
    });
  it('retains unsaved Settings across activation and hide/restore, blocking update restart until discarded', async () => {
    const f = fixture(); await f.controller.initialize(); await f.controller.command({ type: 'settings' });
    expect(f.controller.canInstallUpdate()).toBe(true);
    await f.controller.command({ type: 'settingsDraftChanged', dirty: true });
    expect(f.controller.canInstallUpdate()).toBe(false);
    await f.controller.command({ type: 'toggleVisibility' }); f.controller.restore();
    await f.controller.command({ type: 'settings' });
    expect(f.controller.getState().settingsDirty).toBe(true); expect(f.controller.canInstallUpdate()).toBe(false);
    await f.controller.discardSettings(); await f.controller.command({ type: 'settings' });
    expect(f.controller.getState().settingsDirty).toBe(false); expect(f.controller.canInstallUpdate()).toBe(true);
  });
  it('keeps failed saves dirty and clears the update guard only after a successful save', async () => {
    const f = fixture(); await f.controller.initialize(); await f.controller.command({ type: 'settings' });
    await f.controller.command({ type: 'settingsDraftChanged', dirty: true });
    const draft = f.controller.getSettingsDraft(); draft.values.CustomInstruction = 'Synthetic changed preference';
    f.save.mockRejectedValueOnce(new Error('synthetic storage failure'));
    await expect(f.controller.saveSettings(draft)).rejects.toMatchObject({ code: 'SAVEFAILED' });
    expect(f.controller.getState().settingsDirty).toBe(true); expect(f.controller.canInstallUpdate()).toBe(false);
    await f.controller.saveSettings(draft); await f.controller.command({ type: 'settings' });
    expect(f.controller.getState().settingsDirty).toBe(false); expect(f.controller.canInstallUpdate()).toBe(true);
  });
  it('blocks update restart while a shortcut is being recorded', async () => {
    const f = fixture(); await f.controller.initialize(); await f.controller.command({ type: 'settings' });
    await f.controller.command({ type: 'recordShortcut', recording: true }); expect(f.controller.canInstallUpdate()).toBe(false);
    await f.controller.command({ type: 'recordShortcut', recording: false }); expect(f.controller.canInstallUpdate()).toBe(true);
  });
  it('opens usable input on activation without an answer', async () => {
    const f = fixture(); f.controller.restore(); await f.controller.initialize();
    expect(f.controller.getState()).toMatchObject({ surface: 'input', visible: true });
  });
  it.each(['activation', 'visibility'] as const)('defers early %s while an existing vault is loading', async action => {
    const f = fixture(), loaded = deferred<VaultData | null>();
    f.load.mockReturnValueOnce(loaded.promise);
    const initialization = f.controller.initialize();
    if (action === 'activation') f.controller.restore();
    else await f.controller.command({ type: 'toggleVisibility' });
    expect(f.controller.getState().visible).toBe(false);
    await expect(f.controller.setup({ provider: 'OpenAI', apiKey: 'synthetic-replacement' })).rejects.toMatchObject({ code: 'NOTREADY' });
    expect(f.save).not.toHaveBeenCalled();
    expect(f.platform.applyShortcuts).not.toHaveBeenCalled();
    loaded.resolve({ ...defaultSettings('existing-synthetic-key'), CommandsShown: true });
    await initialization;
    expect(f.controller.getState()).toMatchObject({ ready: true, surface: 'input', visible: true });
    expect(f.platform.applyShortcuts).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ ApiKey: 'existing-synthetic-key' }), false, expect.any(Function));
    expect(f.save).not.toHaveBeenCalled();
    expect(f.states.some(state => state.surface === 'setup' && state.visible)).toBe(false);
  });
  it('allows setup only after loading confirms that the vault is absent', async () => {
    const f = fixture(null), loaded = deferred<VaultData | null>();
    f.load.mockReturnValueOnce(loaded.promise);
    const initialization = f.controller.initialize();
    f.controller.restore(); await f.controller.command({ type: 'toggleVisibility' });
    await expect(f.controller.setup({ provider: 'OpenAI', apiKey: 'synthetic-new-key' })).rejects.toMatchObject({ code: 'NOTREADY' });
    expect(f.save).not.toHaveBeenCalled(); expect(f.controller.getState().visible).toBe(false);
    loaded.resolve(null); await initialization;
    expect(f.controller.getState()).toMatchObject({ ready: false, surface: 'setup', visible: true });
    expect(f.save).not.toHaveBeenCalled();
    await f.controller.setup({ provider: 'OpenAI', apiKey: 'synthetic-new-key' });
    expect(f.controller.getState().ready).toBe(true); expect(f.run).not.toHaveBeenCalled();
  });
  it('does not expose setup while its legacy-vault notice is still loading', async () => {
    const f = fixture(null), notice = deferred<boolean>();
    f.legacyPasswordVaultExists.mockReturnValueOnce(notice.promise);
    const initialization = f.controller.initialize();
    await vi.waitFor(() => expect(f.legacyPasswordVaultExists).toHaveBeenCalled());
    f.controller.restore();
    await expect(f.controller.setup({ provider: 'OpenAI', apiKey: 'synthetic-new-key' })).rejects.toMatchObject({ code: 'NOTREADY' });
    expect(f.controller.getState().visible).toBe(false); expect(f.save).not.toHaveBeenCalled();
    notice.resolve(true); await initialization;
    expect(f.controller.getState()).toMatchObject({ surface: 'setup', visible: true, setupLegacyNotice: true });
  });
  it('blocks overlapping setup writes and permits retry after a failed save', async () => {
    const f = fixture(null), saved = deferred<void>(); await f.controller.initialize();
    f.save.mockReturnValueOnce(saved.promise);
    const first = f.controller.setup({ provider: 'OpenAI', apiKey: 'synthetic-first-key' });
    await expect(f.controller.setup({ provider: 'OpenAI', apiKey: 'synthetic-overlapping-key' })).rejects.toMatchObject({ code: 'NOTREADY' });
    expect(f.save).toHaveBeenCalledTimes(1);
    const failure = expect(first).rejects.toMatchObject({ code: 'SAVEFAILED' });
    saved.reject(new Error('synthetic write failure')); await failure;
    expect(f.controller.getState()).toMatchObject({ ready: false, surface: 'setup' });
    await f.controller.setup({ provider: 'OpenAI', apiKey: 'synthetic-retry-key' });
    expect(f.controller.getState()).toMatchObject({ ready: true, error: null });
    expect(f.save.mock.calls.every(([settings]) => settings.ApiKey !== 'synthetic-overlapping-key')).toBe(true);
  });
  it('keeps setup unavailable after a failed vault load and further activation', async () => {
    const f = fixture(), loaded = deferred<VaultData | null>();
    f.load.mockReturnValueOnce(loaded.promise);
    const initialization = f.controller.initialize();
    f.controller.restore(); await f.controller.command({ type: 'toggleVisibility' });
    const failure = expect(initialization).rejects.toThrow('synthetic read failure');
    loaded.reject(new Error('synthetic read failure')); await failure;
    f.controller.restore(); await f.controller.command({ type: 'toggleVisibility' });
    await expect(f.controller.setup({ provider: 'OpenAI', apiKey: 'synthetic-replacement' })).rejects.toMatchObject({ code: 'NOTREADY' });
    expect(f.controller.getState()).toMatchObject({ ready: false, visible: false });
    expect(f.save).not.toHaveBeenCalled(); expect(f.platform.applyShortcuts).not.toHaveBeenCalled();
    expect(f.states.some(state => state.surface === 'setup' && state.visible)).toBe(false);
  });
  it('shows all applied custom shortcuts in the initial commands', async () => {
    const settings = defaultSettings('synthetic-key');
    settings.Capture = { Modifiers: 2, Key: 81 }; settings.Visibility = { Modifiers: 2, Key: 87 };
    settings.Test = { Modifiers: 2, Key: 69 }; settings.SettingsShortcut = { Modifiers: 2, Key: 82 };
    settings.ExitShortcut = { Modifiers: 2, Key: 84 }; settings.InputShortcut = { Modifiers: 2, Key: 89 };
    const f = fixture(settings); await f.controller.initialize();
    const text = f.controller.getState().answer;
    for (const line of ['Ctrl+Q — capture and answer', 'Ctrl+W — show or hide panel', 'Ctrl+E — capture test',
      'Ctrl+R — open settings', 'Ctrl+T — exit app', 'Ctrl+Y — type a question']) expect(text).toContain(line);
    expect(text).not.toContain('Ctrl+Alt+Space'); expect(text).not.toContain('Ctrl+Backspace');
  });
  it('shows the active fallback shortcuts if initial registration fails', async () => {
    const settings = defaultSettings('synthetic-key'); settings.Capture = { Modifiers: 2, Key: 81 };
    const f = fixture(settings); f.applyShortcuts.mockRejectedValueOnce(new Error('synthetic conflict'));
    await f.controller.initialize();
    expect(f.controller.getState().shortcuts.capture).toEqual(defaultSettings('').Capture);
    expect(f.controller.getState().answer).toContain('Ctrl+Alt+Space — capture and answer');
    expect(f.controller.getState().answer).not.toContain('Ctrl+Q');
  });
  it('captures once, blocks a second request, and zeroes the image after answering', async () => {
    const f = fixture(); await f.controller.initialize();
    const pending = f.controller.command({ type: 'capture' });
    await vi.waitFor(() => expect(f.run).toHaveBeenCalledTimes(1));
    await f.controller.command({ type: 'capture' });
    expect(f.platform.captureMonitor).toHaveBeenCalledTimes(1);
    f.outcome.resolve({ text: '42', requestId: 'synthetic-request' }); await pending;
    expect(f.controller.getState()).toMatchObject({ answer: '42', busy: false, visible: true });
    expect(f.jpeg.every(byte => byte === 0)).toBe(true);
  });
  it('uses the panel monitor for typed input and preserves the typed task', async () => {
    const f = fixture(); await f.controller.initialize(); await f.controller.command({ type: 'showInput' });
    const pending = f.controller.command({ type: 'submit', question: '  Explain this diagram  ' });
    await vi.waitFor(() => expect(f.run).toHaveBeenCalled());
    expect(f.platform.monitorForWindow).toHaveBeenCalledOnce(); expect(f.platform.activeMonitor).not.toHaveBeenCalled();
    expect(f.run.mock.calls[0]?.[0]).toMatchObject({ typedQuestion: 'Explain this diagram' });
    f.outcome.resolve({ text: 'Synthetic result', requestId: 'synthetic' }); await pending;
  });
  it('selects the monitor before changing the input surface and restores owned dialogs with Settings', async () => {
    const f = fixture(); await f.controller.initialize(); await f.controller.command({ type: 'showInput' });
    f.platform.monitorForWindow = vi.fn(() => {
      expect(f.controller.getState().surface).toBe('input');
      return { x: -1600, y: 0, width: 1600, height: 900 };
    });
    const pending = f.controller.command({ type: 'submit', question: 'Synthetic task' });
    await vi.waitFor(() => expect(f.run).toHaveBeenCalled());
    f.outcome.resolve({ text: 'Result', requestId: 'synthetic' }); await pending;
    await f.controller.command({ type: 'settings' }); await f.controller.command({ type: 'toggleVisibility' });
    await f.controller.command({ type: 'settings' });
    expect(f.platform.setOwnedDialogsVisible).toHaveBeenLastCalledWith(expect.any(Buffer), true);
    await f.controller.discardSettings(); expect(f.platform.closeOwnedDialogs).toHaveBeenCalled();
  });
  it('defers Settings during capture and retains the answer behind Settings', async () => {
    const f = fixture(); await f.controller.initialize();
    const pending = f.controller.command({ type: 'capture' });
    await f.controller.command({ type: 'settings' }); expect(f.controller.getState().surface).toBe('answer');
    await vi.waitFor(() => expect(f.run).toHaveBeenCalled()); expect(f.controller.getState().surface).toBe('settings');
    f.outcome.resolve({ text: 'Retained result', requestId: 'synthetic' }); await pending;
    expect(f.controller.getState()).toMatchObject({ surface: 'settings', answer: 'Retained result' });
    await f.controller.discardSettings(); expect(f.controller.getState()).toMatchObject({ surface: 'answer', answer: 'Retained result' });
  });
  it('exposes key presence only and rolls back shortcuts when Save fails', async () => {
    const f = fixture(); await f.controller.initialize(); await f.controller.command({ type: 'settings' });
    const draft = f.controller.getSettingsDraft(); expect(JSON.stringify(draft)).not.toContain('synthetic-key');
    expect(draft.keyPresence.OpenAI).toBe(true);
    draft.values.Appearance.TextSizePoints = 18; f.save.mockRejectedValueOnce(new Error('private failure'));
    await expect(f.controller.saveSettings(draft)).rejects.toThrow('Previous shortcuts');
    expect(f.platform.applyShortcuts).toHaveBeenCalledTimes(3);
    expect(f.controller.getState()).toMatchObject({ surface: 'settings', appearance: { TextSizePoints: 11 } });
    expect(JSON.stringify(f.controller.getState())).not.toContain('private failure');
  });
  it('cancels on shutdown and releases native resources', async () => {
    const f = fixture(); await f.controller.initialize(); const pending = f.controller.command({ type: 'capture' });
    await vi.waitFor(() => expect(f.run).toHaveBeenCalled());
    f.controller.dispose(); expect(f.run.mock.calls[0]?.[0]?.signal.aborted).toBe(true);
    f.outcome.resolve({ text: 'Ignore after shutdown', requestId: 'synthetic' }); await pending;
    expect(f.platform.dispose).toHaveBeenCalledOnce(); expect(f.jpeg.every(byte => byte === 0)).toBe(true);
  });
});
