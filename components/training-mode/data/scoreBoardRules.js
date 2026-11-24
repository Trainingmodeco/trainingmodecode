// The world score board's rules, worked out from the app's own data (pure:
// no storage, no network). docs/retention/SCOREBOARD-DESIGN.md is the design;
// data/scoreBoardCloud.js talks to the server; the end screen and Profile draw
// it with the looks' components (retention/ui).
//
// One board is one mode at one setting, so every score on it was made under
// the same conditions. A board's key names it:
//
//   ff:boxing:3x3r60:normal        Fight Focus, 3 × 3 min, 60 s rest, Normal
//   jt:boxing:bag6x3               Just Train, the Bag 6×3 preset
//   cc:boxing:3x3r60:combo:normal  Combo Coach, MODE Combo, Normal (its own cadence)
//   qm:room_12:standard            Quick Mission at your pace (SOLO)
//   max:boss_rush:standard         Max Out
//
// The server keeps one row per board (board_rules), written only by a
// migration that scripts/score-board-rules.mjs generates from allBoards()
// below, so the app and the server agree on every key, cap and house score.
// Every board here opens marked BETA (phone-counted strikes, typed scores).
//
// Not here yet (the design's other boards): the arcade stages (the app keeps
// one best time per stage for both sides, and a run has no id of its own) and
// the GPS run (its clock stops on PAUSE and the saved run keeps no pause
// total, so a board time could not count the pauses). See BUILD-NOTES.
import { JUST_TRAIN_PRESETS, COMBO_CADENCE_BY_DIFF, COMBO_DIFFICULTIES, COMBO_MODES, FIGHT_DIFFICULTIES, FIGHT_DISCIPLINES } from './fightPresets';
import { LOADOUT_MISSIONS, missionDefById, levelsOf, buildLoadoutMission, formatLabelOf } from './loadoutMissions';
import { soloFloorSec, isMaxReps, isUntilDown, repsPerRound, totalSlots, workSecOf, heldOf, tierSec } from './missionSolo';
import { estMsFor, repCapFor, GEAR_TAGS, LEVEL_LABEL } from './missionMoves';
import { HOUSE_NAMES, HOUSE_LEVELS, composeBoard, placeLine } from '../retention/scoreBoards';
import { ORD, formatScore } from '../retention/scoreFormat';

export const PERIOD = 'all';

// ── the fight boards' fixed settings ─────────────────────────────────────────
// A fight board is one of a few fixed settings, rest included: the setups'
// default (3 × 3 min, 60 s rest) and a five-round card. Any other mix trains
// as today and the end screen says why in one line.
export const FIGHT_BOARD_SETTINGS = [
  { id: '3x3r60', rounds: 3, roundSec: 180, restSec: 60, label: '3 × 3 MIN · 60 S REST' },
  { id: '5x3r60', rounds: 5, roundSec: 180, restSec: 60, label: '5 × 3 MIN · 60 S REST' },
];

// Strikes a minute of work, the house ladder's twelve rungs at Normal (the
// looks' 3 × 3 ladder, 1,008 down to 240, a minute at a time), scaled by the
// level. The cap is 200 a minute: the counter waits 0.2 s after a strike, so
// even 300 is out of reach of any arm, and 200 is past any real bag round.
const FIGHT_HOUSE_PER_MIN = [112, 104, 96, 88, 80, 72, 64, 56, 48, 40, 33, 27];
const FIGHT_LEVEL_FACTOR = { easy: 0.85, normal: 1, hard: 1.1, advanced: 1.2 };
const FIGHT_CAP_PER_MIN = 200;

// The one-line reasons a finished session does not go on a board.
export const BOARD_LINES = {
  ffSetting: 'Board settings only: 3 × 3 or 5 × 3 min, 60 s rest.',
  ccSetting: "Board settings only: 3 × 3 or 5 × 3 min, 60 s rest, the level's own cadence.",
  jtPreset: 'Board presets only: Bag, Pads, Spar or Tabata.',
  rush: "Rush Mode and ghost runs don't go on the board.",
  counting: "Strike counting was off, so this one can't go on the board.",
  ownMoves: "Swapped or scaled moves don't go on the board.",
  overCap: "Past the board's limit for this mission, so it can't go on.",
  signedOut: 'Sign in on Profile to put your scores on the world board.',
  offline: "Started offline, so it can't go on the board.",
  offlineNow: "You're offline, so this one can't go on the board.",
  later: 'Join the world board on Profile to post your scores.',
  queued: 'Goes up when you are back online.',
  refused: 'The board did not take this one.',
};

