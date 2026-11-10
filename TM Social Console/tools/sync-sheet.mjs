// The paperwork of the Combo Coach sync videos (used by tools/app-broll.mjs): the strikes of each
// call in plain words, the timing sheet (JSON and CSV) of each video, and the two pages the
// owner reads (FILM-GUIDE.md and CALLS.md). Everything here is plain data in, plain text out.
import fs from 'node:fs';
import path from 'node:path';
import { REPO } from './lib.mjs';
import { strikePieces } from './sync-audio.mjs';

// ─────────────────────────────────────────────────────────────────────────────
// The pieces of a call, counted the way the app counts them.
// ─────────────────────────────────────────────────────────────────────────────
// The app's own counter is data/comboMix.js (piecesOf). It is read from the app's source so the
// numbers here can never drift from the app's; when that file is not where it is expected (or its
// shape changed) a plain splitter takes over and the sheet says so.
let counter = null;
export async function loadCounter() {
  if (counter) return counter;
  const file = path.join(REPO, 'components', 'training-mode', 'data', 'comboMix.js');
  try {
    const src = fs.readFileSync(file, 'utf8').replace(/^import COMBO_POOL from .*$/m, 'const COMBO_POOL = [];');
    const mod = await import(`data:text/javascript;base64,${Buffer.from(src).toString('base64')}`);
    if (typeof mod.piecesOf !== 'function') throw new Error('piecesOf is gone');
    counter = { source: 'the app (data/comboMix.js)', piecesOf: (t) => mod.piecesOf(t).map((p) => ({ text: p.text, kind: p.kind })) };
  } catch {
    counter = {
      source: 'a plain splitter (the app\'s data/comboMix.js was not found)',
      piecesOf: (t) => strikePieces(String(t).toLowerCase().split(/\s+/).filter(Boolean)).map((text) => ({ text, kind: /^(slip|roll|pivot|check|parry|pull|feint|counter)$/.test(text) ? 'defence' : 'strike' })),
    };
  }
  return counter;
}

