# PROMPT REVAMP-CC-4 — Cardio Mode restructure, XP plates, and live XP verdicts across Fight, Camp and Cardio

**Scope: the standalone Run screen and its setup (Cardio Mode), the
machine programme library, the chase engine, the XP verdict plates, and
the live verdicts that now ride Fight Focus, Combo Coach, Combat
Conditioning, Training Camp / Arcade stage completion and GPS runs.
Plus two small session-lifecycle changes (paused-session TTL, GPS gap
detector). Nothing else.**

Run this in the revamp app repo. It brings the revamp up to the state
that shipped to `apptrainingmode.com` at commit `3dd63cc` on
`trainingmodeco/trainingmodecode`, branch `app`.

Every path, constant and string here was verified against the working
tree of the app repo on 2026-09-30. **Read the source files below**
before writing — the revamp must match them line-close, not paraphrase.
Where this prompt and the source disagree, the source wins.

**Reference source** — read from `trainingmodeco/trainingmodecode`,
branch `app`, at commit `3dd63cc`:

| Purpose | Path |
|---|---|
| Cardio Mode setup (RUN / JOG / MACHINE / ROUNDS, effort chips, INTERVALS toggle, DISTANCE row) | `components/training-mode/CardioMode.jsx` |
| Standalone Run player (free run, chases, programmes, negative split, verdict plate) | `components/training-mode/RunPlayer.jsx` |
| Run summary (bonus settlement, chase stat) | `components/training-mode/CardioSummary.jsx` |
| Distance target popup | `components/training-mode/shared/DistanceTargetModal.jsx` |
| Machine popup (TREADMILL / BIKE / ROW → FREE RUN / INTERVAL TRAINING, SURPRISE ME) | `components/training-mode/shared/MachineChooserModal.jsx` |
| Effort bands | `components/training-mode/data/runEffort.js` |
| Chase engine (Zombie-Run style sprints) | `components/training-mode/data/chase.js` |
| Guided programme library + expander | `components/training-mode/data/intervalPrograms.js` |
| Shared XP stakes table (EASY / NORMAL / HARD) | `components/training-mode/data/xpStakes.js` |
| XP plate manifest + per-mode picker | `components/training-mode/data/xpBanners.js` |
| XP verdict plate component + flash hook | `components/training-mode/shared/XpVerdictPlate.jsx` |
| Rush verdict (strike-rate judge, blind gate) | `components/training-mode/data/rushVerdict.js` |
| Round intensity / strong finish | `components/training-mode/data/roundIntensity.js` |
| Negative split judge | `components/training-mode/data/negativeSplit.js` |
| Fight session XP settle (bonusXp) | `components/training-mode/data/fightSessionXp.js` |
| XP store (`addBonusXp`, `addRunBonus`) | `components/training-mode/data/userStats.js` |
| Synthesised cues (`playPowerDown`, `playExtraLife`) | `components/training-mode/data/audioEngine.js` |
| Fight Focus timer (rush open/close, clean rounds, strong finish, plate) | `components/training-mode/FightFocusTimer.jsx` |
| Combo Coach (same) | `components/training-mode/ComboCoachActive.jsx` |
| Combat Conditioning (clean rounds) | `components/training-mode/CombatConditioningActive.jsx`, `CombatConditioningComplete.jsx` |
| Fight summary (verdict lines, rush log) | `components/training-mode/SessionSummary.jsx` |
| Host wiring (bonusXp into settle, camp stage stakes) | `components/training-mode/App.jsx` (`goSummary`, `goComboEnd`, `goCampComplete`, `goCombatCondComplete`) |
| Camp / Arcade complete screen (StagePlate) | `components/training-mode/ScreenRouter.jsx` |
| Home "Continue" card wording | `components/training-mode/data/lastSession.js` |
| Free-run coach lines | `components/training-mode/data/runCoach.js` (`buildRunIntro` freeRun branch, `freeRunSplitScript`) |
| Paused-session TTL | `components/training-mode/App.jsx` (`PAUSED_SESSION_MAX_AGE_MS`) |
| GPS gap detector (data only, whispered footnote) | `RunPlayer.jsx`, `CardioProtocolPlayer.jsx`, `CardioSummary.jsx` |
| Plate art (six WebP, 640 px, alpha) | `public/static/xp/gain-crown.webp`, `gain-blaze.webp`, `gain-iron.webp`, `fail-blaze.webp`, `fail-gloves.webp`, `fail-reaper.webp` |
| Tests | `scripts/test-run-intervals.mjs` (495), `scripts/test-xp-verdicts.mjs` (51) |

