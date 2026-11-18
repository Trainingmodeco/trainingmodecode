#!/usr/bin/env node
// dups.mjs: which stretches of the board repeat an exercise that is already covered. A model of the rule the board page applies, to check it against an export.
// Usage: node dups.mjs <dbExportDir> <board.json> [--min-conf 0.6] [--json]
// The rule (same as the board's): one loop per exercise name. A stretch is a DUPLICATE when
//   - it is an exercise stretch (not junk) whose name (the owner's, else the scan's guess) is the name of a loop the library already has, or
//   - another stretch already claims the name: one the owner named, ticked, or has a loop for (a "skip" alone claims nothing), or else the best-looking untouched stretch of that name.
// Never a duplicate: a stretch the owner has touched (any seg.<id> document that is not only a skip, or a typed name), one in state review / done / generating / failed,
// one with no name, and one whose guess is unsure (confidence under --min-conf) and that the owner did not name.
import fs from 'node:fs'; import path from 'node:path';
const a = process.argv.slice(2); const flag = (n, d) => { const i = a.indexOf(`--${n}`); return i >= 0 ? a[i + 1] : d; };
const [dbDir, boardFile] = a.filter((x) => !x.startsWith('--') && a[a.indexOf(x) - 1] !== '--min-conf');
const MIN = Number(flag('min-conf', 0.6));
const rd = (d) => (fs.existsSync(d) ? Object.fromEntries(fs.readdirSync(d).filter((f) => f.endsWith('.json')).map((f) => { const v = JSON.parse(fs.readFileSync(path.join(d, f), 'utf8')); return [f.slice(0, -5), v.data || v]; })) : {});
const S = rd(path.join(dbDir, 'segs')), I = rd(path.join(dbDir, 'items')); const board = JSON.parse(fs.readFileSync(boardFile, 'utf8'));
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const looped = new Set(Object.values(board.loops || {}).map((l) => norm(l.name)));
const segs = Object.entries(S).map(([id, s]) => ({ id, ...s })); const own = (id) => I[`seg.${id}`] || null;
const nameOf = (s) => { const o = own(s.id); return (o && typeof o.name === 'string' && o.name.trim()) || (s.guess && s.guess.name) || ''; };
const conf = (s) => (s.guess && Number.isFinite(s.guess.confidence) ? s.guess.confidence : 0);
const touched = (s) => { const o = own(s.id); return !!o && (!!(o.name && o.name.trim()) || o.queued || o.verdict || o.hold || o.from != null || o.to != null || (o.note && o.note.trim())); };
const made = (s) => ['review', 'done', 'generating', 'failed'].includes(s.state);
const quality = (s) => { const len = (s.end - s.start) || 0, r = Number.isFinite(s.reps) ? s.reps : 0; return conf(s) * 3 + (r >= 4 && r <= 24 ? 1 : 0) + (len >= 6 && len <= 45 ? 1 : 0) - (Array.isArray(s.warn) ? s.warn.length : 0) * 0.8 + Math.min(len, 30) / 100; };
const byName = new Map();
for (const s of segs) { if (s.kind === 'junk' && !touched(s)) continue; const k = norm(nameOf(s)); if (!k) continue; if (!byName.has(k)) byName.set(k, []); byName.get(k).push(s); }
const dup = new Map();
for (const [k, list] of byName) {
  const claim = list.filter((s) => made(s) || (touched(s) && !(own(s.id) && own(s.id).skip && !(own(s.id).name && own(s.id).name.trim()))));
  const free = list.filter((s) => !made(s) && !touched(s) && s.kind !== 'junk' && conf(s) >= MIN).sort((x, y) => quality(y) - quality(x) || x.id.localeCompare(y.id));
  let keeper = claim[0] || null; const why = looped.has(k) ? 'the library already has a loop of this exercise' : null;
  if (!keeper && !why && free.length) keeper = free[0];
  for (const s of free) { if (why) dup.set(s.id, { of: null, name: nameOf(s), why }); else if (keeper && s.id !== keeper.id) dup.set(s.id, { of: keeper.id, name: nameOf(s), why: 'another stretch of this exercise is already the one to make' }); }
}
const summary = { stretches: segs.length, exerciseStretches: segs.filter((s) => s.kind !== 'junk').length, duplicates: dup.size, byWhy: { library: [...dup.values()].filter((d) => !d.of).length, repeated: [...dup.values()].filter((d) => d.of).length }, names: byName.size, namesWithDuplicates: new Set([...dup.values()].map((d) => norm(d.name))).size };
if (a.includes('--json')) { process.stdout.write(`${JSON.stringify({ summary, dup: Object.fromEntries(dup) })}\n`); process.exit(0); }
console.log(JSON.stringify(summary));
const ex = [...byName].filter(([k, l]) => l.length > 1).sort((x, y) => y[1].length - x[1].length).slice(0, 14);
for (const [k, l] of ex) { const hid = l.filter((s) => dup.has(s.id)).length, keep = l.filter((s) => !dup.has(s.id) && !(s.kind === 'junk')); console.log(String(l.length).padStart(3), 'stretches', String(hid).padStart(3), 'hidden |', nameOf(l[0]), '| kept:', keep.map((s) => `${s.id} (${s.folder}, ${Math.round(s.start)}-${Math.round(s.end)} s, conf ${conf(s)}, ${s.warn && s.warn.length ? 'warn' : 'clean'}${own(s.id) && own(s.id).queued ? ', QUEUED' : ''})`).slice(0, 3).join('; ') || (looped.has(k) ? 'has a library loop' : '-')); }
const lowConf = segs.filter((s) => s.kind !== 'junk' && conf(s) < MIN && !touched(s)).length; console.log('exercise stretches with an unsure guess (never hidden):', lowConf);
