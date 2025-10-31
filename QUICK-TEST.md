# ⚡ Quick Test Reference

## 🚀 5-Minute Quick Start

### 1. Install & Test (2 minutes)
```bash
npm install
npm test
```
**Expected:** ✅ All 22+ tests pass

---

### 2. Run Visual Demo (3 minutes)

**Option A: If you have the app running:**
```bash
npm start
```
Then navigate to the timeline demo route.

**Option B: Quick code check:**
```typescript
// In src/App.tsx or main entry:
import { TimelineDemo } from './components/v2/TimelineDemo';

<TimelineDemo />
```

---

## ✅ Core Features Test (5 minutes)

### Feature 1: Auto-Compact
```
1. Click "+ Add Clip" button 3 times
2. Observe: Clips appear gaplessly at end
3. Click on middle clip to select it
4. Note the clip ID in status bar
5. Try Cmd+Z to undo
6. Observe: Clip disappears, gaps auto-close ✨
```

**✅ Pass if:** No gaps between clips after any operation

---

### Feature 2: Undo/Redo
```
1. Click "+ Add Clip" 5 times
2. Press Cmd+Z three times
3. Observe: Last 3 clips removed
4. Press Cmd+Shift+Z three times
5. Observe: Clips return exactly as before
```

**✅ Pass if:** Undo/redo works perfectly, count updates

---

### Feature 3: Snapping
```
1. Click on timeline near (but not on) a clip edge
2. Observe: Playhead snaps to clip edge (green dot)
3. Hold Shift, click near clip edge
4. Observe: Playhead goes to exact click (gray dot)
5. Release Shift
6. Observe: Green dot returns
```

**✅ Pass if:** Snapping toggles correctly with Shift key

---

### Feature 4: Visual Indicators
```
1. Click on a clip
2. Observe: Blue border + ring highlight
3. Hover over left edge of clip
4. Observe: Cursor changes to ↔, blue line appears
5. Move to middle of clip
6. Observe: Cursor changes to move cursor
```

**✅ Pass if:** All visual feedback displays correctly

---

### Feature 5: Playhead
```
1. Click at different positions on timeline
2. Observe: Red playhead moves, status bar updates
3. Click far right of timeline
4. Observe: Timeline may scroll, playhead follows
5. Note playhead time in status bar
```

**✅ Pass if:** Playhead follows clicks, time accurate

---

## 🧪 Unit Test Quick Check

```bash
npm run test:run
```

**Critical tests to verify:**

```
✓ creates empty timeline with main track
✓ validates gapless main track
✓ detects gap in main track
✓ migrates old session to new TimelineDoc
✓ inserts clip and ripples downstream
✓ deletes clip and ripples left (auto-compact)
✓ splits clip into two segments
✓ trims clip and ripples downstream
✓ moves clip within main track (reorder)
✓ maintains gapless after multiple operations
```

**✅ Pass if:** All tests green, no failures

---

## 🎯 Expected Results Summary

| Feature | Test | Expected Result |
|---------|------|-----------------|
| **Auto-Compact** | Add/delete clips | Always gapless, no manual fixing needed |
| **Undo/Redo** | Cmd+Z / Cmd+Shift+Z | Perfect undo/redo of all operations |
| **Snapping** | Click near edges | Snaps intelligently, Shift disables |
| **Visual** | Hover/click clips | Clear feedback (borders, cursors, colors) |
| **Playhead** | Click timeline | Moves smoothly, time updates accurately |
| **Tests** | npm test | 22+ tests pass, <5 seconds |

---

## 🐛 Quick Troubleshooting

### Tests Fail?
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
npm test
```

### TypeScript Errors?
```bash
# Check version (should be 5.x)
npx tsc --version

# If 4.x, force upgrade
npm install typescript@^5.6 --save-dev
```

### Demo Won't Load?
```bash
# Check for errors in browser console
# Verify Tailwind CSS is imported
# Check that React 19 types are compatible
```

### Snapping Not Working?
- Hold Shift to toggle
- Check green/gray dot indicator
- Try clicking directly on clip edge

---

## 📊 What "Success" Looks Like

### ✅ All Green
- Tests pass
- Demo loads
- Features work
- No console errors
- Smooth performance

### 🎉 You're Ready!
- Core engine validated
- UI functional
- Ready for integration

---

## 🚀 Next Actions

After verifying everything works:

1. **Review the code** (see REVIEW-GUIDE.md)
2. **Read documentation** (REFACTOR-COMPLETE.md)
3. **Plan integration** with your existing app
4. **Or** add remaining UI polish (drag-to-move, ghost preview)

---

**Questions?** Check:
- `REVIEW-GUIDE.md` - Detailed testing
- `TESTING.md` - How to run tests
- `REFACTOR-COMPLETE.md` - Full feature list
