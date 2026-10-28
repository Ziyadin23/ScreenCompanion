import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultSettings } from '../../src/contracts/defaults';
import { validBinding, validateShortcuts } from '../../src/platform/shortcuts';
import type { WindowsPlatform } from '../../src/contracts';

const mock = vi.hoisted(() => ({ load: vi.fn(), create: vi.fn(), callback: undefined as undefined | ((event: { type: string; action?: string; delta?: number }) => void) }));
vi.mock('node:module', () => ({ createRequire: () => mock.load }));
import { createWindowsPlatform } from '../../src/platform';
const originalPlatform = process.platform;
const handle = Buffer.alloc(8, 1);
let native: Record<string, ReturnType<typeof vi.fn>>;
let platform: WindowsPlatform;
beforeEach(() => {
  Object.defineProperty(process, 'platform', { configurable: true, value: 'win32' });
  native = Object.fromEntries(['acquireInstance', 'startCaptureProtection', 'protectWindow', 'activeMonitor', 'monitorForWindow', 'captureMonitor', 'crop', 'applyShortcuts', 'attachPanel', 'detachPanel', 'setHoverInputHeight', 'setPanelResizeEnabled', 'beginMove', 'beginResize', 'chooseColor', 'setOwnedDialogsVisible', 'closeOwnedDialogs', 'protectData', 'unprotectData', 'send', 'cancelRequest', 'dispose'].map(name => [name, vi.fn()]));
  native.acquireInstance!.mockResolvedValue(true); native.protectWindow!.mockReturnValue('Excluded');
  mock.load.mockReset().mockReturnValue({ createBridge: mock.create.mockReset().mockImplementation(callback => { mock.callback = callback; return native; }) });
  platform = createWindowsPlatform({ nativePath: 'synthetic-bridge.node' });
});
afterEach(() => { platform.dispose(); Object.defineProperty(process, 'platform', { configurable: true, value: originalPlatform }); vi.restoreAllMocks(); });

