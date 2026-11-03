import { StepperRow } from './Stepper';

// WARM-UP setup row. Exactly the same control as ROUNDS / ROUND REST — a − / +
// stepper with the value in the middle (tappable to type an exact number of
// minutes). 1-minute steps, 0 = OFF (no warm-up). Value shows as mm:ss.
// Remembers the last choice PER FEATURE (a warm-up before Combat Conditioning
// and one before Combo Coach are different habits).
const MAX_MIN = 60;

const KEY = (feature) => `tm_warmup_${feature}`;

const clampMin = (n) => Math.max(0, Math.min(MAX_MIN, Math.round(n)));
const fmtWarmup = (v) => (v <= 0 ? 'OFF' : `${v}:00`);

// `fallback` is what a feature gets before the athlete has ever chosen. The
// Fight setups keep OFF; Build Workout starts at 5 minutes.
export function loadWarmup(feature, fallback = 0) {
  try {
    const v = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY(feature)) : null;
    const n = v === null ? fallback : parseInt(v, 10);
    return Number.isFinite(n) ? clampMin(n) : fallback;
  } catch {
    return fallback;
  }
}

export function saveWarmup(feature, minutes) {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(KEY(feature), String(minutes));
  } catch {}
}

// The warm-up idea last picked under the ring (Build Workout's chips), per
// feature like the length: tm_warmup_<feature>_pick.
export function loadWarmupPick(feature) {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(`${KEY(feature)}_pick`) : null;
  } catch {
    return null;
  }
}

export function saveWarmupPick(feature, id) {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(`${KEY(feature)}_pick`, String(id));
  } catch {}
}

export default function WarmupRow({ feature, value, onChange, tone }) {
  const set = (v) => { const n = clampMin(v); saveWarmup(feature, n); onChange(n); };

  // The warm-up row matches the rows it sits among — a teal row used to break
  // the stack on every setup screen.
  return (
    <StepperRow
      label="WARM-UP"
      value={value}
      min={0}
      max={MAX_MIN}
      step={1}
      display={fmtWarmup}
      editDisplay={(v) => String(v)}
      parse={(s) => parseInt(s, 10)}
      onChange={set}
      tone={tone}
    />
  );
}
