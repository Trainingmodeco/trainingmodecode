import { useState } from 'react';
import SafeImage from './SafeImage';

// First-run "How It Works" 4-card guide, shown once after onboarding.
// Faithful port of design 27a (Training Mode Redesign.dc.html):
// Welcome → Ways to Train → Leveling → Game Sync.

const VIOLET_BTN = 'linear-gradient(135deg,#b975ff,#a855f7)';
const GOLD_BTN = 'linear-gradient(135deg,#fde047,#f59e0b)';

function Dots({ active }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 7, marginBottom: 16 }}>
      {[0, 1, 2, 3].map(i => (
        <span key={i} style={{
          width: i === active ? 22 : 6, height: 6, borderRadius: 99,
          background: i === active ? '#fde047' : 'rgba(255,255,255,0.2)',
          transition: 'width 0.25s ease, background 0.25s ease',
        }}/>
      ))}
    </div>
  );
}

const MODES = [
  { icon: '💪', label: 'FIT MODE', color: '#c9a6ff', bg: 'rgba(176,106,255,0.08)', border: 'rgba(176,106,255,0.3)', desc: 'Workout builder, quick missions, cardio & conditioning circuits.' },
  { icon: '🥊', label: 'FIGHT MODE', color: '#ff8a8a', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.3)', desc: 'Combo coach, fight focus rounds & technique practice.' },
  { icon: '⚡', label: 'COMBAT CONDITIONING', color: '#ffb07a', bg: 'rgba(255,138,74,0.08)', border: 'rgba(255,138,74,0.3)', desc: 'The bridge — strength + striking circuits that blend Fit & Fight.' },
  { icon: '🕹', label: 'TRAINING ARCADE', color: '#8fe8ac', bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.3)', desc: 'Beat timed stages & bosses to earn big XP.' },
];

