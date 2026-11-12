// Small lifecycle helpers with no React in them, so Node tests can run them.
// The hooks that use them are hooks/useWakeLock.js and hooks/useLater.js.

// Holds one screen wake lock for one effect run. The browser's request is
// async: if the run is cleaned up (PAUSE, end of session, unmount) before the
// lock arrives, the late lock is released the moment it lands instead of being
// kept, which used to leave the screen awake after the workout.
export function createWakeLockHolder(getNav, onChange = () => {}) {
  let lock = null;
  let pending = false;
  let alive = true;

  async function request() {
    if (!alive || lock || pending) return;
    const nav = getNav();
    if (!nav || !nav.wakeLock) return;
    pending = true;
    try {
      const got = await nav.wakeLock.request('screen');
      if (!alive) {
        try { await got.release(); } catch (_e) { /* ignored */ }
        return;
      }
      lock = got;
      onChange(true);
      got.addEventListener('release', () => {
        if (lock === got) { lock = null; onChange(false); }
      });
    } catch (_e) {
      onChange(false);
    } finally {
      pending = false;
    }
  }

  async function dispose() {
    alive = false;
    const held = lock;
    lock = null;
    if (held) {
      try { await held.release(); } catch (_e) { /* ignored */ }
      onChange(false);
    }
  }

  return { request, dispose, isHeld: () => !!lock };
}

// setTimeout that can be cancelled all at once. End-of-session lines and the
// hand-off to the summary run a moment after the last bell; if the athlete
// leaves in that gap they must not fire on another screen.
export function createTimerBag() {
  const ids = new Set();
  return {
    later(fn, ms) {
      const id = setTimeout(() => { ids.delete(id); fn(); }, ms);
      ids.add(id);
      return id;
    },
    clearAll() {
      ids.forEach(clearTimeout);
      ids.clear();
    },
    size: () => ids.size,
  };
}

// Auto-pause when the page is hidden while a session is running (the logic of
// hooks/useAutoPauseOnHidden.js). `check` is called on every visibilitychange
// AND whenever the session turns running: a count-in or the Fight Focus
// finisher counts as not running, so a page hidden during one never fires a
// visibilitychange once it ends, and the round used to run on in the
// background. After settleMs it re-reads hidden/running, then leaves a
// picture-in-picture window alone (the athlete is still watching the clock).
export function createHiddenPauseWatcher({
  doc, isRunning, pause, cancelSpeech = () => {}, noteHonestPause = () => {},
  settleMs = 400, setTimer = setTimeout, clearTimer = clearTimeout,
}) {
  let pending = null;
  return {
    check() {
      clearTimer(pending);
      if (!doc.hidden || !isRunning()) return;
      pending = setTimer(() => {
        if (!doc.hidden || !isRunning()) return;
        if (doc.pictureInPictureElement) {
          // Still an honest background event, not a cheat signal.
          noteHonestPause();
          return;
        }
        cancelSpeech();
        pause();
        noteHonestPause();
      }, settleMs);
    },
    dispose() { clearTimer(pending); },
  };
}

// Bank a run once. `end` is a session-end handler that writes XP and the
// session row; the returned handler ignores a second call for the same
// screen's run (a double tap, a timer firing after the hand-off). The run is
// marked only after `end` has returned: a finish that threw (the stats write
// on a full storage) banked nothing, so the athlete's retry must go through.
export function bankOnce(ref, screen, end) {
  return (...args) => {
    if (ref.current === screen) return undefined;
    const out = end(...args);
    ref.current = screen;
    return out;
  };
}
