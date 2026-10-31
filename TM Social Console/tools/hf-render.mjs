// npm run hf:render -- [raw-footage/clip.mp4] [startSec] [focusX%] [rate]
// Renders the HyperFrames Rank Ladder to exports/rank-ladder/video.mp4 with
// the given clip as its background B-roll (muted, violet-toned). The clip is
// cut from startSec and cropped to vertical around focusX (0 = left edge,
// 100 = right; matters for landscape clips). rate plays it slower (0.5 =
// half-speed slow motion; the owner wants their striking dramatically slow:
// feed it a 60 fps clip, e.g. npm run track -- clip --fps 60, so every slowed
// frame is a real one). Without a clip it reuses the last one
// (hyperframes/assets/broll.mp4).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { EXPORTS, ROOT, ffmpeg, ffprobe } from './lib.mjs';

const HF = path.join(ROOT, 'hyperframes');
const broll = path.join(HF, 'assets', 'broll.mp4');
const [clip, start = '0', focus = '50', rateArg = '1'] = process.argv.slice(2);
if (clip) {
  const src = path.resolve(ROOT, clip);
  if (!fs.existsSync(src)) throw new Error(`Not found: ${src}`);
  const f = Math.min(100, Math.max(0, Number(focus))) / 100;
  const [w, h] = ffprobe(['-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', src]).split(',').map(Number);
  if (!w || !h) throw new Error(`Could not read the size of ${src}`);
  // Vertical 9:16 window, numbers only so no shell quoting is involved.
  const cw = Math.min(w, Math.round((h * 9) / 16 / 2) * 2);
  const x = Math.round((w - cw) * f);
  // 9.5s, 1080x1920, muted: what the composition plays. At rate < 1 the
  // source stretch is shorter and its timestamps are spread out.
  const rate = Math.min(1, Math.max(0.2, Number(rateArg) || 1));
  const take = (9.5 * rate + 0.2).toFixed(2);
  const vf = `crop=${cw}:${h}:${x}:0,scale=1080:1920${rate < 1 ? `,setpts=PTS/${rate}` : ''}`;
  ffmpeg(['-ss', start, '-t', take, '-i', src, '-t', '9.5', '-an', '-vf', vf, '-r', '30', '-g', '30', '-keyint_min', '30', '-c:v', 'libx264', '-crf', '20', '-pix_fmt', 'yuv420p', broll]);
}
if (!fs.existsSync(broll)) {
  console.error('Pick a background clip: npm run hf:render -- raw-footage/<clip>.mp4');
  process.exit(1);
}
const out = path.join(EXPORTS, 'rank-ladder', 'video.mp4');
fs.mkdirSync(path.dirname(out), { recursive: true });
// Run the HyperFrames CLI with node directly (no shell: paths may hold spaces).
const cli = path.join(ROOT, 'node_modules', 'hyperframes', 'bin', 'hyperframes.mjs');
const r = spawnSync(process.execPath, [cli, 'render', '-o', out, '--quiet'], { cwd: HF, stdio: 'inherit' });
process.exit(r.status ?? 1);