**Ledger of commits this prompt combines** (oldest first):

| Commit | Summary |
|---|---|
| `b62b031` | Runs and cardio: screen stays awake, GPS lock before START, pocket mode, weak-signal tolerance |
| `a3c853d` | Paused sessions: 24-hour TTL drops to 90 minutes, and the prune runs live |
| `368fb64` | GPS runs: record off-screen gaps in the run record, whisper them on the summary |
| `68e057a` | Cardio Mode: RUN / JOG / MACHINE with free runs, sprint chases and guided machine programmes |
| `970ba38` | Machine popup: SURPRISE ME, a hand of four programmes, SELECT MORE for the rest |
| `eb2f735` | Chase caught: power-down sting |
| `296c87f` | Chase escaped: Genesis-style extra-life fanfare |
| `e7ed890` | Chases: tiered XP with a small loss when caught, and a verdict popup |
| `9fa614d` | Chase verdict on pixel-art XP plates |
| `092bffb` | XP plates: smaller, dead centre, 2.5 s, picked per mode and tier |
| `e676b51` | Live XP verdicts: rushes, clean rounds, stage stakes, negative splits |
| `df94bc6` | Strong finish verdict, and a rush log on the summary |
| `3dd63cc` | Rush verdicts go win-only (plus a private diagnostics screen that is **not** ported, see §9) |

Copy the six plate images byte-for-byte; do not regenerate them.

---

## 0. What we are trying to do

Three things landed on the app since CC-3, and the revamp must carry all
three:

1. **Cardio Mode was rebuilt around how athletes actually run.** WALK is
   gone. The method row is RUN · JOG · MACHINE · ROUNDS. Every run is a
   free run by default with an optional distance target in a popup. An
   INTERVALS toggle turns on Zombie-Run style sprint chases. MACHINE opens
   a centred popup that picks treadmill / bike / row, then FREE RUN or a
   guided INTERVAL TRAINING programme the announcer calls.
2. **Every live verdict lands on a pixel-art XP plate.** XP GAINED and
   XP FAILED banners pop dead centre for 2.5 s with the amount set inside
   the plate's empty panel. One stakes table for all of them: a win pays
   more than a loss costs, HARD raises both.
3. **Fight Mode, Camp and Cardio now hand out live verdicts** that are
   actually tracked: rush held or dropped (accelerometer strike rate),
   clean rounds (no pause), stage cleared or stopped short, negative
   splits, and a strong finish. **Nobody ever loses XP because the phone
   could not see them** — that gate is the most important rule in this
   prompt.

---

## 1. Session lifecycle (small, do first)

### 1.1 Paused-session TTL is 90 minutes

`App.jsx`: `PAUSED_SESSION_MAX_AGE_MS = 90 * 60 * 1000`. A live prune
effect runs on `visibilitychange` and on a 60 s interval, so a paused
session older than 90 minutes is dropped without waiting for a reload.

### 1.2 GPS gap detector — data only, whispered

`RunPlayer.jsx` and `CardioProtocolPlayer.jsx` record every stretch the
page was hidden during a live run into the run record as `gaps` (array
of `{ fromSec, toSec }`) and `totalGapMs`. The summary shows one footnote
only when `totalGapMs > 0`: `off-screen Ns` at 7 px in `#6b6483`. No
banner, no warning, no colour. The athlete is not to be confused by it.

