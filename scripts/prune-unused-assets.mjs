/**
 * Unused-asset pruner. Finds image files under public/ that nothing in the
 * app references and (with --delete) removes them.
 *
 * Keep rules — a file survives if ANY of:
 *   1. Its exact path appears as a string literal in app/components/hooks.
 *   2. Its path starts with a dynamic template prefix used in code
 *      (e.g. `/static/series/stage-bg/stage-${n}.webp` keeps that folder).
 *   3. Its .png/.jpg/.webp sibling is kept (SafeImage serves .webp for a
 *      referenced .png and falls back the other way).
 *   4. It is on the explicit keep list (PWA manifest icons, shell files).
 *
 * Usage: node scripts/prune-unused-assets.mjs [--delete]
 */
import { existsSync, readdirSync, readFileSync, statSync, unlinkSync } from 'fs';
import { join, relative } from 'path';

const ROOT = process.cwd();
const PUBLIC_DIR = join(ROOT, 'public');
const DELETE = process.argv.includes('--delete');

const SCAN_DIRS = ['app', 'components', 'hooks'];
const CODE_EXT = new Set(['.js', '.jsx', '.ts', '.tsx']);
const IMG_EXT = 'png|webp|jpg|jpeg|svg|gif|avif|ico';
const LITERAL_RE = new RegExp(`['"\`](\\/[^'"\`]+?\\.(?:${IMG_EXT}))['"\`]`, 'gi');
// Backtick template paths: capture the static prefix before the first ${…}
const DYNAMIC_RE = /`(\/[^`$]*?)\$\{/g;

// Referenced outside scanned code (manifest.json, injected index.html tags).
const EXPLICIT_KEEP = new Set([
  '/static/brand/icon-192.png',
  '/static/brand/icon-512.png',
]);

function walk(dir, filter, files = []) {
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, filter, files);
    else if (filter(entry.name)) files.push(full);
  }
  return files;
}

// 1+2: collect literal refs and dynamic prefixes from code.
const literals = new Set();
const prefixes = [];
for (const d of SCAN_DIRS) {
  for (const file of walk(join(ROOT, d), (n) => CODE_EXT.has(n.slice(n.lastIndexOf('.'))))) {
    const content = readFileSync(file, 'utf8');
    let m;
    LITERAL_RE.lastIndex = 0;
    while ((m = LITERAL_RE.exec(content)) !== null) {
      if (!m[1].includes('${')) literals.add(m[1]);
    }
    DYNAMIC_RE.lastIndex = 0;
    while ((m = DYNAMIC_RE.exec(content)) !== null) {
      if (m[1].length > 1) prefixes.push(m[1]);
    }
  }
}

// All candidate files under public/ (images only — never touches sw.js,
// manifest.json, audio, or anything non-image).
const IMG_FILE_RE = new RegExp(`\\.(?:${IMG_EXT})$`, 'i');
const allFiles = walk(PUBLIC_DIR, (n) => IMG_FILE_RE.test(n));

const toPublicPath = (f) => '/' + relative(PUBLIC_DIR, f).replace(/\\/g, '/');
const keep = new Set();

for (const f of allFiles) {
  const p = toPublicPath(f);
  if (literals.has(p) || EXPLICIT_KEEP.has(p) || prefixes.some((x) => p.startsWith(x))) keep.add(p);
}
// 3: sibling closure — kept png keeps its webp and vice versa.
let grew = true;
while (grew) {
  grew = false;
  for (const f of allFiles) {
    const p = toPublicPath(f);
    if (keep.has(p)) continue;
    const stem = p.replace(/\.(png|jpe?g|webp)$/i, '');
    for (const ext of ['.png', '.jpg', '.jpeg', '.webp']) {
      if (keep.has(stem + ext)) { keep.add(p); grew = true; break; }
    }
  }
}

const junk = allFiles.filter((f) => !keep.has(toPublicPath(f)));
let bytes = 0;
for (const f of junk) bytes += statSync(f).size;

console.log(`[prune] ${literals.size} literal refs, ${new Set(prefixes).size} dynamic prefixes.`);
console.log(`[prune] ${allFiles.length} image files on disk — keeping ${keep.size}, junk: ${junk.length} (${(bytes / 1048576).toFixed(1)} MB)`);
for (const f of junk.sort((a, b) => statSync(b).size - statSync(a).size)) {
  console.log(`  ${(statSync(f).size / 1024).toFixed(0).padStart(6)} KB  ${toPublicPath(f)}`);
}
if (DELETE) {
  for (const f of junk) unlinkSync(f);
  console.log(`[prune] DELETED ${junk.length} files (${(bytes / 1048576).toFixed(1)} MB). Re-run optimize:images to refresh the WebP manifest.`);
} else {
  console.log('[prune] Dry run — pass --delete to remove these files.');
}
