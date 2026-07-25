import { useState, useEffect, useRef, useMemo } from 'react';
import PhoneFrame from './PhoneFrame';
import { Square, SkipForward, Check, RefreshCw, Dumbbell } from 'lucide-react';
import useWakeLock from './hooks/useWakeLock';
import useIntegritySession from './hooks/useIntegritySession';
import { playBell, playBeep, unlockAudio } from './data/audioEngine';
import { speakOrDelay, speakAsync, cancelSpeech, primeSpeech, stopVoiceSession, delay } from './voiceCoach';
import { packOpts } from './data/voicePacks';
import {
  countPolicy, adaptiveRest, initWeightedSetup, canGenerate, generateSession,
  toBodyweight, toWeighted, doseLabel,
} from './data/arcadeSession';

// Spec 27 — the COUNTED-SETS fit runner for prescribed Arcade sessions. Each
// movement runs its sets: rep movements auto-count (voice + on-screen counter)
// so the user follows along; holds count seconds; weighted movements are
// completion-timed (COMPLETE → adaptive rest). A WEIGHTED session opens with a
// review/Generate screen (approve · swap · make bodyweight/weighted). An
// announcer calls the opening "3,2,1 Stage…go" line. Same onEnd contract as
// CampFitRunner so completion + anti-cheat still gate.
const TEAL = '#2dd4bf';
const GREEN = '#22c55e';
const BLUE = '#4f8cff';
const GOLD = '#fde047';
const RING = 264, R = 113, STROKE = 12;

const repCadenceMs = (d) => (d === 'hard' ? 1150 : d === 'easy' ? 1900 : 1450);

