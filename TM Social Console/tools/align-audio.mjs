// node tools/align-audio.mjs <guide.mp4> <owner-clip.mp4> [--json [file]] [--timing <file>] [--quiet]
//
// Finds where a guide video (a Combo Coach sync video, npm run app-broll -- --only sync)
// sits inside the owner's own recording of it. The owner plays the guide out loud while
// filming; the guide's sound (beeps, bell, the coach calling each combo) ends up in
// the owner's clip, and this tool lines the two up from that sound alone.
//
//   <guide.mp4>        the guide video (exports/cc-sync/cc-sync-boxing-1.mp4)
//   <owner-clip.mp4>   the owner's clip (any video or audio file ffmpeg reads)
//   --json [file]      also write the answer as JSON (default <owner-clip>.align.json)
//   --timing <file>    the guide's timing sheet; default: <guide name>.timing.json
//                      next to the guide, when it is there. Adds where the bell and
//                      each call fall on the owner's clip.
//   --quiet            print only the offset in seconds
//
// The offset is the second of the OWNER'S CLIP at which the guide's time 0 falls.
//   +6.842  the guide started 6.842 s after the owner's camera did (an owner clip
//           can have anything before and after: room noise, talking, bag hits).
//   -2.500  the owner's camera started 2.5 s after the guide had begun (the
//           first 2.5 s of the guide are not in the clip).
// So a moment at guide time t is at  t + offset  on the owner's clip.
//
// How: both soundtracks go to 16 kHz mono and are turned into the loudness of 20 bands
// between 250 and 3800 Hz every 10 ms (speech and beeps live there; a phone
// microphone keeps them, room noise and bag thumps barely touch the middle of the
// range). Each band is high-passed in time (its own slow level is taken out), so a
// louder or quieter clip, a lowpassed microphone or a rising noise floor does not
// matter. The two feature tracks are cross-correlated with an FFT (normalised, so a
// clip that only holds part of the guide still works), then the best lag is refined
// at 2 ms. Confidence says how much better the best lag is than everything else
// (0 to 1; under 0.5, do not trust it: the guide was not audible in the clip).
// Needs ffmpeg on the PATH (or the one bundled with Remotion). No other dependency.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

// ─────────────────────────────────────────────────────────────────────────────
// Settings.
// ─────────────────────────────────────────────────────────────────────────────
const SR = 16000;
const WIN = 512;                  // 32 ms analysis window
const BANDS = 20;
const F_LO = 250, F_HI = 3800;
const HOP_COARSE = 160;           // 10 ms
const HOP_FINE = 32;              // 2 ms
const MEAN_SEC = 0.25;            // each band's own slow level, taken out over +-0.25 s (see features)
const MIN_OVERLAP_SEC = 10;       // never trust a match on less audio than this
const REFINE_SEC = 0.03;          // refine within +-30 ms of the coarse lag

