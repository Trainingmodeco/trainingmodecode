# AT YOUR PACE: the run screen's look (2026-11-24)

The owner's words: "too plain, very flat", "the pause and the stop buttons look
very flat", "I need the counter to work similar to how the counter works in all
the other timers", "the background should have the Training Mode T", "maybe a
lightning bolt", "too much lettering", "if I'm a couple of feet away I should be
able to see what the workouts are".

This is the look only (job A). Job B adds the pre-run screen (warm-up first,
then the workouts to look over and swap, the notes) and the coach voice.

## What the screen shows now (every format)

Top to bottom, the first three parts stay on screen (the head is sticky):

1. **Title line.** AT YOUR PACE and the format (EMOM, AMRAP, FOR TIME, MAX SETS,
   MAX REPS, CIRCUIT, CHECK-OFF) in gold, the workout's name under it.
2. **The ring and the move in hand, side by side.**
   - The ring is the clock, drawn like the guided timers' rings: a glowing arc,
     the time large in the middle, one word under it. A soft lightning bolt
     glows behind it (Quick Mission is the lightning mode).
   - Beside it, the move to do now: its name very large and white, its reps or
     time large in gold, and "NEXT:" the move after it.
3. **The tap buttons**, when the format has them: UNDO (raised, quiet) and the
   big gold ROUND / SET / DONE; FINISH (gold) for a for-time workout; I PUT IT
   DOWN (red) for an until-down workout, with its safety line under it.
4. **Every move of the workout** in a bright list: names 20 px bold white,
   reps 20 px gold. The move in hand is lit (gold glow and a gold bar at its
   left), the ones already done this round are ticked and dimmed. The swap
   arrows are still on the rows, small and quiet. A move's how-to note (for
   example "Switch sides every minute.") shows on the lit row. The list scrolls
   under the head when a workout has many moves.
5. **PAUSE and STOP** in the bar fixed above the tab bar, always on screen:
   raised buttons like START. PAUSE is violet, STOP red; when paused, RESUME
   turns gold and glows.

Behind it all: the Training Mode background with the T, brighter in the head,
and a large glowing T behind the moves. The head takes on the phase colour
(gold for work, blue for rest).

### The ring in each format

| Format | Big number | The arc | Word under it | Line under the ring |
|---|---|---|---|---|
| EMOM | time left in this set or minute | what is left of it | WORK (gold) or REST (blue) | SET 2 OF 21 (or MIN 3 OF 16), ELAPSED |
| Intervals | time left in the segment | what is left of it | WORK / REST | ROUND 3 OF 8, ELAPSED |
| AMRAP (one block) | time left of the whole clock | the clock's time left | AMRAP 12 | ELAPSED |
| AMRAP (several blocks) | time left in the block or the rest | what is left of it | WORK / REST | BLOCK 2 OF 3, ELAPSED |
| For time, generated | the time so far | the share of the time cap used | CAP 30:00 | (none) |
| Until down (NO CONTINUES) | the time so far | the share of the safety cap used | CAP 30:00 | (none) |
| Max reps (MAX OUT) | the time so far | the share of the cap used | CAP 20:00 | (none) |
| Check-off (Fit card) | the time so far | the share of the workout ticked | 52% DONE | ROUND 2 OF 3, THIS ROUND |

For the count-up formats the arc fills toward the cap, so you can see how much
time is left at a glance; it turns red in the last minute, when the warning
beeps. GET READY counts 5 to 1 in a violet ring. When paused, the arc dims and
the word reads PAUSED.

### The move panel in each format

- **EMOM, intervals:** NOW, the minute's move and its reps; NEXT, the next
  minute's move and reps. In a rest: REST, and NEXT.
- **Max reps:** ROUND 1 OF 3, the station's move, MAX REPS; NEXT, the next
  station. In the rest between sets: REST and the time left (blue).
