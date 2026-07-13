import { useState, useEffect, useRef } from 'react';

// Design 33 — first-run interactive feature tour (spotlight coach marks).
// Runs on the app's REAL screens: everything dims except the spotlighted
// element(s); a glass tooltip explains one idea per step. The host (App)
// owns navigation: each step declares which screen it lives on, and NEXT
// routes there before the overlay re-measures its target.
const GOLD = '#fde047';

export const TOUR_STEPS = [
  {
    screen: 'home',
    targets: ['todays-bout'],
    title: "⚔ TODAY'S BOUT — YOUR DAILY MISSION",
    body: (
      <>A workout picked for you every day from your discipline &amp; level. Tap{' '}
        <b style={{ color: GOLD }}>ENTER</b> to jump straight in — finishing it keeps your{' '}
        <b style={{ color: '#ff8a4a' }}>🔥 streak</b> and earns <b style={{ color: '#c9a6ff' }}>XP</b>.</>
    ),
  },
  {
    screen: 'training_hub',
    targets: ['mode-fight', 'mode-fit', 'mode-arcade'],
    title: '🥊 THE TRAIN TAB — PICK YOUR PATH',
    body: (
      <><b style={{ color: '#f87171' }}>Fight</b> trains skill,{' '}
        <b style={{ color: '#c084fc' }}>Fit</b> trains the body,{' '}
        <b style={{ color: '#8fe8ac' }}>Arcade</b> turns it into a game — and{' '}
        <b style={{ color: '#fbbf24' }}>Combat Conditioning</b> blends both. Tap any banner to enter.</>
    ),
  },
  {
    screen: 'progress',
    targets: ['rank-card'],
    title: '📈 EVERY REP LEVELS YOU UP',
    body: (
      <>Workouts earn <b style={{ color: GOLD }}>XP</b>. Fill the bar to climb{' '}
        <b style={{ color: '#fff' }}>Rookie → Adept → Veteran → Elite → Champion</b> — your avatar
        evolves at each rank, and trophies collect in the <b style={{ color: GOLD }}>TROPHIES</b> tab above.</>
    ),
  },
  {
    screen: 'profile',
    targets: ['game-link'],
    title: '🎮 TRAIN HERE, WIN THERE',
    body: (
      <>When the companion game launches, your <b style={{ color: '#c9a6ff' }}>rank, XP &amp; unlocked tiers</b>{' '}
        sync to your in-game fighter. Tap the card to join the launch list. That&apos;s the tour —{' '}
        <b style={{ color: GOLD }}>go train!</b></>
    ),
  },
];

const TOUR_STYLES = `
@keyframes tour-dim-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes tour-tip-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
@keyframes tour-spot-pulse {
  0%, 100% { box-shadow: 0 0 26px rgba(253,224,71,0.5); border-color: ${GOLD}; }
  50% { box-shadow: 0 0 38px rgba(253,224,71,0.75); border-color: #fff3b0; }
}
`;

const TIP_W = 312;
const TIP_EST_H = 178; // estimate for above/below placement

