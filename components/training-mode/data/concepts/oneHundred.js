// ONE HUNDRED — concept drop for Apr–May. Inspired by the famous anime hero
// routine (Saitama, One-Punch Man): 100 push-ups, 100 sit-ups, 100 squats
// and a 10 km run, every single day. Character and series names stay out of
// the app; the numbers carry the identity.
//
// The owner's "One Punch Challenge" week turns each basic movement into a
// day of mastery: 10 variations × 10 sets × 10 reps = 1,000 reps. That is a
// challenge, not a beginner plan, so the tiers read ROOKIE / NORMAL / ELITE:
//   • ROOKIE  3 sets × 10 per variation ≈ 300 reps a day
//   • NORMAL  6 sets × 10 per variation ≈ 600 reps a day
//   • ELITE  10 sets × 10 per variation ≈ 1,000 reps a day
// Every variation row carries row.easy and row.hard, so the tier numbers are
// used exactly as written (no scaling). The hard variations (clap, archer,
// typewriter, pistol, sissy squat, dragon flag, V-up, …) get a ROOKIE
// REGRESSION with its own name.
//
// The run is its own day (THE 10K) on the Cardio Mode engine: a new day
// shape `{ run: { km: { easy, normal, hard }, negativeSplit } }`, per week.
//
// Fight: boxing built around one decisive punch. Every day's last round
// ends with the LIMIT BREAKER super — a 30 s rush of one-punch calls.

const s = (n) => `${n}s`;
const R = (name, sets, n, rest, equip, extra = {}) => ({ name, sets, ...(typeof n === 'string' ? { seconds: parseInt(n, 10) } : { reps: n }), rest, equip, ...extra });

// One of the ten variations: NORMAL 6 × 10, ROOKIE 3 × 10, ELITE 10 × 10.
// extra.easy / extra.hard add to (or rename) the tier versions.
const V = (name, rest, equip, extra = {}) => {
  const { easy, hard, ...rest_ } = extra;
  return {
    name, sets: 6, reps: 10, rest, equip, ...rest_,
    easy: { sets: 3, reps: 10, ...(easy || {}) },
    hard: { sets: 10, reps: 10, ...(hard || {}) },
  };
};

const SERIOUS = {
  name: 'Limit Breaker', every: 5,
  calls: ['Rear straight', 'Jab, rear straight', 'Slip, rear straight', 'Feint the jab, rear straight', 'Step in, rear straight'],
  easy: { every: 6, calls: ['Rear straight', 'Jab, rear straight'] },
};

