// Machine speed → distance. The indoor answer to GPS.
//
// WHY THIS EXISTS. On a treadmill, a bike, a rower or a stair climber, GPS
// reads zero — you are not moving through the world. What RunPlayer did about
// that was to ESTIMATE distance at the athlete's target pace:
//
//     dist = elapsedSec / targetPaceSec
//
// which is circular. It is the goal played back. You always finish exactly on
// target, every split lands exactly on schedule, and the pace coach has to stay
// muted because the number cannot disagree with the plan. A treadmill run got a
// distance that could not tell it anything.
//
// The honest indoor source is the one number the machine actually knows and the
// athlete can read off its console: SPEED. Set it, and distance is speed
// integrated over time. Change the belt, tap the dial, and the rate changes from
// that moment on. The result is as accurate as the machine's own calibration —
// which is the number they would check us against anyway.
//
// The track is keyed on ELAPSED seconds, not wall time, so paused time is
// excluded for free: liveRunElapsedSec already subtracts it, and a segment
// boundary recorded at elapsed t stays correct across any number of pauses.

// Speed is carried in units per hour — mph when the unit is 'mi', kph when
// 'km' — because that is what every console in the gym displays.

/** A fresh track at `speed` from elapsed second 0. */
export function newSpeedTrack(speed) {
  return [{ t: 0, speed: Math.max(0, Number(speed) || 0) }];
}

// Taps arrive in bursts: going from 10.0 to 13.0 is thirty presses over about
// two seconds, and treating each as its own segment is both wasteful — the
// track is persisted every few seconds and is in cloud sync — and wrong about
// what happened. The athlete made ONE change. Anything inside this window folds
// into the segment already open.
const COALESCE_SEC = 2.5;

/**
 * Record a speed change at elapsed second `t`. Returns a NEW array.
 * A change at, before, or shortly after the last boundary replaces it rather
 * than stacking, so a burst of taps is one segment and a double-tap cannot
 * leave a zero-length one behind.
 */
export function setSpeedAt(segments, t, speed) {
  const segs = Array.isArray(segments) && segments.length ? segments.slice() : newSpeedTrack(speed);
  const s = Math.max(0, Number(speed) || 0);
  const at = Math.max(0, Number(t) || 0);
  const last = segs[segs.length - 1];
  if (last && at - last.t <= COALESCE_SEC) {
    if (last.speed === s) return segs;
    segs[segs.length - 1] = { t: last.t, speed: s };
    return segs;
  }
  if (last && last.speed === s) return segs;
  segs.push({ t: at, speed: s });
  return segs;
}

/** Distance covered by elapsed second `elapsedSec`, in the track's unit. */
export function distanceFromSpeed(segments, elapsedSec) {
  if (!Array.isArray(segments) || segments.length === 0) return 0;
  const end = Math.max(0, Number(elapsedSec) || 0);
  let d = 0;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (seg.t >= end) break;
    const segEnd = i + 1 < segments.length ? Math.min(segments[i + 1].t, end) : end;
    if (segEnd > seg.t) d += (seg.speed * (segEnd - seg.t)) / 3600;
  }
  return d;
}

/** The speed in force at elapsed second `elapsedSec`. */
export function speedAt(segments, elapsedSec) {
  if (!Array.isArray(segments) || segments.length === 0) return 0;
  const end = Math.max(0, Number(elapsedSec) || 0);
  let cur = segments[0].speed;
  for (const seg of segments) { if (seg.t <= end) cur = seg.speed; else break; }
  return cur;
}

// ── speed ↔ pace ───────────────────────────────────────────────────────────
/** Seconds per unit at this speed. Infinity-safe: 0 speed → null, not ∞. */
export function paceFromSpeed(speed) {
  const s = Number(speed) || 0;
  return s > 0 ? 3600 / s : null;
}

/** Speed that holds this pace. */
export function speedFromPace(paceSec) {
  const p = Number(paceSec) || 0;
  return p > 0 ? 3600 / p : 0;
}

// ── dial behaviour ─────────────────────────────────────────────────────────
// Treadmill consoles step in 0.1 mph / 0.1 kph, and so do we — a 0.5 step
// would make the dial faster to reach a target but unable to MATCH the belt,
// which is the whole point of the control.
export const SPEED_STEP = 0.1;

export const SPEED_RANGE = {
  // Walk to a hard run. The ceilings are above any belt's top speed so the
  // dial is never the thing that stops them.
  mi: { min: 0.5, max: 16 },
  km: { min: 0.8, max: 25 },
};

export function clampSpeed(speed, unit = 'mi') {
  const r = SPEED_RANGE[unit] || SPEED_RANGE.mi;
  const s = Number(speed) || 0;
  // Round via an integer number of tenths. `Math.round(s / 0.1) * 0.1` is the
  // obvious form and it is wrong: it stores 10.100000000000001, which is
  // invisible on screen but goes into persisted state and into cloud sync.
  return Math.min(r.max, Math.max(r.min, Math.round(s * 10) / 10));
}

export const speedUnitLabel = (unit) => (unit === 'km' ? 'KPH' : 'MPH');

/** One decimal, always — "6.0" not "6", so the number does not jump width. */
export const fmtSpeed = (speed) => (Math.round((Number(speed) || 0) * 10) / 10).toFixed(1);

// The dial's opening value: whatever speed holds the athlete's target pace,
// clamped to something a machine can actually do. Starting them ON their target
// means the common case is zero taps.
export function defaultSpeed(targetPaceSec, unit = 'mi') {
  const s = speedFromPace(targetPaceSec);
  return clampSpeed(s > 0 ? s : (unit === 'km' ? 9 : 5.5), unit);
}

// ── the finish-line correction ─────────────────────────────────────────────
/**
 * The athlete types what the console says at the end. That number is ground
 * truth, so it wins — and the ratio it implies is how far our integration drifted
 * (belts read differently, and a dial tap always lands a second or two late).
 * Returned so the summary can show it and so a future build can carry a
 * per-athlete calibration factor.
 */
export function applyMachineCorrection(trackedDistance, reportedDistance) {
  const tracked = Number(trackedDistance) || 0;
  const reported = Number(reportedDistance) || 0;
  if (!(reported > 0)) return { distance: tracked, factor: 1, corrected: false };
  const factor = tracked > 0.01 ? reported / tracked : 1;
  return { distance: reported, factor, corrected: true };
}
