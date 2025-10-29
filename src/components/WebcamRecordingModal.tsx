/**
 * WebcamRecordingModal Component
 * Modal dialog for webcam recording with live preview
 * Story S10: Webcam Recording
 */

import React, { useEffect, useState, useRef } from 'react';
import { app } from 'electron';
import { usePermissionModal } from '../context/PermissionContext';
import { checkCameraAndMicrophonePermission } from '../utils/permissionChecks';
import { usePermissionGate } from '../hooks/usePermissionGate';
import { openPermissionModalWithCallbacks } from '../utils/permissionModalHelper';
import { useMediaPermissions } from '../hooks/useMediaPermissions';

interface WebcamRecordingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRecordingComplete: (filePath: string) => void;
}

type RecordingStatus = 'idle' | 'preview' | 'recording' | 'saving' | 'error';

export const WebcamRecordingModal: React.FC<WebcamRecordingModalProps> = ({
  isOpen,
  onClose,
  onRecordingComplete,
}) => {
  const permissionModal = usePermissionModal();
  const shouldRender = usePermissionGate(isOpen);

  // Use the consolidated media permissions hook for both camera and microphone
  const {
    cameraDevices,
    audioDevices,
  } = useMediaPermissions({
    checkCamera: true,
    checkMicrophone: true,
    autoEnumerate: false
  });

  const [status, setStatus] = useState<RecordingStatus>('idle');
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [selectedMicrophoneId, setSelectedMicrophoneId] = useState<string>('');
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [startTime, setStartTime] = useState<number>(0);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isOpen) {
      initializeModal();
    } else {
      cleanupCamera();
    }

    return () => {
      cleanupCamera();
    };
  }, [isOpen]);

  /**
   * Initialize modal by checking permissions first
   */
  const initializeModal = async () => {
    console.log('[WebcamModal] Initializing modal - checking permissions upfront...');

    // Check camera and microphone permissions FIRST
    const permissionCheck = await checkCameraAndMicrophonePermission();

    if (!permissionCheck.granted) {
      console.log('[WebcamModal] Permission denied:', permissionCheck.errorType);
      const permissionType = permissionCheck.errorType || 'camera';
      openPermissionModalWithCallbacks({
        permissionModal,
        type: permissionType as 'camera' | 'microphone',
        errorMessage: permissionCheck.error || 'Permission denied',
        onRetry: initializeModal,
        onCancel: onClose,
      });
      setStatus('error');
      return;
    }

    // If permissions OK, proceed with camera initialization
    initializeCamera();
  };

  useEffect(() => {
    if (mediaStream && videoRef.current) {
      videoRef.current.srcObject = mediaStream;
    }
  }, [mediaStream]);

  /**
   * Initialize camera and enumerate devices
   */
  const initializeCamera = async () => {
    setStatus('idle');
    setErrorMessage('');

    try {
      console.log('[WebcamModal] Enumerating camera devices...');

      // First enumerate to check if cameras exist
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter((d) => d.kind === 'videoinput');

      if (videoInputs.length === 0) {
        setStatus('error');
        setErrorMessage('No camera found. Please connect a webcam and try again.');
        return;
      }

      console.log(`[WebcamModal] Found ${videoInputs.length} camera(s)`);

      // Request camera permission
      console.log('[WebcamModal] Requesting camera + microphone permission...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });

      console.log('[WebcamModal] Permission granted!');

      setMediaStream(stream);
      setStatus('preview');

      // Auto-select first camera and microphone from hook's device lists
      if (cameraDevices.length > 0) {
        setSelectedCameraId(cameraDevices[0].deviceId);
      }
      if (audioDevices.length > 0) {
        setSelectedMicrophoneId(audioDevices[0].deviceId);
      }

    } catch (error) {
      console.error('[WebcamModal] Error accessing camera:', error);
      setStatus('error');

      if (error instanceof Error) {
        let errorMsg = '';

        // Permission errors should have been caught upfront, so these are device errors
        if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
          errorMsg = 'No camera found. Please connect a webcam and try again.';
        } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
          errorMsg = 'Camera is already in use by another application. Please close other apps and try again.';
        } else {
          errorMsg = `Failed to access camera: ${error.message}`;
        }

        setErrorMessage(errorMsg);
      } else {
        setErrorMessage('An unknown error occurred while accessing the camera.');
      }
    }
  };

  /**
   * Cleanup camera stream
   */
  const cleanupCamera = () => {
    console.log('[WebcamModal] Cleaning up camera...');

    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }

    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop());
      setMediaStream(null);
    }

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    // Notify main process that webcam recording has stopped
    window.electron.recording.setWebcamStatus(false);

    setRecordedChunks([]);
    setStatus('idle');
    setElapsedSeconds(0);
  };

  /**
   * Switch camera device
   */
  const switchCamera = async (deviceId: string) => {
    console.log('[WebcamModal] Switching camera to:', deviceId);
    setSelectedCameraId(deviceId);

    try {
      // Stop current stream
      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop());
      }

      // Request new stream with selected camera and current microphone
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId } },
        audio: selectedMicrophoneId ? { deviceId: { exact: selectedMicrophoneId } } : true,
      });

      setMediaStream(stream);
      console.log('[WebcamModal] Camera switched successfully');
    } catch (error) {
      console.error('[WebcamModal] Error switching camera:', error);
      setStatus('error');
      setErrorMessage('Failed to switch camera. Please try again.');
    }
  };

  /**
   * Switch microphone device
   */
  const switchMicrophone = async (deviceId: string) => {
    console.log('[WebcamModal] Switching microphone to:', deviceId);
    setSelectedMicrophoneId(deviceId);

    try {
      // Stop current stream
      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop());
      }

      // Request new stream with current camera and selected microphone
      const stream = await navigator.mediaDevices.getUserMedia({
        video: selectedCameraId ? { deviceId: { exact: selectedCameraId } } : true,
        audio: { deviceId: { exact: deviceId } },
      });

      setMediaStream(stream);
      console.log('[WebcamModal] Microphone switched successfully');
    } catch (error) {
      console.error('[WebcamModal] Error switching microphone:', error);
      setStatus('error');
      setErrorMessage('Failed to switch microphone. Please try again.');
    }
  };

  /**
   * Start recording
   */
  const handleStartRecording = () => {
    if (!mediaStream) {
      setStatus('error');
      setErrorMessage('No camera stream available');
      return;
    }

    console.log('[WebcamModal] Starting recording...');

    try {
      // Determine supported mime type
      let mimeType = 'video/webm;codecs=vp8,opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm';
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = '';
      }

      console.log('[WebcamModal] Using mime type:', mimeType || 'default');

      const recorder = new MediaRecorder(mediaStream, mimeType ? { mimeType } : undefined);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          console.log('[WebcamModal] Data chunk received:', e.data.size, 'bytes');
          chunks.push(e.data);
        }
      };

      recorder.onstop = async () => {
        console.log('[WebcamModal] Recording stopped. Total chunks:', chunks.length);
        setRecordedChunks(chunks);
        await encodeAndSave(chunks, mimeType);
      };

      recorder.onerror = (e) => {
        console.error('[WebcamModal] MediaRecorder error:', e);
        setStatus('error');
        setErrorMessage('Recording failed. Please try again.');
      };

      recorder.start(1000); // Capture in 1-second chunks
      setMediaRecorder(recorder);
      setStatus('recording');
      setStartTime(Date.now());
      setElapsedSeconds(0);

      // Start timer
      timerIntervalRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);

      // Notify main process that webcam recording has started
      window.electron.recording.setWebcamStatus(true);

      console.log('[WebcamModal] Recording started successfully');
    } catch (error) {
      console.error('[WebcamModal] Error starting recording:', error);
      setStatus('error');
      setErrorMessage('Failed to start recording. Please try again.');
    }
  };

  /**
   * Stop recording
   */
  const handleStopRecording = () => {
    console.log('[WebcamModal] Stopping recording...');

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    // Notify main process that webcam recording has stopped
    window.electron.recording.setWebcamStatus(false);

    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      // encodeAndSave will be called in mediaRecorder.onstop
    } else {
      setStatus('error');
      setErrorMessage('No active recording to stop');
    }
  };

  /**
   * Encode recording and save to file
   */
  const encodeAndSave = async (chunks: Blob[], mimeType: string) => {
    setStatus('saving');
    console.log('[WebcamModal] Encoding recording...');

    try {
      // Combine chunks into single blob
      const recordedBlob = new Blob(chunks, { type: mimeType || 'video/webm' });
      console.log('[WebcamModal] Combined blob size:', recordedBlob.size, 'bytes');

      if (recordedBlob.size === 0) {
        setStatus('error');
        setErrorMessage('Recording failed: no data captured');
        return;
      }

      // Get video dimensions from the video element
      const width = videoRef.current?.videoWidth || 1280;
      const height = videoRef.current?.videoHeight || 720;

      console.log('[WebcamModal] Video dimensions:', width, 'x', height);

      // Generate output path using recordings directory (not temp)
      const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0].replace('T', '_');
      const filename = `Webcam_${timestamp}.mp4`;

      // Get recordings directory path from main process
      const outputPath = await window.electron.invoke('app:get-recordings-path', filename);

      console.log('[WebcamModal] Output path:', outputPath);

      // Convert Blob to ArrayBuffer for IPC
      const arrayBuffer = await recordedBlob.arrayBuffer();

      // Call IPC handler to encode
      console.log('[WebcamModal] Calling encode IPC handler...');
      const result = await window.electron.recording.encodeWebcamRecording({
        recordedBlob: arrayBuffer,
        outputPath,
        mimeType: recordedBlob.type,
        width,
        height,
      });

      if (result.success && result.filePath) {
        console.log('[WebcamModal] Encoding complete:', result.filePath);
        setStatus('preview');
        cleanupCamera();
        onRecordingComplete(result.filePath);
        onClose();
      } else {
        console.error('[WebcamModal] Encoding failed:', result.error);
        setStatus('error');
        setErrorMessage(result.error || 'Failed to encode recording');
      }
    } catch (error) {
      console.error('[WebcamModal] Error encoding recording:', error);
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Failed to save recording');
    }
  };

  /**
   * Format elapsed time as MM:SS
   */
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  /**
   * Retry after error
   */
  const handleRetry = () => {
    cleanupCamera();
    initializeCamera();
  };

  if (!shouldRender) {
    return null;
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.dialog}>
        <div style={styles.header}>
          <h2 style={styles.title}>Record Webcam</h2>
          <button style={styles.closeButton} onClick={() => {
            cleanupCamera();
            onClose();
          }}>
            ×
          </button>
        </div>

        <div style={styles.content}>
          {/* Error State */}
          {status === 'error' && (
            <div style={styles.errorContainer}>
              <p style={styles.errorText}>{errorMessage}</p>
              <div style={styles.errorButtons}>
                <button style={styles.retryButton} onClick={handleRetry}>
                  Retry
                </button>
                <button style={styles.cancelButton} onClick={() => {
                  cleanupCamera();
                  onClose();
                }}>
                  Close
                </button>
              </div>
            </div>
          )}

          {/* Loading / Idle State */}
          {status === 'idle' && !errorMessage && (
            <div style={styles.loadingContainer}>
              <div style={styles.spinner}>Initializing camera...</div>
            </div>
          )}

          {/* Preview / Recording State */}
          {(status === 'preview' || status === 'recording') && (
            <div style={styles.previewContainer}>
              <video
                ref={videoRef}
                autoPlay
                muted
                style={styles.video}
              />

              {status === 'recording' && (
                <div style={styles.recordingOverlay}>
                  <div style={styles.recordingIndicator}>
                    <span style={styles.recordingDot}>●</span>
                    <span style={styles.recordingText}>REC</span>
                    <span style={styles.timer}>{formatTime(elapsedSeconds)}</span>
                  </div>
                </div>
              )}

              {/* Camera selector (only show if multiple cameras) */}
              {cameraDevices.length > 1 && status === 'preview' && (
                <div style={styles.cameraSelector}>
                  <label style={styles.cameraSelectorLabel}>
                    <span>Camera:</span>
                    <select
                      value={selectedCameraId}
                      onChange={(e) => switchCamera(e.target.value)}
                      style={styles.cameraDropdown}
                    >
                      {cameraDevices.map((camera) => (
                        <option key={camera.deviceId} value={camera.deviceId}>
                          {camera.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}

              {/* Microphone selector (only show if multiple microphones) */}
              {audioDevices.length > 1 && status === 'preview' && (
                <div style={styles.microphoneSelector}>
                  <label style={styles.microphoneSelectorLabel}>
                    <span>Microphone:</span>
                    <select
                      value={selectedMicrophoneId}
                      onChange={(e) => switchMicrophone(e.target.value)}
                      style={styles.microphoneDropdown}
                    >
                      {audioDevices.map((microphone) => (
                        <option key={microphone.deviceId} value={microphone.deviceId}>
                          {microphone.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
            </div>
          )}

          {/* Saving State */}
          {status === 'saving' && (
            <div style={styles.savingContainer}>
              <div style={styles.spinner}>Saving recording...</div>
              <p style={styles.savingText}>Please wait while we encode your video...</p>
            </div>
          )}
        </div>

        <div style={styles.footer}>
          {status === 'preview' && (
            <>
              <button style={styles.backButton} onClick={() => {
                cleanupCamera();
                onClose();
              }}>
                ← Back
              </button>
              <div style={styles.footerSpacer}></div>
              <button style={styles.cancelButton} onClick={() => {
                cleanupCamera();
                onClose();
              }}>
                Cancel
              </button>
              <button style={styles.startButton} onClick={handleStartRecording}>
                Start Recording
              </button>
            </>
          )}

          {status === 'recording' && (
            <button style={styles.stopButton} onClick={handleStopRecording}>
              Stop Recording
            </button>
          )}

          {(status === 'saving' || status === 'idle') && (
            <button style={{ ...styles.cancelButton, ...styles.disabledButton }} disabled>
              Please wait...
            </button>
          )}
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
    width: '700px',
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
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '400px',
  },
  previewContainer: {
    position: 'relative' as const,
    width: '100%',
    maxWidth: '640px',
    backgroundColor: '#000',
    borderRadius: '8px',
    overflow: 'hidden',
  },
  video: {
    width: '100%',
    height: 'auto',
    display: 'block',
    backgroundColor: '#000',
  },
  recordingOverlay: {
    position: 'absolute' as const,
    top: '16px',
    left: '16px',
  },
  recordingIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: '8px 12px',
    borderRadius: '4px',
  },
  recordingDot: {
    color: '#e74c3c',
    fontSize: '20px',
    animation: 'blink 1s infinite',
  },
  recordingText: {
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: 'bold' as const,
  },
  timer: {
    color: '#ffffff',
    fontSize: '14px',
    fontFamily: 'monospace',
    marginLeft: '8px',
  },
  cameraSelector: {
    position: 'absolute' as const,
    bottom: '16px',
    left: '16px',
    right: '16px',
  },
  cameraSelectorLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: '8px 12px',
    borderRadius: '4px',
    color: '#ffffff',
    fontSize: '13px',
  },
  cameraDropdown: {
    backgroundColor: '#2c2c2c',
    color: '#ffffff',
    border: '1px solid #555',
    borderRadius: '4px',
    padding: '4px 8px',
    fontSize: '12px',
    cursor: 'pointer',
    outline: 'none',
  },
  microphoneSelector: {
    position: 'absolute' as const,
    bottom: '56px',
    left: '16px',
    right: '16px',
  },
  microphoneSelectorLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: '8px 12px',
    borderRadius: '4px',
    color: '#ffffff',
    fontSize: '13px',
  },
  microphoneDropdown: {
    backgroundColor: '#2c2c2c',
    color: '#ffffff',
    border: '1px solid #555',
    borderRadius: '4px',
    padding: '4px 8px',
    fontSize: '12px',
    cursor: 'pointer',
    outline: 'none',
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
    gap: '20px',
  },
  errorText: {
    color: '#e74c3c',
    fontSize: '14px',
    textAlign: 'center' as const,
    maxWidth: '400px',
    margin: 0,
    lineHeight: '1.5',
  },
  errorButtons: {
    display: 'flex',
    gap: '12px',
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
  savingContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'center',
    alignItems: 'center',
    padding: '40px',
    gap: '16px',
  },
  savingText: {
    color: '#aaaaaa',
    fontSize: '13px',
    margin: 0,
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
  stopButton: {
    backgroundColor: '#e74c3c',
    color: '#ffffff',
    border: 'none',
    borderRadius: '4px',
    padding: '8px 16px',
    fontSize: '12px',
    fontWeight: 'bold' as const,
    cursor: 'pointer',
    flex: 1,
  },
  disabledButton: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
};
