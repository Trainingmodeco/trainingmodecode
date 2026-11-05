// MAX OUT: five max-rep workouts (BOSS RUSH, HEALTH BAR, COMBO METER, TANK MODE,
// DUAL WIELD) and the MAX REPS format they run on. The data and the swap rules
// (79), the two new catalog moves (80), the coach's words (81), the XP, floors
// and caps (82), the rep limits (83), the saved score (84), both settles (85),
// the integrity sizing (86), Build Workout's hand-off (87) and the screen
// guides (88); then the review fixes: swaps that never move the XP or break a
// cap (89), the swaps and moves no MAX OUT may reach (90), stop lines that
// agree with their cues (91), the cap, zero-rep and short-set settles (92),
// the cap said aloud (93), copy that agrees with the data (94), the one-shot
// hand-off (95) and the level word (96). The 31 earlier missions are pinned in
// test-missions.mjs; this file only tests what is new.
// Run with `npm run test:maxout`.
import { isDeepStrictEqual } from 'node:util';

const store = new Map();
globalThis.localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k),
};
const M = await import('../components/training-mode/data/missionMoves.js');
const L = await import('../components/training-mode/data/loadoutMissions.js');
const S = await import('../components/training-mode/data/missionSolo.js');
const G = await import('../components/training-mode/shared/screenGuides.js');

let pass = 0, fail = 0;
const check = (name, cond, extra = '') => { if (cond) { pass++; console.log(`  ok   ${name}`); } else { fail++; console.log(`  FAIL ${name}  ${extra}`); } };
const eq = isDeepStrictEqual;
const show = (v) => JSON.stringify(v);
const LEVELS = ['beginner', 'standard', 'elite'];
const IDS = ['boss_rush', 'health_bar', 'combo_meter', 'tank_mode', 'dual_wield'];
const TITLES = ['BOSS RUSH', 'HEALTH BAR', 'COMBO METER', 'TANK MODE', 'DUAL WIELD'];
const build = (id, level = 'standard', opts = {}) => L.buildLoadoutMission(id, { level, ...opts });
const every = (fn) => IDS.flatMap(id => LEVELS.map(lv => fn(id, lv, build(id, lv))));
const ctxFor = (m, round, idx) => ({ round, idx, rounds: m.rounds, slotsPerRound: m.exercises.length, format: m.format });
// n saved sets of the mission, `reps` and `sec` each (or a function of the set).
const entries = (m, n, reps = 10, sec = 30) => Array.from({ length: n }, (_, i) => ({ reps: typeof reps === 'function' ? reps(i) : reps, sec: typeof sec === 'function' ? sec(i) : sec }));
const scoreOf = (m, es, o = {}) => S.maxRepsScore(m, es, { timeSec: 600, ...o });
// The settles as App calls them.
const solo = (m, es, o = {}) => S.settleSoloXp({ mode: 'solo', mission: m, score: es ? scoreOf(m, es, { timeSec: o.elapsedSec ?? 600, capped: !!o.capped }) : null, completed: true, elapsedSec: 800, ...o });
const guided = (m, es, o = {}) => S.settleGuidedXp({ mission: m, score: es ? scoreOf(m, es, { timeSec: o.elapsedSec ?? 600, capped: !!o.capped }) : null, completed: true, elapsedSec: 800, skipped: 0, ...o });
// The same mission run with three rounds, the way the spec's worked examples are written.
const rounds3 = (m) => ({ ...m, rounds: 3 });
const strings = (v, out = []) => {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach(x => strings(x, out));
  else if (v && typeof v === 'object') Object.entries(v).forEach(([k, x]) => { if (k !== 'knownAs') strings(x, out); });
  return out;
};

// ── 79 · the five defs ───────────────────────────────────────────────────────
const defs = IDS.map(id => L.missionDefById(id));
check('79 five defs, launch 32-36, MAX REPS, theme MAX OUT, GUIDED with the one help line', defs.every((d, i) => d && d.title === TITLES[i] && d.launch === 32 + i
  && d.format === 'maxReps' && eq(d.themes, ['maxout']) && d.tag === 'Max Reps' && d.guided === true
  && d.guidedHelp === 'The coach calls each move and the rests. You tap DONE and enter your reps.'
  && d.scoreLine === 'TOTAL REPS, EVERY SET ADDED' && eq(d.scoreRule, { kind: 'totalReps', label: 'TOTAL REPS' }) && d.defaultLevel === 'standard'
  && d.origin === 'Coach TM original' && d.knownAs === ''));
check('79 loadouts and rooms as the spec has them', eq(defs.map(d => d.loadout), ['none', 'mixed', 'bell', 'barbell', 'mixed'])
  && eq(defs.map(d => [d.hotel, d.quiet]), [[true, true], [false, false], [false, false], [false, false], [true, false]])
  && eq(defs.map(d => d.workoutType), ['Bodyweight', 'Bodyweight', 'Weighted', 'Weighted', 'Hybrid']));
check('79 the chip: MAX OUT after CENTURY, its help line, the format word', eq(L.THEMES.map(t => t.id).slice(-2), ['century', 'maxout'])
  && eq(L.THEMES.find(t => t.id === 'maxout'), { id: 'maxout', label: 'MAX OUT', help: 'Max reps on a move, then switch.' })
  && L.FORMAT_LABEL.maxReps === 'MAX REPS' && L.formatLabelOf(defs[0]) === 'MAX REPS');

const problems = [];
every((id, lv, m) => {
  const tag = `${id}/${lv}`;
  if (!m) { problems.push(`${tag} null`); return; }
  if (m.format !== 'maxReps' || !S.isMaxReps(m)) problems.push(`${tag} format`);
  if (m.exercises.some(sl => sl.max !== true || sl.cadenceMs !== null || 'sides' in sl || sl.mode !== 'reps' || !M.moveById(sl.moveId) || !(sl.reps >= 1) || !(sl.rest > 0))) problems.push(`${tag} slot`);
  if (!eq(JSON.parse(JSON.stringify(m)), m)) problems.push(`${tag} JSON round-trip`);
  if (new Set(m.exercises.map(sl => M.regionOf(sl.moveId))).size !== m.exercises.length || m.exercises.some(sl => !M.regionOf(sl.moveId))) problems.push(`${tag} regions`);
  if (m.exercises.some((sl, i) => sl.prefix !== `STATION ${i + 1}`)) problems.push(`${tag} prefix`);
  if (m.clockSec !== m.capSec || S.missionClockSec(m) !== m.capSec || !(m.capSec > 0)) problems.push(`${tag} clock`);
  if (m.scoreRule.kind !== 'totalReps' || !eq(m.themes, ['maxout']) || !m.safety) problems.push(`${tag} score, theme, safety`);
  if (S.soloRounds(m) !== m.exercises.length * m.rounds || S.totalSlots(m) !== S.soloRounds(m)) problems.push(`${tag} sets`);
  if (!S.hasRoundTimer(m)) problems.push(`${tag} round timer`);
  if (m.exercises.some(sl => sl.reps > (M.repCapFor(sl.moveId, lv) ?? Infinity))) problems.push(`${tag} first set over its cap`);
});
check('79 five defs × three levels build: every slot a max set, never counted, no sides, regions distinct, a clock', problems.length === 0, problems.join('; '));

const plan = (m) => S.estimateMissionSeconds(m);
const timeBad = [];
every((id, lv, m) => {
  if (m.duration !== Math.round(plan(m) / 60)) timeBad.push(`${id}/${lv} minutes ${m.duration} vs ${Math.round(plan(m) / 60)}`);
  if (m.capSec < 1.5 * plan(m) - 1e-6 || m.capSec % 300 !== 0 || m.capSec > 1.5 * plan(m) + 300) timeBad.push(`${id}/${lv} cap ${m.capSec} for ${plan(m)}`);
});
check('79 minutes = the plan rounded; the cap is about 1.5 x the plan, up to the next 5 minutes', timeBad.length === 0, timeBad.join('; '));
const MINUTES = { boss_rush: [8, 13, 23], health_bar: [8, 11, 15], combo_meter: [10, 15, 20], tank_mode: [8, 12, 18], dual_wield: [10, 15, 21] };
const ROUNDS = { boss_rush: [2, 3, 5], health_bar: [2, 3, 4], combo_meter: [2, 3, 4], tank_mode: [2, 3, 4], dual_wield: [2, 3, 4] };
const CAPS = { boss_rush: [900, 1200, 2100], health_bar: [900, 1200, 1500], combo_meter: [1200, 1500, 2100], tank_mode: [900, 1200, 1800], dual_wield: [900, 1500, 2100] };
check('79 minutes, rounds and caps per level as the spec has them', IDS.every(id => LEVELS.every((lv, i) => {
  const m = build(id, lv);
  return m.duration === MINUTES[id][i] && m.rounds === ROUNDS[id][i] && m.capSec === CAPS[id][i];
})));

