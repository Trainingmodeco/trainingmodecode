// The grid the rep-pace slider moves on. A pace that is not on it (say 1800 ms)
// is run as-is but drawn by the slider on the nearest step with a label that
// reads 1.80 s, so the screen and the beat disagree. Every player snaps the
// pace it starts from, so what runs is what the slider shows.

export const CADENCE_MIN_MS = 750;
export const CADENCE_MAX_MS = 4000;
export const CADENCE_STEP_MS = 250;

/** Round a pace to the slider grid and clamp it into the slider's range. */
export function snapCadenceMs(ms, fallback = 2000) {
  const n = Number(ms);
  const base = Number.isFinite(n) && n > 0 ? n : fallback;
  const stepped = Math.round(base / CADENCE_STEP_MS) * CADENCE_STEP_MS;
  return Math.min(CADENCE_MAX_MS, Math.max(CADENCE_MIN_MS, stepped));
}
