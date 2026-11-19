// "This video shows several workouts": parking a stretch so it is never made until it is cut. Run: node test/build.cjs && node test/split.cjs
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
  const item = async (k) => (await p.evaluate((k) => JSON.parse(JSON.stringify(window.__mock.store()[k] || null)), k));
  await seed('segs', { 'a-01': seg('a', { guess: { name: 'Dips', entryId: null, confidence: 0.45, view: 'side' } }), 'b-01': seg('b', { guess: { name: 'Lunges', entryId: null, confidence: 0.5, view: 'side' } }), 'c-01': seg('c', { guess: { name: 'Burpees', entryId: null, confidence: 0.5, view: 'front' }, end: 30 }) });
  await seed('items', { 'seg.a-01': own('a-01', { name: 'Dips', queued: true, hold: true }), 'seg.b-01': own('b-01', { name: 'Lunges', queued: true }) });
  await p.waitForSelector('#sgc-a-01');
  const pill = (id) => p.locator('#sgc-' + id + ' .pill').first().innerText();
  ok('the card has a tick "This video shows several workouts", off to start with', (await p.locator('#sg-split-a-01').count()) === 1 && !(await p.locator('#sg-split-a-01').isChecked()));
  ok('the tick is on every stretch, not only held ones', (await p.locator('#sg-split-c-01').count()) === 1);
  ok('two stretches are ticked to be made', /Generate 2 loops/.test(await p.locator('#gen-go').innerText()), await p.locator('#gen-go').innerText());

  await p.locator('#sg-split-a-01').check(); await wait(500);
  const d = await item('items').then(async () => (await p.evaluate(() => window.__mock.store()['seg.a-01'])));
  ok('ticking it saves split: true and takes the stretch out of the queue', d && d.split === true && d.queued === false && d.name === 'Dips', JSON.stringify(d));
  ok('the hold the owner had put on it is left as it was (the owner unticks it)', d && d.hold === true);
  ok('the pill says Needs splitting', /needs splitting/i.test(await pill('a-01')), await pill('a-01'));
  ok('the card says it is parked and why', /Parked: it is not made as a loop until it is cut/.test(await p.locator('#sgc-a-01').textContent()));
  ok('Make this loop is off and says cut it first', (await p.locator('#sg-q-a-01').isDisabled()) && /cut it first/.test(await p.locator('#sgc-a-01').textContent()));
  ok('Generate now counts one', /Generate 1 loop\b/.test(await p.locator('#gen-go').innerText()), await p.locator('#gen-go').innerText());
  await p.locator('#sg-name-a-01').fill('Dips again'); await wait(200);
  ok('typing a name does not switch the tick back on', await p.locator('#sg-q-a-01').isDisabled());

  // the filter
  await p.locator('[data-rshow="split"]').click(); await wait(400);
  const shown = await p.evaluate(() => [].map.call(document.querySelectorAll('#out .sgc'), (e) => e.id.slice(4)));
  ok('the NEEDS SPLITTING filter shows only the parked stretch', shown.length === 1 && shown[0] === 'a-01', shown.join(','));
  await p.locator('[data-rshow="all"]').click(); await wait(300);

  // the tab count and queue request leave it out
  const badgeBefore = (await p.locator('#tabs button[data-tab="raw"]').innerText()).trim();
  await p.locator('#gen-go').click(); await wait(500);
  const cq = await p.evaluate(() => window.__mock.store()['control.queue']);
  ok('Generate sends only the stretch that is not parked', cq && JSON.stringify(cq.ids) === '["b-01"]', JSON.stringify(cq));

  // untick
  await p.locator('#sg-split-a-01').uncheck(); await wait(500);
  const d2 = await p.evaluate(() => window.__mock.store()['seg.a-01']);
  ok('unticking it saves split: false and the tick box can be used again', d2 && d2.split === false && !(await p.locator('#sg-q-a-01').isDisabled()));

  // a parked stretch is never hidden as a duplicate and does not stand in for the one to make
  await seed('segs', { 'd-01': seg('d', { guess: { name: 'Burpees', entryId: null, confidence: 0.7, view: 'front' } }), 'e-01': seg('e', { guess: { name: 'Burpees', entryId: null, confidence: 0.7, view: 'front' }, end: 40 }) });
  await seed('items', { 'seg.d-01': own('d-01', { split: true }) });
  const ids = await p.evaluate(() => [].map.call(document.querySelectorAll('#out .sgc'), (e) => e.id.slice(4)));
  ok('a parked stretch stays visible and the other Burpees stretch is not hidden because of it', ids.includes('d-01') && ids.includes('e-01'), ids.join(','));

  // read-only: nothing to tick
  ok('no console errors', errs.length === 0, errs.join(' | '));
  console.log(out.join('\n'));
  console.error('split checks: ' + out.filter((l) => l.startsWith('PASS')).length + ' pass, ' + out.filter((l) => l.startsWith('FAIL')).length + ' fail');
  await b.close(); srv.close();
})().catch((e) => { console.log(out.join('\n')); console.error(e); process.exit(1); });
