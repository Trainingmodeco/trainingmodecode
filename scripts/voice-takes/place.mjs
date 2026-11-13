// Coach voice, step 3 of 3: put the chosen takes into the app's banks.
// Copies each mp3 from <work>/takes/<voice>/mp3/ into public/voice/<voice>/, adds its key to the manifest with its
// length, and bumps the bank version. A re-take of an EXISTING single clip goes in only when it measures better than
// the clip it replaces: <work>/slow-clips.json lists those clips as { female: [{ key, ratio, inner }], male: [...] }
// (ratio = length against the voice's rate, inner = longest break inside, ms). Without that file no existing clip
// is replaced.
//   VOICE_WORK=<work dir> node scripts/voice-takes/place.mjs [--dry]
import fs from 'node:fs';
const B = (process.env.VOICE_WORK || '/tmp/voice-work').replace(/\/?$/, '/'); const R = new URL('../../public/voice/', import.meta.url).pathname; const DRY = process.argv.includes('--dry');
const slowFile = B + 'slow-clips.json'; const slow = fs.existsSync(slowFile) ? JSON.parse(fs.readFileSync(slowFile, 'utf8')) : { female: [], male: [] };
for (const v of ['female', 'male']) {
  const keys = JSON.parse(fs.readFileSync(`${B}takes/${v}/keys.json`, 'utf8')); const takes = JSON.parse(fs.readFileSync(`${B}takes/${v}/takes.json`, 'utf8'));
  const m = JSON.parse(fs.readFileSync(`${R}${v}/manifest.json`, 'utf8')); const old = Object.fromEntries(slow[v].map((r) => [r.key, r]));
  let added = 0, replaced = 0, kept = 0, noAudio = 0;
  for (const [key, e] of Object.entries(keys)) {
    const src = `${B}takes/${v}/mp3/${e.file}`; if (!e.ms || !fs.existsSync(src)) { noAudio++; continue; }
    const plain = !/[,.]$/.test(key) && !key.includes(', ');
    if (plain && m.clips[key]) {
      const o = old[key]; const t = takes.find((x) => x.q === e.q && x.id === e.id && x.idx === e.idx);
      const better = o && t && ((t.ratio < o.ratio - 0.15) || (o.inner > 200 && t.inner <= 200 && t.ratio < o.ratio + 0.1));
      if (!better) { kept++; continue; }
      replaced++;
    } else added++;
    if (!DRY) { fs.copyFileSync(src, `${R}${v}/${e.file}`); m.clips[key] = { file: e.file, ms: e.ms }; }
  }
  if (!DRY) { const raw = fs.readFileSync(`${R}${v}/manifest.json`, 'utf8'); m.version = (m.version || 1) + 1; fs.writeFileSync(`${R}${v}/manifest.json`, JSON.stringify(m, null, 1) + (raw.endsWith('\n') ? '\n' : '')); }
  console.log(`${v}: new keys ${added}, existing clips replaced ${replaced}, existing clips kept ${kept}, no audio yet ${noAudio}${DRY ? ' (dry run)' : `, bank version ${m.version}, ${Object.keys(m.clips).length} clips`}`);
}
