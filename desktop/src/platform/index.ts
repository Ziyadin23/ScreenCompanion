import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import type { AppAction, CaptureProtectionResult, CapturedFrame, HttpRequest, HttpResponse, NormalizedRegion, PixelBounds, ResizeEdge, VaultData, WindowsPlatform } from '../contracts';
import { SHORTCUT_FIELDS, validateShortcuts } from './shortcuts';

type NativeEvent = { type: 'activation' | 'action' | 'wheel'; action?: AppAction; delta?: number };
interface NativeBridge {
  acquireInstance(): Promise<boolean>;
  startCaptureProtection(): void;
  protectWindow(handle: Buffer): CaptureProtectionResult;
  activeMonitor(): PixelBounds;
  monitorForWindow(handle: Buffer): PixelBounds;
  captureMonitor(bounds: PixelBounds): Promise<CapturedFrame>;
  crop(jpeg: Buffer, region: NormalizedRegion): Promise<Buffer>;
  applyShortcuts(bindings: { id: number; modifiers: number; key: number }[]): void;
  attachPanel(handle: Buffer): void;
  detachPanel(): void;
  setHoverInputHeight(height: number): void;
  setPanelResizeEnabled(handle: Buffer, enabled: boolean): void;
  beginMove(handle: Buffer): void;
  beginResize(handle: Buffer, edge: ResizeEdge): void;
  cancelPanelInteraction(handle: Buffer): void;
  chooseColor(handle: Buffer, initialColor: string): Promise<string | null>;
  setOwnedDialogsVisible(handle: Buffer, visible: boolean): void;
  closeOwnedDialogs(handle: Buffer): void;
  protectData(plaintext: Buffer): Buffer;
  unprotectData(ciphertext: Buffer): Buffer;
  send(request: HttpRequest, id: number): Promise<HttpResponse>;
  cancelRequest(id: number): void;
  dispose(): void;
}
const nativeRequire = createRequire(import.meta.url);
const EDGES = ['left', 'right', 'top', 'bottom', 'top-left', 'top-right', 'bottom-left', 'bottom-right'];
function boundsValid(b: PixelBounds): boolean {
  return !!b && [b.x, b.y, b.width, b.height].every(Number.isSafeInteger) && b.width > 0 && b.height > 0 && b.width <= 32768 && b.height <= 32768 && b.width * b.height <= 128 * 1024 * 1024 && b.x >= -2147483648 && b.y >= -2147483648 && b.x + b.width <= 2147483647 && b.y + b.height <= 2147483647;
}
function regionValid(r: NormalizedRegion): boolean {
  return !!r && [r.x, r.y, r.width, r.height].every(Number.isFinite) && r.x >= 0 && r.y >= 0 && r.width > 0 && r.height > 0 && r.x + r.width <= 1.000001 && r.y + r.height <= 1.000001;
}
function handleValid(handle: Buffer): void {
  if (!Buffer.isBuffer(handle) || ![4, 8].includes(handle.length) || handle.every(byte => byte === 0)) throw new Error('A valid native Windows window handle is required.');
}
function cancelled(): Error { const error = new Error('The request was cancelled.'); error.name = 'AbortError'; return error; }

