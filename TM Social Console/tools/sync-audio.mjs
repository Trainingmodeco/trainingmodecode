// The guide sound of the Combo Coach sync videos (used by tools/app-broll.mjs, the "sync" clips).
//
// The app speaks with the device's speech synthesis, and a headless browser has no
// voices. So the recorder swaps speechSynthesis for a stand-in (see SPEECH_PAGE in
// app-broll.mjs) and asks THIS file for each line: how long it takes to say (the app's
// own flow waits for exactly that long, as it does with a real voice) and, later, the
// sound itself. Everything is offline: a text-to-speech program installed on the
// machine (apt-get install espeak-ng flite; see VOICES), then ffmpeg for the polish
// and the mix. No music, no network.
//
// What a guide track is made of (buildGuide):
//   3 count-in beeps, one on each of the app's 3 - 2 - 1 screens
//   the app's own boxing bell (public/tm/audio/bell-signals.mp3, the single ring) on GO
//   every other line the app says (the round announcement, Go!, each combo, the slip / roll calls),
//   each starting on the frame its text appears
// The app's spoken "3, 2, 1" are left out (the beeps are the count-in) and so is its
// silent warm-up line.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { ROOT, ffmpeg } from './lib.mjs';

export const SR = 48000; // the guide is built at 48 kHz mono, floats in memory

// The polish every phrase gets (see polish()): gain in dB at 140 Hz, 1.2 kHz, 3 kHz and 6 kHz, and the
// compressor's ratio. Heavy on the presence band: the consonants are what carry over a gym's noise.
const ANNOUNCER = { low: -3, mid: 5, presence: 10, air: 6, ratio: 4 };

// ─────────────────────────────────────────────────────────────────────────────
// Voices. Every engine here is a command line program, run once per phrase.
// ─────────────────────────────────────────────────────────────────────────────
// `speak(text, rate, out)` writes a wav of `text`; rate 1 is the voice's normal pace
// for this guide, 1.15 is 15% faster. `shape` is the polish every phrase gets (see polish()).
export const VOICES = {
  // The one the guide ships with. Picked from the voices installable offline (eSpeak NG formant voices,
  // eSpeak NG + MBROLA us1/us2/us3/en1, Flite rms/awb/slt/kal16, SVOX Pico): the one with the best
  // closed-vocabulary recognition of the strike words (PocketSphinx on 20 combos), clean and through
  // room noise at 18, 12 and 8 dB with a phone-microphone lowpass. See the VOICE block in README.md.
  // Speed 200, pitch 35 (a deeper, harder voice), EQ with a lot of presence (the SHAPE below).
  'mbrola-us2': {
    label: 'eSpeak NG with MBROLA us2 (American male)',
    bin: 'espeak-ng',
    install: 'apt-get install espeak-ng mbrola mbrola-us2',
    speak: (text, rate, out) => ['espeak-ng', '-v', 'mb-us2', '-s', String(Math.round(200 * rate)), '-p', '35', '-w', out, text],
    shape: ANNOUNCER,
  },
  // Without MBROLA: eSpeak NG's own formant voice. Robotic, but it stays clear through noise.
  'espeak-us-m3': {
    label: 'eSpeak NG, American English, male voice 3',
    bin: 'espeak-ng',
    install: 'apt-get install espeak-ng',
    speak: (text, rate, out) => ['espeak-ng', '-v', 'en-us+m3', '-s', String(Math.round(190 * rate)), '-p', '38', '-g', '1', '-w', out, text],
    shape: ANNOUNCER,
  },
  'flite-rms': {
    label: 'Flite, rms (American male)',
    bin: 'flite',
    install: 'apt-get install flite',
    speak: (text, rate, out) => ['flite', '-voice', 'rms', '--setf', `duration_stretch=${(0.6 / rate).toFixed(3)}`, '-t', text, '-o', out],
    shape: ANNOUNCER,
  },
  'pico-us': {
    label: 'SVOX Pico, American English',
    bin: 'pico2wave',
    install: 'apt-get install libttspico-utils',
    speak: (text, rate, out) => ['pico2wave', '-l', 'en-US', '-w', out, `<speed level='${Math.round(140 * rate)}'>${text}</speed>`],
    shape: ANNOUNCER,
  },
  'mbrola-us1': {
    label: 'eSpeak NG with MBROLA us1 (American female)',
    bin: 'espeak-ng',
    install: 'apt-get install espeak-ng mbrola mbrola-us1',
    speak: (text, rate, out) => ['espeak-ng', '-v', 'mb-us1', '-s', String(Math.round(200 * rate)), '-p', '35', '-w', out, text],
    shape: ANNOUNCER,
  },
};
export const VOICE_ORDER = ['mbrola-us2', 'espeak-us-m3', 'flite-rms', 'pico-us'];

