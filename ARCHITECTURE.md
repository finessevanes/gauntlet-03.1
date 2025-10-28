# Gauntlet-03.1 — Tech Architecture

**Project:** Klippy - Desktop Video Editor
**Platform:** Electron + React + TypeScript + Vite

---

## System Overview

```
┌─────────────────────────────────────────────────────────┐
│  Electron Main Process (Node.js)                        │
│  ├─ File system access                                  │
│  ├─ Child process management (FFmpeg)                   │
│  ├─ IPC message routing                                 │
│  └─ Window lifecycle management                         │
└─────────────────────────────────────────────────────────┘
                           │
              (IPC Bridge via Preload)
                           │
┌─────────────────────────────────────────────────────────┐
│  Preload Script (Secure Bridge)                         │
│  ├─ Exposes safe IPC methods                            │
│  ├─ Validates renderer messages                         │
│  └─ Restricts Node.js access                            │
└─────────────────────────────────────────────────────────┘
                           │
┌─────────────────────────────────────────────────────────┐
│  Renderer Process (React App)                           │
│  ├─ Components (src/components/)                        │
│  ├─ State management                                    │
│  ├─ UI rendering                                        │
│  └─ User interactions                                   │
└─────────────────────────────────────────────────────────┘
```

---

## Technology Stack

### Core Framework
- **Electron**: `v39.0.0` — Desktop application runtime
- **Electron Forge**: `v7.10.2` — Build, package, and distribute
- **Node.js**: CommonJS module system

### Build & Dev Tools
- **Vite**: `v5.4.21` — Frontend build tool with HMR
- **TypeScript**: `~4.5.4` — Type-safe JavaScript
- **ESLint**: `v8.57.1` — Code linting

### Frontend
- **React** — UI component library (via preload/renderer setup)
- **CSS/Styling** — Standard CSS in `src/index.css`

### External Tools
- **FFmpeg** — Video processing (via `ffmpeg-static` package)
- **Squirrel** — Windows auto-updater support

---

## Directory Structure

```
gauntlet-03.1/
├── .claude/commands/              # Agent command definitions
│   ├── brenda.md                  # User story agent
│   ├── pam.md                     # PRD agent
│   └── caleb.md                   # Implementation agent
│
├── agents/                        # Agent system instructions
│   ├── brenda-agent.md
│   ├── pam-agent.md
│   ├── caleb-agent.md
│   ├── prd-template.md
│   └── todo-template.md
│
├── src/                           # Source code
│   ├── main.ts                    # Electron main process
│   ├── preload.ts                 # Preload script (IPC bridge)
│   ├── renderer.ts                # Renderer process entry point
│   ├── index.css                  # Global styles
│   ├── components/                # React components (created during build)
│   └── main/                      # Main process utilities (created during build)
│
├── prds/                          # Product requirement documents
│   └── s[number]-[feature]-prd.md (generated)
│
├── todos/                         # Implementation task lists
│   └── s[number]-[feature]-todo.md (generated)
│
├── vite.main.config.ts            # Build config for main process
├── vite.renderer.config.ts        # Build config for renderer
├── vite.preload.config.ts         # Build config for preload script
├── forge.config.ts                # Electron Forge configuration
├── forge.env.d.ts                 # Environment type definitions
│
├── tsconfig.json                  # TypeScript configuration
├── .eslintrc.json                 # ESLint configuration
├── .gitignore                     # Git ignore rules
├── index.html                     # HTML entry point for renderer
│
├── package.json                   # Dependencies & scripts
├── package-lock.json              # Dependency lock file
│
├── CLAUDE.md                      # Agent system instructions
├── ARCHITECTURE.md                # This file
├── README.md                      # Project documentation
├── prd-mvp.md                     # MVP requirements (8 features)
├── USER_STORIES.md                # Generated user stories
└── memory-bank.md                 # Development notes
```

---

## Build Architecture

### Vite Configuration

Three separate Vite build targets:

#### 1. Main Process (`vite.main.config.ts`)
- **Entry**: `src/main.ts`
- **Output**: `.vite/build/main.js`
- **Target**: Node.js (CommonJS)
- **Responsibilities**:
  - Window management
  - File system operations
  - FFmpeg process spawning
  - IPC message handling

#### 2. Preload Script (`vite.preload.config.ts`)
- **Entry**: `src/preload.ts`
- **Output**: Preload bundle
- **Target**: Isolated preload context
- **Responsibilities**:
  - Safe IPC method exposure
  - Context isolation bridge
  - Main ↔ Renderer communication

