# PRD: Export to MP4

**Feature**: Export to MP4 | **Status**: Ready | **Agent**: Pam
**Story**: S7 (Phase 4, Complex)
**Dependencies**: Story 4 (Timeline View) + Story 5 (Trim Functionality)

---

## Preflight

1. **Smallest end-to-end user outcome?**
   User clicks Export → selects save location → progress modal shows → final MP4 file saved with correct duration/quality.

2. **Primary user + critical action?**
   Content creator → Click "Export" button → Save edited timeline as MP4 file.

3. **Must-have vs nice-to-have?**
   **MUST**: Export button, save dialog, progress modal, fixed H.264 preset, cancel with cleanup.
   **SHOULD**: Estimated time remaining, upscaling mixed resolutions, letterboxing different aspect ratios.

4. **Offline/persistence needs?**
   No. Export is real-time FFmpeg execution. No persistent state needed (previous session state comes from Story 8).

5. **Performance targets?**
   - 2-minute 1080p video: <5 minutes export time (hardware-dependent)
   - Progress updates: At least 1 per second for smooth bar animation
   - UI must remain responsive (progress updates sent via IPC, not blocking)

6. **Error/edge cases critical to handle?**
   - Source files deleted after import → clear error before export starts
   - Timeline empty → error before attempting export
   - FFmpeg failure → show stderr message to user
   - Cancel mid-export → cleanup partial file immediately
   - Corrupted video frame → FFmpeg skips, export continues
   - Mixed frame rates / resolutions / aspect ratios → fixed output settings

7. **Data model changes?**
   No new persistent data models. Export reads from existing timeline state (clips + trim points). Output is single MP4 file.

8. **Service/command APIs needed?**
   **IPC Handlers** (Main Process):
   - `export-video` — Validate timeline + files, spawn FFmpeg, monitor progress, save output
   - Listening on Renderer for `export-cancel` event

9. **React components to create/modify?**
   - **New**: `ExportModal.tsx` — Export button, progress bar, estimated time, cancel button
   - **Modify**: `App.tsx` — Add export modal and trigger logic

10. **Desktop-specific needs?**
    - `electron.dialog.showSaveDialog()` for file path selection
    - `child_process.spawn()` for FFmpeg execution (Node.js in Main Process)
    - `fs.unlink()` for cleanup on cancel
    - IPC communication (Main ↔ Renderer) for progress updates

11. **What's explicitly out of scope?**
    - Project file save/load (users cannot save editing sessions as .klippy files)
    - Multiple export formats (MP4 only)
    - Quality settings (fixed H.264 preset)
    - Audio editing (audio follows video automatically)
    - Batch export
    - Direct cloud upload

---

## 1. Summary

Users export their timeline as a final MP4 video file to share or archive. The export process validates source files, streams through FFmpeg with real-time progress updates, and handles mixed frame rates/resolutions with sensible defaults.

---

## 2. Non-Goals / Scope Boundaries

- **No project file save** (users cannot load/save `.klippy` projects—state is ephemeral)
- **No quality presets** (fixed H.264 settings only)
- **No multi-format export** (MP4 only)
- **No audio editing** (audio follows video automatically from source)
- **No subtitle support** (title/text overlays post-MVP)
- **No background rendering** (export blocks UI, but ipcRenderer shows progress modal)

---

## 3. Experience (UX)

### Entry Point
- Button: "Export" appears in top menu bar or bottom-right of timeline panel
- Click → triggers export workflow

### User Flow (Happy Path)

```
1. User clicks "Export" button
   ↓
2. File picker dialog opens
   - Default filename: "Klippy_Export_YYYYMMDD_HHMMSS.mp4"
   - User selects save location
   - Confirms (OK button)
   ↓
3. Validation:
   - Timeline has ≥1 clip? ✓
   - All source files exist? ✓
   ↓
4. Export starts
   - Modal dialog appears: "Exporting..."
   - Progress bar (0-100%)
   - Estimated time remaining (e.g., "3m 45s remaining")
   - Cancel button
   ↓
5. FFmpeg processes timeline:
   - Reads each clip + trim points
   - Applies concat filter (sequence clips)
   - Encodes to H.264 at 30fps, ~5Mbps
   - Writes to selected file path
   ↓
6. Export completes
   - Progress bar reaches 100%
   - Modal closes
   - Success message (optional): "Video exported successfully"
```

