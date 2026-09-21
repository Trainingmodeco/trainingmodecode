# PROMPT REVAMP-CC-1 — Combat Conditioning to parity with `app`

**Scope: `apptrainingmode.com` Combat Conditioning setup + generator only.**
**Do not touch any other screen, hub, engine, or route in the revamp.**

Run this in the revamp app repo. It brings **Combat Conditioning** up to the
state that shipped to `apptrainingmode.com` at commit `bef8b4e` on
`trainingmodeco/trainingmodecode` (branch `app`). Nothing else.

Every path, hash and constant here was verified against the working tree of
the app repo on 2026-09-21. **Read the four source files below** before
writing a single line — the revamp must match them byte-close, not
paraphrase.

**Reference source** — read from `trainingmodeco/trainingmodecode`,
branch `app`, at `bef8b4e`:

| Purpose | Path |
|---|---|
| Setup screen (full rewrite) | `components/training-mode/CombatConditioningSetup.jsx` |
| Generator (three bug fixes) | `components/training-mode/data/combatConditioningGenerator.js` |
| Audit script (new) | `scripts/audit-cc-generator.mjs` |
| Hero art (new asset) | `public/static/hub/combat-hero.webp` (68 KB, 1440x480, WebP q82) |

**Ledger of commits this prompt combines** (all in one push if you like):

| Commit | Summary |
|---|---|
| `5ef435e` | Combat Conditioning: four presets, one cinematic banner, progressive customize |
| `ccb22b3` | Four presets on one row, one screen, no page scroll |
| `99c7ca3` | New hero art, violet dim, no doubled title |
| `bef8b4e` | Banner shows both titles + generator audit + three bug fixes |

Also carry `405e10e` if the revamp still has these two defects:
- Rounds session format string mismatch (`'intervals'` vs `'interval'`)
- ProGateOverlay z-index isolation (must portal at `OVERLAY_Z + 10`)

---

## 0. What we are trying to do

The old Combat Conditioning setup was a single form — pick discipline,
pick style, pick rounds, pick intensity, pick equipment, then find START.
Every control had equal visual weight. The athlete had to interpret the
whole thing before understanding what they were about to run.

The redesign leads with the workout instead of the settings, and the
generator underneath honours the athlete's choices:

1. A cinematic hero banner carries the CONDITION HARDER title (baked into
   the artwork itself) plus a live summary that updates as the athlete
   changes anything.
2. Four preset tiles across one row let a beginner pick "GAS TANK" and
   immediately be given a session that fits it.
3. A progressive-disclosure CUSTOMIZE block reveals discipline / timing /
   intensity / equipment only once a preset is picked.
4. The generator no longer hands a beginner "Trap Bar Deadlift" when they
   picked NONE equipment. Every session is discipline-tuned, gear-
   appropriate, difficulty-matched, and no two presets return the same
   workout for the same knobs.

Everything fits one screen at **390x844** (Pixel 6 / iPhone 12+) with no
page scroll, and fits initial state at **375x667** (iPhone SE) too.

---

## 1. THE HERO ART — copy the WebP, do not regenerate

`public/static/hub/combat-hero.webp` in the reference repo is **the** asset.

- Source: uploaded by the owner; a 2172×724 PNG (~1.9 MB).
- Shipped: 1440×480 WebP at quality 82, **68 KB**. Encoded with `sharp`:
  ```
  sharp('<source>.png').resize({width:1440}).webp({quality:82})
    .toFile('public/static/hub/combat-hero.webp')
  ```
- The artwork itself carries the titles **CONDITION HARDER** (left) and
  **NEXT ROUND · GO FOR BROKE** (right). Do NOT overlay either title as
  HTML — that will double them up.
- Every other asset under `public/static/hub/` is `.webp` (`combat.webp`,
  `combat-banner.webp`, `fit.webp`, `fight.webp`, `arcade.webp`). Do
  NOT change format for this one file. If the revamp uses
  `assets.lock.json`, run its writer after adding the file.

---

## 2. THE SETUP SCREEN — `CombatConditioningSetup.jsx`

Full rewrite. Read the reference file end-to-end, then match. The
structure that MUST land:

### 2.1 State

One flat block. Every control mutates one field, every read pulls from
the same block. Nothing is duplicated in child components.