### 1.3 Run polish from `b62b031` (already in the revamp if CC-3 was fully applied; verify)

Screen Wake Lock while running, GPS lock required before START (`data/gpsLock.js`), POCKET mode
toggle (`shared/PocketMode.jsx`), weak-signal tolerance in `evaluateFix`.

---

## 2. Cardio Mode setup

### 2.1 Method row

Four tiles in one row: **RUN · JOG · MACHINE · ROUNDS**. `data-guide="cm-method"`.
The guide copy for `cm-method` reads "RUN / JOG / MACHINE / ROUNDS" (`shared/screenGuides.js`).
Fit hub row copy: "Run · Jog · Machine · GPS" (`FitModeHub.jsx`).

State: `effortMode` (`'run' | 'jog'`; a legacy `walkMode` snapshot maps to
`'jog'`), `effortTier` (`'easy' | 'normal' | 'hard'`), `chaseMode`,
`machineMode` (`'free' | 'interval'`), `programId`, `goalDistance`
(default **null** = free run), `distanceOpen`, `machineOpen`.

### 2.2 Effort bands (`data/runEffort.js`)

```
EFFORT_MPH = { jog: { easy: 3.0, normal: 4.0, hard: 5.0 },
               run: { easy: 6.0, normal: 7.0, hard: 8.0 },
               sprint: { easy: 9.0, normal: 10.0, hard: 11.5 } }
effortSpeed(mode, tier, unit)   // mph or kph
effortPaceSec(mode, tier, unit) // 3600 / speed
kindSpeed(kind, tier, unit)     // warm/cool → jog easy; easy/recover → jog[tier]; hard → run[tier]; sprint → sprint[tier]
```

Under the tiles: three chips EASY / NORMAL / HARD, each showing its mph
(or kph) for the selected mode. The chosen band sets `targetPaceSec`,
which the coach reads out on splits.

### 2.3 INTERVALS toggle (outdoor only)

One row under the chips: ⚡ **INTERVALS** — "Random sprint chases.
Escape for +{win} XP, caught costs {loss}." with the tier's stakes
(`chaseXp(effortTier)`). A switch on the right.

### 2.4 DISTANCE row → centred popup

Row: `DISTANCE   5 mi   [CLEAR]  ›` (or `FREE RUN` when null),
`data-guide="cm-goal"`. Tap opens `DistanceTargetModal` (portal, centred):
slider mi 0.5–15 step 0.5 (km 1–24), quick chips, mi/km toggle, custom
input, CTA `✓ SET N MI`, secondary `CLEAR · FREE RUN` / `KEEP IT FREE`.
`goalDistance = null` means free run: no ghost, no target time, the run
ends when the athlete ends it.

### 2.5 MACHINE tile → centred two-step popup (`MachineChooserModal`)

Step 1 "WHAT ARE YOU ON?": TREADMILL / BIKE / ROW cards (+ a muted
"ELLIPTICAL · STAIRS · MORE ›" link that hands off to the existing
equipment picker). Step 2 (title = machine): FREE RUN | INTERVAL TRAINING.

Under INTERVAL TRAINING:

- **SURPRISE ME** card (🎲, "Random programme. Just start.") — picks a
  random programme and applies immediately.
- "OR PICK ONE" — a **hand of four** programmes, shuffled each time the
  popup opens (`dealHand`); the currently chosen programme always keeps
  its seat.
- "SELECT MORE · N OTHERS ›" expands to the full list ("ALL PROGRAMMES").
- Each card: label, tag (FIGHTER / CLASSIC / PROGRAMME), minutes, blurb.
- CTA `✓ USE THIS` → `onApply({ machine, mode, programId })`.

On the setup screen the machine row summarises: `TREADMILL · INTERVALS`
/ `TREADMILL · FREE RUN`, subtitle `FIGHT ROUNDS 3×1 · 28 min ·
announcer-led`, a `RUN ⇄` / `JOG ⇄` mini toggle, and `›` reopens the popup.
Title and subtitle are single-line with ellipsis.

