import { useState, useEffect, useRef, useCallback } from 'react';
import PhoneFrame from './PhoneFrame';
import CornerHUD from './CornerHUD';
import { ChevronLeft, Play, Pause, SkipForward, CircleCheck as CheckCircle } from 'lucide-react';
import { C } from './Styles';
import useWakeLock from './hooks/useWakeLock';
import { speakAsync, cancelSpeech, setVoiceGender } from './voiceCoach';
import { playBeep, unlockAudio } from './data/audioEngine';
import { parseTargetReps } from './fit-mode/isBodyweight';

const PACE_MAP = { Slow: 3000, Normal: 2000, Fast: 1000 };
const AUDIO_MODES = ['Voice', 'Beep', 'Voice + Beep', 'Off'];
const PACES = ['Slow', 'Normal', 'Fast'];

function CircularTimer({ value, max, size = 160, label, sub, color = C.yellow }) {
  const r = (size - 16) / 2;
  const circ = 2 * Math.PI * r;
  const pct = max > 0 ? value / max : 0;
  const offset = circ * (1 - pct);
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={10}/>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={10}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.3s ease' }}/>
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 36, color }}>{label}</div>
        {sub && <div style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 13, color: C.muted, marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}

function PillRow({ opts, val, onPick, disabled = false }) {
  return (
    <div style={{ display: 'flex', gap: 5 }}>
      {opts.map(o => (
        <button key={o} onClick={() => onPick(o)} disabled={disabled} style={{
          padding: '5px 10px', borderRadius: 6,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.4 : 1,
          background: val === o ? 'rgba(253,224,71,0.18)' : 'rgba(10,0,20,0.6)',
          border: val === o ? '1px solid rgba(253,224,71,0.5)' : '1px solid rgba(255,255,255,0.06)',
          fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 9,
          color: val === o ? C.yellow : C.muted, letterSpacing: '0.06em',
        }}>{o}</button>
      ))}
    </div>
  );
}

