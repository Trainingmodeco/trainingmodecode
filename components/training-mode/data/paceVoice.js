// What the coach says in an AT YOUR PACE run (Quick Mission, the mission
// library and today's generated mission): the warm-up, the WORKOUTS screen,
// the spoken start under GET READY, and a few cues in the run. Pure: no React,
// no audio. QuickMissionSolo plays them through voiceCoach.
//
// This is the quiet mode: no per-move calls, no counting, no chatter. The
// lines are whole fixed sentences without numbers in them (bar "5 minutes"
// and "Last 10 seconds", both said as one take), so each one is one recorded
// clip per sentence in both voices (CLAUDE.md, "Natural-sounding lines").
// The button words are the ones on the run screen: ROUND, FINISH, SET,
// I PUT IT DOWN, I'M DONE, DONE.
import { isUntilDown, isMaxReps, soloRounds, soloTimeline, missionClockSec, hasRoundTimer } from './missionSolo';

// ── the warm-up (shared/WarmupTimer) ─────────────────────────────────────────
export const PACE_WARMUP_MIN = 5;
export const PACE_WARMUP = {
  intro: 'Warm up. 5 minutes. Tap skip when you are ready.',
  half: 'Halfway through the warm up. Keep moving.',
  // Said 12 seconds from the end, so it is over before the beeps of the last ten.
  lastTen: 'Last 10 seconds.',
  lastTenAt: 12,
  done: 'Warm up complete.',
};

// ── the WORKOUTS screen ──────────────────────────────────────────────────────
// canSwap: false for today's generated mission, whose moves cannot be swapped.
export function workoutsLine({ canSwap = true } = {}) {
  return canSwap
    ? 'Your workout is set. At your own pace. Swap any move before you start.'
    : 'Your workout is set. At your own pace. Tap start when you are ready.';
}

// ── the spoken start (GET READY) ─────────────────────────────────────────────
// What to do on THIS screen for THIS format, naming the real buttons.
// { checkOff: true } is the Fit card's CHECK-OFF run (fit-challenge/FitCheckOffSolo),
// which starts the same way: the tick boxes, and FINISH, which shows once every
// round is ticked. One new sentence, "Tick each move as you do it.", then the
// for-time run's own "Tap finish when you are done." (one recorded clip a
// sentence, in both voices).
export const CHECKOFF_HOWTO = 'Tick each move as you do it. Tap finish when you are done.';
export function howToLine(mission, { checkOff = false } = {}) {
  if (checkOff) return CHECKOFF_HOWTO;
  if (!mission) return '';
  if (isMaxReps(mission)) return 'Tap done when the set is done.';
  if (isUntilDown(mission)) {
    return mission.downUnit === 'round'
      ? "Tap round after each round. Tap I'm done."
      : 'Tap set after each set. Tap I put it down when the bell is down.';
  }
  const f = mission.format;
  if (f === 'emom') return 'Each set starts on the bell.';
  if (f === 'intervals') return 'Work and rest on the bell.';
  if (f === 'amrap') return 'Tap round after each round.';
  if (f === 'forTime') {
    const taps = hasRoundTimer(mission) ? soloRounds(mission) : 0;
    const rungs = taps > (mission.rounds || 1);
    if (taps >= 2) return `${rungs ? 'Tap round after each rung.' : 'Tap round after each round.'} Tap finish when you are done.`;
    return 'Tap finish when you are done.';
  }
  return '';
}
export function startLine(mission, opts) {
  return ['Workout starting. At your own pace.', howToLine(mission, opts)].filter(Boolean).join(' ');
}

// GET READY's length: 5 seconds, or, with the voice on, long enough for the
// start lines to end before the 3-2-1 beeps (speechMs: their length from the
// recorded clips; null when they cannot be planned: then 5). Never longer
// than PACE_READY_MAX.
export const PACE_READY_SEC = 5;
export const PACE_READY_MAX = 12;
export function readySecFor(speechMs) {
  if (!Number.isFinite(speechMs) || speechMs <= 0) return PACE_READY_SEC;
  return Math.min(PACE_READY_MAX, Math.max(PACE_READY_SEC, 3 + Math.ceil(speechMs / 1000 + 0.4)));
}

