// What Combo Coach deals at each level: the mix.
//
// The owner's words: a level 1 athlete has no reason to do a 10-punch combo.
// Level 1 gets single punches and short combos, never more than 4 pieces. The
// middle gets longer combos, up to 7, with the odd difficult kick. The top
// swings between single, mid-tier and harder combos in one session.
//
// Pure: no storage, no clock, no randomness of its own (the dealer takes its
// random numbers from an rng argument). The athlete's tier comes from
// data/athleteLevel.js (the Fight side); this module is what a tier DEALS. The
// table below is the one place the numbers live: the dealer, the setup copy,
// the Level page and the tests all read it.
import COMBO_POOL from './comboCoachData';

// ── The table ───────────────────────────────────────────────────────────────
// weights       the share of calls (out of 100, in steps of 5) that come from
//               each pool tier, a combo's minDifficulty in comboCoachData. A
//               source with weight 0 is never dealt at that level.
// singleShare   of the calls from the EASY pool, the % that are a single strike
//               (category 'single': Jab, Cross, Teep...). The rest are the short
//               basic combos. A discipline with no singles deals basics.
// maxPieces     the longest combo this level is dealt, counted by pieceCount()
//               (null: no limit, the whole pool).
// maxHardKicks  the most combos with a difficult kick in ONE round (see
//               DIFFICULT_KICKS). 0 is none at all, null no limit.
// swing         the round must jump between bands: single and basic (easy),
//               mid-tier (normal), hard and advanced. No more than SWING_RUN_MAX
//               calls in a row from one band.
//
//   EASY      levels 1-2. Easy pool only: single strikes and short combos.
//   NORMAL    levels 3-5. Mostly normal, some easy, a share of hard and a few
//             advanced, capped at 7 pieces and 2 difficult-kick combos a round.
//   HARD      levels 6-9. Mostly hard, with normal and advanced in the mix.
//   ADVANCED  level 10 and up. Swings: 10 single and basic, 20 mid-tier, 70 hard
//             and advanced (the advanced pool leads), so a round jumps around.
// Progress is real: the share of advanced combos is 0, 10, 20 and 50, and the
// average combo tier rises at every step (test-combo-mix checks both).
export const COMBO_MIX = {
  EASY:     { weights: { easy: 100, normal: 0,  hard: 0,  advanced: 0  }, singleShare: 30, maxPieces: 4,    maxHardKicks: 0,    swing: false },
  NORMAL:   { weights: { easy: 20,  normal: 50, hard: 20, advanced: 10 }, singleShare: 20, maxPieces: 7,    maxHardKicks: 2,    swing: false },
  HARD:     { weights: { easy: 0,   normal: 30, hard: 50, advanced: 20 }, singleShare: 0,  maxPieces: null, maxHardKicks: null, swing: false },
  ADVANCED: { weights: { easy: 10,  normal: 20, hard: 20, advanced: 50 }, singleShare: 50, maxPieces: null, maxHardKicks: null, swing: true },
};
// The pool tiers, easiest first (a combo's minDifficulty).
export const SOURCE_TIERS = ['easy', 'normal', 'hard', 'advanced'];
export const DISCIPLINES = ['boxing', 'kickboxing', 'muay-thai', 'mma'];
// The dealer works in decks of this many calls, so every 20 calls hold the table's
// shares exactly (a weight of 5 is one card).
export const DECK_SIZE = 20;
// A swing round never runs more than this many calls in a row from one band.
export const SWING_RUN_MAX = 3;

