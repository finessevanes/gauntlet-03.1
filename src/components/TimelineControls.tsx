/**
 * TimelineControls Component
 * Displays timecode, zoom slider, and play/pause controls (Story 6)
 */

import React from 'react';
import { formatTimecode } from '../utils/timecode';

interface TimelineControlsProps {
  playheadPosition: number;       // Current playhead position in seconds
  timelineDuration: number;       // Total timeline duration in seconds
  zoomLevel: number;              // Current zoom level (100-1000)
  onZoomChange: (zoom: number | 'auto') => void;
  isPlaying: boolean;
  canPlay: boolean;
  onTogglePlay: () => void;
}

export const TimelineControls: React.FC<TimelineControlsProps> = ({
  playheadPosition,
  timelineDuration,
  zoomLevel,
  onZoomChange,
  isPlaying,
  canPlay,
  onTogglePlay,
}) => {
  const handleZoomSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    onZoomChange(value);
  };

  const handleAutoFitClick = () => {
    onZoomChange('auto');
  };

  return (
    <div style={styles.container}>
      {/* Timecode Display */}
      <div style={styles.timecodeSection}>
        <span style={styles.timecode}>
          {formatTimecode(playheadPosition)} / {formatTimecode(timelineDuration)}
        </span>
      </div>

      {/* Zoom Controls */}
      <div style={styles.zoomSection}>
        <button
          onClick={handleAutoFitClick}
          style={styles.autoFitButton}
          title="Auto-fit timeline to window"
        >
          Auto-fit
        </button>
        <input
          type="range"
          min="100"
          max="1000"
          step="50"
          value={zoomLevel}
          onChange={handleZoomSliderChange}
          style={styles.zoomSlider}
          title={`Zoom: ${zoomLevel}%`}
        />
        <span style={styles.zoomLabel}>{zoomLevel}%</span>
      </div>

      {/* Placeholder for Play/Pause (Story 6) */}
      <div style={styles.playbackSection}>
        <button
          onClick={onTogglePlay}
          disabled={!canPlay}
          style={{
            ...styles.playButton,
            cursor: canPlay ? 'pointer' : 'not-allowed',
            opacity: canPlay ? 1 : 0.4,
            backgroundColor: isPlaying ? '#4a9eff' : '#3a3a3a',
            color: isPlaying ? '#0d0d0d' : '#fff',
          }}
          title={canPlay ? (isPlaying ? 'Pause timeline preview' : 'Play timeline preview') : 'Add clips to enable playback'}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>
      </div>
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 16px',
    backgroundColor: '#2a2a2a',
    borderBottom: '1px solid #333',
    fontSize: '12px',
    color: '#ccc',
  },
  timecodeSection: {
    flex: '0 0 auto',
    fontFamily: 'monospace',
    fontSize: '13px',
  },
  timecode: {
    color: '#4a9eff',
    fontWeight: 'bold' as const,
  },
  zoomSection: {
    flex: '1 1 auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
  },
  autoFitButton: {
    padding: '4px 12px',
    backgroundColor: '#3a3a3a',
    border: '1px solid #555',
    borderRadius: '4px',
    color: '#ccc',
    fontSize: '11px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  zoomSlider: {
    width: '200px',
    cursor: 'pointer',
  },
  zoomLabel: {
    minWidth: '50px',
    textAlign: 'right' as const,
    color: '#999',
  },
  playbackSection: {
    flex: '0 0 auto',
  },
  playButton: {
    padding: '6px 12px',
    backgroundColor: '#3a3a3a',
    border: '1px solid #555',
    borderRadius: '4px',
    color: '#fff',
    fontSize: '14px',
    transition: 'background-color 0.2s',
  },
};
