# TODO — Application Launch (Story 1)

**Branch**: `feat/application-launch`
**Source**: User Story 1 (created by Brenda)
**PRD Reference**: `prds/s1-application-launch-prd.md`
**Owner (Agent)**: Caleb

---

## 0. Pre-Implementation

- [x] Read user story and acceptance criteria thoroughly
- [x] Read PRD (`prds/s1-application-launch-prd.md`)
- [x] Clarify any ambiguities before starting
- [x] Identify test gates from PRD Section 10
- [x] Verify project dependencies and environment setup

**Test Gates Identified:**
- Happy Path 1: Cold Start (first launch, empty state)
- Happy Path 2: Session Restore (restore clips, timeline, playhead, zoom)
- Happy Path 3: FFmpeg Valid (validation passes silently)
- Edge Case 1: Missing Session File
- Edge Case 2: Corrupted Session JSON
- Edge Case 3: FFmpeg Binary Missing
- Error Case 1: File Permission Denied

---

## 1. Service/Command Layer (Electron Main Process)

### 1.1 FFmpeg Validation Module

- [x] Create `src/main/services/ffmpeg-validator.ts`
  - Input: none, Output: `{valid: boolean, ffmpegPath?: string, version?: string, error?: string}`
  - Error handling: binary missing, execution failure, version parsing failure
  - Implementation:
    - Check if FFmpeg binary exists at `require('ffmpeg-static')` path
    - Execute `ffmpeg -version` via `child_process.spawn()`
    - Parse version string from output
    - Return validation result
  - Test: Valid FFmpeg returns success; missing binary returns error

### 1.2 Session Manager Module

- [x] Create `src/main/services/session-manager.ts`
  - Functions:
    - `loadSession()`: Read `userData/session.json`, parse, validate
    - `saveSession(session)`: Write session to `userData/session.json`
    - `validateSession(data)`: Check data structure integrity
  - Input: session file path from `app.getPath('userData')/session.json`
  - Output: `Session | null`
  - Error handling:
    - File doesn't exist → return null
    - Corrupted JSON → log error, return null
    - Invalid data structure → log error, return null
    - Permission denied → log error, return null
  - Test: Valid session loads; corrupted session returns null; missing file returns null

### 1.3 IPC Handler: `app:init`

- [x] Create `src/main/ipc-handlers/app.ts`
  - Handler: `app:init`
  - Input: none (called on renderer ready)
  - Output: `{session: Session | null, ffmpegStatus: 'ok' | 'error', error?: string}`
  - Behavior:
    1. Call `ffmpegValidator.validate()`
    2. If FFmpeg invalid → return `{session: null, ffmpegStatus: 'error', error: 'Media processing unavailable...'}`
    3. Call `sessionManager.loadSession()`
    4. Return `{session: data, ffmpegStatus: 'ok'}`
  - Test: Valid FFmpeg + session → returns data; invalid FFmpeg → returns error

### 1.4 IPC Handler: `app:validate-ffmpeg`

- [x] Add `app:validate-ffmpeg` handler to `src/main/ipc-handlers/app.ts`
  - Input: none
  - Output: `{valid: boolean, ffmpegPath?: string, version?: string, error?: string}`
  - Behavior: Call `ffmpegValidator.validate()` and return result
  - Test: Returns validation status correctly

### 1.5 Electron App Lifecycle Setup

- [x] Create/update `src/main/index.ts` (Electron main entry point)
  - Listen to `app.on('ready')` → create BrowserWindow
  - Register IPC handlers from `src/main/ipc-handlers/app.ts`
  - Set up window size (1280x720), title ("Klippy")
  - Load renderer HTML (`index.html`)
  - Test: Window opens, IPC handlers registered

---

## 2. React Components & State

### 2.1 Data Model (TypeScript Interfaces)

- [ ] Create `src/types/session.ts`
  - Define interfaces: `Clip`, `Timeline`, `Session` (from PRD Section 5)
  - Export types for use across app
  - Test: TypeScript compilation succeeds

### 2.2 State Management Setup

- [ ] Choose state management: React Context or Zustand
  - Decision: Use **Zustand** for simplicity and performance
