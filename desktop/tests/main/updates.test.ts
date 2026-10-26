import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { ApplicationUpdates } from '../../src/main/updates';
import type { UpdateState } from '../../src/contracts';
import { createDiagnostics } from '../../src/main/diagnostics';
import { updateActionSchema } from '../../src/main/validation';

function checkResult(version = '0.5.0-beta.4', isUpdateAvailable = true) {
  const info = { version, files: [], releaseDate: '2026-10-25', releaseNotes: '<script>private</script>' };
  return { isUpdateAvailable, updateInfo: info, versionInfo: info };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
class Client extends EventEmitter {
  autoDownload = true; autoInstallOnAppQuit = true; allowPrerelease = false; allowDowngrade = true;
  disableWebInstaller = false; logger: unknown = console;
  checkForUpdates = vi.fn(async (): Promise<ReturnType<typeof checkResult> | null> => {
    const result = checkResult(); this.emit('update-available', result.updateInfo); return result;
  });
  downloadUpdate = vi.fn(async () => {
    this.emit('download-progress', { percent: 51.2 });
    this.emit('update-downloaded', { version: '0.5.0-beta.4', path: 'private-path' }); return ['private-path'];
  });
  quitAndInstall = vi.fn();
}
function fixture(version = '0.5.0-beta.3') {
  const client = new Client();
  const states: UpdateState[] = [];
  const diagnostics = createDiagnostics(null, version);
  const failure = vi.spyOn(diagnostics, 'failure');
  const canInstall = vi.fn(() => true);
  const updates = new ApplicationUpdates({
    client: client as unknown as NonNullable<ConstructorParameters<typeof ApplicationUpdates>[0]['client']>,
    version, diagnostics, canInstall, publish: state => states.push(state)
  });
  return { client, updates, states, failure, canInstall };
}
describe('installed application updates', () => {
  it('checks without downloading, installs only on request and disables automatic exit installation', async () => {
    const f = fixture();
    expect(f.client).toMatchObject({ autoDownload: false, autoInstallOnAppQuit: false, allowPrerelease: true,
      allowDowngrade: false, disableWebInstaller: true, logger: null });
    await f.updates.action('download'); await f.updates.action('install');
    expect(f.client.downloadUpdate).not.toHaveBeenCalled(); expect(f.client.quitAndInstall).not.toHaveBeenCalled();
    await f.updates.action('check');
    expect(f.updates.getState()).toMatchObject({ status: 'available', version: '0.5.0-beta.4' });
    expect(f.client.downloadUpdate).not.toHaveBeenCalled();
    await f.updates.action('download');
    expect(f.states.some(state => state.progress === 51)).toBe(true);
    expect(f.updates.getState()).toMatchObject({ status: 'downloaded', progress: 100 });
    expect(f.client.quitAndInstall).not.toHaveBeenCalled();
    await f.updates.action('check'); expect(f.client.checkForUpdates).toHaveBeenCalledTimes(1);
    await f.updates.action('install'); await f.updates.action('install');
    expect(f.client.quitAndInstall).toHaveBeenCalledExactlyOnceWith(false, true);
    expect(f.updates.getState().status).toBe('installing');
    expect(JSON.stringify(f.states)).not.toMatch(/private|script|path/u);
  });
  it('keeps stable builds on stable releases and prevents downgrades', () => {
    const f = fixture('0.5.0'); expect(f.client.allowPrerelease).toBe(false); expect(f.client.allowDowngrade).toBe(false);
  });
  it('keeps portable, development and preview builds disconnected from the updater', async () => {
    const publish = vi.fn(); const canInstall = vi.fn();
    const updates = new ApplicationUpdates({ client: null, version: '0.5.0-beta.3', diagnostics: createDiagnostics(null, 'test'), publish, canInstall });
    await updates.action('check'); await updates.action('download'); await updates.action('install');
    expect(updates.getState().status).toBe('disabled'); expect(publish).not.toHaveBeenCalled(); expect(canInstall).not.toHaveBeenCalled();
  });
  it('blocks overlapping checks until the original request completes', async () => {
    const f = fixture(); let finish!: () => void;
    f.client.checkForUpdates.mockImplementationOnce(() => new Promise(resolve => { finish = () => { f.client.emit('update-not-available'); resolve(checkResult('0.5.0-beta.3', false)); }; }));
    const checking = f.updates.action('check');
    await f.updates.action('check'); await f.updates.action('download'); await f.updates.action('install');
    expect(f.client.checkForUpdates).toHaveBeenCalledTimes(1); expect(f.client.downloadUpdate).not.toHaveBeenCalled();
    finish(); await checking; expect(f.updates.getState().status).toBe('current');
  });
  it('preserves the downloaded update when a request or settings action blocks restart', async () => {
    const f = fixture(); await f.updates.action('check'); await f.updates.action('download');
    f.canInstall.mockReturnValue(false);
    await expect(f.updates.action('install')).rejects.toMatchObject({ code: 'UPDATEBUSY' });
    expect(f.updates.getState().status).toBe('downloaded'); expect(f.client.quitAndInstall).not.toHaveBeenCalled();
    f.canInstall.mockReturnValue(true); await f.updates.action('install'); expect(f.client.quitAndInstall).toHaveBeenCalledTimes(1);
  });
  it('handles an emitted download failure and its rejection once without exposing raw content', async () => {
    const f = fixture(); await f.updates.action('check');
    f.client.downloadUpdate.mockImplementationOnce(async () => {
      const error = new Error('private-key private-path provider-body'); f.client.emit('error', error); throw error;
    });
    await f.updates.action('download');
    expect(f.updates.getState().status).toBe('error'); expect(f.failure).toHaveBeenCalledTimes(1);
    expect(f.failure).toHaveBeenCalledWith('Updates', expect.objectContaining({ code: 'UPDATEFAILED', message: 'SC could not complete the update.' }));
    expect(JSON.stringify([f.states, f.failure.mock.calls])).not.toContain('private-');
    await f.updates.action('install'); expect(f.client.quitAndInstall).not.toHaveBeenCalled();
    expect(f.updates.getState().version).toBe('0.5.0-beta.4');
    await f.updates.action('download'); expect(f.updates.getState().status).toBe('downloaded');
    expect(f.client.checkForUpdates).toHaveBeenCalledTimes(1);
  });
  it.each(['invalid-version', '<script>', '1.2.3\nsecret'])('rejects invalid release metadata %s', async version => {
    const f = fixture(); f.client.checkForUpdates.mockImplementationOnce(async () => { f.client.emit('update-available', { version }); return checkResult(version); });
    await f.updates.action('check'); await f.updates.action('download');
    expect(f.updates.getState().status).toBe('error'); expect(f.client.downloadUpdate).not.toHaveBeenCalled();
  });
  it('accepts a bounded release version with build metadata', async () => {
    const f = fixture(); const version = '0.5.0-beta.4+build.1';
    f.client.checkForUpdates.mockResolvedValueOnce(checkResult(version));
    f.client.downloadUpdate.mockImplementationOnce(async () => { f.client.emit('update-downloaded', { version }); return ['private-path']; });
    await f.updates.action('check'); await f.updates.action('download');
    expect(f.updates.getState()).toMatchObject({ status: 'downloaded', version });
  });
  it('does not accept an unrelated or mismatched downloaded event', async () => {
    const f = fixture(); f.client.emit('update-downloaded', { version: '0.5.0-beta.4' });
    expect(f.updates.getState().status).toBe('idle'); await f.updates.action('check');
    f.client.downloadUpdate.mockImplementationOnce(async () => { f.client.emit('update-downloaded', { version: '0.5.0-beta.5' }); return []; });
    await f.updates.action('download'); await f.updates.action('install');
    expect(f.updates.getState().status).toBe('error'); expect(f.client.quitAndInstall).not.toHaveBeenCalled();
  });
  it('reports an unavailable update feed and retries checking', async () => {
    const f = fixture(); f.client.checkForUpdates.mockRejectedValueOnce(new Error('private-network-body'));
    await f.updates.action('check'); expect(f.updates.getState().status).toBe('error');
    await f.updates.action('check'); expect(f.updates.getState().status).toBe('available');
  });
  it('recovers when installation fails before quitting', async () => {
    const f = fixture(); await f.updates.action('check'); await f.updates.action('download');
    f.client.quitAndInstall.mockImplementationOnce(() => f.client.emit('error', new Error('private-path')));
    await f.updates.action('install'); expect(f.updates.getState().status).toBe('error');
    await f.updates.action('check'); expect(f.updates.getState().status).toBe('available');
  });
  it('keeps checking until the check promise settles and uses its result instead of stale release events', async () => {
    const f = fixture(); const pending = deferred<ReturnType<typeof checkResult>>();
    f.client.checkForUpdates.mockImplementationOnce(() => pending.promise);
    const checking = f.updates.action('check');
    f.client.emit('update-available', { version: '0.5.0-beta.99' });
    f.client.emit('update-not-available', { version: '0.5.0-beta.3' });
    expect(f.updates.getState().status).toBe('checking');
    pending.resolve(checkResult()); await checking;
    expect(f.updates.getState()).toMatchObject({ status: 'available', version: '0.5.0-beta.4' });
    await f.updates.action('download'); expect(f.updates.getState().status).toBe('downloaded');
  });
  it('does not offer a downgrade when the completed check reports the installed version is current', async () => {
    const f = fixture();
    f.client.checkForUpdates.mockImplementationOnce(async () => {
      f.client.emit('update-available', { version: '0.4.14' }); return checkResult('0.4.14', false);
    });
    await f.updates.action('check'); await f.updates.action('download');
    expect(f.updates.getState().status).toBe('current'); expect(f.client.downloadUpdate).not.toHaveBeenCalled();
  });
  it('does not offer installation until download bookkeeping finishes', async () => {
    const f = fixture(); await f.updates.action('check'); const pending = deferred<string[]>();
    f.client.downloadUpdate.mockImplementationOnce(() => pending.promise);
    const downloading = f.updates.action('download');
    f.client.emit('update-downloaded', { version: '0.5.0-beta.4', downloadedFile: 'private-path' });
    expect(f.updates.getState().status).toBe('downloading');
    await f.updates.action('check'); await f.updates.action('download'); await f.updates.action('install');
    expect(f.client.downloadUpdate).toHaveBeenCalledTimes(1); expect(f.client.quitAndInstall).not.toHaveBeenCalled();
    pending.resolve(['private-path']); await downloading;
    await f.updates.action('install'); expect(f.client.quitAndInstall).toHaveBeenCalledTimes(1);
  });
  it('turns a download failure after the downloaded event into an explicit retry', async () => {
    const f = fixture(); await f.updates.action('check'); const pending = deferred<string[]>();
    f.client.downloadUpdate.mockImplementationOnce(() => pending.promise);
    const downloading = f.updates.action('download');
    f.client.emit('update-downloaded', { version: '0.5.0-beta.4' });
    pending.reject(new Error('private-cache-path')); await downloading;
    expect(f.updates.getState()).toMatchObject({ status: 'error', version: '0.5.0-beta.4', progress: null });
    expect(f.states.some(state => state.status === 'downloaded')).toBe(false);
    expect(f.failure).toHaveBeenCalledTimes(1);
    await f.updates.action('install'); expect(f.client.quitAndInstall).not.toHaveBeenCalled();
    await f.updates.action('download'); expect(f.updates.getState().status).toBe('downloaded');
  });
  it('ignores uncorrelated error events and uses the network promise to decide failure', async () => {
    const f = fixture(); f.client.emit('error', new Error('private-old-check'));
    expect(f.updates.getState().status).toBe('idle');
    const pending = deferred<ReturnType<typeof checkResult>>();
    f.client.checkForUpdates.mockImplementationOnce(() => pending.promise);
    const checking = f.updates.action('check'); f.client.emit('error', new Error('private-stale-download'));
    expect(f.updates.getState().status).toBe('checking');
    pending.resolve(checkResult()); await checking;
    f.client.emit('error', new Error('private-old-check'));
    expect(f.updates.getState().status).toBe('available');
    await f.updates.action('download'); f.client.emit('error', new Error('private-old-download'));
    expect(f.updates.getState().status).toBe('downloaded'); expect(f.failure).not.toHaveBeenCalled();
  });
  it('fails a check with no usable result and can retry', async () => {
    const f = fixture(); f.client.checkForUpdates.mockResolvedValueOnce(null);
    await f.updates.action('check'); expect(f.updates.getState()).toMatchObject({ status: 'error', version: null });
    await f.updates.action('check'); expect(f.updates.getState().status).toBe('available');
  });
  it('fails a completed download with no matching completion event instead of staying busy', async () => {
    const f = fixture(); await f.updates.action('check'); f.client.downloadUpdate.mockResolvedValueOnce(['private-path']);
    await f.updates.action('download'); expect(f.updates.getState()).toMatchObject({ status: 'error', version: '0.5.0-beta.4' });
    await f.updates.action('download'); expect(f.updates.getState().status).toBe('downloaded');
  });
  it.each([null, undefined, {}, { version: null }])('handles malformed download completion metadata safely: %j', async info => {
    const f = fixture(); await f.updates.action('check'); const pending = deferred<string[]>();
    f.client.downloadUpdate.mockImplementationOnce(() => pending.promise);
    const downloading = f.updates.action('download');
    expect(() => f.client.emit('update-downloaded', info)).not.toThrow();
    pending.resolve(['private-path']); await downloading;
    expect(f.updates.getState().status).toBe('error'); expect(f.failure).toHaveBeenCalledTimes(1);
  });
  it('ignores invalid progress and clamps valid progress without processing late completion events', async () => {
    const f = fixture(); await f.updates.action('check'); const pending = deferred<string[]>();
    f.client.downloadUpdate.mockImplementationOnce(() => pending.promise);
    const downloading = f.updates.action('download');
    for (const value of [null, undefined, {}, { percent: NaN }, { percent: Infinity }, { percent: 'private' }]) {
      expect(() => f.client.emit('download-progress', value)).not.toThrow();
    }
    expect(f.updates.getState().progress).toBe(0);
    f.client.emit('download-progress', { percent: -4 }); expect(f.updates.getState().progress).toBe(0);
    f.client.emit('download-progress', { percent: 150 }); expect(f.updates.getState().progress).toBe(100);
    f.client.emit('update-downloaded', { version: '0.5.0-beta.4' }); pending.resolve(['private-path']); await downloading;
    const count = f.states.length;
    f.client.emit('download-progress', { percent: 1 }); f.client.emit('update-downloaded', { version: '0.5.0-beta.5' });
    expect(f.states).toHaveLength(count); expect(f.updates.getState()).toMatchObject({ status: 'downloaded', version: '0.5.0-beta.4' });
  });
  it('reports safe restart guidance for a thrown or asynchronous installation failure', async () => {
    const f = fixture(); await f.updates.action('check'); await f.updates.action('download');
    f.client.quitAndInstall.mockImplementationOnce(() => { throw new Error('private-executable-path'); });
    await f.updates.action('install');
    expect(f.updates.getState()).toMatchObject({ status: 'error', version: null });
    expect(f.updates.getState().message).toMatch(/close SC.*reopen/iu);
    expect(JSON.stringify([f.states, f.failure.mock.calls])).not.toContain('private-');
    await f.updates.action('check'); await f.updates.action('download'); await f.updates.action('install');
    f.client.emit('error', new Error('private-spawn-error'));
    expect(f.updates.getState().status).toBe('error'); expect(f.failure).toHaveBeenCalledTimes(2);
  });
  it.each(['check', 'download'] as const)('does not publish or diagnose an in-flight %s after disposal', async action => {
    const f = fixture(); const pending = deferred<never>();
    if (action === 'check') f.client.checkForUpdates.mockImplementationOnce(() => pending.promise);
    else { await f.updates.action('check'); f.client.downloadUpdate.mockImplementationOnce(() => pending.promise); }
    const running = f.updates.action(action); const count = f.states.length;
    f.updates.dispose(); pending.reject(new Error('private-late-error')); await running;
    expect(f.states).toHaveLength(count); expect(f.failure).not.toHaveBeenCalled(); expect(f.client.eventNames()).toHaveLength(0);
  });
  it('ignores late events and removes its listeners on disposal', async () => {
    const f = fixture(); f.updates.dispose();
    f.client.emit('update-available', { version: '0.5.0-beta.4' }); await f.updates.action('check');
    expect(f.states).toHaveLength(0); expect(f.client.eventNames()).toHaveLength(0); expect(f.client.checkForUpdates).not.toHaveBeenCalled();
  });
  it('accepts only the three update actions across IPC', () => {
    expect(updateActionSchema.safeParse('https://example.invalid/installer.exe').success).toBe(false);
    expect(updateActionSchema.safeParse({ action: 'install', path: 'example.exe' }).success).toBe(false);
    expect(updateActionSchema.safeParse('install').success).toBe(true);
  });
});
