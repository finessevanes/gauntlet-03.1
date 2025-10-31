/**
 * Timeline Core Tests
 * Run these to verify migration, invariants, and operations work
 */

import { describe, it, expect } from 'vitest';
import type { TimelineDoc, Clip } from '../../types/timeline';
import { createEmptyTimeline, secondsToTicks } from '../../types/timeline';
import {
  assertMainLaneGapless,
  assertNoOverlapWithinLane,
  assertTimelineInvariants,
  normalizeTimeline,
} from '../invariants';
import { insertClip } from '../operations/insert';
import { migrateSessionToTimelineDoc, ensureLatestFormat } from '../migration';

describe('Timeline Schema', () => {
  it('creates empty timeline with main track', () => {
    const doc = createEmptyTimeline();

    expect(doc.tracks.length).toBe(1);
    expect(doc.tracks[0].role).toBe('main');
    expect(doc.tracks[0].lanes.length).toBe(1);
    expect(doc.tracks[0].lanes[0].clips.length).toBe(0);
    expect(doc.timebase.ticksPerSecond).toBe(1000);
  });

  it('converts seconds to ticks correctly', () => {
    expect(secondsToTicks(0, 1000)).toBe(0);
    expect(secondsToTicks(1, 1000)).toBe(1000);
    expect(secondsToTicks(1.5, 1000)).toBe(1500);
    expect(secondsToTicks(10.123, 1000)).toBe(10123);
  });
});

describe('Invariants', () => {
  it('validates gapless main track', () => {
    const doc = createEmptyTimeline();
    const mainTrack = doc.tracks[0];
    const mainLane = mainTrack.lanes[0];

    // Add 3 clips with no gaps
    mainLane.clips = [
      {
        id: 'c1',
        sourceId: 'src1',
        srcStart: 0,
        duration: 5000,
        start: 0,
      },
      {
        id: 'c2',
        sourceId: 'src2',
        srcStart: 0,
        duration: 3000,
        start: 5000,
      },
      {
        id: 'c3',
        sourceId: 'src3',
        srcStart: 0,
        duration: 2000,
        start: 8000,
      },
    ];

    expect(() => assertMainLaneGapless(doc)).not.toThrow();
  });

  it('detects gap in main track', () => {
    const doc = createEmptyTimeline();
    const mainTrack = doc.tracks[0];
    const mainLane = mainTrack.lanes[0];

    // Add clips with a gap
    mainLane.clips = [
      {
        id: 'c1',
        sourceId: 'src1',
        srcStart: 0,
        duration: 5000,
        start: 0,
      },
      {
        id: 'c2',
        sourceId: 'src2',
        srcStart: 0,
        duration: 3000,
        start: 6000, // GAP! should be 5000
      },
    ];

    expect(() => assertMainLaneGapless(doc)).toThrow(/gapless/);
  });

  it('detects overlap in main track', () => {
    const doc = createEmptyTimeline();
    const mainTrack = doc.tracks[0];
    const mainLane = mainTrack.lanes[0];

    // Add overlapping clips
    mainLane.clips = [
      {
        id: 'c1',
        sourceId: 'src1',
        srcStart: 0,
        duration: 5000,
        start: 0,
      },
      {
        id: 'c2',
        sourceId: 'src2',
        srcStart: 0,
        duration: 3000,
        start: 4000, // OVERLAP! should be 5000
      },
    ];

    expect(() => assertMainLaneGapless(doc)).toThrow(/gapless/);
  });

  it('normalizes unsorted clips', () => {
    const doc = createEmptyTimeline();
    const mainTrack = doc.tracks[0];
    const mainLane = mainTrack.lanes[0];

    // Add clips out of order
    mainLane.clips = [
      {
        id: 'c2',
        sourceId: 'src2',
        srcStart: 0,
        duration: 3000,
        start: 5000,
      },
      {
        id: 'c1',
        sourceId: 'src1',
        srcStart: 0,
        duration: 5000,
        start: 0,
      },
    ];

    normalizeTimeline(doc);

    expect(mainLane.clips[0].id).toBe('c1');
    expect(mainLane.clips[1].id).toBe('c2');
  });
});

