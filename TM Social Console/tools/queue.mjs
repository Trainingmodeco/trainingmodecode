// npm run queue                       list every post and its status
// npm run new -- <format> "<title>"   start a post (ScriptShort | FootageShort | BossIntro)
// npm run approve -- <id>             owner's OK: the rendered video may go live
// npm run queue -- reject <id> "why"  send it back
// npm run queue -- posted <id> <platform> <url>   record a live post
//
// Nothing gets published unless its status is `approved` (the owner approves
// every post). A re-render clears the approval.
import fs from 'node:fs';
import path from 'node:path';
import { PLATFORMS, QUEUE, ROOT, STATUSES, findPost, loadPosts, slug, writeJson } from './lib.mjs';
import { checkPost } from './check-copy.mjs';

const [cmd = 'list', ...args] = process.argv.slice(2);
const today = () => new Date().toISOString().slice(0, 10);
// Platforms set to null are skipped for this post.
const targets = (post) => Object.entries(post.platforms ?? {}).filter(([, v]) => v).map(([p]) => p);

const TEMPLATES = {
  ScriptShort: { kicker: 'Fight Mode', boss: 'Fight Focus', hook: '', beats: [], cta: 'Link in bio', art: null, artBeats: [0], goldBeats: [] },
  FootageShort: { video: 'raw-footage/<file>.mp4', trimStartSec: 0, durationSec: null, captionsFile: 'raw-footage/<file>.captions.json', kicker: 'Fight Mode', boss: '', title: '', cta: 'Link in bio' },
  BossIntro: { stage: 'Stage 1', title: '', boss: '', callout: 'FIGHT!', art: null },
};

function list() {
  const rows = loadPosts().map(({ post }) => [post.id, post.status, post.format, post.scheduledFor ?? '—', targets(post).join(',')]);
  if (!rows.length) return console.log('queue is empty — npm run new -- ScriptShort "My first post"');
  const head = ['ID', 'STATUS', 'FORMAT', 'SCHEDULED', 'PLATFORMS'];
  const w = head.map((h, i) => Math.max(h.length, ...rows.map((r) => String(r[i]).length)));
  for (const r of [head, ...rows]) console.log(r.map((c, i) => String(c).padEnd(w[i])).join('  '));
  const counts = STATUSES.map((s) => [s, rows.filter((r) => r[1] === s).length]).filter(([, n]) => n);
  console.log(`\n${counts.map(([s, n]) => `${n} ${s}`).join(' · ')}`);
}

function create(format, title) {
  if (!TEMPLATES[format] || !title) throw new Error(`Usage: npm run new -- <${Object.keys(TEMPLATES).join('|')}> "<title>"`);
  const id = `${today()}-${slug(title)}`;
  const file = path.join(QUEUE, `${id}.json`);
  if (fs.existsSync(file)) throw new Error(`${id} already exists`);
  writeJson(file, {
    id,
    title,
    status: 'draft',
    format,
    createdAt: today(),
    source: null,
    scheduledFor: null,
    props: TEMPLATES[format],
    platforms: Object.fromEntries(PLATFORMS.map((p) => [p, p === 'youtube' ? { title: '', description: '', tags: [] } : { caption: '' }])),
    approvedAt: null,
    posted: {},
  });
  console.log(`created queue/${id}.json — fill in props and captions, then: npm run render -- ${id}`);
}

function approve(id) {
  const { file, post } = findPost(id);
  if (!post.exports?.video || !fs.existsSync(path.join(ROOT, post.exports.video))) throw new Error(`${id} has no rendered video yet: npm run render -- ${id}`);
  const problems = checkPost(post);
  if (problems.length) throw new Error(`${id} breaks copy rules:\n  ${problems.join('\n  ')}`);
  post.status = 'approved';
  post.approvedAt = new Date().toISOString();
  writeJson(file, post);
  console.log(`approved ${id} — it can be posted to: ${targets(post).join(', ')}`);
}

function reject(id, why = '') {
  const { file, post } = findPost(id);
  post.status = 'rejected';
  post.approvedAt = null;
  post.notes = [...(post.notes ?? []), `${today()} rejected: ${why}`.trim()];
  writeJson(file, post);
  console.log(`rejected ${id}`);
}

function posted(id, platform, url) {
  const { file, post } = findPost(id);
  if (post.status !== 'approved' && post.status !== 'posted') throw new Error(`${id} is ${post.status}, not approved — it should not be live`);
  if (!PLATFORMS.includes(platform) || !url) throw new Error(`Usage: npm run queue -- posted <id> <${PLATFORMS.join('|')}> <url>`);
  post.posted = { ...post.posted, [platform]: { url, at: new Date().toISOString() } };
  if (targets(post).every((p) => post.posted[p])) post.status = 'posted';
  writeJson(file, post);
  console.log(`recorded ${platform} for ${id}`);
}

const run = { list, new: () => create(...args), approve: () => approve(args[0]), reject: () => reject(...args), posted: () => posted(...args) }[cmd];
if (!run) {
  console.error(`Unknown command "${cmd}". Try: list, new, approve, reject, posted`);
  process.exit(1);
}
try {
  run();
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
