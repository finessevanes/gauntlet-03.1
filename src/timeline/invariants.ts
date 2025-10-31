/**
 * Timeline Invariant Assertions
 *
 * These functions validate the core rules of the timeline:
 * 1. Main track gapless: no gaps, no overlaps
 * 2. No same-lane overlap (unless explicitly allowed)
 * 3. Linked groups aligned
 * 4. Source bounds respected
 * 5. Clips sorted by start time
 */

import type { TimelineDoc, Track, Lane, Clip } from '../types/timeline';

/**
 * Assert main track lane is gapless (no gaps, no overlaps)
 * For all adjacent clips i, j: i.start + i.duration === j.start
 */
export function assertMainLaneGapless(doc: TimelineDoc): void {
  const mainTrack = doc.tracks.find((t) => t.role === 'main');

  if (!mainTrack) {
    throw new Error('Timeline must have a main track');
  }

  if (mainTrack.lanes.length !== 1) {
    throw new Error('Main track must have exactly one lane');
  }

  const lane = mainTrack.lanes[0];

  for (let i = 0; i < lane.clips.length - 1; i++) {
    const current = lane.clips[i];
    const next = lane.clips[i + 1];

    const currentEnd = current.start + current.duration;

    if (currentEnd !== next.start) {
      throw new Error(
        `Main lane must be gapless. Found gap/overlap between clip ${current.id} ` +
        `(ends at ${currentEnd}) and clip ${next.id} (starts at ${next.start})`
      );
    }
  }

  // First clip must start at 0
  if (lane.clips.length > 0 && lane.clips[0].start !== 0) {
    throw new Error(`Main lane first clip must start at 0, found ${lane.clips[0].start}`);
  }
}

/**
 * Assert no overlaps within a single lane
 * For all adjacent clips i, j: i.start + i.duration <= j.start
 */
export function assertNoOverlapWithinLane(lane: Lane, allowOverlap = false): void {
  for (let i = 0; i < lane.clips.length - 1; i++) {
    const current = lane.clips[i];
    const next = lane.clips[i + 1];

    const currentEnd = current.start + current.duration;

    if (!allowOverlap && currentEnd > next.start) {
      throw new Error(
        `Lane ${lane.id} has overlapping clips: ${current.id} ` +
        `(ends at ${currentEnd}) overlaps ${next.id} (starts at ${next.start})`
      );
    }
  }
}

/**
 * Assert clips are sorted by start time within a lane
 */
export function assertLaneSorted(lane: Lane): void {
  for (let i = 0; i < lane.clips.length - 1; i++) {
    const current = lane.clips[i];
    const next = lane.clips[i + 1];

    if (current.start > next.start) {
      throw new Error(
        `Lane ${lane.id} clips not sorted: clip ${current.id} ` +
        `(start: ${current.start}) comes before ${next.id} (start: ${next.start})`
      );
    }
  }
}

/**
 * Normalize a track (sort clips by start time in all lanes)
 */
export function normalizeTrack(track: Track): void {
  track.lanes.forEach((lane) => {
    lane.clips.sort((a, b) => a.start - b.start);
  });
}

/**
 * Normalize entire timeline (sort all lanes in all tracks)
 */
export function normalizeTimeline(doc: TimelineDoc): void {
  doc.tracks.forEach(normalizeTrack);
}

/**
 * Assert all track invariants based on track policies
 */
export function assertTrackInvariants(track: Track): void {
  track.lanes.forEach((lane) => {
    // Ensure sorted
    assertLaneSorted(lane);

    // Check overlaps based on policy
    if (!track.policy.allowSameLaneOverlap) {
      assertNoOverlapWithinLane(lane, false);
    }
  });

  // Magnetic tracks must be gapless
  if (track.policy.isMagnetic && track.lanes.length === 1) {
    const lane = track.lanes[0];

    // Check gapless
    for (let i = 0; i < lane.clips.length - 1; i++) {
      const current = lane.clips[i];
      const next = lane.clips[i + 1];

      if (current.start + current.duration !== next.start) {
        throw new Error(
          `Magnetic track ${track.id} must be gapless. ` +
          `Gap/overlap between ${current.id} and ${next.id}`
        );
      }
    }

    // First clip starts at 0
    if (lane.clips.length > 0 && lane.clips[0].start !== 0) {
      throw new Error(
        `Magnetic track ${track.id} first clip must start at 0, found ${lane.clips[0].start}`
      );
    }
  }
}

/**
 * Assert all timeline invariants
 */
export function assertTimelineInvariants(doc: TimelineDoc): void {
  // Main track must exist and be gapless
  assertMainLaneGapless(doc);

  // Check all tracks
  doc.tracks.forEach(assertTrackInvariants);
}

/**
 * Validate linked groups are aligned
 * (All clips with same linkedGroupId should move/trim together)
 */
export function assertLinkedGroupsAligned(doc: TimelineDoc): void {
  const groups = new Map<string, Clip[]>();

  // Collect all linked groups
  doc.tracks.forEach((track) => {
    track.lanes.forEach((lane) => {
      lane.clips.forEach((clip) => {
        if (clip.linkedGroupId) {
          if (!groups.has(clip.linkedGroupId)) {
            groups.set(clip.linkedGroupId, []);
          }
          groups.get(clip.linkedGroupId)!.push(clip);
        }
      });
    });
  });

  // Validate each group (all clips should have same start and duration)
  groups.forEach((clips, groupId) => {
    if (clips.length < 2) return; // single clip groups are fine

    const first = clips[0];
    const aligned = clips.every(
      (c) => c.start === first.start && c.duration === first.duration
    );

    if (!aligned) {
      throw new Error(
        `Linked group ${groupId} clips not aligned. ` +
        `All clips must have same start and duration.`
      );
    }
  });
}

/**
 * Validate source bounds (srcStart + duration <= media length)
 * Note: This requires access to media metadata, so it's a soft check
 */
export function validateSourceBounds(
  clip: Clip,
  mediaLength: number
): boolean {
  const sourceEnd = clip.srcStart + clip.duration;
  return sourceEnd <= mediaLength;
}

/**
 * Safe assertion wrapper (returns error instead of throwing)
 */
export function validateTimeline(doc: TimelineDoc): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  try {
    assertTimelineInvariants(doc);
  } catch (error) {
    if (error instanceof Error) {
      errors.push(error.message);
    }
  }

  try {
    assertLinkedGroupsAligned(doc);
  } catch (error) {
    if (error instanceof Error) {
      errors.push(error.message);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
