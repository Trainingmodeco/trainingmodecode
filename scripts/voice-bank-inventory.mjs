// Every fixed phrase the coach can say, cut the way the recorded voice bank
// stores it (data/voicePhrases.js), grouped by where it comes from. Used to
// build public/voice/<voice>/ (the clips are generated from these lists) and
// to tell which lines a bank covers.
//
//   node --no-warnings --import ./scripts/extensionless-loader-register.mjs scripts/voice-bank-inventory.mjs [--json out.json] [--set fight|fit|all]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { phrasesOf, tokensOf } from '../components/training-mode/data/voicePhrases.js';
import FIGHT_FOCUS_POOL from '../components/training-mode/data/fightFocusData.js';
import COMBO_POOL, { SINGLE_STRIKES, ADVANCED_STRIKES } from '../components/training-mode/data/comboCoachData.js';
import { formatCall } from '../components/training-mode/data/strikeNumbering.js';
import { MULTI_ANNOUNCE, SWITCH_CALLS } from '../components/training-mode/data/multiOpponent.js';
import { RUSH_ACTIVATION, RUSH_COMPLETE, createRushVoice } from '../components/training-mode/data/rushVoice.js';
import { createRushCaller, RUSH_MIXES } from '../components/training-mode/data/rushMoves.js';
import { WARMUP_SUGGESTIONS } from '../components/training-mode/data/warmupSuggestions.js';
import packsJson from '../components/training-mode/protocol/data/voice-packs.json' with { type: 'json' };

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const SET = opt('set', 'all');

// Quoted strings out of a source file (coachCopy keeps its lines in a private object).
const quoted = (rel, re) => [...fs.readFileSync(path.join(ROOT, rel), 'utf8').matchAll(re)].map((m) => m[1]);

const cats = {};
const add = (cat, line) => {
  if (line === undefined || line === null || line === '') return;
  const bag = (cats[cat] = cats[cat] || new Set());
  for (const p of phrasesOf(line)) bag.add(p.text);
};
const addWhole = (cat, phrase) => { (cats[cat] = cats[cat] || new Set()).add(String(phrase).toLowerCase().trim()); };

// ── Shared: count-in, rounds, numbers, units ────────────────────────────────
['3', '2', '1', 'Go!', 'Rest.', 'Halfway.', 'Time.', 'Ready.', 'Begin.', 'Paused.', 'Resume. Go!', 'Still going?', 'Up next:', 'Free flow', 'Finisher.', 'Complete. Great work.'].forEach((l) => add('shared', l));
for (let n = 1; n <= 12; n++) add('shared', `Round ${n}.`);
for (let n = 0; n <= 100; n++) addWhole('numbers', String(n));
['plus', 'x p', 'seconds', 'minutes', 'minute', 'reps', 'rounds', 'set', 'of', 'complete', 'to go', 'left'].forEach((w) => addWhole('shared', w));

// ── Fight Focus ─────────────────────────────────────────────────────────────
for (const r of FIGHT_FOCUS_POOL) { add('fightfocus', r.title); add('fightfocus', r.coachingCue); }
add('fightfocus', 'Clean round. Plus five.');
add('fightfocus', 'Rush held.');
['Ghost defeated.', 'The ghost takes this one. Run it back.', 'Dead heat. A draw.'].forEach((l) => add('fightfocus', l));
// Warm-up
add('warmup', 'Warm up.'); add('warmup', 'Stretch and get loose.'); add('warmup', 'Halfway through the warm up. Keep moving.'); add('warmup', 'Warm up complete. Here we go.'); add('warmup', 'Warm up. 5 minutes, at your own pace.');
for (const s of WARMUP_SUGGESTIONS) { add('warmup', s.say); add('warmup', s.label); }

// ── Combo Coach ─────────────────────────────────────────────────────────────
['Boxing', 'Kickboxing', 'Muay Thai', 'MMA'].forEach((d) => add('combo', d));
for (let ms = 750; ms <= 4000; ms += 250) add('combo', `${ms / 1000} second cadence`);
['slow', 'moderate', 'fast', 'medium', 'custom'].forEach((s) => add('combo', `${s} speed`));
add('combo', MULTI_ANNOUNCE);
add('combo', 'Rest. Up next: multiple opponents.');
for (const s of SWITCH_CALLS) add('combo', s.speech);
const comboTexts = new Set(COMBO_POOL.map((c) => c.comboText));
for (const list of [...Object.values(SINGLE_STRIKES), ...Object.values(ADVANCED_STRIKES)]) list.forEach((s) => comboTexts.add(s));
for (const t of comboTexts) { add('strikes', formatCall(t, 'names').speech); add('strikes-numbers', formatCall(t, 'numbers').speech); }

// ── Rush ────────────────────────────────────────────────────────────────────
add('rush', RUSH_ACTIVATION); add('rush', RUSH_COMPLETE);
{ const v = createRushVoice(); for (let i = 0; i < 40; i++) add('rush', v.nextLine()); }
for (const mix of RUSH_MIXES) {
  for (const d of ['boxing', 'kickboxing', 'muay-thai', 'mma']) {
    const caller = createRushCaller({ mix: mix.id || mix, discipline: d, strikePool: COMBO_POOL.filter((c) => c.discipline === d).map((c) => c.comboText) });
    for (let i = 0; i < 400; i++) add('rush', caller.nextLine());
  }
}
add('rush', 'Super!');

// ── Closing lines, coach copy, voice packs, encouragement ───────────────────
for (const l of quoted('components/training-mode/data/coachCopy.js', /:\s*['"`]([^'"`]+)['"`]/g)) add('copy', l);
for (const p of packsJson.packs || []) for (const l of Object.values(p.sample_lines || {})) add('packs', l);
for (const l of quoted('components/training-mode/data/coachEncouragement.js', /text:\s*['"`]([^'"`]+)['"`]/g)) add('quotes', l);

// ── Fit (phase 2: exercise names and the Quick Mission lines) ───────────────
if (SET !== 'fight') {
  for (const rel of ['components/training-mode/fit-mode/fitModeExerciseData.js', 'components/training-mode/fit-mode/combatConditioningData.js', 'components/training-mode/data/combatConditioningData.js']) {
    if (fs.existsSync(path.join(ROOT, rel))) for (const n of quoted(rel, /\bname:\s*['"`]([^'"`]+)['"`]/g)) add('exercises', n);
  }
  ['Quick mission started.', 'On my count.', 'Ready?', 'Get ready.', '10 seconds. Get ready.', 'Switch.', 'Work.', 'Hold.', 'Last one.', 'Done.', 'Mission complete.', 'Good work.', 'Combat conditioning started.', 'Shadowboxing with light dumbbells.'].forEach((l) => add('fit', l));
}

// ── Report ──────────────────────────────────────────────────────────────────
const all = new Set();
const out = {};
for (const [cat, set] of Object.entries(cats)) { out[cat] = [...set].sort(); for (const p of set) all.add(p); }
// Phrases with digits that have no whole clip will be said from parts: make sure the parts exist.
const parts = new Set();
for (const p of all) if (/\d/.test(p) && !/^\d+(\.\d+)?$/.test(p)) for (const t of tokensOf(p)) if (!all.has(t)) parts.add(t);
out.parts = [...parts].sort();
for (const p of parts) all.add(p);
const list = [...all].sort();
const summary = Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.length]));
console.log(JSON.stringify({ total: list.length, ...summary }, null, 1));
const json = opt('json', null);
if (json) fs.writeFileSync(json, JSON.stringify({ set: SET, total: list.length, phrases: list, byCategory: out }, null, 1));
