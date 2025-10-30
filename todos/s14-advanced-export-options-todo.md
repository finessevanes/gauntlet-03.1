# TODO: Advanced Export Options (Story 14)

**Feature**: Advanced Export Options | **Status**: Ready | **Agent**: Caleb
**Story**: S14 (Phase 6, Medium)
**Dependencies**: Story 7 (Export to MP4)

---

## Overview

This TODO breaks down the PRD (s14-advanced-export-options-prd.md) into implementation tasks. Tasks are completed in order, with acceptance checks tied to PRD requirements. All tasks must pass before merging to `develop`.

**Key Features**:
1. Built-in platform presets (YouTube, Instagram, TikTok, Twitter) — read-only
2. Custom presets (create, edit, delete) — persisted to `export-presets.json`
3. Preset selection UI with upscaling warnings
4. FFmpeg integration for resolution, bitrate, and fps settings
5. Filename generation with preset name: `Klippy_Export_[PresetName]_YYYYMMDD_HHMMSS.mp4`

---

## Pre-Implementation

### Context Verification
- [ ] **Read PRD**: s14-advanced-export-options-prd.md fully understood
- [ ] **Dependencies Met**: Story 7 (Export to MP4) implemented and working
- [ ] **Codebase Familiarity**:
  - Existing export handler (`src/main/ipc-handlers/export.ts`)
  - ExportModal component (`src/components/ExportModal.tsx`)
  - IPC patterns for main/renderer communication
  - File persistence (electron `app.getPath()`)
- [ ] **Create branch**: `feat/advanced-export-options`

---

## Phase 1: Data Model & Core Infrastructure

### Task 1.1: Define ExportPreset TypeScript Interface
- [ ] Create new file `src/types/export.ts` (or add to existing types file)
- [ ] Define `ExportPreset` interface:
  ```typescript
  interface ExportPreset {
    id: string;                    // "youtube" | "instagram" | UUID for custom
    name: string;                  // "YouTube", "My 720p"
    category: 'builtin' | 'custom';
    resolution: { width: number; height: number };
    bitrate: number;               // Mbps
    frameRate: 24 | 30 | 60;
    platform?: string;             // "youtube", "instagram", etc.
    description?: string;
    createdAt?: number;            // timestamp for custom
  }
  ```
- [ ] Define built-in presets constant:
  ```typescript
  const BUILTIN_PRESETS: ExportPreset[] = [
    { id: 'youtube', name: 'YouTube', category: 'builtin', platform: 'youtube',
      resolution: { width: 1920, height: 1080 }, bitrate: 12, frameRate: 30 },
    { id: 'instagram', name: 'Instagram', category: 'builtin', platform: 'instagram',
      resolution: { width: 1080, height: 1350 }, bitrate: 5, frameRate: 30 },
    { id: 'tiktok', name: 'TikTok', category: 'builtin', platform: 'tiktok',
      resolution: { width: 1080, height: 1920 }, bitrate: 5, frameRate: 30 },
    { id: 'twitter', name: 'Twitter', category: 'builtin', platform: 'twitter',
      resolution: { width: 1280, height: 720 }, bitrate: 8, frameRate: 30 },
  ]
  ```

**Acceptance**:
- TypeScript interface compiles without errors
- All fields required and optional as specified
- Built-in presets constants defined

---

### Task 1.2: Create Preset Persistence Manager
- [ ] Create new file `src/main/preset-manager.ts`
- [ ] Implement `PresetManager` class with methods:
  - `loadPresets()`: Load built-in + custom presets from file
    - Read `app.getPath('userData')/export-presets.json` if exists
    - Parse JSON with version check (current version: 1)
    - Return combined array of built-in + custom presets
    - If file missing/corrupted → log error, return built-in only
  - `saveCustomPreset(preset: ExportPreset)`: Save or update custom preset
    - Validate preset (name required + unique, resolution, bitrate, fps)
    - If validation fails → throw error
    - Read current custom presets from file
    - Add/update preset in array
    - Write updated array back to `export-presets.json` with version
  - `deleteCustomPreset(presetId: string)`: Delete custom preset
    - Verify preset exists and is custom (not built-in)
    - Read presets file
    - Remove preset from array
    - Write updated file
  - `getBuiltinPresets()`: Return only built-in presets
  - `getCustomPresets()`: Return only custom presets
  - `getPresetById(id: string)`: Find preset by id
