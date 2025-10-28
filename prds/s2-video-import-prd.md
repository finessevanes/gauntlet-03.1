# PRD: Video Import

**Feature**: Video Import | **Status**: Ready | **Agent**: Pam

---

## Preflight

1. **Smallest end-to-end outcome?** User drags MP4/MOV file into app window → file appears in Library panel with thumbnail, filename, and duration
2. **Primary user + critical action?** Video editor importing source clips to begin editing workflow
3. **Must-have vs nice-to-have?** MUST-HAVE: Drag-and-drop + file picker, MP4/MOV support, metadata extraction (duration), thumbnail generation (first frame), error handling for corrupted files
4. **Offline/persistence needs?** YES: Imported clips stored in session state (file paths only, not video data). Persisted via session.json from Story 1.
5. **Performance targets?** Import completes within 2 seconds per file (metadata extraction + thumbnail generation). No UI blocking for large files (up to 2GB tested). Loading spinner shown during import.
6. **Error/edge cases critical to handle?** Corrupted MP4 files, unsupported formats (HEVC, ProRes, AV1, WebM), missing files, duplicate imports (allowed), special characters in filenames
7. **Data model changes?** Extend `Clip` interface with thumbnail data. Add `clips` array to session state.
8. **Service/command APIs needed?** `import_video` (via file picker), `get_video_metadata` (duration, resolution), `generate_thumbnail` (first frame extraction)
9. **React components to create/modify?** `ImportButton.tsx`, `Library.tsx` (clip card display), `DragDropZone.tsx` (drop target overlay)
10. **Desktop-specific needs?** Electron `dialog.showOpenDialog()` with file filters, drag-and-drop event handling on window, file path access via Node.js
11. **What's explicitly out of scope?** Unsupported video codecs (HEVC/H.265, ProRes, AV1), embedded video storage (linked files only), video transcoding/conversion, batch import UI optimizations

---

## 1. Summary

Video Import enables users to bring MP4 and MOV video files into Klippy via drag-and-drop or a native file picker. Each imported clip appears in the Library panel with a thumbnail (first frame), filename, and duration. Files are linked (not embedded), allowing duplicate imports for reuse. Metadata extraction and thumbnail generation complete within 2 seconds per file, with loading indicators for user feedback.

---

## 2. Non-Goals / Scope Boundaries

**Out of Scope:**
- Unsupported codecs (HEVC, ProRes, AV1, VP8/9) or formats (MPEG-2, WMV, FLV, MKV, WebM)
- Audio-only files, image sequences, transcoding, cloud imports
- Embedded video storage, proxy generation, import presets, automatic organization

---

## 3. Experience (UX)

**Entry Points**: (1) Drag MP4/MOV files onto app window, (2) Click "Import" button → file picker (filtered to .mp4/.mov)

**Happy Path**: Drop file → loading spinner ("Importing [filename]...") → 1-2s → clip card appears with thumbnail, filename, duration in Library panel

**States**: Idle (ready) → Importing (spinner) → Success (clip card) or Error (toast)

**Key Behaviors**:
- Drop target overlay: Semi-transparent highlight on dragover
- Duplicate imports: Same file can be imported multiple times with unique IDs
- Error handling: Corrupted/unsupported files show error toast, no clip added
- Desktop: Drag-drop works even when unfocused; file picker on same monitor; graceful cancel if app closes during import

---

## 4. Functional Requirements

**MUST (Critical)**:
- **Drag & Drop**: Accept MP4/MOV files, multi-file support, drop overlay on dragover, sequential processing
- **File Picker**: Electron dialog filtered to .mp4/.mov, multi-select, remembers last location
- **Metadata Extraction**: FFprobe duration, resolution, frame rate, codec; complete <1s per file; fail gracefully
- **Thumbnail**: First frame at 0.001s, 320px width JPEG, base64 data URL, <1s generation, placeholder on fail
- **Codec Validation**: H.264 only; reject HEVC, ProRes, AV1, VP8/9 with error toast
- **Linked Files**: Store absolute path (not embedded), non-destructive, allow duplicates with unique IDs
- **Large Files**: Handle up to 2GB, async processing, no UI blocking
- **Loading UI**: Show spinner "Importing [filename]..." immediately, disappear on success/error
- **Error Handling**:
  - Corrupted: "Unable to read file: [filename]"
  - Unsupported format/codec: "Unsupported [format|codec]. Only H.264 MP4/MOV supported."
  - Missing/permission: "File not found" or "Cannot access file"
  - FFmpeg timeout (>10s): "Import timeout for [filename]. File may be corrupted."

**SHOULD**: Progress percentage for slow extractions, metadata in session for debugging, console logging

