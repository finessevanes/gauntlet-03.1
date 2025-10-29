/**
 * MainLayout Component
 * Three-panel layout: Library (left), Preview (center), Timeline (bottom)
 */

import React, { useEffect, useState } from 'react';
import { ImportButton } from './ImportButton';
import { RecordScreenButton } from './RecordScreenButton';
import { RecordScreenDialog } from './RecordScreenDialog';
import { RecordingIndicator } from './RecordingIndicator';
import { DragDropZone } from './DragDropZone';
import { Library } from './Library';
import { ImportProgressModal } from './ImportProgressModal';
import { ErrorModal } from './ErrorModal';
import { useImport } from '../hooks/useImport';
import { useScreenRecorder } from '../hooks/useScreenRecorder';
import { Timeline } from './Timeline';
import { PreviewPlayer } from './PreviewPlayer';
import ExportModal from './ExportModal';
import { useSessionStore } from '../store/sessionStore';

export const MainLayout: React.FC = () => {
  const { importProgress, importError, importVideos, openFilePicker, clearImportProgress, clearImportError } = useImport();

  // Screen recording state
  const { isRecording, startRecording, stopRecording, cancelRecording } = useScreenRecorder();
  const [isRecordDialogOpen, setIsRecordDialogOpen] = useState(false);
  const [isStopping, setIsStopping] = useState(false);

  // Export state
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportStatus, setExportStatus] = useState<'validating' | 'exporting' | 'error' | 'complete'>('validating');
  const [exportProgress, setExportProgress] = useState({
    percentComplete: 0,
    estimatedTimeRemaining: 0,
    errorMessage: undefined as string | undefined,
  });

  // Get session data for export
  const clips = useSessionStore((state) => state.clips);
  const timeline = useSessionStore((state) => state.timeline);

  /**
   * Handle Record Screen button click
   */
  const handleRecordClick = () => {
    setIsRecordDialogOpen(true);
  };

  /**
   * Handle start recording from dialog
   */
  const handleStartRecording = async (screenId: string, audioEnabled: boolean, audioDeviceId?: string) => {
    console.log('[MainLayout] Starting recording:', { screenId, audioEnabled, audioDeviceId });

    const sessionId = await startRecording(screenId, audioEnabled, audioDeviceId);

    if (sessionId) {
      setIsRecordDialogOpen(false);
      console.log('[MainLayout] Recording started successfully');
    } else {
      console.error('[MainLayout] Failed to start recording');
    }
  };

  /**
   * Handle stop recording
   */
  const handleStopRecording = async () => {
    console.log('[MainLayout] Stopping recording...');
    setIsStopping(true);

    try {
      const result = await stopRecording();

      if (result.success && result.filePath) {
        console.log('[MainLayout] Recording stopped. File saved:', result.filePath);

        // Auto-import the recorded video into the library
        try {
          console.log('[MainLayout] Auto-importing recorded video...');
          await importVideos([result.filePath]);
          console.log('[MainLayout] Recorded video imported successfully');
        } catch (error) {
          console.error('[MainLayout] Failed to import recorded video:', error);
        }
      } else {
        console.error('[MainLayout] Failed to stop recording:', result.error);
      }
    } finally {
      setIsStopping(false);
    }
  };

  /**
   * Handle Export button click
   */
  const handleExportClick = async () => {
    console.log('[Export] Export button clicked');

    // Basic validation: check if timeline has clips
    if (!timeline.clips || timeline.clips.length === 0) {
      console.log('[Export] Timeline is empty');
      setExportProgress({
        percentComplete: 0,
        estimatedTimeRemaining: 0,
        errorMessage: 'Add at least one clip to export',
      });
      setExportStatus('error');
      setIsExportModalOpen(true);
      return;
    }

    console.log('[Export] Timeline has', timeline.clips.length, 'clips');

    // Open save dialog
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0].replace('T', '_');
    const defaultFilename = `Klippy_Export_${timestamp}.mp4`;

    console.log('[Export] Opening save dialog with default filename:', defaultFilename);

    try {
      const result = await window.electron.invoke('dialog:showSaveDialog', {
        title: 'Export Video',
        defaultPath: defaultFilename,
        filters: [{ name: 'MP4 Video', extensions: ['mp4'] }],
      });

      console.log('[Export] Save dialog result:', result);

      // User cancelled
      if (result.canceled) {
        console.log('[Export] User cancelled save dialog');
        return;
      }

      // Start export
      const outputPath = result.filePath;
      console.log('[Export] Output path selected:', outputPath);

      setExportStatus('validating');
      setExportProgress({
        percentComplete: 0,
        estimatedTimeRemaining: 0,
        errorMessage: undefined,
      });
      setIsExportModalOpen(true);

      // Build timeline data with full clip details
      const timelineData = {
        clips: timeline.clips
          .map((tc) => clips.find((c) => c.id === tc.clipId))
          .filter((c) => c !== undefined),
        totalDuration: timeline.duration,
      };

      console.log('[Export] Timeline data:', {
        clipCount: timelineData.clips.length,
        totalDuration: timelineData.totalDuration,
      });

      // Call export IPC handler
      setExportStatus('exporting');
      console.log('[Export] Calling export-video IPC handler');

      const exportResult = await window.electron.invoke('export-video', {
        outputPath,
        timeline: timelineData,
      });

      console.log('[Export] Export result:', exportResult);

      if (exportResult.success) {
        setExportStatus('complete');
        setExportProgress({
          percentComplete: 100,
          estimatedTimeRemaining: 0,
          errorMessage: undefined,
        });
      } else {
        setExportStatus('error');
        setExportProgress({
          percentComplete: 0,
          estimatedTimeRemaining: 0,
          errorMessage: exportResult.errorMessage || 'Export failed',
        });
      }
    } catch (error) {
      console.error('[Export] Error:', error);
      setExportStatus('error');
      setExportProgress({
        percentComplete: 0,
        estimatedTimeRemaining: 0,
        errorMessage: error instanceof Error ? error.message : 'Export failed',
      });
    }
  };

  /**
   * Handle export cancel
   */
  const handleExportCancel = () => {
    if (exportStatus === 'exporting') {
      // Send cancel IPC event
      window.electron.invoke('export-cancel');
    }
    // Close modal
    setIsExportModalOpen(false);
    setExportStatus('validating');
    setExportProgress({
      percentComplete: 0,
      estimatedTimeRemaining: 0,
      errorMessage: undefined,
    });
  };

  /**
   * Listen for export progress updates
   */
  useEffect(() => {
    const handleExportProgress = (progress: any) => {
      setExportProgress({
        percentComplete: progress.percentComplete,
        estimatedTimeRemaining: progress.estimatedTimeRemaining,
        errorMessage: undefined,
      });
    };

    const handleExportCancelled = () => {
      setIsExportModalOpen(false);
      setExportStatus('validating');
      setExportProgress({
        percentComplete: 0,
        estimatedTimeRemaining: 0,
        errorMessage: undefined,
      });
    };

    // Set up event listeners
    const cleanupProgress = window.electron.export.onProgress(handleExportProgress);
    const cleanupCancelled = window.electron.export.onCancelled(handleExportCancelled);

    return () => {
      // Cleanup listeners
      cleanupProgress();
      cleanupCancelled();
    };
  }, []);

  return (
    <DragDropZone onDrop={importVideos}>
      <div style={styles.container}>
        {/* Recording Indicator (shown when recording) */}
        {isRecording && <RecordingIndicator onStop={handleStopRecording} isStopping={isStopping} />}

        {/* Record Screen Dialog */}
        <RecordScreenDialog
          isOpen={isRecordDialogOpen}
          onClose={() => setIsRecordDialogOpen(false)}
          onStartRecording={handleStartRecording}
        />

        {/* Error Modal */}
        {importError && (
          <ErrorModal
            title="Cannot Import File"
            message={`Unable to import "${importError.filename}".`}
            details={
              importError.codecAttempted
                ? `Video codec "${importError.codecAttempted.toUpperCase()}" is not supported. Only H.264 codec in MP4 or MOV format is accepted.`
                : `${importError.error}. Only H.264 codec in MP4 or MOV format is accepted.`
            }
            onClose={clearImportError}
          />
        )}

        {/* Import Progress Modal */}
        <ImportProgressModal files={importProgress} onClose={clearImportProgress} />

        {/* Export Modal */}
        <ExportModal
          isOpen={isExportModalOpen}
          onCancel={handleExportCancel}
          progress={exportProgress}
          status={exportStatus}
        />

        {/* Top section: Library (left) + Preview (right) */}
        <div style={styles.topSection}>
          {/* Library Panel (left, 20%) */}
          <div style={styles.libraryWrapper}>
            <div style={styles.panelHeader}>
              <span>Library</span>
              <div style={styles.headerButtons}>
                <RecordScreenButton onClick={handleRecordClick} disabled={isRecording} />
                <ImportButton onClick={openFilePicker} disabled={importProgress.length > 0 || isRecording} />
              </div>
            </div>
            <Library />
          </div>

          {/* Preview Panel (right, 80%) */}
          <div style={styles.preview}>
            <div style={styles.panelHeader}>Preview</div>
            <div style={styles.previewContent}>
              <PreviewPlayer />
            </div>
          </div>
        </div>

        {/* Bottom section: Timeline (40% height) */}
        <div style={styles.timeline}>
          <div style={styles.panelHeader}>
            <span>Timeline</span>
            <button onClick={handleExportClick} style={styles.exportButton}>
              Export
            </button>
          </div>
          <div style={styles.timelineContent}>
            <Timeline />
          </div>
        </div>
      </div>
    </DragDropZone>
  );
};

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100vh',
    backgroundColor: '#1a1a1a',
    color: '#ffffff',
  },
  topSection: {
    display: 'flex',
    height: '60%',
    borderBottom: '1px solid #333',
  },
  libraryWrapper: {
    width: '20%',
    borderRight: '1px solid #333',
    display: 'flex',
    flexDirection: 'column' as const,
  },
  preview: {
    width: '80%',
    display: 'flex',
    flexDirection: 'column' as const,
    backgroundColor: '#000',
  },
  previewContent: {
    flex: 1,
    display: 'flex',
    position: 'relative' as const,
    backgroundColor: '#101010',
  },
  timeline: {
    height: '40%',
    display: 'flex',
    flexDirection: 'column' as const,
  },
  timelineContent: {
    flex: 1,
    position: 'relative' as const,
    overflow: 'hidden',
  },
  panelHeader: {
    padding: '12px 16px',
    backgroundColor: '#252525',
    borderBottom: '1px solid #333',
    fontSize: '12px',
    fontWeight: 'bold' as const,
    textTransform: 'uppercase' as const,
    color: '#999',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerButtons: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  exportButton: {
    padding: '8px 16px',
    fontSize: '12px',
    fontWeight: 'bold' as const,
    backgroundColor: '#4a9eff',
    color: '#ffffff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    textTransform: 'uppercase' as const,
  },
};
