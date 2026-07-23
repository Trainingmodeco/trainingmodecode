import { useState, useEffect, useRef, useMemo } from 'react';
import PhoneFrame from './PhoneFrame';
import { Square, SkipForward } from 'lucide-react';
import useWakeLock from './hooks/useWakeLock';
import useIntegritySession from './hooks/useIntegritySession';
import { playBell, playBeep, unlockAudio } from './data/audioEngine';
import { speakOrDelay, speakAsync, cancelSpeech, primeSpeech, stopVoiceSession, delay } from './voiceCoach';

// Phase 2 · 2.4b — CONDITIONING runner for the camp's S2 (PM) block. Same round
// engine shape as Fight Focus (drives cfg.blockRounds, produces the identical
// onEnd(rounds, cfg, completed, integrityResult) so 1.6 anti-cheat still gates)
// but presented as conditioning: teal palette, exercise goal front-and-centre,
// no strike counter, no fight framing. Distinct from the striking ring timer.
const TEAL = '#2dd4bf';
const GREEN = '#22c55e';
const BLUE = '#4f8cff';
const RING_SIZE = 300;
const RING_R = 128;
const RING_STROKE = 12;

export default function CampFitRunner({ cfg, onEnd }) {
  useWakeLock(true);
  const total = cfg.rounds || (cfg.blockRounds ? cfg.blockRounds.length : 1);
  const roundSec = Math.round((cfg.roundMin || 1) * 60);
  const restSec = cfg.restSec ?? 45;
  const rounds = useMemo(
    () => (cfg.blockRounds && cfg.blockRounds.length
      ? cfg.blockRounds
      : Array.from({ length: total }, (_, i) => ({ round_title: `Interval ${i + 1}`, coach_prompt: '' }))),
    [cfg.blockRounds, total],
  );

  const integrity = useIntegritySession('combatConditioning', total);
  const startedRef = useRef(false);

  const [phase, setPhase] = useState('work');       // 'work' | 'rest'
  const [roundIdx, setRoundIdx] = useState(0);
  const [remaining, setRemaining] = useState(roundSec);
  const [paused, setPaused] = useState(false);
  const [countdown, setCountdown] = useState('3');
  const [done, setDone] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);

  const phaseRef = useRef('work');
  const roundIdxRef = useRef(0);
  const doneRef = useRef(false);
  const bellEndRef = useRef(false);
  const beepRef = useRef(null);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { roundIdxRef.current = roundIdx; }, [roundIdx]);
  useEffect(() => { doneRef.current = done; }, [done]);

  // Intro: 3-2-1-GO once, then round 1 runs.
  useEffect(() => {
    if (!startedRef.current) { startedRef.current = true; integrity.startUnit('circuit'); }
    let cancelled = false;
    (async () => {
      unlockAudio();
      if (cfg.voiceOn) await primeSpeech();
      for (const n of ['3', '2', '1']) {
        if (cancelled) return;
        setCountdown(n);
        await speakOrDelay(n, 1000, { voice: cfg.voiceOn });
      }
      if (cancelled) return;
      playBell(1);
      setCountdown('GO');
      await delay(500);
      if (cancelled) return;
      setCountdown(null);
    })();
    return () => { cancelled = true; cancelSpeech(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Per-second tick.
  useEffect(() => {
    if (paused || done || countdown !== null) return;
    const id = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(id);
  }, [paused, done, countdown]);

  // Phase transitions.
  useEffect(() => {
    if (countdown !== null || paused || doneRef.current) return;
    if (remaining > 0) {
      if (remaining <= 3 && beepRef.current !== remaining) { beepRef.current = remaining; playBeep(); }
      return;
    }
    if (phaseRef.current === 'work') {
      integrity.completeUnit();
      if (roundIdxRef.current + 1 >= total) {
        if (!bellEndRef.current) { bellEndRef.current = true; playBell(3); }
        setDone(true);
        const ir = integrity.finalize({});
        setTimeout(() => { if (cfg.voiceOn) speakAsync('Work done. Recover well.'); }, 300);
        setTimeout(() => { stopVoiceSession(); onEnd(rounds, cfg, total, ir); }, 1300);
      } else {
        playBell(2);
        setPhase('rest');
        setRemaining(restSec);
        if (cfg.voiceOn) setTimeout(() => speakAsync('Rest.'), 300);
      }
    } else {
      setPhase('work');
      integrity.startUnit('circuit');
      setRoundIdx((i) => i + 1);
      setRemaining(roundSec);
      beepRef.current = null;
      playBell(1);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining]);

  const handlePause = () => {
    if (!paused) { cancelSpeech(); integrity.pause(); } else { integrity.resume(); }
    setPaused((p) => !p);
  };

  const handleSkip = () => {
    cancelSpeech();
    beepRef.current = null;
    if (roundIdx + 1 < total) {
      integrity.completeUnit();
      integrity.startUnit('circuit');
      setPhase('work');
      setRoundIdx((i) => i + 1);
      setRemaining(roundSec);
    } else {
      const ir = integrity.finalize({});
      stopVoiceSession();
      onEnd(rounds, cfg, total, ir);
    }
  };

  const handleEnd = () => {
    stopVoiceSession();
    const completed = Math.min(phase === 'rest' ? roundIdx + 1 : roundIdx, total);
    const ir = integrity.finalize({});
    onEnd(rounds, cfg, completed, ir);
  };

  const maxTime = phase === 'rest' ? restSec : roundSec;
  const pct = countdown !== null ? 100 : (remaining / maxTime) * 100;
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const resting = phase === 'rest';
  const ringColor = resting ? BLUE : (remaining <= 5 ? '#f59e0b' : TEAL);
  const cx = RING_SIZE / 2, cy = RING_SIZE / 2;
  const circ = 2 * Math.PI * RING_R;
  const offset = circ - (pct / 100) * circ;
  const cur = rounds[Math.min(roundIdx, rounds.length - 1)] || { round_title: '', coach_prompt: '' };

  return (
    <PhoneFrame useBrandBg>
      <div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '14px 16px 0' }}>
        {/* Header */}
        <div style={{ font: "900 17px 'Orbitron',sans-serif", color: TEAL, letterSpacing: '0.08em', textShadow: `0 0 14px ${TEAL}66` }}>CONDITIONING</div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <span style={{ font: "800 9px 'Orbitron',sans-serif", color: '#0a1a17', background: TEAL, borderRadius: 5, padding: '3px 8px', letterSpacing: '0.05em' }}>ROUND {Math.min(roundIdx + 1, total)}/{total}</span>
          <span style={{ font: "800 9px 'Orbitron',sans-serif", color: '#bfe9e1', background: 'rgba(45,212,191,0.12)', border: '1px solid rgba(45,212,191,0.3)', borderRadius: 5, padding: '3px 8px', letterSpacing: '0.05em' }}>{String(cfg.difficulty || '').toUpperCase()}</span>
        </div>

        {/* Ring */}
        <div style={{ position: 'relative', width: RING_SIZE, height: RING_SIZE, marginTop: 10, maxWidth: '100%' }}>
          <svg width="100%" height="100%" viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
            <circle cx={cx} cy={cy} r={RING_R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={RING_STROKE} />
            <circle cx={cx} cy={cy} r={RING_R} fill="none" stroke={ringColor} strokeWidth={RING_STROKE} strokeLinecap="round"
              strokeDasharray={circ} strokeDashoffset={offset} transform={`rotate(-90 ${cx} ${cy})`}
              style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s', filter: `drop-shadow(0 0 10px ${ringColor}88)` }} />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            {countdown !== null ? (
              <div style={{ font: "900 84px 'Orbitron',sans-serif", color: TEAL, textShadow: `0 0 24px ${TEAL}88` }}>{countdown}</div>
            ) : (
              <>
                <div style={{ font: "700 11px 'Press Start 2P',monospace", color: resting ? BLUE : TEAL, letterSpacing: '0.1em', marginBottom: 8 }}>{resting ? '☕ REST' : '🔥 WORK'}</div>
                <div style={{ font: "900 56px 'Orbitron',sans-serif", color: '#fff', letterSpacing: '0.02em' }}>{mins}:{String(secs).padStart(2, '0')}</div>
                <div style={{ font: "600 9px 'Rajdhani',sans-serif", color: '#9a90b8', marginTop: 4 }}>OF {Math.floor(maxTime / 60)}:{String(maxTime % 60).padStart(2, '0')}</div>
              </>
            )}
          </div>
        </div>

        {/* Round pips */}
        <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          {rounds.map((_, i) => {
            const stt = i < roundIdx || done ? 'done' : i === roundIdx ? 'now' : 'todo';
            return <div key={i} style={{ width: 22, height: 22, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', font: "800 9px 'Orbitron',sans-serif", color: stt === 'now' ? '#0a1a17' : stt === 'done' ? GREEN : '#6f6690', background: stt === 'now' ? TEAL : 'rgba(8,2,18,0.6)', border: `1px solid ${stt === 'done' ? 'rgba(34,197,94,0.5)' : stt === 'now' ? TEAL : 'rgba(168,85,247,0.25)'}` }}>{i + 1}</div>;
          })}
        </div>

        {/* Current exercise / goal */}
        <div style={{ marginTop: 14, width: '100%', maxWidth: 360, background: 'rgba(45,212,191,0.06)', border: '1px solid rgba(45,212,191,0.25)', borderRadius: 12, padding: '12px 14px', textAlign: 'center' }}>
          <div style={{ font: "900 15px 'Orbitron',sans-serif", color: '#eafffb', letterSpacing: '0.02em' }}>{(cur.round_title || '').toUpperCase()}</div>
          {cur.coach_prompt ? <div style={{ font: "600 11px 'Rajdhani',sans-serif", color: '#9fd8ce', marginTop: 3 }}>{cur.coach_prompt}</div> : null}
        </div>

        {/* Controls */}
        <div style={{ marginTop: 'auto', width: '100%', maxWidth: 360, paddingBottom: 14 }}>
          <button onClick={handlePause} style={{ width: '100%', height: 46, borderRadius: 12, border: paused ? 'none' : `1px solid ${TEAL}55`, background: paused ? `linear-gradient(135deg,${TEAL},${GREEN})` : 'rgba(45,212,191,0.14)', color: paused ? '#04140f' : TEAL, font: "900 14px 'Orbitron',sans-serif", letterSpacing: '0.08em', cursor: 'pointer' }}>
            {paused ? '▶ RESUME' : '❚❚ PAUSE'}
          </button>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button onClick={handleSkip} style={{ flex: 1, height: 38, borderRadius: 10, border: '1px solid rgba(168,85,247,0.35)', background: 'rgba(168,85,247,0.08)', color: '#c9a6ff', font: "700 10px 'Orbitron',sans-serif", letterSpacing: '0.06em', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><SkipForward size={13} /> SKIP</button>
            <button onClick={() => setConfirmEnd(true)} style={{ flex: 1, height: 38, borderRadius: 10, border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.08)', color: '#ff8a8a', font: "700 10px 'Orbitron',sans-serif", letterSpacing: '0.06em', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><Square size={12} /> END</button>
          </div>
        </div>
      </div>

      {confirmEnd && (
        <div onClick={() => setConfirmEnd(false)} style={{ position: 'absolute', inset: 0, zIndex: 40, background: 'rgba(4,0,10,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 280, background: 'rgba(16,7,32,0.96)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 15, padding: 18, textAlign: 'center' }}>
            <div style={{ font: "900 14px 'Orbitron',sans-serif", color: '#fff', marginBottom: 6 }}>END SESSION?</div>
            <div style={{ font: "600 10.5px 'Rajdhani',sans-serif", color: '#c4a4d8', marginBottom: 14 }}>You&apos;ll get credit for the rounds you finished.</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setConfirmEnd(false)} style={{ flex: 1, height: 38, borderRadius: 10, border: '1px solid rgba(168,85,247,0.35)', background: 'transparent', color: '#c9a6ff', font: "800 11px 'Orbitron',sans-serif", cursor: 'pointer' }}>KEEP GOING</button>
              <button onClick={handleEnd} style={{ flex: 1, height: 38, borderRadius: 10, border: 'none', background: '#ef4444', color: '#fff', font: "800 11px 'Orbitron',sans-serif", cursor: 'pointer' }}>END</button>
            </div>
          </div>
        </div>
      )}
    </PhoneFrame>
  );
}
