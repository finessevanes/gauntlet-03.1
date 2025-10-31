/**
 * TimelineClipV2 Component
 * Renders a single clip on the timeline with drag, trim, and selection support
 */

import React, { useState, useRef } from 'react';
import type { Clip as TimelineClip } from '../../types/timeline';
import { ticksToSeconds } from '../../types/timeline';
import { useTimelineStore } from '../../store/timelineStore';
import { useSessionStore } from '../../store/sessionStore';

interface TrimPreview {
  clipId: string;
  edge: 'left' | 'right';
  deltaTicks: number;
}

interface DragPreview {
  clipId: string;
  deltaTicks: number;
}

interface TimelineClipV2Props {
  clip: TimelineClip;
  trackId: string;
  laneId: string;
  pixelsPerTick: number;
  isSelected: boolean;
  onSelect: (clipId: string) => void;
  onTrimStart?: (clipId: string, edge: 'left' | 'right', e?: React.MouseEvent) => void;
  onTrimEnd?: (clipId: string, e?: React.MouseEvent) => void;
  onDragStart?: (clipId: string, e?: React.MouseEvent) => void;
  onDragEnd?: (clipId: string, e?: React.MouseEvent) => void;
  trimPreview?: TrimPreview;
  dragPreview?: DragPreview;
}

