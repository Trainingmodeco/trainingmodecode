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
//   --json <file>            write every key still to record, as
//                            [{ key, text, kind, example }]: `kind` is plain,
//                            mid, closing or sentence, `text` what to say when
//                            recording it, `example` a line that needs it
//   SPOKEN_ASSUME=<file>     treat the keys of that record list ([{ key, text }],
//                            keys of any kind) as recorded, to prove the list is enough
import fs from 'node:fs';
import { planClips, planLine, planDetail, piecesFor } from '../components/training-mode/data/voiceClips.js';
import { sentencesOf, tokensOf, midKey, closingKey, sentenceKey } from '../components/training-mode/data/voicePhrases.js';
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

// What to record, key -> { key, text, kind, example, voices:Set, count }.
const needs = new Map();
const bigNumbers = new Set();
const need = (v, key, kind, text, example) => {
  const n = needs.get(key) || { key, text, kind, example, voices: new Set(), count: 0, texts: new Set() };
  n.voices.add(v); n.count++; n.texts.add(text);
  needs.set(key, n);
};
// One sentence take serves a sentence whatever marks part its phrases
// (sentenceKey joins them with ', '). Keys asked for by sentences that differ
// only in those marks: the take recorded will play the same pause for all.
const mixedMarks = () => [...needs.values()].filter((n) => n.kind === 'sentence' && n.texts.size > 1);
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
// A sentence as it would be read out when recording it: "Target time, 30 minutes."
const sentenceText = (sent) => cap(sent.map((e, i) => e.text + (i === sent.length - 1 ? '.' : e.sep === ':' ? ':' : e.sep === ';' ? ';' : ',')).join(' '));

// What a line with a phrase the bank cannot say needs: each word run of the
// phrase that cannot be tiled, and each number token with no clip (numbers
// over 100 are the composer's).
function noteNeeds(v, line) {
  for (const p of planLine(banks[v], line).missing) {
    for (const t of tokensOf(p)) {
      if (/^\d/.test(t)) {
        if (planClips(banks[v], t)) continue;
        if (/^\d+$/.test(t) && Number(t) > 100) { bigNumbers.add(t); continue; }
      } else if (piecesFor(banks[v], t)) continue;
      need(v, t, 'plain', cap(t) + '.', line);
    }
  }
}

