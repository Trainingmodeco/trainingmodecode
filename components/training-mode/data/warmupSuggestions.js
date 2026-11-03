// Build Workout warm-up ideas — what the chips under the ring timer offer.
//
// They are suggestions, not a routine: picking one only changes the ring's
// caption and the cue line (and says it once). Nothing is counted, nothing is
// timed per move and nothing is enforced; the ring clock is the only rule.
// The old follow-along counted every rep out loud and always opened with ten
// jumping jacks, which is exactly what the owner asked to get rid of.
//
// `say` is the one line the coach speaks when the chip is picked.
export const WARMUP_SUGGESTIONS = [
  { id: 'run', label: 'LIGHT RUN', emoji: '🏃', cue: 'Easy jog: in place or out the door. Talk-test pace.', say: 'Light run. Easy pace, you should be able to talk.' },
  { id: 'jacks', label: 'JUMPING JACKS', emoji: '🤸', cue: 'Steady rhythm, light on the feet. Rest whenever.', say: 'Jumping jacks. Steady rhythm, rest whenever you like.' },
  { id: 'mobility', label: 'MOBILITY', emoji: '🔄', cue: 'Arm circles · hip circles · leg swings · torso twists.', say: 'Mobility. Arm circles, hip circles, leg swings and torso twists.' },
  { id: 'shadow', label: 'SHADOWBOX', emoji: '🥊', cue: 'Loose hands, bounce on the feet, easy punches.', say: 'Shadowbox. Loose hands, bounce on your feet, easy punches.' },
];

const UPPER = ['chest', 'back', 'shoulders', 'biceps', 'triceps'];
const LOWER = ['quads', 'hamstrings', 'glutes', 'calves'];

// Chip order follows what is about to be trained: a lower-body day leads with
// the run, an upper-body day with mobility (shoulders and spine first), and a
// day that is both opens with the run and puts mobility right behind it.
const ORDER = {
  lower: ['run', 'jacks', 'mobility', 'shadow'],
  upper: ['mobility', 'shadow', 'jacks', 'run'],
  both: ['run', 'mobility', 'jacks', 'shadow'],
  other: ['run', 'jacks', 'mobility', 'shadow'],
};

export function warmupSuggestionsFor(muscleGroups = []) {
  const mg = (muscleGroups || []).map(m => String(m).toLowerCase());
  const upper = mg.some(m => UPPER.includes(m));
  const lower = mg.some(m => LOWER.includes(m));
  const key = upper && lower ? 'both' : lower ? 'lower' : upper ? 'upper' : 'other';
  return ORDER[key].map(id => WARMUP_SUGGESTIONS.find(s => s.id === id));
}
