// npm run captions -- raw-footage/<clip>.mp4
// Word-by-word captions with Whisper (whisper.cpp, runs on your machine):
// writes raw-footage/<clip>.captions.json (Remotion caption format) and a
// .srt next to it for platforms that take caption files.
import fs from 'node:fs';
import path from 'node:path';
import { serializeSrt } from '@remotion/captions';
import { toCaptions, transcribe } from '@remotion/install-whisper-cpp';
import { ROOT, WHISPER, ffmpeg, writeJson } from './lib.mjs';

const input = process.argv[2];
if (!input) {
  console.error('Usage: npm run captions -- raw-footage/<clip>.mp4');
  process.exit(1);
}
const src = path.resolve(ROOT, input);
if (!fs.existsSync(src)) throw new Error(`Not found: ${src}`);
if (!fs.existsSync(WHISPER.path)) throw new Error('Whisper is not installed yet: npm run setup');

// whisper.cpp wants 16 kHz mono WAV.
const base = src.replace(/\.[^.]+$/, '');
const wav = `${base}.16k.wav`;
ffmpeg(['-i', src, '-ar', '16000', '-ac', '1', wav]);

console.log(`transcribing with ${WHISPER.model}…`);
const out = await transcribe({
  inputPath: wav,
  whisperPath: WHISPER.path,
  whisperCppVersion: WHISPER.version,
  model: WHISPER.model,
  tokenLevelTimestamps: true,
});
fs.rmSync(wav);
const { captions } = toCaptions({ whisperCppOutput: out });
writeJson(`${base}.captions.json`, captions);

// SRT: one line per ~8 words.
const lines = [];
for (let i = 0; i < captions.length; i += 8) lines.push(captions.slice(i, i + 8));
fs.writeFileSync(`${base}.srt`, serializeSrt({ lines }));
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');
console.log(`${captions.length} words → ${rel(`${base}.captions.json`)} + ${rel(`${base}.srt`)}`);
console.log(`text: ${captions.map((c) => c.text).join('').trim().slice(0, 200)}…`);
