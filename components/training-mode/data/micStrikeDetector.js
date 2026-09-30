// Bag-hit detector from the microphone — for the phone on the floor or the
// bag frame, where the accelerometer feels little or nothing. A heavy bag
// makes a short, loud thud on every hit; the phone next to your own bag
// hears yours far louder than the gym music or the next bag over.
//
// Fed one peak level per audio frame (≈10 ms). The noise floor is a LOW
// PERCENTILE of the last few seconds of frames, not a running average:
// between punches in a flurry the thud decays back to near-silence, so the
// quiet frames keep the floor honest even when the hitting is continuous.
// That is the failure the accelerometer detector has — its average floor
// rises during a flurry and it goes deaf exactly when the athlete works
// hardest.
export const MIC_DEFAULTS = {
  factor: 4,            // a hit must be this many× the floor
  minLevel: 0.04,       // and at least this loud (0–1 full scale)
  refractoryMs: 90,     // one hit per 90 ms at most (≈11 a second)
  rearm: 0.55,          // level must fall under threshold × this before the next hit
  floorWindowMs: 3000,
  floorPercentile: 0.3,
};

export function createMicStrikeDetector(opts = {}) {
  const cfg = { ...MIC_DEFAULTS, ...opts };
  let frames = [];      // { t, p }
  let count = 0;
  let lastHitAt = -Infinity;
  let armed = true;
  let floor = 0;
  let muteUntil = -Infinity;

  function floorNow(t) {
    const cut = t - cfg.floorWindowMs;
    while (frames.length && frames[0].t < cut) frames.shift();
    if (frames.length < 10) return floor;
    const sorted = frames.map(f => f.p).sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length * cfg.floorPercentile)];
  }

  return {
    onFrame(peak, t) {
      const p = Math.max(0, Number(peak) || 0);
      frames.push({ t, p });
      floor = floorNow(t);
      const threshold = Math.max(cfg.minLevel, floor * cfg.factor);
      // Warm-up: no floor yet means no honest threshold — hold for 10 frames.
      if (t < muteUntil || frames.length < 10) return { count, hit: false, threshold, floor };
      if (!armed && p < threshold * cfg.rearm) armed = true;
      let hit = false;
      if (armed && p >= threshold && t - lastHitAt >= cfg.refractoryMs) {
        count += 1; lastHitAt = t; armed = false; hit = true;
      }
      return { count, hit, threshold, floor };
    },
    // Ignore the next `ms` — the phone's own beep would read as a hit.
    mute(t, ms) { muteUntil = t + ms; },
    set(opts2) { Object.assign(cfg, opts2); },
    reset() { frames = []; count = 0; lastHitAt = -Infinity; armed = true; floor = 0; muteUntil = -Infinity; },
    get count() { return count; },
  };
}
