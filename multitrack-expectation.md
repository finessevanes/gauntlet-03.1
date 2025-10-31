# Multitrack Timeline Specification

For building a CapCut-style multitrack timeline editor in Electron + React.

---

## Core Concepts

**Non-destructive editing**: Trims/splits don't change source files—only in/out points.

**Magnetic main track**: No gaps allowed. Moving, removing, or trimming clips causes downstream clips to ripple.

**Linked A/V**: Video and audio are linked by default; moving one moves the other unless explicitly unlinked.

**Snapping vs Magnetism**:
- **Snapping** = UI aid during drag (edges align to playhead, markers, clip edges, grid). Visual only.
- **Magnetism** = data invariant: lane stays gapless; edits ripple neighbors to preserve continuity.

---

## Track Behaviors

### Main Track (Backbone)
- **Gapless + ripple by default**: No gaps, no overlaps. Edits shift downstream content.
- **Insert semantics**: Dropping a clip inserts it and shifts all downstream clips right (later in time) to make room.
- **Delete**: Remove clip and shift all downstream clips left (earlier in time) to close the gap (collapse).
- **Trim in/out**: Shorten pulls everything left; extend pushes right (unless overwrite mode).
- **Linked A/V anchor**: Linked audio rides with video; detaching moves audio to audio track.
- **Global time driver**: Changes here affect timeline length and all other tracks' relative positions.

### Other Tracks (Video Overlays, Audio, Titles, Stickers)
- **Non-magnetic (gap-friendly)**: Gaps allowed; adding/removing doesn't ripple main track.
- **Layered/composited**: Sit above/below/beside main track (z-index or mix order, not story order).
- **Independent timing**: Can start/stop anywhere, overlap (in different lanes), hang "over the edge" of main edits.
- **Freeform transforms**: Position, scale, rotation, keyframes allowed (unlike main track clips).
- **No ripple by default**: Moving/shortening doesn't shift neighbors; placed absolutely.
- **Audio specifics**: Overlaps, fades, gain envelopes allowed; no magnetic behavior; timing won't push other audio.

---

## Track Policies

Define these per track to control behavior:

```typescript
isMagnetic: true | false
  // true ⇒ lane is gapless; edits ripple
  // false ⇒ gaps allowed; no automatic ripple

defaultMode: 'ripple' | 'overwrite'
  // How inserts/moves/trims affect neighbors

allowSameLaneOverlap: true | false
  // Usually false

autoPack: 'none' | 'firstFit' | 'bestFit'
  // How new/dragged clips choose a lane to avoid collisions

snapTargets: set of 'playhead' | 'clipEdges' | 'markers' | 'grid' | 'beats'

linkedGroupPolicy: 'lock' | 'follow' | 'free'
  // How linked A/V behave when one moves

silenceFill: 'shift' | 'insert-silence' (audio only)
  // If magnetic audio must remain continuous
```

**Example presets**:
- **Main track**: `isMagnetic=true, snappingEnabled=true, allowSameLaneOverlap=false`
- **Overlay (freeform)**: `isMagnetic=false, snappingEnabled=true, allowSameLaneOverlap=false`
- **Magnetic overlay** (secondary track): `isMagnetic=true, snappingEnabled=true, allowSameLaneOverlap=false, autoPack='firstFit'`

---

## Lane Invariants

**Magnetic lane**: For all adjacent clips `i` and `j`:
```
i.start + i.duration == j.start  // no gaps, no overlaps
```

**Non-magnetic lane**: For all adjacent clips `i` and `j`:
```
i.start + i.duration <= j.start  // overlaps depend on allowSameLaneOverlap
```

---

## Data Model

```typescript
type Tick = number;  // integer timebase (1 tick = 1/1000s)

type TrackRole = 'main' | 'overlay' | 'audio';

interface Clip {
  id: string;
  sourceId: string;
  srcStart: Tick;        // in-point in source
  duration: Tick;        // visible duration on timeline
  start: Tick;           // absolute start in timeline
  linkedGroupId?: string;
  locked?: boolean;
  attrs?: { transitionIn?: any; transitionOut?: any };
}

interface Lane {
  id: string;
  clips: Clip[];         // kept sorted by start
}

interface Track {
  id: string;
  type: 'video' | 'audio';
  role: TrackRole;
  lanes: Lane[];         // main: exactly 1 lane
  locked?: boolean;
}

interface Marker {
  id: string;
  at: Tick;
  kind: 'beat' | 'user';
}

interface TimelineDoc {
  timebase: { ticksPerSecond: number };  // e.g., 1000
  tracks: Track[];                        // main first
  markers: Marker[];
  selection?: { clipIds: string[]; playhead: Tick };
}
```