// ── in the run ───────────────────────────────────────────────────────────────
export const PACE_RUN = {
  rest: 'Rest.',
  work: 'Back to work.',
  lastMinute: 'Last minute.',
  paused: 'Paused.',
  resumed: 'Back to work.',
  time: 'Time.',
  done: 'Great work.',
};
// A rest this long or longer is a rest between blocks, worth a word; the short
// rests of an interval set are left to the beeps.
export const PACE_REST_SAY_SEC = 30;
// After a bell (or the rest's double beep) the line waits this long, so it
// never talks over it.
export const PACE_AFTER_BELL_MS = 1800;

// The spoken cues of a run, as moments on its clock (ms): { at, say }. The
// run plays them as it plays its bells (a moment that passed while the page
// was hidden is skipped).
export function runVoiceCues(mission) {
  if (!mission) return [];
  const out = [];
  const countUp = mission.format === 'forTime' || isUntilDown(mission) || isMaxReps(mission);
  if (countUp) {
    const cap = mission.capSec || 0;
    if (cap > 60) out.push({ at: (cap - 60) * 1000 + 600, say: PACE_RUN.lastMinute });
    return out;
  }
  const timeline = soloTimeline(mission);
  if (mission.format === 'amrap' && !timeline.some(s => s.kind === 'rest')) {
    const clock = missionClockSec(mission);
    if (clock >= 180) out.push({ at: (clock - 60) * 1000, say: PACE_RUN.lastMinute });
    return out;
  }
  let start = 0;
  timeline.forEach((seg, i) => {
    const prev = timeline[i - 1];
    if (seg.kind === 'rest' && seg.sec >= PACE_REST_SAY_SEC && i > 0) out.push({ at: start * 1000 + PACE_AFTER_BELL_MS, say: PACE_RUN.rest });
    if (seg.kind === 'work' && prev?.kind === 'rest' && prev.sec >= PACE_REST_SAY_SEC && seg.sec >= 8) out.push({ at: start * 1000 + PACE_AFTER_BELL_MS, say: PACE_RUN.work });
    start += seg.sec;
  });
  return out;
}

// Every line this module can produce, for a mission (the sweep and the tests).
export function paceLinesFor(mission, { canSwap = true, checkOff = false } = {}) {
  return [
    PACE_WARMUP.intro, PACE_WARMUP.half, PACE_WARMUP.lastTen, PACE_WARMUP.done,
    workoutsLine({ canSwap }), startLine(mission, { checkOff }),
    // CHECK-OFF is silent in the run itself: only the start above is said.
    ...(checkOff ? [] : runVoiceCues(mission).map(c => c.say)),
    PACE_RUN.paused, PACE_RUN.resumed, PACE_RUN.time, PACE_RUN.done,
  ];
}

// The mission's own warm-up advice, from its note: the sentence that starts
// "Warm up". After a colon, only what follows it ("3 easy rounds of 5 prying
// goblet squats…"); otherwise the whole sentence. null when it has none.
export function warmupAdvice(mission) {
  const note = String(mission?.note || '');
  const m = note.match(/(?:^|[.!?]\s+)(Warm up[^.!?]*[.!?]?)/);
  if (!m) return null;
  const s = m[1].trim();
  const colon = s.indexOf(':');
  if (colon > 0) {
    const rest = s.slice(colon + 1).trim();
    if (rest.length > 8) return rest.charAt(0).toUpperCase() + rest.slice(1);
  }
  return s;
}
export const GENERIC_WARMUP = 'Easy moves to get warm: march or jog in place, arm circles, hip circles, slow squats and leg swings.';
