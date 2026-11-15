import { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import useSheetModal from './shared/useSheetModal';
import { primeSpeech, setVoiceGender, speakAsync, cancelSpeech, stopVoiceSession, delay } from './voiceCoach';
import { isStanceMove } from './data/practiceMoves';
import { GOLD, GOLD_FILL, label, moveLabel, StepChips, LoopVideo, GuidePlate } from './PracticeParts';

// The move card: one move of the Ladder. Its video plays muted and looping as
// the card opens (a tutorial, or the owner's shadowboxing clip of the move).
// A move with no video says so and shows its steps, with one READ ALOUD
// button. Then the key points, what to watch for, DRILL IT and NEXT MOVE.
//
// A stance shows its lesson's seven steps; a technique its three cues.

export default function PracticeMoveCard({ move, watch, learned, drillClock, profile, onClose, onDrill, onNext }) {
  const [activeCue, setActiveCue] = useState(-1);
  const [reading, setReading] = useState(false);
  const readingRef = useRef(false);
  const points = isStanceMove(move) ? move.steps : move.cues;

  const stopReading = useCallback(() => {
    readingRef.current = false;
    setReading(false);
    setActiveCue(-1);
    cancelSpeech();
  }, []);
  useEffect(() => () => { readingRef.current = false; stopVoiceSession(); }, []);

  const toggleRead = useCallback(async () => {
    if (readingRef.current) { stopReading(); return; }
    readingRef.current = true;
    setReading(true);
    setVoiceGender(profile?.voiceCoach || 'FEMALE');
    try { await primeSpeech(); } catch { /* ignore */ }
    for (let i = 0; i < points.length; i++) {
      if (!readingRef.current) break;
      setActiveCue(i);
      await speakAsync(`${i + 1}. ${points[i]}`, { rate: 0.8, pitch: 1.0 });
      if (!readingRef.current) break;
      await delay(320);
    }
    if (readingRef.current) { readingRef.current = false; setReading(false); setActiveCue(-1); }
  }, [points, profile, stopReading]);

  const close = useCallback(() => { stopReading(); onClose(); }, [stopReading, onClose]);
  const { panelRef, trapTab } = useSheetModal(close);
  const name = moveLabel(move);

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, maxWidth: 440, margin: '0 auto', zIndex: 200 }}>
      <button type="button" tabIndex={-1} aria-hidden="true" onClick={close} style={{ position: 'absolute', inset: 0, background: 'rgba(3,2,8,.78)', border: 0, backdropFilter: 'blur(3px)', cursor: 'default' }}/>
      <div ref={panelRef} tabIndex={-1} onKeyDown={trapTab} className="pm-panel" role="dialog" aria-modal="true" aria-label={move.name} data-testid="pm-card" data-move={move.id} style={{
        position: 'absolute', left: 14, right: 14, top: '50%', transform: 'translateY(-50%)', maxHeight: 'calc(100dvh - 28px)',
        boxSizing: 'border-box', borderRadius: 18, overflow: 'hidden', background: '#0A0716', color: '#fff',
        border: '1.5px solid rgba(168,85,247,.6)', boxShadow: '0 0 30px rgba(168,85,247,.35), 0 24px 60px rgba(0,0,0,.7)',
        display: 'flex', flexDirection: 'column', fontFamily: 'Barlow, system-ui, sans-serif',
      }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          {watch
            ? <LoopVideo watch={watch} title={move.name} style={{ maxHeight: '34dvh', width: '100%' }}/>
            : <GuidePlate sub={`${points.length} steps below. READ ALOUD says them for you.`} style={{ aspectRatio: '16 / 5', minHeight: 96 }}/>}
          <button type="button" className="pm-hit pm-txt" aria-label="Close" onClick={close} style={{
            position: 'absolute', zIndex: 1, top: 6, right: 6, width: 40, height: 40, borderRadius: '50%', background: 'rgba(0,0,0,.55)',
            border: '1px solid rgba(255,255,255,.18)', color: '#fff', cursor: 'pointer', fontSize: 14,
          }}>✕</button>
          <span style={{
            position: 'absolute', zIndex: 1, top: 10, left: 10, font: "700 9px 'Chakra Petch',sans-serif", letterSpacing: '0.14em',
            padding: '3px 7px', borderRadius: 5, border: '1px solid rgba(196,168,255,.6)', color: '#D2BCFF', background: 'rgba(0,0,0,.6)',
          }}>{move.kind}</span>
        </div>

        <div className="pm-scroll" style={{ padding: '10px 14px 4px', display: 'flex', flexDirection: 'column', gap: 9, overflowY: 'auto', minHeight: 0 }}>
          <StepChips at="watch" learned={learned}/>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flexShrink: 0 }}>
            <span style={{ font: "700 19px 'Chakra Petch',sans-serif", letterSpacing: '0.04em', lineHeight: 1.15, overflowWrap: 'anywhere' }}>{name.toUpperCase()}</span>
            <span style={{ fontSize: 13, color: '#A9A3C4', lineHeight: 1.3 }}>{move.description}</span>
          </div>

          {points.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexShrink: 0 }}>
              <span style={{ ...label, color: '#C4A8FF' }}>KEY POINTS</span>
              {!watch && (
                <button type="button" className="pm-hit pm-txt" aria-pressed={reading} onClick={toggleRead} style={{
                  height: 34, padding: '0 11px', borderRadius: 8, flexShrink: 0, cursor: 'pointer', whiteSpace: 'nowrap',
                  background: reading ? 'rgba(242,190,69,.12)' : 'transparent',
                  border: `1px solid ${reading ? 'rgba(242,190,69,.7)' : 'rgba(196,168,255,.5)'}`, color: reading ? GOLD : '#D2BCFF',
                  font: "700 10px 'Chakra Petch',sans-serif", letterSpacing: '0.12em',
                }}>{reading ? '■ STOP' : '🔊 READ ALOUD'}</button>
              )}
            </div>
          )}
          {points.map((c, i) => {
            const on = activeCue === i;
            return (
              <div key={i} style={{
                display: 'flex', gap: 10, alignItems: 'center', minHeight: 36, padding: '6px 12px', borderRadius: 9, boxSizing: 'border-box', flexShrink: 0,
                background: on ? 'rgba(242,190,69,.12)' : '#0F0B1F', border: `1px solid ${on ? 'rgba(242,190,69,.9)' : 'rgba(168,85,247,.28)'}`,
                fontSize: 13, lineHeight: 1.25, animation: on ? 'pm-cue-glow 1.3s ease-in-out infinite' : 'none',
                transition: 'background .2s ease, border-color .2s ease',
              }}>
                <span style={{ font: "700 13px 'Chakra Petch',sans-serif", color: GOLD, flexShrink: 0 }}>{i + 1}</span>{c}
              </div>
            );
          })}

          {move.mistakes.length > 0 && (
            <>
              <span style={{ ...label, color: '#F87171', flexShrink: 0 }}>WATCH FOR</span>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', flexShrink: 0 }}>
                {move.mistakes.map((m) => (
                  <span key={m} style={{ minHeight: 28, display: 'flex', alignItems: 'center', gap: 5, padding: '4px 9px', boxSizing: 'border-box', borderRadius: 7, background: '#1A0A12', border: '1px solid rgba(239,68,68,.35)', fontSize: 12 }}>
                    <span style={{ color: '#EF4444', fontWeight: 700 }}>✕</span>{m}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>

        <div style={{ padding: '10px 14px 14px', display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
          <button type="button" className="pm-gold" data-testid="pm-drill" onClick={() => { stopReading(); onDrill(); }} style={{
            height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: 0, cursor: 'pointer', color: '#1A1204',
            clipPath: 'polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)', background: GOLD_FILL,
            font: "700 15px 'Chakra Petch',sans-serif", letterSpacing: '0.16em',
          }}>DRILL IT · {drillClock}</button>
          <button type="button" className="pm-hit pm-txt" data-testid="pm-next-move" onClick={() => { stopReading(); onNext(); }} style={{
            height: 44, borderRadius: 10, background: 'transparent', border: '1px solid rgba(143,180,255,.3)', color: '#8FB4FF', cursor: 'pointer',
            font: "700 12px 'Chakra Petch',sans-serif", letterSpacing: '0.14em',
          }}>NEXT MOVE ›</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
