// Rush Mode call generation (46b). During a surge the coach CALLS work, not
// just hype: explosive bodyweight movements, strike combos, or both, per the
// athlete's CALL MIX pick in the Rush modal. Timing of the surges themselves
// stays in shared/rushSchedule.js — this module only decides WHAT gets called.
//
// Generation rules (46b):
//   · EXPLOSIVE — fully random from the pool below (shuffle-bag, so every move
//     is heard before any repeats and nothing lands back-to-back).
//   · STRIKES  — 50% freestyle (a short combo assembled live from the
//     discipline's strike vocabulary) / 50% discipline-specific (a signature
//     combo of that discipline).
//   · BOTH     — alternates explosive ↔ strikes.
// A push line ("Empty the tank!") lands every third call so the surge keeps
// its hype without the coach nagging.

import { disciplineSlug } from './arsenal';

// ── Explosive movement pool ─────────────────────────────────────────────────
// `d` = discipline filter: kick/knee/takedown moves stay out of pure-boxing
// sessions. No tag = every discipline gets it.
const KICK_SPORTS = ['kickboxing', 'muay-thai', 'mma'];
export const EXPLOSIVE_MOVES = [
  { call: 'Jump squats' },
  { call: 'Burpees' },
  { call: 'Tuck jumps' },
  { call: 'Clap push-ups' },
  { call: 'Running high knees' },
  { call: 'Sprawls' },
  { call: 'Machine gun kicks', d: KICK_SPORTS },
  { call: 'Check kicks — alternate legs', d: KICK_SPORTS },
  { call: 'Mountain climbers' },
  { call: 'Squat thrusts' },
  { call: 'Jumping lunges' },
  { call: 'Star jumps' },
  { call: 'Plyo push-ups' },
  { call: 'Broad jump — back-pedal' },
  { call: 'Skater bounds' },
  { call: 'Fast feet' },
  { call: 'Plank jacks' },
  { call: 'Burpee tuck jumps' },
  { call: 'Split jumps' },
  { call: '180 jump squats' },
  { call: 'Up-downs' },
  { call: 'Power skips' },
  { call: 'Lateral bounds' },
  { call: 'Speed squats' },
  { call: 'Push-up to shoulder tap' },
  { call: 'Shadow sprint in place' },
  { call: 'Drop and pop' },
  { call: 'Switch knees', d: KICK_SPORTS },
  { call: 'Flying knee bursts', d: KICK_SPORTS },
  { call: 'Sprawl to jump', d: ['mma'] },
];

export function explosivePoolFor(discipline) {
  const slug = disciplineSlug(discipline);
  return EXPLOSIVE_MOVES.filter(m => !m.d || m.d.includes(slug)).map(m => m.call);
}

// ── Strike vocabulary (freestyle side) ──────────────────────────────────────
const STRIKE_VOCAB = {
  boxing: ['Jab', 'Cross', 'Lead hook', 'Rear hook', 'Lead uppercut', 'Rear uppercut', 'Body jab', 'Body cross'],
  kickboxing: ['Jab', 'Cross', 'Lead hook', 'Rear hook', 'Low kick', 'Head kick', 'Switch kick', 'Front kick', 'Body cross'],
  'muay-thai': ['Jab', 'Cross', 'Lead hook', 'Elbow', 'Rear elbow', 'Knee', 'Switch knee', 'Teep', 'Low kick', 'Head kick'],
  mma: ['Jab', 'Cross', 'Lead hook', 'Rear hook', 'Low kick', 'Knee', 'Elbow', 'Level change', 'Overhand'],
};

