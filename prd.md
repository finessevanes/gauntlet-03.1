# Klippy Full Feature Set - Product Requirements Document

**Version**: 1.0
**Date**: October 28, 2025
**Product**: Klippy Desktop Video Editor (Post-MVP Features)
**Platform**: macOS (priority), Windows (secondary)
**Framework**: Electron + React

---

## Executive Summary

This PRD covers the **post-MVP feature set** for Klippy, building upon the completed MVP foundation. These features enable professional-grade video editing capabilities including native recording, advanced timeline editing, effects, and platform-specific exports.

The MVP (import, timeline, trim, export) is **COMPLETE**. This document specifies additional features with two priority tiers:

### REQUIRED for Full Submission (Core Features - Phase 5)
✅ Screen recording
✅ Webcam recording
✅ Picture-in-Picture (simultaneous screen + webcam)
✅ Advanced timeline (multiple tracks)
✅ Split clips at playhead
✅ Advanced export (resolution options, platform presets)
✅ Audio capture & controls

### STRETCH GOALS (if time permits - Phases 6-7)
⚡ Video filters & effects (brightness, contrast, blur, etc.)
⚡ Transitions between clips (fade, slide, dissolve)
⚡ Text overlays with animations
⚡ Keyboard shortcuts for common actions
⚡ Undo/redo system
⚡ Enhanced auto-save & project recovery
⚡ Platform export presets (YouTube, TikTok, Instagram)

---

## Product Overview

### Completed MVP Features (Reference)
✅ Application launch
✅ Video import (drag & drop, file picker)
✅ Library view with thumbnails
✅ Timeline view with draggable clips
✅ Basic trim functionality
✅ Video preview player
✅ Export to MP4
✅ Session state persistence

### New Capabilities (This PRD)
🎥 Screen and webcam recording
🎬 Advanced timeline (multiple tracks, split, snap-to-grid)
✂️ Enhanced editing (audio controls, filters, transitions)
📤 Advanced export (resolution options, cloud upload)
⌨️ Keyboard shortcuts & undo/redo
🎨 Text overlays and effects

---

## Phase 5: Recording & Advanced Editing

### Feature 1: Screen Recording ✅ COMPLETE
**STATUS: ✅ REQUIRED**

