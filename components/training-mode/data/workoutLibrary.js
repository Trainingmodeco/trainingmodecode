// The owner's workout library, turned into missions the Quick Mission timer
// runs. Source: 04_DESIGN_ASSETS/App/Simplify/documents/Workouts —
//   "TM Training Mode Programs_ Shadowboxing & Fitness Routine.xlsx"
//   "Training Mode X Superset Workout Routines.xlsx"
//   "Ultra Ego Vegeta Training Regime" (same content as its sheet)
//
// Two kinds of thing live here:
//   LIBRARY_CLASSICS — single sessions, shown in Quick Mission's CLASSICS row
//   PLAN_PROGRAMS    — multi-day plans, shown under MORE PROGRAMS on Programs
//
// Conversions made from the sheets, so nobody has to rediscover them:
//   · Excel turned rep ranges typed like "8-12" into dates (45881 = 12 Aug).
//     They are read back as the range: 45785→5-8, 45816→6-8, 45818→6-10,
//     45820→6-12, 45823→6-15, 45881→8-12, 45945→10-15, 45950→10-20,
//     45955→10-25, 46006→12-15, 46015→12-24, 45721→3-5. Where the range is
//     given the timer counts the TOP of it.
//   · "AMRAP" sets become timed 45-second sets (the timer needs an end).
//   · A move with no dose becomes 40 s work in a circuit.
//   · Franchise names follow the app's naming rules (see the AN-04 note):
//     Ultra Ego → The Destroyer, Ultra Instinct → Flow State, Guts → The
//     Mercenary, Casca → The Hawk, Akuma → Dark Fist, Ryu → The Wanderer,
//     Shadow Justice → Hero Training. Game move names become plain ones
//     (Shoryuken → rising uppercut, Hadoken → palm push, Tatsumaki →
//     spinning kick, Raging Demon → demon rush).
//
// `pro: true` marks Pro-tier content. It is only ENFORCED when the paywall
// is on (data/entitlements PAYWALL_ENABLED); until then everyone trains it.

// ── builders ───────────────────────────────────────────────────────────────
// r: a rep move · t: a timed move · both default to a 15 s transition.
const r = (name, reps, rest = 15, extra = {}) => ({ name, mode: 'reps', reps, rest, ...extra });
const t = (name, work, rest = 15, extra = {}) => ({ name, mode: 'timed', work, rest, ...extra });
// n sets of the same move, rest between sets.
const sets = (n, make) => Array.from({ length: n }, () => make());
// A list of moves repeated `rounds` times, flattened (a program day can't use
// the timer's own rounds when it has a warm-up in front).
const repeat = (rounds, moves) => Array.from({ length: rounds }, () => moves.map(m => ({ ...m }))).flat();

const WARMUP = [
  t('Jumping Jacks', 30, 5), t('Front Arm Jacks', 30, 5), t('Running Man', 30, 5),
  t('Cross Arm Jacks', 30, 5), t('High Knees', 30, 5), t('Butt Kicks', 30, 10),
];
const WARMUP_JUMPS = [
  t('Jumping Jacks', 30, 5), t('Forward Jacks', 30, 5), t('Running Man', 30, 5),
  t('Ice Skater Jumps', 30, 5), t('High Knees', 30, 5), t('Butt Kicks', 30, 10),
];

// Rough minutes: the coach's intro, the work (reps at ~2.5 s), the rest.
export function estimateMinutes(exercises, rounds = 1) {
  const s = exercises.reduce((sum, e) => sum + 4 + (e.mode === 'timed' ? e.work : (e.reps || 1) * 2.5) + (e.rest || 0), 0);
  return Math.max(1, Math.round((s * rounds) / 60));
}

