/**
 * useImport Hook
 * Manages video import state and orchestrates the import workflow
 */

import { useState, useCallback } from 'react';
import { useSessionStore } from '../store/sessionStore';
import { Clip } from '../types/session';
import { v4 as uuidv4 } from 'uuid';

export interface ImportProgress {
  id: string;
  filename: string;
  status: 'importing' | 'completed' | 'error';
  error?: string;
}

export interface ImportError {
  filename: string;
  codecAttempted?: string;
  error: string;
}

export function useImport() {
  const [importProgress, setImportProgress] = useState<ImportProgress[]>([]);
  const [importError, setImportError] = useState<ImportError | null>(null);
  const addClip = useSessionStore((state) => state.addClip);

  // Clear import progress (called when modal closes)
  const clearImportProgress = useCallback(() => {
    setImportProgress([]);
  }, []);

  // Clear import error (called when error modal closes)
  const clearImportError = useCallback(() => {
    setImportError(null);
  }, []);

  // Import videos from file paths
  const importVideos = useCallback(async (filePaths: string[]) => {
    // Step 1: Pre-validate all files before showing progress modal
    const validFiles: string[] = [];

    for (const filePath of filePaths) {
      const filename = filePath.split('/').pop() || 'Unknown';

      try {
        console.log(`[Import] Pre-validating ${filename}`);

        // Basic file validation (exists, format, permissions)
        const validationResult = await window.electron.import.validateFile(filePath);
        if (!validationResult.valid) {
          setImportError({
            filename,
            error: validationResult.error || 'File validation failed',
          });
          return; // Stop processing if any file is invalid
        }

        // Get metadata to check codec BEFORE importing
        const metadataResult = await window.electron.import.getMetadata(filePath);
        if (!metadataResult.success) {
          // Extract codec info if available from error message
          const codecMatch = metadataResult.error?.match(/Unsupported codec: (\w+)/);
          const codecAttempted = codecMatch ? codecMatch[1] : undefined;

          setImportError({
            filename,
            codecAttempted,
            error: metadataResult.error || 'Failed to extract metadata',
          });
          return; // Stop processing if any file has invalid codec
        }

        validFiles.push(filePath);
      } catch (error: any) {
        console.error('[Import] Pre-validation failed:', error);
        setImportError({
          filename,
          error: error.message,
        });
        return; // Stop processing on error
      }
    }

    // If no valid files, return early
    if (validFiles.length === 0) {
      return;
    }

    // Step 2: Initialize progress modal for valid files only
    const initialProgress: ImportProgress[] = validFiles.map((filePath) => ({
      id: uuidv4(),
      filename: filePath.split('/').pop() || 'Unknown',
      status: 'importing' as const,
    }));
    setImportProgress(initialProgress);

    // Step 3: Process each valid file
    for (let i = 0; i < validFiles.length; i++) {
      const filePath = validFiles[i];
      const progress = initialProgress[i];
      const startTime = Date.now();

      try {
        console.log(`[Import] Starting import for ${progress.filename}`);

        // File already validated in pre-validation step
        // Re-get metadata (cached or quick second call)
        const metadataResult = await window.electron.import.getMetadata(filePath);
        if (!metadataResult.success) {
          throw new Error(metadataResult.error || 'Failed to extract metadata');
        }

        // Generate thumbnail
        const t3 = Date.now();
        const thumbnailResult = await window.electron.import.generateThumbnail(filePath);
        console.log(`[Import] Thumbnail generation took ${Date.now() - t3}ms`);
        if (!thumbnailResult.success) {
          console.warn('Thumbnail generation failed, using placeholder');
        }

        // Create clip object
        const clip: Clip = {
          id: uuidv4(),
          filePath,
          filename: metadataResult.data!.filename,
          duration: metadataResult.data!.duration,
          inPoint: 0,
          outPoint: metadataResult.data!.duration,
          importedAt: Date.now(),
          thumbnail: thumbnailResult.thumbnail || '',
          resolution: metadataResult.data!.resolution,
          frameRate: metadataResult.data!.frameRate,
          codec: metadataResult.data!.codec,
          bitrate: metadataResult.data!.bitrate,
        };

        console.log('[Import] Created clip:', {
          filename: clip.filename,
          duration: clip.duration,
          inPoint: clip.inPoint,
          outPoint: clip.outPoint,
          effectiveDuration: clip.outPoint - clip.inPoint,
        });

        // Add to session
        addClip(clip);

        const totalTime = Date.now() - startTime;
        console.log(`[Import] Total import time: ${totalTime}ms`);

        // Mark as completed
        setImportProgress((prev) =>
          prev.map((p) => (p.id === progress.id ? { ...p, status: 'completed' as const } : p))
        );

      } catch (error: any) {
        console.error('[Import] Import failed:', error);

        // Mark as error
        setImportProgress((prev) =>
          prev.map((p) =>
            p.id === progress.id
              ? { ...p, status: 'error' as const, error: error.message }
              : p
          )
        );
      }
    }
  }, [addClip]);

  // Open file picker and import selected files
  const openFilePicker = useCallback(async () => {
    try {
      const result = await window.electron.import.openFilePicker();
      if (!result.canceled && result.filePaths.length > 0) {
        await importVideos(result.filePaths);
      }
    } catch (error: any) {
      console.error('File picker failed:', error);
    }
  }, [importVideos]);

  return {
    importProgress,
    importError,
    importVideos,
    openFilePicker,
    clearImportProgress,
    clearImportError,
  };
}
