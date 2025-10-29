# S9: Screen Recording - Product Requirements Document

**Document Version**: 1.0
**Date**: October 28, 2025
**Feature**: Screen Recording
**Story Number**: S9
**Status**: Ready for Implementation
**Complexity**: Complex
**Priority**: ✅ REQUIRED (Phase 5)

---

## Executive Summary

Screen recording allows content creators and educators to record their screen activity with synchronized audio capture, enabling tutorial creation, presentation recording, and screen-based content production entirely within Klippy. Users can select which screen/window to record, configure microphone input, and seamlessly integrate recorded videos into their editing workflow.

**User Value Proposition**: Eliminates need for external screen recording tools; enables one-app workflow for tutorial creation.

---

## Preflight Questionnaire

### Scope & Integration Questions

1. **Screen Selection Strategy**: Should screen recording support:
   - Single screen only (simplest)?
   - Multiple monitors with selection dialog?
   - Window-specific recording (not just screens)?
   - **Decision**: Multiple screens + window selection via Electron's `desktopCapturer` API. Window selection is a stretch goal.

2. **Audio Sync & Quality**:
   - Required: Microphone audio synchronized with screen video
   - Frame rate: 30fps or 60fps?
   - **Decision**: 30fps (matches MVP export default). 60fps is stretch goal.

3. **Recording Duration Constraints**:
   - User story mentions "30-second recording" as acceptance criterion. Is this a hard limit or example?
   - **Decision**: No hard limit. 30-second is example/test case. Support recordings up to 2GB file size (OS/FFmpeg limit).

4. **File Handling**:
   - Temp file location strategy?
   - **Decision**: Save to `app.getPath('temp')/klippy-recordings/` directory.

5. **Microphone Permissions**:
   - macOS requires `NSMicrophoneUsageDescription` in Info.plist. Windows?
   - **Decision**: Implement platform-specific permission handling. Show permission dialogs; allow screen-only fallback if permission denied.

6. **Video Codec & Container**:
   - Use H.264/MP4 (matches MVP) or WebRTC codec?
   - **Decision**: Internally record with WebRTC codec (for fast encoding), convert to H.264 MP4 after stop (using FFmpeg) for compatibility.

7. **UI/UX Integration**:
   - Where does "Record Screen" button appear?
   - **Decision**: Toolbar in main application (same level as Export button). Modal dialog for screen/window selection.

8. **Error Handling**:
   - What if user unplugs microphone mid-recording?
   - What if screen is unplugged?
   - **Decision**: Screen disconnection = stop recording with message. Mic disconnect = continue with video-only fallback.

9. **Webcam Conflicts**:
   - Can user record both screen + webcam simultaneously (for S11: PiP)?
   - **Decision**: Screen recording is video-only initially. PiP (S11) handles simultaneous screen + webcam.

10. **Platform-Specific Challenges**:
    - Windows screen recording (different API from macOS)?
    - **Decision**: Use Electron's `desktopCapturer` + native audio capture. Test on Windows (best-effort).

11. **Recording Preview**:
    - Should user see real-time preview before/during recording?
    - **Decision**: Pre-recording dialog shows selected screen/window preview (static). No real-time recording preview (scope reduction).

---

## Summary

**Feature**: Record screen activity with synchronized microphone audio in Klippy.

**Core Use Case**: Content creator opens Klippy → clicks "Record Screen" → selects which screen/window → starts recording → performs on-screen task (10-30 sec) → stops recording → video appears in Library and ready to edit.

**Key Differentiators**:
- One-app workflow (no external screen recording software)
- Automatic Library integration (recorded file immediately available for editing)
- Microphone sync (audio captured with video)
- Multi-monitor support (select specific screen)

---

## Scope Definition

### In Scope ✅

- [ ] "Record Screen" button in main toolbar
- [ ] Dialog displays list of available screens (using `desktopCapturer`)
- [ ] User selects specific screen to record
- [ ] Recording indicator (red dot + timer) shows during active recording
- [ ] Microphone permission request before recording starts
- [ ] Audio and video remain synchronized during recording
- [ ] Stop button halts recording and saves file to temp location
- [ ] Recorded video automatically added to Library with playable thumbnail
- [ ] User can rename recording in Library before adding to timeline
- [ ] Cross-platform support (macOS primary, Windows best-effort)
- [ ] Graceful handling of window closure during recording
- [ ] Error dialog shown if microphone permission denied; screen-only recording allowed