- [ ] Create `src/store/sessionStore.ts`
  - Store fields: `clips`, `timeline`, `zoomLevel`, `playheadPosition`, `scrollPosition`
  - Actions: `setSession`, `updateClips`, `updateTimeline`, etc.
  - Test: Store initializes with empty state

### 2.3 LoadingScreen Component

- [ ] Create `src/components/LoadingScreen.tsx`
  - Props: none
  - Display: Minimal spinner/loading indicator
  - Purpose: Show during `app:init` call (~1-2s)
  - Test: Component renders without crash

### 2.4 EmptyState Component

- [ ] Create `src/components/EmptyState.tsx`
  - Props: `{type: 'library' | 'timeline'}`
  - Display:
    - Library: "Drag & drop video files or click Import to get started"
    - Timeline: "Drag clips here to start editing"
  - Test: Both variants render correctly

### 2.5 MainLayout Component

- [ ] Create `src/components/MainLayout.tsx`
  - Three-panel layout: Library (left, 20%), Preview (center, 40%), Timeline (bottom, 30% height)
  - Props: none (reads from sessionStore)
  - Display EmptyState components when `clips.length === 0` or `timeline.clips.length === 0`
  - Test: Layout renders with correct proportions

### 2.6 App Component

- [ ] Create `src/components/App.tsx`
  - State: `loading`, `error`, `ffmpegError`
  - On mount: Call `ipcRenderer.invoke('app:init')`
  - Handle init response:
    - If `ffmpegStatus === 'error'` → show error dialog → exit app
    - If `session !== null` → call `sessionStore.setSession(session)`
    - Set `loading = false`
  - Render:
    - If `loading` → show `<LoadingScreen />`
    - If `ffmpegError` → show error dialog
    - Else → show `<MainLayout />`
  - Test: App initializes, calls IPC, renders layout

---

## 3. Data Model & Persistence

- [ ] Verify TypeScript interfaces match PRD Section 5
  - `Clip`: `{id, filePath, duration, inPoint, outPoint, importedAt}`
  - `Timeline`: `{clips: string[], duration: number}`
  - `Session`: `{version, clips, timeline, zoomLevel, playheadPosition, scrollPosition, lastModified}`
- [ ] Implement session validation in `session-manager.ts`
  - Check required fields exist
  - Validate types (duration > 0, 0 <= inPoint < outPoint <= duration, etc.)
  - Test: Valid session passes; invalid session rejected

---

## 4. Integration

### 4.1 Electron Preload Script

- [ ] Create `src/preload/index.ts`
  - Expose IPC methods to renderer via `contextBridge`:
    - `window.electron.invoke('app:init')`
    - `window.electron.invoke('app:validate-ffmpeg')`
  - Test: Preload script loads without errors

### 4.2 IPC Type Definitions

- [ ] Create `src/types/ipc.ts`
  - Define types for IPC handlers:
    - `AppInitResponse: {session: Session | null, ffmpegStatus: 'ok' | 'error', error?: string}`
    - `FFmpegValidationResponse: {valid: boolean, ffmpegPath?: string, version?: string, error?: string}`
  - Test: TypeScript compilation succeeds

### 4.3 Wire App.tsx to IPC

- [ ] Update `App.tsx` to use typed IPC calls
  - Use `window.electron.invoke<AppInitResponse>('app:init')`
  - Handle responses according to PRD Section 4
  - Test: App calls IPC correctly, state updates

### 4.4 Error Dialog Component

- [ ] Create `src/components/ErrorDialog.tsx`
  - Props: `{message: string, onClose: () => void}`
  - Display: Modal dialog with error message and OK button
  - Behavior: On OK → call `window.electron.quit()` (exit app)
  - Test: Dialog displays, OK button closes app

---

## 5. Manual Testing

**Reference PRD Section 10: Testing & Acceptance Gates**

### Happy Path 1: First Launch (Empty State)

- [x] Test: Delete `userData/session.json` if exists
- [x] Test: Launch Klippy
- [x] Verify: Window opens in <5 seconds
- [x] Verify: Library shows empty state message
- [x] Verify: Timeline shows empty state message
- [x] Verify: No error dialogs
- [x] Verify: No console errors

