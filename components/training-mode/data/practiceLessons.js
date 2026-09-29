import { NUMBER_DRILL } from './strikeNumbering';
import { PRACTICE_DISCIPLINES } from '../practiceData';

// The Fundamentals Path — seven lessons per discipline, in order. Moved here
// from PracticeMode.jsx so the Practice invite and weekly reminder can read
// the same path the screen shows.
//
// `calls` is what a lesson's Practice Round shouts: the lesson's own moves,
// short enough to read at a glance and to say out loud. Earlier lessons'
// calls come back in later rounds, which is how a round is "built from what
// you've learned".

// PROMPT N — the numbers lesson, appended to every discipline's basics.
// Steps come from the canonical map so this can never drift from the caller.
export const NUMBERS_LESSON = {
  id: 'know_your_numbers',
  title: 'Know Your Numbers',
  subtitle: 'The 1–8 count every gym uses.',
  steps: [
    ...NUMBER_DRILL.map((n) => `${n.num} is your ${n.name.toUpperCase()}. Throw five slow.`),
    'Any number “to the body” is the same punch downstairs — 3 to the body is a lead hook to the ribs.',
    'Coach calls: 1-2. Then 1-2-3. Then 1-2, 3 to the body. Answer with your hands.',
  ],
  calls: ['1', '2', '1-2', '1-2-3', '1-1-2', '3 TO THE BODY'],
};

