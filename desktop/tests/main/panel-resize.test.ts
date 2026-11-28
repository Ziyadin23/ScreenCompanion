import { EventEmitter, once } from 'node:events';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setImmediate } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { AppState, DisplayError } from '../../src/contracts';
import { defaultSettings } from '../../src/contracts/defaults';
import { createSettingsStore } from '../../src/storage';

// Run the real main entry point, controller and size store without a desktop or keyring.
const cryptor = {
  protectData: (data: Buffer) => Buffer.from(data).reverse(),
  unprotectData: (data: Buffer) => Buffer.from(data).reverse()
};
const platform = process.platform === 'linux' ? 'linux' : 'windows';
const workArea = { x: 0, y: 0, width: 900, height: 700 };
const setTrayImage = vi.fn();
const captureVisibility = vi.fn();
let clipboardText: string;
const clipboardWrite = vi.fn(async (value: string) => { clipboardText = value; });
const showMessageBoxSync = vi.fn<(options: Electron.MessageBoxOptions) => number>();
const showErrorBox = vi.fn();
const sizeWrites = new EventEmitter();
let profile: string;
let scaleFactor: number;
let measuredTextHeight: number;
let panel: TestWindow;
let panelFloating: boolean;
let panelPaint: Promise<void> | null;
let nextGeometryResponse: Promise<void> | null;
let nextSizeWrite: Promise<void> | null;
let deferPanelConfigure: boolean;
let instanceOwner: symbol | null;
let exitFromTray: (() => void) | undefined;
let failStartupRenderer: boolean;

const ipc = new Map<string, (event: unknown, value: unknown) => Promise<unknown>>();
const app = Object.assign(new EventEmitter(), {
  isPackaged: false, whenReady: async () => {}, getPath: () => profile,
  setDesktopName() {}, setAppUserModelId() {}, commandLine: { appendSwitch() {} },
  quit() {
    let prevented = false;
    app.emit('before-quit', { preventDefault: () => { prevented = true; } });
    if (!prevented) app.emit('quit');
  }
});

class TestWindow extends EventEmitter {
  focused = true;
  private destroyed = false;
  readonly startupIpc = new Map<string, (event: unknown, value: unknown) => unknown>();
  private readonly normalBounds: Electron.Rectangle;
  private bounds: Electron.Rectangle;
  private compositorSize: Electron.Size;
  private minimum: Electron.Size;
  private maximum = { width: Infinity, height: Infinity };
  private visible = false;
  private hasMapped = false;
  readonly webContents = Object.assign(new EventEmitter(), {
    mainFrame: { url: '' }, send() {}, setWindowOpenHandler() {}, invalidate() {},
    ipc: { handle: (name: string, handler: (event: unknown, value: unknown) => unknown) => this.startupIpc.set(name, handler) },
    session: { setPermissionRequestHandler() {}, setPermissionCheckHandler() {}, setDisplayMediaRequestHandler() {} },
    executeJavaScript: async (script: string) => {
      if (script.includes('getBoundingClientRect')) return { height: measuredTextHeight, controlsHeight: 20, inputHeight: 0 };
      await panelPaint;
    }
  });
  constructor({ x, y, width, height, minWidth, minHeight }: Electron.Rectangle & { minWidth: number; minHeight: number }) {
    super();
    this.bounds = { x, y, width, height };
    this.normalBounds = this.bounds;
    this.compositorSize = { width, height };
    this.minimum = { width: minWidth, height: minHeight };
  }
  getBounds() { return { ...this.bounds }; }
  getNormalBounds() { return { ...this.normalBounds }; }
  getContentBounds() { return this.getBounds(); }
  getNativeWindowHandle() { return Buffer.alloc(8); }
  getTitle() { return 'SC'; }
  getSize() { return { width: this.bounds.width, height: this.bounds.height }; }
  getCompositorSize() { return this.compositorSize; }
  confirmPanelSize() { this.compositorSize = this.getSize(); }
  setBounds(bounds: Electron.Rectangle, updateCompositor = !deferPanelConfigure) {
    const { width, height } = this.bounds;
    this.bounds = {
      ...bounds,
      width: Math.min(this.maximum.width, Math.max(this.minimum.width, bounds.width)),
      height: Math.min(this.maximum.height, Math.max(this.minimum.height, bounds.height))
    };
    if (updateCompositor) this.compositorSize = this.getSize();
    if (this.bounds.width !== width || this.bounds.height !== height) this.emit('resize');
  }
  getMaximumSize() { return this.maximum; }
  setMinimumSize(width: number, height: number) {
    this.minimum = { width, height };
    this.setBounds(this.bounds);
  }
  setMaximumSize(width: number, height: number) {
    this.maximum = { width: width || Infinity, height: height || Infinity };
    this.setBounds(this.bounds);
  }
  resizeFromDesktop(size: Electron.Size) { this.setBounds({ ...this.bounds, ...size }, true); }
  configureNormalBounds() { this.setBounds(this.normalBounds); }
  deliverLateConfigure(size: Electron.Size) { this.setBounds({ ...this.bounds, ...size }, false); }
  setMenu() {}
  setContentProtection() {}
  setResizable() {}
  isDestroyed() { return this.destroyed; }
  destroy() { this.destroyed = true; this.emit('closed'); }
  close() { this.destroy(); }
  isMaximized() { return this.hasMapped; }
  isVisible() { return this.visible; }
  isFocused() { return this.focused; }
  show() { this.visible = true; this.hasMapped = true; }
  showInactive() { this.show(); }
  hide() { this.visible = false; }
  focus() {}
  async loadFile(path: string, options?: Electron.LoadFileOptions) {
    if (failStartupRenderer && options?.query?.['window-role'] === 'startup') throw new Error('Renderer load failed');
    this.webContents.mainFrame.url = pathToFileURL(path).href;
    this.webContents.emit('did-finish-load');
  }
}

