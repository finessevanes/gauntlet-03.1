# TODO: Export to MP4 (Story 7)

**Feature**: Export to MP4 | **Status**: Ready | **Agent**: Caleb
**Story**: S7 (Phase 4, Complex)
**Dependencies**: Story 4 (Timeline View) + Story 5 (Trim Functionality)

---

## Overview

This TODO breaks down the PRD (s7-export-prd.md) into implementation tasks. Tasks are completed in order, with acceptance checks tied to PRD requirements. All tasks must pass before merging to `develop`.

---

## Pre-Implementation

### Context Verification
- [x] **Read PRD**: s7-export-prd.md fully understood
- [x] **Dependencies Met**: Story 4 (Timeline) + Story 5 (Trim) implemented and working
- [x] **Codebase Familiarity**:
  - Electron main process structure (`src/main/`)
  - React component architecture (`src/components/`)
  - IPC patterns (ipcMain, ipcRenderer)
  - FFmpeg integration via ffmpeg-static
- [x] **Create branch**: `feat/export-to-mp4`

---

## Phase 1: Core Infrastructure

### Task 1.1: Set Up IPC Handlers File
- [x] Create `src/main/ipc-handlers/export.ts`
- [x] Define TypeScript interfaces for export state, clip data, progress
- [x] Export stub functions (to be implemented in later tasks):
  - `handleExportVideo()`
  - `validateTimeline()`
  - `probeSourceFile()`
  - `buildFFmpegCommand()`
  - `parseFFmpegProgress()`
  - `handleExportCancel()`
- [x] Register IPC handlers in main process (`ipcMain.handle()` and `ipcMain.on()`)

**Acceptance**: IPC file compiles, no TypeScript errors

---

### Task 1.2: Create ExportModal Component
- [ ] Create `src/components/ExportModal.tsx`
- [ ] Define component props (isOpen, onCancel, progress)
- [ ] Implement state management (percentComplete, estimatedTimeRemaining, status, errorMessage)
- [ ] Render modal structure:
  - Semi-transparent overlay background
  - Modal container (centered, ~500x300px)
  - Title ("Exporting..." or "Validating..." or "Export Error")
  - Progress bar (HTML5 or CSS-based visual)
  - Percentage text (e.g., "45% complete")
  - Estimated time remaining text (e.g., "3m 45s remaining")
  - Red/warning Cancel button
  - Error message display (conditionally shown)
  - Modal should NOT be dismissible (no X button)
- [ ] Implement `onCancel()` callback to parent component

**Acceptance**:
- Modal renders without errors
- Progress bar updates visually (test with mock data)
- Cancel button clickable
- Modal centered on screen

---

### Task 1.3: Add Export Button to Timeline/App Component
- [ ] Modify `src/components/App.tsx` or `src/components/Timeline.tsx`
- [ ] Add "Export" button to UI (suggest bottom-right of timeline panel or top menu)
- [ ] Wire button click → `handleExportClick()` handler
- [ ] Import ExportModal component
- [ ] Add state for ExportModal visibility + progress data
- [ ] Render `<ExportModal>` with state props

**Acceptance**:
- Export button visible in UI
- Clicking Export opens modal (with no progress data, shows "Validating..." state)
- Modal can be closed via Cancel button

---

## Phase 2: Validation & File I/O

### Task 2.1: Implement Timeline Validation
- [ ] In `export.ts`, implement `validateTimeline()`:
  - Check timeline.clips array has ≥1 clip
  - If empty → return error: "Add at least one clip to export"
  - For each clip, check `fs.existsSync(clip.filePath)`
  - If any missing → return error: "Cannot export: [filename] not found"
  - Return success if all validations pass
- [ ] Call `validateTimeline()` at start of `handleExportVideo()`
- [ ] Send validation errors to Renderer (reject IPC invocation with error message)

**Acceptance**:
- Empty timeline → error shown in modal
- Missing source file → error shown in modal
- Valid timeline → proceeds to next phase

---

