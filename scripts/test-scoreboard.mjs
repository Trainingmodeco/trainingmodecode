// The world score board's pure rules (data/scoreBoardRules.js) and its client
// (data/scoreBoardCloud.js, with fetch stubbed): every board's key and rules,
// each mode's board at START and score at FINISH, the one-line reasons, the
// caps, the view the end screen draws (place and rank, the pinned row, what
// the next place needs), the offline copy, the news rule, and that the
// migration's generated rows match the app's data today.
// Run with `npm run test:scoreboard`.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const store = new Map();
const ls = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k), clear: () => store.clear() };
globalThis.localStorage = ls;
globalThis.window = { localStorage: ls, addEventListener() {}, removeEventListener() {}, location: { origin: 'http://localhost' } };

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const R = await import('../components/training-mode/data/scoreBoardRules.js');
const SB = await import('../components/training-mode/retention/scoreBoards.js');
const { JUST_TRAIN_PRESETS, COMBO_CADENCE_BY_DIFF } = await import('../components/training-mode/data/fightPresets.js');
const { buildLoadoutMission } = await import('../components/training-mode/data/loadoutMissions.js');
const { GEAR_TAGS } = await import('../components/training-mode/data/missionMoves.js');

let pass = 0, fail = 0;
const check = (name, cond, extra = '') => { if (cond) { pass++; console.log(`  ok   ${name}`); } else { fail++; console.log(`  FAIL ${name}  ${extra}`); } };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ── every board ──────────────────────────────────────────────────────────────
const all = R.allBoards();
const by = all.reduce((m, r) => ({ ...m, [r.mode]: (m[r.mode] || 0) + 1 }), {});
check('203 boards: 24 Fight Focus, 16 Just Train, 64 Combo Coach, 84 Quick Mission, 15 Max Out', all.length === 203 && eq(by, { ff: 24, jt: 16, cc: 64, qm: 84, max: 15 }), JSON.stringify(by));
check('every key is unique and fits the server\'s key check', new Set(all.map((r) => r.board)).size === all.length && all.every((r) => /^[a-z0-9_]+(:[a-z0-9_]+){1,4}$/.test(r.board) && r.board.length <= 80));
check('every board has twelve house scores, best first', all.every((r) => r.house.length === 12 && r.house.every((v, i) => i === 0 || (r.direction === 'more' ? v <= r.house[i - 1] : v >= r.house[i - 1]))), JSON.stringify(all.find((r) => r.house.some((v, i) => i && (r.direction === 'more' ? v > r.house[i - 1] : v < r.house[i - 1])))));
check('every house score is inside its cap (a fair, reachable target)', all.every((r) => r.house.every((v) => R.insideCap(r, v))), JSON.stringify(all.filter((r) => !r.house.every((v) => R.insideCap(r, v))).map((r) => r.board)));
check('every board has a title and a BETA mark', all.every((r) => { const t = R.boardTitle(r.board); return t && t.mode && t.setting && t.beta === true; }));
check('every min_seconds is a real session\'s length (positive, under 45 min)', all.every((r) => r.minSeconds > 0 && r.minSeconds < 2700));
check('a fight board: 200 strikes a minute of work is the cap; min is 90% of the work', eq([R.boardRules('ff:boxing:3x3r60:normal').cap, R.boardRules('ff:boxing:3x3r60:normal').minSeconds], [1800, 486]) && R.boardRules('ff:mma:5x3r60:hard').cap === 3000);
check('the looks\' 3 × 3 ladder is the Normal fight ladder', eq(R.boardRules('ff:boxing:3x3r60:normal').house.slice(0, 10), [1008, 936, 864, 792, 720, 648, 576, 504, 432, 360]));
check('a harder level has a higher ladder', R.boardRules('ff:boxing:3x3r60:hard').house[0] > R.boardRules('ff:boxing:3x3r60:normal').house[0]);
check('not a board: the until-down and rounds-held missions (no_continues, upper_lower_dips, touch_the_sky)', !all.some((r) => /no_continues|upper_lower_dips|touch_the_sky/.test(r.board)) && R.boardRules('qm:touch_the_sky:standard') === null);
check('unknown keys are no board', [R.boardRules('ff:boxing:4x3r60:normal'), R.boardRules('ff:boxing:3x3r60:advanced'), R.boardRules('jt:boxing:custom'), R.boardRules('cc:judo:3x3r60:combo:normal'), R.boardRules('qm:room_12:legend'), R.boardRules('run:5km'), R.boardRules('')].every((x) => x === null));
const room = R.boardRules('qm:room_12:standard');
check('ROOM 12 standard: rounds + reps, more, 0.95 of the 12-minute clock', room.unit === 'rounds_reps' && room.direction === 'more' && room.minSeconds === 684 && room.house[0] === 12000 && room.cap > 12000);
const honor = R.boardRules('qm:honor_rounds:standard');
check('a for-time board: less, its cap is SOLO\'s own floor (half the elite time)', honor.direction === 'less' && honor.unit === 'seconds' && honor.cap === 105 && honor.house[0] === 210);
const boss = R.boardRules('max:boss_rush:standard');
check('Max Out: total reps, more, its ladder from the mission\'s paces', boss.unit === 'reps' && boss.house[0] === 250 && boss.house[4] === 195 && boss.house[8] === 135);
check('titles: fight, Just Train, combo, SOLO, Max Out', eq(['ff:boxing:3x3r60:normal', 'jt:muay_thai:tabata8x20', 'cc:mma:5x3r60:technical:advanced', 'qm:room_12:standard', 'max:boss_rush:elite'].map((k) => { const t = R.boardTitle(k); return `${t.mode} / ${t.setting}`; }), [
  'FIGHT FOCUS · BOXING / 3 × 3 MIN · 60 S REST · NORMAL',
  'JUST TRAIN · MUAY THAI / TABATA 8×0:20 · 10 S REST',
  'COMBO COACH · MMA / 5 × 3 MIN · 60 S REST · TECHNICAL · ADVANCED',
  'QUICK MISSION · ROOM 12 / STANDARD · AMRAP 12',
  'MAX OUT · BOSS RUSH / ELITE · 5 ROUNDS',
]), JSON.stringify(['ff:boxing:3x3r60:normal', 'qm:room_12:standard'].map(R.boardTitle)));

