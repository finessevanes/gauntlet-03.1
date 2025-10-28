/**
 * TimelineRuler Component
 * Displays time markers (0s, 5s, 10s, etc.) above the timeline
 */

import React, { useMemo } from 'react';
import { formatDuration, getPixelsPerSecond } from '../utils/timecode';

interface TimelineRulerProps {
  timelineDuration: number;  // Total duration in seconds
  zoomLevel: number;         // Zoom level (100-1000)
  containerWidth: number;    // Width of timeline container
  timelineWidth: number;     // Calculated timeline width (passed from parent)
  padding: number;           // Timeline horizontal padding (px)
}

export const TimelineRuler: React.FC<TimelineRulerProps> = ({
  timelineDuration,
  zoomLevel,
  containerWidth,
  timelineWidth,
  padding,
}) => {
  const pixelsPerSecond = getPixelsPerSecond(zoomLevel);

  // Calculate marker interval based on pixels per second to maintain consistent spacing
  // Target: show a marker roughly every 50-100 pixels for readability
  const markerInterval = useMemo(() => {
    const targetPixelSpacing = 80; // Ideal spacing between markers in pixels

    // Calculate how many seconds should be between markers
    const secondsPerMarker = targetPixelSpacing / pixelsPerSecond;

    // Round to nice intervals: 1, 2, 5, 10, 15, 30, 60, 120, 300, 600
    const niceIntervals = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600];

    // Find the closest nice interval that's >= secondsPerMarker
    for (const interval of niceIntervals) {
      if (interval >= secondsPerMarker) {
        return interval;
      }
    }

    // Default to 600 seconds (10 minutes) if timeline is very long
    return 600;
  }, [pixelsPerSecond]);

  // Generate time markers
  const markers = useMemo(() => {
    const result: { time: number; label: string; x: number }[] = [];

    for (let time = 0; time <= timelineDuration; time += markerInterval) {
      result.push({
        time,
        label: formatDuration(time),
        x: padding + (time * pixelsPerSecond), // Add padding offset
      });
    }

    return result;
  }, [timelineDuration, markerInterval, pixelsPerSecond, padding]);

  // Use the timeline width passed from parent to ensure ruler and timeline are in sync
  return (
    <div style={{ ...styles.container, width: `${timelineWidth}px` }}>
      {markers.map((marker) => (
        <div
          key={marker.time}
          style={{ ...styles.marker, left: `${marker.x}px` }}
        >
          <div style={styles.tick} />
          <span style={styles.label}>{marker.label}</span>
        </div>
      ))}
    </div>
  );
};

const styles = {
  container: {
    position: 'relative' as const,
    height: '24px',
    backgroundColor: '#2a2a2a',
    borderBottom: '1px solid #444',
  },
  marker: {
    position: 'absolute' as const,
    top: 0,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
  },
  tick: {
    width: '1px',
    height: '8px',
    backgroundColor: '#666',
  },
  label: {
    fontSize: '10px',
    color: '#999',
    marginTop: '2px',
    whiteSpace: 'nowrap' as const,
  },
};
