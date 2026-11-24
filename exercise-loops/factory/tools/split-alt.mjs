#!/usr/bin/env node
// split.mjs <video> --out <json> [--debug <dir>] [--truth <truth.json>]
//
// Movement splitter, builder B ("self-similarity novelty"). One raw phone video in; out, the stretches of repeated exercise
// ("bouts"), told apart by movement, with everything else marked junk. Pure Node 22 + ffmpeg/ffprobe, no packages.
// It does not need hard cuts: a bout is found from its own repetition. Cuts and crossfades, where a video has them, are found too.
//
// HOW IT WORKS
//  1. Decode ONCE to a small gray proxy (long side 128 px, 10 frames a second, ffmpeg -> raw frames on stdout).
//  2. Each frame -> block means (4x4 px blocks, the frame's own mean taken out). d0(i,j) = mean absolute difference of two
//     frames' blocks: the self-similarity matrix. NOISE = what d0 reads between two frames of a picture where nothing moves
//     (each frame's distance to the frame most like it; the 10th percentile over the video). Every amplitude below is a
//     multiple of NOISE or of another distance measured in the same video; times are seconds or periods. No gray levels, no pixels.
//  3. Foote novelty (Gaussian checkerboard kernel on the matrix) at two scales, 0.6 s and 3 s (drawn on the debug timeline).
//     A SCENE CHANGE is a peak of the short scale where the picture changes for good: more than half of the blocks differ
//     across it by a quarter of the picture's own contrast, and within 3 s (the long scale) no frame after it comes back to a
//     frame before it (the closest pair across is at least half as far apart as the typical pair across). A pose change of
//     an exercise returns, or moves a small part of the picture, so it is not one. No repetition is searched across a scene change.
//  4. WHERE THE PICTURE IS ALIVE. A block "changes" at a step when it moves by more than ACT x the video's median block step.
//     Each frame gets block weights = how much each block changed within ACT_WIN seconds of it (each step counted up to
//     ACT_CAP x the median step, so one big jump -- a passer-by, a cut -- weighs little), plus a small floor. DW(a, L) = the
//     weighted distance between frames a and a+L. In a busy gym this keeps the athlete and drops most of the background;
//     in a still picture it is d0. NOISE_W = its noise, measured the same way.
//  5. LOOP CLOSURES = the off-diagonal stripes. For a frame i, walking forward in time: the picture first LEAVES (the
//     distance grows to R, the excursion, at least THETA x NOISE_W) and later RETURNS (distance under TAU x R). The distance
//     is the mean of DW along the diagonal over 0.5 s forward or backward (each pair may slip by one proxy frame, JIT), so a
//     return has to MOVE the same way (going down through a pose does not match coming up through it). A return whose valley
//     is sharp (the picture is different again a quarter of the lag earlier and later) is a STRIPE closure: it pairs two
//     moving moments one repetition apart.
//  6. BOUTS: runs of stripe closures; the lag most of them agree on per unit of lag (a rep seen N times gives N-1 periods of
//     stripes at its period, fewer at every multiple); the stretch the closures within LAG_TOL of that lag cover. A bout is
//     an exercise when it spans at least 1 + MIN_STRIPE periods and (a) its stripes last MIN_STRIPE_S, counted on both sides
//     (as many different return frames as anchor frames: a still pose visited again for a moment is one return frame); (b) at least MIN_STRIPE of one period's
//     MOVEMENT returns at that lag (still frames return to anything and prove nothing; an exercise with long holds moves for
//     a small part of its period); (c) the excursion is THETA x NOISE in the plain picture too.
//     A "repeat of repeats" -- under two periods long and mostly filled by two or more candidates of a shorter period (two
//     short bouts of one movement with a pause between them return at the lag from one bout to the next) -- is left out
//     and counts as the evidence for the bouts inside it.
//  7. FALLBACK for movements that come back to a rest pose without repeating frame for frame (left arm, then right arm): a
//     chain of at least two loops, rest pose to rest pose, one right after the other and of like length. Scored 0.45 at most.
//  8. SAME MOVEMENT? Two bouts get the same group when the poses of each are found in the other (nearest-neighbour distance,
//     upper quartile, small against the bouts' own rep-to-rep distance or against their range of poses) and the periods are
//     within GROUP_P; or when one follows the other in the same scene, with the same period, after a short pause in which the
//     athlete keeps moving (a set carried on after a change of side or grip).
//  9. ENDS: with two or more whole reps the bout is trimmed to whole reps (the placement whose ends match best); with fewer
//     it is left as found, so the rep picker downstream can choose its seam.
// 10. CROP: per pixel of the proxy, how much it varies over the bout (5th..95th percentile); strongly varying pixels seed,
//     weakly varying ones (the planted feet, the trunk) join the blob they touch; the box of the biggest blob and its near
//     neighbours, padded 8 % of its longer side, in source pixels as shown (rotation applied).
// 11. CAMERA: the column and row profiles of two frames in a row (and of two frames a second apart) fit best at no shift
//     when only the athlete moves. Where they fit clearly better at a shift, the picture itself slides: the JSON says so
//     (camera.sliding = share of such steps, camera.steady) and a bout filmed that way has its score halved and says so.
// 12. SCORE (0..1): how much of a period's movement was seen again, how many reps, how closely the returns match. Chains
//     score low. A bout the splitter does not stand behind is not reported as exercise at all: the junk segment's "why"
//     then says what was seen ("movement, but not enough repetition (1.3 reps of 7.2 s seen)").
//
// THRESHOLDS: all in CFG below, all relative to the video's own measurements (NOISE, the median block step, the picture
// contrast, the bout's own period, excursion and movement). Besides CFG the code holds only shares of those same things:
// the 10 % lag smoothing of the lag histogram, the +-10 % search around a whole number of periods when trimming, the 0.3 s
// that two loops may differ at their end, the 2.5x that chained loops may differ in length, and the crop's seed/join levels
// (4x and 2x the quiet-pixel spread, 35 % and 12 % of the liveliest).
//
// KNOWN LIMITS (see the builder's report): the camera must stand still (a hand-held or sliding phone breaks the matching;
// it is flagged, not fixed); a bout of under about two reps of a slow movement with long holds is usually
// missed; an athlete under about a sixth of the frame height is too small for the proxy; a movement that never comes back
// to the same picture (walking lunges across the frame) has no stripes; two different exercises with the same period done
// back to back in the same spot come out as two bouts with ONE group.
//
// OUTPUT: { video, duration, fps, width, height, camera: { sliding, steady }, segments: [ { idx, start, end, kind, group, period, reps, crop: [w,h,x,y], score, why } ] }
// width/height are the picture as shown (rotation applied), which is what an ffmpeg crop filter sees.
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib'; import { execFileSync, spawnSync } from 'node:child_process';

