# TODO — S11: Picture-in-Picture Recording

**Branch**: `feat/pip-recording`
**Source**: User story S11 (created by Brenda)
**PRD Reference**: `prds/s11-picture-in-picture-recording-prd.md`
**Owner (Agent)**: Caleb

---

## 0. Pre-Implementation

- [ ] Read user story and acceptance criteria thoroughly (USER_STORIES.md S11)
- [ ] Read PRD `prds/s11-picture-in-picture-recording-prd.md`
- [ ] **CRITICAL: Validate technology choices in PRD**:
  - [ ] Confirm simultaneous `desktopCapturer` (screen) + `getUserMedia` (webcam) capture works in Electron
  - [ ] Confirm both streams can be recorded independently to temp files concurrently
  - [ ] Confirm FFmpeg overlay filter syntax: `[1:v]scale=W:H[webcam];[0:v][webcam]overlay=x=X:y=Y` produces correct composite
  - [ ] Test position mapping: TL=(0,0), TR=(w-wc,0), BL=(0,h-hc), BR=(w-wc,h-hc) calculations
  - [ ] Verify audio mixing with FFmpeg `-filter_complex` (both, screen-only, webcam-only modes)
  - [ ] Test composite creation time: 30sec → <10sec, 5min → <30sec on modern hardware
  - [ ] Document chosen approach: Separate WebRTC captures → FFmpeg post-processing overlay
- [ ] Clarify any ambiguities before starting
- [ ] Identify test gates from PRD (Happy Path 1-2, Edge Case 1-2, Error Case 1-2, Performance)

---

## 1. Service/Command Layer (Electron IPC)

Implement deterministic backend handlers in Electron main process invoked by React frontend via IPC.

### 1.1 IPC Handler: `get-screens`

- [ ] Create/extend `src/main/ipc-handlers/recording.ts`
- [ ] Implement `get-screens` handler:
  - **Input**: None
  - **Output**: `Array<{id: string; name: string; isPrimary: boolean}>`
  - **Logic**:
    1. Use Electron `desktopCapturer.getSources({ types: ['window', 'screen'] })`
    2. Map sources to screen list with names (e.g., "Primary Display", "Secondary Display", "App Window")
    3. Return sorted by isPrimary first
  - **Error handling**: Return empty array if no screens (log warning)
- [ ] Test: Multiple screens → list includes all, isPrimary flag correct

### 1.2 IPC Handler: `check-camera-available`

- [ ] Implement `check-camera-available` handler:
  - **Input**: None
  - **Output**: `{available: boolean; reason?: string}`
  - **Logic**:
    1. Check if camera accessible (can attempt `getUserMedia`)
    2. If successful: return `{available: true}`
    3. If denied/in-use: return `{available: false, reason: "Permission denied"/"Camera in use"}`
  - **Error handling**: Graceful (no error thrown, just `available: false`)
- [ ] Test: Camera accessible → `{available: true}`
- [ ] Test: Camera in use → `{available: false, reason: "Camera in use"}`
- [ ] Test: Permission denied → `{available: false, reason: "Permission denied"}`

### 1.3 IPC Handler: `get-pip-settings`

- [ ] Implement `get-pip-settings` handler:
  - **Input**: None
  - **Output**: `PiPRecordingSettings` (with defaults if none saved)
  - **Logic**:
    1. Read `app.getPath('userData')/session.json`
    2. Extract `pipSettings` section
    3. Return with defaults: `{screenId: primaryId, webcamPosition: 'BL', webcamSize: 'medium', audioMode: 'both'}`
  - **Error handling**: Return defaults if file missing or parse fails
- [ ] Test: First launch → defaults returned
- [ ] Test: After previous PiP recording → settings restored

### 1.4 IPC Handler: `start-pip-recording`

