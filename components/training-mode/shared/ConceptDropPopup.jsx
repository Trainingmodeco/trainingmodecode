import { createPortal } from 'react-dom';
import SafeImage from '../SafeImage';
import { fmtEnd } from '../data/concepts';

// The new-drop poster, once per drop per phone, on opening the app
// (App.goAfterSplash queue). START opens the concept page.
const H = "'Orbitron',sans-serif";
const B = "'Rajdhani',sans-serif";
const GOLD = '#fde047';

export default function ConceptDropPopup({ entry, onStart, onClose }) {
  if (!entry) return null;
  const c = entry.concept;
  const parts = [
    ['FIT', `${c.fit.days.filter(d => !d.rest).length}-day physique`, '#b58cff'],
    ['FIGHT', `${c.fight.days.length}-day ${c.fight.discipline}`, '#60a5fa'],
    ['ARCADE', `${c.arcade.stages.length}-stage gauntlet`, GOLD],
  ];
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={`New concept drop: ${c.title}`} style={{
      position: 'fixed', inset: 0, maxWidth: 440, margin: '0 auto', zIndex: 900, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 22, background: 'rgba(5,0,12,0.84)', backdropFilter: 'blur(4px)',
    }}>
      <div style={{ position: 'relative', width: '100%', maxWidth: 346, borderRadius: 20, overflow: 'hidden', background: '#0c0218', boxShadow: `0 0 0 1px ${c.accent}88, 0 0 30px rgba(168,85,247,0.45)` }}>
        <div style={{ position: 'relative', height: 400 }}>
          <SafeImage src={c.art.poster} alt="" loading="eager" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 20%' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(12,2,24,.2) 0%,rgba(12,2,24,0) 38%,rgba(12,2,24,.9) 86%,#0c0218 100%)' }} />
          <div style={{ position: 'absolute', top: 12, left: 12, right: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ padding: '5px 10px', borderRadius: 99, background: GOLD, color: '#1e1400', font: `800 8.5px ${H}`, letterSpacing: '0.14em' }}>◆ NEW CONCEPT DROP</span>
            <button type="button" onClick={onClose} aria-label="Close" style={{ width: 32, height: 32, borderRadius: '50%', border: 0, background: 'rgba(0,0,0,0.55)', color: '#ddd', fontSize: 15, cursor: 'pointer' }}>✕</button>
          </div>
          <div style={{ position: 'absolute', left: 18, right: 18, bottom: 12 }}>
            <div style={{ font: `800 8px ${H}`, letterSpacing: '0.16em', color: c.accent }}>UNTIL {fmtEnd(entry)} · LIMITED TITLE</div>
            <div style={{ font: `900 38px ${H}`, lineHeight: 1, marginTop: 4, color: '#fff', textShadow: `0 0 26px ${c.accent}99` }}>{c.title}</div>
            <div style={{ font: `600 14px ${B}`, color: '#f5d0fe', marginTop: 4 }}>{c.tagline}</div>
          </div>
        </div>
        <div style={{ padding: '12px 16px 16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 7, marginBottom: 12 }}>
            {parts.map(([a, b, col]) => (
              <div key={a} style={{ borderRadius: 10, border: `1px solid ${col}66`, background: `${col}14`, padding: '8px 6px', textAlign: 'center' }}>
                <div style={{ font: `900 11px ${H}`, color: col }}>{a}</div>
                <div style={{ font: `600 10.5px ${B}`, color: '#cfc3e8', marginTop: 2 }}>{b}</div>
              </div>
            ))}
          </div>
          <button type="button" onClick={onStart} style={{
            width: '100%', height: 52, borderRadius: 12, border: 0, cursor: 'pointer', color: '#1e1400',
            background: 'linear-gradient(180deg,#ffe574,#e7a52a)', boxShadow: '0 6px 0 #8a5a00,0 0 30px rgba(253,224,71,0.35)',
            font: `900 14px ${H}`, letterSpacing: '0.18em',
          }}>▶ START THE REGIME</button>
          <div style={{ textAlign: 'center', font: `600 12px ${B}`, color: '#9a90b8', marginTop: 10 }}>
            Finish all three by {fmtEnd(entry)} for the <b style={{ color: c.accent }}>{c.reward.title}</b> title
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
