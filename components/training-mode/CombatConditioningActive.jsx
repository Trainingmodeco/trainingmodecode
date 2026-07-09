import { useState, useEffect, useRef } from 'react';
import PhoneFrame from './PhoneFrame';
import CornerHUD from './CornerHUD';
import { ChevronLeft, Pause, Play, SkipForward, Square } from 'lucide-react';
import { C } from './Styles';
import useWakeLock from './hooks/useWakeLock';
import useIntegritySession from './hooks/useIntegritySession';
import { speakAsync, cancelSpeech, primeSpeech, stopVoiceSession, setVoiceGender, delay } from './voiceCoach';
import CadenceSlider, { CADENCE_PRESETS } from './shared/CadenceSlider';
import WorkoutHelpPanel, { HelpButton } from './shared/WorkoutHelpPanel';

const GOLD = C.yellow;
const COMBAT_RED = '#ef4444';

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function getEquipmentPrep(drill) {
  const name = (drill.name || '').toLowerCase();
  if (/bag|heavy bag|speed bag/i.test(name)) return 'Prepare your bag.';
  if (/dumbbell|kettlebell|barbell|weight|cable|landmine|plate|trap bar/i.test(drill.name || ''))
    return 'Grab your weight and prepare.';
  return 'Get in position.';
}

