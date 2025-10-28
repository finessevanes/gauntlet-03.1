# TODO — Library View

**Branch**: `feat/library-view`
**Source**: Story 3: Library View (User Stories, lines 65-87)
**PRD Reference**: `prds/s3-library-view-prd.md`
**Owner (Agent)**: Caleb

---

## 0. Pre-Implementation

- [ ] Read user story and acceptance criteria thoroughly
- [ ] Read PRD sections: Summary, Functional Requirements, Testing & Acceptance Gates, Definition of Done
- [ ] Clarify any ambiguities before starting
- [ ] Identify test gates from PRD Section 9 (Testing & Acceptance Gates)
- [ ] Verify dependencies: Story 1 (App Launch) ✅ and Story 2 (Video Import) ✅ are complete

**Key Requirements Summary**:
- Library panel (left sidebar, 20% width) displays all imported clips
- Each ClipCard shows: thumbnail, filename (truncated), duration (MM:SS)
- Click on clip → notify preview player (Story 6 stub for now)
- Drag clip from Library → initiate drag event for Timeline (Story 4)
- Empty state when no clips imported
- Broken file detection (source file moved/deleted)
- Smooth scrolling with 20+ clips (60fps)

---

## 1. Service/Command Layer (Electron IPC)

Implement file validation handler in Electron main process.

- [x] Create `src/main/ipc-handlers/library.ts`
  - Handler: `library:check-file-exists`
  - Input: `{ filePath: string }`
  - Output: `{ exists: boolean, error?: string }`
  - Use Node.js `fs.access()` to validate file exists and is readable
  - Error handling: ENOENT (file not found), EACCES (permission denied), invalid path
  - Test: Valid file path returns `exists: true`; missing file returns `exists: false` with error message

- [x] Register handler in `src/main.ts`
  - Import `libraryHandlers` from `src/main/ipc-handlers/library.ts`
  - Call handler registration function in `app.whenReady()`
  - Test: IPC handler responds correctly when invoked from renderer

- [x] Add IPC types to `src/types/ipc.ts`
  - Add `library:check-file-exists` to IPC channel types
  - Input/output interface: `CheckFileExistsRequest`, `CheckFileExistsResponse`
  - Test: TypeScript compilation succeeds

- [x] Update `src/preload.ts` to expose library IPC methods
  - Add `checkFileExists` method to window API
  - Test: Method available in renderer process

---

## 2. React Components & State

Create Library container and modify ClipCard for interactivity.

### 2.1 BrokenFileIcon Component

- [x] Create `src/components/BrokenFileIcon.tsx`
  - Display red X or broken file symbol
  - Accept `tooltip` prop for error message
  - Styling: Red color, small size (16x16px), absolute positioned over thumbnail
  - Test: Renders without crashing, tooltip displays on hover

### 2.2 Library Container Component

