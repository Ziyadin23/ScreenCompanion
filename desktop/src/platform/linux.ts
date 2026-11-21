import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { DesktopAction, CapturedFrame, DesktopPlatform, HttpTransport } from '../contracts';
import { validateShortcuts } from './shortcuts';

const runHyprctl = promisify(execFile);
const hyprctlOptions = { timeout: 500, maxBuffer: 1024 * 1024 };
const hyprlandAddress = /^0x[0-9a-f]+$/;

export type HyprlandPanelPlacement = 'floating' | 'tiled' | 'fullscreen';
interface HyprlandPanelGeometry extends Electron.Size {
  address: string;
  placement: HyprlandPanelPlacement;
}

export async function readHyprlandPanelGeometry(title: string): Promise<HyprlandPanelGeometry | null> {
  if (!process.env.HYPRLAND_INSTANCE_SIGNATURE) return null;
  try {
    const { stdout } = await runHyprctl('hyprctl', ['-j', 'clients'], hyprctlOptions);
    const clients: unknown = JSON.parse(stdout);
    if (!Array.isArray(clients)) return null;
    const panels = clients.filter(client => client?.pid === process.pid && client.title === title && client.mapped === true && client.hidden === false);
    if (panels.length !== 1) return null;
    const panel = panels[0];
    if (typeof panel.address !== 'string' || !hyprlandAddress.test(panel.address) || typeof panel.floating !== 'boolean' ||
        !Number.isInteger(panel.fullscreen) || !Number.isInteger(panel.fullscreenClient) ||
        !Array.isArray(panel.size) || panel.size.length !== 2 ||
        !panel.size.every((dimension: number) => Number.isSafeInteger(dimension) && dimension > 0)) return null;
    const fullscreen = panel.fullscreen !== 0 || panel.fullscreenClient !== 0;
    return { address: panel.address, width: panel.size[0], height: panel.size[1],
      placement: fullscreen ? 'fullscreen' : panel.floating ? 'floating' : 'tiled' };
  } catch { return null; }
}

export async function restoreHyprlandPanelTiling(address: string, signal: AbortSignal): Promise<void> {
  if (!process.env.HYPRLAND_INSTANCE_SIGNATURE || !hyprlandAddress.test(address) || signal.aborted) return;
  const selector = `address:${address}`;
  const options = { ...hyprctlOptions, signal };
  try {
    // Resolve the target in the compositor so an unmapped panel cannot affect the focused window.
    const script = `local panel = hl.get_window("${selector}")
if panel and panel.pid == ${process.pid} then
  hl.dispatch(hl.dsp.window.float({ window = "${selector}", action = "disable" }))
end`;
    const { stdout } = await runHyprctl('hyprctl', ['eval', script], options);
    const reply = stdout.trim();
    if (!signal.aborted && (reply === 'eval is only supported with the lua config manager' || reply === 'unknown request')) {
      await runHyprctl('hyprctl', ['dispatch', 'settiled', selector], options);
    }
  } catch { /* The next geometry read retains the compositor's actual placement. */ }
}

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
const ACTIONS: DesktopAction[] = ['capture', 'test', 'visibility', 'settings', 'exit', 'input', 'input-with-screenshot'];
const unavailable = (): never => { throw new Error('Wayland monitor selection is handled by the screen-sharing portal.'); };
export function createLinuxPlatform(options: LinuxOptions): DesktopPlatform {
  let action: ((value: DesktopAction) => void) | undefined, activate: (() => void) | undefined;
  let initialized = false, disposed = false;
  const pending: DesktopAction[] = [];
  function route(argv: string[], restore: boolean): void {
    const value = argv.find(arg => arg.startsWith('--action='))?.slice('--action='.length) as DesktopAction | undefined;
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
