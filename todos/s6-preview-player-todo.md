# TODO — Preview Player (Story 6)

**Branch**: `feat/preview-player`
**Source**: User story (created by Brenda)
**PRD Reference**: `prds/s6-preview-player-prd.md`
**Owner (Agent)**: Caleb

---

## 0. Pre-Implementation

- [x] Read user story and acceptance criteria thoroughly
- [x] Read PRD: `prds/s6-preview-player-prd.md`
- [ ] **CRITICAL: Validate technology choices in PRD**:
  - [ ] HTML5 `<video>` element can achieve 30fps playback for 1080p H.264 (YES - natively supported in Chromium)
  - [ ] Scrubbing can update within 100ms by setting `videoElement.currentTime` (YES - tested approach)
  - [ ] Audio/video sync maintained using `timeupdate` event (YES - standard approach)
  - [ ] Clip transitions via `ended` event are seamless (YES - requires preload strategy)
  - [ ] `file://` URLs work in Electron renderer (YES - enabled by default)
  - [ ] **Decision: Use HTML5 video element with native Chromium support (simplest, meets all requirements)**
- [ ] Clarify any ambiguities before starting
- [ ] Identify test gates from PRD Section 10 (9 acceptance gates)

---

## 1. Service/Command Layer (Electron IPC)

**No new IPC handlers required** — Preview player uses existing file paths from `Clip` objects and browser APIs.

- [ ] Verified: Existing `Clip.filePath` can be converted to `file://` URL
- [ ] Verified: No FFmpeg calls needed for playback (HTML5 handles decoding)

---

## 2. Data Model & State

### 2.1 Session Store Updates