- [ ] Implement validation helper `validatePreset(preset: ExportPreset)`:
  - Name required and non-empty
  - Name unique (not duplicate with existing presets)
  - Resolution: width/height ≥ 320 and height ≥ 180
  - Bitrate: 1-100 Mbps
  - FPS: 24, 30, or 60 only
  - Return `{valid: boolean, error?: string}`

**Acceptance**:
- File compiles, no TypeScript errors
- Validation logic covers all PRD requirements
- Error messages are specific and helpful

---

## Phase 2: IPC Handlers for Preset Management

### Task 2.1: Implement `export-get-presets` IPC Handler
- [ ] In `src/main/ipc-handlers/export.ts`, add handler:
  - `ipcMain.handle('export-get-presets', async () => { ... })`
  - Call `PresetManager.loadPresets()` to get all presets
  - Return array of `ExportPreset[]`
  - Error handling: If load fails, return built-in only + log error
- [ ] Register handler in `registerExportHandlers()` function

**Acceptance**:
- Handler callable from renderer
- Returns correct preset data
- Error handling prevents crashes

---

### Task 2.2: Implement `export-save-custom-preset` IPC Handler
- [ ] In `src/main/ipc-handlers/export.ts`, add handler:
  - `ipcMain.handle('export-save-custom-preset', async (event, preset: ExportPreset) => { ... })`
  - Validate preset using `PresetManager.validatePreset()`
  - If invalid → return `{ success: false, error: string }`
  - If valid → call `PresetManager.saveCustomPreset(preset)`
  - Return `{ success: true }` on success
  - Log all operations
- [ ] Register handler in `registerExportHandlers()`

**Acceptance**:
- Handler validates input correctly
- Saves to file correctly
- Error messages returned to renderer

---

### Task 2.3: Implement `export-delete-custom-preset` IPC Handler
- [ ] In `src/main/ipc-handlers/export.ts`, add handler:
  - `ipcMain.handle('export-delete-custom-preset', async (event, presetId: string) => { ... })`
  - Verify preset exists
  - Verify preset is custom (not built-in)
  - If not custom → return `{ success: false, error: 'Cannot delete built-in preset' }`
  - Call `PresetManager.deleteCustomPreset(presetId)`
  - Return `{ success: true }` on success
  - Log operation
- [ ] Register handler in `registerExportHandlers()`

**Acceptance**:
- Cannot delete built-in presets
- Custom presets deleted successfully
- Error handling for invalid ids

---

### Task 2.4: Modify `export-video` IPC Handler to Accept Preset
- [ ] Update `handleExportVideo()` signature to accept preset parameter:
  ```typescript
  async function handleExportVideo(
    event: Electron.IpcMainInvokeEvent,
    request: ExportRequest & { preset?: ExportPreset }
  )
  ```
- [ ] Extract preset from request (optional)
- [ ] If preset provided:
  - Use preset resolution, bitrate, fps in FFmpeg command
  - Pass to `buildFFmpegCommand()` for filter application
- [ ] If no preset:
  - Use existing logic (max resolution, default 30fps, default bitrate)
  - Backward compatible
- [ ] Update filename generation:
  - Old: `Klippy_Export_YYYYMMDD_HHMMSS.mp4`
  - New: `Klippy_Export_[PresetName]_YYYYMMDD_HHMMSS.mp4`
  - Extract preset name and sanitize for filename

**Acceptance**:
- Backward compatible (works with/without preset param)
- Preset values applied to FFmpeg command
- Filename includes preset name correctly

---

## Phase 3: Upscaling Detection & Warnings

### Task 3.1: Add Source Resolution Tracking
- [ ] Modify `handleExportVideo()` to track maximum source resolution:
  - After probing all clips, determine max width/height from probeResults
  - Store as `sourceResolution = {width, height}`
  - Pass both sourceResolution and preset to upscaling check

**Acceptance**:
- Correctly identifies max resolution across all clips
- Handles single and multiple clips

---

### Task 3.2: Implement Upscaling Detection
- [ ] Create helper function `isUpscaling(sourceResolution, presetResolution)`:
  - Return `true` if preset resolution > source resolution
  - Handle aspect ratio differences
