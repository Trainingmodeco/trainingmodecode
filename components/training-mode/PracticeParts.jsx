import { useState, useEffect, useRef, useCallback } from 'react';

// Small pieces the Practice screens share: the Ladder (PracticeMode.jsx), the
// move card (PracticeMoveCard.jsx) and the drill (PracticeRound.jsx).

export const GOLD = '#F2BE45';
export const SOFT = '#A9B4D6';
export const GREEN = '#4ADE80';
export const GOLD_FILL = 'linear-gradient(180deg,#FFE9A8 0%,#F2BE45 50%,#C98A1C 100%)';
export const PLATE = 'repeating-linear-gradient(135deg, #1A1030 0 16px, #150C28 16px 32px)';
export const label = { font: "700 10px 'Chakra Petch',sans-serif", letterSpacing: '0.16em', color: SOFT };

// The hover, focus and press looks of the Ladder and the move card.
export const practiceCSS = `
.pm-hit { transition: border-color .18s ease, color .18s ease, box-shadow .18s ease, filter .18s ease; }
.pm-row { transition: border-color .18s ease, box-shadow .18s ease; }
.pm-hit:focus-visible { border-color: ${GOLD} !important; }
.pm-txt:focus-visible, .pp-pill:focus-visible { color: ${GOLD} !important; }
.pm-row:focus-visible { box-shadow: 0 0 14px rgba(61,123,255,.55); }
.pm-gold:focus-visible { filter: brightness(1.1); }
/* Only where there is a pointer to hover with: on a phone the last row tapped would stay lit. A row's gold border
   means UP NEXT, so a hovered row glows blue instead. */
@media (hover: hover) {
  .pm-hit:hover { border-color: ${GOLD} !important; }
  .pm-txt:hover, .pp-pill:hover { color: ${GOLD} !important; }
  .pm-row:hover { box-shadow: 0 0 14px rgba(61,123,255,.55); }
  .pm-gold:hover { filter: brightness(1.1); }
}
.pm-hit:active, .pm-row:active, .pm-gold:active { transform: scale(0.98); }
.pm-scroll { scrollbar-width: thin; scrollbar-color: rgba(143,180,255,.35) transparent; }
.pm-panel:focus { outline: none; }
@keyframes pm-cue-glow { 0%, 100% { box-shadow: 0 0 10px rgba(242,190,69,0.3) } 50% { box-shadow: 0 0 20px rgba(242,190,69,0.55) } }
@media (prefers-reduced-motion: reduce) { .pm-hit:active, .pm-row:active, .pm-gold:active { transform: none; } }
`;

// "3 · Lead Hook" for a punch with a gym number, else the name alone.
export const moveLabel = (move) => `${move.num ? `${move.num} · ` : ''}${move.name}`;

export const prefersReducedMotion = () => {
  try { return !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

export const Play = ({ size = 11, style }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: size, height: size, fill: 'currentColor', flexShrink: 0, ...style }}><path d="M7 4l13 8-13 8z"/></svg>
);
const Bars = ({ size = 11 }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: size, height: size, fill: 'currentColor', flexShrink: 0 }}><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>
);

// The three steps of learning a move. `at` is the step the athlete is on:
// 'watch' on the move card, 'drill' in the drill. A step behind it is ticked,
// and all three are ticked once the move is learned. `watched` is false for a
// TEST OUT drill, which has no video to watch.
const STEPS = [['watch', '1 WATCH'], ['drill', '2 DRILL'], ['learned', '3 LEARNED']];
export function StepChips({ at = 'watch', learned = false, watched = true, style }) {
  const here = STEPS.findIndex(([key]) => key === at);
  return (
    <div data-testid="pm-steps" role="list" aria-label="Steps" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 5, flexShrink: 0, ...style }}>
      {STEPS.map(([key, text], i) => {
        const done = learned || (i < here && (key !== 'watch' || watched));
        const on = !done && i === here;
        const color = done ? GREEN : on ? GOLD : '#7E88AC';
        return (
          <span key={key} role="listitem" data-step={key} data-state={done ? 'done' : on ? 'on' : 'off'} style={{
            height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: 6, boxSizing: 'border-box',
            border: `1px solid ${done ? 'rgba(74,222,128,.5)' : on ? GOLD : 'rgba(143,180,255,.22)'}`,
            background: on ? 'rgba(242,190,69,.1)' : 'transparent', color,
            font: "700 10px 'Chakra Petch',sans-serif", letterSpacing: '0.1em', whiteSpace: 'nowrap',
          }}>{text}{done ? ' ✓' : ''}</span>
        );
      })}
    </div>
  );
}