```
style: 'Boxing' | 'Kickboxing / Muay Thai' | 'MMA'   default 'Boxing'
difficulty: 'Easy' | 'Normal' | 'Hard' | 'Advanced'  default 'Normal'
rounds:   number   default 5
workSec:  number   default 40
restSec:  number   default 15
focus:    null | 'gas-tank' | 'power' | 'strike-strength' | 'fight-athlete'   default null   ← nothing preselected on mount
equipment:'NONE' | 'BAG' | 'WEIGHTS'                 default 'NONE'
customizeOpen: boolean                               default false
cardioAddon: object | null                           default null
warmupMin: number                                    from loadWarmup('combatConditioning')
```

### 2.2 The four PRESETS constant

```js
const PRESETS = [
  { id: 'gas-tank',         label: 'GAS TANK',           focusLabel: 'Conditioning', focusShort: 'Endurance', icon: '🔥', tint: '#ff5a2a', desc: 'Bag work + bursts. Build fight endurance.',
    defaults: { rounds: 5, workSec: 40, restSec: 15, difficulty: 'Normal', equipment: 'BAG',     blend: 50 } },
  { id: 'power',            label: 'POWER & EXPLOSION',  focusLabel: 'Power',        focusShort: 'Power',     icon: '💥', tint: '#ff3448', desc: 'Plyo + strikes for knockout force.',
    defaults: { rounds: 5, workSec: 30, restSec: 30, difficulty: 'Hard',   equipment: 'NONE',    blend: 40 } },
  { id: 'strike-strength',  label: 'STRIKE & STRENGTH',  focusLabel: 'Strength',     focusShort: 'Strength',  icon: '🥊', tint: '#a855f7', desc: 'Alternating combos + resistance.',
    defaults: { rounds: 5, workSec: 45, restSec: 20, difficulty: 'Normal', equipment: 'WEIGHTS', blend: 65 } },
  { id: 'fight-athlete',    label: 'FIGHT ATHLETE',      focusLabel: 'Athletic',     focusShort: 'Athletic',  icon: '🏃', tint: '#a855f7', desc: 'Full body. High output. No limits.',
    defaults: { rounds: 5, workSec: 40, restSec: 20, difficulty: 'Hard',   equipment: 'BAG',     blend: 55 } },
];
```

Selecting a preset seeds the customize controls with `defaults` AND opens
the customize block. `blend` feeds the generator.

### 2.3 INTENSITIES — the four-tier color progression

```js
const INTENSITIES = [
  { id: 'Easy',     label: 'LOW',    color: '#2ecc71', short: 'Low' },
  { id: 'Normal',   label: 'MED',    color: '#e4d43a', short: 'Medium' },
  { id: 'Hard',     label: 'HIGH',   color: '#ff8a2a', short: 'High' },
  { id: 'Advanced', label: 'SAVAGE', color: '#ef4444', short: 'Savage' },
];
```

The `id` maps directly to `DIFFICULTY_ORDER` in the generator. Only the
selected chip wears its colour; unselected stay dark violet
(`rgba(16,4,30,0.8)`).

### 2.4 The hero banner

The `<div>` container's `aspectRatio` MUST be `'2172 / 724'` (the
artwork's own 3:1 ratio). Any other ratio crops one baked title off.

- Background: `<img src="/static/hub/combat-hero.webp">` with
  `objectFit:cover; objectPosition:center center`.
- Two dim overlays (in order):
  1. Multiply-blended linear gradient
     `linear-gradient(180deg, rgba(60,10,100,0.10) 0%, rgba(30,4,60,0.18) 100%)`
     with `mixBlendMode: 'multiply'`.
  2. Radial violet vignette
     `radial-gradient(ellipse at 50% 50%, rgba(88,28,135,0.18) 0%, rgba(6,0,18,0.05) 55%, rgba(6,0,18,0.35) 100%)`.
- Foreground content is `justify-content: space-between`:
  - **Top row:** the HYBRID chip (red-outline, `rgba(20,4,10,0.55)` panel
    with a 3px backdrop-filter blur) + a live summary line.
    - Nothing picked: `PICK A CIRCUIT BELOW`
    - Preset picked: `${preset.label} · ${rounds} ROUNDS · ${intensity.label}`
  - **Middle:** EMPTY. The artwork carries CONDITION HARDER and the
    GO FOR BROKE stamp itself; no HTML title.
  - **Bottom row:** three stat cards side-by-side —
    focus (icon + focus label + focusShort),
    rounds+intensity (▮▮▮ + `${rounds} ROUNDS` + `intensity.short`),
    time (⏱ + `~${durationMin} MIN` + `Est. time`).

