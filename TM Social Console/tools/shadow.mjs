// Shadowboxing clips for Fight Mode › Practice › SHADOWBOXING, made on this PC.
//
// Drop footage anywhere under raw-footage/ (a folder per shoot is tidy), then:
//
//   npm run shadow -- scan        add new clips to shadow/manifest.json (labels from
//                                 shadow/seed-*.csv, else what you said on camera via Whisper)
//   npm run shadow -- split "<long video>" [--disc "Muay Thai+Kickboxing"] [--group Teeps] [--into <folder>] [--dry]
//                                 one long take of many moves → 12–40 s parts in raw-footage/<folder>/
//   npm run shadow -- build       previews for the editor + the app's 720p videos,
//                                 posters and index.json in exports/shadow/app/
//                                 [--jobs 3] [--only <file>] [--force]
//   npm run shadow -- edit        the clip editor: http://localhost:4610
//                                 (label, trim, framing, poster; rebuild one clip)
//   npm run shadow -- status      what's labelled, built, waiting
//   npm run shadow -- check       looks at every app video: the right clip under each name, as
//                                 long as its trim, 720p, muted, and index.json matching the manifest
//   npm run shadow -- deliver     copy exports/shadow/app/ into the app checkout's
//                                 public/static/practice/shadow/ (to preview the app locally)
//   npm run shadow -- handoff --push [--note "<a line for the log entry>"]
//                                 the app chat's route (HANDOFF.md): a
//                                 claude/console-handoff-<date>-shadowboxing branch cut
//                                 from origin/app with only those files, pushed to GitHub.
//                                 Owner's OK first: the repo is public.
//                                 --commit instead of --push makes the branch in the app
//                                 checkout without pushing, to look at it first.
//
// The app's format is documented in components/training-mode/data/shadowboxing.js
// on the app branch: <name>.mp4 (720p, ~1 MB per 25 s, muted), <name>.webp
// poster, and index.json { clips: [{ id, discipline, group, title, video,
// seconds, level, note }] }.
//
// shadow/manifest.json holds only your decisions (labels, trims, framing).
// Everything under exports/shadow/ can be deleted and rebuilt.
import { execFileSync, spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TM = path.resolve(ROOT, '..');
const RAW = path.join(ROOT, 'raw-footage');
const SHADOW = path.join(ROOT, 'shadow');
const MANIFEST = path.join(SHADOW, 'manifest.json');
const OUT = path.join(ROOT, 'exports', 'shadow');
const D = {
  proxy: path.join(OUT, 'proxy'),
  thumbs: path.join(OUT, 'thumbs'),
  analysis: path.join(OUT, 'analysis'),
  built: path.join(OUT, 'built'),
  app: path.join(OUT, 'app'),
};
const REPO = process.env.TM_APP_REPO || path.join(TM, 'trainingmodecode');
const APP_SHADOW = (repo) => path.join(repo, 'public', 'static', 'practice', 'shadow');
const WHISPER_EXE = path.join(ROOT, 'whisper.cpp', process.platform === 'win32' ? 'main.exe' : 'main');
const WHISPER_MODEL = path.join(ROOT, 'whisper.cpp', 'ggml-base.en.bin');
const PORT = Number(process.env.TM_SHADOW_PORT || 4610);
const PRACTICE_INDEX = path.join(ROOT, 'exports', '_practice_index', 'practice_index.csv');
// The handoff commit's co-author line: whichever chat runs the handoff sets its own with TM_COAUTHOR.
const COAUTHOR = process.env.TM_COAUTHOR || 'Claude Fable 5.2 <noreply@anthropic.com>';

export const DISCIPLINES = ['Boxing', 'Kickboxing', 'Muay Thai', 'MMA'];
export const LEVELS = ['Beginner', 'Intermediate', 'Advanced'];
const VIDEO_EXT = /\.(mp4|mov|m4v)$/i;
const ENC = 'v1'; // bump to rebuild every app video
const MAX_AUTO_ZOOM = 1.35;

// App video: the console's tutorial settings (tools/app-video.mjs on the console
// branch) with a bitrate cap so 140 clips stay near the app's ~1 MB per 25 s.
const X264_APP = ['-c:v', 'libx264', '-preset', 'slow', '-crf', '30', '-profile:v', 'high', '-maxrate', '420k', '-bufsize', '840k',
  '-g', '90', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an'];
// Editor preview: fast, a keyframe every second for scrubbing, sound kept so you hear the move called.
const X264_PROXY = ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '30', '-g', '30', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
  '-c:a', 'aac', '-b:a', '64k', '-ac', '1'];

// ─── small helpers ───────────────────────────────────────────────────────────
const posix = (p) => p.split(path.sep).join('/');
const round = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const even = (v) => Math.max(2, Math.floor(v / 2) * 2);
const exists = (f) => fs.existsSync(f);
const readJson = (f, fallback = null) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return fallback; } };
function writeJson(f, v) {
  fs.mkdirSync(path.dirname(f), { recursive: true });
  const tmp = `${f}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(v, null, 2) + '\n');
  fs.renameSync(tmp, f);
}
const slugify = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70) || 'clip';
// A cache name per clip: the file's own name plus a short tag for its folder (two shoots can reuse a name).
const baseOf = (key) => `${path.posix.basename(key).replace(VIDEO_EXT, '').replace(/[^A-Za-z0-9._~-]+/g, '_')}-${crypto.createHash('sha1').update(path.posix.dirname(key)).digest('hex').slice(0, 5)}`;
const srcOf = (clip) => path.join(RAW, ...clip.key.split('/'));
const nameOf = (clip) => path.posix.basename(clip.key);

function run(cmd, args, { capture = false } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { windowsHide: true });
    const out = [];
    let err = '';
    p.stdout.on('data', (b) => { if (capture) out.push(b); });
    p.stderr.on('data', (b) => { err += b; if (err.length > 4e6) err = err.slice(-2e6); });
    p.on('error', reject);
    p.on('close', (code) => (code === 0
      ? resolve({ stdout: Buffer.concat(out), stderr: err })
      : reject(new Error(`${path.basename(cmd)} exited ${code}: ${err.trim().split(/\r?\n/).slice(-3).join(' | ')}`))));
  });
}

// GPU decoding (-hwaccel auto) is faster, but the driver sometimes refuses a device
// ("Failed to create Direct3D device"); then decode on the CPU instead.
async function ffmpegHw(args) {
  try { return await run('ffmpeg', args); } catch (err) {
    const i = args.indexOf('-hwaccel');
    if (i < 0) throw err;
    return run('ffmpeg', [...args.slice(0, i), ...args.slice(i + 2)]);
  }
}

async function pool(items, n, fn) {
  let i = 0;
  const worker = async () => { while (i < items.length) { const it = items[i++]; await fn(it); } };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(n, items.length)) }, worker));
}

function walk(dir, out = []) {
  if (!exists(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name.startsWith('_')) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (VIDEO_EXT.test(e.name) && !/\.(working|part)\./i.test(e.name)) out.push(full);
  }
  return out;
}

// Minimal CSV (quoted fields, doubled quotes).
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') q = false;
      else field += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((v) => v !== '')) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((v) => v !== '')) rows.push(row);
  const [head, ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? '').trim()])));
}

// ─── manifest ────────────────────────────────────────────────────────────────
function loadManifest() {
  const m = readJson(MANIFEST, null) ?? { version: 1, clips: [] };
  m.clips ??= [];
  return m;
}
const saveManifest = (m) => writeJson(MANIFEST, m);

const normDiscipline = (d) => DISCIPLINES.find((x) => x.toLowerCase() === String(d).trim().toLowerCase());
const isReady = (c) => !!(c.include && c.title?.trim() && c.disciplines?.length);

// Unique app file names, in manifest order, for the clips that go to the app.
function slugMap(m) {
  const used = new Set();
  const map = new Map();
  for (const c of m.clips) {
    if (!isReady(c)) continue;
    const t = slugify(c.title), d = slugify(c.disciplines[0]);
    const base = t.startsWith(d) ? t : `${d}-${t}`; // "Muay Thai Stance" → muay-thai-stance, not muay-thai-muay-thai-stance
    let s = base;
    for (let n = 2; used.has(s); n++) s = `${base}-${n}`;
    used.add(s);
    map.set(c.key, s);
  }
  return map;
}

function loadSeeds() {
  const seeds = new Map();
  if (!exists(SHADOW)) return seeds;
  for (const f of fs.readdirSync(SHADOW).filter((n) => /^seed.*\.csv$/i.test(n)).sort()) {
    for (const r of parseCsv(fs.readFileSync(path.join(SHADOW, f), 'utf8'))) if (r.file) seeds.set(r.file.toLowerCase(), r);
  }
  return seeds;
}

function loadHeard() {
  const heard = new Map();
  if (!exists(PRACTICE_INDEX)) return heard;
  for (const r of parseCsv(fs.readFileSync(PRACTICE_INDEX, 'utf8'))) if (r.file) heard.set(r.file.toLowerCase(), r.heard || '');
  return heard;
}

async function probe(file) {
  const { stdout } = await run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries',
    'stream=width,height:stream_side_data=rotation:format=duration', '-of', 'json', file], { capture: true });
  const j = JSON.parse(stdout.toString() || '{}');
  const s = j.streams?.[0] ?? {};
  const rotation = Number(s.side_data_list?.find((d) => d.rotation != null)?.rotation ?? 0) || 0;
  return { duration: round(Number(j.format?.duration ?? 0), 3), width: s.width || 0, height: s.height || 0, rotation };
}
const dims = (c) => (Math.abs(c.rotation || 0) % 180 === 90 ? [c.height, c.width] : [c.width, c.height]);

// What you said on camera in the first 12 s (whisper.cpp, on this PC).
async function hear(file) {
  if (!exists(WHISPER_EXE) || !exists(WHISPER_MODEL)) return '';
  const wav = path.join(os.tmpdir(), `tm-shadow-${process.pid}-${Math.random().toString(36).slice(2)}.wav`);
  try {
    await run('ffmpeg', ['-v', 'error', '-y', '-t', '12', '-i', file, '-vn', '-ac', '1', '-ar', '16000', wav]);
    const { stdout } = await run(WHISPER_EXE, ['-m', WHISPER_MODEL, '-f', wav, '-nt', '-np', '-t', String(Math.min(8, os.cpus().length))], { capture: true });
    return stdout.toString().replace(/\s+/g, ' ').trim();
  } catch { return ''; } finally { fs.rmSync(wav, { force: true }); }
}
// "Lead uppercut." → "Lead Uppercut"; music tags and filler → nothing.
function guessTitle(heard) {
  const t = heard.replace(/\[[^\]]*\]|\([^)]*\)/g, ' ').replace(/[^A-Za-z0-9' -]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!t || t.split(' ').length > 6) return '';
  return t.replace(/\b[a-z]/g, (ch) => ch.toUpperCase());
}

async function scan() {
  const m = loadManifest();
  const known = new Set(m.clips.map((c) => c.key));
  const found = walk(RAW).map((f) => posix(path.relative(RAW, f))).sort();
  const fresh = found.filter((k) => !known.has(k));
  const seeds = loadSeeds();
  const heardIdx = loadHeard();
  let listened = 0;
  for (const key of fresh) {
    const file = path.join(RAW, ...key.split('/'));
    const info = await probe(file);
    const name = path.posix.basename(key).toLowerCase();
    const seed = seeds.get(name);
    let heard = seed?.heard || heardIdx.get(name) || '';
    if (!seed && !heard) { heard = await hear(file); listened++; }
    const comment = [seed?.comment, seed?.comment2].filter(Boolean).join(' · ');
    const clip = {
      key, batch: path.posix.dirname(key) === '.' ? '' : path.posix.dirname(key), ...info,
      heard, guess: seed?.title ? '' : guessTitle(heard), comment,
      include: seed ? !/^(no|n|false|0)$/i.test(seed.include) : true,
      disciplines: (seed?.disciplines || '').split('+').map(normDiscipline).filter(Boolean),
      group: seed?.group || '', title: seed?.title || '', level: LEVELS.find((l) => l.toLowerCase() === (seed?.level || '').toLowerCase()) || '',
      note: '', in: null, out: null, poster: null, frame: null, added: new Date().toISOString(),
    };
    m.clips.push(clip);
    console.log(`+ ${key}  ${clip.title ? `${clip.disciplines.join('+')} › ${clip.group} › ${clip.title}` : `needs a label${heard ? ` (heard "${heard.slice(0, 60)}")` : ''}`}`);
  }
  m.clips.sort((a, b) => a.key.localeCompare(b.key));
  saveManifest(m);
  const gone = m.clips.filter((c) => !exists(srcOf(c)));
  console.log(`\n${fresh.length} new clip(s)${listened ? `, ${listened} labelled from what you said on camera` : ''}. ${m.clips.length} in the manifest.`);
  if (gone.length) console.log(`${gone.length} clip(s) in the manifest are no longer in raw-footage/: ${gone.slice(0, 5).map(nameOf).join(', ')}${gone.length > 5 ? '…' : ''}`);
  return m;
}

// ─── long takes: split into clips ────────────────────────────────────────────
// A long recording of many moves becomes parts of 12–40 s: a cut wherever you
// call a move out (Whisper), else at the stillest moment in the window. Video
// is copied as-is (no quality loss); sound becomes AAC (camera PCM won't fit an
// MP4). The original is only read. Parts land in raw-footage/<folder>/ with a
// seed CSV (discipline, group, what was heard), then scan adds them.

// Copy [a, b] of a file into its own clip.
async function cutCopy(src, a, b, out) {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const tmp = `${out}.part.mp4`;
  await run('ffmpeg', ['-v', 'error', '-y', '-ss', String(round(a, 3)), '-i', src, '-t', String(round(b - a, 3)),
    '-map', '0:v:0', '-map', '0:a:0?', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', '-avoid_negative_ts', 'make_zero', tmp]);
  fs.renameSync(tmp, out);
}

// Whisper over the whole take, with times (cached per file).
async function transcribeLong(src, cache) {
  if (exists(cache)) return readJson(cache);
  if (!exists(WHISPER_EXE) || !exists(WHISPER_MODEL)) return [];
  const wav = cache.replace(/\.json$/, '.wav');
  await run('ffmpeg', ['-v', 'error', '-y', '-i', src, '-vn', '-ac', '1', '-ar', '16000', wav]);
  await run(WHISPER_EXE, ['-m', WHISPER_MODEL, '-f', wav, '-t', String(Math.min(12, os.cpus().length)), '-np', '-oj', '-of', cache.replace(/\.json$/, '')]);
  fs.rmSync(wav, { force: true });
  return readJson(cache);
}
const spoken = (j) => (j?.transcription ?? []).map((s) => ({ t: s.offsets.from / 1000, text: s.text.replace(/\[[^\]]*\]|\([^)]*\)/g, '').trim() }))
  .filter((s) => /[A-Za-z]{2,}/.test(s.text));

// How much changes frame to frame, 5 times a second, smoothed over a second.
async function motionSeries(src) {
  const W = 96, H = 54, P = W * H, FPS = 5;
  const { stdout } = await run('ffmpeg', ['-v', 'error', '-i', src, '-an', '-vf', `fps=${FPS},scale=${W}:${H}:flags=area,format=gray`, '-f', 'rawvideo', '-'], { capture: true });
  const n = Math.floor(stdout.length / P);
  const e = [0];
  for (let i = 1; i < n; i++) { let s = 0; for (let k = 0; k < P; k++) s += Math.abs(stdout[i * P + k] - stdout[(i - 1) * P + k]); e.push(s / P); }
  return { fps: FPS, e: e.map((_, i) => { let s = 0, c = 0; for (let j = Math.max(0, i - 2); j <= Math.min(n - 1, i + 2); j++) { s += e[j]; c++; } return s / c; }) };
}

async function splitLong(file, { into, disciplines = '', group = '', min = 12, max = 40, dry = false } = {}) {
  const src = path.resolve(file);
  if (!exists(src)) throw new Error(`Not found: ${src}`);
  if (src.startsWith(RAW + path.sep) && !path.relative(RAW, src).split(path.sep).some((p) => p.startsWith('_'))) {
    throw new Error('Keep the long original outside raw-footage/ (or in a folder starting with _), or scan would add it as one clip.');
  }
  const info = await probe(src);
  const prefix = slugify(path.basename(src).replace(VIDEO_EXT, ''));
  const folder = into || `${path.basename(src).replace(VIDEO_EXT, '')} (split)`;
  fs.mkdirSync(path.join(OUT, 'split'), { recursive: true });
  console.log(`${path.basename(src)}: ${Math.round(info.duration)} s. Listening for call-outs…`);
  const calls = spoken(await transcribeLong(src, path.join(OUT, 'split', `${prefix}.json`)));
  console.log(`${calls.length} call-out(s). Measuring movement…`);
  const { fps, e } = await motionSeries(src);
  const cuts = [0];
  let cur = 0;
  while (info.duration - cur > max) {
    const lo = cur + min, hi = cur + max;
    const call = calls.find((c) => c.t - 0.3 >= lo && c.t - 0.3 <= hi);
    let t = hi, best = Infinity;
    if (call) t = call.t - 0.3;
    else for (let i = Math.ceil(lo * fps); i <= Math.floor(hi * fps) && i < e.length; i++) if (e[i] < best) { best = e[i]; t = i / fps; }
    cuts.push(round(t, 2));
    cur = t;
  }
  if (cuts.length > 1 && info.duration - cuts[cuts.length - 1] < 6) cuts.pop();
  const parts = cuts.map((a, i) => ({ a, b: i + 1 < cuts.length ? cuts[i + 1] : info.duration }))
    .map((p, i) => ({ ...p, name: `${prefix}-${String(i + 1).padStart(2, '0')}.mp4`, heard: calls.filter((c) => c.t >= p.a - 0.3 && c.t < p.b - 0.3).map((c) => c.text).join(' · ') }));
  const clock2 = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  for (const p of parts) console.log(`  ${p.name}  ${clock2(p.a)}–${clock2(p.b)}  (${Math.round(p.b - p.a)} s)${p.heard ? `  heard "${p.heard.slice(0, 50)}"` : ''}`);
  if (dry) { console.log(`\n${parts.length} parts (dry run: nothing written).`); return; }
  const dir = path.join(RAW, folder);
  let i = 0;
  for (const p of parts) {
    const out = path.join(dir, p.name);
    if (!exists(out)) await cutCopy(src, p.a, p.b, out);
    process.stdout.write(`\r  cut ${++i}/${parts.length}`);
  }
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = parts.map((p) => [p.name, 'yes', disciplines, group, '', '', `part of ${path.basename(src)} from ${clock2(p.a)} to ${clock2(p.b)}`, '', p.heard].map(q).join(','));
  fs.writeFileSync(path.join(SHADOW, `seed-split-${prefix}.csv`), ['file,include,disciplines,group,title,level,comment,comment2,heard', ...rows].join('\n') + '\n');
  console.log(`\n${parts.length} parts in raw-footage/${folder}/. Adding them…`);
  await scan();
}

// The editor's "Split here": two new clips from one, the old entry kept but hidden.
async function splitClip(key, at) {
  const m0 = loadManifest();
  const c = m0.clips.find((x) => x.key === key);
  if (!c || c.split) throw new Error('no such clip');
  const t = round(Number(at), 2);
  if (!(t >= 1 && t <= c.duration - 1)) throw new Error('Split at least 1 s from either end');
  const dir = path.posix.dirname(c.key), name = path.posix.basename(c.key).replace(VIDEO_EXT, '');
  const keyFor = (s) => (dir === '.' ? `${name}${s}.mp4` : `${dir}/${name}${s}.mp4`);
  const made = [];
  for (const [a, b, s] of [[0, t, 'a'], [t, c.duration, 'b']]) {
    let k = keyFor(s);
    for (let n = 2; exists(path.join(RAW, ...k.split('/'))) || m0.clips.some((x) => x.key === k); n++) k = keyFor(`${s}${n}`);
    await cutCopy(srcOf(c), a, b, path.join(RAW, ...k.split('/')));
    made.push(k);
  }
  const m = loadManifest(); // fresh: you may have typed while it cut
  const orig = m.clips.find((x) => x.key === key);
  orig.split = true; orig.include = false; orig.splitAt = t;
  for (const k of made) {
    const info = await probe(path.join(RAW, ...k.split('/')));
    m.clips.push({
      key: k, batch: orig.batch, ...info, heard: orig.heard, guess: orig.guess || '', comment: [orig.comment, `split from ${name} at ${t} s`].filter(Boolean).join(' · '),
      include: true, disciplines: orig.disciplines ?? [], group: orig.group ?? '', title: orig.title ?? '', level: orig.level ?? '', note: '',
      in: null, out: null, poster: null, frame: null, added: new Date().toISOString(), from: key,
    });
  }
  m.clips.sort((x, y) => x.key.localeCompare(y.key));
  saveManifest(m);
  return made;
}

// ─── motion analysis: auto trim, auto framing, poster moment ────────────────
// Keyframes only (about one a second on a phone), 128×72 grey. The camera is
// still, so what differs from the clip's median picture is you moving.
const AW = 128, AH = 72;
const analysisCache = new Map();
function readAnalysis(clip) {
  const f = path.join(D.analysis, `${baseOf(clip.key)}.json`);
  if (!exists(f)) return null;
  const mt = fs.statSync(f).mtimeMs;
  const hit = analysisCache.get(f);
  if (hit && hit.mt === mt) return hit.a;
  const a = readJson(f);
  analysisCache.set(f, { mt, a });
  return a;
}

async function analyse(clip) {
  const have = readAnalysis(clip);
  if (have) return have;
  const { stdout, stderr } = await run('ffmpeg', ['-hide_banner', '-loglevel', 'info', '-skip_frame', 'nokey', '-i', srcOf(clip), '-an',
    '-vf', `scale=${AW}:${AH}:flags=area,format=gray,showinfo`, '-fps_mode', 'passthrough', '-f', 'rawvideo', '-'], { capture: true });
  const P = AW * AH;
  const n = Math.floor(stdout.length / P);
  let times = [...stderr.matchAll(/Parsed_showinfo.*?pts_time:\s*([\d.]+)/g)].map((x) => Number(x[1]));
  if (times.length !== n) times = Array.from({ length: n }, (_, i) => (clip.duration * i) / Math.max(1, n));
  const a = { v: 1, w: AW, h: AH, times: times.map((t) => round(t, 3)), cols: [], rows: [] };
  if (n >= 2) {
    const bg = new Uint8Array(P);
    const col = new Uint8Array(n);
    for (let p = 0; p < P; p++) {
      for (let i = 0; i < n; i++) col[i] = stdout[i * P + p];
      bg[p] = col.slice().sort()[n >> 1];
    }
    for (let i = 0; i < n; i++) {
      const cs = new Array(AW).fill(0), rs = new Array(AH).fill(0);
      for (let y = 0; y < AH; y++) for (let x = 0; x < AW; x++) {
        const p = y * AW + x;
        if (Math.abs(stdout[i * P + p] - bg[p]) > 24) { cs[x]++; rs[y]++; }
      }
      a.cols.push(cs); a.rows.push(rs);
    }
  }
  writeJson(path.join(D.analysis, `${baseOf(clip.key)}.json`), a);
  return a;
}

const sum = (arr) => arr.reduce((s, v) => s + v, 0);
const median = (arr) => { const s = [...arr].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };

// Walking up to the camera to start or stop recording: big, close, reaching the
// bottom of the frame. Trim those seconds off the ends (never more than 30%).
function autoTrim(a, duration) {
  const none = { in: 0, out: duration };
  if (!a || a.rows.length < 6) return none;
  const n = a.rows.length;
  const mass = a.rows.map(sum);
  const med = median(mass);
  const low = a.rows.map((r) => { for (let y = a.h - 1; y >= 0; y--) if (r[y] >= 3) return (y + 1) / a.h; return 0; });
  const near = (i) => mass[i] > Math.max(2.5 * med, 0.06 * a.w * a.h) && low[i] > 0.95;
  let s = 0; while (s < n && near(s)) s++;
  let e = n - 1; while (e >= 0 && near(e)) e--;
  let tin = s > 0 && s < n ? a.times[s] : 0;
  let tout = e >= 0 && e < n - 1 ? (a.times[e] + a.times[e + 1]) / 2 : duration;
  if (tin > 0.3 * duration) tin = 0;
  if (duration - tout > 0.3 * duration) tout = duration;
  if (tout - tin < 2) return none;
  return { in: round(tin), out: round(Math.min(tout, duration)) };
}

function span(arr, lo, hi) {
  const total = sum(arr);
  let acc = 0, a = 0, b = arr.length - 1;
  for (let i = 0; i < arr.length; i++) { acc += arr[i]; if (acc >= lo * total) { a = i; break; } }
  acc = 0;
  for (let i = arr.length - 1; i >= 0; i--) { acc += arr[i]; if (acc >= (1 - hi) * total) { b = i; break; } }
  return [a / arr.length, (b + 1) / arr.length];
}

// Fit the area you move in (plus room for head, feet and reach) into the 16:9
// frame; never zoom past 1.35 so a step or a kick stays in shot.
function autoFrame(a, tin, tout, clip) {
  const def = { zoom: 1, cx: 0.5, cy: 0.5 };
  if (!a || !a.cols.length) return def;
  const C = new Array(a.w).fill(0), R = new Array(a.h).fill(0);
  a.times.forEach((t, i) => {
    if (t < tin - 0.05 || t > tout + 0.05) return;
    a.cols[i].forEach((v, x) => { C[x] += v; });
    a.rows[i].forEach((v, y) => { R[y] += v; });
  });
  if (sum(C) < 60) return def;
  const [x0, x1] = span(C, 0.03, 0.97);
  const [y0, y1] = span(R, 0.02, 0.98);
  const [W, H] = dims(clip);
  const bw = Math.min(W, (H * 16) / 9), bh = (bw * 9) / 16;
  const needW = (x1 - x0 + 0.2) * W, needH = (y1 - y0 + 0.24) * H;
  const zoom = clamp(Math.min(bw / needW, bh / needH), 1, MAX_AUTO_ZOOM);
  return { zoom: round(zoom), cx: round((x0 + x1) / 2, 3), cy: round((y0 + y1) / 2 - 0.02, 3) };
}

// Poster: the keyframe with the most movement in the middle of the clip (a strike, not a stance).
function autoPoster(a, tin, tout) {
  const mid = tin + (tout - tin) * 0.4;
  if (!a || !a.rows.length) return round(mid);
  let best = -1, at = mid;
  a.times.forEach((t, i) => {
    if (t < tin + (tout - tin) * 0.15 || t > tout - (tout - tin) * 0.15) return;
    const m = sum(a.rows[i]);
    if (m > best) { best = m; at = t; }
  });
  return round(at);
}

function effective(clip, a = readAnalysis(clip)) {
  const auto = autoTrim(a, clip.duration);
  const tin = clamp(clip.in ?? auto.in, 0, Math.max(0, clip.duration - 0.5));
  const tout = clamp(clip.out ?? auto.out, tin + 0.5, clip.duration);
  const af = autoFrame(a, tin, tout, clip);
  const frame = clip.frame ? { zoom: clamp(Number(clip.frame.zoom) || 1, 1, 3), cx: clamp(Number(clip.frame.cx) || 0.5, 0, 1), cy: clamp(Number(clip.frame.cy) || 0.5, 0, 1) } : af;
  const poster = clamp(clip.poster ?? autoPoster(a, tin, tout), tin, tout - 0.05);
  return { in: round(tin), out: round(tout), frame, poster: round(poster), auto: { in: auto.in, out: auto.out, frame: af }, analysed: !!a };
}

function cropFor(clip, frame) {
  const [W, H] = dims(clip);
  const bw = Math.min(W, (H * 16) / 9), bh = (bw * 9) / 16;
  const w = even(bw / frame.zoom), h = even(bh / frame.zoom);
  const x = even(clamp(Math.round(frame.cx * W - w / 2), 0, W - w));
  const y = even(clamp(Math.round(frame.cy * H - h / 2), 0, H - h));
  return { w, h, x: Math.min(x, W - w), y: Math.min(y, H - h) };
}

// ─── build ───────────────────────────────────────────────────────────────────
const builtFile = (clip) => path.join(D.built, `${baseOf(clip.key)}.json`);
const proxyFile = (clip) => path.join(D.proxy, `${baseOf(clip.key)}.mp4`);
const thumbFile = (clip) => path.join(D.thumbs, `${baseOf(clip.key)}.jpg`);
function appHash(clip, e) {
  const st = fs.statSync(srcOf(clip));
  return crypto.createHash('sha1').update(JSON.stringify([ENC, st.size, Math.round(st.mtimeMs), e.in, e.out, e.frame, e.poster])).digest('hex').slice(0, 16);
}

async function buildClip(clip, slug, { force = false } = {}) {
  for (const d of Object.values(D)) fs.mkdirSync(d, { recursive: true });
  const src = srcOf(clip);
  const a = await analyse(clip);
  const e = effective(clip, a);
  const proxy = proxyFile(clip);
  const needProxy = force || !exists(proxy);
  let prev = readJson(builtFile(clip));
  const video = slug && path.join(D.app, `${slug}.mp4`);
  const poster = slug && path.join(D.app, `${slug}.webp`);
  const hash = slug ? appHash(clip, e) : null;
  // A new title only changes the file name: rename what's built instead of encoding again. Not when
  // another clip now has the old name (two clips with one title): those files may already be its own.
  if (slug && !force && prev?.hash === hash && prev.slug !== slug && !exists(video)
      && exists(path.join(D.app, `${prev.slug}.mp4`)) && exists(path.join(D.app, `${prev.slug}.webp`))
      && ![...slugMap(loadManifest()).values()].includes(prev.slug)) {
    const old = prev.slug;
    prev = { ...prev, slug };
    writeJson(builtFile(clip), prev);
    fs.renameSync(path.join(D.app, `${old}.mp4`), video);
    fs.renameSync(path.join(D.app, `${old}.webp`), poster);
  }
  const needApp = !!slug && (force || !prev || prev.hash !== hash || prev.slug !== slug || !exists(video) || !exists(poster));
  const c = cropFor(clip, e.frame);
  const appChain = `fps=30,crop=${c.w}:${c.h}:${c.x}:${c.y},scale=1280:720:flags=lanczos,format=yuv420p`;
  const proxyChain = 'fps=30,scale=-2:540:flags=bilinear,format=yuv420p';
  // Temp names per process: the editor and a background build (SHADOW EDITOR.bat starts both) can reach one clip together.
  const tmpProxy = `${proxy}.${process.pid}.part.mp4`, tmpVideo = video && `${video}.${process.pid}.part.mp4`, tmpPoster = poster && `${poster}.${process.pid}.part.webp`;
  const did = [];

  if (needProxy && needApp) {
    await ffmpegHw(['-v', 'error', '-y', '-hwaccel', 'auto', '-i', src, '-filter_complex',
      `[0:v]split=2[p][f];[p]${proxyChain}[pv];[f]trim=start=${e.in}:end=${e.out},setpts=PTS-STARTPTS,${appChain}[fv]`,
      '-map', '[pv]', '-map', '0:a?', ...X264_PROXY, tmpProxy,
      '-map', '[fv]', ...X264_APP, tmpVideo]);
  } else if (needProxy) {
    await ffmpegHw(['-v', 'error', '-y', '-hwaccel', 'auto', '-i', src, '-vf', proxyChain, '-map', '0:v:0', '-map', '0:a?', ...X264_PROXY, tmpProxy]);
  } else if (needApp) {
    await ffmpegHw(['-v', 'error', '-y', '-hwaccel', 'auto', '-ss', String(e.in), '-i', src, '-t', String(round(e.out - e.in, 3)),
      '-vf', appChain, '-map', '0:v:0', ...X264_APP, tmpVideo]);
  }
  if (needProxy) {
    fs.renameSync(tmpProxy, proxy);
    await run('ffmpeg', ['-v', 'error', '-y', '-ss', String(e.poster), '-i', proxy, '-frames:v', '1', '-vf', 'scale=320:-2', '-q:v', '5', thumbFile(clip)]);
    did.push('preview');
  }
  if (needApp) {
    await run('ffmpeg', ['-v', 'error', '-y', '-ss', String(round(e.poster - e.in, 3)), '-i', tmpVideo, '-frames:v', '1',
      // RGB in and -q:v: ffmpeg's libwebp ignores -quality (posters came out ~7 KB and blocky) and
      // misreads BT.709 YUV.
      '-vf', 'scale=960:540:flags=lanczos,format=bgra', '-c:v', 'libwebp', '-q:v', '72', tmpPoster]);
    const bytes = fs.statSync(tmpVideo).size;
    // The record goes first, so a tidy-up running elsewhere never takes the new file for a stray.
    writeJson(builtFile(clip), { slug, hash, seconds: Math.max(1, Math.round(e.out - e.in)), bytes, at: new Date().toISOString() });
    fs.renameSync(tmpVideo, video);
    fs.renameSync(tmpPoster, poster);
    did.push(`app ${(bytes / 1e6).toFixed(1)} MB`);
  }
  return did;
}

// index.json from what is built, in manifest order; files nothing points at are removed.
function writeIndex(m = loadManifest()) {
  const slugs = slugMap(m);
  const clips = [];
  const keep = new Set(['index.json']);
  for (const c of m.clips) {
    const slug = slugs.get(c.key);
    if (!slug) continue;
    const b = readJson(builtFile(c));
    // Files built under an earlier title stay until the next build renames them.
    if (b?.slug && b.slug !== slug) { keep.add(`${b.slug}.mp4`); keep.add(`${b.slug}.webp`); }
    if (!b || b.slug !== slug || !exists(path.join(D.app, `${slug}.mp4`)) || !exists(path.join(D.app, `${slug}.webp`))) continue;
    keep.add(`${slug}.mp4`); keep.add(`${slug}.webp`);
    c.disciplines.forEach((d, i) => clips.push({
      id: i ? `${slug}--${slugify(d)}` : slug, discipline: d, ...(c.group?.trim() ? { group: c.group.trim() } : {}),
      title: c.title.trim(), video: `${slug}.mp4`, seconds: b.seconds,
      ...(c.level ? { level: c.level } : {}), ...(c.note?.trim() ? { note: c.note.trim() } : {}),
    }));
  }
  fs.mkdirSync(D.app, { recursive: true });
  writeJson(path.join(D.app, 'index.json'), { clips });
  for (const f of fs.readdirSync(D.app)) if (!keep.has(f) && !f.includes('.part.')) fs.rmSync(path.join(D.app, f), { force: true });
  return clips;
}

async function build({ only, jobs = 3, force = false } = {}) {
  const m = loadManifest();
  if (!m.clips.length) { console.log('The manifest is empty: npm run shadow -- scan'); return; }
  const slugs = slugMap(m);
  let list = m.clips.filter((c) => exists(srcOf(c)));
  if (only) list = list.filter((c) => c.key === only || nameOf(c) === only);
  if (!list.length) { console.log(only ? `No clip called ${only}` : 'Nothing to build'); return; }
  // One build at a time: two would write the same files.
  const lock = path.join(OUT, 'build.lock');
  const holder = Number(readJson(lock)?.pid);
  if (holder && holder !== process.pid) {
    let alive = true;
    try { process.kill(holder, 0); } catch { alive = false; }
    if (alive) { console.log(`A build is already running (process ${holder}). It picks up every clip; let it finish.`); return; }
  }
  writeJson(lock, { pid: process.pid, at: new Date().toISOString() });
  process.on('exit', () => { if (readJson(lock)?.pid === process.pid) fs.rmSync(lock, { force: true }); });
  console.log(`Building ${list.length} clip(s), ${jobs} at a time. Safe to stop and run again: finished work is kept.`);
  let done = 0, failed = 0;
  const t0 = Date.now();
  await pool(list, jobs, async (c) => {
    const t = Date.now();
    try {
      const did = await buildClip(c, slugs.get(c.key), { force });
      done++;
      console.log(`[${done + failed}/${list.length}] ${nameOf(c)}  ${slugs.get(c.key) ?? '(not for the app yet)'}  ${did.length ? did.join(' + ') : 'up to date'}  ${((Date.now() - t) / 1000).toFixed(0)}s`);
    } catch (err) {
      failed++;
      console.log(`[${done + failed}/${list.length}] ${nameOf(c)}  FAILED: ${err.message}`);
    }
  });
  const clips = writeIndex();
  const mb = fs.readdirSync(D.app).reduce((s, f) => s + fs.statSync(path.join(D.app, f)).size, 0) / 1e6;
  console.log(`\nDone in ${((Date.now() - t0) / 60000).toFixed(1)} min. index.json lists ${clips.length} entr${clips.length === 1 ? 'y' : 'ies'}; exports/shadow/app/ is ${mb.toFixed(0)} MB.${failed ? ` ${failed} failed (see above).` : ''}`);
}

// ─── status / deliver / handoff ──────────────────────────────────────────────
function status() {
  const m = loadManifest();
  const slugs = slugMap(m);
  const rows = m.clips.map((c) => {
    const b = readJson(builtFile(c));
    const slug = slugs.get(c.key);
    return { c, slug, proxy: exists(proxyFile(c)), app: !!(slug && b?.slug === slug && b.hash === (exists(srcOf(c)) ? appHash(c, effective(c)) : '')) };
  });
  const need = rows.filter((r) => r.c.include && !isReady(r.c));
  console.log(`${m.clips.length} clips · ${rows.filter((r) => r.slug).length} labelled for the app · ${need.length} need a label · ${m.clips.filter((c) => !c.include).length} left out`);
  console.log(`previews made: ${rows.filter((r) => r.proxy).length}/${m.clips.length} · app videos up to date: ${rows.filter((r) => r.app).length}/${rows.filter((r) => r.slug).length}`);
  for (const d of DISCIPLINES) console.log(`  ${d.padEnd(11)} ${rows.filter((r) => r.slug && r.c.disciplines.includes(d)).length}`);
  if (need.length) console.log(`need a label: ${need.slice(0, 12).map((r) => nameOf(r.c)).join(', ')}${need.length > 12 ? '…' : ''}`);
}

// ─── check ───────────────────────────────────────────────────────────────────
// Is every app video the clip its name says, cut as the manifest says, and is
// index.json the list the manifest asks for? `status` only compares records: a
// file renamed under the wrong clip once put a 38 s video behind a 6 s move and
// status still read "up to date". Run before deliver; handoff runs it itself.
async function probeApp(file) {
  const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,width,height:format=duration', '-of', 'json', file], { capture: true });
  const j = JSON.parse(stdout.toString() || '{}');
  const v = j.streams?.find((s) => s.codec_type === 'video') ?? {};
  return { duration: Number(j.format?.duration ?? 0), width: v.width || 0, height: v.height || 0, audio: !!j.streams?.some((s) => s.codec_type === 'audio') };
}

async function check({ quiet = false } = {}) {
  const m = loadManifest();
  const slugs = slugMap(m);
  const index = readJson(path.join(D.app, 'index.json'))?.clips ?? [];
  const listed = new Set(index.map((c) => c.video));
  const problems = [];
  const ready = m.clips.filter((c) => slugs.has(c.key));
  await pool(ready, 4, async (c) => {
    const slug = slugs.get(c.key);
    const say = (what) => problems.push(`${slug} (${nameOf(c)}): ${what}`);
    if (/\b(bad|wrong|false)\s+(take|start)\b/i.test(c.title)) say(`its title "${c.title.trim()}" reads like a note to yourself: leave it out of the app, or give it the move's name`);
    if (!exists(srcOf(c))) { say('its footage is no longer in raw-footage/'); return; }
    const b = readJson(builtFile(c));
    const video = path.join(D.app, `${slug}.mp4`), poster = path.join(D.app, `${slug}.webp`);
    const e = effective(c);
    if (!b || b.slug !== slug || !exists(video) || !exists(poster) || b.hash !== appHash(c, e)) { say('not built since its last edit: npm run shadow -- build'); return; }
    const redo = `npm run shadow -- build --only ${nameOf(c)} --force`;
    if (fs.statSync(video).size !== b.bytes) { say(`the file under this name is not the one built for it: ${redo}`); return; }
    const v = await probeApp(video);
    if (Math.abs(v.duration - (e.out - e.in)) > 0.25) say(`the video runs ${v.duration.toFixed(1)} s but its trim is ${(e.out - e.in).toFixed(1)} s: ${redo}`);
    if (v.width !== 1280 || v.height !== 720 || v.audio) say(`the video is ${v.width}×${v.height}${v.audio ? ' with sound' : ''}, not 1280×720 muted: ${redo}`);
    if (!listed.has(`${slug}.mp4`)) say('missing from index.json: npm run shadow -- index');
  });
  const want = new Set(ready.map((c) => `${slugs.get(c.key)}.mp4`));
  const ids = new Set();
  for (const e of index) {
    if (ids.has(e.id)) problems.push(`index.json lists the id ${e.id} twice: npm run shadow -- index`);
    ids.add(e.id);
    if (!want.has(e.video)) problems.push(`index.json still lists ${e.video}, which the manifest no longer sends to the app: npm run shadow -- index`);
  }
  const unlabelled = m.clips.filter((c) => c.include && !isReady(c));
  const found = [...new Set(problems)].sort(); // a clip in two disciplines is listed twice
  if (found.length) console.log(found.map((p) => `  ✗ ${p}`).join('\n'));
  if (!quiet || found.length) {
    console.log(`${found.length ? `${found.length} problem(s)` : 'All good'}: ${ready.length} clips for the app, ${index.length} entries in index.json.${
      unlabelled.length ? ` ${unlabelled.length} ticked for the app still need a label and are not in it: ${unlabelled.slice(0, 6).map(nameOf).join(', ')}${unlabelled.length > 6 ? '…' : ''}.` : ''}`);
  }
  return found.length === 0;
}

