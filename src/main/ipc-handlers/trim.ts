/**
 * Trim IPC Handlers
 * Handles trim_clip and reset_trim operations
 */

import { ipcMain } from 'electron';
import { loadSession, saveSession } from '../services/session-manager';
import { Session } from '../../types/session';

/**
 * Validate and apply trim points to a clip
 */
export function registerTrimHandlers() {
  // trim_clip: Validate and apply trim points (per-instance override)
  ipcMain.handle('trim_clip', async (event, { clipId, instanceId, inPoint, outPoint }: { clipId: string; instanceId: string; inPoint: number; outPoint: number }) => {
    console.log('[Trim IPC] trim_clip called:', { clipId: clipId.substring(0, 8), instanceId: instanceId.substring(0, 8), inPoint, outPoint });

    try {
      const session = loadSession();

      if (!session) {
        console.error('[Trim IPC] No session found');
        return {
          success: false,
          error: 'No session found',
        };
      }

      // Find clip in session
      const clip = session.clips.find(c => c.id === clipId);

      if (!clip) {
        console.error('[Trim IPC] Clip not found:', clipId);
        return {
          success: false,
          error: `Clip not found: ${clipId}`,
        };
      }

      // Find timeline clip to verify instanceId exists
      const timelineClip = session.timeline.clips.find(tc => tc.instanceId === instanceId);
      if (!timelineClip || timelineClip.clipId !== clipId) {
        console.error('[Trim IPC] Timeline clip not found or clipId mismatch:', { instanceId, clipId });
        return {
          success: false,
          error: `Timeline clip instance not found: ${instanceId}`,
        };
      }

      // Auto-correct: Clamp inPoint to valid range [0, clip.duration]
      let correctedInPoint = inPoint;
      let correctedOutPoint = outPoint;

      if (correctedInPoint < 0) {
        console.warn('[Trim IPC] Auto-correcting inPoint from', inPoint, 'to 0');
        correctedInPoint = 0;
      }

      // Auto-correct: Clamp outPoint to valid range [0, clip.duration]
      if (correctedOutPoint > clip.duration) {
        console.warn('[Trim IPC] Auto-correcting outPoint from', outPoint, 'to clip.duration', clip.duration);
        correctedOutPoint = clip.duration;
      }

      // Validation: inPoint must be < outPoint (minimum 1 frame = ~0.033s)
      const MIN_DURATION = 0.033; // ~1 frame at 30fps
      if (correctedInPoint >= correctedOutPoint || (correctedOutPoint - correctedInPoint) < MIN_DURATION) {
        console.error('[Trim IPC] Invalid range (inPoint >= outPoint or duration too small):', {
          inPoint: correctedInPoint,
          outPoint: correctedOutPoint,
          diff: correctedOutPoint - correctedInPoint
        });
        return {
          success: false,
          error: `inPoint must be < outPoint with minimum duration of ${MIN_DURATION}s`,
        };
      }

      // Initialize trimOverrides array if it doesn't exist
      if (!session.timeline.trimOverrides) {
        session.timeline.trimOverrides = [];
      }

      // Find or create override for this instance
      let override = session.timeline.trimOverrides.find(o => o.instanceId === instanceId);
      if (!override) {
        override = { instanceId, inPoint: correctedInPoint, outPoint: correctedOutPoint };
        session.timeline.trimOverrides.push(override);
      } else {
        override.inPoint = correctedInPoint;
        override.outPoint = correctedOutPoint;
      }

      console.log('[Trim IPC] Clip instance trimmed successfully:', {
        clipId: clipId.substring(0, 8),
        instanceId: instanceId.substring(0, 8),
        filename: clip.filename,
        inPoint: correctedInPoint,
        outPoint: correctedOutPoint,
        trimmedDuration: correctedOutPoint - correctedInPoint,
      });

      // Save session state
      const saved = saveSession(session);
      if (!saved) {
        console.error('[Trim IPC] Failed to save session');
        return {
          success: false,
          error: 'Failed to save session',
        };
      }

      return {
        success: true,
        clip,
        override,
      };
    } catch (error) {
      console.error('[Trim IPC] Error trimming clip:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // reset_trim: Reset instance trim to full duration
  ipcMain.handle('reset_trim', async (event, { clipId, instanceId }: { clipId: string; instanceId: string }) => {
    console.log('[Trim IPC] reset_trim called:', { clipId: clipId.substring(0, 8), instanceId: instanceId.substring(0, 8) });

    try {
      const session = loadSession();

      if (!session) {
        console.error('[Trim IPC] No session found');
        return {
          success: false,
          error: 'No session found',
        };
      }

      // Find clip in session
      const clip = session.clips.find(c => c.id === clipId);

      if (!clip) {
        console.error('[Trim IPC] Clip not found:', clipId);
        return {
          success: false,
          error: `Clip not found: ${clipId}`,
        };
      }

      // Find timeline clip to verify instanceId exists
      const timelineClip = session.timeline.clips.find(tc => tc.instanceId === instanceId);
      if (!timelineClip || timelineClip.clipId !== clipId) {
        console.error('[Trim IPC] Timeline clip not found or clipId mismatch:', { instanceId, clipId });
        return {
          success: false,
          error: `Timeline clip instance not found: ${instanceId}`,
        };
      }

      // Initialize trimOverrides array if it doesn't exist
      if (!session.timeline.trimOverrides) {
        session.timeline.trimOverrides = [];
      }

      // Remove override for this instance (will revert to clip defaults)
      session.timeline.trimOverrides = session.timeline.trimOverrides.filter(o => o.instanceId !== instanceId);

      console.log('[Trim IPC] Clip instance trim reset:', {
        clipId: clipId.substring(0, 8),
        instanceId: instanceId.substring(0, 8),
        filename: clip.filename,
        duration: clip.duration,
      });

      // Save session state
      const saved = saveSession(session);
      if (!saved) {
        console.error('[Trim IPC] Failed to save session');
        return {
          success: false,
          error: 'Failed to save session',
        };
      }

      return {
        success: true,
        clip,
      };
    } catch (error) {
      console.error('[Trim IPC] Error resetting trim:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  console.log('[Trim IPC] Handlers registered: trim_clip, reset_trim');
}