// ── START: which board, or why not ───────────────────────────────────────────
const ff = (o = {}) => ({ difficulty: 'Normal', mode: 'Technical', rounds: 3, roundMin: 3, restSec: 60, rushMode: false, ...o });
check('Fight Focus 3 × 3, 60 s rest, Normal → its board', R.fightBoardStart({ mode: 'ff', cfg: ff(), discipline: 'Boxing' }).board === 'ff:boxing:3x3r60:normal');
check('…5 × 3 Hard, Muay Thai', R.fightBoardStart({ mode: 'ff', cfg: ff({ rounds: 5, difficulty: 'Hard' }), discipline: 'Muay Thai' }).board === 'ff:muay_thai:5x3r60:hard');
const off = R.fightBoardStart({ mode: 'ff', cfg: ff({ rounds: 4 }), discipline: 'Boxing' });
check('any other mix: no board, and the one line why', off.board === null && off.reason === 'Board settings only: 3 × 3 or 5 × 3 min, 60 s rest.');
check('the rest is part of the setting (45 s rest is off the board)', R.fightBoardStart({ mode: 'ff', cfg: ff({ restSec: 45 }), discipline: 'Boxing' }).board === null);
check('a 2:30 round is off the board', R.fightBoardStart({ mode: 'ff', cfg: ff({ roundMin: 2.5 }), discipline: 'Boxing' }).board === null);
check('Rush Mode: no board, its line', R.fightBoardStart({ mode: 'ff', cfg: ff({ rushMode: true }), discipline: 'Boxing' }).reason === "Rush Mode and ghost runs don't go on the board.");
check('a ghost race: no board, the same line', R.fightBoardStart({ mode: 'ff', cfg: ff({ ghost: { ghostId: 'g' } }), discipline: 'Boxing' }).reason === "Rush Mode and ghost runs don't go on the board.");
check('a concept stage is not a board mode (nothing said)', eq(R.fightBoardStart({ mode: 'ff', cfg: ff({ conceptKind: 'arcade' }), discipline: 'Boxing' }), { board: null, reason: null }));
check('an unknown discipline is not a board mode', R.fightBoardStart({ mode: 'ff', cfg: ff(), discipline: 'Judo' }).reason === null);
for (const p of JUST_TRAIN_PRESETS) check(`Just Train ${p.label} → jt:boxing:${p.id}`, R.fightBoardStart({ mode: 'jt', cfg: { mode: 'Just Train', difficulty: 'Normal', rounds: p.rounds, roundMin: p.lenSec / 60, restSec: p.restSec, rushMode: false }, discipline: 'Boxing' }).board === `jt:boxing:${p.id}`);
check('Just Train, a custom shape: the presets line', R.fightBoardStart({ mode: 'jt', cfg: { mode: 'Just Train', rounds: 7, roundMin: 3, restSec: 60 }, discipline: 'Boxing' }).reason === 'Board presets only: Bag, Pads, Spar or Tabata.');
const cc = (o = {}) => ({ discipline: 'Boxing', difficulty: 'Normal', mode: 'Combo', rounds: 3, roundMin: 3, restSec: 60, ms: Math.round(COMBO_CADENCE_BY_DIFF.Normal * 1000), rushMode: false, ...o });
check('Combo Coach at its level\'s own cadence → its board (MODE in the key)', R.fightBoardStart({ mode: 'cc', cfg: cc(), discipline: 'Boxing' }).board === 'cc:boxing:3x3r60:combo:normal');
check('…Technical, Advanced (2.5 s)', R.fightBoardStart({ mode: 'cc', cfg: cc({ mode: 'Technical', difficulty: 'Advanced', ms: 2500 }), discipline: 'Kickboxing' }).board === 'cc:kickboxing:3x3r60:technical:advanced');
check('Combo Coach with the CADENCE moved: the combo line', R.fightBoardStart({ mode: 'cc', cfg: cc({ ms: 3000 }), discipline: 'Boxing' }).reason === "Board settings only: 3 × 3 or 5 × 3 min, 60 s rest, the level's own cadence.");

