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
import { TimelineDemo } from './v2/TimelineDemo'; // NEW: Multitrack timeline demo
import { PreviewPlayer } from './PreviewPlayer';
import ExportModal from './ExportModal';
import PresetSelector from './PresetSelector';
import PresetManager from './PresetManager';
import { TeleprompterModal } from './TeleprompterModal';
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
      }
    }
  }, []);

  // Webcam recording state (Story S10)
  const [isWebcamModalOpen, setIsWebcamModalOpen] = useState(false);

  // PiP recording state (Story S11)
  const [isPiPModalOpen, setIsPiPModalOpen] = useState(false);

  // Teleprompter modal state (Story S9)
  const [isTeleprompterOpen, setIsTeleprompterOpen] = useState(false);

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
    const sessionId = await startRecording(screenId, audioEnabled, audioDeviceId);

    if (sessionId) {
      setIsRecordDialogOpen(false);
    } else {
      console.error('[MainLayout] Failed to start recording');
    }
  };

  /**
   * Handle stop recording
   */
  const handleStopRecording = async () => {
    setIsStopping(true);

    try {
      const result = await stopRecording();

      if (result.success && result.filePath) {
        // Auto-import the recorded video into the library
        try {
          await importVideos([result.filePath]);
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
    // Auto-import the recorded video into the library
    try {
      await importVideos([filePath]);
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
    // Auto-import the recorded PiP video into the library
    try {
      await importVideos([filePath]);
    } catch (error) {
      console.error('[MainLayout] Failed to import PiP recording:', error);
    }
  };

  /**
   * Handle Export button click
   */
  const handleExportClick = async () => {
    // Basic validation: check if timeline has clips
    if (!timeline.clips || timeline.clips.length === 0) {
      setExportProgress({
        percentComplete: 0,
        estimatedTimeRemaining: 0,
        errorMessage: 'Add at least one clip to export',
      });
      setExportStatus('error');
      setIsExportModalOpen(true);
      return;
    }

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

    setSourceResolution(maxResolution);

    // Show preset selector (Story 14: Advanced Export Options)
    setIsPresetSelectorOpen(true);
  };

  /**
   * Handle preset selection (Story 14: Advanced Export Options)
   */
  const handlePresetSelected = async (preset: ExportPreset) => {
    setSelectedPreset(preset);
    setIsPresetSelectorOpen(false);

    // Now open the save dialog with preset-specific filename
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0].replace('T', '_');
    const defaultFilename = `Klippy_Export_${preset.name}_${timestamp}.mp4`;

    try {
      const result = await window.electron.invoke('dialog:showSaveDialog', {
        title: 'Export Video',
        defaultPath: defaultFilename,
        filters: [{ name: 'MP4 Video', extensions: ['mp4'] }],
      });

      // User cancelled
      if (result.canceled) {
        setSelectedPreset(null);
        return;
      }

      // Start export
      const outputPath = result.filePath;

      setExportStatus('validating');
      setExportProgress({
        percentComplete: 0,
        estimatedTimeRemaining: 0,
        errorMessage: undefined,
      });
      setIsExportModalOpen(true);

      // Build timeline data with timeline clips and library clips
      const timelineData = {
        clips: timeline.clips,
        totalDuration: timeline.duration,
      };

      // Call export IPC handler with preset (Story 14: Advanced Export Options)
      setExportStatus('exporting');

      const exportResult = await window.electron.invoke('export-video', {
        outputPath,
        timeline: timelineData,
        libraryClips: clips, // Pass library clips for reference
        preset, // Pass preset for resolution, bitrate, fps
      });

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
    setIsPresetManagerOpen(true);
  };

  /**
   * Handle preset save (Story 14: Advanced Export Options)
   */
  const handlePresetSave = async (preset: ExportPreset) => {
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
        <div className="flex flex-col h-screen bg-dark-900 text-white" data-layout="main-container">
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
          onOpenTeleprompter={() => setIsTeleprompterOpen(true)}
        />

        {/* PiP Recording Modal (Story S11) */}
        <PiPRecordingModal
          isOpen={isPiPModalOpen}
          onClose={() => setIsPiPModalOpen(false)}
          onRecordingComplete={handlePiPRecordingComplete}
        />

        {/* Teleprompter Modal (Story S9) */}
        <TeleprompterModal
          isOpen={isTeleprompterOpen}
          onClose={() => setIsTeleprompterOpen(false)}
          showBackdrop={false}
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
        <div className="flex flex-1 h-screen">
          {/* Left Panel - Media Browser */}
          <div className="w-80 bg-dark-800 border-r border-dark-700 flex flex-col">
            <div className="px-4 py-3 bg-dark-700 border-b border-dark-700 text-xs font-bold uppercase text-dark-400 flex justify-between items-center">
              <span>Media Browser</span>
              <div className="flex gap-2 items-center">
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
          <div className="flex-1 flex flex-col bg-black">
            <div className="px-4 py-3 bg-dark-700 border-b border-dark-700 text-xs font-bold uppercase text-dark-400">Preview</div>
            <div className="flex-1 relative bg-dark-950">
              <PreviewPlayer />
            </div>
          </div>

        </div>

        {/* Bottom Panel - Timeline (NEW: Using TimelineDemo for testing) */}
        <div className="h-80 bg-dark-900 border-t border-dark-700 flex flex-col min-h-0">
          <div className="flex-1 min-h-0 relative overflow-hidden">
            <TimelineDemo />
          </div>
        </div>
        </div>
      </DragDropZone>
    </PermissionProvider>
  );
};

// Styles removed - using Tailwind CSS instead
