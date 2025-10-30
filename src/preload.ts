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
import {
  GetScreensResponse,
  StartRecordingRequest,
  StartRecordingResponse,
  StopRecordingRequest,
  StopRecordingResponse,
  CancelRecordingRequest,
  CancelRecordingResponse,
  EncodeWebcamRecordingRequest,
  EncodeWebcamRecordingResponse,
  CheckCameraAvailableResponse,
  GetPiPSettingsResponse,
  StartPiPRecordingRequest,
  StartPiPRecordingResponse,
  StopPiPRecordingRequest,
  StopPiPRecordingResponse,
  CompositePiPVideosRequest,
  CompositePiPVideosResponse,
  SavePiPSettingsRequest,
  SavePiPSettingsResponse,
} from './types/recording';

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
     * Trim a clip to new in/out points (per-instance override)
     */
    trimClip: (clipId: string, instanceId: string, inPoint: number, outPoint: number): Promise<TrimClipResponse> => {
      return ipcRenderer.invoke('trim_clip', { clipId, instanceId, inPoint, outPoint } as TrimClipRequest);
    },

    /**
     * Reset trim to full duration (per-instance override)
     */
    resetTrim: (clipId: string, instanceId: string): Promise<ResetTrimResponse> => {
      return ipcRenderer.invoke('reset_trim', { clipId, instanceId } as ResetTrimRequest);
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
   * Recording API (Story S9: Screen Recording)
   */
  recording: {
    /**
     * Get available screens for recording
     */
    getScreens: (): Promise<GetScreensResponse> => {
      return ipcRenderer.invoke('recording:get-screens');
    },

    /**
     * Create a recording session
     */
    createSession: (screenSourceId: string, audioEnabled: boolean): Promise<{ success: boolean; sessionId?: string; error?: string }> => {
      return ipcRenderer.invoke('recording:create-session', { screenSourceId, audioEnabled });
    },

    /**
     * Start screen recording
     */
    startRecording: (request: StartRecordingRequest): Promise<StartRecordingResponse> => {
      return ipcRenderer.invoke('recording:start', request);
    },

    /**
     * Stop screen recording
     */
    stopRecording: (request: StopRecordingRequest): Promise<StopRecordingResponse> => {
      return ipcRenderer.invoke('recording:stop', request);
    },

    /**
     * Cancel screen recording
     */
    cancelRecording: (request: CancelRecordingRequest): Promise<CancelRecordingResponse> => {
      return ipcRenderer.invoke('recording:cancel', request);
    },

    /**
     * Save recording data to file
     */
    saveRecordingData: (sessionId: string, data: Uint8Array): Promise<{ success: boolean; tempWebmPath?: string; error?: string }> => {
      return ipcRenderer.invoke('recording:save-data', { sessionId, data });
    },

    /**
     * Encode webcam recording to MP4 (Story S10)
     */
    encodeWebcamRecording: (request: Omit<EncodeWebcamRecordingRequest, 'recordedBlob'> & { recordedBlob: ArrayBuffer }): Promise<EncodeWebcamRecordingResponse> => {
      // Convert ArrayBuffer to Buffer for IPC
      const buffer = Buffer.from(request.recordedBlob);
      return ipcRenderer.invoke('recording:encode-webcam', {
        ...request,
        recordedBlob: buffer,
      });
    },

    /**
     * Set webcam recording status (for app quit prevention)
     */
    setWebcamStatus: (recording: boolean): Promise<{ success: boolean }> => {
      return ipcRenderer.invoke('recording:set-webcam-status', { recording });
    },
  },

  /**
   * Picture-in-Picture Recording API (Story S11)
   */
  pip: {
    /**
     * Check if camera is available
     */
    checkCameraAvailable: (): Promise<CheckCameraAvailableResponse> => {
      return ipcRenderer.invoke('pip:check-camera-available');
    },

    /**
     * Get saved PiP settings
     */
    getPipSettings: (): Promise<GetPiPSettingsResponse> => {
      return ipcRenderer.invoke('pip:get-pip-settings');
    },

    /**
     * Start PiP recording
     */
    startPiPRecording: (request: StartPiPRecordingRequest): Promise<StartPiPRecordingResponse> => {
      return ipcRenderer.invoke('pip:start-pip-recording', request);
    },

    /**
     * Stop PiP recording
     */
    stopPiPRecording: (request: StopPiPRecordingRequest): Promise<StopPiPRecordingResponse> => {
      return ipcRenderer.invoke('pip:stop-pip-recording', request);
    },

    /**
     * Composite PiP videos
     */
    compositePiPVideos: (request: CompositePiPVideosRequest): Promise<CompositePiPVideosResponse> => {
      return ipcRenderer.invoke('pip:composite-pip-videos', request);
    },

    /**
     * Save PiP settings
     */
    savePipSettings: (request: SavePiPSettingsRequest): Promise<SavePiPSettingsResponse> => {
      return ipcRenderer.invoke('pip:save-pip-settings', request);
    },

    /**
     * Save PiP recording data to file (screen stream)
     */
    saveScreenData: (recordingId: string, filePath: string, data: Uint8Array): Promise<{ success: boolean; error?: string }> => {
      return ipcRenderer.invoke('pip:save-screen-data', { recordingId, filePath, data });
    },

    /**
     * Save PiP recording data to file (webcam stream)
     */
    saveWebcamData: (recordingId: string, filePath: string, data: Uint8Array): Promise<{ success: boolean; error?: string }> => {
      return ipcRenderer.invoke('pip:save-webcam-data', { recordingId, filePath, data });
    },
  },

  /**
   * AI API (Story S9: Teleprompter)
   */
  ai: {
    /**
     * Generate script with AI
     */
    generateScript: (request: { topic: string; duration: number; feedback?: string; previousScript?: string }) => {
      return ipcRenderer.invoke('ai:generate-script', request);
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
          return;
        }

        const files = Array.from(dropEvent.dataTransfer.files);

        const paths = files.map((file) => {
          try {
            const path = webUtils.getPathForFile(file);
            return path;
          } catch (error) {
            return '';
          }
        }).filter(Boolean);

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
        trimClip(clipId: string, instanceId: string, inPoint: number, outPoint: number): Promise<import('./types/ipc').TrimClipResponse>;
        resetTrim(clipId: string, instanceId: string): Promise<import('./types/ipc').ResetTrimResponse>;
      };
      export: {
        onProgress(callback: (progress: any) => void): () => void;
        onCancelled(callback: () => void): () => void;
      };
      recording: {
        getScreens(): Promise<import('./types/recording').GetScreensResponse>;
        createSession(screenSourceId: string, audioEnabled: boolean): Promise<{ success: boolean; sessionId?: string; error?: string }>;
        startRecording(request: import('./types/recording').StartRecordingRequest): Promise<import('./types/recording').StartRecordingResponse>;
        stopRecording(request: import('./types/recording').StopRecordingRequest): Promise<import('./types/recording').StopRecordingResponse>;
        cancelRecording(request: import('./types/recording').CancelRecordingRequest): Promise<import('./types/recording').CancelRecordingResponse>;
        saveRecordingData(sessionId: string, data: Uint8Array): Promise<{ success: boolean; tempWebmPath?: string; error?: string }>;
        encodeWebcamRecording(request: Omit<import('./types/recording').EncodeWebcamRecordingRequest, 'recordedBlob'> & { recordedBlob: ArrayBuffer }): Promise<import('./types/recording').EncodeWebcamRecordingResponse>;
        setWebcamStatus(recording: boolean): Promise<{ success: boolean }>;
      };
      dragDrop: {
        onDrop(callback: (filePaths: string[]) => void): () => void;
      };
      ai: {
        generateScript(request: { topic: string; duration: number; feedback?: string; previousScript?: string }): Promise<{ scriptText: string; estimatedDuration: number }>;
      };
    };
  }
}
