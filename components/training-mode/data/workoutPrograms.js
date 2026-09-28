// Programming presets for the Workout Builder — shared between the main
// setup screen (which shows the live summary + generates) and the
// PROGRAMMING sub-page (which edits them). Kept in one place so the two
// screens can never drift apart.

// Set schemes applied to every weighted lift in the generated workout.
// AUTO keeps the generator's own numbers; Custom opens numeric inputs.
export const SET_SCHEMES = [
  { id: 'auto', label: 'AUTO', sub: 'Generator' },
  { id: '3x10', label: '3×10', sub: 'Hypertrophy', sets: 3, reps: 10, restSeconds: 60 },
  { id: '5x5', label: '5×5', sub: 'Strength', sets: 5, reps: 5, restSeconds: 90 },
  { id: '4x8', label: '4×8', sub: 'Build', sets: 4, reps: 8, restSeconds: 75 },
  { id: '3x15', label: '3×15', sub: 'Endurance', sets: 3, reps: 15, restSeconds: 45 },
  { id: 'custom', label: 'CUSTOM', sub: '✎' },
];

// Popular program shortcuts over the existing generator. Split programs
// rotate their day each time they're applied (counter in localStorage) so
// "3-day" actually cycles through its days.
export const ALL_CHIP_IDS = ['CHEST', 'BACK', 'SHOULDERS', 'ARMS', 'CORE', 'LEGS', 'GLUTES'];
export const PROGRAMS = [
  { id: 'fullbody', title: 'FULL BODY', short: 'Full Body', meta: 'All groups · 3×10 · ~40 min', scheme: { id: '3x10', sets: 3, reps: 10, restSeconds: 60 }, duration: 40, days: [{ label: '', chips: ALL_CHIP_IDS }] },
  { id: 'ppl', title: 'PUSH / PULL / LEGS', short: 'PPL', meta: '3-day · 4×8', rotateKey: 'tm_prog_ppl', scheme: { id: '4x8', sets: 4, reps: 8, restSeconds: 75 }, duration: 40,
    days: [{ label: 'PUSH', chips: ['CHEST', 'SHOULDERS', 'ARMS'] }, { label: 'PULL', chips: ['BACK', 'ARMS'] }, { label: 'LEGS', chips: ['LEGS', 'GLUTES', 'CORE'] }] },
  { id: 'ul', title: 'UPPER / LOWER', short: 'Upper/Lower', meta: '2-day · 5×5', rotateKey: 'tm_prog_ul', scheme: { id: '5x5', sets: 5, reps: 5, restSeconds: 90 }, duration: 40,
    days: [{ label: 'UPPER', chips: ['CHEST', 'BACK', 'SHOULDERS', 'ARMS'] }, { label: 'LOWER', chips: ['LEGS', 'GLUTES', 'CORE'] }] },
  { id: 'bro', title: 'BRO SPLIT', short: 'Bro Split', meta: '1 group/day · 4×10', rotateKey: 'tm_prog_bro', scheme: { id: '4x10', sets: 4, reps: 10, restSeconds: 60 }, duration: 40,
    days: [{ label: 'CHEST', chips: ['CHEST'] }, { label: 'BACK', chips: ['BACK'] }, { label: 'SHOULDERS', chips: ['SHOULDERS'] }, { label: 'ARMS', chips: ['ARMS'] }, { label: 'LEGS', chips: ['LEGS'] }] },
];

export const DURATIONS = [15, 30, 45, 60];
export const DEFAULT_DURATION = 30;

// Which day of a split is up next (rotates via a per-program localStorage counter).
export function programDayIndex(p) {
  if (!p?.rotateKey) return 0;
  try { return (parseInt(localStorage.getItem(p.rotateKey), 10) || 0) % p.days.length; } catch { return 0; }
}

// Advance a split to its next day (called when a program is applied).
export function advanceProgramDay(p, currentIndex) {
  if (!p?.rotateKey) return;
  try { localStorage.setItem(p.rotateKey, String(currentIndex + 1)); } catch { /* noop */ }
}

// Resolve the chosen scheme id/custom values into the config's setScheme
// (null = let the generator pick its own numbers).
export function resolveScheme(schemeId, customScheme) {
  if (!schemeId || schemeId === 'auto') return null;
  if (schemeId === 'custom') return { id: 'custom', ...customScheme };
  const s = SET_SCHEMES.find(x => x.id === schemeId);
  if (s) return { id: s.id, sets: s.sets, reps: s.reps, restSeconds: s.restSeconds };
  // A program can carry a scheme that isn't one of the selector's chips —
  // Bro Split's 4×10 isn't. Without this it resolved to null and the
  // generator quietly used its own numbers, so the program never delivered
  // the scheme printed on it.
  const ps = PROGRAMS.find(p => p.scheme.id === schemeId)?.scheme;
  return ps ? { ...ps } : null;
}

// Short one-line summary of the current programming, or 'AUTO' when untouched.
// e.g. "5×5 · Full Body · 40m".
export function programmingSummary({ schemeId, programId, duration }) {
  const touched = (schemeId && schemeId !== 'auto') || programId;
  if (!touched) return 'AUTO';
  const parts = [];
  if (schemeId && schemeId !== 'auto') {
    const s = SET_SCHEMES.find(x => x.id === schemeId);
    parts.push(s ? s.label : schemeId.replace('x', '×'));
  }
  if (programId) {
    const p = PROGRAMS.find(x => x.id === programId);
    if (p) parts.push(p.short);
  }
  if (duration) parts.push(`${duration}m`);
  return parts.join(' · ');
}

// The builder's muscle chips mapped to the generator's granular groups. Lives
// here, not in FitBuilderSetup, so the Programs screen resolves a program day
// exactly the way the builder does.
export const CHIP_GROUPS = {
  CHEST: ['Chest'],
  BACK: ['Back'],
  SHOULDERS: ['Shoulders'],
  ARMS: ['Biceps', 'Triceps'],
  CORE: ['Core'],
  LEGS: ['Quads', 'Hamstrings'],
  GLUTES: ['Glutes'],
};

// Which program the athlete is on — set whenever one is started, from the
// Programs screen or the builder's PROGRAMMING sheet, so both doors agree.
const CURRENT_KEY = 'tm_current_program';
export function loadCurrentProgram() {
  try { return PROGRAMS.find(p => p.id === localStorage.getItem(CURRENT_KEY)) || null; } catch { return null; }
}
export function saveCurrentProgram(id) {
  try { localStorage.setItem(CURRENT_KEY, id); } catch { /* storage is best-effort */ }
}

// A program's next day as the config the builder hands to the generator, and
// the side effects of starting it: the split advances and it becomes current.
// Uses the program's own scheme so a split always trains what it advertises.
export function startProgramDay(p, { equipment = 'Bodyweight', difficulty = 'Normal' } = {}) {
  const idx = programDayIndex(p);
  const day = p.days[idx];
  advanceProgramDay(p, idx);
  saveCurrentProgram(p.id);
  return {
    muscleGroups: day.chips.flatMap(id => CHIP_GROUPS[id] || []),
    equipment, difficulty, focus: 'Strength', duration: p.duration,
    cardioAddon: null, addCardio: false, setScheme: { ...p.scheme },
    programId: p.id, programDay: day.label || null,
  };
}