---

## 5. Data Model

### Clip Structure (extends from Story 1)

```typescript
interface Clip {
  id: string;                  // Unique identifier (UUID v4)
  filePath: string;            // Absolute path to source file (e.g., "/Users/name/Videos/clip.mp4")
  filename: string;            // Display name (e.g., "clip.mp4")
  duration: number;            // Total duration in seconds (e.g., 83.5)
  inPoint: number;             // Trim start (default: 0)
  outPoint: number;            // Trim end (default: duration)
  importedAt: number;          // Timestamp (ms since epoch)

  // New fields for Video Import:
  thumbnail: string;           // Base64 data URL (e.g., "data:image/jpeg;base64,/9j/4AAQ...") or file path
  resolution: {
    width: number;             // e.g., 1920
    height: number;            // e.g., 1080
  };
  frameRate: number;           // e.g., 30
  codec: string;               // e.g., "h264"
  bitrate?: number;            // Optional: bits per second (e.g., 5000000)
}
```

**Storage**: Clips in `session.json` (from Story 1) with thumbnails as base64 data URLs; source videos linked (not copied)

**Validation**:
- `filePath`: Absolute, exists at import time
- `duration`, `frameRate`, resolution: Positive numbers
- `codec`: "h264" only
- `thumbnail`: Valid base64 data URL
- `filename`: Extracted from path

---

## 6. Service/Command APIs

### Main Process Handlers (Electron IPC)

#### `import:open-file-picker`
**Purpose**: Open native file picker dialog for video import.

```typescript
// Renderer calls:
await ipcRenderer.invoke('import:open-file-picker');

// Main process returns:
{
  filePaths: string[],    // Array of absolute file paths (empty if canceled)
  canceled: boolean       // True if user clicked Cancel
}
```

**Behavior**: Call `dialog.showOpenDialog()` with filters `{name: 'Video Files', extensions: ['mp4', 'mov']}`, multi-select enabled, return file paths or empty array on cancel

---

#### `import:get-video-metadata` → `{success, data: {duration, resolution, frameRate, codec, bitrate}, error}`
**Purpose**: FFprobe metadata extraction

**Behavior**: Validate file exists → Execute FFprobe → Parse JSON → Return metadata
- FFprobe cmd: `ffprobe -v error -select_streams v:0 -show_entries stream=width,height,duration,r_frame_rate,codec_name,bit_rate -of json [file]`

**Errors**: File not found, FFprobe timeout (>10s), Unsupported codec, Corrupted file

---

#### `import:generate-thumbnail` → `{success, thumbnail: "data:image/jpeg;base64,..."}`
**Purpose**: Generate first-frame thumbnail via FFmpeg

**Behavior**: Validate file → Temp output path → FFmpeg (ss 0.001, scale 320:-1) → Encode base64 → Delete temp → Return data URL

**Performance**: Target <1s per thumbnail, ~10-30KB file size

**Errors**: FFmpeg timeout (>5s), Output creation failed, File read error

---

#### `import:validate-file` → `{valid, error}`
**Purpose**: Pre-validate file (extension, existence, readability)

**Behavior**: Check exists → Check .mp4/.mov extension → Check readable

**Errors**: File not found, Unsupported format, Permission denied

---

## 7. Components to Create/Modify

### React Components

| Component | File | Purpose |
|-----------|------|---------|
| `ImportButton` | `src/components/ImportButton.tsx` | Button in Library toolbar, triggers file picker via IPC |
| `Library` | `src/components/Library.tsx` | Container for clip cards, handles import state, displays loading spinners |
| `ClipCard` | `src/components/ClipCard.tsx` | Individual clip display: thumbnail, filename, duration |
| `DragDropZone` | `src/components/DragDropZone.tsx` | Invisible overlay on app window, handles drag-and-drop events |
| `LoadingSpinner` | `src/components/LoadingSpinner.tsx` | Reusable spinner component for "Importing [filename]..." state |
| `Toast` | `src/components/Toast.tsx` | Error notification display (e.g., "Unable to read file: ...") |

### Electron Main Process

| Module | File | Purpose |
|--------|------|---------|
| `importHandlers` | `src/main/ipc-handlers/import.ts` | IPC handlers: `import:open-file-picker`, `import:get-video-metadata`, `import:generate-thumbnail`, `import:validate-file` |
| `ffmpegService` | `src/main/services/ffmpeg-service.ts` | FFmpeg/FFprobe wrapper functions: execute commands, parse output, handle errors |
| `thumbnailGenerator` | `src/main/services/thumbnail-generator.ts` | Generate and encode thumbnail images, manage temp files |

---

## 8. Integration Points