export const CFG = {
  FPS: 10,            // proxy frames a second
  LONG: 128,          // proxy long side, px
  BLOCK: 4,           // block size for the features, px of the proxy
  EMB: 0.5,           // s: length of the diagonal mean (direction of movement)
  LAG_MIN: 0.5,       // s: shortest repetition
  LAG_MAX: 10,        // s: longest repetition
  JIT: 1,             // proxy frames a return may come early or late (a period is not a whole number of proxy frames)
  THETA: 4,           // an excursion is at least THETA x NOISE above the noise
  TAU: 0.35,          // a return is a distance under TAU x the excursion
  SHARP: 0.3,         // stripe: a quarter lag before and after the return the distance is back up by SHARP x the excursion
  LAG_TOL: 1.3,       // closures of one bout have lags within this factor of the period
  MIN_STRIPE: 0.3,    // share of one period's movement that must return at the bout's lag
  MIN_STRIPE_S: 0.4,  // s: stripes of a bout last at least this long, counted on both sides
  NOV: [0.6, 3],      // s: half-widths of the two checkerboard kernels (the long one is also how far "for good" looks)
  SCENE: 0.5,         // scene change: the closest pair of frames across it is still SCENE x as far apart as the typical pair across ...
  SCENE_AREA: 0.5,    // ... and more than this share of the blocks changed across it ...
  SCENE_BLOCK: 0.25,  // ... by more than SCENE_BLOCK x the picture contrast (the spread of the block values of a frame)
  ACT: 4,             // a block is "changing" at a step when it moves by more than ACT x the video's median block step ...
  ACT_CAP: 24,        // ... and a step counts for at most ACT_CAP x that median step
  ACT_WIN: 4,         // s: a block's weight for a frame = how much it changed within ACT_WIN of the frame (same scene)
  ACT_FLOOR: 0.05,    // ... plus this share of the mean weight for every block
  GAP: 1.25,          // chain fallback: loops follow each other within GAP x the median loop length ...
  LAP: 0.2,           // ... and one may start up to LAP x its own length before the one before it ends
  GROUP_Q: 3,         // same movement: cross nearest-neighbour distance under GROUP_Q x the bouts' own rep-to-rep distance ...
  GROUP_R: 0.3,       // ... or under GROUP_R x the smaller range of poses ...
  GROUP_P: 1.6,       // ... and periods within this factor;
  GROUP_GAP: 2,       // or the bout follows the one before within GROUP_GAP periods, same period, same scene, the athlete moving ...
  MOVE: 0.1,          // ... where a frame "moves" when its movement is over MOVE x the mean movement of the two bouts
  CAM_SHIFT: 0.03,    // camera check: the whole picture slides by up to this share of the long side between two frames ...
  CAM_FIT: 0.7,       // ... when the frame profiles fit at that shift with under CAM_FIT x the misfit at no shift
  CAM_BOUT: 0.2,      // a bout during which more than this share of the steps slide is marked "camera not steady" and its score halved
  PAD: 0.08,          // crop padding, share of the box's longer side
};

if (process.env.SPLIT_CFG) Object.assign(CFG, JSON.parse(process.env.SPLIT_CFG)); // lab only: try other settings without editing the file

// ---------- small helpers ----------
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const r3 = (v) => Math.round(v * 1000) / 1000;
const quant = (arr, p) => { if (!arr.length) return 0; const s = Float64Array.from(arr).sort(); return s[clamp(Math.floor(p * (s.length - 1) + 0.5), 0, s.length - 1)]; };
const median = (arr) => quant(arr, 0.5);

// ---------- video in ----------
export function probe(file) {
  const j = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,avg_frame_rate,r_frame_rate,duration:stream_side_data=rotation:stream_tags=rotate:format=duration', '-of', 'json', file]).toString());
  const s = j.streams && j.streams[0]; if (!s) throw new Error('no video stream in ' + file);
  const ratio = (q) => { const [a, b] = String(q || '0').split('/').map(Number); return b ? a / b : a || 0; };
  let rot = 0; const sd = (s.side_data_list || []).find((d) => d.rotation !== undefined); if (sd) rot = -Number(sd.rotation); else if (s.tags && s.tags.rotate !== undefined) rot = Number(s.tags.rotate);
  rot = ((Math.round(rot / 90) * 90) % 360 + 360) % 360; let w = s.width, h = s.height; if (rot % 180 === 90) [w, h] = [h, w];
  const avg = ratio(s.avg_frame_rate), real = ratio(s.r_frame_rate); const fps = avg > 0 && avg < 1000 ? avg : real;
  return { file, width: w, height: h, fps, duration: Number((j.format && j.format.duration) || s.duration || 0), rotation: rot };
}

/** The whole video as gray frames, long side CFG.LONG, CFG.FPS a second: one ffmpeg pass, raw frames from stdout. */
export function readProxy(info, proxyFile) { // proxyFile: a small upright copy of the same video with the same clock (ingest.mjs), read instead of a heavy original
  const k = CFG.LONG / Math.max(info.width, info.height); const even = (v) => Math.max(2, Math.round(v / 2) * 2);
  const W = info.width >= info.height ? CFG.LONG : even(info.width * k), H = info.width >= info.height ? even(info.height * k) : CFG.LONG;
  const decode = (file, extra) => spawnSync('ffmpeg', ['-nostdin', '-loglevel', 'error', '-skip_loop_filter', 'all', ...extra, '-i', file, '-an', '-sn', '-vf', `fps=${CFG.FPS},scale=${W}:${H}:flags=area,format=gray`, '-f', 'rawvideo', '-'], { maxBuffer: 2 ** 31 - 1 });
  let r = proxyFile && fs.existsSync(proxyFile) ? decode(proxyFile, []) : null; if (!r || r.error || r.status !== 0 || (r.stdout || []).length < 2 * W * H) r = decode(info.file, info.fps >= 50 ? ['-skip_frame', 'noref'] : []); // at 50 fps and up, frames nothing is predicted from are not decoded
  if (r.status !== 0 || !r.stdout) throw new Error('ffmpeg failed: ' + String(r.stderr || (r.error && r.error.message)).trim().split('\n').slice(-2).join(' | '));
  return { W, H, n: Math.floor(r.stdout.length / (W * H)), raw: r.stdout, fps: CFG.FPS };
}

