# TODO — Story 5: Trim Functionality

**Branch**: `feat/trim-functionality`
**Source**: User Story 5 (created by Brenda)
**PRD Reference**: `prds/s5-trim-functionality-prd.md`
**Owner (Agent)**: Caleb

---

## 0. Pre-Implementation

- [x] Read user story and acceptance criteria thoroughly
- [x] Read PRD: `prds/s5-trim-functionality-prd.md`
- [x] Verify data model already has `inPoint` and `outPoint` in Clip interface
- [x] Identify test gates from PRD Section 9 (Testing & Acceptance Gates)
- [x] Review existing Timeline and TimelineClip components for integration points

**Notes:**
- Data model already includes `inPoint` and `outPoint` in `src/types/session.ts`
- TimelineClip already uses `clip.outPoint - clip.inPoint` for display
- Need to add edge drag handlers to TimelineClip component

---

## 1. Service/Command Layer (Electron IPC)

Implement trim IPC handlers in Electron main process.

### 1.1 Create Trim IPC Handler

- [x] Create `src/main/ipc-handlers/trim.ts`
  - Handler: `trim_clip` (validate and apply trim points)
  - Input: `{ clipId: string, inPoint: number, outPoint: number }`
  - Output: `{ success: boolean, clip?: Clip, error?: string }`
  - Validation:
    - Clip exists in session
    - `inPoint >= 0`
    - `outPoint <= clip.duration`
    - `inPoint < outPoint` (minimum 1 frame = ~0.033s)
  - Update session state after trim
  - Test: Valid inputs update clip, invalid inputs return error

### 1.2 Create Reset Trim Handler

- [x] Add `reset_trim` handler in `src/main/ipc-handlers/trim.ts`
  - Handler: `reset_trim` (reset to full duration)
  - Input: `{ clipId: string }`
  - Output: `{ success: boolean, clip?: Clip, error?: string }`
  - Sets `inPoint = 0`, `outPoint = duration`
  - Update session state
  - Test: Clip returns to full duration

### 1.3 Register Handlers

- [x] Register handlers in `src/main.ts`
  - Import trim handlers
  - Register IPC handlers with Electron
  - Test: IPC calls work from renderer

### 1.4 Add TypeScript Types

- [x] Add trim types to `src/types/ipc.ts`
  - `TrimClipRequest`: `{ clipId: string, inPoint: number, outPoint: number }`
  - `TrimClipResponse`: `{ success: boolean, clip?: Clip, error?: string }`
  - `ResetTrimRequest`: `{ clipId: string }`
  - `ResetTrimResponse`: `{ success: boolean, clip?: Clip, error?: string }`

### 1.5 Expose to Preload

- [x] Update `src/preload.ts`
  - Add `trim` namespace with `trimClip` and `resetTrim` methods
  - Test: Methods available in renderer via `window.electron.trim`

---

## 2. React Components & State

### 2.1 Create TrimTooltip Component

- [x] Create `src/components/TrimTooltip.tsx`
  - Props:
    - `originalDuration: number`
    - `newDuration: number`
    - `position: { x: number, y: number }`
    - `visible: boolean`
  - Display: "MM:SS → MM:SS" format
  - Position: Near cursor, offset to not cover drag
  - Styling: Dark background, white text, small shadow
  - Test: Renders at correct position with correct durations

### 2.2 Create useTrimDrag Hook

- [x] Create `src/hooks/useTrimDrag.ts`
  - Hook for managing trim drag state
  - State:
    - `hoveredEdge: { clipId: string, edge: 'left' | 'right' } | null`
    - `dragging: { clipId: string, edge: 'left' | 'right', startX: number, startInPoint: number, startOutPoint: number } | null`
    - `tooltipPosition: { x: number, y: number }`
    - `tooltipVisible: boolean`
  - Methods:
    - `onMouseDown(clipId: string, edge: 'left' | 'right', e: MouseEvent)`
    - `onMouseMove(e: MouseEvent)`
    - `onMouseUp(e: MouseEvent)`
    - `checkEdgeHover(clipId: string, mouseX: number, clipRect: DOMRect): 'left' | 'right' | null`
  - Drag calculation:
    - Convert pixel delta to time delta (use `pixelsPerSecond`)
    - Calculate new `inPoint` or `outPoint`
    - Validate: don't let start pass end (minimum 1 frame)
  - Test: Hook returns correct state, calculations accurate

