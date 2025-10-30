# PRD: S13 — Split & Advanced Trim

**Feature**: Split & Advanced Trim | **Status**: Ready | **Agent**: Pam

**Story Number**: S13
**Phase**: 5 (Core Features)
**Complexity**: Medium
**Priority**: ✅ REQUIRED
**Depends On**: MVP Timeline (complete)

---

## Preflight Questionnaire

**Answers (from design review)**:

1. **Smallest end-to-end user outcome**: User positions playhead within a clip on timeline, clicks Split, clip divides into two segments with correct durations in export.
2. **Primary user + critical action**: Video editor. Critical action: Split clip at playhead position without re-importing file.
3. **Must-have vs nice-to-have**: Must-have: Split functionality. Nice-to-have: Snap-to-grid, frame count display.
4. **Offline/persistence needs**: Splits saved to session.json (existing session persistence mechanism). No network needed.
5. **Performance targets**: Split operation <50ms. Trim drag <50ms. Snap detection <20ms.
6. **Error/edge cases**: Split at clip start/end (creates 1-frame segment). Split on empty timeline (disabled UI). Snap conflicts (display feedback). Very short segments (1 frame).
7. **Data model changes**: Clip object gains optional `splits` array or split is handled as separate clip entries. Trim points already exist (inPoint/outPoint).
8. **Service/command APIs needed**: None (all UI-driven state management). FFmpeg export logic already handles trim points.
9. **React components to create/modify**: Modify Timeline component. Add TrimUI overlay. Add SnapIndicator. Modify Clip state management.
10. **Desktop-specific needs**: Keyboard shortcut (Cmd/Ctrl+X) handled by Electron main process.
11. **Out of scope**: Undo/redo for splits (deferred to S21). Merge split segments back together (manual delete only).

---

## 1. Summary

Users can split clips at the playhead position and perform frame-precise trimming with optional snap-to-grid. This eliminates the need to re-import the same clip multiple times for tight edits and enables fine-grained control over clip boundaries.

---

## 2. Non-Goals / Scope Boundaries

**Explicitly excluded**:
- ❌ Undo/redo for split/trim operations (scope of S21)
- ❌ Merging split segments back together (users delete unwanted segments manually)
- ❌ Split on multiple clips simultaneously (single-clip focus)
- ❌ Trim history or comparison view
- ❌ Animated split preview (static split line shown)
- ❌ Trim audio independently from video (single A/V sync requirement)
- ❌ Keyboard customization for split shortcut (Cmd/Ctrl+X fixed)

---

## 3. Experience (UX)

### Entry Points

1. **Split Operation**:
   - User positions playhead within a clip by clicking/dragging on timeline
   - "Split" button appears in toolbar (only enabled when playhead is within a clip)
   - Keyboard shortcut: `Cmd+X` (macOS) / `Ctrl+X` (Windows)

2. **Trim Operation** (existing MVP feature, enhanced):
   - User hovers over clip edge → resize cursor (↔) appears
   - Click + drag to adjust in/out point
   - Timecode display shows: `00:10.5 - 00:45.2` (in point - out point)
   - Optional: Frame count `(456 frames @ 30fps)`

3. **Snap-to-Grid**:
   - Checkbox in Timeline controls: "Snap to Grid"
   - Default: ON (snap to frames)
   - Options: 1 second, 500ms, frame-precise
   - Visual feedback: Snap line appears when within 3 pixels of snap point

### Happy Path Flow

**Split Scenario**:
1. User drags playhead to 0:15 within a 1min clip
2. Sees "Split" button enabled in toolbar
3. Clicks Split button (or presses Cmd+X)
4. Clip divides into two segments:
   - Segment 1: 0:00 - 0:15 (15s)
   - Segment 2: 0:15 - 1:00 (45s)
5. Both segments show updated duration labels
6. Export produces video with exact durations in timeline order

**Trim Scenario** (with snap):
1. User hovers over right edge of clip → sees resize cursor
2. Drags left to trim 10 seconds from end
3. Snap line appears at nearest 1-second boundary
4. Releases → clip shrinks, timecode updates to show new out point
5. Playback preview updates in real-time

### States & Feedback

