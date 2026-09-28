import { useState } from 'react';
import { C } from '../Styles';

// The Simplify revamp's stepper row: 46px, label left, then − [ typable value ] +.
// The centre value is an editable number field (digits only); `display` formats
// the resting value, `editDisplay` the value while typing, `parse` reads it back,
// and `unit` is a small suffix shown next to the resting value.
//
// Two tones, both from the design. `fight` (royal blue buttons that turn gold
// under the pointer) is the Fight Timer setups'. `red` is Combat
// Conditioning's Customize rows: red row border and red buttons, gold units.
const TONES = {
  fight: {
    row: '#0B0F22', rowBorder: 'rgba(61,123,255,0.22)',
    btnBg: 'rgba(61,123,255,0.1)', btnBorder: 'rgba(61,123,255,0.6)', btnColor: '#8FB4FF',
    unit: '#8FB4FF', label: '#FFFFFF',
  },
  red: {
    row: '#0B0F22', rowBorder: 'rgba(239,68,68,0.32)',
    btnBg: 'linear-gradient(180deg,#EF4444,#B91C1C)', btnBorder: 'rgba(255,150,150,0.55)', btnColor: '#FFFFFF',
    unit: '#F2BE45', label: '#FFFFFF',
  },
};

export const stepperCSS = `
.st-btn { transition: border-color .18s ease, color .18s ease, box-shadow .18s ease; }
.st-btn:hover, .st-btn:focus-visible { border-color: #F2BE45 !important; box-shadow: 0 0 10px rgba(242,190,69,.35); }
.st-btn.fight:hover, .st-btn.fight:focus-visible { color: #F2BE45 !important; }
.st-btn:active { transform: scale(0.94); }
`;

export function StepperRow({ label, value, unit, min, max, step = 1, onChange, display, editDisplay, parse, tone = 'fight' }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const t = TONES[tone] || TONES.fight;
  const round = (v) => Math.round(v * 100) / 100;
  const clamp = (v) => Math.min(max, Math.max(min, v));
  const resting = display ? display(value) : String(value);
  const btn = {
    width: 34, height: 34, borderRadius: 8, border: `1px solid ${t.btnBorder}`, color: t.btnColor,
    background: t.btnBg, fontFamily: "'Chakra Petch',sans-serif", fontWeight: 700, fontSize: 18, lineHeight: 1,
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
  };
  const commit = () => {
    setEditing(false);
    const raw = parse ? parse(text) : parseFloat(text);
    if (Number.isFinite(raw)) onChange(round(clamp(raw)));
  };
  return (
    <div style={{ height: 40, boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 8, background: t.row, border: `1px solid ${t.rowBorder}`, borderRadius: 12, padding: '0 8px 0 14px' }}>
      <style>{stepperCSS}</style>
      <span style={{ flex: 1, minWidth: 0, fontFamily: "'Chakra Petch',sans-serif", fontWeight: 700, fontSize: 13, letterSpacing: '0.12em', color: t.label }}>{label}</span>
      <button type="button" className={`st-btn ${tone}`} aria-label={`Decrease ${String(label).toLowerCase()}`} onClick={() => onChange(round(clamp(value - step)))} style={btn}>−</button>
      <div style={{ width: 70, display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 2 }}>
        <input
          aria-label={label}
          value={editing ? text : resting}
          inputMode="decimal"
          onFocus={() => { setEditing(true); setText(editDisplay ? editDisplay(value) : String(value)); }}
          onChange={(e) => setText(e.target.value.replace(/[^0-9.]/g, ''))}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
          style={{
            width: 52, textAlign: 'center', background: 'transparent', border: 'none', outline: 'none',
            fontFamily: "'Chakra Petch',sans-serif", fontWeight: 700, fontSize: 18, color: '#fff', padding: 0,
            caretColor: '#F2BE45',
          }}
        />
        {unit && !editing && <span style={{ fontSize: 10, color: t.unit, pointerEvents: 'none' }}>{unit}</span>}
      </div>
      <button type="button" className={`st-btn ${tone}`} aria-label={`Increase ${String(label).toLowerCase()}`} onClick={() => onChange(round(clamp(value + step)))} style={btn}>+</button>
    </div>
  );
}

// Full-width read-only row (e.g. TOTAL): label left, value right, no controls.
// Dashed gold, so it reads as a result of the rows above rather than a control.
export function TotalRow({ label, value }) {
  return (
    <div style={{ height: 34, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px', borderRadius: 12, border: '1px dashed rgba(242,190,69,0.35)' }}>
      <span style={{ fontFamily: "'Chakra Petch',sans-serif", fontWeight: 700, fontSize: 13, letterSpacing: '0.12em', color: '#A9B4D6' }}>{label}</span>
      <span style={{ fontFamily: "'Chakra Petch',sans-serif", fontWeight: 700, fontSize: 18, color: '#F2BE45' }}>{value}</span>
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
