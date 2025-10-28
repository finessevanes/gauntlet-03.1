/**
 * Thumbnail Generation Service
 * Generates video thumbnails (first frame) using FFmpeg
 * Returns base64-encoded data URL for storage in session
 */

import { executeFFmpegBinary } from './ffmpeg-service';
import * as fs from 'fs';

// Placeholder thumbnail (gray video icon as SVG data URL)
const PLACEHOLDER_THUMBNAIL = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIwIiBoZWlnaHQ9IjE4MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzIwIiBoZWlnaHQ9IjE4MCIgZmlsbD0iIzMzMyIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iNDgiIGZpbGw9IiM2NjYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj7wn46lPC90ZXh0Pjwvc3ZnPg==';

/**
 * Generate thumbnail from video file
 * @param filePath - Absolute path to video file
 * @returns Base64 data URL (JPEG image)
 * @throws Error if FFmpeg fails or file doesn't exist
 */
export async function generateThumbnail(filePath: string): Promise<string> {
  // Validate file exists
  if (!fs.existsSync(filePath)) {
    throw new Error('File not found');
  }

  try {
    // FFmpeg command to extract first frame as JPEG
    // -ss 0.001: Seek to 0.001s (first frame)
    // -i [file]: Input file
    // -vframes 1: Extract 1 frame
    // -vf scale=320:-1: Scale to 320px width, maintain aspect ratio
    // -f image2pipe: Output to pipe
    // -vcodec mjpeg: JPEG codec
    // pipe:1: Output to stdout
    const args = [
      '-ss', '0.001',
      '-i', filePath,
      '-vframes', '1',
      '-vf', 'scale=320:-1',
      '-f', 'image2pipe',
      '-vcodec', 'mjpeg',
      'pipe:1'
    ];

    const result = await executeFFmpegBinary(args, 5000); // 5s timeout for thumbnail

    // Convert buffer to base64
    const base64 = result.stdout.toString('base64');
    const dataUrl = `data:image/jpeg;base64,${base64}`;

    console.log(`[ThumbnailGenerator] Generated thumbnail for ${filePath} (${Math.round(result.stdout.length / 1024)}KB)`);

    return dataUrl;

  } catch (error: any) {
    console.error('[ThumbnailGenerator] Thumbnail generation failed:', error.message);

    // Return placeholder on error instead of throwing
    // This allows import to continue even if thumbnail fails
    return PLACEHOLDER_THUMBNAIL;
  }
}

/**
 * Get placeholder thumbnail (used when generation fails)
 */
export function getPlaceholderThumbnail(): string {
  return PLACEHOLDER_THUMBNAIL;
}
