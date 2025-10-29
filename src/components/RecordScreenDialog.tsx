/**
 * RecordScreenDialog Component
 * Modal dialog for selecting which screen to record
 * Story S9: Screen Recording
 */

import React, { useEffect, useState } from 'react';
import { ScreenInfo } from '../types/recording';
import { usePermissionModal } from '../context/PermissionContext';
import { checkScreenRecordingPermission } from '../utils/permissionChecks';
import { usePermissionGate } from '../hooks/usePermissionGate';
import { openPermissionModalWithCallbacks } from '../utils/permissionModalHelper';
import { useMediaPermissions } from '../hooks/useMediaPermissions';

interface RecordScreenDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onStartRecording: (screenId: string, audioEnabled: boolean, audioDeviceId?: string) => void;
}

export const RecordScreenDialog: React.FC<RecordScreenDialogProps> = ({
  isOpen,
  onClose,
  onStartRecording,
}) => {
  const permissionModal = usePermissionModal();
  const shouldRender = usePermissionGate(isOpen);

  // Use the consolidated media permissions hook
  const {
    microphonePermissionStatus,
    audioDevices,
    checkMicrophonePermission,
    requestMicrophonePermission,
    enumerateAudioDevices,
  } = useMediaPermissions({ checkMicrophone: true, autoEnumerate: false });

  const [screens, setScreens] = useState<ScreenInfo[]>([]);
  const [selectedScreenId, setSelectedScreenId] = useState<string>('');
  const [audioEnabled, setAudioEnabled] = useState<boolean>(true);
  const [selectedAudioDeviceId, setSelectedAudioDeviceId] = useState<string>('default');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      initializeDialog();
    }
  }, [isOpen]);

  /**
   * Initialize dialog by checking permissions first
   */
  const initializeDialog = async () => {
    console.log('[RecordScreenDialog] Initializing dialog - checking permissions upfront...');
    setLoading(true);

    // Check screen recording permission FIRST
    const screenPermissionCheck = await checkScreenRecordingPermission();

    if (!screenPermissionCheck.granted) {
      console.log('[RecordScreenDialog] Screen recording permission denied');
      setLoading(false);
      openPermissionModalWithCallbacks({
        permissionModal,
        type: 'screen',
        errorMessage: screenPermissionCheck.error || 'Screen recording permission denied',
        onRetry: initializeDialog,
        onCancel: onClose,
      });
      return;
    }

    // If permissions OK, THEN fetch screens and audio setup
    console.log('[RecordScreenDialog] Screen recording permission granted, now fetching screens...');
    await fetchScreens();
    checkMicrophonePermission();
    enumerateAudioDevices();
  };

  /**
   * Auto-select default audio device when devices are enumerated
   */
  useEffect(() => {
    if (audioDevices.length > 0) {
      const defaultDevice = audioDevices.find((d) => d.deviceId === 'default');
      if (defaultDevice) {
        setSelectedAudioDeviceId('default');
      } else {
        setSelectedAudioDeviceId(audioDevices[0].deviceId);
      }
    }
  }, [audioDevices]);

  const fetchScreens = async () => {
    setLoading(true);
    setError(null);

    try {
      console.log('[RecordScreenDialog] Fetching available screens...');
      const response = await window.electron.recording.getScreens();

      if (response.error) {
        // Permission errors should have been caught upfront, so this is a different error
        setError(response.error);
        setScreens([]);
      } else {
        console.log(`[RecordScreenDialog] Found ${response.screens.length} screen(s)`);
        setScreens(response.screens);

        // Auto-select first screen
        if (response.screens.length > 0) {
          setSelectedScreenId(response.screens[0].id);
        }
      }
    } catch (err) {
      console.error('[RecordScreenDialog] Error fetching screens:', err);
      setError('Unable to access screens. Please try again.');
      setScreens([]);
    } finally {
      setLoading(false);
    }
  };

  const handleStartRecording = () => {
    if (!selectedScreenId) {
      setError('Please select a screen to record');
      return;
    }

    // Validate the selected screen exists
    const selectedScreen = screens.find((s) => s.id === selectedScreenId);
    if (!selectedScreen) {
      setError('Selected screen is no longer available. Please select another screen.');
      return;
    }

    // Warn if resolution is suspicious (might indicate permission issues)
    if (selectedScreen.resolution === '0x0' || !selectedScreen.thumbnail) {
      setError(
        'Screen preview unavailable. This might indicate a permission issue. ' +
        'Please ensure Screen Recording permission is granted in System Settings > Privacy & Security > Screen Recording, ' +
        'then restart the app and try again.'
      );
      return;
    }

    console.log('[RecordScreenDialog] Starting recording:', {
      screenId: selectedScreenId,
      screenName: selectedScreen.name,
      resolution: selectedScreen.resolution,
      audioEnabled,
      audioDeviceId: audioEnabled ? selectedAudioDeviceId : undefined,
    });

    onStartRecording(selectedScreenId, audioEnabled, audioEnabled ? selectedAudioDeviceId : undefined);
  };

  if (!shouldRender) {
    return null;
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.dialog}>
        <div style={styles.header}>
          <h2 style={styles.title}>Select Screen to Record</h2>
          <button style={styles.closeButton} onClick={onClose}>
            ×
          </button>
        </div>

        <div style={styles.content}>
          {loading && (
            <div style={styles.loadingContainer}>
              <div style={styles.spinner}>Loading screens...</div>
            </div>
          )}

          {error && (
            <div style={styles.errorContainer}>
              <p style={styles.errorText}>{error}</p>
              <button style={styles.retryButton} onClick={fetchScreens}>
                Retry
              </button>
            </div>
          )}

          {!loading && !error && screens.length === 0 && (
            <div style={styles.emptyState}>
              <p>No screens found. Please try again.</p>
            </div>
          )}

          {!loading && !error && screens.length > 0 && (
            <>
              <div style={styles.screenList}>
                {screens.map((screen) => {
                  const isScreen = screen.id.startsWith('screen:');
                  const type = isScreen ? 'Screen' : 'Window';
                  const typeBadgeStyle = isScreen ? styles.screenBadge : styles.windowBadge;

                  return (
                    <div
                      key={screen.id}
                      style={{
                        ...styles.screenCard,
                        ...(selectedScreenId === screen.id ? styles.screenCardSelected : {}),
                      }}
                      onClick={() => setSelectedScreenId(screen.id)}
                    >
                      <input
                        type="radio"
                        name="screen"
                        value={screen.id}
                        checked={selectedScreenId === screen.id}
                        onChange={() => setSelectedScreenId(screen.id)}
                        style={styles.radio}
                      />
                      <div style={styles.screenInfo}>
                        <img
                          src={screen.thumbnail}
                          alt={screen.name}
                          style={styles.thumbnail}
                        />
                        <div style={styles.screenDetails}>
                          <div style={styles.screenNameRow}>
                            <span style={styles.screenName}>{screen.name}</span>
                            <span style={{ ...styles.typeBadge, ...typeBadgeStyle }}>{type}</span>
                          </div>
                          <div style={styles.screenResolution}>{screen.resolution}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={styles.audioSection}>
                <label style={styles.audioLabel}>
                  <input
                    type="checkbox"
                    checked={audioEnabled}
                    onChange={(e) => setAudioEnabled(e.target.checked)}
                    style={styles.checkbox}
                  />
                  <span>Record microphone audio</span>
                </label>

                {audioEnabled && (
                  <>
                    {/* Permission Status Indicator */}
                    <div style={styles.permissionStatus}>
                      <span style={styles.permissionLabel}>Microphone Permission:</span>
                      <span
                        style={{
                          ...styles.permissionBadge,
                          ...(microphonePermissionStatus === 'granted'
                            ? styles.permissionGranted
                            : microphonePermissionStatus === 'denied'
                            ? styles.permissionDenied
                            : styles.permissionPrompt),
                        }}
                      >
                        {microphonePermissionStatus === 'granted'
                          ? '✓ Granted'
                          : microphonePermissionStatus === 'denied'
                          ? '✗ Denied'
                          : '○ Not Requested'}
                      </span>
                    </div>

                    {/* Request Permission Button */}
                    {microphonePermissionStatus !== 'granted' && (
                      <div style={styles.permissionAction}>
                        {microphonePermissionStatus === 'prompt' && (
                          <button style={styles.requestButton} onClick={requestMicrophonePermission}>
                            Request Microphone Permission
                          </button>
                        )}
                        {microphonePermissionStatus === 'denied' && (
                          <div style={styles.permissionHelp}>
                            <p style={styles.permissionHelpText}>
                              Microphone access was denied. To enable:
                            </p>
                            <ol style={styles.permissionSteps}>
                              <li>Open System Settings → Privacy & Security → Microphone</li>
                              <li>Enable access for this application</li>
                              <li>Close and reopen this dialog</li>
                            </ol>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Microphone Selection Dropdown */}
                    {microphonePermissionStatus === 'granted' && audioDevices.length > 0 && (
                      <div style={styles.microphoneSelector}>
                        <label style={styles.microphoneLabel}>
                          <span style={styles.microphoneLabelText}>Microphone:</span>
                          <select
                            value={selectedAudioDeviceId}
                            onChange={(e) => setSelectedAudioDeviceId(e.target.value)}
                            style={styles.microphoneDropdown}
                          >
                            {audioDevices.map((device) => (
                              <option key={device.deviceId} value={device.deviceId}>
                                {device.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    )}

                    {microphonePermissionStatus === 'granted' && audioDevices.length === 0 && (
                      <div style={styles.noDevicesMessage}>
                        <p style={styles.noDevicesText}>No microphone devices found</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>

        <div style={styles.footer}>
          <button style={styles.cancelButton} onClick={onClose}>
            Cancel
          </button>
          <button
            style={{
              ...styles.startButton,
              ...(loading || !selectedScreenId ? styles.startButtonDisabled : {}),
            }}
            onClick={handleStartRecording}
            disabled={loading || !selectedScreenId}
          >
            Start Recording
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
    zIndex: 1000,
  },
  dialog: {
    backgroundColor: '#2c2c2c',
    borderRadius: '8px',
    width: '600px',
    maxWidth: '90vw',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column' as const,
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid #444',
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
  },
  content: {
    padding: '20px',
    flex: 1,
    overflowY: 'auto' as const,
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '40px',
  },
  spinner: {
    color: '#ffffff',
    fontSize: '14px',
  },
  errorContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    padding: '40px',
    gap: '16px',
  },
  errorText: {
    color: '#e74c3c',
    fontSize: '14px',
    margin: 0,
  },
  retryButton: {
    backgroundColor: '#4a90e2',
    color: '#ffffff',
    border: 'none',
    borderRadius: '4px',
    padding: '8px 16px',
    fontSize: '12px',
    fontWeight: 'bold' as const,
    cursor: 'pointer',
  },
  emptyState: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '40px',
    color: '#ffffff',
  },
  screenList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },
  screenCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px',
    backgroundColor: '#3a3a3a',
    borderRadius: '6px',
    cursor: 'pointer',
    border: '2px solid transparent',
    transition: 'all 0.2s',
  },
  screenCardSelected: {
    border: '2px solid #4a90e2',
    backgroundColor: '#404040',
  },
  radio: {
    cursor: 'pointer',
  },
  screenInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flex: 1,
  },
  thumbnail: {
    width: '160px',
    height: '90px',
    objectFit: 'cover' as const,
    borderRadius: '4px',
    border: '1px solid #555',
  },
  screenDetails: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
    flex: 1,
  },
  screenNameRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    justifyContent: 'space-between',
  },
  screenName: {
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: 'bold' as const,
  },
  typeBadge: {
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '10px',
    fontWeight: 'bold' as const,
    textTransform: 'uppercase' as const,
  },
  screenBadge: {
    backgroundColor: '#4a90e2',
    color: '#ffffff',
  },
  windowBadge: {
    backgroundColor: '#7c3aed',
    color: '#ffffff',
  },
  screenResolution: {
    color: '#aaaaaa',
    fontSize: '12px',
  },
  audioSection: {
    marginTop: '20px',
    padding: '16px',
    backgroundColor: '#3a3a3a',
    borderRadius: '6px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },
  audioLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: '#ffffff',
    fontSize: '14px',
    cursor: 'pointer',
  },
  checkbox: {
    cursor: 'pointer',
  },
  permissionStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
  },
  permissionLabel: {
    color: '#aaaaaa',
  },
  permissionBadge: {
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 'bold' as const,
  },
  permissionGranted: {
    backgroundColor: '#2ecc71',
    color: '#ffffff',
  },
  permissionDenied: {
    backgroundColor: '#e74c3c',
    color: '#ffffff',
  },
  permissionPrompt: {
    backgroundColor: '#f39c12',
    color: '#ffffff',
  },
  permissionAction: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },
  requestButton: {
    backgroundColor: '#4a90e2',
    color: '#ffffff',
    border: 'none',
    borderRadius: '4px',
    padding: '8px 12px',
    fontSize: '12px',
    fontWeight: 'bold' as const,
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  permissionHelp: {
    padding: '12px',
    backgroundColor: '#4a2a2a',
    borderRadius: '4px',
    border: '1px solid #e74c3c',
  },
  permissionHelpText: {
    color: '#ffffff',
    fontSize: '12px',
    margin: '0 0 8px 0',
  },
  permissionSteps: {
    color: '#cccccc',
    fontSize: '11px',
    margin: '0',
    paddingLeft: '20px',
    lineHeight: '1.6',
  },
  microphoneSelector: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
  },
  microphoneLabel: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
    color: '#ffffff',
    fontSize: '13px',
  },
  microphoneLabelText: {
    color: '#aaaaaa',
    fontSize: '12px',
  },
  microphoneDropdown: {
    backgroundColor: '#2c2c2c',
    color: '#ffffff',
    border: '1px solid #555',
    borderRadius: '4px',
    padding: '8px',
    fontSize: '13px',
    cursor: 'pointer',
    outline: 'none',
  },
  noDevicesMessage: {
    padding: '8px',
    backgroundColor: '#4a3a2a',
    borderRadius: '4px',
    border: '1px solid #f39c12',
  },
  noDevicesText: {
    color: '#f39c12',
    fontSize: '12px',
    margin: 0,
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    padding: '16px 20px',
    borderTop: '1px solid #444',
  },
  cancelButton: {
    backgroundColor: '#555',
    color: '#ffffff',
    border: 'none',
    borderRadius: '4px',
    padding: '8px 16px',
    fontSize: '12px',
    fontWeight: 'bold' as const,
    cursor: 'pointer',
  },
  startButton: {
    backgroundColor: '#e74c3c',
    color: '#ffffff',
    border: 'none',
    borderRadius: '4px',
    padding: '8px 16px',
    fontSize: '12px',
    fontWeight: 'bold' as const,
    cursor: 'pointer',
  },
  startButtonDisabled: {
    backgroundColor: '#555',
    cursor: 'not-allowed',
    opacity: 0.6,
  },
};
