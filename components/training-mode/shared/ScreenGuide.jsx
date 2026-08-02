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

// The app renders in a centred column (PhoneFrame maxWidth 440). Bubbles must
// be clamped to THAT, not to the window — clamping to window.innerWidth let
// them hang outside the frame border on any screen wider than the column.
const APP_COL_W = 440;
const TIP_MAX_W = 300;
const EDGE = 12;
const NAV_RESERVE = 70;   // fixed bottom nav
const TIP_EST_H = 150;    // first-paint estimate; replaced by a real measurement

// centerTip: keep the spotlight on the target but always park the tooltip card
// in the middle of the screen (readable even when the highlighted element is
// tall enough to push an adjacent card off-screen — e.g. the arcade ladder).
// A step may override per-step with `center: true|false`.
// onStep(index, step): fired on mount and each advance, so the host can swap in
// the screen a step points at (e.g. open a modal / show the timer preview).
export default function ScreenGuide({ steps, onClose, centerTip = false, onStep }) {
  const [step, setStep] = useState(0);
  const cfg = steps[step];
  // Which way the athlete is travelling. The missing-target fallback below
  // skips in THIS direction: without it, stepping BACK onto a step whose
  // target isn't on screen would auto-advance forward again, and BACK would
  // look broken exactly where it is most needed.
  const dirRef = useRef(1);
  const go = (d) => {
    dirRef.current = d;
    setStep((s) => Math.min(steps.length - 1, Math.max(0, s + d)));
  };

  useEffect(() => { onStep?.(step, steps[step]); }, [step]); // eslint-disable-line react-hooks/exhaustive-deps
  const [rect, setRect] = useState(null);
  const scrolledRef = useRef(false);
  // Real rendered height of the bubble. The old fixed 150px estimate was wrong
  // the moment a step's copy ran long, which pushed tall cards off-screen.
  const tipRef = useRef(null);
  const [tipH, setTipH] = useState(TIP_EST_H);
  useEffect(() => {
    const el = tipRef.current;
    if (!el) return undefined;
    const read = () => setTipH(el.getBoundingClientRect().height || TIP_EST_H);
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [step]);

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
        // 6s before giving up: cross-screen steps land on lazy-loaded screens
        // (Arcade, the stage ladder) that show LOADING… while their chunk
        // fetches — a 2s budget skipped those steps on slow connections.
        if (tries > 60) { setStep(s => Math.min(steps.length - 1, Math.max(0, s + dirRef.current))); return; }
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

  // The centred app column — every bubble is clamped inside this, never to the
  // raw window, so it can't spill past the phone frame's border.
  const colW = Math.min(vw, APP_COL_W);
  const colLeft = (vw - colW) / 2;
  const TIP_W = Math.min(TIP_MAX_W, colW - EDGE * 2);

  // Tooltip below the spotlight, or above when the target sits low; centered
  // card for the intro step. Uses the MEASURED height, so long copy is placed
  // as accurately as short copy.
  const NEED = tipH + 24;
  const roomBelow = hole ? (vh - NAV_RESERVE) - (hole.top + hole.height) : Infinity;
  const roomAbove = hole ? hole.top : Infinity;
  const below = roomBelow >= NEED;
  // A target too tall to fit a card above OR below → centre the card over it so
  // it never clips off-screen (e.g. the full-height arcade carousel / ladder).
  const forceCenter = hole ? (!below && roomAbove < NEED) : false;
  const centered = cfg.center != null ? cfg.center : (centerTip || !cfg.target || forceCenter);
  const holeCx = hole ? hole.left + hole.width / 2 : vw / 2;
  const tipLeft = Math.min(
    Math.max(holeCx - TIP_W / 2, colLeft + EDGE),
    colLeft + colW - TIP_W - EDGE,
  );
  const notchX = Math.min(Math.max(holeCx - tipLeft - 6, 18), TIP_W - 30);
  // Vertical clamp too: keep the whole card between the top edge and the nav.
  const rawTop = hole ? hole.top + hole.height + 14 : 0;
  const maxTop = Math.max(EDGE, vh - NAV_RESERVE - tipH);
  const tipTop = (hole && !centered && below) ? Math.min(rawTop, maxTop) : undefined;
  const rawBottom = hole ? vh - hole.top + 14 : 0;
  const maxBottom = Math.max(EDGE, vh - EDGE - tipH);
  const tipBottom = (hole && !centered && !below) ? Math.min(rawBottom, maxBottom) : undefined;
  const isLast = step === steps.length - 1;

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
      <div ref={tipRef} style={{
        position: 'fixed', width: TIP_W,
        // Centred cards centre on the APP COLUMN, not the window, so they line
        // up with the frame on desktop instead of drifting off it.
        left: centered ? colLeft + (colW - TIP_W) / 2 : tipLeft,
        ...(centered
          ? { top: Math.max(EDGE, (vh - tipH) / 2) }
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

        {/* Footer: close · back · dots · next */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px 2px', fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 8, color: 'rgba(200,170,255,0.55)', letterSpacing: '0.1em' }}>
            CLOSE
          </button>

          {/* Re-read the previous step without losing the guide. Hidden on the
              first step, where there is nothing behind it. */}
          {step > 0 && (
            <button onClick={() => go(-1)} style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: '6px 2px',
              fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 8,
              color: GOLD, opacity: 0.9, letterSpacing: '0.1em',
            }}>‹ BACK</button>
          )}

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
            <button onClick={() => go(1)} style={{
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
