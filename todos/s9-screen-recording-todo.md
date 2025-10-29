# TODO — S9: Screen Recording

**Branch**: `feat/screen-recording`
**Source**: User Story S9 (USER_STORIES.md lines 33-68)
**PRD Reference**: `prds/s9-screen-recording-prd.md`
**Owner (Agent)**: Caleb
**Story Number**: S9
**Complexity**: Complex
**Priority**: ✅ REQUIRED (Phase 5)

---

## 0. Pre-Implementation

- [ ] Read user story S9 and all 12 acceptance criteria thoroughly (USER_STORIES.md lines 41-54)
- [ ] Read PRD: `prds/s9-screen-recording-prd.md` (all 9 REQs + acceptance gates)
- [ ] **CRITICAL: Validate technology choices in PRD**:
  - [ ] Confirm Electron's `desktopCapturer` API works on development machine (test with simple example)
  - [ ] Verify Web Audio API `navigator.mediaDevices.getUserMedia()` for microphone access
  - [ ] Test MediaRecorder API for capturing screen + audio to WebM format
  - [ ] Confirm FFmpeg can convert WebM → MP4 H.264 (test with sample file)
  - [ ] Document chosen recording approach: MediaRecorder (WebM) → FFmpeg (MP4)
- [ ] Clarify recording directory: `app.getPath('temp')/klippy-recordings/`
- [ ] Identify test gates from PRD (REQ-1 through REQ-9 + manual tests T1-T14)
- [ ] Review existing IPC patterns in `src/preload.ts` and `src/main/ipc-handlers/` for consistency

---

## 1. Service/Command Layer (Electron Main Process)

### 1.1 Screen Recording Service (Core Logic)

**File**: `src/main/services/screenRecordingService.ts`

- [ ] Create `screenRecordingService.ts` with the following functions:
  - [ ] `getAvailableScreens(): Promise<ScreenInfo[]>`
    - Use `desktopCapturer.getSources({ types: ['screen'] })`
    - Return array of screens with `id`, `name`, `resolution`, `thumbnail` (Base64)
    - Error handling: Return empty array if desktopCapturer fails
  - [ ] `createRecordingSession(screenSourceId: string): RecordingSession`
    - Generate unique session ID (UUID)
    - Initialize recording state object
    - Create temp directory if needed: `app.getPath('temp')/klippy-recordings/`
  - [ ] `startRecording(sessionId: string, audioEnabled: boolean): Promise<void>`
    - Get screen stream from desktopCapturer using source ID
    - Get microphone stream from getUserMedia (if audioEnabled)
    - Combine streams using MediaRecorder API
    - Start recording to temp WebM file: `{sessionId}.webm`
    - Start timer to emit elapsed time events every 100ms
    - Error handling: Cleanup streams on failure
  - [ ] `stopRecording(sessionId: string): Promise<{ filePath: string; duration: number }>`
    - Stop MediaRecorder
    - Stop all media tracks (screen + audio)
    - Wait for WebM file to finish writing
    - Call `convertWebmToMp4()` to convert to MP4
    - Return final MP4 path and duration (calculated from FFprobe)
    - Cleanup: Delete intermediate .webm file after successful conversion
  - [ ] `cancelRecording(sessionId: string): Promise<void>`
    - Stop MediaRecorder
    - Stop all media tracks
    - Delete temp files (both .webm and .mp4 if exist)
  - [ ] `getAudioLevel(sessionId: string): number`
    - Use Web Audio API AnalyserNode to calculate current mic level
    - Return 0-100 range
    - Return 0 if audio disabled or no active recording
- [ ] Test: Create mock screen source, start recording for 5 seconds, stop, verify .webm created
- [ ] Test: Call `getAvailableScreens()` on single-monitor system → returns 1 screen
- [ ] Test: Call `cancelRecording()` → temp files deleted

**Data Structures**:
```typescript
interface ScreenInfo {
  id: string;              // desktopCapturer source ID
  name: string;            // "Display 1", "Built-in Retina", etc.
  resolution: string;      // "2560x1600"
  thumbnail: string;       // Base64 data URL
}

interface RecordingSession {
  sessionId: string;
  screenSourceId: string;
  audioStream?: MediaStream;
  recordingState: 'idle' | 'recording' | 'stopping' | 'converting';
  startTime: number;       // Date.now()
  elapsedSeconds: number;
  audioEnabled: boolean;
  tempWebmPath?: string;
  finalMp4Path?: string;
  mediaRecorder?: MediaRecorder;
  analyserNode?: AnalyserNode; // For audio level meter
}
```

