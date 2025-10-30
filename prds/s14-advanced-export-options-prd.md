# PRD: Advanced Export Options

**Feature**: Advanced Export Options | **Status**: Ready | **Agent**: Pam
**Story**: S14 (Phase 6, Medium) | **Dependencies**: Story 7 (Export to MP4)

---

## Summary

Users optimize video exports by selecting from platform presets (YouTube, Instagram, TikTok, Twitter) or creating custom presets with specific resolution, bitrate, and fps. The system validates source compatibility, warns about upscaling, and persists custom presets.

---

## Requirements

### MUST

**1. Built-in Platform Presets** (read-only, always visible)
- YouTube: ~1080p, 30fps, 12Mbps
- Instagram: 1080x1350 (vertical), 5Mbps
- TikTok: 1080x1920 (vertical), 5Mbps
- Twitter: 1280x720, 30fps, 8Mbps

**2. Custom Presets** (create, edit, delete)
- User-defined name, resolution (320x180 to 7680x4320), bitrate (1-100Mbps), fps (24/30/60)
- Validation: Name required + unique; resolution > 320x180; bitrate 1-100Mbps
- Persist to `app.getPath('userData')/export-presets.json`
- Load on app startup

**3. Preset Selection Flow**
- On Export click: Show preset selection before file picker
- Display all presets (built-in + custom)
- Show upscaling warning if preset resolution > source resolution
- Default filename: `Klippy_Export_[PresetName]_YYYYMMDD_HHMMSS.mp4`

**4. Upscaling Validation**
- Detect when preset > source resolution
- Show warning: "Source is 1280x720. Upscaling to 1920x1080 may reduce quality."
- Allow user to proceed or use lower resolution

**5. FFmpeg Integration**
- Pass preset settings to `export-video` handler
- Apply scale filter (width/height), bitrate (-b:v), fps (-r) to FFmpeg command
- Backward compatible (optional preset param)

### SHOULD (Nice-to-Have)

- Estimated file size display: `(duration seconds × bitrate Mbps) / 8`
- Platform preset descriptions/icons
- Frame rate auto-adjust bitrate suggestion for 60fps

### OUT OF SCOPE

- Batch export, preset sharing, cloud sync, new formats/codecs, real-time preview

---

## Data Model

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

// Persistence: export-presets.json
{
  "version": 1,
  "customPresets": [
    {
      "id": "custom-720p",
      "name": "My 720p",
      "category": "custom",
      "resolution": { "width": 1280, "height": 720 },
      "bitrate": 5,
      "frameRate": 30,
      "createdAt": 1729000000000
    }
  ]
}
```

---

## IPC Handlers (Electron Main Process)

**`export-get-presets`** → Returns array of built-in + custom presets
**`export-save-custom-preset`** → Save/update custom preset to file
**`export-delete-custom-preset`** → Delete custom preset (built-in protected)
**`export-video` (MODIFIED)** → Accept optional `preset: { resolution, bitrate, frameRate }`

Error handling: Missing/corrupted presets file → load built-in only, log error

---

## Components

The UI is flexible. Implement preset selection using:
- Modal dialog, sidebar panel, dropdown, or preset cards/grid

**Required functionality**:
1. **Preset Selection UI** — Display all presets, show warnings, allow selection
2. **Custom Preset Form** — Fields for name, resolution, bitrate, fps with validation
3. **Export Modal** — Accept preset param, show preset in confirmation
4. **Export Button** — Intercept click, show preset selection before file picker

---

## Testing & Acceptance

### Happy Path
1. Import video → Click Export → Select platform preset (e.g., YouTube) → Confirm → Export completes
   - ✓ Preset UI appears with 4 presets visible
   - ✓ Filename includes preset name: `Klippy_Export_YouTube_*.mp4`
   - ✓ Exported video matches preset settings (resolution, bitrate, fps verified with ffprobe)

2. Create custom preset → Name: "My 720p", Resolution: 1280x720, Bitrate: 5Mbps → Save → Relaunch app
   - ✓ Form validation works (name required, unique)
   - ✓ Preset persists to file and loads on restart

3. Import 720p video → Select 1080p preset → Warning appears
   - ✓ "Source is 1280x720. Upscaling to 1920x1080 may reduce quality."
   - ✓ User can proceed or use lower resolution

### Edge Cases
- Custom presets can be edited/deleted (with confirmation); built-in presets cannot
- Multiple timeline clips with different resolutions → Upscaling warning based on max resolution
- Invalid form input (empty name, duplicate name, bad resolution/bitrate) → Error shown, save prevented

### Error Handling
- Presets file corrupted → Load built-in presets only, log error
- Invalid user input → Show specific error message, prevent save
- Export cancelled → No partial files, app stable

---

## Definition of Done

- [ ] Built-in presets defined (YouTube, Instagram, TikTok, Twitter)
- [ ] ExportPreset TypeScript interface implemented
- [ ] IPC handlers: `export-get-presets`, `export-save-custom-preset`, `export-delete-custom-preset`
- [ ] `export-video` modified to accept optional preset param
- [ ] `export-presets.json` persistence working (load on startup, save on change)
- [ ] Preset selection UI implemented (any layout: modal, sidebar, cards, etc.)
- [ ] Custom preset form with validation (name, resolution, bitrate, fps)
- [ ] Upscaling detection + warning UI
- [ ] Filename generation includes preset name: `Klippy_Export_[PresetName]_YYYYMMDD_HHMMSS.mp4`
- [ ] FFmpeg integration: scale, bitrate, fps applied from preset
- [ ] All test gates pass (3 happy paths, 3 edge cases, 3 error cases)
- [ ] No console errors, graceful error handling
- [ ] Code reviewed and merged to `develop`

---

## Notes

- Built-in presets immutable; custom presets fully editable
- Backward compatible: `export-video` works with/without preset param
- Estimated file size (optional): `(duration × bitrate) / 8 = MB`
- Form validation: Name required+unique, resolution ≥320x180, bitrate 1-100Mbps, fps ∈[24,30,60]

---

**Status**: Ready for Implementation
**Next**: Caleb creates TODO and implements