**REQ-1.1**: Implement screen capture UI
- Button in main toolbar: "Record Screen"
- Display list of available screens/windows (using Electron's `desktopCapturer` API)
- Allow user to select screen or specific window
- Show visual indicator when recording is active (red dot + timer)

**REQ-1.2**: Screen capture implementation
- Use Electron's `desktopCapturer.getSources()` to list screens/windows
- Pass selected source to `navigator.mediaDevices.getUserMedia()`
- Capture at native resolution (no upscaling)
- Record to WebM or temporary MP4 file

**REQ-1.3**: Microphone audio capture
- Request microphone permission (standard `getUserMedia` flow)
- Sync audio with video during recording
- Allow audio level monitoring before recording starts

**REQ-1.4**: Recording session management
- Record, pause, and stop controls
- Save recording directly to temp location
- Auto-add recorded video to library upon stop
- Allow user to rename recording before adding to timeline

**Technical Hints**:
```javascript
// Electron main process
const sources = await desktopCapturer.getSources({ types: ['screen', 'window'] });
// Pass source ID to renderer → getUserMedia({ video: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: sourceId } } })
```

**Testing Gate**:
- Happy Path: Click "Record Screen" → select screen → record 30sec → stop → video added to library and plays correctly
- Edge Case: User selects window → records → window closed during recording → video still saves
- Error Handling: Microphone permission denied → show error dialog, allow screen-only recording

---

### Feature 2: Webcam Recording
**STATUS: ✅ REQUIRED**

**REQ-2.1**: Webcam capture UI
- Button in toolbar: "Record Webcam"
- Request camera permission (`navigator.mediaDevices.getUserMedia({ video: true })`)
- Show live preview of camera feed before recording
- Allow camera selection if multiple cameras available

**REQ-2.2**: Webcam recording execution
- Record webcam video to WebM or MP4
- Capture microphone audio simultaneously
- Support common webcam resolutions (720p, 1080p)

**REQ-2.3**: Recording controls
- Start, pause, stop recording
- Save to library when complete
- Allow renaming before timeline insertion

**Testing Gate**:
- Happy Path: Click "Record Webcam" → camera shows preview → record 20sec → stop → video plays in library
- Edge Case: Camera in use by another app → show error message
- Error Handling: Camera permission denied → show permission request dialog

---

### Feature 3: Picture-in-Picture Recording
**STATUS: ✅ REQUIRED**

**REQ-3.1**: Simultaneous screen + webcam recording
- Advanced option: "Record Screen + Webcam (PiP)"
- Merge screen capture + webcam into single video
- Position webcam as overlay (corner, customizable)
- Allow alpha transparency on webcam layer

**REQ-3.2**: PiP settings
- Webcam position: Top-left, top-right, bottom-left, bottom-right, custom
- Webcam size: Small (20%), Medium (30%), Large (40%)
- Webcam border: Optional rounded corners, shadow
- Audio: Mix both microphone tracks or select primary

**REQ-3.3**: Technical implementation
- Use FFmpeg filter_complex during export to compose layers:
  ```bash
  ffmpeg -i screen.mp4 -i webcam.mp4 \
    -filter_complex "[0:v][1:v]overlay=W-w-10:H-h-10[outv]" \
    -map "[outv]" output.mp4
  ```

**Testing Gate**:
- Happy Path: Record screen + webcam → arrange on timeline → export → output shows webcam overlay
- Edge Case: Different aspect ratios → scaling and letterboxing applied correctly
- Error Handling: One source fails → fall back to screen-only recording

---

### Feature 4: Advanced Timeline - Multiple Tracks
**STATUS: ✅ REQUIRED**

**REQ-4.1**: Multi-track timeline layout
- Minimum 2 tracks: Video A (main) + Video B (overlay/PiP)
- Each track displays clips independently
- Vertical stacking of tracks (A on top, B below in composition)
- Allow toggling tracks on/off for composition

**REQ-4.2**: Track management
- Add/remove tracks (up to 5 tracks)
- Rename tracks (Video, Webcam, Music, etc.)
- Toggle mute/solo per track
- Adjust opacity per track (for blending effects)

**REQ-4.3**: Clip positioning on tracks
- Drag clips vertically to different tracks
- Clips can overlap horizontally (by time)
- Support offset timing (clip B starts at 5 seconds into clip A)

**REQ-4.4**: Technical rendering
- During export, use FFmpeg filter_complex to compose multiple tracks:
  ```bash
  ffmpeg -i track1.mp4 -i track2.mp4 \
    -filter_complex "[0:v]scale=1920:1080[v1]; [1:v]scale=960:540[v2]; [v1][v2]overlay=960:540[outv]" \
    output.mp4
  ```

**Testing Gate**:
- Happy Path: Add clip to Video track → Add webcam to Overlay track → Export → both layers visible
- Edge Case: Overlay clip extends beyond main clip → transparency handled
- Error Handling: Delete track with clips → confirm action or move clips to another track

---

### Feature 5: Advanced Trim & Split
**STATUS: ✅ REQUIRED**

**REQ-5.1**: Split clip at playhead
- Position playhead within clip
- Click "Split" button or press shortcut (Ctrl+X / Cmd+X)
- Clip divides into two segments (before/after playhead)
- Both segments inherit properties (trim points, effects) if applicable

**REQ-5.2**: Enhanced trim UI
- Show in/out point timecode in tooltip (e.g., "00:10.5 - 00:45.2")
- Frame-accurate indicator showing frame count
- Snap-to-grid option (snap every 1sec, 0.5sec, or frame-precise)

**REQ-5.3**: Snap behavior
- Snap-to-clip-edges: Auto-align clip edges when dragging within 10px
- Snap-to-grid: Align to configurable grid (1sec, 500ms, etc.)
- Visual snap indicators (highlight when aligned)
- Toggle snap on/off via checkbox or shortcut

**Testing Gate**:
- Happy Path: Place playhead at 0:30 → Split → creates two clips (0:00-0:30 and 0:30-1:00)
- Edge Case: Split near start/end → minimal segment (1 frame) created
- Error Handling: Try to split before any clips added → show message "Add clips to timeline first"

---

## Phase 6: Advanced Export & Effects

### Feature 6: Advanced Export Options
**STATUS: ✅ REQUIRED**

**REQ-6.1**: Resolution selection
- Preset options: 720p (1280x720), 1080p (1920x1080), 4K (3840x2160 - if hardware capable)
- Custom resolution input
- Auto-detect highest source resolution (max 1080p for MVP)

**REQ-6.2**: Format & codec options
- Container: MP4 (primary), MOV (secondary)
- Video codec: H.264 (primary), H.265/HEVC (if supported)
- Bitrate: Low (2Mbps), Medium (5Mbps), High (10Mbps), Custom
- Frame rate: 24fps, 30fps, 60fps (match source or custom)

**REQ-6.3**: Platform export presets
- YouTube: 1080p@30fps, 12Mbps, MP4
- Instagram: 1080x1350 (vertical), 5Mbps, MP4
- TikTok: 1080x1920 (vertical), 5Mbps, MP4
- Twitter: 720p, 5Mbps, MP4
- Custom preset creation

**REQ-6.4**: Export file organization
- Option to save to project folder (create `exports/` subdirectory)
- Auto-organize by date: `exports/2025-10-28/`
- Batch export (multiple timelines with different presets)

**Testing Gate**:
- Happy Path: Select "YouTube" preset → export → video at correct resolution/bitrate
- Edge Case: Select 4K but source is 720p → upscale or warn user
- Error Handling: Unsupported resolution selected → show compatibility warning

---

### Feature 7: Audio Controls
**STATUS: ⚡ STRETCH GOAL**

**REQ-7.1**: Per-track audio adjustment
- Volume slider per track (-12dB to +12dB)
- Mute/unmute toggle
- Solo button (isolate single track)

**REQ-7.2**: Audio mixing
- Show waveform preview (optional, for advanced users)
- Real-time audio level monitoring during playback
- Pan control (left/right balance)

**REQ-7.3**: Audio effects
- Fade in/fade out (linear, exponential, custom curve)
- Normalize audio level (auto-adjust to -3dB)
- Audio sync correction (if sync drift detected)

**REQ-7.4**: Technical implementation
- FFmpeg audio filters:
  ```bash
  ffmpeg -i input.mp4 \
    -af "afade=t=in:st=0:d=1,afade=t=out:st=59:d=1,aformat=channel_layouts=mono" \
    output.mp4
  ```

**Testing Gate**:
- Happy Path: Set track volume to 50% → export → listen to output at correct volume
- Edge Case: Mute all audio → export → verify silent (no audio track)
- Error Handling: Fade duration > clip duration → auto-adjust or warn user

---

### Feature 8: Video Filters & Effects
**STATUS: ⚡ STRETCH GOAL**

**REQ-8.1**: Basic filters
- Brightness (±100%)
- Contrast (±100%)
- Saturation (±100%)
- Hue shift (0-360°)
- Grayscale toggle
- Blur (0-50px radius)

**REQ-8.2**: Filter application
- Apply to clip (single clip filter)
- Apply to track (affects all clips in track)
- Blend mode: Normal, Multiply, Screen, Overlay, etc.
- Opacity: 0-100% (layer transparency)

**REQ-8.3**: Animated filters
- Keyframe support (optional for MVP+1)
- Filter fade in/out during clip duration
- Preset animations (e.g., fade-to-black, zoom-blur)

**REQ-8.4**: Technical implementation
- FFmpeg filtergraph:
  ```bash
  ffmpeg -i input.mp4 \
    -vf "eq=brightness=0.2:contrast=1.5:saturation=1.2" \
    output.mp4
  ```

**Testing Gate**:
- Happy Path: Apply brightness filter (+50%) to clip → export → verify brightness in output
- Edge Case: Apply multiple filters → order matters, stack correctly
- Error Handling: Invalid filter values → clamp to valid range

---

### Feature 9: Transitions
**STATUS: ⚡ STRETCH GOAL**

**REQ-9.1**: Transition types
- Fade (fade to black, 0.5-2 seconds)
- Slide (left, right, up, down, 0.5-2 seconds)
- Dissolve (crossfade between clips, 0.5-2 seconds)
- Wipe (reveal next clip with animated border)

**REQ-9.2**: Transition application
- Drag transition icon to clip boundary
- Set duration (default 1 second)
- Preview transition before export
- Apply same transition to all clip boundaries (batch)

**REQ-9.3**: Technical implementation
- FFmpeg filter_complex for transitions:
  ```bash
  ffmpeg -i clip1.mp4 -i clip2.mp4 \
    -filter_complex "[0:v]trim=0:9.5[v0];[1:v]trim=0.5[v1];[v0][v1]xfade=transition=fade:duration=1:offset=9.5[outv]" \
    output.mp4
  ```

**Testing Gate**:
- Happy Path: Add fade transition between two clips (1sec) → export → transition visible and smooth
- Edge Case: Transition duration > remaining clip time → truncate or warn
- Error Handling: Apply transition to single clip → show message "Need at least 2 clips"

---

### Feature 10: Text Overlays
**STATUS: ⚡ STRETCH GOAL**

**REQ-10.1**: Text creation & editing
- Add text via menu: Insert → Text
- Text properties panel: Font, size, color, bold/italic, alignment
- Supported fonts: System fonts + common web fonts (Arial, Helvetica, etc.)
- Max text length: 500 characters

**REQ-10.2**: Text positioning & animation
- Drag text on preview (position on canvas)
- X/Y coordinate input (pixel precision)
- Font size: 12-200pt
- Opacity: 0-100%
- Background box (optional with padding/border-radius)

**REQ-10.3**: Text animations
- Fade in/out
- Slide in/out (from edge)
- Type-on effect (character-by-character)
- Keyframe support (optional)

**REQ-10.4**: Technical implementation
- Use FFmpeg drawtext filter:
  ```bash
  ffmpeg -i input.mp4 \
    -vf "drawtext=fontfile=/path/to/font.ttf:text='Hello':x=50:y=50:fontsize=40:fontcolor=white" \
    output.mp4
  ```

**Testing Gate**:
- Happy Path: Add "Intro" text at 00:00, "Outro" at end → export → text visible and properly positioned
- Edge Case: Very long text → text wraps or truncates based on space
- Error Handling: Missing font file → fall back to system default

---

## Phase 7: Keyboard Shortcuts & Polish

### Feature 11: Keyboard Shortcuts
**STATUS: ⚡ STRETCH GOAL**

**REQ-11.1**: Playback controls
- Space: Play/Pause
- J: Rewind 1 second
- K: Forward 1 second
- L: Forward 5 seconds
- Shift+L: Fast-forward 10 seconds

**REQ-11.2**: Editing shortcuts
- Cmd/Ctrl+X: Split clip at playhead
- Cmd/Ctrl+D: Delete selected clip
- Cmd/Ctrl+Z: Undo
- Cmd/Ctrl+Shift+Z: Redo
- Cmd/Ctrl+A: Select all clips
- Delete: Remove selected clip

**REQ-11.3**: App shortcuts
- Cmd/Ctrl+E: Open export dialog
- Cmd/Ctrl+I: Import files
- Cmd/Ctrl+N: New project
- Cmd/Ctrl+O: Open project (post-MVP)
- Cmd/Ctrl+S: Save session (already auto-save)
- Cmd/Ctrl+,: Open preferences

**REQ-11.4**: Customization
- Allow users to remap shortcuts via Preferences panel
- Display shortcut hints in tooltips
- Show keyboard shortcuts cheat sheet (Help menu)

**Testing Gate**:
- Happy Path: Press Space to play → press Space again to pause → J/K/L navigate correctly
- Edge Case: Shortcut conflicts with system shortcuts → warn or disable conflicting
- Error Handling: Unmapped key pressed → no action (silent)

---

### Feature 12: Undo/Redo System
**STATUS: ⚡ STRETCH GOAL**

**REQ-12.1**: Action tracking
- Track all editable actions: clip add, delete, trim, move, split, effects applied, text added
- Maintain undo stack (limit to 100 actions or 500MB)
- Maintain redo stack (clear when new action performed after undo)

**REQ-12.2**: Undo/Redo UI
- Undo button in toolbar (disabled when stack empty)
- Redo button in toolbar (disabled when redo stack empty)
- Keyboard shortcuts: Cmd/Ctrl+Z (undo), Cmd/Ctrl+Shift+Z (redo)
- Show action name on hover (e.g., "Undo: Trim Clip")

**REQ-12.3**: State management
- Store action history in React state
- On undo: Pop from undo stack, push to redo stack
- On redo: Pop from redo stack, push to undo stack
- Serialize timeline state for each action

**REQ-12.4**: Edge cases
- Undo past initial state → disable (no-op)
- Undo/redo with session restore → preserve history if possible
- Export clears redo stack (optional: keep history after export)

**Testing Gate**:
- Happy Path: Add 5 clips → delete 2 → undo → clips return → redo → clips deleted again
- Edge Case: Undo/redo 50 times → performance remains acceptable
- Error Handling: Undo with corrupted state → show warning, revert to last valid state

---

### Feature 13: Auto-Save & Project State
**STATUS: ⚡ STRETCH GOAL**

**REQ-13.1**: Enhanced auto-save
- Save state every 30 seconds (configurable: 10-120 seconds)
- Save on every action (optional, higher frequency)
- Location: `app.getPath('userData')/autosave.json`
- Include: clips, timeline, trim points, effects, text, zoom level

**REQ-13.2**: Recovery on crash
- Detect if app crashed (check for incomplete autosave)
- Show recovery dialog: "Recover session?" or "Start fresh?"
- If recovered: restore full state including undo history

**REQ-13.3**: Manual project save (Post-MVP)
- Save project as `.klippy` file (JSON format)
- Load project with Cmd/Ctrl+O
- Project includes: clips, timeline layout, effects, text, user notes

**REQ-13.4**: Session clear
- Option in Preferences: "Clear session on quit"
- Option in Preferences: "Auto-delete autosave after 7 days"

**Testing Gate**:
- Happy Path: Work for 5 minutes → kill app → relaunch → state recovered
- Edge Case: Autosave file corrupted → show error, offer start fresh
- Error Handling: Disk full → warn user, attempt to clean up old autosaves

---

## Feature Status Summary

| Feature # | Feature Name | Phase | Status | Priority |
|-----------|--------------|-------|--------|----------|
| 1 | Screen Recording | 5 | ✅ | REQUIRED |
| 2 | Webcam Recording | 5 | ✅ | REQUIRED |
| 3 | Picture-in-Picture (Screen + Webcam) | 5 | ✅ | REQUIRED |
| 4 | Advanced Timeline (Multiple Tracks) | 5 | ✅ | REQUIRED |
| 5 | Split & Advanced Trim | 5 | ✅ | REQUIRED |
| 6 | Advanced Export Options (Resolution, Bitrate) | 6 | ✅ | REQUIRED |
| 7 | Audio Controls (Volume, Fade, Pan) | 6 | ⚡ | STRETCH |
| 8 | Video Filters & Effects | 6 | ⚡ | STRETCH |
| 9 | Transitions (Fade, Slide, Dissolve) | 6 | ⚡ | STRETCH |
| 10 | Text Overlays with Animations | 6 | ⚡ | STRETCH |
| 11 | Keyboard Shortcuts | 7 | ⚡ | STRETCH |
| 12 | Undo/Redo System | 7 | ⚡ | STRETCH |
| 13 | Enhanced Auto-Save & Project Recovery | 7 | ⚡ | STRETCH |

---

## Performance & Quality Targets

### Performance Requirements

**PERF-1**: Timeline responsiveness
- 20+ clips: <100ms response time for drag/drop
- Zoom/scroll: 60fps smooth
- Track addition/removal: <50ms

**PERF-2**: Recording quality
- Screen capture: 1080p@30fps smooth (no frame drops)
- Webcam: 720p@30fps smooth
- Audio: 16-bit 48kHz stereo

**PERF-3**: Effects rendering
- Filter preview: <200ms update time
- Multiple filters stacked: <500ms total
- Text rendering: Real-time (no lag)

**PERF-4**: Transitions & animations
- Smooth playback: 30fps minimum during preview
- Export with transitions: 1-2 min for 2min video (depends on hardware)

**PERF-5**: Memory with extended session
- Baseline: ~250MB (Electron + Chromium)
- With 10 clips + effects + undo stack: <1.5GB
- No continuous growth after 1 hour editing

---

### Quality Targets

**VIDEO QUALITY**:
- Recording: H.264, variable bitrate (5-10Mbps)
- Export: User-selectable (Low 2Mbps, Medium 5Mbps, High 10Mbps)
- Format preservation: Source resolution/aspect ratio maintained unless user overrides

**AUDIO QUALITY**:
- Recording: AAC 128kbps, 48kHz stereo
- Mixing: No clipping, normalized levels
- Fade transitions: Smooth, no audio pops

---

## Testing Strategy

### Recording Feature Tests

**Test: Screen Recording**
1. Launch Klippy
2. Click "Record Screen" → select primary screen
3. Record 30-second activity (open browser, type, click windows)
4. Stop recording → verify video appears in library
5. Click to play → verify audio and video sync

**Test: Webcam Recording**
1. Click "Record Webcam" → allow camera permission
2. See live preview in record dialog
3. Record 20 seconds
4. Stop → verify in library with thumbnail
5. Play → verify audio/video sync

**Test: PiP Recording**
1. Click "Record Screen + Webcam"
2. Record 15 seconds → stop
3. Add to timeline
4. Export → verify output shows screen main + webcam overlay

### Timeline & Effects Tests

**Test: Multiple Tracks**
1. Add 2 clips to Video track
2. Add 1 clip to Overlay track (offset by 5 sec)
3. Play → verify both tracks play correctly
4. Export → output shows both layers

**Test: Transitions**
1. Add 3 clips to timeline
2. Add fade transition (1 sec) between each
3. Play → verify transitions smooth
4. Export → output has transitions

**Test: Text Overlay**
1. Add text "Introduction" at 0:00
2. Position at center
3. Set fade-in animation (2 sec)
4. Export → text visible and animates correctly

---

## Technical Architecture Additions

### IPC APIs (Electron Main Process)

#### Screen Recording
```javascript
ipcMain.handle('start-screen-recording', (event, { sourceId, audioEnabled }) => {
  // Start recording with selected source
  // Return recording object or stream
});

ipcMain.handle('stop-screen-recording', (event) => {
  // Stop and save to temp file
  // Return file path
});
```

#### Webcam Recording
```javascript
ipcMain.handle('get-video-sources', (event) => {
  // Return available cameras/screens via desktopCapturer
});

ipcMain.handle('start-webcam-recording', (event, { deviceId, audioEnabled }) => {
  // Start webcam capture
});
```

#### Export with Presets
```javascript
ipcMain.handle('export-with-preset', (event, { timeline, preset, outputPath }) => {
  // Build FFmpeg command with preset options
  // Execute export
  // Return progress updates
});
```

### Component Updates Required

- **RecordingPanel.tsx**: New component for recording UI
- **TimelineTrack.tsx**: Update to support multiple tracks
- **ExportDialog.tsx**: Add preset selection, resolution options
- **EffectsPanel.tsx**: New panel for filters, transitions, text
- **UndoRedoProvider.tsx**: Context for undo/redo state
- **KeyboardShortcutsManager.ts**: Handle key bindings

---

## Definition of Done

For each feature:

- ✅ Implementation complete (code compiles, no errors)
- ✅ All acceptance tests pass (happy path, edge cases, error handling)
- ✅ Performance benchmarks met (response time, FPS targets)
- ✅ No memory leaks (tested with extended session)
- ✅ Cross-platform tested (Mac + Windows)
- ✅ UI/UX follows design system
- ✅ Error handling with user-friendly messages
- ✅ Code reviewed and approved
- ✅ Documentation updated (if needed)
- ✅ Demo video included (for submission)

---

## Success Criteria

### REQUIRED Features (Phase 5 + Phase 6) - MUST COMPLETE
✅ **Screen Recording**: Works on Mac/Windows, records at native resolution with audio
✅ **Webcam Recording**: Records camera feed with synchronized microphone audio
✅ **PiP Recording**: Simultaneous screen + webcam capture produces composited output
✅ **Multiple Tracks**: Timeline supports 2-5 tracks with independent clip positioning
✅ **Split & Advanced Trim**: Split at playhead, snap-to-grid, frame-precise editing
✅ **Advanced Export**: User can select resolution (720p, 1080p), bitrate, and format
✅ **Audio Capture**: Microphone and system audio recorded without sync issues

**Submission Requirement**: All 7 REQUIRED features must be working and fully tested before final submission.

### STRETCH GOALS (Phase 6-7) - COMPLETE IF TIME PERMITS
⚡ **Audio Controls**: Per-track volume, mute, solo, fade in/out
⚡ **Filters & Effects**: Brightness, contrast, saturation, blur apply to clips in export
⚡ **Transitions**: Fade, slide, dissolve between clips smooth in preview and export
⚡ **Text Overlays**: Text renders correctly with fonts, colors, positioning, animations
⚡ **Keyboard Shortcuts**: Space for play/pause, J/K/L for scrubbing, Cmd+X for split
⚡ **Undo/Redo**: Action history with 50+ action stack works reliably
⚡ **Enhanced Auto-Save**: Project recovery after crash, per-track settings saved

**Note**: Stretch goals enhance the product but are NOT blockers for full submission. Implement only if time permits after all REQUIRED features are complete and tested.

---

## Appendix: Glossary

- **PiP**: Picture-in-Picture (overlay composition)
- **Filter**: Non-destructive effect (brightness, contrast, etc.)
- **Transition**: Animated blend between two clips
- **Track**: Horizontal layer in timeline (can overlap with other tracks)
- **Keyframe**: Specific point where animation/effect changes
- **Bitrate**: Data rate of video (higher = better quality, larger file)
- **Codec**: Algorithm for compressing video (H.264, H.265)
- **FFmpeg**: Command-line tool for video processing

---

**Status**: Ready for Phase 5 Development
**Next**: Prioritize recording features, then advanced editing, then effects