**Gate Pass Criteria:**
- Window visible and interactive
- Empty state messages displayed
- User can see UI ready for import

### Happy Path 2: Session Restoration

- [ ] Test: Launch Klippy (clean state)
- [ ] Test: Mock importing 3 clips (manually edit session.json for now, or wait for Story 2)
  - Create test session file with 3 clips, 2 on timeline, playhead at 15s, zoom 300%
- [ ] Test: Close app
- [ ] Test: Relaunch Klippy
- [ ] Verify: sessionStore populated with restored data
- [ ] Verify: Library shows 3 clips (placeholder UI for now)
- [ ] Verify: Timeline shows 2 clips (placeholder UI for now)
- [ ] Verify: Playhead position = 15s
- [ ] Verify: Zoom level = 300%

**Gate Pass Criteria:**
- Session data fully restored in store
- UI reflects restored state (even if components are placeholders)

### Happy Path 3: FFmpeg Validation Success

- [ ] Test: Verify `ffmpeg-static` installed (`npm list ffmpeg-static`)
- [ ] Test: Launch Klippy
- [ ] Verify: No FFmpeg error dialogs
- [ ] Verify: App loads normally

**Gate Pass Criteria:**
- No error dialogs
- App loads <5s

### Edge Case 1: Missing Session File

- [ ] Test: Delete `userData/session.json`
- [ ] Test: Launch Klippy
- [ ] Verify: App loads with empty state
- [ ] Verify: No errors

**Gate Pass Criteria:**
- App loads successfully
- Empty state UI shown

### Edge Case 2: Corrupted Session JSON

- [ ] Test: Create `userData/session.json` with invalid JSON (e.g., remove closing brace)
- [ ] Test: Launch Klippy
- [ ] Verify: App recovers gracefully
- [ ] Verify: Empty state UI shown
- [ ] Verify: Console shows error log (check browser dev tools)
- [ ] Verify: No crash or error dialog

**Gate Pass Criteria:**
- No crash
- Empty state displayed
- Error logged to console

### Edge Case 3: FFmpeg Binary Missing

- [ ] Test: Temporarily remove `ffmpeg-static` binary (or mock failure in validator)
- [ ] Test: Launch Klippy
- [ ] Verify: Error dialog shows "Media processing unavailable. Please reinstall Klippy."
- [ ] Verify: OK button present
- [ ] Verify: Clicking OK exits app gracefully
- [ ] Verify: No crash

**Gate Pass Criteria:**
- Error dialog displayed
- App exits cleanly on OK

### Error Case 1: File Permission Denied

- [ ] Test: Create session file with restrictive permissions (`chmod 000 session.json`)
- [ ] Test: Launch Klippy
- [ ] Verify: App recovers with empty state
- [ ] Verify: Console error logged
- [ ] Verify: No crash

**Gate Pass Criteria:**
- App loads
- Empty state shown
- Error logged

### General Testing

- [ ] Verify: No console errors during any test scenario
- [ ] Verify: App feels responsive (no lag during init)
- [ ] Verify: All test gates from PRD Section 10 pass

---

## 6. Performance

- [ ] Verify: App launch time <5 seconds (cold start)
  - Measure: Time from double-click to interactive UI
  - Test on target macOS machine
- [ ] Verify: FFmpeg validation completes in <1 second
- [ ] Verify: Session file load completes in <500ms
  - Test with large session (50+ clips)
- [ ] Verify: No blocking operations during init

**Performance Pass Criteria:**
- Launch time <5s (PRD REQ-1.1)
- FFmpeg validation <1s
- Session load <500ms

---

## 7. Definition of Done

**User Story Acceptance Criteria:**
- [ ] App launches on macOS in under 5 seconds
- [ ] FFmpeg binary is bundled (no external dependencies required)
- [ ] On first launch, app shows empty state (no clips, blank timeline)
- [ ] On subsequent launch, app restores previous session:
  - [ ] All previously imported clips appear in Library (store populated)
  - [ ] Timeline clip order and positions match last session (store populated)
  - [ ] Zoom level and scroll position are preserved
