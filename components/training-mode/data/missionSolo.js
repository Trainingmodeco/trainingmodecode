// Quick Mission · estimates, integrity sizing, the SOLO clock, pace and XP.
//
// Pure maths over a mission ({ exercises, finisherExercises, rounds }, plus
// the v2 fields from loadoutMissions). Two jobs:
//   · GUIDED (every Quick Mission, ungated): size the integrity limit to the
//     mission, unit-aware, so a 55-minute classic is not VALIDATION FAILED.
//   · SOLO (v2): the one-clock timeline, pace targets, the score prefill and
//     the honor-system XP settle.
import { moveById, estMsFor, slotDose, mmss, LEVEL_LABEL } from './missionMoves';
import { MODE_RULES } from '../utils/missionIntegrity';

// Seconds per unit when a rep is a distance or a calorie (Murph's mile; M is
// HOT LAPS' 400 m, at the KM pace).
export const UNIT_SEC = { MILE: 600, 'HALF MILE': 300, KM: 375, M: 0.375, CAL: 3.3 };
// A distance is never a rep in a score, and neither is a slot authored
// `scored: false` (HOT LAPS' run row), whatever move a swap puts in it: a
// capped HOT LAPS counts its swings and pull-ups, never its metres, rowed
// calories or high knees.
const DISTANCE = new Set(['MILE', 'HALF MILE', 'KM', 'M']);

const allSlots = (mission) => [...(mission?.exercises || []), ...(mission?.finisherExercises || [])];
const hasList = (slot) => Array.isArray(slot?.list);
const rounds = (mission) => Math.max(1, mission?.rounds || 1);
const scoredReps = (it) => (it?.scored === false || DISTANCE.has(it?.unit) ? 0 : it?.reps || 0);
const sumReps = (list) => (list || []).reduce((s, x) => s + scoredReps(x), 0);
// A ladder: a for-time mission whose every slot is a complex, one rung each
// (21-15-9, BURNOUT 21, CONTINUE? · BELL). SOLO counts its rungs as rounds.
const isLadder = (mission) => mission?.format === 'forTime' && allSlots(mission).length > 0 && allSlots(mission).every(hasList);

// ── until the bell is down (NO CONTINUES) ───────────────────────────────────
// A mission flagged `untilDown` has no set length. A SET is one of its
// blocks; the blocks cycle until the bell touches the floor and the athlete
// taps I PUT IT DOWN, which FINISHES the run with the sets done (never a
// quit, never a partial). capSec is a safety cap that ends it the same way.
// Every untilDown branch below is the first thing its function checks, so a
// mission without the flag never reaches one.
export function isUntilDown(mission) { return mission?.untilDown === true; }
// Reps in one set: the biggest block (they match unless a swap scaled one).
export function repsPerSet(mission) {
  return allSlots(mission).reduce((n, sl) => Math.max(n, hasList(sl) ? sumReps(sl.list) : scoredReps(sl)), 0);
}
// The block set n (0-based) runs: both hands, left arm, right arm, round again.
export function setBlock(mission, n) {
  const slots = allSlots(mission);
  return slots.length ? slots[Math.max(0, Math.floor(Number(n) || 0)) % slots.length] : null;
}
// SOLO's honor-system floor for one set: half its reps at the elite count.
// A run claiming more sets than its time allows is paid for the sets that fit.
export function soloSetFloorSec(mission) {
  const secs = allSlots(mission).map(sl => (hasList(sl) ? sl.list : [sl]).reduce((n, it) => n + (it.reps || 0) * estMsFor(it.moveId, 'elite') / 1000, 0));
  return Math.max(1, Math.ceil(0.5 * (secs.length ? Math.min(...secs) : 0)));
}
export const DOWN_NO_SET_MESSAGE = 'Finish one set to earn XP.';
export const DOWN_STOP_MESSAGE = 'Ended with no score. I PUT IT DOWN saves your sets.';
// The XP for an untilDown run: 15 a set done plus the finish bonus, the
// same as a guided run that finished every slot it ran.
export function downXp(sets) { return sets > 0 ? 15 * sets + 30 : 0; }

