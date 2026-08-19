# 10 · Workout Builder revamp — guided player + free-select Workout Map

> Upgrade the Workout Builder guided player in Training Mode with a navigation
> layer and a free-select workout map. The guided runner (voice counts, weighted
> windows, holds, weight logger, cadence) stays exactly as it is — this spec
> adds how the athlete MOVES through the workout: any order, one map.

Status: **SHIPPED** (FitBuilderGuidedPlayer.jsx + FitBuilderWorkout.jsx).

---

## 1 · Player chrome

- Standard TrainingHeader ("GUIDED WORKOUT", back arrow to the list).
- Sub-line: `Exercise n of N · any order — open the map`.
- Segmented progress bar — one segment per exercise:
  - ✓ done → solid gold · skipped → dim red · queued → dim track.
  - Current segment fills **violet→gold** set by set
    (`(set−1 + rest?1:0) / totalSets`).
  - The whole bar is tappable → opens the map.

## 2 · Binder tab (the map's permanent handle)

- Fixed bar ~52px tall pinned just above the tab bar (column-clamped with
  `fixedColumnBar`, z110 — above content, below the sheet).
- Label: `≡ WORKOUT MAP · swipe up · pauses the workout · {done}/{N}`.
- Tap **or** swipe up (≥ ~18px) expands the map — and **pauses** the workout
  (speech cancelled, announcer "Paused — map open").
- Closing the map auto-resumes with a spoken **3 · 2 · 1** count-in
  (only if the map itself paused the workout — a manually paused session
  stays paused).

## 3 · The Workout Map sheet

- Full-height bottom sheet (~90dvh), portalled to `document.body` z1000 so it
  covers the bottom nav (PhoneFrame isolation caps in-frame z-indexes).
- Grab handle + WORKOUT MAP title + `{done}/{N}` + ✕. Swipe down on the header
  (≥ ~80px) closes; backdrop tap closes.
- Helper line:
  `any order · hold to start · hold + swipe to skip · hold + drag ↕ to reorder · done rows lock.`
- Rows: `≡ index · name · 4×4-8 · rest 120s · status`, where status is one of
  - **SET n/N** + set pips (current, violet border),
  - **UP NEXT** / **QUEUED**,
  - **✓ DONE** (🔒 locked — no gestures, ~78% opacity),
  - **SKIPPED** (🔒 pinned for reorder, strikethrough name — but
    hold-to-start still works: only DONE is permanent).
- List scrolls at 6 rows and at 10+.

## 4 · Hold-to-start (charge)

- Press ≥ **250ms** arms the charge: a violet→gold fill sweeps the row over
  **~700ms** with a glowing leading edge + `HOLD… ⚡` label.
- Release early → the fill drains back (nothing happens).
- Full charge → haptic (`navigator.vibrate(30)`), sheet collapses, **3 · 2 · 1**
  voice count, the exercise starts.
  - Holding the **current** row = resume it.
  - Holding a **skipped** row clears the skip and re-enters it.
- Parent: `onJumpExercise(idx)` — clears `skipped[idx]`, sets `activeIdx`.

## 5 · Hold + swipe = skip

- After the charge engages, horizontal movement > 8px converts the gesture to
  a skip-swipe: red `SKIP ⇥` backing revealed, row follows the finger.
