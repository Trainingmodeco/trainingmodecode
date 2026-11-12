// GPS fix filter (data/runCoach.js evaluateFix) — the rules every run's
// distance depends on. Run: npm run test:gps
import { readFileSync } from 'node:fs';
import {
  evaluateFix, haversineMeters, createGpsTracker, GPS_MAX_ACCURACY_M, GPS_RELAXED_ACCURACY_M, GPS_WEAK_SIGNAL_MS,
} from '../components/training-mode/data/runCoach.js';

let fail = 0;
let pass = 0;
const check = (name, cond, extra = '') => {
  if (cond) { pass++; } else { fail++; console.log(`FAIL  ${name} ${extra}`); }
};

// ~111,320 m per degree of latitude; move north by metres.
const north = (fix, meters, dtSec, accuracy = 8) => ({
  lat: fix.lat + meters / 111320, lng: fix.lng, t: fix.t + dtSec * 1000, accuracy,
});
const start = { lat: 40.0, lng: -74.0, t: 1_000_000, accuracy: 8 };

// First fix is always the anchor.
check('first fix accepted', evaluateFix(null, start).reason === 'first');

// Accuracy caps.
// A fix this loose can only resolve a move longer than twice its accuracy, so
// these use 100 m over 20 s (5 m/s) rather than a 20 m step.
check('35 m fix accepted (strict)', evaluateFix(start, north(start, 100, 20, GPS_MAX_ACCURACY_M)).accept);
check('40 m fix rejected (strict)', evaluateFix(start, north(start, 20, 5, 40)).reason === 'accuracy');
check('40 m fix accepted (relaxed)', evaluateFix(start, north(start, 100, 20, 40), { relaxed: true }).accept);
check('50 m fix accepted (relaxed)', evaluateFix(start, north(start, 120, 20, GPS_RELAXED_ACCURACY_M), { relaxed: true }).accept);
check('60 m fix rejected even relaxed', evaluateFix(start, north(start, 20, 5, 60), { relaxed: true }).reason === 'accuracy');

// Speed check (the CC-3 cases): a real move after a locked phone is kept,
// a GPS jump is not.
const locked = evaluateFix(start, north(start, 200, 45));
check('200 m over 45 s kept', locked.accept && Math.abs(locked.meters - 200) < 1, JSON.stringify(locked));
check('200 m over 2 s rejected as a jump', evaluateFix(start, north(start, 200, 2)).reason === 'jump');

// Jitter: tiny moves while standing still don't count.
check('1 m move is jitter', evaluateFix(start, north(start, 1, 1)).reason === 'jitter');

// A slow walk with frequent fixes: each 1 s step (1.4 m) is under the jitter
// floor, but the players keep the anchor until a move is accepted, so the
// distance still adds up.
let anchor = start;
let meters = 0;
let fix = start;
for (let i = 0; i < 600; i++) { // 10 minutes at 1.4 m/s = 840 m
  fix = north(fix, 1.4, 1);
  const v = evaluateFix(anchor, fix);
  if (v.accept) { meters += v.meters; anchor = fix; }
}
const truth = haversineMeters(start.lat, start.lng, fix.lat, fix.lng);
check('slow walk distance within 2%', Math.abs(meters - truth) / truth < 0.02, `${meters.toFixed(1)} vs ${truth.toFixed(1)}`);

// A weak-signal stretch: 45 s of 42 m fixes mid-run. Strict drops it all;
// relaxed (what the players switch to after 20 s) keeps it.
const weak = north(start, 120, 45, 42);
check('weak stretch dropped strict', evaluateFix(start, weak).reason === 'accuracy');
check('weak stretch kept relaxed', evaluateFix(start, weak, { relaxed: true }).accept);