function mirror(from, to) {
  fs.mkdirSync(to, { recursive: true });
  const want = new Set(fs.readdirSync(from).filter((f) => !f.includes('.part.')));
  let copied = 0, removed = 0;
  for (const f of want) {
    const s = fs.statSync(path.join(from, f));
    const t = path.join(to, f);
    if (exists(t)) { const ts = fs.statSync(t); if (ts.size === s.size && ts.mtimeMs >= s.mtimeMs) continue; }
    fs.copyFileSync(path.join(from, f), t);
    copied++;
  }
  for (const f of fs.readdirSync(to)) if (!want.has(f) && /\.(mp4|webp|json)$/i.test(f)) { fs.rmSync(path.join(to, f)); removed++; }
  return { copied, removed, total: want.size };
}

function deliver(to) {
  if (!exists(path.join(D.app, 'index.json'))) throw new Error('Nothing built yet: npm run shadow -- build');
  const target = to ? path.resolve(to) : APP_SHADOW(REPO);
  if (!to && !exists(path.join(REPO, '.git'))) throw new Error(`No app checkout at ${REPO}. Clone it there (git clone -b app https://github.com/Trainingmodeco/trainingmodecode.git) or pass --to <folder>.`);
  const r = mirror(D.app, target);
  console.log(`${target}\n${r.copied} copied, ${r.removed} removed, ${r.total} files in place.`);
}

