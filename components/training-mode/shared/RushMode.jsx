import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Flame, X } from 'lucide-react';
import { C } from '../Styles';
import TrainingCTA from './TrainingCTA';
import { RUSH_PATTERNS, rushPatternLabel } from './rushSchedule';
import { RUSH_MIXES, rushMixLabel } from '../data/rushMoves';

// Rush Mode control (46b): a toggle row that opens a modal with two sections —
// CALL MIX first (Explosive → Strikes → Both: what the coach calls during a
// surge), then the four surge-timing rows. No cadence control — surge pacing
// is the pattern's job. Tapping the toggle when off opens the modal
// (Cancel / 🔥 Activate); once activated the row lights up and glows like
// flames. Tapping when on = off.
// `rush` shape: { on: boolean, pattern: 'random'|'perMin10'|'perMin5'|'endRound',
//                mix: 'explosive'|'strikes'|'both' }.

const rushCSS = `
@keyframes rush-flames {
  0%, 100% { box-shadow: 0 0 14px rgba(239,68,68,0.45), inset 0 0 22px rgba(249,115,22,0.16); }
  50%      { box-shadow: 0 0 24px rgba(249,115,22,0.7),  inset 0 0 30px rgba(239,68,68,0.26); }
}
@keyframes rush-flicker {
  0%, 100% { opacity: 1; transform: scale(1); }
  45%      { opacity: 0.8; transform: scale(0.9); }
  70%      { opacity: 1; transform: scale(1.12); }
}
`;

function OptionRow({ active, label, sub, onClick }) {
  return (
    <button onClick={onClick} style={{
      textAlign: 'left', display: 'flex', alignItems: 'center', gap: 11, borderRadius: 11, padding: '10px 13px', cursor: 'pointer',
      background: active ? 'rgba(249,115,22,0.12)' : 'rgba(16,4,30,0.7)',
      border: active ? '1.5px solid rgba(249,115,22,0.7)' : '1px solid rgba(168,85,247,0.25)',
    }}>
      <span style={{ flex: 1 }}>
        <span style={{ display: 'block', fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 11, color: active ? '#ff9a5c' : '#fff' }}>{label}</span>
        <span style={{ display: 'block', fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 9.5, color: '#9a90b8', marginTop: 1 }}>{sub}</span>
      </span>
      {active && <span style={{ width: 16, height: 16, borderRadius: '50%', background: '#f97316', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 900, flexShrink: 0 }}>✓</span>}
    </button>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 8.5, color: '#c4a4d8', letterSpacing: '0.18em', margin: '2px 0 7px' }}>
      {children}
    </div>
  );
}

function RushModal({ sel, setSel, mixSel, setMixSel, onCancel, onActivate }) {
  return createPortal(
    <div onClick={onCancel} style={{
      position: 'fixed', inset: 0, zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 18, background: 'rgba(4,0,10,0.8)', backdropFilter: 'blur(3px)',
    }}>
      <div onClick={e => e.stopPropagation()} className="no-scrollbar" style={{
        width: '100%', maxWidth: 320, marginBottom: '4vh', maxHeight: '86vh', overflowY: 'auto',
        background: 'linear-gradient(180deg,#1c0a0e,#0a0106)',
        borderRadius: 18, border: '1px solid rgba(249,115,22,0.5)',
        boxShadow: '0 0 40px rgba(239,68,68,0.3), 0 20px 50px rgba(0,0,0,0.55)',
        padding: '15px 16px 16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 13, color: '#ff9a5c', letterSpacing: '0.08em' }}>
            <Flame size={15} style={{ color: '#f97316' }}/> RUSH MODE
          </div>
          <button onClick={onCancel} style={{ background: 'transparent', border: 'none', color: C.muted, cursor: 'pointer', padding: 4 }}><X size={18}/></button>
        </div>

        {/* 46b — CALL MIX first: what the coach calls during a surge. */}
        <SectionLabel>CALL MIX</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 13 }}>
          {RUSH_MIXES.map(m => (
            <OptionRow key={m.id} active={m.id === mixSel} label={m.label} sub={m.sub} onClick={() => setMixSel(m.id)}/>
          ))}
        </div>

        {/* Surge timing — the four pattern rows. No cadence control (46b). */}
        <SectionLabel>SURGE TIMING</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 14 }}>
          {RUSH_PATTERNS.map(p => (
            <OptionRow key={p.id} active={p.id === sel} label={p.label} sub={p.sub} onClick={() => setSel(p.id)}/>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>
          <button onClick={onCancel} style={{ flex: 1, height: 46, borderRadius: 12, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.04)', color: '#c9bff0', fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 10, letterSpacing: '0.08em', cursor: 'pointer' }}>CANCEL</button>
          <div style={{ flex: 1.5, display: 'flex' }}>
            <TrainingCTA variant="red" label="ACTIVATE" icon="🔥" height={46} onClick={onActivate} style={{ fontSize: 12, letterSpacing: '0.08em' }}/>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function RushModeRow({ rush, onChange }) {
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(rush?.pattern || 'endRound');
  const [mixSel, setMixSel] = useState(rush?.mix || 'explosive');
  const on = !!rush?.on;

  const clickRow = () => {
    if (on) { onChange({ ...rush, on: false }); }
    else { setSel(rush?.pattern || 'endRound'); setMixSel(rush?.mix || 'explosive'); setOpen(true); }
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: rushCSS }}/>
      <div onClick={clickRow} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer',
        borderRadius: 10, padding: '8px 13px',
        background: on ? 'linear-gradient(100deg, rgba(239,68,68,0.3) 0%, rgba(249,115,22,0.16) 100%)' : 'rgba(10,0,20,0.5)',
        border: on ? '1.5px solid rgba(249,115,22,0.75)' : '1px solid rgba(239,68,68,0.15)',
        animation: on ? 'rush-flames 1.4s ease-in-out infinite' : 'none',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <Flame size={16} style={{ color: on ? '#ffb266' : '#ef4444', animation: on ? 'rush-flicker 0.7s ease-in-out infinite' : 'none' }}/>
          <div>
            <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 10, letterSpacing: '0.06em', color: on ? '#ffd6ad' : '#ef4444', display: 'flex', alignItems: 'center', gap: 6 }}>
              RUSH MODE{on && <span style={{ fontSize: 7, color: '#0a0014', background: '#f97316', borderRadius: 4, padding: '2px 5px', letterSpacing: '0.08em' }}>ACTIVE</span>}
            </div>
            <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 9.5, fontWeight: 600, color: on ? '#ffbf99' : C.faint, marginTop: 1 }}>
              {on ? `${rushMixLabel(rush.mix)} · ${rushPatternLabel(rush.pattern)}` : 'Tap to add all-out surges'}
            </div>
          </div>
        </div>
        <div className={`tm-toggle ${on ? 'on' : ''}`}><div className="tm-toggle-knob"/></div>
      </div>
      {open && (
        <RushModal
          sel={sel}
          setSel={setSel}
          mixSel={mixSel}
          setMixSel={setMixSel}
          onCancel={() => setOpen(false)}
          onActivate={() => { onChange({ on: true, pattern: sel, mix: mixSel }); setOpen(false); }}
        />
      )}
    </>
  );
}
