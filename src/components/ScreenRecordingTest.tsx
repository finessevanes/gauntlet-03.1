/**
 * ScreenRecordingTest Component
 * Minimal test to validate desktopCapturer API works
 * Story S9: Screen Recording - Technology Validation
 */

import React, { useState } from 'react';
import { ScreenInfo } from '../types/recording';

export const ScreenRecordingTest: React.FC = () => {
  const [screens, setScreens] = useState<ScreenInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<string>('');

  /**
   * Test 1: Get available screens
   */
  const testGetScreens = async () => {
    setLoading(true);
    setError(null);
    setTestStatus('Testing desktopCapturer API...');

    try {
      console.log('[Test] Calling recording:get-screens...');
      const response = await window.electron.recording.getScreens();

      if (response.error) {
        setError(response.error);
        setTestStatus('❌ Failed: ' + response.error);
        setScreens([]);
      } else {
        console.log('[Test] Success! Found screens:', response.screens);
        setScreens(response.screens);
        setTestStatus(`✅ Success! Found ${response.screens.length} screen(s)`);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('[Test] Error:', err);
      setError(errorMsg);
      setTestStatus('❌ Error: ' + errorMsg);
      setScreens([]);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Test 2: Create recording session
   */
  const testCreateSession = async (screenId: string) => {
    setTestStatus('Testing session creation...');

    try {
      console.log('[Test] Creating session for screen:', screenId);
      const response = await window.electron.recording.createSession(screenId, true);

      if (response.success && response.sessionId) {
        console.log('[Test] Session created:', response.sessionId);
        setTestStatus(`✅ Session created: ${response.sessionId}`);
      } else {
        setTestStatus('❌ Failed to create session: ' + response.error);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('[Test] Error:', err);
      setTestStatus('❌ Error: ' + errorMsg);
    }
  };

  /**
   * Test 3: Test MediaRecorder API availability
   */
  const testMediaRecorder = () => {
    if (typeof MediaRecorder === 'undefined') {
      setTestStatus('❌ MediaRecorder API not available');
      return;
    }

    const supportedTypes = [
      'video/webm',
      'video/webm;codecs=vp8',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=vp9',
      'video/webm;codecs=h264',
    ];

    const supported = supportedTypes.filter((type) => MediaRecorder.isTypeSupported(type));

    console.log('[Test] MediaRecorder supported types:', supported);
    setTestStatus(`✅ MediaRecorder available. Supported: ${supported.join(', ')}`);
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Screen Recording Test</h2>
        <p style={styles.subtitle}>Testing desktopCapturer API and MediaRecorder</p>
      </div>

      <div style={styles.testSection}>
        <h3 style={styles.sectionTitle}>Test 1: Get Available Screens</h3>
        <button style={styles.button} onClick={testGetScreens} disabled={loading}>
          {loading ? 'Testing...' : 'Get Screens'}
        </button>

        {testStatus && (
          <div style={styles.status}>
            <strong>Status:</strong> {testStatus}
          </div>
        )}

        {error && (
          <div style={styles.error}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {screens.length > 0 && (
          <div style={styles.screenList}>
            <h4 style={styles.listTitle}>Found {screens.length} screen(s):</h4>
            {screens.map((screen, index) => (
              <div key={screen.id} style={styles.screenCard}>
                <div style={styles.screenInfo}>
                  <div style={styles.screenName}>
                    <strong>Screen {index + 1}:</strong> {screen.name}
                  </div>
                  <div style={styles.screenResolution}>
                    <strong>Resolution:</strong> {screen.resolution}
                  </div>
                  <div style={styles.screenId}>
                    <strong>ID:</strong> {screen.id}
                  </div>
                </div>
                {screen.thumbnail && (
                  <img src={screen.thumbnail} alt={screen.name} style={styles.thumbnail} />
                )}
                <button
                  style={styles.smallButton}
                  onClick={() => testCreateSession(screen.id)}
                >
                  Test Create Session
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={styles.testSection}>
        <h3 style={styles.sectionTitle}>Test 2: MediaRecorder API</h3>
        <button style={styles.button} onClick={testMediaRecorder}>
          Check MediaRecorder
        </button>
      </div>

      <div style={styles.instructions}>
        <h3 style={styles.sectionTitle}>Instructions:</h3>
        <ol style={styles.instructionList}>
          <li>Click "Get Screens" to test if desktopCapturer API works</li>
          <li>If successful, you should see your screen(s) listed with thumbnails</li>
          <li>Click "Test Create Session" on any screen to test session creation</li>
          <li>Click "Check MediaRecorder" to verify browser recording capabilities</li>
          <li>Check the browser console (DevTools) for detailed logs</li>
        </ol>

        <div style={styles.permissionBox}>
          <h4 style={styles.permissionTitle}>⚠️ macOS Screen Recording Permission Required</h4>
          <p style={styles.permissionText}>
            If you see "Failed to get sources" error, you need to grant Screen Recording permission:
          </p>
          <ol style={styles.permissionSteps}>
            <li>Open <strong>System Settings</strong></li>
            <li>Go to <strong>Privacy & Security</strong> → <strong>Screen Recording</strong></li>
            <li>Find <strong>Electron</strong> or <strong>Klippy</strong> in the list</li>
            <li>Enable the checkbox next to it</li>
            <li><strong>Quit and restart</strong> this app completely (Cmd+Q, then npm start again)</li>
            <li>Click "Get Screens" again</li>
          </ol>
          <p style={styles.permissionNote}>
            <strong>Note:</strong> On first run, macOS may prompt you automatically. If not, follow the steps above.
          </p>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    padding: '20px',
    maxWidth: '900px',
    margin: '0 auto',
    backgroundColor: '#1e1e1e',
    minHeight: '100vh',
    color: '#ffffff',
  },
  header: {
    marginBottom: '30px',
    borderBottom: '2px solid #444',
    paddingBottom: '20px',
  },
  title: {
    fontSize: '24px',
    fontWeight: 'bold' as const,
    margin: '0 0 10px 0',
    color: '#4a90e2',
  },
  subtitle: {
    fontSize: '14px',
    color: '#aaaaaa',
    margin: 0,
  },
  testSection: {
    marginBottom: '30px',
    padding: '20px',
    backgroundColor: '#2c2c2c',
    borderRadius: '8px',
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: 'bold' as const,
    marginBottom: '15px',
    color: '#ffffff',
  },
  button: {
    backgroundColor: '#4a90e2',
    color: '#ffffff',
    border: 'none',
    borderRadius: '4px',
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: 'bold' as const,
    cursor: 'pointer',
    marginBottom: '15px',
  },
  smallButton: {
    backgroundColor: '#e74c3c',
    color: '#ffffff',
    border: 'none',
    borderRadius: '4px',
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: 'bold' as const,
    cursor: 'pointer',
    marginTop: '10px',
  },
  status: {
    padding: '10px',
    backgroundColor: '#3a3a3a',
    borderRadius: '4px',
    marginBottom: '15px',
    fontSize: '14px',
  },
  error: {
    padding: '10px',
    backgroundColor: '#5a2a2a',
    borderRadius: '4px',
    marginBottom: '15px',
    fontSize: '14px',
    color: '#ff6b6b',
  },
  screenList: {
    marginTop: '15px',
  },
  listTitle: {
    fontSize: '16px',
    fontWeight: 'bold' as const,
    marginBottom: '15px',
    color: '#ffffff',
  },
  screenCard: {
    padding: '15px',
    backgroundColor: '#3a3a3a',
    borderRadius: '6px',
    marginBottom: '15px',
    border: '1px solid #444',
  },
  screenInfo: {
    marginBottom: '10px',
  },
  screenName: {
    fontSize: '14px',
    marginBottom: '5px',
  },
  screenResolution: {
    fontSize: '12px',
    color: '#aaaaaa',
    marginBottom: '5px',
  },
  screenId: {
    fontSize: '11px',
    color: '#888888',
    fontFamily: 'monospace',
  },
  thumbnail: {
    width: '100%',
    maxWidth: '400px',
    height: 'auto',
    borderRadius: '4px',
    marginTop: '10px',
    border: '1px solid #555',
  },
  instructions: {
    marginTop: '30px',
    padding: '20px',
    backgroundColor: '#2c2c2c',
    borderRadius: '8px',
  },
  instructionList: {
    fontSize: '14px',
    lineHeight: '1.8',
    color: '#cccccc',
    paddingLeft: '20px',
  },
  permissionBox: {
    marginTop: '20px',
    padding: '15px',
    backgroundColor: '#3a2a2a',
    border: '2px solid #e74c3c',
    borderRadius: '6px',
  },
  permissionTitle: {
    fontSize: '16px',
    fontWeight: 'bold' as const,
    color: '#e74c3c',
    marginBottom: '10px',
  },
  permissionText: {
    fontSize: '14px',
    color: '#cccccc',
    marginBottom: '10px',
  },
  permissionSteps: {
    fontSize: '13px',
    lineHeight: '1.8',
    color: '#cccccc',
    paddingLeft: '20px',
    marginBottom: '10px',
  },
  permissionNote: {
    fontSize: '12px',
    color: '#aaaaaa',
    fontStyle: 'italic' as const,
    marginTop: '10px',
  },
};
