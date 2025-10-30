/**
 * Keyboard Shortcut Handlers (Story 13: Split & Advanced Trim)
 * Registers global keyboard shortcuts for split operation
 */

import { ipcMain, globalShortcut, BrowserWindow } from 'electron';

/**
 * Register global keyboard shortcuts
 * Shortcuts: Cmd+X (macOS) / Ctrl+X (Windows) for split operation
 */
export function registerKeyboardHandlers() {
  // Register the split shortcut (Cmd+X on macOS, Ctrl+X on Windows)
  const shortcutSuccess = globalShortcut.register('CmdOrCtrl+X', () => {
    // Send message to renderer process
    const mainWindow = BrowserWindow.getFocusedWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      console.log('[Keyboard] Split shortcut triggered (Cmd/Ctrl+X)');
      mainWindow.webContents.send('split-clip-shortcut');
    }
  });

  if (shortcutSuccess) {
    console.log('[Keyboard] Split shortcut registered: Cmd+X (macOS) / Ctrl+X (Windows)');
  } else {
    console.error('[Keyboard] Failed to register split shortcut');
  }

  // Handle app quit to unregister shortcuts and prevent memory leaks
  // Note: app.on('will-quit') is registered in main.ts, not here
}

/**
 * IPC handler for testing if a shortcut is available
 * (Not used in production, just for diagnostics)
 */
export function registerKeyboardDiagnostics() {
  ipcMain.handle('keyboard:is-registered', (event, shortcutKey: string) => {
    return globalShortcut.isRegistered(shortcutKey);
  });
}