### States

| State | Trigger | UI | Behavior |
|-------|---------|----|-|
| **Idle** | App ready | Export button enabled | User can click Export |
| **Validating** | Export clicked | Modal: "Validating..." | Check timeline + files (fast, <1sec) |
| **Exporting** | Validation passes | Modal: Progress bar + cancel | FFmpeg runs, progress updates stream |
| **Cancelling** | Cancel clicked | Modal: "Stopping..." | Terminate FFmpeg, cleanup partial file |
| **Success** | Export complete (0 errors) | Modal closes, optional toast | File saved, ready to share |
| **Error** | Validation fails OR FFmpeg errors | Error dialog with message | Show user-friendly error, allow retry |

### Desktop Considerations

- **Window resize**: Export modal should be centered and sized for visibility (min 400x300)
- **App close during export**: Prompt "Export in progress. Quit anyway?" → if yes, cancel export + cleanup
- **Multi-monitor**: Modal appears on primary monitor where window is

---

## 4. Functional Requirements

### MUST

#### 4.1 Export Triggering
- **REQ-4.1.1**: Export button appears in UI (location: TBD with designer, suggest top menu or timeline panel button)
- **REQ-4.1.2**: Clicking Export opens Electron `showSaveDialog()` with:
  - Default filename: `Klippy_Export_YYYYMMDD_HHMMSS.mp4` (e.g., `Klippy_Export_20251028_143045.mp4`)
  - Default location: `app.getPath('documents')` or last export location
  - File filter: `{name: 'MP4 Video', extensions: ['mp4']}`
  - Buttons: Save, Cancel

#### 4.2 Timeline Validation (Before Export)
- **REQ-4.2.1**: Check timeline has ≥1 clip
  - If empty → show error dialog: "Add at least one clip to export"
  - Cancel export, return to app
- **REQ-4.2.2**: Validate all source file paths exist on disk
  - Check each clip's filePath using `fs.existsSync()`
  - If any missing → show error: "Cannot export: [filename] not found"
  - Cancel export, return to app
- **REQ-4.2.3**: Validate all source files are readable (not corrupted)
  - Attempt to open with FFmpeg probe (1-2 sec check)
  - If probe fails → show error: "Corrupted file: [filename]. Try re-importing."

#### 4.3 Export Settings (Fixed Preset)
- **REQ-4.3.1**: Video codec: H.264 (libx264)
- **REQ-4.3.2**: Frame rate: 30fps (fixed, regardless of source)
- **REQ-4.3.3**: Resolution: Match highest source (max 1080p)
  - Scan all source clips for resolution
  - Output = max width and max height (up to 1080p)
  - If source is 4K: scale down to 1080p
- **REQ-4.3.4**: Bitrate: ~5Mbps (constant quality via CRF=23)
- **REQ-4.3.5**: Audio codec: AAC, 128kbps

#### 4.4 FFmpeg Command Generation
- **REQ-4.4.1**: Build FFmpeg command dynamically based on timeline:
  - `-i input1.mp4 -i input2.mp4 ...` (each source file, in order)
  - `-filter_complex "..."` with trim + concat filters
  - `-map` output video/audio streams
  - `-c:v libx264 -preset medium -crf 23 -r 30 -c:a aac -b:a 128k` (codec settings)
  - `-y` (overwrite output without prompt)
  - Output file path

**Example Command**:
```bash
ffmpeg -i clip1.mp4 -i clip2.mp4 -i clip3.mp4 \
  -filter_complex "[0:v]trim=10:40[v0];[1:v]trim=0:40[v1];[2:v]trim=0:40[v2]; \
                   [v0][v1][v2]concat=n=3:v=1:a=1[outv][outa]" \
  -map "[outv]" -map "[outa]" \
  -c:v libx264 -preset medium -crf 23 -r 30 \
  -c:a aac -b:a 128k \
  -y /path/to/output.mp4
```

