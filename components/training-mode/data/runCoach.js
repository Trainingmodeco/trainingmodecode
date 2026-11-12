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
// says goes through here. They are also built to play from the recorded clips
// (public/voice), and to sound like one voice talking, not a tiled list: every
// number is said inside a whole recorded phrase ("14 minutes", "22 seconds",
// "3 miles", "50 seconds per mile"), never as a bare number clip. Those are
// recorded as rep counts, short and shouted, and inside a sentence they cut
// the words off. A phrase is one clip, or a recorded lead-in and one of these
// ("under target by" + "46 seconds"); test:spoken holds every Cardio line to
// that. A time of minutes and seconds has a comma between them, so the two
// play as two phrases with a natural pause.
export function speakNumber(n) {
  const t = Math.round((Number(n) || 0) * 10) / 10;
  if (Number.isInteger(t)) return String(t);
  const whole = Math.floor(t);
  return `${whole} point ${Math.round((t - whole) * 10)}`;
}

const unitOf = (n, one) => (n === 1 ? `1 ${one}` : `${n} ${one}s`);
// A sentence that starts with a spoken distance ("One mile to go."), for the caption.
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// The distances recorded to the tenth: up to a marathon, which is as far as
// the DISTANCE setup goes. A longer free run is said to the whole unit.
export const TENTHS_UP_TO = { mi: 26.2, km: 42.2 };

export function speakDistance(value, unit = 'mi') {
  const v = Math.round((Number(value) || 0) * 100) / 100;
  const name = unit === 'km' ? 'kilometer' : 'mile';
  if (v === 0.25) return `a quarter ${name}`;
  const tenths = Math.round(v * 10) / 10;
  const t = tenths > (TENTHS_UP_TO[unit] || TENTHS_UP_TO.mi) ? Math.round(v) : tenths;
  if (t === 0.1) return `a tenth of a ${name}`;
  if (t === 0.5) return `half a ${name}`;
  if (t === 1) return `one ${name}`;
  if (Number.isInteger(t)) return `${t} ${name}s`;
  const whole = Math.floor(t);
  const tenth = Math.round((t - whole) * 10);
  if (tenth === 5) return `${whole} and a half ${name}s`;
  return `${whole} point ${tenth} ${name}s`;
}

// "45 seconds", "1 minute", "12 minutes, 30 seconds". Past an hour the
// seconds are dropped and the hours said ("1 hour, 25 minutes"), so no number
// goes past 59.
export function speakDuration(sec) {
  const s = Math.max(0, Math.round(sec));
  if (s >= 3600) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return m ? `${unitOf(h, 'hour')}, ${unitOf(m, 'minute')}` : unitOf(h, 'hour');
  }
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m === 0) return unitOf(r, 'second');
  if (r === 0) return unitOf(m, 'minute');
  return `${unitOf(m, 'minute')}, ${unitOf(r, 'second')}`;
}

// "9 minutes, 50 seconds per mile"; on the minute "9 minutes per mile". The
// seconds and the unit are one recorded phrase ("50 seconds per mile").
export function speakPace(secPerUnit, unit = 'mi') {
  if (!Number.isFinite(secPerUnit) || secPerUnit <= 0) return '';
  const s = Math.round(secPerUnit);
  if (s >= 3600) return '';
  const m = Math.floor(s / 60);
  const r = s % 60;
  const per = `per ${unit === 'km' ? 'kilometer' : 'mile'}`;
  if (r === 0) return `${unitOf(m, 'minute')} ${per}`;
  if (m === 0) return `${unitOf(r, 'second')} ${per}`;
  return `${unitOf(m, 'minute')}, ${unitOf(r, 'second')} ${per}`;
}

// ── Scripts ──────────────────────────────────────────────────────────────────

