import { useRef, useState } from 'react';

// Flick a card off the screen — either direction — to dismiss it.
//
// Horizontal only. A vertical drag is the page scrolling and has to be left
// completely alone, so the gesture watches the first few pixels and drops out
// the moment the finger commits downward. `touch-action: pan-y` tells the
// browser the same thing, so scrolling never stutters while we decide.
//
// Once it IS a swipe the element captures the pointer, which keeps move/up
// coming even when the finger leaves the card — the card is travelling, so it
// will. Capture is taken at that point and not on pointerdown, because
// capturing a touch that turns out to be a scroll would eat the scroll.
const SLOP = 8;          // px of travel before we call which gesture this is
const COMMIT = 0.3;      // fraction of the card's width that counts as "gone"
const FLY_MS = 190;      // how long the card takes to leave

export default function SwipeAway({ onDismiss, children, style, className }) {
  const [dx, setDx] = useState(0);
  const [flying, setFlying] = useState(false);
  const el = useRef(null);
  const gest = useRef(null);
  const blockClick = useRef(false);

  const onPointerDown = (e) => {
    if (flying) return;
    gest.current = {
      id: e.pointerId, x0: e.clientX, y0: e.clientY, mode: 'pending', dx: 0,
      w: el.current?.offsetWidth || 320,
    };
  };

  const onPointerMove = (e) => {
    const g = gest.current;
    if (!g || e.pointerId !== g.id) return;
    const mx = e.clientX - g.x0;
    const my = e.clientY - g.y0;
    if (g.mode === 'pending') {
      // Vertical wins → this is the page scrolling. Hands off for good.
      if (Math.abs(my) > SLOP && Math.abs(my) >= Math.abs(mx)) { gest.current = null; return; }
      if (Math.abs(mx) <= SLOP) return;
      g.mode = 'swipe';
      try { e.currentTarget.setPointerCapture(g.id); } catch { /* older engines */ }
    }
    g.dx = mx;
    setDx(mx);
  };

  const onPointerUp = (e) => {
    const g = gest.current;
    if (!g || e.pointerId !== g.id) return;
    gest.current = null;
    try { e.currentTarget.releasePointerCapture(g.id); } catch { /* not captured */ }
    if (g.mode !== 'swipe') { setDx(0); return; }
    // A swipe that grazed a button must not also fire it on release.
    blockClick.current = true;
    // Commit reads the REF, not state — the state closure trails the final
    // pointermove by one event.
    if (Math.abs(g.dx) > g.w * COMMIT) {
      setFlying(true);
      setDx(g.dx < 0 ? -g.w * 1.15 : g.w * 1.15);
      try { navigator.vibrate?.(15); } catch { /* no haptics */ }
      setTimeout(() => onDismiss?.(), FLY_MS);
    } else {
      setDx(0);
    }
  };

  const travelled = Math.abs(dx);
  const width = el.current?.offsetWidth || 320;
  // Fades as it goes, so the card reads as leaving rather than just sliding.
  const opacity = flying ? 0 : Math.max(0, 1 - travelled / (width * 0.85));
  const dragging = gest.current?.mode === 'swipe';

  return (
    <div
      ref={el}
      className={className}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClickCapture={(e) => {
        if (!blockClick.current) return;
        blockClick.current = false;
        e.stopPropagation();
        e.preventDefault();
      }}
      style={{
        ...style,
        touchAction: 'pan-y',
        transform: dx ? `translateX(${dx}px)` : 'none',
        opacity,
        transition: dragging ? 'none' : `transform ${FLY_MS}ms ease, opacity ${FLY_MS}ms ease`,
      }}
    >
      {children}
    </div>
  );
}
