// npm run doctor — is every tool the console uses installed and working?
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { getWhisperExecutablePath } from '@remotion/install-whisper-cpp/dist/install-whisper-cpp.js';
import { BRAND, ROOT, WHISPER, ffprobe, readJson } from './lib.mjs';

const win = process.platform === 'win32';
const run = (cmd, args) => spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8' });
const firstLine = (r) => (r.stdout || r.stderr || '').split('\n').find(Boolean)?.trim() ?? '';

const checks = [
  ['Node 22+', () => {
    const major = Number(process.versions.node.split('.')[0]);
    return [major >= 22, `node ${process.versions.node}`, 'Install Node 22 LTS from nodejs.org'];
  }],
  ['Packages', () => [fs.existsSync(path.join(ROOT, 'node_modules', 'remotion')), 'remotion + hyperframes installed', 'npm install']],
  ['FFmpeg for editing', () => [!!ffprobe(['-version']), ffprobe(['-version']).split('\n')[0].slice(0, 40), 'npm install']],
  ['Remotion browser', () => {
    if (process.env.REMOTION_BROWSER_EXECUTABLE) return [fs.existsSync(process.env.REMOTION_BROWSER_EXECUTABLE), `using ${process.env.REMOTION_BROWSER_EXECUTABLE}`, 'fix REMOTION_BROWSER_EXECUTABLE'];
    const dir = path.join(ROOT, 'node_modules', '.remotion');
    return [fs.existsSync(dir), 'Chrome Headless Shell downloaded', 'npm run setup'];
  }],
  ['Whisper', () => {
    const exe = getWhisperExecutablePath(WHISPER.path, WHISPER.version);
    const model = path.join(WHISPER.path, `ggml-${WHISPER.model}.bin`);
    return [fs.existsSync(exe) && fs.existsSync(model), `whisper.cpp ${WHISPER.version}, model ${WHISPER.model}`, 'npm run setup'];
  }],
  ['yt-dlp', () => {
    const r = run('yt-dlp', ['--version']);
    return [r.status === 0, r.status === 0 ? `yt-dlp ${firstLine(r)}` : '', win ? 'winget install yt-dlp' : 'brew install yt-dlp  (or pip install yt-dlp)'];
  }],
  ['FFmpeg on PATH (for HyperFrames)', () => {
    const r = run('ffmpeg', ['-version']);
    return [r.status === 0, firstLine(r).slice(0, 40), win ? 'winget install Gyan.FFmpeg' : 'brew install ffmpeg'];
  }],
  ['Brand synced', () => {
    const ok = fs.existsSync(BRAND) && fs.existsSync(path.join(ROOT, 'public', 'tm', 'logos'));
    return [ok, ok ? `content kit ${readJson(BRAND).syncedAt}` : '', 'npm run sync'];
  }],
  ['Fonts', () => [fs.existsSync(path.join(ROOT, 'public', 'fonts', 'Orbitron.ttf')), 'Orbitron + Rajdhani', 're-download from fonts.google.com']],
];

let bad = 0;
for (const [name, check] of checks) {
  let ok, detail, fix;
  try {
    [ok, detail, fix] = check();
  } catch (e) {
    [ok, detail, fix] = [false, e.message, 'see error'];
  }
  if (!ok) bad++;
  console.log(`${ok ? '✓' : '✗'} ${name.padEnd(34)} ${ok ? detail : `→ ${fix}`}`);
}
console.log(bad ? `\n${bad} thing(s) to fix` : '\nall set');
process.exit(bad ? 1 : 0);
