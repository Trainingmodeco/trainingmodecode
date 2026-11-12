// What the coach actually says must have a clip in BOTH recorded voices.
//
// voice:coverage reads the lines typed out in the screen files. Lines that
// are built from data (a count, a pace, a distance) never reach it, and that
// is how whole features shipped with no clips. This suite builds those lines
// the way the app does, with real value sweeps, and plans each against the
// real banks in public/voice. A line with no plan falls to the phone's speech
// engine, which is silent on some phones. Run with `npm run test:spoken`.
import fs from 'node:fs';
import { planClips } from '../components/training-mode/data/voiceClips.js';

const VOICES = ['female', 'male'];
const banks = Object.fromEntries(VOICES.map((v) => {
  const m = JSON.parse(fs.readFileSync(new URL(`../public/voice/${v}/manifest.json`, import.meta.url), 'utf8'));
  return [v, { voice: v, base: `/voice/${v}/`, clips: m.clips, buffers: new Map() }];
}));

let pass = 0, fail = 0;
// Every line of `lines` must plan in every voice. Prints the first few misses.
export function mustPlan(name, lines) {
  const uniq = [...new Set(lines)];
  const missing = [];
  for (const v of VOICES) for (const line of uniq) if (!planClips(banks[v], line)) missing.push(`${v}: "${line}"`);
  if (!missing.length) { pass++; console.log(`  ok   ${name} (${uniq.length} lines)`); return; }
  fail++;
  console.log(`  FAIL ${name}: ${missing.length} of ${uniq.length * VOICES.length} have no clip`);
  for (const m of missing.slice(0, 12)) console.log(`         ${m}`);
}

// ── Training Arcade rep counts ───────────────────────────────────────────
// ArcadeCadenceRepPlayer and ArcadeBenchmarkPlayer speak String(rep).
mustPlan('Arcade rep count 1..100, spoken as digits', Array.from({ length: 100 }, (_, i) => String(i + 1)));

// The players must not go back to speaking the count as words: the bank has
// no "nine", "twelve" or "twenty one".
for (const f of ['ArcadeCadenceRepPlayer.jsx', 'ArcadeBenchmarkPlayer.jsx']) {
  const src = fs.readFileSync(new URL(`../components/training-mode/${f}`, import.meta.url), 'utf8');
  const ok = /speakAsync\(String\(i\)/.test(src) && !/speakAsync\(countText/.test(src);
  if (ok) { pass++; console.log(`  ok   ${f} speaks the count as digits`); } else { fail++; console.log(`  FAIL ${f} speaks the count as words`); }
}

console.log(`\nspoken lines: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
