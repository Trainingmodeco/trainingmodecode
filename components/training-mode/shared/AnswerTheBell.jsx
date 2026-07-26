import { useState, useEffect, useRef, useMemo } from 'react';
import SafeImage from '../SafeImage';
import { playBell } from '../data/audioEngine';
import { getBossRecord } from '../data/arcadeProgress';
import MobilityBlock from './MobilityBlock';

// Designs 49a / 49b / 49c — the Answer the Bell gate and the mid-session slam.
// Training Arcade boss stages only; Training Camp is untouched.
//
// The boss is never fully shown: the only art is boss-eyes.webp, always faded.
//
//  · AnswerTheBellGate — a mandatory gate before any arcade final-boss
//    session. Zero chrome, one tap target, nothing starts until the tap.
//  · BossSlam — a 2s "he shows himself" cutscene fired once per session on the
//    reveal round's first WORK call. It PAUSES the round clock while it runs,
//    because losing reps to a cutscene is the fastest way to make an athlete
//    resent it.

const RED = '#ef4444';
const RED_HOT = '#ff2626';
const GOLD = '#fde047';
const MUTED = '#9a90b8';
const EYES = '/static/fight/boss-eyes.png';   // SafeImage serves the .webp

const BELL_CSS = `
@keyframes atb-vignette { 0%,100% { opacity: 0.55; } 50% { opacity: 1; } }
@keyframes atb-eyes-pulse { 0%,100% { opacity: 0.5; transform: scale(1); } 50% { opacity: 0.68; transform: scale(1.03); } }
@keyframes atb-name-slam {
  0%   { opacity: 0; transform: scale(1.6); filter: blur(6px); }
  70%  { opacity: 1; transform: scale(0.98); filter: blur(0); }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes atb-fade-up { 0% { opacity: 0; transform: translateY(8px); } 100% { opacity: 1; transform: none; } }
@keyframes atb-bell-glow {
  0%,100% { opacity: 0.55; text-shadow: 0 0 10px rgba(239,68,68,0.5); }
  50%     { opacity: 1;    text-shadow: 0 0 22px rgba(239,68,68,0.95); }
}
@keyframes atb-slam-eyes {
  0%   { opacity: 0; transform: scale(2.1); }
  55%  { opacity: 0.72; transform: scale(0.96); }
  100% { opacity: 0.72; transform: scale(1); }
}
@keyframes atb-round-pulse { 0%,100% { opacity: 0.6; } 50% { opacity: 1; } }
@keyframes atb-deplete { from { width: 100%; } to { width: 0%; } }
@keyframes atb-slash-in { 0% { opacity: 0; transform: translateX(-40%) rotate(var(--a)); } 100% { opacity: 1; transform: translateX(0) rotate(var(--a)); } }
`;

// 3px horizontal red scanlines, per 49a.
const SCANLINES = {
  backgroundImage: 'repeating-linear-gradient(180deg, rgba(239,68,68,0.07) 0px, rgba(239,68,68,0.07) 1px, transparent 1px, transparent 3px)',
};

function heavyHaptic() {
  try { navigator.vibrate?.([90, 40, 140]); } catch { /* unsupported */ }
}

