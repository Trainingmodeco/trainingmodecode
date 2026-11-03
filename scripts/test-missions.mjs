// Quick Mission v2: the gate, the move catalog, the 11 launch missions, the
// 15 SOLO-only missions (12-26), the owner's three (27-29), the shelf, swaps
// and safety, the voice and timing helpers, integrity sizing (ungated fix a),
// SOLO maths, the until-the-bell-is-down end, shelf prefs and the tape line.
// Run with `npm run test:missions`.
import { isDeepStrictEqual } from 'node:util';
import { createHash } from 'node:crypto';

const store = new Map();
const memStore = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k),
};
globalThis.localStorage = memStore;
const G = await import('../components/training-mode/data/qmV2.js');
const M = await import('../components/training-mode/data/missionMoves.js');
const L = await import('../components/training-mode/data/loadoutMissions.js');
const S = await import('../components/training-mode/data/missionSolo.js');
const N = await import('../components/training-mode/data/namedWorkouts.js');
const T = await import('../components/training-mode/data/tapes.js');
const I = await import('../components/training-mode/utils/missionIntegrity.js');
const O = await import('../components/training-mode/shared/sessionOutcome.js');
const US = await import('../components/training-mode/data/userStats.js');

let pass = 0, fail = 0;
const check = (name, cond, extra = '') => { if (cond) { pass++; console.log(`  ok   ${name}`); } else { fail++; console.log(`  FAIL ${name}  ${extra}`); } };
const reset = () => store.clear();
const eq = isDeepStrictEqual;
const show = (v) => JSON.stringify(v);
const build = (id, opts) => L.buildLoadoutMission(id, opts);
const LEVELS = ['beginner', 'standard', 'elite'];
const items = (m) => m.exercises.flatMap(sl => (Array.isArray(sl.list) ? sl.list : [sl]));
const keyItems = (m, key) => items(m).filter(it => it.swapKey === key);
const doses = (m) => L.cardRows(m).map(r => r.dose);
const ctxFor = (m, round, idx) => ({ round, idx, rounds: m.rounds, slotsPerRound: m.exercises.length, format: m.format });

// ── gate ────────────────────────────────────────────────────────────────────
reset();
check('1 gate follows QM_V2_FOR_EVERYONE without the owner flag', G.qmV2Enabled() === G.QM_V2_FOR_EVERYONE);
store.set('tm_owner_preview', '1');
check('2 owner preview turns it on', G.qmV2Enabled() === true);
reset();

// ── catalog ─────────────────────────────────────────────────────────────────
const PATTERNS = ['hinge', 'squat', 'lunge', 'push', 'pull', 'press', 'clean', 'sprawl', 'burpee', 'punch', 'kick', 'knee', 'core', 'cardio'];
const ids = M.MOVES.map(m => m.id);
check('3 152 unique move ids', M.MOVES.length === 152 && new Set(ids).size === 152, `${M.MOVES.length}`);
const badField = M.MOVES.filter(m => {
  const cadOk = m.cadence === null || (['elite', 'standard', 'beginner'].every(l => Number.isInteger(m.cadence[l]) && m.cadence[l] >= 500 && m.cadence[l] <= 6000) && Object.keys(m.cadence).length === 3);
  const manual = m.cadence === null && (m.unit === 'reps' || m.unit === 'cal');
  return !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(m.id) || !m.name || !m.say || !PATTERNS.includes(m.pattern) || !M.GEAR_TAGS.includes(m.gear)
    || !['reps', 'secs', 'cal', 'm'].includes(m.unit) || !cadOk
    || (m.timedOnly && !(m.cadence === null && m.unit === 'secs'))
    || (manual && !m.estMs)
    || !Array.isArray(m.cues) || m.cues.length < 2 || m.cues.length > 4 || m.cues.some(c => !c || c.length > 140)
    || !Array.isArray(m.alts) || m.alts.length < 1 || m.alts.length > 4 || m.alts.some(a => !M.ALT_KINDS.includes(a.kind))
    || (m.sides && !['switch', 'alternate'].includes(m.sides))
    || (m.sides === 'switch' && !(typeof m.switchMs === 'number' && m.switchMs >= 1000 && m.switchMs <= 5000));
});
check('3 every catalog field is valid', badField.length === 0, badField.map(m => m.id).join(', '));
const badAlt = M.MOVES.flatMap(m => m.alts.filter(a => !M.moveById(a.id) || a.id === m.id).map(a => `${m.id}→${a.id}`));
check('4 every alt exists and none points to itself', badAlt.length === 0, badAlt.join(', '));
const STOPS = [
  ['hindu-squat', 'heels-down-hindu-squat', 'Knee pain?'],
  ['dive-bomber', 'knee-dive-bomber', 'Shoulder pinch or low-back pain?'],
  ['hindu-push-up', 'knee-hindu-push-up', 'Shoulder pinch or low-back pain?'],
  ['sprawl', 'level-change-drop', 'Wrist pain?'],
  ['switch-kick', 'alt-low-kick', 'Hamstring or groin twinge?'],
  ['windshield-wiper-punches', 'half-arc-wiper-punches', 'Shoulder pinch?'],
  ['bb-back-squat', 'bb-front-rack-lunge', 'Sore shoulders?'],
];
check('5 stop-rule pairs with their labels', STOPS.every(([from, to, label]) => M.moveById(from)?.alts.some(a => a.id === to && a.stop === label)));
const wiper = M.moveById('windshield-wiper-punches');
check('6 required moves exist', ['lunge-to-teep', 'windshield-wiper-punches', 'switch-kick', 'hindu-squat', 'hindu-push-up', 'dive-bomber', 'sprawl', 'one-two', 'burpee'].every(id => M.moveById(id))
  && wiper.timedOnly === true && wiper.cadence === null);
const cueHas = (id, s) => M.moveById(id).cues.some(c => c.includes(s));
check('7 cue text: Hindu push-up, dive bomber, wipers', cueHas('hindu-push-up', 'straight back') && cueHas('dive-bomber', 'reverse the same path') && cueHas('windshield-wiper-punches', 'one pass every 2 seconds'));

// ── missions ────────────────────────────────────────────────────────────────
const IDS = ['iron_clock_16', 'one_bell_300', 'five_round_bout', 'best_of_3', 'steel_plating', 'checkpoint_20', 'room_12', 'hit_combo_21', 'tutorial_stage', 'turbo_button', 'quota_300'];
const TITLES = ['IRON CLOCK 16', 'ONE-BELL 300', 'FIVE ROUND BOUT', 'BEST OF 3', 'STEEL PLATING', 'CHECKPOINT 20', 'ROOM 12', '21-HIT COMBO', 'TUTORIAL STAGE', 'TURBO BUTTON', 'QUOTA 300'];
// 12-26: the researched barbell, bell and mixed missions, SOLO only for now.
const SOLO_IDS = ['honor_rounds', 'ko_sprint_30', 'overhead_rush', 'burnout_21', 'stance_breaker_9', 'rookie_round_8',
  'first_bell', 'continue_bell', 'carry_on_15', 'surge_20_10', 'midline_lock', 'leg_sweep', 'charge_up_12', 'oxygen_debt', 'hot_laps'];
const SOLO_TITLES = ['HONOR ROUNDS', 'KO SPRINT 30', 'OVERHEAD RUSH', 'BURNOUT 21', 'STANCE BREAKER 9', 'ROOKIE ROUND 8',
  'FIRST BELL', 'CONTINUE? · BELL', 'CARRY-ON 15', 'SURGE 20/10', 'MIDLINE LOCK', 'LEG SWEEP', 'CHARGE UP 12', 'OXYGEN DEBT', 'HOT LAPS'];
// 27-29: the owner's own workouts, GUIDED and SOLO.
const OWN_IDS = ['bar_fight', 'touch_the_sky', 'no_continues'];
const OWN_TITLES = ['BAR FIGHT', 'TOUCH THE SKY', 'NO CONTINUES'];
const ALL_IDS = [...IDS, ...SOLO_IDS, ...OWN_IDS];
check('8 29 defs, ids and titles in launch order', eq(L.LOADOUT_MISSIONS.map(d => d.id), ALL_IDS) && eq(L.LOADOUT_MISSIONS.map(d => d.title), [...TITLES, ...SOLO_TITLES, ...OWN_TITLES])
  && L.LOADOUT_MISSIONS.every((d, i) => d.launch === i + 1));
const soloOnlyDef = (id) => id === 'hit_combo_21' || SOLO_IDS.includes(id);
check('8 only 21-HIT and 12-26 are SOLO only; guided help everywhere else', L.LOADOUT_MISSIONS.every(d => (soloOnlyDef(d.id) ? d.guided === false && d.guidedHelp === '' && d.introSay === '' : d.guided === true && d.guidedHelp.length > 0))
  && ['five_round_bout', 'best_of_3', 'room_12'].every(id => L.missionDefById(id).guidedHelp === L.GUIDED_HELP_AMRAP));

const RULE_KIND = { forTime: 'time', amrap: 'roundsReps', emom: 'minutesHeld', intervals: 'reps' };
const paceOk = (format, p) => LEVELS.every(l => (format === 'emom'
  ? p[l] && typeof p[l].held === 'number' && typeof p[l].of === 'number' && (p[l].setSec === null || typeof p[l].setSec === 'number')
  : typeof p[l] === 'number'));
reset();
const built = {};
const problems = [];
for (const id of IDS) {
  built[id] = {};
  for (const lv of LEVELS) {
    const m = build(id, { level: lv });
    built[id][lv] = m;
    const tag = `${id}/${lv}`;
    if (!m) { problems.push(`${tag} null`); continue; }
    const its = items(m);
    if (its.some(it => !M.moveById(it.moveId))) problems.push(`${tag} unknown move`);
    const baseByKey = {};
    its.forEach(it => { if (baseByKey[it.swapKey] && baseByKey[it.swapKey] !== it.baseMoveId) problems.push(`${tag} key ${it.swapKey} two bases`); baseByKey[it.swapKey] = it.baseMoveId; });
    if (its.some(it => it.defaultMoveId !== it.baseMoveId) || m.scaled !== false) problems.push(`${tag} not at base with no gear set`);
    if (m.exercises.some(sl => !Array.isArray(sl.list) && !('cadenceMs' in sl))) problems.push(`${tag} slot missing cadenceMs`);
    if (m.exercises.some(sl => sl.window != null && sl.window !== 60)) problems.push(`${tag} window`);
    if (m.exercises.some(sl => Array.isArray(sl.list) && sl.mode === 'reps' && sl.list.some(st => 'sides' in st))) problems.push(`${tag} complex step has sides`);
    if (!eq(JSON.parse(JSON.stringify(m)), m)) problems.push(`${tag} JSON round-trip`);
    if (!paceOk(m.format, m.pace)) problems.push(`${tag} pace types`);
    if (m.scoreRule.kind !== RULE_KIND[m.format]) problems.push(`${tag} scoreRule`);
    if (m.format === 'forTime' && !(m.capSec > 0)) problems.push(`${tag} capSec`);
  }
}
check('9 every mission × level builds clean', problems.length === 0, problems.join('; '));

const CLOCKS = {
  iron_clock_16: [960, 720, 960], one_bell_300: [1800, 1200, 1800], five_round_bout: [1140, 660, 1140], best_of_3: [660, 480, 660],
  steel_plating: [1200, 600, 1200], checkpoint_20: [1200, 720, 1440], room_12: [720, 600, 720], hit_combo_21: [900, 600, 900],
  tutorial_stage: [480, 450, 660], turbo_button: [520, 510, 520], quota_300: [900, 900, 1800],
};
const XP = {
  iron_clock_16: [270, 210, 270], one_bell_300: [480, 300, 480], five_round_bout: [105, 75, 105], best_of_3: [75, 75, 75],
  steel_plating: [330, 180, 330], checkpoint_20: [330, 210, 390], room_12: [45, 45, 45], hit_combo_21: [45, 45, 45],
  tutorial_stage: [210, 210, 300], turbo_button: [270, 270, 270], quota_300: [255, 255, 480],
};
const ORDER = ['standard', 'beginner', 'elite'];
const clockBad = [];
const xpBad = [];
IDS.forEach(id => ORDER.forEach((lv, i) => {
  const m = built[id][lv];
  if (m.clockSec !== CLOCKS[id][i] || S.missionClockSec(m) !== CLOCKS[id][i]) clockBad.push(`${id}/${lv} ${m.clockSec}`);
  if (S.fullRunXp(m) !== XP[id][i]) xpBad.push(`${id}/${lv} ${S.fullRunXp(m)}`);
}));
check('10 clocks for every mission × level', clockBad.length === 0, clockBad.join(', '));
check('10 full-run XP for every mission × level', xpBad.length === 0, xpBad.join(', '));
check('10 STEEL ELITE is 20 slots', S.totalSlots(built.steel_plating.elite) === 20);

const repsTotal = (m) => m.exercises.reduce((n, sl) => n + (sl.reps || 0), 0) * m.rounds;
check('11 one_bell_300 totals 300 / 180', repsTotal(built.one_bell_300.standard) === 300 && repsTotal(built.one_bell_300.beginner) === 180);
check('11 quota_300 totals 90 / 150 / 300', repsTotal(built.quota_300.beginner) === 90 && repsTotal(built.quota_300.standard) === 150 && repsTotal(built.quota_300.elite) === 300);
check('11 quota beginner counts burpees at 4 s', built.quota_300.beginner.exercises[0].cadenceMs === 4000);
const tutCad = (lv, key) => keyItems(built.tutorial_stage[lv], key)[0].cadenceMs;
check('11 tutorial standard cadences', tutCad('standard', 'teep') === 3000 && tutCad('standard', 'one-two') === 1000 && tutCad('standard', 'sprawl') === 3000 && tutCad('standard', 'hindu-squat') === 2500);
check('11 tutorial elite cadences and the burnout', tutCad('elite', 'sprawl') === 2500 && tutCad('elite', 'hindu-squat') === 2000
  && built.tutorial_stage.elite.exercises[5].count === false && built.tutorial_stage.elite.exercises[5].name === 'One-Two Burnout');
const steelSum = (m) => m.exercises[0].list.reduce((n, st) => n + st.reps * st.cadenceMs, 0);
// Spec test 11 reads `pace.standard.setSec`, but 7.1 says each level's Σ matches the setSec of its OWN tier.
check('11 steel complex counts 12 / 15 / 18 s, each level matching its own tier',
  steelSum(built.steel_plating.elite) === 12000 && steelSum(built.steel_plating.standard) === 15000 && steelSum(built.steel_plating.beginner) === 18000
  && LEVELS.every(lv => built.steel_plating[lv].pace[lv].setSec === steelSum(built.steel_plating[lv]) / 1000));

const BANNED = ['Chief', 'Navy Seal', 'CrossFit', 'Tabata', 'Ten Count', 'Street Fighter', 'Dragon Ball', 'Dan John', 'Armor Building', 'Pendlay'];
const knownAs = L.LOADOUT_MISSIONS.map(d => d.knownAs).filter(Boolean);
const strings = [];
const walk = (v, key) => {
  if (key === 'knownAs') return;
  if (typeof v === 'string') strings.push(v);
  else if (Array.isArray(v)) v.forEach(x => walk(x));
  else if (v && typeof v === 'object') Object.entries(v).forEach(([k, x]) => walk(x, k));
};
IDS.forEach(id => LEVELS.forEach(lv => walk(built[id][lv])));
M.MOVES.forEach(m => { strings.push(m.name, m.say, ...(m.say1 ? [m.say1] : []), ...m.cues, ...m.alts.filter(a => a.stop).map(a => a.stop)); });
const banned = strings.filter(s => BANNED.some(b => (b === 'Chief' ? /\bchief\b/i.test(s) : s.toLowerCase().includes(b.toLowerCase())))
  || knownAs.some(k => s.includes(k)));
check('12 no franchise or person names in user text', banned.length === 0, banned.join(' | '));

check('13 level overrides', built.steel_plating.elite.loadoutLine.startsWith('2 KETTLEBELLS')
  && eq(LEVELS.map(lv => built.quota_300[lv].difficulty), ['Hard', 'Hard', 'Brutal'])
  && built.tutorial_stage.elite.difficulty === 'Normal'
  && built.hit_combo_21.beginner.excludeAlts.includes('bb-back-squat'));
check('14 card copy: eyebrow, AMRAP names, no tape mention', IDS.every(id => L.missionCardModel(built[id].standard).eyebrow.startsWith('Mission · '))
  && IDS.every(id => LEVELS.every(lv => built[id][lv].exercises.every(sl => !(Array.isArray(sl.list) && sl.mode === 'timed') || sl.name === 'AMRAP')))
  && L.LOADOUT_MISSIONS.every(d => !/tape/i.test(d.note)));

// ── shelf ───────────────────────────────────────────────────────────────────
const shelf = L.shelfEntries();
check('15 shelf: 46 entries, v2 first', shelf.length === 46 && shelf.slice(0, 29).every(e => e.kind === 'v2') && shelf.slice(29).every(e => e.kind === 'classic')
  && eq(shelf.slice(0, 29).map(e => e.id), ALL_IDS)
  && shelf.slice(0, 29).every(e => e.soloOnly === soloOnlyDef(e.id)));
const loCount = (lo) => L.filterShelf(shelf, { loadout: lo }).length;
check('16 loadout counts', loCount('none') === 18 && loCount('bell') === 11 && loCount('barbell') === 10 && loCount('mixed') === 7,
  ['none', 'bell', 'barbell', 'mixed'].map(loCount).join('/'));
const tAll = L.themeCounts(shelf, 'all');
check('17 theme counts', tAll.all === 46 && tAll.striking === 10 && tAll.burpees === 5 && tAll.century === 3
  && L.themeCounts(shelf, 'barbell').striking === 1 && L.themeCounts(shelf, 'bell').striking === 1
  && L.themeCounts(shelf, 'barbell').burpees === 2 && L.themeCounts(shelf, 'bell').burpees === 1, show(tAll));
const empty = L.emptyShelfCopy({ loadout: 'barbell', theme: 'striking' });
check('18 empty shelf copy', empty.text === 'No striking missions for BARBELL yet.' && empty.action?.label === 'SHOW NO GEAR' && empty.action?.loadout === 'none');
const TAGS = {
  murph: ['mixed', ['century']], half_murph: ['mixed', ['century']],
  sally_squats: ['none', []], sally_pushups: ['none', []], deadly_seven: ['none', []], hell_general: ['none', []],
  hell_mma: ['none', ['striking']], strike_fitness_easy: ['none', ['striking']], strike_fitness_mid: ['none', ['striking']], strike_fitness_adv: ['none', ['striking']],
  pushup_division: ['none', []], abs_3_level: ['none', []], fitness_test: ['none', []], burpee_hell: ['none', ['burpees']],
  legendary_squat: ['none', ['century']], hero_training: ['mixed', []], chaos_engine: ['mixed', []],
};
const LOS = L.LOADOUTS.map(l => l.id);
const THS = L.THEMES.map(t => t.id);
check('19 every classic has a valid loadout and themes', N.NAMED_WORKOUTS.length === 17 && N.NAMED_WORKOUTS.every(w => LOS.includes(w.loadout) && w.loadout !== 'all'
  && Array.isArray(w.themes) && w.themes.every(t => THS.includes(t) && t !== 'all')));
