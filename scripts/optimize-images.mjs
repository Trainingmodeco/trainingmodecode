/**
 * Image optimization — resizes large banners to display-appropriate sizes and
 * generates WebP versions for the priority asset folders. Uses sharp.
 *
 * For each readable .png/.jpg it:
 *   1. Writes a resized .webp sibling (primary asset served via SafeImage).
 *   2. Downscales the .png/.jpg fallback in place (only if it ends up smaller).
 *
 * Originals that are unreadable/corrupt are skipped (never given a WebP), so
 * SafeImage never requests a .webp that does not exist.
 *
 * Afterwards it scans the WHOLE public tree for .webp files and writes
 * data/webpManifest.js, so entries from previous runs are preserved and
 * SafeImage knows exactly which WebP files exist (no 404s).
 *
 * Usage: npm run optimize:images
 */

import { readdirSync, statSync, existsSync, renameSync, unlinkSync, writeFileSync, readFileSync } from 'fs';
import { join, extname, basename } from 'path';
import sharp from 'sharp';

const ROOT = process.cwd();
const PUBLIC_DIR = join(ROOT, 'public');

// Per-folder max box size (longest side). Downscale only — never upscale.
// The app column is 440px wide, so ~880px covers 2x displays for full-bleed
// art; smaller boxes for thumbnails/badges.
const DIR_TARGETS = {
  'Hub': 960,
  'banners': 800,
  'banners/arcade': 800,
  'discipline-cards': 540,
  'rewards': 400,
  'fit-mode': 600,
  'fit-mode/body-maps': 600,
  'training-arcade/stage-banners': 800,
  'training-arcade/results': 800,
  'training-arcade/rewards': 500,
  // Heavy /static art (saga posters, tier avatars, trophies, hub banners…)
  'static': 880,
  'static/series': 760,
  'static/series/posters': 760,
  'static/series/stages': 320,
  // Full-bleed backdrop behind an arcade session (one on screen at a time).
  'static/series/stage-bg': 880,
  'static/fight': 640,
  'static/ghost': 700,
  'static/tiers': 520,
  'static/trophies': 520,
  'static/hub': 880,
  'static/practice': 800,
  'static/brand': 760,
  'static/fitmode': 800,
  // Holds both small result overlays AND the two full-bleed arena backdrops,
  // so this has to be sized for the backdrops (a 640 box was squashing them).
  'static/arcade': 880,
  'static/stages': 320,
  // Folders added in the July 2026 sweep — previously had no WebP coverage.
  'social': 1200,
  'ui': 520,
  'mode-icons': 520,
  'brand': 900,
  'banners/icons': 420,
};

const QUALITY = 82;
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg']);
const IMAGE_EXTENSIONS_ARR = [...IMAGE_EXTENSIONS];

function fmt(bytes) {
  return (bytes / 1024).toFixed(0) + ' KB';
}

async function isReadable(p) {
  try {
    await sharp(p).metadata();
    return true;
  } catch {
    return false;
  }
}

let webpCount = 0;
let savedBytes = 0;