- [ ] Implement `start-pip-recording` handler:
  - **Input**: `{screenId: string; settings: PiPRecordingSettings}`
  - **Output**: `{recordingId: string; status: 'recording'}`
  - **Logic**:
    1. Validate screenId (from `get-screens` list)
    2. Validate camera available (from `check-camera-available`)
    3. Create unique recordingId (UUID)
    4. Create temp files:
       - `app.getPath('temp')/pip-screen-[timestamp].mp4`
       - `app.getPath('temp')/pip-webcam-[timestamp].mp4`
    5. Start screen capture via `desktopCapturer`:
       ```javascript
       const screenSource = sources.find(s => s.id === screenId);
       const constraints = {
         audio: {echoCancellation: false},
         video: {
           mandatory: {
             chromeMediaSource: 'desktop',
             chromeMediaSourceId: screenSource.id,
             maxWidth: screenSource.width,
             maxHeight: screenSource.height
           }
         }
       };
       const screenStream = await navigator.webkitGetUserMedia(constraints);
       ```
    6. Start webcam capture via `getUserMedia`:
       ```javascript
       const webcamStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
       ```
    7. Create two `MediaRecorder` instances (one per stream)
    8. Store recordingId → {screenRecorder, webcamRecorder, startTime, temp files, settings} in global map
    9. Return `{recordingId, status: 'recording'}`
  - **Error handling**: Validation errors, desktopCapturer fails, getUserMedia fails (return error)
- [ ] Test: Valid screenId + camera available → recordingId returned, both streams recording

### 1.5 IPC Handler: `stop-pip-recording`

- [ ] Implement `stop-pip-recording` handler:
  - **Input**: `{recordingId: string}`
  - **Output**: `{screenFile: string; webcamFile: string; duration: number}`
  - **Logic**:
    1. Look up recordingId in global map
    2. Stop both MediaRecorder instances
    3. Wait for ondataavailable callbacks
    4. Combine chunks into Blobs for each stream
    5. Convert Blobs to Buffers and write to temp files
    6. Calculate duration: `Date.now() - startTime`
    7. Delete recordingId from global map
    8. Return file paths and duration
  - **Error handling**: Invalid recordingId, file write fails (return error)
- [ ] Test: Recording active → Stop → files exist and are valid

### 1.6 IPC Handler: `composite-pip-videos`

- [ ] Implement `composite-pip-videos` handler:
  - **Input**: `{screenFile: string; webcamFile: string; settings: PiPRecordingSettings; outputPath: string}`
  - **Output**: `{compositeFile: string; duration: number}`
  - **Logic**:
    1. Validate both input files exist
    2. Probe both files with `ffprobe` to get dimensions/duration
    3. Calculate overlay position and size from settings:
       ```javascript
       const screenW = probeScreen.width;
       const screenH = probeScreen.height;

       const sizeMap = {
         small: 0.2,
         medium: 0.3,
         large: 0.4
       };
       const webcamW = Math.floor(screenW * sizeMap[settings.webcamSize]);
       const webcamH = Math.floor(webcamW / 16 * 9); // Assume 16:9 ratio

       const posMap = {
         TL: {x: 0, y: 0},
         TR: {x: screenW - webcamW, y: 0},
         BL: {x: 0, y: screenH - webcamH},
         BR: {x: screenW - webcamW, y: screenH - webcamH}
       };
       const pos = posMap[settings.webcamPosition];
       ```
    4. Build FFmpeg command with audio routing based on `settings.audioMode`:
       - "both": `[0:a][1:a]amerge=inputs=2[audio]` (mix audio from both sources)
       - "screen-only": Use only screen audio `[0:a]`
       - "webcam-only": Use only webcam audio `[1:a]`
    5. Execute FFmpeg:
       ```bash
       ffmpeg -i screenFile -i webcamFile \
         -filter_complex "[1:v]scale=webcamW:webcamH[webcam];[0:v][webcam]overlay=x=X:y=Y[vid];..." \
         -map "[vid]" -map "[audio]" \
         -c:v libx264 -preset medium -crf 23 \
         -c:a aac -b:a 128k \
         outputPath
       ```
    6. Monitor FFmpeg progress (optional: emit via IPC for progress bar)
    7. On completion: Probe output file for duration, return result
    8. Clean up temp input files (screenFile, webcamFile)
  - **Error handling**: Probe fails, FFmpeg fails, file write fails (return error)
- [ ] Test: Valid inputs → composite created with correct overlay position/size
- [ ] Test: Audio mode "both" → mix audible, "screen-only" → only screen, "webcam-only" → only webcam

### 1.7 IPC Handler: `save-pip-settings`