---

### 1.2 FFmpeg Service Extension (WebM → MP4 Conversion)

**File**: `src/main/services/ffmpegService.ts` (extend existing)

- [ ] Add function: `convertWebmToMp4(inputPath: string, outputPath: string): Promise<void>`
  - FFmpeg command: Convert WebM to H.264 MP4 at 30fps
  - Example: `ffmpeg -i input.webm -c:v libx264 -preset medium -crf 23 -r 30 -c:a aac -b:a 128k output.mp4`
  - Timeout: 60 seconds (generous for large recordings)
  - Error handling: Reject promise if FFmpeg exits with non-zero code
  - Return: Resolve when conversion complete
- [ ] Test: Create sample .webm file → convert to .mp4 → verify output playable
- [ ] Test: Conversion with audio-only WebM (no video) → gracefully handle or error

---

### 1.3 IPC Handlers (Bridge Preload ↔ Main)

**File**: `src/main/ipc-handlers/recordingHandlers.ts` (new)

- [ ] Create `recordingHandlers.ts` with IPC listeners:
  - [ ] `recording:get-screens` → `getAvailableScreens()`
    - Input: None
    - Output: `{ screens: ScreenInfo[]; error?: string }`
    - Error handling: Return empty array + error message if desktopCapturer fails
  - [ ] `recording:start` → `startRecording()`
    - Input: `{ screenSourceId: string; audioEnabled: boolean }`
    - Output: `{ success: true; sessionId: string }` or `{ success: false; error: string }`
    - Validation: Check screenSourceId not empty
    - Error handling: Return error if recording already active
  - [ ] `recording:stop` → `stopRecording()`
    - Input: `{ sessionId: string }`
    - Output: `{ success: true; filePath: string; duration: number }` or `{ success: false; error: string }`
    - Error handling: Return error if sessionId not found or not recording
  - [ ] `recording:cancel` → `cancelRecording()`
    - Input: `{ sessionId: string }`
    - Output: `{ success: true }` or `{ success: false; error: string }`
  - [ ] `recording:get-audio-level` → `getAudioLevel()`
    - Input: `{ sessionId: string }`
    - Output: `{ level: number }` (0-100)
- [ ] Register all handlers in `src/main.ts` (call `registerRecordingHandlers(ipcMain)` on app ready)
- [ ] Test: Invoke each IPC handler from renderer process → verify responses

**IPC Events** (Main → Renderer):
- [ ] Emit `recording:elapsed-time` every 100ms during active recording
  - Payload: `{ seconds: number }`
- [ ] Emit `recording:state-changed` on state transitions
  - Payload: `{ state: 'recording' | 'stopping' | 'idle' | 'converting' }`
- [ ] Emit `recording:audio-level` every 200ms during recording (if audio enabled)
  - Payload: `{ level: number }` (0-100)
- [ ] Emit `recording:error` if recording fails mid-session
  - Payload: `{ message: string }`
- [ ] Emit `recording:complete` when MP4 conversion finishes
  - Payload: `{ filePath: string; duration: number }`

---

### 1.4 Preload Script Extension

**File**: `src/preload.ts` (modify existing)

- [ ] Add `recording` namespace to `window.electron`:
  ```typescript
  recording: {
    getScreens(): Promise<{ screens: ScreenInfo[]; error?: string }>;
    startRecording(screenSourceId: string, audioEnabled: boolean): Promise<{ success: boolean; sessionId?: string; error?: string }>;
    stopRecording(sessionId: string): Promise<{ success: boolean; filePath?: string; duration?: number; error?: string }>;
    cancelRecording(sessionId: string): Promise<{ success: boolean; error?: string }>;
    getAudioLevel(sessionId: string): Promise<{ level: number }>;

    // Event listeners
    onElapsedTime(callback: (seconds: number) => void): () => void;
    onStateChanged(callback: (state: string) => void): () => void;
    onAudioLevel(callback: (level: number) => void): () => void;
    onError(callback: (message: string) => void): () => void;
    onComplete(callback: (data: { filePath: string; duration: number }) => void): () => void;
  }
  ```