// "Cardio mode. GPS run, 3 miles. Target time, 30 minutes. Elite time, 20
// minutes. Ready. Go." — the owner's exact shape.
export function buildRunIntro({ methodLabel = 'Run', useGps = true, distance, unit = 'mi', targetSec, eliteSec, freeRun = false, targetPaceSec = null }) {
  // "Running" is the category name; the coach says "GPS run".
  const base = String(methodLabel || 'run').toLowerCase().replace(/^running$/, 'run');
  const method = useGps ? `GPS ${base}` : base;
  // A free run has no distance and no finish time — the brief names the pace
  // to hold and hands the end over to the athlete.
  if (freeRun || !(distance > 0)) {
    const parts = ['Cardio mode.', `${method}, free run. End it when you are done.`];
    if (targetPaceSec > 0 && speakPace(targetPaceSec, unit)) parts.push(`Target pace, ${speakPace(targetPaceSec, unit)}.`);
    return { lines: parts, ready: 'Ready.', go: 'Go!' };
  }
  const parts = [
    'Cardio mode.',
    `${method}, ${speakDistance(distance, unit)}.`,
    `Target time, ${speakDuration(targetSec)}.`,
  ];
  if (eliteSec && eliteSec < targetSec) parts.push(`Elite time, ${speakDuration(eliteSec)}.`);
  return { lines: parts, ready: 'Ready.', go: 'Go!' };
}

// Interval / tabata intro for the time-based player: "Tabata. 8 rounds. 20
// seconds work, 10 seconds rest." Each "20 seconds work" is recorded whole: a
// number clip with "of work" glued after it was a second voice cutting in,
// and the bare "Work!" and "Rest." are the shouted calls.
export function buildIntervalIntro({ styleLabel = 'intervals', rounds, workSec, restSec, warmupSec = 0 }) {
  const parts = ['Cardio mode.', `${String(styleLabel).toLowerCase()}.`];
  if (rounds) {
    parts.push(`${unitOf(rounds, 'round')}.`);
    parts.push(restSec > 0 ? `${speakDuration(workSec)} work, ${speakDuration(restSec)} rest.` : `${speakDuration(workSec)} work. No rest.`);
  }
  if (warmupSec > 0) parts.push(`Warm up first: ${speakDuration(warmupSec)}.`);
  return { lines: parts, ready: 'Ready.', go: 'Go!' };
}

// Steady protocol (bike, rower, any timed machine): "Cardio mode." then
// "elliptical, steady for 20 minutes." "Steady for" is the recorded lead-in,
// so the number is never followed by a tail from another clip. The brief is the same line with "Go!" for
// a player that was started by hand.
const methodWord = (methodLabel) => String(methodLabel || 'cardio').toLowerCase();
export function buildSteadyIntro({ methodLabel, durationSeconds }) {
  return { lines: ['Cardio mode.', `${methodWord(methodLabel)}, steady for ${speakDuration(durationSeconds || 600)}.`], ready: 'Ready.', go: 'Go!' };
}
export function steadyBrief({ methodLabel, durationSeconds }) {
  return `${methodWord(methodLabel)}, steady for ${speakDuration(durationSeconds || 600)}. Go!`;
}

// The call at each segment change of the interval player.
export function protocolSegmentLine(sg, moveNames = null) {
  if (!sg) return '';
  if (sg.kind === 'work') {
    const move = moveNames && moveNames.length ? moveNames[(sg.round - 1 + moveNames.length) % moveNames.length] : null;
    return move ? `Round ${sg.round}. ${move}. Go!` : `Round ${sg.round}. ${sg.label === 'HARD' ? 'Hard!' : 'Work!'}`;
  }
  if (sg.kind === 'rest') return sg.label === 'REST' ? 'Rest.' : 'Recover. Easy pace.';
  if (sg.kind === 'warmup') return `Warm up. ${speakDuration(sg.seconds)}, easy.`;
  if (sg.kind === 'cooldown') return 'Cool down. Bring it down.';
  return '';
}

// A belt speed: "6" for 6.0, "6 point 5" for 6.5.
export const speakSpeed = (speed) => speakNumber(Math.round((Number(speed) || 0) * 10) / 10);
// With its unit, the way it is recorded: "6 point 5 mph". The guided
// programmes' speeds are recorded whole; a speed typed on the dial can be any
// tenth, and those are said from pieces (the one place a Cardio line may).
export const speakSpeedUnit = (speed, unit = 'mi') => `${speakSpeed(speed)} ${unit === 'km' ? 'kph' : 'mph'}`;

// Added to a machine run's brief.
export function machineSpeedLine(speed, unit = 'mi') {
  return `Set the machine to ${speakSpeedUnit(speed, unit)}, and match the dial if you change it.`;
}

