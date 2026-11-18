// Raw workout footage → the Exercise Loop Board (the editor the Fight Mode chat built; its data is the board's shared database).
//
// This is the laptop's end of that bridge. The big footage lives here; the board (a claude.ai artifact) shows a small filmstrip and
// preview of each stretch where someone is exercising, with a guessed exercise name, for the owner to name and queue. This tool makes
// those pieces with ffmpeg and Whisper (no model tokens). Nothing here spends generation credits: a loop is only made when the owner
// queues stretches on the board and tells Claude to run the queue.
//
//   node tools/loop-intake.mjs scan             list every video under "TM Social Console folder" (not the Practice Mode folder)
//   node tools/loop-intake.mjs run [--jobs 3] [--only <file>] [--limit N] [--force]
//                                               per clip: a small analysis copy, what is said in the first 14 s, the stretches of
//                                               exercise, and each stretch's filmstrip + preview. Safe to stop and run again.
//   node tools/loop-intake.mjs catalog <catalog.json>   the app's exercise names, one per line, for naming
//   node tools/loop-intake.mjs sheets           contact sheets of the stretches that have no guessed name yet, 10 rows each
//   node tools/loop-intake.mjs link <listing.txt>       match uploaded assets (the board's asset listing) to local files by sha256
//   node tools/loop-intake.mjs docs             the board's "segs" documents, from the analysis, the guesses and the asset map
//   node tools/loop-intake.mjs status
//
// Everything under exports/loop-intake/ can be deleted and rebuilt. The footage itself is only read.
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FOOTAGE = process.env.TM_FOOTAGE || path.resolve(ROOT, '..', 'TM Social Console folder');
const OUT = path.join(ROOT, 'exports', 'loop-intake');
const D = Object.fromEntries(['proxy', 'analysis', 'assets', 'sheets', 'guesses', 'docs'].map((k) => [k, path.join(OUT, k)]));
const MANIFEST = path.join(OUT, 'manifest.json');
const ASSET_MAP = path.join(OUT, 'assets-map.json');
const WHISPER_EXE = path.join(ROOT, 'whisper.cpp', process.platform === 'win32' ? 'main.exe' : 'main');
const WHISPER_MODEL = path.join(ROOT, 'whisper.cpp', 'ggml-base.en.bin');
const FPS = 12, AW = 160, AH = 90; // analysis copy: 12 fps; motion is measured on 160x90 grey pictures...
const BW = AW / 4, BH = Math.floor(AH / 4); // ...averaged into 40x22 blocks, so water, leaves and screens shimmering behind the athlete do not count as movement
const VIDEO = /\.(mp4|mov|m4v)$/i;
const SKIP_FOLDER = /shadowbox|practice/i; // the Practice Mode folder is not part of this

