import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import PhoneFrame from './PhoneFrame';
import { ChevronLeft, RotateCcw, Square, SkipForward, CircleCheck as CheckCircle } from 'lucide-react';
import { generateComboCoachSession } from './data/sessionGenerator';
import { speakAsync, speakOrDelay, cancelSpeech, primeSpeech, stopVoiceSession, delay } from './voiceCoach';
import useWakeLock from './hooks/useWakeLock';
import useIntegritySession from './hooks/useIntegritySession';
import { playBell, playBeep, unlockAudio } from './data/audioEngine';
import { C } from './Styles';
import { getCoachCopy } from './data/coachCopy';
import { RushOverlay, RushPersistentEffects, RushTimerAura, RushGlowBurst } from './RushEffects';
import { isRushAt } from './shared/rushSchedule';
import { scheduleEncouragements, pickEncouragement } from './data/coachEncouragement';
import CoachCaption from './CoachCaption';
import TrainingCTA from './shared/TrainingCTA';

const VIOLET = C.violet;
const RING_SIZE = 394;
// Radius tuned so the progress arc sits on the outer edge of ring-combo.webp.
const RING_R = 174;
const RING_STROKE = 12;

function getPhaseColor(remaining, phase, rush) {
  if (phase === 'rest') return '#4f8cff';
  if (rush) return '#f97316';
  if (remaining <= 30) return '#ef4444';
  if (remaining > 60) return '#a855f7';
  return '#f59e0b';
}

function getTipPosition(offset, circ, R, cx, cy) {
  const angle = ((circ - offset) / circ) * 2 * Math.PI - Math.PI / 2;
  return { x: cx + R * Math.cos(angle), y: cy + R * Math.sin(angle) };
}

const activeCSS = `
@keyframes combo-pulse {
  0%, 100% { transform: scale(1); opacity: 0.6; }
  50% { transform: scale(1.15); opacity: 1; }
}
@keyframes combo-pulse-fast {
  0%, 100% { transform: scale(1); opacity: 0.7; }
  50% { transform: scale(1.2); opacity: 1; }
}
.combo-orb {
  border-radius: 50%;
  position: absolute;
  pointer-events: none;
}
@keyframes combo-beat {
  0%, 100% { transform: scale(0.85); opacity: 0.35; }
  50% { transform: scale(1.15); opacity: 1; }
}
.combo-beat-dot {
  animation-name: combo-beat;
  animation-iteration-count: infinite;
  animation-timing-function: ease-in-out;
}
`;

