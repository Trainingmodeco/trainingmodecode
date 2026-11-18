#!/usr/bin/env node
// result-doc.mjs: the fields to write back to a stretch's document (collection "segs") when its job starts, ends or fails.
//
// Usage:
//   node result-doc.mjs <segId> --state generating|review|failed|back|done|ready [--loop <asset id>] [--poster <asset id>] [--cost <credits>]
//                       [--error <text>] [--version <n>] [--db <dbExportDir>] [--work <workDir>]
//
//   --state    generating  the render is about to be submitted. loop, poster and cost are NOT touched (a redo keeps the old loop on the board
//                          until the new one is there; credits already spent stay in the document); the error is cleared.
//              review      the loop is made and uploaded: --loop and --poster (asset ids) are needed, --cost is what the job cost
//                          (the document's cost is left alone when --cost is not given)
//              failed      it could not be made: --error says why in plain words (--cost if credits were spent all the same). An old loop
//                          (a failed redo) stays.
//              back        a run died or stopped on a stretch left in generating: it goes back to what it was: review when it has a loop,
//                          else ready. The error is cleared, loop, poster and cost stay.
//              done / ready  set by hand only: done = the owner approved it elsewhere (keeps the loop that is there), ready = back to the
//                          start (loop, poster, cost and error are cleared)
//   --version  the version to pin the printed write to (if_version). Take it from the result of your LAST write to this document: the
//              export's version is only right for the first write after the export (generating). Without --version a write after that
//              first one prints no if_version and says so.
//   --db       the database export folder: the owner's document items/seg.<segId>.json is read for its updatedAt, and
//              segs/<segId>.json (if it was exported) for the loop and the version
//   --work     also write the same fields into <workDir>/segs.json, so the local list and the board agree
// The stretch must be known: in segs.json (--work) or in the export (--db), else the tool stops (exit 2). With neither given it cannot check.
//
// updatedAt is the LATER of now and one millisecond after the owner's last change to that stretch, so the board, which shows whichever
// of the two documents is newer, never takes an older choice of the owner's for news after this write.
//
// Prints ONE line of JSON on stdout: the fields to change: { state, error, updatedAt } and, where the state sets them, loop, poster, cost:
// the `data` of an ArtifactData "update" on collection "segs", doc_id <segId> (an update merges, so what is not in it stays).
// On stderr: the call in full.
import fs from 'node:fs'; import path from 'node:path';
import { args, fail } from './_lib.mjs';
const USAGE = 'usage: node result-doc.mjs <segId> --state generating|review|failed|back|done|ready [--loop <asset id>] [--poster <asset id>] [--cost <credits>] [--error <text>] [--version <n>] [--db <dbExportDir>] [--work <workDir>]';
const a = args(process.argv.slice(2)); const segId = a._[0]; const STATES = ['ready', 'generating', 'review', 'failed', 'back', 'done'];
if (!segId || !STATES.includes(a.state)) fail('result-doc.mjs: a stretch id and --state are needed', USAGE);
const str = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null); const loop = str(a.loop), poster = str(a.poster), error = str(a.error);
const cost = a.cost !== undefined && a.cost !== true && String(a.cost).trim() !== '' && Number.isFinite(Number(a.cost)) ? Number(a.cost) : null; if (a.cost !== undefined && cost === null) fail('result-doc.mjs: --cost is a number of credits', USAGE);
const pinned = a.version !== undefined ? Number(a.version) : null; if (a.version !== undefined && !(Number.isInteger(pinned) && pinned >= 0)) fail('result-doc.mjs: --version is the whole number a write of this document returned', USAGE);
if (a.state === 'review' && (!loop || !poster)) fail('result-doc.mjs: state review needs --loop and --poster (the asset ids of the uploaded loop and poster)', USAGE);
if (a.state === 'failed' && !error) fail('result-doc.mjs: state failed needs --error (why, in plain words)', USAGE);
const time = (v) => { const t = typeof v === 'number' ? v : Date.parse(String(v || '')); return Number.isFinite(t) ? t : 0; };
// the owner's last change, and what the export knows of the document
let ownerAt = 0, exportVersion = null, exportDoc = null, known = false;
if (a.db) {
  const f = path.join(String(a.db), 'items', `seg.${segId}.json`); if (fs.existsSync(f)) { known = true; try { const j = JSON.parse(fs.readFileSync(f, 'utf8')); ownerAt = Math.max(time(j.updatedAt), time(j.data && j.data.updatedAt)); } catch { /* no owner document that can be read: now is used */ } }
  const g = path.join(String(a.db), 'segs', `${segId}.json`); if (fs.existsSync(g)) { known = true; try { const j = JSON.parse(fs.readFileSync(g, 'utf8')); if (Number.isInteger(j.version)) exportVersion = j.version; exportDoc = j.data && typeof j.data === 'object' ? j.data : null; } catch { /* no pin */ } } }
let segs = null, s = null, segsFile = null;
if (a.work) { segsFile = path.join(String(a.work), 'segs.json'); if (!fs.existsSync(segsFile)) fail(`result-doc.mjs: no segs.json in ${a.work}`); segs = JSON.parse(fs.readFileSync(segsFile, 'utf8')); s = segs.find((x) => x.id === segId); if (!s) fail(`result-doc.mjs: ${segId} is not in ${segsFile}`); known = true; }
if (!known && (a.db || a.work)) fail(`result-doc.mjs: ${segId} is not known: no document for it in ${a.db}`);
if (!a.db && !a.work) process.stderr.write(`result-doc.mjs: warning: neither --db nor --work was given, so ${segId} could not be checked against segs.json or the export: a mistyped id would write a document that does not exist\n`);
const updatedAt = new Date(Math.max(Date.now(), ownerAt + 1)).toISOString();
const have = (k) => (s && s[k] !== undefined ? s[k] : exportDoc && exportDoc[k] !== undefined ? exportDoc[k] : null); // what the stretch has now
let data;
if (a.state === 'generating') data = { state: 'generating', error: null, updatedAt, ...(cost !== null ? { cost } : {}) };
else if (a.state === 'review') data = { state: 'review', loop, poster, error: null, updatedAt, ...(cost !== null ? { cost } : {}) };
else if (a.state === 'failed') data = { state: 'failed', error, updatedAt, ...(cost !== null ? { cost } : {}) };
else if (a.state === 'back') data = { state: have('loop') ? 'review' : 'ready', error: null, updatedAt, ...(cost !== null ? { cost } : {}) };
else if (a.state === 'done') data = { state: 'done', loop: loop || have('loop'), poster: poster || have('poster'), error: null, updatedAt, ...(cost !== null ? { cost } : {}) };
else data = { state: 'ready', loop: null, poster: null, cost, error: null, updatedAt };
if (segs) { Object.assign(s, data); const tmp = `${segsFile}.tmp`; fs.writeFileSync(tmp, `${JSON.stringify(segs, null, 1)}\n`); fs.renameSync(tmp, segsFile); }
const version = pinned !== null ? pinned : a.state === 'generating' ? exportVersion : null;
process.stderr.write(`ArtifactData ${JSON.stringify({ action: 'update', collection: 'segs', doc_id: segId, ...(version !== null ? { if_version: version } : {}), data })}\n${version !== null ? '' : `(no if_version: ${a.state === 'generating' ? 'export collection "segs" first, or read the document' : 'pass the version the last write to this document returned as --version, or read the document (action get)'}; never write an existing document without its version)\n`}`);
process.stdout.write(`${JSON.stringify(data)}\n`);
