#!/usr/bin/env node
// apply-library.mjs: record the new library exercises on the Exercise Loop Board (board/board.json) and write the owner's question sheet.
//
// Usage:
//   node apply-library.mjs <libDir> [<exerciseLoopsDir>] [--questions <file.md>] [--print]
//
//   <libDir>   the folder library-entries.mjs worked in: chunks/, verified/ (or drafts/) and report.json (library-entries.mjs --report).
//              The entries it wrote to the app (the report's `add` decisions) are the ones recorded; the `ask` decisions were held back and are not.
//
// board.json changes (the previous match of every changed entry stays in wasMatch):
//   - an added exercise gets a board entry { id, name, kind: "library", match: "direct", factoryLoops: [loop slugs] }, so it counts as animated;
//   - an added exercise that comes from a "new" loop (kind "new" entry: the board already counts it) is not added a second time: that entry gets libraryId + inApp: true;
//   - a loop decided `existing` makes that library exercise match "direct" and adds its slug to the exercise's factoryLoops;
//   - an exercise already on the board under that id is left as it is.
// Writes board/board.json (and board/test/board.json) and prints ONE line of JSON. --questions writes the sheet of what the owner should check.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const argv = process.argv.slice(2); const print = argv.includes('--print'); const flag = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const pos = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--questions'); const lib = pos[0];
if (!lib) { process.stderr.write('usage: node apply-library.mjs <libDir> [<exerciseLoopsDir>] [--questions <file.md>] [--print]\n'); process.exit(1); }
const root = path.resolve(pos[1] || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..'));
const rd = (f) => JSON.parse(fs.readFileSync(f, 'utf8')); const report = rd(path.join(lib, 'report.json'));
const boardFile = path.join(root, 'board', 'board.json'); const board = rd(boardFile); const byId = new Map(board.entries.map((e) => [e.id, e]));
const newByLoop = new Map(board.entries.filter((e) => e.kind === 'new' && e.loop).map((e) => [e.loop, e]));
const fromNew = new Set(rd(path.join(lib, 'chunks', 'newloops.json')).loops.map((l) => l.slug));
const needs = (e) => e.kind !== 'new' && e.match !== 'direct' && !e.nonExercise && !e.dupOf; const needsBefore = board.entries.filter(needs).length; const totalBefore = board.entries.filter((e) => !e.nonExercise).length;
const added = []; const annotated = []; const existingDone = []; const skipped = [];
for (const e of report.entries) {
  if (e.decision !== 'add') continue; const loops = [...new Set(e.loops)].sort();
  const nw = loops.map((s) => newByLoop.get(s)).find(Boolean);
  if (nw || loops.some((s) => fromNew.has(s))) { if (nw) { nw.libraryId = e.id; nw.inApp = true; annotated.push({ id: nw.id, libraryId: e.id }); } else skipped.push({ id: e.id, why: 'from a new loop with no new entry on the board' }); continue; }
  if (byId.has(e.id)) { skipped.push({ id: e.id, why: 'already on the board' }); continue; }
  const row = { id: e.id, name: e.name, kind: 'library', group: e.primaryMuscle, equipment: e.equipment, movementType: e.movementType, loop: null, match: 'direct', matchNote: '', alsoIn: [], score: 0, where: null, draftId: null, nonExercise: false, factoryLoops: loops, addedFromLoops: true };
  board.entries.push(row); byId.set(row.id, row); added.push({ id: row.id, name: row.name, loops });
}
for (const x of report.existing) {
  const e = byId.get(x.existingId); if (!e) { skipped.push({ id: x.existingId, why: 'no such board entry' }); continue; }
  const was = e.match; if (was !== 'direct') { e.wasMatch = was; e.match = 'direct'; e.matchNote = ''; }
  const slugs = new Set(e.factoryLoops || []); slugs.add(x.slug); e.factoryLoops = [...slugs].sort(); existingDone.push({ id: e.id, name: e.name, was, loop: x.slug });
}
const needsAfter = board.entries.filter(needs).length; const totalAfter = board.entries.filter((e) => !e.nonExercise).length;
const summary = { added: added.length, annotatedNew: annotated.length, existing: existingDone.length, skipped: skipped.length, entriesBefore: totalBefore, entriesAfter: totalAfter, needsBefore, needsAfter };
// ---- the owner's question sheet
if (flag('--questions')) {
  const meta = new Map(); for (const f of fs.readdirSync(path.join(lib, 'chunks')).filter((x) => x.endsWith('.json'))) { const v = path.join(lib, 'verified', f); const d = path.join(lib, 'drafts', f); const src = fs.existsSync(v) ? v : d; if (fs.existsSync(src)) for (const it of rd(src).items || []) meta.set(it.slug, it); }
  const md = ['# New loops: what the owner should check', '', `Made ${new Date().toISOString().slice(0, 10)} while matching the approved loops to library exercises. Nothing here blocks anything: the exercises below that were added are already in the library, and the loops stay staged in exercise-loops/factory-loops (not in the app).`, ''];
  const asks = report.asks;
  if (asks.length) {
  const asks = report.asks; md.push(`## ${asks.length} loops held back until you answer`, '', 'These loops have a name or a move that could not be settled from the name and the picture. They are NOT in the library yet (so no coach voice either). Answer in a phrase; each becomes an exercise as soon as it is clear.', '');
    for (const a of asks) { const it = meta.get(a.slug) || {}; md.push(`- **${a.ownerName}** (loop \`${a.slug}\`): ${a.question}${it.entry ? `\n  My best guess: "${a.name}", ${it.entry.primaryMuscle.toLowerCase()}, ${it.entry.equipment.toLowerCase()}: ${it.entry.coachNote}` : ''}`); }
  } else {
    const answered = [...meta.values()].filter((it) => it.ownerAnswer); md.push(`## ${answered.length} questions answered`, '', 'These loops had a name or a move that could not be settled from the name and the picture. You answered; each is in the library with your answer applied.', '');
    for (const it of answered) md.push(`- **${it.ownerName}** is **${it.cleanName}**: ${it.ownerAnswer}`);
    for (const it of [...meta.values()].filter((x) => x.appliedFrom)) md.push('', `Also applied to **${it.cleanName}** (the same word): ${it.appliedFrom}`);
  }
  const ex = report.existing; md.push('', `## ${ex.length} loops counted as an exercise the library already has`, '', 'If you want any of these as its own exercise instead, say so and it is added (name and cue are ready to write).', '');
  for (const x of ex) { const it = meta.get(x.slug) || {}; md.push(`- **${it.ownerName || x.slug}** (\`${x.slug}\`) is the library's **${(board.entries.find((e) => e.id === x.existingId) || {}).name || x.existingId}**: ${x.reason}`); }
  const exc = report.excluded; md.push('', `## ${exc.length} loops left out of the library`, '');
  for (const x of exc) md.push(`- **${x.name}** (\`${x.slug}\`): ${x.reason}`);
  const changed = [...meta.values()].filter((it) => it.nameNote && it.decision === 'add'); md.push('', `## ${changed.length} names changed by more than spelling`, '', 'The library uses the cleaned name. Tell me if you want your own wording back.', '');
  for (const it of changed) md.push(`- "${it.ownerName}" is now **${it.cleanName}**: ${it.nameNote}`);
  md.push('', '## Entries written from the picture, not from you', '', 'Every cue line (coachNote), the muscle group, the difficulty and the reps are my reading of the standard lift and what the loop shows. Skim fitModeExerciseDataLoops.js; a wrong cue is a one-line fix.', '');
  fs.writeFileSync(flag('--questions'), md.join('\n'));
}
if (print) { process.stdout.write(`${JSON.stringify({ ...summary, skipped })}\n`); process.exit(0); }
board.libraryAddedAt = new Date().toISOString(); const out = JSON.stringify(board); fs.writeFileSync(boardFile, out); const tb = path.join(root, 'board', 'test', 'board.json'); if (fs.existsSync(path.dirname(tb))) fs.writeFileSync(tb, out);
process.stdout.write(`${JSON.stringify({ ...summary, skipped })}\n`);
