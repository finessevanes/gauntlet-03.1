/**
 * TrackV2 Component
 * Renders a track with header, lanes, and controls
 */

import React, { useState } from 'react';
import type { Track } from '../../types/timeline';
import { LaneV2 } from './LaneV2';

interface TrimPreview {
  clipId: string;
  edge: 'left' | 'right';
  deltaTicks: number;
}

interface DragPreview {
  clipId: string;
  deltaTicks: number;
}

interface TrackV2Props {
  track: Track;
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

export function TrackV2({
  track,
  pixelsPerTick,
  selectedClipIds,
  onClipSelect,
  onTrimStart,
  onTrimEnd,
  onDragStart,
  onDragEnd,
  trimPreview,
  dragPreview,
}: TrackV2Props) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Get track color based on type/role
  const getTrackColor = () => {
    if (track.color) return track.color;

    switch (track.type) {
      case 'video':
        return track.role === 'main' ? '#3B82F6' : '#8B5CF6'; // blue / purple
      case 'audio':
        return '#10B981'; // green
      default:
        return '#6B7280'; // gray
    }
  };

  const trackColor = getTrackColor();

  // Calculate total height
  const laneHeight = 64; // 16 * 4 (h-16 = 4rem = 64px)
  const headerHeight = 40;
  const totalHeight = isCollapsed
    ? headerHeight
    : headerHeight + track.lanes.length * laneHeight;

  return (
    <div className="border-b border-gray-800">
      {/* Track Header */}
      <div
        className="flex items-center h-10 border-b border-gray-700 bg-gray-800 sticky left-0 z-10"
        style={{ borderLeftColor: trackColor, borderLeftWidth: '4px' }}
      >
        {/* Collapse/Expand Button */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="px-2 hover:bg-gray-700 transition-colors"
        >
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>

        {/* Track Name */}
        <div className="flex items-center gap-2 px-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: trackColor }}
          />
          <span className="text-sm font-medium text-white">
            {track.name || track.id}
          </span>
          {track.role === 'main' && (
            <span className="text-xs text-gray-400 bg-gray-700 px-2 py-0.5 rounded">
              Main
            </span>
          )}
        </div>

        {/* Track Type Badge */}
        <div className="ml-auto px-2">
          <span className="text-xs text-gray-400 uppercase">
            {track.type}
          </span>
        </div>

        {/* Lock Indicator */}
        {track.locked && (
          <div className="px-2">
            <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        )}

        {/* Lane Count */}
        <div className="px-2 text-xs text-gray-500">
          {track.lanes.length} {track.lanes.length === 1 ? 'lane' : 'lanes'}
        </div>
      </div>

      {/* Lanes */}
      {!isCollapsed && (
        <div className="relative">
          {track.lanes.map((lane, index) => (
            <LaneV2
              key={lane.id}
              lane={lane}
              trackId={track.id}
              pixelsPerTick={pixelsPerTick}
              selectedClipIds={selectedClipIds}
              onClipSelect={onClipSelect}
              onTrimStart={onTrimStart}
              onTrimEnd={onTrimEnd}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              trimPreview={trimPreview}
              dragPreview={dragPreview}
            />
          ))}
        </div>
      )}
    </div>
  );
}