const ALL_GEAR = [...GEAR_TAGS];
const mission = (id, level = 'standard', gear = ALL_GEAR) => buildLoadoutMission(id, { level, gear });
const qcfg = (m, mode = 'solo', o = {}) => ({ v2: true, mission: m, mode, missionId: m.id, level: m.level, scaled: false, swaps: [], ...o });
check('a mission AT YOUR PACE → its qm board', R.missionBoardStart(qcfg(mission('room_12'))).board === 'qm:room_12:standard');
check('the same mission GUIDED has no board (nothing said)', eq(R.missionBoardStart(qcfg(mission('room_12'), 'guided')), { board: null, reason: null }));
check('MAX OUT posts guided or at your pace', R.missionBoardStart(qcfg(mission('boss_rush'), 'guided')).board === 'max:boss_rush:standard' && R.missionBoardStart(qcfg(mission('boss_rush'))).board === 'max:boss_rush:standard');
// A swap (or a gear default the card put in) rebuilds the slot with `scaled: true`.
const swapped = (m) => ({ ...m, exercises: m.exercises.map((sl, i) => (i ? sl : { ...sl, scaled: true })) });
check('the mission as written uses its own moves', !R.usesSwappedMoves(mission('one_bell_300')));
check('a swapped move: no board, the own-moves line', R.usesSwappedMoves(swapped(mission('one_bell_300'))) && R.missionBoardStart(qcfg(swapped(mission('one_bell_300')))).reason === "Swapped or scaled moves don't go on the board.");
check('a SCALED run: the same line', R.missionBoardStart(qcfg(mission('room_12'), 'solo', { scaled: true })).reason === "Swapped or scaled moves don't go on the board.");
check('an until-down mission has no board (nothing said)', eq(R.missionBoardStart(qcfg(mission('no_continues'))), { board: null, reason: null }));
check("today's generated mission has no board", eq(R.missionBoardStart({ mission: { exercises: [] }, mode: 'solo' }), { board: null, reason: null }));

// ── FINISH: the score, or why not ────────────────────────────────────────────
const F = 'ff:boxing:3x3r60:normal';
check('a finished, counted fight posts the strikes counted', eq(R.fightBoardFinish({ board: F, finished: true, fightStats: { motionUsed: true, thrown: 812 } }), { value: 812, reason: null }));
check('strike counting off: the counting line', R.fightBoardFinish({ board: F, finished: true, fightStats: { motionUsed: false, strikes: 400 } }).reason === "Strike counting was off, so this one can't go on the board.");
check('a stopped session: nothing at all', eq(R.fightBoardFinish({ board: F, finished: false, fightStats: { motionUsed: true, thrown: 812 } }), { value: null, reason: null }));
check('past the cap: the limit line', R.fightBoardFinish({ board: F, finished: true, fightStats: { motionUsed: true, thrown: 2400 } }).reason === "Past the board's limit for this mission, so it can't go on.");
const mRoom = mission('room_12');
const solo = (m, score, o = {}) => ({ mode: 'solo', mission: m, completed: true, settle: { outcome: 'pass' }, score, elapsedSec: 720, pausedSec: 0, ...o });
check('AMRAP: rounds + reps as rounds × 1000 + reps', R.missionBoardFinish({ board: 'qm:room_12:standard', result: solo(mRoom, { kind: 'roundsReps', rounds: 10, reps: 25, value: 10 * 44 + 25 }) }).value === 10025);
check('a multi-block AMRAP adds its blocks', R.missionBoardFinish({ board: 'qm:five_round_bout:standard', result: solo(mission('five_round_bout'), { kind: 'roundsReps', rounds: 20, reps: 7, blocks: [] }) }).value === 20007);
const mHonor = mission('honor_rounds');
check('for time: the time with the pauses added back', R.missionBoardFinish({ board: 'qm:honor_rounds:standard', result: solo(mHonor, { kind: 'time', timeSec: 400, value: 400 }, { pausedSec: 35 }) }).value === 435);
check('a for-time run stopped by its cap does not post', R.missionBoardFinish({ board: 'qm:honor_rounds:standard', result: solo(mHonor, { kind: 'time', capped: true, reps: 80 }, { capped: true }) }).value === null);
check('EMOM: the sets held', R.missionBoardFinish({ board: 'qm:iron_clock_16:standard', result: solo(mission('iron_clock_16'), { kind: 'minutesHeld', minutesHeld: 15, of: 16 }) }).value === 15);
check('EMOM over its windows: the limit line', R.missionBoardFinish({ board: 'qm:iron_clock_16:standard', result: solo(mission('iron_clock_16'), { kind: 'minutesHeld', minutesHeld: 17, of: 16 }) }).reason === "Past the board's limit for this mission, so it can't go on.");
check('intervals: the reps', R.missionBoardFinish({ board: 'qm:turbo_button:standard', result: solo(mission('turbo_button'), { kind: 'reps', reps: 22 }) }).value === 22);
check('Max Out: the total reps', R.missionBoardFinish({ board: 'max:boss_rush:standard', result: solo(mission('boss_rush'), { kind: 'totalReps', total: 214, sets: 9, of: 9 }) }).value === 214);
check('a SOLO run the floor refused (too fast) does not post', R.missionBoardFinish({ board: 'qm:honor_rounds:standard', result: solo(mHonor, { kind: 'time', timeSec: 60 }, { settle: { outcome: 'too_fast' } }) }).value === null);
check('a SOLO run with a swap made during the run: the own-moves line', R.missionBoardFinish({ board: 'qm:room_12:standard', result: solo({ ...mRoom, exercises: mRoom.exercises.map((sl) => ({ ...sl, list: sl.list.map((st, i) => (i ? st : { ...st, scaled: true })) })) }, { kind: 'roundsReps', rounds: 9, reps: 0 }) }).reason === "Swapped or scaled moves don't go on the board.");