- [ ] Implement `save-pip-settings` handler:
  - **Input**: `{settings: PiPRecordingSettings}`
  - **Output**: `{success: boolean}`
  - **Logic**:
    1. Read `app.getPath('userData')/session.json`
    2. Update `pipSettings` section with provided settings
    3. Write back to session.json
    4. Return success
  - **Error handling**: File I/O fails (return error)
- [ ] Test: Settings saved → next launch restores them

### 1.8 Register Handlers

- [ ] Export `registerPiPHandlers(ipcMain)` from `src/main/ipc-handlers/recording.ts`
- [ ] Call `registerPiPHandlers(ipcMain)` in `src/main/main.ts` on app startup
- [ ] Ensure handlers are available before React renders
- [ ] Test: All handlers registered and callable from renderer

---

## 2. React Components & State

Create/modify React components per user story.

### 2.1 Component: `PiPRecordingModal.tsx`

- [ ] Create `src/components/PiPRecordingModal.tsx`
- [ ] **Props**: `{isOpen: boolean; onClose: () => void; onVideoSaved: (filePath: string) => void}`
- [ ] **State**:
  ```typescript
  interface PiPModalState {
    stage: 'screen-selection' | 'settings' | 'recording' | 'compositing' | 'error' | 'success';
    screens: Array<{id: string; name: string; isPrimary: boolean}>;
    selectedScreenId?: string;
    settings: PiPRecordingSettings;
    cameraAvailable: boolean;
    recordingId?: string;
    elapsedSeconds: number;
    errorMessage?: string;
    compositeProgress?: number; // Optional: 0-100
  }
  ```
- [ ] **Lifecycle**:
  - **On mount/open**:
    1. Call `get-screens` → populate screen list
    2. Call `check-camera-available` → set cameraAvailable flag
    3. Call `get-pip-settings` → restore last used settings
    4. Set `stage: 'screen-selection'`
  - **On screen select**: Update `selectedScreenId`, move to `stage: 'settings'`
  - **On camera unavailable**: Show error with "Try Again" button
  - **On settings change**: Update local settings state (live preview updates)
  - **On Start Recording**:
    1. Call `start-pip-recording` with selectedScreenId + settings
    2. Set `stage: 'recording'`
    3. Start timer (update every 1 sec)
  - **On Stop Recording**:
    1. Call `stop-pip-recording` with recordingId
    2. Set `stage: 'compositing'`
    3. Call `composite-pip-videos` with both temp files + settings
    4. Monitor progress (if implemented)
  - **On composite complete**: Set `stage: 'success'`, call `onVideoSaved(compositeFile)`, close after delay
  - **On error**: Set `stage: 'error'`, show error message + "Try Again" / "Close" buttons
- [ ] **Render States**:
  - **screen-selection**: Dropdown/list of screens, "Next" button
  - **settings**:
    - Live webcam preview overlay (positioned according to settings)
    - Position buttons: TL, TR, BL, BR (radio group)
    - Size radio buttons: Small, Medium, Large
    - Audio mode dropdown: Both, Screen only, Webcam only
    - "Start Recording" button (enabled if camera available)
    - "Cancel" button
  - **recording**:
    - Red pulsing dot + timer (MM:SS:MS format)
    - "Recording screen + webcam..."
    - "Stop" button
  - **compositing**:
    - Spinner/progress indicator
    - "Creating composite video (this may take a moment)..."
    - No cancel button
  - **success**:
    - Checkmark + "PiP recording saved"
    - Auto-close after 2 seconds
  - **error**:
    - Error icon + message
    - "Try Again" button
    - "Close" button
- [ ] Test: Modal renders all states correctly
- [ ] Test: Screen selection → Settings → Recording → Compositing → Success flow works
- [ ] Test: Error handling: camera unavailable, recording fails, compositing fails

### 2.2 Component: `PiPSettings.tsx`

- [ ] Create `src/components/PiPSettings.tsx`
- [ ] **Props**: `{settings: PiPRecordingSettings; onSettingsChange: (settings) => void; livePreviewElement: JSX.Element}`
- [ ] **Render**:
  - Position control: Radio buttons (TL, TR, BL, BR)
  - Size control: Radio buttons (Small 20%, Medium 30%, Large 40%)
  - Audio mode dropdown: "Both", "Screen only", "Webcam only"
  - Live preview showing webcam overlay at selected position/size
