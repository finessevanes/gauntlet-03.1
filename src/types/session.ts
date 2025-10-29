/**
 * Session data model for Klippy
 * Defines the structure for clips, timeline, and persistent session state
 */

export interface Clip {
  id: string;                 // Unique identifier (UUID)
  filePath: string;           // Absolute path to source video file
  filename: string;           // Display name (extracted from path)
  duration: number;           // Total duration in seconds
  inPoint: number;            // Trim start point in seconds (default: 0)
  outPoint: number;           // Trim end point in seconds (default: duration)
  importedAt: number;         // Timestamp when imported (ms since epoch)

  // Video metadata (from Story 2: Video Import)
  thumbnail: string;          // Base64 data URL (e.g., "data:image/jpeg;base64,...")
  resolution: {
    width: number;            // e.g., 1920
    height: number;           // e.g., 1080
  };
  frameRate: number;          // Frames per second (e.g., 30)
  codec: string;              // Codec name (e.g., "h264")
  bitrate?: number;           // Optional: bits per second (e.g., 5000000)

  // Story S9: Screen Recording
  source?: 'import' | 'recording';  // Track if recorded in-app (default: 'import')
  recordedAt?: number;              // Timestamp when recorded (ms since epoch)

  // Story S11: Picture-in-Picture Recording
  isPiPRecording?: boolean;         // Flag for PiP composite videos
}

export interface Track {
  id: string;                 // UUID
  name: string;               // "Video", "Overlay", "Graphics", etc.
  muted: boolean;             // Audio disabled
  solo: boolean;              // Only this track's audio plays
  visible: boolean;           // Video visible (eye icon)
  opacity: number;            // 0.0 to 1.0
  zIndex: number;             // Layer order (0 = bottom, N-1 = top)
  createdAt: number;          // Timestamp
}

export interface TimelineClip {
  instanceId: string;         // Unique ID for this timeline instance (UUID)
  clipId: string;             // Reference to the library clip
  trackId?: string;           // Which track this clip belongs to (optional for backwards compat)
}

export interface Timeline {
  clips: TimelineClip[];      // Array of timeline clip instances in sequence
  duration: number;           // Total timeline duration (sum of trimmed clips)
  tracks: Track[];            // Array of tracks (ordered by zIndex)
}

export interface Session {
  version: string;            // e.g., "1.0.0" for future migrations
  clips: Clip[];              // All imported clips (library)
  timeline: Timeline;         // Timeline arrangement
  zoomLevel: number;          // Zoom percentage (100-1000), default: 'auto-fit'
  playheadPosition: number;   // Current playhead position in seconds
  scrollPosition: number;     // Timeline horizontal scroll offset in pixels
  lastModified: number;       // Timestamp of last save (ms since epoch)
}