vi.mock('electron', () => ({
  app, safeStorage: {}, session: {},
  clipboard: { writeText: clipboardWrite, readText: async () => clipboardText },
  BrowserWindow: function (...args: ConstructorParameters<typeof TestWindow>) {
    panel = new TestWindow(...args);
    return panel;
  },
  dialog: { showMessageBoxSync, showErrorBox },
  nativeImage: {
    createFromPath: () => ({
      resize: ({ width, height }: Electron.Size) => ({ toBitmap: () => Buffer.alloc(width * height * 4) })
    }),
    createFromBitmap: (bitmap: Buffer) => ({ toBitmap: () => Buffer.from(bitmap) })
  },
  Menu: { buildFromTemplate: (items: Array<{ label?: string; click?: () => void }>) => items },
  Tray: class extends EventEmitter {
    setToolTip() {}
    setContextMenu(items: Array<{ label?: string; click?: () => void }>) {
      exitFromTray = items.find(item => item.label === 'Exit')?.click;
    }
    setImage = setTrayImage;
    destroy() {}
  },
  ipcMain: { handle: (name: string, listener: (event: unknown, value: unknown) => Promise<unknown>) => ipc.set(name, listener) },
  screen: { getPrimaryDisplay: () => ({ workArea }), getDisplayMatching: () => ({ workArea, scaleFactor }) }
}));
vi.mock('electron-updater', () => ({ default: {} }));
vi.mock(import('node:fs/promises'), async importOriginal => {
  const fs = await importOriginal();
  return { ...fs, rename: async (source, destination) => {
    if (destination === join(profile, 'SC', 'window-size.json')) {
      const write = nextSizeWrite;
      nextSizeWrite = null;
      await write;
    }
    await fs.rename(source, destination);
  } };
});
vi.mock(import('../../src/storage'), async importOriginal => {
  const storage = await importOriginal();
  return {
    ...storage,
    createSettingsStore(platform, directory, options) {
      const store = storage.createSettingsStore(platform, directory, options);
      return {
        ...store,
        saveWindowSize(size) {
          // The resize handler starts this save without awaiting it.
          const write = store.saveWindowSize(size);
          sizeWrites.emit(directory, write);
          return write;
        }
      };
    }
  };
});
vi.mock('../../src/platform', async () => {
  const { createPreviewPlatform } = await import('../../src/main/preview');
  const createPlatform = () => {
    const instance = Symbol();
    return { ...createPreviewPlatform(), ...cryptor,
      acquireInstance: async () => {
        if (instanceOwner) return false;
        instanceOwner = instance;
        return true;
      },
      dispose: () => { if (instanceOwner === instance) instanceOwner = null; }
    };
  };
  const createLinuxPlatform = () => ({ ...createPlatform(), captureSelection: 'portal', captureMonitor: async () => {
    captureVisibility(panel.isVisible());
    throw new Error('Synthetic capture cancelled before acquiring media.');
  } });
  return { createLinuxPlatform, createWindowsPlatform: createPlatform, createLinuxTransport: () => ({}),
    restoreHyprlandPanelPlacement: vi.fn(),
    readHyprlandPanelGeometry: async () => {
      const snapshot = { ...panel.getCompositorSize(), address: '0x1', placement: panelFloating ? 'floating' : 'tiled' };
      const response = nextGeometryResponse;
      nextGeometryResponse = null;
      await response;
      return snapshot;
    } };
});

function pause() {
  let resume!: () => void;
  const pending = new Promise<void>(resolve => { resume = resolve; });
  return { pending, resume };
}
function store() { return createSettingsStore(cryptor, profile, { platform }); }
async function resizeAndWaitForSave(size: Electron.Size, signal: AbortSignal) {
  // A disk read can finish after Vitest has started the next case.
  signal.throwIfAborted();
  const nextSave = once(sizeWrites, profile, { signal });
  panel.resizeFromDesktop(size);
  const [write] = await nextSave;
  expect(await write).toBe(true);
}
async function invoke(name: string, value?: unknown) {
  const handler = ipc.get(`sc:${name}`);
  if (!handler) throw new Error('SC has not registered its IPC handlers.');
  return handler({ sender: panel.webContents, senderFrame: panel.webContents.mainFrame }, value);
}
async function boot() {
  vi.resetModules();
  await import('../../src/main/index');
  await vi.waitFor(async () => expect((await invoke('getState') as AppState).ready).toBe(true));
}
async function close() {
  const exited = once(app, 'quit');
  app.quit();
  await exited;
  app.removeAllListeners();
  ipc.clear();
}
beforeEach(async () => {
  profile = await mkdtemp(join(tmpdir(), 'sc-panel-resize-'));
  scaleFactor = 1;
  measuredTextHeight = 180;
  panelFloating = true;
  panelPaint = null;
  nextGeometryResponse = null;
  nextSizeWrite = null;
  deferPanelConfigure = false;
  instanceOwner = null;
  exitFromTray = undefined;
  failStartupRenderer = false;
  captureVisibility.mockClear();
  clipboardText = 'Unrelated clipboard text';
  vi.stubEnv('LOCALAPPDATA', profile);
  vi.stubEnv('ELECTRON_RENDERER_URL', undefined);
  await store().save(defaultSettings('synthetic-panel-key'));
});
afterEach(async () => {
  await close();
  vi.unstubAllEnvs();
  await rm(profile, { recursive: true, force: true });
});

