/**
 * App IPC Handlers
 * Handles initialization and FFmpeg validation IPC calls from renderer
 */

import { ipcMain, app } from 'electron';
import { validateFFmpeg } from '../services/ffmpeg-validator';
import { loadSession } from '../services/session-manager';
import { AppInitResponse, FFmpegValidationResponse } from '../../types/ipc';

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
      const session = loadSession();

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

  console.log('[IPC] App handlers registered');
}
