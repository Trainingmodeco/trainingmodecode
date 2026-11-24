# The workout card: build notes (2026-11-23)

The Fit WORKOUT CARD the owner approved as looks (LOOKS-NOTES.md), built into the app: Quick
Mission, a library mission on the card, a program day's preview, the AT YOUR PACE CHECK-OFF run, its
results, SAVE WORKOUT and YOUR WORKOUTS. Everything sits behind one switch; with it off, Fit Mode is
exactly as before.

## The switch

`fitCard` in `components/training-mode/data/retentionFlags.js`: off in `FOR_EVERYONE`, on only with
the owner preview (`tm_owner_preview`, data/concepts). Every screen reads it once per mount (a
`useState` initialiser):

| where | switch on | switch off |
|---|---|---|
| Quick Mission page (`fit-challenge/QuickMissionScreen.jsx`) | `fit-challenge/FitCardSetup.jsx` | `QuickMissionSetup.jsx`, untouched |
| Programs | the day's card (`fit-challenge/ProgramDayCard.jsx`) | the CONTINUE PROGRAM card as before |
| Progress | a YOUR WORKOUTS card and page | as before |

`tm_preview_off` (a comma list, e.g. `fitCard`) holds a switch off inside the owner preview: the
smoke test keeps the Mission Library page under the preview that way, and the owner can too. It
never turns a switch on.

The rest only reacts to data that only the card writes, so it never fires with the switch off: a run
config with `card` / `checkOff` (ScreenRouter picks `FitCheckOffSolo` and `FitCardResults`), a result
with `card` (App adds scalar fields to its one session row), a cardio add-on with `bonus` (no XP), an
exercise with `counted` (the coach counts it), the stored `bar` key in `tm_qm_keys_v1` (kept only once
the card writes it), and the generator's `balanced` option. `test:challenge` holds all of that ("the
switch off" section: the generator deals draw for draw as before without `balanced`, and so on).

## What was built

- `data/fitCard.js` (pure): the card's mission (`cardMission`: today's seeded deal, FULL BODY WARRIOR,
  a saved snapshot), rounds + / −, the bar stand-ins, swaps, the totals by the run's own timing model,
  the BALANCED line, BONUS TRAINING and the cool-down add-on, YOUR WORKOUTS rows, a run's reps.