#### 4.5 FFmpeg Execution (Main Process)
- **REQ-4.5.1**: Use Node.js `child_process.spawn()` to execute FFmpeg
- **REQ-4.5.2**: Pass command-line arguments as array to spawn
- **REQ-4.5.3**: Monitor stderr for progress indicators (FFmpeg outputs `frame=N time=HH:MM:SS.ms`)
- **REQ-4.5.4**: Calculate export progress: `(currentTime / totalDuration) * 100`
- **REQ-4.5.5**: Send progress updates to Renderer via IPC at least once per second

#### 4.6 Progress Modal (Renderer)
- **REQ-4.6.1**: Modal title: "Exporting..."
- **REQ-4.6.2**: Progress bar: 0-100%, visual fill
- **REQ-4.6.3**: Progress text: "[X]% complete"
- **REQ-4.6.4**: Estimated time remaining: "HH:MM:SS remaining" (based on current speed)
- **REQ-4.6.5**: Cancel button: Red or warning color, always visible and clickable
- **REQ-4.6.6**: Modal is non-dismissible (no X button, only Cancel)
- **REQ-4.6.7**: Modal is centered on screen, ~500px wide × 300px tall

#### 4.7 Cancel Export
- **REQ-4.7.1**: Cancel button sends `export-cancel` IPC event to Main Process
- **REQ-4.7.2**: Main Process receives cancel → immediately kill FFmpeg child process
- **REQ-4.7.3**: Delete partial output file using `fs.unlink()` (no confirmation needed)
- **REQ-4.7.4**: Send `export-cancelled` IPC event back to Renderer
- **REQ-4.7.5**: Modal closes, app returns to normal state

#### 4.8 Error Handling
- **REQ-4.8.1**: If FFmpeg process exits with error code ≠ 0:
  - Capture stderr output (FFmpeg error message)
  - Show error dialog with message: "Export failed: [FFmpeg error]"
  - Allow user to click OK → app returns to normal
- **REQ-4.8.2**: If file write fails (disk full, permission denied):
  - Show error: "Cannot save file: [system error message]"
  - Cleanup partial file
- **REQ-4.8.3**: If user closes app during export:
  - Trigger Electron `before-quit` event
  - Show dialog: "Export in progress. Quit anyway? (will cancel export)"
  - If yes → cancel export + cleanup + quit
  - If no → resume export

### SHOULD (Nice-to-Have)

#### 4.9 Mixed Source Handling
- **REQ-4.9.1**: Different frame rates → export at 30fps (all clips resampled)
  - FFmpeg fps filter: `fps=30` applied to each video stream before concat
- **REQ-4.9.2**: Different resolutions → export at highest (max 1080p), upscale lower-res
  - Scan all clips, find max resolution
  - Apply scale filter: `scale=max_width:max_height:force_original_aspect_ratio=increase`
- **REQ-4.9.3**: Different aspect ratios → export matches first clip, letterbox others
  - First clip aspect ratio is reference
  - Other clips: pad with black bars to match (via `scale` + `pad` filters)

#### 4.10 Estimated Time Calculation
- **REQ-4.10.1**: Track time elapsed since export started
- **REQ-4.10.2**: Divide total duration by elapsed time → speed factor (e.g., 0.5x = 2x real-time)
- **REQ-4.10.3**: Calculate remaining time: `(totalDuration - currentTime) / speedFactor`
- **REQ-4.10.4**: Update estimate every 1-2 seconds as export progresses

---

## 5. Data Model

### Input (Timeline State)
```typescript
interface Clip {
  id: string;
  filePath: string;
  duration: number;
  inPoint: number;  // trim start (seconds)
  outPoint: number; // trim end (seconds)
}

interface Timeline {
  clips: Clip[]; // ordered array
  zoomLevel: number;
  playheadPosition: number;
}
```

