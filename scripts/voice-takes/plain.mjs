// plain.mjs <take.wav> <out.mp3>: one plain phrase (an exercise name, a short fixed line) recorded on its own -> a bank
// clip, cut the way cutbank.mjs cuts a part of a carrier sentence, and judged by the numbers it prints.
//
// The cut: the phrase is the group of voiced runs with the most voice in it (runs closer than 0.30 s are one group;
// a short burst on the first or last frames of the file is the generator's click and is dropped). Its start reaches
// back, and its end forward, while the level stays above (loud level - 50 dB), then 45 ms before (the bank's clips
// carry about 50 ms of silence before the voice) and 60 ms after;
// a pause inside over 0.12 s is capped at 0.10 s; 8 ms in, 70 ms out; gain to -16 LUFS; the bank's limiter and mp3.
//
// The numbers (one JSON line): ms; groups, and speechGroups (groups holding 0.15 s or more of voice: 2 is a double take,
// or a second sentence; otherVoiceMs is the voice left out of the clip); pauses (inner silences of 0.12 s or more: for a
// --sentence take, about one per comma); groups (1 = nothing but the phrase and clicks); headRoomMs / tailRoomMs (the silence
// the file holds before the phrase starts and after it ends: under 10 and 20 ms the voice runs into the edge of the
// file and the take may be cut off there, prefer another); capped and longestPause (a pause of 0.2 s or more inside is
// a choppy take; 0.3 s or more makes a second group, a double take); lufs after encoding.
// Record a name again rather than install a take that fails these. See CLAUDE.md, "Recording plain names".
import { execFileSync as x, spawnSync } from 'node:child_process'; import fs from 'node:fs'; import { Buffer } from 'node:buffer'; import process from 'node:process';
const args = process.argv.slice(2); const sentence = args.includes('--sentence'); const [inp, out] = args.filter((v) => !v.startsWith('--')); const SR = 24000, F = 240;
// A plain phrase is one breath: runs 0.30 s apart are two takes, and a pause inside is capped at 0.10 s. A sentence said
// in one take (--sentence: its key has a comma or a colon in it) keeps its own pauses, as the bank's sentences do
// (0.15 to 0.30 s there): runs up to 0.90 s apart are one sentence, and only a pause over 0.32 s is cut down to 0.30 s.
const JOIN = sentence ? 90 : 30, CAP_OVER = sentence ? 0.32 : 0.12, HALF = sentence ? 150 : 50; const ms = (n) => Math.round(n * SR / 1000);
const raw = x('ffmpeg', ['-v', 'error', '-i', inp, '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1e9 }); const s = new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4);
const fr = []; for (let i = 0; i + F <= s.length; i += F) { let e = 0; for (let j = 0; j < F; j++) e += s[i + j] * s[i + j]; fr.push(Math.sqrt(e / F)); }
const sorted = [...fr].sort((a, b) => b - a); const sp = sorted[Math.floor(sorted.length * 0.05)] || 1e-6; const th = sp * Math.pow(10, -30 / 20), low = sp * Math.pow(10, -50 / 20);
let runs = [], cur = null; fr.forEach((v, i) => { if (v > th) { if (!cur) cur = [i, i]; else cur[1] = i; } else if (cur && i - cur[1] > 3) { runs.push(cur); cur = null; } }); if (cur) runs.push(cur);
{ const len = (g) => (g[1] - g[0] + 1) * 10, gap = (p, q) => (q[0] - p[1] - 1) * 10; const nf = fr.length;
  while (runs.length > 1 && runs[runs.length - 1][1] >= nf - 3 && len(runs[runs.length - 1]) <= 120 && gap(runs[runs.length - 2], runs[runs.length - 1]) >= 60) runs.pop();
  while (runs.length > 1 && runs[0][0] <= 2 && len(runs[0]) <= 120 && gap(runs[0], runs[1]) >= 60) runs.shift();
  while (runs.length > 1 && ((len(runs[0]) <= 200 && gap(runs[0], runs[1]) >= 200) || (len(runs[0]) <= 60 && gap(runs[0], runs[1]) >= 100))) runs.shift();
  while (runs.length > 1 && len(runs[runs.length - 1]) <= 80 && gap(runs[runs.length - 2], runs[runs.length - 1]) >= 200) runs.pop(); }
// groups: runs closer than 0.30 s are one phrase; the phrase is the group with the most voice in it
const groups = []; for (const r of runs) { const g = groups[groups.length - 1]; if (g && r[0] - g.runs[g.runs.length - 1][1] - 1 < JOIN) g.runs.push(r); else groups.push({ runs: [r] }); }
const voice = (g) => g.runs.reduce((a, r) => a + r[1] - r[0] + 1, 0); const main = groups.reduce((a, g) => (voice(g) > voice(a) ? g : a), groups[0]); const keep = main.runs;
let a = keep[0][0], b = keep[keep.length - 1][1];
const fa = a, fb = b; while (a - 1 >= 0 && fa - (a - 1) <= 15 && fr[a - 1] > low) a--; while (b + 1 < fr.length && (b + 1) - fb <= 25 && fr[b + 1] > low) b++;
const A = Math.max(0, a * F - ms(45)), B = Math.min(s.length, (b + 1) * F + ms(60));
const parts = []; let from = A, capped = 0, longest = 0, pauses = 0;
for (let k = 0; k < keep.length - 1; k++) { const gA = (keep[k][1] + 1) * F, gB = keep[k + 1][0] * F; const g = (gB - gA) / SR; longest = Math.max(longest, g); if (g >= 0.12) pauses++; if (g > CAP_OVER) { parts.push([from, gA + ms(HALF)]); from = gB - ms(HALF); capped++; } }
parts.push([from, B]);
const total = parts.reduce((t, p) => t + p[1] - p[0], 0); const y = new Float32Array(total); let o = 0;
for (let pi = 0; pi < parts.length; pi++) { const [pa, pb] = parts[pi]; const seg = s.subarray(pa, pb); const f = Math.min(ms(4), seg.length >> 1); for (let i = 0; i < seg.length; i++) { let g = 1; if (pi > 0 && i < f) g = i / f; if (pi < parts.length - 1 && i >= seg.length - f) g = (seg.length - 1 - i) / f; y[o++] = seg[i] * g; } }
const fi = Math.min(ms(8), y.length), fo = Math.min(ms(70), y.length); for (let i = 0; i < fi; i++) y[i] *= i / fi; for (let i = 0; i < fo; i++) y[y.length - 1 - i] *= i / fo;
const tmp = out + '.f32'; const write = () => fs.writeFileSync(tmp, Buffer.from(y.buffer, y.byteOffset, y.byteLength)); write();
const lufs = (file, fmt) => { const r = spawnSync('ffmpeg', ['-nostdin', '-hide_banner', ...fmt, '-i', file, '-af', 'apad=pad_dur=3,ebur128', '-f', 'null', '-'], { encoding: 'utf8' }); return parseFloat(((r.stderr || '').match(/I:\s+(-?[\d.]+) LUFS\s*\n\s*Threshold/) || [])[1]); };
const RAWFMT = ['-f', 'f32le', '-ar', String(SR), '-ac', '1'];
// gain, then the limiter takes the peaks; a second pass makes up what the limiter took, so the clip lands on -16
let gainDb = 0; const enc = () => x('ffmpeg', ['-v', 'error', '-y', ...RAWFMT, '-i', tmp, '-af', 'alimiter=limit=0.84:level=false', '-c:a', 'libmp3lame', '-b:a', '64k', out]);
let I = lufs(tmp, RAWFMT); let after = NaN;
for (let pass = 0; pass < 3; pass++) { const g = Math.pow(10, (-16 - (pass === 0 ? I : after)) / 20); if (!Number.isFinite(g)) break; for (let i = 0; i < y.length; i++) y[i] *= g; gainDb += 20 * Math.log10(g); write(); enc(); after = lufs(out, []); if (Math.abs(after + 16) <= 0.4) break; }
fs.unlinkSync(tmp);
const outMs = Math.round(Number(x('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out]).toString()) * 1000);
const speechGroups = groups.filter((g) => voice(g) >= 15).length; const otherVoiceMs = groups.filter((g) => g !== main).reduce((t, g) => t + voice(g) * 10, 0);
console.log(JSON.stringify({ in: inp.split('/').pop(), ms: outMs, groups: groups.length, speechGroups, otherVoiceMs, runs: keep.length, pauses, reachedBackMs: (fa - a) * 10, reachedFwdMs: (b - fb) * 10, headRoomMs: a * 10, tailRoomMs: Math.max(0, Math.round((s.length - (b + 1) * F) / SR * 1000)), capped, longestPause: +longest.toFixed(2), lufs: after, gainDb: +gainDb.toFixed(1) }));