- [ ] Implement event listener setup/cleanup for all 5 event types
- [ ] Update TypeScript declarations for `window.electron.recording`
- [ ] Test: Call `window.electron.recording.getScreens()` from renderer → returns screens

---

## 2. React Components & State

### 2.1 RecordScreenButton Component

**File**: `src/components/RecordScreenButton.tsx` (new)

- [ ] Create toolbar button component:
  - State: `isRecording: boolean` (disabled if true)
  - Visual: Red circle icon + "Record Screen" label
  - Click handler: Opens RecordScreenDialog
  - Styling: Match existing toolbar buttons (ImportButton.tsx as reference)
- [ ] Props: `onOpenDialog: () => void`, `disabled: boolean`
- [ ] Test: Render button → click → `onOpenDialog` called
- [ ] Test: When disabled → button grayed out and not clickable

---

### 2.2 RecordScreenDialog Component

**File**: `src/components/RecordScreenDialog.tsx` (new)

- [x] Create modal dialog component:
  - State:
    - `screens: ScreenInfo[]` (fetched from `window.electron.recording.getScreens()`)
    - `selectedScreenId: string` (default: first screen)
    - `audioEnabled: boolean` (checkbox state)
    - `audioDevices: MediaDeviceInfo[]` (microphone list)
    - `selectedAudioDeviceId: string` (selected microphone)
    - `permissionStatus: 'prompt' | 'granted' | 'denied'`
    - `loading: boolean` (true while fetching screens)
    - `error: string | null`
  - UI Elements:
    - Title: "Select Screen to Record"
    - Screen list: Radio button selection with thumbnails
    - Display: Screen name + resolution (e.g., "Built-in Retina Display - 2560x1600")
    - Audio checkbox: "Record microphone audio"
    - **NEW: Microphone dropdown** (shown when audio enabled)
    - **NEW: Permission status indicator** (shows current mic permission)
    - **NEW: Request Permission button** (if permission not granted)
    - Buttons: "Start Recording" (primary), "Cancel" (secondary)
  - Behavior:
    - On mount: Fetch screens via `window.electron.recording.getScreens()`
    - On mount: Enumerate audio devices via `navigator.mediaDevices.enumerateDevices()`
    - On mount: Check permission status via `navigator.permissions.query({ name: 'microphone' })`
    - On "Start Recording": Call `onStartRecording(selectedScreenId, audioEnabled, selectedAudioDeviceId)`
    - On "Request Permission": Request mic permission and refresh device list
    - On "Cancel": Call `onClose()`
- [ ] **NEW: Implement microphone device enumeration**
  - Use `navigator.mediaDevices.enumerateDevices()` to get audio input devices
  - Filter for `kind === 'audioinput'`
  - Handle cases where labels are empty (permission not granted)
- [ ] **NEW: Implement permission status check**
  - Use `navigator.permissions.query({ name: 'microphone' })` if available
  - Show permission status: "Not Requested", "Granted", "Denied"
  - Provide instructions to reset permission in System Settings if denied
- [ ] **NEW: Implement microphone selection dropdown**
  - Populate dropdown with audio device names
  - Default to system default microphone (deviceId: 'default')
  - Disable dropdown if permission not granted
- [x] Props: `isOpen: boolean`, `onClose: () => void`, `onStartRecording: (screenId: string, audioEnabled: boolean, audioDeviceId?: string) => void`
- [x] Test: Open dialog → screens list populates
- [x] Test: Select screen → click Start Recording → `onStartRecording` called with correct ID
- [x] Test: Error fetching screens → shows error message "Unable to access screens"
- [ ] **NEW: Test microphone selection**
  - Test: Enable audio → microphone dropdown appears
  - Test: Disable audio → microphone dropdown hidden
  - Test: Select different microphone → correct deviceId passed to recording
  - Test: Permission denied → dropdown shows "Grant permission to see devices"

---

### 2.3 RecordingIndicator Component

**File**: `src/components/RecordingIndicator.tsx` (new)

