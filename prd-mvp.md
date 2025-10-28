# Klippy MVP - Product Requirements Document

**Version**: 2.0  
**Date**: October 27, 2025  
**Product**: Klippy Desktop Video Editor  
**Platform**: macOS (priority), Windows (secondary)  
**Framework**: Electron + React  

---

## Executive Summary

Klippy is a desktop video editor MVP that proves we can handle media files in a desktop context. The focus is on fundamental workflows: import, display, trim, and export. Users can import video clips, arrange them on a timeline, perform basic trimming, and export a final video—all within a native desktop application.

**Success Criteria**: Ship a functional desktop app that handles the core video editing pipeline without crashes, with acceptable performance, and passes all manual testing gates.

---

## Product Overview

### Core Value Proposition
A lightweight, desktop-native video editor that handles essential editing tasks:
- Import multiple video clips (MP4/MOV)
- Arrange clips on a visual timeline
- Trim clips non-destructively
- Export finished videos to MP4

### Target Users
Developers and product teams testing desktop media handling capabilities. Post-MVP: Content creators needing simple video assembly.

### Technical Stack
- **Desktop Framework**: Electron
- **Frontend**: React
- **Media Processing**: FFmpeg (bundled via ffmpeg-static npm package)
- **Video Playback**: HTML5 `<video>` element (Chromium-based)

---

## MVP Scope

### In Scope
✅ Desktop app that launches via Electron  
✅ Video import (drag & drop + file picker for MP4/MOV only)  
✅ Library view showing imported clips  
✅ Timeline view with draggable clips  
✅ Video preview player (plays timeline sequence with audio)  
✅ Trim functionality (adjust clip in/out points)  
✅ Clip management (delete, reorder)  
✅ Timeline zoom controls  
✅ Export to MP4 with progress indicator  
✅ Session state persistence (auto-restore on relaunch)  
✅ Native app packaging (.dmg for Mac, .exe for Windows)  

### Out of Scope (Post-MVP)
❌ Audio editing (audio follows video automatically)  
❌ Transitions or effects  
❌ Text/titles overlay  
❌ Undo/redo  
❌ Advanced keyboard shortcuts (beyond play/pause)  
❌ Multi-track timeline  
❌ Project file save/load (session state only)  
❌ 4K video support  
❌ Linux support  

---

## Functional Requirements

### 1. Application Launch ✅ COMPLETE

**REQ-1.1**: App must launch in under 5 seconds on macOS  
**REQ-1.2**: FFmpeg binary must be bundled via `ffmpeg-static` npm package (no external dependencies)  
**REQ-1.3**: On launch, restore previous session state (imported clips + timeline)  
**REQ-1.4**: Store session state in `app.getPath('userData')` directory

**Testing Gate**:
- **Happy Path**: Launch app → loads in <5s → shows last session's clips/timeline
- **Edge Case**: First launch (no prior session) → shows empty state UI
- **Error Handling**: FFmpeg missing/corrupted → show error dialog "Media processing unavailable. Please reinstall Klippy."

---

### 2. Video Import ✅ COMPLETE


**REQ-2.1**: Support drag & drop of video files into app window  
**REQ-2.2**: Support file picker via `electron.dialog.showOpenDialog()` filtered to `.mp4` and `.mov` only  
**REQ-2.3**: File picker filters: `{name: 'Videos', extensions: ['mp4', 'mov']}`  
**REQ-2.4**: Display imported clips in Library panel with thumbnails and duration  
**REQ-2.5**: Allow duplicate imports (same file can be added multiple times for reuse in timeline)  
**REQ-2.6**: Store file paths (linked files, not embedded)  

**Supported Formats**:
- MP4 container with H.264 video codec
- MOV container with H.264 video codec
- Reject: HEVC/H.265, ProRes, AV1, WebM, or any non-H.264 codec

**File Constraints**:
- Tested with files up to 2GB
- No artificial size limit (let OS/FFmpeg handle larger files)

**Testing Gate**:
- **Happy Path 1**: Drag 3 MP4 files into app → all appear in Library with thumbnails
- **Happy Path 2**: Click Import button → file picker shows only .mp4/.mov → select 2 files → added to Library
- **Edge Case 1**: Import same file twice → both instances appear in Library
- **Edge Case 2**: Drag unsupported file (.avi) → file picker rejects it (not selectable)
- **Error Handling**: Import corrupted MP4 → show error "Unable to read file: [filename]"

---

### 3. Library View ✅ COMPLETE

