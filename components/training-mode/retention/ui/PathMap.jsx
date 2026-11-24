import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import StarsRow from './StarsRow';
import { pathLayout, pathLabelLeft, PATH_SIZE, PATH_LABEL_GAP } from '../../data/pathStars';
import { ARC, RETENTION_CSS } from './tokens';

// The path (retention feature 2), one component for the Arcade sagas and
// Training Camp: a winding road of nodes that scrolls, climbing from the first
// node at the bottom to the boss at the top, and opens on the current node.
// Cleared nodes show their stars (or a check where there is no star rule), the
// current one pulses with START, locked ones wait. Node positions come from
// the real width of the box it is drawn in. A tap calls onPick(node, index):
// the screen decides what happens (its own pop-up, the replay sheet, its own
// locked hint), so every start rule stays where it is.
//
//   nodes: [{ id, number, state: 'cleared'|'current'|'locked', boss, stars, max, check,
//             pips?: { s1, s2 }, guide?, pipsGuide? }]   (data/pathStars sagaPath / campPath;
//             guide / pipsGuide: the screen guide's data-guide on the node / its pips)
//   unit:  the word on the current node ('STAGE' | 'LEVEL'); bossLabel: 'BOSS' | 'TITLE'
//   nodeClass: a class on each node's button (the saga keeps its ladder's
//          `ladder-node`, so what finds a stage node still finds it)
//   climb: on open, the road glides up from the first node to the one it opens
//          on (once; never with reduced motion), and onClimb() is called as it
//          starts (the camp plays its climb sound there)
//   reveal: { index, room } keeps node `index` (with its stars or pips) whole
//          above the bottom `room` px of the box, where a sheet covers it (the
//          camp's replay sheet): the road gets that much more room below and
//          scrolls the node up into view

const SIZE = PATH_SIZE;
const FADE = 'linear-gradient(to bottom, transparent 0, #000 22px, #000 calc(100% - 22px), transparent 100%)';
const FADE_PX = 22;
const CLIMB_MS = 900;       // the glide up to the current node
const CLIMB_MIN = 60;       // shorter than this, the road just opens there
const REVEAL_PAD = 10;      // clear room around a revealed node
const reducedMotion = () => {
  try { return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

// The label under a node (its stars or its pips) sits on one solid backdrop.
const LABEL_BG = '#0d0418';
// Its size before it is measured: what the stars or the pips take, rounded up.
const labelGuess = (node, stars) => ({
  w: Math.max(node.pips ? 86 : 0, stars ? node.max * 13 + (node.max - 1) * 2 + 12 : 0),
  h: (node.pips ? 21 : 0) + (stars ? 19 : 0) + (node.pips && stars ? 3 : 0),
});

// The camp's S1/S2 pips: 9 px, the check a size up, and a locked level's pips
// on a light border so they read on the busy art.
function Pips({ pips, state }) {
  const pip = (label, done, next) => (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      font: `800 9px ${ARC.head}`, letterSpacing: '0.02em', lineHeight: 1, borderRadius: 5, padding: '3px 6px', whiteSpace: 'nowrap',
      color: done ? '#4ade80' : next ? ARC.gold : '#d6cbef',
      background: done ? '#0b2416' : next ? '#2a2208' : LABEL_BG,
      border: `1px solid ${done ? 'rgba(74,222,128,0.6)' : next ? 'rgba(253,224,71,0.6)' : 'rgba(214,203,239,0.5)'}`,
    }}>{label}{done && <span aria-hidden style={{ fontSize: 10, lineHeight: 1 }}>✓</span>}</span>
  );
  const cur = state === 'current';
  return (
    <span style={{ display: 'inline-flex', gap: 4 }}>
      {pip('S1', pips.s1, cur && !pips.s1)}
      {pip('S2', pips.s2, cur && pips.s1 && !pips.s2)}
    </span>
  );
}

