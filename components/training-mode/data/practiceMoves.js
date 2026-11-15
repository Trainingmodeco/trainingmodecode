import { PRACTICE_DISCIPLINES, TECHNIQUES } from '../practiceData';
import {
  basicsFor, getCompletedLessons, markLessonComplete, markFirstLessonDone, getLibraryDrilled, markLibraryDrilled,
} from './practiceLessons';
import { addLearned, disciplineSlug, strikesFrom, STARTER_ARSENAL } from './arsenal';
import { numberForStrike } from './strikeNumbering';

// Practice Mode's one list: the MOVES of a discipline, in the order they are
// learned (the Ladder). A move is a stance lesson or a technique. The seven
// lessons and the Technique Library are both read from here now, and there is
// one word for progress: LEARNED. A move is learned when the athlete finishes
// one drill of it.
//
// A move:
//   id           'shared:jab' for the six punches every discipline shares
//                (learned once, learned in all four), else '<discipline>:<name>',
//                such as 'muay-thai:lead-teep'
//   name         'Lead Teep'
//   group        the heading it sits under: STANCE & GUARD, PUNCHES, KICKS,
//                KNEES, ELBOWS, MORE, DEFENSE, FOOTWORK
//   kind         the small label on its row and card: STANCE, GUARD, PUNCH,
//                KICK, KNEE, ELBOW, MOVE, DEFENSE, FOOTWORK
//   num          the gym number of a punch ('1' for the jab), else null
//   level        Beginner | Intermediate | Advanced
//   description  one line
//   cues         three key points
//   steps        the lesson's seven steps (stance moves only, else [])
//   mistakes     what to watch for
//   calls        what its drill shouts: its own name, and the calls of the
//                lesson that taught it
//   tutorialUrl  its tutorial video, or ''
//   lessonIds    the lessons this move stands for
//   shared       true for the six shared punches
//
// Everything here runs in plain Node (no React, no window), so the tests use
// the real file.

export const STANCE_GROUP = 'STANCE & GUARD';
export const STRIKE_GROUPS = ['PUNCHES', 'KICKS', 'KNEES', 'ELBOWS', 'MORE'];
export const SHARED_PUNCHES = ['Jab', 'Cross', 'Lead Hook', 'Rear Hook', 'Lead Uppercut', 'Rear Uppercut'];

// Which moves each lesson taught. A lesson with no move of its own maps to []:
// it is no longer shown, and its stored completion is left alone.
export const LESSON_TO_MOVES = {
  know_your_numbers: [],
  boxing_stance: ['Boxing Stance'],
  boxing_guard: ['Guard + Footwork'],
  boxing_jab: ['Jab'],
  boxing_cross: ['Cross'],
  boxing_jab_cross: ['Jab', 'Cross'],
  boxing_defense: [],
  kb_stance: ['Kickboxing Stance'],
  kb_jab: ['Jab'],
  kb_cross: ['Cross'],
  kb_front_kick: ['Lead Teep'],
  kb_roundhouse: ['Rear Roundhouse Kick'],
  kb_combo: [],
  mt_stance: ['Muay Thai Stance'],
  mt_jab_cross: ['Jab', 'Cross'],
  mt_teep: ['Lead Teep'],
  mt_roundhouse: ['Rear Roundhouse Kick'],
  mt_knee: ['Rear Knee'],
  mt_elbow: ['Lead Hook Elbow'],
  mma_stance: ['MMA Stance'],
  mma_jab_cross: ['Jab', 'Cross'],
  mma_teep_low: ['Lead Teep', 'Low Kick'],
  mma_sprawl: ['Sprawl'],
  mma_level_change: ['Level Change'],
  mma_movement: [],
};
// The lessons that are moves themselves (a stance is not in the library).
const STANCE_LESSONS = ['boxing_stance', 'boxing_guard', 'kb_stance', 'mt_stance', 'mma_stance'];

const kebab = (name) => String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const known = (discipline) => (PRACTICE_DISCIPLINES.includes(discipline) ? discipline : 'Boxing');

