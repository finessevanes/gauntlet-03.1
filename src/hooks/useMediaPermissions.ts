/**
 * useMediaPermissions Hook
 *
 * Consolidates all media permission checking and device enumeration logic.
 * Handles microphone and camera permissions, device listing, and permission change listeners.
 *
 * This hook eliminates ~150+ lines of duplicated code across:
 * - RecordScreenDialog.tsx
 * - WebcamRecordingModal.tsx
 * - PiPRecordingModal.tsx
 */

import { useState, useEffect, useCallback } from 'react';

export type PermissionStatus = 'prompt' | 'granted' | 'denied';

export interface MediaDevice {
  deviceId: string;
  label: string;
}

export interface UseMediaPermissionsOptions {
  /** Whether to check microphone permissions */
  checkMicrophone?: boolean;
  /** Whether to check camera permissions */
  checkCamera?: boolean;
  /** Whether to automatically enumerate devices on mount */
  autoEnumerate?: boolean;
}

export interface UseMediaPermissionsReturn {
  // Microphone
  microphonePermissionStatus: PermissionStatus;
  audioDevices: MediaDevice[];
  checkMicrophonePermission: () => Promise<void>;
  requestMicrophonePermission: () => Promise<void>;
  enumerateAudioDevices: () => Promise<void>;

  // Camera
  cameraPermissionStatus: PermissionStatus;
  cameraDevices: MediaDevice[];
  checkCameraPermission: () => Promise<void>;
  requestCameraPermission: () => Promise<void>;
  enumerateCameraDevices: () => Promise<void>;
}

/**
 * Custom hook for managing media permissions and device enumeration
 */
