// Spec 13 (WB-G) — the content behind the EXERCISE INFO sheet: how to do it,
// what people get wrong, and an easier/harder version to swap to.
//
// Cues are written per MOVEMENT FAMILY, not per exercise. That's deliberate:
// "keep the body in one line, lower until the chest is near the floor" is
// equally true of a knee push-up, an archer push-up and an Aztec push-up, so
// one honest family entry beats 134 hand-written guesses. Families are
// matched most-specific-first; anything unmatched falls back to the coach
// note the exercise already carries.
//
// Language rule from the spec: real beginner English. "Hang under the bar,
// body straight" — never "maintain scapular retraction".
import { FIT_MODE_EXERCISES } from '../fit-mode/fitModeExerciseData';

const FAMILIES = [
  {
    id: 'scapular-push-up',
    test: /scapular push/i,
    cues: [
      'Start at the top of a push-up, arms straight.',
      'Keep the arms locked — only the shoulder blades move.',
      'Squeeze the blades together, let the chest sink slightly.',
      'Push the floor away to spread them back apart.',
    ],
    mistakes: ['Bending the elbows — this is not a push-up.', 'Rushing. One second down, one second up.'],
    easier: 'Wall Push-Ups', harder: 'Incline Push-Ups',
  },
  {
    id: 'handstand-push-up',
    test: /handstand/i,
    cues: [
      'Feet on the wall, hands a little wider than the shoulders.',
      'Squeeze the belly so the back does not arch.',
      'Lower until the head is just above the floor.',
      'Press straight back up, eyes on the floor.',
    ],
    mistakes: ['Arching the lower back to get more range.', 'Letting the elbows flare straight out to the sides.'],
    easier: 'Wall Push-Ups', harder: 'Aztec Push-Ups',
  },
  {
    id: 'push-up',
    test: /push[- ]?up/i,
    cues: [
      'Hands under the shoulders, body in one straight line.',
      'Squeeze the glutes and belly so the hips do not sag.',
      'Lower until the chest is just above the floor.',
      'Push the floor away and lock the elbows out.',
    ],
    mistakes: ['Hips sagging or piking up — the line breaks.', 'Only going halfway down.'],
    easier: 'Knee Push-Ups', harder: 'Archer Push-Ups',
  },
  {
    id: 'pull-up',
    test: /pull[- ]?up|chin[- ]?up/i,
    cues: [
      'Hang with straight arms, hands about shoulder-width.',
      'Pull the elbows down toward your ribs.',
      'Chin clears the bar without shrugging into your ears.',
      'Lower all the way down under control.',
    ],
    mistakes: ['Kicking the legs to swing up.', 'Stopping halfway down and losing the bottom of the rep.'],
    easier: 'Assisted Pull-Ups', harder: 'Archer Pull-Ups',
  },
  {
    id: 'inverted-row',
    test: /inverted row/i,
    cues: [
      'Hang under the bar, body straight from head to heels.',
      'Squeeze the glutes so the hips stay up.',
      'Pull until the chest touches the bar.',
      'Lower until the arms are straight again.',
    ],
    mistakes: ['Letting the hips drop first.', 'Yanking with the arms instead of pulling the chest to the bar.'],
    easier: 'Light Dumbbell Row', harder: 'Archer Inverted Rows',
  },
  {
    id: 'row',
    test: /\brow\b/i,
    cues: [
      'Hinge forward, back flat, chest proud.',
      'Let the weight hang with a straight arm.',
      'Pull the elbow back past your ribs.',
      'Lower slowly — do not drop it.',
    ],
    mistakes: ['Rounding the back to reach further.', 'Twisting the torso to help the weight up.'],
    easier: 'Light Dumbbell Row', harder: 'Supported Dumbbell Row',
  },
  {
    id: 'dip',
    test: /\bdip/i,
    cues: [
      'Hands on the bench beside your hips, fingers forward.',
      'Keep the chest up and the shoulders down.',
      'Bend the elbows straight back to about 90 degrees.',
      'Press through the palms back to straight arms.',
    ],
    mistakes: ['Shoulders rolling forward at the bottom.', 'Going deeper than 90 degrees — hard on the shoulder.'],
    easier: 'Bench Dips (Feet Down)', harder: 'Bench or Step Triceps Dips',
  },
  {
    id: 'triceps-extension',
    test: /skull crusher|triceps extension|pushdown|kickback|overhead.*extension/i,
    cues: [
      'Upper arms stay still — only the elbows open and close.',
      'Lower under control until you feel a stretch.',
      'Squeeze the back of the arm at the top.',
      'Keep the wrists straight, not bent back.',
    ],
    mistakes: ['Letting the elbows drift forward and turning it into a press.', 'Flaring the elbows out wide.'],
    easier: 'Wall Triceps Extensions', harder: 'Chain Skull Crushers',
  },
  {
    id: 'overhead-press',
    test: /overhead press|military|arnold|bradford|shoulder press/i,
    cues: [
      'Feet under the hips, belly tight, ribs down.',
      'Start with the weight at shoulder height.',
      'Press straight overhead until the arms lock out.',
      'Lower back to the shoulders under control.',
    ],
    mistakes: ['Leaning back and pressing from the chest.', 'Pressing around the head instead of straight up.'],
    easier: 'Seated Light Shoulder Press', harder: 'Arnold Press',
  },
  {
    id: 'chest-press',
    test: /bench press|chest press|floor press/i,
    cues: [
      'Shoulder blades pinched back and down.',
      'Lower the weight to the mid-chest, elbows about 45 degrees.',
      'Touch lightly — no bouncing.',
      'Press up and slightly back over the shoulders.',
    ],
    mistakes: ['Elbows flared straight out to the sides.', 'Bouncing the bar off the chest.'],
    easier: 'Light Dumbbell Floor Press', harder: 'Barbell Bench Press (Flat/Incline/Decline)',
  },
  {
    id: 'curl',
    test: /curl/i,
    cues: [
      'Stand tall, elbows tucked at your sides.',
      'Curl up without swinging the elbows forward.',
      'Squeeze at the top for a beat.',
      'Lower all the way to straight arms.',
    ],
    mistakes: ['Rocking the body to throw the weight up.', 'Stopping short at the bottom.'],
    easier: 'Seated Light Curls', harder: 'Bicep Curl 21s (Barbell)',
  },
  {
    id: 'lunge',
    test: /lunge|split squat|step[- ]?up/i,
    cues: [
      'Step out far enough that the front shin stays upright.',
      'Drop the back knee straight down toward the floor.',
      'Keep the chest tall — do not fold forward.',
      'Drive through the front heel to stand.',
    ],
    mistakes: ['Front knee sliding past the toes.', 'Letting the back knee crash into the floor.'],
    easier: 'Light Step-Ups', harder: 'Barbell Walking Lunges',
  },
  {
    id: 'squat',
    test: /squat|wall sit|horse stance/i,
    cues: [
      'Feet about shoulder-width, toes slightly out.',
      'Push the hips back and down like sitting into a chair.',
      'Keep the chest up and the knees tracking over the toes.',
      'Drive through the whole foot to stand tall.',
    ],
    mistakes: ['Heels lifting off the floor.', 'Knees caving inward on the way up.'],
    easier: 'Light Goblet Squat', harder: 'Supported Split Squat',
  },
  {
    id: 'hinge',
    test: /good morning|romanian|deadlift|pull through|glute-ham/i,
    cues: [
      'Soft knees, feet under the hips.',
      'Push the hips straight back, chest leading.',
      'Stop when you feel the hamstrings stretch.',
      'Squeeze the glutes to stand up tall.',
    ],
    mistakes: ['Rounding the lower back.', 'Squatting down instead of hinging back.'],
    easier: 'Bodyweight Good Mornings', harder: 'Light Romanian Deadlift',
  },
  {
    id: 'glute-bridge',
    test: /glute bridge|hip bridge|hip thrust|hamstring bridge/i,
    cues: [
      'Lie on your back, heels close to your hips.',
      'Push through the heels and lift the hips.',
      'Squeeze the glutes hard at the top.',
      'Lower slowly until the hips just touch down.',
    ],
    mistakes: ['Arching the lower back instead of squeezing the glutes.', 'Pushing off the toes instead of the heels.'],
    easier: 'Glute Bridge Hold', harder: 'Single-Leg Glute Bridges',
  },
  {
    id: 'glute-kickback',
    test: /kickback|fire hydrant/i,
    cues: [
      'On hands and knees, back flat like a table.',
      'Brace the belly so the back does not sway.',
      'Drive the leg back or out without twisting the hips.',
      'Squeeze the glute, then return under control.',
    ],
    mistakes: ['Twisting the hips to get more range.', 'Arching the lower back at the top.'],
    easier: 'Glute Bridges', harder: 'Standing Glute Kickbacks',
  },
  {
    id: 'calf-raise',
    test: /calf raise/i,
    cues: [
      'Stand tall, weight over the balls of the feet.',
      'Rise up as high as you can onto the toes.',
      'Pause for a beat at the top.',
      'Lower slowly until the heels are below the toes.',
    ],
    mistakes: ['Bouncing through the reps.', 'Cutting the range short at the top.'],
    easier: 'Calf Raises', harder: 'Single Leg Calf Raises',
  },
  {
    id: 'raise',
    test: /raise|arm circles|arm haulers/i,
    cues: [
      'Stand tall, small bend in the elbows.',
      'Lift with the shoulders, not by swinging.',
      'Stop at shoulder height — no higher.',
      'Lower slowly on a two count.',
    ],
    mistakes: ['Shrugging the shoulders up to the ears.', 'Using the whole body to fling the weight up.'],
    easier: 'Wall Arm Raises', harder: 'Light Dumbbell Lateral Raise',
  },
  {
    id: 'shrug',
    test: /shrug/i,
    cues: [
      'Stand tall with the arms hanging straight.',
      'Lift the shoulders straight up toward the ears.',
      'Hold the squeeze for a beat.',
      'Lower all the way down.',
    ],
    mistakes: ['Rolling the shoulders in circles.', 'Bending the elbows to help.'],
    easier: 'Cable Shrugs', harder: 'Cable Shrugs',
  },
  {
    id: 'rollout',
    test: /rollout|falling tower/i,
    cues: [
      'Start on the knees, arms straight, belly tight.',
      'Roll out only as far as you can keep the back flat.',
      'The moment the back starts to arch — that is your limit.',
      'Pull with the belly to come back.',
    ],
    mistakes: ['Going out too far and arching the lower back.', 'Letting the hips pike up to make the return easy.'],
    easier: 'Dead Bugs', harder: 'Ab Rollouts',
  },
  {
    id: 'plank',
    test: /plank|boat pose|hollow|bird dog|dead bug/i,
    cues: [
      'Elbows under the shoulders, body in one line.',
      'Squeeze the glutes and pull the belly button in.',
      'Breathe steadily — do not hold your breath.',
      'Stop the set when the hips start to drop.',
    ],
    mistakes: ['Hips sagging toward the floor.', 'Holding the breath and rushing the clock.'],
    easier: 'Knee Plank Hold', harder: 'Adductor Plank',
  },
  {
    id: 'core-flexion',
    test: /crunch|sit[- ]?up|toe tap|bicycle|oblique|leg raise/i,
    cues: [
      'Lower back stays pressed into the floor.',
      'Curl up with the belly, not by pulling the neck.',
      'Exhale as you crunch, breathe in on the way down.',
      'Move slowly — speed comes from the hips, not the abs.',
    ],
    mistakes: ['Yanking on the head or neck.', 'Letting the lower back lift off the floor.'],
    easier: 'Dead Bugs', harder: 'Bicycle Crunches',
  },
  {
    id: 'jump',
    test: /jump|burpee/i,
    cues: [
      'Start with the feet under the hips.',
      'Dip, swing the arms and drive through the whole foot.',
      'Land soft and quiet, knees bending to absorb.',
      'Reset fully before the next rep.',
    ],
    mistakes: ['Landing stiff-legged with a loud thud.', 'Knees caving inward on landing.'],
    easier: 'Light Step-Ups', harder: 'Depth Jumps',
  },
  {
    id: 'crawl',
    test: /crawl|crab walk|bear/i,
    cues: [
      'Hands under the shoulders, knees under the hips.',
      'Lift the knees an inch off the floor and hold them there.',
      'Move opposite hand and opposite foot together.',
      'Keep the hips low and level — no rocking.',
    ],
    mistakes: ['Hips swinging side to side.', 'Letting the hips ride up high.'],
    easier: 'Bear Squat', harder: 'Crab Walk',
  },
  {
    id: 'conditioning',
    test: /battle rope|bike|boxing|agility|balance|quick steps|torque|landmine/i,
    cues: [
      'Athletic stance: knees soft, weight on the balls of the feet.',
      'Brace the belly and keep the chest up.',
      'Work at a pace you can hold for the whole interval.',
      'Breathe in a rhythm — do not hold your breath.',
    ],
    mistakes: ['Going all out in the first ten seconds and fading.', 'Standing straight up and losing the athletic stance.'],
    easier: 'Balance and Quick Steps', harder: 'Battle Ropes',
  },
];

