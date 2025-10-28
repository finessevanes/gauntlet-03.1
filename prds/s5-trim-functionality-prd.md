# PRD: Trim Functionality

**Feature**: Trim Functionality (Story 5) | **Status**: Ready | **Agent**: Pam

---

## Preflight Questionnaire

1. **Smallest end-to-end user outcome?**
   - User hovers over clip edge on timeline, drags to adjust in/out point, clip duration updates in real-time.

2. **Primary user + critical action?**
   - Video editor wants to remove unwanted portions from clips without modifying originals. Critical action: edge drag to set new trim points.

3. **Must-have vs nice-to-have?**
   - MUST: Frame-precise trim, real-time feedback, non-destructive editing. NICE: Keyboard shortcuts for trim, undo/redo.

4. **Offline/persistence needs?**
   - YES: Trim points must persist in session state (saved when app closes, restored on launch).

5. **Performance targets?**
   - Real-time visual feedback during drag (<50ms latency). Tooltip updates smooth. Clip block redraws instantly.

6. **Error/edge cases critical to handle?**
   - User drags start past end point → prevent or snap to valid range. Clips with no duration after trim → minimum 1 frame required.

7. **Data model changes?**
   - YES: Clip model gains `inPoint` (start in seconds) and `outPoint` (end in seconds). Timeline tracks trimmed durations.

8. **Service/command APIs needed?**
   - YES: Electron IPC handler `trim_clip` to validate/apply trim points server-side.

9. **React components to create/modify?**
   - Modify: `Timeline.tsx` (add edge drag handlers), `TimelineClip.tsx` (render edges, resize cursor). New: `TrimTooltip.tsx`.

10. **Desktop-specific needs?**
    - Cursor changes on hover (resize/↔ cursor). Drag must work with macOS trackpad + mouse. Multi-monitor: maintain visual feedback across zoom/scroll.

11. **What's explicitly out of scope?**
    - Keyboard shortcuts (defer to Story 6+). Undo/redo (Story 8+). Slip editing (adjust content without changing duration). Ripple editing (affect subsequent clips).

---

## 1. Summary

Allow users to trim video clips on the timeline by dragging clip edges to adjust in/out points. Trimming is non-destructive (original files unchanged), frame-precise, and provides real-time visual feedback with duration tooltips.

---

## 2. Non-Goals / Scope Boundaries

- **Out of Scope:**
  - Keyboard shortcuts for trim (e.g., `I` for in-point, `O` for out-point)
  - Undo/redo functionality (session state only)
  - Slip editing (moving clip content within its duration)
  - Ripple editing (trimming one clip affects positions of subsequent clips)
  - Numeric in/out point input fields (drag-only interface)
  - Trim presets (e.g., "trim 10 seconds")

---

## 3. Experience (UX)

### Entry Points
- **Trigger**: User hovers over the left or right edge of a clip block on the timeline
- **Location**: Timeline panel (bottom 30% of app window)

### User Flow (Happy Path)

1. User selects timeline (already contains clips from Story 4)
2. User hovers near left or right edge of a clip block
3. Cursor changes to resize cursor (col-resize) when within 5px of edge; the edge being hovered highlights with a green outline to indicate it can be trimmed
4. User clicks and drags edge:
   - **Left edge drag** → adjust clip start point (in-point)
   - **Right edge drag** → adjust clip end point (out-point)
5. During drag:
   - Clip block width shrinks/grows in real-time
   - Tooltip appears near cursor showing "Old duration → New duration" (e.g., "0:45 → 0:30")
   - Timeline auto-scrolls if drag reaches edge of viewport
6. User releases mouse:
   - Trim point is locked in
   - Tooltip disappears
   - Clip duration updates on clip block
7. Trimmed clip is now reflected in timeline and session state (persists on close/relaunch)

### States

