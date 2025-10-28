/**
 * TimelinePlayhead Component
 * Red vertical line showing current playback position (draggable for scrubbing)
 */

import React, { useState, useRef, useEffect } from 'react';
import { getPixelsPerSecond } from '../utils/timecode';

interface TimelinePlayheadProps {
  playheadPosition: number;   // Position in seconds
  timelineDuration: number;   // Total duration in seconds
  zoomLevel: number;          // Zoom level (100-1000)
  padding: number;            // Timeline horizontal padding (px)
  onSeek: (time: number) => void;
}

export const TimelinePlayhead: React.FC<TimelinePlayheadProps> = ({
  playheadPosition,
  timelineDuration,
  zoomLevel,
  padding,
  onSeek,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const playheadRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const pixelsPerSecond = getPixelsPerSecond(zoomLevel);
  const xPosition = padding + (playheadPosition * pixelsPerSecond); // Add padding offset

  // Handle mouse down on playhead (start drag)
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  // Handle mouse move (dragging)
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left - padding; // Account for padding
      const newTime = Math.max(0, Math.min(x / pixelsPerSecond, timelineDuration));

      onSeek(newTime);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, pixelsPerSecond, timelineDuration, onSeek]);

  return (
    <div
      ref={containerRef}
      style={styles.container}
    >
      <div
        ref={playheadRef}
        style={{ ...styles.playhead, left: `${xPosition}px`, cursor: isDragging ? 'grabbing' : 'grab' }}
        onMouseDown={handleMouseDown}
      >
        <div style={styles.playheadHandle} />
        <div style={styles.playheadLine} />
      </div>
    </div>
  );
};

const styles = {
  container: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    pointerEvents: 'none' as const, // Don't block clicks on clips
    zIndex: 200,
  },
  playhead: {
    position: 'absolute' as const,
    top: 0,
    width: '2px',
    height: '100%',
    zIndex: 200,
    pointerEvents: 'auto' as const, // Only the playhead itself is clickable
  },
  playheadHandle: {
    position: 'absolute' as const,
    top: '-4px',
    left: '-6px',
    width: '14px',
    height: '14px',
    backgroundColor: '#ff4444',
    borderRadius: '2px',
    border: '1px solid #cc0000',
    cursor: 'grab',
  },
  playheadLine: {
    position: 'absolute' as const,
    top: '10px',
    left: 0,
    width: '2px',
    height: 'calc(100% - 10px)',
    backgroundColor: '#ff4444',
    pointerEvents: 'none' as const,
  },
};
