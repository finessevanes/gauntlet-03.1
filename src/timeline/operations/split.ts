/**
 * Split Operation
 * Splits a clip into two clips at a specific time point
 */

import type { TimelineDoc, Clip, Tick } from '../../types/timeline';
import { normalizeTrack } from '../invariants';
import { v4 as uuidv4 } from 'uuid';

export interface SplitOptions {
  clipId: string;
  atTime: Tick; // Absolute timeline time (not relative to clip start)
}

/**
 * Split a clip at a specific time point
 *
 * Behavior:
 * - Creates two clips from one
 * - Preserves linked groups (both clips keep the same linkedGroupId)
 * - Total duration remains the same (segment1.duration + segment2.duration = original.duration)
 * - Works on any track (main or overlay)
 * - Maintains gapless invariant on main track
 */
export function splitClip(doc: TimelineDoc, options: SplitOptions): TimelineDoc {
  const { clipId, atTime } = options;

  // Clone document for immutability
  const newDoc = structuredClone(doc);

  // Find the clip across all tracks and lanes
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

  // Validate split point is within clip bounds
  if (atTime <= clip.start || atTime >= clip.start + clip.duration) {
    throw new Error(
      `Split point ${atTime} is outside clip bounds ` +
      `(${clip.start} - ${clip.start + clip.duration})`
    );
  }

  // Calculate relative split point within the clip
  const offsetFromClipStart = atTime - clip.start;

  // Create segment 1: from clip start to split point
  const segment1: Clip = {
    id: uuidv4(),
    sourceId: clip.sourceId,
    srcStart: clip.srcStart,
    duration: offsetFromClipStart,
    start: clip.start,
    linkedGroupId: clip.linkedGroupId, // Preserve linked group
    locked: clip.locked,
    attrs: clip.attrs ? { ...clip.attrs } : undefined,
  };

  // Create segment 2: from split point to clip end
  const segment2: Clip = {
    id: uuidv4(),
    sourceId: clip.sourceId,
    srcStart: clip.srcStart + offsetFromClipStart,
    duration: clip.duration - offsetFromClipStart,
    start: clip.start + offsetFromClipStart,
    linkedGroupId: clip.linkedGroupId, // Preserve linked group
    locked: clip.locked,
    attrs: clip.attrs ? { ...clip.attrs } : undefined,
  };

  // Replace original clip with two segments
  foundLane.clips.splice(foundIndex, 1, segment1, segment2);

  // Re-sort and normalize
  normalizeTrack(foundTrack);

  return newDoc;
}

/**
 * Split all clips in a linked group at the same time
 * (Used when splitting A/V linked clips together)
 */
export function splitLinkedGroup(
  doc: TimelineDoc,
  linkedGroupId: string,
  atTime: Tick
): TimelineDoc {
  let newDoc = doc;

  // Find all clips in the linked group
  const clipsInGroup: string[] = [];

  for (const track of doc.tracks) {
    for (const lane of track.lanes) {
      for (const clip of lane.clips) {
        if (clip.linkedGroupId === linkedGroupId) {
          clipsInGroup.push(clip.id);
        }
      }
    }
  }

  // Split each clip in the group
  for (const clipId of clipsInGroup) {
    newDoc = splitClip(newDoc, { clipId, atTime });
  }

  return newDoc;
}