| State | Visual Feedback | User Action |
|-------|-----------------|-------------|
| **Ready to Split** | "Split" button enabled | Click button or press Cmd/Ctrl+X |
| **Cannot Split** | "Split" button disabled, tooltip "Position playhead within a clip" | Position playhead, try again |
| **Trimming** | Cursor changes to ↔, clip outline highlights, snap line appears | Drag to new position |
| **Snap Point Hit** | Snap line turns green, brief highlight | Hold position to see snap effect |
| **Split Complete** | Two clip segments appear, both show duration | N/A (immediate feedback) |
| **Very Short Segment** | Duration shows "1 frame" or "33.3ms" | No action needed (valid) |

### Desktop Considerations

- **Window resize**: Timeline and clip positions recalculate. Snap grid adapts to window zoom.
- **Multi-monitor**: Snap detection uses local timeline coordinates, no issues expected.
- **App close**: Splits saved to session.json automatically (existing mechanism).
- **Drag across monitor boundary**: Handled by browser DOM drag constraints (no special handling).

---

## 4. Functional Requirements

### MUST:

**REQ-4.1: Split Operation**
- User can position playhead within a clip by clicking/dragging on timeline
- "Split" button in toolbar becomes enabled only when playhead is inside a clip
- Clicking "Split" divides the clip into two independent segments
- Segments created at precise playhead position (frame-accurate)
- Both segments inherit clip properties (source file, effects if applicable)
- Both segments can be trimmed, moved, and deleted independently
- Split operation completes in <50ms
- Visual feedback: Immediate clip division visible on timeline

**REQ-4.2: Trim UI Enhancement**
- Hover over clip edge → resize cursor (↔) appears
- Click + drag to adjust in/out point (existing MVP behavior, unchanged)
- Real-time preview updates while dragging (existing, unchanged)
- Timecode display shows in point and out point: `[HH:]MM:SS.mmm - [HH:]MM:SS.mmm`
  - Example: `00:10.5 - 00:45.2` (15s segment)
- Duration display updates in real-time
- Trim drag operation <50ms response time

**REQ-4.3: Frame-Precise Trimming (Default)**
- When snap is OFF (or snap-to-grid disabled), trim points align to video frames
- Frame interval calculated from source video framerate
  - At 30fps: 1 frame = 33.33ms
  - At 60fps: 1 frame = 16.67ms
- Trim endpoint snaps to nearest frame boundary when dragging stops
- User sees visual feedback: small frame tick marks on timeline ruler (optional enhancement)

**REQ-4.4: Snap-to-Grid (Optional)**
- Checkbox: "Snap to Grid" in timeline controls panel
- Default state: Enabled (snap to frames)
- When enabled, trim drag snaps to user-selected grid:
  - Option A: Frame-precise (based on source FPS)
  - Option B: 500ms intervals
  - Option C: 1-second intervals
- Snap detection triggers within 3 pixels of snap point (visual feedback)
- Snap line appears as thin green vertical line when snap point is within range
- On release, trim point snaps to grid (jump effect visible)
- Snap grid recalculates on timeline zoom changes
- Performance: Snap detection <20ms per frame during drag

**REQ-4.5: Snap-to-Clip-Edges (Optional)**
- When snap is enabled, trim point can snap to adjacent clip edge
- Prevents gaps between clips (clips remain butted together)
- Snap line shows green when clip edge snap is detected
- User can drag past snap point to create gap if desired (snap overridable by continued drag)

**REQ-4.6: Edge Cases & Constraints**
- Split at clip start (0:00): Creates segment [empty, 1 frame] + [rest] → First segment deleted, warning shown
- Split at clip end (final frame): Creates [most] + [1 frame empty] → Last segment deleted, warning shown
- Split near start/end: Creates minimal 1-frame segment (valid, no error)
- Trim start point past clip end: UI prevents (cannot drag left edge past right edge)
- Trim end point before clip start: UI prevents
- Very short segments (1 frame) display duration correctly: "0:00.033" or similar
- Cannot split when timeline is empty: Button disabled, tooltip shown

**REQ-4.7: Export Correctness**
- Split clips maintain correct duration on export
- Example: Split 1min clip at 0:15 → export segments as 15s + 45s
- Trim points correctly applied to FFmpeg command
- No audio sync drift after split/trim
- Export completes without crashes

### SHOULD:

**REQ-4.8: Visual Feedback Enhancements**
- Frame tick marks on timeline ruler (sub-second grid visible at high zoom)
- Tooltip on clip showing: `[filename] | [in point] - [out point] | [duration]`
- Split preview line (thin vertical red line at split position before confirming) — optional
- Segment number labels: Split produces "Clip 1.1" and "Clip 1.2" (nice-to-have)

