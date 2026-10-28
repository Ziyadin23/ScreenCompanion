// Run with Electron on Windows: npm run test:windows. No credentials or paid APIs.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { startShortcutHolder } from './shortcut-contention.mjs';

if (process.platform !== 'win32') {
  console.log('SKIP Windows native capture/crop, DPAPI, affinity, hook cleanup, activation, shortcuts and WinHTTP: host is not Windows.');
  process.exit(0);
}
const { app, BrowserWindow, nativeImage } = await import('electron');
const require = createRequire(import.meta.url);
const nativePath = fileURLToPath(new URL('../../native/build/Release/sc_windows.node', import.meta.url));
let bridge, second, panel, server, holder;
let checks = 0;
const check = (condition, message) => { assert.ok(condition, message); ++checks; console.log(`PASS native check ${checks}: ${message}`); };
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const deadline = setTimeout(() => { console.error(`FAIL Windows native verification deadline after ${checks} checks.`); app.exit(1); }, 90000);
const secrets = [];
const sockets = new Set();
// Let the ESM entry finish loading before Electron emits ready.
async function verify() {
try {
  await app.whenReady();
  const { createBridge } = require(nativePath);
  const events = [];
  bridge = createBridge(event => events.push(event));
  check(await bridge.acquireInstance(), 'isolated test session must not already have an SC owner');
  bridge.startCaptureProtection();
  panel = new BrowserWindow({ show: false, width: 480, height: 320, transparent: true, frame: false, resizable: false,
    webPreferences: { sandbox: true, nodeIntegration: false, contextIsolation: true } });
  panel.setContentProtection(true);
  const handle = panel.getNativeWindowHandle();
  check(['Excluded', 'ContentHidden'].includes(bridge.protectWindow(handle)), 'native affinity must be observable');
  await panel.loadURL('data:text/html,<html><body style="background:%231A202C;color:white">SC synthetic native verification</body></html>');
  panel.showInactive();
  const monitor = bridge.activeMonitor(), typedMonitor = bridge.monitorForWindow(handle);
  check(monitor.width > 0 && monitor.height > 0 && typedMonitor.width > 0 && typedMonitor.height > 0, 'real physical monitor bounds');
  const captured = await bridge.captureMonitor(monitor); secrets.push(captured.jpeg);
  const decoded = nativeImage.createFromBuffer(captured.jpeg);
  check(!decoded.isEmpty(), 'real capture is decodable JPEG');
  check(decoded.getSize().width === monitor.width && decoded.getSize().height === monitor.height, 'capture preserves physical dimensions');
  check(captured.bounds.x === monitor.x && captured.bounds.y === monitor.y, 'capture preserves physical offsets');
  const cropped = await bridge.crop(captured.jpeg, { x: 0.1, y: 0.2, width: 0.35, height: 0.4 }); secrets.push(cropped);
  const cropImage = nativeImage.createFromBuffer(cropped), cropSize = cropImage.getSize();
  check(cropSize.width === Math.ceil(0.45 * monitor.width) - Math.floor(0.1 * monitor.width), 'real crop includes boundary pixels horizontally');
  check(cropSize.height === Math.ceil((0.2 + 0.4) * monitor.height) - Math.floor(0.2 * monitor.height), 'real crop includes boundary pixels vertically');
  check(captured.jpeg[0] === 0xff && captured.jpeg[1] === 0xd8 && cropped[0] === 0xff && cropped[1] === 0xd8, 'capture and crop are genuine JPEG');
  // Synthetic image verifies actual crop placement and pixels, separately from real monitor capture.
  const bitmap = Buffer.alloc(128 * 128 * 4); secrets.push(bitmap);
  for (let y = 0; y < 128; ++y) for (let x = 0; x < 128; ++x) {
    const offset = (y * 128 + x) * 4; bitmap[offset] = x < 64 ? 10 : 240; bitmap[offset + 1] = y < 64 ? 10 : 240; bitmap[offset + 2] = 10; bitmap[offset + 3] = 255;
  }
  const synthetic = nativeImage.createFromBitmap(bitmap, { width: 128, height: 128 }).toJPEG(88); secrets.push(synthetic);
  const selected = await bridge.crop(synthetic, { x: 0.5, y: 0.5, width: 0.5, height: 0.5 }); secrets.push(selected);
  const selectedImage = nativeImage.createFromBuffer(selected), selectedPixels = selectedImage.toBitmap(); secrets.push(selectedPixels);
  check(selectedImage.getSize().width === 64 && selectedImage.getSize().height === 64, 'synthetic JPEG crop dimensions');
  const sample = (32 * 64 + 32) * 4;
  check(selectedPixels[sample] > 200 && selectedPixels[sample + 1] > 200 && selectedPixels[sample + 2] < 50, 'synthetic JPEG crop retains the selected quadrant');
  const plain = Buffer.from('SC synthetic CurrentUser DPAPI fixture'); secrets.push(plain);
  const encrypted = bridge.protectData(plain); secrets.push(encrypted);
  check(!encrypted.includes(plain), 'DPAPI does not persist plaintext');
  const decrypted = bridge.unprotectData(encrypted); secrets.push(decrypted); check(decrypted.equals(plain), 'real DPAPI CurrentUser roundtrip');
  const damaged = Buffer.from(encrypted); secrets.push(damaged); damaged[Math.floor(damaged.length / 2)] ^= 0xff;
  assert.throws(() => bridge.unprotectData(damaged)); ++checks;
  const pendingPicker = bridge.chooseColor(handle, '#123456');
  bridge.closeOwnedDialogs(handle);
  check(await pendingPicker === null, 'closing an owner cancels its queued or active native color picker');
  bridge.attachPanel(handle); bridge.setHoverInputHeight(48); bridge.detachPanel();
  bridge.attachPanel(handle); bridge.detachPanel(); ++checks;
  const bindings = [{ id: 1, modifiers: 3, key: 32 }, { id: 2, modifiers: 3, key: 84 }, { id: 3, modifiers: 2, key: 191 }, { id: 4, modifiers: 2, key: 73 }, { id: 5, modifiers: 2, key: 8 }, { id: 6, modifiers: 2, key: 13 }];
  bridge.applyShortcuts(bindings); bridge.applyShortcuts(bindings.filter(b => [3, 5].includes(b.id)));
  assert.throws(() => bridge.applyShortcuts([{ id: 1, modifiers: 2, key: 123 }])); ++checks;
  bridge.applyShortcuts(bindings);
  holder = await startShortcutHolder();
  const fresh = { id: 701, modifiers: 6, key: 120 }, occupied = { id: 702, modifiers: 6, key: 121 };
  check((await holder.request({ operation: 'probe', ...fresh })).ok, 'first candidate is genuinely free before partial registration');
  check((await holder.request({ operation: 'hold', ...occupied })).ok, 'independent process owns the second candidate through RegisterHotKey');
  // Runtime::Apply visits ascending IDs: candidate 1 registers before candidate 2 fails.
  assert.throws(() => bridge.applyShortcuts([{ ...fresh, id: 1 }, { ...occupied, id: 2 }, ...bindings.slice(2)])); ++checks;
  check((await holder.request({ operation: 'probe', ...fresh })).ok, 'partial failure frees the successfully registered first candidate');
  for (const binding of bindings) {
    check(!(await holder.request({ operation: 'probe', ...binding, id: 710 + binding.id })).ok, 'partial failure restores each prior OS binding');
  }
  for (const [index, action] of ['capture', 'test', 'visibility', 'settings', 'exit', 'input'].entries()) {
    const binding = bindings[index], prior = events.filter(event => event.type === 'action' && event.action === action).length;
    await holder.request({ operation: 'send', keys: [...(binding.modifiers & 2 ? [17] : []), ...(binding.modifiers & 1 ? [18] : []), binding.key] });
    for (const deadline = Date.now() + 2000; Date.now() < deadline && events.filter(event => event.type === 'action' && event.action === action).length === prior;) await pause(20);
    check(events.filter(event => event.type === 'action' && event.action === action).length === prior + 1, 'partial rollback preserves each real SendInput shortcut action');
  }
  await holder.request({ operation: 'release', id: occupied.id });
  bridge.applyShortcuts([{ ...fresh, id: 1 }, { ...occupied, id: 2 }, ...bindings.slice(2)]);
  check(!(await holder.request({ operation: 'probe', ...fresh })).ok && !(await holder.request({ operation: 'probe', ...occupied })).ok,
    'the same candidate set succeeds after the external owner releases it');
  bridge.applyShortcuts(bindings);
  second = createBridge(() => {}); check(!await second.acquireInstance(), 'duplicate owner activates instead of acquiring session');
  await pause(100); check(events.some(e => e.type === 'activation'), 'real message-only activation delivered');
  second.dispose(); second = undefined;
  server = createServer((request, response) => {
    if (request.url === '/redirect') { response.writeHead(302, { location: '/unexpected' }); response.end(); }
    else if (request.url === '/redirect-stall') { response.writeHead(307, { location: '/unexpected' }); response.flushHeaders(); }
    else if (request.url === '/html-stall') { response.writeHead(200, { 'content-type': 'text/html; charset=UTF-8' }); response.flushHeaders(); }
    else if (request.url === '/proxy-stall') { response.writeHead(407, { 'proxy-authenticate': 'Basic' }); response.flushHeaders(); }
    else if (request.url === '/signin-stall') { response.writeHead(511); response.flushHeaders(); }
    else if (request.url === '/stall') { response.writeHead(200, { 'content-type': 'application/json' }); response.write('{'); }
    else if (request.url === '/unexpected') { response.writeHead(500); response.end('redirect was incorrectly followed'); }
    else { response.writeHead(200, { 'content-type': 'application/json' }); response.end('{"synthetic":true}'); }
  });
  server.on('connection', socket => { sockets.add(socket); socket.once('close', () => sockets.delete(socket)); });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = path => ({ url: `${base}${path}`, headers: { 'content-type': 'application/json' }, body: Buffer.from('{}'), connectTimeoutMs: 15000, timeoutMs: 3000 });
  const success = await bridge.send(request('/ok'), 1); secrets.push(success.body); check(success.status === 200, 'real asynchronous WinHTTP loopback');
  const redirect = await bridge.send(request('/redirect'), 2); secrets.push(redirect.body); check(redirect.status === 302, 'WinHTTP does not follow redirects');
  for (const [index, path, status] of [[0, '/redirect-stall', 307], [1, '/html-stall', 200], [2, '/proxy-stall', 407], [3, '/signin-stall', 511]]) {
    const rejected = await bridge.send({ ...request(path), timeoutMs: 1000 }, 10 + index);
    secrets.push(rejected.body);
    check(rejected.status === status && rejected.body.length === 0, 'network interception is returned at headers without reading a stalled body');
    if (path === '/html-stall') check(rejected.headers['content-type'].startsWith('text/html'), 'interception response preserves content type');
  }
  const timed = bridge.send({ ...request('/stall'), timeoutMs: 150 }, 3); await assert.rejects(timed, /12002/); ++checks;
  const cancelled = bridge.send(request('/stall'), 4); setTimeout(() => bridge.cancelRequest(4), 100); await assert.rejects(cancelled, /12017/); ++checks;
  bridge.dispose(); bridge.dispose(); bridge = undefined; ++checks;
  for (const binding of bindings) {
    check((await holder.request({ operation: 'probe', ...binding, id: 710 + binding.id })).ok, 'native disposal releases each registered OS binding');
  }
  await holder.close(); holder = undefined;
  // Reacquisition proves mutex/hotkey/message-thread ownership was released.
  bridge = createBridge(() => {}); check(await bridge.acquireInstance(), 'native disposal releases session ownership');
  bridge.applyShortcuts(bindings); bridge.applyShortcuts([]); ++checks;
  console.log(`PASS Windows native verification: ${checks} checks; real JPEG capture/crop, DPAPI, local WinHTTP, activation and disposal.`);
  console.log('PENDING separate Windows UI/recorder gates: panel geometry and real-store size, Settings rollback/help/draft, color picker, wheel while JS is busy, abandoned owner recovery, launches from different paths, multi-DPI placement and named recorder/receiver output.');
} catch (error) {
  // Fixed failure text and assertion code only; never output image/content/native exception messages.
  console.error(`FAIL Windows native verification: ${checks} checks completed; ${error?.code === 'ERR_ASSERTION' ? 'assertion failed' : 'native operation failed'}.`);
  process.exitCode = 1;
} finally {
  clearTimeout(deadline);
  second?.dispose(); bridge?.dispose(); panel?.destroy();
  await holder?.close();
  for (const socket of sockets) socket.destroy();
  if (server?.listening) await new Promise(resolve => server.close(resolve));
  for (const secret of secrets) secret.fill(0);
  app.exit(process.exitCode ?? 0);
}
}
void verify();
