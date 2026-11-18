#!/usr/bin/env node
// prep.mjs: cut the driving clip for one exercise out of a span of raw footage, cropped to the athlete, as a square clip.
// Rep mode: find ONE clean repetition (repLength), then export REAL consecutive footage from where it starts, for clipLength seconds.
// With --hold: the steadiest 4 seconds of the span instead (a plank, a hang, a wall sit: nothing repeats in a hold).
//
// Why clipLength: Higgsfield's motion transfer never renders less than 4.0 s and rounds to a whole number of seconds (a 4.07 s clip came
// back as 4.0 s, 1.4 s clips came back as 4.0 s with the model inventing the rest). A rep that does not fit its render, or a render whose
// invented continuation does not return to the start, cannot loop cleanly and falls back to play-once-and-fade (12 of the last 19 loops).
// So the driving clip is the real footage from the chosen rep's start for clipLength = max(4, ceil(repLength + 0.4)) whole seconds, into
// the following reps, never past the end of the span. When the span does not hold that much after the rep's start, the chosen rep is
// repeated to fill clipLength (and a warning says so). The file has exactly clipLength x 30 frames.
//
// Usage:
//   node prep.mjs <video> --start <s> --end <s> [--crop w:h:x:y] [--exact-crop] [--period <s>] [--hold] [--pad 0.10] [--rotate 90] [--dry] --out <base>
//
//   <video>        any phone footage (rotation, variable frame rate, HEVC, 10-bit HDR are handled)
//   --start --end  the span that holds the repetitions of one exercise, in seconds of the video (default: all of it).
//                  Give the repetitions only: walking in and setting up inside the span widen the automatic box.
//   --crop         the athlete box in pixels of the picture as shown (after rotation), e.g. the splitter's. The box found
//                  from what moves in the span (athleteBox in _lib.mjs, padded by --pad) is measured as well, and the
//                  UNION of the two is used: the splitter's box often stops at the parts that move and cuts off legs
//                  under a seated press or hands on a bar (against the hand boxes of 37 stretches: 12 cut, 5 with the
//                  union, for 15 % more area). The union is NOT taken when the camera moves (no automatic box then)
//                  or when the automatic box lies somewhere else (it shares under half of the smaller box: another
//                  mover); a warning says so. Without --crop the automatic box alone is used.
//                  A given box that holds the automatic box and is over 1.5x its area (NARROW) is too wide (the athlete is lost in
//                  it): the automatic box is used instead, with a warning. The union only ever widened before.
//   --exact-crop   use the --crop box exactly as given: no union, no narrowing (a box chosen by hand from the check picture).
//   --period       seconds of one repetition if known: lengths from 0.6x to 1.6x of it are tried; without it the
//                  period is estimated from the span, and failing that any length from 1 to 7 s may win. A repetition
//                  outside 0.6x-1.6x of a period that was given is never returned without a warning.
//   --hold         hold mode: no repetition is looked for. The steadiest 4.0 s of the span (the 4 s in which the
//                  cropped picture changes least from frame to frame) is exported; a span of 3 to 4 s gives its steadiest 3 s with the
//                  last frame held to 4 s (a warning says so). --period is ignored.
//   --pad          share of the box's longer side added on every side of an automatic box (0.08-0.12 is the useful range)
//   --rotate       turn the picture a further 90, 180 or 270 degrees clockwise first: only for footage that shows
//                  sideways because it carries no rotation tag (--crop is then in pixels of the turned picture)
//   --dry          measure and print only: no clip, sheet or check picture is written (luma and sharpness are then null)
//   --out          writes <base>.mp4 (720x720, 30 fps, h264 yuv420p, no audio; the box centred on #0a0014, never
//                  cropped to make it square), <base>-sheet.jpg (8 frames of it) and <base>-check.jpg (the frame
//                  the clip starts on, with the boxes drawn: red = the crop used, yellow = what was seen moving,
//                  blue = the --crop that was given, when the crop used is not that box)
//
// Prints one line of JSON:
//   { start, repLength, clipLength, footage, frames, seam, typicalStep, ratio, crop: [w,h,x,y], warnings: [], ... }
//   start = seconds into the video where the repetition begins (and the driving clip); repLength = the one clean repetition: this is
//   what cut.mjs --seconds takes; clipLength = the length of the driving clip file (whole seconds, at least 4); footage = "real"
//   (consecutive footage) or "looped" (the rep repeated, the span was too short); frames = clipLength x 30; seam = how different its
//   last frame is from its first (mean gray levels, 96 px, 15 fps); typicalStep = the ordinary change between two frames;
//   ratio = seam / typicalStep.
//   Hold mode: { mode: "hold", start, clipLength: 4, holdLength (the still footage in it: 4, or 3 when the last frame is held),
//   footage, crop, warnings, motion, typicalStep, ... } (motion = the mean change between two frames inside the window, same units).
// Warnings: repetition shorter than 1 s or longer than 7 s, or outside 0.6x-1.6x of the period given, seam ratio above
//   1.7, box touching the edge of the picture, camera moving (no automatic box: the whole picture or the given box is
//   used), very dark, blurry, no clear repetition, athlete small in the picture, the span too short for clipLength (rep repeated),
//   a hold that is not still (in its steadiest window the picture still changes more than HOLD_MOTION gray levels a frame, whatever
//   the length of the span: a plank 0.05, a pull-up hold that sways 0.76-0.95, squats 2.4; or more than 0.7x the span's own typical step
//   when the span is long enough to show a difference).
//   A warning never stops the export.
// Exit codes: 0 = clip written; 1 = the span cannot hold a repetition, or is under 3 s in hold mode (JSON with `error`);
//   2 = bad arguments or an unreadable file (message on stderr).
import fs from 'node:fs'; import path from 'node:path';
import { args, fail, ff, run, probe, turned, colour, upright, grayFrames, athleteBox, padBox, squareFrames, findRep, differ, typicalStep, BG } from './_lib.mjs';

