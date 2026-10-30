// npm run check
// Copy rules for everything that goes out under the Training Mode name:
//  - app names only: no franchise, character or film names (list from the app)
//  - feature names that no longer exist in the app
//  - the app rewards the workout, never views, likes, follows or subscribes
// Queue posts must pass (render and approve refuse otherwise). The script
// library is only reported, since those are drafts.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BRAND, ROOT, loadPosts, readJson } from './lib.mjs';

const brand = readJson(BRAND);
// A few more the app's list doesn't spell out but the rule covers.
const EXTRA = ['One Punch', 'Ultra Ego Vegeta', 'Kamehameha', 'Hadouken', 'Shoryuken', 'Naruto', 'Luffy', 'Jiren', 'Rocky Balboa'];
const STALE = { 'Strike Focus': 'Fight Focus', 'Strength Focus': 'Fight Focus' };

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const banned = [...new Set([...brand.rules.neverSay, ...EXTRA])].map((term) => ({ term, re: new RegExp(`(^|[^\\p{L}])${escape(term)}(?![\\p{L}])`, 'iu') }));

export function checkText(text) {
  const out = [];
  for (const { term, re } of banned) if (re.test(text)) out.push(`naming: "${term}" (app names only)`);
  for (const [old, now] of Object.entries(STALE)) if (text.toLowerCase().includes(old.toLowerCase())) out.push(`stale: "${old}" is now "${now}"`);
  if (/\b(follow|like|subscribe|share|comment)\w*\b[^.!?\n]{0,30}\bxp\b|\bxp\b[^.!?\n]{0,30}\b(follow|like|subscribe|share)/i.test(text)) {
    out.push('xp: the app rewards the workout, never follows/likes/subscribes');
  }
  return out;
}

// Every string a viewer could see: on-screen props (Whisper captions included)
// plus every platform caption.
function strings(value, acc = []) {
  if (typeof value === 'string') acc.push(value);
  else if (Array.isArray(value)) value.forEach((v) => strings(v, acc));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => strings(v, acc));
  return acc;
}

export function checkPost(post, props = post.props) {
  const seen = new Set();
  const visible = [...strings(props ?? {}), ...strings(post.platforms ?? {}), post.title ?? ''];
  return visible.flatMap(checkText).filter((p) => !seen.has(p) && seen.add(p));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let failed = 0;
  for (const { post } of loadPosts()) {
    const problems = checkPost(post);
    if (problems.length) {
      failed++;
      console.log(`✗ queue/${post.id}\n${problems.map((p) => `    ${p}`).join('\n')}`);
    }
  }
  const lib = path.join(ROOT, 'brain', 'scripts');
  const notes = [];
  if (fs.existsSync(lib)) {
    for (const f of fs.readdirSync(lib).filter((f) => f.endsWith('.md'))) {
      const problems = [...new Set(checkText(fs.readFileSync(path.join(lib, f), 'utf8')))];
      if (problems.length) notes.push(`  brain/scripts/${f}: ${problems.join('; ')}`);
    }
  }
  if (notes.length) console.log(`library drafts to fix before use:\n${notes.join('\n')}`);
  console.log(failed ? `${failed} queued post(s) need fixes` : 'queue copy: all clear');
  process.exit(failed ? 1 : 0);
}
