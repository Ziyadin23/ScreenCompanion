import type { SettingsStore, WindowsPlatform } from '../contracts';
import { defaultSettings } from '../contracts/defaults';
import { AppError } from './diagnostics';

/** Explicit key-free preview only. Never selected automatically when native operations fail. */
export function createPreviewPlatform(): WindowsPlatform {
  const unavailable = (): never => { throw new AppError('PREVIEWONLY', 'This key-free preview does not perform native capture, storage, or network requests.'); };
  return {
    acquireInstance: async () => true, startCaptureProtection() {}, protectWindow: () => 'Failed',
    activeMonitor: unavailable, monitorForWindow: unavailable, captureMonitor: unavailable, crop: unavailable,
    applyShortcuts: async () => {}, attachPanel: () => () => {}, setHoverInputHeight() {}, setPanelResizeEnabled() {},
    beginMove() {}, beginResize() {}, cancelPanelInteraction() {}, chooseColor: async () => null, setOwnedDialogsVisible() {}, closeOwnedDialogs() {},
    protectData: unavailable, unprotectData: unavailable, send: unavailable, dispose() {}
  };
}
export function createPreviewStore(): SettingsStore {
  let settings = defaultSettings('synthetic-preview-key'); settings.CommandsShown = true;
  return {
    load: async () => structuredClone(settings), save: async value => { settings = structuredClone(value); },
    loadWindowSize: async () => null, saveWindowSize: async () => false, legacyPasswordVaultExists: async () => false
  };
}
