# PRD: Application Launch

**Feature**: Application Launch | **Status**: Ready | **Agent**: Pam

---

## Preflight

1. **Smallest end-to-end outcome?** User launches Klippy → app opens in <5 seconds → previous session restored or empty state shown
2. **Primary user + critical action?** Any user, launching the app for first/subsequent time
3. **Must-have vs nice-to-have?** MUST-HAVE: App loads, FFmpeg works, session restores
4. **Offline/persistence needs?** YES: Session state persisted to `userData/session.json`, restored on next launch
5. **Performance targets?** <5 second app launch (cold start), deterministic
6. **Error/edge cases critical to handle?** FFmpeg missing/corrupted, corrupted session file, first launch (no prior session)
7. **Data model changes?** Session data structure (clips array + timeline state)
8. **Service/command APIs needed?** App init handlers: load session, validate FFmpeg, restore UI state
9. **React components to create/modify?** App.tsx (main layout), splash/loading screen during init
10. **Desktop-specific needs?** App lifecycle: Electron app init, window creation, IPC setup
11. **What's explicitly out of scope?** User-initiated project save/load, undo/redo

---

## 1. Summary

Application Launch establishes the foundation: Klippy starts in <5 seconds, verifies FFmpeg availability, and automatically restores the user's previous editing session (imported clips, timeline arrangement) from persistent storage. First-time users see an empty state ready for video import.

---

## 2. Non-Goals / Scope Boundaries

**Out of Scope:**
- User manual project save/load (only ephemeral session state)
- Wizard or onboarding flow (start with empty UI)
- Settings panel or preferences
- Crash recovery beyond corrupted session file handling
- App splash screen animation (simple/minimal)
- Multi-window support

---

## 3. Experience (UX)

### Entry Points
- User double-clicks `Klippy.app` (macOS) or `Klippy.exe` (Windows)

### User Flow: Happy Path

1. User launches Klippy
2. Electron window opens (may show minimal splash/loading state for <2s)
3. App loads session data from `userData/session.json`
4. App validates FFmpeg binary availability
5. UI renders with:
   - Last session's imported clips in Library panel
   - Last session's timeline arrangement
   - Playhead at last position
   - Zoom level restored
6. App is interactive within 5 seconds
7. User can immediately continue editing

### User Flow: First Launch (No Session)

1. User launches Klippy for first time
2. Window opens
3. No session file exists → app shows empty state
4. Library panel: "Drag & drop video files or click Import to get started"
5. Timeline panel: "Drag clips here to start editing"
6. User can immediately import videos

### User Flow: FFmpeg Unavailable

1. User launches Klippy
2. Window opens
3. App detects FFmpeg binary missing or corrupted
4. Error dialog appears: "Media processing unavailable. Please reinstall Klippy."
5. User clicks OK → app exits gracefully

### States
- **Loading**: Minimal UI during session load + FFmpeg validation (~1-2s)
- **Ready**: Full UI loaded, ready for user interaction
- **Error**: FFmpeg missing → dialog → exit

---

## 4. Functional Requirements

### MUST (Critical Path)

**REQ-1.1: App Launch Performance**
- App window opens and becomes interactive in <5 seconds (measured from launch to "ready to click import")
- FFmpeg validation must complete in <1 second
- Session file load must complete in <500ms

**REQ-1.2: FFmpeg Bundling & Validation**
- FFmpeg binary bundled via `ffmpeg-static` npm package
- On app init, verify FFmpeg executable exists at `require('ffmpeg-static')` path
- Test FFmpeg availability: Run `ffmpeg -version` to confirm executable and not corrupted
- If validation fails: Show error dialog and exit app
- Error message: "Media processing unavailable. Please reinstall Klippy."

**REQ-1.3: Session State Restoration**
- On app launch, read session file from `app.getPath('userData')/session.json`
- Parse session data:
  - `clips`: Array of imported clip metadata (filePath, duration, inPoint, outPoint)
  - `timeline`: Array of clip IDs in sequence
  - `zoomLevel`: Current zoom percentage
  - `playheadPosition`: Current playhead time (in seconds)
  - `scrollPosition`: Timeline horizontal scroll offset
