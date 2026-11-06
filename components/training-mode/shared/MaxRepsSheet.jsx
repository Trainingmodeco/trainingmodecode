import { useState, useRef, useEffect } from 'react';
import { Minus, Plus } from 'lucide-react';
import { Modal, GoldButton, GhostButton, fitKitCSS, HEAD, BODY, MUTED } from './FitSetupKit';

// MAX OUT · HOW MANY REPS? The sheet both runners open when a set ends (the
// guided DONE, the at-your-pace DONE): a 52 px stepper (big for a sweaty or
// gloved thumb), − number +, holding a button repeats and tapping the number
// types it. It starts at last round's reps for this station (or the level's
// first-set number) and stops at `max`, the smaller of the move's rep cap and
// what a set of that length can hold (data/missionSolo maxRepsLimit). SAVE keeps
// the reps, NOT YET goes back to the set. The reps never change the XP.
//
// A double tap on DONE must not act on the sheet it opened: the second tap lands
// on the backdrop (NOT YET) or on SAVE. So nothing on the sheet works for its
// first ARM_MS.
const HOLD_MS = 420;
const REPEAT_MS = 75;
export const ARM_MS = 500;

const clamp = (v, max) => Math.min(Math.max(0, max), Math.max(0, Math.round(Number(v) || 0)));

// A 52 px round-cornered button: one step on press, then repeating while held.
// A keyboard press (click with no pointer) steps once.
function StepButton({ dir, disabled, onStep, label }) {
  const timer = useRef(null);
  const stop = () => { clearTimeout(timer.current); clearInterval(timer.current); timer.current = null; };
  useEffect(() => stop, []);
  const press = (e) => {
    if (disabled || (e.pointerType === 'mouse' && e.button !== 0)) return;
    onStep(dir);
    stop();
    timer.current = setTimeout(() => { timer.current = setInterval(() => onStep(dir), REPEAT_MS); }, HOLD_MS);
  };
  return (
    <button type="button" aria-label={label} disabled={disabled}
      onPointerDown={press} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop}
      onClick={(e) => { if (e.detail === 0) onStep(dir); }}
      style={{
        width: 52, height: 52, flexShrink: 0, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
        background: 'rgba(157,108,255,0.14)', border: '1px solid rgba(157,108,255,0.45)', color: '#fff',
        cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.45 : 1, touchAction: 'manipulation', userSelect: 'none',
      }}>
      {dir < 0 ? <Minus size={22}/> : <Plus size={22}/>}
    </button>
  );
}

// start: the number it opens on · max: the most it can save · cap: the move's
// own cap (null for none), told to the athlete when it has one.
export default function MaxRepsSheet({ moveName, start, max, cap = null, onSave, onNotYet }) {
  const top = Math.max(0, Math.floor(Number(max) || 0));
  const [reps, setReps] = useState(() => clamp(start, top));
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState('');
  const rootRef = useRef(null);
  const openedAt = useRef(Date.now());
  const armed = () => Date.now() - openedAt.current >= ARM_MS;
  const notYet = () => { if (armed()) onNotYet?.(); };
  const step = (dir) => setReps(r => clamp(r + dir, top));

  useEffect(() => {
    rootRef.current?.querySelector('button.fk-gold')?.focus();
    const onKey = (e) => { if (e.key === 'Escape') notYet(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openTyping = () => { setDraft(String(reps)); setTyping(true); };
  const commit = () => { const v = clamp(draft === '' ? reps : draft, top); setReps(v); setTyping(false); return v; };
  const save = () => { if (armed()) onSave?.(typing ? commit() : reps); };

  // Say why + stops: the move's own cap, or the length of the set when that is lower (a push-up set
  // of 8 seconds cannot hold 40 reps), with or without a cap.
  const limited = top < (cap ?? 300);
  return (
    <div ref={rootRef}>
      <style dangerouslySetInnerHTML={{ __html: fitKitCSS }}/>
      <Modal title="HOW MANY REPS?" ariaLabel="How many reps" onClose={notYet} footer={(
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <GoldButton label="SAVE" height={52} onClick={save} style={{ fontSize: 17 }}/>
          <GhostButton label="NOT YET" height={46} onClick={notYet}/>
        </div>
      )}>
        {moveName && <div style={{ marginTop: -6, font: `600 12px ${HEAD}`, letterSpacing: '0.14em', color: MUTED, textTransform: 'uppercase' }}>{moveName}</div>}
        <div style={{ font: `500 14px ${BODY}`, color: '#E6E2F5', lineHeight: 1.45 }}>Clean reps only. The last clean rep counts.</div>
        <div role="group" aria-label="Reps" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
          <StepButton dir={-1} label="Fewer reps" disabled={reps <= 0} onStep={step}/>
          {typing ? (
            <input type="number" inputMode="numeric" min={0} max={top} value={draft} aria-label="Reps" autoFocus
              onChange={(e) => setDraft(e.target.value)} onBlur={commit}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }}
              style={{ width: 96, height: 56, boxSizing: 'border-box', textAlign: 'center', borderRadius: 10, background: '#16131F', border: '1px solid rgba(157,108,255,0.6)', color: '#fff', font: `700 36px ${HEAD}`, outline: 'none' }}/>
          ) : (
            <button type="button" aria-label={`${reps} reps. Tap to type`} onClick={openTyping} style={{
              minWidth: 96, height: 56, padding: '0 6px', borderRadius: 10, background: 'transparent', border: '1px dashed rgba(255,255,255,0.18)', cursor: 'pointer',
              color: '#fff', font: `700 40px ${HEAD}`, fontVariantNumeric: 'tabular-nums',
            }}>{reps}</button>
          )}
          <StepButton dir={1} label="More reps" disabled={reps >= top} onStep={step}/>
        </div>
        {cap != null && <div style={{ font: `500 12px ${BODY}`, color: MUTED, textAlign: 'center', lineHeight: 1.35 }}>Most for this move: {cap}.</div>}
        {limited && <div style={{ font: `500 12px ${BODY}`, color: MUTED, textAlign: 'center', lineHeight: 1.35, marginTop: cap != null ? -8 : 0 }}>Most for a set this long: {top}.</div>}
        {reps === 0 && <div role="note" style={{ font: `600 12px ${BODY}`, color: '#E6E2F5', textAlign: 'center', lineHeight: 1.35 }}>A set with no reps does not count.</div>}
      </Modal>
    </div>
  );
}