function familyFor(ex) {
  const name = String(ex?.name || '');
  return FAMILIES.find(f => f.test.test(name)) || null;
}

function findByName(name) {
  if (!name) return null;
  const want = String(name).toLowerCase();
  return FIT_MODE_EXERCISES.find(e => e.name.toLowerCase() === want)
    || FIT_MODE_EXERCISES.find(e => e.name.toLowerCase().startsWith(want))
    || null;
}

// A named target is preferred, but the row must always be swappable — so fall
// back to a real exercise in the same muscle group at the right difficulty.
const RANK = { easy: 0, normal: 1, hard: 2 };
function fallbackByDifficulty(ex, direction) {
  const mine = RANK[String(ex?.difficulty || 'normal').toLowerCase()] ?? 1;
  const target = direction === 'easier' ? mine - 1 : mine + 1;
  if (target < 0 || target > 2) return null;
  return FIT_MODE_EXERCISES.find(e =>
    e.active !== false
    && e.id !== ex?.id
    && e.name !== ex?.name
    && e.primaryMuscle === ex?.primaryMuscle
    && (RANK[String(e.difficulty || '').toLowerCase()] ?? 1) === target) || null;
}

function resolveSwap(ex, name, direction) {
  const named = findByName(name);
  if (named && named.name !== ex?.name) return named;
  return fallbackByDifficulty(ex, direction);
}