// The takes that make a sentence sound like one voice (see the Cardio check
// below): a sentence with no number in it is one sentence take; in a sentence
// with a number, each phrase that is not already one clip gets the take of
// its place (mid inside the sentence, closing at its end, closing for a
// sentence of one phrase), recorded inside the sentence it comes from.
// Returns the sentences that are not yet one voice, as text.
function takeNeeds(v, line, note) {
  const detail = planDetail(banks[v], line);
  const sents = sentencesOf(line);
  const bad = [];
  sents.forEach((sent) => {
    const si = sent[0].sentence;
    const parts = detail.parts.filter((p) => p.sentence === si);
    if (parts.length === 1 && parts[0].how === 'sentence') return;
    const one = (p) => ['mid', 'closing', 'plain'].includes(p.how) && p.keys.length === 1;
    if (parts.every(one)) return;
    bad.push(sent.map((e) => e.text).join(', ') + ' = ' + parts.map((p) => p.keys.join(' + ') || `(${p.texts[0]}?)`).join(' | '));
    if (!note) return;
    const text = sentenceText(sent);
    // A sentence take is asked for only where the planner would play one: two
    // or more phrases, no number, and no combo strike or NUMBERS call in it.
    if (!/\d/.test(sent.map((e) => e.text).join(' ')) && sent.length > 1 && sent.every((e) => e.kind === 'text')) { need(v, sentenceKey(sent), 'sentence', text, line); return; }
    sent.forEach((e, i) => {
      const p = parts.find((x) => x.texts.length === 1 && x.texts[0] === e.text && x.sentence === si);
      if (p && one(p)) return;
      if (sent.length > 1 && !e.last) need(v, midKey(e.text), 'mid', text, line);
      else need(v, closingKey(e.text), 'closing', text, line);
    });
  });
  return bad;
}
let pass = 0, fail = 0;
{
  // A sentence with a combo in it never plays from a sentence take (the
  // planner says strikes one by one), so the record list must not ask for one.
  const before = new Set(needs.keys());
  takeNeeds('female', 'Zq unsayable lead, jab cross.', true);
  const asked = [...needs.keys()].filter((k) => !before.has(k));
  for (const k of asked) needs.delete(k);
  const ok = asked.length > 0 && asked.every((k) => k === 'zq unsayable lead,');
  if (ok) { pass++; console.log('  ok   no sentence take is asked for a sentence with a combo in it'); } else { fail++; console.log(`  FAIL a sentence with a combo asks for ${JSON.stringify(asked)}`); }
}
// Every line of `lines` must plan in every voice. Prints the first few misses.
// A Cardio line that misses is noted as the takes it needs, so a record list
// fixes both this check and the one-voice check below.
export function mustPlan(name, lines, feature = '') {
  const uniq = [...new Set(lines)];
  const missing = [];
  for (const v of VOICES) for (const line of uniq) {
    if (planClips(banks[v], line)) continue;
    missing.push(`${v}: "${line}"`);
    if (feature === 'Cardio Mode' && !exempt(line)) takeNeeds(v, line, true); else noteNeeds(v, line);
  }
  if (!missing.length) { pass++; console.log(`  ok   ${name} (${uniq.length} lines)`); return; }
  fail++;
  console.log(`  FAIL ${name}: ${missing.length} of ${uniq.length * VOICES.length} have no clip`);
  for (const m of missing.slice(0, 12)) console.log(`         ${m}`);
}
// Cardio lines that may be said from pieces, each with the reason. Their
// values are too many to record one by one and are rarely said; everything
// else in the line still plays from its own takes.
const ONE_VOICE_EXCEPTIONS = [
  // A belt speed typed on the dial can be any tenth. The guided programmes'
  // speeds ("Speed: 6 point 5 mph.") are recorded whole.
  /^machine speed: /i,
  // A distance to the tenth is recorded up to 10 miles / 15 kilometres, plus
  // the race distances. Past that it is said from pieces.
  /\b[1-9]\d point \d miles\b/i,
  /\b(1[5-9]|[2-9]\d) point \d kilometers\b/i,
  // Past 30 miles / 50 kilometres (and halves past 15 / 25) a distance is
  // said from pieces: an ultra, not a training run.
  /\b(3[1-9]|[4-9]\d|\d{3,}) miles\b/i,
  /\b(5[1-9]|[6-9]\d|\d{3,}) kilometers\b/i,
  /\b(1[6-9]|[2-9]\d) and a half miles\b/i,
  /\b(2[6-9]|[3-9]\d) and a half kilometers\b/i,
];
const exempt = (line) => ONE_VOICE_EXCEPTIONS.some((re) => re.test(line));

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
// Every number is said inside a phrase with its unit ("42 seconds per mile",
// "3 miles"), and a label before a value ends with a colon ("Under target:
// 46 seconds"), so recordings meet only at a comma, a colon or a sentence
// end; "05", "3.1" and "125" have no clip.
const rc = await import('../components/training-mode/data/runCoach.js');
const same = (name, got, want) => {
  if (got === want) { pass++; console.log(`  ok   ${name}`); } else { fail++; console.log(`  FAIL ${name}: got "${got}", want "${want}"`); }
};
same('pace with seconds', rc.speakPace(342, 'mi'), '5 minutes, 42 seconds per mile');
same('pace with seconds under ten', rc.speakPace(305, 'km'), '5 minutes, 5 seconds per kilometer');
same('pace on the minute', rc.speakPace(300, 'mi'), '5 minutes per mile');
same('duration under a minute', rc.speakDuration(45), '45 seconds');
same('one second', rc.speakDuration(1), '1 second');
same('one minute', rc.speakDuration(60), '1 minute');
same('minutes and seconds', rc.speakDuration(750), '12 minutes, 30 seconds');
same('105 seconds is 1 minute, 45 seconds', rc.speakDuration(105), '1 minute, 45 seconds');
same('past an hour', rc.speakDuration(3725), '1 hour, 2 minutes');
same('distance, half', rc.speakDistance(0.5, 'mi'), 'half a mile');
same('distance, one', rc.speakDistance(1, 'mi'), 'one mile');
same('distance, and a half', rc.speakDistance(1.5, 'mi'), '1 and a half miles');
same('distance, whole', rc.speakDistance(3, 'km'), '3 kilometers');
same('distance, tenths', rc.speakDistance(3.1, 'mi'), '3 point 1 miles');
same('distance, hundredths round to one place', rc.speakDistance(13.14, 'mi'), '13 point 1 miles');
same('distance past a marathon is the whole unit', rc.speakDistance(31.6, 'mi'), '32 miles');
same('belt speed', rc.machineSpeedLine(6.5, 'mi'), 'Machine speed: 6 point 5 mph. Match the dial if you change it.');
same('own ghost is "your ghost", never the profile name', rc.ghostFinishLine({ elapsedSec: 590, ghostTotalSec: 600, ownerName: 'MARCUS', ownerId: 'me' }), 'Ghost defeated. You beat your ghost: 10 seconds.');
same("another owner's ghost: name in its own sentence, then the ghost", rc.ghostFinishLine({ elapsedSec: 590, ghostTotalSec: 600, ownerName: 'A WARRIOR', ownerId: 'stranger' }), 'A WARRIOR. Ghost defeated. You beat the ghost: 10 seconds.');
same("another owner's ghost, lost", rc.ghostFinishLine({ elapsedSec: 610, ghostTotalSec: 600, ownerName: 'A WARRIOR', ownerId: 'stranger' }), 'A WARRIOR. Ghost wins: 10 seconds. Run it back.');
same("another owner's ghost, draw", rc.ghostFinishLine({ elapsedSec: 600, ghostTotalSec: 600, ownerName: 'A WARRIOR', ownerId: 'stranger' }), 'A WARRIOR. Dead heat. A draw.');
same("another owner's ghost intro", rc.ghostIntroLine({ ownerId: 'stranger', ownerName: 'A WARRIOR', totalSec: 1800 }), 'Ghost mode. A WARRIOR. You are racing their run, 30 minutes. Beat it.');
{
  const intro = rc.buildRunIntro({ methodLabel: 'Running', useGps: true, distance: 3, unit: 'mi', targetSec: 1800, eliteSec: 1200 });
  same("the owner's brief", [...intro.lines, intro.ready, intro.go].join(' '), 'Cardio mode. GPS run, 3 miles. Target time: 30 minutes. Aim pace: 10 minutes per mile. Elite time: 20 minutes. Ready. Go!');
}
// The shapes the owner listened to, rebuilt: a time, a split, the last mile, the finish.
same('a time of minutes and seconds', `${rc.speakDuration(1754)}.`, '29 minutes, 14 seconds.');
same('an hour and minutes', `${rc.speakDuration(3900)}.`, '1 hour, 5 minutes.');
same('a split at 2 miles', rc.splitScript({ marker: 2, unit: 'mi', elapsedSec: 1180, paceSec: 590, targetPaceSec: 600, goal: 5, targetSec: 3000, eliteSec: 2000 }),
  '2 miles. 19 minutes, 40 seconds. Pace: 9 minutes, 50 seconds per mile. Ahead of target: 20 seconds.');
