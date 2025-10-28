# PRD: Library View

**Feature**: Library View | **Status**: Ready | **Agent**: Pam

---

## Preflight

1. **Smallest end-to-end outcome?** User sees all imported clips displayed in a scrollable Library panel (left sidebar), clicks a clip to preview it, drags it to Timeline to add
2. **Primary user + critical action?** Video editor browsing imported clips to select which ones to add to timeline for editing
3. **Must-have vs nice-to-have?** MUST-HAVE: Scrollable list/grid of clips, thumbnail display, filename, duration (MM:SS), click-to-preview, drag initiation, empty state; NICE-TO-HAVE: Search/filter, sorting options, clip metadata tooltip
4. **Offline/persistence needs?** YES: Library state derived from `clips` array in session.json (Story 1). Clips persist across app launches.
5. **Performance targets?** Smooth scrolling with 20+ clips (60fps), clip card render <50ms, thumbnail loading <100ms per card, memory stable
6. **Error/edge cases critical to handle?** Missing source files (moved/deleted after import), empty library state, broken thumbnails, very long filenames, 100+ clips performance
7. **Data model changes?** No new data model changes; uses `Clip` interface from Story 2. Library component consumes clips from session state.
8. **Service/command APIs needed?** `library:check-file-exists` (validate source file exists)
9. **React components to create/modify?** `Library.tsx` (container), `ClipCard.tsx` (from Story 2, modify for click/drag), `EmptyState.tsx`, `BrokenFileIcon.tsx`
10. **Desktop-specific needs?** File path validation (check if source exists), drag initiation from Library to Timeline
11. **What's explicitly out of scope?** Search/filter, sorting, clip renaming, clip deletion from library, metadata editing, library organization (folders/tags)

---

## 1. Summary

Library View displays all imported video clips in a scrollable panel on the left side of the app (~20% width). Each clip shows a thumbnail (first frame), filename, and duration (MM:SS format). Users can click a clip to preview it in the preview player (Story 6) or initiate a drag operation to add it to the Timeline (Story 4). The library handles empty states and missing source files gracefully with clear visual indicators.

---

## 2. Non-Goals / Scope Boundaries

**Out of Scope:**
- Search/filter functionality (Post-MVP)
- Sorting options (name, date, duration)
- Clip deletion from library (clips can only be removed by deleting from Timeline)
- Clip renaming or metadata editing
- Library organization (folders, tags, categories)
- Batch operations (select multiple clips)
- Thumbnail customization (using frames other than first)
- Clip preview on hover (only on click)
- Context menu (right-click options)
- Drop target handling (Timeline Story 4 handles drop logic)

---

## 3. Experience (UX)

**Entry Points**: Library panel is always visible on left side of app (20% width), displays clips from session state

**Happy Path**:
1. User imports clips via Story 2
2. Clips appear in Library as cards with thumbnails
3. User scrolls to browse clips
4. User clicks clip → Notifies Story 6 to load clip in preview player
5. User drags clip from Library → Initiates drag with clip data (Story 4 Timeline handles drop)

**States**:
- **Empty**: No clips imported → "Drag & drop video files or click Import to get started" (with icon)
- **Loading**: (Handled in Story 2 import flow; Library just displays existing clips)
- **Success**: Clips displayed with thumbnails, filenames, durations
- **Error/Broken File**: Source file moved/deleted → Show broken file icon with red border and tooltip "Source file not found: [filepath]"

**Key Behaviors**:
- Click on clip → Sends clip ID to Story 6 preview player
- Drag clip → Shows drag ghost preview, emits drag event with clip data (Story 4 Timeline receives)
- Scroll with 20+ clips → Smooth 60fps scrolling
- Long filenames → Truncate with ellipsis, show full name on hover tooltip
- Broken thumbnails → Show placeholder image icon
- Desktop: Window resize → Library panel maintains 20% width (responsive)

---

## 4. Functional Requirements

**MUST (Critical)**:
- **Panel Layout**: Left sidebar, 20% of window width, full height (minus header if exists), fixed position
- **Clip Cards**: Display each clip as a card with:
  - Thumbnail image (from `Clip.thumbnail` base64 data URL)
  - Filename (truncate with ellipsis if >30 chars, tooltip shows full name)
  - Duration in MM:SS format (e.g., "1:23" for 83 seconds)
- **Scrolling**: Vertical scroll when clips exceed viewport height, smooth scrolling (60fps), scroll bar always visible if overflow
- **Click to Preview**: Click on clip card → Notify preview player (Story 6) to load clip (via state update or IPC)
- **Drag to Timeline (Drag Source)**:
  - Mouse down on clip card → Initiate drag
  - Show drag ghost (semi-transparent clip card copy)
  - Emit drag event with clip data (Story 4 Timeline handles drop target logic)
- **Empty State**: When `clips.length === 0`, show centered message:
  - Icon (upload cloud or video file icon)
  - Text: "Drag & drop video files or click Import to get started"
  - Subtle background color or border