- Restore all state to React component state (Context or Zustand store)
- Render Library and Timeline with restored data

**REQ-1.4: Empty State Handling**
- If session file doesn't exist (first launch): Treat as success, initialize empty state
- Empty state UI:
  - Library: Empty message "Drag & drop video files or click Import to get started"
  - Timeline: Empty message "Drag clips here to start editing"
  - No errors, app fully functional

**REQ-1.5: Error Handling for Corrupted Session**
- If session file exists but is invalid JSON or missing required fields:
  - Log error to console: `[ERROR] Failed to parse session.json: [reason]`
  - Discard corrupted file
  - Initialize app with empty state
  - No user-facing error dialog (graceful recovery)

### SHOULD (Nice-to-Have)

- Show minimal loading indicator during session load (spinner or progress)
- Store app version in session file for future migration compatibility

### Acceptance Gates

| Gate | User Action | Expected Result | Pass Criteria |
|------|-------------|-----------------|---------------|
| **Happy Path 1: Cold Start** | Launch app (first time) | App shows empty state, ready for input | Window opens <5s, Library/Timeline visible, no errors |
| **Happy Path 2: Session Restore** | Import 3 clips, arrange on timeline, close app, relaunch | Previous clips and timeline restored | All clips visible in Library, timeline shows same arrangement, playhead at same position |
| **Happy Path 3: FFmpeg Valid** | Launch app | FFmpeg validation passes silently | App loads normally, no error dialogs |
| **Edge Case 1: Missing Session File** | Launch app after uninstall/fresh install | App starts with empty state | No errors, UI ready for import |
| **Edge Case 2: Corrupted Session JSON** | Manually corrupt `session.json` in userData folder, launch app | App recovers gracefully with empty state | Error logged to console, app functional |
| **Edge Case 3: FFmpeg Binary Missing** | Remove/corrupt ffmpeg-static binary, launch app | Error dialog shown, app exits | Dialog displays "Media processing unavailable. Please reinstall Klippy." |
| **Error Case 1: File Permission Denied** | Session file not readable (permission issue) | App recovers with empty state | Console log error, app functional |

---

## 5. Data Model

### Session State Structure

```typescript
interface Clip {
  id: string;                 // Unique identifier (UUID)
  filePath: string;           // Absolute path to source video file
  duration: number;           // Total duration in seconds
  inPoint: number;            // Trim start point in seconds (default: 0)
  outPoint: number;           // Trim end point in seconds (default: duration)
  importedAt: number;         // Timestamp when imported (ms since epoch)
}

interface Timeline {
  clips: string[];            // Array of clip IDs in sequence
  duration: number;           // Total timeline duration (sum of trimmed clips)
}

interface Session {
  version: string;            // e.g., "1.0.0" for future migrations
  clips: Clip[];              // All imported clips (library)
  timeline: Timeline;         // Timeline arrangement
  zoomLevel: number;          // Zoom percentage (100-1000), default: 'auto-fit'
  playheadPosition: number;   // Current playhead position in seconds
  scrollPosition: number;     // Timeline horizontal scroll offset in pixels
  lastModified: number;       // Timestamp of last save (ms since epoch)
}
```

### Storage

- **Location**: `app.getPath('userData')/session.json` (Electron API)
  - macOS: `~/Library/Application Support/Klippy/session.json`
  - Windows: `%APPDATA%/Klippy/session.json`
- **Format**: JSON (UTF-8)
- **Persistence**: Written on app close (via `before-quit` event)
- **Size estimate**: ~10KB per session with 10 clips

### Validation Rules

- `clips`: Must be array of valid Clip objects
- `filePath`: Must exist and be readable (if file deleted, mark as broken in UI during restore)
- `duration`: Must be positive number
- `inPoint`, `outPoint`: Must satisfy `0 <= inPoint < outPoint <= duration`
- `zoomLevel`: Must be integer 100-1000
- `playheadPosition`: Must be non-negative number

---

## 6. Service/Command APIs

### Main Process Handlers (Electron IPC)

#### `app:init`
**Purpose**: Initialization sequence on app startup. Called once when renderer ready.

