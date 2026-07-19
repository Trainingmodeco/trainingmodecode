import { useState, useEffect } from 'react';
import SafeImage from './SafeImage';
import { X } from 'lucide-react';
import { trackEvent } from './data/analytics';
import { PLANS, PLAN_ORDER, startCheckout } from './data/stripe';
import { getCurrentUser, onAuthChange, signInWithGoogle } from './data/authClient';

// Paywall / Training Mode PRO (design 25a). Plans link to Stripe hosted
// checkout; the purchase is tied to the signed-in account so the webhook can
// grant Pro. Requires sign-in first (so Pro unlocks on any device).

const BENEFITS = [
  'All Arcade protocols & boss stages',
  'Unlimited Workout Builder & routines',
  'Every avatar tier + exclusive skins',
  'Full voice coaching + game-link rewards',
];

export default function Paywall({ onClose }) {
  const [plan, setPlan] = useState('annual');
  const [user, setUser] = useState(null);

  useEffect(() => {
    trackEvent('paywall_viewed');
    let alive = true;
    getCurrentUser().then(u => { if (alive) setUser(u); }).catch(() => {});
    const unsub = onAuthChange(u => { if (alive) setUser(u); });
    return () => { alive = false; unsub(); };
  }, []);

  const proceed = () => {
    if (!user) {
      trackEvent('paywall_signin_clicked', { plan });
      signInWithGoogle();   // redirects to Google; user re-opens paywall after
      return;
    }
    trackEvent('paywall_checkout_clicked', { plan });
    startCheckout(plan, user);   // redirects to Stripe
  };

  const founder = plan === 'founder';
  const ctaLabel = !user ? 'SIGN IN TO CONTINUE' : founder ? 'GET FOUNDER LIFETIME' : 'UPGRADE TO PRO';

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
            {PLAN_ORDER.map(id => {
              const p = PLANS[id];
              const active = plan === id;
              return (
                <button key={id} onClick={() => setPlan(id)} style={{ textAlign: 'left', position: 'relative', borderRadius: 12, border: `${active ? 2 : 1}px solid ${active ? '#fde047' : 'rgba(168,85,247,0.35)'}`, background: active ? 'rgba(253,224,71,0.08)' : 'rgba(16,4,30,0.7)', padding: '12px 14px', boxShadow: active ? '0 0 18px rgba(253,224,71,.2)' : 'none', cursor: 'pointer' }}>
                  {p.badge && <span style={{ position: 'absolute', top: -9, left: 14, font: "800 7px 'Orbitron',sans-serif", color: '#0a0014', background: '#fde047', borderRadius: 4, padding: '2px 7px' }}>{p.badge}</span>}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ font: "900 13px 'Orbitron',sans-serif", color: active ? '#fde047' : '#fff' }}>{p.label}</div>
                      <div style={{ font: "600 9px 'Rajdhani',sans-serif", color: '#c4a4d8' }}>{p.sub}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ font: "900 16px 'Orbitron',sans-serif", color: '#fff' }}>{p.price}</div>
                      <div style={{ font: "600 8px 'Rajdhani',sans-serif", color: '#9a90b8' }}>{p.cadence}</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer CTA */}
        <div style={{ padding: '12px 20px 26px', flexShrink: 0 }}>
          <button onClick={proceed} style={{ width: '100%', height: 54, border: 'none', borderRadius: 13, background: 'linear-gradient(135deg,#fde047,#f59e0b)', color: '#0a0014', font: "900 15px 'Orbitron',sans-serif", letterSpacing: '0.06em', cursor: 'pointer', boxShadow: '0 0 24px rgba(253,224,71,.45)' }}>{ctaLabel}</button>
          <div style={{ textAlign: 'center', font: "600 8px 'Rajdhani',sans-serif", color: '#9a90b8', marginTop: 10 }}>
            {user ? 'Secure checkout via Stripe · cancel anytime' : 'Sign in so your purchase unlocks on any device'}
          </div>
        </div>
      </div>
    </div>
  );
}
