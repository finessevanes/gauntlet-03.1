/**
 * TimelineClip Component
 * Individual clip block on timeline (draggable, deletable, proportional width)
 */

import React, { useState, useRef } from 'react';
import { Clip } from '../types/session';
import { formatDuration, getPixelsPerSecond } from '../utils/timecode';
import { BrokenFileIcon } from './BrokenFileIcon';

interface TimelineClipProps {
  clip: Clip;
  instanceId: string;             // Unique instance ID for this timeline clip
  index: number;
  zoomLevel: number;
  startTime: number;              // Absolute start time on timeline (seconds)
  onReorder: (instanceId: string, newPosition: number) => void;
  onDelete: (instanceId: string) => void;
  onInsertLibraryClip: (clipId: string, position: number) => void; // Insert library clip at position
  isSelected: boolean;
  onSelect: (instanceId: string) => void;
  isBroken: boolean;
  isDragging: boolean;            // Is this clip being dragged
  onDragStart: (instanceId: string) => void;
  onDragEnd: () => void;
  onDragEnter: (index: number) => void;
  draggedClipIndex: number | null; // Index of the clip being dragged (for reorder calculation)
}

export const TimelineClip: React.FC<TimelineClipProps> = ({
  clip,
  instanceId,
  index,
  zoomLevel,
  startTime,
  onReorder,
  onDelete,
  onInsertLibraryClip,
  isSelected,
  onSelect,
  isBroken,
  isDragging,
  onDragStart,
  onDragEnd,
  onDragEnter,
  draggedClipIndex,
}) => {
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const clipRef = useRef<HTMLDivElement>(null);

  const pixelsPerSecond = getPixelsPerSecond(zoomLevel);
  const effectiveDuration = clip.outPoint - clip.inPoint;
  const clipWidth = effectiveDuration * pixelsPerSecond;
  const xPosition = startTime * pixelsPerSecond;

  // Handle click - select the clip (same as Library)
  const handleClick = (e: React.MouseEvent) => {
    console.log('[TimelineClip] Click - selecting clip:', instanceId);
    onSelect(instanceId);
  };

  // Handle right-click context menu
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Also select the clip when right-clicking
    onSelect(instanceId);

    setContextMenuPosition({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
  };

  // Handle delete from context menu
  const handleDeleteClick = () => {
    setShowContextMenu(false);
    onDelete(instanceId);
  };

  // Handle Delete key press
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isSelected && (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault();
        onDelete(instanceId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSelected, instanceId, onDelete]);

  // Handle drag start (for reordering) - same as Library
  const handleDragStart = (e: React.DragEvent) => {
    console.log('[TimelineClip] Drag start:', instanceId);

    // Select the clip being dragged (same as Library does)
    onSelect(instanceId);
    onDragStart(instanceId);

    e.dataTransfer.setData('timelineClipId', instanceId);
    e.dataTransfer.setData('type', 'reorder');
    e.dataTransfer.effectAllowed = 'move';

    // Create a custom drag image using a canvas to ensure proper rendering
    if (clipRef.current) {
      // Use the clip element itself as the drag image, positioned at cursor
      const rect = clipRef.current.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const offsetY = e.clientY - rect.top;
      e.dataTransfer.setDragImage(clipRef.current, offsetX, offsetY);
    }
  };

  // Handle drag over (allow drop)
  const handleDragOver = (e: React.DragEvent) => {
    const isReorder = e.dataTransfer.types.includes('timelineclipid');
    const isLibraryClip = e.dataTransfer.types.includes('clipid');

    if (isReorder || isLibraryClip) {
      e.preventDefault();
      e.stopPropagation(); // Prevent event from bubbling to parent
      e.dataTransfer.dropEffect = isReorder ? 'move' : 'copy';
    }
  };

  // Handle drag enter (show insertion point)
  const handleDragEnterClip = (e: React.DragEvent) => {
    const isReorder = e.dataTransfer.types.includes('timelineclipid');
    const isLibraryClip = e.dataTransfer.types.includes('clipid');

    if (isReorder || isLibraryClip) {
      e.preventDefault();
      e.stopPropagation(); // Prevent event from bubbling to parent

      // Calculate which half of the clip the cursor is over
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const clipMiddle = rect.width / 2;

      // If cursor is in left half, show indicator before this clip (index)
      // If cursor is in right half, show indicator after this clip (index + 1)
      const dropIndex = mouseX < clipMiddle ? index : index + 1;

      console.log('[TimelineClip] Drag enter:', {
        index,
        mouseX,
        clipMiddle,
        dropIndex,
        filename: clip.filename
      });

      onDragEnter(dropIndex);
    }
  };

  // Handle drag end
  const handleDragEndClip = (e: React.DragEvent) => {
    console.log('[TimelineClip] Drag ended:', instanceId);
    onDragEnd();
  };

  // Handle drop (reorder or insert library clip)
  const handleDrop = (e: React.DragEvent) => {
    console.log('[TimelineClip] ===== DROP EVENT FIRED =====', {
      clipFilename: clip.filename.substring(0, 10),
      clipIndex: index,
      eventType: e.type,
      timestamp: Date.now(),
    });

    const timelineClipId = e.dataTransfer.getData('timelineClipId');
    const libraryClipId = e.dataTransfer.getData('clipId');
    const type = e.dataTransfer.getData('type');

    // Calculate which half of the clip the cursor is over
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const clipMiddle = rect.width / 2;

    // If cursor is in left half, insert before this clip (index)
    // If cursor is in right half, insert after this clip (index + 1)
    const dropIndex = mouseX < clipMiddle ? index : index + 1;

    console.log('[TimelineClip] Drop event data:', {
      timelineClipId: timelineClipId?.substring(0, 8),
      libraryClipId: libraryClipId?.substring(0, 8),
      type,
      thisClipIndex: index,
      thisClipFilename: clip.filename.substring(0, 10),
      mouseX,
      clipMiddle,
      calculatedDropIndex: dropIndex,
      isLeftHalf: mouseX < clipMiddle,
    });

    // Handle timeline clip reordering
    if (type === 'reorder' && timelineClipId && timelineClipId !== instanceId) {
      e.preventDefault();
      e.stopPropagation();

      // Adjust dropIndex based on where the dragged clip is
      // Backend expects position in array AFTER removing the clip
      let adjustedDropIndex = dropIndex;

      if (draggedClipIndex !== null && draggedClipIndex < dropIndex) {
        // If dragging a clip forward, decrement the drop index
        // because the clip will be removed first, shifting indices down
        adjustedDropIndex = dropIndex - 1;
      }

      console.log('[TimelineClip] Calling onReorder:', {
        originalDropIndex: dropIndex,
        adjustedDropIndex,
        draggedClipIndex,
        reason: draggedClipIndex !== null && draggedClipIndex < dropIndex ? 'dragging forward, adjusted -1' : 'no adjustment needed'
      });

      onReorder(timelineClipId, adjustedDropIndex);
    }
    // Handle library clip insertion at calculated position (not at the very end)
    else if (libraryClipId && type !== 'reorder') {
      e.preventDefault();
      e.stopPropagation();

      console.log('[TimelineClip] Inserting library clip at position:', dropIndex);
      onInsertLibraryClip(libraryClipId, dropIndex);
    } else {
      console.log('[TimelineClip] Drop ignored - no matching condition');
    }
    // Don't prevent default for other cases - let it bubble to Timeline
  };

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
        ref={clipRef}
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEndClip}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnterClip}
        onDrop={handleDrop}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        style={{
          ...styles.clip,
          left: `${xPosition}px`,
          width: `${clipWidth}px`,
          borderColor: isSelected ? '#4a9eff' : '#555',
          backgroundColor: isSelected ? '#4a5a6a' : '#3a3a3a',
          borderWidth: isSelected ? '3px' : '2px',
          opacity: isBroken ? 0.5 : 1,
          pointerEvents: 'auto',
          transition: 'border-color 0.2s, background-color 0.2s, border-width 0.1s',
        }}
        title={isBroken ? `Source file not found: ${clip.filename}` : clip.filename}
      >
        {/* Broken File Icon Overlay */}
        {isBroken && (
          <BrokenFileIcon tooltip={`Source file not found: ${clip.filename}`} />
        )}

        {/* Clip Thumbnail (optional, using first frame) */}
        {clip.thumbnail && (
          <img
            src={clip.thumbnail}
            alt=""
            style={styles.thumbnail}
          />
        )}

        {/* Clip Filename */}
        <div style={styles.clipInfo}>
          <span style={styles.filename}>
            {clip.filename}
          </span>
          <span style={styles.duration}>
            {formatDuration(effectiveDuration)}
          </span>
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
  clip: {
    position: 'absolute' as const,
    top: '24px', // Below ruler (ruler is 20px + 4px margin)
    height: '60px',
    backgroundColor: '#3a3a3a',
    border: '2px solid #555',
    borderRadius: '4px',
    cursor: 'grab',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    padding: '4px 8px',
    gap: '8px',
    userSelect: 'none' as const,
    zIndex: 10, // Above track background, below playhead
    pointerEvents: 'auto' as const,
    boxSizing: 'border-box' as const, // Include border in width calculation
  },
  thumbnail: {
    width: '40px',
    height: '40px',
    objectFit: 'cover' as const,
    borderRadius: '2px',
    flexShrink: 0,
  },
  clipInfo: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
    overflow: 'hidden',
    flex: 1,
  },
  filename: {
    fontSize: '12px',
    color: '#ccc',
    fontWeight: 'bold' as const,
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  duration: {
    fontSize: '11px',
    color: '#999',
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