- `data/fitCardStore.js`: one synced key, `tm_fit_card_v1` (in `cloudSync` SYNC_KEYS): SAVE WORKOUT's
  shelf (10), the last 20 card runs (for YOUR WORKOUTS' repeat), the CHECK-OFF choice.
- `fit-mode/quickMissionGenerator.js`: the balanced pools (`BALANCED_BODYWEIGHT`, `BALANCED_WEIGHTED`,
  every name already recorded in both voices) and `pickBalanced`, used only with `balanced: true`.
- `fit-challenge/FitCardSetup.jsx` (the page), `FitCheckOffSolo.jsx` (the run), `FitCardResults.jsx`,
  `WorkoutsPage.jsx`, `ProgramDayCard.jsx`, `QuickMissionScreen.jsx`; the looks' components in
  `fit-challenge/ui/` reused, with `RoundsStepper.jsx` new. WorkoutCard, CheckOffRun, DiscardConfirm,
  BonusBlock, ChallengeResults and WorkoutHistoryList gained optional props only; the looks page
  (`/fit-looks`) still draws as before.
- Wiring: `ScreenRouter.jsx`, `App.jsx` (banking the card fields, the cool-down's no-bonus),
  `CardioFinisherPlayer.jsx` (a bonus cool-down logs unpaid, reads COOL-DOWN · UP NEXT),
  `QuickMissionAdjustSheet.jsx` (cardio optional), `ProgressScreen.jsx`, `ProgramsScreen.jsx`,
  `data/workoutPrograms.js` (`programDayConfig`, the pure half of `startProgramDay`),
  `data/quickMissionTiming.js` (`counted`), `data/userStats.js` (`cardFields`).
- The "?" guide: `quick_mission_card` in `shared/screenGuides.js` (13 steps, anchors `fc-*`).

## The owner's choices, and how each was done

- **Rounds** (the owner's note: "the rounds are generated. Still based on time. If the user wants more
  rounds they can hit a plus button ... and it generates the amount of rounds and reps"). TIME stays
  the input and the generator deals the moves, reps and rounds for it, as Quick Mission always did.
  The card shows the rounds and the sum (`58 × 3 = 174 reps · About 20 min`, a hold's seconds beside
  it). **+** adds a round of the same list (every round of a generated mission runs the same moves),
  **−** takes one off (1 to 10). The minutes follow the rounds by the guided run's own timing model,
  and the XP follows the minutes (minutes × the level's rate + 30), so 5 rounds pays more than 2.
  Touching TIME gives the rounds back to the time. TIME stays on the minutes asked; the line opposite
  it says "+1 round · about 27 min" when the card runs longer or shorter than the slider.
- **START on the first screen.** The card opens closed: SHUFFLE / CHOOSE, the rounds and the sum, the
  first moves (two on a phone under 800px tall), SEE ALL, GUIDED | AT YOUR PACE, START. The preview
  checks START ends above the tab bar at 360, 390 and 430 wide.
- **Opens on a fresh balanced deal each day; FULL BODY WARRIOR one tap away in CHOOSE.** One seed a day
  (`daySeed`); SHUFFLE deals the next one at the same level, gear, focus and rounds. CHOOSE lists TODAY'S
  DEAL, FULL BODY WARRIOR, YOUR SAVED, then the library by body part (each mission's own focus) and
  SURPRISE ME at its foot. WARRIOR keeps its doses (99 a round); its rounds come from the time too.
- **Push / pull balance: one BALANCED line**, under the moves when the card is open
  ("3 push · 2 pull · legs · core · arms"). No tag on the rows.
- **Reverse Curls**: Resistance Towel Curls (recorded) holds the arms slot. Reverse Curls stays in
  `exercise-loops/PENDING.md` for the next recording batch.
- **Inverted Rows**: kept, with "table or low bar" under the name (Wide Inverted Rows too).
- **CHECK-OFF: a remembered choice inside AT YOUR PACE.** With AT YOUR PACE picked, a CHECK-OFF row
  sits under the switch (on until turned off, kept in `tm_fit_card_v1`). The run: rounds of 40px tick
  boxes, only the current round takes ticks, a round counts when every move is ticked, each round's
  time from its last tick; GET READY, PAUSE, STOP and FINISH as AT YOUR PACE. It ends in AT YOUR PACE's
  result shape, so App settles it with `settleSoloXp` exactly as before.
- **The confirm box** (the owner's note: "Add END at the bottom just in case the user wants to just
  stop"). SHUFFLE with ticks, or ROUNDS below the rounds started, asks START OVER?: KEEP GOING,
  SHUFFLE (or START OVER), and END at the bottom, which ends the workout the normal way (banked, as AT
  YOUR PACE's END). With no ticks, SHUFFLE needs no question; more rounds keep every tick.
- **Bonus training** (the owner's note: "make cardio the top option. If click cardio, workout goes
  automatically into cool down cardio routine"). BONUS TRAINING, folded under the page, has Cardio
  cool-down first. Ticked, the run carries it as its cardio add-on, so when the workout ends the app
  goes straight into it: the cardio finisher Quick Mission already plays after a mission
  (`CardioFinisherPlayer`, its steady timer and its own existing lines, nothing new spoken), here an
  easy 10-minute walk headed COOL-DOWN · UP NEXT. The rest are ticks for the visit. Bonus work pays
  nothing (the cool-down logs as cardio with no XP and no hybrid bonus) and is not on the results.
- **Program days: the card is the day's preview.** The program's next day on the card (its day pips,
  SHUFFLE THIS DAY, the builder's own sets × reps); START (RESUME once the program is under way) opens
  exactly that list in the Workout Builder, which runs and pays it as before.
- **YOUR WORKOUTS on the Quick Mission page and in Progress, for every mode.** One row a finished
  workout (any mode; the daily and hybrid bonuses are not workouts), newest first, with the last 7 days
  on top. A card run's row has its title, rounds and reps (scalars on its session row); a kept card run
  goes back on the card ("From your workouts").
- **Swap and the results: "Fine", as mocked up.** A swap offers EASIER / SIMILAR / HARDER of the same
  pattern and kind and NO GEAR for a bar or table move; it keeps the dose and rest, so the time and the
  XP never move. The results are the app's end screen with the card's stats and recap and REPEAT, NEW
  CHALLENGE, SAVE WORKOUT. **SAVE WORKOUT keeps a workout to repeat and never pays XP again**: it writes
  only the saved shelf; the run was banked once, before the screen opened. REPEAT is a new run.

## Voice

- The card adds no spoken line. GUIDED runs the card's mission in the Quick Mission runner, which says
  every move by name and the round calls; CHECK-OFF is bells and beeps only.
- Every move the card can deal has a plain clip in both voices (`QUICK_MISSION_POOL_NAMES` includes the
  balanced pools, swept by `test:spoken`). The card's bodyweight rep moves are dealt with `counted`, so
  the coach counts pull-ups, rows and dive bombers like push-ups; without it they would have said the
  manual line, which has no recording.
- New sweep `scripts/sweeps/fit-card.mjs`: the card's missions over every level, gear, 5 to 60 minutes,
  rounds 1 to 10, the bar on and off, WARRIOR and a swap into every slot, said the way the runner says
  them (3,926 lines). `npm run voice:coverage`: 0 missing; `test:spoken`: 158 passed.

## Preview

`CHROME_PATH=/opt/pw-browsers/chromium node scripts/fit-card-preview.mjs <out-dir> --base http://localhost:8085`
(dev server first, restarted with `--clear` after an edit). The owner preview on, a sample athlete (a
week of workouts of several modes, two of them card runs), Monday 23 November 2026, 10:00. Every state at
360x780, 390x844 and 430x932, scale 2: the phone's first screen, and the whole page for the long ones
(`-full`). It fails on sideways overflow, cut text, a missing word, START off the first screen, or a last
line under the tab bar. States: card-closed, card-plus, card-open, card-shuffle, choose, warrior, swap,
nobar, saved-nobar, program, program-open, bonus, guided, checkoff, confirm, rounds, cooldown, results, saved,
workouts, workouts-repeat, progress, progress-workouts, and off-quick-mission, off-programs,
off-progress (the switch off: as before).

## Tests

`npm run test:challenge` (128 checks, now in `check:all`): the looks' arithmetic, the rounds from the
time and the + button, the balanced deal and WARRIOR, the coach's count, the bar and swaps, the switch
off, SAVE WORKOUT and YOUR WORKOUTS, the cool-down hand-off, END in the confirm box, XP paid once.

Run for this build, all passing: test:qm, test:missions, test:xp, test:levels, check:exercises,
test:voice, test:clips, test:spoken, voice:coverage (and `--strict`), test:challenge, test:ayp,
test:storage, practice-moves, streak, nearmiss, power, maxout, athlete, path, concepts,
entitlements, audit:cc; tsc; eslint on the changed files; check-guides; lock-assets; build:web; the
web smoke for Home, Fit hub, Quick Mission, Programs, Progress, Max Out and the owner's Quick Mission
checks (with a new one for the card: SHUFFLE, CHOOSE, the rounds, + and START); the preview above (26
states at 3 widths, all fit, re-run after the review fixes).

## Review fixes (2026-11-23)

- **SHUFFLE inside a CHECK-OFF run** now makes the card the new deal's: its title, rounds and moves
  (`fitCard.shuffleCard`; `snapshotOf` never lets what it adds replace the mission's own fields).
  Before, the card kept the old moves, so the reps banked, the results, SAVE WORKOUT and REPEAT read the
  pre-shuffle workout. `test:challenge` shuffles a card and checks the card, the reps, the save and
  the repeat.
- **PULL-UP BAR** reshapes only today's deal and WARRIOR. A saved workout or a run from YOUR WORKOUTS
  runs exactly as kept (a workout saved with the bar off keeps its stand-ins), and its card has no bar
  switch: a swap (NO GEAR) drops a bar move by hand.
- **TIME after + / −**: the slider stays the input (20 MIN) and the line opposite TIME says why the
  card's time differs: "+1 round · about 27 min"; WARRIOR, whose fixed doses land on whole rounds,
  reads "whole rounds · about 22 min". Otherwise "rounds follow", as before.
- **Program day**: the help line names its button ("The program’s sets and reps. RESUME opens the
  list." when the day is under way, START otherwise).
- The preview gained `saved-nobar` and checks the TIME line and the program wording.

## What needs the owner

- **Reverse Curls**: record both voices and add it to the library (PENDING.md); then FULL BODY WARRIOR
  can have it back.
- **"Your pace. Tap DONE when the set is done."** has no recording. A loaded set in GUIDED says it:
  every Weighted or Hybrid Quick Mission today, and the card's Weighted / Hybrid deals. The card's
  bodyweight moves never do (they are counted).
- **The launch**: `fitCard` is off for everyone until the owner turns it on.
- A GUIDED card run's TIME on the results is the plan's time for the sets done (the guided runner
  reports no clock); AT YOUR PACE shows its own clock.
