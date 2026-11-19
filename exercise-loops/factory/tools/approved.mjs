#!/usr/bin/env node
// approved.mjs: track what the owner has approved on the Exercise Loop Board, and how far that gets the library toward "a majority animated".
//
// Usage:
//   node approved.mjs <dbExportDir> [<exerciseLoopsDir>] [--print]
//
//   <dbExportDir>        the board's database as ArtifactData saves it with out_dir: <dir>/items/ (loop.<slug>, seg.<segId>, control.queue) and <dir>/segs/
//   <exerciseLoopsDir>   the exercise-loops folder (default: two folders up from this file). Read: loops.json, board/board.json. Written: approved.json, APPROVED.md
//   --print              print the summary only, write nothing
//
// Two kinds of approval:
//   - a library loop (items/loop.<slug>.approved === true): one of the 45 loops in loops/, approved on the board's LOOPS MADE or NEW EXERCISES tab. The owner's
//     name for it (items/loop.<slug>.name) is the name to use in the app; a loop with no name there keeps the name it had.
//   - a loop the factory rendered from raw footage (items/seg.<segId>.verdict === "approved", with the loop asset the verdict was given for: forLoop): approved in REVIEW.
// Progress: of the exercises the app asks for (board.json entries that are not "nonExercise"), how many have a loop (a loop that shows exactly that move, one that
// is a close variation, or one of the new exercises), and how many more a majority (half plus one) needs.
// Prints ONE line of JSON (the summary) unless --print.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const argv = process.argv.slice(2); const flags = argv.filter((a) => a.startsWith('--')); const pos = argv.filter((a) => !a.startsWith('--'));
const dbDir = pos[0]; if (!dbDir) { process.stderr.write('usage: node approved.mjs <dbExportDir> [<exerciseLoopsDir>] [--print]\n'); process.exit(1); }
const root = path.resolve(pos[1] || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..'));
const rd = (d) => { const dir = path.join(dbDir, d); if (!fs.existsSync(dir)) return {}; const o = {}; for (const f of fs.readdirSync(dir)) { if (!f.endsWith('.json')) continue; try { const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); o[f.slice(0, -5)] = { ...(j.data && typeof j.data === 'object' ? j.data : j), _version: j.version ?? null }; } catch { /* a file that cannot be read is skipped */ } } return o; };
const items = rd('items'), segs = rd('segs');
const board = JSON.parse(fs.readFileSync(path.join(root, 'board', 'board.json'), 'utf8')); const loopsMeta = JSON.parse(fs.readFileSync(path.join(root, 'loops.json'), 'utf8'));
const metaOf = (slug) => (Array.isArray(loopsMeta) ? loopsMeta.find((l) => l.id === slug || l.slug === slug) : loopsMeta[slug]) || (board.loops && board.loops[slug]) || {};
const kebab = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ---- library loops the owner approved
const library = [];
for (const [key, d] of Object.entries(items)) {
  if (!key.startsWith('loop.')) continue; const slug = key.slice(5); if (d.approved !== true) continue;
  const L = (board.loops && board.loops[slug]) || {}; const was = L.name || metaOf(slug).name || slug; const name = (typeof d.name === 'string' && d.name.trim()) || was;
  library.push({ slug, name, originalName: was, renamed: name !== was, group: d.group || null, equipment: d.equipment || null, file: `loops/${slug}.mp4`, poster: `posters/${slug}.webp`, isNew: !!L.isNew, serves: (L.serves || []).map((s) => s.id), lastChanged: d.updatedAt || null });
}
library.sort((a, b) => a.name.localeCompare(b.name));

// ---- loops the factory rendered
const factory = { approved: [], waiting: [], redo: [], rejected: [], failed: [], making: [] }; let queued = 0;
for (const [key, o] of Object.entries(items)) {
  if (!key.startsWith('seg.')) continue; const id = key.slice(4); const s = segs[id] || {}; if (o.queued && !s.loop && !['review', 'done', 'generating', 'failed'].includes(s.state)) queued++;
  const made = !!s.loop || ['review', 'done', 'generating', 'failed'].includes(s.state); if (!made) continue;
  const rec = { segId: id, name: (o.name && o.name.trim()) || (s.guess && s.guess.name) || '', slug: kebab((o.name && o.name.trim()) || (s.guess && s.guess.name) || id), folder: s.folder || null, video: s.file || null, from: o.from ?? s.start ?? null, to: o.to ?? s.end ?? null, cost: s.cost ?? null, loopAsset: s.loop || null, posterAsset: s.poster || null, verdict: o.verdict || null, note: o.note || '', answeredAt: o.updatedAt || null, loopIsTheOneAnswered: !o.forLoop || o.forLoop === s.loop };
  { const f = path.join(root, 'factory-loops', `${rec.slug}.mp4`); rec.savedAs = fs.existsSync(f) ? `factory-loops/${rec.slug}.mp4` : null; }
  if (s.state === 'generating') factory.making.push(rec); else if (s.state === 'failed') factory.failed.push(rec);
  else if (o.verdict === 'approved' && rec.loopIsTheOneAnswered) factory.approved.push(rec); else if (o.verdict === 'redo') factory.redo.push(rec); else if (o.verdict === 'rejected') factory.rejected.push(rec); else factory.waiting.push(rec);
}
const cq = items['control.queue'] || null;

