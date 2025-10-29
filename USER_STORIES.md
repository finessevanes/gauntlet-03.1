# Klippy - User Stories & Feature Breakdown

**Document Version**: 1.0
**Date**: October 28, 2025
**Product**: Klippy Desktop Video Editor (Post-MVP Features)
**Total Stories**: 13 (7 REQUIRED + 6 STRETCH GOALS)

---

## Story Mapping

| Story # | Feature | Phase | Status | Complexity | Dependencies |
|---------|---------|-------|--------|-----------|--------------|
| S9 | Screen Recording | 5 | ✅ REQUIRED | Complex | MVP Complete |
| S10 | Webcam Recording | 5 | ✅ REQUIRED | Complex | MVP Complete |
| S11 | Picture-in-Picture Recording | 5 | ✅ REQUIRED | Complex | S9, S10 |
| S12 | Advanced Timeline (Multiple Tracks) | 5 | ✅ REQUIRED | Complex | MVP Complete |
| S13 | Split & Advanced Trim | 5 | ✅ REQUIRED | Medium | MVP Timeline |
| S14 | Advanced Export Options | 6 | ✅ REQUIRED | Medium | MVP Export |
| S15 | Audio Capture & Controls | 6 | ✅ REQUIRED | Medium | S9, S10 |
| S16 | Audio Effects (Fade, Normalize, Pan) | 6 | ⚡ STRETCH | Medium | S15 |
| S17 | Video Filters & Effects | 6 | ⚡ STRETCH | Complex | MVP Timeline |
| S18 | Transitions Between Clips | 6 | ⚡ STRETCH | Complex | S17 |
| S19 | Text Overlays with Animations | 6 | ⚡ STRETCH | Complex | MVP Timeline |
| S20 | Keyboard Shortcuts | 7 | ⚡ STRETCH | Simple | MVP Complete |
| S21 | Undo/Redo System | 7 | ⚡ STRETCH | Complex | MVP Complete |
| S22 | Enhanced Auto-Save & Project Recovery | 7 | ⚡ STRETCH | Medium | MVP Auto-Save |

---

## REQUIRED FEATURES (Phase 5-6)

### Story S9: Screen Recording

**As a** content creator or educator
**I want** to record my screen with audio capture
**So that** I can create tutorials, presentations, and screen-based content without leaving Klippy

**User Value**: Eliminates need for external screen recording tools; enables one-app workflow for tutorial creation.

**Acceptance Criteria**:

- [ ] **AC-1**: User can click "Record Screen" button in main toolbar
- [ ] **AC-2**: Dialog displays list of available screens and windows (using desktopCapturer API)
- [ ] **AC-3**: User can select specific screen or window to record
- [ ] **AC-4**: Recording indicator (red dot + timer) appears when actively recording
- [ ] **AC-5**: Microphone permission requested before recording starts
- [ ] **AC-6**: Audio and video remain synchronized during 30-second recording
- [ ] **AC-7**: Stop button halts recording and saves file to temp location
- [ ] **AC-8**: Recorded video automatically added to Library with playable thumbnail
- [ ] **AC-9**: User can rename recording before adding to timeline
- [ ] **AC-10**: Screen recording works on both macOS and Windows (best-effort)
- [ ] **AC-11**: Handles window closure during recording (video still saves)
- [ ] **AC-12**: Error dialog shown if microphone permission denied; screen-only recording allowed

**Definition of Done**:
- Implementation complete without crashes
- Happy path tested (30sec screen recording → library → playable)
- Edge cases tested (window closed, permission denied)
- Performance: Recording at native resolution without frame drops
- Cross-platform tested (Mac + Windows)

**Complexity**: Complex (requires Electron desktopCapturer API, WebRTC integration, file handling)

**Phase**: 5 (Core Features)

**Priority**: ✅ REQUIRED

---

### Story S10: Webcam Recording

**As a** content creator doing face-on-camera content
**I want** to record my webcam with synchronized microphone audio
**So that** I can create vlogs, testimonials, and talking-head videos within Klippy

