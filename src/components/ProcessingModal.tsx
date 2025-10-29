/**
 * ProcessingModal Component
 * Shows processing status for screen recording conversion
 * Story S9: Screen Recording
 */

import React from 'react';

interface ProcessingModalProps {
  isOpen: boolean;
  message?: string;
}

export const ProcessingModal: React.FC<ProcessingModalProps> = ({
  isOpen,
  message = 'Processing...',
}) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.spinner} />
        <p style={styles.message}>{message}</p>
      </div>
    </div>
  );
};

const styles = {
  overlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
  },
  modal: {
    backgroundColor: '#2c2c2c',
    borderRadius: '8px',
    padding: '40px',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '20px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid #444',
    borderTop: '4px solid #4a90e2',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  message: {
    color: '#ffffff',
    fontSize: '14px',
    margin: 0,
  },
};

// Add CSS keyframes for spinner animation
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
document.head.appendChild(styleSheet);
