#!/usr/bin/env node
// strip.mjs: two small things to LOOK at a span of raw footage with, before any credit is spent on it.
//
// Usage:
//   node strip.mjs <video> --start <s> --end <s> [--rotate 90] [--max-kb 250] --out <base>
//
//   <base>-strip.jpg     8 evenly spaced frames of the span in one row, each 160 px tall
//   <base>-preview.mp4   the span itself (at most 12 s: of a longer span, the middle 12 s), longest side 320,
//                        12 fps, h264 crf 34, no audio, +faststart, kept under 250 KB (--max-kb; a busy picture
//                        is squeezed harder: crf 38, 42, 46, then a fixed bit rate that fits)
//
// --start defaults to 0 and --end to the end of the video. Rotation, variable frame rate, HEVC and HDR are handled
// as in ingest.mjs; --rotate turns footage that shows sideways for want of a rotation tag (degrees clockwise). Prints one line of JSON: { strip, preview, bytes, crf, span, previewSpan, times }.
import fs from 'node:fs'; import path from 'node:path';
import { args, fail, ff, probe, turned, colour, upright } from './_lib.mjs';

const USAGE = 'usage: node strip.mjs <video> --start <s> --end <s> [--rotate 90] [--max-kb 250] --out <base>';
const a = args(process.argv.slice(2)); const video = a._[0];
if (!video || !a.out) fail('strip.mjs: a video and --out are needed', USAGE);
if (!fs.existsSync(video)) fail(`strip.mjs: no such file: ${video}`);
const p0 = probe(video); if (!p0) fail(`strip.mjs: no video in ${video}`);
if (a.rotate !== undefined && ![0, 90, 180, 270].includes(Number(a.rotate))) fail('strip.mjs: --rotate is 90, 180 or 270 (degrees clockwise)', USAGE);
const p = turned(p0, a.rotate);
const start = Math.max(0, Number(a.start ?? 0)); const end = Math.min(p.duration, a.end !== undefined ? Number(a.end) : p.duration); const span = end - start;
if (!(span > 0)) fail(`strip.mjs: the span ${start}-${end} s is empty (the video is ${p.duration.toFixed(2)} s)`, USAGE);
fs.mkdirSync(path.dirname(path.resolve(a.out)), { recursive: true });
const N = 8, TALL = 160, LONG = 320, FPS = 12, MAX_S = 12, MAX_BYTES = (Number(a['max-kb']) > 0 ? Number(a['max-kb']) : 250) * 1024; const even = (v) => Math.max(2, Math.round(v / 2) * 2);

// ---- the strip: the middle of each eighth of the span; each frame found by its own seek, so a long 4K span costs eight frames, not all of them
const last = Math.max(0, p.duration - Math.max(0.12, 3 / (p.fps || 30))); const times = Array.from({ length: N }, (_, i) => Math.min(last, start + ((i + 0.5) * span) / N));
const tw = even((p.width * TALL) / p.height); const pre = [...upright(p), `scale=${tw}:${TALL}:flags=area`, colour(p)].join(',');
const stripFile = `${a.out}-strip.jpg`;
ff([...times.flatMap((t) => ['-ss', t.toFixed(3), '-i', video]), '-filter_complex', `${times.map((_, i) => `[${i}:v]${pre}[s${i}]`).join(';')};${times.map((_, i) => `[s${i}]`).join('')}hstack=inputs=${N}`, '-frames:v', '1', '-q:v', '4', stripFile]);

// ---- the preview
const ps = span > MAX_S ? start + (span - MAX_S) / 2 : start, pl = Math.min(span, MAX_S); const k = Math.min(1, LONG / Math.max(p.width, p.height));
const vf = [...upright(p), `fps=${FPS}`, `scale=${even(p.width * k)}:${even(p.height * k)}:flags=area`, colour(p)].join(','); const previewFile = `${a.out}-preview.mp4`;
const enc = (rate) => ff(['-ss', ps.toFixed(3), '-i', video, '-t', pl.toFixed(3), '-an', '-sn', '-vf', vf, '-c:v', 'libx264', '-preset', 'slow', ...rate, '-pix_fmt', 'yuv420p', '-movflags', '+faststart', previewFile]);
let used = null;
for (const crf of [34, 38, 42, 46]) { enc(['-crf', String(crf)]); used = crf; if (fs.statSync(previewFile).size <= MAX_BYTES) break; }
if (fs.statSync(previewFile).size > MAX_BYTES) { const kbps = Math.max(8, Math.floor((MAX_BYTES * 8 * 0.85) / pl / 1000)); enc(['-b:v', `${kbps}k`, '-maxrate', `${kbps}k`, '-bufsize', `${kbps}k`]); used = `${kbps}k`; }

const r = (v) => +v.toFixed(3);
process.stdout.write(`${JSON.stringify({ strip: stripFile, preview: previewFile, bytes: fs.statSync(previewFile).size, stripBytes: fs.statSync(stripFile).size, crf: used, span: [r(start), r(end)], previewSpan: [r(ps), r(ps + pl)], times: times.map(r), underLimit: fs.statSync(previewFile).size <= MAX_BYTES })}\n`);
