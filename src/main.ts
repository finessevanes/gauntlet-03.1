import { app, BrowserWindow, dialog } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import dotenv from 'dotenv';
import { registerAppHandlers } from './main/ipc-handlers/app';
import { registerImportHandlers } from './main/ipc-handlers/import';
import { registerLibraryHandlers } from './main/ipc-handlers/library';
import { registerTimelineHandlers } from './main/ipc-handlers/timeline';
import { registerTrimHandlers } from './main/ipc-handlers/trim';
import { registerExportHandlers } from './main/ipc-handlers/export';
import { registerRecordingHandlers, hasPiPRecordingActive } from './main/ipc-handlers/recording';
import { registerAIHandlers } from './main/ipc-handlers/ai';
import { cleanupAllActiveSessions, hasActiveRecordingSessions } from './main/services/screenRecordingService';

// Load environment variables from .env file
dotenv.config();

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// Track if user confirmed quit during recording
let confirmedQuitDuringRecording = false;

// Allow renderer process to load local file:// resources (needed for preview player)
app.commandLine.appendSwitch('allow-file-access-from-files');
app.commandLine.appendSwitch('allow-file-access-from-file-urls');

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    title: 'Klippy',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
      allowRunningInsecureContent: true,
      allowFileAccess: true,
    },
  });

  // Handle window close event - prevent closing during recording
  mainWindow.on('close', (event) => {
    // Check if there are active recording sessions (screen, webcam, or PiP)
    const hasActiveRecordings = hasActiveRecordingSessions() || hasPiPRecordingActive();

    if (hasActiveRecordings && !confirmedQuitDuringRecording) {
      console.log('[App] Active recording detected, showing confirmation dialog...');

      // Prevent the window from closing
      event.preventDefault();

      // Show confirmation dialog
      dialog.showMessageBox(mainWindow, {
        type: 'warning',
        title: 'Recording in Progress',
        message: 'A recording is currently in progress.',
        detail: 'If you quit now, your recording will be lost. Are you sure you want to quit?',
        buttons: ['Cancel', 'Quit Anyway'],
        defaultId: 0,
        cancelId: 0,
      }).then((result) => {
        if (result.response === 1) {
          // User clicked "Quit Anyway"
          console.log('[App] User confirmed quit during recording');
          confirmedQuitDuringRecording = true;
          mainWindow.close();
        } else {
          console.log('[App] User cancelled quit');
        }
      });
    }
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  // Open the DevTools in development
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.webContents.openDevTools();
  }
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
  // Register IPC handlers before creating window
  registerAppHandlers();
  registerImportHandlers();
  registerLibraryHandlers();
  registerTimelineHandlers();
  registerTrimHandlers();
  registerExportHandlers();
  registerRecordingHandlers(); // S9: Screen Recording
  registerAIHandlers(); // S9: Teleprompter

  // Create the main window
  createWindow();
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Handle app quit - cleanup any active recordings
app.on('before-quit', () => {
  console.log('[App] App is quitting, cleaning up active recordings...');
  cleanupAllActiveSessions();
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