const USAGE = 'usage: node prep.mjs <video> --start <s> --end <s> [--crop w:h:x:y] [--exact-crop] [--period <s>] [--hold] [--pad 0.10] [--rotate 90] [--dry] --out <base>';
const a = args(process.argv.slice(2), ['hold', 'dry', 'exact-crop']); const video = a._[0];
if (!video || (!a.out && !a.dry)) fail('prep.mjs: a video and --out are needed', USAGE);
if (!fs.existsSync(video)) fail(`prep.mjs: no such file: ${video}`);
const p0 = probe(video); if (!p0) fail(`prep.mjs: no video in ${video}`);
if (a.rotate !== undefined && ![0, 90, 180, 270].includes(Number(a.rotate))) fail('prep.mjs: --rotate is 90, 180 or 270 (degrees clockwise)', USAGE);
const p = turned(p0, a.rotate);
const start = Math.max(0, Number(a.start ?? 0)), end = Math.min(p.duration, a.end !== undefined ? Number(a.end) : p.duration);
if (!(end - start > 0.5)) fail(`prep.mjs: the span ${start}-${end} s is empty or shorter than half a second (the video is ${p.duration.toFixed(2)} s)`, USAGE);
const period = !a.hold && a.period !== undefined ? Number(a.period) : 0; if (!a.hold && a.period !== undefined && !(period > 0)) fail('prep.mjs: --period must be a number of seconds', USAGE);
const pad = a.pad !== undefined ? Number(a.pad) : 0.10; if (!(pad >= 0 && pad <= 0.5)) fail('prep.mjs: --pad is a share of the box, 0 to 0.5', USAGE);
const warnings = []; const FPS = 15, S = 96, OUT = 720, OUT_FPS = 30;
const CLIP_MIN = 4, CLIP_EXTRA = 0.4;  // the render is never under 4.0 s and is rounded to whole seconds; a rep is given 0.4 s of the next one to close on
const HOLD_WIN = 4.0, HOLD_MIN = 3.0;  // the steadiest window of a hold: 4 s; a span with less than 4 but 3 s or more gives 3 s and a held last frame
const HOLD_MOTION = 1.5;               // gray levels a frame: a hold's steadiest window changes less than this (plank 0.05-0.16, a pull-up hold that sways 0.76 in 3 s and 0.95 in 4 s, squats 2.4)
const NARROW = 1.5;                    // a given box over this many times the area of the padded motion box (and holding it) is too wide. Measured on the 47 exercise stretches of the sample: the ratio is under 1.4 for 45 and 1.62 and 1.64 for two (the long-E climber push-ups, 1920x923 against 1344x802, and barbell back squats, 905 wide against 580); in both the motion box holds the whole athlete and the bar (check pictures). The task's first figure, 1.8, fires on none of them
if (a.out) fs.mkdirSync(path.dirname(path.resolve(a.out)), { recursive: true });