- Release past **~40% of the row width** commits: row flips to **SKIPPED**
  (unified with the player's SKIP EXERCISE state — same map, same status).
- Skipping the current exercise behaves like the SKIP EXERCISE button
  (advances). Below threshold the row springs back.

## 6 · Auto slide-up on completion

- When an exercise's last set lands the player does **not** auto-advance —
  the map owns navigation now:
  1. Gold toast: `✓ {NAME} — DONE · +{xp} XP` (xp = the real
     `XP_PER_FIT_EXERCISE`, exported from userStats.js).
  2. ~1.2s later the map auto-slides up in **complete mode**:
     finished row shows `✓ DONE · just now`; the next target glows
     (2px gold border + pulse) with a solid-gold `▶ NEXT` chip.
  3. Glow target = first non-done row after the finished one (wrapping);
     skipped rows are the fallback when nothing queued remains.
  4. **Any close** (swipe down, ✕, backdrop) starts the glowing exercise
     after a 3-2-1; holding a different row overrides.
  5. Nothing left → `onFinishWorkout` (back to the list / summary path).

## 7 · Hold + drag ↕ = reorder (pinned weave)

- After the charge engages, vertical movement > 8px lifts the row: floating
  copy (gold border, slight tilt, deep shadow) follows the finger; a dashed
  gold `DROP HERE · SLOT n` placeholder shows the landing slot live.
- **DONE and SKIPPED rows are pinned**: they keep their absolute positions
  (🔒, ~55% opacity while dragging), never lift and never accept drops —
  movable rows weave around them (`weaveOrder`).
- Dropping commits `onReorder(orderOldIndices)`; the parent remaps the
  index-keyed `completed`/`skipped` maps and follows `activeIdx` to its new
  position. Dragging the **current** exercise keeps its set progress — the
  player is keyed on the exercise's stable `_uid`, not its index, so a
  reorder never remounts it.

## 8 · Gesture disambiguation (one hold, three outcomes)

```
pointerdown ──> 250ms hold ──> CHARGE (700ms fill → start)
   │                             ├─ horizontal > 8px → SKIP-SWIPE
   │                             └─ vertical   > 8px → DRAG (if draggable)
   └─ any movement > 8px before 250ms → native scroll (gesture cancelled)
```
- First axis to cross 8px wins; the other is locked out.
- Rows keep `touch-action: pan-y`; a delegated **non-passive** `touchmove`
  listener on the list calls `preventDefault()` only while a gesture is
  engaged — idle scrolling stays native.
- **Move/up are delegated to `window`** while the map is open (matched by
  `pointerId`): a drag re-renders its row as the DROP placeholder, which
  destroys per-row handlers mid-gesture — per-row move/up froze the drag in
  testing; window listeners survive any re-render.

## 9 · Summary share card

- The end-of-workout SHARE card runs the full column width like the other
  summary cards (no 360px cap). Shipped separately in the builder-navigation
  pass (SharePromptModal inline placement).

---

## Parent wiring (FitBuilderWorkout)

- `withUids(list)` — every row gets a stable `_uid` (survives swaps: the swap
  handler spreads `...ex`). Player key = `guided-${exercises[activeIdx]._uid}`.
- New callbacks: `onCompleteExercise` (mark done, **no** advance),
  `onJumpExercise(idx)`, `onMarkSkipped(idx)`, `onReorder(orderOld)`,
  `onFinishWorkout`. Existing `onBack/onStop/onSkipExercise/onRewindExercise`
  unchanged.
- The runner awaits resume before announcing anything, so a reorder while the
  map is open restarts the current set silently — the 3-2-1 releases it.

## Acceptance criteria (all verified live)

- [x] Sub-line + binder tab render; tab shows `{done}/{N}` live.
- [x] Opening the map pauses; closing auto-resumes with 3-2-1.
- [x] Hold-to-start any non-done row; charge drains on early release.
- [x] Skipped rows re-enter via hold; only DONE is permanent.
- [x] Hold+swipe past 40% skips; current-row skip advances.
- [x] Completion: toast with real XP → auto map → `✓ DONE · just now` +
      `▶ NEXT` glow → close starts the glow target → all-done exits.
- [x] Hold+drag reorders with live DROP placeholder; done/skipped stay
      pinned; current exercise keeps set progress (no remount).
- [x] Native scroll intact (movement before 250ms never triggers a gesture).
- [x] lint 0 · tsc 0 · build:web exit 0.

*(Also saved as bolt-rebuild-kit/10-workout-map-free-select.md in the project.)*
