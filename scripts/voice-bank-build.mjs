// Builds public/voice/<voice>/ from generated clips: downloads each clip,
// converts it to a small mono mp3, measures it, and writes manifest.json in
// the format data/voiceClips.js reads ({ voice, version, clips: { phrase:
// { file, ms } } }). Idempotent: clips already converted are kept.
//
//   node scripts/voice-bank-build.mjs --voice female --jobs <jobs.jsonl> [--wav-dir <dir>]
//
// jobs.jsonl: one {"key": "...", "url": "https://..."} per line (the
// generated clips' URLs); "phrase" is read as well as "key", and a key may be
// of any kind ('pace', 'pace,', '32 seconds.', 'a, b'). --wav-dir adds every
// <file>.wav in a folder whose name matches a key of --inventory: the
// inventory's { phrases: [...] }, or a record list from test:spoken --json
// ([{ key, text }] or plain keys), so __mid, __end and __s takes match too.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { clipFileFor } from '../components/training-mode/data/voicePhrases.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const VOICE = opt('voice', 'female');
const OUT = path.join(ROOT, 'public', 'voice', VOICE);
const TMP = path.join('/tmp/claude-0/bank', VOICE, 'wav');
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(TMP, { recursive: true });

const manifestFile = path.join(OUT, 'manifest.json');
const manifest = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, 'utf8')) : { voice: VOICE, version: 1, clips: {} };

const sh = (cmd, args) => spawnSync(cmd, args, { encoding: 'utf8' });
const durationMs = (file) => {
  const r = sh('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]);
  return Math.round(parseFloat(r.stdout) * 1000);
};

// Trim the silence Seed Audio leaves at both ends, mono, 24 kHz, 40 kbps mp3,
// a gentle limiter so a shout never clips, loudness evened out across clips.
// The file name follows the key's kind (clipFileFor): 'pace' -> pace.mp3,
// 'pace,' -> pace__mid.mp3, '32 seconds.' -> 32_seconds__end.mp3, a sentence
// take 'a, b' -> a_b__s.mp3, so the takes of one phrase never overwrite each other.
function convert(wav, phrase) {
  const file = clipFileFor(phrase);
  const mp3 = path.join(OUT, file);
  if (!fs.existsSync(mp3)) {
    const r = sh('ffmpeg', ['-v', 'error', '-y', '-i', wav, '-ac', '1', '-ar', '24000',
      '-af', 'silenceremove=start_periods=1:start_threshold=-45dB:stop_periods=-1:stop_threshold=-45dB:stop_duration=0.25,apad=pad_dur=0.04,loudnorm=I=-16:TP=-1.5:LRA=7,alimiter=limit=0.95',
      '-c:a', 'libmp3lame', '-b:a', '40k', mp3]);
    if (r.status !== 0) { console.error(`ffmpeg failed on "${phrase}": ${r.stderr}`); return false; }
  }
  manifest.clips[phrase] = { file, ms: durationMs(mp3) };
  return true;
}

let added = 0, failed = 0;
const jobs = opt('jobs', null);
if (jobs) {
  for (const line of fs.readFileSync(jobs, 'utf8').split('\n').filter(Boolean)) {
    let j; try { j = JSON.parse(line); } catch { continue; }
    if (!j.phrase && j.key) j.phrase = j.key;
    if (!j.phrase || !j.url) continue;
    if (manifest.clips[j.phrase] && fs.existsSync(path.join(OUT, manifest.clips[j.phrase].file))) continue;
    const wav = path.join(TMP, clipFileFor(j.phrase).replace(/\.mp3$/, '.wav'));
    if (!fs.existsSync(wav) || fs.statSync(wav).size < 2000) {
      const r = sh('curl', ['-sS', '-m', '60', '-o', wav, j.url]);
      if (r.status !== 0 || !fs.existsSync(wav) || fs.statSync(wav).size < 2000) { console.error(`download failed: "${j.phrase}"`); failed++; continue; }
    }
    if (convert(wav, j.phrase)) added++; else failed++;
  }
}
const wavDir = opt('wav-dir', null);
if (wavDir) {
  // The console's clips are named by their file name (clipFileFor, without
  // .mp3); match them to the inventory's phrases.
  const invJson = JSON.parse(fs.readFileSync(opt('inventory', '/tmp/claude-0/bank/all.json'), 'utf8'));
  const inv = (Array.isArray(invJson) ? invJson : invJson.phrases).map((r) => (typeof r === 'string' ? r : r.key)).filter(Boolean);
  const bySlug = new Map(inv.map((p) => [clipFileFor(p).replace(/\.mp3$/, ''), p]));
  for (const f of fs.readdirSync(wavDir).filter((f) => f.endsWith('.wav'))) {
    const phrase = bySlug.get(f.replace(/\.wav$/, ''));
    if (!phrase || manifest.clips[phrase]) continue;
    if (convert(path.join(wavDir, f), phrase)) added++; else failed++;
  }
}
manifest.count = Object.keys(manifest.clips).length;
manifest.builtAt = new Date().toISOString();
fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 1));
const bytes = fs.readdirSync(OUT).filter((f) => f.endsWith('.mp3')).reduce((a, f) => a + fs.statSync(path.join(OUT, f)).size, 0);
console.log(`${VOICE}: ${manifest.count} clips (${added} added, ${failed} failed), ${(bytes / 1048576).toFixed(2)} MB`);