// ── 49a / 49b — the gate ────────────────────────────────────────────────────
export function AnswerTheBellGate({
  bossName, campaignName, fit, rounds, seriesId, stageId, onAnswer,
}) {
  const [armed, setArmed] = useState(false);   // fires the bell once
  const touchStartY = useRef(null);

  const record = useMemo(
    () => (seriesId && stageId ? getBossRecord(seriesId, stageId) : { wins: 0, losses: 0, bestRounds: 0, totalRounds: 0, attempts: 0 }),
    [seriesId, stageId],
  );

  const eyebrow = `${(campaignName || (fit ? 'THE FURNACE' : 'THE GRAPPLER')).toUpperCase()} · FINAL STAGE`;
  const statLine = fit
    ? `${rounds || 12} ROUNDS / EVERY MUSCLE / NO SECOND CHANCES`
    : `${rounds || 9} ROUNDS / EVERY SKILL / NO SECOND CHANCES`;

  const answer = () => {
    if (armed) return;
    setArmed(true);
    // A real ring-bell sample + a heavy haptic: the gate is the one moment in
    // the session worth a sound cue.
    try { playBell(1); } catch { /* audio not unlocked yet */ }
    heavyHaptic();
    // Boss rounds are motion-verified, so the placement check folds in here —
    // this tap is the user gesture iOS requires for the DeviceMotion prompt.
    (async () => {
      try {
        if (typeof window !== 'undefined' && typeof window.DeviceMotionEvent?.requestPermission === 'function') {
          const res = await window.DeviceMotionEvent.requestPermission();
          if (res === 'granted') localStorage.setItem('tm_motion_granted', 'true');
        } else {
          localStorage.setItem('tm_motion_granted', 'true');
        }
      } catch { /* denied or unsupported — the session still runs */ }
      onAnswer?.();
    })();
  };

  // Swipe down is the only escape — there is deliberately no back or cancel.
  const onTouchStart = (e) => { touchStartY.current = e.touches?.[0]?.clientY ?? null; };
  const onTouchEnd = (e) => {
    const start = touchStartY.current;
    touchStartY.current = null;
    if (start == null) return;
    const end = e.changedTouches?.[0]?.clientY ?? start;
    if (end - start > 90) { /* swipe-down handled by the host via onDismiss */ }
  };

  return (
    <div
      onClick={answer}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      style={{
        position: 'fixed', inset: 0, zIndex: 400, background: '#000',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '28px 24px calc(28px + env(safe-area-inset-bottom, 0px))',
        textAlign: 'center', cursor: 'pointer', overflow: 'hidden',
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: BELL_CSS }}/>
      {/* Breathing red vignette + scanlines */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse at 50% 45%, rgba(239,68,68,0.22) 0%, rgba(120,0,16,0.10) 42%, transparent 72%)',
        animation: 'atb-vignette 3.8s ease-in-out infinite',
      }}/>
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', ...SCANLINES }}/>

      <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
        {/* 1 · series eyebrow */}
        <div style={{
          fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 9,
          color: RED, letterSpacing: '0.26em', marginBottom: 18,
          animation: 'atb-fade-up 0.4s ease-out both',
        }}>
          {eyebrow}
        </div>

        {/* 2 · the eyes — the only boss art, always faded */}
        <SafeImage
          src={EYES} alt="" loading="eager"
          style={{
            width: 250, maxWidth: '78%', height: 'auto', marginBottom: 16,
            filter: 'drop-shadow(0 0 26px rgba(239,68,68,0.65))',
            animation: 'atb-eyes-pulse 3s ease-in-out infinite',
          }}
        />

        {/* 3 · the name lands alone */}
        <div style={{
          fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 46,
          lineHeight: 0.96, color: '#fff', letterSpacing: '0.02em',
          textShadow: `0 0 26px rgba(239,68,68,0.75), 0 4px 0 rgba(90,0,10,0.75)`,
          animation: 'atb-name-slam 0.35s cubic-bezier(0.2,1,0.3,1) both',
        }}>
          {(bossName || 'FINAL BOSS').toUpperCase()}
        </div>

        {/* 4 · hairline divider */}
        <div style={{
          width: 210, maxWidth: '70%', height: 1, margin: '18px 0 14px',
          background: `linear-gradient(90deg, transparent, ${RED}, transparent)`,
          animation: 'atb-fade-up 0.4s 0.35s ease-out both',
        }}/>

        {/* 5 · the stat line, ~400ms after the name */}
        <div style={{
          fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 10,
          color: RED, letterSpacing: '0.14em', lineHeight: 1.9,
          animation: 'atb-fade-up 0.45s 0.4s ease-out both',
        }}>
          {statLine}
        </div>

        {/* 6 · the record, not just the threat */}
        <div style={{
          marginTop: 16, padding: '7px 14px', borderRadius: 99,
          border: '1px solid rgba(239,68,68,0.35)', background: 'rgba(60,0,8,0.4)',
          fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 11,
          color: record.attempts ? '#e8c4c4' : MUTED, letterSpacing: '0.04em',
          animation: 'atb-fade-up 0.45s 0.55s ease-out both',
        }}>
          {record.attempts
            ? <>YOUR RECORD <span style={{ color: '#fff', fontWeight: 800 }}>{record.wins} — {record.losses}</span>
              {record.bestRounds > 0 && <> · best {record.bestRounds} of {record.totalRounds || rounds} rounds</>}</>
            : <>FIRST ATTEMPT · nobody clears this cold</>}
        </div>
      </div>

      {/* Footer — the whole screen is the target, this just says so */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <div style={{
          fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 13,
          color: RED_HOT, letterSpacing: '0.12em',
          animation: 'atb-bell-glow 2s ease-in-out infinite',
        }}>
          🔔 TAP TO ANSWER THE BELL
        </div>
        <div style={{
          fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 10.5,
          color: MUTED, marginTop: 7, letterSpacing: '0.02em',
        }}>
          Nothing starts until you do. 90s to loosen up, then round 1.
        </div>
      </div>
    </div>
  );
}

