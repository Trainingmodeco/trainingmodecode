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

### Proposed camp star rule (not built)

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
(one doc per screen state, `{ text }`, plus `general`). Read them with ArtifactData before acting on any decision.
Final check on 49b1e182: unit suites pass, build:web passes, smoke:web 147 of 147.
