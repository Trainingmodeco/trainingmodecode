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

export function loadProfile() {
  try {
    if (typeof localStorage === 'undefined') return { ...DEFAULT_PROFILE };
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PROFILE };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_PROFILE, ...parsed };
  } catch {
    return { ...DEFAULT_PROFILE };
  }
}

export function saveProfile(profile) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

export function getDisplayName(profile) {
  const name = profile?.name;
  if (!name || !name.trim()) return 'TRAINEE';
  return name.trim().toUpperCase();
}
