#!/usr/bin/env node
// prep-shard.mjs: run prep.mjs for every item of a shard file (free), so a worker starts from a result for each stretch.
//
// Usage:
//   node prep-shard.mjs <shard.json> <workDir> [--only <segId,segId,...>]
//
//   <shard.json>  { shard, items: [ { segId, source, prep: [args for prep.mjs], ... } ] } (items come from queue-plan.mjs)
//   <workDir>     where srcs/<segId>.mp4 (the source clip, downloaded from the board) and prep/ live. The result of each item is saved to
//                 <workDir>/prep/<segId>.json as { segId, ok, exit, result | error } (result = the JSON line prep.mjs printed).
//
// An item whose source file is not there is reported as { ok: false, error: "no source file" } and nothing is run for it.
// Prints ONE line of JSON: { shard, items, ok, failed: [{ segId, error }] }. The pictures prep.mjs writes are <workDir>/prep/<segId>-check.jpg and -sheet.jpg.
import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process'; import { fileURLToPath } from 'node:url';
import { args, fail } from './_lib.mjs';
const here = path.dirname(fileURLToPath(import.meta.url)); const a = args(process.argv.slice(2)); const [shardFile, work] = a._;
if (!shardFile || !work) fail('usage: node prep-shard.mjs <shard.json> <workDir> [--only <segId,...>]');
const shard = JSON.parse(fs.readFileSync(shardFile, 'utf8')); const only = a.only ? new Set(String(a.only).split(',').map((s) => s.trim())) : null;
fs.mkdirSync(path.join(work, 'prep'), { recursive: true });
let ok = 0; const failed = []; let n = 0;
for (const it of shard.items) {
  if (only && !only.has(it.segId)) continue; n++;
  const out = path.join(work, 'prep', `${it.segId}.json`); let rec;
  if (!fs.existsSync(it.source)) rec = { segId: it.segId, ok: false, exit: null, error: `no source file: ${it.source}` };
  else {
    try { const txt = execFileSync('node', [path.join(here, 'prep.mjs'), ...it.prep], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1e8 }); rec = { segId: it.segId, ok: true, exit: 0, result: JSON.parse(txt.trim().split('\n').pop()) }; }
    catch (e) { rec = { segId: it.segId, ok: false, exit: e.status ?? null, error: String(e.stderr || e.stdout || e.message).trim().slice(0, 400) }; }
  }
  fs.writeFileSync(out, `${JSON.stringify(rec)}\n`); if (rec.ok) ok++; else failed.push({ segId: it.segId, error: rec.error });
}
process.stdout.write(`${JSON.stringify({ shard: shard.shard, items: n, ok, failed })}\n`);
