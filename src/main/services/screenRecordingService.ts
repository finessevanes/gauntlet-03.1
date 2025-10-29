/**
 * Screen Recording Service
 * Handles screen recording using Electron's desktopCapturer API + MediaRecorder
 * Story S9: Screen Recording
 */

import { desktopCapturer, systemPreferences } from 'electron';
import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { ScreenInfo, RecordingSession } from '../../types/recording';

// Active recording sessions (in-memory)
const activeSessions = new Map<string, RecordingSession>();

// Recording directory
const getRecordingDirectory = (): string => {
  const tempDir = app.getPath('temp');
  const recordingDir = path.join(tempDir, 'klippy-recordings');

  // Create directory if it doesn't exist
  if (!fs.existsSync(recordingDir)) {
    fs.mkdirSync(recordingDir, { recursive: true });
  }

  return recordingDir;
};

/**
 * Check Screen Recording permission on macOS
 * Note: This is informational only - the actual permission prompt happens
 * when desktopCapturer.getSources() is called for the first time
 */
export function checkScreenCapturePermission(): {
  granted: boolean;
  message?: string;
} {
  if (process.platform === 'darwin') {
    // On macOS, check if screen recording permission is granted
    const status = systemPreferences.getMediaAccessStatus('screen');
    console.log('[ScreenRecordingService] Screen capture permission status:', status);
    console.log('[ScreenRecordingService] App path:', app.getPath('exe'));
    console.log('[ScreenRecordingService] Process platform:', process.platform);

    if (status === 'granted') {
      return { granted: true };
    } else {
      // For 'denied', 'not-determined', or 'restricted', we'll let desktopCapturer
      // handle it - it will prompt the user automatically on first call
      return {
        granted: false,
        message:
          'Screen Recording permission needed. When you click "Get Screens", macOS will prompt you to allow access.\n' +
          'If the prompt doesn\'t appear, please enable manually in:\n' +
          'System Settings > Privacy & Security > Screen Recording',
      };
    }
  }

  // On other platforms, assume permission granted
  return { granted: true };
}

/**
 * Get available screens for recording
 * Uses Electron's desktopCapturer API
 *
 * Note: On macOS, the first call to desktopCapturer.getSources() will
 * automatically trigger the system permission prompt if not already granted
 */
