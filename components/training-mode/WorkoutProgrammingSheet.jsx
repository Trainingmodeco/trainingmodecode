import { useState } from 'react';
import { SlidersHorizontal, ArrowLeft } from 'lucide-react';
import { C } from './Styles';
import TrainingCTA from './shared/TrainingCTA';
import {
  SET_SCHEMES, PROGRAMS, DURATIONS, programDayIndex, advanceProgramDay, resolveScheme,
} from './data/workoutPrograms';

const GOLD = C.gold;
const NEON = C.neon;

const STYLES = [
  { id: 'STRENGTH', focus: 'Strength' },
  { id: 'HYBRID', focus: 'Hybrid' },
];

// PROGRAMMING sub-page — the single door to the Workout Builder's advanced
// controls (design 11a follow-up). Presented as an overlay sheet like Add
// Cardio: edit workout style, set scheme, a popular program, and duration,
// then APPLY & BACK writes it all to the builder config.
export default function WorkoutProgrammingSheet({ initial, onApply, onClose }) {
  const [focus, setFocus] = useState(initial?.focus || 'Strength');
  const [schemeId, setSchemeId] = useState(initial?.schemeId || 'auto');
  const [customScheme, setCustomScheme] = useState(initial?.customScheme || { sets: 4, reps: 10, restSeconds: 60 });
  const [programId, setProgramId] = useState(initial?.programId || null);
  const [duration, setDuration] = useState(initial?.duration || 40);
  // Only re-resolve muscle targets + rotate the split if the athlete actually
  // taps a program row this time (not merely because one was picked before).
  const [pickedProgram, setPickedProgram] = useState(false);

  const pickProgram = (p) => {
    if (programId === p.id) { setProgramId(null); setPickedProgram(false); return; }
    setProgramId(p.id);
    setPickedProgram(true);
    setSchemeId(p.scheme.id);
    setDuration(p.duration);
  };

  const apply = () => {
    let muscleChips = null;
    if (pickedProgram && programId) {
      const p = PROGRAMS.find(x => x.id === programId);
      if (p) { const idx = programDayIndex(p); muscleChips = p.days[idx].chips; advanceProgramDay(p, idx); }
    }
    onApply?.({
      focus, schemeId, customScheme, programId, duration,
      setScheme: resolveScheme(schemeId, customScheme), muscleChips,
    });
  };

  const Label = ({ children, right }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, marginTop: 4 }}>
      <span style={{ font: "600 8px 'Orbitron',sans-serif", color: '#c4a4d8', letterSpacing: '0.18em' }}>{children}</span>
      {right}
    </div>
  );

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300, display: 'flex', justifyContent: 'center',
      background: 'radial-gradient(120% 80% at 50% 0%, #1a0336 0%, #0a0014 60%, #05000c 100%)',
    }}>
      <div style={{
        position: 'relative', width: '100%', maxWidth: 440, height: '100dvh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        borderLeft: '1px solid rgba(176,106,255,0.12)', borderRight: '1px solid rgba(176,106,255,0.12)',
      }}>
        <div style={{ position: 'absolute', top: -80, left: -60, width: 260, height: 260, borderRadius: '50%', background: 'radial-gradient(circle, rgba(176,106,255,0.22), transparent 70%)', pointerEvents: 'none' }}/>
        <div style={{ position: 'absolute', top: 120, right: -80, width: 240, height: 240, borderRadius: '50%', background: 'radial-gradient(circle, rgba(253,224,71,0.1), transparent 70%)', pointerEvents: 'none' }}/>

        {/* Sticky header */}
        <div style={{
          position: 'relative', flexShrink: 0, padding: 'calc(14px + env(safe-area-inset-top, 0px)) 18px 12px',
          borderBottom: '1px solid rgba(176,106,255,0.15)',
          background: 'linear-gradient(180deg, rgba(20,3,42,0.92), rgba(10,0,20,0.78))', backdropFilter: 'blur(6px)',
        }}>
          <button onClick={onClose} aria-label="Back" style={{
            display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12,
            background: 'rgba(176,106,255,0.1)', border: '1px solid rgba(176,106,255,0.3)',
            borderRadius: 9, padding: '7px 11px', cursor: 'pointer', color: C.text,
            fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 9.5, letterSpacing: '0.12em',
          }}>
            <ArrowLeft size={15}/> BACK
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'radial-gradient(circle, rgba(176,106,255,0.18), rgba(253,224,71,0.05))',
              border: `1.5px solid ${NEON}`, boxShadow: `0 0 14px ${NEON}44`,
            }}>
              <SlidersHorizontal size={19} color={NEON}/>
            </div>
            <div>
              <div style={{ font: "900 15px 'Orbitron',sans-serif", color: '#facc15', letterSpacing: '0.06em' }}>WORKOUT PROGRAMS</div>
              <div style={{ font: "600 9px 'Rajdhani',sans-serif", color: '#c4a4d8' }}>Leave on AUTO for a balanced workout.</div>
            </div>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="no-scrollbar" style={{ position: 'relative', flex: 1, overflowY: 'auto', padding: '12px 16px', paddingBottom: 'calc(92px + env(safe-area-inset-bottom,0px))' }}>
          {/* WORKOUT STYLE */}
          <Label>WORKOUT STYLE</Label>
          <div style={{ display: 'flex', gap: 6, background: 'rgba(8,2,18,0.7)', border: '1px solid rgba(168,85,247,0.2)', borderRadius: 10, padding: 4, marginBottom: 14 }}>
            {STYLES.map(s => {
              const active = s.focus === focus;
              return (
                <button key={s.id} onClick={() => setFocus(s.focus)} style={{ flex: 1, textAlign: 'center', font: "800 9px 'Orbitron',sans-serif", color: active ? '#0a0014' : '#c4a4d8', background: active ? GOLD : 'transparent', border: 'none', borderRadius: 7, padding: '7px 0', cursor: 'pointer' }}>{s.id}</button>
              );
            })}
          </div>

          {/* SET SCHEME */}
          <Label right={<span style={{ font: "600 8px 'Rajdhani',sans-serif", color: '#9a90b8' }}>weighted lifts</span>}>SET SCHEME</Label>
          <div className="no-scrollbar" style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2, marginBottom: schemeId === 'custom' ? 8 : 14 }}>
            {SET_SCHEMES.map(s => {
              const active = s.id === schemeId;
              return (
                <button key={s.id} onClick={() => setSchemeId(s.id)} style={{
                  flexShrink: 0, padding: '7px 11px', borderRadius: 8, cursor: 'pointer', textAlign: 'center',
                  background: active ? GOLD : 'rgba(16,4,30,0.8)', border: active ? 'none' : '1px solid rgba(168,85,247,0.3)',
                  boxShadow: active ? '0 0 8px rgba(253,224,71,.4)' : 'none',
                }}>
                  <div style={{ font: "800 10px 'Orbitron',sans-serif", color: active ? '#0a0014' : '#fff', letterSpacing: '0.04em' }}>{s.label}</div>
                  <div style={{ font: "600 7.5px 'Rajdhani',sans-serif", color: active ? 'rgba(10,0,20,0.7)' : '#9a90b8', marginTop: 1 }}>{s.sub}</div>
                </button>
              );
            })}
          </div>
          {schemeId === 'custom' && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              {[['SETS', 'sets', 1, 8], ['REPS', 'reps', 1, 50], ['REST s', 'restSeconds', 15, 300]].map(([lab, key, min, max]) => (
                <div key={key} style={{ flex: 1 }}>
                  <div style={{ font: "700 7px 'Orbitron',sans-serif", color: '#c4a4d8', letterSpacing: '0.14em', marginBottom: 3 }}>{lab}</div>
                  <input type="number" inputMode="numeric" value={customScheme[key]}
                    onChange={e => { const n = Math.max(min, Math.min(max, parseInt(e.target.value, 10) || min)); setCustomScheme(cs => ({ ...cs, [key]: n })); }}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '8px 6px', textAlign: 'center', borderRadius: 8, background: 'rgba(16,4,30,0.85)', border: '1px solid rgba(168,85,247,0.35)', color: '#fff', font: "800 13px 'Orbitron',sans-serif", outline: 'none' }}/>
                </div>
              ))}
            </div>
          )}

          {/* POPULAR PROGRAMS */}
          <Label>POPULAR PROGRAMS</Label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
            {PROGRAMS.map(p => {
              const day = p.days[programDayIndex(p)];
              const active = programId === p.id;
              return (
                <button key={p.id} onClick={() => pickProgram(p)} style={{
                  display: 'flex', alignItems: 'center', gap: 9, borderRadius: 9, padding: '9px 11px', cursor: 'pointer', textAlign: 'left',
                  background: active ? 'rgba(253,224,71,0.1)' : 'rgba(16,4,30,0.8)',
                  border: active ? '1px solid rgba(253,224,71,0.55)' : '1px solid rgba(168,85,247,0.28)',
                  boxShadow: active ? '0 0 10px rgba(253,224,71,.25)' : 'none',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ font: "800 9.5px 'Orbitron',sans-serif", color: active ? GOLD : '#fff', letterSpacing: '0.05em' }}>{p.title}</span>
                    {day.label ? <span style={{ font: "800 8px 'Orbitron',sans-serif", color: GOLD, marginLeft: 7 }}>· TODAY: {day.label}</span> : null}
                    <div style={{ font: "600 8.5px 'Rajdhani',sans-serif", color: '#9a90b8', marginTop: 1 }}>{p.meta}</div>
                  </div>
                  <span style={{ font: "900 12px 'Orbitron',sans-serif", color: active ? GOLD : '#b06aff', flexShrink: 0 }}>{active ? '✓' : '›'}</span>
                </button>
              );
            })}
          </div>

          {/* DURATION */}
          <Label>DURATION</Label>
          <div style={{ display: 'flex', gap: 7, marginBottom: 6 }}>
            {DURATIONS.map(d => {
              const active = d === duration;
              return (
                <button key={d} onClick={() => setDuration(d)} style={{
                  flex: 1, textAlign: 'center', font: "800 10px 'Orbitron',sans-serif", padding: '11px 0', borderRadius: 8, cursor: 'pointer',
                  color: active ? '#0a0014' : '#d9d1ef', background: active ? GOLD : 'rgba(16,4,30,0.8)', border: active ? 'none' : '1px solid rgba(168,85,247,0.3)',
                }}>{d}<span style={{ font: "700 7px 'Orbitron',sans-serif", opacity: 0.7 }}> MIN</span></button>
              );
            })}
          </div>
        </div>

        {/* Sticky footer */}
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          padding: '10px 16px calc(12px + env(safe-area-inset-bottom,0px))',
          background: 'linear-gradient(0deg, rgba(10,0,20,0.96) 60%, transparent)',
        }}>
          <TrainingCTA variant="gold" label="APPLY & BACK" icon="✓" height={48} onClick={apply} style={{ fontSize: 13.5, letterSpacing: '0.06em' }}/>
        </div>
      </div>
    </div>
  );
}
