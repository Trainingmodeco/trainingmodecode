#!/usr/bin/env node
// export-clips.mjs: cut the source clip of every stretch of an export plan out of the owner's raw footage (JOB 2 of PC-SESSION-PROMPT.md).
//
// Usage:
//   node export-clips.mjs <plan.json> <rawRoot> <outDir> [--only <id,id,...>] [--limit <n>] [--force]
//
//   <plan.json>  the list of stretches to export: factory/export-plan.json ({ items: [...] }, or a bare array). Each item:
//                { id, name, clip, folder, file, start, end } with start / end the cut in seconds of the original video (the owner's
//                from / to when he set them, else the stretch the scan found). `folder` and `file` say where the original is under <rawRoot>.
//   <rawRoot>    the footage folder (on the owner's PC: "TM Social Console folder"). A file that is not at <rawRoot>/<folder>/<file> is looked for by its
//                name anywhere under <rawRoot> (letter case ignored); it must be found exactly once.
//   <outDir>     <outDir>/<id>-src.mp4 and <outDir>/srcs.jsonl (one line per exported clip: { id, file, bytes, doc }) and <outDir>/export-report.json.
//
// The cut of a stretch: its start and end with 0.5 s more on each side (kept inside the video); longer than 40 s: the middle 40 s of that.
// Picture: longest side at most 1280 (a smaller video is not enlarged), upright, 8-bit SDR (HDR is tone-mapped, like prep.mjs), h264 crf 20, no audio, faststart; over 20 MB it is made
// again at crf 24, then 28 (the board takes 20 MB per asset). A clip already in <outDir> (listed in srcs.jsonl, file there) is left alone unless --force.
//
// `doc` is the board document "srcs/<id>": { segId, clipId, asset: null, from, to, w, h, fps, exportedAt }. `asset` is filled by whoever uploads the
// clip to the board (Artifact tool, asset: true; the result's id), and only then is the document written.
// Prints ONE line of JSON: { planned, exported, kept, failed: [{ id, reason }], bytes, over40: n }. Exit 0 even when some failed (they are listed).
import fs from 'node:fs'; import path from 'node:path';
import { args, fail, ff, probe, upright, colour } from './_lib.mjs';

const USAGE = 'usage: node export-clips.mjs <plan.json> <rawRoot> <outDir> [--only <id,id,...>] [--limit <n>] [--force]';
const a = args(process.argv.slice(2), ['force']); const [planFile, rawRoot, outDir] = a._;
if (!planFile || !rawRoot || !outDir) fail('missing arguments', USAGE);
if (!fs.existsSync(rawRoot) || !fs.statSync(rawRoot).isDirectory()) fail(`not a folder: ${rawRoot}`, USAGE);
const MAX_LEN = 40, MARGIN = 0.5, MAX_BYTES = 20 * 1024 * 1024, CRFS = [20, 24, 28], LONG_SIDE = 1280;
const r3 = (v) => Math.round(v * 1000) / 1000;

const raw = JSON.parse(fs.readFileSync(planFile, 'utf8')); let items = Array.isArray(raw) ? raw : raw.items;
if (!Array.isArray(items)) fail('the plan has no list of items', USAGE);
if (a.only) { const want = new Set(String(a.only).split(',').map((s) => s.trim()).filter(Boolean)); items = items.filter((t) => want.has(t.id)); }
if (a.limit) items = items.slice(0, Math.max(0, Number(a.limit) || 0));
fs.mkdirSync(outDir, { recursive: true });

// the footage index, built once and only when a file is not where the plan says
let index = null;
const VIDEO = /\.(mp4|mov|m4v|webm|avi|mkv)$/i;
function find(folder, file) {
  const direct = path.join(rawRoot, folder || '', file || ''); if (file && fs.existsSync(direct)) return { path: direct };
  if (!index) { index = new Map(); const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (e.name.startsWith('.') || e.name.startsWith('._')) continue; const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (VIDEO.test(e.name)) { const k = e.name.toLowerCase(); index.set(k, [...(index.get(k) || []), p]); } } }; walk(rawRoot); }
  const hits = index.get(String(file || '').toLowerCase()) || [];
  if (hits.length === 1) return { path: hits[0] };
  return { reason: hits.length ? `${hits.length} files named ${file} under the footage folder` : `the video is not in the footage folder: ${path.join(folder || '', file || '')}` };
}

