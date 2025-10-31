/**
 * Delete Operation
 * Removes clips from tracks with ripple or non-ripple behavior
 */

import type { TimelineDoc, EditMode } from '../../types/timeline';
import { normalizeTrack } from '../invariants';

export interface DeleteOptions {
  clipId: string;
  mode?: 'ripple' | 'normal'; // ripple = shift left, normal = just remove
}

/**
 * Delete a clip from the timeline
 *
 * Main track (magnetic):
 * - Ripple mode (default): Remove clip and shift all downstream clips left (earlier in time)
 * - Normal mode: Not allowed on main track (would create gap)
 *
 * Other tracks (non-magnetic):
 * - Ripple mode: Remove clip, shift downstream if magnetic policy enabled
 * - Normal mode: Remove clip, leave gap
 */
export function deleteClip(doc: TimelineDoc, options: DeleteOptions): TimelineDoc {
  const { clipId, mode = 'ripple' } = options;

  // Clone document for immutability
  const newDoc = structuredClone(doc);

  // Find the clip across all tracks and lanes
  let foundTrack: any = null;
  let foundLane: any = null;
  let foundIndex = -1;

  for (const track of newDoc.tracks) {
    for (const lane of track.lanes) {
      const index = lane.clips.findIndex((c: any) => c.id === clipId);
      if (index !== -1) {
        foundTrack = track;
        foundLane = lane;
        foundIndex = index;
        break;
      }
    }
    if (foundTrack) break;
  }

  if (!foundTrack || !foundLane || foundIndex === -1) {
    throw new Error(`Clip ${clipId} not found in timeline`);
  }

  const clip = foundLane.clips[foundIndex];

  // Main track behavior
  if (foundTrack.role === 'main') {
    if (mode === 'normal') {
      throw new Error('Cannot delete from main track without ripple (would create gap)');
    }

    return rippleDeleteFromMainTrack(newDoc, foundTrack, foundLane, foundIndex, clip);
  }

  // Other tracks behavior
  if (mode === 'ripple' && foundTrack.policy.isMagnetic) {
    return rippleDeleteFromTrack(newDoc, foundTrack, foundLane, foundIndex, clip);
  } else {
    return normalDeleteFromTrack(newDoc, foundTrack, foundLane, foundIndex);
  }
}

/**
 * Ripple delete from main track
 * Remove clip and shift all downstream clips left (earlier in time)
 */
function rippleDeleteFromMainTrack(
  doc: TimelineDoc,
  track: any,
  lane: any,
  index: number,
  clip: any
): TimelineDoc {
  const duration = clip.duration;

  // Remove the clip
  lane.clips.splice(index, 1);

  // Shift all downstream clips left (earlier in time)
  for (let i = index; i < lane.clips.length; i++) {
    lane.clips[i].start -= duration;
  }

  // Ensure first clip starts at 0 if clips remain
  if (lane.clips.length > 0) {
    lane.clips[0].start = 0;
  }

  // Re-normalize to ensure gapless
  repackMainLane(lane);

  normalizeTrack(track);

  return doc;
}

/**
 * Ripple delete from magnetic overlay track
 */
function rippleDeleteFromTrack(
  doc: TimelineDoc,
  track: any,
  lane: any,
  index: number,
  clip: any
): TimelineDoc {
  const duration = clip.duration;

  // Remove the clip
  lane.clips.splice(index, 1);

  // Shift downstream clips in this lane only
  for (let i = index; i < lane.clips.length; i++) {
    lane.clips[i].start -= duration;
  }

  normalizeTrack(track);

  return doc;
}

/**
 * Normal delete (no ripple) - just remove clip, leave gap
 */
function normalDeleteFromTrack(
  doc: TimelineDoc,
  track: any,
  lane: any,
  index: number
): TimelineDoc {
  // Simply remove the clip (gap remains)
  lane.clips.splice(index, 1);

  normalizeTrack(track);

  return doc;
}

/**
 * Repack main lane to ensure gapless (auto-compact)
 * Recalculates all start times from 0
 */
function repackMainLane(lane: any): void {
  let currentStart = 0;

  for (const clip of lane.clips) {
    clip.start = currentStart;
    currentStart += clip.duration;
  }
}