// ---------- the analysis ----------
export function analyse(px, info) {
  const { W, H, n, raw, fps } = px; const dur = info.duration || n / fps; const T = (f) => clamp(f / fps, 0, dur);
  const out = { n, fps, notes: [] };
  if (n < 2 * fps) { out.bouts = []; out.cuts = []; out.empty = true; return out; }
  // 2. features and plain distances
  const B = CFG.BLOCK, bw = Math.floor(W / B), bh = Math.floor(H / B), D = bw * bh; const F = new Float32Array(n * D);
  for (let i = 0; i < n; i++) { let m = 0; const o = i * W * H;
    for (let by = 0; by < bh; by++) for (let bx = 0; bx < bw; bx++) { let s = 0; for (let y = 0; y < B; y++) { const r = o + (by * B + y) * W + bx * B; for (let x = 0; x < B; x++) s += raw[r + x]; } s /= B * B; F[i * D + by * bw + bx] = s; m += s; }
    m /= D; for (let k = 0; k < D; k++) F[i * D + k] -= m; }
  const contrast = new Float32Array(n); for (let i = 0; i < n; i++) { let s2 = 0; for (let k = 0; k < D; k++) s2 += F[i * D + k] ** 2; contrast[i] = Math.sqrt(s2 / D); } // spread of the block values of each frame
  const d0 = new Float32Array(n * n);
  for (let i = 0; i < n; i++) { const a = i * D; for (let j = i + 1; j < n; j++) { const b = j * D; let s = 0; for (let k = 0; k < D; k++) { const v = F[a + k] - F[b + k]; s += v < 0 ? -v : v; } d0[i * n + j] = d0[j * n + i] = s / D; } }
  // noise: each frame's distance to the frame most like it (any other frame of the video); the 10th percentile of those.
  // On a tripod that is two frames of a picture where nothing moved. It stays high when the camera itself never rests.
  let noise; { const nn = new Float32Array(n); for (let i = 0; i < n; i++) { let mn = Infinity; const o = i * n; for (let j = 0; j < n; j++) if (j !== i && d0[o + j] < mn) mn = d0[o + j]; nn[i] = mn; } noise = Math.max(quant(nn, 0.1), 0.02); }
  const step = new Float32Array(n); for (let i = 0; i + 1 < n; i++) step[i] = d0[i * n + i + 1]; step[n - 1] = step[n - 2];
  const mot = new Float32Array(n); for (let i = 0; i < n; i++) mot[i] = (step[Math.max(0, i - 1)] + step[i]) / 2;
  Object.assign(out, { d0, noise, step, mot, D });

  // 3. Foote novelty at two scales (Gaussian-tapered checkerboard): cross-block distance minus within-block distance
  const novelty = (wS) => { const w = Math.max(2, Math.round(wS * fps)); const g = new Float32Array(w); for (let k = 0; k < w; k++) g[k] = Math.exp(-0.5 * ((k + 0.5) / (w / 2)) ** 2); const nv = new Float32Array(n);
    for (let c = 1; c < n; c++) { let cr = 0, cw = 0, wi = 0, ww = 0;
      for (let a = 1; a <= w; a++) { const ia = c - a; if (ia < 0) break; const ga = g[a - 1];
        for (let b = 0; b < w; b++) { const ib = c + b; if (ib >= n) break; const k2 = ga * g[b]; cr += k2 * d0[ia * n + ib]; cw += k2; }
        for (let a2 = a + 1; a2 <= w; a2++) { const ia2 = c - a2; if (ia2 < 0) break; const k2 = ga * g[a2 - 1]; wi += k2 * d0[ia * n + ia2]; ww += k2; } }
      for (let b = 0; b < w; b++) { const ib = c + b; if (ib >= n) break; for (let b2 = b + 1; b2 < w; b2++) { const ib2 = c + b2; if (ib2 >= n) break; const k2 = g[b] * g[b2]; wi += k2 * d0[ib * n + ib2]; ww += k2; } }
      nv[c] = cw > 0 && ww > 0 ? Math.max(0, cr / cw - wi / ww) : 0; }
    return nv; };
  const nov1 = novelty(CFG.NOV[0]), nov2 = novelty(CFG.NOV[1]); Object.assign(out, { nov1, nov2 });
  const m = Math.max(1, Math.round(CFG.EMB * fps)), Lmin = Math.max(2, Math.round(CFG.LAG_MIN * fps)), Lmax = Math.min(n - 1, Math.round(CFG.LAG_MAX * fps)), LW = Lmax + 1;

  let m0; { const smp = []; const stp = Math.max(1, Math.floor((n - 1) * D / 60000)); for (let x = 0; x < (n - 1) * D; x += stp) { const v = F[x + D] - F[x]; smp.push(v < 0 ? -v : v); } m0 = Math.max(median(smp), 1e-3); }
  const actT = CFG.ACT * m0;
  // 3b. scene changes: a peak of the short novelty where the picture changes FOR GOOD: most blocks differ across it, and within
  // NOV[1] seconds no frame after it comes back to any frame before it (the closest pair across is still SCENE x as far apart as
  // the typical pair across). A pose change inside an exercise is not one: it returns, or it moves a small part of the picture.
  const cuts = []; { const w = Math.round(CFG.NOV[0] * fps), g = Math.max(1, Math.round(w / 2)), wS = Math.round(CFG.NOV[1] * fps);
    for (let c = 1; c < n - 1; c++) { if (nov1[c] < CFG.THETA * noise) continue; let peak = true; for (let k = -w; k <= w; k++) { const cc = c + k; if (cc > 0 && cc < n && (nov1[cc] > nov1[c] || (nov1[cc] === nov1[c] && k < 0))) { peak = false; break; } } if (!peak) continue;
      const i0 = Math.max(0, c - wS), i1 = c - 1 - g, j0 = c + g, j1 = Math.min(n - 1, c + wS); if (i1 - i0 < g || j1 - j0 < g) continue;
      { let ch = 0; const ao = i1 * D, bo = j0 * D; for (let k = 0; k < D; k++) { const v = F[ao + k] - F[bo + k]; if ((v < 0 ? -v : v) > CFG.SCENE_BLOCK * (contrast[i1] + contrast[j0]) / 2) ch++; } if (ch < CFG.SCENE_AREA * D) continue; }
      let mn = Infinity; const vals = []; const si = Math.max(1, Math.floor((i1 - i0 + 1) / 30)), sj = Math.max(1, Math.floor((j1 - j0 + 1) / 30));
      for (let i = i0; i <= i1; i++) { const o = i * n; const pick = (i - i0) % si === 0; for (let j = j0; j <= j1; j++) { const v = d0[o + j]; if (v < mn) mn = v; if (pick && (j - j0) % sj === 0) vals.push(v); } }
      if (mn - noise >= CFG.SCENE * Math.max(median(vals) - noise, CFG.THETA * noise)) cuts.push(c); } }
  const sceneOf = new Int32Array(n); const sc0 = [0], sc1 = []; { let s = 0, k = 0; for (let i = 0; i < n; i++) { if (k < cuts.length && i >= cuts[k]) { sc1.push(i - 1); sc0.push(i); s++; k++; } sceneOf[i] = s; } sc1.push(n - 1); }

  // 3c. is the camera steady? The column and row profiles of two frames in a row fit best at a shift of zero when only the athlete
  // moves; when the whole picture slides they fit clearly better (CAM_FIT) up to CAM_SHIFT away. cam[t] = 1 at such a step,
  // 2 when the picture has slid against the frame one second earlier (a slow slide), never across a scene change.
  const cam = new Uint8Array(n); { const S = Math.max(1, Math.round(CFG.CAM_SHIFT * Math.max(W, H))); const col = new Float32Array(n * W), row = new Float32Array(n * H);
    for (let t = 0; t < n; t++) { const o = t * W * H; for (let y = 0; y < H; y++) { let s = 0; const r = o + y * W; for (let x = 0; x < W; x++) { const v = raw[r + x]; s += v; col[t * W + x] += v; } row[t * H + y] = s / W; } for (let x = 0; x < W; x++) col[t * W + x] /= H; }
    const slid = (P, len, t, K) => { let bv = Infinity, b = 0, v0 = 0; for (let d = -S; d <= S; d++) { let s = 0, c = 0; for (let x = Math.max(0, -d); x < Math.min(len, len - d); x++) { const v = P[t * len + x] - P[(t + K) * len + x + d]; s += v < 0 ? -v : v; c++; } s /= Math.max(1, c); if (d === 0) v0 = s; if (s < bv) { bv = s; b = d; } } return b !== 0 && bv < CFG.CAM_FIT * v0; };
    for (let t = 0; t + 1 < n; t++) if (slid(col, W, t, 1) || slid(row, H, t, 1)) cam[t] = 1; const K = Math.round(fps); for (let t = 0; t + K < n; t++) if (!cam[t] && sceneOf[t] === sceneOf[t + K] && (slid(col, W, t, K) || slid(row, H, t, K))) cam[t] = 2; }
  let camShare = 0; for (let t = 0; t < n; t++) if (cam[t]) camShare++; camShare /= n; Object.assign(out, { cam, camShare });

  // 4a. where is the picture alive? A block is "changing" at a step when it moves by more than ACT x the video's median block step.
  // weight of block k for anchor frame a = how much k changed over the steps within ACT_WIN seconds of a (same scene), each step
  // counted up to ACT_CAP x the median step (someone walking through the background changes a block for a moment; the athlete
  // changes his blocks all through the bout), plus a small uniform floor. DW(a, L) = weighted mean absolute block difference between frames a and a+L.
  const actC = CFG.ACT_CAP * m0; const PA = new Float32Array(n * D); for (let t = 0; t + 1 < n; t++) { const o = t * D; for (let k = 0; k < D; k++) { let v = F[o + D + k] - F[o + k]; if (v < 0) v = -v; PA[o + D + k] = PA[o + k] + (v > actT ? (v < actC ? v : actC) : 0); } }
  const hW = Math.max(1, Math.round(CFG.ACT_WIN * fps)); const wv = new Float32Array(D);
  const weightsFor = (a) => { const s = sceneOf[a], lo = Math.max(sc0[s], a - hW), hi = Math.min(sc1[s], a + hW), len = Math.max(1, hi - lo); let mw = 0; for (let k = 0; k < D; k++) { const v = (PA[hi * D + k] - PA[lo * D + k]) / len; wv[k] = v; mw += v; } const eps = CFG.ACT_FLOOR * mw / D + 1e-3; let ws = 0; for (let k = 0; k < D; k++) { wv[k] += eps; ws += wv[k]; } return ws; };
  const DW = new Float32Array(n * LW).fill(Infinity);
  for (let a = 0; a < n; a++) { const ws = weightsFor(a); const jm = Math.min(sc1[sceneOf[a]], a + Lmax), ao = a * D; for (let j = a + 1; j <= jm; j++) { const bo = j * D; let s = 0; for (let k = 0; k < D; k++) { const v = F[ao + k] - F[bo + k]; s += wv[k] * (v < 0 ? -v : v); } DW[a * LW + (j - a)] = s / ws; } }
  const wdist = (a, b) => { if (a > b) [a, b] = [b, a]; const ws = weightsFor(a), ao = a * D, bo = b * D; let s = 0; for (let k = 0; k < D; k++) { const v = F[ao + k] - F[bo + k]; s += wv[k] * (v < 0 ? -v : v); } return s / ws; };
  // its noise: as above, the distance to the most alike frame within LAG_MAX, 10th percentile
  let noiseW; { const nn = new Float32Array(n).fill(Infinity); for (let a = 0; a < n; a++) for (let L = 1; L <= Lmax && a + L < n; L++) { const v = DW[a * LW + L]; if (v < nn[a]) nn[a] = v; if (v < nn[a + L]) nn[a + L] = v; } noiseW = Math.max(quant(Array.from(nn).filter((v) => v < 1e9), 0.1), 0.02); }
  const M = new Float32Array(n); for (let i = 0; i < n; i++) { const v = DW[i * LW + 1]; M[i] = v < 1e9 ? Math.max(0, v - noiseW) : 0; } // movement at each frame, above the noise
  Object.assign(out, { noiseW, M, m0 });

  // 4b. loop closures. Q(i, L) = min(forward, backward) diagonal mean of DW at lag L, over EMB seconds, inside one scene.
  const Q = new Float32Array(n * LW).fill(Infinity);
  { const pre = new Float64Array(n + 1); const J = Math.round(CFG.JIT); for (let s = 0; s < sc0.length; s++) { const s0 = sc0[s], s1 = sc1[s]; for (let L = 1; L <= Math.min(Lmax, s1 - s0); L++) { const len = s1 - s0 - L + 1; pre[0] = 0; for (let x = 0; x < len; x++) { const o = (s0 + x) * LW; let v = DW[o + L]; for (let d = Math.max(1, L - J); d <= Math.min(Lmax, L + J); d++) if (DW[o + d] < v) v = DW[o + d]; pre[x + 1] = pre[x] + v; }
        for (let x = 0; x < len; x++) { const f1 = Math.min(len - 1, x + m), b0 = Math.max(0, x - m); const ff = f1 - x >= 2 ? (pre[f1 + 1] - pre[x]) / (f1 - x + 1) : Infinity, fb = x - b0 >= 2 ? (pre[x + 1] - pre[b0]) / (x - b0 + 1) : Infinity; Q[(s0 + x) * LW + L] = Math.min(ff, fb); } } } }
  const qx = (i, L) => Math.max(0, Q[i * LW + L] - noiseW); // distance above the noise
  const theta = CFG.THETA * noiseW;
  // for anchor i, each valley of the return: its lags L1..L2, the best lag L (j = i + L), the distance q there and the excursion R before it
  const closures = [];
  for (let i = 0; i < n - Lmin; i++) { let R = 0, cur = null, miss = 0, order = 0;
    for (let L = 1; L <= Lmax && i + L < n; L++) { const q = qx(i, L); if (!(q < 1e9)) continue;
      const inValley = R >= theta && L >= Lmin && q <= CFG.TAU * R;
      if (inValley) { miss = 0; if (!cur) cur = { i, j: i + L, L, L1: L, L2: L, q, R }; else { cur.L2 = L; if (q < cur.q) { cur.q = q; cur.L = L; cur.j = i + L; cur.R = R; } } }
      else if (cur && ++miss >= 2) { cur.order = order++; closures.push(cur); cur = null; miss = 0; }
      if (q > R) R = q; }
    if (cur) { cur.order = order++; closures.push(cur); } }
  // sharpness of each valley: a quarter lag (at least EMB) before and after the return, the distance is back up
  for (const c of closures) { const w = Math.max(m, Math.round(c.L / 4)); const lo = c.L - w >= 1 ? qx(c.i, c.L - w) : Infinity, hi = c.L + w <= Lmax && c.i + c.L + w < n ? qx(c.i, c.L + w) : Infinity;
    const side = Math.min(lo, hi); c.sharp = side < 1e9 ? (side - c.q) / Math.max(c.R - c.q, 1e-6) : 0; c.ratio = c.q / c.R; c.stripe = c.sharp >= CFG.SHARP; }
  Object.assign(out, { cuts, closures, Q, Lmax, qx, sceneOf });

  // 5. bouts from stripe closures: runs of stripes -> the lag most of them agree on (per unit of lag: a rep seen N times gives N-1
  // periods of stripes at its period and fewer at every multiple) -> the stretch those cover. Evidence = the share of one period's
  // MOVEMENT that returns at that lag, sharp valley or not (still frames return to anything and prove nothing; an exercise with long
  // holds moves for a small part of its period, and the hold's return is a wide valley).
  const bouts = []; const taken = new Uint8Array(n);
  const runsOf = (set) => { const diff = new Int32Array(n + 1); for (const c of set) { diff[c.i]++; diff[c.j + 1]--; } const runs = []; let acc = 0, s0 = -1; for (let i = 0; i <= n; i++) { acc += i < n ? diff[i] : -acc; if (acc > 0 && s0 < 0) s0 = i; if (acc <= 0 && s0 >= 0) { runs.push([s0, i - 1]); s0 = -1; } } return runs; };
  const modeLag = (set) => { const h = new Float32Array(Lmax + 2); for (const c of set) h[c.L] += 1; let bestL = 0, bestV = 0; for (let L = Lmin; L <= Lmax; L++) { const w = Math.max(1, Math.round(L * 0.1)); let v = 0; for (let k = -w; k <= w; k++) { const LL = L + k; if (LL >= 1 && LL <= Lmax) v += h[LL] * (1 - Math.abs(k) / (w + 1)); } v /= L; if (v > bestV * 1.0001) { bestV = v; bestL = L; } } return bestL; };
  const plainR = (c) => { let mx = 0; const o = c.i * n; for (let j = c.i + 1; j <= c.j; j++) if (d0[o + j] > mx) mx = d0[o + j]; return Math.max(0, mx - noise); };
  const pool = closures.filter((c) => c.stripe);
  for (const [ra, rb] of runsOf(pool)) { let rest = pool.filter((c) => c.i >= ra && c.j <= rb);
    for (let round = 0; round < 6 && rest.length >= 3; round++) { const P0 = modeLag(rest); if (!P0) break; const cons = rest.filter((c) => c.L >= P0 / CFG.LAG_TOL && c.L <= P0 * CFG.LAG_TOL); const got = [];
      for (const [a, b] of runsOf(cons)) { const set = cons.filter((c) => c.i >= a && c.j <= b); const P = median(set.map((c) => c.L)); const anchors = new Set(set.map((c) => c.i)), returns = new Set(set.map((c) => c.j));
        const covered = new Set(anchors); for (const c of closures) if (c.i >= a && c.i <= b && c.L2 >= P / CFG.LAG_TOL && c.L1 <= P * CFG.LAG_TOL && c.i + clamp(Math.round(P), c.L1, c.L2) <= b) covered.add(c.i);
        let ma = 0, mt = 0; for (const i of covered) ma += M[i]; for (let i = a; i <= b; i++) mt += M[i]; const per = mt * P / (b - a + 1);
        const bout = { a, b, P, set, stripe: Math.min(anchors.size, returns.size) / fps, share: per > 0 ? ma / per : 0, reps: (b - a) / P, ratio: median(set.map((c) => c.ratio)), R: median(set.map((c) => c.R)), q: median(set.map((c) => c.q)), Rp: median(set.map(plainR)), via: 'stripes' };
        bout.ok = bout.stripe >= CFG.MIN_STRIPE_S && bout.share >= CFG.MIN_STRIPE && bout.reps >= 1 + CFG.MIN_STRIPE && bout.Rp >= CFG.THETA * noise; got.push(bout); }
      const okb = got.filter((g) => g.ok); for (const g of got) bouts.push(g);
      rest = rest.filter((c) => !cons.includes(c) && !okb.some((g) => c.i <= g.b && c.j >= g.a && c.L > g.P)); if (!cons.length) break; } } // a good bout takes the longer lags over it with it (its multiples); shorter ones may still be bouts inside it
  // a repeat of repeats: a good candidate whose span is mostly filled by two or more candidates of a shorter period (two short bouts of
  // one movement with a pause between them return at the lag from one bout to the next). It is left out, and it is the evidence for
  // the bouts inside it: their movement was seen again, one bout later.
  for (const g of bouts.filter((b) => b.ok).sort((p, q) => q.P - p.P)) { const inner = bouts.filter((h) => h !== g && !h.nested && h.P < g.P / CFG.LAG_TOL && Math.min(h.b, g.b) - Math.max(h.a, g.a) >= 0.8 * (h.b - h.a)).sort((p, q) => p.a - q.a); if (inner.length < 2 || g.reps >= 2) continue;
    let cov = 0, end = g.a - 1; for (const h of inner) { const s0 = Math.max(h.a, end + 1), e0 = Math.min(h.b, g.b); if (e0 >= s0) { cov += e0 - s0 + 1; end = e0; } } if (cov < 0.5 * (g.b - g.a + 1)) continue;
    g.nested = true; g.ok = false; for (const h of inner) { h.again = Math.max(h.again || 0, g.share); if (!h.ok) { h.ok = true; h.promoted = true; } } }
  // keep the good ones, longest evidence first, no overlap
  const accepted = []; for (const g of bouts.filter((b) => b.ok).sort((p, q) => q.stripe - p.stripe)) { if (accepted.some((h) => g.a <= h.b && g.b >= h.a)) continue; accepted.push(g); }
  accepted.sort((p, q) => p.a - q.a); out.rejected = bouts.filter((b) => !accepted.includes(b));
  for (const g of accepted) for (let i = g.a; i <= g.b; i++) taken[i] = 1;

  // 6. fallback: chains of loops, rest pose to rest pose, where nothing was found
  { const first = closures.filter((c) => c.order === 0 && !taken[c.i] && !taken[c.j]).sort((p, q) => p.j - q.j || q.i - p.i); const loops = []; let end = -1;
    for (const c of first) { if (c.i < end - CFG.LAP * (c.j - c.i)) continue; let tight = c; for (const d of first) if (d.i >= end - CFG.LAP * (d.j - d.i) && Math.abs(d.j - c.j) <= Math.round(0.3 * fps) && d.i > tight.i && d.i < c.j - Lmin) tight = { ...d, j: c.j }; loops.push(tight); end = c.j; }
    let chain = []; const flush = () => { if (chain.length >= 2) { const a = chain[0].i, b = chain[chain.length - 1].j; const lens = chain.map((l) => l.j - l.i); const P = median(chain.slice(1).map((l, k) => l.i - chain[k].i));
        accepted.push({ a, b, P, set: chain, stripe: 0, share: 0, reps: chain.length, ratio: median(chain.map((l) => l.ratio)), R: median(chain.map((l) => l.R)), q: median(chain.map((l) => l.q)), via: 'chain', loops: chain.length, lens, ok: true }); for (let i = a; i <= b; i++) taken[i] = 1; } chain = []; };
    for (const l of loops) { if (chain.length) { const lens = chain.map((x) => x.j - x.i).concat(l.j - l.i); const med = median(lens); const prev = chain[chain.length - 1]; if (l.i - prev.j > CFG.GAP * med || (l.j - l.i) > 2.5 * med || (l.j - l.i) < med / 2.5 || sceneOf[l.i] !== sceneOf[chain[0].i]) flush(); } chain.push(l); } flush(); out.loops = loops; }
  accepted.sort((p, q) => p.a - q.a);

  // 8. whole reps
  for (const g of accepted) { g.a0 = g.a; g.b0 = g.b; if (g.via !== 'stripes') continue; const whole = Math.floor(g.reps + 0.08); if (whole < 2) continue; const slack = (g.b - g.a) - whole * g.P; if (slack <= 0.1 * g.P) continue;
    let best = null; for (let a = g.a; a <= g.a + Math.round(slack); a++) { const e0 = Math.round(a + whole * g.P), w = Math.max(1, Math.round(0.1 * g.P)); for (let e = Math.max(a + Lmin, e0 - w); e <= Math.min(g.b, e0 + w); e++) { const c = wdist(a, e); if (!best || c < best.c) best = { a, e, c }; } }
    if (best) { g.a = best.a; g.b = best.e; g.trimmed = whole; } }

  // score
  for (const g of accepted) { const Ps = g.P / fps;
    if (g.via === 'stripes') g.score = clamp(0.4 * Math.min(1, Math.max(g.share, g.again || 0)) + 0.3 * Math.min(1, (g.reps - 1) / 2) + 0.3 * Math.max(0, 1 - g.ratio / CFG.TAU), 0, 1);
    else g.score = clamp(0.15 + 0.1 * Math.min(3, g.loops - 2) / 3 + 0.2 * Math.max(0, 1 - g.ratio / CFG.TAU), 0, 0.45); }

  for (const g of accepted) { let c = 0; for (let t = g.a0; t <= g.b0; t++) if (cam[t]) c++; g.unsteady = c / (g.b0 - g.a0 + 1); if (g.unsteady > CFG.CAM_BOUT) { g.score *= 0.5; g.shaky = true; } }

  // 7. groups: are the poses of each bout found in the other? (plain distances; a bout's own measure is how well its poses are
  // found in its other reps, and how far apart its poses are)
  const frames = (g) => { const len = g.b0 - g.a0 + 1, st = Math.max(1, Math.floor(len / 60)); const f = []; for (let i = g.a0; i <= g.b0; i += st) f.push(i); return f; };
  for (const g of accepted) { const f = frames(g), half = Math.max(2, Math.round(g.P / 2)); const nn = [], all = []; for (const i of f) { let mn = Infinity; for (const j of f) { if (Math.abs(i - j) < half) continue; const v = d0[i * n + j]; if (v < mn) mn = v; all.push(v); } if (mn < 1e9) nn.push(Math.max(0, mn - noise)); } g.selfq = quant(nn, 0.75); g.range = Math.max(0, quant(all, 0.9) - noise); }
  const cross = (A, B) => { const fa = frames(A), fb = frames(B); const one = (X, Y) => quant(X.map((i) => { let mn = Infinity; for (const j of Y) { const v = d0[i * n + j]; if (v < mn) mn = v; } return Math.max(0, mn - noise); }), 0.75); return Math.max(one(fa, fb), one(fb, fa)); };
  const same = (A, B) => { const x = cross(A, B); const pr = Math.max(A.P, B.P) / Math.min(A.P, B.P); return { x, same: (x <= Math.max(CFG.GROUP_Q * Math.max(A.selfq, B.selfq), CFG.GROUP_R * Math.min(A.range, B.range))) && pr <= CFG.GROUP_P }; };
  let gid = 0; out.pairs = []; for (let i = 0; i < accepted.length; i++) { const A = accepted[i]; A.group = 0; for (let j = 0; j < i; j++) { const s = same(accepted[j], A); out.pairs.push({ a: j, b: i, x: s.x, same: s.same }); if (s.same && !A.group) A.group = accepted[j].group; }
    // one set, carried on after a change of side or grip: the bout before is in the same scene, has the same period, and the pause between them is short and not a rest
    const Bp = accepted[i - 1]; if (!A.group && Bp && sceneOf[Bp.b0] === sceneOf[A.a0] && Math.max(A.P, Bp.P) / Math.min(A.P, Bp.P) <= CFG.LAG_TOL && A.a0 - Bp.b0 - 1 <= CFG.GROUP_GAP * Math.max(A.P, Bp.P)) {
      let mb = 0, cb = 0; for (const g of [A, Bp]) for (let t = g.a0; t <= g.b0; t++) { mb += M[t]; cb++; } const lim = CFG.MOVE * mb / Math.max(1, cb); let mv = 0; for (let t = Bp.b0 + 1; t < A.a0; t++) if (M[t] > lim) mv++;
      if (A.a0 - Bp.b0 - 1 <= 0 || mv >= 0.5 * (A.a0 - Bp.b0 - 1)) { A.group = Bp.group; A.carried = true; } }
    if (!A.group) A.group = ++gid; }

  // 9. crops
  for (const g of accepted) g.crop = cropBox(px, info, g.a0, g.b0);
  out.bouts = accepted; out.T = T; return out;
}

