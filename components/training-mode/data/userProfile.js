const STORAGE_KEY = 'tm_user_profile';

const DEFAULT_PROFILE = {
  name: '',
  sex: 'male',
  age: '',
  heightVal: '',
  heightUnit: 'FT/IN',
  weightVal: '',
  weightUnit: 'LBS',
  experience: 'INTERMEDIATE',
  goal: 'BUILD MUSCLE',
  specialty: '',
  voiceCoach: 'FEMALE',
  coachStyle: 'STANDARD',
  encouragement: 'normal',
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
    _profileCache = raw ? { ...DEFAULT_PROFILE, ...JSON.parse(raw) } : { ...DEFAULT_PROFILE };
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
