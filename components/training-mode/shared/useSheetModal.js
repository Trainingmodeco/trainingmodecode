import { useEffect, useRef } from 'react';

// A floating sheet's manners as a modal (the Mission Library, Quick
// Mission's ADJUST): focus moves into the panel when it opens and back to
// whatever opened it when it closes, however it closes; Escape closes it;
// Tab and Shift+Tab wrap inside it, never reaching the page behind; and the
// grab bar at its top closes it on a swipe down, like the Workout Map's.
//
// returnFocus: a ref to fall back on when the opener is gone or was the page
// itself (a sheet reopened after another one closed).
const FOCUSABLE = 'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
const SWIPE_PX = 60;

export default function useSheetModal(onClose, { returnFocus } = {}) {
  const panelRef = useRef(null);
  useEffect(() => {
    const opener = document.activeElement;
    const fallback = returnFocus?.current;
    panelRef.current?.focus({ preventScroll: true });
    return () => {
      const back = opener && opener !== document.body && opener.isConnected ? opener : fallback;
      if (back?.isConnected) back.focus?.({ preventScroll: true });
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const trapTab = (e) => {
    if (e.key !== 'Tab' || !panelRef.current) return;
    const els = [...panelRef.current.querySelectorAll(FOCUSABLE)].filter(el => el.getClientRects().length);
    if (!els.length) return;
    const first = els[0], last = els[els.length - 1], at = document.activeElement;
    if (e.shiftKey && (at === first || at === panelRef.current || !panelRef.current.contains(at))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (at === last || !panelRef.current.contains(at))) { e.preventDefault(); first.focus(); }
  };

  // The swipe holds the pointer (setPointerCapture), so its release always
  // arrives here even off the header, and a move with no button down ends
  // it: a later plain hover can never count as a swipe. A press on a button
  // in the header (the close X) is that button's, not a swipe: capturing it
  // would send its click to the header instead.
  const drag = useRef(null);
  const end = () => { drag.current = null; };
  const grabProps = {
    onPointerDown: (e) => {
      if ((e.pointerType === 'mouse' && e.button !== 0) || e.target.closest?.('button, a, input')) return;
      drag.current = { id: e.pointerId, y: e.clientY };
      try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch { /* the pointer is already gone */ }
    },
    onPointerMove: (e) => {
      const d = drag.current;
      if (!d || d.id !== e.pointerId) return;
      if (e.buttons === 0) { end(); return; }
      if (e.clientY - d.y > SWIPE_PX) { end(); onClose?.(); }
    },
    onPointerUp: end,
    onPointerCancel: end,
    onLostPointerCapture: end,
  };

  return { panelRef, trapTab, grabProps };
}

// The grab bar itself: decorative, so it is hidden from screen readers (the
// sheet's own close button and Escape do the same job).
export const GRAB_BAR = { width: 44, height: 4, borderRadius: 999, background: 'rgba(157,108,255,0.7)', margin: '0 auto' };