/** The athlete's box over frames a..b of the proxy, in source pixels, padded. */
export function cropBox(px, info, a, b) {
  const { W, H, raw } = px; const N = W * H; const cnt = b - a + 1; const full = [info.width, info.height, 0, 0]; if (cnt < 4) return full;
  // per pixel: spread over time (5th..95th percentile), 3x3 smoothed
  const st = Math.max(1, Math.floor(cnt / 80)); const idx = []; for (let i = a; i <= b; i += st) idx.push(i); const k = idx.length; const lo = Math.floor(0.05 * (k - 1)), hi = Math.ceil(0.95 * (k - 1));
  const sp = new Float32Array(N); const col = new Uint8Array(k); for (let p = 0; p < N; p++) { for (let t = 0; t < k; t++) col[t] = raw[idx[t] * N + p]; col.sort(); sp[p] = col[hi] - col[lo]; }
  const sm = new Float32Array(N); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let s = 0, c = 0; for (let dy = -1; dy <= 1; dy++) { const yy = y + dy; if (yy < 0 || yy >= H) continue; for (let dx = -1; dx <= 1; dx++) { const xx = x + dx; if (xx < 0 || xx >= W) continue; s += sp[yy * W + xx]; c++; } } sm[y * W + x] = s / c; }
  const bg = Math.max(1, quant(sm, 0.25)), top = quant(sm, 0.995); const strongT = Math.max(4 * bg, 0.35 * top), weakT = Math.max(2 * bg, 0.12 * top);
  const lab = new Int32Array(N).fill(-1); const comps = []; const stack = new Int32Array(N);
  for (let s0 = 0; s0 < N; s0++) { if (sm[s0] < strongT || lab[s0] >= 0) continue; const id = comps.length; const c = { id, mass: 0, x0: W, x1: -1, y0: H, y1: -1 }; let spn = 0; stack[spn++] = s0; lab[s0] = id;
    while (spn) { const i = stack[--spn]; const x = i % W, y = (i - x) / W; c.mass += sm[i]; if (x < c.x0) c.x0 = x; if (x > c.x1) c.x1 = x; if (y < c.y0) c.y0 = y; if (y > c.y1) c.y1 = y;
      for (let dy = -1; dy <= 1; dy++) { const yy = y + dy; if (yy < 0 || yy >= H) continue; for (let dx = -1; dx <= 1; dx++) { const xx = x + dx; if (xx < 0 || xx >= W) continue; const j = yy * W + xx; if (lab[j] < 0 && sm[j] >= weakT) { lab[j] = id; stack[spn++] = j; } } } }
    comps.push(c); }
  if (!comps.length) return full; comps.sort((p, q) => q.mass - p.mass); const main = comps[0]; const bb = { ...main }; const gap = 0.06 * Math.max(W, H);
  for (let grew = true; grew;) { grew = false; for (const c of comps) { if (c === main || c.used || c.mass < 0.05 * main.mass) continue; const dx = Math.max(0, c.x0 - bb.x1, bb.x0 - c.x1), dy = Math.max(0, c.y0 - bb.y1, bb.y0 - c.y1); if (Math.max(dx, dy) <= gap) { c.used = true; bb.x0 = Math.min(bb.x0, c.x0); bb.x1 = Math.max(bb.x1, c.x1); bb.y0 = Math.min(bb.y0, c.y0); bb.y1 = Math.max(bb.y1, c.y1); grew = true; } } }
  const kx = info.width / W, ky = info.height / H; let x0 = bb.x0 * kx, x1 = (bb.x1 + 1) * kx, y0 = bb.y0 * ky, y1 = (bb.y1 + 1) * ky; const pad = CFG.PAD * Math.max(x1 - x0, y1 - y0);
  x0 = Math.max(0, Math.floor(x0 - pad)); y0 = Math.max(0, Math.floor(y0 - pad)); x1 = Math.min(info.width, Math.ceil(x1 + pad)); y1 = Math.min(info.height, Math.ceil(y1 + pad));
  x0 -= x0 % 2; y0 -= y0 % 2; let w = x1 - x0, h = y1 - y0; w -= w % 2; h -= h % 2; return w >= 16 && h >= 16 ? [w, h, x0, y0] : full;
}

