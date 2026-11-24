// The score board's rule and the looks' sample boards (RETENTION-PLAN.md:
// the game-over score board, built owner-only once the owner approves its
// server design, public with the rest in January). LOOKS ONLY: nothing here is
// wired into a session, nothing is sent anywhere, no switch turns it on. The
// server design is docs/retention/SCOREBOARD-DESIGN.md.
//
// A board is one mode at one setting ("Fight Focus · Boxing · 3 × 3 min, 60 s
// rest · Normal"), so every score on it was made under the same conditions. Ten
// places. While a board has fewer than 5 real players, CPU house scores fill
// the empty places and real players rank among them; from 5 real players on,
// a house score stays only below the lowest real score, so they fade out as
// people join. A house row is always tagged CPU and never stored as a player.

import { ORD } from './scoreFormat';

export const BOARD_SIZE = 10;
export const FADE_AT = 5;

// House names are gym and track equipment, in capitals: things, never people,
// so a house row cannot be read as a real athlete even before its CPU tag is
// seen. They are reserved (no player may take one as a display name), and the
// same twelve sit on every board of a kind, so regulars learn them ("beat the
// HEAVY BAG"). Ten letters at most: a row stays one line on a 360 phone.
export const HOUSE_NAMES = {
  fight: ['HEAVY BAG', 'SPEED BAG', 'DOUBLE END', 'FOCUS MITT', 'THAI PADS', 'WATER BAG', 'SLIP ROPE', 'BODY PAD', 'WALL PAD', 'JUMP ROPE', 'HAND WRAP', 'MOUTHGUARD'],
  fit: ['KETTLEBELL', 'SANDBAG', 'BARBELL', 'MED BALL', 'DUMBBELL', 'TRAP BAR', 'PLYO BOX', 'CHIN BAR', 'SLED', 'AB WHEEL', 'YOGA MAT', 'IRON PLATE'],
  run: ['TREADMILL', 'STOPWATCH', 'PACE CLOCK', 'START GUN', 'LAP TIMER', 'MILE POST', 'HURDLE', 'STEP BOX', 'WATER CUP', 'WHISTLE', 'LANE LINE', 'CONE'],
};

// A spread of levels for the twelve house rungs, best rung highest: every
// tier colour shows on a fresh board, from Champion down to Rookie.
export const HOUSE_LEVELS = [26, 23, 20, 17, 14, 12, 10, 8, 6, 4, 3, 2];

// The house rows for a board: its names, its fixed ladder of twelve values
// (best first) and the level spread. Never stored, never a player.
export function houseRows(kind, ladder) {
  const names = HOUSE_NAMES[kind] || HOUSE_NAMES.fit;
  return ladder.slice(0, 12).map((value, i) => ({ name: names[i], level: HOUSE_LEVELS[i], value, cpu: true }));
}

// The ten rows of a board, in order, with their places. `real` is the board's
// real players, best first or not (`at` breaks a tie: whoever set it first);
// `players` is how many real players the board has in all (a busy board passes
// only its top few). `lower`: a timed board, where less is better. A CPU row
// ranks under a real player on the same score.
//
// Two numbers, kept apart: `place` is the row's place on the list, CPU rows
// included (arcade style, the owner's "real players rank among them": beat a
// house score and you move up a place); `rank` is a real player's rank among
// the players only, so a house score is never counted as a player. From
// FADE_AT players on, house rows sit only under the lowest real score, so the
// two are the same for everyone.
export function composeBoard({ real = [], house = [], lower = false, players = real.length, size = BOARD_SIZE, fadeAt = FADE_AT }) {
  const better = (a, b) => (lower ? a.value - b.value : b.value - a.value);
  const ranked = [...real].sort((a, b) => better(a, b) || (a.at || 0) - (b.at || 0)).map((r, i) => ({ ...r, rank: i + 1 }));
  let cpu = house.map((h) => ({ ...h, cpu: true }));
  if (players >= fadeAt && ranked.length) {
    const lowest = ranked[ranked.length - 1].value;
    cpu = cpu.filter((h) => (lower ? h.value > lowest : h.value < lowest));
  }
  const all = [...ranked, ...cpu].sort((a, b) => better(a, b) || (a.cpu ? 1 : 0) - (b.cpu ? 1 : 0) || (a.at || 0) - (b.at || 0));
  return all.slice(0, size).map((r, i) => ({ ...r, place: i + 1 }));
}

