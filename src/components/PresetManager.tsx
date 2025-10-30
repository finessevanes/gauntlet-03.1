/**
 * PresetManager Component (Story 14: Advanced Export Options)
 * Manages custom export presets (create, edit, delete)
 */

import React, { useState } from 'react';
import { ExportPreset } from '../types/export';
import CustomPresetForm from './CustomPresetForm';

interface PresetManagerProps {
  isOpen: boolean;
  presets: ExportPreset[];
  onClose: () => void;
  onSave: (preset: ExportPreset) => Promise<{ success: boolean; error?: string }>;
  onDelete: (presetId: string) => Promise<{ success: boolean; error?: string }>;
  onRefresh: () => Promise<void>;
}

export default function PresetManager({
  isOpen,
  presets,
  onClose,
  onSave,
  onDelete,
  onRefresh,
}: PresetManagerProps): JSX.Element | null {
  const [showForm, setShowForm] = useState(false);
  const [editingPreset, setEditingPreset] = useState<ExportPreset | undefined>(undefined);
  const [deletingPresetId, setDeletingPresetId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  const customPresets = presets.filter(p => p.category === 'custom');

  const handleCreateNew = () => {
    setEditingPreset(undefined);
    setShowForm(true);
    setMessage(null);
  };

  const handleEdit = (preset: ExportPreset) => {
    setEditingPreset(preset);
    setShowForm(true);
    setMessage(null);
  };

  const handleDeleteClick = (presetId: string) => {
    setDeletingPresetId(presetId);
  };

  const handleConfirmDelete = async () => {
    if (!deletingPresetId) return;

    const result = await onDelete(deletingPresetId);
    setDeletingPresetId(null);

    if (result.success) {
      setMessage({ type: 'success', text: 'Preset deleted successfully' });
      await onRefresh();
      // Clear message after 3 seconds
      setTimeout(() => setMessage(null), 3000);
    } else {
      setMessage({ type: 'error', text: result.error || 'Failed to delete preset' });
    }
  };

  const handleCancelDelete = () => {
    setDeletingPresetId(null);
  };

  const handleSavePreset = async (preset: ExportPreset) => {
    const result = await onSave(preset);

    if (result.success) {
      setShowForm(false);
      setEditingPreset(undefined);
      setMessage({
        type: 'success',
        text: editingPreset ? 'Preset updated successfully' : 'Preset created successfully',
      });
      await onRefresh();
      // Clear message after 3 seconds
      setTimeout(() => setMessage(null), 3000);
    }

    return result;
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingPreset(undefined);
  };

  const deletingPreset = presets.find(p => p.id === deletingPresetId);

  return (
    <>
      <div style={styles.overlay}>
        <div style={styles.modal}>
          {/* Title */}
          <div style={styles.header}>
            <h2 style={styles.title}>Manage Custom Presets</h2>
            <button onClick={handleCreateNew} style={styles.createButton}>
              + Create New
            </button>
          </div>

          {/* Success/Error Message */}
          {message && (
            <div
              style={{
                ...styles.messageBox,
                ...(message.type === 'success' ? styles.successBox : styles.errorBox),
              }}
            >
              {message.text}
            </div>
          )}

          {/* Preset List */}
          <div style={styles.presetList}>
            {customPresets.length === 0 ? (
              <div style={styles.emptyState}>
                <p style={styles.emptyText}>No custom presets yet</p>
                <p style={styles.emptySubtext}>Create one to get started</p>
              </div>
            ) : (
              customPresets.map((preset) => (
                <div key={preset.id} style={styles.presetItem}>
                  <div style={styles.presetInfo}>
                    <h3 style={styles.presetName}>{preset.name}</h3>
                    <div style={styles.presetDetails}>
                      <span style={styles.presetDetail}>
                        {preset.resolution.width}×{preset.resolution.height}
                      </span>
                      <span style={styles.presetDetail}>{preset.frameRate} fps</span>
                      <span style={styles.presetDetail}>{preset.bitrate} Mbps</span>
                    </div>
                  </div>
                  <div style={styles.presetActions}>
                    <button onClick={() => handleEdit(preset)} style={styles.editButton}>
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteClick(preset.id)}
                      style={styles.deleteButton}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Close Button */}
          <div style={styles.footer}>
            <button onClick={onClose} style={styles.closeButton}>
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {deletingPresetId && deletingPreset && (
        <div style={styles.overlay}>
          <div style={styles.confirmModal}>
            <h3 style={styles.confirmTitle}>Delete Preset?</h3>
            <p style={styles.confirmMessage}>
              Are you sure you want to delete "<strong>{deletingPreset.name}</strong>"?
              This action cannot be undone.
            </p>
            <div style={styles.confirmButtons}>
              <button onClick={handleCancelDelete} style={styles.cancelButton}>
                Cancel
              </button>
              <button onClick={handleConfirmDelete} style={styles.confirmDeleteButton}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Preset Form */}
      {showForm && (
        <CustomPresetForm
          isOpen={showForm}
          existingPreset={editingPreset}
          existingPresets={presets}
          onSave={handleSavePreset}
          onCancel={handleCancelForm}
        />
      )}
    </>
  );
}

/**
 * Inline styles for PresetManager
 */
const styles: { [key: string]: React.CSSProperties } = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10000,
  },
  modal: {
    backgroundColor: '#121212',
    borderRadius: '12px',
    padding: '32px',
    width: '600px',
    maxHeight: '90vh',
    overflowY: 'auto',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    margin: 0,
    fontSize: '24px',
    fontWeight: 700,
    color: '#ffffff',
  },
  createButton: {
    padding: '10px 16px',
    fontSize: '14px',
    fontWeight: 600,
    backgroundColor: '#00d4ff',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  messageBox: {
    padding: '12px 16px',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: 500,
  },
  successBox: {
    backgroundColor: '#1a4a1a',
    border: '2px solid #4caf50',
    color: '#4caf50',
  },
  errorBox: {
    backgroundColor: '#4a1a1a',
    border: '2px solid #ff6b6b',
    color: '#ff6b6b',
  },
  presetList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    minHeight: '200px',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px',
    gap: '8px',
  },
  emptyText: {
    margin: 0,
    fontSize: '18px',
    color: '#8a8a8a',
    fontWeight: 500,
  },
  emptySubtext: {
    margin: 0,
    fontSize: '14px',
    color: '#6a6a6a',
  },
  presetItem: {
    backgroundColor: '#1a1a1a',
    borderRadius: '8px',
    padding: '16px',
    border: '2px solid #2a2a2a',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '16px',
  },
  presetInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    flex: 1,
  },
  presetName: {
    margin: 0,
    fontSize: '16px',
    fontWeight: 600,
    color: '#ffffff',
  },
  presetDetails: {
    display: 'flex',
    gap: '12px',
  },
  presetDetail: {
    fontSize: '13px',
    color: '#b0b0b0',
    fontFamily: 'monospace',
  },
  presetActions: {
    display: 'flex',
    gap: '8px',
  },
  editButton: {
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: 600,
    backgroundColor: '#4a4a4a',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  deleteButton: {
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: 600,
    backgroundColor: '#6a2a2a',
    color: '#ff6b6b',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    paddingTop: '16px',
    borderTop: '1px solid #2a2a2a',
  },
  closeButton: {
    padding: '12px 24px',
    fontSize: '14px',
    fontWeight: 600,
    backgroundColor: '#4a4a4a',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  confirmModal: {
    backgroundColor: '#121212',
    borderRadius: '12px',
    padding: '32px',
    width: '400px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  confirmTitle: {
    margin: 0,
    fontSize: '20px',
    fontWeight: 700,
    color: '#ff6b6b',
  },
  confirmMessage: {
    margin: 0,
    fontSize: '14px',
    color: '#b0b0b0',
    lineHeight: 1.6,
  },
  confirmButtons: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end',
  },
  cancelButton: {
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: 600,
    backgroundColor: '#4a4a4a',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  confirmDeleteButton: {
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: 600,
    backgroundColor: '#d9534f',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
};