// ── The tracker the players use: noise must not count as movement ───────────
// Seeded generator, written here so the suite never touches Math.random or the
// clock. Phone-like fixes: position noise (white, or smooth AR(1) that drifts
// the way real fixes do), a reported accuracy, and the doppler speed.
const VERBOSE = !!process.env.GPS_SIM_VERBOSE;
const rng = (seed) => {
  let s = seed;
  const u = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const g = () => { let a = 0; while (!a) a = u(); return Math.sqrt(-2 * Math.log(a)) * Math.cos(2 * Math.PI * u()); };
  return { u, g };
};
const M_LAT = 111320;
const M_LNG = 111320 * Math.cos((40 * Math.PI) / 180);
const T0 = 1_000_000_000;
// noise: { kind: 'uni' | 'white' | 'ar1' | 'ar1uni', s }. 'uni' is +-s square, 'ar1uni' the
// same spread but smooth (rho 0.9). hasSpeed false = a browser that reports no speed.
function makeTrack({ dur, vel, noise, acc, seed, hasSpeed = true, from = 0, to = dur, shift = null }) {
  const r = rng(seed);
  const out = [];
  let nx = 0; let ny = 0;
  for (let t = from; t <= to; t++) {
    if (noise.kind === 'white') { nx = noise.s * r.g(); ny = noise.s * r.g(); }
    else if (noise.kind === 'uni') { nx = (r.u() * 2 - 1) * noise.s; ny = (r.u() * 2 - 1) * noise.s; }
    else {
      const rho = noise.rho ?? 0.9;
      const sd = noise.kind === 'ar1uni' ? noise.s / 1.7 : noise.s;
      const inn = sd * Math.sqrt(1 - rho * rho);
      nx = rho * nx + inn * r.g(); ny = rho * ny + inn * r.g();
    }
    const extra = shift ? shift(t) : 0;
    out.push({
      lat: 40 + (vel * t + ny + extra) / M_LAT, lng: -74 + nx / M_LNG, t: T0 + t * 1000, accuracy: acc,
      speed: hasSpeed ? Math.max(0, vel + 0.12 * r.g()) : null,
    });
  }
  return out;
}
// The rule before the tracker (floor max(2, accuracy/4), anchor moved on every
// accepted fix), kept here only for the before column of the numbers table.
const oldRule = (prev, fix) => {
  if (!prev) return { accept: true, meters: 0 };
  const d = haversineMeters(prev.lat, prev.lng, fix.lat, fix.lng);
  const dt = (fix.t - prev.t) / 1000;
  if (d < Math.max(2, fix.accuracy / 4)) return { accept: false, meters: 0 };
  if (dt > 0 && d / dt > 12) return { accept: false, meters: 0 };
  return { accept: true, meters: d };
};
const measureOld = (fixes, opts) => {
  let a = null; let m = 0;
  for (const f of fixes) {
    if (f.accuracy > (opts?.relaxed ? GPS_RELAXED_ACCURACY_M : GPS_MAX_ACCURACY_M)) continue;
    const v = oldRule(a, f);
    if (v.accept) { m += v.meters; a = f; }
  }
  return m;
};
const measureNew = (fixes, opts) => { const tr = createGpsTracker(); let m = 0; for (const f of fixes) m += tr.push(f, opts).meters; return m; };
const row = (label, fixes, truth, opts) => {
  const o = measureOld(fixes, opts); const n = measureNew(fixes, opts);
  if (VERBOSE) console.log(`${label.padEnd(58)} true ${String(Math.round(truth)).padStart(5)}  before ${String(Math.round(o)).padStart(5)}  after ${String(Math.round(n)).padStart(5)}${truth ? `  (${(100 * (n - truth) / truth).toFixed(1)}%)` : ''}`);
  return n;
};

// a) standing still 5 minutes, +-10 m noise, any reported accuracy: ~nothing counts.
for (const acc of [5, 10, 20, 30]) {
  for (const kind of ['uni', 'ar1uni']) {
    for (const seed of [11, 12, 13]) {
      const m = row(`stand 300 s ${kind} +-10 m acc ${acc} seed ${seed}`, makeTrack({ dur: 300, vel: 0, noise: { kind, s: 10 }, acc, seed }), 0);
      check(`standing ${kind} acc ${acc} seed ${seed} under 30 m`, m < 30, `${m.toFixed(0)} m`);
    }
  }
}
// ...and with no speed reading at all (a browser that reports null), the
// reported accuracy has to do the work: noise louder than it is not fully
// caught, but still two orders better than before.
for (const acc of [5, 10, 20, 30]) {
  for (const kind of ['uni', 'ar1uni']) {
    const fx = makeTrack({ dur: 300, vel: 0, noise: { kind, s: 10 }, acc, seed: 21, hasSpeed: false });
    const m = row(`stand 300 s ${kind} +-10 m acc ${acc} NO SPEED`, fx, 0);
    check(`standing no speed ${kind} acc ${acc} under 150 m`, m < 150, `${m.toFixed(0)} m`);
  }
}

