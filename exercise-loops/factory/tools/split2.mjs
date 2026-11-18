#!/usr/bin/env node
// split2.mjs <video> --out <json> [--debug <dir>] [--proxy <small copy>] [--no-join]: the splitter scan.mjs runs. Same output as split.mjs.
// --proxy is passed on to both splitters: a small copy of the video (ingest.mjs's) to read instead of a heavy original.
// --no-join switches case 2 below off: the pieces stay as split.mjs found them (scan.mjs --no-join passes it on, to undo a wrong join).
//
// It runs split.mjs (builder A, "periodicity first": the better one, 0.9905 on the test set) and asks split-alt.mjs (builder B, 0.9547) in two cases:
//
// 1. A found NO exercise in the whole video: B's answer is taken if B found any. Why: A looks for a movement that repeats in place, so an
//    exercise that TRAVELS across the picture (alligator push-ups) gives it nothing; B's last resort (the body returns to a rest pose twice in
//    a row) still sees it. A stretch that comes from B is marked: its score is capped at 0.3 and its "why" says so.
//
// 2. A cut ONE exercise into pieces (added 2026-11-18). A splits a bout where the posture changes for good while the rhythm goes on, which is
//    right for squats running into narrow squats and wrong for an exercise done on alternating sides: cross push-ups came out in three
//    pieces, cross-leg sit-ups in two (cut where the crossed leg is swapped), each piece with a group of its own. So wherever A has two
//    exercise stretches less than JOIN_GAP seconds apart, B is asked, and the pieces are joined into one stretch when B sees them as one:
//      a. ONE exercise stretch of B covers them (at least half of each piece), or
//      b. B has a stretch on each, in the same group, and marks the later one as the earlier one carried on (its "carried": a set taken up
//         again after a change of side or grip, with the same period and the athlete moving all through the pause).
//    B runs two DIFFERENT exercises together when they follow each other closely (reverse crunches into heel touches, spiderman into
//    cross-legged climber push-ups, maltese into cross push-ups: verify2/adv2), so two more things must hold before two pieces are joined:
//      c. their own periods differ by no more than PERIOD_TOL (15 %). The true cases differ by 0-5 %; maltese into cross push-ups by 113 %,
//         a half dip before squats by 19 %.
//      d. their posture templates do not differ clearly. The template of a piece is its mean picture (FPS 10, 96 px, each frame less its own
//         mean brightness) inside the union of the two crop boxes. Two pieces differ clearly when the two templates agree with a correlation
//         under POSE.COS AND lie more than POSE.SPREAD times further apart than the two halves of one piece do. Measured (fix2/posture.tsv):
//         cross push-ups 0.98-0.99 and 0.8-2.0 x, cross-leg sit-ups (leg and arm swapped) 0.93 and 2.8 x: joined; reverse crunches into heel
//         touches 0.80 and 5.4 x, spiderman into climber push-ups 0.37 and 7-11 x, maltese into cross push-ups 0.25 and 19 x: kept apart.
//         The margin is thin (0.93 against 0.80), which is why a joined stretch is never trusted blindly:
//    Every joined stretch carries the warning "Joined from N pieces: check it is one exercise" (first in warn) and scores 0.6 at most.
//      e. (added 2026-11-18, for a slow change of side) two pieces 1.2-3 s apart that A put in DIFFERENT groups are looked at too, when B has
//         them in ONE group (one stretch of B over both, or the later one "carried") and rules c and d hold: they stay two stretches
//         (a rest, or a swap of 2 s, lies between them) but get ONE group ("regrouped" in the output). B must say so: on adv6-alt-pause2 B itself
//         gives the two sides two groups, so that video is unchanged.
//    Squats into narrow squats stay apart: there B has two stretches and does not call the second a carrying-on.
//    The joined stretch: start of the first piece to the end of the last (the pauses between them included), the group of the first piece
//    (every other stretch of the pieces' groups gets that group too, and the groups are numbered again in order of appearance), the union
//    of the crop boxes, the best score of the pieces (0.6 at most), the period of the longest piece, or B's period when that is about twice
//    it and B's stretch is this run and no more (B then measured the full left-right cycle), reps = the pieces' reps added up at that period. "parts" lists the pieces; "why" says
//    what was joined. "sides alternate" is said only when A itself gave a later piece its other-side hint ("perhaps the other side of the
//    same exercise"); otherwise the stretch is only "joined".
//
// On every other video the result is A's, untouched. The output gains "by": "split", "split-alt" (case 1) or "split+joined" (case 2), and
// "keptApart": [{ at: [end, start], why }] for neighbours B saw as one that rules c or d kept apart, "joinChecks": [{ at, gap, how, periods,
// periodDiff, pose: { cos, apart, spread } | null, decision }] for EVERY pair the rules looked at (joined or not), and "regrouped": n (rule e).
// Each joined stretch has "parts": [[start, end], ...]; scan.mjs keeps it in segs.json.
// If split-alt.mjs is missing or fails, the result is simply A's.
import fs from 'node:fs'; import path from 'node:path'; import { spawnSync } from 'node:child_process';
const HERE = path.dirname(fs.realpathSync(new URL(import.meta.url).pathname)); const argvAll = process.argv.slice(2); const noJoin = argvAll.includes('--no-join'); const argv = argvAll.filter((v) => v !== '--no-join');
const oi = argv.indexOf('--out'); const outF = oi >= 0 ? argv[oi + 1] : null;
const video = argv.find((v, i) => !v.startsWith('--') && !['--out', '--debug', '--proxy'].includes(argv[i - 1])); const pi = argv.indexOf('--proxy'); const proxyArgs = pi >= 0 && argv[pi + 1] ? ['--proxy', argv[pi + 1]] : [];
if (!video || !outF) { console.error('usage: node split2.mjs <video> --out <json> [--debug <dir>] [--proxy <small copy of the video>] [--no-join]'); process.exit(2); }
const CAP = 0.3;          // a stretch only B found never scores above this
const JOIN_CAP = 0.6;     // a stretch joined from pieces never scores above this: the owner looks at it
const JOIN_GAP = 1.2;     // pieces of one exercise lie less than this many seconds apart (the swap of a crossed leg took 0.8 s; a rest between two sets takes 3 s and more)
const GROUP_GAP = 3.0;    // two pieces in different groups this close are looked at as well: when B calls them one set and the rules below hold, they get ONE group but stay two stretches (the pause is long: a rest or a slow change of side)
const PERIOD_TOL = 0.15;  // pieces of one exercise have the same period within this share
const POSE = { FPS: 10, LONG: 96, COS: 0.87, SPREAD: 3.8, FLOOR: 0.3 }; // rule d: see above
const first = spawnSync('node', [path.join(HERE, 'split.mjs'), ...argv], { stdio: ['ignore', 'inherit', 'inherit'], maxBuffer: 1 << 26 });
if (first.status !== 0) process.exit(first.status ?? 1);
const A = JSON.parse(fs.readFileSync(outF, 'utf8')); A.by = 'split';
const alt = path.join(HERE, 'split-alt.mjs'); const r3 = (v) => Math.round(v * 1000) / 1000;
const exA = A.segments.filter((s) => s.kind === 'exercise'); const gapOf = (i) => exA[i].start - exA[i - 1].end; const near = (i) => gapOf(i) < JOIN_GAP || (gapOf(i) < GROUP_GAP && exA[i].group !== exA[i - 1].group); const close = !noJoin && exA.some((s, i) => i > 0 && near(i));
const askB = () => { const tmp = `${outF}.alt.json`; const second = spawnSync('node', [alt, video, '--out', tmp, ...proxyArgs], { stdio: ['ignore', 'ignore', 'pipe'], maxBuffer: 1 << 26 }); let B = null;
  if (second.status === 0 && fs.existsSync(tmp)) { try { B = JSON.parse(fs.readFileSync(tmp, 'utf8')); if (!Array.isArray(B.segments)) B = null; } catch { B = null; } } if (fs.existsSync(tmp)) fs.unlinkSync(tmp); return B; };

