/**
 * Permission Checks - Proactive permission verification before operations
 * Checks permissions UPFRONT before attempting screen recording, camera access, or microphone access
 */

/**
 * Check if screen recording permission is granted
 * This is a backend check that queries macOS system permissions
 */
export async function checkScreenRecordingPermission(): Promise<{
  granted: boolean;
  error?: string;
}> {
  try {
    const response = await window.electron.recording.getScreens();

    if (response.error) {
      // If error contains "permission", it's a permission issue
      if (response.error.toLowerCase().includes('permission')) {
        return {
          granted: false,
          error: `${response.error}\n\nPlease enable Screen Recording permission in System Settings > Privacy & Security > Screen Recording, then restart this app and try again.`,
        };
      }
      // Other errors (no screens, etc.) still allow proceeding
      return {
        granted: true,
      };
    }

    return {
      granted: true,
    };
  } catch (error) {
    console.error('[permissionChecks] Error checking screen recording permission:', error);
    return {
      granted: false,
      error: `Failed to check screen recording permission.\n\nPlease ensure Screen Recording permission is enabled in System Settings > Privacy & Security > Screen Recording, then restart this app and try again.`,
    };
  }
}

/**
 * Check if camera permission is granted
 * Uses MediaDevices API to check camera access
 */
export async function checkCameraPermission(): Promise<{
  granted: boolean;
  error?: string;
}> {
  try {
    // Try to enumerate devices to check permission status
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoInputs = devices.filter((d) => d.kind === 'videoinput');

    if (videoInputs.length === 0) {
      return {
        granted: false,
        error: 'No camera found. Please connect a webcam and try again.',
      };
    }

    // If we have device labels, permission is already granted
    if (videoInputs[0].label) {
      return {
        granted: true,
      };
    }

    // Try to request permission
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((track) => track.stop());
      return {
        granted: true,
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          return {
            granted: false,
            error: 'Camera permission denied. Please enable it in System Settings > Privacy & Security > Camera, then restart this app and try again.',
          };
        }
      }
      throw error;
    }
  } catch (error) {
    console.error('[permissionChecks] Error checking camera permission:', error);

    if (error instanceof Error) {
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        return {
          granted: false,
          error: 'Camera permission denied. Please enable it in System Settings > Privacy & Security > Camera, then restart this app and try again.',
        };
      }
      if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        return {
          granted: false,
          error: 'No camera found. Please connect a webcam and try again.',
        };
      }
    }

    return {
      granted: false,
      error: error instanceof Error ? error.message : 'Failed to check camera permission',
    };
  }
}

/**
 * Check if microphone permission is granted
 * Uses MediaDevices API to check microphone access
 */
export async function checkMicrophonePermission(): Promise<{
  granted: boolean;
  error?: string;
}> {
  try {
    // Try to enumerate devices to check permission status
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = devices.filter((d) => d.kind === 'audioinput');

    if (audioInputs.length === 0) {
      return {
        granted: true, // No error if no devices, just silently handle
      };
    }

    // If we have device labels, permission is already granted
    if (audioInputs[0].label) {
      return {
        granted: true,
      };
    }

    // Try to request permission
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      return {
        granted: true,
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          return {
            granted: false,
            error: 'Microphone permission denied. Please enable it in System Settings > Privacy & Security > Microphone, then restart this app and try again.',
          };
        }
      }
      throw error;
    }
  } catch (error) {
    console.error('[permissionChecks] Error checking microphone permission:', error);

    if (error instanceof Error) {
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        return {
          granted: false,
          error: 'Microphone permission denied. Please enable it in System Settings > Privacy & Security > Microphone, then restart this app and try again.',
        };
      }
    }

    return {
      granted: false,
      error: error instanceof Error ? error.message : 'Failed to check microphone permission',
    };
  }
}

/**
 * Check both camera and microphone permissions (for webcam recording)
 */
export async function checkCameraAndMicrophonePermission(): Promise<{
  granted: boolean;
  error?: string;
  errorType?: 'camera' | 'microphone';
}> {
  try {
    // First check camera
    const cameraCheck = await checkCameraPermission();
    if (!cameraCheck.granted) {
      return {
        granted: false,
        error: cameraCheck.error,
        errorType: 'camera',
      };
    }

    // Then check microphone
    const micCheck = await checkMicrophonePermission();
    if (!micCheck.granted) {
      return {
        granted: false,
        error: micCheck.error,
        errorType: 'microphone',
      };
    }

    return {
      granted: true,
    };
  } catch (error) {
    console.error('[permissionChecks] Error checking camera and microphone permissions:', error);
    return {
      granted: false,
      error: error instanceof Error ? error.message : 'Failed to check permissions',
    };
  }
}
