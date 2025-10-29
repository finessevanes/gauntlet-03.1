/**
 * useScreenRecorder Hook
 * Handles MediaRecorder setup and screen recording in renderer process
 * Story S9: Screen Recording
 */

import { useState, useRef, useCallback } from 'react';

interface RecordingState {
  isRecording: boolean;
  sessionId: string | null;
  error: string | null;
}

export function useScreenRecorder() {
  const [state, setState] = useState<RecordingState>({
    isRecording: false,
    sessionId: null,
    error: null,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const tempWebmPathRef = useRef<string | null>(null);

  /**
   * Start recording screen with optional audio
   */
  const startRecording = useCallback(
    async (screenSourceId: string, audioEnabled: boolean, audioDeviceId?: string): Promise<string | null> => {
      try {
        console.log('[useScreenRecorder] Starting recording...', {
          screenSourceId,
          audioEnabled,
          audioDeviceId,
        });

        // Get screen stream via getUserMedia with electron-specific constraints
        // @ts-ignore - Electron extends getUserMedia with desktopCapturer
        const screenStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: screenSourceId,
            },
          } as any,
        });

        console.log('[useScreenRecorder] Got screen stream');

        let combinedStream = screenStream;

        // Add audio stream if enabled
        if (audioEnabled) {
          try {
            // Build audio constraints with optional deviceId
            // If deviceId is 'default' or not provided, use true to let browser pick default
            const audioConstraints: MediaTrackConstraints =
              audioDeviceId && audioDeviceId !== 'default'
                ? { deviceId: { exact: audioDeviceId } }
                : true;

            console.log('[useScreenRecorder] Requesting audio with constraints:', audioConstraints);

            const audioStream = await navigator.mediaDevices.getUserMedia({
              audio: audioConstraints,
              video: false,
            });

            console.log('[useScreenRecorder] Got audio stream from device:', audioDeviceId || 'default');

            // Combine video and audio tracks
            const audioTrack = audioStream.getAudioTracks()[0];
            if (audioTrack) {
              combinedStream.addTrack(audioTrack);
              console.log('[useScreenRecorder] Audio track added:', {
                label: audioTrack.label,
                id: audioTrack.id,
                enabled: audioTrack.enabled,
                muted: audioTrack.muted,
              });
            }
          } catch (audioError) {
            console.warn('[useScreenRecorder] Could not get audio stream:', audioError);
            // Continue with video-only recording
          }
        }

        // Log all tracks in the combined stream
        const videoTracks = combinedStream.getVideoTracks();
        const audioTracks = combinedStream.getAudioTracks();
        console.log('[useScreenRecorder] Stream tracks:', {
          video: videoTracks.length,
          audio: audioTracks.length,
          videoTrack: videoTracks[0] ? { label: videoTracks[0].label, enabled: videoTracks[0].enabled } : null,
          audioTrack: audioTracks[0] ? { label: audioTracks[0].label, enabled: audioTracks[0].enabled } : null,
        });

        // Choose MIME type based on whether we have audio
        const hasAudio = audioTracks.length > 0;
        const mimeType = hasAudio ? 'video/webm;codecs=vp8,opus' : 'video/webm;codecs=vp8';

        console.log('[useScreenRecorder] Using MIME type:', mimeType);

        // Create MediaRecorder
        const mediaRecorder = new MediaRecorder(combinedStream, {
          mimeType: mimeType,
        });

        chunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            console.log('[useScreenRecorder] Data chunk received:', event.data.size, 'bytes');
            chunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = () => {
          console.log('[useScreenRecorder] MediaRecorder stopped');

          // Stop all tracks
          combinedStream.getTracks().forEach((track) => {
            console.log('[useScreenRecorder] Stopping track:', track.kind, track.label);
            track.stop();
          });
        };

        mediaRecorder.start(1000); // Collect data every second

        console.log('[useScreenRecorder] MediaRecorder started, state:', mediaRecorder.state);

        mediaRecorderRef.current = mediaRecorder;

        // Call main process to create session and start recording
        // This returns the sessionId we'll use for stopping
        const startResponse = await window.electron.recording.startRecording({
          screenSourceId,
          audioEnabled,
        });

        if (!startResponse.success || !startResponse.sessionId) {
          throw new Error(startResponse.error || 'Failed to start recording');
        }

        const sessionId = startResponse.sessionId;
        tempWebmPathRef.current = `/tmp/klippy-recordings/${sessionId}.webm`;

        setState({
          isRecording: true,
          sessionId,
          error: null,
        });

        return sessionId;
      } catch (error) {
        console.error('[useScreenRecorder] Error starting recording:', error);
        setState({
          isRecording: false,
          sessionId: null,
          error: error instanceof Error ? error.message : 'Failed to start recording',
        });
        return null;
      }
    },
    []
  );

  /**
   * Stop recording and return file path
   */
  const stopRecording = useCallback(async (): Promise<{
    success: boolean;
    filePath?: string;
    duration?: number;
    error?: string;
  }> => {
    try {
      console.log('[useScreenRecorder] Stopping recording...');

      if (!mediaRecorderRef.current || !state.sessionId) {
        throw new Error('No active recording');
      }

      const sessionId = state.sessionId;

      // Stop MediaRecorder and wait for it to finish
      return new Promise((resolve) => {
        mediaRecorderRef.current!.onstop = async () => {
          console.log('[useScreenRecorder] MediaRecorder stopped, processing data...');

          try {
            // Check if we have any data
            if (chunksRef.current.length === 0) {
              throw new Error('No recording data captured. Recording may have been too short.');
            }

            console.log(`[useScreenRecorder] Processing ${chunksRef.current.length} chunk(s)`);

            // Create blob from chunks
            const blob = new Blob(chunksRef.current, { type: 'video/webm' });

            console.log('[useScreenRecorder] Created blob:', {
              size: blob.size,
              type: blob.type,
            });

            // Validate blob has content
            if (blob.size === 0) {
              throw new Error('Recording blob is empty. No data was captured.');
            }

            // Convert to Uint8Array
            const arrayBuffer = await blob.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);

            console.log(`[useScreenRecorder] Converted to Uint8Array: ${uint8Array.length} bytes`);

            // Save to main process
            const saveResponse = await window.electron.recording.saveRecordingData(
              sessionId,
              uint8Array
            );

            if (!saveResponse.success) {
              throw new Error(saveResponse.error || 'Failed to save recording');
            }

            console.log('[useScreenRecorder] Recording saved, converting to MP4...');

            // Convert WebM to MP4
            const stopResponse = await window.electron.recording.stopRecording({ sessionId });

            resolve(stopResponse);
          } catch (error) {
            console.error('[useScreenRecorder] Error in onstop:', error);
            resolve({
              success: false,
              error: error instanceof Error ? error.message : 'Failed to process recording',
            });
          }
        };

        // Request data one more time before stopping to ensure we have everything
        if (mediaRecorderRef.current!.state === 'recording') {
          mediaRecorderRef.current!.requestData();
        }

        mediaRecorderRef.current!.stop();
      }).then((stopResponse) => {
        const response = stopResponse as typeof stopResponse extends Promise<infer T> ? T : never;

        if (!response.success) {
          throw new Error(response.error || 'Failed to stop recording');
        }

        console.log('[useScreenRecorder] Recording stopped successfully');

        setState({
          isRecording: false,
          sessionId: null,
          error: null,
        });

        return response;
      });
    } catch (error) {
      console.error('[useScreenRecorder] Error stopping recording:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to stop recording';

      setState((prev) => ({
        ...prev,
        error: errorMessage,
      }));

      return {
        success: false,
        error: errorMessage,
      };
    }
  }, [state.sessionId]);

  /**
   * Cancel recording
   */
  const cancelRecording = useCallback(async (): Promise<void> => {
    try {
      console.log('[useScreenRecorder] Canceling recording...');

      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
      }

      if (state.sessionId) {
        await window.electron.recording.cancelRecording({ sessionId: state.sessionId });
      }

      setState({
        isRecording: false,
        sessionId: null,
        error: null,
      });
    } catch (error) {
      console.error('[useScreenRecorder] Error canceling recording:', error);
    }
  }, [state.sessionId]);

  return {
    isRecording: state.isRecording,
    sessionId: state.sessionId,
    error: state.error,
    startRecording,
    stopRecording,
    cancelRecording,
  };
}
