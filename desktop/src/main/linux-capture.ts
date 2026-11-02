import type { CapturedFrame } from '../contracts';
import { AppError } from './diagnostics';

export function createCaptureGate(contents: object, frame: object, trustedUrl: (url: string) => boolean) {
  let armed = false, consumed = false;
  return {
    begin() { if (armed) throw new Error('A capture is already active.'); armed = true; consumed = false; },
    end() { armed = false; consumed = false; },
    permission(sender: unknown, permission: string, mainFrame: boolean, url: string) {
      return armed && sender === contents && permission === 'display-capture' && mainFrame && trustedUrl(url);
    },
    consume(senderFrame: unknown, video: boolean, audio: boolean, gesture: boolean) {
      if (!armed || consumed || senderFrame !== frame || !video || audio || !gesture) return false;
      consumed = true; return true;
    }
  };
}

// Runs only in the trusted top-level renderer after the controller hides the window.
export const FRAME_SCRIPT = `(async () => {
  let stream, video, canvas, timer;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({ video: { width: { ideal: 32768 }, height: { ideal: 32768 }, frameRate: { ideal: 1, max: 1 } }, audio: false });
    const track = stream.getVideoTracks()[0];
    if (!track || (track.getSettings().displaySurface && track.getSettings().displaySurface !== 'monitor')) throw new Error('monitor required');
    video = document.createElement('video'); video.muted = true; video.srcObject = stream;
    await new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new Error('frame timeout')), 10000);
      video.play().then(() => video.requestVideoFrameCallback(() => { clearTimeout(timer); resolve(); }), reject);
    });
    const width = video.videoWidth, height = video.videoHeight;
    if (!width || !height || width > 32768 || height > 32768 || width * height > 134217728) throw new Error('invalid frame');
    canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d'); if (!context) throw new Error('canvas unavailable');
    context.drawImage(video, 0, 0, width, height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.95));
    if (!blob) throw new Error('encoding failed');
    return { width, height, bytes: await blob.arrayBuffer() };
  } finally {
    clearTimeout(timer); if (stream) for (const track of stream.getTracks()) track.stop();
    if (video) video.srcObject = null; if (canvas) { canvas.width = 0; canvas.height = 0; }
  }
})()`;

export function createPortalCapture(options: {
  contents: Electron.WebContents; trustedUrl(url: string): boolean;
}): () => Promise<CapturedFrame> {
  const { contents } = options, session = contents.session;
  const gate = createCaptureGate(contents, contents.mainFrame, options.trustedUrl);
  session.setPermissionCheckHandler((sender, permission, _origin, details) =>
    gate.permission(sender, permission, details.isMainFrame, details.requestingUrl ?? contents.getURL()));
  session.setPermissionRequestHandler((sender, permission, callback, details) =>
    callback(gate.permission(sender, permission, details.isMainFrame, details.requestingUrl)));
  session.setDisplayMediaRequestHandler((request, callback) => {
    if (!gate.consume(request.frame, request.videoRequested, request.audioRequested, request.userGesture) || !options.trustedUrl(contents.getURL())) { callback(null); return; }
    // PipeWire opens the system monitor picker for this screen source. Enumerating
    // sources first opens a separate portal session and can select another monitor.
    callback({ video: { id: 'screen:0:0', name: 'Screen' } });
  });
  return async () => {
    gate.begin();
    try {
      const value = await contents.executeJavaScript(FRAME_SCRIPT, true) as { width: number; height: number; bytes: ArrayBuffer };
      if (!Number.isSafeInteger(value.width) || !Number.isSafeInteger(value.height) || value.width <= 0 || value.height <= 0 ||
          value.width * value.height > 128 * 1024 * 1024 || !(value.bytes instanceof ArrayBuffer) || !value.bytes.byteLength) throw new Error('invalid frame');
      return { jpeg: Buffer.from(value.bytes), bounds: { x: 0, y: 0, width: value.width, height: value.height } };
    } catch {
      throw new AppError('CANCELLED', 'Screen capture was cancelled or unavailable. Select a monitor in the desktop sharing prompt and try again.');
    } finally { gate.end(); }
  };
}
