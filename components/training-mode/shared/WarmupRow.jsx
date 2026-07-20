// LT-3 — WARM-UP setup row: OFF · 5 · 10 · 15 · 20 MIN.
// Remembers the last choice PER FEATURE, because a warm-up before Combat
// Conditioning and a warm-up before Combo Coach are different habits.
const TEAL = '#2dd4bf';
const OPTIONS = [0, 5, 10, 15, 20];

const KEY = (feature) => `tm_warmup_${feature}`;

export function loadWarmup(feature) {
  try {
    const v = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY(feature)) : null;
    const n = v === null ? 0 : parseInt(v, 10);
    return OPTIONS.includes(n) ? n : 0;
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
  const set = (v) => { saveWarmup(feature, v); onChange(v); };

  return (
    <div>
      <div style={{
        fontFamily: "'Orbitron',sans-serif", fontWeight: 700, color: '#c4a4d8',
        fontSize: 8.5, letterSpacing: '0.16em', marginBottom: 5,
      }}>WARM-UP</div>
      <div style={{ display: 'flex', gap: 6 }}>
        {OPTIONS.map(o => {
          const active = o === value;
          return (
            <button key={o} onClick={() => set(o)} style={{
              flex: 1, textAlign: 'center', padding: '8px 0', borderRadius: 8,
              fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 9.5,
              letterSpacing: '0.03em', cursor: 'pointer',
              background: active ? TEAL : 'rgba(16,4,30,0.8)',
              border: active ? 'none' : `1px solid ${TEAL}44`,
              color: active ? '#04211d' : '#9ff0e4',
              transition: 'all 0.18s ease',
            }}>{o === 0 ? 'OFF' : `${o}`}</button>
          );
        })}
      </div>
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
