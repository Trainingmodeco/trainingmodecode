#!/usr/bin/env node
// ingest.mjs: take stock of a folder of raw footage and make a small proxy of every video for quick viewing.
//
// Usage:
//   node ingest.mjs <rawRoot> <workDir> [--force] [--only <text in the path>]
//
//   <rawRoot>   walked recursively (links followed); videos are .mp4 .mov .m4v .webm .avi .mkv in any letter case.
//               Hidden files and the "._name" files a Mac leaves on shared disks are skipped.
//   <workDir>   <workDir>/clips.json     a JSON array, one entry per video, sorted by path:
//                 { id, cid, rel, folder, file, bytes, duration, width, height, fps, rotation, hasAudio, codec,
//                   hdr, vfr, bitDepth, proxy }
//                 id        the video's name in everything that follows (segments, pictures, the board). For a video
//                           first seen by this version: id = cid.
//                 cid       first 10 hex of sha1 over: the file's size as a decimal number, then its first 256 KB, then
//                           its last 256 KB (a file under 256 KB: all of it, twice). It depends on the CONTENT only, so a
//                           video that is moved to another folder or renamed keeps its id, and with it its segments
//                           and names: when a known cid shows up under a new path, only rel / folder / file are updated.
//                           An entry written by the first version (id = sha1 of path + size, no cid) keeps its id and
//                           is given its cid the next time it is seen at its old path; from then on it can move too.
//                 folder    first path segment ("push-ups"), or "" for a file in the root itself
//                 width, height   of the picture as shown, i.e. after the phone's rotation is applied
//                 rotation  degrees clockwise the stored picture is turned to show it upright (0, 90, 180, 270)
//                 fps       average frames per second; vfr = true when the phone varied it
//                 hdr       null, "hlg" (iPhone HDR / Dolby Vision) or "pq" (HDR10)
//               <workDir>/proxy/<id>.mp4   longest side 480, 15 fps, h264 crf 30, yuv420p, no audio, upright,
//                                          HDR tone-mapped to SDR
//   --force     make every proxy again
//   --only      take only paths that contain this text (to test with one folder)
//
// A video already in clips.json, with its proxy on disk, is skipped. Entries whose file is gone from <rawRoot> are
// dropped from clips.json (their proxies are left alone). The same video found twice (a copy: same size, same first
// and last 256 KB) is listed once, under the path clips.json already knows or else the first one; the copies are
// reported. A file that cannot be read is reported and left out; it never stops the run. clips.json is rewritten
// after every video, so a run can be interrupted and started again.
// Prints progress on stderr and one line of JSON on stdout:
//   { found, added, skipped, moved: [{ id, from, to }], duplicates: [{ rel, sameAs }], removed, failed: [{ rel, error }], total, clips }.
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
import { args, fail, ff, probe, colour, upright, VIDEO_EXT } from './_lib.mjs';

const USAGE = 'usage: node ingest.mjs <rawRoot> <workDir> [--force] [--only <text in the path>]';
const a = args(process.argv.slice(2), ['force']); const [rawRoot, workDir] = a._;
if (!rawRoot || !workDir) fail('ingest.mjs: a raw folder and a work folder are needed', USAGE);
if (!fs.existsSync(rawRoot) || !fs.statSync(rawRoot).isDirectory()) fail(`ingest.mjs: not a folder: ${rawRoot}`);
const root = path.resolve(rawRoot); const proxyDir = path.join(workDir, 'proxy'); fs.mkdirSync(proxyDir, { recursive: true });
const LONG = 480, FPS = 15, EDGE = 256 * 1024; const even = (v) => Math.max(2, Math.round(v / 2) * 2);

// ---- walk
const found = []; const seenDirs = new Set();
(function walk(dir) {
  let real; try { real = fs.realpathSync(dir); } catch { return; } if (seenDirs.has(real)) return; seenDirs.add(real);
  for (const name of fs.readdirSync(dir).sort((x, y) => x.localeCompare(y, undefined, { numeric: true }))) {
    if (name.startsWith('.')) continue; const full = path.join(dir, name); let st; try { st = fs.statSync(full); } catch { continue; }
    if (st.isDirectory()) { if (path.resolve(full) !== path.resolve(workDir)) walk(full); continue; }
    if (!st.isFile() || !VIDEO_EXT.includes(path.extname(name).slice(1).toLowerCase())) continue;
    const rel = path.relative(root, full).split(path.sep).join('/'); if (a.only && !rel.includes(a.only)) continue;
    found.push({ full, rel, bytes: st.size });
  }
})(root);

// ---- ids
/** The content id: size, first 256 KB, last 256 KB. null when the file cannot be read. */
const cidOf = (f) => { let fd = null; try { fd = fs.openSync(f.full, 'r'); const n = Math.min(EDGE, f.bytes); const head = Buffer.alloc(n), tail = Buffer.alloc(n); fs.readSync(fd, head, 0, n, 0); fs.readSync(fd, tail, 0, n, Math.max(0, f.bytes - n));
  return crypto.createHash('sha1').update(String(f.bytes)).update(head).update(tail).digest('hex').slice(0, 10); } catch { return null; } finally { if (fd !== null) fs.closeSync(fd); } };
const legacyId = (f) => crypto.createHash('sha1').update(f.rel + String(f.bytes)).digest('hex').slice(0, 10); // the first version's id: path + size