// ── the view the end screen draws ────────────────────────────────────────────
const ffR = R.boardRules(F);
const house = R.houseRowsFor(ffR);
const real = [{ name: 'Rafa_K', level: 22, value: 951, cc: 'BR', at: 1 }, { name: 'Mina', level: 17, value: 868, at: 2 }, { name: 'YOU', you: true, level: 14, value: 812, at: 3 }, { name: 'Dre', level: 7, value: 640, cc: 'US', at: 4 }];
const merged = SB.composeBoard({ real, house, players: 4 });
const reply = { players: 4, rows: merged.map((r) => ({ place: r.place, rank: r.rank, name: r.name, level: r.level, value: r.value, cpu: !!r.cpu, you: !!r.you, country: r.cc || null })) };
let v = R.boardView({ board: F, reply, mine: { value: 812, level: 14, rank: 3, place: 6, players: 4, next_value: 864 }, submit: { status: 'new_best', first: false, was: 744, best: 812, place: 6, place_before: 8 }, value: 812 });
check('the view: the looks\' fight board (6th on the list, 3rd of 4 players)', v.hero.line === '6TH PLACE · 3RD OF 4 PLAYERS' && v.hero.newBest && v.hero.was === 744 && v.rows.length === 10 && v.you === null, JSON.stringify(v.hero));
check('…the title, the BETA mark, the units', v.mode === 'FIGHT FOCUS · BOXING' && v.beta && v.unit === 'STRIKES' && v.unitLong === 'STRIKES ✓' && v.kind === 'count');
check('…my row reads YOU with NEW BEST; others keep their country; CPU rows none', v.rows.find((r) => r.you).name === 'YOU' && v.rows.find((r) => r.you).newBest && v.rows.find((r) => r.name === 'Rafa_K').cc === 'BR' && v.rows.filter((r) => r.cpu).every((r) => !r.cc));
check('news: a new best that moves up the top 10', R.isNews({ status: 'new_best', place: 6, place_before: 8 }));
check('news: a first score on the board, wherever it lands', R.isNews({ status: 'new_best', first: true, place: 143 }));
check('news: landing in the top 10 from outside it', R.isNews({ status: 'new_best', place: 9, place_before: 14 }));
check('not news: a new best that keeps the same place', !R.isNews({ status: 'new_best', place: 3, place_before: 3 }));
check('not news: a new best outside the top 10', !R.isNews({ status: 'new_best', place: 143, place_before: 150 }));
check('not news: not a best', !R.isNews({ status: 'not_best', place: 2 }));
// A busy board, outside the top 10, not a best.
const busy = { players: 2310, rows: Array.from({ length: 10 }, (_, i) => ({ place: i + 1, rank: i + 1, name: `P${i}`, level: 20, value: 14000 - i * 300, cpu: false, you: false, country: null })) };
v = R.boardView({ board: 'qm:room_12:standard', reply: busy, mine: { value: 10025, level: 14, rank: 143, place: 143, players: 2310, next_value: 10027 }, submit: { status: 'not_best', best: 10025, place: 143, place_before: 143 }, value: 10018 });
check('outside the top 10: my row pinned, #143 of 2,310, what the next place needs', v.you && v.you.place === 143 && v.you.of === 2310 && v.you.next === 'Next place: 3 more reps' && !v.you.ofLine, JSON.stringify(v.you));
check('…YOUR SCORE says how far short of the best', v.hero.line === '7 REPS SHORT OF YOUR BEST' && v.hero.best === 10025 && !v.hero.newBest, JSON.stringify(v.hero));
check('…and the card\'s quiet line says the best stays', v.note === 'Today: 10 + 18. Your best (10 + 25) stays on the board.', v.note);
check('…a SCORE column, rounds + reps', v.unit === 'SCORE' && v.kind === 'roundsReps');
// A new board where CPU rows sit above me and I am off the ten: the pinned row says my rank.
v = R.boardView({ board: F, reply: { players: 2, rows: house.slice(0, 10).map((h, i) => ({ place: i + 1, name: h.name, level: h.level, value: h.value, cpu: true, you: false })) }, mine: { value: 250, level: 3, rank: 2, place: 13, players: 2, next_value: 297 }, submit: { status: 'new_best', first: true, place: 13 }, value: 250 });
check('a new board, under the CPU rows: the pinned row says "2ND of 2 players"', v.you.ofLine === '2ND of 2 players' && v.you.next === 'Next place: 48 more strikes' && v.hero.line === '#13 OF 2 PLAYERS', JSON.stringify(v));
check('next place on a time board: "0:12 faster"', R.nextLine(honor, 432, 421) === 'Next place: 0:12 faster');
check('next place a round up: "1 more round"', R.nextLine(room, 10025, 11004) === 'Next place: 1 more round');
check('short of a best, time: "0:20 OFF YOUR BEST"', R.shortLine(honor, 455, 435) === '0:20 OFF YOUR BEST');
check('short of a best, a round: "1 ROUND SHORT OF YOUR BEST"', R.shortLine(room, 9030, 10010) === '1 ROUND SHORT OF YOUR BEST');
check('a tie with the best', R.shortLine(ffR, 812, 812) === 'TIED YOUR BEST');
// The phone's copy, offline: this session's score in its place, by composeBoard.
const lv = R.localView({ board: F, cached: { reply, mine: { value: 812 }, at: 1 }, value: 900, level: 14 });
check('offline: the last copy with this session in its place (900 lands 4th)', lv && lv.rows.find((r) => r.you).value === 900 && lv.rows.find((r) => r.you).place === 4 && lv.hero.newBest && lv.hero.was === 812, JSON.stringify(lv && lv.rows.map((r) => `${r.place}:${r.name}:${r.value}`)));
const lv2 = R.localView({ board: F, cached: { reply, mine: { value: 812 }, at: 1 }, value: 700, level: 14 });
check('offline, not a best: the board keeps the best (812), YOUR BEST beside the score', lv2.rows.find((r) => r.you).value === 812 && lv2.hero.best === 812 && !lv2.hero.newBest && lv2.hero.line === '6TH PLACE · 3RD OF 4 PLAYERS');

