/**
 * TimelineControls Component
 * Displays timecode, zoom slider, snap controls, and play/pause controls (Story 6, Story 13)
 */

import React from 'react';
import { formatTimecode } from '../utils/timecode';
import { useSessionStore } from '../store/sessionStore';

interface TimelineControlsProps {
  playheadPosition: number;       // Current playhead position in seconds
  timelineDuration: number;       // Total timeline duration in seconds
  zoomLevel: number;              // Current zoom level (100-1000)
  onZoomChange: (zoom: number | 'auto') => void;
}

export const TimelineControls: React.FC<TimelineControlsProps> = ({
  playheadPosition,
  timelineDuration,
  zoomLevel,
  onZoomChange,
}) => {
  // S13: Snap-to-grid controls
  const snapEnabled = useSessionStore((state) => state.snapEnabled);
  const snapMode = useSessionStore((state) => state.snapMode);
  const setSnapEnabled = useSessionStore((state) => state.setSnapEnabled);
  const setSnapMode = useSessionStore((state) => state.setSnapMode);
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

      {/* Snap Controls (S13) */}
      <div style={styles.snapSection}>
        <label style={styles.snapLabel}>
          <input
            type="checkbox"
            checked={snapEnabled}
            onChange={(e) => setSnapEnabled(e.target.checked)}
            style={styles.snapCheckbox}
            title="Enable snap-to-grid for precise edits"
          />
          Snap to Grid
        </label>
        {snapEnabled && (
          <select
            value={snapMode}
            onChange={(e) => setSnapMode(e.target.value as 'frame' | '500ms' | '1s')}
            style={styles.snapModeSelect}
            title="Snap grid interval"
          >
            <option value="frame">Frame-Precise</option>
            <option value="500ms">500ms</option>
            <option value="1s">1 Second</option>
          </select>
        )}
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
    gap: '20px',
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
  // S13: Snap controls styles
  snapSection: {
    flex: '0 0 auto',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  snapLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    color: '#ccc',
    fontSize: '11px',
    cursor: 'pointer',
    userSelect: 'none' as const,
  },
  snapCheckbox: {
    cursor: 'pointer',
    width: '14px',
    height: '14px',
  },
  snapModeSelect: {
    padding: '4px 8px',
    backgroundColor: '#3a3a3a',
    border: '1px solid #555',
    borderRadius: '4px',
    color: '#ccc',
    fontSize: '11px',
    cursor: 'pointer',
  },
  zoomSection: {
    flex: '0 0 auto',
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
    height: '6px',
    cursor: 'pointer',
    background: '#3a3a3a',
    outline: 'none',
    borderRadius: '3px',
    WebkitAppearance: 'none',
    appearance: 'none',
  },
  zoomLabel: {
    minWidth: '50px',
    textAlign: 'right' as const,
    color: '#999',
  },
};
