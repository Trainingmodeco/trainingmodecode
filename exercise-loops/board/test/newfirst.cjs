// "New and to cut first": RAW FOOTAGE lists videos parked for cutting and stretches Claude has just added (newAt) above the folders, and REVIEW lists the newest loops first.
// Run: node test/build.cjs && node test/newfirst.cjs
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = __dirname;
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.mp4': 'video/mp4', '.webp': 'image/webp', '.jpg': 'image/jpeg' };
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  if (u.startsWith('/_blob/')) { res.writeHead(200, { 'Content-Type': 'video/mp4' }); return res.end(Buffer.alloc(16)); }
  let f = path.join(ROOT, u.replace(/^\//, '') || 'index.html');
  if (!fs.existsSync(f) && /^\/(loops|posters)\//.test(u)) f = path.join(ROOT, '..', '..', u.replace(/^\//, ''));
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
const NOW = () => new Date().toISOString();
const seg = (clip, o) => Object.assign({ clipId: clip, folder: 'kb', file: clip + '.mp4', clipDur: 120, idx: 1, start: 0, end: 100, period: null, reps: null, kind: 'exercise', group: 0, guess: { name: 'Dips', entryId: null, confidence: 0.45, view: 'side' }, hold: null, warn: [], why: '' }, o);
const own = (id, o) => Object.assign({ kind: 'seg', segId: id, name: '', entryId: null, from: null, to: null, skip: false, queued: false, verdict: null, note: '', updatedAt: NOW() }, o);
const out = [], errs = [];
const ok = (name, cond, extra) => { out.push((cond ? 'PASS ' : 'FAIL ') + name + (cond && !extra ? '' : ' ' + (extra || ''))); };
(async () => {
  await new Promise((r) => srv.listen(0, r));
  const base = `http://localhost:${srv.address().port}/`;
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); const p = await ctx.newPage();
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(base + 'index.html#raw'); await p.waitForSelector('#tabs button'); await p.evaluate(() => sessionStorage.clear());
  const wait = (ms) => p.waitForTimeout(ms || 250);
  const seed = async (col, docs) => { await p.evaluate(([c, d]) => Object.keys(d).forEach((x) => window.__mock.seed(c, x, d[x])), [col, docs]); await wait(300); };
  const ids = () => p.evaluate(() => [].map.call(document.querySelectorAll('#out .sgc'), (e) => e.id.slice(4)));
  const texts = (sel) => p.evaluate((s) => [].map.call(document.querySelectorAll(s), (e) => e.textContent.trim()), sel);

  // Old footage in folder kb (a-01 unnamed, b-01 named and ticked); an old stretch of folder aa that was "new" long ago; one the owner parked (p-01, folder mm);
  // two parts Claude has just cut (n-w01, n-w02, folder zz); and a duplicate of a-01 (a name the library has no loop of) that Claude has just added (m-w01).
  await seed('segs', {
    'a-01': seg('a', { guess: { name: 'Wobble Jumps', entryId: null, confidence: 0.7, view: 'side' }, reps: 8, start: 4, end: 30 }),
    'b-01': seg('b'),
    'o-w01': seg('o', { folder: 'aa', newAt: '2020-01-01T00:00:00.000Z', guess: { name: 'Squats', entryId: null, confidence: 0.4, view: 'side' } }),
    'p-01': seg('p', { folder: 'mm', guess: { name: 'Lunges', entryId: null, confidence: 0.4, view: 'side' } }),
    'n-w01': seg('n', { folder: 'zz', idx: 11, start: 5, end: 15, newAt: NOW(), guess: { name: 'Jumping Jacks', entryId: null, confidence: 0.5, view: 'front' } }),
    'n-w02': seg('n', { folder: 'zz', idx: 12, start: 20, end: 30, newAt: NOW(), guess: { name: 'High Knees', entryId: null, confidence: 0.5, view: 'front' } }),
    'm-w01': seg('m', { folder: 'zz', file: 'm.mp4', idx: 11, start: 1, end: 5, newAt: NOW(), guess: { name: 'Wobble Jumps', entryId: null, confidence: 0.7, view: 'side' } }),
  });
  await seed('items', { 'seg.p-01': own('p-01', { split: true }), 'seg.b-01': own('b-01', { name: 'Lunges', queued: true }) });
  await p.waitForSelector('#sgc-n-w01');
  const order = await ids();
  ok('every card is on the page once', order.length === new Set(order).size, order.join(','));
  ok('the parked video comes first, then what Claude has just cut, then the folders', order[0] === 'p-01' && order.slice(1, 4).sort().join() === 'm-w01,n-w01,n-w02', order.join(','));
  ok('the old stretches follow in their folders', order.slice(4).join() === 'o-w01,a-01,b-01', order.join(','));
  const h2 = await texts('#out h2.grp');
  ok('the first heading says NEW AND TO CUT with the count', /^NEW AND TO CUT · 4$/.test(h2[0] || ''), h2.join(' | '));
  const secs = await texts('#out section.vgrp > h3.vid');
  ok('the new group names each video with its folder', /p\.mp4.*mm/.test(secs[0] || '') && secs.some((t) => /n\.mp4.*zz/.test(t)), secs.join(' | '));
  const nOrder = await p.evaluate(() => [].map.call(document.querySelectorAll('section[data-clip="n"] .sgc'), (e) => e.id.slice(4)));
  ok('the parts of one video keep their order in the video', nOrder.join() === 'n-w01,n-w02', nOrder.join());
  ok('a part that was only "new" long ago is not in the new group', order.indexOf('o-w01') > 3);
  ok('the new part shows a New mark', /^new/i.test(await p.locator('#sgc-n-w01 .pill').first().innerText()), await p.locator('#sgc-n-w01 .pill').first().innerText());
  ok('the parked stretch says Needs splitting, not New', /needs splitting/i.test(await p.locator('#sgc-p-01 .pill').first().innerText()));
  ok('an old stretch has no New mark', !(await p.locator('#sgc-a-01 .pill').allInnerTexts()).some((t) => /^New$/.test(t.trim())));
  ok('a new part is not hidden as a duplicate of a better Dips stretch', order.includes('m-w01') && order.includes('a-01'), order.join(','));
  ok('the RAW FOOTAGE tab counts the new ones', /4 NEW/.test(await p.locator('#tabs button[data-tab="raw"]').innerText()), await p.locator('#tabs button[data-tab="raw"]').innerText());

  // answering a card keeps it where it is for the visit
  await p.locator('#sg-name-n-w01').fill('Jumping Jacks'); await p.locator('#sgc-n-w01 [data-sgsave]').click(); await wait(500);
  ok('a part that was named stays in the new group', (await ids())[1] === 'n-w01' || (await ids()).indexOf('n-w01') <= 3, (await ids()).join(','));
  await p.locator('#sg-q-n-w01').check(); await wait(600);
  const o2 = await ids();
  ok('a part that was ticked stays where it was until the tab is left', o2.indexOf('n-w01') <= 3, o2.join(','));
  ok('and the count of new ones drops only after a redraw of the tab', /NEW/.test(await p.locator('#tabs button[data-tab="raw"]').innerText()));
  await p.locator('#tabs button[data-tab="loops"]').click(); await wait(300);
  ok('on another tab, a line under the title offers the new ones', /new or waiting to be cut/.test(await p.locator('#state').innerText()), await p.locator('#state').innerText());
  await p.locator('#state [data-gotab="raw"]').click(); await wait(500);
  const o3 = await ids();
  ok('the line takes you to RAW FOOTAGE', /RAW FOOTAGE/.test(await p.locator('#tabs [aria-current="page"]').innerText()));
  ok('after the tab was left, the ticked part is back in its folder, below the new group', o3.indexOf('n-w01') > o3.indexOf('n-w02'), o3.join(','));
  const st = await p.evaluate(() => window.__mock.store()['seg.n-w01']);
  ok('the saved choice carries the name and the tick', st && st.name === 'Jumping Jacks' && st.queued === true, JSON.stringify(st));

  // skipping a new part also lets it go
  await p.locator('#sgc-n-w02 [data-sg="skip"]').click(); await wait(500);
  await p.locator('#tabs button[data-tab="loops"]').click(); await wait(200); await p.locator('#tabs button[data-tab="raw"]').click(); await wait(400);
  const o4 = await ids();
  ok('a skipped new part leaves the new group', !o4.slice(0, 3).includes('n-w02'), o4.join(','));

  // a filter still applies to the new group
  await p.locator('[data-rshow="split"]').click(); await wait(400);
  const o5 = await ids();
  ok('NEEDS SPLITTING shows only the parked stretch', o5.join() === 'p-01', o5.join(','));
  await p.locator('[data-rshow="all"]').click(); await wait(300);

  // REVIEW: the newest loop first
  const L = (c) => c.repeat(32);
  await seed('segs', {
    'r1-01': seg('r1', { state: 'review', loop: L('1'), poster: L('2'), updatedAt: '2026-11-18T10:00:00.000Z' }),
    'r2-01': seg('r2', { state: 'review', loop: L('3'), poster: L('4'), updatedAt: '2026-11-20T01:00:00.000Z' }),
    'r3-01': seg('r3', { state: 'review', loop: L('5'), poster: L('6'), updatedAt: '2026-11-19T12:00:00.000Z' }),
    'r4-01': seg('r4', { state: 'failed', error: 'no', updatedAt: '2026-11-17T12:00:00.000Z' }),
    'r5-01': seg('r5', { state: 'failed', error: 'no', updatedAt: '2026-11-20T02:00:00.000Z' }),
  });
  await seed('items', { 'seg.r1-01': own('r1-01', { name: 'A one', queued: true }), 'seg.r2-01': own('r2-01', { name: 'B two', queued: true }), 'seg.r3-01': own('r3-01', { name: 'C three', queued: true }), 'seg.r4-01': own('r4-01', { name: 'D four', queued: true }), 'seg.r5-01': own('r5-01', { name: 'E five', queued: true }) });
  await p.locator('#tabs button[data-tab="review"]').click(); await wait(500);
  const rv = await ids();
  ok('REVIEW lists the loop made last first among those waiting', rv.slice(0, 3).join() === 'r2-01,r3-01,r1-01', rv.join(','));
  ok('and the failed ones newest first', rv.slice(3, 5).join() === 'r5-01,r4-01', rv.join(','));

  ok('no console errors', errs.length === 0, errs.join(' | ').slice(0, 300));
  console.log(out.join('\n'));
  console.error('new-first checks: ' + out.filter((l) => l.startsWith('PASS')).length + ' pass, ' + out.filter((l) => l.startsWith('FAIL')).length + ' fail');
  await b.close(); srv.close();
})().catch((e) => { console.log(out.join('\n')); console.error(e); process.exit(1); });
