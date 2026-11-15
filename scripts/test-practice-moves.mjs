// Practice Mode's move list (the Ladder): the ordered moves of each discipline, what counts as LEARNED and how the
// older keys carry over, the watch video of a move, the drill clips of a call, and the starter arsenal.
// Run: npm run test:practice-moves
import process from 'node:process';
import fs from 'node:fs';
import { PRACTICE_DISCIPLINES, TECHNIQUES } from '../components/training-mode/practiceData.js';
import { basicsFor } from '../components/training-mode/data/practiceLessons.js';
import * as P from '../components/training-mode/data/practiceMoves.js';
import { planCall, callParts, drillSources } from '../components/training-mode/data/drillClips.js';
import { buildRound, spokenCall, tierFor, PLANS, planSeconds, mmss } from '../components/training-mode/data/practiceRound.js';
import { STARTER_ARSENAL, getEffectiveArsenal, getArsenal, strikesFrom, countStrikes, comboUsesOnlyLearned, disciplineSlug } from '../components/training-mode/data/arsenal.js';
import { generateComboCoachSession, generateComboCoachRoundPlans } from '../components/training-mode/data/sessionGenerator.js';
import * as M from '../components/training-mode/data/comboMix.js';
import COMBO_POOL from '../components/training-mode/data/comboCoachData.js';
import { parseShadowIndex } from '../components/training-mode/data/shadowboxing.js';
import * as Invite from '../components/training-mode/data/practiceInvite.js';
import { getFightMiniSuggestion } from '../components/training-mode/data/recommendations.js';
import { planClips } from '../components/training-mode/data/voiceClips.js';
import practiceSweeps from './sweeps/practice-and-extras.mjs';

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => { if (ok) { pass++; console.log(`  ok   ${name}`); } else { fail++; console.log(`  FAIL ${name}${detail ? ': ' + detail : ''}`); } };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const root = (p) => new URL(`../${p}`, import.meta.url);
const read = (p) => fs.readFileSync(root(p), 'utf8');
const onDisk = (url) => fs.existsSync(root(`public${url}`));

const { movesFor, groupsOf, STANCE_GROUP, STRIKE_GROUPS, SHARED_PUNCHES, LESSON_TO_MOVES, LEARNED_KEY } = P;
const by = (discipline, name) => movesFor(discipline).find((m) => m.name === name);
const LESSONS_KEY = 'tm_starthere_completed', DRILLED_KEY = 'tm_practice_library_drilled', ARSENAL_KEY = 'tm_arsenal';
const FIRST_KEY = 'trainingModeStartHereFirstLessonComplete';

// ── with no storage at all (plain Node) ────────────────────────────────────
{
  let threw = '';
  try {
    P.learnMove(by('Boxing', 'Jab'), 'Boxing');
    P.learnMoves(movesFor('Boxing').slice(0, 3), 'Boxing');
  } catch (e) { threw = String(e); }
  check('with no storage nothing is learned and nothing throws', !threw && same(P.getLearned(), {}) && same(getEffectiveArsenal('Boxing'), ['Jab', 'Cross']), threw);
}

// A storage for the rest of the run, emptied between cases.
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => { store.set(k, String(v)); },
  removeItem: (k) => { store.delete(k); }, clear: () => store.clear(), key: (i) => [...store.keys()][i] ?? null, get length() { return store.size; },
};
const fresh = (seed = {}) => { store.clear(); for (const [k, v] of Object.entries(seed)) store.set(k, typeof v === 'string' ? v : JSON.stringify(v)); };
const json = (k, fallback) => (store.has(k) ? JSON.parse(store.get(k)) : fallback);

// ── every discipline's list ────────────────────────────────────────────────
const KINDS = ['STANCE', 'GUARD', 'PUNCH', 'KICK', 'KNEE', 'ELBOW', 'MOVE', 'DEFENSE', 'FOOTWORK'];
const LEVELS = ['Beginner', 'Intermediate', 'Advanced'];
for (const d of PRACTICE_DISCIPLINES) {
  const moves = movesFor(d);
  const slug = disciplineSlug(d);
  const groups = groupsOf(moves).map((g) => g.group);
  const ids = moves.map((m) => m.id);
  check(`${d}: the list has moves and no id twice`, moves.length > 10 && new Set(ids).size === ids.length, ids.filter((x, i) => ids.indexOf(x) !== i).join());
  const bad = moves.filter((m) => !(typeof m.id === 'string' && m.id && typeof m.name === 'string' && m.name && KINDS.includes(m.kind) && LEVELS.includes(m.level)
    && typeof m.description === 'string' && m.description && Array.isArray(m.cues) && m.cues.length === 3 && Array.isArray(m.steps) && Array.isArray(m.mistakes)
    && Array.isArray(m.calls) && m.calls.length && m.calls.every((c) => typeof c === 'string' && c) && new Set(m.calls).size === m.calls.length
    && typeof m.tutorialUrl === 'string' && Array.isArray(m.lessonIds) && typeof m.shared === 'boolean' && (m.num === null || typeof m.num === 'string')));
  check(`${d}: every move has every field (three cues, calls with no repeat)`, bad.length === 0, bad.map((m) => m.name).join());

  check(`${d}: each group is one block, and none is empty`, new Set(groups).size === groups.length, groups.join(' | '));
  check(`${d}: ${STANCE_GROUP} first, PUNCHES right after it`, groups[0] === STANCE_GROUP && groups[1] === 'PUNCHES', groups.join(' | '));
  check(`${d}: DEFENSE then FOOTWORK close the list`, same(groups.slice(-2), ['DEFENSE', 'FOOTWORK']), groups.join(' | '));
  const middle = groups.slice(1, -2);
  check(`${d}: between them only strike groups`, middle.every((g) => STRIKE_GROUPS.includes(g)), middle.join(' | '));
  // File order: where each strike sits in the library.
  const file = TECHNIQUES.filter((t) => t.discipline === d && t.category === 'Strikes').map((t) => t.name);
  const firstAt = (g) => Math.min(...moves.filter((m) => m.group === g).map((m) => file.indexOf(m.name)));
  const rest = middle.filter((g) => g !== 'PUNCHES');
  check(`${d}: the other strike groups come in the order they first appear in the library`, rest.every((g, i) => i === 0 || firstAt(rest[i - 1]) < firstAt(g)), rest.map((g) => `${g}@${firstAt(g)}`).join(' '));
  check(`${d}: inside a strike group the library's own order is kept`, middle.every((g) => { const at = moves.filter((m) => m.group === g).map((m) => file.indexOf(m.name)); return at.every((x, i) => x >= 0 && (i === 0 || at[i - 1] < x)); }));

  const stance = moves.filter((m) => m.group === STANCE_GROUP);
  check(`${d}: the stance is a lesson of this discipline, with its seven steps and its calls`,
    stance.length === (d === 'Boxing' ? 2 : 1) && stance.every((m) => { const l = basicsFor(d).find((x) => x.id === m.lessonIds[0]); return l && m.name === l.title && same(m.calls, l.calls) && same(m.steps, l.steps) && m.steps.length === 7 && m.description === l.subtitle && m.id === `${slug}:${m.id.split(':')[1]}`; }));

  const techs = [...file, ...P.techniquesFor(d, 'Defense').map((t) => t.name), ...P.techniquesFor(d, 'Footwork').map((t) => t.name)];
  const listed = moves.filter((m) => m.group !== STANCE_GROUP).map((m) => m.name);
  check(`${d}: every technique of the library is on the list once (${techs.length}), and nothing else`, same([...listed].sort(), [...techs].sort()));
  check(`${d}: a technique's first call is its own name, and it keeps its cues, mistakes and level`,
    moves.filter((m) => m.group !== STANCE_GROUP).every((m) => { const t = P.techniquesFor(d, m.group === 'DEFENSE' ? 'Defense' : m.group === 'FOOTWORK' ? 'Footwork' : 'Strikes').find((x) => x.name === m.name); return t && m.calls[0] === m.name.toUpperCase() && same(m.cues, t.cues) && same(m.mistakes, t.mistakes) && m.level === t.level && m.description === t.description && m.steps.length === 0; }));

  const shared = moves.filter((m) => m.shared);
  check(`${d}: the six punches are shared, and only they`, same(shared.map((m) => m.name), SHARED_PUNCHES) && shared.every((m) => m.id.startsWith('shared:') && m.group === 'PUNCHES'));
  check(`${d}: every other id starts with the discipline`, moves.filter((m) => !m.shared).every((m) => m.id.startsWith(`${slug}:`)));
  check(`${d}: the tutorial is the library's or the lesson's video, on disk with its poster`,
    moves.every((m) => !m.tutorialUrl || (onDisk(m.tutorialUrl) && onDisk(m.tutorialUrl.replace(/\.mp4$/, '.webp')))));
}
check('the six punches have the same id in all four disciplines',
  SHARED_PUNCHES.every((n) => new Set(PRACTICE_DISCIPLINES.map((d) => by(d, n).id)).size === 1) && by('MMA', 'Lead Hook').id === 'shared:lead-hook');
