import type { AppUpdater } from 'electron-updater';
import type { UpdateAction, UpdateState } from '../contracts';
import { AppError, type Diagnostics } from './diagnostics';

type UpdateClient = Pick<AppUpdater, 'autoDownload' | 'autoInstallOnAppQuit' | 'allowPrerelease' | 'allowDowngrade' |
  'disableWebInstaller' | 'logger' | 'on' | 'removeListener' | 'checkForUpdates' | 'downloadUpdate' | 'quitAndInstall'>;
interface UpdateOptions {
  client: UpdateClient | null; version: string; diagnostics: Diagnostics;
  publish(state: UpdateState): void; canInstall(): boolean;
}
export function disabledUpdates(): UpdateState {
  return { status: 'disabled', version: null, progress: null,
    message: 'In-app updates are available in the installed Windows version of SC.' };
}
function releaseVersion(info: unknown): string | null {
  const version = info && typeof info === 'object' && 'version' in info ? info.version : null;
  return typeof version === 'string' && version.length <= 64 && /^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?(?:\+[a-zA-Z0-9.-]+)?$/u.test(version) ? version : null;
}

/** Owns update events; release notes, URLs, paths and raw errors never enter UI state or logs. */
export class ApplicationUpdates {
  private state: UpdateState;
  private active = false;
  private download: { status: 'pending' | 'ready' | 'invalid' } | null = null;
  private disposed = false;
  private listeners: Array<() => void> = [];
  constructor(private readonly options: UpdateOptions) {
    const client = options.client;
    this.state = client ? { status: 'idle', version: null, progress: null, message: 'Check for a newer version of SC.' } : disabledUpdates();
    if (!client) return;
    client.logger = null;
    client.autoDownload = false;
    client.autoInstallOnAppQuit = false;
    client.allowPrerelease = options.version.includes('-');
    client.allowDowngrade = false;
    client.disableWebInstaller = true;
    const progress = (value: unknown) => {
      const raw = value && typeof value === 'object' && 'percent' in value ? value.percent : null;
      if (this.download?.status !== 'pending' || this.state.status !== 'downloading' || typeof raw !== 'number' || !Number.isFinite(raw)) return;
      const percent = Math.round(Math.max(0, Math.min(100, raw)));
      this.set({ ...this.state, progress: percent, message: `Downloading update… ${percent}%` });
    };
    const downloaded = (info: unknown) => {
      if (this.download?.status !== 'pending' || this.state.status !== 'downloading') return;
      this.download.status = releaseVersion(info) === this.state.version ? 'ready' : 'invalid';
    };
    // Network errors reject their own promises. An uncorrelated late error must not
    // clear an offered/downloaded update or fail a subsequent check or download.
    const failed = () => { if (this.state.status === 'installing') this.failure('install'); };
    client.on('download-progress', progress); client.on('update-downloaded', downloaded); client.on('error', failed);
    this.listeners = [() => client.removeListener('download-progress', progress),
      () => client.removeListener('update-downloaded', downloaded), () => client.removeListener('error', failed)];
  }
  getState(): UpdateState { return { ...this.state }; }
  private set(state: UpdateState): void {
    if (this.disposed) return;
    this.state = state; this.options.publish(this.getState());
  }
  private failure(action: UpdateAction): void {
    if (this.disposed || this.state.status === 'error') return;
    this.options.diagnostics.failure('Updates', new AppError('UPDATEFAILED', 'SC could not complete the update.'));
    this.set({ status: 'error', version: action === 'download' ? this.state.version : null, progress: null,
      message: action === 'download' ? 'The update could not be downloaded. Check your connection and retry the download, or check for updates again.' :
        action === 'install' ? 'SC could not start the installer. Close SC, reopen it and try again, or run the latest SC installer manually.' :
          'SC could not check for updates. Check your connection and try again. An installer update may not be published yet.' });
  }
  async action(action: UpdateAction): Promise<void> {
    const client = this.options.client;
    if (!client || this.disposed || this.active || this.state.status === 'installing') return;
    if (action === 'install') {
      if (this.state.status !== 'downloaded') return;
      if (!this.options.canInstall()) throw new AppError('UPDATEBUSY', 'Finish the current request or settings action before restarting SC.');
      this.set({ ...this.state, status: 'installing', message: 'Restarting SC to install the update…' });
      try { client.quitAndInstall(false, true); } catch { this.failure('install'); }
      return;
    }
    if (action === 'download' && this.state.status !== 'available' && !(this.state.status === 'error' && this.state.version)) return;
    if (action === 'check' && ['downloading', 'downloaded'].includes(this.state.status)) return;
    this.active = true;
    let completed: UpdateState | null = null;
    try {
      if (action === 'check') {
        this.set({ status: 'checking', version: null, progress: null, message: 'Checking for updates…' });
        const result = await client.checkForUpdates();
        // The completed check owns availability (including the client's no-downgrade
        // decision); global release events have no request identity.
        if (result?.isUpdateAvailable === false) {
          completed = { status: 'current', version: null, progress: null, message: 'You have the latest available version.' };
        } else if (result?.isUpdateAvailable === true) {
          const version = releaseVersion(result.updateInfo);
          if (version) completed = { status: 'available', version, progress: null, message: `SC ${version} is available.` };
        }
      } else {
        this.download = { status: 'pending' };
        this.set({ ...this.state, status: 'downloading', progress: 0, message: 'Downloading update… 0%' });
        await client.downloadUpdate();
        // update-downloaded precedes asynchronous cache/blockmap bookkeeping.
        // Keep the busy state until that work also succeeds before offering restart.
        if (this.download.status === 'ready') completed = { ...this.state, status: 'downloaded', progress: 100,
          message: `SC ${this.state.version} is ready to install.` };
      }
    } catch { /* Report only the bounded operation failure below. */ }
    finally { this.active = false; this.download = null; }
    if (completed) this.set(completed);
    else this.failure(action);
  }
  dispose(): void {
    this.disposed = true;
    for (const remove of this.listeners.splice(0)) remove();
  }
}