const have = (bin) => !spawnSync(bin, ['--version'], { stdio: 'ignore' }).error; // a missing program is a spawn error

// The first voice whose program is installed, or null. `want` names one to use.
export function findVoice(want) {
  const names = want ? [want] : VOICE_ORDER;
  for (const n of names) {
    const v = VOICES[n];
    if (!v) throw new Error(`no voice "${n}". Voices: ${Object.keys(VOICES).join(', ')}`);
    if (!have(v.bin)) continue;
    // espeak-ng with MBROLA needs its voice data too: ask for a word and see.
    const probe = path.join(os.tmpdir(), `tm-voice-probe-${process.pid}.wav`);
    const [cmd, ...args] = v.speak('test', 1, probe);
    const r = spawnSync(cmd, args, { stdio: 'ignore' });
    const ok = r.status === 0 && fs.existsSync(probe) && fs.statSync(probe).size > 1000;
    fs.rmSync(probe, { force: true });
    if (ok) return { name: n, ...v };
  }
  return null;
}
// The sync videos need a full ffmpeg on the PATH (the copy Remotion bundles is a slim build without the audio
// encoders and filters used here). Checked before anything is recorded, so a missing or slim ffmpeg costs
// seconds and not a 2-minute recording. Returns null when it is fine, else the sentence to show.
export const ffmpegHint = 'The sync videos need a full ffmpeg on the PATH: winget install Gyan.FFmpeg (Windows), brew install ffmpeg (macOS), apt-get install ffmpeg (Linux). Then open a new terminal and run it again.';
export function checkFfmpeg() {
  const run = (args) => spawnSync('ffmpeg', ['-hide_banner', ...args], { encoding: 'utf8' });
  const enc = run(['-encoders']);
  if (enc.error || enc.status !== 0) return `ffmpeg was not found. ${ffmpegHint}`;
  const flt = run(['-filters']);
  const lacks = [
    ...['libx264', 'aac', 'pcm_f32le', 'pcm_s16le'].filter((e) => !new RegExp(`\\s${e}\\s`).test(enc.stdout)).map((e) => `the ${e} encoder`),
    ...['loudnorm', 'equalizer', 'acompressor', 'alimiter', 'adelay', 'amix', 'aresample', 'highpass', 'afade', 'pan', 'apad', 'atrim', 'ebur128'].filter((f) => !new RegExp(`\\s${f}\\s`).test(flt.stdout)).map((f) => `the ${f} filter`),
  ];
  if (lacks.length) return `this ffmpeg has no ${lacks.join(', ')}. ${ffmpegHint}`;
  // One second of every step the guide uses, for real.
  const t = run(['-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1', '-f', 'lavfi', '-i', 'color=c=black:s=64x64:r=30:d=1', '-filter_complex',
    '[0:a]highpass=f=85,equalizer=f=3000:t=q:w=0.9:g=6,acompressor=threshold=0.1:ratio=4,adelay=100S:all=1,apad=whole_len=48000,atrim=end_sample=48000,pan=stereo|c0=c0|c1=c0,loudnorm=I=-16:TP=-1.5:LRA=11,alimiter=limit=0.9[a]', '-map', '[a]', '-map', '1:v', '-c:a', 'aac', '-c:v', 'libx264', '-f', 'null', '-']);
  if (t.status !== 0) return `a test encode with this ffmpeg failed (${String(t.stderr || '').trim().split('\n').slice(-1)[0]}). ${ffmpegHint}`;
  return null;
}
export const installHint = () => `No offline text-to-speech program found. Install one (Linux: apt-get install -y espeak-ng; macOS: brew install espeak-ng; Windows: the eSpeak NG installer, then add it to PATH), or run with --no-voice.`;

