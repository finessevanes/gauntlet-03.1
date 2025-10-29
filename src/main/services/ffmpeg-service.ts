/**
 * FFmpeg Service
 * Provides wrapper functions for executing FFmpeg and FFprobe commands
 * with proper error handling, timeouts, and output parsing
 */

import { spawn, ChildProcess } from 'child_process';
import ffmpegStatic from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export function resolveBinaryPath(binaryPath: string | null | undefined): string {
  if (!binaryPath) {
    throw new Error('FFmpeg binary path is not available');
  }

  return binaryPath.includes('app.asar')
    ? binaryPath.replace('app.asar', 'app.asar.unpacked')
    : binaryPath;
}

const FFMPEG_PATH = resolveBinaryPath(ffmpegStatic as string | null);
const FFPROBE_PATH = resolveBinaryPath(ffprobeStatic.path);

export interface FFmpegResult {
  stdout: string;
  stderr: string;
}

export interface FFmpegBinaryResult {
  stdout: Buffer;
  stderr: string;
}

/**
 * Execute FFprobe with timeout
 * @param args - Array of FFprobe arguments
 * @param timeoutMs - Timeout in milliseconds (default: 10000)
 * @returns Promise resolving to stdout/stderr
 */
export async function executeFFprobe(
  args: string[],
  timeoutMs: number = 10000
): Promise<FFmpegResult> {
  return executeCommand(FFPROBE_PATH, args, timeoutMs);
}

/**
 * Execute FFmpeg with timeout (text output)
 * @param args - Array of FFmpeg arguments
 * @param timeoutMs - Timeout in milliseconds (default: 10000)
 * @returns Promise resolving to stdout/stderr
 */
export async function executeFFmpeg(
  args: string[],
  timeoutMs: number = 10000
): Promise<FFmpegResult> {
  return executeCommand(FFMPEG_PATH, args, timeoutMs);
}

/**
 * Execute FFmpeg with timeout (binary output for thumbnails)
 * @param args - Array of FFmpeg arguments
 * @param timeoutMs - Timeout in milliseconds (default: 10000)
 * @returns Promise resolving to binary stdout/stderr
 */
export async function executeFFmpegBinary(
  args: string[],
  timeoutMs: number = 10000
): Promise<FFmpegBinaryResult> {
  return executeCommandBinary(FFMPEG_PATH, args, timeoutMs);
}

/**
 * Generic command execution with configurable stdout handling
 * Eliminates code duplication between text and binary output modes
 * @param command - Path to executable
 * @param args - Array of arguments
 * @param timeoutMs - Timeout in milliseconds
 * @param stdoutHandler - Function that processes stdout stream and returns collected output
 * @param finalizeStdout - Function that finalizes stdout value after collection (optional)
 * @returns Promise resolving to stdout/stderr
 */
