/**
 * TimelineV2 Component
 * Main multitrack timeline with vertical track stacking
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useTimelineStore } from '../../store/timelineStore';
import { useSessionStore } from '../../store/sessionStore'; // For library clips
import { useUndoRedo } from '../../hooks/useUndoRedo';
import { useSnapping } from '../../hooks/useSnapping';
import { TrackV2 } from './TrackV2';
import { ticksToSeconds, secondsToTicks, TRACK_POLICY_PRESETS } from '../../types/timeline';
import { InsertCommand } from '../../timeline/commands/InsertCommand';
import { DeleteCommand } from '../../timeline/commands/DeleteCommand';
import { TrimCommand } from '../../timeline/commands/TrimCommand';
import { SplitCommand } from '../../timeline/commands/SplitCommand';
import { MoveCommand } from '../../timeline/commands/MoveCommand';
import type { Clip as TimelineClip, Track } from '../../types/timeline';
import { v4 as uuidv4 } from 'uuid';
import ExportModal from '../ExportModal';
import PresetSelector from '../PresetSelector';
import PresetManager from '../PresetManager';
import type { ExportPreset } from '../../types/export';

export function TimelineV2() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [trackHeights, setTrackHeights] = useState<{ trackId: string; top: number; height: number }[]>([]);

  // Log only on first mount (not on every render)
  useEffect(() => {
    console.log('🔄 [TimelineV2] Component mounted - v2 with logging');
  }, []);

  // Trim state
  const [trimState, setTrimState] = useState<{
    clipId: string;
    edge: 'left' | 'right';
    startX: number;
    originalClip: TimelineClip;
    currentX?: number; // Live mouse position for preview
  } | null>(null);

  // Drag state for repositioning clips
  const [dragState, setDragState] = useState<{
    clipId: string;
    startX: number;
    originalClip: TimelineClip;
    currentX?: number; // Live mouse position for preview
    hasMoved?: boolean; // Track if we've exceeded the drag threshold
  } | null>(null);

  // Store state - New timeline
  const doc = useTimelineStore((state) => state.doc);
  const selectedClipIds = useTimelineStore((state) => state.selectedClipIds);
  const zoomLevel = useTimelineStore((state) => state.zoomLevel);
  const scrollPosition = useTimelineStore((state) => state.scrollPosition);
  const setPlayheadPosition = useTimelineStore((state) => state.setPlayheadPosition);
  const setSelectedClips = useTimelineStore((state) => state.setSelectedClips);
  const setScrollPosition = useTimelineStore((state) => state.setScrollPosition);
  const setZoomLevel = useTimelineStore((state) => state.setZoomLevel);
  const executeCommand = useTimelineStore((state) => state.executeCommand);
  const updateDoc = useTimelineStore((state) => state.updateDoc);

  // Store state - Old session (for library clips and playback)
  const libraryClips = useSessionStore((state) => state.clips);
  const timeline = useSessionStore((state) => state.timeline);
  const isPlaying = useSessionStore((state) => state.isPlaying);
  const setIsPlaying = useSessionStore((state) => state.setIsPlaying);
  const setPreviewSource = useSessionStore((state) => state.setPreviewSource);
  const previewSource = useSessionStore((state) => state.previewSource);
  const oldPlayheadPosition = useSessionStore((state) => state.playheadPosition);

  // Export state
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportStatus, setExportStatus] = useState<'validating' | 'exporting' | 'error' | 'complete'>('validating');
  const [exportProgress, setExportProgress] = useState({
    percentComplete: 0,
    estimatedTimeRemaining: 0,
    errorMessage: undefined as string | undefined,
  });
  const [exportOutputPath, setExportOutputPath] = useState<string | undefined>();
  const [isPresetSelectorOpen, setIsPresetSelectorOpen] = useState(false);
  const [presets, setPresets] = useState<ExportPreset[]>([]);
  const [defaultPresetId, setDefaultPresetId] = useState<string | null>(null);
  const [sourceResolution, setSourceResolution] = useState({ width: 1920, height: 1080 });
  const [selectedPreset, setSelectedPreset] = useState<ExportPreset | null>(null);
  const [isPresetManagerOpen, setIsPresetManagerOpen] = useState(false);

  // Hooks
  const { canUndo, canRedo, undoCount, redoCount } = useUndoRedo();
  const { snap, isSnappingDisabled } = useSnapping();

  // Calculate pixels per tick based on zoom
  const basePixelsPerSecond = 100; // 100px = 1 second at 100% zoom
  const pixelsPerSecond = (basePixelsPerSecond * zoomLevel) / 100;
  const pixelsPerTick = pixelsPerSecond / doc.timebase.ticksPerSecond;

  // Get total duration
  const getTotalDuration = () => {
    let maxEnd = 0;
    for (const track of doc.tracks) {
      for (const lane of track.lanes) {
        for (const clip of lane.clips) {
          const end = clip.start + clip.duration;
          if (end > maxEnd) maxEnd = end;
        }
      }
    }
    return maxEnd;
  };

  // Calculate total height needed based on tracks and lanes
  const getTotalHeight = () => {
    let totalHeight = 0;
    for (const track of doc.tracks) {
      const trackHeaderHeight = 40; // h-10
      const laneHeight = 64; // h-16 per lane
      totalHeight += trackHeaderHeight + track.lanes.length * laneHeight;
    }
    return totalHeight;
  };

  const totalDuration = getTotalDuration();
  const totalHeight = getTotalHeight();
  const totalWidth = totalDuration * pixelsPerTick;
  const playheadPosition = doc.selection?.playhead || 0;
  const playheadX = playheadPosition * pixelsPerTick;

  // Measure container width
  useEffect(() => {
    if (containerRef.current) {
      const resizeObserver = new ResizeObserver((entries) => {
        const width = entries[0].contentRect.width;
        setContainerWidth(width);
      });

      resizeObserver.observe(containerRef.current);

      return () => resizeObserver.disconnect();
    }
  }, []);

  // Handle keyboard shortcuts (Delete/Backspace, Spacebar for play/pause, S for split, Zoom)
  // Use refs for frequently changing values to avoid re-attaching listener on every render
  const isPlayingRef = useRef(isPlaying);
  const previewSourceRef = useRef(previewSource);
  const playheadPositionRef = useRef(playheadPosition);
  const selectedClipIdsRef = useRef(selectedClipIds);
  const docRef = useRef(doc);
  const zoomLevelRef = useRef(zoomLevel);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
    previewSourceRef.current = previewSource;
    playheadPositionRef.current = playheadPosition;
    selectedClipIdsRef.current = selectedClipIds;
    docRef.current = doc;
    zoomLevelRef.current = zoomLevel;
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const ctrlKey = isMac ? e.metaKey : e.ctrlKey;

      // Cmd/Ctrl + Plus/Equals: Zoom In
      if (ctrlKey && (e.key === '+' || e.key === '=')) {
        e.preventDefault();
        const newZoom = Math.min(1000, zoomLevelRef.current + 10);
        setZoomLevel(newZoom);
        console.log('[TimelineV2] Zoom in:', newZoom);
        return;
      }

      // Cmd/Ctrl + Minus: Zoom Out
      if (ctrlKey && e.key === '-') {
        e.preventDefault();
        const newZoom = Math.max(10, zoomLevelRef.current - 10);
        setZoomLevel(newZoom);
        console.log('[TimelineV2] Zoom out:', newZoom);
        return;
      }

      // Cmd/Ctrl + 0: Reset Zoom
      if (ctrlKey && e.key === '0') {
        e.preventDefault();
        setZoomLevel(100);
        console.log('[TimelineV2] Reset zoom: 100');
        return;
      }

      // Spacebar: Play/Pause
      if (e.code === 'Space') {
        e.preventDefault();

        // Set preview source to timeline
        setPreviewSource('timeline', { resetPlayhead: false });

        // Toggle play/pause
        if (previewSourceRef.current !== 'timeline') {
          setIsPlaying(true);
        } else {
          setIsPlaying(!isPlayingRef.current);
        }

        console.log('[TimelineV2] Playback:', !isPlayingRef.current ? 'Playing' : 'Paused');
        return;
      }

      // S key: Split clip at playhead
      if (e.key === 's' || e.key === 'S') {
        e.preventDefault();

        // Find clip at playhead position
        let clipToSplit: { clip: TimelineClip; trackId: string } | null = null;

        for (const track of docRef.current.tracks) {
          for (const lane of track.lanes) {
            for (const clip of lane.clips) {
              const clipEnd = clip.start + clip.duration;
              // Check if playhead is within clip bounds (not at edges)
              if (playheadPositionRef.current > clip.start && playheadPositionRef.current < clipEnd) {
                clipToSplit = { clip, trackId: track.id };
                break;
              }
            }
            if (clipToSplit) break;
          }
          if (clipToSplit) break;
        }

        if (clipToSplit) {
          executeCommand(
            new SplitCommand({
              clipId: clipToSplit.clip.id,
              atTime: playheadPositionRef.current,
            })
          );
          console.log('[TimelineV2] Split clip at playhead:', playheadPositionRef.current);
        } else {
          console.log('[TimelineV2] No clip at playhead to split');
        }
        return;
      }

      // Delete or Backspace key
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedClipIdsRef.current.length > 0) {
        e.preventDefault();

        // Delete selected clips
        selectedClipIdsRef.current.forEach((clipId) => {
          executeCommand(
            new DeleteCommand({
              clipId,
              mode: 'ripple',
            })
          );
        });

        // Clear selection after delete
        setSelectedClips([]);
        console.log('[TimelineV2] Deleted clips:', selectedClipIdsRef.current);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [executeCommand, setSelectedClips, setIsPlaying, setPreviewSource, setZoomLevel]); // Only stable functions

  // Sync playhead position from old session store to new timeline (during playback)
  useEffect(() => {
    if (isPlaying) {
      // Convert seconds to ticks
      const ticksFromOldStore = secondsToTicks(oldPlayheadPosition, doc.timebase.ticksPerSecond);

      // Only update if different (avoid infinite loops)
      if (Math.abs(ticksFromOldStore - playheadPosition) > 10) {
        setPlayheadPosition(ticksFromOldStore);
      }
    }
  }, [oldPlayheadPosition, isPlaying]);

  // Sync playhead position from new timeline to old session store (when clicking timeline)
  // ONLY sync when NOT playing to avoid render loops (during playback, PreviewPlayer controls the position)
  useEffect(() => {
    if (isPlaying) return; // Don't sync during playback - PreviewPlayer is in control

    const secondsFromNewStore = ticksToSeconds(playheadPosition, doc.timebase.ticksPerSecond);

    // Update old store if different (for preview player)
    const oldStoreSeconds = useSessionStore.getState().playheadPosition;
    if (Math.abs(secondsFromNewStore - oldStoreSeconds) > 0.01) {
      useSessionStore.setState({ playheadPosition: secondsFromNewStore });
    }
  }, [playheadPosition, doc.timebase.ticksPerSecond, isPlaying]);

  // Sync new timeline clips to old timeline format (for PreviewPlayer compatibility)
  // DEBOUNCED: Wait 100ms after last change to avoid triggering on every clip drop
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      // Convert new timeline structure to old timeline format
      const oldTimelineClips: any[] = [];

      // Find main track (the one PreviewPlayer plays)
      const mainTrack = doc.tracks.find((t) => t.role === 'main');
      if (!mainTrack || mainTrack.lanes.length === 0) {
        // Empty timeline
        useSessionStore.setState({
          timeline: { clips: [], duration: 0 },
        });
        return;
      }

      const mainLane = mainTrack.lanes[0];
      const ticksPerSecond = doc.timebase.ticksPerSecond;

      mainLane.clips.forEach((clip) => {
        // Convert to old format that PreviewPlayer expects
        oldTimelineClips.push({
          instanceId: clip.id, // Use clip ID as instance ID
          clipId: clip.sourceId, // sourceId maps to library clip ID
          startTime: ticksToSeconds(clip.start, ticksPerSecond),
          inPoint: ticksToSeconds(clip.srcStart, ticksPerSecond),
          outPoint: ticksToSeconds(clip.srcStart + clip.duration, ticksPerSecond),
        });
      });

      // Calculate total duration
      const totalDuration =
        oldTimelineClips.length > 0
          ? oldTimelineClips[oldTimelineClips.length - 1].outPoint -
            oldTimelineClips[oldTimelineClips.length - 1].inPoint +
            oldTimelineClips[oldTimelineClips.length - 1].startTime
          : 0;

      // Update old timeline format for PreviewPlayer
      useSessionStore.setState({
        timeline: {
          clips: oldTimelineClips,
          duration: totalDuration,
        },
      });

      console.log('✅ [TimelineV2] Synced', oldTimelineClips.length, 'clips to old format');
      console.log('📋 [TimelineV2] Clip details:', JSON.stringify(oldTimelineClips.map(c => ({
        instanceId: c.instanceId.substring(0, 8),
        clipId: c.clipId.substring(0, 8),
        startTime: Number(c.startTime.toFixed(2)),
        inPoint: Number(c.inPoint.toFixed(2)),
        outPoint: Number(c.outPoint.toFixed(2)),
        duration: Number((c.outPoint - c.inPoint).toFixed(2))
      })), null, 2));
      console.log('⏱️  [TimelineV2] Total duration:', totalDuration.toFixed(2), 'seconds');
    }, 100); // Debounce for 100ms

    return () => clearTimeout(timeoutId);
  }, [doc.tracks, doc.timebase.ticksPerSecond]);

  // Handle global mouse tracking during trim
  useEffect(() => {
    if (!trimState) return;

    const handleMouseMove = (e: MouseEvent) => {
      // Update cursor and live preview position during trim
      document.body.style.cursor = trimState.edge === 'left' ? 'w-resize' : 'e-resize';

      // Update trim state with current mouse position for live preview
      setTrimState((prev) => (prev ? { ...prev, currentX: e.clientX } : null));
    };

    const handleMouseUp = (e: MouseEvent) => {
      // Finish trim
      handleTrimEnd(trimState.clipId, e as any);
      document.body.style.cursor = '';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
    };
  }, [trimState]);

  // Handle global mouse tracking during drag
  useEffect(() => {
    if (!dragState) return;

    const DRAG_THRESHOLD = 5; // pixels - minimum distance before drag starts

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = Math.abs(e.clientX - dragState.startX);
      const hasMoved = deltaX > DRAG_THRESHOLD;

      // Update drag state with current mouse position for live preview
      setDragState((prev) => {
        if (!prev) return null;
        const newState = { ...prev, currentX: e.clientX, hasMoved };
        return newState;
      });

      // Only change cursor to grabbing if we've exceeded drag threshold
      if (hasMoved) {
        document.body.style.cursor = 'grabbing';
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      // Only finish drag if we actually moved beyond threshold
      if (dragState.hasMoved) {
        handleDragEnd(dragState.clipId, e as any);
      } else {
        // Just clear the drag state without moving anything
        setDragState(null);
      }
      document.body.style.cursor = '';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
    };
  }, [dragState]);

  // Ensure the preview surface is pointing at the timeline when interacting with it
  const ensureTimelinePreview = useCallback(() => {
    const currentPreviewSource = useSessionStore.getState().previewSource;
    if (currentPreviewSource !== 'timeline') {
      setPreviewSource('timeline', { resetPlayhead: false });
      setIsPlaying(false);
    }
  }, [setPreviewSource, setIsPlaying]);

  // Handle timeline click (set playhead)
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    ensureTimelinePreview();
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left + scrollPosition;
      const ticks = Math.round(x / pixelsPerTick);

      // Apply snapping
      const snapResult = snap(ticks);
      setPlayheadPosition(snapResult.snapTime);
    }
  };

  // Handle clip selection
  const handleClipSelect = (clipId: string) => {
    ensureTimelinePreview();
    setSelectedClips([clipId]);
  };

  // Clear drag/trim state when clicking buttons or non-timeline areas
  const handleNonTimelineClick = () => {
    setDragState(null);
    setTrimState(null);
  };

  // Handle drag over (allow drop from library)
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
  };

  // Handle drop (add library clip to timeline)
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    const clipId = e.dataTransfer.getData('clipId');
    if (!clipId) return;

    // Find the library clip
    const libraryClip = libraryClips.find((c) => c.id === clipId);
    if (!libraryClip) {
      console.error('[TimelineV2] Library clip not found:', clipId);
      return;
    }

    // Determine which track the drop occurred on
    let targetTrackId = 'main-video'; // default to main track

    if (containerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const dropY = e.clientY - containerRect.top + containerRef.current.scrollTop;

      // Find which track contains this Y position
      let accumulatedHeight = 0;
      for (const track of doc.tracks) {
        const trackHeaderHeight = 40; // h-10 = 40px
        const laneHeight = 64; // h-16 = 64px per lane
        const trackTotalHeight = trackHeaderHeight + track.lanes.length * laneHeight;

        if (dropY >= accumulatedHeight && dropY < accumulatedHeight + trackTotalHeight) {
          targetTrackId = track.id;
          console.log('[TimelineV2] Drop on track:', track.id, 'at Y:', dropY);
          break;
        }

        accumulatedHeight += trackTotalHeight;
      }
    }

    // Convert library clip to timeline clip
    const ticksPerSecond = doc.timebase.ticksPerSecond;
    const clipDuration = libraryClip.outPoint - libraryClip.inPoint; // in seconds

    const newClip: TimelineClip = {
      id: uuidv4(), // New instance ID
      sourceId: libraryClip.id, // Reference to library clip
      srcStart: secondsToTicks(libraryClip.inPoint, ticksPerSecond),
      duration: secondsToTicks(clipDuration, ticksPerSecond),
      start: 0, // Will be calculated by InsertCommand
    };

    // Insert at end of target track using InsertCommand
    executeCommand(
      new InsertCommand({
        trackId: targetTrackId,
        clip: newClip,
        mode: 'ripple',
      })
    );

    console.log('[TimelineV2] Added clip to timeline:', libraryClip.filename, 'on track:', targetTrackId);
  };

  // Find clip by ID
  const findClip = (clipId: string): TimelineClip | null => {
    for (const track of doc.tracks) {
      for (const lane of track.lanes) {
        const clip = lane.clips.find((c) => c.id === clipId);
        if (clip) return clip;
      }
    }
    return null;
  };

  // Handle trim start (when user clicks on edge)
  const handleTrimStart = (clipId: string, edge: 'left' | 'right', e?: React.MouseEvent) => {
    const clip = findClip(clipId);
    if (!clip) return;

    setTrimState({
      clipId,
      edge,
      startX: e?.clientX || 0,
      originalClip: { ...clip },
    });

    console.log('Trim start:', clipId, edge);
  };

  // Handle trim end (when user releases mouse)
  const handleTrimEnd = (clipId: string, e?: React.MouseEvent) => {
    if (!trimState) return;

    const clip = findClip(clipId);
    if (!clip) {
      setTrimState(null);
      return;
    }

    const deltaX = (e?.clientX || 0) - trimState.startX;
    const deltaTicks = Math.round(deltaX / pixelsPerTick);

    if (deltaTicks === 0) {
      setTrimState(null);
      return;
    }

    // Calculate new trim values
    if (trimState.edge === 'left') {
      // Trim left edge (adjust srcStart and duration)
      const newSrcStart = Math.max(0, clip.srcStart + deltaTicks);
      const srcDelta = newSrcStart - clip.srcStart;
      const newDuration = Math.max(1000, clip.duration - srcDelta); // Min 1 second

      executeCommand(
        new TrimCommand({
          clipId,
          newSrcStart,
          newDuration,
          mode: 'ripple',
        })
      );
    } else if (trimState.edge === 'right') {
      // Trim right edge (adjust duration only)
      const newDuration = Math.max(1000, clip.duration + deltaTicks); // Min 1 second

      executeCommand(
        new TrimCommand({
          clipId,
          newDuration,
          mode: 'ripple',
        })
      );
    }

    setTrimState(null);
    console.log('Trim end:', clipId, deltaTicks);
  };

  const handleDragStart = (clipId: string, e?: React.MouseEvent) => {
    // Don't start drag if trimming is active
    if (trimState) return;

    const clip = findClip(clipId);
    if (!clip) return;

    setDragState({
      clipId,
      startX: e?.clientX || 0,
      originalClip: { ...clip },
    });

    console.log('Drag start:', clipId);
  };

  const handleDragEnd = (clipId: string, e?: React.MouseEvent) => {
    if (!dragState) return;

    const clip = findClip(clipId);
    if (!clip) {
      setDragState(null);
      return;
    }

    // Calculate movement - use currentX if available (from mouse tracking), otherwise fall back to event clientX
    const endX = dragState.currentX !== undefined ? dragState.currentX : e?.clientX;
    if (endX === undefined) {
      setDragState(null);
      return;
    }

    const deltaX = endX - dragState.startX;
    const deltaTicks = Math.round(deltaX / pixelsPerTick);

    // If no meaningful movement (less than 50 ticks = ~0.05 seconds), just clear state
    if (Math.abs(deltaTicks) < 50) {
      setDragState(null);
      return;
    }

    // Calculate new start time
    const newStartTicks = Math.max(0, clip.start + deltaTicks);

    // Apply snapping
    const snapResult = snap(newStartTicks);

    // Find the track and check if it's a main track
    let currentTrackId = '';
    let isMainTrack = false;

    for (const track of doc.tracks) {
      for (const lane of track.lanes) {
        if (lane.clips.some((c) => c.id === clipId)) {
          currentTrackId = track.id;
          isMainTrack = track.role === 'main';
          break;
        }
      }
      if (currentTrackId) break;
    }

    // For main tracks, we need to find the new index based on time
    // For overlay tracks, we can directly set the time
    if (isMainTrack) {
      // Find the lane with this clip
      const track = doc.tracks.find((t) => t.id === currentTrackId);
      if (!track || track.lanes.length === 0) {
        setDragState(null);
        return;
      }

      const lane = track.lanes[0];
      const currentIndex = lane.clips.findIndex((c) => c.id === clipId);

      // Calculate which index the clip should move to based on new start time
      let targetIndex = 0;
      for (let i = 0; i < lane.clips.length; i++) {
        if (i === currentIndex) continue; // Skip the clip being moved
        if (lane.clips[i].start < snapResult.snapTime) {
          targetIndex = i + 1;
        }
      }

      // Verify index changed before executing move
      if (targetIndex !== currentIndex) {
        executeCommand(
          new MoveCommand({
            clipId,
            toIndex: targetIndex,
            mode: 'ripple',
          })
        );
      }
    } else {
      // Overlay track - directly set the time
      executeCommand(
        new MoveCommand({
          clipId,
          toTime: snapResult.snapTime,
          mode: 'ripple',
        })
      );
    }

    setDragState(null);
    console.log('Drag end:', clipId, 'new position:', snapResult.snapTime);
  };

  // Add overlay track
  const addOverlayTrack = () => {
    // Count existing overlay tracks for naming
    const overlayCount = doc.tracks.filter((t) => t.role === 'overlay').length;
    const trackNumber = overlayCount + 1;
    const trackId = `overlay-video-${uuidv4()}`;

    // Create new overlay track
    const newTrack: Track = {
      id: trackId,
      type: 'video',
      role: 'overlay',
      lanes: [{ id: `${trackId}-lane-0`, clips: [] }],
      policy: TRACK_POLICY_PRESETS.overlay,
      name: `Overlay ${trackNumber}`,
      color: '#8B5CF6', // purple
    };

    // Add track to timeline
    updateDoc((currentDoc) => ({
      ...currentDoc,
      tracks: [...currentDoc.tracks, newTrack],
    }));

    console.log('[TimelineV2] Added overlay track:', newTrack.name);
  };

  // Load presets on mount
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
        console.error('[TimelineV2] Failed to load presets:', error);
      }
    };
    loadPresets();
  }, []);

  // Handle Export button click
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

    // Determine source resolution
    const maxResolution = timeline.clips.reduce(
      (max, tc) => {
        const clip = libraryClips.find((c) => c.id === tc.clipId);
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

    // Show preset selector
    setIsPresetSelectorOpen(true);
  };

  // Handle preset selection
  const handlePresetSelected = async (preset: ExportPreset) => {
    setSelectedPreset(preset);
    setIsPresetSelectorOpen(false);

    // Open the save dialog with preset-specific filename
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0].replace('T', '_');
    const defaultFilename = `Klippy_Export_${preset.name}_${timestamp}.mp4`;

    try {
      const result = await window.electron.invoke('dialog:showSaveDialog', {
        defaultPath: defaultFilename,
        filters: [{ name: 'MP4 Video', extensions: ['mp4'] }],
      });

      if (result.canceled || !result.filePath) {
        return;
      }

      const outputPath = result.filePath;
      setExportOutputPath(outputPath);
      setIsExportModalOpen(true);
      setExportStatus('validating');

      // Convert overlay tracks to export format
      const overlayTracks = doc.tracks
        .filter((t) => t.type === 'video' && t.role === 'overlay')
        .map((track) => {
          const ticksPerSecond = doc.timebase.ticksPerSecond;
          const overlayClips: Array<{
            clipId: string;
            inPoint: number;
            outPoint: number;
            startTime: number;
          }> = [];

          for (const lane of track.lanes) {
            for (const clip of lane.clips) {
              const libraryClip = libraryClips.find((lc) => lc.id === clip.sourceId);
              if (libraryClip) {
                overlayClips.push({
                  clipId: clip.sourceId,
                  inPoint: ticksToSeconds(clip.srcStart, ticksPerSecond),
                  outPoint: ticksToSeconds(clip.srcStart + clip.duration, ticksPerSecond),
                  startTime: ticksToSeconds(clip.start, ticksPerSecond),
                });
              }
            }
          }

          return { clips: overlayClips };
        });

      // Start export
      try {
        await window.electron.invoke('export-video', {
          outputPath,
          timeline: {
            clips: timeline.clips,
            totalDuration: timeline.duration,
          },
          libraryClips,
          preset,
          overlayTracks: overlayTracks.length > 0 ? overlayTracks : undefined,
        });

        setExportStatus('exporting');
      } catch (error: any) {
        setExportProgress({
          percentComplete: 0,
          estimatedTimeRemaining: 0,
          errorMessage: error.message || 'Export failed',
        });
        setExportStatus('error');
      }
    } catch (error: any) {
      console.error('[TimelineV2] Export dialog error:', error);
    }
  };

  // Handle export cancel
  const handleExportCancel = () => {
    if (exportStatus === 'exporting') {
      window.electron.invoke('export-cancel');
    }
    setIsExportModalOpen(false);
    setExportStatus('validating');
    setExportProgress({
      percentComplete: 0,
      estimatedTimeRemaining: 0,
      errorMessage: undefined,
    });
    setExportOutputPath(undefined);
  };

  // Listen for export progress updates
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

    const cleanupProgress = window.electron.export.onProgress(handleExportProgress);
    const cleanupCancelled = window.electron.export.onCancelled(handleExportCancelled);

    return () => {
      cleanupProgress();
      cleanupCancelled();
    };
  }, []);

  // Handle preset management
  const handleManagePresetsClick = () => {
    setIsPresetManagerOpen(true);
  };

  const handlePresetSave = async (preset: ExportPreset) => {
    try {
      const result = await window.electron.invoke('export-save-custom-preset', {
        preset,
      });
      if (result.success) {
        // Refresh presets
        const refreshResult = await window.electron.invoke('export-get-presets');
        if (refreshResult.presets) {
          setPresets(refreshResult.presets);
          if (refreshResult.defaultPresetId) {
            setDefaultPresetId(refreshResult.defaultPresetId);
          }
        }
      }
      return result;
    } catch (error) {
      console.error('[TimelineV2] Failed to save preset:', error);
      return { success: false, error: 'Failed to save preset' };
    }
  };

  const handlePresetDelete = async (presetId: string) => {
    try {
      const result = await window.electron.invoke('export-delete-custom-preset', {
        presetId,
      });
      if (result.success) {
        // Refresh presets
        const refreshResult = await window.electron.invoke('export-get-presets');
        if (refreshResult.presets) {
          setPresets(refreshResult.presets);
          if (refreshResult.defaultPresetId) {
            setDefaultPresetId(refreshResult.defaultPresetId);
          }
        }
      }
      return result;
    } catch (error) {
      console.error('[TimelineV2] Failed to delete preset:', error);
      return { success: false, error: 'Failed to delete preset' };
    }
  };

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
      console.error('[TimelineV2] Failed to refresh presets:', error);
    }
  };

  const handleSetDefaultPreset = async (presetId: string | null) => {
    try {
      const result = await window.electron.invoke('export-set-default-preset', {
        presetId,
      });
      if (result.success) {
        setDefaultPresetId(presetId);
      }
    } catch (error) {
      console.error('[TimelineV2] Failed to set default preset:', error);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-gray-900">
      {/* Top Controls */}
      <div className="flex items-center gap-3 h-12 px-4 bg-gray-800 border-b border-gray-700" onClick={handleNonTimelineClick}>
        {/* Title */}
        <div className="text-xs text-gray-400 font-medium mr-2">Timeline</div>

        {/* Divider */}
        <div className="w-px h-5 bg-gray-700" />

        {/* Primary: Play/Pause */}
        <button
          onClick={() => {
            if (previewSource !== 'timeline') {
              setPreviewSource('timeline', { resetPlayhead: false });
              setIsPlaying(true);
              return;
            }

            setIsPlaying(!isPlaying);
          }}
          className="px-3 py-1.5 rounded-md text-sm font-medium bg-green-600 hover:bg-green-700 text-white transition-colors"
          title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
        >
          {isPlaying ? '⏸ Pause' : '▶ Play'}
        </button>

        {/* Divider */}
        <div className="w-px h-5 bg-gray-700" />

        {/* History: Undo/Redo */}
        <div className="flex items-center gap-1">
          <button
            disabled={!canUndo}
            className={`px-2.5 py-1.5 rounded-md text-sm ${
              canUndo
                ? 'bg-gray-700 hover:bg-gray-600 text-white'
                : 'bg-gray-800 text-gray-500 cursor-not-allowed'
            } transition-colors`}
            title={`Undo (${undoCount} available)`}
          >
            ↶ Undo
          </button>
          <button
            disabled={!canRedo}
            className={`px-2.5 py-1.5 rounded-md text-sm ${
              canRedo
                ? 'bg-gray-700 hover:bg-gray-600 text-white'
                : 'bg-gray-800 text-gray-500 cursor-not-allowed'
            } transition-colors`}
            title={`Redo (${redoCount} available)`}
          >
            ↷ Redo
          </button>
        </div>

        {/* Divider */}
        <div className="w-px h-5 bg-gray-700" />

        {/* Editing: Split, Delete */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              // Find clip at playhead position
              let clipToSplit: { clip: TimelineClip; trackId: string } | null = null;

              for (const track of doc.tracks) {
                for (const lane of track.lanes) {
                  for (const clip of lane.clips) {
                    const clipEnd = clip.start + clip.duration;
                    if (playheadPosition > clip.start && playheadPosition < clipEnd) {
                      clipToSplit = { clip, trackId: track.id };
                      break;
                    }
                  }
                  if (clipToSplit) break;
                }
                if (clipToSplit) break;
              }

              if (clipToSplit) {
                executeCommand(
                  new SplitCommand({
                    clipId: clipToSplit.clip.id,
                    atTime: playheadPosition,
                  })
                );
              }
            }}
            className="px-2.5 py-1.5 rounded-md text-sm bg-gray-700 hover:bg-gray-600 text-white transition-colors"
            title="Split clip at playhead (S key)"
          >
            ✂ Split
          </button>
          <button
            disabled={selectedClipIds.length === 0}
            onClick={() => {
              selectedClipIds.forEach((clipId) => {
                executeCommand(new DeleteCommand({ clipId, mode: 'ripple' }));
              });
              setSelectedClips([]);
            }}
            className={`px-2.5 py-1.5 rounded-md text-sm transition-colors ${
              selectedClipIds.length > 0
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-gray-800 text-gray-500 cursor-not-allowed'
            }`}
            title="Delete selected clips (Delete/Backspace)"
          >
            ⌫ Delete
          </button>
        </div>

        {/* Divider */}
        <div className="w-px h-5 bg-gray-700" />

        {/* Timeline: Add Overlay Track */}
        <button
          onClick={addOverlayTrack}
          className="px-2.5 py-1.5 rounded-md text-sm bg-purple-600 hover:bg-purple-700 text-white transition-colors whitespace-nowrap"
          title="Add overlay track"
        >
          + Overlay
        </button>

        {/* Divider */}
        <div className="w-px h-5 bg-gray-700" />

        {/* Export Button */}
        <button
          onClick={handleExportClick}
          className="px-3 py-1.5 rounded-md text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors"
          title="Export timeline to MP4"
        >
          Export
        </button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* View: Snapping Indicator */}
        <div className="flex items-center gap-1.5 mr-3">
          <div
            className={`w-2 h-2 rounded-full ${
              isSnappingDisabled ? 'bg-gray-600' : 'bg-green-500'
            }`}
          />
          <span className="text-xs text-gray-400">
            {isSnappingDisabled ? 'Snap OFF' : 'Snap ON'}
          </span>
        </div>

        {/* Divider */}
        <div className="w-px h-5 bg-gray-700" />

        {/* Zoom Controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setZoomLevel(Math.max(10, zoomLevel - 10))}
            className="w-7 h-7 flex items-center justify-center rounded-md bg-gray-700 hover:bg-gray-600 text-white transition-colors"
            title="Zoom Out (Cmd/Ctrl + -)"
          >
            −
          </button>

          <span className="text-xs text-gray-300 min-w-[45px] text-center font-mono">
            {zoomLevel}%
          </span>

          <button
            onClick={() => setZoomLevel(Math.min(1000, zoomLevel + 10))}
            className="w-7 h-7 flex items-center justify-center rounded-md bg-gray-700 hover:bg-gray-600 text-white transition-colors"
            title="Zoom In (Cmd/Ctrl + +)"
          >
            +
          </button>

          <button
            onClick={() => setZoomLevel(100)}
            className="px-2 py-1 rounded-md text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
            title="Reset Zoom (Cmd/Ctrl + 0)"
          >
            Reset
          </button>

          <button
            onClick={() => {
              // Calculate zoom to fit entire timeline in view
              if (totalDuration === 0 || containerWidth === 0) return;

              const totalWidthAtCurrentZoom = totalDuration * pixelsPerTick;
              const targetZoom = Math.floor((containerWidth / totalWidthAtCurrentZoom) * zoomLevel);
              const clampedZoom = Math.max(10, Math.min(1000, targetZoom));

              setZoomLevel(clampedZoom);
              console.log('[TimelineV2] Zoom to fit:', clampedZoom);
            }}
            className="px-2 py-1 rounded-md text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
            title="Zoom to fit entire timeline"
          >
            Fit
          </button>
        </div>

        {/* Track Count */}
        <div className="text-xs text-gray-500 ml-3 font-medium">
          {doc.tracks.length} {doc.tracks.length === 1 ? 'Track' : 'Tracks'}
        </div>
      </div>

      {/* Ruler */}
      <div className="h-8 bg-gray-800 border-b border-gray-700 overflow-hidden relative">
        <div
          className="absolute top-0 left-0 h-full flex items-end"
          style={{ transform: `translateX(-${scrollPosition}px)` }}
        >
          {Array.from({ length: Math.ceil(totalWidth / pixelsPerSecond) + 1 }).map((_, i) => {
            const seconds = i;
            const x = seconds * pixelsPerSecond;

            return (
              <div
                key={i}
                className="absolute flex flex-col items-center"
                style={{ left: `${x}px` }}
              >
                <div className="h-2 w-px bg-gray-600" />
                <span className="text-xs text-gray-400 mt-1">{seconds}s</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Timeline Content */}
      <div
        ref={containerRef}
        className={`flex-1 min-h-0 min-w-0 overflow-auto overflow-y-scroll relative ${
          isDraggingOver ? 'bg-blue-900 bg-opacity-20' : ''
        }`}
        onClick={handleTimelineClick}
        onScroll={(e) => setScrollPosition(e.currentTarget.scrollLeft)}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Timeline Canvas - allows both horizontal and vertical overflow */}
        <div
          className="relative"
          style={{
            width: `${Math.max(totalWidth, containerWidth)}px`,
            height: `${totalHeight}px` // Grow based on content (tracks + lanes)
          }}
        >
          {/* Playhead */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20 pointer-events-none"
            style={{ left: `${playheadX}px` }}
          >
            <div className="absolute -top-2 -left-2 w-4 h-4 bg-red-500 rounded-full" />
          </div>

          {/* Tracks - grow naturally based on content */}
          <div className="relative w-full">
            {doc.tracks.map((track) => (
              <TrackV2
                key={track.id}
                track={track}
                pixelsPerTick={pixelsPerTick}
                selectedClipIds={selectedClipIds}
                onClipSelect={handleClipSelect}
                onTrimStart={handleTrimStart}
                onTrimEnd={handleTrimEnd}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                trimPreview={
                  trimState
                    ? {
                        clipId: trimState.clipId,
                        edge: trimState.edge,
                        deltaTicks: trimState.currentX
                          ? Math.round((trimState.currentX - trimState.startX) / pixelsPerTick)
                          : 0,
                      }
                    : undefined
                }
                dragPreview={
                  dragState && dragState.hasMoved
                    ? {
                        clipId: dragState.clipId,
                        deltaTicks: dragState.currentX
                          ? Math.round((dragState.currentX - dragState.startX) / pixelsPerTick)
                          : 0,
                      }
                    : undefined
                }
              />
            ))}
          </div>

          {/* Empty State */}
          {doc.tracks.every((t) => t.lanes.every((l) => l.clips.length === 0)) && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-gray-500">
                <p className="text-lg font-medium">Empty Timeline</p>
                <p className="text-sm">Add clips to get started</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Status Bar */}
      <div className="h-8 px-4 bg-gray-800 border-t border-gray-700 flex items-center justify-between text-xs text-gray-400">
        <div>
          Playhead: {ticksToSeconds(playheadPosition, doc.timebase.ticksPerSecond).toFixed(3)}s
        </div>
        <div>
          Total Duration: {ticksToSeconds(totalDuration, doc.timebase.ticksPerSecond).toFixed(2)}s
        </div>
        <div>
          Selected: {selectedClipIds.length} clip{selectedClipIds.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Export Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onCancel={handleExportCancel}
        progress={exportProgress}
        status={exportStatus}
        outputPath={exportOutputPath}
      />

      {/* Preset Selector Modal */}
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

      {/* Preset Manager Modal */}
      <PresetManager
        isOpen={isPresetManagerOpen}
        presets={presets}
        onClose={() => setIsPresetManagerOpen(false)}
        onSave={handlePresetSave}
        onDelete={handlePresetDelete}
        onRefresh={handleRefreshPresets}
      />
    </div>
  );
}
