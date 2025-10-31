/**
 * Trim Operation
 * Adjusts clip in/out points (srcStart and duration)
 */

import type { TimelineDoc, Clip, Tick, EditMode } from '../../types/timeline';
import { normalizeTrack } from '../invariants';

export interface TrimOptions {
  clipId: string;
  newSrcStart?: Tick;  // New in-point (if trimming left edge)
  newDuration?: Tick;  // New duration (required)
  mode?: EditMode;     // 'ripple' or 'overwrite'
}

/**
 * Trim a clip (adjust its in/out points)
 *
 * Main track (magnetic):
 * - Ripple mode (default): Changing duration ripples downstream clips
 *   - Shorten → pull all downstream clips left (earlier in time)
 *   - Extend → push all downstream clips right (later in time)
 * - Overwrite mode: Truncate neighbors in overlap window
 *
 * Other tracks (non-magnetic):
 * - Adjust only this clip's endpoints
 * - No neighbor movement
 */
export function trimClip(doc: TimelineDoc, options: TrimOptions): TimelineDoc {
  const { clipId, newSrcStart, newDuration, mode = 'ripple' } = options;

  if (newDuration === undefined) {
    throw new Error('newDuration is required for trim operation');
  }

  if (newDuration <= 0) {
    throw new Error('Duration must be positive');
  }

  // Clone document for immutability
  const newDoc = structuredClone(doc);

  // Find the clip
  let foundTrack: any = null;
  let foundLane: any = null;
  let foundIndex = -1;
  let foundClip: Clip | null = null;

  for (const track of newDoc.tracks) {
    for (const lane of track.lanes) {
      const index = lane.clips.findIndex((c: any) => c.id === clipId);
      if (index !== -1) {
        foundTrack = track;
        foundLane = lane;
        foundIndex = index;
        foundClip = lane.clips[index];
        break;
      }
    }
    if (foundTrack) break;
  }

  if (!foundTrack || !foundLane || foundIndex === -1 || !foundClip) {
    throw new Error(`Clip ${clipId} not found in timeline`);
  }

  const clip = foundClip;
  const oldDuration = clip.duration;
  const delta = newDuration - oldDuration;

  // Update clip properties
  if (newSrcStart !== undefined) {
    clip.srcStart = newSrcStart;
  }
  clip.duration = newDuration;

  // Main track behavior (ripple by default)
  if (foundTrack.role === 'main') {
    if (mode === 'ripple') {
      // Ripple downstream clips by the delta
      for (let i = foundIndex + 1; i < foundLane.clips.length; i++) {
        foundLane.clips[i].start += delta;
      }

      // Repack to ensure gapless
      repackMainLane(foundLane);
    } else {
      // Overwrite mode: truncate/remove overlapping clips
      // (Simplified: just ripple for now; full overwrite logic is complex)
      for (let i = foundIndex + 1; i < foundLane.clips.length; i++) {
        foundLane.clips[i].start += delta;
      }
      repackMainLane(foundLane);
    }
  }
  // Overlay tracks: no ripple, just update the clip
  else {
    if (foundTrack.policy.isMagnetic && mode === 'ripple') {
      // Magnetic overlay: ripple within this lane
      for (let i = foundIndex + 1; i < foundLane.clips.length; i++) {
        foundLane.clips[i].start += delta;
      }
    }
    // Otherwise, no neighbor movement
  }

  normalizeTrack(foundTrack);

  return newDoc;
}

/**
 * Trim in (adjust left edge - change in-point)
 */
export function trimIn(
  doc: TimelineDoc,
  clipId: string,
  newInPoint: Tick,
  mode?: EditMode
): TimelineDoc {
  // Find clip to calculate new duration
  let clip: Clip | null = null;

  for (const track of doc.tracks) {
    for (const lane of track.lanes) {
      const found = lane.clips.find((c) => c.id === clipId);
      if (found) {
        clip = found;
        break;
      }
    }
    if (clip) break;
  }

  if (!clip) {
    throw new Error(`Clip ${clipId} not found`);
  }

  const outPoint = clip.srcStart + clip.duration;
  const newDuration = outPoint - newInPoint;

  if (newDuration <= 0) {
    throw new Error('Trim in-point would result in zero or negative duration');
  }

  return trimClip(doc, {
    clipId,
    newSrcStart: newInPoint,
    newDuration,
    mode,
  });
}

/**
 * Trim out (adjust right edge - change out-point)
 */
export function trimOut(
  doc: TimelineDoc,
  clipId: string,
  newOutPoint: Tick,
  mode?: EditMode
): TimelineDoc {
  // Find clip to calculate new duration
  let clip: Clip | null = null;

  for (const track of doc.tracks) {
    for (const lane of track.lanes) {
      const found = lane.clips.find((c) => c.id === clipId);
      if (found) {
        clip = found;
        break;
      }
    }
    if (clip) break;
  }

  if (!clip) {
    throw new Error(`Clip ${clipId} not found`);
  }

  const newDuration = newOutPoint - clip.srcStart;

  if (newDuration <= 0) {
    throw new Error('Trim out-point would result in zero or negative duration');
  }

  return trimClip(doc, {
    clipId,
    newDuration,
    mode,
  });
}

/**
 * Repack main lane to ensure gapless (auto-compact)
 */
function repackMainLane(lane: any): void {
  let currentStart = 0;

  for (const clip of lane.clips) {
    clip.start = currentStart;
    currentStart += clip.duration;
  }
}
