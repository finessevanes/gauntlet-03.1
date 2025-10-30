/**
 * Session State Store (Zustand)
 * Manages global application state for clips, timeline, and playback
 */

import { create } from 'zustand';
import { Session, Clip, Timeline } from '../types/session';

interface SessionState {
  // Session data
  clips: Clip[];
  timeline: Timeline;
  zoomLevel: number;
  playheadPosition: number;
  scrollPosition: number;

  // UI state - selected clip (only one can be selected across library and timeline)
  selectedClipId: string | null;
  selectedClipSource: 'library' | 'timeline' | null;

  // Preview playback state (not persisted to disk)
  isPlaying: boolean;
  previewSource: 'timeline' | 'library';
  previewClipId: string | null;

  // S13: Snap-to-Grid state (Story 13: Split & Advanced Trim)
  snapEnabled: boolean;
  snapMode: 'frame' | '500ms' | '1s';

  // Actions
  setSession: (session: Session) => void;
  addClip: (clip: Clip) => void;
  removeClip: (clipId: string) => void;
  updateClips: (clips: Clip[]) => void;
  updateTimeline: (timeline: Timeline) => void;
  setZoomLevel: (level: number) => void;
  setPlayheadPosition: (position: number) => void;
  setScrollPosition: (position: number) => void;
  setSelectedClip: (clipId: string | null, source: 'library' | 'timeline' | null) => void;
  setIsPlaying: (playing: boolean) => void;
  setPreviewSource: (source: 'timeline' | 'library', options?: { clipId?: string | null; resetPlayhead?: boolean }) => void;
  // S13: Split and snap controls
  splitClipAtPlayhead: (clipId: string, instanceId: string, splitPoint: number) => Promise<boolean>;
  setSnapEnabled: (enabled: boolean) => void;
  setSnapMode: (mode: 'frame' | '500ms' | '1s') => void;
  resetSession: () => void;
  clearLibrary: () => void;
}

// Default empty state
const defaultState = {
  clips: [],
  timeline: {
    clips: [],
    duration: 0,
  },
  zoomLevel: 100, // Auto-fit will be calculated in Timeline component
  playheadPosition: 0,
  scrollPosition: 0,
  selectedClipId: null,
  selectedClipSource: null,
  isPlaying: false,
  previewSource: 'timeline' as const,
  previewClipId: null,
  // S13: Snap-to-Grid defaults
  snapEnabled: true,
  snapMode: 'frame' as const,
};

