import { useState } from 'react';
import { Minus, Plus, Check } from 'lucide-react';
import { C } from '../Styles';
import BottomSheet from './BottomSheet';
import { classifyType, exerciseWeight, unitLabel, normUnit, stepFor, convertWeight, defaultWeight } from '../data/weightLog';
import { loadProfile } from '../data/userProfile';

// Sets · reps · rest (· working weight) for ONE exercise. Shared by the
// workout list (tap the dose on a row) and the guided player (ADJUST before a
// set), so the defaults the generator wrote are editable everywhere the
// athlete meets them — and the list rows no longer have to print them.
const GOLD = C.gold;

const weightBtn = {
  width: 34, height: 34, borderRadius: 9, flexShrink: 0, cursor: 'pointer',
  background: 'rgba(253,224,71,0.1)', border: '1px solid rgba(253,224,71,0.4)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

export function Stepper({ label, value, display, onDec, onInc }) {
  const btn = {
    width: 34, height: 34, borderRadius: 8, cursor: 'pointer',
    background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.35)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0' }}>
      <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 9, color: C.faint, letterSpacing: '0.12em' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onDec} aria-label={`Decrease ${label}`} style={btn}><Minus size={14} color={C.violet}/></button>
        <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 15, color: '#fff', minWidth: 52, textAlign: 'center' }}>{display ?? value}</span>
        <button onClick={onInc} aria-label={`Increase ${label}`} style={btn}><Plus size={14} color={C.violet}/></button>
      </div>
    </div>
  );
}

export default function ExerciseEditSheet({ exercise, onSave, onClose, title }) {
  const isHold = /^\d+\s*s$/i.test(String(exercise.reps).trim());
  const repsInit = parseInt(String(exercise.reps).split('-').pop(), 10) || 10;
  const [sets, setSets] = useState(exercise.sets || 3);
  const [reps, setReps] = useState(repsInit);
  const [rest, setRest] = useState(exercise.restSeconds || parseInt(exercise.rest) || 60);
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  // Design 39 — optional WORKING WEIGHT (weighted lifts only).
  const isWeighted = classifyType(exercise) === 'weighted';
  const existing = exerciseWeight(exercise);
  const initUnit = existing?.unit || normUnit(loadProfile()?.weightUnit);
  const [unit, setUnit] = useState(initUnit);
  const [weight, setWeight] = useState(existing?.weight || defaultWeight(initUnit));
  const [hasWeight, setHasWeight] = useState(!!existing);
  const toggleUnit = (u) => { if (u !== unit) { setWeight(w => convertWeight(w, unit, u)); setUnit(u); } };
  const wStep = stepFor(unit);

  const save = () => onSave({
    sets, reps: isHold ? `${reps}s` : reps, restSeconds: rest, rest: `${rest}s`,
    ...(isWeighted ? { weight: hasWeight ? weight : null, unit } : {}),
  });

  return (
    <BottomSheet
      title={title || `EDIT: ${exercise.name.toUpperCase()}`}
      accent={GOLD}
      onClose={onClose}
      footer={(
        <button onClick={save} style={{
          width: '100%', padding: '13px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
          background: `linear-gradient(135deg, ${GOLD}, #f59e0b)`, color: '#0a0014',
          fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 12, letterSpacing: '0.1em',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
        }}>
          <Check size={15} strokeWidth={3}/> APPLY
        </button>
      )}
    >
      <Stepper label="SETS" value={sets} onDec={() => setSets(s => clamp(s - 1, 1, 8))} onInc={() => setSets(s => clamp(s + 1, 1, 8))}/>
      <Stepper label={isHold ? 'HOLD TIME' : 'REPS'} value={reps} display={isHold ? `${reps}s` : reps}
        onDec={() => setReps(r => clamp(r - (isHold ? 5 : 1), isHold ? 10 : 1, isHold ? 180 : 60))}
        onInc={() => setReps(r => clamp(r + (isHold ? 5 : 1), isHold ? 10 : 1, isHold ? 180 : 60))}/>
      <Stepper label="REST" value={rest} display={`${rest}s`}
        onDec={() => setRest(r => clamp(r - 15, 15, 300))} onInc={() => setRest(r => clamp(r + 15, 15, 300))}/>

      {/* Design 39 — WORKING WEIGHT (optional, weighted lifts only) */}
      {isWeighted && (
          <div style={{ marginTop: 10, borderRadius: 12, border: '1px solid rgba(253,224,71,0.55)', background: 'rgba(253,224,71,0.05)', boxShadow: '0 0 14px rgba(253,224,71,0.14)', padding: '10px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: hasWeight ? 8 : 0 }}>
              <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 9, color: GOLD, letterSpacing: '0.1em' }}>WORKING WEIGHT</span>
              <span style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 9, color: C.muted, marginLeft: 'auto' }}>optional</span>
            </div>
            {!hasWeight ? (
              <button onClick={() => setHasWeight(true)} style={{ width: '100%', padding: '9px 0', borderRadius: 9, cursor: 'pointer', background: 'rgba(253,224,71,0.1)', border: '1px dashed rgba(253,224,71,0.5)', color: GOLD, fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 10, letterSpacing: '0.06em' }}>+ ADD WEIGHT</button>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button onClick={() => setWeight(w => Math.max(wStep, w - wStep))} style={weightBtn}><Minus size={15} color={GOLD}/></button>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 26, color: '#fff' }}>{weight}</span>
                  <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 11, color: GOLD, marginLeft: 4 }}>{unitLabel(unit)}</span>
                </div>
                <button onClick={() => setWeight(w => Math.min(2000, w + wStep))} style={weightBtn}><Plus size={15} color={GOLD}/></button>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginLeft: 2 }}>
                  {['lb', 'kg'].map(u => (
                    <button key={u} onClick={() => toggleUnit(u)} style={{ padding: '3px 8px', borderRadius: 6, cursor: 'pointer', fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 8, letterSpacing: '0.05em', color: unit === u ? '#0a0014' : '#c9b8e8', background: unit === u ? GOLD : 'rgba(16,4,30,0.8)', border: unit === u ? 'none' : '1px solid rgba(168,85,247,0.3)' }}>{u.toUpperCase()}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
      )}
    </BottomSheet>
  );
}