// b) a 3 km run at 6:00 per km: within 3 percent, noise or not.
for (const hasSpeed of [true, false]) {
  for (const [nm, noise] of [['white s3', { kind: 'white', s: 3 }], ['ar1 s3', { kind: 'ar1', s: 3 }], ['ar1 s3 rho .97', { kind: 'ar1', s: 3, rho: 0.97 }]]) {
    for (const seed of [31, 32]) {
      const m = row(`3 km @6:00/km ${nm} acc 6 seed ${seed}${hasSpeed ? '' : ' NO SPEED'}`, makeTrack({ dur: 1080, vel: 1000 / 360, noise, acc: 6, seed, hasSpeed }), 3000);
      check(`3 km run ${nm} seed ${seed} speed ${hasSpeed} within 3%`, Math.abs(m - 3000) / 3000 < 0.03, `${m.toFixed(0)} m`);
    }
  }
}

// c) walking at 1.4 m/s for 10 minutes: within 5 percent, also under a poor signal.
for (const [nm, noise, acc] of [['white s3 acc 6', { kind: 'white', s: 3 }, 6], ['ar1 s3 acc 6', { kind: 'ar1', s: 3 }, 6], ['white s6 acc 12', { kind: 'white', s: 6 }, 12], ['ar1 s10 acc 20', { kind: 'ar1', s: 10 }, 20]]) {
  const m = row(`walk 1.4 m/s 600 s ${nm}`, makeTrack({ dur: 600, vel: 1.4, noise, acc, seed: 41 }), 840);
  check(`walk ${nm} within 5%`, Math.abs(m - 840) / 840 < 0.05, `${m.toFixed(0)} m`);
}

// Stop and go: 5 min running, a 60 s red light with noise, 5 min running.
{
  const r = rng(51);
  const fixes = [];
  let dist = 0;
  let nx = 0; let ny = 0;
  for (let t = 0; t <= 660; t++) {
    const standing = t >= 300 && t < 360;
    if (!standing) dist += 3;
    nx = 0.9 * nx + 1.3 * r.g(); ny = 0.9 * ny + 1.3 * r.g();
    fixes.push({ lat: 40 + (dist + ny) / M_LAT, lng: -74 + nx / M_LNG, t: T0 + t * 1000, accuracy: 8, speed: standing ? 0.1 * Math.abs(r.g()) : Math.max(0, 3 + 0.12 * r.g()) });
  }
  const m = row('stop and go: 600 s at 3 m/s with a 60 s red light', fixes, dist);
  check('stop and go within 3%', Math.abs(m - dist) / dist < 0.03, `${m.toFixed(0)} vs ${dist}`);
}

// Single spike: one fix 300 m away is dropped and the run goes on unharmed.
{
  const fixes = makeTrack({ dur: 120, vel: 3, noise: { kind: 'white', s: 2 }, acc: 6, seed: 61 });
  fixes[60] = { ...fixes[60], lat: fixes[60].lat + 300 / M_LAT };
  const tr = createGpsTracker();
  let m = 0; let reason60 = '';
  fixes.forEach((f, i) => { const v = tr.push(f); m += v.meters; if (i === 60) reason60 = v.reason; });
  check('single spike rejected', reason60 === 'jump', reason60);
  // The 300 m is not counted; what is held back is the start (3 fixes to trust
  // the anchor) and the last step's worth, about 20 m of 360.
  check('single spike adds nothing', m < 365 && m > 360 - 30, `${m.toFixed(0)} vs 360`);
}

