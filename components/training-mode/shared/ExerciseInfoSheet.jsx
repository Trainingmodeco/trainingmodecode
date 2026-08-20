import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { C, NAV_H } from '../Styles';
import { exerciseInfo, difficultyPips } from '../data/exerciseInfo';

// Spec 13 (WB-G) — the EXERCISE INFO sheet: "what IS this exercise?", the #1
// beginner drop-off point. Display-only. Opened from the exercise NAME on a
// list row, the name on the guided player, or a SWAP row (where it also
// carries the commit action, so you can look before you leap).
//
// Everything fits at once by design — no internal scrolling in any state, so
// it stays readable one-handed mid-set. That's why the demo panel is 16:9
// rather than square: it leaves room for cues + mistakes + swaps below.
const GOLD = C.gold;
const VIOLET = '#a855f7';
const RED = '#ef4444';

const CSS = `
@keyframes xi-shimmer { 0% { background-position: -260px 0; } 100% { background-position: 260px 0; } }
@keyframes xi-up { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
`;

function Chip({ children, tone = 'violet' }) {
  const violet = tone === 'violet';
  return (
    <span style={{
      font: "700 7px 'Orbitron',sans-serif", letterSpacing: '0.1em',
      color: violet ? '#c9a6ff' : GOLD,
      border: `1px solid ${violet ? 'rgba(168,85,247,0.45)' : 'rgba(253,224,71,0.5)'}`,
      borderRadius: 5, padding: '3px 7px', whiteSpace: 'nowrap',
    }}>{children}</span>
  );
}

// The hero panel: real loop when the art exists, designed waiting-room when
// it doesn't. Art lands progressively, so "not yet" must look deliberate.
function DemoPanel({ src, name }) {
  const [state, setState] = useState(src ? 'loading' : 'none');
  return (
    <div style={{
      position: 'relative', width: '100%', aspectRatio: '16 / 9', maxHeight: 200,
      borderRadius: 14, border: `1.5px solid ${VIOLET}66`, overflow: 'hidden',
      background: state === 'none'
        ? 'radial-gradient(ellipse at 50% 45%, rgba(168,85,247,0.22) 0%, rgba(8,2,18,0.9) 70%)'
        : 'rgba(8,2,18,0.9)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {src && state !== 'none' && (
        <img
          src={src} alt={name}
          onLoad={() => setState('ready')}
          onError={() => setState('none')}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: state === 'ready' ? 'block' : 'none' }}
        />
      )}

      {state === 'loading' && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(100deg, transparent 30%, rgba(168,85,247,0.22) 50%, transparent 70%)',
          backgroundSize: '260px 100%', animation: 'xi-shimmer 1.4s linear infinite',
        }}/>
      )}

      {state === 'none' && (
        <div style={{ textAlign: 'center', padding: '0 16px' }}>
          <div style={{
            width: 42, height: 42, borderRadius: '50%', margin: '0 auto 8px',
            border: `1.5px solid ${VIOLET}88`, background: 'rgba(168,85,247,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
          }}>🥋</div>
          <div style={{ font: "800 9px 'Orbitron',sans-serif", color: '#c9a6ff', letterSpacing: '0.16em' }}>DEMO ON THE WAY</div>
          <div style={{ font: "600 10px 'Rajdhani',sans-serif", color: '#9a90b8', marginTop: 3 }}>the cues below have you covered</div>
        </div>
      )}

      {state === 'ready' && (
        <span style={{
          position: 'absolute', top: 8, right: 8,
          font: "700 6.5px 'Orbitron',sans-serif", letterSpacing: '0.1em', color: '#c9a6ff',
          background: 'rgba(8,2,18,0.8)', border: `1px solid ${VIOLET}55`, borderRadius: 5, padding: '3px 6px',
        }}>▶ LOOP · MUTED</span>
      )}
    </div>
  );
}

