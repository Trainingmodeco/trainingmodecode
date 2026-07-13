import { useState } from 'react';
import { C } from '../Styles';

// Full-width stacked row: label on the left, then − [ typable value ] +.
// The centre value is an editable number field (digits only); `display` formats
// the resting value, `editDisplay` the value while typing, `parse` reads it back,
// and `unit` is a small suffix shown next to the resting value.
export function StepperRow({ label, value, unit, min, max, step = 1, onChange, accent = '#a855f7', display, editDisplay, parse }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const round = (v) => Math.round(v * 100) / 100;
  const clamp = (v) => Math.min(max, Math.max(min, v));
  const resting = display ? display(value) : String(value);
  const btn = {
    width: 28, height: 28, borderRadius: 7, border: `1px solid ${accent}66`, color: accent,
    fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 16, lineHeight: 1,
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
    background: `${accent}14`, flexShrink: 0,
  };
  const commit = () => {
    setEditing(false);
    const raw = parse ? parse(text) : parseFloat(text);
    if (Number.isFinite(raw)) onChange(round(clamp(raw)));
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'rgba(8,2,18,0.82)', border: '1px solid rgba(168,85,247,0.25)', borderRadius: 11, padding: '6px 10px' }}>
      <span style={{ flex: 1, minWidth: 0, fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 11, letterSpacing: '0.07em', color: '#d9d1ef' }}>{label}</span>
      <button onClick={() => onChange(round(clamp(value - step)))} style={btn}>−</button>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 62 }}>
        <input
          value={editing ? text : resting}
          inputMode="decimal"
          onFocus={() => { setEditing(true); setText(editDisplay ? editDisplay(value) : String(value)); }}
          onChange={(e) => setText(e.target.value.replace(/[^0-9.]/g, ''))}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
          style={{
            width: 62, textAlign: 'center', background: 'transparent', border: 'none', outline: 'none',
            fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 15, color: '#fff', padding: 0,
            caretColor: accent,
          }}
        />
        {unit && !editing && <span style={{ position: 'absolute', right: 6, fontSize: 9, color: '#8b83a8', pointerEvents: 'none' }}>{unit}</span>}
      </div>
      <button onClick={() => onChange(round(clamp(value + step)))} style={btn}>+</button>
    </div>
  );
}

// Full-width read-only row (e.g. TOTAL): label left, value right, no controls.
export function TotalRow({ label, value, accent = C.gold }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'rgba(8,2,18,0.5)', border: '1px dashed rgba(168,85,247,0.25)', borderRadius: 11, padding: '7px 12px' }}>
      <span style={{ flex: 1, fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 11, letterSpacing: '0.07em', color: '#c4a4d8' }}>{label}</span>
      <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 15, color: accent }}>{value}</span>
    </div>
  );
}

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
