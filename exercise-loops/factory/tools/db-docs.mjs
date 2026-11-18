#!/usr/bin/env node
// db-docs.mjs: get the scan onto the board. Three small jobs between segs.json and the board's database (collection "segs").
//
// Usage:
//   node db-docs.mjs <workDir> --uploads
//       lists the strips and previews that still have to be uploaded as artifact assets, in groups of 25 (one Artifact call each):
//       { groups: [[file, ...], ...], files, alreadyUploaded }. A picture counts as uploaded while its size and time are the ones noted.
//   node db-docs.mjs <workDir> --assets <map.json>
//       notes the asset ids an upload gave back. map.json: { "<file path or file name>": "<asset id>", ... }, written from the
//       Artifact tool's result. They are kept in <workDir>/assets.json and put into segs.json as strip / preview.
//   node db-docs.mjs <workDir> --clear-export <dbExportDir>
//       EMPTIES an export folder before a new export: deletes the .json files in <dbExportDir>/items and <dbExportDir>/segs (nothing else).
//       ArtifactData only writes the documents that exist now, so a file left from an earlier export (a control.queue.json, a segs
//       document deleted since) would be read as current. Prints { cleared: { items, segs } }.
//   node db-docs.mjs <workDir> [<dbExportDir>] [--out <dir>] [--stale-ok]
//       writes what has to go to the database: <out>/docs/<segId>.json (one document each, default <workDir>/db) and
//       <out>/writes-01.json, -02 ...: the `writes` of one ArtifactData "batch" call each, at most 50 entries, by file_path.
//       <dbExportDir> is collection "segs" as ArtifactData saves it with out_dir (<dir>/segs/<segId>.json = { id, data, version,
//       updatedAt }). With it: a document that is already the same is left out, one that exists is UPDATED (pinned to its version)
//       with the fields the scan owns, and one that is on the board but no longer in segs.json for a clip that was scanned again is
//       deleted, EXCEPT a document that has a loop or is in state generating, review or done: that one is never deleted (work and
//       money hang on it), it is listed under keptWithLoop for the owner. Without <dbExportDir> every document is a new "set" (right for
//       an empty board only). An export whose files were written more than 30 minutes apart is refused (some are left from an earlier
//       export: --clear-export, export again; --stale-ok overrides).
//
// What a document holds (the contract with the board page):
//   { clipId, folder, file, clipDur, idx, start, end, period, reps, kind, group, guess: { name, entryId, confidence, view },
//     strip, preview, state, loop, poster, cost, error, score, why, hold, warn, updatedAt }
//   An update of an existing document leaves state, loop, poster, cost and error alone (the runner writes those with result-doc.mjs),
//   unless segs.json is newer than the board for that document AND the board's document has no loop, no cost and no render state
//   (generating, review, done, failed): those are never overwritten from segs.json. Without <dbExportDir> the tool refuses to run
//   (it would write every document whole) unless --empty-board says the board has no stretches yet.
// Prints ONE line of JSON: { set, update, delete, same, keptWithLoop: [{ segId, name, state, loop }], batches: [files], withoutPicture, docs }.
import fs from 'node:fs'; import path from 'node:path';
import { args, fail, exportSpread } from './_lib.mjs';
const USAGE = 'usage: node db-docs.mjs <workDir> --uploads | --assets <map.json> | --clear-export <dbExportDir> | [<dbExportDir>] [--out <dir>] [--stale-ok]';
const a = args(process.argv.slice(2), ['uploads', 'stale-ok', 'empty-board']); const [workDir, dbDir] = a._; if (!workDir) fail('db-docs.mjs: a work folder is needed', USAGE);
if (a['clear-export']) { const d = path.resolve(String(a['clear-export'])); if (d === path.resolve(workDir) || d === path.resolve('/') || fs.existsSync(path.join(d, 'segs.json'))) fail(`db-docs.mjs: ${d} is the work folder or a folder that holds segs.json, not an export folder: nothing deleted`, USAGE);
  const cleared = {}; for (const c of ['items', 'segs', 'srcs']) { const dir = path.join(d, c); let n = 0; if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir)) if (f.endsWith('.json')) { fs.unlinkSync(path.join(dir, f)); n++; } cleared[c] = n; }
  process.stdout.write(`${JSON.stringify({ cleared, folder: d })}\n`); process.exit(0); }