- **Electron dialog API**: `dialog.showOpenDialog()` for file picker
- **Drag-and-drop**: Window-level event listeners (`dragover`, `drop`) exposed via preload script
- **File system**: Node.js `fs` module to validate files, read thumbnails
- **FFmpeg/FFprobe**: Execute via `child_process.spawn()` in main process
- **State management**: Add imported clips to React Context or Zustand store (clips array)
- **Session persistence**: Save clips to `session.json` via session manager (Story 1)

---

## 9. Testing & Acceptance Gates

| Test | Setup | Gate | Pass Criteria |
|------|-------|------|---------------|
| **HP1: Drag & Drop** | 1 MP4 (1080p, 1m) | Clip appears with metadata | Thumbnail visible, duration "1:00", <2s import, no errors |
| **HP2: File Picker** | 3 MOV files (30s, 1m, 2m) | All 3 clips appear | Thumbnails generated, durations accurate, <6s total, no errors |
| **HP3: Duplicate** | Import same clip twice | Two instances in Library | Same filename/duration/thumbnail, unique IDs, can reuse separately |
| **EC1: Large File** | 2GB MP4 (10m) | Import succeeds, no freeze | Spinner shows, <5s, thumbnail generated, UI responsive, no memory spike |
| **EC2: Filename Special Chars** | `my_clip (1) [test] & video.mp4` | Filename displays correctly | Exact name shown, no encoding errors, no truncation |
| **EC3: Very Short** | 1-second MP4 | Imports successfully | Duration "0:01", thumbnail generated, no errors |
| **ERR1: Corrupted File** | Corrupted/truncated MP4 | Error toast, no clip added | Toast "Unable to read file: [name]", spinner disappears, library valid |
| **ERR2: Unsupported Format** | Drag .avi file | Error toast immediately | Toast "Unsupported format: [name]", no spinner, no processing |
| **ERR3: HEVC Codec** | MP4 with H.265 codec | Error toast after validation | Toast "Unsupported codec in [name]", no clip added, log codec name |
| **PERF: 10 File Batch** | 10 MP4 files (1080p, 1-2m) | All appear, responsive, no leaks | <20s total (<2s/file), UI responsive, <100MB memory growth, no crashes |

---

## 10. Definition of Done

**Implementation**:
- [ ] IPC handlers: `import:open-file-picker`, `import:get-video-metadata`, `import:generate-thumbnail`, `import:validate-file`
- [ ] FFmpeg service: FFprobe & thumbnail functions with error handling
- [ ] React components: `ImportButton`, `Library` (loading state), `ClipCard`, `DragDropZone`, `LoadingSpinner`, `Toast`
- [ ] Drag-drop on app window with overlay; file picker filtered MP4/MOV; metadata via FFprobe; thumbnails 320px JPEG from first frame
- [ ] Codec validation (H.264 only); duplicate imports with unique IDs; loading spinner "Importing [filename]..."
- [ ] Error handling: Corrupted, unsupported format/codec, missing files, permissions, FFmpeg timeouts

**Testing**:
- [ ] All test gates pass (HP1-3, EC1-3, ERR1-3, PERF)
- [ ] Import <2s per file (1GB tested)
- [ ] UI responsive during large imports
- [ ] Memory stable (<100MB growth in batch)

**Finalization**:
- [ ] Code reviewed & merged to `develop`

---

## 11. Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Large file imports block UI | Async via `child_process.spawn()`, loading spinner, test 2GB |
| Slow thumbnail generation | Scale 320:-1, base64 encoding, target <1s |
| FFmpeg timeout on corrupted files | 10s timeout on FFprobe/FFmpeg, cancel on exceeded |
| Special chars in paths break FFmpeg | Use `spawn()` with array args (auto-escaping), test unicode |
| Base64 thumbnails bloat session.json | Target 10-30KB per thumbnail; post-MVP: separate directory |
| Unsupported codecs crash FFmpeg | Pre-validate codec, reject early |
| Drag-drop OS gesture conflicts | Use standard events, prevent default |
| Windows file permissions | Catch `EACCES`, show "Permission denied" |
| Memory leaks from repeated imports | Ensure child processes terminate, test 15min session |

---

## Authoring Notes

- Implement FFmpeg service first (foundational, robust error handling)
- Use `spawn()` with array args (avoid injection), not shell commands
- Validate extensions early (before FFmpeg processing)
- Store thumbnails as base64 data URLs (simplicity)
- Log all FFmpeg stderr for debugging
- Test on both macOS + Windows (path differences: `/` vs `\`)
- Test aspect ratios: 16:9, 4:3, 9:16
- Drag-drop overlay: subtle (semi-transparent)