// Everything the sheet renders for one exercise.
export function exerciseInfo(ex) {
  const fam = familyFor(ex);
  const note = String(ex?.coachNote || '').trim();
  const cues = fam ? fam.cues : [
    note || 'Move under control through the full range.',
    'Brace the belly and keep the spine neutral.',
    'Breathe out on the effort, in on the way back.',
  ].filter(Boolean);
  const mistakes = fam ? fam.mistakes : [
    'Rushing the reps and losing control of the weight.',
    'Letting form break down to finish the set.',
  ];
  return {
    familyId: fam?.id || null,
    cues,
    mistakes,
    tempo: ex?.tempo || null,
    easier: resolveSwap(ex, fam?.easier, 'easier'),
    harder: resolveSwap(ex, fam?.harder, 'harder'),
    // Demo art lands progressively; the sheet shows its own designed
    // "on the way" panel until this file exists.
    demoSrc: ex?.id ? `/static/exercise-demos/${ex.id}.webp` : null,
  };
}

// ● ○ ○ EASY · ● ● ○ NORMAL · ● ● ● HARD
export function difficultyPips(difficulty) {
  const d = String(difficulty || 'Normal').toLowerCase();
  const filled = d === 'easy' ? 1 : d === 'hard' ? 3 : 2;
  return { label: d.toUpperCase(), pips: [0, 1, 2].map(i => i < filled) };
}