// ─────────────────────────────────────────────────────────────────────────────
// ffmpeg.
// ─────────────────────────────────────────────────────────────────────────────
function ffmpegCmd() {
  if (spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status === 0) return { cmd: 'ffmpeg', env: process.env };
  try {
    // The copy Remotion ships (a console dependency), when no ffmpeg is installed.
    const suffix = { linux: '-gnu', win32: '-msvc' }[process.platform] ?? '';
    const { dir } = createRequire(import.meta.url)(`@remotion/compositor-${process.platform}-${process.arch}${suffix}`);
    return { cmd: path.join(dir, process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'), env: { ...process.env, LD_LIBRARY_PATH: dir, DYLD_LIBRARY_PATH: dir } };
  } catch { /* fall through */ }
  throw new Error('ffmpeg was not found. Install it (npm run doctor checks) and try again.');
}

// The soundtrack of a file as 16 kHz mono floats. Throws a plain sentence when the file is missing or silent.
export function decodeAudio(file) {
  if (!fs.existsSync(file)) throw new Error(`${file} does not exist.`);
  const { cmd, env } = ffmpegCmd();
  const r = spawnSync(cmd, ['-v', 'error', '-i', file, '-vn', '-map', '0:a:0', '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { env, maxBuffer: 1 << 30 });
  if (r.status !== 0) {
    const why = String(r.stderr || '').trim();
    if (/Stream map .* matches no streams|does not contain any stream/i.test(why)) throw new Error(`${file} has no sound. Film with the sound on and the guide playing out loud.`);
    throw new Error(`ffmpeg could not read ${file}: ${why.split('\n').pop() || 'unknown error'}`);
  }
  const buf = r.stdout;
  const n = Math.floor(buf.length / 4);
  if (n < SR) throw new Error(`${file} has less than a second of sound.`);
  const out = new Float32Array(n);
  new Uint8Array(out.buffer).set(buf.subarray(0, n * 4));
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// FFT (iterative radix 2, in place on separate real and imaginary arrays).
// ─────────────────────────────────────────────────────────────────────────────
const twiddles = new Map();
function tw(n) {
  let t = twiddles.get(n);
  if (!t) {
    const cos = new Float64Array(n / 2), sin = new Float64Array(n / 2);
    for (let i = 0; i < n / 2; i++) { cos[i] = Math.cos((2 * Math.PI * i) / n); sin[i] = Math.sin((2 * Math.PI * i) / n); }
    twiddles.set(n, t = { cos, sin });
  }
  return t;
}
function fft(re, im, inverse = false) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
  }
  const { cos, sin } = tw(n);
  const sgn = inverse ? 1 : -1;
  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1, step = n / len;
    for (let i = 0; i < n; i += len) {
      for (let j = 0, k = 0; j < half; j++, k += step) {
        const wr = cos[k], wi = sgn * sin[k];
        const a = i + j, b = a + half;
        const xr = re[b] * wr - im[b] * wi, xi = re[b] * wi + im[b] * wr;
        re[b] = re[a] - xr; im[b] = im[a] - xi;
        re[a] += xr; im[a] += xi;
      }
    }
  }
  if (inverse) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
}
const nextPow2 = (n) => { let p = 1; while (p < n) p <<= 1; return p; };

// ─────────────────────────────────────────────────────────────────────────────
// Features: band loudness over time, each band with its own slow level taken out.
// ─────────────────────────────────────────────────────────────────────────────
const mel = (f) => 2595 * Math.log10(1 + f / 700);
const imel = (m) => 700 * (10 ** (m / 2595) - 1);
// Triangular filters over the FFT bins, equally spaced on the mel scale.
function filterBank() {
  const edges = [];
  for (let i = 0; i <= BANDS + 1; i++) edges.push(imel(mel(F_LO) + ((mel(F_HI) - mel(F_LO)) * i) / (BANDS + 1)));
  const binHz = SR / WIN;
  const bank = [];
  for (let b = 0; b < BANDS; b++) {
    const [l, c, h] = [edges[b], edges[b + 1], edges[b + 2]];
    const lo = Math.max(1, Math.floor(l / binHz)), hi = Math.min(WIN / 2 - 1, Math.ceil(h / binHz));
    const w = [];
    for (let k = lo; k <= hi; k++) {
      const f = k * binHz;
      const g = f < c ? (f - l) / (c - l) : (h - f) / (h - c);
      if (g > 0) w.push([k, g]);
    }
    bank.push(w);
  }
  return bank;
}
const BANK = filterBank();
const HANN = Float64Array.from({ length: WIN }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / WIN));

// signal -> { frames, data (frame-major, BANDS per frame) }, frame f centred on sample f * hop + WIN / 2.
function features(sig, hop, from = 0, to = sig.length, flux = false) {
  const frames = Math.max(0, Math.floor((to - from - WIN) / hop) + 1);
  const data = new Float32Array(frames * BANDS);
  const re = new Float64Array(WIN), im = new Float64Array(WIN);
  for (let f = 0; f < frames; f++) {
    const o = from + f * hop;
    for (let i = 0; i < WIN; i++) {
      const prev = o + i > 0 ? sig[o + i - 1] : 0;
      re[i] = (sig[o + i] - 0.97 * prev) * HANN[i]; // pre-emphasis: flatten the spectral tilt
      im[i] = 0;
    }
    fft(re, im);
    for (let b = 0; b < BANDS; b++) {
      let e = 0;
      for (const [k, g] of BANK[b]) e += g * (re[k] * re[k] + im[k] * im[k]);
      data[f * BANDS + b] = Math.log(e + 1e-9);
    }
  }
  // Each band: take out its own slow level (a moving mean over +-MEAN_SEC), so what is left is the
  // syllable-rate and beep-rate movement, the fine structure that only the right alignment matches
  // (a longer window leaves the slow rise and fall of each call, which repeats every few seconds and
  // lets the wrong lag look nearly as good). Then squash the outliers (a bag thump is a huge jump in a
  // band or two) with tanh so no single burst runs the correlation.
  const half = Math.round((MEAN_SEC * SR) / hop);
  for (let b = 0; b < BANDS; b++) {
    const pre = new Float64Array(frames + 1);
    for (let f = 0; f < frames; f++) pre[f + 1] = pre[f] + data[f * BANDS + b];
    for (let f = 0; f < frames; f++) {
      const a = Math.max(0, f - half), z = Math.min(frames, f + half + 1);
      const m = (pre[z] - pre[a]) / (z - a);
      data[f * BANDS + b] = Math.tanh((data[f * BANDS + b] - m) / 2);
    }
  }
  if (flux) { // rising edges only: the direct sound arrives before its echoes, and an echo can only add edges later
    const copy = Float32Array.from(data);
    const k = Math.max(1, Math.round(0.006 * SR / hop));
    for (let f = 0; f < frames; f++) for (let b = 0; b < BANDS; b++) {
      const prev = f >= k ? copy[(f - k) * BANDS + b] : copy[b];
      data[f * BANDS + b] = Math.max(0, copy[f * BANDS + b] - prev);
    }
  }
  return { frames, data };
}

// ─────────────────────────────────────────────────────────────────────────────
// Correlation.
// ─────────────────────────────────────────────────────────────────────────────
// corr[k] = sum over frames n of guide[n] . clip[n + k], for k from -(guide.frames - 1) up to clip.frames - 1,
// normalised by the energy of the part of each that overlaps, so partial overlaps compare fairly.
function normalisedXcorr(guide, clip) {
  const Lg = guide.frames, Lo = clip.frames;
  const N = nextPow2(Lg + Lo);
  const sr = new Float64Array(N), si = new Float64Array(N);
  const ar = new Float64Array(N), ai = new Float64Array(N);
  const br = new Float64Array(N), bi = new Float64Array(N);
  for (let b = 0; b < BANDS; b++) {
    ar.fill(0); ai.fill(0); br.fill(0); bi.fill(0);
    for (let n = 0; n < Lg; n++) ar[n] = guide.data[n * BANDS + b];
    for (let n = 0; n < Lo; n++) br[n] = clip.data[n * BANDS + b];
    fft(ar, ai); fft(br, bi);
    for (let i = 0; i < N; i++) { // conj(A) * B
      sr[i] += ar[i] * br[i] + ai[i] * bi[i];
      si[i] += ar[i] * bi[i] - ai[i] * br[i];
    }
  }
  fft(sr, si, true);
  // Energy per frame (all bands), prefix sums, for the overlap norms.
  const energy = (x, L) => { const p = new Float64Array(L + 1); for (let n = 0; n < L; n++) { let e = 0; for (let b = 0; b < BANDS; b++) { const v = x.data[n * BANDS + b]; e += v * v; } p[n + 1] = p[n] + e; } return p; };
  const pg = energy(guide, Lg), po = energy(clip, Lo);
  const lags = [], vals = [];
  for (let k = -(Lg - 1); k <= Lo - 1; k++) {
    const g0 = Math.max(0, -k), g1 = Math.min(Lg, Lo - k); // guide frames that overlap
    const overlap = g1 - g0;
    if (overlap <= 0) continue;
    const eg = pg[g1] - pg[g0], eo = po[g1 + k] - po[g0 + k];
    lags.push(k);
    vals.push({ overlap, v: sr[(k + N) % N] / Math.sqrt(eg * eo + 1e-9) });
  }
  return { lags, vals };
}

// A dot product of the two feature tracks with the guide shifted: a refinement step for one lag (in fine frames).
function ncc(guide, clip, k) {
  const g0 = Math.max(0, -k), g1 = Math.min(guide.frames, clip.frames - k);
  if (g1 - g0 < 50) return -1;
  let s = 0, eg = 0, eo = 0;
  for (let n = g0; n < g1; n++) {
    for (let b = 0; b < BANDS; b++) {
      const x = guide.data[n * BANDS + b], y = clip.data[(n + k) * BANDS + b];
      s += x * y; eg += x * x; eo += y * y;
    }
  }
  return s / Math.sqrt(eg * eo + 1e-9);
}

// ─────────────────────────────────────────────────────────────────────────────
// The answer.
// ─────────────────────────────────────────────────────────────────────────────
// alignAudio(guideSignal, clipSignal) with 16 kHz mono Float32Arrays.
export function alignSignals(guide, clip) {
  const gc = features(guide, HOP_COARSE), oc = features(clip, HOP_COARSE);
  const fps = SR / HOP_COARSE;
  const { lags, vals } = normalisedXcorr(gc, oc);
  const minOverlap = Math.round(Math.min(MIN_OVERLAP_SEC, (guide.length / SR) * 0.5) * fps);
  let best = -1, bestV = -Infinity, sum = 0, sum2 = 0, n = 0;
  for (let i = 0; i < lags.length; i++) {
    if (vals[i].overlap < minOverlap) continue;
    const v = vals[i].v;
    sum += v; sum2 += v * v; n++;
    if (v > bestV) { bestV = v; best = i; }
  }
  if (best < 0) throw new Error('The guide and the clip are too short to compare.');
  const mean = sum / n, sd = Math.sqrt(Math.max(1e-12, sum2 / n - mean * mean));
  // The runner-up: the best lag more than 0.4 s away from the winner.
  let second = -Infinity;
  for (let i = 0; i < lags.length; i++) {
    if (vals[i].overlap < minOverlap || Math.abs(lags[i] - lags[best]) <= 0.4 * fps) continue;
    if (vals[i].v > second) second = vals[i].v;
  }
  const z = (bestV - mean) / sd;
  // What chance alone gives: the same correlation with the guide played backwards (the same sounds
  // and the same rhythm of beeps, in an order that cannot match anything in the clip).
  const rev = { frames: gc.frames, data: new Float32Array(gc.data.length) };
  for (let f = 0; f < gc.frames; f++) rev.data.set(gc.data.subarray((gc.frames - 1 - f) * BANDS, (gc.frames - f) * BANDS), f * BANDS);
  const nul = normalisedXcorr(rev, oc);
  let nullPeak = -Infinity;
  for (let i = 0; i < nul.lags.length; i++) if (nul.vals[i].overlap >= minOverlap && nul.vals[i].v > nullPeak) nullPeak = nul.vals[i].v;
  // How far the winner stands out of everything else, 0 to 1. Two things must hold: the best lag is
  // many standard deviations above the typical lag (z: a clip with no guide in it gives 4 to 6, a
  // clip that holds the guide 10 or more), and it beats the best the guide played BACKWARDS can do
  // (the same sounds and the same beeps, in an order that cannot be in the clip) by a margin.
  const margin = bestV / Math.max(0.02, second, nullPeak);
  const confidence = Math.max(0, Math.min(1, (z - 6) / 5)) * Math.max(0, Math.min(1, (margin - 1.25) / 1.0));
  // Refine at 2 ms around the coarse lag.
  const coarseLag = lags[best];
  const ratio = HOP_COARSE / HOP_FINE;
  const gf = features(guide, HOP_FINE);
  const startSample = Math.max(0, Math.round(coarseLag * HOP_COARSE - REFINE_SEC * SR - 2 * WIN));
  const endSample = Math.min(clip.length, Math.round(coarseLag * HOP_COARSE + guide.length + REFINE_SEC * SR + 2 * WIN));
  const of = features(clip, HOP_FINE, startSample, endSample);
  const baseFrames = startSample / HOP_FINE; // of's frame 0 is at clip frame baseFrames
  const centre = Math.round(coarseLag * ratio - baseFrames);
  const span = Math.round((REFINE_SEC * SR) / HOP_FINE);
  const scores = [];
  for (let d = -span; d <= span; d++) scores.push(ncc(gf, of, centre + d));
  let bi = 0;
  for (let i = 1; i < scores.length; i++) if (scores[i] > scores[bi]) bi = i;
  let frac = 0;
  if (bi > 0 && bi < scores.length - 1) {
    const a = scores[bi - 1], b = scores[bi], c = scores[bi + 1];
    const den = a - 2 * b + c;
    if (den < 0) frac = Math.max(-0.5, Math.min(0.5, (0.5 * (a - c)) / den));
  }
  let fineLag = coarseLag * ratio + (bi - span) + frac; // in 2 ms frames
  // Room echo smears each sound's loudness a little later, and the match above follows the loudness, so in
  // a roomy recording it can sit a few tens of ms late. The direct sound's EDGES are not smeared: look
  // again, within +-70 ms, at where the edges (the loudness going up) of the guide match the clip's.
  {
    const gE = features(guide, HOP_FINE, 0, guide.length, true);
    const oE = features(clip, HOP_FINE, startSample, endSample, true);
    const span2 = Math.round((0.07 * SR) / HOP_FINE);
    const centre2 = Math.round(fineLag - baseFrames);
    const sc = [];
    for (let d = -span2; d <= span2; d++) sc.push(ncc(gE, oE, centre2 + d));
    let b2 = 0;
    for (let i = 1; i < sc.length; i++) if (sc[i] > sc[b2]) b2 = i;
    // the earliest lag whose match is nearly as good as the best (the direct path comes first)
    let pick = b2;
    for (let i = 0; i < b2; i++) if (sc[i] >= 0.93 * sc[b2] && sc[i] >= sc[Math.max(0, i - 1)]) { pick = i; break; }
    if (sc[pick] > 0) fineLag = fineLag + (pick - span2);
  }
  return {
    offsetSec: (fineLag * HOP_FINE) / SR,
    confidence: Math.round(confidence * 1000) / 1000,
    peak: Math.round(bestV * 1000) / 1000,
    runnerUp: Math.round(second * 1000) / 1000,
    nullPeak: Math.round(nullPeak * 1000) / 1000,
    z: Math.round(z * 10) / 10,
    overlapSec: Math.round((vals[best].overlap / fps) * 10) / 10,
  };
}

export function alignAudio(guideFile, clipFile) {
  const guide = decodeAudio(guideFile), clip = decodeAudio(clipFile);
  const r = alignSignals(guide, clip);
  return { ...r, guideSec: Math.round((guide.length / SR) * 100) / 100, clipSec: Math.round((clip.length / SR) * 100) / 100 };
}

// ─────────────────────────────────────────────────────────────────────────────
// Command line.
// ─────────────────────────────────────────────────────────────────────────────
const verdict = (c) => (c >= 0.8 ? 'good' : c >= 0.5 ? 'fair' : 'not reliable: the guide is hardly audible in this clip');
const sign = (x) => `${x >= 0 ? '+' : '-'}${Math.abs(x).toFixed(3)}`;
const mmss = (s) => `${Math.floor(Math.abs(s) / 60)}:${(Math.abs(s) % 60).toFixed(1).padStart(4, '0')}`;

async function main() {
  const argv = process.argv.slice(2);
  const flag = (n) => argv.includes(n);
  const val = (n) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : undefined; };
  if (flag('--help') || flag('-h') || argv.length < 2) {
    const lines = fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n');
    console.log(lines.slice(0, lines.findIndex((l) => !l.startsWith('//'))).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
    process.exit(flag('--help') || flag('-h') ? 0 : 1);
  }
  const skip = new Set();
  for (const o of ['--json', '--timing']) { const i = argv.indexOf(o); if (i >= 0) { skip.add(i); if (argv[i + 1] && !argv[i + 1].startsWith('--')) skip.add(i + 1); } }
  const files = argv.filter((a, i) => !a.startsWith('--') && !skip.has(i));
  if (files.length !== 2) { console.error('align-audio: give the guide video and the owner clip: node tools/align-audio.mjs <guide.mp4> <owner-clip.mp4>'); process.exit(1); }
  const [guideFile, clipFile] = files;
  let r;
  try { r = alignAudio(guideFile, clipFile); } catch (e) { console.error(`align-audio: ${e.message}`); process.exit(1); }
  // The timing sheet, when there is one.
  let timing = null;
  const tFile = val('--timing') || path.join(path.dirname(guideFile), `${path.basename(guideFile, path.extname(guideFile))}.timing.json`);
  if (fs.existsSync(tFile)) { try { timing = JSON.parse(fs.readFileSync(tFile, 'utf8')); } catch { /* ignore a sheet that does not read */ } }
  const onClip = (t) => Math.round((t + r.offsetSec) * 1000) / 1000;
  const out = { ...r, guide: path.resolve(guideFile), clip: path.resolve(clipFile) };
  if (timing && Number.isFinite(timing.goAtSec)) {
    out.bellOnClipSec = onClip(timing.goAtSec);
    out.callsOnClipSec = (timing.calls || []).map((c) => ({ index: c.index, text: c.text, startSec: onClip(c.startSec) }));
  }
  if (flag('--json')) {
    const jf = val('--json') || `${clipFile.replace(/\.[^.\\/]+$/, '')}.align.json`;
    fs.writeFileSync(jf, JSON.stringify(out, null, 2) + '\n');
  }
  if (flag('--quiet')) { console.log(r.offsetSec.toFixed(3)); return; }
  console.log(`guide   ${path.basename(guideFile)}  (${r.guideSec.toFixed(1)} s)`);
  console.log(`clip    ${path.basename(clipFile)}  (${r.clipSec.toFixed(1)} s)`);
  console.log(`offset  ${sign(r.offsetSec)} s   the guide's 0:00 falls at ${r.offsetSec >= 0 ? `${r.offsetSec.toFixed(3)} s on your clip` : `${Math.abs(r.offsetSec).toFixed(3)} s BEFORE your clip starts`}`);
  console.log(`confidence ${r.confidence.toFixed(2)}  ${verdict(r.confidence)}  (match ${r.peak}, next best ${r.runnerUp}, ${r.overlapSec} s of the guide overlap the clip)`);
  if (out.bellOnClipSec !== undefined) {
    console.log(`the bell is at ${mmss(out.bellOnClipSec)} on your clip; call ${out.callsOnClipSec[0]?.index ?? 1} at ${mmss(out.callsOnClipSec[0]?.startSec ?? 0)}`);
  }
  if (r.confidence < 0.5) console.error('align-audio: low confidence. Was the guide playing out loud while you filmed, and is its sound in the clip?');
  process.exitCode = r.confidence < 0.5 ? 2 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await main();