export default function HowItWorksGuide({ onDone, profile }) {
  const [card, setCard] = useState(0);
  const sex = String(profile?.sex || 'male').toLowerCase() === 'female' ? 'female' : 'male';
  const tier = (name) => `/static/tiers/${name}-${sex}.png`;

  const next = () => (card < 3 ? setCard(card + 1) : onDone?.());
  const TIERS = ['rookie', 'adept', 'veteran', 'elite', 'champion'];
  const ladderSizes = [[40, 52, 0.6, 'rgba(168,85,247,0.4)'], [46, 60, 0.75, 'rgba(168,85,247,0.5)'], [54, 72, 1, 'rgba(253,224,71,0.7)'], [46, 60, 0.75, 'rgba(168,85,247,0.5)'], [40, 52, 0.6, 'rgba(168,85,247,0.4)']];

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 440, height: '100dvh', margin: '0 auto', background: '#08010f', overflow: 'hidden' }}>
      <SafeImage src="/static/app-bg.png" alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.3 }}/>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(8,1,15,0.78)' }}/>

      {/* Modal sheet */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, top: 96,
        borderRadius: '28px 28px 0 0',
        background: 'linear-gradient(180deg,#120726,#0a0416)',
        border: '1px solid rgba(168,85,247,0.3)', borderBottom: 'none',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Skip (cards 0-2) or spacer (card 3) */}
        {card < 3 ? (
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '14px 18px 0' }}>
            <button onClick={() => onDone?.()} style={{ background: 'none', border: 'none', cursor: 'pointer', font: "700 9px 'Orbitron',sans-serif", color: '#9a90b8', letterSpacing: '0.1em' }}>SKIP</button>
          </div>
        ) : <div style={{ height: 24 }}/>}

        {/* Body */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 28px', textAlign: 'center' }}>
          {card === 0 && (
            <>
              <SafeImage src="/static/logo-mark.png" alt="" style={{ width: 64, height: 'auto', marginBottom: 18, filter: 'drop-shadow(0 0 16px rgba(245,179,1,.6))' }}/>
              <div style={{ font: "700 8px 'Orbitron',sans-serif", color: '#c9a6ff', letterSpacing: '0.2em', marginBottom: 8 }}>WELCOME TO</div>
              <div style={{ font: "900 26px 'Orbitron',sans-serif", color: '#fff', letterSpacing: '0.03em', marginBottom: 14, textShadow: '0 0 18px rgba(168,85,247,.6)' }}>TRAINING MODE</div>
              <div style={{ font: "600 12px 'Rajdhani',sans-serif", color: '#d9d1ef', lineHeight: 1.6, maxWidth: 270 }}>Real workouts, built like a fighter&apos;s game. Train boxing, kickboxing, Muay Thai &amp; MMA — and get stronger both on the mat and on screen.</div>
            </>
          )}

          {card === 1 && (
            <div style={{ width: '100%' }}>
              <div style={{ font: "900 20px 'Orbitron',sans-serif", color: '#fde047', letterSpacing: '0.02em', marginBottom: 5 }}>WAYS TO TRAIN</div>
              <div style={{ font: "600 11px 'Rajdhani',sans-serif", color: '#c4a4d8', marginBottom: 20 }}>Two core modes, two ways to bridge them.</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                {MODES.map(m => (
                  <div key={m.label} style={{ display: 'flex', gap: 12, alignItems: 'center', background: m.bg, border: `1px solid ${m.border}`, borderRadius: 13, padding: 13, textAlign: 'left' }}>
                    <span style={{ fontSize: 24 }}>{m.icon}</span>
                    <div>
                      <div style={{ font: "900 12px 'Orbitron',sans-serif", color: m.color }}>{m.label}</div>
                      <div style={{ font: "600 10px 'Rajdhani',sans-serif", color: '#d9d1ef', lineHeight: 1.4 }}>{m.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {card === 2 && (
            <>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, marginBottom: 20 }}>
                {TIERS.map((t, i) => {
                  const [w, h, op, bc] = ladderSizes[i];
                  return (
                    <div key={t} style={{ width: w, height: h, borderRadius: i === 2 ? 9 : 8, overflow: 'hidden', border: `${i === 2 ? 1.5 : 1}px solid ${bc}`, opacity: op, boxShadow: i === 2 ? '0 0 14px rgba(253,224,71,.35)' : 'none' }}>
                      <SafeImage src={tier(t)} alt={t} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 15%' }}/>
                    </div>
                  );
                })}
              </div>
              <div style={{ font: "900 20px 'Orbitron',sans-serif", color: '#fde047', letterSpacing: '0.02em', marginBottom: 12 }}>EVERY REP LEVELS YOU UP</div>
              <div style={{ font: "600 12px 'Rajdhani',sans-serif", color: '#d9d1ef', lineHeight: 1.6, maxWidth: 275 }}>Finish workouts to earn XP, keep your streak, and climb from <span style={{ color: '#fff', fontWeight: 700 }}>Rookie → Champion</span>. Your avatar evolves as you get stronger, and trophies stack up in your Progress tab.</div>
            </>
          )}

          {card === 3 && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 18 }}>
                <div style={{ width: 56, height: 70, borderRadius: 9, overflow: 'hidden', border: '1px solid rgba(253,224,71,0.5)' }}>
                  <SafeImage src={tier('veteran')} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 15%' }}/>
                </div>
                <div style={{ font: "900 20px 'Orbitron',sans-serif", color: '#fde047' }}>→</div>
                <div style={{ width: 56, height: 70, borderRadius: 9, background: 'repeating-linear-gradient(45deg,#1a1030 0 7px,#241640 7px 14px)', border: '1px dashed rgba(176,106,255,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🎮</div>
              </div>
              <div style={{ display: 'inline-block', font: "700 7px 'Orbitron',sans-serif", color: '#facc15', letterSpacing: '0.12em', border: '1px solid rgba(250,204,21,0.4)', borderRadius: 6, padding: '4px 9px', marginBottom: 12 }}>COMING SOON</div>
              <div style={{ font: "900 19px 'Orbitron',sans-serif", color: '#fff', letterSpacing: '0.02em', marginBottom: 12, textShadow: '0 0 14px rgba(168,85,247,.5)' }}>TRAIN HERE, WIN THERE</div>
              <div style={{ font: "600 12px 'Rajdhani',sans-serif", color: '#d9d1ef', lineHeight: 1.6, maxWidth: 275 }}>Soon you&apos;ll link Training Mode to the companion game — your real training will boost your in-game fighter&apos;s stats, rank &amp; skins. Build the body, power the avatar.</div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '0 26px 30px', flexShrink: 0 }}>
          <Dots active={card}/>
          <button onClick={next} style={{
            width: '100%', height: card === 3 ? 54 : 52, border: 'none', borderRadius: 13,
            background: card === 3 ? GOLD_BTN : VIOLET_BTN,
            color: card === 3 ? '#0a0014' : '#fff',
            font: `900 ${card === 3 ? 15 : 13}px 'Orbitron',sans-serif`, letterSpacing: '0.06em', cursor: 'pointer',
            boxShadow: card === 3 ? '0 0 24px rgba(253,224,71,.45)' : '0 0 22px rgba(168,85,247,.4)',
          }}>{card === 3 ? '▶ START TRAINING' : 'NEXT ›'}</button>
        </div>
      </div>
    </div>
  );
}
