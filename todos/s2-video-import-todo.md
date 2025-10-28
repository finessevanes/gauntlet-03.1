# TODO — Video Import (Story 2)

**Branch**: `feat/video-import`
**Source**: USER_STORIES.md (Story 2)
**PRD Reference**: `prds/s2-video-import-prd.md`
**Owner (Agent)**: Caleb

---

## 0. Pre-Implementation

- [ ] Read user story and acceptance criteria thoroughly
- [ ] Read PRD sections: Summary, Functional Requirements, Testing & Acceptance Gates
- [ ] Clarify any ambiguities before starting
- [ ] Identify test gates from PRD Section 9 (Testing & Acceptance Gates)

---

## 1. Service/Command Layer (Electron IPC)

Implement backend handlers in Electron main process for video import operations.

### 1.1 FFmpeg Service Module
- [ ] Create `src/main/services/ffmpeg-service.ts`
  - Export `executeFFprobe()` function: Execute FFprobe with timeout (10s)
  - Export `executeFFmpeg()` function: Execute FFmpeg with timeout (10s)
  - Handle stdout/stderr parsing, error handling, process cleanup
  - Test: Execute with valid file → returns output; timeout → throws error

### 1.2 Metadata Extraction Service
- [ ] Create `src/main/services/metadata-service.ts`
  - Export `extractMetadata(filePath)`: Returns duration, resolution, frameRate, codec, bitrate
  - Use FFprobe command: `ffprobe -v error -select_streams v:0 -show_entries stream=width,height,duration,r_frame_rate,codec_name,bit_rate -of json [file]`
  - Validate codec is H.264 only, reject HEVC/ProRes/AV1/VP8/VP9
  - Test: Valid H.264 MP4 → metadata returned; HEVC file → error thrown; corrupted file → graceful error

### 1.3 Thumbnail Generation Service
- [ ] Create `src/main/services/thumbnail-generator.ts`
  - Export `generateThumbnail(filePath)`: Returns base64 data URL
  - Use FFmpeg: `ffmpeg -ss 0.001 -i [file] -vframes 1 -vf scale=320:-1 -f image2pipe -vcodec mjpeg pipe:1`
  - Capture stdout as buffer → encode to base64 → return data URL
  - Target: <1s generation, ~10-30KB size
  - Test: Valid video → base64 thumbnail returned; corrupted file → fallback placeholder

### 1.4 File Validation Service
- [ ] Create `src/main/services/file-validator.ts`
  - Export `validateVideoFile(filePath)`: Returns {valid: boolean, error?: string}
  - Check: File exists, readable, extension is .mp4 or .mov
  - Test: Valid file → valid=true; missing file → error; .avi file → unsupported format error

### 1.5 IPC Handlers
- [ ] Create `src/main/ipc-handlers/import.ts`
  - Handler: `import:open-file-picker` → Opens native dialog, returns file paths
    - Use `dialog.showOpenDialog()` with filters: `{name: 'Video Files', extensions: ['mp4', 'mov']}`
    - Multi-select enabled
    - Returns: `{filePaths: string[], canceled: boolean}`
  - Handler: `import:validate-file` → Validates file
    - Input: `{filePath: string}`
    - Returns: `{valid: boolean, error?: string}`
  - Handler: `import:get-video-metadata` → Extracts metadata
    - Input: `{filePath: string}`
    - Returns: `{success: boolean, data?: {...}, error?: string}`
  - Handler: `import:generate-thumbnail` → Generates thumbnail
    - Input: `{filePath: string}`
    - Returns: `{success: boolean, thumbnail?: string, error?: string}`
  - Test: Each handler responds correctly with valid/invalid inputs

### 1.6 Register IPC Handlers
- [ ] Update `src/main.ts` to import and register import handlers
  - Test: Handlers are registered and callable from renderer

---

## 2. Data Model & Types

### 2.1 Extend Clip Interface
- [ ] Update `src/types/session.ts` to extend `Clip` interface:
  - Add `filename: string` (display name extracted from path)
  - Add `thumbnail: string` (base64 data URL)
  - Add `resolution: {width: number, height: number}`
  - Add `frameRate: number`
  - Add `codec: string`
  - Add optional `bitrate?: number`
  - Test: TypeScript compiles without errors