// What each unit is called on a board, and the word for one of it.
export const UNIT_WORDS = {
  strikes: { unit: 'STRIKES', long: 'STRIKES ✓', one: 'strike', many: 'strikes' },
  seconds: { unit: 'TIME', long: 'MISSION TIME', one: 'second', many: 'seconds' },
  rounds_reps: { unit: 'SCORE', long: 'ROUNDS + REPS', one: 'rep', many: 'reps' },
  held: { unit: 'HELD', long: 'SETS HELD', one: 'set', many: 'sets' },
  reps: { unit: 'REPS', long: 'TOTAL REPS', one: 'rep', many: 'reps' },
};
// The ScoreBoard component's kind for a unit.
export const kindOf = (unit) => (unit === 'seconds' ? 'time' : unit === 'rounds_reps' ? 'roundsReps' : 'count');

const discByKey = (k) => FIGHT_DISCIPLINES.find((d) => d.key === k) || null;
const discById = (id) => FIGHT_DISCIPLINES.find((d) => d.id === id) || null;
const lower = (s) => String(s || '').toLowerCase();
const rr = (rounds, reps) => rounds * 1000 + reps;
// Every piece of gear, so a mission is built with its own moves (no gear
// default swapped in): the board's numbers are for the mission as written.
const ALL_GEAR = [...GEAR_TAGS];

// ── keys ─────────────────────────────────────────────────────────────────────
export function parseBoard(key) {
  const p = String(key || '').split(':');
  switch (p[0]) {
    case 'ff': return p.length === 4 ? { mode: 'ff', disc: p[1], setting: p[2], diff: p[3] } : null;
    case 'jt': return p.length === 3 ? { mode: 'jt', disc: p[1], preset: p[2] } : null;
    case 'cc': return p.length === 5 ? { mode: 'cc', disc: p[1], setting: p[2], ccMode: p[3], diff: p[4] } : null;
    case 'qm': return p.length === 3 ? { mode: 'qm', mission: p[1], level: p[2] } : null;
    case 'max': return p.length === 3 ? { mode: 'max', mission: p[1], level: p[2] } : null;
    default: return null;
  }
}

export function allBoardKeys() {
  const out = [];
  for (const d of FIGHT_DISCIPLINES) {
    for (const s of FIGHT_BOARD_SETTINGS) for (const diff of FIGHT_DIFFICULTIES) out.push(`ff:${d.key}:${s.id}:${lower(diff)}`);
    for (const p of JUST_TRAIN_PRESETS) out.push(`jt:${d.key}:${p.id}`);
    for (const s of FIGHT_BOARD_SETTINGS) for (const m of COMBO_MODES) for (const diff of COMBO_DIFFICULTIES) out.push(`cc:${d.key}:${s.id}:${lower(m)}:${lower(diff)}`);
  }
  for (const def of LOADOUT_MISSIONS) {
    for (const { id: level } of levelsOf(def)) {
      const m = buildLoadoutMission(def.id, { level, gear: ALL_GEAR });
      if (!m || isUntilDown(m)) continue;
      const key = `${isMaxReps(m) ? 'max' : 'qm'}:${def.id}:${level}`;
      if (missionRules(key, m)) out.push(key);
    }
  }
  return out;
}

// ── rules ────────────────────────────────────────────────────────────────────
// { board, mode, direction: 'more'|'less', unit, cap, minSeconds, house[12]
// (best first), houseKind: 'fight'|'fit'|'run' }. null for a key that is no board.
const RULES = new Map();
export function boardRules(key) {
  if (RULES.has(key)) return RULES.get(key);
  const b = parseBoard(key);
  let r = null;
  if (b && (b.mode === 'ff' || b.mode === 'jt' || b.mode === 'cc')) r = fightRules(key, b);
  else if (b && (b.mode === 'qm' || b.mode === 'max')) {
    const def = missionDefById(b.mission);
    const m = def && def.levels?.[b.level] ? buildLoadoutMission(b.mission, { level: b.level, gear: ALL_GEAR }) : null;
    r = m ? missionRules(key, m) : null;
  }
  RULES.set(key, r);
  return r;
}
export function allBoards() { return allBoardKeys().map(boardRules); }

