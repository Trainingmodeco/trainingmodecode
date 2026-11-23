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
