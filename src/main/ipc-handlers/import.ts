/**
 * Import IPC Handlers
 * Handles video import operations: file picker, validation, metadata extraction, thumbnail generation
 */

import { ipcMain, dialog } from 'electron';
import { validateVideoFile, extractFilename } from '../services/file-validator';
import { extractMetadata } from '../services/metadata-service';
import { generateThumbnail } from '../services/thumbnail-generator';

/**
 * Register all import-related IPC handlers
 */
export function registerImportHandlers(): void {
  // Handler: Convert dropped files to paths (for drag-and-drop)
  ipcMain.handle('import:get-file-paths', async (_event, fileData: { name: string; path: string }[]) => {
    // Files dropped from the OS already have paths
    // Just extract and return them
    return fileData.map(f => f.path).filter(Boolean);
  });

  // Handler: Open file picker for video import
  ipcMain.handle('import:open-file-picker', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Video Files', extensions: ['mp4', 'mov'] }
      ],
      title: 'Import Video Files'
    });

    return {
      filePaths: result.filePaths,
      canceled: result.canceled
    };
  });

  // Handler: Validate video file
  ipcMain.handle('import:validate-file', async (_event, { filePath }: { filePath: string }) => {
    try {
      const result = validateVideoFile(filePath);
      return result;
    } catch (error: any) {
      return {
        valid: false,
        error: error.message || 'Validation failed'
      };
    }
  });

  // Handler: Get video metadata
  ipcMain.handle('import:get-video-metadata', async (_event, { filePath }: { filePath: string }) => {
    try {
      const metadata = await extractMetadata(filePath);
      const filename = extractFilename(filePath);

      return {
        success: true,
        data: {
          ...metadata,
          filename
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to extract metadata'
      };
    }
  });

  // Handler: Generate thumbnail
  ipcMain.handle('import:generate-thumbnail', async (_event, { filePath }: { filePath: string }) => {
    try {
      const thumbnail = await generateThumbnail(filePath);

      return {
        success: true,
        thumbnail
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to generate thumbnail'
      };
    }
  });
}
