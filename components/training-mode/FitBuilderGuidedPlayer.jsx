import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import PhoneFrame from './PhoneFrame';
import TrainingHeader from './TrainingHeader';
import Embers from './Embers';
import { Play, Pause, SkipForward, Check } from 'lucide-react';
import { C } from './Styles';
import { speakAsync, cancelSpeech, delay } from './voiceCoach';
import { playBeep } from './data/audioEngine';

// Design 34 — voice-guided Workout Builder player (Quick Mission style).
// Cycles through the generated list one set at a time:
//   • Bodyweight reps  → counted out loud on a cadence (speed adjustable).
//   • Weighted reps    → a completion window ("10 reps, 2 minutes to complete")
//                        with "Get into position … Get ready. Lift." — no count.
//   • Timed holds      → same announcer intro, then a timer with 30-second
//                        call-outs and short motivational lines.
const GOLD = C.gold;
const VIOLET = '#a855f7';

const QUOTES = [
  'Stay strong. Control the breath.',
  'Lock in. You own this.',
  'Hold the line.',
  'Strong to the finish.',
];

const fmtClock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const sayWindow = (sec) => (sec % 60 === 0 ? `${sec / 60} minute${sec >= 120 ? 's' : ''}` : `${sec} seconds`);

// Classify a generated exercise into one of the three guided modes.
function classify(ex) {
  const repsStr = String(ex.reps || '');
  const hold = repsStr.match(/^(\d+)\s*s$/i);
  if (hold) return { kind: 'hold', seconds: parseInt(hold[1], 10) };
  const nums = repsStr.match(/\d+/g);
  const reps = nums ? parseInt(nums[nums.length - 1], 10) : 10; // top of "4-8"
  if (String(ex.equipment || '').toLowerCase().includes('bodyweight')) {
    return { kind: 'reps', reps };
  }
  // Weighted: time-to-complete window instead of a count (~12s per rep,
  // rounded up to 30s — 10 reps → 2 minutes, as specced).
  const windowSec = Math.max(60, Math.ceil((reps * 12) / 30) * 30);
  return { kind: 'weighted', reps, windowSec };
}