export function moveId(discipline, name) {
  return SHARED_PUNCHES.includes(name) ? `shared:${kebab(name)}` : `${disciplineSlug(discipline)}:${kebab(name)}`;
}

// ── the technique lists ────────────────────────────────────────────────────
// Defense and footwork carry over from the simpler disciplines: Muay Thai
// lists boxing's slips as well as its own checks.
const DEFENSE_FOOTWORK_INCLUDES = {
  Boxing: ['Boxing'],
  Kickboxing: ['Boxing', 'Kickboxing'],
  'Muay Thai': ['Boxing', 'Kickboxing', 'Muay Thai'],
  MMA: ['Boxing', 'Kickboxing', 'Muay Thai', 'MMA'],
};

export function techniquesFor(discipline, category) {
  if (category === 'Strikes') return TECHNIQUES.filter((t) => t.discipline === discipline && t.category === 'Strikes');
  const seen = new Set();
  const result = [];
  for (const src of DEFENSE_FOOTWORK_INCLUDES[discipline] || [discipline]) {
    for (const t of TECHNIQUES) {
      if (t.discipline === src && t.category === category && !seen.has(t.name)) { seen.add(t.name); result.push(t); }
    }
  }
  return result;
}

// The kind badge: PUNCH / KICK / KNEE / ELBOW for strikes, else the category.
export function badgeForTech(t) {
  if (t.category !== 'Strikes') return String(t.category).toUpperCase().replace(/S$/, '');
  const n = t.name.toLowerCase();
  if (/knee/.test(n)) return 'KNEE';
  if (/elbow/.test(n)) return 'ELBOW';
  if (/kick|teep|roundhouse|\bcheck\b/.test(n)) return 'KICK';
  return 'PUNCH';
}

// The heading a technique sits under. The library files a few things under
// Strikes that are not strikes (Check, Clinch Entry, Sprawl, Level Change,
// the shoot and the ground posture): they go under MORE.
const PUNCH_WORD = /\b(jab|cross|hook|uppercut|overhand|punch|backfist)\b/;
function groupForTech(t) {
  if (t.category !== 'Strikes') return String(t.category).toUpperCase();
  const n = t.name.toLowerCase();
  if (/\bcheck\b/.test(n)) return 'MORE';
  const badge = badgeForTech(t);
  if (badge !== 'PUNCH') return `${badge}S`;
  return PUNCH_WORD.test(n) ? 'PUNCHES' : 'MORE';
}

// ── the ladder ─────────────────────────────────────────────────────────────
function build(discipline) {
  const lessons = basicsFor(discipline);
  const out = [];

  // The stance first (and Boxing's guard lesson).
  for (const l of lessons) {
    if (!STANCE_LESSONS.includes(l.id)) continue;
    out.push({
      id: moveId(discipline, l.title), name: l.title, group: STANCE_GROUP, kind: /guard/i.test(l.title) ? 'GUARD' : 'STANCE',
      num: null, level: 'Beginner', description: l.subtitle, cues: l.steps.slice(0, 3), steps: [...l.steps], mistakes: [],
      calls: [...l.calls], tutorialUrl: l.videoUrl || '', lessonIds: [l.id], shared: false,
    });
  }

  // Then the strikes by kind, in the library's own order inside each kind.
  // Kinds come in the order they first appear, with the punches always first.
  const strikes = techniquesFor(discipline, 'Strikes');
  const seen = [...new Set(strikes.map(groupForTech))];
  const order = [...seen.filter((g) => g === 'PUNCHES'), ...seen.filter((g) => g !== 'PUNCHES')];
  const techs = [
    ...order.flatMap((g) => strikes.filter((t) => groupForTech(t) === g)),
    ...techniquesFor(discipline, 'Defense'),
    ...techniquesFor(discipline, 'Footwork'),
  ];
  const place = new Map(techs.map((t, i) => [t.name, i]));

  // A lesson's calls go to the move it taught, so its recorded combinations
  // are still drilled. A lesson of two moves (Jab-Cross) gives them to the
  // later one: the combination is drilled once both are on the ladder.
  const calls = new Map(), ids = new Map(), video = new Map();
  for (const l of lessons) {
    if (STANCE_LESSONS.includes(l.id)) continue;
    const names = (LESSON_TO_MOVES[l.id] || []).filter((n) => place.has(n));
    if (!names.length) continue;
    for (const n of names) {
      ids.set(n, [...(ids.get(n) || []), l.id]);
      if (l.videoUrl && !video.has(n)) video.set(n, l.videoUrl);
    }
    const last = names.reduce((a, b) => (place.get(b) > place.get(a) ? b : a));
    calls.set(last, [...(calls.get(last) || []), ...l.calls]);
  }

  for (const t of techs) {
    const group = groupForTech(t);
    const id = moveId(discipline, t.name);
    out.push({
      id, name: t.name, group, kind: group === 'MORE' ? 'MOVE' : badgeForTech(t),
      num: numberForStrike(t.name), level: t.level, description: t.description,
      cues: [...(t.cues || [])], steps: [], mistakes: [...(t.mistakes || [])],
      calls: [...new Set([t.name.toUpperCase(), ...(calls.get(t.name) || [])])],
      tutorialUrl: t.videoUrl || video.get(t.name) || '', lessonIds: ids.get(t.name) || [], shared: id.startsWith('shared:'),
    });
  }
  return out;
}

