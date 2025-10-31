/**
 * LaneV2 Component
 * Renders a single lane (row of clips) within a track
 */

import React from 'react';
import type { Lane, Clip } from '../../types/timeline';
import { TimelineClipV2 } from './TimelineClipV2';

interface TrimPreview {
  clipId: string;
  edge: 'left' | 'right';
  deltaTicks: number;
}

interface DragPreview {
  clipId: string;
  deltaTicks: number;
}

interface LaneV2Props {
  lane: Lane;
  trackId: string;
  pixelsPerTick: number;
  selectedClipIds: string[];
  onClipSelect: (clipId: string) => void;
  onTrimStart?: (clipId: string, edge: 'left' | 'right', e?: React.MouseEvent) => void;
  onTrimEnd?: (clipId: string, e?: React.MouseEvent) => void;
  onDragStart?: (clipId: string, e?: React.MouseEvent) => void;
  onDragEnd?: (clipId: string, e?: React.MouseEvent) => void;
  trimPreview?: TrimPreview;
  dragPreview?: DragPreview;
}

export function LaneV2({
  lane,
  trackId,
  pixelsPerTick,
  selectedClipIds,
  onClipSelect,
  onTrimStart,
  onTrimEnd,
  onDragStart,
  onDragEnd,
  trimPreview,
  dragPreview,
}: LaneV2Props) {
  return (
    <div className="relative h-16 border-b border-gray-700">
      {lane.clips.map((clip) => (
        <TimelineClipV2
          key={clip.id}
          clip={clip}
          trackId={trackId}
          laneId={lane.id}
          pixelsPerTick={pixelsPerTick}
          isSelected={selectedClipIds.includes(clip.id)}
          onSelect={onClipSelect}
          onTrimStart={onTrimStart}
          onTrimEnd={onTrimEnd}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          trimPreview={
            trimPreview && trimPreview.clipId === clip.id ? trimPreview : undefined
          }
          dragPreview={
            dragPreview && dragPreview.clipId === clip.id ? dragPreview : undefined
          }
        />
      ))}
    </div>
  );
}
