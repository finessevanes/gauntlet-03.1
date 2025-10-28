/**
 * ClipCard Component
 * Displays a single clip with thumbnail, filename, and duration
 */

import React from 'react';
import { Clip } from '../types/session';

interface ClipCardProps {
  clip: Clip;
}

// Helper: Format duration in MM:SS
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export const ClipCard: React.FC<ClipCardProps> = ({ clip }) => {
  return (
    <div style={styles.card}>
      {/* Thumbnail with duration overlay */}
      <div style={styles.thumbnailContainer}>
        {clip.thumbnail ? (
          <img src={clip.thumbnail} alt={clip.filename} style={styles.thumbnail} />
        ) : (
          <div style={styles.placeholderThumbnail}>🎥</div>
        )}
        {/* Duration badge overlay */}
        <div style={styles.durationBadge}>{formatDuration(clip.duration)}</div>
      </div>

      {/* Filename */}
      <div style={styles.filename} title={clip.filename}>
        {clip.filename}
      </div>
    </div>
  );
};

const styles = {
  card: {
    display: 'flex',
    flexDirection: 'column' as const,
    cursor: 'pointer',
    transition: 'transform 0.2s',
  },
  thumbnailContainer: {
    position: 'relative' as const,
    width: '100%',
    aspectRatio: '16/9',
    borderRadius: '6px',
    overflow: 'hidden',
    backgroundColor: '#333',
    marginBottom: '6px',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
  },
  placeholderThumbnail: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '32px',
  },
  durationBadge: {
    position: 'absolute' as const,
    bottom: '4px',
    right: '4px',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    color: '#ffffff',
    fontSize: '10px',
    fontWeight: 'bold' as const,
    padding: '2px 6px',
    borderRadius: '3px',
  },
  filename: {
    fontSize: '12px',
    color: '#ffffff',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
    lineHeight: 1.3,
  },
};
