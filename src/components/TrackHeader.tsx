/**
 * TrackHeader Component
 * Individual track control header with mute, solo, visibility, opacity controls
 */

import React, { useState, useRef, useEffect } from 'react';
import { Track } from '../types/session';

interface TrackHeaderProps {
  track: Track;
  isSelected: boolean;
  isOnlyTrack: boolean;
  onSelect: (trackId: string) => void;
  onNameChange: (trackId: string, newName: string) => void;
  onMuteToggle: (trackId: string) => void;
  onSoloToggle: (trackId: string) => void;
  onVisibilityToggle: (trackId: string) => void;
  onOpacityChange: (trackId: string, opacity: number) => void;
  onDelete: (trackId: string) => void;
  onDragStart: (e: React.DragEvent, trackId: string) => void;
}

export const TrackHeader: React.FC<TrackHeaderProps> = ({
  track,
  isSelected,
  isOnlyTrack,
  onSelect,
  onNameChange,
  onMuteToggle,
  onSoloToggle,
  onVisibilityToggle,
  onOpacityChange,
  onDelete,
  onDragStart,
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(track.name);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditingName && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingName]);

  const handleNameDoubleClick = () => {
    setIsEditingName(true);
    setEditedName(track.name);
  };

  const handleNameBlur = () => {
    setIsEditingName(false);
    if (editedName.trim() && editedName !== track.name) {
      onNameChange(track.id, editedName.trim());
    } else {
      setEditedName(track.name);
    }
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNameBlur();
    } else if (e.key === 'Escape') {
      setIsEditingName(false);
      setEditedName(track.name);
    }
  };

  const handleOpacityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    onOpacityChange(track.id, value);
  };

  return (
    <div
      style={{
        ...styles.container,
        ...(isSelected ? styles.selected : {}),
      }}
      onClick={() => onSelect(track.id)}
      draggable={!isEditingName}
      onDragStart={(e) => onDragStart(e, track.id)}
    >
      {/* Drag Handle */}
      <div style={styles.dragHandle} title="Drag to reorder">
        ≡
      </div>

      {/* Track Name */}
      <div style={styles.nameContainer}>
        {isEditingName ? (
          <input
            ref={inputRef}
            type="text"
            value={editedName}
            onChange={(e) => setEditedName(e.target.value)}
            onBlur={handleNameBlur}
            onKeyDown={handleNameKeyDown}
            style={styles.nameInput}
            maxLength={20}
          />
        ) : (
          <div
            style={styles.name}
            onDoubleClick={handleNameDoubleClick}
            title="Double-click to rename"
          >
            {track.name}
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={styles.controls}>
        {/* Mute Button */}
        <button
          style={{
            ...styles.iconButton,
            ...(track.muted ? styles.iconButtonActive : {}),
          }}
          onClick={(e) => {
            e.stopPropagation();
            onMuteToggle(track.id);
          }}
          title={track.muted ? 'Unmute' : 'Mute'}
        >
          M
        </button>

        {/* Solo Button */}
        <button
          style={{
            ...styles.iconButton,
            ...(track.solo ? styles.iconButtonActive : {}),
          }}
          onClick={(e) => {
            e.stopPropagation();
            onSoloToggle(track.id);
          }}
          title={track.solo ? 'Unsolo' : 'Solo'}
        >
          S
        </button>

        {/* Visibility Button */}
        <button
          style={{
            ...styles.iconButton,
            ...(track.visible ? {} : styles.iconButtonActive),
          }}
          onClick={(e) => {
            e.stopPropagation();
            onVisibilityToggle(track.id);
          }}
          title={track.visible ? 'Hide track' : 'Show track'}
        >
          {track.visible ? '👁' : '👁‍🗨'}
        </button>

        {/* Opacity Slider */}
        <div style={styles.opacityContainer}>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={track.opacity}
            onChange={handleOpacityChange}
            onClick={(e) => e.stopPropagation()}
            style={styles.opacitySlider}
            title={`Opacity: ${Math.round(track.opacity * 100)}%`}
          />
          <span style={styles.opacityLabel}>{Math.round(track.opacity * 100)}%</span>
        </div>

        {/* Delete Button */}
        <button
          style={{
            ...styles.deleteButton,
            ...(isOnlyTrack ? styles.deleteButtonDisabled : {}),
          }}
          onClick={(e) => {
            e.stopPropagation();
            if (!isOnlyTrack) {
              onDelete(track.id);
            }
          }}
          disabled={isOnlyTrack}
          title={isOnlyTrack ? 'Cannot delete last track' : 'Delete track'}
        >
          🗑
        </button>
      </div>
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    height: '48px',
    backgroundColor: '#2a2a2a',
    borderBottom: '1px solid #3a3a3a',
    padding: '0 8px',
    cursor: 'pointer',
    transition: 'background-color 0.15s ease',
  } as React.CSSProperties,
  selected: {
    borderLeft: '3px solid #4a9eff',
    paddingLeft: '5px',
  } as React.CSSProperties,
  dragHandle: {
    fontSize: '16px',
    color: '#666',
    marginRight: '8px',
    cursor: 'grab',
    userSelect: 'none' as const,
  } as React.CSSProperties,
  nameContainer: {
    flex: 1,
    minWidth: 0,
    marginRight: '8px',
  } as React.CSSProperties,
  name: {
    fontSize: '13px',
    fontWeight: 'bold' as const,
    color: '#ddd',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,
  nameInput: {
    width: '100%',
    fontSize: '13px',
    fontWeight: 'bold' as const,
    color: '#ddd',
    backgroundColor: '#1a1a1a',
    border: '1px solid #4a9eff',
    borderRadius: '3px',
    padding: '2px 4px',
    outline: 'none',
  } as React.CSSProperties,
  controls: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  } as React.CSSProperties,
  iconButton: {
    width: '24px',
    height: '24px',
    fontSize: '11px',
    fontWeight: 'bold' as const,
    color: '#888',
    backgroundColor: '#1a1a1a',
    border: '1px solid #3a3a3a',
    borderRadius: '3px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as React.CSSProperties,
  iconButtonActive: {
    backgroundColor: '#4a9eff',
    color: '#fff',
    borderColor: '#4a9eff',
  } as React.CSSProperties,
  opacityContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  } as React.CSSProperties,
  opacitySlider: {
    width: '60px',
    height: '4px',
    cursor: 'pointer',
  } as React.CSSProperties,
  opacityLabel: {
    fontSize: '10px',
    color: '#888',
    minWidth: '35px',
    textAlign: 'right' as const,
  } as React.CSSProperties,
  deleteButton: {
    width: '24px',
    height: '24px',
    fontSize: '14px',
    color: '#ff4444',
    backgroundColor: '#1a1a1a',
    border: '1px solid #3a3a3a',
    borderRadius: '3px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as React.CSSProperties,
  deleteButtonDisabled: {
    color: '#444',
    cursor: 'not-allowed',
    opacity: 0.5,
  } as React.CSSProperties,
};