/** The contract: sorted segments that cover the video, exercise bouts and the junk between them. */
export function segmentsOf(A, info) {
  const dur = info.duration; const full = [info.width, info.height, 0, 0]; const segs = []; const { fps, n } = A; let t = 0;
  const junkWhy = (a, b) => { if (A.empty) return 'too short to judge'; const i0 = clamp(Math.round(a * fps), 0, n - 1), i1 = clamp(Math.round(b * fps), i0 + 1, n); let mv = 0; for (let i = i0; i < i1; i++) if (A.mot[i] > 3 * A.noise) mv++; const share = mv / (i1 - i0);
    const near = (A.rejected || []).filter((g) => !g.nested && Math.min(g.b / fps, b) - Math.max(g.a / fps, a) >= 0.5 * (b - a)).sort((p, q) => q.stripe - p.stripe)[0];
    if (near && share > 0.3) return `movement, but not enough repetition (${(near.reps).toFixed(1)} reps of ${(near.P / fps).toFixed(1)} s seen)`; return share < 0.15 ? 'still' : share < 0.5 ? 'little movement, nothing repeats' : 'movement that does not repeat'; };
  const junk = (a, b) => { if (b - a < 1e-3) return; if (b - a < 1 / fps && segs.length && segs[segs.length - 1].kind === 'exercise') { segs[segs.length - 1].end = r3(b); return; } /* a sliver under one proxy frame belongs to the bout before it */ const edges = [a, ...(A.cuts || []).map((c) => c / fps).filter((c) => c > a + 0.3 && c < b - 0.3), b]; for (let k = 0; k + 1 < edges.length; k++) segs.push({ start: r3(edges[k]), end: r3(edges[k + 1]), kind: 'junk', group: 0, period: null, reps: null, crop: full, score: 0, why: junkWhy(edges[k], edges[k + 1]) }); };
  for (const g of A.bouts || []) { const s = Math.max(t, clamp(g.a / fps, 0, dur)), e = clamp((g.b + 1) / fps, 0, dur); if (e - s < 0.2) continue; junk(t, s);
    const Ps = g.P / fps; const why = g.via === 'stripes' ? `repeats every ${Ps.toFixed(2)} s for ${g.reps.toFixed(1)} reps (${Math.round(100 * Math.min(g.share, 9.99))} % of one rep's movement seen again, return ratio ${g.ratio.toFixed(2)})${g.promoted ? '; weak on its own, but the same movement comes again one bout later' : ''}${g.carried ? '; carries on the bout before it' : ''}${g.shaky ? '; CAMERA NOT STEADY here, score halved' : ''}${g.trimmed ? `; trimmed to ${g.trimmed} whole reps` : g.reps < 2 ? '; under 2 reps, ends left as found' : ''}` : `returns to the same pose ${g.loops} times in a row without repeating frame for frame (return ratio ${g.ratio.toFixed(2)}); low confidence${g.shaky ? '; CAMERA NOT STEADY here, score halved' : ''}`;
    segs.push({ start: r3(s), end: r3(e), kind: 'exercise', group: g.group, period: r3(Ps), reps: g.trimmed || Math.round(g.reps * 10) / 10, crop: g.crop, score: r3(g.score), ...(g.carried ? { carried: true } : {}), why }); t = e; } // carried: this bout carries on the one before it after a change of side or grip (step 8); split2.mjs reads it
  junk(t, dur); if (!segs.length) segs.push({ start: 0, end: r3(dur), kind: 'junk', group: 0, period: null, reps: null, crop: full, score: 0, why: 'too short to judge' });
  return segs.map((s, i) => ({ idx: i, ...s }));
}