it('publishes an idle tray image when the panel finishes loading', async () => {
  setTrayImage.mockClear();
  await boot();
  expect(setTrayImage).toHaveBeenCalledWith(expect.objectContaining({ toBitmap: expect.any(Function) }));
});

it('copies only the current Answer diagnostic via its focused window', async () => {
  clipboardWrite.mockClear();
  await boot();
  await invoke('command', { type: 'capture' });
  const first = (await invoke('getState') as AppState).error!;
  const request = { type: 'copyDiagnostic', surface: 'answer', reportId: first.reportId };
  panel.focused = false;
  await expect(invoke('command', request)).rejects.toThrow();
  panel.focused = true;
  await expect(invoke('command', { ...request, surface: 'settings' })).rejects.toThrow();
  await expect(invoke('command', { ...request, text: 'Synthetic API key' })).rejects.toThrow();
  expect(clipboardWrite).not.toHaveBeenCalled();
  clipboardWrite.mockResolvedValueOnce(undefined);
  await expect(invoke('command', request)).rejects.toThrow();
  expect(clipboardText).toBe('Unrelated clipboard text');
  clipboardWrite.mockClear();
  await expect(invoke('command', request)).resolves.toBe('copied');
  expect(clipboardWrite).toHaveBeenCalledExactlyOnceWith(`Code: ${first.code}\nReport ID: ${first.reportId}`);

  await invoke('command', { type: 'capture' });
  const next = (await invoke('getState') as AppState).error!;
  expect(next.reportId).not.toBe(first.reportId);
  await expect(invoke('command', request)).rejects.toThrow();
  expect(clipboardWrite).toHaveBeenCalledTimes(1);
  await expect(invoke('command', { ...request, reportId: next.reportId })).resolves.toBe('copied');
  expect(clipboardWrite).toHaveBeenLastCalledWith(`Code: ${next.code}\nReport ID: ${next.reportId}`);
});

it.skipIf(platform === 'linux')('keeps the Windows startup report available for a failed copy, retry and dismissal', async () => {
  const exitCode = process.exitCode;
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  await writeFile(join(profile, 'SC', 'sc.user.key'), 'synthetic damaged vault');
  clipboardWrite.mockClear().mockResolvedValueOnce(undefined);
  showMessageBoxSync.mockReset().mockReturnValueOnce(0).mockReturnValueOnce(0).mockReturnValueOnce(1);
  try {
    vi.resetModules();
    const exited = once(app, 'quit');
    await import('../../src/main/index');
    await exited;
    const [initial, failed, copied] = showMessageBoxSync.mock.calls.map(([options]) => options);
    expect(initial).toMatchObject({ title: 'SC could not start', buttons: ['Copy diagnostic details', 'Close'], cancelId: 1 });
    expect(initial?.detail).toMatch(/^Code: STARTUP-[A-Z]+\nReport ID: [0-9a-f]{12}$/u);
    expect(failed?.detail).toBe(`${initial?.detail}\n\nCould not copy. Try again.`);
    expect(copied?.detail).toContain(`${initial?.detail}\n\nDiagnostic details copied.`);
    expect(clipboardWrite.mock.calls).toEqual([[initial?.detail], [initial?.detail]]);
    expect(process.exitCode).toBe(1);
  } finally { process.exitCode = exitCode; log.mockRestore(); }
});

it.skipIf(platform !== 'linux')('copies the Linux startup report only from its focused window and permits retry', async () => {
  const exitCode = process.exitCode;
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  await writeFile(join(profile, 'SC', 'sc.linux.key'), 'synthetic damaged vault');
  clipboardWrite.mockClear().mockResolvedValueOnce(undefined);
  try {
    vi.resetModules();
    const exited = once(app, 'quit');
    await import('../../src/main/index');
    await vi.waitFor(() => expect(panel.startupIpc.has('sc:getStartupReport') && panel.isVisible()).toBe(true));
    const startup = panel;
    const event = { sender: startup.webContents, senderFrame: startup.webContents.mainFrame };
    const report = startup.startupIpc.get('sc:getStartupReport')!(event, undefined) as DisplayError;
    expect(report.code).toBe('STARTUP-KEYRING');
    const request = { type: 'copyDiagnostic', surface: 'startup', reportId: report.reportId };
    const command = startup.startupIpc.get('sc:command')!;
    expect(() => command({ ...event, senderFrame: { ...event.senderFrame } }, request)).toThrow();
    expect(() => command(event, { ...request, reportId: '000000000000' })).toThrow();
    startup.focused = false;
    expect(() => command(event, request)).toThrow();
    expect(clipboardWrite).not.toHaveBeenCalled();

    startup.focused = true;
    await expect(command(event, request)).rejects.toThrow();
    await expect(command(event, request)).resolves.toBe('copied');
    const details = `Code: ${report.code}\nReport ID: ${report.reportId}`;
    expect(clipboardWrite.mock.calls).toEqual([[details], [details]]);
    command(event, { type: 'exit' });
    await exited;
    expect(process.exitCode).toBe(1);
  } finally { process.exitCode = exitCode; log.mockRestore(); }
});

