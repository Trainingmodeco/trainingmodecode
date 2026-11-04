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
import { resolveOutcome, xpForOutcome, OUTCOME_PRESET } from '../shared/sessionOutcome';

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
// The safety cap: the run clock (unpaused seconds) has reached capSec.
// GUIDED and SOLO both end the run there, as a finish.
export function downCapReached(mission, elapsedSec) {
  const cap = mission?.capSec || 0;
  return isUntilDown(mission) && cap > 0 && Number(elapsedSec) >= cap;
}
// The score an until-down run ends on, GUIDED and SOLO alike. end 'down' (I
// PUT IT DOWN) keeps the time tapped; end 'cap' reads the cap. reps are the
// reps into the next set, never a whole set.
// skipped: GUIDED's skipped blocks, kept on the score when there were any.
export function downScore(mission, { sets = 0, reps = 0, end = 'down', timeSec = 0, skipped = 0 } = {}) {
  const n = Math.max(0, Math.floor(Number(sets) || 0));
  const r = Math.min(Math.max(0, repsPerSet(mission) - 1), Math.max(0, Math.floor(Number(reps) || 0)));
  const capped = end === 'cap';
  const t = capped ? mission?.capSec || 0 : Math.max(0, Math.floor(Number(timeSec) || 0));
  const k = Math.max(0, Math.floor(Number(skipped) || 0));
  return { kind: 'setsReps', sets: n, reps: r, timeSec: t, value: n * repsPerSet(mission) + r, ...(capped ? { capped: true } : {}), ...(k > 0 ? { skipped: k } : {}) };
}
export const DOWN_NO_SET_MESSAGE = 'Finish one set to earn XP.';
export const DOWN_STOP_MESSAGE = 'Ended with no score. I PUT IT DOWN saves your sets.';
// The words an until-down run uses. NO CONTINUES counts SETS and ends on I PUT
// IT DOWN; a mission with downUnit 'round' (UPPER LOWER DIPS) counts ROUNDS and
// ends on I'M DONE. Same engine, same score, same XP.
const DOWN_COPY = {
  set: {
    one: 'set', many: 'sets', ONE: 'SET', MANY: 'SETS', tag: 'S', done: 'I PUT IT DOWN', ask: 'BELL DOWN?', askName: 'Bell down',
    noScore: DOWN_NO_SET_MESSAGE, stop: DOWN_STOP_MESSAGE,
    stopSolo: 'Bell on the floor? Tap I PUT IT DOWN instead: it saves your sets. END saves nothing.',
    stopGuided: 'Bell on the floor? Tap I PUT IT DOWN instead: it finishes the run with your sets. END saves nothing.',
    capSay: 'Time. Park the bell.', doneSay: 'Bell down.',
    // SOLO's SET tap comes every ~25 s with a bell in hand.
    tapHint: 'Tap SET with your free hand at a switch, or skip it and enter your sets when the bell is down.',
  },
  round: {
    one: 'round', many: 'rounds', ONE: 'ROUND', MANY: 'ROUNDS', tag: 'R', done: "I'M DONE", ask: 'DONE?', askName: 'Done',
    noScore: 'Finish one round to earn XP.', stop: "Ended with no score. I'M DONE saves your rounds.",
    stopSolo: "Can't finish a round? Tap I'M DONE instead: it saves your rounds. END saves nothing.",
    stopGuided: "Can't finish a round? Tap I'M DONE instead: it finishes the run with your rounds. END saves nothing.",
    capSay: 'Time.', doneSay: 'Done.',
  },
};
export function downCopy(mission) { return mission?.downUnit === 'round' ? DOWN_COPY.round : DOWN_COPY.set; }
// '1 set', '6 rounds'.
export function downCount(mission, n) { const c = downCopy(mission); return `${n} ${n === 1 ? c.one : c.many}`; }
// One set's (round's) seconds at the STANDARD count: the average block, rep 1
// with its setup. What a set is worth in XP, at every level.
export function downSetSec(mission) {
  const secs = allSlots(mission).map(sl => (hasList(sl) ? sl.list : [sl])
    .reduce((n, it) => n + (it.reps || 0) * estMsFor(it.moveId, 'standard') / 1000, 0) + (sl.setupMs || 0) / 1000);
  return secs.length ? Math.max(1, Math.round(secs.reduce((a, b) => a + b, 0) / secs.length)) : 1;
}
// The XP for an untilDown run, on the clocks' scale: the sets done, each
// worth its standard time, at 10 a minute, never more than the run clock
// ran (elapsedSec), plus the finish bonus (bonus: false when GUIDED skipped
// a block). So holding on longer earns what the work is worth, not three
// times a clock's rate: NO CONTINUES STANDARD pays about 5 a set, a 30:00
// run at most 330, like any 30-minute clock.
export function downXp(mission, sets, { elapsedSec = Infinity, bonus = true } = {}) {
  const n = Math.max(0, Math.floor(Number(sets) || 0));
  if (n <= 0) return 0;
  const ran = Math.max(0, Number(elapsedSec));
  return minutesXp(Math.min(Number.isFinite(ran) ? ran : Infinity, n * downSetSec(mission))) + (bonus ? XP_FINISH : 0);
}
// GUIDED counts the sets for itself, so a phone left running would count to
// the cap: every `downCheckEvery` sets (the level's elite mark) it holds the
// count and asks STILL GOING? before it counts on.
export function downCheckEvery(mission) { return isUntilDown(mission) && mission?.pace?.elite > 0 ? mission.pace.elite : 0; }

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
// A for-time tier's seconds: a number, or TOUCH THE SKY's { held, of, timeSec }
// (rounds held are its tiers; the time at the count is only for the maths).
export function tierSec(v) { return typeof v === 'number' ? v : typeof v?.timeSec === 'number' ? v.timeSec : 0; }
// The rest SOLO times after a ROUND tap: a for-time mission's own long rest
// between rounds (TOUCH THE SKY's 2:00), else 0. Short rests are never timed.
export function roundRestSec(mission) {
  if (mission?.format !== 'forTime' || isUntilDown(mission) || isLadder(mission)) return 0;
  const slots = allSlots(mission);
  const rest = slots.length ? slots[slots.length - 1].rest || 0 : 0;
  return rest >= 60 ? rest : 0;
}
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
// The rounds SOLO's ROUND tap counts for a for-time mission: a ladder's rungs,
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
    if (isUntilDown(mission)) text = tier === 'elite' ? `${v}+ ${downCopy(mission).many}` : `${v} ${downCopy(mission).many}`;
    else if (kind === 'roundsHeld') text = `${v?.held}/${v?.of} rounds`; // not a race: rounds held
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
  if (rule.kind === 'setsReps') return { sets: roundTaps, reps: 0 }; // untilDown: the SET (ROUND) taps
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
// One rule for every v2 Quick Mission run, GUIDED and SOLO: 15 XP a slot
// done, or, on a fixed clock (EMOM, AMRAP, intervals), about 10 XP a minute
// worked when that is more, plus the 30 finish bonus when the run finished
// with nothing skipped. Rests are not work. So a single-block AMRAP no
// longer pays a flat 45: CARRY-ON 15 pays 180, ROOM 12 150, OVERTIME 20 230
// (STANDARD). A mission of many short slots (TURBO BUTTON, every EMOM) still
// pays by its slots, which is more. A for-time mission's FINISH pays its
// standard time (capped at the cap) at the same 10 a minute when that is
// more than its slots: a fixed figure, so a slow finish never earns more
// (TOUCH THE SKY 110 + 30, BURNOUT 21, KO SPRINT 30, OXYGEN DEBT). A stopped
// for-time run pays its slots. An until-down run pays its sets on the same
// scale (downXp). A generated mission or a classic never reaches the minute
// rule (no v2 flag): it pays 15 a slot, as before.
export const XP_PER_SLOT = 15;
export const XP_FINISH = 30;
export const XP_PER_MIN = 10;
export function totalSlots(mission) { return allSlots(mission).length * (mission?.rounds || 1); }
// A v2 mission on a fixed clock: it pays by the time worked.
export function paysByTime(mission) { return mission?.v2 === true && !isUntilDown(mission) && isFixedClock(mission?.format); }
// The work seconds of the clock up to upToSec (all of it by default): every
// EMOM window, AMRAP block and interval, never a rest.
export function workSecOf(mission, upToSec = Infinity) {
  let start = 0;
  let out = 0;
  for (const seg of soloTimeline(mission)) {
    if (start >= upToSec) break;
    if (seg.kind === 'work') out += Math.min(seg.sec, upToSec - start);
    start += seg.sec;
  }
  return out;
}
export function minutesXp(sec) { return Math.round((XP_PER_MIN * Math.max(0, Number(sec) || 0)) / 60); }
// A v2 for-time mission: its finish pays the standard time (forTimePaySec).
export function paysOnFinish(mission) { return mission?.v2 === true && !isUntilDown(mission) && mission?.format === 'forTime'; }
export function forTimePaySec(mission) {
  if (!paysOnFinish(mission)) return 0;
  const std = tierSec(mission?.pace?.standard);
  const cap = mission?.capSec || 0;
  return cap > 0 ? Math.min(std, cap) : std;
}
// slots × ratio at 15 each (ratio: SOLO's share of a stopped run), or the
// minutes worked at 10 each on a clock (a for-time finish: its standard
// time), whichever is more, + the bonus.
export function missionXp(mission, { slots = 0, ratio = 1, workedSec = 0, full = false } = {}) {
  const bySlots = Math.round(XP_PER_SLOT * Math.max(0, slots) * ratio);
  const byTime = paysByTime(mission) ? minutesXp(Math.min(Math.max(0, Number(workedSec) || 0), workSecOf(mission)))
    : full && paysOnFinish(mission) ? minutesXp(forTimePaySec(mission)) : 0;
  return Math.max(bySlots, byTime) + (full ? XP_FINISH : 0);
}
export function fullRunXp(mission) { return missionXp(mission, { slots: totalSlots(mission), workedSec: workSecOf(mission), full: true }); }
export function soloExpectedSec(mission) {
  if (isUntilDown(mission)) return mission.capSec || 0;
  if (isFixedClock(mission?.format)) return missionClockSec(mission);
  const std = tierSec(mission?.pace?.standard);
  const cap = mission?.capSec || 0;
  return std && cap ? Math.min(std, cap) : (std || cap || 0);
}
export function soloFloorSec(mission) {
  if (isUntilDown(mission)) return soloSetFloorSec(mission);
  if (isFixedClock(mission?.format)) return Math.ceil(0.95 * missionClockSec(mission));
  return Math.ceil(0.5 * tierSec(mission?.pace?.elite));
}
export const TOO_FAST_MESSAGE = "Faster than elite pace, so this one can't count.";
export const EARLY_MESSAGE = 'Ended early. Go a little longer to earn XP.';

