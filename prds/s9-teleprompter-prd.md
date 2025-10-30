# PRD: Teleprompter

**Feature**: Teleprompter | **Status**: Draft | **Agent**: Pam

---

## Preflight

1. **Smallest end-to-end outcome?** User generates a script via AI chat, accepts it, and displays it in a modal ready to record voiceover in webcam mode.
2. **Primary user + critical action?** Content creator in webcam mode → clicks "Generate Script" → chats with AI → accepts script → reads from teleprompter while recording.
3. **Must-have vs nice-to-have?** Must: AI script generation, manual/auto scroll, pause/resume. Nice-to-have: script editing, analytics.
4. **Offline/persistence?** Scripts saved per project session (in-memory for MVP).
5. **Performance targets?** Scroll should be smooth (no jank), AI response within 5-10sec.
6. **Error/edge cases?** AI API fails, empty input, network issues, script too long for duration.
7. **Data model changes?** Store script text + metadata (duration, WPM) per project.
8. **Service/command APIs needed?** `generate_script_with_ai` (call LLM), store/retrieve script.
9. **React components needed?** TeleprompterModal, ScriptGenerator (chat flow), ScriptDisplay (text + controls).
10. **Desktop-specific needs?** Modal must be closable, responsive to window size.
11. **Out of scope?** Timecode sync, script analytics, multi-script versioning, script upload/download, formatting optimization.

---

## 1. Summary

The Teleprompter feature allows creators to generate AI-powered scripts via conversational chat, then display and control the text while recording voiceover or on-camera content in webcam mode. Users can adjust scroll speed (WPM), pause/resume, and accept/reject AI-generated scripts with feedback.

---

## 2. Non-Goals / Scope Boundaries

- **No timecode sync**: Script scrolls independently of video playback.
- **No script persistence across projects**: One script per project session (stored in-memory for MVP).
- **No advanced formatting**: Plain text only, single theme/font.
- **No analytics/learning**: No tracking of pause points or reading speed preferences.
- **No script upload/file import**: AI generation or manual text input only.
- **No editing in modal**: Accept/reject loop only, then display as-is.

---

## 3. Experience (UX)

### Entry Point
- **Trigger**: User enables "Webcam Mode" in main editor
- **Access**: "Generate Script" button appears in webcam mode UI

### Happy Path (User Flow)
1. User clicks "Generate Script" button → TeleprompterModal opens
2. Modal shows "What do you want to talk about?" text input + "Duration (seconds)" input
3. User types topic (e.g., "benefits of creatine") + duration (e.g., "30")
4. User clicks "Generate" → Modal shows loading state
5. AI returns a script → Displays in a preview area within modal
6. User can click "Accept" → Script moves to display mode (scrollable text + controls)
7. Or click "Regenerate" → Chat input returns, user adds feedback (e.g., "shorter, more casual")
8. Loop until user accepts
9. Once accepted, modal shows: Large text area + scroll controls (Manual/Auto toggle, WPM slider, Pause/Play buttons)
10. User reads script while recording; can pause/resume/adjust speed anytime

### States
- **Loading**: Spinner while AI generates
- **Error**: Clear message (e.g., "AI request failed, try again"), retry button
- **Empty**: Initial chat input state
- **Display**: Accepted script ready to read