### Task 2.2: Implement FFmpeg Probe
- [ ] In `export.ts`, implement `probeSourceFile()`:
  - Takes filePath as input
  - Spawns `ffmpeg -i [filePath]` (no output file, just probe)
  - Parses FFmpeg stderr to extract metadata:
    - Duration (in seconds, from "Duration: HH:MM:SS.ms" format)
    - Resolution (width × height, from "Video: ... 1920x1080 ...")
    - Frame rate (from "fps" in video line)
  - Returns object: `{duration, width, height, fps}`
  - If probe fails → return error instead
- [ ] Call probe for each source clip in `validateTimeline()` (after file existence check)
- [ ] Store probe results for use in filter building

**Acceptance**:
- Can probe valid MP4 files and extract metadata correctly
- Returns error for missing/corrupted files
- No FFmpeg warnings in console (handle gracefully)

---

### Task 2.3: Implement Save Dialog Workflow
- [ ] In `App.tsx` or Timeline component, update `handleExportClick()`:
  - Call `electron.dialog.showSaveDialog()` with:
    - Default filename: `Klippy_Export_YYYYMMDD_HHMMSS.mp4` (generate timestamp)
    - Default path: `app.getPath('documents')` or remember last export location
    - File filter: `{name: 'MP4 Video', extensions: ['mp4']}`
  - If user cancels → close modal, return to normal app state
  - If user confirms → proceed to `handleExportVideo()` IPC call with outputPath + timeline
- [ ] Ensure state updates properly (modal shows "Validating..." while waiting for validation response)

**Acceptance**:
- Save dialog appears on Export button click
- Default filename has correct format
- User can select save location
- Cancel dialog → modal closes
- Confirm dialog → triggers IPC call with outputPath

---

## Phase 3: FFmpeg Command Building

### Task 3.1: Determine Output Resolution
- [ ] In `export.ts`, add logic to `handleExportVideo()`:
  - After probing all clips, scan probe results for max width/height
  - Cap resolution at 1080p (if source is 4K, scale down to 1080p)
  - Output resolution = max(width) × min(height) or 1920×1080 (whichever is smaller)
  - Store as `outputResolution = {width, height}`

**Acceptance**:
- Correctly identifies max resolution from mixed-source clips
- Caps at 1080p
- Handles single clip correctly

---

### Task 3.2: Implement FFmpeg Command Builder
- [ ] In `export.ts`, implement `buildFFmpegCommand()`:
  - Takes `timeline` (clips with trim points), `outputPath`, `outputResolution`, `probeResults`
  - Build FFmpeg arguments array:
    - Input files: `-i input1.mp4 -i input2.mp4 ...` (one for each clip)
    - Filter complex (trim + concat + scale):
      ```
      [0:v]trim=start:end,scale=...,fps=30[v0];
      [1:v]trim=start:end,scale=...,fps=30[v1];
      ...
      [v0][v1]...[vN]concat=n=N:v=1:a=1[outv][outa]
      ```
    - Map streams: `-map "[outv]" -map "[outa]"`
    - Codec settings: `-c:v libx264 -preset medium -crf 23 -r 30 -c:a aac -b:a 128k`
    - Output overwrite: `-y`
    - Output path: `[outputPath]`
  - Return args array (to pass to spawn)
- [ ] Log full command to console (for debugging)
- [ ] Handle trim points (inPoint = start, outPoint = end) correctly in filter

**Acceptance**:
- Command builds without errors
- Includes all clips with trim points
- Includes scale filter for resolution normalization
- Includes fps filter for frame rate
- Output format correct

---

## Phase 4: FFmpeg Execution & Progress

### Task 4.1: Implement FFmpeg Spawning with Progress Parsing
- [ ] In `export.ts`, implement FFmpeg execution in `handleExportVideo()`:
  - After building command, spawn FFmpeg child process
  - Listen to child process stderr
  - Parse FFmpeg progress output:
    - Extract `time=HH:MM:SS.ms` from stderr lines
    - Extract `frame=N` from stderr lines
    - Convert time to seconds: `currentTime`
  - Implement `parseFFmpegProgress()` to extract time/frame from stderr string
  - Send progress updates to Renderer via `mainWindow.webContents.send('export-progress', {...})`
  - Include in progress payload:
    - `percentComplete`: (currentTime / totalDuration) * 100
    - `currentTime`: parsed time in seconds
    - `totalDuration`: timeline total duration
    - `estimatedTimeRemaining`: calculate from current speed
    - `speed`: (currentTime / elapsedTime) - 1.0 = real-time speed
  - Send progress at least 1 per second
