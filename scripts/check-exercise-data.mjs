// Fit Mode exercise library sanity: every id unique, no exercise listed twice
// under the same muscle, and no active "exercise" whose name is really a
// category (a slash-joined label like "Agility/Balance"). Run: npm run check:exercises
import { FIT_MODE_EXERCISES } from '../components/training-mode/fit-mode/fitModeExerciseData.js';

const problems = [];
const ids = new Map();
const nameMuscle = new Map();
for (const ex of FIT_MODE_EXERCISES) {
  if (ids.has(ex.id)) problems.push(`duplicate id ${ex.id}`);
  ids.set(ex.id, true);
  const key = `${String(ex.name).trim().toLowerCase()}|${String(ex.primaryMuscle).toLowerCase()}`;
  if (nameMuscle.has(key)) problems.push(`"${ex.name}" listed twice under ${ex.primaryMuscle}`);
  nameMuscle.set(key, true);
  // Slashes inside brackets list variations ("Arm Circles (Forward/Backward)") — fine.
  if (ex.active && /\//.test(String(ex.name).replace(/\([^)]*\)/g, ''))) problems.push(`active exercise "${ex.name}" looks like a category (slash in the name)`);
}
problems.forEach((p) => console.log('PROBLEM ', p));
console.log(`${FIT_MODE_EXERCISES.length} exercises — ${problems.length ? `${problems.length} problem(s)` : 'library OK'}`);
process.exit(problems.length ? 1 : 0);
