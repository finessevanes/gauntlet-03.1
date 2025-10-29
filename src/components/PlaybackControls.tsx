/**
 * PlaybackControls Component
 * Provides play/pause button, seek bar, and timecode display for previews
 */

import React, { useMemo } from 'react';
import { formatDuration } from '../utils/timecode';

interface PlaybackControlsProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onPlayPause: () => void;
  onSeek: (timeInSeconds: number) => void;
}

export const PlaybackControls: React.FC<PlaybackControlsProps> = ({
  isPlaying,
  currentTime,
  duration,
  onPlayPause,
  onSeek,
}) => {
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const clampedTime = Math.min(Math.max(currentTime, 0), safeDuration);

  const percent = safeDuration === 0 ? 0 : (clampedTime / safeDuration) * 100;

  const formattedTimecode = useMemo(() => {
    const formattedCurrent = formatDuration(clampedTime);
    const formattedTotal = formatDuration(safeDuration);
    return `${formattedCurrent} / ${formattedTotal}`;
  }, [clampedTime, safeDuration]);

  const handleRangeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(event.target.value);
    if (!Number.isNaN(value)) {
      onSeek(value);
    }
  };

  return (
    <div style={styles.container}>
      <button
        type="button"
        onClick={onPlayPause}
        style={{
          ...styles.playButton,
          opacity: safeDuration === 0 ? 0.4 : 1,
          cursor: safeDuration === 0 ? 'not-allowed' : 'pointer',
        }}
        disabled={safeDuration === 0}
        aria-label={isPlaying ? 'Pause preview' : 'Play preview'}
      >
        {isPlaying ? '⏸' : '▶'}
      </button>

      <div style={styles.seekBarWrapper}>
        <input
          type="range"
          min={0}
          max={safeDuration}
          step={0.01}
          value={clampedTime}
          onChange={handleRangeChange}
          style={styles.seekBar}
          disabled={safeDuration === 0}
          aria-label="Seek preview position"
        />
        <div style={{ ...styles.seekProgress, width: `${percent}%` }} />
      </div>

      <div style={styles.timecode}>{formattedTimecode}</div>
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '12px 16px',
    backgroundColor: '#141414',
    borderTop: '1px solid #232323',
  },
  playButton: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    border: 'none',
    backgroundColor: '#2f2f2f',
    color: '#fff',
    fontSize: '18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background-color 0.2s',
  },
  seekBarWrapper: {
    position: 'relative' as const,
    flex: 1,
    height: '12px',
    display: 'flex',
    alignItems: 'center',
    backgroundColor: '#2e2e2e',
    borderRadius: '2px',
  },
  seekBar: {
    appearance: 'none' as const,
    width: '100%',
    height: '4px',
    background: 'transparent',
    borderRadius: '2px',
    outline: 'none',
    cursor: 'pointer',
  },
  seekProgress: {
    position: 'absolute' as const,
    height: '4px',
    backgroundColor: '#4a9eff',
    borderRadius: '2px',
    pointerEvents: 'none' as const,
  },
  timecode: {
    minWidth: '100px',
    textAlign: 'right' as const,
    fontFamily: 'monospace',
    fontSize: '12px',
    color: '#a0a0a0',
  },
};