- [ ] Create overlay indicator component:
  - State:
    - `elapsedSeconds: number` (updated via IPC event)
    - `audioLevel: number` (updated via IPC event, 0-100)
  - UI Elements:
    - Red pulsing dot (CSS animation at 1Hz)
    - Timer display: "00:00:00" (HH:MM:SS format)
    - Stop button (red icon)
    - Optional: Audio level meter (horizontal bar)
  - Position: Top-left corner of preview panel (absolute positioning)
  - Behavior:
    - Listen to `recording:elapsed-time` event → update timer
    - Listen to `recording:audio-level` event → update meter
    - Stop button click → calls `onStop()`
- [ ] Props: `onStop: () => void`, `audioEnabled: boolean`
- [ ] Use `useEffect` to set up IPC listeners on mount and cleanup on unmount
- [ ] Test: Render indicator → timer increments every second
- [ ] Test: Stop button click → `onStop` called
- [ ] CSS: Pulsing animation for red dot (0.5s fade in/out cycle)

---

### 2.4 RecordingPermissionDialog Component

**File**: `src/components/RecordingPermissionDialog.tsx` (new)

- [ ] Create modal dialog for microphone permission flow:
  - UI Elements:
    - Title: "Microphone Permission Required"
    - Message: "Klippy needs access to your microphone to record audio with screen recording."
    - Buttons:
      - "Continue Without Audio" (secondary)
      - "Cancel" (tertiary)
  - Behavior:
    - On "Continue Without Audio": Call `onContinueWithoutAudio()`
    - On "Cancel": Call `onCancel()`
- [ ] Props: `isOpen: boolean`, `onContinueWithoutAudio: () => void`, `onCancel: () => void`
- [ ] Test: Render dialog → click Continue Without Audio → callback fires
- [ ] Test: Click Cancel → `onCancel` fires

---

### 2.5 AudioLevelMeter Component (Optional)

**File**: `src/components/AudioLevelMeter.tsx` (new)

- [ ] Create horizontal bar component showing audio level:
  - Props: `level: number` (0-100)
  - Visual: Green bar (0-70), yellow (70-85), red (85-100) gradient
  - Width: 100px, Height: 8px
  - Animation: Smooth transition (CSS transition 100ms)
- [ ] Test: Render with level=50 → bar fills to 50%
- [ ] Test: Render with level=0 → no bar visible

---

### 2.6 Modify Existing Components

**File**: `src/components/MainLayout.tsx` (modify existing)

- [ ] Add RecordScreenButton to toolbar (next to ImportButton)
- [ ] Add state for recording session:
  - `isRecording: boolean`
  - `recordingSessionId: string | null`
  - `showRecordDialog: boolean`
  - `showPermissionDialog: boolean`
- [ ] Add handlers:
  - `handleOpenRecordDialog()`: Set `showRecordDialog = true`
  - `handleStartRecording(screenId: string)`: Request mic permission → start recording
  - `handleStopRecording()`: Stop recording → convert → add to library
  - `handleCancelRecording()`: Cancel recording → cleanup
- [ ] Test: Click Record Screen button → dialog opens
- [ ] Test: Complete recording → new clip appears in Library

**File**: `src/components/Library.tsx` (modify existing)

- [ ] Add support for `source` field in LibraryClip interface:
  - Display small badge "Recording" vs "Imported" (optional visual distinction)
- [ ] No other changes needed (recorded clips treated same as imported)
- [ ] Test: Recorded clip appears in Library with correct duration/thumbnail

**File**: `src/store/sessionStore.ts` (modify existing)

- [ ] Extend `LibraryClip` interface to include:
  ```typescript
  source?: 'import' | 'recording';
  recordedAt?: number;
  ```
- [ ] No other changes needed (session state already handles clips array)
- [ ] Test: Add recorded clip to store → persists correctly

---

## 3. Data Model & Persistence

### 3.1 TypeScript Interfaces

**File**: `src/types/recording.ts` (new)

- [ ] Define interfaces for recording feature:
  ```typescript
  export interface ScreenInfo {
    id: string;
    name: string;
    resolution: string;
    thumbnail: string; // Base64 data URL
  }

  export interface RecordingSession {
    sessionId: string;
    screenSourceId: string;
    recordingState: 'idle' | 'recording' | 'stopping' | 'converting';
    startTime: number;
    elapsedSeconds: number;
    audioEnabled: boolean;
    tempWebmPath?: string;
    finalMp4Path?: string;
  }
  ```

