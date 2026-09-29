import { createPortal } from 'react-dom';
import SafeImage from './SafeImage';

// Comeback cutscenes (Simplify revamp, Comeback.dc.html): letterbox bars slide
// in, the art pans slowly, the gold title zooms in. Full screen, with SKIP and
// REMIND ME NEXT WEEK. When they show is data/comeback's call; the numbers in
// them (days away, camp level) come from the athlete's own record.

const CSS = `
@keyframes cs-bar-top { from { transform: translateY(-100%) } to { transform: none } }
@keyframes cs-bar-bot { from { transform: translateY(100%) } to { transform: none } }
@keyframes cs-rise { from { opacity: 0; transform: translateY(18px) } to { opacity: 1; transform: none } }
@keyframes cs-zoom { from { opacity: 0; transform: scale(1.18); filter: blur(6px) } to { opacity: 1; transform: none; filter: none } }
@keyframes cs-flick { 0%, 100% { opacity: 1 } 92% { opacity: 1 } 94% { opacity: .4 } 96% { opacity: 1 } }
@keyframes cs-pan { from { transform: scale(1.12) translateX(0) } to { transform: scale(1.12) translateX(-18px) } }
.cs-top { animation: cs-bar-top .6s cubic-bezier(.2,.8,.2,1) both }
.cs-bot { animation: cs-bar-bot .6s cubic-bezier(.2,.8,.2,1) both }
.cs-bg { animation: cs-pan 14s ease-in-out infinite alternate }
.cs-z { animation: cs-zoom .9s cubic-bezier(.2,.8,.2,1) .5s both, cs-flick 4s linear 2s infinite }
.cs-1 { animation: cs-rise .6s ease .2s both } .cs-2 { animation: cs-rise .6s ease 1.1s both }
.cs-3 { animation: cs-rise .6s ease 1.5s both } .cs-4 { animation: cs-rise .6s ease 1.9s both }
.cs-5 { animation: cs-rise .6s ease 2.4s both }
.cs-gold:hover, .cs-gold:focus-visible { filter: brightness(1.1); }
.cs-txt:hover, .cs-txt:focus-visible { color: #FFFFFF !important; }
@media (prefers-reduced-motion: reduce) { [class^="cs-"], [class*=" cs-"] { animation: none !important } }
`;

const weeks = (d) => Math.max(3, Math.floor(d / 7));

