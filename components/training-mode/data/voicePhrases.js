// What the coach says, cut into the phrases a recorded voice bank holds.
//
// The spoken coach has two ways to talk: the phone's speech engine, and
// recorded clips (public/voice/<voice>/, one clip per phrase, made once from
// the designed coach voices). A line such as "Round 3. High guard defense.
// Hands glued to your temples." is three phrases; a combo "Jab Cross Body Hook"
// is three strikes said on the beat. This module is the one definition of
// that split, used by the runtime (voiceCoach.js) and by the script that
// builds the banks (scripts/voice-bank-inventory.mjs), so a line the app says
// is always looked up the way the bank was recorded.

// TTS voices misread hyphenated / title-cased words — "Push-Ups" gets split at
// the hyphen and "Ups" is read as the initialism "U-P-S". De-hyphenate between
// letters and lowercase everything; speech doesn't need casing.
// Exercise names and cadence labels carry notation that reads fine on screen
// and badly out loud: "(Flat/Incline/Decline)", "Step In / Step Out", "3.5s",
// "3 × 10". Strip the brackets, say "or" for a slash, "seconds" for a
// trailing s and "by" for a multiplication sign.
// A clock time "2:00" / "1:30" / "0:45" is said as minutes and seconds, and
// a " · " separator is a sentence break, and a range "20-40s" is said
// "20 to 40 seconds". A chain "5-10-5" or a punch call
// "1-2" with no unit after it is said as the numbers.
const clockWords = (m, mm, ss) => {
  const mi = Number(mm), se = Number(ss);
  const parts = [];
  if (mi) parts.push(`${mi} minute${mi === 1 ? '' : 's'}`);
  if (se || !mi) parts.push(`${se} seconds`);
  return parts.join(' ');
};
export function normalizeSpeech(text) {
  if (text === undefined || text === null) return '';
  return String(text)
    .replace(/\b(\d{1,2}):([0-5]\d)\b/g, clockWords)
    .replace(/\s*·\s*/g, '. ')
    .replace(/\b\d+(?:\s*[-–]\s*\d+){2,}\b/g, (m) => m.split(/\s*[-–]\s*/).join(' '))
    .replace(/\b([1-8])\s*[-–]\s*([1-8])\b(?!\s*(?:s|sec|secs|seconds|min|mins|minutes|m|reps?|rounds?|sets?|x|%)\b)/gi, '$1 $2')
    .replace(/(\d)\s*[-–]\s*(?=\d)/g, '$1 to ')
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s*\/\s*/g, ' or ')
    .replace(/\s*×\s*/g, ' by ')
    .replace(/(\d+(?:\.\d+)?)\s*s\b/g, '$1 seconds')
    .replace(/([a-zA-Z])-(?=[a-zA-Z])/g, '$1 ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// Strike vocabulary: a run of these words is a combo, said one strike at a time.
const MULTI = ['question mark kick', 'spinning back kick', 'spinning back elbow', 'spinning back fist', 'spinning backfist', 'spinning heel kick', 'superman punch', 'bolo punch', 'flying knee', 'jumping elbow', 'pull counter', 'check counter', 'catch kick', 'feint shot', 'level change', 'fake shot', 'ground pound', 'ground knee', 'step back', 'circle out', 'rear body hook', 'shovel hook', 'check hook', 'oblique kick', 'spinning elbow', 'wheel kick', 'axe kick', 'tornado kick', 'hook kick', 'switch kick', 'body kick', 'high kick', 'low kick', 'lead kick', 'rear kick', 'rear roundhouse', 'lead knee', 'rear knee', 'lead elbow', 'rear elbow', 'double jab', 'double teep', 'body jab', 'body cross', 'body hook', 'body uppercut', 'head cross', 'lead hook', 'rear hook', 'lead uppercut', 'rear uppercut', 'lead overhand', 'rear overhand'];
const MODS = new Set(['double', 'body', 'head', 'lead', 'rear', 'step', 'spinning', 'flying', 'jumping', 'high', 'low', 'switch']);
export const STRIKE_WORDS = new Set(['jab', 'cross', 'hook', 'uppercut', 'overhand', 'kick', 'knee', 'elbow', 'teep', 'roundhouse', 'backfist', 'fist', 'punch', 'slip', 'roll', 'pivot', 'check', 'parry', 'pull', 'feint', 'counter', 'sprawl', 'clinch', 'throw', 'push', 'exit', 'frame', 'sweep', 'pass', 'break', 'shot', 'pound', 'oblique', 'switch', 'double', 'body', 'head', 'lead', 'rear', 'step', 'spinning', 'flying', 'jumping', 'high', 'low', 'level', 'change', 'fake', 'circle', 'out', 'back', 'catch', 'ground', 'bolo', 'superman', 'question', 'mark', 'wheel', 'axe', 'tornado', 'heel', 'shovel', 'duck', 'weave', 'block', 'cover', 'bob', 'guard']);

function unitLength(words, i) {
  const hit = MULTI.find((m) => { const mw = m.split(' '); return mw.every((w, k) => words[i + k] === w); });
  if (hit) return hit.split(' ').length;
  if (MODS.has(words[i]) && i + 1 < words.length) return 1 + unitLength(words, i + 1);
  return 1;
}
export function strikePieces(words) {
  const out = [];
  for (let i = 0; i < words.length;) {
    const len = unitLength(words, i);
    out.push(words.slice(i, i + len).join(' '));
    i += len;
  }
  return out;
}

// The gaps between phrases, seconds: strikes on a beat, sentences apart.
// Each strike clip already carries about 0.1 s of its own lead-in and tail,
// so 0.03 lands the words about 0.15 s apart: a fighter's call, not a list.
export const GAP_STRIKE = 0.03;
export const GAP_SENTENCE = 0.28;

// A line -> [{ text, gap }]: the phrases to say in order, `gap` the silence
// before each (0 for the first). A line splits into phrases at . ! ? ; : ,
// and dashes (sentences end at . ! ? and dashes only); a phrase made only of
// strike words is a combo, one entry per strike.
// A NUMBERS-style punch call ("one", "three to the body"): formatCall joins
// them with commas, but they are one combo, so they get the strike gap.
const NUMBER_CALL = /^(one|two|three|four|five|six|seven|eight)( to the body)?$/;
export const isNumberCall = (s) => NUMBER_CALL.test(s);

// The silence after a phrase played from a mid take (a phrase recorded
// inside a sentence, its voice carrying on): a short breath at a comma or a
// semicolon, a little more at a colon. Recordings join only at these marks.
export const GAP_COMMA = 0.10;
export const GAP_COLON = 0.15;

// The mark that ends a run of punctuation between two phrases: a sentence end
// ('' : . ! ? or a dash), else a colon, a semicolon or a comma.
function sepOf(run) {
  if (!run || /[.!?]/.test(run)) return '';
  if (run.includes(':')) return ':';
  if (run.includes(';')) return ';';
  return ',';
}

// Each entry: { text, gap } as before, plus where it sits:
//   sentence  index of its sentence in the line (sentences end at . ! ? and dashes)
//   phrase    index of its phrase in that sentence (phrases end at , ; :)
//   phrases   how many phrases that sentence has
//   last      true for the last phrase of its sentence
//   sep       the mark after its phrase: ',' ';' ':' or '' (the sentence ends)
//   kind      'text', or 'strike' (one strike of a combo), or 'call' (a
//             NUMBERS punch call); strikes and calls are planned as they always were
export function phrasesOf(line) {
  const text = normalizeSpeech(line).replace(/(\d)\.(\d)/g, '$1\u0001$2').replace(/[—–]/g, '.');
  // Pieces at even indexes, the punctuation runs between them at odd ones.
  const bits = text.split(/([.!?;:,]+)\s*/);
  const pieces = [];
  for (let i = 0; i < bits.length; i += 2) {
    const s = bits[i].replace(/\u0001/g, '.').trim();
    const run = i + 1 < bits.length ? bits[i + 1] : '';
    if (s) pieces.push({ s, run });
    // An empty piece between two runs ("go!. rest"): its run belongs to the phrase before.
    else if (pieces.length) pieces[pieces.length - 1].run += run;
  }
  const sentences = pieces.map((p) => p.s);
  // Where each phrase sits in its sentence.
  const where = [];
  let si = 0, pi = 0, start = 0;
  pieces.forEach((p, i) => {
    // The end of the line ends its sentence, whatever mark is left over.
    const sep = i === pieces.length - 1 ? '' : sepOf(p.run);
    where.push({ sentence: si, phrase: pi, sep, last: sep === '' });
    if (sep === '') {
      for (let k = start; k <= i; k++) where[k].phrases = pi + 1;
      si += 1; pi = 0; start = i + 1;
    } else pi += 1;
  });
  const call = (i) => isNumberCall(sentences[i]) && ((i > 0 && isNumberCall(sentences[i - 1])) || (i + 1 < sentences.length && isNumberCall(sentences[i + 1])));
  const out = [];
  sentences.forEach((s, si) => {
    const words = s.split(/\s+/);
    const at = where[si];
    if (words.length > 1 && words.every((w) => STRIKE_WORDS.has(w))) {
      strikePieces(words).forEach((p, pi) => out.push({ text: p, gap: si === 0 && pi === 0 ? 0 : pi === 0 ? GAP_SENTENCE : GAP_STRIKE, ...at, kind: 'strike' }));
    } else if (si > 0 && isNumberCall(s) && isNumberCall(sentences[si - 1])) {
      out.push({ text: s, gap: GAP_STRIKE, ...at, kind: 'call' });
    } else out.push({ text: s, gap: si === 0 ? 0 : GAP_SENTENCE, ...at, kind: call(si) ? 'call' : 'text' });
  });
  return out;
}

// A line -> its sentences, each the list of its phrasesOf entries in order.
export function sentencesOf(line) {
  const out = [];
  for (const e of phrasesOf(line)) (out[e.sentence] = out[e.sentence] || []).push(e);
  return out.filter(Boolean);
}

// Bank keys for the takes a phrase can be recorded in (see voiceClips.js):
//   midKey('20 minutes')     '20 minutes,'   said inside a sentence, the voice carrying on
//   closingKey('32 seconds') '32 seconds.'   the last phrase of a sentence, the voice at rest
//   sentenceKey(['drive the arms', 'the legs will follow'])
//                            'drive the arms, the legs will follow'   a whole sentence in one take
// A sentence key joins its phrases with ', ' whatever mark parted them, so one
// sentence take serves "Pace: go", "Pace; go" and "Pace, go" alike: the
// recorded pause plays the same. Write lines that differ only in that mark as
// one line; the record list (test:spoken --json) warns when they do not.
export const midKey = (phrase) => `${phrase},`;
export const closingKey = (phrase) => `${phrase}.`;
export const sentenceKey = (phrases) => phrases.map((p) => (typeof p === 'string' ? p : p.text)).join(', ');

// Which kind of take a bank key is: 'mid', 'closing', 'sentence' or 'plain'.
export function keyKind(key) {
  const k = String(key);
  if (k.endsWith(',')) return 'mid';
  if (k.endsWith('.')) return 'closing';
  if (k.includes(', ')) return 'sentence';
  return 'plain';
}

// A phrase with a number in it ("6 glute bridges", "plus 20 x p", "40 seconds")
// is also said from parts when the bank has no clip for the whole phrase: the
// number tokens and the word runs around them, in order. "20.5" stays one
// token. The runtime tries the whole phrase first, then these parts.
export function tokensOf(phrase) {
  const parts = String(phrase).match(/\d+(?:\.\d+)?|[^\d]+/g) || [];
  return parts.map((p) => p.trim()).filter(Boolean);
}

// The file name a phrase's clip is stored under.
export function clipSlug(phrase) {
  return String(phrase).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'x';
}

// The file a bank key is stored in, by its kind: 'slug.mp3' for a plain
// phrase, 'slug__mid.mp3' for a mid take, 'slug__end.mp3' for a closing take
// and 'slug__s.mp3' for a sentence take, the slug made from the key without
// its trailing mark. Used when a bank is built; the app reads the manifest.
const FILE_TAIL = { plain: '', mid: '__mid', closing: '__end', sentence: '__s' };
export function clipFileFor(key) {
  const kind = keyKind(key);
  const bare = kind === 'mid' || kind === 'closing' ? String(key).slice(0, -1) : String(key);
  return `${clipSlug(bare)}${FILE_TAIL[kind]}.mp3`;
}
