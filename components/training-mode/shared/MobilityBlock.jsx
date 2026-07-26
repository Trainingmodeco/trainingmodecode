import { useState, useEffect, useRef } from 'react';
import { speakAsync, stopVoiceSession, primeSpeech } from '../voiceCoach';
import { playBell, playBeep, unlockAudio } from '../data/audioEngine';
import useWakeLock from '../hooks/useWakeLock';

// Short GUIDED mobility block — the 90 seconds between answering the bell and
// round 1. The boss gate deliberately drops the normal 3-minute warm-up, but a
// 39-minute max-effort gauntlet off a cold start is a genuine injury risk, so
// this keeps the joints covered without breaking the "no warm-up" feel:
// six named moves, called out loud, auto-advancing, skippable.
//
// Palette matches the gate (black / blood-red) rather than the teal warm-up —
// it reads as part of the boss ceremony, not a detour out of it.
const RED = '#ef4444';
const RED_HOT = '#ff2626';
const MUTED = '#9a90b8';

const MOVES = [
  { name: 'SHOULDER ROLLS', cue: 'Big circles, both directions. Loosen the shoulders.' },
  { name: 'ARM SWINGS', cue: 'Across the body and open. Wake the chest and back.' },
  { name: 'HIP OPENERS', cue: 'Knee circles, both sides. Open the hips.' },
  { name: 'LEG SWINGS', cue: 'Front to back, then across. Hold something if you need to.' },
  { name: 'TORSO TWISTS', cue: 'Rotate through the spine. Keep the feet planted.' },
  { name: 'BOUNCE + SHADOW', cue: 'Light on the feet. Throw easy — get the blood up.' },
];
const PER_MOVE_SEC = 15;

const CSS = `
@keyframes mb-pulse { 0%,100% { opacity: 0.6; } 50% { opacity: 1; } }
@keyframes mb-in { 0% { opacity: 0; transform: translateY(10px); } 100% { opacity: 1; transform: none; } }
`;

export default function MobilityBlock({ onDone }) {
  useWakeLock(true);
  const [idx, setIdx] = useState(0);
  const [left, setLeft] = useState(PER_MOVE_SEC);
  const doneRef = useRef(false);
  const doneCb = useRef(onDone);
  doneCb.current = onDone;

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    stopVoiceSession();
    doneCb.current?.();
  };

  // Announce each move as it comes up.
  useEffect(() => {
    if (doneRef.current) return;
    const m = MOVES[idx];
    if (!m) return;
    if (idx === 0) {
      unlockAudio();
      primeSpeech()
        .then(() => speakAsync(`Loosen up. ${m.name}. ${m.cue}`))
        .catch(() => {});
    } else {
      speakAsync(`${m.name}. ${m.cue}`).catch(() => {});
    }
  }, [idx]);

  useEffect(() => () => stopVoiceSession(), []);

  // One clock for the whole block; rolls into the next move at zero.
  useEffect(() => {
    if (doneRef.current) return undefined;
    const id = setInterval(() => {
      setLeft(prev => {
        if (prev > 1) {
          if (prev <= 4) playBeep();
          return prev - 1;
        }
        // move over
        setIdx(i => {
          if (i + 1 >= MOVES.length) {
            playBell(1);
            speakAsync('Loose enough. Answer the bell.').catch(() => {});
            setTimeout(finish, 900);
            return i;
          }
          return i + 1;
        });
        return PER_MOVE_SEC;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const move = MOVES[idx] || MOVES[MOVES.length - 1];
  const totalSec = MOVES.length * PER_MOVE_SEC;
  const elapsed = idx * PER_MOVE_SEC + (PER_MOVE_SEC - left);
  const pct = Math.min(100, (elapsed / totalSec) * 100);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 380, background: '#000',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '28px 24px calc(28px + env(safe-area-inset-bottom, 0px))', textAlign: 'center',
    }}>
      <style dangerouslySetInnerHTML={{ __html: CSS }}/>
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse at 50% 45%, rgba(239,68,68,0.14) 0%, transparent 70%)',
      }}/>

      <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
        <div style={{
          fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 9,
          color: RED, letterSpacing: '0.26em', marginBottom: 22,
        }}>
          LOOSEN UP · {MOVES.length * PER_MOVE_SEC}s
        </div>

        <div style={{
          fontFamily: "'Press Start 2P',monospace", fontSize: 34, color: '#fff',
          letterSpacing: '0.02em', marginBottom: 20,
          animation: left <= 3 ? 'mb-pulse 0.8s ease-in-out infinite' : 'none',
        }}>
          {String(left).padStart(2, '0')}
        </div>

        <div key={idx} style={{ animation: 'mb-in 0.3s ease-out both' }}>
          <div style={{
            fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 22,
            color: '#fff', letterSpacing: '0.04em', lineHeight: 1.1,
            textShadow: '0 0 18px rgba(239,68,68,0.5)',
          }}>
            {move.name}
          </div>
          <div style={{
            fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 12.5,
            color: '#e2b8b8', marginTop: 8, maxWidth: 260, lineHeight: 1.45,
          }}>
            {move.cue}
          </div>
        </div>

        {/* Move pips */}
        <div style={{ display: 'flex', gap: 5, marginTop: 24 }}>
          {MOVES.map((_, i) => (
            <div key={i} style={{
              width: i === idx ? 16 : 6, height: 4, borderRadius: 99,
              background: i < idx ? RED : i === idx ? RED_HOT : 'rgba(255,255,255,0.16)',
              transition: 'width .25s ease, background .25s ease',
            }}/>
          ))}
        </div>
      </div>

      <div style={{ position: 'relative', width: '100%', maxWidth: 320, flexShrink: 0 }}>
        <div style={{ height: 3, borderRadius: 2, background: 'rgba(239,68,68,0.18)', overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ height: '100%', width: `${pct}%`, background: RED_HOT, transition: 'width 1s linear' }}/>
        </div>
        <button onClick={finish} style={{
          width: '100%', height: 44, borderRadius: 12, cursor: 'pointer',
          background: 'transparent', border: '1px solid rgba(255,255,255,0.18)',
          fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 11,
          color: MUTED, letterSpacing: '0.1em',
        }}>
          SKIP → ROUND 1
        </button>
      </div>
    </div>
  );
}
