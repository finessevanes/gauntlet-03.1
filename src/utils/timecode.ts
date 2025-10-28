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

/**
 * Log the duration of all clips in the timeline
 * @param clips - Array of clip objects with id, filename, inPoint, and outPoint
 * @param timeline - Timeline object with clips array (clip IDs) and duration
 * @example logTimelineClipDurations(clips, timeline)
 */
export function logTimelineClipDurations(
  clips: Array<{ id: string; filename: string; inPoint: number; outPoint: number }>,
  timeline: { clips: string[]; duration: number }
): void {
  console.group('[Timeline] Clip Durations');
  console.log(`Total clips on timeline: ${timeline.clips.length}`);
  console.log(`Total timeline duration: ${formatTimecode(timeline.duration)} (${timeline.duration.toFixed(2)}s)`);
  console.table(
    timeline.clips.map((clipId, index) => {
      const clip = clips.find((c) => c.id === clipId);
      if (!clip) {
        return {
          '#': index + 1,
          'Clip ID': clipId,
          'Filename': 'NOT FOUND',
          'Duration': '-',
          'Seconds': '-',
        };
      }
      const effectiveDuration = clip.outPoint - clip.inPoint;
      return {
        '#': index + 1,
        'Clip ID': clip.id.substring(0, 8) + '...',
        'Filename': clip.filename,
        'In': formatTimecode(clip.inPoint),
        'Out': formatTimecode(clip.outPoint),
        'Duration': formatTimecode(effectiveDuration),
        'Seconds': effectiveDuration.toFixed(2),
      };
    })
  );
  console.groupEnd();
}
