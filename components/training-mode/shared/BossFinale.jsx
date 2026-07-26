// Boss HP bar — the persisting strip across a final-boss session. Every
// cleared round chips it, so the arcade's stage-HP mental model carries into
// the finale.
//
// (The eyes art lives in /static/fight/boss-eyes.webp and is rendered by the
// ladder's boss node and by shared/AnswerTheBell.jsx. An inline-SVG stand-in
// used to live here for the node badge; the real art replaced it.)
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