function fightRules(key, b) {
  if (!discByKey(b.disc)) return null;
  let rounds, roundSec;
  if (b.mode === 'jt') {
    const p = JUST_TRAIN_PRESETS.find((x) => x.id === b.preset);
    if (!p) return null;
    rounds = p.rounds; roundSec = p.lenSec;
  } else {
    const s = FIGHT_BOARD_SETTINGS.find((x) => x.id === b.setting);
    const diffs = b.mode === 'ff' ? FIGHT_DIFFICULTIES : COMBO_DIFFICULTIES;
    if (!s || !diffs.map(lower).includes(b.diff)) return null;
    if (b.mode === 'cc' && !COMBO_MODES.map(lower).includes(b.ccMode)) return null;
    rounds = s.rounds; roundSec = s.roundSec;
  }
  const workMin = (rounds * roundSec) / 60;
  const f = FIGHT_LEVEL_FACTOR[b.diff || 'normal'] || 1;
  return {
    board: key, mode: b.mode, direction: 'more', unit: 'strikes',
    cap: Math.round(FIGHT_CAP_PER_MIN * workMin),
    // The work alone, less a tenth: rests are not counted, so a skipped rest
    // never makes an honest session look too quick.
    minSeconds: Math.floor(0.9 * rounds * roundSec),
    house: FIGHT_HOUSE_PER_MIN.map((n) => Math.round(n * workMin * f)),
    houseKind: 'fight',
  };
}

// The twelve house rungs from four anchors: rung 1 the elite pace, rung 5 the
// standard, rung 9 the beginner, rung 12 below it; straight lines between.
function ladder([elite, standard, beginner, low], round = Math.round) {
  const at = [0, 4, 8, 11], v = [elite, standard, beginner, low];
  return Array.from({ length: 12 }, (_, i) => {
    let k = 0;
    while (k < 2 && i > at[k + 1]) k += 1;
    const t = (i - at[k]) / (at[k + 1] - at[k]);
    return round(v[k] + (v[k + 1] - v[k]) * t);
  });
}
// The least time a rep can honestly take: half the move's elite count (the
// same ceiling Max Out's rep sheet uses, data/missionSolo repsCeiling).
const minRepSec = (moveId) => Math.max(0.2, (0.5 * estMsFor(moveId, 'elite')) / 1000);
const slotsOf = (m) => [...(m.exercises || []), ...(m.finisherExercises || [])];
const stepsOf = (slot) => (Array.isArray(slot.list) ? slot.list : [slot]);

