#!/usr/bin/env node
// scan.mjs: go through a folder of raw footage and list every stretch found in it, ready for the board.
//
// Usage:
//   node scan.mjs <rawRoot> <workDir> [--only <text in the path>] [--force] [--no-join] [--prune] [--min-junk 1] [--jobs 3]
//
// What it does, in order:
//   1. ingest.mjs <rawRoot> <workDir>      -> <workDir>/clips.json and a small proxy of every video
//   2. split2.mjs on every NEW clip        -> <workDir>/split/<clipId>.json (the splitter's own output, with its full "why" for each stretch).
//      split2.mjs is split.mjs, plus a second opinion from split-alt.mjs for a video in which split.mjs found no exercise at all, and to
//      join the pieces of an exercise done on alternating sides. Heavy footage (more pixels a second than 1080p at 31 fps: 4K, 60 fps) is
//      split from ingest's proxy instead of the original (split2.mjs --proxy), because decoding it a second time is nearly all of the cost.
//      Its strips and previews are cut from the proxy as well.
//   3. strip.mjs for every stretch of it   -> <workDir>/strips/<segId>-strip.jpg and <segId>-preview.mp4, exercise AND junk
//   4. <workDir>/segs.json                 a JSON array, one document per stretch, sorted by folder, file and time:
//        { id: "<clipId>-<nn>", clipId, folder, file, clipDur, idx, start, end, period, reps, kind: "exercise" | "junk", group,
//          guess: { name: "", entryId: null, confidence: 0, view: "other" }, stripFile, previewFile, strip: null, preview: null,
//          crop: [w,h,x,y], score, why, hold, warn, parts, state: "ready", loop: null, poster: null, cost: null, error: null, updatedAt }
//        idx    the stretch's number in the splitter's result (split/<clipId>.json), counted from 0 in the order of the video. It only
//               gives the order: junk shorter than --min-junk seconds is left out, so idx can skip numbers.
//        nn     the stretch's own number, two digits. On the first scan nn = idx. It is never used twice for different stretches of one
//               clip: after a re-split (--force) a new stretch that covers an old one (they share more than 60 % of the longer of the
//               two) keeps the old id, and with it the name, the state, the loop and whatever the owner chose for it on the board. A
//               new stretch that swallows old ones (pieces now joined: it holds 80 % or more of an old stretch of the same kind)
//               takes the id of the one that has a loop (or is generating, in review or done), else of the one it shares most with. Any other new stretch gets the next number after the highest ever used
//               for that clip (kept in <workDir>/segids.json). An old stretch nothing took over is dropped from segs.json; when it
//               had a loop (or was generating, in review or done) its line says so, it is noted in <workDir>/lost-loops.json, and
//               db-docs.mjs leaves its document on the board (keptWithLoop).
//        start/end are seconds of the video; crop is in pixels of the picture as shown (after the phone's rotation); group is the
//               splitter's number, the same for stretches of the same movement inside ONE video (junk: 0).
//        why    one short plain sentence from the splitter ("Repeats every 1.8 s, 3.8 reps", "The picture holds still for 20 s: a rest,
//               or a hold exercise"); hold = [fromSeconds, toSeconds] of a still stretch of 4 s or more that may be a HOLD exercise
//               (plank, hang), else null; warn = up to four plain warnings for the owner ("The camera moved", "Very dark",
//               "Flickering light", "Someone else may be moving in the picture", "The crop may cut off part of the body",
//               "Only one or two reps here").
//        parts  [[from, to], ...] when the splitter JOINED this stretch from pieces (an exercise on alternating sides), else null.
//               Such a stretch warns "Joined from N pieces: check it is one exercise" and scores 0.6 at most. If the pieces are
//               different exercises: scan.mjs <rawRoot> <workDir> --only <file> --force --no-join gives them back as found.
//               (parts stays in segs.json; it is not one of the board's fields.)
//        stripFile and previewFile are full paths (null if the picture could not be made); strip and preview are for the asset ids the
//               runner gets when it uploads them (db-docs.mjs fills them in).
//        updatedAt  ISO time of the last time scan.mjs wrote or rewrote the document. Always there.
//
// A second run only handles what is new: a clip that already has its documents in segs.json is not split again and its documents
// are kept as they are, names (guess) and state included. A clip whose split failed has no documents and is tried again next time.
// A video that was moved or renamed keeps its id (ingest.mjs goes by its content): its documents get the new folder and file, nothing else changes.
//   --force   split and strip every clip again (or only those of --only). Ids are kept as described under nn.
//   --no-join passed on to split2.mjs: pieces the splitter would join into one alternating-side exercise stay apart. Use it with
//             --force --only <file> to undo a wrong join in one video.
//   --prune   drop the documents of clips that are no longer in <rawRoot> (by default they are kept and counted in the last line)
//   --only    passed on to ingest.mjs: scan only the paths that contain this text
//   --min-junk  junk shorter than this many seconds gets no document and no pictures (default 1). The splitter trims every bout to
//             whole reps, which leaves slivers of 0.03-0.8 s at the ends of a clip and between two bouts; nothing the splitter could
//             have found fits in under a second, so there is nothing in them for the owner to rescue. --min-junk 0 keeps them all.
//   --jobs    how many strips are made at the same time (default 3)
//
// Prints one line per clip on stdout, then one line of JSON:
//   { clips, scanned, skipped, moved, failed: [{ rel, error }], segments, exercise, junk, exerciseSeconds, named, joined, lostLoops, orphans, segs }
// Progress goes to stderr. Exit code 1 only when ingest.mjs itself fails or a folder is missing; a clip that fails is reported, never fatal.
import fs from 'node:fs'; import path from 'node:path'; import { spawn, spawnSync } from 'node:child_process';
import { args, fail } from './_lib.mjs';