```typescript
// Renderer calls:
await ipcRenderer.invoke('app:init');

// Main process returns:
{
  session: Session | null,      // Restored session or null if first launch
  ffmpegStatus: 'ok' | 'error', // FFmpeg validation result
  error?: string                // Error message if status === 'error'
}
```

**Behavior:**
1. Validate FFmpeg binary exists and is executable
2. Load session file (if exists)
3. Return session data + FFmpeg status
4. If FFmpeg missing: return `{session: null, ffmpegStatus: 'error', error: 'Media processing unavailable...'}`

**Error Handling:**
- FFmpeg missing → return error object (renderer shows dialog + exits)
- Session file corrupt → return `session: null` (renderer treats as first launch)
- File permission denied → log error, return `session: null`

#### `app:validate-ffmpeg`
**Purpose**: Standalone FFmpeg validation (callable anytime).

```typescript
await ipcRenderer.invoke('app:validate-ffmpeg');

// Returns:
{
  valid: boolean,
  ffmpegPath?: string,
  version?: string,
  error?: string
}
```

**Behavior:**
1. Check if FFmpeg binary exists at `require('ffmpeg-static')` path
2. Execute `ffmpeg -version` to verify executable
3. Parse version string
4. Return status

---

## 7. Components to Create/Modify

### React Components

| Component | File | Purpose |
|-----------|------|---------|
| `App` | `src/components/App.tsx` | Main entry point, initializes app state, handles loading phase |
| `LoadingScreen` | `src/components/LoadingScreen.tsx` | Minimal spinner shown during init (~1-2s) |
| `MainLayout` | `src/components/MainLayout.tsx` | Three-panel layout (Library, Preview, Timeline) |
| `EmptyState` | `src/components/EmptyState.tsx` | Placeholder UI for Library and Timeline when empty |

### Electron Main Process

| Module | File | Purpose |
|--------|------|---------|
| `ipcHandlers` | `src/main/ipc-handlers/app.ts` | Handlers: `app:init`, `app:validate-ffmpeg` |
| `sessionManager` | `src/main/services/session-manager.ts` | Load/save session file, validate data |
| `ffmpegValidator` | `src/main/services/ffmpeg-validator.ts` | Verify FFmpeg binary and version |

---

## 8. Integration Points

- **Electron app lifecycle**: Listen to `app.on('ready')` → create window → emit IPC `app:init`
- **File system**: Node.js `fs` module to read/write `userData/session.json`
- **FFmpeg**: Execute `ffmpeg -version` via `child_process.spawn()` to validate
- **State management**: React Context or Zustand for session state (passed from main process)
- **Window**: Electron `BrowserWindow` creation and show timing

---

## 9. Testing & Acceptance Gates

### Happy Path 1: First Launch (Empty State)

**Flow:**
1. Delete `userData/session.json` if exists
2. Launch Klippy
3. Observe window opens in <5s
4. Observe Library empty state message
5. Observe Timeline empty state message
6. Observe no error dialogs

**Gate**: App fully loaded and interactive <5s, no errors, empty UI shown

**Pass Criteria**:
- Window visible and interactive
- No console errors
- Empty state messages displayed
- User can immediately click "Import" button

### Happy Path 2: Session Restoration

**Flow:**
1. Launch Klippy
2. Import 3 video clips via drag & drop
3. Drag 2 clips to timeline in specific order (e.g., A → B)
4. Trim clip A to 30 seconds (in: 5s, out: 35s)
5. Drag playhead to 15 seconds
6. Zoom timeline to 300%
7. Close app (Cmd+Q or window close button)
8. Relaunch Klippy
9. Observe UI state restored

**Gate**: All session elements restored identically

**Pass Criteria**:
- Library shows same 3 clips
- Timeline shows same 2 clips in same order
- Clip A shows trim points (5s-35s)
- Playhead at ~15s position
- Timeline zoomed to ~300%
- Scroll position restored

### Happy Path 3: FFmpeg Validation Success

**Flow:**
1. Verify `ffmpeg-static` package installed
2. Launch Klippy
3. Observe no FFmpeg error dialogs
4. App loads normally

