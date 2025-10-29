/**
 * Recording Overlay Service
 * Creates a transparent overlay window on the recorded area
 * Shows a green outline to indicate active recording
 */

import { BrowserWindow, screen } from 'electron';
import path from 'path';
import { ScreenInfo } from '../../types/recording';

let overlayWindow: BrowserWindow | null = null;

/**
 * Show recording overlay on the specified screen/window
 */
export function showRecordingOverlay(screenInfo: ScreenInfo): boolean {
  try {
    console.log('[RecordingOverlay] Showing overlay for screen:', screenInfo.id);
    console.log('[RecordingOverlay] Screen info:', screenInfo);

    // If overlay already exists, destroy it first
    if (overlayWindow) {
      hideRecordingOverlay();
    }

    // Parse screen dimensions from resolution string (e.g., "2560x1080")
    const [width, height] = screenInfo.resolution.split('x').map(Number);

    console.log('[RecordingOverlay] Parsed dimensions:', { width, height });

    if (!width || !height) {
      console.error('[RecordingOverlay] Invalid screen resolution:', screenInfo.resolution);
      return false;
    }

    // Get the screen/window position
    let x = 0;
    let y = 0;

    // Log all displays for debugging
    const displays = screen.getAllDisplays();
    console.log('[RecordingOverlay] Available displays:', displays.length);
    displays.forEach((d, i) => {
      console.log(`[RecordingOverlay] Display ${i}:`, { id: d.id, bounds: d.bounds });
    });

    // Use displayId if available (works for both screens and windows)
    if (screenInfo.displayId) {
      console.log('[RecordingOverlay] Using displayId:', screenInfo.displayId);
      const targetDisplay = displays.find((d) => d.id === screenInfo.displayId);

      if (targetDisplay) {
        x = targetDisplay.bounds.x;
        y = targetDisplay.bounds.y;
        console.log('[RecordingOverlay] Found display by ID, position:', { x, y });
      } else {
        console.warn('[RecordingOverlay] Display with ID not found, using primary display');
        const primary = displays[0];
        x = primary.bounds.x;
        y = primary.bounds.y;
      }
    } else {
      // Fallback: For screens without displayId, try to match by screen number
      console.log('[RecordingOverlay] No displayId available, using fallback positioning');

      if (screenInfo.id.startsWith('screen:')) {
        const screenNumber = parseInt(screenInfo.id.split(':')[1]);
        console.log('[RecordingOverlay] Looking for screen number:', screenNumber);

        if (screenNumber < displays.length) {
          const display = displays[screenNumber];
          x = display.bounds.x;
          y = display.bounds.y;
          console.log('[RecordingOverlay] Found screen by number, position:', { x, y });
        } else {
          console.warn('[RecordingOverlay] Screen number out of range, using primary display');
          const primary = displays[0];
          x = primary.bounds.x;
          y = primary.bounds.y;
        }
      } else {
        // For windows without displayId, use primary display
        const primary = displays[0];
        x = primary.bounds.x;
        y = primary.bounds.y;
        console.log('[RecordingOverlay] Using primary display position:', { x, y });
      }
    }

    console.log('[RecordingOverlay] Creating overlay at:', { x, y, width, height });

    // Create transparent overlay window
    overlayWindow = new BrowserWindow({
      x,
      y,
      width,
      height,
      transparent: true,
      frame: false,
      alwaysOnTop: true,
      focusable: false,
      skipTaskbar: true,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, '../../preload.js'),
      },
    });

    console.log('[RecordingOverlay] BrowserWindow created');

    // Load the overlay HTML
    const overlayHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            width: 100%;
            height: 100%;
            background: transparent;
          }
          .overlay-border {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            border: 4px solid #22c55e;
            border-radius: 0;
            box-shadow: inset 0 0 20px rgba(34, 197, 94, 0.2);
            pointer-events: none;
            animation: recordingPulse 2s ease-in-out infinite;
          }
          .recording-label {
            position: fixed;
            top: 12px;
            right: 12px;
            background-color: #22c55e;
            color: #000000;
            padding: 6px 12px;
            border-radius: 4px;
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 12px;
            font-weight: bold;
            font-family: system-ui, -apple-system, sans-serif;
            z-index: 10000;
            letter-spacing: 0.5px;
          }
          .recording-dot {
            width: 8px;
            height: 8px;
            background-color: #000000;
            border-radius: 50%;
            animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
          }
          @keyframes recordingPulse {
            0%, 100% {
              box-shadow: inset 0 0 20px rgba(34, 197, 94, 0.15), 0 0 30px rgba(34, 197, 94, 0.2);
            }
            50% {
              box-shadow: inset 0 0 20px rgba(34, 197, 94, 0.3), 0 0 40px rgba(34, 197, 94, 0.4);
            }
          }
          @keyframes pulse {
            0%, 100% {
              opacity: 1;
            }
            50% {
              opacity: 0.5;
            }
          }
        </style>
      </head>
      <body>
        <div class="overlay-border"></div>
        <div class="recording-label">
          <span class="recording-dot"></span>
          <span>RECORDING</span>
        </div>
      </body>
      </html>
    `;

    overlayWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(overlayHtml)}`);
    console.log('[RecordingOverlay] HTML loaded');

    // Wait a bit for the content to load, then show
    setTimeout(() => {
      if (overlayWindow && !overlayWindow.isDestroyed()) {
        console.log('[RecordingOverlay] Showing overlay window');
        overlayWindow.show();

        // On some systems, we need to set it as always on top again after loading
        overlayWindow.setAlwaysOnTop(true, 'screen-saver');
        console.log('[RecordingOverlay] Overlay is now visible');
      }
    }, 100);

    console.log('[RecordingOverlay] Overlay created at:', { x, y, width, height });

    return true;
  } catch (error) {
    console.error('[RecordingOverlay] Error showing overlay:', error);
    overlayWindow = null;
    return false;
  }
}

/**
 * Hide the recording overlay
 */
export function hideRecordingOverlay(): void {
  try {
    if (overlayWindow) {
      console.log('[RecordingOverlay] Hiding overlay');
      overlayWindow.close();
      overlayWindow = null;
    }
  } catch (error) {
    console.error('[RecordingOverlay] Error hiding overlay:', error);
    overlayWindow = null;
  }
}

/**
 * Check if overlay is currently visible
 */
export function isOverlayVisible(): boolean {
  return overlayWindow !== null && !overlayWindow.isDestroyed();
}