// The plate of a move with no video. It says so: no play button.
export function GuidePlate({ sub, style }) {
  return (
    <div data-testid="pm-guide" style={{
      aspectRatio: '16 / 9', flexShrink: 0, background: PLATE, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 5, padding: '0 16px', textAlign: 'center', boxSizing: 'border-box', ...style,
    }}>
      <span style={{ font: "700 12px 'Chakra Petch',sans-serif", letterSpacing: '0.18em', color: '#C4A8FF' }}>GUIDE · VIDEO COMING</span>
      {sub && <span style={{ fontSize: 12, color: SOFT }}>{sub}</span>}
    </div>
  );
}

// A move's watch video: muted, looping, started as soon as it is on screen.
// One visible control pauses and plays it. With "reduce motion" on it does not
// start by itself: the poster shows, and the control plays it.
//   watch   { src, poster, kind } from data/practiceMoves watchFor
//   active  false while something covers it (a card, the drill): it waits
export function LoopVideo({ watch, title, active = true, style }) {
  const ref = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  // What the athlete wants: true until they pause it.
  const wants = useRef(!prefersReducedMotion());
  const seen = useRef(true);
  const live = useRef(active);

  const sync = useCallback(() => {
    const v = ref.current;
    if (!v) return;
    if (live.current && seen.current && wants.current) v.play().catch(() => { /* the control plays it */ });
    else v.pause();
  }, []);

  useEffect(() => { live.current = active; sync(); }, [active, sync]);

  // A new video starts clean.
  useEffect(() => {
    setFailed(false);
    setPlaying(false);
    wants.current = !prefersReducedMotion();
    sync();
  }, [watch.src, sync]);

  // Scrolled out of view, it stops; back in view, it carries on.
  useEffect(() => {
    const v = ref.current;
    if (!v || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([entry]) => { seen.current = entry.isIntersecting; sync(); }, { threshold: 0.2 });
    io.observe(v);
    return () => io.disconnect();
  }, [sync, failed]);

  useEffect(() => {
    const v = ref.current;
    return () => { v?.pause(); };
  }, [failed]);

  const toggle = () => { wants.current = !playing; sync(); };

  if (failed) return <GuidePlate sub="This video can’t play right now." style={style}/>;
  return (
    <div data-testid="pm-video" data-playing={playing ? 'true' : 'false'} style={{ position: 'relative', aspectRatio: '16 / 9', flexShrink: 0, background: '#000', overflow: 'hidden', ...style }}>
      <video
        ref={ref} src={watch.src} poster={watch.poster || undefined}
        muted loop playsInline preload={wants.current ? 'auto' : 'metadata'}
        aria-label={`${title} video`}
        onPlaying={() => setPlaying(true)} onPause={() => setPlaying(false)} onError={() => setFailed(true)}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', background: '#000' }}
      />
      <button type="button" className="pp-pill" aria-label={playing ? `Pause the ${title} video` : `Play the ${title} video`} onClick={toggle} style={{
        position: 'absolute', left: 8, bottom: 8, height: 36, minWidth: 84, padding: '0 12px', borderRadius: 18, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'rgba(7,10,24,.78)', border: '1px solid rgba(255,255,255,.4)', color: '#fff',
        font: "700 10px 'Chakra Petch',sans-serif", letterSpacing: '0.12em',
      }}>{playing ? <Bars/> : <Play/>}{playing ? 'PAUSE' : 'PLAY'}</button>
    </div>
  );
}

// A row's small picture: the poster of the move's video, or a quiet GUIDE
// tile. A poster that will not load leaves the tile, never a broken image.
export function Thumb({ watch }) {
  const [ok, setOk] = useState(true);
  const src = watch && watch.poster;
  useEffect(() => { setOk(true); }, [src]);
  const box = { width: 58, height: 44, borderRadius: 6, flexShrink: 0, overflow: 'hidden', background: '#121837' };
  if (!src || !ok) {
    return (
      <span aria-hidden="true" style={{ ...box, display: 'flex', alignItems: 'center', justifyContent: 'center', font: "700 8px 'Chakra Petch',sans-serif", letterSpacing: '0.1em', color: '#7E88AC' }}>GUIDE</span>
    );
  }
  // A tutorial's poster has its title panel on the right (the athlete is in
  // the left ~42%): enlarge it from the left edge so only the athlete shows.
  const tutorial = watch.kind === 'tutorial';
  return (
    <span aria-hidden="true" style={{ ...box, position: 'relative' }}>
      <img src={src} alt="" loading="lazy" decoding="async" onError={() => setOk(false)} style={tutorial
        ? { position: 'absolute', left: 0, top: '50%', width: '240%', height: 'auto', transform: 'translateY(-50%)', display: 'block' }
        : { width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block' }}/>
    </span>
  );
}
