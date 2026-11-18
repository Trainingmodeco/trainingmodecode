#!/usr/bin/env node
import fs from 'node:fs'; import path from 'node:path'; import { execFileSync, spawnSync } from 'node:child_process';
// split.mjs <video> --out <json> [--debug <dir>] [--proxy <small copy>]                              builder A: "periodicity first"
//
// Finds the stretches of a workout video where a movement REPEATS ("bouts"), tells different movements apart, calls the rest junk
// (set-up, walking, resting, talking) and gives every bout a crop box around the athlete. Pure Node + ffmpeg/ffprobe, no other packages.
// It never looks for cuts: a bout is found from its own rhythm, so one continuous take works the same as a stitched video.
//
// OUTPUT (the JSON written to --out)
//   { video, duration, fps, width, height,                     duration in seconds; width/height as displayed (after the phone's rotation flag)
//     proxy, camera, timingMs,                                 extras: the small picture worked on, whether the camera was hand-held, where the time went
//     segments: [ { idx, start, end,                           seconds; sorted, no overlaps, the whole video is covered
//                   kind: "exercise" | "junk",
//                   group,                                     exercise: 1,2,3.. the same number for bouts of the same movement in this video; junk: 0
//                   period, reps,                              seconds per rep and how many reps the segment holds (junk: null)
//                   crop: [w,h,x,y],                           source pixels, around the athlete over the bout, padded 8 %
//                   score,                                     0..1: how sure this is a clean repeated exercise (junk: 0)
//                   similarTo,                                 exercise only: idx of the segment just before whose rhythm this one carries on (a variant, the other side), else null
//                   why } ] }                                  a short reason in words
//   Added 2026-11-18 (see verify/): an exercise segment also carries cropHow (what its box was built from) and, when the box is only a fallback, cropUnsure: true;
//   a junk segment in which the picture holds still for HOLD_SECONDS or more carries still: [from, to] in seconds and says in why that it may be a HOLD exercise (plank, hang).
//   Added 2026-11-18 (second round): every segment carries warn (plain warnings for the owner, at most four: "The camera moved", "Very dark", "Flickering light", "Someone else may be moving in the picture",
//   "The crop may cut off part of the body", "Only one or two reps here"), hold ([from, to] of a still stretch of HOLD_SECONDS or more in junk, else null) and say (one short plain sentence; why stays the full reason).
//   The top level carries light: { bright, contrast, dark, blind, bands }. A bout may be carried on past the stretch its rhythm was found in (6b, 6c); its why then says so.
//   Exit code 0 with a JSON even when nothing repeats (one junk segment); exit 1 and one line on stderr when the file cannot be read as a video.
//
// HOW IT WORKS
//   1. Decode ONCE with ffmpeg to a grey proxy: FPS frames a second, LONG pixels on the long side. Everything below runs on that.
//      If the whole picture shifts from frame to frame (a hand-held phone), the proxy is steadied first (1b).
//   2. Features: BLK x BLK block means of each frame, minus the frame's own mean (exposure steps cancel) and minus the video's mean picture.
//      "Distance" of two frames = mean squared difference of their features. "Noise" = what a still pixel changes by, measured in this video.
//      "eRef" = the video's own strong-movement level: the 90th percentile over time of the change between frames two apart, less noise.
//   3. Repetition field S(time, lag): take the CHANGE picture at time t (frame t+j minus frame t-j) and the change picture one lag later.
//      If the movement repeats with that lag the two change pictures agree: S = their inner product minus THETA x the geometric mean of
//      their energies, so S > 0 only where the two agree better than a cosine of THETA. Still frames give 0, unrelated movement gives < 0.
//      A path through the field (the lag may drift by a frame at a time, so the tempo may change) collects S; the best paths are the candidates.
//      A path is cut where it earns nothing for a whole period (a rest ends a bout). Frames at a "jump" (see JUMP) can lose but never earn.
//   4. There-and-back chains: for movements with too few or too uneven reps for 3 (dead hangs, slow pull-ups): the picture leaves a
//      posture, comes back to it and does so again from the same place. Kept only where 3 found nothing, and always with a low score.
//   5. Bouts: candidates that last long enough, earn enough and agree well enough, shortest period first; a candidate that lies inside bouts
//      already taken is their double or triple period and is dropped (unless twice the period agrees clearly better: sides alternate).
//   6. A bout is split where the posture changes for good while the rhythm goes on (squats into narrow squats, one side into the other).
//   7. Chains fill what is left.   8. Each bout is trimmed to whole reps: the longest stretch whose first and last frames show the same posture.
//   9. Groups: two bouts are the same movement when the frames of each are found in the other about as well as in its own other reps.
//  10. Crop: see the comment at cropOf.   11. --debug: timeline.png (signals over time, boundaries marked), a contact sheet and a crop map per segment.
//
// THE CONSTANTS. None was found by searching for the best test score; each has its reason next to it. Each is a time in seconds (how long a rep
// can be), a size of the proxy, or a ratio against something measured in the same video (its noise, its strong-movement level eRef, a bout's own
// period, range or spread). Changing THETA, MIN_COS, MIN_GAIN, JUMP or X_Q by a fifth leaves the test score where it is (lab/sweep-final.txt);
// the one it hangs on is CHANGE/GROUP: squats running into narrow squats are told apart at 1.5 and no longer at 1.8.
const K = {
  // --- the proxy
  FPS: 15,           // proxy frames per second: a rep of MINLAG seconds still spans 9 frames
  LONG: 128,         // proxy pixels on the long side (the short side follows the picture's shape)
  BLK: 2,            // features are means over BLK x BLK proxy pixels
  // --- the repetition field
  MINLAG: 0.6,       // shortest rep looked for, seconds
  MAXLAG: 16,        // longest rep looked for, seconds (never more than the video allows). Was 10: a slow rep, or a kettlebell or barbell complex done as one rep, takes 12-15 s, and a bout of 7+ s a rep was lost whole (verify/: slow05-A). The test score is the same at 16, the run 10 % slower
  JDIV: 10, JMAX: 4, // a change picture spans +-j frames, j = period / JDIV, at least 1 and at most JMAX (slow reps are measured over a longer step)
  THETA: 0.35,       // two change pictures one period apart count as a repeat when their cosine is above this
  KAPPA: 1,          // a path forgets what it earned over KAPPA periods
  RHO: 0.25,         // a path ends where its running gain falls under RHO of its own best
  JUMP: 4,           // a frame where the picture changes JUMP x eRef and JUMP x the median change of the second around it is a jump (cut, bump, flash)
  // --- which candidates become bouts
  MIN_GAIN: 3,       // total gain of at least MIN_GAIN x eRef (a third of a second of strong, perfectly repeated movement; weaker movement needs longer)
  MIN_DUR: 0.5,      // the path lasts at least MIN_DUR of its period (so the bout spans one and a half reps or more) ...
  MIN_SECONDS: 1.0,  // ... and at least this many seconds
  MIN_COS: 0.5,      // mean cosine between the change pictures one period apart, along the path
  EXPLAINED: 0.6,    // a candidate with this share of its frames inside bouts of a shorter period is a multiple of them
  DOUBLE_COS: 0.08,  // twice the period is taken (sides alternate) when it agrees better by this much cosine
  CHANGE: 1.5,       // split a bout where frames one period apart across a point differ CHANGE x more than such pairs before it and after it (and the halves fail GROUP)
  EXTEND: 1,         // 1: carry a bout on at both ends while the frames there match its reps (6b); 0 switches that off
  EXT_LAG: 1.6,      // ... the rep carried on may be this much slower or faster than the bout's own (the same room prep.mjs gives a rep: 0.6-1.6 of the period)
  EXT_POSE: 1,       // 1: also carry a bout on where the frames outside it go through the postures of the rep next to them (6c); 0 switches that off
  // --- there-and-back chains
  X_Q: 0.25,         // the picture comes back to within X_Q of how far it went
  X_AMP: 0.75,       // and went at least X_AMP x eRef away
  X_MINLAG: 0.8,     // shortest there-and-back, seconds
  X_MAXLAG: 10,      // longest there-and-back, seconds: chains keep the old limit. They ask for no matching movement, and over 10-16 s somebody who walks off and comes back to the same spot twice passes for one (verify/: long8)
  X_REST: 0.6,       // at the three turning points the picture rests: its movement is under X_REST of the movement between them
  // --- trimming to whole reps (costs in units of one period)
  SNAP_TRIM: 0.5,    // cutting one period off costs as much as a seam SNAP_TRIM of the bout's range of movement apart
  SNAP_BALANCE: 0.1, // cutting unevenly at the two ends costs a little
  SNAP_KEEP: 1.8,    // never trim to under SNAP_KEEP periods (or half the bout)
  // --- groups
  GROUP: 1.5,        // same movement: the frames of one bout are found in the other within GROUP x the spread among a bout's own reps
  GROUP_PERIOD: 1.7, // ... and the periods differ by less than this factor
  SAME_RHYTHM: 1.25, // "carries on the rhythm of the bout before": periods within this factor and no more than one period between them
  VARIANT: 2,        // ... and when the postures differ by less than VARIANT x GROUP it may be the same exercise drifting: the later one is marked
  UNSURE: 0.8,       // ... and its score is multiplied by this
  // --- crop (see cropOf)
  CROP_STRONG: 0.25, // strong pixels: energy of CROP_STRONG x the map's 99.5th percentile
  CROP_WEAK: 3,      // stirring pixels: mean energy of CROP_WEAK x the pixel's own noise
  CROP_RHYTHM: 1,    // 1: the strong pixels must change in the bout's rhythm (0 switches that off, lab only)
  CROP_RHO: 0.25,    // debug map only: a stirring pixel is drawn "in rhythm" when its change correlates this much with its change one period later
  CROP_FILL: 0.3,    // the core takes in places where this share of the 5x5 neighbourhood stirs
  CROP_PART: 0.2,    // a separate moving region is part of the athlete when it carries this share of the largest one's energy
  CROP_GROW: 3,      // a core box this many times the box of the strong pixels has flooded
  CROP_R2: 0.04,     // still parts: neighbourhood radius as a share of the proxy's long side
  CROP_FILL2: 0.12,  // still parts: share of that neighbourhood that stirs
  CROP_GROW2: 2,     // still parts are dropped when they grow the box more than this many times
  CROP_SKIP: 3,      // frames that change CROP_SKIP x the bout's 90th percentile are left out of the map
  CROP_FLICKER: 3,   // the light flickers when the exposure moves this many gray levels between frames two apart, as a median over the bout (see even in cropOf)
  CROP_PAD: 0.08,    // padding on every side, share of the box
  // --- what is said about junk
  STILL: 0.1,        // the picture "holds still" while its movement stays under STILL of the video's strong-movement level (the floor "moving" is counted from in describe)
  HOLD_SECONDS: 4,   // a still stretch this long inside junk is named, it may be a hold exercise (rests between the test set's bouts hold still for 0.1-3.7 s, a plank for 19 s)
  // --- what the owner is warned of (warn: plain words, at most four a stretch)
  DARK: 0.2,         // "Very dark": the bright parts of the picture (90th percentile of the mean picture) are under DARK of full white (the 50 raw uploads: 0.41 and up; verify/dark-A 0.11)
  DARK_BLIND: 0.04,  // too dark to trust a weak find: the mean picture spans under DARK_BLIND of full scale between its 2nd and 98th percentile (verify/dark2-A 0.03, dark-A 0.07, the raw uploads 0.28 and up)
  BANDS_COR: 0.5,    // rolling bands of mains flicker: along the rows (or columns) the left and the right third of the picture brighten and darken together, with a correlation of BANDS_COR or more ...
  BANDS_AMP: 0.06,   // ... by BANDS_AMP of the picture's contrast or more (verify/bands-A: 0.80 and 0.145; every other video seen: under 0.031 wherever the correlation is 0.4 or more)
  OTHER_AREA: 0.005, // "someone else": this share of the picture moves in clumps away from the athlete's box, each block as much as the video's strong-movement level ...
  OTHER_SHARE: 0.2,  // ... in more than this share of the bout's frames
  FEW_REPS: 2.5,     // "Only one or two reps here": under FEW_REPS reps
  // --- hand-held camera (1b)
  CAM_SHIFT: 0.04,   // hand-held when the picture shifts by a median of this many proxy pixels a frame (0.03 % of the long side) ...
  CAM_DRIFT: 1.5,    // ... and wanders at least this many proxy pixels (1.2 % of the long side) from its middle position
  CAM_MAX: 0.2,      // never steady by more than this share of the picture
  CAM_RING: 0.25,    // the shift is measured on the outer quarter of the picture, where the athlete usually is not
  CAM_STEP: 0.25,    // "The camera moved" also when the background of a bout ends up this many proxy pixels (0.2 % of the long side) from where it was (see camMoved)
};
// Floors that keep the ratios meaningful in a perfectly clean video: noise is never taken under 0.02 grey levels squared, eRef never under 10 x noise.
// Smaller fixed ratios sit in the code where they are used (none is a number of pixels or grey levels of a particular video):
//   a still pixel's noise is taken off every change energy 1.5 times over; a path is drawn out only if it earned 1 x eRef (at most 400 paths);
//   a bout left shorter than 1.2 periods once its neighbours are cut apart is dropped; a chain is used when repeats cover under 0.3 of it and 0.7 of it is left;
//   two there-and-backs follow each other when their lengths differ by less than 2 x and their ranges by less than 3 x;
//   trimming looks at most 0.9 of a period (or a third of the bout) into each end; a bout's range of movement is never taken under 4 x noise;
//   a jump is judged against the half second on either side of it; the camera's shift is not trusted over 2 proxy pixels a frame or when under 0.4 of the ring agrees;
//   score = 0.3 + 0.4 x (match, from MIN_COS up to MIN_COS + 0.35) + 0.3 x (reps, from 1.5 up to 3.5); a chain scores 0.5 at most (see the output section).
if (process.env.SPLIT_K) Object.assign(K, JSON.parse(process.env.SPLIT_K)); // lab only: try other constants