const restBad = [];
every((id, lv, m) => {
  const change = { beginner: 30, standard: 25, elite: 20 }[lv] + (id === 'tank_mode' ? 5 : 0);
  const round = { beginner: 90, standard: 75, elite: 60 }[lv];
  m.exercises.forEach((sl, i) => { if (sl.rest !== (i === m.exercises.length - 1 ? round : change)) restBad.push(`${id}/${lv}/${i} ${sl.rest}`); });
});
check('79 rests: change / round 30/90, 25/75, 20/60 (TANK MODE +5 on the change)', restBad.length === 0, restBad.join(', '));

const paceBad = [];
const paceOf = (id, lv) => build(id, lv).pace;
IDS.forEach(id => {
  LEVELS.forEach(lv => { const p = paceOf(id, lv); if (!(p.elite > p.standard && p.standard > p.beginner && p.beginner > 0)) paceBad.push(`${id}/${lv} order`); });
  ['elite', 'standard', 'beginner'].forEach(tier => { if (!(paceOf(id, 'beginner')[tier] < paceOf(id, 'standard')[tier] && paceOf(id, 'standard')[tier] < paceOf(id, 'elite')[tier])) paceBad.push(`${id} ${tier} across levels`); });
});
check('79 pace is ordered inside every level and across levels (more reps is better)', paceBad.length === 0, paceBad.join(', '));
check('79 pace marks as the spec has them (COMBO METER ELITE re-taken from the formula)', eq(paceOf('boss_rush', 'standard'), { elite: 250, standard: 195, beginner: 135 }) && eq(paceOf('combo_meter', 'elite'), { elite: 345, standard: 265, beginner: 185 }) && eq(paceOf('health_bar', 'elite'), { elite: 540, standard: 415, beginner: 290 })
  && eq(paceOf('combo_meter', 'beginner'), { elite: 125, standard: 95, beginner: 65 }) && eq(paceOf('tank_mode', 'standard'), { elite: 165, standard: 130, beginner: 90 })
  && eq(paceOf('dual_wield', 'elite'), { elite: 380, standard: 295, beginner: 205 }));
check('79 every def says its pace is a coach estimate; no capital ROUND in a note', defs.every(d => /^Coach estimate/.test(d.paceBasis) && !/\bROUND\b/.test(d.note)));

const reach = (m, key) => [...L.reachableMoves(m, key).keys()];
const swapBad = [];
every((id, lv, m) => {
  m.exercises.forEach(sl => {
    const region = M.regionOf(sl.baseMoveId);
    reach(m, sl.swapKey).forEach(mid => {
      const mv = M.moveById(mid);
      if (M.regionOf(mid) !== region) swapBad.push(`${id}/${lv}/${sl.swapKey} ${mid} leaves ${region}`);
      if (mv.jumps || mv.sides === 'switch' || mv.timedOnly) swapBad.push(`${id}/${lv}/${sl.swapKey} ${mid} jumps, switches or is timed`);
    });
    L.swapOptions(m, sl.swapKey).forEach(o => { if (M.regionOf(o.id) !== region) swapBad.push(`${id}/${lv}/${sl.swapKey} option ${o.id}`); });
  });
});
check('79 every reachable swap stays in its station\'s region: no jump, no switch move, nothing timed', swapBad.length === 0, swapBad.slice(0, 5).join('; '));

const swapped = L.swapMissionMove(build('boss_rush', 'beginner'), 'push', 'incline-push-up');
const swappedSlot = swapped.exercises[0];
check('79 a swap keeps the station a max set (never counted, no sides, its stop-short, its reps)', swappedSlot.moveId === 'incline-push-up' && swappedSlot.max === true && swappedSlot.cadenceMs === null && !('sides' in swappedSlot)
  && swappedSlot.leave === 2 && swappedSlot.reps === 12 && swappedSlot.prefix === 'STATION 1' && M.countBeats(swappedSlot) === null && swapped.scaled === true
  && L.swapMissionMove(swapped, 'push', 'knee-push-up').scaled === false, show(swappedSlot));
const dbSwap = L.swapMissionMove(build('combo_meter', 'standard'), 'core', 'backpack-dead-bug').exercises[3];
check('79 a swap onto a move with sides still has none', dbSwap.moveId === 'backpack-dead-bug' && !('sides' in dbSwap) && dbSwap.cadenceMs === null && dbSwap.max === true);

const FAMILY = new Set(['sit-up', 'crunch', 'v-up']);
const hingeBad = [];
every((id, lv, m) => {
  const n = m.exercises.length;
  m.exercises.forEach((sl, i) => {
    if (M.regionOf(sl.baseMoveId) !== 'hinge') return;
    const nextKey = m.exercises[(i + 1) % n].swapKey;
    if (reach(m, nextKey).some(mid => FAMILY.has(mid))) hingeBad.push(`${id}/${lv}`);
  });
});
check('79 no hinge station is ever followed by a sit-up, crunch or V-up', hingeBad.length === 0, hingeBad.join(', '));
check('79 excluded swaps stay out: back squats on TANK MODE, pike push-ups on COMBO METER', LEVELS.every(lv => {
  const tank = build('tank_mode', lv);
  const combo = build('combo_meter', lv);
  return !reach(tank, 'squat').includes('bb-back-squat') && L.isSwapAllowed(tank, 'squat', 'bb-back-squat') === false
    && !reach(combo, 'press').includes('pike-push-up') && L.isSwapAllowed(combo, 'press', 'pike-push-up') === false;
}));
const BARBELL_OK = new Set(['bb-dead-stop-row', 'bb-bent-over-row', 'bb-front-squat']);
const barbellBad = [];
every((id, lv, m) => m.exercises.forEach(sl => reach(m, sl.swapKey).forEach(mid => {
  if (M.moveById(mid).gear === 'barbell' && !(id === 'tank_mode' && BARBELL_OK.has(mid))) barbellBad.push(`${id}/${lv}/${mid}`);
})));
check('79 the barbell is for TANK MODE\'s rows and front squats only: no swap reaches a barbell deadlift, RDL, press or squat anywhere', barbellBad.length === 0, [...new Set(barbellBad)].join(', '));
check('79 no barbell bench press in the catalog; no deadlift or back squat to failure is a base move', !M.moveById('bb-bench-press') && !M.MOVES.some(m => /bench-press/.test(m.id))
  && every((id, lv, m) => m.exercises.some(sl => ['bb-deadlift', 'bb-back-squat', 'bb-rdl'].includes(sl.moveId))).every(x => x === false));

const copy = strings([defs.map(d => ({ ...d, levels: undefined })), every((id, lv, m) => m).map(m => ({ ...m }))]);
const REJECTED = ['LOOT RUN', 'POWER-UP', 'BOOST MODE', 'MINI BOSSES', 'STAGE CLEAR', 'HARD MODE', 'BURNOUT'];
const BANNED = ['Chief', 'Navy Seal', 'CrossFit', 'Tabata', 'Ten Count', 'Street Fighter', 'Dragon Ball', 'Dan John', 'Armor Building', 'Pendlay', 'StrongFirst', 'Sinister', 'Tsatsouline', 'Pavel', 'Hero WOD'];
check('79 no rejected game or film name, no franchise name, no SOLO in the new copy', !copy.some(s => /\bsolo\b/i.test(s))
  && !copy.some(s => REJECTED.some(r => s.toUpperCase().includes(r))) && !copy.some(s => BANNED.some(b => (b === 'Chief' ? /\bchief\b/i.test(s) : s.toLowerCase().includes(b.toLowerCase())))), copy.filter(s => /\bsolo\b/i.test(s)).slice(0, 3).join(' | '));

const bossCard = L.missionCardModel(build('boss_rush'));
check('79 BOSS RUSH STANDARD on the card: eyebrow, tags, loadout, rows, score, safety', bossCard.eyebrow === 'Mission · Max Reps' && bossCard.accentTag === 'MAX OUT' && eq(bossCard.tags, ['~13 MIN', 'STANDARD', 'HOTEL OK', 'QUIET'])
  && bossCard.loadoutLine === 'NO GEAR · 2 × 2 M OF FLOOR' && bossCard.missionLine === '3 ROUNDS · PUSH-UPS · SQUATS · SIT-UPS · MAX REPS'
  && bossCard.scoreLine === 'TOTAL REPS, EVERY SET ADDED' && eq(bossCard.rows.map(r => [r.prefix, r.name, r.dose]), [['STATION 1', 'Push-Ups', 'MAX'], ['STATION 2', 'Air Squats', 'MAX'], ['STATION 3', 'Sit-Ups', 'MAX']])
  && bossCard.safety === 'Stop a set when your form breaks, not when it burns. Sit-ups: hands on your chest, never pull on your neck.'
  && eq(S.paceTargets(build('boss_rush')).map(p => p.text), ['250+ reps', '195 reps', '135 reps']) && L.missionCardModel(build('boss_rush', 'beginner')).tags[1] === 'BEGINNER' && L.missionCardModel(build('boss_rush', 'elite')).tags[1] === 'ELITE', show(bossCard.tags));
check('79 the rows say when to stop (the move\'s rule, the stop-short, the cap)', bossCard.rows[0].note === 'Stop when your hips sag or you cannot lower to within a fist of the floor.'
  && L.cardRows(build('boss_rush', 'beginner'))[0].note === 'Stop when your hips sag or you cannot lower to within a fist of the floor. Stop 2 reps before that.'
  && L.cardRows(build('combo_meter'))[0].note === 'Stop when the bell stops floating to chest height or your back wants to round. Most reps: 15.', show(L.cardRows(build('combo_meter'))[0].note));