export const ONE_HUNDRED = {
  id: 'one-hundred',
  title: 'ONE HUNDRED',
  tagline: '100 push-ups. 100 sit-ups. 100 squats. Then run.',
  reward: { title: 'LIMIT BREAKER', xp: 500, frame: 'gold-cape' },
  accent: '#facc15',
  tierLabels: { easy: 'ROOKIE', normal: 'NORMAL', hard: 'ELITE' },
  art: {
    poster: '/static/concepts/one-hundred/poster.webp',
    wide: '/static/concepts/one-hundred/wide.webp',
    card: '/static/concepts/one-hundred/card.webp',
    arcade: '/static/series/posters/one-punch.webp',
  },

  // Fit: push, legs, the run, core — then three rest days. 4 weeks.
  fit: {
    weeks: 4,
    minutes: 60,
    blurb: 'Ten variations of the basics, ten reps at a time. Rookie 300 reps a day, Normal 600, Elite 1,000. Then the 10K.',
    days: [
      {
        label: 'ONE HUNDRED PUSH', focus: 'PUSH-UP MASTERY',
        intro: 'Arm circles, 20 scapular push-ups. Ten push-up variations, ten reps a set. Body in one line on every rep; if the form breaks, finish the set on your knees. Then the abs finisher.',
        exercises: [
          V('Push-Ups', 30, 'bodyweight', { note: 'Chest to a fist off the floor, lock out at the top.' }),
          V('Diamond Push-Ups', 30, 'bodyweight', { note: 'Thumbs and index fingers touch. Elbows brush the ribs.',
            easy: { name: 'Close-Grip Knee Push-Ups', note: 'Hands under the shoulders, knees down, elbows tight.' } }),
          V('Wide Push-Ups', 30, 'bodyweight', { note: 'Hands a forearm outside the shoulders. Slow down, push hard.' }),
          V('Hindu Push-Ups', 40, 'bodyweight', { note: 'Hips high, swoop the chest along the floor, finish in a cobra. Reverse it.',
            easy: { name: 'Downward Dog to Cobra', note: 'No push: flow from hips high to chest up, slow.' } }),
          V('Clap Push-Ups', 45, 'bodyweight', { note: 'Explode off the floor, clap, land soft with bent elbows.',
            easy: { name: 'Explosive Incline Push-Ups', note: 'Hands on a bench. Push fast enough that your hands leave it.' } }),
          V('Shoulder Tap Push-Ups', 30, 'bodyweight', { note: 'Push-up, then tap each shoulder. Hips stay square — no rocking.',
            easy: { name: 'Plank Shoulder Taps', note: 'High plank, feet wide, tap without the hips moving.' } }),
          V('Archer Push-Ups', 45, 'bodyweight', { note: 'Shift onto one arm, the other stays straight. Alternate: 5 each side.',
            easy: { name: 'Incline Archer Push-Ups', note: 'Hands on a bench. Shift side to side, 5 each.' } }),
          V('Typewriter Push-Ups', 45, 'bodyweight', { note: 'Stay low and slide from one hand to the other. Each slide is a rep.',
            easy: { name: 'Knee Typewriter Push-Ups', note: 'Knees down. Stay low, slide side to side.' } }),
          V('Pike Push-Ups', 40, 'bodyweight', { note: 'Hips high, head travels in front of the hands. Shoulder day in a push-up.',
            easy: { name: 'Pike Shoulder Taps', note: 'Hips high, tap the opposite shoulder. Weight over the hands.' } }),
          V('Hero Push-Ups', 45, 'bodyweight', { note: 'Three seconds down, hold three seconds an inch off the floor, explode up.',
            easy: { name: 'Slow Knee Push-Ups', note: 'Knees down. Three seconds down, one second hold.' } }),
          // Abs finisher (pick 2 of the owner's 5 — flutter kicks and dragon flags).
          R('Flutter Kicks', 5, 20, 30, 'bodyweight', { note: 'Low back pressed down, small fast kicks. Each kick counts.',
            easy: { sets: 3, reps: 15 }, hard: { sets: 10, reps: 20 } }),
          R('Dragon Flag Negatives', 5, 5, 45, 'bodyweight', { note: 'Grip the bench behind your head, body straight up, lower for five seconds.',
            easy: { name: 'Lying Leg Raises', sets: 3, reps: 15, note: 'Low back pressed down, legs straight, slow down.' },
            hard: { name: 'Dragon Flags', sets: 6, reps: 5, note: 'Up and down as one straight line. No bend at the hips.' } }),
        ],
      },
      {
        label: 'ONE HUNDRED SQUAT', focus: 'LEG MASTERY',
        intro: 'Leg swings, 20 air squats, hip openers. Ten squat variations, ten reps a set. One-leg moves: 5 each leg. Heels down, knees track the toes.',
        exercises: [
          V('Air Squats', 30, 'bodyweight', { note: 'Hips below the knees, stand all the way up.' }),
          V('Sumo Squats', 30, 'bodyweight', { note: 'Wide stance, toes out, chest up. Push the knees out.' }),
          V('Jump Squats', 40, 'bodyweight', { note: 'Sit, explode, land soft and sink straight into the next one.',
            easy: { name: 'Squat to Calf Raise', note: 'No jump yet: stand up fast onto the toes.' } }),
          V('Pause Squats', 40, 'bodyweight', { note: 'Three-second hold at the bottom. No bounce.' }),
          V('Bulgarian Split Squats', 45, 'bodyweight', { note: 'Back foot on a bench. 5 each leg. Front knee over the toes.',
            easy: { name: 'Split Squats', note: 'Both feet on the floor, back knee to a hover. 5 each leg.' } }),
          V('Wall Sit Calf Raises', 40, 'bodyweight', { note: 'Thighs flat in a wall sit. Raise both heels — each raise is a rep.',
            easy: { name: 'Half Wall Sit Calf Raises', note: 'Sit only halfway down the wall.' } }),
          V('Pulse Squats', 30, 'bodyweight', { note: 'Stay in the bottom half. Small pulses, never stand up.' }),
          V('Assisted Pistol Squats', 60, 'bodyweight', { note: 'Hold a door frame or post, one leg out front. 5 each leg, slow down.',
            easy: { name: 'Box Pistol Squats', equip: 'box', note: 'Sit back onto a box or chair on one leg, stand up. 5 each leg.' },
            hard: { name: 'Pistol Squats', note: 'Free-standing. 5 each leg. Heel down all the way.' } }),
          V('Step-Through Lunges', 40, 'bodyweight', { note: 'Forward lunge, swing straight back into a reverse lunge. 5 each leg.',
            easy: { name: 'Reverse Lunges', note: 'Step back, back knee to a hover. 5 each leg.' } }),
          V('Sissy Squats', 60, 'bodyweight', { note: 'Hold a post. Up on the toes, knees forward, lean back in one line.',
            easy: { name: 'Assisted Sissy Squats', note: 'Hold a post with both hands, only go a quarter of the way down.' } }),
          // Abs finisher (owner's pick-2: hollow hold, bicycle crunches).
          R('Hollow Body Hold', 3, s(30), 30, 'bodyweight', { note: 'Low back glued down, arms and legs long.',
            easy: { sets: 3, seconds: 20, note: 'Knees tucked if the back lifts.' }, hard: { sets: 5, seconds: 45 } }),
          R('Bicycle Crunches', 3, 20, 30, 'bodyweight', { note: 'Elbow to the opposite knee, slow. Each side counts.',
            easy: { sets: 3, reps: 10 }, hard: { sets: 5, reps: 20 } }),
        ],
      },
      {
        label: 'THE 10K', focus: 'CARDIO MODE',
        intro: 'Ten kilometres, ten different jobs. Km 1 easy pace. Km 2 sprint intervals: 20 s on, 40 s off. Km 3 a hill or an incline. Km 4 side-shuffle jog with a 50 m sprint every 2 minutes. Km 5 easy jog and 20 push-ups when you hit the 5. Km 6–10 negative split: every kilometre faster than the one before. Shorter run this week? Keep the order and save the negative split for the last half.',
        run: { km: { easy: [3, 3, 4, 5], normal: [5, 6, 7, 8], hard: [10, 10, 10, 10] }, negativeSplit: true },
      },
      {
        label: 'ONE HUNDRED SIT-UP', focus: 'CORE MASTERY',
        intro: 'Cat-cow, dead bugs. Ten sit-up variations, ten reps a set. Anchor the feet under a bench or a couch when you need to. Then a max plank and the finisher circuit.',
        exercises: [
          V('Sit-Ups', 30, 'bodyweight', { note: 'Shoulders all the way up, roll down one vertebra at a time.' }),
          V('Crunches', 30, 'bodyweight', { note: 'Ribs to the hips, chin off the chest.' }),
          V('Butterfly Sit-Ups', 30, 'bodyweight', { note: 'Soles together, knees out. Reach past the feet.' }),
          V('Tuck Sit-Ups', 40, 'bodyweight', { note: 'Sit up and pull the knees in to meet the chest.',
            easy: { name: 'Seated Knee Tucks', note: 'Sit on the floor, lean back on your hands, tuck and extend.' } }),
          V('Weighted Sit-Ups', 40, 'medball', { swap: 'Backpack Sit-Ups', note: 'Med ball or plate on the chest. Same full range.',
            easy: { name: 'Arms-Crossed Sit-Ups', equip: 'bodyweight', note: 'No weight yet: arms crossed on the chest.' } }),
          V('V-Ups', 45, 'bodyweight', { note: 'Arms and legs straight, meet in the middle.',
            easy: { name: 'Tuck-Ups', note: 'Knees bent: tuck in, open long, low back down.' } }),
          V('Cross-Body Sit-Ups', 30, 'bodyweight', { note: 'Sit up and twist, elbow past the opposite knee. Alternate.' }),
          V('Feet-to-Ceiling Sit-Ups', 40, 'bodyweight', { note: 'Legs straight up, reach for the toes, shoulders off the floor.',
            easy: { name: 'Toe-Touch Crunches', note: 'Legs up, knees soft. Reach as far as you can.' } }),
          V('Sit-Up Punches', 30, 'bodyweight', { note: 'Sit up and throw a jab and a cross at the top. Hands back to the chin.' }),
          V('Decline Sit-Ups', 45, 'bodyweight', { note: 'Feet hooked on a decline bench. Control the way down.',
            easy: { name: 'Slow Sit-Ups', note: 'Flat on the floor. Three seconds down.' },
            home: { name: 'Couch-Anchored Sit-Ups', note: 'Feet under the couch, three seconds down.' } }),
          // Challenge finisher: max plank, then 3 rounds of the circuit.
          R('Max Plank', 1, s(120), 60, 'bodyweight', { fixed: true, note: 'Hold as long as you can. Aim for 2 to 5 minutes.',
            easy: { sets: 1, seconds: 60, note: 'Aim for one minute. Knees down for the last part if you must.' },
            hard: { sets: 1, seconds: 300, note: 'Five minutes. Squeeze everything.' } }),
          R('Mountain Climbers', 3, s(30), 15, 'bodyweight', { note: 'Circuit: climbers, jacks, push-ups, burpees, back to back.' }),
          R('Jumping Jacks', 3, 20, 15, 'bodyweight'),
          R('Push-Ups', 3, 15, 15, 'bodyweight', { note: 'Circuit push-ups. Knees down if you need to.' }),
          R('Burpees', 3, 10, 60, 'bodyweight', { note: 'Chest to the floor, jump and clap overhead.' }),
        ],
      },
      { rest: true, label: 'REST', focus: 'RECOVER', intro: 'Full rest. Walk, stretch, eat well, sleep early.' },
      { rest: true, label: 'REST', focus: 'MOBILITY', intro: 'Rest, or 20 minutes of easy mobility: hips, shoulders, hamstrings.' },
      { rest: true, label: 'REST', focus: 'RECOVER', intro: 'Rest. Tomorrow the hundred starts again.' },
    ],
  },

  // Fight: boxing built around one decisive punch. 2 weeks.
  fight: {
    discipline: 'Boxing',
    blurb: 'Boxing built around one decisive punch: power straights, counters, body work, and the All-Out Series.',
    roundMin: 3,
    restSec: 60,
    weeks: 2,
    // ROOKIE: three 2-minute rounds (the last keeps its super).
    easy: { roundMin: 2, maxRounds: 3 },
    days: [
      {
        label: 'ONE STRAIGHT', focus: '2 SHADOW · 3 BAG',
        rounds: [
          { title: 'Shadow · The Straight', prompt: 'Rear foot turns, hip turns, fist turns over. Everything goes through the straight.',
            combos: ['Rear straight', 'Jab, rear straight', 'Jab, jab, rear straight', 'Step in, rear straight'],
            easyCombos: ['Jab', 'Rear straight', 'Jab, rear straight'] },
          { title: 'Shadow · Set It Up', prompt: 'The jab and the feint open the door. The straight walks through it.',
            combos: ['Feint the jab, rear straight', 'Jab to the body, rear straight', 'Double jab, rear straight, hook', 'Jab, rear straight, step out'],
            easyCombos: ['Jab, rear straight', 'Jab to the body, rear straight'] },
          { title: 'Bag · Power Straights', prompt: 'Plant and sit down on every straight. Hit through the bag, not the surface.',
            combos: ['Jab, rear straight', 'Rear straight, hook, rear straight', 'Jab, jab, rear straight'],
            easyCombos: ['Jab, rear straight', 'Rear straight'] },
          { title: 'Bag · Lead Hand Power', prompt: 'A lead straight with the hip behind it, then the rear hand.',
            combos: ['Lead straight, rear straight', 'Step in, lead straight, hook', 'Jab, lead straight, rear straight'],
            easyCombos: ['Jab, rear straight', 'Lead straight, rear straight'] },
          { title: 'Bag · The Decisive Punch', prompt: 'Make every punch the one that ends it. The last 30 seconds is your super.',
            combos: ['Jab, rear straight', 'Feint the jab, rear straight', 'Jab, rear straight, hook, rear straight'],
            easyCombos: ['Jab, rear straight', 'Rear straight'],
            super: SERIOUS },
        ],
      },
      {
        label: 'THE COUNTER', focus: '2 SHADOW · 3 BAG',
        rounds: [
          { title: 'Shadow · Slip and Fire', prompt: 'See it, slip it, answer it. Never two defensive moves in a row.',
            combos: ['Slip left, rear straight', 'Slip right, hook', 'Roll under, hook, rear straight', 'Pull back, rear straight'],
            easyCombos: ['Slip, rear straight', 'Pull back, jab'] },
          { title: 'Shadow · Parry and Return', prompt: 'Parry the jab with the rear hand, punch back before it returns.',
            combos: ['Parry, jab, rear straight', 'Catch, rear straight', 'Block the hook, hook back', 'Parry, rear straight, hook'],
            easyCombos: ['Parry, jab', 'Catch, rear straight'] },
          { title: 'Bag · Counter Straights', prompt: 'Imagine the jab coming. Slip and hit the bag in the same beat.',
            combos: ['Slip, rear straight', 'Slip, rear straight, hook', 'Pull back, rear straight, hook'],
            easyCombos: ['Slip, rear straight', 'Pull back, rear straight'] },
          { title: 'Bag · Check Hook', prompt: 'They rush in, you pivot out with the hook. Stay on balance.',
            combos: ['Jab, check hook, pivot', 'Rear straight, check hook', 'Slip, hook, pivot out'],
            easyCombos: ['Jab, hook', 'Hook, step out'] },
          { title: 'Bag · Counter to Finish', prompt: 'One counter, one finish. The last 30 seconds is your super.',
            combos: ['Slip, rear straight, hook, rear straight', 'Roll, hook, rear straight', 'Parry, rear straight'],
            easyCombos: ['Slip, rear straight', 'Jab, rear straight'],
            super: SERIOUS },
        ],
      },
      {
        label: 'BODY WORK', focus: '1 SHADOW · 4 BAG', restSec: 45,
        rounds: [
          { title: 'Shadow · Level Change', prompt: 'Bend the knees to go to the body, not the waist. Come back up behind a punch.',
            combos: ['Jab to the body, jab to the head', 'Rear straight to the body, hook', 'Jab, rear straight to the body, hook to the head'],
            easyCombos: ['Jab to the body', 'Rear straight to the body'] },
          { title: 'Bag · Liver Shot', prompt: 'Lead hook to the body, elbow tight, dig it in.',
            combos: ['Jab, rear straight, lead body hook', 'Lead body hook, lead head hook', 'Rear straight, lead body hook, rear straight'],
            easyCombos: ['Jab, lead body hook', 'Lead body hook'] },
          { title: 'Bag · Body Uppercuts', prompt: 'Short uppercuts to the stomach, then come upstairs.',
            combos: ['Rear uppercut, lead hook', 'Lead body uppercut, rear straight', 'Jab, rear body uppercut, lead hook'],
            easyCombos: ['Rear uppercut, lead hook', 'Jab, rear uppercut'] },
          { title: 'Bag · Downstairs, Upstairs', prompt: 'Two to the body, one to the head. They drop the hands, you finish.',
            combos: ['Body jab, body straight, hook', 'Body hook, body hook, rear straight', 'Jab, body straight, hook, rear straight'],
            easyCombos: ['Body jab, rear straight', 'Body hook, rear straight'] },
          { title: 'Bag · Body Finish', prompt: 'Break the body, then the finishing straight. The last 30 seconds is your super.',
            combos: ['Lead body hook, rear straight', 'Body straight, hook, rear straight', 'Jab, rear uppercut, hook, rear straight'],
            easyCombos: ['Lead body hook, rear straight', 'Jab, rear straight'],
            super: SERIOUS },
        ],
      },
      {
        label: 'ALL-OUT SERIES', focus: '5 BAG · RUSH', rush: true, restSec: 45,
        rounds: [
          { title: 'Bag · Straight Punches', prompt: 'Nothing fancy: jab and straight, nonstop, for the whole round.',
            combos: ['Jab, rear straight, jab, rear straight', 'Jab, jab, rear straight', 'Rear straight, rear straight'],
            easyCombos: ['Jab, rear straight', 'Jab, jab'] },
          { title: 'Bag · Hundred Punches', prompt: 'Count them: one hundred punches before the bell. Rushes every minute.',
            combos: ['Jab, rear straight, hook', 'Hook, uppercut, hook', 'Jab, rear straight, hook, rear straight'],
            easyCombos: ['Jab, rear straight', 'Hook, hook'] },
          { title: 'Crowd · Switch and Strike', prompt: 'Two bags: on switch, pivot to the other bag. One bag or shadow: turn to face the next opponent.',
            combos: ['Jab, rear straight', 'Hook, rear straight', 'Slip, rear straight'], multi: true,
            easyCombos: ['Jab, rear straight'] },
          { title: 'Bag · All-Out Pressure', prompt: 'Walk them down. Every combination ends with the straight.',
            combos: ['Jab, jab, rear straight, hook, rear straight', 'Body hook, head hook, rear straight', 'Step in, rear straight, step in, rear straight'],
            easyCombos: ['Jab, rear straight, hook', 'Jab, rear straight'] },
          { title: 'Bag · Limit Breaker', prompt: 'Empty the tank. The last 30 seconds is your super: a single straight, every call.',
            combos: ['Jab, rear straight, hook, rear straight', 'Feint the jab, rear straight', 'Slip, rear straight, hook'],
            easyCombos: ['Jab, rear straight', 'Rear straight'],
            super: SERIOUS },
        ],
      },
    ],
  },

  // Arcade: one ladder, three paths. easyItems = the ROOKIE stations.
  arcade: {
    fit: [
      { title: 'DAY ONE', format: '3 rounds', plan: { rounds: 3, len: 180, rest: 60 }, items: ['10 push-ups', '10 sit-ups', '10 squats', '200 m run'], easyItems: ['5 push-ups', '5 sit-ups', '10 squats', '200 m run-walk'] },
      { title: 'MORNING ROUTINE', format: '4 rounds', plan: { rounds: 4, len: 150, rest: 45 }, items: ['15 push-ups', '15 sit-ups', '15 squats'], easyItems: ['8 push-ups', '10 sit-ups', '12 squats'] },
      { title: 'THE SUPERMARKET SALE', format: '5 × 2:00', plan: { rounds: 5, len: 120, rest: 45 }, items: ['10 jump squats', '10 clap push-ups', '200 m sprint'], easyItems: ['10 squat to calf raises', '10 explosive incline push-ups', '200 m run-walk'] },
      { title: 'NO AIR CONDITIONING', format: '4 rounds', plan: { rounds: 4, len: 180, rest: 60 }, items: ['20 push-ups', '20 sit-ups', '20 squats', '30 s plank'], easyItems: ['10 push-ups', '10 sit-ups', '15 squats', '20 s plank'] },
      { title: 'THE HILL', format: '5 rounds', plan: { rounds: 5, len: 150, rest: 60 }, items: ['200 m hill or incline run', '10 Bulgarian split squats each leg'], easyItems: ['200 m hill walk', '5 split squats each leg'] },
      { title: 'HALFWAY THERE', format: '5 rounds', plan: { rounds: 5, len: 180, rest: 45 }, items: ['10 push-ups', '10 sit-ups', '10 squats', '400 m run'], easyItems: ['6 push-ups', '6 sit-ups', '10 squats', '200 m run-walk'] },
      { title: 'SIT-UP SUPREMACY', format: '5 × 2:30', plan: { rounds: 5, len: 150, rest: 45 }, items: ['10 V-ups', '10 decline or slow sit-ups', '10 cross-body sit-ups', '20 flutter kicks'], easyItems: ['10 tuck-ups', '10 slow sit-ups', '10 cross-body sit-ups', '10 flutter kicks'] },
      { title: 'DAILY QUOTA', format: '1 km + 3 rounds', plan: { rounds: 3, len: 300, rest: 45 }, items: ['1 km run', '30 push-ups', '30 sit-ups', '30 squats'], easyItems: ['500 m run-walk', '15 push-ups', '15 sit-ups', '20 squats'] },
      { title: 'THREE YEARS LATER', format: '5 × 3:00', plan: { rounds: 5, len: 180, rest: 45 }, items: ['10 archer push-ups', '10 pistol squats', '10 V-ups', '10 burpees'], easyItems: ['10 incline archer push-ups', '6 box pistol squats', '10 tuck-ups', '6 burpees'] },
      { title: 'BOSS · ONE HUNDRED', format: 'For time', boss: true, plan: { rounds: 1, len: 5400, rest: 0 }, items: ['100 push-ups', '100 sit-ups', '100 squats', '10 km run'], easyItems: ['50 push-ups (knees allowed)', '50 sit-ups', '50 squats', '3 km run-walk'] },
    ],
    fight: [
      { title: 'DAY ONE', format: '3 × 2:00', plan: { rounds: 3, len: 120, rest: 60 }, items: ['jab, rear straight on the bag', '10 push-ups between rounds'] },
      { title: 'MORNING ROUTINE', format: '4 × 2:00', plan: { rounds: 4, len: 120, rest: 45 }, items: ['shadow: jab, rear straight, step out', '10 squats between rounds'] },
      { title: 'THE SUPERMARKET SALE', format: '4 × 2:30', plan: { rounds: 4, len: 150, rest: 45 }, items: ['fast hands: jab, jab, rear straight', '20 s all-out punches at the end'] },
      { title: 'NO AIR CONDITIONING', format: '3 × 3:00', plan: { rounds: 3, len: 180, rest: 60 }, items: ['power straights: plant and sit down', '10 sit-ups between rounds'] },
      { title: 'THE HILL', format: '4 × 2:30', plan: { rounds: 4, len: 150, rest: 45 }, items: ['slip, rear straight', 'pull back, rear straight, hook'] },
      { title: 'HALFWAY THERE', format: '4 × 3:00', plan: { rounds: 4, len: 180, rest: 60 }, items: ['body work: lead body hook, rear straight', 'body straight, hook'] },
      { title: 'SIT-UP SUPREMACY', format: '4 × 3:00', plan: { rounds: 4, len: 180, rest: 45 }, items: ['jab, rear straight, hook, rear straight', '10 sit-up punches between rounds'] },
      { title: 'DAILY QUOTA', format: '4 × 3:00', plan: { rounds: 4, len: 180, rest: 45 }, items: ['100 punches every round', 'jab, rear straight, nonstop'] },
      { title: 'THREE YEARS LATER', format: '5 × 3:00', plan: { rounds: 5, len: 180, rest: 45 }, multi: true, items: ['crowd: switch to the next bag on every call', 'slip, rear straight'] },
      { title: 'BOSS · ONE HUNDRED', format: '6 × 3:00', boss: true, plan: { rounds: 6, len: 180, rest: 60 }, items: ['100 punches every round', 'Limit Breaker: rear straight on every call'] },
    ],
    stages: [
      { title: 'DAY ONE', format: '3 rounds', plan: { rounds: 3, len: 180, rest: 60 }, items: ['10 push-ups', '10 squats', '1:00 jab, rear straight'], easyItems: ['5 push-ups', '10 squats', '1:00 jab, rear straight'] },
      { title: 'MORNING ROUTINE', format: '4 rounds', plan: { rounds: 4, len: 150, rest: 45 }, items: ['15 sit-ups', '15 squats', '1:00 shadow: jab, rear straight, step out'], easyItems: ['10 sit-ups', '12 squats', '1:00 shadow: jab, rear straight'] },
      { title: 'THE SUPERMARKET SALE', format: '5 × 2:00', plan: { rounds: 5, len: 120, rest: 45 }, items: ['10 jump squats', '10 clap push-ups', '30 s all-out punches'], easyItems: ['10 squat to calf raises', '10 explosive incline push-ups', '30 s fast punches'] },
      { title: 'NO AIR CONDITIONING', format: '4 rounds', plan: { rounds: 4, len: 180, rest: 60 }, items: ['20 push-ups', '20 sit-ups', '1:00 power straights'], easyItems: ['10 push-ups', '10 sit-ups', '1:00 power straights'] },
      { title: 'THE HILL', format: '4 rounds', plan: { rounds: 4, len: 180, rest: 60 }, items: ['200 m hill or incline run', '1:00 slip, rear straight'], easyItems: ['200 m hill walk', '1:00 slip, rear straight'] },
      { title: 'HALFWAY THERE', format: '4 rounds', plan: { rounds: 4, len: 180, rest: 45 }, items: ['400 m run', '10 squats', '1:00 body work'], easyItems: ['200 m run-walk', '10 squats', '1:00 body work'] },
      { title: 'SIT-UP SUPREMACY', format: '4 rounds', plan: { rounds: 4, len: 180, rest: 45 }, items: ['10 V-ups', '10 sit-up punches', '1:00 jab, rear straight, hook, rear straight'], easyItems: ['10 tuck-ups', '10 sit-up punches', '1:00 jab, rear straight, hook'] },
      { title: 'DAILY QUOTA', format: '4 × 3:00', plan: { rounds: 4, len: 180, rest: 45 }, items: ['25 push-ups', '25 squats', '100 punches'], easyItems: ['10 push-ups', '15 squats', '50 punches'] },
      { title: 'THREE YEARS LATER', format: '5 × 3:00', plan: { rounds: 5, len: 180, rest: 45 }, multi: true, items: ['10 archer push-ups', '10 pistol squats', '1:00 crowd: switch on every call'], easyItems: ['10 incline archer push-ups', '6 box pistol squats', '1:00 crowd: switch on every call'] },
      { title: 'BOSS · ONE HUNDRED', format: 'For time', boss: true, plan: { rounds: 1, len: 3600, rest: 0 }, items: ['100 push-ups', '100 sit-ups', '100 squats', '5 km run', '100 rear straights on the bag'], easyItems: ['30 push-ups (knees allowed)', '30 sit-ups', '50 squats', '2 km run-walk', '50 rear straights'] },
    ],
  },
};