check('a move that two disciplines both list keeps one id per discipline', by('Boxing', 'Slip Outside').id === 'boxing:slip-outside' && by('Muay Thai', 'Slip Outside').id === 'muay-thai:slip-outside' && by('MMA', 'Rear Knee').id === 'mma:rear-knee');
check('Muay Thai groups: stance, punches, kicks, elbows, knees, more, defense, footwork', same(groupsOf(movesFor('Muay Thai')).map((g) => g.group), [STANCE_GROUP, 'PUNCHES', 'KICKS', 'ELBOWS', 'KNEES', 'MORE', 'DEFENSE', 'FOOTWORK']));
check('Boxing has no kicks: stance, punches, defense, footwork', same(groupsOf(movesFor('Boxing')).map((g) => g.group), [STANCE_GROUP, 'PUNCHES', 'DEFENSE', 'FOOTWORK']));
check('kinds and numbers: jab 1, lead hook 3, body jab 1B; kicks, knees and elbows have no number',
  by('Boxing', 'Jab').num === '1' && by('Boxing', 'Lead Hook').num === '3' && by('Boxing', 'Body Jab').num === '1B' && by('Boxing', 'Jab').kind === 'PUNCH'
  && by('Muay Thai', 'Lead Teep').kind === 'KICK' && by('Muay Thai', 'Lead Teep').num === null && by('Muay Thai', 'Roundhouse Knee').kind === 'KNEE' && by('Muay Thai', 'Roundhouse Knee').group === 'KNEES'
  && by('Muay Thai', 'Lead Hook Elbow').kind === 'ELBOW' && by('Muay Thai', 'Lead Hook Elbow').group === 'ELBOWS' && by('Muay Thai', 'Lead Hook Elbow').num === null);
check('what is not a strike sits under MORE as a MOVE: check, clinch entry, sprawl, level change, the shoot, the ground posture',
  ['Check', 'Clinch Entry'].every((n) => by('Muay Thai', n).group === 'MORE' && by('Muay Thai', n).kind === 'MOVE')
  && ['Sprawl', 'Level Change', 'Basic Shoot Entry', 'Ground-and-Pound Posture'].every((n) => by('MMA', n).group === 'MORE' && by('MMA', n).kind === 'MOVE') && by('MMA', 'Overhand').group === 'PUNCHES');
check('Boxing opens on Boxing Stance, then Guard + Footwork (kind GUARD), then the jab', same(movesFor('Boxing').slice(0, 3).map((m) => `${m.name}/${m.kind}`), ['Boxing Stance/STANCE', 'Guard + Footwork/GUARD', 'Jab/PUNCH']));
check('a lesson\'s calls go to the move it taught', same(by('Boxing', 'Jab').calls, ['JAB', 'JAB × 2', 'STEP JAB']) && same(by('Muay Thai', 'Rear Knee').calls, ['REAR KNEE', 'LEAD KNEE', 'KNEE × 2'])
  && same(by('Muay Thai', 'Lead Hook Elbow').calls, ['LEAD HOOK ELBOW', 'ELBOW', 'ELBOW × 2', 'CROSS → ELBOW']) && same(by('Boxing', 'Lead Hook').calls, ['LEAD HOOK']));
check('a lesson of two moves gives its calls to the later one: the jab drill never calls a cross',
  same(by('Boxing', 'Cross').calls, ['CROSS', 'CROSS × 2', 'JAB → CROSS', 'JAB → JAB → CROSS']) && PRACTICE_DISCIPLINES.every((d) => by(d, 'Jab').calls.every((c) => !/CROSS/.test(c)))
  && same(by('MMA', 'Lead Teep').calls, ['LEAD TEEP']) && same(by('MMA', 'Low Kick').calls, ['LOW KICK', 'TEEP', 'JAB → LOW KICK']));
check('the tutorial: the library\'s video, else the lesson\'s, else none', by('Muay Thai', 'Rear Knee').tutorialUrl === '/static/practice/rear-knee.mp4' && by('Kickboxing', 'Rear Roundhouse Kick').tutorialUrl === '/static/practice/rear-roundhouse-kick.mp4' && by('Boxing', 'Jab').tutorialUrl === '');
check('an unknown discipline gets Boxing, and a list is the same list every call', movesFor('Wrestling') === movesFor('Boxing') && movesFor('MMA') === movesFor('MMA'));

// ── LESSON_TO_MOVES ────────────────────────────────────────────────────────
{
  const lessonIds = new Set(PRACTICE_DISCIPLINES.flatMap((d) => basicsFor(d).map((l) => l.id)));
  check('every lesson is in the table, and the table names only real lessons', [...lessonIds].every((id) => Array.isArray(LESSON_TO_MOVES[id])) && Object.keys(LESSON_TO_MOVES).every((id) => lessonIds.has(id)),
    [...lessonIds].filter((id) => !LESSON_TO_MOVES[id]).concat(Object.keys(LESSON_TO_MOVES).filter((id) => !lessonIds.has(id))).join());
  const missing = [];
  for (const d of PRACTICE_DISCIPLINES) for (const l of basicsFor(d)) for (const n of LESSON_TO_MOVES[l.id] || []) if (!by(d, n)) missing.push(`${l.id}: ${n}`);
  check('every move the table names is on that discipline\'s list', missing.length === 0, missing.join(' | '));
  check('the lessons with no move of their own: the numbers, Basic Defense, the kickboxing combo, MMA movement',
    same(Object.keys(LESSON_TO_MOVES).filter((id) => LESSON_TO_MOVES[id].length === 0).sort(), ['boxing_defense', 'kb_combo', 'know_your_numbers', 'mma_movement']));
  const wrong = [];
  for (const d of PRACTICE_DISCIPLINES) for (const m of movesFor(d)) {
    const want = basicsFor(d).filter((l) => (LESSON_TO_MOVES[l.id] || []).includes(m.name)).map((l) => l.id);
    if (!same(m.lessonIds, want)) wrong.push(`${d} ${m.name}: ${m.lessonIds} / ${want}`);
  }
  check('a move\'s lessonIds are the lessons of its discipline that name it', wrong.length === 0, wrong.join(' | '));
  check('the examples of the plan hold', same(by('Boxing', 'Jab').lessonIds, ['boxing_jab', 'boxing_jab_cross']) && same(by('Kickboxing', 'Lead Teep').lessonIds, ['kb_front_kick'])
    && same(by('Muay Thai', 'Rear Knee').lessonIds, ['mt_knee']) && same(by('Muay Thai', 'Lead Hook Elbow').lessonIds, ['mt_elbow']) && same(by('MMA', 'Low Kick').lessonIds, ['mma_teep_low']) && same(by('MMA', 'Lead Teep').lessonIds, ['mma_teep_low']));
}

