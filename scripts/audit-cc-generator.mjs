// Combat Conditioning generator audit — runs every meaningful setup
// combination through the real generator and reports duplicates,
// discipline / difficulty / equipment mismatches, and preset overlap.
//
// This is a black-box audit against the actual mission the athlete would
// see when they tap START CIRCUIT. Nothing here reads the generator's
// internals — it consumes the same shape App.jsx does.

import { generateCombatConditioningMission } from '../components/training-mode/data/combatConditioningGenerator.js';
import {
  CC_EXERCISE_LIBRARY,
  CC_RANDOMIZER_RULES,
} from '../components/training-mode/data/combatConditioningData.js';

// The exact strings the setup screen passes to onStart, straight from
// CombatConditioningSetup.jsx.
const STYLES     = ['Boxing', 'Kickboxing / Muay Thai', 'MMA'];
const DIFFS      = ['Easy', 'Normal', 'Hard', 'Advanced'];
const EQUIP_TIER = { NONE: 'Bodyweight', BAG: 'Bags & Combat Gear', WEIGHTS: 'Basic Gym' };
const EQUIPS     = ['NONE', 'BAG', 'WEIGHTS'];
const PRESETS    = ['gas-tank', 'power', 'strike-strength', 'fight-athlete'];

// Equipment tier definitions have to match the ones inside the generator —
// they live inside the module so we mirror them here for the audit.
const EQUIPMENT_TIERS = {
  Bodyweight: ['Bodyweight'],
  'Basic Gym': ['Bodyweight', 'Light Dumbbells', 'Kettlebell', 'Resistance Band', 'Dumbbells/Kettlebells', 'Jump Rope', 'Dip Station', 'Pull-Up Bar'],
  'Bags & Combat Gear': ['Bodyweight', 'Heavy Bag', 'Speed Bag', 'Light Dumbbells', 'Timer', 'Rope/String', 'Dummy/Sandbag', 'Sandbag', 'Towel/Gi', 'Agility Ladder', 'Cones'],
};
function equipmentAllowed(exercise, tierName) {
  const tier = EQUIPMENT_TIERS[tierName];
  if (!tier) return true;
  const lib = CC_EXERCISE_LIBRARY.find(e => e.name.toLowerCase() === exercise.name.toLowerCase());
  if (!lib) return true; // fallback drills — we can't check
  const eq = String(lib.equipment || '').toLowerCase();
  return tier.some(t => eq.includes(t.toLowerCase()) || t.toLowerCase().includes(eq));
}
function disciplineOk(exercise, styleKey) {
  const lib = CC_EXERCISE_LIBRARY.find(e => e.name.toLowerCase() === exercise.name.toLowerCase());
  if (!lib) return true;
  const rules = CC_RANDOMIZER_RULES[styleKey] || CC_RANDOMIZER_RULES['All-Around'];
  return lib.disciplineTags.some(t => rules.allowedTags.some(a => t.toLowerCase().includes(a.toLowerCase()) || a.toLowerCase().includes(t.toLowerCase())));
}
function difficultyOk(exercise, requested) {
  const order = ['Easy', 'Normal', 'Hard', 'Advanced'];
  const lib = CC_EXERCISE_LIBRARY.find(e => e.name.toLowerCase() === exercise.name.toLowerCase());
  if (!lib) return true;
  return Math.abs(order.indexOf(lib.difficulty) - order.indexOf(requested)) <= 1;
}

// Build the same config object the setup screen builds.
function buildConfig({ style, difficulty, equipment, focus, rounds = 5, workSec = 40, restSec = 15 }) {
  return {
    style,
    duration: Math.round((rounds * (workSec + restSec)) / 60),
    difficulty,
    equipment: EQUIP_TIER[equipment],
    format: 'Auto',
    voiceOn: true, formPreviewOn: true, cadenceCount: true,
    cadencePreset: 'moderate', cadenceMs: 2000,
    cardioAddon: null,
    rounds, workSec, restSec,
    focus,
    blend: 50,
    warmupMin: 0,
  };
}

const failures = [];
const notes = [];
let missionsRun = 0;
let missionsClean = 0;

// The randomizer rules are keyed by exact discipline strings. The
// generator normalises "Kickboxing / Muay Thai" (spaces) to
// "Kickboxing/Muay Thai" (no spaces), so we check the same normalisation
// here — every style the setup screen sends must reach a real rule.
function normalizeStyleKey(s) {
  const cleaned = String(s).replace(/\s*\/\s*/g, '/').trim().toLowerCase();
  return Object.keys(CC_RANDOMIZER_RULES).find(k => k.toLowerCase() === cleaned);
}
for (const s of STYLES) {
  const resolved = normalizeStyleKey(s);
  if (!resolved) failures.push({
    what: 'discipline key mismatch',
    style: s,
    detail: `Setup sends "${s}" but no key in CC_RANDOMIZER_RULES resolves to it. Keys: ${Object.keys(CC_RANDOMIZER_RULES).join(', ')}.`,
  });
}

