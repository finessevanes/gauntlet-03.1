# TODO — S13: Split & Advanced Trim

**Branch**: `feat/split-advanced-trim`
**Source**: User Story S13 (from USER_STORIES.md)
**PRD Reference**: `prds/s13-split-advanced-trim-prd.md`
**Owner (Agent)**: Caleb

---

## 0. Pre-Implementation

- [ ] Read user story S13 (USER_STORIES.md lines 189-225)
- [ ] Read `prds/s13-split-advanced-trim-prd.md` thoroughly
- [ ] Understand clip data model: `Clip { id, filePath, duration, inPoint, outPoint }`
- [ ] Verify FFmpeg export already supports `trim` filter (existing MVP feature)
- [ ] Validate session.json persistence mechanism (existing, unchanged)
- [ ] Clarify technology choices:
  - [ ] React state management: Use existing Context API (not Zustand if not already in place)
  - [ ] Snap grid calculation: Client-side only (no IPC needed)
  - [ ] Keyboard shortcut: Electron `globalShortcut` in main process
- [ ] List test gates from PRD Section 9 (9 gates total)

---

## 1. Service/Command Layer (Electron IPC)

No new IPC handlers required for split/trim operations. All state changes are React-local.

### Existing Handler Check

- [ ] Verify `ipcRenderer.invoke('export')` already handles:
  - [ ] Reading clip `inPoint` and `outPoint` from state
  - [ ] Building FFmpeg `trim` filter arguments
  - [ ] Sequencing clips with `concat` filter
  - Test: Run existing export with trimmed clip, verify duration in output

### Keyboard Shortcut Handler (NEW)

- [ ] Implement global keyboard shortcut in `src/main/index.ts` (or main process entry):
  ```typescript
  import { globalShortcut } from 'electron';

  function registerShortcuts() {
    globalShortcut.register('CmdOrCtrl+X', () => {
      mainWindow.webContents.send('split-clip-shortcut');
    });
  }
  ```
- [ ] Test: Press Cmd+X → IPC message received in renderer
- [ ] Test: Shortcut disabled when app not focused (OS-level, default behavior)
- [ ] Add shortcut unregister on app quit to prevent memory leak
  - Test: Kill app, verify shortcut no longer triggers globally

---

## 2. React Components & State

### 2.1: State Management

- [ ] Create/modify React Context for timeline state (or use existing store if available):
  ```typescript
  interface TimelineState {
    clips: Clip[];
    playheadPosition: number;
    snapEnabled: boolean;
    snapMode: 'frame' | '500ms' | '1s';
  }
  ```
  - [ ] Add `snapEnabled: boolean` (default true)
  - [ ] Add `snapMode: 'frame' | '500ms' | '1s'` (default 'frame')
  - Test: State updates trigger re-render, localStorage/session.json persisted

- [ ] Implement split operation (add to context/store):
  ```typescript
  function splitClip(clips: Clip[], clipId: string, splitPoint: number): Clip[] {
    // 1. Find clip by ID
    // 2. Validate splitPoint is within clip (inPoint < splitPoint < outPoint)
    // 3. Create two segments with unique IDs
    // 4. Return new clips array with segments in original order
  }
  ```
  - [ ] Test: Split 1min clip at 0:30 → two 30s clips created
  - [ ] Test: Both clips have unique IDs, same filePath

- [ ] Implement trim operation (enhance existing, if needed):
  - [ ] Ensure `updateClip({ id, inPoint, outPoint })` validates constraints
  - [ ] Validate: inPoint >= 0, outPoint <= duration, inPoint < outPoint
  - Test: Attempt invalid trim (inPoint > outPoint) → no state change

- [ ] Implement snap grid calculation (utility function):
  ```typescript
  function calculateSnapPoints(
    timeline: TimelineState,
    zoomLevel: number
  ): number[] {
    // Return array of snap times (seconds) based on snapMode
    // See PRD Section 12 for math
  }

  function findSnapPoint(
    position: number,
    snapPoints: number[],
    threshold: number = 0.05 // 50ms
  ): number | null {
    // Return snapped position or null if no snap
  }
  ```
  - [ ] Test: Snap calculation at 30fps produces frame-aligned points
  - [ ] Test: Snap threshold accurate within 3px (measure with timeline ruler)

