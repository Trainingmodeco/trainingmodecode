#!/usr/bin/env node
// save-approved.mjs: file the loops the owner approved on the board into exercise-loops/factory-loops/.
//
// Usage:
//   node approved.mjs <dbExportDir> --list <list.json>      # writes the list of approved factory loops (segId, name, slug, loop asset id, ...)
//   (download each loop asset of the list from the board: Artifact `read` with the asset id as `path` and out_dir <dlDir>; it saves <dlDir>/<id>.mp4)
//   node save-approved.mjs <list.json> <dlDir> [<exerciseLoopsDir>]
//
// For each loop of the list: <dlDir>/<loop asset id>.mp4 must be a readable video; it is copied to factory-loops/<slug>.mp4 and a poster (320 px, the frame at 35 %,
// like cut.mjs) is made next to it as <slug>.webp. factory-loops/index.json lists every saved loop: segId, name, slug, file, poster, loopAsset, bytes, durationSec,
// width, height, cost, folder, video, from, to, entryId, approvedAt, note. A loop already saved (same segId and same loop asset) is left as it is; a stretch redone
// since has a new loop asset and is saved again over the old file. Nothing is ever deleted.
// Prints ONE line of JSON: { listed, saved, kept, missing: [...], broken: [...], bytes }.
import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process'; import { fileURLToPath } from 'node:url';
const [listFile, dlDir, rootArg] = process.argv.slice(2);
if (!listFile || !dlDir) { process.stderr.write('usage: node save-approved.mjs <list.json> <dlDir> [<exerciseLoopsDir>]\n'); process.exit(1); }
const root = path.resolve(rootArg || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..')); const outDir = path.join(root, 'factory-loops'); fs.mkdirSync(outDir, { recursive: true });
const list = JSON.parse(fs.readFileSync(listFile, 'utf8')); const idxFile = path.join(outDir, 'index.json');
const index = fs.existsSync(idxFile) ? JSON.parse(fs.readFileSync(idxFile, 'utf8')) : { loops: [] }; const bySeg = new Map(index.loops.map((l) => [l.segId, l]));
const run = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const probe = (f) => { try { const j = JSON.parse(run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,duration,nb_frames', '-of', 'json', f])); const s = (j.streams || [])[0]; return s && Number(s.duration) > 0 ? { width: s.width, height: s.height, durationSec: Math.round(Number(s.duration) * 100) / 100 } : null; } catch { return null; } };
let saved = 0, kept = 0, bytes = 0; const missing = [], broken = [];
for (const r of list) {
  const prev = bySeg.get(r.segId); const file = `${r.slug}.mp4`, poster = `${r.slug}.webp`;
  if (prev && prev.loopAsset === r.loop && fs.existsSync(path.join(outDir, prev.file))) { kept++; bytes += prev.bytes || 0; continue; }
  const src = path.join(dlDir, `${r.loop}.mp4`); if (!fs.existsSync(src)) { missing.push(r.segId); continue; }
  const meta = probe(src); if (!meta || fs.statSync(src).size < 2000) { broken.push(r.segId); continue; }
  fs.copyFileSync(src, path.join(outDir, file));
  try { run('ffmpeg', ['-nostdin', '-loglevel', 'error', '-y', '-ss', (0.35 * meta.durationSec).toFixed(3), '-i', path.join(outDir, file), '-frames:v', '1', '-vf', 'scale=320:-2', '-c:v', 'libwebp', '-quality', '82', path.join(outDir, poster)]); } catch { /* the loop is saved; a poster that cannot be made is left out */ }
  const rec = { segId: r.segId, name: r.name, slug: r.slug, file, poster: fs.existsSync(path.join(outDir, poster)) ? poster : null, loopAsset: r.loop, bytes: fs.statSync(path.join(outDir, file)).size, durationSec: meta.durationSec, width: meta.width, height: meta.height, cost: r.cost ?? null, folder: r.folder ?? null, video: r.video ?? null, from: r.from ?? null, to: r.to ?? null, entryId: r.entryId ?? null, approvedAt: r.approvedAt ?? null, note: r.note || '' };
  bySeg.set(r.segId, rec); saved++; bytes += rec.bytes;
}
index.updatedAt = new Date().toISOString(); index.loops = [...bySeg.values()].sort((a, b) => a.name.localeCompare(b.name) || a.segId.localeCompare(b.segId));
fs.writeFileSync(idxFile, `${JSON.stringify(index, null, 1)}\n`);
process.stdout.write(`${JSON.stringify({ listed: list.length, saved, kept, missing, broken, bytes })}\n`);