// Signature combos (discipline-specific side) — the strings a coach of THAT
// sport would actually call.
const SIGNATURE_COMBOS = {
  boxing: [
    'Jab, jab, cross',
    'Jab, cross, lead hook',
    'Cross, lead hook, cross',
    'Jab, body cross, lead hook',
    'Double jab, cross, roll, cross',
    'Jab, cross, lead uppercut, cross',
  ],
  kickboxing: [
    'Jab, cross, low kick',
    'Cross, lead hook, low kick',
    'Jab, cross, switch kick',
    'Low kick, cross, lead hook',
    'Jab, cross, lead hook, head kick',
    'Double jab, cross, low kick',
  ],
  'muay-thai': [
    'Jab, cross, elbow',
    'Cross, switch knee',
    'Teep, cross, low kick',
    'Jab, cross, knee, elbow',
    'Low kick, low kick, head kick',
    'Cross, lead hook, rear knee',
  ],
  mma: [
    'Jab, cross, level change',
    'Cross, lead hook, low kick',
    'Overhand, knee',
    'Jab, cross, sprawl',
    'Level change, cross, lead hook',
    'Jab, low kick, cross, elbow',
  ],
};

const PUSH_LINES = [
  "Give it everything you've got!",
  'Empty the tank!',
  'Push the pace — faster!',
  "Don't slow down now!",
  'Leave nothing behind!',
];

function shuffled(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Shuffle-bag that never repeats back-to-back across refills.
function bag(items) {
  let pool = [];
  let last = null;
  return () => {
    if (pool.length === 0) {
      pool = shuffled(items);
      if (pool.length > 1 && pool[0] === last) [pool[0], pool[1]] = [pool[1], pool[0]];
    }
    last = pool.shift();
    return last;
  };
}

// Freestyle: assemble a live 2–4 strike combo from the discipline vocabulary,
// no doubled strike inside one call.
function freestyleCombo(vocab) {
  const len = 2 + Math.floor(Math.random() * 3);
  const pool = shuffled(vocab);
  return pool.slice(0, len).join(', ');
}

export const RUSH_MIXES = [
  { id: 'explosive', label: 'EXPLOSIVE', sub: 'Burpees, tuck jumps, sprawls — random explosive movements.' },
  { id: 'strikes', label: 'STRIKES', sub: 'All-out combos — half freestyle, half your discipline’s signatures.' },
  { id: 'both', label: 'BOTH', sub: 'Alternates explosive movements with strike combos.' },
];

export function rushMixLabel(id) {
  return (RUSH_MIXES.find(m => m.id === id) || RUSH_MIXES[0]).label;
}

// The caller both timers hold in a ref. Same nextLine()/reset() surface as the
// old push-line-only createRushVoice, so the surge loop code doesn't change.
// `strikePool`: the session's own combo pool (Combo Coach) — when present it
// becomes the discipline-specific half so rush calls match what the athlete
// has been drilling.
export function createRushCaller({ mix = 'explosive', discipline = 'boxing', strikePool = [] } = {}) {
  const slug = disciplineSlug(discipline);
  const vocab = STRIKE_VOCAB[slug] || STRIKE_VOCAB.boxing;
  const signatures = (Array.isArray(strikePool) && strikePool.length >= 4)
    ? strikePool.filter(s => typeof s === 'string')
    : (SIGNATURE_COMBOS[slug] || SIGNATURE_COMBOS.boxing);

  let nextExplosive = bag(explosivePoolFor(discipline));
  let nextSignature = bag(signatures);
  let nextPush = bag(PUSH_LINES);
  let n = 0;

  const strikeCall = () => (Math.random() < 0.5 ? freestyleCombo(vocab) : nextSignature());
  const workCall = () => {
    if (mix === 'strikes') return strikeCall();
    if (mix === 'both') return n % 2 === 0 ? nextExplosive() : strikeCall();
    return nextExplosive();
  };

  return {
    nextLine() {
      n += 1;
      // Every third call is hype, the rest are work.
      if (n % 3 === 0) return nextPush();
      return `${workCall()} — go!`;
    },
    reset() {
      n = 0;
      nextExplosive = bag(explosivePoolFor(discipline));
      nextSignature = bag(signatures);
      nextPush = bag(PUSH_LINES);
    },
  };
}
