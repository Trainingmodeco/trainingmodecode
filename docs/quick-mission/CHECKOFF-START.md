# The Fit card's CHECK-OFF run: the same start as AT YOUR PACE (2026-11-26)

Owner, 2026-11-26: "Fit card check-off run - need to start". The CHECK-OFF run (the Fit card's AT YOUR PACE with tick
boxes, behind the `fitCard` switch: owner preview only) used to start straight into GET READY. It now starts the way
the regular AT YOUR PACE run does (docs/quick-mission/PACE-FLOW.md):

1. **WARM-UP, 5:00** (`shared/WarmupTimer.jsx`, teal SKIP WARM-UP). Easy warm-up ideas: the card's moves have no
   warm-up words of their own.
2. **WORKOUTS.** Every move of the card, large and bright, the format in one gold line (`CHECK-OFF · 3 ROUNDS · CAP
   40:00`), a **SWAP** button on each move that has a stand-in (the card's own swap sheet, the same options as on the
   card: EASIER / SIMILAR / HARDER / NO GEAR), UNDO on a swapped one, the round **i** (pace targets, what the ticks
   do, "Beeps play while the screen is on") and the big gold **START**. Back goes to the Fit card page, which opens
   as it always does (today's deal; what was on the card before is not carried back).
3. **GET READY** (5 s, longer while the coach speaks), then the run, which is unchanged: rows with tick boxes,
   rounds, RunBar, SHUFFLE / ROUNDS, results.

A swap on WORKOUTS replaces that one move on the card and in the run (dose and rest kept) and goes into the saved
state (`mission` and `card`), so Continue, the results, REPEAT and SAVE WORKOUT read the swapped move. SHUFFLE and
ROUNDS in the run start again from GET READY (quietly), not from the warm-up, as before.

Saving: the warm-up and WORKOUTS report `{ kind: 'solo', checkOff: true, preRun: true }`, which App stashes nothing
for; nothing is kept for Continue until GET READY. They add nothing to elapsed time, XP, stats or integrity (time the
phone is hidden during them is not counted either). A run restored from a stash (Continue, the floating resume, a
reload) goes straight back into the run: no warm-up, no WORKOUTS, no spoken start. A stash written by the old code
(phase `ready` or `paused` with ticks) restores exactly as before.

## What is shared

`shared/PaceStart.jsx` holds what QuickMissionSolo used to own: `WorkoutsScreen`, `RunMoveRow` and `formatSummary`,
moved as they were (QuickMissionSolo imports them; its photos are identical). `WorkoutsScreen` takes two optional
props, `formatLine` (the format line) and `infoMission` (the "i" sheet's words); CHECK-OFF passes both. The warm-up
is `shared/WarmupTimer`, the lines are `data/paceVoice.js` (`PACE_WARMUP`, `workoutsLine`, `startLine`).
`fit-challenge/FitCheckOffSolo.jsx` runs the phases `warmup` -> `workouts` -> `ready` -> `running` / `paused`;
`FitCardSetup` also puts the pull-up bar switch on the card (`card.bar`) so a swap there offers the right moves.

## The coach

Only the start is spoken (the run stays on bells and beeps, as before). Timing never waits on speech; a silent speech
engine changes nothing.

| When | Said |
|---|---|
| Warm-up | the same four lines as AT YOUR PACE (`PACE_WARMUP`) |
| WORKOUTS | "Your workout is set. At your own pace. Swap any move before you start." (or "...Tap start when you are ready." when no move can swap) |
| GET READY | "Workout starting. At your own pace. **Tick each move as you do it.** Tap finish when you are done." |

One new sentence: **"Tick each move as you do it."** (`CHECKOFF_HOWTO` in `data/paceVoice.js`; the tick boxes are what
the athlete taps, FINISH shows once every round is ticked). It is swept in `scripts/sweeps/pace-voice.mjs` and
recorded as one plain clip in both voices, `tick_each_move_as_you_do_it.mp3` (female 1.80 s, male 1.80 s; both banks
at version 30). `FitCheckOffSolo.jsx` is listed in `scripts/voice-coverage.mjs`.

## Proof

`scripts/fit-card-preview.mjs`: the states that start a check-off run walk the new start (`checkOff()` takes `stop`
and `swap`); new states `pre-checkoff-warmup`, `-warmup-bonus`, `-workouts`, `-workouts-bonus`, `-swap`, `-swapped`,
`-info`, `-run-swapped` and `pace-checkoff-bonus`. `scripts/smoke-web.mjs`: "owner: the Fit card CHECK-OFF starts with
the warm-up, then WORKOUTS ...".
