// A wait that actually stops when the athlete hits PAUSE.
//
// The bug this replaces, which appeared in four rep players independently:
//
//   const start = Date.now();
//   while (Date.now() - start < cadenceMs) {
//     if (pausedRef.current) { await delay(100); continue; }
//     await delay(50);
//   }
//
// That reads as pause-aware but is not. `Date.now()` keeps advancing while
// paused, so the deadline expires *during* the pause and the loop falls
// through — the next rep is counted, spoken and beeped as if nothing happened.
// Pausing mid-set did not stop the count.
//
// The fix is to accumulate only unpaused time. Wall-clock deltas are still used
// (not a fixed tick count) so the cadence stays accurate when the event loop is
// busy or the tab throttles timers.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Wait `ms` of *unpaused* time.
 *
 * @param {number} ms          how long to wait, excluding paused time
 * @param {object} opts
 * @param {() => boolean} opts.isPaused    true while the session is paused
 * @param {() => boolean} [opts.isStale]   true when this run has been superseded
 * @param {number} [opts.tickMs=60]        polling granularity
 * @returns {Promise<boolean>} true if the wait completed, false if it went stale
 */
export async function waitUnpaused(ms, { isPaused, isStale, tickMs = 60 } = {}) {
  let elapsed = 0;
  let last = Date.now();
  while (elapsed < ms) {
    if (isStale?.()) return false;
    await sleep(tickMs);
    const now = Date.now();
    if (!isPaused?.()) elapsed += now - last;
    last = now;
  }
  return !isStale?.();
}

/**
 * Block until unpaused. Use before an action that must never fire mid-pause —
 * counting a rep out loud, ringing a bell.
 *
 * @returns {Promise<boolean>} false if the run went stale while waiting
 */
export async function awaitResume({ isPaused, isStale, tickMs = 100 } = {}) {
  while (isPaused?.()) {
    if (isStale?.()) return false;
    await sleep(tickMs);
  }
  return !isStale?.();
}