### Desktop Considerations
- Modal should be resizable and closeable (X button)
- If modal closed, script saved to project session (don't lose it)
- On reopen, show saved script in display mode (skip generation)

---

## 4. Functional Requirements

### MUST

**Script Generation**
- User inputs: topic (text), duration (seconds)
- System calls AI service with: "Write a concise script about [topic] for a [duration]-second video. Keep it engaging and natural to read aloud."
- AI returns: Script text (estimated to fit duration)
- User can reject with feedback: "regenerate with: [feedback]" → loops

**Display & Scroll Control**
- Once accepted, script displays in large, readable text (configurable font size via slider)
- **Manual Scroll**: Up/Down buttons to move text line-by-line
- **Auto-Scroll**: Toggle button to enable auto-scroll at configurable WPM (default 150 WPM)
- **Pause/Resume**: Button to pause auto-scroll mid-read, resume from same position
- **WPM Slider**: Adjust scroll speed 80-200 WPM in real-time

**Script Persistence**
- Save generated script to project session (so if modal is closed/reopened, script is available)
- No explicit "Save" needed; persists automatically on accept

**Error Handling**
- AI request fails: Show error message + retry button
- Empty inputs: Show validation message (both fields required)
- Network timeout: Show error, allow user to retry

### SHOULD

- Keyboard shortcuts for pause/play, speed up/down (nice-to-have for MVP+)

---

## 5. Data Model

```typescript
interface TeleprompterScript {
  id: string;                    // Unique ID per project session
  topic: string;                 // User input: "benefits of creatine"
  duration: number;              // Seconds, user input
  scriptText: string;            // Generated or manual text
  wpm: number;                   // Current WPM (default 150)
  createdAt: number;             // Timestamp
  isAccepted: boolean;           // True after user clicks "Accept"
}

interface TeleprompterState {
  script: TeleprompterScript | null;
  isGenerating: boolean;
  error: string | null;
  scrollPosition: number;        // Line index for manual scroll
  isAutoScrolling: boolean;      // Toggle state
  isPaused: boolean;             // Pause state during auto-scroll
}
```

**Storage**: Project session state (Zustand or Context API). For MVP, in-memory only (lost on app close).

---

## 6. Service/Command APIs

### `generate_script_with_ai`

**Trigger**: User submits topic + duration in chat input

**Params**:
```typescript
{
  topic: string;     // e.g., "benefits of creatine"
  duration: number;  // e.g., 30 (seconds)
}
```

**Returns**:
```typescript
{
  scriptText: string;     // Generated script
  estimatedDuration: number; // How long to read at default WPM
}
```

**Pre-conditions**: Topic and duration both provided, network available

**Post-conditions**: Script returned ready for display/approval

**Errors**:
- Empty topic/duration → Validation error: "Both fields required"
- Network timeout → "AI request failed, try again"
- LLM API error → "Script generation failed (API error), try again"

**IPC Handler Implementation**:
- Call OpenAI/Claude API (already configured in main process) with prompt
- Return script text
- Timeout after 10 seconds, return error if exceeded

---

## 7. Components to Create/Modify

- `src/components/TeleprompterModal.tsx` — Main modal container, manages open/close, state
- `src/components/ScriptGenerator.tsx` — Chat input + topic/duration fields + submit button
- `src/components/ScriptDisplay.tsx` — Scrollable script + controls (manual scroll, auto-scroll toggle, WPM slider, pause/play)
- `src/components/ScriptPreview.tsx` — Preview area during generation/approval (shows generated text, Accept/Regenerate buttons)
- `src/main/ipc-handlers/ai.ts` — `generate_script_with_ai` handler (call LLM API, validate inputs)

**Modify**:
- `src/components/WebcamMode.tsx` or main editor → Add "Generate Script" button to open TeleprompterModal

---

## 8. Integration Points

- **AI API**: OpenAI/Claude integration (already available in main process)
- **State Management**: Zustand or React Context (project-level script state)
- **Electron IPC**: Frontend calls `generate_script_with_ai` via `ipcRenderer.invoke()`
- **Project Session**: Script state persists for the duration of the project (in-memory for MVP)

---

## 9. Testing & Acceptance Gates

### Happy Path: Script Generation & Display
- **Flow**: User clicks "Generate Script" → inputs "benefits of creatine", "30" sec → clicks "Generate" → script appears → user clicks "Accept" → script displays with controls
- **Gate**: Script text visible, auto-scroll toggles and scrolls smoothly at 150 WPM, pause/resume works, WPM slider adjusts speed in real-time
- **Pass**: No errors, text readable, controls responsive, smooth scroll (no jank)

### Happy Path: Manual Scroll
- **Flow**: User clicks up/down arrow buttons to scroll script line-by-line
- **Gate**: Text moves 1-2 lines per click, reaches end without crash
- **Pass**: Scroll position preserved, buttons disabled at top/bottom

### Happy Path: Regenerate with Feedback
- **Flow**: User rejects initial script → clicks "Regenerate" → inputs feedback → new script appears → accepts
- **Gate**: New script generated based on feedback, displays without errors
- **Pass**: Feedback incorporated, no duplicate scripts in history

### Edge Cases & Errors
- **Empty input** (user clicks Generate without filling fields) → Validation error displayed, modal stays open
- **AI request timeout** (takes >10 sec) → Error message shown, "Retry" button available
- **Network failure** → Clear error: "Unable to connect, check your internet"
- **Very long script** (too much text for duration) → Display full script, user scrolls manually or adjusts WPM
- **Script with special characters** (unicode, symbols) → Display correctly, no rendering issues
- **Modal closed mid-generation** → Script lost (acceptable for MVP), user regenerates on reopen
- **WPM slider edge cases** (0 WPM, 1000 WPM) → Clamp to 80-200 WPM range, display current value

### Performance
- AI response within 10 seconds (timeout after)
- Scroll updates at 60fps (smooth animation)
- Modal renders without lag, pause/play instant response

---

## 10. Definition of Done

- [ ] TeleprompterModal component created and opens/closes correctly
- [ ] ScriptGenerator chat flow works (topic + duration input, validation)
- [ ] ScriptDisplay renders accepted script with all controls (manual scroll, auto-scroll, WPM, pause/play)
- [ ] `generate_script_with_ai` IPC handler implemented and tested
- [ ] All error states handled gracefully (no crashes, clear messages)
- [ ] All acceptance gates pass (happy path, edge cases, errors, performance)
- [ ] Modal integrated into Webcam Mode UI (button to open)
- [ ] Script persists in project session (close/reopen modal, script still there)
- [ ] Manual testing checklist complete
- [ ] No console errors during test scenarios
- [ ] Code reviewed and merged to `develop`

---

## 11. Risks & Mitigations

- **Risk**: AI API unavailable or slow → **Mitigation**: Implement 10-second timeout, clear error message, retry button
- **Risk**: Script too long to read in duration → **Mitigation**: Show estimated read time, let user adjust WPM or regenerate
- **Risk**: Modal state lost on close → **Mitigation**: Save script to project session automatically on accept
- **Risk**: Scroll jank during auto-play → **Mitigation**: Use RAF (requestAnimationFrame) for smooth animation, test on various hardware