// Added to a run's brief when the sprint chases are on.
export function chaseIntroLine({ threshold, win, loss }) {
  return `Intervals are on. When I call a sprint, beat your own pace by ${Math.round(threshold * 100)} percent, to escape and bank ${win} X P. Get caught and it costs ${loss} X P.`;
}
export const chaseStartLine = (windowSec) => `Sprint! ${speakDuration(windowSec)}. Go!`;
export const chaseResultLine = (pass, stakes) => (pass
  ? `Escaped. ${stakes.win} X P banked. Ease back.`
  : `Caught. ${stakes.loss} X P gone. Next one's yours. Ease back.`);

// Said at the end of a run with chases: " 3 chases, 2 escaped." The chase XP
// is on the result screen; said aloud it was a bare number in a sentence.
export function chaseSummaryLine(chase) {
  if (!chase || !(chase.attempts > 0)) return '';
  return ` ${unitOf(chase.attempts, 'chase')}, ${chase.passes > 0 ? `${chase.passes} escaped` : 'none escaped'}.`;
}

// Added to a run's brief when racing a ghost. A run ghost is mostly the
// athlete's own. Another owner's name may have no clip, so it is a sentence
// of its own and the rest of the line still plays without it.
export function ghostIntroLine(ghost) {
  const dur = speakDuration(ghost.totalSec);
  if (ghost.ownerId === 'me') return `Ghost mode. You are racing your own run, ${dur}. Beat it.`;
  return `Ghost mode. ${ghost.ownerName}. You are racing their run, ${dur}. Beat it.`;
}

// After the app was away mid-run (a call, a reload): "Run resumed at 12
// minutes. Distance so far: 2 miles." The numbers come after a recorded
// lead-in, never before a tail.
export function runResumedLine(elapsedSec, dist, unit = 'mi') {
  return `Run resumed at ${speakDuration(elapsedSec)}. ${dist > 0.05 ? `Distance so far: ${speakDistance(+dist.toFixed(2), unit)}.` : ''}`.trim();
}

// The last call of a guided programme, a free run, or a run ended early:
// "Run complete. 3 miles. Your time: 29 minutes, 14 seconds." No distance is
// said under a twentieth of a unit.
const distSentence = (dist, unit) => (dist > 0.05 ? ` ${cap(speakDistance(dist, unit))}.` : '');
export function programmeEndLine({ completed, noDistance, dist, unit = 'mi', elapsedSec }) {
  const where = noDistance ? '' : distSentence(dist, unit);
  if (completed) return `Programme complete.${where} Your time: ${speakDuration(elapsedSec)}. Good work.`;
  return `Programme ended at ${speakDuration(elapsedSec)}.${where}`;
}
export function freeRunEndLine({ dist, unit = 'mi', elapsedSec, chase = null }) {
  const pace = dist > 0.05 ? speakPace(elapsedSec / dist, unit) : '';
  const avg = pace ? ` Average pace: ${pace}.` : '';
  return `Run complete.${distSentence(dist, unit)} Your time: ${speakDuration(elapsedSec)}.${avg}${chaseSummaryLine(chase)}`;
}
export function runEndedLine({ dist, unit = 'mi', elapsedSec, chase = null }) {
  return `Run ended.${distSentence(dist, unit)} Your time: ${speakDuration(elapsedSec)}.${chaseSummaryLine(chase)}`;
}

// ── Milestones ───────────────────────────────────────────────────────────────

// Which markers were crossed between two distances. Splits are kept at every
// half unit (the split table shows them); tenths are visual only (a tick on
// the bar).
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

// Which of the crossed markers the coach calls. The owner's rule: track by the
// whole mile (or kilometre). A call at each half unit too is the athlete's
// option (HALF-MILE CALLS on the run setup), off unless they turn it on. Past
// a marathon a distance is said to the whole unit, so a half marker there
// would be called as the next mile; those halves are not called.
export function spokenMarkers(markers, halfCalls = false, unit = 'mi') {
  const limit = TENTHS_UP_TO[unit] || TENTHS_UP_TO.mi;
  return (markers || []).filter((m) => Math.abs(m - Math.round(m)) < 1e-9 || (halfCalls && m <= limit));
}