const START_HERE_LESSONS = {
  Boxing: [
    { id: 'boxing_stance', title: 'Boxing Stance', subtitle: 'Learn your base, guard, and foot position.', calls: ['STANCE', 'STEP FORWARD', 'STEP BACK', 'HANDS UP'], steps: ['Stand with feet shoulder-width apart.','Step lead foot forward (left if right-handed).','Keep knees slightly bent — stay light.','Hands up to protect your chin.','Tuck elbows close to ribs.','Chin down, eyes forward.','Move forward and back for 30 seconds.'] },
    { id: 'boxing_guard', title: 'Guard + Footwork', subtitle: 'Protect yourself and move with balance.', calls: ['GUARD UP', 'STEP IN', 'STEP OUT', 'SLIDE LEFT', 'SLIDE RIGHT'], steps: ['Start in your boxing stance.','Keep both hands glued to your cheeks.','Step forward: lead foot first, back foot follows.','Step back: back foot first, lead foot follows.','Never cross your feet.','Practice 10 steps forward, 10 back.','Add lateral movement: step-slide left and right.'] },
    { id: 'boxing_jab', title: 'Jab', subtitle: 'Your fastest, longest-range punch.', calls: ['JAB', 'JAB × 2', 'STEP JAB'], steps: ['Start in your boxing stance with guard up.','Extend your lead hand straight out, palm turns down.','Snap it back to guard immediately.','Keep your rear hand glued to your chin.','Step forward slightly as you jab.','Practice 20 jabs — focus on speed, not power.','Keep your shoulder up to protect your chin.'] },
    { id: 'boxing_cross', title: 'Cross', subtitle: 'Your power punch from the rear hand.', calls: ['CROSS', 'CROSS × 2'], steps: ['Start in stance with guard up.','Rotate your back hip forward.','Throw your rear hand straight.','Your back heel lifts as you rotate.','Full extension — don\'t loop it.','Snap back to guard.','Practice 20 crosses — focus on rotation.'] },
    { id: 'boxing_jab_cross', title: 'Jab-Cross', subtitle: 'Your first combination.', calls: ['JAB → CROSS', 'JAB → JAB → CROSS'], steps: ['Start in stance.','Throw a JAB (lead hand snap).','Immediately follow with a CROSS (rear hand, rotate hips).','Return to guard between combos.','Practice 10 jab-cross combos.','Focus on smooth flow, not power.','Add a small step forward with the jab.'] },
    { id: 'boxing_defense', title: 'Basic Defense', subtitle: 'Slips, blocks, and getting out of the way.', calls: ['BLOCK', 'SLIP INSIDE', 'SLIP OUTSIDE', 'PULL'], steps: ['Start in stance with guard up tight.','BLOCK: Keep hands high — absorb with your gloves.','SLIP INSIDE: Bend knees, move head off center (lead side).','SLIP OUTSIDE: Bend knees, move head to rear side.','PULL: Lean back slightly from the waist.','Practice 10 of each defensive move.','Always return to guard after every slip.'] },
  ],
  Kickboxing: [
    { id: 'kb_stance', title: 'Kickboxing Stance', subtitle: 'Wider base for kicks and punches.', calls: ['STANCE', 'BOUNCE', 'STEP FORWARD', 'STEP BACK'], steps: ['Stand slightly wider than boxing stance.','Weight evenly distributed on both feet.','Hands up protecting your chin.','Keep your lead hand extended slightly more.','Stay on the balls of your feet.','Chin down, core tight.','Practice bouncing lightly in place for 30 seconds.'] },
    { id: 'kb_jab', title: 'Jab', subtitle: 'Same fundamentals, kickboxing range.', calls: ['JAB', 'JAB × 2', 'STEP JAB'], steps: ['Start in kickboxing stance.','Extend lead hand straight, palm down.','Snap back immediately.','Keep your weight centered (not over-committing).','Step forward slightly with the jab.','Practice 20 quick jabs.','Use the jab to set up kicks.'] },
    { id: 'kb_cross', title: 'Cross', subtitle: 'Power from your rear hand.', calls: ['CROSS', 'JAB → CROSS'], steps: ['Start in stance.','Rotate your rear hip forward.','Throw rear hand straight out.','Back heel lifts, hips fully rotate.','Return to guard immediately.','Practice 20 crosses.','Combine: jab-cross, 10 reps.'] },
    { id: 'kb_front_kick', title: 'Front Kick / Teep', subtitle: 'Your longest-range weapon — push them back.', calls: ['LEAD TEEP', 'REAR TEEP', 'JAB → TEEP'], steps: ['Start in stance.','Lift your lead knee to waist height.','Push your foot forward, hitting with the ball of your foot.','Extend your leg fully.','Snap it back to stance.','Keep your hands up the entire time.','Practice 10 lead teeps, then 10 rear teeps.'] },
    { id: 'kb_roundhouse', title: 'Rear Roundhouse Kick', subtitle: 'Power kick using your shin.', calls: ['ROUNDHOUSE', 'ROUNDHOUSE × 2'], steps: ['Start in stance.','Pivot on your lead foot — turn it 90 degrees.','Swing your rear leg in an arc.','Hit with your SHIN, not your foot.','Your hips rotate all the way through.','Return to stance.','Practice 10 slow roundhouses — focus on form.'] },
    { id: 'kb_combo', title: 'Basic Kickboxing Combo', subtitle: 'Hands and feet together.', calls: ['JAB → CROSS → KICK', '1-2 → ROUNDHOUSE'], steps: ['Start in stance.','Jab.','Cross.','Rear roundhouse kick.','Return to stance.','That\'s your 1-2-kick combo.','Practice 10 reps each side.'] },
  ],
  'Muay Thai': [
    { id: 'mt_stance', title: 'Muay Thai Stance', subtitle: 'Tall, square, ready for all 8 weapons.', calls: ['STANCE', 'WEIGHT BACK', 'WEIGHT FORWARD', 'HANDS HIGH'], steps: ['Stand taller than boxing stance.','Feet shoulder-width, slightly squared.','Weight slightly on back foot.','Hands high — palms facing forward.','Elbows tucked and ready.','Stay on the balls of your feet.','Practice shifting weight forward and back.'] },
    { id: 'mt_jab_cross', title: 'Jab + Cross', subtitle: 'Setting up your heavy weapons.', calls: ['JAB', 'CROSS', 'JAB → CROSS'], steps: ['Start in Muay Thai stance.','Jab: lead hand straight, step forward slightly.','Cross: rotate rear hip, throw rear hand.','Keep hands high between punches.','Practice 10 jab-cross combos.','These set up your elbows and kicks.','Focus on returning to guard.'] },
    { id: 'mt_teep', title: 'Teep', subtitle: 'The Thai push kick — control distance.', calls: ['LEAD TEEP', 'REAR TEEP'], steps: ['Start in stance.','Lift your lead knee high.','Push forward — extend your leg.','Hit with ball of foot or flat foot.','Push opponent away — don\'t kick through.','Snap leg back to stance.','Practice 10 lead teeps, 10 rear teeps.'] },
    { id: 'mt_roundhouse', title: 'Roundhouse Kick', subtitle: 'The most powerful kick in combat sports.', calls: ['ROUNDHOUSE', 'TEEP → ROUNDHOUSE'], steps: ['Start in Muay Thai stance.','Step your lead foot 45 degrees outward.','Swing rear leg — hip drives through.','Hit with your SHIN.','Your whole body rotates with the kick.','Follow through completely.','Practice 10 slow, controlled kicks per side.'] },
    { id: 'mt_knee', title: 'Knee', subtitle: 'Close-range devastation.', calls: ['REAR KNEE', 'LEAD KNEE', 'KNEE × 2'], steps: ['Start in stance — closer range.','Grab imaginary clinch (hands up high).','Drive your rear knee straight up.','Point your knee, push hips forward.','Return to stance.','Practice 10 rear knees.','Then 10 lead knees (switch stance slightly).'] },
    { id: 'mt_elbow', title: 'Elbow', subtitle: 'The blade of Muay Thai.', calls: ['ELBOW', 'ELBOW × 2', 'CROSS → ELBOW'], steps: ['Start in stance — very close range.','Lift your elbow to shoulder height.','Slash horizontally across.','Use your hip rotation for power.','Keep opposite hand protecting your face.','Practice horizontal elbows: 10 per side.','Elbows are for VERY close range only.'] },
  ],
  MMA: [
    { id: 'mma_stance', title: 'MMA Stance', subtitle: 'Balanced for striking and takedown defense.', calls: ['STANCE', 'BOUNCE', 'SPRAWL READY'], steps: ['Stand with feet shoulder-width, slightly staggered.','Weight centered — 50/50 distribution.','Hands slightly lower than boxing (defend takedowns).','Stay on the balls of your feet.','Chin tucked, core engaged.','Ready to strike AND sprawl.','Practice bouncing lightly — stay mobile.'] },
    { id: 'mma_jab_cross', title: 'Jab + Cross', subtitle: 'Setting up everything in MMA.', calls: ['JAB', 'JAB → CROSS', 'JAB → CROSS → RESET'], steps: ['Start in MMA stance.','Jab: lead hand straight.','Cross: rotate hips, rear hand.','Keep hands ready to defend takedowns after.','Don\'t over-extend on the cross.','Practice 10 jab-cross combos.','After the combo, reset your stance.'] },
    { id: 'mma_teep_low', title: 'Teep or Low Kick', subtitle: 'Control distance or chop the legs.', calls: ['TEEP', 'LOW KICK', 'JAB → LOW KICK'], steps: ['TEEP: Lift knee, push foot forward.','Hit with ball of foot — push away.','LOW KICK: Target outside of lead thigh.','Use your rear leg, pivot lead foot.','Hit with your shin, low and hard.','Practice 10 teeps, then 10 low kicks.','These keep opponents at your range.'] },
    { id: 'mma_sprawl', title: 'Sprawl', subtitle: 'Defend the takedown — stay on your feet.', calls: ['SPRAWL', 'SPRAWL → UP'], steps: ['Start in stance.','When someone shoots in, kick your legs BACK.','Drop your hips DOWN to the ground.','Your hands push down on their head/shoulders.','Your legs are extended behind you.','Pop back up to stance immediately.','Practice 10 sprawls (shadow, no partner needed).'] },
    { id: 'mma_level_change', title: 'Level Change Defense', subtitle: 'Recognize and stop the shot.', calls: ['LEVEL CHANGE', 'LEVEL CHANGE → SPRAWL'], steps: ['Start in MMA stance.','Lower your level by bending knees.','Keep your back straight — don\'t bend at waist.','Hands drop to hip/thigh level.','If opponent shoots: SPRAWL.','If they don\'t: pop back up.','Practice level changes: down, up, 10 reps.'] },
    { id: 'mma_movement', title: 'Basic MMA Movement', subtitle: 'Angles, footwork, and cage awareness.', calls: ['CIRCLE LEFT', 'CIRCLE RIGHT', 'PIVOT'], steps: ['Start in MMA stance.','Circle left: lead foot steps, rear foot follows.','Circle right: rear foot steps, lead foot follows.','Practice pivoting: plant lead foot, swing rear 90 degrees.','Never walk straight backward.','Always circle away from opponent\'s power hand.','Practice 2 minutes of movement drills.'] },
  ],
};

