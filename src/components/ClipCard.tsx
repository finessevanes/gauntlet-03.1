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
        className={`flex flex-col cursor-pointer transition-all duration-200 rounded-lg p-0 w-full min-w-0 ${
          isSelected ? 'outline-2 outline-blue-400 outline-offset-2' : ''
        } ${isBroken ? 'border-2 border-red-500 opacity-70 cursor-not-allowed' : ''} ${
          isHovered && !isBroken ? 'scale-102' : ''
        }`}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        draggable={!isBroken}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
      {/* Thumbnail with duration overlay */}
      <div className="relative w-full h-[90px] rounded-md overflow-hidden bg-dark-700 mb-1.5 flex-shrink-0">
        {/* Broken file icon overlay */}
        {isBroken && (
          <BrokenFileIcon tooltip={`Source file not found: ${clip.filePath}`} />
        )}

        {clip.thumbnail ? (
          <img
            src={clip.thumbnail}
            alt={clip.filename}
            className="w-full h-full object-cover"
            onError={(e) => {
              // Fallback for broken thumbnails
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-2xl">🎥</div>
        )}
        {/* Duration badge overlay */}
        <div className="absolute bottom-1 right-1 bg-black bg-opacity-75 text-white text-xs font-bold px-1.5 py-0.5 rounded">{formatDuration(clip.duration)}</div>
      </div>

      {/* Filename */}
      <div className="text-xs text-white overflow-hidden text-ellipsis whitespace-nowrap leading-tight" title={clip.filename}>
        {clip.filename}
      </div>
      </div>

      {/* Context Menu */}
      {showContextMenu && (
        <div
          className="fixed bg-dark-800 border border-dark-600 rounded shadow-lg z-50"
          style={{
            left: `${contextMenuPosition.x}px`,
            top: `${contextMenuPosition.y}px`,
          }}
        >
          <button
            onClick={handleDeleteClick}
            className="block w-full px-4 py-2 bg-transparent border-0 text-dark-200 text-xs text-left cursor-pointer rounded-sm transition-colors duration-200 hover:bg-dark-700"
          >
            Delete
          </button>
        </div>
      )}
    </>
  );
};

// Styles removed - using Tailwind CSS instead