// Library rows for movements the Fit library does not have, so the player
// counts and coaches them properly. Movements already in the Fit library
// (push-ups, sit-ups, crunches, burpees, …) are left to the library.
const E = (name, primaryMuscle, equipment, count, coachNote, cadence) => ({ name, primaryMuscle, equipment, voiceCountingType: count, ...(cadence ? { voiceCadenceSeconds: cadence } : {}), coachNote });
export const ONE_HUNDRED_EXERCISES = [
  // push
  E('Close-Grip Knee Push-Ups', 'Triceps', 'Bodyweight', 'rep_count', 'Knees down, elbows tight.', 2.5),
  E('Wide Push-Ups', 'Chest', 'Bodyweight', 'rep_count', 'Hands wide, slow down.', 2.5),
  E('Hindu Push-Ups', 'Shoulders', 'Bodyweight', 'rep_count', 'Swoop down, cobra up, reverse.', 4),
  E('Downward Dog to Cobra', 'Shoulders', 'Bodyweight', 'rep_count', 'Hips high, then chest up, slow.', 4),
  E('Clap Push-Ups', 'Chest', 'Bodyweight', 'rep_count', 'Explode, clap, land soft.', 3),
  E('Explosive Incline Push-Ups', 'Chest', 'Bodyweight', 'rep_count', 'Push fast, hands leave the bench.', 2.5),
  E('Shoulder Tap Push-Ups', 'Chest', 'Bodyweight', 'rep_count', 'Push-up, tap, tap. Hips square.', 4),
  E('Plank Shoulder Taps', 'Core', 'Bodyweight', 'rep_count', 'Feet wide, hips still.', 2),
  E('Incline Archer Push-Ups', 'Chest', 'Bodyweight', 'rep_count', 'Hands on a bench, side to side.', 3.5),
  E('Typewriter Push-Ups', 'Chest', 'Bodyweight', 'rep_count', 'Stay low, slide hand to hand.', 3.5),
  E('Knee Typewriter Push-Ups', 'Chest', 'Bodyweight', 'rep_count', 'Knees down, stay low, slide.', 3.5),
  E('Pike Shoulder Taps', 'Shoulders', 'Bodyweight', 'rep_count', 'Hips high, weight over the hands.', 2),
  E('Hero Push-Ups', 'Chest', 'Bodyweight', 'rep_count', 'Three down, three hold, explode.', 7),
  E('Slow Knee Push-Ups', 'Chest', 'Bodyweight', 'rep_count', 'Knees down, three seconds down.', 5),
  E('Dragon Flag Negatives', 'Core', 'Bodyweight', 'rep_count', 'Straight line, five seconds down.', 6),
  E('Dragon Flags', 'Core', 'Bodyweight', 'rep_count', 'One straight line, up and down.', 5),
  E('Lying Leg Raises', 'Core', 'Bodyweight', 'rep_count', 'Low back pressed down, slow.', 3),
  // legs
  E('Air Squats', 'Legs', 'Bodyweight', 'rep_count', 'Below parallel, stand tall.', 2.5),
  E('Squat to Calf Raise', 'Legs', 'Bodyweight', 'rep_count', 'Stand up fast onto the toes.', 3),
  E('Pause Squats', 'Legs', 'Bodyweight', 'rep_count', 'Three-second hold at the bottom.', 5),
  E('Bulgarian Split Squats', 'Legs', 'Bodyweight', 'rep_count', 'Back foot up, 5 each leg.', 3),
  E('Split Squats', 'Legs', 'Bodyweight', 'rep_count', 'Back knee to a hover, 5 each leg.', 3),
  E('Wall Sit Calf Raises', 'Calves', 'Bodyweight', 'rep_count', 'Thighs flat, raise the heels.', 2),
  E('Half Wall Sit Calf Raises', 'Calves', 'Bodyweight', 'rep_count', 'Halfway down, raise the heels.', 2),
  E('Pulse Squats', 'Legs', 'Bodyweight', 'rep_count', 'Stay low, small pulses.', 1.5),
  E('Assisted Pistol Squats', 'Legs', 'Bodyweight', 'rep_count', 'Hold a post, 5 each leg.', 4),
  E('Box Pistol Squats', 'Legs', 'Bodyweight', 'rep_count', 'Sit to the box on one leg, 5 each.', 4),
  E('Pistol Squats', 'Legs', 'Bodyweight', 'rep_count', 'Free-standing, 5 each leg.', 4),
  E('Step-Through Lunges', 'Legs', 'Bodyweight', 'rep_count', 'Forward, swing back, 5 each leg.', 4),
  E('Sissy Squats', 'Legs', 'Bodyweight', 'rep_count', 'On the toes, knees forward, lean back.', 3.5),
  E('Assisted Sissy Squats', 'Legs', 'Bodyweight', 'rep_count', 'Both hands on a post, quarter depth.', 3),
  E('Hollow Body Hold', 'Core', 'Bodyweight', 'manual_only', 'Low back glued down, long.'),
  // core
  E('Butterfly Sit-Ups', 'Core', 'Bodyweight', 'rep_count', 'Soles together, reach past the feet.', 2.5),
  E('Tuck Sit-Ups', 'Core', 'Bodyweight', 'rep_count', 'Sit up, knees meet the chest.', 3),
  E('Seated Knee Tucks', 'Core', 'Bodyweight', 'rep_count', 'Lean back, tuck and extend.', 2.5),
  E('Backpack Sit-Ups', 'Core', 'Bodyweight', 'rep_count', 'Loaded backpack on the chest.', 3),
  E('Arms-Crossed Sit-Ups', 'Core', 'Bodyweight', 'rep_count', 'Arms crossed, full range.', 2.5),
  E('V-Ups', 'Core', 'Bodyweight', 'rep_count', 'Arms and legs straight, meet in the middle.', 3),
  E('Tuck-Ups', 'Core', 'Bodyweight', 'rep_count', 'Tuck in, open long.', 2.5),
  E('Cross-Body Sit-Ups', 'Core', 'Bodyweight', 'rep_count', 'Elbow past the opposite knee.', 3),
  E('Feet-to-Ceiling Sit-Ups', 'Core', 'Bodyweight', 'rep_count', 'Legs up, reach for the toes.', 2.5),
  E('Toe-Touch Crunches', 'Core', 'Bodyweight', 'rep_count', 'Legs up, reach.', 2),
  E('Sit-Up Punches', 'Core', 'Bodyweight', 'rep_count', 'Sit up, jab, cross, back down.', 3.5),
  E('Decline Sit-Ups', 'Core', 'Bodyweight', 'rep_count', 'Feet hooked, control the way down.', 3),
  E('Slow Sit-Ups', 'Core', 'Bodyweight', 'rep_count', 'Three seconds down.', 4.5),
  E('Couch-Anchored Sit-Ups', 'Core', 'Bodyweight', 'rep_count', 'Feet under the couch, slow down.', 4),
  E('Max Plank', 'Core', 'Bodyweight', 'manual_only', 'Hold as long as you can. Squeeze everything.'),
];
