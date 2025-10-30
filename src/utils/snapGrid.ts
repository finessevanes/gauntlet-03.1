/**
 * Snap Grid Utilities (Story 13: Split & Advanced Trim)
 * Provides snap point calculation for frame-precise and interval-based grid snapping
 */

/**
 * Calculate snap points based on timeline configuration and zoom level
 * @param frameRate - Video frame rate (e.g., 30, 60)
 * @param snapMode - Snap grid type: 'frame' | '500ms' | '1s'
 * @param timelineEnd - Total timeline duration in seconds
 * @returns Array of snap point times in seconds
 */
export function calculateSnapPoints(
  frameRate: number,
  snapMode: 'frame' | '500ms' | '1s',
  timelineEnd: number
): number[] {
  const snapPoints: number[] = [];

  switch (snapMode) {
    case 'frame': {
      // Frame-precise snap based on video frame rate
      const frameDuration = 1 / frameRate; // e.g., 1/30 = 0.0333s @ 30fps
      for (let t = 0; t <= timelineEnd; t += frameDuration) {
        snapPoints.push(Math.round(t * 1000000) / 1000000); // Round to avoid floating point errors
      }
      break;
    }
    case '500ms': {
      // Snap to 500ms intervals (half-second)
      for (let t = 0; t <= timelineEnd; t += 0.5) {
        snapPoints.push(Math.round(t * 1000000) / 1000000);
      }
      break;
    }
    case '1s': {
      // Snap to 1-second intervals
      for (let t = 0; t <= timelineEnd; t += 1.0) {
        snapPoints.push(Math.round(t * 1000000) / 1000000);
      }
      break;
    }
  }

  return snapPoints;
}

/**
 * Find the nearest snap point if position is within threshold
 * @param position - Current position in seconds
 * @param snapPoints - Array of snap point times
 * @param threshold - Snap detection range in seconds (default: 0.05s = 50ms ≈ 3px @ 100% zoom)
 * @returns Snapped position or null if no snap point within threshold
 */
export function findNearestSnapPoint(
  position: number,
  snapPoints: number[],
  threshold: number = 0.05
): number | null {
  for (const snapPoint of snapPoints) {
    if (Math.abs(position - snapPoint) < threshold) {
      return snapPoint;
    }
  }
  return null;
}

/**
 * Calculate snap threshold in seconds based on zoom level and pixels per second
 * Snap detection triggers within approximately 3 pixels of snap point
 * @param pixelsPerSecond - Pixels per second at current zoom level
 * @param pixelThreshold - Number of pixels (default: 3)
 * @returns Threshold in seconds
 */
export function calculateSnapThreshold(
  pixelsPerSecond: number,
  pixelThreshold: number = 3
): number {
  return pixelThreshold / pixelsPerSecond;
}

/**
 * Get frame duration in seconds for a given frame rate
 * @param frameRate - Video frame rate (e.g., 30, 60)
 * @returns Frame duration in seconds
 */
export function getFrameDuration(frameRate: number): number {
  return 1 / frameRate;
}

/**
 * Convert time in seconds to frame number based on frame rate
 * @param timeInSeconds - Time in seconds
 * @param frameRate - Video frame rate
 * @returns Frame number (0-indexed)
 */
export function secondsToFrameNumber(timeInSeconds: number, frameRate: number): number {
  return Math.round(timeInSeconds * frameRate);
}

/**
 * Convert frame number to time in seconds based on frame rate
 * @param frameNumber - Frame number (0-indexed)
 * @param frameRate - Video frame rate
 * @returns Time in seconds
 */
export function frameNumberToSeconds(frameNumber: number, frameRate: number): number {
  return frameNumber / frameRate;
}

/**
 * Round time to nearest frame boundary
 * @param timeInSeconds - Time in seconds
 * @param frameRate - Video frame rate
 * @returns Time rounded to nearest frame in seconds
 */
export function snapToFrameBoundary(timeInSeconds: number, frameRate: number): number {
  const frameNumber = Math.round(timeInSeconds * frameRate);
  return frameNumberToSeconds(frameNumber, frameRate);
}

/**
 * Calculate pixels per second based on zoom level
 * Standard: 100px per second at 100% zoom
 * @param zoomLevel - Zoom percentage (100-1000)
 * @returns Pixels per second
 */
export function calculatePixelsPerSecond(zoomLevel: number): number {
  return (zoomLevel / 100) * 100; // Base is 100px/s at 100% zoom
}
