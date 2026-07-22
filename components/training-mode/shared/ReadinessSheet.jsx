import { useState } from 'react';
import { X, TriangleAlert as AlertTriangle } from 'lucide-react';
import { readiness as assessReadiness } from '../protocol/content';

// Phase 2 · 2.6 — daily readiness check, shown before a camp session starts.
// Five 1–5 taps (5 = good) + one danger question feed the engine's
// assessReadiness → go / suggest_easy_or_recovery / halt. Calm, never clinical;
// a danger symptom halts with a clear stop-training advisory and no penalty.
const GOLD = '#fde047';
const ROWS = [
  { id: 'sleep',    label: 'SLEEP',    hint: '5 = rested' },
  { id: 'fatigue',  label: 'ENERGY',   hint: '5 = fresh' },
  { id: 'soreness', label: 'SORENESS', hint: '5 = none' },
  { id: 'stress',   label: 'STRESS',   hint: '5 = calm' },
  { id: 'mood',     label: 'MOOD',     hint: '5 = fired up' },
];

function DotRow({ label, hint, value, onSet }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
      <div style={{ width: 78, flexShrink: 0 }}>
        <div style={{ font: "800 8.5px 'Orbitron',sans-serif", color: '#d7c9ee', letterSpacing: '0.04em' }}>{label}</div>
        <div style={{ font: "600 7px 'Rajdhani',sans-serif", color: '#8b7fb0' }}>{hint}</div>
      </div>
      <div style={{ flex: 1, display: 'flex', gap: 6, justifyContent: 'space-between' }}>
        {[1, 2, 3, 4, 5].map((n) => {
          const on = n <= value;
          return (
            <button key={n} onClick={() => onSet(n)} aria-label={`${label} ${n}`} style={{
              width: 20, height: 20, borderRadius: '50%', cursor: 'pointer', padding: 0,
              background: on ? GOLD : 'rgba(8,2,18,0.5)',
              border: `1px solid ${on ? GOLD : 'rgba(168,85,247,0.4)'}`,
              boxShadow: on ? '0 0 8px rgba(253,224,71,0.5)' : 'none',
            }} />
          );
        })}
      </div>
    </div>
  );
}