// ── pieces ──────────────────────────────────────────────────────────────────
// A combo's pieces are the moves the athlete performs in order. Strikes count
// (punches, kicks, knees, elbows, ground strikes), and so do defence words
// (Slip, Roll, Feint, Pivot, Pull, Parry, Check, Counter) and movement words
// (Sprawl, Level Change, Clinch, Exit...): every one is a thing to remember and
// do. DEFENCE COUNTS. That is the stricter reading of the owner's "no more than
// 4", and it keeps the Level page honest: strikes never outnumber pieces, so
// "up to N strikes" is true of anything the cap lets through. (In the real pool
// 104 of 275 combos hold a defence or movement word.)
//  - Two-word strikes are one piece: Low Kick, Body Hook, Switch Kick, High
//    Kick, Lead Uppercut, Spinning Back Kick, Question Mark Kick...
//  - "Double" doubles the strike after it: Double Jab is two pieces, Double Low
//    Kick two more. This matches strikeNumbering's call of "1, 1".
//  - Modifier words (Body, Head, Lead, Rear, Step, Spinning...) belong to the
//    strike after them: Step Knee is one piece. A modifier with nothing after it
//    counts as a piece of its own, and a word the list does not know counts as
//    one piece too, so a new word can only make a combo longer, never sneak
//    through shorter than it is.
//  - Pull Counter, Check Counter, Catch Kick and Feint Shot are one piece each:
//    the second word names the move, it is not another one.
//  - Hook Kick (the spinning technique) is one piece only as a whole call; in a
//    combo "Hook Kick" is a hook then a kick, two pieces, never fewer than it reads.
const STRIKES = [
  'Spinning Back Kick', 'Spinning Back Elbow', 'Spinning Back Fist', 'Spinning Backfist', 'Spinning Heel Kick',
  'Spinning Elbow', 'Spinning Kick', 'Question Mark Kick', 'Superman Punch', 'Bolo Punch', 'Flying Knee',
  'Jumping Elbow', 'Jumping Kick', 'Switch Kick', 'Body Kick', 'High Kick', 'Head Kick', 'Low Kick', 'Lead Kick',
  'Rear Kick', 'Hook Kick', 'Axe Kick', 'Wheel Kick', 'Oblique Kick', 'Tornado Kick', 'Check Hook', 'Shovel Hook',
  'Body Jab', 'Body Cross', 'Body Hook', 'Rear Body Hook', 'Body Uppercut', 'Lead Hook', 'Rear Hook',
  'Lead Uppercut', 'Rear Uppercut', 'Lead Overhand', 'Rear Overhand', 'Rear Roundhouse', 'Lead Knee', 'Rear Knee',
  'Lead Elbow', 'Rear Elbow', 'Ground Knee', 'Ground Pound', 'Roundhouse', 'Uppercut', 'Overhand', 'Teep',
  'Knee', 'Elbow', 'Hook', 'Cross', 'Jab', 'Kick',
];
const DEFENCE = [
  'Pull Counter', 'Check Counter', 'Catch Kick', 'Feint Shot', 'Slip', 'Roll', 'Pivot', 'Pull', 'Parry', 'Check',
  'Feint', 'Counter',
];
const MOVES = [
  'Level Change', 'Fake Shot', 'Step Back', 'Circle Out', 'Sprawl', 'Clinch', 'Push', 'Exit', 'Frame', 'Sweep',
  'Throw', 'Pass', 'Break', 'Shot',
];
const MODIFIERS = ['Body', 'Head', 'Lead', 'Rear', 'Step', 'Spinning', 'Flying', 'Jumping', 'High', 'Low'];

// Longest phrase first, so Low Kick wins over Kick and Catch Kick over both.
const VOCAB = [
  ...STRIKES.map(text => ({ text, kind: 'strike' })),
  ...DEFENCE.map(text => ({ text, kind: 'defence' })),
  ...MOVES.map(text => ({ text, kind: 'move' })),
].map(v => ({ ...v, words: v.text.toLowerCase().split(' ') })).sort((a, b) => b.words.length - a.words.length);
const MODIFIER_SET = new Set(MODIFIERS.map(m => m.toLowerCase()));

function matchAt(words, i) {
  for (const v of VOCAB) {
    if (i + v.words.length > words.length) continue;
    // Hook Kick is the one technique name that reads as two moves inside a
    // combo (Cross, Hook, Kick), so it is one piece only when it is the whole call.
    if (v.text === 'Hook Kick' && !(i === 0 && words.length === 2)) continue;
    let ok = true;
    for (let k = 0; k < v.words.length; k += 1) if (words[i + k] !== v.words[k]) { ok = false; break; }
    if (ok) return v;
  }
  return null;
}

