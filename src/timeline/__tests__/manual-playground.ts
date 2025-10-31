/**
 * Manual Testing Playground
 * Run this script to manually test timeline operations
 *
 * Usage: node --loader ts-node/esm src/timeline/__tests__/manual-playground.ts
 * Or just run snippets in your browser console after importing
 */

import { createEmptyTimeline, secondsToTicks, ticksToSeconds } from '../../types/timeline';
import type { Clip } from '../../types/timeline';
import { insertClip } from '../operations/insert';
import { assertTimelineInvariants, validateTimeline } from '../invariants';
import { migrateSessionToTimelineDoc } from '../migration';

console.log('🎬 Timeline Playground\n');

// Test 1: Create empty timeline
console.log('=== Test 1: Create Empty Timeline ===');
const timeline = createEmptyTimeline();
console.log('Created timeline with', timeline.tracks.length, 'track(s)');
console.log('Main track has', timeline.tracks[0].lanes.length, 'lane(s)');
console.log('Main lane has', timeline.tracks[0].lanes[0].clips.length, 'clip(s)');
console.log('✅ Empty timeline created\n');

// Test 2: Insert first clip
console.log('=== Test 2: Insert First Clip ===');
const clip1: Clip = {
  id: 'clip-1',
  sourceId: 'video-1',
  srcStart: 0,
  duration: secondsToTicks(5, 1000), // 5 seconds
  start: 0,
};

let timeline1 = insertClip(timeline, {
  trackId: 'main-video',
  clip: clip1,
});

console.log('Inserted clip-1 (5s duration)');
console.log('Main lane now has', timeline1.tracks[0].lanes[0].clips.length, 'clip(s)');
console.log('First clip starts at:', timeline1.tracks[0].lanes[0].clips[0].start, 'ticks (0 seconds)');
console.log('First clip ends at:', timeline1.tracks[0].lanes[0].clips[0].start + timeline1.tracks[0].lanes[0].clips[0].duration, 'ticks (5 seconds)');

// Validate
const validation1 = validateTimeline(timeline1);
console.log('Validation:', validation1.valid ? '✅ PASS' : '❌ FAIL', validation1.errors);
console.log('');

// Test 3: Insert second clip (append to end)
console.log('=== Test 3: Append Second Clip ===');
const clip2: Clip = {
  id: 'clip-2',
  sourceId: 'video-2',
  srcStart: secondsToTicks(1, 1000), // Start at 1s in source
  duration: secondsToTicks(3, 1000), // 3 seconds
  start: 0, // Will be calculated
};

timeline1 = insertClip(timeline1, {
  trackId: 'main-video',
  clip: clip2,
});

console.log('Inserted clip-2 (3s duration)');
console.log('Main lane now has', timeline1.tracks[0].lanes[0].clips.length, 'clip(s)');

const clips = timeline1.tracks[0].lanes[0].clips;
clips.forEach((c, i) => {
  const startSec = ticksToSeconds(c.start, 1000);
  const endSec = ticksToSeconds(c.start + c.duration, 1000);
  console.log(`  Clip ${i + 1}: ${c.id} | ${startSec}s → ${endSec}s (${ticksToSeconds(c.duration, 1000)}s)`);
});

// Validate
const validation2 = validateTimeline(timeline1);
console.log('Validation:', validation2.valid ? '✅ PASS' : '❌ FAIL', validation2.errors);
console.log('');

// Test 4: Insert clip in the middle (ripple)
console.log('=== Test 4: Insert Clip in Middle (Ripple) ===');
const clip3: Clip = {
  id: 'clip-3',
  sourceId: 'video-3',
  srcStart: 0,
  duration: secondsToTicks(2, 1000), // 2 seconds
  start: 0,
};

timeline1 = insertClip(timeline1, {
  trackId: 'main-video',
  clip: clip3,
  atIndex: 1, // Insert between clip-1 and clip-2
  mode: 'ripple',
});

console.log('Inserted clip-3 (2s duration) at index 1');
console.log('Main lane now has', timeline1.tracks[0].lanes[0].clips.length, 'clip(s)');

const clipsAfterInsert = timeline1.tracks[0].lanes[0].clips;
clipsAfterInsert.forEach((c, i) => {
  const startSec = ticksToSeconds(c.start, 1000);
  const endSec = ticksToSeconds(c.start + c.duration, 1000);
  console.log(`  Clip ${i + 1}: ${c.id} | ${startSec}s → ${endSec}s (${ticksToSeconds(c.duration, 1000)}s)`);
});

console.log('Notice: clip-2 was rippled from 5s to 7s (shifted right by 2s)');

// Validate
const validation3 = validateTimeline(timeline1);
console.log('Validation:', validation3.valid ? '✅ PASS' : '❌ FAIL', validation3.errors);
console.log('');

// Test 5: Migrate old session
console.log('=== Test 5: Migrate Old Session Format ===');
const oldSession = {
  version: '1.0.0',
  clips: [],
  timeline: {
    clips: [
      {
        instanceId: 'old-inst-1',
        clipId: 'old-clip-1',
        inPoint: 0,
        outPoint: 5,
        startTime: 0,
      },
      {
        instanceId: 'old-inst-2',
        clipId: 'old-clip-2',
        inPoint: 1,
        outPoint: 4,
        startTime: 5,
      },
    ],
    duration: 8,
  },
  zoomLevel: 100,
  playheadPosition: 0,
  scrollPosition: 0,
  lastModified: Date.now(),
};

const migratedDoc = migrateSessionToTimelineDoc(oldSession);
console.log('Migrated old session (version 1.0.0) to TimelineDoc (version 2)');
console.log('Timeline has', migratedDoc.tracks[0].lanes[0].clips.length, 'clips');

const migratedClips = migratedDoc.tracks[0].lanes[0].clips;
migratedClips.forEach((c, i) => {
  const startSec = ticksToSeconds(c.start, 1000);
  const endSec = ticksToSeconds(c.start + c.duration, 1000);
  console.log(`  Clip ${i + 1}: ${c.id} | ${startSec}s → ${endSec}s (${ticksToSeconds(c.duration, 1000)}s)`);
});

const validation4 = validateTimeline(migratedDoc);
console.log('Validation:', validation4.valid ? '✅ PASS' : '❌ FAIL', validation4.errors);
console.log('');

console.log('🎉 All manual tests complete!');
