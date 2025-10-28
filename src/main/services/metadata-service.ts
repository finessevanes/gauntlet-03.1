/**
 * Metadata Extraction Service
 * Extracts video metadata (duration, resolution, framerate, codec) using FFprobe
 */

import { executeFFprobe, executeFFmpeg } from './ffmpeg-service';
import * as fs from 'fs';

export interface VideoMetadata {
  duration: number;        // Duration in seconds
  resolution: {
    width: number;
    height: number;
  };
  frameRate: number;       // Frames per second
  codec: string;           // Codec name (e.g., "h264")
  bitrate?: number;        // Bitrate in bits per second (optional)
}

// Supported codecs (H.264 only)
const SUPPORTED_CODECS = ['h264'];

// Unsupported codecs that should be explicitly rejected
const UNSUPPORTED_CODECS = ['hevc', 'h265', 'prores', 'av1', 'vp8', 'vp9'];

/**
 * Parse frame rate from fraction format (e.g., "30/1" or "30000/1001")
 */
function parseFrameRate(frameRateStr: string): number {
  if (!frameRateStr) return 30; // Default fallback

  const [num, den] = frameRateStr.split('/').map(parseFloat);
  if (!isNaN(num) && !isNaN(den) && den !== 0) {
    return num / den;
  }
  return 30;
}

/**
 * Extract duration from stream level metadata
 * @param stream - FFprobe stream object
 * @returns Duration in seconds, or 0 if not available
 */
function extractStreamDuration(stream: any): number {
  const duration = parseFloat(stream.duration);

  if (!isNaN(duration) && duration > 0) {
    // Validate stream duration against frame count
    // Some MOV files report incorrect stream duration, so we check consistency
    const nbFrames = parseInt(stream.nb_read_frames || stream.nb_frames || 0);
    const frameRate = parseFrameRate(stream.r_frame_rate);

    console.log('[Metadata] Checking stream duration:', {
      streamDuration: duration,
      nbFrames,
      frameRate
    });

    if (nbFrames > 0 && frameRate > 0) {
      const expectedDuration = nbFrames / frameRate;
      const ratio = expectedDuration / duration;

      console.log('[Metadata] Duration mismatch check:', {
        expectedDuration,
        ratio,
        isUnreliable: ratio > 2 || ratio < 0.5
      });

      // If calculated duration is significantly different (>2x or <0.5x), stream duration is unreliable
      if (ratio > 2 || ratio < 0.5) {
        console.log('[Metadata] Stream duration REJECTED as unreliable');
        return 0; // Let fallback methods handle it
      }
    }

    console.log('[Metadata] Stream duration ACCEPTED:', duration);
    return duration;
  }
  return 0;
}

/**
 * Extract duration from format level metadata
 * @param filePath - Path to video file
 * @returns Duration in seconds, or 0 if not available
 */
async function extractFormatDuration(filePath: string): Promise<number> {
  try {
    const formatArgs = [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'json',
      filePath
    ];
    const formatResult = await executeFFprobe(formatArgs, 5000);
    const formatData = JSON.parse(formatResult.stdout);
    const duration = parseFloat(formatData.format?.duration);

    if (!isNaN(duration) && duration > 0) {
      console.log('[Metadata] Format duration found:', duration);
      return duration;
    }
  } catch (error) {
    console.log('[Metadata] Format duration extraction failed:', error instanceof Error ? error.message : String(error));
  }
  return 0;
}

/**
 * Extract duration from frame count and frame rate
 * @param stream - FFprobe stream object
 * @returns Duration in seconds, or 0 if not available
 */
function extractDurationFromFrameCount(stream: any): number {
  try {
    const nbFrames = parseInt(stream.nb_read_frames || stream.nb_frames);
    const frameRate = parseFrameRate(stream.r_frame_rate);

    if (!isNaN(nbFrames) && nbFrames > 0 && frameRate > 0) {
      const duration = nbFrames / frameRate;
      console.log('[Metadata] Duration from frame count:', { nbFrames, frameRate, duration });
      return duration;
    }
  } catch (error) {
    console.log('[Metadata] Frame count duration extraction failed:', error instanceof Error ? error.message : String(error));
  }
  return 0;
}

/**
 * Extract duration from FFmpeg info output (most reliable for MOV files)
 * @param filePath - Path to video file
 * @returns Duration in seconds, or 0 if not available
 */
async function extractDurationFromFFmpegInfo(filePath: string): Promise<number> {
  try {
    // Use FFprobe with show_format to get container duration
    const formatArgs = [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      filePath
    ];
    const result = await executeFFprobe(formatArgs, 10000);
    const data = JSON.parse(result.stdout);

    if (data.format && data.format.duration) {
      const duration = parseFloat(data.format.duration);
      if (!isNaN(duration) && duration > 0) {
        console.log('[Metadata] Duration from format metadata:', duration);
        return duration;
      }
    }
  } catch (error) {
    console.log('[Metadata] FFmpeg info duration extraction failed:', error instanceof Error ? error.message : String(error));
  }
  return 0;
}