// ── estimates ───────────────────────────────────────────────────────────────
// The working seconds of one slot, without its rest.
export function estimateWorkSeconds(slot) {
  if (!slot) return 0;
  const setupSec = (slot.setupMs ?? 0) / 1000;
  if (slot.mode === 'timed') return slot.work || 0;
  if (hasList(slot)) {
    return slot.list.reduce((s, st) => s + (st.reps || 0) * (st.cadenceMs ?? estMsFor(st.moveId)) / 1000, 0) + setupSec;
  }
  const perRep = slot.unit && slot.unit in UNIT_SEC ? UNIT_SEC[slot.unit]
    : slot.cadenceMs != null ? slot.cadenceMs / 1000
      : slot.moveId ? estMsFor(slot.moveId) / 1000 : 2.5;
  const switchSec = slot.sides === 'switch' ? (moveById(slot.moveId)?.switchMs ?? 0) / 1000 : 0;
  return (slot.reps || 0) * perRep + switchSec + setupSec;
}
export function estimateSlotSeconds(slot) {
  if (!slot) return 0;
  if (slot.window) return Math.max(slot.window, estimateWorkSeconds(slot) + 5);
  if (slot.mode === 'timed') return (slot.work || 0) + (slot.rest || 0) + 3;
  return estimateWorkSeconds(slot) + (slot.rest || 0) + 5;
}
export function estimateMissionSeconds(mission) {
  return allSlots(mission).reduce((s, slot) => s + estimateSlotSeconds(slot), 0) * (mission?.rounds || 1);
}
export function estimateRoundSeconds(mission) { return estimateMissionSeconds(mission) / Math.max(1, mission?.rounds || 1); }

// ── integrity (GUIDED) ──────────────────────────────────────────────────────
export function qmMaxValidSeconds(mission) { return Math.max(600, Math.ceil(1.5 * estimateRoundSeconds(mission)) + 60); }
export function qmIntegrityRules(mission) { return { ...MODE_RULES.quickMission, maxValidSeconds: qmMaxValidSeconds(mission) }; }
// The units this mount will open: a resume never reopens the current round's unit.
export function qmTotalUnits(mission, resume = null) {
  if (resume == null) return Math.max(1, mission?.rounds || 1);
  return Math.max(1, (mission?.rounds || 1) - (resume.round || 1));
}

// ── the clock ───────────────────────────────────────────────────────────────
export function isFixedClock(format) { return format === 'emom' || format === 'amrap' || format === 'intervals'; }
// An EMOM's windows are a minute unless a slot says otherwise (FIRST BELL's
// swings: one set every :30), and a slot's `restAfter` puts a rest between
// two blocks of windows (FIRST BELL's 1:00 before the get-ups). Like an
// interval's last rest, a restAfter on the very last window is never run.
export function missionClockSec(mission) {
  if (isUntilDown(mission)) return mission.capSec || 0; // the safety cap
  const f = mission?.format;
  if (f === 'forTime') return mission.capSec || 0;
  const slots = allSlots(mission);
  if (f === 'emom') {
    const perRound = slots.reduce((s, sl) => s + (sl.window || 60) + (sl.restAfter || 0), 0);
    const finalRest = slots.length ? slots[slots.length - 1].restAfter || 0 : 0;
    return rounds(mission) * perRound - finalRest;
  }
  if (f === 'amrap' || f === 'intervals') {
    const perRound = slots.reduce((s, sl) => s + (sl.work || 0) + (sl.rest || 0), 0);
    const finalRest = slots.length ? slots[slots.length - 1].rest || 0 : 0;
    return Math.max(0, perRound * rounds(mission) - finalRest);
  }
  return 0;
}