// ---------- debug pictures ----------
const GLYPHS = { '0': '01110100011001110101110011000101110', '1': '00100011000010000100001000010001110', '2': '01110100010000100010001000100011111', '3': '11111000100010000010000011000101110', '4': '00010001100101010010111110001000010', '5': '11111100001111000001000011000101110', '6': '00110010001000011110100011000101110', '7': '11111000010001000100010000100001000', '8': '01110100011000101110100011000101110', '9': '01110100011000101111000010001001100',
  A: '01110100011000110001111111000110001', B: '11110100011000111110100011000111110', C: '01110100011000010000100001000101110', D: '11100100101000110001100011001011100', E: '11111100001000011110100001000011111', F: '11111100001000011110100001000010000', G: '01110100011000010111100011000101111', H: '10001100011000111111100011000110001', I: '01110001000010000100001000010001110', J: '00111000100001000010000101001001100',
  K: '10001100101010011000101001001010001', L: '10000100001000010000100001000011111', M: '10001110111010110101100011000110001', N: '10001100011100110101100111000110001', O: '01110100011000110001100011000101110', P: '11110100011000111110100001000010000', Q: '01110100011000110001101011001001101', R: '11110100011000111110101001001010001', S: '01111100001000001110000010000111110', T: '11111001000010000100001000010000100',
  U: '10001100011000110001100011000101110', V: '10001100011000110001100010101000100', W: '10001100011000110101101011010101010', X: '10001100010101000100010101000110001', Y: '10001100011000101010001000010000100', Z: '11111000010001000100010001000011111', '.': '00000000000000000000000000110001100', '-': '00000000000000011111000000000000000', ':': '00000011000110000000011000110000000', '/': '00000000010001000100010001000000000',
  '=': '00000000001111100000111110000000000', '%': '11000110010001000100010001001100011', '(': '00010001000100001000010000010000010', ')': '01000001000001000010000100010001000', '+': '00000001000010011111001000010000000', ',': '00000000000000000000011000010001000', '_': '00000000000000000000000000000011111', '~': '00000000000100010101000100000000000', '<': '00010001000100010000010000010000010', '>': '01000001000001000001000100010001000',
  '#': '01010010101111101010111110101001010', '?': '01110100010000100010001000000000100', '!': '00100001000010000100001000000000100', '|': '00100001000010000100001000010000100', '*': '00000101010111011111011101010100000' };