// Verdict of a running clock against target and elite. delta < 0 is ahead.
export function projectedFinish(dist, elapsedSec, goal) {
  if (!(dist > 0.05)) return null;
  return (elapsedSec / dist) * goal;
}

// "2 miles. 19 minutes, 40 seconds. Pace: 9 minutes, 50 seconds per mile.
// Ahead of target by 20 seconds." Inside the last unit it says what is left
// ("One mile to go."), and inside the last half "Empty the tank." "Halfway."
// only when the halfway point is a marker that is called.
const paceSentence = (paceSec, unit) => {
  const p = paceSec > 0 ? speakPace(paceSec, unit) : '';
  return p ? [`Pace: ${p}.`] : [];
};
export function splitScript({ marker, unit, elapsedSec, paceSec, targetPaceSec, goal, targetSec, eliteSec }) {
  const lines = [`${cap(speakDistance(marker, unit))}.`, `${speakDuration(elapsedSec)}.`, ...paceSentence(paceSec, unit)];
  const expectedAtMarker = targetPaceSec * marker;
  const delta = elapsedSec - expectedAtMarker; // negative = ahead of target
  const projected = projectedFinish(marker, elapsedSec, goal);
  if (projected != null && eliteSec && projected <= eliteSec) lines.push('You are on elite pace.');
  else if (delta <= -10) lines.push(`Ahead of target by ${speakDuration(-delta)}.`);
  else if (delta >= 10) lines.push(`Behind target by ${speakDuration(delta)}. Pick it up.`);
  else lines.push('Right on target.');
  const remaining = Math.round((goal - marker) * 10) / 10;
  if (remaining > 0 && remaining <= 1) lines.push(`${cap(speakDistance(remaining, unit))} to go.${remaining <= 0.5 ? ' Empty the tank.' : ''}`);
  else if (Math.abs(marker - goal / 2) < 1e-9) lines.push('Halfway.');
  return lines.join(' ');
}

// A split on a free run: no goal, so no "halfway" and no projected finish —
// the marker, the clock, the pace, and how that pace sits against the target.
export function freeRunSplitScript({ marker, unit, elapsedSec, paceSec, targetPaceSec }) {
  const lines = [`${cap(speakDistance(marker, unit))}.`, `${speakDuration(elapsedSec)}.`, ...paceSentence(paceSec, unit)];
  if (paceSec > 0 && targetPaceSec > 0) {
    const ratio = paceSec / targetPaceSec;
    if (ratio < 0.94) lines.push('Ahead of your target pace.');
    else if (ratio > 1.08) lines.push('Under your target pace. Pick it up.');
    else lines.push('Right on pace.');
  }
  return lines.join(' ');
}