const shelf = L.shelfEntries();
const maxout = L.filterShelf(shelf, { theme: 'maxout' });
check('79 the library: five on the MAX OUT chip, one each for none, bell and barbell, two for mixed; rows read "~13 MIN · NO GEAR · MAX REPS · STANDARD"', eq(maxout.map(e => e.id), IDS)
  && ['none', 'bell', 'barbell', 'mixed'].every((lo, i) => L.filterShelf(shelf, { loadout: lo, theme: 'maxout' }).length === [1, 1, 1, 2][i])
  && L.shelfEntryLine(maxout[0]) === '~13 MIN · NO GEAR · MAX REPS · STANDARD' && L.shelfEntryLine(maxout[1]) === '~11 MIN · MIXED · MAX REPS · STANDARD' && L.shelfEntryLine(maxout[4], { level: 'elite' }) === '~21 MIN · MIXED · MAX REPS · ELITE'
  && L.shelfEntryLine(maxout[0], { level: 'beginner' }) === '~8 MIN · NO GEAR · MAX REPS · BEGINNER'
  && maxout.every(e => e.soloOnly === false));

// ── 80 · two catalog moves ───────────────────────────────────────────────────
const sit = M.moveById('sit-up');
const press = M.moveById('db-floor-press');
check('80 sit-up: core, no gear, 1.5 / 2.0 / 2.5 s, the cues, crunch easier and V-up harder', sit.name === 'Sit-Ups' && sit.say === 'sit-ups' && sit.pattern === 'core' && sit.gear === 'none' && sit.unit === 'reps'
  && eq(sit.cadence, { elite: 1500, standard: 2000, beginner: 2500 })
  && eq(sit.cues, ['Feet flat, knees bent, hands crossed on the chest.', 'Curl all the way up to the knees, then lower slowly.'])
  && eq(sit.alts, [{ id: 'crunch', kind: 'easier' }, { id: 'v-up', kind: 'harder' }]));
check('80 dumbbell floor press: push, dumbbells, 2.0 / 2.5 / 3.0 s, the cues, push-ups easier', press.name === 'Dumbbell Floor Presses' && press.say === 'floor presses' && press.pattern === 'push' && press.gear === 'db'
  && eq(press.cadence, { elite: 2000, standard: 2500, beginner: 3000 })
  && eq(press.cues, ['Lie on the floor, a dumbbell in each hand, elbows at 45 degrees.', 'Press straight up, lower until the upper arms touch the floor.'])
  && eq(press.alts, [{ id: 'push-up', kind: 'easier' }]));
check('80 no earlier move lists a new one: the 156 swap sheets did not move', M.MOVES.slice(0, 156).every(m => m.alts.every(a => a.id !== 'sit-up' && a.id !== 'db-floor-press')) && M.MOVES.length === 158
  && M.MOVES[156].id === 'sit-up' && M.MOVES[157].id === 'db-floor-press');
check('80 regions: push chest, press shoulders, pull back, squat and lunge quads, hinge, core; nothing else', eq(['push-up', 'kb-horn-press', 'pull-up', 'air-squat', 'reverse-lunge', 'kb-swing', 'sit-up'].map(M.regionOf), ['chest', 'shoulders', 'back', 'quads', 'quads', 'hinge', 'core'])
  && ['burpee', 'one-two', 'kb-clean', 'row-cal', 'sprawl'].every(id => M.regionOf(id) === null) && M.regionOf('nope') === null);

// ── 81 · the coach ───────────────────────────────────────────────────────────
const boss = build('boss_rush');
const bossBeg = build('boss_rush', 'beginner');
const tank = build('tank_mode');
const combo = build('combo_meter');
check('81 the first lead: "Round 1. Push-ups. Max reps."; a later station has no round', M.leadLine(boss.exercises[0], ctxFor(boss, 1, 0)) === 'Round 1. Push-ups. Max reps.'
  && M.leadLine(boss.exercises[1], ctxFor(boss, 1, 1)) === 'Air squats. Max reps.' && M.leadLine(boss.exercises[0], ctxFor(boss, 2, 0)) === 'Round 2. Push-ups. Max reps.');
check('81 a loaded move says "Max clean reps." and its cap; a stop-short set says so; a backpack is a load', M.leadLine(combo.exercises[0], ctxFor(combo, 1, 0)) === 'Round 1. Swings. Max clean reps. Never more than 15.'
  && M.leadLine(tank.exercises[0], ctxFor(tank, 1, 0)) === 'Round 1. Dead-stop rows. Max clean reps. Stop two short. Never more than 25.'
  && M.leadLine(bossBeg.exercises[0], ctxFor(bossBeg, 1, 0)) === 'Round 1. Knee push-ups. Max clean reps. Stop two short.'
  && M.leadLine(build('health_bar').exercises[1], ctxFor(build('health_bar'), 1, 1)) === 'Backpack deadlifts. Max clean reps. Never more than 12.'
  && M.leadLine(build('health_bar', 'beginner').exercises[1], ctxFor(build('health_bar', 'beginner'), 1, 1)) === 'Backpack deadlifts. Max clean reps. Stop two short. Never more than 10.');
check('81 the start is "Go." after a lead or short line, the move and "Go." after a silence', M.workStartLine(boss.exercises[1], { announcedBy: 'lead' }) === 'Go.' && M.workStartLine(boss.exercises[1], { announcedBy: 'short' }) === 'Go.'
  && M.workStartLine(boss.exercises[1]) === 'Air squats. Max reps. Go.' && M.chainedLine(tank.exercises[2]) === 'Front squats. Max clean reps. Stop two short. Never more than 25. Go.');
check('81 "Next: air squats." and the rests', M.shortRestLine(boss.exercises[1]) === 'Next: air squats.'
  && M.restOpener({ restSec: 25, roundEnd: false, completedRound: 1, format: 'maxReps' }) === 'Rest. 25 seconds.'
  && M.restOpener({ restSec: 75, roundEnd: true, completedRound: 1, format: 'maxReps' }) === 'Round 1 complete. Rest. 75 seconds.'
  && M.restOpener({ restSec: 90, roundEnd: true, completedRound: 2, format: 'maxReps' }) === 'Round 2 complete. Rest. 90 seconds.');
const lead = M.leadLine(boss.exercises[1], ctxFor(boss, 1, 1));
const script = M.restScript({ restSec: 25, kind: 'rest', roundEnd: false, completedRound: 1, format: 'maxReps', tips: [], lead, short: M.shortRestLine(boss.exercises[1]) });
check('81 a 25 s change rest: the opener, then the next station seven seconds before the end, then 3-2-1', script.plan === 'long' && script.opener === 'Rest. 25 seconds.' && script.leadAt === 7 && script.lead === 'Air squats. Max reps.' && script.countdown === true, show(script));
const getReady = M.getReadySeconds(M.leadLine(boss.exercises[0], ctxFor(boss, 1, 0)));
check('81 GET READY is long enough for the first lead', getReady >= 7 && getReady <= 12, `${getReady}`);
check('81 "Done. 214 reps." and "Done. 1 rep."', M.maxFinishLine(214) === 'Done. 214 reps.' && M.maxFinishLine(1) === 'Done. 1 rep.' && M.maxFinishLine(0) === 'Done. 0 reps.');
check('81 a max slot has no count and no dose number; spokenMove is the word alone', M.countBeats(boss.exercises[0]) === null && M.slotDose(boss.exercises[0]) === 'MAX'
  && M.spokenMove(boss.exercises[0]) === 'push-ups' && M.spokenMove(boss.exercises[2]) === 'sit-ups' && M.isCounted(boss.exercises[0]) === false);
check('81 the stop lines: the move\'s rule, the stop-short, the cap, the default', M.maxStopLine(boss.exercises[2]) === 'Stop when you have to swing or pull on your neck. Most reps: 60.'
  && M.maxStopLine(bossBeg.exercises[2], 'beginner') === 'Stop when you have to swing or pull on your neck. Stop 2 reps before that. Most reps: 60.'
  && M.maxStopLine({ moveId: 'nope' }) === 'Stop when your form breaks.' && M.maxStopLine({ moveId: 'push-up' }) === 'Stop when your hips sag or you cannot lower to within a fist of the floor.'
  && M.STOP_RULES['db-floor-press'] === 'Stop when a rep stalls. Lower both dumbbells to your sides.' && M.STOP_RULES['pull-up'] === 'Stop when your chin cannot clear the bar. Step down to the floor. No swinging.');
// Every move the five can hold has its own stop rule.
const ruleless = [];
every((id, lv, m) => m.exercises.forEach(sl => reach(m, sl.swapKey).forEach(mid => { if (!M.STOP_RULES[mid]) ruleless.push(`${id}/${lv}/${mid}`); })));
check('81 every reachable move has a stop rule of its own', ruleless.length === 0, [...new Set(ruleless)].join(', '));
// Nothing else changed its words: a counted slot and a timed slot say what they said.
const oldMission = L.buildLoadoutMission('best_of_3');
check('81 the 31 earlier missions speak as before', M.leadLine(oldMission.exercises[0], { round: 1, idx: 0, rounds: 3, slotsPerRound: 1, format: 'amrap' }) === 'Round 1. AMRAP. 3 minutes. 5 sprawls, 10 air squats, 10 one-twos.'
  && M.slotDose(L.buildLoadoutMission('quota_300').exercises[0]) === '10');