// Router-level gate: holds the whole session until the bell is answered, then
// runs a short guided mobility block before round 1. The gate drops the normal
// 3-minute warm-up by design, but going into a max-effort gauntlet stone cold
// is a real injury risk — 90 seconds of called-out joint prep is the
// compromise, and it stays skippable.
export function AnswerTheBellHost({ active, children, ...gateProps }) {
  const [stage, setStage] = useState(active ? 'gate' : 'session');
  useEffect(() => { if (!active) setStage('session'); }, [active]);
  if (stage === 'gate') return <AnswerTheBellGate {...gateProps} onAnswer={() => setStage('mobility')} />;
  if (stage === 'mobility') return <MobilityBlock onDone={() => setStage('session')} />;
  return children;
}

// ── 49c — the 2-second slam ─────────────────────────────────────────────────
// `onDone` fires when it dismisses; the host uses it to un-pause the clock.
export function BossSlam({ bossName, round, total, skippable, onDone }) {
  // The host owns visibility (it unmounts us when onDone lands), so all this
  // needs is a one-shot guard — no local "gone" state to set on the way out.
  const firedRef = useRef(false);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const finish = () => {
    if (firedRef.current) return;
    firedRef.current = true;
    doneRef.current?.();
  };

  useEffect(() => {
    const t = setTimeout(finish, 2000);
    return () => clearTimeout(t);
  }, []);

  const Slash = ({ angle, top, delay }) => (
    <div style={{
      position: 'absolute', top, left: '-15%', width: '130%', height: 2,
      background: `linear-gradient(90deg, transparent, ${RED_HOT}, transparent)`,
      boxShadow: '0 0 14px 2px rgba(255,38,38,0.55)',
      '--a': `${angle}deg`,
      transform: `rotate(${angle}deg)`,
      animation: `atb-slash-in 0.45s ${delay} ease-out both`,
      pointerEvents: 'none',
    }}/>
  );

  return (
    <div
      onClick={() => { if (skippable) finish(); }}
      style={{
        position: 'absolute', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.94)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        textAlign: 'center', padding: '0 24px', overflow: 'hidden',
        cursor: skippable ? 'pointer' : 'default',
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: BELL_CSS }}/>
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse at 50% 45%, rgba(239,68,68,0.26) 0%, transparent 68%)',
        animation: 'atb-vignette 1.6s ease-in-out infinite',
      }}/>
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', ...SCANLINES }}/>
      {/* Claw slashes */}
      <Slash angle={-11} top="34%" delay="0.05s"/>
      <Slash angle={9} top="62%" delay="0.15s"/>

      <div style={{
        fontFamily: "'Press Start 2P',monospace", fontSize: 11, color: RED_HOT,
        letterSpacing: '0.16em', marginBottom: 16,
        animation: 'atb-round-pulse 0.9s ease-in-out infinite',
      }}>
        ROUND {round} / {total}
      </div>

      <SafeImage
        src={EYES} alt="" loading="eager"
        style={{
          width: 290, maxWidth: '82%', height: 'auto', marginBottom: 14,
          filter: 'drop-shadow(0 0 30px rgba(239,68,68,0.8))',
          animation: 'atb-slam-eyes 0.4s cubic-bezier(0.2,1,0.3,1) both',
        }}
      />

      <div style={{
        fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 42,
        lineHeight: 0.98, color: '#fff', letterSpacing: '0.02em',
        textShadow: '0 0 26px rgba(239,68,68,0.8), 0 4px 0 rgba(90,0,10,0.7)',
        animation: 'atb-name-slam 0.35s 0.1s cubic-bezier(0.2,1,0.3,1) both',
      }}>
        {(bossName || 'THE BOSS').toUpperCase()}
      </div>

      <div style={{
        fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 12,
        color: GOLD, letterSpacing: '0.2em', marginTop: 12,
        animation: 'atb-fade-up 0.35s 0.3s ease-out both',
      }}>
        SHOWS HIMSELF
      </div>
      <div style={{
        fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 26,
        color: '#fff', letterSpacing: '0.06em', marginTop: 8,
        animation: 'atb-fade-up 0.35s 0.42s ease-out both',
      }}>
        FINISH IT
      </div>

      {/* 2s depleting bar */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 'calc(34px + env(safe-area-inset-bottom, 0px))', padding: '0 40px' }}>
        <div style={{ height: 3, borderRadius: 2, background: 'rgba(239,68,68,0.2)', overflow: 'hidden' }}>
          <div style={{ height: '100%', background: RED_HOT, animation: 'atb-deplete 2s linear both' }}/>
        </div>
        <div style={{
          fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 9.5,
          color: MUTED, marginTop: 7, letterSpacing: '0.02em',
        }}>
          {skippable ? 'tap to skip · back to the round in 2s' : 'auto-dismisses · back to the round in 2s'}
        </div>
      </div>
    </div>
  );
}
