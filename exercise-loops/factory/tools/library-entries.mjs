#!/usr/bin/env node
// library-entries.mjs: turn the checked drafts of the new exercise loops into library records, after proving they are valid.
//
// Usage:
//   node library-entries.mjs <libDir> [--from drafts|verified] [--out <file.js>] [--report <file.json>] [--print]
//
//   <libDir>   holds chunks/<c>.json (the loops), drafts/<c>.json and verified/<c>.json (one item per loop:
//              { slug, ownerName, decision: add|same|existing|exclude|ask, cleanName, sameAs, existingId, reason, question, entry }),
//              and existing-library.json (every exercise the library already has: id, name ...).
//   --from     which folder to read (default verified, and a chunk with no verified file falls back to its draft).
//   --out      write the library module here (components/training-mode/fit-mode/fitModeExerciseDataLoops.js); without it nothing is written.
//   --report   write { entries, same, existing, excluded, asks, problems } as json.
//   --print    print the problems and the counts only.
//
// Checks (every failure is listed, exit 1): every loop of every chunk appears once; the vocabulary of primaryMuscle / equipment / difficulty / movementType;
// the name has no comma, colon, semicolon, ampersand, slash, bracket or quote (the coach says it inside sentences and the bank splits a line there);
// the name and the id are unique against the library and against each other (case, hyphens and a plural s ignored); `same` points at an added loop;
// `existing` points at an id that exists; coachNote is one sentence; hold and reps are not both set.
import fs from 'node:fs'; import path from 'node:path';
const argv = process.argv.slice(2); const flag = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const pos = argv.filter((a, i) => !a.startsWith('--') && !['--from', '--out', '--report'].includes(argv[i - 1]));
const lib = pos[0]; if (!lib) { process.stderr.write('usage: node library-entries.mjs <libDir> [--from drafts|verified] [--out <file.js>] [--report <file.json>] [--print]\n'); process.exit(1); }
const from = flag('--from') || 'verified'; const rd = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const MUSCLES = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Core', 'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Full Body'];
const EQUIP = ['Bodyweight', 'Weighted', 'Band', 'Cable', 'Machine']; const DIFF = ['Easy', 'Normal', 'Hard']; const MOVE = ['Compound', 'Isolation', 'Cardio', 'Core'];
const STYLE = ['Strength', 'Power', 'Endurance', 'Hypertrophy'];
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim().split(' ').map((w) => (w.length > 3 ? w.replace(/s$/, '') : w)).join(' ');
const idOf = (muscle, name) => `${muscle.toLowerCase().replace(/\s+/g, '_')}_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}_core`;
const existing = rd(path.join(lib, 'existing-library.json')); const existingIds = new Set(existing.map((e) => e.id)); const existingNorm = new Map(existing.map((e) => [norm(e.name), e.name]));
const chunkFiles = fs.readdirSync(path.join(lib, 'chunks')).filter((f) => f.endsWith('.json')).sort();
const problems = []; const bySlug = new Map(); const loopsOf = new Map();
for (const f of chunkFiles) {
  const chunk = rd(path.join(lib, 'chunks', f)); const c = chunk.chunk || f.replace(/\.json$/, '');
  for (const l of chunk.loops) loopsOf.set(l.slug, { chunk: c, name: l.name });
  const vf = path.join(lib, 'verified', f); const df = path.join(lib, 'drafts', f);
  const src = from === 'verified' && fs.existsSync(vf) ? vf : fs.existsSync(df) ? df : null;
  if (!src) { problems.push(`chunk ${c}: no ${from} or draft file`); continue; }
  const doc = rd(src); const seen = new Set();
  for (const it of doc.items || []) { if (!loopsOf.has(it.slug)) { problems.push(`${c}: ${it.slug} is not a loop of any chunk`); continue; } if (bySlug.has(it.slug)) problems.push(`${it.slug}: decided twice`); bySlug.set(it.slug, { ...it, chunk: c, file: path.basename(path.dirname(src)) }); seen.add(it.slug); }
  for (const l of chunk.loops) if (!seen.has(l.slug)) problems.push(`${c}: loop ${l.slug} (${l.name}) has no decision`);
}
const entries = []; const same = []; const existingMatches = []; const excluded = []; const asks = []; const names = new Map(); const ids = new Map();
for (const it of bySlug.values()) {
  const d = it.decision; if (!['add', 'same', 'existing', 'exclude', 'ask'].includes(d)) { problems.push(`${it.slug}: unknown decision "${d}"`); continue; }
  if (d === 'exclude') { excluded.push({ slug: it.slug, name: it.ownerName, reason: it.reason }); continue; }
  if (d === 'same') { same.push({ slug: it.slug, sameAs: it.sameAs }); continue; }
  if (d === 'existing') { if (!existingIds.has(it.existingId)) problems.push(`${it.slug}: existingId "${it.existingId}" is not in the library`); else existingMatches.push({ slug: it.slug, existingId: it.existingId, reason: it.reason }); continue; }
  const e = it.entry; if (!e) { problems.push(`${it.slug}: ${d} without an entry`); continue; }
  const label = `${it.slug} (${e.name})`;
  if (e.name !== it.cleanName) problems.push(`${label}: entry.name differs from cleanName "${it.cleanName}"`);
  if (!MUSCLES.includes(e.primaryMuscle)) problems.push(`${label}: primaryMuscle "${e.primaryMuscle}"`);
  if (!Array.isArray(e.secondaryMuscles) || e.secondaryMuscles.length > 3 || e.secondaryMuscles.some((m) => !MUSCLES.includes(m) || m === e.primaryMuscle)) problems.push(`${label}: secondaryMuscles ${JSON.stringify(e.secondaryMuscles)}`);
  if (!EQUIP.includes(e.equipment)) problems.push(`${label}: equipment "${e.equipment}"`);
  if (!DIFF.includes(e.difficulty)) problems.push(`${label}: difficulty "${e.difficulty}"`);
  if (!MOVE.includes(e.movementType)) problems.push(`${label}: movementType "${e.movementType}"`);
  if (/[,:;&/()"“”‘’]/.test(e.name) || /\s{2,}/.test(e.name) || e.name !== e.name.trim() || e.name.length > 48 || e.name.split(/\s+/).length > 7) problems.push(`${label}: the name has a character or length the coach cannot say cleanly`);
  if (!e.coachNote || /[:;]/.test(e.coachNote) || (e.coachNote.match(/[.!?](\s|$)/g) || []).length > 1 || e.coachNote.split(/\s+/).length > 30) problems.push(`${label}: coachNote must be one plain sentence (no colon or semicolon, about 22 words)`);
  if (!e.combatCarryover) problems.push(`${label}: no combatCarryover`);
  const o = e.opts || {}; if (o.hold && o.reps) problems.push(`${label}: hold and reps both set`);
  if (o.hold != null && !(Number.isInteger(o.hold) && o.hold >= 10 && o.hold <= 120)) problems.push(`${label}: hold ${o.hold}`);
  if (o.reps != null && !/^\d+(-\d+)?$/.test(String(o.reps))) problems.push(`${label}: reps "${o.reps}"`);
  if (o.rest != null && !(Number.isInteger(o.rest) && o.rest >= 15 && o.rest <= 180)) problems.push(`${label}: rest ${o.rest}`);
  if (o.style != null && !STYLE.includes(o.style)) problems.push(`${label}: style "${o.style}"`);
  const n = norm(e.name); if (existingNorm.has(n)) problems.push(`${label}: the library already has "${existingNorm.get(n)}"`);
  if (names.has(n)) problems.push(`${label}: same name as ${names.get(n)}`); else names.set(n, label);
  const id = idOf(e.primaryMuscle, e.name); if (existingIds.has(id)) problems.push(`${label}: id ${id} exists`); if (ids.has(id)) problems.push(`${label}: id ${id} also used by ${ids.get(id)}`); else ids.set(id, label);
  entries.push({ slug: it.slug, id, ...e, decision: d, question: it.question || '', loops: [it.slug] });
  if (d === 'ask') asks.push({ slug: it.slug, name: e.name, ownerName: it.ownerName, question: it.question });
}
const entryBySlug = new Map(entries.map((e) => [e.slug, e]));
for (const s of same) { const t = entryBySlug.get(s.sameAs); if (!t) problems.push(`${s.slug}: sameAs "${s.sameAs}" is not an added loop`); else t.loops.push(s.slug); }
const summary = { loops: loopsOf.size, add: entries.filter((e) => e.decision === 'add').length, ask: asks.length, same: same.length, existing: existingMatches.length, excluded: excluded.length, problems: problems.length };
const q = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const arr = (a) => `[${a.map(q).join(', ')}]`;
const optsSrc = (o) => { const p = []; if (o.hold) p.push(`hold: ${o.hold}`); if (o.reps) p.push(`reps: ${q(o.reps)}`); if (o.rest) p.push(`rest: ${o.rest}`); if (o.tempo) p.push(`tempo: ${q(o.tempo)}`); if (o.style) p.push(`style: ${q(o.style)}`); if (o.fixedDose) p.push('fixedDose: true'); return p.length ? `, { ${p.join(', ')} }` : ''; };
const order = new Map(MUSCLES.map((m, i) => [m, i]));
const sorted = [...entries].sort((a, b) => order.get(a.primaryMuscle) - order.get(b.primaryMuscle) || a.name.localeCompare(b.name));
let src = `// Library exercises that have an approved demo loop (exercise-loops/factory-loops), written from the loops the owner filmed and named.
//
// Same shape as fitModeExerciseDataCore (it builds them with its own ex() helper) and spread into FIT_MODE_EXERCISES after the staples.
// Written once by exercise-loops/factory/tools/library-entries.mjs from the drafts that were each checked by a second reader; edit them here like any other record.
// The coachNote (shown on the card and the info sheet) and combatCarryover were written from the standard form of each lift and what the loop shows, not by the owner.
// The coach says only the NAME of each (clips in public/voice/female and /male: see CLAUDE.md, npm run voice:coverage and test:spoken).
// The demo videos stay staged in exercise-loops/factory-loops until a majority of the app's exercises have one: no videoUrl here.
// Cable and Machine moves are never dealt by the Workout Builder (GYM_ONLY in fitModeGenerator); they show in the library and the info sheet.

import { ex } from './fitModeExerciseDataCore';

export const FIT_MODE_LOOP_EXERCISES = [
`;
let last = '';
for (const e of sorted) {
  if (e.primaryMuscle !== last) { src += `${last ? '\n' : ''}  // ── ${e.primaryMuscle} ${'─'.repeat(Math.max(2, 62 - e.primaryMuscle.length))}\n`; last = e.primaryMuscle; }
  src += `  // loop${e.loops.length > 1 ? 's' : ''}: ${e.loops.join(', ')}${e.decision === 'ask' ? '   (name or move to confirm with the owner)' : ''}\n`;
  src += `  ex(${q(e.name)}, ${q(e.primaryMuscle)}, ${arr(e.secondaryMuscles)}, ${q(e.equipment)}, ${q(e.difficulty)}, ${q(e.movementType)},\n    ${q(e.coachNote)}, ${q(e.combatCarryover)}${optsSrc(e.opts || {})}),\n`;
}
src += '];\n';
if (flag('--out') && !problems.length) fs.writeFileSync(flag('--out'), src);
if (flag('--report')) fs.writeFileSync(flag('--report'), JSON.stringify({ summary, entries, same, existing: existingMatches, excluded, asks, problems }, null, 1));
for (const p of problems) process.stdout.write(`PROBLEM ${p}\n`);
process.stdout.write(`${JSON.stringify(summary)}\n`);
process.exit(problems.length ? 1 : 0);
