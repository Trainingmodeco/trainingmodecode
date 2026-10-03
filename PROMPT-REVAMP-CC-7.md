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
