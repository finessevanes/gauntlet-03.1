/**
 * Timeline IPC Handlers
 * Handles timeline operations: add, reorder, delete clips, zoom, playhead, scroll
 */

import { ipcMain } from 'electron';
import { randomUUID } from 'crypto';
import { loadSession, saveSession } from '../services/session-manager';
import { Session, TimelineClip } from '../../types/session';

// In-memory session cache (updated on each operation)
let sessionCache: Session | null = null;

/**
 * Get current session (from cache or disk)
 */
function getCurrentSession(): Session | null {
  if (!sessionCache) {
    sessionCache = loadSession();
  }
  return sessionCache;
}

/**
 * Save session to both cache and disk
 */
function persistSession(session: Session): boolean {
  sessionCache = session;
  return saveSession(session);
}

/**
 * Initialize session cache (called when app starts and session is loaded)
 */
export function initializeSessionCache(session: Session): void {
  let needsSave = false;

  // Migration: Convert old string[] format to TimelineClip[] format
  if (session.timeline.clips.length > 0 && typeof session.timeline.clips[0] === 'string') {
    console.log('[Timeline] Migrating timeline from string[] to TimelineClip[] format');
    session.timeline.clips = (session.timeline.clips as unknown as string[]).map((clipId) => ({
      instanceId: randomUUID(),
      clipId,
    }));
    needsSave = true;
  }

  // Clean up timeline: remove any clip instances that reference non-existent library clips
  const validClipIds = new Set(session.clips.map(c => c.id));
  const originalLength = session.timeline.clips.length;

  session.timeline.clips = session.timeline.clips.filter((timelineClip) => {
    if (!validClipIds.has(timelineClip.clipId)) {
      console.log('[Timeline] Removing orphaned timeline clip:', timelineClip);
      return false;
    }
    return true;
  });

  // Allow duplicates (same clip can appear multiple times on timeline)
  // This is intentional - users can add the same library clip to timeline multiple times

  if (session.timeline.clips.length !== originalLength) {
    console.log('[Timeline] Cleaned timeline:', {
      before: originalLength,
      after: session.timeline.clips.length,
      removed: originalLength - session.timeline.clips.length
    });
    needsSave = true;
  }

  // Recalculate duration
  const newDuration = session.timeline.clips.reduce((total, timelineClip) => {
    const clip = session.clips.find(c => c.id === timelineClip.clipId);
    if (clip) {
      return total + (clip.outPoint - clip.inPoint);
    }
    return total;
  }, 0);

  if (newDuration !== session.timeline.duration) {
    session.timeline.duration = newDuration;
    needsSave = true;
  }

  // Save if changes were made
  if (needsSave) {
    console.log('[Timeline] Saving migrated/cleaned session');
    saveSession(session);
  }

  sessionCache = session;
  console.log('[Timeline] Session cache initialized');
}

/**
 * Register all timeline-related IPC handlers
 */
