# TODO — Teleprompter

**Branch**: `feat/teleprompter`
**Source**: User story (Teleprompter feature brief)
**PRD Reference**: `prds/s9-teleprompter-prd.md`
**Owner (Agent)**: Caleb

---

## 0. Pre-Implementation

- [ ] Read user story and teleprompter feature brief thoroughly
- [ ] Read PRD: `prds/s9-teleprompter-prd.md` (especially sections 5, 6, 9)
- [ ] Identify test gates from PRD (sections 9 & 10 below)
- [ ] Clarify any ambiguities before starting
- [ ] **Technology validation**:
  - [ ] Confirm AI API (OpenAI/Claude) is already integrated in main process
  - [ ] Confirm state management library (Zustand or Context API) choice
  - [ ] Test RAF (requestAnimationFrame) for smooth scroll animations on target hardware

---

## 1. Service/Command Layer (Electron IPC)

Implement `generate_script_with_ai` IPC handler in Electron main process.

- [ ] Create `src/main/ipc-handlers/ai.ts` (or extend existing AI handler)
  - [ ] Implement `generate_script_with_ai` handler:
    - Input: `{ topic: string, duration: number }`
    - Validation: Both fields required, duration 1-300 seconds
    - Call AI API with prompt: "Write a concise script about [topic] for a [duration]-second video. Keep it engaging and natural to read aloud. Output only the script text, no preamble."
    - Timeout: 10 seconds max
    - Return: `{ scriptText: string, estimatedDuration: number }`
    - Error: Return error object with message on failure
  - [ ] Test: Valid inputs return script; invalid inputs error with message
  - [ ] Test: Timeout returns error after 10 seconds
  - [ ] Test: Network failure returns clear error message

---

## 2. React Components & State

Create/modify React components per PRD.

- [ ] Create `src/components/TeleprompterModal.tsx`
  - State: Script data, generation status, error messages, scroll/play state
  - Props: `isOpen`, `onClose`, `onSave` (callback to save script to project)
  - Manages modal container, triggers component switches (Generator → Preview → Display)
  - Test: Renders correctly, opens/closes, state updates work

- [ ] Create `src/components/ScriptGenerator.tsx`
  - Props: `onGenerate` (callback), `isLoading`, `error`
  - Form inputs: Topic (text), Duration (number, 1-300 sec)
  - Button: "Generate" (disabled if fields empty or loading)
  - Display: Error message if present
  - Test: Validation works, onGenerate called with correct params, loading state shows

- [ ] Create `src/components/ScriptPreview.tsx`
  - Props: `scriptText`, `onAccept`, `onRegenerate`, `estimatedDuration`
  - Display: Script text in preview area + "Estimated read time at 150 WPM: X seconds"
  - Buttons: "Accept" (move to display), "Regenerate" (return to generator with feedback option)
  - Test: Buttons trigger callbacks, text displays correctly

- [ ] Create `src/components/ScriptDisplay.tsx` ⭐ **Complex component**
  - Props: `scriptText`, `onClose`
  - State: Current scroll position (line index), WPM (default 150), isAutoScrolling, isPaused
  - **Manual Scroll**:
    - Up/Down arrow buttons → scroll line-by-line
    - Scroll position clamped to 0-maxLines
  - **Auto-Scroll**:
    - Toggle button to enable/disable
    - When enabled: Calculate scroll speed from WPM (e.g., 150 WPM ≈ 2.5 words/sec, adjust line scroll rate)
    - Use RAF for smooth 60fps animation
    - Pause button stops animation, resume resumes from same position
  - **WPM Slider**:
    - Range: 80-200 WPM (default 150)
    - Updates scroll speed in real-time
    - Display current WPM
  - **Font Size Slider** (nice-to-have):
    - Range: 12px-32px (default 20px)
  - Layout: Large readable text area + control buttons below/beside
  - Test: All controls work, smooth scroll, no jank, pause/resume correct

- [ ] Add loading/error/empty states to all components
  - [ ] TeleprompterModal: Show loading spinner during generation
  - [ ] ScriptDisplay: Handle empty script gracefully
  - [ ] Test: All states render without crashing

---

## 3. Data Model & Persistence

- [ ] Define TypeScript interfaces in `src/types/teleprompter.ts`:
  ```typescript
  interface TeleprompterScript {
    id: string;
    topic: string;
    duration: number;
    scriptText: string;
    wpm: number;
    createdAt: number;
    isAccepted: boolean;
  }

  interface TeleprompterState {
    script: TeleprompterScript | null;
    isGenerating: boolean;
    error: string | null;
    scrollPosition: number;
    isAutoScrolling: boolean;
    isPaused: boolean;
  }
  ```
  - [ ] Test: Types compile without errors

- [ ] Implement state management (Zustand or Context API):
  - [ ] Create `src/hooks/useTeleprompter.ts` or `src/store/teleprompter.ts`
  - Actions: `setScript`, `setGenerating`, `setError`, `updateScrollPosition`, `toggleAutoScroll`, `togglePause`, `resetScript`
  - Persist to project session (save script in-memory when accepted)
  - Test: State updates correctly, script persists across modal close/reopen

---

## 4. Integration

- [ ] Wire React components → Electron IPC:
  - [ ] In ScriptGenerator: Call `ipcRenderer.invoke('generate_script_with_ai', { topic, duration })`
  - [ ] Handle success: Pass script to ScriptPreview
  - [ ] Handle error: Display in ScriptGenerator, show retry button
  - [ ] Test: IPC call works, response displays in UI

