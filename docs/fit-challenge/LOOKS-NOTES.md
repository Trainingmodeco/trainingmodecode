# The workout card: looks notes (2026-11-23)

Looks only: sample data, nothing wired into the app, nothing saved. The owner liked a
"Calisthenics Challenge Generator" routine; these pages show it built from the app's own
parts so the owner can decide before anything is built.

- Open: `/fit-looks` (a list of every state) or `/fit-looks?s=<state>` (one state, full screen,
  in the app's phone frame with the tab bar). Hidden and `noindex`, like `/retention-looks`.
- Photograph: `CHROME_PATH=/opt/pw-browsers/chromium node scripts/fit-looks-preview.mjs <out-dir>`
  (dev server first: `CI=1 EXPO_NO_TELEMETRY=1 npx expo start --web --port 8081`, restarted after
  an edit). Every state at 360x780, 390x844 and 430x932, device scale 2, whole page. The script fails
  when the page scrolls sideways, any text is cut, a state's own words are missing, or a page's last
  line runs under the tab bar. It runs on a fixed Monday (23 November 2026) with a sample athlete in
  storage, so the end screen's YOUR PROGRESS reads like a real athlete's.
- Test: `npm run test:challenge` (the totals, 40 checks). Not in `check:all` yet.

## The one idea

One card, the WORKOUT CARD, for Quick Mission's open card, a library mission and a program day:

    eyebrow · TITLE · tags
    [ SHUFFLE ]  [ CHOOSE ]
    ROUNDS  2 | 3 | 4 | 5
    99 × 4 = 396 · About 27 min
    the moves, a swap on every one
    BALANCED 3 push · 2 pull · legs · core · arms
    ADJUST (level, focus, gear) / PULL-UP BAR switch
    GUIDED | AT YOUR PACE · START

Rounds are picked directly and the time follows from them ("about 27 min"), where today the TIME
slider picks minutes and the rounds follow. Everything else on it already exists somewhere in Fit Mode.

## The states

| state | what it shows | reuses | new |
|---|---|---|---|
| `select` | FULL BODY WARRIOR (the spec's circuit, renamed: the name guard bans franchise names) on the Quick Mission page, 4 rounds: 99 × 4 = 396, about 27 min; a swap on all 8 moves; BONUS TRAINING folded; a YOUR WORKOUTS row where MISSION LIBRARY stands today | SetupHeader, ModeTabs, SetupPage, PhoneFrame, Tag, GoldButton, shared/MoveRow, the open card's banner and scrim, the GUIDED / AT YOUR PACE switch, CountPill | RoundsPicker, TotalsStrip, SHUFFLE / CHOOSE row, CardSettings (ADJUST + bar switch), the BALANCED line |
| `rounds5` | the same card at 5 rounds: 495, about 35 min | as above | the totals following the rounds live |
| `choose` | CHOOSE: the library by the spec's categories (Full Body, Upper Body, Lower Body, Core & Abs, Combat Conditioning), the card's own workout marked ON CARD, SURPRISE ME pinned at the foot | shared/BottomSheet, MissionLibrarySheet's row look, the app's own titles (Deadly Seven, Push-Up Division, Legendary Squat, 3 Level Abs, 5 Minutes of Hell · MMA) | ChooseSheet (grouping) |
| `swap` | the swap sheet on Pull-Ups: EASIER Pull-Up Negatives, SIMILAR Chin-Ups, HARDER Archer Pull-Ups, NO GEAR Reverse Snow Angels; "4 rounds stay; the totals update" | MoveSwapSheet's NOW box and its OptionRow (exported, unchanged) | ChallengeSwapSheet: the same sheet fed plain props, so a generated workout can swap too (today only library missions can) |
| `nobar` | the bar switch off: Pull-Ups → Reverse Snow Angels, Hanging Knee Raises → Leg Raises, each with a NO BAR tag and "for Pull-Ups"; 103 a round, 412 | MoveRow's note line, MoveSwapSheet's MiniTag | `withoutBar`, the NO BAR tag |
| `shuffled` | SHUFFLE: CALISTHENICS CIRCUIT (one of the generator's own titles), a new balanced deal at the same level, gear, focus and rounds, a pattern tag on every move, a 30 s Hollow Body Hold: 80 reps + 30s hold a round, 320 + 2:00 | MoveRow's prefix slot | PatternTag, holds counted in seconds, never in reps |
| `bonus` | BONUS TRAINING open: Morning Run (→ Cardio), L-Sit Hold, Handstand Hold, Mobility, Farmer Carries (WEIGHTS), Shadowboxing (→ Fight); "never changes the rounds, reps or XP" | CardioToggleCard's card look | BonusBlock |
| `program` | the same card on a program day: PUSH / PULL / LEGS, day 2 of 3 (PULL DAY), SHUFFLE THIS DAY, no CHOOSE, 52 reps + 20s hold × 4 | ProgramsScreen's day pips and its banner | ProgramDayHeader |
| `tracker` | AT YOUR PACE with CHECK-OFF: 17:47, round 3 of 5; rounds 1 and 2 folded with a check, 99 reps and their time; round 3 open with 4 of 8 ticked (48px tick buttons, the next move lit gold); rounds 4 and 5 dim; 50%, 250 done, 245 left; SHUFFLE / ROUNDS · 5; PAUSE / STOP | QuickMissionSolo's top bar, clock, strip and buttons, the builder's progress bar, MoveRow's highlight | CheckOffTracker, CheckOffRun |
| `confirm` | START OVER? over the tracker: "SHUFFLE deals new moves and clears your ticks. So far: 2 rounds and 4 moves." KEEP GOING / SHUFFLE | the kit's Modal in AT YOUR PACE's END MISSION? shape | DiscardConfirm |
| `results` | MISSION COMPLETE: FULL BODY WARRIOR, +555 XP, 5/5 rounds, 495 total reps, 38:12; a recap with 100% complete, 40 of 40 moves ticked, each round's time, "Saved to YOUR WORKOUTS."; REPEAT / NEW CHALLENGE / SAVE AS MY WORKOUT | the real shared/MissionComplete (badge, stats, YOUR PROGRESS, its buttons) | ChallengeResults (props and the recap) |
| `history` | YOUR WORKOUTS: last 7 days (3, 1,000 reps, 1:24:57), then one row a workout: date, name, rounds, reps, time, % | SetupHeader, the kit's card look | WorkoutHistoryList (no list of past workouts exists today) |
| `today` | the real Quick Mission page as it is now (QuickMissionSetup renders on its own) | | |

The pages answer taps: rounds, the bar switch, SHUFFLE, a swap on Pull-Ups (with UNDO), the bonus
ticks, the tracker's ticks (only the current round takes them), START → the run, FINISH → results.

### Move names

All are the app's own names: Quick Mission's move list (Dive Bomber Push-Ups, Air Squats) or the
Workout Builder library (Inverted Rows, Hanging Knee Raises, ...). **Reverse Curls is in neither**: it
is shown because the spec has it, and it is the one new library name. It needs a plain clip in both
voices before GUIDED could say it (see Voice). Every other name on these pages already has a plain clip
in both voices (checked against both manifests).

## What is new in code

- `components/training-mode/data/challengeTotals.js`: pure. Totals for a list of `{reps | seconds}`
  moves and a round count; a ticks grid's progress (a round counts only when every move is ticked;
  reps and seconds done and left); `swapMove` (one row, nothing else); `withoutBar`; the
  push / pull / legs / core / arms balance; words (`12 reps`, `30s`, `38:12`). The time is an
  estimate for the looks (3 s a rep, 10 s a change, 60 s between rounds).
- `components/training-mode/fit-challenge/ui/`: WorkoutCard, RoundsPicker, TotalsStrip, CardSettings
  (+ BarSwitch), ChooseSheet, ChallengeSwapSheet, BonusBlock, CheckOffTracker (+ ProgressBar),
  CheckOffRun, DiscardConfirm, ChallengeResults, WorkoutHistoryList, ProgramDayHeader, Tags. Plain
  props only, Fit kit palette (Chakra Petch, #F2BE45; never the Orbitron palette on the same screen,
  except the shared end screen, which is Orbitron everywhere in the app). Tap targets 44px or more,
  ticks 48px.
- `components/training-mode/fit-looks/` (FitLooks, LookPages, sampleData) and `app/fit-looks.tsx`.
- `scripts/test-challenge-totals.mjs`, `scripts/fit-looks-preview.mjs`; `test:challenge` and
  `preview:fit-looks` in package.json.
- `shared/MoveSwapSheet.jsx`: `MiniTag` and `OptionRow` are now exported. No other change.

Kept as they are (existing components, under 44px): the Modal's close button (32px) and
MissionComplete's secondary (40px) and ghost (38px) buttons.

## Wiring it later: what it would touch

Rough sizes are lines changed, tests included.

1. **The generator** (`fit-mode/quickMissionGenerator.js`, ~250): a `rounds` input (2-5) next to the
   minutes; a pattern tag on every pool move and the 3 push / 2 pull / legs / core / arms recipe for
   Full Body; a bar pool (Pull-Ups, Chin-Ups, Hanging Knee Raises, Inverted Rows) with each move's
   no-bar stand-in; SHUFFLE as a new seed that keeps level, focus, gear and rounds; a same-pattern
   re-pick for one slot (the swap). `scripts/test-qm-generator.mjs` holds the run to the minutes at
   every minute from 5 to 60: with rounds as the input the minutes come from the rounds, and that test
   changes shape.
2. **Quick Mission page** (`QuickMissionSetup.jsx`, ~-150 / +250): RoundsPicker + TotalsStrip in place
   of the TIME slider; SURPRISE → SHUFFLE; MISSION LIBRARY → CHOOSE; a swap on generated rows; the bar
   switch (a new field in `tm_qm_keys_v1`, added to its clean-up so it is not dropped); BonusBlock; the
   YOUR WORKOUTS row. `QuickMissionAdjustSheet` keeps LEVEL and FOCUS.
3. **The swap sheet** (`shared/MoveSwapSheet.jsx`, `data/loadoutMissions.js`, `data/soloFromGenerated.js`,
   ~120): split the sheet into a view (plain props, as ChallengeSwapSheet) and the v2 adapter, and give
   generated slots what a swap needs (today `slotOf` carries no move id, and AT YOUR PACE passes
   `noSwap` for generated missions).
4. **CHECK-OFF in AT YOUR PACE** (`QuickMissionSolo.jsx`, ~220): the ticks grid in its state, reported
   through `onStateChange` and restored from `startState` (or it is lost on resume); a round counts only
   when all its moves are ticked; round times from the last tick of each round; DiscardConfirm before
   SHUFFLE, or before a rounds change below the rounds already done (a change that keeps every finished
   round needs no question).
5. **Results** (`QuickMissionComplete.jsx`, ~50): rounds, total reps and time in the stats, the recap
   with the share done, REPEAT / NEW CHALLENGE / SAVE AS MY WORKOUT.
6. **History** (`data/userStats.js` ~15, a new screen ~150, `ScreenRouter.jsx`): the session row gets
   scalar fields only (title, rounds, roundsOf, totalReps, holdSec: the synced snapshot is rewritten
   whole on every save, so no arrays); YOUR WORKOUTS reads `stats.sessions`. Older rows have no title
   and read "Quick Mission".
7. **SAVE AS MY WORKOUT** (`data/savedRoutines.js`, ~40): a routine holds builder exercises today; a
   card-shaped one needs a kind field. `tm_saved_routines` is already synced.
8. **Program days** (`ProgramsScreen.jsx`, `data/workoutPrograms.js`, the builder path): the largest
   step. A program day today is muscle chips + a sets × reps scheme that the Workout Builder fills; on
   the card it would run as rounds. Either move programs to rounds (and keep XP per exercise, never per
   round), or keep the builder list and use the card only as the day's preview.
9. **Bonus** (~60): a list in data, links to Cardio Mode and Fight Mode; ticks not stored (or one count
   on the session row).

## XP and integrity

- A generated Quick Mission pays its minutes × the level's rate (EASY and MEDIUM 15, HARD 16,
  ADVANCED 18 a minute) + 30 for finishing (`data/quickMissionXp.js`). With rounds chosen, those
  minutes must be the minutes the card shows ("about 35 min" at 5 rounds), worked out by the run's own
  timing model, so 5 rounds pays more than 2 and a harder level never pays less. The sample's +555 is
  35 × 15 + 30.
- Ticks never pay by the rep or by the round (that is how a 5-round circuit would farm XP). One settle
  at FINISH, through `settleSoloXp`: the too-fast floor stays (a run under half the elite time pays 0,
  "Under half the elite time, so this one can't count."), so 40 ticks in a minute earn nothing. A
  stopped run pays its share by time as today; a half-ticked round is not a round, but its minutes still
  count toward the share.
- A swap or a no-bar stand-in never changes XP or the clock (as swaps today).
- Bonus work pays nothing and is never in the totals.
- The session is banked once, automatically, before the results open (as every run). SAVE AS MY
  WORKOUT only keeps the moves as a routine: never a second stats write. REPEAT is a new run under the
  usual rules.
- Library missions keep 15 a slot + 30; a program day kept on the builder keeps 15 an exercise + 30.

## Voice

- The looks speak no line: no clips are needed for them.
- CHECK-OFF is silent and tap-driven like AT YOUR PACE (bells and beeps only), so it adds no lines
  either. `npm run voice:coverage` still reads 0 missing.
- GUIDED on a card with the new moves: the guided runner says each move by name, so every name in a
  generator pool needs a plain clip in both voices (`test:spoken` sweeps the pools). All the sample
  names have one already **except Reverse Curls** (`reverse curls` is in neither bank). A workout title
  is only an issue if the coach says it ("full body warrior" has no clip). New spoken lines built from a
  round count would need a sweep in `scripts/spoken-sweeps.mjs`; the guided runner's own "Round 2
  complete." lines can be reused instead.
- `exercise-loops/PENDING.md` already lists new exercise names waiting to be added and recorded;
  Reverse Curls would join that list if the owner keeps it.

## Questions for the owner

1. **The default.** Is FULL BODY WARRIOR the card's fixed opener every visit, or one workout in CHOOSE
   while the card opens on a fresh balanced deal (as today's card does)?
2. **Rounds instead of TIME.** Should ROUNDS 2-5 replace the TIME slider, with the time shown as
   "about N min"? (Recommended: yes; one choice is simpler than two that move each other.)
3. **Reverse Curls.** Add it to the library and record both voices (and say what it uses: a band, a
   towel, a bar?), or use Bodyweight Curls or Resistance Towel Curls, which are already recorded?
4. **CHECK-OFF.** Should it replace AT YOUR PACE's one ROUND tap, or be a choice inside AT YOUR PACE?
   (Recommended: a remembered choice inside AT YOUR PACE.)
5. **Pattern tags.** Tags on every row (as `shuffled`), or only the one BALANCED line (as `select`)?
   (Recommended: the line only; less on the card.)
6. **No bar.** Inverted Rows need a low bar or a sturdy table: keep them in a no-bar workout, or swap
   them as well?
7. **The long card.** START now sits below all the moves. Keep today's closed card (three moves and SEE
   ALL, START on the first screen) with ROUNDS and the totals added? (Recommended: yes.)
8. **Bonus.** Tick-only as shown (no XP, not on the results), or should done bonus work show on the
   results and in YOUR WORKOUTS?
9. **Program days.** Move programs onto rounds and this card, or keep sets × reps in the builder and
   use the card only to preview the day?
10. **YOUR WORKOUTS.** On the Quick Mission page (as shown), on Progress, or both? Only Fit runs, or
    every mode?