same('the last whole mile before the goal', rc.splitScript({ marker: 2, unit: 'mi', elapsedSec: 1200, paceSec: 600, targetPaceSec: 600, goal: 3, targetSec: 1800, eliteSec: 1200 }),
  '2 miles. 20 minutes. Pace: 10 minutes per mile. Right on target. One mile to go.');
same('the last half mile, with half-mile calls on', rc.splitScript({ marker: 2.5, unit: 'mi', elapsedSec: 1500, paceSec: 600, targetPaceSec: 600, goal: 3, targetSec: 1800, eliteSec: 1200 }),
  'Half a mile to go. Empty the tank.'.replace(/^/, '2 and a half miles. 25 minutes. Pace: 10 minutes per mile. Right on target. '));
same('the finish', rc.finishScript({ dist: 3, unit: 'mi', elapsedSec: 1754, targetSec: 1800, eliteSec: 1200 }),
  'Goal reached. 3 miles. Your time: 29 minutes, 14 seconds. Under target: 46 seconds. Good work.');
same('a finish right on the target says so, not "0 seconds"', rc.finishScript({ dist: 3, unit: 'mi', elapsedSec: 1800, targetSec: 1800, eliteSec: 1200 }),
  'Goal reached. 3 miles. Your time: 30 minutes. Right on target. Good work.');
