#!/usr/bin/env node
// cuts.mjs: replace the stretches the splitter found in a video with cut points checked by eye, so segs.json is never edited by hand.
// RUNBOOK A2b. Use it when the overview pictures show that the splitter's cut is wrong for a video: two different exercises in one
// stretch (dumbbell shoulder work with short sets of different moves is the usual case), a repeated movement it called junk, or
// boundaries that are far off.
//
// Usage:
//   node cuts.mjs <workDir> <cuts.json> [--jobs 3] [--dry]
//
//   cuts.json  { "<file name, path under the raw folder, or clipId>": [ { start, end, kind?, period?, reps?, group?, why?, warn?, crop? }, ... ], ... }
//              start, end   seconds of the video (the whole video's own clock). Stretches must not overlap; they are put in time order.
//              kind         "exercise" (default) or "junk". List only the junk worth a look (a repeated movement of a few reps the
//                           splitter missed is an exercise, not junk); the scan itself leaves out junk under 1 s.
//              period       seconds of one repetition, reps: how many (both optional, null when not given)
//              group        a number; stretches of the same movement inside this video share it. Default: a new number for each exercise.
//              why          one plain sentence for the owner (default: "Cut by hand from the footage.")
//              warn         extra warnings (strings); "Cut by hand by Claude: check the start, the end and the name." is always the first
//              crop         [w, h, x, y] box of the athlete in pixels of the picture; default the whole picture
//   The video's other stretches (the splitter's) are dropped from segs.json and their pictures deleted; the new ones get NEW numbers
//   (never a number used before for this clip: segids.json), a strip and a preview made with strip.mjs, and no name (name them with
//   name.mjs, A3). A stretch whose pictures could not be made is listed under noPicture.
//   Refuses (exit 1, nothing changed) when a stretch of the video has a loop, a render in progress or done, a cost, or a name: that work
//   hangs on its id. Use it BEFORE the first upload of the video to the board (A4, A5); after that, a changed cut goes through the board's cut editor.
//   --dry  check the file and print what would be written, write nothing.
// Prints ONE line of JSON: { clips: [{ clipId, file, dropped, written: [{ id, kind, start, end }] }], noPicture: [ids], segs }.
import fs from 'node:fs'; import path from 'node:path'; import { spawnSync } from 'node:child_process';
import { args, fail } from './_lib.mjs';

const HERE = path.dirname(fs.realpathSync(new URL(import.meta.url).pathname));
const USAGE = 'usage: node cuts.mjs <workDir> <cuts.json> [--jobs 3] [--dry]';
const a = args(process.argv.slice(2), ['dry']); const [workDirArg, cutsFile] = a._;
if (!workDirArg || !cutsFile) fail('cuts.mjs: a work folder and a cuts file are needed', USAGE);
const workDir = path.resolve(workDirArg); const segsFile = path.join(workDir, 'segs.json'), idsFile = path.join(workDir, 'segids.json'), clipsFile = path.join(workDir, 'clips.json'), scanFile = path.join(workDir, 'scan.json');
for (const f of [segsFile, clipsFile, scanFile, cutsFile]) if (!fs.existsSync(f)) fail(`cuts.mjs: no such file: ${f} (run scan.mjs first)`, USAGE);
const readJson = (f, what) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return fail(`cuts.mjs: ${what} is not valid JSON (${e.message})`); } };
const segsAll = readJson(segsFile, segsFile); if (!Array.isArray(segsAll)) fail('cuts.mjs: segs.json is not a list');
const clips = readJson(clipsFile, clipsFile); const rawRoot = readJson(scanFile, scanFile).rawRoot; const cuts = readJson(cutsFile, cutsFile);
if (!cuts || typeof cuts !== 'object' || Array.isArray(cuts)) fail('cuts.mjs: the cuts file must be an object: { "<file>": [ {start, end, ...} ] }', USAGE);
const r3 = (v) => Math.round(v * 1000) / 1000; const now = () => new Date().toISOString();
const named = (s) => s && s.guess && typeof s.guess.name === 'string' && s.guess.name.trim() !== '';
const HAS_WORK = (s) => !!s.loop || Number(s.cost) > 0 || ['generating', 'review', 'done', 'failed'].includes(s.state) || named(s);
const findClip = (key) => clips.find((c) => c.id === key || c.rel === key || c.file === key || String(c.rel).endsWith(`/${key}`));
const nnOf = (id) => { const m = /-(\d+)$/.exec(String(id)); return m ? Number(m[1]) : -1; };

