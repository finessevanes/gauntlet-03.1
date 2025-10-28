/**
 * Preload Script
 * Exposes safe IPC methods to renderer process via contextBridge
 * See: https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
 */

import { contextBridge, ipcRenderer } from 'electron';
import { AppInitResponse, FFmpegValidationResponse } from './types/ipc';

// Expose electron APIs to renderer process
contextBridge.exposeInMainWorld('electron', {
  /**
   * Invoke IPC handler in main process
   * @param channel IPC channel name
   * @param args Arguments to pass to handler
   */
  invoke: (channel: string, ...args: any[]): Promise<any> => {
    return ipcRenderer.invoke(channel, ...args);
  },

  /**
   * Quit the application
   */
  quit: (): void => {
    ipcRenderer.send('app:quit');
  },
});

// Type declarations for window.electron
declare global {
  interface Window {
    electron: {
      invoke<T = any>(channel: string, ...args: any[]): Promise<T>;
      quit(): void;
    };
  }
}
