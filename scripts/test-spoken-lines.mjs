// What the coach actually says must have a clip in BOTH recorded voices.
//
// voice:coverage reads the lines typed out in the screen files. Lines that
// are built from data (a count, a pace, a distance) never reach it, and that
// is how whole features shipped with no clips. This suite builds those lines
// the way the app does, with real value sweeps (scripts/spoken-sweeps.mjs),
// and plans each against the real banks in public/voice. A line with no plan
// falls to the phone's speech engine, which is silent on some phones. Run
// with `npm run test:spoken`.
//
//   --json <file>            write the phrases and pieces still to record
//   SPOKEN_ASSUME=<file>     treat the keys of that record list ([{ key, text }])
//                            as recorded, to prove the list is enough
import fs from 'node:fs';
import { planClips, piecesFor } from '../components/training-mode/data/voiceClips.js';
import { phrasesOf, tokensOf } from '../components/training-mode/data/voicePhrases.js';
import { spokenSweeps } from './spoken-sweeps.mjs';

const VOICES = ['female', 'male'];
const argv = process.argv.slice(2);
const jsonOut = argv.includes('--json') ? argv[argv.indexOf('--json') + 1] : null;
const assumeFile = process.env.SPOKEN_ASSUME || '';
const assumed = assumeFile ? JSON.parse(fs.readFileSync(assumeFile, 'utf8')).map((r) => (typeof r === 'string' ? r : r.key)) : [];
const banks = Object.fromEntries(VOICES.map((v) => {
  const m = JSON.parse(fs.readFileSync(new URL(`../public/voice/${v}/manifest.json`, import.meta.url), 'utf8'));
  const clips = Object.assign(Object.create(null), m.clips);
  for (const k of assumed) if (!clips[k]) clips[k] = { file: 'assumed.mp3', ms: 500 };
  return [v, { voice: v, base: `/voice/${v}/`, clips, buffers: new Map() }];
}));
// Numbers past 100 are said from parts by the engine's number composer. Until
// it is in, an assumed run treats them as sayable so the list stays the words.
const composes = VOICES.every((v) => planClips(banks[v], '137'));
if (assumeFile && !composes) {
  for (const v of VOICES) for (let n = 101; n <= 9999; n++) if (!banks[v].clips[n]) banks[v].clips[n] = { file: 'assumed.mp3', ms: 500 };
  console.log(`  (assuming ${assumed.length} recorded keys from ${assumeFile}, and numbers 101..9999 from the engine's composer)`);
}

