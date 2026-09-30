import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { C } from '../Styles';
import { ARCADE } from '../ArcadeUI';
import TrainingCTA from './TrainingCTA';

const GOLD = C.yellow;
const HEAD = "'Orbitron',sans-serif";
const BODY = "'Rajdhani',sans-serif";

// Bounds per unit. Fifteen miles covers a half marathon with room; nobody
// sets a marathon on a phone slider, and the field beside it takes any number.
const BOUNDS = {
  mi: { min: 0.5, max: 15, step: 0.5, quick: [1, 2, 3, 5, 10, 13.1] },
  km: { min: 1, max: 24, step: 0.5, quick: [1, 3, 5, 8, 10, 21.1] },
};

// A centred popup for the optional distance target. A run is FREE by default —
// this is the one place a finish line gets set, and CLEAR takes it away again.
export default function DistanceTargetModal({ value, unit = 'mi', onApply, onClear, onUnit, onClose }) {
  const b = BOUNDS[unit] || BOUNDS.mi;
  const [draft, setDraft] = useState(() => (value > 0 ? value : (unit === 'km' ? 5 : 3)));
  const [typed, setTyped] = useState('');
  const parsed = parseFloat(typed);
  const eff = Number.isFinite(parsed) && parsed > 0 ? parsed : draft;

  return createPortal(
    <div onClick={onClose} role="dialog" aria-modal="true" aria-label="Set a distance target" style={{
      position: 'fixed', inset: 0, zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 18, background: 'rgba(4,0,10,0.8)', backdropFilter: 'blur(3px)',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 320,
        background: 'linear-gradient(180deg,#140425,#0a0116)',
        borderRadius: 18, border: `1px solid ${ARCADE.goldBorder}`,
        boxShadow: '0 0 40px rgba(124,58,237,0.35), 0 20px 50px rgba(0,0,0,0.55)',
        padding: '15px 16px 16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{ fontFamily: HEAD, fontWeight: 900, fontSize: 13, color: GOLD, letterSpacing: '0.1em' }}>DISTANCE TARGET</div>
          <button onClick={onClose} aria-label="Close" style={{ background: 'transparent', border: 'none', color: C.muted, cursor: 'pointer', padding: 4 }}><X size={18} /></button>
        </div>
        <div style={{ fontFamily: BODY, fontSize: 10.5, color: C.muted, lineHeight: 1.4, marginBottom: 12 }}>
          Optional. Leave it off and the run is free — you end it when you are done.
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 6, marginBottom: 6 }}>
          <span style={{ fontFamily: HEAD, fontWeight: 900, fontSize: 40, color: '#fff', lineHeight: 1 }}>{eff}</span>
          <span style={{ fontFamily: HEAD, fontWeight: 700, fontSize: 13, color: GOLD }}>{unit}</span>
        </div>
        <input
          type="range" min={b.min} max={b.max} step={b.step}
          value={Math.min(Math.max(draft, b.min), b.max)}
          onChange={e => { setDraft(parseFloat(e.target.value)); setTyped(''); }}
          aria-label="Distance"
          style={{ width: '100%', accentColor: GOLD, cursor: 'pointer', display: 'block' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: HEAD, fontSize: 8, color: C.muted, marginTop: 2, marginBottom: 10 }}>
          <span>{b.min}</span><span>{b.max} {unit}</span>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
          {b.quick.map(q => (
            <button key={q} type="button" onClick={() => { setDraft(q); setTyped(''); }} style={{
              flex: '1 0 28%', padding: '7px 0', borderRadius: 8, cursor: 'pointer',
              fontFamily: HEAD, fontWeight: 800, fontSize: 9, letterSpacing: '0.04em',
              background: eff === q ? 'rgba(253,224,71,0.12)' : 'rgba(14,2,28,0.6)',
              border: eff === q ? `1.5px solid ${ARCADE.goldBorder}` : `1px solid ${ARCADE.violetBorderSoft}`,
              color: eff === q ? GOLD : C.muted,
            }}>{q} {unit}</button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 3 }}>
            {['mi', 'km'].map(u => (
              <button key={u} type="button" onClick={() => { onUnit?.(u); setDraft(u === 'km' ? 5 : 3); setTyped(''); }} style={{
                padding: '5px 11px', borderRadius: 7, cursor: 'pointer',
                background: unit === u ? 'rgba(253,224,71,0.12)' : 'rgba(6,0,16,0.7)',
                border: unit === u ? `1.5px solid ${ARCADE.goldBorder}` : `1px solid ${ARCADE.violetBorderSoft}`,
                color: unit === u ? GOLD : C.muted, fontFamily: HEAD, fontSize: 9, fontWeight: 700,
              }}>{u.toUpperCase()}</button>
            ))}
          </div>
          <input
            type="number" inputMode="decimal" min="0" step="0.1" placeholder={`other ${unit}`}
            value={typed} onChange={e => setTyped(e.target.value)}
            aria-label="Custom distance"
            style={{ flex: 1, padding: '6px 10px', borderRadius: 7, background: 'rgba(6,0,16,0.7)', border: `1px solid ${ARCADE.violetBorderSoft}`, color: C.text, fontFamily: BODY, fontSize: 12, fontWeight: 600, outline: 'none', minWidth: 0 }}
          />
        </div>

        <TrainingCTA label={`SET ${eff} ${unit.toUpperCase()}`} icon="✓" height={46} depth onClick={() => onApply(+Number(eff).toFixed(2))} />
        <button type="button" onClick={onClear} style={{
          width: '100%', marginTop: 8, padding: '9px 0', background: 'transparent', border: 'none', cursor: 'pointer',
          color: C.muted, fontFamily: HEAD, fontSize: 9.5, fontWeight: 700, letterSpacing: '0.14em',
        }}>{value > 0 ? 'CLEAR · FREE RUN' : 'KEEP IT FREE'}</button>
      </div>
    </div>,
    document.body,
  );
}
