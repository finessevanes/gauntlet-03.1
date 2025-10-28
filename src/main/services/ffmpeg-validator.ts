/**
 * FFmpeg Validator Module
 * Verifies that FFmpeg binary is available and functional
 */

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { FFmpegValidationResponse } from '../../types/ipc';

/**
 * Validates FFmpeg binary availability and functionality
 *
 * @returns Promise with validation result including path and version
 */
export async function validateFFmpeg(): Promise<FFmpegValidationResponse> {
  try {
    // Get FFmpeg path from ffmpeg-static package
    const ffmpegPath = require('ffmpeg-static');

    // Check if binary exists at the specified path
    if (!ffmpegPath || !existsSync(ffmpegPath)) {
      return {
        valid: false,
        error: 'FFmpeg binary not found. Please reinstall Klippy.',
      };
    }

    // Execute `ffmpeg -version` to verify it's working
    const versionResult = await getFFmpegVersion(ffmpegPath);

    if (!versionResult.success) {
      return {
        valid: false,
        ffmpegPath,
        error: `FFmpeg execution failed: ${versionResult.error}`,
      };
    }

    // Success: FFmpeg is available and working
    return {
      valid: true,
      ffmpegPath,
      version: versionResult.version,
    };

  } catch (error) {
    return {
      valid: false,
      error: `FFmpeg validation error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Executes `ffmpeg -version` and parses the version string
 *
 * @param ffmpegPath Path to FFmpeg binary
 * @returns Promise with version info or error
 */
function getFFmpegVersion(ffmpegPath: string): Promise<{success: boolean; version?: string; error?: string}> {
  return new Promise((resolve) => {
    const process = spawn(ffmpegPath, ['-version']);

    let output = '';
    let errorOutput = '';

    process.stdout.on('data', (data) => {
      output += data.toString();
    });

    process.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    process.on('close', (code) => {
      if (code !== 0) {
        resolve({
          success: false,
          error: errorOutput || `Process exited with code ${code}`,
        });
        return;
      }

      // Parse version from output (first line typically contains version)
      const versionMatch = output.match(/ffmpeg version ([^\s]+)/i);
      const version = versionMatch ? versionMatch[1] : 'unknown';

      resolve({
        success: true,
        version,
      });
    });

    process.on('error', (error) => {
      resolve({
        success: false,
        error: error.message,
      });
    });

    // Timeout after 5 seconds
    setTimeout(() => {
      process.kill();
      resolve({
        success: false,
        error: 'FFmpeg validation timeout',
      });
    }, 5000);
  });
}
