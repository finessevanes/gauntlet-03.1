/**
 * PiPRecordingModal Component
 * Modal dialog for Picture-in-Picture recording (screen + webcam)
 * Story S11: Picture-in-Picture Recording
 */

import React, { useEffect, useState, useRef } from 'react';
import { PiPSettings } from './PiPSettings';
import { ScreenInfo } from '../types/recording';
import { usePermissionModal } from '../context/PermissionContext';
import { checkScreenRecordingPermission, checkCameraPermission } from '../utils/permissionChecks';
import { usePermissionGate } from '../hooks/usePermissionGate';
import { openPermissionModalWithCallbacks } from '../utils/permissionModalHelper';
import { useMediaPermissions } from '../hooks/useMediaPermissions';

interface PiPRecordingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRecordingComplete: (filePath: string) => void;
}

type PiPModalStage = 'screen-selection' | 'settings' | 'recording' | 'error';

interface PiPRecordingSettings {
  screenId: string;
  webcamPosition: 'TL' | 'TR' | 'BL' | 'BR';
  webcamSize: 'small' | 'medium' | 'large';
  webcamShape: 'rectangle' | 'circle';
}

export const PiPRecordingModal: React.FC<PiPRecordingModalProps> = ({
  isOpen,
  onClose,
  onRecordingComplete,
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
    cameraDevices,
    enumerateCameraDevices,
  } = useMediaPermissions({
    checkMicrophone: true,
    checkCamera: true,
    autoEnumerate: false
  });

  // State
  const [stage, setStage] = useState<PiPModalStage>('screen-selection');
  const [screens, setScreens] = useState<ScreenInfo[]>([]);
  const [selectedScreenId, setSelectedScreenId] = useState<string>('');
  const [selectedScreen, setSelectedScreen] = useState<ScreenInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [audioEnabled, setAudioEnabled] = useState<boolean>(true);
  const [selectedAudioDeviceId, setSelectedAudioDeviceId] = useState<string>('default');
  const [selectedCameraDeviceId, setSelectedCameraDeviceId] = useState<string>('default');
  const [settings, setSettings] = useState<PiPRecordingSettings>({
    screenId: '',
    webcamPosition: 'BL',
    webcamSize: 'medium',
    webcamShape: 'rectangle',
  });
  const [cameraAvailable, setCameraAvailable] = useState<boolean>(true);
  const [recordingId, setRecordingId] = useState<string>('');
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Refs for media streams and recorders
  const screenStreamRef = useRef<MediaStream | null>(null);
  const webcamStreamRef = useRef<MediaStream | null>(null);
  const screenRecorderRef = useRef<MediaRecorder | null>(null);
  const webcamRecorderRef = useRef<MediaRecorder | null>(null);
  const screenChunksRef = useRef<Blob[]>([]);
  const webcamChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const webcamVideoRef = useRef<HTMLVideoElement>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const recordingWebcamVideoRef = useRef<HTMLVideoElement>(null);
  const startTimeRef = useRef<number>(0);

  // Initialize on mount
  useEffect(() => {
    if (isOpen) {
      initializeModal();
    } else {
      cleanup();
    }

    return () => {
      cleanup();
    };
  }, [isOpen]);

  // Auto-select default devices when device lists change
  useEffect(() => {
    if (audioDevices.length > 0) {
      // Priority: Headphones > Built-in Microphone > Default > First device
      let selectedDevice: string = audioDevices[0].deviceId;

      const headphonesDevice = audioDevices.find((d) =>
        d.label?.toLowerCase().includes('headphone') ||
        d.label?.toLowerCase().includes('earphone') ||
        d.label?.toLowerCase().includes('bluetooth audio')
      );

      if (headphonesDevice) {
        selectedDevice = headphonesDevice.deviceId;
      } else {
        const builtInMicDevice = audioDevices.find((d) =>
          d.label?.toLowerCase().includes('built-in') ||
          d.label?.toLowerCase().includes('microphone')
        );

        if (builtInMicDevice) {
          selectedDevice = builtInMicDevice.deviceId;
        } else {
          const defaultDevice = audioDevices.find((d) => d.deviceId === 'default');
          if (defaultDevice) {
            selectedDevice = 'default';
          }
        }
      }

      setSelectedAudioDeviceId(selectedDevice);
    }
  }, [audioDevices]);

  useEffect(() => {
    if (cameraDevices.length > 0) {
      const defaultDevice = cameraDevices.find((d) => d.deviceId === 'default');
      if (defaultDevice) {
        setSelectedCameraDeviceId('default');
      } else {
        setSelectedCameraDeviceId(cameraDevices[0].deviceId);
      }
    }
  }, [cameraDevices]);

  // Update webcam video preview
  useEffect(() => {
    if (webcamStreamRef.current && webcamVideoRef.current) {
      webcamVideoRef.current.srcObject = webcamStreamRef.current;
    }
  }, [stage]);

  // Update recording stage preview streams
  useEffect(() => {
    if (stage === 'recording') {
      // Set webcam stream for preview
      if (webcamStreamRef.current && recordingWebcamVideoRef.current) {
        recordingWebcamVideoRef.current.srcObject = webcamStreamRef.current;
        recordingWebcamVideoRef.current.play().catch((error) => {
          console.warn('[PiPModal] Failed to autoplay webcam video:', error);
        });
      }
    }
  }, [stage]);


  /**
   * Initialize modal - check permissions first, then load screens and settings
   */
  const initializeModal = async () => {
    try {
      console.log('[PiPModal] Initializing modal - checking permissions upfront...');
      setStage('screen-selection');
      setError(null);
      setErrorMessage('');
      setLoading(true);

      // Check screen recording permission FIRST - don't look for screens until permission granted
      const screenPermissionCheck = await checkScreenRecordingPermission();
      if (!screenPermissionCheck.granted) {
        console.log('[PiPModal] Screen recording permission denied');
        setLoading(false);
        openPermissionModalWithCallbacks({
          permissionModal,
          type: 'screen',
          errorMessage: screenPermissionCheck.error || 'Screen recording permission denied',
          onRetry: initializeModal,
          onCancel: onClose,
        });
        return;
      }

      // Only after permission is confirmed, get available screens
      console.log('[PiPModal] Screen recording permission granted, now fetching screens...');
      const screensResponse = await window.electron.recording.getScreens();

      // Permission errors should have been caught upfront, so handle other errors
      if (screensResponse.error) {
        throw new Error(screensResponse.error);
      }

      if (!screensResponse.screens || screensResponse.screens.length === 0) {
        throw new Error('No screens available for recording');
      }

      setScreens(screensResponse.screens);

      // Select primary screen by default
      const primaryScreen = screensResponse.screens.find((s) => s.isPrimary) || screensResponse.screens[0];
      setSelectedScreenId(primaryScreen.id);

      // Check camera availability
      const cameraCheck = await window.electron.pip.checkCameraAvailable();
      setCameraAvailable(cameraCheck.available);

      // Load saved settings
      const settingsResponse = await window.electron.pip.getPipSettings();
      if (settingsResponse.settings) {
        setSettings({
          ...settingsResponse.settings,
          screenId: primaryScreen.id, // Override with current primary screen
        });
      }

      // Check microphone permission and enumerate devices
      await checkMicrophonePermission();
      await enumerateAudioDevices();
      await enumerateCameraDevices();

      console.log('[PiPModal] Initialization complete');
    } catch (error) {
      console.error('[PiPModal] Initialization error:', error);
      setStage('error');
      setErrorMessage(error instanceof Error ? error.message : 'Failed to initialize recording');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle screen selection
   */
  const handleScreenSelect = (screenId: string) => {
    setSelectedScreenId(screenId);
  };

  /**
   * Validate screen selection
   */
  const validateScreenSelection = (): boolean => {
    if (!selectedScreenId) {
      setError('Please select a screen to record');
      return false;
    }

    const selectedScreen = screens.find((s) => s.id === selectedScreenId);
    if (!selectedScreen) {
      setError('Selected screen is no longer available. Please select another screen.');
      return false;
    }

    if (selectedScreen.resolution === '0x0' || !selectedScreen.thumbnail) {
      setError(
        'Screen preview unavailable. This might indicate a permission issue. ' +
        'Please ensure Screen Recording permission is granted in System Settings > Privacy & Security > Screen Recording, ' +
        'then restart the app and try again.'
      );
      return false;
    }

    return true;
  };

  /**
   * Move to settings stage - check camera permission first
   */
  const handleNextToSettings = async () => {
    if (!validateScreenSelection()) {
      return;
    }

    // Check camera permission UPFRONT before attempting to access webcam
    console.log('[PiPModal] Checking camera permission upfront...');
    const cameraPermissionCheck = await checkCameraPermission();

    if (!cameraPermissionCheck.granted) {
      console.log('[PiPModal] Camera permission denied');
      setCameraAvailable(false);
      setStage('error');
      openPermissionModalWithCallbacks({
        permissionModal,
        type: 'camera',
        errorMessage: cameraPermissionCheck.error || 'Camera permission denied',
        onRetry: handleNextToSettings,
        onCancel: onClose,
      });
      return;
    }

    try {
      // Initialize webcam preview for settings stage
      console.log('[PiPModal] Requesting webcam access...');

      // Always request video, but audio depends on audioMode
      // We'll request audio here for preview, but we'll filter tracks during recording based on audioMode
      const stream = await navigator.mediaDevices.getUserMedia({
        video: selectedCameraDeviceId ? { deviceId: { exact: selectedCameraDeviceId } } : true,
        audio: true, // Always request for preview, will be filtered during recording
      });

      webcamStreamRef.current = stream;
      setCameraAvailable(true);

      // Get the selected screen object for the preview
      const screen = screens.find((s) => s.id === selectedScreenId);
      if (screen) {
        setSelectedScreen(screen);
      }


      setSettings((prev) => ({ ...prev, screenId: selectedScreenId }));
      setStage('settings');
    } catch (error) {
      console.error('[PiPModal] Webcam access error:', error);
      setCameraAvailable(false);
      setStage('error');

      if (error instanceof Error) {
        // Permission errors should have been caught upfront, so these are device errors
        if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
          setErrorMessage('No camera found. Please connect a webcam and try again.');
        } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
          setErrorMessage(
            'Camera is already in use by another application. Please close other apps using the camera and try again.'
          );
        } else {
          setErrorMessage(
            'Camera access failed. Please check your camera connection and try again.'
          );
        }
      } else {
        setErrorMessage(
          'Camera access failed. Please check your camera connection and try again.'
        );
      }
    }
  };

  /**
   * Handle settings change
   */
  const handleSettingsChange = (newSettings: Partial<PiPRecordingSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  /**
   * Get supported MIME type for MediaRecorder
   * Tries multiple codec combinations in order of preference
   */
  const getSupportedMimeType = (): string => {
    // Try MIME types in order of preference
    const mimeTypes = [
      'video/webm;codecs=vp8,opus',      // Preferred: VP8 + Opus
      'video/webm;codecs=vp9,opus',      // VP9 + Opus
      'video/webm;codecs=vp8',           // VP8 only (audio might fail)
      'video/webm',                       // WebM (system default codecs)
    ];

    for (const mimeType of mimeTypes) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        console.log('[PiPModal] Using supported MIME type:', mimeType);
        return mimeType;
      }
    }

    // Fallback to empty string - browser will choose appropriate codecs
    console.warn('[PiPModal] No explicitly supported MIME types found, using default');
    return '';
  };

  /**
   * Start PiP recording
   */
  const handleStartRecording = async () => {
    try {
      console.log('[PiPModal] Starting PiP recording...');
      setStage('recording');
      setErrorMessage('');

      // Start recording session via IPC (creates temp file paths)
      const startResponse = await window.electron.pip.startPiPRecording({
        screenId: settings.screenId,
        settings,
      });

      if (!startResponse.success || !startResponse.recordingId) {
        throw new Error(startResponse.error || 'Failed to start recording');
      }

      setRecordingId(startResponse.recordingId);

      // Get screen stream via Electron's chromeMediaSource (not standard getDisplayMedia)
      console.log('[PiPModal] Getting screen stream for screen ID:', settings.screenId);

      let screenSources: MediaStream;

      try {
        // PiP always captures screen video without audio (audio comes from microphone only)
        console.log('[PiPModal] Capturing screen video only (audio from microphone)...');
        screenSources = await navigator.mediaDevices.getUserMedia({
          video: {
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: settings.screenId,
              minWidth: 1280,
              minHeight: 720,
              maxWidth: 4096,
              maxHeight: 2160,
            },
          },
          audio: false,
        } as any);
      } catch (screenCaptureError) {
        console.error('[PiPModal] Screen capture failed:', screenCaptureError);
        throw new Error(`Failed to capture screen: ${screenCaptureError instanceof Error ? screenCaptureError.message : 'Unknown error'}`);
      }

      screenStreamRef.current = screenSources;

      // Webcam stream already initialized in settings stage
      if (!webcamStreamRef.current) {
        throw new Error('Webcam stream not initialized');
      }

      // Always record webcam video + microphone audio (PiP uses microphone-only like webcam recording)
      const webcamVideoTracks = webcamStreamRef.current.getVideoTracks();
      const webcamAudioTracks = webcamStreamRef.current.getAudioTracks();

      const webcamTracksToRecord: MediaStreamTrack[] = [
        ...webcamVideoTracks,
        ...webcamAudioTracks  // Always include microphone audio
      ];

      console.log('[PiPModal] Recording webcam with microphone audio');

      // Create a new MediaStream with the tracks we want to record
      const webcamRecordingStream = new MediaStream(webcamTracksToRecord);

      console.log('[PiPModal] Webcam recording stream tracks:', {
        video: webcamRecordingStream.getVideoTracks().length,
        audio: webcamRecordingStream.getAudioTracks().length,
      });

      // Get supported MIME type
      const mimeType = getSupportedMimeType();
      const recorderOptions = mimeType ? { mimeType } : {};

      console.log('[PiPModal] Creating MediaRecorders with options:', recorderOptions);

      // Create MediaRecorders for both streams
      let screenRecorder: MediaRecorder;
      let webcamRecorder: MediaRecorder;

      try {
        screenRecorder = new MediaRecorder(screenSources, recorderOptions);
        console.log('[PiPModal] Screen recorder created successfully');
      } catch (screenRecorderError) {
        console.error('[PiPModal] Failed to create screen recorder:', screenRecorderError);
        throw new Error(`Failed to create screen recorder: ${screenRecorderError instanceof Error ? screenRecorderError.message : 'Unknown error'}`);
      }

      try {
        webcamRecorder = new MediaRecorder(webcamRecordingStream, recorderOptions);
        console.log('[PiPModal] Webcam recorder created successfully');
      } catch (webcamRecorderError) {
        console.error('[PiPModal] Failed to create webcam recorder:', webcamRecorderError);
        screenRecorder.stop();
        throw new Error(`Failed to create webcam recorder: ${webcamRecorderError instanceof Error ? webcamRecorderError.message : 'Unknown error'}`);
      }

      // Screen recorder data handler
      screenRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          screenChunksRef.current.push(event.data);
        }
      };

      // Webcam recorder data handler
      webcamRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          webcamChunksRef.current.push(event.data);
        }
      };

      // Handle recorder errors
      screenRecorder.onerror = (event) => {
        console.error('[PiPModal] Screen recorder error:', event.error);
      };

      webcamRecorder.onerror = (event) => {
        console.error('[PiPModal] Webcam recorder error:', event.error);
      };

      // Start both recorders
      try {
        screenRecorder.start(1000); // Collect data every 1 second
        webcamRecorder.start(1000);
        console.log('[PiPModal] Both recorders started successfully');
      } catch (startError) {
        console.error('[PiPModal] Failed to start recorders:', startError);
        throw new Error(`Failed to start recorders: ${startError instanceof Error ? startError.message : 'Unknown error'}`);
      }

      screenRecorderRef.current = screenRecorder;
      webcamRecorderRef.current = webcamRecorder;

      // Start timer
      startTimeRef.current = Date.now();
      timerIntervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setElapsedSeconds(elapsed);
      }, 1000);

      // Notify main process
      await window.electron.recording.setWebcamStatus(true);

      console.log('[PiPModal] Recording started successfully');
    } catch (error) {
      console.error('[PiPModal] Start recording error:', error);
      setStage('error');
      setErrorMessage(error instanceof Error ? error.message : 'Failed to start recording');
      cleanup();
    }
  };

  /**
   * Stop PiP recording and composite
   */
  const handleStopRecording = async () => {
    try {
      console.log('[PiPModal] Stopping PiP recording...');

      // Stop timer
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }

      // Stop both recorders
      if (screenRecorderRef.current && screenRecorderRef.current.state !== 'inactive') {
        screenRecorderRef.current.stop();
      }

      if (webcamRecorderRef.current && webcamRecorderRef.current.state !== 'inactive') {
        webcamRecorderRef.current.stop();
      }

      // Wait for final data to be collected
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Stop IPC recording session
      const stopResponse = await window.electron.pip.stopPiPRecording({
        recordingId,
      });

      if (!stopResponse.success || !stopResponse.screenFile || !stopResponse.webcamFile) {
        throw new Error(stopResponse.error || 'Failed to stop recording');
      }

      const screenFilePath = stopResponse.screenFile;
      const webcamFilePath = stopResponse.webcamFile;

      // Combine chunks into Blobs
      const screenBlob = new Blob(screenChunksRef.current, { type: 'video/webm' });
      const webcamBlob = new Blob(webcamChunksRef.current, { type: 'video/webm' });

      console.log('[PiPModal] Recording stopped, blobs created:', {
        screenSize: screenBlob.size,
        webcamSize: webcamBlob.size,
      });

      // Convert blobs to ArrayBuffers and save to temp files
      const screenArrayBuffer = await screenBlob.arrayBuffer();
      const webcamArrayBuffer = await webcamBlob.arrayBuffer();

      await window.electron.pip.saveScreenData(
        recordingId,
        screenFilePath,
        new Uint8Array(screenArrayBuffer)
      );

      await window.electron.pip.saveWebcamData(
        recordingId,
        webcamFilePath,
        new Uint8Array(webcamArrayBuffer)
      );

      console.log('[PiPModal] Temp files saved, starting composite...');

      // Close modal immediately (compositing will happen in background)
      onClose();
      cleanup();

      // Generate output path in recordings directory
      const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0].replace('T', '_');
      const filename = `PiP_Recording_${timestamp}.mp4`;
      const outputPath = await window.electron.invoke('app:get-recordings-path', filename);

      console.log('[PiPModal] Output path:', outputPath);

      // Composite videos using FFmpeg (happens after modal closes)
      const compositeResponse = await window.electron.pip.compositePiPVideos({
        screenFile: screenFilePath,
        webcamFile: webcamFilePath,
        settings,
        outputPath,
      });

      if (!compositeResponse.success || !compositeResponse.compositeFile) {
        throw new Error(compositeResponse.error || 'Failed to composite videos');
      }

      console.log('[PiPModal] Composite created:', compositeResponse.compositeFile);

      // Save settings for next time
      await window.electron.pip.savePipSettings({ settings });

      // Notify main process
      await window.electron.recording.setWebcamStatus(false);

      // Notify parent component with completed file
      onRecordingComplete(compositeResponse.compositeFile!);
    } catch (error) {
      console.error('[PiPModal] Stop recording error:', error);
      setStage('error');
      setErrorMessage(error instanceof Error ? error.message : 'Failed to stop recording');
      cleanup();
    }
  };

  /**
   * Cleanup streams and recorders
   */
  const cleanup = () => {
    console.log('[PiPModal] Cleaning up...');

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
    }

    if (webcamStreamRef.current) {
      webcamStreamRef.current.getTracks().forEach((track) => track.stop());
      webcamStreamRef.current = null;
    }

    screenRecorderRef.current = null;
    webcamRecorderRef.current = null;
    screenChunksRef.current = [];
    webcamChunksRef.current = [];
    setElapsedSeconds(0);
  };

  /**
   * Handle cancel
   */
  const handleCancel = () => {
    cleanup();
    onClose();
  };

  /**
   * Handle back navigation (from settings to screen selection)
   */
  const handleBackFromSettings = () => {
    cleanup();
    setStage('screen-selection');
    setError(null);
    setErrorMessage('');
  };

  /**
   * Handle try again (error recovery)
   */
  const handleTryAgain = () => {
    cleanup();
    initializeModal();
  };

  // Don't render if not open or if permission modal is open
  if (!shouldRender) {
    return null;
  }

  // Format timer
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <>
      <style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}</style>
      <div style={styles.overlay}>
      <div style={styles.dialog}>
        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.title}>Record Screen + Webcam (PiP)</h2>
          <button style={styles.closeButton} onClick={handleCancel}>
            ×
          </button>
        </div>

        {/* Content */}
        <div style={styles.content}>
          {/* Stage: Screen Selection */}
          {stage === 'screen-selection' && (
            <div>
              {loading && (
                <div style={styles.loadingContainer}>
                  <div style={styles.spinner}>Loading screens...</div>
                </div>
              )}

              {error && (
                <div style={styles.errorContainer}>
                  <p style={styles.errorText}>{error}</p>
                  <button style={styles.retryButton} onClick={initializeModal}>
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
                          onClick={() => handleScreenSelect(screen.id)}
                        >
                          <input
                            type="radio"
                            name="screen"
                            value={screen.id}
                            checked={selectedScreenId === screen.id}
                            onChange={() => handleScreenSelect(screen.id)}
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
                              <div style={styles.microphoneRow}>
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
                                <button
                                  onClick={enumerateAudioDevices}
                                  style={styles.refreshButton}
                                  title="Refresh device list"
                                >
                                  ↻
                                </button>
                              </div>
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
          )}

        </div>

        {/* Footer - only for screen-selection stage */}
        {stage === 'screen-selection' && (
          <div style={styles.footer}>
            <button style={styles.cancelButton} onClick={handleCancel}>
              Cancel
            </button>
            <button
              style={{
                ...styles.startButton,
                ...(loading || !selectedScreenId ? styles.startButtonDisabled : {}),
              }}
              onClick={handleNextToSettings}
              disabled={loading || !selectedScreenId}
            >
              Next
            </button>
          </div>
        )}

        {/* Content continued for other stages */}
        <div style={stage !== 'screen-selection' ? styles.content : { display: 'none' }}>
          {/* Stage: Settings */}
          {stage === 'settings' && (
            <div style={styles.settingsContainer}>
              <h3 style={styles.settingsTitle}>Configure PiP Settings</h3>

              {/* Preview Area - Screen thumbnail background + Webcam overlay */}
              <div
                style={{
                  ...styles.previewBackground,
                  backgroundImage: selectedScreen?.thumbnail ? `url(${selectedScreen.thumbnail})` : 'none',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              >

                {/* Positioned webcam preview (showing what it will look like) */}
                <video
                  ref={webcamVideoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    ...styles.previewVideo,
                    ...(settings.webcamShape === 'circle' ? styles.circleVideo : {}),
                    width: settings.webcamSize === 'small' ? '20%' : settings.webcamSize === 'medium' ? '30%' : '40%',
                    top: settings.webcamPosition === 'TL' || settings.webcamPosition === 'TR' ? '10px' : 'auto',
                    bottom: settings.webcamPosition === 'BL' || settings.webcamPosition === 'BR' ? '10px' : 'auto',
                    left: settings.webcamPosition === 'TL' || settings.webcamPosition === 'BL' ? '10px' : 'auto',
                    right: settings.webcamPosition === 'TR' || settings.webcamPosition === 'BR' ? '10px' : 'auto',
                    zIndex: 10,
                  }}
                />
              </div>

              {/* Settings Controls */}
              <div style={styles.settingsControlsWrapper}>
                <PiPSettings settings={settings} onSettingsChange={handleSettingsChange} />

                {/* Camera Selection (only show if multiple cameras available) */}
                {cameraDevices.length > 1 && (
                  <div style={styles.cameraSelector}>
                    <label style={styles.cameraLabel}>
                      <span style={styles.cameraSelectorText}>Camera:</span>
                      <div style={styles.cameraRow}>
                        <select
                          value={selectedCameraDeviceId}
                          onChange={(e) => setSelectedCameraDeviceId(e.target.value)}
                          style={styles.cameraDropdown}
                        >
                          {cameraDevices.map((camera) => (
                            <option key={camera.deviceId} value={camera.deviceId}>
                              {camera.label || `Camera ${camera.deviceId.slice(0, 8)}`}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={enumerateCameraDevices}
                          style={styles.refreshCameraButton}
                          title="Refresh camera list"
                        >
                          ↻
                        </button>
                      </div>
                    </label>
                  </div>
                )}
              </div>

              {!cameraAvailable && (
                <div style={styles.errorBox}>
                  <p style={styles.errorBoxText}>Camera not available. Please check permissions and try again.</p>
                </div>
              )}

              <div style={styles.footer}>
                <button style={styles.backButton} onClick={handleBackFromSettings}>
                  ← Back
                </button>
                <div style={styles.footerSpacer}></div>
                <button style={styles.cancelButton} onClick={handleCancel}>
                  Cancel
                </button>
                <button
                  style={{
                    ...styles.startButton,
                    ...(!cameraAvailable ? styles.startButtonDisabled : {}),
                  }}
                  onClick={handleStartRecording}
                  disabled={!cameraAvailable}
                >
                  Start Recording
                </button>
              </div>
            </div>
          )}

          {/* Stage: Recording */}
          {stage === 'recording' && (
            <div style={styles.recordingContainer}>
              {/* Preview Area - Screen thumbnail background + webcam overlay */}
              <div
                style={{
                  ...styles.recordingPreview,
                  backgroundImage: selectedScreen?.thumbnail ? `url(${selectedScreen.thumbnail})` : 'none',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              >

                {/* Webcam Overlay */}
                <video
                  ref={recordingWebcamVideoRef}
                  autoPlay={true}
                  playsInline={true}
                  muted={true}
                  controls={false}
                  style={{
                    ...styles.recordingWebcamVideo,
                    ...(settings.webcamShape === 'circle' ? styles.circleVideo : {}),
                    width: settings.webcamSize === 'small' ? '20%' : settings.webcamSize === 'medium' ? '30%' : '40%',
                    top: settings.webcamPosition === 'TL' || settings.webcamPosition === 'TR' ? '10px' : 'auto',
                    bottom: settings.webcamPosition === 'BL' || settings.webcamPosition === 'BR' ? '10px' : 'auto',
                    left: settings.webcamPosition === 'TL' || settings.webcamPosition === 'BL' ? '10px' : 'auto',
                    right: settings.webcamPosition === 'TR' || settings.webcamPosition === 'BR' ? '10px' : 'auto',
                    zIndex: 10,
                  }}
                  onLoadedMetadata={(e) => {
                    console.log('[PiPModal] Webcam video metadata loaded');
                  }}
                  onPlay={(e) => {
                    console.log('[PiPModal] Webcam video playing');
                  }}
                  onError={(e) => {
                    console.error('[PiPModal] Webcam video error:', e);
                  }}
                />
              </div>

              {/* Controls */}
              <div style={styles.recordingControls}>
                <div style={styles.recordingTimer}>
                  <div style={styles.recordingIndicator}></div>
                  <span style={styles.recordingTime}>{formatTime(elapsedSeconds)}</span>
                </div>
                <button
                  onClick={handleStopRecording}
                  style={styles.stopButton}
                >
                  Stop Recording
                </button>
              </div>
            </div>
          )}

          {/* Stage: Error */}
          {stage === 'error' && (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
                <svg
                  className="w-8 h-8 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
              <p className="text-lg font-medium text-gray-900 mb-2">Recording Error</p>
              <p className="text-gray-600 mb-6">{errorMessage}</p>
              <div className="flex justify-center space-x-3">
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Close
                </button>
                <button
                  onClick={handleTryAgain}
                  className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    </>
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
    width: '800px',
    maxWidth: '90vw',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column' as const,
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
  },
  settingsContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px',
    height: '100%',
  },
  settingsTitle: {
    fontSize: '16px',
    fontWeight: 'bold' as const,
    color: '#ffffff',
    margin: 0,
  },
  previewBackground: {
    position: 'relative' as const,
    backgroundColor: '#1a1a1a',
    borderRadius: '6px',
    overflow: 'hidden',
    flex: 1,
    minHeight: '350px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backgroundVideo: {
    position: 'absolute' as const,
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
  },
  previewVideo: {
    position: 'absolute' as const,
    borderRadius: '6px',
    border: '3px solid #ffffff',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.6)',
    objectFit: 'cover' as const,
    aspectRatio: '16 / 9',
  },
  circleVideo: {
    borderRadius: '50%',
    aspectRatio: '1 / 1',
  },
  settingsControlsWrapper: {
    padding: '16px',
    backgroundColor: '#3a3a3a',
    borderRadius: '6px',
    maxHeight: '250px',
    overflowY: 'auto' as const,
  },
  errorBox: {
    padding: '12px',
    backgroundColor: '#4a2a2a',
    borderRadius: '4px',
    border: '1px solid #e74c3c',
  },
  errorBoxText: {
    color: '#e74c3c',
    fontSize: '13px',
    margin: 0,
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
  microphoneRow: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
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
    flex: 1,
  },
  refreshButton: {
    backgroundColor: '#4a90e2',
    color: '#ffffff',
    border: 'none',
    borderRadius: '4px',
    padding: '8px 12px',
    fontSize: '16px',
    fontWeight: 'bold' as const,
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    minWidth: '36px',
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
  cameraSelector: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
    marginTop: '12px',
    paddingTop: '12px',
    borderTop: '1px solid #555',
  },
  cameraLabel: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
    color: '#ffffff',
    fontSize: '13px',
  },
  cameraSelectorText: {
    color: '#aaaaaa',
    fontSize: '12px',
  },
  cameraRow: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  cameraDropdown: {
    backgroundColor: '#2c2c2c',
    color: '#ffffff',
    border: '1px solid #555',
    borderRadius: '4px',
    padding: '8px',
    fontSize: '13px',
    cursor: 'pointer',
    outline: 'none',
    flex: 1,
  },
  refreshCameraButton: {
    backgroundColor: '#4a90e2',
    color: '#ffffff',
    border: 'none',
    borderRadius: '4px',
    padding: '8px 12px',
    fontSize: '16px',
    fontWeight: 'bold' as const,
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    minWidth: '36px',
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    padding: '16px 20px',
    borderTop: '1px solid #444',
  },
  footerSpacer: {
    flex: 1,
  },
  backButton: {
    backgroundColor: '#4a90e2',
    color: '#ffffff',
    border: 'none',
    borderRadius: '4px',
    padding: '8px 16px',
    fontSize: '12px',
    fontWeight: 'bold' as const,
    cursor: 'pointer',
    transition: 'background-color 0.2s',
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
  recordingContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px',
    height: '100%',
  },
  recordingPreview: {
    position: 'relative' as const,
    backgroundColor: '#1a1a1a',
    borderRadius: '6px',
    overflow: 'hidden',
    flex: 1,
    minHeight: '350px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  },
  recordingWebcamVideo: {
    position: 'absolute' as const,
    borderRadius: '6px',
    border: '3px solid #ffffff',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.6)',
    objectFit: 'cover' as const,
    aspectRatio: '16 / 9',
  },
  recordingControls: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px',
    backgroundColor: '#3a3a3a',
    borderRadius: '6px',
  },
  recordingTimer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  recordingIndicator: {
    width: '12px',
    height: '12px',
    backgroundColor: '#e74c3c',
    borderRadius: '50%',
    animation: 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
  },
  recordingTime: {
    fontSize: '18px',
    fontWeight: 'bold' as const,
    color: '#ffffff',
    fontFamily: 'monospace',
  },
  stopButton: {
    backgroundColor: '#e74c3c',
    color: '#ffffff',
    border: 'none',
    borderRadius: '4px',
    padding: '8px 16px',
    fontSize: '12px',
    fontWeight: 'bold' as const,
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
};