**User Value**: Built-in camera recording removes dependency on separate camera recording software.

**Acceptance Criteria**:

- [ ] **AC-1**: User can click "Record Webcam" button in toolbar
- [ ] **AC-2**: Camera permission dialog appears (standard getUserMedia flow)
- [ ] **AC-3**: Live preview of camera feed displays before recording
- [ ] **AC-4**: If multiple cameras available, user can select specific camera
- [ ] **AC-5**: Start button initiates recording to temp file
- [ ] **AC-6**: Pause button available during recording (optional; required for MVP is stop only)
- [ ] **AC-7**: Stop button ends recording and saves to temp location
- [ ] **AC-8**: Recording automatically added to Library with thumbnail
- [ ] **AC-9**: Video plays back with correct resolution (720p or 1080p)
- [ ] **AC-10**: Audio captured from microphone is synchronized with video
- [ ] **AC-11**: Error message shown if camera already in use by another app
- [ ] **AC-12**: Error message shown if camera permission denied with recovery option

**Definition of Done**:
- Webcam recording functional on Mac and Windows
- Live preview smooth (30fps minimum)
- Audio/video sync verified in playback
- Handles camera permission denial gracefully
- No crashes during extended recording (tested 5+ minutes)

**Complexity**: Complex (WebRTC camera access, audio sync, permission handling)

**Phase**: 5 (Core Features)

**Priority**: ✅ REQUIRED

---

### Story S11: Picture-in-Picture Recording

**As a** educator or presenter
**I want** to simultaneously record my screen and webcam, compositing the webcam as an overlay
**So that** I can create engaging tutorials with both screen activity and my face visible in one video

**User Value**: Enables PiP-style content production without external compositing software; professional presentation capability.

**Acceptance Criteria**:

- [ ] **AC-1**: User can click "Record Screen + Webcam (PiP)" option
- [ ] **AC-2**: Both screen and webcam capture occur simultaneously
- [ ] **AC-3**: Webcam preview overlay appears in recording dialog
- [ ] **AC-4**: User can configure webcam position: TL, TR, BL, BR
- [ ] **AC-5**: User can select webcam size: Small (20%), Medium (30%), Large (40%)
- [ ] **AC-6**: Optional webcam border styling (rounded corners, shadow)
- [ ] **AC-7**: Both microphone tracks mixed or selectable as primary
- [ ] **AC-8**: Stop recording saves composite video to temp location
- [ ] **AC-9**: Composite video plays correctly (screen + webcam overlay visible)
- [ ] **AC-10**: Audio from both sources properly synchronized
- [ ] **AC-11**: Export with PiP uses FFmpeg overlay filter correctly
- [ ] **AC-12**: Handles case where one source fails (fall back to screen-only)

**Definition of Done**:
- PiP recording produces valid MP4 with both layers visible
- Tested with different aspect ratios (no distortion)
- Overlay positioning accurate and customizable
- Audio mixing clean and balanced
- No sync drift during playback
- Cross-platform compatible (Mac + Windows)

**Complexity**: Complex (simultaneous WebRTC + desktopCapturer, FFmpeg overlay, sync management)

**Phase**: 5 (Core Features)

**Priority**: ✅ REQUIRED

**Depends On**: S9 (Screen Recording), S10 (Webcam Recording)

---

### Story S12: Advanced Timeline (Multiple Tracks)

**As a** video editor
**I want** to arrange clips across multiple independent tracks (e.g., main video + overlay)
**So that** I can create layered compositions with picture-in-picture, graphics overlays, and split-screen effects

**User Value**: Multi-track timeline enables professional-grade compositing; differentiates from simple linear editors.

**Acceptance Criteria**:

- [ ] **AC-1**: Timeline displays minimum 2 tracks: "Video" and "Overlay"
- [ ] **AC-2**: User can add/remove additional tracks (up to 5 max)
- [ ] **AC-3**: Each track can be renamed (e.g., "Screen", "Webcam", "Graphics")
- [ ] **AC-4**: Clips dragged to different tracks position independently
- [ ] **AC-5**: Clips on different tracks can overlap horizontally (by time)
- [ ] **AC-6**: Vertical track arrangement preserved: Track 1 (bottom) → Track N (top)
- [ ] **AC-7**: Each track can be toggled on/off (affects export composition)
- [ ] **AC-8**: Each track can be muted independently (audio disabled)
- [ ] **AC-9**: Each track shows solo button (isolate audio from that track)
- [ ] **AC-10**: Track opacity adjustable per track (0-100%)
- [ ] **AC-11**: Zoom slider affects all tracks simultaneously
- [ ] **AC-12**: Timeline UI remains responsive with 10+ clips across 4 tracks
- [ ] **AC-13**: Export correctly composes all enabled tracks using FFmpeg

**Definition of Done**:
- Multi-track timeline renders correctly without visual artifacts
- Clips reorder/delete smoothly across tracks
- Export produces correct layered output (verified frame-by-frame)
- Performance: <100ms response time for drag operations
- No memory leaks with extended editing (4+ tracks, 20+ clips)

**Complexity**: Complex (state management, FFmpeg composition, UI responsiveness)

**Phase**: 5 (Core Features)

**Priority**: ✅ REQUIRED

---

### Story S13: Split & Advanced Trim

**As a** video editor
**I want** to split clips at any point on the timeline and trim with frame-precision
**So that** I can create tight edits without importing the same clip multiple times

**User Value**: Reduces friction in fine-editing workflow; enables creative jump-cuts and precise pacing.

**Acceptance Criteria**:

- [ ] **AC-1**: User can position playhead within a clip on timeline
- [ ] **AC-2**: "Split" button or keyboard shortcut (Cmd/Ctrl+X) available
- [ ] **AC-3**: Split divides clip into two segments (before/after playhead)
- [ ] **AC-4**: Both segments display correctly with updated durations
- [ ] **AC-5**: Both segments inherit any effects/filters applied (if applicable)
- [ ] **AC-6**: Trim UI shows in/out point timecodes (e.g., "00:10.5 - 00:45.2")
- [ ] **AC-7**: Frame count displayed for frame-precise trimming
- [ ] **AC-8**: Snap-to-grid option available (1sec, 500ms, or frame-precise)
- [ ] **AC-9**: Snap-to-clip-edges automatically aligns adjacent clips
- [ ] **AC-10**: Visual feedback (highlight) when snap point reached
- [ ] **AC-11**: Toggle snap on/off via checkbox or shortcut
- [ ] **AC-12**: Split near start/end creates minimal segment (1 frame) without error
- [ ] **AC-13**: Cannot split before any clips added (error message shown)

**Definition of Done**:
- Split operation produces two independent clip objects in state
- Trim points calculated correctly; export duration matches intended
- Snap-to-grid aligns within 1-3 pixels of target
- Performance: <50ms response for trim drag
- Handles edge cases (very short segments, split near boundaries)

**Complexity**: Medium (state management, timecode math, UI feedback)

**Phase**: 5 (Core Features)

**Priority**: ✅ REQUIRED

---

### Story S14: Advanced Export Options

**As a** content creator
**I want** to export my video at different resolutions and with preset configurations for different platforms
**So that** I can optimize file size and dimensions for YouTube, TikTok, Instagram, or custom use cases

**User Value**: Enables one-click platform optimization; eliminates manual codec/bitrate selection.

**Acceptance Criteria**:

- [ ] **AC-1**: Export dialog displays resolution presets: 720p, 1080p, 4K (if hardware capable)
- [ ] **AC-2**: Custom resolution input available for non-standard dimensions
- [ ] **AC-3**: Bitrate presets: Low (2Mbps), Medium (5Mbps), High (10Mbps), Custom
- [ ] **AC-4**: Frame rate options: 24fps, 30fps, 60fps
- [ ] **AC-5**: Platform presets available: YouTube, Instagram, TikTok, Twitter, Custom
- [ ] **AC-6**: Each preset auto-fills resolution, bitrate, and format
- [ ] **AC-7**: YouTube preset: 1080p@30fps, 12Mbps, H.264, MP4
- [ ] **AC-8**: Instagram preset: 1080x1350 (vertical), 5Mbps
- [ ] **AC-9**: TikTok preset: 1080x1920 (vertical), 5Mbps
- [ ] **AC-10**: User can create/save custom export presets
- [ ] **AC-11**: Unsupported resolution shows warning (e.g., 4K requested but source is 720p)
- [ ] **AC-12**: Export file organized to `exports/YYYY-MM-DD/` folder structure
- [ ] **AC-13**: Batch export available (export multiple timelines with different presets)

**Definition of Done**:
- All preset exports produce files at correct resolution/bitrate (verified with ffprobe)
- No upscaling artifacts on lower-res source → higher-res output
- Preset saved/loaded correctly from user preferences
- Export completes without crashes for all presets
- File organization matches spec

**Complexity**: Medium (preset system, FFmpeg command building, UI)

**Phase**: 6 (Polish Features)

**Priority**: ✅ REQUIRED

---

### Story S15: Audio Capture & Controls

**As a** video creator
**I want** to capture audio from microphone and system sources, and adjust per-track volume/muting during editing
**So that** I can balance audio levels between recorded sources and create professional-sounding final products

**User Value**: Eliminates post-production audio editing in external tools; in-app audio management streamlines workflow.

**Acceptance Criteria**:

- [ ] **AC-1**: Microphone audio captured during screen/webcam recording
- [ ] **AC-2**: System audio (computer speaker output) capturable separately (requires OS permission)
- [ ] **AC-3**: Per-track volume slider: -12dB to +12dB adjustable
- [ ] **AC-4**: Mute/unmute toggle per track
- [ ] **AC-5**: Solo button isolates audio from single track during playback/export
- [ ] **AC-6**: Audio level meter shows real-time levels during recording
- [ ] **AC-7**: Audio level meter shows real-time levels during playback
- [ ] **AC-8**: Waveform preview visible in advanced view (optional enhancement)
- [ ] **AC-9**: Pan control (left/right balance) available per track
- [ ] **AC-10**: Volume changes preview correctly in real-time playback
- [ ] **AC-11**: Muted tracks produce no audio in final export
- [ ] **AC-12**: Solo mode exports only selected track's audio
- [ ] **AC-13**: Multiple audio tracks mixed correctly without clipping

**Definition of Done**:
- Audio adjustments audible in export (verified by listening)
- Volume slider values convert to FFmpeg -b:a parameter correctly
- No audio sync drift during playback with volume changes
- Peak audio levels not exceeded (no digital clipping)
- Handles edge case: all tracks muted (silent export)

**Complexity**: Medium (WebRTC audio handling, FFmpeg audio filters, UI)

**Phase**: 6 (Polish Features)

**Priority**: ✅ REQUIRED

---

## STRETCH GOALS (Phase 6-7)

### Story S16: Audio Effects (Fade, Normalize, Pan)

**As a** audio engineer or careful editor
**I want** to apply fade in/out and normalize audio levels on individual tracks
**So that** I can create smooth audio transitions and prevent audio level inconsistencies

**User Value**: Professional audio polish without third-party tools; improves perceived production quality.

**Acceptance Criteria**:

- [ ] **AC-1**: Fade in effect available: linear, exponential curve options
- [ ] **AC-2**: Fade out effect available with duration customization (0.5-5 seconds)
- [ ] **AC-3**: Normalize button auto-adjusts track to -3dB target level
- [ ] **AC-4**: Pan control allows left/right balance adjustment
- [ ] **AC-5**: Audio fade visualized in timeline (gradient overlay on track)
- [ ] **AC-6**: Fade duration editable by dragging on timeline
- [ ] **AC-7**: Export applies fade effects correctly
- [ ] **AC-8**: Normalize recalculated correctly after trim or clip adjustments
- [ ] **AC-9**: Multiple effects stackable per track (fade + normalize + pan)
- [ ] **AC-10**: Preview audio with effects in real-time