### Export State (transient, not persisted)
```typescript
interface ExportProgress {
  status: 'idle' | 'validating' | 'exporting' | 'cancelling' | 'complete' | 'error';
  percentComplete: number;
  estimatedTimeRemaining: number; // seconds
  currentFrame?: number;
  totalFrames?: number;
  errorMessage?: string;
}
```

### No persistent data model changes
- Export does NOT create a new document or project type
- Output is a raw MP4 file (not stored in app state)
- Export progress is ephemeral (lost on app close)

---

## 6. Service/Command APIs

### IPC Handler: `export-video`

**Invoked by**: Renderer (when user confirms save dialog)

**Input Parameters**:
```typescript
{
  outputPath: string;        // full file path from save dialog
  timeline: {
    clips: Clip[];           // timeline clips with trim points
    totalDuration: number;   // total duration in seconds
  };
}
```

**Behavior**:
1. Validate timeline (≥1 clip, all files exist)
2. Probe each source file (get duration, resolution, frame rate)
3. Determine output resolution (max of sources, capped at 1080p)
4. Build FFmpeg command with trim + concat filters
5. Spawn FFmpeg process
6. Monitor stderr, send progress updates to Renderer via `mainWindow.webContents.send('export-progress', {...})`
7. Return after FFmpeg completes or errors

**Output (via IPC callback)**:
```typescript
{
  success: boolean;
  outputPath?: string;       // if success
  errorMessage?: string;     // if error
}
```

**Error Cases**:
- Timeline empty → return `{success: false, errorMessage: "Add at least one clip to export"}`
- Source file not found → return `{success: false, errorMessage: "Cannot export: [filename] not found"}`
- Probe fails (corrupted file) → return `{success: false, errorMessage: "Corrupted file: [filename]"}`
- FFmpeg exits with error → return `{success: false, errorMessage: "FFmpeg error: [stderr]"}`
- Disk full → return `{success: false, errorMessage: "Cannot save file: Disk full"}`

---

### IPC Handler: `export-cancel`

**Invoked by**: Renderer (when user clicks Cancel in progress modal)

**Behavior**:
1. Receive `export-cancel` event
2. Kill FFmpeg child process (via `.kill()`)
3. Delete partial output file (via `fs.unlink()`)
4. Send `export-cancelled` event back to Renderer

**No return value** (just events)

---

### IPC Event: `export-progress` (Main → Renderer)

**Emitted by**: Main Process during FFmpeg execution

**Payload**:
```typescript
{
  percentComplete: number;           // 0-100
  currentTime: number;               // seconds
  totalDuration: number;             // seconds
  currentFrame?: number;             // FFmpeg frame count
  estimatedTimeRemaining: number;    // seconds
  speed: number;                     // 1x = real-time, 2x = twice speed
}
```

**Frequency**: At least 1 per second (ideally every FFmpeg stderr line parsed)

---

### IPC Event: `export-cancelled` (Main → Renderer)

**Emitted by**: Main Process after cancel cleanup completes

**Payload**: Empty (just acknowledgment)

---

## 7. Components to Create/Modify

### New Components

#### `src/components/ExportModal.tsx`
**Purpose**: Modal dialog showing export progress, estimated time, and cancel button

**Props**:
```typescript
interface ExportModalProps {
  isOpen: boolean;
  onCancel: () => void;
  progress: {
    percentComplete: number;
    estimatedTimeRemaining: number;
    errorMessage?: string;
  };
}
```

**States**:
- `isOpen: boolean` — modal visibility
- `percentComplete: number` (0-100) — progress bar fill
- `estimatedTimeRemaining: string` — "HH:MM:SS remaining"
- `status: 'validating' | 'exporting' | 'error'` — title/message changes

**Renders**:
- Modal overlay (semi-transparent dark background)
- Title: "Exporting..." (or "Validating...", "Export Error")
- Progress bar (CSS or HTML5 progress element)
- Percentage text
- Estimated time text
- Cancel button (red/warning color)
- Error message (if failed)

