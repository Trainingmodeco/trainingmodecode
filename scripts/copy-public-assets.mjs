import { existsSync, mkdirSync, cpSync, readdirSync } from 'fs';
import { join } from 'path';

// Copy the FULL public/ folder (including public/assets) into dist so that
// every static image referenced by the app is available in the web build.
// expo export writes to dist first; this runs afterwards and merges public/
// on top of it without clobbering the generated bundle.

const publicDir = join(process.cwd(), 'public');
const distDir = join(process.cwd(), 'dist');

if (!existsSync(publicDir)) {
  console.error(`[copy-public-assets] Missing public folder: ${publicDir}`);
  process.exit(1);
}

if (!existsSync(distDir)) {
  console.warn(`[copy-public-assets] dist folder not found, creating it: ${distDir}`);
  mkdirSync(distDir, { recursive: true });
}

// Copy each top-level entry under public/ into dist/, recursively.
const entries = readdirSync(publicDir, { withFileTypes: true });
let copied = 0;

for (const entry of entries) {
  const src = join(publicDir, entry.name);
  const dest = join(distDir, entry.name);
  cpSync(src, dest, { recursive: true });
  console.log(`[copy-public-assets] Copied ${entry.name} -> dist/${entry.name}`);
  copied += 1;
}

console.log(`[copy-public-assets] Done. Copied ${copied} top-level entr${copied === 1 ? 'y' : 'ies'} from public/ into dist/ (including public/static).`);
