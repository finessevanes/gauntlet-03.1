/**
 * MainLayout Component
 * Three-panel layout: Library (left), Preview (center), Timeline (bottom)
 */

import React from 'react';
import { ImportButton } from './ImportButton';
import { DragDropZone } from './DragDropZone';
import { Library } from './Library';
import { ImportProgressModal } from './ImportProgressModal';
import { ErrorModal } from './ErrorModal';
import { useImport } from '../hooks/useImport';
import { Timeline } from './Timeline';
import { PreviewPlayer } from './PreviewPlayer';

export const MainLayout: React.FC = () => {
  const { importProgress, importError, importVideos, openFilePicker, clearImportProgress, clearImportError } = useImport();

  return (
    <DragDropZone onDrop={importVideos}>
      <div style={styles.container}>
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

        {/* Top section: Library (left) + Preview (right) */}
        <div style={styles.topSection}>
          {/* Library Panel (left, 20%) */}
          <div style={styles.libraryWrapper}>
            <div style={styles.panelHeader}>
              <span>Library</span>
              <ImportButton onClick={openFilePicker} disabled={importProgress.length > 0} />
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
          <div style={styles.panelHeader}>Timeline</div>
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
    padding: '16px',
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
};
