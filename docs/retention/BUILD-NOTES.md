# Retention build notes

What was built for each feature of `BUILD-SPEC.md`, what was decided along the way, and what needs the owner's
answer. Newest feature last.

## 1. Weekly streak + daily mission + freezes (switch `weeks`), 2026-11-22

All of it is behind `retentionOn('weeks')` (`data/retentionFlags.js`): off for everyone, on with the owner preview
(`tm_owner_preview`). With the switch off the screens, storage writes and XP are the same as before: the shared
pieces taken out of Home (`shared/HomeHeader.jsx`, `shared/NudgeToast.jsx`) render the same markup, and every new
read or write sits behind the switch.

### What was built

- **`data/weekStreak.js`** (pure): `computeWeekStreak(rows, settings, now)` returns `{ streak, freezes, longest,
  nextFreezeIn, thisWeek: { start, days[7], done, target, todayIndex }, events }`, replayed from the first training
  week every time. Also `isTrainingRow`, the target log (`targetForWeek`, `withTargetChange`, `pendingTarget`), the
  end-screen moment (`sessionMoment`), Home's notice (`homeNotice`) and their copy.
- **`data/weekStreakStore.js`**: reads the rows and the target, keeps only the "already shown" markers
  (`tm_week_moments_v1`: the day whose strip was shown, and the ids of freeze/mission moments seen).
- **`data/dailyMission.js`**: the deal (pure), the day's mission in `tm_daily_mission_v2`, the one-time bonus.
- **Home** (`HomeDashboard.jsx`): the week chip in place of the 🔥/🛡 combo chip; the DAILY MISSION card at the top;
  freeze-used / freeze-earned notices through the nudge slot.
- **End screen** (`shared/MissionComplete.jsx`, so Fight Focus, Combo, Fit, Quick Mission, Combat Conditioning,
  camp and arcade v2): one strip in YOUR PROGRESS.
- **Profile** (Game Plan card): "Days per week" is the weekly target, 2 to 6.
- **UI** in `retention/ui/`: `WeekChip`, `DailyMissionCard`, `WeekMomentStrip`, `WeekTargetRow`, `tokens.js`. The
  gallery's feature 1 (`retention/lookStreak.jsx`) now renders these real components (and the real `HomeHeader`
  and `NudgeToast`) with sample data; `looksKit` takes its palette from `retention/ui/tokens.js`.
- **Tests**: `npm run test:streak` (`scripts/test-week-streak.mjs`, in `check:all`).
- **Preview**: `scripts/retention-preview.mjs <out-dir>` (see its header). Feature 1's states: Home with the mission
  ready (fighter, and a new fit athlete), done, the freeze-used and freeze-earned notices, the widest header (a
  secret rank, 2-digit level and streak), Profile's target row, the gallery, and two end screens reached by really
  playing the daily mission on a fake clock (a training day kept; a week completed with a freeze earned).

### Decisions (each easy to change)

- **A training day** is the local date of a row that is not an award (`tiers.sessionMode` `bonus`: Mission of the
  Day, Hybrid bonus, Start Here), not `unverified` (validation_failed), with `completedCount > 0` and
  `xpEarned > 0` where the row has them, and for Cardio a time or a distance. A cleared Coach's Tape counts, paid
  or not (the tapes' daily caps pay a repeat of the same tape, or a third tape, nothing: it is still a finished
  session); one not cleared (a partial, even a paid one) does not.
- **A short week with no streak to protect costs nothing**: the starting freeze is not spent on a new athlete's
  first, partial week, or on any week while the streak is 0.
- **Freeze earned** the day the 4th consecutive week on target lands (the current week counts once on target),
  so the end screen can say so. At 2 held, nothing is earned (no event, no moment).
- **The target**: someone who saved the Game Plan before keeps their "Days per week" (a 7 reads 6); someone who
  never did gets 4. A pick writes `daysPerWeek` at once (Today's Bout reads it, as before) and a change log
  (`weekTargets: [{ from: <Monday>, days }]`) in `tm_game_plan_v1`, so this week keeps its target and the new one
  starts next Monday. Picking the value that holds drops a pending change. With the switch on, saving any other
  Game Plan answer first writes the target down, so a first save of the minutes cannot turn a never-chosen 4 into
  the plan's default 3.
- **Rows dated after today** (a clock running ahead) count from their own day.
- **The day combo** (`comboStreak.js`) keeps running under the switch, from an effect instead of the render, so
  its XP and `tm_combo_v1` stay exactly as they are and switching off later pays no backlog. Its flashes
  (milestone, guard, break) are not shown: the week chip has taken its place. The scheduled reminder nudge uses its
  plain copy, never the combo's "streak safety" lines (`getComboNudge(name, { plain: true })`).
- **Daily mission**: dealt once a day from the date, the athlete's side (stated goal, else where their XP is),
  their level (`athleteTier`), one step easier the day after a session ("lighter after yesterday"), and saved for
  the day so it does not change when the level does. A fighter gets one 3-minute Fight Focus round of their
  discipline (no warm-up); a fit athlete a 3-minute Quick Mission (its focus dealt from the date). START runs it in
  one tap (App `startDailyMission`), its config tagged with the day. It is done when that session ends finished and
  valid (Fight Focus: the round done and verified, XP > 0; Quick Mission: completed, XP > 0), and pays the existing
  Mission of the Day bonus, 25 XP, once (the done flag is written first; nothing is paid if it cannot be). A
  3-minute Quick Mission is below the setup slider's 5 but the generator's own floor is 3, and it runs 3 minutes
  (within 30 s, tested at every level and focus). Its lines are the generated mission's usual lines, which
  `test:spoken` already sweeps over every move and dose.
- **End-screen strip**: shown when the newest training row is today's first and was banked in the last 15 minutes,
  and today's strip has not been shown: "TRAINING DAY 3 OF 4 · STREAK KEPT" (no "STREAK KEPT" before there is a
  streak), "WEEK COMPLETE · 4 OF 4 · 10-WEEK STREAK", "TRAINING DAY 5 · TARGET MET", a FREEZE EARNED line and a
  DAILY MISSION · +25 XP line. With the switch on, YOUR PROGRESS's "This week" line no longer counts the mission's
  bonus row as a session or a mode.
- **Home notices**: "A freeze covered last week: your 9-week streak is safe." (the week after) and "Freeze earned:
  4 weeks on target. You hold 2 of 2." (when earned on a screen with no strip), once each, only for last week or
  this one. Kept to two lines at 360 px so the toast never reaches the mission card.
- **Header at 360 px**: with the week chip the header's gap is 8 and the "250 / 500 XP" numbers give way (the bar
  still shows the progress; the Level page has the numbers); a long rank name wraps under the level instead of
  being cut.
- **New storage keys** `tm_daily_mission_v2` and `tm_week_moments_v1` are in `cloudSync` SYNC_KEYS.

### Checked

- `npm run test:streak` (113 checks at first, 125 after the review fixes: week edges, Sunday/Monday, three time zones, target changes, freeze use, earn
  and cap, carry-over, a late sync, a clock ahead, award and no-work rows, the moments and their copy, the store,
  the mission's deal, a 3-minute Quick Mission's real length, the bonus paid once and never when the flag cannot be
  saved), the related suites, `tsc`, lint, `test:spoken`, `test:voice`, `test:clips`, `voice:coverage` (0 missing:
  the feature adds no spoken line), `build:web` and `smoke:web`.
- `scripts/retention-preview.mjs` at 360, 390 and 430 px: every state fits (no overflow, no cut text, the toast
  clear of the card).
- Switch off: Home, Profile's editor and a 1-round Fight Focus end screen captured on a fixed fake clock with the
  base commit and with this build: the same DOM and the same storage, apart from the random focus title, the random
  reminder line and row ids.
- `build:web` failed before this work on a raw `<img>` in the gallery (`retention/looksKit.jsx`); it is a `SafeImage`
  now.

### Not covered

- Sessions that end outside `MissionComplete` (Cardio, Practice, Coach's Tapes, arcade v1) fill the week's dots and
  can earn a freeze (shown later on Home), but show no strip.
- The come-back reminder card (`ReminderCard`) shares the slot over the header and still says "streak" for the
  old day count (`getStreak`); Profile, Progress and the share card also still show the day streak.
- The "streak at risk" notification (the last day the week's target can still be met) belongs to the
  notifications pass.

### Review fixes (2026-11-22)

- **Home across midnight**: Home keeps the day it shows and moves on when the local date changes (a timer at the
  next local midnight, and a check on focus and when the page shows again), so the week chip, the DAILY MISSION card
  and the freeze notices follow the new day. START also checks: a card dealt before midnight runs and tags today's
  mission (`dailyMission.missionForStart`), so its session can pay. Checked in a browser on a fake clock (Sunday
  23:59 in New York: the timer, a clock jump then `visibilitychange`, and START on a stale card).
- **Daily mission box**: saving the day's deal after a done flag was already written that day keeps the flag's
  time and XP, so the end screen's strip still finds the mission just done.
- **Coach's Tapes**: a cleared tape counts as a training day even when the caps paid it 0 XP (see above).
- **The nudge toast** (and the come-back reminder in the same slot) has an opaque fill with the switch on, so the
  busier header no longer shows through behind its text. The switch off keeps the old fill.
- **Today's Bout** line under the DAILY MISSION card takes two lines before it is cut (switch on); its "Complete
  your first beginner lesson before Fight Focus." now reads whole at 360. The title's "lines hidden" warning in the
  preview is not a cut: every line shows, the font's glyph box is 2 px taller than the 1.08 line height.

- Checked: `test:streak` (125), `test:xp`, `test:missions`, `test:concepts`, `test:ayp`, `test:maxout`, `test:tapes`,
  `test:storage`, `test:levels`, `test:athlete`, `test:qm`, eslint, `tsc`, `build:web`, `smoke:web` (147 checks), and
  `retention-preview.mjs` at 360, 390 and 430 (every state fits). `smoke:web` takes about 40 minutes in this
  container: a `timeout` shorter than that closes the browser mid-run and every later check reads "Target page,
  context or browser has been closed".

### For the owner (old, not changed)

- **End screen banner at 430 px**: the "MISSION COMPLETE · All rounds verified" banner
  (`MissionIntegrityBanner.jsx`, `maxWidth: 360`, from July) stops about 40 px short of the cards under it on
  phones wider than about 392 px, so its right edge does not line up. It is not part of this feature and changing
  it would change every end screen with the switch off; dropping the `maxWidth` (or setting it to `100%`) would
  line it up.

### Needs the owner's answer

1. **The day combo's 150 XP milestone bonus**: under the switch it still pays (every 7 combo days, counted from any
   row, award rows and no-work rows included) but is no longer shown. Keep it, move a bonus to week milestones,
   or retire it?
2. **The mission bonus is 25 XP** (the existing Mission of the Day amount); the look showed +40. Keep 25?
3. **Old Game Plan answers**: someone who saved the Game Plan keeps their "Days per week" as the target (3 by
   default for anyone who only set the minutes). Keep, or reset everyone to 4?
4. **Which other "streaks" should become the week streak** (Profile, Progress, the share card, the come-back
   reminder's "Keep Streak")?

## 2. The path + stars (switch `path`), 2026-11-23

All of it is behind `retentionOn('path')`: off for everyone, on with the owner preview. With the switch off the
screens, storage writes and XP are the same as before (checked, below).

### What was built

- **`data/pathStars.js`** (pure): the star rule per saga type (`sagaStarRule`, `stageStarRule`), a stage's stars as
  stored today and what the next star needs (`stageStars`, `nextStarLine`, `endStarsLine`), the saga's path with the
  ladder's own gate (`sagaPath`, `openStageCount`), Training Camp's 12 levels (`campPath`), Home's NEXT UP from the
  last session (`nextUpFrom`, `nextUpCopy`), and where the path's nodes sit for the box's real width (`pathLayout`).
  It reads and writes nothing and changes no star rule.
- **`data/pathNextUp.js`**: the real stores behind NEXT UP (`loadNextUp`), the NEXT UP tap (`openNextUp`: the saga
  with the settings it last ran with, like Continue, or the camp), a one-shot "open on the current node" kept in
  memory (`requestPathFocus` / `takePathFocus`, dropped after 15 s), and the end screens' stars (`arcadeEndStars`,
  `conceptEndStars`). No new storage key.
- **UI** in `retention/ui/`: `PathMap` (the path), `ReplaySheet` (+ `PathChoice`), `NextUpRow`, `StarsRow` (stars,
  landing one by one with a callback per star), `StageStarsCard` (the end screen's row); new keyframes in `tokens.js`.
- **Arcade sagas** (`ArcadeSeriesDetail.jsx`): the path in place of the ladder. A tap on the current node opens the
  screen's own stage pop-up (centred and full width on the path, so its objectives read whole); a locked node gives
  the ladder's own hint toast; a cleared node opens the replay sheet, whose REPLAY is ENTER STAGE (`handleStart`: the
  Pro gate, the path, the v2 path + difficulty step). The header counts the saga's stars (★ 12/30) instead of the
  stages cleared, when the saga has stars. NEXT UP opens the saga on the current node's pop-up (after a campaign's
  first-time intro, which already does that).