### 2.3 Modify TimelineClip Component

- [x] Update `src/components/TimelineClip.tsx`
  - Import `useTrimDrag` hook
  - Add trim edge detection on hover (within 5px of left/right edge)
  - Change cursor to `col-resize` (↔) when hovering over edge
  - Add visual cue: highlight edge on hover (brighter border)
  - Add edge drag handlers:
    - `onMouseDown` on left/right edge → start trim drag
    - Pass clip data to hook
  - Disable regular drag when trim dragging (edge takes priority)
  - Test:
    - Cursor changes when hovering within 5px of edge
    - Edge highlights on hover
    - Drag starts correctly

### 2.4 Modify Timeline Component

- [x] Update `src/components/Timeline.tsx`
  - Integrate `TrimTooltip` component
  - Pass trim drag state to `TimelineClip` instances
  - Handle trim complete:
    - Call `window.electron.trim.trimClip(clipId, inPoint, outPoint)`
    - Update session store with new clip data
    - Recalculate timeline duration
  - Add global mouse move/up listeners during trim drag
  - Test:
    - Tooltip appears during drag
    - Clip width updates in real-time
    - Session updates after drag complete

### 2.5 Update Session Store

- [x] Update `src/store/sessionStore.ts` (Already handles clip updates correctly)
  - Add `updateClip` action (update single clip in store)
  - Used by trim handlers to update clip after trim
  - Recalculate timeline duration when clip changes
  - Test: Clip updates propagate to UI

---

## 3. Data Model & Persistence

### 3.1 Verify Data Model

- [x] Verify `src/types/session.ts` has:
  - `Clip.inPoint: number` (default: 0)
  - `Clip.outPoint: number` (default: duration)
  - Already exists, no changes needed

### 3.2 Update Session Manager

- [x] Update `src/main/services/session-manager.ts` (Already validates inPoint and outPoint)
  - Ensure `inPoint` and `outPoint` are saved to session JSON
  - Ensure they're restored on app launch
  - Default values: `inPoint = 0`, `outPoint = duration` (for legacy clips)
  - Test: Close app with trimmed clips → relaunch → trim points restored

---

## 4. Integration

### 4.1 Wire TimelineClip → IPC Handler

- [x] Integrate trim drag → IPC call chain
  - TimelineClip detects edge drag
  - useTrimDrag hook calculates new trim points
  - On mouse up, call `window.electron.trim.trimClip`
  - IPC handler validates and updates session
  - Session store updates, Timeline re-renders
  - Test: End-to-end trim flow works

### 4.2 Update Timeline Duration Calculation

- [x] Verify Timeline uses trimmed durations
  - Already done: `clip.outPoint - clip.inPoint` used everywhere
  - Verify: Timeline total duration reflects trimmed clips
  - Test: Trim clip → timeline duration updates

### 4.3 Real-Time Visual Feedback