function scene(c) {
  if (c.view === 'arcade') {
    return {
      bg: '/static/revamp/arcade-banner.webp', pos: '88% center', pan: true, accent: '#5FE3FF', glow: 'rgba(253,224,71,.45)', ink: '#4C1D95',
      veil: 'linear-gradient(180deg, rgba(5,4,9,.2) 0%, rgba(5,4,9,.1) 30%, rgba(8,4,24,.85) 62%, #050409 100%)',
      scene: 'INSERT COIN · PLAYER 1', kicker: `${c.days} DAYS SINCE YOUR LAST STAGE`, title: 'THE ARCADE KEPT YOUR SPOT.',
      line: '“Every stage in here is a real workout. You just didn’t notice because you were winning.”',
      beats: [['STAGES', 'Workouts built like levels'], ['BOSSES', 'Tests that fight back'], ['XP', 'Rank you earn, not buy']].map(([k, v]) => ({ k, v, color: '#5FE3FF', border: 'rgba(95,227,255,.35)' })),
      icon: '🕹️', calloutTitle: 'THE GAME IS COMING', calloutText: 'The arcade is where you learn the moves. When the Training Mode game drops, be ready on day one.',
      calloutBg: 'linear-gradient(90deg, rgba(107,43,217,.35), rgba(5,4,12,.8))', calloutBorder: 'rgba(253,224,71,.45)',
      cta: '▶ CONTINUE',
    };
  }
  if (c.view === 'cc') {
    return {
      // Left-anchored and still, so the poster's own NEXT ROUND GO FOR BROKE
      // stays whole (the design's bgLeft: 0, no pan).
      bg: '/static/revamp/cc-poster.webp', pos: 'left top', pan: false, accent: '#F87171', glow: 'rgba(239,68,68,.5)', ink: '#4A0A12',
      veil: 'linear-gradient(180deg, rgba(5,4,9,.3) 0%, rgba(5,4,9,.1) 28%, rgba(24,4,10,.85) 58%, #050409 100%)',
      scene: 'ROUND 12 · THE GAS TANK', kicker: `${weeks(c.days)} WEEKS OF FIGHT WORK · 0 CONDITIONING`, title: 'SKILL WINS ROUNDS. GAS WINS FIGHTS.',
      line: '“Your hands are sharp. Now build the engine so they’re still sharp in the last round.”',
      beats: [['GAS TANK', 'Last longer'], ['POWER', 'Hit harder'], ['STRENGTH', 'Hold your ground']].map(([k, v]) => ({ k, v, color: '#F87171', border: 'rgba(239,68,68,.4)' })),
      icon: '🔥', calloutTitle: 'GAS TANK CIRCUIT', calloutText: 'Built to pair with your Fight Mode week. Bag or bodyweight, no gym needed.',
      calloutBg: 'linear-gradient(90deg, rgba(185,28,28,.35), rgba(5,4,12,.8))', calloutBorder: 'rgba(248,113,113,.5)',
      cta: 'START GAS TANK',
    };
  }
  return {
    bg: '/static/training-camp-tower.webp', pos: 'center top', pan: true, accent: '#8FB4FF', glow: 'rgba(61,123,255,.55)', ink: '#0B1D5C',
    veil: 'linear-gradient(180deg, rgba(5,4,9,.35) 0%, rgba(5,4,9,.15) 28%, rgba(6,10,32,.85) 58%, #050409 100%)',
    scene: `FIGHT NIGHT · T-MINUS ${13 - c.level} LEVELS`, kicker: c.never ? 'YOUR CAMP IS WAITING' : `${c.days} DAYS OUT OF CAMP`, title: 'CHAMPIONS ARE MADE IN CAMP.',
    line: '“Nobody gets ready the week of the fight. Twelve levels. One belt. Let’s get to work.”',
    beats: [['FOUNDATION', 'Build the base'], ['HARD CAMP', 'Push the engine'], ['TITLE FIGHT', 'Earn the belt']].map(([k, v], i) => ({ k, v, color: ['#22C55E', '#F59E0B', '#EF4444'][i], border: ['rgba(34,197,94,.4)', 'rgba(245,158,11,.4)', 'rgba(239,68,68,.45)'][i] })),
    icon: '🥊', calloutTitle: `LEVEL ${c.level}${c.title ? ` · ${c.title}` : ''}`,
    calloutText: c.never ? 'Start at the base. Your plan adjusts to your level.' : `You left off in ${c.phase.charAt(0)}${c.phase.slice(1).toLowerCase()}. Pick up where you stopped — your plan adjusts to your level.`,
    calloutBg: 'linear-gradient(90deg, rgba(36,88,224,.35), rgba(5,4,12,.8))', calloutBorder: 'rgba(143,180,255,.5)',
    cta: 'ENTER CAMP',
  };
}

