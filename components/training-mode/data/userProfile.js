import { normalizeGoal, normalizeExperience } from './profileOptions';

const STORAGE_KEY = 'tm_user_profile';

const DEFAULT_PROFILE = {
  name: '',
  sex: 'male',
  age: '',
  heightVal: '',
  heightUnit: 'FT/IN',
  weightVal: '',
  weightUnit: 'LBS',
  // Unanswered until the questionnaire (or Profile) sets them — the old
  // 'INTERMEDIATE' / 'BUILD MUSCLE' defaults matched none of the answers the
  // rest of the app reads. See data/profileOptions.
  experience: '',
  goal: '',
  specialty: '',
  voiceCoach: 'FEMALE',
  coachStyle: 'STANDARD',
  encouragement: 'normal',
  callStyle: 'names', // strike numbering: names | numbers (PROMPT N)
};

// Parsed-profile cache — avoids re-reading + JSON.parse on every render. Cleared
// on save and on cross-tab storage changes so reads stay fresh.
let _profileCache = null;

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => { if (!e.key || e.key === STORAGE_KEY) _profileCache = null; });
}

// A "beginner learner" told onboarding they're new AND want to learn combat.
// Fight Mode gates combos to their learned arsenal by default and nudges them
// to Practice; everyone else gets all strikes. (Shared by Practice + Combo Coach.)
export function isBeginnerLearner(p) {
  const exp = String(p?.experience || '').toLowerCase();
  const isNew = exp === 'beginner' || exp === 'some training' || exp === '';
  const goal = String(p?.goal || '').toLowerCase();
  return isNew && goal === 'learn combat basics';
}

export function loadProfile() {
  if (_profileCache) return _profileCache;
  try {
    if (typeof localStorage === 'undefined') return { ...DEFAULT_PROFILE };
    const raw = localStorage.getItem(STORAGE_KEY);
    const merged = raw ? { ...DEFAULT_PROFILE, ...JSON.parse(raw) } : { ...DEFAULT_PROFILE };
    // Profiles saved by the old Profile screen carry its own answer set.
    _profileCache = { ...merged, goal: normalizeGoal(merged.goal), experience: normalizeExperience(merged.experience) };
    return _profileCache;
  } catch {
    return { ...DEFAULT_PROFILE };
  }
}

export function saveProfile(profile) {
  _profileCache = null; // invalidate → next load reflects the change
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

export function getDisplayName(profile) {
  const name = profile?.name;
  if (!name || !name.trim()) return 'TRAINEE';
  return name.trim().toUpperCase();
}
