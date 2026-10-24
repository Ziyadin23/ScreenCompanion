import { describe, expect, it, vi } from 'vitest';
import type { AppState, PipelineConfiguration, PipelineInput, PipelineResult, VaultData } from '../../src/contracts';
import { defaultSettings } from '../../src/contracts/defaults';
import { ApplicationController } from '../../src/main/controller';
import { createPreviewPlatform } from '../../src/main/preview';
import { createDiagnostics } from '../../src/main/diagnostics';

function deferred<T>() { let resolve!: (value: T) => void; let reject!: (error: Error) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function fixture(initial: VaultData | null = { ...defaultSettings('synthetic-key'), CommandsShown: true }) {
  const platform = createPreviewPlatform();
  const jpeg = Buffer.from('synthetic-monitor');
  platform.activeMonitor = vi.fn(() => ({ x: -1920, y: 0, width: 1920, height: 1080 }));
  platform.monitorForWindow = vi.fn(() => ({ x: 0, y: 0, width: 1920, height: 1080 }));
  platform.captureMonitor = vi.fn(async bounds => ({ jpeg, bounds }));
  platform.applyShortcuts = vi.fn(async () => {});
  platform.setOwnedDialogsVisible = vi.fn();
  platform.closeOwnedDialogs = vi.fn();
  platform.dispose = vi.fn();
  const save = vi.fn(async (_value: VaultData) => {});
  const outcome = deferred<PipelineResult>();
  const run = vi.fn((_input: PipelineInput) => outcome.promise);
  const states: AppState[] = [];
  const configuration: PipelineConfiguration = { provider: 'OpenAI', answerModel: 'gpt-6-luna', visionModel: 'gpt-6-luna', mode: 'Thorough',
    assessmentMode: 'standard', enableQuestionCropping: true, enableRefusalRetry: true, imageRegionPadding: .08,
    questionRegion: null, extractionMaxOutputTokens: 6000, answerMaxOutputTokens: 2500, thinking: 'None' };
  const controller = new ApplicationController({ platform, store: { load: async () => structuredClone(initial), save,
    loadWindowSize: async () => null, saveWindowSize: async () => true, legacyPasswordVaultExists: async () => false },
    pipeline: { run }, host: { panelHandle: () => Buffer.from([1, 0, 0, 0, 0, 0, 0, 0]), publish: state => states.push(state), scroll() {}, exit() {} },
    diagnostics: createDiagnostics(null, 'test'), configuration: () => configuration, validateSettings() {}, version: 'test', captureDelayMs: 0 });
  return { controller, platform, save, run, outcome, states, jpeg };
}
describe('production lifecycle with injected native boundaries', () => {
  it('waits for setup before registering shortcuts and makes no model request', async () => {
    const f = fixture(null); await f.controller.initialize();
    expect(f.controller.getState().surface).toBe('setup'); expect(f.platform.applyShortcuts).not.toHaveBeenCalled();
    await f.controller.setup('synthetic-new-key');
    expect(f.save).toHaveBeenCalled(); expect(f.controller.getState().ready).toBe(true); expect(f.run).not.toHaveBeenCalled();
    const state = JSON.stringify(f.controller.getState()); expect(state).not.toContain('synthetic-new-key');
  });
  it('opens usable input on activation without an answer', async () => {
    const f = fixture(); f.controller.restore(); await f.controller.initialize();
    expect(f.controller.getState()).toMatchObject({ surface: 'input', visible: true });
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
