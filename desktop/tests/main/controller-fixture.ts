import { vi } from 'vitest';
import type { AppState, PipelineConfiguration, PipelineMode, PipelineInput, PipelineResult, VaultData } from '../../src/contracts';
import { withSavedSettings } from '../../src/pipeline/configuration';
import { defaultSettings } from '../../src/contracts/defaults';
import { ApplicationController, type ControllerDependencies } from '../../src/main/controller';
import { createPreviewPlatform } from '../../src/main/preview';
import { createDiagnostics } from '../../src/main/diagnostics';

export function deferred<T>() { let resolve!: (value: T) => void; let reject!: (error: Error) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
export function controllerFixture(initial: VaultData | null = { ...defaultSettings('synthetic-key'), CommandsShown: true }, processMode: PipelineMode = 'Thorough',
  platformName: 'windows' | 'linux' = 'windows', mode: ControllerDependencies['mode'] = 'production') {
  const platform = createPreviewPlatform();
  const jpeg = Buffer.from('synthetic-monitor');
  platform.activeMonitor = vi.fn(() => ({ x: -1920, y: 0, width: 1920, height: 1080 }));
  platform.monitorForWindow = vi.fn(() => ({ x: 0, y: 0, width: 1920, height: 1080 }));
  platform.captureMonitor = vi.fn(async bounds => ({ jpeg, bounds: bounds ?? { x: 0, y: 0, width: 1920, height: 1080 } }));
  const applyShortcuts = vi.fn(async () => {});
  platform.applyShortcuts = applyShortcuts;
  platform.setOwnedDialogsVisible = vi.fn();
  platform.closeOwnedDialogs = vi.fn();
  platform.dispose = vi.fn();
  const load = vi.fn(async () => structuredClone(initial));
  const legacyPasswordVaultExists = vi.fn(async () => false);
  const save = vi.fn(async (_value: VaultData) => {});
  function delaySave() {
    const started = deferred<void>();
    const write = deferred<void>();
    save.mockImplementationOnce(() => { started.resolve(); return write.promise; });
    return { started: started.promise, resolve: write.resolve, reject: write.reject };
  }
  const outcome = deferred<PipelineResult>();
  const run = vi.fn((_input: PipelineInput) => outcome.promise);
  const states: AppState[] = [];
  const configuration: PipelineConfiguration = { provider: processMode === 'Direct' ? 'DeepSeek' : 'OpenAI', answerModel: processMode === 'Direct' ? 'deepseek-flash' : 'gpt-6-luna', visionModel: processMode === 'Direct' ? 'deepseek-flash' : 'gpt-6-luna', mode: processMode,
    assessmentMode: 'standard', enableQuestionCropping: true, enableRefusalRetry: true, imageRegionPadding: .08,
    questionRegion: null, extractionMaxOutputTokens: 6000, answerMaxOutputTokens: 2500, thinking: 'None' };
  const host = { panelHandle: () => Buffer.from([1, 0, 0, 0, 0, 0, 0, 0]), publish: (state: AppState) => { states.push(state); }, scroll() {}, exit() {},
    isFocused: vi.fn(() => true), inputAction: vi.fn(), inputHeight: vi.fn(), activate: vi.fn() };
  const controller = new ApplicationController({ platform, store: { load, save,
    loadWindowSize: async () => null, saveWindowSize: async () => true, legacyPasswordVaultExists },
    pipeline: { run }, host,
    diagnostics: createDiagnostics(null, 'test'), configuration: settings => withSavedSettings(configuration, settings), defaultPipelineMode: processMode, validateSettings() {}, version: 'test', captureDelayMs: 0, platformName, mode });
  return { controller, platform, applyShortcuts, load, legacyPasswordVaultExists, save, delaySave, run, outcome, states, jpeg, host };
}