- [ ] In `handleExportVideo()`, before FFmpeg execution:
  - If preset provided and is upscaling:
    - Send warning to renderer:
      ```
      "Source is [width]x[height]. Upscaling to [presetWidth]x[presetHeight] may reduce quality."
      ```
    - Wait for user confirmation (renderer sends back true/false)
    - If false → abort export
    - If true → proceed with export

**Acceptance**:
- Correctly detects upscaling scenarios
- Warning message clear and informative
- User can proceed or abort

---

## Phase 4: Preset Selection UI

### Task 4.1: Create PresetSelector Component
- [ ] Create `src/components/PresetSelector.tsx`
- [ ] Component displays:
  - List/grid of all presets (built-in + custom)
  - For each preset: name, resolution, bitrate, fps
  - Visual distinction (built-in presets grayed out or marked as "System")
  - Selected preset highlighted
- [ ] Features:
  - Click to select preset
  - Show current selection state
  - On confirm: return selected preset to parent
  - On cancel: dismiss selector

**Acceptance**:
- Component renders all presets
- Selection works
- User can see preset details
- Built-in presets clearly marked as system

---

### Task 4.2: Integrate Preset Selector into Export Flow
- [ ] Modify `App.tsx` or Timeline component `handleExportClick()`:
  - On Export button click:
    1. Call `ipcRenderer.invoke('export-get-presets')` → get all presets
    2. Show PresetSelector modal with preset list
    3. Wait for user to select preset (or cancel)
    4. If cancelled → close modal, return to app
    5. If selected → proceed to save dialog with selected preset
- [ ] Update ExportModal state to track selected preset
- [ ] Pass preset to `export-video` IPC call

**Acceptance**:
- Export flow: Button → Preset Selector → Save Dialog → Export
- Preset correctly selected and passed to IPC handler
- User can go back at any point

---

### Task 4.3: Add Custom Preset Form
- [ ] Create `src/components/CustomPresetForm.tsx`
- [ ] Form fields:
  - Name (text input, required, unique validation)
  - Resolution (dropdown or input: width × height, must be ≥320x180)
  - Bitrate (dropdown or input: 1-100 Mbps)
  - Frame Rate (dropdown: 24, 30, 60)
- [ ] Validation:
  - On change: validate current input
  - Show error messages inline
  - Disable Save button if validation fails
- [ ] Buttons:
  - Save (creates preset, calls `export-save-custom-preset`)
  - Cancel (closes form)
- [ ] On save success:
  - Show confirmation message
  - Close form
  - Refresh preset list

**Acceptance**:
- Form validates all fields correctly
- Prevents save on invalid input
- Persists custom preset on save
- Shows success/error feedback

---

### Task 4.4: Add "Manage Presets" Feature
- [ ] Create `src/components/PresetManager.tsx`:
  - Shows all custom presets in a list
  - Each preset has Edit + Delete buttons
  - Edit button opens CustomPresetForm with preset data
  - Delete button shows confirmation: "Delete [PresetName]?"
- [ ] Add "Manage Presets" button in PresetSelector or main menu
- [ ] On preset update/delete:
  - Call appropriate IPC handler
  - Refresh preset list
  - Show success message

**Acceptance**:
- Can edit custom presets
- Can delete custom presets
- Cannot modify built-in presets
- Changes persisted correctly

---

## Phase 5: FFmpeg Integration for Preset Parameters

### Task 5.1: Modify FFmpeg Command Builder for Preset Settings
- [ ] Update `buildFFmpegCommand()` signature to accept preset:
  ```typescript
  function buildFFmpegCommand(
    clips: Clip[],
    outputPath: string,
    presetResolution?: { width: number; height: number },
    presetBitrate?: number,
    presetFps?: 24 | 30 | 60,
    probeResults: VideoProbeResult[]
  )
  ```
- [ ] Modify filter building:
  - Scale filter: Use `presetResolution` if provided (default: max resolution capped at 1080p)
  - FPS filter: Use `presetFps` if provided (default: 30)
  - Bitrate: Use `presetBitrate` if provided (default: auto based on resolution)
- [ ] Apply filters in correct order:
  1. Trim (from clip in/out points)
  2. Scale (from preset resolution)
  3. FPS (from preset fps)
  4. Concat (all clips)

**Acceptance**:
- Command builds with preset settings
- Backward compatible (works without preset)
- FFmpeg accepts all generated commands

---

### Task 5.2: Apply Bitrate Setting to FFmpeg Command
- [ ] In `buildFFmpegCommand()`, add bitrate argument:
  - `-b:v [bitrate]M` (e.g., `-b:v 12M` for 12 Mbps)
  - Apply before codec settings
