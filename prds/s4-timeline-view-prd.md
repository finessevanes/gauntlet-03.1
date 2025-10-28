# PRD: Timeline View

**Feature**: Timeline View (Story 4) | **Status**: Draft | **Agent**: Pam | **Phase**: 2 (Core Editing)

**Version**: 1.0
**Date**: October 28, 2025
**Related User Story**: Story 4 (USER_STORIES.md, lines 88-113)

---

## Preflight Questionnaire

| # | Question | Answer |
|---|----------|--------|
| 1 | Smallest end-to-end user outcome? | User drags a clip from Library onto Timeline, it appears in sequence, and can be reordered |
| 2 | Primary user + critical action? | Video editor arranging clips by dragging them on a horizontal timeline |
| 3 | Must-have vs nice-to-have? | MUST: Drag, reorder, delete, playhead, proportional clip widths. SHOULD: Auto-snap, zoom slider, scroll |
| 4 | Offline/persistence needs? | No persistence in this feature (Story 8 handles session save/restore) |
| 5 | Performance targets? | <50ms drag response, 60fps dragging/scrolling, 10+ clips smooth |
| 6 | Error/edge cases? | Empty timeline, broken clips, zoom boundaries (100%-1000%), concurrent operations |
| 7 | Data model changes? | TimelineClip extends Clip; Timeline state: clips[], zoom, playhead, scrollX |
| 8 | Service/command APIs needed? | add_clip_to_timeline, reorder_timeline_clip, delete_timeline_clip, set_timeline_zoom, set_playhead_position |
| 9 | React components? | Timeline.tsx (container), TimelineClip.tsx (clip block), TimelinePlayhead.tsx (playhead), TimelineControls.tsx (zoom + timecode) |
| 10 | Desktop-specific needs? | Responsive to window resize, center panel scaling, drop-zone for Library drag-drop |
| 11 | Out of scope? | Trimming (Story 5), audio editing, effects/transitions, multiple tracks, undo/redo |

---

## 1. Summary

The Timeline View feature allows users to arrange imported video clips in a linear sequence by dragging them from the Library onto a visual timeline. Users can reorder clips horizontally, delete them, and see a playhead indicating current playback position. The timeline supports zoom (100%-1000%) and auto-scrolling when zoomed, enabling editing of both short and long sequences.

---

## 2. Non-Goals / Scope Boundaries

**Explicitly out of scope:**
- **Trimming clips** (in/out point adjustment) — Handled by Story 5 (Trim Functionality)
- **Undo/Redo** — Not mentioned in acceptance criteria; not required for MVP
- **Multiple tracks/layers** — Single linear timeline only
- **Audio-only tracks** — Audio follows video (no independent audio track editing)
- **Effects/transitions** — Story 7+ if needed
- **Clip duration rounding** — Uses exact durations from source files (no manual adjustment except trim)

---

## 3. Experience (UX)

### Entry Points
- **Primary**: Library view → User drags clip onto Timeline to add
- **Secondary**: Timeline → User reorders, deletes, or seeks playhead

### User Flow (Happy Path)
1. User clicks Library or has Library panel visible
2. User drags one or more clips from Library cards
3. Drag enters Timeline drop zone → drop zone highlights (visual feedback)
4. User releases → clip(s) appear at drop position, auto-snap to adjacent clips
5. User sees clip block with:
   - Clip name/thumbnail (optional)
   - Duration label on clip block
   - Visual width proportional to duration
6. User can drag clip horizontally → reorders within timeline (no gaps)
7. User right-clicks clip → "Delete" option OR presses Delete key → clip removed
8. User clicks on timeline or drags playhead → previews that moment in Player (Story 6)
9. User adjusts zoom slider (100%-1000%) → timeline rescales
10. When zoomed in, horizontal scroll bar appears

### States
- **Empty**: Timeline shows placeholder text "Drag clips here to start editing"
- **Loading**: Clip being added (brief spinner)
- **Idle**: Clips on timeline, playhead at position, ready for interaction
- **Dragging**: User actively reordering clip or scrubbing playhead
- **Error**: Clip broken (source file missing) — shows broken icon + tooltip

