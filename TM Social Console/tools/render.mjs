// npm run render -- <post-id>
// Renders a queued post to exports/<id>/video.mp4 + cover.jpg (1080x1920,
// H.264/AAC: one master that TikTok, Reels, Shorts and Facebook all accept),
// then marks the post `rendered` so it shows up for approval.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { bundle } from '@remotion/bundler';
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer';
import { EXPORTS, ROOT, findPost, readJson, writeJson } from './lib.mjs';
import { checkPost } from './check-copy.mjs';

const id = process.argv[2];
if (!id) {
  console.error('Usage: npm run render -- <post-id>   (ids: npm run queue)');
  process.exit(1);
}
const { file, post } = findPost(id);

const props = { ...post.props };

// Remotion only loads files under public/, so footage from raw-footage/ is
// copied into public/_work (git-ignored) and the props point there.
const work = path.join(ROOT, 'public', '_work');
function stage(rel, name) {
  const src = path.resolve(ROOT, rel);
  if (!fs.existsSync(src)) throw new Error(`Footage not found: ${src}`);
  fs.mkdirSync(work, { recursive: true });
  const dest = `${name}${path.extname(src).toLowerCase()}`;
  fs.copyFileSync(src, path.join(work, dest));
  return `_work/${dest}`;
}

if (Array.isArray(props.broll)) {
  const staged = new Map();
  props.broll = props.broll.map((b) => {
    if (!b || !b.src.startsWith('raw-footage/')) return b;
    if (!staged.has(b.src)) staged.set(b.src, stage(b.src, `${post.id}-broll-${staged.size}`));
    return { ...b, src: staged.get(b.src) };
  });
}

if (post.format === 'FootageShort') {
  const src = path.resolve(ROOT, props.video);
  props.video = stage(props.video, post.id);
  if (!props.durationSec) {
    const probe = spawnSync('npx', ['remotion', 'ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', src], {
      cwd: ROOT, encoding: 'utf8', shell: process.platform === 'win32',
    });
    props.durationSec = Math.max(0, Number(probe.stdout.trim()) - (props.trimStartSec ?? 0));
  }
  if (props.captionsFile) {
    props.captions = readJson(path.resolve(ROOT, props.captionsFile));
    delete props.captionsFile;
  }
  props.captions ??= [];
}

// Checked after captions load, so spoken words shown on screen count too.
const problems = checkPost(post, props);
if (problems.length) {
  console.error(`Not rendering ${id}; fix the copy first:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
  process.exit(1);
}

const outDir = path.join(EXPORTS, post.id);
fs.mkdirSync(outDir, { recursive: true });
const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE || null;
console.log(`bundling templates…`);
const serveUrl = await bundle({ entryPoint: path.join(ROOT, 'src', 'index.ts') });
const composition = await selectComposition({ serveUrl, id: post.format, inputProps: props, browserExecutable });

const video = path.join(outDir, 'video.mp4');
let last = -1;
await renderMedia({
  serveUrl,
  composition,
  inputProps: props,
  codec: 'h264',
  crf: 18,
  // Standard TV-range yuv420p/BT.709: what Instagram, TikTok, YouTube and phone
  // players expect (full-range yuvj420p can play back washed out or not at all).
  pixelFormat: 'yuv420p',
  colorSpace: 'bt709',
  audioCodec: 'aac',
  enforceAudioTrack: true,
  outputLocation: video,
  browserExecutable,
  onProgress: ({ progress }) => {
    const pct = Math.floor(progress * 10) * 10;
    if (pct !== last) process.stdout.write(`${(last = pct)}% `);
  },
});
console.log('');

// Cover: the moment the hook has fully landed (or the title card).
const coverFrame = Math.min(composition.durationInFrames - 1, post.coverFrame ?? 50);
const cover = path.join(outDir, 'cover.jpg');
await renderStill({ serveUrl, composition, inputProps: props, frame: coverFrame, output: cover, imageFormat: 'jpeg', jpegQuality: 90, browserExecutable });

const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');
post.exports = { video: rel(video), cover: rel(cover), seconds: +(composition.durationInFrames / composition.fps).toFixed(2) };
post.renderedAt = new Date().toISOString();
if (['idea', 'draft', 'rejected'].includes(post.status)) post.status = 'rendered';
// A re-render invalidates an earlier approval: the owner approves what ships.
if (post.status === 'approved') {
  post.status = 'rendered';
  post.approvedAt = null;
}
writeJson(file, post);
console.log(`rendered ${post.id}: ${post.exports.video} (${post.exports.seconds}s) + ${post.exports.cover}`);
console.log(`next: watch it, then  npm run approve -- ${post.id}`);