- [ ] Handle edge cases:
  - Bitrate 0 → use default (-crf setting)
  - Very high bitrate (>100M) → cap at 100M
  - Very low bitrate (<1M) → show warning, allow user choice

**Acceptance**:
- Bitrate correctly applied to FFmpeg command
- Exported video matches preset bitrate (verify with ffprobe)

---

## Phase 6: Filename Generation with Preset Name

### Task 6.1: Enhance Filename Generation
- [ ] Modify filename generation in `handleExportClick()` or `handleExportVideo()`:
  - Old format: `Klippy_Export_YYYYMMDD_HHMMSS.mp4`
  - New format: `Klippy_Export_[PresetName]_YYYYMMDD_HHMMSS.mp4`
  - Sanitize preset name (remove special chars, replace spaces with underscores)
  - Example: `Klippy_Export_YouTube_20251029_153045.mp4`
- [ ] Ensure filename doesn't exceed filesystem limits (255 chars)

**Acceptance**:
- Filename generated correctly with preset name
- Exported file has correct name
- Works with all preset names (builtin and custom)

---

## Phase 7: Testing & Acceptance

### Task 7.1: Test Happy Path - Platform Preset Export
- [ ] Manual test:
  1. Import 1-minute video
  2. Click Export
  3. Select "YouTube" preset from selector
  4. Confirm save dialog
  5. Wait for export to complete
  6. Verify:
     - Modal shows progress
     - Filename: `Klippy_Export_YouTube_*.mp4`
     - Video resolution: 1920x1080
     - Bitrate: ~12 Mbps (verify with ffprobe)
     - FPS: 30

**Acceptance**: Test gate 1 passes

---

### Task 7.2: Test Happy Path - Custom Preset Creation & Export
- [ ] Manual test:
  1. Open Preset Manager
  2. Create custom preset: "My 720p" (1280x720, 5Mbps, 30fps)
  3. Save and verify persistence
  4. Close and relaunch app
  5. Verify custom preset still in list
  6. Import video, select "My 720p" preset
  7. Export and verify:
     - Filename: `Klippy_Export_My_720p_*.mp4`
     - Resolution: 1280x720
     - Bitrate: 5 Mbps

**Acceptance**: Test gate 2 passes

---

### Task 7.3: Test Upscaling Warning
- [ ] Manual test:
  1. Import 720p video (1280x720)
  2. Click Export
  3. Select "YouTube" preset (1920x1080)
  4. Verify warning: "Source is 1280x720. Upscaling to 1920x1080 may reduce quality."
  5. Options: Proceed or use lower resolution
  6. If Proceed → export succeeds with upscaled output
  7. If lower resolution → allow user to pick different preset

**Acceptance**: Test gate 3 passes

---

### Task 7.4: Test Edge Case - Edit Custom Preset
- [ ] Manual test:
  1. Create custom preset "Test": 1280x720, 5Mbps, 30fps
  2. Edit preset: change to 1920x1080, 8Mbps
  3. Verify changes persisted
  4. Relaunch app
  5. Verify edited preset with new values

**Acceptance**: Edge case 1 passes

---

### Task 7.5: Test Edge Case - Delete Custom Preset
- [ ] Manual test:
  1. Create custom preset "Temp"
  2. Verify in preset list
  3. Delete "Temp"
  4. Verify removed from list
  5. Relaunch app
  6. Verify permanently deleted

**Acceptance**: Edge case 2 passes

---

### Task 7.6: Test Edge Case - Cannot Delete Built-in Preset
- [ ] Manual test:
  1. Open Preset Manager
  2. Attempt to delete "YouTube" preset
  3. Verify delete button disabled or shows error: "Cannot delete built-in preset"

**Acceptance**: Edge case 3 passes

---

### Task 7.7: Test Edge Case - Invalid Custom Preset Input
- [ ] Manual test:
  1. Open custom preset form
  2. Try to save with empty name → error: "Name required"
  3. Try to save with duplicate name → error: "Name already exists"
  4. Try resolution < 320x180 → error: "Minimum resolution 320x180"
  5. Try bitrate outside 1-100 → error: "Bitrate must be 1-100 Mbps"
  6. Verify Save button disabled on invalid input

**Acceptance**: Edge case 4 passes

---

