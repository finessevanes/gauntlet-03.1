/**
 * TimelineLane Component
 * Horizontal lane for clips on a specific track
 */

import React from 'react';
import { Track, Clip } from '../types/session';

interface TimelineLaneProps {
  track: Track;
  clips: Clip[];
  zoomLevel: number;
  onClipDrop: (clipId: string, trackId: string, position: number) => void;
  onClipDragStart: (clipId: string) => void;
  onClipSelect: (clipId: string) => void;
  children?: React.ReactNode; // TimelineClip components will be passed as children
}

export const TimelineLane: React.FC<TimelineLaneProps> = ({
  track,
  clips,
  zoomLevel,
  onClipDrop,
  onClipDragStart,
  onClipSelect,
  children,
}) => {
  const [isDragOver, setIsDragOver] = React.useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const clipId = e.dataTransfer.getData('clipId');
    const timelineClipId = e.dataTransfer.getData('timelineClipId');

    if (timelineClipId) {
      // Moving an existing timeline clip to this track
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const timeInSeconds = x / (zoomLevel / 100); // Convert pixel position to time

      console.log('[TimelineLane] Clip dropped on track:', {
        trackId: track.id,
        trackName: track.name,
        clipId: timelineClipId,
        position: timeInSeconds,
      });

      onClipDrop(timelineClipId, track.id, timeInSeconds);
    }
  };

  // Apply track opacity and visibility to the lane
  const laneStyle = {
    ...styles.lane,
    opacity: track.visible ? track.opacity : 0.3,
    ...(isDragOver ? styles.dragOver : {}),
  };

  return (
    <div
      style={laneStyle}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Render clips (passed as children from Timeline component) */}
      {children}

      {/* Empty state for track */}
      {clips.length === 0 && (
        <div style={styles.emptyState}>
          <span style={styles.emptyText}>{track.name} - Drop clips here</span>
        </div>
      )}
    </div>
  );
};

const styles = {
  lane: {
    position: 'relative' as const,
    height: '80px',
    minHeight: '80px',
    borderBottom: '1px solid #3a3a3a',
    transition: 'opacity 0.15s ease',
  } as React.CSSProperties,
  dragOver: {
    border: '2px solid #4a9eff',
    backgroundColor: 'rgba(74, 158, 255, 0.1)',
  } as React.CSSProperties,
  emptyState: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    pointerEvents: 'none' as const,
  } as React.CSSProperties,
  emptyText: {
    fontSize: '12px',
    color: '#555',
    fontStyle: 'italic' as const,
  } as React.CSSProperties,
};
