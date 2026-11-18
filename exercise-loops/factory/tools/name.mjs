#!/usr/bin/env node
// name.mjs: write the names you gave by eye into <workDir>/segs.json (guess: { name, entryId, confidence, view }), so segs.json is never
// edited by hand. RUNBOOK A3.
//
// Usage:
//   node name.mjs <workDir> --template <out.json> [--all]
//        writes a skeleton to fill in: one row per exercise stretch that has no name yet (and per junk stretch that may be a hold; --all: every
//        stretch of the scan): { id, rel, start, end, kind, why, warn, hold, name: "", view: "other", confidence: 0.6 }. Delete the rows you do not name.
//   node name.mjs <workDir> <names.json> [--board <board.json>] [--dry]
//        names.json is any of:  { "<segId>": { "name": "...", "view": "side", "confidence": 0.9, "entryId": null } }
//                               [ { "id": "<segId>", "name": "...", "view": "...", "confidence": 0.9, "entryId": "..." }, ... ]
//                               [ [ "<segId>", "<name>", "<view>", <confidence> ], ... ]
//        view: front | side | back | other (the camera view; default other). confidence: 0.9 sure, 0.6 likely, 0.3 a guess (default 0.6).
//        entryId: the board entry this exercise belongs to, or null when the board has no entry of that name. Where it is not given and
//        --board is, it is looked up by name: the board's board.json, { entries: [{ id, name, kind }, ...] } (the file the board was built
//        from; the ids are entries[].id). The name matches ignoring letter case, punctuation and a plural s; when several entries carry
//        it the kind library wins, then quick, mission, program, new, then the first id. Without --board an entryId not given is null.
//        Only exercise stretches and junk stretches with a hold span (a still stretch that may be a plank or a hang) are named; any other id
//        is listed under skipped with its reason. Each named stretch gets updatedAt = now, so the board shows the new name.
// Prints ONE line of JSON: { named, skipped: [{ id, reason }], noEntry: [names the board has no entry of], unnamedExercises, segs }.
import fs from 'node:fs'; import path from 'node:path';
import { args, fail } from './_lib.mjs';
const USAGE = 'usage: node name.mjs <workDir> --template <out.json> [--all]\n       node name.mjs <workDir> <names.json> [--board <board.json>] [--dry]';
const a = args(process.argv.slice(2), ['all', 'dry']); const [workDir, namesFile] = a._; if (!workDir) fail('name.mjs: a work folder is needed', USAGE);
const segsFile = path.join(workDir, 'segs.json'); if (!fs.existsSync(segsFile)) fail(`name.mjs: no segs.json in ${workDir}`);
const segs = JSON.parse(fs.readFileSync(segsFile, 'utf8')); const clips = fs.existsSync(path.join(workDir, 'clips.json')) ? JSON.parse(fs.readFileSync(path.join(workDir, 'clips.json'), 'utf8')) : []; const relOf = new Map(clips.map((c) => [c.id, c.rel]));
const named = (s) => s.guess && typeof s.guess.name === 'string' && s.guess.name.trim() !== '';
if (a.template) {
  const rows = segs.filter((s) => a.all || (s.kind === 'exercise' && !named(s)) || (s.kind === 'junk' && Array.isArray(s.hold) && !named(s))).map((s) => ({ id: s.id, rel: relOf.get(s.clipId) || `${s.folder}/${s.file}`, start: s.start, end: s.end, kind: s.kind, why: s.why, warn: s.warn || [], hold: s.hold || null, name: s.guess && s.guess.name || '', view: s.guess && s.guess.view || 'other', confidence: s.guess && s.guess.confidence || 0.6 }));
  fs.writeFileSync(String(a.template), `${JSON.stringify(rows, null, 1)}\n`); process.stdout.write(`${JSON.stringify({ template: String(a.template), rows: rows.length })}\n`); process.exit(0);
}
if (!namesFile) fail('name.mjs: a names file (or --template) is needed', USAGE);
if (!fs.existsSync(namesFile)) fail(`name.mjs: no such file: ${namesFile}`);
let input; try { input = JSON.parse(fs.readFileSync(namesFile, 'utf8')); } catch (e) { fail(`name.mjs: ${namesFile} is not valid JSON (${e.message})`); }
const rows = Array.isArray(input) ? input.map((r) => (Array.isArray(r) ? { id: r[0], name: r[1], view: r[2], confidence: r[3] } : r)) : input && typeof input === 'object' ? Object.entries(input).map(([id, r]) => ({ id, ...(r && typeof r === 'object' ? r : { name: r }) })) : null;
if (!rows) fail('name.mjs: the names file must be an object or an array', USAGE);
// board entries, for the entryId
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').map((w) => (/(ch|sh|x|ss)es$/.test(w) ? w.slice(0, -2) : w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w)).join('');
let entries = null; if (a.board) { try { const b = JSON.parse(fs.readFileSync(String(a.board), 'utf8')); entries = Array.isArray(b) ? b : Array.isArray(b.entries) ? b.entries : null; } catch (e) { fail(`name.mjs: cannot read the board file ${a.board} (${e.message})`); } if (!entries) fail(`name.mjs: ${a.board} has no entries[]`); }
const KIND = ['library', 'quick', 'mission', 'program', 'new']; const rank = (e) => { const i = KIND.indexOf(e.kind); return i < 0 ? 9 : i; };
const entryFor = (name) => { if (!entries) return null; const n = norm(name); return entries.filter((e) => e && e.name && norm(e.name) === n).sort((x, y) => rank(x) - rank(y) || String(x.id).localeCompare(String(y.id)))[0] || null; };
const VIEWS = ['front', 'side', 'back', 'other']; const byId = new Map(segs.map((s) => [s.id, s])); const now = new Date().toISOString(); const skipped = [], noEntry = []; let done = 0;
for (const r of rows) {
  const id = String(r.id ?? ''); const s = byId.get(id); const name = typeof r.name === 'string' ? r.name.trim() : '';
  if (!s) { skipped.push({ id, reason: 'not in segs.json' }); continue; } if (!name) { skipped.push({ id, reason: 'no name given' }); continue; }
  if (s.kind !== 'exercise' && !Array.isArray(s.hold)) { skipped.push({ id, reason: 'junk with no still stretch: it is not an exercise, so it is not named' }); continue; }
  const view = r.view === undefined || r.view === null ? 'other' : String(r.view); if (!VIEWS.includes(view)) { skipped.push({ id, reason: `view "${view}" is not front, side, back or other` }); continue; }
  const conf = r.confidence === undefined || r.confidence === null ? 0.6 : Number(r.confidence); if (!(conf >= 0 && conf <= 1)) { skipped.push({ id, reason: 'confidence is a number from 0 to 1 (0.9 sure, 0.6 likely, 0.3 a guess)' }); continue; }
  let entryId = r.entryId !== undefined && r.entryId !== '' ? r.entryId : undefined; if (entryId === undefined) { const e = entryFor(name); entryId = e ? e.id : null; if (!e && entries && !noEntry.includes(name)) noEntry.push(name); }
  if (entryId !== null && typeof entryId !== 'string') { skipped.push({ id, reason: 'entryId is a string or null' }); continue; }
  s.guess = { name, entryId, confidence: conf, view }; s.updatedAt = now; done++;
}
if (!a.dry && done) { const tmp = `${segsFile}.tmp`; fs.writeFileSync(tmp, `${JSON.stringify(segs, null, 1)}\n`); fs.renameSync(tmp, segsFile); }
process.stdout.write(`${JSON.stringify({ named: done, dry: !!a.dry, skipped, noEntry, unnamedExercises: segs.filter((s) => s.kind === 'exercise' && !named(s)).length, segs: segsFile })}\n`);
