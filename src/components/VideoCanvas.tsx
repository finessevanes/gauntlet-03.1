/**
 * VideoCanvas Component
 * Renders the HTML5 video element with preview states (empty, error, buffering)
 */

import React from 'react';

interface VideoCanvasProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  isEmpty: boolean;
  isError: boolean;
  errorMessage?: string | null;
  isBuffering: boolean;
}

export const VideoCanvas: React.FC<VideoCanvasProps> = ({
  videoRef,
  isEmpty,
  isError,
  errorMessage,
  isBuffering,
}) => {
  const showOverlay = isEmpty || isError;

  return (
    <div style={styles.wrapper}>
      <video
        ref={videoRef}
        style={{
          ...styles.video,
          visibility: showOverlay ? 'hidden' : 'visible',
        }}
        controls={false}
        playsInline
        disablePictureInPicture
        preload="auto"
      />

      {isEmpty && (
        <div style={styles.overlay}>
          <p style={styles.emptyText}>No video to preview</p>
        </div>
      )}

      {isError && (
        <div style={styles.overlay}>
          <p style={styles.errorText}>{errorMessage ?? 'Cannot play source'}</p>
        </div>
      )}

      {isBuffering && !showOverlay && (
        <div style={styles.bufferingOverlay}>
          <div style={styles.spinner} />
          <p style={styles.bufferingText}>Buffering...</p>
        </div>
      )}
    </div>
  );
};

const styles = {
  wrapper: {
    position: 'relative' as const,
    width: '100%',
    flex: 1,
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  video: {
    position: 'absolute' as const,
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '100%',
    height: '100%',
    objectFit: 'contain' as const,
    objectPosition: 'center center',
    backgroundColor: '#000',
  },
  overlay: {
    position: 'absolute' as const,
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#888',
    textAlign: 'center' as const,
    padding: '0 24px',
    backgroundColor: '#000',
  },
  bufferingOverlay: {
    position: 'absolute' as const,
    inset: 0,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  spinner: {
    width: '42px',
    height: '42px',
    border: '4px solid rgba(255, 255, 255, 0.15)',
    borderTopColor: '#4a9eff',
    borderRadius: '50%',
    animation: 'preview-spin 1s linear infinite',
  },
  emptyText: {
    color: '#666',
    fontSize: '15px',
    margin: 0,
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: '14px',
    margin: 0,
  },
  bufferingText: {
    color: '#ccc',
    fontSize: '12px',
    letterSpacing: '0.04em',
    margin: 0,
    textTransform: 'uppercase' as const,
  },
};
