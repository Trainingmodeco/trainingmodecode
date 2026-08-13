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

// Dynamic template paths the literal scan cannot see. These families are
// built with string interpolation (stage-${'{'}n{'}'}.webp) in the arcade screens, so a
// deleted file would slip past the reference scan and surface as a broken
// card on someone's phone. Enumerate them explicitly — BEFORE computing
// `missing`, so the families are actually validated.
const DYNAMIC_FAMILIES = [
  { dir: 'static/series/stages', pattern: (n) => `stage-${n}.webp`, range: [1, 10], usedBy: 'ArcadeSeriesDetail stage cards' },
  { dir: 'static/series/stage-bg', pattern: (n) => `stage-${n}.webp`, range: [1, 10], usedBy: 'Arcade session/stage backgrounds' },
];
for (const fam of DYNAMIC_FAMILIES) {
  for (let n = fam.range[0]; n <= fam.range[1]; n++) {
    const rel = `/${fam.dir}/${fam.pattern(n)}`;
    if (!refs.has(rel)) refs.set(rel, [{ file: `(dynamic: ${fam.usedBy})`, line: 0 }]);
  }
}

const missing = [];
for (const [p, locs] of refs) {
  const onDisk = join(PUBLIC_DIR, p.replace(/^\//, ''));
  const ok = existsSync(onDisk) && statSync(onDisk).isFile();
  if (!ok) missing.push({ path: p, locs });
}

// Third gate (PROMPT I) — keep new code honest: app-served art must go
// through SafeImage (webp-first, PNG retry, styled fallback), never a raw
// <img src="/…">. The rare deliberate exception marks its line // img-ok.
const RAW_IMG_RE = /<img\b[^>]*\bsrc\s*=\s*["']\//g;
const rawImgs = [];
for (const d of SCAN_DIRS) {
  for (const file of walk(join(ROOT, d))) {
    const content = readFileSync(file, 'utf8');
    let m;
    RAW_IMG_RE.lastIndex = 0;
    while ((m = RAW_IMG_RE.exec(content)) !== null) {
      const line = lineOf(content, m.index);
      const lines = content.split('\n');
      // The escape marker may sit on the <img line or the line above it —
      // JSX can't carry a // comment inside an opening tag.
      const hereText = lines[line - 1] || '';
      const aboveText = lines[line - 2] || '';
      if (hereText.includes('img-ok') || aboveText.includes('img-ok')) continue;
      rawImgs.push({ file: relative(ROOT, file), line });
    }
  }
}

const totalRefs = refs.size;
console.log(`[check-public-assets] Scanned ${SCAN_DIRS.join(', ')} — found ${totalRefs} unique public image reference(s) (incl. dynamic families).`);

if (missing.length === 0 && rawImgs.length === 0) {
  console.log('[check-public-assets] OK: every referenced image exists under public/, no raw <img> tags.');
  process.exit(0);
}

if (missing.length) {
  console.error(`[check-public-assets] MISSING ${missing.length} reference(s):`);
  for (const { path: p, locs } of missing) {
    console.error(`  ✗ ${p}`);
    for (const loc of locs) console.error(`      at ${loc.file}:${loc.line}`);
  }
}
if (rawImgs.length) {
  console.error(`[check-public-assets] RAW <img> ${rawImgs.length} tag(s) bypass SafeImage (add // img-ok only for a deliberate exception):`);
  for (const r of rawImgs) console.error(`  ✗ ${r.file}:${r.line}`);
}
process.exit(1);
