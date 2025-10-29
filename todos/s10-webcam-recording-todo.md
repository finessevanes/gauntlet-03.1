# TODO — S10: Webcam Recording

**Branch**: `feat/webcam-recording`
**Source**: User story S10 (created by Brenda)
**PRD Reference**: `prds/s10-webcam-recording-prd.md`
**Owner (Agent)**: Caleb

---

## 0. Pre-Implementation

- [ ] Read user story and acceptance criteria thoroughly
- [ ] Read PRD `prds/s10-webcam-recording-prd.md`
- [ ] **CRITICAL: Validate technology choices in PRD**:
  - [ ] Confirm WebRTC `getUserMedia()` API works in Electron renderer for camera access
  - [ ] Confirm `MediaRecorder` API supports recording to Blob in Electron
  - [ ] Test FFmpeg can encode WebM/MP4 Blobs to H.264+AAC MP4
  - [ ] Verify 30fps preview is achievable without frame drops
  - [ ] Document chosen approach: WebRTC in renderer + FFmpeg in main process
- [ ] Clarify any ambiguities before starting
- [ ] Identify test gates from PRD (AC-1 through AC-12)

---

## 1. Service/Command Layer (Electron IPC)

Implement deterministic backend handlers in Electron main process invoked by React frontend via IPC.

### 1.1 IPC Handler: `encode-webcam-recording`

- [ ] Create `src/main/ipc-handlers/webcam.ts`
- [ ] Implement `encode-webcam-recording` handler:
  - **Input**: `{ recordedBlob: Buffer, outputPath: string, mimeType: string, videoDimensions: { width: number, height: number } }`
  - **Output**: `{ filePath: string, duration: number, width: number, height: number, thumbnailPath?: string }`
  - **Logic**:
    1. Write Blob buffer to temp input file (`.webm` or `.mp4`)
    2. Construct FFmpeg command: `-i input -c:v libx264 -preset medium -crf 23 -r 30 -c:a aac -b:a 128k output.mp4`
    3. Execute FFmpeg via `child_process.spawn()`
    4. Extract first frame as thumbnail JPEG: `ffmpeg -i input -ss 0 -vframes 1 thumbnail.jpg`
    5. Probe output file for duration/dimensions using `ffprobe`
    6. Return result object
  - **Error handling**: Invalid blob, disk full, FFmpeg crash (return error object)
- [ ] Test: Valid WebRTC Blob → successful MP4 encoding
- [ ] Test: Invalid blob → error returned gracefully
- [ ] Test: Disk full → cleanup partial files, return error

### 1.2 IPC Handler: `check-camera-permission` (optional informational)

- [ ] Implement `check-camera-permission` handler:
  - **Output**: `boolean`
  - **Logic**: Return `true` (permission check happens in renderer via WebRTC)
  - **Note**: This is informational only; actual permission via browser dialog

### 1.3 IPC Handler: `check-microphone-permission` (optional informational)

- [ ] Implement `check-microphone-permission` handler:
  - **Output**: `boolean`
  - **Logic**: Return `true` (permission check happens in renderer via WebRTC)

### 1.4 Register Handlers

- [ ] Export `registerWebcamHandlers(ipcMain)` from `src/main/ipc-handlers/webcam.ts`
- [ ] Call `registerWebcamHandlers(ipcMain)` in `src/main/main.ts` on app startup
- [ ] Test: IPC handlers registered and callable from renderer

---

## 2. React Components & State

Create/modify React components per user story.

### 2.1 Component: `WebcamRecordingModal.tsx`

- [ ] Create `src/components/WebcamRecordingModal.tsx`
- [ ] **Props**: `{ isOpen: boolean; onClose: () => void; onRecordingComplete: (filePath: string) => void; }`
- [ ] **State**:
  ```typescript
  interface RecordingSession {
    status: 'idle' | 'preview' | 'recording' | 'saving' | 'error';
    mediaStream?: MediaStream;
    mediaRecorder?: MediaRecorder;
    recordedChunks: Blob[];
    startTime: number;
    elapsedSeconds: number;
    errorMessage?: string;
    selectedCameraId?: string;
  }
  ```
