import { useState, useEffect, useRef } from 'react';
import { speakAsync, cancelSpeech, stopVoiceSession, primeSpeech, delay } from '../voiceCoach';
import { playBeep, playBell, unlockAudio } from '../data/audioEngine';
import useWakeLock from '../hooks/useWakeLock';
import { C } from '../Styles';

// Builder warm-up (spec: 90s guided block before a fresh builder workout).
//
//   1. CHOICE GATE — announcer: "Warm up. Ninety seconds. Follow along, or
//      warm up on your own." Holds 5 seconds; if the athlete doesn't pick
//      CUSTOM, follow-along auto-starts with a 3-2-1.
//   2. FOLLOW ALONG — moves generated from the workout's muscle groups
//      (jumping jacks always lead), each with a rep target the coach COUNTS
//      out loud, rolling move to move until the 90 seconds are up.
//   3. CUSTOM — a plain 90s clock: warm up your own way.
//
// The middle-top visual is the app's standard pixel timer (same clock face as
// every other block) — no exercise art. Skippable, always: a warm-up must
// never hold the workout hostage.
const GOLD = C.gold;
const VIOLET = '#a855f7';
const TOTAL_SEC = 90;
const CHOICE_SEC = 5;
const REP_MS = 1100; // warm-up counting cadence

const LEAD = { id: 'jumping-jacks', name: 'JUMPING JACKS', reps: 10, emoji: '🤸', cue: 'Full extension, light on the feet.' };
const UPPER = [
  { id: 'arm-circles', name: 'ARM CIRCLES', reps: 20, emoji: '🙆', cue: 'Big circles — both directions.' },
  { id: 'shoulder-rolls', name: 'SHOULDER ROLLS', reps: 15, emoji: '💪', cue: 'Roll them back and down.' },
  { id: 'torso-twists', name: 'TORSO TWISTS', reps: 16, emoji: '🔄', cue: 'Rotate through the spine, feet planted.' },
];
const LOWER = [
  { id: 'high-knees', name: 'HIGH KNEES', reps: 20, emoji: '🏃', cue: 'Drive the knees to belt height.' },
  { id: 'bodyweight-squats', name: 'BODYWEIGHT SQUATS', reps: 10, emoji: '🏋️', cue: 'Sit back, chest up.' },
  { id: 'leg-swings', name: 'LEG SWINGS', reps: 12, emoji: '🦵', cue: 'Front to back — each side.' },
];
const CORE = [
  { id: 'knee-to-elbow', name: 'KNEE TO ELBOW', reps: 16, emoji: '🧎', cue: 'Opposite knee to opposite elbow.' },
];

// Jumping jacks first, then moves that match what's about to get trained.
function buildSequence(muscleGroups = []) {
  const mg = muscleGroups.map(m => String(m).toLowerCase());
  const upper = mg.some(m => ['chest', 'back', 'shoulders', 'biceps', 'triceps'].includes(m));
  const lower = mg.some(m => ['quads', 'hamstrings', 'glutes'].includes(m));
  const core = mg.includes('core');
  const seq = [LEAD];
  if (upper) seq.push(UPPER[0], UPPER[1]);
  if (lower) seq.push(LOWER[0], LOWER[1]);
  if (core) seq.push(CORE[0]);
  if (!upper && !lower && !core) seq.push(UPPER[0], LOWER[0]);
  // Backstops so the block never runs dry before the clock does.
  seq.push(UPPER[2] || UPPER[0], LOWER[2] || LOWER[0], LEAD);
  return seq;
}

const CSS = `
@keyframes bw-in { 0% { opacity: 0; transform: translateY(10px); } 100% { opacity: 1; transform: none; } }
@keyframes bw-pulse { 0%,100% { opacity: 0.65; } 50% { opacity: 1; } }
`;

