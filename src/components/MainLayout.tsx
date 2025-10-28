/**
 * MainLayout Component
 * Three-panel layout: Library (left), Preview (center), Timeline (bottom)
 */

import React from 'react';
import { useSessionStore } from '../store/sessionStore';
import { EmptyState } from './EmptyState';
import { ImportButton } from './ImportButton';
import { DragDropZone } from './DragDropZone';
import { Library } from './Library';
import { ImportProgressModal } from './ImportProgressModal';
import { ErrorModal } from './ErrorModal';
import { useImport } from '../hooks/useImport';

export const MainLayout: React.FC = () => {
  const clips = useSessionStore((state) => state.clips);
  const timeline = useSessionStore((state) => state.timeline);
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
              <div style={styles.previewPlaceholder}>
                <span style={styles.previewIcon}>▶️</span>
                <p style={styles.previewText}>Preview Player (Story 6)</p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom section: Timeline (40% height) */}
        <div style={styles.timeline}>
          <div style={styles.panelHeader}>Timeline</div>
          <div style={styles.timelineContent}>
            {timeline.clips.length === 0 ? (
              <EmptyState type="timeline" />
            ) : (
              <div style={styles.timelineTrack}>
                <p style={styles.timelineInfo}>
                  {timeline.clips.length} clip{timeline.clips.length !== 1 ? 's' : ''} on timeline
                </p>
              </div>
            )}
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
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative' as const,
  },
  previewPlaceholder: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    color: '#666',
  },
  previewIcon: {
    fontSize: '64px',
    marginBottom: '16px',
    opacity: 0.3,
  },
  previewText: {
    fontSize: '16px',
    margin: 0,
    opacity: 0.5,
  },
  timeline: {
    height: '40%',
    display: 'flex',
    flexDirection: 'column' as const,
  },
  timelineContent: {
    flex: 1,
    overflow: 'auto',
    position: 'relative' as const,
  },
  timelineTrack: {
    padding: '16px',
  },
  timelineInfo: {
    fontSize: '13px',
    color: '#999',
    margin: 0,
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
