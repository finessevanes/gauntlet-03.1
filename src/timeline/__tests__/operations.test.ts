/**
 * Timeline Operations Tests
 * Comprehensive tests for all edit operations
 */

import { describe, it, expect } from 'vitest';
import { createEmptyTimeline, secondsToTicks } from '../../types/timeline';
import type { Clip } from '../../types/timeline';
import { insertClip } from '../operations/insert';
import { deleteClip } from '../operations/delete';
import { splitClip } from '../operations/split';
import { trimClip, trimIn, trimOut } from '../operations/trim';
import { moveClip } from '../operations/move';
import { assertTimelineInvariants, validateTimeline } from '../invariants';

describe('Delete Operation', () => {
  it('deletes clip and ripples left (auto-compact)', () => {
    const doc = createEmptyTimeline();

    // Insert 3 clips
    let result = insertClip(doc, {
      trackId: 'main-video',
      clip: {
        id: 'c1',
        sourceId: 'src1',
        srcStart: 0,
        duration: 5000,
        start: 0,
      },
    });

    result = insertClip(result, {
      trackId: 'main-video',
      clip: {
        id: 'c2',
        sourceId: 'src2',
        srcStart: 0,
        duration: 3000,
        start: 0,
      },
    });

    result = insertClip(result, {
      trackId: 'main-video',
      clip: {
        id: 'c3',
        sourceId: 'src3',
        srcStart: 0,
        duration: 2000,
        start: 0,
      },
    });

    // Delete middle clip (c2)
    result = deleteClip(result, { clipId: 'c2', mode: 'ripple' });

    const lane = result.tracks[0].lanes[0];

    expect(lane.clips.length).toBe(2);
    expect(lane.clips[0].id).toBe('c1');
    expect(lane.clips[1].id).toBe('c3');

    // c3 should be shifted left (rippled)
    expect(lane.clips[0].start).toBe(0);
    expect(lane.clips[1].start).toBe(5000); // Was at 8000, shifted left by 3000

    // Should pass invariants
    expect(() => assertTimelineInvariants(result)).not.toThrow();
  });

  it('deletes first clip and shifts remaining left', () => {
    const doc = createEmptyTimeline();

    let result = insertClip(doc, {
      trackId: 'main-video',
      clip: { id: 'c1', sourceId: 'src1', srcStart: 0, duration: 5000, start: 0 },
    });

    result = insertClip(result, {
      trackId: 'main-video',
      clip: { id: 'c2', sourceId: 'src2', srcStart: 0, duration: 3000, start: 0 },
    });

    result = deleteClip(result, { clipId: 'c1', mode: 'ripple' });

    const lane = result.tracks[0].lanes[0];
    expect(lane.clips.length).toBe(1);
    expect(lane.clips[0].id).toBe('c2');
    expect(lane.clips[0].start).toBe(0); // Shifted to start

    expect(() => assertTimelineInvariants(result)).not.toThrow();
  });
});

describe('Split Operation', () => {
  it('splits clip into two segments', () => {
    const doc = createEmptyTimeline();

    let result = insertClip(doc, {
      trackId: 'main-video',
      clip: {
        id: 'c1',
        sourceId: 'src1',
        srcStart: 0,
        duration: 10000, // 10 seconds
        start: 0,
      },
    });

    // Split at 4 seconds
    result = splitClip(result, {
      clipId: 'c1',
      atTime: 4000,
    });

    const lane = result.tracks[0].lanes[0];

    expect(lane.clips.length).toBe(2);

    // Segment 1: 0-4s
    expect(lane.clips[0].start).toBe(0);
    expect(lane.clips[0].duration).toBe(4000);
    expect(lane.clips[0].srcStart).toBe(0);

    // Segment 2: 4-10s
    expect(lane.clips[1].start).toBe(4000);
    expect(lane.clips[1].duration).toBe(6000);
    expect(lane.clips[1].srcStart).toBe(4000);

    // Both should reference same source
    expect(lane.clips[0].sourceId).toBe('src1');
    expect(lane.clips[1].sourceId).toBe('src1');

    expect(() => assertTimelineInvariants(result)).not.toThrow();
  });

  it('preserves linked groups on split', () => {
    const doc = createEmptyTimeline();

    let result = insertClip(doc, {
      trackId: 'main-video',
      clip: {
        id: 'c1',
        sourceId: 'src1',
        srcStart: 0,
        duration: 10000,
        start: 0,
        linkedGroupId: 'group-1',
      },
    });

    result = splitClip(result, { clipId: 'c1', atTime: 5000 });

    const lane = result.tracks[0].lanes[0];

    // Both segments should keep the linkedGroupId
    expect(lane.clips[0].linkedGroupId).toBe('group-1');
    expect(lane.clips[1].linkedGroupId).toBe('group-1');
  });
});