/**
 * Rule d: how alike the posture templates of two neighbouring pieces are. Decodes the span of the two pieces once (the proxy when one was
 * given) and returns { cos, spread, apart } or null when the frames cannot be read:
 *   cos     correlation of the two mean pictures inside the union of the two crop boxes
 *   apart   their mean absolute difference there, in gray levels
 *   spread  apart / the larger of the two pieces' own spread (the mean pictures of the first and the last half of a piece, whole reps each)
 */
function posture(p, q) {
  const src = proxyArgs.length ? proxyArgs[1] : video; const k = POSE.LONG / Math.max(A.width, A.height); const W = Math.max(2, Math.round((A.width * k) / 2) * 2), H = Math.max(2, Math.round((A.height * k) / 2) * 2), N = W * H;
  const r = spawnSync('ffmpeg', ['-nostdin', '-loglevel', 'error', '-ss', String(Math.max(0, p.start)), '-t', String(q.end - p.start + 0.2), '-i', src, '-an', '-sn', '-vf', `fps=${POSE.FPS},scale=${W}:${H}:flags=area,format=gray`, '-f', 'rawvideo', '-'], { maxBuffer: 1 << 30 });
  if (r.status !== 0 || !r.stdout) return null; const raw = r.stdout; const n = Math.floor(raw.length / N); if (n < 8) return null;
  const F = new Float32Array(n * N); for (let t = 0; t < n; t++) { let s = 0; const o = t * N; for (let i = 0; i < N; i++) s += raw[o + i]; s /= N; for (let i = 0; i < N; i++) F[o + i] = raw[o + i] - s; }
  const fr = (t) => Math.max(0, Math.min(n, Math.round((t - p.start) * POSE.FPS)));
  const x0 = Math.max(0, Math.floor(Math.min(p.crop[2], q.crop[2]) * k)), y0 = Math.max(0, Math.floor(Math.min(p.crop[3], q.crop[3]) * k)), x1 = Math.min(W, Math.ceil(Math.max(p.crop[2] + p.crop[0], q.crop[2] + q.crop[0]) * k)), y1 = Math.min(H, Math.ceil(Math.max(p.crop[3] + p.crop[1], q.crop[3] + q.crop[1]) * k));
  const idx = []; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) idx.push(y * W + x); if (idx.length < 16) return null;
  const mean = (a, b) => { const m = new Float32Array(N); const c = Math.max(1, b - a); for (let t = a; t < b; t++) { const o = t * N; for (const i of idx) m[i] += F[o + i]; } for (const i of idx) m[i] /= c; return m; };
  const mad = (u, v) => { let s = 0; for (const i of idx) s += Math.abs(u[i] - v[i]); return s / idx.length; };
  const corr = (u, v) => { let su = 0, sv = 0; for (const i of idx) { su += u[i]; sv += v[i]; } su /= idx.length; sv /= idx.length; let a = 0, b = 0, ab = 0; for (const i of idx) { const du = u[i] - su, dv = v[i] - sv; a += du * du; b += dv * dv; ab += du * dv; } return ab / Math.sqrt(Math.max(1e-9, a * b)); };
  const own = (a, b, per) => { const pf = Math.max(1, Math.round(per * POSE.FPS)); const len = b - a; const h = len >= 2 * pf ? Math.floor(len / pf / 2) * pf : Math.floor(len / 2); return h >= 2 ? mad(mean(a, a + h), mean(b - h, b)) : 0; };
  const pa = fr(p.start), pb = fr(p.end), qa = fr(q.start), qb = fr(q.end); if (pb - pa < 4 || qb - qa < 4) return null;
  const mp = mean(pa, pb), mq = mean(qa, qb); const apart = mad(mp, mq);
  return { cos: r3(corr(mp, mq)), apart: Math.round(apart * 100) / 100, spread: Math.round((apart / Math.max(own(pa, pb, p.period), own(qa, qb, q.period), POSE.FLOOR)) * 100) / 100 };
}