same('interval brief', rc.buildIntervalIntro({ styleLabel: 'Tabata', rounds: 8, workSec: 20, restSec: 10, warmupSec: 180 }).lines.join(' '),
  'Cardio mode. tabata. 8 rounds. 20 seconds work, 10 seconds rest. Warm up first: 3 minutes.');
same('steady brief: the lead-in, then the time', rc.steadyBrief({ methodLabel: 'Elliptical', durationSeconds: 1200 }), 'Elliptical. Steady: 20 minutes. Go!');
same('resume: the lead-ins, then the numbers', rc.runResumedLine(720, 2, 'mi'), 'Run resumed: 12 minutes. Distance so far: 2 miles.');
// chaseSummaryLine is a tail added after a sentence end, so it leads with a
// space; the check is about the words, and the joined line about the spacing.
same('chase summary', rc.chaseSummaryLine({ attempts: 3, passes: 2, xp: 20 }).trim(), '3 chases. 2 escapes.');
same('chase summary joins the run end with one space', rc.runEndedLine({ dist: 0, unit: 'mi', elapsedSec: 600, chase: { attempts: 3, passes: 2 } }).includes('Your time: 10 minutes. 3 chases. 2 escapes.'), true);

// Half-unit calls are the athlete's option (HALF-MILE CALLS, off by
// default): the coach calls the whole unit, the split table keeps the halves.
same('splits are called at the whole unit', rc.spokenMarkers([0.5, 1, 1.5, 2]).join(','), '1,2');
same('half-unit calls when turned on', rc.spokenMarkers([0.5, 1, 1.5, 2], true).join(','), '0.5,1,1.5,2');
{
  // Past a marathon a distance is said to the whole unit: a called 26.5 would
  // say "27 miles", and then 27 would say it again. Those halves stay quiet.
  const said = rc.spokenMarkers([26, 26.5, 27, 27.5, 28], true, 'mi').map((m) => rc.freeRunSplitScript({ marker: m, unit: 'mi', elapsedSec: m * 600, paceSec: 600, targetPaceSec: 600 }).split('.')[0]);
  same('half calls past a marathon never repeat or round up a distance', said.join(' | '), '26 miles | 27 miles | 28 miles');
  same('half-km calls run to the marathon in km', rc.spokenMarkers([41.5, 42, 42.5], true, 'km').join(','), '41.5,42');
}
{
  // Over a 5-mile run with the option off, no half-unit distance is said.
  const said = [];
  for (const m of rc.spokenMarkers(rc.crossedMarkers(0, 4.99))) said.push(rc.splitScript({ marker: m, unit: 'mi', elapsedSec: m * 600, paceSec: 600, targetPaceSec: 600, goal: 5, targetSec: 3000, eliteSec: 2000 }));
  same('no "half a mile" or "and a half" with half-mile calls off', said.filter((l) => /half a mile|and a half|Halfway/.test(l)).join(' | '), '');
}
{
  // No zero-padded or decimal token anywhere in a pace, split or programme call.
  const bad = [];
  for (let p = 180; p <= 1200; p++) for (const u of ['mi', 'km']) { const t = rc.speakPace(p, u); if (/\b0\d\b|\d\.\d/.test(t)) bad.push(t); }
  for (let d = 0.1; d <= 42.2; d += 0.01) { const t = rc.speakDistance(d, 'km'); if (/\d\.\d/.test(t)) bad.push(t); }
  same('no padded or decimal number tokens in paces and distances', bad.slice(0, 3).join(' | '), '');
}