- [ ] Handle FFmpeg exit (success or error)
- [ ] Capture FFmpeg stderr for error reporting

**Acceptance**:
- Progress updates sent to Renderer during export
- Progress bar updates smoothly (test with real video)
- Estimated time calculation reasonable (not 0sec or infinity)
- Export completes or errors appropriately

---

### Task 4.2: Update ExportModal to Receive Progress Updates
- [ ] In `App.tsx`, set up IPC listener for `export-progress` event
- [ ] Update ExportModal state with progress data:
  - `percentComplete`
  - `estimatedTimeRemaining` (format as "HH:MM:SS remaining")
  - `currentStatus` (e.g., "exporting", "validating")
- [ ] Modal re-renders with updated progress bar + time remaining

**Acceptance**:
- ExportModal displays progress bar with correct percentage
- Estimated time shows and updates
- No flickering or visual jumps

---

## Phase 5: Cancel & Error Handling

### Task 5.1: Implement Export Cancel
- [ ] In `export.ts`, implement `handleExportCancel()`:
  - Receives `export-cancel` event from Renderer
  - Kill FFmpeg child process immediately via `.kill()`
  - Delete partial output file via `fs.unlink(outputPath)`
  - Send `export-cancelled` event back to Renderer (acknowledge completion)
  - Handle cleanup errors gracefully (log if unlink fails)
- [ ] In `App.tsx`, implement cancel button handler:
  - Click "Cancel" → send `export-cancel` IPC event to Main
  - Listen for `export-cancelled` event → close modal, return to normal state

**Acceptance**:
- Cancel button responsive during export
- FFmpeg process terminates immediately
- Partial file deleted
- Modal closes cleanly
- Can export again without issues

---

### Task 5.2: Implement Error Handling & Display
- [ ] In `handleExportVideo()`, wrap execution in try/catch:
  - Timeline validation error → send error to Renderer via IPC callback
  - Probe error → send error message
  - FFmpeg spawn error → send error message
  - FFmpeg exit with error code → capture stderr, send as error message
  - File write error (disk full) → send error message
- [ ] In `ExportModal`, update to show error state:
  - Change title to "Export Error"
  - Display error message in modal
  - Change Cancel button to "Close" or "OK"
  - Allow dismissing error modal
- [ ] Format error messages user-friendly (no technical jargon)

**Acceptance**:
- Empty timeline → clear error message
- Missing file → clear error message
- FFmpeg error → error message shown (not technical)
- Can retry export after error

---

### Task 5.3: Handle App Close During Export
- [ ] In main process, listen for `before-quit` event
- [ ] If export is in progress:
  - Show dialog: "Export in progress. Quit anyway? (will cancel export)"
  - If user clicks "Yes" → call `handleExportCancel()`, then quit
  - If user clicks "No" → resume export, dialog closes
- [ ] Prevent orphaned FFmpeg processes

**Acceptance**:
- Dialog appears when closing during export
- Yes → cleanly cancels and quits
- No → export resumes
- No FFmpeg processes left on disk

---

## Phase 6: Mixed Source Handling

### Task 6.1: Mixed Resolution Support
- [ ] In `buildFFmpegCommand()`, add scale filter:
  - For each clip, add `scale=1920:1080:force_original_aspect_ratio=increase` filter
  - This upscales 720p to 1080p, keeps 1080p as-is, scales down 4K to 1080p
  - Ensures all clips same resolution before concat

**Acceptance**:
- Mixed 1080p + 720p export → output 1080p, 720p upscaled
- 720p clip visible correctly (no blurriness issues)
- 1080p clip unchanged

---

### Task 6.2: Mixed Frame Rate Support
- [ ] In `buildFFmpegCommand()`, add fps filter:
  - For each clip, add `fps=30` filter
  - Ensures all clips 30fps before concat
  - Handles 60fps → 30fps downsampling, 24fps → 30fps upsampling

