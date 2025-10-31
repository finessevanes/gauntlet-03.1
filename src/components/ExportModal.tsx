/**
 * ExportModal Component (Story 7: Export to MP4)
 * Displays export progress with percentage, estimated time, and cancel button
 */

import React from 'react';

interface ExportModalProps {
  isOpen: boolean;
  onCancel: () => void;
  progress: {
    percentComplete: number;
    estimatedTimeRemaining: number; // in seconds
    errorMessage?: string;
  };
  status: 'validating' | 'exporting' | 'error' | 'complete';
  outputPath?: string; // Path to the exported file (shown when complete)
}

/**
 * Format seconds into HH:MM:SS or MM:SS format
 */
function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) {
    return '--:--';
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export default function ExportModal({
  isOpen,
  onCancel,
  progress,
  status,
  outputPath,
}: ExportModalProps): JSX.Element | null {
  if (!isOpen) return null;

  const { percentComplete, estimatedTimeRemaining, errorMessage } = progress;

  // Determine modal title based on status
  let title = 'Exporting...';
  if (status === 'validating') {
    title = 'Validating...';
  } else if (status === 'error') {
    title = 'Export Error';
  } else if (status === 'complete') {
    title = 'Export Complete';
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        {/* Title */}
        <h2 style={styles.title}>{title}</h2>

        {/* Progress Bar (only show if not error) */}
        {status !== 'error' && (
          <div style={styles.progressContainer}>
            <div style={styles.progressBarBackground}>
              <div
                style={{
                  ...styles.progressBarFill,
                  width: `${Math.min(percentComplete, 100)}%`,
                }}
              />
            </div>
            <p style={styles.percentText}>
              {Math.round(percentComplete)}% complete
            </p>
          </div>
        )}

        {/* Estimated Time Remaining (only show if exporting) */}
        {status === 'exporting' && estimatedTimeRemaining > 0 && (
          <p style={styles.timeRemaining}>
            {formatTime(estimatedTimeRemaining)} remaining
          </p>
        )}

        {/* Error Message (only show if error) */}
        {status === 'error' && errorMessage && (
          <p style={styles.errorMessage}>{errorMessage}</p>
        )}

        {/* File Location (show whenever outputPath is available) */}
        {outputPath && (
          <div style={styles.fileLocationContainer}>
            <p style={styles.fileLocationLabel}>
              {status === 'complete' ? 'Saved to:' : 'Saving to:'}
            </p>
            <p style={styles.fileLocationPath}>{outputPath}</p>
          </div>
        )}

        {/* Cancel/Close Button */}
        <button
          onClick={onCancel}
          style={styles.cancelButton}
          disabled={status === 'validating'}
        >
          {status === 'error' || status === 'complete' ? 'Close' : 'Cancel'}
        </button>
      </div>
    </div>
  );
}

/**
 * Inline styles for ExportModal
 */
const styles: { [key: string]: React.CSSProperties } = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  modal: {
    backgroundColor: '#1e1e1e',
    borderRadius: '8px',
    padding: '32px',
    minWidth: '500px',
    maxWidth: '600px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  title: {
    margin: 0,
    fontSize: '24px',
    fontWeight: 600,
    color: '#ffffff',
    textAlign: 'center',
  },
  progressContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  progressBarBackground: {
    width: '100%',
    height: '24px',
    backgroundColor: '#2a2a2a',
    borderRadius: '12px',
    overflow: 'hidden',
    border: '1px solid #3a3a3a',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#4a9eff',
    transition: 'width 0.3s ease',
    borderRadius: '12px',
  },
  percentText: {
    margin: 0,
    fontSize: '16px',
    color: '#b0b0b0',
    textAlign: 'center',
  },
  timeRemaining: {
    margin: 0,
    fontSize: '18px',
    color: '#ffffff',
    textAlign: 'center',
    fontWeight: 500,
  },
  errorMessage: {
    margin: 0,
    fontSize: '16px',
    color: '#ff6b6b',
    textAlign: 'center',
    padding: '16px',
    backgroundColor: '#2a1a1a',
    borderRadius: '4px',
    border: '1px solid #4a2a2a',
  },
  fileLocationContainer: {
    backgroundColor: '#2a2a2a',
    padding: '16px',
    borderRadius: '6px',
    border: '1px solid #3a3a3a',
  },
  fileLocationLabel: {
    margin: '0 0 8px 0',
    fontSize: '14px',
    color: '#b0b0b0',
    fontWeight: 500,
    textTransform: 'uppercase',
  },
  fileLocationPath: {
    margin: 0,
    fontSize: '13px',
    color: '#4a9eff',
    wordBreak: 'break-all',
    fontFamily: 'monospace',
  },
  cancelButton: {
    padding: '12px 24px',
    fontSize: '16px',
    fontWeight: 600,
    backgroundColor: '#d9534f',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    alignSelf: 'center',
    minWidth: '120px',
  },
};

// Add hover effect for cancel button
if (typeof window !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = `
    button[style*="background-color: rgb(217, 83, 79)"]:hover:not(:disabled) {
      background-color: #c9302c !important;
    }
    button[style*="background-color: rgb(217, 83, 79)"]:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `;
  document.head.appendChild(styleSheet);
}
