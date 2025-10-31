/**
 * Snapping Engine
 * Calculates snap points for timeline dragging operations
 */

import type { TimelineDoc, Tick, SnapTarget } from '../types/timeline';

export interface SnapPoint {
  time: Tick;
  type: 'playhead' | 'clipEdge' | 'marker' | 'grid' | 'beat';
  label?: string;
  trackId?: string;
  clipId?: string;
}

export interface SnapResult {
  snapped: boolean;
  snapTime: Tick;
  originalTime: Tick;
  snapPoint?: SnapPoint;
  distance: number;
}

const SNAP_THRESHOLD = 100; // ticks (100ms default)

/**
 * Calculate all snap points in the timeline
 */
export function calculateSnapPoints(
  doc: TimelineDoc,
  enabledTargets: SnapTarget[] = ['playhead', 'clipEdges', 'markers', 'grid']
): SnapPoint[] {
  const snapPoints: SnapPoint[] = [];

  // Playhead snap point
  if (enabledTargets.includes('playhead') && doc.selection) {
    snapPoints.push({
      time: doc.selection.playhead,
      type: 'playhead',
      label: 'Playhead',
    });
  }

  // Clip edge snap points
  if (enabledTargets.includes('clipEdges')) {
    for (const track of doc.tracks) {
      for (const lane of track.lanes) {
        for (const clip of lane.clips) {
          // Left edge (start)
          snapPoints.push({
            time: clip.start,
            type: 'clipEdge',
            label: `${clip.id} (start)`,
            trackId: track.id,
            clipId: clip.id,
          });

          // Right edge (end)
          snapPoints.push({
            time: clip.start + clip.duration,
            type: 'clipEdge',
            label: `${clip.id} (end)`,
            trackId: track.id,
            clipId: clip.id,
          });
        }
      }
    }
  }

  // Marker snap points
  if (enabledTargets.includes('markers')) {
    for (const marker of doc.markers) {
      snapPoints.push({
        time: marker.at,
        type: marker.kind === 'beat' ? 'beat' : 'marker',
        label: marker.label || marker.id,
      });
    }
  }

  // Grid snap points (every second)
  if (enabledTargets.includes('grid')) {
    const ticksPerSecond = doc.timebase.ticksPerSecond;
    const totalDuration = getTotalDuration(doc);
    const gridInterval = ticksPerSecond; // 1 second grid

    for (let time = 0; time <= totalDuration; time += gridInterval) {
      snapPoints.push({
        time,
        type: 'grid',
        label: `${time / ticksPerSecond}s`,
      });
    }
  }

  // Sort by time
  snapPoints.sort((a, b) => a.time - b.time);

  return snapPoints;
}

/**
 * Find nearest snap point to a given time
 */
export function findNearestSnap(
  time: Tick,
  snapPoints: SnapPoint[],
  threshold: Tick = SNAP_THRESHOLD,
  disableSnapping: boolean = false
): SnapResult {
  if (disableSnapping || snapPoints.length === 0) {
    return {
      snapped: false,
      snapTime: time,
      originalTime: time,
      distance: 0,
    };
  }

  let nearestPoint: SnapPoint | null = null;
  let minDistance = threshold;

  for (const point of snapPoints) {
    const distance = Math.abs(point.time - time);

    if (distance < minDistance) {
      minDistance = distance;
      nearestPoint = point;
    }
  }

  if (nearestPoint) {
    return {
      snapped: true,
      snapTime: nearestPoint.time,
      originalTime: time,
      snapPoint: nearestPoint,
      distance: minDistance,
    };
  }

  return {
    snapped: false,
    snapTime: time,
    originalTime: time,
    distance: 0,
  };
}

/**
 * Snap a drag operation
 * Returns snapped time and whether snapping occurred
 */
export function snapDrag(
  doc: TimelineDoc,
  dragTime: Tick,
  options: {
    threshold?: Tick;
    disableSnapping?: boolean;
    enabledTargets?: SnapTarget[];
  } = {}
): SnapResult {
  const {
    threshold = SNAP_THRESHOLD,
    disableSnapping = false,
    enabledTargets = ['playhead', 'clipEdges', 'markers', 'grid'],
  } = options;

  const snapPoints = calculateSnapPoints(doc, enabledTargets);
  return findNearestSnap(dragTime, snapPoints, threshold, disableSnapping);
}

/**
 * Get total duration of timeline
 */
function getTotalDuration(doc: TimelineDoc): Tick {
  let maxEnd = 0;

  for (const track of doc.tracks) {
    for (const lane of track.lanes) {
      for (const clip of lane.clips) {
        const end = clip.start + clip.duration;
        if (end > maxEnd) {
          maxEnd = end;
        }
      }
    }
  }

  return maxEnd;
}

/**
 * Check if two time ranges overlap
 */
export function checkCollision(
  start1: Tick,
  duration1: Tick,
  start2: Tick,
  duration2: Tick
): boolean {
  const end1 = start1 + duration1;
  const end2 = start2 + duration2;

  return !(end1 <= start2 || start1 >= end2);
}

/**
 * Find all clips that collide with a given time range
 */
export function findCollisions(
  doc: TimelineDoc,
  trackId: string,
  laneId: string,
  start: Tick,
  duration: Tick
): string[] {
  const track = doc.tracks.find((t) => t.id === trackId);
  if (!track) return [];

  const lane = track.lanes.find((l) => l.id === laneId);
  if (!lane) return [];

  const collidingClips: string[] = [];

  for (const clip of lane.clips) {
    if (checkCollision(start, duration, clip.start, clip.duration)) {
      collidingClips.push(clip.id);
    }
  }

  return collidingClips;
}
