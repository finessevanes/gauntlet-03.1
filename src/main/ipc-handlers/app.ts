/**
 * App IPC Handlers
 * Handles initialization and FFmpeg validation IPC calls from renderer
 */

import { ipcMain, app, dialog, BrowserWindow } from 'electron';
import { validateFFmpeg } from '../services/ffmpeg-validator';
import { loadSession, saveSession } from '../services/session-manager';
import { AppInitResponse, FFmpegValidationResponse } from '../../types/ipc';
import { initializeSessionCache } from './timeline';
import { Session } from '../../types/session';

/**
 * Registers all app-related IPC handlers
 */
export function registerAppHandlers(): void {
  // Handler: app:init
  // Called when renderer is ready, performs initialization sequence
  ipcMain.handle('app:init', async (): Promise<AppInitResponse> => {
    console.log('[IPC] app:init called');

    try {
      // Step 1: Validate FFmpeg
      const ffmpegResult = await validateFFmpeg();

      if (!ffmpegResult.valid) {
        console.error('[IPC] FFmpeg validation failed:', ffmpegResult.error);
        return {
          session: null,
          ffmpegStatus: 'error',
          error: 'Media processing unavailable. Please reinstall Klippy.',
        };
      }

      console.log('[IPC] FFmpeg validation passed:', {
        path: ffmpegResult.ffmpegPath,
        version: ffmpegResult.version,
      });

      // Step 2: Load session
      let session = loadSession();

      // If no session exists, create a default empty session
      if (!session) {
        console.log('[IPC] No existing session, creating default session');
        session = {
          version: '1.0.0',
          clips: [],
          timeline: {
            clips: [],
            duration: 0,
          },
          zoomLevel: 100,
          playheadPosition: 0,
          scrollPosition: 0,
          lastModified: Date.now(),
        };

        // Save the default session
        saveSession(session);
      }

      // Initialize timeline session cache
      initializeSessionCache(session);

      // Return result
      return {
        session,
        ffmpegStatus: 'ok',
      };

    } catch (error) {
      console.error('[IPC] app:init error:', error);
      return {
        session: null,
        ffmpegStatus: 'error',
        error: `Initialization failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  });

  // Handler: app:validate-ffmpeg
  // Standalone FFmpeg validation (can be called anytime)
  ipcMain.handle('app:validate-ffmpeg', async (): Promise<FFmpegValidationResponse> => {
    console.log('[IPC] app:validate-ffmpeg called');

    try {
      const result = await validateFFmpeg();
      return result;

    } catch (error) {
      console.error('[IPC] app:validate-ffmpeg error:', error);
      return {
        valid: false,
        error: `Validation failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  });

  // Handler: app:quit
  // Quits the application
  ipcMain.on('app:quit', () => {
    console.log('[IPC] app:quit called');
    app.quit();
  });

  // Handler: dialog:showSaveDialog
  // Opens save dialog for file export
  ipcMain.handle('dialog:showSaveDialog', async (event, options) => {
    console.log('[IPC] dialog:showSaveDialog called');
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (!mainWindow) {
      return { canceled: true };
    }
    const result = await dialog.showSaveDialog(mainWindow, options);
    return result;
  });

  console.log('[IPC] App handlers registered');
}
