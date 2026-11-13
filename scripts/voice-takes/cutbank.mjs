// Coach voice, step 2 of 3: cut recorded carrier sentences into bank clips and check each cut by measurement.
//
// A number phrase recorded on its own comes out slow and with a full stop on it. So each phrase is recorded INSIDE a
// real sentence (a "carrier": "Pace: nine minutes, forty seconds per mile.") and cut out at the pause the voice makes
// at the comma, colon or full stop. This tool does the cutting and the listening-by-numbers, and picks the best take
// of every key.
//
//   VOICE_WORK=<work dir> node scripts/voice-takes/cutbank.mjs <batches> <femaleQueues> <maleQueues> [--encode]
//     batches       comma list; each <work>/<batch>/carriers.json holds
//                   [{ id, prompt, parts: [{ text, sep }], keys: [{ key, from, to }], sentence?, voice? }]
//                   (key = the bank key: "20 minutes," mid take, "32 seconds." closing take, "a, b" sentence take,
//                    plain text for a single clip; `sentence: true` = the whole recording is one key;
//                    `voice` = only that voice records it)
//     queues        comma list; each <work>/<queue>/jobs.jsonl holds one { "phrase": <carrier id>, "url": <wav url> } per line
//   Writes <work>/takes/<voice>/takes.json (every take and its checks), keys.json (key -> file, ms, chosen take),
//   need.json (keys with no good take, and the carriers that hold them), and with --encode the mp3s in takes/<voice>/mp3/.
//
// A take passes when: the voice really paused at both of its cuts (120 ms or more, clear of the short stops inside
// words); its length fits the voice's own speaking rate (fitted from the batch); it has no break inside; and the
// recording neither starts nor stops mid-sound. Loudness is set per SENTENCE (-16 LUFS), so the pieces of one
// sentence keep the level they had next to each other.
import fs from 'node:fs'; import { Buffer } from 'node:buffer'; import { execFile, execFileSync } from 'node:child_process'; import { promisify } from 'node:util';
import { pcm } from './audio.mjs'; import { analyze } from './analyze.mjs'; import { say } from './words.mjs';
const xa = promisify(execFile);
const SR = 24000, F = 240, B = (process.env.VOICE_WORK || '/tmp/voice-work').replace(/\/?$/, '/'); const ms = (n) => Math.round(n * SR / 1000);
const [batch, fq, mq] = process.argv.slice(2); const ENCODE = process.argv.includes('--encode');
const QUEUES = { female: (fq || '').split(',').filter(Boolean), male: (mq || '').split(',').filter(Boolean) };
// carriers of every batch named ("c1,c2"), brought to one shape: parts [{ text, sep }], keys [{ key, from, to }]
const carriers = {};
for (const b of batch.split(',')) for (const c of JSON.parse(fs.readFileSync(`${B}${b}/carriers.json`, 'utf8'))) {
  carriers[c.id] = c.keys ? c : { ...c, keys: c.parts.map((p, i) => (p.key ? { key: p.key, from: i, to: i } : null)).filter(Boolean) };
}
const OUT = `${B}takes/`;
const slug = (t) => String(t).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'x';
export const fileFor = (key) => (key.endsWith(',') ? slug(key) + '__mid.mp3' : key.endsWith('.') ? slug(key) + '__end.mp3' : key.includes(', ') ? slug(key) + '__s.mp3' : slug(key) + '.mp3');
const syll = (text) => Math.max(1, (say(text).toLowerCase().replace(/gps/g, 'geepeeess').match(/[aeiouy]+/g) || []).length);