---

#### Modify `src/components/Timeline.tsx` or `src/components/App.tsx`
**Purpose**: Add Export button and wire export workflow

**Changes**:
- Add "Export" button to UI (suggest bottom-right of timeline or top menu)
- Click handler → check timeline validity → show save dialog → invoke `export-video` IPC
- Listen for `export-progress` events → update ExportModal state
- Listen for `export-cancelled` event → close modal
- On success → show optional toast/message

---

### Electron IPC Handler

#### `src/main/ipc-handlers/export.ts`
**Purpose**: Implement FFmpeg export workflow

**Functions**:
- `handleExportVideo()` — Main entry point, validates + spawns FFmpeg
- `validateTimeline()` — Check clips exist and are readable
- `probeSourceFile()` — Use FFmpeg to get file metadata (duration, resolution, fps)
- `buildFFmpegCommand()` — Construct FFmpeg args with trim + concat filters
- `parseFFmpegProgress()` — Extract `time=` and `frame=` from stderr
- `handleExportCancel()` — Kill process, cleanup partial file

**Integration**:
- Register in Main Process: `ipcMain.handle('export-video', handleExportVideo)`
- Register listener: `ipcMain.on('export-cancel', handleExportCancel)`

---

## 8. Integration Points

### File System (Node.js fs via Electron Main Process)
- `fs.existsSync()` — Check if source files exist
- `fs.unlink()` — Delete partial export file on cancel
- `fs.statSync()` — Get file metadata (if needed)

### FFmpeg (via ffmpeg-static)
- `ffmpeg` binary path from `require('ffmpeg-static')`
- `child_process.spawn()` to execute FFmpeg with complex filter_complex
- Monitor stderr for progress parsing
- Handle process termination and errors

### Electron APIs
- `electron.dialog.showSaveDialog()` — File picker for save location
- `ipcMain.handle()` / `ipcRenderer.invoke()` — Export command
- `ipcMain.on()` / `ipcRenderer.on()` — Progress events and cancel
- `app.on('before-quit')` — Handle export-in-progress on app close
- `mainWindow.webContents.send()` — Send progress updates to Renderer

### React State Management
- Export progress state (context or store)
- Modal open/close state
- Error state + messages

---

## 9. Testing & Acceptance Gates

### Happy Paths

#### Gate 1: Single Clip Export
```
Flow:
  1. Import 1-minute clip
  2. Leave on timeline (no trim)
  3. Click Export
  4. Select location, confirm
  5. Wait for export to complete
  6. Open exported file in QuickTime/VLC

Pass Criteria:
  - Progress modal appears and reaches 100%
  - File saved to selected location
  - Exported video plays correctly
  - Duration: 1:00
  - No audio/video sync issues
  - File size: ~30-40MB (reasonable for 1min @ 5Mbps)
```

#### Gate 2: Multiple Clips Export
```
Flow:
  1. Import 3 clips (1min each)
  2. Drag to timeline in order (A, B, C)
  3. Trim each to 40 seconds (total 2min)
  4. Click Export
  5. Confirm save
  6. Open exported file

Pass Criteria:
  - Progress modal appears, updates smoothly
  - Estimated time remaining updates (visible decrease)
  - Export completes without crash
  - Output file: exactly 2:00 duration
  - Video quality: all 3 clips visible in sequence
  - Audio synced throughout
  - Exported file plays in external player (no codec issues)
```

#### Gate 3: Cancel Export
```
Flow:
  1. Start exporting 10+ minute video
  2. Click Cancel at ~50% progress
  3. Observe modal closes
  4. Check temp directory for partial file

Pass Criteria:
  - FFmpeg terminates immediately
  - Modal closes cleanly
  - Partial file deleted (no orphaned .mp4 in downloads)
  - App returns to normal state
  - Can click Export again without issues
```

---

### Edge Cases