**REQ-4.9: Keyboard Shortcut**
- `Cmd+X` (macOS) / `Ctrl+X` (Windows) splits clip at playhead
- Shortcut disabled when not applicable (playhead not in clip)
- Shortcut cheat sheet in Help menu includes split shortcut

---

## 5. Data Model

### Session State (TypeScript)

```typescript
// Existing Clip interface (MVP) extended
interface Clip {
  id: string;                    // UUID
  filePath: string;              // source file path
  duration: number;              // original clip duration (seconds)
  inPoint: number;               // trim start (seconds) — enhanced from MVP
  outPoint: number;              // trim end (seconds) — enhanced from MVP
  displayDuration: number;       // computed: outPoint - inPoint
}

// NEW: Timeline track structure (for multi-track S12, but clips now exist on tracks)
interface TimelineTrack {
  id: string;
  name: string;                  // "Video", "Overlay", etc.
  clips: Clip[];                 // ordered list of clips on this track
  muted: boolean;                // audio muted for this track
  volume: number;                // -12dB to +12dB (for S15)
  visible: boolean;              // track enabled/disabled
}

interface Timeline {
  tracks: TimelineTrack[];        // currently just 1 track for MVP (S12 adds more)
  zoomLevel: number;
  playheadPosition: number;
  snapEnabled: boolean;           // snap-to-grid enabled
  snapMode: 'frame' | '500ms' | '1s';  // snap grid type
}

interface Session {
  clips: Clip[];                 // library of imported clips
  timeline: Timeline;
  createdAt: string;
  updatedAt: string;
}
```

### Storage

- **File**: `app.getPath('userData')/session.json`
- **Format**: JSON (plain objects, no class instances)
- **Persistence**: On app close via `app.on('before-quit')`
- **Load**: On app launch, auto-restore from session.json

### Validation

- **inPoint**: Must be >= 0, < outPoint, <= original duration
- **outPoint**: Must be > inPoint, <= original duration
- **displayDuration**: Computed as outPoint - inPoint, must be > 0
- **snapMode**: One of 'frame', '500ms', '1s'
- **snapEnabled**: Boolean

---

## 6. Service/Command APIs

### Electron IPC Handlers

No new IPC handlers required for split/trim. All operations are UI-driven state management:
- **Split**: Updates clip state in React (divides one clip into two)
- **Trim**: Updates inPoint/outPoint in React state
- **Snap**: Calculated client-side based on playhead position + timeline metadata

**Existing FFmpeg Export Handler** (`ipcRenderer.invoke('export')`):
- Handles trim points via existing `concat` and `trim` filters
- No changes needed; already supports inPoint/outPoint in clip state

---

## 7. Components to Create/Modify

### React Components

| Component | File | Changes |
|-----------|------|---------|
| **Timeline** | `src/components/Timeline.tsx` | Add split button, trim UI, snap indicator. Render snap grid. Handle playhead/clip hover detection. |
| **TrimOverlay** (NEW) | `src/components/TrimOverlay.tsx` | Modal overlay showing in/out point timecodes during trim drag. Real-time duration display. |
| **SnapIndicator** (NEW) | `src/components/SnapIndicator.tsx` | Vertical snap line with color feedback (gray ready, green snapped). Appears at snap points during trim. |
| **ClipSegment** | `src/components/ClipSegment.tsx` | (Modify) Add timecode display, duration label. Handle split visual state. |
| **TimelineControls** | `src/components/TimelineControls.tsx` | (Modify) Add "Snap to Grid" checkbox, snap mode dropdown (frame / 500ms / 1s). |

### State Management

| State | Location | Update Trigger |
|-------|----------|-----------------|
| `clips[]` | React Context (existing) | Split operation creates new clip. Trim updates inPoint/outPoint. |
| `snapEnabled` | React Context (new) | Checkbox toggle in TimelineControls. |
| `snapMode` | React Context (new) | Dropdown selection. |
| `playheadPosition` | React Context (existing) | User clicks/drags playhead. |

### Electron Main Process

| Handler | File | Purpose |
|---------|------|---------|
| `'split-shortcut'` | `src/main/ipc-handlers/keyboard.ts` | (NEW) Listen for Cmd+X / Ctrl+X global hotkey. Invoke split in renderer. |

---

## 8. Integration Points

### File System
- Session.json read on app launch, written on app close (existing mechanism)
- No new file I/O for split/trim