export default function FitBuilderGuidedPlayer({ exercises, exerciseIdx, onComplete, onBack, voiceOn = true }) {
  const ex = exercises[exerciseIdx];
  const plan = useMemo(() => classify(ex), [ex]);
  const totalSets = ex?.sets || 3;
  const restMax = ex?.restSeconds || parseInt(ex?.rest) || 60;
  const nextExercise = exerciseIdx < exercises.length - 1 ? exercises[exerciseIdx + 1] : null;

  const [set, setSet] = useState(1);
  const [phase, setPhase] = useState('intro'); // intro | position | active | rest
  const [display, setDisplay] = useState(0);   // rep count OR seconds remaining OR position countdown
  const [announcer, setAnnouncer] = useState('Get ready…');
  const [paused, setPaused] = useState(false);
  const [cadenceSec, setCadenceSec] = useState(2);

  const versionRef = useRef(0);
  const pausedRef = useRef(false);
  const cadenceRef = useRef(cadenceSec);
  useEffect(() => { pausedRef.current = paused; }, [paused]);
  useEffect(() => { cadenceRef.current = cadenceSec; }, [cadenceSec]);

  const say = useCallback((text, opts) => {
    setAnnouncer(text);
    if (voiceOn) speakAsync(text, opts);
  }, [voiceOn]);

  // Wait helper that respects pause and version-cancellation.
  const waitSec = useCallback(async (version, seconds, onTick) => {
    let remaining = seconds;
    while (remaining > 0) {
      if (versionRef.current !== version) return false;
      if (pausedRef.current) { await delay(120); continue; }
      onTick?.(remaining);
      await delay(1000);
      remaining -= 1;
    }
    onTick?.(0);
    return versionRef.current === version;
  }, []);

  const finishSet = useCallback(async (version) => {
    if (versionRef.current !== version) return;
    if (set < totalSets) {
      setPhase('rest');
      say(`Set complete. Rest ${sayWindow(restMax)}.`);
      const ok = await waitSec(version, restMax, (r) => setDisplay(r));
      if (!ok) return;
      setSet(s => s + 1);
      setPhase('intro');
    } else {
      say(`${ex.name} complete.`);
      await delay(900);
      if (versionRef.current !== version) return;
      onComplete();
    }
  }, [set, totalSets, restMax, ex, onComplete, say, waitSec]);

  // Stable invalidator so effect cleanups don't read the ref directly.
  const invalidate = useCallback(() => { versionRef.current += 1; }, []);

  // Per-set runner — announces the intro, then drives the mode. Keyed on the
  // set/exercise only: `phase` is pure UI state, so mid-set phase changes
  // (intro → active) must NOT restart or invalidate the running loop.
  useEffect(() => {
    const version = ++versionRef.current;

    const run = async () => {
      setPhase('intro');
      setDisplay(0);
      if (plan.kind === 'reps') {
        say(`${ex.name}. Set ${set} of ${totalSets}. ${plan.reps} reps. On my count.`);
        await delay(2600);
        if (versionRef.current !== version) return;
        setPhase('active');
        setDisplay(0);
        for (let i = 1; i <= plan.reps; i++) {
          // cadence wait (pause-aware)
          const start = Date.now();
          while (Date.now() - start < cadenceRef.current * 1000) {
            if (versionRef.current !== version) return;
            if (pausedRef.current) { await delay(120); continue; }
            await delay(60);
          }
          if (versionRef.current !== version) return;
          setDisplay(i);
          playBeep();
          if (voiceOn) speakAsync(String(i), { rate: 1.4 });
        }
        await delay(700);
        finishSet(version);
      } else if (plan.kind === 'weighted') {
        say(`${ex.name}. Set ${set} of ${totalSets}. ${plan.reps} reps. ${sayWindow(plan.windowSec)} to complete, with ${sayWindow(restMax)} rest. Get into position.`);
        setPhase('position');
        await delay(2800);
        if (versionRef.current !== version) return;
        const okPos = await waitSec(version, 5, (r) => setDisplay(r));
        if (!okPos) return;
        say('Get ready. Lift.');
        await delay(1200);
        if (versionRef.current !== version) return;
        setPhase('active');
        let announced30 = false;
        const ok = await waitSec(version, plan.windowSec, (r) => {
          setDisplay(r);
          if (r === 30 && !announced30) { announced30 = true; say('30 seconds.'); }
        });
        if (!ok) return;
        finishSet(version);
      } else { // hold
        say(`${ex.name}. Set ${set} of ${totalSets}. ${plan.seconds} seconds. Get into position.`);
        setPhase('position');
        await delay(2400);
        if (versionRef.current !== version) return;
        const okPos = await waitSec(version, 5, (r) => setDisplay(r));
        if (!okPos) return;
        say('Get ready. Go.');
        await delay(1000);
        if (versionRef.current !== version) return;
        setPhase('active');
        let quoteIdx = 0;
        const ok = await waitSec(version, plan.seconds, (r) => {
          setDisplay(r);
          const elapsed = plan.seconds - r;
          if (elapsed > 0 && elapsed % 30 === 0 && r > 5) {
            // alternate a time call-out with a motivational line
            if ((elapsed / 30) % 2 === 1) say(`${elapsed} seconds down.`);
            else say(QUOTES[quoteIdx++ % QUOTES.length]);
          }
        });
        if (!ok) return;
        finishSet(version);
      }
    };

    run();
    return () => { invalidate(); cancelSpeech(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [set, exerciseIdx]);

  const handlePauseToggle = () => {
    setPaused(p => {
      const next = !p;
      if (next) { cancelSpeech(); setAnnouncer('Paused'); }
      else setAnnouncer('Go!');
      return next;
    });
  };

  const handleDoneEarly = () => {
    // Weighted / hold sets can be finished before the window runs out —
    // goes through the normal set-complete path (including the rest).
    const version = ++versionRef.current;
    cancelSpeech();
    finishSet(version);
  };

  const handleSkipSet = () => {
    // Jump straight to the next set (also serves as SKIP REST) — no rest replay.
    invalidate();
    cancelSpeech();
    if (set < totalSets) {
      setSet(s => s + 1);
      setPhase('intro');
      setDisplay(0);
    } else {
      onComplete();
    }
  };

  const handleBack = () => {
    versionRef.current++;
    cancelSpeech();
    onBack();
  };

  const progress = exerciseIdx / exercises.length;
  const kindLabel = plan.kind === 'reps' ? `${plan.reps} REPS · ON THE COUNT`
    : plan.kind === 'weighted' ? `${plan.reps} REPS · ${fmtClock(plan.windowSec)} WINDOW`
    : `${plan.seconds}s HOLD`;

  const controls = (
    <div style={{ flexShrink: 0, display: 'flex', gap: 8, width: '100%', maxWidth: 360 }}>
      <button onClick={handlePauseToggle} aria-label={paused ? 'Resume' : 'Pause'} style={{ width: 52, height: 48, borderRadius: 11, cursor: 'pointer', background: paused ? 'rgba(253,224,71,0.14)' : 'rgba(16,4,30,0.85)', border: `1.5px solid ${paused ? GOLD : 'rgba(168,85,247,0.4)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {paused ? <Play size={18} color={GOLD}/> : <Pause size={18} color="#e6d4ff"/>}
      </button>
      {(plan.kind !== 'reps' && phase === 'active') ? (
        <button onClick={handleDoneEarly} style={{ flex: 1, height: 48, borderRadius: 11, border: 'none', cursor: 'pointer', background: `linear-gradient(135deg, ${GOLD}, #f59e0b)`, color: '#0a0014', fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 12, letterSpacing: '0.1em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, boxShadow: '0 0 16px rgba(253,224,71,0.35)' }}>
          <Check size={16} strokeWidth={3}/> SET DONE
        </button>
      ) : (
        <button onClick={handleSkipSet} style={{ flex: 1, height: 48, borderRadius: 11, cursor: 'pointer', background: 'rgba(16,4,30,0.85)', border: '1px solid rgba(168,85,247,0.35)', color: '#d9d1ef', fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 11, letterSpacing: '0.1em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
          <SkipForward size={15} color={VIOLET}/> {phase === 'rest' ? 'SKIP REST' : 'SKIP SET'}
        </button>
      )}
    </div>
  );

  return (
    <PhoneFrame useBrandBg>
      <Embers count={2}/>
      <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', height: '100dvh', boxSizing: 'border-box', overflow: 'hidden' }}>
        {/* Training Mode logo header — back arrow returns to the list */}
        <TrainingHeader
          title="GUIDED WORKOUT"
          subtitle={`Exercise ${exerciseIdx + 1} of ${exercises.length} · review & swap`}
          showBack
          onBack={handleBack}
          onHome={handleBack}
        />

        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '8px 16px calc(78px + env(safe-area-inset-bottom, 0px))' }}>
          {/* Progress */}
          <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 8, color: C.faint, letterSpacing: '0.12em' }}>EXERCISE {exerciseIdx + 1}/{exercises.length}</span>
            <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 8, color: GOLD, letterSpacing: '0.1em' }}>SET {set}/{totalSets}</span>
          </div>
          <div style={{ flexShrink: 0, width: '100%', height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.06)', marginBottom: 12 }}>
            <div style={{ width: `${progress * 100}%`, height: '100%', borderRadius: 2, background: `linear-gradient(90deg, ${GOLD}, ${VIOLET})`, transition: 'width 0.4s ease' }}/>
          </div>

          {/* Centre: display + announcer + controls (kept high, no scroll) */}
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, textAlign: 'center' }}>
            <div>
              <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 19, color: '#fff', letterSpacing: '0.04em', marginBottom: 4 }}>{ex.name}</div>
              <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 8.5, color: VIOLET, letterSpacing: '0.14em' }}>{ex.muscle} · {kindLabel}</div>
            </div>

            {phase === 'position' ? (
              <div>
                <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 10, color: '#f97316', letterSpacing: '0.18em', marginBottom: 6 }}>GET INTO POSITION</div>
                <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 54, color: '#f97316', lineHeight: 1, textShadow: '0 0 18px rgba(249,115,22,0.5)' }}>{display || 5}</div>
              </div>
            ) : phase === 'rest' ? (
              <div>
                <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 10, color: '#4f8cff', letterSpacing: '0.18em', marginBottom: 6 }}>REST</div>
                <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 54, color: '#fff', lineHeight: 1, textShadow: '0 0 14px rgba(79,140,255,0.4)' }}>{fmtClock(display)}</div>
              </div>
            ) : plan.kind === 'reps' ? (
              <div style={{ lineHeight: 1 }}>
                <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 62, color: GOLD, textShadow: '0 0 20px rgba(253,224,71,0.5)' }}>{display}</span>
                <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 24, color: 'rgba(230,215,255,0.45)' }}>/{plan.reps}</span>
              </div>
            ) : (
              <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 54, color: phase === 'active' ? GOLD : '#fff', lineHeight: 1, textShadow: '0 0 20px rgba(253,224,71,0.45)' }}>
                {fmtClock(display)}
              </div>
            )}

            {/* Announcer */}
            <div style={{ minHeight: 28, maxWidth: 320, padding: '6px 14px', borderRadius: 9, background: 'rgba(10,0,20,0.72)', border: '1px solid rgba(168,85,247,0.2)', fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 12, color: paused ? GOLD : '#e7ddf7' }}>
              {announcer}
            </div>

            {/* Controls — up in the centre block */}
            {controls}
          </div>

          {/* Cadence slider (rep-counted sets only) */}
          {plan.kind === 'reps' && (
            <div style={{ flexShrink: 0, marginTop: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 7, fontWeight: 700, color: C.faint, letterSpacing: '0.14em' }}>CADENCE</span>
                <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 8.5, fontWeight: 700, color: GOLD }}>{cadenceSec.toFixed(2)}s / rep</span>
              </div>
              <input type="range" min={1} max={4} step={0.25} value={cadenceSec} onChange={e => setCadenceSec(Number(e.target.value))}
                style={{ width: '100%', height: 5, borderRadius: 999, outline: 'none', background: `linear-gradient(90deg, ${VIOLET} 0%, ${GOLD} ${((cadenceSec - 1) / 3) * 100}%, rgba(255,255,255,0.08) ${((cadenceSec - 1) / 3) * 100}%)`, cursor: 'pointer' }}/>
            </div>
          )}

          {/* Next preview */}
          {nextExercise && (
            <div style={{ flexShrink: 0, marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, padding: '6px 11px', borderRadius: 9, background: 'rgba(10,0,20,0.6)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 7, fontWeight: 700, color: C.faint, letterSpacing: '0.12em' }}>NEXT ▶</span>
              <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 9.5, fontWeight: 700, color: C.muted, letterSpacing: '0.03em' }}>{nextExercise.name}</span>
            </div>
          )}
        </div>
      </div>
    </PhoneFrame>
  );
}
