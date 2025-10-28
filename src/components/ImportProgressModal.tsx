/**
 * ImportProgressModal Component
 * Shows progress when importing multiple files
 */

import React, { useEffect, useState } from 'react';

export interface ImportProgress {
  id: string;
  filename: string;
  status: 'importing' | 'completed' | 'error';
  error?: string;
}

interface ImportProgressModalProps {
  files: ImportProgress[];
  onClose: () => void;
}

export const ImportProgressModal: React.FC<ImportProgressModalProps> = ({ files, onClose }) => {
  const [autoClosing, setAutoClosing] = useState(false);

  const totalFiles = files.length;
  const completedFiles = files.filter(f => f.status === 'completed' || f.status === 'error').length;
  const isComplete = completedFiles === totalFiles && totalFiles > 0;
  const progressPercent = totalFiles > 0 ? (completedFiles / totalFiles) * 100 : 0;

  // Auto-close when all files are done (after 1.5 seconds)
  useEffect(() => {
    if (isComplete && !autoClosing) {
      setAutoClosing(true);
      const timer = setTimeout(() => {
        onClose();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isComplete, autoClosing, onClose]);

  if (files.length === 0) return null;

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <h2 style={styles.title}>
            {isComplete ? 'Import Complete' : `Importing ${completedFiles + 1} of ${totalFiles}...`}
          </h2>
          {isComplete && (
            <button onClick={onClose} style={styles.closeButton}>×</button>
          )}
        </div>

        {/* Progress Bar */}
        <div style={styles.progressBarContainer}>
          <div style={{ ...styles.progressBar, width: `${progressPercent}%` }} />
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
    display: 'flex',
    flexDirection: 'column' as const,
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  title: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 'bold' as const,
    color: '#ffffff',
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
  progressBarContainer: {
    width: '100%',
    height: '8px',
    backgroundColor: '#444',
    borderRadius: '4px',
    overflow: 'hidden',
    marginBottom: '16px',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#4CAF50',
    transition: 'width 0.3s ease',
  },
};
