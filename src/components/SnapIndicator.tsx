/**
 * SnapIndicator Component (Story 13: Split & Advanced Trim)
 * Visual feedback showing snap point alignment during trim drag
 */

import React from 'react';

interface SnapIndicatorProps {
  x: number;                    // X position in pixels (left offset from timeline start)
  visible: boolean;             // Whether to show the indicator
  isSnapped: boolean;           // Whether currently snapped to a point
  timelineHeight?: number;      // Height of timeline (default: 100)
}

export const SnapIndicator: React.FC<SnapIndicatorProps> = ({
  x,
  visible,
  isSnapped,
  timelineHeight = 100,
}) => {
  if (!visible) {
    return null;
  }

  const color = isSnapped ? '#22c55e' : '#888888'; // Green when snapped, gray otherwise

  return (
    <div
      style={{
        ...styles.indicator,
        left: `${x}px`,
        backgroundColor: color,
        height: `${timelineHeight}px`,
      }}
      className="snap-indicator"
      title={isSnapped ? 'Snapped to grid' : 'Near snap point'}
    />
  );
};

const styles = {
  indicator: {
    position: 'absolute' as const,
    top: 0,
    width: '2px',
    pointerEvents: 'none' as const,
    zIndex: 100,
    transition: 'background-color 0.1s ease-out',
    boxShadow: '0 0 4px rgba(34, 197, 94, 0.5)',
  },
};

