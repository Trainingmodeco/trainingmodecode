// node tools/test-sync-phrases.mjs
//
// Checks the guide voice's phrasing and the plain-words lists against the app's own combo pool
// (components/training-mode/data/comboCoachData.js) and its own piece counter (data/comboMix.js), for
// EVERY combo of every discipline, so a combo added to the pool cannot break the guide unseen:
//   1. every word of a combo is one the voice knows how to phrase (else it would read the whole combo as one
//      run-on phrase instead of one strike at a time);
//   2. the phrases the voice says are the app's own strike pieces: the same number of pieces in all, a phrase
//      holding one piece, or two when it starts with "double" ("double jab", "double low kick": the app calls
//      those "1, 1") and never cut in the middle of a strike ("oblique | kick", "double low | kick");
//   3. the strikes in plain words (FILM-GUIDE and CALLS.md) are one per app piece;
//   4. no combo holds a stray word (a Head or Body with no strike after it): the app counts it as no strike,
//      so a reader could take "Hook Body Hook Head" for three hooks. Known: bc-13. The recorder refuses to
//      deal one, so a seed that deals it is rejected; a NEW one in the pool is reported here.
// Prints what it found; exit code 1 when a check fails.
import fs from 'node:fs';
import path from 'node:path';
import { REPO } from './lib.mjs';
import { phrasesOf, STRIKE_WORDS } from './sync-audio.mjs';
import * as SS from './sync-sheet.mjs';

const KNOWN_STRAY = new Set(['bc-13']);
const file = path.join(REPO, 'components', 'training-mode', 'data', 'comboCoachData.js');
if (!fs.existsSync(file)) { console.error(`test-sync-phrases: ${file} not found (the app's combo pool).`); process.exit(1); }
const mod = await import(`data:text/javascript;base64,${Buffer.from(fs.readFileSync(file, 'utf8')).toString('base64')}`);
const pool = mod.default;
const counter = await SS.loadCounter();
if (!/the app/.test(counter.source)) { console.error(`test-sync-phrases: the app's piece counter (data/comboMix.js) could not be loaded (${counter.source}).`); process.exit(1); }

const problems = [], strays = [];
let n = 0;
for (const c of pool) {
  n++;
  const text = c.comboText, words = text.toLowerCase().split(/\s+/);
  const pieces = counter.piecesOf(text);
  const phrases = phrasesOf(text).map((p) => p.text);
  const bad = (what) => problems.push(`${c.id} "${text}": ${what}`);
  if (words.length > 1 && !words.every((w) => STRIKE_WORDS.has(w))) bad(`the voice does not know ${words.filter((w) => !STRIKE_WORDS.has(w)).join(', ')}: it would say the combo as one run-on phrase`);
  else {
    let total = 0;
    for (const ph of phrases) {
      const k = counter.piecesOf(ph).length;
      total += k;
      if (k > 2 || (k === 2 && !ph.startsWith('double '))) bad(`the voice says "${ph}" as one phrase but the app counts ${k} pieces in it`);
      if (counter.piecesOf(ph).some((p) => p.kind === 'other') && !(KNOWN_STRAY.has(c.id) && /^(head|body)$/.test(ph))) bad(`the voice cuts a strike in the middle: "${ph}"`);
    }
    if (total !== pieces.length) bad(`the voice says ${total} pieces (${phrases.join(' | ')}), the app counts ${pieces.length}`);
  }
  const plain = await SS.plainStrikes(text);
  if (plain.length !== pieces.length) bad(`${plain.length} strikes in plain words, the app counts ${pieces.length} pieces`);
  const stray = pieces.filter((p) => p.kind === 'other').map((p) => p.text);
  if (stray.length) { strays.push(`${c.id} "${text}" (stray: ${stray.join(', ')})`); if (!KNOWN_STRAY.has(c.id)) bad(`a stray word the app does not count (${stray.join(', ')}): a reader could take it for another strike`); }
}
console.log(`sync phrases: ${n} combos of the app's pool, counted by ${counter.source}`);
console.log(`  combos with a stray word (the recorder refuses to deal these): ${strays.length ? strays.join('; ') : 'none'}`);
if (problems.length) { console.log(`\nFAIL, ${problems.length} problem${problems.length === 1 ? '' : 's'}:`); for (const p of problems) console.log(`  ${p}`); process.exit(1); }
console.log(`PASS: the voice's phrases and the plain-words lists match the app's pieces for all ${n} combos.`);