export function TimelineClipV2({
  clip,
  trackId,
  laneId,
  pixelsPerTick,
  isSelected,
  onSelect,
  onTrimStart,
  onTrimEnd,
  onDragStart,
  onDragEnd,
  trimPreview,
  dragPreview,
}: TimelineClipV2Props) {
  const [isHoveringEdge, setIsHoveringEdge] = useState<'left' | 'right' | null>(null);
  const timebase = useTimelineStore((state) => state.doc.timebase);

  // Import sessionStore to get library clip metadata
  const libraryClips = useSessionStore((state) => state.clips);
  const libraryClip = libraryClips.find((c) => c.id === clip.sourceId);

  // Calculate dimensions
  const left = clip.start * pixelsPerTick;
  const width = clip.duration * pixelsPerTick;

  // Calculate preview dimensions if trimming
  let previewLeft = left;
  let previewWidth = width;

  if (trimPreview) {
    const deltaPx = trimPreview.deltaTicks * pixelsPerTick;

    if (trimPreview.edge === 'left') {
      // Trimming left edge: adjust left and width
      previewLeft = left + deltaPx;
      previewWidth = Math.max(pixelsPerTick * 1000, width - deltaPx); // Min 1 second
    } else if (trimPreview.edge === 'right') {
      // Trimming right edge: adjust width only
      previewWidth = Math.max(pixelsPerTick * 1000, width + deltaPx); // Min 1 second
    }
  }

  // Calculate preview position if dragging
  let dragPreviewLeft = left;
  if (dragPreview && dragPreview.clipId === clip.id) {
    const deltaPx = dragPreview.deltaTicks * pixelsPerTick;
    dragPreviewLeft = Math.max(0, left + deltaPx);
  }

  // Edge detection threshold
  const EDGE_THRESHOLD = 8; // pixels

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;

    if (x < EDGE_THRESHOLD) {
      setIsHoveringEdge('left');
    } else if (x > width - EDGE_THRESHOLD) {
      setIsHoveringEdge('right');
    } else {
      setIsHoveringEdge(null);
    }
  };

  const handleMouseLeave = () => {
    setIsHoveringEdge(null);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();

    if (isHoveringEdge && onTrimStart) {
      onTrimStart(clip.id, isHoveringEdge, e);
    } else if (onDragStart) {
      onDragStart(clip.id, e);
    }

    onSelect(clip.id);
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isHoveringEdge && onTrimEnd) {
      onTrimEnd(clip.id, e);
    } else if (onDragEnd) {
      onDragEnd(clip.id);
    }
  };

  // Get cursor style
  const getCursor = () => {
    if (isHoveringEdge === 'left') return 'w-resize';
    if (isHoveringEdge === 'right') return 'e-resize';
    return 'grab';
  };

  // Check if clip is locked
  const isLocked = clip.locked || false;

  // Check if clip is in a linked group
  const hasLinkedGroup = !!clip.linkedGroupId;

  return (
    <>
      {/* Ghost Preview (shown while trimming) */}
      {trimPreview && (
        <div
          className="absolute h-full rounded-sm border-2 border-dashed border-yellow-400 bg-yellow-400 bg-opacity-20 pointer-events-none z-10"
          style={{
            left: `${previewLeft}px`,
            width: `${previewWidth}px`,
          }}
        >
          <div className="absolute top-1 left-1 text-xs text-yellow-300 font-semibold">
            {ticksToSeconds(Math.max(1000, clip.duration + (trimPreview.edge === 'right' ? trimPreview.deltaTicks : -trimPreview.deltaTicks)), timebase.ticksPerSecond).toFixed(2)}s
          </div>
        </div>
      )}

      {/* Ghost Preview (shown while dragging) */}
      {dragPreview && dragPreview.clipId === clip.id && (
        <div
          className="absolute h-full rounded-sm border-2 border-dashed border-blue-400 bg-blue-400 bg-opacity-20 pointer-events-none z-10"
          style={{
            left: `${dragPreviewLeft}px`,
            width: `${width}px`,
          }}
        >
          <div className="absolute top-1 left-1 text-xs text-blue-300 font-semibold">
            {ticksToSeconds(Math.max(0, clip.start + dragPreview.deltaTicks), timebase.ticksPerSecond).toFixed(2)}s
          </div>
        </div>
      )}

      {/* Actual Clip */}
      <div
        className={`
          absolute h-full rounded-sm border-2 overflow-hidden transition-all
          ${trimPreview || (dragPreview && dragPreview.clipId === clip.id) ? 'opacity-50' : ''}
          ${isSelected ? 'border-blue-500 ring-2 ring-blue-300' : 'border-gray-600'}
          ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}
          ${hasLinkedGroup ? 'border-t-4 border-t-purple-500' : ''}
        `}
        style={{
          left: `${left}px`,
          width: `${width}px`,
          cursor: isLocked ? 'not-allowed' : getCursor(),
          backgroundColor: isSelected ? '#3b82f6' : '#1f2937',
        }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onMouseDown={!isLocked ? handleMouseDown : undefined}
        onMouseUp={!isLocked ? handleMouseUp : undefined}
      >
      {/* Thumbnail (left side, prominent) */}
      {libraryClip?.thumbnail && width > 80 && (
        <div
          className="absolute left-1 top-1 bottom-1 rounded pointer-events-none"
          style={{
            width: '48px',
            backgroundImage: `url(${libraryClip.thumbnail})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
      )}

      {/* Clip content (text) */}
      <div
        className="absolute top-1/2 -translate-y-1/2 text-xs text-white pointer-events-none"
        style={{
          left: libraryClip?.thumbnail && width > 80 ? '56px' : '8px',
          right: '8px',
        }}
      >
        <div className="font-semibold truncate text-white">
          {libraryClip?.filename || clip.sourceId.substring(0, 8)}
        </div>
        <div className="text-gray-300 text-[10px]">
          {ticksToSeconds(clip.duration, timebase.ticksPerSecond).toFixed(2)}s
        </div>
      </div>

      {/* Left edge indicator */}
      {isHoveringEdge === 'left' && !isLocked && (
        <div className="absolute left-0 top-0 h-full w-1 bg-blue-400" />
      )}

      {/* Right edge indicator */}
      {isHoveringEdge === 'right' && !isLocked && (
        <div className="absolute right-0 top-0 h-full w-1 bg-blue-400" />
      )}

      {/* Locked indicator */}
      {isLocked && (
        <div className="absolute top-1 right-1">
          <svg className="w-3 h-3 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
          </svg>
        </div>
      )}

      {/* Linked group indicator */}
      {hasLinkedGroup && (
        <div className="absolute top-1 left-1">
          <svg className="w-3 h-3 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd" />
          </svg>
        </div>
      )}
    </div>
    </>
  );
}