/** No addon is loaded until the first native operation. Production never falls back to a simulated platform. */
export function createWindowsPlatform(options: { nativePath?: string } = {}): WindowsPlatform {
  let native: NativeBridge | undefined;
  let disposed = false;
  let activate: (() => void) | undefined;
  let action: ((action: AppAction) => void) | undefined;
  let wheel: ((delta: number) => void) | undefined;
  let pendingActivation = false;
  let panelGeneration = 0;
  let sequence = 0;
  const activeRequests = new Map<number, () => void>();
  const event = (e: NativeEvent): void => {
    if (disposed) return;
    if (e.type === 'activation') { if (activate) activate(); else pendingActivation = true; }
    if (e.type === 'action' && e.action && Object.hasOwn(SHORTCUT_FIELDS, e.action)) action?.(e.action);
    if (e.type === 'wheel' && typeof e.delta === 'number') wheel?.(e.delta);
  };
  function bridge(): NativeBridge {
    if (disposed) throw new Error('The Windows platform has been disposed.');
    if (process.platform !== 'win32') throw new Error('SC requires Windows 10/11 for native capture, input, networking and user encryption.');
    if (!native) {
      const resourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath;
      const path = options.nativePath ?? (resourcesPath ? resolve(resourcesPath, 'native/sc_windows.node') : resolve(import.meta.dirname, '../../native/build/Release/sc_windows.node'));
      try { native = (nativeRequire(path) as { createBridge: (callback: (e: NativeEvent) => void) => NativeBridge }).createBridge(event); }
      catch { throw new Error('The SC Windows native bridge could not be loaded. Rebuild or reinstall the Windows application.'); }
    }
    return native;
  }
  return {
    async acquireInstance(onActivate) {
      activate = onActivate;
      if (pendingActivation) { pendingActivation = false; onActivate(); }
      return bridge().acquireInstance();
    },
    startCaptureProtection() { bridge().startCaptureProtection(); },
    protectWindow(handle) { handleValid(handle); return bridge().protectWindow(handle); },
    activeMonitor() { return bridge().activeMonitor(); },
    monitorForWindow(handle) { handleValid(handle); return bridge().monitorForWindow(handle); },
    async captureMonitor(bounds) {
      if (!boundsValid(bounds)) throw new Error('Windows did not report a usable monitor size.');
      return bridge().captureMonitor(bounds);
    },
    async crop(jpeg, region) {
      if (!Buffer.isBuffer(jpeg) || !jpeg.length || !regionValid(region)) throw new Error('The image crop has invalid bounds.');
      return bridge().crop(jpeg, region);
    },
    async applyShortcuts(settings: VaultData, recording, onAction) {
      validateShortcuts(settings);
      const bindings = Object.entries(SHORTCUT_FIELDS).map(([name, field], i) => ({ action: name, id: i + 1, modifiers: settings[field].Modifiers, key: settings[field].Key }))
        .filter(b => !recording || b.action === 'visibility' || b.action === 'exit');
      bridge().applyShortcuts(bindings);
      action = onAction;
    },
    attachPanel(handle, onWheel) {
      handleValid(handle);
      bridge().attachPanel(handle);
      wheel = onWheel;
      const generation = ++panelGeneration;
      return () => { if (!disposed && generation === panelGeneration) { native?.detachPanel(); wheel = undefined; } };
    },
    setHoverInputHeight(height) {
      if (!Number.isInteger(height) || height < 0 || height > 32768) throw new Error('The hover input height is invalid.');
      bridge().setHoverInputHeight(height);
    },
    setPanelResizeEnabled(handle, enabled) {
      handleValid(handle);
      if (typeof enabled !== 'boolean') throw new Error('The panel resize state is invalid.');
      bridge().setPanelResizeEnabled(handle, enabled);
    },
    beginMove(handle) { handleValid(handle); bridge().beginMove(handle); },
    cancelPanelInteraction(handle) { handleValid(handle); bridge().cancelPanelInteraction(handle); },
    beginResize(handle, edge) {
      handleValid(handle);
      if (!EDGES.includes(edge)) throw new Error('The resize edge is invalid.');
      bridge().beginResize(handle, edge);
    },
    async chooseColor(handle, initialColor) {
      handleValid(handle);
      if (!/^#[\da-f]{6}$/i.test(initialColor)) throw new Error('The initial color is invalid.');
      return bridge().chooseColor(handle, initialColor);
    },
    setOwnedDialogsVisible(handle, visible) { handleValid(handle); bridge().setOwnedDialogsVisible(handle, visible); },
    closeOwnedDialogs(handle) { handleValid(handle); bridge().closeOwnedDialogs(handle); },
    protectData(plaintext) { return bridge().protectData(plaintext); },
    unprotectData(ciphertext) { return bridge().unprotectData(ciphertext); },
    async send(request, signal) {
      if (signal?.aborted) throw cancelled();
      let url: URL;
      try { url = new URL(request.url); } catch { throw new Error('The HTTP request URL is invalid.'); }
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.hash || !Buffer.isBuffer(request.body)) throw new Error('The HTTP request is invalid.');
      for (const [name, value] of Object.entries(request.headers)) {
        if (!/^[!#$%&'*+.^_`|~\da-z-]+$/i.test(name) || /[\r\n\0]/.test(value)) throw new Error('The HTTP headers are invalid.');
      }
      const connectTimeoutMs = request.connectTimeoutMs ?? 15000;
      const timeoutMs = request.timeoutMs ?? 90000;
      if (![connectTimeoutMs, timeoutMs].every(v => Number.isInteger(v) && v > 0 && v <= 2147483647)) throw new Error('The HTTP timeout is invalid.');
      const target = bridge();
      const id = ++sequence;
      const abort = (): void => target.cancelRequest(id);
      activeRequests.set(id, abort);
      signal?.addEventListener('abort', abort, { once: true });
      try {
        const result = target.send({ ...request, connectTimeoutMs, timeoutMs }, id);
        if (signal?.aborted) abort();
        return await result;
      } catch (error) {
        if (signal?.aborted) throw cancelled();
        const match = error instanceof Error ? /\(Windows code (\d+)\)/.exec(error.message) : null;
        const windowsCode = match?.[1] ? Number(match[1]) : undefined;
        const safe = new Error(windowsCode === 12002 ? 'The HTTP request exceeded its total deadline.' : 'The HTTP request failed.') as Error & { code: string; windowsCode?: number };
        safe.name = windowsCode === 12002 ? 'TimeoutError' : windowsCode === 12017 ? 'AbortError' : 'WindowsTransportError';
        safe.code = windowsCode === 12002 ? 'request_timeout' : windowsCode === 12017 ? 'request_cancelled' : windowsCode === 12007 ? 'network_dns' : windowsCode === 12175 ? 'network_tls' : 'network_error';
        safe.windowsCode = windowsCode;
        throw safe;
      }
      finally { signal?.removeEventListener('abort', abort); activeRequests.delete(id); }
    },
    dispose() {
      if (disposed) return;
      for (const abort of activeRequests.values()) abort();
      disposed = true;
      native?.dispose();
      activate = undefined; action = undefined; wheel = undefined;
    }
  };
}