// ---- progress toward "a majority animated"
const real = (board.entries || []).filter((e) => !e.nonExercise); const total = real.length;
const have = (m) => real.filter((e) => e.loop && e.match === m).length; const exact = have('direct'), close = have('close'), fresh = have('new'); const withLoop = real.filter((e) => e.loop).length;
const majority = Math.floor(total / 2) + 1; const progress = { exercisesTotal: total, exact, close, new: fresh, withLoop, percent: Math.round((withLoop / total) * 1000) / 10, exactOrNewPercent: Math.round(((exact + fresh) / total) * 1000) / 10, majorityAt: majority, stillNeededForMajority: Math.max(0, majority - withLoop), byKind: Object.fromEntries([...new Set(real.map((e) => e.kind))].map((k) => [k, { exercises: real.filter((e) => e.kind === k).length, withLoop: real.filter((e) => e.kind === k && e.loop).length }])) };
const summary = { loopsInLibrary: Object.keys(board.loops || {}).length, libraryApproved: library.length, libraryRenamed: library.filter((l) => l.renamed).length, factoryApproved: factory.approved.length, factoryWaiting: factory.waiting.length, factoryRedo: factory.redo.length, factoryRejected: factory.rejected.length, factoryFailed: factory.failed.length, factoryMaking: factory.making.length, stretchesTickedNotMade: queued, queueRequest: cq ? { requestedAt: cq.requestedAt, count: cq.count, cap: cq.cap } : null, progress };
if (flags.includes('--print')) { process.stdout.write(`${JSON.stringify(summary)}\n`); process.exit(0); }

const stamp = new Date().toISOString(); const doc = { generatedAt: stamp, board: 'https://claude.ai/artifact/PyNEAD4AtbxzpoFu3S1Wst', summary, libraryLoops: library, factoryLoops: factory };
fs.writeFileSync(path.join(root, 'approved.json'), `${JSON.stringify(doc, null, 1)}\n`);
const cell = (v) => String(v == null || v === '' ? '-' : v).replace(/\|/g, '/'); const row = (...c) => `| ${c.map(cell).join(' | ')} |`; const date = (v) => (v ? String(v).slice(0, 10) : '-'); const clock = (v) => (Number.isFinite(v) ? `${Math.floor(v / 60)}:${String(Math.round(v % 60)).padStart(2, '0')}` : '-');
const md = [];
md.push('# Approved loops (tracker)', '', `Written by \`factory/tools/approved.mjs\` from the Exercise Loop Board on ${stamp.slice(0, 10)}. Run it again after more approvals; it rewrites this file and \`approved.json\`. The loops are staged, not shipped: nothing here is in the app.`, '');
md.push('## Progress toward a majority animated', '', `The owner's rule: push the loops into the app once most of the workouts are animated, not all.`, '');
md.push(`- Exercises the app asks for: **${total}**.`, `- With a loop: **${withLoop}** (${progress.percent} %): ${exact} show exactly that move, ${close} are a close variation, ${fresh} are new exercises.`, `- A majority is **${majority}**, so **${progress.stillNeededForMajority} more** are needed.`, '');
md.push(row('Kind', 'Exercises', 'With a loop'), row('---', '---', '---'), ...Object.entries(progress.byKind).map(([k, v]) => row(k, v.exercises, v.withLoop)), '');
md.push(`## Library loops you approved (${library.length})`, '', 'Use the name in the Name column in the app: it is the one you gave the loop on the board.', '', row('Name', 'Was called', 'Group', 'Equipment', 'File', 'New exercise', 'Last changed'), row('---', '---', '---', '---', '---', '---', '---'), ...library.map((l) => row(l.name, l.renamed ? l.originalName : '', l.group, l.equipment, `loops/${l.slug}.mp4`, l.isNew ? 'yes' : '', date(l.lastChanged))), '');
md.push(`## Made from your raw footage (the factory)`, '', `- Approved: **${factory.approved.length}**. Waiting for your verdict: **${factory.waiting.length}**. Redo asked: ${factory.redo.length}. Rejected: ${factory.rejected.length}. Failed: ${factory.failed.length}. Being made now: ${factory.making.length}.`, `- Stretches you ticked that are not made yet: **${queued}**. ${cq ? `Queue request on the board: ${cq.count} stretches, limit ${cq.cap} credits, sent ${date(cq.requestedAt)}.` : 'No queue request on the board yet (press Generate).'}`, '');
const fl = (title, list) => { if (!list.length) return; md.push(`### ${title}`, '', row('Name', 'Video', 'From to', 'Credits', 'Answered', 'Saved as', 'Note'), row('---', '---', '---', '---', '---', '---', '---'), ...list.map((r) => row(r.name, r.video, `${clock(r.from)} to ${clock(r.to)}`, r.cost, date(r.answeredAt), r.savedAs, r.note)), ''); };
fl('Approved', factory.approved); fl('Waiting for your verdict', factory.waiting); fl('Redo asked', factory.redo); fl('Rejected', factory.rejected); fl('Failed', factory.failed);
md.push('## Notes', '', '- A loop you approved on the board stays on the board until it is copied into this folder. Library loops are already in `loops/`. A factory loop that is approved is saved in `factory-loops/<name>.mp4` (with its poster) when approvals are tracked; it does not replace a library loop of the same exercise on its own (the approved Pistol Squats render is a candidate to replace `loops/pistol-squats.mp4`, which has a slight judder).', '');
fs.writeFileSync(path.join(root, 'APPROVED.md'), md.join('\n'));
process.stdout.write(`${JSON.stringify(summary)}\n`);