// SOLO's one clock, cut into segments. Segment = { kind: 'work'|'rest', sec,
// label, swapKey|null, stepKeys, calls, block }. `block` is the 0-based round
// index (an AMRAP block indexes blockTaps with it). Empty for forTime.
//
// EMOM labels count the windows of one length in a row: MIN 1…16 when every
// window is a minute (every mission before FIRST BELL), SET 1…10 for :30
// windows, and the count starts again after a length change or a restAfter.
export function soloTimeline(mission) {
  const f = mission?.format;
  if (isUntilDown(mission) || !isFixedClock(f)) return [];
  const slots = allSlots(mission);
  const n = rounds(mission);
  const out = [];
  const rest = (sec, block) => ({ kind: 'rest', sec, label: 'REST', swapKey: null, stepKeys: [], calls: [], block });
  let run = { window: null, count: 0 };
  for (let r = 1; r <= n; r += 1) {
    slots.forEach((slot, i) => {
      const block = r - 1;
      const stepKeys = hasList(slot) ? slot.list.map(s => s.swapKey) : [];
      const calls = (slot.calls || []).map(c => ({ ...c }));
      const last = r === n && i === slots.length - 1;
      if (f === 'emom') {
        const sec = slot.window || 60;
        if (sec !== run.window) run = { window: sec, count: 0 };
        run.count += 1;
        const head = `${sec === 60 ? 'MIN' : 'SET'} ${run.count}`;
        const label = hasList(slot)
          ? `${head} · ${String(slot.sideSay || slot.name || '').toUpperCase()}`
          : `${head} · ${slotDose(slot)} ${slot.name}`;
        out.push({ kind: 'work', sec, label, swapKey: hasList(slot) ? null : slot.swapKey ?? null, stepKeys, calls, block });
        if (!last && (slot.restAfter || 0) > 0) { out.push(rest(slot.restAfter, block)); run = { window: null, count: 0 }; }
        return;
      }
      if (f === 'amrap' && hasList(slot)) {
        out.push({ kind: 'work', sec: slot.work || 0, label: n === 1 ? 'AMRAP' : `BLOCK ${r}/${n}`, swapKey: null, stepKeys, calls, block });
      } else {
        out.push({ kind: 'work', sec: slot.work || 0, label: slot.name, swapKey: slot.swapKey ?? null, stepKeys, calls, block });
      }
      if (!last && (slot.rest || 0) > 0) out.push(rest(slot.rest, block));
    });
  }
  return out;
}
export function segmentAt(timeline, elapsedSec) {
  let start = 0;
  for (let index = 0; index < (timeline || []).length; index += 1) {
    const segment = timeline[index];
    if (elapsedSec < start + segment.sec) return { index, segment, startSec: start, remainingSec: start + segment.sec - elapsedSec };
    start += segment.sec;
  }
  return null;
}