### 2.2: Timeline Component (Modify)

- [ ] Add "Split" button to toolbar:
  - [ ] Button text: "Split"
  - [ ] Enabled only if playhead is inside a clip (calculate: inPoint < playheadPosition < outPoint)
  - [ ] Click handler: Invoke `splitClip()` from context
  - [ ] Tooltip: "Split clip at playhead (Cmd+X / Ctrl+X)"
  - Test: Button disabled on empty timeline, enables when playhead in clip

- [ ] Add playhead position detection:
  - [ ] On mousemove/click in timeline, calculate which clip (if any) contains playhead
  - [ ] Update split button enabled state based on detection
  - Test: Move playhead in/out of clip → button toggles

- [ ] Enhance clip rendering with timecode display:
  - [ ] Show in/out point timecodes: `[HH:]MM:SS.mmm - [HH:]MM:SS.mmm`
  - [ ] Update duration label in real-time during trim drag
  - [ ] Example display: `00:10.5 - 00:45.2 | 34.7s`
  - Test: Timecode updates as clip is trimmed

- [ ] Add snap grid visualization:
  - [ ] When snap is enabled, render vertical tick marks on timeline ruler
  - [ ] Tick spacing = snap interval (frames, 500ms, or 1s)
  - [ ] Recalculate ticks on zoom change
  - Test: Zoom in/out → tick marks scale appropriately

- [ ] Integrate snap feedback during trim drag:
  - [ ] Monitor trim drag, calculate snap points in real-time
  - [ ] Show snap line (thin green vertical) when within 3px of snap point
  - [ ] On mouse release, snap to nearest grid point
  - Test: Drag trim edge → snap line appears within 3px, snaps on release

### 2.3: TimelineControls Component (Modify)

- [ ] Add "Snap to Grid" checkbox:
  - [ ] Label: "Snap to Grid"
  - [ ] Default: checked (enabled)
  - [ ] Handler: Toggle `snapEnabled` in context
  - Test: Click checkbox → snap behavior toggles on/off

- [ ] Add snap mode dropdown:
  - [ ] Options: "Frame-Precise", "500ms", "1 Second"
  - [ ] Default: "Frame-Precise"
  - [ ] Visible only when snap is enabled
  - [ ] Handler: Update `snapMode` in context
  - Test: Change snap mode → grid recalculates, display updates

### 2.4: TrimOverlay Component (NEW)

Create a UI overlay that appears during trim drag operations.

- [ ] Component: Display current in/out point timecodes
  - [ ] Format: `[HH:]MM:SS.mmm - [HH:]MM:SS.mmm`
  - [ ] Update in real-time during drag
  - [ ] Position: Near trim handle or center of timeline
  - [ ] Disappear on drag end
  - Test: Start trim drag → overlay appears with correct timecodes
  - Test: Drag → timecodes update in real-time (60fps smooth)

### 2.5: SnapIndicator Component (NEW)

Create a visual indicator for snap points during trim/split.

- [ ] Component: Vertical line at snap point position
  - [ ] Color: Gray (standby), green (snapped/within threshold)
  - [ ] Width: Thin, 1-2px
  - [ ] Height: Full timeline height
  - [ ] Visibility: Show only during drag operation
  - [ ] Position: Updated in real-time, X = snap point on canvas
  - Test: Drag near snap point → line appears green
  - Test: Move away → line disappears or turns gray

### 2.6: ClipSegment Component (Modify)

- [ ] Add duration display (existing MVP, verify working):
  - [ ] Show computed duration: `outPoint - inPoint`
  - [ ] Format: `MM:SS` or `HH:MM:SS` for long clips
  - [ ] Update in real-time during trim
  - Test: After split, both segments show correct duration

- [ ] Add visual state for split (optional):
  - [ ] Highlight segment number: "Clip 1.1", "Clip 1.2" (nice-to-have)
  - [ ] Or just verify two clips appear adjacent in timeline

---

## 3. Data Model & Persistence

### 3.1: Clip Interface Extension

- [ ] Ensure Clip interface includes `inPoint` and `outPoint`:
  ```typescript
  interface Clip {
    id: string;
    filePath: string;
    duration: number;        // original clip duration
    inPoint: number;         // trim start (seconds)
    outPoint: number;        // trim end (seconds)
    // displayDuration computed as outPoint - inPoint
  }
  ```
  - [ ] Verify type definitions in React state management

