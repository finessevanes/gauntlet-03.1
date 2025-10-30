/**
 * App Component
 * Main entry point for React app
 * Handles initialization, loading state, and error handling
 */

import React, { useEffect, useState } from 'react';
import { useSessionStore } from '../store/sessionStore';
import { AppInitResponse } from '../types/ipc';
import { LoadingScreen } from './LoadingScreen';
import { ErrorDialog } from './ErrorDialog';
import { MainLayout } from './MainLayout';

export const App: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const setSession = useSessionStore((state) => state.setSession);

  useEffect(() => {
    initializeApp();
  }, []);

  /**
   * Initialize app by calling app:init IPC handler
   */
  const initializeApp = async () => {
    try {
      const startTime = performance.now();

      // Call app:init IPC handler
      const response = await window.electron.invoke<AppInitResponse>('app:init');

      // Check FFmpeg status
      if (response.ffmpegStatus === 'error') {
        console.error('[App] FFmpeg validation failed:', response.error);
        setError(response.error || 'Media processing unavailable. Please reinstall Klippy.');
        setLoading(false);
        return;
      }

      // Load session if available
      if (response.session) {
        setSession(response.session);
      }

      // Initialization complete
      setLoading(false);

    } catch (err) {
      console.error('[App] Initialization error:', err);
      setError(`Failed to initialize: ${err instanceof Error ? err.message : String(err)}`);
      setLoading(false);
    }
  };

  /**
   * Handle error dialog close (quit app)
   */
  const handleErrorClose = () => {
    window.electron.quit();
  };

  // Render loading screen
  if (loading) {
    return <LoadingScreen />;
  }

  // Render error dialog
  if (error) {
    return <ErrorDialog message={error} onClose={handleErrorClose} />;
  }

  // Render main layout
  return <MainLayout />;
};
