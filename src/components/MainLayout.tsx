/**
 * MainLayout Component
 * Three-panel layout: Library (left), Preview (center), Timeline (bottom)
 */

import React, { useEffect, useState } from 'react';
import { ImportButton } from './ImportButton';
import { RecordScreenDialog } from './RecordScreenDialog';
import { WebcamRecordingModal } from './WebcamRecordingModal';
import { PiPRecordingModal } from './PiPRecordingModal';
import { RecordingIndicator } from './RecordingIndicator';
import { RecordingMenu } from './RecordingMenu';
import { DragDropZone } from './DragDropZone';
import { Library } from './Library';
import { ImportProgressModal } from './ImportProgressModal';
import { ErrorModal } from './ErrorModal';
import { PermissionModal } from './PermissionModal';
import { PermissionProvider } from '../context/PermissionContext';
import { useImport } from '../hooks/useImport';
import { useScreenRecorder } from '../hooks/useScreenRecorder';
import { Timeline } from './Timeline';
import { PreviewPlayer } from './PreviewPlayer';
import ExportModal from './ExportModal';
import PresetSelector from './PresetSelector';
import PresetManager from './PresetManager';
import { ExportPreset } from '../types/export';
import { useSessionStore } from '../store/sessionStore';

export const MainLayout: React.FC = () => {
  const { importProgress, importError, importVideos, openFilePicker, clearImportProgress, clearImportError } = useImport();

  // Screen recording state
  const { isRecording, startRecording, stopRecording, cancelRecording } = useScreenRecorder();
  const [isRecordDialogOpen, setIsRecordDialogOpen] = useState(false);
  const [isStopping, setIsStopping] = useState(false);

  // Resizable panel state
  const [libraryWidth, setLibraryWidth] = useState(20); // percentage
  const [isDraggingDivider, setIsDraggingDivider] = useState(false);
  const MIN_LIBRARY_WIDTH_PX = 300;

  // Ensure library width respects minimum on mount
  useEffect(() => {
    const container = document.querySelector('[data-layout="main-container"]') as HTMLElement;
    if (container) {
      const containerWidth = container.getBoundingClientRect().width;
      const minWidthPercent = (MIN_LIBRARY_WIDTH_PX / containerWidth) * 100;
      if (libraryWidth < minWidthPercent) {
        setLibraryWidth(minWidthPercent);
        console.log(`[MainLayout] Enforcing minimum library width: ${minWidthPercent.toFixed(2)}%`);
      }
    }
  }, []);

  // Webcam recording state (Story S10)
  const [isWebcamModalOpen, setIsWebcamModalOpen] = useState(false);

  // PiP recording state (Story S11)
  const [isPiPModalOpen, setIsPiPModalOpen] = useState(false);

  // Export state
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportStatus, setExportStatus] = useState<'validating' | 'exporting' | 'error' | 'complete'>('validating');
  const [exportProgress, setExportProgress] = useState({
    percentComplete: 0,
    estimatedTimeRemaining: 0,
    errorMessage: undefined as string | undefined,
  });
  const [exportOutputPath, setExportOutputPath] = useState<string | undefined>();

  // Preset selection state (Story 14: Advanced Export Options)
  const [isPresetSelectorOpen, setIsPresetSelectorOpen] = useState(false);
  const [isPresetManagerOpen, setIsPresetManagerOpen] = useState(false);
  const [presets, setPresets] = useState<ExportPreset[]>([]);
  const [defaultPresetId, setDefaultPresetId] = useState<string | null>(null);
  const [sourceResolution, setSourceResolution] = useState({ width: 1920, height: 1080 });
  const [selectedPreset, setSelectedPreset] = useState<ExportPreset | null>(null);

  // Get session data for export
  const clips = useSessionStore((state) => state.clips);
  const timeline = useSessionStore((state) => state.timeline);

  /**
   * Load presets on component mount (Story 14: Advanced Export Options)
   */
  useEffect(() => {
    const loadPresets = async () => {
      try {
        const result = await window.electron.invoke('export-get-presets');
        if (result.presets) {
          setPresets(result.presets);
          if (result.defaultPresetId) {
            setDefaultPresetId(result.defaultPresetId);
          }
        }
      } catch (error) {
        console.error('[MainLayout] Failed to load presets:', error);
        // Presets will be set to empty array, which is okay
      }
    };

    loadPresets();
  }, []);

  /**
   * Handle divider drag to resize library/preview panels
   */
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingDivider) return;

      const container = document.querySelector('[data-layout="main-container"]') as HTMLElement;
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const containerWidth = containerRect.width;
      const newWidth = ((e.clientX - containerRect.left) / containerWidth) * 100;
      const minWidthPercent = (MIN_LIBRARY_WIDTH_PX / containerWidth) * 100;

      // Constrain between 300px minimum and 60% maximum
      if (newWidth >= minWidthPercent && newWidth <= 60) {
        setLibraryWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsDraggingDivider(false);
    };

    if (isDraggingDivider) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDraggingDivider]);

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
   * Handle Record Webcam button click
   */
  const handleWebcamClick = () => {
    setIsWebcamModalOpen(true);
  };

  /**
   * Handle webcam recording complete
   */
  const handleWebcamRecordingComplete = async (filePath: string) => {
    console.log('[MainLayout] Webcam recording complete:', filePath);

    // Auto-import the recorded video into the library
    try {
      console.log('[MainLayout] Auto-importing webcam recording...');
      await importVideos([filePath]);
      console.log('[MainLayout] Webcam recording imported successfully');
    } catch (error) {
      console.error('[MainLayout] Failed to import webcam recording:', error);
    }
  };

  /**
   * Handle Record PiP button click (Story S11)
   */
  const handlePiPClick = () => {
    setIsPiPModalOpen(true);
  };

  /**
   * Handle PiP recording complete (Story S11)
   */
  const handlePiPRecordingComplete = async (filePath: string) => {
    console.log('[MainLayout] PiP recording complete:', filePath);

    // Auto-import the recorded PiP video into the library
    try {
      console.log('[MainLayout] Auto-importing PiP recording...');
      await importVideos([filePath]);
      console.log('[MainLayout] PiP recording imported successfully');
    } catch (error) {
      console.error('[MainLayout] Failed to import PiP recording:', error);
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

    // Determine source resolution (Story 14: Advanced Export Options)
    const maxResolution = timeline.clips.reduce(
      (max, tc) => {
        const clip = clips.find((c) => c.id === tc.clipId);
        if (clip) {
          return {
            width: Math.max(max.width, clip.resolution?.width || 1920),
            height: Math.max(max.height, clip.resolution?.height || 1080),
          };
        }
        return max;
      },
      { width: 1920, height: 1080 }
    );

    console.log('[Export] Source resolution:', maxResolution);
    setSourceResolution(maxResolution);

    // Show preset selector (Story 14: Advanced Export Options)
    console.log('[Export] Opening preset selector');
    setIsPresetSelectorOpen(true);
  };

  /**
   * Handle preset selection (Story 14: Advanced Export Options)
   */
  const handlePresetSelected = async (preset: ExportPreset) => {
    console.log('[Export] Preset selected:', preset.name);
    setSelectedPreset(preset);
    setIsPresetSelectorOpen(false);

    // Now open the save dialog with preset-specific filename
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0].replace('T', '_');
    const defaultFilename = `Klippy_Export_${preset.name}_${timestamp}.mp4`;

    console.log('[Export] Opening save dialog with filename:', defaultFilename);

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
        setSelectedPreset(null);
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

      // Call export IPC handler with preset (Story 14: Advanced Export Options)
      setExportStatus('exporting');
      console.log('[Export] Calling export-video IPC handler with preset:', preset.name);

      const exportResult = await window.electron.invoke('export-video', {
        outputPath,
        timeline: timelineData,
        preset, // Pass preset for resolution, bitrate, fps
      });

      console.log('[Export] Export result:', exportResult);

      if (exportResult.success) {
        setExportStatus('complete');
        setExportProgress({
          percentComplete: 100,
          estimatedTimeRemaining: 0,
          errorMessage: undefined,
        });
        setExportOutputPath(exportResult.outputPath);
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
   * Handle preset manager open (Story 14: Advanced Export Options)
   */
  const handleManagePresetsClick = () => {
    console.log('[Export] Opening preset manager');
    setIsPresetManagerOpen(true);
  };

  /**
   * Handle preset save (Story 14: Advanced Export Options)
   */
  const handlePresetSave = async (preset: ExportPreset) => {
    console.log('[Export] Saving preset:', preset.name);
    try {
      const result = await window.electron.invoke('export-save-custom-preset', {
        preset,
      });
      return result;
    } catch (error) {
      console.error('[Export] Failed to save preset:', error);
      return { success: false, error: 'Failed to save preset' };
    }
  };

  /**
   * Handle preset delete (Story 14: Advanced Export Options)
   */
  const handlePresetDelete = async (presetId: string) => {
    console.log('[Export] Deleting preset:', presetId);
    try {
      const result = await window.electron.invoke('export-delete-custom-preset', {
        presetId,
      });
      return result;
    } catch (error) {
      console.error('[Export] Failed to delete preset:', error);
      return { success: false, error: 'Failed to delete preset' };
    }
  };

  /**
   * Refresh presets from main process (Story 14: Advanced Export Options)
   */
  const handleRefreshPresets = async () => {
    console.log('[Export] Refreshing presets');
    try {
      const result = await window.electron.invoke('export-get-presets');
      if (result.presets) {
        setPresets(result.presets);
        if (result.defaultPresetId) {
          setDefaultPresetId(result.defaultPresetId);
        }
      }
    } catch (error) {
      console.error('[Export] Failed to refresh presets:', error);
    }
  };

  /**
   * Handle set default preset (Story 14: Advanced Export Options)
   */
  const handleSetDefaultPreset = async (presetId: string | null) => {
    console.log('[Export] Setting default preset:', presetId);
    try {
      const result = await window.electron.invoke('export-set-default-preset', {
        presetId,
      });
      if (result.success) {
        setDefaultPresetId(presetId);
      }
    } catch (error) {
      console.error('[Export] Failed to set default preset:', error);
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
    setExportOutputPath(undefined);
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
    <PermissionProvider>
      <DragDropZone onDrop={importVideos}>
        <div style={styles.container} data-layout="main-container">
        {/* Recording Indicator (shown when recording) */}
        {isRecording && <RecordingIndicator onStop={handleStopRecording} isStopping={isStopping} />}

        {/* Record Screen Dialog */}
        <RecordScreenDialog
          isOpen={isRecordDialogOpen}
          onClose={() => setIsRecordDialogOpen(false)}
          onStartRecording={handleStartRecording}
        />

        {/* Webcam Recording Modal (Story S10) */}
        <WebcamRecordingModal
          isOpen={isWebcamModalOpen}
          onClose={() => setIsWebcamModalOpen(false)}
          onRecordingComplete={handleWebcamRecordingComplete}
        />

        {/* PiP Recording Modal (Story S11) */}
        <PiPRecordingModal
          isOpen={isPiPModalOpen}
          onClose={() => setIsPiPModalOpen(false)}
          onRecordingComplete={handlePiPRecordingComplete}
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
          outputPath={exportOutputPath}
        />

        {/* Preset Selector Modal (Story 14: Advanced Export Options) */}
        <PresetSelector
          isOpen={isPresetSelectorOpen}
          presets={presets}
          sourceResolution={sourceResolution}
          defaultPresetId={defaultPresetId}
          onSelect={handlePresetSelected}
          onCancel={() => setIsPresetSelectorOpen(false)}
          onManagePresets={handleManagePresetsClick}
          onSetDefault={handleSetDefaultPreset}
        />

        {/* Preset Manager Modal (Story 14: Advanced Export Options) */}
        <PresetManager
          isOpen={isPresetManagerOpen}
          presets={presets}
          onClose={() => setIsPresetManagerOpen(false)}
          onSave={handlePresetSave}
          onDelete={handlePresetDelete}
          onRefresh={handleRefreshPresets}
        />

        {/* Global Permission Modal */}
        <PermissionModal />


        {/* Main Content Area */}
        <div style={styles.mainContent}>
          {/* Left Panel - Media Browser */}
          <div style={styles.leftPanel}>
            <div style={styles.panelHeader}>
              <span>Media Browser</span>
              <div style={styles.headerButtons}>
                <RecordingMenu
                  disabled={isRecording}
                  onScreenClick={handleRecordClick}
                  onWebcamClick={handleWebcamClick}
                  onPiPClick={handlePiPClick}
                />
                <ImportButton onClick={openFilePicker} disabled={importProgress.length > 0 || isRecording} />
              </div>
            </div>
            <Library />
          </div>

          {/* Center Panel - Video Preview */}
          <div style={styles.centerPanel}>
            <div style={styles.panelHeader}>Preview</div>
            <div style={styles.previewContent}>
              <PreviewPlayer />
            </div>
          </div>

        </div>

        {/* Bottom Panel - Timeline */}
        <div style={styles.bottomPanel}>
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
    </PermissionProvider>
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
  mainContent: {
    display: 'flex',
    flex: 1,
    height: '100vh',
  },
  leftPanel: {
    width: '300px',
    backgroundColor: '#1e1e1e',
    borderRight: '1px solid #333',
    display: 'flex',
    flexDirection: 'column' as const,
  },
  centerPanel: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    backgroundColor: '#000',
  },
  bottomPanel: {
    height: '200px',
    backgroundColor: '#1a1a1a',
    borderTop: '1px solid #333',
    display: 'flex',
    flexDirection: 'column' as const,
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
  previewContent: {
    flex: 1,
    display: 'flex',
    position: 'relative' as const,
    backgroundColor: '#101010',
  },
  timelineContent: {
    flex: 1,
    position: 'relative' as const,
    overflow: 'hidden',
  },
};

