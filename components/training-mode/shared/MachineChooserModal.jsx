import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft } from 'lucide-react';
import { C } from '../Styles';
import { ARCADE } from '../ArcadeUI';
import TrainingCTA from './TrainingCTA';
import { programsFor, programMinutes } from '../data/intervalPrograms';

const GOLD = C.yellow;
const HEAD = "'Orbitron',sans-serif";
const BODY = "'Rajdhani',sans-serif";

const MACHINES = [
  { id: 'treadmill', label: 'TREADMILL', icon: '🏃', blurb: 'Match the belt. Real distance, pace and cadence.' },
  { id: 'bike', label: 'BIKE', icon: '🚲', blurb: 'Match the console speed. Distance and pedal cadence.' },
  { id: 'row', label: 'ROW', icon: '🚣', blurb: 'Timed, with stroke rate. Metres from the console at the end.' },
];

const TAG_LABEL = { fighter: 'FIGHTER', classic: 'CLASSIC', screenshot: 'PROGRAMME' };

// Centred, two-step: which machine, then FREE RUN or INTERVAL TRAINING — and
// for intervals, which programme. Everything the athlete picks here is
// summarised on one row of the setup screen, which reopens this.
export default function MachineChooserModal({ machine, mode, programId, onApply, onMore, onClose }) {
  const [step, setStep] = useState(machine ? 2 : 1);
  const [pickMachine, setPickMachine] = useState(machine || 'treadmill');
  const [pickMode, setPickMode] = useState(mode || 'free');
  const [pickProgram, setPickProgram] = useState(programId || null);
  const programs = programsFor(pickMachine);
  const effProgram = pickProgram && programs.some(p => p.id === pickProgram) ? pickProgram : programs[0]?.id;

  const apply = () => onApply({ machine: pickMachine, mode: pickMode, programId: pickMode === 'interval' ? effProgram : null });

  return createPortal(
    <div onClick={onClose} role="dialog" aria-modal="true" aria-label="Choose a machine" style={{
      position: 'fixed', inset: 0, zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 18, background: 'rgba(4,0,10,0.8)', backdropFilter: 'blur(3px)',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 330, maxHeight: '86dvh', display: 'flex', flexDirection: 'column',
        background: 'linear-gradient(180deg,#140425,#0a0116)',
        borderRadius: 18, border: `1px solid ${ARCADE.goldBorder}`,
        boxShadow: '0 0 40px rgba(124,58,237,0.35), 0 20px 50px rgba(0,0,0,0.55)',
        padding: '15px 16px 16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          {step === 2 && (
            <button onClick={() => setStep(1)} aria-label="Back" style={{ background: 'transparent', border: 'none', color: C.muted, cursor: 'pointer', padding: 2, display: 'flex' }}><ChevronLeft size={18} /></button>
          )}
          <div style={{ flex: 1, fontFamily: HEAD, fontWeight: 900, fontSize: 13, color: GOLD, letterSpacing: '0.1em' }}>
            {step === 1 ? 'WHAT ARE YOU ON?' : MACHINES.find(m => m.id === pickMachine)?.label}
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: 'transparent', border: 'none', color: C.muted, cursor: 'pointer', padding: 4 }}><X size={18} /></button>
        </div>

        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {MACHINES.map(m => {
              const on = pickMachine === m.id;
              return (
                <button key={m.id} type="button" onClick={() => { setPickMachine(m.id); setStep(2); }} style={{
                  textAlign: 'left', padding: '11px 12px', borderRadius: 12, cursor: 'pointer',
                  background: on ? 'rgba(253,224,71,0.1)' : 'rgba(14,2,28,0.62)',
                  border: on ? `1.5px solid ${ARCADE.goldBorder}` : `1px solid ${ARCADE.violetBorderSoft}`,
                  display: 'flex', alignItems: 'center', gap: 11,
                }}>
                  <span style={{ fontSize: 22, lineHeight: 1 }}>{m.icon}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontFamily: HEAD, fontSize: 12, fontWeight: 900, letterSpacing: '0.06em', color: on ? GOLD : '#e6d4ff' }}>{m.label}</span>
                    <span style={{ display: 'block', fontFamily: BODY, fontSize: 10, color: C.muted, marginTop: 2, lineHeight: 1.3 }}>{m.blurb}</span>
                  </span>
                  <span style={{ fontFamily: HEAD, fontSize: 14, color: '#7D7799' }}>›</span>
                </button>
              );
            })}
            {onMore && (
              <button type="button" onClick={onMore} style={{
                marginTop: 2, padding: '8px 0', background: 'transparent', border: 'none', cursor: 'pointer',
                color: C.muted, fontFamily: HEAD, fontSize: 9, fontWeight: 700, letterSpacing: '0.14em',
              }}>ELLIPTICAL · STAIRS · MORE ›</button>
            )}
          </div>
        )}

        {step === 2 && (
          <>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              {[
                { id: 'free', label: 'FREE RUN', sub: 'Your pace. End it when you are done.' },
                { id: 'interval', label: 'INTERVAL TRAINING', sub: 'The announcer sets every change.' },
              ].map(o => {
                const on = pickMode === o.id;
                return (
                  <button key={o.id} type="button" onClick={() => setPickMode(o.id)} style={{
                    flex: 1, textAlign: 'left', padding: '9px 10px', borderRadius: 11, cursor: 'pointer',
                    background: on ? 'rgba(176,106,255,0.16)' : 'rgba(8,2,18,0.55)',
                    border: on ? '1.5px solid rgba(176,106,255,0.75)' : `1px solid ${ARCADE.violetBorderSoft}`,
                  }}>
                    <div style={{ fontFamily: HEAD, fontWeight: 800, fontSize: 9.5, letterSpacing: '0.05em', color: on ? '#e6d4ff' : '#c4b5fd' }}>{o.label}</div>
                    <div style={{ fontFamily: BODY, fontSize: 9, color: C.muted, marginTop: 2, lineHeight: 1.3 }}>{o.sub}</div>
                  </button>
                );
              })}
            </div>

            {pickMode === 'interval' && (
              <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10, paddingRight: 2 }}>
                {programs.map(p => {
                  const on = effProgram === p.id;
                  return (
                    <button key={p.id} type="button" onClick={() => setPickProgram(p.id)} style={{
                      textAlign: 'left', padding: '9px 11px', borderRadius: 11, cursor: 'pointer',
                      background: on ? 'rgba(253,224,71,0.1)' : 'rgba(14,2,28,0.62)',
                      border: on ? `1.5px solid ${ARCADE.goldBorder}` : `1px solid ${ARCADE.violetBorderSoft}`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <span style={{ flex: 1, fontFamily: HEAD, fontSize: 10.5, fontWeight: 900, letterSpacing: '0.04em', color: on ? GOLD : '#e6d4ff' }}>{p.label}</span>
                        <span style={{ fontFamily: HEAD, fontSize: 7.5, fontWeight: 800, letterSpacing: '0.1em', color: p.tag === 'fighter' ? '#ff9a9a' : '#c4b5fd' }}>{TAG_LABEL[p.tag] || ''}</span>
                        <span style={{ fontFamily: HEAD, fontSize: 9, fontWeight: 800, color: GOLD }}>{programMinutes(p)} MIN</span>
                      </div>
                      <div style={{ fontFamily: BODY, fontSize: 9.5, color: C.muted, marginTop: 3, lineHeight: 1.3 }}>{p.blurb}</div>
                    </button>
                  );
                })}
              </div>
            )}

            <TrainingCTA label="USE THIS" icon="✓" height={46} depth onClick={apply} />
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
