import { challengeLabel } from '../data/challengeCodes';

const GOLD = '#fde047';

// Shown when the app is opened from a challenge link/code. Confirms the stage a
// friend challenged you to, then jumps straight into it (or dismisses).
export default function ChallengeInboundModal({ resolved, onStart, onDismiss }) {
  if (!resolved) return null;
  const label = challengeLabel(resolved);
  const who = resolved.from ? `${resolved.from} challenged you` : 'You were challenged';

  return (
    <div onClick={onDismiss} style={{ position: 'fixed', inset: 0, zIndex: 700, background: 'rgba(4,0,10,0.82)', backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '92%', maxWidth: 330, background: 'rgba(16,7,32,0.97)', border: `1px solid ${GOLD}66`, borderRadius: 18, padding: '20px 18px', boxShadow: '0 22px 60px rgba(0,0,0,0.75)', textAlign: 'center' }}>
        <div style={{ fontSize: 30, marginBottom: 6 }}>⚔️</div>
        <div style={{ font: "700 8px 'Orbitron',sans-serif", color: '#c4a4d8', letterSpacing: '0.16em', marginBottom: 4 }}>{who.toUpperCase()}</div>
        <div style={{ font: "900 17px 'Orbitron',sans-serif", color: '#fff', marginBottom: 4 }}>{resolved.series.title}</div>
        <div style={{ font: "700 10px 'Rajdhani',sans-serif", color: GOLD, letterSpacing: '0.03em', marginBottom: 18 }}>{label}</div>
        <button onClick={onStart} style={{ width: '100%', height: 46, borderRadius: 12, border: 'none', background: `linear-gradient(135deg,${GOLD},#f59e0b)`, color: '#0a0014', font: "900 13px 'Orbitron',sans-serif", letterSpacing: '0.08em', cursor: 'pointer', boxShadow: '0 0 20px rgba(253,224,71,0.4)' }}>▶ ACCEPT & START</button>
        <button onClick={onDismiss} style={{ width: '100%', height: 38, marginTop: 8, borderRadius: 10, border: '1px solid rgba(168,85,247,0.35)', background: 'transparent', color: '#c9a6ff', font: "800 10px 'Orbitron',sans-serif", letterSpacing: '0.06em', cursor: 'pointer' }}>MAYBE LATER</button>
      </div>
    </div>
  );
}