const segsFile = path.join(workDir, 'segs.json'); if (!fs.existsSync(segsFile)) fail(`db-docs.mjs: no segs.json in ${workDir}`);
const segs = JSON.parse(fs.readFileSync(segsFile, 'utf8')); const assetsFile = path.join(workDir, 'assets.json'); let assets = {}; if (fs.existsSync(assetsFile)) { try { assets = JSON.parse(fs.readFileSync(assetsFile, 'utf8')) || {}; } catch { assets = {}; } }
const stat = (f) => { try { const st = fs.statSync(f); return { bytes: st.size, mtimeMs: Math.round(st.mtimeMs) }; } catch { return null; } };
const fresh = (f) => { const st = f && stat(f); const n = f && assets[path.basename(f)]; return !!(st && n && n.id && n.bytes === st.bytes && n.mtimeMs === st.mtimeMs); }; // uploaded, and not made again since
const files = segs.flatMap((s) => [s.stripFile, s.previewFile]).filter((f) => f && fs.existsSync(f));

if (a.uploads) { const need = files.filter((f) => !fresh(f)); const groups = []; for (let i = 0; i < need.length; i += 25) groups.push(need.slice(i, i + 25));
  process.stdout.write(`${JSON.stringify({ groups, files: need.length, alreadyUploaded: files.length - need.length })}\n`); process.exit(0); }

if (a.assets) { if (!fs.existsSync(String(a.assets))) fail(`db-docs.mjs: no such file: ${a.assets}`); const map = JSON.parse(fs.readFileSync(String(a.assets), 'utf8')); let noted = 0, unknown = [];
  for (const [k, id] of Object.entries(map)) { const base = path.basename(k); const f = files.find((x) => path.basename(x) === base); if (!f || typeof id !== 'string' || !id) { unknown.push(k); continue; } assets[base] = { id, ...stat(f) }; noted++; }
  let changed = 0; const nowIso = new Date().toISOString(); for (const s of segs) { const st = s.stripFile && fresh(s.stripFile) ? assets[path.basename(s.stripFile)].id : null, pv = s.previewFile && fresh(s.previewFile) ? assets[path.basename(s.previewFile)].id : null; if ((st && s.strip !== st) || (pv && s.preview !== pv)) { if (st) s.strip = st; if (pv) s.preview = pv; s.updatedAt = nowIso; changed++; } }
  fs.writeFileSync(assetsFile, `${JSON.stringify(assets, null, 1)}\n`); const tmp = `${segsFile}.tmp`; fs.writeFileSync(tmp, `${JSON.stringify(segs, null, 1)}\n`); fs.renameSync(tmp, segsFile);
  process.stdout.write(`${JSON.stringify({ noted, unknown, documentsChanged: changed, stillToUpload: files.filter((f) => !fresh(f)).length })}\n`); process.exit(0); }

// ---- the documents and the writes
const outDir = path.resolve(String(a.out || path.join(workDir, 'db'))); const docsDir = path.join(outDir, 'docs'); fs.mkdirSync(docsDir, { recursive: true }); for (const f of fs.readdirSync(outDir)) if (/^writes-\d+\.json$/.test(f)) fs.unlinkSync(path.join(outDir, f));
const SCAN = ['clipId', 'folder', 'file', 'clipDur', 'idx', 'start', 'end', 'period', 'reps', 'kind', 'group', 'guess', 'strip', 'preview', 'score', 'why', 'hold', 'warn'], RUN = ['state', 'loop', 'poster', 'cost', 'error'];
const docOf = (s) => { const d = {}; for (const k of SCAN) d[k] = s[k] === undefined ? null : s[k]; d.guess = { name: '', entryId: null, confidence: 0, view: 'other', ...(s.guess || {}) }; d.strip = s.strip || (s.stripFile && fresh(s.stripFile) ? assets[path.basename(s.stripFile)].id : null); d.preview = s.preview || (s.previewFile && fresh(s.previewFile) ? assets[path.basename(s.previewFile)].id : null);
  d.warn = Array.isArray(s.warn) ? s.warn.slice(0, 4) : []; d.hold = Array.isArray(s.hold) ? s.hold : null; d.why = typeof s.why === 'string' ? s.why : ''; d.state = s.state || 'ready'; for (const k of RUN.slice(1)) d[k] = s[k] === undefined ? null : s[k]; d.updatedAt = s.updatedAt || new Date().toISOString(); return d; };