### 3.2: Session Persistence

- [ ] Verify session.json save includes split clips:
  - [ ] On app close, save all clips with inPoint/outPoint
  - [ ] Test: Create splits → close app → relaunch → splits restored
  - File: `app.getPath('userData')/session.json`

- [ ] Verify session.json save includes snap settings:
  - [ ] Save `snapEnabled` and `snapMode` state
  - [ ] Test: Enable snap mode 1s → close app → relaunch → snap mode is 1s

- [ ] Validate on load:
  - [ ] On app launch, load session.json and restore clip state
  - [ ] Validate inPoint/outPoint constraints (in case of corruption)
  - [ ] Log error if validation fails, offer "Start Fresh" option

---

## 4. Integration

### 4.1: Timeline-Trim Drag Integration

- [ ] Modify existing trim drag handler:
  - [ ] On `mousedown` at clip edge: start drag, store initial position
  - [ ] On `mousemove`: calculate new trim point, update state (throttle to 60fps)
  - [ ] Simultaneously:
    - [ ] Calculate snap grid (if enabled)
    - [ ] Show TrimOverlay with current timecodes
    - [ ] Show SnapIndicator if near snap point
    - [ ] Update ClipSegment display in real-time
  - [ ] On `mouseup`: snap to grid (if enabled), finalize state
  - Test: Drag trim edge 5 times → no lag, all UI updates smooth

### 4.2: Playhead-Clip Intersection Detection

- [ ] Add utility function to detect playhead position:
  ```typescript
  function getClipAtPlayhead(
    clips: Clip[],
    playheadPosition: number,
    zoomLevel: number
  ): Clip | null {
    // Return clip if playheadPosition falls within clip bounds (on timeline, not in library)
  }
  ```
  - [ ] Test: Playhead at 0:15 in 1min clip → returns that clip
  - [ ] Test: Playhead before/after clip → returns null

- [ ] Update split button enabled state:
  - [ ] Hook: On playhead position change, recalculate clip intersection
  - [ ] Set `splitButtonEnabled = getClipAtPlayhead(...) !== null`
  - Test: Move playhead in/out of clip → button toggles

### 4.3: Keyboard Shortcut Integration

- [ ] Listen for IPC message from main process:
  ```typescript
  ipcRenderer.on('split-clip-shortcut', () => {
    const clipAtPlayhead = getClipAtPlayhead(...);
    if (clipAtPlayhead) {
      splitClip(clipAtPlayhead.id, playheadPosition);
    }
  });
  ```
  - [ ] Test: Press Cmd+X with playhead in clip → split executes
  - [ ] Test: Press Cmd+X with playhead outside clip → no-op (silent)

### 4.4: Export Integration

- [ ] Verify FFmpeg export handles split clips:
  - [ ] Existing export handler should already support clips with inPoint/outPoint
  - [ ] Each split segment is a separate clip entry in state
  - [ ] FFmpeg command should concatenate clips with trim filters
  - Test: Create 1min clip, split at 0:30, export → verify 2x 30s segments in output

---

## 5. Manual Testing

**Reference testing gates from PRD Section 9.**

### Happy Path 1: Split Clip at Playhead

- [ ] **Setup**: Import 1-minute H.264 MP4 clip, add to timeline
- [ ] **Test Flow**:
  1. Click timeline at 0:30 (midpoint)
  2. Verify: "Split" button enabled
  3. Click "Split" button
  4. Verify: Clip divides into two segments on timeline
  5. Export and verify output is 1 minute total, boundaries correct
- [ ] **Expected Result**: Two segments (30s + 30s), export matches
- [ ] **Pass**: Yes / No (if No, document blocker)

### Happy Path 2: Trim with Snap-to-Grid (1 second)

- [ ] **Setup**: Import 1-minute clip, add to timeline, enable snap (1s mode)
- [ ] **Test Flow**:
  1. Hover right edge of clip → resize cursor (↔)
  2. Drag left 5 seconds (toward 0:55)
  3. Observe snap line when near 1-second boundary
  4. Release mouse
  5. Verify clip shrinks to 55 seconds
  6. Check timecode display: `00:00 - 00:55`
