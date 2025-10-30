/**
 * useSplit Hook (Story 13: Split & Advanced Trim)
 * Manages split operation state and logic
 */

import { useCallback } from 'react';
import { useSessionStore } from '../store/sessionStore';

interface UseSplitResult {
  // Check if split is possible at given playhead position
  canSplit: (clipInstanceId: string) => boolean;
  // Perform split at playhead position
  performSplit: (clipId: string, clipInstanceId: string, splitPoint: number) => Promise<boolean>;
}

export function useSplit(): UseSplitResult {
  const timeline = useSessionStore((state) => state.timeline);
  const playheadPosition = useSessionStore((state) => state.playheadPosition);
  const splitClipAtPlayhead = useSessionStore((state) => state.splitClipAtPlayhead);

  /**
   * Check if a clip can be split at the current playhead position
   * Split is possible if playhead is strictly within clip bounds (not at edges)
   */
  const canSplit = useCallback((clipInstanceId: string): boolean => {
    const timelineClip = timeline.clips.find(tc => tc.instanceId === clipInstanceId);

    if (!timelineClip) {
      console.log('[useSplit.canSplit] Clip not found:', clipInstanceId);
      return false;
    }

    // Check if playhead is strictly within the clip's timeline range
    // Exclude edges to avoid creating empty segments
    const clipEnd = timelineClip.startTime + (timelineClip.outPoint - timelineClip.inPoint);
    const isWithinClip = playheadPosition > timelineClip.startTime && playheadPosition < clipEnd;

    console.log('[useSplit.canSplit] Split validation:', {
      clipInstanceId: clipInstanceId.substring(0, 8),
      playheadPosition,
      timelineClip: {
        instanceId: timelineClip.instanceId.substring(0, 8),
        startTime: timelineClip.startTime,
        clipEnd,
        inPoint: timelineClip.inPoint,
        outPoint: timelineClip.outPoint,
        duration: timelineClip.outPoint - timelineClip.inPoint,
      },
      checks: {
        playheadPosition_greater_than_startTime: playheadPosition > timelineClip.startTime,
        playheadPosition_less_than_clipEnd: playheadPosition < clipEnd,
      },
      isWithinClip,
    });

    return isWithinClip;
  }, [timeline.clips, playheadPosition]);

  /**
   * Perform split operation at given split point
   */
  const performSplit = useCallback(async (
    clipId: string,
    clipInstanceId: string,
    splitPoint: number
  ): Promise<boolean> => {
    console.log('[useSplit] Performing split:', {
      clipId: clipId.substring(0, 8),
      clipInstanceId: clipInstanceId.substring(0, 8),
      splitPoint,
    });

    try {
      const success = await splitClipAtPlayhead(clipId, clipInstanceId, splitPoint);

      if (success) {
        console.log('[useSplit] Split operation successful');
      } else {
        console.error('[useSplit] Split operation failed');
      }

      return success;
    } catch (error) {
      console.error('[useSplit] Error during split:', error);
      return false;
    }
  }, [splitClipAtPlayhead]);

  return {
    canSplit,
    performSplit,
  };
}
