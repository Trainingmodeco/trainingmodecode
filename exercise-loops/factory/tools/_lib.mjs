// _lib.mjs: what the loop-factory tools share (ingest.mjs, prep.mjs, cut.mjs, strip.mjs). Pure Node + ffmpeg/ffprobe on the PATH.
//   args()        command-line flags
//   probe()       one video as the tools see it: size after rotation, frame rate, HDR or not; turned() for sideways footage with no tag
//   colour()      the filter that turns any phone footage into plain 8-bit SDR (tone-maps HDR)
//   grayFrames()  a span of a video as small gray frames, for measuring
//   athleteBox()  where the athlete is, from what moves in the span
//   squareFrames(), findRep()   the clean-rep search of prep8.mjs, with no hand settings
import { execFileSync } from 'node:child_process';

export const BG = '0x0a0014'; // the app's background colour: every square is padded with it
export const VIDEO_EXT = ['mp4', 'mov', 'm4v', 'webm', 'avi', 'mkv'];

/** argv -> { _: positional, flag: value }. `--flag value`, `--flag=value`; names in `bools` take no value. */
export function args(argv, bools = []) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { out._.push(a); continue; }
    const eq = a.indexOf('='); const key = eq > 0 ? a.slice(2, eq) : a.slice(2);
    if (bools.includes(key)) out[key] = true; else if (eq > 0) out[key] = a.slice(eq + 1); else out[key] = argv[++i];
  }
  return out;
}

/** Stop with a message and the usage text (the comment at the top of the tool). */
export function fail(msg, usage) { process.stderr.write(`${msg}\n${usage ? `\n${usage}\n` : ''}`); process.exit(2); }

/** Run ffmpeg / ffprobe; on failure throw the last lines ffmpeg wrote, not a dump of bytes. */
export function run(cmd, a, opts = {}) {
  try { return execFileSync(cmd, a, { maxBuffer: 3e9, stdio: ['ignore', 'pipe', 'pipe'], ...opts }); } catch (e) {
    const tail = String(e.stderr || e.message).trim().split('\n').slice(-4).join(' | ');
    throw new Error(`${cmd} failed: ${tail}`);
  }
}
export const ff = (a, opts) => run('ffmpeg', ['-nostdin', '-hide_banner', '-loglevel', 'error', '-y', ...a], opts);

const ratio = (s) => { if (!s) return 0; const [n, d] = String(s).split(/[/:]/).map(Number); return d ? n / d : n || 0; };
const even = (v) => Math.max(2, Math.round(v / 2) * 2);
let filters = null;
export function hasFilter(name) { if (filters === null) filters = run('ffmpeg', ['-hide_banner', '-filters']).toString(); return new RegExp(`\\s${name}\\s`).test(filters); }

/**
 * What a video is, as every later step sees it. width/height are the picture as shown (rotation and
 * non-square pixels applied), because ffmpeg turns the picture before any filter runs.
 * Returns null when the file has no video in it.
 */