### 2.5 The four presets on one row

`grid-template-columns: repeat(4, 1fr); gap: 5px`.

Each card is a `<button>` around ~85px wide × ~122px tall on a 390 phone,
padding `10px 4px 8px`, `min-height: 122`. Contents (top to bottom):
- Icon (font-size 20)
- Label (Orbitron 900, size 9, may wrap to 2 lines)
- Description (Rajdhani 500, size 8.5)
- Footer badge: a small circle in `preset.tint` colour then
  `${preset.defaults.rounds} R · ${focusLabel.toUpperCase()}`

Selected state: `border: 1.5px solid #ef4444`,
`background: linear-gradient(160deg, rgba(239,68,68,0.14) 0%, rgba(8,2,18,0.9) 70%)`,
`box-shadow: 0 0 14px rgba(239,68,68,0.4), inset 0 0 22px rgba(239,68,68,0.08)`,
plus a 15px red circle with a white ✓ pinned at `top:5, right:5`.

### 2.6 The CUSTOMIZE header row (renders only when a preset is picked)

Left: `CUSTOMIZE` (Orbitron 900 size 11) + `(OPTIONAL)` (Rajdhani 600 size
8, muted). Right: `FINE-TUNE YOUR SESSION` (muted) + a `▼` that rotates
180° on toggle. Tap toggles `customizeOpen`.

### 2.7 The four control rows (progressive disclosure)

Each row is a `ControlRow` — icon on left (30x30 chip tinted per row),
label+sub in the middle, controls on the right. All four render only when
`hasPreset && customizeOpen`:

| Row       | Icon | Tint     | Label     | Sub               | Controls                                |
|-----------|------|----------|-----------|-------------------|-----------------------------------------|
| DISCIPLINE | 🥊  | `#ef4444`| DISCIPLINE| Training style    | 3 chips: BOXING · KICKBOXING/MUAY THAI · MMA. Selected chip = red fill, white text. |
| TIMING     | ⏱   | `#a855f7`| TIMING    | Work / rest       | 3 MicroSteppers: ROUNDS 2..12 step 1, WORK 10..120 step 5, REST 0..90 step 5. |
| INTENSITY  | ▮▮  | `#a855f7`| INTENSITY | How hard          | 4 chips: LOW · MED · HIGH · SAVAGE. Selected chip wears its color from §2.3, text `#0a0014`. |
| EQUIPMENT  | 🏋   | `#a855f7`| EQUIPMENT | What you have     | 3 chips: NONE · BAG · WEIGHTS. Selected chip wears `#fde047` (gold), text `#0a0014`. |

The customize open/close uses a `max-height` transition (~220ms):
`max-height: 0; opacity: 0; margin-top: 0` when closed, unbounded when open.

### 2.8 The ADD CARDIO row (always rendered, even before a preset is picked)

`ControlRow`-shaped with a heart icon in a gold chip. Label "ADD CARDIO"
+ gold `OPTIONAL` chip; sub `Finish with a run — bonus XP`. Right: a
small toggle-shaped affordance (32x18 pill with a white dot). Tapping
the row opens the existing `AddCardioSheet` — do not re-implement it.

### 2.9 The START button

Bespoke component `StartCircuitButton`, replaces the generic
`TrainingCTA` on this screen only.

- Width 100%, padding `13px 18px 15px`.
- Enabled: `linear-gradient(180deg, rgba(239,68,68,0.85) 0%, rgba(180,20,32,0.85) 100%)`,
  border `1.5px solid rgba(239,68,68,0.9)`, glow
  `0 6px 22px rgba(239,68,68,0.35), inset 0 0 22px rgba(255,255,255,0.05)`.
- Disabled: darker gradient with border alpha 0.3, opacity 0.7,
  cursor `not-allowed`.
- Four corner **brackets** (12x12) in `rgba(255,255,255,0.85)`, one at
  each corner, `pointer-events: none`.
- Content row: `⚔️ START CIRCUIT ›` when enabled; `⚔️ PICK A CIRCUIT ›`
  when no preset selected.
- Subtitle underneath: `SAME WORK · A STRONGER YOU`
  (Orbitron 700 size 7.5, letter-spacing 0.18em, opacity 0.9). Only
  render subtitle when enabled.

### 2.10 Duration calculation (used by the banner and by AddCardioSheet)

