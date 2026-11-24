import { Pause, Play, Square } from 'lucide-react';
import { NAV_H, fixedColumnBar } from '../Styles';
import TrainingCTA from './TrainingCTA';
import BrandBg from '../BrandBg';

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
//
// The buttons are raised and bright (owner, 2026-11-24: "the pause and the stop
// buttons look very flat"): TrainingCTA's skins with the 2.5D lip, PAUSE violet,
// RESUME gold (it pulses, like the other timers' resume), STOP red.
const SHELF_H = 46; // ScreenRouter's SHELF_H
export const RUN_BAR_H = 70;
// What the page's last content keeps clear under the bar, on top of the
// scroller's own clearance for the shelf and the tab bar (ScreenRouter SCROLL_PAD).
export const RUN_BAR_CLEAR = 74;

export const RUN_CSS = `
.sr-head { --sr-btn: 60px; --sr-fin: 56px; --sr-down: 56px; --sr-ring: 150px; --sr-name: 27px; --sr-dose: 30px; }
.sr-hero { display: grid; grid-template-columns: var(--sr-ring) minmax(0, 1fr); gap: 14px; align-items: center; position: relative; }
.sr-ringbox { position: relative; width: var(--sr-ring); height: var(--sr-ring); }
.sr-time { font-size: calc(var(--sr-ring) * 0.235); }
.sr-name { font-size: var(--sr-name); }
.sr-dose { font-size: var(--sr-dose); }
.sr-arc { transition: stroke-dashoffset .25s linear, stroke .3s ease; }
@media (max-height: 700px) {
  .sr-head { --sr-btn: 50px; --sr-fin: 46px; --sr-down: 46px; --sr-ring: 116px; --sr-name: 22px; --sr-dose: 24px; gap: 6px !important; padding-top: 2px !important; }
  .sr-sub2 { display: none !important; }
  .sr-safety { padding: 6px 10px !important; font-size: 13px !important; }
}
@media (min-height: 701px) and (max-height: 800px) {
  .sr-head { --sr-btn: 56px; --sr-fin: 50px; --sr-down: 50px; --sr-ring: 136px; --sr-name: 25px; --sr-dose: 27px; gap: 8px !important; }
}
@media (min-height: 900px) {
  .sr-head { --sr-ring: 166px; --sr-name: 29px; --sr-dose: 32px; }
}
@media (max-width: 340px) {
  .sr-head { --sr-ring: 104px; --sr-name: 20px; --sr-dose: 22px; }
}
/* 320x568 and other short, narrow phones: a smaller ring and a tighter safety line so the first move clears the bar. */
@media (max-height: 600px) {
  .sr-head { --sr-btn: 46px; --sr-fin: 44px; --sr-down: 44px; --sr-ring: 96px; --sr-name: 20px; --sr-dose: 21px; }
  .sr-safety { padding: 4px 8px !important; font-size: 12px !important; line-height: 1.25 !important; }
}
@media (prefers-reduced-motion: reduce) {
  .sr-head *, [data-run-bar] *, [data-run-list] * { animation: none !important; transition: none !important; }
}
`;

// The page's top: title, clock and the buttons you tap through the run. Sticky,
// so the clock stays on screen while the moves scroll under it. It reaches the
// screen's edges (the page keeps 16px at the sides) so rows pass under it clean.
export const runHead = {
  position: 'sticky', top: 0, zIndex: 15, margin: '0 -16px', padding: '10px 16px 8px', boxSizing: 'border-box',
  display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden',
  // Opaque, so a row scrolling under it never shows through. RunBackdrop paints
  // the Training Mode T into it (the frame's own T is under this opaque head).
  background: '#07000f', borderBottom: '1px solid rgba(242,190,69,0.18)', boxShadow: '0 8px 18px rgba(0,0,0,0.35)',
};

