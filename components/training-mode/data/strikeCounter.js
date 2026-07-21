// 1.4 — accelerometer strike counter (detection core).
//
// Pure, framework-free so it can be unit-tested with synthetic signals and
// reused by every Fight Mode feature via useStrikeCounter. Feed it raw
// DeviceMotion samples; it returns a running count of detected strikes.
//
// Pipeline: gravity removal → magnitude → adaptive threshold → peak detection
// with a refractory window. A punch (even with the phone in a pocket or on an
// armband) shows up as a short, sharp acceleration spike well above the resting
// noise floor.

// All accelerations are in m/s². 1 g ≈ 9.81.
const DEFAULTS = {
  minThreshold: 12,     // absolute floor for a spike (~1.2 g of linear accel)
  peakFactor: 3.0,      // a spike must also be this many× the rolling noise floor
  refractoryMs: 200,    // ignore new strikes for this long after one (design spec)
  rearmRatio: 0.5,      // must fall back below threshold×this before the next peak
  gravityAlpha: 0.85,   // low-pass factor for the gravity estimate (high-pass)
  noiseAlpha: 0.98,     // very slow EMA for the resting noise floor
};

export function createStrikeDetector(opts = {}) {
  const cfg = { ...DEFAULTS, ...opts };
  let gx = 0, gy = 0, gz = 0;       // running gravity estimate
  let gravityInit = false;
  let noiseFloor = 2;                // resting linear-accel magnitude EMA
  let lastStrikeAt = -Infinity;
  let armed = true;                  // hysteresis: ready to accept the next peak
  let count = 0;

  // ax/ay/az: accelerationIncludingGravity (m/s²). If linear (gravity-excluded)
  // acceleration is available, pass it and hasGravity=false to skip the
  // high-pass. tMs: a monotonic timestamp in ms.
  function onSample(ax, ay, az, hasGravity, tMs) {
    if (ax == null || ay == null || az == null) return count;

    let lx, ly, lz;
    if (hasGravity) {
      // High-pass: estimate gravity with a slow low-pass, subtract it out.
      if (!gravityInit) { gx = ax; gy = ay; gz = az; gravityInit = true; }
      const a = cfg.gravityAlpha;
      gx = a * gx + (1 - a) * ax;
      gy = a * gy + (1 - a) * ay;
      gz = a * gz + (1 - a) * az;
      lx = ax - gx; ly = ay - gy; lz = az - gz;
    } else {
      lx = ax; ly = ay; lz = az;
    }

    const mag = Math.sqrt(lx * lx + ly * ly + lz * lz);
    const threshold = Math.max(cfg.minThreshold, noiseFloor * cfg.peakFactor);

    if (mag > threshold) {
      if (armed && tMs - lastStrikeAt >= cfg.refractoryMs) {
        count++;
        lastStrikeAt = tMs;
        armed = false;
      }
    } else {
      // Only let the quiet stretches shape the noise floor, and re-arm once the
      // signal has clearly dropped back down.
      noiseFloor = cfg.noiseAlpha * noiseFloor + (1 - cfg.noiseAlpha) * mag;
      if (mag < threshold * cfg.rearmRatio) armed = true;
    }

    return count;
  }

  return {
    onSample,
    get count() { return count; },
    reset() {
      gx = gy = gz = 0; gravityInit = false;
      noiseFloor = 2; lastStrikeAt = -Infinity; armed = true; count = 0;
    },
  };
}
