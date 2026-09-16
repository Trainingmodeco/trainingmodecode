import { useEffect } from 'react';
import { C } from '../Styles';
import { ARCADE } from '../ArcadeUI';

// The Pro overlay. Pops at the point of contact — the moment an athlete tries
// the thing that free does not cover — rather than sitting on a separate
// screen the user has to be routed to. That is the pattern the owner asked
// for: try level 4 of Training Camp, try stage 4 in the Arcade, try five
// rounds in Combo Coach, and the overlay slides up with "free is 1–3, unlock
// the rest with Pro". The context is right in the sentence, so nobody has to
// guess what they were about to pay for.
//
// The overlay is a component, not a screen. It renders as a fixed backdrop
// over whatever is behind it, so the athlete's setup is not lost and closing
// it just returns them where they were. That solves the three problems the
// PROMPT-MONEY-90 §5 refactor called out — losing the user's place, the
// back-button edge case, and the mini-player being killed when navigation
// tears down the setup.
//
// One place per app. Every gate site declares WHAT is gated (a title, a body,
// a "free vs pro" comparison) and hands it here. Behaviour stays consistent:
// same close, same scrim, same CTA.

export default function ProGateOverlay({
  open,
  title,
  body,
  freeLine,
  proLine,
  onGoPro,
  onClose,
}) {
  useEffect(() => {
    if (!open || typeof document === 'undefined') return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    // Prevent the page underneath from scrolling while the overlay is up.
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title || 'Go Pro'}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        // A scrim, not a fade — enough to read against, not so opaque it
        // erases the context of what the athlete was about to do.
        background: 'rgba(4,0,14,0.72)',
        backdropFilter: 'blur(3px)',
        WebkitBackdropFilter: 'blur(3px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(390px, 100%)',
          background: 'linear-gradient(180deg, rgba(30,6,54,0.98) 0%, rgba(12,2,24,0.98) 100%)',
          borderTop: '1.5px solid rgba(253,224,71,0.6)',
          borderRadius: '18px 18px 0 0',
          boxShadow: '0 -12px 40px rgba(0,0,0,0.55), 0 0 30px rgba(253,224,71,0.12)',
          padding: '20px 20px calc(24px + env(safe-area-inset-bottom, 0px))',
          animation: 'progate-in 0.28s cubic-bezier(.2,.7,.3,1) both',
        }}
      >
        <style>{`
          @keyframes progate-in {
            from { transform: translateY(24px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
        `}</style>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <span style={{ fontSize: 22, lineHeight: 1 }}>👑</span>
          <span style={{ fontFamily: ARCADE.fontHead, fontWeight: 900, fontSize: 11, color: ARCADE.gold, letterSpacing: '0.16em' }}>
            TRAINING MODE PRO
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              marginLeft: 'auto', width: 30, height: 30, borderRadius: 8,
              border: '1px solid rgba(168,85,247,0.3)', background: 'rgba(8,2,18,0.6)',
              color: '#d6c2ff', fontSize: 14, fontWeight: 900, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
            }}
          >✕</button>
        </div>

        <div style={{ fontFamily: ARCADE.fontHead, fontWeight: 900, fontSize: 18, color: '#fff', letterSpacing: '0.02em', lineHeight: 1.25, marginBottom: 8 }}>
          {title}
        </div>
        <div style={{ fontFamily: ARCADE.fontBody, fontSize: 12.5, color: '#c9c0e0', lineHeight: 1.45, marginBottom: 14 }}>
          {body}
        </div>

        {/* The free-vs-pro line. Free is not a punishment, it is a preview
            with a real ceiling. Naming the ceiling by number ("free is up to
            3") is what makes the ask feel fair rather than arbitrary. */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
          <div style={{
            borderRadius: 10, border: '1px solid rgba(168,85,247,0.28)',
            background: 'rgba(8,2,18,0.55)', padding: '10px 11px',
          }}>
            <div style={{ fontFamily: ARCADE.fontHead, fontSize: 7.5, fontWeight: 800, color: '#8b83a8', letterSpacing: '0.14em', marginBottom: 4 }}>
              FREE
            </div>
            <div style={{ fontFamily: ARCADE.fontBody, fontSize: 11.5, color: '#e6d4ff', lineHeight: 1.35 }}>
              {freeLine}
            </div>
          </div>
          <div style={{
            borderRadius: 10, border: '1.5px solid rgba(253,224,71,0.7)',
            background: 'rgba(253,224,71,0.09)', padding: '10px 11px',
            boxShadow: '0 0 16px rgba(253,224,71,0.16)',
          }}>
            <div style={{ fontFamily: ARCADE.fontHead, fontSize: 7.5, fontWeight: 800, color: ARCADE.gold, letterSpacing: '0.14em', marginBottom: 4 }}>
              PRO
            </div>
            <div style={{ fontFamily: ARCADE.fontBody, fontSize: 11.5, color: '#fff', lineHeight: 1.35 }}>
              {proLine}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onGoPro}
          style={{
            display: 'block', width: '100%', padding: '14px 0',
            borderRadius: 14, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(180deg, #fde047 0%, #e0b400 100%)',
            color: '#2a1a00', fontFamily: ARCADE.fontHead, fontWeight: 900,
            fontSize: 13, letterSpacing: '0.12em',
            boxShadow: '0 0 22px rgba(253,224,71,0.35)',
          }}
        >
          ▶ GO PRO
        </button>
        <button
          type="button"
          onClick={onClose}
          style={{
            display: 'block', width: '100%', marginTop: 8, padding: '10px 0',
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: C.muted, fontFamily: ARCADE.fontHead, fontSize: 10, fontWeight: 700, letterSpacing: '0.14em',
          }}
        >
          NOT NOW
        </button>
      </div>
    </div>
  );
}