class Img {
  constructor(w, h, bg = [16, 12, 24]) { this.w = w; this.h = h; this.d = Buffer.alloc(w * h * 3); for (let i = 0; i < w * h; i++) { this.d[i * 3] = bg[0]; this.d[i * 3 + 1] = bg[1]; this.d[i * 3 + 2] = bg[2]; } }
  px(x, y, c) { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= this.w || y >= this.h) return; const o = (y * this.w + x) * 3; this.d[o] = c[0]; this.d[o + 1] = c[1]; this.d[o + 2] = c[2]; }
  rect(x, y, w, h, c) { const x0 = Math.max(0, Math.round(x)), y0 = Math.max(0, Math.round(y)), x1 = Math.min(this.w, Math.round(x + w)), y1 = Math.min(this.h, Math.round(y + h)); for (let yy = y0; yy < y1; yy++) { let o = (yy * this.w + x0) * 3; for (let xx = x0; xx < x1; xx++) { this.d[o++] = c[0]; this.d[o++] = c[1]; this.d[o++] = c[2]; } } }
  frame(x, y, w, h, c) { this.rect(x, y, w, 1, c); this.rect(x, y + h - 1, w, 1, c); this.rect(x, y, 1, h, c); this.rect(x + w - 1, y, 1, h, c); }
  text(x, y, s, c = [230, 230, 240], k = 1) { for (const ch of String(s).toUpperCase()) { const g = GLYPHS[ch]; if (g) for (let r = 0; r < 7; r++) for (let q = 0; q < 5; q++) if (g[r * 5 + q] === '1') this.rect(x + q * k, y + r * k, k, k, c); x += 6 * k; } return x; }
  save(file) { const row = this.w * 3 + 1; const rawb = Buffer.alloc(row * this.h); for (let y = 0; y < this.h; y++) this.d.copy(rawb, y * row + 1, y * this.w * 3, (y + 1) * this.w * 3);
    const chunk = (t, b) => { const len = Buffer.alloc(4); len.writeUInt32BE(b.length); const td = Buffer.concat([Buffer.from(t), b]); const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td) >>> 0); return Buffer.concat([len, td, crc]); };
    const ih = Buffer.alloc(13); ih.writeUInt32BE(this.w, 0); ih.writeUInt32BE(this.h, 4); ih[8] = 8; ih[9] = 2;
    fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(rawb, { level: 6 })), chunk('IEND', Buffer.alloc(0))])); }
}
const heat = (v) => { v = Number.isFinite(v) ? clamp(v, 0, 1) : 0; const st = [[8, 6, 20], [70, 30, 140], [200, 70, 110], [250, 170, 60], [255, 250, 220]]; const p = v * (st.length - 1); const i = Math.min(st.length - 2, Math.floor(p)); const f = p - i; return [0, 1, 2].map((k) => Math.round(st[i][k] + (st[i + 1][k] - st[i][k]) * f)); };
const GCOL = [[120, 200, 120], [110, 170, 255], [255, 170, 80], [230, 110, 200], [120, 220, 220], [240, 230, 110], [170, 130, 255], [255, 120, 120], [160, 200, 80], [200, 200, 200]];
const gcol = (g) => GCOL[((g || 1) - 1) % GCOL.length];

