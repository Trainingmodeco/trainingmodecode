import { useState, useEffect } from 'react';
import SafeImage from './SafeImage';
import { X } from 'lucide-react';
import { trackEvent } from './data/analytics';

// Paywall / Training Mode PRO — UI port of design 25a.
// UI-only: the CTA is a placeholder (no real IAP wired yet).
// Funnel events fire so conversion intent is measurable before Stripe ships.

const BENEFITS = [
  'All Arcade protocols & boss stages',
  'Unlimited Workout Builder & Cardio',
  'Every avatar tier + exclusive skins',
  'Full voice coaching + game-link rewards',
];

export default function Paywall({ onClose }) {
  const [plan, setPlan] = useState('annual');
  const [toast, setToast] = useState(false);

  useEffect(() => { trackEvent('paywall_viewed'); }, []);

  const startTrial = () => {
    trackEvent('paywall_trial_clicked', { plan });
    setToast(true);
    setTimeout(() => setToast(false), 2400);
  };

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 440, height: '100dvh', margin: '0 auto', background: '#08010f', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <SafeImage src="/static/app-bg.png" alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.3 }}/>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 20%,rgba(168,85,247,0.28),rgba(8,1,15,0.85) 70%)' }}/>

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Close */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '14px 18px 0' }}>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9a90b8', padding: 4 }}><X size={20}/></button>
        </div>

        {/* Scroll body */}
        <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '8px 20px 0' }}>
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <SafeImage src="/static/logo-mark.png" alt="" style={{ width: 44, height: 'auto', marginBottom: 8, filter: 'drop-shadow(0 0 14px rgba(245,179,1,.6))' }}/>
            <div style={{ font: "900 24px 'Orbitron',sans-serif", color: '#fff', letterSpacing: '0.04em', textShadow: '0 0 18px rgba(168,85,247,.6)' }}>TRAINING MODE <span style={{ color: '#fde047' }}>PRO</span></div>
            <div style={{ font: "600 10px 'Rajdhani',sans-serif", color: '#c4a4d8', marginTop: 3 }}>Unlock the full fighter&apos;s arsenal.</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {BENEFITS.map(b => (
              <div key={b} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(16,4,30,0.6)', border: '1px solid rgba(168,85,247,0.2)', borderRadius: 10, padding: '9px 12px' }}>
                <span style={{ color: '#fde047', fontSize: 13 }}>✦</span>
                <span style={{ font: "600 10px 'Rajdhani',sans-serif", color: '#f5e9ff' }}>{b}</span>
              </div>
            ))}
          </div>

          {/* Plans */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <button onClick={() => setPlan('annual')} style={{ textAlign: 'left', position: 'relative', borderRadius: 12, border: `2px solid ${plan === 'annual' ? '#fde047' : 'rgba(168,85,247,0.35)'}`, background: plan === 'annual' ? 'rgba(253,224,71,0.08)' : 'rgba(16,4,30,0.7)', padding: '12px 14px', boxShadow: plan === 'annual' ? '0 0 18px rgba(253,224,71,.2)' : 'none', cursor: 'pointer' }}>
              <span style={{ position: 'absolute', top: -9, left: 14, font: "800 7px 'Orbitron',sans-serif", color: '#0a0014', background: '#fde047', borderRadius: 4, padding: '2px 7px' }}>BEST VALUE · SAVE 40%</span>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div><div style={{ font: "900 13px 'Orbitron',sans-serif", color: '#fde047' }}>ANNUAL</div><div style={{ font: "600 9px 'Rajdhani',sans-serif", color: '#c4a4d8' }}>$59.99/yr · billed yearly</div></div>
                <div style={{ textAlign: 'right' }}><div style={{ font: "900 16px 'Orbitron',sans-serif", color: '#fff' }}>$5</div><div style={{ font: "600 8px 'Rajdhani',sans-serif", color: '#9a90b8' }}>/mo</div></div>
              </div>
            </button>
            <button onClick={() => setPlan('monthly')} style={{ textAlign: 'left', borderRadius: 12, border: `${plan === 'monthly' ? 2 : 1}px solid ${plan === 'monthly' ? '#fde047' : 'rgba(168,85,247,0.35)'}`, background: 'rgba(16,4,30,0.7)', padding: '12px 14px', cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div><div style={{ font: "900 13px 'Orbitron',sans-serif", color: '#fff' }}>MONTHLY</div><div style={{ font: "600 9px 'Rajdhani',sans-serif", color: '#c4a4d8' }}>Cancel anytime</div></div>
                <div style={{ textAlign: 'right' }}><div style={{ font: "900 16px 'Orbitron',sans-serif", color: '#fff' }}>$8.99</div><div style={{ font: "600 8px 'Rajdhani',sans-serif", color: '#9a90b8' }}>/mo</div></div>
              </div>
            </button>
          </div>
        </div>

        {/* Footer CTA */}
        <div style={{ padding: '12px 20px 26px', flexShrink: 0 }}>
          <button onClick={startTrial} style={{ width: '100%', height: 54, border: 'none', borderRadius: 13, background: 'linear-gradient(135deg,#fde047,#f59e0b)', color: '#0a0014', font: "900 15px 'Orbitron',sans-serif", letterSpacing: '0.06em', cursor: 'pointer', boxShadow: '0 0 24px rgba(253,224,71,.45)' }}>START 7-DAY FREE TRIAL</button>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 12 }}>
            {['Restore Purchase', 'Terms', 'Privacy'].map(t => <span key={t} style={{ font: "600 8px 'Rajdhani',sans-serif", color: '#9a90b8' }}>{t}</span>)}
          </div>
        </div>
      </div>

      {toast && (
        <div style={{ position: 'absolute', left: '50%', bottom: 96, transform: 'translateX(-50%)', background: 'rgba(20,8,36,0.96)', border: '1px solid rgba(253,224,71,0.4)', borderRadius: 10, padding: '10px 16px', font: "700 10px 'Orbitron',sans-serif", color: '#fde047', letterSpacing: '0.04em', whiteSpace: 'nowrap', zIndex: 10 }}>
          Payments aren&apos;t wired up yet — coming soon.
        </div>
      )}
    </div>
  );
}