export const useMediaPermissions = (
  options: UseMediaPermissionsOptions = {}
): UseMediaPermissionsReturn => {
  const {
    checkMicrophone = false,
    checkCamera = false,
    autoEnumerate = false,
  } = options;

  // Microphone state
  const [microphonePermissionStatus, setMicrophonePermissionStatus] = useState<PermissionStatus>('prompt');
  const [audioDevices, setAudioDevices] = useState<MediaDevice[]>([]);

  // Camera state
  const [cameraPermissionStatus, setCameraPermissionStatus] = useState<PermissionStatus>('prompt');
  const [cameraDevices, setCameraDevices] = useState<MediaDevice[]>([]);

  /**
   * Check microphone permission status
   */
  const checkMicrophonePermission = useCallback(async () => {
    try {
      // Check if Permissions API is available
      if (navigator.permissions && navigator.permissions.query) {
        const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        console.log('[useMediaPermissions] Microphone permission status:', result.state);
        setMicrophonePermissionStatus(result.state as PermissionStatus);

        // Listen for permission changes
        result.onchange = () => {
          console.log('[useMediaPermissions] Microphone permission changed to:', result.state);
          setMicrophonePermissionStatus(result.state as PermissionStatus);
          enumerateAudioDevices();
        };
      } else {
        console.log('[useMediaPermissions] Permissions API not available');
        // Try to enumerate devices to infer permission status
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter((d) => d.kind === 'audioinput');

        // If we have device labels, permission is granted
        if (audioInputs.length > 0 && audioInputs[0].label) {
          setMicrophonePermissionStatus('granted');
        } else {
          setMicrophonePermissionStatus('prompt');
        }
      }
    } catch (err) {
      console.error('[useMediaPermissions] Error checking microphone permission:', err);
      setMicrophonePermissionStatus('prompt');
    }
  }, []);

  /**
   * Request microphone permission
   */
  const requestMicrophonePermission = useCallback(async () => {
    try {
      console.log('[useMediaPermissions] Requesting microphone permission...');

      // Request permission by calling getUserMedia
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Stop the stream immediately (we just needed it to trigger permission)
      stream.getTracks().forEach((track) => track.stop());

      console.log('[useMediaPermissions] Microphone permission granted');

      // Refresh permission status and device list
      await checkMicrophonePermission();
      await enumerateAudioDevices();
    } catch (err) {
      console.error('[useMediaPermissions] Microphone permission denied:', err);
      setMicrophonePermissionStatus('denied');
    }
  }, [checkMicrophonePermission]);

  /**
   * Enumerate audio input devices
   */
  const enumerateAudioDevices = useCallback(async () => {
    try {
      console.log('[useMediaPermissions] Enumerating audio devices...');
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter((device) => device.kind === 'audioinput');

      console.log(`[useMediaPermissions] Found ${audioInputs.length} audio input device(s)`);

      const audioDeviceList: MediaDevice[] = audioInputs.map((device) => ({
        deviceId: device.deviceId,
        label: device.label || `Microphone ${device.deviceId.slice(0, 8)}...`,
      }));

      setAudioDevices(audioDeviceList);
    } catch (err) {
      console.error('[useMediaPermissions] Error enumerating audio devices:', err);
      setAudioDevices([]);
    }
  }, []);

  /**
   * Check camera permission status
   */
  const checkCameraPermission = useCallback(async () => {
    try {
      // Check if Permissions API is available
      if (navigator.permissions && navigator.permissions.query) {
        const result = await navigator.permissions.query({ name: 'camera' as PermissionName });
        console.log('[useMediaPermissions] Camera permission status:', result.state);
        setCameraPermissionStatus(result.state as PermissionStatus);

        // Listen for permission changes
        result.onchange = () => {
          console.log('[useMediaPermissions] Camera permission changed to:', result.state);
          setCameraPermissionStatus(result.state as PermissionStatus);
          enumerateCameraDevices();
        };
      } else {
        console.log('[useMediaPermissions] Permissions API not available');
        // Try to enumerate devices to infer permission status
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter((d) => d.kind === 'videoinput');

        // If we have device labels, permission is granted
        if (videoInputs.length > 0 && videoInputs[0].label) {
          setCameraPermissionStatus('granted');
        } else {
          setCameraPermissionStatus('prompt');
        }
      }
    } catch (err) {
      console.error('[useMediaPermissions] Error checking camera permission:', err);
      setCameraPermissionStatus('prompt');
    }
  }, []);

  /**
   * Request camera permission
   */
  const requestCameraPermission = useCallback(async () => {
    try {
      console.log('[useMediaPermissions] Requesting camera permission...');

      // Request permission by calling getUserMedia
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });

      // Stop the stream immediately (we just needed it to trigger permission)
      stream.getTracks().forEach((track) => track.stop());

      console.log('[useMediaPermissions] Camera permission granted');

      // Refresh permission status and device list
      await checkCameraPermission();
      await enumerateCameraDevices();
    } catch (err) {
      console.error('[useMediaPermissions] Camera permission denied:', err);
      setCameraPermissionStatus('denied');
    }
  }, [checkCameraPermission]);

  /**
   * Enumerate video input devices (cameras)
   */
  const enumerateCameraDevices = useCallback(async () => {
    try {
      console.log('[useMediaPermissions] Enumerating camera devices...');
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter((device) => device.kind === 'videoinput');

      console.log(`[useMediaPermissions] Found ${videoInputs.length} camera device(s)`);

      const cameraDeviceList: MediaDevice[] = videoInputs.map((device) => ({
        deviceId: device.deviceId,
        label: device.label || `Camera ${device.deviceId.slice(0, 8)}...`,
      }));

      setCameraDevices(cameraDeviceList);
    } catch (err) {
      console.error('[useMediaPermissions] Error enumerating camera devices:', err);
      setCameraDevices([]);
    }
  }, []);

  // Initialize on mount if auto-enumerate is enabled
  useEffect(() => {
    if (checkMicrophone && autoEnumerate) {
      checkMicrophonePermission();
      enumerateAudioDevices();
    }

    if (checkCamera && autoEnumerate) {
      checkCameraPermission();
      enumerateCameraDevices();
    }
  }, [
    checkMicrophone,
    checkCamera,
    autoEnumerate,
    checkMicrophonePermission,
    checkCameraPermission,
    enumerateAudioDevices,
    enumerateCameraDevices,
  ]);

  // Listen for device changes
  useEffect(() => {
    const handleDeviceChange = () => {
      console.log('[useMediaPermissions] Devices changed, re-enumerating...');
      if (checkMicrophone) {
        enumerateAudioDevices();
      }
      if (checkCamera) {
        enumerateCameraDevices();
      }
    };

    if (navigator.mediaDevices) {
      navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);

      return () => {
        navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
      };
    }
  }, [checkMicrophone, checkCamera, enumerateAudioDevices, enumerateCameraDevices]);

  return {
    // Microphone
    microphonePermissionStatus,
    audioDevices,
    checkMicrophonePermission,
    requestMicrophonePermission,
    enumerateAudioDevices,

    // Camera
    cameraPermissionStatus,
    cameraDevices,
    checkCameraPermission,
    requestCameraPermission,
    enumerateCameraDevices,
  };
};