// Run the cartesian product and inspect each mission.
for (const style of STYLES) {
  for (const difficulty of DIFFS) {
    for (const equipment of EQUIPS) {
      for (const focus of PRESETS) {
        missionsRun++;
        const cfg = buildConfig({ style, difficulty, equipment, focus });
        let m;
        try { m = generateCombatConditioningMission(cfg); }
        catch (e) {
          failures.push({ what: 'generator threw', style, difficulty, equipment, focus, detail: e.message });
          continue;
        }
        // §1 no duplicate drill names within a session
        const names = m.drills.map(d => d.name);
        const dupes = names.filter((n, i) => names.indexOf(n) !== i);
        if (dupes.length) {
          failures.push({ what: 'duplicate drill', style, difficulty, equipment, focus, detail: `${[...new Set(dupes)].join(', ')} in ${m.missionName}` });
        }
        // §2 equipment respected
        const oobEquip = m.drills.filter(d => !equipmentAllowed(d, EQUIP_TIER[equipment]));
        if (oobEquip.length) {
          failures.push({ what: 'equipment out of tier', style, difficulty, equipment, focus, detail: `${oobEquip.map(d => d.name).join(', ')} shouldn't be in a ${equipment} session` });
        }
        // §3 discipline respected
        const oobDisc = m.drills.filter(d => !disciplineOk(d, style));
        if (oobDisc.length) {
          failures.push({ what: 'discipline mismatch', style, difficulty, equipment, focus, detail: `${oobDisc.map(d => d.name).join(', ')} not tagged for ${style}` });
        }
        // §4 difficulty within ±1
        const oobDiff = m.drills.filter(d => !difficultyOk(d, difficulty));
        if (oobDiff.length) {
          notes.push({ what: 'difficulty gap', style, difficulty, equipment, focus, detail: `${oobDiff.map(d => d.name).join(', ')} more than one difficulty tier off ${difficulty}` });
        }
        // §5 must have at least 3 drills to be a real circuit
        if (m.drills.length < 3) {
          failures.push({ what: 'thin circuit', style, difficulty, equipment, focus, detail: `only ${m.drills.length} drills — not a real workout` });
        }
        if (!dupes.length && !oobEquip.length && !oobDisc.length && m.drills.length >= 3) missionsClean++;
      }
    }
  }
}

// §6 preset overlap: for a fixed style/difficulty/equipment, do the four
// presets produce meaningfully different sessions? If two presets return
// the same drill set, the picker's promise is fake.
const overlapReport = [];
for (const style of STYLES) {
  for (const difficulty of ['Normal', 'Hard']) {
    for (const equipment of EQUIPS) {
      const sets = {};
      for (const focus of PRESETS) {
        const cfg = buildConfig({ style, difficulty, equipment, focus });
        // Run three times per focus to average across the shuffle — a single
        // run can share drills by chance even when the profile is different.
        const combined = new Set();
        for (let i = 0; i < 3; i++) {
          const m = generateCombatConditioningMission(cfg);
          m.drills.forEach(d => combined.add(d.name));
        }
        sets[focus] = combined;
      }
      // Pairwise overlap: if two presets share > 60% of drills, we flag it.
      for (let i = 0; i < PRESETS.length; i++) {
        for (let j = i+1; j < PRESETS.length; j++) {
          const a = sets[PRESETS[i]], b = sets[PRESETS[j]];
          const inter = [...a].filter(x => b.has(x)).length;
          const union = new Set([...a, ...b]).size;
          const ratio = union ? inter/union : 0;
          if (ratio > 0.6) {
            overlapReport.push({ style, difficulty, equipment, a: PRESETS[i], b: PRESETS[j], ratio: ratio.toFixed(2), sharedCount: inter });
          }
        }
      }
    }
  }
}

console.log(`\nCombat Conditioning generator audit`);
console.log(`─────────────────────────────────────────`);
console.log(`Sessions generated: ${missionsRun}`);
console.log(`Sessions clean:     ${missionsClean}`);
console.log(`Failures:           ${failures.length}`);
console.log(`Difficulty notes:   ${notes.length}`);
console.log(`Preset overlaps:    ${overlapReport.length}`);
console.log();

const groups = {};
for (const f of failures) { (groups[f.what] = groups[f.what] || []).push(f); }
for (const key of Object.keys(groups)) {
  console.log(`━━ ${key} ━━ (${groups[key].length})`);
  const seen = new Set();
  for (const f of groups[key].slice(0, 8)) {
    const line = `  ${f.style} | ${f.difficulty} | ${f.equipment} | ${f.focus} → ${f.detail}`;
    if (seen.has(line)) continue; seen.add(line);
    console.log(line);
  }
  if (groups[key].length > 8) console.log(`  … (${groups[key].length - 8} more)`);
  console.log();
}

if (overlapReport.length) {
  console.log(`━━ preset overlap > 60% ━━`);
  for (const o of overlapReport.slice(0, 12)) {
    console.log(`  ${o.style} | ${o.difficulty} | ${o.equipment} — ${o.a} vs ${o.b} = ${o.ratio} (${o.sharedCount} shared)`);
  }
  if (overlapReport.length > 12) console.log(`  … (${overlapReport.length - 12} more)`);
  console.log();
}

process.exit(failures.length ? 1 : 0);