const HERE = path.dirname(fs.realpathSync(new URL(import.meta.url).pathname));
const USAGE = 'usage: node scan.mjs <rawRoot> <workDir> [--only <text in the path>] [--force] [--no-join] [--prune] [--min-junk 1] [--jobs 3]';
const a = args(process.argv.slice(2), ['force', 'prune', 'no-join']); const [rawRoot, workDirArg] = a._;
if (!rawRoot || !workDirArg) fail('scan.mjs: a raw folder and a work folder are needed', USAGE);
if (!fs.existsSync(rawRoot) || !fs.statSync(rawRoot).isDirectory()) fail(`scan.mjs: not a folder: ${rawRoot}`);
const root = path.resolve(rawRoot), workDir = path.resolve(workDirArg); const jobs = Math.max(1, Math.min(8, Number(a.jobs) || 3));
const minJunk = a['min-junk'] !== undefined ? Number(a['min-junk']) : 1; if (!(minJunk >= 0)) fail('scan.mjs: --min-junk is a number of seconds', USAGE);
const splitDir = path.join(workDir, 'split'), stripDir = path.join(workDir, 'strips'); for (const d of [workDir, splitDir, stripDir]) fs.mkdirSync(d, { recursive: true });
const segsFile = path.join(workDir, 'segs.json'), idsFile = path.join(workDir, 'segids.json'); const say = (s) => process.stderr.write(`${s}\n`);
const r3 = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null);
const lastLine = (t) => String(t || '').trim().split('\n').pop().slice(0, 300);
const HEAVY = 1920 * 1080 * 31; // pixels a second above which the splitter reads ingest's proxy instead of the original
const SAME = 0.6;               // a re-split stretch is the old one when they share more than this of the longer of the two
const INSIDE = 0.8;             // ... or, failing that, when the new stretch holds this much of an old one of the same kind (pieces now joined)
const HAS_LOOP = (s) => !!s.loop || ['generating', 'review', 'done'].includes(s.state); // work or money hangs on this stretch
const now = () => new Date().toISOString();