**File**: `src/types/session.ts` (modify existing `LibraryClip` interface)

- [ ] Extend `LibraryClip`:
  ```typescript
  export interface LibraryClip {
    id: string;
    filePath: string;
    filename: string;
    duration: number;
    thumbnail: string;
    source?: 'import' | 'recording';    // NEW
    recordedAt?: number;                // NEW (timestamp)
  }
  ```

### 3.2 Session Persistence

**File**: `src/main/services/session-manager.ts` (extend existing)

- [ ] No changes needed for S9 (recorded clips persist same as imported clips)
- [ ] Recording sessions are ephemeral (not saved to session.json)
- [ ] Recovery from app crash (REQ-9) handled separately (stretch goal for S9)

---

## 4. Integration

### 4.1 Wire React → Electron IPC

- [ ] In `MainLayout.tsx`, implement full recording flow:
  1. User clicks "Record Screen" → Open RecordScreenDialog
  2. User selects screen → Request microphone permission
  3. If permission granted → Start recording with audio
  4. If permission denied → Show RecordingPermissionDialog → User chooses "Continue Without Audio" or "Cancel"
  5. Recording active → Show RecordingIndicator overlay
  6. User clicks Stop → Call `stopRecording()` → Show "Processing..." spinner
  7. FFmpeg conversion complete → Add MP4 to Library → Show success toast
- [ ] Test: Complete happy path end-to-end (record 5 seconds → appears in Library)
- [ ] Test: Permission denied flow → continue without audio → recording works (video-only)
- [ ] Test: Cancel during recording → temp files cleaned up

### 4.2 File System Operations

- [ ] Create temp directory on first recording: `app.getPath('temp')/klippy-recordings/`
- [ ] Cleanup strategy: Delete .webm after successful .mp4 conversion
- [ ] Cleanup strategy: Delete incomplete recordings if app closes mid-recording (REQ-9 - basic version)
- [ ] Test: Multiple recordings → temp directory has only .mp4 files (no leftover .webm)
- [ ] Test: Disk full scenario → error message shown

### 4.3 FFmpeg Integration

- [ ] Verify FFmpeg bundled correctly (already done in MVP, reuse existing `ffmpegService.ts`)
- [ ] Test WebM → MP4 conversion with sample 10-second recording:
  - Input: 10-second screen recording (WebM)
  - Output: MP4 file playable in QuickTime/VLC
  - Audio/video sync verified (no audible drift)
- [ ] Test: Conversion timeout (60 seconds) → error if exceeded
- [ ] Test: Invalid WebM file → FFmpeg error → show user-friendly message

---

## 5. Manual Testing

**Reference testing gates from `prds/s9-screen-recording-prd.md` (pages 590-606)**

### REQ-1: Toolbar Button

- [x] **Happy Path**: Click "Record Screen" button → RecordScreenDialog appears
- [x] **Edge Case**: Click button while dialog already open → no duplicate dialogs
- [x] **Error Handling**: Button disabled during active recording → cannot click

### REQ-2: Screen Selection Dialog

- [x] **Happy Path 1**: Dialog shows 2+ screens → thumbnails visible → user selects one
- [x] **Happy Path 2**: User clicks "Start Recording" → recording begins with selected screen
- [x] **Edge Case**: Single screen system → dialog shows one screen, auto-selected
- [] **Error Handling**: desktopCapturer fails → dialog shows error "Unable to access screens"

### REQ-3: Recording Indicator

- [x] **Happy Path**: Start recording → indicator appears with pulsing red dot + timer
- [x] **Edge Case**: Wait 30 seconds → timer displays "00:00:30" correctly
- [x] **Error Handling**: Stop button always clickable during recording

### REQ-4: Microphone Permission

