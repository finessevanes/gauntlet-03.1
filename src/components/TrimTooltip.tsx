/**
 * TrimTooltip Component
 * Shows trim feedback during edge drag (displays "Old → New" duration)
 */

import React from 'react';
import { formatDuration } from '../utils/timecode';

interface TrimTooltipProps {
  originalDuration: number;    // Original clip duration (before drag)
  newDuration: number;          // Current dragged duration
  position: { x: number; y: number }; // Cursor position
  visible: boolean;
  isExpanding?: boolean;        // Whether clip is expanding (untrimming)
}

export const TrimTooltip: React.FC<TrimTooltipProps> = ({
  originalDuration,
  newDuration,
  position,
  visible,
  isExpanding = false,
}) => {
  // Don't show tooltip during trim - removed per user request
  return null;
};

const styles = {
  tooltip: {
    position: 'fixed' as const,
    backgroundColor: '#2a2a2a',
    color: '#fff',
    padding: '6px 12px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 'bold' as const,
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.5)',
    zIndex: 10000, // Above everything
    pointerEvents: 'none' as const, // Don't interfere with drag
    whiteSpace: 'nowrap' as const,
  },
  tooltipExpanding: {
    backgroundColor: 'rgba(74, 158, 255, 0.2)', // Subtle blue background for expansion
    border: '1px solid rgba(74, 158, 255, 0.5)',
    boxShadow: '0 0 12px rgba(74, 158, 255, 0.3)',
  },
};