function missionRules(key, m) {
  const max = isMaxReps(m);
  const kind = max ? 'totalReps' : m.scoreRule?.kind;
  const pace = m.pace || {};
  const base = { board: key, mode: max ? 'max' : 'qm', houseKind: 'fit', minSeconds: soloFloorSec(m) };
  const slots = slotsOf(m);
  if (kind === 'time') {
    if (m.format !== 'forTime') return null;
    const [e, s, b] = ['elite', 'standard', 'beginner'].map((t) => tierSec(pace[t]));
    if (!(e > 0 && s >= e && b >= s)) return null;
    const capSec = m.capSec || b * 1.5;
    const low = Math.min(capSec, Math.round(b * 1.25));
    // Times on the ladder are whole 5 s.
    return { ...base, direction: 'less', unit: 'seconds', cap: soloFloorSec(m), house: ladder([e, s, b, low], (x) => Math.round(x / 5) * 5) };
  }
  if (kind === 'roundsReps') {
    if (m.format !== 'amrap') return null;
    const rpr = repsPerRound(m);
    const block = slots.find((sl) => Array.isArray(sl.list));
    if (!(rpr > 0) || !block) return null;
    const perRound = block.list.reduce((n, st) => n + (st.reps || 0) * minRepSec(st.moveId), 0);
    const work = workSecOf(m);
    const maxRounds = Math.floor(work / Math.max(1, perRound));
    const toRr = (reps) => rr(Math.floor(reps / rpr), Math.round(reps) % rpr);
    const [e, s, b] = ['elite', 'standard', 'beginner'].map((t) => Number(pace[t]) || 0);
    if (!(e > 0)) return null;
    const house = ladder([e * rpr, s * rpr, b * rpr, b * rpr * 0.6]).map(toRr);
    return { ...base, direction: 'more', unit: 'rounds_reps', cap: rr(maxRounds, rpr - 1), house };
  }
  if (kind === 'minutesHeld') {
    if (m.format !== 'emom') return null;
    const of = heldOf(m);
    const [e, s, b] = ['elite', 'standard', 'beginner'].map((t) => Number(pace[t]?.held) || 0);
    if (!(of > 0 && e > 0)) return null;
    return { ...base, direction: 'more', unit: 'held', cap: of, house: ladder([e, s, b, b * 0.6]).map((v) => Math.min(of, v)) };
  }
  if (kind === 'reps') {
    const [e, s, b] = ['elite', 'standard', 'beginner'].map((t) => Number(pace[t]) || 0);
    if (!(e > 0)) return null;
    let cap = 0;
    if (m.format === 'amrap') {
      // An AMRAP scored in reps: every second of work at the fastest move's ceiling.
      const fastest = Math.min(...slots.flatMap(stepsOf).map((st) => minRepSec(st.moveId)));
      cap = Math.floor(workSecOf(m) / fastest);
    } else if (m.format === 'intervals') {
      // Each work window at its moves' ceiling, a loaded move's set cap too, every round.
      const perRound = slots.reduce((n, sl) => {
        const work = sl.work || sl.window || 60;
        const fastest = Math.min(...stepsOf(sl).map((st) => minRepSec(st.moveId)));
        const ceil = Math.floor(work / fastest);
        const capped = stepsOf(sl).length === 1 && repCapFor(sl.moveId, m.level) != null ? Math.min(ceil, repCapFor(sl.moveId, m.level)) : ceil;
        return n + capped;
      }, 0);
      cap = perRound * Math.max(1, m.rounds || 1);
    } else return null;
    if (!(cap >= e)) return null;
    return { ...base, direction: 'more', unit: 'reps', cap, house: ladder([e, s, b, b * 0.6]) };
  }
  if (kind === 'totalReps') {
    const [e, s, b] = ['elite', 'standard', 'beginner'].map((t) => Number(pace[t]) || 0);
    if (!(e > 0)) return null;
    // Every set at its move's set cap (a bodyweight move has none: 300), and
    // never more than the run's cap could hold at the fastest station's ceiling.
    const n = totalSlots(m);
    const bySets = Array.from({ length: n }, (_, i) => repCapFor(slots[i % slots.length].moveId, m.level) ?? 300).reduce((a, x) => a + x, 0);
    const fastest = Math.min(...slots.map((sl) => minRepSec(sl.moveId)));
    const byClock = m.capSec > 0 ? Math.floor(m.capSec / fastest) : bySets;
    const cap = Math.min(bySets, byClock);
    if (!(cap >= e)) return null;
    return { ...base, direction: 'more', unit: 'reps', cap, house: ladder([e, s, b, b * 0.6]) };
  }
  return null;
}

// ── titles ───────────────────────────────────────────────────────────────────
// The board's two short lines ("FIGHT FOCUS · BOXING", "3 × 3 MIN · 60 S REST
// · NORMAL"). Every board opens marked BETA.
export function boardTitle(key) {
  const b = parseBoard(key);
  if (!b) return null;
  if (b.mode === 'ff' || b.mode === 'jt' || b.mode === 'cc') {
    const d = discByKey(b.disc);
    const name = { ff: 'FIGHT FOCUS', jt: 'JUST TRAIN', cc: 'COMBO COACH' }[b.mode];
    let setting;
    if (b.mode === 'jt') {
      const p = JUST_TRAIN_PRESETS.find((x) => x.id === b.preset);
      setting = p ? `${p.label.toUpperCase()} · ${p.restSec} S REST` : '';
    } else {
      const s = FIGHT_BOARD_SETTINGS.find((x) => x.id === b.setting);
      setting = [s?.label, b.mode === 'cc' ? b.ccMode.toUpperCase() : null, b.diff.toUpperCase()].filter(Boolean).join(' · ');
    }
    return { mode: `${name} · ${d ? d.label : b.disc.toUpperCase()}`, setting, beta: true };
  }
  const def = missionDefById(b.mission);
  const m = def ? buildLoadoutMission(b.mission, { level: b.level, gear: ALL_GEAR }) : null;
  if (!m) return null;
  const lv = LEVEL_LABEL[b.level] || b.level.toUpperCase();
  const fmt = formatLabelOf(m);
  if (b.mode === 'max') return { mode: `MAX OUT · ${def.title}`, setting: `${lv} · ${m.rounds || 1} ROUNDS`, beta: true };
  const clock = (m.format === 'amrap' || m.format === 'emom') && (m.rounds || 1) === 1 && m.duration ? ` ${m.duration}` : '';
  return { mode: `QUICK MISSION · ${def.title}`, setting: `${lv} · ${fmt}${clock}`, beta: true };
}