- **Until down:** SET 1, the block (Both Hands, Left Arm...), 3 EACH; NEXT, the
  next block.
- **AMRAP, for time, generated (circuits):** every move is part of the round, so
  no single row is lit. The panel shows THIS ROUND, ROUND 2 OF 5 and that
  round's running time in gold, then the last round's time (or "TAP ROUND AT
  THE END" before the first). A rest between rounds shows REST and its time.
- **Check-off:** NOW, the next move to tick, its reps; NEXT, the move after it.

## What was removed from the run screen, and where it went

Nothing was deleted from the workouts' data: every line below is still stored
on the mission (`mission.pace`, `paceBasis`, `load`, `note`, `missionLine`,
`tapHint`, `safety`) and job B puts it on the pre-run screen.

| Removed | Where it is now |
|---|---|
| The PACE card (ELITE / STANDARD / BEGINNER, "The pass: ...", "Beeps play while the screen is on.") | data kept; the pre-run screen (job B). The results screen still scores the run the same way. |
| The LOAD line (kettlebell weights) and the note under the moves (the warm-up paragraph) | data kept; pre-run screen (job B, which also adds the 5-minute warm-up first) |
| The format sentence over the moves ("100 ONE-ARM SWINGS IN 5:00 · REST 1:00 · ...") | data kept; pre-run screen. The run shows the same thing as the ring, the move panel and the list. |
| The tap-hint lines ("Tap ROUND when a round is done...", NO CONTINUES' "SET is optional") | data kept; the move panel says "TAP ROUND AT THE END" until the first round is in; the coach voice (job B) explains the rest |
| The level word in the title strip (STANDARD, MEDIUM) and SCALED | on the setup card and the pre-run screen |
| The splits line under ROUND ("R1 1:05 · R2 ...") and LAST / ROUNDS / TOTAL line | the move panel shows the round's time and the last round's; every split is on the score panel and the results |
| MAX OUT's safety card ("Stop a set when your form breaks...") | the lit station's own stop line ("Stop when your hips sag...") stays on its row, bright; the whole safety card goes to the pre-run screen |

**Kept on the run screen:** NO CONTINUES' safety line ("Grip starting to open?
Park the bell between your feet. Never let it fly.") stays right under I PUT IT
DOWN, brighter. It is how the set is done (the run ends when the bell touches
the floor), so it belongs where the hand is.

## What did not change

The bells and beeps, the clock's rules (it runs on when the screen locks; only
PAUSE stops it), the score panel, the swap sheet, MAX REPS' HOW MANY REPS?
sheet, END MISSION?, autosave and Continue. The guided Quick Mission, Combat
Conditioning, the warm-up timer and the Workout Builder player keep their own
rings: the new ring (`shared/RunRing.jsx`) is shared by the two AT YOUR PACE
screens only, so those screens look exactly as before.

## Files

- `components/training-mode/QuickMissionSolo.jsx`: the run screen.
- `components/training-mode/fit-challenge/ui/CheckOffRun.jsx` and
  `CheckOffTracker.jsx`: the Fit card's check-off run (same ring and head,
  bigger rows).
- `components/training-mode/shared/RunRing.jsx`: the ring with the bolt.
- `components/training-mode/shared/RunBar.jsx`: PAUSE / STOP (raised
  TrainingCTA skins), the head's sizes per phone height (RUN_CSS), the head's
  backdrop with the T (RunBackdrop) and the large T behind the moves
  (RunWatermark).
- `scripts/fit-card-preview.mjs`: the `pace-*` states (FIRST BELL added) now
  also check the ring, the size of the move in hand and of the lit row, the
  raised buttons, and that the removed text stays off the run screen.

New animation (the button shimmer, the RESUME glow, the ring's arc) stops for
anyone whose phone asks for reduced motion.

Small phones (320x568 and other screens 600 px tall or less): the ring, buttons and safety line shrink so the first move clears PAUSE / STOP; the move name stays 20 px.
