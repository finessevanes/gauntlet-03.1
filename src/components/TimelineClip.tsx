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
  padding: number;                // Timeline horizontal padding (px)
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

  // Trim props (Story 5)
  hoveredEdge: { instanceId: string; edge: 'left' | 'right' } | null;
  onEdgeHoverChange: (instanceId: string, edge: 'left' | 'right' | null) => void;
  onTrimStart: (clipId: string, instanceId: string, edge: 'left' | 'right', e: React.MouseEvent) => void;
  isTrimming: boolean;            // Is any clip currently being trimmed
  draggedInPoint: number | null;  // Current inPoint during drag (optimistic UI)
  draggedOutPoint: number | null; // Current outPoint during drag (optimistic UI)
  isTrimmedClipOverlapping?: boolean; // Whether the trimmed clip overlaps another clip
}

export const TimelineClip: React.FC<TimelineClipProps> = ({
  clip,
  instanceId,
  index,
  zoomLevel,
  startTime,
  padding,
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
  hoveredEdge,
  onEdgeHoverChange,
  onTrimStart,
  isTrimming,
  draggedInPoint,
  draggedOutPoint,
  isTrimmedClipOverlapping = false,
}) => {
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const clipRef = useRef<HTMLDivElement>(null);

  const pixelsPerSecond = getPixelsPerSecond(zoomLevel);

  // Use dragged trim points if they exist (during OR after trim drag), otherwise use clip's trim points
  // This prevents the "bounce" when releasing the mouse, as optimistic values persist until backend updates
  const effectiveInPoint = draggedInPoint !== null ? draggedInPoint : clip.inPoint;
  const effectiveOutPoint = draggedOutPoint !== null ? draggedOutPoint : clip.outPoint;
  const effectiveDuration = effectiveOutPoint - effectiveInPoint;
  const clipWidth = effectiveDuration * pixelsPerSecond;

  // Calculate x position: startTime is the clip's position on timeline,
  // but we need to offset by inPoint to show the visible portion
  const trimOffset = effectiveInPoint - clip.inPoint; // How much we've trimmed from the start
  const xPosition = padding + ((startTime + trimOffset) * pixelsPerSecond);

  // Calculate original clip position for comparison (what it looked like before this drag)
  const originalTrimOffset = clip.inPoint - clip.inPoint; // Always 0, but for clarity
  const originalXPosition = padding + ((startTime + originalTrimOffset) * pixelsPerSecond);
  const originalWidth = (clip.outPoint - clip.inPoint) * pixelsPerSecond;

  // Determine if we're expanding or trimming (growing or shrinking)
  const isExpanding = isTrimming && (effectiveInPoint < clip.inPoint || effectiveOutPoint > clip.outPoint);

  // Debug logging for trim - removed for production

  // Check if this clip's edge is being hovered (use instanceId, not clipId, to support multiple instances)
  const isLeftEdgeHovered = hoveredEdge?.instanceId === instanceId && hoveredEdge.edge === 'left';
  const isRightEdgeHovered = hoveredEdge?.instanceId === instanceId && hoveredEdge.edge === 'right';
  const isAnyEdgeHovered = isLeftEdgeHovered || isRightEdgeHovered;

  // Handle click - select the clip (same as Library)
  const handleClick = (e: React.MouseEvent) => {
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

  // Handle mouse move for edge hover detection (Story 5: Trim)
  const handleMouseMove = (e: React.MouseEvent) => {
    // Don't detect edges if currently dragging for reorder
    if (isDragging) return;

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const relativeX = e.clientX - rect.left;

    const EDGE_THRESHOLD = 5; // px from edge

    // Check left edge
    if (relativeX <= EDGE_THRESHOLD) {
      onEdgeHoverChange(instanceId, 'left');
      return;
    }

    // Check right edge
    if (relativeX >= rect.width - EDGE_THRESHOLD) {
      onEdgeHoverChange(instanceId, 'right');
      return;
    }

    // Not hovering over edge (only clear if not currently trimming this clip)
    if (!isTrimming) {
      onEdgeHoverChange(instanceId, null);
    }
  };

  // Handle mouse leave (clear edge hover, unless currently trimming)
  const handleMouseLeave = () => {
    if (!isTrimming) {
      onEdgeHoverChange(instanceId, null);
    }
  };

  // Handle mouse down on edge (start trim drag)
  const handleMouseDown = (e: React.MouseEvent) => {
    // Check if clicking on an edge
    if (isAnyEdgeHovered && hoveredEdge) {
      e.stopPropagation(); // Prevent regular drag from starting
      onTrimStart(clip.id, instanceId, hoveredEdge.edge, e);
    }
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
    // Don't allow reorder drag if hovering over edge (trim takes priority)
    if (isAnyEdgeHovered) {
      e.preventDefault();
      return;
    }

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
    // Check for library clips using standard MIME types
    const hasFiles = e.dataTransfer.types.includes('Files');
    const hasText = e.dataTransfer.types.includes('text/html') || e.dataTransfer.types.includes('text/plain');

    // During a reorder drag, we can't read custom data, but we know a drag is happening
    // Check if draggedClipIndex is set (means a timeline clip is being dragged)
    const isReorderDrag = draggedClipIndex !== null;
    const isLibraryClip = hasFiles || hasText;

    if (isReorderDrag || isLibraryClip) {
      e.preventDefault();
      e.stopPropagation(); // Prevent event from bubbling to parent
      e.dataTransfer.dropEffect = isReorderDrag ? 'move' : 'copy';
    }
  };

  // Handle drag enter (show insertion point)
  const handleDragEnterClip = (e: React.DragEvent) => {
    // During a reorder drag, draggedClipIndex will be set by parent
    const isReorderDrag = draggedClipIndex !== null;

    // Check for library clips using standard MIME types
    const hasFiles = e.dataTransfer.types.includes('Files');
    const hasText = e.dataTransfer.types.includes('text/html') || e.dataTransfer.types.includes('text/plain');
    const isLibraryClip = hasFiles || hasText;

    if (isReorderDrag || isLibraryClip) {
      e.preventDefault();
      e.stopPropagation(); // Prevent event from bubbling to parent

      // Calculate which half of the clip the cursor is over
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const clipMiddle = rect.width / 2;

      // If cursor is in left half, show indicator before this clip (index)
      // If cursor is in right half, show indicator after this clip (index + 1)
      const dropIndex = mouseX < clipMiddle ? index : index + 1;

      onDragEnter(dropIndex);
    }
  };

  // Handle drag end
  const handleDragEndClip = (e: React.DragEvent) => {
    onDragEnd();
  };

  // Handle drop (reorder or insert library clip)
  const handleDrop = (e: React.DragEvent) => {
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

      onReorder(timelineClipId, adjustedDropIndex);
    }
    // Handle library clip insertion at calculated position (not at the very end)
    else if (libraryClipId && type !== 'reorder') {
      e.preventDefault();
      e.stopPropagation();

      onInsertLibraryClip(libraryClipId, dropIndex);
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
      {/* Ghost placeholder - shows outline when trimmed clip overlaps another clip */}
      {isTrimming && isTrimmedClipOverlapping && (
        <div
          style={{
            position: 'absolute' as const,
            top: '24px',
            left: `${xPosition}px`,
            width: `${clipWidth}px`,
            height: '60px',
            backgroundColor: 'transparent',
            border: '2px dashed rgba(100, 150, 200, 0.6)', // Dashed outline to show clip boundary
            borderRadius: '4px',
            pointerEvents: 'none' as const, // Don't interfere with other interactions
            zIndex: 15, // Above other clips to be visible on top
          }}
          title="Trimmed clip outline"
        />
      )}

      <div
        ref={clipRef}
        draggable={!isAnyEdgeHovered} // Disable draggable when hovering edge
        onDragStart={handleDragStart}
        onDragEnd={handleDragEndClip}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnterClip}
        onDrop={handleDrop}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onMouseDown={handleMouseDown}
        style={{
          ...styles.clip,
          left: `${xPosition}px`,
          width: `${clipWidth}px`,
          border: `${isSelected ? '3px' : '2px'} solid ${isSelected ? '#4a9eff' : '#555'}`,
          backgroundColor: isAnyEdgeHovered ? 'rgba(58, 58, 58, 0.8)' : isSelected ? '#4a5a6a' : '#3a3a3a',
          backgroundImage: isAnyEdgeHovered ? 'linear-gradient(90deg, rgba(0, 255, 0, 0.15) 0%, rgba(0, 255, 0, 0.1) 50%, rgba(0, 255, 0, 0.15) 100%)' : 'none',
          opacity: isBroken ? 0.5 : 1,
          pointerEvents: 'auto',
          transition: 'border-color 0.2s, background-color 0.2s, border-width 0.1s',
          cursor: isAnyEdgeHovered ? 'col-resize' : 'grab', // Change cursor on edge hover
          zIndex: isTrimming ? 20 : 10, // Higher z-index while trimming to appear on top of adjacent clips
          boxShadow: isLeftEdgeHovered ? 'inset 3px 0 0 #00ff00' : isRightEdgeHovered ? 'inset -3px 0 0 #00ff00' : 'none', // Green outline on trim edge
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