**Acceptance**:
- Mixed 30fps + 60fps export → output 30fps
- 60fps clip smoothly downsampled (no stuttering)
- Audio remains synced

---

### Task 6.3: Mixed Aspect Ratio Support (Letterboxing)
- [ ] In `buildFFmpegCommand()`, add letterbox logic:
  - Determine aspect ratio of first clip (reference)
  - For other clips, if aspect ratio differs:
    - Add `pad` filter: `pad=width:height:x:y:color=black` to letterbox
  - Apply after scale filter
- [ ] This ensures all clips same aspect ratio with black bars if needed

**Acceptance**:
- Mixed aspect ratios (16:9 + 4:3) export → first clip aspect ratio preserved
- Other clips letterboxed with black bars
- No visual distortion

---

## Phase 7: Testing & Acceptance

### Task 7.1: Test Happy Path - Single Clip
- [ ] Manual test:
  1. Import 1-minute video clip
  2. Leave on timeline (no trim)
  3. Click Export
  4. Select save location
  5. Wait for export to complete
  6. Open exported file in QuickTime/external player
- [ ] Verify:
  - Modal appears, shows progress
  - Duration: ~1:00
  - Video/audio synced
  - File size reasonable (~30-40MB)
  - No crashes or errors

**Acceptance**: Test gate 1 passes

---

### Task 7.2: Test Happy Path - Multiple Clips
- [ ] Manual test:
  1. Import 3 clips (1 minute each)
  2. Drag to timeline (A, B, C order)
  3. Trim each to 40 seconds (total 2 min)
  4. Click Export
  5. Confirm save
  6. Open exported file
- [ ] Verify:
  - Modal updates smoothly (no stutter)
  - Estimated time decreases
  - Export completes without crash
  - Output: exactly 2:00 duration
  - All 3 clips visible in sequence
  - Audio synced throughout
  - External player handles codec correctly

**Acceptance**: Test gate 2 passes

---

### Task 7.3: Test Cancel Export
- [ ] Manual test:
  1. Start exporting long video (10+ minutes)
  2. Click Cancel at ~50% progress
  3. Observe modal closes
  4. Check file system for partial .mp4 file
- [ ] Verify:
  - FFmpeg terminates immediately
  - Modal closes cleanly
  - Partial file NOT present on disk
  - App returns to normal state
  - Can click Export again without issues

**Acceptance**: Test gate 3 passes

---

### Task 7.4: Test Edge Case - Empty Timeline
- [ ] Manual test:
  1. Open Klippy (no clips on timeline)
  2. Click Export
- [ ] Verify:
  - Error dialog: "Add at least one clip to export"
  - No file picker shown
  - App returns to normal

**Acceptance**: Edge case 1 passes

---

### Task 7.5: Test Edge Case - Missing Source File
- [ ] Manual test:
  1. Import clip1.mp4
  2. Add to timeline
  3. Delete clip1.mp4 from disk
  4. Click Export
- [ ] Verify:
  - Error dialog: "Cannot export: clip1.mp4 not found"
  - No export attempted
  - App returns to normal

**Acceptance**: Edge case 2 passes

---

### Task 7.6: Test Edge Case - Very Small Clip (1 second)
- [ ] Manual test:
  1. Import 5-minute clip
  2. Trim to 1 second
  3. Export
- [ ] Verify:
  - Export succeeds
  - Output duration: ~1 second
  - No crash

**Acceptance**: Edge case 3 passes

---

### Task 7.7: Test Edge Case - Mixed Resolutions
- [ ] Manual test:
  1. Import clip1 (1080p) + clip2 (720p)
  2. Add to timeline (720p second)
  3. Export
- [ ] Verify:
  - Export completes
  - Output: 1080p
  - Both clips visible (720p upscaled)
  - No incorrect letterboxing

**Acceptance**: Edge case 4 passes

---

### Task 7.8: Test Edge Case - Mixed Frame Rates
- [ ] Manual test:
  1. Import clip1 (30fps) + clip2 (60fps)
  2. Add to timeline
  3. Export
