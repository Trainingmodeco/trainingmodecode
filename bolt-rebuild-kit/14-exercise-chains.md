# 14 · Exercise chains — supersets & circuits (WB-H)

Two or more exercises linked into **one block** that runs back-to-back with no
rest inside it, resting once at the end of each round. Two moves is a
**SUPERSET**, three or more is a **CIRCUIT**.

The whole design rests on one idea: once linked, a chain is **one thing**
everywhere. One bracket, one status, one hold, one swipe, one drag.

## Linking (builder list)

Every row already carries a `⛓` button beside its swap arrow.

- **Double-tap `⛓`** (< 400ms) → linking mode. The button glows and pulses
  (`.wo-linking`), every other row lifts to a violet wash with a `copy` cursor.
- **Tap any row** → it joins, and **moves to sit beside the chain** so the
  bracket is always contiguous.
- **Tap the glowing `⛓`** → leave linking mode.
- Single taps never chain. Only the deliberate double-tap arms it, so
  tap-to-swap, hold-to-move and swipe-to-remove all keep behaving exactly as
  they did.

A chain of one is not a chain: any structural edit runs `dissolveSingletons`,
so deleting or dragging a member out of the bracket quietly unlinks the rest.

### The bracket header
```
⛓ SUPERSET · A1 A2                     rest 120s at end   ✕
⛓ CIRCUIT · 3 MOVES ×   [−] 3 RDS [+]  rest 120s at end   ✕
```
- Rounds stepper on circuits only, clamped **2–5**, default 3.
- Supersets take their round count from the anchor's `sets`.
- `✕` breaks the chain and restores plain rows unchanged.

Members get a violet left edge, a wash, squared corners, and a ramp-coloured
`A1` / `A2` / `A3` chip. The ramp is a 10-hue spectrum
(`#8b3dff → #6366f1 → #3b82f6 → #22d3ee → #14b8a6 → #22c55e → #fde047 →
#ff8a3a → #ff5733 → #ef4444`) so a long circuit stays readable. The chain
itself is violet **structure**; the ramp only tints the position chips.

## Running one (guided player)

`chainCtx = { id, members[], position, round, rounds, circuit }`.

- `totalSets` is **1** inside a chain — each visit runs one round of this move.
- Mid-chain: phase goes to `done`, announcer says **GO STRAIGHT IN**, voice
  says *"Straight into Arm Haulers. No rest."*, and it hands over after 1.1s.
  **No rest timer is ever shown.**
- Last member, more rounds left: rest for the anchor's rest window with
  `⛓ CIRCUIT ROUND 2 OF 3` on the rest screen, then loop back to move 1.
- Last member, last round: *"Circuit complete."* → every member marks done and
  the workout advances past the whole bracket.

The pill reads `⛓ CIRCUIT · RD 2/3 · MOVE 1 OF 3 · NO REST` with move pips, and
the header counter reads `ROUND 2/3` instead of `SET n/m`. The announcer counts
**rounds, not sets** — "set 1 of 1" four times in a row is nonsense.

`SKIP SET` inside a chain means *hand over now*, not *this exercise is
finished* — routing it through `finishExercise` ends the bracket outright.
`SKIP EXERCISE` bails on the **whole** chain and lands past it.

## The WORKOUT MAP

The map treats a chain as one unit. This is the part with the most surgery
behind it.

```
≡1  Back Lever Push-Up            4×4-8 · rest 120s        QUEUED
┌─────────────────────────────────────────────────────────────┐
│ ⛓ CIRCUIT · 3 MOVES × 3                        ROUND 1/3    │
│  A1  Archer Push-Ups        4-8 · straight into the next ▶HERE│
│  A2  Arm Haulers            4-8 · straight into the next     │
│  A3  Around The World       4-8 · straight into the next     │
│ no rest inside · 120s at the end of each round               │
└─────────────────────────────────────────────────────────────┘
≡5  Aztec Push-Ups                4×4-8 · rest 120s        QUEUED
```

- **One status badge** for the block: `▶ NEXT` (glowing) / `ROUND n/m` /
  `NOW` / `UP NEXT` / `QUEUED` / `✓ DONE` / `SKIPPED`. Members carry only their
  ramp tag and, on the running one, `▶ HERE`.
- **Hold** anywhere on it starts the **chain, from the top** — not the member
  you happened to grab. If you're already inside it, the hold just resumes.
- **Swipe** skips every member and lands past the bracket, never on a move you
  just skipped. Re-entering any member un-skips the whole chain and resets the
  round counter.
- **Drag** moves the block. `weaveOrder` now works on **units** rather than
  rows — a chain contributes its whole member run, everything else a run of
  one — so a drop can never land inside a bracket and split it. Drop slots are
  counted per unit, and the whole run collapses to a single
  `DROP CHAIN HERE · SLOT n` placeholder. The floating drag card reads
  `⛓ CIRCUIT · 3 MOVES`.

The map hint line gains `⛓ chains move, start and skip as one.` whenever the
workout contains one.

## Implementation notes
- `_chain` is a cid string on the exercise object; it travels with the object
  through every reorder, so no separate index bookkeeping survives to go stale.
- Index-keyed `completed` / `skipped` maps are remapped on every structural
  change — delete, reorder, and chain-join all move indices.
- `chainRounds` (cid → rounds) lives on the builder and is passed to the player
  as `chainRoundsMap` so the map can label a chain that isn't running yet.
- Chain-wide side effects (skip-all, un-skip-all, land-past) are handled in the
  **parent**, in one `setState` each. Calling a single-index handler N times
  reads stale `activeIdx` on every call but the first.

Implemented in `FitBuilderWorkout.jsx` + `FitBuilderGuidedPlayer.jsx`.