/** timeline.png (signals over time, boundaries marked) and one contact sheet per exercise segment. */
export function writeDebug(dir, video, info, px, A, segs, truth) {
  fs.mkdirSync(dir, { recursive: true }); const { n, fps } = A; const base = path.basename(video).replace(/\.[^.]+$/, '');
  if (!A.empty) {
    const S = Math.max(1, Math.min(8, Math.floor(1500 / n))); const M = 70, Wd = M + n * S + 20; const LH = A.Lmax * 2; const rows = { axis: 4, truth: 18, segs: truth ? 50 : 18, mot: 0, nov: 0, lag: 0, cov: 0 };
    rows.mot = rows.segs + 62; rows.nov = rows.mot + 90; rows.lag = rows.nov + 90; rows.cov = rows.lag + LH + 14; const Hd = rows.cov + 60;
    const im = new Img(Wd, Hd); const X = (f) => M + f * S; const gray = [150, 150, 160];
    const tick = n / fps > 90 ? 10 : n / fps > 30 ? 5 : n / fps > 12 ? 2 : 1; for (let t = 0; t * fps < n; t += tick) { im.text(X(t * fps) + 2, rows.axis, String(t), gray); im.rect(X(t * fps), rows.axis, 1, Hd - rows.axis, [38, 32, 52]); }
    const bar = (y, list, label) => { im.text(4, y + 8, label, gray); for (const s of list) { const a = X(s.start * fps), b = X(s.end * fps); const ex = s.kind === 'exercise'; const c = ex ? gcol(s.group) : [70, 36, 36]; im.rect(a, y, Math.max(1, b - a - 1), 26, c);
      if (ex) { im.text(a + 3, y + 3, `G${s.group}${s.score != null ? ' ' + Number(s.score).toFixed(2) : ''}`.slice(0, Math.floor((b - a - 4) / 6)), [10, 10, 20]); im.text(a + 3, y + 14, (s.label || (s.period ? `${s.period}S X${s.reps}` : '')).slice(0, Math.floor((b - a - 4) / 6)), [10, 10, 20]); } } };
    if (truth) bar(rows.truth, truth.segments, 'TRUTH'); bar(rows.segs, segs, 'FOUND');
    const curve = (y, h, arr, c, mx, label) => { for (let i = 0; i < n; i++) { const v = clamp(arr[i] / mx, 0, 1); im.rect(X(i), y + h - v * h, S, Math.max(1, v * h), c); } if (label) im.text(4, y + 2, label, c); };
    const mx = Math.max(quant(A.mot, 0.99) * 1.2, 6 * A.noise); curve(rows.mot, 56, A.mot, [150, 110, 240], mx, 'MOVE'); im.text(4, rows.mot + 12, `MAX ${mx.toFixed(1)}`, gray); im.text(4, rows.mot + 22, `NOISE ${A.noise.toFixed(2)}`, gray); im.rect(M, rows.mot + 56 - clamp(3 * A.noise / mx, 0, 1) * 56, n * S, 1, [255, 90, 90]);
    const nmx = Math.max(quant(A.nov1, 0.995), quant(A.nov2, 0.995), 1e-3) * 1.05; curve(rows.nov, 84, A.nov2, [60, 120, 110], nmx, null); for (let i = 1; i < n; i++) { const v = clamp(A.nov1[i] / nmx, 0, 1); im.rect(X(i), rows.nov + 84 - v * 84, S, 2, [250, 200, 90]); }
    im.text(4, rows.nov + 2, 'NOVELTY', [250, 200, 90]); im.text(4, rows.nov + 12, '0.6S', [250, 200, 90]); im.text(4, rows.nov + 22, '3S', [60, 160, 140]); im.text(4, rows.nov + 32, `MAX ${nmx.toFixed(1)}`, gray); for (const c of A.cuts) im.rect(X(c), rows.segs - 4, 1, rows.cov + 56 - rows.segs, [255, 60, 60]);
    for (let i = 0; i < n; i++) { let R = 0; for (let L = 1; L <= A.Lmax && i + L < n; L++) { const q = A.qx(i, L); if (!(q < 1e9)) continue; if (q > R) R = q; im.rect(X(i), rows.lag + (A.Lmax - L) * 2, S, 2, heat(1 - clamp(q / Math.max(R, CFG.THETA * A.noise), 0, 1))); } }
    im.text(4, rows.lag + 2, 'LAG S', gray); for (let L = 0; L <= CFG.LAG_MAX; L += 2) im.text(M - 18, rows.lag + (A.Lmax - L * fps) * 2 - 3, String(L), gray);
    for (const c of A.closures) if (c.stripe) im.rect(X(c.i) + S / 2 - 1, rows.lag + (A.Lmax - c.L) * 2 - 1, 2, 2, [80, 255, 160]); else if (c.order === 0) im.rect(X(c.i) + S / 2, rows.lag + (A.Lmax - c.L) * 2, 1, 1, [120, 160, 255]);
    const cov = new Float32Array(n); for (const c of A.closures) if (c.stripe) for (let i = c.i; i <= c.j; i++) cov[i]++; curve(rows.cov, 50, cov, [80, 220, 150], Math.max(1, quant(cov, 0.99)), 'STRIPES'); im.text(4, rows.cov + 12, 'COVER', [80, 220, 150]);
    for (const g of A.bouts) { im.rect(X(g.a), rows.cov + 52, Math.max(1, (g.b - g.a + 1) * S), 3, gcol(g.group)); im.rect(X(g.a0), rows.cov + 56, Math.max(1, (g.b0 - g.a0 + 1) * S), 1, gcol(g.group)); }
    for (const s of segs) { for (const t of [s.start, s.end]) im.rect(X(t * fps), rows.segs + 26, 1, rows.cov + 50 - rows.segs - 26, s.kind === 'exercise' ? [235, 235, 245] : [90, 80, 110]); }
    im.save(path.join(dir, `${base}-timeline.png`));
  }
  // contact sheets: one whole frame with the crop box drawn on it, then 8 frames across the segment cut to that box
  for (const s of segs.filter((q) => q.kind === 'exercise')) { const [w, h, x, y] = s.crop; const len = s.end - s.start; const even = (v) => Math.max(2, Math.round(v / 2) * 2); const th = 180, tw = even(th * w / h), fw = even(th * info.width / info.height), thick = Math.max(4, Math.round(Math.max(info.width, info.height) / 160));
    const fc = `[0:v]fps=${(8 / len).toFixed(4)},split=2[a][b];[a]crop=${w}:${h}:${x}:${y},scale=${tw}:${th},tile=8x1[t];[b]select='eq(n\\,3)',drawbox=${x}:${y}:${w}:${h}:red@0.9:${thick},scale=${fw}:${th}[f];[f][t]hstack=inputs=2`;
    try { execFileSync('ffmpeg', ['-nostdin', '-loglevel', 'error', '-y', '-ss', String(s.start), '-t', String(len), '-i', video, '-an', '-filter_complex', fc, '-frames:v', '1', '-q:v', '4', path.join(dir, `${base}-seg${String(s.idx).padStart(2, '0')}-g${s.group}.jpg`)], { stdio: ['ignore', 'ignore', 'ignore'] }); } catch (e) { /* a sheet is only a picture */ } }
}

// ---------- command line ----------
function main() {
  const a = process.argv.slice(2); const opt = (k) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : null; }; const flags = ['--out', '--debug', '--truth', '--proxy'];
  const video = a.find((v, i) => !v.startsWith('--') && !flags.includes(a[i - 1])); const outF = opt('--out');
  if (!video || !outF) { console.error('usage: node split.mjs <video> --out <json> [--debug <dir>]'); process.exit(2); }
  const t0 = Date.now(); const info = probe(video); const px = readProxy(info, opt('--proxy')); const t1 = Date.now(); if (!info.duration) info.duration = px.n / px.fps;
  const A = analyse(px, info); const segs = segmentsOf(A, info);
  fs.mkdirSync(path.dirname(path.resolve(outF)), { recursive: true });
  fs.writeFileSync(outF, JSON.stringify({ video, duration: r3(info.duration), fps: r3(info.fps), width: info.width, height: info.height, splitter: 'B self-similarity', camera: { sliding: r3(A.camShare || 0), steady: !((A.camShare || 0) > CFG.CAM_BOUT) }, seconds: { decode: (t1 - t0) / 1000, analyse: (Date.now() - t1) / 1000 }, segments: segs }, null, 1));
  if (opt('--debug')) { const truth = opt('--truth') ? JSON.parse(fs.readFileSync(opt('--truth'), 'utf8')) : null; writeDebug(opt('--debug'), video, info, px, A, segs, truth);
    const dbg = { noise: A.noise, cuts: (A.cuts || []).map((c) => c / A.fps), sceneRef: A.sceneRef, bouts: (A.bouts || []).map((g) => ({ a: g.a0 / A.fps, b: g.b0 / A.fps, P: g.P / A.fps, via: g.via, stripe: g.stripe, reps: g.reps, ratio: g.ratio, R: g.R, q: g.q, group: g.group, score: g.score })), rejected: (A.rejected || []).map((g) => ({ a: g.a / A.fps, b: g.b / A.fps, P: g.P / A.fps, stripe: g.stripe, reps: g.reps, ratio: g.ratio })), pairs: A.pairs };
    fs.writeFileSync(path.join(opt('--debug'), path.basename(video).replace(/\.[^.]+$/, '') + '-debug.json'), JSON.stringify(dbg, null, 1)); }
}
if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(new URL(import.meta.url).pathname)) { try { main(); } catch (e) { console.error('split.mjs: ' + String(e && e.message || e).split('\n')[0].slice(0, 300)); process.exit(1); } }