**REQ-3.1**: Display all imported clips in a scrollable list/grid  
**REQ-3.2**: Show for each clip:
  - Thumbnail (first frame)
  - Filename
  - Duration (MM:SS format)
**REQ-3.3**: Click on clip in Library → plays in preview player
**REQ-3.4**: Library clips are draggable (drag source) — emit clip data on drag initiation  

**Empty State**:
- Message: "Drag & drop video files or click Import to get started"
- Visual: Upload icon or placeholder

**Testing Gate**:
- **Happy Path**: Import 5 clips → all visible in Library → click one → plays in preview
- **Edge Case**: Library with 20+ clips → scrolling remains smooth
- **Error Handling**: Missing source file (moved/deleted) → show broken file icon with tooltip

---

### 4. Timeline View ✅ COMPLETE

**REQ-4.1**: Visual timeline with horizontal track  
**REQ-4.2**: Clips display as blocks with visual width proportional to duration  
**REQ-4.3**: Playhead (vertical red line) shows current time position  
**REQ-4.4**: Timecode display (HH:MM:SS.mmm) above timeline  

**Clip Management**:
**REQ-4.5**: Timeline accepts dropped clips from Library (drop target) — adds clip to timeline sequence
**REQ-4.6**: Reorder clips by dragging horizontally  
**REQ-4.7**: Delete clips (right-click → Delete or Delete key)  
**REQ-4.8**: Clips snap together (no gaps, no overlaps)  

**Zoom Controls**:
**REQ-4.9**: Zoom slider (range: 100% to 1000%)  
  - 100% = ~1 pixel per second
  - 1000% = ~10 pixels per second
**REQ-4.10**: Default zoom on load: Auto-fit (entire timeline visible in viewport)  
**REQ-4.11**: Horizontal scroll when zoomed in  

**Testing Gate**:
- **Happy Path 1**: Drag 3 clips to timeline → appear in sequence
- **Happy Path 2**: Drag middle clip to end position → reorders correctly
- **Happy Path 3**: Zoom to 500% → scroll left/right → timeline navigates smoothly
- **Edge Case 1**: Timeline with 10 clips (30min total) → auto-fit shows all clips
- **Edge Case 2**: Delete all clips → timeline shows empty state
- **Error Handling**: N/A

---

### 5. Trim Functionality

**REQ-5.1**: Hover over clip edge → show resize cursor (↔)  
**REQ-5.2**: Click + drag edge → adjust in/out point  
**REQ-5.3**: Both start and end edges are trimmable  
**REQ-5.4**: Frame-precise trimming (no snap to seconds)  
**REQ-5.5**: Real-time preview updates while dragging  
**REQ-5.6**: Display trimmed portion duration on clip  
**REQ-5.7**: Non-destructive editing (original file unchanged)  

**Visual Feedback**:
- Clip block width updates in real-time during drag
- Tooltip shows updated duration (e.g., "0:45 → 0:30")

**Testing Gate**:
- **Happy Path 1**: Import 1min clip → trim to 30sec (0:10 - 0:40) → verify clip width updates
- **Happy Path 2**: Trim 3 clips to different lengths → export → verify correct durations in output
- **Edge Case 1**: Trim clip to 1 second → export succeeds
- **Edge Case 2**: Attempt to drag start point past end point → UI prevents (snap or disable)
- **Error Handling**: N/A (UI-constrained action)

---

### 6. Preview Player

**REQ-6.1**: Video player displays current frame at playhead position  
**REQ-6.2**: Playback controls: Play, Pause, Seek bar  
**REQ-6.3**: Audio enabled (plays video + audio track)  
**REQ-6.4**: Click Play → plays from current playhead position through all timeline clips in sequence  
**REQ-6.5**: Seek by clicking on timeline → updates playhead and preview frame  
**REQ-6.6**: Drag playhead → updates preview in real-time (scrubbing)  

**Library View Playback**:
**REQ-6.7**: Click clip in Library → plays that clip only in preview player  

**Performance**:
**REQ-6.8**: Playback at minimum 30fps (smooth motion)  
**REQ-6.9**: Scrubbing updates preview within 100ms  

