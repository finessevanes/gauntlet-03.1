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
  CheckFileExistsRequest,
  CheckFileExistsResponse,
  TrimClipRequest,
  TrimClipResponse,
  ResetTrimRequest,
  ResetTrimResponse,
} from './types/ipc';
import { TimelineClip } from './types/session';

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
   * Library API (Story 3: Library View)
   */
  library: {
    /**
     * Check if a file exists at the given path
     */
    checkFileExists: (filePath: string): Promise<CheckFileExistsResponse> => {
      return ipcRenderer.invoke('library:check-file-exists', { filePath } as CheckFileExistsRequest);
    },

    /**
     * Remove a clip from the library
     */
    removeClip: (clipId: string): Promise<{ success: boolean; error?: string }> => {
      return ipcRenderer.invoke('library:remove-clip', { clipId });
    },
  },

  /**
   * Timeline API (Story 4: Timeline View)
   */
  timeline: {
    /**
     * Add a clip to the timeline
     */
    addClipToTimeline: (clipId: string, position?: number): Promise<{ success: boolean; clipId?: string; position?: number; error?: string }> => {
      return ipcRenderer.invoke('timeline:add_clip_to_timeline', { clipId, position });
    },

    /**
     * Reorder a clip on the timeline
     */
    reorderClip: (instanceId: string, newPosition: number): Promise<{ success: boolean; updatedTimeline?: TimelineClip[]; error?: string }> => {
      return ipcRenderer.invoke('timeline:reorder_timeline_clip', { instanceId, newPosition });
    },

    /**
     * Delete a clip from the timeline
     */
    deleteClip: (instanceId: string): Promise<{ success: boolean; updatedTimeline?: TimelineClip[]; error?: string }> => {
      return ipcRenderer.invoke('timeline:delete_timeline_clip', { instanceId });
    },

    /**
     * Set timeline zoom level
     */
    setZoom: (zoomLevel: number | 'auto'): Promise<{ success: boolean; zoomLevel?: number | 'auto'; error?: string }> => {
      return ipcRenderer.invoke('timeline:set_timeline_zoom', { zoomLevel });
    },

    /**
     * Set playhead position
     */
    setPlayheadPosition: (time: number): Promise<{ success: boolean; playheadPosition?: number; error?: string }> => {
      return ipcRenderer.invoke('timeline:set_playhead_position', { time });
    },

    /**
     * Get current timeline state
     */
    getTimelineState: (): Promise<{ clips: TimelineClip[]; duration: number; playheadPosition: number; zoomLevel: number; scrollPosition: number }> => {
      return ipcRenderer.invoke('timeline:get_timeline_state');
    },

    /**
     * Set scroll position
     */
    setScrollPosition: (scrollX: number): Promise<{ success: boolean }> => {
      return ipcRenderer.invoke('timeline:set_scroll_position', { scrollX });
    },

    /**
     * Save entire session state (used when clips are added)
     */
    saveSession: (session: any): Promise<{ success: boolean; error?: string }> => {
      return ipcRenderer.invoke('timeline:save_session', session);
    },
  },

  /**
   * Trim API (Story 5: Trim Functionality)
   */
  trim: {
    /**
     * Trim a clip to new in/out points
     */
    trimClip: (clipId: string, inPoint: number, outPoint: number): Promise<TrimClipResponse> => {
      return ipcRenderer.invoke('trim_clip', { clipId, inPoint, outPoint } as TrimClipRequest);
    },

    /**
     * Reset trim to full duration
     */
    resetTrim: (clipId: string): Promise<ResetTrimResponse> => {
      return ipcRenderer.invoke('reset_trim', { clipId } as ResetTrimRequest);
    },
  },

  /**
   * Export API (Story 7: Export to MP4)
   */
  export: {
    /**
     * Listen for export progress updates
     */
    onProgress: (callback: (progress: any) => void) => {
      const handler = (event: any, progress: any) => callback(progress);
      ipcRenderer.on('export-progress', handler);
      return () => ipcRenderer.removeListener('export-progress', handler);
    },

    /**
     * Listen for export cancellation
     */
    onCancelled: (callback: () => void) => {
      const handler = () => callback();
      ipcRenderer.on('export-cancelled', handler);
      return () => ipcRenderer.removeListener('export-cancelled', handler);
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
      library: {
        checkFileExists(filePath: string): Promise<CheckFileExistsResponse>;
        removeClip(clipId: string): Promise<{ success: boolean; error?: string }>;
      };
      timeline: {
        addClipToTimeline(clipId: string, position?: number): Promise<{ success: boolean; clipId?: string; position?: number; error?: string }>;
        reorderClip(instanceId: string, newPosition: number): Promise<{ success: boolean; updatedTimeline?: import('./types/session').TimelineClip[]; error?: string }>;
        deleteClip(instanceId: string): Promise<{ success: boolean; updatedTimeline?: import('./types/session').TimelineClip[]; error?: string }>;
        setZoom(zoomLevel: number | 'auto'): Promise<{ success: boolean; zoomLevel?: number | 'auto'; error?: string }>;
        setPlayheadPosition(time: number): Promise<{ success: boolean; playheadPosition?: number; error?: string }>;
        getTimelineState(): Promise<{ clips: import('./types/session').TimelineClip[]; duration: number; playheadPosition: number; zoomLevel: number; scrollPosition: number }>;
        setScrollPosition(scrollX: number): Promise<{ success: boolean }>;
        saveSession(session: any): Promise<{ success: boolean; error?: string }>;
      };
      trim: {
        trimClip(clipId: string, inPoint: number, outPoint: number): Promise<import('./types/ipc').TrimClipResponse>;
        resetTrim(clipId: string): Promise<import('./types/ipc').ResetTrimResponse>;
      };
      export: {
        onProgress(callback: (progress: any) => void): () => void;
        onCancelled(callback: () => void): () => void;
      };
      dragDrop: {
        onDrop(callback: (filePaths: string[]) => void): () => void;
      };
    };
  }
}