const LADDERS = {};
// The ordered moves of a discipline. The same list every call.
export function movesFor(discipline) {
  const d = known(discipline);
  return LADDERS[d] || (LADDERS[d] = build(d));
}

// [{ group, moves }] in ladder order.
export function groupsOf(moves) {
  const out = [];
  for (const m of moves) {
    const last = out[out.length - 1];
    if (last && last.group === m.group) last.moves.push(m); else out.push({ group: m.group, moves: [m] });
  }
  return out;
}

export const isStanceMove = (move) => !!move && move.group === STANCE_GROUP;
const isStrikeMove = (move) => !!move && STRIKE_GROUPS.includes(move.group);

// ── the watch video ────────────────────────────────────────────────────────
// A move's own tutorial, else a delivered shadowboxing clip of the same
// discipline with the same title, else nothing (the move is GUIDE only).
// `shadowClips` is the list data/shadowboxing loadShadowClips() reads.
const plain = (s) => String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();

// A stance clip is not always titled like the lesson. Boxing's is "Boxing
// Stance". The other styles: a clip under "Stance & Guard" called "Stance",
// "<Style> Stance", or anything with "stance" in it.
function stanceClip(clips, discipline) {
  if (discipline === 'Boxing') return clips.find((c) => plain(c.title) === 'boxing stance') || null;
  const group = clips.filter((c) => plain(c.group) === plain(STANCE_GROUP));
  const style = plain(discipline);
  return group.find((c) => plain(c.title) === 'stance')
    || group.find((c) => plain(c.title) === `${style} stance`)
    || group.find((c) => plain(c.title).includes('stance'))
    || null;
}

export function watchFor(move, discipline, shadowClips = []) {
  if (!move) return null;
  if (move.tutorialUrl) return { src: move.tutorialUrl, poster: move.tutorialUrl.replace(/\.mp4$/i, '.webp'), kind: 'tutorial' };
  const d = known(discipline);
  const every = (Array.isArray(shadowClips) ? shadowClips : []).filter((c) => c && c.videoUrl);
  const clips = every.filter((c) => c.discipline === d);
  const want = plain(move.name);
  // A shared punch is the same punch in every style: with no clip filed under this style, the Boxing clip
  // (or any other style's) of the same name is the one to watch.
  const borrowed = () => every.find((c) => c.discipline === 'Boxing' && plain(c.title) === want) || every.find((c) => plain(c.title) === want);
  const clip = clips.find((c) => plain(c.title) === want) || (move.kind === 'STANCE' ? stanceClip(clips, d) : null) || (move.shared ? borrowed() : null) || null;
  return clip ? { src: clip.videoUrl, poster: clip.posterUrl || '', kind: 'clip' } : null;
}