- [x] Add preview state to `sessionStore.ts`:
  - `isPlaying: boolean` (playback state: playing or paused)
  - `previewSource: 'timeline' | 'library'` (what's being previewed)
  - `previewClipId: string | null` (if library clip, which one)
  - Actions:
    - `setIsPlaying(playing: boolean)`
    - `setPreviewSource(source: 'timeline' | 'library', clipId?: string)`
- [ ] Test: State updates trigger re-renders in preview components

### 2.2 TypeScript Interfaces

- [ ] Review existing interfaces in `types/session.ts`:
  - `Clip` interface has `filePath`, `inPoint`, `outPoint`, `duration` ✅
  - `Timeline` interface has `clips[]`, `duration` ✅
- [ ] No new interfaces needed (using existing data model)

---

## 3. React Components

### 3.1 VideoCanvas Component

**Purpose**: Displays HTML5 `<video>` element with aspect ratio handling and state management.

- [x] Create `src/components/VideoCanvas.tsx`:
  - Props: `videoRef`, `isEmpty`, `isError`, `errorMessage`, `isBuffering`
  - Render `<video>` element with `ref={videoRef}`
  - Native controls disabled (`controls={false}`)
  - Black background (#000)
  - Maintain aspect ratio (use `object-fit: contain` for letterboxing)
  - Empty state: "No video to preview" (gray text, centered)
  - Error state: Show error message (red text, centered)
  - Buffering state: Show loading spinner (centered)
- [ ] Test: All states render correctly (empty, error, buffering, playing)

### 3.2 PlaybackControls Component

**Purpose**: Play/pause button and seek bar with timecode display.

- [x] Create `src/components/PlaybackControls.tsx`:
  - Props: `isPlaying`, `currentTime`, `duration`, `onPlayPause`, `onSeek`
  - Play/Pause button:
    - Displays "▶" when paused, "⏸" when playing
    - Click → calls `onPlayPause()`
    - Disabled when `duration === 0`
  - Seek bar:
    - Visual progress bar (shows `currentTime / duration`)
    - Click on bar → calls `onSeek(clickedTime)`
    - Draggable handle for scrubbing
  - Timecode display: "MM:SS / MM:SS" (current / total)
    - Use existing `formatTimecode()` from `utils/timecode.ts`
- [ ] Test: Play/pause button toggles correctly
- [ ] Test: Seek bar click updates playhead position
- [ ] Test: Timecode displays correctly

### 3.3 PreviewPlayer Component (Main)

**Purpose**: Orchestrates video playback for timeline sequences and library clips.

- [x] Create `src/components/PreviewPlayer.tsx`:
  - **State**:
    - `currentClipIndex: number` (which timeline clip is playing, 0-based)
    - `videoError: string | null` (error message if video fails)
    - `isBuffering: boolean` (true while video loads)
    - `videoRef: useRef<HTMLVideoElement>(null)` (reference to video element)
  - **Zustand subscriptions**:
    - `isPlaying` (from sessionStore)
    - `previewSource` (from sessionStore)
    - `previewClipId` (from sessionStore)
    - `playheadPosition` (from sessionStore)
    - `timeline` (from sessionStore)
    - `clips` (from sessionStore, for library preview)
  - **Render**:
    - `<VideoCanvas>` (video display)
    - `<PlaybackControls>` (play/pause, seek bar)
- [ ] Test: Component renders without crashing
- [ ] Test: Empty timeline shows "No video to preview"

---

## 4. Preview Player Logic

### 4.1 Video Loading

- [ ] Implement `loadVideo(clipId: string)` function:
  - Find clip in `clips` array by `clipId`
  - Convert `clip.filePath` to `file://` URL (handle Windows/macOS paths)
  - Set `videoRef.current.src = file://${clip.filePath}`
  - Handle load errors with `error` event listener
- [ ] Implement `loadTimelineClip(clipIndex: number)` function:
  - Get clip from `timeline.clips[clipIndex]`
  - Find source clip in `clips` array
  - Load video via `loadVideo(clipId)`
  - Seek to `clip.inPoint` (trim start point)
- [ ] Test: Library clip loads when clicked
- [ ] Test: Timeline clip loads when Play clicked

### 4.2 Play/Pause

- [ ] Implement `handlePlayPause()`:
  - If paused → call `videoRef.current.play()`, set `isPlaying = true`
  - If playing → call `videoRef.current.pause()`, set `isPlaying = false`
  - Handle play errors (e.g., file missing)
- [ ] Test: Play button starts playback
- [ ] Test: Pause button stops playback

### 4.3 Seek Functionality

- [ ] Implement `handleSeek(time: number)`:
  - If `previewSource === 'timeline'`:
    - Calculate which clip contains `time` (cumulative durations)
    - Load correct clip via `loadTimelineClip(clipIndex)`
    - Seek to offset within clip: `videoRef.current.currentTime = clip.inPoint + offsetInClip`
  - If `previewSource === 'library'`:
    - Seek to time: `videoRef.current.currentTime = time`
  - Update `playheadPosition` in sessionStore
- [ ] Test: Click on timeline → preview shows correct frame
- [ ] Test: Seek completes within 200ms

### 4.4 Scrubbing (Drag Playhead)

- [ ] Implement scrubbing support:
  - Listen to `playheadPosition` changes from sessionStore
  - When `playheadPosition` changes while paused:
    - Call `handleSeek(playheadPosition)` to update preview
  - Mute audio during scrubbing:
    - Detect scrubbing: rapid `playheadPosition` changes (within 100ms)
    - Set `videoRef.current.muted = true` during scrub
    - Unmute when scrubbing stops
- [ ] Test: Drag playhead → preview updates in real-time (<100ms)
- [ ] Test: Audio muted during scrubbing

### 4.5 Timeline Playback (Clip Transitions)

- [ ] Implement `handleTimeUpdate()` (called on `timeupdate` event):
  - Get current `videoRef.current.currentTime`
  - If `previewSource === 'timeline'`:
    - Check if current clip reached `outPoint`:
      - If yes → load next clip via `loadTimelineClip(currentClipIndex + 1)`
      - If last clip → pause playback, set playhead to end
    - Update `playheadPosition` based on cumulative time
- [ ] Implement `handleClipEnded()` (called on `ended` event):
  - If `previewSource === 'timeline'`:
    - Load next clip in sequence
    - If last clip → pause playback
  - If `previewSource === 'library'`:
    - Pause playback, playhead at end of clip
- [ ] Test: Timeline with 3 clips plays in sequence (A → B → C)
- [ ] Test: No gaps or black frames between clips
- [ ] Test: Playback pauses at end of timeline

### 4.6 Trim Respect

- [ ] Ensure playback respects trim points:
  - When loading timeline clip, seek to `clip.inPoint`
  - In `handleTimeUpdate()`, check if `currentTime >= clip.outPoint`
  - If yes, transition to next clip (or pause if last)
- [ ] Test: Trimmed clip plays only from `inPoint` to `outPoint`
- [ ] Test: Full clip (untrimmed) plays entire duration

---

## 5. Integration

### 5.1 Library Click to Preview

- [ ] Modify `src/components/Library.tsx`:
  - Update `handleClipClick(clipId: string)`:
    - Call `setPreviewSource('library', clipId)`
    - Call `setPlayheadPosition(0)` (reset to start)
    - Call `setIsPlaying(false)` (pause playback)
- [ ] Test: Click Library clip → preview loads that clip (paused at start)

### 5.2 Timeline Play Button

- [ ] Verify `src/components/TimelineControls.tsx` has Play button:
  - If not, add Play/Pause button
  - Click → call `setIsPlaying(!isPlaying)`
  - Icon toggles based on `isPlaying` state
- [ ] Test: Click Play in Timeline → starts timeline playback
- [ ] Test: Click Pause → stops playback, playhead freezes

### 5.3 MainLayout Integration

- [ ] Modify `src/components/MainLayout.tsx`:
  - Replace preview placeholder with `<PreviewPlayer />`
  - Import and render component in center panel
- [ ] Test: Preview player displays in center panel (~80% width)

---

## 6. Error Handling

- [ ] Handle video errors:
  - Listen for `error` event on video element
  - Common errors:
    - File not found (deleted after import)
    - Corrupted video frame
    - Unsupported codec (should not happen for H.264)
  - Display error message: "Cannot play: Source file not found"
  - Do not crash app
- [ ] Handle seek past end:
  - Clamp `playheadPosition` to `[0, timeline.duration]`
  - If user seeks past end → snap to end, pause
- [ ] Test: Delete source file → error message displayed
- [ ] Test: Seek past end → playhead snaps to end

---

## 7. Manual Testing (PRD Section 10 — Acceptance Gates)

### Gate 1: Timeline Playback (Happy Path)

- [ ] Add 3 clips to timeline (total: 2 minutes)
- [ ] Click Play → all clips play in sequence with audio
- [ ] Playhead moves smoothly from 0:00 to 2:00
- [ ] Playback reaches end → pauses automatically
- [ ] Audio synced throughout (no drift)

### Gate 2: Library Clip Preview (Happy Path)

- [ ] Click on clip in Library panel
- [ ] Preview shows first frame of that clip
- [ ] Click Play → plays only that clip (not timeline)
- [ ] Audio plays correctly
- [ ] Playback ends → pauses at end of clip

### Gate 3: Seek by Clicking Timeline

- [ ] Timeline has 3 clips, playhead at 0:00
- [ ] Click on timeline at 1:30 mark
- [ ] Playhead jumps to 1:30 instantly
- [ ] Preview shows frame at 1:30 (correct clip, correct position)
- [ ] No playback starts (remains paused)

### Gate 4: Scrubbing (Drag Playhead)

- [ ] Timeline has 3 clips
- [ ] Drag playhead from 0:00 to 1:30
- [ ] Preview updates in real-time (smooth, <100ms)
- [ ] Audio muted during drag
- [ ] Release → playback remains paused at 1:30

### Gate 5: Clip Transitions

- [ ] Timeline with 3 clips: A (0:30), B (0:45), C (0:45)
- [ ] Click Play from start
- [ ] Verify: A plays → auto-transitions to B → auto-transitions to C → pauses at end
- [ ] No gaps, no black frames, no stuttering
- [ ] Audio continuous (no pops or clicks)

### Gate 6: Trimmed Clips Playback

- [ ] Timeline with 3 clips, all trimmed (e.g., Clip A: 0:10-0:40)
- [ ] Click Play
- [ ] Verify: Plays only trimmed portions (respects `inPoint` and `outPoint`)
- [ ] Does NOT play full clip durations

### Gate 7: Switch Between Timeline and Library

- [ ] Click Play on timeline → plays timeline sequence
- [ ] Click on Library clip → switches to library clip preview
- [ ] Click Play → plays only library clip (not timeline)
- [ ] Click on timeline → switches back to timeline playback

### Gate 8: Performance: 30fps Minimum

- [ ] Timeline with 10 clips (30 minutes total)
- [ ] Click Play
- [ ] Monitor frame rate (browser DevTools Performance panel)
- [ ] Verify: Maintains 30fps minimum throughout playback
- [ ] No stuttering or dropped frames

### Gate 9: Performance: Scrubbing Latency

- [ ] Drag playhead rapidly across timeline
- [ ] Verify: Preview updates within 100ms (feels instant)
- [ ] No lag or freezing

---

## 8. Performance Checklist

- [ ] Playback at 30fps minimum (1080p H.264)
- [ ] Scrubbing updates within 100ms
- [ ] Seek operations within 200ms
- [ ] Audio/video sync <50ms drift
- [ ] Memory stable during playback (<200MB delta)
  - Use Chrome DevTools Memory Profiler
  - Baseline: Memory before playback
  - Test: Play 10 clips (15 minutes)
  - Verify: Memory increase < 200MB
- [ ] No memory leaks (event listeners cleaned up)

---

## 9. Definition of Done

- [ ] All components created: PreviewPlayer, PlaybackControls, VideoCanvas
- [ ] Session store updated with preview state
- [ ] Library component modified (click to preview)
- [ ] MainLayout modified (preview player replaces placeholder)
- [ ] Timeline playback works (plays all clips in sequence with audio)
- [ ] Library preview works (clicking library clip loads it for preview)
- [ ] Seek works (clicking timeline or seek bar jumps playhead and updates preview)
- [ ] Scrubbing works (dragging playhead updates preview in real-time <100ms)
- [ ] Audio plays synced (<50ms drift)
- [ ] Clip transitions seamless (no gaps)
- [ ] Trim points respected (playback honors inPoint/outPoint)
- [ ] Error handling (missing files show error, no crash)
- [ ] All 9 acceptance gates pass
- [ ] Performance targets met (30fps, <100ms scrubbing, memory stable)
- [ ] No console errors
- [ ] Code has comments for complex playback logic
- [ ] Integration works with Stories 1-5 (trim, timeline, library)

---

## 10. PR & Merge

⚠️ **CRITICAL**: DO NOT COMMIT UNTIL USER CONFIRMS ALL TEST GATES PASS

- [ ] Branch created: `feat/preview-player` (already on this branch)
- [ ] All TODO tasks completed
- [ ] User confirms all 9 acceptance gates pass ← WAIT FOR THIS
- [ ] User says "ready to commit" or "looks good"
- [ ] THEN: Remove all debug code (console.log, debugger, commented code)
- [ ] THEN: Commit changes with logical grouping:
  - Commit 1: Session store updates
  - Commit 2: VideoCanvas component
  - Commit 3: PlaybackControls component
  - Commit 4: PreviewPlayer component
  - Commit 5: Library integration
  - Commit 6: MainLayout integration
  - Commit 7: Update TODO as complete
- [ ] Create PR to `develop`:
  - Title: "Preview Player (Story 6)"
  - Body:
    - Summary: "Implements video preview player with timeline playback, library preview, seek, scrubbing, and audio support"
    - Link to user story
    - Link to PRD: `prds/s6-preview-player-prd.md`
    - Test results: All 9 gates passed
    - Performance: 30fps playback, <100ms scrubbing, memory stable
- [ ] PR reviewed and merged to `develop`

---

## Notes

- **HTML5 video is the right choice**: Native Chromium support, 30fps+, audio sync, seek/scrub built-in
- **Clip transitions**: Use `ended` event + preload next clip to avoid gaps
- **Scrubbing**: Throttle updates to 60fps max (16ms) for smooth performance
- **Memory**: Clean up event listeners on unmount, clear video src when switching clips
- **Error resilience**: Wrap video operations in try-catch, listen for `error` event
- **Test gates are the specification**: All 9 gates must pass before "done"
- **Performance first**: 30fps minimum, <100ms scrubbing, no dropped frames
