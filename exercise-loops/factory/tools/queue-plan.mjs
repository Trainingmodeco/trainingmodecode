#!/usr/bin/env node
// queue-plan.mjs: the work list of one queue run. What the owner asked for on the board, in order, with everything prep.mjs needs.
//
// Usage:
//   node queue-plan.mjs <workDir> <dbExportDir> [--raw <rawRoot>] [--spent <credits already spent for this request>] [--stale-ok]
//
//   <workDir>      the scan's folder: segs.json, clips.json and scan.json (scan.mjs writes the raw folder's path there; --raw overrides it),
//                  and queue-runs.json (run-log.mjs keeps it: which request was run, what it spent, which jobs it submitted)
//   <dbExportDir>  the board's database as ArtifactData saves it with out_dir: <dir>/items/seg.<segId>.json and <dir>/items/control.queue.json,
//                  each { id, data, version, updatedAt }. Only "items" is read. EMPTY THE FOLDER BEFORE EVERY EXPORT (db-docs.mjs
//                  --clear-export): an export only writes the documents that exist now, so a file left from an earlier export would be
//                  read as current. The tool refuses a folder whose files were written more than 30 minutes apart (--stale-ok overrides).
//                    items/control.queue  data: { kind: "control", requestedAt, count, cap, ids }      cap = credits this request may spend
//                    items/seg.<segId>    data: { kind: "seg", segId, name, entryId, from, to, skip, queued, verdict, note, forLoop, hold, updatedAt }
//
// FIRST read "stop": when it is not null, nothing may be rendered and it says why (the request was already run to the end: ask the owner).
//
// For every id of control.queue.ids, in that order, one item:
//   { segId, name, entryId, source, start, end, span, spanNote, crop, scanCrop, cropNote, period, hold, redoNote, estCredits, view, refImage,
//     kind, warn, prep: [arguments for prep.mjs] }
//     name, entryId   the owner's if given, else the scan's guess
//     start, end      the owner's from / to win. They may be numbers or numbers typed as text; when only one is given the scan's other
//                     end is used; both are cut to the video. spanNote says so whenever what is used is not exactly what the owner typed.
//                     A span that is left with under half a second (to before from, from past the end) is not planned: see skipped.
//                     A hold with no from / to takes the still span the scan found (segs.hold) when there is one; when the stretch is
//                     shorter than the 3 s a hold needs, it takes the junk around it as well, up to the neighbouring exercises or the
//                     ends of the video (a hold that sways is scanned as a short "exercise": prep.mjs --hold then finds its steadiest 3 s).
//     crop            [w,h,x,y] passed to prep.mjs as --crop: the scan's box for an exercise stretch; null for junk, and null (with
//                     cropNote) when the scan itself warns "The crop may cut off part of the body" or when its box spans over 90 % of the
//                     picture's width: prep.mjs then finds its own box from what moves (the whole picture when the camera moves).
//                     scanCrop is the scan's box either way.
//     period          seconds a rep, null for junk and for a hold
//     hold            true when the owner marked the stretch as a HOLD exercise: prep.mjs --hold, cut.mjs --hold
//     redoNote        the owner's note when the verdict on the loop that is there now is "redo" (what to do differently), else null
//     view, refImage  the camera view the scan guessed and the avatar picture that goes with it: "BACK" for a back view, else "FRONT"
// Left out, each with its reason under "skipped":
//   an id that is not in segs.json; a stretch the owner marked skip; a stretch the owner approved or rejected (a verdict "approved" or
//   "rejected" never queues); a stretch that is no longer queued (the list in control.queue is what was sent, the owner's document is
//   what counts now: an id is planned only if its owner document still says queued: true, or carries a live redo); a redo that was asked
//   for an EARLIER loop (forLoop is not the loop the stretch has now: the redo was already made and nobody has judged the new loop);
//   a stretch whose video is gone; one with no name; one already generating; one that already has a loop (state review or done) with no
//   live redo; a bad span; a hold with under 3 s of footage; and, when a run of this same request is being resumed, every stretch that
//   run already handled (it is never rendered twice for one request).
//   A redo is LIVE when verdict is "redo" and forLoop is absent or equals the stretch's loop.
// The budget: every item is counted as estEach credits = the largest real cost any item has had so far (queue-runs.json), 6 before the
// first. Items are added while spent + estimate so far + estEach <= cap; the first one that would pass the cap and everything after it go
// under "overCap" (nothing is reordered to squeeze a later one in). spent = --spent, or what queue-runs.json says the unfinished run of
// this request has spent. The real check is made before every submission (run-log.mjs budget); this is only the plan.
// "stuck": every stretch of segs.json left in state generating, with the job a run noted for it (or null): see RUNBOOK B1.
//
// Prints ONE line of JSON: { stop, requestedAt, cap, count, spent, resumed, estEach, estCredits, items, skipped, overCap, stuck }.
// Exit 1 with a message when a file is missing, the queue request is missing or empty, or the export folder holds stale files.
import fs from 'node:fs'; import path from 'node:path';
import { args, fail, readRuns, exportSpread } from './_lib.mjs';
const USAGE = 'usage: node queue-plan.mjs <workDir> <dbExportDir> [--raw <rawRoot>] [--spent <credits>] [--stale-ok]';
const a = args(process.argv.slice(2), ['stale-ok']); const [workDir, dbDir] = a._; if (!workDir || !dbDir) fail('queue-plan.mjs: a work folder and a database export folder are needed', USAGE);
const die = (m) => { process.stderr.write(`queue-plan.mjs: ${m}\n`); process.exit(1); };
const readJson = (f, what) => { if (!fs.existsSync(f)) die(`${what} is missing: ${f}`); try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { die(`${what} cannot be read (${e.message}): ${f}`); } return null; };
// The stretches: the board's own "segs" (exported into <dbDir>/segs/) win over the work folder's segs.json, field by field, so a loop,
// a cost or a state the board has is never forgotten because the local notes lag (a stretch made in another session is not made again).
// A stretch the owner added on the board (items/add.<id>) and Claude has not written yet is planned from that document.
// Footage on the owner's PC (RUNBOOK section 0): a source clip exported by the batch session (<dbDir>/srcs/<id>.json: { asset, from, to })
// is the source; prep runs on the downloaded file, with times taken back by "from". Without it, the raw file under --raw is used.
const unwrapJ = (j) => (j && typeof j === 'object' && j.data && typeof j.data === 'object' ? j.data : j);
const readDir = (d, pre) => (fs.existsSync(d) ? fs.readdirSync(d).filter((f) => f.endsWith('.json') && (!pre || f.startsWith(pre))).map((f) => { try { return [f.slice(pre ? pre.length : 0, -5), unwrapJ(JSON.parse(fs.readFileSync(path.join(d, f), 'utf8')))]; } catch { return null; } }).filter((x) => x && x[1] && typeof x[1] === 'object') : []);
const localSegs = fs.existsSync(path.join(workDir, 'segs.json')) ? readJson(path.join(workDir, 'segs.json'), 'segs.json') : [];
const clips = fs.existsSync(path.join(workDir, 'clips.json')) ? readJson(path.join(workDir, 'clips.json'), 'clips.json') : [];
const boardSegs = new Map(readDir(path.join(dbDir, 'segs')));
const segs = localSegs.map((x) => (boardSegs.has(x.id) ? Object.assign({}, x, boardSegs.get(x.id), { id: x.id }) : x));
for (const [id, b] of boardSegs) if (!segs.some((x) => x.id === id)) segs.push(Object.assign({}, b, { id }));
for (const [id, d] of readDir(path.join(dbDir, 'items'), 'add.')) if (d.kind === 'add' && !segs.some((x) => x.id === id) && Number.isFinite(d.start) && Number.isFinite(d.end) && d.end > d.start && d.clipId) segs.push({ id, clipId: String(d.clipId), folder: d.folder, file: d.file, clipDur: d.clipDur, start: d.start, end: d.end, kind: 'exercise', guess: null, warn: [], added: true });
const srcs = new Map(readDir(path.join(dbDir, 'srcs')));
let rawRoot = a.raw ? path.resolve(String(a.raw)) : null; if (!rawRoot) { const sf = path.join(workDir, 'scan.json'); if (fs.existsSync(sf)) { try { rawRoot = JSON.parse(fs.readFileSync(sf, 'utf8')).rawRoot || null; } catch { rawRoot = null; } } }
if (!rawRoot && !srcs.size) die('no footage: give --raw <rawRoot> (scan.json is not in the work folder), or export "srcs" from the board (the batch session sends the clips: RUNBOOK section 0)');
const itemsDir = path.join(dbDir, 'items'); const queueFile = path.join(itemsDir, 'control.queue.json');
if (!fs.existsSync(queueFile)) die(`there is no queue request in the export (${queueFile} is missing): the owner has not pressed the queue button on this board, or collection "items" was not exported into this folder. STOP: nothing is rendered without a request`);
const sp = exportSpread(itemsDir); if (sp.minutes > 30 && !a['stale-ok']) die(`the export folder ${itemsDir} holds files written ${Math.round(sp.minutes)} minutes apart (oldest ${sp.oldestFile}): some are left from an earlier export and would be read as current. Empty it (node db-docs.mjs <workDir> --clear-export <dbExportDir>) and export collection "items" again`);
const unwrap = (j) => (j && typeof j === 'object' && j.data && typeof j.data === 'object' ? j.data : j); // { id, data, version, updatedAt } -> data
const control = unwrap(readJson(queueFile, 'the queue request (items/control.queue.json)'));
if (!control || typeof control !== 'object' || Array.isArray(control)) die(`the queue request (${queueFile}) holds no request (it reads ${JSON.stringify(control)}). STOP: nothing is rendered without a request`);
const ids = Array.isArray(control.ids) ? control.ids.map(String) : []; const cap = Number.isFinite(Number(control.cap)) && control.cap !== null && control.cap !== '' ? Number(control.cap) : 0; const requestedAt = control.requestedAt ?? null;
// what the run log knows of this request
const runs = readRuns(workDir); const mine = requestedAt == null ? null : runs.find((r) => r.requestedAt === requestedAt) || null; const largest = Math.max(0, ...runs.map((r) => Number(r.largest) || 0)); const EST = largest > 0 ? largest : 6;
const spent = a.spent !== undefined && Number(a.spent) >= 0 ? Number(a.spent) : mine && !mine.finished ? Number(mine.spent) || 0 : 0;
const jobOf = (id) => { for (let i = runs.length - 1; i >= 0; i--) { const it = runs[i].items && runs[i].items[id]; if (it && it.job) return { job: it.job, seconds: it.seconds ?? null, hold: !!it.hold, requestedAt: runs[i].requestedAt }; } return null; };
const stuck = segs.filter((s) => s.state === 'generating').map((s) => { const j = jobOf(s.id); return { segId: s.id, name: (s.guess && s.guess.name) || '', job: j ? j.job : null, seconds: j ? j.seconds : null, hold: j ? j.hold : false, todo: j ? 'poll this job with jobs_wait (never submit it again) and finish the item from the download on; if it is not terminal after 120 polls: run-log.mjs item --outcome unknown, and result-doc.mjs --state failed --error "outcome unknown: job ..."' : 'no job is noted for it: nothing was submitted by a run that is known. Set it back with result-doc.mjs <segId> --state back (review when it has a loop, else ready; loop and cost stay); if the balance fell by more than the costs noted in queue-runs.json explain, tell the owner: a job may have been submitted and not noted' }; });
const out = (o) => { process.stdout.write(`${JSON.stringify(o)}\n`); process.exit(0); };
if (mine && mine.finished) out({ stop: `this request (requestedAt ${requestedAt}) was already run to the end on ${mine.finished} and spent ${mine.spent} credits. Nothing is rendered twice for one press of the button: tell the owner what that run made, and ask them to press the queue button again if they want more`, requestedAt, cap, count: control.count ?? ids.length, spent: Number(mine.spent) || 0, resumed: false, estEach: EST, estCredits: 0, items: [], skipped: [], overCap: [], stuck });

