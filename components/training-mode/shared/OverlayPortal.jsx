import { createPortal } from 'react-dom';

// Renders an overlay into document.body instead of leaving it where it was
// declared.
//
// Why any full-screen overlay in this app needs it: PhoneFrame sets
// `isolation: isolate`, which opens a stacking context. Every z-index inside
// the frame is therefore ranked only against its siblings *within* the frame —
// `z-index: 9999` on an overlay does not outrank anything outside it. The
// BottomNav in ScreenRouter is a sibling of the frame at z-index 100, so it
// paints over any in-frame overlay, always, and the tab bar's ~58px + safe-area
// band swallows whatever sits at the overlay's bottom edge. That is normally
// the primary action, so the overlay looks fine and its button is dead.
//
// Portalling to document.body puts the overlay outside the frame entirely, so
// its z-index competes with the nav on equal terms and wins.
//
// Use OVERLAY_Z for the z-index so every overlay agrees on one number that
// beats the nav.

export const OVERLAY_Z = 1000;

export default function OverlayPortal({ children }) {
  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}
