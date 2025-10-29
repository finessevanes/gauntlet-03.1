/**
 * FFmpeg Service
 * Provides wrapper functions for executing FFmpeg and FFprobe commands
 * with proper error handling, timeouts, and output parsing
 */

import { spawn, ChildProcess } from 'child_process';
import ffmpegStatic from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';

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
  return new Promise((resolve, reject) => {
    const process: ChildProcess = spawn(command, args);

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    // Set timeout
    const timer = setTimeout(() => {
      timedOut = true;
      process.kill('SIGTERM');
      reject(new Error(`Command timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    // Collect stdout
    if (process.stdout) {
      process.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });
    }

    // Collect stderr
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

      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`Process exited with code ${code}: ${stderr || stdout}`));
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
  return new Promise((resolve, reject) => {
    const process: ChildProcess = spawn(command, args);

    const stdoutBuffers: Buffer[] = [];
    let stderr = '';
    let timedOut = false;

    // Set timeout
    const timer = setTimeout(() => {
      timedOut = true;
      process.kill('SIGTERM');
      reject(new Error(`Command timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    // Collect stdout as binary buffers
    if (process.stdout) {
      process.stdout.on('data', (data: Buffer) => {
        stdoutBuffers.push(data);
      });
    }

    // Collect stderr as text
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

      const stdout = Buffer.concat(stdoutBuffers);

      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`Process exited with code ${code}: ${stderr}`));
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
