import { C } from '../Styles';

// − value + stepper matching the Combat Conditioning setup, with a tunable accent.
// `display` optionally formats the value (e.g. seconds → m:ss); `unit` is a small
// suffix shown after the (formatted) value.
export default function Stepper({ label, value, unit, min, max, step = 1, onChange, accent = '#a855f7', display }) {
  const btn = {
    width: 26, height: 26, borderRadius: 6, border: `1px solid ${accent}66`, color: accent,
    fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 15, lineHeight: 1,
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: 'transparent', flexShrink: 0,
  };
  const round = (v) => Math.round(v * 100) / 100;
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 700, color: '#c4a4d8', fontSize: 8, letterSpacing: '0.16em', marginBottom: 7 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(8,2,18,0.8)', border: '1px solid rgba(168,85,247,0.25)', borderRadius: 9, padding: '7px 10px' }}>
        <button onClick={() => onChange(round(Math.max(min, value - step)))} style={btn}>−</button>
        <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 13, color: '#fff', whiteSpace: 'nowrap' }}>
          {display ? display(value) : value}{unit && <span style={{ fontSize: 8, color: C.faint, marginLeft: 1 }}>{unit}</span>}
        </span>
        <button onClick={() => onChange(round(Math.min(max, value + step)))} style={btn}>+</button>
      </div>
    </div>
  );
}