- [ ] **Event Handlers**:
  - Position change → update settings, update live preview
  - Size change → update settings, update live preview (rescale)
  - Audio mode change → update settings
- [ ] Test: All controls respond to changes
- [ ] Test: Live preview updates in real-time as settings change

### 2.3 Component: `RecordingIndicator.tsx`

- [ ] Create `src/components/RecordingIndicator.tsx`
- [ ] **Props**: `{isRecording: boolean; elapsedSeconds: number; onStop: () => void}`
- [ ] **Render**:
  - Pulsing red dot (CSS animation)
  - Timer in MM:SS format (updates every 1 sec from prop)
  - "Stop" button
  - Message: "Recording screen + webcam..."
- [ ] **Styles**:
  - Red dot: CSS keyframe animation `@keyframes pulse { 0% {opacity: 1} 50% {opacity: 0.3} 100% {opacity: 1} }`
  - Position: Fixed top-center or floating
- [ ] Test: Red dot pulses continuously during recording
- [ ] Test: Timer counts correctly
- [ ] Test: Stop button triggers callback

### 2.4 Live Webcam Preview

- [ ] In `PiPRecordingModal.tsx` (Settings stage):
  - Create `<video>` element showing live webcam preview
  - Use `getUserMedia()` to access webcam feed
  - Apply CSS positioning based on `settings.webcamPosition`
  - Apply CSS scaling based on `settings.webcamSize`
  - Show this overlay on top of semi-transparent screen preview
- [ ] Test: Preview shows live webcam, position/size changes update instantly

### 2.5 Window Closing During Recording

- [ ] In `PiPRecordingModal.tsx`:
  - Listen for app close events via IPC
  - If `stage: 'recording'` or `stage: 'compositing'`: Show dialog "Recording in progress. Quit anyway?"
  - If "Cancel": Abort close
  - If "Quit": Stop recording, cleanup temp files, exit
- [ ] Test: Close app during recording → prompt shown → "Quit" exits cleanly

---

## 3. Data Model & Persistence

### 3.1 TypeScript Interfaces

- [ ] Define `PiPRecordingSettings` interface (from PRD):
  ```typescript
  interface PiPRecordingSettings {
    screenId: string;
    webcamPosition: 'TL' | 'TR' | 'BL' | 'BR';
    webcamSize: 'small' | 'medium' | 'large';
    audioMode: 'both' | 'screen-only' | 'webcam-only';
  }
  ```
- [ ] Define `PiPRecordingSession` interface:
  ```typescript
  interface PiPRecordingSession {
    id: string;
    startTime: number;
    screenFilePath: string;
    webcamFilePath: string;
    settings: PiPRecordingSettings;
    status: 'recording' | 'stopping' | 'compositing' | 'done' | 'error';
    errorMessage?: string;
  }
  ```
- [ ] Define `Screen` interface:
  ```typescript
  interface Screen {
    id: string;
    name: string;
    isPrimary: boolean;
  }
  ```

### 3.2 Session Persistence

- [ ] Modify `src/store/session.json` structure:
  - Add `pipSettings` section:
    ```json
    {
      "pipSettings": {
        "lastPosition": "BL",
        "lastSize": "medium",
        "lastAudioMode": "both"
      }
    }
    ```
- [ ] Load on app startup (existing session.json loading)
- [ ] Save via `save-pip-settings` IPC handler
- [ ] Test: Settings persist across app restarts

---

## 4. Integration

### 4.1 Wire Components → IPC

- [ ] In `PiPRecordingModal.tsx`:
  - Import `ipcRenderer` from Electron
  - Call `ipcRenderer.invoke('get-screens')` on mount
  - Call `ipcRenderer.invoke('check-camera-available')` on mount
  - Call `ipcRenderer.invoke('get-pip-settings')` on mount
  - Call `ipcRenderer.invoke('start-pip-recording', {screenId, settings})` on "Start Recording"
  - Call `ipcRenderer.invoke('stop-pip-recording', {recordingId})` on "Stop Recording"
  - Call `ipcRenderer.invoke('composite-pip-videos', {screenFile, webcamFile, settings, outputPath})` on stop
  - Call `ipcRenderer.invoke('save-pip-settings', settings)` on settings change
- [ ] Test: All IPC calls execute and return expected results

### 4.2 Auto-Import to Library