**Definition of Done**:
- Fade audible in export (smooth amplitude ramp)
- Normalize prevents clipping and equalizes levels
- Effects don't cause sync drift
- Performance: <200ms update for effect preview

**Complexity**: Medium (FFmpeg audio filters, preview updates)

**Phase**: 6 (Polish Features)

**Priority**: ⚡ STRETCH GOAL

**Depends On**: S15 (Audio Capture & Controls)

---

### Story S17: Video Filters & Effects

**As a** video creator
**I want** to apply real-time filters (brightness, contrast, saturation, blur, grayscale) to individual clips or entire tracks
**So that** I can create consistent looks, correct color issues, and achieve creative effects without external software

**User Value**: In-app color correction and creative effects increase production value; eliminates extra software.

**Acceptance Criteria**:

- [ ] **AC-1**: Filter panel accessible for selected clip or track
- [ ] **AC-2**: Brightness filter: -100 to +100 (adjustable slider)
- [ ] **AC-3**: Contrast filter: -100 to +100
- [ ] **AC-4**: Saturation filter: -100 to +100
- [ ] **AC-5**: Hue shift filter: 0-360° color wheel
- [ ] **AC-6**: Grayscale toggle (black & white conversion)
- [ ] **AC-7**: Blur filter: 0-50px radius
- [ ] **AC-8**: Real-time preview updates in player as filter adjusted
- [ ] **AC-9**: Multiple filters stackable per clip
- [ ] **AC-10**: Opacity control per filter (0-100%)
- [ ] **AC-11**: Blend mode selection (Normal, Multiply, Screen, Overlay, etc.)
- [ ] **AC-12**: Filters apply to clip in isolation (non-destructive)
- [ ] **AC-13**: Filters baked into export using FFmpeg filter_complex

**Definition of Done**:
- Each filter applies correctly in FFmpeg (verified visually)
- Filter preview <200ms update time
- Export filters match preview appearance
- No video corruption or artifacts
- Stacking 3+ filters maintains performance (30fps+ playback)

**Complexity**: Complex (FFmpeg filter chains, real-time preview, state management)

**Phase**: 6 (Polish Features)

**Priority**: ⚡ STRETCH GOAL

---

### Story S18: Transitions Between Clips

**As a** video editor
**I want** to apply smooth animated transitions (fade, slide, dissolve, wipe) between clips on the timeline
**So that** I can create professional-looking sequences without jarring jump cuts

**User Value**: Polished transitions elevate production quality; improves viewer experience.

**Acceptance Criteria**:

- [ ] **AC-1**: Transition effects available: Fade, Slide, Dissolve, Wipe
- [ ] **AC-2**: User can drag transition icon to clip boundary
- [ ] **AC-3**: Transition duration customizable: 0.5-2 seconds
- [ ] **AC-4**: Preview shows transition animation in player (smooth)
- [ ] **AC-5**: Fade transition: smooth alpha blend between clips
- [ ] **AC-6**: Slide transition: direction customizable (L, R, U, D)
- [ ] **AC-7**: Dissolve transition: crossfade effect
- [ ] **AC-8**: Wipe transition: animated border reveals next clip
- [ ] **AC-9**: Apply same transition to all clip boundaries (batch action)
- [ ] **AC-10**: Remove transition from clip boundary
- [ ] **AC-11**: Export renders transitions smoothly (no jank)
- [ ] **AC-12**: Transition duration cannot exceed remaining clip time (auto-truncate or warn)

**Definition of Done**:
- Each transition type renders correctly in FFmpeg
- Transition preview smooth (30fps minimum)
- Export with transitions matches preview
- No sync drift or audio artifacts during transition
- Handles edge case: transition on single clip (error message)

**Complexity**: Complex (FFmpeg xfade filter, preview sync, timeline UI)

**Phase**: 6 (Polish Features)

**Priority**: ⚡ STRETCH GOAL

