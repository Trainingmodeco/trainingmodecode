# PROMPT REVAMP-CC-7 — Night Vigilante concept drop (+ concept engine: tier alternates, home versions, multi rounds)

**Scope: the Night Vigilante drop and the engine changes it needs, on
`trainingmodeco/trainingmodecode`, branch `app`. Run CC-5 and CC-6 first.**
Read the source files below before writing — match them line-close. Where
this prompt and the source disagree, the source wins.

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