export function probe(file) {
  const j = JSON.parse(run('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file]).toString());
  const streams = j.streams || [];
  const v = streams.find((s) => s.codec_type === 'video' && !(s.disposition && s.disposition.attached_pic));
  if (!v || !v.width || !v.height) return null;
  // rotation: the display matrix (newer phones, ffmpeg >= 5) or the old `rotate` tag; reported as the clockwise turn needed to show it upright
  let rot = 0; const sd = (v.side_data_list || []).find((s) => s.rotation !== undefined);
  if (sd) rot = -Number(sd.rotation); else if (v.tags && v.tags.rotate !== undefined) rot = Number(v.tags.rotate);
  rot = ((Math.round(rot / 90) * 90) % 360 + 360) % 360;
  const sar = ratio(v.sample_aspect_ratio) > 0 ? ratio(v.sample_aspect_ratio) : 1;
  let w = sar !== 1 ? even(v.width * sar) : v.width, h = v.height; if (rot % 180 === 90) [w, h] = [h, w];
  const avg = ratio(v.avg_frame_rate), real = ratio(v.r_frame_rate); const fps = avg > 0 && avg < 1000 ? avg : real;
  const duration = Number((j.format && j.format.duration) || v.duration || 0);
  const pix = v.pix_fmt || ''; const depth = Number(v.bits_per_raw_sample) || (/p1[0246](le|be)?$/.test(pix) ? Number(pix.match(/p(1[0246])/)[1]) : 8);
  const trc = v.color_transfer || ''; const hdr = trc === 'smpte2084' ? 'pq' : trc === 'arib-std-b67' ? 'hlg' : null;
  return {
    file, duration, width: w, height: h, codedWidth: v.width, codedHeight: v.height, sar, rotation: rot,
    fps: +fps.toFixed(3), vfr: real > 0 && avg > 0 && Math.abs(real - avg) / avg > 0.02, frames: Number(v.nb_frames) || null,
    codec: v.codec_name, pixFmt: pix, bitDepth: depth, hdr, primaries: v.color_primaries || '', matrix: v.color_space || '', transfer: trc,
    hasAudio: streams.some((s) => s.codec_type === 'audio'),
  };
}

/**
 * The colour step: put it AFTER crop and scale (tone-mapping is slow on a full 4K picture).
 * HDR (HLG from iPhones, PQ / HDR10 from Android) is tone-mapped to SDR BT.709; everything ends as 8-bit yuv420p.
 * The mobius curve keeps shadows and mid-tones as they are and only squeezes the highlights (hable, the usual
 * choice, turns a phone clip more than a stop darker). Without the zscale filter the HDR picture is only
 * converted to 8 bit (it looks washed out, but later steps work).
 */
export function colour(p) {
  const out = [];
  if (p.hdr && hasFilter('zscale') && hasFilter('tonemap')) {
    const tin = p.hdr === 'pq' ? 'smpte2084' : 'arib-std-b67';
    const pin = /2020/.test(p.primaries) || !p.primaries ? 'bt2020' : 'bt709'; const min = /2020/.test(p.matrix) || !p.matrix ? '2020_ncl' : 'bt709';
    out.push(`zscale=tin=${tin}:pin=${pin}:min=${min}:rin=tv:t=linear:npl=100`, 'format=gbrpf32le', 'zscale=p=bt709', 'tonemap=tonemap=mobius:desat=0', 'zscale=t=bt709:m=bt709:r=tv');
  }
  out.push('format=yuv420p');
  return out.join(',');
}
/**
 * For footage filmed sideways that carries no rotation tag (some editing apps drop it): the same video turned a
 * further `deg` clockwise (90, 180 or 270). width and height swap for a quarter turn.
 */
export function turned(p, deg) {
  const d = ((Math.round((Number(deg) || 0) / 90) * 90) % 360 + 360) % 360; if (!d) return p;
  return { ...p, turn: d, shown: [p.width, p.height], width: d % 180 ? p.height : p.width, height: d % 180 ? p.width : p.height };
}
/**
 * The first filters of every chain: non-square pixels are made square and a turn asked for by hand is applied,
 * so every crop box is in pixels of the picture as a person sees it. (The phone's own rotation tag needs
 * nothing here: ffmpeg applies it before any filter.)
 */
export const upright = (p) => {
  const [w, h] = p.shown || [p.width, p.height]; const f = p.sar !== 1 ? [`scale=${w}:${h}`, 'setsar=1'] : [];
  if (p.turn === 90) f.push('transpose=1'); else if (p.turn === 270) f.push('transpose=2'); else if (p.turn === 180) f.push('hflip', 'vflip');
  return f;
};

/**
 * A span of the video as small 8-bit gray frames at a fixed rate: { raw, W, H, n, fps }.
 * `long` is the longest side in pixels. Frame i is the picture at start + i / fps.
 */
export function grayFrames(p, { start = 0, dur = 0, fps = 15, long = 240, crop = null, size = null } = {}) {
  let W, H; const vf = [...upright(p), `fps=${fps}`];
  if (crop) vf.push(`crop=${crop.join(':')}`);
  if (size) { [W, H] = size; } else { const k = long / Math.max(p.width, p.height); W = even(p.width * k); H = even(p.height * k); }
  vf.push(`scale=${W}:${H}:flags=area`, colour(p), 'format=gray');
  const a = ['-nostdin', '-hide_banner', '-loglevel', 'error', '-ss', String(Math.max(0, start))]; if (dur > 0) a.push('-t', String(dur));
  a.push('-i', p.file, '-an', '-sn', '-vf', vf.join(','), '-f', 'rawvideo', '-');
  const raw = run('ffmpeg', a); return { raw, W, H, n: Math.floor(raw.length / (W * H)), fps };
}

const quantile = (arr, f) => { const s = Float32Array.from(arr).sort(); return s[Math.min(s.length - 1, Math.max(0, Math.floor(f * (s.length - 1))))]; };

/**
 * Where the athlete is, from what moves. On a tripod the background only carries sensor noise, while every part of
 * a person doing reps moves a little, even the planted feet (weight shifts, shadows). So:
 *   1. per pixel, how much its brightness varies over the span (each frame first brought to the same exposure,
 *      so the phone adjusting itself does not light up the whole picture);
 *   2. what the background does on its own: sensor noise, plus a shimmer on sharp edges when the phone trembles
 *      (it grows with the local contrast, so it is measured as a share of it: `jitter`);
 *   3. `strong` pixels vary a lot (limbs and bar travelling), `weak` pixels vary a little but clearly more than
 *      the background would;
 *   4. the biggest strongly-moving blob is the athlete, together with strong blobs close by (a plate at the end
 *      of a bar); weak pixels go to the strong blob they hang on to, so a ceiling fan or a second person keeps
 *      their own surroundings and is dropped with them;
 *   5. the box around what is kept, in source pixels.
 * What it cannot do: tell the athlete from a shadow or a reflection on a shiny floor (they move with the body, so
 * the box takes them in and grows), find a limb that is held perfectly still (it is only safe while that limb
 * sways a little), or work when the camera itself moves (`moving`: the caller then uses the whole picture).
 * Returns { box: [w,h,x,y] | null, moving, noise, jitter, contrast, touches: ['top',...] (edges of the picture the
 *           box reaches), ignored: share of the movement that was dropped, map: { sd, mask, W, H } for debugging }.
 */
export function athleteBox(fr, p, opt = {}) {
  const { raw, W, H, n } = fr; const N = W * H; const o = { weakK: 3.2, weakMin: 3.2, strongK: 7, strongMin: 9, join: 0.05, camNoise: 3.5, camJitter: 0.15, fullContrast: 130, ...opt };
  if (n < 6) return { box: null, moving: false, noise: 0, jitter: 0, touches: [], ignored: 0, reason: 'too few frames' };
  // 1. per-frame brightness, then per pixel: the mean, and the spread as the distance between its 3rd and 97th
  //    percentile over time (as a standard deviation would read it on plain noise). Unlike a standard deviation it
  //    shows a hand that is at the top of its reach for a twentieth of the time at full strength, and it does not see
  //    what is there for less than a thirtieth of the span: a passer-by, a flash, a bump of the tripod.
  //    Before that each frame is brought to the same exposure: the phone drifts in brightness and contrast while it
  //    films, so every frame is fitted to the average picture (frame = a * average + b) and the fit is taken out.
  const ref = new Float64Array(N); for (let t = 0; t < n; t++) { const off = t * N; for (let i = 0; i < N; i++) ref[i] += raw[off + i]; }
  let sx = 0, sxx = 0; for (let i = 0; i < N; i++) { ref[i] /= n; sx += ref[i]; sxx += ref[i] * ref[i]; } const all = sx / N; const den = N * sxx - sx * sx;
  const mean = new Float64Array(N); const hist = new Uint16Array(N * 256);
  for (let t = 0; t < n; t++) {
    const off = t * N; let sy = 0, sxy = 0; for (let i = 0; i < N; i++) { const v = raw[off + i]; sy += v; sxy += v * ref[i]; }
    let ga = den > 1e-6 ? (N * sxy - sx * sy) / den : 1; if (!(ga > 0.5 && ga < 2)) ga = 1; const gb = (sy - ga * sx) / N;
    for (let i = 0; i < N; i++) { let v = (raw[off + i] - gb) / ga; v = v < 0 ? 0 : v > 255 ? 255 : v; mean[i] += v; hist[i * 256 + ((v + 0.5) | 0)]++; }
  }
  const sd0 = new Float32Array(N); const trim = Math.max(1, Math.floor(0.03 * n));
  for (let i = 0; i < N; i++) { mean[i] /= n; const h = i * 256; let c = 0, lo = 0, hi = 255; while (lo < 255 && (c += hist[h + lo]) <= trim) lo++; c = 0; while (hi > 0 && (c += hist[h + hi]) <= trim) hi--; sd0[i] = Math.max(0, hi - lo) / 3.76; }
  const noise = quantile(sd0, 0.25);
  // 3x3 mean of the spread (takes the speckle out) and 3x3 range of the mean picture (the local contrast)
  const sd = new Float32Array(N), con = new Float32Array(N);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let s = 0, c = 0, lo = 255, hi = 0; for (let dy = -1; dy <= 1; dy++) { const yy = y + dy; if (yy < 0 || yy >= H) continue; for (let dx = -1; dx <= 1; dx++) { const xx = x + dx; if (xx < 0 || xx >= W) continue; const j = yy * W + xx; s += sd0[j]; c++; if (mean[j] < lo) lo = mean[j]; if (mean[j] > hi) hi = mean[j]; } } sd[y * W + x] = s / c; con[y * W + x] = hi - lo; }
  // 2. shimmer of still edges: on the sharpest third of the picture, the spread as a share of the contrast (a low quantile, so the athlete does not count)
  const edge = quantile(con, 0.67); const shares = []; for (let i = 0; i < N; i++) if (con[i] >= Math.max(8, edge)) shares.push(sd[i] / con[i]);
  const jitter = shares.length > 50 ? quantile(shares, 0.3) : 0;
  // a dim or flat picture moves in smaller steps of gray: the two floors shrink with the picture's own contrast
  const span = quantile(mean, 0.98) - quantile(mean, 0.02); const dim = Math.min(1, Math.max(0.2, span / o.fullContrast));
  const res = { box: null, moving: noise > o.camNoise || jitter > o.camJitter, noise: +noise.toFixed(2), jitter: +jitter.toFixed(3), contrast: Math.round(span), touches: [], ignored: 0, meanLuma: all, map: { sd, W, H } };
  if (res.moving) return res;
  // 3. masks
  const lab = new Int32Array(N).fill(-2); // -2 still, -1 weak and not yet given to a blob, >= 0 the blob
  const strong = new Uint8Array(N);
  for (let i = 0; i < N; i++) { const bg = Math.sqrt(noise * noise + jitter * jitter * con[i] * con[i]); if (sd[i] >= Math.max(o.weakMin * dim, o.weakK * bg)) { lab[i] = -1; if (sd[i] >= Math.max(o.strongMin * dim, o.strongK * bg)) strong[i] = 1; } }
  // 4. strong blobs (8-connected), then weak pixels flood out from them, nearest blob first
  const comps = []; const queue = new Int32Array(N); let qh = 0, qt = 0; const stack = new Int32Array(N);
  for (let s0 = 0; s0 < N; s0++) {
    if (!strong[s0] || lab[s0] >= 0) continue; const id = comps.length; const c = { id, mass: 0, x0: W, x1: -1, y0: H, y1: -1 }; let sp = 0; stack[sp++] = s0; lab[s0] = id;
    while (sp) { const i = stack[--sp]; queue[qt++] = i; const x = i % W, y = (i - x) / W; c.mass += sd[i]; if (x < c.x0) c.x0 = x; if (x > c.x1) c.x1 = x; if (y < c.y0) c.y0 = y; if (y > c.y1) c.y1 = y;
      for (let dy = -1; dy <= 1; dy++) { const yy = y + dy; if (yy < 0 || yy >= H) continue; for (let dx = -1; dx <= 1; dx++) { const xx = x + dx; if (xx < 0 || xx >= W) continue; const j = yy * W + xx; if (strong[j] && lab[j] < 0) { lab[j] = id; stack[sp++] = j; } } } }
    comps.push(c);
  }
  if (!comps.length) { res.reason = 'nothing moves'; return res; }
  while (qh < qt) { const i = queue[qh++]; const x = i % W, y = (i - x) / W; for (let dy = -1; dy <= 1; dy++) { const yy = y + dy; if (yy < 0 || yy >= H) continue; for (let dx = -1; dx <= 1; dx++) { const xx = x + dx; if (xx < 0 || xx >= W) continue; const j = yy * W + xx; if (lab[j] === -1) { lab[j] = lab[i]; queue[qt++] = j; } } } }
  const main = comps.slice().sort((a, b) => b.mass - a.mass)[0];
  const keep = new Set([main.id]); const bb = { x0: main.x0, x1: main.x1, y0: main.y0, y1: main.y1 }; const gap = o.join * Math.max(W, H); let grew = true;
  while (grew) { grew = false; for (const c of comps) { if (keep.has(c.id) || c.mass < 0.02 * main.mass) continue; const dx = Math.max(0, c.x0 - bb.x1, bb.x0 - c.x1), dy = Math.max(0, c.y0 - bb.y1, bb.y0 - c.y1); if (Math.max(dx, dy) <= gap) { keep.add(c.id); bb.x0 = Math.min(bb.x0, c.x0); bb.x1 = Math.max(bb.x1, c.x1); bb.y0 = Math.min(bb.y0, c.y0); bb.y1 = Math.max(bb.y1, c.y1); grew = true; } } }
  let kept = 0, total = 0; for (const c of comps) { total += c.mass; if (keep.has(c.id)) kept += c.mass; }
  res.ignored = +(1 - kept / total).toFixed(3); res.core = [bb.x0, bb.x1, bb.y0, bb.y1];
  // 5. the box: rows and columns that hold at least two kept pixels (one stray pixel does not move an edge)
  const rows = new Int32Array(H), cols = new Int32Array(W); const mask = new Uint8Array(N);
  for (let i = 0; i < N; i++) { if (lab[i] >= 0 && keep.has(lab[i])) { rows[(i / W) | 0]++; cols[i % W]++; mask[i] = strong[i] ? 255 : 150; } else if (lab[i] !== -2) mask[i] = strong[i] ? 90 : 45; }
  let x0 = 0, x1 = W - 1, y0 = 0, y1 = H - 1; while (x0 < x1 && cols[x0] < 2) x0++; while (x1 > x0 && cols[x1] < 2) x1--; while (y0 < y1 && rows[y0] < 2) y0++; while (y1 > y0 && rows[y1] < 2) y1--;
  if (x0 <= 1) res.touches.push('left'); if (x1 >= W - 2) res.touches.push('right'); if (y0 <= 1) res.touches.push('top'); if (y1 >= H - 2) res.touches.push('bottom');
  const kx = p.width / W, ky = p.height / H;
  res.box = [Math.round((x1 - x0 + 1) * kx), Math.round((y1 - y0 + 1) * ky), Math.round(x0 * kx), Math.round(y0 * ky)]; res.small = { x0, x1, y0, y1 }; res.map.mask = mask;
  return res;
}

/** Pad a box by a share of its longer side and keep it inside the picture (even numbers, as ffmpeg crop wants). */
export function padBox([w, h, x, y], p, pad = 0.1) {
  const m = pad * Math.max(w, h); let x0 = Math.max(0, Math.floor(x - m)), y0 = Math.max(0, Math.floor(y - m)), x1 = Math.min(p.width, Math.ceil(x + w + m)), y1 = Math.min(p.height, Math.ceil(y + h + m));
  x0 -= x0 % 2; y0 -= y0 % 2; let bw = x1 - x0, bh = y1 - y0; bw -= bw % 2; bh -= bh % 2; return [bw, bh, x0, y0];
}

/**
 * The frames of grayFrames() cut to a box and set in the middle of a square of S x S (the rest filled with the
 * pad colour's gray), by area averaging: the same picture prep8.mjs measured (crop, pad to a square, scale to 96).
 */
export function squareFrames(fr, p, [bw, bh, bx, by], S = 96) {
  const { raw, W, H, n } = fr; const kx = W / p.width, ky = H / p.height; const side = Math.max(bw, bh); const out = new Uint8Array(n * S * S).fill(6);
  const ox = (side - bw) / 2, oy = (side - bh) / 2; // box offset inside the square, in source pixels
  // each output cell covers [u0,u1) x [v0,v1) of the square in source pixels -> small-frame coordinates
  const cells = [];
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const sx0 = (i * side) / S - ox, sx1 = ((i + 1) * side) / S - ox, sy0 = (j * side) / S - oy, sy1 = ((j + 1) * side) / S - oy;
    if (sx1 <= 0 || sy1 <= 0 || sx0 >= bw || sy0 >= bh) continue;
    const fx0 = (bx + Math.max(0, sx0)) * kx, fx1 = (bx + Math.min(bw, sx1)) * kx, fy0 = (by + Math.max(0, sy0)) * ky, fy1 = (by + Math.min(bh, sy1)) * ky;
    const xa = Math.min(W - 1, Math.floor(fx0)), xb = Math.min(W - 1, Math.max(xa, Math.ceil(fx1) - 1)), ya = Math.min(H - 1, Math.floor(fy0)), yb = Math.min(H - 1, Math.max(ya, Math.ceil(fy1) - 1));
    cells.push([j * S + i, xa, xb, ya, yb]);
  }
  for (let t = 0; t < n; t++) { const src = t * W * H, dst = t * S * S; for (const [o, xa, xb, ya, yb] of cells) { let s = 0; for (let y = ya; y <= yb; y++) { const r = src + y * W; for (let x = xa; x <= xb; x++) s += raw[r + x]; } out[dst + o] = Math.round(s / ((xb - xa + 1) * (yb - ya + 1))); } }
  return { raw: out, W: S, H: S, n, fps: fr.fps };
}

