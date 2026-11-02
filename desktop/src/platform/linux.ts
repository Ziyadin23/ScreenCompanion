import type { AppAction, CapturedFrame, DesktopPlatform, HttpTransport } from '../contracts';
import { validateShortcuts } from './shortcuts';

interface Image {
  isEmpty(): boolean; getSize(): { width: number; height: number };
  crop(rect: { x: number; y: number; width: number; height: number }): { toJPEG(quality: number): Buffer };
}
interface LinuxOptions {
  app: { requestSingleInstanceLock(): boolean; on(name: 'second-instance', listener: (event: unknown, argv: string[]) => void): void;
    removeListener(name: 'second-instance', listener: (event: unknown, argv: string[]) => void): void };
  argv: string[]; capture(): Promise<CapturedFrame>; imageFromBuffer(buffer: Buffer): Image;
  cryptor: Pick<DesktopPlatform, 'protectData' | 'unprotectData'>; transport: HttpTransport;
}
const ACTIONS: AppAction[] = ['capture', 'test', 'visibility', 'settings', 'exit', 'input'];
const unavailable = (): never => { throw new Error('Wayland monitor selection is handled by the screen-sharing portal.'); };
export function createLinuxPlatform(options: LinuxOptions): DesktopPlatform {
  let action: ((value: AppAction) => void) | undefined, activate: (() => void) | undefined;
  let initialized = false, disposed = false;
  const pending: AppAction[] = [];
  function route(argv: string[], restore: boolean): void {
    const value = argv.find(arg => arg.startsWith('--action='))?.slice('--action='.length) as AppAction | undefined;
    if (value && ACTIONS.includes(value)) {
      if (initialized && action) action(value); else pending.push(value);
    } else if (restore) activate?.();
  }
  const onSecondInstance = (_event: unknown, argv: string[]): void => { if (!disposed) route(argv, true); };
  return {
    captureSelection: 'portal',
    async acquireInstance(onActivate) {
      activate = onActivate;
      if (!options.app.requestSingleInstanceLock()) return false;
      options.app.on('second-instance', onSecondInstance); route(options.argv, false); return true;
    },
    ready() { initialized = true; for (const next of pending.splice(0)) action?.(next); },
    startCaptureProtection() {}, protectWindow: () => 'Failed',
    activeMonitor: unavailable, monitorForWindow: unavailable,
    captureMonitor: async () => options.capture(),
    async crop(jpeg, r) {
      if (!Buffer.isBuffer(jpeg) || !jpeg.length || !r || ![r.x, r.y, r.width, r.height].every(Number.isFinite) ||
        r.x < 0 || r.y < 0 || r.width <= 0 || r.height <= 0 || r.x + r.width > 1.000001 || r.y + r.height > 1.000001)
        throw new Error('The image crop has invalid bounds.');
      const image = options.imageFromBuffer(jpeg), { width, height } = image.getSize();
      if (image.isEmpty() || width <= 0 || height <= 0 || width * height > 128 * 1024 * 1024) throw new Error('The captured image is invalid.');
      const left = Math.min(width - 1, Math.max(0, Math.floor(r.x * width))), top = Math.min(height - 1, Math.max(0, Math.floor(r.y * height)));
      const right = Math.min(width, Math.max(left + 1, Math.ceil((r.x + r.width) * width)));
      const bottom = Math.min(height, Math.max(top + 1, Math.ceil((r.y + r.height) * height)));
      return image.crop({ x: left, y: top, width: right - left, height: bottom - top }).toJPEG(95);
    },
    async applyShortcuts(settings, _recording, onAction) { validateShortcuts(settings); action = onAction; },
    attachPanel: () => () => {}, setHoverInputHeight() {}, setPanelResizeEnabled() {}, beginMove() {}, beginResize() {}, cancelPanelInteraction() {},
    chooseColor: async () => null, setOwnedDialogsVisible() {}, closeOwnedDialogs() {},
    protectData: options.cryptor.protectData, unprotectData: options.cryptor.unprotectData,
    send: options.transport.send,
    dispose() { if (disposed) return; disposed = true; pending.length = 0; options.app.removeListener('second-instance', onSecondInstance); }
  };
}
