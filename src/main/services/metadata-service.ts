/**
 * Metadata Extraction Service
 * Extracts video metadata (duration, resolution, framerate, codec) using FFprobe
 */

import { executeFFprobe } from './ffmpeg-service';
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

    // Extract duration (try stream duration first, fallback to format duration)
    let duration = parseFloat(stream.duration);
    if (isNaN(duration) || duration <= 0) {
      // Fallback: try getting duration from format
      const formatArgs = [
        '-v', 'error',
        '-show_entries', 'format=duration',
        '-of', 'json',
        filePath
      ];
      const formatResult = await executeFFprobe(formatArgs, 5000);
      const formatData = JSON.parse(formatResult.stdout);
      duration = parseFloat(formatData.format?.duration);

      if (isNaN(duration) || duration <= 0) {
        throw new Error('Unable to determine video duration');
      }
    }

    // Extract resolution
    const width = parseInt(stream.width);
    const height = parseInt(stream.height);
    if (isNaN(width) || isNaN(height) || width <= 0 || height <= 0) {
      throw new Error('Unable to determine video resolution');
    }

    // Extract frame rate (handle fraction format like "30/1" or "30000/1001")
    let frameRate = 30; // Default fallback
    if (stream.r_frame_rate) {
      const [num, den] = stream.r_frame_rate.split('/').map(parseFloat);
      if (!isNaN(num) && !isNaN(den) && den !== 0) {
        frameRate = num / den;
      }
    }

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