check('19 back-tags hold (and CLASSIC_TAGS covers all 17)', Object.entries(TAGS).every(([id, [lo, th]]) => {
  const w = N.namedWorkoutById(id);
  return w && w.loadout === lo && eq(w.themes, th) && eq(N.CLASSIC_TAGS[id], { loadout: lo, themes: th });
}) && Object.keys(N.CLASSIC_TAGS).length === 17);
check('19 every classic still builds; chaos engine is weighted', N.NAMED_WORKOUTS.every(w => {
  const m = N.buildNamedMission(w.id);
  return m && m.exercises.length > 0 && m.format === 'Auto' && m.named === w.id;
}) && N.buildNamedMission('chaos_engine').workoutType === 'Weighted');
check('19 classicMeta', eq(L.classicMeta(N.namedWorkoutById('hell_mma')), { loadout: 'none', loadoutLabel: 'NO GEAR', themes: ['striking'], accentTag: 'STRIKING' })
  && L.classicMeta(N.namedWorkoutById('murph')).loadoutLabel === 'MIXED');
// The Mission Library's row line: minutes (at the default level), loadout,
// then how it runs. A classic's tag (Training Mode, Day Zero) is not a format.
const FORMATS = new Set([...Object.values(L.FORMAT_LABEL), 'FOR TIME', 'CHALLENGE', 'ROUNDS', 'NON-STOP', 'INTERVALS', 'CIRCUIT', 'TEST']);
const rowLines = shelf.map(e => L.shelfEntryLine(e));
check('19 library rows: minutes · loadout · format', rowLines.every(l => { const p = l.split(' · '); return p.length === 3 && /^~\d+ MIN$/.test(p[0]) && FORMATS.has(p[2]); })
  && L.shelfEntryLine(shelf[0]) === '~16 MIN · BARBELL · EMOM' && L.shelfEntryLine({ kind: 'classic', id: 'murph', loadout: 'mixed' }) === '~55 MIN · MIXED · FOR TIME',
  rowLines.filter(l => !FORMATS.has(l.split(' · ')[2])).join(' | '));

// ── swaps ───────────────────────────────────────────────────────────────────
reset();
check('20 gear: never set → no gear', eq([...L.gearProfile()], ['none']));
const turboStd = build('turbo_button');
const wiperIds = () => L.swapOptions(turboStd, 'wipers').map(o => o.id);
const noBag1 = !wiperIds().includes('bag-speed-punches');
store.set('tm_equipment', '[]');
const noBag2 = eq([...L.gearProfile()], ['none']) && !wiperIds().includes('bag-speed-punches');
store.set('tm_equipment', '["HEAVY_BAG"]');
const bag3 = eq(new Set(L.gearProfile()), new Set(['none', 'bag'])) && wiperIds().includes('bag-speed-punches');
check('20 gear: [] → no gear; HEAVY_BAG → bag; wiper swaps follow it', noBag1 && noBag2 && bag3);
reset();

const sprawlOpts = L.swapOptions(turboStd, 'sprawl');
check('21 TURBO sprawl options: ≤ 4, known labels, stop rule first', sprawlOpts.length > 0 && sprawlOpts.length <= 4
  && sprawlOpts.every(o => Object.values(M.ALT_LABEL).includes(o.label) && o.label === M.ALT_LABEL[o.kind])
  && sprawlOpts[0].id === 'level-change-drop' && sprawlOpts[0].stop === 'Wrist pain?', show(sprawlOpts.map(o => o.id)));

const quota = build('quota_300');
const quotaSb = L.swapMissionMove(quota, 'burpee', 'step-back-burpee');
check('22 QUOTA → step-back burpees: 10 reps, scaled, one entry, same slots', quotaSb.exercises[0].reps === 10 && quotaSb.scaled === true
  && quotaSb.swaps.length === 1 && eq(quotaSb.swaps[0], { swapKey: 'burpee', from: 'burpee', to: 'step-back-burpee' })
  && S.totalSlots(quotaSb) === S.totalSlots(quota) && quota.scaled === false && quota.exercises[0].moveId === 'burpee');
const quotaBack = L.swapMissionMove(quotaSb, 'burpee', 'burpee');
check('22 restoring burpees: not scaled, no swaps, slot deep-equals', quotaBack.scaled === false && quotaBack.swaps.length === 0 && eq(quotaBack.exercises[0], quota.exercises[0]));

const turboBurpee = L.swapMissionMove(turboStd, 'sprawl', 'burpee');
check('23 TURBO sprawl → burpee stays timed 20 s', keyItems(turboBurpee, 'sprawl').every(sl => sl.mode === 'timed' && sl.work === 20 && sl.moveId === 'burpee' && sl.scaled === true));
const check20 = build('checkpoint_20');
const rowed = L.swapMissionMove(check20, 'shadowbox', 'row-cal');
const rowSlot = rowed.exercises[3];
check('23 CHECKPOINT shadowbox → row: 12 CAL, manual, window rest from the row', rowSlot.mode === 'reps' && rowSlot.reps === 12 && rowSlot.unit === 'CAL'
  && rowSlot.cadenceMs === null && M.countBeats(rowSlot) === null && !('work' in rowSlot)
  && rowSlot.rest === M.windowRest(rowSlot, 12 * S.UNIT_SEC.CAL), show(rowSlot));
const hit = build('hit_combo_21');
const hitLunge = L.swapMissionMove(hit, 'back-squat', 'bb-front-rack-lunge');
const hitBack = L.swapMissionMove(hitLunge, 'back-squat', 'bb-back-squat');
check('23 21-HIT back squats → front-rack lunges ×2, and back', keyItems(hitLunge, 'back-squat')[0].reps === 6 && keyItems(hitBack, 'back-squat')[0].reps === 3
  && M.slotDose(keyItems(hitLunge, 'back-squat')[0]) === '6 (3/leg)');

const halfArc = L.swapMissionMove(turboStd, 'wipers', 'half-arc-wiper-punches');
store.set('tm_equipment', '["HEAVY_BAG"]');
const bagged = L.swapMissionMove(turboStd, 'wipers', 'bag-speed-punches');
reset();
check('24 wiper calls kept on half-arc, dropped on the bag', keyItems(halfArc, 'wipers').every(sl => eq(sl.calls, L.W20))
  && keyItems(bagged, 'wipers').every(sl => sl.moveId === 'bag-speed-punches' && !('calls' in sl)));

const tuck = build('turbo_button', { swaps: { sprawl: 'burpee-tuck-jump' } });
check('25 chain: a stored pick two steps away sticks', keyItems(tuck, 'sprawl').length === 4 && keyItems(tuck, 'sprawl').every(sl => sl.moveId === 'burpee-tuck-jump' && sl.mode === 'timed' && sl.work === 20) && tuck.scaled === true);
check('25 chain: tuck jumps are offered from burpees', L.swapOptions(turboBurpee, 'sprawl').some(o => o.id === 'burpee-tuck-jump'));
check('25 chain: SOLO and Setup agree', eq(L.swapMissionMove(turboBurpee, 'sprawl', 'burpee-tuck-jump'), tuck));
const boHeels = build('best_of_3', { swaps: { squat: 'heels-down-hindu-squat' } });
check('25 chain: BEST OF 3 squats → heels-down Hindu squats keeps 10', keyItems(boHeels, 'squat')[0].moveId === 'heels-down-hindu-squat' && keyItems(boHeels, 'squat')[0].reps === 10);
const roomDiamond = build('room_12', { swaps: { 'push-up': 'diamond-push-up' } });
check('25 chain: diamond push-ups offer push-ups only', eq(L.swapOptions(roomDiamond, 'push-up').map(o => o.id), ['push-up']));
// A pick that only became legal after another row moved off its move (rule 2):
// Setup's rebuild from the map must keep it, whatever order the map holds.
const hitFront = L.swapMissionMove(hit, 'front-squat', 'plate-goblet-squat');
const hitLive = L.swapMissionMove(hitFront, 'back-squat', 'bb-front-squat');
check('25 chain: a pick freed by another row sticks, SOLO and Setup agree',
  L.swapOptions(hitFront, 'back-squat').some(o => o.id === 'bb-front-squat')
  && keyItems(hitLive, 'back-squat')[0].moveId === 'bb-front-squat'
  && eq(build('hit_combo_21', { swaps: { 'front-squat': 'plate-goblet-squat', 'back-squat': 'bb-front-squat' } }), hitLive)
  && eq(build('hit_combo_21', { swaps: { 'back-squat': 'bb-front-squat', 'front-squat': 'plate-goblet-squat' } }), hitLive));
const tutLive = ['reverse-lunge-knee-drive', 'reverse-lunge', 'air-squat', 'hindu-squat']
  .reduce((m, id) => L.swapMissionMove(m, 'teep', id), L.swapMissionMove(build('tutorial_stage'), 'hindu-squat', 'heels-down-hindu-squat'));
check('25 chain: TUTORIAL teep → Hindu squats after the squat row moved off them',
  keyItems(tutLive, 'teep')[0].moveId === 'hindu-squat'
  && eq(build('tutorial_stage', { swaps: { 'hindu-squat': 'heels-down-hindu-squat', teep: 'hindu-squat' } }), tutLive));

const room = build('room_12');
const roomReach = L.reachableMoves(room, 'lunge');
const roomSquat = L.swapMissionMove(room, 'lunge', 'air-squat');
check('26 ROOM 12 (quiet): air squats reachable, jump squats never', roomReach.has('air-squat') && !roomReach.has('jump-squat')
  && !L.swapOptions(roomSquat, 'lunge').some(o => o.id === 'jump-squat') && L.isSwapAllowed(room, 'lunge', 'jump-squat') === false);
const quotaTuck = (lv) => L.swapOptions(built.quota_300[lv], 'burpee').some(o => o.id === 'burpee-tuck-jump');
check('26 QUOTA: tuck-jump burpees only at ROOKIE 90', quotaTuck('beginner') && !quotaTuck('standard') && !quotaTuck('elite'));
const hitBeg = built.hit_combo_21.beginner;
check('26 21-HIT beginner: back squats never come back', !L.reachableMoves(hitBeg, 'back-squat').has('bb-back-squat') && L.isSwapAllowed(hitBeg, 'back-squat', 'bb-back-squat') === false);

// Fixtures: a flying knee, a box move. Never on the shelf.
M._registerTestMoves([
  { id: 'fx-knee', name: 'Fixture Knees', say: 'fixture knees', pattern: 'knee', gear: 'none', unit: 'reps', cadence: { elite: 1000, standard: 1000, beginner: 1000 }, cues: ['A.', 'B.'], alts: [{ id: 'fx-flying-knee', kind: 'harder' }] },
  { id: 'fx-flying-knee', name: 'Fixture Flying Knees', say: 'flying knees', pattern: 'knee', gear: 'none', unit: 'reps', cadence: { elite: 2000, standard: 2000, beginner: 2000 }, flyingKnee: true, jumps: true, cues: ['A.', 'B.'], alts: [{ id: 'fx-knee', kind: 'easier' }] },
  { id: 'fx-box-jump', name: 'Fixture Box Jumps', say: 'box jumps', pattern: 'squat', gear: 'box', unit: 'reps', cadence: { elite: 2000, standard: 2500, beginner: 3000 }, cues: ['A.', 'B.'], alts: [{ id: 'jump-squat', kind: 'similar' }, { id: 'air-squat', kind: 'no-gear' }] },
]);
const fxLevel = (slots) => ({ detail: 'x', minutes: 5, rounds: 2, slots, pace: { elite: 1, standard: 1, beginner: 1 } });
const fxDef = (id, slots) => ({
  id, launch: 99, title: 'FIXTURE', tag: 'Test', loadout: 'none', themes: [], format: 'forTime', difficulty: 'Normal', focus: 'Full Body', workoutType: 'Bodyweight',
  hotel: false, quiet: false, guided: true, knownAs: '', loadoutLine: 'X', missionLine: 'X', scoreLine: 'X', scoreRule: { kind: 'time' }, scale: 'X', note: 'X', introSay: '',
  guidedHelp: 'X', paceBasis: 'X', defaultLevel: 'standard', levels: { beginner: { ...fxLevel(slots), capSec: 600 }, standard: { ...fxLevel(slots), capSec: 600 } },
});
L._registerTestMissionDefs([
  fxDef('fx_knees', [{ moveId: 'fx-knee', mode: 'reps', reps: 10, rest: 10, swapKey: 'knee' }, { moveId: 'sprawl', mode: 'reps', reps: 10, rest: 10, swapKey: 'sprawl' }]),
  fxDef('fx_box', [{ moveId: 'fx-box-jump', mode: 'reps', reps: 10, rest: 10, swapKey: 'box' }, { moveId: 'push-up', mode: 'reps', reps: 10, rest: 10, swapKey: 'push-up' }]),
]);
const fxStd = build('fx_knees');
const fxBeg = build('fx_knees', { level: 'beginner' });
const fxFlying = L.swapMissionMove(fxStd, 'knee', 'fx-flying-knee');
check('26 fixture: no flying knees at beginner', L.swapOptions(fxStd, 'knee').some(o => o.id === 'fx-flying-knee') && !L.swapOptions(fxBeg, 'knee').some(o => o.id === 'fx-flying-knee'));
check('26 fixture: a flying knee in the mission filters jump alts', L.swapOptions(fxStd, 'sprawl').some(o => o.id === 'burpee') && !L.swapOptions(fxFlying, 'sprawl').some(o => o.id === 'burpee'));
check('shelf never lists fixtures', !L.shelfEntries().some(e => e.id.startsWith('fx_')));

reset();
const box = build('fx_box');
const boxSlot = box.exercises[0];
const boxRow = L.cardRows(box)[0];
check('27 gear default: box → air squats, banner, scaled', boxSlot.moveId === 'air-squat' && boxSlot.defaultMoveId === 'air-squat' && boxSlot.baseMoveId === 'fx-box-jump'
  && eq(box.swaps, [{ swapKey: 'box', from: 'fx-box-jump', to: 'air-squat', auto: true }])
  && box.gearBanner === 'No box in your gear. Using Air Squats. Tap the swap icon to change.' && box.scaled === true, show(box.swaps));
check('27 gear default row: swapped, not undoable', boxRow.swapped === true && boxRow.undoable === false && L.missionCardModel(box).banner === box.gearBanner);
const boxBase = L.swapMissionMove(box, 'box', 'fx-box-jump');
check('27 back to the base: undoable, not scaled', L.cardRows(boxBase)[0].undoable === true && boxBase.scaled === false && boxBase.swaps.length === 0);
const boxUndo = L.swapMissionMove(boxBase, 'box', boxBase.exercises[0].defaultMoveId);
check('27 UNDO to the default: auto again, not undoable', boxUndo.swaps[0]?.auto === true && L.cardRows(boxUndo)[0].undoable === false);

const oneBell = built.one_bell_300.standard;
check('28 doses: STEEL, ONE-BELL, TURBO', LEVELS.every(lv => eq(doses(built.steel_plating[lv]), ['2', '1', '3']))
  && eq(doses(oneBell), ['10', '10 (5/side)', '10 (5/side)', '10 (5/side)', '10 (5/leg)', '10'])
  && eq(doses(turboStd), ['4 × 20s', '4 × 20s', '4 × 20s', '4 × 20s'])
  && M.slotDose({ mode: 'reps', reps: 1, sides: 'switch' }) === '1', show(doses(oneBell)));
const noteOf = (m, key) => L.cardRows(m).find(r => r.swapKey === key).note;
const HIT_SQ = 'On the last push press, lower the bar behind the neck onto the back.';
const HIT_CL = 'Press the bar off the back, then lower it to the hips.';
const HIT_LO = 'Lower the bar to the hips.';
check('29 21-HIT notes follow the back-squat key', noteOf(hit, 'back-squat') === HIT_SQ && noteOf(hit, 'hang-clean') === HIT_CL
  && noteOf(hitBeg, 'back-squat') === null && noteOf(hitBeg, 'hang-clean') === HIT_LO
  && noteOf(hitLunge, 'back-squat') === null && noteOf(hitLunge, 'hang-clean') === HIT_LO
  && noteOf(hitBack, 'back-squat') === HIT_SQ);

// ── voice helpers ───────────────────────────────────────────────────────────
check('30 seconds and durations', M.secondsPhrase(1) === '1 second' && M.secondsPhrase(5) === '5 seconds'
  && M.spokenDuration(180) === '3 minutes' && M.spokenDuration(60) === '1 minute' && M.spokenDuration(20) === '20 seconds' && M.spokenDuration(90) === '90 seconds');
check('31 legacy and v2 doses', M.legacyDose({ mode: 'reps', reps: 1, unit: 'MILE' }) === '1 MILE' && M.legacyDose({ mode: 'reps', reps: 10 }) === '10 reps'
  && M.legacyDose({ mode: 'timed', work: 60 }) === '60s' && M.slotDose({ mode: 'timed', work: 20 }) === '20s' && M.slotDose({ mode: 'timed', work: 180 }) === '3:00'
  && M.mmss(0) === '0:00' && M.mmss(425) === '7:05' && M.mmss(1800) === '30:00');

const beatSay = (beats, n) => beats.find(b => b.n === n)?.say;
const swings = M.countBeats(oneBell.exercises[0], { next: oneBell.exercises[1] });
check('32 swings → cleans', beatSay(swings, 8) === '8. Two more. Up next: 10 cleans.' && beatSay(swings, 9) === '9' && beatSay(swings, 10) === '10', beatSay(swings, 8));
const iron = built.iron_clock_16.standard;
check('32 deadlifts → rows', beatSay(M.countBeats(iron.exercises[0], { next: iron.exercises[1] }), 8) === '8. Two more. Up next: 10 rows.');
check('32 burpees → burpees, and the final slot', beatSay(M.countBeats(quota.exercises[0], { next: quota.exercises[0] }), 8) === '8. Two more.'
  && beatSay(M.countBeats(quota.exercises[0], { next: null }), 8) === '8. Two more.');
