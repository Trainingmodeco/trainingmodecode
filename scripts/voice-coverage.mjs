// Voice coverage: does every line the coach can say have recorded clips in
// both voice banks? A line with no clips falls back to the phone's speech
// engine, which some phones can't use, so the coach goes silent.
//
// Lines come from three places, grouped by feature:
//   1. the fixed words in every speak call of the screens that talk
//      (the text around each ${...} in a template is its own piece);
//   2. the spoken fields of the content data (exercise and move names, cues,
//      announcer intros, round titles, lesson steps...), walked generically so
//      new workouts and strikes are picked up without editing this file;
//   3. the bank inventory (scripts/voice-bank-inventory.mjs) for combos.
// Each phrase is checked with the app's own planner (whole clip, else the
// fewest pieces). Missing phrases are what to record next.
//
//   node --no-warnings --import ./scripts/extensionless-loader-register.mjs scripts/voice-coverage.mjs [--json missing.json] [--strict]
// --strict exits 1 when anything is missing (CI).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { phrasesOf } from '../components/training-mode/data/voicePhrases.js';
import { planClips } from '../components/training-mode/data/voiceClips.js';
import { spokenCall } from '../components/training-mode/data/practiceRound.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const TM = path.join(ROOT, 'components/training-mode');
const argv = process.argv.slice(2);
const opt = (k) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : null; };

const features = {};
const add = (feature, line) => {
  if (typeof line !== 'string') return;
  const t = line.replace(/\s+/g, ' ').trim();
  if (!t || !/[a-z0-9]/i.test(t)) return;
  (features[feature] = features[feature] || new Set()).add(t);
};