**Depends On**: S17 (Video Filters & Effects)

---

### Story S19: Text Overlays with Animations

**As a** content creator
**I want** to add custom text overlays with animations (fade, slide, type-on) to my video timeline
**So that** I can add titles, captions, credits, and animated text elements for better engagement

**User Value**: In-app text capability reduces need for separate motion graphics software; enables creative storytelling.

**Acceptance Criteria**:

- [ ] **AC-1**: Insert → Text menu option available
- [ ] **AC-2**: Text input dialog with font, size, color, bold/italic, alignment
- [ ] **AC-3**: Supported fonts: System fonts + Arial, Helvetica, sans-serif web fonts
- [ ] **AC-4**: Font size: 12-200pt adjustable
- [ ] **AC-5**: Text color picker (RGB/Hex)
- [ ] **AC-6**: Drag text on preview canvas to position
- [ ] **AC-7**: X/Y coordinate input for pixel-perfect positioning
- [ ] **AC-8**: Opacity control: 0-100%
- [ ] **AC-9**: Optional background box with padding and border-radius
- [ ] **AC-10**: Animation types: Fade in/out, Slide in/out, Type-on effect
- [ ] **AC-11**: Animation duration customizable
- [ ] **AC-12**: Keyframe support for advanced animation (optional)
- [ ] **AC-13**: Max text length: 500 characters
- [ ] **AC-14**: Text preview shows in real-time player
- [ ] **AC-15**: Export renders text using FFmpeg drawtext filter
- [ ] **AC-16**: Missing font file falls back to system default

**Definition of Done**:
- Text renders correctly in export (readable, proper position/color)
- Animations play smoothly (30fps+ preview)
- Long text wraps or truncates based on canvas space
- Font files handled gracefully (no crashes on missing font)
- Tested with special characters and multi-line text

**Complexity**: Complex (FFmpeg drawtext, keyframe system, font handling)

**Phase**: 6 (Polish Features)

**Priority**: ⚡ STRETCH GOAL

---

### Story S20: Keyboard Shortcuts

**As a** power user
**I want** to use keyboard shortcuts for common editing actions (play/pause, navigation, split, delete)
**So that** I can work faster without reaching for the mouse constantly

**User Value**: Faster editing workflow; enables pro user efficiency.

**Acceptance Criteria**:

- [ ] **AC-1**: Space bar: Toggle play/pause
- [ ] **AC-2**: J key: Rewind 1 second
- [ ] **AC-3**: K key: Stop/pause (alternative to space)
- [ ] **AC-4**: L key: Forward 1 second
- [ ] **AC-5**: Shift+L: Fast-forward 10 seconds
- [ ] **AC-6**: Cmd/Ctrl+X: Split clip at playhead
- [ ] **AC-7**: Cmd/Ctrl+D: Delete selected clip
- [ ] **AC-8**: Cmd/Ctrl+Z: Undo last action
- [ ] **AC-9**: Cmd/Ctrl+Shift+Z: Redo
- [ ] **AC-10**: Cmd/Ctrl+A: Select all clips
- [ ] **AC-11**: Delete key: Remove selected clip
- [ ] **AC-12**: Cmd/Ctrl+E: Open export dialog
- [ ] **AC-13**: Cmd/Ctrl+I: Import files
- [ ] **AC-14**: Cmd/Ctrl+S: Save session (explicit save trigger)
- [ ] **AC-15**: Cmd/Ctrl+,: Open preferences
- [ ] **AC-16**: Keyboard shortcut cheat sheet in Help menu
- [ ] **AC-17**: User can remap shortcuts in Preferences
- [ ] **AC-18**: Tooltips show keyboard shortcuts for buttons

**Definition of Done**:
- All shortcuts respond correctly to key presses
- Shortcuts displayed in help documentation
- Platform-specific shortcuts (Cmd for Mac, Ctrl for Windows)
- No conflicts with system shortcuts
- Shortcut customization UI functional

**Complexity**: Simple (keyboard event handlers, shortcut remapping)

