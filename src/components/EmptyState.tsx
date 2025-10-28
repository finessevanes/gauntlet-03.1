/**
 * EmptyState Component
 * Displays placeholder UI when Library or Timeline is empty
 */

import React from 'react';

interface EmptyStateProps {
  type: 'library' | 'timeline';
}

export const EmptyState: React.FC<EmptyStateProps> = ({ type }) => {
  const message = type === 'library'
    ? 'Drag & drop video files or click Import to get started'
    : 'Drag clips here to start editing';

  const icon = type === 'library' ? '📁' : '🎬';

  return (
    <div style={styles.container}>
      <div style={styles.icon}>{icon}</div>
      <p style={styles.message}>{message}</p>
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#666',
    textAlign: 'center' as const,
    padding: '20px',
  },
  icon: {
    fontSize: '48px',
    marginBottom: '16px',
    opacity: 0.5,
  },
  message: {
    fontSize: '14px',
    margin: 0,
    maxWidth: '300px',
  },
};