### Out of Scope (Post-MVP) ❌

- Real-time recording preview (video preview during recording)
- Window-specific recording (only full screens initially)
- 60fps recording (30fps fixed)
- System audio capture (only microphone initially; system audio is stretch goal)
- Pausing mid-recording (start/stop only)
- Custom output resolution selection (match screen resolution)

---

## Functional Requirements

### REQ-1: Record Screen Button & Toolbar Integration

**REQ-1.1**: Main toolbar displays "Record Screen" button (red circle icon with label)
**REQ-1.2**: Button is enabled when app is focused (not grayed out)
**REQ-1.3**: Button click opens "Select Screen/Window" dialog
**REQ-1.4**: Button is disabled during active recording (prevent multiple simultaneous recordings)

**Testing Gate**:
- [ ] Happy Path: Click "Record Screen" button → dialog appears
- [ ] Edge Case: Click button while dialog open → no duplicate dialogs
- [ ] Error Handling: Button enabled/disabled correctly based on app state

---

### REQ-2: Screen Selection Dialog

**REQ-2.1**: Dialog uses Electron's `desktopCapturer.getSources({types: ['screen']})` API
**REQ-2.2**: Dialog displays list of available screens:
  - Screen name (e.g., "Display 1", "Display 2", "Built-in Retina Display")
  - Screen resolution (e.g., "2560x1600")
  - Thumbnail preview (static image of screen)
**REQ-2.3**: User selects one screen via radio button or click
**REQ-2.4**: Default selection: primary screen (index 0)
**REQ-2.5**: Cancel button closes dialog without starting recording
**REQ-2.6**: Start Recording button initiates capture using selected screen

**Data Model** (in dialog state):
```typescript
interface ScreenInfo {
  id: string;              // desktopCapturer source ID
  name: string;            // "Display 1", "Built-in Retina", etc.
  resolution: string;      // "2560x1600"
  thumbnail: string;       // Base64 data URL of thumbnail
  selected: boolean;       // User selection
}

interface ScreenSelectionState {
  screens: ScreenInfo[];
  selectedScreenId: string;
  loading: boolean;
  error?: string;
}
```

**Testing Gate**:
- [ ] Happy Path 1: Dialog shows 2+ screens → user selects one → thumbnail visible
- [ ] Happy Path 2: User clicks Start Recording → recording begins with selected screen
- [ ] Edge Case: Single screen system → dialog shows one screen, auto-selected
- [ ] Error Handling: desktopCapturer fails → dialog shows error "Unable to access screens"

---

### REQ-3: Recording Indicator UI

**REQ-3.1**: When recording active, display indicator overlay:
  - Red dot (animated pulse) in top-left corner of preview panel
  - Timer showing elapsed time (HH:MM:SS format)
  - Stop button (red icon) in toolbar
**REQ-3.2**: Indicator updates every 100ms (timer accuracy)
**REQ-3.3**: Red dot pulses at 1Hz frequency (visual attention)
**REQ-3.4**: Recording state prevents Library/Timeline interaction (locked during recording)

**Testing Gate**:
- [ ] Happy Path: Start recording → indicator appears with pulsing red dot + timer
- [ ] Edge Case: Wait 30 seconds → timer displays "00:00:30" correctly
- [ ] Error Handling: Stop button always clickable during recording

---

### REQ-4: Microphone Permission & Audio Capture

**REQ-4.1**: Before starting recording, request microphone permission using Web Audio API (`navigator.mediaDevices.getUserMedia()`)
**REQ-4.2**: On macOS, add `NSMicrophoneUsageDescription` to Info.plist (provided by Electron preload)
**REQ-4.3**: If permission granted: capture microphone audio stream
**REQ-4.4**: If permission denied:
  - Show dialog: "Microphone access denied. Record screen without audio?"
  - Offer "Continue (Audio Off)" and "Cancel" buttons
  - If user chooses continue: record video-only (no audio)
  - If user chooses cancel: abort recording, return to screen selection dialog
**REQ-4.5**: Display audio level meter during recording (visual feedback that mic is active)

**Audio Sync Requirements**:
**REQ-4.6**: Microphone audio synchronized with screen video (A/V sync tolerance: <100ms drift)
**REQ-4.7**: Audio volume level not exceed -3dB peak (prevent digital clipping)