it.skipIf(platform !== 'linux')('falls back to a native error box when the Linux startup renderer cannot load', async () => {
  const exitCode = process.exitCode;
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  await writeFile(join(profile, 'SC', 'sc.linux.key'), 'synthetic damaged vault');
  failStartupRenderer = true;
  showErrorBox.mockClear();
  try {
    vi.resetModules();
    const exited = once(app, 'quit');
    await import('../../src/main/index');
    await exited;
    expect(showErrorBox).toHaveBeenCalledExactlyOnceWith('SC could not start', expect.stringMatching(/Code: STARTUP-KEYRING\nReport ID: [\da-f]{12}$/u));
    expect(panel.isDestroyed()).toBe(true);
  } finally { process.exitCode = exitCode; log.mockRestore(); }
});

it.for([
  { scale: 1, savedA: { Width: 480, Height: 200 }, savedB: { Width: 500, Height: 252 } },
  { scale: 1.25, savedA: { Width: 600, Height: 250 }, savedB: { Width: 625, Height: 315 } }
])('remembers a manual return to an automatic size at scale $scale', async ({ scale, savedA, savedB }, { signal }) => {
  scaleFactor = scale;
  const sizeA = { width: 480, height: 200 };
  await boot();
  await vi.waitFor(() => expect(panel.getSize()).toEqual(sizeA));
  expect(await store().loadWindowSize()).toBeNull();

  await resizeAndWaitForSave({ width: 500, height: 252 }, signal);
  expect(await store().loadWindowSize()).toEqual(savedB);

  await resizeAndWaitForSave(sizeA, signal);
  expect(panel.getSize()).toEqual(sizeA);
  expect(await store().loadWindowSize()).toEqual(savedA);

  signal.throwIfAborted();
  await close();
  signal.throwIfAborted();
  // A fresh fit would be taller, so matching A on startup proves restoration.
  measuredTextHeight = 260;
  await boot();
  expect(panel.getSize()).toEqual(sizeA);
});

it('keeps fitting the panel after the input minimum raises its height', async () => {
  measuredTextHeight = 0;
  await boot();
  await vi.waitFor(() => expect(panel.getSize().height).toBe(platform === 'linux' ? 140 : 80));

  measuredTextHeight = 240;
  await invoke('command', { type: 'showInput' });
  await vi.waitFor(() => expect(panel.getSize().height).toBe(260));
  expect(await store().loadWindowSize()).toBeNull();
});

it.skipIf(platform !== 'linux')('ignores the Question minimum when the compositor reports it after fitting', async () => {
  measuredTextHeight = 0;
  await boot();
  await vi.waitFor(() => expect(panel.getSize().height).toBe(140));
  const { width } = panel.getSize();

  measuredTextHeight = 240;
  await invoke('command', { type: 'showInput' });
  await vi.waitFor(() => expect(panel.getSize().height).toBe(260));

  panel.deliverLateConfigure({ width, height: 180 });
  await setImmediate();
  measuredTextHeight = 280;
  await invoke('command', { type: 'escape' });
  await vi.waitFor(() => expect(panel.getSize().height).toBe(300));
  expect(await store().loadWindowSize()).toBeNull();
});

it.skipIf(platform !== 'linux')('accepts a single resize to a settled automatic size', async () => {
  await boot();
  await vi.waitFor(() => expect(panel.getSize()).toEqual({ width: 480, height: 200 }));

  measuredTextHeight = 240;
  await invoke('command', { type: 'showInput' });
  await vi.waitFor(() => expect(panel.getSize()).toEqual({ width: 480, height: 260 }));
  expect(await store().loadWindowSize()).toBeNull();

  panel.resizeFromDesktop({ width: 480, height: 200 });
  await vi.waitFor(async () => expect(await store().loadWindowSize()).toEqual({ Width: 480, Height: 200 }));
});

it.skipIf(platform !== 'linux')('restores a saved floating size when the compositor returns different geometry', async () => {
  await boot();
  await vi.waitFor(() => expect(panel.getSize().height).toBe(200));
  panel.resizeFromDesktop({ width: 530, height: 240 });
  const chosen = { Width: 530, Height: 240 };
  await vi.waitFor(async () => expect(await store().loadWindowSize()).toEqual(chosen));

  panelFloating = false;
  panel.resizeFromDesktop({ width: 900, height: 680 });
  await setImmediate();
  expect(await store().loadWindowSize()).toEqual(chosen);

  panelFloating = true;
  panel.resizeFromDesktop({ width: 560, height: 260 });
  await vi.waitFor(() => expect(panel.getSize()).toEqual({ width: 530, height: 240 }));
  expect(await store().loadWindowSize()).toEqual(chosen);
});

