import { EventEmitter } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
const setTrayImage = vi.fn();
let profile: string;
let scaleFactor: number;
let measuredTextHeight: number;
let panel: TestWindow;

const ipc = new Map<string, (event: unknown, value: unknown) => Promise<unknown>>();
const app = Object.assign(new EventEmitter(), {
  isPackaged: false, whenReady: async () => {}, getPath: () => profile,
  setDesktopName() {}, setAppUserModelId() {}, commandLine: { appendSwitch() {} },
  quit() { app.emit('before-quit'); }
});

class TestWindow extends EventEmitter {
  private bounds: Electron.Rectangle;
  private minimum: Electron.Size;
  private visible = false;
  readonly webContents = Object.assign(new EventEmitter(), {
    mainFrame: { url: '' }, send() {}, setWindowOpenHandler() {},
    session: { setPermissionRequestHandler() {}, setPermissionCheckHandler() {}, setDisplayMediaRequestHandler() {} },
    executeJavaScript: async () => ({ height: measuredTextHeight, controlsHeight: 20, inputHeight: 0 })
  });
  constructor({ x, y, width, height, minWidth, minHeight }: Electron.Rectangle & { minWidth: number; minHeight: number }) {
    super();
    this.bounds = { x, y, width, height };
    this.minimum = { width: minWidth, height: minHeight };
  }
  getBounds() { return { ...this.bounds }; }
  getContentBounds() { return this.getBounds(); }
  getNativeWindowHandle() { return Buffer.alloc(8); }
  getSize() { return { width: this.bounds.width, height: this.bounds.height }; }
  setBounds(bounds: Electron.Rectangle) {
    const { width, height } = this.bounds;
    this.bounds = {
      ...bounds,
      width: Math.max(this.minimum.width, bounds.width),
      height: Math.max(this.minimum.height, bounds.height)
    };
    if (this.bounds.width !== width || this.bounds.height !== height) this.emit('resize');
  }
  setMinimumSize(width: number, height: number) {
    this.minimum = { width, height };
    this.setBounds(this.bounds);
  }
  resizeFromDesktop(size: Electron.Size) { this.setBounds({ ...this.bounds, ...size }); }
  setMenu() {}
  setContentProtection() {}
  setResizable() {}
  isDestroyed() { return false; }
  isVisible() { return this.visible; }
  show() { this.visible = true; }
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
  dialog: { showErrorBox: vi.fn() },
  nativeImage: {
    createFromPath: () => ({
      resize: ({ width, height }: Electron.Size) => ({ toBitmap: () => Buffer.alloc(width * height * 4) })
    }),
    createFromBitmap: (bitmap: Buffer) => ({ toBitmap: () => Buffer.from(bitmap) })
  },
  Menu: { buildFromTemplate() {} },
  Tray: class extends EventEmitter {
    setToolTip() {}
    setContextMenu() {}
    setImage = setTrayImage;
    destroy() {}
  },
  ipcMain: { handle: (name: string, listener: (event: unknown, value: unknown) => Promise<unknown>) => ipc.set(name, listener) },
  screen: { getPrimaryDisplay: () => ({ workArea }), getDisplayMatching: () => ({ workArea, scaleFactor }) }
}));
vi.mock('electron-updater', () => ({ default: {} }));
vi.mock('../../src/platform', async () => {
  const { createPreviewPlatform } = await import('../../src/main/preview');
  const createPlatform = () => ({ ...createPreviewPlatform(), ...cryptor });
  return { createLinuxPlatform: createPlatform, createWindowsPlatform: createPlatform, createLinuxTransport: () => ({}) };
});

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
  vi.stubEnv('LOCALAPPDATA', profile);
  vi.stubEnv('ELECTRON_RENDERER_URL', undefined);
  await store().save(defaultSettings('synthetic-panel-key'));
});
afterEach(async () => {
  close();
  vi.unstubAllEnvs();
  await rm(profile, { recursive: true, force: true });
});

it('publishes an idle tray image when the panel finishes loading', async () => {
  setTrayImage.mockClear();
  await boot();
  expect(setTrayImage).toHaveBeenCalledWith(expect.objectContaining({ toBitmap: expect.any(Function) }));
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
