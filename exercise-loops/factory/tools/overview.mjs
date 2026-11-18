#!/usr/bin/env node
// overview.mjs: one picture per scanned video, to CHECK the scan by eye before anything is named or paid for.
//
// Usage:
//   NODE_PATH=$(npm root -g) node overview.mjs <rawRoot> <workDir> [--only <text in the path>] [--truth <file>] [--rows 4]
//
// Reads <workDir>/clips.json and <workDir>/segs.json (written by scan.mjs) and writes, for every video,
//   <workDir>/overview/<clipId>.jpg          the whole picture
//   <workDir>/overview/<clipId>-p1.jpg ...   the same in pages of --rows exercise rows, when it has more (a tall picture is hard to read)
// What is in it:
//   - a timeline of the video: each exercise stretch in the colour of its group with its number, junk in grey; slivers of junk that
//     scan.mjs left out show as gaps. With --truth, a second bar above it shows what is really in the video.
//   - one row per stretch. Exercise: the strip the board will show (8 frames of the whole picture), and under it the same 8 moments
//     cut to the stretch's crop box, with one frame from half a second BEFORE the stretch and one from half a second AFTER it in a
//     red frame at the two ends: those two show what was cut away. Junk: its strip, smaller.
//     The label of every row carries what the scan wrote about the stretch: WHY (its one sentence), WARN (every warning, in red), HOLD
//     (a still stretch of 4 s or more that may be a plank or a hang, in green) and JOINED (the stretch was joined from N pieces, with their
//     seconds: check that it is ONE exercise; if not, scan.mjs --force --only <file> --no-join gives the pieces back).
// --truth: a JSON array of { rel, segments: [{ start, end, kind, label }] } or { rel, name } (integ/sample-truth.json of the sample).
// Needs Playwright (it draws the page with Chromium); everything else is ffmpeg. Prints one line per picture and a last line of JSON.
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module'; import { execFileSync } from 'node:child_process';
import { args, fail, ff, probe, colour, upright, BG } from './_lib.mjs';

const USAGE = 'usage: NODE_PATH=$(npm root -g) node overview.mjs <rawRoot> <workDir> [--only <text in the path>] [--truth <file>] [--rows 4]';
const a = args(process.argv.slice(2)); const [rawRoot, workDirArg] = a._; if (!rawRoot || !workDirArg) fail('overview.mjs: a raw folder and a work folder are needed', USAGE);
const root = path.resolve(rawRoot), workDir = path.resolve(workDirArg); const outDir = path.join(workDir, 'overview'), tmpDir = path.join(outDir, 'tmp'); fs.mkdirSync(tmpDir, { recursive: true });
const clips = JSON.parse(fs.readFileSync(path.join(workDir, 'clips.json'), 'utf8')); const segs = JSON.parse(fs.readFileSync(path.join(workDir, 'segs.json'), 'utf8'));
const truth = a.truth ? JSON.parse(fs.readFileSync(a.truth, 'utf8')) : []; const rowsPer = Math.max(1, Number(a.rows) || 4);
let chromium; try { const req = createRequire(import.meta.url); let pw; try { pw = req('playwright'); } catch { pw = createRequire(path.join(execFileSync('npm', ['root', '-g']).toString().trim(), 'x.js'))('playwright'); } chromium = pw.chromium; } catch (e) { fail(`overview.mjs: Playwright is needed to draw the pictures (${String(e.message).split('\n')[0]})`, USAGE); }

const FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf'; const CELL = 150, PAGEW = 1560;
const COLORS = ['#7c3aed', '#0891b2', '#16a34a', '#d97706', '#db2777', '#2563eb', '#65a30d', '#dc2626', '#0d9488', '#9333ea', '#ca8a04', '#4f46e5'];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); const f1 = (v) => Number(v).toFixed(1), f2 = (v) => Number(v).toFixed(2);
const url = (f) => 'file://' + f.split('/').map(encodeURIComponent).join('/');

