import { contextBridge, ipcRenderer } from 'electron';
import type { AppCommand, AppState, DesktopApi, SettingsDraft } from '../contracts';

const api: DesktopApi = {
  getState: () => ipcRenderer.invoke('sc:getState') as Promise<AppState>,
  setup: (key: string) => ipcRenderer.invoke('sc:setup', key) as Promise<void>,
  command: (command: AppCommand) => ipcRenderer.invoke('sc:command', command) as Promise<void>,
  getSettingsDraft: () => ipcRenderer.invoke('sc:getSettingsDraft') as Promise<SettingsDraft>,
  saveSettings: (draft: SettingsDraft) => ipcRenderer.invoke('sc:saveSettings', draft) as Promise<void>,
  discardSettings: () => ipcRenderer.invoke('sc:discardSettings') as Promise<void>,
  chooseColor: (color: string) => ipcRenderer.invoke('sc:chooseColor', color) as Promise<string | null>,
  subscribe(listener) {
    const handler = (_event: Electron.IpcRendererEvent, state: AppState) => listener(state);
    ipcRenderer.on('sc:state', handler); return () => { ipcRenderer.removeListener('sc:state', handler); };
  },
  onScroll(listener) {
    const handler = (_event: Electron.IpcRendererEvent, delta: number) => listener(delta);
    ipcRenderer.on('sc:scroll', handler); return () => { ipcRenderer.removeListener('sc:scroll', handler); };
  }
};
contextBridge.exposeInMainWorld('sc', Object.freeze(api));
