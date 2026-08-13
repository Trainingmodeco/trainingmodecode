#!/usr/bin/env node
// PROMPT I — the image lock. Freezes the app's image set so it can only
// change deliberately.
//
// Two modes:
//   node scripts/lock-assets.mjs --write   walk public/ and (re)write
//                                          assets.lock.json — sorted relative
//                                          path + byte size + SHA-1 for every
//                                          image file.
//   node scripts/lock-assets.mjs           VERIFY: recompute and diff against
//                                          the lockfile. ANY difference —
//                                          missing, new, or changed bytes —
//                                          exits 1 naming the exact paths.
//
// Complementary to check-public-assets.mjs and both stay: that one answers
// "does every referenced image exist?"; this one answers "is the image set
// exactly what was signed off?" — catching silent replacements and stray
// deletions a reference scan cannot see.

import { createHash } from 'crypto';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { join, relative } from 'path';

const ROOT = process.cwd();
const PUBLIC_DIR = join(ROOT, 'public');
const LOCK_PATH = join(ROOT, 'assets.lock.json');
const IMG_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.svg', '.ico', '.gif', '.avif']);

function walk(dir, files = []) {
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (IMG_EXT.has(entry.name.slice(entry.name.lastIndexOf('.')).toLowerCase())) files.push(full);
  }
  return files;
}

function snapshot() {
  const out = {};
  for (const file of walk(PUBLIC_DIR).sort()) {
    const rel = relative(PUBLIC_DIR, file).split('\\').join('/');
    const buf = readFileSync(file);
    out[rel] = { size: buf.length, sha1: createHash('sha1').update(buf).digest('hex') };
  }
  return out;
}

const current = snapshot();
const count = Object.keys(current).length;

if (process.argv.includes('--write')) {
  writeFileSync(LOCK_PATH, JSON.stringify(current, null, 2) + '\n');
  console.log(`[lock-assets] Wrote assets.lock.json — ${count} image file(s) locked.`);
  process.exit(0);
}

if (!existsSync(LOCK_PATH)) {
  console.error('[lock-assets] assets.lock.json not found. Generate it with: node scripts/lock-assets.mjs --write');
  process.exit(1);
}

const locked = JSON.parse(readFileSync(LOCK_PATH, 'utf8'));
const problems = [];
for (const [p, meta] of Object.entries(locked)) {
  if (!current[p]) problems.push(`REMOVED  ${p}`);
  else if (current[p].sha1 !== meta.sha1 || current[p].size !== meta.size) problems.push(`CHANGED  ${p}`);
}
for (const p of Object.keys(current)) {
  if (!locked[p]) problems.push(`ADDED    ${p}`);
}

if (problems.length === 0) {
  console.log(`[lock-assets] OK: all ${count} image file(s) match assets.lock.json.`);
  process.exit(0);
}

console.error(`[lock-assets] IMAGE SET CHANGED — ${problems.length} difference(s):`);
for (const p of problems.sort()) console.error(`  ${p}`);
console.error('[lock-assets] Images are locked. If this change is intentional, run node scripts/lock-assets.mjs --write and commit the lockfile.');
process.exit(1);