// The pieces of a combo, in order: [{ text, kind }], kind 'strike' | 'defence' | 'move' | 'other'.
export function piecesOf(comboText) {
  const words = String(comboText ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  const out = [];
  let i = 0;
  while (i < words.length) {
    const w = words[i];
    const hit = matchAt(words, i);
    if (hit) {
      out.push({ text: hit.text, kind: hit.kind });
      i += hit.words.length;
      continue;
    }
    // Double + the strike after it: two pieces.
    if (w === 'double') {
      const next = matchAt(words, i + 1);
      if (next && next.kind === 'strike') {
        out.push({ text: next.text, kind: 'strike' }, { text: next.text, kind: 'strike' });
        i += 1 + next.words.length;
        continue;
      }
    }
    // A modifier joins the strike after it.
    if (MODIFIER_SET.has(w)) {
      const next = matchAt(words, i + 1);
      if (next && next.kind === 'strike') {
        out.push({ text: `${w} ${next.text}`, kind: 'strike' });
        i += 1 + next.words.length;
        continue;
      }
    }
    out.push({ text: w, kind: 'other' });
    i += 1;
  }
  return out;
}
// How long a combo is: strikes, defence and movement words together.
export const pieceCount = (comboText) => piecesOf(comboText).length;
// How many of those are strikes thrown.
export const strikeCount = (comboText) => piecesOf(comboText).filter(p => p.kind === 'strike').length;

// ── difficult kicks ─────────────────────────────────────────────────────────
// The owner's list: high, head, switch, spinning and jumping kicks. Spinning
// and flying strikes that are not kicks (Spinning Backfist, Flying Knee,
// Superman Punch...) are on the list too: they are just as hard, so the cap is
// never looser than it sounds. Everything else is an ordinary kick (Low Kick,
// Body Kick, Lead Kick, Rear Kick, Roundhouse, Teep, a plain Kick).
export const DIFFICULT_KICKS = [
  'High Kick', 'Head Kick', 'Switch Kick',
  'Spinning Back Kick', 'Spinning Heel Kick', 'Spinning Kick', 'Tornado Kick', 'Wheel Kick',
  'Question Mark Kick', 'Hook Kick', 'Axe Kick', 'Jumping Kick',
  'Spinning Back Elbow', 'Spinning Elbow', 'Spinning Back Fist', 'Spinning Backfist',
  'Flying Knee', 'Jumping Elbow', 'Superman Punch', 'Bolo Punch',
];
const DIFFICULT_SET = new Set(DIFFICULT_KICKS.map(k => k.toLowerCase()));
const bare = (text) => String(text).toLowerCase().replace(/^(lead|rear|step|head|body)\s+(?=.)/, '');
// Is this piece a difficult kick (DIFFICULT_KICKS)?
export const isDifficultPiece = (piece) => piece.kind === 'strike' && (DIFFICULT_SET.has(piece.text.toLowerCase()) || DIFFICULT_SET.has(bare(piece.text)));
// Does a combo hold one? The cap counts combos, not kicks.
export const isDifficult = (comboText) => piecesOf(comboText).some(isDifficultPiece);

// ── what a tier deals ───────────────────────────────────────────────────────
const ALIAS = { MEDIUM: 'NORMAL', INTERMEDIATE: 'NORMAL' };
// 'EASY' / 'Normal' / 'MEDIUM' / 'Advanced' as a tier id. What is not one reads
// as NORMAL, the same fallback the generator has always had.
export function comboTierId(t) {
  const w = String(t ?? '').trim().toUpperCase();
  const id = ALIAS[w] || w;
  return COMBO_MIX[id] ? id : 'NORMAL';
}
// The rule for a tier, for the dealer, the setup copy and the Level page.
export const mixFor = (tier) => { const id = comboTierId(tier); return { tier: id, ...COMBO_MIX[id] }; };
const capped = (n) => n !== null && n !== undefined;

// One discipline's pool, ready to deal: pieces, source tier and flags worked
// out once. `pool` is COMBO_POOL (or any list of the same shape).
export function prepareCombos(pool, discipline) {
  const out = [];
  for (const c of Array.isArray(pool) ? pool : []) {
    if (!c || c.discipline !== discipline) continue;
    out.push({
      id: c.id, text: c.comboText, source: SOURCE_TIERS.includes(c.minDifficulty) ? c.minDifficulty : 'normal',
      single: c.category === 'single', pieces: pieceCount(c.comboText), strikes: strikeCount(c.comboText), hard: isDifficult(c.comboText),
    });
  }
  return out;
}
// What a tier may ever draw from: a source with weight, no combo past the piece
// cap, and none with a difficult kick where the cap is 0.
export function tierPool(prepared, tier) {
  const m = mixFor(tier);
  return prepared.filter(c => m.weights[c.source] > 0 && (!capped(m.maxPieces) || c.pieces <= m.maxPieces) && !(m.maxHardKicks === 0 && c.hard));
}

// Whole preparations of the real pool, one per discipline (built once).
let PREPARED = null;
export function preparedPool() {
  if (!PREPARED) PREPARED = Object.fromEntries(DISCIPLINES.map(d => [d, prepareCombos(COMBO_POOL, d)]));
  return PREPARED;
}

// The longest combo a tier can really be dealt, over all four disciplines:
// { pieces, strikes, hardKicks } where hardKicks is the cap (null: no limit).
// "Up to N" on the Level page is this, so the page never promises a combo
// that cannot come.
const REACH = {};
export function comboReach(tier) {
  const m = mixFor(tier);
  if (!REACH[m.tier]) {
    let pieces = 0, strikes = 0;
    for (const d of DISCIPLINES) for (const c of tierPool(preparedPool()[d], m.tier)) { pieces = Math.max(pieces, c.pieces); strikes = Math.max(strikes, c.strikes); }
    REACH[m.tier] = { pieces, strikes, hardKicks: m.maxHardKicks };
  }
  return REACH[m.tier];
}
// The share of calls from the advanced pool, out of 10, for the Level page.
export const advancedInTen = (tier) => Math.round(mixFor(tier).weights.advanced / 10);

// ── the dealer ──────────────────────────────────────────────────────────────
function shuffleWith(list, rng) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
// A draw-without-replacement deck of combos. Reshuffles when empty and never
// deals the same one twice across the seam. `avoid` (a set of texts) is steered
// around when anything else is left; `banned` is never dealt (null if nothing
// else is left), and a banned combo stays in the deck, so a difficult kick
// waits for its turn instead of being spent on a round that has no room.
function makeDeck(items, rng) {
  let rest = shuffleWith(items, rng);
  let last = null;
  return (avoid, banned) => {
    if (!items.length) return null;
    if (!rest.length) {
      rest = shuffleWith(items, rng);
      if (items.length > 1 && rest[0] === last) rest.push(rest.shift());
    }
    const no = (c) => !!banned && banned.has(c.text);
    let idx = avoid && avoid.size ? rest.findIndex(c => !avoid.has(c.text) && !no(c)) : -1;
    if (idx < 0) idx = rest.findIndex(c => !no(c));
    if (idx < 0) return null;
    last = rest.splice(idx, 1)[0];
    return last;
  };
}
// How many of the DECK_SIZE cards each live source gets (largest remainder, so
// the counts add up and a full table gives weight / 5 exactly).
function cardCounts(weights, live) {
  const sum = live.reduce((s, k) => s + weights[k], 0);
  if (!sum) return Object.fromEntries(live.map(k => [k, 0]));
  const raw = live.map(k => ({ k, v: (weights[k] / sum) * DECK_SIZE }));
  const counts = Object.fromEntries(raw.map(r => [r.k, Math.floor(r.v)]));
  let left = DECK_SIZE - Object.values(counts).reduce((s, n) => s + n, 0);
  for (const r of [...raw].sort((a, b) => (b.v - Math.floor(b.v)) - (a.v - Math.floor(a.v)))) { if (left <= 0) break; counts[r.k] += 1; left -= 1; }
  return counts;
}
const bandOf = (s) => (s === 'easy' ? 0 : s === 'normal' ? 1 : 2);

// One deck of source cards in dealing order. A swing deck keeps every run of one
// band to SWING_RUN_MAX, counting on from the end of the last deck (`run`). Each
// pick is only taken if the cards still to come can be arranged within that
// limit (a band of R cards needs a break after at most every SWING_RUN_MAX),
// so the deck never paints itself into a corner.
function sourceDeck(counts, rng, swing, run) {
  const left = { ...counts };
  const out = [];
  let lastBand = run.band, n = run.n;
  const feasible = (after, band, len) => {
    const total = Object.values(after).reduce((s, c) => s + c, 0);
    for (const b of [0, 1, 2]) {
      const rb = SOURCE_TIERS.reduce((s, k) => (bandOf(k) === b ? s + (after[k] || 0) : s), 0);
      const first = band === b ? SWING_RUN_MAX - len : SWING_RUN_MAX;
      if (rb > Math.max(0, first) + SWING_RUN_MAX * (total - rb)) return false;
    }
    return true;
  };
  for (let i = 0; i < DECK_SIZE; i += 1) {
    let keys = Object.keys(left).filter(k => left[k] > 0);
    if (!keys.length) break;
    if (swing) {
      const ok = keys.filter(k => {
        const b = bandOf(k);
        const len = b === lastBand ? n + 1 : 1;
        if (len > SWING_RUN_MAX) return false;
        return feasible({ ...left, [k]: left[k] - 1 }, b, len);
      });
      if (ok.length) keys = ok;
    }
    const total = keys.reduce((s, k) => s + left[k], 0);
    let r = rng() * total, pick = keys[keys.length - 1];
    for (const k of keys) { r -= left[k]; if (r < 0) { pick = k; break; } }
    left[pick] -= 1;
    out.push(pick);
    const b = bandOf(pick);
    if (b === lastBand) n += 1; else { lastBand = b; n = 1; }
  }
  run.band = lastBand; run.n = n;
  return out;
}

// Deal one round for a tier: `count` calls, as combo items (see prepareCombos).
//  - Calls come from decks of 20 built to the table, so every 20 calls hold the
//    table's shares exactly (renormalised over the sources that have combos).
//  - Inside a source, combos come from a draw-without-replacement deck and
//    never repeat inside a short window (a quarter of the pool, at most 11).
//  - EASY-source calls are a single strike singleShare % of the time, unless
//    that side of the pool is spent for the round and the other is not.
//  - A round holds at most maxHardKicks combos with a difficult kick. They are
//    spread through the round (the first opens a third of the way in, the second
//    two thirds), and past the cap the call is redrawn calm from the same source.
//  - A swing tier never runs more than SWING_RUN_MAX calls from one band.
// A source with no usable combos is left out, so a round is never short and
// never stalls. `prepared` is one discipline's prepareCombos list, which the
// caller may have narrowed (an arsenal gate).
export function dealMixItems({ prepared, tier, count, rng = Math.random }) {
  const m = mixFor(tier);
  const usable = tierPool(prepared, m.tier);
  const n = Math.max(0, Math.floor(count));
  if (!usable.length || !n) return [];
  const bySource = Object.fromEntries(SOURCE_TIERS.map(s => [s, usable.filter(c => c.source === s)]));
  const live = SOURCE_TIERS.filter(s => m.weights[s] > 0 && bySource[s].length);
  const decks = {};
  for (const s of live) {
    decks[s] = s === 'easy'
      ? { single: makeDeck(bySource.easy.filter(c => c.single), rng), basic: makeDeck(bySource.easy.filter(c => !c.single), rng) }
      : makeDeck(bySource[s], rng);
  }
  const calmAll = usable.filter(c => !c.hard);
  const hardSet = new Set(usable.filter(c => c.hard).map(c => c.text));
  const window = Math.max(1, Math.min(11, Math.floor(usable.length / 4)));
  const counts = cardCounts(m.weights, live);
  const out = [];
  const recent = new Set();
  const heard = new Set(); // every combo dealt so far in this round
  const run = { band: -1, n: 0 };
  let cards = [];
  // A capped round opens its difficult-kick slots evenly: with 2 in a round of
  // 36 calls, the first from call 12 and the second from call 24.
  const cap = capped(m.maxHardKicks) ? m.maxHardKicks : Infinity;
  const slots = Number.isFinite(cap) ? Array.from({ length: cap }, (_, j) => Math.floor((n * (j + 1)) / (cap + 1))) : [];
  let hardUsed = 0;
  // A pool with nothing calm in it (only difficult-kick combos) cannot honour the
  // cap, so the cap stays open: the round is dealt rather than stalled.
  const noCalm = calmAll.length === 0;
  // However it goes, the loop ends: a round is dealt in at most this many draws.
  for (let guard = 0; out.length < n && guard < n * 20 + 200; guard += 1) {
    if (!cards.length) cards = sourceDeck(counts, rng, m.swing, run);
    if (!cards.length) break;
    const source = cards.shift();
    const hardOpen = noCalm || !Number.isFinite(cap) || (hardUsed < cap && out.length >= slots[hardUsed]);
    const banned = hardOpen ? null : hardSet;
    let pick;
    if (source === 'easy') {
      const d = decks.easy;
      let wantSingle = rng() * 100 < m.singleShare;
      // The single and basic decks are small and separate, so a round that
      // rolls more singles than there are singles would replay one while
      // basics sit unplayed. Once one deck has nothing fresh for this round,
      // take the other: a repeat only comes when the pool forces it.
      const fresh = (list) => list.some(c => !heard.has(c.text) && !(banned && banned.has(c.text)));
      const singles = bySource.easy.filter(c => c.single), basics = bySource.easy.filter(c => !c.single);
      if (wantSingle && !fresh(singles) && fresh(basics)) wantSingle = false;
      else if (!wantSingle && !fresh(basics) && fresh(singles)) wantSingle = true;
      pick = (wantSingle ? d.single(recent, banned) : d.basic(recent, banned)) || d.basic(recent, banned) || d.single(recent, banned);
    } else {
      pick = decks[source](recent, banned);
    }
    if (!pick) {
      // Nothing calm left in that source's deck while the round has no room for
      // a difficult kick: a calm combo of the same source that was not just
      // played, else any calm one of the tier.
      const same = bySource[source].filter(c => !c.hard && !recent.has(c.text));
      const any = calmAll.filter(c => !recent.has(c.text));
      const from = same.length ? same : any.length ? any : calmAll;
      if (from.length) pick = from[Math.floor(rng() * from.length)];
    }
    if (!pick) continue;
    out.push(pick);
    if (pick.hard) hardUsed += 1;
    recent.add(pick.text);
    heard.add(pick.text);
    if (recent.size > window) recent.delete(recent.values().next().value);
  }
  return out;
}
// The same round as combo texts, which is what the player consumes.
export const dealMixRound = (o) => dealMixItems(o).map(c => c.text);

// Hold a list of calls to a tier's caps, in order: a combo past the piece cap,
// or one with a difficult kick once the round already holds its maximum, is
// swapped for a calm combo from `fill` (texts). For modes that deal their own
// way (Technical): the mix itself never needs it. A list with nothing calm to
// swap in is returned as it is.
export function capCalls(calls, tier, { fill = [], rng = Math.random } = {}) {
  const m = mixFor(tier);
  if (!capped(m.maxPieces) && !capped(m.maxHardKicks)) return calls;
  const ok = [...new Set(fill)].filter(t => (!capped(m.maxPieces) || pieceCount(t) <= m.maxPieces) && !isDifficult(t));
  let hard = 0;
  return calls.map((c, i) => {
    const tooLong = capped(m.maxPieces) && pieceCount(c) > m.maxPieces;
    const isHard = isDifficult(c);
    const overHard = isHard && capped(m.maxHardKicks) && hard >= m.maxHardKicks;
    if (!tooLong && !overHard) { if (isHard) hard += 1; return c; }
    const prev = calls[i - 1];
    const free = ok.filter(t => t !== prev);
    const from = free.length ? free : ok;
    return from.length ? from[Math.floor(rng() * from.length)] : c;
  });
}