### Task 7.8: Test Edge Case - Mixed Resolution with Different Presets
- [ ] Manual test:
  1. Import clip1 (720p) + clip2 (1080p)
  2. Select Instagram preset (1080x1350, vertical)
  3. Export
  4. Verify output: 1080x1350 vertical (clip1 upscaled, clip2 adjusted)

**Acceptance**: Edge case 5 passes

---

### Task 7.9: Test Backward Compatibility
- [ ] Manual test:
  1. Use existing export flow without preset selection
  2. Verify export still works with default settings
  3. Filename doesn't have preset name (old format): `Klippy_Export_YYYYMMDD_*.mp4`
  4. Resolution/bitrate use defaults (max resolution capped at 1080p, 12 Mbps)

**Acceptance**: Backward compatibility maintained

---

### Task 7.10: Test Preset Persistence
- [ ] Manual test:
  1. Create 3 custom presets
  2. Export with one preset
  3. Close and relaunch app
  4. Verify all 3 custom presets still in list
  5. Verify built-in presets always present

**Acceptance**: Persistence working correctly

---

## Phase 8: Error Handling & Edge Cases

### Task 8.1: Handle Corrupted Presets File
- [ ] If `export-presets.json` corrupted:
  - Log error: "Failed to load custom presets. Using built-in only."
  - Return built-in presets only
  - Don't crash app
  - Next save operation creates new valid file

**Acceptance**: Error handled gracefully

---

### Task 8.2: Handle File System Errors
- [ ] If can't write presets file (permission denied, disk full):
  - Return error to renderer: "Failed to save preset. Check disk space/permissions."
  - Don't lose existing presets
  - Log error for debugging

**Acceptance**: File I/O errors handled

---

## Phase 9: Post-Implementation

### Task 9.1: Code Quality
- [ ] No TypeScript errors or warnings
- [ ] No console errors/warnings (except normal logs)
- [ ] Code follows project style (indentation, naming, comments)
- [ ] All helper functions documented
- [ ] Magic numbers extracted to constants

**Acceptance**: `npm run typecheck` passes

---

### Task 9.2: Definition of Done Checklist
- [ ] ExportPreset TypeScript interface defined
- [ ] Built-in presets constants defined (YouTube, Instagram, TikTok, Twitter)
- [ ] PresetManager class implemented (load, save, delete, validate)
- [ ] IPC handlers: `export-get-presets`, `export-save-custom-preset`, `export-delete-custom-preset`
- [ ] `export-video` modified to accept optional preset param
- [ ] Preset selection UI (PresetSelector component) working
- [ ] Custom preset form with validation working
- [ ] Preset manager UI (edit/delete) working
- [ ] Upscaling detection + warning implemented
- [ ] Filename generation includes preset name
- [ ] FFmpeg integration: scale, bitrate, fps applied from preset
- [ ] Backward compatible (export works without preset)
- [ ] All test gates pass (9 happy paths, 7 edge cases)
- [ ] Error messages user-friendly
- [ ] No console errors
- [ ] Code reviewed and merged to `develop`

**Acceptance**: All items checked

---

### Task 9.3: Prepare for PR
- [ ] Verify all acceptance criteria from user story met
- [ ] Test on macOS (primary platform)
- [ ] Final manual test of full preset workflow (end-to-end)
- [ ] Verify backward compatibility with existing export
- [ ] Commit changes (logical groups)
- [ ] Create PR to `develop` branch with description:
  - Summary of features added
  - Link to user story + PRD
  - Testing performed

**Acceptance**: PR created and ready for review

---

## Summary

| Phase | Tasks | Status |
|-------|-------|--------|
| 1: Data Model & Infrastructure | 1.1-1.2 | Pending |
| 2: IPC Handlers | 2.1-2.4 | Pending |
| 3: Upscaling Detection | 3.1-3.2 | Pending |
| 4: Preset Selection UI | 4.1-4.4 | Pending |
| 5: FFmpeg Integration | 5.1-5.2 | Pending |
| 6: Filename Generation | 6.1 | Pending |
| 7: Testing & Acceptance | 7.1-7.10 | Pending |
| 8: Error Handling | 8.1-8.2 | Pending |
| 9: Post-Implementation | 9.1-9.3 | Pending |

---

**Document Status**: Ready for Implementation
**Next Step**: User review + approval, then begin Task 1.1

---

*End of TODO*