function NodeFace({ node, unit, bossLabel }) {
  const { state, boss, number } = node;
  if (state === 'current') {
    return (
      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <span style={{ font: `800 8.5px ${ARC.head}`, letterSpacing: '0.06em', color: ARC.muted, whiteSpace: 'nowrap' }}>{boss ? `👑 ${bossLabel}` : `${unit} ${number}`}</span>
        <span style={{
          font: `900 13px ${ARC.head}`, letterSpacing: '0.05em', background: ARC.goldGradient,
          WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent', color: 'transparent',
        }}>START</span>
      </span>
    );
  }
  if (boss) {
    return (
      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
        <span style={{ fontSize: 20, lineHeight: 1, filter: state === 'locked' ? 'grayscale(0.6) brightness(0.7)' : 'none' }}>👑</span>
        <span style={{ font: `900 9px ${ARC.head}`, letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>{bossLabel}</span>
      </span>
    );
  }
  if (state === 'locked') {
    return (
      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
        <span style={{ fontSize: 13, lineHeight: 1, opacity: 0.75 }}>🔒</span>
        <span style={{ font: `800 10px ${ARC.head}` }}>{number}</span>
      </span>
    );
  }
  return <span style={{ font: `900 17px ${ARC.head}` }}>{number}</span>;
}

// The hint for a locked node (`hint: { index, text }`, the screen's own words):
// it hangs under the node that was tapped, in the room before the node below,
// or over it when that room is short, so it never covers another node.
const HINT_GAP = 5;
function hintTop(pts, i, size, sizeOf, h, height) {
  const p = pts[i];
  const below = pts[i - 1] ? pts[i - 1].y - sizeOf(i - 1) / 2 : height;
  const above = pts[i + 1] ? pts[i + 1].y + sizeOf(i + 1) / 2 : 0;
  const under = p.y + size / 2 + HINT_GAP;
  const over = p.y - size / 2 - HINT_GAP - h;
  if (under + h <= below - 2) return under;
  if (over >= above + 2) return over;
  return under;
}

export default function PathMap({ nodes = [], onPick, unit = 'STAGE', bossLabel = 'BOSS', focus, dim = false, nodeClass, hint = null, climb = false, onClimb, reveal = null, style }) {
  const boxRef = useRef(null);
  const [width, setWidth] = useState(0);
  const scrolled = useRef(false);
  // The glide under way (climb), stopped by a touch, a reveal or unmount.
  const glideRef = useRef(null);
  const stopGlide = () => { const g = glideRef.current; if (g) { cancelAnimationFrame(g.raf); clearTimeout(g.safety); glideRef.current = null; } };
  useEffect(() => stopGlide, []);
  // Each label's real size (fonts differ by phone), so it can hang clear of
  // the road (pathLabelLeft). Measured before paint, again once fonts load.
  const labelEls = useRef([]);
  const [labelSize, setLabelSize] = useState({});
  const [fontsReady, setFontsReady] = useState(0);
  useLayoutEffect(() => {
    const next = {};
    labelEls.current.forEach((el, i) => { if (el) next[i] = { w: el.offsetWidth, h: el.offsetHeight }; });
    setLabelSize((prev) => {
      const keys = Object.keys(next);
      const same = keys.length === Object.keys(prev).length && keys.every((k) => prev[k] && prev[k].w === next[k].w && prev[k].h === next[k].h);
      return same ? prev : next;
    });
  }, [nodes, width, fontsReady]);
  // The locked hint's real size, for where it hangs.
  const hintEl = useRef(null);
  const [hintSize, setHintSize] = useState(null);
  useLayoutEffect(() => {
    const el = hintEl.current;
    const next = el ? { w: el.offsetWidth, h: el.offsetHeight } : null;
    setHintSize((prev) => (prev && next && prev.w === next.w && prev.h === next.h) || (!prev && !next) ? prev : next);
  }, [hint?.index, hint?.text, width, fontsReady]);
  useEffect(() => {
    let alive = true;
    document.fonts?.ready?.then(() => { if (alive) setFontsReady((n) => n + 1); });
    return () => { alive = false; };
  }, []);

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return undefined;
    const measure = () => setWidth(el.clientWidth);
    measure();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const { height, pts } = pathLayout(nodes.length, width);
  const cur = nodes.findIndex((n) => n.state === 'current');
  // The node it opens on: the one asked for, else the current one, else the
  // last cleared (a saga all cleared, or one waiting on a gate).
  let lastCleared = -1;
  nodes.forEach((n, i) => { if (n.state === 'cleared') lastCleared = i; });
  const at = Number.isInteger(focus) && focus >= 0 ? focus : cur >= 0 ? cur : Math.max(0, lastCleared);

  // Opens scrolled to that node, once its width is known. With `climb`, the
  // road first shows its foot and glides up to it (ease-out), once.
  useEffect(() => {
    const el = boxRef.current;
    if (!el || !width || scrolled.current || !pts[at]) return;
    scrolled.current = true;
    const target = Math.min(Math.max(0, pts[at].y - el.clientHeight / 2), Math.max(0, el.scrollHeight - el.clientHeight));
    const foot = Math.max(0, el.scrollHeight - el.clientHeight);
    if (!climb || reducedMotion() || foot - target < CLIMB_MIN || typeof requestAnimationFrame !== 'function') {
      el.scrollTop = target;
      return;
    }
    el.scrollTop = foot;
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const g = { raf: 0, safety: 0 };
    const step = (t) => {
      const k = Math.min(1, Math.max(0, (t - t0) / CLIMB_MS));
      el.scrollTop = foot + (target - foot) * (1 - (1 - k) ** 3);
      if (k < 1) g.raf = requestAnimationFrame(step);
      else stopGlide();
    };
    g.raf = requestAnimationFrame(step);
    // A frame clock that stalls (a tab in the background) still lands there.
    g.safety = setTimeout(() => { if (glideRef.current === g) { el.scrollTop = target; stopGlide(); } }, CLIMB_MS + 600);
    glideRef.current = g;
    const stop = () => stopGlide();
    el.addEventListener('touchstart', stop, { passive: true, once: true });
    el.addEventListener('wheel', stop, { passive: true, once: true });
    onClimb?.();
  }, [width, at, pts]); // eslint-disable-line react-hooks/exhaustive-deps

  // The road: dashed ahead, gold up to the current node (or the last cleared).
  const reach = cur >= 0 ? cur : lastCleared;
  const line = (list) => list.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const sizeOf = (i) => (nodes[i]?.boss ? SIZE.boss : nodes[i]?.state === 'current' ? SIZE.current : SIZE.node);
  const hintAt = hint && Number.isInteger(hint.index) && pts[hint.index] ? hint.index : -1;

  // A revealed node (under a sheet): its whole node and label above the
  // covered part, its top clear of the box's top fade; the road gets the
  // covered room below it so the first node can rise that far too.
  const revealAt = reveal && Number.isInteger(reveal.index) && pts[reveal.index] ? reveal.index : -1;
  const room = revealAt >= 0 ? Math.max(0, Math.round(Number(reveal.room) || 0)) : 0;
  const revealLabelH = revealAt >= 0 ? (labelSize[revealAt]?.h || 0) : 0;
  useEffect(() => {
    const el = boxRef.current;
    if (!el || revealAt < 0 || !width) return;
    stopGlide();
    const p = pts[revealAt];
    const size = sizeOf(revealAt);
    const top = p.y - size / 2 - REVEAL_PAD;
    const bottom = p.y + size / 2 + (revealLabelH ? PATH_LABEL_GAP + revealLabelH : 0) + REVEAL_PAD;
    const visible = el.clientHeight - room;
    let t = bottom - visible;
    if (top - t < FADE_PX) t = top - FADE_PX;
    t = Math.max(0, Math.min(t, el.scrollHeight - el.clientHeight));
    if (Math.abs(el.scrollTop - t) < 2) return;
    if (reducedMotion() || typeof el.scrollTo !== 'function') el.scrollTop = t;
    else el.scrollTo({ top: t, behavior: 'smooth' });
  }, [revealAt, room, revealLabelH, width]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={boxRef} data-retention="path-map" className="no-scrollbar rt-anim" style={{
      position: 'absolute', inset: 0, overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch',
      // The road fades out at the box's edges rather than being cut there.
      WebkitMaskImage: FADE, maskImage: FADE, ...style,
    }}>
      <style dangerouslySetInnerHTML={{ __html: RETENTION_CSS }}/>
      {width > 0 && (
        <div style={{ position: 'relative', width: '100%', height: height + room, filter: dim ? 'brightness(0.45)' : 'none', transition: 'filter .2s ease' }}>
          <svg width={width} height={height} aria-hidden style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}>
            <polyline points={line(pts)} fill="none" stroke="rgba(168,85,247,0.32)" strokeWidth="6" strokeDasharray="2 12" strokeLinecap="round"/>
            {reach > 0 && <polyline points={line(pts.slice(0, reach + 1))} fill="none" stroke="rgba(253,224,71,0.7)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>}
          </svg>
          {/* Top of the screen first: the boss leads the DOM (and the tab
              order), the first node comes last, as on the ladder. */}
          {nodes.map((node, i) => [node, i]).reverse().map(([node, i]) => {
            const { x, y } = pts[i];
            const size = node.boss ? SIZE.boss : node.state === 'current' ? SIZE.current : SIZE.node;
            const cleared = node.state === 'cleared';
            const look = node.state === 'current'
              ? { background: 'radial-gradient(circle at 50% 35%, #3b1670, #14052a)', border: `2px solid ${ARC.goldBright}`, color: ARC.text, animation: 'rt-pulse 1.8s infinite' }
              : cleared
                ? { background: 'radial-gradient(circle at 50% 35%, rgba(70,52,8,0.95), rgba(14,8,2,0.95))', border: '2px solid rgba(253,224,71,0.65)', color: ARC.gold }
                : node.boss
                  ? { background: 'rgba(20,12,2,0.9)', border: '2px solid rgba(253,224,71,0.35)', color: 'rgba(253,224,71,0.6)' }
                  : { background: 'rgba(10,0,20,0.9)', border: '1.5px solid rgba(168,85,247,0.3)', color: 'rgba(196,164,216,0.6)' };
            const what = node.state === 'current' ? 'start' : cleared ? (node.stars != null && node.max ? `cleared, ${node.stars} of ${node.max} stars` : 'cleared') : 'locked';
            const name = node.boss ? `${bossLabel === 'BOSS' ? 'Boss stage' : 'Title fight'} ${node.number}` : `${unit === 'LEVEL' ? 'Level' : 'Stage'} ${node.number}`;
            const under = cleared && node.stars != null && node.max > 0;
            const labelled = under || !!node.pips;
            const box = labelled ? labelSize[i] || labelGuess(node, under) : null;
            const labelTop = size / 2 + PATH_LABEL_GAP;
            return (
              <div key={node.id || i}>
                {node.state === 'current' && (
                  <span aria-hidden style={{ position: 'absolute', left: x - size / 2, top: y - size / 2, width: size, height: size, borderRadius: node.boss ? 18 : '50%', border: `2px solid ${ARC.goldBright}`, animation: 'rt-ring 1.8s infinite', pointerEvents: 'none', boxSizing: 'border-box' }}/>
                )}
                <button
                  type="button"
                  className={nodeClass}
                  data-path-node={node.state}
                  data-guide={node.guide}
                  aria-label={`${name}, ${what}`}
                  onClick={(e) => onPick?.(node, i, e.currentTarget)}
                  style={{
                    position: 'absolute', left: x - size / 2, top: y - size / 2, width: size, height: size, boxSizing: 'border-box',
                    borderRadius: node.boss ? 18 : '50%', padding: 0, cursor: 'pointer', zIndex: 2,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
                    boxShadow: node.state === 'current' ? undefined : '0 3px 10px rgba(0,0,0,0.5)', ...look,
                  }}
                >
                  <NodeFace node={node} unit={unit} bossLabel={bossLabel}/>
                  {cleared && node.check && (
                    <span aria-hidden style={{ position: 'absolute', top: -3, right: -3, width: 18, height: 18, borderRadius: '50%', background: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 2px #0a0014' }}>
                      <Check size={11} color="#04140c" strokeWidth={3.5}/>
                    </span>
                  )}
                </button>
                {labelled && (
                  // Hung on the side away from the road below (pathLabelLeft),
                  // on a solid backdrop, so the road never runs through it.
                  <div
                    aria-hidden
                    data-guide={node.pipsGuide}
                    ref={(el) => { labelEls.current[i] = el; }}
                    style={{
                      position: 'absolute', top: y + labelTop, left: pathLabelLeft(pts, i, { top: labelTop, w: box.w, h: box.h, width }),
                      width: 'max-content', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 3,
                      background: LABEL_BG, borderRadius: 8, padding: node.pips ? 2 : '3px 6px', boxShadow: '0 2px 6px rgba(0,0,0,0.55)',
                    }}
                  >
                    {under && <StarsRow n={node.stars} of={node.max} size={13}/>}
                    {node.pips && <Pips pips={node.pips} state={node.state}/>}
                  </div>
                )}
              </div>
            );
          })}
          {hintAt >= 0 && (() => {
            const p = pts[hintAt];
            const hs = hintSize || { w: Math.min(width - 16, 220), h: 26 };
            const left = Math.max(8, Math.min(width - 8 - hs.w, p.x - hs.w / 2));
            return (
              <div
                key={`hint-${hintAt}-${hint.text}`}
                ref={hintEl}
                role="status"
                data-retention="path-hint"
                style={{
                  position: 'absolute', top: hintTop(pts, hintAt, sizeOf(hintAt), sizeOf, hs.h, height), left,
                  width: 'max-content', maxWidth: width - 16, boxSizing: 'border-box', zIndex: 4, pointerEvents: 'none',
                  padding: '6px 11px', borderRadius: 9, background: 'rgba(20,4,10,0.95)', border: '1px solid rgba(239,68,68,0.6)',
                  boxShadow: '0 6px 18px rgba(0,0,0,0.55)', textAlign: 'center',
                  font: `800 8.5px ${ARC.head}`, letterSpacing: '0.1em', lineHeight: 1.35, color: '#fca5a5', animation: 'rt-rise .2s both',
                }}
              >🔒 {hint.text}</div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