/** Mean absolute difference between frames a and b of a frame stack. */
export function differ(fr) { const N = fr.W * fr.H, raw = fr.raw; return (a, b) => { let d = 0; const oa = a * N, ob = b * N; for (let i = 0; i < N; i++) { const v = raw[oa + i] - raw[ob + i]; d += v < 0 ? -v : v; } return d / N; }; }

/** The ordinary change from one frame to the next (the median), which a seam is judged against. */
export function typicalStep(fr) { const diff = differ(fr); const s = []; for (let i = 0; i < fr.n - 1; i++) s.push(diff(i, i + 1)); s.sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; }

/**
 * Every way to cut one repetition out of a frame stack: for each length (in frames) the best start, where
 * "best" is prep8.mjs's score = how alike the first and last frames are (and the frames after them, so the
 * movement also continues the same way), divided by how far the picture travels in between (a pause where
 * nothing moves also starts and ends alike, and must not win).
 * Returns { byLen: [{ len, a, d, range, score }], mean: Float32Array (average change over a lag), step }.
 */
export function repTable(sq, minF, maxF) {
  const n = sq.n; const diff = differ(sq); maxF = Math.min(maxF, n - 3); const Lw = maxF + 2;
  const D = new Float32Array(n * Lw).fill(-1); const dd = (a, b) => { const k = a * Lw + (b - a); let v = D[k]; if (v < 0) { v = diff(a, b); D[k] = v; } return v; };
  const byLen = []; const sum = new Float64Array(maxF + 1), cnt = new Int32Array(maxF + 1);
  for (let a = 0; a < n - 2; a++) {
    let range = 0;
    for (let b = a + 1; b <= Math.min(n - 2, a + maxF); b++) {
      const L = b - a; const dab = dd(a, b); sum[L] += dab; cnt[L]++;
      if (L >= minF) { const d = (dab + dd(a + 1, b + 1)) / 2; const score = d / Math.max(range, 0.01); const cur = byLen[L]; if (!cur || score < cur.score) byLen[L] = { len: L, a, d, range, score }; }
      if (dab > range) range = dab;
    }
  }
  const mean = new Float32Array(maxF + 1); for (let L = 1; L <= maxF; L++) mean[L] = cnt[L] ? sum[L] / cnt[L] : 0;
  return { byLen: byLen.filter(Boolean), mean, counts: cnt };
}

