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
// before each (0 for the first). Sentences split on . ! ? ; : , and dashes;
// a sentence made only of strike words is a combo, one phrase per strike.
// A NUMBERS-style punch call ("one", "three to the body"): formatCall joins
// them with commas, but they are one combo, so they get the strike gap.
const NUMBER_CALL = /^(one|two|three|four|five|six|seven|eight)( to the body)?$/;
export const isNumberCall = (s) => NUMBER_CALL.test(s);

export function phrasesOf(line) {
  const text = normalizeSpeech(line).replace(/(\d)\.(\d)/g, '$1\u0001$2').replace(/[—–]/g, '.');
  const sentences = text.split(/[.!?;:,]+\s*/).map((s) => s.replace(/\u0001/g, '.').trim()).filter(Boolean);
  const out = [];
  sentences.forEach((s, si) => {
    const words = s.split(/\s+/);
    if (words.length > 1 && words.every((w) => STRIKE_WORDS.has(w))) {
      strikePieces(words).forEach((p, pi) => out.push({ text: p, gap: si === 0 && pi === 0 ? 0 : pi === 0 ? GAP_SENTENCE : GAP_STRIKE }));
    } else if (si > 0 && isNumberCall(s) && isNumberCall(sentences[si - 1])) {
      out.push({ text: s, gap: GAP_STRIKE });
    } else out.push({ text: s, gap: si === 0 ? 0 : GAP_SENTENCE });
  });
  return out;
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