| State | Behavior | Example |
|-------|----------|---------|
| **Normal** | Clip displays with solid edge, standard cursor | Clip at 0:45 duration |
| **Hover (near edge)** | Cursor becomes ↔ resize, edge highlights slightly | Cursor changes at 5px from edge |
| **Dragging** | Clip width updates, tooltip shows "Old → New", timeline scrolls if needed | Dragging from 0:45 → 0:30 |
| **Invalid Range** | Start point >= end point → snap to minimum (1 frame or 0.033s) | User tries to drag start past end → snaps |
| **After Trim** | Clip block shows new duration, session state updated | "0:30" label on trimmed clip |

### Desktop Considerations

- **Window Resize**: Timeline zooming/scrolling must remain responsive during drag
- **Multi-monitor**: Tooltip and visual feedback must stay visible even if viewport scrolls
- **Trackpad**: Drag detection must work with macOS trackpad (smooth, momentum-based scrolling)
- **Mouse Wheel**: Horizontal scroll while NOT dragging should zoom/pan timeline

---

## 4. Functional Requirements

### MUST (Core Trim Functionality)

- [ ] **Trim Start Point**
  - When user drags left edge of clip → adjust `inPoint` (start time in seconds)
  - Trim range: 0 to (original duration - 1 frame)
  - Real-time visual feedback: clip block width shrinks
  - Tooltip shows: "HH:MM:SS → HH:MM:SS" format

- [ ] **Trim End Point**
  - When user drags right edge of clip → adjust `outPoint` (end time in seconds)
  - Trim range: (inPoint + 1 frame) to original duration
  - Real-time visual feedback: clip block width changes
  - Tooltip shows updated duration

- [ ] **Frame-Precise Dragging**
  - Drag resolution: ~30fps (33ms per frame for 30fps video)
  - Snap tolerance: NO snap-to-grid; allow free dragging
  - Visual feedback must update within 50ms of mouse movement

- [ ] **Edge Detection**
  - Hover zone: Within 5px of clip left/right edge
  - Cursor changes to `col-resize` (↔) when hoverable
  - Visual cue: Edge highlights or border brightens on hover

- [ ] **Invalid Range Prevention**
  - If user drags start point >= end point → SNAP to valid range (1 frame min)
  - e.g., if dragging left edge past right, snap left to (right - 1 frame)
  - No error dialog; silent correction with visual feedback

- [ ] **Trimmed Duration Display**
  - Clip block shows new duration: "MM:SS" format
  - Tooltip during drag: "0:45 → 0:30"
  - Persistent label after drag ends

- [ ] **Non-Destructive Editing**
  - Original video file is never modified
  - Trim points stored as `inPoint` and `outPoint` offsets
  - Export uses trimmed range only (validated in Story 7)

- [ ] **Timeline Updates**
  - After trim, clip position remains unchanged (no ripple)
  - Subsequent clips do NOT shift
  - Timeline total duration recalculates for preview/export

- [ ] **Persist Trim State**
  - On app close, trim points saved in session state JSON
  - On app relaunch, trim points restored exactly
  - Session file structure: `{ clips: [{ id, inPoint, outPoint }, ...] }`

### SHOULD (Enhancements)

- [ ] **Keyboard Modifiers**
  - Hold `Shift` + drag → snap to 1-second increments (optional refinement)
  - Hold `Cmd/Ctrl` + drag → snap to 10-second increments (optional)

- [ ] **Undo/Redo**
  - Undo trim action (defer to Story 8)
  - Redo trim action

- [ ] **Trim Shortcuts**
  - Right-click on clip → "Trim to Playhead" (set out-point to playhead position)
  - Right-click on clip → "Reset Trim" (restore to full duration)

### Acceptance Gates

**All gates must pass before feature is "done":**

1. **Hover Detection & Cursor Change**
   - When hovering within 5px of clip edge → cursor changes to ↔
   - Cursor reverts when >5px away
   - No lag or jitter

2. **Start Point Drag**
   - Drag left edge from 0:45 to 0:15 → clip width updates in real-time
   - Tooltip shows "0:45 → 0:15" while dragging
   - After release, duration label shows "0:30" (0:45 - 0:15 = 0:30)

3. **End Point Drag**
   - Drag right edge from 0:45 to 0:30 → clip width shrinks
   - Tooltip shows "0:45 → 0:30"
   - After release, duration label shows "0:15" (0:30 - 0 = 0:30)

