import { useState } from 'react';
import SafeImage from './SafeImage';
import { ChevronLeft } from 'lucide-react';

// Game Link — connect your game avatar. UI port of design 26a.
// Companion game is not live; CTA joins a waitlist (placeholder toast).

const BENEFITS = [
  { icon: '⚔', text: 'Workout XP → in-game stat points' },
  { icon: '🥋', text: 'Unlocked avatar tiers appear in-game' },
  { icon: '🏆', text: 'Exclusive skins from training streaks' },
];

export default function GameLink({ onBack, profile }) {
  const sex = String(profile?.sex || 'male').toLowerCase() === 'female' ? 'female' : 'male';
  const [notified, setNotified] = useState(false);

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 440, height: '100dvh', margin: '0 auto', background: '#08010f', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <SafeImage src="/static/app-bg.png" alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.28 }}/>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 25%,rgba(168,85,247,0.28),rgba(8,1,15,0.85) 70%)' }}/>

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px 4px' }}>
          <button onClick={onBack} aria-label="Back" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c4a4d8', display: 'flex', padding: 0 }}><ChevronLeft size={22}/></button>
          <div style={{ font: "900 15px 'Orbitron',sans-serif", color: '#c9a6ff', letterSpacing: '0.04em' }}>GAME LINK</div>
        </div>

        {/* Body */}
        <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '6px 18px 0' }}>
          {/* In-the-works banner */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderRadius: 11, border: '1px solid rgba(250,204,21,0.4)', background: 'rgba(250,204,21,0.07)', padding: '10px 12px', marginBottom: 16 }}>
            <span style={{ fontSize: 18 }}>🚧</span>
            <div style={{ flex: 1 }}>
              <div style={{ font: "800 9px 'Orbitron',sans-serif", color: '#facc15', letterSpacing: '0.08em' }}>IN THE WORKS · COMING SOON</div>
              <div style={{ font: "600 8.5px 'Rajdhani',sans-serif", color: '#c4a4d8', marginTop: 2, lineHeight: 1.4 }}>The game isn&apos;t live yet. Linking is not active — join the waitlist and we&apos;ll notify you the moment it launches.</div>
            </div>
          </div>

          {/* Flow visual */}
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{ width: 66, height: 82, borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(253,224,71,0.5)' }}>
                <SafeImage src={`/static/tiers/warrior-${sex}.png`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 15%' }}/>
              </div>
              <div style={{ font: "900 20px 'Orbitron',sans-serif", color: '#fde047' }}>→</div>
              <div style={{ width: 66, height: 82, borderRadius: 10, background: 'repeating-linear-gradient(45deg,#1a1030 0 8px,#241640 8px 16px)', border: '1px dashed rgba(176,106,255,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🎮</div>
            </div>
            <div style={{ font: "900 17px 'Orbitron',sans-serif", color: '#fff', letterSpacing: '0.02em', textShadow: '0 0 14px rgba(168,85,247,.5)' }}>TRAIN HERE. LEVEL UP THERE.</div>
            <div style={{ font: "600 10px 'Rajdhani',sans-serif", color: '#c4a4d8', marginTop: 5, lineHeight: 1.5 }}>Every real workout earns XP that powers up your fighter in the Training Mode game. Your rank, avatar tier &amp; stats carry over.</div>
          </div>

          {/* Benefits */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 16 }}>
            {BENEFITS.map(b => (
              <div key={b.text} style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'rgba(16,4,30,0.6)', border: '1px solid rgba(168,85,247,0.2)', borderRadius: 10, padding: '9px 12px' }}>
                <span style={{ color: '#fde047' }}>{b.icon}</span>
                <span style={{ font: "600 10px 'Rajdhani',sans-serif", color: '#f5e9ff' }}>{b.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '8px 18px 26px', flexShrink: 0 }}>
          <div style={{ textAlign: 'center', font: "700 8px 'Orbitron',sans-serif", color: '#facc15', letterSpacing: '0.14em', marginBottom: 10, padding: 8, border: '1px solid rgba(250,204,21,0.3)', borderRadius: 9, background: 'rgba(250,204,21,0.06)' }}>🎮 GAME LAUNCHES 2026 · RESERVE YOUR FIGHTER EARLY</div>
          <button onClick={() => setNotified(true)} style={{ width: '100%', height: 52, border: 'none', borderRadius: 13, background: notified ? 'linear-gradient(135deg,#22c55e,#16a34a)' : 'linear-gradient(135deg,#b975ff,#a855f7)', color: '#fff', font: "900 13px 'Orbitron',sans-serif", letterSpacing: '0.06em', cursor: 'pointer', boxShadow: '0 0 22px rgba(168,85,247,.45)' }}>{notified ? '✓ YOU’RE ON THE LIST' : '🔔 NOTIFY ME AT LAUNCH'}</button>
          <div style={{ textAlign: 'center', font: "600 9px 'Rajdhani',sans-serif", color: '#6d5a8f', marginTop: 10 }}>Linking opens when the game goes live · no code needed yet</div>
        </div>
      </div>
    </div>
  );
}