export default function ReadinessSheet({ onGo, onClose }) {
  const [vals, setVals] = useState({ sleep: 3, fatigue: 3, soreness: 3, stress: 3, mood: 3 });
  const [danger, setDanger] = useState(null);   // null | true | false
  const [verdict, setVerdict] = useState(null); // null | 'suggest_easy_or_recovery' | 'halt'

  const set = (id, n) => setVals((v) => ({ ...v, [id]: n }));

  const check = () => {
    const v = assessReadiness({ ...vals, dangerSymptom: danger === true });
    if (v === 'go') { onGo({ easy: false }); return; }
    setVerdict(v);
  };

  const card = (children) => (
    <div onClick={onClose} style={{ position: 'absolute', inset: 0, zIndex: 50, background: 'rgba(4,0,10,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18 }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: '90%', maxWidth: 300, background: 'rgba(16,7,32,0.82)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(168,85,247,0.4)', borderRadius: 15, padding: '14px 15px 15px',
        boxShadow: '0 16px 44px rgba(0,0,0,0.6)',
      }}>{children}</div>
    </div>
  );

  if (verdict === 'halt') {
    return card(
      <div style={{ textAlign: 'center' }}>
        <AlertTriangle size={30} color="#ef4444" style={{ marginBottom: 6 }} />
        <div style={{ font: "900 14px 'Orbitron',sans-serif", color: '#ef4444', letterSpacing: '0.05em', marginBottom: 6 }}>REST TODAY</div>
        <div style={{ font: "600 10.5px 'Rajdhani',sans-serif", color: '#e6d9ff', lineHeight: 1.35, marginBottom: 14 }}>
          You flagged a danger symptom. Stop training and recover — see a professional if it persists. No penalty, no streak lost.
        </div>
        <button onClick={onClose} style={{ width: '100%', height: 38, borderRadius: 10, border: '1px solid rgba(239,68,68,0.5)', background: 'rgba(239,68,68,0.12)', color: '#ff8a8a', font: "900 11px 'Orbitron',sans-serif", letterSpacing: '0.08em', cursor: 'pointer' }}>GOT IT</button>
      </div>
    );
  }

  if (verdict === 'suggest_easy_or_recovery') {
    return card(
      <div>
        <div style={{ font: "900 13px 'Orbitron',sans-serif", color: '#c9a6ff', letterSpacing: '0.04em', marginBottom: 5 }}>FEELING ROUGH?</div>
        <div style={{ font: "600 10px 'Rajdhani',sans-serif", color: '#c4a4d8', lineHeight: 1.35, marginBottom: 13 }}>
          Low readiness today. An easier session still counts and keeps your streak — no need to grind through it.
        </div>
        <button onClick={() => onGo({ easy: true })} style={{ width: '100%', height: 40, borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#2dd4bf,#22c55e)', color: '#04140f', font: "900 11px 'Orbitron',sans-serif", letterSpacing: '0.06em', cursor: 'pointer', marginBottom: 7 }}>▶ START EASY VARIANT</button>
        <button onClick={() => onGo({ easy: false })} style={{ width: '100%', height: 36, borderRadius: 10, border: '1px solid rgba(168,85,247,0.4)', background: 'rgba(168,85,247,0.08)', color: '#c9a6ff', font: "800 10px 'Orbitron',sans-serif", letterSpacing: '0.06em', cursor: 'pointer', marginBottom: 7 }}>START ANYWAY</button>
        <button onClick={onClose} style={{ width: '100%', height: 32, borderRadius: 10, border: 'none', background: 'transparent', color: '#8b7fb0', font: "700 9px 'Orbitron',sans-serif", letterSpacing: '0.06em', cursor: 'pointer' }}>NOT TODAY</button>
      </div>
    );
  }

  return card(
    <>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
        <div>
          <div style={{ font: "900 13px 'Orbitron',sans-serif", color: GOLD, letterSpacing: '0.06em' }}>READINESS CHECK</div>
          <div style={{ font: "600 8px 'Rajdhani',sans-serif", color: '#8b7fb0' }}>Quick gut-check before you train</div>
        </div>
        <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', padding: 3 }}><X size={15} color="#9a90b8" /></button>
      </div>
      <div style={{ marginTop: 8 }}>
        {ROWS.map((r) => <DotRow key={r.id} label={r.label} hint={r.hint} value={vals[r.id]} onSet={(n) => set(r.id, n)} />)}
      </div>

      <div style={{ marginTop: 4, padding: '8px 10px', borderRadius: 9, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.28)' }}>
        <div style={{ font: "600 9px 'Rajdhani',sans-serif", color: '#ffb3b3', lineHeight: 1.3, marginBottom: 6 }}>
          Any dizziness, chest symptoms, sharp pain, concussion signs, or a new injury?
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[['NO', false], ['YES', true]].map(([lbl, val]) => {
            const on = danger === val;
            const c = val ? '#ef4444' : '#22c55e';
            return (
              <button key={lbl} onClick={() => setDanger(val)} style={{
                flex: 1, padding: '6px 0', borderRadius: 7, cursor: 'pointer',
                background: on ? `${c}22` : 'rgba(8,2,18,0.4)', border: `1px solid ${on ? c : 'rgba(168,85,247,0.25)'}`,
                font: "800 9px 'Orbitron',sans-serif", letterSpacing: '0.06em', color: on ? c : '#c4a4d8',
              }}>{lbl}</button>
            );
          })}
        </div>
      </div>

      <button onClick={check} disabled={danger === null} style={{
        width: '100%', height: 40, borderRadius: 10, border: 'none', marginTop: 12,
        background: danger === null ? 'rgba(253,224,71,0.25)' : 'linear-gradient(135deg,#fde047,#f59e0b)',
        color: '#0a0014', font: "900 11px 'Orbitron',sans-serif", letterSpacing: '0.08em',
        cursor: danger === null ? 'not-allowed' : 'pointer', opacity: danger === null ? 0.6 : 1,
      }}>▶ CHECK IN &amp; START</button>
    </>
  );
}
