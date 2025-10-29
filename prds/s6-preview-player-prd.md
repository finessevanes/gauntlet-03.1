# PRD: Preview Player

**Feature**: Preview Player (Story 6) | **Status**: Ready | **Agent**: Pam

---

## Preflight Questionnaire

1. **Smallest end-to-end user outcome?**
   - User clicks Play button, timeline sequence plays with synced audio in the preview player. Playhead moves in real-time, user can pause, seek, and scrub.

2. **Primary user + critical action?**
   - Video editor wants to preview their timeline edits before exporting. Critical actions: play/pause, seek by clicking timeline, scrub by dragging playhead.

3. **Must-have vs nice-to-have?**
   - MUST: Play/pause controls, seek functionality, scrubbing (drag playhead), audio playback, 30fps minimum, timeline sequence playback, library clip preview. NICE: Keyboard shortcuts (spacebar, J/K/L), frame-by-frame stepping, volume control, fullscreen.

4. **Offline/persistence needs?**
   - YES: Playhead position persists in session state. NO: Playback state (playing/paused) does not persist (always starts paused).

5. **Performance targets?**
   - 30fps minimum playback for 1080p H.264 content. Scrubbing updates within 100ms. Audio/video sync maintained (<50ms drift). Memory stable (<200MB delta during playback).

6. **Error/edge cases critical to handle?**
   - Missing source files → show error, no crash. Corrupted frames → skip frame, continue playback. Audio codec mismatch → video plays, audio silent (warn user). Seek past end → snap to end, pause. Playback during export → warn user or block export.

7. **Data model changes?**
   - NO: Playhead position already tracked in session state. Preview source (library clip vs timeline) tracked in UI state only (not persisted).

8. **Service/command APIs needed?**
   - NO new IPC handlers required. Use existing file paths from `Clip` objects. Video playback uses HTML5 `<video>` element (native Chromium support).

9. **React components to create/modify?**
   - New: `PreviewPlayer.tsx` (video player with controls), `PlaybackControls.tsx` (play/pause/seek bar), `VideoCanvas.tsx` (video display). Modify: `Library.tsx` (trigger preview on clip click), `Timeline.tsx` (trigger timeline playback), `MainLayout.tsx` (add preview player to center panel).

10. **Desktop-specific needs?**
    - Audio playback must work (HTML5 audio enabled in Electron). Video codec support (H.264 natively supported in Chromium). File path handling (convert to `file://` URLs for video src). Multi-monitor: preview stays visible when dragging window.

11. **What's explicitly out of scope?**
    - Keyboard shortcuts (spacebar, J/K/L) - defer to post-MVP. Volume control slider - defer to post-MVP. Fullscreen mode - defer to post-MVP. Playback speed control (0.5x, 2x) - defer to post-MVP. Waveform display - defer to post-MVP. Frame-by-frame stepping (arrow keys) - defer to post-MVP.

---

## 1. Summary

Implement a video preview player that plays timeline sequences and library clips with audio support. Users can play/pause, seek by clicking on the timeline or seek bar, and scrub by dragging the playhead. Playback achieves 30fps minimum with synced audio, and updates preview frame in real-time during scrubbing.

---

## 2. Non-Goals / Scope Boundaries

- **Out of Scope:**
  - Keyboard shortcuts (spacebar for play/pause, J/K/L for playback control)
  - Volume control slider (audio plays at 100% system volume)
  - Fullscreen mode (preview stays in center panel)
  - Playback speed control (0.5x, 2x, etc.)
  - Waveform display in timeline
  - Frame-by-frame stepping with arrow keys
  - Loop playback mode
  - Picture-in-picture mode
  - Hardware acceleration settings (use Chromium defaults)

---

## 3. Experience (UX)

### Entry Points

**Timeline Playback (Primary):**
- **Trigger**: User clicks Play button in Timeline controls
- **Location**: Preview player (center panel, ~40% width)

**Library Preview (Secondary):**
- **Trigger**: User clicks on clip card in Library panel
- **Location**: Preview player (center panel)

### User Flow (Happy Path: Timeline Playback)

