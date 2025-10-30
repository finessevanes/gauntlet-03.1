/**
 * Timeline Component
 * Main timeline container with clip track, playhead, controls, drop zone
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useSessionStore } from '../store/sessionStore';
import { TimelineControls } from './TimelineControls';
import { TimelineRuler } from './TimelineRuler';
import { TimelinePlayhead } from './TimelinePlayhead';
import { TimelineClip } from './TimelineClip';
import { TrimTooltip } from './TrimTooltip';
import { useTrimDrag } from '../hooks/useTrimDrag';
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
  const updateTimeline = useSessionStore((state) => state.updateTimeline);
  const setSelectedClip = useSessionStore((state) => state.setSelectedClip);
  const isPlaying = useSessionStore((state) => state.isPlaying);
  const setIsPlaying = useSessionStore((state) => state.setIsPlaying);
  const previewSource = useSessionStore((state) => state.previewSource);
  const setPreviewSource = useSessionStore((state) => state.setPreviewSource);

  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [draggedClipId, setDraggedClipId] = useState<string | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<{ clipId: string; edge: 'left' | 'right' } | null>(null);

  // Log selection changes
  const handleClipSelect = useCallback((clipId: string) => {
    console.log('[Timeline] Clip selection changed:', {
      previousSelection: selectedClipId,
      newSelection: clipId,
    });
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

  // Trim completion handler
  const handleTrimComplete = useCallback(async (clipId: string, inPoint: number, outPoint: number) => {
    console.log('[Timeline] Trim complete, calling IPC:', { clipId: clipId.substring(0, 8), inPoint, outPoint });

    try {
      const result = await window.electron.trim.trimClip(clipId, inPoint, outPoint);

      if (result.success && result.clip) {
        // Update the clip in the session store
        const updatedClips = clips.map(c => c.id === clipId ? result.clip! : c);
        useSessionStore.setState({ clips: updatedClips });

        // Recalculate timeline duration
        const newDuration = timeline.clips.reduce((total, tc) => {
          const clip = updatedClips.find(c => c.id === tc.clipId);
          return total + (clip ? (clip.outPoint - clip.inPoint) : 0);
        }, 0);

        updateTimeline({ clips: timeline.clips, duration: newDuration });

        // Persist the updated session to disk (critical for persistence across app restarts)
        const session = {
          version: '1.0.0',
          clips: updatedClips,
          timeline: { clips: timeline.clips, duration: newDuration },
          zoomLevel: zoomLevel,
          playheadPosition: playheadPosition,
          scrollPosition: scrollPosition,
          lastModified: Date.now(),
        };

        await window.electron.timeline.saveSession(session);

        console.log('[Timeline] Trim applied successfully, new duration:', newDuration);
      } else {
        console.error('[Timeline] Trim failed:', result.error);
      }
    } catch (error) {
      console.error('[Timeline] Error trimming clip:', error);
    }
  }, [clips, timeline.clips, updateTimeline, zoomLevel, playheadPosition, scrollPosition]);

  // Initialize trim drag hook
  const trimDrag = useTrimDrag(pixelsPerSecond, handleTrimComplete);

  // Handle edge hover change
  const handleEdgeHoverChange = useCallback((clipId: string, edge: 'left' | 'right' | null) => {
    if (edge === null) {
      setHoveredEdge(null);
    } else {
      setHoveredEdge({ clipId, edge });
    }
  }, []);

  // Handle trim start
  const handleTrimStart = useCallback((clipId: string, edge: 'left' | 'right', e: React.MouseEvent) => {
    const clip = clips.find(c => c.id === clipId);
    if (!clip) return;

    // Find the start time of this clip on the timeline
    let startTime = 0;
    for (const timelineClip of timeline.clips) {
      const tcClip = clips.find(c => c.id === timelineClip.clipId);
      if (tcClip) {
        if (tcClip.id === clipId) break;
        startTime += tcClip.outPoint - tcClip.inPoint;
      }
    }

    trimDrag.startDrag(clipId, edge, e, clip, startTime);
  }, [clips, timeline.clips, trimDrag]);

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
          console.error(`Error checking file ${clip.filePath}:`, error);
          broken.add(timelineClip.instanceId);
        }
      }

      setBrokenFiles(broken);
    };

    if (timeline.clips.length > 0) {
      checkFiles();
    }
  }, [timeline.clips, clips]);

  // Calculate clip start times (cumulative durations)
  const clipStartTimes = useCallback(() => {
    const startTimes: Record<string, number> = {};
    let cumulativeTime = 0;

    for (const timelineClip of timeline.clips) {
      const clip = clips.find((c) => c.id === timelineClip.clipId);
      if (clip) {
        startTimes[timelineClip.instanceId] = cumulativeTime;
        cumulativeTime += clip.outPoint - clip.inPoint;
      }
    }

    return startTimes;
  }, [timeline.clips, clips]);

  const startTimes = clipStartTimes();

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

    console.log('[Timeline] Drop event:', { clipId, timelineClipId, type, target: e.target });

    // Handle timeline clip reorder to end
    if (type === 'reorder' && timelineClipId) {
      console.log('[Timeline] Reorder to end - moving clip to last position');
      const currentPosition = timeline.clips.findIndex(tc => tc.instanceId === timelineClipId);
      const lastPosition = timeline.clips.length - 1;

      if (currentPosition !== lastPosition) {
        await handleReorder(timelineClipId, lastPosition);
      } else {
        console.log('[Timeline] Clip already at end, no reorder needed');
      }
      return;
    }

    // Handle Library clips
    if (!clipId) {
      console.log('[Timeline] No clipId in drop event, ignoring');
      return;
    }

    // Check if already processing (prevent double-add from preload)
    if ((window as any)._processingDrop) {
      console.log('[Timeline] Already processing drop, ignoring duplicate');
      return;
    }

    (window as any)._processingDrop = true;

    console.log('[Timeline] Adding clip to end of timeline:', clipId);

    try {
      // Add to end (no position specified)
      const result = await window.electron.timeline.addClipToTimeline(clipId);

      if (result.success) {
        // Fetch updated timeline state
        const state = await window.electron.timeline.getTimelineState();
        updateTimeline({ clips: state.clips, duration: state.duration });
        console.log('[Timeline] Clip added successfully, timeline now has', state.clips.length, 'clips');
        // Log all clip durations after adding
        logTimelineClipDurations(clips, { clips: state.clips, duration: state.duration });
      } else {
        console.error('[Timeline] Failed to add clip:', result.error);
      }
    } catch (error) {
      console.error('[Timeline] Error adding clip:', error);
    } finally {
      setTimeout(() => {
        (window as any)._processingDrop = false;
      }, 100);
    }
  };

  // Handle inserting library clip at specific position (from TimelineClip drop)
  const handleInsertLibraryClip = async (clipId: string, position: number) => {
    console.log('[Timeline] Inserting library clip at position:', { clipId, position });

    // Check if already processing (prevent double-add)
    if ((window as any)._processingDrop) {
      console.log('[Timeline] Already processing drop, ignoring duplicate');
      return;
    }

    (window as any)._processingDrop = true;

    try {
      const result = await window.electron.timeline.addClipToTimeline(clipId, position);

      if (result.success) {
        // Fetch updated timeline state
        const state = await window.electron.timeline.getTimelineState();
        updateTimeline({ clips: state.clips, duration: state.duration });
        console.log('[Timeline] Clip inserted successfully at position', position, ', timeline now has', state.clips.length, 'clips');
        // Log all clip durations after adding
        logTimelineClipDurations(clips, { clips: state.clips, duration: state.duration });
      } else {
        console.error('[Timeline] Failed to insert clip:', result.error);
      }
    } catch (error) {
      console.error('[Timeline] Error inserting clip:', error);
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
    setPlayheadPosition(time);
    await window.electron.timeline.setPlayheadPosition(time);
  };

  // Handle clip reorder
  const handleReorder = async (instanceId: string, newPosition: number) => {
    const currentPosition = timeline.clips.findIndex(tc => tc.instanceId === instanceId);

    console.log('[Timeline] handleReorder called:', {
      instanceId: instanceId.substring(0, 8),
      currentPosition,
      requestedPosition: newPosition,
      timelineLength: timeline.clips.length,
      timelineBefore: timeline.clips.map((tc, i) => `${i}:${clips.find(c => c.id === tc.clipId)?.filename.substring(0, 10)}`),
    });

    // Validation: Don't reorder if position hasn't changed
    if (currentPosition === newPosition) {
      console.log('[Timeline] Position unchanged, skipping reorder');
      setDraggedClipId(null);
      setDropTargetIndex(null);
      return;
    }

    try {
      const result = await window.electron.timeline.reorderClip(instanceId, newPosition);

      if (result.success && result.updatedTimeline) {
        updateTimeline({ clips: result.updatedTimeline, duration: timeline.duration });
        console.log('[Timeline] Clip reordered successfully, timeline now:',
          result.updatedTimeline.map((tc, i) => `${i}:${clips.find(c => c.id === tc.clipId)?.filename.substring(0, 10)}`));
      } else {
        console.error('[Timeline] Failed to reorder clip:', result.error);
      }
    } catch (error) {
      console.error('[Timeline] Error reordering clip:', error);
    } finally {
      setDraggedClipId(null);
      setDropTargetIndex(null);
    }
  };

  // Handle drag start for timeline clips
  const handleClipDragStart = (clipId: string) => {
    console.log('[Timeline] Clip drag started:', clipId);
    setDraggedClipId(clipId);
  };

  // Handle drag end
  const handleClipDragEnd = () => {
    console.log('[Timeline] Drag ended, clearing drop target and selection');
    setDropTargetIndex(null);
    setDraggedClipId(null);
    setSelectedClip(null, null); // Deselect clip when drag ends
  };

  // Handle when clip is dragged over another clip (to show insertion point)
  const handleClipDragEnter = (targetIndex: number) => {
    console.log('[Timeline] Drag entered at targetIndex:', targetIndex);

    // If we're reordering a timeline clip, check if this is a valid drop position
    if (draggedClipId) {
      const draggedClipIndex = timeline.clips.findIndex(tc => tc.instanceId === draggedClipId);

      // Calculate the final position after the move
      // When we remove the clip from its current position and insert at target:
      // - If target > current: final position = target - 1
      // - If target <= current: final position = target
      const finalPosition = targetIndex > draggedClipIndex ? targetIndex - 1 : targetIndex;

      console.log('[Timeline] Reorder validation:', {
        draggedClipIndex,
        targetIndex,
        finalPosition,
        timelineLength: timeline.clips.length,
        wouldChangePosition: finalPosition !== draggedClipIndex,
      });

      // Only show indicator if the clip will end up in a different position
      if (finalPosition === draggedClipIndex) {
        console.log('[Timeline] Clip would end up in same position, hiding indicator');
        setDropTargetIndex(null);
        return;
      }
    }

    console.log('[Timeline] Showing drop indicator at index:', targetIndex);
    setDropTargetIndex(targetIndex);
  };

  // Debug: Log draggedClipId changes
  useEffect(() => {
    console.log('[Timeline] draggedClipId changed:', draggedClipId);
  }, [draggedClipId]);

  // Handle clip delete
  const handleDelete = async (instanceId: string) => {
    console.log('[Timeline] Deleting clip:', instanceId);

    try {
      const result = await window.electron.timeline.deleteClip(instanceId);

      if (result.success && result.updatedTimeline) {
        // Fetch updated timeline state (includes recalculated duration)
        const state = await window.electron.timeline.getTimelineState();
        updateTimeline({ clips: state.clips, duration: state.duration });
        setPlayheadPosition(state.playheadPosition); // Update playhead if it was reset
        setSelectedClip(null, null);
        console.log('[Timeline] Clip deleted successfully');
      } else {
        console.error('[Timeline] Failed to delete clip:', result.error);
      }
    } catch (error) {
      console.error('[Timeline] Error deleting clip:', error);
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
      (window as any)._scrollTimeout = setTimeout(async () => {
        await window.electron.timeline.setScrollPosition(scrollX);
      }, 500);
    };

    trackRef.current.addEventListener('scroll', handleScroll);
    return () => trackRef.current?.removeEventListener('scroll', handleScroll);
  }, []);

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
          console.log('[Timeline] Clicked outside timeline, deselecting clip');
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
      console.log('[Timeline] Clicked on empty space, deselecting clip');
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

      {/* Timeline Track */}
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

            {/* Track Labels */}
            <div style={styles.trackLabels}>
              <div style={styles.trackLabel}>V1</div>
              <div style={styles.trackLabel}>A2</div>
              <div style={styles.trackLabel}>A1</div>
              <div style={styles.trackLabel}>TXT</div>
              <div style={styles.trackLabel}>AO</div>
            </div>

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
                      const lastClip = clips.find(c => c.id === lastTimelineClip.clipId);
                      if (lastClip) {
                        const lastClipStart = startTimes[lastTimelineClip.instanceId] || 0;
                        const lastClipDuration = lastClip.outPoint - lastClip.inPoint;
                        return `${TIMELINE_PADDING + (lastClipStart + lastClipDuration) * pixelsPerSecond}px`;
                      }
                      return `${TIMELINE_PADDING}px`;
                    } else {
                      // Insert between clips - show at start of clip at dropTargetIndex
                      const targetTimelineClip = timeline.clips[dropTargetIndex];
                      return `${TIMELINE_PADDING + (startTimes[targetTimelineClip.instanceId] || 0) * pixelsPerSecond}px`;
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

              // Check if this clip is being trimmed and overlaps with any other clip
              const isBeingTrimmed = trimDrag.dragging !== null && trimDrag.dragging.clipId === clip.id;
              let isTrimmedClipOverlapping = false;

              if (isBeingTrimmed && trimDrag.draggedInPoint !== null && trimDrag.draggedOutPoint !== null) {
                // Calculate the current dragged clip's range on the timeline
                const draggedClipStart = startTimes[timelineClip.instanceId] || 0;
                const draggedClipEnd = draggedClipStart + (trimDrag.draggedOutPoint - trimDrag.draggedInPoint);

                // Check if it overlaps with any other clip
                for (let i = 0; i < timeline.clips.length; i++) {
                  if (i === index) continue; // Skip itself

                  const otherTimelineClip = timeline.clips[i];
                  const otherClip = clips.find((c) => c.id === otherTimelineClip.clipId);
                  if (!otherClip) continue;

                  const otherClipStart = startTimes[otherTimelineClip.instanceId] || 0;
                  const otherClipEnd = otherClipStart + (otherClip.outPoint - otherClip.inPoint);

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
                  clip={clip}
                  instanceId={timelineClip.instanceId}
                  index={index}
                  zoomLevel={zoomLevel}
                  startTime={startTimes[timelineClip.instanceId] || 0}
                  padding={TIMELINE_PADDING}
                  onReorder={handleReorder}
                  onDelete={handleDelete}
                  onInsertLibraryClip={handleInsertLibraryClip}
                  isSelected={selectedClipId === timelineClip.instanceId && selectedClipSource === 'timeline'}
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
                  isTrimming={trimDrag.dragging !== null && trimDrag.dragging.clipId === clip.id}
                  draggedInPoint={trimDrag.dragging?.clipId === clip.id ? trimDrag.draggedInPoint : null}
                  draggedOutPoint={trimDrag.dragging?.clipId === clip.id ? trimDrag.draggedOutPoint : null}
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
  trackContainer: {
    flex: 1,
    overflowX: 'auto' as const,
    overflowY: 'hidden' as const,
    position: 'relative' as const,
    backgroundColor: '#1a1a1a',
  },
  track: {
    position: 'relative' as const,
    height: '200px',
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
  trackLabels: {
    position: 'absolute' as const,
    left: '0',
    top: '24px',
    width: '60px',
    height: '100%',
    backgroundColor: '#252525',
    borderRight: '1px solid #333',
    display: 'flex',
    flexDirection: 'column' as const,
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
};