// ── learned: what the older keys carry over ────────────────────────────────
{
  fresh({ [LESSONS_KEY]: ['boxing_jab_cross', 'kb_front_kick', 'mt_knee', 'know_your_numbers', 'boxing_defense', 'boxing_stance', 'no_such_lesson'] });
  check('finished lessons mean their moves are learned (Jab-Cross is both; a lesson with no move adds nothing)',
    same(Object.keys(P.getLearned()).sort(), ['boxing:boxing-stance', 'kickboxing:lead-teep', 'muay-thai:rear-knee', 'shared:cross', 'shared:jab']));
  fresh({ [DRILLED_KEY]: { Boxing: ['Lead Hook', 'Slip Outside'], 'Muay Thai': ['Lead Horizontal Elbow', 'Slip Outside', 'Not A Move'], MMA: 'junk' } });
  check('drilled library techniques are learned, under the discipline they were drilled in (a renamed one too, an unknown name not)',
    same(Object.keys(P.getLearned()).sort(), ['boxing:slip-outside', 'muay-thai:lead-hook-elbow', 'muay-thai:slip-outside', 'shared:lead-hook']));
  fresh({ [LESSONS_KEY]: ['mma_sprawl'], [DRILLED_KEY]: { MMA: ['Sprawl', 'Overhand'] }, [LEARNED_KEY]: { 'mma:sprawl': '2026-11-01', 'mma:switch-kick': '2026-11-02' } });
  const all = P.getLearned();
  check('the new key and both older keys are added together, and the new key\'s date wins', same(Object.keys(all).sort(), ['mma:overhand', 'mma:sprawl', 'mma:switch-kick']) && all['mma:sprawl'] === '2026-11-01' && all['mma:overhand'] === true);
  check('isLearned takes a move or an id', P.isLearned(all, by('MMA', 'Sprawl')) && P.isLearned(all, 'mma:overhand') && !P.isLearned(all, by('MMA', 'Jab')) && !P.isLearned(null, 'x') && !P.isLearned(all, null));
  let ok = true;
  for (const junk of ['null', '[1,2]', 'not json', '"x"', '7', '{"shared:jab":0,"shared:cross":null}']) {
    fresh({ [LEARNED_KEY]: junk, [LESSONS_KEY]: junk, [DRILLED_KEY]: junk, [ARSENAL_KEY]: junk });
    try { ok = ok && same(P.getLearned(), {}) && same(getEffectiveArsenal('MMA'), ['Jab', 'Cross']) && P.learnMove(by('MMA', 'Overhand'), 'MMA').fresh === true; } catch (e) { ok = false; console.log(`         ${junk}: ${e}`); }
  }
  check('broken stored values read as nothing learned and never throw', ok);
}

// ── learnMove ──────────────────────────────────────────────────────────────
{
  fresh();
  const jab = by('Boxing', 'Jab');
  const r = P.learnMove(jab, 'Boxing', '2026-11-15');
  check('learning the jab writes the new key with the day', r.fresh === true && same(json(LEARNED_KEY), { 'shared:jab': '2026-11-15' }));
  check('a shared punch is banked for Combo Coach in all four disciplines', ['boxing', 'kickboxing', 'muay-thai', 'mma'].every((s) => same(json(ARSENAL_KEY)[s], ['Jab'])) && same(r.gained, []));
  check('the technique is marked drilled in this discipline (the older key)', same(json(DRILLED_KEY), { Boxing: ['Jab'] }));
  check('a lesson is marked complete once every move it taught is learned: Jab yes, Jab-Cross not yet', same(json(LESSONS_KEY).sort(), ['boxing_jab', 'kb_jab']));
  check('so learning the jab never makes the cross learned through the older keys', same(Object.keys(P.getLearned()), ['shared:jab']));
  check('the Fight hub\'s first-lesson flag is set', store.get(FIRST_KEY) === 'true');
  const again = P.learnMove(jab, 'Boxing', '2026-12-25');
  check('learning it again is not fresh and keeps the first day', again.fresh === false && json(LEARNED_KEY)['shared:jab'] === '2026-11-15');
  P.learnMove(by('Muay Thai', 'Cross'), 'Muay Thai', '2026-11-16');
  check('with the cross, every Jab-Cross lesson is complete', same(json(LESSONS_KEY).sort(), ['boxing_cross', 'boxing_jab', 'boxing_jab_cross', 'kb_cross', 'kb_jab', 'mma_jab_cross', 'mt_jab_cross']) && same(json(DRILLED_KEY), { Boxing: ['Jab'], 'Muay Thai': ['Cross'] }));
  check('and both show as learned in every discipline', PRACTICE_DISCIPLINES.every((d) => P.progressFor(movesFor(d), P.getLearned()).done === 2));

  fresh();
  const st = P.learnMove(by('Boxing', 'Boxing Stance'), 'Boxing', '2026-11-15');
  check('a stance move: its lesson complete, nothing banked, not a drilled technique', st.fresh && same(st.gained, []) && same(json(LESSONS_KEY), ['boxing_stance']) && !store.has(ARSENAL_KEY) && !store.has(DRILLED_KEY) && store.get(FIRST_KEY) === 'true');
  store.delete(LEARNED_KEY);
  check('without the new key the older key still says it is learned', P.isLearned(P.getLearned(), 'boxing:boxing-stance'));

  fresh();
  const hook = P.learnMove(by('Boxing', 'Lead Hook'), 'Boxing', '2026-11-15');
  check('a move with no lesson still sets the first-lesson flag, and tells what Combo Coach gained', store.get(FIRST_KEY) === 'true' && same(hook.gained, ['Hook']) && !store.has(LESSONS_KEY));
  check('the lead hook is in the arsenal of all four', PRACTICE_DISCIPLINES.every((d) => same(getEffectiveArsenal(d), ['Jab', 'Cross', 'Hook'])));
  store.delete(LEARNED_KEY);
  check('without the new key the drilled list still says it is learned, in all four', PRACTICE_DISCIPLINES.every((d) => P.isLearned(P.getLearned(), by(d, 'Lead Hook'))));

  fresh();
  const elbow = P.learnMove(by('Muay Thai', 'Lead Hook Elbow'), 'Muay Thai');
  check('Lead Hook Elbow banks an elbow, not a hook, in Muay Thai only', same(elbow.gained, ['Elbow']) && same(json(ARSENAL_KEY), { 'muay-thai': ['Elbow'] }) && same(json(LESSONS_KEY), ['mt_elbow']) && same(json(DRILLED_KEY), { 'Muay Thai': ['Lead Hook Elbow'] }));
  check('Roundhouse Knee banks a knee, not a roundhouse', same(P.learnMove(by('Muay Thai', 'Roundhouse Knee'), 'Muay Thai').gained, ['Knee']) && same(getArsenal('Muay Thai'), ['Elbow', 'Knee']));
  check('Rear Roundhouse Kick banks the roundhouse and the plain kick', same(P.learnMove(by('Kickboxing', 'Rear Roundhouse Kick'), 'Kickboxing').gained, ['Roundhouse', 'Kick']) && json(LESSONS_KEY).includes('kb_roundhouse'));
  check('Spinning Back Elbow banks itself only', same(P.learnMove(by('Muay Thai', 'Spinning Back Elbow'), 'Muay Thai').gained, ['Spinning Back Elbow']));
  const before = store.get(ARSENAL_KEY);
  P.learnMove(by('Muay Thai', 'Teep Defense'), 'Muay Thai'); P.learnMove(by('Muay Thai', 'Elbow Cover'), 'Muay Thai'); P.learnMove(by('Muay Thai', 'Kick Exit'), 'Muay Thai'); P.learnMove(by('Muay Thai', 'Check'), 'Muay Thai'); P.learnMove(by('Boxing', 'Step and Jab'), 'Boxing');
  check('defense, footwork and the check bank no strike', store.get(ARSENAL_KEY) === before && P.isLearned(P.getLearned(), 'muay-thai:teep-defense') && json(DRILLED_KEY)['Muay Thai'].includes('Teep Defense'));
  check('every strike move banks something Combo Coach knows, and nothing else does',
    PRACTICE_DISCIPLINES.every((d) => movesFor(d).every((m) => (['PUNCHES', 'KICKS', 'KNEES', 'ELBOWS'].includes(m.group) ? strikesFrom(P.arsenalName(m)).length > 0 : P.arsenalName(m) === ''))));

  fresh();
  P.learnMove(by('MMA', 'Lead Teep'), 'MMA');
  const half = json(LESSONS_KEY, []);
  P.learnMove(by('MMA', 'Low Kick'), 'MMA');
  check('Teep or Low Kick (two moves) is complete only with both', !half.includes('mma_teep_low') && json(LESSONS_KEY).includes('mma_teep_low') && !P.isLearned({ ...P.getLearned(), 'mma:low-kick': false }, 'mma:low-kick'));

  fresh();
  const punches = movesFor('Boxing').filter((m) => m.group === 'PUNCHES');
  const out = P.learnMoves(punches, 'Boxing', '2026-11-15');
  check('TEST OUT: a whole group is learned in one go', out.fresh.length === punches.length && punches.every((m) => P.isLearned(P.getLearned(), m)) && same(out.gained, ['Hook', 'Uppercut', 'Overhand', 'Body Jab', 'Body Cross'])
    && P.learnMoves(punches, 'Boxing').fresh.length === 0 && same(P.learnMoves(null, 'Boxing'), { fresh: [], gained: [] }));
  check('a missing move is ignored', same(P.learnMove(null, 'Boxing'), { fresh: false, gained: [] }) && same(P.learnMove({}, 'Boxing'), { fresh: false, gained: [] }));
}