// The head's backdrop (owner, 2026-11-24: "the background should definitely have
// the Training Mode T", "maybe a lightning bolt in there, since it's a quick
// mission"): the brand picture laid exactly where the frame draws it (one
// screen tall, from the top), brighter than the frame's 20 %, a wash in the
// phase's colour (RunRing draws the lightning bolt behind the ring). Put it
// first in the head; everything after it sits above (position: relative).
export function RunBackdrop({ tint = '#F2BE45' }) {
  return (
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '100vh', background: `url('${BrandBg}') center/cover no-repeat`, opacity: 0.5 }}/>
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 60% 70% at 24% 62%, ${tint}2e 0%, ${tint}00 70%), linear-gradient(180deg, rgba(7,0,15,0.25) 0%, rgba(7,0,15,0.55) 100%)`, transition: 'background .4s ease' }}/>
    </div>
  );
}

// The Training Mode T, large and glowing, behind the moves (the frame's own T
// is faint and mostly under the head): fixed to the screen, under the rows.
// Put it first inside the page's content box (a stacking context: z-index -1
// keeps it under the rows and the head).
export function RunWatermark() {
  return (
    <div aria-hidden="true" style={{ position: 'fixed', ...fixedColumnBar, top: 0, bottom: 0, zIndex: -1, pointerEvents: 'none', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', left: '50%', top: '62%', width: 'min(76%, 320px)', aspectRatio: '1 / 1', transform: 'translate(-50%, -50%)',
        background: "url('/static/brand/tm-logo-violet.webp') center/contain no-repeat", opacity: 0.36, filter: 'drop-shadow(0 0 24px rgba(168,85,247,0.8))',
      }}/>
    </div>
  );
}

export default function RunBar({ paused = false, pauseOff = false, onPause, onStop }) {
  const big = { fontSize: 17, letterSpacing: '0.16em', borderRadius: 14 };
  return (
    <div data-run-bar="true" style={{
      position: 'fixed', ...fixedColumnBar, bottom: NAV_H, zIndex: 20, height: RUN_BAR_H + SHELF_H, boxSizing: 'border-box', padding: `8px 16px ${SHELF_H}px`,
      display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '54px', gap: 12,
      background: 'linear-gradient(180deg, rgba(20,6,38,0.99) 0%, rgba(8,0,18,0.99) 60%)', borderTop: '1px solid rgba(242,190,69,0.22)', boxShadow: '0 -8px 18px rgba(0,0,0,0.45)',
    }}>
      {/* PAUSE is violet; RESUME turns gold and pulses, so a paused run is plain to see. */}
      <TrainingCTA label={paused ? 'RESUME' : 'PAUSE'} variant={paused ? 'gold' : 'violet'} depth={!paused} height={54} disabled={pauseOff}
        icon={paused ? <Play size={18} fill="currentColor" strokeWidth={0}/> : <Pause size={18} fill="currentColor" strokeWidth={0}/>}
        onClick={pauseOff ? undefined : onPause} style={big}/>
      <TrainingCTA label="STOP" variant="red" depth height={54} icon={<Square size={15} fill="currentColor" strokeWidth={0}/>} onClick={onStop} style={big}/>
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

// The same bar with one big button (WORKOUTS' START before the run), so the
// button sits exactly where PAUSE / STOP will be.
export function RunStartBar({ children }) {
  return (
    <div data-run-bar="true" style={{
      position: 'fixed', ...fixedColumnBar, bottom: NAV_H, zIndex: 20, height: RUN_BAR_H + SHELF_H, boxSizing: 'border-box', padding: `8px 16px ${SHELF_H}px`,
      display: 'grid', gridTemplateColumns: '1fr', gridTemplateRows: '54px',
      background: 'linear-gradient(180deg, rgba(20,6,38,0.99) 0%, rgba(8,0,18,0.99) 60%)', borderTop: '1px solid rgba(242,190,69,0.22)', boxShadow: '0 -8px 18px rgba(0,0,0,0.45)',
    }}>{children}</div>
  );
}