**Gate**: FFmpeg validation completes silently, app functional

**Pass Criteria**:
- No error dialogs
- App loads <5s
- User can interact with UI

### Edge Case 1: Corrupted Session File

**Flow:**
1. Navigate to `userData/session.json`
2. Open file and corrupt JSON (e.g., remove closing brace)
3. Save file
4. Launch Klippy
5. Observe app behavior

**Gate**: App recovers gracefully

**Pass Criteria**:
- No crash or error dialog shown
- App loads with empty state UI
- Console shows error log (check browser dev tools)
- User can immediately start importing videos

### Edge Case 2: First Launch with Missing FFmpeg

**Flow:**
1. Temporarily remove or rename ffmpeg-static binary (in node_modules)
2. Launch Klippy
3. Observe app behavior

**Gate**: Error dialog shown, app exits gracefully

**Pass Criteria**:
- Dialog displays: "Media processing unavailable. Please reinstall Klippy."
- Dialog has OK button
- Clicking OK closes app
- No crashes or console errors

### Edge Case 3: Session File Permissions Denied

**Flow (macOS):**
1. Create session file with read-only permission: `chmod 000 session.json`
2. Launch Klippy
3. Observe behavior

**Gate**: App recovers with empty state

**Pass Criteria**:
- App loads (no crash)
- Empty state UI shown
- Console error logged
- User can start fresh

### Error Case: Missing Source File After Import

**Flow:**
1. Import a video file (e.g., `/Users/test/video.mp4`)
2. Save session (close app)
3. Delete the source file from disk
4. Relaunch Klippy
5. Observe Library rendering

**Gate**: Clip appears with "broken file" indicator (handled by Library component, not Launch)

**Note**: This is tested in Library View feature, but Launch must ensure clip path is preserved in session for Library to handle gracefully.

---

## 10. Definition of Done

- [ ] Electron main process initializes with `app:init` IPC handler
- [ ] `sessionManager` module loads/validates/saves session JSON
- [ ] `ffmpegValidator` module verifies FFmpeg binary and runs `ffmpeg -version`
- [ ] React App.tsx calls `app:init` on mount, handles loading state
- [ ] LoadingScreen component displays during init phase
- [ ] MainLayout renders after init completes
- [ ] EmptyState components display in Library/Timeline when no clips
- [ ] Session state restored from JSON and injected into React Context/Store
- [ ] App launch time <5 seconds (measured on target machine)
- [ ] All testing gates pass:
  - [ ] Happy Path 1: First launch empty state
  - [ ] Happy Path 2: Session restoration
  - [ ] Happy Path 3: FFmpeg validation success
  - [ ] Edge Case 1: Corrupted session JSON
  - [ ] Edge Case 2: Missing FFmpeg binary
  - [ ] Edge Case 3: File permission denied
- [ ] Error handling tested (no crashes, graceful recovery)
- [ ] Console logging for debugging (errors, timings)
- [ ] Code reviewed and merged to `develop` branch

---

## 11. Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| App launch >5s due to session parsing | Profile init sequence with DevTools. Lazy-load non-critical UI elements. |
| FFmpeg binary path differs across platforms | Use `require('ffmpeg-static')` which handles platform-specific paths. Test on macOS + Windows. |
| Corrupted session file causes crash | Wrap session parsing in try-catch. Fall back to empty state on error. Log error to console. |
| Large session file (many clips) slows load | Keep session JSON minimal (store file paths, not video data). Test with 50+ clips. |
| FFmpeg missing on end-user machines | Bundle ffmpeg-static in npm dependencies. Validate on init. Show clear error message. |
| User closes window during init | Ensure window can close cleanly during loading phase. No blocking operations. |

---

## Authoring Notes

- Write FFmpeg validator before Session Manager (test dependency)
- Session state must be 100% serializable to JSON (no class instances, Date objects → timestamps)
- Measure app launch time on real hardware (not just dev machine)
- Test session restore with varying numbers of clips (10, 50, 100+) to validate performance
- Validate on both macOS + Windows before shipping
- Keep error messages user-friendly (no technical jargon or stack traces)