```js
const restBetween = Math.max(0, rounds - 1) * restSec;   // no rest after the last round
const work        = rounds * workSec;
const cardioMin   = cardioAddon?.enabled ? Math.max(0, Number(cardioAddon.durationMin) || 0) : 0;
const total       = warmupMin * 60 + work + restBetween + cardioMin * 60;
const durationMin = Math.max(1, Math.round(total / 60));
```

Reads live from `warmupMin`, `rounds`, `workSec`, `restSec`, `cardioAddon`.

### 2.11 The onStart contract — DO NOT change any field name

The setup screen builds and calls exactly this object; the mission
generator below reads exactly these keys.

```js
onStart({
  style,
  duration: durationMin,
  difficulty,
  equipment: EQUIPMENT_TIER[equipment] || 'Any',
  format: 'Auto',
  voiceOn: true,
  formPreviewOn: true,
  cadenceCount: true,
  cadencePreset: 'moderate',
  cadenceMs: CADENCE_PRESETS.moderate,
  cardioAddon,
  rounds, workSec, restSec, focus,
  blend: preset?.defaults.blend ?? 50,
  warmupMin,
});
```

Where `EQUIPMENT_TIER = { NONE: 'Bodyweight', BAG: 'Bags & Combat Gear', WEIGHTS: 'Basic Gym' }`.

### 2.12 Padding

`padding: '8px 12px calc(88px + env(safe-area-inset-bottom, 0px))'` and
`gap: 8` inside the scroll container. Do NOT reintroduce the old
`30dvh` bottom pad — it was the reason the START button used to sit off
the bottom of the phone.

---

## 3. THE GENERATOR — three bug fixes in `combatConditioningGenerator.js`

Read the reference file's `generateCombatConditioningMission` end to end.
Three changes MUST land. The npm-run audit in §4 tests all three.

### 3.1 Normalise the discipline string BEFORE looking up the rules

The setup writes `"Kickboxing / Muay Thai"` (spaces around the slash),
`CC_RANDOMIZER_RULES` is keyed `"Kickboxing/Muay Thai"` (no spaces).
Without the normaliser the generator silently falls back to All-Around
and a Muay Thai fighter gets an untuned session.

Add above `generateFromLibrary`:

```js
function normalizeStyleKey(style) {
  if (!style) return 'All-Around';
  const cleaned = String(style).replace(/\s*\/\s*/g, '/').trim();
  const target = cleaned.toLowerCase();
  const keys = Object.keys(CC_RANDOMIZER_RULES);
  return keys.find(k => k.toLowerCase() === target) || 'All-Around';
}
```

Inside `generateFromLibrary`, replace the ternary that reads
`config.style === 'All-Around' ? 'All-Around' : config.style` with
`normalizeStyleKey(config.style)`.

### 3.2 Hard-gate prebuilts by equipment

The prebuilt scorer used equipment as a bonus, not a gate. A beginner
tapping NONE could be handed Trap Bar Deadlifts. Two changes together:

**a) Skip prebuilts that require equipment the athlete does not have.**

Inside `generateCombatConditioningMission`, replace

```js
const scored = CC_PREBUILT_WORKOUTS.map(w => ({ workout: w, score: scorePrebuilt(w, normalizedConfig) }));
```

with

```js
const eligiblePrebuilts = CC_PREBUILT_WORKOUTS.filter(w =>
  equipmentAllowed(w.equipment, normalizedConfig.equipment)
);
const scored = eligiblePrebuilts.map(w => ({ workout: w, score: scorePrebuilt(w, normalizedConfig) }));
```

**b) Also gate each prebuilt drill by its own equipment.**

Inside `prebuiltToMission`, before `const drills = workout.exercises.map(...)`,
insert

```js
const kept = workout.exercises.filter((exName) => {
  const libMatch = CC_EXERCISE_LIBRARY.find(
    (ex) => ex.name.toLowerCase() === exName.toLowerCase()
  );
  if (!libMatch) return true;                     // unknown drill — trust the prebuilt
  return exerciseEquipmentAllowed(libMatch.equipment, config.equipment);
});
```

and change `workout.exercises.map(...)` to `kept.map(...)`. This lets a
mostly-in-tier prebuilt run its in-tier drills only; a lone Trap Bar in
an otherwise-bodyweight prebuilt drops out.

### 3.3 Fight Athlete: skip prebuilts + bespoke picker

Fight Athlete's category list is a superset of every other lane. Under
the previous rules Gas Tank and Fight Athlete kept landing on the same
prebuilt. Two changes:

**a) Route fight-athlete straight to the library.**

At the top of `generateCombatConditioningMission`, right after the
`normalizedConfig` block, insert

```js
if (normalizedConfig.focus === 'fight-athlete') {
  return generateFromLibrary(normalizedConfig);
}
```

**b) Bump the prebuilt focus threshold from 0.34 to 0.5** for every other
preset. Change

```js
const focusOk = !normalizedConfig.focus || focusMatchRatio(best.workout, normalizedConfig.focus) >= 0.34;
```

to

```js
const focusOk = !normalizedConfig.focus || (best && focusMatchRatio(best.workout, normalizedConfig.focus) >= 0.5);
```

**c) Add `pickFightAthlete` as a helper**, then branch to it inside
`generateFromLibrary`. Replace the block that starts with
`// Bias exercise selection toward the circuit-style focus categories`
with:

```js
const profile = focusProfile(config.focus);
const target = template.exercisesPerRound;
let selected;

if (config.focus === 'fight-athlete') {
  selected = pickFightAthlete(eligible, target);
} else {
  const preferred = shuffle(eligible.filter((ex) => inFocus(ex.category, profile)));
  const others = shuffle(eligible.filter((ex) => !inFocus(ex.category, profile)));
  selected = [];
  const usedCats = new Set();
  const focusTarget = Math.max(1, Math.round(target * 0.7));
  for (const ex of preferred) {
    if (selected.length >= focusTarget) break;
    if (usedCats.has(ex.category)) continue;
    selected.push(ex); usedCats.add(ex.category);
  }
  for (const ex of others) {
    if (selected.length >= target) break;
    if (usedCats.has(ex.category)) continue;
    selected.push(ex); usedCats.add(ex.category);
  }
  if (selected.length < target) {
    const chosen = new Set(selected.map((e) => e.id));
    const rest = [...preferred, ...others].filter((e) => !chosen.has(e.id));
    for (const ex of rest) {
      if (selected.length >= target) break;
      selected.push(ex);
    }
  }
}

return buildMissionFromExercises(selected, template, config, settings);
```

Then define, below `generateFromLibrary`:

```js
function pickFightAthlete(eligible, target) {
  const lanes = [
    focusProfile('gas-tank').categories,
    focusProfile('power').categories,
    focusProfile('strike-strength').categories,
  ];
  const chosen = [];
  const usedIds = new Set();
  const usedCats = new Set();
  for (const laneCategories of lanes) {
    const laneProfile = { categories: laneCategories };
    const pool = shuffle(
      eligible.filter(ex => inFocus(ex.category, laneProfile) && !usedIds.has(ex.id) && !usedCats.has(ex.category))
    );
    if (pool.length) {
      chosen.push(pool[0]);
      usedIds.add(pool[0].id);
      usedCats.add(pool[0].category);
    }
  }
  const rest = shuffle(eligible.filter(ex => !usedIds.has(ex.id)));
  for (const ex of rest) {
    if (chosen.length >= target) break;
    if (usedCats.has(ex.category)) continue;
    chosen.push(ex); usedIds.add(ex.id); usedCats.add(ex.category);
  }
  for (const ex of rest) {
    if (chosen.length >= target) break;
    if (usedIds.has(ex.id)) continue;
    chosen.push(ex); usedIds.add(ex.id);
  }
  return chosen;
}
```

### 3.4 Add the `fight-athlete` FOCUS_PROFILES entry (if absent)

`fight-athlete` needs a real profile so `focusProfile()` does not fall
back to gas-tank. Add to `FOCUS_PROFILES`:

```js
'fight-athlete': {
  categories: [
    'Cardio', 'Conditioning', 'Intervals', 'Combat Skill Conditioning',
    'Plyometrics', 'Power', 'Lateral Power', 'Rotation / Power',
    'Striking', 'Bag Work', 'Shadowboxing',
    'Strength', 'Upper Body Push', 'Upper Body Pull', 'Loaded Carry',
    'Footwork', 'Agility', 'Locomotion',
  ],
  repScale: 1.1,
},
```

---

## 4. THE AUDIT — `npm run audit:cc`

Copy `scripts/audit-cc-generator.mjs` from the reference repo. Add to
`package.json`:

```json
"audit:cc": "node --import ./scripts/extensionless-loader-register.mjs scripts/audit-cc-generator.mjs",
```

