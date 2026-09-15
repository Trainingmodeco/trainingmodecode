// Route geometry — the pure maths behind "show me where I actually ran".
//
// Everything here is a function of numbers only: no React, no storage, no DOM.
// Three jobs:
//
//  1. KEEP THE SHAPE, NOT EVERY FIX. A watchPosition can fire once a second for
//     an hour. Storing 3600 points per run would blow the storage budget, and
//     dropping the oldest (what the player used to do) silently eats the START
//     of the route — the first streets of the run. Instead the track is
//     SIMPLIFIED: Ramer–Douglas–Peucker keeps the corners and throws away the
//     straights, so a 3600-point run becomes ~200 points that draw the same map.
//
//  2. PROJECT LIKE A MAP DOES. The old trail stretched lat and lng to fill a
//     300x64 box, so a square lap came out as a smear. Web Mercator with ONE
//     scale for both axes is what every slippy map uses, so the drawn route has
//     the shape of the real route — and the same projection places raster tiles
//     underneath when a tile source is configured.
//
//  3. COLOUR BY EFFORT. Each kept point carries the elapsed second and the
//     cumulative metres, so any segment's speed is a subtraction — that is what
//     paints the fast parts green and the walk-breaks orange.
import { haversineMeters, metersPerUnit } from './runCoach';

const TILE = 256;
const DEG = Math.PI / 180;

// ── Bounds ────────────────────────────────────────────────────────────────
export function routeBounds(pts) {
  if (!Array.isArray(pts) || pts.length === 0) return null;
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const p of pts) {
    if (!Number.isFinite(p?.lat) || !Number.isFinite(p?.lng)) continue;
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  }
  if (!Number.isFinite(minLat)) return null;
  return { minLat, maxLat, minLng, maxLng };
}

// ── Web Mercator ──────────────────────────────────────────────────────────
// World pixel coordinates at zoom z — the frame OpenStreetMap, Google and
// Mapbox raster tiles are all cut from.
export const worldX = (lng, z) => ((lng + 180) / 360) * TILE * Math.pow(2, z);
export function worldY(lat, z) {
  const clamped = Math.max(-85.05112878, Math.min(85.05112878, lat));
  const s = Math.sin(clamped * DEG);
  return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * TILE * Math.pow(2, z);
}

// A projector that fits `bounds` into a width x height box with `pad` px of
// margin. `snapZoom` rounds DOWN to an integer zoom so raster tiles line up
// pixel-for-pixel; without it the fit is exact, which is what the tile-less
// vector map wants.
export function mercatorProjector({ bounds, width, height, pad = 10, snapZoom = false, maxZoom = 18, minZoom = 1 }) {
  if (!bounds) return null;
  const w = Math.max(1, width - pad * 2);
  const h = Math.max(1, height - pad * 2);
  // Span in world pixels at z = 0.
  const spanX = Math.max(1e-9, worldX(bounds.maxLng, 0) - worldX(bounds.minLng, 0));
  const spanY = Math.max(1e-9, worldY(bounds.minLat, 0) - worldY(bounds.maxLat, 0));
  // A point-sized route (standing still) still deserves a sane zoom.
  const fitZ = Math.min(Math.log2(w / spanX), Math.log2(h / spanY));
  let z = Number.isFinite(fitZ) ? fitZ : maxZoom;
  z = Math.max(minZoom, Math.min(maxZoom, z));
  if (snapZoom) z = Math.max(minZoom, Math.floor(z));
  const cx = (worldX(bounds.minLng, z) + worldX(bounds.maxLng, z)) / 2;
  const cy = (worldY(bounds.minLat, z) + worldY(bounds.maxLat, z)) / 2;
  const offsetX = cx - width / 2;
  const offsetY = cy - height / 2;
  return {
    z,
    offsetX,
    offsetY,
    width,
    height,
    project: (lat, lng) => ({ x: worldX(lng, z) - offsetX, y: worldY(lat, z) - offsetY }),
  };
}

// Which raster tiles cover the viewport, and where each one sits. Only useful
// with snapZoom — a fractional zoom has no tiles.
export function tileCover(projector) {
  if (!projector || !Number.isInteger(projector.z)) return [];
  const { z, offsetX, offsetY, width, height } = projector;
  const n = Math.pow(2, z);
  const x0 = Math.floor(offsetX / TILE);
  const x1 = Math.floor((offsetX + width) / TILE);
  const y0 = Math.floor(offsetY / TILE);
  const y1 = Math.floor((offsetY + height) / TILE);
  const out = [];
  for (let ty = y0; ty <= y1; ty++) {
    if (ty < 0 || ty >= n) continue;
    for (let tx = x0; tx <= x1; tx++) {
      const wrapped = ((tx % n) + n) % n;
      out.push({ z, x: wrapped, y: ty, px: tx * TILE - offsetX, py: ty * TILE - offsetY, size: TILE });
    }
  }
  return out;
}

// ── Simplification ────────────────────────────────────────────────────────
// Ramer–Douglas–Peucker in a local metre plane. Latitude is 111,320 m per
// degree everywhere; longitude shrinks by cos(lat), so one cos() at the route's
// own latitude makes the plane accurate enough for a run.
function planar(pts) {
  const lat0 = pts[0].lat;
  const lng0 = pts[0].lng;
  const kx = 111320 * Math.cos(lat0 * DEG);
  const ky = 111320;
  return pts.map(p => ({ x: (p.lng - lng0) * kx, y: (p.lat - lat0) * ky }));
}

