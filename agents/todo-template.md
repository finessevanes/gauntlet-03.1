# TODO — [Feature Name]

**Branch**: `feat/{feature-slug}`
**Source**: User story (created by Brenda)
**PRD Reference**: `prd-mvp.md`
**Owner (Agent)**: [name]

---

## 0. Pre-Implementation

- [ ] Read user story and acceptance criteria thoroughly
- [ ] Read relevant section(s) of `prd-mvp.md`
- [ ] **CRITICAL: Validate technology choices in PRD**:
  - [ ] If PRD says "recommended" or "OR", identify which option meets performance requirements
  - [ ] Test critical assumptions (e.g., "Can this approach achieve 30fps?")
  - [ ] Look for reference implementations or simpler built-in solutions
  - [ ] Ask user for clarification if technology choice is ambiguous
  - [ ] Document chosen approach and why it meets requirements
- [ ] Clarify any ambiguities before starting
- [ ] Identify test gates from PRD (reference them below)

---

## 1. Service/Command Layer (Electron IPC)

Implement deterministic backend handlers in Electron main process invoked by React frontend via IPC.

- [ ] Define IPC handler(s): `[handler_name]`
  - Input: [params], Output: [return type]
  - Error handling: [what can fail]
- [ ] Implement validation (input constraints, file existence, etc.)
- [ ] Test: Valid inputs return expected output; invalid inputs error gracefully

---

## 2. React Components & State

Create/modify React components per user story.

- [ ] Component: `[component_path]` — [purpose]
  - State: [what state does it manage]
  - Props: [required props]
  - Test: Renders correctly, state updates work
- [ ] Add loading/error/empty states for each component
  - Test: All states render without crashing

---

## 3. Data Model & Persistence

- [ ] Define TypeScript interfaces (in React) for [data]
- [ ] Session persistence logic (if needed): [what gets saved, JSON storage location]
  - Test: Save state on close, restore on relaunch

---

## 4. Integration

- [ ] Wire React components → Electron IPC handlers
  - Test: Invoke IPC handler from UI, verify response
- [ ] File system operations (if applicable): [drag-drop, file picker, etc.]
  - Test: Import/export works end-to-end
- [ ] FFmpeg integration (if applicable for export)
  - Test: Command executes, output file valid

---

## 5. Manual Testing

**Reference testing gates from prd-mvp.md [REQ-X.X section]:**

- [ ] **Happy Path(s)**: [Test scenario from PRD]
  - Verify: [Expected outcome]
- [ ] **Edge Case(s)**: [Test scenario from PRD]
  - Verify: [Expected outcome, no crash]
- [ ] **Error Handling**: [Test scenario from PRD]
  - Verify: [Clear error message, graceful recovery]
- [ ] No console errors during all test scenarios
- [ ] Feature feels responsive (no lag)

---

## 6. Performance (if applicable)

- [ ] Verify targets from `prd-mvp.md` (Non-Functional Requirements)
  - Timeline responsiveness: <50ms response time for drags
  - Playback: ≥30fps minimum
  - Memory: <1GB with 10+ clips
  - Export: Completes without crash
- [ ] Test: Run performance checklist from PRD

---

## 7. Definition of Done

- [ ] All acceptance criteria from user story pass
- [ ] All test gates from PRD pass (happy path, edge cases, errors)
- [ ] Code has comments for complex logic
- [ ] No console warnings or errors
- [ ] README updated (if user-facing changes)

---

## 8. PR & Merge

⚠️ **CRITICAL**: DO NOT COMMIT UNTIL USER CONFIRMS ALL TEST GATES PASS

- [ ] Create branch from develop
- [ ] User confirms all test gates pass ← WAIT FOR THIS
- [ ] User says "ready to commit" or "looks good"
- [ ] THEN: Open PR with:
  - Link to user story
  - Link to relevant PRD section
  - Summary of changes
  - Manual test results
- [ ] Code reviewed
- [ ] Merge to develop

---

## Notes

- Refer to prd-template.md for detailed spec guidance (data models, APIs, error cases)
- Test gates are the specification — they define "done"
- Break work into <1 hour chunks
- Document blockers immediately