// ── 82 · XP, floors, caps ────────────────────────────────────────────────────
const std = boss;
check('82 plan: BOSS RUSH STANDARD works 11:22 through its nine sets; the full run pays 144', Math.round(S.plannedThrough(std, 9)) === 683 && Math.floor(S.plannedThrough(std, 9)) === 682
  && S.maxRepsXp(std, 9, { full: true }) === 144 && S.fullRunXp(std) === 144 && S.maxRepsPlan(std).length === 9);
const begin3 = rounds3(bossBeg);
const elite3 = rounds3(build('boss_rush', 'elite'));
check('82 the spec\'s worked runs, three rounds: BEGINNER 134 / 65, STANDARD 144 / 72, ELITE 160 / 83 (full / stopped after set 6)',
  S.maxRepsXp(begin3, 9, { full: true }) === 134 && S.maxRepsXp(begin3, 6) === 65
  && S.maxRepsXp(rounds3(std), 9, { full: true }) === 144 && S.maxRepsXp(rounds3(std), 6) === 72
  && S.maxRepsXp(elite3, 9, { full: true }) === 160 && S.maxRepsXp(elite3, 6) === 83,
  show([S.maxRepsXp(begin3, 9, { full: true }), S.maxRepsXp(begin3, 6), S.maxRepsXp(elite3, 9, { full: true }), S.maxRepsXp(elite3, 6)]));
check('82 as shipped: BEGINNER 2 rounds 95, STANDARD 144, ELITE 5 rounds 253', S.fullRunXp(bossBeg) === 95 && S.fullRunXp(std) === 144 && S.fullRunXp(build('boss_rush', 'elite')) === 253);
check('82 a faster honest finish is bounded by the clock: 10:00 pays 130, 13:20 pays 144', S.maxRepsXp(std, 9, { elapsedSec: 600, full: true }) === 130 && S.maxRepsXp(std, 9, { elapsedSec: 800, full: true }) === 144);
check('82 floors for all nine sets: 252 / 222 / 192 s; STANDARD sets 4 and 5: 94.5 and 115', S.floorSec(begin3, 9) === 252 && S.floorSec(rounds3(std), 9) === 222 && S.floorSec(elite3, 9) === 192
  && S.floorSec(std, 4) === 94.5 && S.floorSec(std, 5) === 115 && S.floorSec(std, 0) === 0 && S.plannedThrough(std, 0) === 0);
const farm = entries(std, 9, 10, 8);
const farmSolo = solo(std, farm, { elapsedSec: 100 });
const farmGuided = guided(std, farm, { elapsedSec: 100 });
check('82 the farm: nine 8 s taps in 100 s credit 4 sets, pay 17 and no bonus, and say so', S.creditedSets(std, farm, 100).credited === 4 && farmSolo.credited === 4 && farmSolo.xp === 17 && farmSolo.outcome === 'partial'
  && farmSolo.message === 'The clock was too short, so 4 of 9 sets count.' && farmGuided.xp === 17 && farmGuided.credited === 4 && farmGuided.message === farmSolo.message, show([farmSolo, farmGuided.xp]));
check('82 a set must have a rep and run 8 s: 0 reps or 7 s never counts', S.creditedSets(std, [{ reps: 0, sec: 30 }, { reps: 5, sec: 7 }, { reps: 5, sec: 8 }], Infinity).credited === 1
  && S.creditedSets(std, [], 600).credited === 0 && S.creditedSets(std, [null, { reps: 5, sec: 30 }], Infinity).credited === 1);
const honest = entries(std, 9, 20, 30);
check('82 a full honest finish: pass, 144; STOP after six sets: a partial, 72, no bonus', solo(std, honest).outcome === 'pass' && solo(std, honest).xp === 144 && solo(std, honest).message === null
  && solo(std, honest.slice(0, 6), { completed: false, stopped: true, elapsedSec: 480 }).xp === 72 && solo(std, honest.slice(0, 6), { completed: false, stopped: true, elapsedSec: 480 }).outcome === 'partial'
  && guided(std, honest).xp === 144 && guided(std, honest).outcome === 'pass');
check('82 the cap pays the sets saved and no bonus; a skipped set in GUIDED loses the bonus; no saved set pays nothing',
  solo(std, honest, { completed: false, capped: true, elapsedSec: 1200 }).xp === 114 && solo(std, honest, { completed: false, capped: true, elapsedSec: 1200 }).outcome === 'partial'
  && guided(std, honest, { completed: true, skipped: 1 }).xp === 114 && guided(std, honest, { completed: true, skipped: 1 }).outcome === 'partial'
  && guided(std, honest, { completed: false, capped: true, elapsedSec: 1200 }).xp === 114
  && solo(std, null, { completed: false, stopped: true }).xp === 0 && solo(std, null, { completed: false, stopped: true }).message === 'Finish one set to earn XP.' && solo(std, null, { completed: false, stopped: true }).outcome === 'none'
  && guided(std, null, { completed: false }).xp === 0 && guided(std, null, { completed: false }).verdict.response === 'Finish one set to earn XP.' && guided(std, null, { completed: false }).outcome === 'none');
// Each of these fails if its guard is dropped: a cap, a STOP or a skip never pays the bonus even when the
// run says it completed, and the bonus needs every set (not just k >= 1) to be credited.
check('82 no bonus for a capped, stopped or skipped run that still says completed, nor for part of the sets', solo(std, honest, { completed: true, capped: true, elapsedSec: 1200 }).xp === 114
  && solo(std, honest, { completed: true, stopped: true, elapsedSec: 900 }).xp === 114 && solo(std, honest, { completed: true, stopped: true, elapsedSec: 900 }).outcome === 'partial'
  && guided(std, honest, { completed: true, capped: true, elapsedSec: 1200 }).xp === 114 && guided(std, honest, { completed: true, stopped: true, elapsedSec: 900 }).outcome === 'partial'
  && S.maxRepsXp(std, 5, { full: true }) === S.maxRepsXp(std, 5) && S.maxRepsXp(std, 9, { full: true }) === S.maxRepsXp(std, 9) + 30);
check('82 reps never change the XP', solo(std, entries(std, 9, 5, 30)).xp === solo(std, entries(std, 9, 40, 30)).xp && guided(std, entries(std, 9, 1, 30)).xp === guided(std, entries(std, 9, 40, 30)).xp);
check('82 every set refused by the clock (under 8 s run): no XP and the plain message', solo(std, entries(std, 3, 10, 30), { elapsedSec: 5 }).outcome === 'too_fast' && solo(std, entries(std, 3, 10, 30), { elapsedSec: 5 }).xp === 0
  && solo(std, entries(std, 3, 10, 30), { elapsedSec: 5 }).message === 'The clock was too short, so no sets count.'
  && guided(std, entries(std, 3, 10, 30), { elapsedSec: 5 }).outcome === 'none' && guided(std, entries(std, 3, 10, 30), { elapsedSec: 5 }).xp === 0
  && S.creditedSets(std, entries(std, 3, 10, 30), 10).credited === 1);
const fullXp = [];
every((id, lv, m) => { const x = S.fullRunXp(m); if (!(x > 0) || x !== S.maxRepsXp(m, S.totalSlots(m), { full: true })) fullXp.push(`${id}/${lv} ${x}`); });
check('82 every def pays a full-run figure at every level, at the clock\'s own rate (about 10 XP a minute + 30)', fullXp.length === 0
  && every((id, lv, m) => Math.abs(S.fullRunXp(m) - (30 + Math.round(10 * S.plannedThrough(m, S.totalSlots(m)) / 60))) <= 1).every(Boolean), fullXp.join(', '));
check('82 the clock cap, the expected time and the floor of the run read the plan', S.maxCapReached(std, 1199.9) === false && S.maxCapReached(std, 1200) === true && S.maxCapReached(L.buildLoadoutMission('room_12'), 99999) === false
  && S.soloExpectedSec(std) === 683 && S.soloFloorSec(std) === 222);

// ── 83 · rep limits ──────────────────────────────────────────────────────────
check('83 the ceiling: a push-up set of 40 s holds 53; at least 1, at most 300', S.repsCeiling('push-up', 40) === 53 && S.repsCeiling('push-up', 0) === 1 && S.repsCeiling('push-up', 100000) === 300
  && S.repsCeiling('mountain-climber', 30) === 100 && S.repsCeiling('pull-up', 20) === 20);
