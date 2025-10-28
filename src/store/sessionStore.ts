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

  // Actions
  setSession: (session: Session) => void;
  addClip: (clip: Clip) => void;
  updateClips: (clips: Clip[]) => void;
  updateTimeline: (timeline: Timeline) => void;
  setZoomLevel: (level: number) => void;
  setPlayheadPosition: (position: number) => void;
  setScrollPosition: (position: number) => void;
  resetSession: () => void;
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
  addClip: (clip: Clip) => set((state) => ({
    clips: [...state.clips, clip],
  })),

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

  // Reset to empty state
  resetSession: () => set(defaultState),
}));
