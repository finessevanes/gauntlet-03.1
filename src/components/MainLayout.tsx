/**
 * MainLayout Component
 * Three-panel layout: Library (left), Preview (center), Timeline (bottom)
 */

import React from 'react';
import { useSessionStore } from '../store/sessionStore';
import { EmptyState } from './EmptyState';

export const MainLayout: React.FC = () => {
  const clips = useSessionStore((state) => state.clips);
  const timeline = useSessionStore((state) => state.timeline);

  return (
    <div style={styles.container}>
      {/* Top section: Library + Preview */}
      <div style={styles.topSection}>
        {/* Library Panel (left, 20%) */}
        <div style={styles.library}>
          <div style={styles.panelHeader}>Library</div>
          <div style={styles.panelContent}>
            {clips.length === 0 ? (
              <EmptyState type="library" />
            ) : (
              <div style={styles.clipList}>
                {clips.map((clip) => (
                  <div key={clip.id} style={styles.clipCard}>
                    <div style={styles.clipThumbnail}>🎥</div>
                    <div style={styles.clipInfo}>
                      <div style={styles.clipName}>{clip.filePath.split('/').pop()}</div>
                      <div style={styles.clipDuration}>{formatDuration(clip.duration)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Preview Panel (center, 40%) */}
        <div style={styles.preview}>
          <div style={styles.panelHeader}>Preview</div>
          <div style={styles.panelContent}>
            <div style={styles.previewPlaceholder}>
              <span style={styles.previewIcon}>▶️</span>
              <p style={styles.previewText}>Preview Player</p>
            </div>
          </div>
        </div>

        {/* Right spacer (40%) - for future panels */}
        <div style={styles.rightSpacer}></div>
      </div>

      {/* Bottom section: Timeline (30% height) */}
      <div style={styles.timeline}>
        <div style={styles.panelHeader}>Timeline</div>
        <div style={styles.panelContent}>
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
  );
};

// Helper: Format duration in MM:SS
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

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
    height: '70%',
    borderBottom: '1px solid #333',
  },
  library: {
    width: '20%',
    borderRight: '1px solid #333',
    display: 'flex',
    flexDirection: 'column' as const,
  },
  preview: {
    width: '40%',
    borderRight: '1px solid #333',
    display: 'flex',
    flexDirection: 'column' as const,
  },
  rightSpacer: {
    width: '40%',
    backgroundColor: '#1a1a1a',
  },
  timeline: {
    height: '30%',
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
  },
  panelContent: {
    flex: 1,
    overflow: 'auto',
    position: 'relative' as const,
  },
  clipList: {
    padding: '8px',
  },
  clipCard: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px',
    marginBottom: '8px',
    backgroundColor: '#2a2a2a',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  clipThumbnail: {
    width: '48px',
    height: '48px',
    backgroundColor: '#333',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    marginRight: '12px',
  },
  clipInfo: {
    flex: 1,
    overflow: 'hidden',
  },
  clipName: {
    fontSize: '13px',
    color: '#ffffff',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  clipDuration: {
    fontSize: '11px',
    color: '#999',
    marginTop: '4px',
  },
  previewPlaceholder: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#666',
  },
  previewIcon: {
    fontSize: '48px',
    marginBottom: '16px',
    opacity: 0.5,
  },
  previewText: {
    fontSize: '14px',
    margin: 0,
  },
  timelineTrack: {
    padding: '16px',
  },
  timelineInfo: {
    fontSize: '13px',
    color: '#999',
    margin: 0,
  },
};
