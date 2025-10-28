/**
 * LoadingSpinner Component
 * Reusable spinner for import operations
 */

import React from 'react';

interface LoadingSpinnerProps {
  filename: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ filename }) => {
  return (
    <div style={styles.container}>
      <div style={styles.spinner}></div>
      <div style={styles.text}>Importing {filename}...</div>
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 16px',
    backgroundColor: '#2a2a2a',
    borderRadius: '4px',
    marginBottom: '8px',
  },
  spinner: {
    width: '16px',
    height: '16px',
    border: '2px solid #666',
    borderTop: '2px solid #fff',
    borderRadius: '50%',
    marginRight: '12px',
    animation: 'spin 0.8s linear infinite',
  } as React.CSSProperties,
  text: {
    fontSize: '13px',
    color: '#999',
  },
};

// Inject keyframe animation (done once globally)
if (typeof document !== 'undefined') {
  const styleSheet = document.styleSheets[0];
  if (styleSheet) {
    try {
      styleSheet.insertRule(`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `, styleSheet.cssRules.length);
    } catch (e) {
      // Animation already exists
    }
  }
}
