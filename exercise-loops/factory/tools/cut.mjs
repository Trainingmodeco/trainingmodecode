#!/usr/bin/env node
// cut.mjs: turn one render (the avatar doing the movement a few times) into the loop the app plays.
// The single-file version of batch6/cutall.mjs.
//
// Usage:
//   node cut.mjs <render.mp4> --seconds <rep length> --out <base>
//   node cut.mjs <render.mp4> --hold --out <base>
//
//   --seconds   length of ONE repetition in the driving clip: prep.mjs's `repLength` (not its `clipLength`, the length of the whole driving
//               clip and of the render, which holds several reps)
//   --hold      a HOLD exercise (plank, hang, wall sit; the driving clip came from prep.mjs --hold): no repeat is looked for. The first 3 s
//               of the render are taken and their last 0.4 s are crossfaded into their first 0.4 s, so the loop is 2.6 s long and runs
//               round without a jump: it opens on the frame at 2.6 s, melts into the opening frames and plays on to 2.6 s again.
//               A render of 2.8 s or more counts as a full hold; one between 1.5 and 2.8 s is used whole (the crossfade is then a seventh of
//               it, at most 0.4 s) with a warning. Also warned: a render that moves all through (a hold should be still).
//   A render under 1.5 s is refused (exit 1, { error }): Higgsfield renders are never under 4 s, so it is cut off or damaged.
//   --out       writes <base>.mp4        640x640, 30 fps, h264 yuv420p, no audio, +faststart, edges faded into #0a0014
//                      <base>.webp       poster, 320 px, the frame at 35% of the loop
//                      <base>-sheet.jpg  8 frames of the loop in a row
//
// How: look for two frames 0.8x-1.25x of --seconds apart that look alike and move alike (three frames in a row,
// 30 fps, 128 px). When the best pair differs by no more than 1.7x an ordinary frame step, cut there (`loop`); if
// that seam is still rougher than 1.15x a frame step, the last 6 frames are blended into the 6 frames that lead
// into the loop's first frame. Otherwise there is no clean repeat: play the first max(--seconds, 3.9) seconds
// once, hold the finish for half a second and fade back to the start (`once`).
// Frames are taken by number from one decode, and every piece is re-timed to zero, so the first frame is never
// blank (the old fixcut bug); the tool checks it and exits 1 if the first frame came out empty.
//
// Prints one line of JSON: { mode: 'loop' | 'once' | 'hold', length, seam, ratio, bytes, start, blended, typicalStep, loopJump, ... }
//   seam and ratio are of the best pair found, also in `once` mode, where they say why it was not looped (null when the
//   render is too short to hold a pair at all). loopJump is measured on the finished file: the change from its last
//   frame back to its first, in ordinary frame steps (about 1 = it runs on as if nothing happened).
// Exit 1 = the render is unusable (first frame blank: the frame is under half as bright as the frames from the sixth on, so also two
//   black frames in a row; or the render is under 1.5 s): treat it as a failed render (retry rule). Exit 2 = bad arguments.
import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process';
import { args, fail, ff, probe, grayFrames, differ, typicalStep, BG } from './_lib.mjs';

const USAGE = 'usage: node cut.mjs <render.mp4> --seconds <rep length> --out <base>\n       node cut.mjs <render.mp4> --hold --out <base>';
const a = args(process.argv.slice(2), ['hold']); const inp = a._[0]; const HOLD_S = 3.0, HOLD_X = 0.4; const seconds = a.hold ? HOLD_S : Number(a.seconds);
if (!inp || !a.out || !(seconds > 0)) fail('cut.mjs: a render, --seconds (or --hold) and --out are needed', USAGE);
if (!fs.existsSync(inp)) fail(`cut.mjs: no such file: ${inp}`);
const p = probe(inp); if (!p) fail(`cut.mjs: no video in ${inp}`);
fs.mkdirSync(path.dirname(path.resolve(a.out)), { recursive: true });
const FPS = 30, W = 128, SIZE = 640, K = 6, HOLD = 0.5, FADE = 0.35, MAX_RATIO = 1.7; const dur = p.duration; const warnings = [];
const MIN_RENDER = 1.5, HOLD_FULL = 2.8, HOLD_STILL = 0.7; // HOLD_STILL: a still hold render changes less than this (gray levels, 128 px) from frame to frame in the median
if (!(dur >= MIN_RENDER)) { process.stdout.write(`${JSON.stringify({ error: `the render is only ${dur.toFixed(2)} s long: Higgsfield renders are never under 4 s, so this one is cut off or damaged: a failed render`, render: { seconds: +dur.toFixed(2), width: p.width, height: p.height } })}\n`); process.exit(1); }

