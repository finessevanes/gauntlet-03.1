/**
 * ImportButton Component
 * Button that triggers the file picker for importing videos
 */

import React from 'react';

interface ImportButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

export const ImportButton: React.FC<ImportButtonProps> = ({ onClick, disabled = false }) => {
  return (
    <button
      style={{
        ...styles.button,
        ...(disabled ? styles.disabled : {}),
      }}
      onClick={onClick}
      disabled={disabled}
    >
      + Import
    </button>
  );
};

const styles = {
  button: {
    backgroundColor: '#4a90e2',
    color: '#ffffff',
    border: 'none',
    borderRadius: '4px',
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: 'bold' as const,
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  disabled: {
    backgroundColor: '#555',
    cursor: 'not-allowed',
    opacity: 0.6,
  },
};
