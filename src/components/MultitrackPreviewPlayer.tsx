/**
 * MultitrackPreviewPlayer Component
 * Plays main track video with audio mixing from all audio tracks
 * Based on proven PreviewPlayer pattern with proper video element handling
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTimelineStore } from '../store/timelineStore';
import { useSessionStore } from '../store/sessionStore';
import { VideoCanvas } from './VideoCanvas';
import { PlaybackControls } from './PlaybackControls';
import { normalizeFilePath, toFileUrl } from '../utils/fileUrl';
import type { Clip as TimelineClip, Tick } from '../types/timeline';
import type { Clip as LibraryClip } from '../types/session';
import { ticksToSeconds, secondsToTicks } from '../types/timeline';

interface ActiveAudioSource {
  clipId: string;
  trackId: string;
  audio: HTMLAudioElement;
  gainNode: GainNode;
  sourceNode: MediaElementAudioSourceNode;
}

export const MultitrackPreviewPlayer: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioDestinationRef = useRef<GainNode | null>(null);
  const activeAudioSourcesRef = useRef<Map<string, ActiveAudioSource>>(new Map());
  const isPlayingRef = useRef<boolean>(false);
  const activeMainVideoClipIdRef = useRef<string | null>(null);
  const pendingSeekRef = useRef<Tick | null>(null);
  const overlayVideoRef = useRef<HTMLVideoElement>(null);
  const activeOverlayClipIdRef = useRef<string | null>(null);
  const overlayPendingSeekRef = useRef<Tick | null>(null);

  // Timeline store (v2 multitrack)
  const doc = useTimelineStore((state) => state.doc);
  const libraryClips = useSessionStore((state) => state.clips);
  const isPlaying = useSessionStore((state) => state.isPlaying);
  const playhead = useTimelineStore((state) => state.doc.selection?.playhead ?? 0);
  const setPlayheadPosition = useTimelineStore((state) => state.setPlayheadPosition);
  const setIsPlaying = useSessionStore((state) => state.setIsPlaying);

  const [videoError, setVideoError] = useState<string | null>(null);
  const [isBuffering, setIsBuffering] = useState(false);

  // Find main track (video track with role='main')
  const mainTrack = useMemo(() => {
    return doc.tracks.find((t) => t.type === 'video' && t.role === 'main');
  }, [doc.tracks]);

  // Find all audio tracks
  const audioTracks = useMemo(() => {
    return doc.tracks.filter((t) => t.type === 'audio');
  }, [doc.tracks]);

  const overlayTracks = useMemo(() => {
    return doc.tracks.filter((t) => t.type === 'video' && t.role === 'overlay');
  }, [doc.tracks]);

  // Calculate timeline duration from all tracks
  const timelineDuration = useMemo(() => {
    let maxDuration = 0;
    for (const track of doc.tracks) {
      for (const lane of track.lanes) {
        for (const clip of lane.clips) {
          const clipEnd = clip.start + clip.duration;
          maxDuration = Math.max(maxDuration, clipEnd);
        }
      }
    }
    return maxDuration;
  }, [doc.tracks]);

  // Find clip at playhead on main track
  const mainTrackClipAtPlayhead = useMemo(() => {
    if (!mainTrack || mainTrack.lanes.length === 0) return null;

    const lane = mainTrack.lanes[0]; // Main track has exactly 1 lane per spec
    for (const clip of lane.clips) {
      if (playhead >= clip.start && playhead < clip.start + clip.duration) {
        const libraryClip = libraryClips.find((lc) => lc.id === clip.sourceId);
        const offsetInClip = playhead - clip.start;

        return {
          clip,
          libraryClip,
          offsetInClip,
        };
      }
    }
    return null;
  }, [mainTrack, libraryClips, playhead]);

  const overlayClipsAtPlayhead = useMemo(() => {
    const clips: Array<{
      clipId: string;
      clip: TimelineClip;
      libraryClip: LibraryClip | undefined;
      offsetInClip: Tick;
      trackId: string;
    }> = [];

    for (const track of overlayTracks) {
      for (const lane of track.lanes) {
        for (const clip of lane.clips) {
          if (playhead >= clip.start && playhead < clip.start + clip.duration) {
            const libraryClip = libraryClips.find((lc) => lc.id === clip.sourceId);
            const offsetInClip = playhead - clip.start;

            clips.push({
              clipId: clip.id,
              clip,
              libraryClip,
              offsetInClip,
              trackId: track.id,
            });
          }
        }
      }
    }

    return clips;
  }, [overlayTracks, libraryClips, playhead]);

  const audioTrackClipsAtPlayhead = useMemo(() => {
    const clips: Array<{
      clipId: string;
      clip: TimelineClip;
      libraryClip: LibraryClip | undefined;
      offsetInClip: Tick;
      trackId: string;
    }> = [];

    for (const track of audioTracks) {
      for (const lane of track.lanes) {
        for (const clip of lane.clips) {
          if (playhead >= clip.start && playhead < clip.start + clip.duration) {
            const libraryClip = libraryClips.find((lc) => lc.id === clip.sourceId);
            const offsetInClip = playhead - clip.start;

            clips.push({
              clipId: clip.id,
              clip,
              libraryClip,
              offsetInClip,
              trackId: track.id,
            });
          }
        }
      }
    }

    return clips;
  }, [audioTracks, libraryClips, playhead]);

  const audioClipsAtPlayhead = useMemo(() => {
    return [...audioTrackClipsAtPlayhead, ...overlayClipsAtPlayhead];
  }, [audioTrackClipsAtPlayhead, overlayClipsAtPlayhead]);

  const activeOverlayClip = useMemo(() => {
    if (overlayClipsAtPlayhead.length === 0) return null;
    const withMedia = overlayClipsAtPlayhead.find((entry) => entry.libraryClip);
    return withMedia ?? overlayClipsAtPlayhead[0];
  }, [overlayClipsAtPlayhead]);

  // Initialize Web Audio API context
  useEffect(() => {
    if (!audioContextRef.current) {
      const AudioContextConstructor = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContextConstructor();
      audioContextRef.current = audioContext;

      // Resume the audio context (required in Electron and many browsers)
      if (audioContext.state === 'suspended') {
        audioContext.resume().then(() => {
          console.log('🎵 [MultitrackPreviewPlayer] Audio context resumed'); // eslint-disable-line no-console
        }).catch((err: unknown) => {
          console.error('[MultitrackPreviewPlayer] Failed to resume audio context:', err); // eslint-disable-line no-console
        });
      }

      // Create master gain node for volume control
      const masterGain = audioContext.createGain();
      masterGain.gain.value = 1.0;
      masterGain.connect(audioContext.destination);
      audioDestinationRef.current = masterGain;

      console.log('🎵 [MultitrackPreviewPlayer] Web Audio API context initialized'); // eslint-disable-line no-console
    }
  }, []);

  // Load main track video
  const loadMainTrackVideo = useCallback((clip: TimelineClip, libraryClip: LibraryClip, targetPlayhead: Tick, muteVideo: boolean) => {
    const video = videoRef.current;
    if (!video) return;

    const resolvedPath = normalizeFilePath(libraryClip.filePath);
    const fileUrl = toFileUrl(resolvedPath);

    // Prevent unnecessary reloads
    if (activeMainVideoClipIdRef.current === clip.id && video.src === fileUrl) {
      console.log('🎬 [MultitrackPreviewPlayer] Clip already loaded:', clip.id); // eslint-disable-line no-console
      return;
    }

    console.log('🎬 [MultitrackPreviewPlayer] Loading main track video:', {
      // eslint-disable-line no-console
      clipId: clip.id,
      filename: libraryClip.filename,
      targetPlayhead: ticksToSeconds(targetPlayhead, doc.timebase.ticksPerSecond),
    });

    activeMainVideoClipIdRef.current = clip.id;
    pendingSeekRef.current = targetPlayhead;

    setIsBuffering(true);
    setVideoError(null);

    // Proper video element reload pattern (from PreviewPlayer)
    video.pause();
    video.removeAttribute('src');
    video.load();
    video.src = fileUrl;
    video.muted = muteVideo; // Only mute when we have dedicated audio tracks
    video.load();
  }, [doc.timebase.ticksPerSecond]);

  const loadOverlayVideo = useCallback((clip: TimelineClip, libraryClip: LibraryClip, targetPlayhead: Tick) => {
    const overlayVideo = overlayVideoRef.current;
    if (!overlayVideo) return;

    const resolvedPath = normalizeFilePath(libraryClip.filePath);
    const fileUrl = toFileUrl(resolvedPath);
    const isSameSource = activeOverlayClipIdRef.current === clip.id && overlayVideo.src === fileUrl;

    activeOverlayClipIdRef.current = clip.id;
    overlayPendingSeekRef.current = targetPlayhead;

    if (!isSameSource) {
      overlayVideo.pause();
      overlayVideo.removeAttribute('src');
      overlayVideo.load();
      overlayVideo.src = fileUrl;
      overlayVideo.muted = true;
      overlayVideo.load();
    } else {
      const offsetTicks = Math.max(0, targetPlayhead - clip.start);
      const clipSourceTicks = clip.srcStart + offsetTicks;
      const targetSeconds = ticksToSeconds(clipSourceTicks, doc.timebase.ticksPerSecond);
      try {
        overlayVideo.currentTime = targetSeconds;
      } catch (error) {
        console.warn('[MultitrackPreviewPlayer] Failed to seek overlay clip:', error); // eslint-disable-line no-console
      }
    }

    overlayVideo.muted = true;
  }, [doc.timebase.ticksPerSecond]);

  // Setup audio sources for audio tracks
  const setupAudioSources = useCallback(() => {
    const audioContext = audioContextRef.current;
    const destination = audioDestinationRef.current;

    if (!audioContext || !destination) {
      console.warn('[MultitrackPreviewPlayer] Audio context not ready'); // eslint-disable-line no-console
      return;
    }

    // Stop any existing audio sources that are no longer needed
    const activeClipIds = new Set(audioClipsAtPlayhead.map((c) => c.clipId));
    const sourcesToRemove: string[] = [];

    // Sync existing audio sources with current timeline offset
    audioClipsAtPlayhead.forEach((clipInfo) => {
      const existingSource = activeAudioSourcesRef.current.get(clipInfo.clipId);
      if (!existingSource || !clipInfo.libraryClip) return;

      const clipSourceTicks = clipInfo.clip.srcStart + clipInfo.offsetInClip;
      const targetSeconds = ticksToSeconds(clipSourceTicks, doc.timebase.ticksPerSecond);
      const audioElement = existingSource.audio;

      if (Math.abs(audioElement.currentTime - targetSeconds) > 0.05 && !audioElement.seeking) {
        try {
          audioElement.currentTime = targetSeconds;
        } catch (error) {
          console.warn('[MultitrackPreviewPlayer] Failed to sync audio source:', error); // eslint-disable-line no-console
        }
      }
    });

    activeAudioSourcesRef.current.forEach((source, clipId) => {
      if (!activeClipIds.has(clipId)) {
        try {
          source.audio.pause();
          source.audio.removeAttribute('src');
          source.sourceNode.disconnect();
          source.gainNode.disconnect();
        } catch (e) {
          console.warn('[MultitrackPreviewPlayer] Error removing audio source:', e); // eslint-disable-line no-console
        }
        sourcesToRemove.push(clipId);
      }
    });

    sourcesToRemove.forEach((id) => activeAudioSourcesRef.current.delete(id));

    // Setup new audio sources
    for (const clipInfo of audioClipsAtPlayhead) {
      if (activeAudioSourcesRef.current.has(clipInfo.clipId)) {
        continue;
      }

      if (!clipInfo.libraryClip) {
        console.warn('[MultitrackPreviewPlayer] Library clip not found:', clipInfo.clip.sourceId); // eslint-disable-line no-console
        continue;
      }

      const resolvedPath = normalizeFilePath(clipInfo.libraryClip.filePath);
      const fileUrl = toFileUrl(resolvedPath);

      const audioElement = new Audio();
      audioElement.crossOrigin = 'anonymous';
      audioElement.src = fileUrl;

      const clipSourceTicks = clipInfo.clip.srcStart + clipInfo.offsetInClip;
      const targetSeconds = ticksToSeconds(clipSourceTicks, doc.timebase.ticksPerSecond);

      const handleLoadedMetadata = () => {
        try {
          audioElement.currentTime = targetSeconds;
        } catch (error) {
          console.warn('[MultitrackPreviewPlayer] Failed to seek new audio source:', error); // eslint-disable-line no-console
        }
        audioElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
      };

      audioElement.addEventListener('loadedmetadata', handleLoadedMetadata);
      if (audioElement.readyState >= 1) {
        try {
          audioElement.currentTime = targetSeconds;
        } catch (error) {
          console.warn('[MultitrackPreviewPlayer] Immediate audio seek failed:', error); // eslint-disable-line no-console
        }
      }

      // Create gain node for this track
      const gainNode = audioContext.createGain();
      gainNode.gain.value = 0.5; // Default to 50% to avoid clipping
      gainNode.connect(destination);

      try {
        const mediaSource = audioContext.createMediaElementSource(audioElement);
        mediaSource.connect(gainNode);

        activeAudioSourcesRef.current.set(clipInfo.clipId, {
          clipId: clipInfo.clipId,
          trackId: clipInfo.trackId,
          audio: audioElement,
          gainNode,
          sourceNode: mediaSource,
        });

        console.log('🔊 [MultitrackPreviewPlayer] Audio source setup:', {
          // eslint-disable-line no-console
          clipId: clipInfo.clipId,
          filename: clipInfo.libraryClip.filename,
        });
      } catch (error) {
        console.error('[MultitrackPreviewPlayer] Failed to create audio source:', error); // eslint-disable-line no-console
      }
    }
  }, [audioClipsAtPlayhead, doc.timebase.ticksPerSecond]);

  // Load video when main track clip changes
  useEffect(() => {
    if (!mainTrackClipAtPlayhead || !mainTrackClipAtPlayhead.libraryClip) {
      const video = videoRef.current;
      if (video) {
        video.pause();
        video.removeAttribute('src');
        video.load();
      }
      return;
    }

    const shouldMuteVideo = audioTrackClipsAtPlayhead.length > 0;

    loadMainTrackVideo(
      mainTrackClipAtPlayhead.clip,
      mainTrackClipAtPlayhead.libraryClip,
      playhead,
      shouldMuteVideo
    );
  }, [audioTrackClipsAtPlayhead.length, mainTrackClipAtPlayhead, playhead, loadMainTrackVideo]);

  // Keep video mute state in sync with available audio tracks
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const shouldMuteVideo = audioTrackClipsAtPlayhead.length > 0;
    if (video.muted !== shouldMuteVideo) {
      video.muted = shouldMuteVideo;
    }
  }, [audioTrackClipsAtPlayhead.length]);

  useEffect(() => {
    const overlayVideo = overlayVideoRef.current;

    if (!activeOverlayClip || !activeOverlayClip.libraryClip) {
      if (overlayVideo) {
        overlayVideo.pause();
        overlayVideo.removeAttribute('src');
        overlayVideo.load();
      }
      activeOverlayClipIdRef.current = null;
      overlayPendingSeekRef.current = null;
      return;
    }

    loadOverlayVideo(activeOverlayClip.clip, activeOverlayClip.libraryClip, playhead);
  }, [activeOverlayClip, loadOverlayVideo, playhead]);

  useEffect(() => {
    const overlayVideo = overlayVideoRef.current;
    if (!overlayVideo) return;

    const handleLoadedMetadata = () => {
      if (!activeOverlayClip || !activeOverlayClip.libraryClip) return;

      const targetPlayhead = overlayPendingSeekRef.current ?? playhead;
      const offsetTicks = Math.max(0, targetPlayhead - activeOverlayClip.clip.start);
      const clipSourceTicks = activeOverlayClip.clip.srcStart + offsetTicks;
      const targetSeconds = ticksToSeconds(clipSourceTicks, doc.timebase.ticksPerSecond);

      try {
        overlayVideo.currentTime = targetSeconds;
      } catch (error) {
        console.warn('[MultitrackPreviewPlayer] Failed to seek overlay metadata:', error); // eslint-disable-line no-console
      }

      overlayPendingSeekRef.current = null;
    };

    const handleCanPlay = () => {
      if (isPlayingRef.current) {
        const playPromise = overlayVideo.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch((error) => {
            console.warn('[MultitrackPreviewPlayer] Overlay play failed:', error); // eslint-disable-line no-console
          });
        }
      }
    };

    overlayVideo.addEventListener('loadedmetadata', handleLoadedMetadata);
    overlayVideo.addEventListener('canplay', handleCanPlay);

    return () => {
      overlayVideo.removeEventListener('loadedmetadata', handleLoadedMetadata);
      overlayVideo.removeEventListener('canplay', handleCanPlay);
    };
  }, [activeOverlayClip, doc.timebase.ticksPerSecond, playhead]);

  useEffect(() => {
    const overlayVideo = overlayVideoRef.current;
    if (!overlayVideo) return;

    if (!activeOverlayClip || !activeOverlayClip.libraryClip) return;

    const clipSourceTicks = activeOverlayClip.clip.srcStart + activeOverlayClip.offsetInClip;
    const targetSeconds = ticksToSeconds(clipSourceTicks, doc.timebase.ticksPerSecond);

    if (Math.abs(overlayVideo.currentTime - targetSeconds) > 0.05 && !overlayVideo.seeking) {
      try {
        overlayVideo.currentTime = targetSeconds;
      } catch (error) {
        console.warn('[MultitrackPreviewPlayer] Overlay seek sync failed:', error); // eslint-disable-line no-console
      }
    }
  }, [activeOverlayClip, doc.timebase.ticksPerSecond]);

  // Handle play/pause
  useEffect(() => {
    isPlayingRef.current = isPlaying;
    const video = videoRef.current;

    if (!video) return;

    if (isPlaying) {
      console.log('▶️  [MultitrackPreviewPlayer] Starting playback'); // eslint-disable-line no-console

      // Start playback with proper async handling for audio context
      const startPlayback = async () => {
        // Resume audio context if suspended BEFORE setting up audio sources
        const audioContext = audioContextRef.current;
        if (audioContext && audioContext.state === 'suspended') {
          try {
            await audioContext.resume();
            console.log('🔊 [MultitrackPreviewPlayer] Audio context resumed for playback'); // eslint-disable-line no-console
          } catch (e) {
            console.warn('[MultitrackPreviewPlayer] Failed to resume audio context:', e); // eslint-disable-line no-console
          }
        }

        // Now setup audio sources after context is definitely resumed
        setupAudioSources();

        // Play video
        const videoPlayPromise = video.play();
        if (videoPlayPromise && typeof videoPlayPromise.catch === 'function') {
          videoPlayPromise.catch((e: unknown) => {
            console.warn('[MultitrackPreviewPlayer] Video play failed:', e); // eslint-disable-line no-console
          });
        }

        const overlayVideo = overlayVideoRef.current;
        if (overlayVideo && overlayVideo.src) {
          const overlayPlayPromise = overlayVideo.play();
          if (overlayPlayPromise && typeof overlayPlayPromise.catch === 'function') {
            overlayPlayPromise.catch((e: unknown) => {
              console.warn('[MultitrackPreviewPlayer] Overlay video play failed:', e); // eslint-disable-line no-console
            });
          }
        }

        // Play all active audio sources
        activeAudioSourcesRef.current.forEach((source) => {
          try {
            source.audio.play().catch((e: unknown) => {
              console.warn('[MultitrackPreviewPlayer] Audio play failed:', e); // eslint-disable-line no-console
            });
          } catch (error) {
            console.warn('[MultitrackPreviewPlayer] Failed to play audio:', error); // eslint-disable-line no-console
          }
        });
      };

      startPlayback();
    } else {
      console.log('⏸️  [MultitrackPreviewPlayer] Pausing playback'); // eslint-disable-line no-console

      // Pause video and audio
      video.pause();
      if (overlayVideoRef.current) {
        overlayVideoRef.current.pause();
      }
      activeAudioSourcesRef.current.forEach((source) => {
        try {
          source.audio.pause();
        } catch (error) {
          console.warn('[MultitrackPreviewPlayer] Failed to pause audio:', error); // eslint-disable-line no-console
        }
      });
    }
  }, [isPlaying, setupAudioSources]);

  // Handle video events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      console.log('📹 [MultitrackPreviewPlayer] Video metadata loaded'); // eslint-disable-line no-console
      setIsBuffering(false);

      // Seek to pending playhead position if needed
      if (pendingSeekRef.current !== null) {
        const mainClip = mainTrackClipAtPlayhead;
        if (mainClip) {
          const offsetInClip = pendingSeekRef.current - mainClip.clip.start;
          const offsetInSource = mainClip.clip.srcStart + offsetInClip;
          const targetSeconds = ticksToSeconds(offsetInSource, doc.timebase.ticksPerSecond);

          console.log('🎯 [MultitrackPreviewPlayer] Seeking to:', {
            // eslint-disable-line no-console
            targetSeconds,
            offsetInClip: ticksToSeconds(offsetInClip, doc.timebase.ticksPerSecond),
          });

          try {
            video.currentTime = targetSeconds;
          } catch (error) {
            console.warn('[MultitrackPreviewPlayer] Failed to seek on metadata:', error); // eslint-disable-line no-console
          }
        }
        pendingSeekRef.current = null;
      }
    };

    const handleCanPlay = () => {
      setIsBuffering(false);
      if (isPlayingRef.current) {
        const playPromise = video.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch((e) => {
            console.warn('[MultitrackPreviewPlayer] Play failed:', e); // eslint-disable-line no-console
          });
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
      console.error('[MultitrackPreviewPlayer] Video error:', message); // eslint-disable-line no-console
    };

    const handleTimeUpdate = () => {
      const mainClip = mainTrackClipAtPlayhead;
      if (!mainClip) return;

      const videoTime = video.currentTime;
      const offsetInSource = mainClip.clip.srcStart;
      const offsetInClip = secondsToTicks(videoTime - ticksToSeconds(offsetInSource, doc.timebase.ticksPerSecond), doc.timebase.ticksPerSecond);
      const newPlayhead = mainClip.clip.start + offsetInClip;

      // Update playhead based on video playback
      if (Math.abs(ticksToSeconds(newPlayhead - playhead, doc.timebase.ticksPerSecond)) > 0.05) {
        setPlayheadPosition(Math.min(Math.max(newPlayhead, 0), timelineDuration));
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setPlayheadPosition(timelineDuration);
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
  }, [mainTrackClipAtPlayhead, doc.timebase.ticksPerSecond, playhead, timelineDuration, setPlayheadPosition, setIsPlaying]);

  const handlePlayPause = useCallback(() => {
    if (timelineDuration === 0) return;
    setIsPlaying(!isPlaying);
  }, [timelineDuration, isPlaying, setIsPlaying]);

  const handleSeek = useCallback(
    (timeInSeconds: number) => {
      const clampedTicks = Math.max(0, Math.min(secondsToTicks(timeInSeconds, doc.timebase.ticksPerSecond), timelineDuration));
      setPlayheadPosition(clampedTicks);
    },
    [doc.timebase.ticksPerSecond, timelineDuration, setPlayheadPosition]
  );

  const currentTimeSeconds = ticksToSeconds(playhead, doc.timebase.ticksPerSecond);
  const durationSeconds = ticksToSeconds(timelineDuration, doc.timebase.ticksPerSecond);

  const isEmpty = timelineDuration === 0;
  const overlayVideoVisible = Boolean(activeOverlayClip && activeOverlayClip.libraryClip);

  return (
    <div style={styles.wrapper}>
      <VideoCanvas
        videoRef={videoRef}
        isEmpty={isEmpty}
        isError={Boolean(videoError)}
        errorMessage={videoError}
        isBuffering={isBuffering && !isEmpty}
        overlayVideos={
          overlayVideoVisible
            ? [
                {
                  ref: overlayVideoRef,
                  isVisible: overlayVideoVisible,
                  style: {
                    right: '32px',
                    bottom: '96px',
                    width: '22%',
                    maxWidth: '360px',
                  },
                },
              ]
            : undefined
        }
      />

      <PlaybackControls
        isPlaying={isPlaying}
        currentTime={currentTimeSeconds}
        duration={durationSeconds}
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
