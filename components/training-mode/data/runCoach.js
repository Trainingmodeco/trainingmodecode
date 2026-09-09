// Run coach — the pure brain behind the GPS / distance run player. Everything
// here is a plain function of numbers so it can be reasoned about and tested
// without a browser: targets and elite time, what to say at each split, how to
// judge pace, and which GPS fixes to believe.
//
// Units: distance in the athlete's chosen unit ('mi' | 'km'), pace in seconds
// per unit, time in seconds. Meters only at the GPS boundary.

export const METERS_PER_MILE = 1609.344;
export const METERS_PER_KM = 1000;

export function metersPerUnit(unit) {
  return unit === 'km' ? METERS_PER_KM : METERS_PER_MILE;
}

export function toMiles(distance, unit) {
  return unit === 'km' ? distance * 0.621371 : distance;
}

// ── Targets ──────────────────────────────────────────────────────────────────

// Level-driven default pace: 10:00/mi at level 1, ~18s/level faster, floored
// at 6:30/mi. Same curve the setup screen has always used.
export function levelPaceSecPerMile(level) {
  return Math.max(390, 600 - (Math.max(1, level || 1) - 1) * 18);
}

// Elite time: the number the athlete chases. Two thirds of the target, but
// never faster than a 6:00/mi pace so a generous target does not produce an
// impossible elite. 3 mi in 30:00 → elite 20:00, which is the owner's example.
export const ELITE_FRACTION = 2 / 3;
export const ELITE_FLOOR_SEC_PER_MILE = 360;

export function computeRunTargets({ distance, unit = 'mi', level = 1, targetSeconds = null }) {
  const miles = toMiles(distance, unit);
  const perMile = levelPaceSecPerMile(level);
  const autoTargetSec = Math.round(miles * perMile);
  const targetSec = targetSeconds && targetSeconds > 0 ? Math.round(targetSeconds) : autoTargetSec;
  const eliteFloorSec = Math.round(miles * ELITE_FLOOR_SEC_PER_MILE);
  const eliteSec = Math.max(eliteFloorSec, Math.round(targetSec * ELITE_FRACTION));
  const targetPaceSec = distance > 0 ? targetSec / distance : 0;
  const elitePaceSec = distance > 0 ? eliteSec / distance : 0;
  return { targetSec, autoTargetSec, eliteSec, targetPaceSec, elitePaceSec };
}

// ── Formatting ───────────────────────────────────────────────────────────────