// ── at START: which board, or why none ───────────────────────────────────────
// mode: 'ff' (Fight Focus) | 'jt' (Just Train) | 'cc' (Combo Coach). → { board }
// or { board: null, reason } (reason null: not a board mode at all, nothing said).
export function fightBoardStart({ mode, cfg, discipline }) {
  const none = (reason = null) => ({ board: null, reason });
  if (!cfg || typeof cfg !== 'object' || cfg.conceptKind) return none();
  const d = discById(discipline);
  if (!d) return none();
  if (cfg.ghost || cfg.rushMode) return none(BOARD_LINES.rush);
  const roundSec = Math.round(Number(cfg.roundMin) * 60);
  if (mode === 'jt') {
    const p = JUST_TRAIN_PRESETS.find((x) => x.rounds === cfg.rounds && x.lenSec === roundSec && x.restSec === cfg.restSec);
    return p ? { board: `jt:${d.key}:${p.id}`, reason: null } : none(BOARD_LINES.jtPreset);
  }
  const s = FIGHT_BOARD_SETTINGS.find((x) => x.rounds === cfg.rounds && x.roundSec === roundSec && x.restSec === cfg.restSec);
  if (mode === 'ff') {
    if (!s || !FIGHT_DIFFICULTIES.includes(cfg.difficulty)) return none(BOARD_LINES.ffSetting);
    return { board: `ff:${d.key}:${s.id}:${lower(cfg.difficulty)}`, reason: null };
  }
  if (mode === 'cc') {
    const cadence = COMBO_CADENCE_BY_DIFF[cfg.difficulty];
    const own = cadence && Math.round(Number(cfg.ms)) === Math.round(cadence * 1000);
    if (!s || !own || !COMBO_MODES.includes(cfg.mode)) return none(BOARD_LINES.ccSetting);
    return { board: `cc:${d.key}:${s.id}:${lower(cfg.mode)}:${lower(cfg.difficulty)}`, reason: null };
  }
  return none();
}

// A mission run with a move other than its own (a swap, or a gear default the
// card put in): every slot and step the swap code rebuilt carries `scaled`.
export function usesSwappedMoves(mission) {
  return slotsOf(mission || {}).some((sl) => sl.scaled === true || (Array.isArray(sl.list) && sl.list.some((st) => st.scaled === true)));
}

// A Quick Mission start (App goQuickMissionActive's config): AT YOUR PACE on a
// mission with a board, or MAX OUT either way.
export function missionBoardStart(cfg) {
  const none = (reason = null) => ({ board: null, reason });
  const m = cfg?.mission;
  if (!cfg?.v2 || !m || m.v2 !== true || !m.id || !m.level) return none();
  const max = isMaxReps(m);
  if (!max && cfg.mode !== 'solo') return none();
  const board = `${max ? 'max' : 'qm'}:${m.id}:${m.level}`;
  if (!boardRules(board)) return none();
  if (cfg.scaled || m.scaled || usesSwappedMoves(m)) return none(BOARD_LINES.ownMoves);
  return { board, reason: null };
}

// ── at FINISH: the score, or why none ────────────────────────────────────────
// The value must sit inside the board's cap (the server checks it again).
export function insideCap(rules, value) {
  if (!rules || !Number.isFinite(value)) return false;
  return rules.direction === 'less' ? value >= rules.cap && value > 0 : value >= 0 && value <= rules.cap;
}

// A fight session: finished (every round, the integrity check passed) and
// counted by the phone. → { value } | { value: null, reason }.
export function fightBoardFinish({ board, finished, fightStats }) {
  if (!finished) return { value: null, reason: null };
  if (!fightStats?.motionUsed || !(fightStats.thrown > 0)) return { value: null, reason: BOARD_LINES.counting };
  const value = Math.round(fightStats.thrown);
  if (!insideCap(boardRules(board), value)) return { value: null, reason: BOARD_LINES.overCap };
  return { value, reason: null };
}