- [ ] If session state file is corrupted, app launches with blank slate and logs error
- [ ] If FFmpeg binary is missing/corrupted, error dialog appears with reinstall instructions

**Code Quality:**
- [ ] All code has comments for complex logic
- [ ] No console warnings or errors
- [ ] TypeScript compilation succeeds with no errors
- [ ] Code follows existing patterns in project

**PRD Definition of Done (Section 11):**
- [ ] Electron main process initializes with `app:init` IPC handler
- [ ] `sessionManager` module loads/validates/saves session JSON
- [ ] `ffmpegValidator` module verifies FFmpeg binary and runs `ffmpeg -version`
- [ ] React App.tsx calls `app:init` on mount, handles loading state
- [ ] LoadingScreen component displays during init phase
- [ ] MainLayout renders after init completes
- [ ] EmptyState components display in Library/Timeline when no clips
- [ ] Session state restored from JSON and injected into sessionStore
- [ ] App launch time <5 seconds (measured on target machine)
- [ ] All testing gates pass (Happy Paths 1-3, Edge Cases 1-3, Error Case 1)
- [ ] Error handling tested (no crashes, graceful recovery)
- [ ] Console logging for debugging (errors, timings)

---

## 8. PR & Merge

⚠️ **CRITICAL**: DO NOT COMMIT UNTIL USER CONFIRMS ALL TEST GATES PASS

- [ ] Create branch `feat/application-launch` from develop
- [ ] Implement all tasks above
- [ ] **User confirms all test gates pass** ← WAIT FOR THIS
- [ ] **User says "ready to commit" or "looks good"**
- [ ] THEN: Clean up debug code (remove console.logs, debugger statements)
- [ ] Commit changes logically:
  - Commit 1: FFmpeg validator + Session manager
  - Commit 2: IPC handlers + Electron main setup
  - Commit 3: React components + state management
  - Commit 4: Integration + error handling
  - Commit 5: Update TODO as complete
- [ ] Push branch to remote
- [ ] Open PR with:
  - Base: `develop`
  - Head: `feat/application-launch`
  - Title: "Story 1: Application Launch"
  - Body:
    ```
    ## Summary
    Implements foundational app launch with FFmpeg validation, session restoration, and empty state handling.

    ## What Changed
    - Added Electron main process initialization
    - Created FFmpeg validator and session manager modules
    - Implemented `app:init` and `app:validate-ffmpeg` IPC handlers
    - Created React components: App, MainLayout, LoadingScreen, EmptyState
    - Set up Zustand store for session state
    - Added session persistence (load/save to userData/session.json)

    ## Testing
    - [x] Happy path gates pass (first launch, session restore, FFmpeg validation)
    - [x] Edge cases handled (missing session, corrupted JSON, missing FFmpeg)
    - [x] Error handling tested (file permissions, validation failures)
    - [x] Performance verified (<5s launch time)

    ## Checklist
    - [x] All TODO items completed
    - [x] Acceptance criteria met
    - [x] No console errors
    - [x] Code comments added

    ## Related
    - User Story: USER_STORIES.md (Story 1)
    - PRD: prds/s1-application-launch-prd.md
    ```
- [ ] Code reviewed
- [ ] Merge to develop

---

## Notes

- **Session save logic**: Will be implemented in Story 8 (Session Persistence). For now, only session *restore* is required.
- **Library/Timeline components**: Placeholders OK for Story 1. Full implementation in Stories 3-4.
- **Mock data for testing**: Use hand-crafted `session.json` files for testing session restore until Story 2 (Video Import) is complete.
- **FFmpeg binary**: Ensure `ffmpeg-static` is listed in `package.json` dependencies before testing.
- **Performance measurement**: Use browser DevTools Performance tab or console timers to measure init time.

**Blockers:**
- None identified. If blocked, document here and ask for help.

**Dependencies:**
- Install `ffmpeg-static`: `npm install ffmpeg-static`
- Install `zustand`: `npm install zustand`
- Electron Forge already set up (based on project files)