// ── nextMove and progress ──────────────────────────────────────────────────
{
  const moves = movesFor('Boxing');
  const ids = moves.map((m) => m.id);
  const all = Object.fromEntries(ids.map((id) => [id, true]));
  const without = (...gone) => Object.fromEntries(ids.filter((id) => !gone.includes(id)).map((id) => [id, true]));
  check('nothing learned: the first move, and after a move the one below it', P.nextMove(moves, {}) === moves[0] && P.nextMove(moves, {}, ids[0]) === moves[1] && P.nextMove(moves, {}, ids[4]) === moves[5]);
  check('it skips what is learned', P.nextMove(moves, { [ids[0]]: true, [ids[1]]: '2026-11-15' }) === moves[2] && P.nextMove(moves, { [ids[3]]: true }, ids[2]) === moves[4]);
  check('after the last move it wraps to the top', P.nextMove(moves, {}, ids[ids.length - 1]) === moves[0] && P.nextMove(moves, without(ids[1]), ids[10]) === moves[1]);
  check('everything learned: null', P.nextMove(moves, all) === null && P.nextMove(moves, all, ids[3]) === null);
  check('only the move itself is left: it comes back last', P.nextMove(moves, without(ids[6]), ids[6]) === moves[6]);
  check('an id that is not on the list starts from the top', P.nextMove(moves, { [ids[0]]: true }, 'nope:nope') === moves[1]);
  check('progress counts the learned moves of the list', same(P.progressFor(moves, {}), { done: 0, total: moves.length }) && same(P.progressFor(moves, { [ids[0]]: true, 'muay-thai:check': true }), { done: 1, total: moves.length }) && same(P.progressFor(moves, all), { done: moves.length, total: moves.length }));
}

// ── the watch video ────────────────────────────────────────────────────────
{
  const clip = (discipline, title, group = 'Punches', id = `${discipline}-${title}`) => ({ id, discipline, title, group, videoUrl: `/static/practice/shadow/${id}.mp4`.replace(/ /g, '-'), posterUrl: `/static/practice/shadow/${id}.webp`.replace(/ /g, '-') });
  const knee = by('Muay Thai', 'Rear Knee');
  check('a tutorial comes first, with its poster beside it, even when a clip has the same title',
    same(P.watchFor(knee, 'Muay Thai', [clip('Muay Thai', 'Rear Knee')]), { src: '/static/practice/rear-knee.mp4', poster: '/static/practice/rear-knee.webp', kind: 'tutorial' }));
  const jab = by('Boxing', 'Jab');
  check('no tutorial: the delivered clip of the same discipline with the same title, in any letter case', same(P.watchFor(jab, 'Boxing', [clip('Kickboxing', 'Jab'), clip('Boxing', 'jAB', 'Jab', 'b-jab')]), { src: '/static/practice/shadow/b-jab.mp4', poster: '/static/practice/shadow/b-jab.webp', kind: 'clip' }));
  check('never a clip of another discipline, or of another title', P.watchFor(jab, 'Boxing', [clip('Kickboxing', 'Jab'), clip('Boxing', 'Stiff Jab'), clip('Boxing', 'Jab to the Body')]) === null);
  check('two clips with the title: the first in the file', P.watchFor(by('Kickboxing', 'Jab'), 'Kickboxing', [clip('Kickboxing', 'Jab', 'Jab', 'one'), clip('Kickboxing', 'Jab', 'Punches', 'two')]).src.endsWith('/one.mp4'));
  check('"&" and "and" are the same title', P.watchFor(by('Boxing', 'Bob and Weave'), 'Boxing', [clip('Boxing', 'Bob & Weave', 'Defense', 'bw')])?.src.endsWith('/bw.mp4'));
  check('nothing delivered: no video (the move is GUIDE only)', P.watchFor(jab, 'Boxing', []) === null && P.watchFor(jab, 'Boxing') === null && P.watchFor(jab, 'Boxing', null) === null && P.watchFor(null, 'Boxing', []) === null);
  const boxStance = by('Boxing', 'Boxing Stance');
  check('Boxing\'s stance is the clip called Boxing Stance, never another stance', P.watchFor(boxStance, 'Boxing', [clip('Boxing', 'Peek-a-boo Stance', 'Stance & Guard', 'pk'), clip('Boxing', 'Boxing Stance', 'Stance & Guard', 'bs')]).src.endsWith('/bs.mp4')
    && P.watchFor(boxStance, 'Boxing', [clip('Boxing', 'Peek-a-boo Stance', 'Stance & Guard', 'pk'), clip('Boxing', 'Stance', 'Stance & Guard', 's')]) === null);
  const mtStance = by('Muay Thai', 'Muay Thai Stance');
  const sg = 'Stance & Guard';
  check('other styles, under Stance & Guard: "Stance" first', P.watchFor(mtStance, 'Muay Thai', [clip('Muay Thai', 'Square Stance', sg, 'sq'), clip('Muay Thai', 'Stance', sg, 'st')]).src.endsWith('/st.mp4'));
  check('the title itself wins over the alias', P.watchFor(mtStance, 'Muay Thai', [clip('Muay Thai', 'Stance', sg, 'st'), clip('Muay Thai', 'Muay Thai Stance', sg, 'mt')]).src.endsWith('/mt.mp4'));
  check('then anything with "stance" in it, in any letter case of the group', P.watchFor(mtStance, 'Muay Thai', [clip('Muay Thai', 'Teep', sg, 'tp'), clip('Muay Thai', 'Thai Fighting Stance', 'STANCE & GUARD', 'tf')]).src.endsWith('/tf.mp4'));
  check('a "stance" clip under another heading is not the stance', P.watchFor(mtStance, 'Muay Thai', [clip('Muay Thai', 'Switch Stance', 'Footwork', 'sw')]) === null);
  check('the alias is for the stance only: the guard move and a punch get no stance clip', P.watchFor(by('Boxing', 'Guard + Footwork'), 'Boxing', [clip('Boxing', 'Boxing Stance', sg, 'bs')]) === null && P.watchFor(by('Muay Thai', 'Jab'), 'Muay Thai', [clip('Muay Thai', 'Stance', sg, 'st')]) === null);

  // The clips really delivered.
  const delivered = fs.existsSync(root('public/static/practice/shadow/index.json')) ? parseShadowIndex(JSON.parse(read('public/static/practice/shadow/index.json'))) : [];
  const dead = [], counts = [];
  for (const d of PRACTICE_DISCIPLINES) {
    let n = 0;
    for (const m of movesFor(d)) { const w = P.watchFor(m, d, delivered); if (!w) continue; n++; if (!onDisk(w.src) || (w.poster && !onDisk(w.poster))) dead.push(`${d} ${m.name}: ${w.src}`); }
    counts.push(`${d} ${n}/${movesFor(d).length}`);
  }
  check(`with the delivered clips, every watch video and poster is on disk (moves with a video: ${counts.join(', ')})`, dead.length === 0, dead.join(' | '));
}