const cap = (id, lv) => M.repCapFor(id, lv);
check('83 caps: swings 15 (12 beginner), loaded hinge 12 (10), sit-up family and core 60, climbers none, loaded lunge 30, other loaded 25, bodyweight none',
  cap('kb-swing', 'standard') === 15 && cap('kb-swing', 'beginner') === 12 && cap('db-swing', 'elite') === 15
  && cap('backpack-rdl', 'standard') === 12 && cap('backpack-rdl', 'beginner') === 10 && cap('kb-deadlift', 'elite') === 12
  && cap('sit-up') === 60 && cap('crunch') === 60 && cap('v-up') === 60 && cap('kb-dead-bug') === 60 && cap('kb-plank-pull-through') === 60
  && cap('mountain-climber') === null && cap('slow-climber') === null
  && cap('kb-reverse-lunge') === 30 && cap('goblet-squat') === 25 && cap('kb-horn-press') === 25 && cap('bb-front-squat') === 25 && cap('bb-dead-stop-row') === 25 && cap('db-floor-press') === 25 && cap('db-bent-over-row') === 25
  && ['push-up', 'knee-push-up', 'pull-up', 'jumping-pull-up', 'air-squat', 'glute-bridge'].every(id => cap(id) === null) && cap('nope') === null);
check('83 the limit is the smaller of the cap and the ceiling', S.maxRepsLimit({ moveId: 'push-up' }, 40) === 53 && S.maxRepsLimit({ moveId: 'push-up' }, 10) === 13 && S.maxRepsLimit({ moveId: 'push-up' }, 0) === 300
  && S.maxRepsLimit({ moveId: 'kb-swing' }, 120) === 15 && S.maxRepsLimit({ moveId: 'kb-swing' }, 120, 'beginner') === 12 && S.maxRepsLimit({ moveId: 'sit-up' }, 600) === 60);

// ── 84 · the saved score ─────────────────────────────────────────────────────
const sample = [[22, 34, 25], [19, 28, 20], [16, 24, 17]].flatMap(r => r);
const sampleScore = S.maxRepsScore(std, sample.map(reps => ({ reps, sec: 60 })), { timeSec: 761 });
check('84 total reps, sets of all, each station round by round, in station order', sampleScore.kind === 'totalReps' && sampleScore.total === 205 && sampleScore.sets === 9 && sampleScore.of === 9 && sampleScore.timeSec === 761
  && eq(sampleScore.byStation.map(s => [s.moveId, s.name, s.reps]), [['push-up', 'Push-Ups', [22, 19, 16]], ['air-squat', 'Air Squats', [34, 28, 24]], ['sit-up', 'Sit-Ups', [25, 20, 17]]])
  && eq(sampleScore.setSecs, Array(9).fill(60)) && !('capped' in sampleScore) && !('skipped' in sampleScore), show(sampleScore));
const clamped = S.maxRepsScore(std, [{ reps: 999, sec: 40 }, { reps: -5, sec: 30 }, { reps: 70.4, sec: 600 }], { timeSec: 90 });
check('84 reps are clamped to what a set of its seconds can hold: 999 in 40 s is 53, negative is 0, a sit-up caps at 60', eq(clamped.byStation.map(s => s.reps), [[53], [0], [60]]) && clamped.total === 113 && clamped.sets === 3, show(clamped.byStation));
const withSkip = S.maxRepsScore(std, [{ reps: 20, sec: 40 }, null, { reps: 25, sec: 50 }, { reps: 18, sec: 40 }], { timeSec: 300, capped: true, skipped: 1 });
const midSkip = S.maxRepsScore(std, [{ reps: 20, sec: 40 }, null, { reps: 25, sec: 50 }, { reps: 18, sec: 40 }, { reps: 30, sec: 60 }], { timeSec: 300 });
check('84 a skipped set reads null in the middle of a station and is trimmed at its end, is not a saved set, and is told; a capped run says so', eq(midSkip.byStation[1].reps, [null, 30]) && eq(withSkip.byStation[1].reps, []) && withSkip.sets === 3 && withSkip.total === 63 && withSkip.skipped === 1 && withSkip.capped === true
  && eq(withSkip.setSecs, [40, null, 50, 40]) && eq(withSkip.byStation[0].reps, [20, 18]), show(withSkip));
check('84 trailing skips are trimmed; nothing saved is an empty score', eq(S.maxRepsScore(std, [{ reps: 20, sec: 40 }, null, null]).byStation[1].reps, []) && S.maxRepsScore(std, []).sets === 0 && S.maxRepsScore(std, undefined).total === 0
  && S.maxRepsScore(std, [{ reps: 'x', sec: 40 }]).sets === 0);
check('84 a score reads back to its sets in order, with the seconds', eq(S.scoreSets(std, sampleScore).slice(0, 4), [{ reps: 22, sec: 60 }, { reps: 34, sec: 60 }, { reps: 25, sec: 60 }, { reps: 19, sec: 60 }])
  && eq(S.scoreSets(std, withSkip).map(x => x && x.reps), [20, null, 25, 18]) && eq(S.scoreSets(std, null), []) && eq(S.scoreSets(std, { kind: 'time' }), []));
check('84 formatScore prints the total', S.formatScore(sampleScore) === '205' && S.formatScore({ kind: 'totalReps', total: 0 }) === '0' && S.formatScore(null) === '—');
check('84 pace targets read "250+ reps" for ELITE and "195 reps" below it', eq(S.paceTargets(std).map(p => `${p.label} ${p.text}`), ['ELITE 250+ reps', 'STANDARD 195 reps', 'BEGINNER 135 reps']));
// AT YOUR PACE: each set's seconds are its own lap, the rest left out.
const lapMission = build('boss_rush');
const splits = [{ at: 30000, block: 0 }, { at: 70000, block: 0 }, { at: 140000, block: 0 }];
check('84 AT YOUR PACE sets: the lap leaves the rest out (set 2 ends at 70 s, 25 s after set 1; set 3 starts 25 s after set 2)', eq(S.maxEntriesFromSplits(lapMission, splits, [20, 30, 25]), [{ reps: 20, sec: 30 }, { reps: 30, sec: 15 }, { reps: 25, sec: 45 }])
  && eq(S.maxEntriesFromSplits(lapMission, splits, [20]), [{ reps: 20, sec: 30 }, null, null]) && eq(S.maxEntriesFromSplits(lapMission, undefined, undefined), []),
  show(S.maxEntriesFromSplits(lapMission, splits, [20, 30, 25])));
check('84 the timed rest after set n: every one, even a 25 s change; none after the last set', S.roundRestSec(std, 1) === 25 && S.roundRestSec(std, 2) === 25 && S.roundRestSec(std, 3) === 75 && S.roundRestSec(std, 4) === 25 && S.roundRestSec(std, 8) === 25
  && S.roundRestSec(std, 9) === 0 && S.roundRestSec(std, 0) === 0 && S.roundRestSec(tank, 1) === 30 && S.roundRestSec(tank, 3) === 75);
check('84 SOLO\'s clock is the cap; sets are its taps; its timeline is empty', S.missionClockSec(std) === 1200 && S.soloRounds(std) === 9 && S.soloTimeline(std).length === 0 && S.hasRoundTimer(std) === true
  && S.hasRoundTimer({ ...std, noRoundTimer: true }) === false && S.isFixedClock('maxReps') === false && S.paysByTime(std) === false);

// ── 85 · both settles ────────────────────────────────────────────────────────
const sSolo = solo(std, honest);
const sGuided = guided(std, honest);
check('85 the AT YOUR PACE settle: { xp, outcome, ratio, credited, message }', eq(Object.keys(sSolo).sort(), ['credited', 'message', 'outcome', 'ratio', 'xp']) && sSolo.ratio === 1 && sSolo.credited === 9);
check('85 the GUIDED settle: { mode, xp, base, outcome, verdict, workedSec, credited, message }, the verdict a pass', eq(Object.keys(sGuided).sort(), ['base', 'credited', 'message', 'mode', 'outcome', 'verdict', 'workedSec', 'xp'])
  && sGuided.mode === 'guided' && sGuided.base === 144 && sGuided.verdict.outcome === 'pass' && sGuided.workedSec === 0);
check('85 a stopped GUIDED run is a partial (SESSION STOPPED), never a pass', guided(std, honest.slice(0, 6), { completed: false, elapsedSec: 480 }).verdict.preset.eyebrow === 'SESSION STOPPED' && guided(std, honest.slice(0, 6), { completed: false, elapsedSec: 480 }).outcome === 'partial');
check('85 a hard anti-cheat flag zeroes GUIDED XP; the same score in both settles pays the same', guided(std, honest, { integrityResult: { awardXp: false, validityStatus: 'tooFast', reason: 'x' } }).xp === 0
  && ['standard', 'elite', 'beginner'].every(lv => { const m = build('dual_wield', lv); const es = entries(m, S.totalSlots(m), 12, 40); return solo(m, es, { elapsedSec: 5000 }).xp === guided(m, es, { elapsedSec: 5000 }).xp; }));