const cleans = M.countBeats(oneBell.exercises[1], { next: oneBell.exercises[2] });
check('32 cleans switch at 5, 10 × 2.5 s + 3 s', beatSay(cleans, 5) === '5. Switch.' && cleans.reduce((n, b) => n + b.ms, 0) === 10 * 2500 + 3000
  && cleans[5].ms === 2500 + 3000 && beatSay(cleans, 8) === '8. Two more. Up next: 10 presses.');
check('32 front squats: beat 1 includes cleaning the bar up', M.countBeats(iron.exercises[2])[0].ms === 4000 + 2750);
const fourRep = M.countBeats({ ...oneBell.exercises[0], reps: 4 }, { next: oneBell.exercises[1] });
const twoRep = M.countBeats({ ...oneBell.exercises[0], reps: 2 }, { next: oneBell.exercises[1] });
check('32 4-rep and 2-rep tails', beatSay(fourRep, 3) === '3. One more. Up next: 10 cleans.' && beatSay(twoRep, 2) === '2. Up next: 10 cleans.' && beatSay(twoRep, 1) === '1');
const steel = built.steel_plating.standard;
const steelBeats = M.countBeats(steel.exercises[0], { next: steel.exercises[1] });
check('32 steel left complex', steelBeats.length === 6 && steelBeats[1].say === '2. Press.' && steelBeats[2].say === '1. Front squats.'
  && steelBeats[5].say === '3. Up next: the right arm complex.' && steelBeats.every(b => !/Switch\.|more\./.test(b.say))
  && eq(steelBeats.map(b => b.step), [0, 0, 1, 2, 2, 2]), show(steelBeats.map(b => b.say)));
const steelE = built.steel_plating.elite;
check('32 steel elite: the same complex next, no up next', M.countBeats(steelE.exercises[0], { next: steelE.exercises[0] })[5].say === '3');
check('32 legacy reps get beats with ms null; timed and manual get none', M.countBeats({ name: 'Push-Ups', mode: 'reps', reps: 3, rest: 5 }).every(b => b.ms === null)
  && M.countBeats({ name: 'Plank', mode: 'timed', work: 30 }) === null);

const sprawlSlot = keyItems(turboStd, 'sprawl')[0];
const tut = built.tutorial_stage.standard;
check('33 pace beats', eq(M.paceBeats(sprawlSlot), { ms: 2500, n: 8 }) && eq(M.paceBeats(tut.exercises[2]), { ms: 3000, n: 10 }) && eq(M.paceBeats(tut.exercises[0]), { ms: 3000, n: 10 })
  && M.paceBeats(built.tutorial_stage.elite.exercises[5]) === null && M.paceBeats(turboStd.exercises[0]) === null && M.paceBeats(built.best_of_3.standard.exercises[0]) === null);
const turboBeg = built.turbo_button.beginner;
check('34 near-end up next', M.nearEndUpNextAt(sprawlSlot, turboStd.exercises[2]) === 8 && M.nearEndUpNextAt(turboBeg.exercises[1], turboBeg.exercises[2]) === 7
  && M.nearEndUpNextAt(turboStd.exercises[0], turboStd.exercises[1]) === null && M.nearEndUpNextAt(tut.exercises[0], tut.exercises[1]) === 8
  && M.nearEndUpNextAt(built.best_of_3.standard.exercises[0], built.best_of_3.standard.exercises[0]) === null && M.nearEndUpNextAt(sprawlSlot, null) === null);

const bo3 = built.best_of_3.standard;
check('35 lead lines', M.leadLine(iron.exercises[0], ctxFor(iron, 1, 0)) === 'Minute 1. 10 deadlifts. Ready? On my count.'
  && M.leadLine(sprawlSlot, ctxFor(turboStd, 1, 1)) === 'Sprawls. 20 seconds.'
  && M.leadLine(rowSlot, ctxFor(rowed, 1, 3)) === 'Minute 4. 12 calories on the row. Your pace. Tap DONE when the set is done.'
  && M.leadLine(bo3.exercises[0], ctxFor(bo3, 2, 0)) === 'Round 2. AMRAP. 3 minutes. 5 sprawls, 10 air squats, 10 one-twos.'
  && M.leadLine(steel.exercises[0], ctxFor(steel, 1, 0)) === 'Minute 1. 2 cleans, 1 press, 3 front squats. Left arm. Ready? On my count.'
  && M.leadLine(turboStd.exercises[0], ctxFor(turboStd, 1, 0)) === 'Windshield wiper punches. 20 seconds.'
  && M.leadLine(quota.exercises[0], ctxFor(quota, 7, 0)) === 'Minute 7. 10 burpees. Ready? On my count.');

const L1 = 'Minute 1. 10 deadlifts. Ready? On my count.';
const steelLead = M.leadLine(steel.exercises[0], ctxFor(steel, 1, 0));
check('36 timing formulas', M.speechSeconds(L1) === 4 && M.getReadySeconds(L1) === 9 && M.announceAt(9, L1) === 8 && M.speechSeconds('') === 0
  && M.announceAt(35, 'Minute 2. 10 rows. Ready? On my count.', 'Rest. 35 seconds.') === 8
  && M.announceAt(11, steelLead, M.restOpener({ restSec: 11, format: 'emom' })) === null
  && M.restScript({ restSec: 11, format: 'emom', lead: steelLead, short: M.shortRestLine(steel.exercises[0]) }).plan === 'short'
  && M.getReadySeconds(steelLead) === 12 && M.announceAt(12, steelLead) === 11);

const inv = [];
IDS.forEach(id => LEVELS.forEach(lv => {
  const m = built[id][lv];
  const all = [...m.exercises];
  const L0 = M.leadLine(all[0], ctxFor(m, 1, 0));
  const R = M.getReadySeconds(L0);
  const at = M.announceAt(R, L0);
  if (at === null || at - M.speechSeconds(L0) < 4 || at > R - 1) inv.push(`${id}/${lv} get ready`);
  for (let round = 1; round <= m.rounds; round += 1) {
    all.forEach((slot, idx) => {
      const last = idx === all.length - 1;
      if (last && round === m.rounds) return;
      const nextIdx = last ? 0 : idx + 1;
      const nextRound = last ? round + 1 : round;
      const next = all[nextIdx];
      const restSec = slot.window ? M.windowRest(slot, S.estimateWorkSeconds(slot)) : slot.rest;
      const lead = M.leadLine(next, ctxFor(m, nextRound, nextIdx));
      const short = M.shortRestLine(next);
      const sc = M.restScript({ restSec, roundEnd: last, completedRound: round, format: m.format, tips: m.tips, lead, short });
      if (restSec >= 11) {
        const longOk = sc.plan === 'long' && sc.leadAt - M.speechSeconds(sc.lead) >= 4 && restSec - M.speechSeconds(sc.opener) >= sc.leadAt;
        if (!longOk && sc.plan !== 'short') inv.push(`${id}/${lv} r${round} s${idx} long`);
      }
      if (sc.plan === 'short' && sc.countdown && restSec - M.speechSeconds(sc.short) < 3) inv.push(`${id}/${lv} r${round} s${idx} short`);
    });
  }
}));
check('37 timing invariants: every mission × level × slot', inv.length === 0, inv.slice(0, 6).join('; '));

check('38 rest plans and windows', ['chain', 'tiny', 'short', 'short', 'long'].every((p, i) => M.restPlan([0, 2, 3, 10, 11][i]) === p)
  && M.windowRest({ window: 60 }, 25) === 35 && M.windowRest({ window: 60 }, 59) === 5
  && M.shortRestLine(oneBell.exercises[1]) === 'Next: 10 cleans.' && M.skipRestTarget(oneBell.exercises[1]) === 5);

const bo3Lead = M.leadLine(bo3.exercises[0], ctxFor(bo3, 2, 0));
const after1 = M.restScript({ restSec: 60, roundEnd: true, completedRound: 1, format: 'amrap', tips: bo3.tips, lead: bo3Lead, short: 'x' });
const after2 = M.restScript({ restSec: 60, roundEnd: true, completedRound: 2, format: 'amrap', tips: bo3.tips, lead: bo3Lead, short: 'x' });
check('39 rest scripts: tips per block, countdown room', after1.plan === 'long' && after1.opener === 'Round 1 complete. Rest. 60 seconds. Remember your round one score.'
  && after2.opener.endsWith(bo3.tips[1]) && after1.leadAt === 10
  && M.restScript({ restSec: 5, format: 'forTime', lead: 'x', short: 'Next: 10 cleans.' }).countdown === true
  && M.restScript({ restSec: 6, format: 'emom', lead: 'x', short: 'Next: 12 calories on the row.' }).countdown === false
  && eq(M.restScript({ restSec: 0, format: 'emom', lead: 'x', short: 'y' }), { plan: 'chain', opener: null, leadAt: null, lead: null, short: null, countdown: false })
  && M.restScript({ restSec: 9, kind: 'lead', format: 'emom', lead: L1, short: 'y' }).leadAt === 8
  && M.restOpener({ restSec: 1, format: 'forTime' }) === 'Rest. 1 second.', after1.opener);

const sallyLike = { name: 'Sally Up Squats', mode: 'timed', work: 120, rest: 1, calls: [{ t: 0, say: 'Down' }] };
check('40 work start lines', M.workStartLine(bo3.exercises[0], { announcedBy: 'lead' }) === 'Go.' && M.workStartLine(turboStd.exercises[0], { announcedBy: 'lead' }) === null
  && M.workStartLine(sprawlSlot, { announcedBy: 'short' }) === 'Go.' && M.workStartLine(quota.exercises[0], { announcedBy: 'lead' }) === null
  && M.workStartLine(rowSlot, { announcedBy: 'lead' }) === 'Go.' && M.workStartLine(rowSlot, { announcedBy: 'short' }) === 'Go. Your pace. Tap DONE when the set is done.'
  && M.workStartLine(tut.exercises[1], { announcedBy: null }) === 'One-twos. Go.' && M.workStartLine(sallyLike, { announcedBy: null }) === 'Sally up squats.'
  && M.chainedLine(quota.exercises[0]) === '10 burpees.'
  && M.chainedLine({ name: 'Mile Run', mode: 'reps', reps: 1, unit: 'MILE' }) === 'Mile run. Your pace. Tap DONE when the set is done.');

const alternates = (calls) => { const lr = calls.filter(c => c.say === 'Left' || c.say === 'Right').map(c => c.say); return lr[0] === 'Left' && lr.every((s, i) => i === 0 || s !== lr[i - 1]); };
check('41 wiper calls alternate from Left; W15 has no Five', alternates(L.W20) && alternates(L.W15) && !L.W15.some(c => c.say === 'Five') && L.W20.some(c => c.say === 'Five'));
check('42 swapped-in line', M.swappedInLine(quotaSb) === 'Swapped in: Step-Back Burpees.' && M.swappedInLine(quota) === null);

// ── integrity (fix a) ───────────────────────────────────────────────────────
const murph = N.buildNamedMission('murph');
check('43 integrity limits sized to the mission', S.qmMaxValidSeconds(murph) === 5258 && S.qmMaxValidSeconds(murph) >= 3300
  && S.qmMaxValidSeconds(N.buildNamedMission('sally_squats')) === 600 && S.qmMaxValidSeconds(turboStd) === 912 && S.qmMaxValidSeconds(room) === 1145,
  `${S.qmMaxValidSeconds(murph)} ${S.qmMaxValidSeconds(turboStd)} ${S.qmMaxValidSeconds(room)}`);
const LIMITS = { half_murph: 2708, deadly_seven: 2217, strike_fitness_adv: 1626, hero_training: 2499, pushup_division: 1346, fitness_test: 1535, legendary_squat: 1512 };
check('43 the other long classics', Object.entries(LIMITS).every(([id, n]) => S.qmMaxValidSeconds(N.buildNamedMission(id)) === n),
  Object.keys(LIMITS).map(id => `${id} ${S.qmMaxValidSeconds(N.buildNamedMission(id))}`).join(', '));
const four = { exercises: [{ name: 'Push-Ups', mode: 'reps', reps: 10, rest: 15 }], finisherExercises: [], rounds: 4 };
check('44 total units: fresh and resumed', S.qmTotalUnits(four) === 4 && S.qmTotalUnits(four, { round: 2 }) === 2 && S.qmTotalUnits(four, { round: 4 }) === 1
  && S.qmTotalUnits(murph, { round: 1 }) === 1 && S.qmIntegrityRules(murph).minValidSeconds === I.MODE_RULES.quickMission.minValidSeconds);

const realNow = Date.now;
let clock = 1_800_000_000_000;
Date.now = () => clock;
const runUnits = (mission, units, rules, unitSec, total = mission.rounds) => {
  const sess = new I.IntegritySession('quickMission', total, rules);
  for (let u = 0; u < units; u += 1) { sess.startUnit('rounds'); clock += unitSec * 1000; sess.completeUnit(); }
  return sess.finalize();
};
const murphNew = runUnits(murph, 1, S.qmIntegrityRules(murph), 55 * 60);
const murphOld = runUnits(murph, 1, I.MODE_RULES.quickMission, 55 * 60);
const verdict = (ir) => O.resolveOutcome({ completed: 62, total: 62, difficulty: 'Hard', integrityResult: ir }).outcome;
check('45 a 55-minute Murph passes with the sized limit', verdict(murphNew) === 'pass', murphNew.validityStatus);
check('45 the old limit fails it (the bug)', verdict(murphOld) === 'validation_failed');
const hm = N.buildNamedMission('half_murph'), d7 = N.buildNamedMission('deadly_seven'), sfa = N.buildNamedMission('strike_fitness_adv');
check('45 half murph 28 min, deadly seven 30 min, strike fitness 2 × 17 min', runUnits(hm, 1, S.qmIntegrityRules(hm), 28 * 60).validityStatus === 'complete'
  && runUnits(d7, 1, S.qmIntegrityRules(d7), 30 * 60).validityStatus === 'complete' && runUnits(sfa, 2, S.qmIntegrityRules(sfa), 17 * 60).validityStatus === 'complete');
check('45 a 4-round generated mission, 4 × 3 min', runUnits(four, 4, S.qmIntegrityRules(four), 180).validityStatus === 'complete');
check('45 resumed at round 2: 2 units of 3 min complete', runUnits(four, 2, S.qmIntegrityRules(four), 180, S.qmTotalUnits(four, { round: 2 })).validityStatus === 'complete');
Date.now = realNow;

// ── SOLO maths ──────────────────────────────────────────────────────────────
const settle = (mission, o) => S.settleSoloXp({ mode: 'solo', mission, format: mission.format, totalSlots: S.totalSlots(mission), completed: false, stopped: false, capped: false, ...o });
const sp = settle(oneBell, { completed: true, elapsedSec: 1200 });
const sf = settle(oneBell, { completed: true, elapsedSec: 400 });
const sh = settle(oneBell, { stopped: true, elapsedSec: 600 });
const se = settle(oneBell, { stopped: true, elapsedSec: 200 });
const sc = settle(oneBell, { completed: true, capped: true, elapsedSec: 1800 });
check('46 ONE-BELL: pass, too fast, partial, none, capped', sp.outcome === 'pass' && sp.xp === 480 && sf.outcome === 'too_fast' && sf.xp === 0 && sf.message === S.TOO_FAST_MESSAGE
  && sh.outcome === 'partial' && sh.xp === 225 && se.outcome === 'none' && se.xp === 0 && se.message === S.EARLY_MESSAGE && sc.outcome === 'pass' && sc.xp === 480,
  show([sp, sf, sh, se, sc].map(x => `${x.outcome}:${x.xp}`)));
check('46 SOLO floors', S.soloFloorSec(oneBell) === 450 && S.soloFloorSec(built.one_bell_300.beginner) === 240 && S.soloFloorSec(built.one_bell_300.elite) === 495);
const q95 = settle(quota, { stopped: true, elapsedSec: 855 });
const q90 = settle(quota, { stopped: true, elapsedSec: 810 });
check('46 QUOTA: 95% of the clock passes; 90% is partial', q95.outcome === 'pass' && q95.xp === 255 && q90.outcome === 'partial' && q90.xp === 203, `${q95.xp} ${q90.xp}`);

const tlBad = [];
IDS.forEach(id => LEVELS.forEach(lv => {
  const m = built[id][lv];
  if (!S.isFixedClock(m.format)) { if (S.soloTimeline(m).length) tlBad.push(`${id} forTime timeline`); return; }
  const sum = S.soloTimeline(m).reduce((n, seg) => n + seg.sec, 0);
  if (sum !== S.missionClockSec(m)) tlBad.push(`${id}/${lv} ${sum}`);
}));
check('47 timelines add up to the clock', tlBad.length === 0, tlBad.join(', '));
const ironTl = S.soloTimeline(iron);
const at0 = S.segmentAt(ironTl, 0), at60 = S.segmentAt(ironTl, 60), atEnd = S.segmentAt(ironTl, 960);
check('47 segmentAt: start, boundary, past the end', at0.index === 0 && at0.remainingSec === 60 && at60.index === 1 && at60.startSec === 60 && at60.remainingSec === 60 && atEnd === null
  && S.segmentAt(ironTl, 959.5).index === 15);
const steelTl = S.soloTimeline(steel);
const turboTl = S.soloTimeline(turboStd);
const checkTl = S.soloTimeline(check20);
const bo3Tl = S.soloTimeline(bo3);
check('47 segment labels and keys', steelTl[0].label === 'MIN 1 · LEFT ARM' && steelTl[0].swapKey === null && eq(steelTl[0].stepKeys, ['clean', 'press', 'squat'])
  && steelTl[1].label === 'MIN 2 · RIGHT ARM' && S.soloTimeline(steelE)[0].label === 'MIN 1 · BOTH BELLS' && eq(turboTl[0].calls, L.W20)
  && checkTl[2].label === 'MIN 3 · 12 Goblet Squats' && checkTl[2].swapKey === 'squat'
  && bo3Tl.map(s => s.label).join(',') === 'BLOCK 1/3,REST,BLOCK 2/3,REST,BLOCK 3/3' && bo3Tl[2].block === 1
  && S.soloTimeline(room)[0].label === 'AMRAP' && turboTl[1].kind === 'rest' && turboTl[1].sec === 10 && turboTl[2].label === 'Sprawls' && turboTl[2].swapKey === 'sprawl', show(checkTl[2]));

