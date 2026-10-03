// WARRIOR QUEEN — concept drop for Jun–Jul. Inspired by the Amazon warrior
// princess (Wonder Woman): the owner's "Muscular Goddess Mode" week — CrossFit,
// strongwoman and power conditioning for a strong, athletic frame with
// powerful legs, shoulders and core. Character, island and franchise names
// stay out of the app; shield, bracers, spear and the Olympian flavour carry
// the identity.
//
// Four training days a week: POWER · GLUTES + CORE · BATTLE DAY (metcon) ·
// HYPERTROPHY. It needs a gym, so every gym movement carries:
//   • row.easy — the ROOKIE version (dumbbells for barbells, step-ups for box
//     jumps, lying for hanging), used exactly as written.
//   • row.hard — the ELITE version where it changes.
//   • row.home — the no-gym version (water jugs, a backpack, a chair, a
//     door bar). A tier alternate may carry its own `home` for the ROOKIE.
// Wide-grip pull-ups run the pull-up ladder: start on your rung, move up.
//
// Fight: kickboxing. Shield and bracers (blocks, parries, counters), the
// lasso (clinch and knees), power kicks, and a battlefield day of multiple
// opponents. Every day's last round ends with the BRACER STORM super.

const s = (n) => `${n}s`;
const R = (name, sets, n, rest, equip, extra = {}) => ({ name, sets, ...(typeof n === 'string' ? { seconds: parseInt(n, 10) } : { reps: n }), rest, equip, ...extra });

// Pull-up ladder (the assisted-if-needed script). The athlete runs their
// current rung; hitting its target twice moves them up.
const L = (name, sets, n, rest, extra = {}) => R(name, sets, n, rest, 'bodyweight', extra);
const LADDERS = {
  'pull-up': { title: 'Pull-up', start: { easy: 2, normal: 3, hard: 6 }, rungs: [
    L('Dead Hang', 3, s(30), 60, { note: 'Shoulders active, not shrugged.', home: { name: 'Towel Hang' } }),
    L('Scapula Pull-Ups', 3, 10, 60, { note: 'Straight arms. Pull the shoulders down and back.', home: { name: 'Table Rows' } }),
    L('Ring Rows', 3, 12, 60, { note: 'Feet on the floor, body straight, chest to the rings.', home: { name: 'Table Rows' } }),
    L('Band-Assisted Pull-Ups', 3, 8, 75, { note: 'Band under the knee or foot. Chin over the bar.', home: { name: 'Table Rows' } }),
    L('Pull-Up Negatives', 4, 5, 90, { note: 'Jump to the top, lower for five seconds.', home: { name: 'Table-Row Negatives' } }),
    L('Pull-Ups', 3, 6, 90, { note: 'Strict. Chin over the bar, full hang at the bottom.', home: { name: 'Towel Pull-Ups' } }),
    L('Wide-Grip Pull-Ups', 3, 8, 90, { note: 'Hands wider than the shoulders. Pull the elbows down to the ribs.', home: { name: 'Towel Pull-Ups' } }),
  ] },
};

// One super for every day's last round: a 30 s storm of strikes.
const BRACER_STORM = {
  name: 'Bracer Storm', every: 5,
  calls: ['Parry, cross, hook, rear kick', 'Block, jab, cross, lead knee', 'Jab, cross, hook, low kick', 'Check, cross, hook, rear roundhouse'],
  easy: { every: 6, calls: ['Jab, cross, hook', 'Block, cross'] },
};