// ── learned ────────────────────────────────────────────────────────────────
// tm_practice_learned_v1: { [moveId]: 'YYYY-MM-DD' }. It is synced
// (data/cloudSync). The two older keys are still written and still read, so a
// phone on an older version neither loses nor hides progress:
//   tm_starthere_completed         the lessons done, by id
//   tm_practice_library_drilled    { [discipline]: [technique names] }
export const LEARNED_KEY = 'tm_practice_learned_v1';

// Where each lesson lives, and the move ids it stands for.
const LESSON_MOVE_IDS = {};
for (const d of PRACTICE_DISCIPLINES) {
  for (const l of basicsFor(d)) {
    const names = LESSON_TO_MOVES[l.id] || [];
    if (names.length) LESSON_MOVE_IDS[l.id] = names.map((n) => moveId(d, n));
  }
}

function readStore() {
  if (typeof localStorage === 'undefined') return {};
  try {
    const all = JSON.parse(localStorage.getItem(LEARNED_KEY) || '{}');
    if (!all || typeof all !== 'object' || Array.isArray(all)) return {};
    const out = {};
    for (const [id, day] of Object.entries(all)) if (day) out[id] = typeof day === 'string' ? day : true;
    return out;
  } catch { return {}; }
}
function writeStore(all) {
  if (typeof localStorage === 'undefined') return;
  try { localStorage.setItem(LEARNED_KEY, JSON.stringify(all)); } catch { /* quota */ }
}

const localDay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Every learned move: { [moveId]: 'YYYY-MM-DD' }, or true where only an older
// key knows it. The new key, plus what the older keys say: a finished lesson
// means its moves are learned, and so does a drilled library technique. The
// older keys are never deleted, so nothing can be un-learned.
export function getLearned() {
  const out = {};
  for (const lessonId of getCompletedLessons()) {
    for (const id of LESSON_MOVE_IDS[lessonId] || []) out[id] = true;
  }
  for (const d of PRACTICE_DISCIPLINES) {
    const drilled = getLibraryDrilled(d);
    if (!drilled.length) continue;
    for (const m of movesFor(d)) if (drilled.includes(m.name)) out[m.id] = true;
  }
  return { ...out, ...readStore() };
}

export const isLearned = (learned, move) => !!(learned && move && learned[typeof move === 'string' ? move : move.id]);

// What Combo Coach is told a move teaches (data/arsenal tokens). Only the
// strike itself: Lead Hook Elbow teaches an elbow, not a hook, and Roundhouse
// Knee a knee, not a roundhouse. Stance, defence and footwork teach none.
const TOKEN_OF_KIND = { KICK: /kick|teep|roundhouse/i, KNEE: /knee/i, ELBOW: /elbow/i };
export function arsenalName(move) {
  if (!isStrikeMove(move)) return '';
  const only = TOKEN_OF_KIND[move.kind];
  return strikesFrom(move.name).filter((t) => !only || only.test(t)).join(' ');
}

// The athlete finished a drill of this move. Writes the learned key, tells
// Combo Coach (a shared punch counts in all four disciplines), and keeps the
// older keys up to date: the technique is marked drilled, a lesson is marked
// complete once every move it taught is learned, and the Fight hub's
// first-lesson flag is set.
// Returns { fresh, gained }: fresh is false when the move was already
// learned, gained the strikes Combo Coach will now call in this discipline
// that it did not call before (never Jab or Cross: those are free).
export function learnMove(move, discipline, today = localDay()) {
  if (!move || !move.id) return { fresh: false, gained: [] };
  const d = known(discipline);
  const fresh = !isLearned(getLearned(), move);

  const store = readStore();
  if (typeof store[move.id] !== 'string') writeStore({ ...store, [move.id]: today });

  let gained = [];
  const strike = arsenalName(move);
  if (strike) {
    for (const each of move.shared ? PRACTICE_DISCIPLINES : [d]) {
      const got = addLearned(each, strike);
      if (each === d) gained = got.filter((t) => !(STARTER_ARSENAL[disciplineSlug(d)] || []).includes(t));
    }
  }

  if (!isStanceMove(move)) markLibraryDrilled(d, move.name);
  const learned = getLearned();
  for (const [lessonId, ids] of Object.entries(LESSON_MOVE_IDS)) {
    if (ids.includes(move.id) && ids.every((id) => learned[id])) markLessonComplete(lessonId);
  }
  markFirstLessonDone();
  return { fresh, gained };
}

