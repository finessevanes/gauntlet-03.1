/**
 * TimelineV2 Demo
 * Demonstration page for the new multitrack timeline
 */

import React, { useEffect } from 'react';
import { TimelineV2 } from './TimelineV2';
import { useTimelineStore } from '../../store/timelineStore';
import { InsertCommand } from '../../timeline/commands/InsertCommand';
import { secondsToTicks } from '../../types/timeline';
import type { Clip } from '../../types/timeline';

export function TimelineDemo() {
  const executeCommand = useTimelineStore((state) => state.executeCommand);
  const doc = useTimelineStore((state) => state.doc);
  const resetTimeline = useTimelineStore((state) => state.resetTimeline);

  // Load demo data on mount
  useEffect(() => {
    loadDemoTimeline();
  }, []);

  const loadDemoTimeline = () => {
    // Reset to empty
    resetTimeline();

    const ticksPerSecond = 1000;

    // Add some demo clips to main track
    const clips: Clip[] = [
      {
        id: 'demo-clip-1',
        sourceId: 'source-video-1',
        srcStart: 0,
        duration: secondsToTicks(5, ticksPerSecond),
        start: 0,
      },
      {
        id: 'demo-clip-2',
        sourceId: 'source-video-2',
        srcStart: secondsToTicks(1, ticksPerSecond),
        duration: secondsToTicks(3, ticksPerSecond),
        start: 0, // Will be calculated
      },
      {
        id: 'demo-clip-3',
        sourceId: 'source-video-3',
        srcStart: 0,
        duration: secondsToTicks(4, ticksPerSecond),
        start: 0, // Will be calculated
        linkedGroupId: 'group-1', // Linked clip example
      },
    ];

    // Insert clips using commands
    clips.forEach((clip) => {
      executeCommand(
        new InsertCommand({
          trackId: 'main-video',
          clip,
          mode: 'ripple',
        })
      );
    });

    console.log('[TimelineDemo] Loaded demo timeline with 3 clips');
  };

  const addNewClip = () => {
    const newClip: Clip = {
      id: `clip-${Date.now()}`,
      sourceId: `source-${Date.now()}`,
      srcStart: 0,
      duration: secondsToTicks(2, 1000),
      start: 0,
    };

    executeCommand(
      new InsertCommand({
        trackId: 'main-video',
        clip: newClip,
        mode: 'ripple',
      })
    );
  };

  const addOverlayTrack = () => {
    // TODO: Implement track creation
    console.log('[TimelineDemo] Add overlay track - not yet implemented');
  };

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      {/* Top Toolbar */}
      <div className="h-16 bg-gray-800 border-b border-gray-700 flex items-center gap-4 px-4">
        <h1 className="text-xl font-bold text-white">
          Multitrack Timeline Demo
        </h1>

        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={loadDemoTimeline}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
          >
            Reset Demo
          </button>

          <button
            onClick={addNewClip}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
          >
            + Add Clip
          </button>

          <button
            onClick={addOverlayTrack}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors"
          >
            + Add Overlay Track
          </button>
        </div>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-hidden">
        <TimelineV2 />
      </div>

      {/* Info Panel */}
      <div className="h-32 bg-gray-800 border-t border-gray-700 p-4 overflow-auto">
        <h3 className="text-sm font-semibold text-white mb-2">
          Current Timeline State
        </h3>
        <pre className="text-xs text-gray-300 font-mono">
          {JSON.stringify(
            {
              tracks: doc.tracks.length,
              totalClips: doc.tracks.reduce(
                (sum, t) => sum + t.lanes.reduce((s, l) => s + l.clips.length, 0),
                0
              ),
              playhead: doc.selection?.playhead || 0,
              markers: doc.markers.length,
            },
            null,
            2
          )}
        </pre>
      </div>
    </div>
  );
}