async function processDir(dir, box) {
  const fullDir = join(PUBLIC_DIR, dir);
  if (!existsSync(fullDir)) return;

  console.log(`\n[${dir}] (max ${box}px)`);

  for (const file of readdirSync(fullDir)) {
    const ext = extname(file).toLowerCase();
    if (!IMAGE_EXTENSIONS.has(ext)) continue;

    const input = join(fullDir, file);
    const stat = statSync(input);
    if (!stat.isFile() || stat.size === 0) continue;

    if (!(await isReadable(input))) {
      console.log(`  [SKIP] ${file} (unreadable/corrupt — left as-is, no WebP)`);
      continue;
    }

    const base = basename(file, ext);
    const resize = { width: box, height: box, fit: 'inside', withoutEnlargement: true };

    // 1. WebP sibling
    const webpOut = join(fullDir, base + '.webp');
    try {
      await sharp(input).resize(resize).webp({ quality: QUALITY }).toFile(webpOut);
      const webpSize = statSync(webpOut).size;
      const savings = Math.round((1 - webpSize / stat.size) * 100);
      savedBytes += Math.max(0, stat.size - webpSize);
      webpCount++;
      console.log(`  [WEBP] ${base}.webp  ${fmt(stat.size)} -> ${fmt(webpSize)} (${savings}% smaller)`);
    } catch (err) {
      console.error(`  [FAIL webp] ${file}: ${err.message}`);
      continue;
    }

    // 2. Downscaled PNG/JPG fallback (replace only if smaller)
    const tmp = join(fullDir, base + '.__opt__' + ext);
    try {
      const pipe = sharp(input).resize(resize);
      if (ext === '.png') await pipe.png({ compressionLevel: 9 }).toFile(tmp);
      else await pipe.jpeg({ quality: 88 }).toFile(tmp);
      if (statSync(tmp).size < stat.size) {
        renameSync(tmp, input);
        console.log(`  [PNG ] ${file}   ${fmt(stat.size)} -> ${fmt(statSync(input).size)} (fallback resized)`);
      } else {
        unlinkSync(tmp);
      }
    } catch (err) {
      if (existsSync(tmp)) unlinkSync(tmp);
      console.error(`  [FAIL png] ${file}: ${err.message}`);
    }
  }

  // 3. WebP files that were delivered WITHOUT a .png/.jpg source.
  // The pass above only ever reads png/jpg, so a webp-only asset was invisible
  // to this script and shipped at whatever size it arrived — that's how the
  // arcade ladder ended up serving 971px art into 62px nodes. Resize those in
  // place, and only keep the result when it's actually smaller.
  for (const file of readdirSync(fullDir)) {
    if (extname(file).toLowerCase() !== '.webp') continue;
    const base = basename(file, '.webp');
    if (IMAGE_EXTENSIONS_ARR.some(e => existsSync(join(fullDir, base + e)))) continue; // handled above

    const input = join(fullDir, file);
    const stat = statSync(input);
    if (!stat.isFile() || stat.size === 0) continue;

    try {
      // Read the bytes ONCE and hand sharp a Buffer. Opening the same path
      // twice (metadata, then encode) and writing back over it trips Windows
      // file locking — sharp/libvips keeps path-opened inputs mapped.
      const inputBuf = readFileSync(input);
      const meta = await sharp(inputBuf).metadata();
      if (Math.max(meta.width || 0, meta.height || 0) <= box) continue; // already small enough

      const out = await sharp(inputBuf)
        .resize({ width: box, height: box, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: QUALITY })
        .toBuffer();
      if (out.length < stat.size) {
        const before = stat.size;
        writeFileSync(input, out);
        savedBytes += before - out.length;
        console.log(`  [WEBP*] ${file}  ${meta.width}x${meta.height} ${fmt(before)} -> ${fmt(out.length)} (${Math.round((1 - out.length / before) * 100)}% smaller)`);
      }
    } catch (err) {
      console.error(`  [FAIL webp-only] ${file}: ${err.message}`);
    }
  }
}

// Collect every .webp under public/ (recursive) for the manifest.
function collectWebp(dir, prefix, out) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) collectWebp(full, `${prefix}/${entry}`, out);
    else if (extname(entry).toLowerCase() === '.webp') out.push(`${prefix}/${entry}`);
  }
}

const run = async () => {
  for (const [dir, box] of Object.entries(DIR_TARGETS)) {
    await processDir(dir, box);
  }

  const allWebp = [];
  collectWebp(PUBLIC_DIR, '', allWebp);
  allWebp.sort();

  const manifestPath = join(ROOT, 'components', 'training-mode', 'data', 'webpManifest.js');
  writeFileSync(
    manifestPath,
    '// AUTO-GENERATED by scripts/optimize-images.mjs — do not edit by hand.\n' +
    '// Lists public-root-relative paths of WebP files that actually exist on disk,\n' +
    '// so SafeImage only ever requests a .webp that is present (no 404s).\n' +
    'export const WEBP_FILES = [\n' +
    allWebp.map((p) => `  '${p}',`).join('\n') +
    '\n];\n'
  );

  console.log(`\n[Done] ${webpCount} WebP files written this run (${fmt(savedBytes)} saved vs originals).`);
  console.log(`[Done] Manifest lists ${allWebp.length} WebP files -> ${manifestPath}\n`);
};

run();