export default function Comeback({ comeback, onGo, onSkip, onRemind }) {
  const s = scene(comeback);
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={s.title} style={{
      position: 'fixed', inset: 0, maxWidth: 440, margin: '0 auto', zIndex: 900, overflow: 'hidden',
      background: '#050409', color: '#fff', fontFamily: 'Barlow, system-ui, sans-serif',
    }}>
      <style dangerouslySetInnerHTML={{ __html: CSS }}/>
      <SafeImage className={s.pan ? 'cs-bg' : ''} src={s.bg} alt="" style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: s.pos, opacity: 0.8,
      }}/>
      <div style={{ position: 'absolute', inset: 0, background: s.veil }}/>
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'repeating-linear-gradient(0deg, rgba(255,255,255,.03) 0 1px, transparent 1px 3px)' }}/>

      <div className="cs-top" style={{
        position: 'absolute', left: 0, right: 0, top: 0, height: 64, background: '#000', zIndex: 3, boxSizing: 'border-box',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '0 18px 10px',
      }}>
        <span style={{ font: "700 9px 'Orbitron',sans-serif", letterSpacing: '0.3em', color: s.accent }}>{s.scene}</span>
        <button type="button" className="cs-txt" onClick={onSkip} style={{
          height: 40, padding: '0 4px', marginBottom: -10, background: 'none', border: 0, cursor: 'pointer', color: '#8E88A8',
          font: "700 11px 'Chakra Petch',sans-serif", letterSpacing: '0.2em',
        }}>SKIP ›</button>
      </div>

      <div style={{
        position: 'absolute', left: 0, right: 0, top: 64, bottom: 'calc(96px + env(safe-area-inset-bottom, 0px))', zIndex: 2, boxSizing: 'border-box',
        padding: '0 24px 22px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 14,
      }}>
        <div className="cs-1" style={{ font: "700 12px 'Chakra Petch',sans-serif", letterSpacing: '0.22em', color: s.accent }}>{s.kicker}</div>
        <div className="cs-z" style={{
          font: "italic 900 38px 'Orbitron',sans-serif", lineHeight: 0.98, letterSpacing: '0.01em', textWrap: 'balance',
          background: 'linear-gradient(180deg, #FFF6C8 0%, #FDE047 45%, #E0A21C 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
          filter: `drop-shadow(0 0 16px ${s.glow}) drop-shadow(3px 3px 0 ${s.ink})`,
        }}>{s.title}</div>
        <div className="cs-2" style={{ fontSize: 16, lineHeight: 1.4, color: '#E6E2F5', fontStyle: 'italic', textWrap: 'pretty', maxWidth: 320 }}>{s.line}</div>
        <div className="cs-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 6 }}>
          {s.beats.map(b => (
            <div key={b.k} style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: '10px 10px 9px', background: 'rgba(5,4,12,.78)', border: `1px solid ${b.border}`, borderRadius: 10 }}>
              <span style={{ font: "900 11px 'Orbitron',sans-serif", letterSpacing: '0.08em', color: b.color }}>{b.k}</span>
              <span style={{ fontSize: 12, lineHeight: 1.25, color: '#CFC9E4' }}>{b.v}</span>
            </div>
          ))}
        </div>
        <div className="cs-4" style={{ display: 'flex', gap: 10, padding: '12px 14px', borderRadius: 12, background: s.calloutBg, border: `1px solid ${s.calloutBorder}` }}>
          <span style={{ fontSize: 20, lineHeight: 1.1 }}>{s.icon}</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ font: "900 11px 'Orbitron',sans-serif", letterSpacing: '0.12em', color: '#FDE047' }}>{s.calloutTitle}</span>
            <span style={{ fontSize: 13, lineHeight: 1.35, color: '#E6E2F5' }}>{s.calloutText}</span>
          </div>
        </div>
      </div>

      <div className="cs-bot" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 'calc(96px + env(safe-area-inset-bottom, 0px))', background: '#000', zIndex: 3 }}/>
      <div className="cs-5" style={{ position: 'absolute', zIndex: 4, left: 20, right: 20, bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <button type="button" className="cs-gold" onClick={onGo} style={{
          height: 54, border: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          clipPath: 'polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)',
          background: 'linear-gradient(180deg, #FFE9A8 0%, #F2BE45 50%, #C98A1C 100%)', color: '#1A1204',
          font: "900 14px 'Orbitron',sans-serif", letterSpacing: '0.16em', boxShadow: '0 0 28px rgba(242,190,69,.4)',
        }}>{s.cta}</button>
        <button type="button" className="cs-txt" onClick={onRemind} style={{
          height: 30, background: 'none', border: 0, cursor: 'pointer', color: '#8E88A8',
          font: "700 11px 'Chakra Petch',sans-serif", letterSpacing: '0.18em',
        }}>REMIND ME NEXT WEEK</button>
      </div>
    </div>,
    document.body,
  );
}