it.skipIf(platform !== 'linux')('accepts a native resize immediately after Escape leaves the bounds unchanged', async () => {
  await store().save({ ...defaultSettings('synthetic-panel-key'), CommandsShown: true });
  await store().saveWindowSize({ Width: 530, Height: 240 });
  await boot();
  await setImmediate();
  expect((await invoke('getState') as AppState).surface).toBe('input');
  expect(panel.getSize()).toEqual({ width: 530, height: 240 });

  let finishPaint!: () => void;
  panelPaint = new Promise(resolve => { finishPaint = resolve; });
  try {
    await invoke('command', { type: 'escape' });
    expect(panel.getSize()).toEqual({ width: 530, height: 240 });
    panel.resizeFromDesktop({ width: 380, height: 160 });
    await vi.waitFor(async () => expect(await store().loadWindowSize()).toEqual({ Width: 380, Height: 160 }));
  } finally {
    finishPaint();
  }
});

it.skipIf(platform !== 'linux').each([true, false])(
  'validates a resize before the release repaint (matching compositor size: %s)', async matching => {
    await boot();
    await vi.waitFor(() => expect(panel.getSize()).toEqual({ width: 480, height: 200 }));
    const constraintPaint = pause();
    const releasePaint = pause();
    panelPaint = constraintPaint.pending;
    const resizable = vi.spyOn(panel, 'setResizable');
    try {
      measuredTextHeight = 240;
      await invoke('command', { type: 'showInput' });
      await vi.waitFor(() => expect(panel.getSize()).toEqual({ width: 480, height: 260 }));
      panelPaint = releasePaint.pending;
      constraintPaint.resume();
      await vi.waitFor(() => expect(resizable).toHaveBeenLastCalledWith(true));

      const size = { width: 500, height: 252 };
      if (matching) panel.resizeFromDesktop(size);
      else panel.deliverLateConfigure(size);
      expect(panel.getSize()).toEqual(size);
      if (matching) {
        await vi.waitFor(async () => expect(await store().loadWindowSize()).toEqual({ Width: 500, Height: 252 }));
      } else {
        measuredTextHeight = 280;
        await invoke('command', { type: 'escape' });
        await vi.waitFor(() => expect(panel.getSize().height).toBe(300));
        expect(await store().loadWindowSize()).toBeNull();
      }
    } finally {
      constraintPaint.resume();
      releasePaint.resume();
    }
  });

it.skipIf(platform !== 'linux').each([true, false])(
  'validates a resize during same-profile remap (matching compositor size: %s)', async matching => {
    const previous = { Width: 530, Height: 240 };
    await store().save({ ...defaultSettings('synthetic-panel-key'), CommandsShown: true });
    await store().saveWindowSize(previous);
    const paint = pause();
    const confirmation = pause();
    panelPaint = paint.pending;
    try {
      await boot();
      expect(panel.isVisible()).toBe(true);
      expect(panel.getSize()).toEqual({ width: 530, height: 240 });
      nextGeometryResponse = confirmation.pending;
      const size = { width: 500, height: 252 };
      if (matching) panel.resizeFromDesktop(size);
      else panel.deliverLateConfigure(size);
      paint.resume();
      await setImmediate();
      confirmation.resume();
      if (matching) {
        await vi.waitFor(async () => expect(await store().loadWindowSize()).toEqual({ Width: 500, Height: 252 }));
        expect(panel.getSize()).toEqual(size);
      } else {
        await vi.waitFor(() => expect(panel.getSize()).toEqual({ width: 530, height: 240 }));
        expect(await store().loadWindowSize()).toEqual(previous);
      }
    } finally {
      paint.resume();
      confirmation.resume();
    }
  });

it.skipIf(platform !== 'linux').each([true, false])(
  'finishes checking a visible resize after Hide (matching compositor size: %s)', async matching => {
    const previous = { Width: 530, Height: 240 };
    await store().saveWindowSize(previous);
    await boot();
    await setImmediate();
    const confirmation = pause();
    nextGeometryResponse = confirmation.pending;
    try {
      const size = { width: 500, height: 252 };
      if (matching) panel.resizeFromDesktop(size);
      else panel.deliverLateConfigure(size);
      expect(nextGeometryResponse).toBeNull();
      await invoke('command', { type: 'toggleVisibility' });
      expect(panel.isVisible()).toBe(false);
      expect(await store().loadWindowSize()).toEqual(previous);
    } finally {
      confirmation.resume();
    }
    if (matching) {
      await vi.waitFor(async () => expect(await store().loadWindowSize()).toEqual({ Width: 500, Height: 252 }));
    } else {
      await invoke('command', { type: 'toggleVisibility' });
      await vi.waitFor(() => expect(panel.getSize()).toEqual({ width: 530, height: 240 }));
      expect(await store().loadWindowSize()).toEqual(previous);
    }
  });