### 2.2 Import IPC Types
- [ ] Update `src/types/ipc.ts` to add import-related types:
  - `FilePickerResponse`: `{filePaths: string[], canceled: boolean}`
  - `FileValidationResponse`: `{valid: boolean, error?: string}`
  - `VideoMetadataResponse`: `{success: boolean, data?: {duration, resolution, frameRate, codec, bitrate}, error?: string}`
  - `ThumbnailResponse`: `{success: boolean, thumbnail?: string, error?: string}`
  - Test: Types export correctly

---

## 3. React Components & State

### 3.1 Import Button Component
- [ ] Create `src/components/ImportButton.tsx`
  - Button labeled "Import" in Library toolbar
  - On click: Invoke `import:open-file-picker` IPC
  - Handle response: If not canceled, pass file paths to import handler
  - Disable button while import is in progress
  - Test: Click → file picker opens; select files → imports; cancel → no action

### 3.2 Drag & Drop Zone Component
- [ ] Create `src/components/DragDropZone.tsx`
  - Invisible overlay covering entire app window
  - Listen to `dragover` and `drop` events via preload API
  - On dragover: Show semi-transparent highlight overlay
  - On drop: Extract file paths, validate .mp4/.mov, pass to import handler
  - Test: Drag MP4 → overlay shows; drop → import triggered; drag .txt → rejected

### 3.3 Loading Spinner Component
- [ ] Create `src/components/LoadingSpinner.tsx`
  - Reusable spinner with text: "Importing [filename]..."
  - Props: `filename: string`
  - Test: Renders spinner with filename

### 3.4 Toast Notification Component
- [ ] Create `src/components/Toast.tsx`
  - Error/success notification display
  - Props: `message: string, type: 'error' | 'success'`
  - Auto-dismiss after 5 seconds
  - Test: Shows message, disappears after timeout

### 3.5 Clip Card Component
- [ ] Create `src/components/ClipCard.tsx`
  - Display: Thumbnail image, filename, duration (MM:SS)
  - Props: `clip: Clip`
  - Thumbnail: Render base64 image or fallback icon if loading/error
  - Test: Renders with valid clip data; handles missing thumbnail gracefully

### 3.6 Update Library Component
- [ ] Modify `src/components/MainLayout.tsx` (Library section)
  - Add `ImportButton` to Library panel header (toolbar)
  - Add `DragDropZone` wrapper around entire app
  - Display `ClipCard` for each clip in state (replace placeholder)
  - Show `LoadingSpinner` for clips currently importing
  - Show `Toast` for import errors
  - Test: Import button visible; drag-drop works; clips display correctly

### 3.7 Import Logic Hook
- [ ] Create `src/hooks/useImport.ts`
  - Hook manages import state: `{importing: Map<id, filename>, errors: string[]}`
  - Export `importVideos(filePaths: string[])` function:
    1. For each file path: Validate → Get metadata → Generate thumbnail → Add to session
    2. Show loading spinner during import
    3. Handle errors: Show toast, don't add clip
    4. On success: Add clip to session store
  - Test: Import 1 file → clip added; import corrupted file → error shown; import 3 files → all processed

---

## 4. Preload Script Updates

- [ ] Update `src/preload.ts` to expose import IPC channels:
  - Add `import.openFilePicker()` → invokes `import:open-file-picker`
  - Add `import.validateFile(filePath)` → invokes `import:validate-file`
  - Add `import.getMetadata(filePath)` → invokes `import:get-video-metadata`
  - Add `import.generateThumbnail(filePath)` → invokes `import:generate-thumbnail`
  - Add drag-drop event handlers: `onDragOver(callback)`, `onDrop(callback)`
  - Test: API exposed to renderer context

---

## 5. Integration

### 5.1 Wire Import Button
- [ ] Connect ImportButton → useImport hook → IPC handlers
  - Test: Click Import → file picker → select MP4 → clip appears in Library with thumbnail and metadata

### 5.2 Wire Drag & Drop
- [ ] Connect DragDropZone → useImport hook
  - Test: Drag MP4 into window → drop → clip appears in Library

### 5.3 Session Persistence
- [ ] Update `src/main/services/session-manager.ts` to persist new Clip fields (thumbnail, resolution, etc.)
  - Test: Import clip → close app → relaunch → clip restored with thumbnail