function handoff({ push, commit, note }) {
  const git = (args, cwd = REPO) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  if (!exists(path.join(REPO, '.git'))) throw new Error(`No app checkout at ${REPO}`);
  const index = readJson(path.join(D.app, 'index.json'));
  if (!index?.clips?.length) throw new Error('Nothing built yet: npm run shadow -- build');
  const files = fs.readdirSync(D.app).filter((f) => !f.includes('.part.'));
  const mb = files.reduce((s, f) => s + fs.statSync(path.join(D.app, f)).size, 0) / 1e6;
  const videos = new Set(index.clips.map((c) => c.video)).size; // a clip in two disciplines is one video, two entries
  // Today on this PC's calendar, not UTC: an evening handoff must not be dated tomorrow.
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  if (!push && !commit) {
    console.log(`Would push ${videos} clips (${index.clips.length} entries, ${files.length} files, ${mb.toFixed(0)} MB) on claude/console-handoff-${date}-shadowboxing, cut from origin/app, with a HANDOFF.md log entry. Run with --commit to make that branch here and look at it first, or with --push once the owner says yes.`);
    return;
  }
  git(['fetch', 'origin', 'app']);
  let branch = `claude/console-handoff-${date}-shadowboxing`;
  for (let n = 2; git(['ls-remote', '--heads', 'origin', branch]); n++) branch = `claude/console-handoff-${date}-shadowboxing-${n}`;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-shadow-handoff-'));
  // -B: a branch of this name left here by an earlier --commit run starts again from origin/app.
  git(['worktree', 'add', '-q', '-B', branch, dir, 'origin/app']);
  try {
    const r = mirror(D.app, APP_SHADOW(dir));
    execFileSync('node', ['scripts/lock-assets.mjs', '--write'], { cwd: dir, stdio: 'inherit' });
    const per = DISCIPLINES.map((d) => `${d} ${index.clips.filter((c) => c.discipline === d).length}`).join(', ');
    const handoffMd = path.join(dir, 'HANDOFF.md');
    if (exists(handoffMd)) {
      const entry = [`### ${date} · console → app · Shadowboxing clips (\`${branch}\`)`, '',
        `- **Delivered:** ${videos} clips as ${index.clips.length} entries in \`public/static/practice/shadow/index.json\` (${per}), 720p muted H.264 with .webp posters, ${mb.toFixed(0)} MB. Assets only, per the format in the log entry below.`,
        '- **Made locally** on the owner\'s PC by `TM Social Console/tools/shadow.mjs` (scan → label/trim/frame in the clip editor → build → handoff). Clips in two disciplines are one video with two entries (`<slug>--<discipline>` ids).',
        '- **Not linked** to Technique Library entries or lessons (no `videoUrl` changes).',
        ...(note ? [`- **Note:** ${String(note).replace(/\s+/g, ' ').trim()}`] : []), '', ''];
      // Git for Windows checks files out with CRLF: match either, and write the entry the same way.
      const md = fs.readFileSync(handoffMd, 'utf8');
      const eol = md.includes('\r\n') ? '\r\n' : '\n';
      const at = /## Log\r?\n\r?\n/.exec(md);
      if (!at) throw new Error('HANDOFF.md has no "## Log" heading: add the log entry by hand.');
      const cut = at.index + at[0].length;
      fs.writeFileSync(handoffMd, md.slice(0, cut) + entry.join(eol) + md.slice(cut));
    }
    git(['add', '-A'], dir);
    // A PC with no git identity signs as the repo's other commits do.
    let me = '';
    try { me = git(['config', 'user.email'], dir); } catch { /* not set */ }
    const ident = me ? [] : ['-c', 'user.name=Claude', '-c', 'user.email=noreply@anthropic.com'];
    git([...ident, 'commit', '-q', '-m', `Console handoff ${date}: ${videos} shadowboxing clips for Practice (${index.clips.length} entries)\n\nCo-Authored-By: ${COAUTHOR}`], dir);
    if (push) {
      git(['push', '-u', 'origin', branch], dir);
      console.log(`Pushed ${branch} (${r.total} files). The app chat (or the owner) merges it into app.`);
    } else {
      console.log(`Committed ${branch} in ${REPO} (${r.total} files). Not pushed.\n  look:  git -C "${REPO}" show --stat ${branch}\n  push:  git -C "${REPO}" push -u origin ${branch}   (owner's OK first: the repo is public)`);
    }
  } finally {
    try { git(['worktree', 'remove', '--force', dir]); } catch { /* left for git worktree prune */ }
  }
}

