// SHOTO — concept drop timed to the Street Fighter film. Three fighting
// styles on one weekly rotation, from the owner's Shoto Training Program:
//
//   PATH OF THE WARRIOR  fundamentals. Shotokan base, short bursts, hard
//                        straight strikes, a few leaping kicks. Controlled.
//   BLAZING FISTS        Dutch + American kickboxing. High-number combos,
//                        quick feet, angles, jumping kicks. Fast.
//   DEMON PRESSURE       Japanese kickboxing pressure. Speed AND power: hard
//                        basic shots and long combos, always forward. Hardest.
//
// Character names stay out of the app (they belong to Capcom); the styles
// carry the identity. Special-move themes → real movements (owner's table):
//   fireball        FIT med-ball throw          FIGHT double-hand push; push the bag back and counter as it returns
//   rising uppercut FIT squat to press          FIGHT explosive uppercut
//   hurricane kick  FIT 180°/360° jump or tuck  FIGHT spinning back kick
//                                               (advanced: the real kick on the bag)
//   raging demon    FIGHT sliding fake teep forward / back, fake teep to rear elbow
//
// SUPERS: the last round of each style day ends in a 30 s super — a custom
// rush where the coach calls one signature combination until the bell.
//   RISING DRAGON   rear uppercut, lead uppercut, duck, gazelle uppercut
//   DRAGON STORM    low kick, switch kick, mid kick, slide back, spinning back kick
//   DEMON BARRAGE   sliding fake teep, rear elbow, low kick, lead elbow, rear knee,
//                   lead elbow, spinning back elbow

// Supers — a 30 s custom rush at the end of a round, one combo called on a
// fixed beat until the bell. Advanced athletes may swap the spinning back
// kick for the real hurricane kick on the bag.
export const SUPERS = {
  ryu: { name: 'Rising Dragon', every: 4, calls: ['Rear uppercut, lead uppercut, duck, gazelle uppercut', 'Rear uppercut, lead uppercut, duck, gazelle hook'] },
  ken: { name: 'Dragon Storm', every: 6, calls: ['Low kick, switch kick, mid switch kick, rear teep, spinning back kick', 'Low kick, low switch kick, mid kick, slide back, spinning back kick'] },
  akuma: { name: 'Demon Barrage', every: 6, calls: ['Sliding fake teep, rear elbow, low kick, lead elbow, rear knee, lead elbow, spinning back elbow'] },
};

const RYU = 'PATH OF THE WARRIOR';
const KEN = 'BLAZING FISTS';
const AKUMA = 'DEMON PRESSURE';