4. **Invalid Range Snapping**
   - Drag left edge past right edge → snaps to valid range
   - No crash, no error dialog
   - Clip remains valid with minimum 1-frame duration

5. **Session Persistence**
   - Create timeline with 3 clips: A (0:45), B (1:30), C (0:20)
   - Trim A to 0:15, B to 0:30, C untouched
   - Close app and relaunch
   - Verify: A shows 0:15, B shows 0:30, C shows 0:20

6. **Multiple Clip Trim**
   - Trim 3 different clips to different durations
   - Export validates trimmed ranges (no source file corruption)
   - No performance degradation with many trimmed clips

7. **Real-Time Feedback**
   - Drag must update within 50ms
   - Tooltip must follow cursor smoothly
   - No visual stutter or lag

8. **Playback with Trim**
   - Trim clip to 0:30 (from 0:45)
   - Play timeline → plays only trimmed portion (0:30), not full 0:45
   - Audio synced to trimmed range

---

## 5. Data Model

### Clip Interface (Updated)

```typescript
interface Clip {
  id: string;                    // Unique ID (UUID or similar)
  filePath: string;              // Path to original video file
  fileName: string;              // Display name
  duration: number;              // Original duration in seconds
  inPoint: number;               // Trim start point in seconds (default: 0)
  outPoint: number;              // Trim end point in seconds (default: duration)
  trimmedDuration?: number;      // Derived: outPoint - inPoint
  thumbnailPath?: string;        // Path to cached thumbnail
  createdAt?: number;            // Timestamp when imported
  lastModified?: number;         // Timestamp of last trim
}
```

### Timeline Interface (Updated)

```typescript
interface Timeline {
  clips: Clip[];                 // Array of clip objects with trim points
  totalDuration: number;         // Sum of all trimmed clip durations
  zoomLevel: number;             // 100-1000% (from Story 4)
  playheadPosition: number;      // Current playhead time in seconds
  scrollPosition?: number;       // Horizontal scroll offset
}
```

### Session State (Updated)

```typescript
interface SessionState {
  timeline: Timeline;
  importedClips: Clip[];         // Library of all imported clips (with trim points)
  lastSaved?: number;            // Timestamp of last save
}
```

### Storage

- **Location**: `~/.klippy/session.json` (or Electron app data directory)
- **Format**: JSON (serializable, no class instances)
- **On Save**: Triggered when:
  - App closes (via `beforeunload` event)
  - Every 30 seconds auto-save (background)
  - After trim operation completes

---

## 6. Service/Command APIs

### Electron IPC Handler: `trim_clip`

**Purpose**: Validate and apply trim points to a clip.

**Signature:**
```typescript
await ipcRenderer.invoke('trim_clip', {
  clipId: string;
  inPoint: number;      // New start time in seconds
  outPoint: number;     // New end time in seconds
});
// Returns: { success: boolean; clip: Clip; error?: string }
```

**Pre-conditions:**
- Clip with `clipId` exists in timeline
- `inPoint` >= 0
- `outPoint` <= original clip duration
- `inPoint` < `outPoint` (minimum 1 frame = ~0.033s)

**Post-conditions:**
- Clip's `inPoint` and `outPoint` updated
- `trimmedDuration` recalculated
- Session state marked as dirty (needs save)

**Error Handling:**
```typescript
// Invalid input
{ success: false, error: "inPoint must be < outPoint" }

// Clip not found
{ success: false, error: "Clip not found: {clipId}" }

// Out of range
{ success: false, error: "inPoint exceeds clip duration" }
```

### Electron IPC Handler: `reset_trim`

**Purpose**: Reset clip to full original duration.

**Signature:**
```typescript
await ipcRenderer.invoke('reset_trim', { clipId: string });
// Returns: { success: boolean; clip: Clip }
```

---

## 7. Components to Create/Modify

### Modify: `src/components/Timeline.tsx`

**Purpose**: Add edge drag detection and trim tooltip overlay.