it.skipIf(platform !== 'linux').each([false, true])(
  'ignores the initial remap bounds and saves a later resize to that size (earlier stale event: %s)', async stale => {
    const previous = { Width: 530, Height: 240 };
    await store().saveWindowSize(previous);
    await boot();
    await setImmediate();
    await invoke('command', { type: 'toggleVisibility' });
    const paint = pause();
    panelPaint = paint.pending;
    try {
      await invoke('command', { type: 'toggleVisibility' });
      if (stale) panel.deliverLateConfigure({ width: 503, height: 264 });
      panel.configureNormalBounds();
      expect(panel.getSize()).toEqual({ width: 420, height: 180 });
      paint.resume();
      await vi.waitFor(() => expect(panel.getSize()).toEqual({ width: 530, height: 240 }));
      expect(await store().loadWindowSize()).toEqual(previous);
    } finally {
      paint.resume();
    }

    await setImmediate();
    panel.configureNormalBounds();
    await vi.waitFor(async () => expect(await store().loadWindowSize()).toEqual({ Width: 420, Height: 180 }));
  });

it.skipIf(platform !== 'linux')('observes a Wayland map that is still absent on the first two queries', async () => {
  await store().saveWindowSize({ Width: 530, Height: 238 });
  await boot();
  await setImmediate();
  await invoke('command', { type: 'toggleVisibility' });
  const paint = pause();
  panelPaint = paint.pending;
  vi.stubEnv('HYPRLAND_INSTANCE_SIGNATURE', 'isolated-test');
  const geometry = vi.spyOn(await import('../../src/platform'), 'readHyprlandPanelGeometry')
    .mockResolvedValueOnce(null).mockResolvedValueOnce(null);
  try {
    await invoke('command', { type: 'toggleVisibility' });
    panel.configureNormalBounds();
    await vi.waitFor(() => expect(geometry.mock.calls.length).toBeGreaterThanOrEqual(3));
    await resizeAndWaitForSave({ width: 480, height: 144 }, AbortSignal.timeout(2000));
    expect(await store().loadWindowSize()).toEqual({ Width: 480, Height: 144 });
  } finally {
    paint.resume();
    geometry.mockRestore();
  }
});

it.skipIf(platform !== 'linux')('saves a resize to the old normal bounds after a user resize settles the remap', async () => {
  await store().saveWindowSize({ Width: 530, Height: 240 });
  await boot();
  await setImmediate();
  await invoke('command', { type: 'toggleVisibility' });
  const paint = pause();
  panelPaint = paint.pending;
  try {
    await invoke('command', { type: 'toggleVisibility' });
    panel.setBounds({ ...panel.getNormalBounds(), width: 510, height: 252 });
    await vi.waitFor(async () => expect(await store().loadWindowSize()).toEqual({ Width: 510, Height: 252 }));
  } finally {
    paint.resume();
  }

  await setImmediate();
  panel.configureNormalBounds();
  await vi.waitFor(async () => expect(await store().loadWindowSize()).toEqual({ Width: 420, Height: 180 }));
});

it.skipIf(platform !== 'linux').each([true, false])(
  'checks a later resize to normal bounds before the remap settles (matching compositor size: %s)', async matching => {
    const previous = { Width: 530, Height: 240 };
    const first = { width: 510, height: 252 };
    await store().saveWindowSize(previous);
    await boot();
    await setImmediate();
    await invoke('command', { type: 'toggleVisibility' });
    const paint = pause();
    const confirmation = pause();
    panelPaint = paint.pending;
    const normal = panel.getNormalBounds();
    const normalSize = { width: normal.width, height: normal.height };
    try {
      await invoke('command', { type: 'toggleVisibility' });
      nextGeometryResponse = confirmation.pending;
      panel.setBounds({ ...normal, ...first }, true);
      expect(nextGeometryResponse).toBeNull();
      panel.setBounds(normal, matching);
      expect(panel.getSize()).toEqual(normalSize);
      expect(panel.getCompositorSize()).toEqual(matching ? normalSize : first);
      expect(await store().loadWindowSize()).toEqual(previous);
    } finally {
      confirmation.resume();
      paint.resume();
    }

    const size = matching ? normalSize : first;
    const saved = { Width: size.width, Height: size.height };
    await vi.waitFor(async () => expect({ visible: panel.getSize(), compositor: panel.getCompositorSize(), saved: await store().loadWindowSize() })
      .toEqual({ visible: size, compositor: size, saved }));
    await close();
    await boot();
    expect(panel.getSize()).toEqual(size);
  });

it.skipIf(platform !== 'linux').each([
  { painted: true, stale: false }, { painted: false, stale: false }, { painted: true, stale: true }
])('saves and restores a matching resize after Hide and Show (painted: $painted, stale event: $stale)', async ({ painted, stale }) => {
    const previous = { Width: 530, Height: 240 };
    await store().saveWindowSize(previous);
    await boot();
    await setImmediate();
    const confirmation = pause();
    const paint = pause();
    nextGeometryResponse = confirmation.pending;
    const size = { width: 510, height: 252 };
    try {
      panel.resizeFromDesktop(size);
      expect(nextGeometryResponse).toBeNull();
      if (stale) panel.deliverLateConfigure({ width: 503, height: 264 });
      await invoke('command', { type: 'toggleVisibility' });
      expect(panel.isVisible()).toBe(false);
      if (!painted) panelPaint = paint.pending;
      await invoke('command', { type: 'toggleVisibility' });
      expect(panel.isVisible()).toBe(true);
      panel.configureNormalBounds();
      await setImmediate();
      expect(await store().loadWindowSize()).toEqual(previous);

      confirmation.resume();
      paint.resume();
      await vi.waitFor(async () => expect({ visible: panel.getSize(), saved: await store().loadWindowSize() })
        .toEqual({ visible: size, saved: { Width: 510, Height: 252 } }));
    } finally {
      confirmation.resume();
      paint.resume();
    }
  });

