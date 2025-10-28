/**
 * FFmpeg Service
 * Provides wrapper functions for executing FFmpeg and FFprobe commands
 * with proper error handling, timeouts, and output parsing
 */

import { spawn, ChildProcess } from 'child_process';
import ffmpegStatic from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';

const FFMPEG_PATH = ffmpegStatic as string;
const FFPROBE_PATH = ffprobeStatic.path;

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