- [ ] Integrate TeleprompterModal into Webcam Mode:
  - [ ] Add "Generate Script" button to webcam mode UI component (or main editor when in webcam mode)
  - [ ] Button click opens TeleprompterModal
  - [ ] Modal close cleans up state but preserves script (for MVP)
  - [ ] Test: Button appears, modal opens/closes correctly

- [ ] Project session integration:
  - [ ] Save accepted script to project state (via Zustand/Context)
  - [ ] On TeleprompterModal reopen: If script exists in project, show in ScriptDisplay (skip generation)
  - [ ] Test: Close modal with accepted script, reopen → script still there

---

## 5. Manual Testing

**Reference test gates from `prds/s9-teleprompter-prd.md` section 9:**

### Happy Path: Script Generation & Display
- [ ] **Test**: User clicks "Generate Script" → inputs "benefits of creatine", "30" sec → clicks "Generate" → script appears → clicks "Accept" → script displays with controls
- [ ] **Verify**: Script text visible, large and readable
- [ ] **Verify**: Auto-scroll toggle works, scrolls smoothly at 150 WPM without jank
- [ ] **Verify**: Pause button stops scroll, resume continues from same position
- [ ] **Verify**: WPM slider adjusts speed (increase to 180 WPM, scroll faster; decrease to 100 WPM, scroll slower)
- [ ] **Verify**: No errors in console

### Happy Path: Manual Scroll
- [ ] **Test**: Click up/down arrow buttons to scroll script line-by-line
- [ ] **Verify**: Text moves 1-2 lines per click
- [ ] **Verify**: Reaches end of script without crash
- [ ] **Verify**: Scroll position preserved when toggling auto-scroll

### Happy Path: Regenerate with Feedback
- [ ] **Test**: Reject initial script → click "Regenerate" → add feedback → new script appears → accept
- [ ] **Verify**: New script incorporates feedback (e.g., shorter, more casual)
- [ ] **Verify**: No duplicate scripts, fresh generation

### Edge Cases & Errors
- [ ] **Empty input**: Click "Generate" without filling fields → Validation error displays, modal stays open
- [ ] **Network timeout**: Simulate slow API (>10 sec) → Error message "Script generation failed", retry button available
- [ ] **Network failure**: Simulate offline → Error "Unable to connect", retry works when reconnected
- [ ] **Long script**: Generate script that would take >60 seconds to read at 150 WPM → Display full text, user scrolls manually or adjusts WPM down to 80
- [ ] **Special characters**: Test topic with unicode, emoji, symbols (e.g., "benefits of 咖啡 & energy!") → Script displays correctly, no rendering issues
- [ ] **Modal closed mid-generation**: Close modal while AI is generating → Script not saved (acceptable), reopen and regenerate
- [ ] **WPM edge cases**: Set WPM to 0, 1000 (out of range) → Clamp to 80-200 WPM, display correct value
- [ ] **Font size slider** (if implemented): Adjust from 12px to 32px → Text resizes smoothly, readable at all sizes

### Performance
- [ ] **AI response time**: Generate script, verify response within 10 seconds
- [ ] **Scroll smoothness**: Auto-scroll at 150 WPM looks smooth (60fps, no jank)
- [ ] **Modal responsiveness**: All buttons/sliders respond instantly (no lag)
- [ ] **Pause/play**: Instant response (no delay)
- [ ] **No memory leaks**: Run for 5 minutes, generate multiple scripts, monitor memory (should stay stable)

### No Console Errors
- [ ] No errors or warnings during entire test scenario
- [ ] IPC calls complete without errors
- [ ] React dev tools show no warnings

---

## 6. Definition of Done

- [ ] All tasks above completed and checked off
- [ ] All acceptance criteria from user story pass (script generation, display, scroll, pause/resume, regenerate)
- [ ] All test gates from PRD pass (happy path, edge cases, errors, performance)
- [ ] TeleprompterModal integrated into Webcam Mode (button to open)
- [ ] Script persists in project session (close/reopen modal, script still there)
- [ ] No console errors or warnings
- [ ] Code reviewed
- [ ] Manual testing checklist (section 5) all items verified
- [ ] Ready for user testing

---

## 7. PR & Merge

⚠️ **CRITICAL**: DO NOT COMMIT UNTIL USER CONFIRMS ALL TEST GATES PASS

- [ ] Create branch from `develop`: `git checkout -b feat/teleprompter`
- [ ] All code committed locally
- [ ] User confirms all test gates pass (section 5 above)
- [ ] User says "ready to commit" or "looks good, let's merge"
- [ ] THEN: Open PR with:
  - Title: `feat(teleprompter): AI-powered script generation and display for webcam mode`
  - Body includes:
    - Link to PRD: `prds/s9-teleprompter-prd.md`
    - Summary: What was built (script generator modal, auto-scroll, manual scroll, WPM control)
    - Manual test results: All gates passed, no errors
  - [ ] Code reviewed
  - [ ] Merge to `develop`

---

## Notes

- **Scroll calculation**: For auto-scroll at X WPM, estimate ~1 line ≈ 8 words. At 150 WPM, scroll ~18-20 lines/minute ≈ 0.3 lines/sec. Use RAF for smooth animation.
- **Timeout handling**: IPC handler should timeout after 10 sec, return error immediately (don't wait for LLM response forever).
- **State persistence**: For MVP, script only persists in-memory (project session). If user closes app, script is lost (acceptable).
- **Test gates are the spec**: They define "done" — verify every single one before committing.
- **Break work into <1 hour chunks**: Implement one component at a time, test as you go.
- **Document blockers**: If AI API not available or state management unclear, ask user immediately.