// ── score and pace ──────────────────────────────────────────────────────────
// Reps in one round of the score: one pass of the AMRAP list, or one round of
// a for-time mission (a ladder's round is all its rungs). Distances and
// `scored: false` slots never count.
export function repsPerRound(mission) {
  const slots = allSlots(mission);
  if (mission?.format === 'amrap') {
    const block = slots.find(hasList);
    return block ? sumReps(block.list) : 0;
  }
  return slots.reduce((s, sl) => s + (hasList(sl) ? sumReps(sl.list) : sl.mode === 'reps' ? scoredReps(sl) : 0), 0);
}
// The rounds SOLO's + ROUND counts for a for-time mission: a ladder's rungs,
// anything else its rounds.
export function soloRounds(mission) {
  if (isUntilDown(mission)) return totalSlots(mission); // sets, up to the backstop
  return isLadder(mission) ? rounds(mission) * allSlots(mission).length : rounds(mission);
}
// The reps done after n of SOLO's rounds (the cap's prefill): n full rounds,
// a ladder's first n rungs, or n rounds of an AMRAP whose every step climbs
// by `climb` a round (CHARGE UP 12: 2 + 2, then 4 + 4…).
export function repsThrough(mission, n) {
  const k = Math.max(0, Math.floor(Number(n) || 0));
  const slots = allSlots(mission);
  if (isUntilDown(mission)) return k * repsPerSet(mission);
  if (isLadder(mission)) {
    let total = 0;
    for (let i = 0; i < k; i += 1) total += sumReps(slots[i % slots.length].list);
    return total;
  }
  if (mission?.format === 'amrap') {
    const block = slots.find(hasList);
    if (!block) return 0;
    return k * sumReps(block.list) + (block.climb || 0) * block.list.length * ((k * (k - 1)) / 2);
  }
  return k * repsPerRound(mission);
}
// The windows a minutesHeld score is out of: every EMOM window (FIRST BELL's
// :30 sets count one each), else the clock's minutes.
export function heldOf(mission) {
  if (mission?.format === 'emom') return rounds(mission) * allSlots(mission).length;
  return Math.round(missionClockSec(mission) / 60);
}
export function paceTargets(mission) {
  const pace = mission?.pace || {};
  const f = mission?.format;
  const kind = mission?.scoreRule?.kind;
  return ['elite', 'standard', 'beginner'].map(tier => {
    const v = pace[tier];
    let text = '';
    if (isUntilDown(mission)) text = tier === 'elite' ? `${v}+ sets` : `${v} sets`;
    else if (f === 'forTime') text = `≤ ${mmss(v)}`;
    else if (f === 'amrap' && kind === 'reps') text = tier === 'elite' ? `${v}+ reps` : `${v} reps`; // an AMRAP scored in total reps
    else if (f === 'amrap') text = tier === 'elite' ? `${v}+ rounds` : `${v} rounds`;
    else if (f === 'emom') text = `${v?.held}/${v?.of}${v?.setSec ? ` · sets ≤ ${v.setSec}s` : ''}`;
    else text = tier === 'elite' ? `${v}+` : `${v}`;
    return { tier, label: LEVEL_LABEL[tier], text };
  });
}
// What a slot's pace count would reach in its work: floor(work / cadence).
// A slot with no count (manual, null cadence) contributes 0.
const countedIn = (slot) => (typeof slot.cadenceMs === 'number' && slot.cadenceMs > 0 ? Math.floor(((slot.work || 0) * 1000) / slot.cadenceMs) : 0);
export function prefillScore(mission, { roundTaps = 0, blockTaps = null } = {}) {
  const rule = mission?.scoreRule || {};
  if (rule.kind === 'setsReps') return { sets: roundTaps, reps: 0 }; // untilDown: the + SET taps
  if (rule.kind === 'roundsReps') {
    const n = mission.rounds || 1;
    if (n <= 1) return { rounds: roundTaps, reps: 0 };
    const blocks = Array.from({ length: n }, (_, b) => ({ rounds: blockTaps?.[b] ?? 0, reps: 0 }));
    return { blocks, rounds: blocks.reduce((s, b) => s + b.rounds, 0), reps: 0 };
  }
  if (rule.kind === 'minutesHeld') return heldOf(mission);
  // An AMRAP scored in total reps: the reps through the rounds tapped.
  if (rule.kind === 'reps' && mission.format === 'amrap') return repsThrough(mission, roundTaps);
  if (rule.kind === 'reps') {
    const keys = rule.keys || [];
    const slots = allSlots(mission).filter(s => keys.includes(s.swapKey));
    if (rule.agg === 'lowest') {
      return keys.reduce((sum, k) => {
        const own = slots.filter(s => s.swapKey === k).map(countedIn);
        return sum + (own.length ? Math.min(...own) : 0);
      }, 0);
    }
    return (mission.rounds || 1) * slots.reduce((s, sl) => s + countedIn(sl), 0);
  }
  return null;
}

