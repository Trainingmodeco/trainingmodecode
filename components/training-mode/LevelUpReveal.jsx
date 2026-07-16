import PhoneFrame from './PhoneFrame';
import SafeImage from './SafeImage';
import Embers from './Embers';
import { VISIBLE_TIERS, tierImage } from './data/tiers';

// Level Up reveal — pixel match of design 6a: rank-up tag, big level pop, rank
// transition, "new avatar unlocked" card (shine sweep + corner brackets), stat
// boosts, and Equip / Continue CTAs. Prop-driven so the post-session flow can
// mount it when a workout pushes the player past a level boundary.
const RANKS = VISIBLE_TIERS.map(t => t.label);
const ROMAN = ['I', 'II', 'III', 'IV', 'V'];

const css = `
@keyframes lur-tag { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@keyframes lur-pop { 0% { opacity: 0; transform: scale(0.4); } 60% { opacity: 1; transform: scale(1.12); } 100% { opacity: 1; transform: scale(1); } }
@keyframes lur-rise { from { opacity: 0; transform: translateY(24px) scale(0.94); } to { opacity: 1; transform: none; } }
@keyframes lur-shine { from { transform: translateX(-120%) skewX(-20deg); } to { transform: translateX(320%) skewX(-20deg); } }
.lur-a { opacity: 0; animation-fill-mode: forwards; }
`;

