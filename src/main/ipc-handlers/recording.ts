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
  EncodeWebcamRecordingRequest,
  EncodeWebcamRecordingResponse,
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
  setWebcamRecordingStatus,
} from '../services/screenRecordingService';
import { convertWebmToMp4, executeFFmpeg, executeFFprobe } from '../services/ffmpeg-service';

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

  // Webcam recording handlers (Story S10)
  ipcMain.handle('recording:encode-webcam', handleEncodeWebcamRecording);
  ipcMain.handle('recording:set-webcam-status', handleSetWebcamStatus);

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

/**
 * Get video dimensions using ffprobe
 */
async function getVideoDimensions(filePath: string): Promise<{ width: number; height: number }> {
  try {
    const args = [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height',
      '-of', 'json',
      filePath,
    ];

    const result = await executeFFprobe(args);
    const data = JSON.parse(result.stdout);
    const stream = data.streams?.[0];

    return {
      width: stream?.width || 0,
      height: stream?.height || 0,
    };
  } catch (error) {
    console.error('[RecordingHandlers] Error getting video dimensions:', error);
    return { width: 0, height: 0 };
  }
}

/**
 * Handle set webcam recording status
 */
async function handleSetWebcamStatus(
  event: IpcMainInvokeEvent,
  request: { recording: boolean }
): Promise<{ success: boolean }> {
  try {
    console.log('[RecordingHandlers] Setting webcam recording status:', request.recording);
    setWebcamRecordingStatus(request.recording);
    return { success: true };
  } catch (error) {
    console.error('[RecordingHandlers] Error setting webcam status:', error);
    return { success: false };
  }
}

/**
 * Handle encode webcam recording request (Story S10)
 * Converts WebRTC recorded Blob to MP4 using FFmpeg
 */
async function handleEncodeWebcamRecording(
  event: IpcMainInvokeEvent,
  request: EncodeWebcamRecordingRequest
): Promise<EncodeWebcamRecordingResponse> {
  try {
    console.log('[RecordingHandlers] Encoding webcam recording:', {
      outputPath: request.outputPath,
      mimeType: request.mimeType,
      dimensions: `${request.width}x${request.height}`,
      blobSize: request.recordedBlob?.length || 0,
    });

    // Validate request
    if (!request.recordedBlob || request.recordedBlob.length === 0) {
      return {
        success: false,
        error: 'Invalid recording data: blob is empty',
      };
    }

    if (!request.outputPath) {
      return {
        success: false,
        error: 'Output path is required',
      };
    }

    // Determine input file extension from mime type
    const inputExt = request.mimeType.includes('webm') ? 'webm' : 'mp4';
    const tempInputPath = request.outputPath.replace('.mp4', `-input.${inputExt}`);

    // Write Blob buffer to temp input file
    console.log('[RecordingHandlers] Writing blob to temp file:', tempInputPath);
    fs.writeFileSync(tempInputPath, request.recordedBlob);

    // Check if file was written successfully
    if (!fs.existsSync(tempInputPath)) {
      return {
        success: false,
        error: 'Failed to write temporary input file',
      };
    }

    console.log('[RecordingHandlers] Temp file written successfully:', {
      path: tempInputPath,
      size: fs.statSync(tempInputPath).size,
    });

    // Convert to MP4 using FFmpeg
    console.log('[RecordingHandlers] Converting to MP4...');
    await convertWebmToMp4(tempInputPath, request.outputPath, 120000); // 2 min timeout

    // Get duration and dimensions from output file
    const duration = await getVideoDuration(request.outputPath);
    const dimensions = await getVideoDimensions(request.outputPath);

    // Generate thumbnail (first frame)
    const thumbnailPath = request.outputPath.replace('.mp4', '-thumb.jpg');
    try {
      console.log('[RecordingHandlers] Generating thumbnail...');
      const thumbnailArgs = [
        '-i', request.outputPath,
        '-ss', '0',
        '-vframes', '1',
        '-y',
        thumbnailPath,
      ];
      await executeFFmpeg(thumbnailArgs, 10000);
      console.log('[RecordingHandlers] Thumbnail generated:', thumbnailPath);
    } catch (error) {
      console.error('[RecordingHandlers] Error generating thumbnail:', error);
      // Non-critical error, continue
    }

    // Cleanup temp input file
    try {
      fs.unlinkSync(tempInputPath);
      console.log('[RecordingHandlers] Deleted temp input file:', tempInputPath);
    } catch (error) {
      console.error('[RecordingHandlers] Error deleting temp file:', error);
      // Non-critical error
    }

    console.log('[RecordingHandlers] Encoding complete:', {
      filePath: request.outputPath,
      duration,
      dimensions,
      thumbnailPath: fs.existsSync(thumbnailPath) ? thumbnailPath : undefined,
    });

    return {
      success: true,
      filePath: request.outputPath,
      duration,
      width: dimensions.width,
      height: dimensions.height,
      thumbnailPath: fs.existsSync(thumbnailPath) ? thumbnailPath : undefined,
    };
  } catch (error) {
    console.error('[RecordingHandlers] Error encoding webcam recording:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to encode webcam recording',
    };
  }
}
