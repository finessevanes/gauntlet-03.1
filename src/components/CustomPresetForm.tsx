/**
 * CustomPresetForm Component (Story 14: Advanced Export Options)
 * Form for creating and editing custom export presets
 */

import React, { useState, useEffect } from 'react';
import { ExportPreset } from '../types/export';

interface CustomPresetFormProps {
  isOpen: boolean;
  existingPreset?: ExportPreset; // For editing
  existingPresets: ExportPreset[]; // For validation
  onSave: (preset: ExportPreset) => Promise<{ success: boolean; error?: string }>;
  onCancel: () => void;
}

// Common resolution presets
const RESOLUTION_PRESETS = [
  { label: '720p (1280×720)', width: 1280, height: 720 },
  { label: '1080p (1920×1080)', width: 1920, height: 1080 },
  { label: '1440p (2560×1440)', width: 2560, height: 1440 },
  { label: '4K (3840×2160)', width: 3840, height: 2160 },
  { label: 'Instagram (1080×1350)', width: 1080, height: 1350 },
  { label: 'TikTok/Story (1080×1920)', width: 1080, height: 1920 },
  { label: 'Custom', width: 0, height: 0 }, // Custom = user enters manually
];

export default function CustomPresetForm({
  isOpen,
  existingPreset,
  existingPresets,
  onSave,
  onCancel,
}: CustomPresetFormProps): JSX.Element | null {
  const [name, setName] = useState('');
  const [width, setWidth] = useState(1920);
  const [height, setHeight] = useState(1080);
  const [bitrate, setBitrate] = useState(12);
  const [frameRate, setFrameRate] = useState<24 | 30 | 60>(30);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [useCustomResolution, setUseCustomResolution] = useState(false);

  // Initialize form with existing preset values if editing
  useEffect(() => {
    if (existingPreset) {
      setName(existingPreset.name);
      setWidth(existingPreset.resolution.width);
      setHeight(existingPreset.resolution.height);
      setBitrate(existingPreset.bitrate);
      setFrameRate(existingPreset.frameRate);

      // Check if it's a custom resolution
      const isStandardRes = RESOLUTION_PRESETS.some(
        p => p.width === existingPreset.resolution.width && p.height === existingPreset.resolution.height
      );
      setUseCustomResolution(!isStandardRes);
    } else {
      // Reset form if creating new
      setName('');
      setWidth(1920);
      setHeight(1080);
      setBitrate(12);
      setFrameRate(30);
      setUseCustomResolution(false);
    }
    setError(null);
  }, [existingPreset, isOpen]);

  const handleResolutionPresetChange = (preset: string) => {
    if (preset === 'custom') {
      setUseCustomResolution(true);
    } else {
      const selected = RESOLUTION_PRESETS.find(p => `${p.width}x${p.height}` === preset);
      if (selected) {
        setWidth(selected.width);
        setHeight(selected.height);
        setUseCustomResolution(false);
      }
    }
  };

  const getCurrentResolutionPreset = (): string => {
    if (useCustomResolution) return 'custom';
    const preset = RESOLUTION_PRESETS.find(p => p.width === width && p.height === height);
    return preset ? `${preset.width}x${preset.height}` : 'custom';
  };

  if (!isOpen) return null;

  const validateForm = (): string | null => {
    // Name required
    if (!name || name.trim().length === 0) {
      return 'Name is required';
    }

    // Check for duplicate name
    const duplicate = existingPresets.find(
      p => p.name.toLowerCase() === name.toLowerCase() && p.id !== existingPreset?.id
    );
    if (duplicate) {
      return 'A preset with this name already exists';
    }

    // Resolution validation
    if (width < 320 || height < 180) {
      return 'Minimum resolution is 320×180';
    }

    if (width > 7680 || height > 4320) {
      return 'Maximum resolution is 7680×4320 (8K)';
    }

    // Bitrate validation
    if (bitrate < 1 || bitrate > 100) {
      return 'Bitrate must be between 1 and 100 Mbps';
    }

    return null;
  };

  const handleSave = async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSaving(true);
    setError(null);

    const preset: ExportPreset = {
      id: existingPreset?.id || `custom-${Date.now()}`,
      name: name.trim(),
      category: 'custom',
      resolution: { width, height },
      bitrate,
      frameRate,
      createdAt: existingPreset?.createdAt || Date.now(),
    };

    const result = await onSave(preset);
    setIsSaving(false);

    if (!result.success) {
      setError(result.error || 'Failed to save preset');
    }
  };

  const isValid = validateForm() === null;

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        {/* Title */}
        <h2 style={styles.title}>
          {existingPreset ? 'Edit Custom Preset' : 'Create Custom Preset'}
        </h2>

        {/* Form Fields */}
        <div style={styles.formGroup}>
          <label style={styles.label}>Preset Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Custom Preset"
            style={styles.input}
            maxLength={50}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Resolution *</label>
          <select
            value={getCurrentResolutionPreset()}
            onChange={(e) => handleResolutionPresetChange(e.target.value)}
            style={styles.select}
          >
            {RESOLUTION_PRESETS.map((preset) => (
              <option key={preset.label} value={preset.width === 0 ? 'custom' : `${preset.width}x${preset.height}`}>
                {preset.label}
              </option>
            ))}
          </select>
        </div>

        {useCustomResolution && (
          <div style={styles.formRow}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Width *</label>
              <input
                type="number"
                value={width}
                onChange={(e) => setWidth(parseInt(e.target.value) || 0)}
                min={320}
                max={7680}
                style={styles.inputNumber}
                placeholder="1920"
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Height *</label>
              <input
                type="number"
                value={height}
                onChange={(e) => setHeight(parseInt(e.target.value) || 0)}
                min={180}
                max={4320}
                style={styles.inputNumber}
                placeholder="1080"
              />
            </div>
          </div>
        )}

        <div style={styles.formRow}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Bitrate (Mbps) *</label>
            <input
              type="number"
              value={bitrate}
              onChange={(e) => setBitrate(parseInt(e.target.value) || 0)}
              min={1}
              max={100}
              style={styles.inputNumber}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Frame Rate *</label>
            <select
              value={frameRate}
              onChange={(e) => setFrameRate(parseInt(e.target.value) as 24 | 30 | 60)}
              style={styles.select}
            >
              <option value={24}>24 fps</option>
              <option value={30}>30 fps</option>
              <option value={60}>60 fps</option>
            </select>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div style={styles.errorBox}>
            <p style={styles.errorText}>{error}</p>
          </div>
        )}

        {/* Help Text */}
        <div style={styles.helpBox}>
          <p style={styles.helpText}>
            <strong>Resolution:</strong> 320×180 to 7680×4320 (8K)
          </p>
          <p style={styles.helpText}>
            <strong>Bitrate:</strong> Higher = better quality, larger file size
          </p>
          <p style={styles.helpText}>
            <strong>Frame Rate:</strong> Use 60 fps for smooth motion, 24 fps for cinematic look
          </p>
        </div>

        {/* Action Buttons */}
        <div style={styles.actionButtons}>
          <button onClick={onCancel} style={styles.cancelButton} disabled={isSaving}>
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!isValid || isSaving}
            style={{
              ...styles.saveButton,
              ...(isValid && !isSaving ? {} : styles.saveButtonDisabled),
            }}
          >
            {isSaving ? 'Saving...' : 'Save Preset'}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Inline styles for CustomPresetForm
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
    width: '500px',
    maxHeight: '90vh',
    overflowY: 'auto',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  title: {
    margin: 0,
    fontSize: '24px',
    fontWeight: 700,
    color: '#ffffff',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    flex: 1,
  },
  formRow: {
    display: 'flex',
    gap: '16px',
  },
  label: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#b0b0b0',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  input: {
    padding: '12px',
    fontSize: '16px',
    backgroundColor: '#1a1a1a',
    color: '#ffffff',
    border: '2px solid #2a2a2a',
    borderRadius: '6px',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  inputNumber: {
    padding: '12px',
    fontSize: '16px',
    backgroundColor: '#1a1a1a',
    color: '#ffffff',
    border: '2px solid #2a2a2a',
    borderRadius: '6px',
    outline: 'none',
    transition: 'border-color 0.2s',
    fontFamily: 'monospace',
  },
  select: {
    padding: '12px',
    fontSize: '16px',
    backgroundColor: '#1a1a1a',
    color: '#ffffff',
    border: '2px solid #2a2a2a',
    borderRadius: '6px',
    outline: 'none',
    cursor: 'pointer',
    transition: 'border-color 0.2s',
  },
  errorBox: {
    backgroundColor: '#4a1a1a',
    border: '2px solid #ff6b6b',
    borderRadius: '6px',
    padding: '12px',
  },
  errorText: {
    margin: 0,
    fontSize: '14px',
    color: '#ff6b6b',
    fontWeight: 500,
  },
  helpBox: {
    backgroundColor: '#1a1a1a',
    borderRadius: '6px',
    padding: '16px',
    border: '1px solid #2a2a2a',
  },
  helpText: {
    margin: '0 0 8px 0',
    fontSize: '13px',
    color: '#8a8a8a',
    lineHeight: 1.5,
  },
  actionButtons: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    paddingTop: '16px',
    borderTop: '1px solid #2a2a2a',
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
  saveButton: {
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
  saveButtonDisabled: {
    opacity: 0.4,
    cursor: 'not-allowed',
  },
};
