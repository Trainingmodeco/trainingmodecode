#!/usr/bin/env node
// voice-place-names.mjs: install the picked name takes (voice-names.mjs --cut writes <work>/picked/<voice>/<file>.mp3 and picked.json)
// into the app's voice banks: public/voice/<voice>/<file>.mp3, a manifest entry { file, ms } under the key, and the bank version + 1.
//
//   node voice-place-names.mjs <work1> [<work2> ...] [--dry]
//
// A key that already has a clip in a bank is left alone (never replaced); a file name that is taken by another key is a problem and nothing is written.
// Each voice's version goes up by one once, however many work dirs. Prints one JSON line per voice.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url)); const bank = path.resolve(here, '..', '..', '..', 'public', 'voice');
const argv = process.argv.slice(2); const dry = argv.includes('--dry'); const works = argv.filter((a) => !a.startsWith('--')); if (!works.length) { process.stderr.write('usage: node voice-place-names.mjs <work> [<work> ...] [--dry]\n'); process.exit(1); }
let bad = 0; const plans = {};
for (const v of ['female', 'male']) {
  const mf = path.join(bank, v, 'manifest.json'); const raw = fs.readFileSync(mf, 'utf8'); const m = JSON.parse(raw); const takenFile = new Map(Object.entries(m.clips).map(([k, c]) => [c.file, k])); const add = [];
  for (const w of works) {
    const pj = path.join(w, 'picked.json'); if (!fs.existsSync(pj)) { process.stderr.write(`no picked.json in ${w}\n`); bad++; continue; }
    for (const [key, p] of Object.entries(JSON.parse(fs.readFileSync(pj, 'utf8'))[v] || {})) {
      if (m.clips[key]) continue; const src = path.join(w, 'picked', v, p.file);
      if (!fs.existsSync(src)) { process.stderr.write(`${v}: ${key}: ${src} is missing\n`); bad++; continue; }
      if (takenFile.has(p.file)) { process.stderr.write(`${v}: ${key}: file ${p.file} belongs to "${takenFile.get(p.file)}"\n`); bad++; continue; }
      takenFile.set(p.file, key); add.push({ key, src, file: p.file, ms: p.ms });
    }
  }
  plans[v] = { m, raw, mf, add };
}
if (bad) { process.stderr.write(`${bad} problem(s): nothing written\n`); process.exit(1); }
for (const v of ['female', 'male']) {
  const { m, raw, mf, add } = plans[v];
  if (!dry) { for (const a of add) { fs.copyFileSync(a.src, path.join(bank, v, a.file)); m.clips[a.key] = { file: a.file, ms: a.ms }; } if (add.length) { m.version = (m.version || 1) + 1; fs.writeFileSync(mf, JSON.stringify(m, null, 1) + (raw.endsWith('\n') ? '\n' : '')); } }
  process.stdout.write(`${JSON.stringify({ voice: v, added: add.length, version: m.version, clips: Object.keys(m.clips).length, dry })}\n`);
}
