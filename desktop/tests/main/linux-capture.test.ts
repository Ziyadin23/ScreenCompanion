import { describe, expect, it, vi } from 'vitest';
import { runInNewContext } from 'node:vm';
import { createCaptureGate, createPortalCapture, FRAME_SCRIPT } from '../../src/main/linux-capture';

describe('Linux screen-capture authorization', () => {
  it('permits exactly one video-only request from the app main frame after an initiated capture', () => {
    const contents = {}, frame = {}, other = {};
    const gate = createCaptureGate(contents, frame, url => url === 'file:///trusted/index.html');
    expect(gate.permission(contents, 'display-capture', true, 'file:///trusted/index.html')).toBe(false);
    gate.begin();
    expect(gate.permission(other, 'display-capture', true, 'file:///trusted/index.html')).toBe(false);
    expect(gate.permission(contents, 'media', true, 'file:///trusted/index.html')).toBe(false);
    expect(gate.permission(contents, 'display-capture', false, 'file:///trusted/index.html')).toBe(false);
    expect(gate.permission(contents, 'display-capture', true, 'file:///untrusted.html')).toBe(false);
    expect(gate.permission(contents, 'display-capture', true, 'file:///trusted/index.html')).toBe(true);
    expect(gate.consume(other, true, false, true)).toBe(false);
    expect(gate.consume(frame, true, true, true)).toBe(false);
    expect(gate.consume(frame, true, false, false)).toBe(false);
    expect(gate.consume(frame, true, false, true)).toBe(true);
    expect(gate.consume(frame, true, false, true)).toBe(false);
  });
  it('stops the capture stream if a selected screen never starts delivering frames', async () => {
    vi.useFakeTimers();
    try {
      const track = { stop: vi.fn(), getSettings: () => ({ displaySurface: 'monitor' }) };
      const stream = { getVideoTracks: () => [track], getTracks: () => [track] };
      const promise = runInNewContext(FRAME_SCRIPT, { navigator: { mediaDevices: { getDisplayMedia: async () => stream } },
        document: { createElement: () => ({ play: () => new Promise(() => {}) }) }, setTimeout, clearTimeout }) as Promise<unknown>;
      const rejection = expect(promise).rejects.toThrow('frame timeout');
      await vi.advanceTimersByTimeAsync(10001); await rejection;
      expect(track.stop).toHaveBeenCalledOnce();
    } finally { vi.useRealTimers(); }
  }, 2000);
  it('starts one portal-selected screen stream without enumerating sources first', async () => {
    const frame = {};
    let select!: (request: unknown, callback: (value: unknown) => void) => void;
    const session = { setPermissionCheckHandler() {}, setPermissionRequestHandler() {},
      setDisplayMediaRequestHandler(handler: typeof select) { select = handler; } };
    const contents = { mainFrame: frame, session, getURL: () => 'file:///trusted/index.html',
      async executeJavaScript() {
        const granted = await new Promise(resolve => select({ frame, videoRequested: true, audioRequested: false, userGesture: true }, resolve));
        expect(granted).toEqual({ video: { id: 'screen:0:0', name: 'Screen' } });
        return { width: 1920, height: 1080, bytes: new Uint8Array([1, 2, 3]).buffer };
      } };
    const capture = createPortalCapture({ contents: contents as unknown as Electron.WebContents, trustedUrl: () => true });
    const result = await capture();
    expect(result.bounds).toEqual({ x: 0, y: 0, width: 1920, height: 1080 });
  });
});
