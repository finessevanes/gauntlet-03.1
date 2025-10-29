/**
 * Library Component
 * Displays all imported clips in a scrollable panel
 * Supports click-to-preview and drag-to-timeline
 */

import React, { useEffect, useState } from 'react';
import { useSessionStore } from '../store/sessionStore';
import { ClipCard } from './ClipCard';
import { EmptyState } from './EmptyState';

export const Library: React.FC = () => {
  const clips = useSessionStore((state) => state.clips);
  const clearLibrary = useSessionStore((state) => state.clearLibrary);
  const removeClip = useSessionStore((state) => state.removeClip);
  const updateTimeline = useSessionStore((state) => state.updateTimeline);
  const setPlayheadPosition = useSessionStore((state) => state.setPlayheadPosition);
  const selectedClipId = useSessionStore((state) => state.selectedClipId);
  const selectedClipSource = useSessionStore((state) => state.selectedClipSource);
  const setSelectedClip = useSessionStore((state) => state.setSelectedClip);
  const setPreviewSource = useSessionStore((state) => state.setPreviewSource);
  const setIsPlaying = useSessionStore((state) => state.setIsPlaying);
  const [brokenFiles, setBrokenFiles] = useState<Set<string>>(new Set());
  const [isCheckingFiles, setIsCheckingFiles] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Check file existence on mount, when clips change, and periodically
  useEffect(() => {
    if (clips.length === 0) {
      setBrokenFiles(new Set());
      return;
    }

    const checkFiles = async () => {
      setIsCheckingFiles(true);
      const broken = new Set<string>();

      // Check files in batches to avoid performance issues
      for (const clip of clips) {
        try {
          const result = await window.electron.library.checkFileExists(clip.filePath);
          if (!result.exists) {
            broken.add(clip.id);
          }
        } catch (error) {
          console.error(`Error checking file ${clip.filePath}:`, error);
          broken.add(clip.id);
        }
      }

      setBrokenFiles(broken);
      setIsCheckingFiles(false);
    };

    // Initial check (debounced)
    const initialCheckTimeout = setTimeout(checkFiles, 500);

    // Periodic re-check every 5 seconds to detect file deletions
    const intervalId = setInterval(checkFiles, 5000);

    return () => {
      clearTimeout(initialCheckTimeout);
      clearInterval(intervalId);
    };
  }, [clips]);

  const handleClipClick = (clipId: string) => {
    console.log('[Library] Selected clip for preview', {
      clipId,
      previousSelection: selectedClipId,
      previousSource: selectedClipSource,
    });
    setSelectedClip(clipId, 'library');
    setIsPlaying(false);
    setPreviewSource('library', { clipId, resetPlayhead: true });
    console.log('[Library] Preview source switched to library clip', {
      clipId,
      resetPlayhead: true,
      message: 'Playhead reset to 0',
    });
  };

  const handleClipDragStart = (e: React.DragEvent, clipId: string) => {
    // Set active/selected state when drag starts
    setSelectedClip(clipId, 'library');

    // Set clip ID in dataTransfer for Timeline (Story 4) to receive
    e.dataTransfer.setData('clipId', clipId);
    e.dataTransfer.effectAllowed = 'copy';

    // Story 4 (Timeline) will implement drop target logic
    console.log('[Library] Dragging clip:', clipId);
  };

  const handleClipDragEnd = () => {
    // Clear active/selected state after drag ends (whether dropped or not)
    setSelectedClip(null, null);
    console.log('[Library] Drag ended, clearing selection');
  };

  const handleClearLibrary = () => {
    clearLibrary();
    setShowClearConfirm(false);
    setSelectedClip(null, null);
  };

  const handleClipDelete = async (clipId: string) => {
    console.log('[Library] Deleting clip:', clipId);

    try {
      const result = await window.electron.library.removeClip(clipId);

      if (result.success) {
        // Remove from local state
        removeClip(clipId);

        // Fetch updated timeline state (in case clip was removed from timeline)
        const timelineState = await window.electron.timeline.getTimelineState();
        updateTimeline({ clips: timelineState.clips, duration: timelineState.duration });
        setPlayheadPosition(timelineState.playheadPosition);

        // Clear selection
        setSelectedClip(null, null);

        console.log('[Library] Clip deleted successfully');
      } else {
        console.error('[Library] Failed to delete clip:', result.error);
      }
    } catch (error) {
      console.error('[Library] Error deleting clip:', error);
    }
  };

  // Show empty state if no clips
  if (clips.length === 0) {
    return (
      <div style={styles.container}>
        <EmptyState type="library" />
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Library Header */}
      <div style={styles.header}>
        <h3 style={styles.headerTitle}>Library ({clips.length})</h3>
        <button
          onClick={() => setShowClearConfirm(true)}
          style={styles.clearButton}
          title="Clear all clips from library"
        >
          Clear All
        </button>
      </div>

      {/* Clear Confirmation Dialog */}
      {showClearConfirm && (
        <div style={styles.confirmDialog}>
          <div style={styles.confirmContent}>
            <p style={styles.confirmText}>
              Are you sure you want to remove all {clips.length} clip(s) from the library?
            </p>
            <div style={styles.confirmButtons}>
              <button
                onClick={handleClearLibrary}
                style={styles.confirmYesButton}
              >
                Yes, Clear All
              </button>
              <button
                onClick={() => setShowClearConfirm(false)}
                style={styles.confirmNoButton}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={styles.clipGrid}>
        {clips.map((clip) => (
          <ClipCard
            key={clip.id}
            clip={clip}
            onClick={() => handleClipClick(clip.id)}
            onDragStart={(e) => handleClipDragStart(e, clip.id)}
            onDragEnd={handleClipDragEnd}
            onDelete={() => handleClipDelete(clip.id)}
            isSelected={selectedClipId === clip.id && selectedClipSource === 'library'}
            isBroken={brokenFiles.has(clip.id)}
          />
        ))}
      </div>

      {/* Loading indicator while checking files */}
      {isCheckingFiles && clips.length > 0 && (
        <div style={styles.checkingIndicator}>
          Validating files...
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1a1a1a',
    padding: '12px',
    overflowY: 'auto' as const,
    overflowX: 'hidden' as const,
    position: 'relative' as const,
    display: 'flex',
    flexDirection: 'column' as const,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
    paddingBottom: '8px',
    borderBottom: '1px solid #333',
  },
  headerTitle: {
    margin: 0,
    fontSize: '14px',
    fontWeight: 600,
    color: '#e0e0e0',
  },
  clearButton: {
    padding: '6px 12px',
    backgroundColor: '#d32f2f',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    ':hover': {
      backgroundColor: '#b71c1c',
    },
  },
  clipGrid: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
    flex: 1,
  },
  confirmDialog: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  confirmContent: {
    backgroundColor: '#2a2a2a',
    padding: '24px',
    borderRadius: '8px',
    border: '1px solid #444',
    maxWidth: '400px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.8)',
  },
  confirmText: {
    margin: '0 0 16px 0',
    fontSize: '14px',
    color: '#e0e0e0',
    lineHeight: '1.5',
  },
  confirmButtons: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end',
  },
  confirmYesButton: {
    padding: '8px 16px',
    backgroundColor: '#d32f2f',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  confirmNoButton: {
    padding: '8px 16px',
    backgroundColor: '#444',
    color: '#e0e0e0',
    border: 'none',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  checkingIndicator: {
    position: 'absolute' as const,
    bottom: '12px',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    color: '#4a9eff',
    fontSize: '11px',
    padding: '6px 12px',
    borderRadius: '4px',
    border: '1px solid #4a9eff',
  },
};