describe('Migration', () => {
  it('migrates old session to new TimelineDoc', () => {
    const oldSession = {
      version: '1.0.0',
      clips: [],
      timeline: {
        clips: [
          {
            instanceId: 'inst1',
            clipId: 'clip1',
            inPoint: 0,
            outPoint: 5,
            startTime: 0,
          },
          {
            instanceId: 'inst2',
            clipId: 'clip2',
            inPoint: 1,
            outPoint: 4,
            startTime: 5,
          },
        ],
        duration: 8,
      },
      zoomLevel: 100,
      playheadPosition: 2.5,
      scrollPosition: 0,
      lastModified: Date.now(),
    };

    const doc = migrateSessionToTimelineDoc(oldSession);

    expect(doc.version).toBe(2);
    expect(doc.tracks.length).toBe(1);
    expect(doc.tracks[0].role).toBe('main');
    expect(doc.tracks[0].lanes[0].clips.length).toBe(2);

    // Check first clip
    const clip1 = doc.tracks[0].lanes[0].clips[0];
    expect(clip1.id).toBe('inst1');
    expect(clip1.sourceId).toBe('clip1');
    expect(clip1.srcStart).toBe(0);
    expect(clip1.duration).toBe(5000); // 5s in ticks
    expect(clip1.start).toBe(0);

    // Check second clip
    const clip2 = doc.tracks[0].lanes[0].clips[1];
    expect(clip2.start).toBe(5000);
    expect(clip2.duration).toBe(3000); // 3s in ticks
  });

  it('auto-detects and migrates old format', () => {
    const oldSession = {
      version: '1.0.0',
      clips: [],
      timeline: { clips: [], duration: 0 },
      zoomLevel: 100,
      playheadPosition: 0,
      scrollPosition: 0,
      lastModified: Date.now(),
    };

    const { doc, migrated } = ensureLatestFormat(oldSession);

    expect(migrated).toBe(true);
    expect(doc.version).toBe(2);
    expect(doc.tracks[0].role).toBe('main');
  });

  it('recognizes new format (no migration needed)', () => {
    const newDoc = createEmptyTimeline();
    const { doc, migrated } = ensureLatestFormat(newDoc);

    expect(migrated).toBe(false);
    expect(doc).toEqual(newDoc);
  });
});

describe('Insert Operation', () => {
  it('inserts clip to empty main track', () => {
    const doc = createEmptyTimeline();
    const mainTrack = doc.tracks[0];

    const clip: Clip = {
      id: 'c1',
      sourceId: 'src1',
      srcStart: 0,
      duration: 5000,
      start: 0,
    };

    const result = insertClip(doc, {
      trackId: mainTrack.id,
      clip,
      mode: 'ripple',
    });

    const resultLane = result.tracks[0].lanes[0];
    expect(resultLane.clips.length).toBe(1);
    expect(resultLane.clips[0].id).toBe('c1');
    expect(resultLane.clips[0].start).toBe(0);

    // Should pass invariant check
    expect(() => assertTimelineInvariants(result)).not.toThrow();
  });

  it('inserts clip and ripples downstream (main track)', () => {
    const doc = createEmptyTimeline();
    const mainTrack = doc.tracks[0];
    const mainLane = mainTrack.lanes[0];

    // Start with 2 clips
    mainLane.clips = [
      {
        id: 'c1',
        sourceId: 'src1',
        srcStart: 0,
        duration: 5000,
        start: 0,
      },
      {
        id: 'c2',
        sourceId: 'src2',
        srcStart: 0,
        duration: 3000,
        start: 5000,
      },
    ];

    // Insert new clip at index 1 (between c1 and c2)
    const newClip: Clip = {
      id: 'c-new',
      sourceId: 'src-new',
      srcStart: 0,
      duration: 2000,
      start: 0, // Will be calculated
    };

    const result = insertClip(doc, {
      trackId: mainTrack.id,
      clip: newClip,
      atIndex: 1,
      mode: 'ripple',
    });

    const resultLane = result.tracks[0].lanes[0];
    expect(resultLane.clips.length).toBe(3);

    // Check order
    expect(resultLane.clips[0].id).toBe('c1');
    expect(resultLane.clips[1].id).toBe('c-new');
    expect(resultLane.clips[2].id).toBe('c2');

    // Check positions (gapless)
    expect(resultLane.clips[0].start).toBe(0);
    expect(resultLane.clips[1].start).toBe(5000);
    expect(resultLane.clips[2].start).toBe(7000); // Rippled right by 2000

    // Should pass invariant check
    expect(() => assertTimelineInvariants(result)).not.toThrow();
  });

  it('appends clip to end of main track', () => {
    const doc = createEmptyTimeline();
    const mainTrack = doc.tracks[0];
    const mainLane = mainTrack.lanes[0];

    mainLane.clips = [
      {
        id: 'c1',
        sourceId: 'src1',
        srcStart: 0,
        duration: 5000,
        start: 0,
      },
    ];

    const newClip: Clip = {
      id: 'c2',
      sourceId: 'src2',
      srcStart: 0,
      duration: 3000,
      start: 0,
    };

    const result = insertClip(doc, {
      trackId: mainTrack.id,
      clip: newClip,
      mode: 'ripple',
    });

    const resultLane = result.tracks[0].lanes[0];
    expect(resultLane.clips.length).toBe(2);
    expect(resultLane.clips[1].start).toBe(5000);
    expect(resultLane.clips[1].duration).toBe(3000);

    // Should pass invariant check
    expect(() => assertTimelineInvariants(result)).not.toThrow();
  });
});