export default function CombatConditioningActive({ mission, profile, onEnd, initialPaused, onStateChange, initialResumeData }) {
  useWakeLock(true);
  const {
    missionName, style, difficulty, totalRounds, drills,
    voiceOn, formPreviewOn,
  } = mission;
  const cadenceCount = mission.cadenceCount !== false;

  const integrity = useIntegritySession('combatConditioning', totalRounds);
  const integrityStartedRef = useRef(false);
  const [rapidWarning, setRapidWarning] = useState(null);

  const [phase, setPhase] = useState(initialResumeData?.phase ?? (initialPaused ? 'working' : 'ready'));
  const [drillIdx, setDrillIdx] = useState(initialResumeData?.drillIdx ?? 0);
  const [round, setRound] = useState(initialResumeData?.round ?? 1);
  const [remaining, setRemaining] = useState(() => {
    if (initialResumeData?.remaining != null) return initialResumeData.remaining;
    if (initialPaused && drills[0]?.workType === 'timed') return drills[0].workSeconds || 30;
    return 0;
  });
  const [repCount, setRepCount] = useState(0);
  const [paused, setPaused] = useState(!!initialPaused);
  const [done, setDone] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [drillsCompleted, setDrillsCompleted] = useState(initialResumeData?.drillsCompleted ?? 0);
  const [roundsCompleted, setRoundsCompleted] = useState(initialResumeData?.roundsCompleted ?? 0);
  const [cadenceMs, setCadenceMs] = useState(mission.cadenceMs || CADENCE_PRESETS.moderate);
  const [cadencePreset, setCadencePreset] = useState(mission.cadencePreset || 'moderate');

  const phaseRef = useRef('ready');
  const drillIdxRef = useRef(0);
  const roundRef = useRef(1);
  const roundsCompletedRef = useRef(0);
  const drillsCompletedRef = useRef(0);
  const doneRef = useRef(false);
  const pausedRef = useRef(false);
  const cadenceVersionRef = useRef(0);
  const cadenceRepRef = useRef(0);
  const cadenceMsRef = useRef(cadenceMs);
  useEffect(() => { cadenceMsRef.current = cadenceMs; }, [cadenceMs]);
  const [, setCadenceActive] = useState(false);
  const versionRef = useRef(0);
  const completeDrillRef = useRef(null);

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { drillIdxRef.current = drillIdx; }, [drillIdx]);
  useEffect(() => { roundRef.current = round; }, [round]);
  useEffect(() => { roundsCompletedRef.current = roundsCompleted; }, [roundsCompleted]);
  useEffect(() => { drillsCompletedRef.current = drillsCompleted; }, [drillsCompleted]);
  useEffect(() => { doneRef.current = done; }, [done]);
  useEffect(() => { pausedRef.current = paused; }, [paused]);
  useEffect(() => { completeDrillRef.current = completeDrill; });

  useEffect(() => {
    if (typeof onStateChange === 'function') {
      onStateChange({ drillIdx, round, roundsCompleted, drillsCompleted, phase, remaining });
    }
  }, [drillIdx, round, roundsCompleted, drillsCompleted, phase, remaining, onStateChange]);

  const currentDrill = drills[drillIdx] || drills[0];
  const isTimed = currentDrill.workType === 'timed';
  const isReps = currentDrill.workType === 'reps';

  const cadenceEnabled = (d) =>
    !!d && d.workType === 'reps' && d.isCadenceSafe && !d.isManualDone && cadenceCount;

  // --- Voice helper ---
  const speak = (text) => {
    if (!voiceOn || doneRef.current) return Promise.resolve();
    return speakAsync(text);
  };

  // --- Init: voice + auto-start ---
  useEffect(() => {
    const version = ++versionRef.current;
    if (initialPaused) {
      setVoiceGender(profile?.voiceCoach || 'FEMALE');
      return;
    }
    (async () => {
      setVoiceGender(profile?.voiceCoach || 'FEMALE');
      if (voiceOn) await primeSpeech();
      if (version !== versionRef.current) return;

      await speak(`Combat Conditioning started. ${style} conditioning. Round 1.`);
      if (version !== versionRef.current) return;
      await delay(300);
      if (version !== versionRef.current) return;

      startDrill(true);
    })();

    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      versionRef.current++;
      // eslint-disable-next-line react-hooks/exhaustive-deps
      cadenceVersionRef.current++;
      cancelSpeech();
      stopVoiceSession();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Timer logic for timed drills and rest ---
  useEffect(() => {
    if (paused || done) return;
    if (phase === 'ready' || phase === 'complete') return;
    if (phase === 'working' && !isTimed) return;

    const id = setInterval(() => {
      setRemaining(r => {
        if (r <= 1) return 0;
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [paused, done, phase, isTimed, drillIdx]);

  // --- Phase transitions when timer hits 0 ---
  useEffect(() => {
    if (remaining > 0 || doneRef.current) return;
    if (phaseRef.current === 'ready' || phaseRef.current === 'complete') return;

    if (phaseRef.current === 'working') {
      const drill = drills[drillIdxRef.current];
      if (drill && drill.workType === 'timed') {
        completeDrill();
      }
    } else if (phaseRef.current === 'resting') {
      advanceToNextDrill();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining]);

  // --- Cadence: async loop functions (pause-safe) ---
  const stopCadence = () => {
    cadenceVersionRef.current++;
    setCadenceActive(false);
  };

  const startCadence = (drill) => {
    const version = ++cadenceVersionRef.current;
    setCadenceActive(true);
    setRepCount(0);
    cadenceRepRef.current = 0;
    const targetReps = drill.reps || 10;

    (async () => {
      for (let i = 1; i <= targetReps; i++) {
        if (cadenceVersionRef.current !== version) return;
        await delay(cadenceMsRef.current);
        if (cadenceVersionRef.current !== version) return;

        cadenceRepRef.current = i;
        setRepCount(i);
        if (voiceOn && !doneRef.current) await speakAsync(String(i));
        if (cadenceVersionRef.current !== version) return;
      }
      if (cadenceVersionRef.current !== version) return;
      setCadenceActive(false);
      await delay(600);
      if (cadenceVersionRef.current !== version || doneRef.current) return;
      completeDrillRef.current?.();
    })();
  };

  const resumeCadence = () => {
    const version = ++cadenceVersionRef.current;
    setCadenceActive(true);
    const startFrom = cadenceRepRef.current;
    const drill = drills[drillIdxRef.current];
    const targetReps = drill.reps || 10;

    if (startFrom >= targetReps) return;

    (async () => {
      for (let i = startFrom + 1; i <= targetReps; i++) {
        if (cadenceVersionRef.current !== version) return;
        await delay(cadenceMsRef.current);
        if (cadenceVersionRef.current !== version) return;

        cadenceRepRef.current = i;
        setRepCount(i);
        if (voiceOn && !doneRef.current) await speakAsync(String(i));
        if (cadenceVersionRef.current !== version) return;
      }
      if (cadenceVersionRef.current !== version) return;
      setCadenceActive(false);
      await delay(600);
      if (cadenceVersionRef.current !== version || doneRef.current) return;
      completeDrillRef.current?.();
    })();
  };

  const startDrill = async (isFirst) => {
    const drill = drills[drillIdxRef.current];
    setPhase('working');
    setRepCount(0);
    cadenceRepRef.current = 0;
    if (drill.workType === 'timed') {
      setRemaining(drill.workSeconds || 30);
    }

    if (isFirst && !integrityStartedRef.current) {
      integrityStartedRef.current = true;
      integrity.startUnit('circuit');
    }

    const d = isFirst ? drills[0] : drill;
    if (d.workType === 'timed') {
      speak(`${d.name}. ${d.workSeconds || 30} seconds. Ready. Begin.`);
    } else if (cadenceEnabled(d)) {
      speak(`${d.name}. ${d.reps || 10} reps. On my count. Begin.`);
      startCadence(d);
    } else {
      speak(`${d.name}. ${d.reps || '--'} reps. Move with control. Tap done when complete.`);
    }
  };

  const completeDrill = () => {
    cadenceVersionRef.current++;
    setCadenceActive(false);
    const completedSoFar = drillsCompletedRef.current + 1;
    setDrillsCompleted(completedSoFar);
    drillsCompletedRef.current = completedSoFar;
    integrity.recordAction('complete');

    const idx = drillIdxRef.current;
    const drill = drills[idx];
    const nextIdx = idx + 1;

    if (nextIdx >= drills.length) {
      integrity.completeUnit();
      const newRoundsCompleted = roundsCompletedRef.current + 1;
      setRoundsCompleted(newRoundsCompleted);
      roundsCompletedRef.current = newRoundsCompleted;

      if (roundRef.current >= totalRounds) {
        finishMission(newRoundsCompleted, completedSoFar);
        return;
      }
      integrity.startUnit('circuit');
      speak(`Round ${roundRef.current} complete. Prepare for Round ${roundRef.current + 1}.`);
      setPhase('resting');
      setRemaining(drill.restSeconds || 30);
      setDrillIdx(0);
      drillIdxRef.current = 0;
      setRound(r => r + 1);
      roundRef.current = roundRef.current + 1;
    } else {
      const nextDrill = drills[nextIdx];
      const prep = getEquipmentPrep(nextDrill);
      speak(`Rest. ${drill.restSeconds || 15} seconds. Up next: ${nextDrill.name}. ${prep}`);
      setPhase('resting');
      setRemaining(drill.restSeconds || 15);
      setDrillIdx(nextIdx);
      drillIdxRef.current = nextIdx;
    }
  };

  const advanceToNextDrill = () => {
    startDrill(false);
  };

  const handleManualDone = () => {
    if (phaseRef.current === 'working') {
      const drill = drills[drillIdxRef.current];
      if (drill && drill.workType === 'reps') {
        completeDrill();
      }
    }
  };

  const handleSkip = () => {
    stopCadence();
    cancelSpeech();
    const actionResult = integrity.recordAction('skip');
    if (actionResult.suspicious) {
      setRapidWarning(actionResult.message);
      setTimeout(() => setRapidWarning(null), 2500);
    }
    if (phaseRef.current === 'resting') {
      advanceToNextDrill();
    } else {
      const idx = drillIdxRef.current;
      const drill = drills[idx];
      const nextIdx = idx + 1;

      if (nextIdx >= drills.length) {
        const newRoundsCompleted = roundsCompletedRef.current + 1;
        setRoundsCompleted(newRoundsCompleted);
        roundsCompletedRef.current = newRoundsCompleted;
        if (roundRef.current >= totalRounds) {
          finishMission(newRoundsCompleted, drillsCompletedRef.current);
          return;
        }
        setDrillIdx(0);
        drillIdxRef.current = 0;
        setRound(r => r + 1);
        roundRef.current = roundRef.current + 1;
        setPhase('resting');
        setRemaining(drill.restSeconds || 15);
      } else {
        setDrillIdx(nextIdx);
        drillIdxRef.current = nextIdx;
        setPhase('resting');
        setRemaining(drill.restSeconds || 10);
      }
    }
  };

  const handlePauseToggle = () => {
    if (paused) {
      setPaused(false);
      integrity.resume();
      const drill = drills[drillIdxRef.current];
      if (phaseRef.current === 'working' && cadenceEnabled(drill)
        && cadenceRepRef.current > 0 && cadenceRepRef.current < (drill.reps || 10)) {
        resumeCadence();
      }
    } else {
      stopCadence();
      cancelSpeech();
      setPaused(true);
      integrity.pause();
    }
  };

  const finishMission = (finalRounds, finalDrills) => {
    cadenceVersionRef.current++;
    versionRef.current++;
    setDone(true);
    setPhase('complete');
    speak('Conditioning complete. Good work.');
    const integrityResult = integrity.finalize();
    setTimeout(() => {
      stopVoiceSession();
      onEnd({
        roundsCompleted: finalRounds,
        totalRounds,
        drillsCompleted: finalDrills,
        totalDrills: drills.length * totalRounds,
        completed: true,
        integrityResult,
      });
    }, 1800);
  };

  const handleEndConfirm = () => {
    cadenceVersionRef.current++;
    versionRef.current++;
    setDone(true);
    cancelSpeech();
    stopVoiceSession();
    const integrityResult = integrity.finalize();
    onEnd({
      roundsCompleted: roundsCompletedRef.current,
      totalRounds,
      drillsCompleted: drillsCompletedRef.current,
      totalDrills: drills.length * totalRounds,
      completed: false,
      integrityResult,
    });
  };

  // --- Ring display calc ---
  const ringSize = 394; // SVG viewBox coordinate system (kept fixed)
  const ringR = (ringSize - 20) / 2;
  const ringBox = 'min(74vw, 288px)'; // responsive rendered size so it fits + leaves room for the text/timer
  const maxTime = phase === 'resting'
    ? (currentDrill?.restSeconds || 30)
    : (currentDrill?.workSeconds || 30);
  const pct = maxTime > 0 ? remaining / maxTime : 0;
  const ringColor = phase === 'resting' ? '#4f8cff' : COMBAT_RED;

  const upNextDrill = phase === 'resting' ? drills[drillIdxRef.current] : null;

  const diffColor = difficulty === 'Advanced' ? COMBAT_RED
    : difficulty === 'Hard' ? '#f97316'
    : difficulty === 'Normal' ? GOLD
    : '#22c55e';

  return (
    <PhoneFrame usePhoto>
      {/* Darken the photo so the timer + text are the focus */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 1, background: 'radial-gradient(ellipse at 50% 42%, rgba(8,1,15,0.35), rgba(6,0,12,0.78) 78%)', pointerEvents: 'none' }}/>
      {/* Dimmed themed art background */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1, opacity: 0.08,
        backgroundImage: 'url(/assets/ring-combat.png)',
        backgroundSize: 'cover', backgroundPosition: 'center',
        filter: 'blur(2px) saturate(0.5)',
        pointerEvents: 'none',
      }}/>
      <CornerHUD color="rgba(239,68,68,0.25)" size={20} inset={10}/>

      <div style={{
        position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column',
        alignItems: 'center', minHeight: '100dvh',
        padding: '20px 16px calc(160px + env(safe-area-inset-bottom, 0px))',
        overflowX: 'hidden',
      }}>

        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: 12 }}>
          <button onClick={() => setConfirmEnd(true)} style={{ background: 'none', border: 'none', color: C.text, padding: 4 }}>
            <ChevronLeft size={24}/>
          </button>
          <div style={{
            fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 14,
            color: GOLD, letterSpacing: '0.12em',
            textShadow: '0 0 12px rgba(253,224,71,0.4), 0 0 20px rgba(239,68,68,0.15)',
          }}>COMBAT CONDITIONING</div>
          <HelpButton onClick={() => setHelpOpen(true)} size={18}/>
        </div>

        {/* Mission name */}
        <div style={{
          fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 12,
          color: C.text, letterSpacing: '0.1em', marginBottom: 4, textAlign: 'center',
        }}>{missionName}</div>

        {/* Status strip */}
        <div style={{
          display: 'flex', gap: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 16,
          padding: '7px 14px', borderRadius: 8, flexWrap: 'wrap',
          background: 'rgba(15,0,0,0.7)', border: '1px solid rgba(239,68,68,0.15)',
        }}>
          <span style={{
            fontFamily: "'Orbitron',sans-serif", fontSize: 9, fontWeight: 700,
            color: C.neon, letterSpacing: '0.08em', padding: '2px 8px', borderRadius: 4,
            background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.3)',
          }}>
            {style.toUpperCase()}
          </span>
          <span style={{
            fontFamily: "'Orbitron',sans-serif", fontSize: 9, fontWeight: 700,
            color: diffColor, letterSpacing: '0.08em', padding: '2px 8px', borderRadius: 4,
            background: `${diffColor}15`, border: `1px solid ${diffColor}44`,
          }}>
            {difficulty.toUpperCase()}
          </span>
          <span style={{
            fontFamily: "'Orbitron',sans-serif", fontSize: 11, fontWeight: 700,
            color: GOLD, letterSpacing: '0.1em',
          }}>
            ROUND {round} / {totalRounds}
          </span>
        </div>

        {/* Main display area */}
        {phase === 'ready' ? (
          <div style={{
            width: ringBox, height: ringBox, marginBottom: 18,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            borderRadius: '50%', border: `4px solid ${COMBAT_RED}44`,
            background: 'rgba(15,0,0,0.4)',
          }}>
            <div style={{
              fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 22,
              color: COMBAT_RED, letterSpacing: '0.1em',
            }}>PREPARING...</div>
          </div>
        ) : phase === 'complete' ? (
          <div style={{
            width: ringBox, height: ringBox, marginBottom: 18,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            borderRadius: '50%', border: `4px solid ${GOLD}66`,
            background: 'rgba(15,0,0,0.4)',
            boxShadow: '0 0 30px rgba(253,224,71,0.2)',
          }}>
            <div style={{
              fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 20,
              color: GOLD, letterSpacing: '0.12em',
            }}>COMPLETE</div>
          </div>
        ) : (phase === 'working' && isTimed) || phase === 'resting' ? (
          <div style={{ position: 'relative', width: ringBox, height: ringBox, marginBottom: 18 }}>
            <svg width="100%" height="100%" viewBox={`0 0 ${ringSize} ${ringSize}`} style={{ display: 'block' }}>
              <circle cx={ringSize/2} cy={ringSize/2} r={ringR} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={12}/>
              <circle cx={ringSize/2} cy={ringSize/2} r={ringR} fill="none"
                stroke={ringColor} strokeWidth={12} strokeLinecap="round"
                strokeDasharray={2 * Math.PI * ringR}
                strokeDashoffset={(1 - pct) * 2 * Math.PI * ringR}
                transform={`rotate(-90 ${ringSize/2} ${ringSize/2})`}
                style={{ transition: 'stroke-dashoffset 0.9s linear', filter: `drop-shadow(0 0 12px ${ringColor})` }}
              />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{
                fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 56,
                color: '#fff', textShadow: `0 0 20px ${ringColor}`,
              }}>{formatTime(remaining)}</div>
              <div style={{
                fontFamily: "'Orbitron',sans-serif", fontSize: 12, fontWeight: 700,
                color: ringColor, letterSpacing: '0.2em', marginTop: 8,
              }}>{phase === 'resting' ? 'REST' : 'WORK'}</div>
            </div>
          </div>
        ) : phase === 'working' && isReps && cadenceEnabled(currentDrill) ? (
          <div style={{
            width: ringBox, height: ringBox, marginBottom: 18,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            borderRadius: '50%', border: `4px solid ${COMBAT_RED}55`,
            background: 'rgba(15,0,0,0.4)',
            boxShadow: '0 0 30px rgba(239,68,68,0.15)',
          }}>
            <div style={{
              fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 64,
              color: COMBAT_RED, textShadow: '0 0 20px rgba(239,68,68,0.5)',
            }}>{repCount}</div>
            <div style={{
              fontFamily: "'Orbitron',sans-serif", fontSize: 12, fontWeight: 700,
              color: C.muted, letterSpacing: '0.15em', marginTop: 8,
            }}>REP {repCount} / {currentDrill.reps || '?'}</div>
          </div>
        ) : (
          <div style={{
            width: ringBox, height: ringBox, marginBottom: 18,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            borderRadius: '50%', border: `4px solid ${COMBAT_RED}44`,
            background: 'rgba(15,0,0,0.4)',
          }}>
            <div style={{
              fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 52,
              color: COMBAT_RED,
            }}>{currentDrill.reps || '--'}</div>
            <div style={{
              fontFamily: "'Orbitron',sans-serif", fontSize: 13, fontWeight: 700,
              color: C.muted, letterSpacing: '0.15em', marginTop: 8,
            }}>REPS</div>
          </div>
        )}

        {/* Current drill / Up Next card */}
        {phase !== 'ready' && phase !== 'complete' && (
          <div style={{
            width: '100%', maxWidth: 360, padding: '16px 18px', borderRadius: 12,
            background: 'rgba(15,0,0,0.8)', border: `1px solid ${ringColor}33`,
            textAlign: 'center', marginBottom: 10,
          }}>
            {phase === 'resting' && upNextDrill ? (
              <>
                <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 7, color: '#4f8cff', letterSpacing: '0.15em', marginBottom: 6 }}>
                  UP NEXT
                </div>
                <div style={{
                  fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 20,
                  color: '#fff', letterSpacing: '0.06em',
                }}>
                  {upNextDrill.name}
                </div>
                <div style={{
                  fontFamily: "'Rajdhani',sans-serif", fontSize: 13, fontWeight: 500,
                  color: C.muted, marginTop: 8,
                }}>
                  {upNextDrill.workType === 'timed'
                    ? `${upNextDrill.workSeconds}s`
                    : `${upNextDrill.reps} reps`}
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 7, color: C.muted, letterSpacing: '0.15em' }}>
                    DRILL {drillIdx + 1}/{drills.length}
                  </span>
                </div>
                <div style={{
                  fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 20,
                  color: GOLD, letterSpacing: '0.06em',
                  textShadow: '0 0 12px rgba(253,224,71,0.4)',
                }}>
                  {currentDrill.name}
                </div>
                {currentDrill.coachingCue && (
                  <div style={{
                    fontFamily: "'Rajdhani',sans-serif", fontSize: 12, fontWeight: 500,
                    color: C.muted, marginTop: 8, lineHeight: 1.4,
                    fontStyle: 'italic',
                  }}>
                    {currentDrill.coachingCue}
                  </div>
                )}
                {currentDrill.safetyNote && (
                  <div style={{
                    fontFamily: "'Rajdhani',sans-serif", fontSize: 11, fontWeight: 600,
                    color: COMBAT_RED, marginTop: 6,
                  }}>
                    {currentDrill.safetyNote}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Form Preview box */}
        {formPreviewOn && phase === 'working' && (
          <div style={{
            width: '100%', maxWidth: 360, padding: '10px 14px', borderRadius: 10,
            background: 'rgba(15,0,0,0.6)', border: '1px solid rgba(168,85,247,0.15)',
            textAlign: 'center', marginBottom: 12,
          }}>
            <div style={{
              fontFamily: "'Press Start 2P',monospace", fontSize: 6, color: C.neon,
              letterSpacing: '0.15em', marginBottom: 4,
            }}>FORM PREVIEW</div>
            <div style={{
              fontFamily: "'Orbitron',sans-serif", fontSize: 12, fontWeight: 700,
              color: C.text, letterSpacing: '0.06em', marginBottom: 4,
            }}>{currentDrill.name}</div>
            <div style={{
              fontFamily: "'Rajdhani',sans-serif", fontSize: 10, fontWeight: 500,
              color: C.muted, letterSpacing: '0.04em',
            }}>GIF / VIDEO COMING SOON</div>
            <div style={{
              fontFamily: "'Rajdhani',sans-serif", fontSize: 9, fontWeight: 400,
              color: 'rgba(255,255,255,0.3)', marginTop: 2,
            }}>Exercise demo will appear here.</div>
          </div>
        )}

        {/* Controls */}
        {phase !== 'complete' && (
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginTop: 4 }}>
            {phase === 'working' && isReps && !cadenceEnabled(currentDrill) && (
              <button onClick={handleManualDone} style={{
                width: 64, height: 64, borderRadius: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.4)',
                color: '#22c55e', fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 10,
                letterSpacing: '0.05em', cursor: 'pointer',
              }}>
                DONE
              </button>
            )}

            <button onClick={handlePauseToggle} style={{
              width: 70, height: 70, borderRadius: 18,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: paused ? 'rgba(253,224,71,0.12)' : 'linear-gradient(135deg, rgba(253,224,71,0.3), rgba(239,68,68,0.15))',
              border: `1.5px solid ${paused ? GOLD : 'rgba(253,224,71,0.4)'}`,
              color: '#fff', cursor: 'pointer',
              boxShadow: paused ? 'none' : '0 0 20px rgba(253,224,71,0.2)',
            }}>
              {paused ? <Play size={28}/> : <Pause size={28}/>}
            </button>

            <button onClick={handleSkip} style={{
              width: 56, height: 56, borderRadius: 14,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(20,5,40,0.8)', border: '1px solid rgba(168,85,247,0.3)',
              color: C.neon, cursor: 'pointer',
            }}>
              <SkipForward size={22}/>
            </button>

            <button onClick={() => setConfirmEnd(true)} style={{
              width: 56, height: 56, borderRadius: 14,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.35)',
              color: COMBAT_RED, cursor: 'pointer',
            }}>
              <Square size={20}/>
            </button>
          </div>
        )}

        {/* Cadence speed control — only during rep/cadence drills */}
        {phase === 'working' && cadenceEnabled(currentDrill) && (
          <div style={{ width: '100%', maxWidth: 360, marginTop: 16 }}>
            <div style={{
              fontFamily: "'Orbitron',sans-serif", fontWeight: 700, color: GOLD,
              fontSize: 9, letterSpacing: '0.2em', marginBottom: 6, textAlign: 'center',
            }}>CADENCE SPEED</div>
            <CadenceSlider
              value={cadenceMs}
              onChange={setCadenceMs}
              preset={cadencePreset}
              onPresetChange={setCadencePreset}
            />
          </div>
        )}
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

      {/* Confirm End Modal */}
      {confirmEnd && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 200,
          background: 'rgba(10,0,0,0.9)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(6px)',
        }}>
          <div style={{
            background: 'rgba(20,0,5,0.95)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 16, padding: '32px 28px', textAlign: 'center',
            maxWidth: 300, width: '85%',
          }}>
            <div style={{
              fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 16,
              color: '#fff', letterSpacing: '0.12em', marginBottom: 12,
            }}>End Session?</div>
            <div style={{
              fontFamily: "'Rajdhani',sans-serif", fontSize: 14, fontWeight: 500,
              color: C.muted, lineHeight: 1.5, marginBottom: 24,
            }}>Only completed drills will count toward your stats.</div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setConfirmEnd(false)} style={{
                flex: 1, padding: '12px 0', borderRadius: 10,
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
                color: C.text, fontFamily: "'Orbitron',sans-serif", fontWeight: 700,
                fontSize: 11, letterSpacing: '0.1em', cursor: 'pointer',
              }}>CANCEL</button>
              <button onClick={handleEndConfirm} style={{
                flex: 1, padding: '12px 0', borderRadius: 10,
                background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.5)',
                color: COMBAT_RED, fontFamily: "'Orbitron',sans-serif", fontWeight: 700,
                fontSize: 11, letterSpacing: '0.1em', cursor: 'pointer',
              }}>END SESSION</button>
            </div>
          </div>
        </div>
      )}
      <WorkoutHelpPanel contentKey="combat_conditioning_active" open={helpOpen} onClose={() => setHelpOpen(false)}/>
    </PhoneFrame>
  );
}