// ── the drill clips of a call ──────────────────────────────────────────────
{
  const T = { dir: '/x/', clips: {
    jab: { file: 'jab.mp4', ms: 1100 }, cross: { file: 'cross.mp4', ms: 1500 }, 'lead hook': { file: 'lead-hook.mp4', ms: 1400 }, 'lead uppercut': { file: 'lu.mp4', ms: 1200 },
    'body hook': { file: 'bh.mp4', ms: 1000 }, 'stance:boxing': { file: 'stance-boxing.mp4', ms: 4500 }, 'bad file': { file: '../x.mp4', ms: 900 }, 'no ms': { file: 'n.mp4' }, 'zero ms': { file: 'z.mp4', ms: 0 },
  } };
  const plan = (call, o = {}, t = T) => planCall(call, { discipline: 'Boxing', callMs: 3000, ...o }, t);
  const srcs = (p) => (p ? p.clips.map((c) => c.src.replace('/x/', '').replace('.mp4', '')).join(',') : null);

  check('callParts: one strike, a combination, a double, numbers, a body shot', same(callParts('JAB'), ['JAB']) && same(callParts('JAB → CROSS'), ['JAB', 'CROSS']) && same(callParts('JAB × 2'), ['JAB', 'JAB'])
    && same(callParts('1-2-3'), ['JAB', 'CROSS', 'LEAD HOOK']) && same(callParts('1-2 → 3 TO THE BODY'), ['JAB', 'CROSS', 'BODY HOOK']) && same(callParts('1-2 → ROUNDHOUSE'), ['JAB', 'CROSS', 'ROUNDHOUSE']) && same(callParts(' jab →  cross '), ['JAB', 'CROSS']));
  check('callParts: what cannot be read is null', [null, undefined, '', '   ', '→', 'JAB →', '→ CROSS', '9', '1-9', '0', '9 TO THE BODY'].every((c) => callParts(c) === null));

  const one = plan('JAB');
  check('JAB: the jab clip, with its length and its name', same(one.clips, [{ src: '/x/jab.mp4', ms: 1100, label: 'JAB' }]));
  check('one strike loops three times, but never under the round\'s own call time', one.holdMs === 3300 && plan('JAB', { callMs: 3500 }).holdMs === 3500 && plan('CROSS').holdMs === 4500);
  check('JAB → CROSS: both clips in order, looped twice', srcs(plan('JAB → CROSS')) === 'jab,cross' && plan('JAB → CROSS').holdMs === 5200);
  check('JAB × 2 is the jab twice', srcs(plan('JAB × 2')) === 'jab,jab' && plan('JAB × 2').holdMs === 4400);
  check('1-2-3 is jab, cross, lead hook', srcs(plan('1-2-3')) === 'jab,cross,lead-hook' && plan('1-2-3').holdMs === 8000 && same(plan('1-2-3').clips.map((c) => c.label), ['JAB', 'CROSS', 'LEAD HOOK']));
  check('JAB → JAB → CROSS, and a single number', srcs(plan('JAB → JAB → CROSS')) === 'jab,jab,cross' && plan('JAB → JAB → CROSS').holdMs === 7400 && srcs(plan('2')) === 'cross');
  check('HOOK alone is the lead hook, UPPERCUT alone the lead uppercut', srcs(plan('HOOK')) === 'lead-hook' && plan('HOOK').clips[0].label === 'LEAD HOOK' && srcs(plan('UPPERCUT')) === 'lu' && srcs(plan('CROSS → HOOK')) === 'cross,lead-hook');
  check('3 TO THE BODY is the body hook', srcs(plan('3 TO THE BODY')) === 'bh' && srcs(plan('1-2 → 3 TO THE BODY')) === 'jab,cross,bh');
  check('a call is never held past 9 seconds', plan('1-2-3 → 1-2-3').holdMs === 9000 && plan('1-2-3 → 1-2-3').clips.length === 6 && plan('JAB', { callMs: 20000 }).holdMs === 9000);

  const stance = plan('RESET STANCE');
  check('RESET STANCE and GUARD UP: the discipline\'s stance clip, once', same(stance.clips, [{ src: '/x/stance-boxing.mp4', ms: 4500, label: 'STANCE' }]) && stance.holdMs === 4500 && srcs(plan('GUARD UP')) === 'stance-boxing' && plan('GUARD UP', { callMs: 3500 }).holdMs === 4500);
  check('another discipline has no stance clip yet: text only', plan('RESET STANCE', { discipline: 'Muay Thai' }) === null && plan('STANCE', { discipline: 'MMA' }) === null);
  const boxStance = P.drillFor(movesFor('Boxing'), by('Boxing', 'Boxing Stance'), {}).focus;
  check('every call of a stance move is the stance: HANDS UP, STEP FORWARD', boxStance.calls.every((c) => srcs(plan(c, { focus: boxStance })) === 'stance-boxing') && plan('STEP FORWARD', { focus: boxStance }).holdMs === 4500);
  const guard = P.drillFor(movesFor('Boxing'), by('Boxing', 'Guard + Footwork'), {}).focus;
  const stanceGroup = P.groupDrill(movesFor('Boxing'), STANCE_GROUP, {}).focus;
  check('the guard move and a TEST OUT of the stance group too', srcs(plan('SLIDE LEFT', { focus: guard })) === 'stance-boxing' && stanceGroup.calls.every((c) => srcs(plan(c, { focus: stanceGroup })) === 'stance-boxing'));
  const jabFocus = P.drillFor(movesFor('Boxing'), by('Boxing', 'Jab'), {}).focus;
  check('but not in the drill of a strike: STEP FORWARD there has no clip', plan('STEP FORWARD', { focus: jabFocus }) === null && plan('HANDS UP') === null);

  check('a part with no clip: no plan at all, never half a combination', plan('STEP JAB') === null && plan('JAB → TEEP') === null && plan('CROSS → ELBOW') === null && plan('TEEP → JAB') === null && plan('REAR HOOK') === null && plan('JAB → CROSS → RESET') === null);
  check('a call that cannot be read: no plan', [null, undefined, '', '→', '9', 'JAB →'].every((c) => plan(c) === null) && planCall('JAB') !== undefined);
  check('a bad entry of the file is not played', plan('BAD FILE') === null && plan('NO MS') === null && plan('ZERO MS') === null && plan('JAB', {}, {}) === null && plan('JAB', {}, { clips: null }) === null && plan('JAB', {}, null) === null);
  check('a file with no dir uses the calls folder, and a dir without its slash still works', planCall('JAB', {}, { clips: { jab: { file: 'j.mp4', ms: 1000 } } }).clips[0].src === '/static/practice/calls/j.mp4' && planCall('JAB', {}, { dir: '/y', clips: { jab: { file: 'j.mp4', ms: 1000 } } }).clips[0].src === '/y/j.mp4');
  check('a cut added later is used at once (no fixed set of keys)', srcs(plan('SPINNING BACK KICK → JAB', {}, { ...T, clips: { ...T.clips, 'spinning back kick': { file: 'sbk.mp4', ms: 1600 } } })) === 'sbk,jab'
    && srcs(plan('STANCE', { discipline: 'Muay Thai' }, { ...T, clips: { ...T.clips, 'stance:muay-thai': { file: 'smt.mp4', ms: 5000 } } })) === 'smt');

  // The move's own watch video, when the app has no cut of its strike.
  const mt = movesFor('Muay Thai');
  const kneeFocus = P.drillFor(mt, by('Muay Thai', 'Rear Knee'), {}).focus;
  const watch = P.watchFor(by('Muay Thai', 'Rear Knee'), 'Muay Thai', []);
  const whole = planCall('REAR KNEE', { discipline: 'Muay Thai', focus: kneeFocus, watch, callMs: 3500 }, T);
  check('no cut of the move\'s own call: its watch video, whole, for the round\'s call time', same(whole, { clips: [{ src: '/static/practice/rear-knee.mp4', ms: null, whole: true, label: 'REAR KNEE' }], holdMs: 3500 }));
  check('the lesson\'s short word for it counts as its own call, doubled too: KNEE × 2', planCall('KNEE × 2', { discipline: 'Muay Thai', focus: kneeFocus, watch }, T)?.clips[0].whole === true && planCall('REAR KNEE × 2', { discipline: 'Muay Thai', focus: kneeFocus, watch }, T)?.clips[0].whole === true);
  check('never for another strike or a combination: LEAD KNEE, REAR KNEE → CROSS, KNEE', planCall('LEAD KNEE', { discipline: 'Muay Thai', focus: kneeFocus, watch }, T) === null
    && planCall('REAR KNEE → CROSS', { discipline: 'Muay Thai', focus: kneeFocus, watch }, T) === null && planCall('CROSS → REAR KNEE', { discipline: 'Muay Thai', focus: kneeFocus, watch }, T) === null
    && planCall('LEAD TEEP', { discipline: 'Muay Thai', focus: kneeFocus, watch }, T) === null);
  check('and not without a watch video, or without the move', planCall('REAR KNEE', { discipline: 'Muay Thai', focus: kneeFocus }, T) === null && planCall('REAR KNEE', { discipline: 'Muay Thai', watch }, T) === null && planCall('REAR KNEE', { discipline: 'Muay Thai', focus: kneeFocus, watch: {} }, T) === null);
  check('a cut of the strike wins over the watch video', srcs(planCall('REAR KNEE', { discipline: 'Muay Thai', focus: kneeFocus, watch }, { dir: '/x/', clips: { 'rear knee': { file: 'rk.mp4', ms: 1200 } } })) === 'rk');
  const mtStance = P.drillFor(mt, by('Muay Thai', 'Muay Thai Stance'), {}).focus;
  const stanceWatch = { src: '/static/practice/shadow/mt-stance.mp4', poster: '', kind: 'clip' };
  check('a stance with no stance cut: STANCE plays its watch video, its other calls stay text', planCall('STANCE', { discipline: 'Muay Thai', focus: mtStance, watch: stanceWatch }, T)?.clips[0].src === stanceWatch.src && planCall('WEIGHT BACK', { discipline: 'Muay Thai', focus: mtStance, watch: stanceWatch }, T) === null);

  check('drillSources: every video of a set of calls, each once', same(drillSources(['JAB', 'JAB → CROSS', 'JAB × 2', 'STEP JAB', 'RESET STANCE', '1-2-3'], { discipline: 'Boxing' }, T), ['/x/jab.mp4', '/x/cross.mp4', '/x/stance-boxing.mp4', '/x/lead-hook.mp4']) && same(drillSources(null, {}, T), []));

  // The real file, whatever cuts it holds today.
  const real = JSON.parse(read('components/training-mode/data/callClips.json'));
  const keys = Object.keys(real.clips || {});
  const slugs = PRACTICE_DISCIPLINES.map(disciplineSlug);
  const wrongKeys = keys.filter((k) => k !== k.toLowerCase().trim() || (k.startsWith('stance:') && !slugs.includes(k.slice(7))));
  check(`callClips.json: every key is in lower case, a stance key names a discipline (${keys.length} cuts)`, keys.length > 0 && wrongKeys.length === 0, wrongKeys.join());
  check('callClips.json: every cut is on disk and has a length', keys.every((k) => onDisk(`${real.dir}${real.clips[k].file}`) && real.clips[k].ms > 0), keys.filter((k) => !onDisk(`${real.dir}${real.clips[k].file}`)).join());
  const dead = keys.filter((k) => { const p = planCall(k.startsWith('stance:') ? 'RESET STANCE' : k.toUpperCase(), { discipline: k.startsWith('stance:') ? k.slice(7) : 'Boxing' }); return !(p && p.clips.length === 1 && p.clips[0].src === `${real.dir}${real.clips[k].file}`); });
  check('callClips.json: every cut is played by the call of its own name (a key no call can reach is a cut nobody sees)', dead.length === 0, dead.join());

  // Every call any drill can make, against the real file and the test table.
  let planned = 0, total = 0;
  const off = [];
  for (const table of [undefined, T]) for (const d of PRACTICE_DISCIPLINES) {
    const moves = movesFor(d);
    const everything = Object.fromEntries(moves.map((m) => [m.id, true]));
    const inputs = [...moves.map((m) => P.drillFor(moves, m, everything)), ...groupsOf(moves).map((g) => P.groupDrill(moves, g.group, {}))];
    for (const input of inputs) for (const learned of [1, 3, 7, 11]) {
      const round = buildRound({ ...input, learned });
      const move = moves.find((m) => m.id === input.focus.id);
      for (const call of new Set(round.groups.flatMap((g) => g.calls))) {
        total++;
        const p = planCall(call, { discipline: d, focus: input.focus, watch: move ? P.watchFor(move, d, []) : null, callMs: round.callMs }, table);
        if (!p) continue;
        planned++;
        const parts = callParts(call);
        const fine = p.holdMs >= round.callMs && p.holdMs <= 9000 && p.clips.length > 0 && p.clips.every((c) => typeof c.src === 'string' && c.src.endsWith('.mp4') && typeof c.label === 'string')
          && (p.clips[0].whole ? p.clips.length === 1 && p.clips[0].ms === null : p.clips.length === parts.length && p.clips.every((c) => c.ms > 0));
        if (!fine) off.push(`${d} ${input.focus.name}: ${call}`);
      }
    }
  }
  check(`every call of every drill: no plan, or clips for each part and a hold between the call time and 9 s (${planned} of ${total} calls have a picture)`, off.length === 0 && planned > 0, off.slice(0, 6).join(' | '));
}