- [ ] **Expected Result**: Clip trimmed to 55s, snap line appeared, timecode updated
- [ ] **Pass**: Yes / No

### Happy Path 3: Keyboard Shortcut Split

- [ ] **Setup**: Import clip, add to timeline
- [ ] **Test Flow**:
  1. Click timeline at 0:20
  2. Press Cmd+X (macOS) or Ctrl+X (Windows)
  3. Verify: Clip splits immediately (no UI interaction)
- [ ] **Expected Result**: Split executes via keyboard shortcut
- [ ] **Pass**: Yes / No

### Edge Case 1: Split at Clip Start (0:00)

- [ ] **Setup**: Import 1-minute clip, add to timeline
- [ ] **Test Flow**:
  1. Click timeline at 0:00 (start of clip)
  2. Click "Split" button
  3. Observe error message or first segment removal
- [ ] **Expected Result**: Warning shown OR first segment deleted, no crash
- [ ] **Pass**: Yes / No

### Edge Case 2: Trim to 1 Frame (@ 30fps)

- [ ] **Setup**: Import 30fps video, add to timeline
- [ ] **Test Flow**:
  1. Drag right edge of clip far to the left
  2. Trim to minimum duration (1 frame = 33.3ms)
  3. Check duration display
- [ ] **Expected Result**: Duration shows "0:00.033" or "1 frame", no crash
- [ ] **Pass**: Yes / No

### Edge Case 3: Split Near Boundaries

- [ ] **Setup**: Import clip, add to timeline
- [ ] **Test Flow**:
  1. Position playhead at 0:00.033 (1 frame in @ 30fps)
  2. Split
  3. Verify first segment duration
- [ ] **Expected Result**: First segment ≈33.3ms, no rounding error
- [ ] **Pass**: Yes / No

### Error Handling 1: Split with Empty Timeline

- [ ] **Setup**: Open app, do not import any clips
- [ ] **Test Flow**:
  1. Observe "Split" button in toolbar
  2. Try to click it (if enabled, attempt anyway)
- [ ] **Expected Result**: Button disabled, tooltip: "Position playhead within a clip to split"
- [ ] **Pass**: Yes / No

### Error Handling 2: Attempt Invalid Trim (left edge > right edge)

- [ ] **Setup**: Import clip, add to timeline
- [ ] **Test Flow**:
  1. Drag left edge of clip past right edge
  2. Observe UI behavior
- [ ] **Expected Result**: Drag stops at right edge, clip outline locks, no state corruption
- [ ] **Pass**: Yes / No

### Performance 1: Split <50ms

- [ ] **Test**: Split same clip 10 times rapidly, measure operation time
- [ ] **Tool**: Use React DevTools Profiler or browser DevTools
- [ ] **Expected Result**: Each split <50ms
- [ ] **Pass**: Yes / No

### Performance 2: Trim Drag <50ms Response

- [ ] **Test**: Drag clip edge, observe response latency
- [ ] **Expected Result**: Drag updates at ~60fps (16.7ms per frame), no visible lag
- [ ] **Pass**: Yes / No

### Performance 3: Export with 10 Split Segments

- [ ] **Setup**: Create 1-minute clip, split into 10 segments
- [ ] **Test Flow**:
  1. Click "Export"
  2. Choose save location
  3. Monitor progress
  4. Verify export completes
- [ ] **Expected Result**: Export completes without crash, output duration = 1 minute
- [ ] **Pass**: Yes / No

### No Console Errors

- [ ] Open DevTools (F12) → Console tab
- [ ] Run all tests above
- [ ] **Expected Result**: No red error messages (warnings OK)
- [ ] **Pass**: Yes / No

---

## 6. Performance Validation

**From PRD Non-Functional Requirements:**

- [ ] **Split operation**: <50ms (measured with DevTools Profiler)
- [ ] **Trim drag response**: <50ms per frame update (target 60fps = 16.7ms)
- [ ] **Snap detection**: <20ms during drag
- [ ] **Export with splits**: <5 minutes for 2min 1080p video
- [ ] **Memory stability**: No leaks during 50+ split/trim operations