const tutNull = { ...tut, exercises: tut.exercises.map(sl => (sl.swapKey === 'sprawl' ? { ...sl, cadenceMs: null } : sl)) };
check('48 prefill scores', S.prefillScore(tut) === 66 && S.prefillScore(built.tutorial_stage.beginner) === 39 && S.prefillScore(built.tutorial_stage.elite) === 81
  && S.prefillScore(turboStd) === 24 && S.prefillScore(turboBeg) === 12 && S.prefillScore(built.turbo_button.elite) === 26
  && eq(S.prefillScore(room, { roundTaps: 5 }), { rounds: 5, reps: 0 })
  && eq(S.prefillScore(bo3, { roundTaps: 17, blockTaps: [6, 5, 6] }), { blocks: [{ rounds: 6, reps: 0 }, { rounds: 5, reps: 0 }, { rounds: 6, reps: 0 }], rounds: 17, reps: 0 })
  && Number.isFinite(S.prefillScore(tutNull)) && S.prefillScore(tutNull) === 36
  && S.prefillScore(quota) === 15 && S.prefillScore(oneBell) === null,
  `${S.prefillScore(tut)} ${S.prefillScore(built.tutorial_stage.beginner)} ${S.prefillScore(built.tutorial_stage.elite)} ${S.prefillScore(turboStd)} ${S.prefillScore(turboBeg)} ${S.prefillScore(built.turbo_button.elite)}`);
check('48 reps per round', S.repsPerRound(oneBell) === 60 && S.repsPerRound(built.five_round_bout.standard) === 18 && S.repsPerRound(hit) === 21);

const pt = S.paceTargets(oneBell);
check('49 pace targets', eq(pt.map(p => p.text), ['≤ 15:00', '≤ 20:00', '≤ 25:00']) && eq(pt.map(p => p.label), ['ELITE', 'STANDARD', 'BEGINNER'])
  && S.paceTargets(built.quota_300.elite)[0].text === '30/30 · sets ≤ 25s' && S.paceTargets(built.quota_300.standard)[2].text === '12/15'
  && eq(S.paceTargets(bo3).map(p => p.text), ['21+ rounds', '17 rounds', '12 rounds']) && eq(S.paceTargets(turboStd).map(p => p.text), ['25+', '20', '15']));
check('50 score formats', S.formatScore({ kind: 'time', timeSec: 1122, value: 1122 }) === '18:42' && S.formatScore({ kind: 'time', capped: true, reps: 248, value: 248 }) === 'CAP · 248 reps'
  && S.formatScore({ kind: 'roundsReps', rounds: 6, reps: 12 }) === '6 + 12' && S.formatScore({ kind: 'roundsReps', blocks: [{ rounds: 5, reps: 3 }, { rounds: 4, reps: 10 }] }) === '9 + 13'
  && S.formatScore({ kind: 'minutesHeld', minutesHeld: 15, of: 16, value: 15 }) === '15/16' && S.formatScore({ kind: 'reps', reps: 64, label: 'X', value: 64 }) === '64'
  && S.formatScore(null) === '—');

// ── the SOLO-only missions (12-26) ──────────────────────────────────────────
reset();
const soloBuilt = {};
const soloProblems = [];
// CHARGE UP 12 is an AMRAP scored in total reps (an ascending ladder).
const soloRuleKind = (id, format) => (id === 'charge_up_12' ? 'reps' : RULE_KIND[format]);
for (const id of SOLO_IDS) {
  soloBuilt[id] = {};
  const def = L.missionDefById(id);
  if (!eq(Object.keys(def.levels).sort(), [...LEVELS].sort()) || def.defaultLevel !== 'standard' || def.workoutType !== 'Weighted' || typeof def.knownAs !== 'string') soloProblems.push(`${id} def shape`);
  for (const lv of LEVELS) {
    const m = build(id, { level: lv });
    soloBuilt[id][lv] = m;
    const tag = `${id}/${lv}`;
    if (!m) { soloProblems.push(`${tag} null`); continue; }
    const card = L.missionCardModel(m);
    if (m.guided !== false || !card.soloOnly || !card.tags.includes('SOLO ONLY') || card.guidedHelp !== '' || m.introSay !== '') soloProblems.push(`${tag} not SOLO only`);
    const its = items(m);
    if (its.some(it => !M.moveById(it.moveId))) soloProblems.push(`${tag} unknown move`);
    if (its.some(it => it.moveId !== it.baseMoveId || it.defaultMoveId !== it.baseMoveId) || m.scaled !== false || m.gearBanner !== null) soloProblems.push(`${tag} not at base with no gear set`);
    if (m.exercises.some(sl => !Array.isArray(sl.list) && !('cadenceMs' in sl))) soloProblems.push(`${tag} slot missing cadenceMs`);
    if (m.exercises.some(sl => sl.window != null && ![30, 60].includes(sl.window))) soloProblems.push(`${tag} window`);
    if (m.exercises.some(sl => Array.isArray(sl.list) && sl.mode === 'reps' && sl.list.some(st => 'sides' in st))) soloProblems.push(`${tag} complex step has sides`);
    if (!eq(JSON.parse(JSON.stringify(m)), m)) soloProblems.push(`${tag} JSON round-trip`);
    if (!paceOk(m.format, m.pace)) soloProblems.push(`${tag} pace types`);
    if (m.scoreRule.kind !== soloRuleKind(id, m.format)) soloProblems.push(`${tag} scoreRule`);
    if (m.format === 'forTime' ? !(m.capSec > 0) : m.capSec !== 0) soloProblems.push(`${tag} capSec`);
    if (m.workoutType !== 'Weighted' || !m.loadoutLine || !m.missionLine || !m.scoreLine || !m.scale || !m.note || !m.paceBasis || !m.load || !m.levelDetail) soloProblems.push(`${tag} card copy`);
  }
}
check('53 every SOLO-only mission builds at all 3 levels, guided === false', soloProblems.length === 0, soloProblems.join('; '));
// A score line's '(N FINISHES)' is that level's own total (a level can
// override the line): every rep of every round, which is also the cap
// stepper's top.
const finishBad = [...IDS, ...SOLO_IDS].flatMap(id => LEVELS.flatMap(lv => {
  const m = build(id, { level: lv });
  const n = /\((\d+) FINISHES\)/.exec(m.scoreLine)?.[1];
  return n != null && Number(n) !== S.repsPerRound(m) * (m.rounds || 1) ? [`${id}/${lv} ${n} vs ${S.repsPerRound(m) * (m.rounds || 1)}`] : [];
}));
check('53 every N FINISHES is that level\'s reps × rounds', finishBad.length === 0 && soloBuilt.honor_rounds.beginner.scoreLine.includes('(81 FINISHES)')
  && soloBuilt.overhead_rush.beginner.scoreLine.includes('(96 FINISHES)') && soloBuilt.burnout_21.beginner.scoreLine.includes('(90 FINISHES)')
  && soloBuilt.honor_rounds.standard.scoreLine.includes('(135 FINISHES)'), finishBad.join(', '));
// A level's score label names only the moves that level runs.
const sgB = soloBuilt.surge_20_10.beginner;
check('53 SURGE BEGINNER scores squats, not thrusters', sgB.scoreRule.label === 'LOWEST SWINGS + SQUATS + CLIMBERS' && sgB.scoreLine === sgB.scoreRule.label
  && eq(sgB.scoreRule.keys, ['swing', 'thruster', 'climber']) && sgB.scoreRule.agg === 'lowest' && soloBuilt.surge_20_10.standard.scoreRule.label.includes('THRUSTERS')
  && !L.missionDefById('surge_20_10').levels.standard.scoreRule);

// Every slot / step names a catalog move, and every alt of every move a swap
// can reach resolves too. Every move the 15 missions use (the base of any row
// at any level, launch catalog entries included) has 2-4 alts.
const altProblems = [];
SOLO_IDS.forEach(id => LEVELS.forEach(lv => {
  const m = soloBuilt[id][lv];
  items(m).forEach(it => { if (!M.moveById(it.moveId)) altProblems.push(`${id}/${lv} ${it.moveId}`); });
  L.cardRows(m).forEach(r => {
    [r.moveId, ...L.reachableMoves(m, r.swapKey).keys()].forEach(mid => {
      (M.moveById(mid)?.alts || [null]).forEach(a => { if (!a || !M.moveById(a.id)) altProblems.push(`${id}/${lv} ${mid}→${a?.id}`); });
    });
  });
}));
const NEW_MOVES = M.MOVES.slice(80, 135); // the 15 SOLO-only missions' entries (the owner's three: test 70)
const usedIds = new Set(SOLO_IDS.flatMap(id => LEVELS.flatMap(lv => items(soloBuilt[id][lv]).map(it => it.moveId))));
const fewAlts = [...new Set([...usedIds, ...NEW_MOVES.map(m => m.id)])].filter(id => M.moveById(id).alts.length < 2 || M.moveById(id).alts.length > 4);
// Gear-aware, checked on what the swap sheet really offers in the mission's
// loadout (an alt the loadout filters out does not count): a loaded row at
// any level offers an EASIER or NO GEAR option or a gear-free move, and a
// row on the pull-up bar offers a move that needs no bar.
const LOADED = ['bell', 'db', 'barbell', 'plate'];
const sheetBad = [];
SOLO_IDS.forEach(id => LEVELS.forEach(lv => {
  const m = soloBuilt[id][lv];
  L.cardRows(m).forEach(r => {
    const gear = M.moveById(r.moveId).gear;
    const opts = L.swapOptions(m, r.swapKey);
    if (LOADED.includes(gear) && !opts.some(o => o.kind === 'easier' || o.kind === 'no-gear' || o.gear === 'none')) sheetBad.push(`${id}/${lv} ${r.moveId} no lighter`);
    if (gear === 'bar' && !opts.some(o => o.gear !== 'bar')) sheetBad.push(`${id}/${lv} ${r.moveId} bar only`);
  });
}));
// Every new pull-up-bar move lists a no-bar alt (a loaded new move still
// lists an easier or no-gear one, or is itself one).
const scaleTarget = new Set(M.MOVES.flatMap(m => m.alts.filter(a => a.kind === 'easier' || a.kind === 'no-gear').map(a => a.id)));
const noLighter = NEW_MOVES.filter(m => (m.gear === 'bar' && !m.alts.some(a => M.moveById(a.id).gear !== 'bar'))
  || (LOADED.includes(m.gear) && !m.alts.some(a => a.kind === 'easier' || a.kind === 'no-gear' || M.moveById(a.id).gear === 'none') && !scaleTarget.has(m.id))).map(m => m.id);
check('54 every slot\'s move and every reachable alt resolves', altProblems.length === 0 && usedIds.size > 40, altProblems.slice(0, 6).join(', '));
check('54 every move the 15 use has 2-4 alts; new entries gear-aware', fewAlts.length === 0 && noLighter.length === 0 && NEW_MOVES.length === 55, `${fewAlts.join(',')} | ${noLighter.join(',')} | ${NEW_MOVES.length}`);
check('54 every loaded row offers a lighter swap, every bar row a no-bar one, at every level', sheetBad.length === 0, sheetBad.join(', '));

// Pace: three tiers, elite better than standard better than beginner; a for-
// time beginner still finishes inside the cap.
const inf = (v) => (v == null ? Infinity : v);
const ordered = (m) => {
  const p = m.pace;
  if (m.format === 'forTime') return p.elite < p.standard && p.standard < p.beginner && p.beginner <= m.capSec;
  if (m.format === 'emom') {
    const pair = (a, b) => a.held >= b.held && inf(a.setSec) <= inf(b.setSec) && (a.held > b.held || inf(a.setSec) < inf(b.setSec)) && a.of === b.of;
    return pair(p.elite, p.standard) && pair(p.standard, p.beginner) && p.elite.of === S.heldOf(m);
  }
  return p.elite > p.standard && p.standard > p.beginner && p.beginner > 0;
};
const paceBad = SOLO_IDS.flatMap(id => LEVELS.filter(lv => {
  const m = soloBuilt[id][lv];
  const pt = S.paceTargets(m);
  return !ordered(m) || pt.length !== 3 || pt.some(x => !x.text || /undefined|NaN/.test(x.text));
}).map(lv => `${id}/${lv}`));
check('55 pace targets exist and are ordered', paceBad.length === 0, paceBad.join(', '));
// Across levels: a heavier level never gets a faster for-time target in any
// tier (BEGINNER → STANDARD → ELITE), and on the same clock an AMRAP or
// interval target never goes up with the load (STANDARD → ELITE). Checked on
// all 26 missions.
const TIERS = ['elite', 'standard', 'beginner'];
const crossBad = [];
[...IDS, ...SOLO_IDS].forEach(id => {
  const by = Object.fromEntries(LEVELS.map(lv => [lv, build(id, { level: lv })]));
  const f = by.standard.format;
  TIERS.forEach(tier => {
    if (f === 'forTime') {
      if (!(by.beginner.pace[tier] <= by.standard.pace[tier] && by.standard.pace[tier] <= by.elite.pace[tier])) crossBad.push(`${id} ${tier}`);
    } else if ((f === 'amrap' || f === 'intervals') && by.standard.clockSec === by.elite.clockSec) {
      if (!(by.elite.pace[tier] <= by.standard.pace[tier])) crossBad.push(`${id} ${tier}`);
    }
  });
});
check('55 a heavier level never gets a better pace target in any tier', crossBad.length === 0, crossBad.join(', '));
const hr = (lv) => soloBuilt.honor_rounds[lv];
check('55 HONOR ROUNDS: the lighter bar is the faster run in every tier', eq(hr('standard').pace, { elite: 210, standard: 450, beginner: 720 }) && hr('standard').duration === 8
  && TIERS.every(t => hr('standard').pace[t] < hr('elite').pace[t]) && /Each range is one athlete level at its own load/.test(hr('standard').paceBasis));
// An interval mission's clock-end prefill sits at or under its own elite mark.
const prefillHigh = SOLO_IDS.flatMap(id => LEVELS.filter(lv => soloBuilt[id][lv].format === 'intervals' && S.prefillScore(soloBuilt[id][lv]) > soloBuilt[id][lv].pace.elite).map(lv => `${id}/${lv}`));
check('55 interval prefill never beats its own elite mark', prefillHigh.length === 0 && S.prefillScore(soloBuilt.surge_20_10.elite) === 44, prefillHigh.join(', '));

// The clock: a fixed clock's timeline adds up to the mission's clock, within
// a minute of its minutes; a for-time mission has none and runs to its cap.
const tlProblems = [];
SOLO_IDS.forEach(id => LEVELS.forEach(lv => {
  const m = soloBuilt[id][lv];
  const tl = S.soloTimeline(m);
  const tag = `${id}/${lv}`;
  if (!S.isFixedClock(m.format)) {
    if (tl.length || m.clockSec !== m.capSec || m.duration * 60 > m.capSec) tlProblems.push(`${tag} for time`);
    return;
  }
  const sum = tl.reduce((n, seg) => n + seg.sec, 0);
  if (!tl.length || sum !== S.missionClockSec(m) || sum !== m.clockSec || Math.abs(sum - m.duration * 60) > 60) tlProblems.push(`${tag} ${sum} vs ${m.clockSec} / ${m.duration} min`);
  if (tl.some(seg => !Number.isInteger(seg.sec) || seg.sec <= 0 || !['work', 'rest'].includes(seg.kind) || !seg.label)) tlProblems.push(`${tag} segment`);
  if (tl[0].kind !== 'work' || tl[tl.length - 1].kind !== 'work' || tl.some((seg, i) => i > 0 && seg.kind === 'rest' && tl[i - 1].kind === 'rest')) tlProblems.push(`${tag} rests`);
  if (S.segmentAt(tl, sum - 0.5)?.index !== tl.length - 1 || S.segmentAt(tl, sum) !== null) tlProblems.push(`${tag} segmentAt`);
}));
check('56 every SOLO-only timeline is valid and matches its time or cap', tlProblems.length === 0, tlProblems.join('; '));

const SOLO_CLOCKS = {
  honor_rounds: [1200, 1200, 1200], ko_sprint_30: [600, 600, 600], overhead_rush: [900, 900, 900], burnout_21: [1800, 1200, 1800],
  stance_breaker_9: [540, 360, 540], rookie_round_8: [480, 300, 480], first_bell: [960, 1260, 960], continue_bell: [1200, 600, 1200],
  carry_on_15: [900, 600, 900], surge_20_10: [710, 525, 710], midline_lock: [600, 360, 600], leg_sweep: [720, 480, 720],
  charge_up_12: [720, 480, 720], oxygen_debt: [600, 600, 600], hot_laps: [1200, 1200, 1200],
};
// A ladder pays per rung (BURNOUT 21: 7, not 14 flattened slots).
const SOLO_XP = {
  honor_rounds: [255, 165, 255], ko_sprint_30: [45, 45, 45], overhead_rush: [330, 210, 330], burnout_21: [135, 105, 135],
  stance_breaker_9: [45, 45, 45], rookie_round_8: [45, 45, 45], first_bell: [330, 330, 330], continue_bell: [180, 105, 180],
  carry_on_15: [45, 45, 45], surge_20_10: [390, 300, 390], midline_lock: [45, 45, 45], leg_sweep: [45, 45, 45],
  charge_up_12: [45, 45, 45], oxygen_debt: [75, 75, 75], hot_laps: [165, 165, 165],
};
const soloClockBad = [];
SOLO_IDS.forEach(id => ORDER.forEach((lv, i) => {
  const m = soloBuilt[id][lv];
  if (m.clockSec !== SOLO_CLOCKS[id][i] || S.fullRunXp(m) !== SOLO_XP[id][i]) soloClockBad.push(`${id}/${lv} ${m.clockSec} ${S.fullRunXp(m)}`);
}));
check('57 SOLO-only clocks and full-run XP', soloClockBad.length === 0, soloClockBad.join(', '));

