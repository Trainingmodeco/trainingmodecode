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

// ---------------------------------------------------------------------------
// The beat clock: a rep count that keeps the slider's pace.
//
// A loop that waits `interval - (time the last number took to say)` and then
// awaits the voice runs slow whenever a number takes longer than the interval
// (a long count at 0.75 s/rep ran at about 1.3 to 1.9 s/rep). A setInterval
// avoids that but keeps ticking through a pause, so the first rep after
// RESUME lands anywhere in 0 to one interval.
//
// The clock keeps the due time of the next beat. Each beat is due one
// interval after the one before it, measured on the wall clock, so what the
// voice does never moves it; the caller says the number WITHOUT awaiting it
// (dropIfBusy) and drops a number that cannot start on time. A pause hands
// the whole clock back: the next beat is due a FULL interval after RESUME.

/**
 * @param {{ now?: () => number }} [opts]  now() is injectable for tests
 * @returns {{ due: number, now: () => number }}
 */
export function createBeatClock({ now = Date.now } = {}) {
  return { due: now(), now };
}

/**
 * Wait for the next beat, `ms` after the previous one.
 *
 * @param {{ due: number, now: () => number }} clock  from createBeatClock
 * @param {number} ms                      the beat interval
 * @param {object} opts
 * @param {() => boolean} opts.isPaused    true while the session is paused
 * @param {() => boolean} [opts.isStale]   true when this run has been superseded
 * @param {number} [opts.tickMs=40]        polling granularity
 * @param {(ms: number) => Promise<void>} [opts.sleepFn]  injectable for tests
 * @returns {Promise<boolean>} true when the beat is due now (and not paused);
 *   false if the run went stale
 */
export async function waitBeat(clock, ms, { isPaused, isStale, tickMs = 40, sleepFn = sleep } = {}) {
  clock.due += ms;
  let wasPaused = false;
  while (true) {
    if (isStale?.()) return false;
    const t = clock.now();
    if (isPaused?.()) {
      wasPaused = true;
      await sleepFn(tickMs);
      continue;
    }
    if (wasPaused) {
      // First look after a pause: the beat restarts a full interval from now.
      wasPaused = false;
      clock.due = t + ms;
    } else if (t >= clock.due) {
      return true;
    }
    await sleepFn(Math.min(tickMs, Math.max(1, clock.due - t)));
  }
}