export default function FitRepCoach({ exercise, onBack, onComplete, profile }) {
  useWakeLock(true);
  const targetReps = parseTargetReps(exercise.reps);
  const totalSets = exercise.sets || 3;
  const restDuration = exercise.restSeconds || 60;

  const [currentSet, setCurrentSet] = useState(1);
  const [currentRep, setCurrentRep] = useState(0);
  const [phase, setPhase] = useState('idle'); // idle | active | rest | complete
  const [restRemaining, setRestRemaining] = useState(restDuration);
  const [paused, setPaused] = useState(false);
  const [pace, setPace] = useState('Normal');
  const [audioMode, setAudioMode] = useState('Voice');

  const intervalRef = useRef(null);
  const repRef = useRef(0);
  const phaseRef = useRef(phase);
  const pausedRef = useRef(paused);
  const audioModeRef = useRef(audioMode);

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { pausedRef.current = paused; }, [paused]);
  useEffect(() => { audioModeRef.current = audioMode; }, [audioMode]);
  useEffect(() => { setVoiceGender(profile?.voiceCoach || 'FEMALE'); }, [profile?.voiceCoach]);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => { clearTimer(); cancelSpeech(); }, []);

  const doRepAudio = useCallback((num) => {
    const mode = audioModeRef.current;
    if (mode === 'Off') return;
    if (mode === 'Beep' || mode === 'Voice + Beep') playBeep();
    if (mode === 'Voice' || mode === 'Voice + Beep') speakAsync(String(num));
  }, []);

  const finishSetRef = useRef(null);

  finishSetRef.current = () => {
    clearTimer();
    const mode = audioModeRef.current;
    if (currentSet >= totalSets) {
      setPhase('complete');
      if (mode !== 'Off' && (mode === 'Voice' || mode === 'Voice + Beep')) {
        speakAsync('Exercise complete.');
      }
    } else {
      setPhase('rest');
      setRestRemaining(restDuration);
      if (mode !== 'Off' && (mode === 'Voice' || mode === 'Voice + Beep')) {
        speakAsync('Set complete. Rest.');
      }
    }
  };

  const beginCounting = useCallback(() => {
    clearTimer();
    const ms = PACE_MAP[pace] || 2000;
    intervalRef.current = setInterval(() => {
      if (pausedRef.current) return;
      repRef.current++;
      const r = repRef.current;
      setCurrentRep(r);
      doRepAudio(r);
      if (r >= targetReps) {
        clearTimer();
        finishSetRef.current();
      }
    }, ms);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pace, targetReps]);

  const startSet = useCallback(() => {
    unlockAudio();
    cancelSpeech();
    clearTimer();
    setCurrentRep(0);
    repRef.current = 0;
    setPhase('active');
    setPaused(false);

    const mode = audioModeRef.current;
    const doIntro = async () => {
      if (mode !== 'Off' && (mode === 'Voice' || mode === 'Voice + Beep')) {
        await speakAsync(`Set ${currentSet}, ${exercise.name}. Ready. Go.`);
      }
      beginCounting();
    };
    doIntro();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beginCounting, currentSet, exercise.name]);

  // Rest countdown
  useEffect(() => {
    if (phase !== 'rest') return;
    const id = setInterval(() => {
      setRestRemaining(r => {
        if (r <= 1) {
          clearInterval(id);
          setCurrentSet(s => s + 1);
          setPhase('idle');
          return restDuration;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [phase, restDuration]);

  const skipRest = () => {
    setCurrentSet(s => s + 1);
    setPhase('idle');
    setRestRemaining(restDuration);
  };

  const togglePause = () => {
    setPaused(p => !p);
  };

  const handleBack = () => {
    clearTimer();
    cancelSpeech();
    onBack();
  };

  const handleComplete = () => {
    clearTimer();
    cancelSpeech();
    if (onComplete) onComplete();
    else onBack();
  };

  return (
    <PhoneFrame useBrandBg>
      <CornerHUD color="rgba(253,224,71,0.2)" size={18} inset={8}/>
      <div style={{
        position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column',
        minHeight: '100dvh',
        padding: '16px 18px calc(160px + env(safe-area-inset-bottom, 0px))',
        overflowX: 'hidden',
        WebkitOverflowScrolling: 'touch',
      }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <button onClick={handleBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <ChevronLeft size={22} style={{ color: C.yellow }}/>
          </button>
          <div style={{ flex: 1 }}>
            <div style={{
              fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 13, color: C.yellow,
              letterSpacing: '0.06em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{exercise.name}</div>
            <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 7, color: C.muted, marginTop: 2 }}>
              FIT REP COACH
            </div>
          </div>
          <div style={{
            fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 11, color: C.text,
            background: 'rgba(253,224,71,0.08)', border: '1px solid rgba(253,224,71,0.2)',
            borderRadius: 6, padding: '4px 10px',
          }}>
            SET {currentSet}/{totalSets}
          </div>
        </div>

        {/* Demo Video Placeholder */}
        <div style={{
          width: '100%', borderRadius: 12, marginBottom: 14,
          background: 'rgba(10,0,20,0.8)', border: '1px solid rgba(253,224,71,0.15)',
          aspectRatio: '16/9',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 8, position: 'relative', overflow: 'hidden',
        }}>
          {[['top','left'],['top','right'],['bottom','left'],['bottom','right']].map(([v,h]) => (
            <div key={v+h} style={{
              position: 'absolute', [v]: 10, [h]: 10,
              width: 14, height: 14,
              borderTop: v === 'top' ? '1.5px solid rgba(253,224,71,0.25)' : 'none',
              borderBottom: v === 'bottom' ? '1.5px solid rgba(253,224,71,0.25)' : 'none',
              borderLeft: h === 'left' ? '1.5px solid rgba(253,224,71,0.25)' : 'none',
              borderRight: h === 'right' ? '1.5px solid rgba(253,224,71,0.25)' : 'none',
            }}/>
          ))}
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            background: 'rgba(253,224,71,0.06)',
            border: '1.5px solid rgba(253,224,71,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Play size={20} style={{ color: 'rgba(253,224,71,0.4)', marginLeft: 2 }}/>
          </div>
          <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 10, color: 'rgba(253,224,71,0.45)', letterSpacing: '0.1em' }}>
            DEMO COMING SOON
          </div>
        </div>

        {/* Pace + Audio Mode */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 8 }}>
          <div>
            <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 6, color: C.muted, marginBottom: 4, letterSpacing: '0.1em' }}>PACE</div>
            <PillRow opts={PACES} val={pace} onPick={phase === 'active' ? () => {} : setPace} disabled={phase === 'active'}/>
          </div>
          <div>
            <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 6, color: C.muted, marginBottom: 4, letterSpacing: '0.1em' }}>AUDIO</div>
            <PillRow opts={AUDIO_MODES} val={audioMode} onPick={setAudioMode}/>
          </div>
        </div>

        {/* Target Info */}
        <div style={{ textAlign: 'center', marginBottom: 10 }}>
          <span style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 13, color: C.muted }}>
            Target: {targetReps} reps @ {pace.toLowerCase()} pace
          </span>
        </div>

        {/* Circular Counter */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
          {phase === 'rest' ? (
            <CircularTimer value={restRemaining} max={restDuration} label={restRemaining} sub="REST" color={C.neon}/>
          ) : phase === 'complete' ? (
            <CircularTimer value={targetReps} max={targetReps} label={<CheckCircle size={48} style={{ color: C.yellow }}/>} sub="COMPLETE" color={C.yellow}/>
          ) : (
            <CircularTimer value={currentRep} max={targetReps} label={currentRep} sub={`of ${targetReps}`} color={C.yellow}/>
          )}
        </div>

        {/* Controls */}
        <div style={{ padding: '16px 0 calc(env(safe-area-inset-bottom, 0px) + 12px)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {phase === 'idle' && (
            <button onClick={startSet} style={{
              width: '100%', padding: 16, borderRadius: 12, border: 'none', cursor: 'pointer',
              background: `linear-gradient(135deg, ${C.yellow}, ${C.yellow})`,
              color: C.bg, fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 14,
              letterSpacing: '0.14em',
              boxShadow: '0 0 24px rgba(253,224,71,0.4)',
            }}>
              {currentSet > 1 ? 'START NEXT SET' : 'START SET'}
            </button>
          )}

          {phase === 'active' && (
            <button onClick={togglePause} style={{
              width: '100%', padding: 16, borderRadius: 12, cursor: 'pointer',
              background: paused ? 'rgba(253,224,71,0.15)' : 'rgba(168,85,247,0.15)',
              border: paused ? '1px solid rgba(253,224,71,0.4)' : '1px solid rgba(168,85,247,0.4)',
              color: paused ? C.yellow : C.neon,
              fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 13,
              letterSpacing: '0.12em',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              {paused ? <><Play size={16}/> RESUME</> : <><Pause size={16}/> PAUSE</>}
            </button>
          )}

          {phase === 'rest' && (
            <button onClick={skipRest} style={{
              width: '100%', padding: 16, borderRadius: 12, cursor: 'pointer',
              background: 'rgba(253,224,71,0.12)', border: '1px solid rgba(253,224,71,0.3)',
              color: C.yellow, fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 13,
              letterSpacing: '0.12em',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              <SkipForward size={16}/> SKIP REST
            </button>
          )}

          {phase === 'complete' && (
            <button onClick={handleComplete} style={{
              width: '100%', padding: 16, borderRadius: 12, border: 'none', cursor: 'pointer',
              background: `linear-gradient(135deg, ${C.yellow}, ${C.yellow})`,
              color: C.bg, fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 14,
              letterSpacing: '0.14em',
              boxShadow: '0 0 24px rgba(253,224,71,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              <CheckCircle size={18}/> BACK TO WORKOUT
            </button>
          )}

          {phase !== 'complete' && (
            <button onClick={handleBack} style={{
              width: '100%', padding: 12, borderRadius: 10, cursor: 'pointer',
              background: 'rgba(10,0,20,0.5)', border: '1px solid rgba(255,255,255,0.08)',
              color: C.muted, fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 10,
              letterSpacing: '0.1em',
            }}>
              BACK TO WORKOUT
            </button>
          )}
        </div>
      </div>
    </PhoneFrame>
  );
}