/**
 * Extract duration by scanning entire file with FFmpeg
 * This is slower but most reliable for problematic files
 * @param filePath - Path to video file
 * @returns Duration in seconds, or 0 if not available
 */
async function extractDurationByScanning(filePath: string): Promise<number> {
  try {
    // Use ffmpeg to scan the entire file without transcoding
    const args = [
      '-v', 'error',
      '-stats',
      '-i', filePath,
      '-f', 'null',
      '-'
    ];
    const result = await executeFFmpeg(args, 30000); // 30 second timeout for scanning

    // Parse duration from stats or stderr
    const statsMatch = result.stderr.match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
    if (statsMatch) {
      const hours = parseInt(statsMatch[1]);
      const minutes = parseInt(statsMatch[2]);
      const seconds = parseFloat(statsMatch[3]);
      const duration = hours * 3600 + minutes * 60 + seconds;
      console.log('[Metadata] Duration from file scan:', duration);
      return duration;
    }
  } catch (error) {
    console.log('[Metadata] File scan duration extraction failed:', error instanceof Error ? error.message : String(error));
  }
  return 0;
}

/**
 * Extract video metadata from file
 * @param filePath - Absolute path to video file
 * @returns VideoMetadata object
 * @throws Error if file doesn't exist, is corrupted, or has unsupported codec
 */
export async function extractMetadata(filePath: string): Promise<VideoMetadata> {
  // Validate file exists
  if (!fs.existsSync(filePath)) {
    throw new Error('File not found');
  }

  // Log file size for debugging
  const fileStats = fs.statSync(filePath);
  console.log('[Metadata] File info:', {
    path: filePath,
    sizeBytes: fileStats.size,
    sizeKB: (fileStats.size / 1024).toFixed(2),
    sizeMB: (fileStats.size / (1024 * 1024)).toFixed(2)
  });

  try {
    // Execute FFprobe to get video stream metadata
    const args = [
      '-v', 'error',                    // Only show errors
      '-select_streams', 'v:0',         // Select first video stream
      '-show_entries',
      'stream=width,height,duration,r_frame_rate,codec_name,bit_rate',
      '-of', 'json',                    // Output as JSON
      filePath
    ];

    const result = await executeFFprobe(args, 10000);

    // Parse JSON output
    const data = JSON.parse(result.stdout);

    if (!data.streams || data.streams.length === 0) {
      throw new Error('No video stream found in file');
    }

    const stream = data.streams[0];

    // Extract codec
    const codec = stream.codec_name?.toLowerCase();
    if (!codec) {
      throw new Error('Unable to determine video codec');
    }

    // Validate codec is supported
    if (UNSUPPORTED_CODECS.includes(codec)) {
      throw new Error(`Unsupported codec: ${codec}. Only H.264 (MP4/MOV) is supported.`);
    }

    if (!SUPPORTED_CODECS.includes(codec)) {
      throw new Error(`Unsupported codec: ${codec}. Only H.264 is supported.`);
    }

    // Extract duration with multiple fallback methods
    let duration = 0;

    // Method 1: Try stream duration
    console.log('[Metadata] Attempting to extract duration...');
    duration = extractStreamDuration(stream);

    // Method 2: Try format duration
    if (duration <= 0) {
      console.log('[Metadata] Stream duration unavailable, trying format duration...');
      duration = await extractFormatDuration(filePath);
    }

    // Method 3: Try FFmpeg info (container-level, most reliable for MOV files)
    if (duration <= 0) {
      console.log('[Metadata] Format duration unavailable, trying FFmpeg info...');
      duration = await extractDurationFromFFmpegInfo(filePath);
    }

    // Method 4: Try frame count calculation
    if (duration <= 0) {
      console.log('[Metadata] FFmpeg info unavailable, trying frame count...');
      duration = extractDurationFromFrameCount(stream);
    }

    // Method 5: Last resort - scan entire file with FFmpeg
    if (duration <= 0) {
      console.log('[Metadata] Frame count unavailable, scanning file (this may take a moment)...');
      duration = await extractDurationByScanning(filePath);
    }

    if (duration <= 0) {
      throw new Error('Unable to determine video duration using any available method');
    }

    console.log('[Metadata] Final duration:', duration);

    // Extract resolution
    const width = parseInt(stream.width);
    const height = parseInt(stream.height);
    if (isNaN(width) || isNaN(height) || width <= 0 || height <= 0) {
      throw new Error('Unable to determine video resolution');
    }

    // Extract frame rate (handle fraction format like "30/1" or "30000/1001")
    const frameRate = parseFrameRate(stream.r_frame_rate);

    // Extract bitrate (optional)
    const bitrate = stream.bit_rate ? parseInt(stream.bit_rate) : undefined;

    return {
      duration,
      resolution: { width, height },
      frameRate,
      codec,
      bitrate
    };

  } catch (error: any) {
    // Handle FFprobe errors
    if (error.message.includes('timed out')) {
      throw new Error('Import timeout. File may be corrupted.');
    }

    if (error.message.includes('Invalid data')) {
      throw new Error('Unable to read file. File may be corrupted.');
    }

    // Re-throw with context
    throw new Error(`Failed to extract metadata: ${error.message}`);
  }
}
