import { useEffect, useRef, useState, useMemo } from 'react';
import {
  routeBounds, mercatorProjector, tileCover, segmentPaceSec, paceColor, pointAtDistance,
} from '../data/geoRoute';
import { metersPerUnit } from '../data/runCoach';
import { tilesConfigured, tileUrl, TILE_ATTRIBUTION } from '../data/mapTiles';

// The map. Draws the ground an athlete actually covered.
//
// It measures its own box and projects into THAT many pixels, 1:1 with the
// viewBox, for two reasons: a letterboxed SVG would leave gaps around raster
// tiles, and a stretched one would lie about the shape of the route — which is
// exactly what the old 300x64 trail did.
//
// Raster tiles are OPTIONAL and OFF unless EXPO_PUBLIC_MAP_TILES_URL names a
// {z}/{x}/{y} template. Without it the route draws on the app's own grid, which
// costs nothing, works with no signal, sends the athlete's coordinates to no
// one, and still answers the question the map is asked: where did I go, and
// where was I moving well. With it, the same projection puts real streets
// underneath, because both use Web Mercator at the same integer zoom.

export { RECOMMENDED_PROVIDER } from '../data/mapTiles';
export const mapTilesEnabled = tilesConfigured;

// Width of the element, in CSS pixels, kept current as the phone rotates.
function useMeasuredWidth(fallback = 320) {
  const ref = useRef(null);
  const [w, setW] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const read = () => {
      const next = Math.round(el.getBoundingClientRect().width);
      if (next > 0) setW(next);
    };
    read();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', read);
      return () => window.removeEventListener('resize', read);
    }
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

const STYLES = `
@keyframes route-ping { 0% { r: 4; opacity: 0.9; } 100% { r: 13; opacity: 0; } }
`;