#### 3. Renderer Process (`vite.renderer.config.ts`)
- **Entry**: `src/renderer.ts` (loads `index.html`)
- **Output**: Web bundle
- **Target**: Chromium (ES modules)
- **Responsibilities**:
  - React component rendering
  - User interaction handling
  - State management

### Electron Forge Configuration

**Makers** (Packaging targets):
- **MakerSquirrel** — Windows NSIS installer
- **MakerZIP** — macOS ZIP distribution
- **MakerDeb** — Linux Debian package
- **MakerRpm** — Linux RPM package

**Plugins**:
- **VitePlugin** — Integrates Vite with Forge
- **FusesPlugin** — Electron security options:
  - ASAR integrity validation
  - Run only from ASAR
  - Cookie encryption enabled
  - CLI inspect arguments disabled

---

## IPC Architecture

### Main → Renderer (Events)
```
Main Process
  ↓ ipcMain.on('event-name')
Renderer Process
  ↓ ipcRenderer.on('event-name')
React Component state update
```

### Renderer → Main (Invoke)
```
React Component
  ↓ ipcRenderer.invoke('method-name', args)
Preload Script
  ↓ contextBridge.exposeInMainWorld()
Main Process
  ↓ ipcMain.handle('method-name')
Return promise to renderer
```

---

## Security Model

### Context Isolation
- Main process has full Node.js access
- Renderer process is sandboxed
- Preload script acts as secure bridge
- Only exposed methods from preload are accessible to renderer

### Safe APIs
- File operations via main process APIs
- Video processing (FFmpeg) spawned by main
- No direct `require()` in renderer

---

## Development Workflow

### Local Development
```bash
npm start              # Runs electron-forge start (HMR enabled via Vite)
```

### Building for Distribution
```bash
npm run package        # Create distributable app
npm run make           # Generate installers for all platforms
npm run publish        # Upload to update server (optional)
```

### Linting
```bash
npm run lint           # Run ESLint on .ts/.tsx files
```

---

## Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `electron` | 39.0.0 | Desktop app framework |
| `@electron-forge/cli` | 7.10.2 | Build & distribution |
| `@electron-forge/plugin-vite` | 7.10.2 | Vite integration |
| `vite` | 5.4.21 | Frontend build tool |
| `typescript` | 4.5.4 | Type checking |
| `eslint` | 8.57.1 | Code linting |
| `@types/electron-squirrel-startup` | 1.0.2 | Windows updater types |

---

## Data Flow

### Feature Implementation (e.g., Video Import)

1. **User Action** (Renderer)
   - Click "Import Video" button in React component

2. **IPC Request** (Renderer → Main)
   - `ipcRenderer.invoke('import-video', filePath)`

3. **File Processing** (Main)
   - Receives request in `ipcMain.handle()`
   - Spawns FFmpeg child process
   - Performs video analysis/transcoding
   - Stores metadata in session

4. **Response** (Main → Renderer)
   - Returns processed video metadata
   - Promise resolves in React component

5. **UI Update** (Renderer)
   - Update component state
   - Re-render with video in library view

---

## Extension Points

### Adding a New Feature

1. **Create Main Process Handler** (`src/main/handlers/[feature].ts`)
   ```typescript
   export async function handleFeature(args) {
     // Implement feature logic
     return result;
   }
   ```

2. **Expose via Preload** (`src/preload.ts`)
   ```typescript
   contextBridge.exposeInMainWorld('api', {
     feature: (...args) => ipcRenderer.invoke('feature', ...args)
   });
   ```

3. **Use in React** (`src/components/[Feature].tsx`)
   ```typescript
   const result = await window.api.feature(args);
   ```

---

## Performance Considerations

- **Vite HMR**: Fast hot module replacement during development
- **Code Splitting**: Main/preload/renderer built separately
- **ASAR Bundling**: Packages app code for security & distribution
- **Native Modules**: FFmpeg runs as native process, not in Node
- **Context Isolation**: Reduces overhead of IPC bridge

---

## Platform Support

| Platform | Status | Installer |
|----------|--------|-----------|
| macOS | Primary | ZIP |
| Windows | Secondary | NSIS (.exe) |
| Linux | Supported | Debian (.deb) + RPM (.rpm) |

---

**Last Updated**: 2025-10-27
**For agent instructions, see**: `CLAUDE.md`
**For feature specs, see**: `prd-mvp.md` and `prds/` directory