export function fmtClock(sec) {
  const s = Math.max(0, Math.round(sec || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
  return `${m}:${String(r).padStart(2, '0')}`;
}

export function fmtPace(secPerUnit, unit = 'mi') {
  if (!Number.isFinite(secPerUnit) || secPerUnit <= 0 || secPerUnit > 3600) return `--:-- /${unit}`;
  return `${fmtClock(secPerUnit)} /${unit}`;
}

export function fmtSignedDelta(sec) {
  const s = Math.round(sec);
  if (s === 0) return '0:00';
  return `${s < 0 ? '−' : '+'}${fmtClock(Math.abs(s))}`;
}

// Spoken forms. TTS reads "3 mi" as "three em eye", so everything the coach
// says goes through here.
export function speakDistance(value, unit = 'mi') {
  const v = Math.round(value * 100) / 100;
  const name = unit === 'km' ? 'kilometer' : 'mile';
  if (v === 0.1) return `a tenth of a ${name}`;
  if (v === 0.25) return `a quarter ${name}`;
  if (v === 0.5) return `half a ${name}`;
  if (v === 1) return `one ${name}`;
  if (Number.isInteger(v)) return `${v} ${name}s`;
  if (Math.abs(v - Math.round(v * 2) / 2) < 1e-9 && v > 1) return `${Math.floor(v)} and a half ${name}s`;
  return `${v} ${name}s`;
}

export function speakDuration(sec) {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m === 0) return `${r} seconds`;
  const mins = m === 1 ? '1 minute' : `${m} minutes`;
  if (r === 0) return mins;
  return `${mins} ${r}`;
}

export function speakPace(secPerUnit, unit = 'mi') {
  if (!Number.isFinite(secPerUnit) || secPerUnit <= 0 || secPerUnit > 3600) return '';
  const s = Math.round(secPerUnit);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m} ${String(r).padStart(2, '0')} per ${unit === 'km' ? 'kilometer' : 'mile'}`;
}

// ── Scripts ──────────────────────────────────────────────────────────────────

// "Cardio mode. GPS run, 3 miles. Target time, 30 minutes. Elite time, 20
// minutes. Ready. Go." — the owner's exact shape.
export function buildRunIntro({ methodLabel = 'Run', useGps = true, distance, unit = 'mi', targetSec, eliteSec }) {
  // "Running" is the category name; the coach says "GPS run".
  const base = String(methodLabel || 'run').toLowerCase().replace(/^running$/, 'run');
  const method = useGps ? `GPS ${base}` : base;
  const parts = [
    'Cardio mode.',
    `${method}, ${speakDistance(distance, unit)}.`,
    `Target time, ${speakDuration(targetSec)}.`,
  ];
  if (eliteSec && eliteSec < targetSec) parts.push(`Elite time, ${speakDuration(eliteSec)}.`);
  return { lines: parts, ready: 'Ready.', go: 'Go!' };
}

// Interval / tabata intro for the time-based player.
export function buildIntervalIntro({ styleLabel = 'intervals', rounds, workSec, restSec, warmupSec = 0 }) {
  const parts = ['Cardio mode.', `${String(styleLabel).toLowerCase()}.`];
  if (rounds) parts.push(`${rounds} rounds, ${workSec} seconds work, ${restSec} seconds rest.`);
  if (warmupSec > 0) parts.push(`${Math.round(warmupSec / 60)} minute warm up first.`);
  return { lines: parts, ready: 'Ready.', go: 'Go!' };
}

// ── Milestones ───────────────────────────────────────────────────────────────

// Which markers were crossed between two distances. Spoken markers are every
// half unit plus every whole unit; tenths are visual only (a tick on the bar).
export function crossedMarkers(prevDist, dist, step = 0.5) {
  if (!(dist > prevDist)) return [];
  const out = [];
  const first = Math.floor(prevDist / step + 1e-9) + 1;
  const last = Math.floor(dist / step + 1e-9);
  for (let i = first; i <= last; i++) out.push(Math.round(i * step * 100) / 100);
  return out;
}

export function crossedTenths(prevDist, dist) {
  return crossedMarkers(prevDist, dist, 0.1);
}

// Verdict of a running clock against target and elite. delta < 0 is ahead.
export function projectedFinish(dist, elapsedSec, goal) {
  if (!(dist > 0.05)) return null;
  return (elapsedSec / dist) * goal;
}

export function splitScript({ marker, unit, elapsedSec, paceSec, targetPaceSec, goal, targetSec, eliteSec }) {
  const lines = [`${speakDistance(marker, unit)}.`, `${speakDuration(elapsedSec)}.`];
  if (paceSec > 0) lines.push(`Pace ${speakPace(paceSec, unit)}.`);
  const expectedAtMarker = targetPaceSec * marker;
  const delta = elapsedSec - expectedAtMarker; // negative = ahead of target
  const projected = projectedFinish(marker, elapsedSec, goal);
  if (projected != null && eliteSec && projected <= eliteSec) lines.push('You are on elite pace.');
  else if (delta <= -10) lines.push(`${speakDuration(-delta)} ahead of target.`);
  else if (delta >= 10) lines.push(`${speakDuration(delta)} behind target. Pick it up.`);
  else lines.push('Right on target.');
  const remaining = goal - marker;
  if (remaining > 0 && remaining <= 0.5 + 1e-9) lines.push(`${speakDistance(remaining, unit)} to go. Empty the tank.`);
  else if (Math.abs(marker - goal / 2) < 1e-9) lines.push('Halfway.');
  return lines.join(' ');
}

export function finishScript({ dist, unit, elapsedSec, targetSec, eliteSec }) {
  const lines = ['Goal reached.', `${speakDistance(dist, unit)} in ${speakDuration(elapsedSec)}.`];
  if (eliteSec && elapsedSec <= eliteSec) lines.push('Elite time. Outstanding.');
  else if (elapsedSec <= targetSec) lines.push(`Under target by ${speakDuration(targetSec - elapsedSec)}. Good work.`);
  else lines.push(`${speakDuration(elapsedSec - targetSec)} over target. Next time we take it.`);
  return lines.join(' ');
}

// ── Pace coaching ────────────────────────────────────────────────────────────

// Tolerance bands around the target pace. Slower than the target by more than
// 8% is "slow"; more than 20% is "very slow"; faster than 6% is "fast".
export function paceVerdict(curPaceSec, targetPaceSec) {
  if (!(curPaceSec > 0) || !(targetPaceSec > 0)) return 'unknown';
  const ratio = curPaceSec / targetPaceSec; // > 1 means slower than target
  if (ratio > 1.2) return 'very_slow';
  if (ratio > 1.08) return 'slow';
  if (ratio < 0.94) return 'fast';
  return 'on';
}

export const PACE_CUES = {
  very_slow: [
    'You are well under the speed limit. Pick it up now.',
    'Way off pace. Shorten your stride and turn your legs over faster.',
    'This is a jog. We came here to run. Push.',
  ],
  slow: [
    'You are under the speed limit. Pick it up.',
    'A little slow. Find the target pace and hold it.',
    'Behind pace. Drive the arms, the legs will follow.',
    'Lift the tempo. Ten seconds harder, then settle.',
  ],
  on: [
    'Good pace. Hold it right there.',
    'That is the pace. Stay relaxed.',
    'On target. Smooth and steady.',
    'Perfect rhythm. Keep it.',
  ],
  fast: [
    'Ahead of pace. Nice. Settle in and hold it.',
    'Fast. Make sure you can keep this to the finish.',
    'Ahead of target. Stay controlled.',
  ],
};

export const RUN_TIPS = [
  'Relax your shoulders. Hands loose, like you are holding a chip you do not want to break.',
  'Quick, light steps. Land under your hips, not out in front.',
  'Breathe in for three steps, out for two.',
  'Eyes up, chest tall. Run like someone is pulling a string from the top of your head.',
  'Drive the elbows straight back. No crossing the body.',
  'Slight lean from the ankles, not the waist.',
  'Unclench the jaw. Tension in the face costs you energy.',
  'Count your steps for ten seconds. Aim for around thirty.',
];

// Pick the next line from a pool without repeating the last one.
export function pickCue(pool, lastIndex, rnd = Math.random) {
  if (!pool || pool.length === 0) return { text: '', index: -1 };
  if (pool.length === 1) return { text: pool[0], index: 0 };
  let i = Math.floor(rnd() * pool.length);
  if (i === lastIndex) i = (i + 1) % pool.length;
  return { text: pool[i], index: i };
}

// Cadence of the pace coach: a cue every 45–75 s while the athlete is moving,
// every third slot a form tip instead. Never inside 12 s of a split call so the
// two do not pile up.
export const CUE_MIN_GAP_SEC = 45;
export const CUE_MAX_GAP_SEC = 75;
export const CUE_AFTER_SPLIT_GAP_SEC = 12;

export function shouldCue({ nowSec, lastCueSec, lastSplitSec, gapSec }) {
  if (nowSec - lastSplitSec < CUE_AFTER_SPLIT_GAP_SEC) return false;
  return nowSec - lastCueSec >= gapSec;
}

export function nextCueGap(rnd = Math.random) {
  return CUE_MIN_GAP_SEC + Math.round(rnd() * (CUE_MAX_GAP_SEC - CUE_MIN_GAP_SEC));
}

// ── GPS ──────────────────────────────────────────────────────────────────────

export function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

export const GPS_MAX_ACCURACY_M = 35;   // ignore fixes the phone itself says are worse than this
export const GPS_MAX_SPEED_MPS = 12;    // ~27 mph — nobody runs faster; it's a GPS jump
export const GPS_MIN_STEP_M = 2;        // sub-2m moves are jitter while standing still

// Decide whether a fix advances the distance. Returns { accept, meters }.
// `prev` is the last ACCEPTED fix ({ lat, lng, t }), `fix` the new one
// ({ lat, lng, t, accuracy }). Time in ms.
export function evaluateFix(prev, fix) {
  if (!fix || !Number.isFinite(fix.lat) || !Number.isFinite(fix.lng)) return { accept: false, meters: 0, reason: 'bad' };
  if (Number.isFinite(fix.accuracy) && fix.accuracy > GPS_MAX_ACCURACY_M) return { accept: false, meters: 0, reason: 'accuracy' };
  if (!prev) return { accept: true, meters: 0, reason: 'first' };
  const d = haversineMeters(prev.lat, prev.lng, fix.lat, fix.lng);
  const dt = (fix.t - prev.t) / 1000;
  // Noise floor scales with the reported accuracy: a 20 m fix cannot resolve a 3 m move.
  const floor = Math.max(GPS_MIN_STEP_M, Number.isFinite(fix.accuracy) ? fix.accuracy / 4 : GPS_MIN_STEP_M);
  if (d < floor) return { accept: false, meters: 0, reason: 'jitter' };
  if (dt > 0 && d / dt > GPS_MAX_SPEED_MPS) return { accept: false, meters: 0, reason: 'jump' };
  return { accept: true, meters: d, reason: 'ok' };
}

// Rolling pace from recent (tSec, meters) samples: distance covered in the
// last `windowSec`, as seconds per unit. Null until there is enough movement.
export function rollingPaceSec(samples, nowSec, unit = 'mi', windowSec = 30) {
  if (!samples || samples.length < 2) return null;
  const cutoff = nowSec - windowSec;
  let first = null;
  for (let i = samples.length - 1; i >= 0; i--) {
    if (samples[i].t <= cutoff) { first = samples[i]; break; }
    first = samples[i];
  }
  const last = samples[samples.length - 1];
  if (!first || first === last) return null;
  const meters = last.m - first.m;
  const sec = last.t - first.t;
  if (sec <= 0 || meters < 15) return null;
  const perMeter = sec / meters;
  return perMeter * metersPerUnit(unit);
}