if (!dbDir && !a['empty-board']) fail('db-docs.mjs: give the board\'s "segs" export (<dbExportDir>): without it every document would be written whole and could wipe loops and costs already on the board. For a board with no stretches at all, pass --empty-board', USAGE);
const board = new Map(); if (dbDir) { const dir = path.join(dbDir, 'segs'); const sp = exportSpread(dir); if (sp.minutes > 30 && !a['stale-ok']) fail(`db-docs.mjs: the files in ${dir} were written ${Math.round(sp.minutes)} minutes apart (oldest ${sp.oldestFile}): some are left from an earlier export and would be read as current. Empty the folder (node db-docs.mjs <workDir> --clear-export ${dbDir}) and export collection "segs" again (--stale-ok overrides)`); if (!fs.existsSync(dir)) fail(`db-docs.mjs: ${dir} is not there: export collection "segs" with ArtifactData (action list, out_dir ${dbDir}); for an empty board leave <dbExportDir> out`); for (const f of fs.readdirSync(dir)) if (f.endsWith('.json')) { try { const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); board.set(String(j.id ?? f.replace(/\.json$/, '')), j); } catch { /* an unreadable export file is treated as not there */ } } }
// A board document with a loop, a cost, or a render under way or done keeps its state, loop, poster, cost and error whatever segs.json
// says: a fresh work folder (a new session) knows nothing of the renders, and its "ready" must never wipe them.
const guarded = (c) => !!(c && (c.loop || Number(c.cost) > 0)) || ['generating', 'review', 'done', 'failed'].includes(c && c.state);
const same = (x, y) => JSON.stringify(x) === JSON.stringify(y); const time = (v) => { const t = Date.parse(String(v || '')); return Number.isFinite(t) ? t : 0; };
const writes = []; let nSet = 0, nUpd = 0, nDel = 0, nSame = 0; const noPic = [];
for (const s of segs) { const d = docOf(s); if (!d.strip || !d.preview) noPic.push(s.id); const old = board.get(s.id); const file = path.join(docsDir, `${s.id}.json`);
  if (!old) { fs.writeFileSync(file, JSON.stringify(d, null, 1)); writes.push({ op: 'set', collection: 'segs', doc_id: s.id, file_path: file }); nSet++; continue; }
  const cur = old.data || {}; const part = {}; const keys = !guarded(cur) && time(d.updatedAt) > Math.max(time(cur.updatedAt), time(old.updatedAt)) ? [...SCAN, ...RUN] : SCAN; for (const k of keys) if (!same(d[k], cur[k] === undefined ? null : cur[k])) part[k] = d[k];
  if (!Object.keys(part).length) { nSame++; continue; } part.updatedAt = new Date(Math.max(Date.now(), time(cur.updatedAt) + 1, time(d.updatedAt))).toISOString(); // never older than what is on the board or in segs.json
  fs.writeFileSync(file, JSON.stringify(part, null, 1)); writes.push({ op: 'update', collection: 'segs', doc_id: s.id, file_path: file, ...(Number.isInteger(old.version) ? { if_version: old.version } : {}) }); nUpd++; }
const mine = new Set(segs.map((s) => s.id)), clipsHere = new Set(segs.map((s) => s.clipId));
const keptWithLoop = []; const hasLoop = (c) => !!(c && c.loop) || ['generating', 'review', 'done'].includes(c && c.state);
for (const [id, j] of board) if (!mine.has(id) && j.data && clipsHere.has(j.data.clipId)) { // a stretch a re-split did away with
  if (hasLoop(j.data)) { keptWithLoop.push({ segId: id, name: (j.data.guess && j.data.guess.name) || '', state: j.data.state || null, loop: j.data.loop || null, start: j.data.start ?? null, end: j.data.end ?? null, why: 'no stretch of the new scan covers it, but it has a loop or a render: it stays on the board; the owner decides' }); continue; }
  writes.push({ op: 'delete', collection: 'segs', doc_id: id, ...(Number.isInteger(j.version) ? { if_version: j.version } : {}) }); nDel++; }
const batches = []; for (let i = 0; i < writes.length; i += 50) { const f = path.join(outDir, `writes-${String(batches.length + 1).padStart(2, '0')}.json`); fs.writeFileSync(f, JSON.stringify(writes.slice(i, i + 50), null, 1)); batches.push(f); }
process.stdout.write(`${JSON.stringify({ set: nSet, update: nUpd, delete: nDel, same: nSame, keptWithLoop, batches, withoutPicture: noPic.length, docs: docsDir })}\n`);
