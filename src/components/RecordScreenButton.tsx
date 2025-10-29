/**
 * RecordScreenButton Component
 * Button that opens the screen recording dialog
 * Story S9: Screen Recording
 */

import React from 'react';

interface RecordScreenButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

export const RecordScreenButton: React.FC<RecordScreenButtonProps> = ({
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
      title="Record Screen"
    >
      <span style={styles.icon}>●</span> Record Screen
    </button>
  );
};

const styles = {
  button: {
    backgroundColor: '#e74c3c',
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
    fontSize: '16px',
    lineHeight: '1',
  },
  disabled: {
    backgroundColor: '#555',
    cursor: 'not-allowed',
    opacity: 0.6,
  },
};