// ── the starter arsenal ────────────────────────────────────────────────────
{
  fresh();
  check('the starter arsenal is Jab and Cross in all four disciplines', same(STARTER_ARSENAL, { boxing: ['Jab', 'Cross'], kickboxing: ['Jab', 'Cross'], 'muay-thai': ['Jab', 'Cross'], mma: ['Jab', 'Cross'] }) && PRACTICE_DISCIPLINES.every((d) => same(getEffectiveArsenal(d), ['Jab', 'Cross'])));
  fresh({ [ARSENAL_KEY]: { boxing: ['Hook', 'Body Jab'], 'muay-thai': ['Teep', 'Uppercut'] } });
  check('a shared punch banked under one discipline (older data) counts in all four; other strikes stay where they were learned',
    same(getEffectiveArsenal('Kickboxing'), ['Jab', 'Cross', 'Hook', 'Uppercut']) && same(getEffectiveArsenal('Boxing'), ['Jab', 'Cross', 'Hook', 'Body Jab', 'Uppercut']) && same(getEffectiveArsenal('Muay Thai'), ['Jab', 'Cross', 'Teep', 'Uppercut', 'Hook']));
  fresh();

  check('a plain kick is a strike, read as a whole word', same(strikesFrom('Check Cross Kick'), ['Cross', 'Kick']) && same(strikesFrom('Kickboxing Stance'), []) && same(strikesFrom('Basic Kickboxing Combo'), []) && same(strikesFrom('Low Kick Check'), ['Low Kick'])
    && same(strikesFrom('Catch Kick Sweep Cross'), ['Cross']) && countStrikes('Check Cross Kick') === 2 && countStrikes('Jab Jab Cross') === 3 && countStrikes('Jab Low Kick') === 2 && countStrikes('Catch Kick Sweep Cross Ground Knee') === 2);
  check('so a combination with a kick is not dealt to someone with only jab and cross', !comboUsesOnlyLearned('Check Cross Kick', ['Jab', 'Cross']) && comboUsesOnlyLearned('Check Cross Kick', ['Jab', 'Cross', 'Kick']) && comboUsesOnlyLearned('Check Jab Cross', ['Jab', 'Cross']));

  const START = ['Jab', 'Cross'];
  const onlyStart = (text) => { const pieces = M.piecesOf(text); return pieces.some((p) => p.kind === 'strike') && pieces.every((p) => p.kind !== 'strike' || START.includes(p.text)); };
  const thin = [];
  for (const d of M.DISCIPLINES) for (const tier of ['EASY', 'NORMAL', 'HARD', 'ADVANCED']) {
    const n = M.tierPool(M.prepareCombos(COMBO_POOL, d), tier).filter((c) => comboUsesOnlyLearned(c.text, START)).length;
    if (!n) thin.push(`${d} ${tier}`);
  }
  check('every level\'s pool of every discipline holds a call made of jab and cross', thin.length === 0, thin.join(' | '));

  const LEVELS4 = ['Easy', 'Normal', 'Hard', 'Advanced'];
  const leaks = [];
  let dealt = 0;
  for (const d of PRACTICE_DISCIPLINES) for (const difficulty of LEVELS4) for (const mode of ['Combo', 'Technical']) for (let run = 0; run < (mode === 'Technical' ? 40 : 3); run++) {
    const opts = { discipline: d, difficulty, mode, rounds: 3, roundDuration: 3, arsenalOnly: true, arsenal: getEffectiveArsenal(d), byLevel: true, callsPerRound: 30, seed: 100 + run };
    const all = generateComboCoachSession(opts);
    const { plans } = generateComboCoachRoundPlans(opts);
    const calls = [...all, ...plans.flat()];
    dealt += calls.length;
    const bad = calls.filter((t) => !onlyStart(t));
    if (!all.length || plans.length !== 3 || plans.some((p) => p.length !== 30) || bad.length) leaks.push(`${d} ${difficulty} ${mode}: ${all.length} calls, ${[...new Set(bad)].slice(0, 3).join(', ')}`);
  }
  check(`a beginner with only jab and cross is never dealt another strike: every discipline, level and mode, full rounds (${dealt} calls)`, leaks.length === 0, [...new Set(leaks)].slice(0, 6).join(' | '));
  const open = generateComboCoachSession({ discipline: 'Muay Thai', difficulty: 'Normal', mode: 'Combo', byLevel: true });
  check('everyone else still gets the whole pool', open.some((t) => !onlyStart(t)) && generateComboCoachSession({ discipline: 'Boxing', difficulty: 'Hard', mode: 'Technical', byLevel: true }).some((t) => !onlyStart(t)));
  check('Technical with an arsenal that holds no single strike deals as before instead of failing', generateComboCoachSession({ discipline: 'Boxing', difficulty: 'Easy', mode: 'Technical', arsenalOnly: true, arsenal: ['Teep'], byLevel: true }).length > 0);

  // Learning a move widens what is dealt.
  P.learnMove(by('Kickboxing', 'Lead Teep'), 'Kickboxing');
  const wider = generateComboCoachSession({ discipline: 'Kickboxing', difficulty: 'Easy', mode: 'Combo', arsenalOnly: true, arsenal: getEffectiveArsenal('Kickboxing'), byLevel: true });
  check('drill the teep once and Combo Coach starts calling it', same(getEffectiveArsenal('Kickboxing'), ['Jab', 'Cross', 'Teep']) && wider.includes('Jab Teep') && wider.includes('Teep') && wider.every((t) => M.piecesOf(t).every((p) => p.kind !== 'strike' || ['Jab', 'Cross', 'Teep'].includes(p.text))), wider.join(' | '));
  fresh();
}

