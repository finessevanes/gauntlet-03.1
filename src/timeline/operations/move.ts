/**
 * Move Operation
 * Moves clips within or across tracks/lanes
 */

import type { TimelineDoc, Clip, Tick, EditMode } from '../../types/timeline';
import { normalizeTrack } from '../invariants';
import { deleteClip } from './delete';
import { insertClip } from './insert';

export interface MoveOptions {
  clipId: string;
  toTime?: Tick;        // New start time (for same-track moves or overlay tracks)
  toTrackId?: string;   // Move to different track
  toLaneId?: string;    // Move to specific lane (or auto-select)
  toIndex?: number;     // Move to specific index in lane
  mode?: EditMode;      // 'ripple' or 'overwrite'
}

/**
 * Move a clip to a new position
 *
 * Main track:
 * - Within main track: Remove, reinsert at new index, repack to maintain gapless
 * - To overlay track: Remove with ripple, insert to overlay at absolute time
 *
 * Overlay track:
 * - Within overlay: Update absolute start time
 * - To main track: Remove, insert to main with ripple
 * - To different overlay: Remove, insert to new overlay
 */
export function moveClip(doc: TimelineDoc, options: MoveOptions): TimelineDoc {
  const { clipId, toTime, toTrackId, toLaneId, toIndex, mode = 'ripple' } = options;

  // Find the clip's current location
  let currentTrack: any = null;
  let currentLane: any = null;
  let currentIndex = -1;
  let clip: Clip | null = null;

  for (const track of doc.tracks) {
    for (const lane of track.lanes) {
      const index = lane.clips.findIndex((c: any) => c.id === clipId);
      if (index !== -1) {
        currentTrack = track;
        currentLane = lane;
        currentIndex = index;
        clip = lane.clips[index];
        break;
      }
    }
    if (currentTrack) break;
  }

  if (!currentTrack || !currentLane || currentIndex === -1 || !clip) {
    throw new Error(`Clip ${clipId} not found in timeline`);
  }

  // Determine target track (same track if not specified)
  const targetTrackId = toTrackId || currentTrack.id;
  const isChangingTrack = targetTrackId !== currentTrack.id;

  // If moving within same track and lane
  if (!isChangingTrack && !toLaneId && currentTrack.role === 'main') {
    return moveWithinMainTrack(doc, currentTrack, currentLane, currentIndex, clip, toIndex, mode);
  }

  // Otherwise: remove from current location, insert to new location
  return moveAcrossTracksOrLanes(
    doc,
    clip,
    targetTrackId,
    toLaneId,
    toTime,
    toIndex,
    mode
  );
}

/**
 * Move within main track (reorder)
 * Remove, reinsert at new index, repack to maintain gapless
 */
function moveWithinMainTrack(
  doc: TimelineDoc,
  track: any,
  lane: any,
  currentIndex: number,
  clip: Clip,
  toIndex: number | undefined,
  mode: EditMode
): TimelineDoc {
  const newDoc = structuredClone(doc);
  const targetTrack = newDoc.tracks.find((t: any) => t.id === track.id);
  const targetLane = targetTrack.lanes[0];

  // If no target index specified, append to end
  const targetIndex = toIndex ?? targetLane.clips.length - 1;

  // Remove clip from current position
  const [removedClip] = targetLane.clips.splice(currentIndex, 1);

  // Insert at new position
  const adjustedIndex = targetIndex > currentIndex ? targetIndex : targetIndex;
  targetLane.clips.splice(adjustedIndex, 0, removedClip);

  // Repack to maintain gapless invariant (auto-compact)
  repackMainLane(targetLane);

  normalizeTrack(targetTrack);

  return newDoc;
}

/**
 * Move across tracks or lanes
 * Delete from current location, insert to new location
 */
function moveAcrossTracksOrLanes(
  doc: TimelineDoc,
  clip: Clip,
  targetTrackId: string,
  targetLaneId: string | undefined,
  toTime: Tick | undefined,
  toIndex: number | undefined,
  mode: EditMode
): TimelineDoc {
  // Step 1: Remove clip from current location
  let newDoc = deleteClip(doc, { clipId: clip.id, mode });

  // Step 2: Update clip's start time if specified
  if (toTime !== undefined) {
    clip.start = toTime;
  }

  // Step 3: Insert clip to new location
  newDoc = insertClip(newDoc, {
    trackId: targetTrackId,
    laneId: targetLaneId,
    clip: structuredClone(clip),
    atIndex: toIndex,
    mode,
  });

  return newDoc;
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

/**
 * Move multiple clips together (e.g., linked group)
 */
export function moveClips(
  doc: TimelineDoc,
  clipIds: string[],
  options: Omit<MoveOptions, 'clipId'>
): TimelineDoc {
  let newDoc = doc;

  for (const clipId of clipIds) {
    newDoc = moveClip(newDoc, { ...options, clipId });
  }

  return newDoc;
}
