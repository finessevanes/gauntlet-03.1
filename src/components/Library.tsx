/**
 * Library Component
 * Displays all imported clips in a scrollable panel
 * Supports click-to-preview and drag-to-timeline
 */

import React, { useEffect, useState } from 'react';
import { useSessionStore } from '../store/sessionStore';
import { ClipCard } from './ClipCard';
import { EmptyState } from './EmptyState';

export const Library: React.FC = () => {
  const clips = useSessionStore((state) => state.clips);
  const clearLibrary = useSessionStore((state) => state.clearLibrary);
  const removeClip = useSessionStore((state) => state.removeClip);
  const updateTimeline = useSessionStore((state) => state.updateTimeline);
  const setPlayheadPosition = useSessionStore((state) => state.setPlayheadPosition);
  const selectedClipId = useSessionStore((state) => state.selectedClipId);
  const selectedClipSource = useSessionStore((state) => state.selectedClipSource);
  const setSelectedClip = useSessionStore((state) => state.setSelectedClip);
  const setPreviewSource = useSessionStore((state) => state.setPreviewSource);
  const setIsPlaying = useSessionStore((state) => state.setIsPlaying);
  const [brokenFiles, setBrokenFiles] = useState<Set<string>>(new Set());
  const [isCheckingFiles, setIsCheckingFiles] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);


  // Check file existence on mount, when clips change, and periodically
  useEffect(() => {
    if (clips.length === 0) {
      setBrokenFiles(new Set());
      return;
    }

    const checkFiles = async () => {
      setIsCheckingFiles(true);
      const broken = new Set<string>();

      // Check files in batches to avoid performance issues
      for (const clip of clips) {
        try {
          const result = await window.electron.library.checkFileExists(clip.filePath);
          if (!result.exists) {
            broken.add(clip.id);
          }
        } catch (error) {
          console.error(`Error checking file ${clip.filePath}:`, error);
          broken.add(clip.id);
        }
      }

      setBrokenFiles(broken);
      setIsCheckingFiles(false);
    };

    // Initial check (debounced)
    const initialCheckTimeout = setTimeout(checkFiles, 500);

    // Periodic re-check every 5 seconds to detect file deletions
    const intervalId = setInterval(checkFiles, 5000);

    return () => {
      clearTimeout(initialCheckTimeout);
      clearInterval(intervalId);
    };
  }, [clips]);

  const handleClipClick = (clipId: string) => {
    setSelectedClip(clipId, 'library');
    setIsPlaying(false);
    setPreviewSource('library', { clipId, resetPlayhead: true });
  };

  const handleClipDragStart = (e: React.DragEvent, clipId: string) => {
    // Set active/selected state when drag starts
    setSelectedClip(clipId, 'library');

    // Set clip ID in dataTransfer for Timeline (Story 4) to receive
    e.dataTransfer.setData('clipId', clipId);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleClipDragEnd = () => {
    // Clear active/selected state after drag ends (whether dropped or not)
    setSelectedClip(null, null);
  };

  const handleClearLibrary = () => {
    clearLibrary();
    setShowClearConfirm(false);
    setSelectedClip(null, null);
  };

  const handleClipDelete = async (clipId: string) => {
    try {
      const result = await window.electron.library.removeClip(clipId);

      if (result.success) {
        // Remove from local state
        removeClip(clipId);

        // Fetch updated timeline state (in case clip was removed from timeline)
        const timelineState = await window.electron.timeline.getTimelineState();
        updateTimeline({ clips: timelineState.clips, duration: timelineState.duration });
        setPlayheadPosition(timelineState.playheadPosition);

        // Clear selection
        setSelectedClip(null, null);
      }
    } catch (error) {
      // Handle error silently
    }
  };

  // Show empty state if no clips
  if (clips.length === 0) {
    return (
      <div className="w-full h-full bg-dark-800 p-4 overflow-y-auto overflow-x-hidden relative flex flex-col">
        <EmptyState type="library" />
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-dark-800 p-4 overflow-y-auto overflow-x-hidden relative flex flex-col">
      {/* Library Header */}
      <div className="flex justify-between items-center mb-3 pb-2 border-b border-dark-700">
        <h3 className="m-0 text-sm font-semibold text-dark-200">Library ({clips.length})</h3>
        <button
          onClick={() => setShowClearConfirm(true)}
          className="px-3 py-1.5 bg-red-600 text-white border-0 rounded text-xs font-medium cursor-pointer transition-colors duration-200 hover:bg-red-700"
          title="Clear all clips from library"
        >
          Clear All
        </button>
      </div>

      {/* Clear Confirmation Dialog */}
      {showClearConfirm && (
        <div className="fixed top-0 left-0 right-0 bottom-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-dark-800 p-6 rounded-lg border border-dark-700 max-w-sm shadow-2xl">
            <p className="m-0 mb-4 text-sm text-dark-200 leading-relaxed">
              Are you sure you want to remove all {clips.length} clip(s) from the library?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleClearLibrary}
                className="px-4 py-2 bg-red-600 text-white border-0 rounded text-xs font-medium cursor-pointer transition-colors duration-200 hover:bg-red-700"
              >
                Yes, Clear All
              </button>
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 bg-dark-700 text-dark-200 border-0 rounded text-xs font-medium cursor-pointer transition-colors duration-200 hover:bg-dark-600"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-x-3 flex-1 p-4 items-start">
        {clips.map((clip) => (
          <ClipCard
            key={clip.id}
            clip={clip}
            onClick={() => handleClipClick(clip.id)}
            onDragStart={(e) => handleClipDragStart(e, clip.id)}
            onDragEnd={handleClipDragEnd}
            onDelete={() => handleClipDelete(clip.id)}
            isSelected={selectedClipId === clip.id && selectedClipSource === 'library'}
            isBroken={brokenFiles.has(clip.id)}
          />
        ))}
      </div>

      {/* Loading indicator while checking files */}
      {isCheckingFiles && clips.length > 0 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black bg-opacity-90 text-blue-400 text-xs px-3 py-1.5 rounded border border-blue-400">
          Validating files...
        </div>
      )}
    </div>
  );
};

// Styles removed - using Tailwind CSS instead
