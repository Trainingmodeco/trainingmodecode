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

const SIZE = PATH_SIZE;
const FADE = 'linear-gradient(to bottom, transparent 0, #000 22px, #000 calc(100% - 22px), transparent 100%)';

// The label under a node (its stars or its pips) sits on one solid backdrop.
const LABEL_BG = '#0d0418';
// Its size before it is measured: what the stars or the pips take, rounded up.
const labelGuess = (node, stars) => ({
  w: Math.max(node.pips ? 76 : 0, stars ? node.max * 13 + (node.max - 1) * 2 + 12 : 0),
  h: (node.pips ? 18 : 0) + (stars ? 19 : 0) + (node.pips && stars ? 3 : 0),
});

function Pips({ pips, state }) {
  const pip = (label, done, next) => (
    <span style={{
      font: `800 8px ${ARC.head}`, letterSpacing: '0.02em', borderRadius: 5, padding: '2px 5px', whiteSpace: 'nowrap',
      color: done ? '#22c55e' : next ? ARC.gold : '#b7abd6',
      background: done ? '#0b2416' : next ? '#2a2208' : LABEL_BG,
      border: `1px solid ${done ? 'rgba(34,197,94,0.55)' : next ? 'rgba(253,224,71,0.55)' : 'rgba(168,85,247,0.35)'}`,
    }}>{label}{done ? ' ✓' : ''}</span>
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

export default function PathMap({ nodes = [], onPick, unit = 'STAGE', bossLabel = 'BOSS', focus, dim = false, nodeClass, style }) {
  const boxRef = useRef(null);
  const [width, setWidth] = useState(0);
  const scrolled = useRef(false);
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

  // Opens scrolled to that node, once its width is known.
  useEffect(() => {
    const el = boxRef.current;
    if (!el || !width || scrolled.current || !pts[at]) return;
    scrolled.current = true;
    el.scrollTop = Math.max(0, pts[at].y - el.clientHeight / 2);
  }, [width, at, pts]);

  // The road: dashed ahead, gold up to the current node (or the last cleared).
  const reach = cur >= 0 ? cur : lastCleared;
  const line = (list) => list.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  return (
    <div ref={boxRef} data-retention="path-map" className="no-scrollbar rt-anim" style={{
      position: 'absolute', inset: 0, overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch',
      // The road fades out at the box's edges rather than being cut there.
      WebkitMaskImage: FADE, maskImage: FADE, ...style,
    }}>
      <style dangerouslySetInnerHTML={{ __html: RETENTION_CSS }}/>
      {width > 0 && (
        <div style={{ position: 'relative', width: '100%', height, filter: dim ? 'brightness(0.45)' : 'none', transition: 'filter .2s ease' }}>
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
        </div>
      )}
    </div>
  );
}