- **Training Camp** (`TrainingCampMap.jsx`): the same path for the 12 levels, S1/S2 pips under levels 4 to 11, the
  title fight (level 12) as the boss. The current and locked levels open the level card as before (START → readiness
  → gear); a cleared level opens the replay sheet (a check, both sessions), whose REPLAY opens the level card. The
  screen guide's anchors (`tc-current`, `tc-belt`, `tc-pips4`, `arc-stage`, `arc-boss`) sit on the path's nodes.
- **Home** (`HomeDashboard.jsx`): NEXT UP under the Continue card, from `loadLastSession()`: the saga's current node
  (a concept stage, saved as a timer session, counts) or the camp's current level. Hidden with no last session, any
  other kind, a saga that cannot be played (locked, under construction, retired from the carousel), a concept gate
  not yet open, everything cleared, or the title won.
- **Stars landing**: the classic clear screen (`ArcadeStageClearOverlay` StageClearedScreen) lands its stars (or the
  benchmark's rank stars) one by one, a rising tone each; the arcade v2 end screen (`ScreenRouter` camp_complete) and
  a concept stage's end screen (`SessionSummary`) get the small `StageStarsCard` row in MissionComplete's `summary`
  slot when the stage has stars, with one line ("One star per path: FIT ✓ · FIGHT ✓ · BOTH"). Nothing else added.
  `audioEngine.playStarTone` is the end screens' tone (through the app's cue output and volume).
- **Gallery** (`retention/lookPath.jsx`): every card renders the real components with sample data on the real sagas
  (One Hundred, The Grappler) and the real camp levels, including the real stage-clear screen.
- **Tests**: `npm run test:path` (`scripts/test-path-stars.mjs`, 76 checks, in `check:all`).
- **Preview**: `scripts/retention-preview.mjs` feature 2 states: Home's NEXT UP (saga and camp), the saga path (classic
  and multi-path v2), the pop-up from NEXT UP, three replay sheets (2★ with a gap, 1★, one star per path), a locked
  tap, the camp path, its replay sheet, NEXT UP into the camp's level card, the gallery, and a real v2 stage replayed
  from the path on a fake clock (The Grappler stage 1 on FIGHT) to its end screen with the stars row (2 of 3).

### Decisions (each easy to change)

- **Stars per saga type**, from what is stored today, never recomputed: the classic saga 3 (time tiers; a stage with
  no tiers, as in Demon Back, shows a check); a multi-path v2 saga one per path available (Martial Monster 2, The
  Destroyer and The Grappler 3; the sheet says "One star for each path cleared" and names the paths left); a
  single-path v2 saga 1 (Gravity Chamber); a concept saga one per arc (3). A stored count above the saga's maximum
  (an old difficulty-based 3 on a 2-path saga) is shown at the maximum. A clear with no stars saved reads 1, as the
  ladder did.
- **What the next star needs**: the classic saga names the time ("under 22:00") and, when a best time is stored, the
  gap in plain words ("2:41 off the third star"); the tiers are strict (under, not at), so the gap is one second more
  than the difference. Multi-path sagas name the paths not yet cleared; an old clear saved before paths were kept
  says only the rule. The sheet's REPLAY on a multi-path saga runs the path picked in the sheet (a missing one is
  picked first).
- **The path climbs**: the first node at the bottom, the boss at the top, like the ladder it replaces ("THE CLIMB")
  and the camp's tower and its guide ("the title fight at the top"). The approved look ran top to bottom; flipping
  it is one line in `data/pathStars.js` (`pathLayout`).
- **The benchmark's stars on its clear screen**: the benchmark saves its time's stars but does not put them on its
  result, so the screen showed 1. With the switch on it shows what was saved (the same `getStarsForTime`).
- **Camp has no stars**: cleared levels show a check (proposal below). With the title won, level 12 shows cleared too.
- **NEXT UP and Continue** can name the same saga (Continue opens the path; NEXT UP opens the current node's pop-up).
- **The ELITE node** (switched off in the ladder) is not drawn on the path.
- **The path's stage nodes keep the ladder's `ladder-node` class and its DOM order** (the boss first, stage 1 last),
  so what finds a stage node on the ladder still finds it: `smoke:web`'s "concept gauntlet stage start" turns the
  owner preview on (so the path is on) and taps the last `.ladder-node`.

### Checked

- `test:path` (76: the rules per saga type, the next star and its gap, the path against the ladder's gate on every
  prefix, the camp's levels and pips, NEXT UP from every kind of last session, the end screens' stars, the layout
  inside 16 px of the sides from 300 to 768 px wide, nothing written to storage), `test:streak`, `test:concepts`,
  `test:xp`, `test:missions`, `test:entitlements`, `test:maxout`, `test:ayp`, `test:levels`, `test:storage`,
  `test:qm`, `test:athlete`, `test:voice`, `test:clips`, `test:spoken`, `voice:coverage` (0 missing: no new spoken
  line; the stars are tones), `check-guides`, eslint on every changed file, `tsc`, `build:web`.
- `scripts/retention-preview.mjs` at 360, 390 and 430 px: every state fits (no overflow, no cut text). Looked at each
  photo: the pop-up on the path was too narrow at 360 (its first objective cut with an ellipsis), so it opens full
  width on the path; START on the current node was a size smaller so it clears the ring; the camp's replay sheet
  keeps its buttons clear of the beta chip; the path fades out at the box's edges instead of being cut under the
  header.
- Switch off, base commit against this build, on a fixed fake clock and a seeded `Math.random`: Home (with an arcade
  last session), the saga ladder, its stage pop-up, a locked tap, the camp ladder, its level card, and a v2 stage
  played to its end screen: the same DOM, and the same storage apart from sub-second timestamps and a row id. The
  classic clear screen and a concept stage's end screen were checked by reading the code (the switch-off branch is
  the old markup, untouched).