### 2.6 Programme library (`data/intervalPrograms.js`)

Ten programmes, ids: `fight-3x1`, `fight-5x1`, `tabata`, `thirty-thirty`,
`ladder`, `norwegian-4x4`, `hiit-25`, `hill-sprint-30`, `rise-shine-20`,
`sprint-recover`. `programsFor(machine)`: bike and row lead with
`sprint-recover` and drop `hill-sprint-30`. `expandProgram(program,
{ machine, tier, unit })` returns segments with `startSec / endSec / speed
/ incline / label / target / pre / start`. Treadmill segments are numeric
("Set 7.0"); bike/row use effort words. The announcer speaks `pre` five
seconds before each change with a beep; sprints get a 3-beep countdown;
the athlete moves the belt manually. The player HUD shows a segment card
with SET / LEFT chips and a timeline bar. Treadmill preset on the setup
screen defaults to `machineMode 'interval'`, `programId 'rise-shine-20'`.

### 2.7 Player and summary wording

Header: programme label or `FREE RUN`. Chips: SET / LEFT (programme) or
TARGET PACE with `RUN · NORMAL` sub (free run). Done card headings:
`PROGRAMME COMPLETE` / `RUN COMPLETE`. Stats: `VS TARGET PACE` on free
runs, `CHASES a/b`. Continue card (`lastSession.js`): "Jog"/"Cardio",
programme id as label, "Free run", "· Intervals", `diff` = tier.

---

## 3. Chase engine (`data/chase.js`)

```
CHASE_FIRST_MIN/MAX_SEC 240/360   first call 4–6 min in
CHASE_GAP_MIN/MAX_SEC   180/360   then every 3–6 min
CHASE_WINDOW_MIN/MAX_SEC 40/60    sprint window
CHASE_THRESHOLD 0.15              ≥ 15% faster than the rolling 60 s pace
CHASE_BASELINE_WINDOW_SEC 60
CHASE_TAIL_GUARD_SEC 120          none in the last 2 min of a targeted run
CHASE_MIN_WINDOW_METERS 20
CHASE_LEAD_IN_SEC 5               "Sprint in five"
CHASE_XP_BY_TIER = XP_STAKES_BY_TIER (see §4); chaseXp(tier) = stakesFor(tier)
chaseSummary(state, tier) → { passes, fails, attempts, won, lost, xp: won − lost, tier }
```

Beeps: slow every 10 s, fast in the last 5 s. Pass → `playExtraLife()`,
coach "Escaped. {win} X P banked. Ease back." Fail → `playPowerDown()`,
"Caught. {loss} X P gone. Next one's yours. Ease back." Then the plate
(§5). Chase XP is **net** (wins minus losses) and settles once on the
summary save through `addRunBonus`.

---

## 4. Shared XP stakes (`data/xpStakes.js`)

```
XP_STAKES_BY_TIER = { easy: { win: 8, loss: 3 }, normal: { win: 10, loss: 5 }, hard: { win: 15, loss: 8 } }
tierKey(tier)   // 'Easy'/'Normal'/'Hard' → lower; 'Advanced'/'savage'/'elite'/'pro' → hard; unknown → normal
stakesFor(tier)
CLEAN_ROUND_XP = 5;  cleanRoundXp(n) = n × 5
NEGATIVE_SPLIT_XP = 10
```

`userStats.addBonusXp(delta)` applies a signed delta, no session row,
total never below zero, returns the delta actually applied.
`addRunBonus` is an alias.

`fightSessionXp.settleFightXp({ …, bonusXp })` adds the bonus to the
outcome-engine number **unless** `integrityResult.awardXp === false` or
the outcome is `validation_failed`; result is floored at 0 and returns
`bonusXp` alongside `xp`. App and SessionSummary both call it with the
same `bonusXp`, so the number shown is the number banked.

