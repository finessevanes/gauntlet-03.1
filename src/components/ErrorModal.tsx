/**
 * ErrorModal Component
 * Shows error messages for invalid files
 */

import React, { useEffect } from 'react';

interface ErrorModalProps {
  title: string;
  message: string;
  details?: string;
  onClose: () => void;
}

export const ErrorModal: React.FC<ErrorModalProps> = ({ title, message, details, onClose }) => {
  // Auto-close after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <span style={styles.errorIcon}>⚠️</span>
          <h2 style={styles.title}>{title}</h2>
          <button onClick={onClose} style={styles.closeButton}>×</button>
        </div>

        <div style={styles.content}>
          <p style={styles.message}>{message}</p>
          {details && <p style={styles.details}>{details}</p>}
        </div>
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
  },
  modal: {
    backgroundColor: '#2a2a2a',
    borderRadius: '8px',
    padding: '24px',
    minWidth: '400px',
    maxWidth: '500px',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '16px',
  },
  errorIcon: {
    fontSize: '24px',
  },
  title: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 'bold' as const,
    color: '#f44336',
    flex: 1,
  },
  closeButton: {
    background: 'none',
    border: 'none',
    color: '#999',
    fontSize: '28px',
    cursor: 'pointer',
    padding: '0',
    width: '28px',
    height: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1,
  },
  content: {
    color: '#ffffff',
  },
  message: {
    fontSize: '14px',
    margin: '0 0 8px 0',
    lineHeight: 1.5,
  },
  details: {
    fontSize: '12px',
    color: '#999',
    margin: 0,
    lineHeight: 1.5,
  },
};
