# Testing the Multitrack Timeline Refactor

## What's Been Built (Testable Now)

✅ **Phase 1 Complete** - Data Model Migration
- New timeline schema with Track/Lane/Clip hierarchy
- Invariant validation (gapless main track, no overlaps)
- Migration from old session format
- New Zustand store with undo/redo support
- Command pattern infrastructure
- Insert operation with ripple/overwrite modes

## Running Tests

### 1. Install Dependencies

First, install the new testing dependencies:

```bash
npm install
```

This will install:
- `vitest` - Fast unit test runner
- `@vitest/ui` - Visual test UI
- `typescript@^5.6` - Updated TypeScript (was 4.5.4)

### 2. Run Unit Tests

Run all tests with auto-watch:
```bash
npm test
```

Run tests once (no watch):
```bash
npm run test:run
```

Run tests with UI (opens in browser):
```bash
npm run test:ui
```

### 3. What the Tests Cover

The test file is at `src/timeline/__tests__/timeline.test.ts` and covers:

**Timeline Schema:**
- ✅ Creates empty timeline with main track
- ✅ Converts seconds to ticks correctly

**Invariants:**
- ✅ Validates gapless main track (no gaps, no overlaps)
- ✅ Detects gaps in main track
- ✅ Detects overlaps in main track
- ✅ Normalizes unsorted clips

**Migration:**
- ✅ Migrates old session format (v1) to new TimelineDoc (v2)
- ✅ Auto-detects format and migrates when needed
- ✅ Recognizes new format (no migration)

**Insert Operation:**
- ✅ Inserts clip to empty main track
- ✅ Inserts clip and ripples downstream clips (shifts them right)
- ✅ Appends clip to end of track
- ✅ All results pass invariant validation

## Expected Test Results

All tests should **PASS** ✅. If any fail, there's a bug in the core logic.

Example output:
```
✓ Timeline Schema > creates empty timeline with main track
✓ Timeline Schema > converts seconds to ticks correctly
✓ Invariants > validates gapless main track
✓ Invariants > detects gap in main track
✓ Invariants > detects overlap in main track
✓ Invariants > normalizes unsorted clips
✓ Migration > migrates old session to new TimelineDoc
✓ Migration > auto-detects and migrates old format
✓ Migration > recognizes new format (no migration needed)
✓ Insert Operation > inserts clip to empty main track
✓ Insert Operation > inserts clip and ripples downstream
✓ Insert Operation > appends clip to end of main track

Test Files  1 passed (1)
     Tests  12 passed (12)
```

## Manual Testing (Optional)

There's also a manual playground script at:
`src/timeline/__tests__/manual-playground.ts`

This shows step-by-step how the timeline works:
1. Create empty timeline
2. Insert first clip
3. Append second clip
4. Insert clip in middle (ripple)
5. Migrate old session

You can read through it or run snippets in a Node console.

## What Can't Be Tested Yet

❌ **UI/Visual** - The new timeline UI isn't built yet, so you can't see it visually
❌ **Move/Split/Trim/Delete** - Operations not implemented yet
❌ **Undo/Redo Shortcuts** - Keyboard shortcuts not hooked up yet
❌ **Snapping** - Snap engine not built yet
❌ **Multi-track rendering** - UI components not created yet

These will be testable as we complete Phases 2-6.

## Key Concepts to Understand

### Ticks vs Seconds
- Old system: Used **seconds** (floats, can drift)
- New system: Uses **ticks** (integers, 1 tick = 1ms)
- Convert: `secondsToTicks(5, 1000) = 5000` (5 seconds = 5000 ticks)

### Ripple vs Overwrite
- **Ripple (default)**: Inserting/deleting shifts downstream clips
  - Insert 2s clip at 5s → clips after 5s shift right to 7s
- **Overwrite**: Replaces content without shifting
  - Insert 2s clip at 5s → clips at 5-7s are truncated/removed

### Main Track vs Overlays
- **Main track**: Gapless, magnetic, ripple by default
  - Clips: `[0-5s][5-8s][8-10s]` (no gaps allowed)
- **Overlay tracks**: Gap-friendly, no automatic ripple
  - Clips: `[0-5s] ... [10-12s]` (gaps allowed)

### Invariants
The system enforces strict rules:
- Main track **must** be gapless (no gaps, no overlaps)
- Clips in a lane **must** be sorted by start time
- All edits **must** pass validation before being applied

If any invariant is broken, the operation throws an error.

## Next Steps

Once all tests pass:
1. ✅ Phase 1 is validated
2. Move to Phase 2: Complete remaining operations (move, split, trim, delete)
3. Move to Phase 3: Hook up undo/redo keyboard shortcuts
4. Move to Phase 4: Build snapping engine
5. Move to Phase 5: Build multi-track UI
6. Move to Phase 6: Integration tests

---

**Questions?** Check the files:
- `src/types/timeline.ts` - Type definitions
- `src/timeline/invariants.ts` - Validation rules
- `multitrack-expectation.md` - Full specification