/**
 * How long one repetition is, when nobody says: the average change between frames a lag apart drops at every
 * whole number of repetitions. Dips that are not clearly below the hump before them are ignored; of the rest,
 * the first one about as deep as the deepest is the period. So a left-right exercise whose two sides look
 * different gives the full cycle, and one whose sides look the same gives one side.
 * Returns the lag in frames, or 0 when the span shows no clear repetition.
 */
export function periodOf(mean, fromF, minPairs, counts) {
  const n = mean.length; const sm = new Float32Array(n); for (let L = 1; L < n; L++) sm[L] = (mean[Math.max(1, L - 1)] + mean[L] + mean[Math.min(n - 1, L + 1)]) / 3;
  const dips = []; let hump = 0;
  for (let L = 2; L < n - 1; L++) {
    if (sm[L] > hump) hump = sm[L];
    if (L < fromF || (counts && counts[L] < minPairs)) continue;
    if (sm[L] <= sm[L - 1] && sm[L] <= sm[L + 1] && sm[L] <= 0.72 * hump) dips.push({ L, v: sm[L] });
  }
  if (!dips.length) return 0;
  const deepest = Math.min(...dips.map((d) => d.v)); return dips.find((d) => d.v <= 1.2 * deepest).L;
}

/**
 * One clean repetition of a stack of square frames (see squareFrames). `period` in seconds narrows the search to
 * 0.6x-1.6x of it; without it the period is estimated, and when that fails any length from minS to maxS may win.
 * Returns { a, b, start, length, seam, range, score, typicalStep, ratio, period, periodFrom } (times in seconds
 * from the first frame), or null when the span is too short to hold one.
 */
