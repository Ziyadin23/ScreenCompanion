import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, safeStorage, screen, session, Tray } from 'electron';
import electronUpdater from 'electron-updater';
import { dirname, join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import type { AppState, PanelSize, SettingsStore, WindowsPlatform } from '../contracts';
import { createLinuxPlatform, createLinuxTransport, createWindowsPlatform, readHyprlandPanelGeometry } from '../platform';
import { createLinuxCryptor, createSettingsStore, SettingsError, validateSettings } from '../storage';
import { createPipelineRunner, loadPipelineConfiguration, withSavedSettings } from '../pipeline';
import { ApplicationController, canResizePanel, isPanelSurface as isPanel } from './controller';
import { createDiagnostics, AppError } from './diagnostics';
import { commandSchema, colorSchema, settingsDraftSchema, setupRequestSchema, updateActionSchema } from './validation';
import { ApplicationUpdates } from './updates';
import { createPreviewPlatform, createPreviewStore } from './preview';
import { createPortalCapture } from './linux-capture';
import { autoPanelHeight } from './panel-size';
import packageManifest from '../../package.json';

const directory = fileURLToPath(new URL('.', import.meta.url));
const synthetic = process.argv.includes('--synthetic-ui');
const captureTest = process.argv.includes('--capture-test-only');
const linux = process.platform === 'linux';
const preview = synthetic || (captureTest && process.platform !== 'win32' && !linux);
const version = packageManifest.version;
const afterPanelPaint = 'new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))';
if (process.platform === 'win32') app.setAppUserModelId(packageManifest.build.appId);
if (linux) {
  app.setDesktopName('io.github.ziyadin23.sc.desktop');
  app.commandLine.appendSwitch('ozone-platform', 'wayland');
  app.commandLine.appendSwitch('enable-features', 'WebRTCPipeWireCapturer');
  app.commandLine.appendSwitch('password-store', 'gnome-libsecret');
}
const localData = linux ? app.getPath('appData') : process.env.LOCALAPPDATA;
const diagnostics = createDiagnostics(preview ? null : localData ? join(localData, 'SC') : null, version);
let controller: ApplicationController | null = null;
let updates: ApplicationUpdates | null = null;
let platform: WindowsPlatform | null = null;
let window: BrowserWindow | null = null;
let linuxDialog: { window: BrowserWindow; surface: AppState['surface']; ready: boolean } | null = null;
let releaseLinuxPanelSize: (() => void) | null = null;
let tray: Tray | null = null;
let closing = false;
let readyToShow = false;
let panelBounds: Electron.Rectangle | null = null;
let linuxPreferredPanelBounds: Electron.Rectangle | null = null;
let surface: AppState['surface'] = 'answer';
let lastCaptureProtection: AppState['captureProtection'] = 'Failed';
let composerHeight = 96;
let activationPending = false;
let manualPanelSize = false;
let applyingWindowGeometry = false;
let linuxGeometryUpdate: Promise<void> | null = null;
let linuxPanelTransition: object | null = null;
let linuxPanelFloating: boolean | null = null;
let pendingLinuxResize: Electron.Rectangle | null = null;
let measurement = 0;
let measuredContent = '';
let captureLinux: (() => Promise<import('../contracts').CapturedFrame>) | undefined;

function trayImage(working: boolean): Electron.NativeImage {
  const size = 24; const pixels = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const at = (y * size + x) * 4;
    if ((x - 12) ** 2 + (y - 12) ** 2 < 100) { pixels[at] = working ? 40 : 210; pixels[at + 1] = working ? 180 : 180; pixels[at + 2] = working ? 250 : 90; pixels[at + 3] = 255; }
  }
  return nativeImage.createFromBuffer(pixels, { width: size, height: size });
}
function clampBounds(bounds: Electron.Rectangle): Electron.Rectangle {
  const area = screen.getDisplayMatching(bounds).workArea;
  const width = Math.min(Math.max(linux ? 340 : 180, bounds.width), area.width);
  const height = Math.min(Math.max(minimumPanelHeight(), bounds.height), area.height);
  return { width, height, x: Math.max(area.x, Math.min(bounds.x, area.x + area.width - width)), y: Math.max(area.y, Math.min(bounds.y, area.y + area.height - height)) };
}
function minimumPanelHeight(): number { return surface === 'input' ? (linux ? 180 : 128) : linux ? 140 : 80; }
function sameSize(first: Electron.Size, second: Electron.Size): boolean {
  return first.width === second.width && first.height === second.height;
}
function setLinuxPanelMinimum(panel: BrowserWindow): void {
  const area = screen.getDisplayMatching(panel.getBounds()).workArea;
  panel.setMinimumSize(Math.min(340, area.width), Math.min(minimumPanelHeight(), area.height));
}
function waitForLinuxPanelPaint(panel: BrowserWindow): Promise<void> {
  return new Promise(resolve => {
    const finish = () => { clearTimeout(deadline); resolve(); };
    const deadline = setTimeout(finish, 1500);
    void panel.webContents.executeJavaScript(afterPanelPaint).then(finish, finish);
  });
}
function applyWindowGeometry(update: (target: BrowserWindow) => void): void {
  if (!window) return;
  if (linux) pendingLinuxResize = null;
  applyingWindowGeometry = true;
  try {
    update(window);
    // Keep the effective size for any resize notification delivered after the update.
    if (isPanel(surface)) {
      panelBounds = window.getBounds();
      if (linux) {
        // Keep the compositor's follow-up configure in the same geometry update.
        const pending = waitForLinuxPanelPaint(window);
        linuxGeometryUpdate = pending;
        void pending.then(() => { if (linuxGeometryUpdate === pending) linuxGeometryUpdate = null; });
      }
    }
  } finally { applyingWindowGeometry = false; }
}
function hidePanel(): void {
  if (!window) return;
  if (linux && window.isVisible()) {
    releaseLinuxPanelSize?.();
    linuxPanelTransition = null;
    linuxPanelFloating = null;
    pendingLinuxResize = null;
    measuredContent = '';
    measurement++;
  }
  platform?.cancelPanelInteraction(window.getNativeWindowHandle());
  window.hide();
}
function activeWindow(): BrowserWindow | null {
  if (!linux || isPanel(surface)) return window;
  return linuxDialog?.surface === surface ? linuxDialog.window : null;
}
function createWindow(options: Electron.BrowserWindowConstructorOptions): BrowserWindow {
  const target = new BrowserWindow({ title: 'SC', show: false, frame: linux, transparent: true, maximizable: false,
    fullscreenable: false, alwaysOnTop: true, skipTaskbar: !linux, hasShadow: linux,
    webPreferences: { preload: join(directory, '../preload/index.cjs'), partition: 'sc-ephemeral', sandbox: true,
      contextIsolation: true, nodeIntegration: false, spellcheck: false, backgroundThrottling: false }, ...options });
  target.setMenu(null);
  if (!linux) target.setContentProtection(true);
  target.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  target.webContents.on('will-navigate', event => event.preventDefault());
  target.on('close', event => {
    if (closing) return;
    event.preventDefault();
    if (target === activeWindow()) void controller?.command({ type: 'toggleVisibility' });
  });
  target.on('blur', () => { void controller?.command({ type: 'recordShortcut', recording: false }); });
  return target;
}
function loadRenderer(target: BrowserWindow, role?: 'panel' | 'dialog'): Promise<void> {
  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    const url = new URL(process.env.ELECTRON_RENDERER_URL);
    if (role) url.searchParams.set('window-role', role);
    return target.loadURL(url.href);
  }
  return target.loadFile(join(directory, '../renderer/index.html'), role ? { query: { 'window-role': role } } : undefined);
}
function publishLinuxDialog(state: AppState, capturing: boolean): void {
  if (readyToShow && isPanel(surface) && window) {
    window.webContents.send('sc:state', state);
  }
  surface = state.surface;
  hidePanel();
  if (readyToShow && state.visible && !capturing && linuxDialog?.surface !== state.surface && window) {
    // Wayland can keep a toplevel's previous size after a resize request.
    // Give Setup and Settings their own toplevel so the panel keeps its geometry.
    linuxDialog?.window.destroy();
    const area = screen.getDisplayMatching(window.getBounds()).workArea;
    const target = createWindow({
      title: state.surface === 'setup' ? 'SC Setup' : 'SC Settings',
      width: Math.min(state.surface === 'setup' ? 560 : 760, area.width),
      height: Math.min(state.surface === 'setup' ? 480 : 680, area.height),
      resizable: false
    });
    target.on('page-title-updated', event => event.preventDefault());
    const dialog = { window: target, surface: state.surface, ready: false };
    linuxDialog = dialog;
    target.webContents.once('did-finish-load', () => {
      if (closing || linuxDialog !== dialog || target.isDestroyed()) return;
      dialog.ready = true;
      if (surface === dialog.surface) controller?.publish();
    });
    void loadRenderer(target, 'dialog').catch(error => { if (linuxDialog === dialog) startupFailure(error); });
  }
  if (linuxDialog?.surface !== state.surface || !linuxDialog.ready) return;
  linuxDialog.window.webContents.send('sc:state', state);
  if (capturing || !state.visible) linuxDialog.window.hide();
  else if (!linuxDialog.window.isVisible()) linuxDialog.window.show();
}
function constrainLinuxPanelSize(panel: BrowserWindow, bounds: Electron.Rectangle): void {
  releaseLinuxPanelSize?.();
  // Hyprland can apply the requested size as a temporary constraint.
  applyWindowGeometry(target => {
    target.setMinimumSize(bounds.width, bounds.height);
    target.setMaximumSize(bounds.width, bounds.height);
    target.setBounds(bounds);
  });
  const release = () => {
    if (releaseLinuxPanelSize !== release) return;
    releaseLinuxPanelSize = null;
    if (closing || panel.isDestroyed()) return;
    applyWindowGeometry(target => {
      target.setMaximumSize(0, 0);
      setLinuxPanelMinimum(target);
      // Refresh the mapped Wayland size hints so native drags can resize the panel again.
      target.setResizable(false);
      target.setResizable(true);
    });
  };
  releaseLinuxPanelSize = release;
  void linuxGeometryUpdate?.then(release);
}
async function refreshLinuxPanelLayout(panel: BrowserWindow): Promise<void> {
  // Fixed size hints on map can cause Hyprland to float a tiled panel.
  pendingLinuxResize = null;
  const transition = {};
  linuxPanelTransition = transition;
  await waitForLinuxPanelPaint(panel);
  // A Wayland remap can leave the panel absent from the first compositor snapshot.
  let geometry: Awaited<ReturnType<typeof readHyprlandPanelGeometry>> = null;
  for (let attempt = 0; attempt < 3 && linuxPanelTransition === transition && !closing; attempt++) {
    if (attempt) await delay(32);
    if (linuxPanelTransition !== transition || closing || panel.isDestroyed()) break;
    geometry = await readHyprlandPanelGeometry(panel.getTitle());
    if (geometry) break;
  }
  if (linuxPanelTransition !== transition) return;
  linuxPanelTransition = null;
  if (closing || panel.isDestroyed() || !panel.isVisible() || !isPanel(surface)) return;
  panelBounds = panel.getBounds();
  linuxPanelFloating = geometry?.floating ?? null;
  if (!geometry?.floating) return;
  if (linuxPreferredPanelBounds) {
    const preferred = clampBounds(linuxPreferredPanelBounds);
    if (!sameSize(preferred, geometry) || !sameSize(preferred, panelBounds)) constrainLinuxPanelSize(panel, preferred);
  }
  const state = controller?.getState();
  if (state) measurePanel(state);
}
function measurePanel(state: AppState): void {
  if (!window || !readyToShow || !isPanel(state.surface) || manualPanelSize || state.busy) return;
  if (linux && (!window.isVisible() || linuxPanelTransition)) return;
  const content = state.error ? `${state.error.message}\n${state.error.hint}\n${state.error.code}\n${state.error.reportId}` : state.answer;
  const identity = `${state.surface}:${state.appearance.TextSizePoints}:${content}`;
  if (identity === measuredContent) return;
  measuredContent = identity;
  const revision = ++measurement;
  const area = screen.getDisplayMatching(window.getBounds()).workArea;
  const width = Math.max(180, Math.min(content.length > 180 ? 480 : 420, area.width - 24));
  // Read already-rendered text; never interpolate content into executable code.
  const script = `new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => {
    const text = document.querySelector('.answer-text');
    if (!text) { resolve(null); return; }
    const copy = text.cloneNode(true);
    const style = getComputedStyle(text);
    copy.style.font = style.font;
    copy.style.fontSize = style.fontSize;
    copy.style.lineHeight = style.lineHeight;
    copy.style.cssText += ';position:fixed;visibility:hidden;height:auto;max-height:none;overflow:visible;width:${width - 16}px;';
    document.body.appendChild(copy);
    const height = copy.getBoundingClientRect().height + parseFloat(style.marginTop) + parseFloat(style.marginBottom);
    const controlsHeight = document.querySelector('.panel-chrome')?.getBoundingClientRect().height || 0;
    const input = document.querySelector('.question-form');
    const inputStyle = input && getComputedStyle(input);
    const inputHeight = input ? input.getBoundingClientRect().height + parseFloat(inputStyle.marginTop) + parseFloat(inputStyle.marginBottom) : 0;
    copy.remove(); resolve({ height, controlsHeight, inputHeight });
  })))`;
  void window.webContents.executeJavaScript(script).then(async (result: unknown) => {
    const geometry = linux && window ? await readHyprlandPanelGeometry(window.getTitle()) : null;
    if (!window || window.isDestroyed() || revision !== measurement || manualPanelSize || state.surface !== surface || !result || typeof result !== 'object' ||
      !('height' in result) || !('controlsHeight' in result) || typeof result.height !== 'number' || !Number.isFinite(result.height) ||
      typeof result.controlsHeight !== 'number' || !Number.isFinite(result.controlsHeight) ||
      !('inputHeight' in result) || typeof result.inputHeight !== 'number' || !Number.isFinite(result.inputHeight)) return;
    if (linux) {
      if (!window.isVisible() || linuxPanelTransition) return;
      if (geometry) linuxPanelFloating = geometry.floating;
      if (!geometry?.floating) { measuredContent = ''; return; }
    }
    const old = window.getBounds();
    const frameHeight = linux ? Math.max(0, old.height - window.getContentBounds().height) : 0;
    const nextHeight = autoPanelHeight({ textHeight: result.height, controlsHeight: result.controlsHeight, inputHeight: result.inputHeight,
      frameHeight, workAreaHeight: area.height, minimumHeight: minimumPanelHeight() });
    const bounds = clampBounds({ x: old.x + old.width - width, y: old.y + old.height - nextHeight, width, height: nextHeight });
    if (linux) {
      // A Wayland bounds request alone can resize the renderer while leaving the toplevel unchanged.
      if (!sameSize(bounds, old) || (geometry && !sameSize(bounds, geometry))) constrainLinuxPanelSize(window, bounds);
    } else applyWindowGeometry(target => target.setBounds(bounds));
  }).catch(() => { /* Content measurement failure keeps the usable current bounds. */ });
}
function publish(state: AppState, capturing: boolean): void {
  if (!window || window.isDestroyed()) return;
  if (!capturing && state.visible && !preview && platform) {
    const protection = platform.protectWindow(window.getNativeWindowHandle());
    if (protection !== state.captureProtection) {
      controller?.setCaptureProtection(protection);
      return;
    }
  }
  const surfaceChanged = state.surface !== surface;
  if (surfaceChanged) releaseLinuxPanelSize?.();
  if (linux && !isPanel(state.surface)) {
    publishLinuxDialog(state, capturing);
    tray?.setImage(trayImage(state.busy));
    return;
  }
  if (surfaceChanged) {
    const returningToPanel = !isPanel(surface);
    if (linux) {
      linuxDialog?.window.hide();
      if (linuxDialog?.ready && returningToPanel) {
        linuxDialog.window.webContents.send('sc:state', { ...state, visible: false });
      }
    } else {
      hidePanel();
      if (isPanel(surface)) panelBounds = window.getBounds();
    }
    surface = state.surface;
    if (linux) {
      applyWindowGeometry(setLinuxPanelMinimum);
    } else {
      const area = screen.getDisplayMatching(window.getBounds()).workArea;
      applyWindowGeometry(target => {
        const panel = isPanel(surface);
        target.setResizable(panel);
        if (panel) {
          target.setMinimumSize(Math.min(180, area.width), Math.min(minimumPanelHeight(), area.height));
          if (panelBounds) target.setBounds(clampBounds(panelBounds));
        } else {
          const width = Math.min(surface === 'setup' ? 560 : 760, area.width);
          const height = Math.min(surface === 'setup' ? 480 : 680, area.height);
          target.setMinimumSize(Math.min(420, area.width), Math.min(300, area.height));
          target.setBounds({ x: Math.round(area.x + (area.width - width) / 2), y: Math.round(area.y + (area.height - height) / 2), width, height });
        }
      });
    }
  }
  if (readyToShow) window.webContents.send('sc:state', state);
  if (platform && state.ready) {
    platform.setPanelResizeEnabled(window.getNativeWindowHandle(), readyToShow && canResizePanel(state, capturing), minimumPanelHeight());
    const scale = screen.getDisplayMatching(window.getBounds()).scaleFactor;
    platform.setHoverInputHeight(state.surface === 'settings' || state.surface === 'setup'
      ? Math.ceil(window.getBounds().height * scale) : state.surface === 'input' ? Math.ceil(composerHeight * scale) : 0);
  }
  tray?.setImage(trayImage(state.busy));
  if (capturing || !state.visible || !readyToShow) hidePanel();
  else if (linux) {
    if (surfaceChanged || !window.isVisible()) void refreshLinuxPanelLayout(window);
    if (!window.isVisible()) window.show();
  } else if (!window.isVisible()) {
    if (state.surface === 'input' || state.surface === 'settings' || state.surface === 'setup') window.show();
    else window.showInactive();
  }
  if (!capturing) measurePanel(state);
}
function trustedUrl(url: string): boolean {
  const development = process.env.ELECTRON_RENDERER_URL;
  try { return !app.isPackaged && development ? url.startsWith(new URL(development).origin + '/') : url.startsWith('file:') && fileURLToPath(url).split('?')[0] === resolve(directory, '../renderer/index.html'); }
  catch { return false; }
}
function trustedSender(event: Electron.IpcMainInvokeEvent, readState: boolean): void {
  const target = readState && event.sender === window?.webContents ? window : activeWindow();
  if (!target || event.sender !== target.webContents || event.senderFrame !== target.webContents.mainFrame) throw new Error('Untrusted application frame.');
  if (!trustedUrl(event.senderFrame.url)) throw new Error('Untrusted application origin.');
}
function bindIpc(): void {
  const handlers: Record<string, (value?: unknown) => unknown> = {
    getState: () => controller!.getState(),
    setup: value => controller!.setup(setupRequestSchema.parse(value)),
    command: value => controller!.command(commandSchema.parse(value)),
    getSettingsDraft: () => controller!.getSettingsDraft(),
    saveSettings: value => controller!.saveSettings(settingsDraftSchema.parse(value)),
    discardSettings: () => controller!.discardSettings(),
    chooseColor: value => controller!.chooseColor(colorSchema.parse(value)),
    update: value => updates!.action(updateActionSchema.parse(value))
  };
  for (const [name, handler] of Object.entries(handlers)) ipcMain.handle(`sc:${name}`, async (event, value: unknown) => {
    trustedSender(event, name === 'getState');
    try { return await handler(value); }
    catch (error) { if (error instanceof AppError) throw new Error(error.message); throw new Error('SC could not complete this action. Check the settings and try again.'); }
  });
}
async function boot(): Promise<void> {
  if (process.platform !== 'win32' && !linux) throw new AppError('UNSUPPORTED', 'SC supports Windows and Fedora Hyprland Wayland.');
  platform = preview ? createPreviewPlatform() : linux ? createLinuxPlatform({
    app: { requestSingleInstanceLock: () => app.requestSingleInstanceLock(), on: (_name, listener) => { app.on('second-instance', listener); },
      removeListener: (_name, listener) => { app.removeListener('second-instance', listener); } },
    argv: process.argv, capture: async () => { if (!captureLinux) throw new Error('Capture is not ready.'); return captureLinux(); },
    imageFromBuffer: value => nativeImage.createFromBuffer(value), cryptor: createLinuxCryptor(safeStorage),
    transport: createLinuxTransport(url => session.defaultSession.resolveProxy(url))
  }) : createWindowsPlatform({ nativePath: app.isPackaged ? join(process.resourcesPath, 'native/sc_windows.node') : resolve(directory, '../../native/build/Release/sc_windows.node') });
  if (!await platform.acquireInstance(() => { if (controller) controller.restore(); else activationPending = true; })) { app.quit(); return; }
  if (closing) return;
  platform.startCaptureProtection(); diagnostics.event('PROCESSSTARTED');
  const store: SettingsStore = preview || captureTest ? createPreviewStore() : createSettingsStore(platform, localData ?? (() => { throw new AppError('PROFILEMISSING', 'The local application settings directory is unavailable.'); })(), { platform: linux ? 'linux' : 'windows' });
  const area = screen.getPrimaryDisplay().workArea;
  window = createWindow({ width: 420, height: 180, x: area.x + Math.max(12, area.width - 500), y: area.y + Math.max(12, area.height - 240),
    resizable: true, minWidth: linux ? 340 : 180, minHeight: linux ? 140 : 80 });
  window.on('hide', () => { if (!closing && window) platform?.cancelPanelInteraction(window.getNativeWindowHandle()); });
  lastCaptureProtection = preview ? 'Failed' : platform.protectWindow(window.getNativeWindowHandle());
  const savedSize = await store.loadWindowSize();
  if (closing) return;
  if (savedSize) {
    manualPanelSize = true;
    const scale = screen.getDisplayMatching(window.getBounds()).scaleFactor;
    const bounds = clampBounds({ ...window.getBounds(), width: Math.round(savedSize.Width / scale), height: Math.round(savedSize.Height / scale) });
    window.setBounds(bounds);
    if (linux) linuxPreferredPanelBounds = bounds;
  }
  panelBounds = window.getBounds();
  const config = loadPipelineConfiguration(preview || captureTest ? {} : undefined);
  controller = new ApplicationController({ platform, store, pipeline: createPipelineRunner({ transport: platform, cropper: platform }),
    diagnostics, configuration: settings => withSavedSettings(config, settings), defaultPipelineMode: config.mode, validateSettings, version,
    executableDirectory: dirname(process.execPath), platformName: linux ? 'linux' : 'windows',
    mode: synthetic ? 'synthetic' : captureTest ? 'captureTest' : 'production',
    host: { publish, panelHandle: () => window!.getNativeWindowHandle(), scroll: delta => { window?.webContents.send('sc:scroll', delta); }, exit: () => app.quit(),
      activate: () => {
        const target = activeWindow();
        if (target && readyToShow && (target === window || linuxDialog?.ready)) { target.show(); target.focus(); }
      },
      isFocused: () => activeWindow()?.isFocused() ?? false,
      inputAction: (submitScreenshot) => { window?.webContents.send('sc:input-action', submitScreenshot); },
      inputHeight: (height) => {
        composerHeight = height;
        if (window) platform?.setHoverInputHeight(Math.ceil(height * screen.getDisplayMatching(window.getBounds()).scaleFactor));
      } } });
  updates = new ApplicationUpdates({
    client: !linux && app.isPackaged && !process.env.PORTABLE_EXECUTABLE_DIR && !preview && !captureTest ? electronUpdater.autoUpdater : null,
    version, diagnostics, publish: state => controller?.setUpdateState(state), canInstall: () => controller?.canInstallUpdate() ?? false
  });
  controller.setUpdateState(updates.getState());
  controller.setCaptureProtection(lastCaptureProtection); bindIpc();
  if (linux && !preview) {
    captureLinux = createPortalCapture({ contents: window.webContents, trustedUrl });
  } else {
    window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    window.webContents.session.setPermissionCheckHandler(() => false);
  }
  const rememberSize = (bounds: Electron.Rectangle) => {
    manualPanelSize = true;
    if (linux) linuxPreferredPanelBounds = bounds;
    const scale = screen.getDisplayMatching(bounds).scaleFactor;
    const size: PanelSize = { Width: Math.round(bounds.width * scale), Height: Math.round(bounds.height * scale) };
    void store.saveWindowSize(size);
  };
  let checkingLinuxResize = false;
  const checkLinuxResize = async () => {
    if (checkingLinuxResize) return;
    checkingLinuxResize = true;
    try {
      while (pendingLinuxResize && window && !closing) {
        const bounds = pendingLinuxResize;
        const title = window.getTitle();
        let geometry = await readHyprlandPanelGeometry(title);
        if (!geometry && bounds === pendingLinuxResize && !closing) geometry = await readHyprlandPanelGeometry(title);
        if (bounds !== pendingLinuxResize) continue;
        pendingLinuxResize = null;
        if (!geometry || !window.isVisible() || closing) return;
        const wasFloating = linuxPanelFloating;
        linuxPanelFloating = geometry.floating;
        if (!geometry.floating) { measuredContent = ''; return; }
        if (wasFloating === false) void refreshLinuxPanelLayout(window);
        // Ignore a late configure for geometry the compositor has already replaced.
        else if (sameSize(bounds, geometry)) rememberSize(bounds);
      }
    } finally { checkingLinuxResize = false; }
  };
  window.on('resize', () => {
    if (!window || applyingWindowGeometry || !isPanel(surface)) return;
    const previous = panelBounds;
    const bounds = window.getBounds();
    if (previous && sameSize(bounds, previous)) {
      if (!linux) panelBounds = bounds;
      return;
    }
    panelBounds = bounds;
    if (!linux) { rememberSize(bounds); return; }
    if (!window.isVisible() || releaseLinuxPanelSize || linuxGeometryUpdate || linuxPanelTransition) return;
    pendingLinuxResize = bounds;
    void checkLinuxResize();
  });
  try {
    tray = new Tray(trayImage(false)); tray.setToolTip('SC');
    tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Show / Hide', click: () => controller?.onAction('visibility') },
    { label: 'Type a question', click: () => controller?.onAction('input') },
    { label: 'Settings', click: () => controller?.onAction('settings') },
    { label: 'Capture test (best effort exclusion)', click: () => controller?.onAction('test') },
    { type: 'separator' }, { label: 'Exit', click: () => app.quit() }
    ]));
    tray.on('double-click', () => controller?.onAction('visibility'));
  } catch (error) { if (!linux) throw error; tray = null; }
  window.webContents.once('did-finish-load', () => {
    if (closing) return;
    readyToShow = true;
    controller?.publish();
  });
  await loadRenderer(window, linux ? 'panel' : undefined);
  if (closing) return;
  await controller.initialize();
  if (closing) return;
  if (activationPending) { activationPending = false; controller.restore(); }
  void updates.action('check');
}
function startupFailure(error: unknown): void {
  // Quitting can destroy the renderer while its startup load is still pending.
  if (closing) return;
  const report = diagnostics.failure('Startup', linux && error instanceof SettingsError ? new AppError('KEYRING', 'SC could not open its settings. Unlock or install a secure Linux keyring, then restart SC. Existing settings were retained.') : error);
  // Protected native setup is unavailable if initialization itself failed. Keep output content-free.
  console.error(`${report.code} / ${report.reportId}: ${report.message}`);
  if ((process.platform === 'win32' || linux) && !synthetic) dialog.showErrorBox('SC could not start', `${report.message}\n\nDiagnostic: ${report.code} / ${report.reportId}`);
  process.exitCode = 1; app.quit();
}
app.on('window-all-closed', () => {});
app.on('before-quit', () => { closing = true; updates?.dispose(); controller?.dispose(); platform?.dispose(); tray?.destroy(); tray = null; });
void app.whenReady().then(boot).catch(startupFailure);
