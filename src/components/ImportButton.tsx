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
      title="Import video files"
    >
      <span style={{ fontSize: '14px' }}>⊕</span>
      Import
    </button>
  );
};

const styles = {
  button: {
    backgroundColor: '#4a9eff',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    height: '32px',
  },
  disabled: {
    backgroundColor: '#555',
    cursor: 'not-allowed',
    opacity: 0.5,
  },
};
