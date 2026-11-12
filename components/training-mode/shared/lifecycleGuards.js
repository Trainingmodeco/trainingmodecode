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
