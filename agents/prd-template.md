# PRD Template

> **Workflow:** After Brenda creates a user story, use this template to write the detailed implementation spec. Keep answers concise—focus on what engineers need to build.

---

# PRD: [Feature Name]

**Feature**: [short name] | **Status**: Draft | Ready | In Progress | Shipped | **Agent**: [Name]

---

## Preflight (Answer before writing PRD)

1. Smallest end-to-end user outcome? (vertical slice)
2. Primary user + critical action?
3. Must-have vs nice-to-have?
4. Offline/persistence needs?
5. Performance targets? (responsiveness, memory, file size)
6. Error/edge cases critical to handle?
7. Data model changes?
8. Service/command APIs needed?
9. React components to create/modify?
10. Desktop-specific needs? (window, multi-monitor, app lifecycle)
11. What's explicitly out of scope?

---

## 1. Summary

One-two sentences: What problem does this solve, what outcome?

---

## 2. Non-Goals / Scope Boundaries

What's intentionally excluded and why?

---

## 3. Experience (UX)

- **Entry points:** Where in app, how triggered?
- **User flow:** Step-by-step happy path
- **States:** Loading, error, empty, success
- **Desktop considerations:** Window resize, multi-monitor, app close

---

## 4. Functional Requirements

**MUST:**
- [What user action triggers what?]
- [Deterministic service/command behavior]

**SHOULD:**
- [Nice-to-have enhancements]

**Acceptance Gates:**
- When user does X → result Y within Z time/conditions
- Offline: Actions queue, retry on reconnect
- Error: Invalid input → clear message, no partial writes

---

## 5. Data Model

Describe new/changed data structures and storage.

**Example (Klippy):**
```typescript
interface Clip {
  id: string;
  filePath: string;
  duration: number;
  inPoint: number;  // start in seconds
  outPoint: number; // end in seconds
}

interface Session {
  clips: Clip[];
  zoomLevel: number;
  playheadPosition: number;
}
```

- **Storage:** File system, localStorage, or database?
- **Persistence:** When/how saved?
- **Validation:** Field constraints, allowed values?

---

## 6. Service/Command APIs

Specify concrete IPC handlers the frontend calls.

**Example (Electron IPC handler):**
```typescript
await ipcRenderer.invoke('import_video', { filePath: '/path/to/video.mp4' });
// Returns: { id, duration, filePath }
```

For each handler:
- **Pre-conditions:** What must be true before calling?
- **Post-conditions:** What's guaranteed after?
- **Errors:** What can go wrong, error codes?
- **Params & returns:** Input/output types

---

## 7. Components to Create/Modify

List React components and Electron IPC handlers with one-line purpose.

- `src/components/Library.tsx` — [purpose]
- `src/components/Timeline.tsx` — [purpose]
- `src/main/ipc-handlers/video.ts` — [purpose]

---

## 8. Integration Points

- File system access (Node.js fs via Electron main process)
- FFmpeg (if applicable)
- Window/canvas rendering
- State management (Context, Zustand, Redux)
- Desktop lifecycle (window events, app close via Electron API)

---

## 9. Testing & Acceptance Gates

**BEFORE implementation, define:**

**Happy Path:**
- Flow: [Step-by-step user action]
- Gate: [Specific measurable outcome]
- Pass: [What proves it works]

**Example (Video Import):**
- Flow: User drags MP4 into app → appears in Library
- Gate: Thumbnail generates, duration shows correctly
- Pass: No errors, thumbnail visible within 2sec

**Edge Cases & Errors:**
- [ ] Empty input (no files, empty selections) → Clear message, no crash
- [ ] Large files (2GB+ video) → Handles gracefully, progress shown
- [ ] Special characters (unicode in filename) → Accepted or rejected clearly
- [ ] Concurrent operations (import + export) → Queue or warn, no data loss
- [ ] File not found (deleted after import) → Error message, clean recovery
- [ ] Out of disk space → Graceful cancel, no partial file
- [ ] Invalid format → Rejected before import attempt

**Performance (if critical):**
- Timeline UI responsive with 10+ clips (60fps dragging/scrolling)
- Scrubbing preview updates within 100ms
- Memory stable over 15min session (<1GB)

---

## 10. Definition of Done

- [ ] Service/command layer implemented with error handling
- [ ] React components handle all states (loading, error, success, empty)
- [ ] Manual testing: Happy path, edge cases, errors (checklist above)
- [ ] Performance validated (responsive, stable memory)
- [ ] File persistence working if needed (session auto-restore)
- [ ] All acceptance gates pass
- [ ] Code reviewed and merged
- [ ] README/docs updated if user-facing changes

---

## 11. Risks & Mitigations

- **Risk:** [What could go wrong] → **Mitigation:** [How to prevent/handle]
- **Risk:** FFmpeg compatibility → **Mitigation:** Test on macOS + Windows, bundle compatible binary
- **Risk:** Large file performance → **Mitigation:** Stream/chunk processing, test with real 2GB+ files

---

## Authoring Notes

- Write test gates before coding (they're your spec)
- Favor vertical slice: complete working functionality, not partial
- Keep Node.js/Electron main process deterministic, React UI thin wrapper
- Test file operations thoroughly (permissions, missing files, disk space)
- Validate on both macOS + Windows before shipping
- Session state must be serializable (JSON, not class instances)
