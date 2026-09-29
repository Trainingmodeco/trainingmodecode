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

export function loadWarmup(feature) {
  try {
    const v = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY(feature)) : null;
    const n = v === null ? 0 : parseInt(v, 10);
    return Number.isFinite(n) ? clampMin(n) : 0;
  } catch {
    return 0;
  }
}

export function saveWarmup(feature, minutes) {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(KEY(feature), String(minutes));
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