- [ ] **Lifecycle**:
  - **On open**: Request camera + microphone via `navigator.mediaDevices.getUserMedia({ video: true, audio: true })`
  - **On permission granted**: Set `status: 'preview'`, attach stream to `<video>` element
  - **On permission denied**: Set `status: 'error'`, show retry option
  - **On Start button**: Initialize `MediaRecorder`, set `status: 'recording'`, start timer
  - **On Stop button**: Stop `MediaRecorder`, set `status: 'saving'`, encode recording
  - **On encoding complete**: Call `onRecordingComplete(filePath)`, set `status: 'idle'`, close modal
- [ ] **Render**:
  - Video element (`<video autoPlay muted ref={videoRef} />`) for live preview
  - Start/Stop button (changes based on `status`)
  - Timer display (MM:SS format)
  - Error message (if `status: 'error'`)
  - "Saving..." spinner (if `status: 'saving'`)
- [ ] **MediaRecorder Setup**:
  - Use `new MediaRecorder(mediaStream, { mimeType: 'video/webm;codecs=vp8,opus' })` (or browser-supported format)
  - Collect chunks via `mediaRecorder.ondataavailable = (e) => { chunks.push(e.data) }`
  - On stop: Combine chunks into single Blob
- [ ] **Encoding Call**:
  - Convert Blob to Buffer: `const buffer = await blob.arrayBuffer()`
  - Call IPC: `const result = await ipcRenderer.invoke('encode-webcam-recording', { recordedBlob: buffer, outputPath: tempPath, mimeType, videoDimensions })`
  - Handle result: Call `onRecordingComplete(result.filePath)` or show error
- [ ] Test: Modal opens, preview shows camera feed
- [ ] Test: Start → timer runs → Stop → encoding → modal closes
- [ ] Test: Permission denied → error message → retry → success
- [ ] Test: Camera already in use → error shown

### 2.2 Component: `WebcamRecordButton.tsx`

- [ ] Create `src/components/WebcamRecordButton.tsx`
- [ ] **Props**: `{ onClick: () => void; disabled?: boolean }`
- [ ] **Render**: Button with red camera icon + "Record Webcam" label
- [ ] Test: Button renders, click triggers modal open

### 2.3 Multi-Camera Support (Optional - REQ-6)

- [ ] In `WebcamRecordingModal.tsx`:
  - On mount: Call `navigator.mediaDevices.enumerateDevices()` to list cameras
  - Filter devices: `devices.filter(d => d.kind === 'videoinput')`
  - If multiple cameras: Show dropdown selector
  - On camera select: Re-request `getUserMedia` with `{ deviceId: { exact: selectedId } }`
- [ ] Test: Multiple cameras → dropdown shows → selection changes preview
- [ ] Test: Single camera → no dropdown shown

### 2.4 Timer Implementation

- [ ] Implement timer using `setInterval()`:
  ```typescript
  useEffect(() => {
    if (status === 'recording') {
      const interval = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [status, startTime]);
  ```
- [ ] Format as MM:SS: `const minutes = Math.floor(elapsed / 60); const seconds = elapsed % 60;`
- [ ] Test: Timer starts at 00:00, increments correctly during recording

### 2.5 Audio Level Meter (Optional - REQ-2.2)

- [ ] If implementing: Use Web Audio API `AnalyserNode` to get microphone levels
- [ ] Display as visual bar or waveform
- [ ] Test: Meter responds to microphone input in real-time

---

## 3. Data Model & Persistence

### 3.1 TypeScript Interfaces

- [ ] Define `RecordingSession` interface (already defined in 2.1)
- [ ] Define `CameraDevice` interface:
  ```typescript
  interface CameraDevice {
    deviceId: string;
    label: string;
    kind: 'videoinput';
  }
  ```
- [ ] Define `EncodedRecording` interface (return type from IPC):
  ```typescript
  interface EncodedRecording {
    filePath: string;
    duration: number;
    width: number;
    height: number;
    thumbnailPath?: string;
  }
  ```

### 3.2 Session Persistence

- [ ] Recorded clips auto-added to Library (handled in 4.2)
- [ ] No additional persistence needed (RecordingSession is transient)
- [ ] ⚠️ **UPDATED**: Recording files persist in `app.getPath('userData')/recordings/Webcam_*.mp4` (NOT temp!)
- [ ] Cleanup strategy: Delete recordings >7 days old on startup; temp input files (`*-input.*`) after 1 hour