- [x] **Happy Path 1**: Grant microphone permission → recording includes audio
- [x] **Happy Path 2**: Deny permission → dialog shows "Continue without audio?" → select Continue → video-only recording
- [x] **Edge Case**: Microphone unplugged mid-recording → continue with video-only
- [x] **Error Handling**: Audio level meter shows mic activity when audio enabled
- [x] **NEW - Happy Path 3**: Multiple microphones available → user can select specific microphone from dropdown
- [x] **NEW - Happy Path 4**: Check permission status before recording → shows "Granted", "Denied", or "Not Requested"
- [x] **NEW - Edge Case**: Permission status is "prompt" (not requested) → show "Request Permission" button
- [x] **NEW - Edge Case**: Permission denied → show instructions to reset in System Settings

### REQ-5: Recording Process

- [ ] **Happy Path**: Record 10 seconds → stop → file appears in temp directory
- [ ] **Edge Case**: Record <1 second → stop → produces valid MP4
- [ ] **Error Handling**: Disk full during recording → error dialog "Insufficient disk space"

### REQ-6: Library Integration

- [ ] **Happy Path**: Record video → appears in Library with correct duration
- [ ] **Edge Case**: Record multiple videos (3+) → all appear in Library

### REQ-7: Stop & Error Handling

- [ ] **Happy Path**: Stop button responsive (<500ms)
- [ ] **Edge Case**: Stop immediately after starting (<1 second) → produces valid MP4
- [ ] **Error Handling**: FFmpeg error → dialog shows user-friendly message (not technical jargon)

### REQ-8: Cross-Platform Support

- [ ] **Happy Path Mac**: Record on macOS → save to Library → export works
- [ ] **Happy Path Windows**: (If available) Record on Windows → basic validation
- [ ] **Edge Case**: macOS + Windows path separators handled correctly

### REQ-9: Window Closure & Recovery

- [ ] **Happy Path**: Kill app during recording → restart → recovery dialog appears (stretch goal for S9 - basic implementation)
- [ ] **Edge Case**: Delete temp file manually → app handles missing file gracefully
- [ ] **Error Handling**: Corrupted temp file → don't crash on recovery attempt

---

### Integration Test: "30-Second Screen Recording"

**Setup**: Prepare development environment with 1-2 monitors

**Steps**:
1. Launch Klippy
2. Click "Record Screen" button
3. Select primary screen from dialog
4. Click "Start Recording"
5. Grant microphone permission (if prompted)
6. Wait 30 seconds (perform on-screen actions: open browser, type in text editor)
7. Click Stop button
8. Wait for "Processing..." spinner to complete
9. Verify recorded video appears in Library with duration ~30 seconds
10. Click recorded clip in Library → plays in preview player
11. Verify audio is synchronized (if microphone was active)
12. Drag recorded clip to timeline → add to position 0
13. Click Export → save as `screen-recording-test.mp4`
14. Open exported file in external player (QuickTime/VLC)
15. Verify:
    - Duration: Exactly 30 seconds (±1 second tolerance)
    - Video plays smoothly (no frame drops)
    - Audio synced (if applicable)
    - No visual artifacts

**Success Criteria**: All steps complete without crashes or errors. Audio/video quality acceptable.

---

## 6. Performance

### Performance Targets (from PRD)

- [ ] **Recording Start**: <2 second delay from button click to recording begins
  - Test: Click Start Recording → red indicator appears within 2 seconds
- [ ] **Recording Stop**: <500ms from stop click to file saved (excluding FFmpeg conversion)
  - Test: Click Stop → indicator disappears within 500ms
- [ ] **FFmpeg Conversion**: 10-second recording → <30 seconds to convert
  - Test: Record 10 seconds → measure time from stop to Library update
- [ ] **Memory**: Baseline ~250MB + recording session <100MB additional
  - Test: Open Activity Monitor → start recording → memory increase <100MB
- [ ] **Frame Rate**: 30fps captured; no dropped frames during recording
  - Test: Record screen with timer → verify smooth playback (no stuttering)
- [ ] **Audio Sync**: Drift <100ms (imperceptible to users)
  - Test: Record with audio → export → play in VLC → audio matches video

### Memory Leak Test (15-minute session)

**Procedure**:
1. Open Activity Monitor (Mac) → note baseline memory (~250MB)
2. Record 5-second video → stop → wait for conversion
3. Repeat 10 times (10 recordings total)
4. Check memory after each recording:
   - After recording 1: ~350MB (initial overhead)
   - After recording 5: ~400MB
   - After recording 10: ~450MB