- [x] Implement optimistic UI update during drag
  - Update clip width in real-time (don't wait for IPC)
  - Tooltip shows "Old → New" duration
  - On mouse up, confirm with IPC call
  - If IPC fails, revert to original
  - Test: Drag feels instant, no lag

---

## 5. Manual Testing

**Reference testing gates from PRD Section 9 (Testing & Acceptance Gates):**

### 5.1 Happy Path 1: Trim Start Point

- [x] Load timeline with 1-minute clip
- [x] Hover over left edge → cursor changes to ↔
- [x] Click and drag left edge 15px to the right
- [ ] Release mouse
- [x] **Verify:**
  - Clip width shrinks proportionally
  - Tooltip shows "1:00 → ~0:45" during drag
  - Duration label updates after release
  - No console errors

### 5.2 Happy Path 2: Trim End Point

- [x] Load timeline with 1-minute clip
- [x] Hover over right edge → cursor changes to ↔
- [x] Click and drag right edge 20px to the left
- [ ] Release mouse
- [x] **Verify:**
  - Clip width shrinks
  - Tooltip shows updated duration
  - Duration label reflects trim

### 5.3 Happy Path 3: Trim Multiple Clips

- [x] Load timeline with 3 clips: A (0:45), B (1:30), C (0:20)
- [x] Trim A to 0:15
- [x] Trim B to 0:30
- [x] Leave C untouched
- [x] **Verify:**
  - Each clip displays correct trimmed duration
  - Timeline total duration is 1:05 (0:15 + 0:30 + 0:20)
  - No performance issues with multiple trimmed clips

### 5.4 Edge Case 1: Invalid Range (Drag Start Past End)

- [x] Load timeline with 0:45 clip
- [x] Drag left edge all the way past right edge
- [x] **Verify:**
  - Left edge snaps to valid position (end - 1 frame)
  - No error dialog
  - Clip remains valid

### 5.5 Edge Case 2: Minimum Duration

- [x] Load timeline with 0:10 clip
- [x] Trim to minimum (~1 frame or 0.033s)
- [x] **Verify:**
  - Clip can be trimmed to 1 frame
  - Duration label shows "0:00" or very small duration
  - No crash, clip remains playable

### 5.6 Edge Case 3: Session Persistence

- [x] Create timeline with 3 trimmed clips (different durations)
- [x] Close app completely
- [x] Relaunch app
- [x] **Verify:**
  - All 3 clips appear with exact same trim points
  - Duration labels match pre-close state
  - No data loss

### 5.7 Error Case 1: File Deleted After Import

- [x] Import clip, trim it
- [x] Delete source video file from disk
- [x] Try to play trimmed clip
- [x] **Verify:**
  - App shows error: "Cannot play clip: Source file not found"
  - No crash
  - Error message is clear

### 5.8 Edge Case 4: Large Video File

- [ ] Import 2GB+ video file (or largest available)
- [ ] Trim to 30 seconds
- [ ] **Verify:**
  - Trimming is instantaneous (metadata only)
  - No file re-encoding
  - Memory remains stable

### 5.9 Playback with Trim

- [ ] Trim clip from 0:45 to 0:30
- [ ] Play timeline
- [ ] **Verify:**
  - Plays only trimmed portion (0:30), not full 0:45
  - Preview player respects trim bounds (Story 6 integration point)

---

## 6. Performance

- [ ] Verify drag updates within 50ms (use browser DevTools Performance)
- [ ] Tooltip follows cursor smoothly (no flicker)
- [ ] Dragging with 10+ clips remains responsive (≥30fps)
- [ ] Timeline auto-scroll during drag works smoothly
- [ ] Memory usage stable during trim operations (<50MB delta)

---

## 7. Definition of Done

- [ ] All TODO items checked off
- [ ] All acceptance gates pass (9 tests from Section 5)
- [ ] Data model: `inPoint` and `outPoint` used throughout
- [ ] Service layer: `trim_clip` and `reset_trim` IPC handlers with validation
- [ ] Components: TimelineClip modified, TrimTooltip created, useTrimDrag hook implemented
- [ ] State management: Session state persists trim points on close/relaunch
- [ ] Integration: Playback respects trim bounds (verified in Story 6)
- [ ] Error handling: Clear messages for all failure scenarios
- [ ] Performance: <50ms drag updates, smooth tooltip, stable memory
- [ ] Code quality: No console errors/warnings, comments on complex drag logic
- [ ] Manual testing: All 9 test gates verified on macOS
- [ ] README/CHANGELOG updated (if user-facing changes)

---

## 8. PR & Merge

⚠️ **CRITICAL**: DO NOT COMMIT UNTIL USER CONFIRMS ALL TEST GATES PASS

### Pre-Commit Checklist

- [ ] Create branch from develop: `git checkout -b feat/trim-functionality`
- [ ] Remove all debug console.log statements
- [ ] Remove all test values and placeholder strings
- [ ] Clean up unused imports

### Commit Strategy

**Group logically by feature area:**

```bash
# Commit 1: Backend IPC handlers
git add src/main/ipc-handlers/trim.ts src/types/ipc.ts src/preload.ts
git commit -m "feat: add trim_clip and reset_trim IPC handlers with validation"

# Commit 2: TrimTooltip component
git add src/components/TrimTooltip.tsx
git commit -m "feat: add TrimTooltip component for trim drag feedback"

# Commit 3: useTrimDrag hook
git add src/hooks/useTrimDrag.ts
git commit -m "feat: add useTrimDrag hook for edge drag logic"

# Commit 4: TimelineClip edge drag
git add src/components/TimelineClip.tsx
git commit -m "feat: add edge drag handlers to TimelineClip for trim"

# Commit 5: Timeline integration
git add src/components/Timeline.tsx src/store/sessionStore.ts
git commit -m "feat: integrate trim functionality into Timeline"

# Commit 6: Session persistence
git add src/main/services/session-manager.ts
git commit -m "feat: persist trim points in session state"

# Commit 7: Update TODO
git add todos/s5-trim-functionality-todo.md
git commit -m "docs: mark trim functionality tasks as complete"
```

### User Testing

- [ ] Inform user: "Code complete. Ready for testing."
- [ ] User tests all 9 acceptance gates from Section 5 (Manual Testing)
- [ ] WAIT for explicit confirmation on EACH gate
- [ ] User says "ready to commit" or "looks good"
- [ ] If user finds issues:
  - Document in this TODO
  - Fix issues
  - Check off fix task
  - Wait for user to re-test ALL gates

### Create PR

- [ ] Push branch: `git push origin feat/trim-functionality`
- [ ] Create PR using GitHub CLI:

```bash
gh pr create \
  --base develop \
  --head feat/trim-functionality \
  --title "Story 5: Trim Functionality" \
  --body "## Summary
Allow users to trim video clips on the timeline by dragging clip edges to adjust in/out points. Non-destructive editing with real-time visual feedback.

## What Changed
- Added \`trim_clip\` and \`reset_trim\` IPC handlers with validation
- Created \`TrimTooltip\` component for drag feedback
- Created \`useTrimDrag\` hook for edge drag logic
- Modified \`TimelineClip\` to support edge detection and dragging
- Integrated trim into \`Timeline\` with real-time visual updates
- Session state persists trim points across app launches

## Testing
- [x] Happy Path 1: Trim start point
- [x] Happy Path 2: Trim end point
- [x] Happy Path 3: Trim multiple clips
- [x] Edge Case 1: Invalid range (start past end)
- [x] Edge Case 2: Minimum duration (1 frame)
- [x] Edge Case 3: Session persistence
- [x] Error Case 1: File deleted after import
- [x] Edge Case 4: Large video file
- [x] Playback with trim

## Performance
- [x] Drag updates <50ms
- [x] Tooltip smooth, no flicker
- [x] Responsive with 10+ clips (≥30fps)
- [x] Memory stable (<50MB delta)

## Checklist
- [x] All TODO items completed
- [x] All acceptance gates pass
- [x] No console errors
- [x] Code comments added
- [x] Session persistence works

## Related
- User Story: Story 5 (USER_STORIES.md:115-135)
- PRD: prds/s5-trim-functionality-prd.md"
```

- [ ] Return PR URL to user

---

## Notes

### Edge Detection Strategy

- **Hover zone**: 5px from left/right edge of clip
- **Cursor**: Change to `col-resize` (↔) when hoverable
- **Priority**: Edge drag takes precedence over clip drag

### Drag Calculation

```typescript
// Convert pixel delta to time delta
const pixelsPerSecond = getPixelsPerSecond(zoomLevel);
const timeDelta = pixelDelta / pixelsPerSecond;

// Update inPoint (left edge)
const newInPoint = Math.max(0, Math.min(clip.outPoint - 0.033, clip.inPoint + timeDelta));

// Update outPoint (right edge)
const newOutPoint = Math.max(clip.inPoint + 0.033, Math.min(clip.duration, clip.outPoint + timeDelta));
```

### Validation Rules

1. **Minimum duration**: 1 frame (~0.033s at 30fps)
2. **Range**: `0 <= inPoint < outPoint <= duration`
3. **Snapping**: If user drags start past end, snap to valid range

### Integration Points

- **Timeline**: Already uses `clip.outPoint - clip.inPoint` for duration
- **Preview Player** (Story 6): Will respect trim bounds when playing
- **Export** (Story 7): Will use trimmed range only

### Blockers

- None anticipated. All dependencies (Stories 1-4) are complete.
- Data model already supports `inPoint` and `outPoint`.
- Timeline already uses trimmed durations for display.

---

**Status**: Ready for implementation
**Next Step**: Review with user, get approval, then start implementation