function frames(s) { const fr = []; for (let i = 0; i < s.length; i += F) { let e = 0; const n = Math.min(F, s.length - i); for (let j = 0; j < n; j++) e += s[i + j] * s[i + j]; fr.push(Math.sqrt(e / n)); } return fr; }
function voiced(fr) {
  const sorted = [...fr].sort((a, b) => b - a); const sp = sorted[Math.floor(sorted.length * 0.05)] || 1e-6; const th = sp * Math.pow(10, -30 / 20);
  let segs = [], cur = null;
  fr.forEach((v, i) => { if (v > th) { if (!cur) cur = { a: i, b: i }; else cur.b = i; } else if (cur && i - cur.b > 3) { segs.push(cur); cur = null; } }); if (cur) segs.push(cur);
  const len = (g) => (g.b - g.a + 1) * 10, gap = (p, q) => (q.a - p.b - 1) * 10;
  while (segs.length > 1 && ((len(segs[0]) <= 200 && gap(segs[0], segs[1]) >= 200) || (len(segs[0]) <= 60 && gap(segs[0], segs[1]) >= 100))) segs.shift();
  while (segs.length > 1 && len(segs[segs.length - 1]) <= 80 && gap(segs[segs.length - 2], segs[segs.length - 1]) >= 200) segs.pop();
  segs = segs.filter((g, i) => !(len(g) <= 50 && i > 0 && i < segs.length - 1 && gap(segs[i - 1], g) >= 150 && gap(g, segs[i + 1]) >= 30));
  return { segs, sp };
}
// One carrier -> its parts with sample ranges and checks.
export function cut(file, k, sentence = false) {
  const full = pcm(file); const A = analyze(full, { thDb: -46 }); const s = full.subarray(0, A.endAt);
  const fr = frames(s); const { segs, sp } = voiced(fr);
  if (!segs.length) return { ok: false, why: 'no speech', n: 0 };
  if (sentence) {
    // A whole sentence in one take: nothing to cut, but a pause the voice held too long is shortened to 0.3 s.
    const low = sp * Math.pow(10, -50 / 20); let a = segs[0].a, b = segs[segs.length - 1].b;
    while (a - 1 >= 0 && segs[0].a - (a - 1) <= 15 && fr[a - 1] > low) a--; while (b + 1 < fr.length && (b + 1) - segs[segs.length - 1].b <= 25 && fr[b + 1] > low) b++;
    const A0 = Math.max(0, a * F - ms(15)), B0 = Math.min(s.length, (b + 1) * F + ms(60));
    const ranges = []; let from = A0, longGaps = 0, inner = 0;
    for (let j = 1; j < segs.length; j++) { const g = (segs[j].a - segs[j - 1].b - 1) * 10; inner = Math.max(inner, g); if (g > 220) longGaps++; if (g > 380) { ranges.push([from, (segs[j - 1].b + 1) * F + ms(150)]); from = segs[j].a * F - ms(150); } }
    ranges.push([from, B0]);
    let pk0 = 0; for (const v of s) pk0 = Math.max(pk0, Math.abs(v));
    const lv = (x, y) => { let m = 0; for (let j = Math.max(0, x); j < Math.min(s.length, y); j++) m = Math.max(m, Math.abs(s[j])); return 20 * Math.log10((m || 1e-6) / pk0); };
    const headCut = A.qa.cutStart || (segs[0].a * F < ms(20) && lv(0, 120) > -20);
    const tailCut = A.qa.cutEnd || (!A.qa.burst && s.length - (segs[segs.length - 1].b + 1) * F < ms(40) && lv(s.length - 240, s.length) > -20);
    return { ok: true, s, sentence: true, ranges, longGaps, inner, voicedMs: segs.reduce((n, q) => n + (q.b - q.a + 1) * 10, 0), headCut, tailCut, margin: 999 };
  }
  if (segs.length < k) return { ok: false, why: 'too few parts', n: segs.length };
  const gaps = segs.slice(1).map((g, i) => ({ i: i + 1, ms: (g.a - segs[i].b - 1) * 10 }));
  const cuts = gaps.slice().sort((a, b) => b.ms - a.ms).slice(0, k - 1).map((g) => g.i).sort((a, b) => a - b);
  const chosen = gaps.filter((g) => cuts.includes(g.i)).map((g) => g.ms), rest = gaps.filter((g) => !cuts.includes(g.i)).map((g) => g.ms);
  const margin = k > 1 ? Math.min(...chosen) - Math.max(0, ...rest) : 999;
  // A cut is sure when the voice really paused there: 120 ms or more, and well clear of the short stops inside words.
  const top = Math.max(0, ...rest); const sure = cuts.map((c) => { const g = gaps[c - 1].ms; return g >= 120 && g >= 1.5 * top; });
  const low = sp * Math.pow(10, -50 / 20); const parts = []; let from = 0;
  for (const c of [...cuts, segs.length]) {
    const g = segs.slice(from, c); let inner = 0; for (let j = 1; j < g.length; j++) inner = Math.max(inner, (g[j].a - g[j - 1].b - 1) * 10);
    const pi = parts.length; const weak = (pi > 0 && !sure[pi - 1]) || (pi < k - 1 && !sure[pi]);
    parts.push({ fa: g[0].a, fb: g[g.length - 1].b, inner, weak, voicedMs: g.reduce((n, q) => n + (q.b - q.a + 1) * 10, 0) }); from = c;
  }
  // Each part reaches out over quiet speech sounds (an f, an s, a breathy end) that sit under the main threshold,
  // but never past the middle of the pause next to it.
  parts.forEach((p, i) => {
    const lo = i ? Math.floor((parts[i - 1].fb + p.fa) / 2) + 1 : 0, hi = i < parts.length - 1 ? Math.floor((p.fb + parts[i + 1].fa) / 2) : fr.length - 1;
    let a = p.fa; while (a - 1 >= lo && p.fa - (a - 1) <= 15 && fr[a - 1] > low) a--;
    let b = p.fb; const reach = i === parts.length - 1 ? 25 : 15; while (b + 1 <= hi && (b + 1) - p.fb <= reach && fr[b + 1] > low) b++;
    p.a = Math.max(lo * F, a * F - ms(15)); p.b = Math.min((hi + 1) * F, s.length, (b + 1) * F + ms(i === parts.length - 1 ? 60 : 30));
  });
  let pk = 0; for (const v of s) pk = Math.max(pk, Math.abs(v));
  const lvl = (a, b) => { let m = 0; for (let j = Math.max(0, a); j < Math.min(s.length, b); j++) m = Math.max(m, Math.abs(s[j])); return 20 * Math.log10((m || 1e-6) / pk); };
  const headCut = A.qa.cutStart || (parts[0].fa * F < ms(20) && lvl(0, 120) > -20);
  const tailCut = A.qa.cutEnd || (!A.qa.burst && s.length - (parts[parts.length - 1].fb + 1) * F < ms(40) && lvl(s.length - 240, s.length) > -20);
  return { ok: true, s, parts, margin, anyWeak: sure.some((x) => !x), pauses: chosen, headCut, tailCut, burst: A.qa.burst };
}
async function lufs(y) {
  const tmp = `${OUT}_l${process.pid}_${Math.random().toString(36).slice(2)}.f32`; fs.writeFileSync(tmp, Buffer.from(y.buffer, y.byteOffset, y.byteLength));
  const r = await xa('ffmpeg', ['-nostdin', '-hide_banner', '-f', 'f32le', '-ar', '24000', '-ac', '1', '-i', tmp, '-af', 'apad=pad_dur=3,ebur128', '-f', 'null', '-'], { maxBuffer: 2e7 }).catch((e) => e);
  fs.unlinkSync(tmp); return parseFloat(((r.stderr || '').match(/I:\s+(-?[\d.]+) LUFS\s*\n\s*Threshold/) || [])[1]);
}
async function encode(y, out) {
  const tmp = out + '.f32'; fs.writeFileSync(tmp, Buffer.from(y.buffer, y.byteOffset, y.byteLength));
  await xa('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'f32le', '-ar', '24000', '-ac', '1', '-i', tmp, '-af', 'alimiter=limit=0.84:level=false', '-c:a', 'libmp3lame', '-b:a', '64k', out]);
  fs.unlinkSync(tmp); return Math.round(parseFloat((await xa('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out])).stdout) * 1000);
}
if (process.argv[1].endsWith('cutbank.mjs')) for (const v of ['female', 'male']) {
  const dir = `${OUT}${v}/`; fs.mkdirSync(dir + 'wav', { recursive: true }); fs.mkdirSync(dir + 'mp3', { recursive: true });
  const jobs = []; for (const q of QUEUES[v]) { const f = `${B}${q}/jobs.jsonl`; if (!fs.existsSync(f)) continue; for (const line of fs.readFileSync(f, 'utf8').trim().split('\n').filter(Boolean)) { const j = JSON.parse(line); jobs.push({ q, id: j.phrase, url: j.url }); } }
  const takes = []; let dl = 0;
  for (const j of jobs) {
    const c = carriers[j.id]; if (!c) continue; const wav = `${dir}wav/${j.q}_${j.id}.wav`;
    if (!fs.existsSync(wav)) { try { execFileSync('curl', ['-sSf', '--retry', '3', '-o', wav, j.url]); dl++; } catch { console.log('download failed', j.q, j.id); continue; } }
    const r = cut(wav, c.parts.length, !!c.sentence);
    if (!r.ok) { takes.push({ q: j.q, id: j.id, wav, fail: r.why }); continue; }
    if (r.sentence) { takes.push({ q: j.q, id: j.id, wav, idx: 0, n: 1, key: c.keys[0].key, text: c.parts.map((p) => p.text).join(', '), ranges: r.ranges, a: r.ranges[0][0], b: r.ranges[r.ranges.length - 1][1], voicedMs: r.voicedMs,
      inner: r.longGaps > c.parts.length - 1 ? r.inner : 0, margin: 999, edge: r.headCut || r.tailCut, syl: c.parts.reduce((n, p) => n + syll(p.text), 0) }); continue; }
    for (const kd of c.keys) { const i = kd.from; const p = r.parts[i]; takes.push({ q: j.q, id: j.id, wav, idx: i, n: r.parts.length, key: kd.key, text: c.parts[i].text, a: p.a, b: p.b, voicedMs: p.voicedMs, inner: p.inner, margin: r.margin, weak: p.weak, anyWeak: r.anyWeak,
      edge: (i === 0 && r.headCut) || (i === r.parts.length - 1 && r.tailCut), syl: syll(c.parts[i].text) }); }
  }
  // Length against the voice's own speaking rate: a wrong cut makes one part far too long and its neighbour far too short.
  // The voice's own rate (ms = a0 + b * syllables), fitted on the takes that look sound and refitted twice without
  // the outliers, so a few runaway recordings cannot bend it.
  let pool = takes.filter((t) => t.key && !t.fail && !t.edge && !t.anyWeak); let a0 = 150, b = 150;
  for (let pass = 0; pass < 3; pass++) {
    if (pool.length < 20) break; let sx = 0, sy = 0, sxx = 0, sxy = 0; for (const t of pool) { sx += t.syl; sy += t.voicedMs; sxx += t.syl * t.syl; sxy += t.syl * t.voicedMs; }
    const n = pool.length; b = (n * sxy - sx * sy) / (n * sxx - sx * sx || 1); a0 = (sy - b * sx) / n;
    pool = pool.filter((t) => { const r = t.voicedMs / Math.max(120, a0 + b * t.syl); return r > 0.65 && r < 1.5; });
  }
  for (const t of takes) { if (t.fail || !t.key) continue; t.ratio = +(t.voicedMs / Math.max(120, a0 + b * t.syl)).toFixed(2);
    const [lo, hi] = t.anyWeak ? [0.7, 1.4] : [0.6, 1.6];
    t.score = (t.edge ? 100 : 0) + (t.weak ? 50 : 0) + (t.ratio < lo || t.ratio > hi ? 40 : 0) + (t.inner > 220 ? 30 : 0); }
  const byKey = new Map(); for (const t of takes) if (t.key && !t.fail) (byKey.get(t.key) || byKey.set(t.key, []).get(t.key)).push(t);
  const keys = {}, need = []; const wanted = new Set(); for (const c of Object.values(carriers)) if (!c.voice || c.voice === v) for (const kd of c.keys) wanted.add(kd.key);
  for (const key of wanted) {
    const list = (byKey.get(key) || []).slice().sort((p, q) => p.score - q.score); const ok = list.filter((t) => t.score < 30);
    if (!ok.length) { need.push({ key, best: list[0] ? list[0].score : null, carriers: Object.values(carriers).filter((c) => (!c.voice || c.voice === v) && c.keys.some((kd) => kd.key === key)).map((c) => c.id) }); continue; }
    const med = ok.map((t) => t.voicedMs).sort((p, q) => p - q)[Math.floor(ok.length / 2)]; ok.sort((p, q) => Math.abs(p.voicedMs - med) - Math.abs(q.voicedMs - med));
    keys[key] = { file: fileFor(key), take: ok[0], takes: list.length };
  }
  console.log(`${v}: recordings ${jobs.length} (downloaded ${dl}), could not cut ${takes.filter((t) => t.fail).length}, keys wanted ${wanted.size}, with a good take ${Object.keys(keys).length}, still needed ${need.length} | rate ${Math.round(b)} ms/syllable + ${Math.round(a0)}`);
  if (ENCODE) {
    const gains = new Map(); const todo = Object.entries(keys); let i = 0;
    const work = async () => { while (i < todo.length) { const [, e] = todo[i++]; const t = e.take; const s = pcm(t.wav);
      const gk = t.q + '|' + t.id; if (!gains.has(gk)) { const all = takes.filter((u) => u.q === t.q && u.id === t.id && !u.fail); const span = Float32Array.from(s.subarray(Math.min(...all.map((u) => u.a)), Math.max(...all.map((u) => u.b)))); const I = await lufs(span); let g = Number.isFinite(I) ? Math.pow(10, Math.max(-12, Math.min(20, -16 - I)) / 20) : 1; gains.set(gk, g); }
      const rs = t.ranges || [[t.a, t.b]]; let len = 0; for (const [p, q] of rs) len += q - p; const y = new Float32Array(len); let o = 0;
      rs.forEach(([p, q], ri) => { const seg = Float32Array.from(s.subarray(p, q)); const e = Math.min(ms(8), seg.length); if (ri > 0) for (let k = 0; k < e; k++) seg[k] *= k / e; if (ri < rs.length - 1) for (let k = 0; k < e; k++) seg[seg.length - 1 - k] *= k / e; y.set(seg, o); o += seg.length; });
      const g = gains.get(gk); const closing = t.idx === t.n - 1; const fi = Math.min(ms(8), y.length), fo = Math.min(ms(closing ? 70 : 40), y.length);
      for (let k = 0; k < y.length; k++) y[k] *= g; for (let k = 0; k < fi; k++) y[k] *= k / fi; for (let k = 0; k < fo; k++) { const u = k / fo; y[y.length - 1 - k] *= u * u; }
      e.ms = await encode(y, dir + 'mp3/' + e.file); } };
    await Promise.all(Array.from({ length: 4 }, work));
    console.log(`${v}: encoded ${todo.length}`);
  }
  fs.writeFileSync(dir + 'takes.json', JSON.stringify(takes.map(({ wav, ...t }) => t))); fs.writeFileSync(dir + 'need.json', JSON.stringify(need));
  fs.writeFileSync(dir + 'keys.json', JSON.stringify(Object.fromEntries(Object.entries(keys).map(([k, e]) => [k, { file: e.file, ms: e.ms || 0, q: e.take.q, id: e.take.id, idx: e.take.idx, score: e.take.score, ratio: e.take.ratio, takes: e.takes }]))));
}