// A whole group tested out in one drill: every move of it is learned.
// Returns { fresh: [the moves newly learned], gained: [strikes] }.
export function learnMoves(list, discipline, today = localDay()) {
  const fresh = [], gained = [];
  for (const m of list || []) {
    const r = learnMove(m, discipline, today);
    if (r.fresh) fresh.push(m);
    for (const t of r.gained) if (!gained.includes(t)) gained.push(t);
  }
  return { fresh, gained };
}

// The first move not learned after `afterId`, going round the ladder once
// (so `afterId` itself comes last). With no `afterId`, the first from the
// top. null when every move is learned.
export function nextMove(moves, learned, afterId) {
  const n = moves.length;
  const start = afterId ? moves.findIndex((m) => m.id === afterId) + 1 : 0;
  for (let k = 0; k < n; k++) {
    const m = moves[(start + k) % n];
    if (!isLearned(learned, m)) return m;
  }
  return null;
}

export function progressFor(moves, learned) {
  return { done: moves.filter((m) => isLearned(learned, m)).length, total: moves.length };
}

// ── the basics ─────────────────────────────────────────────────────────────
// A discipline's basics: its stance (and guard) and every Beginner-level
// strike. The Practice invite and the weekly reminder stop once the basics of
// one discipline are learned.
export const basicMoves = (discipline) => movesFor(discipline)
  .filter((m) => isStanceMove(m) || (isStrikeMove(m) && m.level === 'Beginner'));

// Where a discipline's basics stand. `next` is the first one not learned.
export function basicsProgress(discipline, learned = getLearned()) {
  const moves = basicMoves(discipline);
  const nextIndex = moves.findIndex((m) => !isLearned(learned, m));
  return {
    moves, done: moves.filter((m) => isLearned(learned, m)).length, total: moves.length,
    nextIndex, next: nextIndex >= 0 ? moves[nextIndex] : null,
  };
}

// Someone who finished all seven lessons of the old path has done the basics
// too: they are not asked again.
export function basicsDone(discipline, learned = getLearned(), completed = getCompletedLessons()) {
  if (basicsProgress(discipline, learned).next === null) return true;
  return basicsFor(known(discipline)).every((l) => completed.includes(l.id));
}

export function anyBasicsDone(learned = getLearned(), completed = getCompletedLessons()) {
  return PRACTICE_DISCIPLINES.some((d) => basicsDone(d, learned, completed));
}

// ── the drill ──────────────────────────────────────────────────────────────
// What data/practiceRound buildRound takes to drill one move: the move, the
// learned moves before it on the ladder (the round mixes in the last three
// strikes of them), and how many moves the athlete will have learned when
// this drill is done, which sets the round's level.
export function drillFor(moves, move, learned = getLearned()) {
  const i = moves.findIndex((m) => m.id === move.id);
  return {
    focus: { id: move.id, name: move.name, calls: move.calls, group: move.group, kind: move.kind },
    prior: moves.slice(0, Math.max(0, i)).filter((m) => isLearned(learned, m)).map((m) => ({ name: m.name, calls: m.calls })),
    learned: progressFor(moves, learned).done + (isLearned(learned, move) ? 0 : 1),
  };
}

// TEST OUT: one drill that mixes the calls of a whole group. `moves` in the
// result is the group, for learnMoves when the drill is finished.
export function groupDrill(moves, group, learned = getLearned()) {
  const list = moves.filter((m) => m.group === group);
  return {
    focus: { id: `group:${kebab(group)}`, name: group, calls: [...new Set(list.flatMap((m) => m.calls))], group, kind: 'GROUP' },
    prior: [],
    learned: progressFor(moves, learned).done + list.filter((m) => !isLearned(learned, m)).length,
    moves: list,
  };
}