- [x] Create `src/components/Library.tsx`
  - Subscribe to `clips` from `useSessionStore`
  - State: `selectedClipId: string | null` (currently previewed clip)
  - State: `brokenFiles: Set<string>` (clip IDs with missing source files)
  - Layout: Left sidebar, 20% width, full height, fixed position
  - Background: Dark gray (#1a1a1a)
  - Padding: 12px
  - Test: Component renders, displays empty state when `clips.length === 0`

- [x] Implement file validation check on mount
  - On mount, call `window.electron.library.checkFileExists()` for each clip
  - Update `brokenFiles` Set with clip IDs that have missing source files
  - Debounce checks to avoid performance issues
  - Test: Broken files correctly identified and added to Set

- [x] Render ClipCard for each clip
  - Map over `clips` array
  - Pass `clip`, `isSelected`, `isBroken`, `onClick`, `onDragStart` props
  - Grid layout: 1 column, gap 12px
  - Test: All clips render with correct props

- [x] Add vertical scrolling
  - CSS: `overflow-y: auto`, smooth scrolling
  - Custom scrollbar styling (thin, dark)
  - Test: Scrolls smoothly with 20+ clips

### 2.3 Modify ClipCard Component

- [x] Update `src/components/ClipCard.tsx` to accept new props
  - Props: `onClick?: () => void`, `onDragStart?: (e: React.DragEvent) => void`, `isSelected?: boolean`, `isBroken?: boolean`
  - Test: Props accepted, TypeScript types valid

- [x] Add click handler
  - onClick → call prop function
  - Visual feedback: Subtle highlight on hover, border when selected
  - Test: Click invokes handler, visual state updates

- [x] Add drag-and-drop support
  - Set `draggable={!isBroken}` (disable drag for broken files)
  - onDragStart → call prop function, set `dataTransfer` with clip data
  - Drag ghost: Semi-transparent copy of ClipCard
  - Test: Drag initiates, `dataTransfer` contains clip ID

- [x] Add broken file visual indicator
  - If `isBroken === true`, show red border and BrokenFileIcon overlay
  - Tooltip: "Source file not found: [filepath]"
  - Disable drag (cursor: not-allowed)
  - Test: Broken state displays correctly

- [x] Filename truncation
  - CSS: `text-overflow: ellipsis`, `max-width` based on card width
  - Tooltip shows full filename on hover
  - Test: Long filenames truncate, tooltip displays full name

- [x] Hover effect
  - Subtle background lightening on hover (if not broken)
  - Transform: slight scale (1.02) on hover
  - Test: Hover effect smooth, no layout shift

### 2.4 EmptyState Component Modification

- [x] Update `src/components/EmptyState.tsx` for Library-specific message
  - Accept `type` prop: "library" or "timeline" (already exists)
  - Library variant message: "Drag & drop video files or click Import to get started" (already exists)
  - Icon: Upload cloud or video file icon (already exists)
  - Center vertically and horizontally in Library panel (already exists)
  - Test: Library empty state displays correctly

---

## 3. Data Model & Persistence

No new data model changes; Library reads from existing session state.

- [ ] Verify Clip interface in `src/types/session.ts` has all required fields
  - id, filePath, filename, duration, thumbnail, resolution, frameRate, codec, bitrate
  - Test: TypeScript compilation succeeds

- [ ] Verify `useSessionStore` provides clips array
  - `clips: Clip[]` available via Zustand store
  - Test: Library component can read clips from store

---

## 4. Integration

Wire Library to session state, IPC handlers, and prepare for Story 4/6 integration.

- [x] Integrate Library into MainLayout
  - Import Library component in `src/components/MainLayout.tsx`
  - Position as left panel (20% width)
  - Test: Library displays in app layout

- [x] Implement click-to-preview handler (Story 6 stub)
  - onClick → Update `selectedClipId` state in Library
  - Console log: "Preview clip: [clip.id]" (Story 6 will implement actual preview)
  - Test: Click logs clip ID, selectedClipId state updates

- [x] Implement drag-to-timeline handler (Story 4 stub)
  - onDragStart → Set `dataTransfer.setData('clipId', clip.id)`
  - Set `dataTransfer.effectAllowed = 'copy'`
  - Console log: "Dragging clip: [clip.id]" (Story 4 Timeline will handle drop)
  - Test: Drag initiates, dataTransfer contains clip ID

- [x] Test file validation integration
  - Import 3 clips
  - Manually delete 1 source file
  - Wait 5 seconds (periodic check triggers automatically)
  - Verify: Deleted file shows broken state, others normal
  - Test: Broken file detection works end-to-end
  - **Fix applied**: Added periodic re-check every 5 seconds to detect file deletions

- [ ] Test real-time updates when clips added
  - Import new clip via Story 2 flow
  - Verify: New clip appears in Library immediately
  - Test: Library updates reactively when session store clips array changes

---

## 5. Manual Testing

**Reference testing gates from PRD Section 9 (Testing & Acceptance Gates):**

### Happy Path

- [x] **HP1: Display Clips** — Import 5 clips (Story 2)
  - Verify: All 5 appear in Library with thumbnails, filenames, durations in MM:SS
  - Verify: Scrollable if needed, layout correct

- [x] **HP2: Click to Preview** — Library with 3 clips
  - Verify: Click middle clip → Console logs clip ID (Story 6 stub)
  - Verify: selectedClipId state updates, visual selection indicator shows

- [x] **HP3: Drag to Timeline** — Library with 2 clips
  - Verify: Drag clip → Drag ghost visible, console logs clip ID
  - Verify: dataTransfer contains clip ID (Story 4 will handle drop)

### Edge Cases

- [x] **EC1: Empty State** — Fresh app launch, no clips
  - Verify: Empty state message displays: "Drag & drop video files or click Import to get started"
  - Verify: Icon visible, no errors in console

- [x] **EC2: 20+ Clips Scroll** — Import 25 clips
  - Verify: Library scrolls smoothly (60fps target)
  - Verify: All clips render, scroll bar visible, no lag

- [x] **EC3: Long Filename** — Import clip with 80-char filename
  - Verify: Filename truncated at ~30 chars with ellipsis
  - Verify: Hover tooltip shows full filename

- [ ] **EC4: Very Short Clip** — Import 1-second clip
  - Verify: Duration displays "0:01" in MM:SS format
  - Verify: Thumbnail shown, clickable, draggable

### Error Handling

- [x] **ERR1: Missing Source File** — Import clip, manually delete source file, relaunch app
  - Verify: Broken file indicator shown (red border, broken icon)
  - Verify: Tooltip: "Source file not found: [path]"
  - Verify: Drag disabled (cursor: not-allowed)

- [ ] **ERR2: Broken Thumbnail** — Clip with invalid base64 thumbnail data (manual test with corrupted data)
  - Verify: Placeholder icon shown (🎥 emoji fallback)
  - Verify: Filename and duration still visible
  - Verify: No crash

- [ ] **ERR3: Invalid Session Data** — Corrupt clips array in session.json (test with `clips: null` or malformed data)
  - Verify: App launches, Library shows empty state
  - Verify: Error logged to console, no crash

### Performance

- [ ] **PERF: 100 Clips Render** — Import 100 clips (use test script or repeat imports)
  - Verify: All render, app responsive
  - Verify: <2s initial render time
  - Verify: Smooth scroll, <200MB memory growth
  - Verify: No freeze or crash

- [ ] No console errors during all test scenarios
- [ ] Feature feels responsive (no lag on click, drag, scroll)

---

## 6. Performance (if applicable)

- [ ] Verify performance targets from PRD Section 2 (Non-Functional Requirements)
  - Smooth scrolling with 20+ clips (60fps)
  - Clip card render <50ms
  - Thumbnail loading <100ms per card
  - Memory stable (<1GB with 100+ clips)
  - Test: Run performance checklist from Manual Testing Section 5

- [ ] Consider React virtualization (react-window) if >50 clips cause lag
  - Test with 100 clips first
  - Only implement if scrolling drops below 60fps
  - Document decision in Notes section

---

## 7. Definition of Done

- [ ] All acceptance criteria from user story (USER_STORIES.md lines 72-83) pass
- [ ] All test gates from PRD Section 9 pass (HP1-3, EC1-4, ERR1-3, PERF)
- [ ] Code has comments for complex logic (file validation, drag handlers)
- [ ] No console warnings or errors during testing
- [ ] Library displays in app layout (integrated into MainLayout)
- [ ] Click-to-preview stub logs clip ID (ready for Story 6)
- [ ] Drag-to-timeline stub sets dataTransfer (ready for Story 4)
- [ ] Empty state displays correctly
- [ ] Broken file detection works end-to-end
- [ ] Smooth scrolling with 20+ clips

---

## 8. PR & Merge

⚠️ **CRITICAL**: DO NOT COMMIT UNTIL USER CONFIRMS ALL TEST GATES PASS

- [ ] Create branch `feat/library-view` from develop
  - `git checkout develop && git pull origin develop`
  - `git checkout -b feat/library-view`

- [ ] Implementation complete, all tasks above checked off

- [ ] User confirms all test gates pass ← WAIT FOR THIS
  - HP1: Display Clips ✅
  - HP2: Click to Preview ✅
  - HP3: Drag to Timeline ✅
  - EC1: Empty State ✅
  - EC2: 20+ Clips Scroll ✅
  - EC3: Long Filename ✅
  - EC4: Very Short Clip ✅
  - ERR1: Missing Source File ✅
  - ERR2: Broken Thumbnail ✅
  - ERR3: Invalid Session Data ✅
  - PERF: 100 Clips Render ✅

- [ ] User says "ready to commit" or "looks good"

- [ ] THEN: Commit changes (logical grouping)
  - Commit 1: IPC handler (`git add src/main/ipc-handlers/library.ts src/main.ts src/types/ipc.ts src/preload.ts`)
    - Message: `feat: add library:check-file-exists IPC handler`
  - Commit 2: Components (`git add src/components/Library.tsx src/components/BrokenFileIcon.tsx`)
    - Message: `feat: add Library container and BrokenFileIcon components`
  - Commit 3: ClipCard updates (`git add src/components/ClipCard.tsx`)
    - Message: `feat: add click and drag handlers to ClipCard`
  - Commit 4: EmptyState update (`git add src/components/EmptyState.tsx`)
    - Message: `feat: add library variant to EmptyState`
  - Commit 5: MainLayout integration (`git add src/components/MainLayout.tsx`)
    - Message: `feat: integrate Library into MainLayout`
  - Commit 6: TODO update (`git add todos/s3-library-view-todo.md`)
    - Message: `docs: mark library view tasks as complete`

- [ ] Push branch: `git push origin feat/library-view`

- [ ] Open PR with gh CLI:
```bash
gh pr create \
  --base develop \
  --head feat/library-view \
  --title "Library View (Story 3)" \
  --body "## Summary
Implements Library View feature: displays imported clips in scrollable left panel with click-to-preview and drag-to-timeline support.

## What Changed
- Added `library:check-file-exists` IPC handler for file validation
- Created `Library.tsx` container component (left sidebar, 20% width)
- Created `BrokenFileIcon.tsx` for missing source files
- Updated `ClipCard.tsx` with click and drag handlers
- Updated `EmptyState.tsx` with library variant
- Integrated Library into `MainLayout.tsx`

## Testing
- [x] HP1-3: Happy path gates pass (display, click, drag)
- [x] EC1-4: Edge cases handled (empty, scroll, long names, short clips)
- [x] ERR1-3: Error handling tested (missing files, broken thumbnails, corrupt data)
- [x] PERF: 100 clips render smoothly, <2s, <200MB memory

## Checklist
- [x] All TODO items completed
- [x] Acceptance criteria met (USER_STORIES.md lines 72-83)
- [x] No console errors
- [x] Code comments added
- [x] Smooth scrolling (60fps with 20+ clips)
- [x] Click-to-preview stub ready for Story 6
- [x] Drag-to-timeline stub ready for Story 4

## Related
- User Story: Story 3 (USER_STORIES.md lines 65-87)
- PRD: prds/s3-library-view-prd.md
- Dependencies: Story 1 (App Launch), Story 2 (Video Import)
- Integration Points: Story 4 (Timeline), Story 6 (Preview Player)"
```

- [ ] Return PR URL to user

---

## Notes

### Decisions & Context
- **File Validation**: Check only on mount and after import (not on every render) to avoid performance issues; cache results in `brokenFiles` Set
- **Drag-and-Drop**: Use HTML5 Drag and Drop API (`draggable="true"`, `onDragStart`, `dataTransfer.setData()`)
- **Duration Formatting**: Use existing `formatDuration()` helper in ClipCard (MM:SS format: 83s → "1:23")
- **Story 4/6 Stubs**: Library initiates drag and logs click events; Timeline (Story 4) and Preview Player (Story 6) will implement actual drop/preview logic
- **Virtualization**: Not implemented initially; test with 100 clips first, add react-window if scrolling <60fps
- **Empty State**: Use existing EmptyState component, add "library" variant

### Blockers & Questions
- None currently; dependencies (Story 1, Story 2) complete

### Performance Considerations
- Base64 thumbnails: Use `loading="lazy"` on img tags if performance issues arise
- File checks: Debounce `checkFileExists` calls (batch check every 500ms)
- Scroll: Use CSS `scroll-behavior: smooth` for 60fps
- Memory: Monitor with Chrome DevTools; 100 clips should stay <200MB growth

### Integration Notes
- **Story 4 (Timeline)**: Will implement drop target logic to receive clip ID from Library drag event
- **Story 6 (Preview Player)**: Will implement preview loading logic to display clip when Library click event occurs
- Library owns drag source logic (REQ-3.4 from PRD)
- Timeline owns drop target logic (REQ-4.5 from Story 4 PRD, not yet implemented)