// The 11 launch missions are untouched by the SOLO extensions: their SOLO
// timelines hash as before (taken before FIRST BELL's windows and the ladders
// went in), and the minutes-held score still counts the clock's minutes.
const TL_HASH = {
  iron_clock_16: ['0c0d6fdc9ce2', 'ddc26113eb28', 'ddc26113eb28'], one_bell_300: ['97d170e1550e', '97d170e1550e', '97d170e1550e'],
  five_round_bout: ['dd5651b27792', '773518de81ff', '773518de81ff'], best_of_3: ['4a00cf163580', '1143d47d27f8', '1143d47d27f8'],
  steel_plating: ['d72f27eb798b', '1c2c2e8fd574', '51d9be148923'], checkpoint_20: ['8ee170fa4750', '4e8d41554d7a', 'e4c3e662b981'],
  room_12: ['c67977febccf', 'f5d5bd1ac72e', 'f5d5bd1ac72e'], hit_combo_21: ['3ff641c8ef6f', '6d4e60765c67', '6d4e60765c67'],
  tutorial_stage: ['0381a06bd309', '7b5268953eed', '4f738aae99b8'], turbo_button: ['7f31f462bec7', '1feeb1f153b3', '1feeb1f153b3'],
  quota_300: ['e49c4bce9196', 'aad1e65a0721', '61f7fcd2afb7'],
};
const hash = (v) => createHash('sha1').update(JSON.stringify(v)).digest('hex').slice(0, 12);
const tlChanged = IDS.flatMap(id => LEVELS.filter((lv, i) => hash(S.soloTimeline(built[id][lv])) !== TL_HASH[id][i]).map(lv => `${id}/${lv}`));
const heldBad = IDS.flatMap(id => LEVELS.filter(lv => built[id][lv].format === 'emom' && S.heldOf(built[id][lv]) !== S.missionClockSec(built[id][lv]) / 60).map(lv => `${id}/${lv}`));
check('58 the 11 launch missions: timelines unchanged (XP: test 10)', tlChanged.length === 0 && heldBad.length === 0, `${tlChanged.join(', ')} ${heldBad.join(', ')}`);
check('58 the 11 launch missions: SOLO rounds and the cap prefill unchanged', IDS.every(id => LEVELS.every(lv => {
  const m = built[id][lv];
  return S.soloRounds(m) === (m.rounds || 1) && S.repsThrough(m, 2) === 2 * S.repsPerRound(m);
})));
// The 15 SOLO-only missions are pinned the same way (taken before the owner's
// three and the until-down end went in), and all 26 pin their swaps (every
// row's sheet and every move a swap can reach) and their guided voice (every
// lead line, count, pace count, near-end call, chained line and rest script).
// XP and clocks: tests 10 and 57.
const TL_HASH_SOLO = {
  honor_rounds: ['97d170e1550e', '97d170e1550e', '97d170e1550e'], ko_sprint_30: ['97d170e1550e', '97d170e1550e', '97d170e1550e'],
  overhead_rush: ['97d170e1550e', '97d170e1550e', '97d170e1550e'], burnout_21: ['97d170e1550e', '97d170e1550e', '97d170e1550e'],
  stance_breaker_9: ['4f66c727636a', '952cea759a44', '952cea759a44'], rookie_round_8: ['5c354a5f6746', 'dbcfd3cf60ce', 'dbcfd3cf60ce'],
  first_bell: ['cd23ca176428', '454edd46e420', '454edd46e420'], continue_bell: ['97d170e1550e', '97d170e1550e', '97d170e1550e'],
  carry_on_15: ['cf7a396a57bc', 'c13a0d9371cc', 'c13a0d9371cc'], surge_20_10: ['82ac51b7769a', '0188d571e3b2', '0188d571e3b2'],
  midline_lock: ['75c573cef9a9', '79d2a47b62fe', '79d2a47b62fe'], leg_sweep: ['9a6e35b53fbe', 'eed79f7a325a', 'eed79f7a325a'],
  charge_up_12: ['bdd0dc42d7b4', '0dec4763aa2a', '0dec4763aa2a'], oxygen_debt: ['97d170e1550e', '97d170e1550e', '97d170e1550e'],
  hot_laps: ['97d170e1550e', '97d170e1550e', '97d170e1550e'],
};
const SWAP_HASH = {
  iron_clock_16: ['c4eb35156843', '878aed9f4850', '878aed9f4850'], one_bell_300: ['05d24fc5fdf3', '9c03ca3beeed', '9c03ca3beeed'],
  five_round_bout: ['ede729a589e4', '86ae049b827f', '86ae049b827f'], best_of_3: ['9b14b45e82e7', '1e4f6accc097', '3ecd1380be67'],
  steel_plating: ['7650d66ef713', 'ad6b4d2b7920', 'ad6b4d2b7920'], checkpoint_20: ['77a9b618d50b', '7732b433ca59', '7732b433ca59'],
  room_12: ['63e0854bdaa4', '24b3abc652d1', '2c6a18171413'], hit_combo_21: ['cf48670ebbbe', 'af368ec7152f', 'af368ec7152f'],
  tutorial_stage: ['38a34a2be802', '002691d8bc61', '004d499be28d'], turbo_button: ['83764586c084', '0f2ffda5127f', '0f2ffda5127f'],
  quota_300: ['edae56942522', 'd8d338028dbe', 'd8d338028dbe'], honor_rounds: ['a647f2df7b33', '46e6dcab8cdc', '46e6dcab8cdc'],
  ko_sprint_30: ['91228de70fba', '036b12c9b662', '036b12c9b662'], overhead_rush: ['9f41b3d3404f', 'a69b304024a0', 'a69b304024a0'],
  burnout_21: ['6fabff651400', '957550736aff', '957550736aff'], stance_breaker_9: ['60adc96c0bae', '5d3ef9e37cb1', '5d3ef9e37cb1'],
  rookie_round_8: ['647b2c95998d', '39ac03a83d6c', '39ac03a83d6c'], first_bell: ['840101be78d9', '6e3db72c6fc1', '6e3db72c6fc1'],
  continue_bell: ['88cc566a8519', '889947c12ae9', '889947c12ae9'], carry_on_15: ['802262a18bab', 'c28828f3a5d9', 'c28828f3a5d9'],
  surge_20_10: ['a3a7cce9a316', '11491e0f929f', '11491e0f929f'], midline_lock: ['21e89f4bfdec', '34c2046e1429', '34c2046e1429'],
  leg_sweep: ['9b64711ceb91', '90614a8297ac', '90614a8297ac'], charge_up_12: ['f42be06c792c', 'f42be06c792c', 'f42be06c792c'],
  oxygen_debt: ['d5111087744e', '7742ffa03f6c', 'f5db11c79ca5'], hot_laps: ['029fecbf338a', '0a0bc70a019c', '49ead546e8b1'],
};
const VOICE_HASH = {
  iron_clock_16: ['356b967744e8', '6d5c239d2bfc', '53e5f064ac17'], one_bell_300: ['d42b2642a649', '6db1051648d0', '564848192d56'],
  five_round_bout: ['37b142748ca0', '799ea20b394c', '799ea20b394c'], best_of_3: ['dbf2ad2f830f', '7c5a3fa183de', '63cb8981d62c'],
  steel_plating: ['4cc2e57e00ba', '552d8e7f0785', '1c3f2a4134cc'], checkpoint_20: ['f654b15728f5', '36daced529d4', 'd0260f37aba1'],
  room_12: ['9c8f415ff7e9', 'ec23e2211e1a', '54146d90552d'], hit_combo_21: ['e74e5b145aed', '4b8bdd8c4217', '4b8bdd8c4217'],
  tutorial_stage: ['2bc2df9e4372', 'c1f75ed7b6ee', 'a3c9111066b2'], turbo_button: ['1c2a2628c805', '9151311d4782', '7d4e61df0fc2'],
  quota_300: ['f3d260bd72b0', 'a60d070908ef', '94bacfd85c4a'], honor_rounds: ['4b9fe94db39e', 'c281004689cc', '9e659ea33215'],
  ko_sprint_30: ['1c3693f6b865', 'b72fb112f32c', '6ce583864f83'], overhead_rush: ['c4e034f90b72', 'bde3bebda235', '0652da16de55'],
  burnout_21: ['42bfe1ccbc3d', '7f744877f698', '2148eabc85f9'], stance_breaker_9: ['703b350360b0', '1ea7f84d2c1e', '1ea7f84d2c1e'],
  rookie_round_8: ['dc8d3f4bcff7', '71d9b6e8c855', '71d9b6e8c855'], first_bell: ['81d88a56be23', 'd4e92f114198', 'ef5a78f5eb51'],
  continue_bell: ['ef59b503265d', '36aec6ae7cbe', 'd311b3666013'], carry_on_15: ['90a2c0b4086f', '65123920c752', '65123920c752'],
  surge_20_10: ['92ac5424d5f4', '647484b5d919', '647484b5d919'], midline_lock: ['0115f51238fc', '5c7ba2acbb1d', '5c7ba2acbb1d'],
  leg_sweep: ['15cf673663de', '95be09d12abc', '95be09d12abc'], charge_up_12: ['c3db233e0e02', '7d4e2e62a564', '7d4e2e62a564'],
  oxygen_debt: ['61939f62a4e5', '0f90e3053f3d', '92902c2f9f79'], hot_laps: ['06917e62e76f', '70b8b60567c5', 'd7ec6f960329'],
};
const swapPrint = (m) => L.cardRows(m).map(r => ({ key: r.swapKey, opts: L.swapOptions(m, r.swapKey), reach: [...L.reachableMoves(m, r.swapKey).entries()] }));
const voicePrint = (m) => {
  const all = m.exercises;
  const ctx = (round, idx) => ({ round, idx, rounds: m.rounds, slotsPerRound: all.length, format: m.format });
  const out = [];
  for (let round = 1; round <= m.rounds; round += 1) all.forEach((slot, idx) => {
    const last = idx === all.length - 1;
    const next = last ? (round < m.rounds ? all[0] : null) : all[idx + 1];
    const restSec = slot.window ? M.windowRest(slot, S.estimateWorkSeconds(slot)) : slot.rest;
    out.push([M.leadLine(slot, ctx(round, idx)), M.countBeats(slot, { next }), M.paceBeats(slot), M.nearEndUpNextAt(slot, next), M.chainedLine(slot),
      next ? M.restScript({ restSec, roundEnd: last, completedRound: round, format: m.format, tips: m.tips, lead: M.leadLine(next, ctx(last ? round + 1 : round, last ? 0 : idx + 1)), short: M.shortRestLine(next) }) : null]);
  });
  return out;
};
const builtOf = (id, lv) => (IDS.includes(id) ? built[id][lv] : soloBuilt[id][lv]);
const soloTlChanged = SOLO_IDS.flatMap(id => LEVELS.filter((lv, i) => hash(S.soloTimeline(soloBuilt[id][lv])) !== TL_HASH_SOLO[id][i]).map(lv => `${id}/${lv}`));
const swapChanged = [...IDS, ...SOLO_IDS].flatMap(id => LEVELS.filter((lv, i) => hash(swapPrint(builtOf(id, lv))) !== SWAP_HASH[id][i]).map(lv => `${id}/${lv}`));
const voiceChanged = [...IDS, ...SOLO_IDS].flatMap(id => LEVELS.filter((lv, i) => hash(voicePrint(builtOf(id, lv))) !== VOICE_HASH[id][i]).map(lv => `${id}/${lv}`));
check('58 the 15 SOLO-only missions: timelines unchanged', soloTlChanged.length === 0, soloTlChanged.join(', '));
check('58 all 26: swap sheets and reachable swaps unchanged', swapChanged.length === 0, swapChanged.join(', '));
check('58 all 26: the guided voice unchanged', voiceChanged.length === 0, voiceChanged.join(', '));
// The until-down end is behind the mission flag: no other mission carries it,
// a safety line or an origin, and none runs the new format.
const flagLeak = [...IDS, ...SOLO_IDS].flatMap(id => LEVELS.filter(lv => {
  const m = builtOf(id, lv);
  return 'untilDown' in m || 'safety' in m || 'origin' in m || m.format === 'maxSets' || S.isUntilDown(m) || 'safety' in L.missionCardModel(m);
}).map(lv => `${id}/${lv}`));
check('58 all 26: no until-down flag, safety line, origin or MAX SETS', flagLeak.length === 0, flagLeak.join(', '));
// Every SOLO number a run reads, and the built mission and its card, pinned
// for all 26 the same way (taken at the commit before the owner's three):
// the clock and timeline, pace, prefills, + ROUND and the cap prefill,
// floors, the expected time, XP, the settle of six fixed results, and the
// guided integrity sizing. A for-time mission's timeline is empty, so this
// is what pins HONOR ROUNDS, BURNOUT 21 and the other for-time SOLO missions.
const soloPrint = (m) => {
  const results = [
    { completed: true, elapsedSec: 99999 }, { completed: true, elapsedSec: 1 }, { completed: true, capped: true, elapsedSec: m.capSec || 0 },
    { stopped: true, elapsedSec: 60 }, { stopped: true, elapsedSec: 300 }, { stopped: true, elapsedSec: 900 },
  ].map(r => S.settleSoloXp({ mode: 'solo', mission: m, format: m.format, totalSlots: S.totalSlots(m), completed: false, stopped: false, capped: false, score: null, ...r }));
  return {
    clock: S.missionClockSec(m), tl: S.soloTimeline(m), pace: S.paceTargets(m),
    pre: [0, 1, 3].map(n => S.prefillScore(m, { roundTaps: n, blockTaps: m.rounds > 1 ? Array(m.rounds).fill(n) : null })),
    rounds: S.soloRounds(m), thru: [0, 1, 2, 5].map(n => S.repsThrough(m, n)), rpr: S.repsPerRound(m),
    floor: S.soloFloorSec(m), exp: S.soloExpectedSec(m), slots: S.totalSlots(m), xp: S.fullRunXp(m), fixed: S.isFixedClock(m.format),
    est: S.estimateMissionSeconds(m), maxValid: S.qmMaxValidSeconds(m), units: S.qmTotalUnits(m), results,
  };
};
const SOLO_HASH = {
  iron_clock_16: ['3bc7f9b67392', 'bb9fba82249a', 'bb9fba82249a'], one_bell_300: ['ac6a46915f35', '7ac4ba1154a4', 'ebde131aeed4'],
  five_round_bout: ['bde2eb5f1313', 'fb425a87b738', '8397d6abbe80'], best_of_3: ['22c9b0fa9896', '4c2238a8ad76', '7f8b5ef6bbb9'],
  steel_plating: ['7e7f5f176b70', 'f4294cbc848c', '5ed8e4678854'], checkpoint_20: ['46b2abb15101', '1e7b1c512caa', 'a5f4671b3228'],
  room_12: ['168f255e69d6', '4a7e616d9bba', 'd7edcc50f9a3'], hit_combo_21: ['430a1bb972fe', '7dc4f84769de', '0a93e7e28f1c'],
  tutorial_stage: ['5026cacf3af2', 'e9a7a90d875c', 'cf0fe282ce5b'], turbo_button: ['bd3d2a5d6593', '54d902b976a9', '137da819e9da'],
  quota_300: ['062278ceadcd', 'eecb50c83d1b', '1af71e2f4fe1'], honor_rounds: ['1e8b7d351044', 'be1133c8c703', '9ae9d176a08b'],
  ko_sprint_30: ['067bc0a373e7', 'a9e3fe0dacb9', 'c1d4eff91726'], overhead_rush: ['04bd7f5b2fec', '7d0a858073e1', 'c7e541b75d05'],
  burnout_21: ['18235942a812', '22c923554124', '0c7eb6e1688e'], stance_breaker_9: ['001aa142d540', '41845f01a825', 'd9ef75e210cf'],
  rookie_round_8: ['ad3baae141da', '827ce0129ccf', '63336c524d9b'], first_bell: ['fef95ba2723d', 'dd61cf084aeb', 'c30771bfb364'],
  continue_bell: ['bda658b49f53', 'b51b53aedd0b', '34b97d230434'], carry_on_15: ['e2d77fe896c3', 'ea8b3cb73b16', 'e6ab5e0a4e61'],
  surge_20_10: ['b012e76af0f1', '41b56d81b6f2', '6ed1e7d7ee8f'], midline_lock: ['3e7c35fb3c45', '11b50c5a2eac', '349e3d5efd8c'],
  leg_sweep: ['a3b394310742', '130ddd0fad80', '4c928998eab8'], charge_up_12: ['1b99a65d181c', 'd6dcc47a63cd', 'cbda96a60b1d'],
  oxygen_debt: ['9b0d5e222121', '72b9fb6e0028', '293909baf8cd'], hot_laps: ['dc86c37d8506', '78b122049d9b', '07806fb67d53'],
};
const BUILT_HASH = {
  iron_clock_16: ['0e43ba6347f1', 'fa8284b7d3d8', 'f769e7de756d'], one_bell_300: ['8d374522f6e3', 'fd88b4a19296', '5d517fba399d'],
  five_round_bout: ['7302c33f3768', '17c6d70d3ddc', '3af7036b96f2'], best_of_3: ['cf087cf29409', 'dea4f95c20bd', 'afa97f26896b'],
  steel_plating: ['0682397f2e6c', '4e6ba47f3f79', '4e1b034ea8db'], checkpoint_20: ['e86d46886d15', '0a096e62eaab', '201829122eef'],
  room_12: ['5b2202a15ebb', '0dbbec144615', '09e427b30b54'], hit_combo_21: ['bd1561354ed7', 'd03712a9db6c', '44ebdaed0b48'],
  tutorial_stage: ['a1427dc5d604', '978c897c4bb8', 'f7fd7dd66894'], turbo_button: ['276bacc3b023', '2d4b71ce9358', 'f0bca4242c08'],
  quota_300: ['4bd4a1141d77', 'b47e5c094602', '1325afccc4b6'], honor_rounds: ['b33683b29a74', 'faa60d419eb6', '72e7b1f71482'],
  ko_sprint_30: ['214918e0a1b3', '6b8f14757b74', 'c61a611f7ee1'], overhead_rush: ['2fff3168ac53', '3bc0216e1a33', '8524ae7fcc9a'],
  burnout_21: ['303f33ad24c8', 'aa0519e3d6a5', '4d9af36c7216'], stance_breaker_9: ['9002405e74c9', '8d001b39e976', 'af63b794e763'],
  rookie_round_8: ['beaf2ccf0659', 'bc2c15ccbedc', 'b73c203aef5e'], first_bell: ['f240aa0f09c6', '069cb1e4b8aa', '3f1ac7f3e2f3'],
  continue_bell: ['59f3ae5255e7', '50a6c6dab50c', 'ea33be2c0371'], carry_on_15: ['464d944c580f', 'cae0461fbbee', 'f8c19e513618'],
  surge_20_10: ['613d3964de71', '4d4345a548ab', '25dea5cbc455'], midline_lock: ['f88ff07bc9de', 'ba01d3faba3f', '6f632bce1104'],
  leg_sweep: ['42c3b46294fc', '60781f627c5c', '810c257fd7b1'], charge_up_12: ['16564eeb0d31', '37da4ab00936', '17021f6fa947'],
  oxygen_debt: ['e9d610df1fa6', 'd135115032f7', '4f63da254223'], hot_laps: ['614accd7397e', '5ddab36992b4', 'd8337ff223a3'],
};
const CARD_HASH = {
  iron_clock_16: ['827ed9f13866', '60cae8658677', '60cae8658677'], one_bell_300: ['5bfb446c911b', '673ae58abd03', '791d1722d357'],
  five_round_bout: ['3700bd4930b0', 'fc2a8d01adce', 'fc2a8d01adce'], best_of_3: ['b3785c161f1a', '29b244d524d3', '5d8513278ce6'],
  steel_plating: ['c6caae2917bc', 'c9dcc2898f24', '927c04871c24'], checkpoint_20: ['2133d37beb9a', '16e76a56726b', '43106f74cf22'],
  room_12: ['509ebbae0a80', '734065d5e065', '2354016bc4b0'], hit_combo_21: ['13076e4fed83', '9c335dcb8ffd', '9c335dcb8ffd'],
  tutorial_stage: ['3328b0d41998', '0d317184d524', '936b6e1db6a0'], turbo_button: ['0b1c6fc4c869', 'deca2c40e4a5', 'deca2c40e4a5'],
  quota_300: ['6a0bf18a89a6', 'd42fc147281c', 'fc9599086d53'], honor_rounds: ['9b20dce416fc', 'b61a1c6067c5', '11b134916008'],
  ko_sprint_30: ['6f807f89d52a', '0000353d5e40', '61642158a666'], overhead_rush: ['61bed361e2f0', '9b862e53b4f1', '1b7c7003a297'],
  burnout_21: ['82c5f1bd0f7b', '877f53f747c9', '206f8f6c89bf'], stance_breaker_9: ['b84b516ee015', 'c3f562915d66', 'c3f562915d66'],
  rookie_round_8: ['e96e27e8812a', '7cde481725d6', '7cde481725d6'], first_bell: ['b5967e776ac9', '77e699b427d7', '77e699b427d7'],
  continue_bell: ['8f61fda9bf9b', '8b1da29041fb', '91dfb61d34a6'], carry_on_15: ['071e2877997c', '972c5a94f7b7', '972c5a94f7b7'],
  surge_20_10: ['e5357bc66e5f', '189b407ddf8a', '189b407ddf8a'], midline_lock: ['89a02529ab52', '53068a533838', '4a4fe5f03d34'],
  leg_sweep: ['3a6883722527', '37bdd69f7dd9', '37bdd69f7dd9'], charge_up_12: ['648f58bd2e0f', '032f4163168c', '032f4163168c'],
  oxygen_debt: ['86339deee4a2', 'b3e5d527ba10', '350d1f472f79'], hot_laps: ['3ddf306e0ee1', '1332f105db6c', 'f082d5179af4'],
};
// Built on a clean slate (no gear set), with the store put back after.
const pinChanged = (pins, print) => {
  const saved = new Map(store);
  const out = [...IDS, ...SOLO_IDS].flatMap(id => LEVELS.filter((lv, i) => { reset(); return hash(print(build(id, { level: lv }))) !== pins[id][i]; }).map(lv => `${id}/${lv}`));
  reset(); saved.forEach((v, k) => store.set(k, v));
  return out;
};
const soloMathChanged = pinChanged(SOLO_HASH, soloPrint);
const builtChanged = pinChanged(BUILT_HASH, (m) => m);
const cardChanged = pinChanged(CARD_HASH, (m) => L.missionCardModel(m));
check('58 all 26: SOLO clocks, pace, prefills, floors, XP and settles unchanged', soloMathChanged.length === 0, soloMathChanged.join(', '));
check('58 all 26: the built mission and its card unchanged', builtChanged.length === 0 && cardChanged.length === 0, `${builtChanged.join(', ')} ${cardChanged.join(', ')}`);