---

## 4. Integration

### 4.1 Wire Components → IPC

- [ ] In `WebcamRecordingModal.tsx`:
  - Import `ipcRenderer` from Electron
  - Call `ipcRenderer.invoke('encode-webcam-recording', params)` after recording stops
  - Handle result: Call `onRecordingComplete(filePath)` or show error
- [ ] Test: Recording → encoding → result returned → modal closes

### 4.2 Auto-Import to Library

- [ ] Modify `src/components/Library.tsx`:
  - Add handler for `onRecordingComplete(filePath)`:
    1. Extract metadata from file (duration, dimensions) using `ffprobe` or IPC
    2. Generate clip name: `Webcam_YYYYMMDD_HHMMSS`
    3. Create `Clip` object
    4. Add to Library state
    5. Generate thumbnail (already done by encoding IPC)
    6. Display in Library panel
- [ ] Test: Recording completes → clip appears in Library immediately
- [ ] Test: Clip thumbnail shows first frame, duration correct

### 4.3 Add Button to Toolbar

- [ ] Modify `src/components/MainLayout.tsx` (or Toolbar component):
  - Import `WebcamRecordButton`
  - Add button next to "Import" and "Record Screen" buttons
  - Wire button click to open `WebcamRecordingModal`
- [ ] Test: Button visible in toolbar, click opens modal

### 4.4 FFmpeg Integration

- [ ] Ensure FFmpeg binary available (via `ffmpeg-static` package)
- [ ] Construct encoding command in `encode-webcam-recording` handler:
  ```bash
  ffmpeg -i input.webm \
    -c:v libx264 -preset medium -crf 23 -r 30 \
    -c:a aac -b:a 128k \
    output.mp4
  ```
- [ ] Extract thumbnail:
  ```bash
  ffmpeg -i input.webm -ss 0 -vframes 1 thumbnail.jpg
  ```
- [ ] Test: Command executes, MP4 file valid, thumbnail generated

### 4.5 Handle App Close During Recording

- [ ] In main process (`src/main/main.ts`):
  - Listen for `before-quit` event
  - If recording active (check via IPC or global state flag):
    - Show dialog: "Recording in progress. Save or discard?"
    - If "Save": Complete encoding, save file, then quit
    - If "Discard": Delete temp file, quit immediately
- [ ] Test: Close app during recording → prompt shown → "Save" completes recording
- [ ] Test: Close app during recording → "Discard" deletes temp file

---

## 5. Manual Testing

**Reference testing gates from PRD Section 9 (Testing & Acceptance Gates):**

### Happy Path Tests

- [x] **Test 1: Record 10-second video with audio** (PRD Test 1)
  - Click "Record Webcam" → Grant permission → Live preview shows → Start → Record 10 sec → Stop
  - Verify: "Saving..." spinner → Modal closes → Clip in Library with name "Webcam_YYYYMMDD_HHMMSS"
  - Verify: Thumbnail shows recorded content, duration ~10 sec, audio synced (<100ms drift)

- [x] **Test 2: Multi-camera recording** (PRD Test 2, if multiple cameras available)
  - Click "Record Webcam" → Select second camera from dropdown → Preview changes → Record 5 sec
  - Verify: Recording uses selected camera (visually distinct)

- [x] **Test 3: Multiple back-to-back recordings** (PRD Test 3)
  - Record video #1 (5 sec) → appears in Library
  - Record video #2 (5 sec) → appears in Library
  - Verify: Both clips exist, distinct filenames, both playable

### Edge Case Tests

- [ ] **Test 4: Permission denied, then granted** (PRD Test 4)
  - Click "Record Webcam" → Deny camera permission
  - Verify: Error message shown: "Camera permission required..."
  - Click "Retry" → Grant permission → Preview shown → Record 5 sec → Success

- [ ] **Test 5: Camera in use by another app** (PRD Test 5)
  - Open Facetime or second video app → Click "Record Webcam"
  - Verify: Error message: "Camera already in use. Close other apps and try again."
  - Close Facetime → Retry → Success