// What the setup card lists: each move once, in order, with its dose.
export function summaryLines(exercises, max = 5) {
  const seen = new Map();
  exercises.forEach(e => {
    if (seen.has(e.name)) { seen.get(e.name).count += 1; return; }
    seen.set(e.name, { dose: e.mode === 'timed' ? fmt(e.work) : `${e.reps}${e.unit ? ` ${e.unit.toLowerCase()}` : ''}`, count: 1 });
  });
  const list = [...seen.entries()].map(([name, v]) => [name, v.count > 1 ? `${v.count} × ${v.dose}` : v.dose]);
  return list.length > max ? [...list.slice(0, max), [`+ ${list.length - max} more`, '']] : list;
}
const fmt = (sec) => (sec >= 60 ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}` : `${sec}s`);

// ── single sessions (Quick Mission · CLASSICS) ──────────────────────────────
export const LIBRARY_CLASSICS = [
  {
    id: 'strike_fitness_easy', title: 'STRIKE FITNESS · EASY', tag: 'Day Zero', focus: 'Combat', rounds: 2,
    note: 'Beginner strikes and bodyweight, one minute each. Form first — use your hips, don’t over-extend. Two rounds.',
    build: () => [
      t('Push-Ups on Knees', 60, 30), t('Jab', 60, 30), t('Sumo Squat', 60, 30), t('Cross', 60, 30),
      t('Plank', 60, 30), t('Front Kick', 60, 30), t('Tricep Dips', 60, 30), t('Freestyle Shadowboxing', 120, 30),
    ],
  },
  {
    id: 'strike_fitness_mid', title: 'STRIKE FITNESS · INTERMEDIATE', tag: 'Day Zero', focus: 'Combat', rounds: 2,
    note: 'Hooks, uppercuts and knees between bodyweight sets. One minute each, two rounds.',
    build: () => [
      t('Incline Push-Ups', 60, 30), t('Hook', 60, 30), t('Hip Hinge', 60, 30), t('Uppercut', 60, 30),
      t('Crunches', 60, 30), t('Knee Strikes', 60, 30), t('Caterpillar Walks', 60, 30), t('Freestyle Shadowboxing', 120, 30),
    ],
  },
  {
    id: 'strike_fitness_adv', title: 'STRIKE FITNESS · ADVANCED', tag: 'Day Zero', focus: 'Combat', rounds: 2,
    note: 'Punch-kick combos and elbows, a minute of rest between. Chamber every strike. Two rounds.',
    build: () => [
      t('T-Pose Push-Ups', 60, 60), t('One-Two', 60, 60), t('Sissy Squats', 60, 60), t('Punch to Roundhouse Kick', 60, 60),
      t('Crunches', 60, 60), t('Elbow Strikes', 60, 60), t('Slow Bodyweight Rows', 60, 60), t('Freestyle Shadowboxing', 120, 60),
    ],
  },
  {
    id: 'pushup_division', title: 'PUSH-UP DIVISION', tag: 'Training Mode', focus: 'Upper',
    note: 'Fifteen push-up styles, 30 seconds each, max reps with strict form. 30 seconds of rest between.',
    build: () => ['Push-Ups', 'High Push-Ups', 'Wide Push-Ups', 'Pike Push-Ups', 'Archer Push-Ups', 'Typewriter Push-Ups',
      'Clasp Grip Push-Ups', 'Russian Push-Ups', 'Diamond Push-Ups', 'Pseudo Planche Push-Ups', 'Core Rotation Push-Ups',
      'Spiderman Push-Ups', 'Kick-Out Push-Ups', 'Burpees'].map((m, i, a) => t(m, 30, i === a.length - 1 ? 5 : 30)),
  },
  {
    id: 'abs_3_level', title: '3 LEVEL ABS', tag: 'Training Mode', focus: 'Core', rounds: 3,
    note: 'Nine ab moves, 40 seconds each, five seconds to switch. Three rounds, then a plank burnout.',
    build: () => ['3 Level Crunches', '3 Level Bicycle Crunches', 'Indian Sit Crunches', 'Frog Tucks', 'Plank Tuck Crunch',
      'Flutter Kicks', 'Side Plank Thrust Right', 'Side Plank Thrust Left', 'Reverse Crunches'].map(m => t(m, 40, 5)),
  },
  {
    id: 'fitness_test', title: 'FITNESS TEST', tag: 'Assessment', focus: 'Full Body',
    note: 'One minute of max effort per event, two minutes of rest. Count your reps. Under 20 push-ups is Beginner, 20–40 Intermediate, 41+ Elite.',
    build: () => [t('Push-Ups · Max Reps', 60, 120), t('Air Squats · Max Reps', 60, 120), t('Plank Hold', 60, 120),
      t('Crunches · Max Reps', 60, 120), t('Pull-Ups or Inverted Rows · Max Reps', 60, 120), t('Burpees · Max Reps', 60, 5)],
  },
  {
    id: 'burpee_hell', title: 'BURPEE HELL', tag: 'Training Mode', focus: 'Full Body', pro: true,
    note: 'A new burpee every 40 seconds, with 20 seconds of jumping jacks as your only rest.',
    build: () => ['Standard Burpees', 'Burpees with a Push-Up', 'Burpees with a Tuck Jump', 'Burpees with a Single-Leg Hop',
      'Burpees with a Frog Jump', 'Burpees with a Star Jump', 'Burpees with a Double Push-Up', 'Burpees with a Bear Crawl',
      'Burpees with a 180 Jump'].map((m, i, a) => t(m, 40, i === a.length - 1 ? 5 : 20)),
  },
  {
    id: 'legendary_squat', title: 'LEGENDARY SQUAT', tag: 'Training Mode', focus: 'Lower', rounds: 2,
    note: 'A leg circuit that climbs from squats to jumps. Two rounds, a minute of rest between moves.',
    build: () => [r('Bodyweight Squats', 30, 60), t('Step-Through Lunges', 30, 60), r('Wall Sit Calf Raises', 30, 60),
      r('Jump Lunges', 20, 60), r('Frog Jumps', 12, 60), r('180 Jump Squats', 20, 60), r('Broad Jumps', 10, 60),
      r('Single-Leg Box Jumps', 10, 60), r('Depth Landings', 10, 60)],
  },
  {
    id: 'hero_training', title: 'HERO TRAINING', tag: 'Training Mode', focus: 'Full Body', pro: true, needs: 'Pull-up bar',
    note: 'A pull-up pyramid, pike push-ups, split squats and wall walks, finished with plank strikes and sprints.',
    build: () => [
      ...[5, 7, 9, 7, 5].map(n => r('Pull-Ups', n, 60)),
      ...sets(4, () => r('Pike Push-Ups', 12, 45)),
      ...sets(3, () => r('Bulgarian Split Squats', 10, 45)),
      ...sets(3, () => r('Wall Walks', 5, 60)),
      ...sets(4, () => t('Plank and Jab-Cross', 40, 20)),
      ...sets(3, () => t('Sprint', 20, 40)),
    ],
  },
  {
    id: 'chaos_engine', title: 'CHAOS ENGINE CIRCUIT', tag: 'Training Mode', focus: 'Full Body', pro: true, rounds: 4,
    workoutType: 'Weighted', needs: 'Barbell · dumbbells · kettlebell',
    note: 'Strength, hypertrophy and cardio in one circuit. Deadlifts at 50–60%. Four rounds; the rope is your rest.',
    build: () => [r('Barbell Deadlifts', 8, 20), r('Dumbbell Clean and Press', 12, 20), r('Kettlebell Goblet Squats', 15, 20),
      r('Burpees', 10, 20), r('Russian Twists', 24, 10), t('Jump Rope', 120, 30)],
  },
].map(w => ({
  ...w,
  estMin: estimateMinutes(w.build(), w.rounds || 1),
  lines: [...summaryLines(w.build()), ...(w.rounds > 1 ? [[`× ${w.rounds} rounds`, '']] : [])],
}));

// ── multi-day plans (Programs · MORE PROGRAMS) ──────────────────────────────
const SHADOW = 120; // a shadowboxing round
const SHADOW_REST = 30;
const shadowRound = (name) => t(name, SHADOW, SHADOW_REST);

function shadowboxRoutine(disc, focuses) {
  return [
    ...WARMUP,
    t(`Footwork · ${disc} Stance`, 60, 15), t(`Footwork · ${disc} Movement`, 60, 15),
    ...focuses.map(f => (f === 'Interval Calisthenics' ? t('Interval Calisthenics', 120, 30) : shadowRound(`Shadowbox · ${f}`))),
    t('Abs', 180, 15), t('Stretch', 120, 1),
  ];
}

// Bodyweight Circuit content per level (the "P - BW Fitness Program" sheet).
function bw(chest, quads, tri, abs1, back, hams, bi, abs2, legs, shoulders, arms, abs3) {
  return [
    ['CHEST + QUADS + TRICEPS', [...chest, ...quads, ...tri, ...abs1]],
    ['BACK + HAMSTRINGS + BICEPS', [...back, ...hams, ...bi, ...abs2]],
    ['LEGS + SHOULDERS + ARMS', [...legs, ...shoulders, ...arms, ...abs3]],
  ];
}
const BW_CIRCUIT = {
  BEGINNER: {
    days: bw(
      ['Sissy Push-Ups', 'Hindu Push-Ups', 'Push-Ups', 'Close-Grip Push-Ups', 'Wide Push-Ups', 'Tyson Push-Ups'],
      ['Sumo Squats', 'Pulse Squats', '90 Degree Squat Hold', 'Deep Squat Hold', 'Tiptoe Hack Squats', 'Narrow Push-Up to Tuck'],
      ['Wall Tricep Extensions', 'Kneeling Tucked Tricep Push-Ups', 'Kneeling Diamond Push-Ups', 'Plank Up-Downs', 'Floor Tricep Dips', 'Scissor Tricep Kickbacks'],
      ['Crunches', 'Mountain Climbers', 'Knee Touch Crunches', 'Alternating Toe Touches', 'Banana Hold'],
      ['Lying Back Flies', 'Horizontal Pull-Ups', 'Upward Dog Push-Ups', 'Kneeling Bodyweight Rows', 'Reacher Rows', 'Alternate Back Raises'],
      ['Shadow Kettlebell Swings', 'Leaning Rear Deadlifts', 'Hamstring Heel Curls', 'Nordic Curl Negatives', 'Plank Kickbacks', 'Back Lunge to Shadow Curls'],
      ['Shadow Flex Bicep Curls', 'Reverse-Grip Wall Push-Ups', 'Backward Palm Curls', 'Leg Bicep Curls', 'Body Drag Lat Pulls'],
      ['Crunches', 'Sit-Ups', 'Cross-Legged Crunches Right', 'Cross-Legged Crunches Left', 'Bicycle Crunches', 'Superman Hold'],
      ['Stationary Lunges', 'Plie Squats', 'Squat Hold Hip Abductors', 'Kneeling Hip Thrusts', 'Bear Crawl'],
      ['Kneeling Shoulder Press Push-Ups', 'Inchworms', 'Quadruped Thoracic Rotations', 'Hindu Push-Ups', 'Superman I, Y, T'],
      ['Pike to Hindu Push-Ups', 'Tiger Bend Push-Ups', 'Alligator Push-Ups', 'Crab Walks', 'Bear Crawls'],
      ['Hollow Body Rocks', 'Dead Bugs', 'V-Ups', 'Oblique V-Ups', 'Russian Twists', 'Spiderman Planks'],
    ),
    burpees: ['Standard Burpees', 'Jumping Jacks · Active Rest', 'Burpees with a Push-Up', 'Burpees with a Jump', 'Burpees with a Push-Up Jump', 'Burpees with a Single-Leg Hop', 'Burpees with a Frog Jump', 'Burpees with a Star Jump', 'Burpees with a Double Push-Up', 'Burpees with a Bear Crawl'],
  },
  INTERMEDIATE: {
    days: bw(
      ['Push-Ups', 'Incline Push-Ups', 'Decline Push-Ups', 'Diamond Push-Ups', 'Wide Push-Ups', 'Tyson Push-Ups and Leg Jacks'],
      ['Full Depth Squats', 'Plie Squats', 'Ninja Squats Strong Leg', 'Ninja Squats Weak Leg', 'Wide to Narrow Squats', 'Diamond Push-Up to Jump Squat'],
      ['Tricep Push-Ups', 'Diamond Push-Ups', 'Plank-Ups with Tricep Extension', 'Bodyweight Skull Crushers', 'Hand-Over-Top Push-Ups', 'Forearm Plank Rocks'],
      ['Reverse Crunches', 'Plank Hip Dips', 'Mountain Climbers', 'Bicycle Crunches', 'Sit-Ups', 'Superman Hold'],
      ['Reverse Snow Angels', 'Chaturanga Push-Ups', 'Body Drag Lat Pulldowns', 'Straight Arm Pulldowns', 'Back Extensions with Trap Pinch', 'T Push-Ups to Shadow Swings'],
      ['Single-Leg Deadlifts', 'Single-Leg Deadlifts', 'Wall Half Nordic Curls', 'Static Side Lunge Right', 'Static Side Lunge Left', 'Mixed-Grip Push-Up to Tuck'],
      ['Pseudo Planche Push-Ups', 'Single-Leg Bicep Curl Left', 'Single-Leg Bicep Curl Right', 'Towel Hammer Curl Drag', 'Towel Bicep Curl Drag'],
      ['V-Up to Knee Tuck', 'L-Sit to Tuck Hold', 'Pike-Ups with Knee Tuck', 'Twisting Mountain Climbers', 'Hollow to Arch Hold', 'Table Top Hold'],
      ['Reverse Lunges', 'Plyo Squats', 'Skater Lunges', 'Donkey Kicks', 'Glute Bridge', 'Reverse Bear Crawl with Hamstring Curl'],
      ['Pike Push-Ups', 'Pike Push-Ups with Leg Lifts', 'Reverse Push-Ups', 'Thoracic Rotations Right', 'Thoracic Rotations Left', 'Burpees'],
      ['Renegade Row Push-Ups', 'T Push-Ups', 'Shoulder Blade Squeeze', 'Bird Dog', 'Dolphin Push-Ups', 'Plank Side Walk to Russian Push-Ups'],
      ['Butterfly Sit-Ups with Twist', 'Side Plank Leg Lift and Dip', 'Single-Leg Jackknife Sit-Ups', 'Bicycle Crunch with Reach', 'V-Sit Leg Lift and Reach', 'Side Plank Hold'],
    ),
    burpees: ['Standard Burpees', 'Jumping Jacks · Active Rest', 'Burpees with a Push-Up', 'Burpees with a Jump', 'Burpees with a Tuck Jump', 'Burpees with an Elevator Squat Jump', 'Burpees with a Double Push-Up', 'Burpees with a Double Jump', 'Burpees with a High Jump', 'Burpees with a Leg Tuck', 'Burpees with a 180 Jump'],
  },
  ADVANCED: {
    days: bw(
      ['Alternating One-Arm Push-Ups', 'Knuckle Push-Ups', 'Dive Bombers', 'Tornado Push-Ups', '45 Degree Push-Ups', 'Tuck Push-Ups'],
      ['Single-Leg Squat to Curtsy', 'Tiptoe Deep Squats', 'Deep Sissy Squats', 'Single-Leg Squat Roll Right', 'Single-Leg Squat Roll Left', 'Body Dip to Body Roll Squat'],
      ['Russian Push-Ups', 'Four-Level Tricep Extensions', 'Typewriter Push-Ups', 'Typewriter to Archer Push-Ups', 'Fist Roll Tricep Push-Ups', 'Straight Arm to Forearm Plank'],
      ['Tuck Dragon Hold', 'Tuck Dragon Side Hold Left', 'Tuck Dragon Side Hold Right', 'Tuck Dragon Thrust', 'Reverse Dragon Flag', 'Flutter Kick Hold'],
      ['Straight Arm Pulldowns', 'Wall Rear Delt Flys', 'Back Extensions', 'Back Windows'],
      ['Wall Nordic Curls', 'Single-Leg Hip Thrust Right', 'Single-Leg Hip Thrust Left', 'Single-Leg Curtsy Lunge', 'Russian Lunge', 'Squat to Headstand'],
      ['Reverse Knuckle Planche Push-Ups', 'Body Saw', 'Double Leg Bicep Curl', 'Leg Resist Curls Left', 'Leg Resist Curls Right', 'Plank to Shadow Bicep Curl'],
      ['Reverse Plank', 'Windshield Wipers', 'Twisting Reverse Crunches', 'Seated Leg Tucks', 'Twisting Scissor Kicks', 'Cobra Hold'],
      ['Double Pulse Squat to 180 Jump', 'Alternating Ninja Lunges', 'Single-Leg Jump Squats Right', 'Single-Leg Jump Squats Left', 'Deep Narrow Tiptoe Hack Squats'],
      ['Pike Push-Ups', 'Pike Shoulder Press', 'Back Bridge', 'Pseudo Low Push-Ups', 'Wall Handstand Shoulder Taps', 'Uneven Pike Push-Ups'],
      ['Crow Pose to Chaturanga', 'Twisting Spiderman Push-Ups', 'Alternating Grip Push-Ups', 'Archer Push-Ups', 'Clapping Diamond Push-Ups', 'Kick-Out Push-Ups'],
      ['L-Sit to V-Sit', 'Plank Leg Lift and Side Crunch', 'Spiderman Plank Crunches', 'Twisting Scissor Kicks', 'Side Plank Knee Tuck', 'Russian Twist Hold'],
    ),
    burpees: ['Standard Burpees', 'Jumping Jacks · Active Rest', 'Burpees with Push-Ups', 'Burpees with a Double Squat', 'Burpees with Push-Ups and a Double Squat', 'Burpees with a Broad Jump and Tuck Jump', 'Burpees with a Plyo Push-Up', 'Burpees with a 360 Jump', 'Burpees with a Dive Bomber', 'Burpees with a Hand-Release Push-Up', 'Burpees with a Side-to-Side Jump', 'Burpees with a Spiderman Push-Up', 'Burpees with a Jackknife'],
  },
};


export const PLAN_PROGRAMS = [
  {
    id: 'shadowbox_mini', title: '7-DAY SHADOWBOX MINI', category: 'fight', discipline: 'Kickboxing',
    meta: 'Beginner · 7 days · no equipment',
    blurb: 'A week of kickboxing fundamentals: jab and footwork, jab-cross, kicks and knees, head movement, hooks and uppercuts, combos, then freestyle.',
    days: [
      ['JAB + FOOTWORK', ['Step and Slide Footwork', 'Jab Focus', 'Shadowbox · Jab and Move']],
      ['JAB-CROSS + GUARD', ['Jab-Cross', 'Guard Snap-Back', 'Combo Flow']],
      ['KICKS + KNEES', ['Lead and Rear Roundhouse', 'Check Kick', 'Rear Knee to Teep']],
      ['SLIPS + WEAVES', ['Slip Drill', 'Duck and Reset', 'Slip, Duck and Counter']],
      ['HOOKS + UPPERCUTS', ['Hook-Uppercut Focus', 'Step to the Side After a Strike', 'Freestyle · Hooks and Uppercuts']],
      ['COMBO BURSTS', ['Jab, Cross, Hook, Rear Roundhouse', 'Rear Uppercut, Hook, Cross, Rear Knee', 'Freestyle Burst']],
      ['FREESTYLE', ['One to Four Strike Combos', 'Non-Stop Striking', 'Speed and Power Strikes']],
    ].map(([label, drills]) => ({
      label,
      build: () => [
        t('Warm-Up Circuit', 300, 15), t('Dynamic Stretches', 180, 15), r('Push-Ups', 20, 30), r('Hindu Squats', 30, 30),
        ...repeat(3, drills.map(d => t(d, 30, 30))),
      ],
    })),
  },
  {
    id: 'bodyweight_week', title: 'BODYWEIGHT WEEK', category: 'fit',
    meta: 'All levels · 6 days · no equipment',
    blurb: 'Six muscle days with sets and reps, no gear: chest, legs, back, hamstrings, arms and shoulders, calves and full body.',
    days: [
      ['CHEST + TRICEPS + CORE', [[3, r, 'Incline Push-Ups', 12], [3, r, 'Wide Push-Ups', 10], [3, r, 'Diamond Push-Ups', 8], [3, r, 'Sphinx Push-Ups', 8], [3, t, 'Plank', 45], [2, r, 'Sit-Ups', 20]]],
      ['LEGS + GLUTES + CORE', [[3, r, 'Hindu Squats', 15], [3, r, 'Reverse Lunges', 20], [3, r, 'Hack Squats', 10], [3, r, 'Bodyweight Good Mornings', 15], [3, r, 'Glute Bridge', 20], [3, r, 'Cherry Pickers', 20]]],
      ['BACK + BICEPS', [[3, r, 'Door Frame Rows', 10], [3, r, 'Single-Arm Door Rows', 16], [3, r, 'Reverse Snow Angels', 15], [3, t, 'Superman Hold', 30], [3, t, 'Chin-Up Hold', 15]]],
      ['HAMSTRINGS + CORE', [[3, r, 'Sliding Hamstring Curls', 12], [3, r, 'Shadow Deadlifts', 15], [3, r, 'Glute Bridge', 20], [2, r, 'Cross-Legged Crunches', 30], [2, t, 'Plank', 30]]],
      ['ARMS + SHOULDERS + CORE', [[3, r, 'Chair Dips', 10], [3, r, 'Wide Dips', 10], [3, r, 'Tyson Push-Ups', 8], [3, r, 'Pike Military Press', 8], [2, r, 'Sit-Ups', 20], [2, r, 'Crunches', 25]]],
      ['CALVES + FULL BODY', [[3, r, 'Push-Ups', 15], [3, r, 'Sumo Squats', 15], [2, t, 'Side Plank', 30], [2, r, 'Cross-Legged Crunches', 20], [3, t, 'Calf Raises · to Failure', 45], [3, t, 'Reverse Calf Raises · to Failure', 45]]],
    ].map(([label, moves]) => ({
      label,
      build: () => moves.flatMap(([n, kind, name, dose]) => sets(n, () => kind(name, dose, 45))),
    })),
  },
  ...['BEGINNER', 'INTERMEDIATE', 'ADVANCED'].map((level) => {
    const L = BW_CIRCUIT[level];
    return {
      id: `bw_circuit_${level.toLowerCase()}`, title: `BODYWEIGHT CIRCUIT · ${level}`, category: 'fit', pro: level !== 'BEGINNER',
      meta: `${level.charAt(0) + level.slice(1).toLowerCase()} · 4 days · 40s on / 20s off`,
      blurb: 'Compound circuits by muscle group — six moves per group, a transition move to finish each block — plus Burpee Hell on day four.',
      days: [
        ...L.days.map(([label, moves]) => ({
          label,
          build: () => [...(level === 'BEGINNER' ? WARMUP : WARMUP_JUMPS), ...moves.map(m => t(m, 40, 20)), t('Stretch', 120, 1)],
        })),
        { label: 'BURPEE HELL', build: () => [...WARMUP, ...L.burpees.map((m, i, a) => t(m, 40, i === a.length - 1 ? 5 : 20))] },
      ],
    };
  }),
  ...[
    ['Boxing', ['Straights', 'Hooks', 'Uppercuts', 'All Round', 'Interval Calisthenics', 'Inside Fighting', 'Outside Fighting', 'In and Out', 'Speed', 'Power Strikes', 'Non-Stop Striking'],
      ['Warm-Up Shadowboxing', 'Defense · Blocks and Movement', 'Feints', 'Simple Combos', 'Inside Fighting', 'Outside Fighting', 'Interval Calisthenics', 'Super Defense · Slips, Ducks, Pull-Backs', 'Simple and Fast', 'Hyper Defense · Counters', 'All Round', '20 · 40 · 60 Percent Striking']],
    ['Kickboxing', ['Boxing Focus', 'Teeps and Side Kicks', 'Knees', 'Roundhouse', 'All Round', 'Interval Calisthenics', 'Inside Fighting', 'Outside Fighting', 'In and Out', 'Speed', 'Power Strikes', 'Non-Stop Striking'],
      ['Warm-Up Shadowboxing', 'Defense · Blocks and Movement', 'Feints', 'Simple Combos', 'Inside Fighting', 'Outside Fighting', 'Interval Calisthenics', 'Super Defense · Slips, Ducks, Pull-Backs', 'Simple and Fast', 'Hyper Defense · Counters', 'All Round', '20 · 40 · 60 Percent Striking']],
    ['Muay Thai', ['Boxing Focus', 'Elbows', 'Teeps and Side Kicks', 'Roundhouse', 'All Round', 'Interval Calisthenics', 'Inside Fighting', 'Shadow Clinch', 'Outside Fighting', 'In and Out', 'Speed', 'Power Strikes', 'Non-Stop Striking'],
      ['Defense · Blocks and Movement', 'Warm-Up Shadowboxing', 'Feints', 'Simple Combos', 'Inside Fighting', 'Outside Fighting', 'Interval Calisthenics', 'Super Defense · Slips and Pull-Backs', 'Simple and Fast', 'Hyper Defense · Counters', 'All Round', '20 · 40 · 60 Percent Striking']],
    ['MMA', ['Boxing Focus', 'Muay Thai Focus', 'Ground Focus', 'All Round', 'Interval Calisthenics', 'Inside Fighting', 'Outside Fighting', 'In and Out', 'Speed', 'Power Strikes', 'Non-Stop Striking'],
      ['Defense · Blocks, Movement, Sprawls', 'Warm-Up Shadowboxing', 'Feints', 'Shootboxing', 'Ground Defense · Sprawls and Solo Movement', 'Simple Combos', 'Interval Calisthenics', 'Super Defense · Slips, Pull-Backs, Sprawls', 'Simple and Fast', 'Hyper Defense · Counters', 'All Round', '20 · 40 · 60 Percent Striking']],
  ].map(([disc, v1, v2]) => ({
    id: `shadowbox_${disc.toLowerCase().replace(/\s+/g, '_')}`, title: `SHADOWBOX ROUTINE · ${disc.toUpperCase()}`, category: 'fight', discipline: disc,
    pro: disc !== 'Boxing',
    meta: `${disc} · 2 days · 2:00 rounds`,
    blurb: 'Two full shadowboxing sessions: version one works each weapon and range, version two builds defense, feints and pace.',
    days: [{ label: 'VERSION I', build: () => shadowboxRoutine(disc, v1) }, { label: 'VERSION II', build: () => shadowboxRoutine(disc, v2) }],
  })),
  {
    id: 'gravity_chamber', title: 'THE GRAVITY CHAMBER', category: 'fit', pro: true,
    meta: 'Intermediate · 4 days · slow tempo',
    blurb: 'Every set gets slower: one second up and down, then two, then three, until you can’t control it. Push, legs, core and pull days.',
    days: [
      ['PUSH', ['Tempo Push-Ups', 'Diamond Push-Ups', 'Pseudo Planche Push-Ups', 'Dips', 'Slow Plank Tricep Extensions'], 'Finisher · 3-Second Push-Ups', ['Arms Across Stretch', 'Arms Behind the Back']],
      ['LEGS', ['Tempo Squats', 'Bulgarian Split Squats', 'Elevator Squats', 'Jump Squats', 'Wall Sit Hold'], 'Finisher · 3-Second Full Squats', ['Lunge Stretch', 'Deep Squat to Hamstring Stretch']],
      ['CORE', ['Hanging Knee Raises', 'Reverse Crunches', 'Slow Russian Twists', 'Plank to Push-Ups', 'Hollow Body Hold', 'Slow Tyson Push-Ups', 'Slow Dive Bombers'], 'Finisher · Plank Hold for Max Time', []],
      ['SHOULDERS + PULL', ['Slow Pike Push-Ups', 'Handstand Hold', 'Slow Negative Pull-Ups', 'Super Slow Shoulder Taps', 'Slow Bodyweight Rows', 'Slow Tyson Push-Ups', 'Slow Dive Bombers'], 'Finisher · Plank Hold for Max Time', []],
    ].map(([label, moves, finisher, stretches]) => ({
      label,
      build: () => [...WARMUP, ...repeat(4, moves.map(m => t(m, 45, 45))), t(finisher, 90, 30), ...stretches.flatMap(s => sets(2, () => t(s, 30, 10)))],
    })),
  },
  {
    id: 'the_destroyer', title: 'THE DESTROYER', category: 'fit', pro: true,
    meta: 'Advanced · 5 days · gym or bodyweight',
    blurb: 'Weighted strength, bodyweight density and fight-ready calisthenics. Every weighted day lists its bodyweight swap.',
    days: [
      { label: 'NECK + SHOULDERS', workoutType: 'Hybrid', build: () => [...WARMUP, ...repeat(3, [r('Neck Curls · Front and Back', 25, 30), r('Lateral Neck Flexions', 25, 30)]), ...repeat(4, [r('Military Press', 8, 60), r('Dumbbell Lateral Raises', 15, 60), r('Kirk Shrugs', 15, 60)])] },
      { label: 'LEGS', workoutType: 'Hybrid', build: () => [...WARMUP, ...repeat(3, [r('Heels-Up Goblet Squats', 15, 60), t('Narrow, Mid, Sumo Squat Burnout', 45, 60), r('Bulgarian Split Squats', 10, 60)]), ...repeat(4, [r('Kettlebell Pulse Swings', 25, 30), r('Kettlebell Swing to Calf Raise', 25, 60)])] },
      { label: 'LATS + UPPER BACK', workoutType: 'Hybrid', build: () => [...WARMUP, ...repeat(4, [r('Wide-Grip Pull-Ups', 10, 120), r('Wide-Grip Chin-Ups', 10, 120), r('Bent-Over Rows', 12, 120), r('Lat Pulldowns', 12, 120)]), ...repeat(2, [t('Inverted Rows', 45, 60), r('Face Pull Rows', 15, 60)])] },
      { label: 'HIGH-REP BODYWEIGHT', build: () => [...WARMUP, ...sets(3, () => t('Dive Bomber Push-Ups', 45, 45)), ...sets(5, () => r('Jump Squats', 25, 30)), ...sets(3, () => r('Archer Pull-Ups', 8, 60)), ...sets(3, () => t('Tiger Rock Push-Ups', 45, 45)), ...sets(4, () => t('V-Ups and Flutter Kicks', 45, 30)), t('Finisher · One-Arm Push-Ups', 60, 30), t('Shadowboxing with Resistance', 60, 1)] },
      { label: 'CARDIO RECOVERY', build: () => [t('Pick One · Jog, Bike, Jump Rope or Freestyle Shadowboxing', 1800, 30), t('Yoga Flow Stretch', 600, 1)] },
    ],
  },
  {
    id: 'flow_state', title: 'FLOW STATE', category: 'fit', pro: true,
    meta: 'Advanced · 4 days · strength, plyo, footwork',
    blurb: 'Build the body that reacts before it thinks: strength and control, explosive plyometrics, footwork and reflexes, then a high-volume hybrid.',
    days: [
      { label: 'STRENGTH + CONTROL', workoutType: 'Hybrid', build: () => [...WARMUP, ...sets(4, () => r('Jumping Dumbbell Squats', 8, 120)), ...sets(5, () => r('Muscle-Ups', 5, 120)), ...sets(3, () => r('Dumbbell Clean to Snatch', 8, 120)), ...sets(3, () => t('L-Sit to V-Up Flow', 45, 120)), ...sets(2, () => t('Farmer Carries', 30, 60))] },
      { label: 'PLYOMETRICS', build: () => [...WARMUP, ...sets(5, () => r('Burpees with High Jumps', 10, 45)), ...sets(4, () => r('Explosive Uneven Push-Ups', 12, 45)), ...sets(4, () => r('Ball Throw to Squat Catch', 10, 45)), ...sets(3, () => r('Wall Ball to Sprawl', 10, 45))] },
      { label: 'FOOTWORK + REFLEXES', build: () => [...repeat(2, [t('High Knees', 60, 5), t('Ickey Shuffle', 60, 5), t('Side Steps', 60, 5), t('Ali Shuffle', 60, 5)]), ...repeat(2, [t('In and Outs', 30, 30), t('Side Step Hops', 30, 30), t('Back Pedal to Cross Step', 30, 30), t('Freestyle Strikes over a Line', 30, 30)]), ...repeat(2, [t('Cone Sprints', 60, 30), t('Side Jump and Sprawl', 60, 30), t('Forward-Back Jumps', 60, 30), t('Angle Shadowboxing', 120, 30)]), ...['Standard Jump', 'Depth to 180 Jump', 'Depth to Tuck Jump', 'Depth Jump, High Jump, Burpee, Sprint'].map(m => r(m, 5, 20))] },
      { label: 'HIGH-VOLUME HYBRID', build: () => [...WARMUP, ...sets(4, () => r('High-Rep Squats', 50, 60)), ...sets(3, () => r('Half-to-Full Push-Ups', 30, 60)), ...sets(3, () => r('Single-Arm Inverted Rows', 10, 60)), ...sets(3, () => r('Pike-Ups', 12, 60)), ...sets(3, () => r('Dips', 15, 60)), ...sets(2, () => r('Tuck-Ins', 30, 45)), ...sets(2, () => r('Russian Twists', 40, 45)), ...sets(2, () => r('Crunches', 50, 45)), ...sets(2, () => r('V-Ups', 20, 1))] },
    ],
  },
  {
    id: 'the_mercenary', title: 'THE MERCENARY', category: 'fit', pro: true,
    meta: 'Advanced · 4 days · high rep, heavy, explosive',
    blurb: 'Train like you’re swinging a greatsword: high-rep calisthenics, heavy lifts, a kettlebell circuit and explosive jumps.',
    days: [
      { label: 'CALISTHENICS POWER', build: () => [...WARMUP, ...repeat(2, [r('Push-Ups', 100, 120), r('Sit-Ups', 50, 60), r('Pull-Ups', 20, 120), t('Assisted Single-Arm Push-Ups', 45, 120), r('Assisted Single-Arm Pull-Ups', 8, 120), t('Walking Lunges', 60, 120), r('Bodyweight Squats', 50, 120), r('Frog Leaps', 12, 120)]), t('Finisher · Farmer Walk', 180, 1)] },
      { label: 'HEAVY LIFTS', workoutType: 'Weighted', build: () => [...WARMUP, ...repeat(3, [r('Heavy Back Squats', 8, 120), r('Front Squats', 12, 120), r('Standing Shoulder Press', 15, 120), r('Axe Chops', 12, 120), r('Reverse Axe Chops', 12, 120), r('Torso Twists', 12, 120)])] },
      { label: 'KETTLEBELL CIRCUIT', workoutType: 'Weighted', build: () => [...WARMUP, ...repeat(4, [t('American Swings', 30, 30), t('Kettlebell Halo Press', 30, 30), t('Atlas Swings', 30, 30), t('Single-Arm Crossbody Snatch', 30, 30), t('Jumping Goblet Squats', 30, 30)]), ...repeat(3, [t('Battle Ropes · Alternating Waves', 30, 30), t('Battle Ropes · Diagonal Swings', 30, 30)])] },
      { label: 'EXPLOSIVE', build: () => [...WARMUP, ...repeat(2, [r('Broad Jumps', 8, 30), r('Depth Jumps', 6, 30), r('Long Jump to Burpee', 6, 30), r('180 Jump Squats', 12, 30), r('Single-Leg Box Jumps', 12, 30), r('Dive Bomber Push-Ups', 10, 30), r('Explosive Step-Ups', 20, 30)]), t('Finisher · Knees to Elbows, Thrusters, Burpees AMRAP', 600, 1)] },
    ],
  },
  {
    id: 'the_hawk', title: 'THE HAWK', category: 'fit', pro: true,
    meta: 'Intermediate · 3 days · high rep, kettlebell, upper body',
    blurb: 'Warrior conditioning built on volume: high-rep legs, a kettlebell cycle and an upper-body day with a full-body complex to finish.',
    days: [
      { label: 'HIGH-REP LEGS', build: () => [...WARMUP, ...repeat(3, [r('Hindu Squats', 50, 60), r('Sumo Squats', 40, 60), r('Reverse Lunges with Torso Twist', 30, 60), r('Single-Leg Hip Thrust', 30, 60), r('Deep Bodyweight RDLs', 30, 60), r('Calf Raises', 40, 60)]), t('Finisher · Bear Crawl and Duck Walk', 300, 1)] },
      { label: 'KETTLEBELL CYCLE', workoutType: 'Weighted', build: () => [...WARMUP, ...repeat(4, [r('Kettlebell Swings', 10, 45), r('American Swings', 10, 45), r('Reverse Axe Chops', 10, 45), r('Around-the-World Catch', 10, 45), r('Goblet Squat Press', 10, 45)]), r('Bonus · Kettlebell Snatch per Side', 20, 1)] },
      { label: 'UPPER BODY + COMPLEX', build: () => [...WARMUP, ...repeat(3, [r('Low Push-Ups', 30, 60), r('Archer Push-Ups', 10, 60), r('Hanging Rows', 15, 60), t('Pull-Ups to Failure', 45, 60), r('Pike Push-Ups', 15, 60)]), ...repeat(3, [r('Push-Ups', 15, 5), r('Lunges', 20, 5), r('Pike Push-Ups', 12, 5), r('Squats', 30, 5), r('Reverse Lunge to Knee Drive', 20, 60)]), ...repeat(2, [t('Hanging Crunches', 60, 15), t('V-Ups', 60, 15), t('Russian Twists', 60, 15), t('Plank Hold', 60, 30)])] },
    ],
  },
  {
    id: 'dark_fist', title: 'DARK FIST', category: 'fight', pro: true, discipline: 'MMA',
    meta: 'Advanced · 2 days · shadow + bag',
    blurb: 'A fighting-game-inspired striking session: spinning kicks, jumping knees and demon-rush chains in the air, then on the bag, then a slam circuit.',
    days: [
      { label: 'SHADOWBOXING', build: () => [t('Jump Rope', 180, 5), t('Arm Circles', 60, 5), t('Lunge Hops', 60, 5), t('Bounce Footwork', 120, 5), t('Air Leg Kicks', 120, 30),
        ...['Double Jab, Low Teep, Cross, Feint Teep, Rear Elbow', 'Dash Jab, Step Cross, Spinning Kick', 'Cross, Jumping Hook, Palm Push', 'Jab, Low Kick, Overhand, Side Step', 'One-Two, Duck, Uppercut, Spinning Elbow', 'Feint, Cross, Hook, Jumping Spin Kick', 'Dash, Low Kick, Cross, Rising Uppercut', 'Spinning Kick, Cross, Guard', 'Hook, Elbow, Elbow, Knee', 'Blitz · Jab, Hook, Low Kick, Cross', 'Jumping Knee, Hook, Low Kick, Palm Push'].map(c => t(c, 120, 30))] },
      { label: 'BAG WORK + SLAMS', workoutType: 'Hybrid', build: () => [t('Jump Rope', 180, 30),
        ...['Dash Cross, Rear Kick, Elbow', 'Cross, Rising Uppercut, Cross', 'Hook, Jumping Knee, Hook', 'Cross, Hook, Spinning Kick', 'Three-Kick Chain', 'Elbow, Elbow, Knee, Sprawl', 'Overhand, Body Shot, Jumping Kick', 'Low Kick, Hook, Hook, Cross', 'Uppercut, Hook, Cross, Flying Knee', 'Double Med Ball Slam'].map(c => t(`Bag · ${c}`, 180, 60)),
        ...repeat(5, [t('Jumping Med Ball Slam', 30, 30), t('Sandbag Slam', 30, 30), t('Burpee to Muscle-Up', 30, 30)])] },
    ],
  },
  {
    id: 'the_wanderer', title: 'THE WANDERER', category: 'fight', pro: true, discipline: 'Kickboxing',
    meta: 'Advanced · 2 days · shadow + bag',
    blurb: 'A classic martial artist’s session: rising uppercuts, spinning heel kicks and chain combos, shadowboxed, then on the bag, then speed knees and sprints.',
    days: [
      { label: 'SHADOWBOXING', build: () => [t('Jump Rope', 180, 5), t('Arm Circles', 60, 5), t('Lunge Hops', 60, 5), t('Bounce Footwork', 120, 5), t('Jumping Kicks', 120, 30),
        ...['Jab, Cross, Step-In Rising Uppercut', 'Cross, Hook, Spinning Roundhouse', 'Low Kick, Hook, Jumping Spin Kick', 'One-Two, Dash, Cross, Elbow', 'Feint, Cross, High Kick', 'Jab, Jab, Step Hook, Cross', 'Roundhouse, Cross, Step Knee', 'Double Jab, Cross, Spinning Heel Kick', 'Jump Kick, Hook, Elbow, Guard Up', 'Jab, Fake Cross, Spinning Hook Kick'].map(c => t(c, 120, 30))] },
      { label: 'BAG WORK + CIRCUIT', workoutType: 'Hybrid', build: () => [t('Jump Rope', 180, 30),
        ...['Jab, Rear Low Kick, High Kick', 'Jumping Hook, Rising Uppercut', 'Four Jabs, Cross, Rear Kick', 'Roundhouse, Hook, Hook, Elbow', 'Hook, Cross, Step-Through Knee', 'Spinning Kick, Hook, Low Kick', 'Cross, Hook, Uppercut, Spinning Back Kick', 'Dash Jab, Jab, Jumping Roundhouse', 'Overhand, Body Shot, Knee, Switch Kick', 'Med Ball Wall Throw'].map(c => t(`Bag · ${c}`, 180, 45)),
        ...repeat(2, [t('Speed Knees on the Bag', 120, 60), t('Burpee Jump, Lateral Tuck, Sprint', 60, 60), t('Ball Slam to Overhead Throw', 60, 60)])] },
    ],
  },
];

// ── program-day rotation + the mission a day runs ───────────────────────────
const ROT_PREFIX = 'tm_plan_day_';
export function planDayIndex(p) {
  try { return (parseInt(localStorage.getItem(ROT_PREFIX + p.id), 10) || 0) % p.days.length; } catch { return 0; }
}
function advancePlanDay(p, idx) {
  try { localStorage.setItem(ROT_PREFIX + p.id, String(idx + 1)); } catch { /* best-effort */ }
}

export const planById = (id) => PLAN_PROGRAMS.find(p => p.id === id) || null;

// Builds the next day's mission. The rotation does NOT advance here - quitting
// halfway would skip the day; completePlanDay moves it on at the finish.
export function startPlanDay(p) {
  const idx = planDayIndex(p);
  const day = p.days[idx];
  const exercises = day.build();
  return {
    title: `${p.title} · ${day.label}`,
    workoutType: day.workoutType || 'Bodyweight',
    duration: estimateMinutes(exercises),
    difficulty: 'Hard',
    format: 'Auto',
    focus: p.category === 'fight' ? 'Combat' : 'Full Body',
    exercises,
    finisherExercises: [],
    rounds: 1,
    cardioFinisher: false,
    named: `${p.id}:${idx}`,
    planId: p.id,
    planDay: idx,
  };
}

// The plan day a mission came from is done: advance the rotation, but only if
// that day is still the one up next (a replay never skips ahead).
export function completePlanDay(mission) {
  const p = mission?.planId ? planById(mission.planId) : null;
  if (!p || !Number.isInteger(mission.planDay)) return;
  if (planDayIndex(p) === mission.planDay) advancePlanDay(p, mission.planDay);
}

export function planDayMinutes(p, idx) {
  return estimateMinutes(p.days[idx].build());
}