check('85 an old or empty result never throws and never pays more than 0: no score, a score from another mission, no sets', [{ mission: std }, { mission: std, score: { kind: 'time' } }, { mission: std, score: null, elapsedSec: 'x' }].every(r => {
  try { return S.settleSoloXp(r).xp === 0 && S.settleGuidedXp(r).xp === 0; } catch { return false; }
}) && [undefined, {}].every(r => { try { S.settleSoloXp(r); S.settleGuidedXp(r); return true; } catch { return false; } }) && [{ mission: std }, { mission: std, score: { kind: 'totalReps' } }, { mission: std, score: { kind: 'totalReps', byStation: 'x', setSecs: 'y' } }].every(r => {
  try { return S.settleGuidedXp(r).xp === 0 && S.settleSoloXp(r).xp === 0; } catch { return false; }
}));
check('85 the other formats still settle as before (BEST OF 3 SOLO and GUIDED)', S.settleSoloXp({ mission: oldMission, completed: true, format: 'amrap', elapsedSec: 660 }).outcome === 'pass'
  && S.settleGuidedXp({ mission: oldMission, completed: true, exercisesCompleted: 3, totalExercises: 3, workedSec: 540 }).xp === 120);

// ── 86 · integrity sizing ────────────────────────────────────────────────────
const sizeBad = [];
every((id, lv, m) => {
  const r = S.estimateRoundSeconds(m);
  // The estimate is the quickest honest round (ELITE counts): 2 to 6.5 minutes. The sizing is the 10-minute floor, and always 1.5 x the estimate.
  if (!(r >= 120 && r <= 400)) sizeBad.push(`${id}/${lv} round ${Math.round(r)} s`);
  if (S.qmMaxValidSeconds(m) < 1.5 * r || S.qmIntegrityRules(m).maxValidSeconds !== S.qmMaxValidSeconds(m)) sizeBad.push(`${id}/${lv} sizing`);
  if (S.qmMaxValidSeconds(m) < 600 || S.qmTotalUnits(m) !== m.rounds) sizeBad.push(`${id}/${lv} ${S.qmMaxValidSeconds(m)}`);
});
check('86 a GUIDED round is one unit; its sizing is the 10-minute floor and at least 1.5 x the round estimate (2 to 6.5 minutes)', sizeBad.length === 0, sizeBad.join(', '));

// ── 87 · Build Workout's MAX OUT ─────────────────────────────────────────────
store.clear();
const PAIRS = [];
for (const eqp of ['BODYWEIGHT', 'WEIGHTED', 'HYBRID']) for (const diff of ['EASY', 'NORMAL', 'HARD']) PAIRS.push([eqp, diff]);
const lo = { BODYWEIGHT: 'none', WEIGHTED: 'all', HYBRID: 'mixed' };
const lv = { EASY: 'beginner', NORMAL: 'standard', HARD: 'elite' };
const handBad = [];
PAIRS.forEach(([eqp, diff]) => {
  store.clear();
  const out = L.maxOutHandoff({ equipment: eqp, difficulty: diff });
  if (!eq(out, { loadout: lo[eqp], theme: 'maxout', level: lv[diff] })) handBad.push(`${eqp}/${diff} ${show(out)}`);
  // Nothing is saved: the library's remembered filter and every workout's saved level stay as they were.
  if (store.size !== 0) handBad.push(`${eqp}/${diff} saved ${show([...store.keys()])}`);
  const list = L.filterShelf(L.shelfEntries(), { loadout: out.loadout, theme: out.theme });
  if (!list.length || list.some(e => !IDS.includes(e.id))) handBad.push(`${eqp}/${diff} list ${show(list.map(e => e.id))}`);
  if (!IDS.every(id => L.libraryLevelFor(id, undefined, out.level) === out.level)) handBad.push(`${eqp}/${diff} level`);
});
check('87 all nine gear × difficulty pairs: the loadout, the MAX OUT chip and the level are handed over and nothing is saved', handBad.length === 0, handBad.join('; '));
check('87 BODYWEIGHT lists BOSS RUSH; WEIGHTED lists all five (TANK MODE, the barbell one, included); HYBRID lists the mixed two', eq(L.filterShelf(L.shelfEntries(), { loadout: 'none', theme: 'maxout' }).map(e => e.id), ['boss_rush'])
  && eq(L.filterShelf(L.shelfEntries(), { loadout: L.maxOutHandoff({ equipment: 'WEIGHTED' }).loadout, theme: 'maxout' }).map(e => e.id), IDS)
  && eq(L.filterShelf(L.shelfEntries(), { loadout: 'mixed', theme: 'maxout' }).map(e => e.id), ['health_bar', 'dual_wield']));
store.clear();
L.saveShelfPrefs({ mode: 'solo', theme: 'striking', loadout: 'bell', levels: { quota_300: 'elite', boss_rush: 'beginner' } });
const before = show(L.loadShelfPrefs());
L.maxOutHandoff({ equipment: 'hybrid', difficulty: 'hard' });
check('87 the hand-off never touches the saved filter, run mode or levels; it takes any case; an unknown pair opens ALL at STANDARD', show(L.loadShelfPrefs()) === before
  && eq(L.maxOutHandoff({}), { loadout: 'all', theme: 'maxout', level: 'standard' }) && eq(L.maxOutHandoff({ equipment: 'hybrid', difficulty: 'hard' }), { loadout: 'mixed', theme: 'maxout', level: 'elite' }) && L.MAX_OUT_IDS.join() === IDS.join());
check('87 the library opens a MAX OUT workout at the handed-over level, else the one picked on its card, else the default; every other mission at its default', L.libraryLevelFor('boss_rush') === 'beginner'
  && L.libraryLevelFor('boss_rush', undefined, 'elite') === 'elite' && L.libraryLevelFor('health_bar') === undefined && L.libraryLevelFor('quota_300', undefined, 'elite') === undefined && L.libraryLevelFor('nope') === undefined);
store.clear();
check('87 with nothing picked the library uses the default level', L.libraryLevelFor('boss_rush') === undefined && L.libraryLevelFor('boss_rush', { levels: { boss_rush: 'elite' } }) === 'elite' && L.libraryLevelFor('boss_rush', { levels: { boss_rush: 'brutal' } }) === undefined
  && L.libraryLevelFor('boss_rush', { levels: {} }, 'brutal') === undefined);
const blocked = globalThis.localStorage;
globalThis.localStorage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } };
let threw = false;
try { L.maxOutHandoff({ equipment: 'BODYWEIGHT', difficulty: 'EASY' }); L.libraryLevelFor('boss_rush', undefined, 'elite'); } catch { threw = true; }
globalThis.localStorage = blocked;
check('87 a blocked localStorage never throws', !threw);

// ── 88 · the guides ──────────────────────────────────────────────────────────
const stepFor = (key, target) => (G.SCREEN_GUIDES[key] || []).find(s => s.target === target);
check('88 the guides say MAX OUT: the library, the guided ring, Build Workout', /MAX OUT: max reps on each move, then switch\./.test(stepFor('quick_mission_setup_v2', 'qm-library')?.body || '')
  && /On a MAX set the ring says MAX\. Do clean reps until your form breaks, then tap DONE and enter your reps\./.test(stepFor('quick_mission_active', 'qma-ring')?.body || '')
  && stepFor('workout_builder', 'wb-maxout')?.body === 'MAX OUT: five max-rep workouts. Your gear and difficulty pick the list and the level.');

// ── 89 · a swap never moves the plan, the XP or breaks a cap ─────────────────
// The plan (minutes, the XP ceiling) is priced on the authored move and reps, so choosing a
// slower or faster move can neither raise nor cut what a full run pays ("Swaps never cost XP").
const planBad = [];
let swapCount = 0;
every((id, lv, m) => m.exercises.forEach(sl => reach(m, sl.swapKey).forEach(mid => {
  if (mid === sl.baseMoveId) return;
  swapCount += 1;
  const sm = L.swapMissionMove(m, sl.swapKey, mid);
  const slot = sm.exercises.find(x => x.swapKey === sl.swapKey);
  const cap = M.repCapFor(mid, lv);
  if (S.fullRunXp(sm) !== S.fullRunXp(m) || S.estimateMissionSeconds(sm) !== S.estimateMissionSeconds(m) || S.plannedThrough(sm, S.totalSlots(sm)) !== S.plannedThrough(m, S.totalSlots(m))) planBad.push(`${id}/${lv}/${sl.swapKey} -> ${mid} moves the plan`);
  if ((slot.cap ?? null) !== cap) planBad.push(`${id}/${lv}/${sl.swapKey} -> ${mid} cap ${slot.cap} vs ${cap}`);
  if (cap != null && slot.reps > cap) planBad.push(`${id}/${lv}/${sl.swapKey} -> ${mid} first set ${slot.reps} over cap ${cap}`);
  if (slot.max !== true || slot.cadenceMs !== null || 'sides' in slot) planBad.push(`${id}/${lv}/${sl.swapKey} -> ${mid} not a max set`);
})));
check(`89 all ${swapCount} reachable swaps: the plan, the minutes and the full-run XP do not move; the cap follows the move; a first set never starts over its cap`, planBad.length === 0 && swapCount > 100, planBad.slice(0, 4).join('; '));
const kbd = L.swapMissionMove(build('combo_meter', 'standard'), 'hinge', 'kb-deadlift').exercises[0];
check('89 COMBO METER swings -> kettlebell deadlifts: 15 becomes 12 (the deadlift cap), still priced on 15 swings', kbd.reps === 12 && kbd.cap === 12 && kbd.planReps === 15 && kbd.baseMoveId === 'kb-swing'
  && S.fullRunXp(L.swapMissionMove(build('combo_meter', 'standard'), 'hinge', 'kb-deadlift')) === S.fullRunXp(build('combo_meter', 'standard'))
  && L.swapMissionMove(build('combo_meter', 'beginner'), 'hinge', 'kb-deadlift').exercises[0].reps === 10);
