// The live run. One cardio session at a time, written to storage on every
// meaningful change so the OS can take the app away — a phone call, the screen
// locking, a swipe to another app — and the run is still THERE when the
// athlete comes back, with the clock still correct.
//
// The clock is wall time: `startedAt` plus accumulated pause time, never a
// counter that ticks. A counter stops the moment the browser throttles a
// background tab; a timestamp does not care. That is what "the timer keeps
// running regardless" means in practice.
//
// Distance is a different story. A web app cannot read GPS while it is not on
// screen, so meters covered while the app was hidden are NOT recovered — the
// clock keeps running, the distance resumes from the last fix. The player says
// so on screen rather than pretending. (The native wrapper closes that gap.)

const KEY = 'tm_live_run';
const MAX_AGE_MS = 12 * 60 * 60 * 1000;
export const LIVE_RUN_VERSION = 1;

export function loadLiveRun() {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const run = JSON.parse(raw);
    if (!run || run.v !== LIVE_RUN_VERSION || !run.startedAt) return null;
    if (Date.now() - (run.updatedAt || run.startedAt) > MAX_AGE_MS) { localStorage.removeItem(KEY); return null; }
    return run;
  } catch {
    return null;
  }
}

export function saveLiveRun(run) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...run, v: LIVE_RUN_VERSION, updatedAt: Date.now() }));
  } catch { /* quota */ }
}

export function clearLiveRun() {
  if (typeof localStorage === 'undefined') return;
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

// Elapsed seconds for a run, from its timestamps alone. Works on a run loaded
// from storage exactly as on a live one.
export function liveRunElapsedSec(run, now = Date.now()) {
  if (!run?.startedAt) return 0;
  const pausedNow = run.pausedAt ? now - run.pausedAt : 0;
  const ms = now - run.startedAt - (run.pauseAccumMs || 0) - pausedNow + (run.offsetMs || 0);
  return Math.max(0, ms / 1000);
}
