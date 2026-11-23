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
