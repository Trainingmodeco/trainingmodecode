const BW_EQUIPMENT = ['bodyweight', 'none'];

const BW_KEYWORDS = [
  'push-up', 'pushup', 'pull-up', 'pullup', 'squat', 'lunge', 'burpee',
  'plank', 'crunch', 'sit-up', 'situp', 'dip', 'mountain climber',
  'jump squat', 'pike', 'hindu', 'dive bomber', 'superman', 'bodyweight row',
  'shoulder tap', 'leg raise', 'flutter kick', 'bicycle', 'v-up',
];

export function isBodyweightExercise(exercise) {
  if (!exercise) return false;
  const eq = (exercise.equipment || '').toLowerCase().trim();
  if (eq === 'weighted' || eq === 'dumbbell' || eq === 'barbell' || eq === 'kettlebell' || eq === 'machine' || eq === 'cable') {
    return false;
  }
  if (BW_EQUIPMENT.includes(eq)) return true;
  const name = (exercise.name || '').toLowerCase();
  return BW_KEYWORDS.some(kw => name.includes(kw));
}

export function hasNumericReps(exercise) {
  if (!exercise || !exercise.reps) return false;
  const r = String(exercise.reps);
  if (r.endsWith('s')) return false;
  return /\d/.test(r);
}

export function parseTargetReps(repsStr) {
  if (!repsStr) return 10;
  const s = String(repsStr);
  const match = s.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (match) return Math.round((Number(match[1]) + Number(match[2])) / 2);
  const num = parseInt(s, 10);
  return isNaN(num) ? 10 : num;
}
