#!/usr/bin/env node
// voice-names.mjs: record plain exercise names in both coach voices, take by take, and keep only the takes that pass the bank's numbers.
// The recipe is CLAUDE.md "Recording plain names or phrases" (generator: Higgsfield seed_audio; cut: scripts/voice-takes/plain.mjs).
//
// The work dir holds names.json: [{ key, text }] (key = the bank key, e.g. "landmine floor press"; text = what to say, "Landmine floor press.").
//
//   node voice-names.mjs <work> --requests [--first female=3,male=2] [--again female=3,male=3] [--max 12]
//        prints a JSON array of up to <max> requests (index, params), ready for mcp__Higgsfield__generate_audio_batch `requests`, for the
//        (voice, key) pairs that still have no passing take and nothing outstanding (first round: --first takes each; later rounds: --again).
//        A pair gets at most 3 rounds (--rounds N raises that; --redo-soft S asks again for pairs whose picked take is soft with a pause of S seconds or more; --female-rate N sets the female speech_rate, 20 by default: a long name that came out too fast is asked again slower). Every request is written to <work>/reqs.jsonl.
//   node voice-names.mjs <work> --urls <file.json>
//        <file.json>: [{ index, url }] (from jobs_wait: result_url of each completed job). Appended to <work>/urls.jsonl.
//   node voice-names.mjs <work> --cut
//        downloads each new url, cuts it with plain.mjs, judges it, picks the best passing take of every (voice, key) and writes
//        <work>/picked/<voice>/<file>.mp3 + picked.json + need.json (+ prints a summary).
//   node voice-names.mjs <work> --drop <idx,idx,...>
//        marks requests that never produced a take (the submission failed, or the job ended failed) as abandoned, so their (voice, key) can be asked for again.
//   node voice-names.mjs <work> --status
//   --soft (with --cut/--status): see the judge below: a take that fails ONLY on a pause under 0.3 s is accepted when no take passes outright, and marked soft in picked.json.
//
// A take passes when plain.mjs reports: groups 1 and speechGroups 1 (one phrase, no double take), headRoomMs >= 10 and tailRoomMs >= 20
// (the voice does not run into the edge of the file), longestPause < 0.2 s, lufs within 0.5 of -16, and a length of 75 to 140 ms per letter
// (the existing library-name clips run 78 to 137, median 96 male and 100 female). Of the passing takes the one nearest the voice's median wins.
import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process'; import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url)); const repo = path.resolve(here, '..', '..', '..'); const plain = path.join(repo, 'scripts', 'voice-takes', 'plain.mjs');
const argv = process.argv.slice(2); const work = argv[0]; if (!work) { process.stderr.write('usage: node voice-names.mjs <work> --requests|--urls <file>|--cut|--status\n'); process.exit(1); }
const flag = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const rdj = (f, d) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : d); const rdl = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
const names = rdj(path.join(work, 'names.json'), []); const textOf = new Map(names.map((n) => [n.key, n.text]));
const SOFT = argv.includes('--soft'); const VOICES = ['female', 'male']; const FEMALE_REF = 'ace2fa4f-5c6a-4739-9bc0-c91497d6f409'; const MALE_ID = 'f1e8226e-2248-4d5f-b43c-0a79e9949dbf';
const MEDIAN = { female: 99.7, male: 96 }; const slug = (key) => `${key.replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}.mp3`; const letters = (key) => key.replace(/[^a-z0-9]/g, '').length;
const counts = (s) => Object.fromEntries(String(s || '').split(',').filter(Boolean).map((p) => p.split('=')).map(([v, n]) => [v, +n]));
const reqsF = path.join(work, 'reqs.jsonl'), urlsF = path.join(work, 'urls.jsonl'), cutF = path.join(work, 'cut.jsonl'), dropF = path.join(work, 'dropped.jsonl');
const append = (f, rows) => fs.appendFileSync(f, rows.map((r) => `${JSON.stringify(r)}\n`).join(''));
const judge = (voice, key, m) => {
  const why = []; const perLetter = m.ms / letters(key);
  if (m.groups !== 1 || m.speechGroups !== 1) why.push('double take');
  if (m.headRoomMs < 10) why.push('starts at the file edge'); if (m.tailRoomMs < 20) why.push('runs into the file end');
  if (m.longestPause >= 0.2) why.push(`pause ${m.longestPause}s`); if (Math.abs(m.lufs + 16) > 0.5) why.push(`lufs ${m.lufs}`);
  if (perLetter < 75) why.push(`too short (${perLetter.toFixed(0)} ms/letter)`); if (perLetter > 140) why.push(`too slow (${perLetter.toFixed(0)} ms/letter)`);
  return { pass: !why.length, why, perLetter };
};
const state = () => {
  const dropped = new Set(rdl(dropF).map((d) => d.idx)); const reqs = rdl(reqsF), cuts = rdl(cutF); const picked = rdj(path.join(work, 'picked.json'), { female: {}, male: {} });
  const out = new Map(); // `${voice}|${key}` -> { issued, cut, rounds } (an abandoned request counts as neither issued nor in a round)
  for (const r of reqs) { if (dropped.has(r.idx)) continue; const k = `${r.voice}|${r.key}`; const o = out.get(k) || { issued: 0, cut: 0, rounds: new Set() }; o.issued++; o.rounds.add(r.round); out.set(k, o); }
  for (const c of cuts) { const o = out.get(`${c.voice}|${c.key}`); if (o) o.cut++; }
  return { reqs, cuts, picked, out };
};
if (argv.includes('--requests')) {
  const first = { female: 3, male: 2, ...counts(flag('--first')) }; const again = { female: 3, male: 3, ...counts(flag('--again')) }; const max = +(flag('--max') || 12); const maxRounds = +(flag('--rounds') || 3); const redoSoft = +(flag('--redo-soft') || 0); const femaleRate = +(flag('--female-rate') ?? 20);
  const { reqs, picked, out } = state(); let idx = reqs.reduce((a, r) => Math.max(a, r.idx), -1) + 1; const batch = []; const rows = [];
  outer: for (const n of names) for (const v of VOICES) {
    if (picked[v] && picked[v][n.key] && !(redoSoft && picked[v][n.key].soft && picked[v][n.key].pause >= redoSoft)) continue; const o = out.get(`${v}|${n.key}`) || { issued: 0, cut: 0, rounds: new Set() };
    if (o.issued > o.cut) continue; // takes still outstanding
    if (o.rounds.size >= maxRounds) continue; const round = o.rounds.size + 1; const want = (round === 1 ? first : again)[v];
    for (let t = 0; t < want; t++) {
      if (batch.length >= max) break outer;
      const params = { model: 'seed_audio', prompt: textOf.get(n.key), use_unlim: false, ...(v === 'female' ? { medias: [{ value: FEMALE_REF, role: 'audio_references' }], speech_rate: femaleRate } : { voice_id: MALE_ID, voice_type: 'preset' }) };
      batch.push({ index: idx, params }); rows.push({ idx, voice: v, key: n.key, round }); idx++;
    }
  }
  append(reqsF, rows); process.stdout.write(`${JSON.stringify(batch)}\n`); process.exit(0);
}
if (flag('--drop')) { const ids = String(flag('--drop')).split(',').map((x) => +x).filter((x) => Number.isInteger(x)); append(dropF, ids.map((idx) => ({ idx }))); process.stdout.write(`${JSON.stringify({ dropped: ids.length })}\n`); process.exit(0); }
if (flag('--urls')) { const list = rdj(flag('--urls'), []); const have = new Set(rdl(urlsF).map((u) => u.index)); const add = list.filter((u) => u && u.url && !have.has(u.index)).map((u) => ({ index: u.index, url: u.url })); append(urlsF, add); process.stdout.write(`${JSON.stringify({ added: add.length, total: have.size + add.length })}\n`); process.exit(0); }
const finish = () => {
  const { reqs, cuts } = state(); const byKey = new Map(); const picked = { female: {}, male: {} }; const need = [];
  for (const c of cuts) { const k = `${c.voice}|${c.key}`; if (!byKey.has(k)) byKey.set(k, []); byKey.get(k).push(c); }
  fs.rmSync(path.join(work, 'picked'), { recursive: true, force: true });
  for (const n of names) for (const v of VOICES) {
    const list = (byKey.get(`${v}|${n.key}`) || []); const ok = list.filter((c) => c.pass).sort((a, b) => Math.abs(a.perLetter - MEDIAN[v]) - Math.abs(b.perLetter - MEDIAN[v]));
    // --soft: when no take passes outright, a take whose ONLY failure is a pause of 0.2 to 0.3 s inside the phrase (plain.mjs caps it at 0.10 s; 0.3 s is where the bank calls it two takes) is taken (the shortest pause first), and marked soft
    const soft = SOFT && !ok.length ? list.filter((c) => !c.pass && c.why.length && c.why.every((w) => /^pause /.test(w)) && c.metrics.groups === 1).sort((a, b) => a.metrics.longestPause - b.metrics.longestPause || Math.abs(a.perLetter - MEDIAN[v]) - Math.abs(b.perLetter - MEDIAN[v])) : [];
    if (ok.length || soft.length) { const c = ok.length ? ok[0] : soft[0]; const f = slug(n.key); fs.mkdirSync(path.join(work, 'picked', v), { recursive: true }); fs.copyFileSync(path.join(work, 'mp3', `${c.idx}.mp3`), path.join(work, 'picked', v, f)); picked[v][n.key] = { file: f, ms: c.metrics.ms, take: c.idx, perLetter: +c.perLetter.toFixed(1), of: list.length, ...(c.pass ? {} : { soft: true, pause: c.metrics.longestPause }) }; }
    else need.push({ voice: v, key: n.key, takes: list.length, issued: reqs.filter((r) => r.voice === v && r.key === n.key).length, why: [...new Set(list.flatMap((c) => c.why))] });
  }
  // --soft, second pass: a take whose ONLY failure is "too short" (62 ms a letter or more: a brisk read of a long name made of short words, with clean head and tail)
  // is taken when the other voice's clip for the name is no more than 1.5 times as long; the fastest-but-nearest-the-median take wins
  if (SOFT) for (let i = need.length - 1; i >= 0; i--) {
    const q = need[i]; const other = picked[q.voice === 'female' ? 'male' : 'female'][q.key]; const list = byKey.get(`${q.voice}|${q.key}`) || [];
    const c = list.filter((x) => !x.pass && x.why.length && x.why.every((w) => /^too short /.test(w)) && x.metrics.groups === 1 && x.perLetter >= 62 && (!other || other.ms / x.metrics.ms <= 1.5)).sort((a, b) => b.perLetter - a.perLetter)[0];
    if (!c) continue; const f = slug(q.key); fs.mkdirSync(path.join(work, 'picked', q.voice), { recursive: true }); fs.copyFileSync(path.join(work, 'mp3', `${c.idx}.mp3`), path.join(work, 'picked', q.voice, f));
    picked[q.voice][q.key] = { file: f, ms: c.metrics.ms, take: c.idx, perLetter: +c.perLetter.toFixed(1), of: list.length, soft: true, short: true, pause: c.metrics.longestPause }; need.splice(i, 1);
  }
  // the two voices should say a name in about the same time
  const warn = []; for (const n of names) { const f = picked.female[n.key], m = picked.male[n.key]; if (f && m) { const r = f.ms / m.ms; if (r < 0.65 || r > 1.55) warn.push({ key: n.key, femaleMs: f.ms, maleMs: m.ms }); } }
  fs.writeFileSync(path.join(work, 'picked.json'), JSON.stringify(picked, null, 1)); fs.writeFileSync(path.join(work, 'need.json'), JSON.stringify({ need, warn }, null, 1));
  return { names: names.length, picked: { female: Object.keys(picked.female).length, male: Object.keys(picked.male).length }, need: need.length, warn: warn.length, needList: need.map((x) => `${x.voice}:${x.key} (${x.takes} takes: ${x.why.join('; ') || 'none cut'})`) };
};
if (argv.includes('--cut')) {
  const urls = rdl(urlsF); const reqs = new Map(rdl(reqsF).map((r) => [r.idx, r])); const done = new Set(rdl(cutF).map((c) => c.idx)); fs.mkdirSync(path.join(work, 'wav'), { recursive: true }); fs.mkdirSync(path.join(work, 'mp3'), { recursive: true });
  const rows = []; let failed = 0;
  for (const u of urls) {
    if (done.has(u.index)) continue; const r = reqs.get(u.index); if (!r) continue; const wav = path.join(work, 'wav', `${u.index}.wav`); const mp3 = path.join(work, 'mp3', `${u.index}.mp3`);
    try {
      if (!fs.existsSync(wav) || !fs.statSync(wav).size) execFileSync('curl', ['-sfL', '--retry', '3', '-o', wav, u.url], { stdio: 'ignore' });
      const txt = execFileSync('node', [plain, wav, mp3], { encoding: 'utf8', maxBuffer: 1e8, stdio: ['ignore', 'pipe', 'ignore'] }).trim().split('\n').pop(); const m = JSON.parse(txt);
      rows.push({ idx: u.index, voice: r.voice, key: r.key, metrics: m, ...judge(r.voice, r.key, m) });
    } catch (e) { failed++; rows.push({ idx: u.index, voice: r.voice, key: r.key, metrics: { ms: 0 }, pass: false, why: ['cut failed'], perLetter: 0 }); }
  }
  append(cutF, rows); const s = finish(); process.stdout.write(`${JSON.stringify({ cutNow: rows.length, failedNow: failed, ...s })}\n`); process.exit(0);
}
if (argv.includes('--status')) { const s = finish(); process.stdout.write(`${JSON.stringify(s)}\n`); process.exit(0); }
process.stderr.write('nothing to do: give --requests, --urls <file>, --cut or --status\n'); process.exit(1);
