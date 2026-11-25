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
  it('stops the capture stream if it never starts delivering frames', async () => {
    vi.useFakeTimers();
    try {
      const track = Object.assign(new EventTarget(), { stop: vi.fn(), getSettings: () => ({ displaySurface: 'monitor' }) });
      const stream = { getVideoTracks: () => [track], getTracks: () => [track] };
      const promise = runInNewContext(FRAME_SCRIPT, { navigator: { mediaDevices: { getDisplayMedia: async () => stream } },
        document: { createElement: () => ({ play: () => new Promise(() => {}) }) }, setTimeout, clearTimeout }) as Promise<unknown>;
      const rejection = expect(promise).rejects.toThrow('frame timeout');
      await vi.advanceTimersByTimeAsync(120_001); await rejection;
      expect(track.stop).toHaveBeenCalledOnce();
    } finally { vi.useRealTimers(); }
  }, 2000);
  it('keeps waiting while the portal chooser is open beyond a minute and stops promptly on cancellation', async () => {
    vi.useFakeTimers();
    try {
      const track = Object.assign(new EventTarget(), { stop: vi.fn(), getSettings: () => ({ displaySurface: 'monitor' }) });
      const stream = { getVideoTracks: () => [track], getTracks: () => [track] };
      const video = { play: () => new Promise(() => {}) };
      const promise = runInNewContext(FRAME_SCRIPT, { navigator: { mediaDevices: { getDisplayMedia: async () => stream } },
        document: { createElement: () => video }, setTimeout, clearTimeout }) as Promise<unknown>;
      const outcome = promise.catch(error => error);
      await vi.advanceTimersByTimeAsync(65_000);
      const stoppedWhileWaiting = track.stop.mock.calls.length;
      track.dispatchEvent(new Event('ended'));
      expect(await outcome).toHaveProperty('message', 'capture ended');
      expect(stoppedWhileWaiting).toBe(0);
      expect(track.stop).toHaveBeenCalledOnce();
      expect(vi.getTimerCount()).toBe(0);
    } finally { vi.useRealTimers(); }
  }, 2000);
  it('releases a track that already ended before playback can start', async () => {
    const track = { readyState: 'ended', stop: vi.fn(), getSettings: () => ({ displaySurface: 'monitor' }) };
    const stream = { getVideoTracks: () => [track], getTracks: () => [track] };
    const video = { play: vi.fn() };
    const promise = runInNewContext(FRAME_SCRIPT, { navigator: { mediaDevices: { getDisplayMedia: async () => stream } },
      document: { createElement: () => video } }) as Promise<unknown>;
    await expect(promise).rejects.toThrow('capture ended');
    expect(video.play).not.toHaveBeenCalled();
    expect(track.stop).toHaveBeenCalledOnce();
  });
  it('bounds presentation after playback starts and cancels a pending video callback', async () => {
    vi.useFakeTimers();
    try {
      const track = Object.assign(new EventTarget(), { stop: vi.fn(), getSettings: () => ({ displaySurface: 'monitor' }) });
      const stream = { getVideoTracks: () => [track], getTracks: () => [track] };
      const video = {
        play: () => new Promise(resolve => setTimeout(resolve, 12_000)),
        requestVideoFrameCallback: vi.fn(() => 4),
        cancelVideoFrameCallback: vi.fn()
      };
      const promise = runInNewContext(FRAME_SCRIPT, { navigator: { mediaDevices: { getDisplayMedia: async () => stream } },
        document: { createElement: () => video }, setTimeout, clearTimeout }) as Promise<unknown>;
      const outcome = promise.catch(error => error);
      await vi.advanceTimersByTimeAsync(12_000);
      expect(video.requestVideoFrameCallback).toHaveBeenCalledOnce();
      await vi.advanceTimersByTimeAsync(10_000);
      expect(await outcome).toHaveProperty('message', 'frame timeout');
      expect(video.cancelVideoFrameCallback).toHaveBeenCalledWith(4);
      expect(track.stop).toHaveBeenCalledOnce();
      expect(vi.getTimerCount()).toBe(0);
    } finally { vi.useRealTimers(); }
  }, 2000);
  it('captures an already decoded frame without waiting for another presentation', async () => {
    vi.useFakeTimers();
    try {
      const track = Object.assign(new EventTarget(), { stop: vi.fn(), getSettings: () => ({ displaySurface: 'monitor' }) });
      const stream = { getVideoTracks: () => [track], getTracks: () => [track] };
      const video = { play: async () => {}, readyState: 2, HAVE_CURRENT_DATA: 2, videoWidth: 1280, videoHeight: 900,
        requestVideoFrameCallback: vi.fn(() => 1), cancelVideoFrameCallback: vi.fn() };
      const drawImage = vi.fn();
      const bytes = new ArrayBuffer(3);
      const canvas = { getContext: () => ({ drawImage }), toBlob: (callback: (blob: unknown) => void) => callback({ arrayBuffer: async () => bytes }) };
      const promise = runInNewContext(FRAME_SCRIPT, { navigator: { mediaDevices: { getDisplayMedia: async () => stream } },
        document: { createElement: (name: string) => name === 'video' ? video : canvas }, setTimeout, clearTimeout }) as Promise<unknown>;
      const outcome = promise.catch(error => ({ error: error.message }));
      await vi.advanceTimersByTimeAsync(10_001);
      expect(await outcome).toEqual({ width: 1280, height: 900, bytes });
      expect(drawImage).toHaveBeenCalledWith(video, 0, 0, 1280, 900);
      expect(video.requestVideoFrameCallback).not.toHaveBeenCalled();
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