- [ ] **Test 6: Very short recording (1 second)** (PRD Test 6)
  - Start → Stop immediately (1 sec elapsed)
  - Verify: Encoding completes, clip imports, duration ~1 sec

- [ ] **Test 7: Long recording (5 minutes)** (PRD Test 7)
  - Record for 5 minutes continuously
  - Verify: File size ~250MB (reasonable for 5min 1080p)
  - Verify: Playback smooth, audio/video synced throughout
  - Verify: Memory stable during encoding (no leaks)

- [ ] **Test 8: Microphone denied, camera granted** (PRD Test 8)
  - Grant camera, Deny microphone
  - Verify: Modal shows option "Record camera only (no audio)?"
  - Click "Yes" → Record 5 sec
  - Verify: Clip imports, plays as video-only (no audio track)

- [x] **Test 9: App closed during recording** (PRD Test 9)
  - Start recording → record 3 sec → Close app window
  - Verify: Prompt appears: "Recording in progress. Save or discard?"
  - Click "Save" → Recording completes, file saved, clip appears on relaunch

- [ ] **Test 10: App closed during encoding** (PRD Test 10)
  - Record 5 sec → Click Stop → encoding starts → Immediately close app
  - Verify: Partial file cleaned up on startup, no corrupt clips in Library

### Error Handling Tests

- [ ] **Test 11: No camera connected** (PRD Test 11)
  - Disconnect all cameras → Click "Record Webcam"
  - Verify: Error: "No camera found. Connect a webcam and try again."

- [ ] **Test 12: Corrupted recorded data** (PRD Test 12, mock scenario)
  - Mock invalid Blob passed to IPC
  - Verify: Encoding fails gracefully with error message, no crash, user can retry

- [ ] **Test 13: Disk full during encoding** (PRD Test 13)
  - Fill disk to capacity → Record → Encode
  - Verify: Error: "Disk full. Clean up and try again."
  - Verify: Partial file cleaned up, no orphaned temp files

### Performance Tests

- [x] **Test 14: Live preview responsiveness** (PRD Test 14)
  - Open modal with live preview
  - Verify: Preview runs at 30fps+ (no stutter/lag)

- [ ] **Test 15: Audio/video sync** (PRD Test 15)
  - Record video of clock/timer in frame + background music
  - Export clip
  - Verify: Audio sync within 100ms (audio not noticeably ahead/behind video)

- [ ] **Test 16: Memory stability during long recording** (PRD Test 16)
  - Record for 5 minutes → Monitor memory usage
  - Verify: Memory growth <100MB during recording; stable during encoding

### Manual Testing Checklist (from PRD)

- [x] Permission grants (first-time flow)
- [ ] Permission denials and recovery
- [x] Live preview smooth (30fps+)
- [x] Start/stop buttons responsive
- [x] Timer accurate (elapsed time matches wall clock)
- [x] Recorded file appears in Library with correct metadata
- [x] Recorded clip plays in preview player
- [x] Audio synced with video (no drift)
- [x] Multi-camera selection works (if available)
- [x] Encoding completes without crashes
- [ ] File size reasonable (~50MB/min for 1080p)
- [ ] Edge cases: short recording, long recording, mic denied, camera denied, camera in use
- [ ] Graceful close during recording/encoding
- [ ] No orphaned temp files left after crash

### Cross-Platform Testing

- [ ] Test on macOS (primary platform)
- [ ] Test on Windows (best-effort)
- [ ] Verify camera/mic permission dialogs appear correctly on both platforms
- [ ] Verify FFmpeg encoding works on both platforms

---

## 6. Performance