const argv = process.argv.slice(2); const optv = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const video = argv.find((v, i) => !v.startsWith('--') && !['--out', '--debug', '--proxy'].includes(argv[i - 1])); const outF = optv('--out'), dbgDir = optv('--debug'), proxyF = optv('--proxy');
if (!video || !outF) { console.error('usage: node split.mjs <video> --out <json> [--debug <dir>] [--proxy <small copy of the video>]'); process.exit(2); }
const T0 = Date.now(); const timing = {}; const lap = (k) => { timing[k] = Date.now() - T0; };
const pct = (arr, p) => { const s = Float64Array.from(arr).sort(); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * p))] : 0; }; const median = (arr) => pct(arr, 0.5);

// ---------- 1. probe + decode once to a small gray proxy ----------
const die = (msg) => { console.error('split.mjs: ' + msg); process.exit(1); }; const lastLine = (t) => String(t || '').trim().split('\n').pop().slice(0, 240);
let pj; try { pj = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,avg_frame_rate,r_frame_rate:stream_side_data=rotation:stream_tags=rotate:format=duration', '-of', 'json', video], { stdio: ['ignore', 'pipe', 'pipe'] }).toString()); } catch (e) { die('cannot read ' + video + ' as a video: ' + lastLine(e.stderr || e.message)); }
const st = (pj.streams || [])[0]; if (!st || !st.width || !st.height) die(video + ' has no video stream'); let rot = 0; for (const sd of st.side_data_list || []) if (sd.rotation != null) rot = Number(sd.rotation); if (st.tags && st.tags.rotate) rot = Number(st.tags.rotate);
const turned = Math.abs(rot) % 180 === 90; const SRCW = turned ? st.height : st.width, SRCH = turned ? st.width : st.height;
const fr = (s) => { const [a, b] = String(s || '0/1').split('/').map(Number); return b ? a / b : 0; }; const srcFps = fr(st.avg_frame_rate) || fr(st.r_frame_rate) || 30; let duration = Number(pj.format && pj.format.duration);
const FPS = K.FPS; const W = SRCW >= SRCH ? K.LONG : Math.max(8, Math.round(K.LONG * SRCW / SRCH / 4) * 4), H = SRCW >= SRCH ? Math.max(8, Math.round(K.LONG * SRCH / SRCW / 4) * 4) : K.LONG;
// The decode is nearly all of the run on heavy footage (4K 60 fps HEVC 10-bit: 0.70 x real time). Two ways round it, neither of which drops a frame the proxy needs:
//   --proxy <file>: a small upright copy of the same video with the same clock (ingest.mjs makes one of every video: 480 px, 15 fps, HDR tone-mapped) is read instead of the original; scan.mjs passes it for heavy footage.
//     Sizes, duration and frame rate are still the original's, so boxes come out in its pixels. If the copy cannot be read the original is.
//   at 50 frames a second or more the decoder leaves out the frames no other frame is predicted from (-skip_frame noref): the proxy takes 15 a second, the rest is decoded for nothing. Never -skip_frame nokey.
const WH = W * H; const decode = (file, extra) => spawnSync('ffmpeg', ['-nostdin', '-loglevel', 'error', '-skip_loop_filter', 'all', ...extra, '-i', file, '-an', '-sn', '-vf', `fps=${FPS},scale=${W}:${H}:flags=area,format=gray`, '-f', 'rawvideo', '-'], { maxBuffer: 1 << 30 });
let dec = null, usedProxy = false; if (proxyF && fs.existsSync(proxyF)) { dec = decode(proxyF, []); usedProxy = !dec.error && dec.status === 0 && Math.floor((dec.stdout || []).length / WH) >= 2; }
if (!usedProxy) dec = decode(video, srcFps >= 50 ? ['-skip_frame', 'noref'] : []);
let raw = dec.stdout || Buffer.alloc(0); const n = Math.floor(raw.length / WH);
if (dec.error || (dec.status !== 0 && n < 2)) die('ffmpeg could not decode ' + video + ': ' + lastLine(dec.error ? dec.error.message : dec.stderr));
if (dec.status !== 0) console.error('split.mjs: ' + video + ' is damaged, working on the ' + n + ' frames that decoded: ' + lastLine(dec.stderr));
if (!(duration > 0)) duration = n / K.FPS; lap('decode');

// ---------- 1a. the light: is the picture very dark, and do bands of mains flicker roll through it? ----------
// Bands: a lamp on mains and a phone's rolling shutter give soft bright bands that travel down the picture, the same across its whole width. They repeat, so the field of 3 takes them
// for an exercise that never stops (verify/bands-A: 8 false bouts over the whole video). Along a row the left third and the right third then change together, which an athlete never
// does (he is in one place). When they do, each frame's rows (or columns) are put back to their usual level against the rest of the frame before anything else is measured.
const light = { bright: 1, contrast: 1, dark: false, blind: false, bands: null }; const rr = (v) => Math.round(v * 1000) / 1000;
if (n >= 8) { const lum = new Float64Array(n), meanPic = new Float64Array(WH); for (let i = 0; i < n; i++) { const o = i * WH; let t = 0; for (let p = 0; p < WH; p++) { const v = raw[o + p]; t += v; meanPic[p] += v; } lum[i] = t / WH; } for (let p = 0; p < WH; p++) meanPic[p] /= n;
  const contrast = pct(meanPic, 0.98) - pct(meanPic, 0.02); light.bright = rr(pct(meanPic, 0.9) / 255); light.contrast = rr(contrast / 255); light.dark = light.bright < K.DARK; light.blind = light.contrast < K.DARK_BLIND;
  const bandsOf = (rows) => { const NR = rows ? H : W, third = Math.floor((rows ? W : H) / 3); const L = new Float32Array(n * NR), R = new Float32Array(n * NR);
    for (let i = 0; i < n; i++) { const o = i * WH; let ml = 0, mr = 0; for (let r = 0; r < NR; r++) { let a = 0, b = 0; for (let k = 0; k < third; k++) { a += rows ? raw[o + r * W + k] : raw[o + k * W + r]; b += rows ? raw[o + r * W + (W - 1 - k)] : raw[o + (H - 1 - k) * W + r]; } L[i * NR + r] = a / third; R[i * NR + r] = b / third; ml += a / third; mr += b / third; } ml /= NR; mr /= NR; for (let r = 0; r < NR; r++) { L[i * NR + r] -= ml; R[i * NR + r] -= mr; } }
    const cors = [], covs = []; for (let r = 0; r < NR; r++) { let sl = 0, sr = 0, sll = 0, srr = 0, slr = 0, c = 0; for (let i = 2; i < n; i++) { const a = L[i * NR + r] - L[(i - 2) * NR + r], b = R[i * NR + r] - R[(i - 2) * NR + r]; sl += a; sr += b; sll += a * a; srr += b * b; slr += a * b; c++; } const va = sll / c - (sl / c) ** 2, vb = srr / c - (sr / c) ** 2, cv = slr / c - (sl / c) * (sr / c); cors.push(cv / Math.sqrt(va * vb + 1e-9)); covs.push(cv); }
    return { cor: median(cors), amp: Math.sqrt(Math.max(0, median(covs)) / 2) / Math.max(1, contrast) }; };
  const br = bandsOf(true), bc = bandsOf(false); light.rows = [rr(br.cor), rr(br.amp)]; light.cols = [rr(bc.cor), rr(bc.amp)];
  if (!light.blind) { if (br.cor >= K.BANDS_COR && br.amp >= K.BANDS_AMP) light.bands = 'rows'; else if (bc.cor >= K.BANDS_COR && bc.amp >= K.BANDS_AMP) light.bands = 'columns'; }
  if (light.bands) { const rows = light.bands === 'rows', NR = rows ? H : W, len = rows ? W : H; const lv = new Float32Array(n * NR), usual = new Float64Array(NR);
    for (let i = 0; i < n; i++) { const o = i * WH; for (let r = 0; r < NR; r++) { let a = 0; for (let k = 0; k < len; k++) a += rows ? raw[o + r * W + k] : raw[o + k * W + r]; lv[i * NR + r] = a / len - lum[i]; usual[r] += a / len - lum[i]; } } for (let r = 0; r < NR; r++) usual[r] /= n;
    for (let i = 0; i < n; i++) { const o = i * WH; for (let r = 0; r < NR; r++) { const off = lv[i * NR + r] - usual[r]; for (let k = 0; k < len; k++) { const p = rows ? o + r * W + k : o + k * W + r; const v = Math.round(raw[p] - off); raw[p] = v < 0 ? 0 : v > 255 ? 255 : v; } } } }
}
lap('light');

// ---------- 1b. a hand-held camera: measure how the whole picture shifts from frame to frame and, if it does, steady the proxy ----------
const cam = new Float64Array(n * 2); let handHeld = false, camShift = 0, camDrift = 0, camPath = new Float64Array(n * 2);
{ const gx = new Float32Array(WH), gy = new Float32Array(WH), it = new Float32Array(WH), wt = new Uint8Array(WH); const mags = []; let cx = 0, cy = 0; const res = new Float32Array(Math.ceil(W / 2) * Math.ceil(H / 2));
  const ring = (xx, y) => xx < W * K.CAM_RING || xx >= W * (1 - K.CAM_RING) || y < H * K.CAM_RING || y >= H * (1 - K.CAM_RING); // the middle of the picture, where the athlete is, is not asked
  for (let i = 1; i < n; i++) { const a = (i - 1) * WH, b = i * WH; let cntAll = 0; for (let y = 1; y < H - 1; y += 2) for (let xx = 1; xx < W - 1; xx += 2) { const p = y * W + xx; if (!ring(xx, y)) { wt[p] = 0; gx[p] = gy[p] = it[p] = 0; continue; } gx[p] = (raw[a + p + 1] - raw[a + p - 1] + raw[b + p + 1] - raw[b + p - 1]) / 4; gy[p] = (raw[a + p + W] - raw[a + p - W] + raw[b + p + W] - raw[b + p - W]) / 4; it[p] = raw[b + p] - raw[a + p]; wt[p] = 1; cntAll++; }
    let dx = 0, dy = 0, inl = cntAll; for (let iter = 0; iter < 4; iter++) { let sxx = 0, sxy = 0, syy = 0, sxt = 0, syt = 0; for (let y = 1; y < H - 1; y += 2) for (let xx = 1; xx < W - 1; xx += 2) { const p = y * W + xx; if (!wt[p]) continue; sxx += gx[p] * gx[p]; sxy += gx[p] * gy[p]; syy += gy[p] * gy[p]; sxt += gx[p] * it[p]; syt += gy[p] * it[p]; }
      const det = sxx * syy - sxy * sxy; if (!(det > 1e-6)) { dx = dy = 0; break; } dx = -(syy * sxt - sxy * syt) / det; dy = -(sxx * syt - sxy * sxt) / det; let k = 0; for (let y = 1; y < H - 1; y += 2) for (let xx = 1; xx < W - 1; xx += 2) { if (!ring(xx, y)) continue; const p = y * W + xx; res[k++] = Math.abs(it[p] + gx[p] * dx + gy[p] * dy); }
      const srt = res.subarray(0, k).slice().sort(); const lim = Math.max(1, 3 * srt[k >> 1]); inl = 0; for (let y = 1; y < H - 1; y += 2) for (let xx = 1; xx < W - 1; xx += 2) { if (!ring(xx, y)) continue; const p = y * W + xx; wt[p] = Math.abs(it[p] + gx[p] * dx + gy[p] * dy) <= lim ? 1 : 0; inl += wt[p]; } }
    const mag = Math.hypot(dx, dy); if (mag > 2 || inl < 0.4 * cntAll) { dx = 0; dy = 0; } else mags.push(mag); cx += dx; cy += dy; cam[i * 2] = cx; cam[i * 2 + 1] = cy; }
  camShift = mags.length ? pct(mags, 0.5) : 0; const xsA = [], ysA = []; for (let i = 0; i < n; i++) { xsA.push(cam[i * 2]); ysA.push(cam[i * 2 + 1]); } const mx = pct(xsA, 0.5), my = pct(ysA, 0.5); for (let i = 0; i < n; i++) { cam[i * 2] -= mx; cam[i * 2 + 1] -= my; camDrift = Math.max(camDrift, Math.hypot(cam[i * 2], cam[i * 2 + 1])); }
  camPath = Float64Array.from(cam); handHeld = camShift >= K.CAM_SHIFT && camDrift >= K.CAM_DRIFT;
  if (handHeld) { const st2 = Buffer.alloc(n * WH); const lx = K.CAM_MAX * W, ly = K.CAM_MAX * H; for (let i = 0; i < n; i++) { const ox = Math.max(-lx, Math.min(lx, cam[i * 2])), oy = Math.max(-ly, Math.min(ly, cam[i * 2 + 1])); cam[i * 2] = ox; cam[i * 2 + 1] = oy; const o = i * WH;
      for (let y = 0; y < H; y++) { const fy0 = Math.max(0, Math.min(H - 1.001, y + oy)); const y0 = Math.floor(fy0), wy = fy0 - y0; for (let xx = 0; xx < W; xx++) { const fx0 = Math.max(0, Math.min(W - 1.001, xx + ox)); const x0 = Math.floor(fx0), wx = fx0 - x0; const p = o + y0 * W + x0; st2[o + y * W + xx] = Math.round((raw[p] * (1 - wx) + raw[p + 1] * wx) * (1 - wy) + (raw[p + W] * (1 - wx) + raw[p + W + 1] * wx) * wy); } } } raw = st2; } else cam.fill(0); }
// where the steadied picture sits in the real one during a stretch: mean offset and how far it ranges
const camOf = (a, b) => { if (!handHeld) return [0, 0, 0, 0]; let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity; for (let i = Math.max(0, a); i <= Math.min(n - 1, b); i++) { x0 = Math.min(x0, cam[i * 2]); x1 = Math.max(x1, cam[i * 2]); y0 = Math.min(y0, cam[i * 2 + 1]); y1 = Math.max(y1, cam[i * 2 + 1]); } return [Math.round((x0 + x1) / 2), Math.round((y0 + y1) / 2), Math.ceil((x1 - x0) / 2), Math.ceil((y1 - y0) / 2)]; };
// did the camera move during a stretch? Three signs, any one is enough:
//   the whole video is hand-held (above);
//   the camera's path within the stretch is that of a hand: it shifts CAM_SHIFT a frame (median) and wanders CAM_DRIFT from where it mostly is;
//   (bouts only) the background ends up somewhere else: the median picture of the stretch's last third lies CAM_STEP proxy pixels or more from that of its first third, measured on what is outside the
//   athlete's box (a phone that slides or is nudged, a slow pan). The path alone is not trusted for this: in a picture with little in it (sky behind a pull-up bar) the athlete's own movement pulls it by
//   1-2 pixels and back (measured: path 1.7 px, background 0.01 px). Bouts on a tripod measure 0.00-0.09 px here, cameras that moved 0.31 px and up.
const lastingShift = (a, b, bx) => { a = Math.max(0, a); b = Math.min(n - 1, b); const th = Math.floor((b - a + 1) / 3); if (th < 3 || !bx) return 0; const k = Math.min(9, th); const med = (f0) => { const out = new Float32Array(WH), col = new Float32Array(k); for (let p = 0; p < WH; p++) { for (let q = 0; q < k; q++) col[q] = raw[(f0 + Math.floor(q * th / k)) * WH + p]; col.sort(); out[p] = col[k >> 1]; } return out; };
  const M1 = med(a), M2 = med(b - th + 1); const padP = Math.max(3, Math.round(0.08 * Math.max(W, H))); const idx = []; for (let y = 1; y < H - 1; y++) for (let xx = 1; xx < W - 1; xx++) if (!(xx >= bx[0] - padP && xx <= bx[2] + padP && y >= bx[1] - padP && y <= bx[3] + padP)) idx.push(y * W + xx);
  if (idx.length < 0.1 * WH) return 0; /* the athlete fills the picture: nothing to judge by */ const m = idx.length, gx = new Float32Array(m), gy = new Float32Array(m), it = new Float32Array(m), wt = new Uint8Array(m).fill(1), res = new Float32Array(m);
  for (let q = 0; q < m; q++) { const p = idx[q]; gx[q] = (M1[p + 1] - M1[p - 1] + M2[p + 1] - M2[p - 1]) / 4; gy[q] = (M1[p + W] - M1[p - W] + M2[p + W] - M2[p - W]) / 4; it[q] = M2[p] - M1[p]; }
  let dx = 0, dy = 0; for (let iter = 0; iter < 4; iter++) { let sxx = 0, sxy = 0, syy = 0, sxt = 0, syt = 0; for (let q = 0; q < m; q++) { if (!wt[q]) continue; sxx += gx[q] * gx[q]; sxy += gx[q] * gy[q]; syy += gy[q] * gy[q]; sxt += gx[q] * it[q]; syt += gy[q] * it[q]; } const det = sxx * syy - sxy * sxy; if (!(det > 1e-6)) return 0;
    dx = -(syy * sxt - sxy * syt) / det; dy = -(sxx * syt - sxy * sxt) / det; for (let q = 0; q < m; q++) res[q] = Math.abs(it[q] + gx[q] * dx + gy[q] * dy); const lim = Math.max(1, 3 * res.slice().sort()[m >> 1]); for (let q = 0; q < m; q++) wt[q] = res[q] <= lim ? 1 : 0; }
  return Math.hypot(dx, dy); };
const camMoved = (a, b, bx) => { if (handHeld) return true; a = Math.max(0, a); b = Math.min(n - 1, b); if (b - a < 4) return false; const xs = [], ys = [], mg = []; for (let i = a; i <= b; i++) { xs.push(camPath[i * 2]); ys.push(camPath[i * 2 + 1]); if (i > a) mg.push(Math.hypot(camPath[i * 2] - camPath[i * 2 - 2], camPath[i * 2 + 1] - camPath[i * 2 - 1])); }
  const mx = median(xs), my = median(ys); let dev = 0; for (let q = 0; q < xs.length; q++) dev = Math.max(dev, Math.hypot(xs[q] - mx, ys[q] - my)); if (median(mg) >= K.CAM_SHIFT && dev >= K.CAM_DRIFT) return true; return lastingShift(a, b, bx) >= K.CAM_STEP; };
lap('camera');
const sec = (i) => i / FPS; const r3 = (v) => Math.round(v * 1000) / 1000;
const whole = (why) => [{ idx: 0, start: 0, end: r3(duration), kind: 'junk', group: 0, period: null, reps: null, crop: [SRCW, SRCH, 0, 0], score: 0, hold: null, warn: light.dark ? ['Very dark'] : [], say: why.charAt(0).toUpperCase() + why.slice(1), why }];
const write = (segments, extra = {}) => fs.writeFileSync(outF, JSON.stringify({ video, duration: r3(duration), fps: r3(srcFps), width: SRCW, height: SRCH, proxy: { fps: FPS, width: W, height: H, frames: n, from: usedProxy ? proxyF : 'the video itself' }, camera: { handHeld, shiftPerFrame: r3(camShift), drift: r3(camDrift) }, light, timingMs: timing, ...extra, segments }, null, 1));
if (n < 2 * FPS) { write(whole('too short to hold a repeated movement')); process.exit(0); }

// ---------- 2. features ----------
const BLK = K.BLK, fw = W / BLK, fh = H / BLK, F = fw * fh; const X = new Float32Array(n * F);
for (let i = 0; i < n; i++) { let m = 0; const o = i * WH, q = i * F; for (let y = 0; y < fh; y++) for (let xx = 0; xx < fw; xx++) { let s = 0; for (let dy = 0; dy < BLK; dy++) { const r = o + (y * BLK + dy) * W + xx * BLK; for (let dx = 0; dx < BLK; dx++) s += raw[r + dx]; } s /= BLK * BLK; X[q + y * fw + xx] = s; m += s; } m /= F; for (let p = 0; p < F; p++) X[q + p] -= m; }
{ const mean = new Float64Array(F); for (let i = 0; i < n; i++) { const q = i * F; for (let p = 0; p < F; p++) mean[p] += X[q + p]; } for (let p = 0; p < F; p++) mean[p] /= n; for (let i = 0; i < n; i++) { const q = i * F; for (let p = 0; p < F; p++) X[q + p] -= mean[p]; } }
let noise; { const step = Math.max(1, Math.floor((n - 2) / 240)); const cnt = Math.floor((n - 2) / step); const col = new Float32Array(Math.max(1, cnt)); const med = new Float32Array(F);
  for (let p = 0; p < F; p++) { for (let k = 0; k < cnt; k++) { const i = 1 + k * step; const d = X[(i + 1) * F + p] - X[(i - 1) * F + p]; col[k] = d * d; } col.sort(); med[p] = col[cnt >> 1] || 0; }
  med.sort(); let s = 0; const half = Math.max(1, F >> 1); for (let p = 0; p < half; p++) s += med[p]; noise = Math.max(0.02, s / half / 0.455); }
const LMIN = Math.max(2, Math.round(K.MINLAG * FPS)), LMAX = Math.max(LMIN, Math.min(Math.round(K.MAXLAG * FPS), n - 2 * K.JMAX - 2)), NL = LMAX - LMIN + 1; const jOf = (L) => Math.max(1, Math.min(K.JMAX, Math.round(L / K.JDIV)));
const XL = LMAX + 2 * K.JMAX, SW = XL + 1; const G = new Float64Array(n * SW);
for (let i = 0; i < n; i++) { const a = i * F; const top = Math.min(XL, n - 1 - i); for (let L = 0; L <= top; L++) { const b = (i + L) * F; let s = 0; for (let p = 0; p < F; p++) s += X[a + p] * X[b + p]; G[i * SW + L] = s / F; } }
const gg = (i, k) => (i <= k ? G[i * SW + (k - i)] : G[k * SW + (i - k)]);
const distFar = (i, k) => { const a = i * F, b = k * F; let s = 0; for (let p = 0; p < F; p++) { const d = X[a + p] - X[b + p]; s += d * d; } return s / F; };
const dist = (i, k) => (Math.abs(i - k) <= XL ? Math.max(0, gg(i, i) + gg(k, k) - 2 * gg(i, k)) : distFar(i, k)); // mean squared difference of two frames
const eRaw = [null], eNet = [null]; for (let j = 1; j <= K.JMAX; j++) { const e = new Float64Array(n), en = new Float64Array(n); for (let i = j; i + j < n; i++) { e[i] = dist(i - j, i + j); en[i] = Math.max(0, e[i] - 1.5 * noise); } eRaw.push(e); eNet.push(en); }
const eRef = Math.max(pct(eNet[1], 0.9), 10 * noise);
// jump frames: a cut, a bump of the phone or a flash changes the whole picture at once: JUMP times more than the video's strong movement and JUMP times more than the second around it.
// Two such jumps some seconds apart would pass for one repeat, so a pair of frames that touches a jump can lose but never gain.
const jump = new Uint8Array(n); { const e1 = eRaw[1]; const R = Math.round(0.5 * FPS); const win = [];
  for (let i = 1; i + 1 < n; i++) { if (e1[i] < K.JUMP * eRef) continue; win.length = 0; for (let k = Math.max(1, i - R); k <= Math.min(n - 2, i + R); k++) win.push(e1[k]); if (e1[i] >= K.JUMP * median(win)) jump[i] = 1; } }
const nearJump = [null]; for (let j = 1; j <= K.JMAX; j++) { const m = new Uint8Array(n); for (let i = 0; i < n; i++) if (jump[i]) for (let k = Math.max(0, i - j + 1); k <= Math.min(n - 1, i + j - 1); k++) m[k] = 1; nearJump.push(m); } // exactly the frames whose change picture (k-j to k+j) reaches across the jump
lap('features');

// ---------- 3. repetition field and alignment paths ----------
const S = new Float32Array(n * NL).fill(NaN);
for (let L = LMIN; L <= LMAX; L++) { const j = jOf(L), en = eNet[j], nj = nearJump[j], li = L - LMIN; for (let i = j; i + L + j < n; i++) { const c = gg(i + j, i + L + j) - gg(i + j, i + L - j) - gg(i - j, i + L + j) + gg(i - j, i + L - j); const v = c - K.THETA * Math.sqrt(en[i] * en[i + L]); S[i * NL + li] = (nj[i] || nj[i + L]) && v > 0 ? 0 : v; } }
const A = new Float32Array(n * NL), B = new Float32Array(n * NL), bpA = new Uint8Array(n * NL), bpB = new Uint8Array(n * NL), PkA = new Float32Array(n * NL), PkB = new Float32Array(n * NL), TA = new Float32Array(n * NL), TB = new Float32Array(n * NL);
{ const lam = new Float64Array(NL); for (let li = 0; li < NL; li++) lam[li] = Math.exp(-1 / (K.KAPPA * (li + LMIN)));
  for (let i = 1; i < n; i++) { const o = i * NL, q = o - NL; for (let li = 0; li < NL; li++) { const s = S[o + li]; if (s !== s) continue; let a = 0, ba = 2, pk = 0, tt = 0; if (A[q + li] > a) { a = A[q + li]; ba = 0; pk = PkA[q + li]; tt = TA[q + li]; } if (B[q + li] > a) { a = B[q + li]; ba = 1; pk = PkB[q + li]; tt = TB[q + li]; }
      a = a * lam[li] + s; if (a > 0 && a >= K.RHO * pk) { A[o + li] = a; bpA[o + li] = ba; PkA[o + li] = Math.max(pk, a); TA[o + li] = tt + s; } else if (s > 0) { A[o + li] = s; bpA[o + li] = 2; PkA[o + li] = s; TA[o + li] = s; } else bpA[o + li] = 2;
      let b = 0, bb = 0; if (li > 0 && A[q + li - 1] > b) { b = A[q + li - 1]; bb = 3; pk = PkA[q + li - 1]; tt = TA[q + li - 1]; } if (li + 1 < NL && A[q + li + 1] > b) { b = A[q + li + 1]; bb = 4; pk = PkA[q + li + 1]; tt = TA[q + li + 1]; }
      if (bb) { b = b * lam[li] + s; if (b > 0 && b >= K.RHO * pk) { B[o + li] = b; bpB[o + li] = bb; PkB[o + li] = Math.max(pk, b); TB[o + li] = tt + s; } } } } }
const paths = []; { const minT = 1.0 * eRef; const idx = []; for (let c = NL; c < n * NL; c++) { const inB = B[c] > A[c]; const t = inB ? TB[c] : TA[c]; if (t >= minT && (inB ? B[c] : A[c]) > 0) idx.push(c); }
  const tOf = (c) => (B[c] > A[c] ? TB[c] : TA[c]); idx.sort((p, q) => tOf(q) - tOf(p)); const used = new Uint8Array(n * NL);
  for (const c0 of idx) { if (used[c0]) continue; let i = Math.floor(c0 / NL), li = c0 % NL, inB = B[c0] > A[c0]; const ct = [], cl = []; let clash = false;
    while (i > 0) { if (used[i * NL + li]) { clash = true; break; } ct.push(i); cl.push(li + LMIN); if (inB) { li += bpB[i * NL + li] === 3 ? -1 : 1; inB = false; i--; } else { const ba = bpA[i * NL + li]; if (ba === 2) break; inB = ba === 1; i--; } }
    if (clash) { for (let k = 0; k < ct.length; k++) used[ct[k] * NL + cl[k] - LMIN] = 1; continue; }
    for (let k = 0; k < ct.length; k++) for (let d = -3; d <= 3; d++) { const l2 = cl[k] - LMIN + d; if (l2 >= 0 && l2 < NL) used[ct[k] * NL + l2] = 1; }
    ct.reverse(); cl.reverse(); paths.push({ t: ct, l: cl }); if (paths.length >= 400) break; } }
const sAt = (p, k) => S[p.t[k] * NL + p.l[k] - LMIN];
const describe = (p) => { const m = p.t.length; const lags = Int32Array.from(p.l).sort(); const lag = lags[m >> 1]; let sc = 0, sm = 0, gain = 0, mov = 0; const movFloor = 0.1 * eRef;
  for (let k = 0; k < m; k++) { const i = p.t[k], L = p.l[k], j = jOf(L); const s = sAt(p, k); sc += s + K.THETA * Math.sqrt(eNet[j][i] * eNet[j][i + L]); sm += Math.sqrt(eRaw[j][i] * eRaw[j][i + L]); gain += s; if (s > 0 && eNet[j][i] >= movFloor) mov++; }
  return { t: p.t, l: p.l, t0: p.t[0], t1: p.t[m - 1], lag, lagLo: lags[Math.floor(m * 0.1)], lagHi: lags[Math.floor(m * 0.9)], end: Math.min(n - 1, p.t[m - 1] + p.l[m - 1]), gain, cos: sm > 0 ? Math.min(1, sc / sm) : 0, moving: mov }; };
// a path that gains nothing for a whole period is cut there (a rest of a period or more ends the bout); loose ends without gain are dropped
const cutPath = (p) => { const out = []; const m = p.t.length; const cum = new Float64Array(m + 1); for (let k = 0; k < m; k++) cum[k + 1] = cum[k] + sAt(p, k); let a = 0, k = 0;
  const close = (a2, b2) => { let b = b2; while (b > a2 && sAt(p, b) <= 0) b--; let a3 = a2; while (a3 < b && sAt(p, a3) <= 0) a3++; if (b - a3 >= 2) out.push({ t: p.t.slice(a3, b + 1), l: p.l.slice(a3, b + 1) }); };
  while (k < m) { let e = k; while (e < m && p.t[e] - p.t[k] < p.l[k]) e++; if (e < m && cum[e + 1] - cum[k + 1] <= 0 && k > a) { close(a, k); let c = e; while (c < m && sAt(p, c) <= 0) c++; a = c; k = c; continue; } k++; }
  if (a < m) close(a, m - 1); return out; };
const cands = paths.flatMap(cutPath).map(describe); lap('paths');

// ---------- 4. there-and-back chains: the picture leaves a posture and comes back to it, twice or more in a row ----------
const eSm = new Float64Array(n); for (let i = 0; i < n; i++) { let s = 0, c = 0; for (let k = Math.max(1, i - 2); k <= Math.min(n - 2, i + 2); k++) { s += eNet[1][k]; c++; } eSm[i] = c ? s / c : 0; }
const restOf = (a, b, c) => { const lv = []; for (let i = a; i <= c; i++) lv.push(eSm[i]); const move = pct(lv, 0.75); const at = (t) => { let mn = Infinity; for (let k = Math.max(0, t - 3); k <= Math.min(n - 1, t + 3); k++) mn = Math.min(mn, eSm[k]); return mn; }; return Math.max(at(a), at(b), at(c)) / Math.max(move, 1e-9); };
const chains = []; { const exc = []; const LX = Math.round(K.X_MINLAG * FPS); const q = new Float32Array(LMAX + 2), rg = new Float32Array(LMAX + 2); const ampMin = K.X_AMP * eRef; const byU = new Map();
  const XLMAX = Math.min(LMAX, Math.round(K.X_MAXLAG * FPS)); for (let u = 0; u < n; u++) { let range = 0; const top = Math.min(XLMAX, n - 1 - u); for (let L = 1; L <= top; L++) { const v = Math.max(0, dist(u, u + L) - noise); if (v > range) range = v; rg[L] = range; q[L] = v / Math.max(range, 1e-9); } q[top + 1] = 9;
    for (let L = LX; L <= top; L++) if (q[L] <= K.X_Q && rg[L] >= ampMin && q[L] <= q[L - 1] && q[L] <= q[L + 1]) { const e = { u, L, q: q[L], amp: rg[L] }; exc.push(e); if (!byU.has(u)) byU.set(u, []); byU.get(u).push(e); } }
  const pairs = []; for (const e1 of exc) for (let dd = -2; dd <= 2; dd++) for (const e2 of byU.get(e1.u + e1.L + dd) || []) { const r = e2.L / e1.L, ra = e2.amp / e1.amp; if (r < 0.5 || r > 2 || ra < 1 / 3 || ra > 3) continue; const q13 = Math.max(0, dist(e1.u, e2.u + e2.L) - noise) / Math.max(e1.amp, e2.amp); if (q13 > 2 * K.X_Q) continue; if (restOf(e1.u, e2.u, e2.u + e2.L) > K.X_REST) continue;
    pairs.push({ a: e1.u, b: e2.u, c: e2.u + e2.L, q: Math.max(e1.q, e2.q, q13 / 2), amp: Math.min(e1.amp, e2.amp), len: (e1.L + e2.L) / 2, count: 2, rest: restOf(e1.u, e2.u, e2.u + e2.L) }); }
  pairs.sort((p, r) => p.q - r.q); const kept = []; for (const c of pairs) { if (kept.some((k) => Math.min(k.c, c.c) - Math.max(k.a, c.a) > 0.5 * Math.min(k.c - k.a, c.c - c.a))) continue; kept.push(c); }
  kept.sort((p, r) => p.a - r.a); for (const c of kept) { const last = chains[chains.length - 1];
    if (last && c.a <= last.c + 0.25 * last.len && c.len / last.len < 2 && c.len / last.len > 0.5 && Math.max(0, dist(last.a, c.a) - noise) <= 2 * K.X_Q * Math.max(last.amp, c.amp)) { const span = Math.max(last.c, c.c) - last.a; last.c = Math.max(last.c, c.c); last.q = Math.max(last.q, c.q); last.count = Math.max(last.count + 1, Math.round(span / ((last.len + c.len) / 2))); last.len = span / last.count; }
    else chains.push({ ...c }); } }
lap('chains');

// how alike two stretches are: the mean distance from a frame of one to its nearest frame in the other, against the same thing inside each stretch (a frame against the frames at least half a period away, for frames that have a partner one period away)
const profile = (start, end, lag, pathOf) => { const len = end - start + 1; const step = Math.max(1, len / 36); const fr = []; for (let v = start; v <= end; v += step) fr.push(Math.round(v)); let has = null; if (pathOf) { has = new Uint8Array(len); for (let k = 0; k < pathOf.t.length; k++) { const a = pathOf.t[k] - start, b2 = pathOf.t[k] + pathOf.l[k] - start; if (a >= 0 && a < len && b2 >= 0 && b2 < len) { has[a] = 1; has[b2] = 1; } } }
  const half = lag / 2; let sm = 0, c = 0; for (const a of fr) { if (has && !has[a - start] && !has[Math.min(len - 1, a - start + 1)] && !has[Math.max(0, a - start - 1)]) continue; let mn = Infinity; for (const o of fr) if (Math.abs(o - a) >= half) { const v = dist(a, o); if (v < mn) mn = v; } if (mn < Infinity) { sm += mn; c++; } } return { fr, self: c ? sm / c : 0 }; };
const likeness = (p, q) => { const cross = (u, v) => { let sm = 0; for (const a of u.fr) { let mn = Infinity; for (const o of v.fr) { const d = dist(a, o); if (d < mn) mn = d; } sm += mn; } return sm / u.fr.length; }; return Math.max(cross(p, q), cross(q, p)) / Math.max(p.self, q.self, noise); };

// ---------- 5. choose the bouts ----------
const gate = (c) => c.gain >= K.MIN_GAIN * eRef && (c.t1 - c.t0) >= Math.max(K.MIN_DUR * c.lag, K.MIN_SECONDS * FPS) && c.cos >= K.MIN_COS;
let bouts = []; { const explainedBy = new Int16Array(n).fill(-1);
  const framesOf = (c) => { const m = new Uint8Array(n); for (let k = 0; k < c.t.length; k++) { m[c.t[k]] = 1; const e = c.t[k] + c.l[k]; if (e < n) m[e] = 1; } for (let i = c.t1; i <= Math.min(n - 1, c.t0 + c.l[0]); i++) m[i] = 1; return m; };
  for (const c of cands.filter(gate).sort((p, q) => p.lag - q.lag || q.gain - p.gain)) { const m = framesOf(c); let tot = 0, done = 0; const inside = new Map(); for (let i = 0; i < n; i++) if (m[i]) { tot++; if (explainedBy[i] >= 0) { done++; inside.set(explainedBy[i], (inside.get(explainedBy[i]) || 0) + 1); } }
    if (done >= K.EXPLAINED * tot) { for (const [bi, cnt] of inside) { const b = bouts[bi]; const r = c.lag / b.lag; if (r > 1.75 && r < 2.25 && cnt >= 0.6 * (b.end - b.t0) && c.cos >= b.cos + K.DOUBLE_COS && (!b.double || c.cos > b.double.cos)) b.double = { lag: c.lag, cos: c.cos }; } continue; }
    const bi = bouts.length; bouts.push({ ...c, how: 'repeat' }); for (let i = 0; i < n; i++) if (m[i] && explainedBy[i] < 0) explainedBy[i] = bi; } }
// 6. a bout is split where the posture changes for good: frame pairs one period apart that straddle the point are CHANGE times further apart than pairs before it and pairs after it
const splitAtChange = (b, depth = 0) => { const m = b.t.length; if (depth > 4 || m < 6) return [b]; const dv = new Float64Array(m); for (let k = 0; k < m; k++) dv[k] = dist(b.t[k], b.t[k] + b.l[k]); let best = null; const need = 0.5 * b.lag;
  for (let c = b.t0 + Math.round(b.lag); c <= b.t1; c++) { const bef = [], acr = [], aft = []; for (let k = 0; k < m; k++) { const i = b.t[k], e = i + b.l[k]; if (e < c) bef.push(dv[k]); else if (i >= c) aft.push(dv[k]); else acr.push(dv[k]); }
    if (bef.length < need || aft.length < need || acr.length < need) continue; const r = median(acr) / Math.max(median(bef), median(aft), noise); if (!best || r > best.r) best = { c, r }; }
  if (!best || best.r < K.CHANGE) return [b]; const p1 = { t: [], l: [] }, p2 = { t: [], l: [] }; for (let k = 0; k < m; k++) { const i = b.t[k], e = i + b.l[k]; if (e < best.c) { p1.t.push(i); p1.l.push(b.l[k]); } else if (i >= best.c) { p2.t.push(i); p2.l.push(b.l[k]); } }
  if (p1.t.length < 3 || p2.t.length < 3) return [b]; const d1 = { ...describe(p1), how: b.how, changeAfter: best.r }, d2 = { ...describe(p2), how: b.how, changeBefore: best.r }; d1.end = Math.min(d1.end, best.c - 1);
  const lk = likeness(profile(d1.t0, d1.end, d1.lag, d1), profile(d2.t0, d2.end, d2.lag, d2)); if (lk <= K.GROUP) { b.rhythmBreak = best.c; return [b]; } d1.changeLike = lk; return [...splitAtChange(d1, depth + 1), ...splitAtChange(d2, depth + 1)]; };
bouts = bouts.flatMap((b) => splitAtChange(b)).map((b) => ({ ...b, start: b.t0, endF: b.end, lagF: b.double ? b.double.lag : b.lag })).sort((p, q) => p.start - q.start);
for (let k = 1; k < bouts.length; k++) if (bouts[k].start <= bouts[k - 1].endF) { const mid = Math.round((bouts[k].start + bouts[k - 1].endF) / 2); bouts[k - 1].endF = mid - 1; bouts[k].start = mid; }
bouts = bouts.filter((b) => b.endF - b.start >= 1.2 * b.lag);
// 6b. a bout is carried on at both ends, a period at a time, while the frames there still match its own reps. The paths of 3 lose a rep whose tempo differs (a slow first rep,
//     a longer pause at the top): the lag would have to change faster than a path may, and a path forgets. So from the bout's first (last) pair of frames the alignment is
//     walked on through the same field S, one period further, the lag free to change by a frame a frame within EXT_LAG of the bout's own. Where the gain it collects is highest
//     the piece ends: at the end of the period (then the next period is tried) or before it (the frames stop matching: the piece is taken up to there and the walk stops).
//     A piece counts only if it passes the gate a bout passes on its own: MIN_GAIN x eRef of gain, a mean match of MIN_COS, MIN_SECONDS long. A rest, set-up or another movement
//     earns nothing in S, so it is not pulled in; nor is anything that belongs to the next bout.
const extendBout = (b, dir, limit) => { const liLo = Math.max(0, Math.round(b.lag / K.EXT_LAG) - LMIN), liHi = Math.min(NL - 1, Math.round(b.lag * K.EXT_LAG) - LMIN); const got = { t: [], l: [] }; const tried = [];
  let ia = dir < 0 ? b.t[0] : b.t[b.t.length - 1], la = dir < 0 ? b.l[0] : b.l[b.l.length - 1]; const NW = liHi - liLo + 1; if (NW < 1 || la - LMIN < liLo || la - LMIN > liHi) return null;
  for (let round = 0; round < 50; round++) { const len = la; const V = new Float64Array((len + 1) * NW).fill(-Infinity), from = new Int8Array((len + 1) * NW); V[la - LMIN - liLo] = 0; let rows = 0;
    for (let s = 1; s <= len; s++) { const i = ia + dir * s; if (i < 1 || i >= n || (dir < 0 && i < limit)) break; let any = false;
      for (let w = 0; w < NW; w++) { const li = w + liLo, L = li + LMIN; const sv = S[i * NL + li]; if (sv !== sv || (dir > 0 && i + L > limit)) continue; let bv = -Infinity, bd = 0; for (let d = -1; d <= 1; d++) { const pw = w + d; if (pw < 0 || pw >= NW) continue; const pv = V[(s - 1) * NW + pw]; if (pv > bv) { bv = pv; bd = d; } }
        if (bv === -Infinity) continue; V[s * NW + w] = bv + sv; from[s * NW + w] = bd; any = true; }
      if (!any) break; rows = s; }
    if (rows < 1) break; let bs = 0, bw = -1, top = 0; for (let s = 1; s <= rows; s++) for (let w = 0; w < NW; w++) { const v = V[s * NW + w]; if (v > top || (v === top && bw >= 0 && s > bs && v > 0)) { top = v; bs = s; bw = w; } }
    if (bw < 0) { tried.push({ rows, len, gain: 0, cos: 0, ok: false }); break; }
    const pt = [], pl = []; for (let s = bs, w = bw; s >= 1; s--) { pt.push(ia + dir * s); pl.push(w + liLo + LMIN); w += from[s * NW + w]; } // from the far end back to the bout
    let sc = 0, sm = 0; for (let k = 0; k < pt.length; k++) { const i = pt[k], L = pl[k], j = jOf(L); sc += S[i * NL + L - LMIN] + K.THETA * Math.sqrt(eNet[j][i] * eNet[j][i + L]); sm += Math.sqrt(eRaw[j][i] * eRaw[j][i + L]); } const cos = sm > 0 ? Math.min(1, sc / sm) : 0;
    const ok = top >= K.MIN_GAIN * eRef && cos >= K.MIN_COS && bs >= K.MIN_SECONDS * FPS; tried.push({ rows, len, took: bs, gain: top, cos, ok }); if (!ok) break;
    if (dir < 0) { got.t.unshift(...pt); got.l.unshift(...pl); } else { got.t.push(...pt.reverse()); got.l.push(...pl.reverse()); } ia = ia + dir * bs; la = pl[dir < 0 ? 0 : pl.length - 1]; if (bs < len) break; }
  b.extTried = (b.extTried || []).concat(tried.map((t) => ({ dir, ...t }))); return got.t.length ? got : null; };
// 6c. the same by posture, for the part of a rep the field cannot vouch for: a first movement done at another speed than in the later reps (a quick first leg raise), whose change
//     pictures do not agree although the body goes through the same postures. The frames outside the bout are laid on the rep next to them, frame for frame outwards from the
//     bout's end, each step taking one or two frames of either (so the tempo may be half to double, and a rest cannot be laid on a moving rep). A frame fits when it is no further
//     from the rep's frame than the bout's own reps are from each other (the 90th percentile along its path). Taken only when the stretch that fits is MIN_SECONDS long and the
//     two move together by MIN_GAIN x eRef: standing still in the starting posture, a rest or set-up does not qualify. At most one period at each end.
const poseWalk = (b, dir, limit) => { const m = b.t.length; if (dir < 0 ? b.start !== b.t[0] : b.endF !== b.t[m - 1] + b.l[m - 1]) return 0; const dv = []; for (let k = 0; k < m; k++) dv.push(dist(b.t[k], b.t[k] + b.l[k])); const thr = Math.max(pct(dv, 0.9), 4 * noise);
  const w0 = dir < 0 ? b.t[0] : b.t[m - 1] + b.l[m - 1], q0 = dir < 0 ? b.t[0] + b.l[0] : b.t[m - 1], C = dir < 0 ? b.l[0] : b.l[m - 1]; const A = Math.min(Math.round(K.EXT_LAG * C), dir < 0 ? w0 - Math.max(limit, 1) : Math.min(limit, n - 2) - w0); if (A < K.MIN_SECONDS * FPS) return 0;
  const R = new Float32Array((A + 1) * (C + 1)).fill(-1); R[0] = 0; const E = eNet[1]; let bestA = 0, bestC = 0; // R = the movement shared along the best way to this pair of frames, -1 where no way leads
  for (let a = 1; a <= A; a++) for (let c = 1; c <= C; c++) { let pv = -1; for (const [da, dc] of [[1, 1], [1, 2], [2, 1]]) { if (a - da < 0 || c - dc < 0) continue; const v = R[(a - da) * (C + 1) + c - dc]; if (v > pv) pv = v; } if (pv < 0) continue; const w = w0 + dir * a, q = q0 + dir * c; if (dist(w, q) > thr) continue;
    const v = pv + Math.sqrt(E[w] * E[q]); R[a * (C + 1) + c] = v; if (a > bestA || (a === bestA && v > R[bestA * (C + 1) + bestC])) { bestA = a; bestC = c; } }
  const moved = bestA ? R[bestA * (C + 1) + bestC] : 0; const ok = bestA >= K.MIN_SECONDS * FPS && moved >= K.MIN_GAIN * eRef; (b.extTried = b.extTried || []).push({ dir, pose: true, rows: A, len: C, took: bestA, gain: moved, cos: 0, ok }); return ok ? bestA : 0; };
if (K.EXTEND) for (let k = 0; k < bouts.length; k++) { const b = bouts[k]; if (b.how !== 'repeat' || !b.t) continue; const s0 = b.start, e0 = b.endF; const lo = k > 0 ? bouts[k - 1].endF + 1 : 0, hi = k + 1 < bouts.length ? bouts[k + 1].start - 1 : n - 1;
  const back = extendBout(b, -1, lo); const fwd = extendBout(b, 1, hi);
  if (back || fwd) { const p = { t: [...(back ? back.t : []), ...b.t, ...(fwd ? fwd.t : [])], l: [...(back ? back.l : []), ...b.l, ...(fwd ? fwd.l : [])] }; const d = describe(p); Object.assign(b, d, { start: Math.min(s0, d.t0), endF: Math.max(e0, d.end), lagF: b.double ? b.double.lag : d.lag }); }
  if (K.EXT_POSE) { b.start -= poseWalk(b, -1, lo); b.endF += poseWalk(b, 1, hi); }
  if (b.start < s0 || b.endF > e0) b.before = [s0, e0]; }
// 7. chains where no repeat was found
for (const c of chains) { let cov = 0; for (const b of bouts) cov += Math.max(0, Math.min(b.endF, c.c) - Math.max(b.start, c.a)); if (cov > 0.3 * (c.c - c.a)) continue; let s = c.a, e = c.c; for (const b of bouts) { if (b.how === 'chain') continue; if (b.endF >= s && b.endF < e && b.start <= s) s = b.endF + 1; if (b.start <= e && b.start > s && b.endF >= e) e = b.start - 1; }
  if (e - s < 0.7 * (c.c - c.a)) continue; bouts.push({ how: 'chain', start: s, endF: e, lag: Math.round(c.len), lagF: Math.round(c.len), q: c.q, count: c.count, cos: 0, t: null }); }
bouts.sort((p, q) => p.start - q.start); lap('bouts');

// ---------- 8. trim each bout to whole reps: the longest stretch whose first and last frames show the same posture ----------
for (const b of bouts) { const P = b.lagF, s0 = b.start, e0 = b.endF; const half = Math.max(1, Math.round(P / 2)); const amps = []; for (let i = s0; i + half <= e0; i++) amps.push(dist(i, i + half)); const amp = Math.max(pct(amps, 0.75), 4 * noise); b.amp = amp;
  const span = Math.min(Math.round(0.9 * P), Math.floor((e0 - s0) / 3)); if (span < 1) { b.trim = [0, 0]; continue; } const cache = new Map(); const d1 = (i, k) => { if (i < 0 || k >= n) return null; const key = i * n + k; let v = cache.get(key); if (v === undefined) { v = dist(i, k); cache.set(key, v); } return v; };
  let best = null; for (let s = s0; s <= s0 + span; s++) for (let e = e0 - span; e <= e0; e++) { if (e - s < Math.max(K.SNAP_KEEP * P, 0.5 * (e0 - s0))) continue; let sum = 0, c = 0; for (let k = -1; k <= 1; k++) { const v = d1(s + k, e + k); if (v != null) { sum += v; c++; } }
    const ts = s - s0, te = e0 - e; const cost = sum / c / amp + K.SNAP_TRIM * (ts + te) / P + K.SNAP_BALANCE * Math.abs(ts - te) / P; if (!best || cost < best.cost) best = { s, e, cost, seam: sum / c / amp }; }
  if (best) { b.trim = [best.s - s0, e0 - best.e]; b.seam = best.seam; b.start = best.s; b.endF = best.e; } else b.trim = null; }

// ---------- 9. groups: two bouts are the same movement when each one's frames are found in the other about as well as in its own other reps ----------
{ let next = 0; for (let i = 0; i < bouts.length; i++) { const b = bouts[i]; b.prof = profile(b.start, b.endF, b.lagF, b.t ? b : null); b.self = b.prof.self; b.group = 0; let bestJ = -1, bestR = Infinity;
    for (let j = 0; j < i; j++) { const o = bouts[j]; const pr = b.lagF / o.lagF; if (pr > K.GROUP_PERIOD || pr < 1 / K.GROUP_PERIOD) continue; const r = likeness(b.prof, o.prof); if (r < bestR) { bestR = r; bestJ = j; } }
    if (bestJ >= 0 && bestR <= K.GROUP) { b.group = bouts[bestJ].group; b.like = bestR; } else { b.group = ++next; b.like = bestJ >= 0 ? bestR : null; } } }
// 9b. a bout that carries on the rhythm of the bout just before it (no more than a period between them, about the same period) is its other side, a variant of it, or the same exercise after a shift of the body
for (let k = 1; k < bouts.length; k++) { const b = bouts[k], o = bouts[k - 1]; const gap = b.start - o.endF - 1, pr = b.lagF / o.lagF; if (b.group === o.group || gap > Math.max(b.lagF, o.lagF) || pr > K.SAME_RHYTHM || pr < 1 / K.SAME_RHYTHM) continue;
  const lk = likeness(b.prof, o.prof); b.carries = { on: o, like: lk, gap: Math.max(0, gap), close: lk <= K.VARIANT * K.GROUP }; }
lap('groups');

// ---------- 10. crop: where the athlete is during a bout ----------
// a. energy map: each proxy pixel's mean squared change over two frames during the bout (frames where the whole picture jumps are left out).
//    Rhythm map: the same change multiplied by the pixel's change one period later, averaged: high only where the picture changes in the bout's own rhythm.
// b. strong pixels: CROP_STRONG of the rhythm map's 99.5th percentile or more: the limbs that do the exercise. A passer-by, a screen or the sway of the camera
//    moves a lot but not in rhythm, so it cannot start a region. (A there-and-back chain has no measured period: its strong pixels come from the energy map.)
//    Stirring pixels: energy of CROP_WEAK times that pixel's own noise or more: body parts that hold still still breathe and balance.
// c. core: strong pixels and places where CROP_FILL of the 5x5 neighbourhood stirs; of its connected regions those that hold strong pixels and carry
//    CROP_PART of the largest one's energy are kept. If their box is CROP_GROW times the box of the strong pixels alone it has flooded (a busy background,
//    a shaking camera): the share asked for is raised half way and then three quarters of the way to 1, and if it still floods only the strong pixels count.
// d. still parts: a core that did not flood is grown once more through places where only CROP_FILL2 of a neighbourhood of CROP_R2 of the long side stirs
//    (legs under a seated press, planted hands and feet). Kept unless that grows the box to more than CROP_GROW2 times its area.
// e. the box is moved back from the steadied picture to the real one, scaled to source pixels and padded by CROP_PAD on every side.
// What it cannot see: a body part that is perfectly still and looks like nothing happens there, and a reflection of the athlete in a shiny floor (it moves in rhythm too).
const cropOf = (bt) => { const a = bt.start, b = bt.endF;
  const lo = Math.max(3, a + 2), hi2 = Math.min(n - 2, b); /* a change is measured over two frames: both inside the bout */ const ge = []; for (let i = lo; i <= hi2; i++) ge.push(eRaw[1][Math.min(n - 2, i - 1)]);
  const cap = K.CROP_SKIP * pct(ge, 0.9); const use = []; for (let i = lo; i <= hi2; i++) if (ge[i - lo] <= cap) use.push(i);
  const cnt = use.length; if (cnt < 4) return { box: [SRCW, SRCH, 0, 0], how: 'no frames', unsure: true };
  // The bout's frames at one exposure (made once, when asked for): each frame is fitted to the bout's mean picture (frame = gain x mean + offset) and the fit is taken out, as athleteBox in _lib.mjs does.
  // flicker = how far that fit moves between frames two apart, in gray levels at mid-gray, the median over the bout (the clean raw clips: 0.1-1.6, the athlete's own movement shifts the fit a little).
  const f0 = lo - 3, nf = hi2 + 2 - f0; let evened = null; const even = () => { if (evened) return evened; const src = new Float32Array(nf * WH), R = -f0 * WH, ref = new Float64Array(WH), lev = new Float64Array(nf); for (let i = f0; i < f0 + nf; i++) { const o = i * WH; for (let p = 0; p < WH; p++) ref[p] += raw[o + p]; }
    let sx = 0, sxx = 0; for (let p = 0; p < WH; p++) { ref[p] /= nf; sx += ref[p]; sxx += ref[p] * ref[p]; } const den = WH * sxx - sx * sx;
    for (let i = f0; i < f0 + nf; i++) { const o = i * WH, q = R + o; let sy = 0, sxy = 0; for (let p = 0; p < WH; p++) { const v = raw[o + p]; sy += v; sxy += v * ref[p]; } let ga = den > 1e-6 ? (WH * sxy - sx * sy) / den : 1; if (!(ga > 0.5 && ga < 2)) ga = 1; const gb = (sy - ga * sx) / WH; lev[i - f0] = gb + 128 * ga; for (let p = 0; p < WH; p++) src[q + p] = (raw[o + p] - gb) / ga; }
    const dl = []; for (let k = 2; k < nf; k++) dl.push(Math.abs(lev[k] - lev[k - 2])); return (evened = { src, R, flicker: median(dl) }); };
  // One look at the bout. expo: on the evened frames instead of the frames as they are. perRep: the energy map rep by rep (2 to 8 stretches of one period; a bout under two reps is taken whole), each pixel getting
  // the lower median, so what stirs in every rep counts (a still limb breathes and balances in each) and what crosses the picture once does not (a passer-by, a flash, a bump of the phone).
  // The first look is plain, unless the light flickers all through the bout (flicker of CROP_FLICKER or more: then every pixel's own noise is high and the still parts of the body drop out). If the look floods at
  // every strictness (the whole picture stirs: a step of the auto-exposure, somebody passing), a second look is taken with both on. They are not on from the start because on clean footage they box a little tighter
  // (verify/cropbench: 15 of 37 boxes tighter than the hand box against 12).
  const attempt = (expo, perRep) => { let src = raw, R = 0; /* src[R + i * WH + p] is pixel p of frame i */ if (expo) ({ src, R } = even());
  const reps0 = (hi2 - lo + 1) / Math.max(1, bt.lagF), nCh = perRep && reps0 >= 2 ? Math.min(8, Math.floor(reps0)) : 1; const chM = new Float32Array(nCh * WH), chN = new Int32Array(nCh);
  for (let k = 0; k < cnt; k++) { const i = use[k], c = Math.min(nCh - 1, Math.floor(k * nCh / cnt)), co = c * WH; chN[c]++; const o = R + i * WH, q = o - 2 * WH; for (let p = 0; p < WH; p++) { const d = src[o + p] - src[q + p]; chM[co + p] += d * d; } }
  const m = new Float32Array(WH); { const col = new Float32Array(nCh), mid = (nCh - 1) >> 1; for (let p = 0; p < WH; p++) { for (let c = 0; c < nCh; c++) col[c] = chM[c * WH + p] / Math.max(1, chN[c]); col.sort(); m[p] = col[mid]; } }
  // each pixel's own noise during the bout: the median of its squared change (a body part that holds still changes now and then, so its mean is well above this)
  const nzPx = new Float32Array(WH); { const step = Math.max(1, cnt / 90); const pick = []; for (let v = 0; v < cnt; v += step) pick.push(use[Math.floor(v)]); const col = new Float32Array(pick.length);
    for (let p = 0; p < WH; p++) { for (let k = 0; k < pick.length; k++) { const d = src[R + pick[k] * WH + p] - src[R + (pick[k] - 2) * WH + p]; col[k] = d * d; } col.sort(); nzPx[p] = col[pick.length >> 1] / 0.455; }
    const fl = Math.max(0.3, median(nzPx)); for (let p = 0; p < WH; p++) if (nzPx[p] < fl) nzPx[p] = fl; }
  // in rhythm: does a pixel change the way it changed one period earlier? (a passer-by, a flickering screen and the shake of the camera do not)
  const ok = new Uint8Array(n); for (const i of use) ok[i] = 1; const pairs = [];
  if (bt.t && !bt.double) for (let k = 0; k < bt.t.length; k++) { const i = bt.t[k], j = i + bt.l[k]; if (i >= lo && j <= hi2 && ok[i] && ok[j]) pairs.push(i, j); }
  if (pairs.length < 2 * FPS && bt.t) { pairs.length = 0; for (let i = lo; i + bt.lagF <= hi2; i++) if (ok[i] && ok[i + bt.lagF]) pairs.push(i, i + bt.lagF); } // a there-and-back chain has no measured period: no rhythm test for it
  const np = pairs.length / 2; const rhythm = np >= FPS && K.CROP_RHYTHM > 0; const en = rhythm ? new Float32Array(WH) : m; const rho = new Float32Array(WH);
  if (rhythm) { const sxx = new Float32Array(WH), syy = new Float32Array(WH);
    for (let k = 0; k < pairs.length; k += 2) { const o = R + pairs[k] * WH, q = R + pairs[k + 1] * WH; for (let p = 0; p < WH; p++) { const d = src[o + p] - src[o - 2 * WH + p], e = src[q + WH + p] + src[q + p] - src[q - 2 * WH + p] - src[q - 3 * WH + p]; en[p] += d * e; sxx[p] += d * d; syy[p] += e * e; } }
    for (let p = 0; p < WH; p++) { rho[p] = en[p] / Math.sqrt(sxx[p] * syy[p] + 1e-6); en[p] = Math.max(0, en[p]) / (3 * np); } }
  const hi = pct(en, 0.995); const strong = new Uint8Array(WH), weak = new Uint8Array(WH), stir = new Uint8Array(WH); for (let p = 0; p < WH; p++) { if (en[p] >= K.CROP_STRONG * hi && hi > 0) strong[p] = 1; if (m[p] >= K.CROP_WEAK * nzPx[p]) { weak[p] = 1; if (rhythm && rho[p] < K.CROP_RHO) stir[p] = 1; } }
  // share of stirring pixels in the square of radius R around each pixel (clipped to the picture), from a summed-area table
  const sat = new Int32Array((W + 1) * (H + 1)); for (let y = 0; y < H; y++) { let row = 0; for (let xx = 0; xx < W; xx++) { row += weak[y * W + xx]; sat[(y + 1) * (W + 1) + xx + 1] = sat[y * (W + 1) + xx + 1] + row; } }
  const share = (xx, y, R) => { const x0 = Math.max(0, xx - R), x1 = Math.min(W - 1, xx + R), y0 = Math.max(0, y - R), y1 = Math.min(H - 1, y + R); return (sat[(y1 + 1) * (W + 1) + x1 + 1] - sat[y0 * (W + 1) + x1 + 1] - sat[(y1 + 1) * (W + 1) + x0] + sat[y0 * (W + 1) + x0]) / ((x1 - x0 + 1) * (y1 - y0 + 1)); };
  const boxOf = (mask, also) => { let x0 = W, x1 = -1, y0 = H, y1 = -1; for (let p = 0; p < WH; p++) if (mask[p] && (!also || also[p])) { const y = Math.floor(p / W), xx = p - y * W; if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (y < y0) y0 = y; if (y > y1) y1 = y; } return [x0, y0, x1, y1]; };
  const area = (bx) => Math.max(0, bx[2] - bx[0] + 1) * Math.max(0, bx[3] - bx[1] + 1);
  // the core at one strictness: strong pixels and places where a share 'fill' of the 5x5 neighbourhood stirs, as connected regions; kept are those with strong pixels that carry CROP_PART of the largest one's energy
  const coreAt = (fill) => { const reg = new Uint8Array(WH); for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) if (strong[y * W + xx] || share(xx, y, 2) >= fill) reg[y * W + xx] = 1;
    const lab = new Int32Array(WH).fill(-1); const comps = []; const stack = [];
    for (let p0 = 0; p0 < WH; p0++) { if (lab[p0] >= 0 || !reg[p0]) continue; const id = comps.length; const c = { id, mass: 0, strong: 0 }; stack.push(p0); lab[p0] = id;
      while (stack.length) { const p = stack.pop(); const y = Math.floor(p / W), xx = p - y * W; c.mass += en[p]; c.strong += strong[p];
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const yy = y + dy, x2 = xx + dx; if (yy < 0 || yy >= H || x2 < 0 || x2 >= W) continue; const q = yy * W + x2; if (lab[q] < 0 && reg[q]) { lab[q] = id; stack.push(q); } } } comps.push(c); }
    const good = comps.filter((c) => c.strong > 0).sort((p, q) => q.mass - p.mass); if (!good.length) return null; const keep = new Uint8Array(comps.length); for (const c of good) if (c.mass >= K.CROP_PART * good[0].mass) keep[c.id] = 1;
    const core = new Uint8Array(WH); for (let p = 0; p < WH; p++) if (lab[p] >= 0 && keep[lab[p]]) core[p] = 1; return { core, box: boxOf(core), strongBox: boxOf(core, strong) }; };
  // the loosest core whose box is not CROP_GROW times the box of its strong pixels (a busy background or a shaking camera floods it): the share asked for is raised step by step, and if every step floods only the strong pixels count
  let got = null, flooded = 0; for (const fill of [K.CROP_FILL, (1 + K.CROP_FILL) / 2, (3 + K.CROP_FILL) / 4]) { const c = coreAt(fill); if (!c) return { none: true }; got = c; if (area(c.box) <= K.CROP_GROW * area(c.strongBox)) break; flooded++; got = { ...c, core: null }; }
  const strongBox = got.strongBox; let core = got.core, coreBox = got.box, bx, how, still = null;
  let unsure = false; if (!core) { core = new Uint8Array(WH); bx = coreBox = strongBox; unsure = true; how = 'the strongly moving parts only (the rest of the picture stirs too much to tell the body from it)'; }
  else { bx = coreBox; how = flooded ? 'the moving parts and what is tightly joined to them (the picture around them stirs a lot)' : 'the moving parts and what is joined to them';
    if (!flooded) { const R2 = Math.max(3, Math.round(K.CROP_R2 * Math.max(W, H))); still = Uint8Array.from(core); const st2 = []; for (let p = 0; p < WH; p++) if (core[p]) st2.push(p);
      while (st2.length) { const p = st2.pop(); const y = Math.floor(p / W), xx = p - y * W; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const yy = y + dy, x2 = xx + dx; if (yy < 0 || yy >= H || x2 < 0 || x2 >= W) continue; const q = yy * W + x2; if (!still[q] && share(x2, yy, R2) >= K.CROP_FILL2) { still[q] = 1; st2.push(q); } } }
      const stillBox = boxOf(still); if (area(stillBox) <= K.CROP_GROW2 * area(coreBox)) { if (area(stillBox) > area(coreBox)) how = 'the moving parts, what is joined to them and the still parts next to them that stir'; bx = stillBox; } else still = null; } }
  return { bx, how, unsure, strong, weak, stir, core, still, rhythm, strongBox, coreBox }; };
  const flickers = even().flicker >= K.CROP_FLICKER; let at = attempt(flickers, false); if (at.none) return { box: [SRCW, SRCH, 0, 0], how: 'no clear movement', unsure: true }; if (flickers) at.how += '; the light flickers, so the exposure was evened out first';
  if (at.unsure) { const again = attempt(true, true); if (!again.none && !again.unsure) { at = again; at.how += '; measured a second time with the exposure evened out and rep by rep, because the plain picture stirs all over (the auto-exposure, somebody passing)'; } }
  const { bx, how, unsure, strong, weak, stir, core, still, rhythm, strongBox, coreBox } = at;
  let [x0, y0, x1, y1] = bx; const proxyBox = [x0, y0, x1, y1];
  const [ox, oy, rx, ry] = camOf(a, b); x0 += ox - rx; x1 += ox + rx; y0 += oy - ry; y1 += oy + ry; // back from the steadied picture to the real one, widened by how far the camera wandered during the bout
  const sx = SRCW / W, sy = SRCH / H; let cx0 = Math.max(0, x0) * sx, cx1 = Math.min(W, x1 + 1) * sx, cy0 = Math.max(0, y0) * sy, cy1 = Math.min(H, y1 + 1) * sy; const px = K.CROP_PAD * (cx1 - cx0), py = K.CROP_PAD * (cy1 - cy0); cx0 = Math.max(0, cx0 - px); cx1 = Math.min(SRCW, cx1 + px); cy0 = Math.max(0, cy0 - py); cy1 = Math.min(SRCH, cy1 + py);
  return { box: [Math.round(cx1 - cx0), Math.round(cy1 - cy0), Math.round(cx0), Math.round(cy0)], how, unsure, flickers, proxyBox, maps: dbgDir ? { strong, weak, stir, core, still, rhythm, proxyBox, strongBox, coreBox, mid: Math.round((a + b) / 2) } : null }; };