// ─────────────────────────────────────────────────────────────────────────────
// WAV in and out (16-bit or float, mono): enough for what ffmpeg writes here.
// ─────────────────────────────────────────────────────────────────────────────
export function readWav(file) {
  const b = fs.readFileSync(file);
  let p = 12, fmt = null;
  while (p + 8 <= b.length) {
    const id = b.toString('ascii', p, p + 4), size = b.readUInt32LE(p + 4);
    if (id === 'fmt ') {
      fmt = { tag: b.readUInt16LE(p + 8), ch: b.readUInt16LE(p + 10), rate: b.readUInt32LE(p + 12), bits: b.readUInt16LE(p + 22) };
      // ffmpeg writes float (and 3+ channels) as WAVE_FORMAT_EXTENSIBLE: the real format is the first
      // two bytes of the sub-format GUID.
      if (fmt.tag === 0xfffe && size >= 40) fmt.tag = b.readUInt16LE(p + 8 + 24);
    }
    if (id === 'data') {
      const n = Math.floor(Math.min(size, b.length - p - 8) / (fmt.bits / 8) / fmt.ch);
      const out = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const o = p + 8 + i * fmt.ch * (fmt.bits / 8);
        out[i] = fmt.bits === 16 ? b.readInt16LE(o) / 32768 : fmt.bits === 32 && fmt.tag === 3 ? b.readFloatLE(o) : b.readInt32LE(o) / 2147483648;
      }
      return { pcm: out, rate: fmt.rate };
    }
    p += 8 + size + (size & 1);
  }
  throw new Error(`${file}: no audio data`);
}
export function writeWavF32(file, pcm, rate = SR) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length * 4, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(3, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(32, 34); h.write('data', 36); h.writeUInt32LE(pcm.length * 4, 40);
  fs.writeFileSync(file, Buffer.concat([h, Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength)]));
}