**Data Model** (recording state):
```typescript
interface RecordingSession {
  screenSourceId: string;      // desktopCapturer source ID
  audioStream?: MediaStream;   // Microphone audio stream
  recordingState: 'idle' | 'requesting-permission' | 'recording' | 'stopping';
  startTime: number;           // Timestamp when recording started
  elapsedSeconds: number;      // Updated by timer
  audioEnabled: boolean;       // true if mic permission granted
  audioLevel: number;          // 0-100 (for level meter)
}
```

**Testing Gate**:
- [ ] Happy Path 1: Grant microphone permission → recording includes audio
- [ ] Happy Path 2: Deny permission → dialog shows option to record without audio
- [ ] Edge Case: Microphone plugged out mid-recording → continue with video-only
- [ ] Error Handling: Audio level meter correctly shows mic activity

---

### REQ-5: Recording Process & File Capture

**REQ-5.1**: Recording uses Electron's `desktopCapturer` + Web Audio API in main process
**REQ-5.2**: Video captured at 30fps, screen resolution (no upscaling/downscaling initially)
**REQ-5.3**: Audio captured at 48kHz sample rate, mono (mono sufficient for mic input)
**REQ-5.4**: Both streams (video + audio) captured to temporary file in intermediate format
**REQ-5.5**: On stop, automatically convert intermediate format to H.264 MP4 using FFmpeg
**REQ-5.6**: Temp files cleaned up after successful conversion

**Technical Implementation** (Electron main process):
```typescript
interface RecordingEngine {
  startRecording(screenSourceId: string, audioStream?: MediaStream): Promise<void>;
  stopRecording(): Promise<string>;  // Returns path to temp MP4 file
  cancelRecording(): Promise<void>;   // Cleanup without saving
}
```

**File Paths**:
- Intermediate format: `app.getPath('temp')/klippy-recordings/{sessionId}.webm` (WebRTC)
- Final MP4: `app.getPath('temp')/klippy-recordings/{sessionId}-final.mp4`
- Cleanup: Delete .webm after FFmpeg conversion completes

**Testing Gate**:
- [ ] Happy Path: Record 10 seconds → stop → file appears in temp directory
- [ ] Edge Case: Record screen change (monitor unplugged) → gracefully handle
- [ ] Error Handling: Disk full during recording → show error dialog

---

### REQ-6: Post-Recording Library Integration

**REQ-6.1**: After FFmpeg conversion completes, automatically add MP4 to Library
**REQ-6.2**: Library entry displays:
  - Thumbnail (first frame of recording)
  - Filename: "Screen Recording - YYYY-MM-DD HH:MM:SS" (auto-generated)
  - Duration (calculated from MP4 metadata)
**REQ-6.3**: User can rename recording in Library before adding to timeline
**REQ-6.4**: Recorded video playable in preview player (same as imported clips)
**REQ-6.5**: Recorded videos treat as regular Library clips (no special handling)

**Data Model** (Library entry):
```typescript
interface LibraryClip {
  id: string;                   // UUID
  filePath: string;             // Path to MP4 in temp directory
  filename: string;             // Display name
  duration: number;             // In seconds
  thumbnail: string;            // Data URL or image buffer
  isRecording: boolean;         // true for newly recorded clips
  recordedAt?: number;          // Timestamp of recording
  source: 'import' | 'recording'; // Track origin
}
```

**Testing Gate**:
- [ ] Happy Path: Record video → appears in Library with correct duration
- [ ] Edge Case: Record multiple videos → all appear in Library
- [ ] Error Handling: Rename dialog allows custom name; duplicate names allowed

---

### REQ-7: Stop & Error Handling

**REQ-7.1**: Stop button halts recording immediately
**REQ-7.2**: Display "Processing..." spinner during FFmpeg conversion (UX feedback)
**REQ-7.3**: On conversion complete: dismiss spinner, show success message "Recording saved to Library"
**REQ-7.4**: On conversion error: show dialog with FFmpeg error details + "Try Again" / "Cancel" buttons

**Error Scenarios**:
- [ ] **Missing FFmpeg**: Show error "FFmpeg not available. Recording feature unavailable."
- [ ] **Disk Space**: "Insufficient disk space to save recording" → suggest cleanup
- [ ] **Permission Issues**: "Unable to write to temp directory" → suggest permissions
- [ ] **Audio Sync Fail**: "Recording failed: audio/video not synchronized" → suggest retry