const browser = await chromium.launch(); const made = [];
for (const c of clips) {
  if (a.only && !c.rel.includes(String(a.only))) continue; const list = segs.filter((s) => s.clipId === c.id).sort((x, y) => x.idx - y.idx); if (!list.length) continue;
  const full = path.join(root, c.rel); const p = probe(full); const last = Math.max(0, c.duration - Math.max(0.12, 3 / (c.fps || 30))); const tr = truth.find((t) => t.rel === c.rel) || null;
  // the crop rows
  for (const s of list.filter((d) => d.kind === 'exercise')) {
    const [w, h, x, y] = s.crop; const span = s.end - s.start; const times = []; if (s.start - 0.5 >= 0) times.push({ t: s.start - 0.5, out: true });
    for (let i = 0; i < 8; i++) times.push({ t: Math.min(last, s.start + ((i + 0.5) * span) / 8), out: false }); if (s.end + 0.5 <= last) times.push({ t: s.end + 0.5, out: true });
    const pre = (k) => [...upright(p), `crop=${w}:${h}:${x}:${y}`, `scale=${CELL}:${CELL}:force_original_aspect_ratio=decrease:flags=area`, `pad=${CELL}:${CELL}:(ow-iw)/2:(oh-ih)/2:color=${BG}`, colour(p), ...(k.out ? ['drawbox=x=0:y=0:w=iw:h=ih:color=red:t=5'] : []), `drawtext=fontfile=${FONT}:text='${f1(k.t)}':x=5:y=${CELL - 20}:fontsize=14:fontcolor=${k.out ? 'white' : 'yellow'}:box=1:boxcolor=black@0.65`].join(',');
    s._crops = path.join(tmpDir, `${s.id}-crops.jpg`); s._n = times.length; s._lead = times[0].out;
    ff([...times.flatMap((k) => ['-ss', k.t.toFixed(3), '-i', full]), '-filter_complex', `${times.map((k, i) => `[${i}:v]${pre(k)}[s${i}]`).join(';')};${times.map((_, i) => `[s${i}]`).join('')}hstack=inputs=${times.length}`, '-frames:v', '1', '-q:v', '3', s._crops]);
  }
  // the page
  const TW = PAGEW - 40, X = (t) => (t / c.duration) * TW; const groups = [...new Set(list.filter((s) => s.kind === 'exercise').map((s) => s.group))]; const col = (g) => COLORS[groups.indexOf(g) % COLORS.length];
  const tick = c.duration > 60 ? 10 : c.duration > 20 ? 5 : 1; let ticks = ''; for (let t = 0; t <= c.duration + 1e-6; t += tick) ticks += `<line x1="${X(t)}" y1="0" x2="${X(t)}" y2="6" stroke="#666"/><text x="${X(t)}" y="18" font-size="11" fill="#444" text-anchor="middle">${t}</text>`;
  const bar = (items, y, hgt) => items.map((s) => { const w = Math.max(1, X(s.end) - X(s.start)); const lab = s.lab && w > 14 ? `<text x="${X(s.start) + w / 2}" y="${y + hgt / 2 + 4}" font-size="${s.small ? 10 : 12}" fill="${s.ink || '#fff'}" text-anchor="middle" font-weight="700">${esc(s.lab.length * (s.small ? 6 : 7.4) > w ? s.lab.slice(0, Math.max(1, Math.floor(w / (s.small ? 6 : 7.4)))) : s.lab)}</text>` : ''; return `<rect x="${X(s.start)}" y="${y}" width="${w}" height="${hgt}" fill="${s.fill}" stroke="#fff" stroke-width="1"/>${lab}`; }).join('');
  const predBar = bar(list.map((s) => (s.kind === 'exercise' ? { ...s, fill: col(s.group), lab: `#${s.idx}` } : { ...s, fill: '#c9c9c9', lab: '', ink: '#333' })), tr && tr.segments ? 34 : 4, 30);
  const truthBar = tr && tr.segments ? bar(tr.segments.map((s) => (s.kind === 'exercise' ? { ...s, fill: '#14532d', lab: s.label, small: true } : { ...s, fill: '#e7e5e4', lab: '', ink: '#333' })), 4, 24) : '';
  const tlH = (tr && tr.segments ? 68 : 38) + 22;
  const timeline = `<svg width="${TW}" height="${tlH}" style="display:block;background:#f5f5f4">${truthBar}${predBar}<g transform="translate(0,${tlH - 22})">${ticks}</g></svg>`;
  const head = `<div class="h"><b>${esc(c.rel)}</b> &nbsp; ${f1(c.duration)} s &nbsp; ${c.width}x${c.height} &nbsp; ${Math.round(c.fps)} fps &nbsp; id ${c.id}${tr ? ` &nbsp; <span class="t">really: ${esc(tr.name || (tr.segments || []).filter((s) => s.kind === 'exercise').map((s) => s.label).join(', ') || 'no exercise')}</span>` : ''}</div><div class="k">${tr && tr.segments ? 'top bar: what is really in the video &nbsp;·&nbsp; ' : ''}bar: what the scan found (colour = group, grey = junk, gap = junk sliver left out)</div>`;
  const row = (s) => { const ex = s.kind === 'exercise'; const len = s.end - s.start;
    const extra = `${s.why ? `<div class="s">why: ${esc(s.why)}</div>` : ''}${(s.warn || []).length ? `<div class="wn">WARN: ${esc(s.warn.join('; '))}</div>` : ''}${Array.isArray(s.hold) ? `<div class="hd">HOLD? still ${f1(s.hold[0])}–${f1(s.hold[1])} s: a plank or a hang if the body is held</div>` : ''}${Array.isArray(s.parts) && s.parts.length > 1 ? `<div class="jn">JOINED from ${s.parts.length} pieces (${s.parts.map((q) => `${f1(q[0])}–${f1(q[1])}`).join(', ')} s): is it ONE exercise?</div>` : ''}`;
    const lab = ex ? `<div class="n" style="background:${col(s.group)}">#${s.idx} EXERCISE</div><div>${f2(s.start)} – ${f2(s.end)} s (${f1(len)} s)</div><div>group ${s.group} &nbsp; score ${f2(s.score)}</div><div>${s.period ? `${f2(s.period)} s a rep × ${s.reps}` : 'no period'}</div><div class="s">crop ${s.crop[0]}x${s.crop[1]} at ${s.crop[2]},${s.crop[3]}</div>${s.guess && s.guess.name ? `<div class="g">${esc(s.guess.name)} (${s.guess.confidence}, ${esc(s.guess.view)})</div>` : ''}${extra}`
      : `<div class="n" style="background:#888">#${s.idx} junk</div><div>${f2(s.start)} – ${f2(s.end)} s (${f1(len)} s)</div>${extra}`;
    const strip = s.stripFile && fs.existsSync(s.stripFile) ? `<img class="${ex ? 'st' : 'sj'}" src="${url(s.stripFile)}">` : '<div class="miss">no strip</div>';
    const crops = ex ? `<img class="cr" src="${url(s._crops)}" style="width:${Math.min(PAGEW - 310, s._n * CELL)}px">` : '';
    return `<div class="r ${ex ? 'ex' : 'jk'}"><div class="l">${lab}</div><div class="p">${strip}${crops}</div></div>`; };
  const css = `body{margin:0;background:#fff;font:13px/1.35 'DejaVu Sans',sans-serif;color:#111;width:${PAGEW}px}.w{padding:14px 20px}.h{font-size:16px}.t{color:#14532d;font-weight:700}.k{font-size:11px;color:#555;margin:2px 0 6px}
  .r{display:flex;gap:10px;border-top:1px solid #ddd;padding:6px 0}.l{width:260px;flex:none}.wn{color:#b91c1c;font-weight:700;font-size:11px}.hd{color:#15803d;font-weight:700;font-size:11px}.jn{color:#7c3aed;font-weight:700;font-size:11px}.n{color:#fff;font-weight:700;padding:2px 6px;display:inline-block;border-radius:3px;margin-bottom:3px}.s{font-size:11px;color:#555}.g{color:#7c3aed;font-weight:700}
  .p{display:flex;flex-direction:column;gap:4px;align-items:flex-start}.st{max-width:${PAGEW - 310}px;max-height:120px}.sj{max-width:${PAGEW - 310}px;max-height:70px;opacity:.9}.cr{display:block}.miss{color:#b00}`;
  const shoot = async (rows, file) => { const page = await browser.newPage({ viewport: { width: PAGEW, height: 600 } }); const html = path.join(tmpDir, `${c.id}.html`);
    fs.writeFileSync(html, `<!doctype html><meta charset="utf-8"><style>${css}</style><div class="w">${head}${timeline}${rows.map(row).join('')}</div>`); await page.goto(url(html)); await page.waitForLoadState('load');
    await page.screenshot({ path: file, fullPage: true, type: 'jpeg', quality: 88 }); await page.close(); };
  const whole = path.join(outDir, `${c.id}.jpg`); await shoot(list, whole); const files = [whole];
  // pages: --rows exercise rows each, the junk between them stays with the row before it
  const exN = list.filter((s) => s.kind === 'exercise').length;
  if (exN > rowsPer) { const pages = []; let cur = [], n = 0; for (const s of list) { if (s.kind === 'exercise' && n === rowsPer) { pages.push(cur); cur = []; n = 0; } cur.push(s); if (s.kind === 'exercise') n++; } if (cur.length) pages.push(cur);
    for (let i = 0; i < pages.length; i++) { const f = path.join(outDir, `${c.id}-p${i + 1}.jpg`); await shoot(pages[i], f); files.push(f); } }
  for (const s of list) if (s._crops && fs.existsSync(s._crops)) fs.unlinkSync(s._crops);
  made.push({ clipId: c.id, rel: c.rel, files }); console.log(`${c.rel}  ->  ${files.map((f) => path.basename(f)).join(' ')}`);
}
await browser.close(); for (const f of fs.readdirSync(tmpDir)) fs.unlinkSync(path.join(tmpDir, f)); fs.rmdirSync(tmpDir);
process.stdout.write(`${JSON.stringify({ pictures: made.length, folder: outDir, made })}\n`);