// ---------- 10b. somebody else? blocks that change as much as the video's strong movement, in clumps, away from the athlete's box ----------
// "Large": the clumps hold OTHER_AREA of the picture and CROP_PART of the blocks the athlete himself moves (the 75th percentile over the bout), so a ceiling fan or a small screen does not count.
const otherShare = (a, b, bx) => { const padB = Math.max(2, Math.round(0.08 * Math.max(fw, fh))); const x0 = Math.floor(bx[0] / BLK) - padB, y0 = Math.floor(bx[1] / BLK) - padB, x1 = Math.floor(bx[2] / BLK) + padB, y1 = Math.floor(bx[3] / BLK) + padB; const mv = new Uint8Array(F); const outs = [], ins = [];
  for (let i = Math.max(1, a); i <= Math.min(n - 2, b); i++) { const p0 = (i - 1) * F, p1 = (i + 1) * F; let any = 0, inside = 0; for (let y = 0; y < fh; y++) for (let xx = 0; xx < fw; xx++) { const p = y * fw + xx; const d = X[p1 + p] - X[p0 + p]; const m = d * d >= eRef ? 1 : 0; if (xx >= x0 && xx <= x1 && y >= y0 && y <= y1) { mv[p] = 0; inside += m; } else { mv[p] = m; any += m; } }
    let clump = 0; if (any >= 4) for (let y = 1; y < fh - 1; y++) for (let xx = 1; xx < fw - 1; xx++) { const p = y * fw + xx; if (!mv[p]) continue; let nb = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) nb += mv[p + dy * fw + dx]; if (nb >= 4) clump++; } outs.push(clump); ins.push(inside); }
  if (!outs.length) return { share: 0 }; const body = pct(ins, 0.75); const need = Math.max(4, K.OTHER_AREA * F, K.CROP_PART * body); let flagged = 0; for (const c of outs) if (c >= need) flagged++;
  return { share: flagged / outs.length, body, need, out: pct(outs.filter((c) => c > 0), 0.5), outShare: outs.filter((c) => c >= Math.max(4, K.OTHER_AREA * F)).length / outs.length }; };

