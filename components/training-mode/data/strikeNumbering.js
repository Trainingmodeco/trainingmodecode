// PROMPT N — the strike numbering system, as a render/speech transform.
//
// Numbers cover PUNCHES ONLY, the way real gyms call pads. 1–6 is the
// universal boxing standard; 7–8 (overhands) is a common extension we adopt
// and teach explicitly. Any number 1–6 "to the body" is the same punch sent
// downstairs — displayed compact (1B…6B), spoken "one to the body". Kicks,
// knees, elbows, teeps, defense and every modifier word (Slip, Feint,
// Clinch…) are NEVER numbered: kick numbering genuinely varies gym to gym,
// so we refuse to invent one.
//
// Stored data stays words everywhere (comboCoachData, campaign JSON, the
// arsenal). This module converts at display/speech time only, so athletes
// can switch call styles freely and nothing in the content layer changes.

export const CALL_STYLES = [
  { id: 'names', label: 'NAMES', blurb: 'Every strike called by name.' },
  { id: 'numbers', label: 'NUMBERS', blurb: 'Boxing numbers — 1-2-3, punches only.' },
];

// 'teach' (CALL + NAME) was retired: it rendered EXACTLY like numbers on
// screen and only differed in the voice, so the picker offered a choice the
// display never honoured. Saved profiles carrying it land on numbers.
export function callStyleOf(id) {
  const key = String(id || 'names').toLowerCase();
  const mapped = key === 'teach' ? 'numbers' : key;
  return CALL_STYLES.find((s) => s.id === mapped) || CALL_STYLES[0];
}

// ── The canonical map ──────────────────────────────────────────────────────
// display: what the big call panel shows.  speech: what the coach says in
// NUMBERS style (number words, never digits — TTS reads "1-2" as arithmetic).
// name: the word form, used by NAMES style and the teach suffix.

export const NUMBERED = {
  'Jab':           { num: '1',  speech: 'one',                  name: 'Jab' },
  'Cross':         { num: '2',  speech: 'two',                  name: 'Cross' },
  'Lead Hook':     { num: '3',  speech: 'three',                name: 'Lead Hook' },
  'Rear Hook':     { num: '4',  speech: 'four',                 name: 'Rear Hook' },
  'Lead Uppercut': { num: '5',  speech: 'five',                 name: 'Lead Uppercut' },
  'Rear Uppercut': { num: '6',  speech: 'six',                  name: 'Rear Uppercut' },
  'Lead Overhand': { num: '7',  speech: 'seven',                name: 'Lead Overhand' },
  'Rear Overhand': { num: '8',  speech: 'eight',                name: 'Rear Overhand' },
  'Body Jab':      { num: '1B', speech: 'one to the body',      name: 'Body Jab' },
  'Body Cross':    { num: '2B', speech: 'two to the body',      name: 'Body Cross' },
  'Body Hook':     { num: '3B', speech: 'three to the body',    name: 'Body Hook' },
  'Rear Body Hook':{ num: '4B', speech: 'four to the body',     name: 'Rear Body Hook' },
  'Body Uppercut': { num: '5B', speech: 'five to the body',     name: 'Body Uppercut' },
};

// Unqualified tokens in existing combo text resolve to a deterministic
// default (PROMPT N's ambiguity rule): Hook → 3, Uppercut → 6, Overhand → 8.
const ALIASES = {
  'Hook': 'Lead Hook',
  'Uppercut': 'Rear Uppercut',
  'Overhand': 'Rear Overhand',
};

// Longest-first token list — compound NAMED techniques and kick/knee/elbow
// words must win over their sub-words, so "Hook Kick" never yields a 3 and
// "Check Hook" stays a technique. Mirrors data/arsenal.js's approach.
const WORD_TOKENS = [
  'Spinning Back Kick', 'Spinning Back Elbow', 'Spinning Backfist', 'Spinning Heel Kick',
  'Question Mark Kick', 'Superman Punch', 'Bolo Punch', 'Flying Knee', 'Jumping Elbow',
  'Pull Counter', 'Fake Shot', 'Level Change', 'Ground and Pound',
  'Switch Kick', 'Body Kick', 'High Kick', 'Low Kick', 'Lead Kick', 'Rear Kick',
  'Hook Kick', 'Axe Kick', 'Wheel Kick', 'Oblique Kick', 'Tornado Kick',
  'Check Hook', 'Shovel Hook', 'Rear Roundhouse', 'Lead Knee', 'Rear Knee',
  'Lead Elbow', 'Rear Elbow', 'Double Jab', 'Roundhouse', 'Teep', 'Knee', 'Elbow',
];

