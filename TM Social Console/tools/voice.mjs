// npm run voice -- <post-id>
// Speaks a post's coach calls ("Round 1. Pendulum boxing.") in the app's voice
// and saves them as WAV files the render picks up.
//
// The app talks through the device's built-in speech (voiceCoach.js): female,
// British first (Google UK English Female, Sonia, Hazel), then any UK voice,
// then Zira and the other female voices, at normal speed. Here:
//   Windows  built-in voices in that order: Hazel, Susan, Sonia, Zira
//   macOS    `say` with a UK female voice
//   Linux    espeak-ng (a robotic placeholder, for previews only)
// Set TM_VOICE=Name to force a voice (comma-separated list, first match wins).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, ffmpeg, ffprobe, findPost, writeJson } from './lib.mjs';

const id = process.argv[2];
if (!id) {
  console.error('Usage: npm run voice -- <post-id>');
  process.exit(1);
}
const { file, post } = findPost(id);

// The lines each format speaks, worded the way the app's Fight Focus timer
// calls a round.
function callsFor(p) {
  if (p.format === 'FightFocusRounds') {
    return p.props.rounds.map((r, i) => ({
      text: `Round ${i + 1}. ${r.title}.`,
      save: (rel, sec) => Object.assign(r, { voice: rel, voiceSec: +sec.toFixed(2) }),
    }));
  }
  throw new Error(`${p.format} has no coach calls to speak`);
}

const dir = path.join(ROOT, 'raw-footage', 'voice', post.id);
fs.mkdirSync(dir, { recursive: true });
const jobs = callsFor(post).map((c, i) => ({ ...c, out: path.join(dir, `call-${i + 1}.wav`) }));
const prefer = (process.env.TM_VOICE || 'Hazel,Susan,Sonia,Zira').split(',').map((s) => s.trim()).filter(Boolean);

function speakWindows() {
  const list = path.join(os.tmpdir(), `tm-voice-${process.pid}.json`);
  fs.writeFileSync(list, JSON.stringify(jobs.map(({ text, out }) => ({ text, out }))));
  const q = (s) => `'${s.replace(/'/g, "''")}'`;
  const ps = [
    'Add-Type -AssemblyName System.Speech',
    '$s = New-Object System.Speech.Synthesis.SpeechSynthesizer',
    '$voices = $s.GetInstalledVoices() | Where-Object { $_.Enabled }',
    '$pick = $null',
    `foreach ($w in @(${prefer.map(q).join(',')})) {`,
    '  $pick = $voices | Where-Object { $_.VoiceInfo.Name -like "*$w*" } | Select-Object -First 1',
    '  if ($pick) { break }',
    '}',
    "if (-not $pick) { $pick = $voices | Where-Object { $_.VoiceInfo.Culture.Name -like 'en-*' } | Select-Object -First 1 }",
    'if ($pick) { $s.SelectVoice($pick.VoiceInfo.Name) }',
    '$s.Rate = 0',
    `foreach ($j in (Get-Content -Raw -Encoding UTF8 -LiteralPath ${q(list)} | ConvertFrom-Json)) {`,
    '  $s.SetOutputToWaveFile($j.out)',
    '  $s.Speak($j.text)',
    '}',
    '$s.SetOutputToNull()',
    '$s.Voice.Name',
  ].join('\n');
  // -EncodedCommand: no shell quoting, so paths with spaces are safe.
  const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(ps, 'utf16le').toString('base64')], { encoding: 'utf8' });
  fs.rmSync(list, { force: true });
  if (r.status !== 0) throw new Error(`Windows speech failed: ${r.stderr || r.stdout}`);
  return r.stdout.trim().split(/\r?\n/).pop();
}

function speakMac() {
  const list = spawnSync('say', ['-v', '?'], { encoding: 'utf8' }).stdout || '';
  const installed = list.split('\n').map((l) => ({ name: l.split(/\s{2,}/)[0].trim(), lang: (l.match(/\s(\w\w_\w\w)\s/) || [])[1] }));
  const voice =
    prefer.map((p) => installed.find((v) => v.name.includes(p))).find(Boolean) ??
    ['Kate', 'Serena', 'Stephanie'].map((n) => installed.find((v) => v.name === n)).find(Boolean) ??
    installed.find((v) => v.lang === 'en_GB');
  for (const j of jobs) {
    const aiff = j.out.replace(/\.wav$/, '.aiff');
    const args = voice ? ['-v', voice.name, '-o', aiff, j.text] : ['-o', aiff, j.text];
    if (spawnSync('say', args).status !== 0) throw new Error(`say failed for "${j.text}"`);
    ffmpeg(['-i', aiff, j.out]);
    fs.rmSync(aiff);
  }
  return voice?.name ?? 'system default';
}

function speakEspeak() {
  for (const j of jobs) {
    const r = spawnSync('espeak-ng', ['-v', 'en-gb+f3', '-s', '160', '-w', j.out, j.text]);
    if (r.error) throw new Error('No speech engine here (espeak-ng missing). Run this on the Windows laptop.');
  }
  return 'espeak-ng en-gb (placeholder, not the app voice)';
}

const used = process.platform === 'win32' ? speakWindows() : process.platform === 'darwin' ? speakMac() : speakEspeak();
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');
for (const j of jobs) {
  if (!fs.existsSync(j.out)) throw new Error(`No audio written for "${j.text}"`);
  const sec = Number(ffprobe(['-show_entries', 'format=duration', '-of', 'csv=p=0', j.out]));
  j.save(rel(j.out), sec);
  console.log(`${sec.toFixed(1)}s  ${j.text}`);
}
post.voiceUsed = used;
writeJson(file, post);
console.log(`voice: ${used} → ${rel(dir)}/   next: npm run render -- ${post.id}`);
