import { GPS_MAX_ACCURACY_M } from './runCoach';

// How long START will wait for GPS before starting anyway. Owner call: no
// second tap — the run begins the moment GPS locks, or after this at most.
export const GPS_LOCK_MAX_MS = 20000;

/**
 * Wait until the phone delivers a usable fix (inside the normal accuracy cap),
 * so the first stretch of a run isn't lost to a cold GPS chip. Also warms the
 * chip, so the player's own watch gets fast fixes straight after.
 *
 * Resolves 'live' | 'timeout' | 'denied' | 'unsupported' | 'cancelled'.
 * Never rejects: a run must start whatever GPS does.
 */
export function waitForGpsLock({ maxMs = GPS_LOCK_MAX_MS, isCancelled = () => false } = {}) {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) { resolve('unsupported'); return; }
    let id = null;
    let poll = null;
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearInterval(poll);
      try { if (id != null) navigator.geolocation.clearWatch(id); } catch { /* ignore */ }
      resolve(result);
    };
    const timer = setTimeout(() => finish('timeout'), maxMs);
    poll = setInterval(() => { if (isCancelled()) finish('cancelled'); }, 250);
    try {
      id = navigator.geolocation.watchPosition(
        (pos) => {
          const acc = pos?.coords?.accuracy;
          if (!Number.isFinite(acc) || acc <= GPS_MAX_ACCURACY_M) finish('live');
        },
        (err) => { if (err && err.code === 1) finish('denied'); },
        { enableHighAccuracy: true, maximumAge: 0, timeout: maxMs },
      );
    } catch {
      finish('unsupported');
    }
  });
}