---

## 5. XP verdict plates

### 5.1 Art and manifest (`data/xpBanners.js`)

Six plates, each with the panel geometry the amount sits in:

```
gain: crown { cy: 0.845, w: 0.58 } · blaze { cy: 0.865, w: 0.66 } · iron { cy: 0.848, w: 0.60 }
loss: blaze { cy: 0.868, w: 0.62 } · gloves { cy: 0.800, w: 0.56 } · reaper { cy: 0.840, w: 0.60 }
```

`pickXpBanner(kind, { mode, tier, camp })`:

- gain · fight → **crown**; fit / cardio → **iron**; anything else → blaze
- loss · fight → **gloves**; fit / cardio → **blaze**; `camp: true` or
  tier HARD → **reaper**

`preloadXpBanners()` warms all six (called when INTERVALS is on, on any
GPS run, and on mount of both fight timers).

### 5.2 Component (`shared/XpVerdictPlate.jsx`)

`useVerdictFlash(ms = 2500)` → `[flash, fire]`; `fire({ pass, xp, banner })`
shows the plate and clears it after 2.5 s. `<XpVerdictPlate flash={flash} />`
renders `position: fixed; inset: 0; z-index 60; pointer-events none;`
centred; plate width `min(56vw, 230px)`; pop-in keyframe `tm-xp-pop`
(0.55 → 1 scale, 0.38 s, overshoot); image via `SafeImage` with
`loading="eager"`; amount text Orbitron 900 `clamp(15px, 5vw, 21px)`,
gold `#ffd84a` on gains with a warm shadow, red `#ff3b3b` on losses;
text is `+N XP` / `−N XP` (U+2212 minus).

### 5.3 Sounds (`data/audioEngine.js`)

- `playPowerDown()` — sawtooth glide 900 → 45 Hz over 0.55 s through a
  lowpass closing 2600 → 420 Hz, a sine thud 55 → 30 Hz, a 60 ms noise
  snap. Ducks app audio 800 ms. Used for every loss verdict.
- `playExtraLife()` — square + sine-octave run B4 D5 E5 F#5 B5 A5 F#5 A5
  at 90 ms, then a held B5 D6 F#6 chord, through a two-tap 120 ms echo.
  Ducks 1600 ms. Used for every win verdict.

`playGhostCaught` and `playRingChime` are gone.

---

## 6. Live verdicts

### 6.1 Rush verdict (`data/rushVerdict.js`) — Combo Coach, Fight Focus, camp and arcade blocks

Constants: `RUSH_PASS_FACTOR 1.2`, `RUSH_FAIL_FACTOR 0.85`,
`RUSH_MIN_BASELINE_SEC 15`, `RUSH_MIN_BASELINE_RATE 0.4` (strikes/s =
24/min), `RUSH_MIN_WINDOW_SEC 5`, `RUSH_MIN_STRIKES 4`.

Bookkeeping in each timer (refs, reset at every round start):
`baseSecRef` / `baseStrikesRef` accumulate non-rush seconds and
accelerometer strikes this round on the 1 s tick; `rushWinRef =
{ startCount, startSec }` is set when a rush opens; `closeRush(elapsedNow)`
is called when the rush closes naturally, at the bell (`roundSec`) and on
FINISH (`roundSec − remaining`).

`judgeRush({ motionSeen, baselineStrikes, baselineSec, rushStrikes, rushSec })`:

- **blind** if `!motionSeen`, `baselineSec < 15`, `baselineRate < 0.4`,
  or `rushSec < 5` → no XP, no popup, no sound. **This is the rule that
  protects a phone on the floor or on the bag frame.**
- **pass** if `rushRate / baselineRate ≥ 1.2` and `rushStrikes ≥ 4`.
- **fail** if the ratio `< 0.85`.
- **hold** otherwise (no XP).

