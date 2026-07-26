import { useState, useEffect } from 'react';
import { C } from '../Styles';

// Boss finale presentation (splash concepts 1 + 2, plus the 47a reveal):
//  · BossSplash — the "answer the bell" gate before a final-boss session:
//    black screen, the boss title slams in, a stat line, and the athlete TAPS
//    to commit. Nothing auto-starts a boss fight.
//  · BossHpBar — a persisting boss HP strip during the session; every cleared
//    round chips it, so the arcade HP-bar mental model carries into the finale.
//  · BossReveal — design 47a: late in the fight (round 10 / 12 on the fit
//    burnout, the final circuit on the fight gauntlet) the boss "shows
//    himself" — a short auto-dismissing slam with the round counter.
// All typography + existing brand energy; no drawn rings, no new art.

const BOSS_CSS = `
@keyframes boss-slam {
  0%   { transform: scale(2.4) translateY(12px); opacity: 0; filter: blur(10px); }
  45%  { transform: scale(1.04) translateY(0); opacity: 1; filter: blur(0); }
  60%  { transform: scale(1); }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes boss-sub-in { 0% { opacity: 0; transform: translateY(10px); } 100% { opacity: 1; transform: none; } }
@keyframes boss-pulse { 0%, 100% { opacity: 0.65; } 50% { opacity: 1; } }
@keyframes boss-vignette { 0%, 100% { opacity: 0.55; } 50% { opacity: 0.85; } }
@keyframes boss-flash { 0% { opacity: 0.65; } 100% { opacity: 0; } }
@keyframes boss-shake {
  0%,100% { transform: translate(0,0); }
  20% { transform: translate(-2px,1px); } 40% { transform: translate(2px,-1px); }
  60% { transform: translate(-1px,2px); } 80% { transform: translate(1px,-1px); }
}
`;

const RED = '#ef4444';

export function BossSplash({ bossName, campaignName, rounds, fit, onEnter }) {
  const statLine = fit
    ? `${rounds} ROUNDS · FULL BODY · TO THE BELL`
    : `${rounds} ROUNDS · EVERY SKILL · NO SECOND CHANCES`;
  return (
    <div
      onClick={onEnter}
      style={{
        position: 'fixed', inset: 0, zIndex: 300, cursor: 'pointer',
        background: '#050008', overflow: 'hidden',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '0 24px', textAlign: 'center',
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: BOSS_CSS }}/>
      {/* Breathing red vignette — the arena holding its breath. */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        boxShadow: 'inset 0 0 90px rgba(239,68,68,0.35), inset 0 0 200px rgba(120,0,20,0.45)',
        animation: 'boss-vignette 2.6s ease-in-out infinite',
      }}/>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at center, rgba(239,68,68,0.32) 0%, transparent 55%)', animation: 'boss-flash 1s ease-out forwards', pointerEvents: 'none' }}/>

      <div style={{ animation: 'boss-shake 0.45s ease-out' }}>
        {campaignName ? (
          <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 9, color: 'rgba(255,190,190,0.75)', letterSpacing: '0.2em', marginBottom: 16, animation: 'boss-sub-in 0.5s 0.35s ease-out both' }}>
            {campaignName.toUpperCase()} · FINAL STAGE
          </div>
        ) : null}
        <div style={{
          fontFamily: "'Orbitron',sans-serif", fontWeight: 900,
          fontSize: 'clamp(30px, 11vw, 52px)', lineHeight: 1.08, letterSpacing: '0.06em',
          background: `linear-gradient(160deg, #fff 0%, ${RED} 45%, #7f1d1d 100%)`,
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          filter: 'drop-shadow(0 0 26px rgba(239,68,68,0.7)) drop-shadow(0 4px 0 rgba(90,0,10,0.6))',
          animation: 'boss-slam 0.7s cubic-bezier(0.22,1,0.36,1) both',
        }}>
          {(bossName || 'FINAL BOSS').toUpperCase()}
        </div>
        <div style={{
          fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 11,
          color: '#ffd6ad', letterSpacing: '0.18em', marginTop: 18,
          animation: 'boss-sub-in 0.5s 0.55s ease-out both',
        }}>
          {statLine}
        </div>
      </div>

      <div style={{
        position: 'absolute', bottom: 'calc(64px + env(safe-area-inset-bottom, 0px))', left: 0, right: 0,
        fontFamily: "'Press Start 2P',monospace", fontSize: 10, color: C.yellow,
        letterSpacing: '0.14em', textShadow: '0 0 14px rgba(253,224,71,0.5)',
        animation: 'boss-pulse 1.5s ease-in-out infinite',
      }}>
        TAP TO ANSWER THE BELL
      </div>
    </div>
  );
}