// ---------- output ----------
const segs = []; let cur = 0; // Junk says what was measured in it. A plank, a hang or a wall sit repeats nothing, so the splitter cannot tell it from a rest: where the picture holds still for HOLD_SECONDS or more the stretch says so and gives the span in "still".
// It also says when the camera was moving (repeats are hard to see then) and when the end of the file could not be decoded.
const stillOf = (s, e) => { const a = Math.max(0, Math.round(s * FPS)), b = Math.min(n - 1, Math.round(e * FPS) - 1); let run = 0, best = 0, at = a; for (let i = a; i <= b; i++) { if (eSm[i] < K.STILL * eRef) { run++; if (run > best) { best = run; at = i - run + 1; } } else run = 0; } return best >= K.HOLD_SECONDS * FPS ? [r3(Math.max(s, sec(at))), r3(Math.min(e, sec(at + best)))] : null; };
const junk = (s, e) => { const st = stillOf(s, e); let why = 'no repeating movement'; if (st) why += `, but the picture holds still for ${(st[1] - st[0]).toFixed(1)} s (${st[0].toFixed(1)}-${st[1].toFixed(1)} s): a rest, or a HOLD exercise (plank, hang, wall sit) - look before dropping it`;
  if (handHeld && e - s >= 3) why += '; the camera was moving (hand-held), which can hide a repeated movement'; if (n / FPS < duration - 1 && e > n / FPS + 0.5) why += `; the file could not be decoded after ${(n / FPS).toFixed(1)} s (damaged or cut off)`;
  const moved = e - s >= 3 && !light.blind && !light.bands && camMoved(Math.round(s * FPS), Math.round(e * FPS) - 1, null); if (moved && !handHeld) why += '; the camera moved here, which can hide a repeated movement'; if (light.bands) why += '; bands of flickering light were taken out of the picture first'; if (light.blind) why += '; very dark: a repeated movement could not be told from the noise here';
  const cutOff = n / FPS < duration - 1 && e > n / FPS + 0.5; const say = st ? `The picture holds still for ${(st[1] - st[0]).toFixed(0)} s: a rest, or a hold exercise` : light.blind ? 'Too dark to tell whether a movement repeats here' : cutOff ? `The file could not be read after ${(n / FPS).toFixed(0)} s` : 'No repeating movement';
  const warn = []; if ((moved || handHeld) && e - s >= 3 && !light.blind && !light.bands) warn.push('The camera moved'); if (light.dark) warn.push('Very dark'); if (light.bands) warn.push('Flickering light');
  return { start: r3(s), end: r3(e), kind: 'junk', group: 0, period: null, reps: null, crop: [SRCW, SRCH, 0, 0], score: 0, ...(st ? { still: st } : {}), hold: st, warn, say, why }; };
