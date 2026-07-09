import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

// Scan active app source files for absolute public image paths and report any
// that do not resolve to a file under public/. Read-only: never modifies files.

const ROOT = process.cwd();
const PUBLIC_DIR = join(ROOT, 'public');

// Directories that contain shipping app code.
const SCAN_DIRS = ['app', 'components', 'hooks'];
const CODE_EXT = new Set(['.js', '.jsx', '.ts', '.tsx']);
const IMG_EXT = 'png|webp|jpg|jpeg|svg|gif|avif|ico';

// Matches string literals (single, double, or backtick) that start with "/"
// and end in an image extension, e.g. "/assets/hub/fit.png".
const PATH_RE = new RegExp(`['"\`](\\/[^'"\`]+?\\.(?:${IMG_EXT}))['"\`]`, 'gi');

function walk(dir, files = []) {
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, files);
    } else if (CODE_EXT.has(entry.name.slice(entry.name.lastIndexOf('.')))) {
      files.push(full);
    }
  }
  return files;
}

function lineOf(content, index) {
  return content.slice(0, index).split('\n').length;
}

const refs = new Map(); // publicPath -> [{ file, line }]

for (const d of SCAN_DIRS) {
  for (const file of walk(join(ROOT, d))) {
    const content = readFileSync(file, 'utf8');
    let m;
    PATH_RE.lastIndex = 0;
    while ((m = PATH_RE.exec(content)) !== null) {
      // Skip template literals that interpolate ( ${...} ) — can't resolve statically.
      if (m[1].includes('${')) continue;
      const p = m[1];
      const loc = { file: relative(ROOT, file), line: lineOf(content, m.index) };
      if (!refs.has(p)) refs.set(p, []);
      refs.get(p).push(loc);
    }
  }
}

const missing = [];
for (const [p, locs] of refs) {
  const onDisk = join(PUBLIC_DIR, p.replace(/^\//, ''));
  const ok = existsSync(onDisk) && statSync(onDisk).isFile();
  if (!ok) missing.push({ path: p, locs });
}

const totalRefs = refs.size;
console.log(`[check-public-assets] Scanned ${SCAN_DIRS.join(', ')} — found ${totalRefs} unique public image reference(s).`);

if (missing.length === 0) {
  console.log('[check-public-assets] OK: every referenced image exists under public/.');
  process.exit(0);
}

console.error(`[check-public-assets] MISSING ${missing.length} reference(s):`);
for (const { path: p, locs } of missing) {
  console.error(`  ✗ ${p}`);
  for (const loc of locs) console.error(`      at ${loc.file}:${loc.line}`);
}
process.exit(1);
