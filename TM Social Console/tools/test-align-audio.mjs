// node tools/test-align-audio.mjs [--guide <guide.mp4>] [--keep] [--only <n>,<n>]
//
// Tests tools/align-audio.mjs on made-up recordings with a known answer. The "guide" is a real
// guide video when one is there (exports/cc-sync/cc-sync-boxing-1.mp4), else a made-up one (three
// beeps, a bell, and speech-like bursts), or the file given with --guide. Each case builds an owner
// clip around the guide's own soundtrack the way a phone would hear it: the guide moved later or
// earlier by a known amount (the owner started the camera first, or the guide had begun before the
// camera did), through a lowpassed phone microphone, a different loudness, room noise at a chosen
// level, bag-hit thumps, a little room echo, with other audio before and after (talking, noise),
// encoded as AAC at 44.1 kHz. Then it asks align-audio for the offset and compares.
// A case passes when the offset is within 40 ms. Prints a table; exit code 1 when a case fails.
//   --keep   keep the made-up clips (in the temp folder printed at the end)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { alignAudio } from './align-audio.mjs';
import { readWav } from './sync-audio.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const argv = process.argv.slice(2);
const arg = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const SR = 48000;
const TOL = 0.04;

// ─────────────────────────────────────────────────────────────────────────────
// Little tools: a seeded random generator, wav files, ffmpeg.
// ─────────────────────────────────────────────────────────────────────────────
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const gauss = (r) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
function writeWav(file, pcm) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length * 4, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16);
  h.writeUInt16LE(3, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(32, 34);
  h.write('data', 36); h.writeUInt32LE(pcm.length * 4, 40);
  fs.writeFileSync(file, Buffer.concat([h, Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength)]));
}
function ffmpeg(args) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`ffmpeg ${args.join(' ')}: ${r.stderr}`);
}
function ffmpegOk() { return spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status === 0; }

