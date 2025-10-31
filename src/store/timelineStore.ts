/**
 * Timeline State Store (Zustand) - V2
 * Manages multitrack timeline with command pattern for undo/redo
 */

import { create } from 'zustand';
import type { TimelineDoc, Clip as NewClip } from '../types/timeline';
import type { Clip as LibraryClip } from '../types/session';
import { createEmptyTimeline } from '../types/timeline';
import { ensureLatestFormat, migrateTimelineDocToSession } from '../timeline/migration';
import { assertTimelineInvariants } from '../timeline/invariants';

/**
 * Command interface for undo/redo
 */
export interface Command {
  do(doc: TimelineDoc): TimelineDoc;
  undo(doc: TimelineDoc): TimelineDoc;
  description?: string;
}

/**
 * Timeline state
 */
interface TimelineState {
  // Core timeline document (SSOT)
  doc: TimelineDoc;

  // Library clips (not part of timeline, but needed for references)
  libraryClips: LibraryClip[];

  // Command history for undo/redo
  undoStack: Command[];
  redoStack: Command[];

  // UI state (not persisted)
  zoomLevel: number;
  scrollPosition: number;
  isPlaying: boolean;
  previewSource: 'timeline' | 'library';
  previewClipId: string | null;

  // Selection (persisted in doc.selection, mirrored here for convenience)
  selectedClipIds: string[];

  // Actions
  setTimeline: (doc: TimelineDoc) => void;
  setLibraryClips: (clips: LibraryClip[]) => void;
  addLibraryClip: (clip: LibraryClip) => void;
  removeLibraryClip: (clipId: string) => void;

  // Command pattern actions
  executeCommand: (cmd: Command) => void;
  undo: () => void;
  redo: () => void;
  clearHistory: () => void;

  // Direct mutations (use sparingly; prefer commands)
  updateDoc: (updater: (doc: TimelineDoc) => TimelineDoc) => void;

  // Playhead/zoom/scroll
  setPlayheadPosition: (ticks: number) => void;
  setZoomLevel: (level: number) => void;
  setScrollPosition: (position: number) => void;

  // Selection
  setSelectedClips: (clipIds: string[]) => void;

  // Playback
  setIsPlaying: (playing: boolean) => void;
  setPreviewSource: (source: 'timeline' | 'library', clipId?: string | null) => void;

  // Persistence
  saveToBackend: () => Promise<void>;
  loadFromBackend: () => Promise<void>;

  // Reset
  resetTimeline: () => void;
}

/**
 * Create the timeline store
 */
