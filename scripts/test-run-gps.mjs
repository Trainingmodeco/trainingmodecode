// GPS fix filter (data/runCoach.js evaluateFix) — the rules every run's
// distance depends on. Run: npm run test:gps
import {
  evaluateFix, haversineMeters, GPS_MAX_ACCURACY_M, GPS_RELAXED_ACCURACY_M,
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
check('35 m fix accepted (strict)', evaluateFix(start, north(start, 20, 5, GPS_MAX_ACCURACY_M)).accept);
check('40 m fix rejected (strict)', evaluateFix(start, north(start, 20, 5, 40)).reason === 'accuracy');
check('40 m fix accepted (relaxed)', evaluateFix(start, north(start, 20, 5, 40), { relaxed: true }).accept);
check('50 m fix accepted (relaxed)', evaluateFix(start, north(start, 20, 5, GPS_RELAXED_ACCURACY_M), { relaxed: true }).accept);
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

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