// The YOUR SCORE line under the hero: the place on the list, and, while CPU
// rows sit above you, your rank among the players too ("6TH PLACE · 3RD OF 4
// PLAYERS"), so the place is never read as a world rank that counts a CPU.
export function placeLine(rows, players) {
  const me = rows.find((r) => r.you);
  if (!me) return null;
  const place = `${ORD(me.place)} PLACE`;
  if (players <= 1) return `${place} · FIRST PLAYER ON THIS BOARD`;
  const cpuAhead = rows.some((r) => r.cpu && r.place < me.place);
  const of = `${players.toLocaleString('en-US')} PLAYERS`;
  return cpuAhead ? `${place} · ${ORD(me.rank)} OF ${of}` : `${place} · ${of}`;
}

const t = (m, s = 0) => m * 60 + s;
const rr = (rounds, reps) => rounds * 1000 + reps;

// ── the sample boards (names are sample handles, no real people) ───────────

// Fight Focus, a beta board: 4 real players among the house rows, and a new
// best that lands 6th on the list, 3rd of the 4 players. STRIKES = strikes
// the phone counted (motion on). A fight board is one of a few fixed settings,
// rest included (SCOREBOARD-DESIGN.md: 3 x 3 min or 5 x 3 min, 60 s rest).
const FIGHT_LADDER = [1008, 936, 864, 792, 720, 648, 576, 504, 432, 360, 300, 240];
const FIGHT_ROWS = composeBoard({
  real: [
    { name: 'Rafa_K', level: 22, value: 951, cc: 'BR', at: 1 },
    { name: 'Mina', level: 17, value: 868, at: 2 },
    { name: 'Trainee', level: 14, value: 812, you: true, newBest: true, at: 9 },
    { name: 'Dre', level: 7, value: 640, cc: 'US', at: 3 },
  ],
  house: houseRows('fight', FIGHT_LADDER),
});
export const FIGHT_TOP10 = {
  id: 'fight-top10',
  mode: 'FIGHT FOCUS · BOXING', setting: '3 × 3 MIN · 60 S REST · NORMAL', beta: true,
  kind: 'count', unit: 'STRIKES', unitLong: 'STRIKES ✓',
  rows: FIGHT_ROWS,
  you: null,
  hero: { value: 812, newBest: true, was: 744, line: placeLine(FIGHT_ROWS, 4) },
};

// Max Out, a brand-new board: you are its first real player, 4th on the list.
// BETA: a Max Out score is typed, so its board opens marked until the caps
// are checked against real sessions (the fight boards too, for the counter).
const BOSS_LADDER = [262, 244, 226, 210, 195, 180, 165, 150, 135, 120, 105, 90];
const BOSS_ROWS = composeBoard({
  real: [{ name: 'Trainee', level: 14, value: 214, you: true, newBest: true, at: 1 }],
  house: houseRows('fit', BOSS_LADDER),
});
export const BOSS_EARLY = {
  id: 'boss-early',
  mode: 'MAX OUT · BOSS RUSH', setting: 'STANDARD · 3 ROUNDS', beta: true,
  kind: 'count', unit: 'REPS', unitLong: 'TOTAL REPS',
  rows: BOSS_ROWS,
  you: null,
  hero: { value: 214, newBest: true, first: true, line: placeLine(BOSS_ROWS, 1) },
};