// ── XP ──────────────────────────────────────────────────────────────────────
export function totalSlots(mission) { return allSlots(mission).length * (mission?.rounds || 1); }
export function fullRunXp(mission) { return 15 * totalSlots(mission) + 30; }
export function soloExpectedSec(mission) {
  if (isUntilDown(mission)) return mission.capSec || 0;
  if (isFixedClock(mission?.format)) return missionClockSec(mission);
  const std = mission?.pace?.standard;
  const cap = mission?.capSec || 0;
  return typeof std === 'number' && cap ? Math.min(std, cap) : (std || cap || 0);
}
export function soloFloorSec(mission) {
  if (isUntilDown(mission)) return soloSetFloorSec(mission);
  if (isFixedClock(mission?.format)) return Math.ceil(0.95 * missionClockSec(mission));
  return Math.ceil(0.5 * (mission?.pace?.elite || 0));
}
export const TOO_FAST_MESSAGE = "Faster than elite pace, so this one can't count.";
export const EARLY_MESSAGE = 'Ended early. Go a little longer to earn XP.';

// SOLO is honor-system: the floor is the check. Swaps never change totalSlots,
// so they never change XP.
export function settleSoloXp(result) {
  const mission = result?.mission || {};
  if (isUntilDown(mission)) return settleDown(result, mission);
  const slots = result?.mission ? totalSlots(mission) : (result?.totalSlots || 0);
  const full = 15 * slots + 30;
  const format = result?.format || mission.format;
  const elapsed = Math.max(0, Math.floor(result?.elapsedSec || 0));
  const expected = soloExpectedSec(mission);
  const ratio = expected > 0 ? Math.min(1, elapsed / expected) : 0;
  const pass = { xp: full, outcome: 'pass', ratio, message: null };
  if (result?.capped) return pass;
  if (format === 'forTime' && result?.completed) {
    return elapsed >= soloFloorSec(mission) ? pass : { xp: 0, outcome: 'too_fast', ratio, message: TOO_FAST_MESSAGE };
  }
  if (isFixedClock(format) && elapsed >= soloFloorSec(mission)) return pass;
  if (ratio >= 0.25) return { xp: Math.round(15 * slots * ratio), outcome: 'partial', ratio, message: null };
  return { xp: 0, outcome: 'none', ratio, message: EARLY_MESSAGE };
}
// untilDown: I PUT IT DOWN (or the cap) is a finish, paid per set done. A
// STOP is a quit with no score, so it pays nothing: the button that saves
// the sets is right there.
function settleDown(result, mission) {
  const elapsed = Math.max(0, Math.floor(result?.elapsedSec || 0));
  if (!result?.completed || !result?.score) return { xp: 0, outcome: 'none', ratio: 0, credited: 0, message: DOWN_STOP_MESSAGE };
  const sets = Math.min(totalSlots(mission), Math.max(0, Math.floor(result.score.sets || 0)));
  const credited = Math.min(sets, Math.floor(elapsed / soloSetFloorSec(mission)));
  if (credited <= 0) return { xp: 0, outcome: sets > 0 ? 'too_fast' : 'none', ratio: 0, credited: 0, message: sets > 0 ? TOO_FAST_MESSAGE : DOWN_NO_SET_MESSAGE };
  return {
    xp: downXp(credited), outcome: 'pass', ratio: 1, credited,
    message: credited < sets ? `Faster than elite pace, so ${credited} of ${sets} sets count.` : null,
  };
}
// '18:42' · 'CAP · 248 reps' · '6 + 12' · '15/16' · '64' · '9 + 4' (sets) · '—'
export function formatScore(score) {
  if (!score) return '—';
  switch (score.kind) {
    case 'time': return score.capped ? `CAP · ${score.reps ?? score.value ?? 0} reps` : mmss(score.timeSec ?? score.value);
    case 'roundsReps': {
      if (Array.isArray(score.blocks) && score.blocks.length) {
        const r = score.blocks.reduce((s, b) => s + (b.rounds || 0), 0);
        const p = score.blocks.reduce((s, b) => s + (b.reps || 0), 0);
        return `${r} + ${p}`;
      }
      return `${score.rounds || 0} + ${score.reps || 0}`;
    }
    case 'minutesHeld': return `${score.minutesHeld ?? score.value ?? 0}/${score.of ?? 0}`;
    case 'reps': return String(score.reps ?? score.value ?? 0);
    case 'setsReps': return `${score.sets || 0} + ${score.reps || 0}`;
    default: return '—';
  }
}
