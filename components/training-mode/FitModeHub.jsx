import PhoneFrame from './PhoneFrame';
import SafeImage from './SafeImage';
import Embers from './Embers';
import { ChevronLeft, Home } from 'lucide-react';
import { IMG } from './data/optimizedImageMap';

// Fit Mode list — pixel match of design 3d: header (title-fit) + SELECT TRAINING PATH
// + five full-width art banners, tap straight in.
const GOLD = '#fde047';
const VIOLET = '#b06aff';
const RED = '#ef4444';

export default function FitModeHub({ onHome, onBack, onWorkoutBuilder, onQuickMission, onCombatConditioning, onCardioMode, onWorkoutCodec }) {
  const BANNERS = [
    { key: 'builder', img: IMG.fitMode.workoutBuilder,      alt: 'Workout Builder',      color: GOLD,   rgb: '250,204,21', pos: 'center 42%', onClick: onWorkoutBuilder },
    { key: 'quick',   img: IMG.fitMode.quickMission,        alt: 'Quick Mission',        color: VIOLET, rgb: '176,106,255', pos: 'center 40%', onClick: onQuickMission },
    { key: 'combat',  img: IMG.fitMode.combatConditioning,  alt: 'Combat Conditioning',  color: RED,    rgb: '239,68,68', pos: 'center 34%', onClick: onCombatConditioning },
    { key: 'cardio',  img: IMG.fitMode.cardioMode,          alt: 'Cardio Mode',          color: VIOLET, rgb: '176,106,255', pos: 'center 45%', badge: 'BETA', onClick: onCardioMode },
    { key: 'codex',   img: IMG.fitMode.workoutCodex,        alt: 'Workout Codex',        color: GOLD,   rgb: '250,204,21', pos: 'center 40%', badge: 'BETA · UNFINISHED', onClick: onWorkoutCodec },
  ].filter(b => b.onClick);

  return (
    <PhoneFrame useBrandBg>
      <Embers count={3}/>
      <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', minHeight: '100dvh', paddingBottom: 'calc(120px + env(safe-area-inset-bottom,0px))' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px 12px' }}>
          <button onClick={onBack} aria-label="Back" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c4a4d8', display: 'flex', padding: 0 }}><ChevronLeft size={22}/></button>
          <div style={{ flex: 1 }}><SafeImage src="/static/title-fit.png" alt="Fit Mode" style={{ height: 30, width: 'auto', maxWidth: '100%', display: 'block' }}/></div>
          <button onClick={onHome} aria-label="Home" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c4a4d8', display: 'flex', padding: 0 }}><Home size={18}/></button>
        </div>

        <div style={{ padding: '2px 14px 0' }}>
          <div style={{ font: "600 8px 'Orbitron',sans-serif", color: '#c4a4d8', letterSpacing: '0.25em', marginBottom: 10 }}>SELECT TRAINING PATH</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {BANNERS.map(b => (
              <button key={b.key} onClick={b.onClick} style={{
                position: 'relative', height: 82, borderRadius: 12, overflow: 'hidden', padding: 0, cursor: 'pointer',
                border: `1px solid rgba(${b.rgb},0.5)`, boxShadow: `0 0 14px rgba(${b.rgb},0.12)`,
              }}>
                <SafeImage src={b.img} alt={b.alt} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: b.pos }}/>
                {b.badge && (
                  <span style={{ position: 'absolute', top: 7, left: 8, font: "700 7px 'Orbitron',sans-serif", color: '#facc15', background: 'rgba(8,2,18,0.8)', border: '1px solid rgba(250,204,21,0.4)', borderRadius: 4, padding: '2px 6px' }}>{b.badge}</span>
                )}
                <span style={{ position: 'absolute', bottom: 8, right: 9, width: 26, height: 26, borderRadius: '50%', background: 'rgba(8,2,18,0.78)', border: `1px solid rgba(${b.rgb},0.6)`, display: 'flex', alignItems: 'center', justifyContent: 'center', font: "900 15px 'Orbitron',sans-serif", color: b.color }}>›</span>
              </button>
            ))}
          </div>
          <div style={{ textAlign: 'center', font: "500 9px 'Rajdhani',sans-serif", color: '#6d5a8f', marginTop: 11 }}>Tap a banner to start &mdash; details on demand.</div>
        </div>
      </div>
    </PhoneFrame>
  );
}
