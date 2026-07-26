import { useState, useEffect } from 'react';

// Boss finale presentation (47c "boss node" spec + the eyes-only reveal art):
//  · BossEyes — the boss's only art: a pair of glowing angular eyes with a
//    blood-drip accent. "The boss is never fully shown" (47c) — no character
//    art anywhere, just the eyes, reused for the splash, the reveal, and the
//    ladder's boss node.
//  · BossSplash — the "answer the bell" gate before a final-boss session:
//    eyes glyph, stage counter, boss title, stat chips (length/rest, XP
//    multiplier, difficulty), FACE THE <BOSS> / NOT YET.
//  · BossHpBar — a persisting boss HP strip during the session; every cleared
//    round chips it, so the arcade HP-bar mental model carries into the finale.
//  · BossReveal — design 47a: late in the fight (round 10 / 12 on the fit
//    burnout, the final circuit on the fight gauntlet) the boss "shows
//    himself" — a short auto-dismissing slam with the round counter.

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
@keyframes boss-eyes-in { 0% { opacity: 0; transform: scale(0.7); } 100% { opacity: 1; transform: scale(1); } }
@keyframes boss-eyes-glow { 0%, 100% { filter: drop-shadow(0 0 10px rgba(239,68,68,0.65)); } 50% { filter: drop-shadow(0 0 20px rgba(239,68,68,0.95)); } }
`;

const RED = '#ef4444';

// ── BossEyes — the boss's only art (47c: "the boss is never fully shown") ──
// One eye path, mirrored for the pair. Angular, jagged, glowing red iris,
// two thin blood-drip tails. Pure SVG so it scales from a 22px node badge to
// a 90px splash glyph with no raster asset needed.
function Eye({ flip }) {
  return (
    <g transform={flip ? 'translate(210,0) scale(-1,1)' : undefined}>
      <path
        d="M6,66 L52,14 L66,46 L96,6 L104,44 L138,30 L128,54 L164,44
           L118,66 C100,80 68,88 40,86 C20,85 8,78 6,66 Z"
        fill="#1a0303" stroke="#3a0a0a" strokeWidth="2"
      />
      <ellipse cx="82" cy="56" rx="26" ry="15" fill="url(#bossIris)" />
      <path d="M68,52 L82,63 L96,52" stroke="#2a0000" strokeWidth="4.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="73" cy="49" r="3.5" fill="#fff" opacity="0.92" />
      <path d="M46,84 q-3,9 0,18 q3,4 6,0 q3,-9 0,-18 Z" fill="url(#bossDrip)" />
      <path d="M64,86 q-2,7 0,14 q2,3 4,0 q2,-7 0,-14 Z" fill="url(#bossDrip)" />
    </g>
  );
}

export function BossEyes({ size = 64, animated = true, style }) {
  return (
    <svg
      viewBox="0 0 420 100" width={size} height={size * (100 / 420)}
      style={{ animation: animated ? 'boss-eyes-glow 2.4s ease-in-out infinite' : undefined, ...style }}
    >
      <defs>
        <radialGradient id="bossIris" cx="35%" cy="35%" r="75%">
          <stop offset="0%" stopColor="#ffd8a8" />
          <stop offset="35%" stopColor="#ff5b3d" />
          <stop offset="100%" stopColor="#8a0000" />
        </radialGradient>
        <linearGradient id="bossDrip" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c81e1e" />
          <stop offset="100%" stopColor="#6b0000" />
        </linearGradient>
      </defs>
      <Eye />
      <Eye flip />
    </svg>
  );
}

const DIFF_PIPS = { easy: 3, normal: 4, hard: 5 };

function StatChip({ label, value, color }) {
  return (
    <div style={{
      flex: 1, minWidth: 0, borderRadius: 10, padding: '9px 6px',
      background: 'rgba(20,2,2,0.55)', border: `1px solid ${color}44`,
      textAlign: 'center',
    }}>
      <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 13, color, letterSpacing: '0.02em' }}>{value}</div>
      <div style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 8, color: '#c9a4a4', letterSpacing: '0.1em', marginTop: 2 }}>{label}</div>
    </div>
  );
}

function DiffPips({ count }) {
  return (
    <div style={{ display: 'flex', gap: 2, justifyContent: 'center', marginTop: 3 }}>
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} style={{ width: 10, height: 4, borderRadius: 2, background: i < count ? RED : 'rgba(255,255,255,0.15)' }} />
      ))}
    </div>
  );
}

export function BossSplash({ bossName, campaignName, rounds, stageNumber, totalStages, fit, roundSec, restSec, difficulty, onEnter, onExit }) {
  const pips = DIFF_PIPS[String(difficulty || 'normal').toLowerCase()] || 4;
  const lenLabel = roundSec ? `${Math.round(roundSec / 60)}:${String(roundSec % 60).padStart(2, '0')}` : '—';
  const restLabel = !restSec ? 'NO REST' : `${restSec}s REST`;
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      background: '#050008', overflow: 'hidden',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '24px 24px calc(24px + env(safe-area-inset-bottom, 0px))', textAlign: 'center',
    }}>
      <style dangerouslySetInnerHTML={{ __html: BOSS_CSS }}/>
      {/* Breathing red vignette — the arena holding its breath. */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        boxShadow: 'inset 0 0 90px rgba(239,68,68,0.35), inset 0 0 200px rgba(120,0,20,0.45)',
        animation: 'boss-vignette 2.6s ease-in-out infinite',
      }}/>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at center, rgba(239,68,68,0.32) 0%, transparent 55%)', animation: 'boss-flash 1s ease-out forwards', pointerEvents: 'none' }}/>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
        <div style={{ animation: 'boss-shake 0.45s ease-out', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {stageNumber ? (
            <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 9, color: 'rgba(255,190,190,0.7)', letterSpacing: '0.2em', marginBottom: 18 }}>
              STAGE {stageNumber} OF {totalStages || stageNumber}
            </div>
          ) : null}

          <div style={{ animation: 'boss-eyes-in 0.5s 0.1s ease-out both', marginBottom: 14 }}>
            <BossEyes size={130} />
          </div>

          <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 9, color: '#ff8a8a', letterSpacing: '0.24em', animation: 'boss-sub-in 0.5s 0.25s ease-out both' }}>
            BOSS STAGE{campaignName ? ` · ${campaignName.toUpperCase()}` : ''}
          </div>
          <div style={{
            fontFamily: "'Orbitron',sans-serif", fontWeight: 900,
            fontSize: 'clamp(28px, 10vw, 46px)', lineHeight: 1.08, letterSpacing: '0.05em', marginTop: 6,
            background: `linear-gradient(160deg, #fff 0%, ${RED} 45%, #7f1d1d 100%)`,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            filter: 'drop-shadow(0 0 26px rgba(239,68,68,0.7)) drop-shadow(0 4px 0 rgba(90,0,10,0.6))',
            animation: 'boss-slam 0.7s 0.15s cubic-bezier(0.22,1,0.36,1) both',
          }}>
            {(bossName || 'FINAL BOSS').toUpperCase()}
          </div>
          <div style={{
            fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 12.5,
            color: '#e2b8b8', letterSpacing: '0.02em', marginTop: 10, maxWidth: 280, lineHeight: 1.4,
            animation: 'boss-sub-in 0.5s 0.4s ease-out both',
          }}>
            {fit
              ? 'No mercy round. Full output, every rep verified.'
              : 'Full output, every skill — clear it or run it back.'}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, width: '100%', maxWidth: 320, marginTop: 22, animation: 'boss-sub-in 0.5s 0.5s ease-out both' }}>
          <StatChip label={fit ? 'PER ROUND' : 'PER ROUND'} value={lenLabel} color="#ff9a5c"/>
          <StatChip label="XP MULT" value="×2" color="#fde047"/>
          <div style={{
            flex: 1, minWidth: 0, borderRadius: 10, padding: '9px 6px',
            background: 'rgba(20,2,2,0.55)', border: `1px solid ${RED}44`, textAlign: 'center',
          }}>
            <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 10, color: RED, letterSpacing: '0.06em' }}>
              {pips >= 5 ? 'BRUTAL' : pips === 4 ? 'HARD' : 'FIRM'}
            </div>
            <DiffPips count={pips}/>
          </div>
        </div>
        {!fit && (
          <div style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 9.5, color: '#a88', letterSpacing: '0.04em', marginTop: 6 }}>
            {restLabel} between rounds
          </div>
        )}
      </div>

      <div style={{ width: '100%', maxWidth: 320, flexShrink: 0 }}>
        <button onClick={onEnter} style={{
          width: '100%', padding: '15px 0', borderRadius: 13, border: 'none', cursor: 'pointer',
          background: 'linear-gradient(135deg,#ef4444,#7f1d1d)', boxShadow: '0 0 24px rgba(239,68,68,0.5)',
          fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 12, color: '#fff', letterSpacing: '0.1em',
          animation: 'boss-pulse 1.6s ease-in-out infinite',
        }}>
          FACE {(bossName || 'THE BOSS').toUpperCase()}
        </button>
        {onExit && (
          <button onClick={onExit} style={{
            width: '100%', marginTop: 10, padding: '11px 0', borderRadius: 12,
            background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer',
            fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 10, color: '#c9a4a4', letterSpacing: '0.08em',
          }}>
            NOT YET
          </button>
        )}
      </div>
    </div>
  );
}

// The router-level gate: when a final-boss cfg reaches a session screen, the
// splash holds everything (warm-up included) until the athlete taps in.
export function BossGate({ active, bossName, campaignName, rounds, stageNumber, totalStages, fit, roundSec, restSec, difficulty, onExit, children }) {
  const [entered, setEntered] = useState(!active);
  if (!entered) {
    return (
      <BossSplash
        bossName={bossName} campaignName={campaignName} rounds={rounds}
        stageNumber={stageNumber} totalStages={totalStages} fit={fit}
        roundSec={roundSec} restSec={restSec} difficulty={difficulty}
        onEnter={() => setEntered(true)} onExit={onExit}
      />
    );
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
      <div style={{ animation: 'boss-eyes-in 0.4s 0.05s ease-out both', marginBottom: 12 }}>
        <BossEyes size={58}/>
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
