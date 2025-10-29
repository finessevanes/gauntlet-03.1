/**
 * Export IPC Handlers (Story 7: Export to MP4)
 * Handles video export workflow with FFmpeg integration
 */

import { ipcMain, BrowserWindow } from 'electron';
import { ChildProcess } from 'child_process';
import * as fs from 'fs';
import { spawnFFmpeg, spawnFFprobe, getFFmpegPath } from '../services/ffmpeg-service';
import { Clip } from '../../types/session';

/**
 * Export request from renderer
 */
interface ExportRequest {
  outputPath: string;
  timeline: {
    clips: Clip[];
    totalDuration: number;
  };
}

/**
 * Export response sent back to renderer
 */
interface ExportResponse {
  success: boolean;
  outputPath?: string;
  errorMessage?: string;
}

/**
 * Progress data sent via IPC event during export
 */
interface ExportProgress {
  percentComplete: number;
  currentTime: number;
  totalDuration: number;
  currentFrame?: number;
  estimatedTimeRemaining: number;
  speed: number;
}

/**
 * Video metadata from FFprobe
 */
interface VideoProbeResult {
  duration: number;
  width: number;
  height: number;
  fps: number;
}

/**
 * Validation result for timeline
 */
interface ValidationResult {
  valid: boolean;
  error?: string;
}

// Track active export process
let activeExportProcess: ChildProcess | null = null;
let activeExportOutputPath: string | null = null;

/**
 * Register export-related IPC handlers
 */
export function registerExportHandlers(): void {
  console.log('[Export] Registering export IPC handlers');
  ipcMain.handle('export-video', handleExportVideo);
  ipcMain.handle('export-cancel', handleExportCancel);
  console.log('[Export] Export IPC handlers registered successfully');
}

/**
 * Main export handler - validates, builds command, spawns FFmpeg, monitors progress
 */
async function handleExportVideo(
  event: Electron.IpcMainInvokeEvent,
  request: ExportRequest
): Promise<ExportResponse> {
  console.log('[Export] handleExportVideo called');
  console.log('[Export] Request:', {
    outputPath: request.outputPath,
    clipCount: request.timeline?.clips?.length,
    totalDuration: request.timeline?.totalDuration,
  });

  try {
    const { outputPath, timeline } = request;

    // Validate timeline and source files
    const validation = await validateTimeline(timeline.clips);
    if (!validation.valid) {
      return {
        success: false,
        errorMessage: validation.error,
      };
    }

    // Probe all source files in parallel to get metadata
    const probeResults: VideoProbeResult[] = [];
    try {
      const probePromises = timeline.clips.map(clip =>
        probeSourceFile(clip.filePath).catch(error => ({
          error: true,
          clip,
          message: error.message,
        }))
      );
      const results = await Promise.all(probePromises);

      // Check for any errors
      for (const result of results) {
        if (result && 'error' in result) {
          return {
            success: false,
            errorMessage: `Failed to read file: ${result.clip.filename}. ${result.message}`,
          };
        }
        probeResults.push(result as VideoProbeResult);
      }
    } catch (error) {
      return {
        success: false,
        errorMessage: `Failed to probe source files: ${error.message}`,
      };
    }

    // Determine output resolution (max of all clips, capped at 1080p)
    const outputResolution = determineOutputResolution(probeResults);

    // Build FFmpeg command
    const ffmpegArgs = buildFFmpegCommand(
      timeline.clips,
      outputPath,
      outputResolution,
      probeResults
    );

    // Log command for debugging
    console.log('[Export] FFmpeg command:', getFFmpegPath(), ffmpegArgs.join(' '));
    console.log('[Export] Output path:', outputPath);
    console.log('[Export] Timeline clips:', timeline.clips.length);
    console.log('[Export] Total duration:', timeline.totalDuration);

    // Spawn FFmpeg process
    const success = await executeFFmpeg(
      ffmpegArgs,
      outputPath,
      timeline.totalDuration,
      event.sender
    );

    if (success) {
      return {
        success: true,
        outputPath,
      };
    } else {
      return {
        success: false,
        errorMessage: 'Export failed. Check console for FFmpeg errors.',
      };
    }
  } catch (error) {
    console.error('[Export] Error in handleExportVideo:', error);
    console.error('[Export] Error stack:', error.stack);
    return {
      success: false,
      errorMessage: `Export error: ${error.message}`,
    };
  }
}

/**
 * Validate timeline has clips and all source files exist
 */