export const WARRIOR_QUEEN = {
  id: 'warrior-queen',
  title: 'WARRIOR QUEEN',
  tagline: 'Built like a goddess, trained like a warrior. Lift, sculpt, fight.',
  reward: { title: 'WARRIOR QUEEN', xp: 500, frame: 'gold-tiara' },
  accent: '#f59e0b',
  tierLabels: { easy: 'ROOKIE', normal: 'NORMAL', hard: 'ELITE' },
  ladders: LADDERS,
  art: {
    poster: '/static/concepts/warrior-queen/poster.webp',
    wide: '/static/concepts/warrior-queen/wide.webp',
    card: '/static/concepts/warrior-queen/card.webp',
    arcade: '/static/series/posters/warrior-queen.webp', // silhouette Arcade banner
  },

  // Fit: 4 days a week for 4 weeks. Power, sculpt, battle, build.
  fit: {
    weeks: 4,
    minutes: 50,
    blurb: 'Strongwoman power, glutes and core, a battle-day metcon and a heroic build. Every gym lift has a rookie and a home version.',
    days: [
      {
        label: 'THE FORGE', focus: 'POWER + STRENGTH',
        intro: 'Warm up: 5 minutes of sled push or a brisk incline walk, then two rounds of Samson stretches. Heavy pulls and squats, explosive snatches and jumps, then carry something heavy.',
        exercises: [
          R('Deadlift', 4, 5, 150, 'barbell', { note: 'Heavy, but every rep clean. Brace, push the floor away, stand tall.',
            hard: { sets: 5, reps: 5, note: 'Heavy: one or two reps left in the tank.' },
            easy: { name: 'Dumbbell Romanian Deadlift', sets: 3, reps: 10, equip: 'dumbbell', note: 'Soft knees, hips back, flat back. Feel the hamstrings stretch.' },
            home: { name: 'Single-Leg Romanian Deadlift', reps: 10, equip: 'bodyweight', note: 'Each leg. A water jug or loaded backpack in the opposite hand.' } }),
          R('Front Squat', 4, 8, 120, 'barbell', { note: 'Elbows high, chest proud. Sit between the heels, drive up.',
            hard: { sets: 5, reps: 6, note: 'Heavier. Elbows never drop.' },
            easy: { name: 'Goblet Squat', sets: 3, reps: 10, equip: 'dumbbell', note: 'Dumbbell at the chest, elbows inside the knees.' },
            home: { name: 'Backpack Squats', equip: 'bodyweight', note: 'Loaded backpack hugged to the chest. Sit deep.' } }),
          R('Alternating Dumbbell Snatch', 3, 12, 75, 'dumbbell', { note: 'Six each arm. Hips snap, the bell floats up, punch it to the ceiling.',
            easy: { sets: 3, reps: 10, note: 'Light. Start from the hang: hips snap, pull high, punch up.' },
            home: { name: 'Jug Snatch', equip: 'bodyweight', note: 'Half-full water jug by the handle. Same snap, alternate hands.' } }),
          R('Box Jumps', 3, 10, 75, 'box', { note: 'Arms swing, land soft, stand tall, step down.',
            easy: { name: 'Box Step-Ups', sets: 3, reps: 8, note: 'Each leg. No jump yet: drive through the top foot.' },
            home: { name: 'Squat Jumps', equip: 'bodyweight', note: 'Low and soft. Land quiet.' } }),
          R('Push Press', 3, 8, 90, 'barbell', { note: 'Dip, drive with the legs, lock it out overhead. Ribs down.',
            easy: { name: 'Dumbbell Push Press', sets: 3, reps: 10, equip: 'dumbbell', note: 'Light dumbbells at the shoulders. Small dip, drive up.',
              home: { name: 'Jug Push Press', equip: 'bodyweight', note: 'Two water jugs or bottles at the shoulders.' } },
            home: { name: 'Pike Push-Ups', equip: 'bodyweight', note: 'Hips high, head between the hands. Shoulders do the work.' } }),
          R('Farmer Carry', 3, s(40), 60, 'kettlebell', { note: 'About 40 m. Heavy kettlebells, tall spine, shoulders down, short quick steps.',
            easy: { sets: 3, seconds: 30, note: 'About 30 m. Lighter bells, perfect posture.' },
            home: { name: 'Jug Farmer Carry', equip: 'bodyweight', note: 'Two full water jugs or loaded bags. Walk tall.' } }),
        ],
      },
      {
        label: 'THE SCULPTOR', focus: 'GLUTES + CORE',
        intro: 'Warm up: glute bridges, fire hydrants, hip circles. Strong hips, a strong core. Finish with three rounds of lunges, bridge hold and twists.',
        // Finisher: three rounds back to back (ROOKIE two).
        circuits: { finisher: { easy: 2, normal: 3, hard: 3 } },
        exercises: [
          R('Barbell Hip Thrusts', 4, 15, 90, 'barbell', { note: 'Shoulders on the bench, chin tucked. Drive through the heels, squeeze a full second at the top.',
            hard: { sets: 4, reps: 12, note: 'Heavier. Pause two seconds at the top.' },
            easy: { name: 'Light Dumbbell Hip Thrust', sets: 3, reps: 12, equip: 'dumbbell', note: 'Dumbbell on the hips. Squeeze at the top.' },
            home: { name: 'Single-Leg Glute Bridges', equip: 'bodyweight', note: 'Each leg. Shoulders on the sofa edge for more range.' } }),
          R('Bulgarian Split Squats', 3, 10, 75, 'dumbbell', { note: 'Each leg. Back foot on the bench, front shin vertical, lean slightly forward for glutes.',
            easy: { name: 'Supported Split Squat', sets: 3, reps: 10, equip: 'bodyweight', note: 'Each leg. Both feet on the floor, hand on a wall.' },
            home: { name: 'Bulgarian Split Squats', equip: 'bodyweight', note: 'Back foot on a chair. Backpack for load.' } }),
          R('Hanging Leg Raises', 3, 15, 60, 'bar', { note: 'Legs straight, no swing. Lower slowly.',
            hard: { name: 'Toes-to-Bar', sets: 3, reps: 12, note: 'Strict, no kip.' },
            easy: { name: 'Lying Leg Raises', sets: 3, reps: 12, equip: 'bodyweight', note: 'Low back pressed into the floor.' },
            home: { name: 'Lying Leg Raises', equip: 'bodyweight', note: 'Low back pressed into the floor.' } }),
          R('Cable Glute Kickbacks', 3, 15, 45, 'cable', { note: 'Each leg. Ankle strap, hips square, kick back and up, no arching.',
            easy: { name: 'Banded Glute Kickbacks', sets: 3, reps: 12, equip: 'band', note: 'Each leg. On all fours, band round the feet.' },
            home: { name: 'Standing Glute Kickbacks', equip: 'bodyweight', note: 'Each leg. Hand on a chair, slow, squeeze at the top.' } }),
          R('Side Plank with Reach-Under', 3, 12, 45, 'bodyweight', { note: 'Each side. Hips high, thread the top arm under, then reach to the sky.',
            easy: { name: 'Knee Side Plank', sets: 3, seconds: 20, reps: undefined, note: 'Each side. Knees down, hips high.' } }),
          R('Weighted Walking Lunges', 3, 20, 15, 'dumbbell', { circuit: 'finisher', note: 'Finisher round: 20 steps, dumbbells at the sides, then straight into the bridge.',
            easy: { name: 'Walking Lunges', sets: 2, reps: 16, equip: 'bodyweight', note: 'Bodyweight. Back knee kisses the floor.' },
            home: { name: 'Walking Lunges', equip: 'bodyweight', note: 'Backpack on for load.' } }),
          R('Glute Bridge Hold', 3, s(45), 15, 'bodyweight', { circuit: 'finisher', note: 'Hips high, squeeze, breathe.',
            easy: { sets: 2, seconds: 30 } }),
          R('Russian Twists', 3, 30, 60, 'bodyweight', { circuit: 'finisher', note: 'Tall chest, rotate from the ribs. Feet down if the back rounds.',
            easy: { sets: 2, reps: 20, note: 'Feet on the floor.' } }),
        ],
      },
      { rest: true, label: 'REST', focus: 'RECOVER', intro: 'Rest. A walk, hips and shoulders mobility.' },
      {
        label: 'BATTLE DAY', focus: 'METCON + CORE',
        intro: 'Warm up: rollouts and shoulder mobility. The battle is one circuit, round after round, 60 seconds rest after the rope. Then three rounds of core.',
        // Metcon: NORMAL 4 rounds, ELITE 5, ROOKIE 3. Core: 3 (ROOKIE 2).
        circuits: { metcon: { easy: 3, normal: 4, hard: 5 }, core: { easy: 2, normal: 3, hard: 3 } },
        exercises: [
          R('Dumbbell Thrusters', 4, 10, 10, 'dumbbell', { circuit: 'metcon', note: 'Squat deep, drive up, press in one move.',
            easy: { sets: 3, reps: 8, note: 'Light dumbbells. Squat to a comfortable depth.' },
            home: { name: 'Jug Thrusters', equip: 'bodyweight', note: 'Two water jugs or a backpack at the chest.' } }),
          R('Kettlebell Swings', 4, 10, 10, 'kettlebell', { circuit: 'metcon', note: 'Snap the hips. Arms are ropes.',
            easy: { name: 'Dumbbell Swings', sets: 3, reps: 10, equip: 'dumbbell', note: 'Light. Hinge, do not squat.' },
            home: { name: 'Backpack Swings', equip: 'bodyweight', note: 'Loaded backpack by the straps. Hinge and snap.' } }),
          R('Jump Lunges', 4, 10, 10, 'bodyweight', { circuit: 'metcon', note: 'Switch in the air, land soft. Ten total.',
            easy: { name: 'Reverse Lunges', sets: 3, reps: 10, note: 'Alternate legs. No jump.' } }),
          R('Burpee Broad Jumps', 4, 5, 10, 'bodyweight', { circuit: 'metcon', note: 'Burpee, then jump forward as far as you can. Stick it.',
            easy: { name: 'Step-Back Burpees', sets: 3, reps: 5, note: 'Step back, step in, stand. No jump.' },
            home: { name: 'Burpees', note: 'No room to jump forward: burpees in place.' } }),
          R('Jump Rope', 4, s(30), 60, 'rope', { circuit: 'metcon', note: 'Light on the balls of the feet. Then rest 60 seconds.',
            easy: { sets: 3, seconds: 30, note: 'Any rhythm. Trip, restart.' },
            home: { name: 'Imaginary Jump Rope', equip: 'bodyweight', note: 'No rope: same bounce, hands turning.' } }),
          R('Hanging Knee Raises', 3, 15, 10, 'bar', { circuit: 'core', note: 'Knees to the chest, no swing.',
            easy: { name: 'Lying Leg Raises', sets: 2, reps: 10, equip: 'bodyweight', note: 'Low back pressed down.' },
            home: { name: 'Lying Leg Raises', equip: 'bodyweight', note: 'Low back pressed down.' } }),
          R('Dead Bugs', 3, 12, 10, 'bodyweight', { circuit: 'core', note: 'Opposite arm and leg. Low back glued to the floor.' }),
          R('Cable Oblique Crunch', 3, 12, 45, 'cable', { circuit: 'core', note: 'Each side. Crunch down and across, ribs to hip.',
            easy: { name: 'Bicycle Crunches', sets: 2, reps: 12, equip: 'bodyweight', note: 'Each side. Slow, elbow to knee.' },
            home: { name: 'Bicycle Crunches', equip: 'bodyweight', note: 'Each side. Slow, elbow to knee.' } }),
        ],
      },
      {
        label: 'THE HEROIC BUILD', focus: 'HYPERTROPHY',
        intro: 'Warm up: band pull-aparts, arm circles, glute bridges. Controlled reps, full range, a strong squeeze. Then a three-round finisher.',
        circuits: { finisher: { easy: 2, normal: 3, hard: 3 } },
        exercises: [
          R('Wide-Grip Pull-Ups', 3, 8, 90, 'bar', { ladder: 'pull-up', note: 'Assisted if needed. Hands wide, elbows down to the ribs.',
            easy: { name: 'Ring Rows', sets: 3, reps: 12, note: 'Feet on the floor, body straight. Rung 3 of the pull-up ladder.' },
            home: { name: 'Towel Pull-Ups', note: 'Towel over a door bar, grip the towel, pull.' } }),
          R('Barbell Hip Thrusts', 4, 12, 90, 'barbell', { note: 'Heavier than the sculpt day. Squeeze a full second at the top.',
            easy: { name: 'Light Dumbbell Hip Thrust', sets: 3, reps: 12, equip: 'dumbbell', note: 'Dumbbell on the hips.' },
            home: { name: 'Single-Leg Glute Bridges', equip: 'bodyweight', note: 'Each leg. Shoulders on the sofa edge.' } }),
          R('Incline Dumbbell Press', 3, 10, 75, 'dumbbell', { note: 'Bench at 30°. Lower to the upper chest, press up and slightly in.',
            easy: { name: 'Light Dumbbell Chest Press', sets: 3, reps: 10, note: 'Flat bench or floor, light dumbbells.',
              home: { name: 'Incline Push-Ups', equip: 'bodyweight', note: 'Hands on a table or bench. Body in one line.' } },
            home: { name: 'Decline Push-Ups', equip: 'bodyweight', note: 'Feet on a chair. Chest to the floor.' } }),
          R('Pullover Crunch', 3, 12, 60, 'dumbbell', { note: 'Lying, dumbbell over the chest. Lower behind the head, then pull it over and crunch up.',
            easy: { sets: 3, reps: 10, note: 'Light dumbbell, small range.' },
            home: { name: 'Jug Pullover Crunch', equip: 'bodyweight', note: 'A water jug or a heavy book in both hands.' } }),
          R('Arnold Press', 3, 12, 60, 'dumbbell', { note: 'Palms in at the bottom, turn out as you press. Ribs down.',
            easy: { name: 'Seated Light Shoulder Press', sets: 3, reps: 10, note: 'Seated, light dumbbells, back supported.' },
            home: { name: 'Jug Arnold Press', equip: 'bodyweight', note: 'Two water bottles or jugs. Same turn.' } }),
          R('Single-Arm Kettlebell Swings', 3, 12, 10, 'kettlebell', { circuit: 'finisher', note: 'Each arm. Suitcase grip, hips snap, shoulders square.',
            easy: { name: 'Dumbbell Swings', sets: 2, reps: 10, equip: 'dumbbell', note: 'Two hands, light. Hinge and snap.' },
            home: { name: 'Backpack Swings', equip: 'bodyweight', note: 'Loaded backpack by the straps.' } }),
          R('Reverse Lunge to Step-Up', 3, 10, 10, 'box', { circuit: 'finisher', note: 'Each leg. Step back into a lunge, then drive up onto the box.',
            easy: { name: 'Light Step-Ups', sets: 2, reps: 8, equip: 'bodyweight', note: 'Each leg. Low step.' },
            home: { name: 'Reverse Lunge to Step-Up', equip: 'bodyweight', note: 'Each leg. Onto a sturdy stair or step.' } }),
          R('Hollow Hold', 3, s(30), 60, 'bodyweight', { circuit: 'finisher', note: 'Low back flat, arms and legs long.',
            easy: { name: 'Tuck Hollow Hold', sets: 2, seconds: 20, note: 'Knees tucked, low back flat.' } }),
        ],
      },
      { rest: true, label: 'ACTIVE REST', focus: 'RECOVER', intro: 'An easy walk, swim or yoga. Hips, hamstrings and shoulders.' },
      { rest: true, label: 'REST', focus: 'RECOVER', intro: 'Full rest. Eat well, sleep well.' },
    ],
  },

  // Fight: kickboxing. Defend first, then hit back. The fourth day is the
  // battlefield — several opponents, pivot to the next on the switch call.
  fight: {
    discipline: 'Kickboxing',
    blurb: 'Shield and bracers, the clinch, power kicks and the battlefield. Every day ends in a Bracer Storm.',
    roundMin: 3,
    restSec: 60,
    weeks: 2,
    // ROOKIE: three 2-minute rounds (the last keeps its super).
    easy: { roundMin: 2, maxRounds: 3 },
    days: [
      {
        label: 'SHIELD & BRACERS', focus: 'BLOCKS · PARRIES · COUNTERS',
        rounds: [
          { title: 'Shadow · Shield Up', prompt: 'Hands high, elbows tight. Block on the call, then answer.',
            combos: ['Block, jab, cross', 'High block, cross, hook', 'Body block, hook, cross', 'Block, block, jab, cross'],
            easyCombos: ['Block, jab', 'Block, cross', 'Jab, cross'] },
          { title: 'Shadow · Parry and Return', prompt: 'Small parries, fast returns. The counter comes before they reset.',
            combos: ['Parry, cross', 'Parry, cross, hook', 'Parry, jab, cross, hook', 'Slip, cross, hook'],
            easyCombos: ['Parry, cross', 'Parry, jab, cross'] },
          { title: 'Bag · Block and Counter', prompt: 'Imagine the punch, block it, punish the bag.',
            combos: ['Block, cross, hook, cross', 'Parry, cross, low kick', 'High block, hook, rear kick', 'Block, jab, cross, lead knee'],
            easyCombos: ['Block, cross, hook', 'Parry, cross'] },
          { title: 'Bag · Check and Counter', prompt: 'Lift the shin to check the kick, then fire back off the same leg.',
            combos: ['Check, lead kick', 'Check, cross, hook, low kick', 'Check, jab, cross, rear kick', 'Parry, check, cross, hook'],
            easyCombos: ['Check, cross', 'Check, jab, cross'] },
          { title: 'Bag · Bracer Storm', prompt: 'Block, counter, repeat. The last 30 seconds is your super.',
            combos: ['Parry, cross, hook, rear kick', 'Block, jab, cross, lead knee', 'Check, cross, hook, low kick'],
            easyCombos: ['Block, cross, hook', 'Parry, cross'],
            super: BRACER_STORM },
        ],
      },
      {
        label: 'THE BIND', focus: 'CLINCH · KNEES',
        rounds: [
          { title: 'Shadow · Frame and Pull', prompt: 'Reach, wrap the neck, pull them onto the knee. Posture tall.',
            combos: ['Jab, cross, clinch, rear knee', 'Clinch, lead knee, rear knee', 'Hook, clinch, knee, push off'],
            easyCombos: ['Clinch, rear knee', 'Jab, cross, clinch'] },
          { title: 'Bag · Clinch Knees', prompt: 'Hands round the top of the bag. Hips forward on every knee.',
            combos: ['Rear knee, rear knee, lead knee', 'Lead knee, rear knee, push off, cross', 'Switch knee, rear knee'],
            easyCombos: ['Rear knee, lead knee', 'Rear knee'] },
          { title: 'Bag · Pull In and Finish', prompt: 'Punch in, tie them up, knee out, break away.',
            combos: ['Jab, cross, clinch, double knee, push off', 'Hook, clinch, rear knee, cross', 'Cross, hook, clinch, lead knee, low kick'],
            easyCombos: ['Jab, cross, clinch, knee', 'Cross, hook'] },
          { title: 'Bag · Catch and Turn', prompt: 'Catch the kick, turn them, punish. Hands back up after every break.',
            combos: ['Catch, cross, low kick', 'Catch, push, rear kick', 'Parry, clinch, knee, push off, cross'],
            easyCombos: ['Catch, cross', 'Clinch, knee'] },
          { title: 'Bag · Bracer Storm', prompt: 'Knees until the last breath. The last 30 seconds is your super.',
            combos: ['Clinch, rear knee, lead knee, push off, cross', 'Jab, cross, clinch, double knee'],
            easyCombos: ['Clinch, rear knee', 'Jab, cross, hook'],
            super: BRACER_STORM },
        ],
      },
      {
        label: 'POWER KICKS', focus: 'LOW · BODY · HIGH', restSec: 45,
        rounds: [
          { title: 'Shadow · Kick Mechanics', prompt: 'Pivot the standing foot, turn the hip over, swing the arm. Return to stance.',
            combos: ['Rear kick', 'Jab, rear kick', 'Lead teep', 'Switch kick'],
            easyCombos: ['Rear kick', 'Lead teep'] },
          { title: 'Bag · Low Kicks', prompt: 'Shin through the thigh. Hands set it up, the kick ends it.',
            combos: ['Jab, cross, low kick', 'Cross, hook, low kick', 'Jab, low kick, low kick', 'Hook, rear low kick'],
            easyCombos: ['Jab, low kick', 'Jab, cross, low kick'] },
          { title: 'Bag · Body Kicks', prompt: 'Turn the hip, kick through the ribs, step back to stance.',
            combos: ['Jab, cross, rear body kick', 'Switch kick, cross', 'Cross, hook, rear body kick', 'Lead teep, rear body kick'],
            easyCombos: ['Jab, rear body kick', 'Lead teep, cross'] },
          { title: 'Bag · Spear Kicks', prompt: 'Teeps like a spear: straight, hard, through the target. Then go high.',
            combos: ['Lead teep, rear teep, cross', 'Jab, cross, rear head kick', 'Lead teep, cross, hook, rear kick', 'Low kick, low kick, high kick'],
            easyCombos: ['Lead teep, cross', 'Jab, cross, rear kick'] },
          { title: 'Bag · Bracer Storm', prompt: 'Every kick at full power. The last 30 seconds is your super.',
            combos: ['Jab, cross, hook, low kick', 'Switch kick, cross, rear head kick'],
            easyCombos: ['Jab, cross, low kick', 'Rear kick'],
            super: BRACER_STORM },
        ],
      },
      {
        label: 'THE BATTLEFIELD', focus: 'MULTIPLE OPPONENTS', restSec: 60,
        rounds: [
          { title: 'Shadow · See the Field', prompt: 'Pivot off the line after every combination. Eyes up, see everyone.',
            combos: ['Jab, cross, pivot left', 'Cross, hook, pivot right', 'Lead teep, pivot'],
            easyCombos: ['Jab, cross, pivot', 'Teep, step back'] },
          { title: 'Multiple Opponents', prompt: 'Two bags: on switch, pivot to the other bag. One bag or shadow: turn to face the next opponent.',
            combos: ['Jab, cross, low kick', 'Cross, hook, rear kick', 'Lead teep, cross'], multi: true,
            easyCombos: ['Jab, cross', 'Lead teep, cross'] },
          { title: 'Multiple Opponents · Shield Wall', prompt: 'Block the first, counter, then turn to the next one already blocking.',
            combos: ['Block, cross, hook', 'Parry, cross, low kick', 'Check, cross, hook'], multi: true,
            easyCombos: ['Block, cross', 'Parry, cross'] },
          { title: 'Multiple Opponents · Clear the Lane', prompt: 'Teep the one in front away, turn and fight the next.',
            combos: ['Lead teep, cross, hook', 'Rear teep, jab, cross, rear kick', 'Clinch, knee, push off, low kick'], multi: true,
            easyCombos: ['Lead teep, cross', 'Clinch, knee'] },
          { title: 'Multiple Opponents · Bracer Storm', prompt: 'Switch on every call. The last 30 seconds is your super.',
            combos: ['Parry, cross, hook, rear kick', 'Jab, cross, lead knee, rear kick'], multi: true,
            easyCombos: ['Jab, cross, hook'],
            super: BRACER_STORM },
        ],
      },
    ],
  },

  // Arcade: one ladder, three paths. easyItems = the ROOKIE stations.
  arcade: {
    fit: [
      { title: 'THE SHORE', format: '3 rounds', plan: { rounds: 3, len: 180, rest: 60 }, items: ['400 m run', '15 squats', '10 glute bridges'], easyItems: ['200 m run-walk', '12 squats', '10 glute bridges'] },
      { title: 'SHIELD WALL', format: '4 rounds', plan: { rounds: 4, len: 150, rest: 45 }, items: ['10 push-ups', '30 s plank', '10 dead bugs'], easyItems: ['10 incline push-ups', '20 s plank', '8 dead bugs'] },
      { title: 'SPEAR LINE', format: '3 rounds', plan: { rounds: 3, len: 180, rest: 60 }, items: ['10 box jumps', '10 jump lunges', '10 push presses'], easyItems: ['10 box step-ups', '10 reverse lunges', '10 dumbbell push presses'] },
      { title: 'THE BRACERS', format: '4 rounds', plan: { rounds: 4, len: 150, rest: 45 }, items: ['10 Arnold presses', '6 pull-ups', '30 s hollow hold'], easyItems: ['10 light shoulder presses', '10 ring rows', '20 s tuck hollow hold'] },
      { title: 'THE BIND', format: '3 rounds', plan: { rounds: 3, len: 180, rest: 60 }, items: ['40 m farmer carry', '15 kettlebell swings', '10 hanging knee raises'], easyItems: ['30 m light farmer carry', '12 dumbbell swings', '10 lying leg raises'] },
      { title: 'OLYMPIAN GAMES', format: '4 rounds', plan: { rounds: 4, len: 150, rest: 45 }, items: ['10 thrusters', '5 burpee broad jumps', '30 s jump rope'], easyItems: ['8 light thrusters', '5 step-back burpees', '30 s jump rope'] },
      { title: 'THE CLIFFS', format: '3 rounds', plan: { rounds: 3, len: 180, rest: 60 }, items: ['8 wide-grip pull-ups', '12 hip thrusts', '20 walking lunges'], easyItems: ['8 band-assisted pull-ups', '12 dumbbell hip thrusts', '16 walking lunges'] },
      { title: 'TEMPLE STEPS', format: '4 rounds', plan: { rounds: 4, len: 180, rest: 45 }, items: ['10 Bulgarian split squats each leg', '12 reverse lunge to step-ups', '15 hanging leg raises'], easyItems: ['10 supported split squats each leg', '8 step-ups each leg', '12 lying leg raises'] },
      { title: 'THE BATTLEFIELD', format: '5 × 2:00', plan: { rounds: 5, len: 120, rest: 45 }, items: ['10 deadlifts', '10 box jumps', '10 push presses'], easyItems: ['10 dumbbell RDLs', '10 box step-ups', '10 dumbbell push presses'] },
      { title: 'BOSS · THE TITAN', format: 'For time', boss: true, plan: { rounds: 1, len: 1500, rest: 0 }, items: ['800 m run', '30 deadlifts', '30 box jumps', '30 thrusters', '15 wide-grip pull-ups', '4 × 40 m farmer carry'], easyItems: ['400 m run-walk', '20 dumbbell RDLs', '20 box step-ups', '20 light thrusters', '15 ring rows', '3 × 30 m farmer carry'] },
    ],
    fight: [
      { title: 'THE SHORE', format: '3 × 2:00', plan: { rounds: 3, len: 120, rest: 60 }, items: ['jab, cross on the bag', '15 squats between rounds'] },
      { title: 'SHIELD WALL', format: '4 × 2:00', plan: { rounds: 4, len: 120, rest: 45 }, items: ['block, jab, cross', 'parry, cross, hook'] },
      { title: 'SPEAR LINE', format: '3 × 3:00', plan: { rounds: 3, len: 180, rest: 60 }, items: ['lead teep, rear teep, cross', 'teeps on the call'] },
      { title: 'THE BRACERS', format: '4 × 2:30', plan: { rounds: 4, len: 150, rest: 45 }, items: ['block, counter, low kick', 'check, cross, hook'] },
      { title: 'THE BIND', format: '3 × 3:00', plan: { rounds: 3, len: 180, rest: 60 }, items: ['clinch, rear knee, lead knee', 'jab, cross, clinch, knee'] },
      { title: 'OLYMPIAN GAMES', format: '4 × 2:30', plan: { rounds: 4, len: 150, rest: 45 }, items: ['jab, cross, rear body kick', '10 burpees between rounds'] },
      { title: 'THE CLIFFS', format: '3 × 3:00', plan: { rounds: 3, len: 180, rest: 60 }, items: ['low kick, low kick, high kick', 'switch kick, cross'] },
      { title: 'TEMPLE STEPS', format: '4 × 3:00', plan: { rounds: 4, len: 180, rest: 60 }, multi: true, items: ['multiple opponents: switch on every call', 'block, cross, hook'] },
      { title: 'THE BATTLEFIELD', format: '4 × 3:00', plan: { rounds: 4, len: 180, rest: 45 }, multi: true, items: ['multiple opponents, teep the lane clear', 'clinch, knee, push off'] },
      { title: 'BOSS · THE TITAN', format: '5 × 3:00', boss: true, plan: { rounds: 5, len: 180, rest: 60 }, multi: true, items: ['multiple opponents every round', 'Bracer Storm: parry, cross, hook, rear kick'] },
    ],
    stages: [
      { title: 'THE SHORE', format: '3 rounds', plan: { rounds: 3, len: 180, rest: 60 }, items: ['400 m run', '15 squats', '1:00 jab, cross'], easyItems: ['200 m run-walk', '12 squats', '1:00 jab, cross'] },
      { title: 'SHIELD WALL', format: '4 rounds', plan: { rounds: 4, len: 150, rest: 45 }, items: ['10 push-ups', '30 s plank', '1:00 block and counter'], easyItems: ['10 incline push-ups', '20 s plank', '1:00 block and counter'] },
      { title: 'SPEAR LINE', format: '3 rounds', plan: { rounds: 3, len: 180, rest: 60 }, items: ['10 box jumps', '10 jump lunges', '1:00 teeps'], easyItems: ['10 box step-ups', '10 reverse lunges', '1:00 teeps'] },
      { title: 'THE BRACERS', format: '4 rounds', plan: { rounds: 4, len: 150, rest: 45 }, items: ['10 Arnold presses', '6 pull-ups', '1:00 parry, cross, hook'], easyItems: ['10 light shoulder presses', '10 ring rows', '1:00 parry, cross'] },
      { title: 'THE BIND', format: '3 rounds', plan: { rounds: 3, len: 180, rest: 60 }, items: ['40 m farmer carry', '15 kettlebell swings', '1:00 clinch knees'], easyItems: ['30 m light farmer carry', '12 dumbbell swings', '1:00 clinch knees'] },
      { title: 'OLYMPIAN GAMES', format: '4 rounds', plan: { rounds: 4, len: 150, rest: 45 }, items: ['10 thrusters', '5 burpee broad jumps', '1:00 body kicks'], easyItems: ['8 light thrusters', '5 step-back burpees', '1:00 body kicks'] },
      { title: 'THE CLIFFS', format: '3 rounds', plan: { rounds: 3, len: 180, rest: 60 }, items: ['8 wide-grip pull-ups', '12 hip thrusts', '1:00 low kick, low kick, high kick'], easyItems: ['8 band-assisted pull-ups', '12 dumbbell hip thrusts', '1:00 jab, cross, low kick'] },
      { title: 'TEMPLE STEPS', format: '4 rounds', plan: { rounds: 4, len: 180, rest: 45 }, multi: true, items: ['10 Bulgarian split squats each leg', '15 hanging leg raises', '1:00 multiple opponents'], easyItems: ['10 supported split squats each leg', '12 lying leg raises', '1:00 multiple opponents'] },
      { title: 'THE BATTLEFIELD', format: '4 × 3:00', plan: { rounds: 4, len: 180, rest: 45 }, multi: true, items: ['10 deadlifts', '10 box jumps', '1:00 multiple opponents, teep the lane clear'], easyItems: ['10 dumbbell RDLs', '10 box step-ups', '1:00 multiple opponents'] },
      { title: 'BOSS · THE TITAN', format: 'For time', boss: true, plan: { rounds: 1, len: 1500, rest: 0 }, multi: true, items: ['800 m run', '30 deadlifts', '30 thrusters', '15 wide-grip pull-ups', '4 × 40 m farmer carry', '3:00 multiple opponents on the bag'], easyItems: ['400 m run-walk', '20 dumbbell RDLs', '20 light thrusters', '15 ring rows', '3 × 30 m farmer carry', '3:00 multiple opponents'] },
    ],
  },
};

