#!/usr/bin/env node
// apply-matches.mjs: record which app exercises an approved factory loop demonstrates exactly, in board/board.json, so those exercises leave the TO SUBMIT list.
//
// Usage:
//   node apply-matches.mjs <matchDir> [<exerciseLoopsDir>] [--print]
//
//   <matchDir>   holds chunks/<c>.json (the loops: segId, slug, name), results/<c>.json (the mapper's proposals: { results: [{ segId, direct: [{ entryId, why }] }] }) and
//                verified/<c>.json (the skeptic's verdict: { confirmed: [{ segId, entryId }], rejected: [...], added: [{ segId, entryId, why }] }).
//   --print      show what would change and write nothing
//
// A pair (loop, entry) is applied when the skeptic CONFIRMED it (it is in `confirmed`) or ADDED it. A pair the skeptic rejected is never applied, and a pair the mapper proposed that
// the skeptic did not mention is not applied either. For each applied entry (never a strike/kick/cardio row, never a "new" entry):
//   match -> "direct" (the page's needs() then drops it from TO SUBMIT), matchNote -> "", factoryLoops -> the slugs of the loops that show it (factory-loops/<slug>.mp4).
// An entry that already had a direct library loop keeps it (nothing is changed but factoryLoops is added). factoryLoops keeps the slugs it already had and adds the new ones. The previous match of every changed entry is kept in `wasMatch` so a wrong
// match can be undone. Writes board/board.json (and its copy in board/test/), and prints ONE line of JSON: { pairs, entries, newlyDirect, byKind, needsBefore, needsAfter, skipped }.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const argv = process.argv.slice(2); const print = argv.includes('--print'); const pos = argv.filter((a) => !a.startsWith('--'));
const dir = pos[0]; if (!dir) { process.stderr.write('usage: node apply-matches.mjs <matchDir> [<exerciseLoopsDir>] [--print]\n'); process.exit(1); }
const root = path.resolve(pos[1] || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..'));
const boardFile = path.join(root, 'board', 'board.json'); const board = JSON.parse(fs.readFileSync(boardFile, 'utf8')); const byId = new Map(board.entries.map((e) => [e.id, e]));
const needs = (e) => e.kind !== 'new' && e.match !== 'direct' && !e.nonExercise && !e.dupOf; const needsBefore = board.entries.filter(needs).length;
const rd = (f) => JSON.parse(fs.readFileSync(f, 'utf8')); const list = (d) => (fs.existsSync(path.join(dir, d)) ? fs.readdirSync(path.join(dir, d)).filter((f) => f.endsWith('.json')).sort() : []);
const slugOf = new Map(); for (const f of list('chunks')) for (const l of rd(path.join(dir, 'chunks', f)).loops || []) slugOf.set(l.segId, l.slug);
const pairs = new Map(); const skipped = [];
const add = (segId, entryId, how) => { const slug = slugOf.get(segId); const e = byId.get(entryId); if (!slug) { skipped.push({ segId, entryId, why: 'loop not in the chunks' }); return; } if (!e) { skipped.push({ segId, entryId, why: 'no such entry' }); return; } if (e.nonExercise) { skipped.push({ segId, entryId, why: 'strike, kick or cardio row' }); return; } if (e.kind === 'new') { skipped.push({ segId, entryId, why: 'a new exercise (already has its own loop)' }); return; } pairs.set(`${segId}|${entryId}`, { segId, entryId, slug, how }); };
for (const f of list('verified')) { const v = rd(path.join(dir, 'verified', f)); for (const c of v.confirmed || []) add(c.segId, c.entryId, 'confirmed'); for (const c of v.added || []) add(c.segId, c.entryId, 'added'); }
const byEntry = new Map(); for (const p of pairs.values()) { if (!byEntry.has(p.entryId)) byEntry.set(p.entryId, []); byEntry.get(p.entryId).push(p); }
let newlyDirect = 0; const byKind = {}; const changed = [];
for (const [entryId, ps] of byEntry) {
  const e = byId.get(entryId); const slugs = [...new Set(ps.map((p) => p.slug))].sort(); const was = e.match;
  if (was !== 'direct') { newlyDirect++; byKind[e.kind] = (byKind[e.kind] || 0) + 1; e.wasMatch = was; e.match = 'direct'; e.matchNote = ''; }
  e.factoryLoops = [...new Set([...(Array.isArray(e.factoryLoops) ? e.factoryLoops : []), ...slugs])].sort(); changed.push({ id: entryId, name: e.name, kind: e.kind, was, loops: e.factoryLoops });
}
const needsAfter = board.entries.filter(needs).length;
const summary = { pairs: pairs.size, entries: byEntry.size, newlyDirect, byKind, needsBefore, needsAfter, skipped: skipped.length };
if (print) { process.stdout.write(`${JSON.stringify({ ...summary, changed })}\n`); process.exit(0); }
board.factoryMatchedAt = new Date().toISOString(); const out = JSON.stringify(board);
fs.writeFileSync(boardFile, out); const tb = path.join(root, 'board', 'test', 'board.json'); if (fs.existsSync(path.dirname(tb))) fs.writeFileSync(tb, out);
process.stdout.write(`${JSON.stringify(summary)}\n`);
