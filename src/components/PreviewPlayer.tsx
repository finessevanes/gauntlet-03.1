/**
 * PreviewPlayer Component
 * Coordinates video playback for timeline sequences and library clips.
 * Handles loading, scrubbing, and transitions between clips.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSessionStore } from '../store/sessionStore';
import { Clip } from '../types/session';
import { VideoCanvas } from './VideoCanvas';
import { PlaybackControls } from './PlaybackControls';
import { normalizeFilePath, toFileUrl } from '../utils/fileUrl';

interface TimelineSegment {
  instanceId: string;
  clip: Clip;
  start: number;
  end: number;
}

const getEffectiveDuration = (clip: Clip): number => {
  const duration = clip.outPoint - clip.inPoint;
  if (Number.isFinite(duration) && duration > 0) {
    return duration;
  }
  return Math.max(clip.duration, 0);
};

export const PreviewPlayer: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const activeSourceRef = useRef<'timeline' | 'library' | null>(null);
  const activeClipRef = useRef<string | null>(null);
  const activeFileUrlRef = useRef<string | null>(null);
  const pendingSeekRef = useRef<number | null>(null);
  const timelineSegmentsRef = useRef<TimelineSegment[]>([]);
  const isPlayingRef = useRef<boolean>(false);
  const lastLibraryClipIdRef = useRef<string | null>(null);

  const clips = useSessionStore((state) => state.clips);
  const timeline = useSessionStore((state) => state.timeline);
  const playheadPosition = useSessionStore((state) => state.playheadPosition);
  const isPlaying = useSessionStore((state) => state.isPlaying);
  const previewSource = useSessionStore((state) => state.previewSource);
  const previewClipId = useSessionStore((state) => state.previewClipId);
  const setPlayheadPosition = useSessionStore((state) => state.setPlayheadPosition);
  const setIsPlaying = useSessionStore((state) => state.setIsPlaying);
  const setPreviewSource = useSessionStore((state) => state.setPreviewSource);

  const [currentClipIndex, setCurrentClipIndex] = useState(0);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [isBuffering, setIsBuffering] = useState(false);
  const [libraryCurrentTime, setLibraryCurrentTime] = useState(0);
  const [libraryDuration, setLibraryDuration] = useState(0);

  const timelineSegments = useMemo(() => {
    let cursor = 0;
    const segments: TimelineSegment[] = [];

    for (const timelineClip of timeline.clips) {
      const clip = clips.find((c) => c.id === timelineClip.clipId);
      if (!clip) continue;

      // Use timeline clip's trim points (inPoint/outPoint) for duration, not the library clip's
      const effectiveDuration = timelineClip.outPoint - timelineClip.inPoint;
      if (effectiveDuration <= 0) continue;

      segments.push({
        instanceId: timelineClip.instanceId,
        clip,
        start: cursor,
        end: cursor + effectiveDuration,
      });

      cursor += effectiveDuration;
    }

    return segments;
  }, [timeline.clips, clips]);

  timelineSegmentsRef.current = timelineSegments;
  isPlayingRef.current = isPlaying;

  // Keep clip index in range when timeline changes
  useEffect(() => {
    if (currentClipIndex >= timelineSegments.length) {
      setCurrentClipIndex(timelineSegments.length === 0 ? 0 : timelineSegments.length - 1);
    }
  }, [timelineSegments.length, currentClipIndex]);

  // Switch back to timeline if selected library clip is removed
  useEffect(() => {
    if (previewSource === 'library' && previewClipId) {
      const clipExists = clips.some((clip) => clip.id === previewClipId);
      if (!clipExists) {
        setPreviewSource('timeline');
      }
    }
  }, [clips, previewClipId, previewSource, setPreviewSource]);

  const activeTimelineSegment = previewSource === 'timeline' ? timelineSegments[currentClipIndex] : undefined;
  const activeLibraryClip = previewSource === 'library' && previewClipId
    ? clips.find((clip) => clip.id === previewClipId)
    : undefined;

  const hasTimelineContent = timelineSegments.length > 0;
  const hasLibraryContent = Boolean(activeLibraryClip);

  const controlsDuration = previewSource === 'timeline'
    ? timeline.duration
    : libraryDuration;
  const controlsCurrentTime = previewSource === 'timeline'
    ? playheadPosition
    : libraryCurrentTime;

  useEffect(() => {
    if (previewSource === 'library') {
      setLibraryCurrentTime(0);
    } else {
      lastLibraryClipIdRef.current = null;
    }
  }, [previewSource, previewClipId]);

  const unloadVideo = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    video.pause();
    video.removeAttribute('src');
    video.load();

    pendingSeekRef.current = null;
    activeClipRef.current = null;
    activeSourceRef.current = null;
    activeFileUrlRef.current = null;
  }, []);

  const loadClip = useCallback((
    clip: Clip,
    options: {
      source: 'timeline' | 'library';
      segmentIndex?: number;
      segmentStart?: number;
      targetTime: number;
    },
  ) => {
    const video = videoRef.current;
    if (!video) return;

    const resolvedPath = normalizeFilePath(clip.filePath);

    if (resolvedPath !== clip.filePath) {
      useSessionStore.setState((state) => ({
        clips: state.clips.map((existingClip) => (
          existingClip.id === clip.id
            ? { ...existingClip, filePath: resolvedPath }
            : existingClip
        )),
      }));
    }

    const fileUrl = toFileUrl(resolvedPath);

    const sameClipLoaded =
      activeClipRef.current === clip.id &&
      activeSourceRef.current === options.source &&
      activeFileUrlRef.current === fileUrl;

    if (sameClipLoaded) {
      // Only seek if necessary
      if (Math.abs(video.currentTime - options.targetTime) > 0.05) {
        pendingSeekRef.current = options.targetTime;
        try {
          video.currentTime = options.targetTime;
        } catch (err) {
          console.warn('[PreviewPlayer] Failed to set currentTime on existing clip:', err);
        }
      }
      return;
    }

    activeClipRef.current = clip.id;
    activeSourceRef.current = options.source;
    activeFileUrlRef.current = fileUrl;
    pendingSeekRef.current = options.targetTime;

    // Pause and prepare to load new source
    video.pause();
    setIsBuffering(true);
    setVideoError(null);

    // Force reload by clearing src first to avoid Chromium caching issues
    video.removeAttribute('src');
    video.load();
    video.src = fileUrl;
    video.load();

    // Store segment details in dataset for event handlers (avoids stale closures)
    if (typeof options.segmentIndex === 'number') {
      video.dataset.segmentIndex = String(options.segmentIndex);
    } else {
      delete video.dataset.segmentIndex;
    }

    if (typeof options.segmentStart === 'number') {
      video.dataset.segmentStart = String(options.segmentStart);
    } else {
      delete video.dataset.segmentStart;
    }
  }, []);

  const syncTimelineClipFromPlayhead = useCallback(() => {
    if (previewSource !== 'timeline') return;

    if (!activeTimelineSegment) {
      if (hasTimelineContent) {
        // Ensure we pick the correct segment from playhead
        const index = timelineSegments.findIndex((segment) => (
          playheadPosition >= segment.start && playheadPosition < segment.end
        ));
        if (index !== -1 && index !== currentClipIndex) {
          setCurrentClipIndex(index);
        }
      }
      return;
    }

    const offsetWithinSegment = Math.min(
      Math.max(playheadPosition - activeTimelineSegment.start, 0),
      activeTimelineSegment.end - activeTimelineSegment.start,
    );
    const targetVideoTime = activeTimelineSegment.clip.inPoint + offsetWithinSegment;

    loadClip(activeTimelineSegment.clip, {
      source: 'timeline',
      segmentIndex: currentClipIndex,
      segmentStart: activeTimelineSegment.start,
      targetTime: targetVideoTime,
    });
  }, [
    activeTimelineSegment,
    currentClipIndex,
    hasTimelineContent,
    loadClip,
    playheadPosition,
    previewSource,
    timelineSegments,
  ]);

  const syncLibraryClip = useCallback(() => {
    if (previewSource !== 'library') return;

    if (!activeLibraryClip) {
      unloadVideo();
      setLibraryCurrentTime(0);
      setLibraryDuration(0);
      setIsBuffering(false);
      setVideoError(null);
      lastLibraryClipIdRef.current = null;
      return;
    }

    const effectiveDuration = getEffectiveDuration(activeLibraryClip);
    setLibraryDuration(effectiveDuration);

    const isNewClipSelection = lastLibraryClipIdRef.current !== activeLibraryClip.id;
    let currentTimeForLoad = Math.min(Math.max(libraryCurrentTime, 0), effectiveDuration);

    if (isNewClipSelection) {
      currentTimeForLoad = 0;
      setLibraryCurrentTime(0);
      pendingSeekRef.current = activeLibraryClip.inPoint;
      if (import.meta.env?.MODE !== 'production') {
        console.log('[PreviewPlayer] New library clip selected; resetting playback time', {
          clipId: activeLibraryClip.id,
        });
      }
    }

    const targetVideoTime = activeLibraryClip.inPoint + currentTimeForLoad;

    if (import.meta.env?.MODE !== 'production') {
      console.log('[PreviewPlayer] Loading library clip', {
        clipId: activeLibraryClip.id,
        resolvedPath: activeLibraryClip.filePath,
        currentLibraryTime: currentTimeForLoad,
        targetVideoTime,
      });
    }

    loadClip(activeLibraryClip, {
      source: 'library',
      targetTime: targetVideoTime,
    });

    lastLibraryClipIdRef.current = activeLibraryClip.id;
  }, [activeLibraryClip, libraryCurrentTime, loadClip, previewSource, unloadVideo]);

  // Sync clip selection from store state
  useEffect(() => {
    if (previewSource === 'timeline') {
      syncTimelineClipFromPlayhead();
    } else {
      syncLibraryClip();
    }
  }, [previewSource, syncTimelineClipFromPlayhead, syncLibraryClip]);

  useEffect(() => {
    if (previewSource === 'timeline' && !hasTimelineContent) {
      unloadVideo();
      setIsBuffering(false);
      setVideoError(null);
    }
  }, [hasTimelineContent, previewSource, unloadVideo]);

  // Update clip index when playhead moves (e.g., user clicks timeline)
  useEffect(() => {
    if (previewSource !== 'timeline') return;
    if (!hasTimelineContent) return;

    const index = timelineSegments.findIndex((segment) => (
      playheadPosition >= segment.start && playheadPosition < segment.end
    ));

    if (index !== -1 && index !== currentClipIndex) {
      setCurrentClipIndex(index);
    } else if (index === -1 && playheadPosition >= timeline.duration) {
      setCurrentClipIndex(timelineSegments.length - 1);
    }
  }, [
    currentClipIndex,
    hasTimelineContent,
    playheadPosition,
    previewSource,
    timeline.duration,
    timelineSegments,
  ]);

  const handlePlayPromiseRejection = useCallback((error: unknown, context: string) => {
    const domError = error as DOMException | undefined;
    const isAbort = domError?.name === 'AbortError' || (domError as { code?: number } | undefined)?.code === 20;

    if (isAbort) {
      return;
    }

    console.error(`[PreviewPlayer] Unable to start playback (${context}):`, error);
    setIsPlaying(false);
    setVideoError('Unable to start playback');
  }, [setIsPlaying, setVideoError]);

  // Respond to play/pause changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      if (previewSource === 'timeline' && !hasTimelineContent) {
        setIsPlaying(false);
        return;
      }
      if (previewSource === 'library' && !hasLibraryContent) {
        setIsPlaying(false);
        return;
      }
      const play = video.play();
      if (play && typeof play.catch === 'function') {
        play.catch((err) => handlePlayPromiseRejection(err, 'effect'));
      }
    } else {
      video.pause();
    }
  }, [handlePlayPromiseRejection, hasLibraryContent, hasTimelineContent, isPlaying, previewSource, setIsPlaying]);

  // Attach media event listeners once
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      const clipId = activeClipRef.current;
      if (!clipId) return;

      const clip = clips.find((c) => c.id === clipId);
      if (!clip) return;

      const targetTime = pendingSeekRef.current ?? clip.inPoint;
      try {
        video.currentTime = targetTime;
      } catch (err) {
        console.warn('[PreviewPlayer] Failed to seek on metadata:', err);
      }
      pendingSeekRef.current = null;

      if (activeSourceRef.current === 'library') {
        const effective = getEffectiveDuration(clip);
        setLibraryDuration(effective);
        const startOffset = Math.min(Math.max(targetTime - clip.inPoint, 0), effective);
        setLibraryCurrentTime(startOffset);
      } else if (activeSourceRef.current === 'timeline') {
        const segmentStart = Number(video.dataset.segmentStart) || 0;
        const relative = targetTime - clip.inPoint;
        const timelineTime = segmentStart + relative;
        if (Math.abs(timelineTime - playheadPosition) > 0.05) {
          setPlayheadPosition(Math.max(0, timelineTime));
        }
      }
    };

    const handleCanPlay = () => {
      setIsBuffering(false);
      if (isPlayingRef.current) {
        const playPromise = video.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch((err) => handlePlayPromiseRejection(err, 'canplay'));
        }
      }
    };

    const handleWaiting = () => {
      setIsBuffering(true);
    };

    const handleError = () => {
      const mediaError = video.error;
      const message = mediaError ? mediaError.message : 'Cannot play source file';
      setVideoError(message);
      setIsPlaying(false);
      setIsBuffering(false);
    };

    const handleTimeUpdate = () => {
      const clipId = activeClipRef.current;
      if (!clipId) return;
      const clip = clips.find((c) => c.id === clipId);
      if (!clip) return;

      const videoTime = video.currentTime;

      if (activeSourceRef.current === 'library') {
        const effective = getEffectiveDuration(clip);
        const relative = Math.min(Math.max(videoTime - clip.inPoint, 0), effective);
        setLibraryCurrentTime(relative);
      } else if (activeSourceRef.current === 'timeline') {
        const segmentIndex = Number(video.dataset.segmentIndex) || 0;
        const segments = timelineSegmentsRef.current;
        const segment = segments[segmentIndex];
        if (!segment) return;

        const relative = videoTime - segment.clip.inPoint;
        const timelineTime = segment.start + Math.max(relative, 0);

        if (Math.abs(timelineTime - playheadPosition) > 0.05) {
          setPlayheadPosition(Math.min(Math.max(timelineTime, 0), timeline.duration));
        }

        const threshold = segment.clip.outPoint - 0.02;
        if (videoTime >= threshold) {
          const nextIndex = segmentIndex + 1;
          if (nextIndex < segments.length) {
            setCurrentClipIndex(nextIndex);
            setPlayheadPosition(segments[nextIndex].start);
          } else {
            setIsPlaying(false);
            setPlayheadPosition(timeline.duration);
          }
        }
      }
    };

    const handleEnded = () => {
      if (activeSourceRef.current === 'library') {
        setIsPlaying(false);
      } else if (activeSourceRef.current === 'timeline') {
        const segments = timelineSegmentsRef.current;
        const segmentIndex = Number(video.dataset.segmentIndex) || 0;
        if (segmentIndex >= segments.length - 1) {
          setIsPlaying(false);
          setPlayheadPosition(timeline.duration);
        }
      }
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('error', handleError);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('error', handleError);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('ended', handleEnded);
    };
  }, [clips, handlePlayPromiseRejection, playheadPosition, setIsPlaying, setPlayheadPosition, timeline.duration]);

  const handlePlayPause = useCallback(() => {
    if (controlsDuration === 0) return;
    setIsPlaying(!isPlaying);
  }, [controlsDuration, isPlaying, setIsPlaying]);

  const handleSeek = useCallback((timeInSeconds: number) => {
    const video = videoRef.current;
    if (!video) return;

    if (previewSource === 'timeline') {
      if (!hasTimelineContent) return;
      const clamped = Math.min(Math.max(timeInSeconds, 0), timeline.duration);
      setPlayheadPosition(clamped);
      const segments = timelineSegmentsRef.current;
      const index = segments.findIndex((segment) => clamped >= segment.start && clamped < segment.end);
      if (index !== -1) {
        setCurrentClipIndex(index);
      } else if (clamped >= timeline.duration && segments.length > 0) {
        setCurrentClipIndex(segments.length - 1);
      }
    } else if (previewSource === 'library') {
      if (!activeLibraryClip) return;
      const effective = getEffectiveDuration(activeLibraryClip);
      const clamped = Math.min(Math.max(timeInSeconds, 0), effective);
      setLibraryCurrentTime(clamped);
      pendingSeekRef.current = activeLibraryClip.inPoint + clamped;
      try {
        video.currentTime = activeLibraryClip.inPoint + clamped;
      } catch (err) {
        console.warn('[PreviewPlayer] Failed to seek library clip:', err);
      }
    }
  }, [
    activeLibraryClip,
    hasTimelineContent,
    previewSource,
    setPlayheadPosition,
    timeline.duration,
  ]);

  const isEmptyState = previewSource === 'timeline' ? !hasTimelineContent : !hasLibraryContent;

  return (
    <div style={styles.wrapper}>
      <VideoCanvas
        videoRef={videoRef}
        isEmpty={isEmptyState}
        isError={Boolean(videoError)}
        errorMessage={videoError}
        isBuffering={isBuffering && !isEmptyState}
      />

      <PlaybackControls
        isPlaying={isPlaying}
        currentTime={controlsCurrentTime}
        duration={controlsDuration}
        onPlayPause={handlePlayPause}
        onSeek={handleSeek}
      />
    </div>
  );
};

const styles = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column' as const,
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#0d0d0d',
  },
};
