# PRD: Webcam Recording

**Feature**: S10: Webcam Recording | **Status**: Ready | **Story**: https://github.com/finessevanes/klippy (USER_STORIES.md)

---

## Preflight Answers

1. **Smallest end-to-end outcome?** User clicks "Record Webcam" → grants permission → records for N seconds → file appears in Library → plays back correctly in preview.
2. **Primary user + critical action?** Content creator (vlogger, testimonial recorder) records themselves talking; needs reliable camera + audio capture with minimal setup.
3. **Must-have vs nice-to-have?**
   - MUST: Camera permission dialog, live preview, start/stop, save MP4, auto-add to Library
   - NICE: Camera selection (if multiple cameras available), pause/resume, custom naming
4. **Offline/persistence needs?** No—recordings saved to temp file immediately upon stop, then imported to Library. No network dependency.
5. **Performance targets?**
   - Preview 30fps minimum (live video)
   - Recording at native resolution (1080p typical for webcams)
   - Sync: Audio/video drift <100ms
   - File size: ~50MB per minute at 1080p H.264
6. **Error/edge cases critical to handle?**
   - Camera already in use by another app → clear error message
   - Permission denied (user clicks "Don't Allow") → offer retry dialog
   - No camera connected → error message with recovery
   - App closed during recording → save partial file gracefully
   - Microphone permission denied → allow screen-only (warn user)
7. **Data model changes?**
   - New `RecordingSession` interface to track active recording state
   - Clips imported from recording follow existing `Clip` interface
   - No schema changes to session.json
8. **Service/command APIs needed?**
   - `start-webcam-recording` — begin recording to temp file
   - `stop-webcam-recording` — halt recording, return temp file path
   - `get-available-cameras` — list attached camera devices
   - `check-permissions` — verify camera/mic permissions before recording
9. **React components to create/modify?**
   - NEW: `RecordingModal.tsx` — Recording UI (preview, start/stop buttons, timer)
   - NEW: `RecordWebcamButton.tsx` — Toolbar button to trigger recording
   - MODIFY: `Library.tsx` — Auto-add recorded file to library
10. **Desktop-specific needs?**
    - Electron `desktopCapturer` API has limitations for camera (no native camera access).
    - Use WebRTC `getUserMedia` API for camera (available in Electron Renderer).
    - Electron IPC only needed for permission checks and file I/O.
    - Handle app close during recording (prompt to save or discard).