`tallyRush(tally, judged, tier, { round })` returns the signed delta and
records `{ round, verdict, baselineRate, rushRate, ratio, xp }`.
`rushSummary(tally, tier)` → `{ passes, fails, held, blind, attempts, won,
lost, xp, stakes, results }`.

**Rush verdicts are WIN-ONLY.** A `fail` is still counted and logged,
but `tallyRush` returns `0` for it, `rushSummary.lost` is always `0`, and
nothing plays, shows or is spoken. Reason: most athletes put the phone on
the floor or the bag frame, and a detector that undercounts a continuous
flurry could read the hardest rush as a slow one. Losses stay off until a
sensor is proven in the gym.

On pass: `playExtraLife()`, crown plate, coach "Rush held. Plus {xp} X P."
On fail: nothing.

### 6.2 Clean rounds — Fight Focus, Combo Coach, Combat Conditioning

`pausesThisRoundRef` counts every pause while in a round (manual and
the auto-pause on background — the round stopped either way). At each
completed round with zero pauses, `cleanRoundsRef++`; coach "Clean round.
Plus five." (priority 1, `dropIfBusy`, not on the final round). Combat
Conditioning folds it into its round line: "Round N complete. Clean round.
Plus five. Prepare for Round N+1." Pays `cleanRoundXp(n)`.

### 6.3 Strong finish (`data/roundIntensity.js`) — Fight Focus, Combo Coach

`INTENSITY_FACTOR 1.15`, `INTENSITY_MIN_ROUNDS 3`, `INTENSITY_BASELINE_ROUNDS 2`,
`INTENSITY_MIN_RATE 0.4`. Per-round strike counts are pushed in
`closeRound`. At the final bell: baseline = mean of rounds 1–2; blind if
no motion, fewer than 3 rounds, or baseline rate `< 0.4/s`; pass if
final ≥ 1.15 × baseline → tier win, crown plate, `playExtraLife()`.
Otherwise **hold, never a loss**.

### 6.4 Session stats and settlement

Both timers return `{ thrown, motionUsed, rush, cleanRounds, cleanRoundXp,
strongFinish }`. `App.goSummary` / `goComboEnd`:
`bonusXp = rush.xp + cleanRoundXp + strongFinish.xp` → `settleFightXp`.
`SessionSummary` recomputes with the same `bonusXp` and shows, above the
round recap: `⚡ RUSH a/b · +N XP`, `⚡ RUSH · PHONE COULD NOT SEE YOU`
(all blind), `✓ CLEAN ROUNDS a/b · +N XP`, `🔥 STRONG FINISH · +N XP ·
62→78/MIN` (or a muted `FINISH 62→58/MIN` on a hold), then the **rush
log**: one line per rush, `R2 · 60 → 96 strikes/min · HELD +10` /
`slowed · no loss` / `held steady` / `phone could not see you`, capped at 4.

### 6.5 Camp / Arcade stage stakes (`App.goCampComplete`, `ScreenRouter`)

`goCampComplete(rounds, c, completed, integrityResult, fightSessionStats)`.
`stagePlate(cleared, awarded, done, total, diff, earned)`:

- not awarded (integrity refused) → nothing moves, no plate
- rush + clean + strong-finish XP from the block → `addBonusXp`
- cleared (or a split-level session valid) → crown plate with the total
- stopped short (`done < total`) → `addBonusXp(−stakesFor(diff).loss)`,
  reaper plate (`camp: true`)

`campResult.plate` is rendered by `StagePlate` on the complete screen
(fires once on mount) for both the camp and the arcade branches.

### 6.6 Negative split (`data/negativeSplit.js`) — GPS runs only