// ── the client, with the network stubbed ─────────────────────────────────────
const C = await import('../components/training-mode/data/scoreBoardCloud.js');
const calls = [];
let replies = {};
let online = true;
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true, language: 'en-US', languages: ['en-US'] }, configurable: true, writable: true });
globalThis.fetch = async (url, init) => {
  const name = String(url).split('/rpc/')[1];
  calls.push({ name, body: JSON.parse(init.body || '{}'), auth: init.headers.Authorization || null });
  if (!online) throw new TypeError('Failed to fetch');
  const r = await (typeof replies[name] === 'function' ? replies[name](JSON.parse(init.body || '{}')) : replies[name]);
  return { ok: r !== undefined && !(r && r.__status), status: r?.__status || 200, text: async () => JSON.stringify(r ?? null) };
};
// The signed-in athlete's token and user id (GoTrue itself is not run here).
let signedIn = true;
let account = 'user-1';
C.boardIo.getAccessToken = async () => (signedIn ? `tok-${account}` : null);
C.boardIo.getUserId = async () => (signedIn ? account : null);
const signIn = (on) => { signedIn = on; };
const QUEUE = 'tm_score_board_queue_v1';
const queue = () => JSON.parse(ls.getItem(QUEUE) || '[]');

replies = { start_board_run: 'tick-1', get_board_profile: null };
let h = C.startBoardRun(F);
check('START asks for a ticket for the board', (await h.ticket).ticket === 'tick-1' && calls.at(-1).name === 'start_board_run' && calls.at(-1).body.p_board === F && calls.at(-1).auth === 'Bearer tok-user-1' && h.uid === 'user-1');
let out = await C.finishBoardRun({ board: F, value: 812, level: 14, handle: h });
check('first eligible finish, never asked: the opt-in, before anything is posted', out.kind === 'optin' && out.ticket === 'tick-1' && !calls.some((c) => c.name === 'submit_score'));
replies.join_boards = { ok: true, name: 'Rafa_K', country: null };
const j = await C.joinBoards('Rafa_K', null);
check('JOIN: the server takes the name; the phone remembers it', j.ok && C.loadBoardState().optIn === 'joined' && C.loadBoardState().name === 'Rafa_K');
replies.submit_score = { status: 'new_best', first: true, best: 812, place: 6, rank: 3, players: 4, place_before: null };
replies.get_board = reply;
replies.get_my_place = { value: 812, level: 14, rank: 3, place: 6, players: 4, next_value: 864 };
out = await C.postAfterJoin({ board: F, value: 812, level: 14, handle: h }, 'tick-1');
const sub = calls.find((c) => c.name === 'submit_score');
check('…then this very session posts with its ticket, value, session id and level', sub && sub.body.p_ticket === 'tick-1' && sub.body.p_value === 812 && sub.body.p_session_id === h.sessionId && sub.body.p_level === 14);
check('…and the card shows, news (a first score)', out.kind === 'card' && out.news && out.board.hero.line === '6TH PLACE · 3RD OF 4 PLAYERS');
check('the same session finishing again reuses its answer (no second post)', (await C.finishBoardRun({ board: F, value: 812, level: 14, handle: h })) === (await C.finishBoardRun({ board: F, value: 812, level: 14, handle: h })) && calls.filter((c) => c.name === 'submit_score').length === 1);
check('get_board is read without needing the sign-in (it works for anyone)', calls.some((c) => c.name === 'get_board'));
// Joined: straight to the post.
replies.submit_score = { status: 'not_best', best: 812, place: 6, rank: 3, players: 4, place_before: 6 };
h = C.startBoardRun(F);
out = await C.finishBoardRun({ board: F, value: 700, level: 14, handle: h });
check('joined: posts at once; not a best is a card, not news', out.kind === 'card' && !out.news && out.board.hero.line === '6TH PLACE · 3RD OF 4 PLAYERS' && out.board.hero.best === 812);
// Offline at the finish: the score waits on the phone, the card is the phone's copy.
h = C.startBoardRun(F);
await h.ticket;
online = false;
out = await C.finishBoardRun({ board: F, value: 905, level: 14, handle: h });
check('offline at the finish: the cached board with this score, "Goes up when you are back online."', out.kind === 'card' && out.line === 'Goes up when you are back online.' && out.board.rows.find((r) => r.you).value === 905, JSON.stringify(out).slice(0, 200));
check('…kept in the queue, under the account that started it', queue().length === 1 && queue()[0].uid === 'user-1');
online = true;
const nSub = calls.filter((c) => c.name === 'submit_score').length;
await C.flushBoardQueue();
check('back online: the queue goes up and empties', calls.filter((c) => c.name === 'submit_score').length === nSub + 1 && JSON.parse(ls.getItem('tm_score_board_queue_v1')).length === 0);
// Offline at the START: no ticket, the line.
online = false;
h = C.startBoardRun(F);
await h.ticket;
online = true;
out = await C.finishBoardRun({ board: F, value: 800, level: 14, handle: h });
check("offline at START: \"Started offline, so it can't go on the board.\"", out.kind === 'line' && out.line === "Started offline, so it can't go on the board.");
// Signed out: no ticket, no call, the line.
signIn(false);
const before = calls.length;
h = C.startBoardRun(F);
out = await C.finishBoardRun({ board: F, value: 800, level: 14, handle: h });
check('signed out: no network call at all, and the sign-in line', calls.length === before && out.kind === 'line' && out.line === 'Sign in on Profile to put your scores on the world board.');
signIn(true);
// A server error hides the card; a refusal says so plainly.
replies.submit_score = { __status: 500 };
h = C.startBoardRun(F);
out = await C.finishBoardRun({ board: F, value: 800, level: 14, handle: h });
check('a server error: nothing shown', out.kind === 'none');
check('…and the score waits on the phone for another try', queue().length === 1 && queue()[0].sessionId === h.sessionId);
ls.setItem(QUEUE, '[]');
replies.submit_score = { status: 'refused', reason: 'too_early' };
h = C.startBoardRun(F);
out = await C.finishBoardRun({ board: F, value: 800, level: 14, handle: h });
check('a refusal: "The board did not take this one."', out.kind === 'line' && out.line === 'The board did not take this one.');
// NOT NOW, and leaving: no tickets after.
C.saveBoardState({ optIn: null });
replies.get_board_profile = null;
replies.submit_score = { status: 'new_best', first: true, best: 800, place: 5, players: 1 };
h = C.startBoardRun(F);
out = await C.finishBoardRun({ board: F, value: 800, level: 14, handle: h });
const later = C.skipAfterAsk({ board: F, handle: h });
check('NOT NOW: the line, and the phone remembers', out.kind === 'optin' && later.line === 'Join the world board on Profile to post your scores.' && C.loadBoardState().optIn === 'later');
const n0 = calls.length;
h = C.startBoardRun(F);
const afterLater = (await h.ticket).status;
check('after NOT NOW: no ticket asked at START', calls.length === n0 && afterLater === 'later');
replies.leave_boards = { ok: true, scores: 3 };
C.saveBoardState({ optIn: 'joined', name: 'Rafa_K' });
const left = await C.leaveBoards();
check('LEAVE BOARDS: the server deletes, the phone forgets its copies and asks no more tickets', left.ok && left.scores === 3 && C.loadBoardState().optIn === 'later' && ls.getItem('tm_score_boards_cache_v1') === '{}');
replies.join_boards = { ok: false, reason: 'name_taken' };
const bad = await C.joinBoards('Rafa_K', null);
check('a taken name: one plain line', !bad.ok && bad.line === 'That name is taken. Pick another name.');
replies.set_board_profile = { ok: false, reason: 'too_soon', rename_at: '2026-11-30T10:00:00Z' };
const soon = await C.setBoardProfile('NewName', 'US');
check('a second rename in a week: the reason and the day it opens', !soon.ok && soon.reason === 'too_soon' && soon.renameAt === '2026-11-30T10:00:00Z');
replies.join_boards = { ok: false, reason: 'too_soon', rename_at: '2026-11-30T10:00:00Z' };
const rejoin = await C.joinBoards('Other', null);
check('JOIN again inside a rename\'s week (after LEAVE): the day it opens', !rejoin.ok && rejoin.line === 'A name changes once a week. You can join again on Monday, Nov 30.', rejoin.line);