// ---- check everything before changing anything
const plan = [];
for (const [key, list] of Object.entries(cuts)) {
  const c = findClip(key); if (!c) fail(`cuts.mjs: "${key}" is not a video of this scan (clips.json has: ${clips.map((x) => x.file).join(', ')})`, USAGE);
  if (!Array.isArray(list) || !list.length) fail(`cuts.mjs: ${key}: give a list of stretches`, USAGE);
  const rows = list.map((r, i) => {
    const start = Number(r.start), end = Number(r.end); const kind = r.kind === undefined ? 'exercise' : r.kind;
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start) fail(`cuts.mjs: ${key} #${i}: start and end are seconds with end after start (got ${r.start}, ${r.end})`, USAGE);
    if (end > c.duration + 0.05) fail(`cuts.mjs: ${key} #${i}: ends at ${end} s but the video is ${c.duration.toFixed(2)} s`, USAGE);
    if (kind !== 'exercise' && kind !== 'junk') fail(`cuts.mjs: ${key} #${i}: kind is "exercise" or "junk"`, USAGE);
    if (r.crop !== undefined && !(Array.isArray(r.crop) && r.crop.length === 4 && r.crop.every(Number.isFinite))) fail(`cuts.mjs: ${key} #${i}: crop is [w, h, x, y]`, USAGE);
    return { ...r, start: r3(start), end: r3(Math.min(end, c.duration)), kind };
  }).sort((x, y) => x.start - y.start);
  for (let i = 1; i < rows.length; i++) if (rows[i].start < rows[i - 1].end - 0.001) fail(`cuts.mjs: ${key}: the stretches ${rows[i - 1].start}-${rows[i - 1].end} and ${rows[i].start}-${rows[i].end} overlap`, USAGE);
  const old = segsAll.filter((s) => s.clipId === c.id); const busy = old.filter(HAS_WORK);
  if (busy.length) fail(`cuts.mjs: ${c.file}: ${busy.map((s) => `${s.id} (${named(s) ? `named "${s.guess.name}"` : s.state || 'work'})`).join(', ')} already has a name, a loop or a render: that work hangs on its id, so the stretches are not replaced. A changed cut after the upload goes through the board's cut editor.`);
  plan.push({ c, rows, old });
}
if (a.dry) { process.stdout.write(`${JSON.stringify({ dry: true, clips: plan.map((p) => ({ clipId: p.c.id, file: p.c.file, dropped: p.old.length, would: p.rows.map((r) => ({ kind: r.kind, start: r.start, end: r.end })) })) })}\n`); process.exit(0); }

// ---- write
const stripDir = path.join(workDir, 'strips'); fs.mkdirSync(stripDir, { recursive: true });
let highest = {}; if (fs.existsSync(idsFile)) highest = readJson(idsFile, idsFile) || {};
for (const s of segsAll) highest[s.clipId] = Math.max(highest[s.clipId] ?? -1, nnOf(s.id));
let result = segsAll.slice(); const out = []; const noPicture = []; const stamp = now();
for (const { c, rows, old } of plan) {
  for (const o of old) for (const f of [o.stripFile, o.previewFile]) if (f && f.startsWith(stripDir + path.sep) && fs.existsSync(f)) fs.unlinkSync(f);
  result = result.filter((s) => s.clipId !== c.id);
  const full = path.join(rawRoot, c.rel); if (!fs.existsSync(full)) fail(`cuts.mjs: the video is gone: ${full}`);
  let next = (highest[c.id] ?? -1) + 1, group = 0; const docs = [];
  rows.forEach((r, i) => {
    const ex = r.kind === 'exercise'; const nn = next++; highest[c.id] = nn; const id = `${c.id}-${String(nn).padStart(2, '0')}`;
    const g = ex ? (Number.isInteger(r.group) ? r.group : ++group) : 0; if (ex && Number.isInteger(r.group)) group = Math.max(group, r.group);
    const warn = ['Cut by hand by Claude: check the start, the end and the name.', ...(Array.isArray(r.warn) ? r.warn.filter((w) => typeof w === 'string') : [])].slice(0, 4);
    docs.push({ id, clipId: c.id, folder: c.folder, file: c.file, clipDur: c.duration, idx: i, start: r.start, end: r.end, period: ex && Number.isFinite(Number(r.period)) && Number(r.period) > 0 ? r3(Number(r.period)) : null, reps: ex && Number.isFinite(Number(r.reps)) && Number(r.reps) > 0 ? r3(Number(r.reps)) : null,
      kind: r.kind, group: g, guess: { name: '', entryId: null, confidence: 0, view: 'other' }, stripFile: null, previewFile: null, strip: null, preview: null, crop: r.crop ? r.crop.map((v) => Math.round(v)) : [c.width, c.height, 0, 0], score: ex ? 0.5 : 0,
      why: typeof r.why === 'string' && r.why.trim() ? r.why.trim().slice(0, 160) : 'Cut by hand from the footage.', hold: null, warn, parts: null, state: 'ready', loop: null, poster: null, cost: null, error: null, updatedAt: stamp });
  });
  for (const d of docs) {
    const base = path.join(stripDir, d.id);
    const r = spawnSync('node', [path.join(HERE, 'strip.mjs'), full, '--start', String(d.start), '--end', String(d.end), '--out', base], { encoding: 'utf8', maxBuffer: 1 << 26 });
    const sf = `${base}-strip.jpg`, pf = `${base}-preview.mp4`; const ok = (f) => fs.existsSync(f) && fs.statSync(f).size > 0;
    if (r.status === 0 && ok(sf)) d.stripFile = sf; if (r.status === 0 && ok(pf)) d.previewFile = pf;
    if (!d.stripFile || !d.previewFile) noPicture.push(d.id);
  }
  result.push(...docs); out.push({ clipId: c.id, file: c.file, dropped: old.length, written: docs.map((d) => ({ id: d.id, kind: d.kind, start: d.start, end: d.end })) });
}
const order = new Map(clips.map((c, i) => [c.id, i]));
result.sort((x, y) => ((order.get(x.clipId) ?? 1e9) - (order.get(y.clipId) ?? 1e9)) || String(x.clipId).localeCompare(String(y.clipId)) || (x.idx - y.idx));
const tmp = `${segsFile}.tmp`; fs.writeFileSync(tmp, `${JSON.stringify(result, null, 1)}\n`); fs.renameSync(tmp, segsFile); fs.writeFileSync(idsFile, `${JSON.stringify(highest)}\n`);
process.stdout.write(`${JSON.stringify({ clips: out, noPicture, segs: segsFile })}\n`);
