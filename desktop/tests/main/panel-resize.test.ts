import { EventEmitter } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setImmediate } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { AppState } from '../../src/contracts';
import { defaultSettings } from '../../src/contracts/defaults';
import { createSettingsStore } from '../../src/storage';

// Run the real main entry point, controller and size store without a desktop or keyring.
const cryptor = {
  protectData: (data: Buffer) => Buffer.from(data).reverse(),
  unprotectData: (data: Buffer) => Buffer.from(data).reverse()
};
const platform = process.platform === 'linux' ? 'linux' : 'windows';
const workArea = { x: 0, y: 0, width: 900, height: 700 };
let profile: string;
let scaleFactor: number;
let measuredTextHeight: number;
let panel: TestWindow;
let panelFloating: boolean;
let panelPaint: Promise<void> | null;
let nextGeometryResponse: Promise<void> | null;
let deferPanelConfigure: boolean;

const ipc = new Map<string, (event: unknown, value: unknown) => Promise<unknown>>();
const app = Object.assign(new EventEmitter(), {
  isPackaged: false, whenReady: async () => {}, getPath: () => profile,
  setDesktopName() {}, setAppUserModelId() {}, commandLine: { appendSwitch() {} },
  quit() { app.emit('before-quit'); }
});

class TestWindow extends EventEmitter {
  private readonly normalBounds: Electron.Rectangle;
  private bounds: Electron.Rectangle;
  private compositorSize: Electron.Size;
  private minimum: Electron.Size;
  private maximum = { width: Infinity, height: Infinity };
  private visible = false;
  private hasMapped = false;
  readonly webContents = Object.assign(new EventEmitter(), {
    mainFrame: { url: '' }, send() {}, setWindowOpenHandler() {}, invalidate() {},
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
  isDestroyed() { return false; }
  isMaximized() { return this.hasMapped; }
  isVisible() { return this.visible; }
  show() { this.visible = true; this.hasMapped = true; }
  showInactive() { this.show(); }
  hide() { this.visible = false; }
  focus() {}
  async loadFile(path: string) {
    this.webContents.mainFrame.url = pathToFileURL(path).href;
    this.webContents.emit('did-finish-load');
  }
}

vi.mock('electron', () => ({
  app, safeStorage: {}, session: {},
  BrowserWindow: function (...args: ConstructorParameters<typeof TestWindow>) {
    panel = new TestWindow(...args);
    return panel;
  },
  dialog: { showErrorBox: vi.fn() }, nativeImage: { createFromBuffer() {} },
  Menu: { buildFromTemplate() {} },
  Tray: class extends EventEmitter {
    setToolTip() {}
    setContextMenu() {}
    setImage() {}
    destroy() {}
  },
  ipcMain: { handle: (name: string, listener: (event: unknown, value: unknown) => Promise<unknown>) => ipc.set(name, listener) },
  screen: { getPrimaryDisplay: () => ({ workArea }), getDisplayMatching: () => ({ workArea, scaleFactor }) }
}));
vi.mock('electron-updater', () => ({ default: {} }));
vi.mock('../../src/platform', async () => {
  const { createPreviewPlatform } = await import('../../src/main/preview');
  const createPlatform = () => ({ ...createPreviewPlatform(), ...cryptor });
  return { createLinuxPlatform: createPlatform, createWindowsPlatform: createPlatform, createLinuxTransport: () => ({}),
    restoreHyprlandPanelTiling: vi.fn(),
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
function close() {
  app.quit();
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
  deferPanelConfigure = false;
  vi.stubEnv('LOCALAPPDATA', profile);
  vi.stubEnv('ELECTRON_RENDERER_URL', undefined);
  await store().save(defaultSettings('synthetic-panel-key'));
});
afterEach(async () => {
  close();
  vi.unstubAllEnvs();
  await rm(profile, { recursive: true, force: true });
});

it.each([
  { scale: 1, savedA: { Width: 480, Height: 200 }, savedB: { Width: 500, Height: 252 } },
  { scale: 1.25, savedA: { Width: 600, Height: 250 }, savedB: { Width: 625, Height: 315 } }
])('remembers a manual return to an automatic size at scale $scale', async ({ scale, savedA, savedB }) => {
  scaleFactor = scale;
  const sizeA = { width: 480, height: 200 };
  await boot();
  await vi.waitFor(() => expect(panel.getSize()).toEqual(sizeA));
  expect(await store().loadWindowSize()).toBeNull();

  panel.resizeFromDesktop({ width: 500, height: 252 });
  await vi.waitFor(async () => expect(await store().loadWindowSize()).toEqual(savedB));

  panel.resizeFromDesktop(sizeA);
  expect(panel.getSize()).toEqual(sizeA);
  await vi.waitFor(async () => expect(await store().loadWindowSize()).toEqual(savedA));

  close();
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