// What a missing phrase needs: each word run of it that cannot be tiled, and
// each number token with no clip (numbers over 100 are the composer's).
const needs = new Map(); // key -> { voices:Set, example, count }
const bigNumbers = new Set();
const missingPhrases = new Set();
function noteNeeds(v, line) {
  for (const ph of phrasesOf(line)) {
    if (planClips(banks[v], ph.text)) continue;
    missingPhrases.add(ph.text);
    for (const t of tokensOf(ph.text)) {
      if (/^\d/.test(t)) {
        if (planClips(banks[v], t)) continue;
        if (/^\d+$/.test(t) && Number(t) > 100) { bigNumbers.add(t); continue; }
      } else if (piecesFor(banks[v], t)) continue;
      const n = needs.get(t) || { voices: new Set(), example: line, count: 0 };
      n.voices.add(v); n.count++;
      needs.set(t, n);
    }
  }
}
let pass = 0, fail = 0;
// Every line of `lines` must plan in every voice. Prints the first few misses.
export function mustPlan(name, lines) {
  const uniq = [...new Set(lines)];
  const missing = [];
  for (const v of VOICES) for (const line of uniq) if (!planClips(banks[v], line)) { missing.push(`${v}: "${line}"`); noteNeeds(v, line); }
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

// ── Cardio spoken forms: shaped to play from clips ───────────────────────
// Whole numbers 0..100 have clips; "05", "3.1" and "125" do not.
const rc = await import('../components/training-mode/data/runCoach.js');
const same = (name, got, want) => {
  if (got === want) { pass++; console.log(`  ok   ${name}`); } else { fail++; console.log(`  FAIL ${name}: got "${got}", want "${want}"`); }
};
same('pace with seconds', rc.speakPace(342, 'mi'), '5 42 per mile');
same('pace with seconds under ten', rc.speakPace(305, 'km'), '5 oh 5 per kilometer');
same('pace on the minute', rc.speakPace(300, 'mi'), '5 minutes per mile');
same('duration under a minute', rc.speakDuration(45), '45 seconds');
same('one second', rc.speakDuration(1), '1 second');
same('one minute', rc.speakDuration(60), '1 minute');
same('minutes and seconds', rc.speakDuration(750), '12 minutes 30');
same('105 seconds is 1 minute 45', rc.speakDuration(105), '1 minute 45');
same('past an hour', rc.speakDuration(3725), '1 hour 2 minutes');
same('distance, half', rc.speakDistance(0.5, 'mi'), 'half a mile');
same('distance, one', rc.speakDistance(1, 'mi'), 'one mile');
same('distance, and a half', rc.speakDistance(1.5, 'mi'), '1 and a half miles');
same('distance, whole', rc.speakDistance(3, 'km'), '3 kilometers');
same('distance, tenths', rc.speakDistance(3.1, 'mi'), '3 point 1 miles');
same('distance, hundredths round to one place', rc.speakDistance(13.14, 'mi'), '13 point 1 miles');
same('belt speed', rc.machineSpeedLine(6.5, 'mi'), 'Set the machine to 6 point 5 mph and match the dial if you change it.');
same('own ghost is "your ghost", never the profile name', rc.ghostFinishLine({ elapsedSec: 590, ghostTotalSec: 600, ownerName: 'MARCUS', ownerId: 'me' }), 'Ghost defeated. You beat your ghost by 10 seconds.');
same("another owner's ghost: name in its own sentence, then the ghost", rc.ghostFinishLine({ elapsedSec: 590, ghostTotalSec: 600, ownerName: 'A WARRIOR', ownerId: 'stranger' }), 'A WARRIOR. Ghost defeated. You beat the ghost by 10 seconds.');
same("another owner's ghost, lost", rc.ghostFinishLine({ elapsedSec: 610, ghostTotalSec: 600, ownerName: 'A WARRIOR', ownerId: 'stranger' }), 'A WARRIOR. The ghost takes this one by 10 seconds. Run it back.');
same("another owner's ghost, draw", rc.ghostFinishLine({ elapsedSec: 600, ghostTotalSec: 600, ownerName: 'A WARRIOR', ownerId: 'stranger' }), 'A WARRIOR. Dead heat. A draw.');
same("another owner's ghost intro", rc.ghostIntroLine({ ownerId: 'stranger', ownerName: 'A WARRIOR', totalSec: 1800 }), 'Ghost mode. A WARRIOR. You are racing their run, 30 minutes. Beat it.');
{
  const intro = rc.buildRunIntro({ methodLabel: 'Running', useGps: true, distance: 3, unit: 'mi', targetSec: 1800, eliteSec: 1200 });
  same("the owner's brief", [...intro.lines, intro.ready, intro.go].join(' '), 'Cardio mode. GPS run, 3 miles. Target time, 30 minutes. Elite time, 20 minutes. Ready. Go!');
}
{
  // No zero-padded or decimal token anywhere in a pace, split or programme call.
  const bad = [];
  for (let p = 180; p <= 1200; p++) for (const u of ['mi', 'km']) { const t = rc.speakPace(p, u); if (/\b0\d\b|\d\.\d/.test(t)) bad.push(t); }
  for (let d = 0.1; d <= 42.2; d += 0.01) { const t = rc.speakDistance(d, 'km'); if (/\d\.\d/.test(t)) bad.push(t); }
  same('no padded or decimal number tokens in paces and distances', bad.slice(0, 3).join(' | '), '');
}

// ── Lines built at runtime: Cardio Mode and the other data-built lines ────
for (const sw of await spokenSweeps()) mustPlan(`${sw.feature}: ${sw.name}`, sw.lines);

if (needs.size || bigNumbers.size) {
  const list = [...needs.entries()].sort((a, b) => b[1].count - a[1].count);
  console.log(`\nto record: ${list.length} phrases or pieces (both voices unless marked)`);
  for (const [k, n] of list.slice(0, 40)) console.log(`  ${JSON.stringify(k)}${n.voices.size < 2 ? ` [${[...n.voices]}]` : ''}  x${n.count}  e.g. "${n.example.slice(0, 90)}"`);
  if (list.length > 40) console.log(`  ... and ${list.length - 40} more (--json <file> writes them all)`);
  if (bigNumbers.size) console.log(`numbers over 100 waiting on the engine's number composer: ${bigNumbers.size} (e.g. ${[...bigNumbers].slice(0, 6).join(', ')})`);
}
if (jsonOut) {
  fs.writeFileSync(jsonOut, JSON.stringify({
    record: [...needs.entries()].map(([key, n]) => ({ key, voices: [...n.voices].sort(), count: n.count, example: n.example })),
    numbersOver100: [...bigNumbers].map(Number).sort((a, b) => a - b),
    phrases: [...missingPhrases].sort(),
  }, null, 1));
  console.log(`wrote ${jsonOut}`);
}

console.log(`\nspoken lines: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