1. User has 3 clips on timeline (total duration: 2 minutes)
2. User clicks Play button (▶) in Timeline controls
3. Preview player starts playback from current playhead position
4. Video displays in preview panel with audio playing
5. Playhead moves in real-time across timeline (updates every frame)
6. Video transitions automatically between clips (no gaps, seamless)
7. User clicks Pause button (⏸) → playback stops, playhead freezes
8. User clicks on timeline at 1:30 mark → playhead jumps, preview shows frame at 1:30
9. User drags playhead → preview scrubs in real-time (updates within 100ms)
10. User clicks Play again → resumes from current position
11. Playback reaches end of timeline → pauses automatically, playhead at end

### User Flow (Happy Path: Library Preview)

1. User clicks on clip card in Library panel
2. Preview player loads that single clip (ignores timeline)
3. Playhead position resets to 0 (start of clip)
4. Preview shows first frame (paused state)
5. User clicks Play → plays only that library clip from start to end
6. User can seek, scrub, and pause within the library clip
7. Playback ends → pauses at end of clip
8. User clicks different Library clip → switches to new clip, resets playhead

### States

| State | Behavior | Example |
|-------|----------|---------|
| **No Clips** | Empty state: "No video to preview" | Timeline empty, no library clips selected |
| **Paused (Timeline)** | Preview shows frame at current playhead position | Timeline with 3 clips, playhead at 0:30 |
| **Playing (Timeline)** | Video plays with audio, playhead moves, auto-transitions between clips | Playing from 0:00 to 2:00 |
| **Paused (Library Clip)** | Preview shows frame of selected library clip at playhead | Clicked library clip, playhead at 0:15 |
| **Playing (Library Clip)** | Plays only the selected library clip | Playing clip from Library |
| **Scrubbing** | Playhead dragged, preview updates in real-time (no audio) | Dragging playhead with mouse |
| **Seeking** | Clicked timeline/seek bar, playhead jumps, preview updates instantly | Click at 1:30 → preview shows frame at 1:30 |
| **Loading** | Spinner while video loads | Large file buffering |
| **Error (File Missing)** | Error message: "Cannot play: Source file not found" | Source file deleted after import |
| **Error (Corrupted Frame)** | Skip frame, continue playback (log to console) | Corrupted video frame encountered |

### Desktop Considerations

- **Window Resize**: Preview player scales to fit center panel (maintains aspect ratio with letterboxing if needed)
- **Multi-monitor**: Preview stays visible when app window moved between monitors
- **Audio**: Uses system audio output (no custom audio routing)
- **File Paths**: Convert file paths to `file://` URLs for `<video>` src attribute

---

## 4. Functional Requirements

### MUST (Core Preview Functionality)