**Testing Gate**:
- [ ] Happy Path: Stop button responsive (<100ms)
- [ ] Edge Case: Stop immediately after starting (<1 second) → produces valid MP4
- [ ] Error Handling: All error scenarios show clear dialog messages

---

### REQ-8: Cross-Platform Support

**macOS Support** (Primary):
- [ ] **API**: Use `desktopCapturer` (works on macOS)
- [ ] **Permissions**: Handle `NSMicrophoneUsageDescription` in Info.plist
- [ ] **Testing**: Record on macOS with 1-2 monitors

**Windows Support** (Best-Effort):
- [ ] **API**: `desktopCapturer` works on Windows 10+
- [ ] **Permissions**: Windows permission dialogs (handled by Electron)
- [ ] **Testing**: Record on Windows (best-effort; may have audio sync issues)

**Known Limitations**:
- [ ] Linux: Out of scope (desktopCapturer limited on Linux)
- [ ] 4K screens: Supported but may impact performance (no optimization)

**Testing Gate**:
- [ ] Happy Path Mac: Record on macOS → save to Library → export works
- [ ] Happy Path Windows: Record on Windows (if available) → basic functionality
- [ ] Edge Case: macOS + Windows path separators handled correctly

---

### REQ-9: Window Closure & Graceful Shutdown

