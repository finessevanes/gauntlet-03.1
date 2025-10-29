/**
 * RecordWebcamButton Component
 * Button that opens the webcam recording modal
 * Story S10: Webcam Recording
 */

import React from 'react';

interface RecordWebcamButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

export const RecordWebcamButton: React.FC<RecordWebcamButtonProps> = ({
  onClick,
  disabled = false,
}) => {
  return (
    <button
      style={{
        ...styles.button,
        ...(disabled ? styles.disabled : {}),
      }}
      onClick={onClick}
      disabled={disabled}
      title="Record Webcam"
    >
      <span style={styles.icon}>📹</span> Record Webcam
    </button>
  );
};

const styles = {
  button: {
    backgroundColor: '#9b59b6',
    color: '#ffffff',
    border: 'none',
    borderRadius: '4px',
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: 'bold' as const,
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  icon: {
    fontSize: '14px',
    lineHeight: '1',
  },
  disabled: {
    backgroundColor: '#555',
    cursor: 'not-allowed',
    opacity: 0.6,
  },
};