export default function ExerciseInfoSheet({ exercise, fromSwap = false, onUse, onSwapTo, onClose }) {
  const info = useMemo(() => exerciseInfo(exercise), [exercise]);
  const diff = difficultyPips(exercise?.difficulty);
  if (typeof document === 'undefined') return null;

  const swapChip = (target, dir) => {
    if (!target) return null;
    const easier = dir === 'easier';
    return (
      <button
        onClick={() => onSwapTo?.(target)}
        style={{
          flex: 1, minWidth: 0, cursor: 'pointer', borderRadius: 9, padding: '8px 9px', textAlign: 'left',
          background: easier ? 'rgba(168,85,247,0.1)' : 'rgba(253,224,71,0.1)',
          border: `1px solid ${easier ? 'rgba(168,85,247,0.45)' : 'rgba(253,224,71,0.5)'}`,
        }}
      >
        <div style={{ font: "700 6.5px 'Orbitron',sans-serif", letterSpacing: '0.14em', color: easier ? '#c9a6ff' : GOLD, marginBottom: 2 }}>
          {easier ? 'EASIER' : 'HARDER'}
        </div>
        <div style={{ font: "800 9px 'Orbitron',sans-serif", color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {easier ? '← ' : ''}{target.name.toUpperCase()}{easier ? '' : ' →'}
        </div>
      </button>
    );
  };

  return createPortal(
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: NAV_H, zIndex: 1000, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <style dangerouslySetInnerHTML={{ __html: CSS }}/>
      <div onClick={onClose} style={{ flex: 1, background: 'rgba(0,0,0,0.7)' }}/>
      <div style={{
        width: '100%', maxWidth: 440, margin: '0 auto', boxSizing: 'border-box', maxHeight: '100%',
        background: 'rgba(14,5,26,0.97)', borderRadius: '16px 16px 0 0',
        border: `1px solid ${VIOLET}66`, borderBottom: 'none',
        display: 'flex', flexDirection: 'column', animation: 'xi-up 0.26s ease',
      }}>
        {/* Handle + header */}
        <div style={{ flexShrink: 0, padding: '8px 16px 0' }}>
          <div style={{ width: 44, height: 4, borderRadius: 999, background: 'rgba(168,85,247,0.55)', margin: '0 auto 10px' }}/>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ font: "900 13.5px 'Orbitron',sans-serif", color: '#fff', letterSpacing: '0.03em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {exercise?.name}
              </div>
              <div style={{ display: 'flex', gap: 5, marginTop: 5, flexWrap: 'wrap' }}>
                {exercise?.primaryMuscle && <Chip>{String(exercise.primaryMuscle).toUpperCase()}</Chip>}
                {exercise?.equipment && <Chip>{String(exercise.equipment).toUpperCase()}</Chip>}
                <Chip tone="gold">
                  {diff.pips.map((on, i) => <span key={i} style={{ opacity: on ? 1 : 0.35 }}>●</span>)} {diff.label}
                </Chip>
              </div>
            </div>
            <button onClick={onClose} aria-label="Close exercise info" style={{ background: 'none', border: 'none', color: '#c9a6ff', cursor: 'pointer', display: 'flex', padding: 6, margin: -6, flexShrink: 0 }}>
              <X size={18}/>
            </button>
          </div>
        </div>

        {/* Everything below fits without scrolling, by design. */}
        <div style={{ flexShrink: 1, minHeight: 0, overflow: 'hidden', padding: '10px 16px calc(14px + env(safe-area-inset-bottom, 0px))' }}>
          <DemoPanel src={info.demoSrc} name={exercise?.name}/>

          {/* HOW TO */}
          <div style={{ font: "800 7.5px 'Orbitron',sans-serif", color: '#c4a4d8', letterSpacing: '0.18em', margin: '12px 0 6px' }}>HOW TO</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {info.cues.slice(0, 4).map((c, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                <span style={{ font: "900 9px 'Orbitron',sans-serif", color: GOLD, flexShrink: 0, width: 10 }}>{i + 1}</span>
                <span style={{ font: "600 10.5px 'Rajdhani',sans-serif", color: '#e7ddf7', lineHeight: 1.35 }}>{c}</span>
              </div>
            ))}
          </div>

          {/* COMMON MISTAKES — the only red on the sheet */}
          <div style={{ font: "800 7.5px 'Orbitron',sans-serif", color: '#c4a4d8', letterSpacing: '0.18em', margin: '12px 0 6px' }}>COMMON MISTAKES</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {info.mistakes.slice(0, 2).map((m, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                <span style={{ font: "900 9px 'Orbitron',sans-serif", color: RED, flexShrink: 0, width: 10 }}>✕</span>
                <span style={{ font: "600 10.5px 'Rajdhani',sans-serif", color: '#f0a8a8', lineHeight: 1.35 }}>{m}</span>
              </div>
            ))}
          </div>

          {/* EASIER / HARDER — only where a swap can actually happen. Mid-set
              in the player there's nothing to swap into, so they're hidden
              rather than shown as dead chips. */}
          {onSwapTo && (info.easier || info.harder) && (
            <>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                {swapChip(info.easier, 'easier')}
                {swapChip(info.harder, 'harder')}
              </div>
              <div style={{ textAlign: 'center', font: "600 8.5px 'Rajdhani',sans-serif", color: '#9a90b8', marginTop: 5 }}>
                tap to swap this exercise for the easier or harder version
              </div>
            </>
          )}

          {/* From SWAP: the commit action lives here so you can look first. */}
          {fromSwap && (
            <button
              onClick={() => onUse?.(exercise)}
              style={{
                width: '100%', marginTop: 12, height: 46, borderRadius: 11, border: 'none', cursor: 'pointer',
                background: `linear-gradient(135deg, ${GOLD}, #f59e0b)`, color: '#0a0014',
                font: "900 12px 'Orbitron',sans-serif", letterSpacing: '0.08em',
                boxShadow: '0 0 16px rgba(253,224,71,0.35)',
              }}
            >
              ✓ USE THIS EXERCISE
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