// ─────────────────────────────────────────────────────────────────────────────
// Plain words.
// ─────────────────────────────────────────────────────────────────────────────
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const GLOSS = {
  teep: 'Teep (push kick)',
  check: 'Check (lift the shin to block a kick)',
  slip: 'Slip (move your head off the line)',
  roll: 'Roll (duck under the hook)',
  pivot: 'Pivot (step off at an angle)',
  parry: 'Parry (knock the punch aside)',
  pull: 'Pull (lean back, out of range)',
  feint: 'Feint (fake a strike)',
  sprawl: 'Sprawl (hips back, stop the takedown)',
  'level change': 'Level change (drop your height)',
  'fake shot': 'Fake shot (act like you are shooting a takedown)',
  clinch: 'Clinch (grab hold of the head)',
  frame: 'Frame (forearm into the bag to hold it off)',
  push: 'Push (shove the bag away)',
  pass: 'Pass (step past the legs)',
  throw: 'Throw (a takedown: turn the bag and drop it)',
  break: 'Break (push off and step out of the clinch)',
  exit: 'Exit (step out and away)',
  sweep: 'Sweep (hook the leg out from under)',
  'step back': 'Step back',
  'circle out': 'Circle out',
  'pull counter': 'Pull counter (lean back, then fire)',
  'check counter': 'Check counter (block the kick, fire back)',
  'catch kick': 'Catch the kick',
  'feint shot': 'Feint a shot',
  'question mark kick': 'Question mark kick',
  'spinning back kick': 'Spinning back kick',
  'spinning back elbow': 'Spinning back elbow',
  'spinning backfist': 'Spinning backfist',
  'ground pound': 'Ground and pound',
  'rear roundhouse': 'Rear roundhouse kick',
  roundhouse: 'Roundhouse kick',
  'hook kick': 'Hook kick',
  'switch kick': 'Switch kick (switch stance, then kick)',
};
// One piece of a combo ("body hook") as the owner reads it ("Hook to the body").
export function plainPiece(text) {
  const t = String(text).toLowerCase().trim();
  if (GLOSS[t]) return GLOSS[t];
  const body = /^(rear )?body (jab|cross|hook|uppercut|kick)$/.exec(t);
  if (body) return `${cap(`${body[1] || ''}${body[2]}`)} to the body`;
  const head = /^head (kick|knee|elbow)$/.exec(t);
  if (head) return `${cap(head[1])} to the head`;
  if (/^high kick$/.test(t)) return 'High kick (to the head)';
  if (/^low kick$/.test(t)) return 'Low kick (to the thigh)';
  return cap(t);
}
// The strikes of a call as the owner reads them. The app's own splitter gives the pieces ("Double Jab"
// is two of them), and the plain words are made from each: "Body Hook" is "Hook to the body". A lone
// "Head" after a body shot (the pool's "Hook Body Hook Head": body, then upstairs) is the same
// strike to the head.
export async function plainStrikes(text) {
  const { piecesOf } = await loadCounter();
  const out = [];
  let prev = null;
  const glossed = new Set(); // a defence move is explained once per call: "Slip (move ...), Slip"
  for (const p of piecesOf(text)) {
    const t = String(p.text).toLowerCase();
    let plain;
    const lone = /^(head|body)$/.exec(t);
    const mod = /^(head|body) (jab|cross|hook|uppercut|kick|knee|elbow)$/.exec(t);
    if (lone && prev) plain = `${cap(String(prev).split(' ').pop())} to the ${lone[1]}`;
    else if (mod) plain = `${cap(mod[2])} to the ${mod[1]}`;
    else plain = plainPiece(t);
    if (GLOSS[t]) { if (glossed.has(t)) plain = cap(t); glossed.add(t); }
    out.push(plain);
    prev = t;
  }
  return out;
}
export async function countOf(text) {
  const { piecesOf } = await loadCounter();
  const ps = piecesOf(text);
  // `stray`: words the app's counter does not know as a strike, a defence or a move, or a Head / Body with no strike
  // after it. The pool's "Hook Body Hook Head" is one: the app counts it as 2 strikes and a stray "head", and a
  // reader could take it for three hooks. A video must not deal one (the recorder refuses; pick another seed).
  return { pieceCount: ps.length, strikeCount: ps.filter((p) => p.kind === 'strike').length, stray: ps.filter((p) => p.kind === 'other').map((p) => p.text) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Writing.
// ─────────────────────────────────────────────────────────────────────────────
const r3 = (x) => Math.round(x * 1000) / 1000;
const csvCell = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

export function writeSheet(dir, sheet) {
  fs.mkdirSync(dir, { recursive: true });
  const base = path.join(dir, sheet.name);
  fs.writeFileSync(`${base}.timing.json`, JSON.stringify(sheet, null, 2) + '\n');
  const head = ['name', 'discipline', 'athleteLevel', 'difficulty', 'cadenceSec', 'seed', 'appCommit', 'durationSec', 'goAtSec', 'countInBeepsAtSec', 'index', 'kind', 'text', 'strikeCount', 'startSec', 'speechEndSec', 'nextCallSec', 'strikesInPlainWords'];
  const rows = [head.join(',')];
  for (const c of sheet.calls) {
    rows.push([sheet.name, sheet.discipline, sheet.athleteLevel, sheet.difficulty, sheet.cadenceSec, sheet.seed, sheet.appCommit, sheet.durationSec, sheet.goAtSec, sheet.countInBeepsAtSec.join(' '),
      c.index, c.kind, c.text, c.strikeCount, c.startSec, c.speechEndSec, c.nextCallSec, c.plain].map(csvCell).join(','));
  }
  fs.writeFileSync(`${base}.timing.csv`, rows.join('\n') + '\n');
}

export function readSheets(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => /\.timing\.json$/.test(f)).sort().map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
}

const ORDER = ['boxing', 'kickboxing', 'muaythai', 'mma'];
const TITLE = { boxing: 'Boxing', kickboxing: 'Kickboxing', muaythai: 'Muay Thai', mma: 'MMA' };
const key = (s) => String(s.discipline).toLowerCase().replace(/\s+/g, '');
const sorted = (sheets) => [...sheets].sort((a, b) => ORDER.indexOf(key(a)) - ORDER.indexOf(key(b)) || a.name.localeCompare(b.name));
const file = (s) => `${s.name.replace(/^cc-sync-/, '')}.mp4`;
const sec = (x) => `${r3(x).toFixed(1)}`;

// CALLS.md: the table of every call of every video, to read ahead.
const isDef = (c) => c.kind === 'defence';
export function callsPage(sheetsIn) {
  const sheets = sorted(sheetsIn);
  const withDef = sheets.filter((s) => s.calls.some(isDef));
  const defSlot = (() => { const w = sheets.flatMap((s) => s.calls.filter(isDef).map((c) => c.windowSec)); return w.length ? (w.reduce((a, b) => a + b, 0) / w.length).toFixed(1) : null; })();
  const out = ['# Combo Coach sync videos: every call', '',
    'Read ahead here, or just watch the video. "At" is the second of the video where the coach shouts the call, the same moment its words show on the screen. The video starts on the 3 of the count-in, then the coach says the round, and the bell rings on GO. "Time" is how long you have before the next call.', '',
    'The last column says what to throw or do, in plain words. A body or head word before a punch sends that punch there ("Body Cross" is a cross to the body). If the words and this column differ, do what this column says. A move that needs explaining is explained in brackets the first time it comes up in a call.', ''];
  if (withDef.length) {
    out.push(`In ${withDef.map(file).join(', ')} the coach also shouts a one-word defence call between some of the combos (SLIP!, PIVOT! and so on). Do that move. It gets a shorter slot, about ${defSlot} seconds, and it is not a combo: those rows are marked D1, D2 and so on, and the combos are numbered 1 to ${Math.max(...sheets.map((s) => s.calls.filter((c) => !isDef(c)).length))}. ${sheets.some((s) => s.athleteLevel >= 10 && s.calls.some(isDef)) ? '' : 'The level 10 videos have none.'}`.trim(), '');
  }
  for (const s of sheets) {
    const combos = s.calls.filter((c) => !isDef(c)).length, defs = s.calls.length - combos;
    out.push(`## ${s.name.replace(/^cc-sync-/, '')}: ${TITLE[key(s)] || s.discipline}, level ${s.athleteLevel} (${String(s.difficulty).toLowerCase()} mix)`, '',
      `Length ${sec(s.durationSec)} s. Bell at ${sec(s.goAtSec)} s, first call at ${sec(s.calls[0].startSec)} s. ${combos} combos, one every ${s.cadenceSec} s${defs ? `, and ${defs} defence call${defs === 1 ? '' : 's'}` : ''}.`, '',
      '| # | At (s) | Call | What to throw or do | Time (s) |', '|---|---|---|---|---|');
    let n = 0, d = 0;
    for (const c of s.calls) {
      const label = isDef(c) ? `D${++d}` : String(++n);
      const slot = isDef(c) ? sec(c.nextCallSec - c.startSec) : String(s.cadenceSec);
      out.push(`| ${label} | ${sec(c.startSec)} | ${isDef(c) ? `${c.text} (defence)` : c.text} | ${c.plain} | ${slot} |`);
    }
    out.push('');
  }
  return out.join('\n');
}

// FILM-GUIDE.md: one page for the owner. opts.filesAt: where the eight video files are (a sentence).
export function filmGuide(sheetsIn, opts = {}) {
  const sheets = sorted(sheetsIn);
  const cad = sheets[0]?.cadenceSec ?? 4.5;
  const combos = Math.max(...sheets.map((s) => s.calls.filter((c) => !isDef(c)).length));
  const defCalls = sheets.flatMap((s) => s.calls.filter(isDef));
  const withDef = sheets.filter((s) => s.calls.some(isDef));
  const defWords = [...new Set(defCalls.map((c) => c.text.replace(/!$/, '').toLowerCase()))];
  const defSlot = defCalls.length ? (defCalls.reduce((a, c) => a + c.windowSec, 0) / defCalls.length).toFixed(1) : null;
  const afterBell = r3(Math.min(...sheets.map((s) => s.calls[0].startSec - s.goAtSec)));
  const ann = sheets.filter((s) => Number.isFinite(s.roundAnnouncementAtSec) && Number.isFinite(s.roundAnnouncementEndSec)).map((s) => s.roundAnnouncementEndSec - s.roundAnnouncementAtSec);
  const annSec = ann.length ? Math.max(1, Math.round(ann.reduce((a, b) => a + b, 0) / ann.length)) : 3;
  const filesAt = opts.filesAt || 'The eight video files are too big to keep with the code, so you get them as files. Ask Claude where to download them.';
  const lines = [
    '# Film guide: strike to the Combo Coach videos', '',
    '## What you have', '',
    `Eight videos of Training Mode's Combo Coach playing, two for each style: boxing, kickboxing, Muay Thai and MMA. Each one is about a minute. The coach shouts out ${combos === 10 ? '10 combos' : `${combos} combos`}, one after another, and the app shows the same words on the screen (with the next combo under it, so you can read ahead). Video 1 of each style plays as a level 5 athlete (mostly mid-length combos). Video 2 plays as a level 10 athlete (longer and harder combos).`, '',
    filesAt, '',
    '| Video | Style | Level | Length | Bell at | First call at |', '|---|---|---|---|---|---|',
    ...sheets.map((s) => `| ${file(s)} | ${TITLE[key(s)] || s.discipline} | ${s.athleteLevel} | ${sec(s.durationSec)} s | ${sec(s.goAtSec)} s | ${sec(s.calls[0].startSec)} s |`), '',
    'Both times are seconds from the start of the video.', '',
    '## What you need', '',
    '- **Two devices.** One plays the video, the other films you. A phone and a tablet, two phones, or a phone and a laptop all work. One phone cannot do both.',
    '- A speaker for the video, loud enough to hear over the bag.', '',
    '## How to film', '',
    '1. Set the camera 2 to 3 metres (6 to 10 feet) from the bag, with your whole body in the frame. Vertical or horizontal is fine. Keep it steady: a tripod, or propped against something.',
    '2. Put the screen that plays the video next to the bag, where you can read it as you hit, and where its sound reaches the camera. Play it out loud on its own speaker. No headphones or earbuds: the camera has to hear it.',
    '3. Turn the sound up until you can hear the coach over the bag. Do not mute anything.',
    '4. Start the camera, then press play on the video. Keep the camera running until the video ends.',
    `5. You will hear three beeps, one a second. Then the coach says "Round 1", the style and the pace (about ${annSec} seconds). Then the bell rings with a "Go!", and the first call comes about ${afterBell.toFixed(1)} seconds after it. The table above has the times. Hit the bag to the calls.`,
    `6. Each combo gets ${cad} seconds before the next call. If you miss one, keep going and hit the next call. Do not stop and do not restart. The coach says a long combo in 2 to 3 seconds, but kicks take longer: if you run out of time, drop the last strike and be ready for the next call.`,
    ...(defCalls.length ? [`7. In ${withDef.map(file).join(', ')} the coach also shouts a one-word defence call between some combos (${defWords.join(', ')}). Do the move. It gets a shorter slot, about ${defSlot} seconds. The other videos have none.`] : []),
    `${defCalls.length ? 8 : 7}. If the words and the plain-words list in CALLS.md differ, do what the list says. A body or head word before a punch sends that punch there.`,
    `${defCalls.length ? 9 : 8}. One take per video, about a minute. Do not trim the clip. The sound of the video, heard by your camera, is how the two get lined up.`, '',
    '## What to send back', '',
    '- Your clips, the original files from your camera. Not a copy sent through WhatsApp, Messages or an editing app: those squeeze the picture and can change the sound. A one-minute clip can be 50 to 200 MB, and that is fine.',
    '- Put them in the Google Drive folder TM Social Console > raw footage. The clips are big, so Claude has to be running on your laptop to read them (a cloud session can only fetch files up to 10 MB).',
    '- Name each clip after its video: boxing-1.mp4, boxing-2.mp4, kickboxing-1.mp4 and so on. If you cannot rename them, film them in order and tell Claude the order.',
    '- Keep the eight video files exactly as you got them. Each timing sheet only fits its own video, so do not swap one for a new copy.',
    '- If a take went wrong, film that video again and send the new clip.', '',
    '## What happens next', '',
    'Claude finds where each video sits inside your clip from the sound (the beeps, the bell and the coach have to be heard in your clip). Then the app screen and your striking go together into one reel, with every call lined up. Nothing is posted until you say yes.', '',
    'Every call of every video is listed in CALLS.md, so you can read ahead.',
  ];
  return lines.join('\n') + '\n';
}