// SOLO is honor-system: the floor is the check. Swaps never change totalSlots
// or the clock, so they never change XP. A stopped clock pays the minutes it
// ran (the work in them); a finish pays the whole clock.
export function settleSoloXp(result) {
  const mission = result?.mission || {};
  if (isUntilDown(mission)) return settleDown(result, mission);
  const slots = result?.mission ? totalSlots(mission) : (result?.totalSlots || 0);
  const full = missionXp(mission, { slots, workedSec: workSecOf(mission), full: true });
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
  if (ratio >= 0.25) return { xp: missionXp(mission, { slots, ratio, workedSec: workSecOf(mission, elapsed) }), outcome: 'partial', ratio, message: null };
  return { xp: 0, outcome: 'none', ratio, message: EARLY_MESSAGE };
}
// GUIDED, a v2 mission: the XP App banks and the complete screen shows, from
// this one call, so the two never disagree. On a clock the work done is
// measured in time (the runner reports workedSec): the minute rule pays it
// and the verdict reads the share of the clock worked. Anything else reads
// its slots, as before. A generated mission or a classic never comes here.
// A stopped run is never a pass: past 90% of a clock (or of the slots) it is
// still SESSION STOPPED, as SOLO calls it. The XP stays what it is.
const STOPPED_RESPONSE = 'Ended early — the work you completed counts toward your stats.';
export function settleGuidedXp(result) {
  const mission = result?.mission || {};
  if (isUntilDown(mission)) return settleGuidedDown(result, mission);
  const done = Math.max(0, Math.floor(Number(result?.exercisesCompleted) || 0));
  const total = Math.max(0, Number(result?.totalExercises) || 0);
  const full = !!result?.completed && done >= total;
  const timed = paysByTime(mission);
  const clockWork = timed ? workSecOf(mission) : 0;
  const worked = timed ? Math.min(clockWork, Math.max(0, Math.floor(Number(result?.workedSec) || 0))) : 0;
  const base = missionXp(mission, { slots: done, workedSec: worked, full });
  let verdict = resolveOutcome({
    completed: timed ? worked : done, total: timed ? clockWork : total, difficulty: mission.difficulty, integrityResult: result?.integrityResult || null,
  });
  if (!result?.completed && verdict.outcome === 'pass') verdict = { ...verdict, outcome: 'partial', response: STOPPED_RESPONSE, preset: OUTCOME_PRESET.partial };
  return { mode: 'guided', xp: xpForOutcome(verdict.outcome, base), base, outcome: verdict.outcome, verdict, workedSec: worked };
}
// GUIDED, until down: the same settle as SOLO's. Only I PUT IT DOWN (I'M
// DONE) or the cap ends the run with a score (result.untilDown, from the
// runner's endDown); a STOP / END is a quit with no score and pays nothing,
// whatever sets it counted. A skipped block drops the finish bonus.
function settleGuidedDown(result, mission) {
  const copy = downCopy(mission);
  const ended = !!result?.untilDown && !!result?.completed && !!result?.score;
  const none = (message) => ({
    mode: 'guided', xp: 0, base: 0, outcome: 'none', workedSec: 0,
    verdict: { outcome: 'fail', response: message, completionRatio: 0, preset: OUTCOME_PRESET.fail },
  });
  if (!ended) return none(copy.stop);
  const sets = Math.min(totalSlots(mission), Math.max(0, Math.floor(Number(result.score.sets) || 0)));
  if (sets <= 0) return none(copy.noScore);
  const skipped = Math.max(0, Math.floor(Number(result.skipped) || 0));
  const elapsed = Math.max(0, Math.floor(Number(result.elapsedSec ?? result.score.timeSec) || 0));
  const base = downXp(mission, sets, { elapsedSec: elapsed, bonus: skipped === 0 });
  const verdict = resolveOutcome({ completed: sets, total: sets + skipped, difficulty: mission.difficulty, integrityResult: result?.integrityResult || null });
  return { mode: 'guided', xp: xpForOutcome(verdict.outcome, base), base, outcome: verdict.outcome, verdict, workedSec: 0 };
}
// untilDown: I PUT IT DOWN (or the cap) is a finish, paid per set done. A
// STOP is a quit with no score, so it pays nothing: the button that saves
// the sets is right there.
function settleDown(result, mission) {
  const elapsed = Math.max(0, Math.floor(result?.elapsedSec || 0));
  const copy = downCopy(mission);
  if (!result?.completed || !result?.score) return { xp: 0, outcome: 'none', ratio: 0, credited: 0, message: copy.stop };
  const sets = Math.min(totalSlots(mission), Math.max(0, Math.floor(result.score.sets || 0)));
  const credited = Math.min(sets, Math.floor(elapsed / soloSetFloorSec(mission)));
  if (credited <= 0) return { xp: 0, outcome: sets > 0 ? 'too_fast' : 'none', ratio: 0, credited: 0, message: sets > 0 ? TOO_FAST_MESSAGE : copy.noScore };
  return {
    xp: downXp(mission, credited, { elapsedSec: elapsed }), outcome: 'pass', ratio: 1, credited,
    message: credited < sets ? `Faster than elite pace, so ${credited} of ${sets} ${copy.many} count.` : null,
  };
}
// ── the round timer (SOLO) ──────────────────────────────────────────────────
// Every SOLO mission that counts its own rounds (an AMRAP, a for-time
// mission, an until-down run) has the ROUND button: a tap is a split, the
// clock (ms) at the tap and the AMRAP block it fell in ({ at, block }). The
// tap counts exactly what + ROUND counted (a ladder's rung, NO CONTINUES'
// set); the split only adds its time. An EMOM or an interval clock has no
// ROUND button: its rounds are the clock's.
export function hasRoundTimer(mission) { return mission?.format === 'amrap' || mission?.format === 'forTime' || isUntilDown(mission); }
// Where block b's work starts on the clock, in seconds (0 for one block).
function blockStartSec(mission, b) {
  let start = 0;
  for (const seg of soloTimeline(mission)) {
    if (seg.kind === 'work' && seg.block === b) return start;
    start += seg.sec;
  }
  return 0;
}
// The rounds the splits make: { n, atSec, lapSec, block }. n counts within
// its block, atSec is the clock at the tap, lapSec the round's own time (from
// the last tap in the same block, or the block's start), so the laps of one
// block add up to its last tap. Bad entries are skipped.
export function roundSplits(mission, splits) {
  const last = new Map();
  const count = new Map();
  const out = [];
  (Array.isArray(splits) ? splits : []).forEach(sp => {
    const atMs = Number(sp?.at);
    if (!Number.isFinite(atMs) || atMs < 0) return;
    const block = Number.isInteger(sp?.block) && sp.block >= 0 ? sp.block : 0;
    const atSec = Math.floor(atMs / 1000);
    const from = last.has(block) ? last.get(block) : blockStartSec(mission, block);
    last.set(block, atSec);
    count.set(block, (count.get(block) || 0) + 1);
    out.push({ n: count.get(block), atSec, lapSec: Math.max(0, atSec - from), block });
  });
  return out;
}
// FINISH on a for-time mission is its last ROUND tap: when the taps are
// short of the rounds (the last round is never tapped: FINISH is the tap),
// the splits close at the finish time, so a finished 3-round run has 3.
export function closeSplits(mission, splits, finishSec) {
  const list = Array.isArray(splits) ? splits : [];
  if (mission?.format !== 'forTime' || isUntilDown(mission) || !Number.isFinite(Number(finishSec))) return list;
  if (list.length >= soloRounds(mission)) return list;
  const lastAt = list.reduce((n, sp) => Math.max(n, Number(sp?.at) || 0), 0);
  return [...list, { at: Math.max(lastAt, Math.floor(Number(finishSec)) * 1000), block: 0 }];
}
// 'R1 2:00 · R2 4:00 · R3 8:00': each round's own time. `tag` 'S' for sets.
export function splitsLine(rounds, { tag = 'R', last = Infinity } = {}) {
  const list = Array.isArray(rounds) ? rounds : [];
  return list.slice(Math.max(0, list.length - last)).map(r => `${tag}${r.n} ${mmss(r.lapSec)}`).join(' · ');
}
// A multi-block AMRAP's rounds, block by block: 'B1 R1 0:50 · R2 0:52 / B2 R1 0:55'.
export function blockSplitsLine(rounds, { tag = 'R' } = {}) {
  const list = Array.isArray(rounds) ? rounds : [];
  const blocks = [...new Set(list.map(r => r.block))];
  if (blocks.length <= 1) return splitsLine(list, { tag });
  return blocks.map(b => `B${b + 1} ${splitsLine(list.filter(r => r.block === b), { tag })}`).join(' / ');
}

// '18:42' · 'CAP · 248 reps' · '6 + 12' · '15/16' · '64' · '9 + 4' (sets) · '3/3' (rounds held) · '—'
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
    case 'roundsHeld': return `${score.held || 0}/${score.of || 0}${score.reps ? ` + ${score.reps}` : ''}`;
    default: return '—';
  }
}
