# PROMPT REVAMP-CC-3 — Cardio Mode GPS tracker: wake lock + honest fix filter

**Scope: the two GPS trackers in the running surfaces — Combat
Conditioning's cardio addon and the standalone Run screen. Nothing else.**

Run this in the revamp app repo. It brings **GPS tracking accuracy** up
to the state that shipped to `apptrainingmode.com` at commit `3f2b04a`
on `trainingmodeco/trainingmodecode`, branch `app`.

Every path and constant here was verified against the working tree of
the app repo on 2026-09-30. **Read the two source files below** before
writing — the revamp must match them line-close, not paraphrase.

**Reference source** — read from `trainingmodeco/trainingmodecode`,
branch `app`, at commit `3f2b04a`:

| Purpose | Path |
|---|---|
| Combat Conditioning cardio addon | `components/training-mode/CardioProtocolPlayer.jsx` |
| Standalone Run screen | `components/training-mode/RunPlayer.jsx` |
| Fix-quality helper (evaluateFix) | `components/training-mode/data/runCoach.js` (already exists — reused, not changed) |

**Ledger of commits this prompt combines:**

| Commit | Summary |
|---|---|
| `3f2b04a` | GPS runs: hold the screen awake, keep the fixes when the phone unlocks |

---

## 0. What we are trying to do

A live-athlete report: an actual ~1.9 mi run (Google Maps verified,
Samsung Health measured 1.86 mi) came back as **0.59 mi** in Combat
Conditioning cardio mode. Pace read **1:09:42 per mile**. Elapsed time
was correct. Distance was 30% of reality.

Two silent bugs stacked on top of each other:

**Bug A — the phone-lock trap.** A PWA loses GPS the moment the phone
screen locks. Browsers suspend the tab and
`navigator.geolocation.watchPosition` stops firing callbacks entirely.
Samsung Health / Nike Run Club / Google Maps get around this with a
native "background location" permission we don't have as a website.
When the athlete said "I didn't have the app on consistently" — that IS
the mechanism. Every second the screen was off, no GPS points recorded.

**Bug B — the harsh 75-metre filter.** `CardioProtocolPlayer` had a
`d > 1 && d < 75` cap that dropped any single-fix delta over 75 metres
as "impossible". When the phone locked for 30 seconds and unlocked
100+ metres later, that fix was silently discarded — a real move being
thrown away because the filter didn't know how much time had passed.

The revamp app has BOTH bugs.

---

## 1. THE FIX FILTER — `CardioProtocolPlayer.jsx`

### 1.1 Add `evaluateFix` to the runCoach imports

The revamp's `data/runCoach.js` should already export `evaluateFix`
(the standalone Run screen has been using it). If it doesn't, port the
function first — it lives in the reference at
`components/training-mode/data/runCoach.js:264`. The public shape:

```js
export const GPS_MAX_ACCURACY_M = 35;   // reject fixes the phone itself says are worse than this
export const GPS_MAX_SPEED_MPS = 12;    // ~27 mph — nobody runs faster; it's a GPS jump
export const GPS_MIN_STEP_M = 2;        // sub-2m moves are jitter while standing still

export function evaluateFix(prev, fix) {
  // returns { accept, meters, reason }
  //   reason: 'bad' | 'accuracy' | 'first' | 'jitter' | 'jump' | 'ok'
}
```

In `CardioProtocolPlayer.jsx` add `evaluateFix` to the existing import
from runCoach:

```js
import { buildIntervalIntro, speakDuration, evaluateFix } from './data/runCoach';
```

### 1.2 Delete the local `haversineMeters` helper

Once `evaluateFix` is doing the maths, the local `haversineMeters`
helper defined near the top of the file is unused. Remove it — lint
will fail otherwise.

### 1.3 Rewrite the GPS effect

The current effect (roughly at `CardioProtocolPlayer.jsx:452-477` in
the reference) sets up `watchPosition` once, filters with the raw
`d > 1 && d < 75` cap, and tears down on unmount. Replace it with the
version below. Verbatim from the reference — copy, don't paraphrase.