**Changes:**
- Add mouse event listeners for edge hover detection
- Detect when mouse is within 5px of clip edge
- Update cursor style to `col-resize` on hover
- Render trim tooltip during drag

### Modify: `src/components/TimelineClip.tsx`

**Purpose**: Render clip with trimmed duration and draggable edges.

**Changes:**
- Calculate `trimmedDuration = outPoint - inPoint`
- Display duration label with trimmed time
- Add left/right edge elements (5px wide, semi-transparent)
- Add drag start handler to parent timeline
- Emit trim events up to Timeline

### New: `src/components/TrimTooltip.tsx`

**Purpose**: Display trim feedback tooltip during drag.

**Props:**
```typescript
interface TrimTooltipProps {
  originalDuration: number;      // Original clip duration
  newDuration: number;           // Current dragged duration
  position: { x: number; y: number };  // Cursor position
  visible: boolean;
}
```

**Behavior:**
- Shows "MM:SS → MM:SS" format
- Positioned near cursor, offset slightly to avoid covering drag
- Updates in real-time during drag
- Disappears on mouse up

### New: `src/hooks/useTrimDrag.ts`

**Purpose**: Encapsulate trim drag logic (hover detection, drag calculation, validation).

**Exports:**
```typescript
function useTrimDrag(timelineRef: React.RefObject<HTMLDivElement>) {
  return {
    onMouseDown: (clipId: string, edge: 'left' | 'right') => void;
    onMouseMove: (e: MouseEvent) => void;
    onMouseUp: (e: MouseEvent) => void;
    hoveredEdge: { clipId: string; edge: 'left' | 'right' } | null;
    dragging: { clipId: string; edge: 'left' | 'right'; startX: number } | null;
  }
}
```

---

## 8. Integration Points

### File System
- Read original clip duration from FFmpeg metadata (already done in Story 2)
- Validate file exists before trimming (error if deleted)

### State Management
- Update Zustand/Context store when trim applied
- Persist to session JSON on change
- Trigger timeline re-render with updated clip durations

### Timeline Rendering
- `TimelineClip` renders with `width = (outPoint - inPoint) * pixelsPerSecond`
- Playhead respects trimmed range during playback
- Export only includes trimmed portion (Story 7)

### Preview Player
- When clip selected, play from `inPoint` to `outPoint` (Story 6)
- Scrubbing within timeline respects trim bounds

---

## 9. Testing & Acceptance Gates

### Happy Path 1: Trim Start Point

**Flow:**
1. Load timeline with 1-minute clip (duration: 60s)
2. Hover over left edge of clip
3. Verify cursor changes to ↔
4. Click and drag left edge 15 pixels to the right
5. Release mouse

**Gate:**
- Clip width shrinks proportionally
- Tooltip shows "1:00 → ~0:45" (approximately)
- After release, duration label updates to trimmed time
- No crash or console errors

**Pass Criteria:**
- Cursor change visible
- Tooltip appears during drag
- Clip width updates smoothly
- Duration persists after drag

---

### Happy Path 2: Trim End Point

**Flow:**
1. Load timeline with 1-minute clip
2. Hover over right edge of clip
3. Verify cursor changes to ↔
4. Click and drag right edge 20 pixels to the left
5. Release mouse

**Gate:**
- Clip width shrinks
- Tooltip shows updated duration
- Duration label reflects trim

**Pass Criteria:**
- Same as Happy Path 1

---

### Happy Path 3: Trim Multiple Clips

**Flow:**
1. Load timeline with 3 clips: A (0:45), B (1:30), C (0:20)
2. Trim A to 0:15
3. Trim B to 0:30
4. Leave C untouched
5. Export timeline

**Gate:**
- Each clip displays correct trimmed duration
- Export file is exactly 1:05 (0:15 + 0:30 + 0:20)

**Pass Criteria:**
- No performance degradation with 3 trimmed clips
- Export validates trimmed ranges

---

### Edge Case 1: Invalid Range (Drag Start Past End)

**Flow:**
1. Load timeline with 0:45 clip
2. Drag left edge all the way to the right (past current end point)

**Gate:**
- Left edge snaps to valid position (end point - 1 frame)
- No error dialog shown
- Clip maintains minimum valid duration

