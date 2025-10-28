/**
 * BrokenFileIcon Component
 * Visual indicator for clips with missing source files
 */

import React from 'react';

interface BrokenFileIconProps {
  tooltip: string; // Error message to display on hover
}

export const BrokenFileIcon: React.FC<BrokenFileIconProps> = ({ tooltip }) => {
  return (
    <div style={styles.container} title={tooltip}>
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Circle background */}
        <circle cx="8" cy="8" r="8" fill="#ff4444" />
        {/* X mark */}
        <path
          d="M5 5L11 11M11 5L5 11"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
};

const styles = {
  container: {
    position: 'absolute' as const,
    top: '8px',
    left: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    borderRadius: '50%',
    width: '24px',
    height: '24px',
    cursor: 'help',
    zIndex: 10,
  },
};
