/**
 * Recording IPC Handlers
 * Handles screen recording commands from renderer process
 * Story S9: Screen Recording
 */

import { ipcMain, IpcMainInvokeEvent } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import {
  GetScreensResponse,
  StartRecordingRequest,
  StartRecordingResponse,
  StopRecordingRequest,
  StopRecordingResponse,
  CancelRecordingRequest,
  CancelRecordingResponse,
} from '../../types/recording';
import {
  getAvailableScreens,
  createRecordingSession,
  startRecording,
  stopRecording,
  cancelRecording,
  setFinalMp4Path,
  getRecordingSession,
  cleanupOldRecordings,
} from '../services/screenRecordingService';
import { convertWebmToMp4 } from '../services/ffmpeg-service';
import { executeFFprobe } from '../services/ffmpeg-service';

/**
 * Register all recording IPC handlers
 */
export function registerRecordingHandlers(): void {
  console.log('[RecordingHandlers] Registering recording IPC handlers...');

  // Get available screens
  ipcMain.handle('recording:get-screens', handleGetScreens);

  // Create recording session
  ipcMain.handle('recording:create-session', handleCreateSession);

  // Start recording
  ipcMain.handle('recording:start', handleStartRecording);

  // Stop recording
  ipcMain.handle('recording:stop', handleStopRecording);

  // Cancel recording
  ipcMain.handle('recording:cancel', handleCancelRecording);

  // Save recording data from renderer
  ipcMain.handle('recording:save-data', handleSaveRecordingData);

  // Cleanup old recordings on startup
  cleanupOldRecordings();

  console.log('[RecordingHandlers] Recording IPC handlers registered');
}

/**
 * Handle get screens request
 */
async function handleGetScreens(event: IpcMainInvokeEvent): Promise<GetScreensResponse> {
  try {
    console.log('[RecordingHandlers] Getting available screens...');
    const screens = await getAvailableScreens();

    return {
      screens,
    };
  } catch (error) {
    console.error('[RecordingHandlers] Error getting screens:', error);
    return {
      screens: [],
      error: error instanceof Error ? error.message : 'Failed to get screens',
    };
  }
}

/**
 * Handle create recording session
 */
async function handleCreateSession(
  event: IpcMainInvokeEvent,
  request: { screenSourceId: string; audioEnabled: boolean }
): Promise<{ success: boolean; sessionId?: string; error?: string }> {
  try {
    console.log('[RecordingHandlers] Creating recording session:', request);

    if (!request.screenSourceId) {
      return {
        success: false,
        error: 'Screen source ID is required',
      };
    }

    const session = createRecordingSession(request.screenSourceId, request.audioEnabled);

    return {
      success: true,
      sessionId: session.sessionId,
    };
  } catch (error) {
    console.error('[RecordingHandlers] Error creating session:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create recording session',
    };
  }
}

/**
 * Handle start recording request
 */
async function handleStartRecording(
  event: IpcMainInvokeEvent,
  request: StartRecordingRequest
): Promise<StartRecordingResponse> {
  try {
    console.log('[RecordingHandlers] Starting recording:', request);

    if (!request.screenSourceId) {
      return {
        success: false,
        error: 'Screen source ID is required',
      };
    }

    // Create session
    const session = createRecordingSession(request.screenSourceId, request.audioEnabled);

    // Start recording (prepares session state)
    await startRecording(session.sessionId);

    return {
      success: true,
      sessionId: session.sessionId,
    };
  } catch (error) {
    console.error('[RecordingHandlers] Error starting recording:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start recording',
    };
  }
}

/**
 * Handle stop recording request
 * This converts the WebM file to MP4 and returns the final path
 */
async function handleStopRecording(
  event: IpcMainInvokeEvent,
  request: StopRecordingRequest
): Promise<StopRecordingResponse> {
  try {
    console.log('[RecordingHandlers] Stopping recording:', request);

    if (!request.sessionId) {
      return {
        success: false,
        error: 'Session ID is required',
      };
    }

    // Get temp WebM path
    const tempWebmPath = await stopRecording(request.sessionId);

    // Wait a bit for the file to be fully written by MediaRecorder
    await new Promise(resolve => setTimeout(resolve, 500));

    // Check if WebM file exists
    if (!fs.existsSync(tempWebmPath)) {
      return {
        success: false,
        error: 'Recording file not found. The recording may have failed.',
      };
    }

    // Generate final MP4 path
    const session = getRecordingSession(request.sessionId);
    if (!session) {
      return {
        success: false,
        error: 'Recording session not found',
      };
    }

    const recordingDir = path.dirname(tempWebmPath);
    const finalMp4Path = path.join(recordingDir, `${session.sessionId}-final.mp4`);

    console.log('[RecordingHandlers] Converting WebM to MP4:', {
      input: tempWebmPath,
      output: finalMp4Path,
    });

    // Convert WebM to MP4 using FFmpeg
    await convertWebmToMp4(tempWebmPath, finalMp4Path);

    // Update session with final MP4 path
    setFinalMp4Path(request.sessionId, finalMp4Path);

    // Get duration from MP4 using ffprobe
    const duration = await getVideoDuration(finalMp4Path);

    // Cleanup temp WebM file
    try {
      fs.unlinkSync(tempWebmPath);
      console.log('[RecordingHandlers] Deleted temp WebM file:', tempWebmPath);
    } catch (error) {
      console.error('[RecordingHandlers] Error deleting temp file:', error);
    }

    return {
      success: true,
      filePath: finalMp4Path,
      duration,
    };
  } catch (error) {
    console.error('[RecordingHandlers] Error stopping recording:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to stop recording',
    };
  }
}

/**
 * Handle cancel recording request
 */
async function handleCancelRecording(
  event: IpcMainInvokeEvent,
  request: CancelRecordingRequest
): Promise<CancelRecordingResponse> {
  try {
    console.log('[RecordingHandlers] Canceling recording:', request);

    if (!request.sessionId) {
      return {
        success: false,
        error: 'Session ID is required',
      };
    }

    await cancelRecording(request.sessionId);

    return {
      success: true,
    };
  } catch (error) {
    console.error('[RecordingHandlers] Error canceling recording:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cancel recording',
    };
  }
}

/**
 * Handle save recording data from renderer
 * Saves the recorded Blob data to WebM file
 */
async function handleSaveRecordingData(
  event: IpcMainInvokeEvent,
  request: { sessionId: string; data: Uint8Array }
): Promise<{ success: boolean; tempWebmPath?: string; error?: string }> {
  try {
    console.log('[RecordingHandlers] Saving recording data for session:', request.sessionId);

    const session = getRecordingSession(request.sessionId);
    if (!session || !session.tempWebmPath) {
      return {
        success: false,
        error: 'Recording session not found',
      };
    }

    // Write Uint8Array to file
    const buffer = Buffer.from(request.data);
    fs.writeFileSync(session.tempWebmPath, buffer);

    console.log('[RecordingHandlers] Saved recording to:', session.tempWebmPath);

    return {
      success: true,
      tempWebmPath: session.tempWebmPath,
    };
  } catch (error) {
    console.error('[RecordingHandlers] Error saving recording data:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save recording',
    };
  }
}

/**
 * Get video duration using ffprobe
 */
async function getVideoDuration(filePath: string): Promise<number> {
  try {
    const args = [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath,
    ];

    const result = await executeFFprobe(args);
    const duration = parseFloat(result.stdout.trim());

    return isNaN(duration) ? 0 : duration;
  } catch (error) {
    console.error('[RecordingHandlers] Error getting video duration:', error);
    return 0;
  }
}