// ─────────────────────────────────────────────────────────────────────────────
// A made-up guide soundtrack: three beeps, a bell, then calls (bursts of speech-like sound).
// ─────────────────────────────────────────────────────────────────────────────
function speechLike(r, seconds, level = 0.3) {
  // Syllables: a buzz at 90-140 Hz shaped by two or three formants, with attack and decay; words of
  // two to five syllables; a pause between words.
  const out = new Float32Array(Math.round(seconds * SR));
  let t = 0;
  while (t < seconds - 0.4) {
    const syl = 2 + Math.floor(r() * 4);
    for (let s = 0; s < syl && t < seconds - 0.4; s++) {
      const dur = 0.11 + r() * 0.16, f0 = 95 + r() * 50;
      const f1 = 350 + r() * 450, f2 = 900 + r() * 1500, f3 = 2400 + r() * 700;
      const n = Math.round(dur * SR), o = Math.round(t * SR);
      for (let i = 0; i < n && o + i < out.length; i++) {
        const x = i / n, env = Math.min(1, x * 12) * Math.min(1, (1 - x) * 5), ph = (i / SR) * f0;
        let v = 0;
        for (let h = 1; h * f0 < 4000; h++) {
          const f = h * f0;
          const g = Math.exp(-(((f - f1) / 160) ** 2)) + 0.6 * Math.exp(-(((f - f2) / 260) ** 2)) + 0.3 * Math.exp(-(((f - f3) / 350) ** 2));
          v += g * Math.sin(2 * Math.PI * h * ph) / h ** 0.3;
        }
        out[o + i] += level * env * v * 0.25;
      }
      t += dur + 0.02;
    }
    t += 0.12 + r() * 0.12;
  }
  return out;
}
function madeUpGuide(seconds = 55) {
  const r = rng(77);
  const out = new Float32Array(Math.round(seconds * SR));
  const add = (pcm, at) => { const o = Math.round(at * SR); for (let i = 0; i < pcm.length && o + i < out.length; i++) out[o + i] += pcm[i]; };
  const beep = new Float32Array(Math.round(0.18 * SR)).map((_, i) => 0.6 * Math.sin(2 * Math.PI * 1000 * (i / SR)) * Math.min(1, i / 300, (0.18 * SR - i) / 300));
  [0, 1, 2].forEach((b) => add(beep, b + 0.2));
  const bell = new Float32Array(Math.round(2.2 * SR)).map((_, i) => { const t = i / SR; return 0.5 * Math.exp(-t * 2) * (Math.sin(2 * Math.PI * 520 * t) + 0.7 * Math.sin(2 * Math.PI * 1180 * t) + 0.5 * Math.sin(2 * Math.PI * 2010 * t)); });
  add(bell, 5.8);
  for (let c = 0; c < 10; c++) add(speechLike(r, 2.2 + r() * 0.8, 0.5), 6.5 + c * 4.5);
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// The owner's clip around the guide.
// ─────────────────────────────────────────────────────────────────────────────
function lowpassNode(pcm, hz) { // two one-pole stages: enough to take the top off
  const a = 1 - Math.exp((-2 * Math.PI * hz) / SR);
  let y1 = 0, y2 = 0;
  for (let i = 0; i < pcm.length; i++) { y1 += a * (pcm[i] - y1); y2 += a * (y1 - y2); pcm[i] = y2; }
}
function rms(pcm, a = 0, z = pcm.length) { let e = 0; for (let i = a; i < z; i++) e += pcm[i] * pcm[i]; return Math.sqrt(e / Math.max(1, z - a)); }

// One case -> the clip file and the true offset (the second of the clip at which the guide's 0 falls).
function buildClip(dir, guide, c, seed) {
  const r = rng(seed);
  const guideSec = guide.length / SR;
  const pre = c.offset >= 0 ? c.offset : 0;
  const trimmed = c.offset >= 0 ? guide : guide.subarray(Math.round(-c.offset * SR));
  const postSec = c.post ?? 9;
  const total = Math.round((pre + trimmed.length / SR + postSec) * SR);
  const clip = new Float32Array(total);
  const g = Math.pow(10, (c.gainDb || 0) / 20);
  const gStart = Math.round(pre * SR);
  // the guide, as the phone hears it
  const voice = new Float32Array(trimmed.length);
  for (let i = 0; i < voice.length; i++) voice[i] = trimmed[i] * g;
  if (c.lowpass) lowpassNode(voice, c.lowpass);
  // The room: pink-ish noise (a one-pole lowpass of white noise, plus a hum), at the SNR asked for
  // against the loudness of the guide as it is in the clip.
  const sig = rms(voice);
  const noiseRms = c.snr >= 90 ? 0 : sig / Math.pow(10, c.snr / 20);
  const noise = new Float32Array(total);
  let n1 = 0, n2 = 0;
  for (let i = 0; i < total; i++) {
    const w = gauss(r);
    n1 += 0.08 * (w - n1); n2 += 0.4 * (w - n2);
    noise[i] = 0.8 * n1 * 6 + 0.2 * n2 + 0.15 * Math.sin((2 * Math.PI * 100 * i) / SR);
  }
  const k = noiseRms / Math.max(1e-9, rms(noise));
  for (let i = 0; i < total; i++) clip[i] = noise[i] * k;
  for (let i = 0; i < voice.length; i++) clip[gStart + i] += voice[i];
  // the owner talking before and after (other audio that is not the guide)
  const talkLevel = Math.max(0.15, sig * 4);
  if (pre > 0.5) { const t = speechLike(r, Math.min(pre, 12), talkLevel); for (let i = 0; i < t.length; i++) clip[i] += t[i]; }
  { const t = speechLike(r, postSec - 0.5, talkLevel); const o = gStart + voice.length + Math.round(0.3 * SR); for (let i = 0; i < t.length && o + i < total; i++) clip[o + i] += t[i]; }
  // bag-hit thumps: a thud (a low burst with a quick decay, a click on top) anywhere in the clip
  for (let h = 0; h < (c.thumps || 0); h++) {
    const at = Math.round((gStart / SR + r() * (voice.length / SR)) * SR), amp = Math.max(0.3, sig * 6);
    for (let i = 0; i < Math.round(0.25 * SR) && at + i < total; i++) {
      const t = i / SR;
      clip[at + i] += amp * (Math.exp(-t * 22) * Math.sin(2 * Math.PI * (70 - 40 * t) * t) + 0.6 * Math.exp(-t * 300) * gauss(r));
    }
  }
  // soft limit, as a phone's gain stage
  let peak = 0;
  for (const v of clip) peak = Math.max(peak, Math.abs(v));
  const norm = 0.9 / Math.max(0.9, peak);
  for (let i = 0; i < total; i++) clip[i] = Math.tanh(clip[i] * norm * 1.2);
  const wav = path.join(dir, `${c.name}.wav`);
  writeWav(wav, clip);
  const out = path.join(dir, `${c.name}.m4a`);
  const af = [c.lowpass ? `lowpass=f=${c.lowpass}` : null, c.reverb ? 'aecho=0.8:0.6:60|120|230:0.5|0.35|0.2' : null, c.mic ? `volume=${c.mic}dB` : null].filter(Boolean).join(',');
  ffmpeg(['-i', wav, ...(af ? ['-af', af] : []), '-ar', '44100', '-ac', '2', '-c:a', 'aac', '-b:a', '64k', out]);
  fs.rmSync(wav, { force: true });
  return { file: out, truth: c.offset, guideSec };
}

// A video file from the made-up soundtrack (the tool takes a video).
function makeGuideVideo(dir) {
  const wav = path.join(dir, 'guide.wav'), mp4 = path.join(dir, 'guide-made-up.mp4');
  writeWav(wav, madeUpGuide(55));
  ffmpeg(['-f', 'lavfi', '-i', 'color=c=black:s=64x112:r=10', '-i', wav, '-shortest', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', mp4]);
  fs.rmSync(wav, { force: true });
  return mp4;
}

// ─────────────────────────────────────────────────────────────────────────────
// The cases.
// ─────────────────────────────────────────────────────────────────────────────
// offset: seconds into the clip where the guide's 0 falls (negative: the camera started that long
// after the guide had begun). snr: guide against room noise, dB (99: no noise). lowpass: the phone
// microphone's top, Hz. gainDb: how loud the guide is in the room. thumps: bag hits.
const CASES = [
  { name: 'clean, guide starts 3.2 s in', offset: 3.2, snr: 99 },
  { name: 'phone mic 3.4k, 20 dB over noise', offset: 7.45, snr: 20, lowpass: 3400 },
  { name: 'phone mic 3k, 12 dB, 4 thumps', offset: 0.85, snr: 12, lowpass: 3000, thumps: 4 },
  { name: 'quiet guide (-12 dB), 8 dB, 6 thumps', offset: 12.0, snr: 8, lowpass: 2800, thumps: 6, gainDb: -12 },
  { name: 'noisy: 3 dB, 6 thumps', offset: 2.0, snr: 3, lowpass: 3400, thumps: 6 },
  { name: 'camera late: guide began 2.5 s before it', offset: -2.5, snr: 15, lowpass: 3400 },
  { name: 'camera late 6 s, 8 dB, 3 thumps', offset: -6.0, snr: 8, lowpass: 3000, thumps: 3 },
  { name: 'long wait: guide at 20 s, very quiet', offset: 20.0, snr: 12, lowpass: 3400, gainDb: -18, thumps: 4, post: 20 },
  { name: 'loud and clipping (+12 dB)', offset: 1.234, snr: 10, gainDb: 12 },
  { name: 'room echo, 6 dB, 5 thumps', offset: 4.0, snr: 6, lowpass: 3000, thumps: 5, reverb: true },
  { name: 'guide at exactly 0 s', offset: 0, snr: 20 },
  { name: 'worst: 0 dB, 8 thumps, guide at 33 s', offset: 33.3, snr: 0, lowpass: 3400, thumps: 8, post: 25 },
];

async function main() {
  if (!ffmpegOk()) { console.error('test-align-audio: ffmpeg is not installed.'); process.exit(1); }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-align-test-'));
  let guideFile = arg('--guide');
  let source;
  if (guideFile) source = `${guideFile} (given)`;
  else {
    const real = ['exports/cc-sync/cc-sync-boxing-1.mp4', 'raw-footage/app/sync/cc-sync-boxing-1.mp4'].map((p) => path.join(ROOT, p)).find((p) => fs.existsSync(p));
    if (real) { guideFile = real; source = `${path.relative(ROOT, real)} (a real guide)`; }
    else { guideFile = makeGuideVideo(dir); source = 'a made-up guide (no real guide video found)'; }
  }
  // The cases are built from the guide's soundtrack at 48 kHz.
  const wav48 = path.join(dir, 'guide48.wav');
  ffmpeg(['-i', guideFile, '-vn', '-ac', '1', '-ar', String(SR), '-c:a', 'pcm_f32le', wav48]);
  const guide48 = readWav(wav48).pcm;
  console.log(`align-audio test. guide: ${source}, ${(guide48.length / SR).toFixed(1)} s\n`);

  const only = arg('--only') ? arg('--only').split(',').map(Number) : null;
  const rows = [];
  let seed = 100;
  for (const [i, c] of CASES.entries()) {
    if (only && !only.includes(i + 1)) continue;
    const built = buildClip(dir, guide48, { ...c, name: `case${i + 1}` }, seed++);
    const t0 = Date.now();
    let got = null, err = null;
    try { got = alignAudio(guideFile, built.file); } catch (e) { err = e.message; }
    const errMs = got ? (got.offsetSec - built.truth) * 1000 : NaN;
    rows.push({ n: i + 1, name: c.name, truth: built.truth, got, errMs, ok: !!got && Math.abs(errMs) <= TOL * 1000, ms: Date.now() - t0, err });
  }
  // A clip with no guide in it must not be trusted.
  if (!only) {
    const r = rng(5), len = 70 * SR, noise = new Float32Array(len);
    let n1 = 0;
    for (let i = 0; i < len; i++) { n1 += 0.1 * (gauss(r) - n1); noise[i] = 0.4 * n1 * 5; }
    const talk = speechLike(rng(9), 60, 0.3);
    for (let i = 0; i < talk.length; i++) noise[i + SR * 4] += talk[i];
    const wav = path.join(dir, 'noguide.wav'), m4a = path.join(dir, 'noguide.m4a');
    writeWav(wav, noise);
    ffmpeg(['-i', wav, '-ar', '44100', '-c:a', 'aac', '-b:a', '64k', m4a]);
    const got = alignAudio(guideFile, m4a);
    rows.push({ n: rows.length + 1, name: 'control: room and talking, NO guide in it', truth: null, got, errMs: NaN, ok: got.confidence < 0.5, ms: 0, control: true });
  }
  // The command line, end to end: the answer printed, the JSON written, a missing file explained.
  if (!only) {
    const built = buildClip(dir, guide48, { name: 'cli', offset: 5.5, snr: 10, lowpass: 3200, thumps: 3 }, 999);
    const jf = path.join(dir, 'cli.json');
    const r = spawnSync(process.execPath, [path.join(HERE, 'align-audio.mjs'), guideFile, built.file, '--json', jf], { encoding: 'utf8' });
    let j = null;
    try { j = JSON.parse(fs.readFileSync(jf, 'utf8')); } catch { /* no json */ }
    const okCli = r.status === 0 && j && Math.abs(j.offsetSec - 5.5) <= TOL && /offset\s+\+5\./.test(r.stdout);
    rows.push({ n: rows.length + 1, name: 'command line: --json written, answer printed', truth: 5.5, got: j, errMs: j ? (j.offsetSec - 5.5) * 1000 : NaN, ok: !!okCli, ms: 0 });
    const bad = spawnSync(process.execPath, [path.join(HERE, 'align-audio.mjs'), guideFile, path.join(dir, 'nope.mp4')], { encoding: 'utf8' });
    rows.push({ n: rows.length + 1, name: 'command line: a missing file is explained (exit 1)', truth: null, got: null, errMs: NaN, ok: bad.status === 1 && /does not exist/.test(bad.stderr), ms: 0 });
    // One file only: says what is needed before the usage (exit 1).
    const one = spawnSync(process.execPath, [path.join(HERE, 'align-audio.mjs'), guideFile], { encoding: 'utf8' });
    rows.push({ n: rows.length + 1, name: 'command line: one file given is explained (exit 1)', truth: null, got: null, errMs: NaN, ok: one.status === 1 && /^align-audio: give the guide video and your clip/.test(one.stderr), ms: 0 });
    // A clip without the guide in it: no offset, no bell or call times, exit 2, JSON reliable:false and offsetSec null.
    const ng = path.join(dir, 'noguide.m4a'), nj = path.join(dir, 'noguide.json');
    const none = spawnSync(process.execPath, [path.join(HERE, 'align-audio.mjs'), guideFile, ng, '--json', nj], { encoding: 'utf8' });
    let nja = null;
    try { nja = JSON.parse(fs.readFileSync(nj, 'utf8')); } catch { /* no json */ }
    const okNone = none.status === 2 && /not found/.test(none.stdout) && !/bell is at|call \d+ at|offset\s+[+-]/.test(none.stdout) && /not found in this clip/.test(none.stderr)
      && nja && nja.reliable === false && nja.offsetSec === null && !nja.bellOnClipSec && !nja.callsOnClipSec;
    rows.push({ n: rows.length + 1, name: 'command line: guide NOT in the clip: no offset given, exit 2, reliable:false', truth: null, got: nja, errMs: NaN, ok: !!okNone, ms: 0 });
    // The camera started late (the guide's bell had already rung): the bell is said to be before the clip starts, not at a made-up time.
    const late = buildClip(dir, guide48, { name: 'late', offset: -8, snr: 15, lowpass: 3400 }, 4242);
    const lr = spawnSync(process.execPath, [path.join(HERE, 'align-audio.mjs'), guideFile, late.file], { encoding: 'utf8' });
    const hasSheet = fs.existsSync(path.join(path.dirname(guideFile), `${path.basename(guideFile, path.extname(guideFile))}.timing.json`));
    const okLate = lr.status === 0 && /offset\s+-(?:7\.9\d\d|8\.0\d\d)/.test(lr.stdout) && (!hasSheet || /the bell is [\d.]+ s BEFORE your clip starts/.test(lr.stdout));
    rows.push({ n: rows.length + 1, name: 'command line: camera started late: the bell is said to be BEFORE the clip', truth: -8, got: null, errMs: NaN, ok: !!okLate, ms: 0 });
  }

  const pad = (s, n) => String(s).padEnd(n), lpad = (s, n) => String(s).padStart(n);
  console.log(`${pad('#', 3)}${pad('case', 46)}${lpad('true s', 9)}${lpad('found s', 9)}${lpad('error', 10)}${lpad('conf', 6)}  result`);
  for (const x of rows) {
    const found = x.got && Number.isFinite(x.got.offsetSec) ? x.got.offsetSec.toFixed(3) : (x.err ? 'error' : '-');
    const err = Number.isFinite(x.errMs) ? `${x.errMs >= 0 ? '+' : ''}${x.errMs.toFixed(1)} ms` : '-';
    console.log(`${pad(x.n, 3)}${pad(x.name, 46)}${lpad(x.truth === null ? '-' : x.truth.toFixed(3), 9)}${lpad(found, 9)}${lpad(err, 10)}${lpad(x.got && Number.isFinite(x.got.confidence) ? x.got.confidence.toFixed(2) : '-', 6)}  ${x.ok ? 'PASS' : 'FAIL'}${x.err ? `  (${x.err})` : ''}`);
  }
  const fail = rows.filter((x) => !x.ok);
  const timed = rows.filter((x) => Number.isFinite(x.errMs) && !x.control && x.truth !== null);
  console.log(`\n${rows.length - fail.length} of ${rows.length} passed. Worst error over ${timed.length} offsets: ${Math.max(...timed.map((x) => Math.abs(x.errMs))).toFixed(1)} ms (limit ${TOL * 1000} ms).`);
  if (arg('--keep') !== undefined || argv.includes('--keep')) console.log(`clips kept in ${dir}`); else fs.rmSync(dir, { recursive: true, force: true });
  process.exit(fail.length ? 1 : 0);
}
await main();
