// Shared paths and helpers for the console's tools. Everything resolves from
// the console folder, so commands work the same on Windows, macOS and Linux.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

export const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const REPO = path.join(ROOT, '..');
export const QUEUE = path.join(ROOT, 'queue');
export const EXPORTS = path.join(ROOT, 'exports');
export const RAW = path.join(ROOT, 'raw-footage');
export const REFERENCES = path.join(ROOT, 'references');
export const BRAND = path.join(ROOT, 'brand', 'brand.json');

// whisper.cpp lives inside the console (git-ignored). 1.5.5 is the release
// Remotion supports on Windows, Mac and Linux alike.
export const WHISPER = {
  path: path.join(ROOT, 'whisper.cpp'),
  version: process.env.TM_WHISPER_VERSION || '1.5.5',
  model: process.env.TM_WHISPER_MODEL || 'base.en',
};

// Post lifecycle. Nothing is published unless it is `approved` with an
// approvedAt stamp: the owner approves every post before it goes live.
export const STATUSES = ['idea', 'draft', 'rendered', 'approved', 'scheduled', 'posted', 'rejected'];
export const PLATFORMS = ['tiktok', 'instagram', 'facebook', 'youtube', 'reddit'];

export const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
export const writeJson = (f, v) => fs.writeFileSync(f, JSON.stringify(v, null, 2) + '\n');

export function loadPosts() {
  return fs.readdirSync(QUEUE)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => ({ file: path.join(QUEUE, f), post: readJson(path.join(QUEUE, f)) }));
}

export function findPost(id) {
  const hit = loadPosts().find(({ post }) => post.id === id);
  if (!hit) throw new Error(`No post with id "${id}" in queue/. Run: npm run queue`);
  return hit;
}

// FFmpeg and ffprobe: the system copy when one is installed (it has every
// filter), else the copy bundled with Remotion, a slim build without some
// filters (fps, select), so tools here stick to crop/scale and output options.
// Both run directly, never through a shell: a shell would split Windows paths
// with spaces ("TM APP 2026\TM Social Console").
const require = createRequire(import.meta.url);
const win = process.platform === 'win32';
function locate(name) {
  if (!process.env.TM_USE_BUNDLED_FFMPEG && spawnSync(name, ['-version'], { stdio: 'ignore' }).status === 0) {
    return { cmd: name, env: process.env };
  }
  const suffix = { linux: '-gnu', win32: '-msvc' }[process.platform] ?? '';
  const { dir } = require(`@remotion/compositor-${process.platform}-${process.arch}${suffix}`);
  return {
    cmd: path.join(dir, win ? `${name}.exe` : name),
    env: { ...process.env, LD_LIBRARY_PATH: dir, DYLD_LIBRARY_PATH: dir },
  };
}

export function ffmpeg(args, { quiet = true } = {}) {
  const { cmd, env } = locate('ffmpeg');
  const r = spawnSync(cmd, ['-hide_banner', '-loglevel', quiet ? 'error' : 'info', '-y', ...args], { cwd: ROOT, env, stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${args.join(' ')}`);
}

// Returns ffprobe's stdout, trimmed.
export function ffprobe(args) {
  const { cmd, env } = locate('ffprobe');
  const r = spawnSync(cmd, ['-v', 'error', ...args], { cwd: ROOT, env, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`ffprobe failed: ${r.stderr || args.join(' ')}`);
  return r.stdout.trim();
}

export const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
