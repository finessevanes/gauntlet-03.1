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