// ---- 1. ingest
say(`scan: taking stock of ${root}`);
const ing = spawnSync('node', [path.join(HERE, 'ingest.mjs'), root, workDir, ...(a.only ? ['--only', String(a.only)] : [])], { encoding: 'utf8', maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'inherit'] });
if (ing.status !== 0) { say(`scan.mjs: ingest.mjs failed (exit ${ing.status})`); process.exit(1); }
let ingest = {}; try { ingest = JSON.parse(String(ing.stdout).trim().split('\n').pop()); } catch { /* the summary is only passed on */ }
for (const x of ingest.failed || []) console.log(`${x.rel}  FAILED: cannot be read as a video (${String(x.error).slice(0, 160)})`);
for (const x of ingest.duplicates || []) console.log(`${x.rel}  left out: the same video as ${x.sameAs}`);
const clips = JSON.parse(fs.readFileSync(path.join(workDir, 'clips.json'), 'utf8'));
fs.writeFileSync(path.join(workDir, 'scan.json'), `${JSON.stringify({ rawRoot: root, scannedAt: now() })}\n`); // queue-plan.mjs finds the videos through this

// ---- segs.json so far, and the highest stretch number ever used for each clip
let before = []; if (fs.existsSync(segsFile)) { try { before = JSON.parse(fs.readFileSync(segsFile, 'utf8')); if (!Array.isArray(before)) before = Object.values(before); } catch (e) { fail(`scan.mjs: ${segsFile} is there but cannot be read (${e.message}); move it away or mend it first, it holds the names`); } }
const byClip = new Map(); for (const s of before) { if (!byClip.has(s.clipId)) byClip.set(s.clipId, []); byClip.get(s.clipId).push(s); }
let highest = {}; if (fs.existsSync(idsFile)) { try { highest = JSON.parse(fs.readFileSync(idsFile, 'utf8')) || {}; } catch { highest = {}; } }
const nnOf = (id) => { const m = /-(\d+)$/.exec(String(id)); return m ? Number(m[1]) : -1; };
for (const s of before) highest[s.clipId] = Math.max(highest[s.clipId] ?? -1, nnOf(s.id));
const order = new Map(clips.map((c, i) => [c.id, i]));
const save = () => {
  const list = [...byClip.values()].flat().sort((x, y) => ((order.get(x.clipId) ?? 1e9) - (order.get(y.clipId) ?? 1e9)) || String(x.clipId).localeCompare(String(y.clipId)) || (x.idx - y.idx));
  const tmp = `${segsFile}.tmp`; fs.writeFileSync(tmp, `${JSON.stringify(list, null, 1)}\n`); fs.renameSync(tmp, segsFile); fs.writeFileSync(idsFile, `${JSON.stringify(highest)}\n`); return list;
};