// A Quick Mission result (App's, with its settle): AT YOUR PACE or MAX OUT,
// finished and passed, its own moves, inside the cap. A for-time time counts
// the pauses (SOLO's clock stops on PAUSE, so they are added back).
export function missionBoardFinish({ board, result }) {
  const rules = boardRules(board);
  const settle = result?.settle;
  const m = result?.mission;
  const finished = !!result?.completed && !result?.capped && !result?.stopped && settle?.outcome === 'pass';
  if (!rules || !finished) return { value: null, reason: null };
  if (result.scaled || usesSwappedMoves(m)) return { value: null, reason: BOARD_LINES.ownMoves };
  const sc = result.score || {};
  let value = null;
  if (rules.mode === 'max') value = sc.kind === 'totalReps' ? Number(sc.total) : null;
  else if (sc.kind === 'time' && rules.unit === 'seconds' && !sc.capped) value = Math.round(Number(sc.timeSec ?? sc.value) + Math.max(0, Number(result.pausedSec) || 0));
  else if (sc.kind === 'roundsReps' && rules.unit === 'rounds_reps') value = rr(Math.max(0, Number(sc.rounds) || 0), Math.max(0, Number(sc.reps) || 0));
  else if (sc.kind === 'minutesHeld' && rules.unit === 'held') value = Number(sc.minutesHeld ?? sc.value);
  else if (sc.kind === 'reps' && rules.unit === 'reps') value = Number(sc.reps ?? sc.value);
  if (!Number.isFinite(value)) return { value: null, reason: null };
  if (!insideCap(rules, value)) return { value: null, reason: BOARD_LINES.overCap };
  return { value: Math.round(value), reason: null };
}

// ── after the server answers ─────────────────────────────────────────────────
// The full GAME OVER board is shown only when it is news: a new best that
// lands in or moves up the top 10, or the athlete's first score on the board.
export function isNews(submit) {
  if (!submit || submit.status !== 'new_best') return false;
  if (submit.first) return true;
  return submit.place != null && submit.place <= 10 && (submit.place_before == null || submit.place < submit.place_before);
}

// What the next place needs ("Next place: 3 more reps", "Next place: 0:12 faster").
export function nextLine(rules, mine, next) {
  if (!rules || mine == null || next == null) return null;
  const w = UNIT_WORDS[rules.unit];
  if (rules.direction === 'less') return `Next place: ${formatScore('time', Math.max(1, mine - next + 1))} faster`;
  if (rules.unit === 'rounds_reps') {
    const [r1, p1, r2, p2] = [Math.floor(mine / 1000), mine % 1000, Math.floor(next / 1000), next % 1000];
    if (r2 > r1) return `Next place: ${r2 - r1} more round${r2 - r1 === 1 ? '' : 's'}`;
    const n = Math.max(1, p2 - p1 + 1);
    return `Next place: ${n} more ${n === 1 ? w.one : w.many}`;
  }
  return `Next place: ${Math.max(1, next - mine + 1)} more ${Math.max(1, next - mine + 1) === 1 ? w.one : w.many}`;
}
// This session against a best it did not beat ("7 REPS SHORT OF YOUR BEST").
export function shortLine(rules, value, best) {
  if (!rules || best == null || value == null) return null;
  if (value === best) return 'TIED YOUR BEST';
  const w = UNIT_WORDS[rules.unit];
  if (rules.direction === 'less') return `${formatScore('time', Math.abs(value - best))} OFF YOUR BEST`;
  if (rules.unit === 'rounds_reps') {
    const dr = Math.floor(best / 1000) - Math.floor(value / 1000);
    if (dr > 0) return `${dr} ROUND${dr === 1 ? '' : 'S'} SHORT OF YOUR BEST`;
    const d = (best % 1000) - (value % 1000);
    return `${d} ${(d === 1 ? w.one : w.many).toUpperCase()} SHORT OF YOUR BEST`;
  }
  const d = best - value;
  return `${d.toLocaleString('en-US')} ${(d === 1 ? w.one : w.many).toUpperCase()} SHORT OF YOUR BEST`;
}