export const useSessionStore = create<SessionState>((set) => ({
  ...defaultState,

  // Set entire session (used during app init)
  setSession: (session: Session) => set({
    clips: session.clips,
    timeline: session.timeline,
    zoomLevel: session.zoomLevel,
    playheadPosition: session.playheadPosition,
    scrollPosition: session.scrollPosition,
  }),

  // Add a single clip to the library
  addClip: (clip: Clip) => set((state) => {
    const newState = {
      clips: [...state.clips, clip],
    };

    // Persist to backend
    const session = {
      version: '1.0.0',
      clips: newState.clips,
      timeline: state.timeline,
      zoomLevel: state.zoomLevel,
      playheadPosition: state.playheadPosition,
      scrollPosition: state.scrollPosition,
      lastModified: Date.now(),
    };

    window.electron.timeline.saveSession(session).catch((err) => {
      console.error('[Store] Failed to save session after adding clip:', err);
    });

    return newState;
  }),

  // Remove a single clip from the library
  removeClip: (clipId: string) => set((state) => {
    const newState = {
      clips: state.clips.filter((c) => c.id !== clipId),
    };

    // Persist to backend
    const session = {
      version: '1.0.0',
      clips: newState.clips,
      timeline: state.timeline,
      zoomLevel: state.zoomLevel,
      playheadPosition: state.playheadPosition,
      scrollPosition: state.scrollPosition,
      lastModified: Date.now(),
    };

    window.electron.timeline.saveSession(session).catch((err) => {
      console.error('[Store] Failed to save session after removing clip:', err);
    });

    return newState;
  }),

  // Update clips array
  updateClips: (clips: Clip[]) => set({ clips }),

  // Update timeline
  updateTimeline: (timeline: Timeline) => set((state) => {
    const newState = { timeline };

    // Persist to backend (ensures disk stays in sync with Zustand state)
    const session = {
      version: '1.0.0',
      clips: state.clips,
      timeline: timeline,
      zoomLevel: state.zoomLevel,
      playheadPosition: state.playheadPosition,
      scrollPosition: state.scrollPosition,
      lastModified: Date.now(),
    };

    window.electron.timeline.saveSession(session).catch((err) => {
      console.error('[Store] Failed to save session after updating timeline:', err);
    });

    return newState;
  }),

  // Set zoom level (100-1000%)
  setZoomLevel: (level: number) => set((state) => {
    const newZoom = Math.max(100, Math.min(1000, level));

    // Persist to backend
    const session = {
      version: '1.0.0',
      clips: state.clips,
      timeline: state.timeline,
      zoomLevel: newZoom,
      playheadPosition: state.playheadPosition,
      scrollPosition: state.scrollPosition,
      lastModified: Date.now(),
    };

    window.electron.timeline.saveSession(session).catch((err) => {
      console.error('[Store] Failed to save session after zoom change:', err);
    });

    return { zoomLevel: newZoom };
  }),

  // Set playhead position (in seconds)
  setPlayheadPosition: (position: number) => set((state) => {
    const newPosition = Math.max(0, position);

    // Persist to backend
    const session = {
      version: '1.0.0',
      clips: state.clips,
      timeline: state.timeline,
      zoomLevel: state.zoomLevel,
      playheadPosition: newPosition,
      scrollPosition: state.scrollPosition,
      lastModified: Date.now(),
    };

    window.electron.timeline.saveSession(session).catch((err) => {
      console.error('[Store] Failed to save session after playhead change:', err);
    });

    return { playheadPosition: newPosition };
  }),

  // Set scroll position (in pixels)
  setScrollPosition: (position: number) => set((state) => {
    const newPosition = Math.max(0, position);

    // Persist to backend
    const session = {
      version: '1.0.0',
      clips: state.clips,
      timeline: state.timeline,
      zoomLevel: state.zoomLevel,
      playheadPosition: state.playheadPosition,
      scrollPosition: newPosition,
      lastModified: Date.now(),
    };

    window.electron.timeline.saveSession(session).catch((err) => {
      console.error('[Store] Failed to save session after scroll change:', err);
    });

    return { scrollPosition: newPosition };
  }),

  // Set selected clip (only one clip can be selected across library and timeline)
  setSelectedClip: (clipId: string | null, source: 'library' | 'timeline' | null) => set({
    selectedClipId: clipId,
    selectedClipSource: source,
  }),

  // Control playback state (play/pause)
  setIsPlaying: (playing: boolean) => set({ isPlaying: playing }),

  // Switch between timeline and library preview sources
  setPreviewSource: (source: 'timeline' | 'library', options) => set(() => {
    const nextState: Partial<SessionState> = {
      previewSource: source,
      previewClipId: options?.clipId ?? null,
    };

    if (source === 'library') {
      nextState.isPlaying = false;
    }

    if (options?.resetPlayhead) {
      nextState.playheadPosition = 0;
    }

    return nextState;
  }),

  // Reset to empty state
  resetSession: () => set(defaultState),

  // Clear all clips from the library
  clearLibrary: () => set((state) => {
    const newState: { clips: Clip[] } = {
      clips: [],
    };

    // Persist to backend
    const session = {
      version: '1.0.0',
      clips: newState.clips,
      timeline: state.timeline,
      zoomLevel: state.zoomLevel,
      playheadPosition: state.playheadPosition,
      scrollPosition: state.scrollPosition,
      lastModified: Date.now(),
    };

    window.electron.timeline.saveSession(session).catch((err) => {
      console.error('[Store] Failed to save session after clearing library:', err);
    });

    return newState;
  }),

  // S13: Split clip at playhead position - creates two timeline clips from one
  splitClipAtPlayhead: async (clipId: string, instanceId: string, splitPoint: number) => {
    return new Promise((resolve) => {
      set((state) => {
        try {
          // Find the timeline clip to split
          const timelineClipIndex = state.timeline.clips.findIndex(tc => tc.instanceId === instanceId);
          if (timelineClipIndex === -1) {
            console.error('[Store] Timeline clip not found for split:', instanceId);
            resolve(false);
            return state;
          }

          const timelineClip = state.timeline.clips[timelineClipIndex];
          const clip = state.clips.find(c => c.id === clipId);

          if (!clip) {
            console.error('[Store] Clip not found for split:', clipId);
            resolve(false);
            return state;
          }

          // Convert absolute timeline position to source clip position
          // Timeline position -> offset from clip start -> add trim start offset
          const timelineOffsetFromClipStart = splitPoint - timelineClip.startTime;
          const relativePosition = timelineClip.inPoint + timelineOffsetFromClipStart;

          // Validate split point is within the clip's trimmed range
          if (relativePosition <= timelineClip.inPoint || relativePosition >= timelineClip.outPoint) {
            console.error('[Store] Split point outside clip bounds:', {
              absoluteSplitPoint: splitPoint,
              timelineOffsetFromClipStart: timelineOffsetFromClipStart,
              relativeSplitPointInSourceClip: relativePosition,
              inPoint: timelineClip.inPoint,
              outPoint: timelineClip.outPoint,
              clipStartTime: timelineClip.startTime
            });
            resolve(false);
            return state;
          }

          // Create segment 1: from inPoint to relativePosition
          const segment1: any = {
            instanceId: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15), // UUID
            clipId: clipId,
            inPoint: timelineClip.inPoint,
            outPoint: relativePosition,
            startTime: timelineClip.startTime,
          };

          // Create segment 2: from relativePosition to outPoint
          const duration1 = relativePosition - timelineClip.inPoint;
          const segment2: any = {
            instanceId: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15), // UUID
            clipId: clipId,
            inPoint: relativePosition,
            outPoint: timelineClip.outPoint,
            startTime: timelineClip.startTime + duration1,
          };

          // Replace the original clip with the two segments
          const newTimelineClips = [
            ...state.timeline.clips.slice(0, timelineClipIndex),
            segment1,
            segment2,
            ...state.timeline.clips.slice(timelineClipIndex + 1),
          ];

          // Recalculate timeline duration
          const newDuration = newTimelineClips.reduce((total, tc) => {
            return total + (tc.outPoint - tc.inPoint);
          }, 0);

          console.log('[Store] Split successful:', {
            clipId: clipId.substring(0, 8),
            instanceId: instanceId.substring(0, 8),
            absoluteSplitPoint: splitPoint,
            relativeSplitPoint: relativePosition,
            segment1Duration: duration1,
            segment2Duration: timelineClip.outPoint - relativePosition,
          });

          // Prepare updated state with split clips
          const updatedState = {
            timeline: {
              clips: newTimelineClips,
              duration: newDuration,
            },
          };

          // Persist updated state to disk so IPC handlers can access it
          const session = {
            version: '1.0.0',
            clips: state.clips,
            timeline: updatedState.timeline,
            zoomLevel: state.zoomLevel,
            playheadPosition: state.playheadPosition,
            scrollPosition: state.scrollPosition,
            lastModified: Date.now(),
          };
          window.electron.timeline.saveSession(session).catch((err: Error) => {
            console.error('[Store] Failed to persist split to disk:', err);
          });

          resolve(true);

          return updatedState;
        } catch (error) {
          console.error('[Store] Error splitting clip:', error);
          resolve(false);
          return state;
        }
      });
    });
  },

  // S13: Toggle snap-to-grid on/off
  setSnapEnabled: (enabled: boolean) => set({ snapEnabled: enabled }),

  // S13: Set snap mode (frame-precise, 500ms, or 1s)
  setSnapMode: (mode: 'frame' | '500ms' | '1s') => set({ snapMode: mode }),
}));