- **Broken File Detection**:
  - On render, check if `Clip.filePath` exists via `library:check-file-exists` IPC
  - If missing, display clip card with:
    - Broken image icon (red X or broken file symbol)
    - Red border
    - Tooltip: "Source file not found: [filepath]"
    - Disable drag (can't add to timeline)
    - Click still notifies preview player (may show error)
- **Performance**: Render 20+ clips without lag, scroll smoothly, memory stable

**SHOULD (Nice-to-Have)**:
- Hover effect on clip cards (subtle highlight)
- Selected state (highlight clip if currently in preview player)
- Keyboard navigation (arrow keys to select clips)
- Accessibility (ARIA labels, screen reader support)

---

## 5. Data Model

### Library State (React Component State)

```typescript
interface LibraryState {
  clips: Clip[];               // Array from session state (Story 1)
  selectedClipId: string | null; // Currently previewed clip
  brokenFiles: Set<string>;    // Set of clip IDs with missing source files
}
```

**Clip Interface** (from Story 2, no changes):
```typescript
interface Clip {
  id: string;
  filePath: string;
  filename: string;
  duration: number;
  inPoint: number;
  outPoint: number;
  importedAt: number;
  thumbnail: string;           // Base64 data URL
  resolution: { width: number; height: number };
  frameRate: number;
  codec: string;
  bitrate?: number;
}
```

**Storage**: No new storage; Library reads from session state `clips` array (managed by Story 1 session persistence)

**Validation**:
- Clips array must be valid (non-null, array type)
- Each clip must have required fields (id, filePath, filename, duration, thumbnail)
- If validation fails, show empty state

---

## 6. Service/Command APIs

### Main Process Handlers (Electron IPC)

#### `library:check-file-exists`
**Purpose**: Validate if source video file still exists at stored path.

```typescript
// Renderer calls:
await ipcRenderer.invoke('library:check-file-exists', { filePath: '/path/to/video.mp4' });

// Main process returns:
{
  exists: boolean,      // True if file exists and is accessible
  error?: string        // Error message if file not found or not accessible
}
```

**Behavior**: Use Node.js `fs.access()` to check if file exists and is readable. Return `exists: true` if accessible, `exists: false` with error message if not.

**Errors**: File not found (ENOENT), Permission denied (EACCES), Path invalid

---

## 7. Components to Create/Modify

### React Components

| Component | File | Purpose |
|-----------|------|---------|
| `Library` | `src/components/Library.tsx` | Container for clip cards, handles scrolling, empty state, broken file detection |
| `ClipCard` | `src/components/ClipCard.tsx` | Individual clip card display (modify from Story 2 to add click and drag handlers) |
| `EmptyState` | `src/components/EmptyState.tsx` | Empty library message with icon |
| `BrokenFileIcon` | `src/components/BrokenFileIcon.tsx` | Visual indicator for missing source files |

**Component Hierarchy**:
```
Library (container)
├── EmptyState (if clips.length === 0)
└── ClipCard (for each clip)
    ├── Thumbnail (img)
    ├── Filename (text, truncated)
    ├── Duration (text, MM:SS format)
    └── BrokenFileIcon (if source missing)
```

### Electron Main Process

| Module | File | Purpose |
|--------|------|---------|
| `libraryHandlers` | `src/main/ipc-handlers/library.ts` | IPC handlers: `library:check-file-exists` |

---

## 8. Integration Points

- **Session State (Story 1)**: Read `clips` array from session context/store
- **Import (Story 2)**: Library updates when new clips added
- **Timeline (Story 4)**: Drag-and-drop integration (Library initiates drag as drag source, Timeline handles drop target)
- **Preview Player (Story 6)**: Click-to-preview integration (Library notifies player which clip to load)
- **File System**: Validate source files via Node.js `fs.access()` in main process
- **React State Management**: Use Context API or Zustand to share clips state
- **Electron IPC**: Communicate with main process for file validation

---

## 9. Testing & Acceptance Gates

| Test | Setup | Gate | Pass Criteria |
|------|-------|------|---------------|
| **HP1: Display Clips** | Import 5 clips (Story 2) | All 5 appear in Library | Thumbnails visible, filenames correct, durations in MM:SS, scrollable if needed |
| **HP2: Click to Preview** | Library with 3 clips | Click middle clip → Preview loads | Preview player shows selected clip, or console log confirms clip ID sent (Story 6 integration tested) |
| **HP3: Drag to Timeline** | Library with 2 clips | Drag clip → Timeline receives | Drag ghost visible, drag event emitted with clip data (Timeline Story 4 handles drop response) |
| **EC1: Empty State** | Fresh app launch, no clips | Empty state displays | Message visible: "Drag & drop video files...", icon shown, no errors |
| **EC2: 20+ Clips Scroll** | Import 25 clips | Library scrolls smoothly | 60fps scrolling, no lag, all clips render, scroll bar visible |
| **EC3: Long Filename** | Import clip with 80-char filename | Filename truncated with ellipsis | Text truncated at ~30 chars, hover tooltip shows full name, no overflow |
| **EC4: Very Short Clip** | Import 1-second clip | Duration "0:01" displays | Correct MM:SS format, thumbnail shown, clickable, draggable |
| **ERR1: Missing Source File** | Import clip, manually delete source file, relaunch app | Broken file indicator shown | Red border, broken icon, tooltip "Source file not found: [path]", drag disabled |
| **ERR2: Broken Thumbnail** | Clip with invalid base64 thumbnail data | Placeholder icon shown | Fallback image/icon, filename/duration still visible, no crash |
| **ERR3: Invalid Session Data** | Corrupt clips array in session.json | Empty state shown, no crash | App launches, library shows empty state, error logged to console |
| **PERF: 100 Clips Render** | Import 100 clips (test script) | All render, app responsive | <2s initial render, smooth scroll, <200MB memory growth, no freeze |

---

## 10. Definition of Done

**Implementation**:
- [ ] `Library.tsx` component: Reads clips from session state, renders clip cards, handles empty state, scrolling
- [ ] `ClipCard.tsx`: Displays thumbnail (base64 img), filename (truncated), duration (MM:SS), click handler, drag handler
- [ ] `EmptyState.tsx`: Message + icon for empty library
- [ ] `BrokenFileIcon.tsx`: Visual indicator for missing files
- [ ] IPC handler: `library:check-file-exists` (validate file paths)
- [ ] Click on clip → Notifies Story 6 preview player (via state or IPC) with clip ID
- [ ] Drag initiation → Creates drag event with clip data (Story 4 Timeline receives)
- [ ] Empty state shown when `clips.length === 0`
- [ ] Broken file detection: Red border, icon, tooltip, drag disabled
- [ ] Filename truncation with tooltip for long names
- [ ] Duration formatted as MM:SS (e.g., 83 seconds → "1:23")

**Testing**:
- [ ] All test gates pass (HP1-3, EC1-4, ERR1-3, PERF)
- [ ] Smooth scrolling with 20+ clips (60fps)
- [ ] Click-to-preview notifies Story 6 (verified via console log or state update)
- [ ] Drag-to-timeline emits drag event with clip data (verified via drag event listener)
- [ ] Empty state displays correctly
- [ ] Broken file detection works (test by deleting source file)
- [ ] Memory stable with 100 clips (<200MB growth)

**Finalization**:
- [ ] Code reviewed & merged to `develop`

---

## 11. Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Slow rendering with 100+ clips | Use React virtualization (react-window or react-virtuoso) if needed; test performance early |
| File validation on every render causes lag | Check files only on mount and after import; cache results in state; debounce checks |
| Large base64 thumbnails slow rendering | Use `loading="lazy"` on img tags; render thumbnails asynchronously; test with 50+ clips |
| Drag-and-drop conflicts with scroll | Use proper drag handlers (`onDragStart`, not `onMouseDown` for scroll); test on macOS trackpad |
| Long filenames break layout | Use CSS `text-overflow: ellipsis`, `overflow: hidden`, fixed card width |
| Missing source files cause crashes | Try-catch around file checks; graceful fallback to broken state; never throw on missing file |
| Session state corruption | Validate clips array structure; fallback to empty array if invalid; log errors |
| Memory leaks from img tags | Ensure base64 data URLs don't accumulate; test 15min session with repeated imports |
| Broken thumbnails cause img errors | Use `onError` handler on img tag; fallback to placeholder icon |
| Timeline Story 4 not ready for drops | Stub interface defined in Story 4 (REQ-4.5); Library just emits drag event, Timeline handles drop |
| Preview Player Story 6 not ready | Stub handler; Library sends clip ID, Story 6 implements actual preview loading |

---

## Authoring Notes

- **Ownership**: Library View owns drag source logic (REQ-3.4); Timeline (Story 4) owns drop target logic (REQ-4.5); Preview Player (Story 6) owns preview loading logic
- **Performance**: Consider virtualization (react-window) if >50 clips cause lag
- **Filename truncation**: Use CSS `text-overflow: ellipsis` with `max-width` on card
- **Duration formatting**: Create utility function `formatDuration(seconds: number): string` (e.g., 83 → "1:23", 3661 → "1:01:01")
- **Broken file check**: Only run on mount and after import (not on every render)
- **Drag-and-drop**: Use HTML5 Drag and Drop API (`draggable="true"`, `onDragStart`)
- **Base64 images**: Use `<img src={clip.thumbnail} alt={clip.filename} />` directly
- **Empty state**: Center vertically and horizontally in panel
- **Accessibility**: Add ARIA labels (`aria-label="Video library"`, `role="list"`)
- **Testing**: Create test script to generate 100 clips for performance testing
- **Integration**: Wire up click/drag handlers now; Timeline (Story 4) and Preview Player (Story 6) will handle drop/preview responses in their PRDs