- `smoke:web` (the production build): the first run failed "concept gauntlet stage start" (the owner preview turns
  the path on, and the check taps the ladder's last `.ladder-node`); with the class and order kept, all 147 checks
  pass.

### Not covered

- A fresh clear does not animate on the path (the node simply shows its stars the next time the path opens).
- Concept saga progress and the last session are per device (`tm_concepts_v1`, `tm_last_session_v1` are not in
  SYNC_KEYS, as before), so NEXT UP and concept stars do not follow a sign-in to another phone.

### Review fixes (2026-11-23)

- **Concept stage end screen**: the stars row now needs this session's own pass, not only every round run: a pass
  verdict, not refused by the integrity check, and XP paid (`pathNextUp.conceptSessionStars`, from the same
  `settleFightXp` the host banks with). A replay of a stage cleared on an earlier day that fails validation shows no
  stars. `test:path` has the regression case (a `tooFast` replay through the real `settleFightXp`), plus refused,
  failed, unpaid and ended-early runs. How a concept stage is marked cleared (`recordConceptSession`, every round
  done) is not changed.
- **The road no longer runs through a node's stars or pips.** The label under a node hangs on the side away from
  the road coming up from the node below, moving off centre only as far as the road needs (`pathStars.pathLabelLeft`,
  from the label's measured size); where the road comes straight up it takes the side towards the middle. Stars and
  pips sit on one solid backdrop, and the gap from the node is 10 px (was 4), so the current node's pips are clear of
  its ring. `test:path` checks every node at 280 to 430 px for 5, 10 and 12 nodes: no road segment within its stroke
  of a label, every label 8 px inside the box.
- **Home NEXT UP**: the badge carries the number, so the title is the stage or level name alone ("The Standard
  Hundred", "Volume"), without the tagline after a dash ("Loop-de-Loop — Land, Stabilize & Build the Base" reads
  "Loop-de-Loop"). The longest name (29 characters) keeps to two lines at 360, and the title is clamped at two lines
  as a guard. A screen reader hears the whole: "Next up in One Hundred: Stage 6, The Standard Hundred. Start".
- **Replay sheet**: the map behind it is a little darker (scrim 0.55 to 0.68). Nothing else changed there: the sheet
  covering the bottom of the road matches the app's other sheets.
- Checked: `test:path` (88), `test:xp`, `test:concepts`, `test:missions`, `test:streak`, `test:storage`,
  `test:levels`, `test:ayp`, `test:maxout`, eslint, `tsc`, `check:all` through `build:web`, then `smoke:web` on its
  own (147 checks, about 40 minutes), and `retention-preview.mjs` at 360, 390 and 430 (every feature 2 state fits).

### For the owner (old, not changed)

- **Gravity Chamber's pop-up** advertises EASY / NORMAL / HARD as 1 / 2 / 3 stars, but its stars are stored per path
  cleared, and it has one path, so it can never show more than 1. The path shows 1 of 1. Either keep one star for a
  clear (and drop the difficulty stars from its pop-up), or store difficulty stars for single-path sagas.
- **Multi-path sagas start on NORMAL** (difficulty is not offered when a saga has paths), and Martial Monster's
  FULL ARC is not mapped, so it has 2 paths and 2 stars.

### Proposed camp star rule (built 2026-11-23: the owner chose "Build the camp stars"; see "The owner's camp answers" at the end)

Training Camp has no star, grade or best result stored. A proposal that rewards finishing well, not training harder
than the readiness check advises:

- ★ the level cleared (every existing clear gets this one);
- ★★ every round of the level done and verified (the end screen's "All rounds verified"), in both sessions on a split level;
- ★★★ the level's sessions done the way the camp asks: on a split level S2 4 to 8 hours after S1 (the camp's own
  guidance), on a single level no round stopped early or skipped; the title fight won with the form gate held.
- Kept as max-of in a new `tm_camp_stars_v1` (`{ [level]: 1..3 }`, in SYNC_KEYS), written in `App.goCampComplete`
  and `goCampFullComplete` when the level clears. Stars by difficulty (★★★ on HARD) were left out on purpose: the
  readiness check offers an EASY session "that still counts", and a star for HARD would pull against it.

### Needs the owner's answer

1. **The camp star rule** above: yes, change it, or keep the check marks?
2. **Gravity Chamber**: one star for a clear, or difficulty stars for single-path sagas?
3. **The path's direction**: climbing up (built) or top to bottom (the look)?

## 3. Near-miss retry (switch `nearMiss`), 2026-11-23

All of it is behind `retentionOn('nearMiss')`: off for everyone, on with the owner preview. The one change with the
switch off is the bug the spec asked to fix first (a cleared classic stage read as MISSION FAILED, below).

### What was built

- **The bug, fixed for everyone** (`data/arcadeOutcome.js`): the classic `ArcadeSessionPlayer` handed its normal clear
  to the overlay with no counts, so `resolveOutcome` read 0 of 1 and One Hundred's stages 2 to 10 showed MISSION FAILED
  · NO XP AWARDED over a clear already saved with its XP and stars. `normalClearResult` now puts every task of every
  block the stage ran on the clear (`completedTasks` = `totalTasks`), as `ArcadeBenchmarkPlayer` does, and the overlay's
  choice of screen is the pure `arcadeOverlayOutcome` (the same logic, moved). `test:nearmiss` proves it: the old
  result reads `failed`, the new one `cleared`.
- **`data/nearMiss.js`** (pure): `nearMiss()` from the counts an end screen has: rounds, exercises, drills, tasks, sets
  ("1 round to go", "2 drills short"), or the classic saga's time against its star tiers ("12 s off ★★★"), with the
  bar's value and max and its labels ("1 OF 3 ROUNDS"; "YOUR TIME 16:11" · "★★★ UNDER 16:00"). No count, no line.
- **`data/retrySafety.js`** (pure): `canRetryNow({ boss, maxEffort, attemptsToday, sessionsToday })`, today's finished
  sessions from the rows (`sessionsOn`, the week streak's training rows), today's tries per stage or session
  (`triesOn` / `withTry`), and the keys that say what "the same session" is.
- **`data/nearMissStore.js`**: settles an end screen once (`settleNearMiss`: the gap, the rule, the counts), logs the
  try (`noteAttempt`, once per result), the classic saga's version (`classicNearMiss`), what a stage was (a v2 boss or
  a saga's last stage, a classic boss, a concept boss from its cfg), and the camp's "open this level" request.
  New key `tm_retry_log_v1` (`{ day, tries: { key: n } }`, yesterday dropped on the next write), in SYNC_KEYS.
- **UI** `retention/ui/NearMissPanel.jsx`: HOW CLOSE, the gap, the bar, and RETRY with COME BACK FRESH TOMORROW as two
  buttons of one size (one grid row height, so a label that wraps on a narrow phone makes both taller). When a retry is
  not safe: the line that says when to come back and DONE FOR TODAY. `rt-fill` keyframe in `tokens.js`.
- **Where it shows** (a partial or failed end with work done): `MissionComplete` takes a `nearMiss` prop and puts the
  panel under the stats, the part of the screen that is never hidden. With the panel up, the screen's own retry (the
  old RETRY to the setup screen) and its home button step aside, and its main button goes quiet (secondary). Wired in
  Fight Focus, Just Train, Combo and concept stages (`SessionSummary`), Quick Mission, Combat Conditioning, the Workout
  Builder, arcade v2 and Training Camp (`ScreenRouter` camp_complete); and the classic overlay's partial and failed
  screens (the panel in place of their encouragement / time row and buttons) and its clear screen when the stage holds
  fewer than 3 stars (NEXT STAR: the gap, GO FOR THE THIRD STAR next to START STAGE n, the same size; Back to Arcade
  stays). With the panel, the classic screens scroll when they must and their art is a size smaller.
- **Retry routes** (the existing XP rules): Fight Focus / Just Train / concept: `goTimer` with the session's cfg; Combo:
  `goComboActive(comboCfg)`; Quick Mission: `goQuickMissionActive` with the same mission it dealt; Combat Conditioning:
  the same mission again (`App.retryCombatCond`, not a new deal); Workout Builder: `goFitWorkout(fitCfg)` (a program day
  only moves on once, so a retry cannot skip a day); arcade v2: `goArcadeSession` with the same saga, stage, path and
  difficulty; camp: the camp map opens on that level's card (`requestCampRetry` → `TrainingCampMap`), so START →
  readiness → gear run as ever; classic saga: its own RETRY. COME BACK FRESH TOMORROW and DONE FOR TODAY go home (the
  classic screens through `App.goArcadeDoneToday`, which ends the stage like `goArcadeComplete`, so Home shows no
  paused session).
- **Gallery** (`retention/lookNearMiss.jsx`): every card renders the real `NearMissPanel` (safe retry, a boss, the
  second go today) and the real classic clear and partial screens, with sample data.
- **Tests**: `npm run test:nearmiss` (`scripts/test-near-miss.mjs`, 66 checks, in `check:all`).
- **Preview**: `scripts/retention-preview.mjs` feature 3 states, all real flows on a fake clock except the gallery: a
  Fight Focus stopped in round 2 (2 ROUNDS TO GO); the same as the third session today (no retry); a v2 stage (The
  Grappler stage 1 on FIGHT) stopped after round 1; the same stage retried from its panel and stopped again (the second
  go: no retry); a camp session stopped and its RETRY opening level 5's card; the gallery.

### Decisions (each easy to change)

- **The gap** is the work left of the session (total − done): "to go" on a stopped session, "short" on a failed one.
  **Nothing done is not a near miss**: no panel (the quiet SESSION ENDED card stays as it is). A pass shows none; a
  refused session (validation_failed) shows none.
- **Never a made-up number**: AT YOUR PACE and until-down Quick Missions have no done-of-total count on screen, so no
  panel; a v2 boss is counted in rounds (the look's "8 REPS SHORT" has no source). A clocked GUIDED run uses its rounds,
  MAX OUT its sets, other Quick Missions their exercises.
- **The retry rule** (no recovery data is saved, so this holds until the owner approves another): no RETRY after a
  boss (a v2 boss, a classic boss circuit, a concept boss stage), a saga's final stage, the title fight (camp level 12)
  or MAX OUT; none after 2 tries at the same stage or session today; none after 3 finished sessions today. A try is
  counted when an end screen opens, once per result, for a finished, valid session (passes too); a session the
  integrity check refused or one ended with nothing done is no try (the same rows `sessionsToday` leaves out). "The
  same session": the same saga stage, camp level and session, Quick Mission, Combat Conditioning mission, workout (or
  program day), or timer settings (discipline, mode, rounds, round length, difficulty). The lines are plain and say when: "That was a boss
  fight. Come back fresh tomorrow." · "Two goes at this one today. …" · "Three sessions done today. …" Nothing is
  locked: only the button is not offered.
- **REMIND ME TOMORROW is left out**: the reminders (`reminderEngine`) only fire on the plan's days while the app is
  open; there is no one-off reminder to hook it into.
- **The third star** (classic saga): offered when the stage holds fewer than 3 stars and has time tiers; the gap is this
  run's time to the star above what the stage holds now. A benchmark that ranked shows its rank, so nothing. A clear is a
  win, so the panel never says "come back tomorrow" there: with no replay today (a second go, three sessions) the gap
  stays over START STAGE n; after a boss or the saga's final stage (no replay and no next stage) there is no panel.
- **The classic RETRY's clock**: before, a retry was timed from the first attempt's start, so a retried run's time (and
  stars) counted the failed run's minutes. With the switch on, a retry restarts the clock (the third star is a time).
  With the switch off it is as before (see below).

### Checked

- `test:nearmiss` (66: the classic clear before and after the fix, every unit, singular and plural, no count no line,
  the star gap and its strict tier, when the panel shows, every retry rule and its line, today's sessions in local time,
  the tries log across midnight, the keys, the store settling and logging once, what a stage was on the real sagas and a
  concept, the switch), `test:xp` 121, `test:missions` 217, `test:concepts` 180, `test:ayp` 54, `test:maxout` 103,
  `test:path` 88, `test:streak` 125, `test:storage` 33, `test:levels` 183, `test:athlete` 50, `test:entitlements` 7,
  `test:qm` 83 (one run in 22 failed one check and did not come back; the generator is random and this feature does not
  touch it), eslint on every changed file, `tsc`, `check-guides`, `voice:coverage` (0 missing: the panel says nothing
  aloud), `test:spoken` 155, `build:web`, `smoke:web` (147 checks).
- `retention-preview.mjs` at 360, 390 and 430: every feature 3 state fits. Looked at each photo: the first gallery run
  had COME BACK FRESH TOMORROW wrapping to two lines on the gallery's narrower phone, its button taller than RETRY
  (now one row height for both, tighter letter spacing; on the real screens it is one line at 360); the big line read
  "12 S OFF" (the seconds keep their "s" now).
- In a browser, the routes: Fight Focus RETRY runs ROUND 1/3 of the same timer; COME BACK FRESH TOMORROW lands on
  Home with no paused session; a v2 RETRY opens the same stage's warm-up; the stage stopped again offers no retry; the
  camp's RETRY opens level 5's card (START SESSION 1); `tm_retry_log_v1` holds the try.
- Switch off, base commit against this build, on a fixed fake clock and a seeded `Math.random`: Home, a Fight Focus
  stopped in round 2 (its end screen), the storage after it, and where its RETRY goes (the setup screen, as before): the
  same DOM and the same storage. The other end screens by reading the code: every new branch needs the settled near
  miss, which needs the switch; the actions' new `role` is read only when the panel is up; the classic player's clock
  reset is behind the switch.

### Not covered

- The classic overlay's screens with the panel are checked in the gallery (real components, sample data), not in a
  real run: a classic stage on a fake clock is long, and its partial and failed screens are reached only by a benchmark
  ended early. The boss panel is checked the same way.
- A classic stage run on BOTH paths banks two rows, so it counts as two sessions toward the three a day.
- The tries log is per device until it syncs; a stopped arcade or camp stage still takes its XP stake loss on each try
  (the existing rule).

### Review fixes (2026-11-23)

- **Only a finished, valid session is a try.** A refused session (validation_failed, the classic overlay's invalid
  screen included) or one ended with nothing done no longer logs a try in `tm_retry_log_v1` or counts itself in
  `attemptsToday` (`retrySafety.countsAsTry`, used by `nearMissStore`), so the next honest partial of the same session is
  still the first go and gets its RETRY. The two counters now agree on those (`sessionsToday` already left them out).
  A stage stopped with work done but no XP paid (the arcade's stake rule) is still a try at that stage: it was a real
  go, and the two-tries rule is about the same stage, not the day's load.
  `test:nearmiss` 73 (refused, nothing done, the classic invalid run, the next honest partial).
- **Camp RETRY and the health check**: the map takes the retry when it opens and keeps it until the PAR-Q sheet (if it
  is up) is done, then opens the level's card. Before, a PAR-Q sheet on the map dropped the request. Preview state
  `f3-camp-retry-parq`.
- **The classic clear with a star gap** no longer says "Come back fresh tomorrow." over START STAGE n (and never on a
  boss or final-stage win): no come-back line on a clear; with no replay today the gap stays over the next stage; with
  no replay and no next stage the panel stays out. A gallery card shows it ("Cleared, no replay today").
- **Panel buttons**: 11.5 px with tighter letter spacing, so COME BACK FRESH TOMORROW stays on one line down to a 230 px
  label box (the gallery's phone frame, a 320 px phone); both buttons were already one height. The gallery card header
  keeps 6 px off the right edge (the REPLAY pill).
- Looked at, not changed: the round chevron over SHARE YOUR WIN at 360 is the app's scroll cue (`ScrollDownIndicator`,
  fixed above the tab bar while more lies below, gone at the bottom), not the share card's; the panel only moves which
  text sits under it. The PARTIAL COMPLETION banner ends short of the right edge at 430 (`MissionIntegrityBanner`
  `maxWidth: 360`), the same with the switch off (below).
- Checked: `test:nearmiss` 73, `test:xp` 121, `test:missions` 217, `test:concepts` 180, `test:ayp` 54, `test:maxout`
  103, `test:path` 88, `test:streak` 125, `test:storage` 33, `test:levels` 183, `test:athlete` 50,
  `test:entitlements` 7, eslint on every changed file, `tsc`, `voice:coverage` (0 missing), and
  `retention-preview.mjs` at 360, 390 and 430 (every feature 3 state fits, the new `f3-camp-retry-parq` included;
  looked at each photo, and at the gallery's three classic cards close up at 360).

### For the owner (old, not changed)

- **The integrity banner's width**: on a phone wider than about 400 px the PARTIAL COMPLETION (and every other one-line
  integrity) banner on the end screens stops at 360 px while the cards under it run the full column
  (`MissionIntegrityBanner` `maxWidth: 360`, both branches). Dropping the cap, as was done for the share card, fixes it
  on every end screen; not done here, as it changes the screens with the switch off.
- **The classic RETRY timing**: with the switch off, a retried classic stage is still timed from the first attempt's
  start (`ArcadeSessionPlayer` keeps `sessionStartedAtRef`), so its time and stars are worse than the run. Resetting it
  on RETRY (one line, done here behind the switch) would fix it for everyone.

### Needs the owner's answer

1. **The retry rule** above (2 tries per stage or session a day, 3 sessions a day, none after a boss, the final stage,
   the title fight or MAX OUT): keep it until there is a recovery model? Should the camp's readiness check be saved and
   used for it?
2. **REMIND ME TOMORROW**: worth a one-off local reminder (the notifications pass), or leave it out?
3. **The clear fix is live for everyone** (the spec asked for it first): a cleared One Hundred stage now says STAGE
   CLEARED instead of MISSION FAILED. Ship it as a fix, or hold it for the switch?
4. **A session ended with nothing done** shows no panel. Keep, or show "3 rounds to go" there too?

## Cross-feature review fixes (2026-11-23)

The first review of the three features together (the whole diff from `41194802`). Both fixes sit behind the `weeks`
switch; with it off the rows, storage and XP are as before.

- **A refused guided Quick Mission paid the daily mission bonus and filled a training day.** A generated mission or a
  classic run GUIDED (the daily mission's 3-minute Quick Mission is one) has no settle of its own, so App banked it and
  called it valid even when its screen read VALIDATION FAILED (tapped through too fast). Now, with the switch on, App
  asks `missionSolo.guidedRunRefused(result)` (the same verdict `QuickMissionComplete` shows): such a run pays no daily
  mission bonus, and its row is marked `unverified`, so `isTrainingRow` leaves it out of the week. Its own XP still
  banks as it always has (ND-05: the screen shows 0 above a row that paid; old, not changed). AT YOUR PACE and a v2
  guided run were already safe: their settle pays 0 for a refused run.
- **The strip was lost on a session with a cardio finisher.** The finisher banks its own Cardio row before the end
  screen mounts, so `sessionMoment` saw two rows today and showed nothing (no TRAINING DAY, WEEK COMPLETE or FREEZE
  EARNED, and the day's marker never set). `MissionComplete` now passes `finisher: !!cardioResult` (through
  `takeEndScreenStrip`); a newest Cardio row is then the session's own. The freshness test reads the newest row (the
  finisher's), so a finisher longer than 15 minutes still shows the strip. A second session of the day still shows none.
  On a timestamp tie the row banked later is the newest.
- Checked: `test:streak` 140 (refused guided run: not a training day, no bonus, an ordinary early exit not refused; the
  finisher strip, a long finisher, the week it completes with its freeze, a second session with a finisher, the store
  path), `test:path` 88, `test:nearmiss` 73, `test:xp` 121, `test:missions` 217, `test:concepts` 180, `test:maxout` 103,
  `test:qm` 83, `test:ayp` 54, eslint on every changed file, `tsc`. The browser checks are run separately.

## Visual review fixes (2026-11-23)

The independent visual review of the phone photos (360, 390 and 430 wide) and the orchestrator's own look. Every
change sits behind its feature's switch; with the switches off the screens, storage and XP are as before.

### Fixed

- **The week chip reads at a glance** (F1-2, A5, the near-miss review's A2): the day dots are 6 px, 3 px apart (were 5
  in 2); a day still to come is a grey dot that shows on the chip (was #2A2545, nearly the chip's own colour), today a
  1.5 px gold ring, a rest day a brighter green; WK and n/4 DAYS are 8 px (were 7.5), the caption 4 px under the dots.
  It still fits Home's header at 360 with the longest rank names (FIGHT ASCENDANT, PEAK PHYSIQUE) on one line: the
  chip's padding is 7 and its gaps 5, and the header's gap with the chip is 7 (was 8), so the rank has 103 px for a
  97 px name. Nothing was dropped.
- **YOUR PROGRESS is calmer** (F1-3): the strip's title says the day and the target ("TRAINING DAY 3 OF 4 · STREAK
  KEPT", "WEEK COMPLETE · 4 OF 4 · …"), so the chip beside it no longer repeats "n/4 DAYS" (WeekChip `count={false}`;
  Home keeps it). 10 px between the strip and the "This week" line (was 7), and the sentence beside the chip wraps
  balanced, so a second line is never one word.
- **Continue and NEXT UP: one card for one place** (A1, A2). The choice: with the path switch on, **NEXT UP folds into
  the Continue card** when the last session is the saga or the camp NEXT UP names. The card reads NEXT UP · One Hundred
  · "Stage 6 · The Standard Hundred" (camp: "Boxing · Level 5 · Volume"; a saga's boss "Boss · name") with CONTINUE,
  and CONTINUE opens the saga or the camp on that node (the stage pop-up, or the level card), as NEXT UP did. Why
  fold rather than hide: hiding NEXT UP whenever Continue is the same saga would hide it almost always (NEXT UP only
  exists for an arcade or camp last session), and the node is the useful part. Why it changes no start rule: Continue
  already opened that same saga (with the settings it last ran with) or that camp, and the pop-up and level card are
  the screens' own (ENTER STAGE, the Pro gate, the path and difficulty step; START → readiness → gear). ADJUST still
  opens the saga or the camp as before (no pop-up). The separate NEXT UP row is left only for a concept stage's last run
  (Continue replays that stage's timer, so it is a different place), and is not shown under a paused session or a
  surprise pick (the card above is the one thing to do). `pathStars.nextUpLine` (pure, in `test:path`).
- **The locked hint no longer covers the path** (A4): on the path, "🔒 CLEAR STAGE 7 TO UNLOCK" hangs under the node
  that was tapped, in the room before the node below (over the node when that room is short), so it never sits on
  another node and says which node it is about. The ladder (switch off) keeps its toast at the top. The preview checks
  that the hint overlaps no node.
- **The star gap agrees with the tiles** (A3): YOUR BEST 17:40 · ★★★ under 15:00 now reads "2:40 off the third star"
  (was 2:41), 30:05 against under 22:00 "8:05 off" (was 8:06). The gap is the difference of the two times as shown, at
  least 1 s (a best exactly on the line of a strict tier is still 1 s off). Times show whole seconds cut down, as the
  stage-clear screen shows them (17:59.7 reads 17:59; the old rounding could print "17:60"). The near-miss panel's
  "s off ★★★" and its YOUR TIME label follow the same rule. `test:path` and `test:nearmiss` sweep every time in tenths
  over 10 to 12 minutes past the line and check the line against what the tiles show.
- **Camp pips** (A6): 9 px (were 8), the check a size up, a locked level's pips on a light border (they read on the busy
  art), and every label 8 px under its node (was 10).
- **Replay sheet tiles** (A7): the stars before NEEDS are 12 px (were the 9 px label's glyphs, about 6 px on screen), the
  tile labels 10 px. **Path chips** (A8): an empty star on the picked chip is half white (it vanished on the gold tint),
  the other labels are full brightness, and the line is shorter: "One star per path cleared. Next: FIGHT or BOTH." (one
  line at 360).
- **Stage-clear stats at 360** (the near-miss review's A4): with the stars landing, YOUR TIME, XP EARNED, STARS and the
  NEW BEST pill keep one line each, the three labels share one top line, and the strip's gaps are 12 (were 16).

### The preview (`scripts/retention-preview.mjs`)

- **One fixed clock for every state**: Thursday 19 November 2026, 10:00 local, on Playwright's clock (the seeds use the
  same time). The shots had been taken on a Monday, so the week chip read 0/4 and the week-complete end screen was
  skipped. Now Home shows Monday to Wednesday trained (3/4 DAYS) where a state trains this week, and
  `f1-end-week-complete` always runs.
- **The ROUND RECAP at 360** (F1-5) is the app's own rule, not a capture fault: `MissionComplete` hides its recap and
  chips (`extra`) and the beta link on phones shorter than 812 px (`.mc-extra` in `mcCSS`), so 360x780 never shows it
  and 390x844 and 430x932 do. The same with the switches off. Both end states are taken the same way (one run at 360,
  then resized; the strip centred).
- **The gallery is legible** (F1-6): besides the whole-feature overview, each card is saved as its own crop at the
  phone's scale 2 (`f1-gallery-360-card05.png`, about 656 px wide at 360).
- **The PAR-Q state** (the near-miss review's A1): `f3-camp-retry-parq` now photographs the health-check sheet itself
  (RETRY on the map, the sheet first, no level card behind it), and `f3-camp-retry-parq-done` the level card after it.
- New checks: `absent` (text that must not be on screen: the old NEXT UP row, the card behind the PAR-Q sheet) and
  `clear` (no element of A over any of B: the locked hint over the nodes). A clamped box counts as hiding a line only
  when at least half a line is cut (the font's glyph box stands 2 px past a tight line height on a one-line title).

### For the owner (old, not changed)

- **The scroll chevron and the BETA pill over cards** (the near-miss review's A6): the round chevron is the app's scroll
  cue (`ScrollDownIndicator`, fixed above the tab bar while more lies below, gone at the bottom), and the BETA pill is
  fixed at the bottom left; whatever scrolls under them is covered for a moment (on the end screens, now often SHARE
  YOUR WIN). The same with the switches off. Hiding the chevron once the page's last card is in view, or a little
  clearance above the BETA pill, would change every screen.
- **The stage pop-up's star goals** (A7): "★ < 27:00" and the like, 8 px stars over 7 px times, on the ladder's pop-up,
  which the path opens as it is.
- **The pop-up's "Best" time** (`ArcadeSeriesDetail` `fmtTime`) rounds the seconds, so a best of 17:59.6 would read
  "17:60" there; the clear screen and the path's sheet cut down to whole seconds.
- **The recap on short phones**: the end screens drop the round recap and the beta link under 812 px tall (above).

### Checked

- `test:streak` 140, `test:path` 96 (the gap against the tiles, the folded NEXT UP line), `test:nearmiss` 76 (the gap
  and YOUR TIME as shown), `test:xp` 121, `test:missions` 217, `test:concepts` 180, eslint on every changed file, `tsc`.
- `retention-preview.mjs` at 360, 390 and 430 on the fixed clock: every state of the three features (the fake-clock
  end screens included, `f1-end-week-complete` and the two PAR-Q states with them) and the three galleries fit. Looked
  at each photo and the gallery crops: the chip's dots and caption read on Home and the end screens, FIGHT ASCENDANT
  keeps one line at 360, Home shows one card for the saga and one for the camp, the locked hint sits under node 8 clear
  of 7 and 9, the sheets say 2:40 and 8:05 off, the gallery's clear screen keeps its stats on one line at 360.
- Switch off: every change is a branch on its switch (`weeksOn`, `pathOn`, `compact`), and the shared pieces render
  the same markup without it (`HomeHeader`'s gap 12, the ladder's toast at the top, the clear screen's stats row).

## Owner preview (2026-11-23)

Real screenshots of all three features at 360, 390 and 430 wide, with the open decisions as tap-to-answer choices:
https://claude.ai/artifact/8rkLzhnBSc19h5L5pitdys. The owner's answers are in its database: collection `answers`
(one doc per question id, `{ choice }`; a question with no doc keeps the default marked "in use") and `notes`
(one doc per screen state, `{ text }`, plus `general`). Read them with ArtifactData before acting on any decision. The same page is now the one preview board for
everything waiting on the owner (the Fit card's questions are prefixed `fit-`, the Fit screen's Quick Mission merge is
`q-hub`).
Final check on 49b1e182: unit suites pass, build:web passes, smoke:web 147 of 147.

## Home: one TODAY'S BOUT card (2026-11-23)

The owner, on the two cards at the top of Home (DAILY MISSION and TODAY'S BOUT, each with a gold START): "I don't
want two different things because honestly that's confusing… merging it into one entity… the how-to question mark
needs to be updated as well." Behind the same switch (`retentionOn('weeks')`); with it off, Home, the end screens,
storage and XP are as before.

### What changed

- **One card.** The DAILY MISSION card is gone from Home (`retention/ui/DailyMissionCard.jsx` deleted: nothing else
  used it). Home's top card, whenever no session is paused, is **TODAY'S BOUT** (`retention/ui/TodaysBoutCard.jsx`):
  the same art, mode tag (FIT MODE / FIGHT MODE), title and gold START as Home's card, plus the daily mission's hooks:
  `+25 XP` beside START, a length tag (`12 MIN`) where the pick knows its length, a true personal line where it has one
  (`SAME AS LAST TIME`, `FITS YOUR LEVEL`, and `AT YOUR PACE` joins that line), and a done state.
- **Its pick** is Home's own engine, in the order the card always had: the last session started (ready to run again;
  on the path, folded with NEXT UP for a saga or the camp), else the Game Plan's bout, else the setup's first pick
  (`firstPick`). `data/dailyMission.js` `pickTodaysBout` is the pure version of that order; HomeDashboard passes it
  what it reads (last session, NEXT UP, `getTodayBout`, `firstPick`). The old 3-minute deal (`dealDailyMission`,
  `dailyMissionCfg`, `missionForStart`, App `startDailyMission`) is removed.
- **Held for the local day** in `tm_daily_mission_v2` (already synced), new shape `{ v: 3, date, bout, done, doneAt,
  xp }`: a reload, another session, a level change or another device shows the same bout and START runs the same thing
  (a held last session is replayed from the card's own copy: App `replayLastSession({ last })`). Home picks again at
  local midnight (its existing midnight timer). The old box (`{ date, mission, done }`) reads with no bout; its done flag
  for today still counts. SURPRISE ME re-rolls the card in place into a Surprise Mission and holds that for the day.
- **The bonus** (the existing Mission of the Day amount, 25 XP): paid once a local day for the first valid session
  started from the card that runs to its end. Settled in ONE place: App listens to every stats write
  (`training-mode-stats-updated`, fired by every `userStats` add) and calls `settleTodaysBout`. START (or ADJUST) on
  the card arms it in `tm_bout_arm_v1`; the first session row banked after the tap is the card's session, whatever
  screen it ran on; the arm is then spent, paid or not. It pays when that row is a training day
  (`weekStreak.isTrainingRow`: not an award, not refused/`unverified`, not zero-work), ran to its end (its own
  `completed` flag where it has one, else every round, set or drill done) and was banked today. Back on Home with no
  session started since START (none paused since), the arm is dropped. The three per-route `settleDailyMission` calls
  in App are gone.
- **Never twice**: the done flag is written before the XP (nothing is paid if it cannot be written); the bonus row is
  tagged with its day (`{ type: 'Mission of the Day', bout: 'YYYY-MM-DD' }`), so a done flag or a bonus row synced
  from another device both read as paid; the arm is device-local, so a synced copy cannot carry one.
- **Done state**: green check and border, "+25 XP earned. A new bout tomorrow.", and a quiet TRAIN AGAIN that runs
  the bout again with no second bonus (the tone of the old card's done look).
- **End screen**: the strip's line reads `✓ TODAY'S BOUT · +25 XP`.
- **A refused Combat Conditioning session** (its screen reads VALIDATION FAILED; App still banks the drills' XP, old)
  is now marked `unverified` under the switch (`missionSolo.combatRunRefused`, the screen's own verdict), like the
  refused guided Quick Mission before it: no Today's Bout bonus, no training day, no fight trophy count. Its XP banks
  as before. Fight Focus and Combo Coach already marked theirs; camp, arcade v2 and guided v2 bank 0 for a refused
  block, so their rows never count.
- **The "?"**: with the switch on Home uses `SCREEN_GUIDES.home_weeks` (TODAY'S BOUT: picked when the day starts and
  kept all day, +25 XP once a day from START, the green done card and TRAIN AGAIN, SURPRISE ME; and the header step
  now explains the week chip instead of the old 🔥 day count), and the first-run tour `full_intro_weeks` (its Home
  step is ▶ TODAY'S BOUT with the bonus and the done state; its XP step says "week streak"). No DAILY MISSION step
  existed in the guides; none is added. Switch off: `home` and `full_intro` as before.
- **Gallery** (`/retention-looks`, feature 1): TODAY'S BOUT ready (a last session), a new fit athlete, and done, all
  the real component.

### Routes that pay

Every route ends by banking a session row through `data/userStats`, so the one listener covers them all:
Continue (Fight Focus, Just Train, Combo Coach, Quick Mission guided or at your pace, Build Workout and program days,
Combat Conditioning, Cardio), the camp map and a saga (camp levels, v2 stages, classic stages, a block at a time), NEXT
UP, the Game Plan's and the first pick's routes through a setup screen (Fight Focus, Combo Coach, Quick Mission, Build
Workout, Combat Conditioning), Start Here and Practice (the drill's `Practice` row; the lesson's own award row is not a
session), the Fit hub (`train`: whatever is started there), a recovery round (the Quick Mission page) and SURPRISE ME.

Do not pay: a session stopped short, refused or with no work (by rule); a session started after going back to Home
without starting one; a session that runs past midnight (yesterday's START: the old card did the same); a Coach's
Tape opened from the Fit hub the card led to, when the phone reloads the app on the way back from YouTube (the app
lands on Home first, which drops the START). The end screens that are not `MissionComplete` (Practice, Cardio,
Tapes, the classic stage clear) pay but show no strip; Home's card shows done afterwards.

### Decisions (each easy to change)

- **A returning athlete's bout is their last session** (Continue / NEXT UP), held for the day; a new athlete's is
  the setup's first pick (or the Game Plan's). A paused session keeps the top card (RESUME, no bonus line) until it
  is finished or discarded; the bout comes back after. A paused session started from the card still pays when it is
  finished.
- **"Finished"** means run to its end: a guided Quick Mission with a skipped move, or 1 of 3 rounds, pays no bonus
  (as the old daily mission: its round done, the mission completed). That START is spent; START again and finish.
- **ADJUST arms the bonus too** (it opens today's bout's own settings).
- The Game Plan's bout is held as if nothing was trained yet (`getTodayBout({ ignoreTrainedToday: true })`): no
  "Trained — Nice Work" pick while the bonus is still open. Its rest-day line reads "Rest days never break your week
  streak." (the combo line is hidden under the switch). A 1-round session reads "1 round" (Home's old line says
  "1 rounds"; the switch-off line is unchanged).
- The length tag is left out when the title already says it ("Quick Mission — 12 Min Starter").
- `tm_bout_arm_v1` is the one new key and is deliberately NOT in SYNC_KEYS (an exception to the storage rule, like
  the paused-session snapshot): a synced arm would let a session on another phone pay.
- No new spoken line: nothing here speaks.

### Checked

- `test:streak` 170 (was 140): the pick in every order and its words, what pays (every row type, partial, refused,
  zero-work, award, another day, the at-your-pace flag), held across reloads and other sessions, new at midnight,
  SURPRISE ME then START once, the arm (an XP-only write or an award row does not spend it, a START with nothing
  started is dropped on Home, a pause since keeps it, yesterday's START pays nothing), the done flag that cannot be
  saved, once a day, device B with A's synced box, a stale box beside A's synced rows, the old box shape, the switch-off
  bonus row; the cross-feature refused guided Quick Mission through the new settle, and the refused Combat
  Conditioning row. `test:xp` 121,
  `test:missions` 217, `test:qm` 83, `test:concepts` 180, `test:nearmiss` 76, `test:path` 96, `test:practice-moves`,
  `test:storage`, `test:levels`, `test:athlete`, `test:ayp`, `test:maxout`, `test:tapes`, eslint on every changed file,
  `tsc`, `check-guides` (23 guides, 237 steps).
- `retention-preview.mjs` at 360, 390 and 430: `f1-home-mission-ready` (a fighter's last session: 11 MIN · SAME AS
  LAST TIME, START, +25 XP), `f1-home-mission-fit-new` (Quick Mission — 12 Min Starter, FITS YOUR LEVEL),
  `f1-home-mission-done`, the new `f1-home-bout-surprise` (after SURPRISE ME) and `f1-home-guide-bout` (the "?" on its
  TODAY'S BOUT step), the freeze notices (the toast clear of the card), the widest header, the gallery, and both end
  screens reached by really pressing START on the card on a fake clock (the strip ends `✓ TODAY'S BOUT · +25 XP`);
  `f2-home-next-up` and `-camp` now read TODAY'S BOUT · One Hundred · Stage 6 · CONTINUE · +25 XP. Looked at each photo:
  the title and line wrap balanced (never one word alone), START and +25 XP share a row at 360, nothing cut. The whole
  preview (all 34 states of the three features, the f2 and f3 states that start from Home's card included) fits; the
  Fight Focus stopped at 1 of 3 from the card shows its strip with no bonus line.
- Switch off, in the browser: Home shows the old CONTINUE card ("Boxing · 3 rounds · Normal · 11 min", no bonus), the
  "?" has its CONTINUE step, SURPRISE ME the old in-memory Surprise card, and neither `tm_daily_mission_v2` nor
  `tm_bout_arm_v1` is written.

### Review fixes (2026-11-23)

The independent review of the merged card; a skeptic confirmed each. All behind the `weeks` switch.

- **A session that was not the card's could pay the bonus.** START, pause the card's session, then start and finish
  another one (from a hub, the "Also paused" slot, a Practice drill): the arm was still set, so that session paid. Now
  App holds the arm when a session is paused (`holdBoutArm`, the paused snapshot's time; only the first pause after
  START is the card's). While it is held, a session banked pays nothing. RESUME of that same paused session
  (`resumeBoutArm`) lets it settle again, counting from the resume, so rows banked while it waited are never read as
  its row. On Home the arm stays only while that paused session does. If it is gone (discarded, expired, replaced by
  another of its kind), the arm goes.
- **A cloud restore could pay the bonus.** The restore replaces the local rows and fires the stats event before its
  reload, so a newer row from another phone could settle today's START. The restore's event now says so
  (`detail.restored`), and the settle then drops the arm and pays nothing (`settleTodaysBout({ restored })`). The other
  listeners do not read the detail.
- **The freeze notices covered the header** (level, rank, XP bar, week chip and "?", so the updated guide was out of
  reach). The freeze-used and freeze-earned notices now sit **under** the header, above the card, so the chip they talk
  about stays in view. While one shows, the slot over the header stays empty (still one notice at a time). The other
  nudges and the come-back reminder keep the slot over the header, as before. The notice's line wraps balanced (no
  one-word second line at 390). The gallery's freeze card matches.
- **The "?" step for TODAY'S BOUT is 4 lines at 360** (it was 9): "Today's one pick, kept all day. Finish it from START
  for +25 XP, once a day; then the card turns green and TRAIN AGAIN runs it again. SURPRISE ME swaps the pick; ADJUST
  opens its settings." The AT YOUR PACE clause is gone (Home's switch-off CONTINUE step still explains it). The week chip
  is explained in the header step.
- Checked: `test:streak` 184 (was 170). New cases: START, pause, an unrelated full session, then a Practice drill, both
  pay nothing; resuming another slot changes nothing; RESUME of the card's session then finishing it pays once; the
  same with the card's session stopped short pays nothing (the unrelated full row is not read); the card's paused
  session replaced, then Home drops the arm; a restore with a newer row pays nothing and drops the START; the App and
  cloudSync wiring. Also `test:xp` 121, `test:missions` 217, eslint on every changed file, `tsc`, `check-guides`.
  `retention-preview.mjs` at 360, 390 and 430: every f1 state and `f2-home-next-up(-camp)` fit. The freeze states now
  check that the notice is clear of the header, the "?" and the card. The guide state expects ADJUST and no AT YOUR PACE.
  Looked at the freeze notices (header, chip and "?" in view, balanced lines), the 4-line guide step and the gallery's
  freeze card at each width. Switch off: Home, Profile's editor and a 1-round Fight Focus end screen captured on HEAD
  and with this fix are the same DOM and storage, apart from the random reminder line and row ids.

### Needs the owner's answer

1. **A returning athlete's daily bout is their last session again** (or the next stage of their saga or camp). Keep,
   or deal something new some days (the old daily mission was a fresh 3-minute session every day)?
2. **Only a session run to its end pays** (a skipped move or an early END does not). Keep, or pay any valid session
   with work done?
3. **A paused session takes the card's place** until it is finished. Keep, or show the bout with a small paused row
   above it?
4. **The bonus is 25 XP** (the existing Mission of the Day amount; asked before, still open).

## 1UP, POWER, RUSTY and REVIVE (2026-11-23)

The owner's decisions on the idea in `RETENTION-PLAN.md` (last section): the freeze is called a **1UP**; a **POWER**
bar drains while the athlete stays away and refills with a finished session; after a month away the fighter is
**RUSTY**, and nothing earned is ever taken away (no XP, level, streak, badge or star change); **REVIVE** is the
comeback session; an in-app pop-up for RUSTY. Phone alerts are not in this build (they come with the notifications
release after the App Store launch). The 1UP rename sits under the existing `weeks` switch; POWER, RUSTY and REVIVE
under a new switch, `power` (`data/retentionFlags.js`, off for everyone, on with the owner preview). With both
switches off, Home, the end screens, Profile, storage writes and XP are as before (checked below).

### What was built

- **1UP** (switch `weeks`): every word and glyph the athlete sees. The week chip's `❄2` is a compact mark, "1UP" over
  "×2" (`retention/ui/OneUpMark.jsx`, both 10 px since the review fixes below; 17.3 px wide), so the chip still fits
  Home's header at 360 with the longest rank names. The notices read "A 1UP covered last week:
  your 9-week streak is safe." and "1UP earned: 4 weeks on target. You hold 2 of 2." with a small 1UP badge for the
  icon; the end-screen strip "1UP EARNED · YOU HOLD 2 OF 2"; Profile's Game Plan "1UP 1 OF 2"; Home's "?" header step
  ("1UP is a spare life that saves the streak in a short week (one more every 4 weeks on target, hold 2)"); the gallery
  (feature 1 is "TODAY'S BOUT + 1UP"). Its colour is the 1UP green (`HOME.oneUp`, #6BF59A), not the freeze's ice blue.
  Numbers, event names (`freeze_used`, `freeze_earned`) and storage keys are unchanged.
- **`data/power.js`** (pure): `powerAt(rows, now)` returns `{ pct, state: 'new'|'full'|'draining'|'low'|'rusty',
  daysSince, lastDay }` from the week streak's training-day rule (`weekStreak.isTrainingRow`, local calendar days):
  100% for days 0 to 3 after the last training day, then a straight line, 4% a day, to 0% at day 28; 'low' at 40% or
  less (day 18); RUSTY from day 30. A brand-new athlete is 'new' (no drain, no RUSTY). Also the moments, each keyed so
  it shows once: the low notice (`low:<last training day>`, once per drain), the RUSTY pop-up (`rusty:<last training
  day>`, once per rusty spell), the revive (`revive:<the training day before it>`, once per revive), and their copy.
  It writes nothing and imports no store.
- **`data/powerStore.js`**: reads the rows, keeps only the shown markers in **`tm_power_moments_v1`** (the one new key,
  in `cloudSync` SYNC_KEYS).
- **Home** (switch `power`): the **POWER line** under the header (`retention/ui/PowerLine.jsx`) only while the fighter
  is below full; the **low notice** "Your POWER is running low. One session revives it." under the header, once
  per drain (no number: the line right above shows it); the **revive notice** "Revived: your fighter is back to 100% power." once, for a revive whose session ended
  on a screen with no YOUR PROGRESS card (Cardio, Practice, Coach's Tapes, the classic stage clear); the **RUSTY pop-up**.
- **RUSTY pop-up** (`retention/ui/RustyPopup.jsx`): the RUSTY art for the profile's sex (the stand-in until the art
  exists), RUSTY, "34 days since your last session.", "Your level, XP, streak and badges are all still here.", a gold REVIVE and
  a quiet LATER. It takes the open's one turn in App's interstitial queue (`goAfterSplash`) and Home shows it.
- **REVIVE moment**: the first valid finished session after 'low' or RUSTY shows one line in the end screen's YOUR
  PROGRESS card, "⚡ REVIVED · POWER 100%" (`retention/ui/ReviveLine.jsx`; the revive art small beside it when the file
  exists), above the week strip. Once per revive.
- **The RUSTY look** (`retention/ui/RustyLook.jsx`): while RUSTY, the tier portrait on Profile, the Level page and the
  end screen's YOUR PROGRESS card is greyed and rust-toned (a filter) with dust and rust over it (noise drawn in SVG:
  fine specks, soft clouds, rust patches; no image file). The name, level, LEVEL › label and XP are untouched.
- **The owner's art**: read from `/static/retention/rusty-{male,female}.webp` and `/static/retention/revive-{male,female}.webp`
  when the files exist; on a missing file the stand-in (the athlete's own tier portrait with the rusty look) shows, never
  a broken image. What to make and how to drop it in: **`docs/retention/ART-RUSTY-REVIVE.md`** (with generator prompts).
- **Guides**: with `power` on, Home's "?" has one more step after the header's, "⚡ POWER · RUSTY · REVIVE" (centred,
  since the line only shows below full): full for 3 days after training, then slowly drains, RUSTY after a month away,
  one finished session REVIVES it to 100%, nothing earned is ever taken away. `shared/screenGuides.js` `homeGuide({ weeks,
  power })` picks Home's steps; with both off it is `SCREEN_GUIDES.home`, as before.
- **Gallery**: a new section, "POWER, RUSTY + REVIVE" (`/retention-looks#f8`, `retention/lookPower.jsx`), the real
  components with sample data.
- **Tests**: `npm run test:power` (`scripts/test-power.mjs`, 79 checks, in `check:all`). `test:streak` now checks the
  1UP words (185).
- **Preview** (`scripts/retention-preview.mjs`): `f4-home-power-draining`, `f4-home-power-low`, `f4-rusty-popup-male`,
  `f4-rusty-popup-female`, `f4-home-rusty` (after LATER), `f4-end-revived` (REVIVE on the pop-up for real, on the fake
  clock, to the end screen), `f4-profile-rusty`, `f4-level-rusty`, `f4-home-guide-power`, `f4-gallery`. The f1 states
  keep their names and now expect the 1UP words and no "freeze" or ❄. Two new checks: `inView` (a pop-up card whole on
  screen) and `oneLine` (a rank name never breaks in two).

### Decisions (each easy to change)

- **POWER on Home: one slim line under the header, only below full.** Why this is the calmest: a trained athlete (the
  usual case) sees nothing new; the header itself is untouched (at 360 its level column already has only about 108 px,
  so a bar inside it would squeeze the rank, and a pill beside the chip does not fit); it is not a card, it lines up
  under the level text (indented by the logo's width) so it reads as part of the level block, and it is 16 px tall.
  The bar is ten cells, like a game's power meter, so it never reads as a second XP bar; gold while draining, amber at
  40% or less, and at RUSTY the cells are empty and the number reads RUSTY in the rust colour.
- **One notice under the header a visit**: a 1UP notice first; POWER's (revive, else low) on a later visit. Both use
  the slot under the header, so the level, the chip and the "?" stay in view. At 'low' the line and the notice both
  show (the notice once per drain, dismissible; the number is on the line only).
- **POWER moves by local day**, not by the hour: stable all day, the same rule as the week streak. The percentages are
  96, 92, … 44 (day 17), 40 (day 18, low), … 0 (day 28); day 29 is 0% and low; day 30 is RUSTY.
- **The revive**: a training day whose previous training day was 18 or more days before it (the fighter was low or
  RUSTY that morning). The end screen shows its line only for the session that just banked as today's first training
  row (the week strip's freshness rule, a cardio finisher's own row allowed); otherwise Home shows its notice once, for
  a revive today or yesterday (older is news to nobody).
- **The RUSTY pop-up's turn**: in App's one-interstitial-per-open queue, after a friend's haunt link and before the
  ghost-challenge offer, the concept drop, the comeback cutscene and the weekly lesson: it is the moment the comeback is
  for, and the others come back on a later open. Not under an inbound arcade challenge. It is marked shown when it
  shows, so a turn it cannot use (a paused session on Home, the guide open) does not mark it, and the turn passes down
  the queue (the ghost offer, the drop, ...); any App pop-up that opens after it (a haunt link resolving late) hides it
  until that one closes, so two never stack. Paused sessions expire
  after 90 minutes, so a rusty athlete has none in practice.
- **REVIVE runs the top card's own START**: TODAY'S BOUT's (armed, so its bonus rules apply: +25 XP once a day for a
  session started from it that runs to its end) or, with the week streak off, the Continue card's.
- **Double taps**: the pop-up ignores taps for its first 350 ms (the tap that opened the app), REVIVE and LATER eat the
  click after them (`swallowNextClick`, as FinishWorkoutConfirm does), and a tap outside the card is LATER. REVIVE
  eats one again when the bout screen comes in, 1.35 s after the tap (the tap's own 600 ms guard is long gone by
  then), so an impatient second tap never lands on the bout screen.
- **The pop-up's art is top-aligned** (`object-position: 50% 0%`): a tier portrait's own logo at its top edge is never
  cut, and the face sits in the upper half the card shows.
- **Portraits that stay as they are**: the share card, the ghost result and the level-up reveal show a session just
  finished, which revives the fighter anyway.
- **No phone alerts and no spoken line** in this build (nothing here speaks; `test:power` checks the POWER UI calls no
  speech).

### Checked

- `test:power` 79 (the thresholds day by day, the straight drain, local-day edges at 00:01 and 23:59, a daylight-saving
  change, UTC+14 and UTC-11 for the same two instants, a brand-new athlete, award / refused / zero-work / empty Cardio
  rows ignored, a cleared 0-XP tape counted, the rusty spell's key and a later spell's, the low notice once per drain,
  the revive found once (rusty, low, not after a draining gap, not for a new athlete, not for a second session or a
  stale one, with a cardio finisher, on Home today or yesterday but not two days later), that only
  `tm_power_moments_v1` is written and the stats, XP, level and week streak are unchanged, the switch off for everyone,
  the sync key, the queue order in App, REVIVE wired to the top START, the double-tap guards, no speech, no guilt words),
  `test:streak` 185, `test:xp` 121, `test:missions` 217, `test:levels` 183, `test:nearmiss` 76, `test:path` 96, eslint on
  every changed file, `tsc`, `check-guides` (25 guides, 257 steps), `check-public-assets`.
- `retention-preview.mjs` at 360, 390 and 430 on the fixed clock: the whole preview, 44 states (every f1, f2, f3 and
  f4 state), fits (nothing past the sides, no text cut, the pop-up card whole on screen, the POWER line clear of the
  header, the notice and the card). `voice:coverage`: 0 missing (nothing new speaks). Looked at each photo: the 1UP mark reads at 360 beside FIGHT ASCENDANT; the POWER line at 72% and 36%;
  the low notice on two balanced lines; RUSTY on the line after LATER; the pop-up for a male and a female profile (the
  stand-in art greyed and dusty, nothing cut); REVIVED · POWER 100% above the week strip after REVIVE ran the 3-minute
  round; the rusty portrait on Profile and the Level page with the name, level and XP readable; the guide's POWER step.
- Switch off (both): a RUSTY (34 days) and a draining (19 days) athlete, captured on HEAD and on this build with no owner
  preview on a fixed clock: the open (the concept drop pop-up, as before), Home, Profile, the Level page, a 3-minute
  Fight Focus played to its end screen, and every storage key after it. Same DOM and the same storage, apart from the
  run's timestamps and row ids and the share prompt (its own timer had shown it in one capture and not yet in the other).

### Not covered

- Phone alerts ("losing power") wait for the notifications release (opt-in, at most one a week, as the plan says).
- The RUSTY pop-up comes on an open of the app (after the splash). An athlete who keeps Home open across day 30 sees
  RUSTY on the line, and the pop-up at the next open.
- POWER shows on Home only (Profile and the Level page show the rusty portrait, not the bar).

### Review fixes (2026-11-23)

The independent review of this build; a skeptic confirmed each. All are polish, all behind the switches (`weeks` for
the header, the chip and Game Plan; `power` for the rest).

- **Home's header changed height from athlete to athlete.** With the week chip, the rank wrapped under the level only
  when it did not fit beside it (LV 14 over CHAMPION with a 9-week chip, LV 6 NOVICE on one line), so the POWER line
  and the cards moved by a line. The rank now always sits on its own line under the level (`shared/HomeHeader.jsx`,
  compact only), with a fixed 14 px line, so the header is 43 px for every rank, level and chip at 360, 390 and 430
  (measured for ROOKIE with 0 weeks, FIGHT ASCENDANT with 18 and 26 weeks). A secret rank's long name sets its letters
  a little closer (0.04 em), so FIGHT ASCENDANT (94 px) keeps one line in the 98 px the column has at 360 beside the
  widest chip. Switch off: the header is as before.
- **A RUSTY turn Home could not use skipped the rest of the open's queue.** App gave the open's one turn to the RUSTY
  pop-up; Home declined it under a paused session or the guide, and nothing else showed that open (the ghost offer,
  the concept drop, the comeback, the weekly lesson). Now Home answers the turn (`onRustyDone(shown)`), and when the
  pop-up did not show and no App pop-up is up, App runs the rest of the queue (`openQueueRest`, the same steps in the
  same order as before). A ref makes a second answer a no-op. Switch off: `goAfterSplash` runs the same steps as
  before. Regression: `test:power` checks the order, the answer and the hand-on; the preview state `f4-rusty-paused`
  opens the app RUSTY with a session paused 10 minutes ago and expects the concept drop, not the RUSTY card.
- **The low notice repeated the number on the line above it** and said "losing power". It now reads "Your POWER is
  running low. One session revives it." (no number; the line shows it). Each sentence keeps its words together, so at
  360 it breaks between the two; at 390 and 430 it is one line.
- **Game Plan's "1UPS 1/2"** read like a typo. It now reads "1UP 1 OF 2", like "You hold 2 of 2" elsewhere.
- **The chip's small type was 8 px in grey** ("×2" under 1UP, "0/4 DAYS"). Both are 10 px now, in brighter tones
  (`HOME.text` #E6E2F5 for a count above 0, `HOME.soft` #CBC6E0 for the days), and "1UP" is 10 px too. The days caption
  stays inside the width of the dots (44 px of 60), and the 1UP mark is 17.3 px, so the chip grew by under 2 px.
- **The stand-in RUSTY art was nearly black** for the male portraits. The filter is lighter (`grayscale(0.8) sepia(0.4)
  brightness(0.9) contrast(1.08)`, was brightness 0.7), the rust layer is lighter (0.7, was 0.85), and the dust clouds
  and the rust are fainter over the face (a soft mask on the portrait's upper middle), so the face and fists read
  while the fighter still looks covered. The same look on Profile, the Level page and the end screen.
- **The pop-up named level, XP and badges but not the streak.** It now reads "Your level, XP, streak and badges are all
  still here."
- Checked: `test:power` 83 (was 79), `test:streak` 185, `test:xp` 121, eslint on every changed file, `tsc`,
  `check-guides` (25 guides, 257 steps). `retention-preview.mjs` at 360, 390 and 430: every f1 and f4 state (the new
  `f4-rusty-paused` too) and `f2-home-next-up(-camp)`, 26 states, fit. Looked at each: the header at the same height
  with LV over the rank for ROOKIE, NOVICE, WARRIOR, CHAMPION, MAX and FIGHT ASCENDANT (one line beside the 12-week
  chip at 360); "3/4 DAYS" and "×2" readable on the chip and in the end-screen strip; "1UP 1 OF 2" with its line beside
  it on one line at 360; the low notice under the 36% line; the pop-up for both sexes at each width (the male face and
  fists now read, the new line on two balanced lines, nothing cut); the rusty portrait on Profile, the Level page and
  the end screen; the concept drop on the paused RUSTY open.
  Switch off (both): the capture above again (a RUSTY and a draining athlete: the open, Home, Profile, the Level page,
  a 3-minute Fight Focus to its end screen, storage): the same DOM and storage as this build before the fixes, apart
  from the run's timestamps and row ids and the share prompt's own timer.

### Needs the owner's answer

1. **The numbers**: full for 3 days, empty at day 28, 'low' at 40% (day 18), RUSTY at day 30. Keep?
2. **The pop-up's place in the open queue**: before the concept drop (a drop waits for the next open). Keep?
3. **The art**: four files, `docs/retention/ART-RUSTY-REVIVE.md` (sizes and prompts). Until then the stand-in shows.
4. **1UP in green** on the chip, the strip and Profile (the freeze was ice blue). Keep?
5. **The rank always under the level** on Home's header (the review's calm fix): every athlete's header is now two
   short lines and the bar. Keep, or put the rank back beside the level where it fits (the header then moves by a line
   between athletes)?

## The game-over world score board (switch `scores`), 2026-11-24

The owner approved the server design on 2026-11-23 and asked for it built for real, visible only on the owner's
phone until January. Built behind a new switch, `scores` (`data/retentionFlags.js`), off in `FOR_EVERYONE`, on only
with the owner preview. The full record (the pieces, the 203 boards, the boards left out and why, where the build
differs from the design, applying the migration, rolling it back, the SQL tests) is in `SCOREBOARD-DESIGN.md`,
section **Built**.

### What was built

- **The migration** `supabase/migrations/20261123120000_create_score_boards.sql`: `board_players`, `board_scores`,
  `board_rules`, `board_house`, `board_runs` (tickets), `board_name_blocklist`, `board_flags`; RLS on with no client
  policies and every privilege revoked; `get_board` (anyone), `get_my_place`, `get_board_profile`, `join_boards`,
  `set_board_profile`, `leave_boards`, `start_board_run`, `submit_score` (signed in), all security definer with a fixed
  `search_path`, acting only on `auth.uid()`. House rows are built from `board_rules.house` when a board is read and are
  never stored. Not applied anywhere but a local PGlite database.
- **The rules from the app's data** (`data/scoreBoardRules.js`), written into the migration by
  `scripts/score-board-rules.mjs`: 203 boards (Fight Focus 24, Just Train 16, Combo Coach 64, Quick Mission at your
  pace 84, Max Out 15), every one BETA.
- **The client** (`data/scoreBoardCloud.js`): a ticket in the background at START; at FINISH the opt-in (the first
  time), the submit, the board and my place; signed out, offline at START or after NOT NOW, one plain line; offline at
  FINISH, the score waits on the phone (24 hours) and the card shows the phone's last copy with this score in its
  place; a server error hides the card. Nothing blocks or slows an end screen.
- **The screens**: the end screen's board slot (`retention/ui/ScoreBoardSlot.jsx`) under the summary of Fight Focus,
  Just Train, Combo Coach (`SessionSummary`) and Quick Mission (`QuickMissionComplete`): the opt-in over the end screen,
  the HIGH SCORES card, the GAME OVER board when it is news, or one line. Profile: a SCORE BOARD row under the account
  card and its page (`retention/ui/BoardProfile.jsx`: the name once a week, the country, LEAVE BOARDS). The looks'
  components are reused as they are (`ScoreBoard`, `GameOverBoard`, `HighScoresCard`, `BoardOptIn`); `composeBoard`
  and `placeLine` stay the one source of the merge and the wording (the server's merge is tested against them).
- Small, shared: `retention/scoreFormat.js` (ORD, formatScore, no React), `data/fightPresets.js` (Just Train's
  presets, Combo Coach's cadence per level: both setup screens read them, behaving as before).

### Decisions (each easy to change)

- **When the board is news** (a new best that lands in or moves up the top 10, or a first score on the board), the
  full GAME OVER board opens over the end screen if the answer comes within 4 s, and always right after JOIN; CONTINUE
  closes it. Later answers only fill the card (NEW BEST on the row; VIEW BOARD opens the board).
- **A fight session posts** when every round is done, the integrity check passed, the phone counted strikes, and it
  ran at a board setting with no Rush Mode and no ghost. **A mission posts** at your pace (Max Out guided too),
  finished and passed, with its own moves (no swap, no gear default, not SCALED), inside the cap; a for-time time adds
  back the paused seconds.
- **The one-line reasons**, only on a finished session: "Board settings only: 3 × 3 or 5 × 3 min, 60 s rest." (Combo
  Coach adds "the level's own cadence"; Just Train: "Board presets only: Bag, Pads, Spar or Tabata."), "Rush Mode and
  ghost runs don't go on the board.", "Strike counting was off, so this one can't go on the board.", "Swapped or
  scaled moves don't go on the board.", "Sign in on Profile to put your scores on the world board.", "Started
  offline, so it can't go on the board.", "Join the world board on Profile to post your scores.", "Goes up when you
  are back online.", "The board did not take this one." A stopped or failed session shows nothing. A concept stage,
  a camp session and Today's generated mission are not board modes: nothing is said.
- **The opt-in** starts from the profile's name (cut to the board's 12 characters), and offers the country the
  phone's language settings carry (en-US: US); no region, no switch.
- **The card** says "Today: 899. Your best (939) stays on the board." when this session did not beat the best that
  stands (the board shows the best).
- **Resumed sessions**: a session restored after a reload has no ticket (the app keeps it in memory), so it shows no
  board.
- New storage keys (not synced): `tm_score_board_v1` (joined / NOT NOW, the name), `tm_score_boards_cache_v1` (the
  last copy of each board), `tm_score_board_queue_v1` (scores waiting to go up).

### Checked

- `npm run test:scoreboard` (99, in `check:all`): every board's key, rules and title; each mode's board at START and
  score at FINISH and the reasons; caps; the view (place and rank, pinned row, next place, short of best, the card's
  line); news; the offline copy; the client against a stubbed network (the opt-in before any post, JOIN posting the
  same session, one post per session, offline at START and at FINISH, the queue, signed out with no call at all, a
  server error, a refusal, NOT NOW and LEAVE BOARDS asking no more tickets, name and rename refusals); the switch; the
  migration's generated rows matching the app's data.
- `npm run test:scoreboard-sql` on PGlite (163): see `SCOREBOARD-DESIGN.md`.
- `npm run preview:scores` against the dev server, a real 3 × 3 Fight Focus played on Playwright's clock with the
  phone's motion played in, signed in with a stand-in session, every board call answered by `route()`: the opt-in,
  JOIN and the first board, a new best, the end card, a busy board (#143 of 2,310: card and full board), started
  offline, Profile's row, page and LEAVE BOARDS, and the switch off (no board call, the end screen as before). All
  fit at 360 × 780, 390 × 844 and 430 × 932; every photo looked at. Fixed from the photos: the card's quiet line for a
  score below the best; Profile's country switch balanced on two lines at 360.
- `score-looks-preview.mjs` (the looks unchanged), `test:streak`, `test:path`, `test:nearmiss`, `test:power`,
  `test:maxout`, `test:missions`, `test:voice`, `test:spoken`, `test:clips` (nothing spoken was added), eslint on every
  changed file, `tsc`, `build:web`, and `smoke:web` for the fight and mission starts and ends, Max Out, Profile and the
  Level page.

### Not covered

- The arcade stages and the GPS run (see `SCOREBOARD-DESIGN.md`: the app cannot feed them yet), three SOLO missions
  whose score is none of the design's kinds, and for-time runs stopped by their cap.
- The photos drive Fight Focus only; Quick Mission and Max Out reach the same slot through `QuickMissionComplete` and
  are covered by the unit tests and the smoke runs (switch off), not photographed at their end screens.
- The caps are first numbers (BETA): check them against real sessions before January.

### Needs the owner's answer

1. **The full board after a slow answer**: shown only if the server answers within 4 s of the end screen. Keep, or
   always show it when it is news (it can then open a few seconds after the end screen)?
2. **The off-setting line** ("Board settings only: …") shows on every finished fight session at another setting,
   Today's Bout included. Keep, or say nothing there?
3. **A for-time run stopped by its cap**: off the board for now. Add it under the finishers (a second number on the row)?

## The owner's answers: today's bout takes turns, and the week streak everywhere (2026-11-23)

Two answers from the preview board. Both sit behind the `weeks` switch (`data/retentionFlags.js`, off for everyone,
on with the owner preview); with it off, the screens, storage, share card and reminder are as before.

### What today's bout is (`q-boutpick`): "Deal something fresh on some days"

- **What the owner chose**: not the last session every day. Days now take turns: after a day whose bout was a
  **repeat** (the last session again, or the next stage of a saga or the camp) comes a **fresh** day, and after a fresh
  day a repeat day.
- **A fresh day** is dealt the way the old Daily Mission dealt it (`data/dailyMission.js` `freshBout`, the deal the
  merge removed, brought back): a fighter gets one 3-minute Fight Focus round of their discipline (no warm-up), a fit
  athlete a 3-minute Quick Mission (its focus dealt from the date); the side is their stated goal, else where their XP
  is; on their level, one step easier the day after a session ("Lighter after yesterday", only when the level shown
  really is lower: Fight Focus has no Advanced, so an Advanced fighter one step down is still Hard and the line does not
  claim it). START runs it straight away; ADJUST opens Fight Focus's or the Quick Mission page's setup.
- **The card says which it is**: "3 MIN · SOMETHING NEW TODAY" on a fresh day, "SAME AS LAST TIME" on a repeat day (as
  before). A next stage keeps its own line (the stage), as before.
- **Deterministic and held for the day**: each held bout carries its turn (`bout.turn`: `repeat`, `fresh`, or `pick`
  for a new athlete's setup pick) in `tm_daily_mission_v2` (synced, as before). The next day reads the last held day's
  turn from the box (`todaysBout().prevTurn`), so the turns follow the days the athlete opened the app, not the
  calendar: a skipped day does not break them. The deal itself is a pure function of the date, the profile and the
  rows at the day's first open, then held. A bout held before this change reads its turn from its kind (the last
  session or a next stage: repeat; the old daily mission's box: fresh); no box at all, or an unreadable one: a repeat
  day (so the cards seen today stay as they are, and tomorrow is fresh).
- **Kept as they were**: a brand-new athlete (no last session) gets the setup's pick (or the Game Plan's) whatever the
  turn, then a repeat day, then a fresh one; SURPRISE ME re-rolls the card in place and the day keeps its turn; the
  +25 XP rules (armed by START or ADJUST, paid once a day for the card's session run to its end) are untouched.
- **The fresh session is never stored as the last session** (its config carries `freshBout`; `data/lastSession`
  `rememberSession` skips it, so RETRY and TRAIN AGAIN on its end screen are not stored either). Why: otherwise the next
  repeat day would repeat the 3-minute deal instead of the athlete's own session, and a saga or camp player would lose
  their next stage from the card for good. So the repeat day brings back their own session, still "SAME AS LAST TIME"
  (the same settings as the last session they chose).
- **On a fresh day the separate NEXT UP row stays hidden** (as under a surprise pick: the card is the one thing to do);
  the saga or camp comes back on the next repeat day, and the Arcade card is always there.
- **The "?"**: Home's TODAY'S BOUT step now starts "Today's one pick, kept all day: your last session one day,
  something new the next." (5 lines at 360), and the first-run tour's step says the same. Gallery: a new card
  "Home: TODAY'S BOUT, a fresh day" (the real deal).
- **Where**: `data/dailyMission.js` (`freshBout`, `freshSide`, `turnOf`, `turnAfter`, `pickTodaysBout({ prevTurn,
  profile, stats })`, the box's turn), `HomeDashboard.jsx` (passes the turn; runs a fresh Quick Mission tagged with its
  day; ADJUST and AT YOUR PACE for a fresh bout), `data/lastSession.js`, `shared/screenGuides.js`,
  `retention/lookStreak.jsx`.
- **No new spoken line**: the fresh session is an ordinary 1-round Fight Focus or a generated 3-minute Quick Mission,
  whose lines `test:spoken` already sweeps; `voice:coverage` reads 0 missing.

### Other places that showed the day streak (`q-daystreak`): "Switch them all to the week streak"

- **What the owner chose**: every place that showed the old day count shows the week streak instead.
- **Every place found**, and what each shows now with the switch on (`data/weekStreakStore` `weekStreakCount`, the same
  number as Home's chip):
  - **Profile**: the streak tile reads 🔥9 over **WEEK STREAK** (was 🔥n over STREAK, the day count).
  - **Progress**: the rank card's 🔥n now has a **WEEK STREAK** label under it; "LV 69" stays together when a long rank
    name wraps at 360 (FIGHT ASCENDANT ·, then LV 69).
  - **The Level page**: the fact reads **WEEK STREAK 9** (was DAY STREAK; `data/levelStory` `opts.weekStreak`).
  - **The share card** (the end screens' SHARE YOUR WIN, Cardio's, and a ghost battle's): its stat reads **9 WEEK
    STREAK** (`data/shareCard` `streakLabel`); the share text says "Streak: 9 weeks" (was "Streak: n days").
  - **The come-back reminder** (Home's toast; it is a screen line, not a phone notification and not spoken): its streak
    case is now the week streak's, shown when a streak is held, this week still needs training days and the days left
    can still get them: "9-week streak: 1 more day this week." with KEEP STREAK (`data/weekStreak` `streakAtStake`,
    `streakReminderCopy`). Otherwise the other reminder lines, as before. Two lines at 360.
- **Left as they are** (not the day count, or not shown): Home's old 🔥 chip (switch off only), the guides' "keep your
  streak" lines, Notifications' "Streak about to break" switch (it now governs the week case), `evaluateReminder` (the
  browser-notification path, called nowhere), the unused `shareRankUp` and `CompletedWorkoutShareCard`.
- **Where**: `Profile.jsx`, `ProgressScreen.jsx`, `LevelView.jsx`, `data/levelStory.js`, `shared/MissionComplete.jsx`,
  `SharePromptModal.jsx`, `ShareCardSheet.jsx` (a `data-streak-label` for the preview's check), `shared/GhostResultScreen.jsx`,
  `data/shareCard.js`, `data/shareUtils.js`, `data/reminderEngine.js`, `shared/ReminderCard.jsx`, `HomeDashboard.jsx`,
  `data/weekStreak.js`, `data/weekStreakStore.js`.

### Checked

- `test:streak` 244 (was 185): the fresh deal (side, discipline, level, lighter only when lower, the Advanced fighter,
  an award row yesterday, the fit focus by date, a 3-minute Quick Mission runs 3 minutes at every level and focus, plain
  data), the turns (after repeat: fresh; after fresh, a pick or nothing: repeat; a next stage is a repeat; a new athlete
  keeps the setup pick), five days held in a row (repeat, fresh, repeat, fresh, repeat), a reload, a skipped day,
  SURPRISE ME on either turn, a new athlete's first three days, the old boxes, a fresh session not stored as the last
  session, the bonus on a fresh day, the wiring; the week streak's reminder case and line, the reminder on the real
  clock (switch on and off), the share text, the wiring of every screen. `test:levels` 187 (the WEEK STREAK fact).
  Also `test:xp`, `test:missions`, `test:concepts`, `test:power`, `test:path`, `test:nearmiss`, `test:qm`, `test:ayp`,
  `test:athlete`, `test:storage`, `test:maxout`, `test:tapes`, `check-guides` (25 guides, 257 steps), eslint on every
  changed file, `tsc`, `voice:coverage` (0 missing), `test:spoken` (155).
- `retention-preview.mjs` at 360, 390 and 430, new states: `f1-home-bout-fresh` (a fighter's fresh day),
  `f1-home-bout-fresh-fit` (a fit athlete's), `f1-home-bout-repeat` (the day after a fresh day), `f1-end-fresh` (the
  fresh round played for real on the fake clock to its end screen, +25 XP, and the last session still the athlete's own),
  `f1-profile-week-streak`, `f1-progress-week-streak` (the longest rank name and a 2-digit level), `f1-level-week-streak`,
  `f1-share-week-streak` (the share card from the end screen: 9 WEEK STREAK on the picture), `f1-home-reminder-week`.
  The whole preview (every f1, f2, f3 and f4 state, 56 states) fits at the three widths (one camp photo caught the map
  still loading under load; on its own it fits). Looked at each new photo: the fresh card's title, its line ("Fight
  Focus · Hard", "No gear · Easy · Lighter after yesterday") and "3 MIN · SOMETHING NEW TODAY" each on one line at 360;
  the guide step on 5 lines; Profile's tile "🔥9 / WEEK STREAK"; Progress's "FIGHT ASCENDANT ·" then "LV 69" beside
  "🔥12 / WEEK STREAK" at 360 (one line at 390 and 430); the Level page's WEEK STREAK 9; the share card's "9 WEEK
  STREAK"; the reminder on two lines beside KEEP STREAK at 360.
- Switch off (no owner preview), on this build and on `5f4aff2a` with the same seeded athlete (trained yesterday, so the
  come-back reminder's day-streak case shows) and a fixed clock: Home, Profile, the Level page, Progress, a 1-round Fight
  Focus played to its end screen, the share card sheet (and the hash of the rendered card image), and storage after.
  The same DOM, the same card image and the same storage, apart from the new row's id and time.

## The owner's camp answers (2026-11-23)

From the preview board: `q-campstars` = **build**, and the notes on `f2-camp-replay`, `f3-camp-retry-parq` and
`f2-camp-path`. Photos: `retention-preview.mjs` states `f2-camp-path`, `f2-camp-replay`, `f2-camp-replay-older`,
`f2-camp-replay-start`, `f2-camp-end-stars`, `f2-camp-end-s1`, `f3-camp-parq-break`, `f3-camp-parq-recent`,
`f3-camp-parq-flagged` (and the old `f3-camp-retry-parq` for the first time), and after the review
`f2-camp-replay-s2` and `f2-camp-replay-lapsed`. Tests: `npm run test:camp` (`scripts/test-camp-stars.mjs`, 90 checks,
in `check:all`).

### 1. Camp stars (switch `path`)

The owner chose the proposed rule. Built as `data/campStars.js`, a pure function of the session rows (recomputed each
time, nothing stored but the rows):

- ★ the level cleared (the camp's own record, `tm_camp_progress` / `tm_camp_complete`): every clear, old or new.
- ★★ every round of the level done and verified (the end screen's "All rounds verified"), both sessions on a split level.
- ★★★ done the camp's way: no round cut short (SKIP ROUND, or FINISH before the bell), and on a split level Session 2
  started four to eight hours after Session 1 ended (the camp's "Leave 4-8 hours between missions"; 4:00 and 8:00 count).
  A FULL CAMP sitting runs both blocks at once, so it tops out at ★★.
- Best of the level's runs; a split run is a done Session 2 after the latest done Session 1 (each S1 pairs once).

**What the rows record, and what was added.** A camp row had type, `campLevel`, done/total and its end time. It did not
say which session it was, whether every round was verified, whether a round was cut short, or when the session
started; and an arcade v2 stage banks the same row type with its stage number as `campLevel`, so an old row cannot
even be told apart from an arcade stage. From this build each **camp** row carries
`camp: { slot: 's1'|'s2'|'one', verified, cut, startedAt }` (App `goCampComplete` / `goCampFullComplete` through
`userStats.addCampSession`'s new `meta`; arcade rows are unchanged). `cut` is counted by the round timer
(`FightFocusTimer`, kept across a restore in its carry) and the conditioning runner (`CampFitRunner`, kept in its
snapshot); `startedAt` is set when the camp session starts (`goCampSession`, kept with the paused session).
**Older clears can only earn what their rows show: one star (the clear).** A replay can earn the rest.

Where it shows (switch on): the camp path's cleared levels show their stars of 3 in place of the check (a cleared split
level drops its S1/S2 pips: both are done); the replay sheet shows the best stars and one line for the next star
("Third star: Session 2 four to eight hours after Session 1, no round cut short." · "Cleared before camp stars were
kept. Second star: every round done and verified."); the camp end screen gets the sagas' small stars row,
`LEVEL STARS · n OF 3`, landing with the star tones, on a valid session of a cleared level. The camp's ? guide has one
more step, ★ LEVEL STARS (`SCREEN_GUIDES.training_camp_stars`). The gallery's camp card and a new camp replay card use
the real components. Switch off: the check marks, the sheet's old line and the end screen as before.

**Replays of a split level run as a run does (switch on).** Before, a cleared split level's card only offered
SESSION 2 (both sessions were ticked), so a replay could never run Session 1 and the third star could never be earned.
Now its START is SESSION 1, then SESSION 2 while that replayed Session 1 waits for it (`campReplaySlot`, from the
rows). The replayed Session 1 ends on SESSION 1 COMPLETE · "S2 tonight — leave 4–8 h" (the first-time copy), not
LEVEL n CLEAR, and its stars row says "Session 2 four to eight hours from now, no round cut short: all three stars."

Plainly, for the owner: the camp already refuses to clear a level unless every round of its sessions was done and
verified (since the camp first became playable), so **every clear from now on holds at least ★★**; ★ alone marks a
clear made before this build. The title fight's "good form" is not measured anywhere (its cfg carries `formGated`,
which nothing reads), so its third star asks what is recorded: every round to the bell.

### 2. The replayed level stays whole above its sheet (f2-camp-replay)

The owner's note: "make sure the model is not cut off in the bottom". There is no fighter art on that screen; what was
cut at the bottom was the level's own node (at 430 px the "4" sat half under the sheet, at 360 px it was hidden). Now
the sheet reports its height (`ReplaySheet` `onSize`) and the path keeps the tapped level, with its stars, whole above
it (`PathMap` `reveal`: the road gets the sheet's height of room below and scrolls the node up, smoothly, at once with
reduced motion). Camp only: the sagas' replay sheets were marked "Perfect" and are unchanged. The preview checks that
the node is inside the path's box and clear of the sheet at 360, 390 and 430 (`whole`, `clear`).

### 3. The health check: once at the start, and again after a long break (changes for everyone)

The owner's note on `f3-camp-retry-parq`: "Just do once in the beginning or after a long hiatus". The PAR-Q (HEALTH
CHECK, six yes/no questions) was already asked once only (the first camp entry, or in onboarding); that photo showed it
because the preview state wipes the saved answers to show the first time. The change, small and for everyone since it
is an existing flow: the camp now also asks it again after a long break (`parq.parqDue`): when both the last training
day and the check itself are 30 or more days ago (the RUSTY line, `power.RUSTY_DAYS`; local calendar days, the week
streak's training-day rule, so award rows do not count). The re-ask says why: "Welcome back. After a long break, a
quick check before you train again." **Safety first:** an athlete whose answers flagged a yes keeps exactly what they
had: the EASY RECOMMENDED advice and the Easy default on every visit, never re-asked. The arcade and onboarding keep
their one-time check. The daily READINESS CHECK (sleep, energy, soreness, stress, mood and the danger question, before
every camp session) is a different sheet and is unchanged.

### 4. A low climb sound on the camp path (f2-camp-path)

The owner's suggestion: "add a low-end climb sound". The app's sound effects are Web Audio cues in
`data/audioEngine.js` (the bell is the only file, `public/audio/boxing-bell-signals.mp3`; the beeps, riser, star tones,
power-down and extra-life are synthesised), all following the master volume. None fits a low, soft climb (the riser is a
bright 200 to 900 Hz sawtooth), so no audio was made up. Built: the camp path now climbs when the camp opens (the road
starts at level 1 and glides up to the current level in 0.9 s, ease-out, once per open; a touch stops it; with reduced
motion, or when the health check opens first, it opens on the current level as before, with no sound), and as it starts it calls the hook
`audioEngine.playCampClimb()`, which plays `public/audio/camp-climb.mp3` once that file exists (master volume and the
sound-effects level apply; at 0 it plays nothing; the file is looked for once per visit and a missing one is never tried
again). Until the file is added it is silent.

**The sound file needed** (drop it in and it plays, no code change):
- Path: `public/audio/camp-climb.mp3`.
- Length: 0.8 to 1.0 s (the glide is 0.9 s), with the sound's peak about two thirds in and a soft tail ending by 1.0 s.
- Feel: low and soft, a rising swell rather than a melody: a low rumble or whoosh climbing about an octave (body
  around 80 to 200 Hz, a little air on top), soft attack with no click, no bell or chime. It sits under the coach
  and the bells (played at half the bell's level).
- Format: mp3, mono, 44.1 or 48 kHz, 128 kbps; peak at -3 dBFS, no silence at the start.

### Decisions (each easy to change)

- **The camp facts are recorded on every camp row from now on, for everyone** (not behind the switch), so the stars at
  launch reflect the clears made between now and then. They are extra fields on the row and change nothing anyone sees
  or earns; putting them behind the switch is one condition in `App.goCampComplete`.
- **A FULL CAMP sitting tops out at ★★** (the camp asks for four to eight hours between the sessions).
- **The replay order on a cleared split level** (Session 1, then Session 2) and the replayed Session 1's own end screen
  are behind the switch.
- **The climb glide** is new motion on a screen the owner called "Perfect": it shows the climb the sound goes with. It
  plays once per open; with reduced motion there is none.

### Checked

- `test:camp` 76 (the rule per level kind, the 4 h and 8 h edges, cut rounds, unverified and stopped sessions, FULL
  CAMP, older rows and arcade rows ignored, best run, the replay order, the lines, the path's nodes, the end screen's row
  from the real stores, the row a camp session banks, the timer's carry, the guide, the health check's first time, break,
  recent check, flagged yes, award rows and local days), `test:path` 96, `test:xp` 121, `test:nearmiss` 76,
  `test:streak` 185, `test:power` 89, `test:missions` 217, `test:levels` 183, `test:concepts` 180, `test:voice`,
  `test:spoken` 155, `voice:coverage` (0 missing: no new spoken line; the stars are tones), `check-guides`, eslint on
  every changed file, `tsc`.
- `retention-preview.mjs` at 360, 390 and 430 on port 8083: the states above fit (no overflow, no cut text), and each
  photo was looked at.

### Review fixes (2026-11-23)

- **A replayed Session 1 waits eight hours, no longer** (B1). Before, a replayed Session 1 with no Session 2 after it
  stayed "waiting" for good: every later REPLAY of that level opened Session 2, even weeks later, when Session 2 could
  only earn two stars, and a fresh run could not start until a Session 2 was done. Now `campStars.pendingSession1`
  lets it lapse once more than eight hours (`S2_GAP_MAX_MS`) have passed since it ended (8:00 still counts), so a
  replay opens Session 1 again. The same rule (`now`, default the clock) feeds `campReplaySlot` (the card's START),
  `campLevelStars().pending` (the replay sheet's "Session 1 replayed: …" line, which falls back to the third star's
  need) and the end screen's line (`pathNextUp.campSessionEndStars`). The stars themselves are unchanged (best run).
- **The level card says what a replay runs** (B5). On a replay with the path on, the card read "unlocks L5", both
  sessions ✓ COMPLETE, "level clears at ✓✓" and START SESSION 1. Now (`TrainingCampMap`, `campStars.campReplayCard`):
  the subtitle ends "· replay" (any cleared level, single and title too); a split level's tiles show the replay's own
  run (Session 1 ▶ UP NEXT and Session 2 PENDING, or Session 1 ✓ REPLAYED and Session 2 ▶ UP NEXT); and the line under
  them reads "Replay: Session 1, then Session 2 four to eight hours later, for the stars." or "Replay: Session 2 four
  to eight hours after Session 1, for the stars." (with FULL CAMP picked, in the rare case a cleared level has no
  session ticks: "Replay: both blocks back-to-back, two stars at most."). Switch off, and the current level's card:
  as before. The card now carries `data-retention="camp-card"` so the preview checks its text for cuts.
- Photos: `f2-camp-replay-start` (Session 1 next), `f2-camp-replay-s2` (Session 1 replayed two hours ago),
  `f2-camp-replay-lapsed` (Session 1 replayed on Monday: the sheet asks for the third star again, START SESSION 1), at
  360, 390 and 430; `f2-camp-replay`, `-older`, `-path`, `-end-stars`, `-end-s1`, `-next-up` re-shot. Tests: `test:camp`
  90 (the 8 h edge, weeks later, the sheet's and end screen's lines after a lapse, a new run after a lapse, the card's
  tiles and lines). No spoken line changed.

### Needs the owner's answer

1. **★★ is in effect every new clear** (the camp only clears a level when every round was done and verified). Keep the
   rule as chosen, or make ★★ "every round to the bell" and ★★★ the four-to-eight-hour gap (and the title fight's form,
   once it is measured)?
2. **Recording for everyone from now on** (above): keep, or only on the owner's phone until launch?
3. **The climb sound file** (above): make or pick one, or drop the idea (the glide stays either way, or can go too).
4. **The daily READINESS CHECK** before every camp session is unchanged. If the note on the health check meant that one
   too, say so: it holds the danger-symptom question, so the suggestion would be once a day rather than once a camp.