// ─── small helpers ───────────────────────────────────────────────────────────
const posix = (p) => p.split(path.sep).join('/');
const round = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const even = (v) => Math.max(2, 2 * Math.round(v / 2));
const exists = (f) => fs.existsSync(f);
const readJson = (f, fallback = null) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return fallback; } };
function writeJson(f, v) {
  fs.mkdirSync(path.dirname(f), { recursive: true });
  const tmp = `${f}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(v, null, 2) + '\n');
  fs.renameSync(tmp, f);
}
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
async function pool(items, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.max(1, Math.min(n, items.length)) }, async () => { while (i < items.length) { const it = items[i++]; await fn(it); } }));
}
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name.startsWith('_')) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (VIDEO.test(e.name) && !/\.(working|part)\./i.test(e.name)) out.push(full);
  }
  return out;
}
const idOf = (folder, file) => crypto.createHash('sha1').update(`${folder}/${file}`).digest('hex').slice(0, 10);
const absOf = (c) => path.join(FOOTAGE, ...c.rel.split('/'));
const loadManifest = () => readJson(MANIFEST) ?? { version: 1, clips: [] };
const sha256 = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

// ─── scan ────────────────────────────────────────────────────────────────────
async function probe(file) {
  const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,width,height,avg_frame_rate:stream_side_data=rotation:format=duration', '-of', 'json', file], { capture: true });
  const j = JSON.parse(stdout.toString() || '{}');
  const v = (j.streams ?? []).find((s) => s.codec_type === 'video') ?? {};
  const rot = Number(v.side_data_list?.find((d) => d.rotation != null)?.rotation ?? 0) || 0;
  const turned = Math.abs(rot) % 180 === 90;
  const [num, den] = String(v.avg_frame_rate || '0/1').split('/').map(Number);
  return {
    seconds: round(Number(j.format?.duration ?? 0), 3),
    width: turned ? v.height : v.width, height: turned ? v.width : v.height,
    fps: den ? round(num / den, 2) : 0, audio: (j.streams ?? []).some((s) => s.codec_type === 'audio'),
  };
}

function sources() {
  const out = [];
  for (const e of fs.readdirSync(FOOTAGE, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name.startsWith('_')) continue;
    if (e.isDirectory()) {
      if (SKIP_FOLDER.test(e.name)) continue;
      for (const f of walk(path.join(FOOTAGE, e.name))) out.push({ folder: e.name, abs: f });
    } else if (VIDEO.test(e.name)) out.push({ folder: 'loose files', abs: path.join(FOOTAGE, e.name) });
  }
  return out;
}

async function scan() {
  const old = new Map(loadManifest().clips.map((c) => [c.clipId, c]));
  const skip = new Set(readJson(path.join(OUT, 'skip.json'), []) ?? []); // "folder/file" names that are not the owner's workout footage
  const clips = [];
  await pool(sources().filter((s) => !skip.has(s.folder) && !skip.has(`${s.folder}/${path.basename(s.abs)}`)), 6, async (s) => {
    const file = path.basename(s.abs), clipId = idOf(s.folder, file), st = fs.statSync(s.abs), prev = old.get(clipId);
    if (prev && prev.bytes === st.size) { clips.push(prev); return; }
    clips.push({ clipId, folder: s.folder, file, rel: posix(path.relative(FOOTAGE, s.abs)), bytes: st.size, ...(await probe(s.abs)) });
  });
  clips.sort((a, b) => a.folder.localeCompare(b.folder) || a.file.localeCompare(b.file));
  writeJson(MANIFEST, { version: 1, clips });
  const by = {};
  for (const c of clips) { by[c.folder] ??= { n: 0, s: 0, b: 0 }; by[c.folder].n++; by[c.folder].s += c.seconds; by[c.folder].b += c.bytes; }
  for (const [f, v] of Object.entries(by)) console.log(`${f.padEnd(40)} ${String(v.n).padStart(3)} videos  ${(v.s / 60).toFixed(0).padStart(3)} min  ${(v.b / 1e9).toFixed(1)} GB`);
  console.log(`${clips.length} videos in the manifest.`);
}

// ─── one clip: the analysis copy, what was said, the stretches of exercise ──────
async function ensureProxy(c) {
  const out = path.join(D.proxy, `${c.clipId}.mp4`);
  if (exists(out)) return out;
  fs.mkdirSync(D.proxy, { recursive: true });
  const tmp = `${out}.${process.pid}.part.mp4`;
  // 12 fps, short side 540: one pass over the big original, which everything after reads instead.
  const enc = ['-an', '-vf', "fps=12,scale='if(gt(iw,ih),-2,540)':'if(gt(iw,ih),540,-2)':flags=bilinear,format=yuv420p",
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '27', '-g', '24', '-movflags', '+faststart', tmp];
  try { await run('ffmpeg', ['-v', 'error', '-y', '-hwaccel', 'auto', '-i', absOf(c), ...enc]); } catch { await run('ffmpeg', ['-v', 'error', '-y', '-i', absOf(c), ...enc]); }
  fs.renameSync(tmp, out);
  return out;
}

// What the owner says in the first 14 s ("narrow push-ups, not diamond"): a hint for naming, never the name itself.
async function hear(c) {
  if (!c.audio || !exists(WHISPER_EXE) || !exists(WHISPER_MODEL)) return '';
  const wav = path.join(os.tmpdir(), `tm-loop-${process.pid}-${c.clipId}.wav`);
  try {
    await run('ffmpeg', ['-v', 'error', '-y', '-t', '14', '-i', absOf(c), '-vn', '-ac', '1', '-ar', '16000', wav]);
    const { stdout } = await run(WHISPER_EXE, ['-m', WHISPER_MODEL, '-f', wav, '-nt', '-np', '-t', '4'], { capture: true });
    return stdout.toString().replace(/\[[^\]]*\]|\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200);
  } catch { return ''; } finally { fs.rmSync(wav, { force: true }); }
}

function toBlocks(gray) {
  const out = new Uint8Array(BW * BH);
  for (let by = 0; by < BH; by++) for (let bx = 0; bx < BW; bx++) {
    let s = 0;
    for (let y = 0; y < 4; y++) { const row = (by * 4 + y) * AW + bx * 4; s += gray[row] + gray[row + 1] + gray[row + 2] + gray[row + 3]; }
    out[by * BW + bx] = s >> 4;
  }
  return out;
}

async function readFrames(file) {
  const { stdout } = await run('ffmpeg', ['-v', 'error', '-i', file, '-an', '-vf', `scale=${AW}:${AH}:flags=area,format=gray`, '-f', 'rawvideo', '-'], { capture: true });
  const P = AW * AH, n = Math.floor(stdout.length / P);
  return Array.from({ length: n }, (_, i) => toBlocks(stdout.subarray(i * P, (i + 1) * P)));
}

function movavg(a, w) {
  const n = a.length, S = new Float64Array(n + 1), h = w >> 1, out = new Float32Array(n);
  for (let i = 0; i < n; i++) S[i + 1] = S[i] + a[i];
  for (let i = 0; i < n; i++) { const lo = Math.max(0, i - h), hi = Math.min(n, i + h + 1); out[i] = (S[hi] - S[lo]) / (hi - lo); }
  return out;
}
const pct = (arr, p) => { const s = Float32Array.from(arr).sort(); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : 0; };

// How much of the picture changes from one frame to the next, and where the changing part sits left to right.
function motion(frames) {
  const n = frames.length, P = BW * BH, m = new Float32Array(n), cx = new Float32Array(n).fill(NaN);
  for (let i = 1; i < n; i++) {
    const a = frames[i], b = frames[i - 1];
    let c = 0, c2 = 0, sx = 0;
    for (let p = 0; p < P; p++) { const d = a[p] - b[p]; if (d > 8 || d < -8) { c++; if (d > 14 || d < -14) { c2++; sx += p % BW; } } }
    m[i] = c / P;
    if (c2 >= 3) cx[i] = sx / c2 / BW;
  }
  if (n > 1) m[0] = m[1];
  return { m, cx };
}

// Runs of movement, joined across pauses shorter than gapSec (the top of a rep), dropped under 3 s.
function intervals(ms, thr, gapSec = 2) {
  const n = ms.length, runs = [];
  for (let i = 0; i < n;) {
    if (ms[i] > thr) { let j = i; while (j < n && ms[j] > thr) j++; runs.push([i, j]); i = j; } else i++;
  }
  const merged = [];
  for (const r of runs) { const last = merged[merged.length - 1]; if (last && r[0] - last[1] < gapSec * FPS) last[1] = r[1]; else merged.push([...r]); }
  return merged.filter(([a, b]) => b - a >= 3 * FPS);
}

// Walking up to the camera or away from it: a short burst well above the rest of the stretch, at either end.
function trimEnds(ms, a, b) {
  if (b - a < 5 * FPS) return [a, b];
  const med = pct(ms.subarray(a, b), 0.5) || 1e-6, cap = Math.round(2.5 * FPS);
  let s = a, e = b;
  while (s < a + cap && s < b - 3 * FPS && ms[s] > 1.8 * med) s++;
  while (e > b - cap && e > s + 3 * FPS && ms[e - 1] > 1.8 * med) e--;
  return [s, e];
}

function stretchStats(frames, a, b) {
  const P = BW * BH, k = Math.min(48, b - a), med = new Uint8Array(P), col = new Uint8Array(k);
  const picks = Array.from({ length: k }, (_, j) => frames[a + Math.floor(((j + 0.5) * (b - a)) / k)]);
  for (let p = 0; p < P; p++) { for (let j = 0; j < k; j++) col[j] = picks[j][p]; col.sort(); med[p] = col[k >> 1]; }
  const n = b - a, d = new Float32Array(n), cols = new Float64Array(BW), rows = new Float64Array(BH);
  let fg = 0;
  for (let i = 0; i < n; i++) {
    const f = frames[a + i];
    let s = 0;
    for (let p = 0; p < P; p++) { const df = Math.abs(f[p] - med[p]); s += df; if (df > 20) { cols[p % BW]++; rows[(p / BW) | 0]++; fg++; } }
    d[i] = s / P;
  }
  return { d, cols, rows, fg };
}

// How often the body comes back to the same pose: the autocorrelation of its distance from the stretch's median picture.
function periodicity(d) {
  const n = d.length;
  if (n < 3 * FPS) return null;
  let mean = 0;
  for (const v of d) mean += v;
  mean /= n;
  const x = Float64Array.from(d, (v) => v - mean);
  let r0 = 0;
  for (const v of x) r0 += v * v;
  r0 /= n;
  if (r0 < 1e-6) return null;
  const minLag = Math.ceil(0.7 * FPS), maxLag = Math.min(Math.floor(10 * FPS), Math.floor(n / 2));
  if (maxLag <= minLag + 2) return null;
  const r = new Float64Array(maxLag + 2);
  for (let l = minLag - 1; l <= maxLag + 1; l++) { let s = 0; for (let i = 0; i + l < n; i++) s += x[i] * x[i + l]; r[l] = s / (n - l) / r0; }
  let best = -1;
  for (let l = minLag; l <= maxLag; l++) best = Math.max(best, r[l]);
  if (best < 0.12) return { score: round(Math.max(best, 0), 2), period: null };
  for (let l = minLag; l <= maxLag; l++) if (r[l] >= r[l - 1] && r[l] >= r[l + 1] && r[l] >= 0.8 * best) return { score: round(r[l], 2), period: round(l / FPS, 2) };
  return null;
}

function span(arr, lo, hi) {
  let total = 0;
  for (const v of arr) total += v;
  if (!total) return [0.2, 0.8];
  let acc = 0, a = 0, b = arr.length - 1;
  for (let i = 0; i < arr.length; i++) { acc += arr[i]; if (acc >= lo * total) { a = i; break; } }
  acc = 0;
  for (let i = arr.length - 1; i >= 0; i--) { acc += arr[i]; if (acc >= (1 - hi) * total) { b = i; break; } }
  return [a / arr.length, (b + 1) / arr.length];
}

// The picture box around where the body moves: portrait for an upright move, square or wide for floor work.
function cropFor(st, pw, ph) {
  const [x0, x1] = st.fg < 12 ? [0.2, 0.8] : span(st.cols, 0.02, 0.98);
  const [y0, y1] = st.fg < 12 ? [0.05, 0.95] : span(st.rows, 0.02, 0.98);
  const bw = Math.max(8, (x1 - x0) * pw), bh = Math.max(8, (y1 - y0) * ph), ratio = bw / bh;
  const asp = ratio > 1.35 ? 4 / 3 : ratio > 0.95 ? 1 : 0.8;
  let h = Math.max(bh * 1.25, (bw * 1.25) / asp, 0.42 * ph), w = h * asp;
  if (h > ph) { h = ph; w = h * asp; }
  if (w > pw) { w = pw; h = w / asp; }
  w = Math.min(even(w), even(pw) - 2 * 0); h = Math.min(even(h), ph);
  const cx = ((x0 + x1) / 2) * pw, cy = ((y0 + y1) / 2) * ph;
  return { w: even(Math.min(w, pw)), h: even(Math.min(h, ph)), x: even(clamp(cx - w / 2, 0, Math.max(0, pw - w))), y: even(clamp(cy - h / 2, 0, Math.max(0, ph - h))) };
}

function analyse(c, frames, pw, ph) {
  const n = frames.length, dur = n / FPS;
  const { m, cx } = motion(frames), ms = movavg(m, 7);
  const p90 = pct(ms, 0.9), thr = Math.max(0.01, 0.25 * p90);
  let iv = intervals(ms, thr);
  for (let g = 4; iv.length > 6 && g <= 12; g += 2) iv = intervals(ms, thr, g); // at most six stretches a clip
  const stretches = [];
  const add = (a, b, hold) => {
    let st = stretchStats(frames, a, b);
    if (!hold) {
      // Pull the ends in where the body is far outside the poses seen in the middle of the stretch: sitting up to stop the camera,
      // walking in to start it. Never more than 30% from either end, and never below 3 s.
      const n = b - a, mid = Array.from(st.d.subarray(Math.floor(n * 0.2), Math.ceil(n * 0.8))).sort((x, y) => x - y);
      const mu = mid[mid.length >> 1] ?? 0, mad = Array.from(mid, (v) => Math.abs(v - mu)).sort((x, y) => x - y)[mid.length >> 1] ?? 0;
      const lim = mu + 6 * Math.max(1.4826 * mad, 0.12 * mu, 0.3), maxCut = Math.floor(n * 0.3);
      let s = 0, e = n;
      while (s < maxCut && st.d[s] > lim) s++;
      while (n - e < maxCut && st.d[e - 1] > lim) e--;
      if ((s > 0 || e < n) && e - s >= 3 * FPS) { const a2 = a + s, b2 = a + e; a = a2; b = b2; st = stretchStats(frames, a, b); }
    }
    const per = periodicity(st.d), lenS = (b - a) / FPS;
    let sum = 0;
    for (let i = a; i < b; i++) sum += ms[i];
    const meanM = sum / (b - a);
    const xs = [];
    for (let i = a; i < b; i++) if (!Number.isNaN(cx[i])) xs.push(cx[i]);
    const travel = xs.length > 20 ? pct(xs, 0.95) - pct(xs, 0.05) : 0;
    let kind = 'exercise', why = '';
    if (hold) { kind = 'junk'; why = 'Almost no movement here. If this is a hold (plank, wall sit, hang), name it and tick Hold.'; }
    else if (per && per.period && per.score >= 0.22) kind = 'exercise';
    else if (lenS >= 6 && meanM >= 0.008 && travel < 0.45) kind = 'exercise';
    else { kind = 'junk'; why = travel >= 0.45 ? 'Mostly moving across the frame: walking or setting up.' : 'The movement here does not repeat. It may be setting up, resting or stretching.'; }
    const reps = per && per.period ? Math.max(1, Math.round(lenS / per.period)) : null;
    const start = round(Math.max(0, a / FPS - 0.25), 2), end = round(Math.min(dur, b / FPS + 0.25), 2);
    stretches.push({
      idx: stretches.length + 1, id: `${c.clipId}-${String(stretches.length + 1).padStart(2, '0')}`, start, end,
      reps, period: per?.period ?? null, score: per?.score ?? 0, kind, why,
      hold: hold ? [round(a / FPS, 1), round(b / FPS, 1)] : null,
      warn: [...(reps !== null && reps < 3 ? ['Only one or two reps here'] : []), ...(kind === 'exercise' && travel >= 0.3 ? ['The athlete moves across the frame: check where this starts and ends'] : [])], crop: cropFor(st, pw, ph),
    });
  };
  if (iv.length) for (const [a0, b0] of iv) { const [a, b] = trimEnds(ms, a0, b0); add(a, b, false); }
  else if (dur >= 5) add(Math.round(0.5 * FPS), n - Math.round(0.5 * FPS), true);
  return { v: 1, clipId: c.clipId, file: c.file, folder: c.folder, dur: round(dur, 2), proxy: { w: pw, h: ph }, p90: round(p90, 4), thr: round(thr, 4), stretches };
}

async function renderStretches(c, an, force = false) {
  const proxy = path.join(D.proxy, `${c.clipId}.mp4`);
  fs.mkdirSync(D.assets, { recursive: true });
  for (const s of an.stretches) {
    const dur = s.end - s.start, aspect = s.crop.w / s.crop.h, sw = even(160 * aspect), pwid = even(320 * aspect);
    const crop = `crop=${s.crop.w}:${s.crop.h}:${s.crop.x}:${s.crop.y}`;
    const strip = path.join(D.assets, `${s.id}.strip.jpg`), prev = path.join(D.assets, `${s.id}.preview.mp4`);
    // Eight frames across the stretch, one row, each 160 high: the board reads the picture as eight equal frames.
    if (force || !exists(strip)) await run('ffmpeg', ['-v', 'error', '-y', '-ss', String(round(s.start + dur / 16, 3)), '-t', String(round((dur * 15) / 16, 3)), '-i', proxy,
      '-vf', `fps=${(8 / dur).toFixed(5)},${crop},scale=${sw}:160:flags=lanczos,tile=8x1:padding=0:margin=0`, '-frames:v', '1', '-q:v', '4', strip]);
    if (force || !exists(prev)) {
      const tmp = `${prev}.${process.pid}.part.mp4`;
      await run('ffmpeg', ['-v', 'error', '-y', '-ss', String(s.start), '-t', String(round(dur, 3)), '-i', proxy,
        '-vf', `${crop},scale=${pwid}:320:flags=lanczos,fps=12,format=yuv420p`, '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '31', '-g', '24', '-movflags', '+faststart', tmp]);
      fs.renameSync(tmp, prev);
    }
  }
}

async function processClip(c, force) {
  const af = path.join(D.analysis, `${c.clipId}.json`);
  const prev = readJson(af);
  let an = force ? null : prev;
  if (!an) {
    const proxy = await ensureProxy(c);
    const [heard, pj] = await Promise.all([prev?.heard != null ? prev.heard : hear(c), probe(proxy)]);
    const frames = await readFrames(proxy);
    an = analyse(c, frames, pj.width, pj.height);
    an.heard = heard;
    writeJson(af, an);
  }
  await renderStretches(c, an, force);
  return an;
}

async function runAll({ jobs, only, folder, limit, force }) {
  const m = loadManifest();
  if (!m.clips.length) { console.log('Nothing listed yet: node tools/loop-intake.mjs scan'); return; }
  let list = only ? m.clips.filter((c) => c.file === only || c.clipId === only) : m.clips;
  if (folder) list = list.filter((c) => c.folder === folder);
  if (!force) list = list.filter((c) => { const an = readJson(path.join(D.analysis, `${c.clipId}.json`)); return !an || an.stretches.some((s) => !exists(path.join(D.assets, `${s.id}.preview.mp4`))); });
  if (limit) list = list.slice(0, limit);
  console.log(`${list.length} clip(s) to do, ${jobs} at a time. Safe to stop and run again.`);
  let done = 0, failed = 0;
  const t0 = Date.now();
  await pool(list, jobs, async (c) => {
    const t = Date.now();
    try {
      const an = await processClip(c, force);
      done++;
      const k = an.stretches.map((s) => `${s.kind === 'junk' ? 'x' : ''}${s.start}-${s.end}${s.reps ? ` ${s.reps}r` : ''}`).join(' · ');
      console.log(`[${done + failed}/${list.length}] ${c.folder}/${c.file}  ${an.stretches.length} stretch(es): ${k || 'none'}${an.heard ? `  heard "${an.heard.slice(0, 50)}"` : ''}  ${((Date.now() - t) / 1000).toFixed(0)}s`);
    } catch (e) { failed++; console.log(`[${done + failed}/${list.length}] ${c.folder}/${c.file}  FAILED: ${e.message}`); }
  });
  console.log(`Done in ${((Date.now() - t0) / 60000).toFixed(1)} min.${failed ? ` ${failed} failed (above).` : ''}`);
}

// ─── naming: the app's exercise names, and contact sheets to name from ─────────────
function catalogNames(file) {
  const j = readJson(file);
  const list = (Array.isArray(j) ? j : j?.entries) ?? [];
  const lines = list.filter((e) => e.kind !== 'new' || e.name).map((e) => `${e.id}\t${e.name}\t${e.group || ''}\t${e.equipment || ''}`).sort((a, b) => a.split('\t')[2].localeCompare(b.split('\t')[2]) || a.localeCompare(b));
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'catalog-names.tsv'), 'id\tname\tgroup\tequipment\n' + lines.join('\n') + '\n');
  console.log(`${lines.length} exercise names written to exports/loop-intake/catalog-names.tsv`);
}

const guessFiles = () => (exists(D.guesses) ? fs.readdirSync(D.guesses).filter((f) => f.endsWith('.json')).sort() : []);
function loadGuesses() {
  const g = new Map();
  for (const f of guessFiles()) for (const r of readJson(path.join(D.guesses, f), []) ?? []) if (r?.id) g.set(r.id, r);
  return g;
}

// The stretches worth putting in front of the owner: up to two exercise stretches a clip (counted reps first, then the longest), or, when a
// clip has none, its longest stretch, so the clip still shows up to be named or skipped. The rest stay in the analysis. The best gets a preview.
const rank = (s) => (s.reps ? 1e6 : 0) + (s.end - s.start);
function pick(an) {
  const ex = an.stretches.filter((s) => s.kind !== 'junk'), by = (a, b) => rank(b) - rank(a);
  return (ex.length ? [...ex].sort(by).slice(0, 2) : [...an.stretches].sort(by).slice(0, 1)).sort((a, b) => a.idx - b.idx);
}
const bestId = (an) => { const p = pick(an); return p.length ? [...p].sort((a, b) => rank(b) - rank(a))[0].id : null; };

// Contact sheets of the picked stretches that have no guessed name and are not on an earlier sheet, 10 rows each, in a folder per batch tag.
async function sheets(tag = 'b1', retry = false) {
  const m = loadManifest(), guesses = loadGuesses(), rows = [];
  const assignedFile = path.join(OUT, 'sheets-assigned.json'), assigned = retry ? {} : (readJson(assignedFile, {}) ?? {});
  for (const c of m.clips) {
    const an = readJson(path.join(D.analysis, `${c.clipId}.json`));
    if (an) for (const s of pick(an)) if (!guesses.has(s.id) && !assigned[s.id] && exists(path.join(D.assets, `${s.id}.strip.jpg`))) rows.push({ id: s.id, file: c.file, folder: c.folder, start: s.start, end: s.end, reps: s.reps, heard: an.heard || '' });
  }
  const dir = path.join(D.sheets, tag);
  fs.mkdirSync(dir, { recursive: true });
  const font = ['C:/Windows/Fonts/arialbd.ttf', 'C:/Windows/Fonts/arial.ttf'].find(exists);
  const index = [];
  for (let k = 0; k * 10 < rows.length; k++) {
    const chunk = rows.slice(k * 10, k * 10 + 10), name = `${tag}-${String(k + 1).padStart(2, '0')}`;
    const graph = chunk.map((_, i) => `[${i}:v]pad=1712:160:0:0:black${font ? `,drawtext=fontfile='${font.replace(':', '\\:')}':text='${String(i + 1).padStart(2, '0')}':x=6:y=6:fontsize=28:fontcolor=white:box=1:boxcolor=black@0.7` : ''}[r${i}]`).join(';')
      + (chunk.length > 1 ? `;${chunk.map((_, i) => `[r${i}]`).join('')}vstack=inputs=${chunk.length}[o]` : ';[r0]null[o]'); // vstack needs two or more
    await run('ffmpeg', ['-v', 'error', '-y', ...chunk.flatMap((r) => ['-i', path.join(D.assets, `${r.id}.strip.jpg`)]), '-filter_complex', graph, '-map', '[o]', '-frames:v', '1', '-q:v', '4', path.join(dir, `${name}.jpg`)]);
    writeJson(path.join(dir, `${name}.json`), chunk.map((r, i) => ({ row: i + 1, ...r })));
    index.push(name);
  }
  for (const r of rows) assigned[r.id] = tag;
  writeJson(assignedFile, assigned);
  writeJson(path.join(dir, 'index.json'), index);
  console.log(`${rows.length} stretches to name, on ${index.length} sheet(s) of up to 10 rows in exports/loop-intake/sheets/${tag}/.${font ? '' : ' (no font found: rows are not numbered on the picture; they are in order)'}`);
}

// The files still to upload to the board's asset store, 25 to a batch: every picked stretch's strip, and the best one's preview.
// Each batch is written down as it is made (batches/uNN.json) and never changes: the upload tool answers with an id per file in the
// same order, those go in ids/uNN.txt as "bytes id" lines, and `link-ids` matches them up, checking each file's size.
const BATCHES = path.join(OUT, 'batches'), IDS = path.join(OUT, 'ids');
const frozen = () => (exists(BATCHES) ? fs.readdirSync(BATCHES).filter((f) => /^u\d+\.json$/.test(f)).sort() : []);
function uploads(tag) {
  const m = loadManifest(), map = readJson(ASSET_MAP, {}) ?? {}, files = [], assigned = tag ? (readJson(path.join(OUT, 'sheets-assigned.json'), {}) ?? {}) : null;
  const queued = new Set(frozen().flatMap((f) => (readJson(path.join(BATCHES, f), []) ?? []).map((p) => path.basename(p))));
  for (const c of m.clips) {
    const an = readJson(path.join(D.analysis, `${c.clipId}.json`));
    if (!an) continue;
    const best = bestId(an);
    for (const s of pick(an)) if (!assigned || assigned[s.id] === tag) for (const k of s.id === best ? ['strip.jpg', 'preview.mp4'] : ['strip.jpg']) { const f = `${s.id}.${k}`; if (!map[f] && !queued.has(f) && exists(path.join(D.assets, f))) files.push(f); }
  }
  let n = frozen().reduce((mx, f) => Math.max(mx, Number(f.slice(1, -5))), 0);
  const made = [];
  for (let i = 0; i < files.length; i += 25) {
    const name = `u${String(++n).padStart(2, '0')}`;
    writeJson(path.join(BATCHES, `${name}.json`), files.slice(i, i + 25).map((f) => `exports/loop-intake/assets/${f}`));
    made.push(name);
  }
  console.log(`${files.length} files to upload in ${made.length} new batch(es) of up to 25${made.length ? `: ${made[0]}..${made[made.length - 1]} in exports/loop-intake/batches/` : ''}.`);
}

function linkIds() {
  const map = readJson(ASSET_MAP, {}) ?? {};
  let hit = 0, waiting = 0, bad = 0;
  for (const f of frozen()) {
    const name = f.slice(0, -5), idFile = path.join(IDS, `${name}.txt`), list = readJson(path.join(BATCHES, f), []) ?? [];
    if (!exists(idFile)) { waiting += list.length; continue; }
    const lines = fs.readFileSync(idFile, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length !== list.length) { console.log(`${name}: ${lines.length} ids for ${list.length} files: not used`); bad += list.length; continue; }
    list.forEach((p, i) => {
      const [bytes, id] = lines[i].split(/\s+/), file = path.basename(p), local = path.join(D.assets, file);
      if (!/^[A-Za-z0-9]{32}$/.test(id || '') || Number(bytes) !== fs.statSync(local).size) { console.log(`${name} line ${i + 1} (${file}): ${bytes} bytes / id ${id} does not match the file`); bad++; } else { map[file] = id; hit++; }
    });
  }
  writeJson(ASSET_MAP, map);
  console.log(`${hit} files matched to uploaded ids, ${waiting} waiting for ids, ${bad} rejected. ${Object.keys(map).length} in the map.`);
}

// ─── the board's documents ──────────────────────────────────────────────────────
function link(listingFile) {
  const text = fs.readFileSync(listingFile, 'utf8');
  const byHash = new Map();
  for (const mt of text.matchAll(/\/_blob\/([A-Za-z0-9]{32})\s+\S+\s+\d+\s+bytes\s+\S+\s+sha256\s+([0-9a-f]{64})/g)) byHash.set(mt[2], mt[1]);
  const map = readJson(ASSET_MAP, {}) ?? {};
  let hit = 0, miss = 0;
  for (const f of fs.existsSync(D.assets) ? fs.readdirSync(D.assets) : []) {
    if (!/\.(strip\.jpg|preview\.mp4)$/.test(f)) continue;
    const id = byHash.get(sha256(path.join(D.assets, f)));
    if (id) { map[f] = id; hit++; } else miss++;
  }
  writeJson(ASSET_MAP, map);
  console.log(`${byHash.size} assets in the listing; ${hit} local files matched, ${miss} not uploaded yet. ${Object.keys(map).length} in the map.`);
}

function docs(tag) {
  const m = loadManifest(), guesses = loadGuesses(), map = readJson(ASSET_MAP, {}) ?? {}, catalog = new Set();
  const assigned = tag ? (readJson(path.join(OUT, 'sheets-assigned.json'), {}) ?? {}) : null; // only the stretches that went out on sheets of this tag
  const names = path.join(OUT, 'catalog-names.tsv');
  if (exists(names)) for (const l of fs.readFileSync(names, 'utf8').split('\n').slice(1)) if (l) catalog.add(l.split('\t')[0]);
  fs.rmSync(D.docs, { recursive: true, force: true });
  fs.mkdirSync(D.docs, { recursive: true });
  const now = new Date().toISOString();
  let n = 0, named = 0, noAssets = 0;
  const ids = [];
  for (const c of m.clips) {
    const an = readJson(path.join(D.analysis, `${c.clipId}.json`));
    if (!an) continue;
    const best = bestId(an);
    for (const s of pick(an)) {
      if (assigned && assigned[s.id] !== tag) continue;
      const g = guesses.get(s.id), strip = map[`${s.id}.strip.jpg`], preview = map[`${s.id}.preview.mp4`];
      let kind = s.kind, why = s.why;
      if (g && Number(g.confidence) >= 0.6 && (g.kind === 'exercise' || g.kind === 'junk')) { kind = g.kind; why = g.kind === 'junk' ? String(g.why || s.why || '').slice(0, 240) : ''; }
      const body = {
        clipId: c.clipId, idx: s.idx, folder: c.folder, file: c.file, clipDur: round(c.seconds, 1), start: s.start, end: s.end, reps: s.reps, period: s.period, score: s.score,
        group: 0, kind, hold: s.hold, warn: s.warn, why, updatedAt: now,
      };
      if (g && g.name) {
        let conf = clamp(Number(g.confidence) || 0, 0, 1);
        // A plain family name ("Push-Ups", "Squats") is only a guess about the variation unless the owner said the word on camera:
        // from the side hand width and stance cannot be seen, and the board's "Accept Claude's names" takes anything at 0.6 or more.
        const stem = String(g.name).toLowerCase().split(/[^a-z]+/)[0].replace(/s$/, '');
        if (/^(push-?ups?|squats?|lunges?|pull-?ups?|sit-?ups?|crunch(es)?|planks?|burpees?)$/i.test(String(g.name).replace(/\s+/g, '')) && !String(an.heard || '').toLowerCase().includes(stem)) conf = Math.min(conf, 0.55);
        body.guess = { name: String(g.name).slice(0, 80), entryId: g.entryId && catalog.has(g.entryId) ? g.entryId : null, confidence: round(conf, 2), view: ['front', 'side', 'back'].includes(g.view) ? g.view : null };
        named++;
      }
      if (strip) body.strip = strip;
      if (preview && s.id === best) body.preview = preview;
      if (!strip || (s.id === best && !preview)) noAssets++;
      writeJson(path.join(D.docs, `${s.id}.json`), body);
      ids.push(s.id);
      n++;
    }
  }
  writeJson(path.join(D.docs, '_ids.json'), ids);
  console.log(`${n} stretch documents in exports/loop-intake/docs/ (${named} with a guessed name, ${noAssets} still missing a strip or preview upload).`);
}

function status() {
  const m = loadManifest(), guesses = loadGuesses(), map = readJson(ASSET_MAP, {}) ?? {};
  let analysed = 0, stretches = 0, junk = 0, strips = 0, previews = 0, bytes = 0;
  const per = {};
  for (const c of m.clips) {
    per[c.folder] ??= { clips: 0, done: 0, stretches: 0 };
    per[c.folder].clips++;
    const an = readJson(path.join(D.analysis, `${c.clipId}.json`));
    if (!an) continue;
    analysed++; per[c.folder].done++;
    for (const s of an.stretches) {
      stretches++; per[c.folder].stretches++;
      if (s.kind === 'junk') junk++;
      for (const [k, kind] of [['strip.jpg', 'strip'], ['preview.mp4', 'preview']]) { const f = path.join(D.assets, `${s.id}.${k}`); if (exists(f)) { if (kind === 'strip') strips++; else previews++; bytes += fs.statSync(f).size; } }
    }
  }
  console.log(`${m.clips.length} videos listed · ${analysed} analysed · ${stretches} stretches (${junk} look like no exercise) · ${strips} strips · ${previews} previews (${(bytes / 1e6).toFixed(0)} MB)`);
  for (const [f, v] of Object.entries(per)) console.log(`  ${f.padEnd(40)} ${v.done}/${v.clips} analysed, ${v.stretches} stretches`);
  console.log(`guessed names: ${guesses.size} · uploaded assets matched: ${Object.keys(map).length}`);
}

// ─── command line ────────────────────────────────────────────────────────────
const [cmd = 'status', ...rest] = process.argv.slice(2);
const opt = (n) => { const i = rest.indexOf(n); return i >= 0 ? rest[i + 1] : undefined; };
const has = (n) => rest.includes(n);
try {
  fs.mkdirSync(OUT, { recursive: true });
  if (cmd === 'scan') await scan();
  else if (cmd === 'run') await runAll({ jobs: Number(opt('--jobs') || 3), only: opt('--only'), folder: opt('--folder'), limit: Number(opt('--limit') || 0), force: has('--force') });
  else if (cmd === 'catalog') catalogNames(rest[0]);
  else if (cmd === 'sheets') await sheets(opt('--tag') || 'b1', has('--retry'));
  else if (cmd === 'uploads') uploads(opt('--tag'));
  else if (cmd === 'link') link(rest[0]);
  else if (cmd === 'link-ids') linkIds();
  else if (cmd === 'docs') docs(opt('--tag'));
  else if (cmd === 'status') status();
  else { console.log('scan | run [--jobs 3] [--only <file>] [--limit N] [--force] | catalog <catalog.json> | sheets | link <listing.txt> | docs | status'); process.exitCode = 1; }
} catch (err) { console.error(err.message); process.exitCode = 1; }