export function findRep(sq, { period = 0, minS = 1, maxS = 7 } = {}) {
  const fps = sq.fps; const n = sq.n; let lo, hi, from = 'given';
  const loAll = Math.max(2, Math.round(Math.min(minS, period ? 0.6 * period : minS) * fps)), hiAll = Math.min(n - 3, Math.round(Math.max(maxS, period ? 1.6 * period : maxS) * fps));
  if (hiAll < loAll) return null;
  const t = repTable(sq, loAll, hiAll); if (!t.byLen.length) return null;
  if (period > 0) { lo = Math.round(0.6 * period * fps); hi = Math.round(1.6 * period * fps); } else {
    const P = periodOf(t.mean, Math.round(0.5 * fps), 3, t.counts);
    if (P) { period = P / fps; lo = Math.max(Math.round(minS * fps), Math.round(0.6 * P)); hi = Math.min(Math.round(maxS * fps), Math.round(1.6 * P)); from = 'estimated'; } else { lo = Math.round(minS * fps); hi = Math.round(maxS * fps); from = 'none'; }
  }
  let pool = t.byLen.filter((s) => s.len >= lo && s.len <= hi); if (!pool.length) { pool = t.byLen; from += ', window empty'; }
  const best = pool.slice().sort((p, q) => p.score - q.score)[0]; const step = typicalStep(sq); let full = 0; for (const s of t.byLen) if (s.range > full) full = s.range;
  return { a: best.a, b: best.a + best.len, start: best.a / fps, length: best.len / fps, seam: best.d, range: best.range, fullRange: full, score: best.score, typicalStep: step, ratio: best.d / Math.max(step, 1e-6), period: period || 0, periodFrom: from };
}

