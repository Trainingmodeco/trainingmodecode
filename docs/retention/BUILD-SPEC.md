# Retention features 1 to 3: build spec (2026-11-22)

The owner approved building **1. weekly streak + daily mission + freezes, 2. the path + stars, 3. near-miss retry**
now, each behind a switch that is on only on the owner's phone until the App Store launch. Read first:
`RETENTION-PLAN.md` (the owner's decisions and the visual rule), the brief `PROMPT-RETENTION-1.md`
(`git show origin/claude/console-handoff-2026-11-17-retention:PROMPT-RETENTION-1.md`), the approved looks in
`components/training-mode/retention/look*.jsx`, and the code maps in `.loop-factory/retention/map-{streak,path,retry}.json`
(file:line for every hook; trust the source over the map where they disagree).

## Rules for all three

- **Switches.** New `components/training-mode/data/retentionFlags.js`:
  `const FOR_EVERYONE = { weeks: false, path: false, nearMiss: false }` and
  `export const retentionOn = (key) => !!FOR_EVERYONE[key] || isOwnerPreview()` (isOwnerPreview from data/concepts).
  Read once per mount (useState initialiser), never in a render body (the qmV2.js rule).
- **Switch off means no change at all**: same screens, same storage writes, same XP. The existing smoke and unit
  tests must pass untouched.
- **Only finished, valid sessions move anything.** No XP for opening the app; no lives, energy, ads or paid skips.
  Rest days never punish. Plain, true copy; no guilt; app names only (the franchise guard test must pass).
- **Visual rule (the owner's, very important):** every new or changed screen must fit a phone at 360, 390 and
  430 px wide: no text, frame or design cut off, nothing squeezed or crowded. When in doubt, take something out.
  Use the app's own tokens (Styles.js, ArcadeUI, the home palette in HomeDashboard.jsx) and the looks.
- **Shared UI.** Put the real components in `components/training-mode/retention/ui/` and make the gallery looks
  (`retention/look*.jsx`) render those same components with sample data, so the gallery shows what ships.
- **Storage.** Every new localStorage key goes into `data/cloudSync.js` SYNC_KEYS. Prefer state that is a pure
  function of the session rows (recomputed each time) over incremental state, so syncs, offline finishes and clock
  changes cannot corrupt it; store only "moment already shown" markers.
- **Tests.** Pure logic gets a node test script in `scripts/` (run with
  `--import ./scripts/extensionless-loader-register.mjs`, like test-xp-verdicts.mjs), added to package.json and to
  `check:all`. Run the related existing suites (test:xp, test:missions, test:concepts, test:ayp, test:maxout as they
  apply), `npx eslint` on changed files and `npx tsc --noEmit`.
- **Preview script.** `scripts/retention-preview.mjs` (Playwright, the pre-installed browser) seeds sample data in
  localStorage (owner preview on: `tm_owner_preview` = '1'), opens each new screen state on the web dev server and
  saves screenshots at 360x780, 390x844 and 430x932 into a folder given on the command line, and fails if any
  element overflows the viewport or any text is clipped (scrollWidth > clientWidth on a text box, or an element
  outside its scroll container). Feature 1 creates it; features 2 and 3 add their states.
  Dev server: `CI=1 EXPO_NO_TELEMETRY=1 npx expo start --web --port 8081` (CI mode does not reload: restart it after edits).
- **Commit** each feature on the current branch when its tests pass, ending the message with:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and
  `Claude-Session: https://claude.ai/code/session_01E9hsm62i37ZoXrUH33ZSFM`. Do not push.
- **Notes.** Append what you built, what you decided and what needs the owner's answer to `docs/retention/BUILD-NOTES.md`.

## 1. Weekly streak + daily mission + freezes (switch `weeks`)

- **Module** `data/weekStreak.js`, pure: `computeWeekStreak(rows, settings, now)` returns
  `{ streak, freezes, thisWeek: { days: [7 x 'done'|'rest'|'today'|'future'], done, target }, events }`.
  A training day is the LOCAL date of a row that is a real finished session: leave out bonus/award rows
  (tiers.sessionMode === 'bonus') and rows with no work done (a 0-round END, validation_failed; check the row fields).
  Weeks run Monday to Sunday in local time. Replay from the first training week every time.
- **Streak** = consecutive past weeks that reached the target, plus the current week once it reaches it. The current
  week never counts as missed until it ends. A past week under target spends a freeze if one is held, else the
  streak goes to 0.
- **Freezes**: everyone starts with 1; +1 for every 4 consecutive weeks on target (a week covered by a freeze keeps
  the run but adds nothing); hold at most 2. Earned by training only, never bought.
- **Weekly target**: one setting only. Reuse the Game Plan card in Profile.jsx ("Days per week",
  tm_game_plan_v1): with the switch on it offers 2 to 6, reads "Training days a week. Keeps your streak; rest days
  never break it.", and a user who never chose gets 4. A change applies from next Monday (keep the previous value
  for the current week).
- **Home** (switch on): the WeekChip from the look replaces the 🔥/🛡 combo chip. It must fit the header at 360 px
  next to the level bar and help button: make a compact variant if needed. Move syncCombo-style side effects out of
  the render body. Freeze-used and freeze-earned notices go through the existing one-at-a-time nudge slot.
- **Daily mission** (switch on; the old dailyMission* code stays as it is for switch off): one mission per local day,
  dealt from the date (stable all day): a 3-minute session that fits the athlete (one Fight Focus round for a
  fight-leaning athlete, a short Quick Mission for a fit-leaning one; read what the app knows of their level and
  yesterday's sessions). A DAILY MISSION card at the top of Home: title, one line, 3 MIN, XP, one-tap START; done
  state after. It is done when a valid finished session started from the card on that day ends; pay the existing
  daily mission bonus once (do not invent a new amount). State in a new key (e.g. tm_daily_mission_v2) in SYNC_KEYS.
- **Moments after a session** (switch on): on the shared end screen (MissionComplete YOUR PROGRESS area) a compact
  strip "TRAINING DAY 3 OF 4 · STREAK KEPT" with the week chip's new dot popping in; "WEEK COMPLETE · 4 OF 4 ·
  10-WEEK STREAK" when the target is reached; a "FREEZE EARNED" line when one was earned. Keep the end screen calm:
  one strip, not a full-screen takeover.
- **Tests**: week boundaries, Sunday/Monday edges, time zones (a row near midnight UTC in a non-UTC zone), target
  changes, freeze use and earn, max 2, carry-over (an existing athlete's history gives a sensible week streak),
  a row synced in late, bonus rows ignored, 0-work rows ignored.

## 2. The path + stars (switch `path`)

- **PathMap** component (`retention/ui/`), from the look's PathView: winding road of nodes (cleared with stars,
  current pulsing with START, locked, boss), opens scrolled to the current node, node positions computed from the
  real container width (never a fixed 360), large tap targets.
- **Arcade sagas** (ArcadeSeriesDetail.jsx): switch on, the path replaces the StageLadder list, but a tap goes
  through the SAME selection and launch handlers (stage pop-up, path and difficulty choice, access gates), so every
  start rule stays. Stars come from what is stored today, with the maximum per saga type: the classic saga 3
  (time tiers); multi-path v2 sagas one star per path available (say so in the sheet); single-path v2 1; concept
  sagas by arcs; a saga with no tiers shows a check mark, no stars. Do not change how stars are computed or stored.
- **Training Camp** (TrainingCampMap.jsx): switch on, the same PathMap for the 12 levels (S1/S2 pips under split
  levels, level 12 as the boss). Camp has no star rule, so cleared levels show a check mark; write a proposed camp
  star rule in BUILD-NOTES for the owner, do not build it. A tap on the current level runs the existing
  open/readiness/gear flow.
- **Replay sheet** on a cleared node: best stars, best time where stored, what the next star needs where a rule
  exists, REPLAY (through the existing start flow) and CLOSE.
- **Home NEXT UP row** (switch on): from loadLastSession(): the saga's current node or the camp's current level;
  a tap opens that saga or camp on its current node. Hidden when there is no last session or it is all cleared.
- **Stars landing**: StageClearedScreen (classic saga) lands its stars one by one; the arcade v2 and concept-stage
  end screens (MissionComplete branch in ScreenRouter) get a small stars row that lands the same way when the stage
  has stars. Nothing else added there.

## 3. Near-miss retry (switch `nearMiss`)

- **Pure** `nearMiss(...)` (new `data/nearMiss.js`) from the real counts each end screen has (rounds, exercises,
  drills, tasks, the classic saga's time against its star tiers): returns the plain-words gap ("1 round to go",
  "2 drills short", "12 s off ★★★"), a bar value and max. Never invent a number the screen does not have.
- **Retry safety** `data/retrySafety.js`, `canRetryNow({ boss, maxEffort, attemptsToday, sessionsToday })`: no
  RETRY after a boss, final stage, title fight or MAX OUT; none after 2 attempts at the same stage or session today;
  none after 3 finished sessions today. The app saves no recovery data, so this is the rule until the owner
  approves another (note it in BUILD-NOTES).
- **NearMissPanel** (`retention/ui/`): the gap line and bar; RETRY and COME BACK FRESH TOMORROW as two equal
  buttons; when a retry is not safe, the line says when to come back and the buttons are REMIND ME TOMORROW (only if
  reminders exist to hook into, else leave it out) and DONE FOR TODAY. Shown when the verdict is partial or fail on:
  every MissionComplete-based end screen (Fight Focus, Combo, concept stages, Quick Mission, Combat Conditioning,
  Fit, camp and arcade v2), and the overlay's partial and failed screens; on StageClearedScreen when stars are
  under the maximum ("GO FOR THE THIRD STAR").
- **Retry routes**: Fight Focus/Just Train/concept: actions.goTimer(session.cfg); Combo: goComboActive(cfg);
  Quick Mission: goQuickMissionActive(qmCfg) (never for MAX OUT); arcade v2: re-run the same series/stage/mode/
  settings; camp: back to the camp map on that level (keeps readiness and gear checks); classic saga: its RETRY.
  COME BACK FRESH TOMORROW and DONE FOR TODAY go home. Retries use the existing XP rules.
- **Bug to fix first** (map-retry risks): the classic ArcadeSessionPlayer normal clear puts no
  completedTasks/totalTasks on its result, so the overlay's verdict can come out wrong. Prove it with a test, fix it
  like ArcadeBenchmarkPlayer does.