async function validateTimeline(clips: Clip[]): Promise<ValidationResult> {
  // Check timeline has at least 1 clip
  if (!clips || clips.length === 0) {
    return {
      valid: false,
      error: 'Add at least one clip to export',
    };
  }

  // Check all source files exist
  for (const clip of clips) {
    if (!fs.existsSync(clip.filePath)) {
      return {
        valid: false,
        error: `Cannot export: ${clip.filename} not found`,
      };
    }
  }

  return { valid: true };
}

/**
 * Probe a video file with FFprobe to extract metadata
 */
async function probeSourceFile(filePath: string): Promise<VideoProbeResult> {
  return new Promise((resolve, reject) => {
    const args = [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height,r_frame_rate,duration',
      '-of', 'json',
      filePath,
    ];

    const ffprobe = spawnFFprobe(args);
    let stdout = '';
    let stderr = '';

    ffprobe.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    ffprobe.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffprobe.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`FFprobe failed: ${stderr}`));
        return;
      }

      try {
        const data = JSON.parse(stdout);
        const stream = data.streams[0];

        // Parse frame rate (e.g., "30/1" -> 30)
        const fpsMatch = stream.r_frame_rate.match(/(\d+)\/(\d+)/);
        const fps = fpsMatch ? parseInt(fpsMatch[1]) / parseInt(fpsMatch[2]) : 30;

        resolve({
          duration: parseFloat(stream.duration) || 0,
          width: stream.width,
          height: stream.height,
          fps,
        });
      } catch (error) {
        reject(new Error(`Failed to parse FFprobe output: ${error.message}`));
      }
    });
  });
}

/**
 * Determine output resolution from probe results (max resolution, capped at 1080p)
 */
function determineOutputResolution(probeResults: VideoProbeResult[]): { width: number; height: number } {
  let maxWidth = 0;
  let maxHeight = 0;

  for (const probe of probeResults) {
    if (probe.width > maxWidth) maxWidth = probe.width;
    if (probe.height > maxHeight) maxHeight = probe.height;
  }

  // Cap at 1080p
  if (maxHeight > 1080) {
    const aspectRatio = maxWidth / maxHeight;
    maxHeight = 1080;
    maxWidth = Math.round(maxHeight * aspectRatio);
  }

  if (maxWidth > 1920) {
    const aspectRatio = maxHeight / maxWidth;
    maxWidth = 1920;
    maxHeight = Math.round(maxWidth * aspectRatio);
  }

  return { width: maxWidth, height: maxHeight };
}

/**
 * Build FFmpeg command arguments with trim + concat filters
 * Now with conditional scaling and FPS filtering for better performance
 */
function buildFFmpegCommand(
  clips: Clip[],
  outputPath: string,
  outputResolution: { width: number; height: number },
  probeResults: VideoProbeResult[]
): string[] {
  const args: string[] = [];

  // Add input files
  for (const clip of clips) {
    args.push('-i', clip.filePath);
  }

  // Build filter_complex for trim + scale + fps + concat
  const filterParts: string[] = [];
  const videoLabels: string[] = [];
  const audioLabels: string[] = [];

  // Process all video streams first
  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];
    const probe = probeResults[i];

    // Build filter chain: start with trim
    let filterChain = `[${i}:v]trim=start=${clip.inPoint}:end=${clip.outPoint},setpts=PTS-STARTPTS`;

    // Only scale if resolution doesn't match output
    const needsScaling = probe.width !== outputResolution.width || probe.height !== outputResolution.height;
    if (needsScaling) {
      filterChain += `,scale=${outputResolution.width}:${outputResolution.height}:force_original_aspect_ratio=decrease`;
      filterChain += `,pad=${outputResolution.width}:${outputResolution.height}:(ow-iw)/2:(oh-ih)/2`;
    }

    // Always normalize SAR to 1:1 to prevent concat filter errors
    filterChain += `,setsar=1`;

    // Only apply fps filter if source fps differs from target (30fps)
    const needsFpsConversion = Math.abs(probe.fps - 30) > 0.1; // Allow small floating point difference
    if (needsFpsConversion) {
      filterChain += `,fps=30`;
    }

    // Add output label
    filterChain += `[v${i}]`;

    filterParts.push(filterChain);
    videoLabels.push(`[v${i}]`);
  }

  // Then process all audio streams
  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];

    // Audio trim
    filterParts.push(`[${i}:a]atrim=start=${clip.inPoint}:end=${clip.outPoint},asetpts=PTS-STARTPTS[a${i}]`);
    audioLabels.push(`[a${i}]`);
  }

  // Concat streams: concat expects inputs grouped per segment (video+audio)
  const concatInputs: string[] = [];
  for (let i = 0; i < clips.length; i++) {
    concatInputs.push(videoLabels[i], audioLabels[i]);
  }
  const concatFilter = `${concatInputs.join('')}concat=n=${clips.length}:v=1:a=1[outv][outa]`;
  filterParts.push(concatFilter);

  args.push('-filter_complex', filterParts.join(';'));

  // Map output streams
  args.push('-map', '[outv]', '-map', '[outa]');

  // Codec settings (H.264, AAC)
  // Using 'fast' preset for significantly faster encodes with minimal quality loss
  args.push(
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '23',
    '-r', '30',
    '-c:a', 'aac',
    '-b:a', '128k',
  );

  // Overwrite output file
  args.push('-y');

  // Output path
  args.push(outputPath);

  return args;
}

