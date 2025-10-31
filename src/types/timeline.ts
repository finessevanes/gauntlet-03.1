/**
 * Multitrack Timeline Type Definitions
 * Based on CapCut-style timeline specification
 */

// Integer timebase (1 tick = 1/1000s) to avoid float drift
export type Tick = number;

// Track roles define behavior
export type TrackRole = 'main' | 'overlay' | 'audio';
export type TrackType = 'video' | 'audio';

// Edit modes
export type EditMode = 'ripple' | 'overwrite';
export type AutoPackMode = 'none' | 'firstFit' | 'bestFit';
export type LinkedGroupPolicy = 'lock' | 'follow' | 'free';
export type SilenceFillMode = 'shift' | 'insert-silence';

/**
 * Track Policy Configuration
 * Defines behavior for a track
 */
export interface TrackPolicy {
  isMagnetic: boolean;                    // true = gapless lane; false = gaps allowed
  defaultMode: EditMode;                  // ripple or overwrite
  allowSameLaneOverlap: boolean;          // usually false
  autoPack: AutoPackMode;                 // lane selection for multi-lane tracks
  snapTargets: SnapTarget[];              // what to snap to during drag
  linkedGroupPolicy?: LinkedGroupPolicy;  // how linked A/V behave
  silenceFill?: SilenceFillMode;          // audio-only: maintain continuity
}

export type SnapTarget = 'playhead' | 'clipEdges' | 'markers' | 'grid' | 'beats';

/**
 * Clip on the timeline
 * Represents a single placed clip instance
 */
export interface Clip {
  id: string;                   // unique clip instance ID
  sourceId: string;             // reference to media library item
  srcStart: Tick;               // in-point in source file (in ticks)
  duration: Tick;               // visible duration on timeline (in ticks)
  start: Tick;                  // absolute start position on timeline (in ticks)
  linkedGroupId?: string;       // for linked A/V groups
  locked?: boolean;             // prevent editing
  attrs?: {
    transitionIn?: TransitionMetadata;
    transitionOut?: TransitionMetadata;
    effects?: EffectMetadata[];
  };
}

/**
 * Transition metadata (stored as clip attributes, not true overlaps)
 */
export interface TransitionMetadata {
  type: 'crossfade' | 'dissolve' | 'wipe' | 'fade';
  duration: Tick;
  easing?: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
}

/**
 * Effect metadata placeholder
 */
export interface EffectMetadata {
  id: string;
  type: string;
  params: Record<string, any>;
}

/**
 * Lane contains clips (sorted by start time)
 */
export interface Lane {
  id: string;
  clips: Clip[];  // kept sorted by start time
}

/**
 * Track contains lanes
 * Main track: exactly 1 lane (gapless, magnetic)
 * Other tracks: 1+ lanes (gap-friendly, non-magnetic by default)
 */
export interface Track {
  id: string;
  type: TrackType;
  role: TrackRole;
  lanes: Lane[];
  policy: TrackPolicy;
  locked?: boolean;
  name?: string;        // user-visible name
  color?: string;       // UI color code
}

/**
 * Timeline markers (beats, user markers)
 */
export interface Marker {
  id: string;
  at: Tick;
  kind: 'beat' | 'user';
  label?: string;
}

/**
 * Selection state
 */
export interface Selection {
  clipIds: string[];
  playhead: Tick;
}

/**
 * Main Timeline Document (Single Source of Truth)
 */
export interface TimelineDoc {
  timebase: {
    ticksPerSecond: number;  // e.g., 1000 (1 tick = 1ms)
  };
  tracks: Track[];           // main track first by convention
  markers: Marker[];
  selection?: Selection;
  version: number;           // for migration compatibility
}

/**
 * Preset track policies
 */
export const TRACK_POLICY_PRESETS: Record<TrackRole, TrackPolicy> = {
  main: {
    isMagnetic: true,
    defaultMode: 'ripple',
    allowSameLaneOverlap: false,
    autoPack: 'none',
    snapTargets: ['playhead', 'clipEdges', 'markers', 'grid', 'beats'],
    linkedGroupPolicy: 'follow',
  },
  overlay: {
    isMagnetic: false,
    defaultMode: 'ripple',
    allowSameLaneOverlap: false,
    autoPack: 'firstFit',
    snapTargets: ['playhead', 'clipEdges', 'markers', 'grid'],
  },
  audio: {
    isMagnetic: false,
    defaultMode: 'ripple',
    allowSameLaneOverlap: true,  // audio can overlap for mixing
    autoPack: 'firstFit',
    snapTargets: ['playhead', 'clipEdges', 'markers', 'beats'],
    silenceFill: 'shift',
  },
};

/**
 * Helper to convert seconds to ticks
 */
export function secondsToTicks(seconds: number, ticksPerSecond: number): Tick {
  return Math.round(seconds * ticksPerSecond);
}

/**
 * Helper to convert ticks to seconds
 */
export function ticksToSeconds(ticks: Tick, ticksPerSecond: number): number {
  return ticks / ticksPerSecond;
}

/**
 * Create an empty timeline
 */
export function createEmptyTimeline(): TimelineDoc {
  return {
    timebase: { ticksPerSecond: 1000 },
    tracks: [
      {
        id: 'main-video',
        type: 'video',
        role: 'main',
        lanes: [{ id: 'main-video-lane-0', clips: [] }],
        policy: TRACK_POLICY_PRESETS.main,
        name: 'Main Video',
        color: '#3B82F6', // blue
      },
    ],
    markers: [],
    selection: { clipIds: [], playhead: 0 },
    version: 1,
  };
}