check('89 a swapped plan comes back to the same slot on undo (back to the base move)', eq(L.swapMissionMove(L.swapMissionMove(build('combo_meter', 'standard'), 'hinge', 'kb-deadlift'), 'hinge', 'kb-swing').exercises, build('combo_meter', 'standard').exercises));

// ── 90 · the moves no MAX OUT swap may reach ─────────────────────────────────
const bannedBad = [];
const ROWS = new Set(['db-bent-over-row', 'bb-bent-over-row']);
every((id, lv, m) => m.exercises.forEach((sl, i) => {
  const n = m.exercises.length;
  const around = [m.exercises[(i + n - 1) % n], m.exercises[(i + 1) % n]].map(x => M.regionOf(x.baseMoveId));
  reach(m, sl.swapKey).forEach(mid => {
    if (M.MAX_OUT_BANNED.has(mid)) bannedBad.push(`${id}/${lv}/${mid} banned`);
    // A hinged-back row never sits next to a hinge station (the backpack deadlift is the very next one).
    if (ROWS.has(mid) && mid !== sl.baseMoveId && around.includes('hinge')) bannedBad.push(`${id}/${lv}/${sl.swapKey} ${mid} next to a hinge`);
  });
}));
check('90 no swap reaches a loaded dead bug, a Hindu squat to knee strike, a split squat or a lunge to knee drive; no bent-over row can be swapped in beside a hinge', bannedBad.length === 0
  && [...M.MAX_OUT_BANNED].every(id => M.moveById(id)) && M.MAX_OUT_BANNED.size === 6, bannedBad.slice(0, 4).join('; '));
check('90 TANK MODE\'s rows stay dead-stop at every level: the one pull option, no swap offered, never the plain bent-over row', LEVELS.every(lv => {
  const t = build('tank_mode', lv);
  return eq(reach(t, 'pull'), ['bb-dead-stop-row']) && L.swapOptions(t, 'pull').length === 0 && L.cardRows(t)[0].canSwap === false && L.isSwapAllowed(t, 'pull', 'bb-bent-over-row') === false;
}));
check('90 HEALTH BAR has no bent-over row for the pull, at any level; the pull stays on the bar (pull-ups, jumping pull-ups, ring rows)', LEVELS.every(lv => {
  const h = build('health_bar', lv);
  return eq(reach(h, 'pull').sort(), ['jumping-pull-up', 'pull-up', 'ring-row']) && !L.isSwapAllowed(h, 'pull', 'db-bent-over-row') && !L.isSwapAllowed(h, 'pull', 'bb-bent-over-row');
}));
check('90 COMBO METER does its dead bugs with no bell at every level, and cannot swap to a loaded one', LEVELS.every(lv => {
  const c = build('combo_meter', lv);
  return c.exercises[3].moveId === 'dead-bug' && M.moveById('dead-bug').gear === 'none' && eq(reach(c, 'core'), ['dead-bug']) && !L.isSwapAllowed(c, 'core', 'kb-dead-bug') && !L.isSwapAllowed(c, 'core', 'backpack-dead-bug');
}));
check('90 DUAL WIELD\'s lunge station has no rear-foot-raised or moving-foot swap at any level', LEVELS.every(lv => {
  const d = build('dual_wield', lv);
  return !reach(d, 'quads').some(id => /bulgarian|knee-drive/.test(id));
}));

// ── 91 · a stop line never contradicts its own cue ───────────────────────────
const stopBad = [];
every((id, lv, m) => {
  const word = m.weightWord || null;
  m.exercises.forEach(sl => reach(m, sl.swapKey).forEach(mid => {
    const rule = M.STOP_RULES[mid] || '';
    const cues = M.maxCues(mid, word).join(' ');
    if (/heels lift/.test(rule) && /heels rise/.test(cues)) stopBad.push(`${id}/${lv}/${mid} heels`);
    if (/\bkip\b/i.test(cues) || /\bbox\b/i.test(cues)) stopBad.push(`${id}/${lv}/${mid} kip or box`);
    if (word && /\bbell\b/.test(cues)) stopBad.push(`${id}/${lv}/${mid} bell`);
    if (/\bkg\b/.test(cues)) stopBad.push(`${id}/${lv}/${mid} a weight in a cue`);
    L.swapOptions(m, sl.swapKey).forEach(o => { if (o.cues.some(c => /\bkip\b/i.test(c))) stopBad.push(`${id}/${lv}/${o.id} kip in the swap sheet`); });
  }));
});
check('91 no reachable move has a stop line that its own cue contradicts (heels), a kip, a box, a weight or a bell on a dumbbell workout', stopBad.length === 0, [...new Set(stopBad)].slice(0, 5).join('; '));
check('91 the Hindu squats stop on the knees and the chest, never on the heels they lift on purpose; the plain squats keep the heels rule', M.STOP_RULES['hindu-squat'] === 'Stop when your knees cave or your chest drops.'
  && M.STOP_RULES['half-hindu-squat'] === M.STOP_RULES['hindu-squat'] && /heels lift/.test(M.STOP_RULES['air-squat']) && /heels lift/.test(M.STOP_RULES['heels-down-hindu-squat']) && !/heel/.test(M.STOP_RULES['hindu-squat']));
check('91 pull-ups say one thing everywhere: step down to the floor, no swinging (the stop line, the HEALTH BAR safety line, the swap sheet); the catalog keeps its own cue for the earlier missions', /Step down to the floor\. No swinging\./.test(M.STOP_RULES['pull-up'])
  && /step down to the floor/i.test(L.missionDefById('health_bar').safety) && !/drop to the floor/i.test(L.missionDefById('health_bar').safety)
  && M.maxCues('pull-up').length === 2 && M.moveById('pull-up').cues.length === 3 && M.moveById('pull-up').cues[2].startsWith('Kip only if you already can')
  && M.maxCues('jumping-pull-up')[0] === 'A bar low enough to stand under, feet on the floor.' && M.moveById('jumping-pull-up').cues[0].includes('a box beneath it'));
check('91 the front squat says what to do when the bar slides; the TANK MODE safety card says it too', /let it go forward/.test(M.STOP_RULES['bb-front-squat']) && /let it go forward/.test(L.missionDefById('tank_mode').safety));
check('91 plain words in the lines read mid-set: no "fist off the floor", no "short of that", no "kip"', !Object.values(M.STOP_RULES).some(r => /fist off|short of that|\bkip\b/i.test(r)) && !/short of that/.test(M.maxStopLine({ moveId: 'push-up', leave: 2 })) && /Stop 2 reps before that\./.test(M.maxStopLine({ moveId: 'push-up', leave: 2 })));

// ── 92 · the cap, zero reps and short sets in the settle ─────────────────────
const hb = build('health_bar');
const expired = { awardXp: false, validityStatus: 'expired', reason: 'x' };
const idle = { awardXp: false, validityStatus: 'idleTimeout', reason: 'x' };
const oneSet = entries(std, 1, 20, 40);
const cappedG = guided(std, oneSet, { completed: false, capped: true, elapsedSec: 1250, integrityResult: expired });
const cappedS = solo(std, oneSet, { completed: false, capped: true, elapsedSec: 1250 });
check('92 the GUIDED cap pays the sets saved even when its open round is EXPIRED or IDLE: a partial, no bonus, never VALIDATION FAILED; AT YOUR PACE pays the same', cappedG.xp > 0 && cappedG.xp === cappedS.xp && cappedG.outcome === 'partial' && cappedG.verdict.outcome === 'partial'
  && cappedG.verdict.preset.eyebrow === 'SESSION STOPPED' && guided(std, oneSet, { completed: false, capped: true, elapsedSec: 1250, integrityResult: idle }).xp === cappedG.xp
  && guided(std, entries(std, 3, 20, 40), { completed: false, capped: true, elapsedSec: 1250, integrityResult: expired }).xp === S.maxRepsXp(std, 3, { elapsedSec: 1250 }), show([cappedG.xp, cappedS.xp, cappedG.outcome]));
check('92 without the cap an EXPIRED or IDLE run is still refused (the anti-cheat gate is only lifted for the cap)', guided(std, honest, { integrityResult: expired }).outcome === 'validation_failed' && guided(std, honest, { integrityResult: expired }).xp === 0
  && guided(std, honest, { integrityResult: idle }).xp === 0 && guided(std, honest, { completed: false, stopped: true, elapsedSec: 600, integrityResult: expired }).xp === 0);
const hbSets = (zeroAt) => entries(hb, 9, i => (i === zeroAt ? 0 : 10), 40);
const zero8 = solo(hb, hbSets(7), { elapsedSec: 900 });
const zeroG = guided(hb, hbSets(7), { elapsedSec: 900 });
check('92 a set with no reps says so, not "the clock was too short"; it never counts and loses the bonus, as before', zero8.message === 'A set with no reps does not count.' && zeroG.message === zero8.message
  && zero8.credited === 8 && zero8.outcome === 'partial' && zero8.xp === S.maxRepsXp(hb, 8, { elapsedSec: 900 }) && zeroG.xp === zero8.xp && S.MAX_NO_REPS_MESSAGE === zero8.message);
