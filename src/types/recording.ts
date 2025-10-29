/**
 * Recording Types
 * TypeScript interfaces for screen recording feature (Story S9)
 */

export interface ScreenInfo {
  id: string;              // desktopCapturer source ID
  name: string;            // "Display 1", "Built-in Retina", etc.
  resolution: string;      // "2560x1600"
  thumbnail: string;       // Base64 data URL of thumbnail
  displayId?: string;      // Electron displayId for positioning overlay on correct display
}

export interface RecordingSession {
  sessionId: string;
  screenSourceId: string;
  recordingState: 'idle' | 'recording' | 'stopping' | 'converting';
  startTime: number;       // Date.now()
  elapsedSeconds: number;
  audioEnabled: boolean;
  tempWebmPath?: string;
  finalMp4Path?: string;
}

export interface GetScreensResponse {
  screens: ScreenInfo[];
  error?: string;
}

export interface StartRecordingRequest {
  screenSourceId: string;
  audioEnabled: boolean;
}

export interface StartRecordingResponse {
  success: boolean;
  sessionId?: string;
  error?: string;
}

export interface StopRecordingRequest {
  sessionId: string;
}

export interface StopRecordingResponse {
  success: boolean;
  filePath?: string;
  duration?: number;
  error?: string;
}

export interface CancelRecordingRequest {
  sessionId: string;
}

export interface CancelRecordingResponse {
  success: boolean;
  error?: string;
}

export interface GetAudioLevelRequest {
  sessionId: string;
}

export interface GetAudioLevelResponse {
  level: number; // 0-100
}

/**
 * Webcam Recording Types (Story S10)
 */

export interface CameraDevice {
  deviceId: string;
  label: string;  // e.g., "FaceTime HD Camera" or "USB Camera"
  kind: 'videoinput';
}

export interface GetCamerasResponse {
  cameras: CameraDevice[];
  error?: string;
}

export interface EncodeWebcamRecordingRequest {
  recordedBlob: Buffer;  // WebRTC recording data as Buffer
  outputPath: string;    // Full path to save MP4
  mimeType: string;      // e.g., 'video/webm' or 'video/mp4'
  width: number;         // Camera resolution width
  height: number;        // Camera resolution height
}

export interface EncodeWebcamRecordingResponse {
  success: boolean;
  filePath?: string;     // Full path to saved MP4
  duration?: number;     // Duration in seconds
  width?: number;
  height?: number;
  thumbnailPath?: string; // Path to thumbnail image (first frame)
  error?: string;
}

/**
 * Picture-in-Picture Recording Types (Story S11)
 */

export interface PiPRecordingSettings {
  screenId: string;                              // Selected monitor/window ID from desktopCapturer
  webcamPosition: 'TL' | 'TR' | 'BL' | 'BR';     // Top-Left, Top-Right, Bottom-Left, Bottom-Right
  webcamSize: 'small' | 'medium' | 'large';      // 20%, 30%, 40% of screen width
  webcamShape: 'rectangle' | 'circle';           // Webcam overlay shape
}

export interface PiPRecordingSession {
  id: string;                    // Unique recording ID
  startTime: number;             // Timestamp (ms since epoch)
  screenFilePath: string;        // Temp file path for screen recording
  webcamFilePath: string;        // Temp file path for webcam recording
  settings: PiPRecordingSettings;
  status: 'recording' | 'stopping' | 'compositing' | 'done' | 'error';
  errorMessage?: string;
}

export interface CheckCameraAvailableResponse {
  available: boolean;
  reason?: string;  // e.g., "Permission denied" or "Camera in use"
}

export interface GetPiPSettingsResponse {
  settings: PiPRecordingSettings;
  error?: string;
}

export interface StartPiPRecordingRequest {
  screenId: string;
  settings: PiPRecordingSettings;
}

export interface StartPiPRecordingResponse {
  success: boolean;
  recordingId?: string;
  status?: 'recording';
  error?: string;
}

export interface StopPiPRecordingRequest {
  recordingId: string;
}

export interface StopPiPRecordingResponse {
  success: boolean;
  screenFile?: string;
  webcamFile?: string;
  duration?: number;
  error?: string;
}

export interface CompositePiPVideosRequest {
  screenFile: string;
  webcamFile: string;
  settings: PiPRecordingSettings;
  outputPath: string;
}

export interface CompositePiPVideosResponse {
  success: boolean;
  compositeFile?: string;
  duration?: number;
  thumbnailPath?: string;
  error?: string;
}

export interface SavePiPSettingsRequest {
  settings: PiPRecordingSettings;
}

export interface SavePiPSettingsResponse {
  success: boolean;
  error?: string;
}