// ── the waiting scores (the offline queue) ───────────────────────────────────
// One session that finished offline, waiting on the phone.
async function queueOne(value) {
  replies.start_board_run = `tick-${value}`;
  const hh = C.startBoardRun(F);
  await hh.ticket;
  online = false;
  await C.finishBoardRun({ board: F, value, level: 14, handle: hh });
  online = true;
  return hh;
}
C.saveBoardState({ optIn: 'joined', name: 'Rafa_K' });
ls.setItem(QUEUE, '[]');
const q1 = await queueOne(880);
check('a waiting score', queue().length === 1 && queue()[0].sessionId === q1.sessionId);
// A flush that fails keeps it: signed out (no call at all), an expired token, too many requests, a server error.
signIn(false);
let nCalls = calls.length;
await C.flushBoardQueue();
check('flush while signed out: the score waits, and nothing is called', queue().length === 1 && calls.length === nCalls);
signIn(true);
for (const status of [401, 404, 429, 500, 503]) {
  replies.submit_score = { __status: status };
  await C.flushBoardQueue();
  check(`flush answered ${status}: the score waits for another try`, queue().length === 1);
}
replies.submit_score = { __status: 400 };
await C.flushBoardQueue();
check('flush answered 400 (a request the server will never take): it drops', queue().length === 0);
await queueOne(881);
replies.submit_score = { status: 'refused', reason: 'ticket_expired' };
await C.flushBoardQueue();
check('flush answered with a refusal: it drops (an answer is final)', queue().length === 0);
// A score that finishes offline while a flush is out is not written over.
const q2 = await queueOne(882);
replies.start_board_run = 'tick-883';
const h3 = C.startBoardRun(F);
await h3.ticket;
let release;
const held = new Promise((res) => { release = res; });
replies.submit_score = async () => { await held; return { status: 'new_best', first: false, best: 882, place: 4, rank: 2, players: 4, place_before: 5 }; };
const sentQ2 = () => calls.filter((c) => c.name === 'submit_score' && c.body.p_session_id === q2.sessionId).length;
const sentBefore = sentQ2();
const flushing = C.flushBoardQueue();
for (let i = 0; i < 50 && sentQ2() === sentBefore; i++) await new Promise((res) => setTimeout(res, 0));
check('…(the flush is out with the first score)', sentQ2() === sentBefore + 1);
online = false;
await C.finishBoardRun({ board: F, value: 883, level: 14, handle: h3 });
online = true;
release();
await flushing;
check('a score queued while a flush was out stays (the flush sent the other)', queue().length === 1 && queue()[0].sessionId === h3.sessionId, JSON.stringify(queue().map((x) => x.value)));
ls.setItem(QUEUE, '[]');