// "Goal reached. 3 miles. Your time: 29 minutes, 14 seconds. Under target by
// 46 seconds. Good work."
export function finishScript({ dist, unit, elapsedSec, targetSec, eliteSec }) {
  const lines = ['Goal reached.', `${cap(speakDistance(dist, unit))}.`, `Your time: ${speakDuration(elapsedSec)}.`];
  const over = Math.round(elapsedSec - targetSec);
  if (eliteSec && elapsedSec <= eliteSec) lines.push('Elite time. Outstanding.');
  else if (over === 0) lines.push('Right on target. Good work.');
  else if (over < 0) lines.push(`Under target by ${speakDuration(-over)}. Good work.`);
  else lines.push(`Over target by ${speakDuration(over)}. Next time we take it.`);
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
// Weak-signal fallback: under trees or between tall buildings a phone can go a
// long stretch without a single 35 m fix, and every metre of it was dropped.
// After GPS_WEAK_SIGNAL_MS without a usable fix, callers pass this looser cap
// so the run keeps counting (the speed and jitter checks still apply).
export const GPS_RELAXED_ACCURACY_M = 50;
export const GPS_WEAK_SIGNAL_MS = 20000;
export const GPS_MAX_SPEED_MPS = 12;    // ~27 mph — nobody runs faster; it's a GPS jump
export const GPS_MIN_STEP_M = 3;        // sub-3m moves are jitter while standing still
// A step only counts when it is longer than this many times the WORSE of the
// two accuracies it was measured between. Scatter while standing is about the
// reported accuracy, so anything under ~2x it cannot be told from noise.
export const GPS_JITTER_K = 2;
// Phone-reported speed (coords.speed, doppler based) under this, over the last
// few fixes, means standing: noise cannot add distance then.
export const GPS_STILL_SPEED_MPS = 0.5;
export const GPS_STILL_FIXES = 3;
// ...but the speed is believed only while the position agrees. Some phones
// report a speed of 0 when they have no speed reading at all, and trusting
// that would count nothing for a whole run. Once the position is this far
// from the anchor (metres, or this many noise floors, whichever is more)
// while the phone still says "standing", the speed is ignored until the next
// reset and the noise floor alone does the work.
export const GPS_STILL_DOUBT_M = 40;
export const GPS_STILL_DOUBT_K = 4;
// A new anchor (start, resume, reload, or a position that shifted and stayed)
// needs this many fixes that agree with each other before it is trusted.
export const GPS_CONFIRM_FIXES = 3;
const GPS_SMOOTH_FIXES = 5;             // position = mean of the last few fixes...
const GPS_SMOOTH_MS = 6000;             // ...no older than this

const worseAcc = (a, b) => Math.max(Number.isFinite(a) ? a : 0, Number.isFinite(b) ? b : 0);

// Decide whether a fix advances the distance. Returns { accept, meters }.
// `prev` is the last ACCEPTED fix ({ lat, lng, t, accuracy }), `fix` the new
// one. Time in ms. This is the one-step rule; the players use
// createGpsTracker() below, which adds smoothing, standing still and re-basing.
// opts.relaxed: accept fixes up to GPS_RELAXED_ACCURACY_M (weak-signal fallback).
export function evaluateFix(prev, fix, opts = {}) {
  if (!fix || !Number.isFinite(fix.lat) || !Number.isFinite(fix.lng)) return { accept: false, meters: 0, reason: 'bad' };
  const maxAcc = opts.relaxed ? GPS_RELAXED_ACCURACY_M : GPS_MAX_ACCURACY_M;
  if (Number.isFinite(fix.accuracy) && fix.accuracy > maxAcc) return { accept: false, meters: 0, reason: 'accuracy' };
  if (!prev) return { accept: true, meters: 0, reason: 'first' };
  const d = haversineMeters(prev.lat, prev.lng, fix.lat, fix.lng);
  const dt = (fix.t - prev.t) / 1000;
  // Noise floor scales with the reported accuracy: a 20 m fix cannot resolve a 3 m move.
  const floor = Math.max(GPS_MIN_STEP_M, GPS_JITTER_K * worseAcc(prev.accuracy, fix.accuracy));
  if (d < floor) return { accept: false, meters: 0, reason: 'jitter' };
  if (dt > 0 && d / dt > GPS_MAX_SPEED_MPS) return { accept: false, meters: 0, reason: 'jump' };
  return { accept: true, meters: d, reason: 'ok' };
}

// Two fixes that could both be the same real place: closer than the speed
// limit allows plus their own accuracy.
function consistentFixes(a, b) {
  const dt = Math.abs(b.t - a.t) / 1000;
  const slack = 2 * worseAcc(a.accuracy, b.accuracy);
  return haversineMeters(a.lat, a.lng, b.lat, b.lng) <= GPS_MAX_SPEED_MPS * dt + slack;
}

function meanPos(fixes) {
  let la = 0; let ln = 0;
  for (const f of fixes) { la += f.lat; ln += f.lng; }
  return { lat: la / fixes.length, lng: ln / fixes.length };
}

// The stateful filter every GPS run uses. Distance is measured from the last
// COUNTED anchor, on positions smoothed over the last few seconds, and only
// counts once the move is longer than max(GPS_MIN_STEP_M, K x the worse
// accuracy). The anchor never moves on a rejected fix, so noise cannot add up
// step by step. Several fixes reporting ~0 speed mean standing: nothing counts.
// A start, resume or reload needs GPS_CONFIRM_FIXES fixes that agree before
// anything is measured, and a position that jumps and STAYS is re-based
// (anchor moved, no distance added) instead of counted as a long step.
//
// push(fix, { relaxed }) -> { accept, meters, reason, pos }
//   reasons: bad, accuracy (not a usable fix), pending (still confirming a new
//   anchor), first (anchor set, meters 0), rebase (anchor moved, meters 0),
//   jump, still, jitter (rejected), ok (counted; pos is the smoothed position).
// reset() forgets everything: call it when the run was away (pause, lock, reload).
export function createGpsTracker() {
  let anchor = null;   // { lat, lng, t, accuracy }: last counted (smoothed) position
  let cand = [];       // fixes waiting to become a trusted anchor
  let far = [];        // fixes rejected as impossible jumps that agree with each other
  let win = [];        // recent accepted raw fixes, for smoothing
  let speeds = [];     // recent { t, v } speed readings
  let speedLies = false; // the phone said "standing" while the position clearly moved

  const rebaseTo = (fixes, last, reason) => {
    const p = meanPos(fixes);
    anchor = { lat: p.lat, lng: p.lng, t: last.t, accuracy: last.accuracy };
    win = fixes.slice(-GPS_SMOOTH_FIXES);
    cand = [];
    far = [];
    speeds = [];
    return { accept: true, meters: 0, reason, pos: p };
  };

  const push = (fix, opts = {}) => {
    const v0 = evaluateFix(null, fix, opts);
    if (v0.reason === 'bad' || v0.reason === 'accuracy') return { accept: false, meters: 0, reason: v0.reason };
    if (!anchor) {
      if (cand.length && !consistentFixes(cand[cand.length - 1], fix)) cand = [];
      cand.push(fix);
      if (cand.length < GPS_CONFIRM_FIXES) return { accept: false, meters: 0, reason: 'pending' };
      return rebaseTo(cand, fix, 'first');
    }
    // Judge a jump against the previous fix, not the anchor: after minutes of
    // standing the anchor is old and would let a stray fix through.
    const ref = win.length ? win[win.length - 1] : anchor;
    if (!consistentFixes(ref, fix)) {
      // Too far, too fast. One stray fix is dropped; several that agree with
      // each other mean the position really moved (or a bad lock): re-base.
      if (far.length && !consistentFixes(far[far.length - 1], fix)) far = [];
      far.push(fix);
      if (far.length >= GPS_CONFIRM_FIXES) return rebaseTo(far, fix, 'rebase');
      return { accept: false, meters: 0, reason: 'jump' };
    }
    far = [];
    win.push(fix);
    while (win.length > GPS_SMOOTH_FIXES || (win.length > 1 && fix.t - win[0].t > GPS_SMOOTH_MS)) win.shift();
    if (Number.isFinite(fix.speed) && fix.speed >= 0) speeds.push({ t: fix.t, v: fix.speed });
    speeds = speeds.filter((s) => fix.t - s.t <= 10000).slice(-GPS_STILL_FIXES);
    const still = !speedLies && speeds.length >= GPS_STILL_FIXES && speeds.reduce((a, s) => a + s.v, 0) / speeds.length < GPS_STILL_SPEED_MPS;
    const pos = meanPos(win);
    const d = haversineMeters(anchor.lat, anchor.lng, pos.lat, pos.lng);
    const floor = Math.max(GPS_MIN_STEP_M, GPS_JITTER_K * worseAcc(anchor.accuracy, fix.accuracy));
    if (still) {
      if (d < Math.max(GPS_STILL_DOUBT_M, GPS_STILL_DOUBT_K * floor)) return { accept: false, meters: 0, reason: 'still' };
      speedLies = true; // far from the anchor while "standing": count this step and stop believing the speed
    }
    if (d < floor) return { accept: false, meters: 0, reason: 'jitter' };
    anchor = { lat: pos.lat, lng: pos.lng, t: fix.t, accuracy: fix.accuracy };
    return { accept: true, meters: d, reason: 'ok', pos };
  };

  const reset = () => { anchor = null; cand = []; far = []; win = []; speeds = []; speedLies = false; };
  return { push, reset, hasAnchor: () => !!anchor };
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

// ── Ghost racing ─────────────────────────────────────────────────────────────

// Gap between me and a ghost, in the ghost's own terms: distance (units, > 0 = I
// lead) and seconds (using my current pace to turn distance into time).
export function ghostGap({ myDist, ghostDist, paceSec }) {
  const dDist = myDist - ghostDist;
  const secs = paceSec > 0 ? dDist * paceSec : null;
  return { dDist, dSec: secs == null ? null : Math.round(secs) };
}

// 'lead' when clearly ahead, 'trail' when clearly behind, 'even' inside the
// dead-band (about 8 seconds at pace, or 15 m with no pace yet).
export function ghostVerdict(gap, unit = 'mi') {
  if (!gap) return 'even';
  if (gap.dSec != null) {
    if (gap.dSec >= 8) return 'lead';
    if (gap.dSec <= -8) return 'trail';
    return 'even';
  }
  const band = 15 / metersPerUnit(unit);
  if (gap.dDist >= band) return 'lead';
  if (gap.dDist <= -band) return 'trail';
  return 'even';
}

// With no pace to turn it into time, the gap is said in meters: to the ten
// under 100, to the fifty up to a kilometre (those are recorded), and past
// that as a distance ("0 point 7 miles").
export function speakGap(gap, unit = 'mi') {
  if (gap?.dSec != null && Math.abs(gap.dSec) >= 5) return `${speakDuration(Math.abs(gap.dSec))}`;
  const m = Math.abs(gap?.dDist || 0) * metersPerUnit(unit);
  if (m >= 1000) return speakDistance(Math.abs(gap.dDist), unit);
  const meters = m < 95 ? Math.max(10, Math.round(m / 10) * 10) : Math.round(m / 50) * 50;
  return meters >= 1000 ? speakDistance(Math.abs(gap.dDist), unit) : `${meters} meters`;
}

export const GHOST_CUES = {
  lead: [
    'You are beating your ghost. Great job. Keep it there.',
    'Ahead of your ghost by {gap}. Do not let it back in.',
    'Your ghost is behind you. Stay smooth, stay ahead.',
    'You are winning this race by {gap}.',
  ],
  trail: [
    'Your ghost is winning. Chase it down.',
    'Ghost is ahead by {gap}. Close the gap.',
    'You are behind your ghost. Pick the pace up and reel it in.',
    'The ghost is getting away. {gap}. Go get it.',
  ],
  even: [
    'Neck and neck with your ghost. Push now and take the lead.',
    'Dead level with your ghost. This is where you win it.',
  ],
};

export function ghostCue(verdict, gap, unit, lastIndex, rnd = Math.random) {
  const pool = GHOST_CUES[verdict] || GHOST_CUES.even;
  const pick = pickCue(pool, lastIndex, rnd);
  return { text: pick.text.replace('{gap}', speakGap(gap, unit)), index: pick.index };
}

// Added to a split call: "One mile. … Ahead of your ghost by 15 seconds."
export function ghostSplitLine({ marker, elapsedSec, ghostTimeAtMarker }) {
  if (ghostTimeAtMarker == null) return '';
  const delta = Math.round(elapsedSec - ghostTimeAtMarker); // < 0 = I got here first
  if (Math.abs(delta) < 3) return 'Level with your ghost.';
  return delta < 0 ? `Ahead of your ghost by ${speakDuration(-delta)}.` : `Behind your ghost by ${speakDuration(delta)}.`;
}

// The athlete's own run (ownerId 'me') is "your ghost": the owner name on it
// is their profile name, which has no clip. Another owner's run is not theirs,
// so it is "the ghost", with the owner's name in a sentence of its own ahead
// of the verdict.
export function ghostFinishLine({ elapsedSec, ghostTotalSec, ownerName = 'your ghost', ownerId = 'me' }) {
  const delta = Math.round(elapsedSec - ghostTotalSec);
  if (ownerId === 'me') {
    if (Math.abs(delta) < 2) return 'Dead heat with your ghost. A draw.';
    if (delta < 0) return `Ghost defeated. You beat your ghost by ${speakDuration(-delta)}.`;
    return `The ghost takes this one by ${speakDuration(delta)}. Run it back.`;
  }
  const named = ownerName && ownerName !== 'YOU' && ownerName !== 'your ghost' ? `${ownerName}. ` : '';
  if (Math.abs(delta) < 2) return `${named}Dead heat. A draw.`;
  if (delta < 0) return `${named}Ghost defeated. You beat the ghost by ${speakDuration(-delta)}.`;
  return `${named}The ghost takes this one by ${speakDuration(delta)}. Run it back.`;
}