// Quick Mission SOLO, a busy board: 2,310 players, the house rows long gone,
// you outside the top 10.
export const ROOM_BUSY = {
  id: 'room-busy',
  mode: 'QUICK MISSION · ROOM 12', setting: 'STANDARD · AMRAP 12',
  kind: 'roundsReps', unit: 'SCORE', unitLong: 'ROUNDS + REPS',
  rows: composeBoard({
    players: 2310,
    real: [
      { name: 'Kenji.T', level: 31, value: rr(14, 6), cc: 'JP', at: 1 },
      { name: 'Noor', level: 26, value: rr(13, 29), at: 2 },
      { name: 'Ola', level: 24, value: rr(13, 12), cc: 'NG', at: 3 },
      { name: 'Sam W', level: 19, value: rr(12, 40), cc: 'GB', at: 4 },
      { name: 'Tess', level: 21, value: rr(12, 22), at: 5 },
      { name: 'Big Lu', level: 16, value: rr(12, 8), cc: 'PH', at: 6 },
      { name: 'Rafa_K', level: 22, value: rr(11, 36), cc: 'BR', at: 7 },
      { name: 'Mina', level: 17, value: rr(11, 30), at: 8 },
      { name: 'Iker', level: 12, value: rr(11, 16), cc: 'MX', at: 9 },
      { name: 'Dre', level: 9, value: rr(11, 4), cc: 'US', at: 10 },
    ],
    house: houseRows('fit', [rr(13, 10), rr(12, 30), rr(12, 4), rr(11, 20), rr(10, 40), rr(10, 8), rr(9, 22), rr(8, 30), rr(7, 18), rr(6, 20), rr(5, 30), rr(4, 40)]),
  }),
  // The board keeps your best (10 + 25), not today's 10 + 18; #142 holds 10 + 27.
  you: { place: 143, of: 2310, level: 14, value: rr(10, 25), next: 'Next place: 3 more reps' },
  hero: { value: rr(10, 18), best: rr(10, 25), line: '7 REPS SHORT OF YOUR BEST' },
};

// An arcade stage, timed: less is better. 3 real players among the house; a
// new best lands 4th on the list, 2nd of the 3 players. An arcade board is
// one stage on one side (fit, fight or both), and its time counts pauses.
const STAGE_LADDER = [t(11, 40), t(12, 30), t(13, 20), t(14, 10), t(15), t(16), t(17, 10), t(18, 20), t(19, 40), t(21), t(22, 30), t(24)];
const STAGE_ROWS = composeBoard({
  lower: true,
  real: [
    { name: 'Noor', level: 26, value: t(12, 12), at: 1 },
    { name: 'Trainee', level: 14, value: t(13, 5), you: true, newBest: true, at: 5 },
    { name: 'Kenji.T', level: 31, value: t(16, 30), cc: 'JP', at: 2 },
  ],
  house: houseRows('fit', STAGE_LADDER),
});
export const STAGE_TIME = {
  id: 'stage-time',
  mode: 'ARCADE · ONE HUNDRED', setting: 'STAGE 3 · FIT',
  kind: 'time', unit: 'TIME', unitLong: 'STAGE TIME',
  rows: STAGE_ROWS,
  you: null,
  hero: { value: t(13, 5), newBest: true, was: t(13, 48), line: placeLine(STAGE_ROWS, 3) },
};

// A run, 6 real players: the house rows now sit only under the slowest one.
const RUN_LADDER = [t(17, 30), t(19), t(20, 30), t(22), t(23, 30), t(25), t(26, 30), t(28), t(30), t(32, 30), t(35), t(38)];
const RUN_ROWS = composeBoard({
  lower: true,
  real: [
    { name: 'Ola', level: 24, value: t(18, 42), cc: 'NG', at: 1 },
    { name: 'Tess', level: 21, value: t(21, 15), at: 2 },
    { name: 'Trainee', level: 14, value: t(22, 48), you: true, at: 3 },
    { name: 'Sam W', level: 19, value: t(24, 5), cc: 'GB', at: 4 },
    { name: 'Big Lu', level: 16, value: t(25, 52), cc: 'PH', at: 5 },
    { name: 'Dre', level: 9, value: t(26, 40), cc: 'US', at: 6 },
  ],
  house: houseRows('run', RUN_LADDER),
});
export const RUN_FADE = {
  id: 'run-fade',
  mode: 'CARDIO · RUN', setting: '5 KM · GPS',
  kind: 'time', unit: 'TIME', unitLong: 'RUN TIME',
  rows: RUN_ROWS,
  you: null,
  hero: { value: t(22, 48), line: placeLine(RUN_ROWS, 6) },
};