**Phase**: 7 (Keyboard Shortcuts & Polish)

**Priority**: ⚡ STRETCH GOAL

---

### Story S21: Undo/Redo System

**As a** editor making many adjustments
**I want** to undo and redo actions (clip moves, trims, effects, text additions)
**So that** I can experiment fearlessly and correct mistakes without redoing work

**User Value**: Risk-free editing; enables experimentation and rapid iteration.

**Acceptance Criteria**:

- [ ] **AC-1**: Cmd/Ctrl+Z triggers undo
- [ ] **AC-2**: Cmd/Ctrl+Shift+Z triggers redo
- [ ] **AC-3**: Undo button in toolbar (disabled when stack empty)
- [ ] **AC-4**: Redo button in toolbar (disabled when stack empty)
- [ ] **AC-5**: Undo/redo stack limited to 100 actions or 500MB
- [ ] **AC-6**: Tooltip on undo/redo button shows action being undone/redone
- [ ] **AC-7**: Tracked actions: clip add, delete, trim, reorder, split, effects applied, text added
- [ ] **AC-8**: Undo pops action from stack, pushes to redo stack
- [ ] **AC-9**: Redo pops from redo stack, pushes to undo stack
- [ ] **AC-10**: New action after undo clears redo stack
- [ ] **AC-11**: Undo past initial state disables (no-op)
- [ ] **AC-12**: Session restore preserves undo history (optional: clear on crash recovery)
- [ ] **AC-13**: Memory stable after 50+ undo/redo cycles

**Definition of Done**:
- Undo/redo works for 50+ actions without crashes
- Action descriptions accurate and helpful
- Stack memory not exceeded (500MB limit)
- Undo/redo responsive (<100ms)
- Handles corrupted state gracefully (revert to last valid state)

**Complexity**: Complex (state management, history stack, memory limits)

**Phase**: 7 (Keyboard Shortcuts & Polish)

**Priority**: ⚡ STRETCH GOAL

---

### Story S22: Enhanced Auto-Save & Project Recovery

**As a** editor
**I want** automatic saving of my project state and recovery from app crashes
**So that** I don't lose work if the app unexpectedly crashes or closes

**User Value**: Peace of mind; no data loss on crashes; faster recovery.

**Acceptance Criteria**:

- [ ] **AC-1**: Auto-save interval: every 30 seconds (configurable 10-120 seconds)
- [ ] **AC-2**: Save to `app.getPath('userData')/autosave.json`
- [ ] **AC-3**: Saved state includes: clips, timeline, trim points, effects, text, zoom level
- [ ] **AC-4**: On app launch, detect incomplete autosave (crash indicator)
- [ ] **AC-5**: Recovery dialog: "Recover previous session?" or "Start fresh?"
- [ ] **AC-6**: User selects Recover → full state restored including undo history
- [ ] **AC-7**: User selects Start Fresh → blank timeline
- [ ] **AC-8**: Manual project save as `.klippy` file (JSON format) - Post-MVP feature
- [ ] **AC-9**: Load project from `.klippy` file - Post-MVP feature
- [ ] **AC-10**: Project includes: clips, timeline layout, effects, text, user notes
- [ ] **AC-11**: Option in Preferences: "Clear session on quit"
- [ ] **AC-12**: Option in Preferences: "Auto-delete autosave after 7 days"
- [ ] **AC-13**: Handle corrupted autosave file gracefully (log error, offer start fresh)
- [ ] **AC-14**: Handle disk full: warn user, attempt cleanup of old autosaves

**Definition of Done**:
- App crash recovery tested: kill process → relaunch → state restored
- Autosave frequency accurate (verified via timestamps)
- Corrupted autosave handled without crash
- Recovery dialog UX clear and intuitive
- No data loss during save operation

**Complexity**: Medium (state serialization, file I/O, error handling)

**Phase**: 7 (Keyboard Shortcuts & Polish)

**Priority**: ⚡ STRETCH GOAL

**Depends On**: MVP Session State Persistence