- [ ] Verify:
  - Export completes
  - Output: 30fps (constant)
  - No stuttering/dropped frames
  - Audio synced

**Acceptance**: Edge case 5 passes

---

### Task 7.9: Test Long Duration Export
- [ ] Manual test:
  1. Import 5 clips, total 15 minutes
  2. Arrange on timeline
  3. Export
  4. Monitor estimated time
- [ ] Verify:
  - Estimated time reasonable (not 0sec or infinity)
  - Progress bar continuous increase
  - Export completes
  - Memory stable (no leak)
  - No UI freezing

**Acceptance**: Edge case 6 passes

---

### Task 7.10: Test Error - Corrupted Source File
- [ ] Manually create corrupted MP4 (header intact, data corrupt) or use test fixture
- [ ] Manual test:
  1. Import corrupted MP4
  2. Add to timeline
  3. Click Export
- [ ] Verify:
  - Validation detects corruption
  - Error dialog: "Corrupted file: [filename]. Try re-importing."
  - No export attempted

**Acceptance**: Error case 1 passes

---

### Task 7.11: Test Error - App Close During Export
- [ ] Manual test:
  1. Start exporting long video
  2. Click app close (red button) at 30%
  3. Dialog appears: "Export in progress. Quit anyway?"
- [ ] Verify:
  - Yes → cancel export, cleanup, app closes, no FFmpeg process left
  - No → export resumes

**Acceptance**: Error case 4 passes

---

## Post-Implementation

### Task 8.1: Code Quality
- [ ] No TypeScript errors or warnings
- [ ] No console errors or warnings (except normal logs)
- [ ] Code follows project style (indentation, naming, structure)
- [ ] Comments added for complex FFmpeg command building
- [ ] No hardcoded paths or magic numbers (use constants)

**Acceptance**: `npm run lint` or equivalent passes

---

### Task 8.2: Definition of Done Checklist
- [ ] FFmpeg integration validated (build + run export command)
- [ ] IPC handlers implemented (`export-video`, `export-cancel`, progress events)
- [ ] ExportModal component renders with progress bar + cancel
- [ ] Export button visible in UI
- [ ] Timeline validation logic working
- [ ] Save dialog workflow complete
- [ ] FFmpeg command builder with trim + concat filters
- [ ] FFmpeg process spawning with error handling
- [ ] Progress parsing from stderr working
- [ ] Estimated time calculation correct
- [ ] Cancel export workflow (kill process, cleanup file)
- [ ] Mixed resolution/frame-rate/aspect-ratio handling
- [ ] All test gates pass (happy paths, edge cases, errors)
- [ ] Error messages user-friendly
- [ ] No console errors/warnings
- [ ] Exported videos play in external players
- [ ] File cleanup verified on cancel/error
- [ ] Memory stable during long exports

**Acceptance**: All items checked

---

### Task 8.3: Prepare for PR
- [ ] Verify all acceptance criteria from user story met
- [ ] Test on macOS (primary platform)
- [ ] Update/verify any related docs or comments
- [ ] Final manual test of full export workflow (end-to-end)
- [ ] Commit changes (logical groups)
- [ ] Create PR to `develop` branch with description linking to user story + PRD

**Acceptance**: PR created and ready for review

---

## Summary

| Phase | Tasks | Status |
|-------|-------|--------|
| 1: Core Infrastructure | 1.1-1.3 | Pending |
| 2: Validation & I/O | 2.1-2.3 | Pending |
| 3: FFmpeg Command Building | 3.1-3.2 | Pending |
| 4: FFmpeg Execution & Progress | 4.1-4.2 | Pending |
| 5: Cancel & Error Handling | 5.1-5.3 | Pending |
| 6: Mixed Source Handling | 6.1-6.3 | Pending |
| 7: Testing & Acceptance | 7.1-7.11 | Pending |
| 8: Post-Implementation | 8.1-8.3 | Pending |

---

**Document Status**: Ready for Implementation
**Next Step**: User review + approval, then begin Task 1.1

---

*End of TODO*