function perpDist(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

// Keep-flags for one RDP pass at `tolerance` metres.
function rdpKeep(flat, tolerance) {
  const keep = new Array(flat.length).fill(false);
  keep[0] = true;
  keep[flat.length - 1] = true;
  const stack = [[0, flat.length - 1]];
  while (stack.length) {
    const [lo, hi] = stack.pop();
    if (hi - lo < 2) continue;
    let best = -1, bestD = tolerance;
    for (let i = lo + 1; i < hi; i++) {
      const d = perpDist(flat[i], flat[lo], flat[hi]);
      if (d > bestD) { bestD = d; best = i; }
    }
    if (best >= 0) { keep[best] = true; stack.push([lo, best], [best, hi]); }
  }
  return keep;
}

export function simplifyRoute(pts, toleranceMeters = 4) {
  if (!Array.isArray(pts) || pts.length < 3) return Array.isArray(pts) ? pts.slice() : [];
  const keep = rdpKeep(planar(pts), toleranceMeters);
  return pts.filter((_, i) => keep[i]);
}

// Simplify until the track fits `maxPoints`, loosening the tolerance each pass.
// Multiplying converges in a handful of rounds even on an ultra-marathon.
export function thinRoute(pts, maxPoints = 200, startTolerance = 3) {
  if (!Array.isArray(pts) || pts.length <= maxPoints) return Array.isArray(pts) ? pts.slice() : [];
  let tol = startTolerance;
  let out = simplifyRoute(pts, tol);
  let guard = 0;
  while (out.length > maxPoints && guard++ < 24) {
    tol *= 1.8;
    out = simplifyRoute(pts, tol);
  }
  // Pathological input (every point a corner): fall back to even sampling, but
  // always keep the first and the last so the route still starts and finishes
  // where the athlete did.
  if (out.length > maxPoints) {
    const step = out.length / maxPoints;
    const sampled = [];
    for (let i = 0; i < maxPoints; i++) sampled.push(out[Math.floor(i * step)]);
    sampled[sampled.length - 1] = out[out.length - 1];
    return sampled;
  }
  return out;
}

export function routeDistanceMeters(pts) {
  if (!Array.isArray(pts) || pts.length < 2) return 0;
  let m = 0;
  for (let i = 1; i < pts.length; i++) m += haversineMeters(pts[i - 1].lat, pts[i - 1].lng, pts[i].lat, pts[i].lng);
  return m;
}

// ── Pace colouring ────────────────────────────────────────────────────────
// Seconds per unit for the segment ending at index i, from the cumulative
// (t, m) each point carries. Null when the point pair cannot say.
export function segmentPaceSec(pts, i, unit = 'mi') {
  const a = pts[i - 1], b = pts[i];
  if (!a || !b) return null;
  const dm = (b.m ?? 0) - (a.m ?? 0);
  const dt = (b.t ?? 0) - (a.t ?? 0);
  if (!(dm > 1) || !(dt > 0)) return null;
  return (dt / dm) * metersPerUnit(unit);
}

// Orange (slower than target) through to green (faster) — the same reading the
// pace coach gives on the HUD, so the map says the same thing the voice did.
export function paceColor(paceSec, targetPaceSec) {
  if (!paceSec || !targetPaceSec) return '#22c55e';
  const ratio = paceSec / targetPaceSec;
  if (ratio <= 0.9) return '#7ef29a';
  if (ratio <= 1.0) return '#22c55e';
  if (ratio <= 1.12) return '#c9d96a';
  if (ratio <= 1.3) return '#f5b942';
  return '#ff8a4a';
}

// The point nearest a given cumulative distance in units — used to drop a split
// marker on the map at every half and whole mile or kilometre.
export function pointAtDistance(pts, distUnits, unit = 'mi') {
  if (!Array.isArray(pts) || pts.length === 0) return null;
  const target = distUnits * metersPerUnit(unit);
  for (let i = 0; i < pts.length; i++) {
    if ((pts[i].m ?? 0) >= target) return pts[i];
  }
  return null;
}

// ── Storage encoding ──────────────────────────────────────────────────────
// A stored point is a 4-number tuple: [lat, lng, elapsedSec, metres]. Five
// decimals of latitude is about 1.1 m — finer than any phone's fix — and the
// tuple form is roughly a third the bytes of the object form, which is what
// decides how many runs fit in localStorage.
export function encodeRoute(pts) {
  if (!Array.isArray(pts)) return [];
  return pts
    .filter(p => Number.isFinite(p?.lat) && Number.isFinite(p?.lng))
    .map(p => [+p.lat.toFixed(5), +p.lng.toFixed(5), Math.round(p.t || 0), Math.round(p.m || 0)]);
}

export function decodeRoute(enc) {
  if (!Array.isArray(enc)) return [];
  return enc
    .map(e => (Array.isArray(e)
      ? { lat: e[0], lng: e[1], t: e[2] || 0, m: e[3] || 0 }
      : { lat: e?.lat, lng: e?.lng, t: e?.t || 0, m: e?.m || 0 }))
    .filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng));
}