---

## Dependency Graph

```
MVP Complete (S1-S8: Import, Timeline, Trim, Export, Session Persist)
  ├─→ S9 (Screen Recording) ─────────┐
  │                                   ├─→ S11 (PiP Recording)
  ├─→ S10 (Webcam Recording) ────────┘
  │
  ├─→ S12 (Advanced Timeline: Multi-Track)
  │     ├─→ S17 (Filters & Effects)
  │     │     ├─→ S18 (Transitions)
  │     │     └─→ S19 (Text Overlays)
  │     └─→ S13 (Split & Advanced Trim)
  │
  ├─→ S14 (Advanced Export Options)
  │
  ├─→ S15 (Audio Capture & Controls) ──→ S16 (Audio Effects: Fade, Normalize)
  │
  ├─→ S20 (Keyboard Shortcuts)
  │
  ├─→ S21 (Undo/Redo System)
  │
  └─→ S22 (Enhanced Auto-Save & Recovery) [depends on MVP S8]
```

---

## Implementation Order (Recommended)

### Phase 5 Build Order (REQUIRED - Core Features)
1. **S9**: Screen Recording (enables use case: record tutorials)
2. **S10**: Webcam Recording (enables use case: record vlogs)
3. **S11**: PiP Recording (combines S9+S10 for talking-head tutorials)
4. **S12**: Advanced Timeline (foundational for layering; blocks S17-S19)
5. **S13**: Split & Advanced Trim (completes timeline editing capabilities)
6. **S14**: Advanced Export (enables resolution/platform optimization)
7. **S15**: Audio Capture & Controls (required for recording features; enables audio adjustment)

### Phase 6 Build Order (STRETCH - Polish Features)
8. **S16**: Audio Effects (builds on S15; optional enhancement)
9. **S17**: Video Filters & Effects (builds on S12; required for S18-S19)
10. **S18**: Transitions (builds on S17; enhances clip sequencing)
11. **S19**: Text Overlays (builds on S12; adds title/caption capability)

### Phase 7 Build Order (STRETCH - QoL Features)
12. **S20**: Keyboard Shortcuts (pure QoL; can be done anytime)
13. **S21**: Undo/Redo (builds on MVP; enhances user confidence)
14. **S22**: Enhanced Auto-Save (builds on MVP S8; improves reliability)

---

## Phasing Summary

### Phase 5: Recording & Advanced Editing (REQUIRED)
- 5 Features (S9-S13 core + S15 audio)
- Delivery: Full recording and advanced timeline capability
- Target: Features that unlock new user workflows (screen recording, PiP, multi-track)

### Phase 6: Effects & Advanced Export (MIXED)
- 2 REQUIRED (S14, S15), 4 STRETCH (S16-S19)
- REQUIRED: Advanced export and audio controls (complete MVP → Full submission)
- STRETCH: Effects and transitions (polish)

### Phase 7: Polish & Reliability (STRETCH)
- 3 STRETCH (S20-S22)
- QoL: Keyboard shortcuts, undo/redo, crash recovery

---

## Notes for Caleb (Implementation Agent)

1. **Prioritize REQUIRED Features First**: S9-S15 block final submission. Get these done before stretching.

2. **Dependency Respect**: Don't start S11 until S9+S10 done. Don't start S18 until S17 done, etc.

3. **Testing Gates**: Each story includes specific testing criteria. Verify happy path, edge cases, and error handling before marking "done."

4. **Audio is Critical**: S15 (Audio Capture & Controls) is REQUIRED and needed by recording features. Prioritize audio handling and sync.

5. **Cross-Platform**: All features tested on Mac (primary) + Windows (best-effort).

6. **Performance Benchmarks**: Timeline stays responsive with 10+ clips. Playback ≥30fps. Export completes without crashes.

7. **Definition of Done**: Each story has specific criteria. Don't merge PR until all acceptance tests pass.

---

**Document Status**: Ready for Development
**Next Step**: Pam creates detailed PRD for each story (in dependency order)
