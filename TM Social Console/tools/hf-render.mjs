// npm run hf:render -- [raw-footage/clip.mp4]
// Renders the HyperFrames Rank Ladder to exports/rank-ladder/video.mp4 with
// the given clip as its background B-roll (muted, violet-toned). Without a
// clip it reuses the last one (hyperframes/assets/broll.mp4).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { EXPORTS, ROOT } from './lib.mjs';

const HF = path.join(ROOT, 'hyperframes');
const broll = path.join(HF, 'assets', 'broll.mp4');
const clip = process.argv[2];
if (clip) {
  const src = path.resolve(ROOT, clip);
  if (!fs.existsSync(src)) throw new Error(`Not found: ${src}`);
  fs.copyFileSync(src, broll);
}
if (!fs.existsSync(broll)) {
  console.error('Pick a background clip: npm run hf:render -- raw-footage/<clip>.mp4');
  process.exit(1);
}
const out = path.join(EXPORTS, 'rank-ladder', 'video.mp4');
fs.mkdirSync(path.dirname(out), { recursive: true });
const r = spawnSync('npx', ['hyperframes', 'render', '-o', out, '--quiet'], { cwd: HF, stdio: 'inherit', shell: process.platform === 'win32' });
process.exit(r.status ?? 1);
