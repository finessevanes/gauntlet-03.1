/**
 * Insert Operation
 * Adds a clip to a track/lane with ripple or overwrite mode
 */

import type { TimelineDoc, Clip, EditMode, Tick } from '../../types/timeline';
import { normalizeTrack } from '../invariants';

export interface InsertOptions {
  trackId: string;
  laneId?: string;       // If not provided, use first lane or create new one
  clip: Clip;
  atIndex?: number;      // Insert at specific index (or auto-calculate from clip.start)
  mode?: EditMode;       // 'ripple' (default) or 'overwrite'
}

/**
 * Insert a clip into a track/lane
 *
 * Main track (magnetic):
 * - Ripple mode: Insert at boundary, shift downstream clips right (later in time)
 * - Overwrite mode: Replace/truncate colliding clips
 *
 * Other tracks (non-magnetic):
 * - Place at absolute time (clip.start)
 * - Choose first non-colliding lane (or create new lane if needed)
 * - Respect autoPack policy
 */
export function insertClip(doc: TimelineDoc, options: InsertOptions): TimelineDoc {
  const { trackId, clip, mode = 'ripple' } = options;

  // Clone document for immutability
  const newDoc = structuredClone(doc);

  // Find target track
  const track = newDoc.tracks.find((t) => t.id === trackId);
  if (!track) {
    throw new Error(`Track ${trackId} not found`);
  }

  // Determine target lane
  let lane = options.laneId
    ? track.lanes.find((l) => l.id === options.laneId)
    : track.lanes[0];

  if (!lane) {
    // Create new lane if needed
    const newLaneId = `${trackId}-lane-${track.lanes.length}`;
    lane = { id: newLaneId, clips: [] };
    track.lanes.push(lane);
  }

  // Main track (magnetic) behavior
  if (track.role === 'main') {
    return insertToMainTrack(newDoc, track, lane, clip, options.atIndex, mode);
  }

  // Other tracks (non-magnetic) behavior
  return insertToOverlayTrack(newDoc, track, lane, clip, mode);
}

/**
 * Insert to main track (gapless, ripple by default)
 */
function insertToMainTrack(
  doc: TimelineDoc,
  track: any,
  lane: any,
  clip: Clip,
  atIndex: number | undefined,
  mode: EditMode
): TimelineDoc {
  // Determine insert index
  let insertIndex = atIndex ?? lane.clips.length;

  // Calculate start position (must maintain gapless invariant)
  if (insertIndex === 0) {
    clip.start = 0;
  } else if (insertIndex >= lane.clips.length) {
    // Append at end
    const lastClip = lane.clips[lane.clips.length - 1];
    clip.start = lastClip ? lastClip.start + lastClip.duration : 0;
    insertIndex = lane.clips.length;
  } else {
    // Insert between clips
    const prevClip = lane.clips[insertIndex - 1];
    clip.start = prevClip.start + prevClip.duration;
  }

  if (mode === 'ripple') {
    // Ripple: shift all downstream clips right (later in time)
    const delta = clip.duration;

    for (let i = insertIndex; i < lane.clips.length; i++) {
      lane.clips[i].start += delta;
    }

    // Insert clip
    lane.clips.splice(insertIndex, 0, clip);
  } else {
    // Overwrite: truncate/remove overlapping clips
    const clipEnd = clip.start + clip.duration;

    // Remove or truncate clips in the overlap window
    lane.clips = lane.clips.filter((c) => {
      const cEnd = c.start + c.duration;

      // Fully before insert window - keep
      if (cEnd <= clip.start) return true;

      // Fully after insert window - shift left
      if (c.start >= clipEnd) {
        c.start -= clip.duration;
        return true;
      }

      // Overlaps - remove (simplification; could truncate instead)
      return false;
    });

    // Insert clip
    lane.clips.push(clip);
  }

  // Re-sort and normalize
  normalizeTrack(track);

  return doc;
}

/**
 * Insert to overlay/audio track (gap-friendly, lane-packing)
 */
function insertToOverlayTrack(
  doc: TimelineDoc,
  track: any,
  lane: any,
  clip: Clip,
  mode: EditMode
): TimelineDoc {
  const { autoPack, allowSameLaneOverlap } = track.policy;

  // Check for collision in target lane
  const hasCollision = lane.clips.some((c) => {
    const cEnd = c.start + c.duration;
    const clipEnd = clip.start + clip.duration;
    return !(cEnd <= clip.start || c.start >= clipEnd);
  });

  if (hasCollision && !allowSameLaneOverlap) {
    // Try to find or create a non-colliding lane
    if (autoPack === 'firstFit' || autoPack === 'bestFit') {
      const freeLane = findFreeLane(track, clip);

      if (freeLane) {
        lane = freeLane;
      } else {
        // Create new lane
        const newLaneId = `${track.id}-lane-${track.lanes.length}`;
        lane = { id: newLaneId, clips: [] };
        track.lanes.push(lane);
      }
    } else {
      throw new Error(
        `Clip ${clip.id} collides with existing clips in lane ${lane.id} ` +
        `and autoPack is disabled`
      );
    }
  }

  // Insert clip at absolute time
  lane.clips.push(clip);

  // Sort by start time
  normalizeTrack(track);

  return doc;
}

/**
 * Find first lane without collision (firstFit)
 */
function findFreeLane(track: any, clip: Clip): any | null {
  const clipEnd = clip.start + clip.duration;

  for (const lane of track.lanes) {
    const hasCollision = lane.clips.some((c) => {
      const cEnd = c.start + c.duration;
      return !(cEnd <= clip.start || c.start >= clipEnd);
    });

    if (!hasCollision) {
      return lane;
    }
  }

  return null;
}