#### Edge Case 1: Empty Timeline
```
Flow:
  1. Open Klippy (no clips on timeline)
  2. Click Export

Expected Result:
  - Error dialog: "Add at least one clip to export"
  - No file picker shown
  - App returns to normal
```

#### Edge Case 2: Missing Source File
```
Flow:
  1. Import clip1.mp4
  2. Add to timeline
  3. Delete clip1.mp4 from disk
  4. Click Export

Expected Result:
  - Validation error dialog: "Cannot export: clip1.mp4 not found"
  - No export attempted
  - App returns to normal
```

#### Edge Case 3: Very Small Clip (1 second)
```
Flow:
  1. Import 5-minute clip
  2. Trim to 1 second
  3. Export

Expected Result:
  - Export succeeds
  - Output duration: ~1 second
  - No crash or error
```

#### Edge Case 4: Mixed Resolutions (1080p + 720p)
```
Flow:
  1. Import 2 clips: clip1 (1080p), clip2 (720p)
  2. Add both to timeline (720p second)
  3. Export

Expected Result:
  - Export completes
  - Output resolution: 1080p
  - Both clips visible (720p upscaled smoothly)
  - No letterboxing unless aspect ratio differs
```

#### Edge Case 5: Mixed Frame Rates (30fps + 60fps)
```
Flow:
  1. Import 2 clips: clip1 (30fps), clip2 (60fps)
  2. Add to timeline
  3. Export

Expected Result:
  - Export completes
  - Output frame rate: 30fps (constant)
  - No stuttering or dropped frames
  - Audio remains synced
```

#### Edge Case 6: Long Duration (10+ minute export)
```
Flow:
  1. Import 5 clips, total 15 minutes
  2. Arrange on timeline
  3. Export
  4. Monitor estimated time remaining

Expected Result:
  - Estimated time appears reasonable (not 0sec or infinity)
  - Progress bar continues to increase
  - Export completes (may take 10-20 minutes depending on hardware)
  - No memory leak (memory usage stable)
  - No UI freezing during export
```

---

### Error Handling

#### Error 1: Source File Corrupted
```
Flow:
  1. Import corrupted MP4 (header intact, but video data corrupt)
  2. Add to timeline
  3. Export

Expected Result:
  - Validation detects corruption (FFmpeg probe fails)
  - Error dialog: "Corrupted file: [filename]. Try re-importing."
  - No export attempted
  - App returns to normal
```

#### Error 2: Disk Full During Export
```
Flow:
  1. Start export to drive with <1GB free
  2. Let FFmpeg write ~800MB
  3. Disk fills up

Expected Result:
  - FFmpeg detects write error
  - Export fails with error message: "Cannot save file: No space left on device"
  - Partial file deleted
  - Modal closes, error dialog shown
```

#### Error 3: FFmpeg Missing/Corrupted
```
Flow:
  1. Manually delete ffmpeg binary from bundled ffmpeg-static
  2. Click Export

Expected Result:
  - Error during spawn: "Command ffmpeg not found"
  - Error dialog: "Media processing error. Please reinstall Klippy."
```

#### Error 4: App Close During Export
```
Flow:
  1. Start exporting long video
  2. Click app close (red button) while export is at 30%
  3. Dialog appears: "Export in progress. Quit anyway?"

Expected Result:
  - If Yes → Cancel export, cleanup partial file, app closes
  - If No → Resume export (modal stays visible)
  - No orphaned FFmpeg processes on disk
```

---

### Performance

#### Perf 1: 2-Minute Export Speed
```
Setup: 3 clips (1min each, 1080p H.264)
Trim to total 2 minutes
Export to local SSD

Expected: <5 minutes (depends on hardware)
Measure: Time from "Click Export" to success dialog
```

#### Perf 2: Progress Updates (Responsiveness)
```
During export:
  - Progress bar updates at least 1/second
  - Estimated time recalculates smoothly
  - UI remains responsive (can click Cancel anytime)
  - No stutter or lag in modal
```