- [ ] Modify `src/components/Library.tsx`:
  - Add handler from `onVideoSaved` callback (passed from `PiPRecordingModal`)
  - Extract metadata from composite file using `ffprobe` or existing utility
  - Generate clip name: `PiP_Recording_[timestamp]`
  - Create `Clip` object with type flag `isPiPRecording: true`
  - Add to Library state
  - Generate thumbnail (first frame of composite) via FFmpeg
  - Display in Library with PiP badge
- [ ] Test: Recording completes → clip appears in Library immediately
- [ ] Test: Clip plays correctly with both layers visible

### 4.3 Add Button to Toolbar

- [ ] Modify `src/components/MainLayout.tsx` or Toolbar:
  - Add button "Record Screen + Webcam (PiP)" next to other record buttons
  - Wire button click to open `PiPRecordingModal`
  - Disable button if recording already active (from other source)
- [ ] Test: Button visible, click opens modal

### 4.4 Quit Prevention During PiP Recording

- [ ] In `src/main/main.ts`:
  - Track recording state globally (set when `start-pip-recording` called, clear when `stop-pip-recording` called)
  - Listen for `before-quit` event
  - If recording active: Show dialog "Recording in progress. Quit anyway?"
  - If "Cancel": Prevent quit
  - If "Quit": Complete recording gracefully (record up to current point, export partial), then exit
- [ ] Test: Close app during recording → prompt shown → behavior as described

### 4.5 FFmpeg Integration

- [ ] Ensure FFmpeg binary available (via `ffmpeg-static` package)
- [ ] Use existing FFmpeg utility function (if available in codebase)
- [ ] Construct overlay composition command (see 1.6 above)
- [ ] Test: FFmpeg executes, composite MP4 created with correct overlay

---

## 5. Manual Testing

**Reference testing gates from PRD Section 9 (Testing & Acceptance Gates):**

### Happy Path Tests

- [ ] **Test 1: Basic PiP Recording (PRD Happy Path 1)**
  - Click "Record Screen + Webcam (PiP)" → Select primary screen
  - Grant camera + mic permissions (if needed) → Accept default settings (BL, Medium, Both)
  - Click "Start Recording" → Record for 10 seconds
  - Click "Stop" → Wait for "Creating composite..."
  - Modal closes, video appears in Library with thumbnail
  - Click video to play → Verify: Composite plays, screen visible, webcam overlay in BL corner, both audio sources audible
  - **Gate**: Video plays correctly, both layers visible, audio synced, no errors

- [ ] **Test 2: Custom PiP Settings (PRD Happy Path 2)**
  - Open PiP Recording Modal → Change webcam position to TR
  - Change size to Small (20%) → Change audio mode to "Screen only"
  - Start recording for 10 seconds → Stop
  - Wait for composite
  - Play result → Verify: Overlay in TR corner (small), only system audio audible (no mic)
  - **Gate**: Overlay position/size applied correctly, audio mode respected, no errors

### Edge Case Tests

- [ ] **Test 3: One Source Fails During Recording (PRD Edge Case 1)**
  - Start PiP recording → Record for 5 seconds
  - Unplug webcam or close camera app (simulate failure)
  - Continue recording (system should detect failure)
  - Click "Stop" → System shows: "Webcam disconnected during recording. Saved as screen recording only."
  - Play result → Verify: Screen content visible, webcam track missing (clean fallback)
  - **Gate**: Fall back to single source gracefully, no crash, user notified, file saved

- [ ] **Test 4: Long Recording - 5 Minutes (PRD Edge Case 2)**
  - Record 5-minute PiP video
  - Stop recording → Compositing takes ~20-30 seconds
  - Modal shows spinner entire time → User can click other UI (verify app responsive)
  - Compositing completes, modal closes
  - Video appears in Library with correct duration → Play and verify sync
  - **Gate**: Audio/video synchronized over 5 minutes, no memory leaks, UI not frozen

### Error Handling Tests

- [ ] **Test 5: Camera Permission Denied (PRD Error Case 1)**
  - Click "Record Screen + Webcam (PiP)"
  - System requests camera permission → User denies
  - Modal shows error: "Camera permission denied. Enable in System Preferences → Security & Privacy → Camera."
  - "Try Again" button available → User grants permission in System Prefs, clicks "Try Again"
  - Camera becomes available, recording proceeds
  - **Gate**: Error message clear, user can recover without closing modal

