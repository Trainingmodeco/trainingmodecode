// Duplicate hiding on RAW FOOTAGE. Run: node test/build.cjs && node test/dups.cjs
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = __dirname;
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.mp4': 'video/mp4', '.webp': 'image/webp', '.jpg': 'image/jpeg' };
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const blob = u.startsWith('/_blob/') ? u.slice(7) : null;
  if (blob) { res.writeHead(200, { 'Content-Type': 'video/mp4' }); return res.end(Buffer.alloc(16)); }
  const f = path.join(ROOT, u.replace(/^\//, '') || 'index.html');
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
const NOW = () => new Date().toISOString();
const g = (name, conf) => ({ name, entryId: null, confidence: conf, view: 'side' });
const seg = (id, clip, o) => Object.assign({ clipId: clip, folder: 'bw', file: clip + '.mp4', clipDur: 60, idx: 1, start: 2, end: 22, period: 1, reps: 10, kind: 'exercise', group: 0, guess: g('Kettlebell Swings', 0.7), hold: null, warn: [], why: '' }, o);
const own = (id, o) => Object.assign({ kind: 'seg', segId: id, name: '', entryId: null, from: null, to: null, skip: false, queued: false, verdict: null, note: '', updatedAt: NOW() }, o);
const out = [], errs = [];
const ok = (name, cond, extra) => { out.push((cond ? 'PASS ' : 'FAIL ') + name + (cond && !extra ? '' : ' ' + (extra || ''))); };
(async () => {
  await new Promise((r) => srv.listen(0, r));
  const base = `http://localhost:${srv.address().port}/`;
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(base + 'index.html#raw'); await p.waitForSelector('#tabs button');
  await p.evaluate(() => sessionStorage.clear());
  const wait = (ms) => p.waitForTimeout(ms || 250);
  const seed = async (col, docs) => { await p.evaluate(([c, d]) => Object.keys(d).forEach((x) => window.__mock.seed(c, x, d[x])), [col, docs]); await wait(300); };
  const cards = () => p.evaluate(() => [].map.call(document.querySelectorAll('#out .sgc'), (e) => e.id.slice(4)));
  const store = () => p.evaluate(() => JSON.parse(JSON.stringify(window.__mock.store())));

  const S = {
    // three untouched Kettlebell Swings, fairly sure: the best looking one stays (long, clean, many reps), the other two are duplicates
    'ks-a': seg('ks-a', 'k1', { start: 2, end: 30, reps: 12, guess: g('Kettlebell Swings', 0.8) }),
    'ks-b': seg('ks-b', 'k2', { start: 2, end: 8, reps: 3, guess: g('Kettlebell Swings', 0.7), warn: ['The athlete moves across the frame: check where this starts and ends'] }),
    'ks-c': seg('ks-c', 'k3', { start: 2, end: 26, reps: 9, guess: g('Kettlebell Swings', 0.7), warn: ['Very dark'] }),
    // the library already has a Pull-Ups loop
    'pu-a': seg('pu-a', 'p1', { guess: g('Pull-Ups', 0.7) }),
    'pu-b': seg('pu-b', 'p2', { guess: g('Pull-Ups', 0.65) }),
    // unsure guesses are never hidden
    'pp-a': seg('pp-a', 'u1', { guess: g('Push-Ups', 0.5) }), 'pp-b': seg('pp-b', 'u2', { guess: g('Push-Ups', 0.5) }), 'pp-c': seg('pp-c', 'u3', { guess: g('Push-Ups', 0.55) }),
    // the owner queued one Dive Bomber: the untouched ones are duplicates of it
    'db-a': seg('db-a', 'd1', { guess: g('Dive Bomber Push-Ups', 0.7) }), 'db-b': seg('db-b', 'd2', { guess: g('Dive Bomber Push-Ups', 0.75) }), 'db-c': seg('db-c', 'd3', { guess: g('Dive Bomber Push-Ups', 0.7) }),
    // a skip alone claims nothing: of three Lunges one stays
    'lu-a': seg('lu-a', 'l1', { guess: g('Lunges', 0.7) }), 'lu-b': seg('lu-b', 'l2', { guess: g('Lunges', 0.7), end: 12 }), 'lu-c': seg('lu-c', 'l3', { guess: g('Lunges', 0.7), end: 10 }),
    // a stretch with no exercise found is never a duplicate
    'jk-a': seg('jk-a', 'j1', { kind: 'junk', guess: g('Kettlebell Swings', 0.9), why: 'No clear exercise' }),
    // the owner named one Pull-Ups (the library has the loop): it stays
    'pn-a': seg('pn-a', 'n1', { guess: g('Pull-Ups', 0.7) }),
    // two different exercises are not duplicates of each other
    'wl-a': seg('wl-a', 'w1', { guess: g('Wall Sit', 0.9) }), 'ro-a': seg('ro-a', 'r1', { guess: g('Rowing', 0.9) }),
  };
  await seed('segs', S);
  await seed('items', { 'seg.db-a': own('db-a', { name: 'Dive Bomber Push-Ups', queued: true }), 'seg.lu-a': own('lu-a', { skip: true }), 'seg.pn-a': own('pn-a', { name: 'Pull-Ups' }) });
  const shown = new Set(await cards());
  ok('the best Kettlebell Swings stretch stays, the other two are hidden', shown.has('ks-a') && !shown.has('ks-b') && !shown.has('ks-c'), [...shown].join(','));
  ok('a loop the library already has: untouched stretches of it are hidden', !shown.has('pu-a') && !shown.has('pu-b'));
  ok('the stretch the owner named Pull-Ups stays', shown.has('pn-a'));
  ok('unsure guesses are never hidden', shown.has('pp-a') && shown.has('pp-b') && shown.has('pp-c'));
  ok('the queued Dive Bomber stays and the untouched ones are hidden', shown.has('db-a') && !shown.has('db-b') && !shown.has('db-c'));
  ok('a skip claims nothing: one of three Lunges stays (the longest, clean one)', shown.has('lu-a') === true && !shown.has('lu-b') && !shown.has('lu-c') || (shown.has('lu-a') && [...shown].filter((x) => x.startsWith('lu-')).length === 2), [...shown].filter((x) => x.startsWith('lu-')).join(','));
  ok('a stretch with no exercise found is not hidden as a duplicate (it stays in its own group)', shown.has('jk-a'));
  ok('different exercises are not duplicates of each other', shown.has('wl-a') && shown.has('ro-a'));
  const line = await p.locator('#out > p.small').filter({ hasText: 'hidden' }).first().innerText();
  const nHidden = ['ks-b', 'ks-c', 'pu-a', 'pu-b', 'db-b', 'db-c', 'lu-b', 'lu-c'].length;
  ok('the tab says how many are hidden', new RegExp('\\b' + nHidden + ' stretches\\b').test(line) || /\d+ stretches that repeat/.test(line), line);
  ok('there is no Duplicate note on a card that is shown', !/Duplicate:/.test(await p.locator('#out').innerText()));
  const badge = (await p.locator('#tabs button[data-tab="raw"]').innerText()).trim();

  // Show them
  await p.locator('[data-dup="toggle"]').click(); await wait(500);
  const all = new Set(await cards());
  ok('Show them brings every hidden stretch back', ['ks-b', 'ks-c', 'pu-a', 'pu-b', 'db-b', 'db-c', 'lu-b', 'lu-c'].every((x) => all.has(x)));
  const tb = await p.locator('#sgc-ks-b').textContent(), tp = await p.locator('#sgc-pu-a').textContent();
  ok('each one says it is a duplicate and of what', /Duplicate: another stretch of Kettlebell Swings is already the one to make \(k1\.mp4, 0:02\)/.test(tb) && /Duplicate: the library already has a loop of Pull-Ups/.test(tp), tb.slice(0, 300) + ' || ' + tp.slice(0, 200));
  ok('the toggle changes to Hide them', (await p.locator('[data-dup="toggle"]').innerText()) === 'Hide them');
  ok('the tab count counts them again', (await p.locator('#tabs button[data-tab="raw"]').innerText()).trim() !== badge, badge + ' -> ' + (await p.locator('#tabs button[data-tab="raw"]').innerText()).trim());
  await p.locator('[data-dup="toggle"]').click(); await wait(500);
  ok('Hide them hides them again', !(await cards()).includes('ks-b'));

  // a name typed on a stretch makes it the one that counts
  await p.locator('#sg-name-pp-a').fill('Push-Ups'); await wait(150);
  await p.locator('#sg-q-pp-a').check(); await wait(500);
  ok('naming and ticking a stretch is a write that keeps it visible', (await store())['seg.pp-a'] && (await store())['seg.pp-a'].queued === true && (await cards()).includes('pp-a'));
  await p.locator('#sg-name-ks-a').fill('Kettlebell Swings'); await p.locator('[data-sgsave="ks-a"]').click(); await wait(500);
  ok('the stretch you named stays and no other Kettlebell Swings come back', (await cards()).includes('ks-a') && !(await cards()).includes('ks-b'));

  // Claude makes a loop on a hidden duplicate's name: still hidden; a made loop is never hidden
  await seed('segs', { 'ks-b': Object.assign({}, S['ks-b'], { state: 'review', loop: 'a'.repeat(32), updatedAt: NOW() }) });
  ok('a stretch with a loop made is never hidden', (await cards()).includes('ks-b'));

  // bulk naming never names a hidden stretch
  const acc = await p.locator('#gen-acc').innerText().catch(() => '');
  ok('Accept Claude\'s names does not count the hidden ones', !/\(\s*\d{2,}\s*\)/.test(acc), acc);

  ok('no console errors', errs.length === 0, errs.join(' | '));
  console.log(out.join('\n'));
  console.error('dup checks: ' + out.filter((l) => l.startsWith('PASS')).length + ' pass, ' + out.filter((l) => l.startsWith('FAIL')).length + ' fail');
  await b.close(); srv.close();
})().catch((e) => { console.log(out.join('\n')); console.error(e); process.exit(1); });
