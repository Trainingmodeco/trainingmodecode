# PROMPT REVAMP-CC-7 — Six concept drops a year, the concept engine, the Arcade gate, and hub layout

**Scope: everything on `trainingmodeco/trainingmodecode`, branch `app`, from
`bdaad1c` (CC-6) up to `91adcce`. Run CC-5 and CC-6 first.**
Read the source files before writing — match them line-close. Where this
prompt and the source disagree, the source wins. Sections 1–3 are the first
commit; sections 4–12 were added commit by commit and **override earlier
sections where they say so** (e.g. §9 replaces §8's Arcade rule).

## Summary — what the revamp gets

**The year of drops** (`CONCEPT_SCHEDULE`, dates inclusive, local time):

| Drop | Window | Fit | Fight | Super | Replaces saga |
|---|---|---|---|---|---|
| Shoto | 2026-10-23 → 11-30 | 4/wk × 4 | Kickboxing 4/wk × 2 | Rising Dragon / Dragon Storm / Demon Barrage | — |
| Ultra Ego | 2026-12-01 → 2027-01-31 | 4/wk × 4 | Muay Thai 5/wk × 4 | — | The Destroyer |
| Flow State | 2027-02-01 → 03-31 | 5/wk × 4 | Kickboxing 4/wk × 3 | Silver Flow | Flow State |
| One Hundred | 2027-04-01 → 05-31 | 4/wk × 4 (incl. THE 10K run) | Boxing 4/wk × 2 | Limit Breaker | One Hundred (old One Punch) |
| Warrior Queen | 2027-06-01 → 07-31 | 4/wk × 4 | Kickboxing 4/wk × 2 | Bracer Storm | — |
| Night Vigilante | 2027-08-01 → 09-30 | 6/wk × 4 (incl. THE LONG NIGHT run) | MMA 4/wk × 4 | Nightfall | The Vigilante |

Every drop: FIT · FIGHT · a 10-stage Arcade gauntlet on three paths
(FIT / FIGHT / BOTH), tiers ROOKIE / NORMAL / ELITE, GYM / BODYWEIGHT.

**Engine (`data/concepts/index.js`)**
1. Tier alternates per Fit row (`row.easy` / `row.hard`, used as written) and
   home versions (`row.home`) — §2.
2. Rookie fight format (`fight.easy`), `easyCombos`, `super.easy`, multi rounds
   and multi stages, tier-aware arcade stations (`easyItems`) — §2.
3. Run days (Cardio Mode, counted from the run log), skill ladders (two hits →
   next rung), circuits chained in the Fit player — §4.
4. Arcade gate: opens after week 1 of Fit or Fight; one more workout per stage;
   boss needs a full program — §9.
5. Old sagas retire when their drop goes live, except Pro and anyone with
   progress (`retiredSagaIds`, includes The Destroyer on Dec 1) — §5.
6. Franchise-name guard over every drop's user text (`test-concepts`) — §4, §6.

**Screens**
- Concept page = the hubs: `ModeTabs` with session counts, the discipline row,
  an ARCADE row (locked → "Stage N in X workouts"), short fight-day rows — §8, §9.
- Fit hub: shorter Today's Mission card, compact START, one even gap — §10.
- Arcade carousel: drop cards first, `lockNote`, workout-gated ladder — §5, §9.

**Art** — `public/static/concepts/<id>/{poster,wide,card}.webp` for all six,
silhouette banners in `public/static/series/posters/` (incl. new
`night-vigilante`, `warrior-queen`, `struggler-protocol`, `blue-blur` =
Speed Demon). Run `npm run lock:assets` after copying.

**Tests** — `test-concepts` 169 checks; `smoke-web` drives a concept gauntlet
stage (seeding a finished week first).

**Acceptance (whole prompt)**
1. `npm run check:all` passes.
2. With the device clock at Jun 5 2027 (regular user): Warrior Queen pops up,
   leads the Arcade, its page opens on the tab of the hub you came from, ARCADE
   is locked until 4 workouts, then opens one stage per workout.
3. Owner preview (Strike Lab code) opens any drop early, tagged
   PREVIEW · NOT RELEASED.

---

## Reference files (first commit)

| Purpose | Path |
|---|---|
| The drop: Fit (5 days + long-run day), Fight (MMA, 4 days × 4 weeks), Arcade (3 × 10), library rows | `components/training-mode/data/concepts/nightVigilante.js` |
| Engine: schedule entry, tier alternates, home versions, rookie fight, multi rounds, `stageItems` | `components/training-mode/data/concepts/index.js` |
| Saga pop-up shows the tier's stations | `components/training-mode/data/concepts/saga.js` |
| Tier chip labels + tier-aware day list | `components/training-mode/ConceptScreen.jsx` |
| Art | `public/static/concepts/night-vigilante/{poster,wide,card}.webp` |
| Tests (21 new, 113 total) | `scripts/test-concepts.mjs` |

## 1. Schedule
`{ concept: NIGHT_VIGILANTE, start: '2027-08-01', end: '2027-09-30' }` — over
Batman Day (third Saturday of September, Sep 18 2027). Library rows join
`EXTRA_EXERCISES`.

## 2. Engine changes (`data/concepts/index.js`)
- **Tier alternates.** A Fit row may carry `easy` (ROOKIE) and `hard`
  (ELITE) objects. `fitDayExercises` merges `{ ...row, ...row[tier], fixed:
  true }`; `scaleRow` returns a `fixed` row as written (sets ≥ 1, no
  multiplier).
- **Home versions.** After the tier merge: if `home` and the row has `home`,
  merge it (note defaults to "Home version of <name>."); otherwise the old
  weighted → `swap` rule.
- **Rookie fight.** `concept.fight.easy = { roundMin, maxRounds }`: on
  `easy`, keep the first `maxRounds − 1` rounds plus the last (it carries the
  super) and use `roundMin`. Per round, `easyCombos` replace `combos` and
  `super.easy` overrides the super (e.g. `{ every: 6, calls: [...] }`).
- **Multi rounds.** A fight round or an arcade stage with `multi: true` passes
  `multi: true` to every block round → the CC-6 switch calls.
- **`stageItems(stage, tier)`** → `stage.easyItems` on easy, else `items`.
  `stageCfg` takes `tier` (default: the concept's saved tier) and uses it;
  `conceptSaga` pathItems use it too, so the ladder pop-up lists the rookie
  stations for a rookie.
- `concept.tierLabels` (`{ easy: 'ROOKIE', normal: 'NORMAL', hard: 'ELITE' }`)
  relabels the tier chips on ConceptScreen; the FIT day list is built from
  `fitDayExercises(c, i, { tier, home })` so it shows what will actually run.

## 3. The drop (copy `nightVigilante.js` verbatim)
- Fit: THE FOUNDATION (clean & jerk + metcon) · THE RINGS (rope, muscle-up
  ladder, ring support/dips, box jumps, hanging core) · THE DEAD WEIGHT ·
  THE LONG NIGHT (info day: long run in Cardio Mode) · THE CLIMB (squat,
  hang circuit on gym/park bars — grip circuit at home — precision jumps,
  vaults, crawl) · REST · THE GAUNTLET. Every gymnastics/parkour movement has
  a ROOKIE rung. No bouldering anywhere.
- Fight: MMA, every combination ends in a dash. Days: THE FOUNDATION,
  BAG & TARGETS (incl. spinning backfist / spinning back elbow), MULTIPLE
  OPPONENTS (4 multi rounds), BAG FINISHER (rush). Super **Nightfall** on the
  last round of each day. ROOKIE: 3 × 2:00, simple combos.
- Arcade: THE ROOFTOP … BOSS · THE MASK, three paths, `easyItems` for rookies;
  THE ALLEY, NIGHT SHIFT and the fight boss are multiple-opponents stages.

## Acceptance
1. `npm run check:all` passes (concepts 113).
2. Owner preview → Strike Lab → OPEN NIGHT VIGILANTE: tier chips read
   ROOKIE / NORMAL / ELITE; THE RINGS lists Lying Rope Pulls, Pull-Up
   Negatives, Bench Dips… on ROOKIE and Legless Rope Climb, Strict
   Muscle-Ups, Ring Dips… on ELITE; HOME lists Towel Pull-Ups, Chair Dips.
3. Fight day 3 calls SWITCH / PIVOT every round; ROOKIE fight is 3 × 2:00
   with "Jab, cross, dash out" as the super.
4. Users do not see the drop until Aug 1, 2027.

---

## 4. Additions (second commit): run days, skill ladders, circuits, Flow State, One Hundred, Speed Demon

**Engine (`data/concepts/index.js`)**
- **Run days.** A Fit day `{ label, focus, intro, run: { km | mi: { easy, normal, hard } } }`
  (each a number or a per-week array) counts as a training day. `fitDayCfg`
  returns `{ conceptRun: true, goal, unit, … }` and stores
  `pendingRun: { seq, at, goal, unit }`; App `startConceptFit` sends a run cfg to
  `goCardioMode({ goal, unit })`. `settleConceptRun(id, runs = loadRuns())`
  counts the day once a run logged after `at` covers ≥ 90% of the goal
  (ConceptScreen calls it on open). `runTarget(concept, day, tier, week)`.
- **Skill ladders.** `concept.ladders = { id: { title, start: { easy, normal, hard }, rungs: [row…] } }`;
  a Fit row with `ladder: id` runs the athlete's rung (`progress.rungs[id]`,
  else the tier's start). `ladderState`, `ladderHit` (2 hits → up one rung),
  `ladderStep(±1)`. ConceptScreen FIT tab: SKILL LADDERS list with rung,
  target ("3 × 12"), next rung, hit dots, ↓ and ✓ HIT.
- **Circuits.** Rows with `circuit: 'x'` get `_chain: 'concept-x'`; a day's
  `circuits: { x: { easy, normal, hard } }` becomes `cfg.chainRounds`
  (2–5), which `FitBuilderWorkout` now takes as its initial `chainRounds`.
- **Library precedence.** `LIB` is built `[...EXTRA, ...FIT_MODE_EXERCISES]`
  so the Fit library's own row (id, video) wins over a concept row.
- `fitDayExercises` returns `[]` for a day without exercises.

**Night Vigilante:** ladders muscle-up (10 rungs), dips (6), rope (7),
hanging core (5), monkey bars (6), L-sit/pommel (6); THE LONG NIGHT is a run
day (mi: ROOKIE 1.5→2.5, NORMAL 4→6, ELITE 8→13.1); THE FOUNDATION metcon is
a circuit (ROOKIE 3 rounds, else 5). Stage "GOTHAM RUN" → "NIGHT RUN".

**Flow State** (`flowState.js`, Feb 1 – Mar 31 2027) and **One Hundred**
(`oneHundred.js`, Apr 1 – May 31 2027): copy both files verbatim; art in
`public/static/concepts/{flow-state,one-hundred}/`. One Hundred's push/squat/
sit-up days are 300 / 600 / 1,000 reps by tier and THE 10K is a run day
(km, negative split). Super names: Silver Flow, Limit Breaker.

**Speed Demon:** `blue-blur-protocol` title → "Speed Demon" (campaign series
and arcade data), badge "Speed Demon Badge".

**Tests:** `test-concepts` 149, including a franchise-name guard over every
drop's user-facing text.

## 5. Art + retiring the old sagas (third commit)
- New titleless banners: `series/posters/struggler-protocol.{png,webp}`,
  `blue-blur.{png,webp}` (Speed Demon), new `night-vigilante.webp`
  (Night Vigilante `art.arcade`). `TITLED_POSTERS` is now only
  `vigilante-protocol`. Night Vigilante poster/card/wide replaced.
- `saga.js` `retiredSagaIds(now)`: once a drop is live (or in the vault) the
  saga it replaces leaves the carousel — flow-state → `flow-state-protocol`,
  one-hundred → `one-punch-protocol`, night-vigilante → `vigilante-protocol` —
  unless the player is Pro or already cleared a stage there; ultra-ego →
  `destroyer-protocol` (Dec 1) is retired the same way. TrainingArcade filters
  `VISIBLE_ARCADE_SERIES` with it.

## 6. Warrior Queen + Shoto date (fourth commit)
- Shoto window now **2026-10-23 → 2026-11-30** (a week after the film's Oct 16 release).
- **Warrior Queen** (`warriorQueen.js`, copy verbatim) — **2027-06-01 → 2027-07-31**,
  filling the sixth slot. Fit: THE FORGE, THE SCULPTOR, BATTLE DAY (metcon + core
  circuits), THE HEROIC BUILD; a 7-rung pull-up ladder. Fight: Kickboxing —
  SHIELD & BRACERS, THE BIND, POWER KICKS, THE BATTLEFIELD (multiple opponents);
  super **Bracer Storm**. Arcade: THE SHORE … BOSS · THE TITAN. Art in
  `public/static/concepts/warrior-queen/` and `series/posters/warrior-queen.webp`.
- Tests: 159; the franchise guard now also blocks Wonder Woman / Diana /
  Themyscira / Amazon / lasso.

## 7. Warrior Queen art (fifth commit, `40e5007`)
Replace `public/static/concepts/warrior-queen/` with the files at `40e5007`:
- `poster.webp` and `card.webp` — the owner's portrait art (760×1140): the
  warrior on the sea cliff with spear and round shield at sunset. Used by the
  drop pop-up, the concept page header (FIGHT tab), and the Home / Fit / Fight
  feature cards.
- `wide.webp` — the owner's wide sunset art (1200×675), the concept page header
  on the FIT tab.
- `series/posters/warrior-queen.webp` is **replaced** with the warrior-woman silhouette (bracers crossed, shield); the earlier file was the dragon fighter by mistake.
Run `npm run lock:assets` after copying. No code changes.

## 8. Concept page layout = the hubs (sixth commit)
- **Tabs:** the 3-box FIT / FIGHT / ARCADE grid is replaced by the hubs' own
  `ModeTabs` (FIT MODE / FIGHT MODE). `ModeTabs` gains an optional
  `subs={{ fit, fight }}` that prints sessions done under each label
  ("0/16", "8/8 ✓"). The tab opens on whichever hub the athlete came from
  (Fit hub card → FIT, Fight hub card → FIGHT; Home → FIT) — unchanged routing.
- **Discipline:** on FIGHT, the hubs' `DisciplineTabs` row shows the drop's
  discipline selected (read-only, `pointerEvents: none`).
- **Arcade:** a full-width ARCADE row under the tabs, `0/10 stages`, dimmed
  with 🔒 "Finish Fit or Fight to unlock" until `status(c).bossUnlocked`
  (Fit OR Fight program complete); then gold "Open the gauntlet ›".
  `conceptSaga()` is `status: 'locked', lockNote: 'FINISH FIT OR FIGHT'` until
  then, so the Training Arcade card is locked too (TrainingArcade prints
  `🔒 ${lockNote}`).
- **Gym / Bodyweight:** the home toggle reads GYM · BODYWEIGHT.
- **Fight day rows** are short: the day name, its focus in lower case
  ("blocks · parries · counters") and `N ROUNDS` — no round list.
- Smoke test: the gauntlet step seeds a finished Fit program first.

## 9. Arcade gate by workouts (seventh commit) — replaces §8's "Arcade after a full program"
`arcadeGate(concept, progress)` in `data/concepts/index.js`:
- **Opens** after week 1 of either program: `fitDone ≥ fit training days per week`
  OR `fightDone ≥ fight days per week`.
- **Stages follow workouts:** stage n needs `openAt + (n − 1) × perStage` Fit +
  Fight sessions, where `openAt = min(fit week, fight week)` and `perStage =
  arcade.workoutsPerStage || 1`. The **boss** also needs one full program done.
- Returns `{ open, workouts, allowed, nextIdx, nextNote }`; `nextNote` is
  "Finish week 1 of Fit or Fight" / "Stage N in X more workout(s)" / "Boss opens
  when the Fit or Fight program is done". `stagePlayable` = `idx < allowed`.
- `conceptSaga` → `status` active once open (`lockNote: 'FINISH WEEK 1'` before),
  plus `maxUnlocked: allowed` and `gateNote`. `ArcadeSeriesDetail`'s
  `highestUnlocked` is capped by `series.maxUnlocked`; tapping a stage held back
  by workouts toasts the `gateNote`.
- ConceptScreen ARCADE row: `cleared/10 · N open` and the `nextNote`.
- Tests: 166.

## 10. Fit hub spacing (eighth commit)
- **Today's mission card:** `clamp(118px, 15.5dvh, 134px)` tall (was 168–180).
  Title 19 px, two-line clamp. The detail line and a compact gold START
  (40 px tall, 0 18 px padding, 14 px Chakra Petch, inner highlight) share
  the bottom row instead of a full-width 44 px button.
- **SURPRISE ME / ADJUST:** 32 px tall, tucked under the card (`marginBottom: -6`).
- **One gap for the stack:** `GAP = clamp(8px, 1.4dvh, 12px)` between the
  concept card, the rows and Cardio. Rows and Cardio are
  `clamp(48px, 6.6dvh, 56px)` tall.
- **ConceptFeatureCard** in the Fit and Fight hubs is 88 px tall (was 112) with a 19 px title.
  The Fight hub's card margin matches its 7 px banner gap.

## 11. Shoto: four Fit days (ninth commit)
The first optional SHOTO PRACTICE rest day becomes a training day, TECHNIQUE
CONDITIONING: jump rope (home: high knees), shadowbox stance transitions, horse
stance hold, alternating front kicks, roundhouse kick drill, Hindu push-ups,
fighter hip mobility. The library rows are added to `SHOTO_EXERCISES`. Shoto Fit
is now 4 days × 4 weeks = 16, matching Fight's 4 days a week, so the Arcade
opens after 4 workouts like the other drops.

## 12. Ultra Ego: four weeks of Fight (tenth commit)
`ULTRA_EGO.fight.weeks = 4`: the five-day rotation repeats for 4 weeks
(20 sessions; was 5). The concept page shows WEEK N OF 4 on FIGHT, and the reward
needs all 20 sessions. Tests: 169.

## 13. Exercise info for concept moves + Shoto day 6 (eleventh commit)
- `data/exerciseInfo.js`: new families at the **top** of `FAMILIES` so concept
  moves stop matching broader ones by name — jump-rope, kick (front kick /
  roundhouse / kick drill / teep), stance-hold (horse stance), shadowbox,
  mobility, neck (neck curls), muscle-up, glute-kickback, cardio-machine
  (bike or row / rower / stair climb), ywt. ("Jump Rope" was showing jump-squat
  cues; "Neck Curls" biceps-curl cues.)
- Shoto's remaining optional rest day is renamed ACTIVE RECOVERY so "Shoto
  Practice" appears once.

## 14. Shoto Practice: the owner's nine moves (twelfth commit)
Shoto's day 4 (SHOTO PRACTICE · TECHNIQUE CONDITIONING) is, in order: Jump Rope
3×90s (bodyweight: High Knees 60s) · Man Makers 3×8 (dumbbell; bodyweight:
Burpees) · Hindu Push-Ups 3×12 · Hindu Squats 3×25 · Horse Stance Hold 3×45s ·
Fighter Hip Mobility 2×60s · Alternating Front and Side Kicks 3×20 ·
Alternating Roundhouse Kicks 3×16 · Shadowboxing 3×90s. New `SHOTO_EXERCISES`
rows for Hindu Squats, the two kick drills and Shadowboxing; the exerciseInfo
`kick` family also matches "side kick". Tests: 170.
- **Fit to 35 min (follow-up):** Jump Rope 2×90s r30 · Man Makers 3×8 r60 ·
  Hindu Push-Ups 3×12 r45 · Hindu Squats 2×25 r45 · Horse Stance 2×45s r30 ·
  Hip Mobility 2×45s r15 · Front & Side Kicks 3×20 r30 · Roundhouse Kicks
  3×16 r30 · Shadowboxing 2×90s r30 → ~34 min on NORMAL.

## 15. HARD adds reps, not sets (thirteenth commit)
`TIER.hard = { sets: 0, reps: 1.3, secs: 1.1 }` (was +1 set, ×1.15 reps).
Timed work scales by `secs` (falls back to `reps`) and rounds to 5 s. Rows that
carry their own `hard` / `easy` alternate are unchanged (used as written).
Shoto Practice: EASY ~26 min, NORMAL ~34, HARD ~38 (was ~51).

## 16. Tier chips: ROOKIE / NORMAL / ELITE for every drop (fourteenth commit)
ConceptScreen falls back to `TIER_LABELS = { easy: 'ROOKIE', normal: 'NORMAL', hard: 'ELITE' }`
when a drop sets no `tierLabels` (Shoto and Ultra Ego showed EASY / HARD).

## 17. Paywall line + concept analytics (fifteenth commit)
- Paywall `BENEFITS` gains "Every past concept drop in the Vault" — the gate is
  real (`canPlay` → `isPro()` for vault drops).
- Plausible events: `concept_popup {concept}` (drop pop-up shown),
  `concept_open {tab, from}` (concept page opened), `concept_session
  {concept, kind, done, total}` (every Fit / Fight / Arcade session that
  reports back, in `recordConceptSession`).