if (!exA.length && fs.existsSync(alt)) { const B = askB();
  if (B && B.segments.some((s) => s.kind === 'exercise')) { B.by = 'split-alt'; B.light = A.light; const junkA = A.segments.filter((s) => s.kind === 'junk'); const warnOf = (s) => { const j = junkA.find((q) => q.start <= (s.start + s.end) / 2 && q.end >= (s.start + s.end) / 2); return j && Array.isArray(j.warn) ? j.warn.slice() : []; };
    B.segments.forEach((s, i) => { s.idx = i; const w = warnOf(s); s.hold = null;
      if (s.kind === 'exercise') { s.score = Math.min(CAP, typeof s.score === 'number' ? s.score : CAP); s.why = `found only by the second splitter, nothing repeats in place here: ${s.why || ''}`.trim(); s.say = `Found only by the second look, about ${Number(s.period).toFixed(1)} s a rep: nothing repeats in place, check it`; if (s.reps < 2.5 && !w.includes('Only one or two reps here')) w.push('Only one or two reps here'); }
      else { const j = junkA.find((q) => q.hold && q.hold[0] >= s.start - 0.5 && q.hold[1] <= s.end + 0.5); if (j) { s.hold = [Math.max(s.start, j.hold[0]), Math.min(s.end, j.hold[1])]; s.say = j.say; } else s.say = 'No repeating movement'; }
      s.warn = w.slice(0, 4); });
    fs.writeFileSync(outF, JSON.stringify(B)); process.exit(0); }
} else if (close && fs.existsSync(alt)) { const B = askB(); const exB = B ? B.segments.filter((s) => s.kind === 'exercise') : [];
  const ov = (p, q) => Math.max(0, Math.min(p.end, q.end) - Math.max(p.start, q.start));
  const view = (s) => { let best = -1, bo = 0; exB.forEach((b, k) => { const o = ov(b, s); if (o > bo) { bo = o; best = k; } }); return best >= 0 && bo >= 0.5 * (s.end - s.start) ? best : -1; }; // B's stretch that covers at least half of this piece
  const vw = exA.map(view); const link = []; const keptApart = []; const pose = []; const regroup = []; const checks = []; // link[i]: why piece i belongs with piece i-1, or null; regroup: piece i gets the group of piece i-1 but stays a stretch of its own
  for (let i = 0; i < exA.length; i++) { link.push(null); pose.push(null); regroup.push(false); if (i === 0 || !near(i) || vw[i] < 0 || vw[i - 1] < 0) continue; const p = exB[vw[i - 1]], q = exB[vw[i]];
    let how = null; if (vw[i] === vw[i - 1]) how = 'one'; else if (vw[i] === vw[i - 1] + 1 && q.group === p.group && (q.carried === true || /carries on the bout before it/.test(q.why || ''))) how = 'carried';
    if (!how) continue; const a = exA[i - 1], b = exA[i]; const at = [a.end, b.start];
    // c. the same period
    const pd = Math.abs(a.period - b.period) / Math.max(1e-6, Math.min(a.period, b.period)); const gap = gapOf(i); const check = { at, gap: r3(gap), how, periods: [a.period, b.period], periodDiff: r3(pd), pose: null, decision: null }; checks.push(check);
    if (pd > PERIOD_TOL) { check.decision = 'apart: periods'; keptApart.push({ at, why: `the second splitter sees one exercise here, but the pieces' periods differ by ${Math.round(pd * 100)} % (${a.period.toFixed(2)} and ${b.period.toFixed(2)} s): not joined` }); continue; }
    // d. the same posture template
    const ps = posture(a, b); pose[i] = ps; check.pose = ps;
    if (ps && ps.cos < POSE.COS && ps.spread > POSE.SPREAD) { check.decision = 'apart: posture'; keptApart.push({ at, pose: ps, why: `the second splitter sees one exercise here, but the two pieces show different postures (their mean pictures agree only ${ps.cos.toFixed(2)} and lie ${ps.spread.toFixed(1)} x further apart than the halves of one piece): not joined` }); continue; }
    if (gap < JOIN_GAP) { link[i] = how; check.decision = 'joined'; } else { regroup[i] = true; check.decision = 'same group, two stretches'; } }
  if (keptApart.length) A.keptApart = keptApart; if (checks.length) A.joinChecks = checks;
  if (regroup.some(Boolean) && !link.some(Boolean)) { // a long pause between the pieces: they stay two stretches, in one group (the groups are numbered again in order of appearance)
    const to = new Map(); const gr = (g) => { let x = g; while (to.has(x) && to.get(x) !== x) x = to.get(x); return x; }; exA.forEach((s, i) => { if (regroup[i]) to.set(gr(s.group), gr(exA[i - 1].group)); }); const order = new Map();
    for (const s of A.segments) if (s.kind === 'exercise') { s.group = gr(s.group); if (!order.has(s.group)) order.set(s.group, order.size + 1); } for (const s of A.segments) if (s.kind === 'exercise') s.group = order.get(s.group); A.regrouped = regroup.filter(Boolean).length; }
  if (link.some(Boolean)) { const runs = []; for (let i = 0; i < exA.length; i++) { if (link[i]) runs[runs.length - 1].push(i); else runs.push([i]); }
    const groupOf = new Map(); const out = []; const newIdx = new Map(); let joined = 0;
    for (const run of runs) { const parts = run.map((i) => exA[i]); if (parts.length === 1) continue; joined++; for (const p of parts) groupOf.set(p.group, parts[0].group); }
    const grp = (g) => { let x = g; for (let k = 0; k < 20 && groupOf.has(x) && groupOf.get(x) !== x; k++) x = groupOf.get(x); return x; };
    exA.forEach((s, i) => { if (regroup[i] && !link[i]) { const x = grp(s.group), y = grp(exA[i - 1].group); if (x !== y) groupOf.set(x, y); } }); // pieces of one set a long pause apart: one group (roots only, so no loop)
    const firstOf = new Map(runs.filter((r) => r.length > 1).map((r) => [exA[r[0]].idx, r])); const inRun = new Map(); for (const r of runs) if (r.length > 1) for (const i of r) inRun.set(exA[i].idx, exA[r[0]].idx);
    for (const s of A.segments) {
      if (firstOf.has(s.idx)) { const run = firstOf.get(s.idx); const parts = run.map((i) => exA[i]); const last = parts[parts.length - 1]; const longest = parts.slice().sort((p, q) => (q.end - q.start) - (p.end - p.start))[0]; let period = longest.period; const bSeg = exB[vw[run[0]]]; const how = run.slice(1).map((i) => link[i]);
        const whole = how.every((h) => h === 'one'); const bInside = ov(bSeg, { start: parts[0].start, end: last.end }) >= 0.7 * (bSeg.end - bSeg.start); // B's stretch is this run, not a longer one that also holds a neighbour kept apart
        if (whole && bInside && bSeg.period / period > 1.7 && bSeg.period / period < 2.3) period = bSeg.period; // B measured the full left-right cycle
        const x0 = Math.min(...parts.map((p) => p.crop[2])), y0 = Math.min(...parts.map((p) => p.crop[3])), x1 = Math.max(...parts.map((p) => p.crop[2] + p.crop[0])), y1 = Math.max(...parts.map((p) => p.crop[3] + p.crop[1]));
        const reps = Math.round(parts.reduce((t, p) => t + (p.reps * p.period) / period, 0) * 10) / 10;
        const warn = [`Joined from ${parts.length} pieces: check it is one exercise`]; for (const p of parts) for (const w of p.warn || []) if (w !== 'Only one or two reps here' && !warn.includes(w)) warn.push(w); if (reps < 2.5) warn.push('Only one or two reps here');
        const cuts = parts.slice(1).map((p, k) => (p.start - parts[k].end >= 0.3 ? `${parts[k].end.toFixed(1)}-${p.start.toFixed(1)} s` : `${p.start.toFixed(1)} s`));
        const seenAs = whole ? `the second splitter sees one bout here (${bSeg.start.toFixed(1)}-${bSeg.end.toFixed(1)} s, ${Number(bSeg.period).toFixed(2)} s a rep)` : 'the second splitter sees the same set carried on after a change of side or grip';
        const sides = parts.slice(1).some((p) => /perhaps the other side of the same exercise/.test(p.why || '')); // A's own other-side hint, on A's own pieces
        const poses = run.slice(1).map((i) => pose[i]).filter(Boolean); const alike = poses.length ? `; the pieces' mean pictures agree ${poses.map((x) => x.cos.toFixed(2)).join(', ')}` : '';
        out.push({ ...parts[0], start: parts[0].start, end: last.end, group: grp(parts[0].group), period: r3(period), reps, crop: [x1 - x0, y1 - y0, x0, y0], cropHow: `the union of the boxes of the ${parts.length} pieces`, ...(parts.some((p) => p.cropUnsure) ? { cropUnsure: true } : {}), score: Math.min(JOIN_CAP, Math.max(...parts.map((p) => p.score))), similarTo: null, hold: null, warn: warn.slice(0, 4), parts: parts.map((p) => [p.start, p.end]),
          say: `Repeats every ${period.toFixed(1)} s, ${reps} reps${sides ? ', sides alternate' : ''} (${parts.length} pieces joined: check it is one exercise)`,
          why: `${sides ? 'one exercise on alternating sides' : 'taken as one exercise'}, joined from ${parts.length} pieces cut at ${cuts.join(' and ')}: ${seenAs}${alike}. The score is capped at ${JOIN_CAP}; scan again with --no-join if these are different exercises. First piece: ${parts[0].why}` }); newIdx.set(s.idx, out.length - 1); continue; }
      if (inRun.has(s.idx)) { newIdx.set(s.idx, newIdx.get(inRun.get(s.idx))); continue; } // a later piece: inside the joined stretch
      if (s.kind === 'junk' && out.length && s.end <= out[out.length - 1].end + 1e-6) continue; // the pause between two pieces
      out.push(s.kind === 'exercise' ? { ...s, group: grp(s.group) } : { ...s }); newIdx.set(s.idx, out.length - 1); }
    const order = new Map(); for (const s of out) if (s.kind === 'exercise') { if (!order.has(s.group)) order.set(s.group, order.size + 1); }
    out.forEach((s, i) => { if (s.kind === 'exercise') { s.group = order.get(s.group); if (s.similarTo != null) { const t = newIdx.get(s.similarTo); s.similarTo = t == null || t === i ? null : t; } } s.idx = i; });
    A.segments = out; A.by = 'split+joined'; A.joined = joined; } }
fs.writeFileSync(outF, JSON.stringify(A));