If the revamp does not yet have `scripts/extensionless-loader-register.mjs`
(it was added in REVAMP-2's test:cardio wiring), copy it and its sibling
`scripts/extensionless-loader.mjs` too.

Run it. It walks every STYLE × DIFFICULTY × EQUIPMENT × PRESET
combination (3 × 4 × 3 × 4 = **144 sessions**) and reports:

- **duplicate drill** — same drill name repeated in one session
- **equipment out of tier** — a drill needing gear the athlete does not have
- **discipline mismatch** — a drill not tagged for the athlete's style
- **thin circuit** — fewer than 3 drills
- **difficulty gap** — a drill more than one tier off the request (note only)
- **preset overlap > 60%** — two presets share too many drills

**Done means the audit prints `Failures: 0` and `Sessions clean: 144`.**
Zero-to-two `preset overlaps` are acceptable — the NONE-equipment pool
is narrow enough on a specific discipline that a category collision can
happen by unlucky shuffle. The tiles still program different work.

---

## 5. VERIFICATION — by athlete tier, not just by test

Run the app after the changes. Reproduce each of these end-to-end with
a real tap-through, from Home → Train → Fight Mode → CONDITIONING →
pick a preset → START:

| Athlete tier | Discipline | Equipment | Intensity | What the session MUST look like |
|---|---|---|---|---|
| Beginner  | Boxing               | NONE    | LOW    | Bodyweight boxing-tagged circuit. Shadowboxing, jumping jacks, mountain climbers, high knees. **No barbells. No power lifts.** Rest 45s. |
| Novice    | Kickboxing/Muay Thai | BAG     | MED    | Heavy bag rounds, kick burnouts, ladder footwork. Rest 40s. |
| Intermed. | MMA                  | WEIGHTS | HIGH   | Sandbag slams, loaded carries, med-ball throws, wrestling positions. Rest 30s. |
| Elite     | MMA                  | WEIGHTS | SAVAGE | Heaviest prebuilt if it qualifies; else Olympic lifts, plyo, MMA-tagged drills. Rest 25s. |
| Any       | Any                  | Any     | Any    | Tap **FIGHT ATHLETE**: sessions must **never** match the same-config **GAS TANK** session's drill list. |

Also verify:

- Picking a preset seeds the customize block with its `defaults`. Changing
  a stepper after that does not deselect the preset. Picking a **different**
  preset re-seeds.
- On initial mount `focus === null`, customize is not rendered, and START
  reads `PICK A CIRCUIT` (disabled).
- The banner's summary line updates instantly when rounds / intensity /
  preset change.
- Discipline switch does not reset the preset or the timings.
- The Add Cardio card is visible even before any preset is picked, and
  tapping it opens `AddCardioSheet` (unchanged from before).
- At **375x667** the initial state (nothing picked) fits without page
  scroll. At **390x844** the full expanded state (preset picked, customize
  open) fits without page scroll.

---

## 6. WHAT THIS PROMPT DELIBERATELY DOES NOT DO

- No changes to `CombatConditioningActive`, `CombatConditioningComplete`,
  or any workout-timer engine.
- No new prebuilt workouts (`CC_PREBUILT_WORKOUTS` stays the 12 shipped
  entries). The "20 COACH'S PICKS" work is a separate prompt.
- No changes to Cardio Mode, Ghost Mode, or the round timer.
- No changes to the bottom nav, header, PhoneFrame, Training Mode logo,
  ScreenGuide, or ScreenRouter.
- The AddCardioSheet, WarmupRow, and TrainingCTA components are reused
  as they exist.

---

## 7. DONE MEANS

- `npm run typecheck` — 0 errors.
- `npm run lint` — 0 errors, 0 warnings.
- `npm run test:indoor` — 56 passed / 0 failed (unchanged).
- `npm run test:cardio` — 39 passed / 0 failed (unchanged).
- **`npm run audit:cc` — Failures: 0. Sessions clean: 144.**
- `npm run build:web` — exit 0.
- On a real 390x844 phone: initial state fits, preset-picked state fits,
  no page scroll in either.
- A beginner tapping GAS TANK · NONE · LOW receives a bodyweight
  session, no barbells.
- FIGHT ATHLETE and GAS TANK never return the same session for the
  same (style, equipment, difficulty).
- The banner shows CONDITION HARDER and NEXT ROUND · GO FOR BROKE
  side-by-side with no clip on either edge.

If all eight pass, ship it.