// the span as small gray frames: one decode serves the box and the repetition search
const fr = grayFrames(p, { start, dur: end - start, fps: FPS, long: 240 });
if (fr.n < FPS) fail(`prep.mjs: only ${fr.n} frames could be read from the span`);

// ---- the box
const whole = [p.width - (p.width % 2), p.height - (p.height % 2), 0, 0]; const area = (b) => b[0] * b[1];
const inter = (b, c) => Math.max(0, Math.min(b[2] + b[0], c[2] + c[0]) - Math.max(b[2], c[2])) * Math.max(0, Math.min(b[3] + b[1], c[3] + c[1]) - Math.max(b[3], c[3]));
let crop, seen = null, boxFrom = 'given', given = null; const box = athleteBox(fr, p);
if (a.crop) {
  crop = String(a.crop).split(/[:,x]/).map(Number);
  if (crop.length !== 4 || crop.some((v) => !Number.isFinite(v))) fail('prep.mjs: --crop is w:h:x:y in pixels', USAGE);
  let [w, h, x, y] = crop; x = Math.max(0, Math.min(x, p.width - 2)); y = Math.max(0, Math.min(y, p.height - 2)); w = Math.min(w, p.width - x); h = Math.min(h, p.height - y);
  if (w !== crop[0] || h !== crop[1] || x !== crop[2] || y !== crop[3]) warnings.push(`--crop reached outside the ${p.width}x${p.height} picture and was cut to ${w}:${h}:${x}:${y}`);
  crop = given = [w - (w % 2), h - (h % 2), x, y];
  // the union with the automatic box: what moves in the span, padded. Not when the camera moves, nothing moves, or the automatic box is somewhere else.
  if (a['exact-crop']) { boxFrom = 'given (exact)'; if (!box.moving && box.box) seen = box.box; }
  else if (box.moving) warnings.push('the camera moves (hand-held?), so no automatic box could be measured: the box given with --crop is used as it is, check that the whole body is inside it');
  else if (box.box) { seen = box.box; const auto = padBox(seen, p, pad); const shared = inter(auto, given) / Math.min(area(auto), area(given));
    if (shared < 0.5) warnings.push(`what moves most in the span (${seen[0]}x${seen[1]} at ${seen[2]},${seen[3]}) lies mostly outside the box given with --crop: somebody or something else is moving, the given box is used as it is`);
    else if (area(given) > NARROW * area(auto) && inter(auto, given) / area(auto) >= 0.85) { crop = auto; boxFrom = 'motion (narrowed from the given box)'; warnings.push(`the box given with --crop (${given[0]}x${given[1]}) is ${(area(given) / area(auto)).toFixed(2)}x the area of the box of what moves, padded (${auto[0]}x${auto[1]}), and holds it: the athlete is lost in a box that wide, so the tighter box was used. --exact-crop keeps the given box. Check the picture: a limb that does not move may be cut off`); }
    else { let x0 = Math.min(given[2], auto[2]), y0 = Math.min(given[3], auto[3]), x1 = Math.max(given[2] + given[0], auto[2] + auto[0]), y1 = Math.max(given[3] + given[1], auto[3] + auto[1]); x0 -= x0 % 2; y0 -= y0 % 2; let uw = Math.min(p.width, x1) - x0, uh = Math.min(p.height, y1) - y0; uw -= uw % 2; uh -= uh % 2;
      const u = [uw, uh, x0, y0]; if (area(u) > area(given)) { crop = u; boxFrom = 'given + motion'; if (area(u) > 2 * area(given)) warnings.push(`the box was widened to ${uw}x${uh}, over twice the box given with --crop (${given[0]}x${given[1]}): movement was seen well outside it, check the picture`); }
      if (box.touches.length && boxFrom === 'given + motion') warnings.push(`the athlete box touches the ${box.touches.join(' and ')} edge of the picture: part of the body, the bar, or a shadow or reflection may be cut off by the camera`); } }
} else {
  boxFrom = 'motion';
  if (box.moving) { crop = whole; boxFrom = 'whole picture'; warnings.push('the camera moves (hand-held?): the athlete could not be told from the background, so the whole picture is used; give --crop by hand'); }
  else if (!box.box) { crop = whole; boxFrom = 'whole picture'; warnings.push(`no movement found in the span (${box.reason || 'nothing moves'}): the whole picture is used${a.hold ? ' (in a hold little moves: give --crop, or a span that includes getting into the position)' : ''}`); }
  else {
    seen = box.box; crop = padBox(seen, p, pad);
    // a very small moving area (a wrist, a calf) is not a whole athlete: never crop tighter than a third of the picture's short side
    const least = 0.33 * Math.min(p.width, p.height), longer = Math.max(crop[0], crop[1]);
    if (longer < least) {
      const f = least / longer, cx = crop[2] + crop[0] / 2, cy = crop[3] + crop[1] / 2; const w = Math.min(p.width, crop[0] * f), h = Math.min(p.height, crop[1] * f);
      const x = Math.min(p.width - w, Math.max(0, cx - w / 2)), y = Math.min(p.height - h, Math.max(0, cy - h / 2));
      warnings.push(`only a small area moves (${seen[0]}x${seen[1]} px): the box was widened to ${Math.round(w)}x${Math.round(h)}, check that the whole athlete is inside it`);
      crop = [Math.floor(w / 2) * 2, Math.floor(h / 2) * 2, Math.floor(x / 2) * 2, Math.floor(y / 2) * 2];
    }
    if (box.touches.length) warnings.push(`the athlete box touches the ${box.touches.join(' and ')} edge of the picture: part of the body, the bar, or a shadow or reflection may be cut off by the camera`);
    if (box.ignored > 0.25) warnings.push(`${Math.round(box.ignored * 100)}% of the movement in the picture is away from the athlete box and was left out (another person, a mirror, a screen?)`);
  }
}
const side = Math.max(crop[0], crop[1]);
if (side < 300) warnings.push(`the athlete is small in the picture: the box is only ${crop[0]}x${crop[1]} px and is enlarged ${(OUT / side).toFixed(1)}x`);

