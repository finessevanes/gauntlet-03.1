/**
 * IPC type definitions for Electron main-renderer communication
 */

import { Session } from './session';

export interface AppInitResponse {
  session: Session | null;      // Restored session or null if first launch
  ffmpegStatus: 'ok' | 'error'; // FFmpeg validation result
  error?: string;               // Error message if status === 'error'
}

export interface FFmpegValidationResponse {
  valid: boolean;               // Whether FFmpeg is available and working
  ffmpegPath?: string;          // Path to FFmpeg binary
  version?: string;             // FFmpeg version string
  error?: string;               // Error message if validation failed
}

// Import-related IPC types (Story 2: Video Import)

export interface FilePickerResponse {
  filePaths: string[];          // Array of selected file paths
  canceled: boolean;            // True if user canceled the dialog
}

export interface FileValidationResponse {
  valid: boolean;               // Whether file is valid for import
  error?: string;               // Error message if invalid
}

export interface VideoMetadataResponse {
  success: boolean;             // Whether metadata extraction succeeded
  data?: {
    duration: number;
    resolution: {
      width: number;
      height: number;
    };
    frameRate: number;
    codec: string;
    bitrate?: number;
    filename: string;
  };
  error?: string;               // Error message if extraction failed
}

export interface ThumbnailResponse {
  success: boolean;             // Whether thumbnail generation succeeded
  thumbnail?: string;           // Base64 data URL (e.g., "data:image/jpeg;base64,...")
  error?: string;               // Error message if generation failed
}

// Library-related IPC types (Story 3: Library View)

export interface CheckFileExistsRequest {
  filePath: string;             // Absolute path to file to check
}

export interface CheckFileExistsResponse {
  exists: boolean;              // True if file exists and is accessible
  error?: string;               // Error message if file not found or not accessible
}