export default function FeatureTour({ step, onNext, onSkip }) {
  const cfg = TOUR_STEPS[step];
  const [rects, setRects] = useState(null);
  const scrolledRef = useRef(false);

  useEffect(() => {
    setRects(null);
    scrolledRef.current = false;
    let cancelled = false;
    let tries = 0;

    const measure = () => {
      if (cancelled) return;
      const els = (cfg?.targets || [])
        .map(t => document.querySelector(`[data-tour="${t}"]`))
        .filter(Boolean);
      if (els.length === 0) {
        tries++;
        // Target never rendered (missing data etc.) — skip the step gracefully.
        if (tries > 25) { onNext(); return; }
        setTimeout(measure, 100);
        return;
      }
      if (!scrolledRef.current) {
        scrolledRef.current = true;
        try { els[0].scrollIntoView({ block: 'center' }); } catch { /* noop */ }
      }
      requestAnimationFrame(() => {
        if (cancelled) return;
        setRects(els.map(el => {
          const r = el.getBoundingClientRect();
          return { top: r.top, left: r.left, width: r.width, height: r.height };
        }));
      });
    };

    measure();
    const iv = setInterval(measure, 500); // track layout shifts / late images
    window.addEventListener('resize', measure);
    return () => { cancelled = true; clearInterval(iv); window.removeEventListener('resize', measure); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  if (!cfg) return null;

  const vw = typeof window !== 'undefined' ? window.innerWidth : 440;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 900;

  // Union of all target rects (the "hole" in the dim layer), padded.
  const PAD = 6;
  const union = rects && {
    top: Math.min(...rects.map(r => r.top)) - PAD,
    left: Math.min(...rects.map(r => r.left)) - PAD,
    right: Math.max(...rects.map(r => r.left + r.width)) + PAD,
    bottom: Math.max(...rects.map(r => r.top + r.height)) + PAD,
  };

  // Tooltip below the spotlight, or above when the target sits low.
  const below = union ? union.bottom + TIP_EST_H + 24 < vh - 70 : true;
  const tipTop = union ? (below ? union.bottom + 16 : undefined) : vh * 0.4;
  const tipBottom = union && !below ? vh - union.top + 16 : undefined;
  const unionCx = union ? (union.left + union.right) / 2 : vw / 2;
  const tipLeft = Math.min(Math.max(unionCx - TIP_W / 2, 12), vw - TIP_W - 12);
  const notchX = Math.min(Math.max(unionCx - tipLeft - 6, 18), TIP_W - 30);

  const isLast = step === TOUR_STEPS.length - 1;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 600 }} onClick={e => e.stopPropagation()}>
      <style dangerouslySetInnerHTML={{ __html: TOUR_STYLES }} />

      {/* Dim layer with a spotlight hole (page shows through at full brightness) */}
      {union ? (
        <div style={{
          position: 'fixed',
          top: union.top, left: union.left,
          width: union.right - union.left, height: union.bottom - union.top,
          borderRadius: 14,
          boxShadow: '0 0 0 200vmax rgba(8,0,18,0.62)',
          animation: 'tour-dim-in 0.3s ease',
        }} />
      ) : (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(8,0,18,0.62)', animation: 'tour-dim-in 0.3s ease' }} />
      )}

      {/* Gold border + glow on each spotlighted element */}
      {rects && rects.map((r, i) => (
        <div key={i} style={{
          position: 'fixed', top: r.top - 3, left: r.left - 3,
          width: r.width + 6, height: r.height + 6,
          border: `2px solid ${GOLD}`, borderRadius: 13,
          boxShadow: '0 0 26px rgba(253,224,71,0.5)',
          animation: 'tour-spot-pulse 2.2s ease-in-out infinite',
          pointerEvents: 'none',
        }} />
      ))}

      {/* Tooltip */}
      <div style={{
        position: 'fixed', left: tipLeft, width: TIP_W,
        ...(tipTop !== undefined ? { top: tipTop } : {}),
        ...(tipBottom !== undefined ? { bottom: tipBottom } : {}),
        background: 'rgba(16,9,31,0.85)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        border: '1.5px solid rgba(253,224,71,0.5)', borderRadius: 14,
        boxShadow: '0 14px 34px rgba(0,0,0,0.55)',
        padding: '13px 14px 11px',
        animation: 'tour-tip-in 0.32s ease',
      }}>
        {/* Diamond notch pointing at the spotlight */}
        {union && (
          <div style={{
            position: 'absolute', left: notchX, width: 12, height: 12,
            background: 'rgba(16,9,31,0.92)', transform: 'rotate(45deg)',
            ...(below
              ? { top: -7, borderTop: '1.5px solid rgba(253,224,71,0.5)', borderLeft: '1.5px solid rgba(253,224,71,0.5)' }
              : { bottom: -7, borderBottom: '1.5px solid rgba(253,224,71,0.5)', borderRight: '1.5px solid rgba(253,224,71,0.5)' }),
          }} />
        )}

        <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 10, color: GOLD, letterSpacing: '0.08em', lineHeight: 1.4 }}>
          {cfg.title}
        </div>
        <div style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 11.5, color: '#e7ddf7', lineHeight: 1.45, margin: '6px 0 12px' }}>
          {cfg.body}
        </div>

        {/* Footer: skip · dots · next */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {!isLast ? (
            <button onClick={onSkip} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px 2px', fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 8, color: 'rgba(200,170,255,0.55)', letterSpacing: '0.1em' }}>
              SKIP TOUR
            </button>
          ) : <span style={{ width: 54 }} />}

          <div style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: 5 }}>
            {TOUR_STEPS.map((_, i) => (
              <span key={i} style={{
                width: i === step ? 14 : 5, height: 5, borderRadius: 99,
                background: i === step ? GOLD : 'rgba(255,255,255,0.28)',
                transition: 'width 0.25s ease',
              }} />
            ))}
          </div>

          {isLast ? (
            <button onClick={onNext} style={{
              background: 'linear-gradient(135deg,#fde047,#f59e0b)', border: 'none', cursor: 'pointer',
              borderRadius: 9, padding: '9px 13px',
              fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 9, color: '#0a0014', letterSpacing: '0.1em',
              boxShadow: '0 0 16px rgba(253,224,71,0.4)',
            }}>▶ START TRAINING</button>
          ) : (
            <button onClick={onNext} style={{
              background: 'rgba(253,224,71,0.12)', border: `1px solid ${GOLD}`, cursor: 'pointer',
              borderRadius: 9, padding: '8px 14px',
              fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 9, color: GOLD, letterSpacing: '0.1em',
            }}>NEXT ›</button>
          )}
        </div>
      </div>
    </div>
  );
}