// Persistent shift: the position jumps 300 m and stays. That is a bad lock, not
// distance: it is re-based with nothing added (the old rule counted ~+300 m).
{
  const fixes = makeTrack({ dur: 300, vel: 3, noise: { kind: 'white', s: 2 }, acc: 8, seed: 62, shift: (t) => (t >= 100 ? 300 : 0) });
  const m = row('persistent 300 m shift at 100 s (true 900 m)', fixes, 900);
  check('persistent shift not counted', m < 900 * 1.03 && m > 900 * 0.9, `${m.toFixed(0)} vs 900`);
}
// A glitch that lasts 15 s and comes back (the old rule counted it twice).
{
  const fixes = makeTrack({ dur: 120, vel: 3, noise: { kind: 'white', s: 2 }, acc: 8, seed: 63, shift: (t) => (t >= 40 && t < 55 ? 150 : 0) });
  const m = row('150 m multipath glitch for 15 s (true 360 m)', fixes, 360);
  // Old rule: 584 (the 150 m counted going out and again coming back). Now the
  // glitch is re-based each way and only the ~45 m run during it is lost.
  check('15 s glitch not counted twice', m < 365 && m > 360 - 90, `${m.toFixed(0)} vs 360`);
}
// Garbage first fix: 200 m off, then the real track. Nothing phantom, and the
// run is measured from the real track (the old rule counted +121 m).
{
  const fixes = makeTrack({ dur: 200, vel: 3, noise: { kind: 'white', s: 2 }, acc: 30, seed: 64 });
  fixes[0] = { ...fixes[0], lat: fixes[0].lat + 200 / M_LAT };
  const m = row('garbage first fix 200 m off, acc 30 (true 600 m)', fixes, 600);
  check('garbage first fix adds no phantom distance', m < 600 * 1.03 && m > 600 * 0.9, `${m.toFixed(0)} vs 600`);
}
// The tunnel: 45 s with no fixes, then 200 m on. The chord is real and counts.
{
  const a = makeTrack({ dur: 100, vel: 4.4, noise: { kind: 'white', s: 2 }, acc: 6, seed: 65, to: 60 });
  const b = makeTrack({ dur: 100, vel: 4.4, noise: { kind: 'white', s: 2 }, acc: 6, seed: 66, from: 105, to: 160 });
  const m = row('tunnel: 45 s with no fixes, 200 m chord (true 704 m)', [...a, ...b], 4.4 * 160);
  check('tunnel chord counted', Math.abs(m - 4.4 * 160) / (4.4 * 160) < 0.06, `${m.toFixed(0)} vs 704`);
}
// Pause and resume: reset() forgets the anchor, so moving while paused adds
// nothing, and the first fixes after resume only re-establish the anchor.
{
  const tr = createGpsTracker();
  let m = 0;
  for (const f of makeTrack({ dur: 60, vel: 3, noise: { kind: 'white', s: 2 }, acc: 6, seed: 67 })) m += tr.push(f).meters;
  const before = m;
  tr.reset();
  for (const f of makeTrack({ dur: 0, vel: 0, noise: { kind: 'white', s: 2 }, acc: 6, seed: 68, from: 400, to: 400 })) {
    // 2 km from where we were, a long time later
    const v = tr.push({ ...f, lat: f.lat + 2000 / M_LAT, t: T0 + 400_000 });
    m += v.meters;
    check('first fix after resume is not trusted yet', v.reason === 'pending' && v.meters === 0, v.reason);
  }
  check('pause and resume add nothing', m === before, `${m} vs ${before}`);
}
// Weak signal: 3 minutes at 4 m/s with 42 m fixes. Strict drops every one;
// relaxed (what the players switch to after GPS_WEAK_SIGNAL_MS) still counts
// the run, in long steps.
{
  const weakFixes = makeTrack({ dur: 180, vel: 4, noise: { kind: 'white', s: 8 }, acc: 42, seed: 69 });
  check('weak fixes dropped on strict', measureNew(weakFixes) === 0);
  const m = measureNew(weakFixes, { relaxed: true });
  row('weak signal 180 s at 4 m/s, acc 42, relaxed (true 720 m)', weakFixes, 720, { relaxed: true });
  check('weak signal relaxed still counts the run', m > 720 * 0.75 && m < 720 * 1.1, `${m.toFixed(0)} vs 720`);
  check('weak signal window constant is sane', GPS_WEAK_SIGNAL_MS === 20000);
}
// The cost: a slow walk on a poor signal is counted late and short (a 50 m
// noise floor means up to 50 m held back at any moment), and a crawl under the
// still speed counts nothing while the phone reports its speed.
{
  const m = row('slow walk 0.8 m/s 600 s acc 25 (true 480 m)', makeTrack({ dur: 600, vel: 0.8, noise: { kind: 'ar1', s: 8 }, acc: 25, seed: 71 }), 480);
  check('slow walk on a poor signal counts, short by at most the floor', m > 480 - 2 * 25 - 10 && m < 480 * 1.05, `${m.toFixed(0)} vs 480`);
  const crawl = row('crawl 0.3 m/s 600 s acc 6 (true 180 m)', makeTrack({ dur: 600, vel: 0.3, noise: { kind: 'white', s: 2 }, acc: 6, seed: 72 }), 180);
  check('a crawl under 0.5 m/s counts nothing (known cost)', crawl === 0, `${crawl.toFixed(0)} m`);
}

// The PACE chip reads the speed state. A stop produces only 'still' or
// 'jitter' rejects, so the speed must be updated before the reject return or
// the chip keeps the last running pace while the runner stands.
{
  const src = readFileSync(new URL('../components/training-mode/CardioProtocolPlayer.jsx', import.meta.url), 'utf8');
  const push = src.indexOf('tracker.push(fix');
  const set = src.indexOf('setGpsSpeed(speed)', push);
  const gate = src.indexOf('if (!verdict.accept)', push);
  check('cardio PACE speed updates before the reject return', push > 0 && set > push && set < gate);
  check('cardio speed is set in one place only', src.split('setGpsSpeed(speed)').length === 2);
}

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
