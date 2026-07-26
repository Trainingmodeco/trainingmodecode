// Boss ladder presentation (47c "boss node" spec):
//  · BossEyes — the boss's only art on the LADDER: a pair of glowing angular
//    eyes drawn as inline SVG, so it stays crisp at a 22px node badge.
//    (The in-session gate and slam use the real boss-eyes.webp art instead —
//    see shared/AnswerTheBell.jsx.)
//  · BossHpBar — a persisting boss HP strip during the session; every cleared
//    round chips it, so the arcade HP-bar mental model carries into the finale.

const BOSS_CSS = `
@keyframes boss-eyes-glow { 0%, 100% { filter: drop-shadow(0 0 10px rgba(239,68,68,0.65)); } 50% { filter: drop-shadow(0 0 20px rgba(239,68,68,0.95)); } }
`;

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
        {/* The glow keyframe rides with the component — it used to be injected
            by the gate/reveal that lived in this file, so pulling those out
            would have left the animation referencing nothing. */}
        <style>{BOSS_CSS}</style>
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