// The board the looks' components draw (GameOverBoard / HighScoresCard), from
// the server's replies. The server merged the rows (get_board); this only
// names and formats them.
//   reply:  get_board → { players, rows: [{ place, rank?, name, country, level, value, cpu, you }] }
//   mine:   get_my_place → { value, level, rank, place, players, next_value } (or null)
//   submit: submit_score → { status, first, was, best, place, place_before } (or null)
//   value:  this session's score
export function boardView({ board, reply, mine = null, submit = null, value = null, asOf = null }) {
  const rules = boardRules(board);
  const title = boardTitle(board);
  if (!rules || !title || !reply) return null;
  const w = UNIT_WORDS[rules.unit];
  const kind = kindOf(rules.unit);
  const newBest = submit?.status === 'new_best';
  const players = Math.max(0, Number(reply.players) || 0);
  const rows = (reply.rows || []).slice(0, 10).map((r) => ({
    place: r.place, name: r.cpu ? r.name : r.you ? 'YOU' : r.name, level: r.level, value: r.value,
    ...(r.cpu ? { cpu: true } : {}), ...(r.you ? { you: true, rank: mine?.rank ?? r.rank, newBest } : { rank: r.rank }),
    ...(!r.cpu && !r.you && r.country ? { cc: r.country } : {}),
  }));
  const me = rows.find((r) => r.you);
  let you = null;
  if (!me && mine?.value != null && mine.place != null) {
    const cpuAbove = mine.place > mine.rank;
    you = {
      place: mine.place, of: players, level: mine.level, value: mine.value, newBest,
      next: nextLine(rules, mine.value, mine.next_value),
      ...(cpuAbove ? { ofLine: `${ORD(mine.rank)} of ${players.toLocaleString('en-US')} players` } : {}),
    };
  }
  const best = submit?.best ?? mine?.value ?? null;
  const line = me ? placeLine(rows, players)
    : newBest && mine?.place != null ? `#${mine.place.toLocaleString('en-US')} OF ${players.toLocaleString('en-US')} PLAYERS`
      : !newBest && value != null ? shortLine(rules, value, best) : null;
  // The card's quiet line when this session did not beat the best on the board.
  const note = !newBest && value != null && best != null && value !== best
    ? `Today: ${formatScore(kind, value)}. Your best (${formatScore(kind, best)}) stays on the board.` : null;
  return {
    id: board, ...title, kind, unit: w.unit, unitLong: w.long, rows, you, asOf, note,
    hero: value == null ? null : {
      value, newBest, first: !!submit?.first,
      ...(newBest && submit?.was != null ? { was: submit.was } : {}),
      ...(!newBest && best != null ? { best } : {}),
      line,
    },
  };
}

// The last copy kept on the phone, with this session's score in its place
// (offline, the score queued): the same rule as the server (composeBoard).
export function localView({ board, cached, value, level }) {
  const rules = boardRules(board);
  if (!rules || !cached?.reply) return null;
  const lowerBetter = rules.direction === 'less';
  const old = cached.mine?.value;
  const mineNow = old == null ? value : lowerBetter ? Math.min(old, value) : Math.max(old, value);
  const rows = cached.reply.rows || [];
  const real = rows.filter((r) => !r.cpu && !r.you).map((r, i) => ({ name: r.name, level: r.level, value: r.value, cc: r.country || undefined, at: i }));
  const players = Math.max(1, (Number(cached.reply.players) || 0) + (old == null ? 1 : 0));
  real.push({ name: 'YOU', you: true, level, value: mineNow, at: Infinity });
  const house = rows.filter((r) => r.cpu).map((r) => ({ name: r.name, level: r.level, value: r.value }));
  const merged = composeBoard({ real, house, lower: lowerBetter, players });
  const reply = { players, rows: merged.map((r) => ({ place: r.place, rank: r.rank, name: r.name, level: r.level, value: r.value, cpu: !!r.cpu, you: !!r.you, country: r.cc || null })) };
  const better = old == null || (lowerBetter ? value < old : value > old);
  return boardView({ board, reply, submit: { status: better ? 'new_best' : 'not_best', best: old, was: better ? old : undefined, first: old == null }, value, asOf: cached.at || null });
}

// The house rows a board shows while it is new, named (for the tests and the
// SQL check: the server builds the same rows from board_rules and board_house).
export function houseRowsFor(rules) {
  const names = HOUSE_NAMES[rules.houseKind] || HOUSE_NAMES.fit;
  return rules.house.map((value, i) => ({ name: names[i], level: HOUSE_LEVELS[i], value, cpu: true }));
}