// ── one account's copies ─────────────────────────────────────────────────────
replies.submit_score = { status: 'not_best', best: 812, place: 6, rank: 3, players: 4, place_before: 6 };
C.saveBoardState({ optIn: 'joined', name: 'Rafa_K' });
replies.start_board_run = 'tick-885';
h = C.startBoardRun(F);
await C.finishBoardRun({ board: F, value: 700, level: 14, handle: h });
await queueOne(884);
check('the phone holds user-1\'s name, boards and a waiting score', C.loadBoardState().uid === 'user-1' && C.loadBoardState().name === 'Rafa_K' && Object.keys(JSON.parse(ls.getItem('tm_score_boards_cache_v1'))).length > 0 && queue().length === 1);
account = 'user-2';
const st2 = await C.boardStateNow();
check('another account signed in: the old name and opt-in are not theirs', st2.optIn === null && st2.name === '' && C.loadBoardState().uid === 'user-2');
check("…the old boards' copies (with user-1's place) are gone", ls.getItem('tm_score_boards_cache_v1') === '{}');
nCalls = calls.filter((c) => c.name === 'submit_score').length;
await C.flushBoardQueue();
check("…user-1's waiting score is not sent under user-2", calls.filter((c) => c.name === 'submit_score').length === nCalls && queue().length === 1);
account = 'user-1';
await C.flushBoardQueue();
check('…and goes up when user-1 is back', calls.filter((c) => c.name === 'submit_score').length === nCalls + 1 && queue().length === 0 && calls.at(-1).auth === 'Bearer tok-user-1');
C.saveBoardState({ optIn: 'joined', name: 'Rafa_K' });
C.clearBoardCopies();
check('SIGN OUT clears the name, the opt-in and the boards\' copies', C.loadBoardState().optIn === null && C.loadBoardState().name === '' && ls.getItem('tm_score_boards_cache_v1') === null);
signIn(false);
check('signed out, the phone shows no one on the board', (await C.boardStateNow()).optIn === null);
signIn(true);
const acSrc = fs.readFileSync(path.join(root, 'components/training-mode/AccountCard.jsx'), 'utf8');
check('AccountCard clears them on SIGN OUT and on a sign-out from elsewhere', /clearEntitlementCache\(\); clearBoardCopies\(\); signOut\(\);/.test(acSrc) && /if \(!u && event === 'SIGNED_OUT'\) clearBoardCopies\(\);/.test(acSrc));

