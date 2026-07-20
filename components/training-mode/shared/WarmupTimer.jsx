import { useState, useEffect, useRef } from 'react';
import PhoneFrame from '../PhoneFrame';
import FightRingBackdrop from './FightRingBackdrop';
import Embers from '../Embers';
import VoiceMixer from './VoiceMixer';
import { speakAsync, stopVoiceSession, primeSpeech } from '../voiceCoach';
import { playBell, playBeep, unlockAudio } from '../data/audioEngine';
import useWakeLock from '../hooks/useWakeLock';

// LT-3 — warm-up phase. Runs on the same ring timer the work phases use, in
// teal so it reads instantly as "not the round yet" against red WORK and blue
// REST. It sits in FRONT of the session rather than inside each timer's phase
// machine: three different machines would each need surgery, and a warm-up has
// no rounds, no cadence and no integrity to track. It awards no XP, counts
// toward no stats, and is exempt from the motion gate for the same reason rest
// is — you're stretching, not working.
const TEAL = '#2dd4bf';
const RING_SIZE = 394;
const RING_R = 174;
const RING_STROKE = 12;

const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

const warmupCSS = `
@keyframes wu-pulse { 0%,100% { opacity: 0.55; } 50% { opacity: 1; } }
@keyframes wu-flash { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }
`;

export default function WarmupTimer({ minutes = 5, title = 'WARM-UP', onDone, onSkip }) {
  useWakeLock(true);
  const totalSec = Math.max(1, Math.round(minutes * 60));
  const [remaining, setRemaining] = useState(totalSec);
  const halfSpokenRef = useRef(false);
  const lastBeepRef = useRef(null);
  const doneRef = useRef(false);

  useEffect(() => {
    unlockAudio();
    primeSpeech()
      .then(() => speakAsync(`Warm up. ${minutes} minutes. Stretch and get loose.`))
      .catch(() => {});
    return () => stopVoiceSession();
  }, [minutes]);

  useEffect(() => {
    const id = setInterval(() => setRemaining(r => (r > 0 ? r - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (doneRef.current) return;

    // Halfway nudge.
    if (!halfSpokenRef.current && remaining > 0 && remaining <= Math.floor(totalSec / 2)) {
      halfSpokenRef.current = true;
      speakAsync('Halfway through the warm up. Keep moving.').catch(() => {});
    }

    // Last 10s beeps.
    if (remaining > 0 && remaining <= 10 && lastBeepRef.current !== remaining) {
      lastBeepRef.current = remaining;
      playBeep();
    }

    if (remaining === 0) {
      doneRef.current = true;
      playBell(1);
      speakAsync('Warm up complete. Here we go.').catch(() => {});
      const t = setTimeout(() => onDone?.(), 1200);
      return () => clearTimeout(t);
    }
  }, [remaining, totalSec, onDone]);

  const cx = RING_SIZE / 2;
  const cy = RING_SIZE / 2;
  const circ = 2 * Math.PI * RING_R;
  const pct = ((totalSec - remaining) / totalSec) * 100;
  const offset = circ - (pct / 100) * circ;
  const finalTen = remaining <= 10 && remaining > 0;

  return (
    <PhoneFrame useBrandBg>
      <FightRingBackdrop/>
      <style dangerouslySetInnerHTML={{ __html: warmupCSS }}/>
      <Embers count={3}/>

      <div style={{
        position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column',
        alignItems: 'center', minHeight: '100dvh',
        padding: '14px 14px calc(100px + env(safe-area-inset-bottom, 0px))',
      }}>
        <VoiceMixer top={10} right={10}/>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', marginBottom: 6 }}>
          <div style={{
            fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 14,
            color: TEAL, letterSpacing: '0.12em', textShadow: `0 0 10px ${TEAL}55`,
          }}>{title}</div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 7, marginBottom: 12 }}>
          <span style={{
            fontFamily: "'Orbitron',sans-serif", fontSize: 8, fontWeight: 700, color: '#9ff0e4',
            border: `1px solid ${TEAL}66`, borderRadius: 6, padding: '4px 9px', letterSpacing: '0.04em',
          }}>{minutes} MIN</span>
          <span style={{
            fontFamily: "'Orbitron',sans-serif", fontSize: 8, fontWeight: 700, color: '#9ff0e4',
            border: `1px solid ${TEAL}66`, borderRadius: 6, padding: '4px 9px', letterSpacing: '0.04em',
          }}>NO XP</span>
        </div>

        <div style={{ position: 'relative', width: '100%', maxWidth: 320, aspectRatio: '1', marginBottom: 14 }}>
          <svg width="100%" height="100%" viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`} style={{ display: 'block', overflow: 'visible' }}>
            <circle cx={cx} cy={cy} r={RING_R} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={RING_STROKE}/>
            <circle cx={cx} cy={cy} r={RING_R + 14} fill="none"
              stroke={TEAL} opacity="0.15" strokeWidth="1" strokeDasharray="3 7"
              className="anim-slow-rotate" style={{ transformOrigin: `${cx}px ${cy}px` }}/>
            <circle cx={cx} cy={cy} r={RING_R} fill="none"
              stroke={TEAL} strokeWidth={RING_STROKE} strokeLinecap="round"
              strokeDasharray={circ} strokeDashoffset={offset}
              transform={`rotate(-90 ${cx} ${cy})`}
              style={{
                filter: `drop-shadow(0 0 8px ${TEAL})`,
                transition: 'stroke-dashoffset 0.9s linear',
              }}/>
          </svg>

          <div style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', padding: '0 20px',
          }}>
            <div style={{
              fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 10,
              color: TEAL, letterSpacing: '0.16em', marginBottom: 6,
              animation: 'wu-pulse 2.4s ease-in-out infinite',
            }}>WARM-UP</div>
            <div style={{
              fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 46,
              color: '#fff', letterSpacing: '0.02em', lineHeight: 1,
              animation: finalTen ? 'wu-flash 1s ease-in-out infinite' : 'none',
            }}>{fmt(remaining)}</div>
            <div style={{
              fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 12,
              color: '#9ff0e4', marginTop: 8, textAlign: 'center',
            }}>STRETCH &amp; GET LOOSE</div>
          </div>
        </div>

        <button onClick={() => { stopVoiceSession(); onSkip?.(); }} style={{
          width: '100%', maxWidth: 320, height: 46, borderRadius: 12,
          background: 'transparent', border: `1px solid ${TEAL}66`, color: TEAL,
          fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 12,
          letterSpacing: '0.1em', cursor: 'pointer',
        }}>SKIP → START</button>
      </div>
    </PhoneFrame>
  );
}
