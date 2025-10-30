/**
 * Teleprompter State Store (Zustand)
 * Manages the state for the teleprompter feature (Story S9)
 */

import { create } from 'zustand';
import { TeleprompterScript, TeleprompterState } from '../types/teleprompter';

interface TeleprompterStore extends TeleprompterState {
  // Actions
  setScript: (script: TeleprompterScript) => void;
  setIsGenerating: (generating: boolean) => void;
  setError: (error: string | null) => void;
  setScrollPosition: (position: number) => void;
  setIsAutoScrolling: (autoScrolling: boolean) => void;
  setIsPaused: (paused: boolean) => void;
  toggleAutoScroll: () => void;
  togglePause: () => void;
  resetScript: () => void;
  clearError: () => void;
}

const defaultState: TeleprompterState = {
  script: null,
  isGenerating: false,
  error: null,
  scrollPosition: 0,
  isAutoScrolling: false,
  isPaused: false,
};

export const useTeleprompterStore = create<TeleprompterStore>((set) => ({
  ...defaultState,

  setScript: (script: TeleprompterScript) =>
    set({
      script,
      error: null,
      scrollPosition: 0,
      isAutoScrolling: false,
      isPaused: false,
    }),

  setIsGenerating: (generating: boolean) =>
    set({ isGenerating: generating }),

  setError: (error: string | null) =>
    set({ error }),

  setScrollPosition: (position: number) =>
    set({ scrollPosition: Math.max(0, position) }),

  setIsAutoScrolling: (autoScrolling: boolean) =>
    set({ isAutoScrolling: autoScrolling }),

  setIsPaused: (paused: boolean) =>
    set({ isPaused: paused }),

  toggleAutoScroll: () =>
    set((state) => ({
      isAutoScrolling: !state.isAutoScrolling,
      isPaused: false, // Reset pause state when toggling auto-scroll
    })),

  togglePause: () =>
    set((state) => ({
      isPaused: !state.isPaused,
    })),

  resetScript: () =>
    set(defaultState),

  clearError: () =>
    set({ error: null }),
}));