// The router-level gate: when a final-boss cfg reaches a session screen, the
// splash holds everything (warm-up included) until the athlete taps in.
export function BossGate({ active, bossName, campaignName, rounds, fit, children }) {
  const [entered, setEntered] = useState(!active);
  if (!entered) {
    return <BossSplash bossName={bossName} campaignName={campaignName} rounds={rounds} fit={fit} onEnter={() => setEntered(true)}/>;
  }
  return children;
}

// Chips one segment per cleared round. `cleared` = rounds fully completed.
export function BossHpBar({ bossName, total, cleared }) {
  const hp = Math.max(0, 1 - cleared / Math.max(1, total));
  return (
    <div style={{ width: '100%', maxWidth: 360, margin: '6px auto 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 7, color: '#ff8a8a', letterSpacing: '0.12em' }}>
          ☠ {(bossName || 'FINAL BOSS').toUpperCase()}
        </span>
        <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 8, color: '#ffb4b4', letterSpacing: '0.08em' }}>
          {Math.round(hp * 100)}%
        </span>
      </div>
      <div style={{ height: 8, borderRadius: 4, overflow: 'hidden', background: 'rgba(80,0,10,0.55)', border: '1px solid rgba(239,68,68,0.45)' }}>
        <div style={{
          height: '100%', width: `${hp * 100}%`,
          background: 'linear-gradient(90deg, #7f1d1d, #ef4444 55%, #ff8a5c)',
          boxShadow: '0 0 10px rgba(239,68,68,0.7)',
          transition: 'width 0.8s ease',
        }}/>
      </div>
    </div>
  );
}

// 47a — the late-fight boss reveal, with the round counter front and center.
export function BossReveal({ bossName, round, total, onDone }) {
  const [show, setShow] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => { setShow(false); onDone?.(); }, 2400);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!show) return null;
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 160, pointerEvents: 'none',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(5,0,8,0.88)', textAlign: 'center', padding: '0 24px',
    }}>
      <style dangerouslySetInnerHTML={{ __html: BOSS_CSS }}/>
      <div style={{ position: 'absolute', inset: 0, boxShadow: 'inset 0 0 80px rgba(239,68,68,0.4)', animation: 'boss-vignette 1.6s ease-in-out infinite' }}/>
      <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 12, color: '#ffb4b4', letterSpacing: '0.16em', marginBottom: 14, animation: 'boss-sub-in 0.4s ease-out both' }}>
        ROUND {round} / {total}
      </div>
      <div style={{
        fontFamily: "'Orbitron',sans-serif", fontWeight: 900,
        fontSize: 'clamp(26px, 9vw, 42px)', letterSpacing: '0.06em', lineHeight: 1.1,
        background: `linear-gradient(160deg, #fff 0%, ${RED} 50%, #7f1d1d 100%)`,
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        filter: 'drop-shadow(0 0 24px rgba(239,68,68,0.75))',
        animation: 'boss-slam 0.6s cubic-bezier(0.22,1,0.36,1) both',
      }}>
        {(bossName || 'THE BOSS').toUpperCase()}
      </div>
      <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 11, color: '#ffd6ad', letterSpacing: '0.16em', marginTop: 14, animation: 'boss-sub-in 0.5s 0.4s ease-out both' }}>
        SHOWS HIMSELF — FINISH IT
      </div>
    </div>
  );
}