// ─── the clip editor (local web page) ────────────────────────────────────────
function view(c, slugs) {
  const ok = exists(srcOf(c));
  const e = ok ? effective(c) : null;
  const b = readJson(builtFile(c));
  const slug = slugs.get(c.key) ?? null;
  return {
    ...c, name: nameOf(c), base: baseOf(c.key), slug, ready: isReady(c), missing: !ok,
    needsLabel: !!c.include && !isReady(c), effective: e,
    preview: exists(proxyFile(c)), thumb: exists(thumbFile(c)),
    app: slug && b?.slug === slug ? { upToDate: ok && b.hash === appHash(c, e), bytes: b.bytes, seconds: b.seconds } : null,
  };
}

function state() {
  const m = loadManifest();
  const slugs = slugMap(m);
  const groups = {};
  for (const c of m.clips) for (const d of c.disciplines ?? []) if (c.group) (groups[d] ??= new Set()).add(c.group);
  return {
    clips: m.clips.map((c) => view(c, slugs)), disciplines: DISCIPLINES, levels: LEVELS,
    groups: Object.fromEntries(Object.entries(groups).map(([d, s]) => [d, [...s]])), repo: exists(path.join(REPO, '.git')) ? REPO : null,
  };
}

function patchClip(key, body) {
  const m = loadManifest();
  const c = m.clips.find((x) => x.key === key);
  if (!c) throw new Error('no such clip');
  const num = (v) => (v === null || v === '' ? null : Number.isFinite(Number(v)) ? round(Number(v), 3) : undefined);
  for (const [k, v] of Object.entries(body)) {
    if (k === 'include') c.include = !!v;
    else if (k === 'disciplines' && Array.isArray(v)) c.disciplines = DISCIPLINES.filter((d) => v.includes(d));
    else if (['title', 'group', 'note', 'comment'].includes(k)) c[k] = String(v ?? '').slice(0, k === 'note' ? 140 : 80);
    else if (k === 'level') c.level = LEVELS.includes(v) ? v : '';
    else if (['in', 'out', 'poster'].includes(k)) { const n = num(v); if (n !== undefined) c[k] = n === null ? null : clamp(n, 0, c.duration); }
    else if (k === 'frame') c.frame = v && typeof v === 'object' ? { zoom: round(clamp(Number(v.zoom) || 1, 1, 3)), cx: round(clamp(Number(v.cx) || 0.5, 0, 1), 3), cy: round(clamp(Number(v.cy) || 0.5, 0, 1), 3) } : null;
  }
  if (c.in != null && c.out != null && c.out - c.in < 0.5) c.out = round(Math.min(c.duration, c.in + 0.5), 3);
  saveManifest(m);
  return view(c, slugMap(m));
}