function executeCommandGeneric<T>(
  command: string,
  args: string[],
  timeoutMs: number,
  stdoutHandler: (stream: NodeJS.ReadableStream) => void,
  finalizeStdout: () => T
): Promise<{ stdout: T; stderr: string }> {
  return new Promise((resolve, reject) => {
    const process: ChildProcess = spawn(command, args);

    let stderr = '';
    let timedOut = false;

    // Set timeout
    const timer = setTimeout(() => {
      timedOut = true;
      process.kill('SIGTERM');
      reject(new Error(`Command timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    // Process stdout with custom handler
    if (process.stdout) {
      stdoutHandler(process.stdout);
    }

    // Collect stderr (always text)
    if (process.stderr) {
      process.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });
    }

    // Handle process completion
    process.on('close', (code: number | null) => {
      clearTimeout(timer);

      if (timedOut) {
        return; // Already rejected
      }

      const stdout = finalizeStdout();

      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`Process exited with code ${code}: ${stderr || String(stdout)}`));
      }
    });

    // Handle process errors (e.g., command not found)
    process.on('error', (error: Error) => {
      clearTimeout(timer);
      reject(new Error(`Failed to execute command: ${error.message}`));
    });
  });
}

/**
 * Execute command with spawn, handling timeout and output collection
 * @param command - Path to executable
 * @param args - Array of arguments
 * @param timeoutMs - Timeout in milliseconds
 * @returns Promise resolving to stdout/stderr
 */
function executeCommand(
  command: string,
  args: string[],
  timeoutMs: number
): Promise<FFmpegResult> {
  let stdout = '';

  return executeCommandGeneric(
    command,
    args,
    timeoutMs,
    (stream) => {
      stream.on('data', (data: Buffer) => {
        stdout += data.toString();
      });
    },
    () => stdout
  );
}

/**
 * Execute command with spawn, handling timeout and binary output collection
 * @param command - Path to executable
 * @param args - Array of arguments
 * @param timeoutMs - Timeout in milliseconds
 * @returns Promise resolving to binary stdout/stderr
 */
function executeCommandBinary(
  command: string,
  args: string[],
  timeoutMs: number
): Promise<FFmpegBinaryResult> {
  const stdoutBuffers: Buffer[] = [];

  return executeCommandGeneric(
    command,
    args,
    timeoutMs,
    (stream) => {
      stream.on('data', (data: Buffer) => {
        stdoutBuffers.push(data);
      });
    },
    () => Buffer.concat(stdoutBuffers)
  );
}

/**
 * Spawn FFmpeg process with properly resolved binary path
 * Use this instead of directly spawning with ffmpeg-static
 * @param args - Array of FFmpeg arguments
 * @returns ChildProcess instance
 */
export function spawnFFmpeg(args: string[]): ChildProcess {
  return spawn(FFMPEG_PATH, args);
}

/**
 * Spawn FFprobe process with properly resolved binary path
 * Use this instead of directly spawning with ffprobe-static
 * @param args - Array of FFprobe arguments
 * @returns ChildProcess instance
 */
export function spawnFFprobe(args: string[]): ChildProcess {
  return spawn(FFPROBE_PATH, args);
}

/**
 * Get FFmpeg binary path
 */
export function getFFmpegPath(): string {
  return FFMPEG_PATH;
}

/**
 * Get FFprobe binary path
 */
export function getFFprobePath(): string {
  return FFPROBE_PATH;
}

/**
 * Convert WebM to MP4 H.264
 * Used for screen recording: MediaRecorder outputs WebM, convert to MP4 for compatibility
 * Story S9: Screen Recording
 * @param inputPath - Path to input WebM file
 * @param outputPath - Path to output MP4 file
 * @param timeoutMs - Timeout in milliseconds (default: 60000)
 * @returns Promise resolving when conversion complete
 */
export async function convertWebmToMp4(
  inputPath: string,
  outputPath: string,
  timeoutMs: number = 60000
): Promise<void> {
  const args = [
    '-i', inputPath,
    '-c:v', 'libx264',      // H.264 video codec
    '-preset', 'medium',     // Encoding preset (balance speed/quality)
    '-crf', '23',            // Constant Rate Factor (23 = good quality)
    '-r', '30',              // Frame rate: 30fps
    '-c:a', 'aac',           // AAC audio codec
    '-b:a', '128k',          // Audio bitrate: 128kbps
    '-y',                    // Overwrite output file if exists
    outputPath
  ];

  console.log('[FFmpegService] Converting WebM to MP4:', {
    input: inputPath,
    output: outputPath,
    timeout: timeoutMs
  });

  try {
    await executeFFmpeg(args, timeoutMs);
    console.log('[FFmpegService] Conversion complete:', outputPath);
  } catch (error) {
    console.error('[FFmpegService] Conversion failed:', error);
    throw new Error(`Failed to convert WebM to MP4: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Calculate histogram for a JPEG frame (simplified color distribution)
 * Returns average RGB values as a simple representation
 * @param frameData - Buffer containing JPEG data
 * @returns Object with R, G, B average values
 */
function calculateHistogram(frameData: Buffer): { r: number; g: number; b: number } {
  // Extract basic color info from JPEG by sampling chunks
  // This is a simplified histogram that checks if content changed
  let rSum = 0, gSum = 0, bSum = 0, samplePoints = 0;

  // Sample every 1000th byte to get rough color distribution
  for (let i = 0; i < frameData.length; i += 1000) {
    if (i + 2 < frameData.length) {
      rSum += frameData[i];
      gSum += frameData[i + 1];
      bSum += frameData[i + 2];
      samplePoints++;
    }
  }

  return {
    r: Math.round(rSum / samplePoints),
    g: Math.round(gSum / samplePoints),
    b: Math.round(bSum / samplePoints),
  };
}

/**
 * Calculate color difference between two histograms
 * Returns a value 0-1 representing how different the colors are
 * @param hist1 - First histogram
 * @param hist2 - Second histogram
 * @returns Normalized difference (0 = same, 1 = completely different)
 */
function colorDifference(
  hist1: { r: number; g: number; b: number },
  hist2: { r: number; g: number; b: number }
): number {
  const rDiff = Math.abs(hist1.r - hist2.r);
  const gDiff = Math.abs(hist1.g - hist2.g);
  const bDiff = Math.abs(hist1.b - hist2.b);
  const totalDiff = rDiff + gDiff + bDiff;
  return Math.min(1, totalDiff / (255 * 3)); // Normalize to 0-1
}

/**
 * Generate intelligent thumbnail for PiP recordings
 * Samples frames at 0ms, 500ms, 1000ms, 1500ms to find when PiP overlay appears
 * Uses color histogram comparison to detect visual changes
 * @param videoPath - Path to input video file
 * @param outputPath - Path where thumbnail JPEG should be saved
 * @param pipThreshold - Minimum color difference to consider PiP visible (0-1, default: 0.15)
 * @param timeoutMs - Timeout in milliseconds (default: 30000)
 * @returns Promise resolving when thumbnail is generated
 */
export async function generatePiPThumbnail(
  videoPath: string,
  outputPath: string,
  pipThreshold: number = 0.15,
  timeoutMs: number = 30000
): Promise<void> {
  const tempDir = os.tmpdir();
  const tempFrames: string[] = [];

  try {
    console.log('[FFmpegService] Generating intelligent PiP thumbnail:', {
      video: videoPath,
      output: outputPath,
      threshold: pipThreshold,
    });

    // Timestamps to sample (in seconds)
    const timestamps = ['0', '0.5', '1.0', '1.5'];

    // Extract frames at each timestamp
    for (const ts of timestamps) {
      const tempFrame = path.join(tempDir, `frame-${ts.replace('.', '-')}-${Date.now()}.jpg`);
      const args = [
        '-i', videoPath,
        '-ss', ts,
        '-vframes', '1',
        '-y',
        tempFrame,
      ];

      await executeFFmpeg(args, timeoutMs / timestamps.length);
      tempFrames.push(tempFrame);
      console.log('[FFmpegService] Extracted frame at', ts, 'seconds');
    }

    // Verify all frames were extracted
    const existingFrames = tempFrames.filter(f => fs.existsSync(f));
    if (existingFrames.length === 0) {
      throw new Error('Failed to extract any frames');
    }

    console.log('[FFmpegService] Extracted', existingFrames.length, 'frames successfully');

    // Read frame data and calculate histograms
    const frameHistograms = existingFrames.map(frame => ({
      path: frame,
      histogram: calculateHistogram(fs.readFileSync(frame)),
    }));

    // Compare each frame to the first frame
    const baselineHistogram = frameHistograms[0].histogram;
    let bestFramePath = frameHistograms[0].path; // Default to first frame
    let maxDifference = 0;

    for (let i = 1; i < frameHistograms.length; i++) {
      const diff = colorDifference(baselineHistogram, frameHistograms[i].histogram);
      console.log(
        '[FFmpegService] Frame difference at',
        timestamps[i],
        'seconds:',
        (diff * 100).toFixed(1) + '%'
      );

      // If difference exceeds threshold, use this frame (PiP detected)
      if (diff > pipThreshold && diff > maxDifference) {
        maxDifference = diff;
        bestFramePath = frameHistograms[i].path;
      }
    }

    console.log('[FFmpegService] Selected frame with', (maxDifference * 100).toFixed(1) + '%', 'difference');

    // Copy selected frame to output path
    fs.copyFileSync(bestFramePath, outputPath);
    console.log('[FFmpegService] Thumbnail saved:', outputPath);
  } catch (error) {
    console.error('[FFmpegService] Error generating PiP thumbnail:', error);
    throw new Error(
      `Failed to generate PiP thumbnail: ${error instanceof Error ? error.message : String(error)}`
    );
  } finally {
    // Cleanup temporary frames
    for (const frame of tempFrames) {
      try {
        if (fs.existsSync(frame)) {
          fs.unlinkSync(frame);
        }
      } catch (error) {
        console.warn('[FFmpegService] Could not cleanup temp frame:', frame, error);
      }
    }
  }
}
