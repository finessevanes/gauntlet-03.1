/**
 * PiPSettings Component
 * Configuration panel for PiP recording (position, size, audio mode)
 * Story S11: Picture-in-Picture Recording
 */

import React from 'react';

interface PiPRecordingSettings {
  screenId: string;
  webcamPosition: 'TL' | 'TR' | 'BL' | 'BR';
  webcamSize: 'small' | 'medium' | 'large';
  webcamShape: 'rectangle' | 'circle';
}

interface PiPSettingsProps {
  settings: PiPRecordingSettings;
  onSettingsChange: (settings: Partial<PiPRecordingSettings>) => void;
}

export const PiPSettings: React.FC<PiPSettingsProps> = ({ settings, onSettingsChange }) => {
  return (
    <div style={styles.container}>
      {/* Webcam Position */}
      <div style={styles.settingGroup}>
        <label style={styles.label}>Webcam Position</label>
        <select
          value={settings.webcamPosition}
          onChange={(e) =>
            onSettingsChange({ webcamPosition: e.target.value as 'TL' | 'TR' | 'BL' | 'BR' })
          }
          style={styles.select}
        >
          <option value="TL">Top Left</option>
          <option value="TR">Top Right</option>
          <option value="BL">Bottom Left</option>
          <option value="BR">Bottom Right</option>
        </select>
      </div>

      {/* Webcam Size */}
      <div style={styles.settingGroup}>
        <label style={styles.label}>Webcam Size</label>
        <select
          value={settings.webcamSize}
          onChange={(e) =>
            onSettingsChange({ webcamSize: e.target.value as 'small' | 'medium' | 'large' })
          }
          style={styles.select}
        >
          <option value="small">Small (20%)</option>
          <option value="medium">Medium (30%)</option>
          <option value="large">Large (40%)</option>
        </select>
      </div>

      {/* Webcam Shape */}
      <div style={styles.settingGroup}>
        <label style={styles.label}>Webcam Shape</label>
        <select
          value={settings.webcamShape}
          onChange={(e) =>
            onSettingsChange({ webcamShape: e.target.value as 'rectangle' | 'circle' })
          }
          style={styles.select}
        >
          <option value="rectangle">Rectangle</option>
          <option value="circle">Circle</option>
        </select>
        <p style={styles.description}>
          {settings.webcamShape === 'circle' && 'Webcam will appear as a circular overlay'}
          {settings.webcamShape === 'rectangle' && 'Webcam will appear as a rectangular overlay'}
        </p>
      </div>
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px',
  },
  settingGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
  },
  label: {
    fontSize: '13px',
    fontWeight: 'bold' as const,
    color: '#ffffff',
  },
  select: {
    backgroundColor: '#2c2c2c',
    color: '#ffffff',
    border: '1px solid #555',
    borderRadius: '4px',
    padding: '8px 10px',
    fontSize: '13px',
    cursor: 'pointer',
    outline: 'none',
    transition: 'border-color 0.2s',
  } as React.CSSProperties,
  description: {
    fontSize: '12px',
    color: '#aaaaaa',
    margin: 0,
    marginTop: '4px',
  },
  warningBox: {
    marginTop: '8px',
    padding: '12px',
    backgroundColor: 'rgba(255, 152, 0, 0.15)',
    border: '1px solid rgba(255, 152, 0, 0.4)',
    borderRadius: '4px',
  },
  warningTitle: {
    fontSize: '12px',
    fontWeight: 'bold' as const,
    color: '#ff9800',
    margin: '0 0 8px 0',
  },
  warningText: {
    fontSize: '11px',
    color: '#cccccc',
    margin: '0 0 8px 0',
    lineHeight: '1.4',
  },
  warningSteps: {
    fontSize: '11px',
    color: '#cccccc',
    margin: '0 0 8px 0',
    paddingLeft: '20px',
    lineHeight: '1.6',
  },
};
