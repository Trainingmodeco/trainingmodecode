# 13 · Exercise Info sheet (WB-G)

**What it answers:** "what IS this exercise?" — the single biggest drop-off
point for a beginner staring at *Archer Inverted Rows* with no idea what to do
with their body. Display-only. It never changes the workout unless it's opened
from a SWAP row, where it also carries the commit action.

**Where it opens from**
- the exercise NAME on a generated list row (`FitBuilderWorkout`)
- the exercise NAME on the guided player, mid-set (`FitBuilderGuidedPlayer`)
- a SWAP row — `fromSwap`, which adds the gold `✓ USE THIS EXERCISE` button so
  you can look before you leap

## Layout

Bottom sheet, portalled to `document.body` (PhoneFrame's `isolation: isolate`
caps in-frame z-index, and the tab bar is a sibling at z100). Stops at `NAV_H`
so it rests **on** the bottom nav instead of covering it.

**Everything fits at once, by design.** No internal scrolling in any state —
it has to stay readable one-handed between sets. That's why the demo panel is
16:9 rather than square: it leaves room for cues + mistakes + swaps below.

```
────  handle
ARCHER INVERTED ROWS                              ✕
[BACK] [BODYWEIGHT] [●●○ INTERMEDIATE]

┌────────────────────────────────────┐  16:9, violet border
│         demo loop / waiting room   │  ▶ LOOP · MUTED badge when ready
└────────────────────────────────────┘

HOW TO
1  gold numeral · cue
2  …                                  (max 4)

COMMON MISTAKES
✕  red · mistake                      (max 2 — the ONLY red on the sheet)

[ EASIER  ← INVERTED ROW ] [ HARDER  ONE-ARM ROW → ]
      tap to swap this exercise for the easier or harder version

[ ✓ USE THIS EXERCISE ]               (fromSwap only)
```

### Demo panel — three states
| state | what shows |
|---|---|
| `loading` | violet shimmer sweep (`xi-shimmer`, 1.4s) |
| `ready` | the looping `.webp`, `▶ LOOP · MUTED` badge top-right |
| `none` | radial violet glow, 🥋 in a ringed circle, **DEMO ON THE WAY**, *the cues below have you covered* |

Art lands progressively, so "not yet" has to look **deliberate**, not broken.
`onError` falls back to `none`, so a missing file is never a broken-image icon.

Demo source: `/static/exercise-demos/<exercise-id>.webp` (public assets live
under `/static/`, never `/assets/` — Metro reserves that path).

### EASIER / HARDER
Rendered **only when `onSwapTo` is provided**. Mid-set in the player there's
nothing to swap into, so they're hidden rather than shown as dead chips.

## Content model — `data/exerciseInfo.js`

Cues are matched by **movement family**, not per-exercise. 26 families, tested
most-specific-first so `scapular-push-up` wins before `push-up`:

```
scapular-push-up · handstand-push-up · push-up · pull-up · inverted-row ·
row · dip · triceps-extension · overhead-press · chest-press · curl ·
lunge · squat · hinge · glute-bridge · glute-kickback · calf-raise ·
raise · shrug · rollout · plank · core-flexion · jump · crawl · conditioning
```

Each family carries `{ test, cues[], mistakes[], easier, harder }`.

- `exerciseInfo(ex)` → `{ familyId, cues, mistakes, tempo, easier, harder, demoSrc }`
- `resolveSwap(...)` prefers the family's named target, then falls back to
  `fallbackByDifficulty` — same `primaryMuscle`, exactly one RANK step away.
- `difficultyPips(difficulty)` → `{ label, pips }` for the gold pip chip.

Writing 26 families beats writing 400 exercise entries, and a new exercise that
matches an existing family gets real coaching for free.

## Notes
- Swapping copies `alt.id` as well as the name. Without it the row keeps the
  old exercise id and the weight log, history sheet and demo all key to the
  wrong movement.
- Red appears exactly once on this sheet (COMMON MISTAKES). Everything else is
  violet structure + gold emphasis.

Implemented in `shared/ExerciseInfoSheet.jsx` + `data/exerciseInfo.js`.
