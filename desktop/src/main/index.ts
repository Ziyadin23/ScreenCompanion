import { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, nativeImage, safeStorage, screen, session, Tray } from 'electron';
import electronUpdater from 'electron-updater';
import { dirname, join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import type { AppState, DisplayError, PanelSize, SettingsStore, WindowsPlatform } from '../contracts';
import { linuxCommand } from '../contracts/linux-actions';
import { createLinuxPlatform, createLinuxTransport, createWindowsPlatform, readHyprlandPanelGeometry,
  restoreHyprlandPanelPlacement, type HyprlandPanelPlacement } from '../platform';
import { createLinuxCryptor, createSettingsStore, SettingsError, validateSettings } from '../storage';
import { createPipelineRunner, loadPipelineConfiguration, withSavedSettings } from '../pipeline';
import { ApplicationController, canResizePanel, isPanelSurface as isPanel } from './controller';
import { createDiagnostics, diagnosticDetails, AppError } from './diagnostics';
import { commandSchema, colorSchema, settingsDraftSchema, settingsSessionSchema, setupRequestSchema, updateActionSchema } from './validation';
import { ApplicationUpdates } from './updates';
import { createPreviewPlatform, createPreviewStore } from './preview';
import { createPortalCapture } from './linux-capture';
import { autoPanelHeight } from './panel-size';
import { createTrayImages } from './tray-icon';
import appIconPath from '../../../assets/brand/sc-icon-512.png?asset';
import packageManifest from '../../package.json';

interface LinuxPanelLayout {
  placement: HyprlandPanelPlacement | null;
  hiddenPlacement: HyprlandPanelPlacement | null;
  hideCheck: Promise<void> | null;
  transition: AbortController | null;
  restorePlacement: Exclude<HyprlandPanelPlacement, 'fullscreen'> | null;
  remapBounds: Electron.Rectangle | null;
  mappedSize: Electron.Size | null;
  mapGeometry: ReturnType<typeof readHyprlandPanelGeometry> | null;
  resizeCheck: Promise<void> | null;
}

const directory = fileURLToPath(new URL('.', import.meta.url));
const synthetic = process.argv.includes('--synthetic-ui');
const captureTest = process.argv.includes('--capture-test-only');
const linux = process.platform === 'linux';
const preview = synthetic || (captureTest && process.platform !== 'win32' && !linux);
const version = packageManifest.version;
const afterPanelPaint = 'new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))';
const panelPaintTimeout = 1500;
const panelSizeQuitTimeout = 1000;
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
let trayIcons: ReturnType<typeof createTrayImages> | undefined;
let closing = false;
let startupFailureShowing = false;
let waitingForPanelSize = false;
const panelSizeLifetime = new AbortController();
const pendingLinuxResizes = new Set<Promise<void>>();
let panelSizeWrite: Promise<boolean> | null = null;
let readyToShow = false;
let panelBounds: Electron.Rectangle | null = null;
let linuxPreferredPanelBounds: Electron.Rectangle | null = null;
let surface: AppState['surface'] = 'answer';
let lastCaptureProtection: AppState['captureProtection'] = 'Failed';
let composerHeight = 96;
let activationPending = false;
let manualPanelSize = false;
let applyingWindowGeometry = false;
let linuxPanelLayout: LinuxPanelLayout | null = null;
let measurement = 0;
let measuredContent = '';
let captureLinux: (() => Promise<import('../contracts').CapturedFrame>) | undefined;

function trayImage(working: boolean): Electron.NativeImage {
  trayIcons ??= createTrayImages(nativeImage.createFromPath(appIconPath));
  return working ? trayIcons.working : trayIcons.idle;
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
function refreshLinuxSizeHints(panel: BrowserWindow): void {
  panel.setResizable(false);
  panel.setResizable(true);
}
function waitForLinuxPanelPaint(panel: BrowserWindow): Promise<void> {
  return new Promise(resolve => {
    const finish = () => { clearTimeout(deadline); resolve(); };
    const deadline = setTimeout(finish, panelPaintTimeout);
    void panel.webContents.executeJavaScript(afterPanelPaint).then(finish, finish);
  });
}
function applyWindowGeometry(update: (target: BrowserWindow) => void): void {
  if (!window) return;
  applyingWindowGeometry = true;
  try {
    update(window);
    // Keep the effective size for any resize notification delivered after the update.
    if (isPanel(surface)) panelBounds = window.getBounds();
  } finally { applyingWindowGeometry = false; }
}
function hidePanel(rememberPlacement = false): Promise<void> | undefined {
  const panel = window;
  if (!panel) return;
  if (linux && panel.isVisible()) {
    const layout = linuxPanelLayout;
    if (rememberPlacement && layout && !layout.restorePlacement) {
      // Hyprland can change placement without emitting a resize. Read it while the panel is mapped.
      if (!layout.hideCheck) {
        const check = readHyprlandPanelGeometry(panel.getTitle()).then(geometry => {
          if (closing || linuxPanelLayout !== layout || layout.hideCheck !== check) return;
          layout.hideCheck = null;
          layout.hiddenPlacement = geometry?.placement ?? null;
          hidePanel();
          if (surface === 'settings') controller?.publish();
        });
        layout.hideCheck = check;
      }
      return layout.hideCheck;
    }
    releaseLinuxPanelSize?.();
    if (layout) {
      layout.hideCheck = null;
      layout.transition?.abort();
      layout.transition = null;
    }
    measuredContent = '';
    measurement++;
  }
  platform?.cancelPanelInteraction(panel.getNativeWindowHandle());
  panel.hide();
}
function activeWindow(): BrowserWindow | null {
  if (!linux || isPanel(surface)) return window;
  if (linuxPanelLayout?.hideCheck) return null;
  return linuxDialog?.surface === surface ? linuxDialog.window : null;
}
function createWindow(options: Electron.BrowserWindowConstructorOptions): BrowserWindow {
  const target = new BrowserWindow({ title: 'SC', icon: appIconPath, show: false, frame: linux, transparent: true, maximizable: false,
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
  target.on('blur', () => { if (target === activeWindow()) void controller?.onWindowBlur(); });
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
  if (hidePanel(state.surface === 'settings' && readyToShow && !capturing)) return;
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
    clearTimeout(deadline);
    if (closing || panel.isDestroyed()) return;
    applyWindowGeometry(target => {
      target.setMaximumSize(0, 0);
      setLinuxPanelMinimum(target);
      // Refresh the mapped Wayland size hints so native drags can resize the panel again.
      refreshLinuxSizeHints(target);
    });
    // Wayland applies the released size hints on a surface commit.
    if (panel.isVisible()) panel.webContents.invalidate();
  };
  const deadline = setTimeout(release, panelPaintTimeout);
  releaseLinuxPanelSize = release;
  panel.webContents.invalidate();
  void (async () => {
    // A renderer frame can finish before the compositor applies the fixed hints.
    while (releaseLinuxPanelSize === release && !closing && !panel.isDestroyed()) {
      await panel.webContents.executeJavaScript(afterPanelPaint);
      if (releaseLinuxPanelSize !== release || closing || panel.isDestroyed()) return;
      const geometry = await readHyprlandPanelGeometry(panel.getTitle());
      if (geometry && (geometry.placement !== 'floating' || sameSize(bounds, geometry))) break;
    }
    release();
  })().catch(release);
}
async function readLinuxMapGeometry(panel: BrowserWindow, layout: LinuxPanelLayout) {
  // show() and the first normal-bounds configure can both precede the Wayland map.
  const deadline = performance.now() + panelPaintTimeout;
  while (linuxPanelLayout === layout && layout.transition && !closing && !panel.isDestroyed() && panel.isVisible()) {
    const geometry = await readHyprlandPanelGeometry(panel.getTitle());
    if (geometry || !process.env.HYPRLAND_INSTANCE_SIGNATURE || performance.now() >= deadline) return geometry;
    await delay(8);
  }
  return null;
}
async function readLinuxPanelLayout(panel: BrowserWindow, layout: LinuxPanelLayout) {
  // A fit or restore must wait for any observed native resize to be confirmed.
  while (linuxPanelLayout === layout && !closing && !panel.isDestroyed() && panel.isVisible()) {
    if (layout.resizeCheck) {
      await layout.resizeCheck;
      continue;
    }
    const observed = panelBounds;
    const geometry = await readHyprlandPanelGeometry(panel.getTitle());
    if (observed === panelBounds) return geometry;
  }
  return null;
}
async function refreshLinuxPanelLayout(panel: BrowserWindow, layout: LinuxPanelLayout): Promise<void> {
  // Fixed size hints on map can cause Hyprland to float a tiled panel.
  layout.transition?.abort();
  const transition = new AbortController();
  layout.transition = transition;
  const isCurrent = () => linuxPanelLayout === layout && layout.transition === transition && !closing &&
    !panel.isDestroyed() && panel.isVisible() && isPanel(surface);
  await waitForLinuxPanelPaint(panel);
  // A Wayland remap can leave the panel absent from the first compositor snapshot.
  let geometry: Awaited<ReturnType<typeof readHyprlandPanelGeometry>> = null;
  for (let attempt = 0; attempt < 3 && isCurrent(); attempt++) {
    if (attempt) await delay(32);
    if (!isCurrent()) return;
    geometry = await readLinuxPanelLayout(panel, layout);
    if (geometry) break;
  }
  if (!isCurrent()) return;
  const placement = layout.restorePlacement;
  if (placement && geometry && geometry.placement !== 'fullscreen' && geometry.placement !== placement) {
    // A map rule can undo the user's choice when Settings closes.
    layout.placement = geometry.placement;
    await restoreHyprlandPanelPlacement(geometry.address, placement, transition.signal);
    if (!isCurrent()) return;
    geometry = await readLinuxPanelLayout(panel, layout);
    if (!isCurrent()) return;
  }
  layout.transition = null;
  layout.restorePlacement = null;
  layout.remapBounds = null;
  layout.mappedSize = null;
  layout.mapGeometry = null;
  panelBounds = panel.getBounds();
  layout.placement = geometry?.placement ?? null;
  if (geometry?.placement !== 'floating') return;
  if (linuxPreferredPanelBounds) {
    const preferred = clampBounds(linuxPreferredPanelBounds);
    if (!sameSize(preferred, geometry) || !sameSize(preferred, panelBounds)) constrainLinuxPanelSize(panel, preferred);
  }
  const state = controller?.getState();
  if (state) measurePanel(state);
}
function measurePanel(state: AppState): void {
  if (!window || !readyToShow || !isPanel(state.surface) || manualPanelSize || state.busy) return;
  const layout = linuxPanelLayout;
  if (linux && (!layout || !window.isVisible() || layout.transition)) return;
  const content = state.error ? `${state.error.message}\n${state.error.hint}\n${state.error.code}\n${state.error.reportId}` : state.answer;
  const identity = `${state.surface}:${state.appearance.TextSizePoints}:${Boolean(state.shortcutRecovery)}:${content}`;
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
    const geometry = layout && window ? await readLinuxPanelLayout(window, layout) : null;
    if (!window || window.isDestroyed() || revision !== measurement || manualPanelSize || state.surface !== surface || !result || typeof result !== 'object' ||
      !('height' in result) || !('controlsHeight' in result) || typeof result.height !== 'number' || !Number.isFinite(result.height) ||
      typeof result.controlsHeight !== 'number' || !Number.isFinite(result.controlsHeight) ||
      !('inputHeight' in result) || typeof result.inputHeight !== 'number' || !Number.isFinite(result.inputHeight)) return;
    if (layout) {
      if (linuxPanelLayout !== layout || !window.isVisible() || layout.transition) return;
      if (geometry) layout.placement = geometry.placement;
      if (geometry?.placement !== 'floating') { measuredContent = ''; return; }
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
function publish(state: AppState, capturing: boolean): Promise<void> | undefined {
  if (closing || !window || window.isDestroyed()) return;
  if (!capturing && state.visible && !preview && platform) {
    const protection = platform.protectWindow(window.getNativeWindowHandle());
    if (protection !== state.captureProtection) {
      controller?.setCaptureProtection(protection);
      return;
    }
  }
  tray?.setImage(trayImage(state.busy));
  tray?.setToolTip(state.busy ? 'SC — Working…' : 'SC');
  const surfaceChanged = state.surface !== surface;
  if (surfaceChanged) releaseLinuxPanelSize?.();
  if (linux && !isPanel(state.surface)) {
    publishLinuxDialog(state, capturing);
    return;
  }
  let linuxPanelNeedsResize = false;
  if (surfaceChanged) {
    const returningToPanel = !isPanel(surface);
    const leavingInput = surface === 'input';
    if (linux) {
      const layout = linuxPanelLayout;
      if (surface === 'settings' && layout && !window.isVisible()) {
        const placement = layout.hiddenPlacement ?? layout.placement;
        if (placement !== 'fullscreen') layout.restorePlacement ??= placement;
      }
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
      const bounds = window.getBounds();
      linuxPanelNeedsResize = !sameSize(bounds, clampBounds(linuxPreferredPanelBounds ?? bounds));
      // A minimum change that keeps the bounds can coexist with a native resize.
      if (linuxPanelNeedsResize) applyWindowGeometry(setLinuxPanelMinimum);
      else {
        setLinuxPanelMinimum(window);
        if (leavingInput && linuxPanelLayout?.placement === 'floating') {
          // Release the input minimum before the next native resize of the answer.
          refreshLinuxSizeHints(window);
          window.webContents.invalidate();
        }
      }
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
  if (capturing || !state.visible || !readyToShow) {
    const hiding = hidePanel(!capturing && !state.visible);
    if (hiding) return hiding;
  } else if (linux) {
    if (!window.isVisible()) {
      // Hyprland can initially configure a remapped window at its old normal bounds.
      const remapBounds = window.isMaximized() ? window.getNormalBounds() : null;
      const restorePlacement = linuxPanelLayout?.restorePlacement ?? null;
      linuxPanelLayout = { placement: null, hiddenPlacement: null, hideCheck: null, transition: null, restorePlacement,
        remapBounds, mappedSize: null, mapGeometry: null, resizeCheck: null };
      void refreshLinuxPanelLayout(window, linuxPanelLayout);
      window.show();
      // Sample the compositor's map rule before paint or an interactive resize can change the size.
      linuxPanelLayout.mapGeometry = readLinuxMapGeometry(window, linuxPanelLayout);
      window.webContents.invalidate();
    } else if (linuxPanelLayout) {
      linuxPanelLayout.hideCheck = null;
      if (linuxPanelNeedsResize) void refreshLinuxPanelLayout(window, linuxPanelLayout);
    }
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
async function copyDiagnosticDetails(report: DisplayError): Promise<'copied'> {
  const details = diagnosticDetails(report);
  await clipboard.writeText(details);
  // Native writes can fail without throwing. Compare locally and discard the readback.
  if (await clipboard.readText() !== details) throw new Error('The diagnostic details were not copied.');
  return 'copied';
}
function bindIpc(): void {
  const handlers: Record<string, (value?: unknown) => unknown> = {
    getState: () => controller!.getState(),
    setup: value => controller!.setup(setupRequestSchema.parse(value)),
    command: value => {
      const command = commandSchema.parse(value);
      if (command.type === 'copyDiagnostic') {
        const state = controller!.getState();
        const target = activeWindow();
        const report = command.surface === 'settings' ? state.shortcutRecovery : state.error;
        if (!state.visible || !target?.isVisible() || !target.isFocused() || command.surface !== state.surface || report?.reportId !== command.reportId)
          throw new Error('The displayed diagnostic is unavailable.');
        return copyDiagnosticDetails(report);
      }
      if (command.type !== 'copyLinuxCommand') return controller!.command(command);
      if (!linux || surface !== 'settings' || !activeWindow()?.isFocused()) throw new Error('Linux Settings is not focused.');
      clipboard.writeText(linuxCommand(command.action));
      return 'copied';
    },
    getSettingsDraft: () => controller!.getSettingsDraft(),
    saveSettings: value => controller!.saveSettings(settingsDraftSchema.parse(value)),
    discardSettings: value => controller!.discardSettings(settingsSessionSchema.parse(value)),
    chooseColor: value => controller!.chooseColor(colorSchema.parse(value)),
    update: value => updates!.action(updateActionSchema.parse(value))
  };
  for (const [name, handler] of Object.entries(handlers)) ipcMain.handle(`sc:${name}`, async (event, value: unknown) => {
    trustedSender(event, name === 'getState');
    if (closing && name !== 'getState') return;
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
  const store: SettingsStore = preview || captureTest ? createPreviewStore() : createSettingsStore(platform, localData ?? (() => { throw new AppError('PROFILEMISSING', 'The local application settings directory is unavailable.'); })(), { platform: linux ? 'linux' : 'windows', windowSizeSignal: panelSizeLifetime.signal });
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
        if (!closing && target && readyToShow && (target === window || linuxDialog?.ready)) { target.show(); target.focus(); }
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
    const write = store.saveWindowSize(size);
    panelSizeWrite = write;
    const clear = () => { if (panelSizeWrite === write) panelSizeWrite = null; };
    void write.then(clear, clear);
  };
  let resizeOrder = 0;
  let savedResizeOrder = 0;
  const checkLinuxResize = (panel: BrowserWindow, layout: LinuxPanelLayout, bounds: Electron.Rectangle) => {
    const { remapBounds, resizeCheck: previousCheck, transition, restorePlacement } = layout;
    const atRemapBounds = remapBounds && sameSize(bounds, remapBounds) && bounds.x === remapBounds.x && bounds.y === remapBounds.y;
    if (atRemapBounds && !previousCheck) {
      layout.remapBounds = null;
      return;
    }
    const order = ++resizeOrder;
    const title = panel.getTitle();
    const check = (async () => {
      // Start each snapshot while its resize is still visible. Apply placement in observation order for this mapping.
      let geometry = await readHyprlandPanelGeometry(title);
      if (!geometry && order === resizeOrder && !closing && linuxPanelLayout === layout && panel.isVisible()) {
        geometry = await readHyprlandPanelGeometry(title);
      }
      await previousCheck;
      // The old normal bounds can be a real resize after an earlier resize on this mapping.
      if (atRemapBounds && layout.remapBounds === remapBounds) {
        layout.remapBounds = null;
        return;
      }
      const mapped = await layout.mapGeometry;
      if (!geometry || (closing && !waitingForPanelSize) || panel.isDestroyed()) return;
      const current = !closing && panel.isVisible() && isPanel(surface) ? linuxPanelLayout : null;
      const previousPlacement = layout.placement;
      layout.placement = geometry.placement;
      if (geometry.placement !== 'floating') {
        if (current === layout) measuredContent = '';
        return;
      }
      if (restorePlacement === 'tiled') return;
      // Ignore the size applied on map. A distinct native resize can precede the first paint.
      const mappedSize = layout.mappedSize ?? (mapped?.placement === 'floating' ? mapped : null);
      if (mappedSize && sameSize(bounds, mappedSize)) return;
      if (transition && !previousPlacement && !mapped && !mappedSize) return;
      if (previousPlacement && previousPlacement !== 'floating') {
        // The first floating configure belongs to the mode change. Later resizes have their own snapshots.
        if (current === layout && restorePlacement !== 'floating') void refreshLinuxPanelLayout(panel, layout);
        return;
      }
      if (order <= savedResizeOrder || !sameSize(bounds, geometry)) return;
      layout.remapBounds = null;
      layout.mappedSize = null;
      layout.mapGeometry = null;
      savedResizeOrder = order;
      rememberSize(bounds);
      if (current === layout && transition && layout.transition === transition && sameSize(bounds, panel.getBounds())) {
        transition.abort();
        layout.transition = null;
        layout.restorePlacement = null;
      }
      if (current && current !== layout && !current.transition) void refreshLinuxPanelLayout(panel, current);
    })().catch(() => { /* A failed observation keeps the last confirmed size. */ });
    layout.resizeCheck = check;
    pendingLinuxResizes.add(check);
    void check.then(() => {
      pendingLinuxResizes.delete(check);
      if (layout.resizeCheck === check) layout.resizeCheck = null;
    });
  };
  if (linux) window.on('maximize', () => {
    // On Wayland, Electron enters its maximized state with the first mapped configure,
    // even on a floating panel. Its bounds belong to that configure, before a later resize.
    const layout = linuxPanelLayout;
    if (window && layout?.mapGeometry && layout.transition) layout.mappedSize ??= window.getBounds();
  });
  window.on('resize', () => {
    if (closing || !window || applyingWindowGeometry || !isPanel(surface)) return;
    const previous = panelBounds;
    const bounds = window.getBounds();
    if (previous && sameSize(bounds, previous)) {
      if (!linux) panelBounds = bounds;
      return;
    }
    panelBounds = bounds;
    if (!linux) { rememberSize(bounds); return; }
    const layout = linuxPanelLayout;
    if (!layout || !window.isVisible() || releaseLinuxPanelSize) return;
    checkLinuxResize(window, layout, bounds);
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
async function startupFailure(error: unknown): Promise<void> {
  // Quitting can destroy the renderer while its startup load is still pending.
  if (closing || startupFailureShowing) return;
  startupFailureShowing = true;
  const report = diagnostics.failure('Startup', linux && error instanceof SettingsError ? new AppError('KEYRING', 'SC could not open its settings. Unlock or install a secure Linux keyring, then restart SC. Existing settings were retained.') : error);
  // Protected native setup is unavailable if initialization itself failed. Keep output content-free.
  console.error(`${report.code} / ${report.reportId}: ${report.message}`);
  try {
    if ((process.platform === 'win32' || linux) && !synthetic) {
      const title = 'SC could not start';
      const details = diagnosticDetails(report);
      let feedback = '';
      try {
        while (!closing) {
          const options: Electron.MessageBoxOptions = { title, type: 'error', message: report.message,
            detail: feedback ? `${details}\n\n${feedback}` : details,
            buttons: ['Copy diagnostic details', 'Close'], defaultId: 0, cancelId: 1, noLink: true };
          // On Windows the capture-protection hook covers the application's UI thread.
          const response = linux ? (await dialog.showMessageBox(options)).response : dialog.showMessageBoxSync(options);
          if (response !== 0 || closing) break;
          try {
            await copyDiagnosticDetails(report);
            feedback = linux ? 'Diagnostic details copied. Paste them before closing this dialog.' : 'Diagnostic details copied.';
          } catch { feedback = 'Could not copy. Try again.'; }
        }
      } catch { dialog.showErrorBox(title, `${report.message}\n\n${details}`); }
    }
  } finally { process.exitCode = 1; app.quit(); }
}
app.on('window-all-closed', () => {});
app.on('before-quit', event => {
  if (waitingForPanelSize) { event.preventDefault(); return; }
  const drainPanelSize = !closing && (pendingLinuxResizes.size > 0 || panelSizeWrite !== null);
  if (!closing) {
    closing = true;
    updates?.dispose(); controller?.beginShutdown();
  }
  if (drainPanelSize) {
    event.preventDefault();
    waitingForPanelSize = true;
    const finish = () => {
      if (!waitingForPanelSize) return;
      waitingForPanelSize = false;
      clearTimeout(deadline);
      app.quit();
    };
    const deadline = setTimeout(() => { panelSizeLifetime.abort(); finish(); }, panelSizeQuitTimeout);
    // Allow pending snapshots to enqueue writes before waiting for the store's serialized writes.
    void Promise.allSettled(pendingLinuxResizes).then(() => panelSizeWrite).then(finish, finish);
    return;
  }
  const releaseInstance = () => { if (controller) controller.dispose(); else platform?.dispose(); };
  // A timed-out write may still be revoking its temporary file. Keep ownership until it settles or the process ends.
  if (panelSizeWrite) void panelSizeWrite.then(releaseInstance, releaseInstance);
  else releaseInstance();
  tray?.destroy(); tray = null;
});
void app.whenReady().then(boot).catch(startupFailure);
