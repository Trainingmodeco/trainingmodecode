// The Shadowboxing clip list (public/static/practice/shadow/index.json): what the screen accepts, drops and groups.
// Run: npm run test:shadow
import process from 'node:process';
import fs from 'node:fs';
import { parseShadowClip, parseShadowIndex, loadShadowClips, shadowClipsFor, shadowGroups, shadowClock, SHADOW_DIR, SHADOW_INDEX } from '../components/training-mode/data/shadowboxing.js';

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => { if (ok) { pass++; console.log(`  ok   ${name}`); } else { fail++; console.log(`  FAIL ${name}${detail ? ': ' + detail : ''}`); } };

const good = { id: 'box-1', discipline: 'Boxing', group: 'Combinations', title: 'Jab, cross, slip', video: 'box-1.mp4', seconds: 24, level: 'Beginner', note: 'Chin down.' };

// ── one entry ──────────────────────────────────────────────────────────────
{
  const c = parseShadowClip(good);
  check('a full entry keeps its fields', c && c.id === 'box-1' && c.discipline === 'Boxing' && c.group === 'Combinations' && c.title === 'Jab, cross, slip' && c.seconds === 24 && c.level === 'Beginner' && c.note === 'Chin down.');
  check('its video and poster sit in the shadow folder, the poster as .webp', c.videoUrl === `${SHADOW_DIR}box-1.mp4` && c.posterUrl === `${SHADOW_DIR}box-1.webp`);
  const min = parseShadowClip({ id: 'a', discipline: 'MMA', title: 'T', video: 'a.mp4' });
  check('only id, discipline, title and video are required', min && min.group === 'Shadowboxing' && min.seconds === 0 && min.level === '' && min.note === '');
  check('a bad level is dropped, the clip stays', parseShadowClip({ ...good, level: 'Expert' }).level === '');
  check('seconds are rounded, and ignored when absurd', parseShadowClip({ ...good, seconds: 24.6 }).seconds === 25 && parseShadowClip({ ...good, seconds: -3 }).seconds === 0 && parseShadowClip({ ...good, seconds: 99999 }).seconds === 0 && parseShadowClip({ ...good, seconds: 'abc' }).seconds === 0);
  check('an unknown discipline is dropped', parseShadowClip({ ...good, discipline: 'Wrestling' }) === null);
  check('a missing id, title or video is dropped', parseShadowClip({ ...good, id: '' }) === null && parseShadowClip({ ...good, title: '  ' }) === null && parseShadowClip({ ...good, video: undefined }) === null);
  check('a video that is not a plain .mp4 name is dropped (no paths, no other types, no traversal)',
    ['../x.mp4', 'a/b.mp4', '/x.mp4', 'x.webm', 'x.mp4.exe', '.mp4', 'http://evil/x.mp4', 'x y.mp4', ''].every((v) => parseShadowClip({ ...good, video: v }) === null));
  check('not an object gives null', parseShadowClip(null) === null && parseShadowClip('x') === null && parseShadowClip(7) === null);
  check('long text is cut, not trusted', parseShadowClip({ ...good, title: 'x'.repeat(500) }).title.length === 80 && parseShadowClip({ ...good, note: 'n'.repeat(500) }).note.length === 140);
}

// ── the file ───────────────────────────────────────────────────────────────
{
  const list = parseShadowIndex({ clips: [good, { ...good, id: 'box-1', title: 'again' }, { ...good, id: 'x', discipline: 'Nope' }, { ...good, id: 'box-2', video: 'box-2.mp4' }, null, 5] });
  check('bad entries and repeated ids are dropped, order kept', list.length === 2 && list[0].id === 'box-1' && list[0].title === 'Jab, cross, slip' && list[1].id === 'box-2');
  check('anything but { clips: [...] } gives no clips', [null, undefined, {}, [], 'x', { clips: 'x' }, { clips: {} }, 3].every((j) => parseShadowIndex(j).length === 0));
  const ds = ['Boxing', 'Kickboxing', 'Muay Thai', 'MMA'];
  const all = parseShadowIndex({ clips: ds.map((d, i) => ({ id: `c${i}`, discipline: d, title: d, video: `c${i}.mp4` })) });
  check('every discipline of Practice is accepted', all.length === 4);
  check('shadowClipsFor filters by discipline', shadowClipsFor(all, 'Muay Thai').length === 1 && shadowClipsFor(all, 'Muay Thai')[0].id === 'c2');
  const grouped = parseShadowIndex({ clips: [
    { ...good, id: '1', group: 'Flow', video: '1.mp4' }, { ...good, id: '2', group: 'Defence', video: '2.mp4' }, { ...good, id: '3', group: 'Flow', video: '3.mp4' }, { ...good, id: '4', group: '', video: '4.mp4' },
  ] });
  const gs = shadowGroups(grouped);
  check('groups come in the order they first appear, clips in file order', gs.map((g) => g.group).join('|') === 'Flow|Defence|Shadowboxing' && gs[0].clips.map((c) => c.id).join() === '1,3');
  check('no clips gives no groups', shadowGroups([]).length === 0);
}

// ── reading it ─────────────────────────────────────────────────────────────
{
  const calls = [];
  const ok = async (url, opts) => { calls.push([url, opts]); return { ok: true, json: async () => ({ clips: [good] }) }; };
  const got = await loadShadowClips(ok);
  check('it reads the index file, asking the network again each time', got.length === 1 && calls[0][0] === SHADOW_INDEX && calls[0][1].cache === 'no-cache');
  check('a missing file (404) is no clips', (await loadShadowClips(async () => ({ ok: false, json: async () => ({}) }))).length === 0);
  check('the app shell sent back for a missing file (not JSON) is no clips', (await loadShadowClips(async () => ({ ok: true, json: async () => { throw new SyntaxError('Unexpected token <'); } }))).length === 0);
  check('being offline is no clips', (await loadShadowClips(async () => { throw new TypeError('Failed to fetch'); })).length === 0);
  check('no fetch at all is no clips', (await loadShadowClips(null)).length === 0);
}

// ── the clock ──────────────────────────────────────────────────────────────
check('seconds read as m:ss', shadowClock(24) === '0:24' && shadowClock(60) === '1:00' && shadowClock(75) === '1:15' && shadowClock(0) === '');

// ── a delivery already in the folder must pass the same rules ──────────────
{
  const dir = new URL('../public/static/practice/shadow/', import.meta.url);
  const file = new URL('index.json', dir);
  if (fs.existsSync(file)) {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    const list = parseShadowIndex(raw);
    check(`the delivered index.json: every entry is usable (${list.length} of ${(raw.clips || []).length})`, list.length === (raw.clips || []).length);
    const missing = list.filter((c) => !fs.existsSync(new URL(c.videoUrl.replace(SHADOW_DIR, ''), dir)) || !fs.existsSync(new URL(c.posterUrl.replace(SHADOW_DIR, ''), dir)));
    check('every clip has its video and its poster in the folder', missing.length === 0, missing.slice(0, 5).map((c) => c.id).join(', '));
  } else check('no delivery yet: the screen stays out of sight', true);
}

console.log(`\nshadowboxing: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