for (const b of bouts) { const s = Math.max(cur, sec(b.start)), e = Math.min(duration, sec(b.endF + 1)); if (e - s < 0.3) continue; if (s > cur + 1e-6) segs.push(junk(cur, s)); const period = sec(b.lagF); const reps = Math.round((e - s) / period * 10) / 10;
  // score: a repeat starts at 0.3, gains up to 0.4 for how well its reps agree and up to 0.3 for holding 3.5 reps or more. A chain never passes 0.5, and only a third of that per there-and-back
  // (two of them can be any gesture made twice, or a screen that flickers): under 0.5 means a person should look before anything is paid for.
  const score = b.how === 'chain' ? Math.max(0.2, Math.min(0.5, 0.5 - b.q)) * Math.min(1, b.count / 3) : Math.max(0.3, Math.min(1, 0.3 + 0.4 * Math.min(1, (b.cos - K.MIN_COS) / 0.35) + 0.3 * Math.min(1, (reps - 1.5) / 2)));
  const why = b.how === 'chain' ? `leaves a rest posture and comes back to it ${b.count} times, about ${period.toFixed(1)} s each (no matching movement found, low confidence)` : `the movement repeats every ${period.toFixed(2)} s (${reps} reps, match ${b.cos.toFixed(2)}${b.double ? ', sides alternate' : ''})`;
  const on = b.carries && b.carries.on.segIdx != null ? b.carries : null; const more = !on ? '' : on.close ? '; carries on the rhythm of #' + on.on.segIdx + ' in a slightly different posture (' + on.like.toFixed(1) + ' x the spread of its own reps): the same exercise after a shift, or a close variant, so it scores lower' : '; takes up the rhythm of #' + on.on.segIdx + ' ' + sec(on.gap).toFixed(1) + ' s after it in another posture: perhaps the other side of the same exercise';
  // cropHow says what the box was built from; cropUnsure marks the fallbacks (the moving limbs alone, or the whole picture): a still part of the body (legs under a press, hands on a bar) may be outside such a box
  const cr = (b.crop = cropOf(b)); const bare = !!cr.unsure; const early = b.before ? sec(b.before[0] - b.start) : 0, late = b.before ? sec(b.endF - b.before[1]) : 0; // 6b/6c, after the trim to whole reps
  const carried = early >= 0.3 || late >= 0.3 ? `; carried on ${[early >= 0.3 ? early.toFixed(1) + ' s before' : '', late >= 0.3 ? late.toFixed(1) + ' s after' : ''].filter(Boolean).join(' and ')} the stretch its rhythm was found in: the frames there match its reps` : '';
  // warnings: in footage too dark to trust, and where bands were taken out, the camera's path and the exposure measure are themselves noise, so only what is known is said
  const final = r3(on && on.close ? score * K.UNSURE : score);
  // footage too dark to trust (DARK_BLIND): a find that scores under 0.5 is not reported as an exercise. It is kept as its own junk stretch that says what was seen, so a person can look instead of the stretch being lost without a word.
  if (light.blind && final < 0.5) { segs.push({ start: r3(s), end: r3(e), kind: 'junk', group: 0, period: null, reps: null, crop: [SRCW, SRCH, 0, 0], score: 0, hold: null, warn: ['Very dark'], say: `Too dark to trust: something may repeat here every ${period.toFixed(1)} s, look before dropping it`, why: 'very dark footage: ' + why + ', but a find this weak cannot be trusted in this light, so it is not reported as an exercise' }); cur = e; continue; }
  const moved = !light.blind && !light.bands && camMoved(b.start, b.endF, cr.proxyBox || null), flick = !!light.bands || (!!cr.flickers && !light.blind); const warn = []; if (moved) warn.push('The camera moved'); if (light.dark) warn.push('Very dark'); if (flick) warn.push('Flickering light');
  const oth = !moved && !flick && cr.proxyBox ? otherShare(b.start, b.endF, cr.proxyBox) : { share: 0 }; const others = oth.share; b.oth = oth; if (others > K.OTHER_SHARE) warn.push('Someone else may be moving in the picture'); if (bare || moved) warn.push('The crop may cut off part of the body'); /* a box measured in a picture that itself moves is not to be trusted either */ if (reps < K.FEW_REPS) warn.push('Only one or two reps here');
  const say = b.how === 'chain' ? `Comes back to the same position ${b.count} times, about ${period.toFixed(1)} s each: check that it is an exercise` : `Repeats every ${period.toFixed(1)} s, ${reps} reps${b.double ? ', sides alternate' : ''}`;
  segs.push({ start: r3(s), end: r3(e), kind: 'exercise', group: b.group, period: r3(period), reps, crop: cr.box, cropHow: cr.how, ...(bare ? { cropUnsure: true } : {}), score: final, similarTo: on ? on.on.segIdx : null, hold: null, warn: warn.slice(0, 4), say, ...(others > 0 ? { others: r3(others) } : {}), why: why + carried + more + (light.bands ? '; bands of flickering light were taken out of the picture first' : '') + (bare ? '; CROP UNSURE (' + cr.how + '): check that the whole body is inside the box' : '') }); b.segIdx = segs.length - 1; cur = e; }