export function registerTimelineHandlers(): void {
  // Handler: timeline:add_clip_to_timeline
  // Add a clip from Library to the timeline
  ipcMain.handle('timeline:add_clip_to_timeline', async (_event, { clipId, position }: { clipId: string; position?: number }) => {
    console.log('[IPC] timeline:add_clip_to_timeline called:', { clipId, position });

    try {
      const session = getCurrentSession();

      if (!session) {
        return {
          success: false,
          error: 'Session not initialized',
        };
      }

      // Validate clip exists in library
      const clip = session.clips.find((c) => c.id === clipId);
      if (!clip) {
        return {
          success: false,
          error: `Clip not found: ${clipId}`,
        };
      }

      // Create a unique timeline instance for this clip
      // This allows the same library clip to be added multiple times
      const timelineClip: TimelineClip = {
        instanceId: randomUUID(),
        clipId: clipId,
        inPoint: clip.inPoint,
        outPoint: clip.outPoint,
        startTime: 0, // Will be calculated based on position
      };

      // Determine insertion position (default: end of timeline)
      const insertPosition = position !== undefined ? position : session.timeline.clips.length;

      // Validate position
      if (insertPosition < 0 || insertPosition > session.timeline.clips.length) {
        return {
          success: false,
          error: 'Invalid position',
        };
      }

      // Insert timeline clip instance into timeline
      session.timeline.clips.splice(insertPosition, 0, timelineClip);

      // Calculate start times for all timeline clips
      let currentTime = 0;
      session.timeline.clips.forEach(tc => {
        tc.startTime = currentTime;
        currentTime += (tc.outPoint - tc.inPoint);
      });

      // Recalculate timeline duration using timeline clip trim points
      session.timeline.duration = session.timeline.clips.reduce((total, timelineClip) => {
        return total + (timelineClip.outPoint - timelineClip.inPoint);
      }, 0);

      // Save session
      const saved = persistSession(session);

      if (!saved) {
        return {
          success: false,
          error: 'Failed to save session',
        };
      }

      console.log('[IPC] Clip added to timeline:', {
        clipId,
        position: insertPosition,
        timelineLength: session.timeline.clips.length,
        duration: session.timeline.duration,
      });

      return {
        success: true,
        clipId,
        position: insertPosition,
      };

    } catch (error) {
      console.error('[IPC] timeline:add_clip_to_timeline error:', error);
      return {
        success: false,
        error: `Failed to add clip: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  });

  // Handler: timeline:reorder_timeline_clip
  // Move a clip to a new position on the timeline
  ipcMain.handle('timeline:reorder_timeline_clip', async (_event, { instanceId, newPosition }: { instanceId: string; newPosition: number }) => {
    console.log('[IPC] timeline:reorder_timeline_clip called:', { instanceId, newPosition });

    try {
      const session = getCurrentSession();

      if (!session) {
        return {
          success: false,
          error: 'Session not initialized',
        };
      }

      // Find timeline clip instance by instanceId
      const currentPosition = session.timeline.clips.findIndex(tc => tc.instanceId === instanceId);

      if (currentPosition === -1) {
        return {
          success: false,
          error: 'Timeline clip instance not found',
        };
      }

      // Validate new position
      if (newPosition < 0 || newPosition >= session.timeline.clips.length) {
        return {
          success: false,
          error: 'Invalid position',
        };
      }

      // Get the timeline clip to move
      const timelineClip = session.timeline.clips[currentPosition];

      // Remove clip from old position
      session.timeline.clips.splice(currentPosition, 1);

      // Insert at new position
      session.timeline.clips.splice(newPosition, 0, timelineClip);

      // Calculate start times for all timeline clips
      let currentTime = 0;
      session.timeline.clips.forEach(tc => {
        tc.startTime = currentTime;
        currentTime += (tc.outPoint - tc.inPoint);
      });

      // Recalculate timeline duration using timeline clip trim points
      session.timeline.duration = session.timeline.clips.reduce((total, timelineClip) => {
        return total + (timelineClip.outPoint - timelineClip.inPoint);
      }, 0);

      // Save session
      const saved = persistSession(session);

      if (!saved) {
        return {
          success: false,
          error: 'Failed to save session',
        };
      }

      console.log('[IPC] Clip reordered:', {
        instanceId,
        from: currentPosition,
        to: newPosition,
        timeline: session.timeline.clips,
      });

      return {
        success: true,
        updatedTimeline: session.timeline.clips,
        duration: session.timeline.duration,
      };

    } catch (error) {
      console.error('[IPC] timeline:reorder_timeline_clip error:', error);
      return {
        success: false,
        error: `Failed to reorder clip: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  });

  // Handler: timeline:delete_timeline_clip
  // Remove a clip from the timeline
  ipcMain.handle('timeline:delete_timeline_clip', async (_event, { instanceId }: { instanceId: string }) => {
    console.log('[IPC] timeline:delete_timeline_clip called:', { instanceId });

    try {
      const session = getCurrentSession();

      if (!session) {
        return {
          success: false,
          error: 'Session not initialized',
        };
      }

      // Find timeline clip instance by instanceId
      const position = session.timeline.clips.findIndex(tc => tc.instanceId === instanceId);

      if (position === -1) {
        return {
          success: false,
          error: 'Timeline clip instance not found',
        };
      }

      // Remove timeline clip instance from timeline
      session.timeline.clips.splice(position, 1);

      // Calculate start times for all timeline clips
      let currentTime = 0;
      session.timeline.clips.forEach(tc => {
        tc.startTime = currentTime;
        currentTime += (tc.outPoint - tc.inPoint);
      });

      // Recalculate timeline duration using timeline clip trim points
      session.timeline.duration = session.timeline.clips.reduce((total, timelineClip) => {
        return total + (timelineClip.outPoint - timelineClip.inPoint);
      }, 0);

      // If playhead is beyond new duration, reset to 0
      if (session.playheadPosition > session.timeline.duration) {
        session.playheadPosition = 0;
      }

      // Save session
      const saved = persistSession(session);

      if (!saved) {
        return {
          success: false,
          error: 'Failed to save session',
        };
      }

      console.log('[IPC] Clip deleted from timeline:', {
        instanceId,
        timelineLength: session.timeline.clips.length,
        duration: session.timeline.duration,
      });

      return {
        success: true,
        updatedTimeline: session.timeline.clips,
      };

    } catch (error) {
      console.error('[IPC] timeline:delete_timeline_clip error:', error);
      return {
        success: false,
        error: `Failed to delete clip: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  });

  // Handler: timeline:set_timeline_zoom
  // Set zoom level for timeline view
  ipcMain.handle('timeline:set_timeline_zoom', async (_event, { zoomLevel }: { zoomLevel: number | 'auto' }) => {
    console.log('[IPC] timeline:set_timeline_zoom called:', { zoomLevel });

    try {
      const session = getCurrentSession();

      if (!session) {
        return {
          success: false,
          error: 'Session not initialized',
        };
      }

      // Handle auto-fit (will be calculated in renderer based on container width)
      if (zoomLevel === 'auto') {
        // Return success, renderer will calculate actual zoom
        return {
          success: true,
          zoomLevel: 'auto',
        };
      }

      // Validate zoom level range (100-1000)
      if (typeof zoomLevel !== 'number' || zoomLevel < 100 || zoomLevel > 1000) {
        return {
          success: false,
          error: 'Invalid zoom level (must be 100-1000 or "auto")',
        };
      }

      // Update zoom level
      session.zoomLevel = zoomLevel;

      // Save session
      const saved = persistSession(session);

      if (!saved) {
        return {
          success: false,
          error: 'Failed to save session',
        };
      }

      console.log('[IPC] Zoom level updated:', zoomLevel);

      return {
        success: true,
        zoomLevel,
      };

    } catch (error) {
      console.error('[IPC] timeline:set_timeline_zoom error:', error);
      return {
        success: false,
        error: `Failed to set zoom: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  });

  // Handler: timeline:set_playhead_position
  // Move playhead to a specific time position
  ipcMain.handle('timeline:set_playhead_position', async (_event, { time }: { time: number }) => {
    console.log('[IPC] timeline:set_playhead_position called:', { time });

    try {
      const session = getCurrentSession();

      if (!session) {
        return {
          success: false,
          error: 'Session not initialized',
        };
      }

      // Clamp time to valid range (0 to timeline duration)
      const clampedTime = Math.max(0, Math.min(time, session.timeline.duration));

      // Update playhead position
      session.playheadPosition = clampedTime;

      // Save session
      const saved = persistSession(session);

      if (!saved) {
        return {
          success: false,
          error: 'Failed to save session',
        };
      }

      console.log('[IPC] Playhead position updated:', clampedTime);

      return {
        success: true,
        playheadPosition: clampedTime,
      };

    } catch (error) {
      console.error('[IPC] timeline:set_playhead_position error:', error);
      return {
        success: false,
        error: `Failed to set playhead: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  });

  // Handler: timeline:get_timeline_state
  // Get current timeline state for initialization
  ipcMain.handle('timeline:get_timeline_state', async () => {
    console.log('[IPC] timeline:get_timeline_state called');

    try {
      const session = getCurrentSession();

      if (!session) {
        // Return empty state if no session
        return {
          clips: [],
          duration: 0,
          playheadPosition: 0,
          zoomLevel: 100,
          scrollPosition: 0,
        };
      }

      return {
        clips: session.timeline.clips,
        duration: session.timeline.duration,
        playheadPosition: session.playheadPosition,
        zoomLevel: session.zoomLevel,
        scrollPosition: session.scrollPosition,
      };

    } catch (error) {
      console.error('[IPC] timeline:get_timeline_state error:', error);
      return {
        clips: [],
        duration: 0,
        playheadPosition: 0,
        zoomLevel: 100,
        scrollPosition: 0,
      };
    }
  });

  // Handler: timeline:set_scroll_position
  // Save horizontal scroll position
  ipcMain.handle('timeline:set_scroll_position', async (_event, { scrollX }: { scrollX: number }) => {
    console.log('[IPC] timeline:set_scroll_position called:', { scrollX });

    try {
      const session = getCurrentSession();

      if (!session) {
        return {
          success: false,
          error: 'Session not initialized',
        };
      }

      // Update scroll position
      session.scrollPosition = Math.max(0, scrollX);

      // Save session
      const saved = persistSession(session);

      if (!saved) {
        return {
          success: false,
          error: 'Failed to save session',
        };
      }

      console.log('[IPC] Scroll position updated:', scrollX);

      return {
        success: true,
      };

    } catch (error) {
      console.error('[IPC] timeline:set_scroll_position error:', error);
      return {
        success: false,
        error: `Failed to set scroll position: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  });

  // Handler: timeline:save_session
  // Save the entire session state (used when clips are added)
  ipcMain.handle('timeline:save_session', async (_event, updatedSession: Session) => {
    console.log('[IPC] timeline:save_session called');

    try {
      const saved = persistSession(updatedSession);

      if (!saved) {
        return {
          success: false,
          error: 'Failed to save session',
        };
      }

      console.log('[IPC] Session saved successfully');

      return {
        success: true,
      };

    } catch (error) {
      console.error('[IPC] timeline:save_session error:', error);
      return {
        success: false,
        error: `Failed to save session: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  });

  console.log('[IPC] Timeline handlers registered');
}
