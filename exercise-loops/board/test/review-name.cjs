// REVIEW: a loop the owner never named (a stretch Claude queued and made) can still be approved, redone or rejected, and a loop Claude
// marked "done" reads as Approved. Before the fix the Approve button was disabled ("Give it a name in RAW FOOTAGE before you approve it")
// for every such loop, so none of them could be approved. Run: node test/build.cjs && node test/review-name.cjs
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
const bid = (s) => (s + '0'.repeat(32)).slice(0, 32);
const seg = (id, n, o) => Object.assign({ clipId: id.split('-')[0], folder: 'shoulders', file: id.split('-')[0] + '.mp4', clipDur: 40, idx: n, start: n * 10, end: n * 10 + 8, period: 1, reps: 6, kind: 'exercise', group: 0, guess: { name: null, entryId: null, confidence: 0.9, view: 'front' }, state: 'review', loop: bid('loopA'), poster: bid('posterA'), cost: 8, updatedAt: NOW() }, o);
const own = (id, o) => Object.assign({ kind: 'seg', segId: id, name: '', entryId: null, from: null, to: null, skip: false, queued: false, verdict: null, note: '', updatedAt: NOW() }, o);
const out = [], errs = [];
const ok = (name, cond, extra) => { out.push((cond ? 'PASS ' : 'FAIL ') + name + (cond && !extra ? '' : ' ' + (extra || ''))); };
(async () => {
  await new Promise((r) => srv.listen(0, r));
  const base = `http://localhost:${srv.address().port}/`;
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); const p = await ctx.newPage();
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(base + 'index.html#review'); await p.waitForSelector('#tabs button'); await p.evaluate(() => sessionStorage.clear());
  const wait = (ms) => p.waitForTimeout(ms || 250);
  const seed = async (col, docs) => { await p.evaluate(([c, d]) => Object.keys(d).forEach((x) => window.__mock.seed(c, x, d[x])), [col, docs]); await wait(300); };
  const item = (k) => p.evaluate((k) => JSON.parse(JSON.stringify(window.__mock.store()['seg.' + k] || null)), k);
  await seed('segs', {
    // made by a queue run, never named by the owner: only Claude's guess names them
    'a-01': seg('a-01', 1, { guess: { name: 'Bent-Over Rear Delt Raises', entryId: null, confidence: 0.9, view: 'side' } }),
    'a-02': seg('a-02', 2, { guess: { name: 'Jumping Lunges', entryId: null, confidence: 0.6, view: 'other' } }),
    'a-03': seg('a-03', 3, { guess: { name: 'Lateral Raises', entryId: null, confidence: 0.85, view: 'front' } }),
    // approved on the owner's word with the review skipped: Claude wrote state "done"
    'd-01': seg('d-01', 1, { state: 'done', guess: { name: 'Wide-Grip Lat Pulldowns', entryId: null, confidence: 0.9, view: 'back' } }),
    // no name and no guess: nothing to approve under
    'n-01': seg('n-01', 1, { guess: { name: null, entryId: null, confidence: 0.2, view: 'other' } }),
    // the owner's own name wins over Claude's guess
    'o-01': seg('o-01', 1, { guess: { name: 'Squats', entryId: null, confidence: 0.9, view: 'front' } }),
  });
  await seed('items', { 'seg.o-01': own('o-01', { name: 'Goblet Squats', queued: true }) });
  await p.waitForSelector('#sgc-a-01');
  const card = (id) => p.locator('#sgc-' + id);
  const btn = (id, v) => card(id).locator('button[data-rv="' + v + '"]');

  ok('an unnamed loop shows Claude\'s name, not "No name yet"', (await card('a-01').locator('h3.nm').innerText()) === 'Bent-Over Rear Delt Raises');
  ok('the card says it is Claude\'s name and that it can be renamed in RAW FOOTAGE', /Claude's name for it/.test(await card('a-01').innerText()) && !/Give it a name in RAW FOOTAGE/.test(await card('a-01').innerText()));
  ok('Approve is enabled on a loop the owner has not named', (await btn('a-01', 'approved').count()) === 1 && !(await btn('a-01', 'approved').isDisabled()));
  ok('a loop with no name and no guess still has Approve disabled and the hint', (await btn('n-01', 'approved').isDisabled()) && /Give it a name in RAW FOOTAGE/.test(await card('n-01').innerText()));
  ok('the owner\'s own name is shown as it was, with no "Claude\'s name" line', (await card('o-01').locator('h3.nm').innerText()) === 'Goblet Squats' && !/Claude's name for it/.test(await card('o-01').innerText()));
  ok('a loop Claude marked done reads Approved', /approved/i.test(await card('d-01').locator('.pill').first().innerText()), await card('d-01').locator('.pill').first().innerText());
  ok('a done loop keeps Redo and Reject and shows its name', (await btn('d-01', 'redo').count()) === 1 && (await btn('d-01', 'rejected').count()) === 1 && (await card('d-01').locator('h3.nm').innerText()) === 'Wide-Grip Lat Pulldowns');

  await btn('a-01', 'approved').click(); await wait(500);
  const d1 = await item('a-01');
  ok('Approve saves the verdict with Claude\'s name, queued, for that loop', d1 && d1.verdict === 'approved' && d1.name === 'Bent-Over Rear Delt Raises' && d1.queued === true && d1.forLoop === bid('loopA'), JSON.stringify(d1));
  ok('the card then reads Approved with Change my answer', /approved/i.test(await card('a-01').locator('.pill').first().innerText()) && (await btn('a-01', 'clear').count()) === 1);

  await btn('a-02', 'redo').click(); await wait(300);
  await p.locator('#rv-note-a-02').fill('keep the rear leg visible'); await p.locator('#sgc-a-02 button[data-rvsave]').click(); await wait(500);
  const d2 = await item('a-02');
  ok('Redo on an unnamed loop saves Claude\'s name, so the next Generate can make it', d2 && d2.verdict === 'redo' && d2.name === 'Jumping Lunges' && d2.queued === true && d2.note === 'keep the rear leg visible', JSON.stringify(d2));

  await btn('a-03', 'rejected').click(); await wait(500);
  const d3 = await item('a-03');
  ok('Reject saves the verdict and does not invent a name or queue it', d3 && d3.verdict === 'rejected' && d3.name === '' && d3.queued === false, JSON.stringify(d3));

  await btn('o-01', 'approved').click(); await wait(500);
  const d4 = await item('o-01');
  ok('Approve on a loop the owner named keeps the owner\'s name', d4 && d4.verdict === 'approved' && d4.name === 'Goblet Squats', JSON.stringify(d4));

  ok('no console errors', errs.length === 0, errs.join(' | '));
  console.log(out.join('\n'));
  console.error('review-name checks: ' + out.filter((l) => l.startsWith('PASS')).length + ' pass, ' + out.filter((l) => l.startsWith('FAIL')).length + ' fail');
  await b.close(); srv.close();
  if (out.some((l) => l.startsWith('FAIL'))) process.exit(1);
})().catch((e) => { console.log(out.join('\n')); console.error(e); process.exit(1); });