it.skipIf(platform !== 'linux').each([false, true])(
  'restores the latest of two real resizes after Hide and Show (replies reversed: %s)', async reversed => {
    const previous = { Width: 530, Height: 240 };
    const latest = { width: 503, height: 264 };
    const saved = { Width: 503, Height: 264 };
    await store().saveWindowSize(previous);
    await boot();
    await setImmediate();
    const older = pause();
    const newer = pause();
    try {
      nextGeometryResponse = older.pending;
      panel.resizeFromDesktop({ width: 510, height: 252 });
      nextGeometryResponse = newer.pending;
      panel.resizeFromDesktop(latest);
      expect(panel.getCompositorSize()).toEqual(latest);
      await invoke('command', { type: 'toggleVisibility' });
      await invoke('command', { type: 'toggleVisibility' });
      panel.configureNormalBounds();
      expect(await store().loadWindowSize()).toEqual(previous);

      const [firstReply, lastReply] = reversed ? [newer, older] as const : [older, newer] as const;
      firstReply.resume();
      await setImmediate();
      lastReply.resume();
      await vi.waitFor(async () => expect({ visible: panel.getSize(), saved: await store().loadWindowSize() })
        .toEqual({ visible: latest, saved }));
    } finally {
      newer.resume();
      older.resume();
    }

    await close();
    await boot();
    expect(panel.getSize()).toEqual(latest);
    expect(await store().loadWindowSize()).toEqual(saved);
  });

it.skipIf(platform !== 'linux')('keeps the new map resize when the prior map confirmation arrives late', async () => {
  await store().saveWindowSize({ Width: 530, Height: 240 });
  await boot();
  await setImmediate();
  const confirmation = pause();
  nextGeometryResponse = confirmation.pending;
  try {
    panel.resizeFromDesktop({ width: 500, height: 252 });
    expect(nextGeometryResponse).toBeNull();
    await invoke('command', { type: 'toggleVisibility' });
    await invoke('command', { type: 'toggleVisibility' });
    panel.resizeFromDesktop({ width: 510, height: 250 });
    const newest = { Width: 510, Height: 250 };
    await vi.waitFor(async () => expect(await store().loadWindowSize()).toEqual(newest));

    confirmation.resume();
    await setImmediate();
    expect(await store().loadWindowSize()).toEqual(newest);
    expect(panel.getSize()).toEqual({ width: 510, height: 250 });
  } finally {
    confirmation.resume();
  }
});

it.skipIf(platform !== 'linux').each([true, false])(
  'finishes a pending resize after quick Hide, Show and Exit (matching compositor size: %s)', async matching => {
    const previous = { Width: 530, Height: 240 };
    const size = { width: 510, height: 252 };
    await store().saveWindowSize(previous);
    await boot();
    await setImmediate();
    const confirmation = pause();
    const exited = once(app, 'quit');
    const onQuit = vi.fn();
    app.once('quit', onQuit);
    try {
      nextGeometryResponse = confirmation.pending;
      if (matching) panel.resizeFromDesktop(size);
      else panel.deliverLateConfigure(size);
      await invoke('command', { type: 'toggleVisibility' });
      await invoke('command', { type: 'toggleVisibility' });
      panel.configureNormalBounds();
      await invoke('command', { type: 'exit' });
      expect(onQuit).not.toHaveBeenCalled();
    } finally {
      confirmation.resume();
    }
    await exited;
    expect(await store().loadWindowSize()).toEqual(matching ? { Width: 510, Height: 252 } : previous);
  });

it.each(['command', 'tray'])('keeps instance ownership until the final rename on %s Exit', async route => {
  const previous = { Width: 530, Height: 240 };
  await store().saveWindowSize(previous);
  await boot();
  await setImmediate();
  const owner = instanceOwner;
  expect(owner).toBeTypeOf('symbol');
  const write = pause();
  const exited = once(app, 'quit');
  try {
    nextSizeWrite = write.pending;
    panel.resizeFromDesktop({ width: 510, height: 252 });
    await vi.waitFor(() => expect(nextSizeWrite).toBeNull());
    if (route === 'tray') exitFromTray!();
    else await invoke('command', { type: 'exit' });
    expect(instanceOwner).toBe(owner);
    expect(await store().loadWindowSize()).toEqual(previous);
  } finally {
    write.resume();
    await exited;
  }
  expect(instanceOwner).toBeNull();
  expect(await store().loadWindowSize()).toEqual({ Width: 510, Height: 252 });
  await close();
  await boot();
  expect(panel.getSize()).toEqual({ width: 510, height: 252 });
});