// ---- the seam: the search of batch3/seam.mjs
const fr = grayFrames(p, { fps: FPS, size: [W, W] }); const n = fr.n; const diff = differ(fr); const med = typicalStep(fr);
const lo = Math.max(0.8, seconds * 0.8), hi = Math.min(dur - 0.15, Math.max(lo + 0.3, seconds * 1.25));
let best = null; const loF = Math.round(lo * FPS), hiF = a.hold ? -1 : Math.round(hi * FPS); // hold: no pair is looked for
const D = new Map(); const dd = (i, j) => { const k = i * 65536 + j; let v = D.get(k); if (v === undefined) { v = diff(i, j); D.set(k, v); } return v; };
for (let s = 0; s < n - 4; s++) for (let e = s + loF; e <= Math.min(n - 4, s + hiF); e++) { const d = (dd(s, e) + dd(s + 1, e + 1) + dd(s + 2, e + 2)) / 3; if (!best || d < best.d) best = { a: s, b: e, d }; }
const ratio = best ? best.d / Math.max(med, 1e-6) : null;

// ---- the picture: fit into 640x640, fade the outer edge into the background colour
const fit = Math.min(SIZE / p.width, SIZE / p.height); const fw = Math.max(2, Math.round((p.width * fit) / 2) * 2), fh = Math.max(2, Math.round((p.height * fit) / 2) * 2);
const mask = Buffer.alloc(fw * fh); for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) mask[y * fw + x] = Math.round(255 * Math.min(1, Math.max(0, (1 - Math.max(Math.abs(x / fw - 0.5), Math.abs(y / fh - 0.5)) * 2) / 0.14)));
const base = `[0:v]fps=${FPS},scale=${fw}:${fh},setsar=1,format=yuv420p`; const finish = (label) => `[1:v]loop=loop=-1:size=1:start=0[mk];[${label}]format=yuva420p[fa0];[fa0][mk]alphamerge[fa];[2:v][fa]overlay=(W-w)/2:(H-h)/2:shortest=1,format=yuv420p[v]`;
const inputs = ['-i', inp, '-f', 'rawvideo', '-pix_fmt', 'gray', '-s', `${fw}x${fh}`, '-r', String(FPS), '-i', 'pipe:0', '-f', 'lavfi', '-i', `color=c=${BG}:s=${SIZE}x${SIZE}:r=${FPS}`];
const encode = (graph, len) => execFileSync('ffmpeg', ['-nostdin', '-hide_banner', '-loglevel', 'error', '-y', ...inputs, '-filter_complex', graph, '-map', '[v]', '-an', '-t', len.toFixed(4), '-r', String(FPS), '-c:v', 'libx264', '-crf', '23', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', `${a.out}.mp4`], { input: mask, stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 1e8 });

let res;
if (a.hold) {
  // a hold: the first 3 s, their end crossfaded into their start
  const N = Math.min(n, Math.round(HOLD_S * FPS)); const X = Math.max(2, Math.min(Math.round(HOLD_X * FPS), Math.floor(N / 7))); const Dx = X / FPS;
  if (n < Math.round(HOLD_FULL * FPS)) warnings.push(`the render is only ${(n / FPS).toFixed(2)} s long, under the ${HOLD_S} s a hold loop is cut from: all of it was used`);
  if (med > HOLD_STILL) warnings.push(`the render moves all through (an ordinary frame step is ${med.toFixed(2)} gray levels, a still hold stays under ${HOLD_STILL}): a hold should be still, this is a movement. If the exercise is a hold, render it again; if not, leave --hold off`);
  if (N < 3 * X + 2) fail(`cut.mjs: the render holds only ${n} frames, too few for a hold loop`);
  const graph = `${base},split=3[h0][t0][m0];[h0]trim=start_frame=0:end_frame=${X},setpts=PTS-STARTPTS[h];[t0]trim=start_frame=${N - X}:end_frame=${N},setpts=PTS-STARTPTS[t];[m0]trim=start_frame=${X}:end_frame=${N - X},setpts=PTS-STARTPTS[m];[t][h]xfade=transition=fade:duration=${Dx.toFixed(4)}:offset=0[x0];[x0][m]concat=n=2:v=1:a=0[x];${finish('x')}`;
  encode(graph, (N - X) / FPS); res = { mode: 'hold', start: 0, blended: true, crossfade: +Dx.toFixed(3), drift: +diff(0, N - 1).toFixed(2) };
  if (diff(0, N - 1) > Math.max(12 * med, 3)) warnings.push(`the render is not still: its frame at ${(N / FPS).toFixed(1)} s is ${diff(0, N - 1).toFixed(1)} gray levels away from its first (a still hold: under 3), so the crossfade will show as a slow pulse every ${((N - X) / FPS).toFixed(1)} s`);
} else if (best && ratio <= MAX_RATIO) {
  // a clean repeat: frames a .. b-1, the fixcut2 finish
  const len = (best.b - best.a) / FPS; const seam = dd(best.a, best.b); const blend = seam > 1.15 * med && best.a >= K; const Dk = K / FPS;
  const graph = blend
    ? `${base},split=2[m0][p0];[m0]trim=start_frame=${best.a}:end_frame=${best.b},setpts=PTS-STARTPTS[m];[p0]trim=start_frame=${best.a - K}:end_frame=${best.a},setpts=PTS-STARTPTS[p];[m][p]xfade=transition=fade:duration=${Dk.toFixed(4)}:offset=${(len - Dk).toFixed(4)}[x];${finish('x')}`
    : `${base},trim=start_frame=${best.a}:end_frame=${best.b},setpts=PTS-STARTPTS[x];${finish('x')}`;
  encode(graph, len); res = { mode: 'loop', start: +(best.a / FPS).toFixed(3), blended: blend, frameSeam: +seam.toFixed(2) };
} else {
  // no clean repeat: once through, hold, fade back to the first frame (oncecut)
  const L = Math.min(dur - 0.05, Math.max(seconds, 3.9)); const Lf = Math.max(2, Math.min(n, Math.round(L * FPS))); const Ls = Lf / FPS;
  const graph = `${base},split=2[m0][f0];[m0]trim=end_frame=${Lf},setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration=${HOLD}[m];[f0]trim=end_frame=1,setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration=${FADE + 0.1},trim=0:${FADE + 0.1},setpts=PTS-STARTPTS[f];[m][f]xfade=transition=fade:duration=${FADE}:offset=${(Ls + HOLD - FADE).toFixed(4)}[x];${finish('x')}`;
  encode(graph, Ls + HOLD + 0.1); res = { mode: 'once', start: 0, played: +Ls.toFixed(3), blended: false };
  if (!best) warnings.push(`the render (${dur.toFixed(2)} s) is too short to hold two frames ${lo.toFixed(2)} s apart`);
}

// ---- poster, sheet, and the first-frame check
const outP = probe(`${a.out}.mp4`); const len = outP.duration;
ff(['-ss', (0.35 * len).toFixed(3), '-i', `${a.out}.mp4`, '-frames:v', '1', '-vf', 'scale=320:-2', '-c:v', 'libwebp', '-quality', '82', `${a.out}.webp`]);
ff(['-i', `${a.out}.mp4`, '-vf', `fps=8/${len.toFixed(3)},scale=240:-1,tile=8x1`, '-frames:v', '1', '-q:v', '4', `${a.out}-sheet.jpg`]);
const og = grayFrames(outP, { fps: FPS, size: [W, W] }); const od = differ(og); let blank = false, loopJump = null; const P = W * W;
if (og.n >= 3) { let lum0 = 0, lum1 = 0; for (let i = 0; i < P; i++) { lum0 += og.raw[i]; lum1 += og.raw[P + i]; } lum0 /= P; lum1 /= P; const steps = []; for (let i = 1; i < og.n - 1; i++) steps.push(od(i, i + 1)); steps.sort((x, y) => x - y); const typ = steps[Math.floor(steps.length / 2)] || 0;
  const lumOf = (i) => { let t = 0; for (let k = 0; k < P; k++) t += og.raw[i * P + k]; return t / P; }; const later = []; for (let i = 5; i < og.n; i++) later.push(lumOf(i)); later.sort((x, y) => x - y); const lumRef = later.length ? later[Math.floor(later.length / 2)] : lum1; // the first frame against the frames from the sixth on: two black frames in a row are caught as well
  blank = lum0 < 0.5 * lumRef && lumRef > 8; const unit = a.hold ? Math.max(typ, 0.25) : typ; /* a hold hardly moves: a step is never counted as under a quarter of a gray level, or the encoder's own noise reads as a jump */ loopJump = unit > 0 ? +(od(og.n - 1, 0) / unit).toFixed(2) : 0; }
if (blank) warnings.push('the first frame of the loop is blank');
if (outP.width !== SIZE || outP.height !== SIZE) warnings.push(`the loop is ${outP.width}x${outP.height}, not ${SIZE}x${SIZE}`);

process.stdout.write(`${JSON.stringify({ mode: res.mode, length: +len.toFixed(3), seam: best ? +best.d.toFixed(2) : null, ratio: best ? +ratio.toFixed(2) : null, bytes: fs.statSync(`${a.out}.mp4`).size,
  start: res.start, blended: res.blended, ...(res.mode === 'hold' ? { crossfade: res.crossfade, drift: res.drift } : {}), typicalStep: +med.toFixed(2), loopJump, frames: og.n, searched: [+lo.toFixed(2), +hi.toFixed(2)], render: { seconds: +dur.toFixed(2), width: p.width, height: p.height }, out: `${a.out}.mp4`, poster: `${a.out}.webp`, sheet: `${a.out}-sheet.jpg`, warnings })}\n`);
if (blank) process.exit(1);