// The seven lessons for a discipline: six basics, then the numbers.
export function basicsFor(discipline) {
  return [...(START_HERE_LESSONS[discipline] || START_HERE_LESSONS.Boxing), NUMBERS_LESSON];
}

const COMPLETION_KEY = 'tm_starthere_completed';

export function getCompletedLessons() {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(COMPLETION_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function markLessonComplete(lessonId) {
  if (typeof localStorage === 'undefined') return;
  const completed = getCompletedLessons();
  if (!completed.includes(lessonId)) {
    completed.push(lessonId);
    localStorage.setItem(COMPLETION_KEY, JSON.stringify(completed));
  }
  if (!localStorage.getItem('trainingModeStartHereFirstLessonComplete')) {
    localStorage.setItem('trainingModeStartHereFirstLessonComplete', 'true');
  }
}

// Where a discipline's path stands. `next` is the first lesson not done, so
// someone who opened lessons out of order still gets pointed at the gap.
// Know Your Numbers is shared by every discipline, so finishing it once
// counts on all four paths.
export function basicsProgress(discipline, completed = getCompletedLessons()) {
  const lessons = basicsFor(discipline);
  const done = lessons.filter(l => completed.includes(l.id)).length;
  const nextIndex = lessons.findIndex(l => !completed.includes(l.id));
  return { lessons, done, total: lessons.length, nextIndex, next: nextIndex >= 0 ? lessons[nextIndex] : null };
}

export function anyBasicsComplete(completed = getCompletedLessons()) {
  return PRACTICE_DISCIPLINES.some(d => basicsProgress(d, completed).next === null);
}

// Technique Library moves drilled to the end of a Practice Round, per
// discipline. They count toward the round ladder's top rung.
const LIBRARY_KEY = 'tm_practice_library_drilled';

export function getLibraryDrilled(discipline) {
  try {
    const all = JSON.parse(localStorage.getItem(LIBRARY_KEY) || '{}');
    return Array.isArray(all[discipline]) ? all[discipline] : [];
  } catch { return []; }
}

export function markLibraryDrilled(discipline, name) {
  try {
    const all = JSON.parse(localStorage.getItem(LIBRARY_KEY) || '{}');
    const list = Array.isArray(all[discipline]) ? all[discipline] : [];
    if (!list.includes(name)) all[discipline] = [...list, name];
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(all));
  } catch { /* best-effort */ }
}