// No franchise, benchmark or person names anywhere a viewer reads.
const BANNED_ALL = [...BANNED, 'StrongFirst', 'Sinister', 'Tsatsouline', 'Pavel', 'Humane Burpee', 'Timothy', 'Davis', 'Hero WOD', 'Open 1', 'Open 2'];
const BANNED_WORDS = [/\bchief\b/i, /\bFran\b/, /\bHelen\b/, /\bGrace\b/, /\bLinda\b/, /\bCindy\b/, /\bDT\b/, /\bWOD\b/i];
const allStrings = [];
const walkAll = (v, key) => {
  if (key === 'knownAs') return;
  if (typeof v === 'string') allStrings.push(v);
  else if (Array.isArray(v)) v.forEach(x => walkAll(x));
  else if (v && typeof v === 'object') Object.entries(v).forEach(([k, x]) => walkAll(x, k));
};
ALL_IDS.forEach(id => LEVELS.forEach(lv => {
  const m = build(id, { level: lv });
  walkAll(m); walkAll(L.missionCardModel(m)); walkAll(S.paceTargets(m)); walkAll(S.soloTimeline(m).map(seg => seg.label));
  L.cardRows(m).forEach(r => walkAll(L.swapOptions(m, r.swapKey)));
}));
M.MOVES.forEach(m => { allStrings.push(m.name, m.say, ...(m.say1 ? [m.say1] : []), ...m.cues, ...m.alts.filter(a => a.stop).map(a => a.stop)); });
L.shelfEntries().forEach(e => allStrings.push(e.title, L.shelfEntryLine(e)));
const bannedAll = [...new Set(allStrings.filter(s => BANNED_ALL.some(b => b !== 'Chief' && s.toLowerCase().includes(b.toLowerCase())) || BANNED_WORDS.some(re => re.test(s))
  || knownAs.some(k => s.includes(k))))];
check('59 no franchise, benchmark or person names in any user text', bannedAll.length === 0 && SOLO_IDS.filter(id => L.missionDefById(id).knownAs).length === 10
  && OWN_IDS.every(id => L.missionDefById(id).knownAs === ''), bannedAll.join(' | '));

// Safety reaches the card and every swap: no flying knees for beginners, no
// jumps in a QUIET mission, a warm-up where the source asks for one, and the
// technique-safe swaps the source names (offered with their stop rule).
const safetyBad = [];
SOLO_IDS.forEach(id => LEVELS.forEach(lv => {
  const m = soloBuilt[id][lv];
  L.cardRows(m).forEach(r => {
    const reach = [...L.reachableMoves(m, r.swapKey).keys(), r.moveId];
    if (lv === 'beginner' && reach.some(k => M.moveById(k).flyingKnee)) safetyBad.push(`${id}/${lv} ${r.swapKey} flying knee`);
    if (m.quiet && reach.some(k => M.moveById(k).jumps)) safetyBad.push(`${id}/${lv} ${r.swapKey} jumps`);
  });
}));
const WARM_UP = ['honor_rounds', 'ko_sprint_30', 'overhead_rush', 'burnout_21', 'stance_breaker_9', 'first_bell', 'surge_20_10', 'charge_up_12', 'oxygen_debt', 'hot_laps'];
const noWarmUp = WARM_UP.filter(id => !/^Warm up|\. Warm up|Warm up \d/.test(L.missionCardModel(soloBuilt[id].standard).note));
check('60 safety: no flying knees for beginners, no jumps when QUIET', safetyBad.length === 0 && ['carry_on_15', 'midline_lock', 'leg_sweep'].every(id => L.missionDefById(id).quiet), safetyBad.join(', '));
check('60 safety: a warm-up line on every card that needs one', noWarmUp.length === 0, noWarmUp.join(', '));
const soloOpt = (id, lv, key, to) => L.swapOptions(soloBuilt[id][lv], key).find(o => o.id === to);
const baseOf = (id, lv, key) => keyItems(soloBuilt[id][lv], key)[0]?.moveId;
check('60 safety: technique-safe swaps for the Olympic lifts', soloOpt('honor_rounds', 'standard', 'jerk', 'bb-push-press')?.stop === 'Never been coached?'
  && soloOpt('honor_rounds', 'standard', 'clean', 'bb-hang-muscle-clean')?.stop === 'Never been coached?'
  && baseOf('honor_rounds', 'beginner', 'clean') === 'bb-hang-muscle-clean' && baseOf('honor_rounds', 'beginner', 'jerk') === 'bb-push-press'
  && soloOpt('ko_sprint_30', 'standard', 'clean-jerk', 'bb-hang-clean-push-press')?.stop === 'Never been coached?'
  && baseOf('ko_sprint_30', 'beginner', 'clean-jerk') === 'bb-hang-clean-push-press' && soloOpt('ko_sprint_30', 'beginner', 'clean-jerk', 'bb-clean-jerk')?.kind === 'harder'
  && soloBuilt.ko_sprint_30.beginner.missionLine === '30 HANG POWER CLEAN + PUSH PRESS SINGLES FOR TIME · CAP 10:00'
  && eq(M.moveById('bb-clean-jerk').alts.filter(a => a.kind === 'easier').map(a => a.id), ['bb-hang-clean-push-press'])
  && soloOpt('ko_sprint_30', 'standard', 'clean-jerk', 'bb-clean-press')?.kind === 'similar'
  && soloOpt('overhead_rush', 'standard', 'lift', 'bb-g2oh-three-step')?.stop === 'Never been coached?' && baseOf('overhead_rush', 'beginner', 'lift') === 'bb-g2oh-three-step'
  && soloOpt('burnout_21', 'standard', 'thruster', 'bb-front-squat-push-press')?.stop === 'Back arching on the press?'
  && soloOpt('hot_laps', 'elite', 'swing', 'kb-swing')?.stop === 'Never been coached?' && baseOf('hot_laps', 'standard', 'swing') === 'kb-swing'
  && soloOpt('first_bell', 'standard', 'get-up', 'half-get-up')?.stop === 'Shoulder pain?');
const stepOver = (id, lv) => soloOpt(id, lv, 'burpee', 'bar-step-over-burpee');
check('60 safety: a step-over for every bar-facing burpee, a no-jump option over the bell', ['overhead_rush', 'burnout_21'].every(id => stepOver(id, 'standard')?.stop === 'Clipping the bar?'
  && stepOver(id, 'elite') && baseOf(id, 'beginner', 'burpee') === 'bar-step-over-burpee') && !M.moveById('bar-step-over-burpee').jumps
  && L.swapOptions(soloBuilt.charge_up_12.standard, 'burpee').some(o => !M.moveById(o.id).jumps && o.stop === 'Knee pain?')
  && soloOpt('charge_up_12', 'standard', 'burpee', 'lateral-burpee')?.stop === 'Feet clipping the bell?'
  && cueHas('pull-up', 'Kip only if you already can') && cueHas('ring-row', 'Never row under a table'));

// A step note written for the base move only shows on the base move: a swap
// clears it and swapping back brings it back.
const rowNote = (m, key) => L.cardRows(m).find(r => r.swapKey === key)?.note ?? null;
const rkS = soloBuilt.rookie_round_8.standard;
const rkPush = L.swapMissionMove(rkS, 'press', 'bb-push-press');
const stS = soloBuilt.stance_breaker_9.standard;
check('60 step notes follow the row\'s own move', rowNote(rkS, 'press') === 'Pull the bar to the shoulders, no dip, then press.' && rowNote(rkPush, 'press') === null
  && rowNote(L.swapMissionMove(rkPush, 'press', 'bb-strict-press'), 'press') === rowNote(rkS, 'press')
  && rowNote(stS, 'rdl') === 'Deadlift the bar up once, then hinge to knee height.' && rowNote(L.swapMissionMove(stS, 'rdl', 'bb-deadlift'), 'rdl') === null
  && rowNote(L.swapMissionMove(stS, 'rdl', 'backpack-rdl'), 'rdl') === null && rowNote(soloBuilt.stance_breaker_9.beginner, 'rdl') === rowNote(stS, 'rdl'));

// FIRST BELL: a swing set every :30, then 1:00 of rest, then a get-up every
// minute, on one clock. The score is out of all 20 windows.
const fb = soloBuilt.first_bell.standard;
const fbTl = S.soloTimeline(fb);
const fbB = S.soloTimeline(soloBuilt.first_bell.beginner);
check('61 FIRST BELL: :30 sets, the rest, then minutes', fbTl.length === 21 && fbTl.slice(0, 10).every((seg, i) => seg.kind === 'work' && seg.sec === 30 && seg.label === `SET ${i + 1} · 10 One-Arm Swings` && seg.swapKey === 'swing')
  && fbTl[10].kind === 'rest' && fbTl[10].sec === 60 && fbTl.slice(11).every((seg, i) => seg.sec === 60 && seg.label === `MIN ${i + 1} · 1 Weighted Turkish Get-Up` && seg.swapKey === 'get-up')
  && fbB.length === 21 && fbB[0].label === 'MIN 1 · 10 Kettlebell Swings' && fbB[11].label === 'MIN 1 · 1 Turkish Get-Up' && fbB.reduce((n, seg) => n + seg.sec, 0) === 1260,
  show(fbTl.slice(9, 12)));
check('61 FIRST BELL: score out of 20, a swap keeps the window', S.heldOf(fb) === 20 && S.prefillScore(fb) === 20 && fb.scoreRule.label === 'SETS HELD'
  && S.paceTargets(fb)[0].text === '20/20 · sets ≤ 15s' && S.formatScore({ kind: 'minutesHeld', minutesHeld: 19, of: 20 }) === '19/20'
  && eq(doses(fb), ['10 × 10', '10 × 1']) && L.cardRows(fb)[0].prefix === 'EVERY :30'
  && S.soloTimeline(L.swapMissionMove(fb, 'swing', 'kb-swing'))[0].label === 'SET 1 · 10 Kettlebell Swings' && S.missionClockSec(L.swapMissionMove(fb, 'swing', 'kb-swing')) === 960);

// Ladders: a complex per rung, so + ROUND counts rungs and the cap prefill is
// the reps through the rungs tapped.
const bo21 = soloBuilt.burnout_21.standard;
const cb = soloBuilt.continue_bell.standard;
const od = soloBuilt.oxygen_debt.standard;
check('62 ladders: rungs as rounds, reps through the rungs', S.soloRounds(bo21) === 7 && S.repsPerRound(bo21) === 168 && S.repsThrough(bo21, 3) === 108 && S.repsThrough(bo21, 7) === 168
  && S.soloRounds(cb) === 10 && S.repsPerRound(cb) === 260 && S.repsThrough(cb, 1) === 35 && S.soloRounds(od) === 3 && S.repsPerRound(od) === 72
  && S.soloRounds(soloBuilt.honor_rounds.standard) === 5 && S.repsThrough(soloBuilt.honor_rounds.standard, 2) === 54
  && S.soloRounds(oneBell) === 5 && S.repsThrough(oneBell, 2) === 120);
check('62 ladders: the card reads every rung', eq(doses(bo21), ['21-18-15-12-9-6-3', '21-18-15-12-9-6-3']) && eq(doses(soloBuilt.burnout_21.beginner), ['15-12-9-6-3', '15-12-9-6-3'])
  && eq(doses(cb), ['15', '10→1', '10→1']) && eq(doses(soloBuilt.continue_bell.beginner), ['15', '5-4-3-2-1', '5-4-3-2-1']) && L.cardRows(cb)[0].note === 'Every rung.'
  && eq(doses(od), ['21-15-9', '12-9-6']) && eq(doses(L.swapMissionMove(bo21, 'burpee', 'bar-step-over-burpee')), ['21-18-15-12-9-6-3', '21-18-15-12-9-6-3']),
  show(doses(cb)));

// CHARGE UP 12: +2 every rung on the AMRAP clock, scored in total reps.
const cu = soloBuilt.charge_up_12.standard;
check('63 CHARGE UP: the climb, the prefill and the pace in reps', [[9, 180], [7, 112], [5, 60], [4, 40], [0, 0]].every(([n, r]) => S.repsThrough(cu, n) === r)
  && S.prefillScore(cu, { roundTaps: 7 }) === 112 && eq(S.paceTargets(cu).map(p => p.text), ['180+ reps', '112 reps', '60 reps'])
  && eq(doses(cu), ['2, 4, 6…', '2, 4, 6…']) && S.formatScore({ kind: 'reps', reps: 153, label: 'TOTAL REPS', value: 153 }) === '153'
  && eq(doses(L.swapMissionMove(cu, 'burpee', 'step-back-burpee')), ['2, 4, 6…', '2, 4, 6…']) && S.soloTimeline(cu)[0].label === 'AMRAP');

// HOT LAPS: the run is metres (a manual DONE), never reps in the score.
const hl = soloBuilt.hot_laps.standard;
const run = hl.exercises[0];
const rowed400 = L.swapMissionMove(hl, 'run', 'row-cal');
check('64 HOT LAPS: metres, never reps', run.unit === 'M' && M.slotDose(run) === '400 M' && run.cadenceMs === null && M.countBeats(run) === null
  && S.estimateWorkSeconds(run) === 150 && S.repsPerRound(hl) === 27 && S.repsPerRound(soloBuilt.hot_laps.elite) === 33 && S.repsThrough(hl, 2) === 54
  && rowed400.exercises[0].reps === 25 && rowed400.exercises[0].unit === 'CAL' && L.swapMissionMove(soloBuilt.hot_laps.beginner, 'run', 'row-cal').exercises[0].reps === 13
  && M.slotDose(L.swapMissionMove(hl, 'run', 'high-knees').exercises[0]) === '200 (100/leg)'
  && M.slotDose(L.swapMissionMove(rowed400, 'run', 'run').exercises[0]) === '400 M', show(run));
// The run row is scored: false, so a swap never puts the run into a capped
// score: rower calories and high knees stay out of the prefill and the cap
// stepper's top (27 a lap, 81 in all).
const kneed400 = L.swapMissionMove(hl, 'run', 'high-knees');
check('64 HOT LAPS: a swapped run still never scores', run.scored === false && kneed400.exercises[0].scored === false && kneed400.exercises[0].reps === 200
  && S.repsPerRound(rowed400) === 27 && S.repsPerRound(kneed400) === 27 && S.repsThrough(kneed400, 2) === 54 && S.repsPerRound(kneed400) * kneed400.rounds === 81
  && S.repsPerRound(L.swapMissionMove(soloBuilt.hot_laps.beginner, 'run', 'high-knees')) === 24
  && S.repsPerRound(L.swapMissionMove(soloBuilt.hot_laps.elite, 'run', 'row-cal')) === 33, show(kneed400.exercises[0]));

// SURGE 20/10: 8 rounds of 3 × 0:20 on / 0:10 off, the last rest not run.
const sg = soloBuilt.surge_20_10.standard;
const sgTl = S.soloTimeline(sg);
check('65 SURGE: the rotation and the lowest-round score', sgTl.length === 47 && sgTl.reduce((n, seg) => n + seg.sec, 0) === 710
  && eq(sgTl.slice(0, 6).map(seg => seg.label), ['Kettlebell Swings', 'REST', 'Goblet Thrusters', 'REST', 'Mountain Climbers', 'REST'])
  && S.prefillScore(sg) === 44 && eq(S.paceTargets(sg).map(p => p.text), ['46+', '37', '29']) && sg.scoreRule.agg === 'lowest');

