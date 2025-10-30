/**
 * Timecode Utility Functions
 * Formats time values to HH:MM:SS.mmm format
 */

/**
 * Format seconds to HH:MM:SS.mmm timecode
 * @param seconds - Time in seconds (float)
 * @returns Formatted timecode string
 * @example formatTimecode(90.5) => "00:01:30.500"
 */
export function formatTimecode(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const milliseconds = Math.floor((seconds % 1) * 1000);

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
}

/**
 * Format seconds to MM:SS format (for clip durations)
 * @param seconds - Time in seconds (float)
 * @returns Formatted duration string
 * @example formatDuration(90.5) => "01:30"
 */
export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);

  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Calculate pixels per second based on zoom level
 * @param zoomLevel - Zoom percentage (100-1000)
 * @returns Pixels per second
 * @example getPixelsPerSecond(100) => 1
 * @example getPixelsPerSecond(500) => 5
 * @example getPixelsPerSecond(1000) => 10
 */
export function getPixelsPerSecond(zoomLevel: number): number {
  return (zoomLevel / 100) * 1; // Base: 1px/sec at 100%
}

/**
 * Calculate auto-fit zoom level
 * @param containerWidth - Width of timeline container in pixels
 * @param totalDuration - Total timeline duration in seconds
 * @returns Zoom level (100-1000)
 */
export function calculateAutoFitZoom(containerWidth: number, totalDuration: number): number {
  if (totalDuration === 0) return 100;

  const zoom = (containerWidth / totalDuration) * 100;
  return Math.max(100, Math.min(1000, zoom));
}

