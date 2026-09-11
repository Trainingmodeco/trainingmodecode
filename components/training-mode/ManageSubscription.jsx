import { useEffect, useState } from 'react';
import SafeImage from './SafeImage';
import { ChevronLeft, ExternalLink } from 'lucide-react';
import { PLANS, STRIPE_PORTAL_URL } from './data/stripe';
import { getCachedEntitlement, refreshEntitlement, PAYWALL_ENABLED } from './data/entitlements';
import { getCurrentUser, onAuthChange } from './data/authClient';
import { openExternalUrl } from './data/links';

// Manage Subscription — renders the REAL entitlement row synced from Supabase
// (plan, status, period end, cancel flag), never a mock. Billing itself lives
// with Stripe: the no-code Customer Portal link (STRIPE_PORTAL_URL) handles
// plan changes, cancellation and cards, so nothing here pretends to.

const PERKS = [
  'All Arcade protocols & boss stages',
  'Training Camp levels 4–12',
  'Unlimited saved Builder routines',
];

const fmtDate = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
};

function statusChip(ent) {
  if (!ent?.is_pro) return { text: 'FREE', bg: 'rgba(255,255,255,0.14)', fg: '#f5e9ff' };
  if (ent.status === 'past_due') return { text: 'PAYMENT DUE', bg: '#f59e0b', fg: '#0a0014' };
  if (ent.cancel_at_period_end) return { text: 'ENDING', bg: '#f59e0b', fg: '#0a0014' };
  return { text: 'ACTIVE', bg: '#22c55e', fg: '#0a0014' };
}

