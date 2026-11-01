// Quick Mission v2: the gate, the move catalog, the 11 launch missions, the
// shelf, swaps and safety, the voice and timing helpers, integrity sizing
// (ungated fix a), SOLO maths, shelf prefs and the tape line. Run with
// `npm run test:missions`.
import { isDeepStrictEqual } from 'node:util';

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
check('3 80 unique move ids', M.MOVES.length === 80 && new Set(ids).size === 80, `${M.MOVES.length}`);
const badField = M.MOVES.filter(m => {
  const cadOk = m.cadence === null || (['elite', 'standard', 'beginner'].every(l => Number.isInteger(m.cadence[l]) && m.cadence[l] >= 500 && m.cadence[l] <= 6000) && Object.keys(m.cadence).length === 3);
  const manual = m.cadence === null && (m.unit === 'reps' || m.unit === 'cal');
  return !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(m.id) || !m.name || !m.say || !PATTERNS.includes(m.pattern) || !M.GEAR_TAGS.includes(m.gear)
    || !['reps', 'secs', 'cal'].includes(m.unit) || !cadOk
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
check('8 11 defs, ids and titles in launch order', eq(L.LOADOUT_MISSIONS.map(d => d.id), IDS) && eq(L.LOADOUT_MISSIONS.map(d => d.title), TITLES) && L.LOADOUT_MISSIONS.every((d, i) => d.launch === i + 1));
check('8 only 21-HIT is SOLO only; guided help everywhere else', L.LOADOUT_MISSIONS.every(d => (d.id === 'hit_combo_21' ? d.guided === false : d.guided === true && d.guidedHelp.length > 0))
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
check('15 shelf: 28 entries, v2 first', shelf.length === 28 && shelf.slice(0, 11).every(e => e.kind === 'v2') && shelf.slice(11).every(e => e.kind === 'classic')
  && eq(shelf.slice(0, 11).map(e => e.id), IDS));
const loCount = (lo) => L.filterShelf(shelf, { loadout: lo }).length;
check('16 loadout counts', loCount('none') === 18 && loCount('bell') === 3 && loCount('barbell') === 2 && loCount('mixed') === 5,
  ['none', 'bell', 'barbell', 'mixed'].map(loCount).join('/'));
const tAll = L.themeCounts(shelf, 'all');
check('17 theme counts', tAll.all === 28 && tAll.striking === 9 && tAll.burpees === 2 && tAll.century === 3
  && L.themeCounts(shelf, 'barbell').striking === 0 && L.themeCounts(shelf, 'bell').striking === 1, show(tAll));
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