const NUMBERED_TOKENS = [...Object.keys(NUMBERED), ...Object.keys(ALIASES)];

// One combined list, longest first, so tokenisation is unambiguous.
const ALL_TOKENS = [...WORD_TOKENS, ...NUMBERED_TOKENS]
  .sort((a, b) => b.length - a.length);

/**
 * Split combo text into segments:
 *   { kind: 'num',  num, speech, name }   — a numbered punch
 *   { kind: 'word', text }                — everything else, untouched
 * Unknown words (Slip, Feint, Clinch, Head…) pass through as words.
 */
export function tokenize(comboText) {
  const out = [];
  let rest = String(comboText || '').trim();
  while (rest.length) {
    let matched = null;
    for (const tok of ALL_TOKENS) {
      if (rest === tok || rest.startsWith(tok + ' ')) { matched = tok; break; }
    }
    if (matched) {
      // "Double Jab" is two jabs, not a modifier — call it as 1, 1.
      if (matched === 'Double Jab') {
        const j = NUMBERED['Jab'];
        out.push({ kind: 'num', ...j });
        out.push({ kind: 'num', ...j });
      } else {
        const key = ALIASES[matched] || matched;
        const hit = NUMBERED[key];
        if (hit) out.push({ kind: 'num', ...hit });
        else out.push({ kind: 'word', text: matched });
      }
      rest = rest.slice(matched.length).trim();
    } else {
      const sp = rest.indexOf(' ');
      const word = sp === -1 ? rest : rest.slice(0, sp);
      out.push({ kind: 'word', text: word });
      rest = sp === -1 ? '' : rest.slice(sp + 1).trim();
    }
  }
  return out;
}

/**
 * Format one combo for a call style.
 *
 * Returns { display, speech, segments }:
 *  - display — the big call panel string. Consecutive numbers join with
 *    " - "; word strikes join with " · " (upper-cased): `1 - 2 - 3B · LOW KICK`.
 *  - speech — what the voice coach says. Number words, never digits.
 *  - segments — for two-tone rendering (gold numbers, violet words).
 */
export function formatCall(comboText, style = 'names') {
  const styleId = callStyleOf(style).id;
  const segments = tokenize(comboText);
  const asNames = () => ({
    display: String(comboText || ''), speech: String(comboText || ''), segments, numeric: false,
  });

  if (styleId === 'names') return asNames();

  // NUMBERS is a BOXING call system and never mixes alphabets. A half-and-half
  // call — "1 · SLIP · 2", "1 · LOW KICK" — was the single most confusing
  // thing in playtest: the eye reads digits and words as two languages in one
  // instruction. So a combo is called numerically ONLY when every strike in it
  // is a numbered punch; the moment it contains a kick, knee, elbow, sprawl or
  // defensive word it is called by NAME in full instead. Boxing pools are
  // ~2/3 pure punches, so numbers show up constantly there; kickboxing and MMA
  // pools are mostly kicks, so those rounds stay in words — which is honest,
  // since no numbering for kicks is standard across gyms.
  const allNumbered = segments.length > 0 && segments.every((seg) => seg.kind === 'num');
  if (!allNumbered) return asNames();

  const display = segments.map((seg, i) => (i === 0 ? seg.num : ' - ' + seg.num)).join('');
  const speech = segments.map((seg) => seg.speech).join(', ');
  return { display, speech, segments, numeric: true };
}

/** The number badge for a single technique/lesson name, or null. */
export function numberForStrike(name) {
  const t = String(name || '').trim();
  const key = ALIASES[t] || t;
  return NUMBERED[key]?.num || null;
}

// The 1–8 walk for the KNOW YOUR NUMBERS drill, in count order.
export const NUMBER_DRILL = ['Jab', 'Cross', 'Lead Hook', 'Rear Hook', 'Lead Uppercut', 'Rear Uppercut', 'Lead Overhand', 'Rear Overhand']
  .map((k) => ({ ...NUMBERED[k] }));
