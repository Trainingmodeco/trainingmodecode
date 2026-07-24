import { useState, useEffect, useRef } from 'react';

// Screen guide — the ⓘ button's spotlight walkthrough. Same coach-mark
// mechanics as the first-run FeatureTour, but scoped to the CURRENT screen:
// an intro card ("what this page is"), then each option lights up in turn
// with a direct "choose this if…" explanation. No navigation, no persistence —
// it can be replayed from the ⓘ any time.
//
// Steps: [{ target: 'data-guide value' | null, title, body }]
// A null target renders a centered intro card over a full dim.
const GOLD = '#fde047';

const GUIDE_STYLES = `
@keyframes sg-dim-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes sg-tip-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
@keyframes sg-spot-pulse {
  0%, 100% { box-shadow: 0 0 26px rgba(253,224,71,0.5); border-color: ${GOLD}; }
  50% { box-shadow: 0 0 38px rgba(253,224,71,0.75); border-color: #fff3b0; }
}
`;

const TIP_W = 300;
const TIP_EST_H = 150;

// centerTip: keep the spotlight on the target but always park the tooltip card
// in the middle of the screen (readable even when the highlighted element is
// tall enough to push an adjacent card off-screen — e.g. the arcade ladder).
// A step may override per-step with `center: true|false`.
// onStep(index, step): fired on mount and each advance, so the host can swap in
// the screen a step points at (e.g. open a modal / show the timer preview).
export default function ScreenGuide({ steps, onClose, centerTip = false, onStep }) {
  const [step, setStep] = useState(0);
  const cfg = steps[step];

  useEffect(() => { onStep?.(step, steps[step]); }, [step]); // eslint-disable-line react-hooks/exhaustive-deps
  const [rect, setRect] = useState(null);
  const scrolledRef = useRef(false);

  useEffect(() => {
    setRect(null);
    scrolledRef.current = false;
    if (!cfg?.target) return;
    let cancelled = false;
    let tries = 0;

    const measure = () => {
      if (cancelled) return;
      const el = document.querySelector(`[data-guide="${cfg.target}"]`);
      if (!el) {
        tries++;
        if (tries > 20) { setStep(s => Math.min(s + 1, steps.length - 1)); return; }
        setTimeout(measure, 100);
        return;
      }
      if (!scrolledRef.current) {
        scrolledRef.current = true;
        try { el.scrollIntoView({ block: 'center', behavior: 'instant' }); } catch { /* noop */ }
      }
      requestAnimationFrame(() => {
        if (cancelled) return;
        const r = el.getBoundingClientRect();
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      });
    };

    measure();
    const iv = setInterval(measure, 500);
    window.addEventListener('resize', measure);
    return () => { cancelled = true; clearInterval(iv); window.removeEventListener('resize', measure); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  if (!cfg) return null;

  const vw = typeof window !== 'undefined' ? window.innerWidth : 440;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 900;
  const PAD = 6;
  const hole = cfg.target && rect ? {
    top: rect.top - PAD, left: rect.left - PAD,
    width: rect.width + PAD * 2, height: rect.height + PAD * 2,
  } : null;

  // Tooltip below the spotlight, or above when the target sits low; centered
  // card for the intro step.
  const below = hole ? hole.top + hole.height + TIP_EST_H + 24 < vh - 70 : true;
  const tipTop = hole ? (below ? hole.top + hole.height + 14 : undefined) : undefined;
  const tipBottom = hole && !below ? vh - hole.top + 14 : undefined;
  const holeCx = hole ? hole.left + hole.width / 2 : vw / 2;
  const tipLeft = Math.min(Math.max(holeCx - TIP_W / 2, 12), vw - TIP_W - 12);
  const notchX = Math.min(Math.max(holeCx - tipLeft - 6, 18), TIP_W - 30);
  const isLast = step === steps.length - 1;
  // Centre the card when the step asks for it, else when there's no target or
  // the caller forces centring globally.
  const centered = cfg.center != null ? cfg.center : (centerTip || !cfg.target);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500 }} onClick={e => e.stopPropagation()}>
      <style dangerouslySetInnerHTML={{ __html: GUIDE_STYLES }} />

      {/* Dim layer (with a spotlight hole when a target is highlighted) */}
      {hole ? (
        <div style={{
          position: 'fixed', top: hole.top, left: hole.left, width: hole.width, height: hole.height,
          borderRadius: 14, boxShadow: '0 0 0 200vmax rgba(8,0,18,0.66)',
          animation: 'sg-dim-in 0.25s ease',
        }} />
      ) : (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(8,0,18,0.72)', animation: 'sg-dim-in 0.25s ease' }} />
      )}

      {/* Gold pulse ring on the highlighted element */}
      {hole && (
        <div style={{
          position: 'fixed', top: hole.top - 3, left: hole.left - 3,
          width: hole.width + 6, height: hole.height + 6,
          border: `2px solid ${GOLD}`, borderRadius: 13,
          animation: 'sg-spot-pulse 2.2s ease-in-out infinite',
          pointerEvents: 'none',
        }} />
      )}

      {/* Tooltip / intro card */}
      <div style={{
        position: 'fixed', left: centered ? '50%' : tipLeft, width: TIP_W,
        ...(centered
          ? { top: '50%', transform: 'translate(-50%, -50%)' }
          : { ...(tipTop !== undefined ? { top: tipTop } : {}), ...(tipBottom !== undefined ? { bottom: tipBottom } : {}) }),
        background: 'rgba(16,9,31,0.94)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        border: '1.5px solid rgba(253,224,71,0.5)', borderRadius: 14,
        boxShadow: '0 14px 34px rgba(0,0,0,0.55)',
        padding: '13px 14px 11px',
        animation: 'sg-tip-in 0.28s ease',
      }}>
        {hole && !centered && (
          <div style={{
            position: 'absolute', left: notchX, width: 12, height: 12,
            background: 'rgba(16,9,31,0.96)', transform: 'rotate(45deg)',
            ...(below
              ? { top: -7, borderTop: '1.5px solid rgba(253,224,71,0.5)', borderLeft: '1.5px solid rgba(253,224,71,0.5)' }
              : { bottom: -7, borderBottom: '1.5px solid rgba(253,224,71,0.5)', borderRight: '1.5px solid rgba(253,224,71,0.5)' }),
          }} />
        )}

        <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 10, color: GOLD, letterSpacing: '0.08em', lineHeight: 1.4 }}>
          {cfg.title}
        </div>
        <div style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 12, color: '#e7ddf7', lineHeight: 1.45, margin: '6px 0 12px' }}>
          {cfg.body}
        </div>

        {/* Footer: close · dots · next */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px 2px', fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 8, color: 'rgba(200,170,255,0.55)', letterSpacing: '0.1em' }}>
            CLOSE
          </button>

          <div style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: 5 }}>
            {steps.map((_, i) => (
              <span key={i} style={{
                width: i === step ? 14 : 5, height: 5, borderRadius: 99,
                background: i === step ? GOLD : 'rgba(255,255,255,0.28)',
                transition: 'width 0.25s ease',
              }} />
            ))}
          </div>

          {isLast ? (
            <button onClick={onClose} style={{
              background: 'linear-gradient(135deg,#fde047,#f59e0b)', border: 'none', cursor: 'pointer',
              borderRadius: 9, padding: '9px 14px',
              fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 9, color: '#0a0014', letterSpacing: '0.1em',
              boxShadow: '0 0 16px rgba(253,224,71,0.4)',
            }}>GOT IT ✓</button>
          ) : (
            <button onClick={() => setStep(s => s + 1)} style={{
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
