import SafeImage from './SafeImage';
import { ChevronLeft } from 'lucide-react';

// Manage Subscription — UI port of design 26c. UI-only: rows are placeholders
// (real billing is handled by the App Store / Play account).

const PERKS = [
  'All Arcade protocols & boss stages',
  'Unlimited Builder & Cardio',
  'Every avatar tier + exclusive skins',
];

function Row({ label, value, last }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: last ? 'none' : '1px solid rgba(255,255,255,0.06)' }}>
      <span style={{ font: "600 10px 'Rajdhani',sans-serif", color: '#f5e9ff' }}>{label}</span>
      <span style={{ font: value && value.includes('••') ? "700 9px 'Orbitron',sans-serif" : "900 12px 'Orbitron',sans-serif", color: value && value.includes('••') ? '#c4a4d8' : '#6d5a8f' }}>{value || '›'}</span>
    </div>
  );
}

export default function ManageSubscription({ onBack }) {
  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 440, height: '100dvh', margin: '0 auto', backgroundColor: '#080012', backgroundImage: 'radial-gradient(ellipse at 50% 0%,rgba(168,85,247,0.16) 0%,transparent 55%)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <SafeImage src="/static/app-bg.png" alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.18, zIndex: 0 }}/>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(8,2,18,0.45)', zIndex: 0 }}/>

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px 10px', flexShrink: 0 }}>
          <button onClick={onBack} aria-label="Back" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c4a4d8', display: 'flex', padding: 0 }}><ChevronLeft size={22}/></button>
          <div style={{ font: "900 15px 'Orbitron',sans-serif", color: '#fde047', letterSpacing: '0.06em' }}>SUBSCRIPTION</div>
        </div>

        <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '2px 14px 12px' }}>
          {/* Current plan */}
          <div style={{ borderRadius: 14, border: '1.5px solid rgba(253,224,71,0.5)', background: 'linear-gradient(135deg,rgba(253,224,71,0.1),rgba(168,85,247,0.06))', padding: 15, marginBottom: 14, boxShadow: '0 0 20px -8px rgba(253,224,71,.4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ font: "900 16px 'Orbitron',sans-serif", color: '#fde047' }}>TRAINING MODE PRO</div>
              <span style={{ font: "800 8px 'Orbitron',sans-serif", color: '#0a0014', background: '#22c55e', borderRadius: 5, padding: '3px 8px' }}>ACTIVE</span>
            </div>
            <div style={{ font: "600 10px 'Rajdhani',sans-serif", color: '#c4a4d8' }}>Annual plan · $59.99/yr</div>
            <div style={{ font: "600 10px 'Rajdhani',sans-serif", color: '#c4a4d8', marginTop: 2 }}>Renews <span style={{ color: '#fff', fontWeight: 700 }}>March 14, 2027</span></div>
          </div>

          {/* Perks */}
          <div style={{ font: "600 8px 'Orbitron',sans-serif", color: '#c4a4d8', letterSpacing: '0.18em', marginBottom: 8 }}>YOUR PRO PERKS</div>
          <div style={{ background: 'rgba(8,2,18,0.7)', border: '1px solid rgba(168,85,247,0.2)', borderRadius: 11, padding: '4px 13px', marginBottom: 14 }}>
            {PERKS.map((p, i) => (
              <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 0', borderBottom: i === PERKS.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ color: '#22c55e' }}>✓</span>
                <span style={{ font: "600 10px 'Rajdhani',sans-serif", color: '#f5e9ff' }}>{p}</span>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div style={{ background: 'rgba(8,2,18,0.7)', border: '1px solid rgba(168,85,247,0.2)', borderRadius: 11, padding: '0 13px', marginBottom: 14 }}>
            <Row label="Switch to Monthly"/>
            <Row label="Payment method" value="•••• 4242 ›"/>
            <Row label="Restore purchases" last/>
          </div>

          <button style={{ width: '100%', height: 44, border: '1px solid rgba(255,90,90,0.35)', borderRadius: 11, background: 'rgba(255,90,90,0.07)', color: '#ff8a8a', font: "800 11px 'Orbitron',sans-serif", letterSpacing: '0.06em', cursor: 'pointer' }}>CANCEL SUBSCRIPTION</button>
          <div style={{ textAlign: 'center', font: "600 8px 'Rajdhani',sans-serif", color: '#6d5a8f', marginTop: 9, lineHeight: 1.4 }}>You&apos;ll keep PRO until March 14, 2027. Manage billing through your App Store / Play account.</div>
        </div>
      </div>
    </div>
  );
}