export const SHOTO = {
  id: 'shoto',
  title: 'SHOTO',
  tagline: 'Three styles. One path. Fundamentals, speed, pressure.',
  reward: { title: 'SHOTO MASTER', xp: 500, frame: 'crimson-gi' },
  accent: '#f97316',
  // Owner-generated art. The Arcade card is the Akuma / Ken / Ryu panel.
  art: {
    poster: '/static/concepts/shoto/poster.webp',
    wide: '/static/concepts/shoto/wide.webp',
    card: '/static/concepts/shoto/card.webp',
  },

  // Fit: the three conditioning blocks, Mon / Wed / Fri, 4 weeks. The
  // optional fourth day is technical practice, shown as a light day.
  fit: {
    weeks: 4,
    minutes: 35,
    blurb: 'Three conditioning styles: controlled power, explosive speed, demon pressure.',
    days: [
      {
        label: RYU, focus: 'CONTROLLED POWER',
        intro: 'Deliberate and clean. Reset your stance, control your breathing, make every rep look intentional.',
        exercises: [
          { name: 'Squat Jump to Pull-Up', sets: 3, reps: 10, rest: 60, equip: 'bar', swap: 'Jump Squats', note: 'Jump, catch the bar, pull. Land soft.' },
          { name: 'Sandbag Over-Shoulder Toss', sets: 3, reps: 20, rest: 60, equip: 'sandbag', swap: 'Burpees', note: 'Hips drive it over, not the arms. Alternate shoulders.' },
          { name: 'Plank to Push-Up to Knee Tuck', sets: 3, seconds: 30, rest: 45, equip: 'bodyweight', note: 'Plank, push-up, knee to chest. Smooth, not rushed.' },
          { name: 'Med-Ball Chest Pass', sets: 3, reps: 12, rest: 60, equip: 'medball', swap: 'Explosive Push-Ups', note: 'The fireball: drive it from the chest with the whole body.' },
          { name: 'Alternating Squat to Press', sets: 3, reps: 10, rest: 60, equip: 'dumbbell', swap: 'Jump Squats', note: 'The rising uppercut: drive up out of the squat and punch the weight overhead. Alternate hands. Dumbbell or kettlebell.' },
          { name: 'Controlled Push-Ups', sets: 3, reps: 18, rest: 45, equip: 'bodyweight', note: 'Three seconds down, one up.' },
        ],
      },
      { rest: true, label: 'REST', focus: 'RECOVER', intro: 'Rest or an easy walk.' },
      {
        label: KEN, focus: 'EXPLOSIVE SPEED',
        intro: 'Lighter and quicker than the warrior day. Every rep fast, then reset.',
        exercises: [
          { name: 'Burpee Tuck Jump Sprint', sets: 3, reps: 6, rest: 75, equip: 'bodyweight', note: 'Burpee, lateral tuck jump, then a ten-metre sprint.' },
          { name: 'Medicine Ball Slams', sets: 3, reps: 12, rest: 60, equip: 'medball', swap: 'Burpees' },
          { name: 'Overhead Med-Ball Jump Throw', sets: 3, reps: 8, rest: 60, equip: 'medball', swap: 'Jump Squats', note: 'Squat, jump, throw it up and back.' },
          { name: 'Speed Knees', sets: 3, seconds: 30, rest: 30, equip: 'bodyweight', note: 'Hands up, drive the knees as fast as you can.' },
          { name: 'Explosive Push-Ups', sets: 3, reps: 12, rest: 60, equip: 'bodyweight', note: 'Hands leave the floor every rep.' },
          { name: '180° Tuck Jumps', sets: 3, reps: 8, rest: 60, equip: 'bodyweight', note: 'The hurricane kick: knees up, turn 180 in the air, land facing back. Alternate directions.' },
        ],
      },
      { rest: true, label: 'SHOTO PRACTICE', focus: 'OPTIONAL', intro: 'Optional, 20–30 easy minutes: stance transitions, jab-cross and roundhouse mechanics, spinning-kick practice, mobility. Not another war.' },
      {
        label: AKUMA, focus: 'HARD CONDITIONING',
        intro: 'The hardest day of the three. Minimal wasted motion. Take space and keep working.',
        exercises: [
          { name: 'Burpee to Pull-Up', sets: 3, reps: 10, rest: 75, equip: 'bar', swap: 'Burpees' },
          { name: 'Sandbag Carry Sprint', sets: 3, seconds: 30, rest: 60, equip: 'sandbag', swap: 'Bear Crawls', note: 'Bear-hug the bag and move fast for 50 to 100 feet.' },
          { name: 'Medicine Ball Slams', sets: 3, reps: 20, rest: 60, equip: 'medball', swap: 'Burpees' },
          { name: 'Dive Bomber Split-Kick Jump', sets: 3, reps: 8, rest: 60, equip: 'bodyweight', note: 'Dive bomber, push-up, then explode up into a split-kick jump.' },
          { name: 'Heavy Knees', sets: 3, reps: 20, rest: 45, equip: 'bodyweight', note: 'Pull the head down, drive the hip through. Alternate.' },
          { name: 'Rotational Jump Squats', sets: 3, reps: 10, rest: 60, equip: 'bodyweight', note: 'Squat, jump and turn 180. Go 360 only if you land it clean.' },
        ],
      },
      { rest: true, label: 'SHOTO PRACTICE', focus: 'OPTIONAL', intro: 'Light technical work or full rest. Make the next week better.' },
      { rest: true, label: 'REST', focus: 'REST', intro: 'Full rest.' },
    ],
  },

  // Fight: shadow + bag rounds with the owner's combinations called by the
  // coach. Two weeks of the four-day rotation.
  fight: {
    discipline: 'Kickboxing',
    blurb: 'Fundamentals, speed and pressure, with your combinations called every round.',
    roundMin: 3,
    restSec: 60,
    weeks: 2,
    days: [
      {
        label: RYU, focus: '2 SHADOW · 3 BAG',
        rounds: [
          { title: 'Shadow · Stance and Straight Lines', prompt: 'Stay balanced. Reset your stance after every combination.',
            combos: ['Jab, cross, double-hand push', 'Jab, cross, high kick, low kick', 'Parry, cross, hook, spinning back kick', 'Jab, cross, duck, uppercut, side step', 'Hook, rear kick, double-hand push, counter cross'] },
          { title: 'Shadow · Fundamentals With Feints', prompt: 'Short bursts, hard strikes, a clean reset every time.',
            combos: ['Double jab, cross, feint, jump knee', 'Low kick, cross, spinning backfist', 'Feint kick, jumping roundhouse, sweep', 'Cross, hook, spinning back kick, step punch', 'Rising uppercut, jab, cross, guard'] },
          { title: 'Bag · Clean Entries', prompt: 'Clean boxing entries, strong karate finishes.',
            combos: ['Jab, cross, rear kick', 'Slip, cross, hook, uppercut', 'Jab, rear body kick', 'Cross, hook, roundhouse'] },
          { title: 'Bag · Strong Finishes', prompt: 'Composed pace. Make the last strike the hardest.',
            combos: ['Double jab, cross, rear kick', 'Low kick, cross, hook', 'Cross, lead hook, rear roundhouse', 'Jab, cross, knee'] },
          { title: 'Bag · Controlled Power', prompt: 'Every strike intentional. The last 30 seconds is your super.',
            combos: ['Hook, rear kick, cross', 'Jab, cross, double-hand push', 'Double-hand push, counter cross, hook', 'Cross, hook, roundhouse', 'Jab, rear body kick'],
            super: SUPERS.ryu },
        ],
      },
      {
        label: KEN, focus: '2 SHADOW · 3 BAG', restSec: 45,
        rounds: [
          { title: 'Shadow · Fast Entries', prompt: 'In and out of range. Never stand still.',
            combos: ['Jab, cross, step in, uppercut', 'Cross, hook, spinning roundhouse', 'Low kick, hook, spinning back kick', 'Jab, cross, dash, cross, elbow', 'Feint, cross, high kick'] },
          { title: 'Shadow · Angles and Chains', prompt: 'Cut an angle after every combination. Long chains, fast hands.',
            combos: ['Double jab, step hook, cross', 'Roundhouse, cross, step knee', 'Double jab, cross, spinning heel kick', 'Jump kick, hook, elbow, guard', 'Jab, fake cross, spinning hook kick'] },
          { title: 'Bag · Dutch Combinations', prompt: 'Hands set up the kick. Every combination ends with a leg.',
            combos: ['Jab, rear low kick, high kick', 'Jab, cross, lead hook, rear kick', 'Double jab, cross, low kick', 'Cross, hook, cross, rear roundhouse'] },
          { title: 'Bag · Explosive Finishes', prompt: 'Fast, but stay sharp. Explode on the last strike.',
            combos: ['Jab, cross, jump knee', 'Low kick, cross, hook, high kick', 'Jab, cross, body hook, rear kick', 'Cross, lead hook, spinning back kick'] },
          { title: 'Bag · Blazing Round', prompt: 'Highest output of the day. The last 30 seconds is your super.',
            combos: ['Double jab, dash, cross, knee', 'Jab, cross, lead hook, rear kick', 'Low kick, cross, hook, high kick', 'Cross, hook, cross, rear roundhouse'],
            super: SUPERS.ken },
        ],
      },
      {
        label: AKUMA, focus: '2 SHADOW · 3 BAG', rush: true, restSec: 30,
        rounds: [
          { title: 'Shadow · Forward Pressure', prompt: 'Advance during every combination. Take their space.',
            combos: ['Dash jab, step cross, spinning back kick', 'Cross, jump in, hook, double-hand push', 'Jab, low kick, overhand, side step', 'Jab, cross, duck, uppercut, spinning elbow', 'Sliding fake teep, rear elbow'] },
          { title: 'Shadow · Speed and Power', prompt: 'Hard basic shots, fast. Long chains, all forward.',
            combos: ['Dash, low kick, cross, uppercut', 'Fake teep slide forward, fake teep slide back, cross', 'Hook, elbow, elbow, knee', 'Jab, hook, low kick, cross', 'Jump knee, hook, low kick, double-hand push, counter'] },
          { title: 'Bag · Power Combinations', prompt: 'Heavy shots. Plant and hit through the bag.',
            combos: ['Dash, cross, rear kick, elbow', 'Cross, uppercut, cross', 'Hook, jump knee, hook', 'Jumping fake teep, rear elbow'] },
          { title: 'Bag · Close Range', prompt: 'Elbows and knees. Stay on top of it.',
            combos: ['Elbow, elbow, knee, sprawl', 'Overhand, body hook, low kick', 'Cross, hook, knee, elbow', 'Spinning back kick, cross, low kick'] },
          { title: 'Bag · Demon Round', prompt: 'Relentless. Superman punch to start every exchange. The last 30 seconds is your super.',
            combos: ['Superman punch, cross, low kick', 'Dash, cross, rear kick, elbow', 'Overhand, body hook, low kick', 'Superman punch, hook, knee, elbow'],
            super: SUPERS.akuma },
        ],
      },
      {
        label: 'SHOTO PRACTICE', focus: 'LIGHT · TECHNICAL', restSec: 60,
        rounds: [
          { title: 'Stance Transitions', prompt: 'Front stance, back stance, fighting stance. Slow and balanced.' },
          { title: 'Jab-Cross Mechanics', prompt: 'Turn the hip, snap back to guard. Perfect form, half speed.', combos: ['Jab', 'Jab, cross', 'Double jab, cross'] },
          { title: 'Roundhouse Mechanics', prompt: 'Pivot the base foot, turn the hip over. Both sides.', combos: ['Rear roundhouse', 'Lead roundhouse', 'Low kick, high kick'] },
          { title: 'Spinning Kick Practice', prompt: 'Controlled range only. Skip anything past your mobility.' },
        ],
      },
    ],
  },

  arcade: {
    fit: [
        { title: 'WARRIOR BASE', format: '3 rounds', plan: { rounds: 3, len: 180, rest: 60 }, items: ['15 squat jumps', '12 push-ups', '30 s plank'] },
        { title: 'RISING DRAGON', format: '4 rounds', plan: { rounds: 4, len: 150, rest: 45 }, items: ['10 alternating squat to press', '10 pull-ups or inverted rows', '15 sit-ups'] },
        { title: 'THE FIREBALL', format: '3 rounds', plan: { rounds: 3, len: 180, rest: 60 }, items: ['15 med-ball throws or explosive push-ups', '10 burpees', '20 lunges'] },
        { title: 'BLAZING FEET', format: '4 × 2:30', plan: { rounds: 4, len: 150, rest: 45 }, items: ['1:00 jump rope or jumping jacks', '20 skater hops', '30 s high knees'] },
        { title: 'TUCK & SPIN', format: 'EMOM 10 min', plan: { rounds: 10, len: 60, rest: 5 }, items: ['4 burpee tuck jumps', '4 × 180° tuck jumps'] },
        { title: 'HURRICANE LEGS', format: '3 rounds', plan: { rounds: 3, len: 180, rest: 60 }, items: ['12 rotational jump squats', '20 jump lunges', '10 broad jumps'] },
        { title: 'DEMON STEP', format: '8 × 30 s on / 30 s off', plan: { rounds: 8, len: 30, rest: 30 }, items: ['mountain climbers', 'squat thrusts'] },
        { title: 'IRON BODY', format: '4 rounds', plan: { rounds: 4, len: 150, rest: 45 }, items: ['10 burpee pull-ups or burpees', '50 ft sandbag carry or 30 s bear crawl', '15 med-ball slams or burpees'] },
        { title: 'NO MERCY', format: '5 × 3:00', plan: { rounds: 5, len: 180, rest: 60 }, items: ['1:00 dive bomber push-ups', '1:00 jump squats', '1:00 plank'] },
        { title: 'BOSS · THE DEMON WITHIN', format: 'For time', boss: true, plan: { rounds: 1, len: 1500, rest: 0 }, items: ['1 km run', '50 med-ball slams or burpees', '40 jump lunges', '30 explosive push-ups', '20 alternating squat to press', '3:00 max burpees'] },
      ],
      fight: [
        { title: 'STANCE & STRIKE', format: '3 × 3:00', plan: { rounds: 3, len: 180, rest: 60 }, items: ['1:00 jab-cross', '1:00 straight punches from a front stance', '1:00 stance reset footwork'] },
        { title: 'CONTROLLED POWER', format: '4 × 2:30', plan: { rounds: 4, len: 150, rest: 45 }, items: ['20 power straights', '10 rear kicks each side', '10 squats'] },
        { title: 'THE FIREBALL', format: '3 rounds', plan: { rounds: 3, len: 180, rest: 60 }, items: ['15 double-hand pushes, every third with a counter', '1:00 jab, cross, hook', '10 push-ups'] },
        { title: 'BLAZING FISTS', format: '4 × 2:30', plan: { rounds: 4, len: 150, rest: 45 }, items: ['1:00 Dutch combos ending in a low kick', '30 s speed straights', '30 s angle footwork'] },
        { title: 'DASH & STRIKE', format: 'EMOM 10 min', plan: { rounds: 10, len: 60, rest: 5 }, items: ['dash in: jab, cross, hook, low kick', '3 sprawls'] },
        { title: 'SPINNING FLAME', format: '3 rounds', plan: { rounds: 3, len: 180, rest: 60 }, items: ['10 spinning back kicks each side', '1:00 roundhouse chains', '10 jump squats'] },
        { title: 'DEMON STEP', format: '8 × 30 s on / 30 s off', plan: { rounds: 8, len: 30, rest: 30 }, items: ['forward-pressure bag flurry', 'fake teep slides'] },
        { title: 'IRON ELBOWS', format: '4 rounds', plan: { rounds: 4, len: 150, rest: 45 }, items: ['20 elbows', '20 knees', '1:00 Superman punch, hook, low kick'] },
        { title: 'SUPER METER', format: '3 × 3:00', plan: { rounds: 3, len: 180, rest: 60 }, items: ['round 1 Rising Dragon', 'round 2 Dragon Storm', 'round 3 Demon Barrage'] },
        { title: 'BOSS · THE DEMON WITHIN', format: 'For time', boss: true, plan: { rounds: 1, len: 1500, rest: 0 }, items: ['100 straights', '50 low kicks', '40 knees', '30 elbows', '20 spinning back kicks', '3:00 Demon Barrage on the bag'] },
      ],
    stages: [
      { title: 'STANCE & STRIKE', format: '3 × 3:00', plan: { rounds: 3, len: 180, rest: 60 }, items: ['50 straight punches', '10 squat jumps', '1:00 jab-cross on the bag'] },
      { title: 'CONTROLLED POWER', format: '4 rounds', plan: { rounds: 4, len: 150, rest: 45 }, items: ['10 alternating squat to press', '12 med-ball throws or explosive push-ups', '20 power straights'] },
      { title: 'THE FIREBALL', format: '3 rounds', plan: { rounds: 3, len: 180, rest: 60 }, items: ['15 double-hand pushes, every third with a counter, or chest passes', '10 burpees', '1:00 rear kicks'] },
      { title: 'BLAZING FEET', format: '4 × 2:30', plan: { rounds: 4, len: 150, rest: 45 }, items: ['1:00 bounce footwork', '30 speed knees', '20 low kicks'] },
      { title: 'DASH & STRIKE', format: 'EMOM 10 min', plan: { rounds: 10, len: 60, rest: 5 }, items: ['4 burpee tuck jumps', 'jab, cross, hook, kick'] },
      { title: 'SPINNING FLAME', format: '3 rounds', plan: { rounds: 3, len: 180, rest: 60 }, items: ['10 med-ball slams', '10 roundhouse kicks each side', '6 controlled 180° jump squats'] },
      { title: 'DEMON STEP', format: '8 × 30 s on / 30 s off', plan: { rounds: 8, len: 30, rest: 30 }, items: ['forward-pressure bag flurry', 'heavy knees'] },
      { title: 'IRON BODY', format: '4 rounds', plan: { rounds: 4, len: 150, rest: 45 }, items: ['10 burpee pull-ups or burpees', '50 ft sandbag carry or 30 s bear crawl', '20 elbows'] },
      { title: 'NO MERCY', format: '5 × 3:00', plan: { rounds: 5, len: 180, rest: 60 }, items: ['1:00 power bag', '1:00 dive bomber split jumps', '1:00 elbow-knee chain'] },
      { title: 'BOSS · THE DEMON WITHIN', format: 'For time', boss: true, plan: { rounds: 1, len: 1500, rest: 0 }, items: ['100 straights', '50 med-ball slams or burpees', '40 heavy knees', '30 explosive push-ups', '20 jump squats', '3:00 all-out bag'] },
    ],
  },
};