```jsx
// Live GPS. Two things a live-athlete found:
//  (1) The old filter dropped any single-fix delta > 75 m as "impossible",
//      but a phone that locked mid-run gives you a 200 m fix on the very
//      next unlock — still a real move, just spread over the lock period.
//      Swapped for evaluateFix() which checks speed (d/dt) with a real
//      timestamp, so a 200 m move over 45 s (~10 mph, running) is kept
//      and a 200 m move over 2 s (100 mph, a GPS jump) is rejected.
//  (2) A screen wake-lock is requested for the life of the run so the
//      phone won't sleep the tab in the first place — this is what
//      actually kept 1.4 mi from ever reaching the meter.
useEffect(() => {
  if (!useGps || !distanceMode || !running) return undefined;
  if (typeof navigator === 'undefined' || !navigator.geolocation) return undefined;

  let wakeLock = null;
  const acquireWakeLock = async () => {
    try {
      if ('wakeLock' in navigator && !wakeLock) {
        wakeLock = await navigator.wakeLock.request('screen');
      }
    } catch { /* best effort — Safari, permissions, etc. */ }
  };
  const releaseWakeLock = () => {
    if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
  };

  let id = null;
  const startWatch = () => {
    if (id != null) return;
    id = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, speed, accuracy } = pos.coords;
        const t = pos.timestamp || Date.now();
        const fix = { lat: latitude, lng: longitude, t, accuracy };
        const verdict = evaluateFix(gpsRef.current.last, fix);
        if (!verdict.accept) {
          if (verdict.reason !== 'first' && verdict.reason !== 'jitter') {
            // an 'accuracy' or 'jump' reject still counts as a live fix
            setGpsFix(true);
          }
          if (verdict.reason === 'first') gpsRef.current.last = fix;
          return;
        }
        if (verdict.meters > 0) {
          gpsRef.current.meters += verdict.meters;
          setGpsMeters(gpsRef.current.meters);
        }
        gpsRef.current.last = fix;
        gpsRef.current.pts.push({ lat: latitude, lng: longitude });
        if (gpsRef.current.pts.length > 240) gpsRef.current.pts.shift();
        setGpsRoute(gpsRef.current.pts.slice());
        if (typeof speed === 'number' && speed >= 0) setGpsSpeed(speed);
        setGpsFix(true);
      },
      () => { setGpsFix(false); },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 12000 },
    );
    gpsRef.current.watchId = id;
  };
  const stopWatch = () => {
    if (id != null && navigator.geolocation) navigator.geolocation.clearWatch(id);
    id = null;
  };

  // Some browsers keep watchPosition registered while the tab is hidden
  // but stop delivering fixes. On visibility flipping back to 'visible',
  // reacquire the wake-lock (which the OS revokes on hide) and restart
  // the watch so the next fix is treated as a fresh baseline. The
  // haversine between the last accepted fix and the first post-resume
  // fix still counts, provided evaluateFix accepts it.
  const onVisibility = () => {
    if (document.visibilityState === 'visible') {
      acquireWakeLock();
      stopWatch();
      startWatch();
    }
  };

  acquireWakeLock();
  startWatch();
  document.addEventListener('visibilitychange', onVisibility);

  return () => {
    document.removeEventListener('visibilitychange', onVisibility);
    stopWatch();
    releaseWakeLock();
  };
}, [useGps, distanceMode, running]);
```

Notes:

- `gpsRef.current.last` now stores a full **fix object** `{ lat, lng, t,
  accuracy }`, not just `{ lat, lng }`. `evaluateFix` needs the
  timestamp for its speed check.
- The 'first' reason from `evaluateFix` sets `gpsRef.current.last` so
  the next fix has a baseline to compute distance from, but does NOT
  accrue distance (the first fix has nothing to measure against).
- `wakeLock.request('screen')` and `wakeLock.release()` are the Screen
  Wake Lock API — supported in Chrome mobile since v84, Safari 16.4+,
  and every Android WebView.

---

## 2. THE STANDALONE RUN SCREEN — `RunPlayer.jsx`

`RunPlayer` already uses `evaluateFix`, so its filter is fine. It's
still missing the wake-lock + visibility-resume layer. Add both.

### 2.1 Refactor the GPS effect

Find the effect that mounts the `watchPosition` (roughly at
`RunPlayer.jsx:354-401` in the reference). Wrap its inner `watchPosition`
call in the same `startWatch` / `stopWatch` / `acquireWakeLock` /
`releaseWakeLock` scaffolding used above. The onFix and onErr callbacks
stay exactly as they were.

Copy verbatim from `components/training-mode/RunPlayer.jsx:354-449` in
the reference. The shape (paraphrased for clarity — take the real diff
from the ref):

