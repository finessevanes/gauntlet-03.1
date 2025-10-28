/**
 * ErrorDialog Component
 * Displays error message in a modal dialog with action button
 */

import React from 'react';

interface ErrorDialogProps {
  message: string;
  onClose: () => void;
}

export const ErrorDialog: React.FC<ErrorDialogProps> = ({ message, onClose }) => {
  return (
    <div style={styles.overlay}>
      <div style={styles.dialog}>
        <div style={styles.iconContainer}>
          <span style={styles.icon}>⚠️</span>
        </div>
        <h2 style={styles.title}>Error</h2>
        <p style={styles.message}>{message}</p>
        <button style={styles.button} onClick={onClose}>
          OK
        </button>
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
    zIndex: 9999,
  },
  dialog: {
    backgroundColor: '#2a2a2a',
    borderRadius: '8px',
    padding: '32px',
    maxWidth: '400px',
    width: '90%',
    textAlign: 'center' as const,
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
  },
  iconContainer: {
    marginBottom: '16px',
  },
  icon: {
    fontSize: '48px',
  },
  title: {
    margin: '0 0 16px 0',
    fontSize: '20px',
    fontWeight: 'bold' as const,
    color: '#ffffff',
  },
  message: {
    margin: '0 0 24px 0',
    fontSize: '14px',
    lineHeight: '1.5',
    color: '#cccccc',
  },
  button: {
    backgroundColor: '#007aff',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    padding: '10px 32px',
    fontSize: '14px',
    fontWeight: '500' as const,
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
};
