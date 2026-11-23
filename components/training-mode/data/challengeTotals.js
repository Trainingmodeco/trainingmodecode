// Fit Challenge · the WORKOUT CARD's arithmetic, in one pure module (no React,
// no storage), so the card, the CHECK-OFF tracker and the results screen can
// never count differently.
//
// A move is { reps } (a rep move) or { seconds } (a timed move: a hold, a
// carry). A timed move is counted in seconds and never in reps, so a 30 s hold
// adds nothing to the reps and its seconds are shown on their own ("+ 30s
// hold"). Every round runs the same list of moves.
//
//   challengeTotals(moves, rounds)  reps a round, rounds, total reps, the timed
//                                   seconds, and how long it takes (about)
//   tickProgress(moves, ticks)      a ticks grid (ticks[round][move]): rounds
//                                   done (a round counts only when every move
//                                   in it is ticked), reps and seconds done and
//                                   left, the share of the work done
//   swapMove / withoutBar           one move replaced (nothing else changes) /
//                                   every bar move replaced by its no-bar move
//   patternCounts / balanceLine     the push / pull / legs / core / arms mix
//
// The time is an estimate for the card ("about 27 min"), not a clock: a rep at
// the athlete's own pace (EST.repSec), a short change between moves, and a
// rest between rounds. Wiring it into Quick Mission would read the run's own
// model (data/quickMissionTiming, soloFromGenerated's pace tiers) instead, so
// the card, XP and the too-fast floor all agree.

export const ROUND_CHOICES = [2, 3, 4, 5];
export const EST = { repSec: 3, switchSec: 10, roundRestSec: 60 };

const num = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : 0);

// A move with seconds and no reps is timed.
export const isTimed = (m) => !!m && num(m.seconds) > 0 && !(num(m.reps) > 0);

export function moveAmount(m) {
  return isTimed(m) ? { reps: 0, seconds: num(m.seconds) } : { reps: num(m?.reps), seconds: 0 };
}

// One round's work: reps from the rep moves, seconds from the timed ones.
export function roundTotals(moves) {
  const list = Array.isArray(moves) ? moves : [];
  let reps = 0;
  let seconds = 0;
  for (const m of list) {
    const a = moveAmount(m);
    reps += a.reps;
    seconds += a.seconds;
  }
  return { moves: list.length, reps, seconds };
}

export function clampRounds(r) {
  const n = Math.round(Number(r));
  if (!Number.isFinite(n)) return ROUND_CHOICES[0];
  return Math.min(ROUND_CHOICES[ROUND_CHOICES.length - 1], Math.max(ROUND_CHOICES[0], n));
}

// About how long the whole workout takes, in seconds.
export function estimateSeconds(moves, rounds, opts = {}) {
  const { repSec, switchSec, roundRestSec } = { ...EST, ...opts };
  const per = roundTotals(moves);
  const r = Math.max(0, Math.round(Number(rounds) || 0));
  if (!per.moves || !r) return 0;
  const roundSec = per.reps * repSec + per.seconds + Math.max(0, per.moves - 1) * switchSec;
  return r * roundSec + Math.max(0, r - 1) * roundRestSec;
}

export function challengeTotals(moves, rounds, opts = {}) {
  const per = roundTotals(moves);
  const r = Math.max(0, Math.round(Number(rounds) || 0));
  const estSeconds = estimateSeconds(moves, r, opts);
  return {
    rounds: r,
    moves: per.moves,
    repsPerRound: per.reps,
    secondsPerRound: per.seconds,
    totalReps: per.reps * r,
    totalSeconds: per.seconds * r,
    estSeconds,
    estMinutes: estSeconds ? Math.max(1, Math.round(estSeconds / 60)) : 0,
    restSeconds: { ...EST, ...opts }.roundRestSec,
  };
}

// ── the CHECK-OFF tracker ─────────────────────────────────────────────────────

export function emptyTicks(rounds, moveCount) {
  const r = Math.max(0, Math.round(Number(rounds) || 0));
  const n = Math.max(0, Math.round(Number(moveCount) || 0));
  return Array.from({ length: r }, () => Array(n).fill(false));
}

// A new grid with one cell set (toggled when `on` is not given).
export function setTick(ticks, round, move, on) {
  return ticks.map((row, r) => (r !== round ? row : row.map((v, i) => (i !== move ? v : on === undefined ? !v : !!on))));
}

// A round counts only when every move in it is ticked.
export const roundComplete = (row) => Array.isArray(row) && row.length > 0 && row.every(Boolean);

export function tickProgress(moves, ticks) {
  const list = Array.isArray(moves) ? moves : [];
  const grid = Array.isArray(ticks) ? ticks : [];
  const totals = challengeTotals(list, grid.length);
  let repsDone = 0;
  let secondsDone = 0;
  let ticked = 0;
  grid.forEach((row) => row.forEach((on, i) => {
    if (!on || !list[i]) return;
    ticked++;
    const a = moveAmount(list[i]);
    repsDone += a.reps;
    secondsDone += a.seconds;
  }));
  const roundsDone = grid.filter(roundComplete).length;
  const open = grid.findIndex((row) => !roundComplete(row));
  const cells = grid.length * list.length;
  return {
    rounds: grid.length,
    roundsDone,
    currentRound: open === -1 ? null : open + 1, // 1-based; null once every round is done
    ticked,
    cells,
    pct: cells ? Math.round((ticked / cells) * 100) : 0,
    repsDone,
    repsLeft: totals.totalReps - repsDone,
    secondsDone,
    secondsLeft: totals.totalSeconds - secondsDone,
    done: grid.length > 0 && roundsDone === grid.length,
    totals,
  };
}

// ── the moves ────────────────────────────────────────────────────────────────

// One move replaced; every other move is the same object as before.
export function swapMove(moves, index, next) {
  return moves.map((m, i) => (i === index ? next : m));
}

// Without a pull-up bar: every bar move becomes its no-bar move, marked with
// what it stands in for (the card shows a NO BAR tag).
export function withoutBar(moves) {
  return moves.map((m) => (m?.bar && m.noBar ? { ...m.noBar, noBarFor: m.name } : m));
}

export const PATTERNS = ['push', 'pull', 'legs', 'core', 'arms'];
// The balanced full-body deal: 3 push, 2 pull, 1 legs, 1 core, 1 accessory (arms).
export const FULL_BODY_RECIPE = { push: 3, pull: 2, legs: 1, core: 1, arms: 1 };

export function patternCounts(moves) {
  const out = Object.fromEntries(PATTERNS.map((p) => [p, 0]));
  for (const m of moves || []) if (m?.pattern in out) out[m.pattern]++;
  return out;
}

export function isBalanced(moves, recipe = FULL_BODY_RECIPE) {
  const c = patternCounts(moves);
  return PATTERNS.every((p) => (c[p] || 0) === (recipe[p] || 0));
}

// "3 push · 2 pull · legs · core · arms": a pattern with one move needs no number.
export function balanceLine(moves) {
  const c = patternCounts(moves);
  return PATTERNS.filter((p) => c[p]).map((p) => (c[p] > 1 ? `${c[p]} ${p}` : p)).join(' · ');
}

// ── words ────────────────────────────────────────────────────────────────────

export function mmss(sec) {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
}

// A hold: "30s" under a minute, "2:00" from a minute.
export const holdWord = (sec) => (sec < 60 ? `${sec}s` : mmss(sec));

// A move's dose as the card prints it: "12 reps" or "30s".
export const doseWord = (m) => (isTimed(m) ? holdWord(num(m.seconds)) : `${num(m?.reps)} reps`);