const ownerOf = (id) => { const f = path.join(itemsDir, `seg.${id}.json`); if (!fs.existsSync(f)) return null; try { const d = unwrap(JSON.parse(fs.readFileSync(f, 'utf8'))); return d && typeof d === 'object' ? d : null; } catch { return null; } };
const num = (v) => typeof v === 'number' && Number.isFinite(v); const r3 = (v) => Math.round(v * 1000) / 1000;
const numOf = (v) => (num(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null); // a number, also when typed as text
const given = (v) => v !== undefined && v !== null && !(typeof v === 'string' && v.trim() === '');
const items = [], skipped = [], overCap = []; let est = 0, full = false; const seen = new Set();
for (const id of ids) {
  if (seen.has(id)) { skipped.push({ segId: id, reason: 'listed twice in the queue' }); continue; } seen.add(id);
  const s = segs.find((x) => x.id === id); if (!s) { skipped.push({ segId: id, reason: 'not on the board (no segs document and no added stretch of this id) nor in segs.json' }); continue; }
  const own = ownerOf(id); const o = own || {}; const clip = clips.find((c) => c.id === s.clipId); const src = srcs.get(id) || null;
  const srcOk = !!(src && /^[A-Za-z0-9]{32}$/.test(src.asset || '') && Number.isFinite(src.from) && Number.isFinite(src.to) && src.to > src.from);
  const source = srcOk ? path.join(path.resolve(workDir), 'srcs', `${id}.mp4`) : rawRoot ? (clip ? path.join(rawRoot, clip.rel) : path.join(rawRoot, s.folder || '', s.file || '')) : null;
  const name = typeof o.name === 'string' && o.name.trim() ? o.name.trim() : (s.guess && s.guess.name) || ''; const entryId = o.entryId !== undefined && o.entryId !== null && o.entryId !== '' ? o.entryId : (s.guess && s.guess.entryId) ?? null;
  const verdict = typeof o.verdict === 'string' ? o.verdict : null; const forNow = o.forLoop == null || o.forLoop === (s.loop ?? null); // the verdict was given for the loop the stretch has now
  const redo = verdict === 'redo' && forNow; const note = typeof o.note === 'string' && o.note.trim() ? o.note.trim() : null;
  if (o.skip === true) { skipped.push({ segId: id, name, reason: 'the owner marked it skip' }); continue; }
  if (o.split === true) { skipped.push({ segId: id, name, reason: 'the owner marked it "This video shows several workouts": it is cut into one stretch per workout first (PC session job 3, or the cut editor on the board), then each part is ticked' }); continue; }
  if (verdict === 'approved' || verdict === 'rejected') { skipped.push({ segId: id, name, reason: `the owner ${verdict} it: a stretch with the verdict "${verdict}" is never made again` }); continue; }
  if (verdict === 'redo' && !forNow && s.loop) { skipped.push({ segId: id, name, reason: 'the redo was asked for an earlier loop; the new one has not been judged yet' }); continue; }
  if (!redo && o.queued !== true) { skipped.push({ segId: id, name, reason: own ? 'not queued any more: the owner took it out after the list was sent' : 'no owner document says it is queued (items/seg.<id> is not in the export)' }); continue; }
  if (mine && mine.items && mine.items[id] && (mine.items[id].job || mine.items[id].outcome)) { const it = mine.items[id]; skipped.push({ segId: id, name, reason: `already handled in this request by the run that is being resumed (${it.outcome ? `outcome: ${it.outcome}` : `job ${it.job} was submitted, outcome not noted: see stuck`}): never rendered twice for one request` }); continue; }
  if (!name) { skipped.push({ segId: id, reason: 'no name: neither the owner nor the scan named this stretch, so no motion prompt can be written' }); continue; }
  if (s.state === 'generating') { skipped.push({ segId: id, name, reason: 'a render of it is already running, or a run died on it (state generating): see stuck' }); continue; }
  if ((s.state === 'review' || s.state === 'done') && !redo) { skipped.push({ segId: id, name, reason: `it already has a loop (state ${s.state}); the owner sets the verdict "redo" to have it made again` }); continue; }
  if (!srcOk && (!source || !fs.existsSync(source))) { skipped.push({ segId: id, name, reason: source ? `the video is gone: ${source}` : 'no source clip on the board (srcs/<id>): the owner says "export the queue" in the batch session first (RUNBOOK section 0)' }); continue; }
  const hold = o.hold === true; const dur = s.clipDur || (clip && clip.duration) || Infinity; let start = s.start, end = s.end, span = 'scan', spanNote = null;
  const from = numOf(o.from), to = numOf(o.to); const still = Array.isArray(s.hold) && s.hold.length === 2 ? s.hold : null;
  if (from !== null || to !== null) {
    const f = from !== null ? from : hold && still ? still[0] : s.start, t = to !== null ? to : hold && still ? still[1] : s.end; const cf = Math.max(0, Math.min(dur, f)), ct = Math.max(0, Math.min(dur, t)); const notes = [];
    if (from === null) notes.push(`only "to" was given: the scan's start ${r3(f)} s is used`); if (to === null) notes.push(`only "from" was given: the scan's end ${r3(t)} s is used`);
    if ((from !== null && !num(o.from)) || (to !== null && !num(o.to))) notes.push('typed as text, read as numbers'); if (cf !== f || ct !== t) notes.push(`cut to the video (0-${r3(dur)} s): asked ${r3(f)}-${r3(t)} s`);
    if (!(ct - cf >= 0.5)) { skipped.push({ segId: id, name, reason: `the owner's from / to (${JSON.stringify(o.from ?? null)} / ${JSON.stringify(o.to ?? null)}) leave ${ct > cf ? `${(ct - cf).toFixed(2)} s` : 'nothing'} of the ${r3(dur)} s video${t <= f ? ': "to" is not after "from"' : ''}: nothing is made, the owner corrects the cut` }); continue; }
    start = cf; end = ct; span = from !== null && to !== null ? 'owner' : 'owner and scan'; spanNote = notes.length ? notes.join('; ') : null;
  } else {
    if (given(o.from) || given(o.to)) spanNote = `the owner's from / to (${JSON.stringify(o.from ?? null)} / ${JSON.stringify(o.to ?? null)}) are not numbers and were not used: the scan's span is`;
    if (hold && still) { [start, end] = still; span = 'still span of the scan'; }
    else if (hold && end - start < 3) { // a hold that sways is scanned as a short exercise: take the junk around it, up to the neighbouring exercises or the ends of the video
      const others = segs.filter((x) => x.clipId === s.clipId && x.id !== s.id && x.kind === 'exercise'); const before = others.filter((x) => x.end <= s.start + 1e-6).map((x) => x.end), after = others.filter((x) => x.start >= s.end - 1e-6).map((x) => x.start);
      const ns = before.length ? Math.max(...before) : 0, ne = after.length ? Math.min(...after) : (Number.isFinite(dur) ? dur : s.end);
      if (ne - ns > end - start) { spanNote = `${spanNote ? `${spanNote}; ` : ''}the stretch is ${(end - start).toFixed(1)} s, under the 3 s a hold needs: the junk around it was taken in (${r3(ns)}-${r3(ne)} s)`; start = ns; end = ne; span = 'the stretch and the junk around it'; } }
  }
  if (hold && !still && from === null && to === null && end - start > 40) { skipped.push({ segId: id, name, reason: `marked as a hold, but the stretch is ${(end - start).toFixed(0)} s long and the scan found no still part in it: a hold is one still pose. If it shows several workouts, tick "This video shows several workouts" on the board; if it is a hold, set from / to around the held part` }); continue; }
  if (hold && end - start < 3) { skipped.push({ segId: id, name, reason: `a hold needs 3 s of footage, the span ${r3(start)}-${r3(end)} s has ${(end - start).toFixed(1)} s${span === 'scan' || span === 'the stretch and the junk around it' ? '' : ' (the owner widens from / to)'}` }); continue; }
  if (!(end - start >= 0.5)) { skipped.push({ segId: id, name, reason: `the span ${r3(start)}-${r3(end)} s is under half a second` }); continue; }
  const scanCrop = s.kind === 'exercise' && Array.isArray(s.crop) && s.crop.length === 4 && s.crop.every((v) => Number.isFinite(v)) ? s.crop : null; let crop = scanCrop, cropNote = null; const picW = clip && clip.width ? clip.width : null;
  if (crop && (s.warn || []).includes('The crop may cut off part of the body')) { crop = null; cropNote = 'the scan warns that its crop may cut off part of the body: no --crop is passed, prep.mjs finds its own box from what moves (the whole picture when the camera moves). Look at the check picture'; }
  else if (crop && picW && crop[0] > 0.9 * picW) { crop = null; cropNote = `the scan's crop spans ${Math.round((100 * scanCrop[0]) / picW)} % of the picture's width: no --crop is passed, prep.mjs finds its own (tighter) box from what moves`; }
  if (srcOk && crop) { crop = null; cropNote = 'the source clip from the batch session is scaled (at most 1280 px): the scan\'s box is in pixels of the original, so no --crop is passed and prep.mjs finds its own box. Look at the check picture'; }
  const period = !hold && s.kind === 'exercise' && num(s.period) ? s.period : null; const view = (s.guess && s.guess.view) || 'other';
  // A source clip covers only part of the video: the span must lie inside it, and prep reads its times from the clip's own start.
  const off = srcOk ? src.from : 0;
  if (srcOk && (start < src.from - 0.05 || end > src.to + 0.05)) { const cs = Math.max(start, src.from), ce = Math.min(end, src.to); if (!(ce - cs >= (hold ? 3 : 0.5))) { skipped.push({ segId: id, name, reason: `the source clip (${r3(src.from)}-${r3(src.to)} s) does not hold the span ${r3(start)}-${r3(end)} s: export the queue again after the cut changed` }); continue; } spanNote = `${spanNote ? `${spanNote}; ` : ''}cut to the source clip ${r3(src.from)}-${r3(src.to)} s`; start = cs; end = ce; }
  const item = { segId: id, name, entryId, source, src: srcOk ? { asset: src.asset, from: src.from, to: src.to, download: `Artifact read url=BOARD path=${src.asset} -> ${source}` } : null, added: !!s.added, start: r3(start), end: r3(end), span, spanNote, crop, scanCrop, cropNote, period, hold, redoNote: (redo || (verdict === 'redo' && !s.loop)) && note ? note : null, estCredits: EST, view, refImage: view === 'back' ? 'BACK' : 'FRONT', kind: s.kind, warn: s.warn || [],
    prep: [source, '--start', String(r3(start - off)), '--end', String(r3(end - off)), ...(crop ? ['--crop', crop.join(':')] : []), ...(hold ? ['--hold'] : period ? ['--period', String(period)] : []), '--out', path.join(path.resolve(workDir), 'prep', id)] };
  if (full || spent + est + EST > cap) { full = true; overCap.push({ segId: id, name, estCredits: EST }); continue; }
  est += EST; items.push(item);
}
out({ stop: null, requestedAt, cap, count: control.count ?? ids.length, spent, resumed: !!(mine && !mine.finished), estEach: EST, estCredits: est, items, skipped, overCap, stuck });
