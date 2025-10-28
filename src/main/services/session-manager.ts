/**
 * Session Manager Module
 * Handles loading, saving, and validation of session state
 */

import { app } from 'electron';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { Session, Clip, Timeline } from '../../types/session';

/**
 * Gets the path to the session file in userData directory
 *
 * @returns Absolute path to session.json
 */
function getSessionFilePath(): string {
  return join(app.getPath('userData'), 'session.json');
}

/**
 * Loads session from userData/session.json
 *
 * @returns Session object if valid, null if file doesn't exist or is invalid
 */
export function loadSession(): Session | null {
  const sessionPath = getSessionFilePath();

  try {
    // Check if session file exists
    if (!existsSync(sessionPath)) {
      console.log('[SessionManager] No session file found. Starting with empty state.');
      return null;
    }

    // Read and parse session file
    const fileContent = readFileSync(sessionPath, 'utf-8');
    const sessionData = JSON.parse(fileContent);

    // Validate session data structure
    if (!validateSession(sessionData)) {
      console.error('[SessionManager] Session file is invalid. Starting with empty state.');
      return null;
    }

    console.log('[SessionManager] Session loaded successfully:', {
      clips: sessionData.clips.length,
      timelineClips: sessionData.timeline.clips.length,
    });

    return sessionData as Session;

  } catch (error) {
    console.error('[SessionManager] Failed to load session:', error instanceof Error ? error.message : String(error));
    return null;
  }
}

/**
 * Saves session to userData/session.json
 *
 * @param session Session object to save
 * @returns true if saved successfully, false otherwise
 */
export function saveSession(session: Session): boolean {
  const sessionPath = getSessionFilePath();

  try {
    // Update lastModified timestamp
    session.lastModified = Date.now();

    // Write session to file with pretty formatting
    const jsonContent = JSON.stringify(session, null, 2);
    writeFileSync(sessionPath, jsonContent, 'utf-8');

    console.log('[SessionManager] Session saved successfully to:', sessionPath);
    return true;

  } catch (error) {
    console.error('[SessionManager] Failed to save session:', error instanceof Error ? error.message : String(error));
    return false;
  }
}

/**
 * Validates session data structure and field types
 *
 * @param data Parsed JSON data to validate
 * @returns true if valid session structure, false otherwise
 */
export function validateSession(data: any): boolean {
  try {
    // Check required top-level fields
    if (!data || typeof data !== 'object') {
      console.error('[SessionManager] Session data is not an object');
      return false;
    }

    if (typeof data.version !== 'string') {
      console.error('[SessionManager] Missing or invalid version field');
      return false;
    }

    if (!Array.isArray(data.clips)) {
      console.error('[SessionManager] clips field is not an array');
      return false;
    }

    if (!data.timeline || typeof data.timeline !== 'object') {
      console.error('[SessionManager] Missing or invalid timeline field');
      return false;
    }

    if (!Array.isArray(data.timeline.clips)) {
      console.error('[SessionManager] timeline.clips is not an array');
      return false;
    }

    if (typeof data.timeline.duration !== 'number') {
      console.error('[SessionManager] timeline.duration is not a number');
      return false;
    }

    if (typeof data.zoomLevel !== 'number') {
      console.error('[SessionManager] zoomLevel is not a number');
      return false;
    }

    if (typeof data.playheadPosition !== 'number') {
      console.error('[SessionManager] playheadPosition is not a number');
      return false;
    }

    if (typeof data.scrollPosition !== 'number') {
      console.error('[SessionManager] scrollPosition is not a number');
      return false;
    }

    // Validate each clip
    for (const clip of data.clips) {
      if (!validateClip(clip)) {
        return false;
      }
    }

    // Validate zoom level range (100-1000)
    if (data.zoomLevel < 100 || data.zoomLevel > 1000) {
      console.error('[SessionManager] zoomLevel out of range (100-1000):', data.zoomLevel);
      return false;
    }

    // Validate playhead position (non-negative)
    if (data.playheadPosition < 0) {
      console.error('[SessionManager] playheadPosition is negative:', data.playheadPosition);
      return false;
    }

    return true;

  } catch (error) {
    console.error('[SessionManager] Validation error:', error instanceof Error ? error.message : String(error));
    return false;
  }
}

/**
 * Validates a single clip object
 *
 * @param clip Clip object to validate
 * @returns true if valid, false otherwise
 */
function validateClip(clip: any): boolean {
  if (!clip || typeof clip !== 'object') {
    console.error('[SessionManager] Clip is not an object:', clip);
    return false;
  }

  if (typeof clip.id !== 'string' || clip.id.length === 0) {
    console.error('[SessionManager] Invalid clip id:', clip.id);
    return false;
  }

  if (typeof clip.filePath !== 'string' || clip.filePath.length === 0) {
    console.error('[SessionManager] Invalid clip filePath:', clip.filePath);
    return false;
  }

  if (typeof clip.duration !== 'number' || clip.duration <= 0) {
    console.error('[SessionManager] Invalid clip duration:', clip.duration);
    return false;
  }

  if (typeof clip.inPoint !== 'number' || clip.inPoint < 0) {
    console.error('[SessionManager] Invalid clip inPoint:', clip.inPoint);
    return false;
  }

  if (typeof clip.outPoint !== 'number' || clip.outPoint <= 0) {
    console.error('[SessionManager] Invalid clip outPoint:', clip.outPoint);
    return false;
  }

  // Validate: 0 <= inPoint < outPoint <= duration
  if (clip.inPoint >= clip.outPoint) {
    console.error('[SessionManager] inPoint must be less than outPoint:', clip);
    return false;
  }

  if (clip.outPoint > clip.duration) {
    console.error('[SessionManager] outPoint exceeds duration:', clip);
    return false;
  }

  if (typeof clip.importedAt !== 'number' || clip.importedAt <= 0) {
    console.error('[SessionManager] Invalid clip importedAt:', clip.importedAt);
    return false;
  }

  return true;
}