// ── 1. fixed words of every speak call ──────────────────────────────────────
const SCREENS = {
  'Fight Mode': ['ComboCoachActive.jsx', 'FightFocusTimer.jsx', 'PracticeRound.jsx', 'PracticeMode.jsx'],
  'Quick Mission': ['QuickMissionActive.jsx'],
  'Workout Builder': ['FitBuilderGuidedPlayer.jsx', 'FitRepCoach.jsx'],
  'Combat Conditioning': ['CombatConditioningActive.jsx'],
  'Cardio Mode': ['CardioProtocolPlayer.jsx', 'RunPlayer.jsx'],
  'Training Camp': ['CampFitRunner.jsx', 'CampFitSetRunner.jsx'],
  'Training Arcade': ['ArcadeBenchmarkPlayer.jsx', 'ArcadeCadenceRepPlayer.jsx', 'ArcadeCardioPlayer.jsx', 'ArcadeStageIntroOverlay.jsx'],
  'Warm-up and mobility': ['shared/WarmupTimer.jsx', 'shared/MobilityBlock.jsx'],
};
// Split a template's text at ${...}, keeping only the fixed words; ternary
// string branches inside ${} are fixed words too.
function fixedPieces(lit) {
  const q = lit[0], body = lit.slice(1, -1);
  if (q !== '`') return [body];
  const out = []; let depth = 0, cur = '', expr = '';
  for (let i = 0; i < body.length; i++) {
    if (depth === 0 && body[i] === '$' && body[i + 1] === '{') { out.push(cur); cur = ''; depth = 1; i++; expr = ''; continue; }
    if (depth > 0) {
      if (body[i] === '{') depth++;
      if (body[i] === '}') { depth--; if (depth === 0) { for (const m of expr.matchAll(/'([^']+)'|"([^"]+)"/g)) out.push(m[1] || m[2]); continue; } }
      expr += body[i]; continue;
    }
    cur += body[i];
  }
  out.push(cur);
  return out;
}
// Every string and template literal inside a speak call's parentheses
// (ternaries, || fallbacks and joins included).
const CALL_START = /\b(?:speakAsync|speakOrDelay|speak|say|announce)\(/g;
function callLiterals(src, at) {
  const out = []; let depth = 1, i = at;
  while (i < src.length && depth > 0) {
    const ch = src[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (ch === "'" || ch === '"' || ch === '`') {
      let j = i + 1, tdepth = 0;
      while (j < src.length) {
        if (src[j] === '\\') { j += 2; continue; }
        if (ch === '`' && src[j] === '$' && src[j + 1] === '{') { tdepth++; j += 2; continue; }
        if (ch === '`' && tdepth > 0 && src[j] === '}') { tdepth--; j++; continue; }
        if (src[j] === ch && tdepth === 0) break;
        j++;
      }
      // Skip code labels: a literal compared with ===/!==, or the argument of
      // a nested function call (getCoachCopy('sessionStart')).
      const before = src.slice(Math.max(0, i - 40), i).replace(/\s+$/, '');
      const label = /[!=]==?$/.test(before) || (depth > 1 && /[A-Za-z0-9_$]\($/.test(before));
      if (!label) out.push(src.slice(i, j + 1));
      i = j;
    }
    i++;
  }
  return out;
}
for (const [feature, files] of Object.entries(SCREENS)) {
  for (const f of files) {
    const src = fs.readFileSync(path.join(TM, f), 'utf8');
    for (const m of src.matchAll(CALL_START)) for (const lit of callLiterals(src, m.index + m[0].length)) for (const piece of fixedPieces(lit)) add(feature, piece);
  }
}

// ── 2. spoken fields of the content data ───────────────────────────────────
function walk(o, keys, out, depth = 0) {
  if (depth > 12 || o == null) return;
  if (Array.isArray(o)) { o.forEach((v) => walk(v, keys, out, depth + 1)); return; }
  if (typeof o !== 'object') return;
  for (const [k, v] of Object.entries(o)) {
    if (keys.has(k)) {
      if (typeof v === 'string') out.push(v);
      else if (Array.isArray(v)) v.forEach((x) => typeof x === 'string' && out.push(x));
      else if (v && typeof v === 'object' && k === 'sample_lines') Object.values(v).forEach((x) => typeof x === 'string' && out.push(x));
    }
    if (v && typeof v === 'object') walk(v, keys, out, depth + 1);
  }
}
const fromData = (feature, data, keys) => { const out = []; walk(data, new Set(keys), out); out.forEach((l) => add(feature, l)); };
const jsonFiles = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? jsonFiles(path.join(dir, e.name)) : e.name.endsWith('.json') ? [path.join(dir, e.name)] : []);
const quoted = (rel, re) => [...fs.readFileSync(path.join(TM, rel), 'utf8').matchAll(re)].map((m) => m[1]);

// Objects that are a thing the athlete does (have a dose): their name is said.
const DOSE = ['reps', 'sets', 'duration_sec', 'work_sec', 'rest_sec', 'seconds', 'workSeconds', 'target', 'dose'];
function doseNames(o, out, depth = 0) {
  if (depth > 14 || o == null || typeof o !== 'object') return;
  if (Array.isArray(o)) { o.forEach((v) => doseNames(v, out, depth + 1)); return; }
  const isTask = DOSE.some((k) => k in o) || o.type === 'benchmark';
  for (const k of ['name', 'title', 'movement']) if (isTask && typeof o[k] === 'string') out.push(o[k]);
  for (const v of Object.values(o)) if (v && typeof v === 'object') doseNames(v, out, depth + 1);
}
const fromDoses = (feature, data) => { const out = []; doseNames(data, out); out.forEach((l) => add(feature, l)); };

const arcade = await import('../components/training-mode/data/trainingArcadeData.js');
fromData('Training Arcade', arcade.TRAINING_ARCADE_SERIES, ['announcerIntro']);
fromDoses('Training Arcade', arcade.TRAINING_ARCADE_SERIES);

for (const f of jsonFiles(path.join(TM, 'protocol/data'))) {
  const data = JSON.parse(fs.readFileSync(f, 'utf8'));
  if (f.endsWith('voice-packs.json')) { fromData('Training Camp', data, ['sample_lines']); continue; }
  fromData('Training Camp', data, ['round_title', 'coach_prompt', 'announcer']);
  fromDoses('Training Camp', data);
}

const moves = await import('../components/training-mode/data/missionMoves.js');
fromData('Quick Mission', moves.MOVES, ['name', 'say']);
const missions = await import('../components/training-mode/data/loadoutMissions.js');
fromData('Quick Mission', missions.LOADOUT_MISSIONS, ['introSay', 'safety', 'say', 'capSay', 'doneSay']);
const named = await import('../components/training-mode/data/namedWorkouts.js');
fromData('Quick Mission', named.NAMED_WORKOUTS, ['introSay', 'say', 'name']);

for (const rel of ['fit-mode/fitModeExerciseData.js', 'fit-mode/combatConditioningData.js']) {
  for (const n of quoted(rel, /\bname:\s*'([^']+)'/g)) { add('Workout Builder', n); add('Combat Conditioning', n); }
}
fromData('Workout Builder', { q: quoted('FitBuilderGuidedPlayer.jsx', /^\s*'([^']{12,})',?\s*$/gm) }, ['q']);

const intervals = await import('../components/training-mode/data/intervalPrograms.js');
fromData('Cardio Mode', intervals.PROGRAMS, ['move', 'cue', 'say', 'pre', 'start']);

const practice = await import('../components/training-mode/practiceData.js');
for (const t of practice.TECHNIQUES) (t.cues || []).forEach((c, i) => add('Fight Mode', `${i + 1}. ${c}`));
const lessonsSrc = fs.readFileSync(path.join(TM, 'data/practiceLessons.js'), 'utf8');
for (const m of lessonsSrc.matchAll(/steps:\s*\[([^\]]+)\]/g)) [...m[1].matchAll(/'([^']+)'/g)].forEach((s, i) => add('Fight Mode', `${i + 1}. ${s[1]}`));
for (const m of lessonsSrc.matchAll(/calls:\s*\[([^\]]+)\]/g)) [...m[1].matchAll(/'([^']+)'/g)].forEach((s) => add('Fight Mode', spokenCall(s[1])));

for (const n of quoted('shared/MobilityBlock.jsx', /\bname:\s*'([^']+)'/g)) add('Warm-up and mobility', n);
for (const n of quoted('shared/MobilityBlock.jsx', /\bcue:\s*'([^']+)'/g)) add('Warm-up and mobility', n);

// ── 3. the bank inventory (combos, rush, fight focus, coach copy) ──────────
{
  const tmp = path.join(ROOT, 'node_modules/.cache/voice-inventory.json');
  fs.mkdirSync(path.dirname(tmp), { recursive: true });
  const { execFileSync } = await import('node:child_process');
  execFileSync(process.execPath, ['--no-warnings', '--import', './scripts/extensionless-loader-register.mjs', 'scripts/voice-bank-inventory.mjs', '--json', tmp], { cwd: ROOT, stdio: 'ignore' });
  for (const p of JSON.parse(fs.readFileSync(tmp, 'utf8')).phrases) add('Fight Mode', p);
}

// ── check ───────────────────────────────────────────────────────────────────
const banks = Object.fromEntries(['female', 'male'].map((v) => [v, JSON.parse(fs.readFileSync(path.join(ROOT, 'public/voice', v, 'manifest.json'), 'utf8'))]));
const missing = {};
const rows = [];
for (const [feature, lines] of Object.entries(features)) {
  const phrases = new Set();
  for (const l of lines) for (const p of phrasesOf(l)) phrases.add(p.text);
  const row = { feature, phrases: phrases.size };
  for (const v of ['female', 'male']) {
    const miss = [...phrases].filter((p) => !planClips(banks[v], p));
    row[v] = miss.length;
    for (const p of miss) (missing[p] = missing[p] || new Set()).add(v);
  }
  rows.push(row);
}
const pct = (r, v) => `${(100 * (r.phrases - r[v]) / Math.max(1, r.phrases)).toFixed(1)}%`;
console.log('Feature'.padEnd(24), 'Phrases'.padStart(8), 'Female'.padStart(8), 'Male'.padStart(8), '  (share covered)');
for (const r of rows) console.log(r.feature.padEnd(24), String(r.phrases).padStart(8), pct(r, 'female').padStart(8), pct(r, 'male').padStart(8));
const list = Object.entries(missing).map(([p, vs]) => ({ phrase: p, voices: [...vs].sort() })).sort((a, b) => a.phrase.localeCompare(b.phrase));
console.log(`\nmissing phrases: ${list.length} (female ${list.filter((m) => m.voices.includes('female')).length}, male ${list.filter((m) => m.voices.includes('male')).length})`);
const out = opt('json');
if (out) fs.writeFileSync(out, JSON.stringify(list, null, 1));
if (argv.includes('--strict') && list.length) process.exit(1);