const short = entries(hb, 9, 10, i => (i === 2 ? 5 : 40));
const both = entries(hb, 9, i => (i === 1 ? 0 : 10), i => (i === 2 ? 5 : 40));
check('92 a set under 8 seconds says so; no reps and under 8 seconds say both; a clock too short still says the clock', solo(hb, short, { elapsedSec: 900 }).message === 'A set under 8 seconds does not count.'
  && solo(hb, both, { elapsedSec: 900 }).message === 'A set with no reps, or under 8 seconds, does not count.' && solo(hb, hbSets(-1), { elapsedSec: 900 }).message === null
  && solo(hb, entries(hb, 3, 0, 40), { elapsedSec: 900 }).message === 'A set with no reps does not count.' && solo(hb, entries(hb, 3, 10, 40), { elapsedSec: 5 }).message === 'The clock was too short, so no sets count.'
  && solo(hb, entries(hb, 9, 10, 8), { elapsedSec: 100 }).message === 'The clock was too short, so 4 of 9 sets count.');

// ── 93 · the cap is said aloud ───────────────────────────────────────────────
const capBad = [];
every((id, lv, m) => m.exercises.forEach((sl, i) => {
  const cap = M.repCapFor(sl.moveId, lv);
  if ((sl.cap ?? null) !== cap) capBad.push(`${id}/${lv}/${i} slot cap`);
  const line = M.leadLine(sl, ctxFor(m, 1, i));
  if (cap != null && !line.endsWith(` Never more than ${cap}.`)) capBad.push(`${id}/${lv}/${i} lead "${line}"`);
  if (cap == null && /Never more than/.test(line)) capBad.push(`${id}/${lv}/${i} lead "${line}"`);
  if (cap != null && !M.chainedLine(sl).includes(`Never more than ${cap}. Go.`)) capBad.push(`${id}/${lv}/${i} chained`);
}));
check('93 every capped station says its cap in the lead and the chained line ("Never more than 15."), every uncapped one says none', capBad.length === 0, capBad.slice(0, 3).join('; '));
check('93 a hinge or swing set gets one spoken "Stop. Set it down." at the cap\'s pace for the level; no other set does', M.MAX_CAP_CALL === 'Stop. Set it down.'
  && M.maxCapCallSec(build('combo_meter').exercises[0], 'standard') === Math.round(15 * M.estMsFor('kb-swing', 'standard') / 1000)
  && M.maxCapCallSec(build('health_bar').exercises[1], 'standard') === 30 && M.maxCapCallSec(build('health_bar', 'elite').exercises[1], 'elite') === 24
  && M.maxCapCallSec(build('combo_meter', 'beginner').exercises[0], 'beginner') === Math.round(12 * M.estMsFor('kb-swing', 'beginner') / 1000)
  && M.maxCapCallSec(build('boss_rush').exercises[2], 'standard') === null && M.maxCapCallSec(build('boss_rush').exercises[0], 'standard') === null && M.maxCapCallSec(build('combo_meter').exercises[2], 'standard') === null
  && M.maxCapCallSec(undefined) === null && M.maxCapCallSec({ moveId: 'kb-swing' }) === null);
// A quarter of a rep sheet, in numbers: nothing is saved over the cap or what the seconds hold.
check('93 the saved score still clamps a set to its cap whatever was typed (the backstop)', eq(S.maxRepsScore(hb, [{ reps: 40, sec: 90 }, { reps: 40, sec: 90 }, { reps: 40, sec: 90 }], { timeSec: 300 }).byStation[1].reps, [12]));

// ── 94 · copy that agrees with the data ──────────────────────────────────────
// The backpack deadlift (HEALTH BAR\'s own move) is never "Romanian": not on the card, the mission line, the coach, the rest. (The
// dumbbell RDL a swap can reach keeps its catalog name: it is another move, shared with earlier missions.)
const allCopy = [...strings([defs.map(d => ({ ...d, levels: undefined })), every((id, lv, m) => m).map(m => ({ ...m }))]),
  ...every((id, lv, m) => m.exercises.map((sl, i) => M.leadLine(sl, ctxFor(m, 1, i)))).flat(), M.moveById('backpack-rdl').name, M.moveById('backpack-rdl').say];
check('94 nothing a MAX OUT athlete reads or hears about the backpack deadlift says "Romanian": the card, the coach, the mission line all say Backpack Deadlifts', !allCopy.some(t => /romanian/i.test(String(t)))
  && L.cardRows(build('health_bar'))[1].name === 'Backpack Deadlifts' && build('health_bar').missionLine.includes('BACKPACK DEADLIFTS') && M.spokenMove(build('health_bar').exercises[1]) === 'backpack deadlifts'
  && !/tight to your back/.test(L.missionDefById('health_bar').note) && /close to your body/.test(L.missionDefById('health_bar').note) && !/\bkg\b/.test(M.maxCues('backpack-rdl').join(' ')));
const beginnerIntro = (id) => build(id, 'beginner').introSay.toLowerCase();
check('94 a BEGINNER brief names the beginner moves, not the harder ones', /knee push-ups, squats, crunches/.test(beginnerIntro('boss_rush')) && /jumping pull-ups, backpack deadlifts, slow climbers/.test(beginnerIntro('health_bar'))
  && /rows, knee push-ups, goblet squats/.test(beginnerIntro('tank_mode')) && /floor presses, lunges, rows, knee pull-throughs/.test(beginnerIntro('dual_wield'))
  && /^tank mode\./i.test(build('tank_mode', 'beginner').introSay) && !/sit-ups|front squats/.test(beginnerIntro('boss_rush') + beginnerIntro('tank_mode')));
check('94 TANK MODE: the stop-two-short promise is made for the bar sets, and push-ups at STANDARD and ELITE keep none', ['standard', 'elite'].every(lv => build('tank_mode', lv).exercises.map(sl => sl.leave ?? 0).join() === '2,0,2' && /Stop two short on the bar\./.test(build('tank_mode', lv).introSay))
  && /every bar set/.test(L.missionDefById('tank_mode').safety) && !/every set/.test(L.missionDefById('tank_mode').safety) && /too risky to take to failure/.test(L.missionDefById('tank_mode').scale) && !/rack and a spotter/.test(L.missionDefById('tank_mode').scale));
check('94 DUAL WIELD speaks of dumbbells; COMBO METER keeps its bell; the pull-up bar swaps in for the rows', L.missionDefById('dual_wield').weightWord === 'dumbbell' && build('dual_wield').weightWord === 'dumbbell' && build('combo_meter').weightWord === undefined
  && M.maxCues('kb-reverse-lunge', 'dumbbell')[0] === 'Hold the dumbbell at the chest.' && M.maxCues('kb-plank-pull-through', 'dumbbell').every(c => !/\bbell\b/.test(c)) && M.maxCues('kb-reverse-lunge')[0] === 'Hold the bell at the chest.'
  && L.missionDefById('dual_wield').loadoutLine.endsWith('A PULL-UP BAR SWAPS IN FOR THE ROWS'));
// Pace marks: first-set reps, each later set 85% of the one before, hinge flat; the STANDARD mark is that number (within 3%).
const paceOff = [];
every((id, lv, m) => {
  let tot = 0;
  m.exercises.forEach(sl => { const hinge = M.regionOf(sl.baseMoveId) === 'hinge'; for (let r = 0; r < m.rounds; r += 1) tot += hinge ? sl.reps : sl.reps * Math.pow(0.85, r); });
  if (Math.abs(m.pace.standard / tot - 1) > 0.03) paceOff.push(`${id}/${lv} ${m.pace.standard} vs ${Math.round(tot)}`);
  if (Math.abs(m.pace.elite / m.pace.standard - 1.3) > 0.1 || Math.abs(m.pace.beginner / m.pace.standard - 0.69) > 0.06) paceOff.push(`${id}/${lv} ratios ${show(m.pace)}`);
});
check('94 all fifteen pace marks follow the stated formula to within 3%, and keep the 1.3 / 0.69 spread', paceOff.length === 0, paceOff.join('; '));

// ── 96 · the level word ──────────────────────────────────────────────────────
check('96 a MAX OUT card, preview tag and finish say the level (BEGINNER / STANDARD / ELITE), the word Build Workout\'s EASY / NORMAL / HARD hands over', every((id, lv, m) => L.missionCardModel(m).tags[1] === lv.toUpperCase()).every(Boolean)
  && every((id, lv, m) => L.missionCardModel(m).tags.includes(String(m.difficulty).toUpperCase()) === (lv.toUpperCase() === String(m.difficulty).toUpperCase())).every(Boolean)
  && L.missionCardModel(L.buildLoadoutMission('best_of_3')).tags[1] === 'NORMAL' && L.shelfEntryLine(L.shelfEntries()[0]) === '~16 MIN · BARBELL · EMOM');

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