export default function BuilderWarmup({ muscleGroups, onDone, onSkip }) {
  useWakeLock(true);
  const [phase, setPhase] = useState('choice');   // choice | follow | custom
  const [choiceLeft, setChoiceLeft] = useState(CHOICE_SEC);
  const [left, setLeft] = useState(TOTAL_SEC);
  const [move, setMove] = useState(LEAD);
  const [count, setCount] = useState(0);          // current rep being counted
  const [announcer, setAnnouncer] = useState('Follow along — or warm up your own way.');
  const doneRef = useRef(false);
  const phaseRef = useRef('choice');
  const seqRef = useRef(buildSequence(muscleGroups));
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  const finish = (skipped) => {
    if (doneRef.current) return;
    doneRef.current = true;
    stopVoiceSession();
    (skipped ? onSkip || onDone : onDone)?.();
  };

  // Opening line, once.
  useEffect(() => {
    unlockAudio();
    primeSpeech()
      .then(() => speakAsync('Warm up. Ninety seconds. Follow along — or warm up on your own.'))
      .catch(() => {});
    return () => stopVoiceSession();
  }, []);

  // Choice gate: 5 seconds, then follow-along starts itself.
  useEffect(() => {
    if (phase !== 'choice') return undefined;
    const id = setInterval(() => {
      setChoiceLeft(prev => {
        if (prev > 1) return prev - 1;
        clearInterval(id);
        startFollow();
        return 0;
      });
    }, 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Master 90s clock — runs in follow AND custom; zero ends the block.
  useEffect(() => {
    if (phase === 'choice') return undefined;
    const id = setInterval(() => {
      setLeft(prev => {
        if (prev > 1) {
          if (prev <= 4) playBeep();
          return prev - 1;
        }
        clearInterval(id);
        if (!doneRef.current) {
          playBell(1);
          cancelSpeech();
          speakAsync("Warm. Let's work.").catch(() => {});
          setAnnouncer("Warm. Let's work.");
          setTimeout(() => finish(false), 1100);
        }
        return 0;
      });
    }, 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Follow-along runner: announce a move, count its reps out loud, roll on.
  const runFollow = async () => {
    for (const m of seqRef.current) {
      if (doneRef.current) return;
      setMove(m);
      setCount(0);
      setAnnouncer(`${m.name} · ${m.reps} reps`);
      await speakAsync(`${m.name.toLowerCase()}. ${m.reps} reps.`).catch(() => {});
      for (let i = 1; i <= m.reps; i++) {
        if (doneRef.current) return;
        await delay(REP_MS);
        if (doneRef.current) return;
        setCount(i);
        playBeep();
        speakAsync(String(i), { rate: 1.4 }).catch(() => {});
      }
      await delay(600);
    }
  };

  const startFollow = async () => {
    if (phaseRef.current !== 'choice' || doneRef.current) return;
    setPhase('follow');
    cancelSpeech();
    for (const n of ['3', '2', '1']) {
      setAnnouncer(n);
      playBeep();
      speakAsync(n, { rate: 1.35 }).catch(() => {});
      await delay(650);
    }
    if (!doneRef.current) runFollow();
  };

  const startCustom = () => {
    if (doneRef.current) return;
    setPhase('custom');
    cancelSpeech();
    setAnnouncer('Your way. Clock is running.');
    speakAsync('Ninety seconds. Warm up your way.').catch(() => {});
  };

  const pct = phase === 'choice' ? 0 : ((TOTAL_SEC - left) / TOTAL_SEC) * 100;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 380,
      background: 'radial-gradient(120% 80% at 50% 0%, #1a0336 0%, #0a0014 60%, #05000c 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '24px 24px calc(24px + env(safe-area-inset-bottom, 0px))', textAlign: 'center',
    }}>
      <style dangerouslySetInnerHTML={{ __html: CSS }}/>

      <div style={{ position: 'relative', flex: 1, width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
        <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 9, color: VIOLET, letterSpacing: '0.26em', marginBottom: 14 }}>
          WARM UP · 90s
        </div>

        {/* Middle-top: the app's standard pixel clock (static 1:30 on the
            gate, live once the block starts) */}
        <div style={{
          fontFamily: "'Press Start 2P',monospace", fontSize: 34, marginBottom: 18,
          color: phase !== 'choice' && left <= 5 ? GOLD : '#fff',
          textShadow: '0 0 18px rgba(168,85,247,0.45)',
          animation: phase !== 'choice' && left <= 5 ? 'bw-pulse 0.8s ease-in-out infinite' : 'none',
        }}>
          {String(Math.floor(left / 60))}:{String(left % 60).padStart(2, '0')}
        </div>

        {phase === 'choice' ? (
          <div style={{ animation: 'bw-in 0.3s ease-out both', width: '100%' }}>
            <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 19, color: '#fff', letterSpacing: '0.04em' }}>
              READY TO WARM UP?
            </div>
            <div style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 12.5, color: '#c4a4d8', marginTop: 6, marginBottom: 18 }}>
              Follow the coach — or freestyle it. 90 seconds either way.
            </div>
            <button onClick={startFollow} style={{
              width: '100%', height: 52, borderRadius: 12, border: 'none', cursor: 'pointer',
              background: `linear-gradient(135deg, ${GOLD}, #f59e0b)`, color: '#0a0014',
              fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 12.5, letterSpacing: '0.08em',
              boxShadow: '0 0 18px rgba(253,224,71,0.4)',
            }}>
              ▶ FOLLOW ALONG · AUTO IN {choiceLeft}s
            </button>
            <button onClick={startCustom} style={{
              width: '100%', height: 44, borderRadius: 12, cursor: 'pointer', marginTop: 8,
              background: 'rgba(168,85,247,0.1)', border: `1.5px solid ${VIOLET}66`, color: '#c9a6ff',
              fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 10.5, letterSpacing: '0.08em',
            }}>
              CUSTOM — WARM UP MY WAY
            </button>
          </div>
        ) : phase === 'follow' ? (
          <div key={move.id} style={{ animation: 'bw-in 0.3s ease-out both' }}>
            <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 22, color: '#fff', letterSpacing: '0.04em', textShadow: '0 0 18px rgba(168,85,247,0.5)' }}>
              {move.name}
            </div>
            <div style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 12.5, color: '#c4a4d8', marginTop: 5, maxWidth: 280 }}>
              {move.cue}
            </div>
            <div style={{ marginTop: 12, lineHeight: 1 }}>
              <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 46, color: GOLD, textShadow: '0 0 18px rgba(253,224,71,0.5)' }}>{count}</span>
              <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 19, color: 'rgba(230,215,255,0.45)' }}>/{move.reps}</span>
            </div>
          </div>
        ) : (
          <div style={{ animation: 'bw-in 0.3s ease-out both' }}>
            <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 20, color: '#fff', letterSpacing: '0.04em' }}>
              YOUR WAY
            </div>
            <div style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 12.5, color: '#c4a4d8', marginTop: 6 }}>
              Move how you like — the bell calls the work.
            </div>
          </div>
        )}

        {/* Announcer */}
        <div style={{ minHeight: 24, marginTop: 12, padding: '5px 13px', borderRadius: 9, background: 'rgba(10,0,20,0.72)', border: '1px solid rgba(168,85,247,0.2)', fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 12, color: '#e7ddf7' }}>
          {announcer}
        </div>
      </div>

      <div style={{ position: 'relative', width: '100%', maxWidth: 320, flexShrink: 0 }}>
        <div style={{ height: 3, borderRadius: 2, background: 'rgba(168,85,247,0.2)', overflow: 'hidden', marginBottom: 14 }}>
          <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, ${VIOLET}, ${GOLD})`, transition: 'width 1s linear' }}/>
        </div>
        <button onClick={() => finish(true)} style={{
          width: '100%', height: 42, borderRadius: 12, cursor: 'pointer',
          background: 'transparent', border: '1px solid rgba(255,255,255,0.18)',
          fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 10.5,
          color: '#9a90b8', letterSpacing: '0.1em',
        }}>
          SKIP WARM-UP → WORKOUT
        </button>
      </div>
    </div>
  );
}
