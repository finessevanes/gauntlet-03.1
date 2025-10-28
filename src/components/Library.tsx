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
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [brokenFiles, setBrokenFiles] = useState<Set<string>>(new Set());
  const [isCheckingFiles, setIsCheckingFiles] = useState(false);

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
    setSelectedClipId(clipId);
    // Story 6 (Preview Player) will implement actual preview loading
    console.log('[Library] Preview clip:', clipId);
  };

  const handleClipDragStart = (e: React.DragEvent, clipId: string) => {
    // Set clip ID in dataTransfer for Timeline (Story 4) to receive
    e.dataTransfer.setData('clipId', clipId);
    e.dataTransfer.effectAllowed = 'copy';

    // Story 4 (Timeline) will implement drop target logic
    console.log('[Library] Dragging clip:', clipId);
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
      <div style={styles.clipGrid}>
        {clips.map((clip) => (
          <ClipCard
            key={clip.id}
            clip={clip}
            onClick={() => handleClipClick(clip.id)}
            onDragStart={(e) => handleClipDragStart(e, clip.id)}
            isSelected={selectedClipId === clip.id}
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
  },
  clipGrid: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
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