// ---- clips.json so far
const clipsFile = path.join(workDir, 'clips.json'); let before = [];
if (fs.existsSync(clipsFile)) { try { before = JSON.parse(fs.readFileSync(clipsFile, 'utf8')); if (!Array.isArray(before)) before = Object.values(before); } catch { before = []; } }
const byCid = new Map(before.filter((c) => c.cid).map((c) => [c.cid, c])); const byId = new Map(before.map((c) => [c.id, c]));
const out = new Map(); const failed = [], moved = [], duplicates = []; let added = 0, skipped = 0;
const save = () => { const list = [...out.values()].sort((x, y) => x.rel.localeCompare(y.rel, undefined, { numeric: true })); const tmp = `${clipsFile}.tmp`; fs.writeFileSync(tmp, `${JSON.stringify(list, null, 1)}\n`); fs.renameSync(tmp, clipsFile); };
const place = (rel) => ({ rel, folder: rel.includes('/') ? rel.split('/')[0] : '', file: path.basename(rel) });

// which entry is each file? content first, then (for entries of the first version) path + size
for (const f of found) { f.cid = f.bytes > 0 ? cidOf(f) : null; f.old = (f.cid && byCid.get(f.cid)) || null; if (!f.old) { const o = byId.get(legacyId(f)); if (o && !o.cid && o.rel === f.rel) f.old = o; } f.id = f.old ? f.old.id : f.cid || legacyId(f); }
// one entry per video: of several files with the same id, the one at the path clips.json knows wins, else the first
const winner = new Map(); for (const f of found) { const w = winner.get(f.id); if (!w || (f.old && f.old.rel === f.rel && !(w.old && w.old.rel === w.rel))) winner.set(f.id, f); }
// entries of other paths stay until the end (with --only, the rest of the folder is not touched)
if (a.only) for (const c of before) if (!winner.has(c.id) && fs.existsSync(path.join(root, c.rel))) out.set(c.id, c);

found.forEach((f, i) => {
  const tag = `[${i + 1}/${found.length}] ${f.rel}`; const id = f.id; const proxy = path.join(proxyDir, `${id}.mp4`);
  if (winner.get(id) !== f) { duplicates.push({ rel: f.rel, sameAs: winner.get(id).rel }); process.stderr.write(`${tag}: the same video as ${winner.get(id).rel} (a copy), left out\n`); return; }
  const old = f.old;
  if (old && !a.force && fs.existsSync(proxy) && fs.statSync(proxy).size > 0) {
    const entry = { ...old, cid: f.cid || old.cid || null, ...place(f.rel), bytes: f.bytes }; out.set(id, entry); skipped++;
    if (old.rel !== f.rel) { moved.push({ id, from: old.rel, to: f.rel }); save(); process.stderr.write(`${tag}: known video, was ${old.rel}: its id ${id} and everything under it are kept\n`); } else process.stderr.write(`${tag}: already ingested\n`);
    return; }
  try {
    if (f.bytes === 0) throw new Error('the file is empty');
    const p = probe(f.full); if (!p) throw new Error('no video stream in the file'); if (!(p.duration > 0)) throw new Error('the video has no length');
    const k = Math.min(1, LONG / Math.max(p.width, p.height)); const t0 = Date.now(); const tmp = path.join(proxyDir, `${id}.part.mp4`);
    const vf = [...upright(p), `fps=${FPS}`, `scale=${even(p.width * k)}:${even(p.height * k)}:flags=area`, colour(p)].join(',');
    // at 50 frames a second and more, frames no other frame is predicted from are not decoded: the proxy takes 15 a second (a quarter less decoding on 4K 60 fps HEVC)
    ff([...(p.fps >= 50 ? ['-skip_frame', 'noref'] : []), '-i', f.full, '-an', '-sn', '-dn', '-vf', vf, '-c:v', 'libx264', '-crf', '30', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', tmp]);
    fs.renameSync(tmp, proxy);
    out.set(id, { id, cid: f.cid, ...place(f.rel), bytes: f.bytes, duration: +p.duration.toFixed(3), width: p.width, height: p.height, fps: p.fps, rotation: p.rotation, hasAudio: p.hasAudio, codec: p.codec, hdr: p.hdr, vfr: p.vfr, bitDepth: p.bitDepth, proxy: `proxy/${id}.mp4` });
    if (old && old.rel !== f.rel) moved.push({ id, from: old.rel, to: f.rel });
    added++; save(); process.stderr.write(`${tag}: ${p.width}x${p.height} ${p.fps} fps ${p.duration.toFixed(1)} s ${p.codec}${p.hdr ? ` ${p.hdr}` : ''}${p.rotation ? ` rot ${p.rotation}` : ''} -> proxy in ${((Date.now() - t0) / 1000).toFixed(1)} s\n`);
  } catch (e) { for (const junk of [path.join(proxyDir, `${id}.part.mp4`)]) if (fs.existsSync(junk)) fs.unlinkSync(junk); const why = String(e.message || e).replace(/\[[^\]]*@ 0x[0-9a-f]+\]\s*/g, '').split(f.full).join(f.rel).slice(0, 300); failed.push({ rel: f.rel, error: why }); process.stderr.write(`${tag}: FAILED ${why}\n`); }
});
save();
const removed = before.filter((c) => !out.has(c.id)).map((c) => c.rel);
process.stdout.write(`${JSON.stringify({ found: found.length, added, skipped, moved, duplicates, removed, failed, total: out.size, clips: clipsFile })}\n`);