- [ ] **Test 6: Camera In Use By Another App (PRD Error Case 2)**
  - Open Facetime or video app → Click "Record Screen + Webcam (PiP)"
  - System detects: "Camera in use by another app. Please close [App Name] and try again."
  - User closes Facetime → "Try Again" button refreshes camera status
  - Camera now available, recording proceeds
  - **Gate**: User guidance clear, can retry without restarting

### Performance Tests

- [ ] **Test 7: Composite Creation Time (PRD Performance Gate)**
  - Record 30-second PiP video → Composite should complete in <10 seconds
  - Record 5-minute PiP video → Composite should complete in <30 seconds
  - User sees spinner entire time (no perception of frozen app)
  - **Gate**: Composite times within spec

- [ ] **Test 8: Audio/Video Sync (PRD Performance Gate)**
  - Record 5-minute PiP with audio → Play result
  - Verify audio/video drift: <50ms tolerance
  - **Gate**: Sync within tolerance over full duration

- [ ] **Test 9: Memory Usage (PRD Performance Gate)**
  - Monitor memory during recording (two simultaneous streams): <200MB above baseline
  - Monitor memory during compositing (FFmpeg subprocess): <300MB
  - **Gate**: Memory stable, no leaks

### Manual Testing Checklist

- [ ] Screen selection dropdown works, shows all monitors
- [ ] Camera availability check accurate
- [ ] Live webcam preview smooth and positioned correctly
- [ ] Position buttons (TL/TR/BL/BR) update preview instantly
- [ ] Size buttons (Small/Medium/Large) update preview with correct scaling
- [ ] Audio mode dropdown changes audio source routing
- [ ] Recording indicator (red dot + timer) visible and accurate
- [ ] Stop button halts both streams
- [ ] Compositing shows clear "Creating composite..." message
- [ ] Composite file created with correct overlay applied
- [ ] Composite file appears in Library with thumbnail
- [ ] Composite file plays with audio
- [ ] PiP settings persisted and restored on next launch
- [ ] Quit prevention dialog works during recording
- [ ] Graceful fallback if one source fails
- [ ] Error messages clear and actionable
- [ ] All states render without crashing

### Cross-Platform Testing

- [ ] Test on macOS (primary platform)
  - Screen selection with multiple monitors
  - Camera/mic permission dialogs
  - FFmpeg encoding
- [ ] Test on Windows (best-effort)
  - Desktop capture via Windows API
  - Camera access via Windows
  - FFmpeg encoding (may need fallback for system audio)

---

## 6. Performance

- [ ] Verify targets from PRD (Section 9):
  - Composite creation: 30sec → <10sec, 5min → <30sec
  - Audio/video sync: <50ms drift
  - Memory: <200MB recording, <300MB compositing
- [ ] Test: Composite creation time (use system clock)
- [ ] Test: Audio/video sync (play back, listen for drift)
- [ ] Test: Memory profiler during recording/compositing

---

## 7. Definition of Done

- [ ] All acceptance criteria from user story (AC-1 through AC-12) pass
- [ ] All test gates from PRD Section 9 pass (happy paths, edge cases, errors, performance)
- [ ] Code has comments for complex FFmpeg overlay logic
- [ ] No console warnings or errors during recording/compositing
- [ ] Cross-platform tested: macOS + Windows (screen selection, camera, FFmpeg)

### Definition of Done Checklist (from PRD Section 10)

- [ ] `PiPRecordingModal.tsx` implemented with all states (settings, recording, compositing, error)
- [ ] `RecordingIndicator.tsx` created with pulsing red dot + timer
- [ ] `PiPSettings.tsx` created with position/size/audio controls
- [ ] IPC handlers implemented: `get-screens`, `check-camera-available`, `get-pip-settings`, `start-pip-recording`, `stop-pip-recording`, `composite-pip-videos`, `save-pip-settings`
- [ ] Screen + webcam simultaneous capture working (separate temp files)
- [ ] FFmpeg overlay composition working (correct position/size based on settings)
- [ ] Audio mixing/selection working (both, screen-only, webcam-only modes)
- [ ] Graceful failure handling: One source fails → fall back to single source
- [ ] "Creating composite..." modal shows during post-processing (user sees "waiting" state)
- [ ] Composite video auto-added to Library, playable immediately
- [ ] PiP settings persisted to session.json (restored on next use)
- [ ] Quit prevention dialog works during active recording
- [ ] All happy path tests pass ✅
- [ ] All edge case tests pass ✅
- [ ] All error case tests pass ✅
- [ ] All performance tests pass ✅
- [ ] No console errors or warnings
- [ ] Code reviewed and merged to develop

