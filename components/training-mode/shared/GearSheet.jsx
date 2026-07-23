import { useState } from 'react';
import { X } from 'lucide-react';
import { GEAR, GEAR_IDS, loadEquipment, saveEquipment, neededSubstitutions } from '../data/equipmentProfile';
import { humanizeGoal } from '../protocol/content';

// Phase 2 · 2.9 (repositioned) — the gear check. Training Mode is bodyweight-
// first: open space + a phone completes any session. This small in-flow modal
// (sized like the readiness check, shown right after it) lets the athlete tell
// us what they've got TODAY — kit varies by where you train. Anything you skip
// gets a bodyweight swap, shown live below; swaps never cost XP. Replaces the
// old Profile → My Gear settings screen so gear lives with the session, not the
// menu.
const TEAL = '#2dd4bf';

export default function GearSheet({ substitutions, onContinue, onClose }) {
  const [owned, setOwned] = useState(loadEquipment);
  const toggle = (id) => {
    const next = new Set(owned);
    if (next.has(id)) next.delete(id); else next.add(id);
    setOwned(next);
  };
  const setAll = (on) => setOwned(new Set(on ? GEAR_IDS : []));
  const swaps = neededSubstitutions(substitutions || {}, owned);

  const go = () => { saveEquipment(owned); onContinue(); };

  return (
    <div onClick={onClose} style={{ position: 'absolute', inset: 0, zIndex: 50, background: 'rgba(4,0,10,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18 }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: '92%', maxWidth: 320, maxHeight: '88%', overflowY: 'auto',
        background: 'rgba(16,7,32,0.86)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        border: `1px solid ${TEAL}55`, borderRadius: 16, padding: '14px 15px 15px',
        boxShadow: '0 16px 44px rgba(0,0,0,0.6)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
          <div>
            <div style={{ font: "900 13px 'Orbitron',sans-serif", color: TEAL, letterSpacing: '0.05em' }}>GEAR CHECK</div>
            <div style={{ font: "600 8px 'Rajdhani',sans-serif", color: '#8b7fb0' }}>What have you got today? Phone-only is fine.</div>
          </div>
          <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', padding: 3 }}><X size={15} color="#9a90b8" /></button>
        </div>

        <div style={{ display: 'flex', gap: 6, margin: '9px 0 8px' }}>
          <button onClick={() => setAll(false)} style={{ flex: 1, padding: '6px 0', borderRadius: 7, cursor: 'pointer', background: owned.size === 0 ? 'rgba(45,212,191,0.16)' : 'rgba(8,2,18,0.4)', border: `1px solid ${owned.size === 0 ? TEAL : 'rgba(168,85,247,0.25)'}`, font: "800 8px 'Orbitron',sans-serif", letterSpacing: '0.03em', color: owned.size === 0 ? TEAL : '#c4a4d8' }}>📱 JUST A PHONE</button>
          <button onClick={() => setAll(true)} style={{ flex: 1, padding: '6px 0', borderRadius: 7, cursor: 'pointer', background: owned.size === GEAR_IDS.length ? 'rgba(168,85,247,0.16)' : 'rgba(8,2,18,0.4)', border: `1px solid ${owned.size === GEAR_IDS.length ? 'rgba(168,85,247,0.6)' : 'rgba(168,85,247,0.25)'}`, font: "800 8px 'Orbitron',sans-serif", letterSpacing: '0.03em', color: owned.size === GEAR_IDS.length ? '#d7b3ff' : '#c4a4d8' }}>🏠 FULL GYM</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
          {GEAR.map((g) => {
            const on = owned.has(g.id);
            return (
              <button key={g.id} onClick={() => toggle(g.id)} style={{ display: 'flex', alignItems: 'center', gap: 7, background: on ? 'rgba(45,212,191,0.12)' : 'rgba(8,2,18,0.4)', border: `1px solid ${on ? `${TEAL}66` : 'rgba(168,85,247,0.22)'}`, borderRadius: 8, padding: '7px 8px', cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ fontSize: 14 }}>{g.icon}</span>
                <span style={{ flex: 1, font: "700 9px 'Rajdhani',sans-serif", color: on ? '#e6fffb' : 'rgba(255,255,255,0.5)' }}>{g.label}</span>
                <span style={{ font: "800 9px 'Orbitron',sans-serif", color: on ? TEAL : 'rgba(255,255,255,0.28)' }}>{on ? '✓' : '+'}</span>
              </button>
            );
          })}
        </div>

        {swaps.length > 0 && (
          <div style={{ marginTop: 9, padding: '7px 9px', borderRadius: 8, background: 'rgba(45,212,191,0.08)', border: `1px solid ${TEAL}33` }}>
            <div style={{ font: "700 6.5px 'Orbitron',sans-serif", color: TEAL, letterSpacing: '0.1em', marginBottom: 4 }}>GEAR SWAPS · NO XP LOST</div>
            {swaps.map(({ id, sub }) => (
              <div key={id} style={{ font: "600 8px 'Rajdhani',sans-serif", color: '#c4e9e2', lineHeight: 1.3 }}>
                🔁 No {GEAR.find((x) => x.id === id)?.label || humanizeGoal(id)} → <span style={{ color: '#e6fffb', fontWeight: 700 }}>{humanizeGoal(sub)}</span>
              </div>
            ))}
          </div>
        )}

        <button onClick={go} style={{ width: '100%', height: 40, borderRadius: 10, border: 'none', marginTop: 12, background: `linear-gradient(135deg,${TEAL},#22c55e)`, color: '#04140f', font: "900 11px 'Orbitron',sans-serif", letterSpacing: '0.07em', cursor: 'pointer' }}>▶ CONTINUE</button>
      </div>
    </div>
  );
}
