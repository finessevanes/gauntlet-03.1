/**
 * Library IPC Handlers
 * Handles file validation for library clips
 */

import { ipcMain } from 'electron';
import * as fs from 'fs/promises';

export interface CheckFileExistsRequest {
  filePath: string;
}

export interface CheckFileExistsResponse {
  exists: boolean;
  error?: string;
}

/**
 * Check if a video file exists at the given path
 * Uses fs.access() to verify file exists and is readable
 */
async function handleCheckFileExists(
  _event: Electron.IpcMainInvokeEvent,
  request: CheckFileExistsRequest
): Promise<CheckFileExistsResponse> {
  const { filePath } = request;

  // Validate input
  if (!filePath || typeof filePath !== 'string') {
    return {
      exists: false,
      error: 'Invalid file path provided',
    };
  }

  try {
    // Check if file exists and is readable
    await fs.access(filePath, fs.constants.R_OK);
    return { exists: true };
  } catch (error: any) {
    // Handle specific error codes
    if (error.code === 'ENOENT') {
      return {
        exists: false,
        error: `File not found: ${filePath}`,
      };
    } else if (error.code === 'EACCES') {
      return {
        exists: false,
        error: `Permission denied: ${filePath}`,
      };
    } else {
      return {
        exists: false,
        error: `Unable to access file: ${error.message}`,
      };
    }
  }
}

/**
 * Register all library-related IPC handlers
 */
export function registerLibraryHandlers(): void {
  ipcMain.handle('library:check-file-exists', handleCheckFileExists);
}
