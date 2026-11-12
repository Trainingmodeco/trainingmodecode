// Fit Mode exercise library sanity: every id unique, no exercise listed twice
// under the same muscle, and no active "exercise" whose name is really a
// category (a slash-joined label like "Agility/Balance"). Run: npm run check:exercises
import { FIT_MODE_EXERCISES } from '../components/training-mode/fit-mode/fitModeExerciseData.js';
import { isPerSide, sideSuffix } from '../components/training-mode/fit-mode/sideRule.js';
import { equipmentLabel } from '../components/training-mode/fit-mode/gearNote.js';

const problems = [];
const ids = new Map();
const nameMuscle = new Map();
const activeNames = new Map();
for (const ex of FIT_MODE_EXERCISES) {
  if (ids.has(ex.id)) problems.push(`duplicate id ${ex.id}`);
  ids.set(ex.id, true);
  const key = `${String(ex.name).trim().toLowerCase()}|${String(ex.primaryMuscle).toLowerCase()}`;
  if (nameMuscle.has(key)) problems.push(`"${ex.name}" listed twice under ${ex.primaryMuscle}`);
  nameMuscle.set(key, true);
  // Slashes inside brackets list variations ("Arm Circles (Forward/Backward)") — fine.
  if (ex.active) {
    // One entry per movement: the builder list and the name-keyed history and
    // clips cannot tell two "Box Jumps" apart.
    const nm = String(ex.name).trim().toLowerCase();
    if (activeNames.has(nm)) problems.push(`"${ex.name}" is active twice (${activeNames.get(nm)}, ${ex.id})`);
    activeNames.set(nm, ex.id);
    // A timed block is timed: counting reps through "40s" tells the athlete
    // the wrong work, and a stance or hold with a rep range has no clock.
    const timed = ex.durationSeconds || /^\d+\s*s$/i.test(String(ex.reps));
    if (timed && ex.voiceCountingType === 'rep_count') problems.push(`timed "${ex.name}" is marked rep_count`);
    if (!timed && /\b(stance|hold|wall sit)\b/i.test(ex.name) && ex.voiceCountingType === 'rep_count') problems.push(`"${ex.name}" is a hold but has reps and no seconds`);
    // The kit a move needs must show: a bar, box or rope move filed as plain
    // Bodyweight reads wrong on the info sheet unless the label names it.
    if (/\b(pull-ups?|chin-ups?|box jumps?|dips?|battle ropes?)\b/i.test(ex.name) && !/\bassisted\b/i.test(ex.name)
      && equipmentLabel(ex).toLowerCase() === String(ex.equipment).toLowerCase()) problems.push(`"${ex.name}" needs gear its "${ex.equipment}" tag does not show`);
  }
  if (ex.active && /\//.test(String(ex.name).replace(/\([^)]*\)/g, ''))) problems.push(`active exercise "${ex.name}" looks like a category (slash in the name)`);
}
// One-sided moves say "each side" on the card (screens add it from the name).
const uni = FIT_MODE_EXERCISES.filter((e) => e.active && isPerSide(e.name));
for (const n of ['Single-Arm Dumbbell Row', 'Pistol Squats', 'Bulgarian Split Squats', 'Single-Leg Glute Bridges', 'Side Plank']) {
  if (!isPerSide(n)) problems.push(`"${n}" should read "each side"`);
}
for (const n of ['Push-Ups', 'Alternating Dumbbell Press', 'Alt One Leg Wall Sit', 'Burpees']) {
  if (isPerSide(n)) problems.push(`"${n}" should not read "each side"`);
}
if (sideSuffix('Pistol Squats') !== ' each side' || sideSuffix('Push-Ups') !== '') problems.push('sideSuffix is wrong');
if (uni.length < 20) problems.push(`only ${uni.length} one-sided moves are flagged`);
problems.forEach((p) => console.log('PROBLEM ', p));
console.log(`${FIT_MODE_EXERCISES.length} exercises — ${problems.length ? `${problems.length} problem(s)` : 'library OK'}`);
process.exit(problems.length ? 1 : 0);