/**
 * Execute FFmpeg and monitor progress
 */
async function executeFFmpeg(
  args: string[],
  outputPath: string,
  totalDuration: number,
  sender: Electron.WebContents
): Promise<boolean> {
  return new Promise((resolve) => {
    const ffmpeg = spawnFFmpeg(args);
    activeExportProcess = ffmpeg;
    activeExportOutputPath = outputPath;

    const startTime = Date.now();
    let lastProgressUpdate = 0;
    let stderrOutput = '';

    ffmpeg.stderr.on('data', (data) => {
      const line = data.toString();
      stderrOutput += line;

      // Log FFmpeg output for debugging
      console.log('[Export] FFmpeg:', line.trim());

      // Parse progress from FFmpeg stderr
      const progress = parseFFmpegProgress(line, totalDuration, startTime);
      if (progress) {
        // Send progress update at most once per second
        const now = Date.now();
        if (now - lastProgressUpdate >= 1000) {
          sender.send('export-progress', progress);
          lastProgressUpdate = now;
        }
      }
    });

    ffmpeg.on('close', (code) => {
      activeExportProcess = null;
      activeExportOutputPath = null;

      if (code === 0) {
        // Success - send final progress update
        sender.send('export-progress', {
          percentComplete: 100,
          currentTime: totalDuration,
          totalDuration,
          estimatedTimeRemaining: 0,
          speed: 1,
        });
        console.log('[Export] FFmpeg completed successfully');
        resolve(true);
      } else {
        console.error('[Export] FFmpeg exited with code:', code);
        console.error('[Export] FFmpeg stderr output:', stderrOutput);
        resolve(false);
      }
    });

    ffmpeg.on('error', (error) => {
      console.error('[Export] FFmpeg spawn error:', error);
      activeExportProcess = null;
      activeExportOutputPath = null;
      resolve(false);
    });
  });
}

/**
 * Parse FFmpeg progress from stderr output
 */
function parseFFmpegProgress(
  line: string,
  totalDuration: number,
  startTime: number
): ExportProgress | null {
  // Look for time= in FFmpeg output (e.g., "time=00:01:23.45")
  const timeMatch = line.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/);
  if (!timeMatch) return null;

  const hours = parseInt(timeMatch[1]);
  const minutes = parseInt(timeMatch[2]);
  const seconds = parseFloat(timeMatch[3]);
  const currentTime = hours * 3600 + minutes * 60 + seconds;

  const percentComplete = Math.min((currentTime / totalDuration) * 100, 100);
  const elapsedTime = (Date.now() - startTime) / 1000; // seconds
  const speed = currentTime / elapsedTime;
  const remainingTime = totalDuration - currentTime;
  const estimatedTimeRemaining = speed > 0 ? remainingTime / speed : 0;

  // Extract frame number if present
  const frameMatch = line.match(/frame=\s*(\d+)/);
  const currentFrame = frameMatch ? parseInt(frameMatch[1]) : undefined;

  return {
    percentComplete,
    currentTime,
    totalDuration,
    currentFrame,
    estimatedTimeRemaining,
    speed,
  };
}

/**
 * Handle export cancellation from renderer
 */
function handleExportCancel(): { success: boolean } {
  if (activeExportProcess) {
    console.log('[Export] Cancelling export...');

    // Kill FFmpeg process
    activeExportProcess.kill('SIGKILL');
    activeExportProcess = null;

    // Delete partial output file
    if (activeExportOutputPath && fs.existsSync(activeExportOutputPath)) {
      try {
        fs.unlinkSync(activeExportOutputPath);
        console.log('[Export] Deleted partial file:', activeExportOutputPath);
      } catch (error) {
        console.error('[Export] Failed to delete partial file:', error);
      }
    }

    activeExportOutputPath = null;

    // Send cancellation confirmation to renderer
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (mainWindow) {
      mainWindow.webContents.send('export-cancelled');
    }

    return { success: true };
  }

  return { success: false };
}