export default function CampFitSetRunner({ cfg, onEnd }) {
  useWakeLock(true);
  const packId = cfg.voicePack || 'coach';
  const vOpts = packOpts(packId);
  const say = (t) => { if (cfg.voiceOn && t) speakAsync(t, vOpts); };
  const difficulty = cfg.difficulty || 'normal';

  const basePrescription = useMemo(() => (cfg.prescription || []).filter(Boolean), [cfg.prescription]);
  const finishers = useMemo(() => cfg.finishers || [], [cfg.finishers]);
  const isWeighted = useMemo(() => basePrescription.some((e) => e.weighted || e.load_type === 'weighted'), [basePrescription]);

  // Phase machine: 'review' (weighted only) → 'countdown' → 'work'|'rest' → 'done'.
  const [phase, setPhase] = useState(isWeighted ? 'review' : 'countdown');

  // ── Weighted review/generate setup ─────────────────────────────────────────
  const [setup, setSetup] = useState(() => (isWeighted ? initWeightedSetup(basePrescription) : null));
  const [session, setSession] = useState(isWeighted ? null : basePrescription);

  // ── Counted run state ──────────────────────────────────────────────────────
  const total = useMemo(() => (session ? session.length : 0), [session]);
  const [exIdx, setExIdx] = useState(0);
  const [setIdx, setSetIdx] = useState(0);      // current set within the movement
  const [reps, setReps] = useState(0);          // reps counted this set (or seconds for holds)
  const [restLeft, setRestLeft] = useState(0);
  const [countdown, setCountdown] = useState('3');
  const [paused, setPaused] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [inFinisher, setInFinisher] = useState(false);
  const [finIdx, setFinIdx] = useState(0);

  const cur = session ? session[Math.min(exIdx, total - 1)] : null;
  const integrity = useIntegritySession('combatConditioning', total || 1);
  const startedRef = useRef(false);
  const setStartRef = useRef(0);
  const doneRef = useRef(false);

  const finish = (completedCount) => {
    if (doneRef.current) return;
    doneRef.current = true;
    playBell(3);
    setPhase('done');
    const ir = integrity.finalize({});
    const rounds = (session || []).map((e) => ({ round_title: e.name, coach_prompt: doseLabel(e) }));
    setTimeout(() => { stopVoiceSession(); onEnd(rounds, cfg, completedCount ?? total, ir); }, 900);
  };

  // ── Announcer countdown → first set ────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'countdown' || !session) return;
    if (!startedRef.current) { startedRef.current = true; integrity.startUnit('circuit'); }
    let cancelled = false;
    (async () => {
      unlockAudio();
      if (cfg.voiceOn) await primeSpeech();
      for (const n of ['3', '2', '1']) { if (cancelled) return; setCountdown(n); await speakOrDelay(n, 800, { voice: cfg.voiceOn }); }
      if (cancelled) return;
      playBell(1); setCountdown('GO'); await delay(400);
      if (cancelled) return;
      setCountdown(null);
      say(cfg.announcer || `${cur?.name}. ${doseLabel(cur)}.`);
      setPhase('work'); beginSet(0, 0);
    })();
    return () => { cancelled = true; cancelSpeech(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, session]);

  const beginSet = (ei, si) => {
    const ex = session[ei];
    setReps(0); setStartRef.current = Date.now();
    const pol = countPolicy(ex, cfg.voiceOn);
    if (pol.timedCompletion) say(`${ex.name}. Set ${si + 1}. ${ex.reps} reps. Go.`);
    else if (ex.duration_sec != null) say(`${ex.name}. Hold ${ex.duration_sec} seconds.`);
    else say(`${ex.name}. Set ${si + 1}. ${ex.reps} reps.`);
  };

  // ── Auto-counter tick: rep movements count up, holds count seconds ──────────
  useEffect(() => {
    if (phase !== 'work' || paused || countdown !== null || !cur) return;
    const pol = countPolicy(cur, cfg.voiceOn);
    if (pol.timedCompletion) return; // weighted: user taps COMPLETE
    const isHold = cur.duration_sec != null;
    const target = isHold ? cur.duration_sec : cur.reps;
    const stepMs = isHold ? 1000 : repCadenceMs(difficulty);
    const id = setInterval(() => {
      setReps((n) => {
        const next = n + 1;
        if (!isHold && pol.voiceCount && next <= target) speakAsync(String(next), { ...vOpts, rate: (vOpts.rate || 1) * 1.15 });
        if (isHold && next === Math.ceil(target / 2)) say('Halfway.');
        if (next >= target) { setTimeout(() => completeSet(), 60); return target; }
        return next;
      });
    }, stepMs);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, paused, countdown, exIdx, setIdx, inFinisher]);

  const completeSet = () => {
    if (doneRef.current) return;
    playBeep();
    const ex = session[exIdx];
    const pol = countPolicy(ex, cfg.voiceOn);
    let rest = ex.rest_sec || 60;
    if (pol.timedCompletion) {
      const took = Math.round((Date.now() - setStartRef.current) / 1000);
      rest = adaptiveRest({ timeToCompleteSec: took, category: ex.category, reps: ex.reps });
    }
    const lastSet = setIdx + 1 >= (ex.sets || 1);
    const lastEx = exIdx + 1 >= total;
    if (lastSet && lastEx) {
      integrity.completeUnit();
      if (finishers.length) { startFinishers(); return; }
      finish(total); return;
    }
    setPhase('rest'); setRestLeft(rest);
    const nextName = lastSet ? session[exIdx + 1]?.name : ex.name;
    say(`Rest. ${rest} seconds.${nextName ? ` Next: ${nextName}.` : ''}`);
  };

  // ── Rest tick ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'rest' || paused) return;
    if (restLeft <= 0) {
      const ex = session[exIdx];
      const lastSet = setIdx + 1 >= (ex.sets || 1);
      if (lastSet) { const ni = exIdx + 1; if (ni < total) { integrity.completeUnit(); integrity.startUnit('circuit'); setExIdx(ni); setSetIdx(0); setPhase('work'); beginSet(ni, 0); } }
      else { const ns = setIdx + 1; setSetIdx(ns); setPhase('work'); beginSet(exIdx, ns); }
      return;
    }
    if (restLeft <= 3) playBeep();
    const id = setTimeout(() => setRestLeft((r) => r - 1), 1000);
    return () => clearTimeout(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, paused, restLeft]);

  // ── Finishers ──────────────────────────────────────────────────────────────
  const startFinishers = () => { setInFinisher(true); setFinIdx(0); setPhase('work'); setReps(0); setRestLeft(finishers[0]?.work_sec || 30); say(`Finisher. ${finishers[0]?.movement}. ${finishers[0]?.work_sec} seconds. Go!`); };
  useEffect(() => {
    if (!inFinisher || phase !== 'work' || paused || countdown !== null) return;
    if (restLeft <= 0) {
      const ni = finIdx + 1;
      if (ni < finishers.length) { setFinIdx(ni); setRestLeft(finishers[ni].work_sec); say(`${finishers[ni].movement}. ${finishers[ni].work_sec} seconds. Go!`); }
      else finish(total);
      return;
    }
    if (restLeft <= 3) playBeep();
    const id = setTimeout(() => setRestLeft((r) => r - 1), 1000);
    return () => clearTimeout(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inFinisher, phase, paused, restLeft, countdown]);

  // ── Weighted review actions ────────────────────────────────────────────────
  const generate = () => {
    const list = generateSession(setup);
    setSession(list.map((e) => ({ ...e, weighted: e.load_type === 'weighted', counted: true })));
    setPhase('countdown');
    setCountdown('3');
  };

  const handleEnd = () => { stopVoiceSession(); const done = inFinisher ? total : exIdx; const ir = integrity.finalize({}); onEnd((session || []).map((e) => ({ round_title: e.name, coach_prompt: doseLabel(e) })), cfg, done, ir); };

  // ═══════════════════════════ RENDER ═══════════════════════════
  if (phase === 'review' && setup) {
    const ready = canGenerate(setup);
    const patch = (i, updater) => setSetup((s) => ({ slots: s.slots.map((sl, idx) => (idx === i ? updater(sl) : sl)) }));
    return (
      <PhoneFrame useBrandBg>
        <div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', flexDirection: 'column', padding: '16px 16px 0', overflowY: 'auto' }}>
          <div style={{ font: "900 16px 'Orbitron',sans-serif", color: GOLD, letterSpacing: '0.06em', textAlign: 'center' }}>REVIEW YOUR WORKOUT</div>
          <div style={{ font: "600 10px 'Rajdhani',sans-serif", color: '#c9a6ff', textAlign: 'center', margin: '4px 0 14px' }}>Approve each move, swap it, or switch loading — then GENERATE.</div>
          {setup.slots.map((sl, i) => {
            const ex = sl.exercise; const ok = sl.status !== 'pending';
            return (
              <div key={i} style={{ marginBottom: 9, borderRadius: 12, border: `1px solid ${ok ? 'rgba(45,212,191,0.5)' : 'rgba(168,85,247,0.3)'}`, background: 'rgba(12,4,26,0.6)', padding: '10px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ font: "800 11px 'Orbitron',sans-serif", color: '#eafffb' }}>{ex.name}</div>
                    <div style={{ font: "600 9px 'Rajdhani',sans-serif", color: '#9fd8ce' }}>{doseLabel(ex)} · {ex.load_type === 'weighted' ? 'weighted' : 'bodyweight'}{ok ? ` · ${sl.status.toUpperCase()}` : ''}</div>
                  </div>
                  <button onClick={() => patch(i, (s) => ({ ...s, status: 'approved' }))} title="Approve" style={iconBtn(sl.status === 'approved' ? GREEN : '#6f6690')}><Check size={15} /></button>
                  <button onClick={() => patch(i, (s) => ({ ...s, exercise: s.exercise.load_type === 'weighted' ? toBodyweight(s.exercise) : toWeighted(s.exercise), status: 'converted' }))} title="Toggle load" style={iconBtn(BLUE)}><Dumbbell size={14} /></button>
                  <button onClick={() => patch(i, (s) => ({ ...s, status: 'swapped' }))} title="Swap" style={iconBtn('#c084fc')}><RefreshCw size={13} /></button>
                </div>
              </div>
            );
          })}
          <div style={{ flex: 1 }} />
          <div style={{ padding: '10px 0 calc(20px + env(safe-area-inset-bottom,0px))' }}>
            <button disabled={!ready} onClick={generate} style={{ width: '100%', height: 50, borderRadius: 13, border: 'none', cursor: ready ? 'pointer' : 'not-allowed', background: ready ? `linear-gradient(135deg,${GOLD},#f59e0b)` : 'rgba(255,255,255,0.08)', color: ready ? '#0a0014' : '#6f6690', font: "900 14px 'Orbitron',sans-serif", letterSpacing: '0.1em', boxShadow: ready ? '0 0 22px rgba(253,224,71,0.5)' : 'none', animation: ready ? 'none' : 'none' }}>⚡ GENERATE SESSION</button>
          </div>
        </div>
      </PhoneFrame>
    );
  }

  const ex = inFinisher ? null : cur;
  const isHold = ex?.duration_sec != null;
  const pol = ex ? countPolicy(ex, cfg.voiceOn) : { timedCompletion: false };
  const target = inFinisher ? (finishers[finIdx]?.work_sec || 0) : (isHold ? ex?.duration_sec : ex?.reps) || 0;
  const shown = phase === 'rest' ? restLeft : (inFinisher ? restLeft : reps);
  const ringMax = phase === 'rest' ? (restLeft || 1) : (inFinisher ? (finishers[finIdx]?.work_sec || 1) : target || 1);
  const pct = countdown !== null ? 100 : Math.max(0, Math.min(100, (phase === 'rest' || inFinisher ? shown / ringMax : reps / (target || 1)) * 100));
  const ringColor = phase === 'rest' ? BLUE : inFinisher ? GOLD : TEAL;
  const cx = RING / 2, circ = 2 * Math.PI * R, offset = circ - (pct / 100) * circ;
  const title = inFinisher ? finishers[finIdx]?.movement : ex?.name;
  const sub = inFinisher ? 'FINISHER — GO!' : phase === 'rest' ? 'REST' : pol.timedCompletion ? `SET ${setIdx + 1}/${ex?.sets} · ${target} REPS` : isHold ? `HOLD ${target}s` : `SET ${setIdx + 1}/${ex?.sets} · ${target} REPS`;

  return (
    <PhoneFrame useBrandBg>
      <div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '14px 16px 0' }}>
        <div style={{ font: "900 17px 'Orbitron',sans-serif", color: TEAL, letterSpacing: '0.08em', textShadow: `0 0 14px ${TEAL}66` }}>{inFinisher ? 'FINISHER' : 'COUNTED SETS'}</div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <span style={{ font: "800 9px 'Orbitron',sans-serif", color: '#0a1a17', background: TEAL, borderRadius: 5, padding: '3px 8px' }}>{inFinisher ? `${finIdx + 1}/${finishers.length}` : `MOVE ${Math.min(exIdx + 1, total)}/${total}`}</span>
          <span style={{ font: "800 9px 'Orbitron',sans-serif", color: '#bfe9e1', background: 'rgba(45,212,191,0.12)', border: '1px solid rgba(45,212,191,0.3)', borderRadius: 5, padding: '3px 8px' }}>{String(difficulty).toUpperCase()}</span>
        </div>

        <div style={{ position: 'relative', width: RING, height: RING, marginTop: 12, maxWidth: '100%' }}>
          <svg width="100%" height="100%" viewBox={`0 0 ${RING} ${RING}`}>
            <circle cx={cx} cy={cx} r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={STROKE} />
            <circle cx={cx} cy={cx} r={R} fill="none" stroke={ringColor} strokeWidth={STROKE} strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset} transform={`rotate(-90 ${cx} ${cx})`} style={{ transition: 'stroke-dashoffset .3s linear, stroke .3s', filter: `drop-shadow(0 0 10px ${ringColor}88)` }} />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            {countdown !== null ? (
              <div style={{ font: "900 84px 'Orbitron',sans-serif", color: TEAL, textShadow: `0 0 24px ${TEAL}88` }}>{countdown}</div>
            ) : (
              <>
                <div style={{ font: "700 10px 'Press Start 2P',monospace", color: ringColor, letterSpacing: '0.06em', marginBottom: 8, textAlign: 'center' }}>{sub}</div>
                <div style={{ font: "900 62px 'Orbitron',sans-serif", color: '#fff' }}>{shown}{isHold || phase === 'rest' || inFinisher ? 's' : ''}</div>
                <div style={{ font: "600 9px 'Rajdhani',sans-serif", color: '#9a90b8', marginTop: 2 }}>{phase === 'rest' ? 'REST' : `OF ${target}${isHold ? 's' : ' REPS'}`}</div>
              </>
            )}
          </div>
        </div>

        <div style={{ marginTop: 16, width: '100%', maxWidth: 360, background: 'rgba(45,212,191,0.06)', border: '1px solid rgba(45,212,191,0.25)', borderRadius: 12, padding: '12px 14px', textAlign: 'center' }}>
          <div style={{ font: "900 15px 'Orbitron',sans-serif", color: '#eafffb' }}>{(title || '').toUpperCase()}</div>
          {ex?.canonical && <div style={{ font: "600 10px 'Rajdhani',sans-serif", color: '#9fd8ce', marginTop: 3 }}>{ex.canonical}</div>}
        </div>

        <div style={{ marginTop: 'auto', width: '100%', maxWidth: 360, paddingBottom: 'calc(120px + env(safe-area-inset-bottom, 0px))' }}>
          {pol.timedCompletion && phase === 'work' && !inFinisher && countdown === null ? (
            <button onClick={completeSet} style={{ width: '100%', height: 46, borderRadius: 12, border: 'none', background: `linear-gradient(135deg,${GOLD},#f59e0b)`, color: '#0a0014', font: "900 14px 'Orbitron',sans-serif", letterSpacing: '0.08em', cursor: 'pointer' }}>✓ SET COMPLETE</button>
          ) : (
            <button onClick={() => setPaused((p) => { if (!p) cancelSpeech(); return !p; })} style={{ width: '100%', height: 46, borderRadius: 12, border: paused ? 'none' : `1px solid ${TEAL}55`, background: paused ? `linear-gradient(135deg,${TEAL},${GREEN})` : 'rgba(45,212,191,0.14)', color: paused ? '#04140f' : TEAL, font: "900 14px 'Orbitron',sans-serif", letterSpacing: '0.08em', cursor: 'pointer' }}>{paused ? '▶ RESUME' : '❚❚ PAUSE'}</button>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button onClick={completeSet} style={{ flex: 1, height: 38, borderRadius: 10, border: '1px solid rgba(168,85,247,0.35)', background: 'rgba(168,85,247,0.08)', color: '#c9a6ff', font: "700 10px 'Orbitron',sans-serif", cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><SkipForward size={13} /> NEXT SET</button>
            <button onClick={() => setConfirmEnd(true)} style={{ flex: 1, height: 38, borderRadius: 10, border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.08)', color: '#ff8a8a', font: "700 10px 'Orbitron',sans-serif", cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><Square size={12} /> END</button>
          </div>
        </div>
      </div>

      {confirmEnd && (
        <div onClick={() => setConfirmEnd(false)} style={{ position: 'absolute', inset: 0, zIndex: 40, background: 'rgba(4,0,10,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 280, background: 'rgba(16,7,32,0.96)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 15, padding: 18, textAlign: 'center' }}>
            <div style={{ font: "900 14px 'Orbitron',sans-serif", color: '#fff', marginBottom: 6 }}>END SESSION?</div>
            <div style={{ font: "600 10.5px 'Rajdhani',sans-serif", color: '#c4a4d8', marginBottom: 14 }}>You&apos;ll get credit for the sets you finished.</div>
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

const iconBtn = (color) => ({ width: 32, height: 32, borderRadius: 8, flexShrink: 0, border: `1px solid ${color}66`, background: `${color}18`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' });