// ─────────────────────────────────────────────────────────────────────────────
// Phrases: how a line the app speaks is cut into pieces for the voice.
// ─────────────────────────────────────────────────────────────────────────────
// A combo arrives as "jab jab cross left hook" with no punctuation, and a voice reads that
// as one run-on phrase. An announcer calls each strike on its own beat, so the line is cut
// into strikes (the same pieces the app counts: data/comboMix.js) and each is said as its
// own short phrase with a small gap. The words and their order are the app's, untouched.
const MULTI = ['question mark kick', 'spinning back kick', 'spinning back elbow', 'spinning back fist', 'spinning backfist', 'spinning heel kick', 'superman punch', 'bolo punch', 'flying knee', 'jumping elbow', 'pull counter', 'check counter', 'catch kick', 'feint shot', 'level change', 'fake shot', 'ground pound', 'ground knee', 'step back', 'circle out', 'rear body hook', 'shovel hook', 'check hook', 'oblique kick'];
const MODS = new Set(['double', 'body', 'head', 'lead', 'rear', 'step', 'spinning', 'flying', 'jumping', 'high', 'low', 'switch']);
// How many words the strike that starts at words[i] takes: a two- or three-word name from MULTI, or a
// modifier and the strike after it ("body hook", "double jab", and "double low kick": a modifier's strike
// can itself be a modifier and a word), else the one word.
function unitLength(words, i) {
  const hit = MULTI.find((m) => { const mw = m.split(' '); return mw.every((w, k) => words[i + k] === w); });
  if (hit) return hit.split(' ').length;
  if (MODS.has(words[i]) && i + 1 < words.length) return 1 + unitLength(words, i + 1);
  return 1;
}
export function strikePieces(words) {
  const out = [];
  for (let i = 0; i < words.length;) {
    const len = unitLength(words, i);
    out.push(words.slice(i, i + len).join(' '));
    i += len;
  }
  return out;
}
export const STRIKE_WORDS = new Set(['jab', 'cross', 'hook', 'uppercut', 'overhand', 'kick', 'knee', 'elbow', 'teep', 'roundhouse', 'backfist', 'fist', 'punch', 'slip', 'roll', 'pivot', 'check', 'parry', 'pull', 'feint', 'counter', 'sprawl', 'clinch', 'throw', 'push', 'exit', 'frame', 'sweep', 'pass', 'break', 'shot', 'pound', 'oblique', 'switch', 'double', 'body', 'head', 'lead', 'rear', 'step', 'spinning', 'flying', 'jumping', 'high', 'low', 'level', 'change', 'fake', 'circle', 'out', 'back', 'catch', 'ground', 'bolo', 'superman', 'question', 'mark', 'wheel', 'axe', 'tornado', 'heel', 'shovel']);
// A line -> [{ text, gap }] : the phrases to say in order, `gap` the silence (s) before it.
export function phrasesOf(line) {
  const text = String(line).toLowerCase().replace(/(\d)\.(\d)/g, '$1\u0001$2');
  const sentences = text.split(/[.!?;,]+\s*/).map((s) => s.replace(/\u0001/g, '.').trim()).filter(Boolean);
  const out = [];
  sentences.forEach((s, si) => {
    const words = s.split(/\s+/);
    if (words.length > 1 && words.every((w) => STRIKE_WORDS.has(w))) {
      strikePieces(words).forEach((p, pi) => out.push({ text: p, gap: si === 0 && pi === 0 ? 0 : pi === 0 ? 0.3 : 0.12 }));
    } else out.push({ text: s, gap: si === 0 ? 0 : 0.28 });
  });
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// The voice bank: a phrase -> 48 kHz mono floats, polished, loud, cached on disk.
// ─────────────────────────────────────────────────────────────────────────────
const TARGET_RMS = 0.2;  // about -14 dBFS while speaking, before the final loudness pass
const CEILING = 0.95;    // no sample above this
const TRIM_DB = -38;     // silence at the ends of a phrase (relative to its own peak): below this is breath and engine hiss, not the word

export class VoiceBank {
  constructor(voice, cacheRoot = path.join(os.tmpdir(), 'tm-sync-voice')) {
    this.voice = voice;
    this.dir = path.join(cacheRoot, voice.name);
    fs.mkdirSync(this.dir, { recursive: true });
    this.mem = new Map();
  }
  // One phrase at one rate.
  phrase(text, rate = 1) {
    const key = `v2|${TRIM_DB}|${text}|${rate.toFixed(3)}|${JSON.stringify(this.voice.shape)}|${this.voice.speak('x', 1, 'o').join(' ')}`;
    if (this.mem.has(key)) return this.mem.get(key);
    const file = path.join(this.dir, `${crypto.createHash('sha1').update(key).digest('hex').slice(0, 16)}.wav`);
    if (!fs.existsSync(file)) {
      const raw = `${file}.raw.wav`;
      const [cmd, ...args] = this.voice.speak(text, rate, raw);
      const r = spawnSync(cmd, args, { stdio: 'ignore' });
      if (r.status !== 0 || !fs.existsSync(raw)) throw new Error(`${this.voice.bin} failed on "${text}"`);
      polish(raw, file, this.voice.shape);
      fs.rmSync(raw, { force: true });
    }
    const { pcm } = readWav(file);
    this.mem.set(key, pcm);
    return pcm;
  }
  // A whole line the app speaks: phrases with their gaps. { pcm, ms, onset, audible } (ms: how long it takes to say; onset: seconds from the first sample to where the sound is HEARD to start, see onsetOf; audible: where the very first sound is, the soft "h" of "hook", see audibleOf).
  say(line, rate = 1) {
    const parts = phrasesOf(line).map((p) => ({ gap: p.gap, pcm: this.phrase(p.text, rate) }));
    let n = 0;
    for (const p of parts) n += Math.round((p.gap / Math.max(0.5, rate)) * SR) + p.pcm.length;
    const out = new Float32Array(n);
    let at = 0;
    for (const p of parts) {
      at += Math.round((p.gap / Math.max(0.5, rate)) * SR);
      out.set(p.pcm, at);
      at += p.pcm.length;
    }
    return { pcm: out, ms: Math.round((n / SR) * 1000), onset: onsetOf(out), audible: audibleOf(out) };
  }
}

// The engine's wav -> equalised for an announcer (a touch of body, a lot of presence so the
// consonants carry over a gym's noise), gently compressed, trimmed, brought to a fixed loudness
// and held under a ceiling by a look-ahead limiter (loud without distortion). 48 kHz mono float out.
function polish(rawFile, outFile, shape) {
  const tmp = `${outFile}.step.wav`;
  const eq = [
    'highpass=f=85',
    `equalizer=f=140:t=q:w=1.2:g=${shape.low}`,
    `equalizer=f=1200:t=q:w=1:g=${shape.mid}`,
    `equalizer=f=3000:t=q:w=0.9:g=${shape.presence}`,
    `equalizer=f=6000:t=q:w=0.8:g=${shape.air}`,
  ].join(',');
  ffmpeg([
    '-i', rawFile, '-ac', '1',
    '-af', `aresample=${SR},${eq},acompressor=threshold=0.1:ratio=${shape.ratio ?? 3}:attack=4:release=60:makeup=1`,
    '-c:a', 'pcm_f32le', tmp,
  ]);
  const { pcm } = readWav(tmp);
  fs.rmSync(tmp, { force: true });
  // Trim the silence at both ends (relative to the phrase's own peak), keep a 2 ms lead so the
  // consonant's attack is whole, then level the phrase.
  let peak = 0;
  for (const v of pcm) peak = Math.max(peak, Math.abs(v));
  const thr = peak * 10 ** (TRIM_DB / 20);
  let a = 0, z = pcm.length - 1;
  while (a < pcm.length && Math.abs(pcm[a]) < thr) a++;
  while (z > a && Math.abs(pcm[z]) < thr) z--;
  a = Math.max(0, a - Math.round(0.002 * SR));
  z = Math.min(pcm.length - 1, z + Math.round(0.012 * SR));
  const seg = pcm.slice(a, z + 1);
  let e = 0, cnt = 0;
  for (const v of seg) if (Math.abs(v) > thr * 4) { e += v * v; cnt++; }
  const g = cnt ? TARGET_RMS / Math.sqrt(e / cnt) : 1;
  for (let i = 0; i < seg.length; i++) seg[i] *= g;
  limit(seg, CEILING);
  const fade = Math.round(0.006 * SR);
  for (let i = 0; i < fade && i < seg.length; i++) seg[seg.length - 1 - i] *= i / fade;
  writeWavF32(outFile, seg);
}

// A look-ahead limiter: the gain each sample needs to stay under `ceiling`, taken as the lowest need
// within 2 ms either side, then averaged over 1.5 ms either side (so the gain moves smoothly and a
// loud plosive is turned down before it arrives). The average of minimums never rises above the need
// of any sample it covers, so the ceiling holds.
export function limit(x, ceiling) {
  const n = x.length, w = Math.round(0.002 * SR), sm = Math.round(0.0015 * SR);
  const held = new Float32Array(n).fill(1);
  for (let i = 0; i < n; i++) {
    const m = Math.abs(x[i]);
    if (m <= ceiling) continue;
    const need = ceiling / m;
    for (let k = Math.max(0, i - w); k <= Math.min(n - 1, i + w); k++) if (need < held[k]) held[k] = need;
  }
  const pre = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) pre[i + 1] = pre[i] + held[i];
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - sm), z = Math.min(n, i + sm + 1);
    x[i] *= (pre[z] - pre[a]) / (z - a);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// The count-in beep and the bell.