### FFmpeg
- Export already handles trim points (`trim` filter)
- Split creates two separate clip entries in timeline → export handles as sequential clips
- Example FFmpeg command (existing, unchanged):
  ```bash
  ffmpeg -i input.mp4 \
    -filter_complex "[0:v]trim=10:40[v0];[1:v]trim=0:40[v1]; \
                     [v0][v1]concat=n=2:v=1:a=1[outv][outa]" \
    ...
  ```

### State Management
- Integrate split/trim into existing Zustand/Context store
- Ensure undo/redo system (S21) can hook into split/trim operations later

### Timeline Rendering
- Calculate snap grid based on timeline zoom level and snap mode
- Update playhead position tracking (detect if inside clip)
- Highlight clip boundaries for snap detection

### Keyboard Shortcuts
- Register global hotkey in Electron main process for Cmd+X / Ctrl+X
- Send IPC message to renderer: `webContents.send('split-clip')`
- Renderer listens and invokes split handler if playhead is inside clip

---

## 9. Testing & Acceptance Gates

### Happy Path 1: Split Clip at Playhead

**Flow**:
1. Import 1-minute clip
2. Add to timeline
3. Click playhead at 0:30 (middle of clip)
4. Click "Split" button
5. Verify: Clip divides into two segments (0:30 + 0:30)
6. Export timeline
7. Verify: Exported video is 1 minute total, clip boundaries correct

**Gate**: Split creates two clips with correct durations. Export matches expected duration.

**Pass Criteria**:
- [ ] Split button only enabled when playhead inside clip
- [ ] Split creates two clip objects in state
- [ ] First segment: 0:00 - 0:30 (30s)
- [ ] Second segment: 0:30 - 1:00 (30s)
- [ ] Timeline renders both segments adjacent (no gap)
- [ ] Export completes without crash
- [ ] Exported video plays correctly, duration exact

### Happy Path 2: Trim with Snap-to-Grid

**Flow**:
1. Import 1-minute clip
2. Add to timeline
3. Enable "Snap to Grid" checkbox (snap to 1-second intervals)
4. Hover right edge of clip → resize cursor appears
5. Drag left edge 5 seconds (trim end to 0:55)
6. Snap line appears when 0:55 is reached
7. Release mouse
8. Verify: Clip shrinks, duration shows "55s"

**Gate**: Trim respects snap-to-grid. Visual feedback clear. Duration updates.

**Pass Criteria**:
- [ ] Snap checkbox toggles snap on/off
- [ ] Snap line appears green when snap point within 3px
- [ ] Trim drag <50ms response
- [ ] Duration display updates in real-time
- [ ] Release triggers snap (clip position jumps to grid)
- [ ] Timeline re-renders with updated clip width
- [ ] Export uses trimmed duration (verify file length or frame count)

### Happy Path 3: Keyboard Shortcut Split

**Flow**:
1. Import clip, add to timeline
2. Position playhead at 0:20
3. Press Cmd+X (macOS) or Ctrl+X (Windows)
4. Verify: Clip splits immediately (no button click needed)

**Gate**: Keyboard shortcut works, split executes without UI interaction.

**Pass Criteria**:
- [ ] Shortcut registered globally (works even if app not focused, if applicable)
- [ ] Split executes immediately (< 50ms)
- [ ] Shortcut disabled when playhead not in clip (no beep, silent no-op)
- [ ] Help menu shows shortcut documentation

### Edge Case 1: Split at Clip Start/End

**Flow**:
1. Import 1-minute clip
2. Add to timeline
3. Position playhead at 0:00 (start of clip)
4. Click "Split"
5. Verify: Error dialog shown or first segment removed

**Gate**: No crash. Empty segments handled gracefully.

**Pass Criteria**:
- [ ] Split at 0:00 shows warning: "Cannot split at clip start. Minimum segment: 1 frame."
- [ ] No split occurs (or first segment auto-deleted)
- [ ] Timeline remains stable
- [ ] No console errors

### Edge Case 2: Trim to Minimum Length (1 Frame)

**Flow**:
1. Import 30fps video clip
2. Trim to 1 frame duration (33.3ms)
3. Display duration label

**Gate**: Minimal durations display correctly, export succeeds.

**Pass Criteria**:
- [ ] Duration displays as "0:00.033" or "1 frame"
- [ ] Export handles 1-frame segment without crash
- [ ] Exported file includes 1-frame segment (verifiable with ffprobe)

### Edge Case 3: Split Near Boundaries

**Flow**:
1. Import clip
2. Position playhead at 0:00.033 (1 frame in)
3. Split
4. Verify: Two segments created with minimal first segment