export const SHOTO_EXERCISES = [
  { name: 'Alternating Squat to Press', primaryMuscle: 'Shoulders', equipment: 'Weighted', voiceCountingType: 'rep_count', voiceCadenceSeconds: 3, coachNote: 'Drive up out of the squat and press overhead. Alternate hands.' },
  { name: '180° Tuck Jumps', primaryMuscle: 'Full Body', equipment: 'Bodyweight', voiceCountingType: 'rep_count', voiceCadenceSeconds: 3, coachNote: 'Knees up, turn 180, land soft.' },
  { name: 'Rotational Jump Squats', primaryMuscle: 'Legs', equipment: 'Bodyweight', voiceCountingType: 'rep_count', voiceCadenceSeconds: 3, coachNote: 'Squat, jump, turn 180. 360 only if you land it clean.' },
  { name: 'Squat Jump to Pull-Up', primaryMuscle: 'Back', equipment: 'Bodyweight', voiceCountingType: 'rep_count', voiceCadenceSeconds: 3.5, coachNote: 'Jump, catch the bar, pull. Land soft.' },
  { name: 'Sandbag Over-Shoulder Toss', primaryMuscle: 'Full Body', equipment: 'Weighted', voiceCountingType: 'rep_count', voiceCadenceSeconds: 3, coachNote: 'Hips drive it over. Alternate shoulders.' },
  { name: 'Plank to Push-Up to Knee Tuck', primaryMuscle: 'Core', equipment: 'Bodyweight', voiceCountingType: 'manual_only', coachNote: 'Plank, push-up, knee to chest.' },
  { name: 'Med-Ball Chest Pass', primaryMuscle: 'Chest', equipment: 'Weighted', voiceCountingType: 'rep_count', voiceCadenceSeconds: 2.5, coachNote: 'Drive it from the chest with the whole body.' },
  { name: 'Controlled Push-Ups', primaryMuscle: 'Chest', equipment: 'Bodyweight', voiceCountingType: 'rep_count', voiceCadenceSeconds: 4, coachNote: 'Three seconds down, one up.' },
  { name: 'Burpee Tuck Jump Sprint', primaryMuscle: 'Full Body', equipment: 'Bodyweight', voiceCountingType: 'rep_count', voiceCadenceSeconds: 7, coachNote: 'Burpee, lateral tuck jump, ten-metre sprint.' },
  { name: 'Medicine Ball Slams', primaryMuscle: 'Full Body', equipment: 'Weighted', voiceCountingType: 'rep_count', voiceCadenceSeconds: 2, coachNote: 'Reach tall, slam hard, catch it on the bounce.' },
  { name: 'Overhead Med-Ball Jump Throw', primaryMuscle: 'Full Body', equipment: 'Weighted', voiceCountingType: 'rep_count', voiceCadenceSeconds: 4, coachNote: 'Squat, jump, throw it up and back.' },
  { name: 'Speed Knees', primaryMuscle: 'Core', equipment: 'Bodyweight', voiceCountingType: 'manual_only', coachNote: 'Hands up, drive the knees fast.' },
  { name: 'Explosive Push-Ups', primaryMuscle: 'Chest', equipment: 'Bodyweight', voiceCountingType: 'rep_count', voiceCadenceSeconds: 2.5, coachNote: 'Hands leave the floor every rep.' },
  { name: 'Burpee to Pull-Up', primaryMuscle: 'Full Body', equipment: 'Bodyweight', voiceCountingType: 'rep_count', voiceCadenceSeconds: 5, coachNote: 'Burpee, jump to the bar, pull.' },
  { name: 'Sandbag Carry Sprint', primaryMuscle: 'Full Body', equipment: 'Weighted', voiceCountingType: 'manual_only', coachNote: 'Bear-hug the bag and move fast.' },
  { name: 'Dive Bomber Split-Kick Jump', primaryMuscle: 'Full Body', equipment: 'Bodyweight', voiceCountingType: 'rep_count', voiceCadenceSeconds: 5, coachNote: 'Dive bomber, push-up, split-kick jump.' },
  { name: 'Heavy Knees', primaryMuscle: 'Core', equipment: 'Bodyweight', voiceCountingType: 'rep_count', voiceCadenceSeconds: 1.5, coachNote: 'Pull down, drive the hip through.' },
];
