/**
 * Toast Component
 * Error/success notification display
 */

import React, { useEffect } from 'react';

interface ToastProps {
  message: string;
  type: 'error' | 'success';
  onDismiss: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, type, onDismiss }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss();
    }, 5000); // Auto-dismiss after 5 seconds

    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div style={{...styles.container, ...(type === 'error' ? styles.error : styles.success)}}>
      <span style={styles.icon}>{type === 'error' ? '⚠️' : '✅'}</span>
      <span style={styles.message}>{message}</span>
      <button style={styles.closeButton} onClick={onDismiss}>×</button>
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 16px',
    borderRadius: '4px',
    marginBottom: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
  },
  error: {
    backgroundColor: '#d32f2f',
    color: '#fff',
  },
  success: {
    backgroundColor: '#388e3c',
    color: '#fff',
  },
  icon: {
    marginRight: '12px',
    fontSize: '16px',
  },
  message: {
    flex: 1,
    fontSize: '13px',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    color: '#fff',
    fontSize: '20px',
    cursor: 'pointer',
    padding: '0 4px',
    marginLeft: '8px',
    opacity: 0.8,
  },
};
