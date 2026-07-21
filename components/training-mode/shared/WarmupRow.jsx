import { StepperRow } from './Stepper';

// LT-3 — WARM-UP setup row. Rendered as a stepper (WARM-UP  −  10:00  +) so it
// matches the round controls above it; 0 reads as OFF. Remembers the last
// choice PER FEATURE, because a warm-up before Combat Conditioning and a
// warm-up before Combo Coach are different habits.
const TEAL = '#2dd4bf';
const MAX_MIN = 20;

const KEY = (feature) => `tm_warmup_${feature}`;

const clampMin = (n) => Math.max(0, Math.min(MAX_MIN, Math.round(n)));
// mm:ss for the resting value; OFF at zero.
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

export default function WarmupRow({ feature, value, onChange }) {
  const set = (v) => { const n = clampMin(v); saveWarmup(feature, n); onChange(n); };

  return (
    <div>
      <StepperRow
        label="WARM-UP"
        value={value}
        min={0}
        max={MAX_MIN}
        step={5}
        display={fmtWarmup}
        editDisplay={(v) => String(v)}
        parse={(s) => parseInt(s, 10)}
        onChange={set}
        accent={TEAL}
      />
      {value > 0 && (
        <div style={{
          fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 9.5,
          color: '#8b83a8', marginTop: 4, paddingLeft: 2,
        }}>
          {value} min of loosening up before round 1. No XP, skippable any time.
        </div>
      )}
    </div>
  );
}