**Gate**: Near-boundary splits work, no rounding errors.

**Pass Criteria**:
- [ ] First segment duration: ~33.3ms (1 frame @ 30fps)
- [ ] Second segment duration: ~29:59.967
- [ ] Both segments export correctly
- [ ] No audio sync drift

### Error Handling 1: Split with No Clips

**Flow**:
1. Open app with empty timeline
2. Try to click "Split" button

**Gate**: Button disabled, clear feedback shown.

**Pass Criteria**:
- [ ] "Split" button disabled (grayed out)
- [ ] Tooltip: "Position playhead within a clip to split"
- [ ] Keyboard shortcut no-op (no beep, no error dialog)

### Error Handling 2: Trim into Invalid State

**Flow**:
1. Drag left clip edge past right edge (attempt invalid trim)

**Gate**: UI prevents invalid state. No partial updates.

**Pass Criteria**:
- [ ] Dragging left edge stops at right edge (cannot pass)
- [ ] No state update if invalid
- [ ] User sees visual constraint (cursor stops, clip boundary locks)
- [ ] No console error

### Performance 1: Split <50ms

**Test**: Split 50 times rapidly, measure operation time.

**Gate**: Each split <50ms.

**Pass Criteria**:
- [ ] Performance profiler shows <50ms per split
- [ ] No UI lag during split
- [ ] Timeline re-renders smoothly

### Performance 2: Trim Drag <50ms

**Test**: Drag clip edge 100 pixels over 1 second, measure response.

**Gate**: UI updates in <50ms intervals.

**Pass Criteria**:
- [ ] Drag updates at 60fps (16.7ms per frame)
- [ ] Snap detection <20ms
- [ ] No jank during drag
- [ ] Scrubbing smooth

### Performance 3: Export with Split/Trimmed Clips

**Test**: Create timeline with 10 split/trimmed segments, export.

**Gate**: Export completes without crash, output duration matches expected.

**Pass Criteria**:
- [ ] Export progress bar appears
- [ ] Export completes in <5 minutes (2min video, 1080p)
- [ ] Exported file duration matches timeline (±1 frame)
- [ ] No FFmpeg errors
- [ ] No memory leaks (Activity Monitor shows stable memory during export)

---

## 10. Definition of Done

**Code**:
- [ ] Split operation implemented in React state (creates two clip objects)
- [ ] Trim UI enhanced with timecode display and real-time duration
- [ ] Snap-to-grid checkbox + dropdown in timeline controls
- [ ] Snap grid calculation based on zoom level and snap mode
- [ ] Keyboard shortcut (Cmd+X / Ctrl+X) registered and functional
- [ ] TrimOverlay component shows in/out points during drag
- [ ] SnapIndicator component renders snap line with color feedback
- [ ] All state changes persisted to session.json (auto-save on close)

**Validation**:
- [ ] All 9 acceptance gates pass (happy paths + edge cases + errors)
- [ ] No console warnings or errors during manual testing
- [ ] Export correctly handles split/trimmed clips (duration matches expected)
- [ ] Performance targets met: Split <50ms, trim drag <50ms, snap <20ms
- [ ] Snap grid accurately aligns to frames / 500ms / 1s based on selection
- [ ] Timeline responsive with 10+ split segments on screen

**Documentation**:
- [ ] README updated with split/trim feature description
- [ ] Keyboard shortcut documented in Help menu
- [ ] UI tooltips describe split button, snap checkbox, trim controls
- [ ] Code comments for complex snap grid calculation logic

**Testing**:
- [ ] Happy path manual test completed and passed
- [ ] Edge cases tested (split at boundaries, minimal segments)
- [ ] Error handling verified (empty timeline, invalid trim)
- [ ] Cross-platform tested on macOS + Windows (best-effort Windows)

---

## 11. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| **Split creates duplicate clip state** | Export fails with wrong FFmpeg command | State management test: verify split creates independent clip objects with unique IDs |
| **Trim points exceed original duration** | FFmpeg errors, export fails | Validation: constrain inPoint/outPoint to [0, originalDuration], prevent drag past boundaries |
| **Snap grid misaligned after zoom** | User frustration, imprecise edits | Recalculate snap grid on every zoom change, test snap accuracy at 100%-1000% zoom |
| **Keyboard shortcut conflicts with system** | User cannot use shortcut | Test on macOS/Windows, register as app-level only (not global, respects OS focus) |
| **1-frame segment causes FFmpeg errors** | Export crashes on minimal clips | Test FFmpeg with 33.3ms segments, handle gracefully if unsupported |
| **Snap-to-grid causes audio sync drift** | Audio out of sync in export | Verify FFmpeg trim filter preserves sample alignment (audio codec typically frame-independent) |
| **Performance: Snap detection during drag** | Jerky UI, poor UX | Cache snap points, calculate once per zoom, use bounding box collision instead of per-pixel |
| **Session persistence loses splits** | User's work lost on app close | Test: save session.json, kill app, relaunch, verify clips restored with correct split state |