function sendFile(req, res, file, type) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); res.end(); return; }
    const head = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache' };
    const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
    if (m && (m[1] || m[2])) {
      let start = m[1] ? Number(m[1]) : Math.max(0, st.size - Number(m[2]));
      let end = m[1] && m[2] ? Math.min(Number(m[2]), st.size - 1) : st.size - 1;
      if (start >= st.size || start > end) { res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }); res.end(); return; }
      res.writeHead(206, { ...head, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Content-Length': end - start + 1 });
      fs.createReadStream(file, { start, end }).pipe(res);
    } else {
      res.writeHead(200, { ...head, 'Content-Length': st.size });
      fs.createReadStream(file).pipe(res);
    }
  });
}

function serve({ open = false } = {}) {
  const queue = [];
  let busy = null;
  const building = () => [busy, ...queue.map((q) => q.key)].filter(Boolean);
  const pump = async () => {
    if (busy || !queue.length) return;
    const job = queue.shift();
    busy = job.key;
    try {
      const m = loadManifest();
      const c = m.clips.find((x) => x.key === job.key);
      await buildClip(c, slugMap(m).get(c.key));
      writeIndex();
      job.resolve(view(c, slugMap(loadManifest())));
    } catch (err) { job.reject(err); } finally { busy = null; pump(); }
  };
  const json = (res, code, v) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(v)); };
  const inside = (dir, name) => { const f = path.resolve(dir, name); return f.startsWith(path.resolve(dir) + path.sep) ? f : null; };
  const body = (req) => new Promise((resolve, reject) => { let s = ''; req.on('data', (b) => { s += b; if (s.length > 1e5) req.destroy(); }); req.on('end', () => { try { resolve(JSON.parse(s || '{}')); } catch (e) { reject(e); } }); });

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      const p = decodeURIComponent(url.pathname);
      if (p === '/' && req.method === 'GET') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(fs.readFileSync(path.join(SHADOW, 'editor.html'))); return; }
      if (p === '/api/state') { json(res, 200, { ...state(), building: building() }); return; }
      if (p === '/api/clip' && req.method === 'PUT') { json(res, 200, patchClip(url.searchParams.get('key'), await body(req))); return; }
      if (p === '/api/build' && req.method === 'POST') {
        const key = url.searchParams.get('key');
        if (!loadManifest().clips.some((c) => c.key === key)) { json(res, 404, { error: 'no such clip' }); return; }
        const done = new Promise((resolve, reject) => queue.push({ key, resolve, reject }));
        pump();
        json(res, 200, await done);
        return;
      }
      if (p === '/api/split' && req.method === 'POST') {
        const made = await splitClip(url.searchParams.get('key'), url.searchParams.get('t'));
        for (const k of made) queue.push({ key: k, resolve() {}, reject() {} }); // previews follow in the background
        pump();
        json(res, 200, { made });
        return;
      }
      const media = /^\/media\/(proxy|thumbs|app)\/(.+)$/.exec(p);
      if (media && req.method === 'GET') {
        const f = inside(D[media[1]], media[2]);
        const type = /\.mp4$/i.test(p) ? 'video/mp4' : /\.webp$/i.test(p) ? 'image/webp' : /\.jpe?g$/i.test(p) ? 'image/jpeg' : 'application/octet-stream';
        if (f) { sendFile(req, res, f, type); return; }
      }
      res.writeHead(404); res.end('not found');
    } catch (err) { json(res, 500, { error: err.message }); }
  });
  server.listen(PORT, '127.0.0.1', () => {
    const at = `http://localhost:${PORT}`;
    console.log(`Clip editor: ${at}  (Ctrl+C to stop)`);
    if (open && process.platform === 'win32') spawn('cmd', ['/c', 'start', '', at], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
  });
}

