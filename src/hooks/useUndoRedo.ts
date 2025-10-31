/**
 * Undo/Redo Keyboard Shortcuts Hook
 * Listens for Cmd+Z / Cmd+Shift+Z (or Ctrl on Windows)
 */

import { useEffect } from 'react';
import { useTimelineStore } from '../store/timelineStore';

export function useUndoRedo() {
  const undo = useTimelineStore((state) => state.undo);
  const redo = useTimelineStore((state) => state.redo);
  const undoStack = useTimelineStore((state) => state.undoStack);
  const redoStack = useTimelineStore((state) => state.redoStack);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const ctrlKey = isMac ? event.metaKey : event.ctrlKey;

      // Cmd+Z or Ctrl+Z = Undo
      if (ctrlKey && event.key === 'z' && !event.shiftKey) {
        if (undoStack.length > 0) {
          event.preventDefault();
          console.log('[UndoRedo] Undo triggered');
          undo();
        }
      }

      // Cmd+Shift+Z or Ctrl+Shift+Z = Redo
      if (ctrlKey && event.key === 'z' && event.shiftKey) {
        if (redoStack.length > 0) {
          event.preventDefault();
          console.log('[UndoRedo] Redo triggered');
          redo();
        }
      }

      // Cmd+Y or Ctrl+Y = Redo (alternative)
      if (ctrlKey && event.key === 'y' && !event.shiftKey) {
        if (redoStack.length > 0) {
          event.preventDefault();
          console.log('[UndoRedo] Redo triggered (Cmd+Y)');
          redo();
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [undo, redo, undoStack.length, redoStack.length]);

  return {
    undo,
    redo,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    undoCount: undoStack.length,
    redoCount: redoStack.length,
  };
}