- [ ] **Preview Player Component**
  - Display video content in center panel (~40% width)
  - Use HTML5 `<video>` element with native controls disabled
  - Maintain aspect ratio (letterbox if clip aspect differs from player)
  - Default background: Black (#000000)

- [ ] **Play/Pause Controls**
  - Play button (▶) starts playback from current playhead position
  - Pause button (⏸) stops playback, playhead freezes
  - Button toggles between Play/Pause based on state
  - Play/Pause state synced with video element

- [ ] **Timeline Sequence Playback**
  - When user clicks Play with timeline clips:
    - Play all timeline clips in sequence (Clip A → Clip B → Clip C)
    - Respect trim points (`inPoint` to `outPoint` for each clip)
    - Auto-transition between clips with no gaps or stuttering
    - Audio continues seamlessly across clips
  - Playback reaches end of timeline → pause automatically
  - Timeline empty → Play button disabled

- [ ] **Library Clip Preview**
  - When user clicks clip in Library panel:
    - Load that clip into preview player
    - Reset playhead to 0
    - Show first frame (paused state)
    - Switch preview source from "timeline" to "library clip"
  - Clicking Play plays only that library clip (not timeline)
  - Clicking different library clip switches preview source

- [ ] **Playhead Sync**
  - Playhead position updates in real-time during playback (every frame)
  - Playhead position synced with video currentTime
  - Timeline playhead moves at consistent speed (no jitter)
  - When paused, playhead position accurate to frame (~0.033s at 30fps)

- [ ] **Seek Functionality**
  - Click on timeline → playhead jumps to clicked position, preview updates instantly
  - Click on seek bar (in preview controls) → playhead jumps, preview updates
  - Seek past end of timeline → snap to end, pause playback
  - Seek to position within clip → video seeks to correct frame

- [ ] **Scrubbing (Drag Playhead)**
  - User drags playhead → preview updates in real-time (within 100ms)
  - Audio muted during scrubbing (video only)
  - Playback pauses automatically when scrubbing starts
  - Release mouse → playback remains paused at scrubbed position
  - Scrubbing across clips → preview updates correctly for each clip

- [ ] **Audio Playback**
  - Audio enabled for all clips (use video element's audio track)
  - Audio synced with video (<50ms drift tolerance)
  - Audio plays during Timeline playback
  - Audio plays during Library clip preview
  - Audio muted during scrubbing (only video updates)

- [ ] **Performance Targets**
  - Playback at minimum 30fps for 1080p H.264 content
  - Scrubbing updates within 100ms
  - Audio/video sync maintained (<50ms drift)
  - Memory stable during playback (<200MB delta)
  - Seek operations complete within 200ms

- [ ] **Clip Transitions**
  - Timeline clips transition seamlessly (no gaps, no black frames)
  - Use `ended` event on video element to trigger next clip
  - Calculate cumulative time for playhead position during transitions
  - Respect trim points for each clip during transitions

- [ ] **Preview Frame Updates**
  - When playhead moved manually (seek, scrub) → preview updates to frame at new position
  - When paused → preview shows current frame (no black screen)
  - When timeline clips reordered → preview updates if currently playing

### SHOULD (Enhancements)

- [ ] **Seek Bar in Preview Panel**
  - Visual seek bar below video (shows playback progress)
  - Click on seek bar → jump to position
  - Draggable handle for scrubbing
  - Timecode display: "00:00 / 02:00" (current / total)

- [ ] **Keyboard Shortcuts**
  - Spacebar: Toggle play/pause (defer to post-MVP)
  - Arrow keys: Frame-by-frame stepping (defer to post-MVP)
  - J/K/L: Reverse/pause/forward (defer to post-MVP)

- [ ] **Volume Control**
  - Volume slider (0-100%) (defer to post-MVP)
  - Mute button (defer to post-MVP)

### Acceptance Gates

**All gates must pass before feature is "done":**

1. **Timeline Playback (Happy Path 1)**
   - [x] Add 3 clips to timeline (total: 2 minutes)
   - [x] Click Play → all clips play in sequence with audio
   - [x] Playhead moves smoothly from 0:00 to 2:00
   - Playback reaches end → pauses automatically
   - Audio synced throughout (no drift)

2. **Library Clip Preview (Happy Path 2)**
   - Click on clip in Library panel
   - Preview shows first frame of that clip
   - Click Play → plays only that clip (not timeline)
   - Audio plays correctly
   - Playback ends → pauses at end of clip

3. **Seek by Clicking Timeline**
   - Timeline has 3 clips, playhead at 0:00
   - Click on timeline at 1:30 mark
   - Playhead jumps to 1:30 instantly
   - Preview shows frame at 1:30 (correct clip, correct position)
   - No playback starts (remains paused)

4. **Scrubbing (Drag Playhead)**
   - Timeline has 3 clips
   - Drag playhead from 0:00 to 1:30
   - Preview updates in real-time (smooth, <100ms)
   - Audio muted during drag
   - Release → playback remains paused at 1:30

5. **Clip Transitions**
   - Timeline with 3 clips: A (0:30), B (0:45), C (0:45)
   - Click Play from start
   - Verify: A plays → auto-transitions to B → auto-transitions to C → pauses at end
   - No gaps, no black frames, no stuttering
   - Audio continuous (no pops or clicks)

6. **Trimmed Clips Playback**
   - Timeline with 3 clips, all trimmed (e.g., Clip A: 0:10-0:40)
   - Click Play
   - Verify: Plays only trimmed portions (respects `inPoint` and `outPoint`)
   - Does NOT play full clip durations

7. **Switch Between Timeline and Library**
   - Click Play on timeline → plays timeline sequence
   - Click on Library clip → switches to library clip preview
   - Click Play → plays only library clip (not timeline)
   - Click on timeline → switches back to timeline playback

8. **Performance: 30fps Minimum**
   - Timeline with 10 clips (30 minutes total)
   - Click Play
   - Monitor frame rate (browser DevTools Performance panel)
   - Verify: Maintains 30fps minimum throughout playback
   - No stuttering or dropped frames

9. **Performance: Scrubbing Latency**
   - Drag playhead rapidly across timeline
   - Verify: Preview updates within 100ms (feels instant)
   - No lag or freezing

---

## 5. Data Model

### No New Data Structures

Preview player uses existing data:

```typescript
// Existing (no changes)
interface Clip {
  id: string;
  filePath: string;              // Used for video src
  inPoint: number;               // Trim start (playback respects this)
  outPoint: number;              // Trim end (playback respects this)
  duration: number;              // Total clip duration
  // ... other fields
}

interface Timeline {
  clips: TimelineClip[];         // Sequence to play
  duration: number;              // Total timeline duration
}

interface Session {
  playheadPosition: number;      // Current playhead position (persists)
  // ... other fields
}
```

### UI State (Ephemeral, Not Persisted)

```typescript
interface PreviewState {
  isPlaying: boolean;            // Playing or paused
  previewSource: 'timeline' | 'library';  // What's being previewed
  previewClipId?: string;        // If library clip, which one
  currentVideoSrc: string;       // Current video element src (file:// URL)
  currentClipIndex: number;      // If timeline, which clip in sequence (0-based)
  videoElement: HTMLVideoElement | null;  // Reference to video element
}
```

---

## 6. Service/Command APIs

### No New IPC Handlers Required

Preview player uses existing data and browser APIs:

- **File Access**: Use `Clip.filePath` converted to `file://` URL for video `src`
- **Video Playback**: HTML5 `<video>` element (native Chromium support)
- **Audio**: HTML5 audio track (enabled by default)
- **Seek**: `videoElement.currentTime = newTime`
- **Play/Pause**: `videoElement.play()` / `videoElement.pause()`

### Browser API Usage

```typescript
// Load video
videoElement.src = `file://${clip.filePath}`;

// Play
await videoElement.play();

// Pause
videoElement.pause();

// Seek
videoElement.currentTime = timeInSeconds;

// Listen for events
videoElement.addEventListener('timeupdate', handleTimeUpdate);
videoElement.addEventListener('ended', handleClipEnded);
videoElement.addEventListener('error', handleVideoError);
```

---

## 7. Components to Create/Modify

### New: `src/components/PreviewPlayer.tsx`

**Purpose**: Main preview player container with video display and controls.

**Responsibilities:**
- Render HTML5 `<video>` element
- Handle play/pause state
- Manage preview source (timeline vs library clip)
- Coordinate clip transitions for timeline playback
- Sync playhead position with video currentTime
- Handle video loading, errors, and buffering states

**Props:**
```typescript
interface PreviewPlayerProps {
  // No props needed (uses global state from sessionStore)
}
```

**State:**
```typescript
const [isPlaying, setIsPlaying] = useState(false);
const [previewSource, setPreviewSource] = useState<'timeline' | 'library'>('timeline');
const [previewClipId, setPreviewClipId] = useState<string | null>(null);
const [currentClipIndex, setCurrentClipIndex] = useState(0);
const [videoError, setVideoError] = useState<string | null>(null);
const [isBuffering, setIsBuffering] = useState(false);
const videoRef = useRef<HTMLVideoElement>(null);
```

---

### New: `src/components/PlaybackControls.tsx`

**Purpose**: Play/pause button and seek bar (part of preview player).

**Responsibilities:**
- Render play/pause button (toggles based on state)
- Render seek bar with draggable handle
- Display timecode (current / total)
- Emit play/pause/seek events to PreviewPlayer

**Props:**
```typescript
interface PlaybackControlsProps {
  isPlaying: boolean;
  currentTime: number;          // Current playback position (seconds)
  duration: number;             // Total duration (seconds)
  onPlayPause: () => void;
  onSeek: (time: number) => void;
}
```

---

### New: `src/components/VideoCanvas.tsx`

**Purpose**: Video display area with aspect ratio handling.

**Responsibilities:**
- Render `<video>` element
- Maintain aspect ratio (letterbox if needed)
- Handle empty state ("No video to preview")
- Handle error state (show error message)
- Handle loading state (show spinner)

**Props:**
```typescript
interface VideoCanvasProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  isEmpty: boolean;             // No clips loaded
  isError: boolean;             // Video error occurred
  errorMessage?: string;
  isBuffering: boolean;
}
```

---

### Modify: `src/components/Library.tsx`

**Purpose**: Trigger library clip preview on click.

**Changes:**
- Update `handleClipClick` to set preview source and load clip in preview player
- Add preview source state to sessionStore: `setPreviewSource(clipId, 'library')`

**Integration:**
```typescript
const handleClipClick = (clipId: string) => {
  // Set selected clip in UI
  setSelectedClip(clipId, 'library');

  // Trigger preview player to load this clip
  setPreviewSource(clipId, 'library'); // New action in sessionStore

  console.log('[Library] Preview clip:', clipId);
};
```

---

### Modify: `src/components/Timeline.tsx`

**Purpose**: Already tracks playhead position; no changes needed for basic playback.

**Existing Functionality:**
- `setPlayheadPosition(time)` updates playhead position
- PreviewPlayer listens to playhead changes and syncs video element

**Potential Change:**
- Add play/pause button in TimelineControls (if not already present)

---

### Modify: `src/components/MainLayout.tsx`

**Purpose**: Add PreviewPlayer to center panel.

**Changes:**
- Import and render `<PreviewPlayer />` in center panel (~40% width)
- Ensure layout adjusts for three panels: Library (20%), Preview (40%), Timeline (bottom 30%)

---

### Modify: `src/store/sessionStore.ts`

**Purpose**: Add preview source state (ephemeral, not persisted).

**Changes:**
```typescript
interface SessionState {
  // ... existing fields

  // Preview state (not persisted)
  previewSource: 'timeline' | 'library';
  previewClipId: string | null;
  isPlaying: boolean;

  // Actions
  setPreviewSource: (clipId: string | null, source: 'timeline' | 'library') => void;
  setIsPlaying: (playing: boolean) => void;
}
```

---

## 8. Integration Points

### HTML5 Video Element

- Chromium-based Electron supports H.264 natively (no additional codecs needed)
- Audio tracks play automatically (no separate audio handling required)
- Video element handles buffering and decoding

### File System

- Convert `Clip.filePath` to `file://` URL for video `src`
- Example: `/Users/user/video.mp4` → `file:///Users/user/video.mp4`
- Electron allows `file://` URLs in renderer process

### Timeline Playback

- PreviewPlayer listens to `playheadPosition` from sessionStore
- When `isPlaying` changes to `true`:
  - Load first timeline clip into video element
  - Start playback from `playheadPosition`
  - Calculate which clip to play based on cumulative durations
  - On `ended` event → load next clip, continue playback

### Library Preview

- When user clicks Library clip:
  - `setPreviewSource(clipId, 'library')` triggers preview switch
  - PreviewPlayer loads that clip's file path
  - Playhead resets to 0
  - Preview shows first frame (paused)

### Scrubbing Integration

- Already implemented in Timeline (dragging playhead)
- PreviewPlayer listens to `playheadPosition` changes
- Update video `currentTime` when playhead moved manually
- Pause playback during scrubbing (automatically handled)

---

## 9. Testing & Acceptance Gates

### Gate 1: Timeline Playback (Happy Path)

- [x] Add 3 clips to timeline (total: 2 minutes)
- [x] Click Play → all clips play in sequence with audio
- [x] Playhead moves smoothly from 0:00 to 2:00
- [x] Playback reaches end → pauses automatically
- [x] Audio synced throughout (no drift)

### Gate 2: Library Clip Preview (Happy Path)

- [x] Click on clip in Library panel
- [x] Preview shows first frame of that clip
- [x] Click Play → plays only that clip (not timeline)
- [x] Audio plays correctly
- [x] Playback ends → pauses at end of clip

### Gate 3: Seek by Clicking Timeline

- [x] Timeline has 3 clips, playhead at 0:00
- [x] Click on timeline at 1:30 mark
- [x] Playhead jumps to 1:30 instantly
- [x] Preview shows frame at 1:30 (correct clip, correct position)
- [x] No playback starts (remains paused)

### Gate 4: Scrubbing (Drag Playhead)

- [x] Timeline has 3 clips
- [x] Drag playhead from 0:00 to 1:30
- [x] Preview updates in real-time (smooth, <100ms)
- [x] Audio muted during drag
- [x] Release → playback remains paused at 1:30

### Gate 5: Clip Transitions

- [x] Timeline with 3 clips: A (0:30), B (0:45), C (0:45)
- [x] Click Play from start
- [x] Verify: A plays → auto-transitions to B → auto-transitions to C → pauses at end
- [x] No gaps, no black frames, no stuttering
- [x] Audio continuous (no pops or clicks)

### Gate 6: Trimmed Clips Playback

- [x] Timeline with 3 clips, all trimmed (e.g., Clip A: 0:10-0:40)
- [x] Click Play
- [x] Verify: Plays only trimmed portions (respects `inPoint` and `outPoint`)
- [x] Does NOT play full clip durations

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

- [x] Drag playhead rapidly across timeline
- [x] Verify: Preview updates within 100ms (feels instant)
- [x] No lag or freezing
---

## 10. Definition of Done

- [ ] **Components Created**: PreviewPlayer, PlaybackControls, VideoCanvas
- [ ] **Components Modified**: Library (click to preview), MainLayout (add preview panel)
- [ ] **State Management**: Preview source and playback state in sessionStore
- [ ] **Timeline Playback**: Plays all clips in sequence with audio
- [ ] **Library Preview**: Clicking library clip loads it for preview
- [ ] **Seek**: Clicking timeline or seek bar jumps playhead and updates preview
- [ ] **Scrubbing**: Dragging playhead updates preview in real-time (<100ms)
- [ ] **Audio**: Plays synced audio during playback (<50ms drift)
- [ ] **Clip Transitions**: Auto-transitions between clips (no gaps)
- [ ] **Trim Respect**: Playback respects trim points (inPoint/outPoint)
- [ ] **Error Handling**: Missing files show error, no crash
- [ ] **Performance**: 30fps minimum, scrubbing <100ms, memory stable
- [ ] **Happy Path Tests**: All 4 happy paths pass
- [ ] **Edge Cases**: All 5 edge cases handled gracefully
- [ ] **Manual Testing**: All acceptance gates verified on macOS
- [ ] **Code Quality**: No console errors, comments on complex playback logic
- [ ] **Integration**: Works with Stories 1-5 (trim, timeline, library)
- [ ] **PR**: Created to `develop` with link to user story, PRD, and test results

---

## 11. Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| **Audio/video sync drift** | Use video element's `timeupdate` event to sync playhead. Monitor audio offset. If drift >50ms, log warning. |
| **Clip transition gaps/black frames** | Preload next clip before current ends. Use `ended` event to switch immediately. Test with short clips (1-2s) to verify no gaps. |
| **Large file buffering delays** | Show loading spinner while video buffers. Use `waiting` and `canplay` events. |
| **Scrubbing performance lag** | Throttle scrub updates to 60fps max (16ms). Use `requestAnimationFrame` for smooth updates. |
| **Memory leak during playback** | Properly remove event listeners. Clear video `src` when switching clips. Test 15min playback session. |
| **Corrupted video crashes app** | Wrap video operations in try-catch. Listen for `error` event on video element. Show error message, do not crash. |
| **File paths with special characters** | Encode file paths properly for `file://` URLs. Test with unicode filenames. |
| **macOS `safe-file://` imports blocked at runtime** | Normalize all imported clip paths to absolute filesystem paths before playback and disable renderer web security so HTML5 video can load local resources. |
| **Multi-clip playback complexity** | Use state machine for playback: IDLE → PLAYING_CLIP_N → TRANSITIONING → PLAYING_CLIP_N+1 → END. |

---

## Authoring Notes

- **Test gates before coding**: They are the specification for acceptance
- **Vertical slice**: Complete end-to-end playback (timeline + library + scrub)
- **HTML5 video element**: Leverage native Chromium support (no custom video decoder)
- **Audio/video sync**: Use video element's `timeupdate` event, not manual timers
- **Clip transitions**: Preload next clip, use `ended` event for seamless transition
- **Performance first**: 30fps minimum, scrubbing <100ms, no dropped frames
- **Error resilient**: Handle missing files, corrupted frames, seek errors gracefully
- **Session state**: Only persist playhead position, not playback state (playing/paused)

---

**Status**: Ready for TODO Generation and Implementation
**Next Steps**: Caleb to create TODO breakdown and implement