// Library rows for movements the Fit library does not have, so the player
// counts and coaches them properly.
const E = (name, primaryMuscle, equipment, count, coachNote, cadence) => ({ name, primaryMuscle, equipment, voiceCountingType: count, ...(cadence ? { voiceCadenceSeconds: cadence } : {}), coachNote });
export const WARRIOR_QUEEN_EXERCISES = [
  // Day 1 · power
  E('Deadlift', 'Back', 'Weighted', 'rep_count', 'Brace, push the floor away, stand tall.', 4),
  E('Dumbbell Romanian Deadlift', 'Hamstrings', 'Weighted', 'rep_count', 'Soft knees, hips back, flat back.', 3.5),
  E('Single-Leg Romanian Deadlift', 'Hamstrings', 'Bodyweight', 'rep_count', 'Hips square, reach the free leg back.', 3.5),
  E('Front Squat', 'Legs', 'Weighted', 'rep_count', 'Elbows high, sit between the heels.', 3.5),
  E('Goblet Squat', 'Legs', 'Weighted', 'rep_count', 'Elbows inside the knees, chest up.', 3),
  E('Backpack Squats', 'Legs', 'Bodyweight', 'rep_count', 'Pack on the chest, sit deep.', 3),
  E('Alternating Dumbbell Snatch', 'Full Body', 'Weighted', 'rep_count', 'Hips snap, punch it to the ceiling.', 3),
  E('Jug Snatch', 'Full Body', 'Bodyweight', 'rep_count', 'Half-full jug, same snap.', 3),
  E('Box Step-Ups', 'Legs', 'Bodyweight', 'rep_count', 'Drive through the top foot.', 3),
  E('Squat Jumps', 'Legs', 'Bodyweight', 'rep_count', 'Low and soft, land quiet.', 2.5),
  E('Push Press', 'Shoulders', 'Weighted', 'rep_count', 'Dip, drive, lock out overhead.', 3),
  E('Dumbbell Push Press', 'Shoulders', 'Weighted', 'rep_count', 'Small dip, drive up.', 3),
  E('Jug Push Press', 'Shoulders', 'Bodyweight', 'rep_count', 'Jugs at the shoulders, dip and drive.', 3),
  E('Pike Push-Ups', 'Shoulders', 'Bodyweight', 'rep_count', 'Hips high, head between the hands.', 3),
  E('Farmer Carry', 'Forearms', 'Weighted', 'manual_only', 'Tall spine, short quick steps.'),
  E('Jug Farmer Carry', 'Forearms', 'Bodyweight', 'manual_only', 'Full jugs, walk tall.'),
  // Day 2 · glutes + core
  E('Barbell Hip Thrusts', 'Glutes', 'Weighted', 'rep_count', 'Chin tucked, squeeze at the top.', 3),
  E('Bulgarian Split Squats', 'Legs', 'Weighted', 'rep_count', 'Back foot up, front shin vertical.', 3.5),
  E('Hanging Leg Raises', 'Core', 'Bodyweight', 'rep_count', 'Legs straight, no swing.', 3),
  E('Lying Leg Raises', 'Core', 'Bodyweight', 'rep_count', 'Low back pressed down.', 3),
  E('Toes-to-Bar', 'Core', 'Bodyweight', 'rep_count', 'Strict, no kip.', 3.5),
  E('Cable Glute Kickbacks', 'Glutes', 'Weighted', 'rep_count', 'Hips square, kick back and up.', 2.5),
  E('Banded Glute Kickbacks', 'Glutes', 'Bodyweight', 'rep_count', 'On all fours, squeeze at the top.', 2.5),
  E('Side Plank with Reach-Under', 'Core', 'Bodyweight', 'rep_count', 'Hips high, thread under, reach up.', 3),
  E('Knee Side Plank', 'Core', 'Bodyweight', 'manual_only', 'Knees down, hips high.'),
  E('Weighted Walking Lunges', 'Legs', 'Weighted', 'rep_count', 'Long steps, back knee to the floor.', 2.5),
  E('Walking Lunges', 'Legs', 'Bodyweight', 'rep_count', 'Long steps, back knee to the floor.', 2.5),
  E('Russian Twists', 'Core', 'Bodyweight', 'rep_count', 'Rotate from the ribs.', 1.5),
  // Day 3 · battle day
  E('Dumbbell Thrusters', 'Full Body', 'Weighted', 'rep_count', 'Squat, drive, press in one move.', 3),
  E('Jug Thrusters', 'Full Body', 'Bodyweight', 'rep_count', 'Squat, drive, press.', 3),
  E('Kettlebell Swings', 'Glutes', 'Weighted', 'rep_count', 'Snap the hips, arms are ropes.', 2),
  E('Dumbbell Swings', 'Glutes', 'Weighted', 'rep_count', 'Hinge and snap.', 2),
  E('Backpack Swings', 'Glutes', 'Bodyweight', 'rep_count', 'Hinge and snap.', 2),
  E('Jump Lunges', 'Legs', 'Bodyweight', 'rep_count', 'Switch in the air, land soft.', 2),
  E('Reverse Lunges', 'Legs', 'Bodyweight', 'rep_count', 'Step back, knee to the floor.', 2.5),
  E('Burpee Broad Jumps', 'Full Body', 'Bodyweight', 'rep_count', 'Burpee, jump forward, stick it.', 5),
  E('Step-Back Burpees', 'Full Body', 'Bodyweight', 'rep_count', 'Step back, step in, stand.', 4),
  E('Burpees', 'Full Body', 'Bodyweight', 'rep_count', 'Chest down, jump up.', 3.5),
  E('Jump Rope', 'Full Body', 'Bodyweight', 'manual_only', 'Light on the balls of the feet.'),
  E('Imaginary Jump Rope', 'Full Body', 'Bodyweight', 'manual_only', 'Same bounce, hands turning.'),
  E('Hanging Knee Raises', 'Core', 'Bodyweight', 'rep_count', 'Knees to the chest, no swing.', 2.5),
  E('Cable Oblique Crunch', 'Core', 'Weighted', 'rep_count', 'Ribs to hip, down and across.', 2.5),
  // Day 4 · heroic build + pull-up ladder
  E('Wide-Grip Pull-Ups', 'Back', 'Bodyweight', 'rep_count', 'Hands wide, elbows to the ribs.', 3.5),
  E('Dead Hang', 'Forearms', 'Bodyweight', 'manual_only', 'Shoulders active, not shrugged.'),
  E('Scapula Pull-Ups', 'Back', 'Bodyweight', 'rep_count', 'Straight arms, pull the shoulders down.', 2.5),
  E('Ring Rows', 'Back', 'Bodyweight', 'rep_count', 'Body straight, chest to the rings.', 3),
  E('Band-Assisted Pull-Ups', 'Back', 'Bodyweight', 'rep_count', 'Band under the knee or foot.', 3.5),
  E('Pull-Up Negatives', 'Back', 'Bodyweight', 'rep_count', 'Five seconds down.', 6),
  E('Pull-Ups', 'Back', 'Bodyweight', 'rep_count', 'Chin over the bar, full hang.', 3.5),
  E('Towel Hang', 'Forearms', 'Bodyweight', 'manual_only', 'Towel over the bar, hang on.'),
  E('Table Rows', 'Back', 'Bodyweight', 'rep_count', 'Chest to the table edge.', 3),
  E('Table-Row Negatives', 'Back', 'Bodyweight', 'rep_count', 'Five seconds down.', 6),
  E('Towel Pull-Ups', 'Back', 'Bodyweight', 'rep_count', 'Grip the towel, pull.', 3.5),
  E('Incline Dumbbell Press', 'Chest', 'Weighted', 'rep_count', 'Lower to the upper chest, press up.', 3),
  E('Decline Push-Ups', 'Chest', 'Bodyweight', 'rep_count', 'Feet on a chair, chest to the floor.', 3),
  E('Pullover Crunch', 'Core', 'Weighted', 'rep_count', 'Lower behind the head, pull over, crunch.', 3.5),
  E('Jug Pullover Crunch', 'Core', 'Bodyweight', 'rep_count', 'Pull over, crunch up.', 3.5),
  E('Jug Arnold Press', 'Shoulders', 'Bodyweight', 'rep_count', 'Palms in, turn out as you press.', 3),
  E('Single-Arm Kettlebell Swings', 'Glutes', 'Weighted', 'rep_count', 'Suitcase grip, shoulders square.', 2),
  E('Reverse Lunge to Step-Up', 'Legs', 'Bodyweight', 'rep_count', 'Lunge back, drive up onto the box.', 4),
  E('Hollow Hold', 'Core', 'Bodyweight', 'manual_only', 'Low back flat, arms and legs long.'),
  E('Tuck Hollow Hold', 'Core', 'Bodyweight', 'manual_only', 'Knees tucked, low back flat.'),
];