// ---- shared by the queue tools (queue-plan.mjs, run-log.mjs, db-docs.mjs, result-doc.mjs)
import fsLib from 'node:fs'; import pathLib from 'node:path';

/** <workDir>/queue-runs.json: one record per queue request that was started (run-log.mjs writes it). [] when there is none. */
export function readRuns(workDir) {
  const f = pathLib.join(workDir, 'queue-runs.json'); if (!fsLib.existsSync(f)) return [];
  try { const j = JSON.parse(fsLib.readFileSync(f, 'utf8')); return Array.isArray(j) ? j.filter((r) => r && typeof r === 'object') : []; } catch (e) { process.stderr.write(`queue-runs.json cannot be read (${e.message}): ${f}. Mend it or move it away first: it says which requests were already paid for\n`); process.exit(1); }
  return [];
}
export function writeRuns(workDir, runs) { const f = pathLib.join(workDir, 'queue-runs.json'); const tmp = `${f}.tmp`; fsLib.writeFileSync(tmp, `${JSON.stringify(runs, null, 1)}\n`); fsLib.renameSync(tmp, f); }

/**
 * How far apart in time the .json files of one exported collection folder were written: { files, minutes, oldestFile }.
 * One export writes all its files within moments; a file much older than the newest was left by an earlier export.
 */
export function exportSpread(dir) {
  let lo = Infinity, hi = -Infinity, oldest = null, n = 0; if (!fsLib.existsSync(dir)) return { files: 0, minutes: 0, oldestFile: null };
  for (const f of fsLib.readdirSync(dir)) { if (!f.endsWith('.json')) continue; const t = fsLib.statSync(pathLib.join(dir, f)).mtimeMs; n++; if (t < lo) { lo = t; oldest = f; } if (t > hi) hi = t; }
  return { files: n, minutes: n ? (hi - lo) / 60000 : 0, oldestFile: oldest };
}
