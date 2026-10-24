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
function releaseVersion(info: { version: string }): string | null {
  return typeof info.version === 'string' && /^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/u.test(info.version) && info.version.length <= 64 ? info.version : null;
}

/** Owns update events; release notes, URLs, paths and raw errors never enter UI state or logs. */
export class ApplicationUpdates {
  private state: UpdateState;
  private active = false;
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
    const available = (info: { version: string }) => {
      if (this.state.status !== 'checking') return;
      const version = releaseVersion(info);
      if (!version) { this.failure(); return; }
      this.set({ status: 'available', version, progress: null, message: `SC ${version} is available.` });
    };
    const current = () => {
      if (this.state.status === 'checking') this.set({ status: 'current', version: null, progress: null, message: 'You have the latest available version.' });
    };
    const progress = (value: { percent: number }) => {
      if (this.state.status !== 'downloading' || !Number.isFinite(value.percent)) return;
      const percent = Math.round(Math.max(0, Math.min(100, value.percent)));
      this.set({ ...this.state, progress: percent, message: `Downloading update… ${percent}%` });
    };
    const downloaded = (info: { version: string }) => {
      if (this.state.status !== 'downloading') return;
      if (releaseVersion(info) !== this.state.version) { this.failure(); return; }
      this.set({ ...this.state, status: 'downloaded', progress: 100, message: `SC ${this.state.version} is ready to install.` });
    };
    const failed = () => this.failure();
    client.on('update-available', available); client.on('update-not-available', current);
    client.on('download-progress', progress); client.on('update-downloaded', downloaded); client.on('error', failed);
    this.listeners = [() => client.removeListener('update-available', available), () => client.removeListener('update-not-available', current),
      () => client.removeListener('download-progress', progress), () => client.removeListener('update-downloaded', downloaded), () => client.removeListener('error', failed)];
  }
  getState(): UpdateState { return { ...this.state }; }
  private set(state: UpdateState): void {
    if (this.disposed) return;
    this.state = state; this.options.publish(this.getState());
  }
  private failure(): void {
    if (this.disposed || this.state.status === 'error') return;
    this.options.diagnostics.failure('Updates', new AppError('UPDATEFAILED', 'SC could not complete the update.'));
    this.set({ status: 'error', version: null, progress: null,
      message: 'The update could not be completed. Check your connection and try again. An installer update may not be published yet.' });
  }
  async action(action: UpdateAction): Promise<void> {
    const client = this.options.client;
    if (!client || this.disposed || this.active || this.state.status === 'installing') return;
    if (action === 'install') {
      if (this.state.status !== 'downloaded') return;
      if (!this.options.canInstall()) throw new AppError('UPDATEBUSY', 'Finish the current request or settings action before restarting SC.');
      this.set({ ...this.state, status: 'installing', message: 'Restarting SC to install the update…' });
      try { client.quitAndInstall(false, true); } catch { this.failure(); }
      return;
    }
    if (action === 'download' && this.state.status !== 'available') return;
    if (action === 'check' && ['downloading', 'downloaded'].includes(this.state.status)) return;
    this.active = true;
    try {
      if (action === 'check') {
        this.set({ status: 'checking', version: null, progress: null, message: 'Checking for updates…' });
        const result = await client.checkForUpdates();
        if (!result && this.state.status === 'checking') this.failure();
      } else {
        this.set({ ...this.state, status: 'downloading', progress: 0, message: 'Downloading update… 0%' });
        await client.downloadUpdate();
      }
    } catch { this.failure(); }
    finally { this.active = false; }
  }
  dispose(): void {
    this.disposed = true;
    for (const remove of this.listeners.splice(0)) remove();
  }
}
