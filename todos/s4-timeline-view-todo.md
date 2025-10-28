# TODO — Timeline View (Story 4)

**Branch**: `feat/timeline-view`
**Source**: User Story 4 (USER_STORIES.md, lines 88-113)
**PRD Reference**: `prds/s4-timeline-view-prd.md`
**Owner (Agent)**: Caleb
**Status**: Draft — Awaiting User Approval

---

## 0. Pre-Implementation

- [ ] Read user story and acceptance criteria thoroughly
- [ ] Read PRD `prds/s4-timeline-view-prd.md` (Sections 4-10)
- [ ] Clarify any ambiguities before starting
- [ ] Identify test gates from PRD Section 9 (Happy Paths 1-6, Edge Cases 1-4, Error Cases 1-2)

**Key Requirements Summary:**
- Horizontal timeline track at bottom (40% height, full width)
- Drag clips from Library to Timeline → appear in sequence
- Reorder clips horizontally (drag & drop, no gaps)
- Delete clips (right-click menu + Delete key)
- Playhead (red vertical line) + timecode display (HH:MM:SS.mmm)
- Zoom slider (100%-1000%) + auto-fit
- Horizontal scroll when zoomed in
- Proportional clip widths based on duration
- Empty state: "Drag clips here to start editing"

---

## 1. Service/Command Layer (Electron IPC)

Implement deterministic backend handlers in Electron main process.

