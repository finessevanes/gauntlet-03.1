/**
 * TrackManager Component
 * Sidebar panel for managing tracks (add, remove, reorder)
 */

import React, { useState } from 'react';
import { useSessionStore } from '../store/sessionStore';
import { TrackHeader } from './TrackHeader';
import { Track } from '../types/session';

export const TrackManager: React.FC = () => {
  const tracks = useSessionStore((state) => state.timeline.tracks);
  const clips = useSessionStore((state) => state.clips);
  const timelineClips = useSessionStore((state) => state.timeline.clips);
  const selectedTrackId = useSessionStore((state) => state.selectedTrackId);
  const setSelectedTrack = useSessionStore((state) => state.setSelectedTrack);
  const addTrack = useSessionStore((state) => state.addTrack);
  const removeTrack = useSessionStore((state) => state.removeTrack);
  const updateTrack = useSessionStore((state) => state.updateTrack);
  const reorderTracks = useSessionStore((state) => state.reorderTracks);

  const [draggedTrackId, setDraggedTrackId] = useState<string | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);

  // Sort tracks by zIndex
  const sortedTracks = [...tracks].sort((a, b) => a.zIndex - b.zIndex);

  const handleAddTrack = async () => {
    const trackName = prompt('Enter track name:', `Track ${tracks.length + 1}`);
    if (!trackName) return;

    const result = await window.electron.timeline.addTrack(trackName.trim());
    if (result.success && result.track) {
      addTrack(result.track);
      console.log('[TrackManager] Track added:', result.track);
    } else {
      alert(result.error || 'Failed to add track');
    }
  };

  const handleNameChange = async (trackId: string, newName: string) => {
    const result = await window.electron.timeline.updateTrack(trackId, { name: newName });
    if (result.success) {
      updateTrack(trackId, { name: newName });
      console.log('[TrackManager] Track renamed:', trackId, newName);
    } else {
      alert(result.error || 'Failed to rename track');
    }
  };

  const handleMuteToggle = async (trackId: string) => {
    const track = tracks.find(t => t.id === trackId);
    if (!track) return;

    const newMuted = !track.muted;
    const result = await window.electron.timeline.updateTrack(trackId, { muted: newMuted });
    if (result.success) {
      updateTrack(trackId, { muted: newMuted });
      console.log('[TrackManager] Track mute toggled:', trackId, newMuted);
    }
  };

  const handleSoloToggle = async (trackId: string) => {
    const track = tracks.find(t => t.id === trackId);
    if (!track) return;

    const newSolo = !track.solo;
    const result = await window.electron.timeline.updateTrack(trackId, { solo: newSolo });
    if (result.success) {
      updateTrack(trackId, { solo: newSolo });
      console.log('[TrackManager] Track solo toggled:', trackId, newSolo);
    }
  };

  const handleVisibilityToggle = async (trackId: string) => {
    const track = tracks.find(t => t.id === trackId);
    if (!track) return;

    const newVisible = !track.visible;
    const result = await window.electron.timeline.updateTrack(trackId, { visible: newVisible });
    if (result.success) {
      updateTrack(trackId, { visible: newVisible });
      console.log('[TrackManager] Track visibility toggled:', trackId, newVisible);
    }
  };

  const handleOpacityChange = async (trackId: string, opacity: number) => {
    const result = await window.electron.timeline.updateTrack(trackId, { opacity });
    if (result.success) {
      updateTrack(trackId, { opacity });
    }
  };

  const handleDelete = async (trackId: string) => {
    const track = tracks.find(t => t.id === trackId);
    if (!track) return;

    // Count clips on this track
    const clipsOnTrack = timelineClips.filter(c => c.trackId === trackId).length;

    if (clipsOnTrack > 0) {
      const confirmed = window.confirm(
        `Delete track "${track.name}" and ${clipsOnTrack} clip(s)?`
      );
      if (!confirmed) return;
    }

    const result = await window.electron.timeline.removeTrack(trackId);
    if (result.success) {
      removeTrack(trackId);
      console.log('[TrackManager] Track deleted:', track.name, 'Clips removed:', result.removedClipCount);
    } else {
      alert(result.error || 'Failed to delete track');
    }
  };

  const handleDragStart = (e: React.DragEvent, trackId: string) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('trackId', trackId);
    setDraggedTrackId(trackId);
    console.log('[TrackManager] Drag started:', trackId);
  };

  const handleDragOver = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    if (draggedTrackId) {
      const draggedIndex = sortedTracks.findIndex(t => t.id === draggedTrackId);
      if (draggedIndex !== targetIndex) {
        setDropTargetIndex(targetIndex);
      }
    }
  };

  const handleDragLeave = () => {
    setDropTargetIndex(null);
  };

  const handleDrop = async (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    setDropTargetIndex(null);

    if (!draggedTrackId) return;

    const draggedIndex = sortedTracks.findIndex(t => t.id === draggedTrackId);
    if (draggedIndex === targetIndex) {
      setDraggedTrackId(null);
      return;
    }

    // Reorder tracks
    const newOrder = [...sortedTracks];
    const [removed] = newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, removed);

    const newTrackIds = newOrder.map(t => t.id);
    const result = await window.electron.timeline.reorderTracks(newTrackIds);

    if (result.success) {
      reorderTracks(newTrackIds);
      console.log('[TrackManager] Tracks reordered');
    } else {
      alert(result.error || 'Failed to reorder tracks');
    }

    setDraggedTrackId(null);
  };

  const handleDragEnd = () => {
    setDraggedTrackId(null);
    setDropTargetIndex(null);
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.headerTitle}>Tracks</span>
        <button
          style={{
            ...styles.addButton,
            ...(tracks.length >= 5 ? styles.addButtonDisabled : {}),
          }}
          onClick={handleAddTrack}
          disabled={tracks.length >= 5}
          title={tracks.length >= 5 ? 'Maximum 5 tracks' : 'Add new track'}
        >
          + Add Track
        </button>
      </div>

      {/* Track List */}
      <div style={styles.trackList}>
        {sortedTracks.map((track, index) => (
          <div
            key={track.id}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, index)}
            style={{ position: 'relative' }}
          >
            {/* Drop indicator */}
            {dropTargetIndex === index && (
              <div style={styles.dropIndicator} />
            )}

            <TrackHeader
              track={track}
              isSelected={selectedTrackId === track.id}
              isOnlyTrack={tracks.length === 1}
              onSelect={setSelectedTrack}
              onNameChange={handleNameChange}
              onMuteToggle={handleMuteToggle}
              onSoloToggle={handleSoloToggle}
              onVisibilityToggle={handleVisibilityToggle}
              onOpacityChange={handleOpacityChange}
              onDelete={handleDelete}
              onDragStart={handleDragStart}
            />
          </div>
        ))}

        {/* Drop zone at end */}
        <div
          onDragOver={(e) => handleDragOver(e, sortedTracks.length)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, sortedTracks.length)}
          onDragEnd={handleDragEnd}
          style={{
            height: '8px',
            position: 'relative',
          }}
        >
          {dropTargetIndex === sortedTracks.length && (
            <div style={styles.dropIndicator} />
          )}
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    width: '200px',
    backgroundColor: '#1e1e1e',
    borderRight: '1px solid #3a3a3a',
    display: 'flex',
    flexDirection: 'column' as const,
    flexShrink: 0,
  } as React.CSSProperties,
  header: {
    padding: '12px 8px',
    borderBottom: '1px solid #3a3a3a',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  } as React.CSSProperties,
  headerTitle: {
    fontSize: '12px',
    fontWeight: 'bold' as const,
    color: '#888',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  } as React.CSSProperties,
  addButton: {
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: 'bold' as const,
    color: '#fff',
    backgroundColor: '#4a9eff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'background-color 0.15s ease',
  } as React.CSSProperties,
  addButtonDisabled: {
    backgroundColor: '#444',
    cursor: 'not-allowed',
    opacity: 0.5,
  } as React.CSSProperties,
  trackList: {
    flex: 1,
    overflowY: 'auto' as const,
    maxHeight: '400px',
  } as React.CSSProperties,
  dropIndicator: {
    position: 'absolute' as const,
    top: '-2px',
    left: 0,
    right: 0,
    height: '4px',
    backgroundColor: '#4a9eff',
    boxShadow: '0 0 8px rgba(74, 158, 255, 0.8)',
    borderRadius: '2px',
    zIndex: 100,
  } as React.CSSProperties,
};