---

## Core Invariants

1. **Main track gapless**: For all adjacent clips `i,j` in main track's single lane:
   ```
   i.start + i.duration == j.start
   ```

2. **No same-lane overlap**: Clips in the same lane don't overlap (unless explicitly allowed).

3. **Linked groups aligned**: Clips with the same `linkedGroupId` move/trim together unless unlinked.

4. **Ripple vs Overwrite**:
   - **Ripple (default)**: Edits expand/contract timeline; downstream clips shift.
   - **Overwrite (explicit)**: Edits replace content without shifting downstream timing.

5. **Source bounds**: `srcStart + duration ≤ media length`.

6. **Transitions as metadata**: Encoded in clip `attrs`, not as true overlaps (preserves main track gapless invariant).

---

## Operation Contracts

All operations return: `{ newState, patch, selection, snapPoints }`

### insert(clip, atIndex | atTime, trackId, mode='ripple')
- **Main track**: Insert at boundary and shift all downstream clips right (later in time) to maintain gapless invariant; in overwrite mode, truncate/replace collision region.
- **Others**: Place at absolute time; choose first lane without collision (create new lane if needed).

### move(clipId, toTime, toTrack?, toLane?, mode='ripple')
- Enforce invariants.
- **Main track**: Ripple mode.
- **Overlays**: Choose collision-free lane or reject.

### split(clipId, atTime)
- Produce two clips whose durations sum to original.
- Preserve linked groups.

### trimIn / trimOut(clipId, newIn | newOut, mode='ripple')
- **Main track**: Ripple neighbors.
- **Others**: Don't shift neighbors.

### delete(clipId) / rippleDelete(clipId)
- **Main track rippleDelete**: Remove the clip and shift all downstream clips left (earlier in time) to close the gap (collapse).
- **Others**: Remove only; downstream clips stay at their absolute times (gap remains).

### detachAudio(clipId)
- Create audio clip with same group.
- Unlink video/audio on request.

### applyTransition(leftClipId, rightClipId, type, duration)
- Adjust effective trim to create overlap window.
- Preserve main track gapless invariant via metadata encoding.

---

## Snapping & Precision

**Snapping toggle**: On by default; modifier key temporarily disables.

**Snap targets**: Playhead, clip edges, markers, beats, grid.

**Zoom**: Finer zoom → frame-accurate trim/splits.

**Edge cases**:
- Extending past media duration: hard stop/"media limit" indicator.
- Dragging out of bounds: stops at limits.
- Undo/redo: preserves selection and playhead.
- Locked clips/tracks: can't be moved; main track lock disables ripple moves.

---

## Acceptance Checklist

- ✓ Main track remains gapless after any sequence of ops.
- ✓ Overlays/audio accept gaps and overlaps; lane packing stable.
- ✓ Snapping is frame-accurate at all zooms; modifier disables snapping.
- ✓ Undo/redo restores both state and UI selection/playhead.
- ✓ Cannot extend beyond media; shows limit indicator.
- ✓ Large projects (5k+ clips) keep drag latency < 16ms/frame in viewport.

---

## Implementation Priorities (Must-Haves)

1. **Single source of truth (SSOT) + invariants**
   - Canonical timeline document (tracks → lanes → clips).
   - Invariant assertions on state mutations.

2. **Deterministic edit operations (transactional)**
   - Each op validates invariants and returns new state + patch.
   - Modes: ripple (default) vs overwrite.

3. **Collision + snapping engine**
   - Snap to: playhead, clip edges, markers, beats, grid.
   - Predictive collision detection to choose lane or reject move.
   - Ghost preview while dragging.

4. **Undo/redo via command pattern**
   - Every op is a command with `do()`/`undo()`.
   - Batched transactions for multi-select drags.

5. **Performance & rendering**
   - Virtualized viewport (only render visible region).
   - Offscreen canvas for thumbnails/waveforms.
   - Throttled drag updates.
   - O(log n) inserts/moves via interval trees or sorted arrays per lane.

6. **Robust edge-case handling**
   - Media limit stops, frame rounding, out-of-bounds, locked clips/tracks, short clips, zero-length guards.

7. **Fixture-driven tests**
   - Golden fixtures for common edits (simple insert, move with ripple, detach audio, transitions, edge cases).
   - Property-based tests for invariants (e.g., "main track has no gaps").
