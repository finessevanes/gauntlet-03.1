/**
 * Migration utilities to convert old session format to new TimelineDoc format
 */

import type { Session, TimelineClip as OldTimelineClip } from '../types/session';
import type {
  TimelineDoc,
  Clip,
  Track,
  Lane,
  Tick,
} from '../types/timeline';
import { TRACK_POLICY_PRESETS, secondsToTicks } from '../types/timeline';
import { v4 as uuidv4 } from 'uuid';

/**
 * Convert old session (v1) to new TimelineDoc (v2)
 */
export function migrateSessionToTimelineDoc(session: Session): TimelineDoc {
  const ticksPerSecond = 1000; // 1 tick = 1ms

  // Convert old timeline clips to new format
  const clips: Clip[] = session.timeline.clips.map((oldClip) => {
    const duration = oldClip.outPoint - oldClip.inPoint;

    return {
      id: oldClip.instanceId,
      sourceId: oldClip.clipId,
      srcStart: secondsToTicks(oldClip.inPoint, ticksPerSecond),
      duration: secondsToTicks(duration, ticksPerSecond),
      start: secondsToTicks(oldClip.startTime, ticksPerSecond),
    };
  });

  // Create main track with a single lane
  const mainLane: Lane = {
    id: `main-video-lane-0`,
    clips: clips.sort((a, b) => a.start - b.start),
  };

  const mainTrack: Track = {
    id: 'main-video',
    type: 'video',
    role: 'main',
    lanes: [mainLane],
    policy: TRACK_POLICY_PRESETS.main,
    name: 'Main Video',
    color: '#3B82F6', // blue
  };

  // Create the new timeline document
  const doc: TimelineDoc = {
    timebase: { ticksPerSecond },
    tracks: [mainTrack],
    markers: [],
    selection: {
      clipIds: [],
      playhead: secondsToTicks(session.playheadPosition || 0, ticksPerSecond),
    },
    version: 2, // new version
  };

  return doc;
}

/**
 * Convert new TimelineDoc back to old Session format (for backward compatibility)
 * Note: This loses multi-track information; only main track is preserved
 */
export function migrateTimelineDocToSession(
  doc: TimelineDoc,
  oldSession: Session
): Session {
  const ticksPerSecond = doc.timebase.ticksPerSecond;

  // Find main track
  const mainTrack = doc.tracks.find((t) => t.role === 'main');
  if (!mainTrack || mainTrack.lanes.length === 0) {
    throw new Error('Cannot migrate: no main track found');
  }

  const mainLane = mainTrack.lanes[0];

  // Convert clips back to old format
  const timelineClips: OldTimelineClip[] = mainLane.clips.map((clip) => {
    const inPoint = clip.srcStart / ticksPerSecond;
    const outPoint = (clip.srcStart + clip.duration) / ticksPerSecond;
    const startTime = clip.start / ticksPerSecond;

    return {
      instanceId: clip.id,
      clipId: clip.sourceId,
      inPoint,
      outPoint,
      startTime,
    };
  });

  // Calculate total duration
  const duration = timelineClips.reduce((sum, clip) => {
    return sum + (clip.outPoint - clip.inPoint);
  }, 0);

  return {
    ...oldSession,
    version: '2.0.0', // indicate it was migrated
    timeline: {
      clips: timelineClips,
      duration,
    },
    playheadPosition: doc.selection?.playhead
      ? doc.selection.playhead / ticksPerSecond
      : 0,
    lastModified: Date.now(),
  };
}

/**
 * Detect session version and migrate if needed
 */
export function ensureLatestFormat(data: any): {
  doc: TimelineDoc;
  migrated: boolean;
} {
  // New format has timebase and tracks
  if (data.timebase && data.tracks) {
    return { doc: data as TimelineDoc, migrated: false };
  }

  // Old format has clips and timeline
  if (data.clips && data.timeline) {
    const doc = migrateSessionToTimelineDoc(data as Session);
    return { doc, migrated: true };
  }

  throw new Error('Unknown session format');
}

/**
 * Validate and repair timeline after migration
 * Ensures all invariants are met
 */
export function repairTimeline(doc: TimelineDoc): TimelineDoc {
  const mainTrack = doc.tracks.find((t) => t.role === 'main');
  if (!mainTrack || mainTrack.lanes.length === 0) {
    return doc;
  }

  const mainLane = mainTrack.lanes[0];

  // Sort clips by start time
  mainLane.clips.sort((a, b) => a.start - b.start);

  // Repack to ensure gapless
  let currentStart = 0;
  mainLane.clips.forEach((clip) => {
    clip.start = currentStart;
    currentStart += clip.duration;
  });

  return doc;
}