// ── JOIN, then the post does not go through: the athlete still hears back ───
async function joinThen(submitReply, boardReply = reply) {
  C.saveBoardState({ optIn: null });
  replies.get_board_profile = null;
  replies.start_board_run = 'tick-join';
  replies.join_boards = { ok: true, name: 'Rafa_K', country: null };
  const hj = C.startBoardRun(F);
  const ask = await C.finishBoardRun({ board: F, value: 812, level: 14, handle: hj });
  await C.joinBoards('Rafa_K', null);
  replies.submit_score = submitReply;
  replies.get_board = boardReply;
  const done = await C.postAfterJoin({ board: F, value: 812, level: 14, handle: hj }, ask.ticket);
  replies.get_board = reply;
  return { ask, done, hj };
}
ls.setItem(QUEUE, '[]');
let jt = await joinThen({ __status: 500 });
check('JOIN, then a server error on the post: a line, not nothing', jt.ask.kind === 'optin' && jt.done.kind === 'line' && jt.done.line === "You're on the world board. This score tries again next time you open the app.", JSON.stringify(jt.done));
check('…and the score waits on the phone for that try', queue().length === 1 && queue()[0].sessionId === jt.hj.sessionId);
ls.setItem(QUEUE, '[]');
jt = await joinThen({ status: 'refused', reason: 'too_early' });
check('JOIN, then a refused post: on the board, this score did not go up', jt.done.kind === 'line' && jt.done.line === "You're on the world board. This score did not go up." && queue().length === 0);
jt = await joinThen({ status: 'new_best', first: true, best: 812, place: 6, rank: 3, players: 4, place_before: null }, { __status: 503 });
check('JOIN, the post taken but the board not readable: on the board with this score', jt.done.kind === 'line' && jt.done.line === "You're on the world board with this score.");
jt = await joinThen({ status: 'new_best', first: true, best: 812, place: 6, rank: 3, players: 4, place_before: null });
check('JOIN, all well: the card (and the full board)', jt.done.kind === 'card' && jt.done.news);

// ── the switch ───────────────────────────────────────────────────────────────
const { retentionOn } = await import('../components/training-mode/data/retentionFlags.js');
ls.removeItem('tm_owner_preview');
check("the 'scores' switch is off for everyone", retentionOn('scores') === false);
ls.setItem('tm_owner_preview', '1');
check('…and on with the owner preview', retentionOn('scores') === true);
const appSrc = fs.readFileSync(path.join(root, 'components/training-mode/App.jsx'), 'utf8');
check('App asks for no ticket and posts nothing with the switch off (every path checks scoresOn)', /if \(!scoresOn \|\| !c\) return;/.test(appSrc) && /if \(!scoresOn \|\| !run/.test(appSrc) && /if \(!scoresOn \|\| typeof window/.test(appSrc));

// ── the migration is the app's data today ────────────────────────────────────
let fresh = true;
try { execFileSync(process.execPath, ['--no-warnings', '--import', './scripts/extensionless-loader-register.mjs', 'scripts/score-board-rules.mjs', '--check'], { cwd: root, stdio: 'pipe' }); } catch (e) { fresh = false; console.log(String(e.stdout || ''), String(e.stderr || '')); }
check("the migration's generated rows match the app's data (scripts/score-board-rules.mjs --check)", fresh);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