// ---- helpers
const runAsync = (cmd, argv) => new Promise((resolve) => { const ch = spawn(cmd, argv, { stdio: ['ignore', 'pipe', 'pipe'] }); let out = '', err = ''; ch.stdout.on('data', (d) => { out += d; }); ch.stderr.on('data', (d) => { err += d; }); ch.on('error', (e) => resolve({ status: -1, out, err: String(e.message) })); ch.on('close', (status) => resolve({ status, out, err })); });
async function pool(items, n, work) { let next = 0; const runners = Array.from({ length: Math.min(n, items.length) }, async () => { while (next < items.length) { const i = next++; await work(items[i], i); } }); await Promise.all(runners); }
const overlap = (x, y) => Math.max(0, Math.min(x.end, y.end) - Math.max(x.start, y.start));
const named = (s) => s && s.guess && typeof s.guess.name === 'string' && s.guess.name.trim() !== '';
const fmt = (v) => v.toFixed(1);
const plain = (s) => { const t = typeof s.say === 'string' && s.say.trim() ? s.say.trim() : String(s.why || '').split(/[;(]/)[0].trim(); return t ? (t.charAt(0).toUpperCase() + t.slice(1)).slice(0, 160) : ''; };

// ---- 2-4. every clip
const failed = []; let scanned = 0, skipped = 0, movedDocs = 0, joinedAll = 0; const lines = [], lostAll = [];
for (let ci = 0; ci < clips.length; ci++) {
  const c = clips[ci]; const full = path.join(root, c.rel); const tag = `[${ci + 1}/${clips.length}] ${c.rel}`; const old = byClip.get(c.id) || [];
  const head = `${c.rel}  ${fmt(c.duration)} s  ${c.width}x${c.height}`;
  // a video that was moved or renamed: its documents follow it. A document without updatedAt (written by the first version) gets one.
  let touched = false; for (const o of old) { if (o.folder !== c.folder || o.file !== c.file) { o.folder = c.folder; o.file = c.file; o.updatedAt = now(); touched = true; movedDocs++; } if (!o.updatedAt) { o.updatedAt = now(); touched = true; } } if (touched) save();
  if (a.only && !c.rel.includes(String(a.only))) continue; // --only: the other clips are left exactly as they are
  const count = (list) => { const ex = list.filter((s) => s.kind === 'exercise'); return { ex, junk: list.length - ex.length, groups: new Set(ex.map((s) => s.group)).size, secs: ex.reduce((t, s) => t + (s.end - s.start), 0), names: ex.filter(named).length }; };
  if (old.length && !a.force) { const k = count(old); skipped++; const line = `${head}  already scanned: ${k.ex.length} exercise in ${k.groups} group(s), ${k.junk} junk, ${k.names} named`; lines.push(line); console.log(line); continue; }
  if (!fs.existsSync(full)) { failed.push({ rel: c.rel, error: 'the file is gone' }); const line = `${head}  FAILED: the file is gone`; lines.push(line); console.log(line); continue; }
  // split
  const heavy = c.width * c.height * (c.fps || 30) > HEAVY; const proxy = c.proxy ? path.join(workDir, c.proxy) : null; const useProxy = heavy && proxy && fs.existsSync(proxy);
  say(`${tag}: splitting${useProxy ? ' (from the proxy: heavy footage)' : ''}`); const t0 = Date.now(); const splitFile = path.join(splitDir, `${c.id}.json`); if (fs.existsSync(splitFile)) fs.unlinkSync(splitFile);
  const sp = spawnSync('node', [path.join(HERE, 'split2.mjs'), full, '--out', splitFile, ...(useProxy ? ['--proxy', proxy] : []), ...(a['no-join'] ? ['--no-join'] : [])], { encoding: 'utf8', maxBuffer: 1 << 26, timeout: Math.max(300000, c.duration * 6000) });
  let split = null, why = null;
  if (sp.error) why = sp.error.code === 'ETIMEDOUT' ? 'the splitter timed out' : String(sp.error.message); else if (sp.status !== 0) why = `the splitter stopped (exit ${sp.status}): ${lastLine(sp.stderr)}`;
  if (!why) { try { split = JSON.parse(fs.readFileSync(splitFile, 'utf8')); if (!Array.isArray(split.segments) || !split.segments.length) throw new Error('no segments in it'); } catch (e) { why = `the splitter wrote no readable result (${e.message})`; } }
  if (why) { failed.push({ rel: c.rel, error: why }); const line = `${head}  FAILED: ${why}`; lines.push(line); console.log(line); continue; }
  const splitS = (Date.now() - t0) / 1000; const stamp = now();
  // documents (the id is given below)
  const every = split.segments.map((s, i) => { const ex = s.kind === 'exercise';
    return { id: null, clipId: c.id, folder: c.folder, file: c.file, clipDur: c.duration, idx: i, start: r3(s.start), end: r3(s.end), period: ex ? r3(s.period) : null, reps: ex ? r3(s.reps) : null, kind: ex ? 'exercise' : 'junk', group: Number.isInteger(s.group) ? s.group : 0,
      guess: { name: '', entryId: null, confidence: 0, view: 'other' }, stripFile: null, previewFile: null, strip: null, preview: null, crop: Array.isArray(s.crop) && s.crop.length === 4 ? s.crop.map((v) => Math.round(v)) : [c.width, c.height, 0, 0], score: ex ? r3(s.score) ?? 0 : 0,
      why: plain(s), hold: !ex && Array.isArray(s.hold) && s.hold.length === 2 && s.hold[1] - s.hold[0] >= 4 ? [r3(s.hold[0]), r3(s.hold[1])] : null, warn: Array.isArray(s.warn) ? s.warn.filter((w) => typeof w === 'string').slice(0, 4) : [], parts: ex && Array.isArray(s.parts) && s.parts.length > 1 ? s.parts.map((q) => [r3(q[0]), r3(q[1])]) : null,
      state: 'ready', loop: null, poster: null, cost: null, error: null, updatedAt: stamp }; });
  const docs = every.filter((d) => d.kind === 'exercise' || d.end - d.start >= minJunk); const slivers = every.length - docs.length;
  // ids: a stretch that covers an old one keeps its id and what hangs on it; the others get numbers never used for this clip
  let kept = 0, carried = 0; const usedOld = new Set();
  const give = (isSame, loopFirst = false) => { const pairs = []; for (const d of docs) { if (d.id) continue; for (const o of old) { if (usedOld.has(o.id)) continue; const ov = overlap(o, d); if (isSame(o, d, ov)) pairs.push({ d, o, ov }); } }
    pairs.sort((p, q) => (loopFirst ? Number(HAS_LOOP(q.o)) - Number(HAS_LOOP(p.o)) : 0) || q.ov - p.ov);
    for (const { d, o } of pairs) { if (d.id || usedOld.has(o.id)) continue; usedOld.add(o.id); d.id = o.id; kept++; if (named(o)) { d.guess = { ...o.guess }; carried++; }
      for (const k of ['state', 'loop', 'poster', 'cost', 'error']) if (o[k] !== undefined) d[k] = o[k]; } };
  give((o, d, ov) => ov > SAME * Math.max(o.end - o.start, d.end - d.start));                 // the same stretch
  give((o, d, ov) => o.kind === d.kind && ov >= INSIDE * (o.end - o.start) && ov > 0, true); // pieces now joined: the new stretch holds the old one; of several, the one with a loop (or a render) lends its id first, so that work is not left behind
  const lost = old.filter((o) => !usedOld.has(o.id) && HAS_LOOP(o)); // old stretches with a loop that no new stretch took over
  let next = (highest[c.id] ?? -1) + 1; const firstScan = !old.length && highest[c.id] === undefined;
  for (const d of docs) { if (d.id) continue; const nn = firstScan ? d.idx : next++; d.id = `${c.id}-${String(nn).padStart(2, '0')}`; highest[c.id] = Math.max(highest[c.id] ?? -1, nn); }
  // strips: the old pictures of this clip go first, so nothing stale is left under a kept id
  for (const o of old) for (const f of [o.stripFile, o.previewFile]) if (f && f.startsWith(stripDir + path.sep) && fs.existsSync(f)) fs.unlinkSync(f);
  const t1 = Date.now(); let stripFails = 0;
  await pool(docs, jobs, async (d) => { const base = path.join(stripDir, d.id);
    const r = await runAsync('node', [path.join(HERE, 'strip.mjs'), useProxy ? proxy : full, '--start', String(d.start), '--end', String(d.end), '--out', base]); // heavy footage: the pictures are cut from the proxy too (same clock, upright, 480 px: enough for a 160 px strip and a 320 px preview)
    const sf = `${base}-strip.jpg`, pf = `${base}-preview.mp4`; const ok = (f) => fs.existsSync(f) && fs.statSync(f).size > 0;
    if (r.status === 0 && ok(sf)) d.stripFile = sf; if (r.status === 0 && ok(pf)) d.previewFile = pf;
    if (!d.stripFile || !d.previewFile) { stripFails++; say(`${tag}: no picture for ${d.id} (${d.start}-${d.end} s): ${lastLine(r.err) || 'strip.mjs wrote nothing'}`); } });
  const stripS = (Date.now() - t1) / 1000;
  byClip.set(c.id, docs); save(); scanned++; joinedAll += docs.filter((d) => d.parts).length;
  if (lost.length) { const lf = path.join(workDir, 'lost-loops.json'); let all = []; if (fs.existsSync(lf)) { try { all = JSON.parse(fs.readFileSync(lf, 'utf8')) || []; } catch { all = []; } }
    for (const o of lost) { all = all.filter((x) => x.id !== o.id); all.push({ id: o.id, name: (o.guess && o.guess.name) || '', rel: c.rel, start: o.start, end: o.end, state: o.state, loop: o.loop ?? null, poster: o.poster ?? null, cost: o.cost ?? null, lostAt: stamp }); lostAll.push(o.id); }
    fs.writeFileSync(lf, `${JSON.stringify(all, null, 1)}\n`); }
  const k = count(docs); const warned = docs.filter((d) => d.kind === 'exercise' && d.warn.length).length, holds = docs.filter((d) => d.hold).length;
  const line = `${head}  ${k.ex.length} exercise in ${k.groups} group(s) (${fmt(k.secs)} s), ${k.junk} junk${slivers ? ` (+${slivers} under ${minJunk} s left out)` : ''}${warned ? `, ${warned} with a warning` : ''}${holds ? `, ${holds} still stretch(es) that may be a hold` : ''}${old.length ? `, ${kept} id(s) kept, ${docs.length - kept} new` : ''}${carried ? `, ${carried} name(s) kept` : ''}${stripFails ? `, ${stripFails} WITHOUT a picture` : ''}${split.by === 'split-alt' ? ', found only by the second splitter (low score)' : ''}${docs.some((d) => d.parts) ? `, ${docs.filter((d) => d.parts).length} exercise(s) joined from pieces (${docs.filter((d) => d.parts).map((d) => `${d.id} ${fmt(d.start)}-${fmt(d.end)} s from ${d.parts.length}`).join('; ')}): CHECK each is one exercise, --force --only <file> --no-join undoes it` : ''}${a['no-join'] ? ', nothing joined (--no-join)' : ''}${lost.length ? `, ${lost.length} stretch(es) with a loop NO LONGER FOUND (${lost.map((o) => `${o.id}${named(o) ? ` "${o.guess.name}"` : ''} ${fmt(o.start)}-${fmt(o.end)} s, ${o.state}`).join('; ')}): kept on the board by db-docs.mjs, noted in lost-loops.json` : ''}  [split ${fmt(splitS)} s = ${(splitS / c.duration).toFixed(2)} x${useProxy ? ' from the proxy' : ''}, strips ${fmt(stripS)} s]`;
  lines.push(line); console.log(line);
}

// ---- clips that are no longer in the raw folder
const here = new Set(clips.map((c) => c.id)); const orphanIds = [...byClip.keys()].filter((id) => !here.has(id)); let orphans = 0;
// with --only, ingest.mjs keeps the other clips in clips.json, so an id missing from it really is gone from the raw folder
for (const id of orphanIds) { const list = byClip.get(id); orphans += list.length; if (a.prune) { for (const o of list) for (const f of [o.stripFile, o.previewFile]) if (f && f.startsWith(stripDir + path.sep) && fs.existsSync(f)) fs.unlinkSync(f); byClip.delete(id); } }
if (orphans) say(a.prune ? `scan: dropped ${orphans} stretch(es) of ${orphanIds.length} video(s) that are no longer in the raw folder` : `scan: ${orphans} stretch(es) of ${orphanIds.length} video(s) that are no longer in the raw folder were kept (--prune drops them)`);
const all = save(); const ex = all.filter((s) => s.kind === 'exercise');
process.stdout.write(`${JSON.stringify({ clips: clips.length, scanned, skipped, moved: (ingest.moved || []).length, movedDocs, failed: [...(ingest.failed || []), ...failed], segments: all.length, exercise: ex.length, junk: all.length - ex.length, exerciseSeconds: +ex.reduce((t, s) => t + (s.end - s.start), 0).toFixed(1), named: ex.filter(named).length, warned: ex.filter((s) => (s.warn || []).length).length, holds: all.filter((s) => s.hold).length, joined: all.filter((s) => s.parts).length, lostLoops: lostAll, orphans: a.prune ? 0 : orphans, segs: segsFile })}\n`);