- [ ] Verify targets from PRD (Section 1: Preflight #5):
  - Preview 30fps minimum (live video)
  - Recording at native resolution (1080p typical)
  - Audio/video sync drift <100ms
  - File size ~50MB per minute at 1080p H.264
- [ ] Test: Live preview frame rate (use DevTools Performance profiler)
- [ ] Test: Audio sync (play back recording, verify <100ms drift)
- [ ] Test: Memory usage during 5min recording (<1GB total app memory)

---

## 7. Definition of Done

- [ ] All acceptance criteria from user story (AC-1 through AC-12) pass
- [ ] All test gates from PRD Section 9 pass (happy path, edge cases, errors, performance)
- [ ] Code has comments for complex WebRTC logic
- [ ] No console warnings or errors during recording/encoding
- [ ] Cross-platform tested: macOS + Windows

### Definition of Done Checklist (from PRD Section 10)

- [ ] `WebcamRecordingModal.tsx` implemented with full state management
- [ ] `WebcamRecordButton.tsx` added to toolbar
- [ ] IPC handlers (`encode-webcam-recording`, `check-camera-permission`, `check-microphone-permission`) implemented in `src/main/ipc-handlers/webcam.ts`
- [ ] FFmpeg encoding command working (H.264 + AAC output)
- [ ] Auto-import to Library functional (recorded clip appears immediately)
- [ ] All happy path tests pass (Test 1-3)
- [ ] All edge case tests pass (Test 4-10)
- [ ] All error handling tests pass (Test 11-13)
- [ ] Performance targets met: Preview 30fps+, audio sync <100ms, memory stable
- [ ] Cross-platform tested: macOS + Windows (camera/mic access)
- [ ] No crashes, no orphaned temp files
- [ ] Code reviewed and merged to `feat/webcam-recording` branch
- [ ] Acceptance gates verified before merging

---

## 8. PR & Merge

⚠️ **CRITICAL**: DO NOT COMMIT UNTIL USER CONFIRMS ALL TEST GATES PASS

- [ ] Create branch `feat/webcam-recording` from `develop`
- [ ] User confirms all test gates pass ← WAIT FOR THIS
- [ ] User says "ready to commit" or "looks good"
- [ ] THEN: Commit changes with message:
  ```
  feat(recording): add webcam recording with live preview

  - Implement WebRTC camera + microphone capture
  - Add WebcamRecordingModal component with live preview
  - Add FFmpeg encoding to H.264+AAC MP4
  - Auto-import recorded clips to Library
  - Handle permission denials and camera-in-use errors
  - Support multi-camera selection
  - Add "Record Webcam" button to toolbar

  Refs: USER_STORIES.md S10, prds/s10-webcam-recording-prd.md
  ```
- [ ] THEN: Create PR to `develop` with:
  - **Title**: `feat(recording): S10 - Webcam Recording`
  - **Description**:
    - Link to user story: USER_STORIES.md S10
    - Link to PRD: prds/s10-webcam-recording-prd.md
    - Summary of changes (components, IPC handlers, FFmpeg integration)
    - Manual test results (all tests passed)
    - Screenshots/video of recording flow (optional)
- [ ] Code reviewed
- [ ] Merge to `develop`

---

## Notes

- **WebRTC in Renderer**: Camera access via `getUserMedia()` runs in Renderer process; encoding via FFmpeg runs in Main process
- **FFmpeg Binary**: Ensure `ffmpeg-static` package installed and binary path accessible
- **⚠️ RECORDING STORAGE (CHANGED from PRD)**:
  - **Path**: `app.getPath('userData')/recordings/` (NOT temp!)
  - **Why**: Using `userData` instead of `temp` to prevent OS auto-cleanup and ensure files persist in packaged apps (npm run make)
  - **Cross-platform paths**:
    - macOS: `~/Library/Application Support/Klippy/recordings/`
    - Windows: `%APPDATA%/Klippy/recordings/`
    - Linux: `~/.config/Klippy/recordings/`
  - **Cleanup**: Only temp input files (`*-input.webm`) deleted after 1 hour; final MP4s persist until 7-day cleanup or manual delete
  - **Packaged app**: Works identically in dev and production builds
- **Audio Sync**: WebRTC MediaRecorder handles sync natively; verify <100ms drift in playback
- **Permission Flow**: Browser permission dialog blocks until user grants/denies; show "Requesting permission..." spinner
- **Cross-Platform**: WebRTC APIs work on macOS + Windows; test both platforms before merge
- **Blockers**: Document immediately if FFmpeg encoding fails or WebRTC API unavailable in Electron
- **Dependencies**: None (can build in parallel with other features). Depends only on MVP (existing Library, session state).

---

**Status**: Ready for Implementation
**Next Step**: Start with Section 1 (IPC Handlers), then Section 2 (React Components), then integrate and test