export default function ComboCoachActive({ discipline, cfg, onEnd, initialPaused, onStateChange, initialResumeData }) {
  useWakeLock(true);
  const totalRounds = cfg.rounds || 3;
  const roundSec = (cfg.roundMin || 3) * 60;
  const restSec = cfg.restSec || 60;

  const integrity = useIntegritySession('comboCoach', totalRounds);
  const integrityStartedRef = useRef(false);
  const [rapidWarning, setRapidWarning] = useState(null);
  const pool = useMemo(() => generateComboCoachSession({
    discipline,
    difficulty: cfg.difficulty,
    speed: cfg.speed,
    rounds: totalRounds,
    roundDuration: cfg.roundMin,
    mode: cfg.mode,
    arsenalOnly: cfg.arsenalOnly,
    arsenal: cfg.arsenal,
  }), [discipline, cfg.difficulty, cfg.speed, totalRounds, cfg.roundMin, cfg.mode, cfg.arsenalOnly, cfg.arsenal]);
  const comboIndexRef = useRef(0);

  const [phase, setPhase] = useState(initialResumeData?.phase ?? 'round');
  const [roundIdx, setRoundIdx] = useState(initialResumeData?.roundIdx ?? 0);
  const [remaining, setRemaining] = useState(initialResumeData?.remaining ?? roundSec);
  const [paused, setPaused] = useState(!!initialPaused);
  const [rush, setRush] = useState(false);
  const [done, setDone] = useState(false);
  const [countdown, setCountdown] = useState(initialPaused ? null : '3');
  const [countdownSub, setCountdownSub] = useState('');
  const [currentCombo, setCurrentCombo] = useState(pool[0]);
  const [comboStreak, setComboStreak] = useState(0);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [showRushOverlay, setShowRushOverlay] = useState(false);
  const [captionText, setCaptionText] = useState('');
  const rushSpoken = useRef(false);
  const lastRushCountdownSecond = useRef(null);
  const lastBeepSecondRef = useRef(null);
  const roundStartBellPlayedRef = useRef(false);
  const roundEndBellPlayedRef = useRef(false);
  const roundVersion = useRef(0);
  const comboLoopRef = useRef(null);
  const pausedRef = useRef(false);
  const rushRef = useRef(false);
  const remainingRef = useRef(remaining);
  const encourageSchedule = useRef([]);
  const encourageUsedIds = useRef(new Set());
  const encourageFiredSet = useRef(new Set());
  const isSpeakingCombo = useRef(false);
  const skipInitialIntro = useRef(!!initialPaused);
  const streakRef = useRef(0);

  const phaseRef     = useRef('round');
  const roundIdxRef  = useRef(0);
  const doneRef      = useRef(false);

  useEffect(() => { pausedRef.current = paused; }, [paused]);
  useEffect(() => { rushRef.current = rush; }, [rush]);
  useEffect(() => { remainingRef.current = remaining; }, [remaining]);
  useEffect(() => { phaseRef.current    = phase;    }, [phase]);
  useEffect(() => { roundIdxRef.current = roundIdx; }, [roundIdx]);
  useEffect(() => { doneRef.current     = done;     }, [done]);

  useEffect(() => {
    if (typeof onStateChange === 'function') {
      onStateChange({ phase, roundIdx, remaining });
    }
  }, [phase, roundIdx, remaining, onStateChange]);

  const voiceRate = cfg.speed === 'slow' ? 0.85 : cfg.speed === 'turbo' ? 1.1 : 1.0;
  const speedLabel = cfg.speedLabel || cfg.speed?.toUpperCase() || 'MEDIUM';
  const cadenceMs = cfg.ms || 4000;

  const nextCombo = pool[(comboIndexRef.current) % pool.length];

  const runIntro = useCallback(async (rIdx) => {
    cancelSpeech();
    const version = ++roundVersion.current;
    const aborted = () => version !== roundVersion.current;
    const voice = cfg.voiceOn !== false;

    setCountdownSub(`ROUND ${rIdx + 1}`);

    setCountdown('3');
    await speakOrDelay('3', 1000, { voice });
    if (aborted()) return;

    setCountdown('2');
    await speakOrDelay('2', 1000, { voice });
    if (aborted()) return;

    setCountdown('1');
    await speakOrDelay('1', 1000, { voice });
    if (aborted()) return;

    playBell(1);
    roundStartBellPlayedRef.current = true;
    await delay(400);
    if (aborted()) return;

    setCountdown(`ROUND ${rIdx + 1}`);
    setCountdownSub(`${discipline} \u2022 ${speedLabel}`);
    await speakOrDelay(`Round ${rIdx + 1}. ${discipline}. ${speedLabel} speed.`, 1200, { voice });
    if (aborted()) return;

    setCountdown('GO');
    setCountdownSub('');
    await speakOrDelay('Go!', 600, { voice });
    if (aborted()) return;

    setCountdown(null);
    setCountdownSub('');
  }, [discipline, speedLabel, cfg.voiceOn]);

  useEffect(() => {
    rushSpoken.current = false;
    lastRushCountdownSecond.current = null;
    lastBeepSecondRef.current = null;
    roundStartBellPlayedRef.current = false;
    roundEndBellPlayedRef.current = false;
    encourageSchedule.current = scheduleEncouragements(roundSec, cfg.encouragement || 'normal');
    encourageFiredSet.current = new Set();
    setRemaining(roundSec);

    if (!integrityStartedRef.current) {
      integrityStartedRef.current = true;
      integrity.startUnit('rounds');
    }

    if (skipInitialIntro.current) {
      skipInitialIntro.current = false;
      return;
    }

    let cancelled = false;
    const start = async () => {
      unlockAudio();
      if (cfg.voiceOn !== false) await primeSpeech();
      if (!cancelled) runIntro(roundIdx);
    };
    start();
    return () => { cancelled = true; cancelSpeech(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundIdx]);

  useEffect(() => {
    if (paused || done || countdown !== null) return;
    const id = setInterval(() => setRemaining(r => Math.max(0, r - 1)), 1000);
    return () => clearInterval(id);
  }, [paused, done, countdown]);

  useEffect(() => {
    if (phase !== 'round' || paused || done || countdown !== null) return;
    if (cfg.encouragement === 'off' || cfg.voiceOn === false) return;
    if (isSpeakingCombo.current) return;
    const elapsed = roundSec - remaining;
    const schedule = encourageSchedule.current;
    for (const t of schedule) {
      if (elapsed === t && !encourageFiredSet.current.has(t)) {
        encourageFiredSet.current.add(t);
        const quote = pickEncouragement(discipline, elapsed, roundSec, encourageUsedIds.current);
        if (quote) {
          encourageUsedIds.current.add(quote.id);
          setCaptionText(quote.text);
          speakAsync(quote.text, { rate: 0.95 });
        }
        break;
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, phase, paused, done, countdown]);

  useEffect(() => {
    if (doneRef.current || remaining > 0) {
      if (phaseRef.current === 'round' && cfg.rushMode) {
        const elapsed = roundSec - remaining;
        const wantRush = isRushAt(cfg.rushPattern || 'endRound', elapsed, remaining, roundSec, roundIdxRef.current);
        if (wantRush && !rushRef.current) {
          setRush(true);
          setShowRushOverlay(true);
          // Only speak the rush cue in a gap between combos so it never clips
          // a combo call; if a combo is mid-speech we retry on the next tick.
          if (cfg.voiceOn !== false && !rushSpoken.current && !isSpeakingCombo.current) {
            rushSpoken.current = true;
            speakAsync('Rush! Go!');
          }
        } else if (!wantRush && rushRef.current) {
          setRush(false);
          setShowRushOverlay(false);
          rushSpoken.current = false;
        }
      }
      if (
        phaseRef.current === 'round' && cfg.rushMode && rushRef.current &&
        (cfg.rushPattern || 'endRound') === 'endRound' &&
        remaining >= 1 && remaining <= 10 &&
        cfg.voiceOn !== false && lastRushCountdownSecond.current !== remaining
      ) {
        lastRushCountdownSecond.current = remaining;
        speakAsync(String(remaining));
      }
      if (
        phaseRef.current === 'round' &&
        remaining >= 1 && remaining <= 3 &&
        lastBeepSecondRef.current !== remaining
      ) {
        lastBeepSecondRef.current = remaining;
        playBeep();
      }
      return;
    }
    if (phaseRef.current === 'round') {
      integrity.completeUnit();
      setRush(false);
      lastRushCountdownSecond.current = null;
      if (roundIdxRef.current + 1 >= totalRounds) {
        if (!roundEndBellPlayedRef.current) {
          roundEndBellPlayedRef.current = true;
          playBell(3);
        }
        setDone(true);
        const integrityResult = integrity.finalize();
        setTimeout(() => {
          if (cfg.voiceOn !== false) speakAsync(getCoachCopy('fightComplete'));
        }, 400);
        setTimeout(() => { stopVoiceSession(); onEnd(roundIdxRef.current + 1, totalRounds, integrityResult); }, 1500);
      } else {
        if (!roundEndBellPlayedRef.current) {
          roundEndBellPlayedRef.current = true;
          playBell(2);
        }
        setPhase('rest');
        setRemaining(restSec);
        setTimeout(() => { if (cfg.voiceOn !== false) speakAsync('Rest.'); }, 400);
      }
    } else {
      setPhase('round');
      integrity.startUnit('rounds');
      setRoundIdx(i => i + 1);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining]);

  // Combo prompt loop
  useEffect(() => {
    if (phase !== 'round' || paused || countdown !== null || done) {
      if (comboLoopRef.current) { comboLoopRef.current = null; }
      return;
    }

    let active = true;
    comboLoopRef.current = active;

    const loop = async () => {
      while (active && comboLoopRef.current && !pausedRef.current) {
        const idx = comboIndexRef.current % pool.length;
        comboIndexRef.current++;
        const next = pool[idx];
        setCurrentCombo(next);
        streakRef.current++;
        setComboStreak(streakRef.current);
        await delay(500);
        if (!active || pausedRef.current) break;
        if (cfg.voiceOn !== false && remainingRef.current > 3 && !(rushRef.current && remainingRef.current <= 10)) {
          isSpeakingCombo.current = true;
          await speakAsync(next, { rate: voiceRate });
          isSpeakingCombo.current = false;
        }
        if (!active || pausedRef.current) break;
        const rushSpeedUp = rushRef.current ? 0.7 : 1;
        const waitMs = Math.max((cadenceMs - 500) * rushSpeedUp, 1200);
        await delay(waitMs);
      }
    };

    loop();

    return () => {
      active = false;
      comboLoopRef.current = null;
      cancelSpeech();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, paused, countdown, done, cadenceMs, voiceRate, pool]);

  // Reset streak on pause
  useEffect(() => {
    if (paused) {
      streakRef.current = 0;
      setComboStreak(0);
    }
  }, [paused]);

  const handleRewind = () => {
    cancelSpeech();
    roundVersion.current++;
    setRush(false);
    lastRushCountdownSecond.current = null;
    lastBeepSecondRef.current = null;
    roundStartBellPlayedRef.current = false;
    roundEndBellPlayedRef.current = false;
    streakRef.current = 0;
    setComboStreak(0);
    setPhase('round');
    if (roundIdx > 0) {
      setRoundIdx(i => i - 1);
    } else {
      setRemaining(roundSec);
      setCountdown('3');
      runIntro(0);
    }
  };

  const handleNext = () => {
    cancelSpeech();
    roundVersion.current++;
    const actionResult = integrity.recordAction('next');
    if (actionResult.suspicious) {
      setRapidWarning(actionResult.message);
      setTimeout(() => setRapidWarning(null), 2500);
    }
    if (roundIdx + 1 < totalRounds) {
      integrity.completeUnit();
      setRush(false);
      setPhase('round');
      integrity.startUnit('rounds');
      setRoundIdx(i => i + 1);
    } else {
      const integrityResult = integrity.finalize();
      onEnd(roundIdx + 1, totalRounds, integrityResult);
    }
  };

  const handlePause = () => {
    if (!paused) {
      cancelSpeech();
      integrity.pause();
    } else {
      integrity.resume();
    }
    setPaused(p => !p);
  };

  const handleEndConfirm = () => {
    stopVoiceSession();
    roundVersion.current++;
    const completed = Math.min(phase === 'rest' ? roundIdx + 1 : roundIdx, totalRounds);
    const integrityResult = integrity.finalize();
    onEnd(completed, totalRounds, integrityResult);
  };

  const isFinalRound = roundIdx + 1 >= totalRounds;
  const maxTime = phase === 'rest' ? restSec : roundSec;
  const pct = (remaining / maxTime) * 100;
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;

  const cx = RING_SIZE / 2;
  const cy = RING_SIZE / 2;
  const circ = 2 * Math.PI * RING_R;
  const offset = circ - (pct / 100) * circ;
  const ringColor = getPhaseColor(remaining, phase, rush);
  const tip = getTipPosition(offset, circ, RING_R, cx, cy);
  const dangerPulse = phase === 'round' && remaining <= 30 && remaining > 0;
  const stripeClass = dangerPulse ? 'danger-stripes' : rush ? 'rush-stripes' : '';

  const pulseDuration = rush ? `${(cadenceMs * 0.7) / 1000}s` : `${cadenceMs / 1000}s`;

  return (
    <PhoneFrame useBrandBg extraClass={stripeClass}>
      <style dangerouslySetInnerHTML={{ __html: activeCSS }}/>

      {/* Countdown overlay */}
      {countdown !== null && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 100,
          background: 'rgba(10,0,20,0.92)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}>
          <div className="anim-fade-up" key={countdown} style={{
            fontFamily: "'Orbitron',sans-serif", fontWeight: 900,
            fontSize: /^\d$/.test(countdown) ? 180 : countdown === 'GO' ? 120 : 42,
            color: countdown === 'GO' ? '#22c55e' : C.gold,
            lineHeight: 1, textAlign: 'center', padding: '0 20px',
            textShadow: countdown === 'GO'
              ? '0 0 60px rgba(34,197,94,0.8)'
              : '0 0 60px rgba(253,224,71,0.8)',
          }}>{countdown}</div>
          {countdownSub && (
            <div style={{
              fontFamily: "'Rajdhani',sans-serif", fontSize: 22, fontWeight: 600,
              color: '#fff', letterSpacing: '0.1em', marginTop: 14, textAlign: 'center',
              opacity: 0.85,
            }}>{countdownSub}</div>
          )}
        </div>
      )}

      {dangerPulse && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 5, pointerEvents: 'none',
          background: 'radial-gradient(ellipse at center, rgba(249,115,22,0.08) 0%, transparent 70%)',
          animation: 'danger-pulse 2s ease-in-out infinite',
        }} />
      )}

      <RushPersistentEffects active={rush} remaining={remaining} />
      {showRushOverlay && <RushOverlay onDone={() => setShowRushOverlay(false)} />}

      <div style={{
        position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column',
        alignItems: 'center', minHeight: '100dvh', padding: '14px 14px calc(100px + env(safe-area-inset-bottom, 0px))',
      }}>

        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: 6 }}>
          <button onClick={() => setConfirmEnd(true)} style={{ background: 'none', border: 'none', color: '#fff', padding: 4 }}>
            <ChevronLeft size={22} />
          </button>
          <div style={{
            fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 14,
            color: VIOLET, letterSpacing: '0.12em',
            textShadow: '0 0 10px rgba(168,85,247,0.3)',
          }}>COMBO COACH</div>
          <div style={{ width: 30 }}/>
        </div>

        {/* Status chips (design 13b) */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 7, marginBottom: 12 }}>
          {[`ROUND ${roundIdx + 1}/${totalRounds}`, String(discipline).toUpperCase(), String(speedLabel).toUpperCase()].map((t, i) => (
            <span key={i} style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 8, fontWeight: 700, color: '#c9a6ff', border: '1px solid rgba(168,85,247,0.5)', borderRadius: 6, padding: '4px 9px', letterSpacing: '0.04em' }}>{t}</span>
          ))}
        </div>

        {/* Pulsing beat-orb (design 13b) — responsive so it never clips on narrow
            screens; the SVG viewBox keeps ring coordinates valid. */}
        <div style={{ position: 'relative', width: 'min(86vw, 380px)', maxWidth: '100%', aspectRatio: '1 / 1', margin: '0 auto 8px' }}>
          {/* Dimmed art background */}
          <img
            src="/static/ring-combo.webp"
            alt=""
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              objectFit: 'cover', borderRadius: '50%',
              opacity: 0.2,
              pointerEvents: 'none',
            }}
          />

          {/* Pulsing orb - synced to cadence */}
          {phase === 'round' && countdown === null && !paused && (
            <div className="combo-orb" style={{
              inset: 20,
              background: `radial-gradient(circle, ${rush ? 'rgba(249,115,22,0.15)' : 'rgba(168,85,247,0.12)'} 0%, transparent 70%)`,
              animation: `${rush ? 'combo-pulse-fast' : 'combo-pulse'} ${pulseDuration} ease-in-out infinite`,
            }}/>
          )}

          {rush && <RushTimerAura intenseFinal={remaining <= 10} />}
          {rush && <RushGlowBurst intenseFinal={remaining <= 10} />}

          <svg width="100%" height="100%" viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`} style={{ display: 'block', overflow: 'visible' }}>
            <circle cx={cx} cy={cy} r={RING_R} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={RING_STROKE} />
            <circle cx={cx} cy={cy} r={RING_R + 14} fill="none"
              stroke={ringColor} opacity="0.15" strokeWidth="1"
              strokeDasharray="3 7"
              className="anim-slow-rotate"
              style={{ transformOrigin: `${cx}px ${cy}px` }} />
            <circle cx={cx} cy={cy} r={RING_R} fill="none"
              stroke={ringColor} strokeWidth={RING_STROKE} strokeLinecap="round"
              strokeDasharray={circ} strokeDashoffset={offset}
              transform={`rotate(-90 ${cx} ${cy})`}
              style={{
                filter: rush
                  ? `drop-shadow(0 0 16px ${ringColor}) drop-shadow(0 0 32px ${ringColor})`
                  : dangerPulse
                    ? `drop-shadow(0 0 14px ${ringColor}) drop-shadow(0 0 28px ${ringColor})`
                    : `drop-shadow(0 0 8px ${ringColor})`,
                transition: 'stroke-dashoffset 0.9s linear, stroke 0.8s ease, filter 0.8s ease',
              }} />
            {pct > 0 && pct < 100 && (
              <circle cx={tip.x} cy={tip.y} r={5} fill="#fff"
                stroke={ringColor} strokeWidth="2"
                style={{ filter: `drop-shadow(0 0 10px ${ringColor})` }} />
            )}
          </svg>

          {/* Center content */}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 20px' }}>
            {phase === 'round' && countdown === null ? (
              <>
                {/* Streak / rhythm cue */}
                <div style={{
                  fontFamily: "'Press Start 2P',monospace", fontSize: 8,
                  color: rush ? '#f97316' : '#c9a6ff', letterSpacing: '0.08em', marginBottom: 8,
                }}>
                  {comboStreak > 0 ? `STREAK ×${comboStreak}` : 'STAY IN RHYTHM'}
                </div>
                {/* Current combo - LARGE (gold, design 13b) */}
                <div className="anim-fade-up" key={currentCombo} style={{
                  fontFamily: "'Orbitron',sans-serif", fontWeight: 900,
                  fontSize: currentCombo && currentCombo.length > 20 ? 22 : 28,
                  color: '#fde047', lineHeight: 1.2, textAlign: 'center',
                  textShadow: '0 0 18px rgba(253,224,71,0.4)',
                  maxWidth: 280,
                }}>
                  {currentCombo}
                </div>
                {/* Timer below combo */}
                <div style={{
                  fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 16,
                  color: '#8b83a8', marginTop: 12, letterSpacing: '0.05em',
                }}>
                  {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
                </div>
                {rush && (
                  <div style={{
                    fontFamily: "'Orbitron',sans-serif", fontSize: 9, fontWeight: 700,
                    color: '#f97316', letterSpacing: '0.2em', marginTop: 4,
                  }}>RUSH MODE</div>
                )}
              </>
            ) : phase === 'rest' ? (
              <>
                <div style={{
                  fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 48,
                  color: '#fff', lineHeight: 1,
                  textShadow: '0 0 20px #4f8cff',
                }}>
                  {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
                </div>
                <div style={{
                  fontFamily: "'Orbitron',sans-serif", fontSize: 11, fontWeight: 700,
                  color: '#4f8cff', letterSpacing: '0.2em', marginTop: 8,
                }}>REST</div>
                <div style={{
                  fontFamily: "'Rajdhani',sans-serif", fontSize: 12, fontWeight: 600,
                  color: '#4f8cff', letterSpacing: '0.1em', marginTop: 4, opacity: 0.9,
                }}>NEXT: ROUND {roundIdx + 2}</div>
              </>
            ) : (
              <div style={{
                fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 48,
                color: '#fff', lineHeight: 1,
                textShadow: `0 0 20px ${ringColor}`,
              }}>
                {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
              </div>
            )}
          </div>
        </div>

        {/* Cadence beat indicator (design 13b) */}
        {phase === 'round' && countdown === null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 8, fontWeight: 700, color: '#8b83a8', letterSpacing: '0.08em' }}>CADENCE {(cadenceMs / 1000).toFixed(1)}s</span>
            {[0, 1, 2].map(i => (
              <span key={i} className="combo-beat-dot" style={{ width: 9, height: 9, borderRadius: '50%', background: rush ? '#f97316' : '#b06aff', animationDelay: `${i * (cadenceMs / 3000)}s`, animationDuration: pulseDuration }}/>
            ))}
          </div>
        )}

        {/* Next combo preview */}
        {phase === 'round' && countdown === null && (
          <div style={{
            textAlign: 'center', marginBottom: 8, padding: '6px 14px', borderRadius: 8,
            background: 'rgba(10,0,20,0.5)', border: '1px solid rgba(168,85,247,0.12)',
            maxWidth: 300,
          }}>
            <span style={{
              fontFamily: "'Orbitron',sans-serif", fontSize: 8, fontWeight: 700,
              color: C.faint, letterSpacing: '0.12em',
            }}>NEXT: </span>
            <span style={{
              fontFamily: "'Orbitron',sans-serif", fontSize: 10, fontWeight: 700,
              color: 'rgba(168,85,247,0.7)', letterSpacing: '0.04em',
            }}>{nextCombo}</span>
          </div>
        )}

        {/* Round indicator dots */}
        <div style={{ display: 'flex', gap: totalRounds > 6 ? 4 : 6, justifyContent: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
          {Array.from({ length: totalRounds }, (_, i) => {
            const isCompleted = i < roundIdx;
            const isCurrent = i === roundIdx;
            const compact = totalRounds > 6;
            return (
              <div key={i} style={{
                width: compact ? 20 : 24, height: compact ? 20 : 24, borderRadius: compact ? 4 : 5,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: compact ? 8 : 9,
                background: isCurrent ? 'rgba(168,85,247,0.15)' : isCompleted ? 'rgba(253,224,71,0.06)' : 'rgba(255,255,255,0.03)',
                border: isCurrent ? '1.5px solid rgba(168,85,247,0.7)' : isCompleted ? '1px solid rgba(253,224,71,0.25)' : '1px solid rgba(255,255,255,0.08)',
                color: isCurrent ? VIOLET : isCompleted ? 'rgba(253,224,71,0.5)' : 'rgba(255,255,255,0.2)',
                boxShadow: isCurrent ? '0 0 8px rgba(168,85,247,0.3)' : 'none',
              }}>
                {i + 1}
              </div>
            );
          })}
        </div>

        {/* Controls (design 13b) */}
        <div style={{ width: '100%', marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <TrainingCTA
            variant={paused ? 'gold' : 'violet'}
            label={paused ? 'RESUME' : 'PAUSE'}
            icon={paused ? '▶' : '❚❚'}
            height={56}
            onClick={handlePause}
            style={{ fontSize: 16, letterSpacing: '0.12em' }}
          />
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={handleRewind} style={{
              flex: 1, height: 46, borderRadius: 12, cursor: 'pointer',
              border: '1px solid rgba(255,255,255,0.14)', background: '#130e20', color: '#c9bff0',
              fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 11, letterSpacing: '0.06em',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              <RotateCcw size={15} /> REPLAY
            </button>
            <button onClick={handleNext} style={{
              flex: 1, height: 46, borderRadius: 12, cursor: 'pointer',
              border: isFinalRound ? '1px solid rgba(34,197,94,0.5)' : '1px solid rgba(255,255,255,0.14)',
              background: isFinalRound ? 'rgba(34,197,94,0.1)' : '#130e20',
              color: isFinalRound ? '#22c55e' : '#c9bff0',
              fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 11, letterSpacing: '0.06em',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              {isFinalRound ? <>FINISH <CheckCircle size={15} /></> : <>SKIP <SkipForward size={15} /></>}
            </button>
            <button onClick={() => setConfirmEnd(true)} style={{
              flex: 1, height: 46, borderRadius: 12, cursor: 'pointer',
              border: '1px solid rgba(255,90,90,0.4)', background: 'rgba(255,90,90,0.09)', color: '#ff8a8a',
              fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 11, letterSpacing: '0.06em',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              <Square size={13} /> END
            </button>
          </div>
        </div>
      </div>

      {/* Rapid action warning */}
      {rapidWarning && (
        <div style={{
          position: 'absolute', top: 80, left: '50%', transform: 'translateX(-50%)',
          zIndex: 150, padding: '10px 18px', borderRadius: 10,
          background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)',
          backdropFilter: 'blur(6px)',
        }}>
          <div style={{
            fontFamily: "'Orbitron',sans-serif", fontSize: 9, fontWeight: 700,
            color: '#f59e0b', letterSpacing: '0.1em', textAlign: 'center',
          }}>{rapidWarning}</div>
        </div>
      )}

      {/* End confirm modal */}
      {confirmEnd && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 200,
          background: 'rgba(5,0,15,0.88)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(6px)',
        }}>
          <div style={{
            background: 'rgba(12,2,24,0.95)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 16, padding: '28px 24px', textAlign: 'center',
            maxWidth: 300, width: '85%',
            boxShadow: '0 0 40px rgba(239,68,68,0.1)',
          }}>
            <div style={{
              fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 14,
              color: '#fff', letterSpacing: '0.12em', marginBottom: 10,
            }}>END SESSION?</div>
            <div style={{
              fontFamily: "'Rajdhani',sans-serif", fontSize: 13, fontWeight: 500,
              color: C.faint, lineHeight: 1.5, marginBottom: 20,
            }}>
              Are you sure you want to end this training session?
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmEnd(false)} style={{
                flex: 1, padding: '11px 0', borderRadius: 10,
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
                color: '#fff', fontFamily: "'Orbitron',sans-serif", fontWeight: 700,
                fontSize: 10, letterSpacing: '0.1em', cursor: 'pointer',
              }}>CANCEL</button>
              <button onClick={handleEndConfirm} style={{
                flex: 1, padding: '11px 0', borderRadius: 10,
                background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.4)',
                color: '#ef4444', fontFamily: "'Orbitron',sans-serif", fontWeight: 700,
                fontSize: 10, letterSpacing: '0.1em', cursor: 'pointer',
              }}>END SESSION</button>
            </div>
          </div>
        </div>
      )}

      <CoachCaption text={captionText} />
    </PhoneFrame>
  );
}
