import { useState, useEffect } from 'react';
import SafeImage from './SafeImage';
import { C } from './Styles';
import { getCurrentUser, onAuthChange, signInWithGoogle, signOut, userProfile } from './data/authClient';

// Account card for the Profile screen. Signed out → "Continue with Google";
// signed in → the athlete's Google identity + sign out. Sign-in is optional —
// the app works fully without it — so this never blocks anything; it's the
// anchor for Pro entitlements + Stripe once those ship.
const GOLD = C.gold;

// Inline Google "G" so we don't pull in an icon dependency or a remote asset.
function GoogleG({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.2-.1-2.3-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 4.1 29.6 2 24 2 15.5 2 8.2 6.8 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 46c5.5 0 10.4-2.1 14.1-5.5l-6.5-5.5C29.6 36.6 26.9 38 24 38c-5.2 0-9.6-3.3-11.2-8l-6.6 5.1C8.1 41.1 15.4 46 24 46z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.5l6.5 5.5C40.5 36 44 30.6 44 24c0-1.2-.1-2.3-.4-3.5z"/>
    </svg>
  );
}

export default function AccountCard() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    const done = (u) => { if (alive) { setUser(u); setReady(true); } };
    getCurrentUser().then(done).catch(() => done(null));
    const unsub = onAuthChange(done);
    // Fail open: never leave the card stuck on its placeholder if the auth
    // client is slow or unavailable — fall back to the signed-out state.
    const t = setTimeout(() => { if (alive) setReady(true); }, 1500);
    return () => { alive = false; clearTimeout(t); unsub(); };
  }, []);

  const p = userProfile(user);

  // Avoid a "Continue with Google" flash before the persisted session loads.
  if (!ready) return <div style={{ height: 68 }}/>;

  const handleSignIn = async () => {
    setBusy(true);
    const { error } = await signInWithGoogle();
    // On success the page redirects to Google; only errors land back here.
    if (error) setBusy(false);
  };

  const card = {
    width: '100%', padding: '14px 16px', borderRadius: 12, border: '1px solid rgba(168,85,247,0.2)',
    background: 'rgba(12,2,24,0.85)', display: 'flex', alignItems: 'center', gap: 12,
  };

  if (p) {
    return (
      <div style={card}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, border: '1.5px solid rgba(253,224,71,0.5)', background: 'rgba(168,85,247,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {p.avatarUrl
            ? <SafeImage src={p.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
            : <span style={{ font: "900 15px 'Orbitron',sans-serif", color: GOLD }}>{(p.name[0] || 'A').toUpperCase()}</span>}
        </div>
        <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
          <div style={{ font: "800 11px 'Orbitron',sans-serif", color: C.text, letterSpacing: '0.04em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
          <div style={{ font: "600 10px 'Rajdhani',sans-serif", color: C.muted, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.email || 'Signed in with Google'}</div>
        </div>
        <button onClick={() => signOut()} style={{ flexShrink: 0, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '7px 11px', cursor: 'pointer', font: "700 8px 'Orbitron',sans-serif", color: '#f87171', letterSpacing: '0.08em' }}>SIGN OUT</button>
      </div>
    );
  }

  return (
    <button onClick={handleSignIn} disabled={busy} style={{ ...card, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.7 : 1 }}>
      <div style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <GoogleG size={20}/>
      </div>
      <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
        <div style={{ font: "800 11px 'Orbitron',sans-serif", color: C.text, letterSpacing: '0.06em' }}>{busy ? 'CONNECTING…' : 'CONTINUE WITH GOOGLE'}</div>
        <div style={{ font: "600 10px 'Rajdhani',sans-serif", color: C.muted, marginTop: 2 }}>Save your progress across devices.</div>
      </div>
      {!busy && <span style={{ flexShrink: 0, font: "900 14px 'Orbitron',sans-serif", color: '#b06aff' }}>›</span>}
    </button>
  );
}
