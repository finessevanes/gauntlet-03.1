/**
 * Preload Script
 * Exposes safe IPC methods to renderer process via contextBridge
 * See: https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
 */

import { contextBridge, ipcRenderer, webUtils } from 'electron';
import {
  AppInitResponse,
  FFmpegValidationResponse,
  FilePickerResponse,
  FileValidationResponse,
  VideoMetadataResponse,
  ThumbnailResponse,
} from './types/ipc';

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

  /**
   * Import API (Story 2: Video Import)
   */
  import: {
    /**
     * Open file picker for video import
     */
    openFilePicker: (): Promise<FilePickerResponse> => {
      return ipcRenderer.invoke('import:open-file-picker');
    },

    /**
     * Validate video file
     */
    validateFile: (filePath: string): Promise<FileValidationResponse> => {
      return ipcRenderer.invoke('import:validate-file', { filePath });
    },

    /**
     * Get video metadata
     */
    getMetadata: (filePath: string): Promise<VideoMetadataResponse> => {
      return ipcRenderer.invoke('import:get-video-metadata', { filePath });
    },

    /**
     * Generate video thumbnail
     */
    generateThumbnail: (filePath: string): Promise<ThumbnailResponse> => {
      return ipcRenderer.invoke('import:generate-thumbnail', { filePath });
    },
  },

  /**
   * Drag & Drop API (Story 2: Video Import)
   * Sets up event listener and callback
   */
  dragDrop: {
    /**
     * Set up drop handler that will call the callback with file paths
     */
    onDrop: (callback: (filePaths: string[]) => void) => {
      const handler = (e: Event) => {
        const dropEvent = e as DragEvent;
        dropEvent.preventDefault();
        // Don't stopPropagation - allow React's drop handler to fire for UI state cleanup

        if (!dropEvent.dataTransfer?.files) {
          console.log('[Preload] No files in drop event');
          return;
        }

        const files = Array.from(dropEvent.dataTransfer.files);
        console.log('[Preload] Drop event in preload, files:', files);

        const paths = files.map((file) => {
          try {
            const path = webUtils.getPathForFile(file);
            console.log('[Preload] Got path:', file.name, '→', path);
            return path;
          } catch (error) {
            console.error('[Preload] Error getting path:', error);
            return '';
          }
        }).filter(Boolean);

        console.log('[Preload] Calling callback with paths:', paths);
        if (paths.length > 0) {
          callback(paths);
        }
      };

      // Set up listener immediately (DOMContentLoaded may have already fired)
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
          document.addEventListener('drop', handler, true); // Use capture phase
        });
      } else {
        document.addEventListener('drop', handler, true); // Use capture phase
      }

      return () => document.removeEventListener('drop', handler, true);
    },
  },
});

// Type declarations for window.electron
declare global {
  interface Window {
    electron: {
      invoke<T = any>(channel: string, ...args: any[]): Promise<T>;
      quit(): void;
      import: {
        openFilePicker(): Promise<FilePickerResponse>;
        validateFile(filePath: string): Promise<FileValidationResponse>;
        getMetadata(filePath: string): Promise<VideoMetadataResponse>;
        generateThumbnail(filePath: string): Promise<ThumbnailResponse>;
      };
      dragDrop: {
        onDrop(callback: (filePaths: string[]) => void): () => void;
      };
    };
  }
}
