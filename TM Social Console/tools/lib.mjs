// Shared paths and helpers for the console's tools. Everything resolves from
// the console folder, so commands work the same on Windows, macOS and Linux.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
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

// Runs Remotion's bundled FFmpeg, so no separate FFmpeg install is needed.
export function ffmpeg(args, { quiet = true } = {}) {
  const r = spawnSync('npx', ['remotion', 'ffmpeg', '-hide_banner', '-loglevel', quiet ? 'error' : 'info', '-y', ...args], {
    cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32',
  });
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${args.join(' ')}`);
}

export const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