### Desktop Considerations
- **Window resize**: Timeline panel scales with window (stays at 30% height, full width)
- **Multi-monitor**: Timeline renders in center panel regardless of monitor layout
- **App close**: State saved by Story 8 persistence (not this feature's responsibility)

---

## 4. Functional Requirements

### MUST (Core Features)

#### 4.1 Drag Clips from Library to Timeline
- User drags one or more clips from Library panel → drops onto Timeline drop zone
- **Gate**: Dragged clip appears in timeline at drop position within 200ms
- **Gate**: If timeline empty, clip appears at start (position 0)
- **Gate**: If timeline has clips, dropped clip inserts at position OR appends (design choice: append at end for simplicity)
- **Gate**: Drag of multiple clips simultaneously → all appear in sequence (order preserved from Library)

#### 4.2 Display Clip Blocks with Proportional Width
- Each clip on timeline displays as a colored block
- **Gate**: Block width is proportional to clip duration (e.g., 30-second clip is 2x wider than 15-second)
- **Gate**: Clip block displays:
  - Clip filename (truncated if long)
  - Duration in MM:SS format (on the block)
  - Optional thumbnail (first frame, nice-to-have)
- **Gate**: At 100% zoom (1 px/sec), 60-second clip is ~60px wide
- **Gate**: At 1000% zoom (10 px/sec), 60-second clip is ~600px wide

#### 4.3 Red Vertical Playhead
- Timeline displays a thin red vertical line indicating current playback position
- **Gate**: Playhead starts at position 0 (beginning) on load
- **Gate**: Playhead position updates in real-time during playback (synced with Player in Story 6)
- **Gate**: User can click on timeline → playhead moves to that position
- **Gate**: User can drag playhead → scrubbing (updates preview in real-time, <100ms latency)

#### 4.4 Timecode Display
- Display above timeline shows current playhead position in HH:MM:SS.mmm format
- **Gate**: Timecode updates as playhead moves (frame-accurate, ≥30fps update rate)
- **Gate**: Shows total timeline duration (e.g., "00:00:05.000 / 00:01:30.000")

#### 4.5 Reorder Clips Horizontally
- User can drag a clip block horizontally on the timeline to change its order
- **Gate**: Dragging clip past adjacent clip → clips swap positions (no gaps, no overlaps)
- **Gate**: Dragging clip beyond timeline bounds → clips reorder, new scroll position calculated
- **Gate**: Clips auto-snap to adjacent clips (no manual alignment needed)
- **Gate**: Drag response time <50ms (feels responsive)

#### 4.6 Delete Clips
- User can right-click on clip block → context menu shows "Delete" option
- **OR** User selects clip and presses Delete key
- **Gate**: Clicking "Delete" removes clip from timeline immediately
- **Gate**: Remaining clips auto-snap together (no gaps)
- **Gate**: No confirmation dialog (can undo via Story 8 session restore if needed)

#### 4.7 Zoom Control (100%-1000%)
- Timeline includes zoom slider or +/- buttons above timeline
- **Gate**: Slider defaults to "Auto-fit" (entire timeline visible without scroll)
- **Gate**: User can set zoom from 100% to 1000% (10x magnification)
- **Gate**: 100% zoom = ~1 pixel per second (60-second clip ≈ 60px wide)
- **Gate**: 1000% zoom = ~10 pixels per second (60-second clip ≈ 600px wide)
- **Gate**: Zoom change is smooth transition (no jank)

#### 4.8 Horizontal Scroll
- When timeline zoomed in (>auto-fit), horizontal scroll bar appears below timeline
- **Gate**: User can drag scrollbar or use keyboard (arrow keys) to navigate
- **Gate**: Playhead stays visible during scroll (auto-scroll if playhead near edge)

#### 4.9 Timeline Auto-Fit on Load
- When app loads (or new session), timeline auto-fits to show all clips without scroll
- **Gate**: Entire timeline visible at launch (zoom adjusted to fit all clips)
- **Gate**: If timeline empty, zoom is neutral (e.g., 100%)

#### 4.10 Empty State
- When timeline has no clips, display centered placeholder text: "Drag clips here to start editing"
- **Gate**: Placeholder disappears when first clip added
- **Gate**: Reappears if all clips deleted

### SHOULD (Nice-to-Have)

#### 4.11 Broken Clip Indicator
- If clip's source file is missing (deleted after import), clip block shows broken icon
- **Gate**: Tooltip on hover: "Source file not found: [filename]"
- **Gate**: User can still delete broken clip from timeline
- **Gate**: Note: Actual file checking happens in Story 7 (Export validation); this is visual indicator only

#### 4.12 Clip Snap-to-Grid
- Clips optionally snap to grid lines (1-second or 5-second intervals) for precise alignment
- **Gate**: Snapping is automatic (no toggle needed for MVP)
- **Gate**: User can drag past snap point slightly without snapping (hysteresis)

---

## 5. Data Model

### TypeScript Interfaces

```typescript
/**
 * Clip as imported from Library (from Story 2)
 */
interface Clip {
  id: string;                // UUID, unique across imports
  filePath: string;          // Absolute path to source file
  fileName: string;          // Display name (from filename)
  duration: number;          // Total duration in seconds (float)
  thumbnailPath: string;     // Path to cached thumbnail (first frame)
  inPoint: number;           // Trim start (seconds, Story 5)
  outPoint: number;          // Trim end (seconds, Story 5)
}

/**
 * Clip in Timeline context (adds position/order metadata)
 */
interface TimelineClip {
  id: string;                // Same as Clip.id
  clipId: string;            // Reference to Clip
  position: number;          // Order in timeline (0, 1, 2, ...)
  startTime: number;         // Absolute start time on timeline (seconds)
}

/**
 * Timeline state (in-memory, persisted by Story 8)
 */
interface TimelineState {
  clips: TimelineClip[];     // Clips on timeline in order
  playheadPosition: number;  // Current playhead time (seconds)
  zoomLevel: number;         // Zoom percentage (100-1000)
  scrollX: number;           // Horizontal scroll position (pixels)
  isPlaying: boolean;        // Playback state (managed by Story 6)
}

/**
 * Session state (persisted by Story 8 on app close)
 */
interface SessionState {
  importedClips: Clip[];     // All imported clips (from Story 2)
  timeline: TimelineState;   // Timeline state
  zoom: number;              // Current zoom level
  scrollPosition: number;    // Scroll position
}
```

### Storage Strategy

- **In-Memory**: `TimelineState` stored in React Context or Zustand store (fast reads/writes during editing)
- **Persistence**: `SessionState` serialized to JSON by Story 8 (electron-store or localStorage)
- **Validation**:
  - Clip IDs in TimelineClip must reference valid Clip entries
  - Zoom level must be 100-1000
  - Playhead position must be ≥0 and ≤ total timeline duration
  - No gaps or overlaps in clip order

---

## 6. Service/Command APIs

All APIs are Electron IPC handlers (Node.js main process ↔ React frontend via `ipcRenderer.invoke()`).

### Handler 1: `add_clip_to_timeline`
**Purpose**: Add a clip from Library to the end of timeline

**Input**:
```typescript
{
  clipId: string;      // ID of clip to add (from Library)
  position?: number;   // Insert position (optional, default: end)
}
```

**Output**:
```typescript
{
  success: boolean;
  timelineClip?: {
    id: string;
    clipId: string;
    position: number;
    startTime: number;
  };
  error?: string;
}
```

**Pre-Conditions**:
- Clip with given clipId exists in Library
- Timeline has capacity (no hard limit, but perf tested with 10+ clips)

**Post-Conditions**:
- Clip added to timeline in specified position
- Clips after insertion are renumbered
- Timeline duration updated

**Error Handling**:
- `Clip not found: [clipId]` → Invalid clip ID
- `Invalid position` → Position out of range
- Return `{ success: false, error: "..." }`

---

### Handler 2: `reorder_timeline_clip`
**Purpose**: Move a clip to a new position (horizontal drag)

**Input**:
```typescript
{
  clipId: string;      // ID of clip to move
  newPosition: number; // New order index
}
```

**Output**:
```typescript
{
  success: boolean;
  updatedTimeline?: TimelineClip[];
  error?: string;
}
```

**Pre-Conditions**:
- Clip with given clipId exists on timeline
- newPosition is valid (0 to clips.length-1)

**Post-Conditions**:
- Clip moved to newPosition
- Clips between old/new position shifted
- startTime recalculated for affected clips

**Error Handling**:
- `Clip not found` → Clip not on timeline
- `Invalid position` → Out of range
- Return error with current timeline (rollback)

---

### Handler 3: `delete_timeline_clip`
**Purpose**: Remove a clip from timeline

**Input**:
```typescript
{
  clipId: string;  // ID of clip to delete
}
```

**Output**:
```typescript
{
  success: boolean;
  updatedTimeline?: TimelineClip[];
  error?: string;
}
```

**Pre-Conditions**:
- Clip exists on timeline

**Post-Conditions**:
- Clip removed from timeline
- Remaining clips renumbered
- startTime recalculated

**Error Handling**:
- `Clip not found` → Not on timeline
- Return error with current timeline

---

### Handler 4: `set_timeline_zoom`
**Purpose**: Set zoom level

**Input**:
```typescript
{
  zoomLevel: number;  // 100-1000 (or "auto" for auto-fit)
}
```

**Output**:
```typescript
{
  success: boolean;
  zoomLevel?: number;
  error?: string;
}
```

**Pre-Conditions**:
- zoomLevel is 100-1000 or "auto"

**Post-Conditions**:
- Zoom level updated in state

**Error Handling**:
- `Invalid zoom level` → Outside bounds

---

### Handler 5: `set_playhead_position`
**Purpose**: Move playhead to a specific time

**Input**:
```typescript
{
  time: number;  // Time in seconds
}
```

**Output**:
```typescript
{
  success: boolean;
  playheadPosition?: number;
  error?: string;
}
```

**Pre-Conditions**:
- time is ≥0 and ≤ total timeline duration

**Post-Conditions**:
- Playhead moved to time
- Preview player updates (Story 6 integration)

**Error Handling**:
- `Invalid time` → Out of bounds
- Clamp time to valid range (0 to duration)

---

### Handler 6: `get_timeline_state`
**Purpose**: Fetch current timeline state (for initialization)

**Input**: None

**Output**:
```typescript
TimelineState
```

**Used for**: React component initialization on mount

---

## 7. Components to Create/Modify

### New Components

| Component | Path | Purpose |
|-----------|------|---------|
| `Timeline` | `src/components/Timeline.tsx` | Main timeline container with drop zone, clip blocks, playhead, controls |
| `TimelineClip` | `src/components/TimelineClip.tsx` | Individual clip block, render clip name/duration, handle drag reorder |
| `TimelinePlayhead` | `src/components/TimelinePlayhead.tsx` | Red vertical line showing current playback position |
| `TimelineControls` | `src/components/TimelineControls.tsx` | Zoom slider, timecode display, play/pause buttons |
| `TimelineRuler` | `src/components/TimelineRuler.tsx` | Ruler showing time markers (0, 5s, 10s, etc.) |

### Modified Components

| Component | Change | Purpose |
|-----------|--------|---------|
| `src/components/Library.tsx` | Add drag source handler | Enable dragging clips from Library to Timeline |
| `src/components/MainLayout.tsx` | Add Timeline to layout | Timeline occupies bottom 30% of window |

### IPC Handlers (Electron Main)

| Handler | Path | Purpose |
|---------|------|---------|
| `add_clip_to_timeline` | `src/main/ipc-handlers/timeline.ts` | Add clip to timeline |
| `reorder_timeline_clip` | `src/main/ipc-handlers/timeline.ts` | Reorder clips |
| `delete_timeline_clip` | `src/main/ipc-handlers/timeline.ts` | Delete clip |
| `set_timeline_zoom` | `src/main/ipc-handlers/timeline.ts` | Set zoom level |
| `set_playhead_position` | `src/main/ipc-handlers/timeline.ts` | Move playhead |
| `get_timeline_state` | `src/main/ipc-handlers/timeline.ts` | Get current state |

---

## 8. Integration Points

### File System
- **Clip thumbnails**: Read from cache (generated in Story 2)
- **Session state**: Loaded/saved by Story 8 (not this feature)

### Electron IPC
- React components invoke handlers via `ipcRenderer.invoke()`
- Main process maintains timeline state in memory
- State persisted by Story 8 (electron-store or localStorage)

### State Management
- **Approach**: React Context + useReducer OR Zustand store
- **State**: TimelineState (clips, playhead, zoom, scroll)
- **Events**: Update state on each action (add, reorder, delete, zoom, playhead)

### Desktop Lifecycle
- **Window resize**: Timeline panel height fixed (30%), width scales to window
- **App close**: Story 8 persists timeline state
- **App launch**: Story 8 restores timeline state

### Drag & Drop
- **Source**: Library.tsx (react-beautiful-dnd or native HTML5 drag)
- **Target**: Timeline.tsx (drop zone)
- **Integration**: Drag event passes clip ID → `add_clip_to_timeline` handler

### Player Integration (Story 6)
- Timeline playhead position synced with Player preview
- Clicking timeline/dragging playhead updates Player frame

---

## 9. Testing & Acceptance Gates

### Happy Path 1: Drag Clip to Empty Timeline
**Flow:**
1. User opens app with empty timeline
2. User drags a single MP4 clip from Library panel
3. User drops clip onto timeline

**Expected**: Clip appears on timeline with:
- Filename visible
- Duration displayed in MM:SS
- Block width proportional to duration
- Playhead at position 0

**Pass Criteria**: No errors, clip visible within 200ms

---

### Happy Path 2: Drag Multiple Clips in Sequence
**Flow:**
1. Timeline has 1 clip
2. User drags 2 more clips from Library
3. User drops clips onto timeline

**Expected**: All 3 clips appear in sequence, no gaps, auto-snapped

**Pass Criteria**: Order preserved, total duration = sum of all 3 clips

---

### Happy Path 3: Reorder Clips Horizontally
**Flow:**
1. Timeline has 3 clips: A (30s), B (45s), C (30s)
2. User drags clip C to position 0 (before A)

**Expected**: Timeline becomes C, A, B; no gaps

**Pass Criteria**: Drag response <50ms, reorder smooth

---

### Happy Path 4: Delete Clip
**Flow:**
1. Timeline has 3 clips
2. User right-clicks on clip B → clicks "Delete"

**Expected**: Clip B removed, A and C remain, auto-snapped

**Pass Criteria**: No gaps, total duration = A duration + C duration

---

### Happy Path 5: Zoom & Scroll
**Flow:**
1. Timeline has 10 clips totaling 5 minutes
2. Zoom auto-fits entire timeline
3. User adjusts zoom to 500%
4. User drags horizontal scroll bar to mid-timeline

**Expected**: Timeline rescales, scroll bar visible, can navigate

**Pass Criteria**: All clips visible at 500% zoom with horizontal scroll

---

### Happy Path 6: Playhead Scrub
**Flow:**
1. Timeline has 1 clip (60s)
2. User drags playhead to 30s mark
3. Timecode shows 00:00:30.000

**Expected**: Playhead moves, preview updates in real-time

**Pass Criteria**: <100ms latency, timecode accurate

---

### Edge Case 1: Empty Timeline
**Test**: App launches with no clips on timeline

**Expected**: "Drag clips here to start editing" placeholder visible, no errors

**Pass Criteria**: Placeholder appears, disappears when first clip added

---

### Edge Case 2: Broken Clip
**Test**: Source file deleted after import; user tries to add clip to timeline

**Expected**: Clip still appears on timeline (file path stored), broken icon visible

**Pass Criteria**: No crash, tooltip shows "Source file not found"

**Note**: Export will validate and fail (Story 7)

---

### Edge Case 3: Large Timeline (30 minutes)
**Test**: Timeline with 10+ clips totaling 30 minutes at 100% zoom

**Expected**: Timeline renders, scroll works, no jank

**Pass Criteria**: Smooth dragging, responsive UI, <1GB memory

---

### Edge Case 4: Zoom Boundaries
**Test**: User sets zoom to 100%, then 1000%, then "auto"

**Expected**: All transitions smooth, clips visible at each zoom level

**Pass Criteria**: No errors, snap-to boundary behavior consistent

---

### Error Case 1: Drag Invalid Clip
**Test**: User drags a broken/missing clip from Library to timeline

**Expected**: Clip still added (validation happens on export), appears with warning icon

**Pass Criteria**: No crash, error handled gracefully

---

### Error Case 2: Rapid Reordering
**Test**: User rapidly drags clips up and down (stress test)

**Expected**: UI responsive, no dropped events, final state correct

**Pass Criteria**: Drag events queued, final timeline state consistent

---

### Performance Gates
- **Drag response**: <50ms from mouse move to visual update
- **Zoom transition**: Smooth, no jank (60fps during zoom)
- **Timeline with 10+ clips**: All interactions smooth (no lag)
- **Memory**: <1GB with 10 clips + full session state

---

## 10. Definition of Done

- [ ] All 6 IPC handlers implemented with error handling
- [ ] React components (Timeline, TimelineClip, TimelinePlayhead, TimelineControls, TimelineRuler) created
- [ ] Drag & drop from Library to Timeline working end-to-end
- [ ] Reorder clips horizontally with <50ms response time
- [ ] Delete clips from timeline (right-click + Delete key)
- [ ] Zoom slider (100%-1000%) + auto-fit working
- [ ] Horizontal scroll bar visible when zoomed in
- [ ] Playhead display + timecode (HH:MM:SS.mmm) updating in real-time
- [ ] All happy path tests pass (6 scenarios)
- [ ] All edge case tests pass (4 scenarios)
- [ ] All error case tests pass (2 scenarios)
- [ ] Performance targets met:
  - [ ] Drag <50ms response
  - [ ] 60fps dragging/scrolling
  - [ ] 10+ clips smooth
  - [ ] <1GB memory
- [ ] No console warnings or errors during testing
- [ ] Code comments on complex logic (drag handlers, zoom calculation)
- [ ] README updated with Timeline feature description

---

## 11. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| **Drag & drop performance** | Large timelines slow during drag | Virtualize clip rendering (show only visible clips), debounce position updates |
| **Playhead sync with Player** | Playhead and preview out of sync during scrub | Sync at frame level, use shared timestamp (Story 6 dependency) |
| **Memory with many clips** | Memory leak or high usage | Use React.memo for TimelineClip, test with 20+ clips before shipping |
| **Zoom calculation errors** | Incorrect clip width scaling | Test zoom at 100%, 500%, 1000% with various clip durations (1s, 60s, 300s) |
| **File path handling** | Broken clips if files moved/deleted | Check file existence on export (Story 7), show warning in timeline (visual indicator) |
| **Horizontal scroll edge cases** | Scroll stuck or playhead off-screen | Test auto-scroll when playhead near edge, ensure scroll syncs with clip positions |

---

## Appendix A: Zoom Calculation Formula

```
pixelsPerSecond = (zoomLevel / 100) * basePixelsPerSecond
basePixelsPerSecond = 1  // 100% zoom = 1 px/sec

Example:
- 100% zoom: 1 px/sec → 60-second clip = 60px
- 500% zoom: 5 px/sec → 60-second clip = 300px
- 1000% zoom: 10 px/sec → 60-second clip = 600px

Auto-fit calculation:
containerWidth = timelineContainerWidth  // pixels
totalDuration = sum of all clip durations  // seconds
zoomLevel = (containerWidth / totalDuration) * 100
```

---

## Appendix B: Timecode Format

```
HH:MM:SS.mmm format

Example:
- 00:00:05.000 = 5 seconds
- 00:01:30.500 = 90.5 seconds
- 00:05:00.000 = 300 seconds (5 minutes)

Update at ≥30fps (every 33ms)
```

---

## Appendix C: Acceptance Criteria Cross-Reference

This PRD maps directly to Story 4 acceptance criteria from USER_STORIES.md:

| Story AC | PRD Section | Test Gate |
|----------|------------|-----------|
| Timeline horizontal track, 30% height | Section 3 UX | Window resize behavior |
| Clip blocks with proportional width | Section 4.2 | Zoom tests, Section 9 Edge Case 3 |
| Red vertical playhead | Section 4.3 | Happy Path 6, Playhead Scrub |
| Timecode HH:MM:SS.mmm | Section 4.4 | Happy Path 6, Timecode accuracy |
| Drag clips from Library | Section 4.1 | Happy Path 1-2, Integration Section 8 |
| Drag clip horizontally to reorder | Section 4.5 | Happy Path 3, Drag response <50ms |
| Right-click Delete + Delete key | Section 4.6 | Happy Path 4, Error Case 1 |
| Auto-snap together (no gaps) | Section 4.5 | All happy paths, Edge Case 3 |
| Zoom 100%-1000% + auto-fit | Section 4.7, 4.9 | Happy Path 5, Edge Case 4 |
| Horizontal scroll when zoomed | Section 4.8 | Happy Path 5, Edge Case 4 |
| 10+ clips smooth at auto-fit | Section 9 Performance | Edge Case 3, Performance Gates |
| Empty state placeholder | Section 4.10 | Edge Case 1 |

---

**End of PRD**