export default function ManageSubscription({ onBack, onPaywall }) {
  const [user, setUser] = useState(null);
  const [ent, setEnt] = useState(() => getCachedEntitlement());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const u = await getCurrentUser().catch(() => null);
      if (!alive) return;
      setUser(u);
      if (u) {
        const fresh = await refreshEntitlement().catch(() => null);
        if (alive && fresh) setEnt(getCachedEntitlement());
      }
      if (alive) setLoading(false);
    })();
    const off = onAuthChange((u) => { if (alive) setUser(u); });
    return () => { alive = false; off?.(); };
  }, []);

  const plan = ent?.plan && PLANS[ent.plan] ? PLANS[ent.plan] : null;
  const chip = statusChip(ent);
  const isPro = !!ent?.is_pro;
  const isFounder = ent?.plan === 'founder';
  const periodEnd = fmtDate(ent?.current_period_end);
  const betaNote = !PAYWALL_ENABLED && !isPro;

  const planLine = !user ? 'Sign in to see your plan'
    : isFounder ? 'Founder · lifetime · paid once'
      : plan ? `${plan.label.charAt(0)}${plan.label.slice(1).toLowerCase()} plan · ${plan.price}${plan.cadence}`
        : 'Free plan';

  const renewLine = !user ? null
    : isFounder ? 'Never renews. Pro for life.'
      : ent?.status === 'past_due' ? 'Your last payment failed. Update your card in Stripe to keep Pro.'
        : ent?.cancel_at_period_end && periodEnd ? `Cancelled. Pro stays on until ${periodEnd}.`
          : isPro && periodEnd ? `Renews ${periodEnd}.`
            : isPro ? 'Renews automatically.'
              : betaNote ? 'Everything is unlocked during beta.' : 'Upgrade to unlock every protocol.';

  const sub = { font: "600 10px 'Rajdhani',sans-serif", color: '#c4a4d8' };

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 440, height: '100dvh', margin: '0 auto', backgroundColor: '#080012', backgroundImage: 'radial-gradient(ellipse at 50% 0%,rgba(168,85,247,0.16) 0%,transparent 55%)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <SafeImage src="/static/app-bg.png" alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.18, zIndex: 0 }}/>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(8,2,18,0.45)', zIndex: 0 }}/>

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px 10px', flexShrink: 0 }}>
          <button onClick={onBack} aria-label="Back" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c4a4d8', display: 'flex', padding: 8, margin: -8 }}><ChevronLeft size={22}/></button>
          <div style={{ font: "900 15px 'Orbitron',sans-serif", color: '#fde047', letterSpacing: '0.06em' }}>SUBSCRIPTION</div>
        </div>

        <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '2px 14px 12px' }}>
          {/* Current plan — from the synced entitlement row */}
          <div style={{ borderRadius: 14, border: `1.5px solid ${isPro ? 'rgba(253,224,71,0.5)' : 'rgba(168,85,247,0.35)'}`, background: isPro ? 'linear-gradient(135deg,rgba(253,224,71,0.1),rgba(168,85,247,0.06))' : 'rgba(8,2,18,0.7)', padding: 15, marginBottom: 14, boxShadow: isPro ? '0 0 20px -8px rgba(253,224,71,.4)' : 'none' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ font: "900 16px 'Orbitron',sans-serif", color: isPro ? '#fde047' : '#c4b5fd' }}>{isPro ? 'TRAINING MODE PRO' : 'TRAINING MODE'}</div>
              <span style={{ font: "800 8px 'Orbitron',sans-serif", color: chip.fg, background: chip.bg, borderRadius: 5, padding: '3px 8px' }}>{loading && user ? 'SYNCING' : chip.text}</span>
            </div>
            <div style={sub}>{planLine}</div>
            {renewLine && <div style={{ ...sub, marginTop: 2 }}>{renewLine}</div>}
            {user?.email && <div style={{ ...sub, marginTop: 6, color: '#9a90b8' }}>{user.email}</div>}
          </div>

          {/* Perks */}
          <div style={{ font: "600 8px 'Orbitron',sans-serif", color: '#c4a4d8', letterSpacing: '0.18em', marginBottom: 8 }}>{isPro ? 'YOUR PRO PERKS' : 'WHAT PRO UNLOCKS'}</div>
          <div style={{ background: 'rgba(8,2,18,0.7)', border: '1px solid rgba(168,85,247,0.2)', borderRadius: 11, padding: '4px 13px', marginBottom: 14 }}>
            {PERKS.map((p, i) => (
              <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 0', borderBottom: i === PERKS.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ color: isPro ? '#22c55e' : '#9a90b8' }}>{isPro ? '✓' : '•'}</span>
                <span style={{ font: "600 10px 'Rajdhani',sans-serif", color: '#f5e9ff' }}>{p}</span>
              </div>
            ))}
          </div>

          {/* Actions — only what actually works */}
          {!user && (
            <div style={{ ...sub, textAlign: 'center', lineHeight: 1.45, marginBottom: 12 }}>
              Sign in from the Profile screen to see the plan tied to your account.
            </div>
          )}
          {user && !isPro && onPaywall && (
            <button onClick={onPaywall} style={{ width: '100%', height: 46, border: 'none', borderRadius: 11, background: 'linear-gradient(135deg,#fde047,#f5b301)', color: '#0a0014', font: "900 12px 'Orbitron',sans-serif", letterSpacing: '0.06em', cursor: 'pointer', marginBottom: 12 }}>
              SEE PRO PLANS
            </button>
          )}
          {user && isPro && !isFounder && STRIPE_PORTAL_URL && (
            <button onClick={() => openExternalUrl(STRIPE_PORTAL_URL)} style={{ width: '100%', height: 46, borderRadius: 11, border: '1px solid rgba(253,224,71,0.5)', background: 'rgba(253,224,71,0.08)', color: '#fde047', font: "800 11px 'Orbitron',sans-serif", letterSpacing: '0.06em', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 10 }}>
              <ExternalLink size={14}/> MANAGE BILLING
            </button>
          )}
          {user && isPro && !isFounder && (
            <div style={{ textAlign: 'center', font: "600 10px 'Rajdhani',sans-serif", color: '#9a90b8', lineHeight: 1.45 }}>
              {STRIPE_PORTAL_URL
                ? 'Change your plan, update your card or cancel through Stripe. Cancelling keeps Pro until the end of the period you paid for.'
                : 'Billing runs through Stripe. Use the link in your Stripe receipt email to change your card or cancel. Cancelling keeps Pro until the end of the period you paid for.'}
            </div>
          )}
          {user && isFounder && (
            <div style={{ textAlign: 'center', font: "600 10px 'Rajdhani',sans-serif", color: '#9a90b8', lineHeight: 1.45 }}>
              Thank you for backing Training Mode early. Nothing to manage — this account is Pro for life.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
