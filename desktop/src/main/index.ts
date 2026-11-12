import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, safeStorage, screen, session, Tray } from 'electron';
import electronUpdater from 'electron-updater';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AppState, PanelSize, SettingsStore, WindowsPlatform } from '../contracts';
import { createLinuxPlatform, createLinuxTransport, createWindowsPlatform } from '../platform';
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
let tray: Tray | null = null;
let closing = false;
let readyToShow = false;
let panelBounds: Electron.Rectangle | null = null;
let surface: AppState['surface'] = 'answer';
let lastCaptureProtection: AppState['captureProtection'] = 'Failed';
let activationPending = false;
let manualPanelSize = false;
let settingBounds = false;
let expectedBounds: Electron.Rectangle | null = null;
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
  const height = Math.min(Math.max(linux ? 140 : 80, bounds.height), area.height);
  return { width, height, x: Math.max(area.x, Math.min(bounds.x, area.x + area.width - width)), y: Math.max(area.y, Math.min(bounds.y, area.y + area.height - height)) };
}
function setBounds(bounds: Electron.Rectangle): void {
  if (!window) return;
  expectedBounds = bounds; settingBounds = true;
  try { window.setBounds(bounds); } finally { settingBounds = false; }
}
function hidePanel(): void {
  if (!window) return;
  platform?.cancelPanelInteraction(window.getNativeWindowHandle());
  window.hide();
}
function measurePanel(state: AppState): void {
  if (!window || !readyToShow || !isPanel(state.surface) || manualPanelSize || state.busy) return;
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
  void window.webContents.executeJavaScript(script).then((result: unknown) => {
    if (!window || window.isDestroyed() || revision !== measurement || manualPanelSize || !isPanel(surface) || !result || typeof result !== 'object' ||
      !('height' in result) || !('controlsHeight' in result) || typeof result.height !== 'number' || !Number.isFinite(result.height) ||
      typeof result.controlsHeight !== 'number' || !Number.isFinite(result.controlsHeight) ||
      !('inputHeight' in result) || typeof result.inputHeight !== 'number' || !Number.isFinite(result.inputHeight)) return;
    const old = window.getBounds();
    const frameHeight = linux ? Math.max(0, old.height - window.getContentBounds().height) : 0;
    const nextHeight = autoPanelHeight({ textHeight: result.height, controlsHeight: result.controlsHeight, inputHeight: result.inputHeight,
      frameHeight, workAreaHeight: area.height, minimumHeight: linux ? 140 : 80 });
    setBounds(clampBounds({ x: old.x + old.width - width, y: old.y + old.height - nextHeight, width, height: nextHeight }));
    panelBounds = window.getBounds();
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
  if (state.surface !== surface) {
    hidePanel();
    if (isPanel(surface)) panelBounds = window.getBounds();
    const area = screen.getDisplayMatching(window.getBounds()).workArea;
    surface = state.surface;
    window.setResizable(isPanel(state.surface));
    if (isPanel(state.surface)) { window.setMinimumSize(Math.min(linux ? 340 : 180, area.width), Math.min(linux ? 140 : 80, area.height)); if (panelBounds) setBounds(clampBounds(panelBounds)); }
    else {
      const width = Math.min(state.surface === 'setup' ? 560 : 760, area.width);
      const height = Math.min(state.surface === 'setup' ? 480 : 680, area.height);
      window.setMinimumSize(Math.min(420, area.width), Math.min(300, area.height));
      setBounds({ x: Math.round(area.x + (area.width - width) / 2), y: Math.round(area.y + (area.height - height) / 2), width, height });
    }
    surface = state.surface;
  }
  if (readyToShow) window.webContents.send('sc:state', state);
  if (platform && state.ready) {
    platform.setPanelResizeEnabled(window.getNativeWindowHandle(), readyToShow && canResizePanel(state, capturing));
    const scale = screen.getDisplayMatching(window.getBounds()).scaleFactor;
    platform.setHoverInputHeight(state.surface === 'settings' || state.surface === 'setup'
      ? Math.ceil(window.getBounds().height * scale) : state.surface === 'input' ? Math.ceil(52 * scale) : 0);
  }
  tray?.setImage(trayImage(state.busy));
  if (capturing || !state.visible || !readyToShow) hidePanel();
  else if (!window.isVisible()) {
    if (linux || state.surface === 'input' || state.surface === 'settings' || state.surface === 'setup') window.show();
    else window.showInactive();
  }
  if (!capturing) measurePanel(state);
}
function trustedUrl(url: string): boolean {
  const development = process.env.ELECTRON_RENDERER_URL;
  try { return !app.isPackaged && development ? url.startsWith(new URL(development).origin + '/') : url.startsWith('file:') && fileURLToPath(url).split('?')[0] === resolve(directory, '../renderer/index.html'); }
  catch { return false; }
}
function trustedSender(event: Electron.IpcMainInvokeEvent): void {
  if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) throw new Error('Untrusted application frame.');
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
    trustedSender(event);
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
  window = new BrowserWindow({ title: 'SC', width: 420, height: 180, x: area.x + Math.max(12, area.width - 500), y: area.y + Math.max(12, area.height - 240),
    show: false, frame: linux, transparent: true, resizable: true, maximizable: false, fullscreenable: false,
    alwaysOnTop: true, skipTaskbar: !linux, hasShadow: linux, minWidth: linux ? 340 : 180, minHeight: linux ? 140 : 80,
    webPreferences: { preload: join(directory, '../preload/index.cjs'), partition: 'sc-ephemeral', sandbox: true, contextIsolation: true, nodeIntegration: false, spellcheck: false, backgroundThrottling: false } });
  window.setMenu(null); if (!linux) window.setContentProtection(true);
  window.on('hide', () => { if (!closing && window) platform?.cancelPanelInteraction(window.getNativeWindowHandle()); });
  lastCaptureProtection = preview ? 'Failed' : platform.protectWindow(window.getNativeWindowHandle());
  const savedSize = await store.loadWindowSize();
  if (closing) return;
  if (savedSize) {
    manualPanelSize = true;
    const scale = screen.getDisplayMatching(window.getBounds()).scaleFactor;
    window.setBounds(clampBounds({ ...window.getBounds(), width: Math.round(savedSize.Width / scale), height: Math.round(savedSize.Height / scale) }));
  }
  panelBounds = window.getBounds();
  const config = loadPipelineConfiguration(preview || captureTest ? {} : undefined);
  controller = new ApplicationController({ platform, store, pipeline: createPipelineRunner({ transport: platform, cropper: platform }),
    diagnostics, configuration: settings => withSavedSettings(config, settings), defaultPipelineMode: config.mode, validateSettings, version,
    executableDirectory: dirname(process.execPath), platformName: linux ? 'linux' : 'windows',
    mode: synthetic ? 'synthetic' : captureTest ? 'captureTest' : 'production',
    host: { publish, panelHandle: () => window!.getNativeWindowHandle(), scroll: delta => { window?.webContents.send('sc:scroll', delta); }, exit: () => app.quit(),
      activate: () => { if (window && readyToShow) { window.show(); window.focus(); } } } });
  updates = new ApplicationUpdates({
    client: !linux && app.isPackaged && !process.env.PORTABLE_EXECUTABLE_DIR && !preview && !captureTest ? electronUpdater.autoUpdater : null,
    version, diagnostics, publish: state => controller?.setUpdateState(state), canInstall: () => controller?.canInstallUpdate() ?? false
  });
  controller.setUpdateState(updates.getState());
  controller.setCaptureProtection(lastCaptureProtection); bindIpc();
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  if (linux && !preview) {
    captureLinux = createPortalCapture({ contents: window.webContents, trustedUrl });
  } else {
    window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    window.webContents.session.setPermissionCheckHandler(() => false);
  }
  window.on('close', event => { if (!closing) { event.preventDefault(); void controller?.command({ type: 'toggleVisibility' }); } });
  window.on('resize', () => {
    if (!window || !isPanel(surface)) return;
    panelBounds = window.getBounds();
    if (settingBounds || (expectedBounds && panelBounds.width === expectedBounds.width && panelBounds.height === expectedBounds.height)) return;
    manualPanelSize = true;
    const scale = screen.getDisplayMatching(panelBounds).scaleFactor;
    const size: PanelSize = { Width: Math.round(panelBounds.width * scale), Height: Math.round(panelBounds.height * scale) };
    void store.saveWindowSize(size);
  });
  window.on('blur', () => { void controller?.command({ type: 'recordShortcut', recording: false }); });
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
  window.webContents.once('did-finish-load', () => { readyToShow = true; if (controller) publish(controller.getState(), false); });
  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) await window.loadURL(process.env.ELECTRON_RENDERER_URL);
  else await window.loadFile(join(directory, '../renderer/index.html'));
  if (closing) return;
  await controller.initialize();
  if (closing) return;
  if (activationPending) { activationPending = false; controller.restore(); }
  void updates.action('check');
}
app.on('window-all-closed', () => {});
app.on('before-quit', () => { closing = true; updates?.dispose(); controller?.dispose(); platform?.dispose(); tray?.destroy(); tray = null; });
void app.whenReady().then(boot).catch(error => {
  // Quitting can destroy the renderer while its startup load is still pending.
  if (closing) return;
  const report = diagnostics.failure('Startup', linux && error instanceof SettingsError ? new AppError('KEYRING', 'SC could not open its settings. Unlock or install a secure Linux keyring, then restart SC. Existing settings were retained.') : error);
  // Protected native setup is unavailable if initialization itself failed. Keep output content-free.
  console.error(`${report.code} / ${report.reportId}: ${report.message}`);
  if ((process.platform === 'win32' || linux) && !synthetic) dialog.showErrorBox('SC could not start', `${report.message}\n\nDiagnostic: ${report.code} / ${report.reportId}`);
  process.exitCode = 1; app.quit();
});
