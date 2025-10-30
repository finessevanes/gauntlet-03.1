/**
 * Timeline Component
 * Main timeline container with clip track, playhead, controls, drop zone
 * S13: Split & Advanced Trim features integrated
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useSessionStore } from '../store/sessionStore';
import { TimelineControls } from './TimelineControls';
import { TimelineRuler } from './TimelineRuler';
import { TimelinePlayhead } from './TimelinePlayhead';
import { TimelineClip } from './TimelineClip';
import { TrimTooltip } from './TrimTooltip';
import { useTrimDrag } from '../hooks/useTrimDrag';
import { useSplit } from '../hooks/useSplit';
import { calculateAutoFitZoom, getPixelsPerSecond, logTimelineClipDurations } from '../utils/timecode';

// Timeline horizontal padding (px) - ensures edges are accessible for trimming
const TIMELINE_PADDING = 20;

export const Timeline: React.FC = () => {
  const clips = useSessionStore((state) => state.clips);
  const timeline = useSessionStore((state) => state.timeline);
  const playheadPosition = useSessionStore((state) => state.playheadPosition);
  const zoomLevel = useSessionStore((state) => state.zoomLevel);
  const scrollPosition = useSessionStore((state) => state.scrollPosition);
  const selectedClipId = useSessionStore((state) => state.selectedClipId);
  const selectedClipSource = useSessionStore((state) => state.selectedClipSource);
  const setPlayheadPosition = useSessionStore((state) => state.setPlayheadPosition);
  const setZoomLevel = useSessionStore((state) => state.setZoomLevel);
  const setScrollPosition = useSessionStore((state) => state.setScrollPosition);
  const updateTimeline = useSessionStore((state) => state.updateTimeline);
  const setSelectedClip = useSessionStore((state) => state.setSelectedClip);
  const isPlaying = useSessionStore((state) => state.isPlaying);
  const setIsPlaying = useSessionStore((state) => state.setIsPlaying);
  const previewSource = useSessionStore((state) => state.previewSource);
  const setPreviewSource = useSessionStore((state) => state.setPreviewSource);

  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [draggedClipId, setDraggedClipId] = useState<string | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<{ instanceId: string; edge: 'left' | 'right' } | null>(null);
  const [splitError, setSplitError] = useState<string | null>(null); // S13: Split error feedback
  const [splitInProgress, setSplitInProgress] = useState(false); // S13: Split operation in progress

  // S13: Split & Advanced Trim features
  const { canSplit, performSplit } = useSplit();

  // Log selection changes
  const handleClipSelect = useCallback((clipId: string) => {
    setSelectedClip(clipId, 'timeline');
    if (previewSource !== 'timeline') {
      setPreviewSource('timeline');
    }
  }, [previewSource, selectedClipId, setPreviewSource, setSelectedClip]);
  const [containerWidth, setContainerWidth] = useState(800);
  const [brokenFiles, setBrokenFiles] = useState<Set<string>>(new Set());

  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  // Trim functionality (Story 5)
  const pixelsPerSecond = getPixelsPerSecond(zoomLevel);

  // Initialize trim drag hook (must be before handleTrimComplete to access clearDraggedValues)
  const trimDrag = useTrimDrag(pixelsPerSecond, async (clipId: string, instanceId: string, inPoint: number, outPoint: number) => {
    try {
      const result = await window.electron.trim.trimClip(clipId, instanceId, inPoint, outPoint);

      if (result.success && result.timelineClip) {
        // Find and update the timeline clip with new trim points
        const updatedClips = timeline.clips.map(tc =>
          tc.instanceId === instanceId ? result.timelineClip : tc
        );

        // Recalculate timeline duration using updated trim points
        const newDuration = updatedClips.reduce((total, tc) => {
          return total + (tc.outPoint - tc.inPoint);
        }, 0);

        // Update timeline with new clips and duration
        const updatedTimeline = {
          clips: updatedClips,
          duration: newDuration,
        };

        updateTimeline(updatedTimeline);

        // Clear optimistic UI values now that backend has updated
        // This prevents the old dragged values from persisting on screen
        trimDrag.clearDraggedValues();
      } else {
        console.error('[Timeline] Trim failed:', result.error);
      }
    } catch (error) {
      console.error('[Timeline] Error trimming clip:', error);
    }
  });

  // Handle edge hover change
  const handleEdgeHoverChange = useCallback((instanceId: string, edge: 'left' | 'right' | null) => {
    if (edge === null) {
      setHoveredEdge(null);
    } else {
      setHoveredEdge({ instanceId, edge });
    }
  }, []);

  // Handle trim start - uses per-instance trim overrides
  const handleTrimStart = useCallback((clipId: string, instanceId: string, edge: 'left' | 'right', e: React.MouseEvent) => {
    const clip = clips.find(c => c.id === clipId);
    if (!clip) return;

    // Find the timeline clip to get its trim points
    const timelineClip = timeline.clips.find(tc => tc.instanceId === instanceId);
    const effectiveClip = timelineClip
      ? { ...clip, inPoint: timelineClip.inPoint, outPoint: timelineClip.outPoint }
      : clip;

    // Find the start time of this clip on the timeline
    const currentTimelineClip = timeline.clips.find(tc => tc.instanceId === instanceId);
    const startTime = currentTimelineClip?.startTime || 0;

    // Pass the effective clip (with trim override applied) to startDrag
    trimDrag.startDrag(clipId, instanceId, edge, e, effectiveClip, startTime);
  }, [clips, timeline, trimDrag]);

  // S13: Handle split operation
  const handleSplit = useCallback(async (clipInstanceId: string) => {
    if (!canSplit(clipInstanceId) || splitInProgress) {
      return;
    }

    setSplitError(null);
    setSplitInProgress(true);

    try {
      // Find the timeline clip to get the clip ID
      const timelineClip = timeline.clips.find(tc => tc.instanceId === clipInstanceId);
      if (!timelineClip) {
        setSplitError('Clip not found on timeline');
        return;
      }

      const success = await performSplit(timelineClip.clipId, clipInstanceId, playheadPosition);

      if (success) {
        setSplitError(null);
      } else {
        setSplitError('Failed to split clip. Check console for details.');
      }
    } catch (error) {
      setSplitError('Error during split operation');
    } finally {
      setSplitInProgress(false);
    }
  }, [canSplit, splitInProgress, timeline, playheadPosition, performSplit]);

  // S13: Keyboard shortcut listener for split (Cmd+X / Ctrl+X)
  useEffect(() => {
    const handleSplitShortcut = () => {
      // Find the clip at playhead position (if any)
      const clipAtPlayhead = timeline.clips.find(tc =>
        playheadPosition > tc.inPoint && playheadPosition < tc.outPoint
      );

      if (clipAtPlayhead) {
        handleSplit(clipAtPlayhead.instanceId);
      }
    };

    // Listen for the split shortcut from main process
    const unsubscribe = window.electron?.ipcRenderer?.on('split-clip-shortcut', handleSplitShortcut);

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [timeline.clips, playheadPosition, handleSplit]);

  // Measure container width for auto-fit calculation
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Log timeline clips to console whenever they change (added, removed, or trimmed)
  useEffect(() => {
    // Timeline update logic
  }, [timeline.clips, clips]);

  // Check for broken files
  useEffect(() => {
    const checkFiles = async () => {
      const broken = new Set<string>();

      for (const timelineClip of timeline.clips) {
        const clip = clips.find((c) => c.id === timelineClip.clipId);
        if (!clip) continue;

        try {
          const result = await window.electron.library.checkFileExists(clip.filePath);
          if (!result.exists) {
            broken.add(timelineClip.instanceId);
          }
        } catch (error) {
          broken.add(timelineClip.instanceId);
        }
      }

      setBrokenFiles(broken);
    };

    if (timeline.clips.length > 0) {
      checkFiles();
    }
  }, [timeline.clips, clips]);


  // Handle drag over (Library clips being dragged)
  const handleDragOver = (e: React.DragEvent) => {
    // Check if it's a clip from Library
    const hasClipId = e.dataTransfer.types.includes('clipid');

    if (hasClipId) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      setIsDraggingOver(true);
    }
  };

  const handleDragLeave = () => {
    setIsDraggingOver(false);
  };

  // Handle drop (add clip to timeline at end)
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    const clipId = e.dataTransfer.getData('clipId');
    const timelineClipId = e.dataTransfer.getData('timelineClipId');
    const type = e.dataTransfer.getData('type');

    // Handle timeline clip reorder to end
    if (type === 'reorder' && timelineClipId) {
      const currentPosition = timeline.clips.findIndex(tc => tc.instanceId === timelineClipId);
      const lastPosition = timeline.clips.length - 1;

      if (currentPosition !== lastPosition) {
        await handleReorder(timelineClipId, lastPosition);
      }
      return;
    }

    // Handle Library clips
    if (!clipId) {
      return;
    }

    // Check if already processing (prevent double-add from preload)
    if ((window as any)._processingDrop) {
      return;
    }

    (window as any)._processingDrop = true;

    try {
      // Add to end (no position specified)
      const result = await window.electron.timeline.addClipToTimeline(clipId);

      if (result.success) {
        // Fetch updated timeline state
        const state = await window.electron.timeline.getTimelineState();
        updateTimeline({ clips: state.clips, duration: state.duration });
        // Log all clip durations after adding
        logTimelineClipDurations(clips, { clips: state.clips, duration: state.duration });
      }
    } catch (error) {
      // Handle error silently
    } finally {
      setTimeout(() => {
        (window as any)._processingDrop = false;
      }, 100);
    }
  };

  // Handle inserting library clip at specific position (from TimelineClip drop)
  const handleInsertLibraryClip = async (clipId: string, position: number) => {
    // Check if already processing (prevent double-add)
    if ((window as any)._processingDrop) {
      return;
    }

    (window as any)._processingDrop = true;

    try {
      const result = await window.electron.timeline.addClipToTimeline(clipId, position);

      if (result.success) {
        // Fetch updated timeline state
        const state = await window.electron.timeline.getTimelineState();
        updateTimeline({ clips: state.clips, duration: state.duration });
        // Log all clip durations after adding
        logTimelineClipDurations(clips, { clips: state.clips, duration: state.duration });
      }
    } catch (error) {
      // Handle error silently
    } finally {
      setDropTargetIndex(null);
      setTimeout(() => {
        (window as any)._processingDrop = false;
      }, 100);
    }
  };

  // Handle zoom change
  const handleZoomChange = async (zoom: number | 'auto') => {
    if (zoom === 'auto') {
      const autoZoom = calculateAutoFitZoom(containerWidth, timeline.duration);
      setZoomLevel(autoZoom);
      await window.electron.timeline.setZoom(autoZoom);
    } else {
      setZoomLevel(zoom);
      await window.electron.timeline.setZoom(zoom);
    }
  };

  // Handle playhead seek
  const handleSeek = async (time: number) => {
    if (previewSource !== 'timeline') {
      setPreviewSource('timeline');
    }
    // setPlayheadPosition now persists to disk automatically via Zustand
    setPlayheadPosition(time);
  };

  // Handle clip reorder
  const handleReorder = async (instanceId: string, newPosition: number) => {
    const currentPosition = timeline.clips.findIndex(tc => tc.instanceId === instanceId);

    // Validation: Don't reorder if position hasn't changed
    if (currentPosition === newPosition) {
      setDraggedClipId(null);
      setDropTargetIndex(null);
      return;
    }

    try {
      const result = await window.electron.timeline.reorderClip(instanceId, newPosition);

      if (result.success && result.updatedTimeline) {
        updateTimeline({ clips: result.updatedTimeline, duration: result.duration || timeline.duration });
      }
    } catch (error) {
      // Handle error silently
    } finally {
      setDraggedClipId(null);
      setDropTargetIndex(null);
    }
  };

  // Handle drag start for timeline clips
  const handleClipDragStart = (clipId: string) => {
    setDraggedClipId(clipId);
  };

  // Handle drag end
  const handleClipDragEnd = () => {
    setDropTargetIndex(null);
    setDraggedClipId(null);
    setSelectedClip(null, null); // Deselect clip when drag ends
  };

  // Handle when clip is dragged over another clip (to show insertion point)
  const handleClipDragEnter = (targetIndex: number) => {
    // If we're reordering a timeline clip, check if this is a valid drop position
    if (draggedClipId) {
      const draggedClipIndex = timeline.clips.findIndex(tc => tc.instanceId === draggedClipId);

      // Calculate the final position after the move
      // When we remove the clip from its current position and insert at target:
      // - If target > current: final position = target - 1
      // - If target <= current: final position = target
      const finalPosition = targetIndex > draggedClipIndex ? targetIndex - 1 : targetIndex;

      // Only show indicator if the clip will end up in a different position
      if (finalPosition === draggedClipIndex) {
        setDropTargetIndex(null);
        return;
      }
    }

    setDropTargetIndex(targetIndex);
  };

  // Handle clip delete
  const handleDelete = async (instanceId: string) => {

    try {
      const result = await window.electron.timeline.deleteClip(instanceId);

      if (result.success && result.updatedTimeline) {
        // Fetch updated timeline state (includes recalculated duration)
        const state = await window.electron.timeline.getTimelineState();
        updateTimeline({ clips: state.clips, duration: state.duration });
        setPlayheadPosition(state.playheadPosition); // Update playhead if it was reset
        setSelectedClip(null, null);
      }
    } catch (error) {
      // Handle error silently
    }
  };

  // Handle scroll position save (debounced)
  useEffect(() => {
    if (!trackRef.current) return;

    const handleScroll = () => {
      if (!trackRef.current) return;
      const scrollX = trackRef.current.scrollLeft;

      // Debounce: save scroll position after 500ms of no scrolling
      clearTimeout((window as any)._scrollTimeout);
      (window as any)._scrollTimeout = setTimeout(() => {
        // setScrollPosition now persists to disk automatically via Zustand
        setScrollPosition(scrollX);
      }, 500);
    };

    trackRef.current.addEventListener('scroll', handleScroll);
    return () => trackRef.current?.removeEventListener('scroll', handleScroll);
  }, [setScrollPosition]);

  // Restore scroll position on mount
  useEffect(() => {
    if (trackRef.current && scrollPosition > 0) {
      trackRef.current.scrollLeft = scrollPosition;
    }
  }, [scrollPosition]);

  // Deselect clip when clicking outside timeline (only if timeline clip is selected)
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // Only handle if a timeline clip is selected
      if (selectedClipSource !== 'timeline') return;

      // Check if click is outside the timeline container
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        if (selectedClipId) {
          setSelectedClip(null, null);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedClipId, selectedClipSource, setSelectedClip]);

  const timelineWidth = Math.max(containerWidth, timeline.duration * pixelsPerSecond);

  // Handle click on timeline background to deselect clips
  const handleTimelineClick = (e: React.MouseEvent) => {
    // Only deselect if clicking directly on the track container (not on clips)
    if (e.target === e.currentTarget || e.target === trackRef.current) {
      setSelectedClip(null, null);
      if (previewSource !== 'timeline') {
        setPreviewSource('timeline');
      }
    }
  };

  const canPlayTimeline = timeline.clips.length > 0 && timeline.duration > 0;

  const handleTogglePlay = () => {
    if (!canPlayTimeline) return;
    if (previewSource !== 'timeline') {
      setPreviewSource('timeline');
      setIsPlaying(true);
      return;
    }
    setIsPlaying(!isPlaying);
  };

  return (
    <div style={styles.container} ref={containerRef}>
      {/* Controls */}
      <TimelineControls
        playheadPosition={playheadPosition}
        timelineDuration={timeline.duration}
        zoomLevel={zoomLevel}
        onZoomChange={handleZoomChange}
      />

      {/* S13: Split Toolbar */}
      {timeline.clips.length > 0 && (
        <div style={styles.splitToolbar}>
          {(() => {
            // Find the clip at playhead position (if any)
            const clipAtPlayhead = timeline.clips.find(tc =>
              playheadPosition > tc.inPoint && playheadPosition < tc.outPoint
            );
            return (
              <>
                <button
                  onClick={() => {
                    if (clipAtPlayhead) {
                      handleSplit(clipAtPlayhead.instanceId);
                    }
                  }}
                  disabled={!clipAtPlayhead || splitInProgress}
                  style={{
                    ...styles.splitButton,
                    ...(clipAtPlayhead && !splitInProgress ? styles.splitButtonEnabled : styles.splitButtonDisabled),
                  }}
                  title={clipAtPlayhead ? 'Split clip at playhead (Cmd+X / Ctrl+X)' : 'Position playhead within a clip to split'}
                >
                  {splitInProgress ? 'Splitting...' : 'Split'}
                </button>
                {splitError && (
                  <span style={styles.errorMessage}>{splitError}</span>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* Timeline Track Container with Fixed Header */}
      <div style={styles.timelineWrapper}>
        {/* Fixed Track Labels Header */}
        <div style={styles.trackLabelsHeader}>
          {/* Ruler header cell */}
          <div style={styles.trackLabelHeader}></div>
          <div style={styles.trackLabel}>V1</div>
          <div style={styles.trackLabel}>A2</div>
          <div style={styles.trackLabel}>A1</div>
          <div style={styles.trackLabel}>TXT</div>
          <div style={styles.trackLabel}>AO</div>
        </div>

        {/* Scrollable Timeline Track */}
        <div
          ref={trackRef}
          style={styles.trackContainer}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleTimelineClick}
        >
        {/* Empty State */}
        {timeline.clips.length === 0 && (
          <div style={{ ...styles.emptyState, opacity: isDraggingOver ? 0.3 : 1 }}>
            <span style={styles.emptyIcon}>🎬</span>
            <p style={styles.emptyText}>Drag clips here to start editing</p>
          </div>
        )}

        {/* Drag Over Highlight */}
        {isDraggingOver && (
          <div style={styles.dragOverlay}>
            <span style={styles.dragOverlayText}>Drop clip to add to timeline</span>
          </div>
        )}

        {/* Timeline Content */}
        {timeline.clips.length > 0 && (
          <div
            style={{ ...styles.track, width: `${timelineWidth}px` }}
            onClick={handleTimelineClick}
          >
            {/* Ruler */}
            <TimelineRuler
              timelineDuration={timeline.duration}
              zoomLevel={zoomLevel}
              containerWidth={containerWidth}
              timelineWidth={timelineWidth}
              padding={TIMELINE_PADDING}
            />

            {/* Drop Indicator - Render once at the calculated position */}
            {dropTargetIndex !== null && (
              <div
                style={{
                  position: 'absolute' as const,
                  left: (() => {
                    // Calculate the pixel position for the drop indicator
                    if (dropTargetIndex === 0) {
                      // Insert at beginning
                      return `${TIMELINE_PADDING}px`;
                    } else if (dropTargetIndex >= timeline.clips.length) {
                      // Insert at end
                      const lastTimelineClip = timeline.clips[timeline.clips.length - 1];
                      const lastClipEnd = lastTimelineClip.startTime + (lastTimelineClip.outPoint - lastTimelineClip.inPoint);
                      return `${TIMELINE_PADDING + lastClipEnd * pixelsPerSecond}px`;
                    } else {
                      // Insert between clips - show at start of clip at dropTargetIndex
                      const targetTimelineClip = timeline.clips[dropTargetIndex];
                      return `${TIMELINE_PADDING + targetTimelineClip.startTime * pixelsPerSecond}px`;
                    }
                  })(),
                  top: '24px',
                  width: '4px',
                  height: '60px',
                  backgroundColor: '#4a9eff',
                  zIndex: 50,
                  boxShadow: '0 0 8px rgba(74, 158, 255, 0.8)',
                  borderRadius: '2px',
                }}
              />
            )}

            {/* Clips */}
            {timeline.clips.map((timelineClip, index) => {
              const clip = clips.find((c) => c.id === timelineClip.clipId);
              if (!clip) return null;

              // Use timeline clip's trim points directly
              const effectiveClip = {
                ...clip,
                inPoint: timelineClip.inPoint,
                outPoint: timelineClip.outPoint,
              };

              const isClipSelected = selectedClipId === timelineClip.instanceId && selectedClipSource === 'timeline';

              // Check if this clip instance is being trimmed and overlaps with any other clip
              const isBeingTrimmed = trimDrag.dragging !== null && trimDrag.dragging.instanceId === timelineClip.instanceId;
              let isTrimmedClipOverlapping = false;

              if (isBeingTrimmed && trimDrag.draggedInPoint !== null && trimDrag.draggedOutPoint !== null) {
                // Calculate the current dragged clip's range on the timeline
                const draggedClipStart = timelineClip.startTime;
                const draggedClipEnd = draggedClipStart + (trimDrag.draggedOutPoint - trimDrag.draggedInPoint);

                // Check if it overlaps with any other clip
                for (let i = 0; i < timeline.clips.length; i++) {
                  if (i === index) continue; // Skip itself

                  const otherTimelineClip = timeline.clips[i];
                  const otherClip = clips.find((c) => c.id === otherTimelineClip.clipId);
                  if (!otherClip) continue;

                  // Use other timeline clip's trim points directly
                  const effectiveOtherClip = {
                    ...otherClip,
                    inPoint: otherTimelineClip.inPoint,
                    outPoint: otherTimelineClip.outPoint,
                  };

                  const otherClipStart = otherTimelineClip.startTime;
                  const otherClipEnd = otherClipStart + (effectiveOtherClip.outPoint - effectiveOtherClip.inPoint);

                  // Check for overlap: clip1.start < clip2.end AND clip1.end > clip2.start
                  if (draggedClipStart < otherClipEnd && draggedClipEnd > otherClipStart) {
                    isTrimmedClipOverlapping = true;
                    break;
                  }
                }
              }

              return (
                <TimelineClip
                  key={timelineClip.instanceId}
                  clip={effectiveClip}
                  instanceId={timelineClip.instanceId}
                  index={index}
                  zoomLevel={zoomLevel}
                  startTime={timelineClip.startTime}
                  padding={TIMELINE_PADDING}
                  onReorder={handleReorder}
                  onDelete={handleDelete}
                  onInsertLibraryClip={handleInsertLibraryClip}
                  isSelected={isClipSelected}
                  onSelect={handleClipSelect}
                  isBroken={brokenFiles.has(timelineClip.instanceId)}
                  isDragging={draggedClipId === timelineClip.instanceId}
                  onDragStart={handleClipDragStart}
                  onDragEnd={handleClipDragEnd}
                  onDragEnter={handleClipDragEnter}
                  draggedClipIndex={draggedClipId ? timeline.clips.findIndex(tc => tc.instanceId === draggedClipId) : null}
                  hoveredEdge={hoveredEdge}
                  onEdgeHoverChange={handleEdgeHoverChange}
                  onTrimStart={handleTrimStart}
                  isTrimming={trimDrag.dragging !== null && trimDrag.dragging.instanceId === timelineClip.instanceId}
                  draggedInPoint={trimDrag.dragging?.instanceId === timelineClip.instanceId ? trimDrag.draggedInPoint : null}
                  draggedOutPoint={trimDrag.dragging?.instanceId === timelineClip.instanceId ? trimDrag.draggedOutPoint : null}
                  isTrimmedClipOverlapping={isTrimmedClipOverlapping}
                />
              );
            })}

            {/* Playhead */}
            <TimelinePlayhead
              playheadPosition={playheadPosition}
              timelineDuration={timeline.duration}
              zoomLevel={zoomLevel}
              padding={TIMELINE_PADDING}
              onSeek={handleSeek}
            />
          </div>
        )}
        </div>
      </div>

      {/* Trim Tooltip (Story 5) */}
      {trimDrag.dragging && trimDrag.tooltipVisible && (() => {
        const clip = clips.find(c => c.id === trimDrag.dragging!.clipId);
        if (!clip) return null;

        const originalDuration = clip.outPoint - clip.inPoint;
        const newDuration = (trimDrag.draggedOutPoint ?? clip.outPoint) - (trimDrag.draggedInPoint ?? clip.inPoint);
        const draggedInPoint = trimDrag.draggedInPoint ?? clip.inPoint;
        const draggedOutPoint = trimDrag.draggedOutPoint ?? clip.outPoint;
        const isExpanding = draggedInPoint < clip.inPoint || draggedOutPoint > clip.outPoint;

        return (
          <TrimTooltip
            originalDuration={originalDuration}
            newDuration={newDuration}
            position={trimDrag.tooltipPosition}
            visible={true}
            isExpanding={isExpanding}
          />
        );
      })()}
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
    backgroundColor: '#1a1a1a',
  },
  timelineWrapper: {
    display: 'flex',
    flexDirection: 'row' as const,
    flex: 1,
    minHeight: '500px', // S13: Increased minimum height for better clip visibility
  },
  trackContainer: {
    flex: 1,
    overflowX: 'auto' as const,
    overflowY: 'hidden' as const,
    position: 'relative' as const,
    backgroundColor: '#1a1a1a',
  },
  track: {
    position: 'relative' as const,
    height: '450px', // S13: Increased from 300px for much better clip visibility
    minWidth: '100%',
    paddingLeft: '20px', // Add padding to make left edge easier to access
    paddingRight: '20px', // Add padding for symmetry
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#666',
  },
  emptyIcon: {
    fontSize: '48px',
    marginBottom: '16px',
    opacity: 0.3,
  },
  emptyText: {
    fontSize: '14px',
    margin: 0,
    opacity: 0.5,
  },
  dragOverlay: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(74, 158, 255, 0.1)',
    border: '2px dashed #4a9eff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none' as const,
    zIndex: 10,
  },
  dragOverlayText: {
    fontSize: '16px',
    color: '#4a9eff',
    fontWeight: 'bold' as const,
  },
  trackLabelsHeader: {
    width: '60px',
    minWidth: '60px',
    backgroundColor: '#252525',
    borderRight: '1px solid #333',
    display: 'flex',
    flexDirection: 'column' as const,
    zIndex: 10,
  },
  trackLabelHeader: {
    height: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: 'bold' as const,
    color: '#999',
    borderBottom: '1px solid #333',
    backgroundColor: '#2a2a2a',
  },
  trackLabel: {
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: 'bold' as const,
    color: '#999',
    borderBottom: '1px solid #333',
    backgroundColor: '#1e1e1e',
  },
  // S13: Split toolbar styles
  splitToolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '4px 16px', // S13: Reduced from 8px to save vertical space
    backgroundColor: '#252525',
    borderBottom: '1px solid #333',
    fontSize: '12px',
  },
  splitButton: {
    padding: '8px 20px',
    border: '1px solid #555',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 'bold' as const,
    cursor: 'pointer',
    transition: 'all 0.2s',
    outline: 'none',
  },
  splitButtonEnabled: {
    backgroundColor: '#ff6b35',
    color: '#fff',
    border: '1px solid #ff4500',
    boxShadow: '0 0 8px rgba(255, 107, 53, 0.4)',
  },
  splitButtonDisabled: {
    backgroundColor: '#3a3a3a',
    color: '#666',
    border: '1px solid #444',
    cursor: 'not-allowed',
    opacity: 0.4,
  },
  errorMessage: {
    color: '#ff6b6b',
    fontSize: '11px',
    padding: '4px 8px',
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    borderRadius: '3px',
    border: '1px solid rgba(255, 107, 107, 0.3)',
  },
};
