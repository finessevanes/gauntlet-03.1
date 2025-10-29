/**
 * Recording IPC Handlers
 * Handles screen recording commands from renderer process
 * Story S9: Screen Recording
 */

import { ipcMain, IpcMainInvokeEvent, app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
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
  PiPRecordingSettings,
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
  getRecordingsDirectory,
} from '../services/screenRecordingService';
import { convertWebmToMp4, executeFFmpeg, executeFFprobe, generatePiPThumbnail } from '../services/ffmpeg-service';

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

  // Picture-in-Picture recording handlers (Story S11)
  ipcMain.handle('pip:check-camera-available', handleCheckCameraAvailable);
  ipcMain.handle('pip:get-pip-settings', handleGetPiPSettings);
  ipcMain.handle('pip:start-pip-recording', handleStartPiPRecording);
  ipcMain.handle('pip:stop-pip-recording', handleStopPiPRecording);
  ipcMain.handle('pip:composite-pip-videos', handleCompositePiPVideos);
  ipcMain.handle('pip:save-pip-settings', handleSavePiPSettings);
  ipcMain.handle('pip:save-screen-data', handleSaveScreenData);
  ipcMain.handle('pip:save-webcam-data', handleSaveWebcamData);

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
 * Check if file has audio stream
 */
async function hasAudioStream(filePath: string): Promise<boolean> {
  try {
    const args = [
      '-v', 'error',
      '-select_streams', 'a:0',
      '-show_entries', 'stream=codec_type',
      '-of', 'json',
      filePath,
    ];

    const result = await executeFFprobe(args);
    const data = JSON.parse(result.stdout);
    return (data.streams?.length || 0) > 0;
  } catch (error) {
    console.error('[RecordingHandlers] Error checking audio stream:', error);
    return false;
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

/**
 * =========================================================================
 * Picture-in-Picture Recording Handlers (Story S11)
 * =========================================================================
 */

// In-memory storage for active PiP recording sessions
import { PiPRecordingSession } from '../../types/recording';
const activePiPSessions = new Map<string, PiPRecordingSession>();

/**
 * Handle check camera available request
 */
async function handleCheckCameraAvailable(
  event: IpcMainInvokeEvent
): Promise<CheckCameraAvailableResponse> {
  try {
    console.log('[PiPHandlers] Checking camera availability...');

    // Note: The actual camera check happens in the renderer process via getUserMedia
    // This handler just returns a success response - the real check is done in the React component
    // We return available: true here, and let the renderer process handle the actual getUserMedia call
    return {
      available: true,
    };
  } catch (error) {
    console.error('[PiPHandlers] Error checking camera availability:', error);
    return {
      available: false,
      reason: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Handle get PiP settings request
 * Returns last used settings from session.json
 */
async function handleGetPiPSettings(
  event: IpcMainInvokeEvent
): Promise<GetPiPSettingsResponse> {
  try {
    console.log('[PiPHandlers] Getting PiP settings...');

    const userDataPath = app.getPath('userData');
    const sessionPath = path.join(userDataPath, 'session.json');

    // Default settings
    const defaultSettings: PiPRecordingSettings = {
      screenId: '',  // Will be set to primary screen in the component
      webcamPosition: 'BL',
      webcamSize: 'medium',
      audioMode: 'both',
    };

    // Try to read existing session
    if (fs.existsSync(sessionPath)) {
      try {
        const sessionData = JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));
        if (sessionData.pipSettings) {
          return {
            settings: {
              screenId: sessionData.pipSettings.lastScreenId || '',
              webcamPosition: sessionData.pipSettings.lastPosition || 'BL',
              webcamSize: sessionData.pipSettings.lastSize || 'medium',
              audioMode: sessionData.pipSettings.lastAudioMode || 'both',
            },
          };
        }
      } catch (parseError) {
        console.error('[PiPHandlers] Error parsing session.json:', parseError);
      }
    }

    // Return defaults if no saved settings
    return {
      settings: defaultSettings,
    };
  } catch (error) {
    console.error('[PiPHandlers] Error getting PiP settings:', error);
    return {
      settings: {
        screenId: '',
        webcamPosition: 'BL',
        webcamSize: 'medium',
        audioMode: 'both',
      },
      error: error instanceof Error ? error.message : 'Failed to get PiP settings',
    };
  }
}

/**
 * Handle start PiP recording request
 * Creates temp file paths and returns recording ID
 */
async function handleStartPiPRecording(
  event: IpcMainInvokeEvent,
  request: StartPiPRecordingRequest
): Promise<StartPiPRecordingResponse> {
  try {
    console.log('[PiPHandlers] Starting PiP recording:', request);

    if (!request.screenId) {
      return {
        success: false,
        error: 'Screen ID is required',
      };
    }

    // Generate unique recording ID
    const recordingId = uuidv4();
    const timestamp = Date.now();

    // Create temp file paths
    const tempDir = app.getPath('temp');
    const screenFilePath = path.join(tempDir, `pip-screen-${timestamp}.webm`);
    const webcamFilePath = path.join(tempDir, `pip-webcam-${timestamp}.webm`);

    // Create PiP recording session
    const session: PiPRecordingSession = {
      id: recordingId,
      startTime: timestamp,
      screenFilePath,
      webcamFilePath,
      settings: request.settings,
      status: 'recording',
    };

    // Store session
    activePiPSessions.set(recordingId, session);

    console.log('[PiPHandlers] PiP recording session created:', {
      recordingId,
      screenFilePath,
      webcamFilePath,
    });

    return {
      success: true,
      recordingId,
      status: 'recording',
    };
  } catch (error) {
    console.error('[PiPHandlers] Error starting PiP recording:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start PiP recording',
    };
  }
}

/**
 * Handle stop PiP recording request
 * Returns temp file paths for screen and webcam recordings
 */
async function handleStopPiPRecording(
  event: IpcMainInvokeEvent,
  request: StopPiPRecordingRequest
): Promise<StopPiPRecordingResponse> {
  try {
    console.log('[PiPHandlers] Stopping PiP recording:', request.recordingId);

    const session = activePiPSessions.get(request.recordingId);
    if (!session) {
      return {
        success: false,
        error: 'PiP recording session not found',
      };
    }

    // Calculate duration
    const duration = (Date.now() - session.startTime) / 1000;

    // Update session status
    session.status = 'stopping';

    console.log('[PiPHandlers] PiP recording stopped:', {
      recordingId: request.recordingId,
      duration,
      screenFile: session.screenFilePath,
      webcamFile: session.webcamFilePath,
    });

    return {
      success: true,
      screenFile: session.screenFilePath,
      webcamFile: session.webcamFilePath,
      duration,
    };
  } catch (error) {
    console.error('[PiPHandlers] Error stopping PiP recording:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to stop PiP recording',
    };
  }
}

/**
 * Handle composite PiP videos request
 * Uses FFmpeg to overlay webcam on screen recording
 *
 * IMPORTANT: outputPath should be in recordings directory (app.getPath('userData')/recordings/)
 * for persistence across app launches and packaged builds (npm run make).
 * Do NOT use temp directory for final composite video.
 */
async function handleCompositePiPVideos(
  event: IpcMainInvokeEvent,
  request: CompositePiPVideosRequest
): Promise<CompositePiPVideosResponse> {
  try {
    console.log('[PiPHandlers] Compositing PiP videos:', {
      screenFile: request.screenFile,
      webcamFile: request.webcamFile,
      settings: request.settings,
      outputPath: request.outputPath,
    });

    // Validate input files exist
    if (!fs.existsSync(request.screenFile)) {
      return {
        success: false,
        error: 'Screen recording file not found',
      };
    }

    if (!fs.existsSync(request.webcamFile)) {
      return {
        success: false,
        error: 'Webcam recording file not found',
      };
    }

    // Get screen video dimensions using ffprobe
    const screenDimensions = await getVideoDimensions(request.screenFile);
    const screenW = screenDimensions.width;
    const screenH = screenDimensions.height;

    // Check which streams have audio
    const screenHasAudio = await hasAudioStream(request.screenFile);
    const webcamHasAudio = await hasAudioStream(request.webcamFile);

    console.log('[PiPHandlers] Audio stream detection:', {
      screenHasAudio,
      webcamHasAudio,
      audioMode: request.settings.audioMode,
    });

    // Calculate webcam overlay size based on settings
    const sizeMap = {
      small: 0.2,
      medium: 0.3,
      large: 0.4,
    };
    const webcamW = Math.floor(screenW * sizeMap[request.settings.webcamSize]);
    const webcamH = Math.floor((webcamW / 16) * 9); // Assume 16:9 aspect ratio

    // Calculate webcam overlay position based on settings
    const posMap = {
      TL: { x: 0, y: 0 },
      TR: { x: screenW - webcamW, y: 0 },
      BL: { x: 0, y: screenH - webcamH },
      BR: { x: screenW - webcamW, y: screenH - webcamH },
    };
    const pos = posMap[request.settings.webcamPosition];

    // Build video filter based on webcam shape
    let videoFilter: string;

    if (request.settings.webcamShape === 'circle') {
      // For circular shape: scale to square and apply circular mask using geq filter
      // The geq filter requires expressions for all channels: r, g, b, and a
      const circleSize = webcamW;
      // Use geq to create a circular mask:
      // - r, g, b: pass through original pixel values
      // - a: if pixel distance from center <= radius, keep alpha=255, else alpha=0
      videoFilter = `[1:v]scale=${circleSize}:${circleSize}[scaled];[scaled]format=rgba[fmt];[fmt]geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(lte(hypot(X-W/2\\,Y-H/2)\\,W/2)\\,255\\,0)'[masked];[0:v][masked]overlay=x=${pos.x}:y=${pos.y}[vid]`;
    } else {
      // For rectangular shape: use standard scaling
      videoFilter = `[1:v]scale=${webcamW}:${webcamH}[webcam];[0:v][webcam]overlay=x=${pos.x}:y=${pos.y}[vid]`;
    }

    // Build audio handling - PiP always uses microphone audio only (like webcam recording)
    let filterComplex: string = videoFilter;
    let audioMap: string[] = [];
    let ffmpegArgs: string[];

    // Always use webcam audio (microphone) if available
    if (webcamHasAudio) {
      audioMap = ['1:a'];
      console.log('[PiPHandlers] Using microphone audio from webcam track');
    } else {
      console.warn('[PiPHandlers] No microphone audio available in webcam track');
    }

    // Build FFmpeg command
    ffmpegArgs = [
      '-i', request.screenFile,
      '-i', request.webcamFile,
      '-filter_complex', filterComplex,
      '-map', '[vid]',
    ];

    // Add audio maps if available
    if (audioMap.length > 0) {
      for (const map of audioMap) {
        ffmpegArgs.push('-map', map);
      }
      ffmpegArgs.push('-c:a', 'aac', '-b:a', '128k');
    }

    // Add video codec and output
    ffmpegArgs.push(
      '-c:v', 'libx264',
      '-preset', 'medium',
      '-crf', '23',
      '-y',
      request.outputPath
    );

    console.log('[PiPHandlers] Executing FFmpeg composite command...');
    await executeFFmpeg(ffmpegArgs, 120000); // 2 minute timeout

    // Get duration of composite video
    const duration = await getVideoDuration(request.outputPath);

    console.log('[PiPHandlers] Composite video created:', {
      outputPath: request.outputPath,
      duration,
    });

    // Generate intelligent thumbnail for PiP video
    // Samples frames at 0ms, 500ms, 1000ms, 1500ms to detect when PiP overlay appears
    const thumbnailPath = request.outputPath.replace('.mp4', '-thumb.jpg');
    let finalThumbnailPath: string | undefined;
    try {
      console.log('[PiPHandlers] Generating PiP thumbnail with frame sampling...');
      await generatePiPThumbnail(request.outputPath, thumbnailPath);
      finalThumbnailPath = fs.existsSync(thumbnailPath) ? thumbnailPath : undefined;
      console.log('[PiPHandlers] PiP thumbnail generated:', finalThumbnailPath);
    } catch (error) {
      console.error('[PiPHandlers] Error generating PiP thumbnail:', error);
      // Non-critical error, continue without thumbnail
    }

    // Cleanup temp files
    try {
      fs.unlinkSync(request.screenFile);
      fs.unlinkSync(request.webcamFile);
      console.log('[PiPHandlers] Cleaned up temp files');
    } catch (cleanupError) {
      console.error('[PiPHandlers] Error cleaning up temp files:', cleanupError);
      // Non-critical error
    }

    return {
      success: true,
      compositeFile: request.outputPath,
      duration,
      thumbnailPath: finalThumbnailPath,
    };
  } catch (error) {
    console.error('[PiPHandlers] Error compositing PiP videos:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to composite PiP videos',
    };
  }
}

/**
 * Handle save PiP settings request
 * Persists settings to session.json
 */
async function handleSavePiPSettings(
  event: IpcMainInvokeEvent,
  request: SavePiPSettingsRequest
): Promise<SavePiPSettingsResponse> {
  try {
    console.log('[PiPHandlers] Saving PiP settings:', request.settings);

    const userDataPath = app.getPath('userData');
    const sessionPath = path.join(userDataPath, 'session.json');

    let sessionData: any = {};

    // Read existing session if it exists
    if (fs.existsSync(sessionPath)) {
      try {
        sessionData = JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));
      } catch (parseError) {
        console.error('[PiPHandlers] Error parsing session.json:', parseError);
        sessionData = {};
      }
    }

    // Update pipSettings section
    sessionData.pipSettings = {
      lastScreenId: request.settings.screenId,
      lastPosition: request.settings.webcamPosition,
      lastSize: request.settings.webcamSize,
      lastAudioMode: request.settings.audioMode,
    };

    // Write back to session.json
    fs.writeFileSync(sessionPath, JSON.stringify(sessionData, null, 2), 'utf-8');

    console.log('[PiPHandlers] PiP settings saved successfully');

    return {
      success: true,
    };
  } catch (error) {
    console.error('[PiPHandlers] Error saving PiP settings:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save PiP settings',
    };
  }
}

/**
 * Export function to check if PiP recording is active (for quit prevention)
 */
export function hasPiPRecordingActive(): boolean {
  for (const session of activePiPSessions.values()) {
    if (session.status === 'recording' || session.status === 'compositing') {
      return true;
    }
  }
  return false;
}

/**
 * Export function to cleanup PiP session
 */
export function cleanupPiPSession(recordingId: string): void {
  activePiPSessions.delete(recordingId);
}

/**
 * Handle save screen recording data
 * Saves the screen Blob data to temp file
 */
async function handleSaveScreenData(
  event: IpcMainInvokeEvent,
  request: { recordingId: string; filePath: string; data: Uint8Array }
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('[PiPHandlers] Saving screen data for recording:', request.recordingId);

    // Write Uint8Array to file
    const buffer = Buffer.from(request.data);
    fs.writeFileSync(request.filePath, buffer);

    console.log('[PiPHandlers] Saved screen recording to:', request.filePath);

    return {
      success: true,
    };
  } catch (error) {
    console.error('[PiPHandlers] Error saving screen data:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save screen recording',
    };
  }
}

/**
 * Handle save webcam recording data
 * Saves the webcam Blob data to temp file
 */
async function handleSaveWebcamData(
  event: IpcMainInvokeEvent,
  request: { recordingId: string; filePath: string; data: Uint8Array }
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('[PiPHandlers] Saving webcam data for recording:', request.recordingId);

    // Write Uint8Array to file
    const buffer = Buffer.from(request.data);
    fs.writeFileSync(request.filePath, buffer);

    console.log('[PiPHandlers] Saved webcam recording to:', request.filePath);

    return {
      success: true,
    };
  } catch (error) {
    console.error('[PiPHandlers] Error saving webcam data:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save webcam recording',
    };
  }
}