**REQ-9.1**: If app window closed during recording → save recording to temp file (don't lose data)
**REQ-9.2**: On app relaunch, recovery dialog: "Incomplete recording detected. Add to Library?"
**REQ-9.3**: User selects Yes → complete FFmpeg conversion → add to Library
**REQ-9.4**: User selects No → delete temp recording file
**REQ-9.5**: If app crashes → next launch offers recovery (same as above)

**Testing Gate**:
- [ ] Happy Path: Kill app during recording → restart → recovery dialog appears
- [ ] Edge Case: Delete temp file manually → recovery dialog handles missing file gracefully
- [ ] Error Handling: Corrupted temp file → don't crash on recovery attempt

---

## Acceptance Gates (Definition of Done)

### Functional Gates
- [ ] Screen selection dialog displays 1+ screens
- [ ] Recording starts/stops correctly
- [ ] Recorded video plays back in Library with correct duration
- [ ] Audio synchronized with video (<100ms drift)
- [ ] Microphone permission handled correctly (allow/deny flows)
- [ ] Screen-only recording allowed if mic permission denied
- [ ] Cross-platform tested (Mac + Windows basic validation)

### Performance Gates
- [ ] Recording at native screen resolution without frame drops (30fps)
- [ ] A/V sync verified frame-accurate (no audible sync drift)
- [ ] FFmpeg conversion completes within 30 seconds (10-second recording)
- [ ] Memory stable during 2+ hour recording session (if OS permits)
- [ ] Stop button responsive (<100ms)

### Edge Case Gates
- [ ] Record <1 second → valid MP4 output
- [ ] Record 30+ minutes → completes without crash
- [ ] Screen unplugged mid-recording → graceful error message
- [ ] Microphone unplugged mid-recording → continue with video-only
- [ ] App window closed during recording → recovery on restart

### Error Handling Gates
- [ ] FFmpeg error → user-friendly message (not technical jargon)
- [ ] Permission denied → clear option to continue without audio
- [ ] Disk full → helpful error with recovery suggestions
- [ ] All error paths tested (no missing error handler crashes)

### Quality Gates
- [ ] No memory leaks after 10+ record/stop cycles
- [ ] No crashes on any edge case
- [ ] UI responsive during recording (not frozen)
- [ ] Playback audio quality acceptable (no distortion)

---

## Data Model & Persistence

### Recording Session State (Temporary)
```typescript
interface RecordingSession {
  sessionId: string;                    // UUID for this recording session
  screenSourceId: string;               // desktopCapturer source ID
  audioStream?: MediaStream;            // Mic audio (if permitted)
  recordingState: 'idle' | 'requesting-permission' | 'recording' | 'stopping' | 'converting';
  startTime: number;                    // Date.now() when started
  elapsedSeconds: number;               // Updated by timer
  audioEnabled: boolean;                // true if permission granted
  audioLevel: number;                   // 0-100 range (for meter)
  tempWebmPath?: string;                // Intermediate .webm file
  finalMp4Path?: string;                // Final H.264 MP4 file
  error?: string;                       // Error message if failed
}
```

### Library Clip (Extends existing MVP clip model)
```typescript
interface LibraryClip {
  id: string;
  filePath: string;
  filename: string;
  duration: number;
  thumbnail: string;      // Data URL
  source: 'import' | 'recording';    // NEW: track if recorded in-app
  recordedAt?: number;    // NEW: timestamp when recorded
  isRecording?: boolean;  // NEW: temporarily true while converting
}
```

### Session Storage (Persisted)
**File**: `app.getPath('userData')/session.json`

No new persistence needed for S9. Recording sessions are ephemeral (don't persist across app restarts). Recovery handled in main process temp file logic.

---

## IPC APIs (Electron Main ↔ Renderer)

### Preload Bridge Exposed Methods

```typescript
// Preload script exposes these to Renderer:

// Get available screens for recording
window.electronAPI.getScreens(): Promise<ScreenInfo[]>

// Start screen recording session
window.electronAPI.startScreenRecording(
  screenSourceId: string,
  audioEnabled?: boolean
): Promise<{ success: true }>

// Stop screen recording and save file
window.electronAPI.stopScreenRecording(): Promise<{
  filePath: string;      // Path to final MP4
  duration: number;      // Duration in seconds
  success: true;
}>

// Cancel recording (cleanup without saving)
window.electronAPI.cancelScreenRecording(): Promise<{ success: true }>

// Get audio level during recording (for meter)
window.electronAPI.getAudioLevel(): Promise<number>  // 0-100

// Request microphone permission
window.electronAPI.requestMicrophonePermission(): Promise<{
  granted: boolean;
}>
```

### IPC Event Messages (Main → Renderer)

```typescript
// Recording progress updates:
ipcRenderer.on('recording:elapsed-time', (event, seconds: number) => {})

// Recording state changes:
ipcRenderer.on('recording:state-changed', (event, state: 'recording' | 'stopping' | 'idle') => {})

// Audio level updates (for meter):
ipcRenderer.on('recording:audio-level', (event, level: 0-100) => {})

// Error during recording:
ipcRenderer.on('recording:error', (event, message: string) => {})

// Recording complete:
ipcRenderer.on('recording:complete', (event, { filePath: string, duration: number }) => {})
```

---

## Components to Create/Modify

### New Components

1. **`src/components/RecordScreenButton.tsx`** (Toolbar Button)
   - Red circle icon + "Record Screen" label
   - Click opens RecordScreenDialog
   - Disabled during recording

2. **`src/components/RecordScreenDialog.tsx`** (Screen Selection Dialog)
   - Displays list of available screens
   - Radio button selection
   - Shows screen preview thumbnail
   - "Start Recording" and "Cancel" buttons

3. **`src/components/RecordingIndicator.tsx`** (Overlay UI)
   - Red pulsing dot in top-left corner
   - Timer display (HH:MM:SS)
   - Stop button (red icon)
   - Disabled other UI during recording

4. **`src/components/AudioLevelMeter.tsx`** (Optional - for visual feedback)
   - Horizontal bar showing 0-100% audio level
   - Displayed in recording indicator area

5. **`src/components/RecordingPermissionDialog.tsx`** (Permission Flow)
   - "Microphone access required" message
   - "Allow" / "Deny" / "Continue Without Audio" options

### Modified Components

1. **`src/components/Toolbar.tsx`**
   - Add RecordScreenButton to toolbar layout
   - Manage button enabled/disabled state based on recording status

2. **`src/components/Library.tsx`**
   - Display newly recorded clips same as imported clips
   - Add "source" badge (optional) to distinguish "Recording" from "Imported"

3. **`src/App.tsx` (Main App State)**
   - Add `recordingState: RecordingSession` to app state
   - Add `isRecording: boolean` flag for UI locking
   - Pass state/handlers to components

### Main Process Services

1. **`src/main/services/screenRecordingService.ts`** (Core Logic)
   - `getAvailableScreens()`: Call desktopCapturer, return screen list
   - `startRecording(screenId, audioStream)`: Initiate capture
   - `stopRecording()`: Save to temp file, run FFmpeg conversion
   - `cancelRecording()`: Cleanup without saving
   - `getAudioLevel()`: Return current mic level (0-100)
   - `requestMicrophonePermission()`: Request user permission

2. **`src/main/services/ffmpegService.ts`** (Already exists - extend)
   - Add `convertWebmToMp4(inputPath, outputPath)`: Convert intermediate .webm → MP4
   - Reuse existing FFmpeg bundling logic

3. **`src/main/ipc-handlers/recordingHandlers.ts`** (IPC Bridge)
   - Register all IPC listeners (getScreens, startRecording, stopRecording, etc.)
   - Handle Preload ↔ Main process communication
   - Error handling + response routing

### Electron Main Process Handlers

1. **App Preload** (`src/main/preload.ts`)
   - Expose `window.electronAPI.getScreens()` etc.
   - Add security context isolation
   - Validate renderer messages

2. **Window Management** (Extend `src/main/main.ts`)
   - Add permission request dialog handling
   - Handle recovery flow if recording incomplete at shutdown

---

## Testing & Acceptance Criteria

### Unit Tests

- [ ] `screenRecordingService.getAvailableScreens()` returns array of screens
- [ ] `startRecording()` initializes capture streams correctly
- [ ] `stopRecording()` saves to temp file
- [ ] `convertWebmToMp4()` produces valid MP4 (verify with ffprobe)
- [ ] Audio level calculation (0-100 range) works correctly

### Integration Tests

1. **Screen Recording Happy Path**
   - [ ] Launch app → click "Record Screen" → select screen → start recording
   - [ ] Record 10 seconds → stop → file appears in temp directory
   - [ ] FFmpeg conversion completes → Library updated with new clip
   - [ ] Play recorded clip in preview → audio/video synchronized

2. **Permission Flows**
   - [ ] Microphone permission granted → recording includes audio
   - [ ] Microphone permission denied → show dialog → allow continue without audio
   - [ ] Continue without audio → recording is video-only

3. **Edge Cases**
   - [ ] Record <1 second → produces valid MP4
   - [ ] Record 30+ seconds → FFmpeg handles without timeout
   - [ ] Stop immediately after start → no crash
   - [ ] Cancel recording → temp files cleaned up
   - [ ] App closed during recording → recovery on restart

4. **Cross-Platform**
   - [ ] macOS: Record → verify audio sync on export
   - [ ] Windows: Record → basic validation (best-effort)

### Manual Testing Checklist

- [ ] **T1 - Screen List**: Click "Record Screen" → dialog shows 1+ screens with thumbnails
- [ ] **T2 - Recording Indicator**: Start recording → red dot pulses + timer increments every second
- [ ] **T3 - Stop Recording**: Click Stop button → recording halts within 500ms
- [ ] **T4 - Library Integration**: Recorded video appears in Library with duration metadata
- [ ] **T5 - Playback**: Click recorded clip in Library → plays in preview with audio
- [ ] **T6 - Permission Allow**: Grant mic permission → recording includes audio
- [ ] **T7 - Permission Deny**: Deny mic permission → "Continue without audio?" → select Continue → video-only recording
- [ ] **T8 - Rename Recording**: Right-click recorded clip → rename → name updates
- [ ] **T9 - Add to Timeline**: Drag recorded clip to timeline → appears as regular clip
- [ ] **T10 - Export Recorded**: Record + add to timeline → export → output MP4 contains recorded video
- [ ] **T11 - Recovery**: Kill app during recording → restart → recovery dialog appears
- [ ] **T12 - Performance**: Record 2+ minutes → no memory leaks → UI responsive
- [ ] **T13 - Windows Basic**: (If available) Record on Windows → basic validation passes
- [ ] **T14 - Error Handling**: Unplug microphone mid-recording → continue with video-only (or appropriate error)

### Performance Targets

- **Recording Start**: <2 second delay from button click to recording begins
- **Recording Stop**: <500ms from stop click to file saved
- **FFmpeg Conversion**: 10-second recording → <30 seconds to convert (H.264 H/W acceleration beneficial)
- **Memory**: Baseline ~250MB + recording session <100MB additional
- **Frame Rate**: 30fps captured; no dropped frames during recording
- **Audio Sync**: Drift <100ms (imperceptible to users)

---

## Definition of Done

**Code Complete**:
- [ ] All components implemented (RecordScreenButton, RecordScreenDialog, RecordingIndicator, etc.)
- [ ] All IPC handlers registered and tested
- [ ] FFmpeg conversion pipeline functional
- [ ] Preload script exposes all required methods
- [ ] Error handling complete (no unhandled exceptions)

**Testing Complete**:
- [ ] All manual test cases (T1-T14) pass
- [ ] All acceptance gates pass (functional, performance, edge cases, error handling)
- [ ] No crashes on any tested scenario
- [ ] Cross-platform tested (Mac + Windows)

**Integration Complete**:
- [ ] Recorded videos add to Library correctly
- [ ] Recorded videos play in preview player
- [ ] Recorded videos draggable to timeline
- [ ] Recorded videos export correctly (A/V sync verified)

**Quality Assurance**:
- [ ] No memory leaks (15-minute session with 10+ recordings)
- [ ] Audio quality acceptable (no distortion, clear dialog)
- [ ] UI/UX matches Klippy design system
- [ ] Error messages user-friendly (no technical jargon)

**Code Review**:
- [ ] PR created to `develop` branch
- [ ] Code reviewed by team lead
- [ ] Approved for merge to `develop`

---

## Risk Mitigation

### Risk 1: Audio/Video Sync Drift
**Likelihood**: Medium | **Impact**: High
**Mitigation**: Implement precise timestamp-based sync in FFmpeg conversion. Test sync on multiple hardware configurations. Monitor sync drift in integration tests.

### Risk 2: FFmpeg Conversion Timeout
**Likelihood**: Low | **Impact**: Medium
**Mitigation**: Set generous timeout (60 seconds). Show "Processing..." spinner. Implement retry logic for failed conversions.

### Risk 3: Memory Leak in Recording Session
**Likelihood**: Medium | **Impact**: Medium
**Mitigation**: Properly cleanup media streams on stop. Test 15-minute multi-recording session. Monitor memory via Activity Monitor.

### Risk 4: Platform-Specific Issues (Windows)
**Likelihood**: High | **Impact**: Low (best-effort scope)
**Mitigation**: Test on Windows VM. Document known limitations. Provide fallback behavior if APIs unavailable.

### Risk 5: Microphone Permission Dialog Timing
**Likelihood**: Low | **Impact**: Medium
**Mitigation**: Handle permission request asynchronously. Test all permission flow branches (allow, deny, cancel).

---

## Future Enhancements (Post-S9)

1. **System Audio Capture** (S15 prerequisite)
   - Capture computer speaker output in addition to microphone
   - Mix audio sources in final export

2. **60fps Recording** (Performance dependent)
   - Increase frame rate for higher-quality recordings
   - May require H/W acceleration

3. **Real-Time Preview**
   - Show recording preview before/during capture
   - Useful for visual feedback

4. **Window-Specific Recording**
   - Record specific app window (not full screen)
   - Useful for focused tutorials

5. **Custom Resolution**
   - Allow users to downscale recording for smaller file size
   - Useful for lower-bandwidth sharing

---

## Success Metrics

**Launch Criteria**:
- ✅ All 14 manual test cases pass
- ✅ All acceptance gates pass (functional, performance, edge cases)
- ✅ No crashes on tested scenarios
- ✅ A/V sync verified (<100ms drift)
- ✅ Cross-platform validated (Mac + Windows)

**Post-Launch**:
- User feedback on recording quality and ease of use
- Performance benchmarks documented (conversion times, memory usage)
- Bug backlog prioritized for v1.1 (if any bugs discovered)

---

## Notes for Caleb (Implementation Agent)

1. **Start with screen selection**: Implement `getAvailableScreens()` first. Validate desktopCapturer API works on your dev machine.

2. **Audio is critical**: A/V sync is a major acceptance gate. Test audio sync early and often. Consider using FFmpeg's `-async` filter if drift detected.

3. **FFmpeg conversion workflow**: Capture to intermediate .webm (fast), convert to MP4 (slower but necessary for compatibility). This two-stage approach balances speed + quality.

4. **Permission handling**: macOS requires Info.plist modification (done by Electron). Test permission flows on actual hardware.

5. **Error messages**: Every error path must show a user-friendly dialog. No console errors visible to user.

6. **Testing priority**: Focus on happy path first, then permission flows, then edge cases. A/V sync testing is highest priority for quality gate.

7. **Performance**: Monitor FFmpeg conversion times. If >30 seconds, consider H/W acceleration or lower default bitrate.

---

## Document Status

**Status**: Ready for Caleb Implementation
**Approvals**: Product (Pam) ✅
**Next Steps**: Create TODO list → Caleb begins implementation

---

*End of PRD*
