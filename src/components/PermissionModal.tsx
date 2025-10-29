/**
 * Global Permission Modal
 * Shared modal for all permission errors across Screen, Webcam, and PiP recording
 * Used with PermissionContext to manage permission requests globally
 */

import React from 'react';
import { usePermissionModal } from '../context/PermissionContext';

export const PermissionModal: React.FC = () => {
  const { isOpen, permissionType, errorMessage, closePermissionModal, handleRetry } =
    usePermissionModal();

  if (!isOpen || !permissionType) {
    return null;
  }

  // Determine title based on permission type
  const getTitleAndIcon = () => {
    switch (permissionType) {
      case 'screen':
        return { title: 'Screen Recording Permission Needed', icon: '📺' };
      case 'camera':
        return { title: 'Camera Permission Needed', icon: '📹' };
      case 'microphone':
        return { title: 'Microphone Permission Needed', icon: '🎤' };
      default:
        return { title: 'Permission Needed', icon: '🔒' };
    }
  };

  const { title, icon } = getTitleAndIcon();

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.titleContainer}>
            <span style={styles.icon}>{icon}</span>
            <h2 style={styles.title}>{title}</h2>
          </div>
          <button style={styles.closeButton} onClick={closePermissionModal}>
            ×
          </button>
        </div>

        {/* Content */}
        <div style={styles.content}>
          <p style={styles.errorMessage}>{errorMessage}</p>
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <button style={styles.closeButtonFooter} onClick={closePermissionModal}>
            Cancel
          </button>
          <button style={styles.retryButton} onClick={handleRetry}>
            Retry
          </button>
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
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  modal: {
    backgroundColor: '#2c2c2c',
    borderRadius: '12px',
    width: '500px',
    maxWidth: '90vw',
    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.6)',
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '24px 20px',
    borderBottom: '1px solid #444',
    backgroundColor: '#1a1a1a',
  },
  titleContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flex: 1,
  },
  icon: {
    fontSize: '24px',
  },
  title: {
    fontSize: '18px',
    fontWeight: 'bold' as const,
    color: '#ffffff',
    margin: 0,
  },
  closeButton: {
    background: 'none',
    border: 'none',
    color: '#ffffff',
    fontSize: '28px',
    cursor: 'pointer',
    padding: 0,
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: '-4px',
  },
  content: {
    padding: '24px 20px',
    flex: 1,
  },
  errorMessage: {
    fontSize: '14px',
    lineHeight: '1.6',
    color: '#e0e0e0',
    margin: 0,
    whiteSpace: 'pre-wrap' as const,
    wordWrap: 'break-word' as const,
  },
  footer: {
    display: 'flex',
    gap: '12px',
    padding: '16px 20px',
    borderTop: '1px solid #444',
    backgroundColor: '#1a1a1a',
    justifyContent: 'flex-end',
  },
  closeButtonFooter: {
    padding: '10px 24px',
    fontSize: '14px',
    fontWeight: '500' as const,
    border: '1px solid #555',
    borderRadius: '6px',
    backgroundColor: '#3a3a3a',
    color: '#ffffff',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  retryButton: {
    padding: '10px 24px',
    fontSize: '14px',
    fontWeight: '500' as const,
    border: 'none',
    borderRadius: '6px',
    backgroundColor: '#4a90e2',
    color: '#ffffff',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
};
