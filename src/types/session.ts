/**
 * Session data model for Klippy
 * Defines the structure for clips, timeline, and persistent session state
 */

export interface Clip {
  id: string;                 // Unique identifier (UUID)
  filePath: string;           // Absolute path to source video file
  duration: number;           // Total duration in seconds
  inPoint: number;            // Trim start point in seconds (default: 0)
  outPoint: number;           // Trim end point in seconds (default: duration)
  importedAt: number;         // Timestamp when imported (ms since epoch)
}

export interface Timeline {
  clips: string[];            // Array of clip IDs in sequence
  duration: number;           // Total timeline duration (sum of trimmed clips)
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