---

## 6. Manual Testing

**Reference test gates from PRD Section 9 (Testing & Acceptance Gates):**

### Happy Paths
- [x] **HP1: Drag & Drop** — Drag 1 MP4 (1080p, 1min) → Clip appears with thumbnail, filename, duration "1:00" in <2s
- [x] **HP2: File Picker** — Click Import → Select 3 MOV files (30s, 1m, 2m) → All 3 appear with thumbnails, accurate durations in <6s total
- [x] **HP3: Duplicate** — Import same file twice → Two instances in Library with same metadata but unique IDs

### Edge Cases
- [ ] **EC1: Large File** — Import 2GB MP4 (10min) → Succeeds in <5s, spinner shows, UI responsive, thumbnail generated
- [x] **EC2: Special Characters** — Import `my_clip (1) [test] & video.mp4` → Filename displays correctly, no encoding errors
- [ ] **EC3: Very Short** — Import 1-second MP4 → Duration "0:01", thumbnail generated, no errors

### Error Handling
- [ ] **ERR1: Corrupted File** — Import corrupted/truncated MP4 → Toast: "Unable to read file: [name]", no clip added
- [ ] **ERR2: Unsupported Format** — Drag .avi file → Toast: "Unsupported format: [name]" immediately, no processing
- [x] **ERR3: HEVC Codec** — Import MP4 with H.265 → Toast: "Unsupported codec in [name]", no clip added

### Performance
- [ ] **PERF: 10 File Batch** — Import 10 MP4 files (1080p, 1-2min each) → All appear in <20s (<2s/file), UI responsive, <100MB memory growth

### Additional Checks
- [ ] No console errors during all test scenarios
- [ ] Feature feels responsive (no UI blocking during import)
- [ ] Loading spinners appear and disappear correctly

---

## 7. Definition of Done

- [ ] All acceptance criteria from USER_STORIES.md (Story 2) pass
- [ ] All test gates from PRD pass (HP1-3, EC1-3, ERR1-3, PERF)
- [ ] Code has comments for complex logic (FFmpeg commands, error handling)
- [ ] No console warnings or errors
- [ ] All TODO tasks above are checked off

---

## 8. PR & Merge

⚠️ **CRITICAL**: DO NOT COMMIT UNTIL USER CONFIRMS ALL TEST GATES PASS

- [ ] Create branch: `git checkout -b feat/video-import` from develop
- [ ] User confirms all test gates pass ← WAIT FOR THIS
- [ ] User says "ready to commit" or "looks good"
- [ ] THEN: Commit changes (logical grouping):
  - Commit 1: FFmpeg services (ffmpeg-service, metadata-service, thumbnail-generator, file-validator)
  - Commit 2: IPC handlers (import.ts + main.ts registration)
  - Commit 3: Types (session.ts, ipc.ts updates)
  - Commit 4: React components (ImportButton, DragDropZone, LoadingSpinner, Toast, ClipCard)
  - Commit 5: Import logic hook (useImport.ts)
  - Commit 6: Integration (MainLayout updates, preload updates)
  - Commit 7: Session persistence updates (session-manager.ts)
  - Commit 8: TODO completion (mark this file as done)
- [ ] Push: `git push origin feat/video-import`
- [ ] Create PR to `develop` with:
  - Title: "Video Import (Story 2)"
  - Body:
    - Summary: Enables drag-and-drop and file picker import for MP4/MOV files with metadata extraction and thumbnail generation
    - Links: USER_STORIES.md (Story 2), prds/s2-video-import-prd.md
    - Test gates passed: HP1-3, EC1-3, ERR1-3, PERF
    - Files changed: [list key files]
- [ ] Code reviewed
- [ ] Merge to develop

---

## Notes

- FFmpeg commands use `spawn()` with array arguments (auto-escaping, prevents injection)
- Thumbnails stored as base64 data URLs in session.json (simplifies persistence)
- Import is sequential (one file at a time) to avoid FFmpeg resource contention
- All FFmpeg operations have 10s timeout to handle corrupted files
- Codec validation happens during metadata extraction (reject non-H.264 early)
- File picker remembers last location (Electron default behavior)
- Drag-drop events use `preventDefault()` to avoid browser navigation
