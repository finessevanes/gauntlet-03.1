/**
 * Snapping Hook
 * Provides snapping utilities with modifier key support
 */

import { useState, useEffect, useCallback } from 'react';
import type { Tick, SnapTarget } from '../types/timeline';
import { snapDrag, calculateSnapPoints, type SnapResult } from '../timeline/snap';
import { useTimelineStore } from '../store/timelineStore';

export function useSnapping(options: {
  threshold?: Tick;
  enabledTargets?: SnapTarget[];
} = {}) {
  const { threshold = 100, enabledTargets = ['playhead', 'clipEdges', 'markers', 'grid'] } = options;

  const doc = useTimelineStore((state) => state.doc);
  const [isSnappingDisabled, setIsSnappingDisabled] = useState(false);

  // Listen for Shift key to temporarily disable snapping
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Shift') {
        setIsSnappingDisabled(true);
      }
    }

    function handleKeyUp(event: KeyboardEvent) {
      if (event.key === 'Shift') {
        setIsSnappingDisabled(false);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  /**
   * Snap a time value to nearest snap point
   */
  const snap = useCallback(
    (time: Tick): SnapResult => {
      return snapDrag(doc, time, {
        threshold,
        disableSnapping: isSnappingDisabled,
        enabledTargets,
      });
    },
    [doc, threshold, isSnappingDisabled, enabledTargets]
  );

  /**
   * Get all current snap points
   */
  const snapPoints = useCallback(() => {
    return calculateSnapPoints(doc, enabledTargets);
  }, [doc, enabledTargets]);

  return {
    snap,
    snapPoints: snapPoints(),
    isSnappingDisabled,
    setIsSnappingDisabled,
  };
}
