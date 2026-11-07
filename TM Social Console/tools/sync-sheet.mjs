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
  for (const p of piecesOf(text)) {
    const t = String(p.text).toLowerCase();
    let plain;
    const lone = /^(head|body)$/.exec(t);
    const mod = /^(head|body) (jab|cross|hook|uppercut|kick|knee|elbow)$/.exec(t);
    if (lone && prev) plain = `${cap(String(prev).split(' ').pop())} to the ${lone[1]}`;
    else if (mod) plain = `${cap(mod[2])} to the ${mod[1]}`;
    else plain = plainPiece(t);
    out.push(plain);
    prev = t;
  }
  return out;
}
export async function countOf(text) {
  const { piecesOf } = await loadCounter();
  const ps = piecesOf(text);
  return { pieceCount: ps.length, strikeCount: ps.filter((p) => p.kind === 'strike').length };
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
export function callsPage(sheetsIn) {
  const sheets = sorted(sheetsIn);
  const out = ['# Combo Coach sync videos: every call', '',
    'Read ahead here, or just watch the video. "At" is the second of the video where the call is shouted, the same moment its words show on the screen; the video starts on the 3 of the count-in, with its first beep a moment later. The bell rings on GO. "Slot" is how long you have before the next call.', ''];
  for (const s of sheets) {
    const combos = s.calls.filter((c) => c.kind === 'combo').length;
    out.push(`## ${s.name.replace(/^cc-sync-/, '')}: ${TITLE[key(s)] || s.discipline}, level ${s.athleteLevel} (${String(s.difficulty).toLowerCase()} mix)`, '',
      `Length ${sec(s.durationSec)} s. Bell at ${sec(s.goAtSec)} s. ${combos} combos, one every ${s.cadenceSec} s.`, '',
      '| # | At (s) | Call | Strikes | Slot (s) |', '|---|---|---|---|---|');
    for (const c of s.calls) {
      const slot = c.nextCallSec - c.startSec;
      out.push(`| ${c.index} | ${sec(c.startSec)} | ${c.kind === 'combo' ? c.text : `${c.text} (defence)`} | ${c.plain} | ${sec(slot)} |`);
    }
    out.push('');
  }
  return out.join('\n');
}

// FILM-GUIDE.md: one page for the owner.
export function filmGuide(sheetsIn) {
  const sheets = sorted(sheetsIn);
  const cad = sheets[0]?.cadenceSec ?? 4.5;
  const afterBell = (s) => r3(s.calls[0].startSec - s.goAtSec);
  const defence = sheets.flatMap((s) => s.calls.filter((c) => c.kind === 'defence').map((c) => c.windowSec));
  const defenceSlot = defence.length ? r3(defence.reduce((a, b) => a + b, 0) / defence.length) : null;
  const combos = sheets[0]?.calls.filter((c) => c.kind === 'combo').length ?? 10;
  const lines = [
    '# Film guide: strike to the Combo Coach videos', '',
    '## What you have', '',
    `Eight videos of Training Mode's Combo Coach playing, two for each style: boxing, kickboxing, Muay Thai and MMA. Each one is about a minute. The coach shouts out ${combos} combos, one after another, and the app shows the same words on the screen (with the next combo under it, so you can see what is coming). Video 1 of each style plays as a level 5 athlete (mostly mid-length combos). Video 2 plays as a level 10 athlete (longer and harder combos).`, '',
    '| Video | Style | Level | Length | First call after the bell |', '|---|---|---|---|---|',
    ...sheets.map((s) => `| ${file(s)} | ${TITLE[key(s)] || s.discipline} | ${s.athleteLevel} | ${sec(s.durationSec)} s | ${afterBell(s).toFixed(1)} s |`), '',
    '## How to film', '',
    '1. Put the video on a phone, a tablet or a TV. Turn the sound up. You need to hear it, and so does your camera.',
    '2. Set your camera up on the bag with your whole body in the frame. Vertical or horizontal is fine. Keep it steady.',
    '3. Start your camera, then press play on the video. Keep the camera running until the video is over.',
    '4. The video counts you in with three beeps, one a second. A bell rings on GO. The coach shouts the first combo a moment after the bell (the table above says how long). Hit the bag to the calls.',
    `5. Each combo gets ${cad} seconds before the next call. If you miss one, keep going and hit the next call. Do not stop and do not restart.`,
    `6. In some videos the coach also calls a defence move between combos (slip, roll, check, pivot or sprawl). Do the move. It gets a shorter slot, about ${defenceSlot ?? 2.8} seconds.`,
    '7. One take per video, about a minute. Do not mute the clip and do not trim it. The sound of the video, heard by your camera, is how the two get lined up.',
    '8. Name each file after its video: boxing-1.mp4, boxing-2.mp4, kickboxing-1.mp4 and so on.', '',
    '## What to send back', '',
    'Your clips, named as above, one per video. If a take went wrong, film that video again and send the new one.', '',
    '## What happens next', '',
    'Each of your clips is lined up with its video from the sound. Then the app screen and your striking go together into one reel.', '',
    'The full list of calls for every video is in CALLS.md, so you can read ahead.',
  ];
  return lines.join('\n') + '\n';
}