// ── Lines built at runtime: Cardio Mode and the other data-built lines ────
const sweeps = await spokenSweeps();
for (const sw of sweeps) mustPlan(`${sw.feature}: ${sw.name}`, sw.lines, sw.feature);

// ── Cardio Mode sounds like one voice, not a tiled list ──────────────────
// Each sentence of a Cardio line plays as one sentence take, or each of its
// phrases plays as ONE clip: the take recorded for its place in the sentence
// (mid or closing), or its plain clip. Never from number pieces glued to word
// pieces ("under target by" + "46" + "seconds"), which is a second voice
// cutting in. Lines matching ONE_VOICE_EXCEPTIONS are left out. This fails
// until the takes are recorded; the summary lists the first few, --json all.
for (const sw of sweeps) {
  if (sw.feature !== 'Cardio Mode') continue;
  const bad = [];
  for (const v of VOICES) for (const line of new Set(sw.lines)) {
    if (exempt(line) || !planClips(banks[v], line)) continue; // no plan at all: mustPlan already failed it
    for (const b of takeNeeds(v, line, true)) bad.push(`${v}: ${b}`);
  }
  if (!bad.length) { pass++; console.log(`  ok   ${sw.feature}: ${sw.name}: every sentence one take, or every phrase one clip`); continue; }
  fail++;
  const uniq = [...new Set(bad)];
  console.log(`  FAIL ${sw.feature}: ${sw.name}: ${uniq.length} sentences said from pieces`);
  for (const m of uniq.slice(0, 15)) console.log(`         ${m}`);
}

if (needs.size || bigNumbers.size) {
  const list = [...needs.values()].sort((a, b) => b.count - a.count);
  const kinds = {};
  for (const n of list) kinds[n.kind] = (kinds[n.kind] || 0) + 1;
  console.log(`\nto record: ${list.length} keys (${Object.entries(kinds).map(([k, c]) => `${c} ${k}`).join(', ')}; both voices unless marked)`);
  for (const n of list.slice(0, 15)) console.log(`  ${JSON.stringify(n.key)} [${n.kind}]${n.voices.size < 2 ? ` [${[...n.voices]}]` : ''}  x${n.count}  say "${n.text.slice(0, 80)}"`);
  if (list.length > 15) console.log(`  ... and ${list.length - 15} more (--json <file> writes them all)`);
  const mixed = mixedMarks();
  if (mixed.length) {
    console.log(`warning: ${mixed.length} sentence keys are asked for by sentences that differ only in their marks; one take will play the same pause for all:`);
    for (const n of mixed.slice(0, 15)) console.log(`  ${JSON.stringify(n.key)}  ${[...n.texts].map((t) => JSON.stringify(t)).join(' / ')}`);
  }
  if (bigNumbers.size) console.log(`numbers over 100 waiting on the engine's number composer: ${bigNumbers.size} (e.g. ${[...bigNumbers].slice(0, 6).join(', ')})`);
}
if (jsonOut) {
  const list = [...needs.values()].sort((a, b) => a.key.localeCompare(b.key)).map(({ key, text, kind, example }) => ({ key, text, kind, example }));
  fs.writeFileSync(jsonOut, JSON.stringify(list, null, 1));
  console.log(`wrote ${jsonOut} (${list.length} keys)`);
}

console.log(`\nspoken lines: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