#### Perf 3: Memory Stability
```
Export 15-minute video:
  - Baseline (before export): ~300MB
  - During export: ~500-600MB (peak)
  - After cleanup: Back to ~300MB
  - No memory leak on repeated exports
```

---

## 10. Definition of Done

- [ ] FFmpeg integration validated (can build + run export command)
- [ ] IPC handlers implemented (`export-video`, `export-cancel`)
- [ ] ExportModal React component renders with progress bar + cancel
- [ ] Export button visible in UI
- [ ] Timeline validation logic (empty check, file existence check)
- [ ] Save dialog workflow (show picker, pass path to Main Process)
- [ ] FFmpeg command builder with trim + concat filters
- [ ] FFmpeg process spawning with error handling
- [ ] Progress parsing from FFmpeg stderr
- [ ] Estimated time calculation working
- [ ] Cancel export workflow (kill process, cleanup file)
- [ ] Mixed resolution/frame-rate handling (via FFmpeg filters)
- [ ] All manual test gates pass (happy paths, edge cases, errors)
- [ ] Error messages user-friendly (no technical jargon)
- [ ] No console errors or warnings
- [ ] Exported videos play correctly in external players
- [ ] File cleanup on cancel/error verified
- [ ] Memory stable during long exports
- [ ] Code reviewed and merged to `develop`

---

## 11. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| **FFmpeg command complexity** → Subtle bugs in filter_complex string | Pre-test FFmpeg command with sample clips; log full command to console for debugging |
| **Long export hangs UI** → App feels unresponsive | Use child_process (doesn't block Main), send progress updates via IPC to keep UI responsive |
| **Progress parsing misses frames** → Estimated time wildly inaccurate | Parse every FFmpeg stderr line; test with real video files; log parsed values |
| **Partial file not cleaned up** → Disk accumulates orphaned .mp4s | Explicitly call `fs.unlink()` on cancel/error; test cancel workflow thoroughly |
| **File picker dialog inconsistent across Mac/Windows** → Different behavior expected | Use Electron's cross-platform API; test on both OSes (best-effort for Windows) |
| **Source file deleted between validation + export** → Export fails mid-way | Re-validate source files immediately before spawning FFmpeg |
| **Codec incompatibility on Windows** → H.264 playback fails | Test with ffmpeg-static on Windows; bundle cross-platform FFmpeg binary |
| **Very large file (2GB+) hangs during probe** → FFmpeg probe timeout | Add timeout (5-10sec) to probe; skip problematic files with error message |

---

## Authoring Notes

- Write FFmpeg command as template first; test with real sample clips
- Export progress modal should be non-blocking to user (IPC sends updates, not Main→Renderer blocking call)
- Test cancel at multiple progress points (10%, 50%, 90%)
- Validate all test gates on both macOS and Windows (best-effort)
- Log FFmpeg command + stderr for debugging export failures
- Consider adding debug console in app to show FFmpeg output (post-MVP feature)

---

## Acceptance Criteria from Story

- [ ] Click "Export" button → save file dialog opens
- [ ] Default filename: `Klippy_Export_YYYYMMDD_HHMMSS.mp4`
- [ ] User selects save location and confirms
- [ ] Export settings (fixed preset): H.264, 1080p max, 30fps, 5Mbps, AAC 128kbps
- [ ] Progress modal shows: progress bar, time remaining, cancel button
- [ ] Cancel button stops export + deletes partial file
- [ ] Validate source files exist before export
- [ ] Export fails → show FFmpeg error message
- [ ] Mixed frame rates → export at 30fps
- [ ] Mixed resolutions → export at 1080p, upscale
- [ ] Mixed aspect ratios → letterbox
- [ ] 1-minute clip export → completes without crash
- [ ] 3 clips (2-minute total) → output is exactly 2 minutes
- [ ] Empty timeline → error: "Add at least one clip to export"
- [ ] 1-second clip export succeeds
- [ ] Exported video plays in external player with synced audio

---

**Document Status**: Ready for Implementation
**Next Step**: Caleb creates TODO and implements

---

*End of PRD*