export default function LevelUpReveal({ fromLevel = 3, toLevel = 4, sex = 'male', statBoosts, onEquip, onContinue }) {
  const s = String(sex).toLowerCase() === 'female' ? 'female' : 'male';
  const fromIdx = Math.min(Math.max(Math.floor((fromLevel - 1) / 3), 0), 4);
  const toIdx = Math.min(Math.max(Math.floor((toLevel - 1) / 3), 0), 4);
  const boosts = statBoosts || [
    { label: '+2 STR', color: '#22c55e' },
    { label: '+1 SPD', color: '#22c55e' },
    { label: '+150 MAX XP', color: '#b06aff' },
  ];

  return (
    <PhoneFrame usePhoto>
      <style dangerouslySetInnerHTML={{ __html: css }}/>
      <Embers count={5}/>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 40%, rgba(168,85,247,0.25), rgba(8,1,15,0.82) 72%)', zIndex: 1 }}/>

      <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
        {/* Reveal body */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 26px', textAlign: 'center' }}>
          <div className="lur-a" style={{ font: "700 8px 'Press Start 2P',monospace", color: '#facc15', letterSpacing: '0.18em', marginBottom: 14, animation: 'lur-tag .5s ease 0.1s forwards' }}>◈ RANK UP ◈</div>
          <div className="lur-a" style={{ font: "900 12px 'Orbitron',sans-serif", color: '#c4a4d8', letterSpacing: '0.2em', marginBottom: 2, animation: 'lur-tag .5s ease 0.3s forwards' }}>LEVEL {fromLevel} → {toLevel}</div>
          <div className="lur-a" style={{ font: "900 58px 'Orbitron',sans-serif", color: '#fde047', letterSpacing: '0.02em', lineHeight: 1, whiteSpace: 'nowrap', textShadow: '0 0 30px rgba(253,224,71,0.6), 0 0 60px rgba(168,85,247,0.4)', animation: 'lur-pop .8s cubic-bezier(.2,.9,.3,1.2) 0.55s forwards' }}>LEVEL {toLevel}</div>
          {toIdx !== fromIdx && (
            <div className="lur-a" style={{ font: "700 11px 'Orbitron',sans-serif", color: '#b06aff', letterSpacing: '0.12em', marginTop: 8, textShadow: '0 0 10px rgba(176,106,255,0.6)', animation: 'lur-tag .5s ease 1.3s forwards' }}>{RANKS[fromIdx].toUpperCase()} → {RANKS[toIdx].toUpperCase()}</div>
          )}

          <div className="lur-a" style={{ width: 64, height: 2, background: 'linear-gradient(90deg,transparent,#fde047,transparent)', margin: '22px 0 18px', animation: 'lur-tag .5s ease 1.5s forwards' }}/>

          <div className="lur-a" style={{ font: "700 8px 'Press Start 2P',monospace", color: '#fff', letterSpacing: '0.14em', marginBottom: 12, animation: 'lur-tag .5s ease 1.65s forwards' }}>NEW AVATAR UNLOCKED</div>

          {/* Avatar reveal card */}
          <div className="lur-a" style={{ position: 'relative', width: 230, height: 190, borderRadius: 14, overflow: 'hidden', border: '1.5px solid rgba(253,224,71,0.7)', boxShadow: '0 0 34px rgba(253,224,71,0.3), 0 0 60px rgba(168,85,247,0.25)', animation: 'lur-rise .6s cubic-bezier(.2,.8,.3,1) 1.85s forwards' }}>
            <SafeImage src={tierImage(VISIBLE_TIERS[toIdx].id, s)} alt="New avatar" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 30%' }}/>
            <div style={{ position: 'absolute', top: 0, left: 0, width: '40%', height: '100%', background: 'linear-gradient(120deg,transparent,rgba(255,255,255,0.35),transparent)', transform: 'translateX(-120%) skewX(-20deg)', animation: 'lur-shine 1.1s ease 2.5s 1' }}/>
            <span style={{ position: 'absolute', top: -1, left: -1, width: 18, height: 18, borderLeft: '2px solid #fde047', borderTop: '2px solid #fde047' }}/>
            <span style={{ position: 'absolute', top: -1, right: -1, width: 18, height: 18, borderRight: '2px solid #fde047', borderTop: '2px solid #fde047' }}/>
            <span style={{ position: 'absolute', bottom: -1, left: -1, width: 18, height: 18, borderLeft: '2px solid #fde047', borderBottom: '2px solid #fde047' }}/>
            <span style={{ position: 'absolute', bottom: -1, right: -1, width: 18, height: 18, borderRight: '2px solid #fde047', borderBottom: '2px solid #fde047' }}/>
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 8, textAlign: 'center', background: 'linear-gradient(to top, rgba(8,1,15,0.92), transparent)' }}>
              <div style={{ font: "900 15px 'Orbitron',sans-serif", color: '#fde047', letterSpacing: '0.06em', textShadow: '0 0 12px rgba(253,224,71,0.5)' }}>{RANKS[toIdx].toUpperCase()}</div>
              <div style={{ font: "600 9px 'Rajdhani',sans-serif", color: '#c4a4d8', letterSpacing: '0.05em' }}>TIER {ROMAN[toIdx]} AVATAR UNLOCKED</div>
            </div>
          </div>

          {/* Stat boosts */}
          <div className="lur-a" style={{ display: 'flex', gap: 8, marginTop: 16, animation: 'lur-tag .5s ease 2.2s forwards' }}>
            {boosts.map(b => (
              <span key={b.label} style={{ font: "800 9px 'Orbitron',sans-serif", color: b.color, border: `1px solid ${b.color}66`, background: `${b.color}14`, borderRadius: 6, padding: '5px 9px' }}>{b.label}</span>
            ))}
          </div>
        </div>

        {/* CTAs */}
        <div className="lur-a" style={{ padding: '0 22px calc(30px + env(safe-area-inset-bottom,0px))', display: 'flex', flexDirection: 'column', gap: 10, animation: 'lur-tag .5s ease 2.5s forwards' }}>
          <button onClick={onEquip} style={{ width: '100%', height: 52, border: 'none', borderRadius: 12, background: 'linear-gradient(135deg,#fde047,#f59e0b)', color: '#0a0014', font: "900 14px 'Orbitron',sans-serif", letterSpacing: '0.1em', cursor: 'pointer', boxShadow: '0 0 24px rgba(253,224,71,0.45)' }}>⚔ EQUIP AVATAR</button>
          <button onClick={onContinue} style={{ width: '100%', height: 46, border: '1px solid rgba(255,255,255,0.14)', borderRadius: 12, background: 'rgba(14,2,28,0.6)', color: '#c4a4d8', font: "800 12px 'Orbitron',sans-serif", letterSpacing: '0.1em', cursor: 'pointer' }}>CONTINUE</button>
        </div>
      </div>
    </PhoneFrame>
  );
}