export const useTimelineStore = create<TimelineState>((set, get) => ({
  // Initial state
  doc: createEmptyTimeline(),
  libraryClips: [],
  undoStack: [],
  redoStack: [],
  zoomLevel: 100,
  scrollPosition: 0,
  isPlaying: false,
  previewSource: 'timeline',
  previewClipId: null,
  selectedClipIds: [],

  // Set entire timeline document
  setTimeline: (doc: TimelineDoc) => {
    try {
      assertTimelineInvariants(doc);
      set({
        doc,
        selectedClipIds: doc.selection?.clipIds || [],
        undoStack: [],
        redoStack: [],
      });
    } catch (error) {
      console.error('[TimelineStore] Invalid timeline document:', error);
    }
  },

  // Set library clips
  setLibraryClips: (clips: LibraryClip[]) => set({ libraryClips: clips }),

  // Add library clip
  addLibraryClip: (clip: LibraryClip) => {
    set((state) => ({
      libraryClips: [...state.libraryClips, clip],
    }));
    get().saveToBackend();
  },

  // Remove library clip
  removeLibraryClip: (clipId: string) => {
    set((state) => ({
      libraryClips: state.libraryClips.filter((c) => c.id !== clipId),
    }));
    get().saveToBackend();
  },

  // Execute a command (adds to undo stack)
  executeCommand: (cmd: Command) => {
    const { doc, undoStack } = get();

    try {
      const newDoc = cmd.do(doc);
      assertTimelineInvariants(newDoc);

      set({
        doc: newDoc,
        undoStack: [...undoStack, cmd],
        redoStack: [], // Clear redo stack on new action
        selectedClipIds: newDoc.selection?.clipIds || [],
      });

      get().saveToBackend();
    } catch (error) {
      console.error('[TimelineStore] Command execution failed:', error);
    }
  },

  // Undo last command
  undo: () => {
    const { doc, undoStack, redoStack } = get();

    if (undoStack.length === 0) {
      console.warn('[TimelineStore] Nothing to undo');
      return;
    }

    const cmd = undoStack[undoStack.length - 1];

    try {
      const newDoc = cmd.undo(doc);
      assertTimelineInvariants(newDoc);

      set({
        doc: newDoc,
        undoStack: undoStack.slice(0, -1),
        redoStack: [...redoStack, cmd],
        selectedClipIds: newDoc.selection?.clipIds || [],
      });

      get().saveToBackend();
    } catch (error) {
      console.error('[TimelineStore] Undo failed:', error);
    }
  },

  // Redo last undone command
  redo: () => {
    const { doc, undoStack, redoStack } = get();

    if (redoStack.length === 0) {
      console.warn('[TimelineStore] Nothing to redo');
      return;
    }

    const cmd = redoStack[redoStack.length - 1];

    try {
      const newDoc = cmd.do(doc);
      assertTimelineInvariants(newDoc);

      set({
        doc: newDoc,
        undoStack: [...undoStack, cmd],
        redoStack: redoStack.slice(0, -1),
        selectedClipIds: newDoc.selection?.clipIds || [],
      });

      get().saveToBackend();
    } catch (error) {
      console.error('[TimelineStore] Redo failed:', error);
    }
  },

  // Clear command history
  clearHistory: () => set({ undoStack: [], redoStack: [] }),

  // Direct doc mutation (use for non-undoable changes)
  updateDoc: (updater: (doc: TimelineDoc) => TimelineDoc) => {
    try {
      const newDoc = updater(get().doc);
      assertTimelineInvariants(newDoc);

      set({
        doc: newDoc,
        selectedClipIds: newDoc.selection?.clipIds || [],
      });

      get().saveToBackend();
    } catch (error) {
      console.error('[TimelineStore] Doc update failed:', error);
    }
  },

  // Set playhead position (in ticks)
  setPlayheadPosition: (ticks: number) => {
    const { doc } = get();
    const clampedTicks = Math.max(0, ticks);

    console.log('🎯 [TimelineStore.setPlayheadPosition]', {
      from: doc.selection?.playhead ?? 0,
      to: clampedTicks,
      delta: clampedTicks - (doc.selection?.playhead ?? 0),
      stack: new Error().stack?.split('\n').slice(2, 5).join('\n')
    });

    set({
      doc: {
        ...doc,
        selection: {
          ...doc.selection,
          clipIds: doc.selection?.clipIds || [],
          playhead: clampedTicks,
        },
      },
    });

    get().saveToBackend();
  },

  // Set zoom level (10-1000%)
  setZoomLevel: (level: number) => {
    const clampedLevel = Math.max(10, Math.min(1000, level));
    set({ zoomLevel: clampedLevel });
    get().saveToBackend();
  },

  // Set scroll position (in pixels)
  setScrollPosition: (position: number) => {
    const clampedPosition = Math.max(0, position);
    set({ scrollPosition: clampedPosition });
    get().saveToBackend();
  },

  // Set selected clips
  setSelectedClips: (clipIds: string[]) => {
    const { doc } = get();

    set({
      selectedClipIds: clipIds,
      doc: {
        ...doc,
        selection: {
          playhead: doc.selection?.playhead || 0,
          clipIds,
        },
      },
    });
  },

  // Control playback
  setIsPlaying: (playing: boolean) => {
    const currentState = get().isPlaying;
    console.log('▶️  [TimelineStore.setIsPlaying]', {
      from: currentState,
      to: playing,
      playhead: get().doc.selection?.playhead ?? 0,
      stack: new Error().stack?.split('\n').slice(2, 4).join('\n')
    });
    set({ isPlaying: playing });
  },

  // Set preview source
  setPreviewSource: (source: 'timeline' | 'library', clipId?: string | null) => {
    set({
      previewSource: source,
      previewClipId: clipId ?? null,
      isPlaying: source === 'library' ? false : get().isPlaying,
    });
  },

  // Save to backend (converts to old Session format for persistence)
  saveToBackend: async () => {
    const { doc, libraryClips, zoomLevel, scrollPosition } = get();

    try {
      // Build old Session format for backward compatibility
      const oldSession = {
        version: '1.0.0',
        clips: libraryClips,
        timeline: { clips: [], duration: 0 },
        zoomLevel,
        playheadPosition: 0,
        scrollPosition,
        lastModified: Date.now(),
      };

      // Convert TimelineDoc to old format
      const session = migrateTimelineDocToSession(doc, oldSession);

      await window.electron.timeline.saveSession(session);
    } catch (error) {
      console.error('[TimelineStore] Failed to save to backend:', error);
    }
  },

  // Load from backend (auto-migrates old format)
  loadFromBackend: async () => {
    try {
      const data = await window.electron.timeline.loadSession();

      if (!data) {
        console.warn('[TimelineStore] No saved session found');
        return;
      }

      // Auto-detect and migrate
      const { doc, migrated } = ensureLatestFormat(data);

      if (migrated) {
        console.log('[TimelineStore] Migrated old session to new format');
      }

      set({
        doc,
        libraryClips: data.clips || [],
        zoomLevel: data.zoomLevel || 100,
        scrollPosition: data.scrollPosition || 0,
        selectedClipIds: doc.selection?.clipIds || [],
        undoStack: [],
        redoStack: [],
      });
    } catch (error) {
      console.error('[TimelineStore] Failed to load from backend:', error);
    }
  },

  // Reset timeline
  resetTimeline: () => {
    set({
      doc: createEmptyTimeline(),
      libraryClips: [],
      undoStack: [],
      redoStack: [],
      zoomLevel: 100,
      scrollPosition: 0,
      selectedClipIds: [],
      isPlaying: false,
    });

    get().saveToBackend();
  },
}));