export default function RouteMap({
  route,
  height = 150,
  unit = 'mi',
  targetPaceSec = null,
  live = false,
  compact = false,
  splitStep = 0.5,
  label = null,
  emptyText = 'ROUTE DRAWS AS YOU MOVE',
  style,
}) {
  const [boxRef, width] = useMeasuredWidth();
  const [tilesFailed, setTilesFailed] = useState(false);
  const useTiles = mapTilesEnabled() && !tilesFailed && !compact;

  const pts = useMemo(() => (Array.isArray(route) ? route : []), [route]);
  const bounds = useMemo(() => routeBounds(pts), [pts]);

  const projector = useMemo(() => (
    bounds ? mercatorProjector({
      bounds,
      width,
      height,
      pad: compact ? 5 : 14,
      snapZoom: useTiles,
      maxZoom: useTiles ? 17 : 19,
    }) : null
  ), [bounds, width, height, compact, useTiles]);

  const screen = useMemo(() => (
    projector ? pts.map(p => ({ ...p, ...projector.project(p.lat, p.lng) })) : []
  ), [projector, pts]);

  const tiles = useMemo(() => (useTiles && projector ? tileCover(projector) : []), [useTiles, projector]);

  // Probe one tile out of band rather than listening for an error on the SVG
  // <image> elements: a blocked or misconfigured tile host would otherwise
  // leave the map showing a grid of broken rectangles with nothing to fall
  // back on. One failed probe drops the whole layer to the vector look.
  const probe = tiles[0] ? tileUrl(tiles[0]) : null;
  useEffect(() => {
    if (!probe || typeof Image === 'undefined') return undefined;
    let alive = true;
    const img = new Image();
    img.onerror = () => { if (alive) setTilesFailed(true); };
    img.src = probe;
    return () => { alive = false; img.onerror = null; };
  }, [probe]);

  // One path per colour band rather than one per segment: a 200-point route
  // becomes five <path> elements instead of two hundred.
  const bands = useMemo(() => {
    if (screen.length < 2) return [];
    const out = [];
    let cur = null;
    for (let i = 1; i < screen.length; i++) {
      const color = paceColor(segmentPaceSec(pts, i, unit), targetPaceSec);
      if (!cur || cur.color !== color) {
        if (cur) out.push(cur);
        cur = { color, d: `M ${screen[i - 1].x.toFixed(1)} ${screen[i - 1].y.toFixed(1)}` };
      }
      cur.d += ` L ${screen[i].x.toFixed(1)} ${screen[i].y.toFixed(1)}`;
    }
    if (cur) out.push(cur);
    return out;
  }, [screen, pts, unit, targetPaceSec]);

  // Split pins at every half / whole unit the route actually reached.
  const splitPins = useMemo(() => {
    if (compact || !projector || screen.length < 2) return [];
    const totalUnits = (pts[pts.length - 1]?.m || 0) / metersPerUnit(unit);
    const out = [];
    for (let d = splitStep; d < totalUnits - 1e-6; d += splitStep) {
      const p = pointAtDistance(pts, d, unit);
      if (!p) continue;
      const s = projector.project(p.lat, p.lng);
      out.push({ d: +d.toFixed(2), x: s.x, y: s.y, whole: Math.abs(d - Math.round(d)) < 1e-6 });
    }
    return out;
  }, [compact, projector, screen.length, pts, unit, splitStep]);

  const first = screen[0];
  const last = screen[screen.length - 1];
  // A pin sitting near the bottom edge would have its label drawn off the map,
  // so it flips above the dot once it runs out of room below. And a loop run
  // finishes where it started, stacking FINISH on top of START — when the two
  // pins land together, FINISH goes to the opposite side.
  const labelY = (p) => (p.y < height - 20 ? p.y + 15 : p.y - 10);
  const startLabelY = first ? labelY(first) : 0;
  const pinsTogether = first && last && Math.hypot(last.x - first.x, last.y - first.y) < 16;
  const finishLabelY = !last ? 0
    : pinsTogether ? (startLabelY > last.y ? last.y - 10 : last.y + 15)
      : labelY(last);
  const gridSize = compact ? 14 : 26;
  const gridId = useTiles ? null : `rm-grid-${Math.round(height)}-${compact ? 'c' : 'f'}`;

  return (
    <div
      ref={boxRef}
      style={{
        position: 'relative', width: '100%', height, borderRadius: compact ? 8 : 12, overflow: 'hidden',
        border: `1px solid ${compact ? 'rgba(34,197,94,0.28)' : 'rgba(34,197,94,0.3)'}`,
        background: useTiles ? '#0b1020' : 'radial-gradient(circle at 50% 40%, rgba(34,197,94,0.07), rgba(6,1,14,0.95))',
        ...style,
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}>
        {!useTiles && (
          <defs>
            <pattern id={gridId} width={gridSize} height={gridSize} patternUnits="userSpaceOnUse">
              <path d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`} fill="none" stroke="rgba(168,85,247,0.13)" strokeWidth="1" />
            </pattern>
          </defs>
        )}
        {!useTiles && <rect width={width} height={height} fill={`url(#${gridId})`} />}

        {useTiles && tiles.map(t => (
          <image
            key={`${t.z}/${t.x}/${t.y}`}
            href={tileUrl(t)}
            x={t.px} y={t.py} width={t.size} height={t.size}
            style={{ opacity: 0.85 }}
          />
        ))}

        {bands.length > 0 ? (
          <>
            {/* Casing first, so the coloured line reads on any background. */}
            <g fill="none" strokeLinecap="round" strokeLinejoin="round">
              {bands.map((b, i) => (
                <path key={`c${i}`} d={b.d} stroke="rgba(4,0,12,0.75)" strokeWidth={compact ? 4 : 6.5} />
              ))}
              {bands.map((b, i) => (
                <path key={`p${i}`} d={b.d} stroke={b.color} strokeWidth={compact ? 2 : 3.5}
                  style={compact ? undefined : { filter: 'drop-shadow(0 0 3px rgba(34,197,94,0.45))' }} />
              ))}
            </g>

            {splitPins.map(s => (
              <g key={s.d}>
                <circle cx={s.x} cy={s.y} r={s.whole ? 4 : 2.8} fill="#0a0014" stroke={s.whole ? '#fde047' : 'rgba(253,224,71,0.55)'} strokeWidth="1.5" />
                {s.whole && (
                  <text x={s.x} y={s.y - 7} textAnchor="middle" fill="#fde047" style={{ font: "700 8px 'Orbitron',sans-serif" }}>{s.d}</text>
                )}
              </g>
            ))}

            {first && (
              <g>
                <circle cx={first.x} cy={first.y} r={compact ? 3 : 5} fill="#22c55e" stroke="#03120a" strokeWidth="1.5" />
                {!compact && <text x={first.x} y={startLabelY} textAnchor="middle" fill="#8fe8ac" style={{ font: "700 7px 'Orbitron',sans-serif", letterSpacing: '0.1em' }}>START</text>}
              </g>
            )}
            {last && (
              <g>
                {live && <circle cx={last.x} cy={last.y} r="4" fill="none" stroke="#fde047" strokeWidth="1.5" style={{ animation: 'route-ping 1.6s ease-out infinite' }} />}
                <circle cx={last.x} cy={last.y} r={compact ? 3 : 5} fill={live ? '#fde047' : '#ff8a4a'} stroke="#140203" strokeWidth="1.5" />
                {!compact && !live && <text x={last.x} y={finishLabelY} textAnchor="middle" fill="#ffb98a" style={{ font: "700 7px 'Orbitron',sans-serif", letterSpacing: '0.1em' }}>FINISH</text>}
              </g>
            )}
          </>
        ) : (
          <text x={width / 2} y={height / 2 + 3} textAnchor="middle" fill="#5f5880" style={{ font: `700 ${compact ? 7 : 9}px 'Orbitron',sans-serif`, letterSpacing: '0.1em' }}>
            {emptyText}
          </text>
        )}
      </svg>

      {!compact && label && (
        <div style={{
          position: 'absolute', top: 6, left: 8, padding: '2px 7px', borderRadius: 6,
          background: 'rgba(4,0,12,0.72)', border: '1px solid rgba(34,197,94,0.3)',
          font: "700 7.5px 'Orbitron',sans-serif", color: '#8fe8ac', letterSpacing: '0.12em',
        }}>{label}</div>
      )}

      {/* Mandatory while tiles are on: every one of these basemaps is built
          from OpenStreetMap, and the credit is a licence condition, not a
          courtesy. It renders whenever the layer does. */}
      {!compact && useTiles && (
        <div style={{
          position: 'absolute', right: 4, bottom: 3, padding: '1px 5px', borderRadius: 4,
          background: 'rgba(4,0,12,0.6)', font: "600 7px 'Rajdhani',sans-serif", color: '#9a90b8',
        }}>{TILE_ATTRIBUTION}</div>
      )}
    </div>
  );
}

// The little green route shape beside a row in the history list.
export function RouteThumb({ route, size = 52, style }) {
  return (
    <RouteMap
      route={route}
      height={size}
      compact
      emptyText="NO GPS"
      style={{ width: size, flexShrink: 0, ...style }}
    />
  );
}