it('abandons a final rename at the quit deadline before a successor saves', async () => {
  const previous = { Width: 530, Height: 240 };
  await store().saveWindowSize(previous);
  await boot();
  await setImmediate();
  const write = pause();
  const nextSave = once(sizeWrites, profile);
  try {
    nextSizeWrite = write.pending;
    panel.resizeFromDesktop({ width: 510, height: 252 });
    await vi.waitFor(() => expect(nextSizeWrite).toBeNull());
    const exited = once(app, 'quit', { signal: AbortSignal.timeout(2500) });
    exitFromTray!();
    await exited;
    await vi.waitFor(() => expect(instanceOwner).toBeNull());
    await close();
    await boot();
    expect(panel.getSize()).toEqual({ width: 530, height: 240 });
    await resizeAndWaitForSave({ width: 550, height: 248 }, AbortSignal.timeout(2500));
  } finally {
    write.resume();
  }
  const [abandoned] = await nextSave;
  expect(await abandoned).toBe(false);
  expect(await store().loadWindowSize()).toEqual({ Width: 550, Height: 248 });
});

it.skipIf(platform !== 'linux')('hides the panel before an ordinary capture reaches the platform', async () => {
  await boot();
  expect(panel.isVisible()).toBe(true);
  await invoke('command', { type: 'capture' });
  expect(captureVisibility.mock.calls).toEqual([[false]]);
});

it.skipIf(platform !== 'linux')('stops commands on tray Exit while draining a confirmed resize', async () => {
  const previous = { Width: 530, Height: 240 };
  await store().saveWindowSize(previous);
  await boot();
  await setImmediate();
  const confirmation = pause();
  const exited = once(app, 'quit');
  const onQuit = vi.fn();
  app.once('quit', onQuit);
  try {
    nextGeometryResponse = confirmation.pending;
    panel.resizeFromDesktop({ width: 510, height: 252 });
    expect(nextGeometryResponse).toBeNull();
    expect(exitFromTray).toBeTypeOf('function');
    exitFromTray?.();
    expect(onQuit).not.toHaveBeenCalled();
    expect(await store().loadWindowSize()).toEqual(previous);
    await invoke('command', { type: 'capture' });
  } finally {
    confirmation.resume();
  }
  await exited;
  expect(onQuit).toHaveBeenCalledOnce();
  expect(await store().loadWindowSize()).toEqual({ Width: 510, Height: 252 });
  expect(captureVisibility).not.toHaveBeenCalled();
});

it.skipIf(platform !== 'linux')('exits with the saved size when a pending compositor reply misses the quit deadline', async () => {
  const previous = { Width: 530, Height: 240 };
  await store().saveWindowSize(previous);
  await boot();
  await setImmediate();
  const confirmation = pause();
  const onQuit = vi.fn();
  app.once('quit', onQuit);
  try {
    nextGeometryResponse = confirmation.pending;
    panel.resizeFromDesktop({ width: 510, height: 252 });
    await invoke('command', { type: 'exit' });
    expect(onQuit).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(onQuit).toHaveBeenCalledOnce(), { timeout: 2500 });
  } finally {
    confirmation.resume();
  }
  await setImmediate();
  expect(await store().loadWindowSize()).toEqual(previous);
});

it.skipIf(platform !== 'linux')('keeps fit constraints until the compositor accepts the fit', async () => {
  await boot();
  await vi.waitFor(() => expect(panel.getSize()).toEqual({ width: 480, height: 200 }));
  const firstPaint = pause();
  const nextPaint = pause();
  const repaint = vi.spyOn(panel.webContents, 'invalidate');
  const fit = { width: 480, height: 260 };
  deferPanelConfigure = true;
  panelPaint = firstPaint.pending;
  try {
    measuredTextHeight = 240;
    await invoke('command', { type: 'showInput' });
    await vi.waitFor(() => expect(panel.getSize()).toEqual(fit));
    expect(panel.getCompositorSize()).toEqual({ width: 480, height: 200 });
    panelPaint = nextPaint.pending;
    firstPaint.resume();
    await setImmediate();
    expect(panel.getMaximumSize()).toEqual(fit);

    panel.confirmPanelSize();
    nextPaint.resume();
    await vi.waitFor(() => expect(panel.getMaximumSize()).toEqual({ width: Infinity, height: Infinity }));
    expect(repaint).toHaveBeenCalledTimes(2);
    expect(await store().loadWindowSize()).toBeNull();
  } finally {
    firstPaint.resume();
    nextPaint.resume();
  }
});

it.runIf(platform === 'linux')('waits for the Linux shortcut clipboard write and lets a failed copy be retried', async () => {
  await boot();
  await invoke('command', { type: 'settings' });
  const write = vi.mocked((await import('electron')).clipboard.writeText);
  const command = { type: 'copyLinuxCommand', action: 'input' };
  const expected = '/opt/SC/io.github.ziyadin23.sc --action=input';
  const gate = pause();
  write.mockReturnValueOnce(gate.pending);
  const completed = vi.fn();
  const response = invoke('command', command).then(completed);
  try {
    await setImmediate();
    expect(write).toHaveBeenCalledWith(expected);
    expect(completed).not.toHaveBeenCalled();
  } finally {
    gate.resume();
    await response;
  }
  expect(completed).toHaveBeenCalledWith('copied');

  write.mockRejectedValueOnce(new Error('Synthetic clipboard denial'));
  await expect(invoke('command', command)).rejects.toThrow();
  write.mockResolvedValueOnce(undefined);
  await expect(invoke('command', command)).resolves.toBe('copied');
  expect(write).toHaveBeenLastCalledWith(expected);
});