// ---- what to export: one repetition and real footage from where it starts (clipLength s), or (hold) the steadiest window; both measured on the cropped square, as the driving clip will show it
const sq = squareFrames(fr, p, crop, S); let t0, repLen = null, clipLen, footage = 'real', rep = null, hold = null, holdLen = null;
if (a.hold) {
  const n = sq.n, W3 = Math.round(HOLD_MIN * FPS), W = n >= Math.round(HOLD_WIN * FPS) + 1 ? Math.round(HOLD_WIN * FPS) : W3; // a window of 4 s when the span has it, else 3 s
  if (n < W3 + 1) { process.stdout.write(`${JSON.stringify({ mode: 'hold', error: `the span is shorter than ${HOLD_MIN} s`, span: [start, end], crop, warnings })}\n`); process.exit(1); }
  const diff = differ(sq); const step = new Float64Array(n - 1); for (let i = 0; i < n - 1; i++) step[i] = diff(i, i + 1); let sum = 0; for (let i = 0; i < W; i++) sum += step[i]; let best = { a: 0, sum };
  for (let s = 1; s + W <= n - 1; s++) { sum += step[s + W - 1] - step[s - 1]; if (sum < best.sum - 1e-9) best = { a: s, sum }; }
  const typ = typicalStep(sq); const motion = best.sum / W; const drift = diff(best.a, best.a + W - 1); hold = { a: best.a, motion, typ, drift };
  t0 = start + best.a / FPS; holdLen = W / FPS; clipLen = CLIP_MIN; footage = W >= Math.round(CLIP_MIN * FPS) ? 'real' : 'held';
  if (footage === 'held') warnings.push(`the span holds only ${holdLen.toFixed(1)} s of footage that can be used: the last frame is held to fill the ${CLIP_MIN} s the render needs (a hold is still, so it should not show)`);
  if (motion > HOLD_MOTION) warnings.push(`the body is moving in its steadiest ${holdLen.toFixed(0)} s (${motion.toFixed(2)} gray levels a frame; a hold stays under ${HOLD_MOTION}: a plank 0.05, a pull-up hold that sways 0.95): this is not a hold. Leave --hold off and look for the repetition`);
  else if (typ > 0 && motion > 0.7 * typ && n > 2 * W) warnings.push(`the body keeps moving all through the span: its steadiest ${holdLen.toFixed(0)} s change ${motion.toFixed(2)} gray levels a frame, the span as a whole ${typ.toFixed(2)}. Expect a loop that sways; if this is not a hold, leave --hold off`);
  if (drift > Math.max(6 * motion, 2)) warnings.push(`the picture is not the same at the end of the ${holdLen.toFixed(0)} s as at their start (${drift.toFixed(1)} gray levels apart): the body sways or sinks during the hold, the loop will show a slow drift`);
} else {
  rep = findRep(sq, { period });
  if (!rep) { process.stdout.write(`${JSON.stringify({ error: 'the span is too short to hold one repetition', span: [start, end], crop, warnings })}\n`); process.exit(1); }
  t0 = start + rep.start; repLen = rep.length; clipLen = Math.max(CLIP_MIN, Math.ceil(repLen + CLIP_EXTRA - 1e-6));
  const clipOf = (r) => Math.max(CLIP_MIN, Math.ceil(r.length + CLIP_EXTRA - 1e-6));
  if (end - t0 < clipLen - 0.05) { // the cleanest rep is too near the end of the span for real footage to follow it: look for an earlier one that closes about as well
    const m = sq.n - Math.round(clipLen * FPS) + Math.round(repLen * FPS);
    if (m >= 2 * FPS) { const early = findRep({ ...sq, raw: sq.raw.subarray(0, m * S * S), n: m }, { period });
      if (early && start + early.start + clipOf(early) <= end + 0.05 && early.ratio <= Math.max(1.7, 1.5 * rep.ratio)) { warnings.push(`the cleanest repetition (from ${t0.toFixed(2)} s) lies too late in the span to be followed by ${clipLen} s of footage: an earlier one was taken (from ${(start + early.start).toFixed(2)} s, seam ${early.ratio.toFixed(2)}x a frame step against ${rep.ratio.toFixed(2)}x)`); rep = early; t0 = start + rep.start; repLen = rep.length; clipLen = clipOf(rep); } } }
  if (end - t0 < clipLen - 0.05) { footage = 'looped'; warnings.push(`the span holds only ${(end - t0).toFixed(1)} s from the repetition's start, the render needs ${clipLen} s: the one clean repetition (${repLen.toFixed(2)} s) is repeated to fill it. A wider --start/--end (more reps) gives real footage`); }
  if (repLen < 1) warnings.push(`the repetition is shorter than 1 s (${repLen.toFixed(2)} s)`);
  if (repLen > 7) warnings.push(`the repetition is longer than 7 s (${repLen.toFixed(2)} s)`);
  if (period > 0 && (repLen > 1.6 * period + 0.5 / FPS || repLen < 0.6 * period - 0.5 / FPS)) warnings.push(`the repetition found is ${repLen.toFixed(2)} s, ${repLen > period ? 'longer than 1.6x' : 'shorter than 0.6x'} the period given (${period.toFixed(2)} s): nothing between ${(0.6 * period).toFixed(2)} and ${(1.6 * period).toFixed(2)} s closes on itself in the span, check that this is one whole repetition`);
  if (rep.ratio > 1.7) warnings.push(`the repetition does not end quite where it starts: seam ${rep.seam.toFixed(2)} is ${rep.ratio.toFixed(2)}x an ordinary frame step`);
  if (!a.period && rep.periodFrom !== 'estimated') warnings.push('no clear repetition in the span: the best-closing stretch of 1-7 s was taken, check it is one whole repetition');
  if (rep.range < 0.6 * rep.fullRange) warnings.push('the stretch found moves less than the biggest movement in the span: it may be a part of a repetition');
  if (end - start < 1.5 * repLen) warnings.push('the span holds less than one and a half repetitions: there was little to choose from');
}
const FRAMES = Math.round(clipLen * OUT_FPS);