// ─── command line ────────────────────────────────────────────────────────────
const [cmd = 'status', ...rest] = process.argv.slice(2);
const opt = (name) => { const i = rest.indexOf(name); return i >= 0 ? rest[i + 1] : undefined; };
const has = (name) => rest.includes(name);
try {
  if (cmd === 'scan') await scan();
  else if (cmd === 'build') await build({ only: opt('--only'), jobs: Number(opt('--jobs') || 3), force: has('--force') });
  else if (cmd === 'split') {
    const file = rest.find((a, i) => !a.startsWith('--') && !(rest[i - 1] || '').startsWith('--'));
    if (!file) throw new Error('usage: npm run shadow -- split "<long video>" [--disc "Muay Thai+Kickboxing"] [--group Teeps] [--into "<folder>"] [--min 12] [--max 40] [--dry]');
    await splitLong(file, { into: opt('--into'), disciplines: opt('--disc') || '', group: opt('--group') || '', min: Number(opt('--min') || 12), max: Number(opt('--max') || 40), dry: has('--dry') });
  }
  else if (cmd === 'index') console.log(`${writeIndex().length} entries in exports/shadow/app/index.json`);
  else if (cmd === 'status') status();
  else if (cmd === 'deliver') deliver(opt('--to'));
  else if (cmd === 'check') { if (!(await check())) process.exitCode = 1; }
  else if (cmd === 'handoff') {
    // Nothing leaves this PC unchecked: the list is made again from the manifest, then every video is looked at.
    if (has('--push') || has('--commit')) {
      writeIndex();
      if (!(await check({ quiet: true }))) throw new Error('Not handed off: fix what is listed above, then run it again.');
    }
    handoff({ push: has('--push'), commit: has('--commit'), note: opt('--note') });
  }
  else if (cmd === 'edit') serve({ open: has('--open') });
  else { console.log('npm run shadow -- scan | split "<long video>" [--disc …] [--group …] [--dry] | build [--jobs 3] [--only <file>] [--force] | edit | status | check | deliver [--to <folder>] | handoff [--commit | --push] [--note "…"]'); process.exitCode = 1; }
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
}
