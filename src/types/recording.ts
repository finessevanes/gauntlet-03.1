/**
 * Recording Types
 * TypeScript interfaces for screen recording feature (Story S9)
 */

export interface ScreenInfo {
  id: string;              // desktopCapturer source ID
  name: string;            // "Display 1", "Built-in Retina", etc.
  resolution: string;      // "2560x1600"
  thumbnail: string;       // Base64 data URL of thumbnail
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
