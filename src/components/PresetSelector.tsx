/**
 * PresetSelector Component (Story 14: Advanced Export Options)
 * Displays available export presets and allows selection
 */

import React, { useState, useEffect } from 'react';
import { ExportPreset } from '../types/export';

interface PresetSelectorProps {
  isOpen: boolean;
  presets: ExportPreset[];
  sourceResolution: { width: number; height: number };
  defaultPresetId: string | null;
  onSelect: (preset: ExportPreset) => void;
  onCancel: () => void;
  onManagePresets: () => void;
  onSetDefault: (presetId: string | null) => void;
}

export default function PresetSelector({
  isOpen,
  presets,
  sourceResolution,
  defaultPresetId,
  onSelect,
  onCancel,
  onManagePresets,
  onSetDefault,
}: PresetSelectorProps): JSX.Element | null {
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(defaultPresetId);
  const [showUpscaleWarning, setShowUpscaleWarning] = useState(false);

  // Update selected preset when modal opens or default changes
  useEffect(() => {
    if (isOpen) {
      setSelectedPresetId(defaultPresetId);
      setShowUpscaleWarning(false);
    }
  }, [isOpen, defaultPresetId]);

  const handleSetAsDefault = (presetId: string) => {
    onSetDefault(presetId === defaultPresetId ? null : presetId);
  };

  if (!isOpen) return null;

  const selectedPreset = presets.find(p => p.id === selectedPresetId);

  // Check if preset requires upscaling
  const isUpscaling = (preset: ExportPreset): boolean => {
    return (
      preset.resolution.width > sourceResolution.width ||
      preset.resolution.height > sourceResolution.height
    );
  };

  const handlePresetClick = (preset: ExportPreset) => {
    setSelectedPresetId(preset.id);
    setShowUpscaleWarning(false);
  };

  const handleConfirm = () => {
    if (!selectedPreset) return;

    // Check for upscaling
    if (isUpscaling(selectedPreset)) {
      setShowUpscaleWarning(true);
    } else {
      onSelect(selectedPreset);
    }
  };

  const handleProceedWithUpscaling = () => {
    if (selectedPreset) {
      onSelect(selectedPreset);
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        {/* Title */}
        <h2 style={styles.title}>Select Export Preset</h2>
        <p style={styles.subtitle}>
          Choose a preset for your export or manage custom presets
        </p>

        {/* Preset Grid */}
        <div style={styles.presetGrid}>
          {presets.map((preset) => {
            const isSelected = selectedPresetId === preset.id;
            const needsUpscaling = isUpscaling(preset);

            return (
              <div
                key={preset.id}
                onClick={() => handlePresetClick(preset)}
                style={{
                  ...styles.presetCard,
                  ...(isSelected ? styles.presetCardSelected : {}),
                }}
              >
                {/* Preset Name */}
                <div style={styles.presetHeader}>
                  <div style={styles.presetNameRow}>
                    <h3 style={styles.presetName}>{preset.name}</h3>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSetAsDefault(preset.id);
                      }}
                      style={{
                        ...styles.starButton,
                        ...(preset.id === defaultPresetId ? styles.starButtonActive : {}),
                      }}
                      title={preset.id === defaultPresetId ? 'Remove as default' : 'Set as default'}
                    >
                      {preset.id === defaultPresetId ? '★' : '☆'}
                    </button>
                  </div>
                  <div style={styles.badgeRow}>
                    {preset.category === 'builtin' && (
                      <span style={styles.builtinBadge}>System</span>
                    )}
                    {preset.id === defaultPresetId && (
                      <span style={styles.defaultBadge}>Default</span>
                    )}
                  </div>
                </div>

                {/* Preset Details */}
                <div style={styles.presetDetails}>
                  <p style={styles.presetDetail}>
                    {preset.resolution.width} × {preset.resolution.height}
                  </p>
                  <p style={styles.presetDetail}>{preset.frameRate} fps</p>
                  <p style={styles.presetDetail}>{preset.bitrate} Mbps</p>
                </div>

                {/* Description */}
                {preset.description && (
                  <p style={styles.presetDescription}>{preset.description}</p>
                )}

                {/* Upscaling Warning */}
                {needsUpscaling && isSelected && (
                  <div style={styles.upscaleWarningSmall}>
                    ⚠ Upscaling from {sourceResolution.width}×{sourceResolution.height}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Upscaling Warning Modal */}
        {showUpscaleWarning && selectedPreset && (
          <div style={styles.warningBox}>
            <p style={styles.warningTitle}>⚠ Upscaling Warning</p>
            <p style={styles.warningMessage}>
              Source is {sourceResolution.width}×{sourceResolution.height}.
              Upscaling to {selectedPreset.resolution.width}×{selectedPreset.resolution.height} may reduce quality.
            </p>
            <div style={styles.warningButtons}>
              <button
                onClick={handleProceedWithUpscaling}
                style={styles.warningButtonProceed}
              >
                Proceed Anyway
              </button>
              <button
                onClick={() => setShowUpscaleWarning(false)}
                style={styles.warningButtonBack}
              >
                Choose Different Preset
              </button>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div style={styles.actionButtons}>
          <button onClick={onManagePresets} style={styles.manageButton}>
            Manage Custom Presets
          </button>
          <div style={styles.rightButtons}>
            <button onClick={onCancel} style={styles.cancelButton}>
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!selectedPresetId}
              style={{
                ...styles.confirmButton,
                ...(selectedPresetId ? {} : styles.confirmButtonDisabled),
              }}
            >
              Select
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Inline styles for PresetSelector
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
    zIndex: 9999,
  },
  modal: {
    backgroundColor: '#121212',
    borderRadius: '12px',
    padding: '32px',
    minWidth: '700px',
    maxWidth: '900px',
    maxHeight: '90vh',
    overflowY: 'auto',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  title: {
    margin: 0,
    fontSize: '28px',
    fontWeight: 700,
    color: '#ffffff',
  },
  subtitle: {
    margin: 0,
    fontSize: '14px',
    color: '#b0b0b0',
  },
  presetGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '16px',
  },
  presetCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: '8px',
    padding: '16px',
    border: '2px solid #2a2a2a',
    cursor: 'pointer',
    transition: 'all 0.2s',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  presetCardSelected: {
    borderColor: '#00d4ff',
    backgroundColor: '#2a3a4a',
  },
  presetHeader: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  presetNameRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '8px',
  },
  presetName: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 600,
    color: '#ffffff',
    flex: 1,
  },
  starButton: {
    background: 'none',
    border: 'none',
    fontSize: '20px',
    color: '#6a6a6a',
    cursor: 'pointer',
    padding: '4px',
    lineHeight: 1,
    transition: 'color 0.2s',
  },
  starButtonActive: {
    color: '#ffaa00',
  },
  badgeRow: {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap',
  },
  builtinBadge: {
    fontSize: '10px',
    fontWeight: 600,
    textTransform: 'uppercase',
    color: '#8a8a8a',
    backgroundColor: '#2a2a2a',
    padding: '4px 8px',
    borderRadius: '4px',
  },
  defaultBadge: {
    fontSize: '10px',
    fontWeight: 600,
    textTransform: 'uppercase',
    color: '#ffaa00',
    backgroundColor: '#3a2a0a',
    padding: '4px 8px',
    borderRadius: '4px',
    border: '1px solid #5a4a1a',
  },
  presetDetails: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  presetDetail: {
    margin: 0,
    fontSize: '13px',
    color: '#b0b0b0',
    fontFamily: 'monospace',
  },
  presetDescription: {
    margin: 0,
    fontSize: '12px',
    color: '#8a8a8a',
    fontStyle: 'italic',
  },
  upscaleWarningSmall: {
    fontSize: '11px',
    color: '#ffaa00',
    backgroundColor: '#3a2a0a',
    padding: '8px',
    borderRadius: '4px',
    border: '1px solid #5a4a1a',
  },
  warningBox: {
    backgroundColor: '#3a2a0a',
    border: '2px solid #ffaa00',
    borderRadius: '8px',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  warningTitle: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 700,
    color: '#ffaa00',
  },
  warningMessage: {
    margin: 0,
    fontSize: '14px',
    color: '#ffffff',
    lineHeight: 1.5,
  },
  warningButtons: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end',
  },
  warningButtonProceed: {
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: 600,
    backgroundColor: '#ffaa00',
    color: '#000000',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  warningButtonBack: {
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
  actionButtons: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: '16px',
    borderTop: '1px solid #2a2a2a',
  },
  rightButtons: {
    display: 'flex',
    gap: '12px',
  },
  manageButton: {
    padding: '12px 20px',
    fontSize: '14px',
    fontWeight: 600,
    backgroundColor: '#2a2a2a',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  cancelButton: {
    padding: '12px 20px',
    fontSize: '14px',
    fontWeight: 600,
    backgroundColor: '#4a4a4a',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  confirmButton: {
    padding: '12px 24px',
    fontSize: '14px',
    fontWeight: 600,
    backgroundColor: '#00d4ff',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  confirmButtonDisabled: {
    opacity: 0.4,
    cursor: 'not-allowed',
  },
};