`NEGATIVE_SPLIT_MIN_MI 2`, `NEGATIVE_SPLIT_MIN_KM 3`, `NEGATIVE_SPLIT_MARGIN 0.01`.
`judgeNegativeSplit({ trace, totalDistance, totalSec, unit, gps })`
interpolates the time at half distance from the run trace
(`{ t, d }` points). Eligible only when `gps` and distance ≥ the minimum
and the trace has ≥ 4 points. Pass when second half ≤ 99% of the first →
`+10`, iron plate at the finish, result gets `bonuses: [{ id:
'negative-split', label: 'NEGATIVE SPLIT', xp: 10 }]` and
`negativeSplit: { pass, firstHalfSec, secondHalfSec }`. Done card line:
`⚡ +10 XP NEGATIVE SPLIT · 10:00 → 9:00`. `CardioSummary` banks
`chase.xp + Σ bonuses` in one `addRunBonus`.

### 6.7 Combat Conditioning complete

`CombatConditioningComplete` adds `cleanRoundXp` to the shown number
(unless the gate refused) and a stat `CLEAN RDS  n · +N`.
`App.goCombatCondComplete` banks it with `addBonusXp`.

---

## 7. Tests

Port both suites verbatim and wire them into the check chain:

- `scripts/test-run-intervals.mjs` — 495 checks (effort bands, chase
  scheduling and judging, programme library, tier aliases).
- `scripts/test-xp-verdicts.mjs` — 51 checks (stakes, rush verdicts
  incl. every blind case and win-only tally, negative splits, round
  intensity, plate picks, mic detector).
- `scripts/test-run-intervals.mjs` checks count: 495.

`package.json`: `"test:intervals"`, `"test:xp"` (both with
`--import ./scripts/extensionless-loader-register.mjs`), added to
`check:all`. `scripts/test-indoor-tracking.mjs` seeds `Math.random`
(mulberry32, seed `0x9e3779b9`) so it is deterministic.

---

## 8. Acceptance — walk every one

1. Cardio Mode shows RUN · JOG · MACHINE · ROUNDS in one row; no WALK.
2. Default run is a free run: DISTANCE row reads FREE RUN, no ghost strip,
   TARGET PACE chip shows the band (e.g. 8:34 /mi · RUN · NORMAL).
3. DISTANCE popup is centred; SET 5 MI writes 5 mi; CLEAR returns to free run.
4. INTERVALS on: intro says the stakes; first chase between 4 and 6 min;
   window 40–60 s with beeps; escape = fanfare + crown/iron plate + net XP;
   caught = power-down + plate; both spoken.
5. MACHINE popup is centred, two steps; SURPRISE ME applies a random
   programme in one tap; four-card hand reshuffles per open; SELECT MORE
   shows all ten.
6. Treadmill programme: announcer calls the next belt speed 5 s ahead,
   segment card with SET / LEFT, athlete moves the belt.
7. Plate: 230 px, dead centre, gone after 2.5 s, amount inside the panel.
8. Fight Focus with Rush Mode and the phone in the pocket: a rush that
   speeds up pops the crown and speaks "+10"; a rush that slows shows
   nothing and costs nothing; the summary rush log shows the before/after
   strikes per minute for both.
9. Fight Focus with the phone on a table: every rush reads "phone could
   not see you"; **XP never goes down.**
10. Pausing mid-round forfeits that round's +5; an unpaused round says
    "Clean round. Plus five."
11. Camp stage stopped short: reaper plate, −5 at NORMAL; cleared: crown.
12. A 2+ mi GPS run with a faster second half pops the iron plate at the
    finish and lists NEGATIVE SPLIT on the done card and summary.
13. A session the integrity gate refuses banks nothing, plates nothing.
14. Paused session older than 90 minutes is gone on the next visibility change.
15. `check:all` green, including both new suites.

---

## 9. Do NOT port

- `components/training-mode/StrikeLab.jsx`, `data/strikeLab.js`, and the
  `consumeLabCode` effect in `App.jsx` plus the `strike_lab` route in
  `ScreenRouter.jsx`. This is the owner's private diagnostics screen. It
  stays in the app repo only.
- `data/micStrikeDetector.js` is test-only and not wired into any session.
  Port it only if you want its tests to run; do not use it anywhere yet.