// ─────────────────────────────────────────────────────────────────────────────
// 1 kHz with its octave on top (a phone's small speaker carries the octave), 180 ms, 6 ms fades.
export function beepPcm(sec = 0.18) {
  const n = Math.round(sec * SR), out = new Float32Array(n), f = Math.round(0.006 * SR);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const env = Math.min(1, i / f, (n - i) / f);
    out[i] = 0.7 * env * (Math.sin(2 * Math.PI * 1000 * t) + 0.45 * Math.sin(2 * Math.PI * 2000 * t)) / 1.45;
  }
  return out;
}
// The app's single ring (src/parts/Bell.tsx: 0.1 s in, 2.2 s long, the last half second faded).
export function bellPcm() {
  const file = path.join(ROOT, 'public', 'tm', 'audio', 'bell-signals.mp3');
  if (!fs.existsSync(file)) throw new Error(`${file} is missing. Run npm run sync (it copies the app's audio into public/tm/).`);
  const tmp = path.join(os.tmpdir(), `tm-bell-${process.pid}.wav`);
  ffmpeg(['-ss', '0.1', '-t', '2.2', '-i', file, '-ac', '1', '-af', `aresample=${SR},afade=t=out:st=1.7:d=0.5`, '-c:a', 'pcm_f32le', tmp]);
  const { pcm } = readWav(tmp);
  fs.rmSync(tmp, { force: true });
  let peak = 0;
  for (const v of pcm) peak = Math.max(peak, Math.abs(v));
  const g = peak ? 0.85 / peak : 1;
  return pcm.map((v) => v * g);
}
// A short tick (silent-voice fallback): one per call.
export function tickPcm() {
  const n = Math.round(0.07 * SR), out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = 0.6 * Math.exp(-i / (0.012 * SR)) * Math.sin(2 * Math.PI * 1800 * (i / SR));
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// The mix: every element at its sample, summed, brought to -16 LUFS, stereo AAC.
// ─────────────────────────────────────────────────────────────────────────────
// elements: [{ pcm, at (seconds on the video's clock) }]. Returns the path of the written wav
// (48 kHz stereo, 16-bit) and what loudnorm measured.
export function mixGuide(elements, durationSec, outWav, { lufs = -16, truePeak = -1.5 } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-guide-mix-'));
  try {
    const inputs = [], filters = [];
    elements.forEach((el, i) => {
      const f = path.join(dir, `e${i}.wav`);
      writeWavF32(f, el.pcm);
      inputs.push('-i', f);
      filters.push(`[${i}:a]adelay=${Math.max(0, Math.round(el.at * SR))}S:all=1[a${i}]`);
    });
    const labels = elements.map((_, i) => `[a${i}]`).join('');
    const total = Math.round(durationSec * SR);
    const base = `${filters.join(';')};${labels}amix=inputs=${elements.length}:normalize=0:duration=longest:dropout_transition=0,apad=whole_len=${total},atrim=end_sample=${total}`;
    // Pass 1: measure. Pass 2: apply the measured gain linearly (no pumping, the beeps and the voice keep their balance).
    // (made stereo first: a mono voice played on both speakers reads 3 LU louder than it measured as mono)
    const measure = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-y', ...inputs, '-filter_complex', `${base},pan=stereo|c0=c0|c1=c0,loudnorm=I=${lufs}:TP=${truePeak}:LRA=11:print_format=json`, '-f', 'null', '-'], { encoding: 'utf8' });
    const m = /\{[\s\S]*"target_offset"[\s\S]*?\}/.exec(measure.stderr || '');
    if (!m) throw new Error(`loudnorm measured nothing: ${(measure.stderr || '').split('\n').slice(-4).join(' ')}`);
    const j = JSON.parse(m[0]);
    const ln = `loudnorm=I=${lufs}:TP=${truePeak}:LRA=11:measured_I=${j.input_i}:measured_TP=${j.input_tp}:measured_LRA=${j.input_lra}:measured_thresh=${j.input_thresh}:offset=${j.target_offset}:linear=true`;
    ffmpeg([...inputs, '-filter_complex', `${base},pan=stereo|c0=c0|c1=c0,${ln},aresample=${SR}[out]`, '-map', '[out]', '-c:a', 'pcm_s16le', outWav]);
    return { measured: { inputI: Number(j.input_i), inputTP: Number(j.input_tp) } };
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

// ─────────────────────────────────────────────────────────────────────────────
// Onsets: where sound begins, measured from the finished file (the self-check).
// ─────────────────────────────────────────────────────────────────────────────
// The mono 48 kHz soundtrack of a media file as floats.
export function decodeTrack(file) {
  const tmp = path.join(os.tmpdir(), `tm-decode-${process.pid}-${crypto.randomBytes(3).toString('hex')}.wav`);
  ffmpeg(['-i', file, '-vn', '-ac', '1', '-ar', String(SR), '-c:a', 'pcm_f32le', tmp]);
  const { pcm } = readWav(tmp);
  fs.rmSync(tmp, { force: true });
  return pcm;
}
// Where a sound starts, the way a person hears a word begin: the first moment the 2 ms loudness
// (RMS) reaches a fifth of the loudest 2 ms in the next `look` seconds (and is above -50 dBFS). A
// soft start (the "h" of "hook", the "j" of "jab") is a few tens of milliseconds before the first
// sample that is not silence; the voice is placed so THIS moment, not the first sample, lands on the
// frame where the words show. Seconds from `from`; null when nothing is there.
export function onsetOf(pcm, from = 0, look = 0.6) {
  const a = Math.max(0, Math.round(from * SR)), z = Math.min(pcm.length, a + Math.round(look * SR));
  const w = Math.round(0.002 * SR);
  const rms = (i) => { let e = 0; for (let k = 0; k < w; k++) e += pcm[i + k] ** 2; return Math.sqrt(e / w); };
  let peak = 0;
  for (let i = a; i + w <= z; i += w) peak = Math.max(peak, rms(i));
  const thr = Math.max(10 ** (-50 / 20), peak * 0.2);
  for (let i = a; i + w <= z; i += Math.round(w / 2)) if (rms(i) >= thr) return (i - a) / SR;
  return null;
}
// Where the very first sound of a phrase is: the first 2 ms of loudness above -47 dBFS (the voice is at about
// -14 dBFS while speaking before the final loudness pass, which turns it down to about -20: this is about the
// -50 dBFS a listener's meter reads on the finished track; a phrase is trimmed at 38 dB under its peak, about
// -41 dBFS, so the first sample kept is above it). The soft start of a word ("h" of "hook", "f" of "feint",
// the "p" of "pivot") is up to 80 ms before the loudness has reached what a person hears as the word starting.
export function audibleOf(pcm, from = 0, look = 0.6) {
  const a = Math.max(0, Math.round(from * SR)), z = Math.min(pcm.length, a + Math.round(look * SR));
  const w = Math.round(0.002 * SR), thr = 10 ** (-47 / 20);
  for (let i = a; i + w <= z; i += Math.round(w / 2)) {
    let e = 0;
    for (let k = 0; k < w; k++) e += pcm[i + k] ** 2;
    if (Math.sqrt(e / w) >= thr) return (i - a) / SR;
  }
  return null;
}
// The most the first soft sound of a call may lead the frame where its words show, seconds. The voice is
// placed so its HEARD start (onsetOf) is on that frame; when the soft start before it is longer than this,
// the voice is delayed by the excess, so no sound comes more than this early and none is heard late by more
// than the soft start's excess (at most about 40 ms for the softest starts: the soft start leads by up to 80 ms).
export const SOFT_LEAD_MAX = 0.04;
// Where the voice file starts relative to the frame where its words show, seconds early (always >= 0):
// the heard start on the frame, the soft start no more than SOFT_LEAD_MAX before it.
export function voiceEarly({ onset, audible }, cap = Infinity) {
  const heard = onset ?? 0, first = audible ?? heard;
  const lead = Math.max(0, heard - first);
  return Math.min(cap, Math.max(0, heard - Math.max(0, lead - SOFT_LEAD_MAX)));
}
// Where a call is HEARD to begin in a long (finished) track, read the way a listener's meter does: the loudest 2 ms in
// the 0.5 s from `want` is the peak, and the heard start is the first 2 ms, from 0.25 s before `want` to 0.35 s after
// it, that is above a fifth of that peak, above -50 dBFS and 12 dB above the level 30 ms before it (a rise, not a
// tail). A stricter and later reading than onsetOf's, used on the finished file. Seconds on the track; null when none.
export function heardNear(track, want) {
  const w = Math.round(0.002 * SR);
  const rms = (i) => { let e = 0; for (let k = 0; k < w; k++) e += track[i + k] ** 2; return Math.sqrt(e / w); };
  const db = (x) => 20 * Math.log10(Math.max(1e-7, x));
  const s0 = Math.round(want * SR);
  let pk = 0;
  for (let i = s0; i + w <= Math.min(track.length, s0 + Math.round(0.5 * SR)); i += w) pk = Math.max(pk, rms(i));
  if (pk <= 0) return null;
  const a = Math.max(15 * w, Math.round((want - 0.25) * SR)), z = Math.min(track.length - w, Math.round((want + 0.35) * SR));
  for (let i = a - (a % w); i < z; i += w) {
    const e = rms(i);
    if (e > 0.2 * pk && db(e) > -50 && db(e) > db(rms(i - 15 * w)) + 12) return i / SR;
  }
  return null;
}
// The first sound in a long (finished) track, the way a listener's meter reads it: at or after `from`, the
// first 2 ms above -50 dBFS that is also 12 dB above the level 30 ms before it. Seconds on the track; null
// when nothing is there.
export function firstSoundNear(track, from, look = 0.5) {
  const w = Math.round(0.002 * SR), a = Math.max(0, Math.round(from * SR)), z = Math.min(track.length, a + Math.round(look * SR));
  const lev = (i) => { let e = 0; for (let k = 0; k < w; k++) e += track[i + k] ** 2; return 20 * Math.log10(Math.max(1e-7, Math.sqrt(e / w))); };
  for (let i = a; i + w <= z; i += w) {
    const d = lev(i);
    if (d > -50 && d > lev(Math.max(0, i - 15 * w)) + 12) return i / SR;
  }
  return null;
}

// The same, in a long track: the time (seconds on the track) of the first onset at or after `from`.
export function onsetNear(pcm, from, look = 0.6) {
  const o = onsetOf(pcm, from, look);
  return o === null ? null : Math.max(0, from) + o;
}

// Where `el` (a mono 48 kHz sound, placed on the timeline at `at` seconds) really is in a decoded track:
// the lag (seconds) at which they match best within +-`span`, by cross-correlation (a coarse look at
// 12 kHz, then 48 kHz around the best), plus how well they match (0 to 1). The placement is exact by
// construction; this proves it on the finished file (the AAC encoder, the muxer, a player's edit list).
export function lagOf(track, el, at, span = 0.1) {
  const D = 4, a0 = Math.round(at * SR);
  const n = Math.min(el.length, Math.round(1.5 * SR)); // the first second and a half is plenty
  const dec = (x, from, len) => { const o = new Float32Array(Math.floor(len / D)); for (let i = 0; i < o.length; i++) { let s = 0; for (let k = 0; k < D; k++) s += x[from + i * D + k] || 0; o[i] = s / D; } return o; };
  const score = (shift, step, len) => { // normalised correlation of the element against the track shifted by `shift` samples
    let sx = 0, sy = 0, sxy = 0;
    for (let i = 0; i < len; i += step) { const x = el[i], y = track[a0 + shift + i] || 0; sx += x * x; sy += y * y; sxy += x * y; }
    return sxy / Math.sqrt(sx * sy + 1e-12);
  };
  void dec;
  const range = Math.round(span * SR);
  let best = 0, bv = -2;
  for (let sh = -range; sh <= range; sh += D) { const v = score(sh, D, n); if (v > bv) { bv = v; best = sh; } }
  let fine = best, fv = -2;
  for (let sh = best - D; sh <= best + D; sh++) { const v = score(sh, 1, n); if (v > fv) { fv = v; fine = sh; } }
  return { lag: fine / SR, match: fv };
}

// The loudness of a finished file, as ffmpeg's EBU R128 meter reads it: { integratedLufs, truePeakDbfs, rangeLu }.
export function measureLoudness(file) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-vn', '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8' });
  const text = r.stderr || '';
  const last = (re) => { const m = [...text.matchAll(re)]; return m.length ? Number(m[m.length - 1][1]) : null; };
  return { integratedLufs: last(/\bI:\s+(-?[\d.]+) LUFS/g), truePeakDbfs: last(/Peak:\s+(-?[\d.]+) dBFS/g), rangeLu: last(/LRA:\s+(-?[\d.]+) LU/g) };
}
