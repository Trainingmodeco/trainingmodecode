// npm run reference -- <url> [more urls]
// Saves a reference reel/short (yt-dlp) into references/ to study pacing,
// hooks and editing. References are for study only: never repost them.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { REFERENCES } from './lib.mjs';

const urls = process.argv.slice(2);
if (!urls.length) {
  console.error('Usage: npm run reference -- <url> [url…]');
  process.exit(1);
}
const r = spawnSync(
  'yt-dlp',
  ['-f', 'bv*[height<=1920]+ba/b', '--merge-output-format', 'mp4', '--write-info-json', '--no-playlist', '-o', path.join(REFERENCES, '%(extractor)s-%(id)s.%(ext)s'), ...urls],
  { stdio: 'inherit', shell: process.platform === 'win32' },
);
if (r.error) {
  console.error('yt-dlp is not installed. Windows: winget install yt-dlp   Mac: brew install yt-dlp   Linux: pip install yt-dlp');
  process.exit(1);
}
process.exit(r.status ?? 1);