// The shelf and the card for 12-26.
check('66 SOLO-only rows and cards', L.shelfEntryLine(L.shelfEntries().find(e => e.id === 'honor_rounds')) === '~8 MIN · BARBELL · FOR TIME'
  && L.shelfEntryLine(L.shelfEntries().find(e => e.id === 'first_bell')) === '~16 MIN · 1 BELL / DB · EMOM'
  && L.shelfEntryLine(L.shelfEntries().find(e => e.id === 'surge_20_10')) === '~12 MIN · 1 BELL / DB · INTERVALS'
  && L.filterShelf(L.shelfEntries(), { loadout: 'barbell' }).map(e => e.id).includes('honor_rounds')
  && ['carry_on_15', 'midline_lock', 'leg_sweep'].every(id => L.missionCardModel(soloBuilt[id].standard).tags.includes('QUIET'))
  && L.missionCardModel(soloBuilt.honor_rounds.standard).eyebrow === 'Mission · Barbell'
  && M.slotDose(keyItems(soloBuilt.midline_lock.standard, 'pull-through')[0]) === '10 (5/side)'
  && M.slotDose(keyItems(soloBuilt.carry_on_15.standard, 'lunge')[0]) === '10 (5/leg)');

// The card copy the review asked for: the full 1 BELL / DB version and its
// safety lines on HONOR ROUNDS, lb on every FIRST BELL load (and no promise
// to record the bell), a real step for women on LEG SWEEP, CHARGE UP's
// source order, OVERHEAD RUSH under BURPEES, and a rack-free Zercher pick-up.
const hrDef = L.missionDefById('honor_rounds');
const fbLoads = LEVELS.map(lv => soloBuilt.first_bell[lv].load);
check('66 card copy fixes', ['2 × 22.5/15 kg (50/35 lb)', '2 × 15/10 kg (35/20 lb)', 'AMRAP 8 of 8-6-4 with 2 × 7.5/5 kg (15/10 lb), strict press', 'hammer curl'].every(t => hrDef.scale.includes(t))
  && ['Shoulder pain? Drop the overhead: 12 deadlifts + 9 hang cleans.', 'Back rounding on the deadlifts? Go lighter, not faster'].every(t => hrDef.note.includes(t))
  && fbLoads.slice(1).every(t => (t.match(/ lb\)/g) || []).length === 4) && !/BELL YOU USED/.test(soloBuilt.first_bell.standard.scoreLine)
  && soloBuilt.leg_sweep.standard.load === 'M 8-12 kg (18-25 lb) / W 6-8 kg (13-18 lb)'
  && soloBuilt.charge_up_12.beginner.load.startsWith('15/10 kg (33/22 lb), or 10/5 kg') && soloBuilt.charge_up_12.standard.load === '15/10 kg (33/22 lb)'
  && eq(L.missionDefById('overhead_rush').themes, ['burpees']) && L.filterShelf(L.shelfEntries(), { loadout: 'barbell', theme: 'burpees' }).map(e => e.id).includes('overhead_rush')
  && cueHas('bb-zercher-squat', 'quarter-squat to rest it on your thighs') && M.moveById('bb-zercher-squat').cues.every(c => c.length <= 140),
  show(fbLoads));
// Short names where the phone cuts them off: FIRST BELL's swing rows (behind
// EVERY :30) and CHARGE UP 12's two rows.
check('66 short move names on FIRST BELL and CHARGE UP 12', LEVELS.every(lv => L.cardRows(soloBuilt.charge_up_12[lv]).every(r => r.name.length <= 21))
  && LEVELS.every(lv => L.cardRows(soloBuilt.first_bell[lv]).every(r => r.name.length <= 23)) && M.moveById('kb-one-arm-swing').name === 'One-Arm Swings',
  show(L.cardRows(soloBuilt.charge_up_12.standard).map(r => r.name)));

// ── the owner's three (27-29) ───────────────────────────────────────────────
reset();
const ownBuilt = {};
const ownProblems = [];
const OWN_RULE = { bar_fight: 'reps', touch_the_sky: 'time', no_continues: 'setsReps' };
for (const id of OWN_IDS) {
  ownBuilt[id] = {};
  const def = L.missionDefById(id);
  if (!eq(Object.keys(def.levels).sort(), [...LEVELS].sort()) || def.defaultLevel !== 'standard' || def.workoutType !== 'Weighted'
    || def.origin !== 'Coach TM original' || def.knownAs !== '' || def.guided !== true) ownProblems.push(`${id} def shape`);
  for (const lv of LEVELS) {
    const m = build(id, { level: lv });
    ownBuilt[id][lv] = m;
    const tag = `${id}/${lv}`;
    if (!m) { ownProblems.push(`${tag} null`); continue; }
    const card = L.missionCardModel(m);
    if (m.guided !== true || card.soloOnly || card.tags.includes('SOLO ONLY') || !card.guidedHelp || !m.introSay || m.origin !== 'Coach TM original') ownProblems.push(`${tag} not guided`);
    const its = items(m);
    if (its.some(it => !M.moveById(it.moveId))) ownProblems.push(`${tag} unknown move`);
    if (its.some(it => it.moveId !== it.baseMoveId || it.defaultMoveId !== it.baseMoveId) || m.scaled !== false || m.gearBanner !== null) ownProblems.push(`${tag} not at base`);
    if (m.exercises.some(sl => !Array.isArray(sl.list) && !('cadenceMs' in sl))) ownProblems.push(`${tag} slot missing cadenceMs`);
    if (m.exercises.some(sl => Array.isArray(sl.list) && sl.mode === 'reps' && sl.list.some(st => 'sides' in st || typeof st.cadenceMs !== 'number'))) ownProblems.push(`${tag} complex step`);
    if (!eq(JSON.parse(JSON.stringify(m)), m)) ownProblems.push(`${tag} JSON round-trip`);
    if (!LEVELS.every(t => typeof m.pace[t] === 'number')) ownProblems.push(`${tag} pace types`);
    if (m.scoreRule.kind !== OWN_RULE[id]) ownProblems.push(`${tag} scoreRule`);
    if ((m.format === 'forTime' || !!m.untilDown) !== (m.capSec > 0)) ownProblems.push(`${tag} capSec`);
    if (!m.loadoutLine || !m.missionLine || !m.scoreLine || !m.scale || !m.note || !m.load || !m.levelDetail || !/^Coach estimate/.test(m.paceBasis)) ownProblems.push(`${tag} card copy`);
    if (!/^Warm up \d/.test(card.note)) ownProblems.push(`${tag} warm-up`);
  }
}
check('67 the owner\'s three build at every level: GUIDED, a Coach TM original, no knownAs', ownProblems.length === 0, ownProblems.join('; '));
check('67 on the shelf: BAR FIGHT is barbell striking, all three GUIDED', eq(L.filterShelf(L.shelfEntries(), { loadout: 'barbell', theme: 'striking' }).map(e => e.id), ['bar_fight'])
  && L.shelfEntries().filter(e => OWN_IDS.includes(e.id)).every(e => e.soloOnly === false)
  && eq(OWN_IDS.map(id => L.shelfEntryLine(L.shelfEntries().find(e => e.id === id))), ['~13 MIN · BARBELL · INTERVALS', '~11 MIN · BARBELL · FOR TIME', '~5 MIN · 1 BELL / DB · MAX SETS']),
  show(OWN_IDS.map(id => L.shelfEntryLine(L.shelfEntries().find(e => e.id === id)))));

// Clocks, XP and timelines. NO CONTINUES' clock is its 30:00 safety cap, and
// its full-run XP is only the backstop's ceiling (a real run pays per set).
const OWN_CLOCKS = { bar_fight: [750, 510, 1020], touch_the_sky: [1200, 900, 1500], no_continues: [1800, 1800, 1800] };
const OWN_XP = { bar_fight: [330, 255, 405], touch_the_sky: [75, 60, 90], no_continues: [1380, 1380, 1380] };
const ownClockBad = [];
OWN_IDS.forEach(id => ORDER.forEach((lv, i) => {
  const m = ownBuilt[id][lv];
  if (m.clockSec !== OWN_CLOCKS[id][i] || S.missionClockSec(m) !== OWN_CLOCKS[id][i] || S.fullRunXp(m) !== OWN_XP[id][i]) ownClockBad.push(`${id}/${lv} ${m.clockSec} ${S.fullRunXp(m)}`);
}));
check('68 the owner\'s three: clocks and full-run XP', ownClockBad.length === 0, ownClockBad.join(', '));
const bf = ownBuilt.bar_fight.standard;
const bfTl = S.soloTimeline(bf);
// The owner's round as written: the four drills back to back, the bar down
// for the shadowbox, then the round's only rest.
check('68 BAR FIGHT: four 0:30 drills back to back, the shadowbox, 0:30 rest', bfTl.length === 23 && bfTl.reduce((n, seg) => n + seg.sec, 0) === 750
  && eq(bfTl.slice(0, 7).map(seg => `${seg.label}:${seg.sec}`), ['Explosive Front Presses:30', 'Explosive Overhead Presses:30', 'Barbell Uppercuts:30', 'Explosive Front Squats:30', 'Explosive Shadowboxing:45', 'REST:30', 'Explosive Front Presses:30'])
  && LEVELS.every(lv => ownBuilt.bar_fight[lv].exercises.every((sl, i) => sl.mode === 'timed' && sl.rest === (i === 4 ? 30 : 0) && (i === 4 || sl.work === 30)))
  && eq(LEVELS.map(lv => S.soloTimeline(ownBuilt.bar_fight[lv]).filter(seg => seg.kind === 'rest').length), [2, 3, 4])
  && LEVELS.every(lv => { const tl = S.soloTimeline(ownBuilt.bar_fight[lv]); return tl.reduce((n, seg) => n + seg.sec, 0) === ownBuilt.bar_fight[lv].clockSec && tl[tl.length - 1].kind === 'work'; })
  && eq(LEVELS.map(lv => ownBuilt.bar_fight[lv].exercises[4].work), [30, 45, 60]) && eq(LEVELS.map(lv => ownBuilt.bar_fight[lv].rounds), [3, 4, 5])
  && LEVELS.every(lv => Math.abs(ownBuilt.bar_fight[lv].clockSec - ownBuilt.bar_fight[lv].duration * 60) <= 60), show(bfTl.slice(0, 10)));
check('68 TOUCH THE SKY and NO CONTINUES have no fixed timeline', LEVELS.every(lv => S.soloTimeline(ownBuilt.touch_the_sky[lv]).length === 0 && S.soloTimeline(ownBuilt.no_continues[lv]).length === 0
  && ownBuilt.touch_the_sky[lv].duration * 60 <= ownBuilt.touch_the_sky[lv].capSec));

// Pace: ordered in every level, honest across levels (test 55's rule: a
// heavier for-time level is never faster, a heavier interval level never
// scores more; NO CONTINUES runs one cap at every level, so a heavier bell
// always means fewer sets), and BAR FIGHT's clock-end prefill (the pace
// count) never beats its own elite mark.
const ownPaceBad = [];
OWN_IDS.forEach(id => {
  const by = ownBuilt[id];
  LEVELS.forEach(lv => {
    const p = by[lv].pace;
    const ok = by[lv].format === 'forTime' ? p.elite < p.standard && p.standard < p.beginner && p.beginner <= by[lv].capSec : p.elite > p.standard && p.standard > p.beginner && p.beginner > 0;
    if (!ok || S.paceTargets(by[lv]).some(x => !x.text || /undefined|NaN/.test(x.text))) ownPaceBad.push(`${id}/${lv}`);
  });
  TIERS.forEach(t => {
    if (by.standard.format === 'forTime' && !(by.beginner.pace[t] <= by.standard.pace[t] && by.standard.pace[t] <= by.elite.pace[t])) ownPaceBad.push(`${id} ${t}`);
    if (by.standard.format === 'intervals' && !(by.elite.pace[t] <= by.standard.pace[t])) ownPaceBad.push(`${id} ${t} across`);
    if (by.standard.untilDown && !(by.elite.pace[t] <= by.standard.pace[t] && by.standard.pace[t] <= by.beginner.pace[t])) ownPaceBad.push(`${id} ${t} across`);
  });
});
check('69 the owner\'s three: pace ordered in every level and across levels', ownPaceBad.length === 0, ownPaceBad.join(', '));
check('69 BAR FIGHT: lowest front presses + uppercuts from the count, under its own elite', eq(LEVELS.map(lv => S.prefillScore(ownBuilt.bar_fight[lv])), [35, 44, 44])
  && LEVELS.every(lv => S.prefillScore(ownBuilt.bar_fight[lv]) <= ownBuilt.bar_fight[lv].pace.elite) && bf.scoreRule.agg === 'lowest' && eq(bf.scoreRule.keys, ['front-press', 'uppercut'])
  && eq(S.paceTargets(bf).map(p => p.text), ['48+', '42', '34']) && keyItems(ownBuilt.bar_fight.elite, 'front-press')[0].cadenceMs === 1250);
check('69 pace targets read: time with the rests, and sets', eq(S.paceTargets(ownBuilt.touch_the_sky.standard).map(p => p.text), ['≤ 9:30', '≤ 11:00', '≤ 13:00'])
  && eq(S.paceTargets(ownBuilt.no_continues.standard).map(p => p.text), ['12+ sets', '8 sets', '5 sets']));

// Swaps: every alt of every reachable move resolves; the new catalog entries
// have 2-4 alts with cues and a count; every loaded row offers a lighter swap,
// except NO CONTINUES' swings and rows, whose only lighter option is a lighter
// bell (its easier swing and its backpack rows would put the bell down).
const OWN_MOVES = M.MOVES.slice(135);
const ownAltBad = [];
OWN_IDS.forEach(id => LEVELS.forEach(lv => {
  const m = ownBuilt[id][lv];
  L.cardRows(m).forEach(r => {
    if (!r.canSwap) ownAltBad.push(`${id}/${lv} ${r.swapKey} cannot swap`);
    [r.moveId, ...L.reachableMoves(m, r.swapKey).keys()].forEach(mid => (M.moveById(mid)?.alts || [null]).forEach(a => { if (!a || !M.moveById(a.id)) ownAltBad.push(`${id}/${lv} ${mid}→${a?.id}`); }));
    L.swapOptions(m, r.swapKey).forEach(o => { if (!M.moveById(o.id) || !o.cues.length) ownAltBad.push(`${id}/${lv} option ${o.id}`); });
  });
}));
const ownMoveBad = OWN_MOVES.filter(mv => mv.alts.length < 2 || mv.alts.length > 4 || mv.cues.length < 2
  || (!mv.timedOnly && !(mv.cadence && mv.cadence.elite <= mv.cadence.standard && mv.cadence.standard <= mv.cadence.beginner))
  || (LOADED.includes(mv.gear) && !mv.alts.some(a => a.kind === 'easier' || a.kind === 'no-gear' || M.moveById(a.id).gear === 'none'))).map(mv => mv.id);
const NC_HEAVY_ONLY = ['swing2', 'row2', 'swing1', 'row1'];
const ownSheetBad = [];
OWN_IDS.forEach(id => LEVELS.forEach(lv => {
  const m = ownBuilt[id][lv];
  L.cardRows(m).forEach(r => {
    const lighter = L.swapOptions(m, r.swapKey).some(o => o.kind === 'easier' || o.kind === 'no-gear' || o.gear === 'none');
    const exempt = id === 'no_continues' && NC_HEAVY_ONLY.includes(r.swapKey);
    if (LOADED.includes(M.moveById(r.moveId).gear) && lighter === exempt) ownSheetBad.push(`${id}/${lv} ${r.swapKey}`);
  });
}));
check('70 every move and every reachable alt resolves, every row can swap', ownAltBad.length === 0, ownAltBad.slice(0, 6).join(', '));
check('70 17 new catalog entries: 2-4 alts, cues, a count per level, gear-aware', OWN_MOVES.length === 17 && ownMoveBad.length === 0
  && OWN_MOVES.every(mv => mv.cues.every(c => c.length <= 140)), `${OWN_MOVES.length} ${ownMoveBad.join(',')}`);
check('70 every loaded row offers a lighter swap (NO CONTINUES: a lighter bell for the swings and rows)', ownSheetBad.length === 0, ownSheetBad.join(', '));
check('70 named swaps: hang muscle cleans, RDLs for the good mornings, a push press, plate and no-gear punches',
  L.swapOptions(ownBuilt.touch_the_sky.standard, 'clean').find(o => o.id === 'bb-hang-muscle-clean')?.stop === 'Never been coached?'
  && L.swapOptions(ownBuilt.touch_the_sky.standard, 'good-morning').find(o => o.id === 'bb-rdl')?.stop === 'Low back rounding?'
  && L.swapOptions(ownBuilt.touch_the_sky.standard, 'press').some(o => o.id === 'bb-push-press')
  && L.swapOptions(bf, 'front-press').find(o => o.id === 'one-two')?.stop === 'Shoulder pinch?' && L.swapOptions(bf, 'front-press').some(o => o.id === 'plate-punch-out')
  && L.swapOptions(bf, 'uppercut').some(o => o.id === 'alt-uppercut') && L.swapOptions(ownBuilt.no_continues.standard, 'snatch')[0]?.stop === 'Bell banging the wrist?');

// Safety. BAR FIGHT: no swap below ELITE reaches a jump; ELITE is offered the
// hop. NO CONTINUES: no swap ever takes the bell out of the hand (a no-gear
// move or one that starts from the floor), BEGINNER never reaches a snatch,
// and its safety line is on the card.
const jumpsAt = (lv) => L.cardRows(ownBuilt.bar_fight[lv]).flatMap(r => [...L.reachableMoves(ownBuilt.bar_fight[lv], r.swapKey).keys()].filter(k => M.moveById(k).jumps));
const ncReach = (lv) => L.cardRows(ownBuilt.no_continues[lv]).flatMap(r => [...L.reachableMoves(ownBuilt.no_continues[lv], r.swapKey).keys()]);
const FLOOR = ['kb-deadlift', 'kb-suitcase-deadlift', 'kb-plank-pull-through', 'kb-knee-pull-through', 'db-devil-press', 'db-hip-thrust', 'kb-turkish-get-up', 'db-turkish-get-up'];
check('71 BAR FIGHT: no jump below ELITE, the hop offered at ELITE', jumpsAt('beginner').length === 0 && jumpsAt('standard').length === 0
  && L.swapOptions(ownBuilt.bar_fight.elite, 'front-squat').find(o => o.id === 'bb-front-squat-hop')?.kind === 'harder'
  && !L.isSwapAllowed(ownBuilt.bar_fight.standard, 'front-squat', 'bb-front-squat-hop') && M.moveById('bb-front-squat-hop').jumps === true, show(jumpsAt('standard')));
check('71 NO CONTINUES: the bell never leaves the hand through a swap', LEVELS.every(lv => ncReach(lv).every(k => M.moveById(k).gear !== 'none' && !FLOOR.includes(k)))
  && !ncReach('beginner').some(k => /snatch/.test(k)) && keyItems(ownBuilt.no_continues.beginner, 'snatch')[0].moveId === 'kb-one-arm-high-pull'
  && keyItems(ownBuilt.no_continues.standard, 'snatch')[0].moveId === 'kb-snatch', show(ncReach('standard')));
