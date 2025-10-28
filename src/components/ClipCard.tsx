/**
 * ClipCard Component
 * Displays a single clip with thumbnail, filename, and duration
 */

import React from 'react';
import { Clip } from '../types/session';
import { BrokenFileIcon } from './BrokenFileIcon';

interface ClipCardProps {
  clip: Clip;
  onClick?: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
  onDelete?: () => void;
  isSelected?: boolean;
  isBroken?: boolean;
}

// Helper: Format duration in MM:SS
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export const ClipCard: React.FC<ClipCardProps> = ({
  clip,
  onClick,
  onDragStart,
  onDragEnd,
  onDelete,
  isSelected = false,
  isBroken = false
}) => {
  const [isHovered, setIsHovered] = React.useState(false);
  const [showContextMenu, setShowContextMenu] = React.useState(false);
  const [contextMenuPosition, setContextMenuPosition] = React.useState({ x: 0, y: 0 });

  const handleClick = () => {
    if (onClick) {
      onClick();
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    if (!isBroken && onDragStart) {
      onDragStart(e);
    }
  };

  const handleDragEnd = () => {
    if (!isBroken && onDragEnd) {
      onDragEnd();
    }
  };

  // Handle right-click context menu
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Also select the clip when right-clicking
    if (onClick) {
      onClick();
    }

    setContextMenuPosition({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
  };

  // Handle delete from context menu
  const handleDeleteClick = () => {
    setShowContextMenu(false);
    if (onDelete) {
      onDelete();
    }
  };

  // Handle Delete key press
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isSelected && (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault();
        if (onDelete) {
          onDelete();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSelected, onDelete]);

  // Close context menu when clicking outside
  React.useEffect(() => {
    if (!showContextMenu) return;

    const handleClickOutside = () => setShowContextMenu(false);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showContextMenu]);

  return (
    <>
      <div
        style={{
          ...styles.card,
          ...(isSelected && styles.cardSelected),
          ...(isBroken && styles.cardBroken),
          ...(isHovered && !isBroken && styles.cardHover),
          cursor: isBroken ? 'not-allowed' : 'pointer',
        }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        draggable={!isBroken}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
      {/* Thumbnail with duration overlay */}
      <div style={styles.thumbnailContainer}>
        {/* Broken file icon overlay */}
        {isBroken && (
          <BrokenFileIcon tooltip={`Source file not found: ${clip.filePath}`} />
        )}

        {clip.thumbnail ? (
          <img
            src={clip.thumbnail}
            alt={clip.filename}
            style={styles.thumbnail}
            onError={(e) => {
              // Fallback for broken thumbnails
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
            }}
          />
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

      {/* Context Menu */}
      {showContextMenu && (
        <div
          style={{
            ...styles.contextMenu,
            left: `${contextMenuPosition.x}px`,
            top: `${contextMenuPosition.y}px`,
          }}
        >
          <button
            onClick={handleDeleteClick}
            style={styles.contextMenuItem}
          >
            Delete
          </button>
        </div>
      )}
    </>
  );
};

const styles = {
  card: {
    display: 'flex',
    flexDirection: 'column' as const,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    borderRadius: '8px',
    padding: '0',
  },
  cardHover: {
    transform: 'scale(1.02)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  cardSelected: {
    outline: '2px solid #4a9eff',
    outlineOffset: '2px',
  },
  cardBroken: {
    border: '2px solid #ff4444',
    opacity: 0.7,
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
  contextMenu: {
    position: 'fixed' as const,
    backgroundColor: '#2a2a2a',
    border: '1px solid #555',
    borderRadius: '4px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.5)',
    zIndex: 1000,
    padding: '4px',
  },
  contextMenuItem: {
    display: 'block',
    width: '100%',
    padding: '8px 16px',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#ccc',
    fontSize: '12px',
    textAlign: 'left' as const,
    cursor: 'pointer',
    borderRadius: '2px',
    transition: 'background-color 0.2s',
  },
};
