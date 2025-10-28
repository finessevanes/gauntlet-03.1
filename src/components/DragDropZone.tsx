/**
 * DragDropZone Component
 * Handles drag-and-drop of video files onto the app window
 */

import React, { useState, useEffect, useRef } from 'react';

interface DragDropZoneProps {
  onDrop: (filePaths: string[]) => void;
  children: React.ReactNode;
}

export const DragDropZone: React.FC<DragDropZoneProps> = ({ onDrop, children }) => {
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);

  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current++;
      if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
        setIsDragging(true);
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current--;
      if (dragCounterRef.current === 0) {
        setIsDragging(false);
      }
    };

    // Handle drop in React to clear dragging state
    const handleDropReact = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      dragCounterRef.current = 0;
      // Actual file handling is done in preload script
    };

    // Set up drop handler via Electron API (preload script handles file paths)
    const cleanup = window.electron?.dragDrop?.onDrop((filePaths) => {
      console.log('[DragDrop] Received file paths from preload:', filePaths);

      // Filter to only .mp4 and .mov files
      const validFiles = filePaths.filter(path => {
        const lower = path.toLowerCase();
        return lower.endsWith('.mp4') || lower.endsWith('.mov');
      });

      console.log('[DragDrop] Valid files:', validFiles);

      if (validFiles.length > 0) {
        onDrop(validFiles);
      } else if (filePaths.length > 0) {
        console.warn('[DragDrop] No valid video files (only .mp4 and .mov supported)');
      }
    });

    // Add event listeners for drag UI feedback
    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('dragenter', handleDragEnter);
    document.addEventListener('dragleave', handleDragLeave);
    document.addEventListener('drop', handleDropReact);

    // Cleanup on unmount
    return () => {
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('dragenter', handleDragEnter);
      document.removeEventListener('dragleave', handleDragLeave);
      document.removeEventListener('drop', handleDropReact);
      cleanup?.();
    };
  }, [onDrop]);

  return (
    <div style={styles.container}>
      {children}
      {isDragging && (
        <div style={styles.overlay}>
          <div style={styles.overlayContent}>
            <div style={styles.overlayIcon}>📁</div>
            <div style={styles.overlayText}>Drop video files to import</div>
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    position: 'relative' as const,
    width: '100%',
    height: '100%',
  },
  overlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    pointerEvents: 'none' as const,
  },
  overlayContent: {
    textAlign: 'center' as const,
    color: '#ffffff',
  },
  overlayIcon: {
    fontSize: '64px',
    marginBottom: '16px',
  },
  overlayText: {
    fontSize: '20px',
    fontWeight: 'bold' as const,
  },
};
