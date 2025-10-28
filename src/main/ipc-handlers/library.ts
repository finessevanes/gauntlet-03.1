/**
 * Library IPC Handlers
 * Handles file validation for library clips and clip removal
 */

import { ipcMain } from 'electron';
import * as fs from 'fs/promises';
import { loadSession, saveSession } from '../services/session-manager';

export interface CheckFileExistsRequest {
  filePath: string;
}

export interface CheckFileExistsResponse {
  exists: boolean;
  error?: string;
}

export interface RemoveClipRequest {
  clipId: string;
}

export interface RemoveClipResponse {
  success: boolean;
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
 * Remove a clip from the library
 * Also removes all instances of the clip from the timeline
 */
async function handleRemoveClip(
  _event: Electron.IpcMainInvokeEvent,
  request: RemoveClipRequest
): Promise<RemoveClipResponse> {
  const { clipId } = request;

  // Validate input
  if (!clipId || typeof clipId !== 'string') {
    return {
      success: false,
      error: 'Invalid clip ID provided',
    };
  }

  try {
    // Load current session
    const session = loadSession();
    if (!session) {
      return {
        success: false,
        error: 'No active session found',
      };
    }

    // Find the clip
    const clipExists = session.clips.some(c => c.id === clipId);
    if (!clipExists) {
      return {
        success: false,
        error: `Clip not found: ${clipId}`,
      };
    }

    // Remove clip from library
    session.clips = session.clips.filter(c => c.id !== clipId);

    // Remove all instances of this clip from timeline (same behavior as timeline)
    const originalTimelineLength = session.timeline.clips.length;
    session.timeline.clips = session.timeline.clips.filter(tc => tc.clipId !== clipId);

    // Recalculate timeline duration if clips were removed
    if (session.timeline.clips.length !== originalTimelineLength) {
      session.timeline.duration = session.timeline.clips.reduce((total, timelineClip) => {
        const clip = session.clips.find(c => c.id === timelineClip.clipId);
        if (clip) {
          return total + (clip.outPoint - clip.inPoint);
        }
        return total;
      }, 0);

      // Reset playhead if it's beyond the new timeline duration
      if (session.playheadPosition > session.timeline.duration) {
        session.playheadPosition = 0;
      }
    }

    // Update timestamp
    session.lastModified = Date.now();

    // Save to disk
    const saved = saveSession(session);
    if (!saved) {
      return {
        success: false,
        error: 'Failed to save session after removing clip',
      };
    }

    console.log('[Library] Removed clip from library and timeline:', {
      clipId: clipId.substring(0, 8),
      timelineClipsRemoved: originalTimelineLength - session.timeline.clips.length,
      newTimelineLength: session.timeline.clips.length,
    });

    return { success: true };
  } catch (error: any) {
    console.error('[Library] Error removing clip:', error);
    return {
      success: false,
      error: `Failed to remove clip: ${error.message}`,
    };
  }
}

/**
 * Register all library-related IPC handlers
 */
export function registerLibraryHandlers(): void {
  ipcMain.handle('library:check-file-exists', handleCheckFileExists);
  ipcMain.handle('library:remove-clip', handleRemoveClip);
}
