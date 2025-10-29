/**
 * RecordingIndicator Component
 * Shows recording status with pulsing red dot, timer, and stop button
 * Story S9: Screen Recording
 */

import React, { useEffect, useState } from 'react';

interface RecordingIndicatorProps {
  onStop: () => void;
  isStopping?: boolean;
}

export const RecordingIndicator: React.FC<RecordingIndicatorProps> = ({ onStop, isStopping = false }) => {
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  useEffect(() => {
    // Timer to update elapsed time every second
    // Only run the timer if not stopping
    if (isStopping) {
      return;
    }

    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [isStopping]);

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <div style={styles.dotContainer}>
          <div style={styles.dot} />
        </div>
        <div style={styles.timer}>{formatTime(elapsedSeconds)}</div>
        <button
          style={{
            ...styles.stopButton,
            ...(isStopping ? styles.stopButtonDisabled : {}),
          }}
          onClick={onStop}
          disabled={isStopping}
          title={isStopping ? 'Processing...' : 'Stop Recording'}
        >
          {isStopping ? '...' : '■'}
        </button>
      </div>
      <style>{keyframesCSS}</style>
    </div>
  );
};

// CSS keyframes for pulsing animation
const keyframesCSS = `
  @keyframes pulse {
    0%, 100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.6;
      transform: scale(1.1);
    }
  }
`;

const styles = {
  container: {
    position: 'fixed' as const,
    top: '16px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 1000,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: '8px',
    padding: '8px 16px',
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.3)',
  },
  content: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  dotContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    backgroundColor: '#e74c3c',
    animation: 'pulse 1s ease-in-out infinite',
  },
  timer: {
    color: '#ffffff',
    fontSize: '16px',
    fontWeight: 'bold' as const,
    fontFamily: 'monospace',
    minWidth: '80px',
  },
  stopButton: {
    backgroundColor: '#e74c3c',
    color: '#ffffff',
    border: 'none',
    borderRadius: '4px',
    padding: '6px 12px',
    fontSize: '16px',
    fontWeight: 'bold' as const,
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  stopButtonDisabled: {
    backgroundColor: '#666666',
    cursor: 'not-allowed',
    opacity: 0.6,
  },
};