// ── the drill of a move ────────────────────────────────────────────────────
{
  const moves = movesFor('Kickboxing');
  const teep = by('Kickboxing', 'Lead Teep');
  const learned = { 'kickboxing:kickboxing-stance': true, 'shared:jab': true, 'shared:lead-hook': '2026-11-15', 'kickboxing:low-kick': true };
  const input = P.drillFor(moves, teep, learned);
  check('drillFor: the move is the focus', input.focus.id === teep.id && input.focus.name === 'Lead Teep' && input.focus.calls === teep.calls && input.focus.group === 'KICKS');
  check('the moves before it that are learned come with it, in ladder order (not the ones after)', same(input.prior.map((p) => p.name), ['Kickboxing Stance', 'Jab', 'Lead Hook']) && input.prior[1].calls === by('Kickboxing', 'Jab').calls);
  check('the level counts this move as learned: one more than the list holds, or the same when it already is', input.learned === 5 && P.drillFor(moves, teep, { ...learned, [teep.id]: true }).learned === 5 && P.drillFor(moves, moves[0], {}).learned === 1 && same(P.drillFor(moves, moves[0], {}).prior, []));
  const round = buildRound(input);
  check('buildRound takes it: the round mixes the learned strikes, never the stance', round.tier === tierFor(5) && round.groups.flatMap((g) => g.calls).includes('JAB') && round.groups.flatMap((g) => g.calls).includes('LEAD HOOK') && round.groups.every((g) => !/Stance$/.test(g.label) || g.label === 'Stance resets'));
  const g = P.groupDrill(moves, 'KICKS', learned);
  const kicks = moves.filter((m) => m.group === 'KICKS');
  check('groupDrill: the calls of the whole group, the group to mark learned, and the level it ends on', same(g.focus.calls, [...new Set(kicks.flatMap((m) => m.calls))]) && g.moves.length === kicks.length && g.moves.every((m, i) => m === kicks[i]) && same(g.prior, []) && g.learned === 4 + kicks.length - 1 && g.focus.name === 'KICKS');
  let ok = true;
  for (const d of PRACTICE_DISCIPLINES) for (const grp of groupsOf(movesFor(d))) {
    const r = buildRound(P.groupDrill(movesFor(d), grp.group, {}));
    ok = ok && r.groups.every((x) => x.calls.length > 0) && typeof r.pick() === 'string';
  }
  check('every group of every discipline builds a round', ok);
  // DRILL IT shows the whole drill, rests included: 1:00, 3:30, 7:00, 10:00.
  check('planSeconds: the rounds and the rests between them', same(PLANS.map((p) => mmss(planSeconds(p))), ['1:00', '3:30', '7:00', '10:00']) && planSeconds(round.plan) === 210);
  check('the level ladder names its rungs by moves learned, where tierFor changes level', same(PLANS.map((p) => p.when), ['Your first 2 moves', '3 to 6 moves learned', '7 to 10 moves learned', '11 moves or more']) && same([2, 3, 6, 7, 10, 11].map(tierFor), [0, 1, 1, 2, 2, 3]));
}

// ── what the coach says: nothing new to record ─────────────────────────────
{
  const sweeps = await practiceSweeps();
  const lines = new Set(sweeps.filter((s) => /^Practice/.test(s.name)).flatMap((s) => s.lines));
  const banks = ['female', 'male'].map((v) => ({ voice: v, base: `/voice/${v}/`, clips: Object.assign(Object.create(null), JSON.parse(read(`public/voice/${v}/manifest.json`)).clips), buffers: new Map() }));
  const lessonCalls = (d) => new Set(basicsFor(d).flatMap((l) => l.calls));
  const odd = [];
  for (const d of PRACTICE_DISCIPLINES) for (const m of movesFor(d)) for (const c of m.calls) if (c !== m.name.toUpperCase() && !lessonCalls(d).has(c)) odd.push(`${d} ${m.name}: ${c}`);
  check('every call of a move is its own name or a call of a lesson: the lines the coach already says', odd.length === 0, odd.join(' | '));
  const unswept = [], silent = [];
  let built = 0;
  // A small seeded generator: the same learned sets every run.
  let seed = 20261115;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (const d of PRACTICE_DISCIPLINES) {
    const moves = movesFor(d);
    const sets = [{}, Object.fromEntries(moves.map((m) => [m.id, true]))];
    for (let i = 0; i < 60; i++) { const share = rnd(); sets.push(Object.fromEntries(moves.filter(() => rnd() < share).map((m) => [m.id, true]))); }
    const said = new Set();
    for (const learned of sets) {
      for (const m of moves) for (const override of [null, 1, 3, 7, 11]) {
        const input = P.drillFor(moves, m, learned);
        for (const c of buildRound(override ? { ...input, learned: override } : input).groups.flatMap((x) => x.calls)) said.add(spokenCall(c));
      }
      for (const grp of groupsOf(moves)) for (const c of buildRound(P.groupDrill(moves, grp.group, learned)).groups.flatMap((x) => x.calls)) said.add(spokenCall(c));
    }
    built += said.size;
    for (const line of said) {
      if (!lines.has(line)) unswept.push(`${d}: ${line}`);
      for (const b of banks) if (!planClips(b, line)) silent.push(`${b.voice}: ${line}`);
    }
  }
  check(`whatever is learned, every line a drill says is in the spoken sweep (scripts/sweeps/practice-and-extras.mjs; ${built} lines)`, unswept.length === 0, unswept.slice(0, 8).join(' | '));
  check('and every one plays from recorded clips in both voices', silent.length === 0, silent.slice(0, 8).join(' | '));
  check('the rest line between rounds is swept too', lines.has('Rest. Round 2 next.') && lines.has('Rest. Round 3 next.'));
}