describe('Trim Operation', () => {
  it('trims clip and ripples downstream', () => {
    const doc = createEmptyTimeline();

    let result = insertClip(doc, {
      trackId: 'main-video',
      clip: { id: 'c1', sourceId: 'src1', srcStart: 0, duration: 10000, start: 0 },
    });

    result = insertClip(result, {
      trackId: 'main-video',
      clip: { id: 'c2', sourceId: 'src2', srcStart: 0, duration: 5000, start: 0 },
    });

    // Trim c1 from 10s to 6s (shorten by 4s)
    result = trimClip(result, {
      clipId: 'c1',
      newDuration: 6000,
      mode: 'ripple',
    });

    const lane = result.tracks[0].lanes[0];

    expect(lane.clips[0].duration).toBe(6000);
    expect(lane.clips[1].start).toBe(6000); // Rippled left from 10000

    expect(() => assertTimelineInvariants(result)).not.toThrow();
  });

  it('trimIn adjusts in-point correctly', () => {
    const doc = createEmptyTimeline();

    let result = insertClip(doc, {
      trackId: 'main-video',
      clip: { id: 'c1', sourceId: 'src1', srcStart: 0, duration: 10000, start: 0 },
    });

    // Trim in from 0s to 2s (shorten by 2s from left)
    result = trimIn(result, 'c1', 2000, 'ripple');

    const clip = result.tracks[0].lanes[0].clips[0];

    expect(clip.srcStart).toBe(2000);
    expect(clip.duration).toBe(8000); // 10000 - 2000

    expect(() => assertTimelineInvariants(result)).not.toThrow();
  });

  it('trimOut adjusts out-point correctly', () => {
    const doc = createEmptyTimeline();

    let result = insertClip(doc, {
      trackId: 'main-video',
      clip: { id: 'c1', sourceId: 'src1', srcStart: 0, duration: 10000, start: 0 },
    });

    // Trim out from 10s to 7s (shorten by 3s from right)
    result = trimOut(result, 'c1', 7000, 'ripple');

    const clip = result.tracks[0].lanes[0].clips[0];

    expect(clip.duration).toBe(7000);
    expect(clip.srcStart).toBe(0); // Unchanged

    expect(() => assertTimelineInvariants(result)).not.toThrow();
  });
});

describe('Move Operation', () => {
  it('moves clip within main track (reorder)', () => {
    const doc = createEmptyTimeline();

    let result = insertClip(doc, {
      trackId: 'main-video',
      clip: { id: 'c1', sourceId: 'src1', srcStart: 0, duration: 5000, start: 0 },
    });

    result = insertClip(result, {
      trackId: 'main-video',
      clip: { id: 'c2', sourceId: 'src2', srcStart: 0, duration: 3000, start: 0 },
    });

    result = insertClip(result, {
      trackId: 'main-video',
      clip: { id: 'c3', sourceId: 'src3', srcStart: 0, duration: 2000, start: 0 },
    });

    // Move c1 to end (index 2)
    result = moveClip(result, {
      clipId: 'c1',
      toIndex: 2,
      mode: 'ripple',
    });

    const lane = result.tracks[0].lanes[0];

    // Order should now be: c2, c3, c1
    expect(lane.clips[0].id).toBe('c2');
    expect(lane.clips[1].id).toBe('c3');
    expect(lane.clips[2].id).toBe('c1');

    // Should be gapless (auto-compacted)
    expect(lane.clips[0].start).toBe(0);
    expect(lane.clips[1].start).toBe(3000);
    expect(lane.clips[2].start).toBe(5000);

    expect(() => assertTimelineInvariants(result)).not.toThrow();
  });
});

describe('Complex Scenarios', () => {
  it('handles insert → split → delete sequence', () => {
    const doc = createEmptyTimeline();

    // Insert
    let result = insertClip(doc, {
      trackId: 'main-video',
      clip: { id: 'c1', sourceId: 'src1', srcStart: 0, duration: 10000, start: 0 },
    });

    // Split
    result = splitClip(result, { clipId: 'c1', atTime: 5000 });

    // Delete first segment
    const firstSegmentId = result.tracks[0].lanes[0].clips[0].id;
    result = deleteClip(result, { clipId: firstSegmentId, mode: 'ripple' });

    const lane = result.tracks[0].lanes[0];

    expect(lane.clips.length).toBe(1);
    expect(lane.clips[0].start).toBe(0); // Auto-compacted to start
    expect(lane.clips[0].duration).toBe(5000);

    expect(() => assertTimelineInvariants(result)).not.toThrow();
  });

  it('maintains gapless after multiple operations', () => {
    const doc = createEmptyTimeline();

    let result = doc;

    // Add 5 clips
    for (let i = 0; i < 5; i++) {
      result = insertClip(result, {
        trackId: 'main-video',
        clip: {
          id: `c${i}`,
          sourceId: `src${i}`,
          srcStart: 0,
          duration: (i + 1) * 1000,
          start: 0,
        },
      });
    }

    // Delete clip in middle
    result = deleteClip(result, { clipId: 'c2', mode: 'ripple' });

    // Trim a clip
    result = trimClip(result, { clipId: 'c3', newDuration: 2000, mode: 'ripple' });

    // Split a clip
    const c4 = result.tracks[0].lanes[0].clips.find((c) => c.id === 'c4');
    if (c4) {
      const midPoint = c4.start + c4.duration / 2;
      result = splitClip(result, { clipId: 'c4', atTime: midPoint });
    }

    // Should still be gapless
    const validation = validateTimeline(result);
    expect(validation.valid).toBe(true);
  });
});