if (cur < duration - 1e-6) segs.push(junk(cur, duration)); lap('total');
write(segs.map((s, i) => ({ idx: i, ...s })));
// ---------- debug pictures ----------
if (dbgDir) { fs.mkdirSync(dbgDir, { recursive: true }); const out = segs.map((s, i) => ({ idx: i, ...s })); const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // the repetition field as a picture: x = time, y = lag; green = the change pictures one lag apart agree, red = they are opposite
  const img = Buffer.alloc(n * NL * 3); for (let i = 0; i < n; i++) for (let li = 0; li < NL; li++) { const sv = S[i * NL + li]; const o = ((NL - 1 - li) * n + i) * 3; if (sv !== sv) { img[o] = 34; img[o + 1] = 34; img[o + 2] = 48; continue; } const L = li + LMIN, j = jOf(L); const c = sv + K.THETA * Math.sqrt(eNet[j][i] * eNet[j][i + L]); const v = Math.max(-1, Math.min(1, c / (Math.sqrt(eRaw[j][i] * eRaw[j][i + L]) + 2 * noise))); if (v >= 0) { img[o] = 0; img[o + 1] = Math.round(235 * v); img[o + 2] = 0; } else { img[o] = Math.round(215 * -v); img[o + 1] = 0; img[o + 2] = 0; } }
  const png = spawnSync('ffmpeg', ['-nostdin', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${n}x${NL}`, '-i', '-', '-frames:v', '1', '-f', 'image2pipe', '-c:v', 'png', '-'], { input: img, maxBuffer: 1 << 28 }).stdout;
  const PW = 1500, X0 = 70, TW = X0 + PW + 20; const xs = (t) => X0 + PW * t / duration; const colors = ['#4fc3f7', '#ffb74d', '#81c784', '#ba68c8', '#fff176', '#f06292', '#4db6ac', '#ff8a65', '#9575cd', '#aed581', '#90a4ae', '#e57373']; const gcol = (g) => colors[(g - 1) % colors.length];
  const yS = 58, hS = 46, yE = 150, hE = 90, yC = 262, hC = 80, yF = 366, hF = 330, yT = yF + hF + 4; const TH = yT + 40; const o = [];
  o.push(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${TW}" height="${TH}" font-family="DejaVu Sans Mono" font-size="12"><rect width="${TW}" height="${TH}" fill="#14141c"/>`);
  o.push(`<text x="10" y="18" fill="#fff" font-size="14">${esc(path.basename(video))}   ${duration.toFixed(1)} s   ${SRCW}x${SRCH}   ${srcFps.toFixed(2)} fps   proxy ${W}x${H} at ${FPS} fps   ${out.filter((q) => q.kind === 'exercise').length} exercise segments, ${new Set(out.filter((q) => q.kind === 'exercise').map((q) => q.group)).size} groups</text>`);
  o.push(`<text x="10" y="36" fill="#9aa">white lines in the field = the repeats kept (their height is the period); grey = candidates turned down; brackets = there-and-back chains; dashed verticals = segment boundaries</text>`);
  o.push(`<text x="4" y="${yS + 26}" fill="#9aa">segments</text><text x="4" y="${yE + 50}" fill="#9aa">movement</text><text x="4" y="${yC + 44}" fill="#9aa">match</text><text x="4" y="${yF + 14}" fill="#9aa">lag (s)</text>`);
  for (const q of out) { const x0 = xs(q.start), x1 = xs(q.end); if (q.kind === 'exercise') { o.push(`<rect x="${x0.toFixed(1)}" y="${yS}" width="${Math.max(1, x1 - x0).toFixed(1)}" height="${hS}" fill="${gcol(q.group)}" opacity="${(0.35 + 0.65 * q.score).toFixed(2)}"/>`);
      o.push(`<text x="${(x0 + 3).toFixed(1)}" y="${yS + 14}" fill="#000" font-size="11">#${q.idx} g${q.group}</text><text x="${(x0 + 3).toFixed(1)}" y="${yS + 27}" fill="#000" font-size="11">${q.period}s x${q.reps}</text><text x="${(x0 + 3).toFixed(1)}" y="${yS + 40}" fill="#000" font-size="11">s ${q.score}</text>`); }
    else o.push(`<rect x="${x0.toFixed(1)}" y="${yS + 14}" width="${Math.max(1, x1 - x0).toFixed(1)}" height="${hS - 28}" fill="#555"/>`); }
  { const top = 2.5 * eRef; let d = `M${X0},${yE + hE}`; for (let i = 0; i < n; i++) d += `L${xs(sec(i)).toFixed(1)},${(yE + hE - hE * Math.min(1, Math.sqrt(eNet[1][i] / top))).toFixed(1)}`; d += `L${xs(sec(n - 1)).toFixed(1)},${yE + hE}Z`; o.push(`<path d="${d}" fill="#7ad67a" opacity="0.85"/>`);
    const yr = yE + hE - hE * Math.sqrt(1 / 2.5); o.push(`<line x1="${X0}" x2="${X0 + PW}" y1="${yr.toFixed(1)}" y2="${yr.toFixed(1)}" stroke="#ccc" stroke-dasharray="2 4"/><text x="${X0 + PW - 250}" y="${(yr - 3).toFixed(1)}" fill="#ccc" font-size="10">the video's strong-movement level (eRef)</text>`); }
  o.push(`<rect x="${X0}" y="${yC}" width="${PW}" height="${hC}" fill="#1c1c28"/>`); { const ym = yC + hC - hC * K.MIN_COS; o.push(`<line x1="${X0}" x2="${X0 + PW}" y1="${ym}" y2="${ym}" stroke="#ccc" stroke-dasharray="2 4"/><text x="${X0 + PW - 250}" y="${ym - 3}" fill="#ccc" font-size="10">least match for a bout (${K.MIN_COS})</text>`); }
  const cosAlong = (b) => { const m = b.t.length, v = new Float64Array(m); for (let k = 0; k < m; k++) { const i = b.t[k], L = b.l[k], j = jOf(L); const c = sAt(b, k) + K.THETA * Math.sqrt(eNet[j][i] * eNet[j][i + L]); v[k] = Math.max(0, Math.min(1, c / (Math.sqrt(eRaw[j][i] * eRaw[j][i + L]) + 2 * noise))); } const sm = new Float64Array(m); for (let k = 0; k < m; k++) { let a2 = 0, c2 = 0; for (let q = Math.max(0, k - 3); q <= Math.min(m - 1, k + 3); q++) { a2 += v[q]; c2++; } sm[k] = a2 / c2; } return sm; };
  const fy = (L) => yF + hF * (1 - (L - LMIN + 0.5) / NL); o.push(`<image x="${X0}" y="${yF}" width="${PW}" height="${hF}" preserveAspectRatio="none" xlink:href="data:image/png;base64,${png.toString('base64')}"/>`);
  for (const sL of [1, 2, 3, 4, 6, 8, 10]) { const L = sL * FPS; if (L < LMIN || L > LMAX) continue; o.push(`<text x="${X0 - 22}" y="${(fy(L) + 4).toFixed(1)}" fill="#9aa">${sL}</text><line x1="${X0 - 4}" x2="${X0}" y1="${fy(L).toFixed(1)}" y2="${fy(L).toFixed(1)}" stroke="#9aa"/>`); }
  for (const c of cands) { if (c.gain < 1.5 * eRef || bouts.some((b) => b.t === c.t)) continue; let d = ''; for (let k = 0; k < c.t.length; k += 2) d += `${k ? 'L' : 'M'}${xs(sec(c.t[k])).toFixed(1)},${fy(c.l[k]).toFixed(1)}`; o.push(`<path d="${d}" stroke="#888" fill="none" stroke-width="1"/>`); }
  for (const b of bouts) { if (b.t) { let d = ''; for (let k = 0; k < b.t.length; k++) d += `${k ? 'L' : 'M'}${xs(sec(b.t[k])).toFixed(1)},${fy(b.l[k]).toFixed(1)}`; o.push(`<path d="${d}" stroke="#fff" fill="none" stroke-width="2"/>`); const cs = cosAlong(b); let d2 = ''; for (let k = 0; k < b.t.length; k++) d2 += `${k ? 'L' : 'M'}${xs(sec(b.t[k])).toFixed(1)},${(yC + hC - hC * cs[k]).toFixed(1)}`; o.push(`<path d="${d2}" stroke="${gcol(b.group)}" fill="none" stroke-width="1.5"/>`); } }
  for (const c of chains) { const y = yC + hC - 6; o.push(`<path d="M${xs(sec(c.a)).toFixed(1)},${y - 8}V${y}H${xs(sec(c.c)).toFixed(1)}V${y - 8}" stroke="#ffd54f" fill="none" stroke-width="1.5"/><text x="${(xs(sec(c.a)) + 4).toFixed(1)}" y="${y - 3}" fill="#ffd54f" font-size="10">there and back x${c.count}, q ${c.q.toFixed(2)}</text>`); }
  for (const q of out) for (const t of [q.start, q.end]) if (t > 0.01 && t < duration - 0.01) o.push(`<line x1="${xs(t).toFixed(1)}" x2="${xs(t).toFixed(1)}" y1="${yS}" y2="${yF + hF}" stroke="${q.kind === 'exercise' ? '#fff' : '#bbb'}" stroke-width="1" stroke-dasharray="5 3" opacity="0.8"/>`);
  const tick = duration > 90 ? 10 : duration > 30 ? 5 : duration > 12 ? 2 : 1; for (let t = 0; t <= duration; t += tick) o.push(`<line x1="${xs(t).toFixed(1)}" x2="${xs(t).toFixed(1)}" y1="${yT}" y2="${yT + 6}" stroke="#9aa"/><text x="${(xs(t) - 8).toFixed(1)}" y="${yT + 20}" fill="#9aa">${t}s</text>`);
  o.push('</svg>'); const svgF = path.join(dbgDir, 'timeline.svg'); fs.writeFileSync(svgF, o.join('\n')); const rr = spawnSync('ffmpeg', ['-nostdin', '-loglevel', 'error', '-y', '-i', svgF, '-frames:v', '1', path.join(dbgDir, 'timeline.png')]); if (rr.status !== 0) console.error('timeline.png: ' + String(rr.stderr).slice(-300));
  // one contact sheet per segment: frames across it, the crop box drawn on exercise segments
  const FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf'; const hasFont = fs.existsSync(FONT); const th = Math.max(4, Math.round(Math.max(SRCW, SRCH) / 200));
  for (const q of out) { const len = q.end - q.start; const N = q.kind === 'exercise' ? 10 : 6; const cellH = 170; const cellW = Math.round(cellH * SRCW / SRCH / 2) * 2; const label = `#${q.idx} ${q.kind} ${q.start.toFixed(2)}-${q.end.toFixed(2)} s` + (q.kind === 'exercise' ? `  group ${q.group}  period ${q.period} s  x${q.reps}  score ${q.score}  crop ${q.crop.join(' ')}` : '');
    const vf = [`fps=${(N / Math.max(len, 0.2)).toFixed(4)}`, q.kind === 'exercise' ? `drawbox=x=${q.crop[2]}:y=${q.crop[3]}:w=${q.crop[0]}:h=${q.crop[1]}:color=red:t=${th}` : null, `scale=${cellW}:${cellH}`, `tile=${N}x1`, `pad=iw:ih+22:0:22:color=0x14141c`, hasFont ? `drawtext=fontfile=${FONT}:text='${label.replace(/[\\':%,]/g, ' ')}':x=4:y=4:fontsize=13:fontcolor=${q.kind === 'exercise' ? '0x7dff9a' : '0xff9a8a'}` : null].filter(Boolean).join(',');
    const f = path.join(dbgDir, `seg-${String(q.idx).padStart(2, '0')}-${q.kind}.jpg`); const r2 = spawnSync('ffmpeg', ['-nostdin', '-loglevel', 'error', '-y', '-ss', q.start.toFixed(3), '-t', len.toFixed(3), '-i', video, '-an', '-vf', vf, '-frames:v', '1', '-q:v', '4', f]); if (r2.status !== 0) console.error(`${path.basename(f)}: ${String(r2.stderr).slice(-200)}`); }
  // where each crop comes from: left the middle frame of the bout, right the map. White = strongly moving in rhythm, green = joined to it and stirring in rhythm, blue = the still parts taken in,
  // olive = stirs in rhythm but is not joined, dark red = stirs out of rhythm (somebody else, a screen, the camera). Red box = the crop before padding, yellow = the strongly moving pixels alone.
  for (const b of bouts) { const mp = b.crop && b.crop.maps; if (!mp || b.segIdx == null) continue; const SC = Math.max(2, Math.round(480 / Math.max(W, H))); const iw = W * SC * 2, ih = H * SC; const im = Buffer.alloc(iw * ih * 3);
    const put = (x, y, r, g, bl) => { if (x < 0 || y < 0 || x >= iw || y >= ih) return; const o = (y * iw + x) * 3; im[o] = r; im[o + 1] = g; im[o + 2] = bl; };
    for (let y = 0; y < ih; y++) for (let x = 0; x < W * SC; x++) { const p = Math.floor(y / SC) * W + Math.floor(x / SC); const v = raw[mp.mid * WH + p]; put(x, y, v, v, v);
      let c = [10, 10, 16]; if (mp.strong[p]) c = [255, 255, 255]; else if (mp.core[p]) c = [60, 200, 90]; else if (mp.still && mp.still[p]) c = [70, 130, 255]; else if (mp.weak[p]) c = [110, 110, 40]; else if (mp.stir[p]) c = [120, 40, 40]; put(x + W * SC, y, c[0], c[1], c[2]); }
    const rect = (bx, col, off) => { const [x0, y0, x1, y1] = bx; for (let t = 0; t < 2; t++) { for (let x = x0 * SC; x < (x1 + 1) * SC; x++) { put(x + off, y0 * SC + t, col[0], col[1], col[2]); put(x + off, (y1 + 1) * SC - 1 - t, col[0], col[1], col[2]); } for (let y = y0 * SC; y < (y1 + 1) * SC; y++) { put(x0 * SC + t + off, y, col[0], col[1], col[2]); put((x1 + 1) * SC - 1 - t + off, y, col[0], col[1], col[2]); } } };
    for (const off of [0, W * SC]) { rect(mp.strongBox, [255, 220, 0], off); rect(mp.proxyBox, [255, 40, 40], off); }
    spawnSync('ffmpeg', ['-nostdin', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', iw + 'x' + ih, '-i', '-', '-frames:v', '1', path.join(dbgDir, 'seg-' + String(b.segIdx).padStart(2, '0') + '-cropmap.png')], { input: im }); }
  fs.writeFileSync(path.join(dbgDir, 'debug.json'), JSON.stringify({ video, constants: K, noise, eRef, frames: n, timingMs: timing,
    candidates: cands.filter((c) => c.gain >= 1.5 * eRef).map((c) => ({ from: r3(sec(c.t0)), to: r3(sec(c.t1)), reachesTo: r3(sec(c.end)), lag: r3(sec(c.lag)), lagRange: [r3(sec(c.lagLo)), r3(sec(c.lagHi))], pathOverLag: r3((c.t1 - c.t0) / c.lag), match: r3(c.cos), gainOverERef: r3(c.gain / eRef), passes: gate(c) })),
    chains: chains.map((c) => ({ from: r3(sec(c.a)), to: r3(sec(c.c)), count: c.count, q: r3(c.q), rest: r3(c.rest), ampOverERef: r3(c.amp / eRef) })),
    bouts: bouts.map((b) => ({ how: b.how, start: r3(sec(b.start)), end: r3(sec(b.endF)), period: r3(sec(b.lagF)), group: b.group, likeEarlier: b.like == null ? null : r3(b.like), ownSpread: r3(b.self), trimmed: b.trim ? b.trim.map((v) => r3(sec(v))) : null, seam: b.seam == null ? null : r3(b.seam), match: r3(b.cos || 0), changeBefore: b.changeBefore ? r3(b.changeBefore) : null, changeAfter: b.changeAfter ? r3(b.changeAfter) : null, rhythmBreakAt: b.rhythmBreak ? r3(sec(b.rhythmBreak)) : null })) }, null, 1)); }
if (process.env.SPLIT_VERBOSE) { console.error(`${path.basename(video)}: ${n} frames, noise ${noise.toFixed(2)}, eRef ${eRef.toFixed(1)}, ${paths.length} paths, ${cands.length} candidates, ${chains.length} chains, ${bouts.length} bouts; ms ${JSON.stringify(timing)}`);
  for (const c of cands.filter((c) => c.gain >= 1.5 * eRef).sort((p, q) => p.t0 - q.t0)) console.error(`   ${gate(c) ? 'ok ' : '-- '} t ${sec(c.t0).toFixed(2)}-${sec(c.t1).toFixed(2)} -> ${sec(c.end).toFixed(2)}  lag ${sec(c.lag).toFixed(2)} [${sec(c.lagLo).toFixed(2)}-${sec(c.lagHi).toFixed(2)}]  dur/lag ${((c.t1 - c.t0) / c.lag).toFixed(2)}  cos ${c.cos.toFixed(2)}  gain ${(c.gain / eRef).toFixed(1)}  moving ${sec(c.moving).toFixed(1)} s`);
  for (const c of chains) console.error(`   chain ${sec(c.a).toFixed(2)}-${sec(c.c).toFixed(2)}  x${c.count}  q ${c.q.toFixed(2)}  amp ${(c.amp / eRef).toFixed(2)} eRef  rest ${c.rest.toFixed(2)}`);
  for (const b of bouts) for (const t of b.extTried || []) console.error(`   EXT ${t.pose ? "pose" : "path"} ${sec(b.start).toFixed(2)}-${sec(b.endF).toFixed(2)} ${t.dir < 0 ? "back" : "fwd "} rows ${t.rows}/${t.len} took ${t.took ?? '-'} gain ${(t.gain / eRef).toFixed(1)} cos ${t.cos.toFixed(2)} ${t.ok ? 'OK' : 'no'}`);
  for (const b of bouts) if (b.oth && b.oth.body != null) console.error(`   OTHER ${sec(b.start).toFixed(2)}-${sec(b.endF).toFixed(2)} share ${b.oth.share.toFixed(2)} (by area alone ${b.oth.outShare.toFixed(2)}) athlete blocks p75 ${b.oth.body} need ${b.oth.need.toFixed(1)} outside clump median ${b.oth.out}`);
  for (const b of bouts) console.error(`   BOUT ${b.how} ${sec(b.start).toFixed(2)}-${sec(b.endF).toFixed(2)} period ${sec(b.lagF).toFixed(2)} group ${b.group} like ${b.like == null ? '-' : b.like.toFixed(2)} self ${b.self.toFixed(0)} trim ${b.trim ? b.trim.map((v) => sec(v).toFixed(2)).join('/') : '-'} seam ${b.seam == null ? '-' : b.seam.toFixed(2)}${b.changeAfter ? ' change after x' + b.changeAfter.toFixed(2) : ''}${b.changeBefore ? ' change before x' + b.changeBefore.toFixed(2) : ''}`); }