// ---- export: crop, scale to fit 720, colour to 8-bit SDR, pad to the square, 30 fps, exactly FRAMES frames
const fit = (v) => Math.max(2, Math.round((v * OUT) / side / 2) * 2); const sw = Math.min(OUT, fit(crop[0])), sh = Math.min(OUT, fit(crop[1]));
const out = a.dry ? null : `${a.out}.mp4`; let look = { luma: null, sharp: null }; let frames = null;
if (!a.dry) {
  const chain = [...upright(p), `crop=${crop.join(':')}`, `scale=${sw}:${sh}:flags=lanczos`, colour(p), `pad=${OUT}:${OUT}:(ow-iw)/2:(oh-ih)/2:color=${BG}`, 'setsar=1', `fps=${OUT_FPS}`];
  // real footage: the clip as it is, the last frame cloned if the source ends a frame early. A hold that is shorter than the clip: its last frame held.
  // Looped: the first repLen s (whole frames) repeated until FRAMES frames are out.
  const M = repLen ? Math.round(repLen * OUT_FPS) : 0;
  const vf = [...chain, ...(footage === 'looped' ? [`trim=start_frame=0:end_frame=${M}`, 'setpts=PTS-STARTPTS', `loop=loop=-1:size=${M}:start=0`] : ['tpad=stop_mode=clone:stop_duration=2'])].join(',');
  const readS = footage === 'real' ? clipLen + 0.5 : footage === 'looped' ? repLen + 0.3 : (holdLen || clipLen) + 0.1; // how much of the source is read
  ff(['-ss', t0.toFixed(4), '-t', readS.toFixed(4), '-i', video, '-an', '-sn', '-vf', vf, '-frames:v', String(FRAMES), '-r', String(OUT_FPS), '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out]);
  const po = probe(out); frames = po && po.frames ? po.frames : null;
  if (frames !== null && frames !== FRAMES) warnings.push(`the driving clip has ${frames} frames, ${FRAMES} (${clipLen} s) were asked for: check it before it is uploaded`);
  // the sheet: row 1 = the clean repetition (8 frames over repLength; in a hold the first 4 s... of the clip), row 2 = the whole clip (8 frames over clipLength)
  { const top = repLen || holdLen || clipLen; const g = `[0:v]split=2[x][y];[x]fps=8/${top.toFixed(3)},scale=180:180,tile=8x1[a];[y]fps=8/${clipLen.toFixed(3)},scale=180:180,tile=8x1[b];[a][b]vstack=inputs=2[o]`;
    ff(['-i', out, '-filter_complex', g, '-map', '[o]', '-frames:v', '1', '-q:v', '4', `${a.out}-sheet.jpg`]); }
  // the check picture: the first frame of the clip with the boxes drawn
  { const th = Math.max(4, Math.round(Math.max(p.width, p.height) / 240)); const draw = [...upright(p), colour(p)];
    if (seen) draw.push(`drawbox=x=${seen[2]}:y=${seen[3]}:w=${seen[0]}:h=${seen[1]}:color=yellow:t=${Math.ceil(th / 2)}`);
    if (given && (boxFrom === 'given + motion' || boxFrom.startsWith('motion (narrowed'))) draw.push(`drawbox=x=${given[2]}:y=${given[3]}:w=${given[0]}:h=${given[1]}:color=blue:t=${Math.ceil(th / 2)}`);
    draw.push(`drawbox=x=${crop[2]}:y=${crop[3]}:w=${crop[0]}:h=${crop[1]}:color=red:t=${th}`, `scale=${p.width >= p.height ? '480:-2' : '-2:480'}`);
    ff(['-ss', t0.toFixed(4), '-i', video, '-vf', draw.join(','), '-frames:v', '1', '-q:v', '4', `${a.out}-check.jpg`]); }
  // dark or blurry? measured on the driving clip itself, inside the box only (not the padding)
  look = lookAt(out, [Math.round((OUT - sw) / 2), Math.round((OUT - sh) / 2), sw, sh], clipLen);
  if (look.luma < 45) warnings.push(`very dark: the box averages ${look.luma.toFixed(0)} of 255`);
  if (look.sharp < 0.16) warnings.push(`blurry or soft: the sharpest edges are spread over about ${(0.4 / Math.max(look.sharp, 1e-3)).toFixed(0)} px of the 720 px clip`);
}

const r3 = (v) => +v.toFixed(3), r2 = (v) => +v.toFixed(2); const nz = (v, f) => (v == null ? null : f(v));
const common = { crop, warnings, out, span: [r3(start), r3(end)], cropFrom: boxFrom, cropGiven: given, seenMoving: seen, touches: box.touches || [], camera: { moving: !!box.moving, noise: box.noise, jitter: box.jitter },
  luma: nz(look.luma, r2), sharpness: nz(look.sharp, r3), source: { width: p.width, height: p.height, fps: p.fps, rotation: p.rotation, turnedByHand: p.turn || 0, codec: p.codec, hdr: p.hdr } };
if (a.hold) process.stdout.write(`${JSON.stringify({ mode: 'hold', start: r3(t0), clipLength: clipLen, holdLength: r3(holdLen), footage, frames: frames ?? FRAMES, ...common, motion: r2(hold.motion), typicalStep: r2(hold.typ), drift: r2(hold.drift) })}\n`);
else process.stdout.write(`${JSON.stringify({ start: r3(t0), repLength: r3(repLen), clipLength: clipLen, footage, frames: frames ?? FRAMES, seam: r2(rep.seam), typicalStep: r2(rep.typicalStep), ratio: r2(rep.ratio), ...common, period: r3(rep.period), periodFrom: a.period ? 'given' : rep.periodFrom, range: r2(rep.range), score: r3(rep.score) })}\n`);

/**
 * Brightness and sharpness of the clip inside [x, y, w, h]: six frames, gray.
 * sharp = the steepest edges (99.5th percentile of the gradient) as a share of the picture's own contrast
 * (2nd-98th percentile): about 0.4 for a razor edge, 0.4 / k for an edge smeared over k pixels. The best of the six
 * frames counts, because a fast limb smears its own frames without the clip being out of focus.
 */
function lookAt(file, [x, y, w, h], dur) {
  const N = 6; const raw = run('ffmpeg', ['-nostdin', '-hide_banner', '-loglevel', 'error', '-i', file, '-vf', `fps=${(N / dur).toFixed(4)},crop=${w}:${h}:${x}:${y},format=gray`, '-frames:v', String(N), '-f', 'rawvideo', '-']);
  const n = Math.floor(raw.length / (w * h)); let luma = 0; const sharp = [];
  for (let t = 0; t < n; t++) {
    const o = t * w * h; const hist = new Uint32Array(256); let s = 0; for (let i = 0; i < w * h; i++) { const v = raw[o + i]; s += v; hist[v]++; } luma += s / (w * h);
    const pct = (f) => { let c = 0; const target = f * w * h; for (let v = 0; v < 256; v++) { c += hist[v]; if (c >= target) return v; } return 255; }; const contrast = Math.max(12, pct(0.98) - pct(0.02));
    const gh = new Uint32Array(512); let cnt = 0;
    for (let yy = 1; yy < h - 1; yy += 1) { const r = o + yy * w; for (let xx = 1; xx < w - 1; xx++) { const gx = raw[r + xx + 1] - raw[r + xx - 1], gy = raw[r + xx + w] - raw[r + xx - w]; const g = Math.min(511, Math.round(Math.sqrt(gx * gx + gy * gy))); gh[g]++; cnt++; } }
    let c = 0, g995 = 0; for (let g = 511; g >= 0; g--) { c += gh[g]; if (c >= 0.005 * cnt) { g995 = g; break; } }
    sharp.push(g995 / 2 / contrast);
  }
  return { luma: n ? luma / n : 0, sharp: sharp.length ? Math.max(...sharp) : 0 };
}