5. Delete all recordings from Library
6. Wait 2 minutes → check memory again (should drop back to ~300MB)

**Pass Criteria**:
- Memory growth <20MB per recording
- No continuous growth (e.g., NOT 350MB → 500MB → 800MB)
- Memory stabilizes after recordings deleted

---

## 7. Definition of Done

### Code Complete
- [ ] All 5 new components implemented (RecordScreenButton, RecordScreenDialog, RecordingIndicator, RecordingPermissionDialog, AudioLevelMeter)
- [ ] screenRecordingService.ts complete with all 6 functions
- [ ] recordingHandlers.ts complete with all 5 IPC handlers
- [ ] Preload script exposes `window.electron.recording` API
- [ ] FFmpeg conversion pipeline functional (convertWebmToMp4)
- [ ] Error handling complete (no unhandled exceptions)

### Testing Complete
- [ ] All 14 manual test cases (T1-T14 from PRD) pass
- [ ] All 9 REQ testing gates pass (REQ-1 through REQ-9)
- [ ] Integration test "30-Second Screen Recording" passes
- [ ] No crashes on any tested scenario
- [ ] Cross-platform tested (Mac primary; Windows best-effort)

### Functional Acceptance Gates (from User Story AC-1 to AC-12)
- [ ] **AC-1**: User can click "Record Screen" button in main toolbar ✓
- [ ] **AC-2**: Dialog displays list of available screens (using desktopCapturer API) ✓
- [ ] **AC-3**: User can select specific screen to record ✓
- [ ] **AC-4**: Recording indicator (red dot + timer) appears when actively recording ✓
- [ ] **AC-5**: Microphone permission requested before recording starts ✓
- [ ] **AC-6**: Audio and video remain synchronized during 30-second recording ✓
- [ ] **AC-7**: Stop button halts recording and saves file to temp location ✓
- [ ] **AC-8**: Recorded video automatically added to Library with playable thumbnail ✓
- [ ] **AC-9**: Screen recording works on macOS (Windows best-effort) ✓
- [ ] **AC-10**: Handles window closure during recording (basic implementation; full recovery is stretch) ✓
- [ ] **AC-11**: Error dialog shown if microphone permission denied; screen-only recording allowed ✓

### Quality Assurance
- [ ] No memory leaks (15-minute session with 10+ recordings)
- [ ] Audio quality acceptable (no distortion, clear dialog)
- [ ] UI/UX matches Klippy design system (consistent with existing components)
- [ ] Error messages user-friendly (no technical jargon like "FFmpeg exit code 1")
- [ ] No console warnings or errors during all test scenarios

### Performance Gates
- [ ] Recording at native screen resolution without frame drops (30fps)
- [ ] A/V sync verified (<100ms drift)
- [ ] FFmpeg conversion completes within 30 seconds for 10-second recording
- [ ] Memory stable (<100MB additional during recording session)
- [ ] UI responsive during recording (timeline/library not frozen)

---

## 8. PR & Merge

⚠️ **CRITICAL**: DO NOT COMMIT UNTIL USER CONFIRMS ALL TEST GATES PASS

- [ ] Create branch `feat/screen-recording` from `develop`
- [ ] User confirms all test gates pass ← WAIT FOR THIS
- [ ] User says "ready to commit" or "looks good"
- [ ] THEN: Commit changes with logical grouping:
  - Commit 1: "feat(recording): add screen recording service and IPC handlers"
  - Commit 2: "feat(recording): add React components for recording UI"
  - Commit 3: "feat(recording): integrate recording feature into MainLayout"
  - Commit 4: "feat(recording): add FFmpeg WebM to MP4 conversion"
- [ ] Open PR with:
  - Title: "feat: S9 - Screen Recording"
  - Link to user story: USER_STORIES.md lines 33-68
  - Link to PRD: prds/s9-screen-recording-prd.md
  - Summary of changes:
    - Added screen recording capability using desktopCapturer API
    - Implemented microphone permission flow with audio sync
    - Added UI components: RecordScreenButton, RecordScreenDialog, RecordingIndicator
    - Integrated FFmpeg conversion pipeline (WebM → MP4 H.264)
    - Recorded videos automatically added to Library
  - Manual test results: All 14 test cases pass (T1-T14)
  - Performance benchmarks: Recording start <2s, conversion <30s, A/V sync <100ms
