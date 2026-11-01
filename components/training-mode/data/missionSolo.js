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

// Seconds per unit when a rep is a distance or a calorie (Murph's mile).
export const UNIT_SEC = { MILE: 600, 'HALF MILE': 300, KM: 375, CAL: 3.3 };

const allSlots = (mission) => [...(mission?.exercises || []), ...(mission?.finisherExercises || [])];
const hasList = (slot) => Array.isArray(slot?.list);
const rounds = (mission) => Math.max(1, mission?.rounds || 1);

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
export function missionClockSec(mission) {
  const f = mission?.format;
  if (f === 'forTime') return mission.capSec || 0;
  const slots = allSlots(mission);
  if (f === 'emom') return rounds(mission) * slots.reduce((s, sl) => s + (sl.window || 60), 0);
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
export function soloTimeline(mission) {
  const f = mission?.format;
  if (!isFixedClock(f)) return [];
  const slots = allSlots(mission);
  const n = rounds(mission);
  const out = [];
  const rest = (sec, block) => ({ kind: 'rest', sec, label: 'REST', swapKey: null, stepKeys: [], calls: [], block });
  for (let r = 1; r <= n; r += 1) {
    slots.forEach((slot, i) => {
      const block = r - 1;
      const stepKeys = hasList(slot) ? slot.list.map(s => s.swapKey) : [];
      const calls = (slot.calls || []).map(c => ({ ...c }));
      if (f === 'emom') {
        const m = (r - 1) * slots.length + i + 1;
        const label = hasList(slot)
          ? `MIN ${m} · ${String(slot.sideSay || slot.name || '').toUpperCase()}`
          : `MIN ${m} · ${slotDose(slot)} ${slot.name}`;
        out.push({ kind: 'work', sec: slot.window || 60, label, swapKey: hasList(slot) ? null : slot.swapKey ?? null, stepKeys, calls, block });
        return;
      }
      const last = r === n && i === slots.length - 1;
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
// a for-time mission.
export function repsPerRound(mission) {
  const slots = allSlots(mission);
  const sum = (list) => list.reduce((s, x) => s + (x.reps || 0), 0);
  if (mission?.format === 'amrap') {
    const block = slots.find(hasList);
    return block ? sum(block.list) : 0;
  }
  return slots.reduce((s, sl) => s + (hasList(sl) ? sum(sl.list) : sl.mode === 'reps' ? sl.reps || 0 : 0), 0);
}
export function paceTargets(mission) {
  const pace = mission?.pace || {};
  const f = mission?.format;
  return ['elite', 'standard', 'beginner'].map(tier => {
    const v = pace[tier];
    let text = '';
    if (f === 'forTime') text = `≤ ${mmss(v)}`;
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
  if (rule.kind === 'roundsReps') {
    const n = mission.rounds || 1;
    if (n <= 1) return { rounds: roundTaps, reps: 0 };
    const blocks = Array.from({ length: n }, (_, b) => ({ rounds: blockTaps?.[b] ?? 0, reps: 0 }));
    return { blocks, rounds: blocks.reduce((s, b) => s + b.rounds, 0), reps: 0 };
  }
  if (rule.kind === 'minutesHeld') return Math.round(missionClockSec(mission) / 60);
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
  if (isFixedClock(mission?.format)) return missionClockSec(mission);
  const std = mission?.pace?.standard;
  const cap = mission?.capSec || 0;
  return typeof std === 'number' && cap ? Math.min(std, cap) : (std || cap || 0);
}
export function soloFloorSec(mission) {
  if (isFixedClock(mission?.format)) return Math.ceil(0.95 * missionClockSec(mission));
  return Math.ceil(0.5 * (mission?.pace?.elite || 0));
}
export const TOO_FAST_MESSAGE = "Faster than elite pace, so this one can't count.";
export const EARLY_MESSAGE = 'Ended early. Go a little longer to earn XP.';

// SOLO is honor-system: the floor is the check. Swaps never change totalSlots,
// so they never change XP.
export function settleSoloXp(result) {
  const mission = result?.mission || {};
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
// '18:42' · 'CAP · 248 reps' · '6 + 12' · '15/16' · '64' · '—'
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
    default: return '—';
  }
}