export async function getAvailableScreens(): Promise<ScreenInfo[]> {
  try {
    console.log('[ScreenRecordingService] Getting available screens...');

    // On macOS, calling desktopCapturer.getSources() will automatically
    // prompt for permission on first use. We don't need to check beforehand.
    // Get both screens and windows so user can choose to record a specific window
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 320, height: 180 },
    });

    console.log(`[ScreenRecordingService] Found ${sources.length} source(s) (screens + windows)`);

    // If we got 0 screens on macOS, permission might be denied
    if (sources.length === 0 && process.platform === 'darwin') {
      const permission = checkScreenCapturePermission();
      if (!permission.granted) {
        throw new Error(
          permission.message ||
            'No screens found. Screen Recording permission may be required. ' +
            'Please enable in System Settings > Privacy & Security > Screen Recording'
        );
      }
    }

    const screens: ScreenInfo[] = sources.map((source) => {
      const thumbnailSize = source.thumbnail.getSize();
      let thumbnail = '';

      // Determine if this is a screen or window based on the id
      // Screen IDs typically start with "screen:" and window IDs start with "window:"
      const isScreen = source.id.startsWith('screen:');

      // Check if thumbnail is valid (has content)
      if (thumbnailSize.width > 0 && thumbnailSize.height > 0) {
        try {
          thumbnail = source.thumbnail.toDataURL();
        } catch (err) {
          console.warn('[ScreenRecordingService] Failed to generate thumbnail for:', source.name, err);
        }
      } else {
        console.warn('[ScreenRecordingService] Thumbnail size is 0x0 for:', source.name,
          '- This usually means Screen Recording permission is not granted');
      }

      // Get actual screen/window dimensions
      let resolution = '1920x1080'; // Default fallback

      // Try to infer resolution from thumbnail aspect ratio
      if (thumbnailSize.width > 0 && thumbnailSize.height > 0) {
        const aspectRatio = thumbnailSize.width / thumbnailSize.height;

        // For screens, use common display resolutions
        if (isScreen) {
          // Common aspect ratios and their typical resolutions
          if (Math.abs(aspectRatio - 16/9) < 0.1) {
            resolution = '1920x1080'; // 16:9
          } else if (Math.abs(aspectRatio - 16/10) < 0.1) {
            resolution = '1920x1200'; // 16:10
          } else if (Math.abs(aspectRatio - 4/3) < 0.1) {
            resolution = '1440x1080'; // 4:3
          } else if (Math.abs(aspectRatio - 21/9) < 0.1) {
            resolution = '2560x1080'; // 21:9 ultrawide
          }
        } else {
          // For windows, use the actual thumbnail dimensions scaled up
          // (thumbnail is scaled down, so we estimate the actual window size)
          const scaleFactor = 4; // Rough estimate
          resolution = `${thumbnailSize.width * scaleFactor}x${thumbnailSize.height * scaleFactor}`;
        }
      } else {
        // Thumbnail is empty - likely permission issue
        resolution = '0x0';
      }

      console.log('[ScreenRecordingService] Source:', {
        id: source.id,
        name: source.name,
        type: isScreen ? 'screen' : 'window',
        thumbnailSize,
        resolution,
        hasThumbnail: thumbnail.length > 0,
      });

      return {
        id: source.id,
        name: source.name,
        resolution,
        thumbnail,
      };
    });

    // Filter out windows/screens with invalid dimensions (0x0)
    // This happens when windows are minimized, hidden, or in transition states
    const validScreens = screens.filter((s) => s.resolution !== '0x0' && s.thumbnail);

    // Log filtered out sources
    const invalidScreens = screens.filter((s) => s.resolution === '0x0' || !s.thumbnail);
    if (invalidScreens.length > 0) {
      console.warn('[ScreenRecordingService] Filtered out invalid sources:',
        invalidScreens.map(s => s.name).join(', '));
    }

    // If all sources are invalid, it's likely a permission issue
    if (validScreens.length === 0 && screens.length > 0) {
      console.error('[ScreenRecordingService] All screen thumbnails are invalid - Screen Recording permission likely not granted');
      throw new Error(
        'Screen Recording permission required. Please enable Screen Recording in:\n' +
        'System Settings > Privacy & Security > Screen Recording\n' +
        'Then restart this application.'
      );
    }

    return validScreens;
  } catch (error) {
    console.error('[ScreenRecordingService] Error getting screens:', error);

    // Provide helpful error message for permission issues on macOS
    if (process.platform === 'darwin') {
      const permission = checkScreenCapturePermission();
      if (!permission.granted) {
        throw new Error(
          'Failed to get screens. ' + permission.message
        );
      }
    }

    throw new Error(
      `Failed to get available screens: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Create a new recording session
 */
export function createRecordingSession(screenSourceId: string, audioEnabled: boolean): RecordingSession {
  const sessionId = uuidv4();
  const recordingDir = getRecordingDirectory();
  const tempWebmPath = path.join(recordingDir, `${sessionId}.webm`);

  const session: RecordingSession = {
    sessionId,
    screenSourceId,
    recordingState: 'idle',
    startTime: 0,
    elapsedSeconds: 0,
    audioEnabled,
    tempWebmPath
  };

  activeSessions.set(sessionId, session);
  console.log(`[ScreenRecordingService] Created session ${sessionId}`, { audioEnabled, tempWebmPath });

  return session;
}

/**
 * Get recording session by ID
 */
export function getRecordingSession(sessionId: string): RecordingSession | undefined {
  return activeSessions.get(sessionId);
}

/**
 * Update recording session
 */
export function updateRecordingSession(sessionId: string, updates: Partial<RecordingSession>): void {
  const session = activeSessions.get(sessionId);
  if (session) {
    Object.assign(session, updates);
    activeSessions.set(sessionId, session);
  }
}

/**
 * Delete recording session
 */
export function deleteRecordingSession(sessionId: string): void {
  activeSessions.delete(sessionId);
  console.log(`[ScreenRecordingService] Deleted session ${sessionId}`);
}

/**
 * Start screen recording
 * This function prepares the session and returns the screen source info
 * The actual MediaRecorder setup happens in the renderer process
 */
export async function startRecording(sessionId: string): Promise<{ screenSourceId: string; audioEnabled: boolean }> {
  const session = getRecordingSession(sessionId);
  if (!session) {
    throw new Error(`Recording session ${sessionId} not found`);
  }

  if (session.recordingState !== 'idle') {
    throw new Error(`Recording already in progress for session ${sessionId}`);
  }

  // Update session state
  updateRecordingSession(sessionId, {
    recordingState: 'recording',
    startTime: Date.now(),
    elapsedSeconds: 0
  });

  console.log(`[ScreenRecordingService] Started recording for session ${sessionId}`);

  return {
    screenSourceId: session.screenSourceId,
    audioEnabled: session.audioEnabled
  };
}

/**
 * Stop screen recording
 * Returns the path to the temporary WebM file
 */
export async function stopRecording(sessionId: string): Promise<string> {
  const session = getRecordingSession(sessionId);
  if (!session) {
    throw new Error(`Recording session ${sessionId} not found`);
  }

  if (session.recordingState !== 'recording') {
    throw new Error(`No active recording for session ${sessionId}`);
  }

  // Update session state
  updateRecordingSession(sessionId, {
    recordingState: 'stopping'
  });

  console.log(`[ScreenRecordingService] Stopped recording for session ${sessionId}`);

  // Return the temp WebM path
  // The actual file will be created by the renderer's MediaRecorder
  return session.tempWebmPath!;
}

/**
 * Set final MP4 path after conversion
 */
export function setFinalMp4Path(sessionId: string, mp4Path: string): void {
  updateRecordingSession(sessionId, {
    finalMp4Path: mp4Path,
    recordingState: 'idle'
  });
}

/**
 * Cancel recording and cleanup
 */
export async function cancelRecording(sessionId: string): Promise<void> {
  const session = getRecordingSession(sessionId);
  if (!session) {
    throw new Error(`Recording session ${sessionId} not found`);
  }

  console.log(`[ScreenRecordingService] Canceling recording for session ${sessionId}`);

  // Cleanup temp files if they exist
  if (session.tempWebmPath && fs.existsSync(session.tempWebmPath)) {
    try {
      fs.unlinkSync(session.tempWebmPath);
      console.log(`[ScreenRecordingService] Deleted temp file: ${session.tempWebmPath}`);
    } catch (error) {
      console.error(`[ScreenRecordingService] Error deleting temp file:`, error);
    }
  }

  if (session.finalMp4Path && fs.existsSync(session.finalMp4Path)) {
    try {
      fs.unlinkSync(session.finalMp4Path);
      console.log(`[ScreenRecordingService] Deleted final file: ${session.finalMp4Path}`);
    } catch (error) {
      console.error(`[ScreenRecordingService] Error deleting final file:`, error);
    }
  }

  // Remove session
  deleteRecordingSession(sessionId);
}

/**
 * Cleanup old recordings
 * Delete recordings older than 7 days
 */
export function cleanupOldRecordings(): void {
  try {
    const recordingDir = getRecordingDirectory();
    const files = fs.readdirSync(recordingDir);
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

    files.forEach(file => {
      const filePath = path.join(recordingDir, file);
      const stats = fs.statSync(filePath);

      if (stats.mtimeMs < sevenDaysAgo) {
        fs.unlinkSync(filePath);
        console.log(`[ScreenRecordingService] Deleted old recording: ${file}`);
      }
    });
  } catch (error) {
    console.error('[ScreenRecordingService] Error cleaning up old recordings:', error);
  }
}

/**
 * Get elapsed time for a recording session
 */
export function getElapsedTime(sessionId: string): number {
  const session = getRecordingSession(sessionId);
  if (!session || session.recordingState !== 'recording') {
    return 0;
  }

  const elapsed = (Date.now() - session.startTime) / 1000;
  return Math.floor(elapsed);
}