describe('native platform boundary (injected addon; no Windows runtime claim)', () => {
  it('loads the native bridge lazily and exactly once', () => {
    expect(mock.load).not.toHaveBeenCalled(); platform.startCaptureProtection(); platform.protectWindow(handle);
    expect(mock.load).toHaveBeenCalledExactlyOnceWith('synthetic-bridge.node'); expect(mock.create).toHaveBeenCalledOnce();
  });
  it('fails clearly on unsupported OS and never loads a simulated production fallback', () => {
    Object.defineProperty(process, 'platform', { configurable: true, value: 'linux' });
    expect(() => platform.activeMonitor()).toThrow('requires Windows'); expect(mock.load).not.toHaveBeenCalled();
  });
  it('sanitizes bridge load exceptions', () => {
    mock.load.mockImplementationOnce(() => { throw new Error('synthetic-secret-path'); });
    expect(() => platform.activeMonitor()).toThrow('could not be loaded');
    expect(() => { mock.load.mockImplementationOnce(() => { throw new Error('synthetic-secret-path'); }); platform.activeMonitor(); }).not.toThrow('synthetic-secret-path');
  });
  it('forwards activation including events delivered while acquisition is pending', async () => {
    const activate = vi.fn(); native.acquireInstance!.mockImplementationOnce(async () => { mock.callback?.({ type: 'activation' }); return true; });
    expect(await platform.acquireInstance(activate)).toBe(true); expect(activate).toHaveBeenCalledOnce();
  });
  it('keeps all six action IDs and only visibility/exit while recording', async () => {
    const action = vi.fn(), settings = defaultSettings('synthetic');
    await platform.applyShortcuts(settings, false, action);
    expect(native.applyShortcuts).toHaveBeenLastCalledWith([
      { action: 'capture', id: 1, modifiers: 3, key: 32 }, { action: 'test', id: 2, modifiers: 3, key: 84 },
      { action: 'visibility', id: 3, modifiers: 2, key: 191 }, { action: 'settings', id: 4, modifiers: 2, key: 73 },
      { action: 'exit', id: 5, modifiers: 2, key: 8 }, { action: 'input', id: 6, modifiers: 2, key: 13 }
    ]);
    for (const name of ['capture', 'test', 'visibility', 'settings', 'exit', 'input']) mock.callback?.({ type: 'action', action: name });
    expect(action.mock.calls.map(call => call[0])).toEqual(['capture', 'test', 'visibility', 'settings', 'exit', 'input']);
    await platform.applyShortcuts(settings, true, action);
    expect(native.applyShortcuts!.mock.lastCall?.[0].map((b: { id: number }) => b.id)).toEqual([3, 5]);
  });
  it('retains the previous callback when native shortcut registration rejects the replacement', async () => {
    const previous = vi.fn(), replacement = vi.fn(); await platform.applyShortcuts(defaultSettings('synthetic'), false, previous);
    native.applyShortcuts!.mockImplementationOnce(() => { throw new Error('Windows rejected a shortcut.'); });
    await expect(platform.applyShortcuts(defaultSettings('synthetic'), false, replacement)).rejects.toThrow();
    mock.callback?.({ type: 'action', action: 'capture' }); expect(previous).toHaveBeenCalledWith('capture'); expect(replacement).not.toHaveBeenCalled();
  });
  it('rejects duplicates/reserved keys before loading native code', async () => {
    const settings = defaultSettings('synthetic'); settings.Capture = { ...settings.Visibility };
    await expect(platform.applyShortcuts(settings, false, vi.fn())).rejects.toThrow('different shortcut');
    settings.Capture = { Modifiers: 2, Key: 123 };
    await expect(platform.applyShortcuts(settings, false, vi.fn())).rejects.toThrow(); expect(mock.load).not.toHaveBeenCalled();
  });
  it('detaches only the current panel subscription and ignores events after deterministic disposal', () => {
    const first = vi.fn(), second = vi.fn(); const stopFirst = platform.attachPanel(handle, first);
    const stopSecond = platform.attachPanel(handle, second); stopFirst(); expect(native.detachPanel).not.toHaveBeenCalled();
    mock.callback?.({ type: 'wheel', delta: 120 }); expect(first).not.toHaveBeenCalled(); expect(second).toHaveBeenCalledWith(120);
    stopSecond(); expect(native.detachPanel).toHaveBeenCalledOnce(); platform.dispose(); platform.dispose(); expect(native.dispose).toHaveBeenCalledOnce();
    mock.callback?.({ type: 'wheel', delta: 120 }); expect(second).toHaveBeenCalledTimes(1);
    expect(() => platform.activeMonitor()).toThrow('disposed');
  });
  it('cancels owned pickers through the native owner boundary and preserves a null result', async () => {
    native.chooseColor!.mockResolvedValue(null);
    const pending = platform.chooseColor(handle, '#123456');
    platform.setOwnedDialogsVisible(handle, false);
    platform.closeOwnedDialogs(handle);
    expect(native.closeOwnedDialogs).toHaveBeenCalledExactlyOnceWith(handle);
    expect(native.setOwnedDialogsVisible).toHaveBeenCalledWith(handle, false);
    await expect(pending).resolves.toBeNull();
    expect(() => platform.closeOwnedDialogs(Buffer.alloc(8))).toThrow('handle');
  });
  it('cancels panel interaction without detaching the dedicated hover subscription', () => {
    const wheel = vi.fn(); platform.attachPanel(handle, wheel);
    native.cancelPanelInteraction = vi.fn();
    platform.cancelPanelInteraction(handle);
    expect(native.cancelPanelInteraction).toHaveBeenCalledExactlyOnceWith(handle);
    expect(native.detachPanel).not.toHaveBeenCalled();
    mock.callback?.({ type: 'wheel', delta: 120 }); expect(wheel).toHaveBeenCalledWith(120);
    expect(() => platform.cancelPanelInteraction(Buffer.alloc(8))).toThrow('handle');
  });
  it('sends explicit resize eligibility without disturbing hover and rejects invalid permission inputs', () => {
    const wheel = vi.fn(); platform.attachPanel(handle, wheel);
    platform.setPanelResizeEnabled(handle, true); platform.setPanelResizeEnabled(handle, false);
    expect(native.setPanelResizeEnabled!.mock.calls).toEqual([[handle, true], [handle, false]]);
    expect(native.detachPanel).not.toHaveBeenCalled();
    mock.callback?.({ type: 'wheel', delta: 120 }); expect(wheel).toHaveBeenCalledWith(120);
    expect(() => platform.setPanelResizeEnabled(Buffer.alloc(8), true)).toThrow('handle');
    expect(() => platform.setPanelResizeEnabled(handle, 1 as unknown as boolean)).toThrow('resize');
    expect(native.setPanelResizeEnabled).toHaveBeenCalledTimes(2);
  });
  it('rejects invalid handles, dimensions and crop boundaries before native work', async () => {
    expect(() => platform.protectWindow(Buffer.alloc(8))).toThrow('handle');
    await expect(platform.captureMonitor({ x: -1920, y: 0, width: 0, height: 1080 })).rejects.toThrow('monitor size');
    await expect(platform.crop(Buffer.from('synthetic'), { x: 0.9, y: 0, width: 0.2, height: 1 })).rejects.toThrow('bounds');
    expect(mock.load).not.toHaveBeenCalled();
  });
  it('preserves physical negative monitor offsets and caller-owned image buffers', async () => {
    const bounds = { x: -1920, y: -200, width: 1920, height: 1080 }, image = Buffer.from('synthetic-jpeg');
    native.captureMonitor!.mockResolvedValue({ jpeg: image, bounds }); expect(await platform.captureMonitor(bounds)).toEqual({ jpeg: image, bounds });
    const cropped = Buffer.from('synthetic-crop'); native.crop!.mockResolvedValue(cropped);
    expect(await platform.crop(image, { x: 0, y: 0, width: 1, height: 1 })).toBe(cropped); expect(image.toString()).toBe('synthetic-jpeg');
  });
  it('accepts the shared crop rounding epsilon but rejects actual out-of-image bounds', async () => {
    const source = Buffer.from('synthetic-image');
    const region = { x: 0.9, y: 0.8, width: 0.1000005, height: 0.2000005 };
    native.crop!.mockResolvedValue(Buffer.from('synthetic-crop'));
    await expect(platform.crop(source, region)).resolves.toEqual(Buffer.from('synthetic-crop'));
    expect(native.crop).toHaveBeenCalledExactlyOnceWith(source, region);
    await expect(platform.crop(source, { ...region, width: 0.100002 })).rejects.toThrow('bounds');
    expect(native.crop).toHaveBeenCalledTimes(1);
  });
  it('uses separate connect/total timeouts and returns a generic unfollowed redirect response', async () => {
    const response = { status: 302, headers: { location: 'https://example.invalid' }, body: Buffer.alloc(0) }; native.send!.mockResolvedValue(response);
    expect(await platform.send({ url: 'https://example.invalid/api', headers: { Authorization: 'synthetic-key' }, body: Buffer.from('{}') })).toBe(response);
    expect(native.send).toHaveBeenCalledWith(expect.objectContaining({ connectTimeoutMs: 15000, timeoutMs: 90000 }), 1);
  });
  it('cancels an active request through response-body reads and removes abort listeners', async () => {
    const abort = new AbortController(); let reject: ((error: Error) => void) | undefined;
    native.send!.mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail; }));
    const result = platform.send({ url: 'https://example.invalid', headers: {}, body: Buffer.alloc(0) }, abort.signal);
    abort.abort(); expect(native.cancelRequest).toHaveBeenCalledWith(1); reject?.(new Error('Windows code 12017'));
    await expect(result).rejects.toHaveProperty('name', 'AbortError');
  });
  it('does not submit pre-cancelled requests', async () => {
    const abort = new AbortController(); abort.abort();
    await expect(platform.send({ url: 'https://example.invalid', headers: {}, body: Buffer.alloc(0) }, abort.signal)).rejects.toHaveProperty('name', 'AbortError');
    expect(mock.load).not.toHaveBeenCalled();
  });
  it.each([[12002, 'TimeoutError', 'request_timeout'], [12007, 'WindowsTransportError', 'network_dns'], [12175, 'WindowsTransportError', 'network_tls']])('returns content-free network metadata for Windows code %s', async (windowsCode, name, code) => {
    native.send!.mockRejectedValueOnce(new Error(`synthetic-secret-body (Windows code ${windowsCode}).`));
    const promise = platform.send({ url: 'https://example.invalid', headers: {}, body: Buffer.alloc(0) });
    await expect(promise).rejects.toMatchObject({ name, code, windowsCode }); await expect(promise).rejects.not.toThrow('synthetic-secret-body');
  });
  it('rejects credential URLs and header injection with safe messages', async () => {
    await expect(platform.send({ url: 'synthetic-secret-url', headers: {}, body: Buffer.alloc(0) })).rejects.not.toThrow('synthetic-secret-url');
    await expect(platform.send({ url: 'https://key:secret@example.invalid', headers: {}, body: Buffer.alloc(0) })).rejects.toThrow('invalid');
    await expect(platform.send({ url: 'https://example.invalid', headers: { Authorization: 'synthetic\r\ninjected' }, body: Buffer.alloc(0) })).rejects.toThrow('headers');
    expect(mock.load).not.toHaveBeenCalled();
  });
});

describe('portable shortcut validity', () => {
  it('preserves the C# modifier and reserved-key rules', () => {
    for (const key of [0, 123, 65535, -1]) expect(validBinding({ Key: key, Modifiers: 2 })).toBe(false);
    expect(validBinding({ Key: 17, Modifiers: 2 })).toBe(false); expect(validBinding({ Key: 91, Modifiers: 8 })).toBe(false);
    expect(validBinding({ Key: 18, Modifiers: 1 })).toBe(false); expect(validBinding({ Key: 16, Modifiers: 4 })).toBe(false);
    expect(validBinding({ Key: 65, Modifiers: 16 })).toBe(false); expect(validBinding({ Key: 65, Modifiers: 3 })).toBe(true);
    expect(() => validateShortcuts(defaultSettings('synthetic'))).not.toThrow();
  });
});