**Pass Criteria:**
- Clip remains valid, no crash
- Visual feedback shows snapped position

---

### Edge Case 2: Minimum Duration

**Flow:**
1. Load timeline with 0:10 clip
2. Trim to 1 frame duration (~0.033s)

**Gate:**
- Clip can be trimmed to 1 frame
- Duration label shows "0:00" or "1f"

**Pass Criteria:**
- No crash, clip remains playable

---

### Edge Case 3: Session Persistence

**Flow:**
1. Create timeline with 3 trimmed clips
2. Close app completely
3. Relaunch app

**Gate:**
- All 3 clips appear with exact same trim points
- Duration labels match pre-close state

**Pass Criteria:**
- Trim state persisted and restored exactly
- No data loss

---

### Error Case 1: File Deleted After Import

**Flow:**
1. Import clip, trim it
2. Delete source video file from disk
3. Try to play trimmed clip

**Gate:**
- App shows error: "Cannot play clip: Source file not found"
- Export also fails with clear error
- No crash

**Pass Criteria:**
- Error message is clear
- App remains stable

---

### Edge Case 4: Large Video File

**Flow:**
1. Import 2GB video file
2. Trim to 30 seconds from middle of file
3. Play trimmed clip

**Gate:**
- Trimming is instantaneous (no file re-encoding)
- Playback is smooth at 30fps minimum
- Memory remains <1GB

**Pass Criteria:**
- Trim is non-destructive, very fast
- No lag during playback

---

### Performance Checklist

- [ ] Trim drag updates within 50ms
- [ ] Tooltip follows cursor smoothly (no flicker)
- [ ] Dragging with 10+ clips remains responsive (60fps if possible, min 30fps)
- [ ] Timeline auto-scroll during drag works smoothly
- [ ] Memory usage stable during trim operations (<50MB delta)

---

## 10. Definition of Done

- [ ] **Data Model**: Clip interface updated with `inPoint` and `outPoint`
- [ ] **Service Layer**: `trim_clip` and `reset_trim` IPC handlers implemented with validation
- [ ] **Components**: TimelineClip modified, TrimTooltip created, useTrimDrag hook implemented
- [ ] **State Management**: Session state persists trim points on close/relaunch
- [ ] **Happy Path Tests**: All 3 happy paths pass without errors
- [ ] **Edge Cases**: Invalid range, minimum duration, file deleted, large files all handled gracefully
- [ ] **Error Handling**: Clear error messages for all failure scenarios
- [ ] **Performance**: Drag updates within 50ms, tooltip smooth, memory stable
- [ ] **Integration**: Playback respects trim bounds, export uses trimmed range
- [ ] **Manual Testing**: All acceptance gates verified on macOS (and Windows if available)
- [ ] **Code Quality**: No console errors/warnings, comments on complex drag logic
- [ ] **Documentation**: README/CHANGELOG updated if user-facing
- [ ] **PR**: Created to `develop` with link to user story, PRD section, and test results

---

## 11. Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| **Drag lag/jitter** | Use `requestAnimationFrame` for smooth updates, throttle tooltip updates to 60fps max |
| **Edge detection too small** | Increase hover zone to 8-10px if 5px feels difficult on trackpad |
| **Trim state corruption** | Validate session JSON on load, recover with blank slate + error log |
| **File deleted after trim** | Check file existence before playback/export, show clear error message |
| **Large file slow trim** | Trim is metadata-only (no re-encoding), should be instant regardless of file size |
| **Multi-clip trim performance** | Test with 20+ clips, optimize clip rendering if needed (virtualization if sluggish) |

---

## Authoring Notes

- **Test gates before coding**: They are the specification for acceptance
- **Vertical slice**: Complete end-to-end trim (drag → tooltip → persistence → playback)
- **Keep Electron handler deterministic**: Validate inputs, return clear success/error responses
- **Non-destructive**: Never modify source files, only store trim metadata
- **Performance first**: Drag must feel instant; use RAF and throttling
- **Session state serializable**: JSON-safe types only (no class instances, no functions)