```jsx
useEffect(() => {
  if (!useGps || phase === 'done') return undefined;
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    setGpsStatus('denied'); onGpsDenied?.(); return undefined;
  }

  let wakeLock = null;
  const acquireWakeLock = async () => { /* same as §1.3 */ };
  const releaseWakeLock = () => { /* same as §1.3 */ };

  let staleTimer = null;
  const armStale = () => { /* keep existing 20 s stale detector */ };

  const onFix = (pos) => { /* keep the existing accrue logic */ };
  const onErr = (err) => { /* keep the existing denied/acquiring logic */ };
  const watchOpts = { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 };

  let id = null;
  const startWatch = () => {
    if (id != null) return;
    id = navigator.geolocation.watchPosition(onFix, onErr, watchOpts);
  };
  const stopWatch = () => {
    if (id != null && navigator.geolocation) navigator.geolocation.clearWatch(id);
    id = null;
  };
  const onVisibility = () => {
    if (document.visibilityState === 'visible') {
      acquireWakeLock();
      stopWatch();
      startWatch();
    }
  };

  acquireWakeLock();
  startWatch();
  document.addEventListener('visibilitychange', onVisibility);

  return () => {
    document.removeEventListener('visibilitychange', onVisibility);
    clearTimeout(staleTimer);
    stopWatch();
    releaseWakeLock();
  };
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [useGps, phase === 'done']);
```

Do not change `evaluateFix`, `armStale`, or any of the existing
`onFix` / `onErr` bodies. Just wrap them so the wake-lock and the
visibility resume attach.

---

## 3. WHAT THIS PROMPT DELIBERATELY DOES NOT DO

- No new native wrapper (Capacitor, React Native, etc.). This stays a
  pure PWA fix. The remaining gap versus a native tracker — an athlete
  who backgrounds the app to open Maps / take a call still loses
  tracking for that window — is a separate lift.
- No changes to `evaluateFix` itself. The thresholds (35 m accuracy,
  12 m/s max speed, 2 m minimum step) shipped tested; don't retune.
- No changes to route-drawing, split-tracking, ghost-racing, XP,
  cardio addon dispatch, or the completion screen.
- No changes to `CardioMode.jsx` (the setup) — the fix is entirely in
  the two player screens.

---

## 4. VERIFICATION — on a real phone, on a real road

The unit tests can't see this — GPS runs are physical. Do the two
walks below and post the numbers:

### 4.1 The wake-lock walk

- Start a Combat Conditioning cardio addon in GPS mode (Distance
  target, `NONE` equipment). Or a standalone Run.
- Put the phone in your pocket, screen up if it fits, and walk a
  measured mile (a track lap is 4 laps; a residential block is often
  ~0.25 mi — check with Google Maps first).
- The screen should **stay lit for the whole walk** (that IS the wake
  lock working). Chrome will show a small "screen awake" icon on
  some Android builds.
- After a full mile the tracker should read **0.95 to 1.05 mi**,
  matching Google Maps.
- **Fail case** (bug not fixed): the screen turns off partway through
  and the tracker returns anything below 0.7 mi.

### 4.2 The deliberate-lock walk

- Start a GPS run.
- Walk 100 m in a straight line.
- Lock the phone deliberately with the power button. Keep walking for
  another 100 m.
- Unlock, walk another 100 m.
- Stop.
- Tracker should read **0.18 to 0.20 mi** — the first-post-unlock fix
  will now be kept (was being dropped by the `< 75 m` filter) and its
  distance credited by haversine.
- **Fail case**: tracker reads below 0.13 mi (only the pre-lock and
  post-second-lock segments; the middle segment dropped).

---

## 5. DONE MEANS

- `npm run typecheck` — 0 errors.
- `npm run lint` — 0 errors, 0 warnings. (Remove the unused
  `haversineMeters` helper as §1.2 says — leaving it in triggers a
  no-unused-vars warning.)
- `npm run test:indoor` — 56 passed / 0 failed (unchanged).
- `npm run test:cardio` — 39 passed / 0 failed (unchanged).
- `npm run audit:cc` — Failures: 0 (unchanged).
- `npm run build:web` — exit 0.
- The **wake-lock walk** in §4.1 returns 0.95 – 1.05 mi for a real mile.
- The **deliberate-lock walk** in §4.2 returns 0.18 – 0.20 mi and
  neither segment is silently dropped.

If all six items pass, ship it.

---

## 6. HONEST LIMITATION — say this out loud

This is a PWA fix. It closes most of the gap versus Samsung Health /
Nike Run Club / native trackers, but not all of it:

- **Wake lock keeps the screen on**, so the tab isn't suspended.
- **It cannot override the user opening another app.** If an athlete
  switches to Maps mid-run or takes a call, the OS will still hide
  the tab and GPS still stops firing for that window. The visibility
  resume then picks up when they come back.
- **Ambient locks (screen timeout) are the ones the wake-lock defeats.**
  Deliberate locks / app switches / phone-off are on the athlete.

If we ever want the same GPS behaviour as a native tracker even with
the screen off, that's a Capacitor wrap with the
`ACCESS_BACKGROUND_LOCATION` permission. Not this prompt.
