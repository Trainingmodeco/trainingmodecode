import { useState, useEffect, useRef, useCallback } from 'react';
import PhoneFrame from '../PhoneFrame';
import FightRingBackdrop from './FightRingBackdrop';
import Embers from '../Embers';
import VoiceMixer from './VoiceMixer';
import FloatOnLeave from './FloatOnLeave';
import { speakAsync, cancelSpeech, stopVoiceSession, primeSpeech } from '../voiceCoach';
import { playBell, playBeep, unlockAudio } from '../data/audioEngine';
import useWakeLock from '../hooks/useWakeLock';
import useMiniPlayer from '../hooks/useMiniPlayer';

// LT-3 — warm-up phase. Runs on the same ring timer the work phases use, in
// teal so it reads instantly as "not the round yet" against red WORK and blue
// REST. It sits in FRONT of the session rather than inside each timer's phase
// machine: three different machines would each need surgery, and a warm-up has
// no rounds, no cadence and no integrity to track. It awards no XP, counts
// toward no stats, and is exempt from the motion gate for the same reason rest
// is — you're stretching, not working.
//
// Build Workout runs its warm-up here too, with a few extras that are all
// optional props, so a Fight warm-up (none of them passed) renders as before:
//   suggestions / initialPick / onPick — a 2×2 grid of warm-up ideas under the
//     ring. A pick only changes the caption and the cue line and says it once;
//     nothing is counted or enforced, the clock is the only rule.
//   skipLabel — the skip button's words ('SKIP → START WORKOUT').
//   intro     — the opening line the coach speaks.
//   miniPlayer — feed the floating window, so it is already open when the
//     guided player takes it over (see hooks/useMiniPlayer).
const TEAL = '#2dd4bf';
const RING_SIZE = 394;
const RING_R = 174;
const RING_STROKE = 12;

const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

const warmupCSS = `
@keyframes wu-pulse { 0%,100% { opacity: 0.55; } 50% { opacity: 1; } }
@keyframes wu-flash { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }
`;

// The floating window while warming up: the warm-up is the position, the
// picked idea is the name and UP NEXT reads WORKOUT. Its own component so the
// hook only runs for a caller that asked for it.
function WarmupMiniFeed({ remaining, totalSec, name }) {
  const frame = useCallback(() => ({
    phase: 'work',
    clock: `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`,
    progress: (totalSec - remaining) / totalSec,
    reps: null,
    repsLabel: 'REPS',
    name,
    prescription: `${Math.round(totalSec / 60)} min warm-up · your pace`,
    nextName: 'WORKOUT',
    segments: ['current'],
  }), [remaining, totalSec, name]);
  const mini = useMiniPlayer(frame, true);
  return <FloatOnLeave {...mini}/>;
}

export default function WarmupTimer({
  minutes = 5, title = 'WARM-UP', onDone, onSkip,
  suggestions, initialPick, onPick, skipLabel = 'SKIP → START', intro, miniPlayer = false,
}) {
  useWakeLock(true);
  const totalSec = Math.max(1, Math.round(minutes * 60));
  const [remaining, setRemaining] = useState(totalSec);
  const halfSpokenRef = useRef(false);
  const lastBeepRef = useRef(null);
  const doneRef = useRef(false);
  const hasIdeas = Array.isArray(suggestions) && suggestions.length > 0;
  const [pickId, setPickId] = useState(() => (hasIdeas ? (suggestions.find(x => x.id === initialPick) || suggestions[0]).id : null));
  const pick = hasIdeas ? suggestions.find(x => x.id === pickId) || suggestions[0] : null;

  // The callbacks are read through refs. The hand-off at 00:00 runs on a
  // 1.2s timeout; with onDone in the effect's deps, a parent re-render in that
  // window (any inline arrow) cleared the timeout, and the re-run then bailed
  // on doneRef — the ring sat at 00:00 for good.
  const doneCb = useRef(onDone);
  doneCb.current = onDone;
  const pickCb = useRef(onPick);
  pickCb.current = onPick;
  const introRef = useRef(intro);

  useEffect(() => {
    unlockAudio();
    primeSpeech()
      .then(() => speakAsync(introRef.current || `Warm up. ${minutes} minutes. Stretch and get loose.`))
      .catch(() => {});
    return () => stopVoiceSession();
  }, [minutes]);

  const choose = (idea) => {
    if (idea.id === pickId) return;
    setPickId(idea.id);
    cancelSpeech();
    speakAsync(idea.say || idea.label).catch(() => {});
    pickCb.current?.(idea.id);
  };

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
      const t = setTimeout(() => doneCb.current?.(), 1200);
      return () => clearTimeout(t);
    }
  }, [remaining, totalSec]);

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
      {miniPlayer && <WarmupMiniFeed remaining={remaining} totalSec={totalSec} name={pick?.label || 'WARM UP'}/>}

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

        {/* With the idea chips under it the ring gives up a little height on
            short phones, so SKIP stays on screen above the tab bar. */}
        <div style={{ position: 'relative', width: '100%', maxWidth: hasIdeas ? 'min(320px, 40dvh)' : 320, aspectRatio: '1', marginBottom: 14 }}>
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
            }}>{pick ? `${pick.label} · YOUR PACE` : 'STRETCH & GET LOOSE'}</div>
          </div>
        </div>

        {hasIdeas && (
          <div style={{ width: '100%', maxWidth: 320, marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{
              fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 8.5,
              color: '#5fbfb2', letterSpacing: '0.2em', textAlign: 'center',
            }}>PICK ONE · OR DO YOUR OWN THING</div>
            <div role="radiogroup" aria-label="Warm-up idea" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
              {suggestions.map(idea => {
                const on = idea.id === pick.id;
                return (
                  <button key={idea.id} type="button" role="radio" aria-checked={on ? 'true' : 'false'} aria-label={idea.label}
                    onClick={() => choose(idea)} style={{
                      height: 44, borderRadius: 10, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 10.5, letterSpacing: '0.08em',
                      color: on ? '#04130f' : '#9ff0e4',
                      background: on ? TEAL : 'rgba(45,212,191,0.06)',
                      border: `1px solid ${on ? TEAL : `${TEAL}66`}`,
                      boxShadow: on ? `0 0 14px ${TEAL}73` : 'none',
                    }}>
                    <span aria-hidden="true" style={{ fontSize: 14 }}>{idea.emoji}</span>{idea.label}
                  </button>
                );
              })}
            </div>
            <div style={{
              fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 12.5,
              color: '#c8f5ee', textAlign: 'center', minHeight: 18,
            }}>{pick.cue}</div>
          </div>
        )}

        <button onClick={() => { stopVoiceSession(); onSkip?.(); }} style={{
          width: '100%', maxWidth: 320, height: 46, borderRadius: 12,
          background: 'transparent', border: `1px solid ${TEAL}66`, color: TEAL,
          fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 12,
          letterSpacing: '0.1em', cursor: 'pointer',
        }}>{skipLabel}</button>
      </div>
    </PhoneFrame>
  );
}
