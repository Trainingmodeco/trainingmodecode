// The answers the setup questionnaire asks for, shared with Profile's edit
// screen so "change every answer later" changes the SAME answer.
//
// They drifted apart once: Profile offered LOSE WEIGHT / BUILD MUSCLE /
// COMPETE and BEGINNER / INTERMEDIATE / ADVANCED, and saved them as-is — but
// Home's pick, the beginner checks and the Practice posters all read the
// questionnaire's values. One edit in Profile quietly switched them off.
// normalizeGoal / normalizeExperience map those old values forward, and
// loadProfile applies them, so profiles saved the old way read correctly.

export const GOALS = [
  'Get Fit',
  'Learn Combat Basics',
  'Build Fight Conditioning',
  'Lose Weight',
  'Build Strength',
  'Train Like a Fighter',
];

// Goals whose first workout is on the Fit side. Build Fight Conditioning
// lands on Combat Conditioning, which the Fit suggestions already handle.
export const FIT_GOALS = new Set(['Get Fit', 'Lose Weight', 'Build Strength', 'Build Fight Conditioning']);

export const LEVELS = [
  { id: 'Beginner', label: 'Beginner', desc: 'New to training' },
  { id: 'Some Training', label: 'Some Training', desc: '3–6 months' },
  { id: 'Experienced', label: 'Experienced', desc: '1+ years' },
  { id: 'Advanced', label: 'Advanced', desc: '3+ years' },
];

// The four discipline tabs. Saved as profile.discipline, which Fight Mode,
// Practice and Combat Conditioning all open on.
export const DISCIPLINE_CHOICES = ['Boxing', 'Kickboxing', 'Muay Thai', 'MMA'];

const LEGACY_GOALS = {
  'LOSE WEIGHT': 'Lose Weight',
  'BUILD MUSCLE': 'Build Strength',
  'GET FASTER': 'Get Fit',
  COMPETE: 'Train Like a Fighter',
};
const LEGACY_LEVELS = {
  BEGINNER: 'Beginner',
  // The old three-step scale's middle. Mapped to the cautious side: it keeps
  // the beginner-friendly picks for anyone who never really chose.
  INTERMEDIATE: 'Some Training',
  ADVANCED: 'Advanced',
};

export function normalizeGoal(v) {
  if (!v) return '';
  if (GOALS.includes(v)) return v;
  const up = String(v).toUpperCase();
  return LEGACY_GOALS[up] || GOALS.find(g => g.toUpperCase() === up) || '';
}

export function normalizeExperience(v) {
  if (!v) return '';
  if (LEVELS.some(l => l.id === v)) return v;
  const up = String(v).toUpperCase();
  return LEGACY_LEVELS[up] || LEVELS.find(l => l.id.toUpperCase() === up)?.id || '';
}