### Handler 1: `timeline.add_clip_to_timeline`
- [ ] Create `src/main/ipc-handlers/timeline.ts` with handler `add_clip_to_timeline`
  - **Input**: `{ clipId: string, position?: number }` (position optional, default: end)
  - **Output**: `{ success: boolean, timelineClip?: TimelineClip, error?: string }`
  - **Logic**:
    1. Validate clip exists in session.clips
    2. Calculate insertion position (default: timeline.clips.length)
    3. Insert clipId into session.timeline.clips array at position
    4. Recalculate timeline.duration (sum of all clips' effective durations)
    5. Save session
  - **Error Handling**:
    - `Clip not found: [clipId]` → Invalid clip ID
    - `Invalid position` → Position out of range (0 to clips.length)
  - **Test**: Add clip to empty timeline → returns success, timeline has 1 clip
  - **Test**: Add clip with invalid ID → returns error, timeline unchanged

### Handler 2: `timeline.reorder_timeline_clip`
- [ ] Add handler `reorder_timeline_clip` to `timeline.ts`
  - **Input**: `{ clipId: string, newPosition: number }`
  - **Output**: `{ success: boolean, updatedTimeline?: string[], error?: string }`
  - **Logic**:
    1. Find clip in timeline.clips array
    2. Remove from old position
    3. Insert at newPosition
    4. Recalculate timeline.duration
    5. Save session
  - **Error Handling**:
    - `Clip not found` → Clip not on timeline
    - `Invalid position` → Out of range
  - **Test**: Reorder 3 clips (A, B, C → C, A, B) → success, timeline order correct
  - **Test**: Reorder with invalid position → error, timeline unchanged

### Handler 3: `timeline.delete_timeline_clip`
- [ ] Add handler `delete_timeline_clip` to `timeline.ts`
  - **Input**: `{ clipId: string }`
  - **Output**: `{ success: boolean, updatedTimeline?: string[], error?: string }`
  - **Logic**:
    1. Find clip in timeline.clips array
    2. Remove clipId from array
    3. Recalculate timeline.duration
    4. If playheadPosition > new duration → reset to 0
    5. Save session
  - **Error Handling**:
    - `Clip not found` → Not on timeline
  - **Test**: Delete clip from timeline → success, remaining clips correct
  - **Test**: Delete non-existent clip → error, timeline unchanged

### Handler 4: `timeline.set_timeline_zoom`
- [ ] Add handler `set_timeline_zoom` to `timeline.ts`
  - **Input**: `{ zoomLevel: number | "auto" }` (100-1000 or "auto")
  - **Output**: `{ success: boolean, zoomLevel?: number, error?: string }`
  - **Logic**:
    1. If "auto" → calculate zoom to fit entire timeline in container width
    2. Validate zoomLevel is 100-1000
    3. Update session.zoomLevel
    4. Save session
  - **Error Handling**:
    - `Invalid zoom level` → Outside bounds (100-1000)
  - **Test**: Set zoom to 500 → returns success, zoomLevel = 500
  - **Test**: Set zoom to 2000 → error (out of range)

### Handler 5: `timeline.set_playhead_position`
- [ ] Add handler `set_playhead_position` to `timeline.ts`
  - **Input**: `{ time: number }` (seconds)
  - **Output**: `{ success: boolean, playheadPosition?: number, error?: string }`
  - **Logic**:
    1. Clamp time to valid range: 0 ≤ time ≤ timeline.duration
    2. Update session.playheadPosition
    3. Save session
  - **Error Handling**:
    - `Invalid time` → Negative (clamp to 0) or > duration (clamp to duration)
  - **Test**: Set playhead to 30s on 60s timeline → success, playheadPosition = 30
  - **Test**: Set playhead to 100s on 60s timeline → clamped to 60s

### Handler 6: `timeline.get_timeline_state`
- [ ] Add handler `get_timeline_state` to `timeline.ts`
  - **Input**: None
  - **Output**: `{ clips: string[], duration: number, playheadPosition: number, zoomLevel: number, scrollPosition: number }`
  - **Logic**:
    1. Return current session.timeline + session.playheadPosition + session.zoomLevel + session.scrollPosition
  - **Test**: Invoke on startup → returns current state

### Handler 7: `timeline.set_scroll_position`
- [ ] Add handler `set_scroll_position` to `timeline.ts`
  - **Input**: `{ scrollX: number }` (pixels)
  - **Output**: `{ success: boolean }`
  - **Logic**:
    1. Update session.scrollPosition
    2. Save session
  - **Test**: Set scroll to 500px → success, scrollPosition = 500

### Integration & Export
- [ ] Register all handlers in `src/main/index.ts` (via ipcMain.handle)
- [ ] Update `src/preload/index.ts` to expose `window.electron.timeline.*` APIs
- [ ] Test: All handlers callable from renderer process via `window.electron.timeline.*`

---

## 2. React Components & State

### Component 1: `Timeline.tsx` (Main Timeline Container)
- [ ] Create `src/components/Timeline.tsx`
  - **Purpose**: Main timeline container with clip track, playhead, controls, drop zone
  - **State**:
    - Local: `isDraggingOver` (drop zone highlight)
    - Local: `draggedClipId` (track which clip being reordered)
    - Local: `containerWidth` (for zoom calculations)
  - **Props**: None (reads from store)
  - **Features**:
    - Drop zone for clips from Library
    - Horizontal scrollable track
    - Renders `TimelineClip` for each clip in timeline
    - Renders `TimelinePlayhead`
    - Renders `TimelineControls`
    - Renders `TimelineRuler`
    - Empty state: "Drag clips here to start editing"
  - **Integration**:
    - `onDrop`: Call `window.electron.timeline.add_clip_to_timeline(clipId)`
    - `onDragOver`: Highlight drop zone (prevent default)
    - Calculate clip positions based on zoom level
  - **Test**: Renders empty state when no clips
  - **Test**: Drop clip from Library → clip appears on timeline

### Component 2: `TimelineClip.tsx` (Individual Clip Block)
- [ ] Create `src/components/TimelineClip.tsx`
  - **Purpose**: Render individual clip block on timeline
  - **Props**:
    - `clip: Clip` (from store)
    - `index: number` (position in timeline)
    - `zoomLevel: number` (for width calculation)
    - `onReorder: (clipId, newPosition) => void`
    - `onDelete: (clipId) => void`
    - `isBroken: boolean` (if source file missing)
  - **Features**:
    - Display clip filename (truncated)
    - Display duration in MM:SS format
    - Visual width proportional to duration: `width = (clip.outPoint - clip.inPoint) * pixelsPerSecond`
    - Draggable horizontally (for reorder)
    - Right-click context menu → "Delete"
    - Delete key handler (when selected)
    - Optional thumbnail (first frame) in background
  - **Drag Logic**:
    - `onDragStart`: Set `dataTransfer` with clipId + type = "reorder"
    - `onDrop`: Calculate new position from drop coordinates → call `onReorder`
  - **Test**: Renders clip with correct width at 100% zoom
  - **Test**: Drag clip to new position → reorder called
  - **Test**: Right-click → context menu shows Delete
  - **Test**: Press Delete key → onDelete called

### Component 3: `TimelinePlayhead.tsx` (Red Vertical Line)
- [ ] Create `src/components/TimelinePlayhead.tsx`
  - **Purpose**: Display red vertical line at playhead position
  - **Props**:
    - `playheadPosition: number` (seconds)
    - `zoomLevel: number` (for x-coordinate calculation)
    - `timelineDuration: number`
    - `onSeek: (time) => void` (when dragged)
  - **Features**:
    - Thin red vertical line (2px width)
    - Position: `x = playheadPosition * pixelsPerSecond`
    - Draggable (scrubbing)
    - Clickable timeline to jump playhead
  - **Drag Logic**:
    - `onMouseDown`: Enable drag mode
    - `onMouseMove`: Calculate new time from x-coordinate → call `onSeek`
    - `onMouseUp`: Disable drag mode
  - **Test**: Playhead renders at correct x position
  - **Test**: Drag playhead → onSeek called with new time
  - **Test**: Click timeline → playhead jumps to click position

### Component 4: `TimelineControls.tsx` (Zoom + Timecode)
- [ ] Create `src/components/TimelineControls.tsx`
  - **Purpose**: Display timecode, zoom slider, play/pause buttons (Story 6)
  - **Props**:
    - `playheadPosition: number`
    - `timelineDuration: number`
    - `zoomLevel: number`
    - `onZoomChange: (zoom) => void`
  - **Features**:
    - Timecode display: `HH:MM:SS.mmm / HH:MM:SS.mmm` (current / total)
    - Zoom slider: 100%-1000% + "Auto-fit" button
    - Placeholder for Play/Pause buttons (Story 6)
  - **Timecode Format**: `formatTimecode(seconds) → "HH:MM:SS.mmm"`
    - Example: 90.5s → "00:01:30.500"
    - Update at ≥30fps during playback (handled by Player in Story 6)
  - **Test**: Timecode displays correct format
  - **Test**: Zoom slider changes → onZoomChange called

### Component 5: `TimelineRuler.tsx` (Time Markers)
- [ ] Create `src/components/TimelineRuler.tsx`
  - **Purpose**: Display ruler with time markers (0s, 5s, 10s, etc.)
  - **Props**:
    - `timelineDuration: number`
    - `zoomLevel: number`
    - `containerWidth: number`
  - **Features**:
    - Horizontal ruler above clip track
    - Time markers every 1s (100% zoom) or 5s (lower zoom)
    - Labels: "0:00", "0:05", "0:10", etc.
  - **Test**: Ruler renders markers at correct positions

### State Management: Update `sessionStore.ts`
- [ ] Verify `src/store/sessionStore.ts` has all required fields:
  - `timeline.clips: string[]` (array of clip IDs)
  - `playheadPosition: number`
  - `zoomLevel: number`
  - `scrollPosition: number`
- [ ] Add Zustand actions:
  - `addClipToTimeline(clipId)`
  - `reorderClip(clipId, newPosition)`
  - `deleteClipFromTimeline(clipId)`
  - `setZoomLevel(zoom)`
  - `setPlayheadPosition(time)`
  - `setScrollPosition(scrollX)`
- [ ] Test: All actions update store correctly

### Modified Components
- [ ] Update `src/components/MainLayout.tsx`
  - Replace timeline placeholder with `<Timeline />` component
  - Test: Timeline renders at bottom (40% height)

---

## 3. Data Model & Persistence

- [x] TypeScript interfaces already defined in `src/types/session.ts`:
  - `Clip` interface (from Story 2)
  - `Timeline` interface: `{ clips: string[], duration: number }`
  - `Session` interface: includes `timeline`, `zoomLevel`, `playheadPosition`, `scrollPosition`
- [x] Session persistence handled by Story 1 (`session-manager.ts`)
- [ ] Verify session validation in `session-manager.ts` includes:
  - Timeline.clips is array of strings (clip IDs)
  - All clip IDs in timeline exist in session.clips
  - zoomLevel is 100-1000
  - playheadPosition is ≥0 and ≤ timeline.duration
- [ ] Test: Add clip to timeline → close app → reopen → clip still on timeline

---

## 4. Integration

### Drag & Drop Integration
- [x] Library component already implements `handleClipDragStart` (sets dataTransfer with clipId)
- [ ] Timeline component implements drop zone:
  - Distinguish between Library clips (type: "add") vs Timeline clips (type: "reorder")
  - Library drops → call `add_clip_to_timeline`
  - Timeline drops → call `reorder_timeline_clip`
- [ ] Test: Drag from Library to Timeline → clip added
- [ ] Test: Drag clip within Timeline → clip reordered

### IPC Integration
- [ ] Wire React components to Electron IPC handlers:
  - `Timeline.tsx` → `window.electron.timeline.add_clip_to_timeline`
  - `TimelineClip.tsx` → `window.electron.timeline.reorder_timeline_clip`, `delete_timeline_clip`
  - `TimelineControls.tsx` → `window.electron.timeline.set_timeline_zoom`
  - `TimelinePlayhead.tsx` → `window.electron.timeline.set_playhead_position`
- [ ] Test: All IPC calls return expected responses

### Zoom Calculation
- [ ] Implement zoom calculation helper in `Timeline.tsx`:
  ```typescript
  // pixelsPerSecond = (zoomLevel / 100) * basePixelsPerSecond
  // basePixelsPerSecond = 1 (100% zoom = 1px/sec)
  const pixelsPerSecond = (zoomLevel / 100) * 1;

  // Clip width = effective duration * pixelsPerSecond
  const clipWidth = (clip.outPoint - clip.inPoint) * pixelsPerSecond;

  // Auto-fit zoom calculation
  const autoFitZoom = (containerWidth / timelineDuration) * 100;
  ```
- [ ] Test: 60-second clip at 100% zoom → 60px wide
- [ ] Test: 60-second clip at 500% zoom → 300px wide
- [ ] Test: Auto-fit on 120s timeline in 800px container → zoom ≈ 666%

### Horizontal Scroll
- [ ] Implement scroll sync in `Timeline.tsx`:
  - When user scrolls → save `scrollPosition` via `set_scroll_position`
  - On mount → restore `scrollPosition` from session
  - Auto-scroll if playhead near edge (keep playhead visible)
- [ ] Test: Zoom in → scroll bar appears
- [ ] Test: Scroll position persists across sessions

---

## 5. Manual Testing

**Reference testing gates from PRD Section 9: Testing & Acceptance Gates**

### Happy Path 1: Drag Clip to Empty Timeline
- [x] Open app with empty timeline
- [x] Drag a single MP4 clip from Library panel
- [x] Drop clip onto timeline
- **Verify**:
  - Clip appears on timeline within 200ms
  - Filename visible
  - Duration displayed in MM:SS format
  - Block width proportional to duration
  - Playhead at position 0
  - No console errors

### Happy Path 2: Drag Multiple Clips in Sequence
- [x] Timeline has 1 clip
- [x] Drag 2 more clips from Library
- [x] Drop clips onto timeline
- **Verify**:
  - All 3 clips appear in sequence
  - No gaps between clips
  - Auto-snapped together
  - Total duration = sum of all 3 clips
  - No console errors

### Happy Path 3: Reorder Clips Horizontally
- [x] Timeline has 3 clips: A (30s), B (45s), C (30s)
- [x] Drag clip C to position 0 (before A)
- **Verify**:
  - Timeline becomes C, A, B
  - No gaps
  - Drag response <50ms (feels instant)
  - No console errors

### Happy Path 4: Delete Clip
- [x] Timeline has 3 clips
- [x] Right-click on clip B → click "Delete"
- **Verify**:
  - Clip B removed
  - A and C remain, auto-snapped
  - Total duration = A duration + C duration
  - No console errors
- [x] Add clip back, select it, press Delete key
- **Verify**: Clip deleted (same as right-click)

### Happy Path 5: Zoom & Scroll
- [ ] Timeline has 10 clips totaling 5 minutes
- [x] Zoom auto-fits entire timeline
- [x] User adjusts zoom to 500%
- [x] User drags horizontal scroll bar to mid-timeline
- **Verify**:
  - Timeline rescales smoothly
  - Scroll bar visible at >100% zoom
  - All clips visible when scrolling
  - No jank during zoom transition

### Happy Path 6: Playhead Scrub
- [x] Timeline has 1 clip (60s)
- [x] User drags playhead to 30s mark
- [x] Timecode shows 00:00:30.000
- **Verify**:
  - Playhead moves smoothly
  - <100ms latency (feels real-time)
  - Timecode accurate
  - Preview updates (Story 6 integration)

### Edge Case 1: Empty Timeline
- [x] App launches with no clips on timeline
- **Verify**:
  - "Drag clips here to start editing" placeholder visible
  - No errors
  - Placeholder disappears when first clip added

### Edge Case 2: Broken Clip
- [x] Import clip, add to timeline
- [x] Delete source file (via Finder)
- [x] Wait 5 seconds for Library to detect broken file
- **Verify**:
  - Clip still appears on timeline (file path stored)
  - Broken icon visible on clip
  - Tooltip shows "Source file not found: [filename]"
  - No crash
  - Export will validate and fail (Story 7)

### Edge Case 3: Large Timeline (30 minutes)
- [ ] Timeline with 10+ clips totaling 30 minutes at 100% zoom
- **Verify**:
  - Timeline renders without jank
  - Scroll works smoothly
  - Dragging clips responsive
  - Memory usage <1GB (check Activity Monitor)

### Edge Case 4: Zoom Boundaries
- [ ] Set zoom to 100% → verify clips visible
- [ ] Set zoom to 1000% → verify clips 10x wider
- [ ] Click "Auto-fit" → verify entire timeline visible
- **Verify**:
  - All transitions smooth (60fps)
  - No errors at boundaries
  - Zoom slider snaps to valid range

### Error Case 1: Drag Invalid Clip
- [ ] Manually edit session file to add broken clip ID to timeline
- [ ] Reload app
- **Verify**:
  - Clip shows warning icon (or skipped)
  - No crash
  - Error logged to console
  - User can delete broken clip

### Error Case 2: Rapid Reordering
- [ ] Timeline has 5 clips
- [ ] Rapidly drag clips up and down (stress test)
- **Verify**:
  - UI responsive (no dropped events)
  - Final state consistent (no duplicate/missing clips)
  - No crashes or console errors

### Performance Gates
- [ ] Drag response: <50ms from mouse move to visual update
- [ ] Zoom transition: Smooth, no jank (60fps during zoom)
- [ ] Timeline with 10+ clips: All interactions smooth (no lag)
- [ ] Memory: <1GB with 10 clips + full session state

---

## 6. Performance

**Reference PRD Section 9: Performance Gates**

- [ ] Verify drag response: <50ms from mouse move to visual update
  - Use Chrome DevTools Performance tab to measure
  - Target: <50ms from onMouseMove to render
- [ ] Verify zoom transition: 60fps (no jank)
  - Use React DevTools Profiler
  - Target: <16ms per frame
- [ ] Verify timeline with 10+ clips: smooth interactions
  - Add 10 clips to timeline
  - Drag, scroll, zoom → no lag
- [ ] Verify memory usage: <1GB with 10 clips
  - Open Activity Monitor (macOS) or Task Manager (Windows)
  - Check Klippy memory usage after loading 10 clips

**Optimization Strategies**:
- [ ] Use `React.memo()` on `TimelineClip` to prevent unnecessary re-renders
- [ ] Virtualize clip rendering if >20 clips (show only visible clips)
- [ ] Debounce scroll position updates (save every 500ms, not every pixel)
- [ ] Use `requestAnimationFrame` for smooth playhead dragging

---

## 7. Definition of Done

- [ ] All 7 IPC handlers implemented with error handling
- [ ] React components (Timeline, TimelineClip, TimelinePlayhead, TimelineControls, TimelineRuler) created
- [ ] Drag & drop from Library to Timeline working end-to-end
- [ ] Reorder clips horizontally with <50ms response time
- [ ] Delete clips from timeline (right-click + Delete key)
- [ ] Zoom slider (100%-1000%) + auto-fit working
- [ ] Horizontal scroll bar visible when zoomed in
- [ ] Playhead display + timecode (HH:MM:SS.mmm) updating in real-time
- [ ] All 6 happy path tests pass
- [ ] All 4 edge case tests pass
- [ ] All 2 error case tests pass
- [ ] Performance targets met:
  - [ ] Drag <50ms response
  - [ ] 60fps dragging/scrolling
  - [ ] 10+ clips smooth
  - [ ] <1GB memory
- [ ] No console warnings or errors during testing
- [ ] Code comments on complex logic (drag handlers, zoom calculation)
- [ ] MainLayout.tsx updated with Timeline component

---

## 8. PR & Merge

⚠️ **CRITICAL**: DO NOT COMMIT UNTIL USER CONFIRMS ALL TEST GATES PASS

- [ ] Create branch `feat/timeline-view` from `develop`
- [ ] User confirms all test gates pass ← **WAIT FOR THIS**
- [ ] User says "ready to commit" or "looks good"
- [ ] THEN: Commit changes with message:
  ```
  feat: implement Timeline View (Story 4)

  - Add 7 IPC handlers for timeline operations (add, reorder, delete, zoom, playhead)
  - Create Timeline, TimelineClip, TimelinePlayhead, TimelineControls, TimelineRuler components
  - Implement drag & drop from Library to Timeline
  - Support clip reordering, deletion, zoom (100%-1000%), horizontal scroll
  - Display playhead with timecode (HH:MM:SS.mmm format)
  - All acceptance criteria pass (6 happy paths, 4 edge cases, 2 error cases)
  - Performance: <50ms drag response, 60fps, <1GB memory with 10+ clips

  Closes: Story 4 (Timeline View)
  PRD: prds/s4-timeline-view-prd.md

  🤖 Generated with [Claude Code](https://claude.com/claude-code)

  Co-Authored-By: Claude <noreply@anthropic.com>
  ```
- [ ] Open PR to `develop` with:
  - Title: `feat: Timeline View (Story 4)`
  - Link to user story (USER_STORIES.md, lines 88-113)
  - Link to PRD (prds/s4-timeline-view-prd.md)
  - Summary of changes:
    - Timeline component with drag & drop, reorder, delete, zoom, scroll
    - 7 IPC handlers for backend logic
    - All acceptance criteria pass
    - Performance gates met
  - Manual test results (screenshots/video if possible)
- [ ] Code reviewed
- [ ] Merge to `develop`

---

## Notes

- **Dependency**: Library.tsx already implements drag source (Story 3) → Timeline just needs drop target
- **Zoom calculation**: See PRD Appendix A for formula (100% = 1px/sec, 1000% = 10px/sec)
- **Timecode format**: See PRD Appendix B (HH:MM:SS.mmm, update ≥30fps)
- **Session persistence**: Story 8 will handle auto-save on close; this story just updates state
- **Preview Player integration**: Story 6 will sync playhead with preview; this story just tracks playhead position
- **Performance**: Use React DevTools Profiler + Chrome DevTools Performance tab to measure
- **Test gates are the specification** — they define "done"
- **Break work into <1 hour chunks** — complete IPC handlers first, then components one-by-one
- **Document blockers immediately** — if FFmpeg or file system issues arise, note them in this TODO

---

**Next Steps:**
1. ✅ Review this TODO with user (get approval before implementing)
2. Create branch `feat/timeline-view` from `develop`
3. Implement IPC handlers (Section 1)
4. Implement React components (Section 2)
5. Test manually (Section 5)
6. Verify performance (Section 6)
7. Wait for user approval
8. Commit & create PR (Section 8)