// ── the basics, for the Practice posters and the Home pick ─────────────────
{
  check('the basics of a discipline: its stance and guard, and every Beginner-level strike',
    same(P.basicMoves('Boxing').map((m) => m.name), ['Boxing Stance', 'Guard + Footwork', 'Jab', 'Cross', 'Lead Hook'])
    && PRACTICE_DISCIPLINES.every((d) => same(P.basicMoves(d), movesFor(d).filter((m) => m.group === STANCE_GROUP || (STRIKE_GROUPS.includes(m.group) && m.level === 'Beginner'))) && P.basicMoves(d).length >= 5));
  const newbie = { experience: 'Beginner', goal: 'Learn Combat Basics' };
  fresh();
  check('nothing learned: no basics done, the intro poster shows', !P.anyBasicsDone() && !P.basicsDone('Boxing') && Invite.shouldShowIntro(newbie) && P.basicsProgress('Boxing').next.name === 'Boxing Stance' && P.basicsProgress('Boxing').nextIndex === 0);
  const basics = P.basicMoves('Muay Thai');
  basics.slice(0, -1).forEach((m) => P.learnMove(m, 'Muay Thai'));
  check('one basic short: still not done, and it is the next', !P.anyBasicsDone() && P.basicsProgress('Muay Thai').next === basics[basics.length - 1] && P.basicsProgress('Muay Thai').done === basics.length - 1);
  P.learnMove(basics[basics.length - 1], 'Muay Thai');
  check('every basic of one discipline learned through drills: the basics are done (no lesson that is no longer shown is needed)', P.basicsDone('Muay Thai') && P.anyBasicsDone() && !P.basicsDone('Boxing') && P.basicsProgress('Muay Thai').next === null && P.basicsProgress('Muay Thai').nextIndex === -1);
  check('so the posters stop', !Invite.shouldShowIntro(newbie) && !Invite.shouldShowWeekly(newbie, Date.now() + 30 * 86400000));
  fresh();
  check('before that the weekly reminder shows to a new learner', Invite.shouldShowWeekly(newbie, Date.now() + 30 * 86400000) && !Invite.shouldShowWeekly({ experience: 'Experienced', goal: 'Get Fit' }));
  fresh({ [LESSONS_KEY]: basicsFor('Boxing').map((l) => l.id) });
  check('someone who finished the old seven lessons is done too, and is not asked again', P.basicsDone('Boxing') && P.anyBasicsDone() && !P.isLearned(P.getLearned(), 'shared:lead-hook') && !Invite.shouldShowWeekly(newbie, Date.now() + 30 * 86400000));
  fresh({ [LESSONS_KEY]: basicsFor('Boxing').map((l) => l.id).slice(0, 6) });
  check('six of the seven was not done before and is not now', !P.anyBasicsDone());

  fresh();
  P.learnMove(by('Kickboxing', 'Kickboxing Stance'), 'Kickboxing'); P.learnMove(by('Kickboxing', 'Jab'), 'Kickboxing'); P.learnMove(by('Kickboxing', 'Cross'), 'Kickboxing');
  const w = Invite.weeklySummary('Boxing');
  check('the weekly poster: every discipline, each basic as a lesson with a title and calls',
    same(w.discs.map((x) => x.disc), PRACTICE_DISCIPLINES) && w.discs.every((x) => x.total === P.basicMoves(x.disc).length && x.lessons.length === x.total && x.lessons.every((l) => typeof l.title === 'string' && l.title === l.name && l.calls.length)));
  check('it continues the discipline that is further along, at its next basic', w.focus.disc === 'Kickboxing' && w.focus.done === 3 && w.focus.next.title === 'Lead Hook' && w.focus.nextIndex === 3 && w.discs[0].done === 2 && Invite.weeklySummary('Muay Thai').focus.disc === 'Kickboxing');
  fresh();
  check('with nothing learned it is the athlete\'s own discipline, from the stance', Invite.weeklySummary('MMA').focus.disc === 'MMA' && Invite.weeklySummary('MMA').focus.next.title === 'MMA Stance' && Invite.weeklySummary().focus.disc === 'Boxing');

  // Home's pick for a beginner (data/recommendations).
  const stats = { sessions: [] };
  fresh();
  check('Home: a beginner with nothing done is sent to Start Here', getFightMiniSuggestion({ profile: newbie, stats }).title === 'Start Here — Learn the Basics');
  P.learnMove(by('Boxing', 'Boxing Stance'), 'Boxing');
  check('Home: then the next basic move by name', getFightMiniSuggestion({ profile: newbie, stats }).title === 'Basic — Guard + Footwork' && getFightMiniSuggestion({ profile: newbie, stats }).actionType === 'startHere');
  P.basicMoves('Boxing').forEach((m) => P.learnMove(m, 'Boxing'));
  check('Home: with Boxing\'s basics learned, on to Fight Focus', getFightMiniSuggestion({ profile: newbie, stats }).reason === 'Basic complete');
  fresh({ [FIRST_KEY]: 'true', [LESSONS_KEY]: ['boxing_stance', 'boxing_guard', 'boxing_jab', 'boxing_cross', 'boxing_jab_cross', 'boxing_defense'] });
  check('Home: the old six Boxing lessons still count as complete', getFightMiniSuggestion({ profile: newbie, stats }).reason === 'Basic complete');
  fresh();
}

// ── the learned key is synced ──────────────────────────────────────────────
{
  const src = read('components/training-mode/data/cloudSync.js');
  const list = (src.match(/export const SYNC_KEYS = \[([\s\S]*?)\];/) || [])[1] || '';
  const keys = [...list.replace(/\/\/.*$/gm, '').matchAll(/'([^']+)'/g)].map((m) => m[1]);
  check('cloud sync carries the learned key, and still the older ones and the arsenal', [LEARNED_KEY, LESSONS_KEY, DRILLED_KEY, ARSENAL_KEY, FIRST_KEY].every((k) => keys.includes(k)) && LEARNED_KEY === 'tm_practice_learned_v1', keys.join());
}

// ── screen fixes (source checks: the screens have no unit harness) ─────────
{
  const round = read('components/training-mode/PracticeRound.jsx');
  check('a rest or new round clears the old call and clip', /lastPhase\.current = key;\s*\/\/[^\n]*\n\s*setNow\(n => \(n\.call \|\| n\.plan \? \{ \.\.\.n, call: null, plan: null \} : n\)\);/.test(round));
  const parts = read('components/training-mode/PracticeParts.jsx');
  check('a tutorial row thumbnail is cropped to the athlete side', /tutorial\s*\?\s*\{ position: 'absolute', left: 0, top: '50%', width: '2\d\d%'/.test(parts) && !/12% center/.test(parts));
}

console.log(`\npractice moves: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