11. **What's explicitly out of scope?**
    - Pause/resume during recording (only start/stop in MVP)
    - Scheduled/delayed recording
    - Green screen / background blur effects
    - Custom video encoding settings (H.264 fixed preset)
    - Multi-camera simultaneous recording
    - Screen + webcam combo (that's S11: Picture-in-Picture)

---

## 1. Summary

Webcam Recording enables users to record themselves talking or demonstrating (face-on-camera content) with synchronized audio, creating short video clips that automatically import into the Library. This eliminates external camera recording tools and unifies the recording workflow within Klippy.

**Key Outcome**: User records 1-5min talking-head video → MP4 file → appears in Library → can be arranged on timeline alongside screen recordings and imported clips.

---

## 2. Non-Goals / Scope Boundaries

**Out of Scope (Post-MVP)**:
- ❌ Pause/resume during recording (only stop)
- ❌ Green screen / background blur effects
- ❌ Screen + webcam simultaneous recording (see S11: PiP Recording)
- ❌ Custom resolution/bitrate encoding (fixed H.264 preset)
- ❌ Multiple camera simultaneous recording
- ❌ Scheduled or time-delayed recording

**Why Excluded**: Simplifies MVP implementation; pause/resume adds state complexity. Effects and multi-camera require advanced FFmpeg/WebRTC handling. S11 (PiP) handles screen+webcam properly.

---

## 3. Experience (UX)

### Entry Points
1. **Toolbar Button**: "Record Webcam" button in main toolbar (next to "Import" and "Record Screen" buttons).
2. **Keyboard Shortcut** (optional, Phase 7): Cmd/Ctrl+Shift+W to toggle recording.

### Happy Path Flow

```
User clicks "Record Webcam"
  ↓
[Permission Check]
  - If first time: Browser permission dialog ("Klippy wants to access camera & microphone")
  - User grants → proceed
  - User denies → Error dialog "Camera permission required. Check System Preferences."
  ↓
[Recording Modal Opens]
  - Live preview of camera feed (30fps)
  - Recording timer: 00:00
  - Start button (red, prominent)
  - Cancel button (gray)
  ↓
[User clicks "Start"]
  - Timer begins: 00:01, 00:02, ...
  - Button changes to "Stop" (red)
  - Preview continues
  ↓
[Recording Active]
  - User talks/demonstrates for N seconds
  - Audio captured from microphone
  - Timer shows elapsed time
  ↓
[User clicks "Stop"]
  - Recording halts
  - File encoded to MP4 (H.264 + AAC)
  - Modal closes
  ↓
[Auto-Import to Library]
  - Recording appears in Library with generated name: "Webcam_YYYYMMDD_HHMMSS"
  - Thumbnail shows first frame (user's face)
  - Duration shows (e.g., "1:23")
  - Ready to drag to timeline
```

### States

| State | Appearance | Actions | Notes |
|-------|-----------|---------|-------|
| **Idle** | "Record Webcam" button in toolbar | Click to start | Modal hidden |
| **Permission Checking** | Modal appears, spinner + "Requesting permission..." | None (wait) | Blocking user action |
| **Preview Ready** | Live video feed visible, "Start" button enabled | Click "Start" or "Cancel" | No audio capture yet |
| **Recording** | Live feed, "Stop" button (red), timer running | Click "Stop" only | Audio + video captured |
| **Saving** | Spinner + "Saving recording..." | None (wait) | Encoding to MP4 |
| **Success** | Modal closes, new clip in Library | Use in timeline | Auto-named, playable |
| **Error** | Error dialog (camera not found, permission denied, etc.) | "Retry" or "Cancel" | User recovery options |

### Desktop Considerations

**Window Resize**: Recording modal stays visible and responsive during window resize. Preview video scales with modal.

**Multi-Monitor**: Recording captures from default camera (primary monitor). No multi-monitor-specific behavior.

**App Close During Recording**:
- If user closes app while recording, prompt: "Recording in progress. Discard or save?"
- Discard: Delete temp file, close app.
- Save: Complete recording, import, save session, then close.

---

## 4. Functional Requirements

### MUST (Core Features)

**REQ-1: Camera Permission & Detection**
- **REQ-1.1**: On first launch of Recording Modal, request camera permission via browser `getUserMedia()` API.
- **REQ-1.2**: If permission granted, display live preview of camera feed at 30fps minimum.
- **REQ-1.3**: If permission denied, show error dialog: "Camera permission required. Go to System Preferences → Security & Privacy → Camera → check Klippy."
- **REQ-1.4**: If no camera detected, show error: "No camera found. Connect a webcam and try again."
- **REQ-1.5**: Detect camera failures (camera in use by another app) and show message: "Camera already in use. Close other apps and try again."

**REQ-2: Live Preview & Recording Session**
- **REQ-2.1**: Live preview shows camera feed in modal window at 30fps+ (no lag).
- **REQ-2.2**: Audio level meter displays microphone input levels (optional visual feedback).
- **REQ-2.3**: Start button initiates MediaRecorder capture of camera + microphone streams.
- **REQ-2.4**: Stop button halts recording and begins encoding.
- **REQ-2.5**: Recording timer shows elapsed time (MM:SS format) while active.

**REQ-3: Audio & Video Sync**
- **REQ-3.1**: Microphone audio captured on same stream as camera video (native WebRTC stream).
- **REQ-3.2**: Audio/video sync verified in playback (drift <100ms).
- **REQ-3.3**: If microphone permission denied, show option: "Record camera only (no audio)?" → User chooses.

**REQ-4: File Encoding & Saving**
- **REQ-4.1**: After stop, encode recording to MP4 using FFmpeg on main process.
- **REQ-4.2**: Encoding preset: H.264 + AAC (same as imported videos for consistency).
- **REQ-4.3**: Resolution: Match camera native resolution (typically 720p or 1080p).
- **REQ-4.4**: Frame rate: 30fps (or match native).
- **REQ-4.5**: ⚠️ **UPDATED**: Save to recordings directory: `app.getPath('userData')/recordings/Webcam_YYYYMMDD_HHMMSS.mp4`
  - **Reason**: Using `userData` instead of `temp` for persistence across app launches and packaged builds (npm run make)
  - **Cross-platform**: macOS (`~/Library/Application Support/Klippy/recordings/`), Windows (`%APPDATA%/Klippy/recordings/`), Linux (`~/.config/Klippy/recordings/`)
- **REQ-4.6**: Show "Saving..." spinner during encoding (blocking modal).

**REQ-5: Auto-Add to Library**
- **REQ-5.1**: After save completes, automatically import recording to Library.
- **REQ-5.2**: Generate clip name: `Webcam_YYYYMMDD_HHMMSS` (e.g., "Webcam_20251029_143022").
- **REQ-5.3**: Extract thumbnail (first frame of video).
- **REQ-5.4**: Extract duration from encoded file.
- **REQ-5.5**: Add to Library state and display in Library panel.
- **REQ-5.6**: Temp file persists (not auto-deleted) so it can be re-imported if needed.

**REQ-6: Multi-Camera Support (Optional)**
- **REQ-6.1**: If multiple cameras available, show dropdown before recording: "Select Camera".
- **REQ-6.2**: Default to primary camera (first in list).
- **REQ-6.3**: User can switch camera before starting recording.

### SHOULD (Nice-to-Have)

**REQ-7: Recording Analytics (Optional)**
- **REQ-7.1**: Show file size estimate as timer runs (e.g., "~5MB recorded").
- **REQ-7.2**: Show estimated disk space remaining (warn if <100MB).

**REQ-8: Keyboard Control (Optional, Phase 7)**
- **REQ-8.1**: Spacebar to toggle start/stop (if modal focused).
- **REQ-8.2**: ESC to cancel recording.

### Acceptance Gates

| Scenario | Input | Expected Output | Pass Criteria |
|----------|-------|-----------------|---------------|
| **Happy Path 1: Record & Import** | Click "Record Webcam" → Grant permission → Click "Start" → Record 10 sec → Click "Stop" | Recorded video appears in Library with correct duration | No errors, file plays, duration matches |
| **Happy Path 2: Multi-Camera** | Click "Record Webcam" → Select second camera from dropdown → Record 5 sec | Recording uses selected camera (visually distinct if available) | Correct camera recorded, playable |
| **Edge Case 1: No Permission** | Click "Record Webcam" → Deny permission → Click "Retry" → Grant permission | Recording proceeds after permission granted | Retry flow works cleanly |
| **Edge Case 2: Camera In Use** | Open second app using camera → Click "Record Webcam" | Error message: "Camera already in use" with "Retry" option | Clear error, user can retry |
| **Edge Case 3: Short Recording** | Record for 1 second only | Recording saves, imports, plays correctly | No encoding errors, valid MP4 |
| **Edge Case 4: Long Recording** | Record for 5 minutes | Encoding completes without crashes, file size reasonable (~50MB) | Memory stable, playable, sync maintained |
| **Error Case 1: Mic Denied** | Grant camera, deny microphone permission | "Record camera only?" option → User can proceed | Audio-only warning shown, video-only recording works |
| **Error Case 2: App Closed During Recording** | Start recording → Close app window → Select "Save" | Recording completes, saved, appears in Library on relaunch | Graceful save, no corruption |
| **Error Case 3: Disk Full** | Recording nearing disk capacity → Hit limit mid-encoding | Error: "Disk full. Clean up and try again." + Cancel button | Partial file cleaned up, no crash |

---

## 5. Data Model

### New Interfaces

```typescript
// Recording session state (transient, not persisted)
interface RecordingSession {
  status: 'idle' | 'preview' | 'recording' | 'saving' | 'error';
  mediaStream?: MediaStream;        // Live camera + audio stream
  mediaRecorder?: MediaRecorder;    // WebRTC recording object
  recordedChunks: Blob[];           // Raw recording chunks
  startTime: number;                // Timestamp when recording started (ms)
  elapsedSeconds: number;           // Computed elapsed time
  errorMessage?: string;            // Error description if failed
  selectedCameraId?: string;        // Camera device ID (if multi-camera)
}

// Camera device info
interface CameraDevice {
  deviceId: string;
  label: string;  // e.g., "Facetime HD Camera" or "USB Camera"
  kind: 'videoinput';
}

// Returned to IPC handler after encoding
interface EncodedRecording {
  filePath: string;                 // Full path to saved MP4
  duration: number;                 // Duration in seconds
  width: number;
  height: number;
  thumbnailPath?: string;           // Path to thumbnail image (first frame)
}
```

### Data Flow: Persistent Storage

**During Recording** (transient state in React, not saved):
- RecordingSession state held in React context or component state.
- NO persistence to disk during recording.

**After Stop**:
1. ⚠️ **UPDATED**: Encoded file saved to `app.getPath('userData')/recordings/Webcam_YYYYMMDD_HHMMSS.mp4` (using userData for packaged app compatibility).
2. Clip object created and added to Library state.
3. Clip included in session.json on app close (via existing MVP persistence logic).
4. Recording file persists until 7-day cleanup (or user manual delete).

**Session Restore**:
- On app relaunch, session.json restores all clips including recorded ones.
- File path must remain valid (temp files persist across reboots).

### Constraints

- **Recording file path**: Must be valid, accessible, not moved/deleted during import.
- **Audio codecs**: AAC only (for MP4 compatibility).
- **Video codec**: H.264 only (cross-platform, no HEVC).
- **Max resolution**: 1080p (upscaling not supported; native camera resolution used).
- **Frame rate**: 30fps fixed (or match native if camera supports 60fps).

---

## 6. Service/Command APIs

All IPC handlers run on Electron main process (Node.js). Renderer calls via `ipcRenderer.invoke()`.

### IPC Handler: `get-available-cameras`

**Purpose**: List all connected camera devices.

**Pre-condition**: App running, user opened Recording Modal.

**Call Signature**:
```typescript
const cameras = await ipcRenderer.invoke('get-available-cameras');
// Returns: CameraDevice[]
```

**Returns**:
```typescript
[
  { deviceId: 'default', label: 'FaceTime HD Camera', kind: 'videoinput' },
  { deviceId: 'usb-camera-123', label: 'Logitech USB Webcam', kind: 'videoinput' }
]
```

**Error Handling**:
- If no cameras: return empty array `[]`. Renderer shows "No camera found" error.
- If permission denied: return empty array.

**Notes**: Renderer uses WebRTC `enumerateDevices()` API, not Electron. This is informational only; actual stream selection happens in Renderer via getUserMedia().

---

### IPC Handler: `encode-webcam-recording`

**Purpose**: Encode WebRTC recorded chunks (Blob) to MP4 file using FFmpeg.

**Pre-condition**: Recording stopped, chunks collected.

**Call Signature**:
```typescript
const result = await ipcRenderer.invoke('encode-webcam-recording', {
  recordedBlob: Blob,              // Raw WebRTC recording data
  outputPath: string,              // Full path to save MP4
  mimeType: string,                // e.g., 'video/webm' or 'video/mp4'
  videoDimensions: { width, height }  // Camera resolution
});
// Returns: EncodedRecording
```

**Returns**:
```typescript
{
  filePath: '/tmp/klippy-webcam-20251029-143022.mp4',
  duration: 23.5,  // seconds
  width: 1280,
  height: 720,
  thumbnailPath: '/tmp/klippy-webcam-20251029-143022-thumb.jpg'
}
```

**FFmpeg Logic**:
1. Input: Recorded Blob (WebRTC output, usually WebM or MP4 depending on browser).
2. Transcode: H.264 + AAC (for cross-platform compatibility).
3. Output: MP4 file.
4. Thumbnail: Extract first frame as JPEG.

**Example FFmpeg Command**:
```bash
ffmpeg -i input.webm \
  -c:v libx264 -preset medium -crf 23 -r 30 \
  -c:a aac -b:a 128k \
  output.mp4

ffmpeg -i input.webm -ss 0 -vframes 1 thumbnail.jpg
```

**Post-condition**: MP4 file written to disk, thumbnail generated.

**Error Handling**:
- Blob invalid: Return error `{ error: 'Invalid recording data' }`.
- Disk full: Return error `{ error: 'Disk full' }`.
- FFmpeg crash: Return error `{ error: 'Encoding failed: [FFmpeg stderr]' }`.

**Notes**: FFmpeg runs asynchronously. Renderer should show "Saving..." spinner until completion.

---

### IPC Handler: `check-camera-permission`

**Purpose**: Verify camera access is allowed (macOS/Windows permission check).

**Pre-condition**: App running.

**Call Signature**:
```typescript
const granted = await ipcRenderer.invoke('check-camera-permission');
// Returns: boolean
```

**Returns**:
- `true`: Camera permission granted.
- `false`: Permission denied or unknown.

**Notes**: This is informational. Actual permission grant happens via browser dialog (WebRTC `getUserMedia`). Main process can't request permission directly; only Renderer can via WebRTC API.

**Usage**: Renderer checks this before opening modal. If false, show "Enable camera in System Preferences first" message (optional pre-check).

---

### IPC Handler: `check-microphone-permission`

**Purpose**: Verify microphone access is allowed.

**Pre-condition**: App running.

**Call Signature**:
```typescript
const granted = await ipcRenderer.invoke('check-microphone-permission');
// Returns: boolean
```

**Returns**:
- `true`: Microphone permission granted.
- `false`: Permission denied or unknown.

---

## 7. Components to Create/Modify

### New Components

**`src/components/WebcamRecordingModal.tsx`**
- Purpose: Modal dialog for recording UI (preview, start/stop, timer).
- Props: `{ isOpen: boolean; onClose: () => void; onRecordingComplete: (filePath: string) => void; }`
- State: RecordingSession (permission, preview, recording, saving, error).
- Render:
  - Video element for live preview.
  - Start/Stop buttons.
  - Timer (MM:SS).
  - Camera selector (if multiple cameras).
  - Error messages.
  - Saving spinner.
- Responsibilities:
  - Request camera/mic permission via `navigator.mediaDevices.getUserMedia()`.
  - Manage MediaRecorder lifecycle.
  - Collect recorded chunks.
  - Call `encode-webcam-recording` IPC on stop.
  - Call `onRecordingComplete(filePath)` when encoding done.

**`src/components/WebcamRecordButton.tsx`**
- Purpose: Toolbar button to open recording modal.
- Props: None (or `{ disabled: boolean }`).
- Render: Button with red recording icon + "Record Webcam" label.
- Responsibilities: Toggle modal open/close.

**`src/main/ipc-handlers/webcam.ts`**
- Purpose: Electron IPC handlers for camera/webcam operations.
- Exports:
  - `registerWebcamHandlers(ipcMain)` — Register all handlers.
  - Handler implementations:
    - `encode-webcam-recording`: Transcode Blob to MP4.
    - `check-camera-permission`: Verify camera access.
    - `check-microphone-permission`: Verify mic access.

### Modified Components

**`src/components/Library.tsx`**
- ADD: Handle auto-import of recorded files.
- When `onRecordingComplete(filePath)` called:
  1. Extract metadata (duration, dimensions).
  2. Create Clip object.
  3. Add to Library state.
  4. Display in Library panel.

**`src/components/MainLayout.tsx`** (or Toolbar)
- ADD: WebcamRecordButton alongside existing "Import" and "Record Screen" buttons.

**`src/main/main.ts`** (Electron main process)
- ADD: Call `registerWebcamHandlers(ipcMain)` on app startup.

---

## 8. Integration Points

### Browser APIs (Renderer Process)
- **`navigator.mediaDevices.getUserMedia()`**: Request camera + microphone access.
- **`navigator.mediaDevices.enumerateDevices()`**: List attached cameras (optional, for multi-camera support).
- **`MediaRecorder` API**: Capture WebRTC stream to Blob.
- **`MediaStream` API**: Manage live camera/audio stream.

### Electron APIs (Main Process)
- **`ipcMain.handle()`**: Register IPC handlers.
- **`fs` module**: Write encoded file to disk, cleanup temp files.
- **`path` module**: Construct file paths.
- **`child_process.spawn()`**: Execute FFmpeg for encoding.

### FFmpeg Integration
- **Input**: WebRTC recorded Blob (WebM or MP4 depending on browser).
- **Processing**: Transcode to H.264 + AAC.
- **Output**: MP4 file + JPEG thumbnail.
- **Command**: See REQ-4 (FFmpeg Encoding).

### State Management
- **React Context** or **Zustand**: Manage RecordingSession state (non-persistent).
- **Existing Library state**: Add recorded clips to Library (persistent via session.json).

### File I/O
- **⚠️ UPDATED - Recording storage**: `app.getPath('userData')/recordings/` (changed from temp for packaged app stability)
- **Temp input files**: Intermediate encoding files (`*-input.webm`) cleaned up after 1 hour
- **Session persistence**: Clips stored in session.json (existing MVP feature).

---

## 9. Testing & Acceptance Gates

### Happy Path Tests

**Test 1: Record 10-second video with audio**
1. Click "Record Webcam" button.
2. Grant camera + microphone permission.
3. Verify live preview shows camera feed.
4. Click "Start" button.
5. Record for 10 seconds (talk/move).
6. Click "Stop" button.
7. **GATE**: "Saving..." spinner appears and completes.
8. Modal closes.
9. **GATE**: New clip appears in Library with name "Webcam_YYYYMMDD_HHMMSS".
10. **GATE**: Thumbnail shows recorded content (user's face or movement).
11. Click clip in Library → plays in preview player.
12. **GATE**: Video plays correctly, duration shows ~10 seconds, audio synced (no drift >100ms).

**Test 2: Multi-camera recording (if available)**
1. Click "Record Webcam" → select second camera from dropdown.
2. Verify preview changes to selected camera.
3. Record 5 seconds.
4. **GATE**: Recording uses selected camera (visually distinct if multiple cameras available).

**Test 3: Multiple back-to-back recordings**
1. Record video #1 (5 seconds) → appears in Library.
2. Record video #2 (5 seconds) → appears in Library.
3. **GATE**: Both clips exist, distinct filenames, both playable.

### Edge Case Tests

**Test 4: Permission denied, then granted**
1. Click "Record Webcam" → Deny camera permission.
2. **GATE**: Error message shown: "Camera permission required..."
3. Click "Retry" → Grant permission.
4. **GATE**: Modal proceeds to preview.
5. Record 5 seconds.
6. **GATE**: Completes successfully.

**Test 5: Camera in use by another app**
1. Open Facetime or second video app (uses camera).
2. Click "Record Webcam" → Try to record.
3. **GATE**: Error message: "Camera already in use. Close other apps and try again."
4. Close Facetime, retry.
5. **GATE**: Recording succeeds.

**Test 6: Very short recording (1 second)**
1. Click "Record Webcam" → Start → Stop immediately (1 sec elapsed).
2. **GATE**: Encoding completes, clip imports successfully, duration shows ~1 second.

**Test 7: Long recording (5 minutes)**
1. Record for 5 minutes continuously.
2. **GATE**: File size ~250MB (reasonable for 5min 1080p).
3. **GATE**: Playback smooth, audio/video synced throughout.
4. **GATE**: Memory stable during encoding (no leaks).

**Test 8: Microphone denied, camera granted**
1. Grant camera, Deny microphone.
2. **GATE**: Modal shows option "Record camera only (no audio)?"
3. User clicks "Yes".
4. Record 5 seconds.
5. **GATE**: Clip imports, plays as video-only (no audio track).

**Test 9: App closed during recording**
1. Start recording → record 3 seconds.
2. Close app window (cmd+W or close button).
3. **GATE**: Prompt appears: "Recording in progress. Save or discard?"
4. Click "Save".
5. **GATE**: Recording completes, file saved, clip appears on relaunch.

**Test 10: App closed during encoding (after stop)**
1. Record 5 seconds → click Stop → encoding starts.
2. Immediately close app (before encoding finishes).
3. **GATE**: Partial file cleaned up on startup, no corrupt clips in Library.

### Error Handling Tests

**Test 11: No camera connected**
1. Disconnect all cameras.
2. Click "Record Webcam".
3. **GATE**: Error: "No camera found. Connect a webcam and try again."

**Test 12: Corrupted recorded data**
1. Mock invalid Blob passed to IPC.
2. **GATE**: Encoding fails gracefully with error message.
3. **GATE**: No crash, user can retry.

**Test 13: Disk full during encoding**
1. Fill disk to capacity during encoding.
2. **GATE**: Error: "Disk full. Clean up and try again."
3. **GATE**: Partial file cleaned up, no orphaned temp files.

### Performance Tests

**Test 14: Live preview responsiveness**
1. Open modal with live preview.
2. **GATE**: Preview runs at 30fps+ (no stutter/lag).

**Test 15: Audio/video sync**
1. Record video of clock/timer in frame + background music.
2. Export clip.
3. **GATE**: Audio sync within 100ms (audio not noticeably ahead/behind video).

**Test 16: Memory stability during long recording**
1. Record for 5 minutes.
2. Monitor memory usage.
3. **GATE**: Memory growth <100MB during recording; stable during encoding.

### Manual Testing Checklist

- [ ] Permission grants (first-time flow).
- [ ] Permission denials and recovery.
- [ ] Live preview smooth (30fps+).
- [ ] Start/stop buttons responsive.
- [ ] Timer accurate (elapsed time matches wall clock).
- [ ] Recorded file appears in Library with correct metadata.
- [ ] Recorded clip plays in preview player.
- [ ] Audio synced with video (no drift).
- [ ] Multi-camera selection works (if available).
- [ ] Encoding completes without crashes.
- [ ] File size reasonable (~50MB/min for 1080p).
- [ ] Edge cases: short recording, long recording, mic denied, camera denied, camera in use.
- [ ] Graceful close during recording/encoding.
- [ ] No orphaned temp files left after crash.

---

## 10. Definition of Done

- [ ] `WebcamRecordingModal.tsx` implemented with full state management.
- [ ] `WebcamRecordButton.tsx` added to toolbar.
- [ ] IPC handlers (`encode-webcam-recording`, `check-camera-permission`, `check-microphone-permission`) implemented in `src/main/ipc-handlers/webcam.ts`.
- [ ] FFmpeg encoding command working (H.264 + AAC output).
- [ ] Auto-import to Library functional (recorded clip appears immediately).
- [ ] All happy path tests pass (test 1-3).
- [ ] All edge case tests pass (test 4-10).
- [ ] All error handling tests pass (test 11-13).
- [ ] Performance targets met: Preview 30fps+, audio sync <100ms, memory stable.
- [ ] Cross-platform tested: macOS + Windows (camera/mic access).
- [ ] No crashes, no orphaned temp files.
- [ ] Code reviewed and merged to `feat/s10-webcam-recording` branch.
- [ ] Acceptance gates verified before merging.

---

## 11. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| **WebRTC Permission Grant Timing** | User expects instant preview, but browser permission dialog delays flow | Show "Requesting permission..." spinner; explain in UI that browser will ask. |
| **Audio/Video Sync Drift** | Recorded video plays with audio delayed >100ms, poor quality | Use native WebRTC MediaRecorder (handles sync internally). Test with frame-by-frame analysis. |
| **FFmpeg Encoding Failures** | Crash mid-encoding, corrupt output file | Test FFmpeg with various input mimeTypes (WebM, MP4). Handle stderr parsing for errors. Cleanup partial files. |
| **Camera Already In Use** | User can't record if second app (Facetime, Zoom) using camera | Show clear error message + recovery (close other app, retry). |
| **Permission Denial (User Clicks "Don't Allow")** | Recording blocked permanently; unclear recovery | Show recovery steps: "Go to System Preferences → Security & Privacy → Camera → Enable Klippy". Offer "Retry" button. |
| **Memory Leak During Long Recording** | App memory grows unbounded; crash on 5min+ recordings | Monitor MediaStream cleanup, MediaRecorder cleanup. Test with 10min recording. Profile with Chrome DevTools. |
| **Large File Encoding** | Encoding 5min video takes >30 seconds, UI freezes | Encode on main process (Node.js) asynchronously, send progress updates via IPC. Show "Saving..." spinner with estimated time. |
| **Recording File Persistence** | ⚠️ **MITIGATED**: Recordings folder fills with orphaned files after crashes | Using `userData/recordings/` (not temp) for stability. Cleanup: on app startup, delete recordings >7 days old. Temp input files (`*-input.*`) cleaned after 1 hour. |
| **Multi-Camera Selection Edge Case** | Only one camera available; dropdown shows single option | Hide dropdown if <2 cameras available. Default to primary camera. |
| **Windows Camera Access** | Camera permission model different on Windows (WASAPI, dxvk) | Test on Windows 10+. Use WebRTC API (cross-platform). File encoding same as macOS. |

---

## 12. Open Questions

1. **Pause/Resume in Future?** Current PRD omits pause; future sprint can add if needed. Requires state machine complexity.
2. **Custom Output Location?** Current PRD auto-saves to temp + imports. Future: allow user to specify save location.
3. **Rename Recording Before Import?** Current: auto-named. Future: show rename dialog after stop, before import.
4. **Encoding Quality Settings?** Current: fixed H.264 medium preset. Future: allow bitrate/quality selection in export settings (see S14).

---

## Summary for Caleb (Implementation)

**Start Here**:
1. Create `RecordingModal.tsx` with WebRTC getUserMedia() + MediaRecorder.
2. Implement IPC handlers for encoding (call FFmpeg).
3. Auto-add encoded clip to Library.
4. Add "Record Webcam" button to toolbar.

**Test Coverage**:
- Happy path: Record → encode → import → play.
- Edge cases: Permission denied, camera in use, mic denied.
- Performance: Preview 30fps+, audio sync <100ms.
- Cross-platform: Mac + Windows.

**Acceptance Gates** (Before Merge):
- All tests pass (happy, edge, error, performance).
- File appears in Library with metadata.
- Audio/video plays correctly.
- No crashes or memory leaks.

**Dependency**: None (can build in parallel with other features). Depends only on MVP (existing Library, session state).

---

**Document Status**: Ready for Implementation
**Next Step**: Caleb creates TODO (todos/s10-webcam-recording-todo.md) and implements.

**Version**: 1.0
**Date**: October 29, 2025
