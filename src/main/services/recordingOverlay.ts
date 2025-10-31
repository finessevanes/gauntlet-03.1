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
      focusable: true,
      skipTaskbar: true,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: false,  // Disabled to allow inline script execution
        preload: undefined,  // No preload needed for overlay
      },
    });

    // Open DevTools for debugging
    if (process.env.NODE_ENV === 'development') {
      overlayWindow.webContents.openDevTools({ mode: 'detach' });
    }

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
            width: 100vw;
            height: 100vh;
            background: transparent;
            overflow: hidden;
          }
          .overlay-container {
            position: fixed;
            top: 0;
            left: 0;
            border: 4px solid #22c55e;
            border-radius: 0;
            box-shadow: inset 0 0 20px rgba(34, 197, 94, 0.2);
            animation: recordingPulse 2s ease-in-out infinite;
            cursor: move;
            user-select: none;
          }
          .overlay-container.resizing {
            cursor: nwse-resize;
          }
          .recording-label {
            position: absolute;
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
            letter-spacing: 0.5px;
            pointer-events: none;
          }
          .recording-dot {
            width: 8px;
            height: 8px;
            background-color: #000000;
            border-radius: 50%;
            animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
          }
          .resize-handle {
            position: absolute;
            width: 16px;
            height: 16px;
            background-color: rgba(34, 197, 94, 0.6);
            border: 2px solid #22c55e;
            border-radius: 50%;
            cursor: nwse-resize;
            z-index: 10001;
          }
          .resize-handle.se {
            bottom: -8px;
            right: -8px;
            cursor: se-resize;
          }
          .resize-handle.sw {
            bottom: -8px;
            left: -8px;
            cursor: sw-resize;
          }
          .resize-handle.ne {
            top: -8px;
            right: -8px;
            cursor: ne-resize;
          }
          .resize-handle.nw {
            top: -8px;
            left: -8px;
            cursor: nw-resize;
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
        <div class="overlay-container" id="overlay">
          <div class="recording-label">
            <span class="recording-dot"></span>
            <span>RECORDING</span>
          </div>
          <div class="resize-handle nw"></div>
          <div class="resize-handle ne"></div>
          <div class="resize-handle sw"></div>
          <div class="resize-handle se"></div>
        </div>
        <script>
          console.log('[OverlayDebug] Script loaded');

          let isDragging = false;
          let isResizing = false;
          let startX = 0;
          let startY = 0;
          let startWidth = 0;
          let startHeight = 0;
          let resizeDirection = null;

          const overlay = document.getElementById('overlay');
          const resizeHandles = document.querySelectorAll('.resize-handle');

          console.log('[OverlayDebug] Overlay element:', overlay);
          console.log('[OverlayDebug] Resize handles found:', resizeHandles.length);

          // Load saved position and size
          const saved = localStorage.getItem('overlayState');
          if (saved) {
            const state = JSON.parse(saved);
            console.log('[OverlayDebug] Loaded saved state:', state);
            overlay.style.top = state.y + 'px';
            overlay.style.left = state.x + 'px';
            overlay.style.width = state.width + 'px';
            overlay.style.height = state.height + 'px';
          } else {
            console.log('[OverlayDebug] No saved state found');
          }

          // Save state periodically
          function saveState() {
            const state = {
              x: parseInt(overlay.style.left) || 0,
              y: parseInt(overlay.style.top) || 0,
              width: overlay.offsetWidth,
              height: overlay.offsetHeight
            };
            console.log('[OverlayDebug] Saving state:', state);
            localStorage.setItem('overlayState', JSON.stringify(state));
          }

          // Dragging
          overlay.addEventListener('mousedown', (e) => {
            console.log('[OverlayDebug] Mousedown on overlay, target:', e.target);
            console.log('[OverlayDebug] Target has resize-handle class:', e.target.classList.contains('resize-handle'));

            if (e.target.classList.contains('resize-handle')) {
              console.log('[OverlayDebug] Mousedown on resize handle, skipping drag');
              return;
            }

            console.log('[OverlayDebug] Starting drag');
            isDragging = true;
            startX = e.clientX - parseInt(overlay.style.left);
            startY = e.clientY - parseInt(overlay.style.top);
            overlay.style.cursor = 'grabbing';
            console.log('[OverlayDebug] Drag started at:', { clientX: e.clientX, clientY: e.clientY, startX, startY });
          });

          document.addEventListener('mousemove', (e) => {
            if (isDragging) {
              const newX = e.clientX - startX;
              const newY = e.clientY - startY;
              overlay.style.left = Math.max(0, newX) + 'px';
              overlay.style.top = Math.max(0, newY) + 'px';
              saveState();
            } else if (isResizing) {
              const deltaX = e.clientX - startX;
              const deltaY = e.clientY - startY;

              if (resizeDirection.includes('e')) {
                overlay.style.width = Math.max(100, startWidth + deltaX) + 'px';
              }
              if (resizeDirection.includes('s')) {
                overlay.style.height = Math.max(100, startHeight + deltaY) + 'px';
              }
              if (resizeDirection.includes('w')) {
                const newWidth = Math.max(100, startWidth - deltaX);
                const newX = startX + (startWidth - newWidth);
                overlay.style.width = newWidth + 'px';
                overlay.style.left = newX + 'px';
              }
              if (resizeDirection.includes('n')) {
                const newHeight = Math.max(100, startHeight - deltaY);
                const newY = startY + (startHeight - newHeight);
                overlay.style.height = newHeight + 'px';
                overlay.style.top = newY + 'px';
              }
              saveState();
            }
          });

          document.addEventListener('mouseup', () => {
            if (isDragging) {
              console.log('[OverlayDebug] Drag ended');
            }
            if (isResizing) {
              console.log('[OverlayDebug] Resize ended');
            }
            isDragging = false;
            isResizing = false;
            resizeDirection = null;
            overlay.style.cursor = 'move';
          });

          // Resizing
          resizeHandles.forEach((handle, index) => {
            console.log('[OverlayDebug] Setting up resize handle:', index, handle.className);
            handle.addEventListener('mousedown', (e) => {
              console.log('[OverlayDebug] Mousedown on resize handle:', handle.className);
              e.stopPropagation();
              isResizing = true;
              startX = e.clientX;
              startY = e.clientY;
              startWidth = overlay.offsetWidth;
              startHeight = overlay.offsetHeight;
              resizeDirection = handle.className.split(' ')[1];
              console.log('[OverlayDebug] Resize started, direction:', resizeDirection);
            });
          });

          console.log('[OverlayDebug] All event listeners attached');
        </script>
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
