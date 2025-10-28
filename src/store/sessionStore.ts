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
  updateTimeline: (timeline: Timeline) => set({ timeline }),

  // Set zoom level (100-1000%)
  setZoomLevel: (level: number) => set({ zoomLevel: Math.max(100, Math.min(1000, level)) }),

  // Set playhead position (in seconds)
  setPlayheadPosition: (position: number) => set({ playheadPosition: Math.max(0, position) }),

  // Set scroll position (in pixels)
  setScrollPosition: (position: number) => set({ scrollPosition: Math.max(0, position) }),

  // Set selected clip (only one clip can be selected across library and timeline)
  setSelectedClip: (clipId: string | null, source: 'library' | 'timeline' | null) => set({
    selectedClipId: clipId,
    selectedClipSource: source,
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
}));
