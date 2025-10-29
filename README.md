# Klippy — Desktop Video Editor

A lightweight, native desktop video editor built with Electron and React. Import video clips, arrange them on a timeline, trim segments, preview playback, and export polished videos.

**Status**: MVP (Core features functional)
**Platform**: macOS (primary), Windows (secondary)
**Tech Stack**: Electron + React + TypeScript + FFmpeg

---

## Features

✅ **Video Import** — Drag & drop or file picker (MP4/MOV)
✅ **Library View** — Browse and manage imported clips
✅ **Timeline Editor** — Arrange clips with drag & drop
✅ **Preview Player** — Play timeline sequence with audio
✅ **Trim Editing** — Non-destructive clip trimming
✅ **Export to MP4** — Render final video with progress tracking
✅ **Zoom Controls** — Timeline scaling for precise editing

---

## Installation & Setup

### Prerequisites
- **Node.js** 18+ and npm
- **macOS** 10.13+ or **Windows** 10+

### Install Dependencies
```bash
npm install
```

---

## Development Commands

### Start Development Server
```bash
npm start
```
Launches the app in development mode with hot reload.

### Build & Package
```bash
npm run make
```
Creates a native app installer/package in `out/make/`:
- **macOS**: `.zip` with app bundle
- **Windows**: `.exe` installer
- **Linux**: `.deb` and `.rpm` packages

### Run ESLint
```bash
npm lint
```

---

## Distribution

### macOS
1. Run `npm run make`
2. Share the `.zip` file from `out/make/`
3. Users extract and drag the `.app` to Applications

### Windows
1. Run `npm run make`
2. Share the `.exe` installer from `out/make/`
3. Users run the installer

### Sharing the App
- **Quick Share**: Distribute the `.zip`/`.exe` directly
- **GitHub Releases**: Upload builds to GitHub for version tracking
- **Website**: Host on your website or cloud storage

---

## Project Structure

```
src/
├── main.ts                 # Electron main process entry
├── preload.ts              # Preload script (IPC security)
├── main.tsx                # React app entry
├── components/             # React UI components
│   ├── MainLayout.tsx
│   ├── Timeline.tsx
│   ├── Library.tsx
│   ├── ExportModal.tsx
│   └── ...
├── main/
│   └── ipc-handlers/       # Electron IPC handlers
│       ├── app.ts
│       ├── export.ts
│       └── ...
└── stores/                 # Zustand state management

prds/                        # Product requirement docs
todos/                       # Implementation task lists
prd-mvp.md                   # MVP specification
```

---

## Architecture

### Electron IPC Flow
- **Main Process** (`src/main.ts`): Handles file system, FFmpeg, video processing
- **Preload Script** (`src/preload.ts`): Exposes IPC channels securely
- **Renderer Process** (`src/main.tsx`): React UI communicates via IPC

### Video Processing
- **FFmpeg** (bundled): Handles video trimming and export
- **FFprobe**: Extracts video metadata (duration, dimensions, etc.)
- **HTML5 Video**: Preview playback in the UI

### State Management
- **Zustand**: Lightweight state for clips, timeline, UI

---

## Development Workflow

### Feature Development (Using Agent System)

1. **Create User Story** (Brenda Agent)
   ```bash
   /brenda [feature-name]
   ```

2. **Create PRD** (Pam Agent)
   ```bash
   /pam s[number]-[feature-name]
   ```

3. **Implement Feature** (Caleb Agent)
   ```bash
   /caleb s[number]-[feature-name]
   ```

See `CLAUDE.md` for detailed agent workflow and dependencies.

---

## Tech Stack Details

- **Electron**: 39.0.0
- **React**: 19.2.0
- **TypeScript**: 4.5.4
- **Vite**: Build tool (fast dev server + production builds)
- **FFmpeg**: 5.2.0 (bundled)
- **Zustand**: 5.0.8 (state management)

---

## Troubleshooting

### App won't start
```bash
npm install
npm start
```

### Build fails
- Ensure Node.js 18+: `node --version`
- Clear cache: `rm -rf node_modules && npm install`
- Check FFmpeg: `npm list ffmpeg-static`

### Export hangs
- Check disk space (video rendering is storage-intensive)
- Monitor console: `npm start` shows logs

---

## Known Limitations (MVP)

- Single timeline sequence only
- Basic transitions (cut only)
- MP4/MOV import only
- No audio-only tracks
- No effects/filters (Phase 2+)

---

## Contributing

1. Create a feature branch: `git checkout -b feat/feature-name`
2. Follow the agent workflow in `CLAUDE.md`
3. Test locally with `npm start`
4. Build package: `npm run make`
5. Submit PR to `develop` branch

---

## License

MIT — See LICENSE file

---

## Contact

**Author**: Vanessa Mercado
**Email**: vanessa.mercado24@gmail.com

---

**Next Steps**: See `prd-mvp.md` for feature roadmap and `CLAUDE.md` for development process.
