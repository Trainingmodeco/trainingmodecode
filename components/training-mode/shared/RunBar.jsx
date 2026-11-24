import { NAV_H, fixedColumnBar } from '../Styles';
import { GhostButton } from './FitSetupKit';

// AT YOUR PACE · the run's own controls, fixed where the thumb is (owner,
// 2026-11-24: "it's too large, so I couldn't find a pause button").
//
// PAUSE / RESUME and STOP sit in a bar fixed ABOVE the tab bar, so they are on
// screen at every size, scrolled or not. The page's own top (the title, the
// clock, the round button) is a sticky head (runHead) and the moves scroll
// under it; keepInView brings the current move (or the next tick) back between
// the head and this bar whenever it changes.
//
// The bar's dark panel runs down to the tab bar, over the shelf WithNav
// (ScreenRouter) keeps there (SHELF_H: the BETA pill and the scroll chevron sit
// on it), so the page never shows through under the buttons; the buttons are in
// its top 60px, clear of the pill. It lives inside the screen's frame, so a
// modal's scrim (END MISSION?) and the sheets painted over the page still cover it.
const SHELF_H = 46; // ScreenRouter's SHELF_H
export const RUN_BAR_H = 60;
// What the page's last content keeps clear under the bar, on top of the
// scroller's own clearance for the shelf and the tab bar (ScreenRouter SCROLL_PAD).
export const RUN_BAR_CLEAR = 64;

export const RUN_CSS = `
.sr-head { --sr-btn: 64px; --sr-fin: 56px; --sr-down: 60px; }
.sr-clock { font-size: 56px; }
@media (max-height: 700px) {
  .sr-head { --sr-btn: 52px; --sr-fin: 46px; --sr-down: 48px; gap: 6px !important; padding-top: 4px !important; }
  .sr-clock { font-size: 44px !important; }
  .sr-splits, .sr-hint { display: none !important; }
  .sr-safety { padding: 6px 10px !important; font-size: 13px !important; }
}
@media (min-height: 701px) and (max-height: 800px) {
  .sr-head { --sr-btn: 58px; --sr-fin: 52px; --sr-down: 54px; gap: 8px !important; }
  .sr-clock { font-size: 50px !important; }
}
`;

// The page's top: title, clock and the buttons you tap through the run. Sticky,
// so the clock stays on screen while the moves scroll under it. It reaches the
// screen's edges (the page keeps 16px at the sides) so rows pass under it clean.
export const runHead = {
  position: 'sticky', top: 0, zIndex: 15, margin: '0 -16px', padding: '10px 16px 8px', boxSizing: 'border-box',
  display: 'flex', flexDirection: 'column', gap: 10,
  // Opaque, so a row scrolling under it never shows through; the violet glow is the frame's own at the top of the page.
  background: 'radial-gradient(ellipse at 50% 0%, rgba(130,70,200,0.2) 0%, rgba(130,70,200,0) 75%), #07000f', borderBottom: '1px solid rgba(255,255,255,0.06)',
};

export default function RunBar({ paused = false, pauseOff = false, onPause, onStop }) {
  return (
    <div data-run-bar="true" style={{
      position: 'fixed', ...fixedColumnBar, bottom: NAV_H, zIndex: 20, height: RUN_BAR_H + SHELF_H, boxSizing: 'border-box', padding: `7px 16px ${SHELF_H}px`,
      display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '46px', gap: 8,
      background: 'rgba(8,0,18,0.99)', borderTop: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 -8px 18px rgba(0,0,0,0.45)',
    }}>
      <GhostButton label={paused ? 'RESUME' : 'PAUSE'} height={46} onClick={pauseOff ? undefined : onPause}
        style={pauseOff ? { opacity: 0.45, cursor: 'default' } : { border: '1px solid rgba(242,190,69,0.45)' }}/>
      <GhostButton label="STOP" height={46} onClick={onStop} style={{ border: '1px solid rgba(239,68,68,0.5)' }}/>
    </div>
  );
}

// Brings `el` into the window between the sticky head and the bar (a row that
// changed under the clock, or the next tick): scrolls the page only when the
// row is outside it, as little as it takes.
export function keepInView(el) {
  if (!el || typeof document === 'undefined') return;
  const scroller = el.closest('.no-scrollbar');
  const head = document.querySelector('[data-run-head]');
  const bar = document.querySelector('[data-run-bar]');
  if (!scroller || !head || !bar) return;
  const top = head.getBoundingClientRect().bottom + 6;
  const bottom = bar.getBoundingClientRect().top - 6;
  const r = el.getBoundingClientRect();
  if (r.top < top) scroller.scrollBy({ top: r.top - top });
  else if (r.bottom > bottom) scroller.scrollBy({ top: Math.min(r.bottom - bottom, r.top - top) });
}