const ncCard = L.missionCardModel(ownBuilt.no_continues.standard);
check('71 NO CONTINUES: the safety line on the card, only there', ncCard.safety === 'Grip starting to open? Park the bell between your feet. Never let it fly.'
  && ownBuilt.no_continues.standard.safety === ncCard.safety && OWN_IDS.filter(id => L.missionCardModel(ownBuilt[id].standard).safety).length === 1
  && /park the bell between your feet/i.test(ownBuilt.no_continues.standard.introSay));
check('71 TOUCH THE SKY and BAR FIGHT: the card rules', /press can handle for 5/.test(ownBuilt.touch_the_sky.standard.note) && /Don't put the bar down inside a round/.test(ownBuilt.touch_the_sky.standard.note)
  && /Low back rounding on the good mornings\? Stop the round/.test(ownBuilt.touch_the_sky.standard.note) && /Only ELITE may add a small hop/.test(bf.note)
  && cueHas('bb-punch-out', 'Core braced, shoulders down') && cueHas('explosive-shadowbox', 'Set the bar down first'));

// The guided voice: BAR FIGHT paces every bar drill and calls what is next;
// TOUCH THE SKY counts all 45 reps at a strength cadence and calls each lift;
// NO CONTINUES leads the first block and calls every switch after it.
check('72 BAR FIGHT: leads, pace counts, near-end calls', M.leadLine(bf.exercises[0], ctxFor(bf, 1, 0)) === 'Round 1. Explosive front presses. 30 seconds.'
  && eq(bf.exercises.map(M.paceBeats), [{ ms: 1250, n: 24 }, { ms: 1750, n: 17 }, { ms: 1500, n: 20 }, { ms: 2000, n: 15 }, null])
  && bf.exercises.every((sl, i) => M.nearEndUpNextAt(sl, bf.exercises[(i + 1) % 5]) === 8)
  && eq([0, 1, 2, 3].map(i => M.restPlan(bf.exercises[i].rest)), ['chain', 'chain', 'chain', 'chain']) && M.restPlan(bf.exercises[4].rest) === 'long'
  && eq(bf.exercises.slice(1).map(sl => M.chainedLine(sl)), ['Explosive overhead presses. Go.', 'Barbell uppercuts. Go.', 'Explosive front squats. Go.', 'Explosive shadowboxing. Go.'])
  && M.restScript({ restSec: 30, roundEnd: true, completedRound: 1, format: bf.format, tips: bf.tips, lead: M.leadLine(bf.exercises[0], ctxFor(bf, 2, 0)), short: M.shortRestLine(bf.exercises[0]) }).opener === 'Round 1 complete. Rest. 30 seconds. Shoulders down, core braced.',
  show(bf.exercises.slice(1).map(sl => M.chainedLine(sl))));
const sky = ownBuilt.touch_the_sky.standard;
const skyBeats = M.countBeats(sky.exercises[0], { next: sky.exercises[0] });
check('72 TOUCH THE SKY: 45 counted reps, each lift called, 2:08 at the count', skyBeats.length === 45 && skyBeats.reduce((n, b) => n + b.ms, 0) === 128000
  && eq(skyBeats.filter(b => /\. /.test(b.say)).map(b => b.say), ['5. Hang power cleans.', '5. Good mornings.', '5. Front squats.', '5. Strict presses.', '5. Front squats.', '5. Good mornings.', '5. Hang power cleans.', '5. Deadlifts.'])
  && skyBeats[44].say === '5' && skyBeats[0].ms === 3000 + 2500 && M.countBeats(ownBuilt.touch_the_sky.beginner.exercises[0]).length === 27
  && M.restScript({ restSec: 120, roundEnd: true, completedRound: 1, format: 'forTime', tips: sky.tips, lead: M.leadLine(sky.exercises[0], ctxFor(sky, 2, 0)), short: M.shortRestLine(sky.exercises[0]) }).opener === 'Round 1 complete. Rest. 120 seconds. Pick a load your press can handle for 5.',
  show(skyBeats.filter(b => /\. /.test(b.say)).map(b => b.say)));
check('72 TOUCH THE SKY: the card reads down and back', eq(doses(sky), ['2 × 5', '2 × 5', '2 × 5', '2 × 5', '5']) && eq(doses(ownBuilt.touch_the_sky.beginner), ['2 × 3', '2 × 3', '2 × 3', '2 × 3', '3'])
  && S.soloRounds(sky) === 3 && S.repsPerRound(sky) === 45 && S.repsThrough(sky, 2) === 90 && sky.scoreLine.includes('(135 FINISHES)') && sky.exercises[0].rest === 120, show(doses(sky)));
const nc = ownBuilt.no_continues.standard;
const ncCtx = { round: 1, idx: 0, rounds: 1, slotsPerRound: 3, format: nc.format }; // the runner passes rounds: 1 (no 'Round 1.')
const ncBeats = M.countBeats(nc.exercises[0], { next: null });
check('72 NO CONTINUES: the first lead, the count, every switch', M.leadLine(nc.exercises[0], ncCtx) === '3 swings, 3 rows, 3 high pulls, 3 presses. Both hands. Ready? On my count.'
  && eq(ncBeats.map(b => b.say), ['1', '2', '3. Rows.', '1', '2', '3. High pulls.', '1', '2', '3. Presses.', '1', '2', '3']) && ncBeats[0].ms === 2000 + 1750
  && eq(nc.exercises.map(M.switchLine), ['Switch: both hands.', 'Switch: left arm.', 'Switch: right arm.']) && nc.exercises.every(sl => sl.rest === 0)
  && M.countBeats(ownBuilt.no_continues.elite.exercises[1]).length === 20 && M.countBeats(ownBuilt.no_continues.beginner.exercises[2]).some(b => b.say === '3. High pulls.')
  && eq(L.cardRows(nc).map(r => r.name), ['Two-Hand Swings', 'Two-Hand Rows', 'Two-Hand High Pulls', 'Two-Hand Presses', 'One-Arm Swings', 'One-Arm Rows', 'Kettlebell Snatches', 'One-Arm Presses']),
  show(ncBeats.map(b => b.say)));
// The same timing invariants as test 37, on the owner's three.
const ownInv = [];
OWN_IDS.forEach(id => LEVELS.forEach(lv => {
  const m = ownBuilt[id][lv];
  const ctx = (r, i) => ({ ...ctxFor(m, r, i), rounds: m.untilDown ? 1 : m.rounds });
  const L0 = M.leadLine(m.exercises[0], ctx(1, 0));
  const R = M.getReadySeconds(L0);
  const at = M.announceAt(R, L0);
  if (at === null || at - M.speechSeconds(L0) < 4 || at > R - 1) ownInv.push(`${id}/${lv} get ready`);
  m.exercises.forEach((slot, idx) => {
    const last = idx === m.exercises.length - 1;
    const next = m.exercises[last ? 0 : idx + 1];
    const lead = M.leadLine(next, ctx(last ? 2 : 1, last ? 0 : idx + 1));
    const sc = M.restScript({ restSec: slot.rest, roundEnd: last, completedRound: 1, format: m.format, tips: m.tips, lead, short: M.shortRestLine(next) });
    if (slot.rest >= 11 && !(sc.plan === 'long' && sc.leadAt - M.speechSeconds(sc.lead) >= 4 && slot.rest - M.speechSeconds(sc.opener) >= sc.leadAt)) ownInv.push(`${id}/${lv} s${idx} long`);
    if (sc.plan === 'short' && sc.countdown && slot.rest - M.speechSeconds(sc.short) < 3) ownInv.push(`${id}/${lv} s${idx} short`);
  });
}));
check('72 timing invariants on the owner\'s three', ownInv.length === 0, ownInv.join('; '));

// NO CONTINUES: until the bell is down. One clock to the 30:00 cap, + SET
// taps, and I PUT IT DOWN as a FINISH paid for the sets done.
check('73 NO CONTINUES: the flag, the cap clock, sets and blocks', S.isUntilDown(nc) && nc.format === 'maxSets' && L.FORMAT_LABEL.maxSets === 'MAX SETS'
  && OWN_IDS.filter(id => S.isUntilDown(ownBuilt[id].standard)).length === 1 && !S.isFixedClock(nc.format)
  && S.missionClockSec(nc) === 1800 && S.soloExpectedSec(nc) === 1800 && S.repsPerSet(nc) === 12 && S.repsPerSet(ownBuilt.no_continues.elite) === 20
  && eq([0, 1, 2, 3, 7].map(n => S.setBlock(nc, n).sideSay), ['both hands', 'left arm', 'right arm', 'both hands', 'left arm'])
  && eq(S.prefillScore(nc, { roundTaps: 9 }), { sets: 9, reps: 0 }) && S.repsThrough(nc, 3) === 36 && S.soloRounds(nc) === 90
  && S.formatScore({ kind: 'setsReps', sets: 9, reps: 4, timeSec: 372, value: 112 }) === '9 + 4' && S.soloFloorSec(nc) === 11 && S.soloSetFloorSec(ownBuilt.no_continues.elite) === 18);
// The guided count can never run out of rounds before the cap: the cap ends it.
const cycleSec = (m) => m.exercises.reduce((n, sl) => n + M.countBeats(sl).reduce((t, b) => t + b.ms, 0) / 1000, 0);
check('73 NO CONTINUES: the 30:00 cap always comes before the last round', LEVELS.every(lv => cycleSec(ownBuilt.no_continues[lv]) * ownBuilt.no_continues[lv].rounds > 1800 && ownBuilt.no_continues[lv].capSec === 1800),
  LEVELS.map(lv => cycleSec(ownBuilt.no_continues[lv])).join(' '));
const downScore = (sets, reps = 0, timeSec = 0, capped = false) => ({ kind: 'setsReps', sets, reps, timeSec, value: sets * 12 + reps, ...(capped ? { capped: true } : {}) });
const ncSettle = (o) => S.settleSoloXp({ mode: 'solo', mission: nc, format: nc.format, completed: false, stopped: false, capped: false, ...o });
const nPut = ncSettle({ completed: true, score: downScore(10, 4, 300), elapsedSec: 300, totalSlots: 10 });
const nFast = ncSettle({ completed: true, score: downScore(10, 0, 30), elapsedSec: 30 });
const nZero = ncSettle({ completed: true, score: downScore(0, 5, 20), elapsedSec: 20 });
const nStop = ncSettle({ stopped: true, score: null, elapsedSec: 400 });
const nCap = ncSettle({ completed: true, capped: true, score: downScore(50, 0, 1800, true), elapsedSec: 1800 });
const nOver = ncSettle({ completed: true, score: downScore(500, 0, 1800), elapsedSec: 1800 });
check('74 NO CONTINUES SOLO: I PUT IT DOWN is a finish paid for the sets done', nPut.outcome === 'pass' && nPut.xp === 15 * 10 + 30 && nPut.message === null && nPut.credited === 10
  && nFast.outcome === 'pass' && nFast.credited === 2 && nFast.xp === 60 && /2 of 10 sets/.test(nFast.message)
  && nZero.xp === 0 && nZero.outcome === 'none' && nZero.message === S.DOWN_NO_SET_MESSAGE
  && nStop.xp === 0 && nStop.outcome === 'none' && nStop.message === S.DOWN_STOP_MESSAGE
  && nCap.outcome === 'pass' && nCap.xp === 15 * 50 + 30 && nOver.credited === 90 && nOver.xp === S.fullRunXp(nc),
  show([nPut, nFast, nZero, nStop, nCap, nOver].map(x => `${x.outcome}:${x.xp}`)));
// The cap ends it, GUIDED and SOLO alike: the run clock reaching 30:00 is a
// finish on the cap's time, and only an until-down mission reads it.
const capScore = S.downScore(nc, { sets: 50, reps: 3, end: 'cap', timeSec: 1801 });
const capSettle = ncSettle({ completed: true, capped: true, score: capScore, elapsedSec: 1800 });
check('74 NO CONTINUES: the 30:00 cap ends the run as a finish on the cap\'s time', !S.downCapReached(nc, 1799.9) && S.downCapReached(nc, 1800) && S.downCapReached(nc, 2400)
  && !S.downCapReached(built.one_bell_300.standard, 1800) && !S.downCapReached(soloBuilt.honor_rounds.standard, 99999)
  && eq(capScore, { kind: 'setsReps', sets: 50, reps: 3, timeSec: 1800, value: 603, capped: true })
  && capSettle.outcome === 'pass' && capSettle.xp === 15 * 50 + 30 && capSettle.message === null,
  show([capScore, capSettle]));
check('74 NO CONTINUES: I PUT IT DOWN keeps the time tapped; reps never make a whole set', eq(S.downScore(nc, { sets: 9, reps: 4, end: 'down', timeSec: 372.6 }), { kind: 'setsReps', sets: 9, reps: 4, timeSec: 372, value: 112 })
  && S.downScore(nc, { sets: 2, reps: 15, timeSec: 60 }).reps === 11 && S.downScore(ownBuilt.no_continues.elite, { sets: 1, reps: 30 }).reps === 19
  && S.formatScore(S.downScore(nc, { sets: 9, reps: 4, timeSec: 372 })) === '9 + 4' && S.downScore(nc, { sets: -3, reps: -1 }).value === 0);
check('74 NO CONTINUES GUIDED pays the same as SOLO: 15 a set plus the finish bonus', [1, 7, 12, 30].every(n => US.quickMissionXp(n, n, true) === S.downXp(n)) && S.downXp(0) === 0
  && O.resolveOutcome({ completed: 9, total: 9, difficulty: 'Hard', integrityResult: null }).outcome === 'pass');
// GUIDED: the integrity session is judged on the cycles the run actually ran.
// The cycle the bell came down in counts when a block of it finished, and is
// dropped when none did. Every other session is unchanged (endRunHere is
// only called by the until-down runner).
let clk = 1_800_000_000_000;
const realNow2 = Date.now;
Date.now = () => clk;
const ncRules = S.qmIntegrityRules(nc);
const cycles = (n, partSec, keep) => {
  const sess = new I.IntegritySession('quickMission', S.qmTotalUnits(nc), ncRules);
  for (let u = 0; u < n; u += 1) { sess.startUnit('rounds'); clk += 82_000; sess.completeUnit(); }
  sess.startUnit('rounds'); clk += partSec * 1000;
  sess.endRunHere(keep);
  return sess.finalize();
};
const ir3 = cycles(3, 30, true);
const ir2 = cycles(2, 3, false);
Date.now = realNow2;
check('74 NO CONTINUES GUIDED: a finished run whatever cycle it ended in', ir3.isFullyValid && ir3.totalRequiredUnits === 4 && ir3.validityStatus === 'complete' && ir3.awardXp
  && ir2.isFullyValid && ir2.totalRequiredUnits === 2 && O.resolveOutcome({ completed: 7, total: 7, difficulty: 'Hard', integrityResult: ir3 }).outcome === 'pass'
  && S.qmMaxValidSeconds(nc) === 600, show([ir3.validityStatus, ir3.totalRequiredUnits, ir2.validityStatus, ir2.totalRequiredUnits]));

// ── prefs and tapes ─────────────────────────────────────────────────────────
reset();
check('51 prefs default', eq(L.loadShelfPrefs(), { loadout: 'all', theme: 'all', mode: 'guided', levels: {} }));
L.saveShelfPrefs({ loadout: 'bell', mode: 'solo', levels: { quota_300: 'elite' } });
L.saveShelfPrefs({ theme: 'striking', levels: { room_12: 'beginner' } });
check('51 prefs round-trip; levels merge per mission', eq(L.loadShelfPrefs(), { loadout: 'bell', theme: 'striking', mode: 'solo', levels: { quota_300: 'elite', room_12: 'beginner' } }));
store.set(L.SHELF_PREFS_KEY, '{not json');
check('51 corrupt prefs read as defaults', eq(L.loadShelfPrefs(), { loadout: 'all', theme: 'all', mode: 'guided', levels: {} }));
const boom = () => { throw new Error('blocked'); };
globalThis.localStorage = { getItem: boom, setItem: boom, removeItem: boom };
let threw = false;
let blocked = null;
try { blocked = [L.loadShelfPrefs(), L.saveShelfPrefs({ loadout: 'none' }), [...L.gearProfile()], build('turbo_button')]; } catch { threw = true; }
check('51 a throwing localStorage never throws', !threw && eq(blocked[0], { loadout: 'all', theme: 'all', mode: 'guided', levels: {} }) && blocked[1].loadout === 'none'
  && eq(blocked[2], ['none']) && blocked[3]?.id === 'turbo_button');
globalThis.localStorage = memStore;
reset();
check('52 Tape #03 is live as a Quick Mission, and the mission exists', T.TAPES.find(t => t.id === 'kb-01').live === 'Live · Quick Mission' && !!L.missionDefById('one_bell_300'));

// ── card model ──────────────────────────────────────────────────────────────
const card = L.missionCardModel(turboStd);
check('card model: tags, accent, rows, help', eq(card.tags, ['~9 MIN', 'NORMAL']) && card.accentTag === 'STRIKING' && card.rows.length === 4 && card.soloOnly === false
  && card.guidedHelp === 'The coach calls the wipers and sets the pace on every burst.' && card.banner === null);
const hitCard = L.missionCardModel(hit);
check('card model: 21-HIT is SOLO only', hitCard.soloOnly === true && hitCard.tags.includes('SOLO ONLY') && hitCard.accentTag === null);
check('card model: SCALED tag after a swap', L.missionCardModel(quotaSb).tags.includes('SCALED') && L.cardRows(quotaSb)[0].undoable === true && L.cardRows(quotaSb)[0].swapped === true);
const opt = L.swapOptions(check20, 'shadowbox')[0];
check('swap option doses', opt?.id === 'row-cal' && opt.doseFrom === '40s' && opt.doseTo === '12 CAL' && opt.label === 'SIMILAR' && opt.gearLabel === 'ROWER' && opt.cues.length >= 2
  && L.swapOptions(hit, 'back-squat')[0].doseTo === '6 (3/leg)' && L.swapOptions(hit, 'back-squat')[0].doseFrom === '3');
check('levelsOf', eq(L.levelsOf(L.missionDefById('quota_300')).map(l => l.id), ['beginner', 'standard', 'elite']) && L.levelsOf(L.missionDefById('quota_300'))[2].label === 'ELITE');
check('unknown mission / level is null', build('nope') === null && build('fx_box', { level: 'elite' }) === null);
check('level change drops a swap that no longer applies', build('quota_300', { level: 'standard', swaps: { burpee: 'burpee-tuck-jump' } }).scaled === false
  && build('quota_300', { level: 'beginner', swaps: { burpee: 'burpee-tuck-jump' } }).scaled === true);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
