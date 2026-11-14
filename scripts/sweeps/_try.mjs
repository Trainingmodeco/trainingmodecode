// Try one sweep module against the real banks:
//   node --no-warnings --import ./scripts/extensionless-loader-register.mjs scripts/sweeps/_try.mjs <module> [--lines]
// Prints, per sweep, how many distinct lines it builds and how many do not plan in each voice, then every distinct
// phrase the planner reports missing (with a count and one line that says it). --lines also lists the failing lines.
import fs from 'node:fs'; import process from 'node:process';
import { planClips, planLine } from '../../components/training-mode/data/voiceClips.js';
const VOICES = ['female', 'male'];
const banks = Object.fromEntries(VOICES.map((v) => { const m = JSON.parse(fs.readFileSync(new URL(`../../public/voice/${v}/manifest.json`, import.meta.url), 'utf8')); return [v, { voice: v, base: `/voice/${v}/`, clips: Object.assign(Object.create(null), m.clips), buffers: new Map() }]; }));
if (typeof globalThis.localStorage === 'undefined') { const store = new Map(); globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k), clear: () => store.clear(), key: (i) => [...store.keys()][i] ?? null, get length() { return store.size; } }; }
const name = process.argv[2]; const showLines = process.argv.includes('--lines');
const sweeps = await (await import(`./${name}.mjs`)).default();
const missing = new Map(); let total = 0;
for (const sw of sweeps) {
  const uniq = [...new Set(sw.lines.filter((l) => typeof l === 'string' && l.trim()))]; total += uniq.length; const bad = { female: 0, male: 0 }; const failing = [];
  for (const line of uniq) { let any = false; for (const v of VOICES) { if (planClips(banks[v], line)) continue; bad[v]++; any = true; for (const p of planLine(banks[v], line).missing) { const m = missing.get(p) || { n: 0, voices: new Set(), line }; m.n++; m.voices.add(v); missing.set(p, m); } } if (any) failing.push(line); }
  console.log(`${sw.feature} | ${sw.name}: ${uniq.length} lines; without a plan: female ${bad.female}, male ${bad.male}`);
  if (showLines) for (const l of failing.slice(0, 60)) console.log('     ' + l);
}
console.log(`\n${total} lines in all; ${missing.size} distinct phrases missing:`);
for (const [p, m] of [...missing].sort((a, b) => b[1].n - a[1].n)) console.log(`  "${p}" [${[...m.voices].join('+')}] x${m.n}  e.g. ${m.line}`);