---

## 12. Technical Notes

### Snap Grid Calculation

```typescript
function calculateSnapPoints(timeline: Timeline, zoomLevel: number): number[] {
  const snapPoints: number[] = [];

  if (!timeline.snapEnabled) return snapPoints;

  const pixelsPerSecond = zoomLevel * 100; // 100px = 1s @ 100% zoom

  switch (timeline.snapMode) {
    case 'frame': {
      // Assume 30fps source (could be detected from first clip)
      const frameDuration = 1 / 30; // 0.0333s
      const timelineEnd = Math.max(...timeline.clips.map(c => c.outPoint));
      for (let t = 0; t <= timelineEnd; t += frameDuration) {
        snapPoints.push(t);
      }
      break;
    }
    case '500ms':
      for (let t = 0; t <= 120; t += 0.5) {
        snapPoints.push(t);
      }
      break;
    case '1s':
      for (let t = 0; t <= 120; t += 1) {
        snapPoints.push(t);
      }
      break;
  }

  return snapPoints;
}

function isSnapPoint(position: number, snapPoints: number[], threshold: number = 0.05): number | null {
  // threshold: 50ms tolerance for snap (3px @ 100% zoom ≈ 50ms)
  for (const snap of snapPoints) {
    if (Math.abs(position - snap) < threshold) {
      return snap;
    }
  }
  return null;
}
```

### Trim Constraint Logic

```typescript
function validateTrimPoints(clip: Clip): { inPoint: number; outPoint: number } {
  let { inPoint, outPoint } = clip;

  // Constraints
  inPoint = Math.max(0, Math.min(inPoint, clip.duration));
  outPoint = Math.max(0, Math.min(outPoint, clip.duration));

  // inPoint must be < outPoint
  if (inPoint >= outPoint) {
    outPoint = inPoint + (1 / 30); // Minimum 1 frame
  }

  return { inPoint, outPoint };
}
```

### Split Operation

```typescript
function splitClip(clip: Clip, splitPoint: number): [Clip, Clip] {
  const segment1: Clip = {
    ...clip,
    id: uuidv4(),
    outPoint: splitPoint,
  };

  const segment2: Clip = {
    ...clip,
    id: uuidv4(),
    inPoint: splitPoint,
  };

  return [segment1, segment2];
}
```

---

## 13. Reference

**Related Requirements** (from prd-mvp.md):
- REQ-5: Trim Functionality (MVP, baseline)
- REQ-7: Export (must handle split clips)

**Related Stories**:
- S12: Advanced Timeline (multi-track context)
- S14: Advanced Export Options (presets for split/trimmed content)
- S21: Undo/Redo (will manage split history)

**Dependencies**:
- FFmpeg export pipeline (no changes needed, handles trim natively)
- Session persistence (existing app.getPath('userData')/session.json mechanism)
- Electron keyboard shortcuts API

---

## Authoring Notes (for Caleb)

1. **Start with state management**: Ensure split creates two independent clip objects in React state. Use UUID for each segment.
2. **Test snap grid math**: Frame-precise snap is critical. Verify at 30fps, 60fps, and odd frame rates.
3. **Trim constraint logic**: Prevent invalid states (inPoint >= outPoint) at drag time, not on release.
4. **Performance profiling**: Use React DevTools profiler to measure split/trim operations. Target <50ms.
5. **Keyboard shortcut**: Register in Electron main process (`globalShortcut.register()`), send IPC to renderer. Ensure scope is app-level only.
6. **Export verification**: After implementing split, manually export and verify FFmpeg command includes correct `trim` filter arguments.
7. **Test edge cases early**: 1-frame segments, split at boundaries, snap-to-grid accuracy — test before finishing UI polish.

---

**Document Status**: Ready for Caleb Implementation
**Next Step**: Caleb creates TODO (`s13-split-advanced-trim-todo.md`) and begins implementation

---

*End of PRD*