**Testing Gate**:
- **Happy Path 1**: Add 3 clips to timeline → click Play → all clips play in sequence
- **Happy Path 2**: Click middle of timeline → playhead jumps → preview shows correct frame
- **Happy Path 3**: Drag playhead → preview scrubs smoothly
- **Edge Case**: Play with 10 clips on timeline → playback remains smooth (30fps min)
- **Error Handling**: Corrupted video frame → skip frame, continue playback (don't crash)

---

### 7. Export

**REQ-7.1**: Export button triggers `electron.dialog.showSaveDialog()`  
**REQ-7.2**: Default filename: `Klippy_Export_YYYYMMDD_HHMMSS.mp4`  
**REQ-7.3**: User selects save location  
**REQ-7.4**: Export settings (fixed preset):
  - Codec: H.264 (libx264)
  - Resolution: Match highest source resolution (max 1080p)
  - Frame rate: 30fps
  - Bitrate: ~5Mbps for 1080p (medium quality)
  - Audio: AAC codec, 128kbps

**Progress Indicator**:
**REQ-7.5**: Show modal dialog during export with:
  - Progress bar (0-100%)
  - Estimated time remaining
  - Cancel button

**Cancellation**:
**REQ-7.6**: Cancel button stops export immediately (no confirmation needed)  
**REQ-7.7**: Cleanup partial output file on cancel using Node.js `fs.unlink()`  

**Error Handling**:
**REQ-7.8**: Validate all source files exist before starting export  
**REQ-7.9**: If source file missing → show error: "Cannot export: [filename] not found"  
**REQ-7.10**: If export fails → show FFmpeg error message in dialog  

**Mixed Source Handling**:
**REQ-7.11**: Different frame rates (30fps vs 60fps) → export at 30fps  
**REQ-7.12**: Different resolutions (1080p vs 720p) → export at highest (max 1080p), upscale lower-res  
**REQ-7.13**: Different aspect ratios → export matches first clip's aspect ratio, letterbox others  

**Testing Gate**:
- **Happy Path 1**: Export single 1min clip → completes without crash → output plays correctly
- **Happy Path 2**: Export 3 clips (total 2min) → progress bar updates → output file is 2min
- **Happy Path 3**: Export with mixed 1080p + 720p clips → output is 1080p, 720p clip upscaled
- **Edge Case 1**: Export timeline with 1 second clip → succeeds
- **Edge Case 2**: Click Cancel at 50% progress → export stops, partial file deleted
- **Error Handling 1**: Export with 0 clips on timeline → show error "Add at least one clip to export"
- **Error Handling 2**: Source file deleted after import → export fails with clear error message

---

### 8. Session State Persistence

**REQ-8.1**: On app close, save to `app.getPath('userData')/session.json`:
  - List of imported clips (file paths, trim points)
  - Timeline clip order and positions
  - Zoom level and scroll position

**REQ-8.2**: On app launch, restore saved state automatically from session file  
**REQ-8.3**: Warn user on quit if timeline has clips: "Unsaved work will be lost. Quit anyway?"  
**REQ-8.4**: Use Electron's `app.on('before-quit')` event to trigger save

**Note**: This is NOT project file save/load. User cannot manually save/open projects. State is ephemeral (single session preserved between launches).

**Testing Gate**:
- **Happy Path**: Import 3 clips → arrange on timeline → quit app → relaunch → timeline restored
- **Edge Case**: Quit with empty timeline → no warning shown
- **Error Handling**: Session file corrupted → launch with blank slate (log error to console)

---

## Non-Functional Requirements

### Performance Targets

**PERF-1**: Timeline UI remains responsive with 10+ clips  
  - Clip drag operations: <50ms response time
  - Zoom/scroll: 60fps smooth animation

**PERF-2**: Preview playback at 30fps minimum (1080p H.264 content)  

**PERF-3**: Export completes without crashes  
  - 2-minute 1080p video: <5 minutes export time (depends on hardware)

**PERF-4**: App launch time: <5 seconds  

**PERF-5**: Memory stability (Electron baseline ~250MB due to Chromium)  
  - With 10 clips loaded (20-50min total footage): <1.2GB RAM
  - Memory growth: <150MB variance over 15min session

**PERF-6**: File size: Exported videos maintain reasonable quality (not bloated)  
  - 1080p 1min video: ~35-40MB (5Mbps bitrate)

**PERF-7**: App bundle size: ~250-300MB (Electron + FFmpeg bundled)

---

### Cross-Platform Support

**PLATFORM-1**: Primary platform: macOS (Apple Silicon + Intel)  
**PLATFORM-2**: Secondary platform: Windows 10/11 (best-effort compatibility)  
**PLATFORM-3**: Linux: Out of scope for MVP  

**Codec Compatibility Note**: H.264 playback works natively on macOS via Chromium. Windows support depends on system codecs (typically available on Windows 10+).

**Testing Strategy**: Develop on Mac. Windows testing is best-effort - "hopefully it works on Windows."

---

### UI/UX Requirements

**UI-1**: Minimum window size: 1280x720  
**UI-2**: Layout: Three-panel design
  - Left: Library panel (20% width)
  - Center: Preview player (40% width)
  - Bottom: Timeline (full width, 30% height)

**UI-3**: Loading states for:
  - File import: Spinner + "Importing [filename]..."
  - Export: Progress bar + percentage + time remaining

**UI-4**: Empty states for:
  - Library: "Drag & drop video files or click Import"
  - Timeline: "Drag clips here to start editing"

**UI-5**: Error dialogs: Clear, actionable messages (no technical jargon)

---

## Testing Strategy

### Manual Testing Gates

Each feature includes testing gates with:
- 1-2 Happy Paths
- 1-2 Edge Cases
- 1 Error Handling scenario

**See individual requirements above for specific test cases.**

### Performance Testing

#### Memory Leak Test (15-minute session)

**Note on Testing Approach**: For MVP, use OS-level monitoring (Activity Monitor/Task Manager). Post-MVP consideration: Add debug panel showing `process.memoryUsage()` stats for easier monitoring.

**Procedure**:
1. Open Activity Monitor (Mac) or Task Manager (Windows)
2. Launch Klippy, note baseline memory (expect ~250MB due to Electron/Chromium overhead)
3. Import 10 video clips (2-5min each, ~500MB-1GB total)
4. Perform these actions repeatedly for 15 minutes:
   - Drag clips to timeline
   - Trim clips (adjust in/out points)
   - Play/pause preview
   - Reorder clips
   - Delete clips and re-add
   - Zoom timeline in/out
5. Monitor memory every 3 minutes:
   - 0min: ~250MB (baseline)
   - 3min: ~750MB (clips loaded)
   - 6min: ~800MB
   - 9min: ~830MB
   - 12min: ~850MB
   - 15min: ~880MB

**Pass Criteria**:
- Memory stabilizes within ±150MB after initial clip loading
- No continuous growth (e.g., NOT 750MB → 1.5GB → 2.5GB)
- App remains responsive (UI actions <100ms)

**Fail Signs**:
- Memory grows >150MB every 3 minutes
- App becomes sluggish
- Crashes or freezes

---

### Integration Testing Scenario

**The "3 Clips, 2-Minute Export" Test**:

**Setup**:
1. Prepare 3 video files (H.264 MP4, 1080p)
   - Clip A: 1 minute
   - Clip B: 1 minute  
   - Clip C: 1 minute

**Steps**:
1. Launch Klippy
2. Import all 3 clips via drag & drop
3. Drag clips to timeline one at a time in order: A → B → C (clips snap together in sequence)
4. Trim clips to total exactly 2 minutes:
   - Clip A: Trim to 40 seconds
   - Clip B: Trim to 40 seconds
   - Clip C: Trim to 40 seconds
5. Play preview → verify 2-minute sequence plays correctly with audio
6. Click Export → save as `test_output.mp4`
7. Verify export completes without errors
8. Open exported file in external player (QuickTime/VLC)
9. Verify:
   - Duration: Exactly 2:00
   - Video plays smoothly
   - Audio synced
   - No visual artifacts

**Success Criteria**: All steps complete without crashes or errors. Output file matches expected duration and quality.

---

## Technical Architecture

### Component Overview

```
Klippy App (Electron v39)
├── Main Process (Node.js)
│   ├── Window Management
│   ├── File System Access
│   ├── Child Process Management (FFmpeg)
│   ├── IPC Message Routing
│   └── Session State (userData/session.json)
│
├── Preload Script (Secure Bridge)
│   ├── Context Isolation
│   ├── Safe IPC Method Exposure
│   └── Validates Renderer Messages
│
└── Renderer Process (Chromium + React)
    ├── React Components
    │   ├── Library Panel
    │   ├── Timeline View
    │   ├── Preview Player
    │   └── Export Dialog
    ├── State Management
    └── IPC Invocation (via Preload)
```

### Data Flow

1. **Import**: 
   - Renderer: File picker dialog (`ipcRenderer.invoke('open-file-dialog')`)
   - Main: Returns file paths
   - Renderer: Extract metadata via video element → Add to Library state

2. **Timeline Edit**: 
   - User action → Update React state → Re-render timeline

3. **Preview**: 
   - Playhead position → Calculate clip + offset → Seek `<video>` element

4. **Export**: 
   - Renderer: Send timeline state to Main via IPC
   - Main: Generate FFmpeg command → Execute using `child_process.spawn()`
   - Main: Monitor stderr for progress → Send updates to Renderer via IPC
   - Main: Save file → Notify Renderer on completion

### FFmpeg Integration

**Bundling Strategy**: 
- Install `ffmpeg-static` npm package (provides pre-built FFmpeg binaries for Mac/Windows/Linux)
- Access binary path via `require('ffmpeg-static')`
- Execute FFmpeg commands using Node.js `child_process.spawn()`

**Example Usage**:
```javascript
const ffmpegPath = require('ffmpeg-static');
const { spawn } = require('child_process');

const ffmpeg = spawn(ffmpegPath, [
  '-i', 'input1.mp4',
  '-i', 'input2.mp4',
  // ... additional args
]);
```

**Export Command Template**:
```bash
ffmpeg -i input1.mp4 -i input2.mp4 -i input3.mp4 \
  -filter_complex "[0:v]trim=10:40[v0];[1:v]trim=0:40[v1];[2:v]trim=0:40[v2]; \
                   [v0][v1][v2]concat=n=3:v=1:a=1[outv][outa]" \
  -map "[outv]" -map "[outa]" \
  -c:v libx264 -preset medium -crf 23 -r 30 \
  -c:a aac -b:a 128k \
  output.mp4
```

**Progress Monitoring**:
- Parse FFmpeg stderr output for `time=` progress indicators
- Calculate percentage: `(currentTime / totalDuration) * 100`
- Send progress updates to Renderer via IPC: `mainWindow.webContents.send('export-progress', percent)`

**Notes**:
- Use `trim` filter for clip in/out points
- Use `concat` filter for sequencing
- FFmpeg runs in Main Process (Node.js), not Renderer

---

## Open Questions & Future Considerations

### Post-MVP Features
- Project file format (save/load editing sessions)
- Undo/redo stack
- Keyboard shortcuts (J/K/L for playback)
- Transitions (cross-dissolve)
- Text overlay tool
- Audio level adjustment
- 4K support with proxy workflow
- Multi-track timeline

### Technical Debt to Address
- Thumbnail generation (currently first frame only; should be sprite strips)
- Proxy video creation for large files
- Background rendering (export without blocking UI)

---

## Success Metrics

**MVP Launch Criteria**:
- ✅ All testing gates pass
- ✅ Memory leak test passes (15min stability)
- ✅ Integration test scenario succeeds on Mac (Windows best-effort)
- ✅ No critical bugs (P0: crashes, data loss, export failures)
- ✅ App packaged as native installer (.dmg for Mac, .exe for Windows using electron-builder)

**Post-Launch Validation**:
- Dogfood internally: Team uses Klippy to edit 5+ videos
- Performance benchmarks documented (export times, memory usage)
- Bug backlog prioritized for v1.1

---

## Timeline & Milestones

**Phase 1: Foundation**
- Electron app setup (main + renderer processes, IPC communication)
- Basic UI scaffold with React
- File import + Library view
- FFmpeg integration via ffmpeg-static (validate can execute commands)

**Phase 2: Core Editing**
- Timeline view with drag & drop
- Trim functionality
- Preview player with playback controls

**Phase 3: Polish & Export**
- Timeline zoom + performance optimization
- Export pipeline with progress indicator (IPC communication)
- Session state persistence (userData folder)

**Phase 4: Testing & Packaging**
- Manual testing (all gates)
- Memory leak + integration tests
- Native app packaging via electron-builder
- Windows compatibility testing (best-effort)

---

## Appendix A: Glossary

- **Non-destructive editing**: Edits (trim, arrange) don't modify original video files; only metadata is changed
- **Timeline**: Horizontal track where clips are arranged in sequence
- **Playhead**: Vertical line indicator showing current time position
- **In/Out points**: Start and end timestamps defining the portion of a clip to use
- **Scrubbing**: Dragging playhead to quickly preview different parts of video
- **Letterboxing**: Adding black bars to video when aspect ratios don't match

---

## Appendix B: Reference Resources

- **Electron Documentation**: https://www.electronjs.org/docs/latest/
- **ffmpeg-static npm package**: https://www.npmjs.com/package/ffmpeg-static
- **FFmpeg Documentation**: https://ffmpeg.org/documentation.html
- **electron-builder** (packaging): https://www.electron.build/
- **React Video Player**: https://video-react.js.org/
- **Video.js** (alternative player): https://videojs.com/

---

**Document Status**: Ready for Development  
**Next Steps**: Review PRD → Approve → Begin Phase 1 implementation

---

*End of PRD*