---

## 8. PR & Merge

⚠️ **CRITICAL**: DO NOT COMMIT UNTIL USER CONFIRMS ALL TEST GATES PASS

- [ ] Create branch `feat/pip-recording` from `develop`
- [ ] User confirms all test gates pass ← WAIT FOR THIS
- [ ] User says "ready to commit" or "looks good"
- [ ] THEN: Commit changes with message:
  ```
  feat(recording): add picture-in-picture recording

  - Implement simultaneous screen + webcam capture via desktopCapturer + getUserMedia
  - Add PiPRecordingModal with settings configuration (position, size, audio mode)
  - Add RecordingIndicator component with pulsing red dot + timer
  - Implement FFmpeg overlay composition for PiP video creation
  - Support audio mixing: both sources, screen-only, or webcam-only
  - Graceful degradation if one source fails during recording
  - Auto-import composite video to Library with thumbnail
  - Persist PiP settings to session.json
  - Add "Record Screen + Webcam (PiP)" button to toolbar
  - Prevent app quit during active PiP recording

  Refs: USER_STORIES.md S11, prds/s11-picture-in-picture-recording-prd.md
  Depends: S9 (Screen Recording), S10 (Webcam Recording)
  ```
- [ ] THEN: Create PR to `develop` with:
  - **Title**: `feat(recording): S11 - Picture-in-Picture Recording`
  - **Description**:
    - Link to user story: USER_STORIES.md S11
    - Link to PRD: prds/s11-picture-in-picture-recording-prd.md
    - Summary of changes (IPC handlers, components, FFmpeg integration)
    - Manual test results (all tests passed, performance verified)
    - Notes on dependencies: Requires S9 + S10 implementation
- [ ] Code reviewed
- [ ] Merge to `develop`

---

## Notes

- **Parallel Capture**: Both screen and webcam streams record independently to separate temp files; FFmpeg composites them afterward (not real-time)
- **FFmpeg Composition**: Use `[1:v]scale=W:H[webcam];[0:v][webcam]overlay=x=X:y=Y` filter syntax
  - Position calculation: Depends on `webcamPosition` enum (TL/TR/BL/BR) and screen dimensions
  - Size calculation: Depends on `webcamSize` enum (20%/30%/40% of screen width)
- **Audio Routing**: Use FFmpeg `-filter_complex` for audio selection:
  - "both": `[0:a][1:a]amerge=inputs=2` (mix screen + mic audio)
  - "screen-only": Map only `[0:a]`
  - "webcam-only": Map only `[1:a]`
- **Temp Files**: Use unique timestamps:
  - `app.getPath('temp')/pip-screen-[timestamp].mp4`
  - `app.getPath('temp')/pip-webcam-[timestamp].mp4`
  - `app.getPath('temp')/pip-composite-[timestamp].mp4`
- **Desktop Capture**: Electron `desktopCapturer` API requires context isolation; ensure preload script exposes safe IPC methods
- **WebRTC in Renderer**: Camera access via `getUserMedia()` runs in Renderer process (secure); encoding/compositing via FFmpeg runs in Main process
- **Cross-Platform Considerations**:
  - macOS: `desktopCapturer` + `getUserMedia` work natively
  - Windows: Same APIs, but audio capture may require Web Audio API workaround (test on Windows)
- **Dependencies**: S9 (Screen Recording) and S10 (Webcam Recording) should be completed first (reference patterns for capture implementation)
- **Blockers**: Document immediately if:
  - FFmpeg overlay filter produces distorted output
  - Audio sync drift exceeds 50ms tolerance on long recordings
  - Memory usage exceeds 300MB during compositing
  - Cross-platform issues with camera access or screen capture

---

**Status**: Ready for Implementation
**Next Step**: Start with Section 0 (Pre-Implementation validation), then Section 1 (IPC Handlers), then Section 2 (React Components), then integrate and test