**Test Procedure**:
1. Open Chrome DevTools → Performance tab
2. Start recording
3. Perform operation (split, drag, etc.)
4. Stop recording
5. Check operation duration (should be <50ms for split)
6. Repeat for trimming

**Pass Criteria**:
- [ ] All operations within targets
- [ ] No 60fps frame drops
- [ ] Memory does not grow unbounded

---

## 7. Definition of Done

**Code Complete**:
- [ ] Split operation implemented, creates two independent clip objects
- [ ] Trim UI shows in/out timecodes, updates real-time
- [ ] Snap-to-grid checkbox and dropdown in timeline controls
- [ ] Snap grid calculation working (frame-precise, 500ms, 1s modes)
- [ ] Keyboard shortcut (Cmd+X / Ctrl+X) registered and functional
- [ ] TrimOverlay component displays timecodes during drag
- [ ] SnapIndicator component shows snap line with color feedback
- [ ] State persisted to session.json

**Testing Complete**:
- [ ] All 9 acceptance gates pass (3 happy paths, 3 edge cases, 2 error handling, 1 empty)
- [ ] No console errors or warnings during testing
- [ ] Export correctly handles split/trimmed clips
- [ ] Performance targets met: <50ms split, <50ms trim, <20ms snap
- [ ] Cross-platform tested on macOS (required), Windows (best-effort)

**Documentation**:
- [ ] README updated with split/trim feature
- [ ] Keyboard shortcut documented in Help menu
- [ ] UI tooltips added to split button, snap checkbox, trim controls
- [ ] Code comments for complex logic (snap grid math, split state management)

**Code Quality**:
- [ ] No TypeScript errors (`npm run typecheck` passes)
- [ ] Code follows project style (eslint passes if applicable)
- [ ] No commented-out debug code left behind
- [ ] Meaningful variable/function names

---

## 8. PR & Merge

⚠️ **CRITICAL**: DO NOT COMMIT UNTIL USER CONFIRMS ALL TEST GATES PASS

**Sequence**:
1. [ ] Complete all tasks in Sections 1-7
2. [ ] Run manual testing checklist (Section 5)
3. [ ] Document test results (pass/fail + blockers)
4. [ ] **Wait for user approval**: "Ready to commit?" or "Looks good to merge?"
5. [ ] Only after approval:
   - [ ] Create feature branch: `git checkout -b feat/split-advanced-trim`
   - [ ] Stage changes: `git add .`
   - [ ] Commit: `git commit -m "feat(S13): implement split and advanced trim functionality ..."`
   - [ ] Push: `git push -u origin feat/split-advanced-trim`
   - [ ] Create PR to `develop` (not `main`)
   - [ ] PR title: `[S13] Split & Advanced Trim`
   - [ ] PR body includes:
     - Link to user story (S13)
     - Link to PRD (`prds/s13-split-advanced-trim-prd.md`)
     - Summary of changes (split operation, trim UI, snap-to-grid)
     - Test results (all gates passed)
     - Any known limitations or future work
6. [ ] Code review complete
7. [ ] Merge to `develop` branch

---

## 9. Notes for Caleb

1. **Prioritize snap grid math**: Frame-precise snap at different frame rates (30fps, 60fps) is non-trivial. Test thoroughly.

2. **Split creates state dependencies**: Split creates two clip objects. Ensure they have unique IDs and both point to same filePath (non-destructive).

3. **Validation is critical**: Trim can produce invalid state (inPoint >= outPoint) if not carefully guarded. Validate on drag AND on release.

4. **Performance matters**: Users will notice lag on split/drag. Use DevTools Profiler. Target <50ms means <3 frames @ 60fps.

5. **Keyboard shortcut scope**: Use app-level shortcut only (not global). Respect OS focus rules (don't intercept if app not focused).

6. **Test edge cases early**: 1-frame segments, split at boundaries, invalid trims — test before polishing UI.

7. **Export verification**: After implementing split, manually check FFmpeg command in export. Ensure `trim` filter arguments are correct.

8. **Session persistence**: Split state must round-trip through session.json. Test: Save split state → kill app → relaunch → verify clip restoration.

---

**Document Status**: Ready for Caleb Implementation
**Branch**: `feat/split-advanced-trim`
**Acceptance Gate**: All 9 testing gates from Section 5 pass + user approval

---

*End of TODO*