/** The cut of one stretch, in seconds of the original: the stretch plus a margin, inside the video, at most 40 s. */
export function cutOf(start, end, dur) {
  let from = Math.max(0, start - MARGIN), to = Math.min(dur, end + MARGIN);
  if (to - from > MAX_LEN) { const mid = (from + to) / 2; from = mid - MAX_LEN / 2; to = mid + MAX_LEN / 2; }
  return { from: r3(from), to: r3(to), long: end + MARGIN - Math.max(0, start - MARGIN) > MAX_LEN };
}

const listFile = path.join(outDir, 'srcs.jsonl');
const done = new Map(); if (fs.existsSync(listFile)) for (const l of fs.readFileSync(listFile, 'utf8').split('\n')) { if (!l.trim()) continue; try { const j = JSON.parse(l); if (j && j.id) done.set(j.id, j); } catch { /* a half line from a stopped run is dropped */ } }

let exported = 0, kept = 0, bytes = 0, over40 = 0; const failed = [];
for (const t of items) {
  const out = path.join(outDir, `${t.id}-src.mp4`);
  if (!a.force && done.has(t.id) && fs.existsSync(out) && fs.statSync(out).size > 2000) { kept++; bytes += fs.statSync(out).size; continue; }
  try {
    if (!t.id || !Number.isFinite(Number(t.start)) || !Number.isFinite(Number(t.end))) throw new Error('the plan item has no id, start or end');
    const src = find(t.folder, t.file); if (!src.path) throw new Error(src.reason);
    const p = probe(src.path); if (!p) throw new Error('no picture in the file');
    const dur = p.duration; if (!(dur > 0)) throw new Error('the file has no length');
    const start = Number(t.start), end = Number(t.end);
    if (!(end > start)) throw new Error(`the cut ${start}-${end} s ends before it starts`);
    if (start >= dur - 0.2) throw new Error(`the cut starts at ${start} s, the video is ${r3(dur)} s long`);
    const c = cutOf(start, Math.min(end, dur), dur); if (!(c.to - c.from >= 0.5)) throw new Error(`the cut leaves ${r3(c.to - c.from)} s`);
    const vf = [...upright(p), `scale=w='min(${LONG_SIDE},iw)':h='min(${LONG_SIDE},ih)':force_original_aspect_ratio=decrease:force_divisible_by=2`, colour(p)].join(',');
    let size = 0, crfUsed = 0;
    for (const crf of CRFS) {
      ff(['-ss', String(c.from), '-i', src.path, '-t', String(r3(c.to - c.from)), '-an', '-vf', vf, '-c:v', 'libx264', '-preset', 'medium', '-crf', String(crf), '-movflags', '+faststart', out]);
      size = fs.statSync(out).size; crfUsed = crf; if (size <= MAX_BYTES) break;
    }
    if (size > MAX_BYTES) { fs.rmSync(out, { force: true }); throw new Error(`still ${(size / 1048576).toFixed(1)} MB at crf ${crfUsed}`); }
    const q = probe(out); if (!q || !(q.duration > 0.4)) { fs.rmSync(out, { force: true }); throw new Error('the clip that was made cannot be read'); }
    const doc = { segId: t.id, clipId: t.clip ?? t.clipId ?? null, asset: null, from: c.from, to: c.to, w: q.width, h: q.height, fps: Math.round(q.fps * 100) / 100, exportedAt: new Date().toISOString() };
    const rec = { id: t.id, file: path.basename(out), bytes: size, crf: crfUsed, doc };
    done.set(t.id, rec); exported++; bytes += size; if (c.long) over40++;
    fs.writeFileSync(listFile, [...done.values()].map((r) => JSON.stringify(r)).join('\n') + '\n');
  } catch (e) { failed.push({ id: t.id, reason: String(e.message || e).slice(0, 300) }); }
}
const summary = { planned: items.length, exported, kept, failed, bytes, over40 };
fs.writeFileSync(path.join(outDir, 'export-report.json'), `${JSON.stringify({ ...summary, finishedAt: new Date().toISOString() }, null, 1)}\n`);
process.stdout.write(`${JSON.stringify(summary)}\n`);