- [ ] Code reviewed by team lead
- [ ] Approved for merge to `develop`

---

## Notes

### Technical Approach

**Recording Strategy**:
1. Use Electron's `desktopCapturer` API to get screen stream
2. Use Web Audio API (`getUserMedia`) to get microphone stream
3. Combine streams with MediaRecorder API → record to WebM (fast, native browser format)
4. On stop, convert WebM → MP4 H.264 using FFmpeg (for compatibility with existing export pipeline)

**Why WebM → MP4 instead of direct MP4 recording?**
- MediaRecorder natively supports WebM (fast, no extra dependencies)
- MP4 requires H.264 codec which is not always available in Electron's Chromium
- FFmpeg conversion ensures consistent H.264 output across platforms

**Audio Sync Strategy**:
- MediaRecorder handles A/V sync automatically during recording
- FFmpeg conversion preserves timestamps (no re-encoding of audio unless needed)
- Test A/V sync with 30-second recording as acceptance gate

### Risks & Mitigation

1. **Audio/Video Sync Drift**:
   - Risk: High (complexity of multi-stream recording)
   - Mitigation: Use MediaRecorder's built-in sync; test on multiple hardware configs
   - Fallback: Add FFmpeg `-async 1` flag if drift detected

2. **FFmpeg Conversion Timeout**:
   - Risk: Low (most recordings <2 minutes)
   - Mitigation: Set 60-second timeout; show spinner during conversion
   - Fallback: Retry logic if conversion fails

3. **Memory Leak in Recording Session**:
   - Risk: Medium (media streams not cleaned up)
   - Mitigation: Explicitly stop all tracks and release MediaRecorder on stop/cancel
   - Test: 15-minute multi-recording session

4. **Platform-Specific Issues (Windows)**:
   - Risk: High (Windows audio APIs differ from macOS)
   - Mitigation: Test on Windows VM; document known limitations
   - Scope: Windows is best-effort for S9

### Implementation Order (Recommended)

1. **Week 1: Core Backend**:
   - Day 1-2: screenRecordingService.ts (getAvailableScreens, recording logic)
   - Day 3: recordingHandlers.ts (IPC bridge)
   - Day 4: FFmpeg conversion (convertWebmToMp4)
   - Day 5: Test backend isolation (no UI yet)

2. **Week 2: React UI**:
   - Day 1: RecordScreenButton + RecordScreenDialog
   - Day 2: RecordingIndicator + AudioLevelMeter
   - Day 3: RecordingPermissionDialog + permission flow
   - Day 4: Integrate into MainLayout
   - Day 5: End-to-end testing

3. **Week 3: Polish & Testing**:
   - Day 1-2: Manual testing (all 14 test cases)
   - Day 3: Performance testing + memory leak test
   - Day 4: Cross-platform testing (Windows VM)
   - Day 5: Bug fixes + PR preparation

### Blockers & Questions

- [ ] **Question**: Should recording continue if user switches to different virtual desktop/space on macOS?
  - Answer: Yes, desktopCapturer continues recording selected screen regardless of user's current space
- [ ] **Question**: What if user has no microphone (e.g., desktop without mic)?
  - Answer: Show permission dialog → user chooses "Continue Without Audio" → record video-only
- [ ] **Blocker**: desktopCapturer API requires `enablePreferredSizeMode` for high-DPI screens?
  - Research: Check Electron docs for latest desktopCapturer options

---

## References

- **PRD**: `prds/s9-screen-recording-prd.md` (full specification)
- **User Story**: USER_STORIES.md lines 33-68 (acceptance criteria)
- **Electron desktopCapturer**: https://www.electronjs.org/docs/latest/api/desktop-capturer
- **MediaRecorder API**: https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder
- **FFmpeg WebM to MP4**: https://trac.ffmpeg.org/wiki/Encode/H.264
- **Existing IPC patterns**: src/preload.ts, src/main/ipc-handlers/import.ts

---

**Document Status**: Ready for Implementation
**Next Steps**: User approval on TODO → Begin implementation starting with Pre-Implementation tasks

---

*End of TODO*
