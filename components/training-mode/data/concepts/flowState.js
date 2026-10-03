// FLOW STATE — concept drop for Feb–Mar 2027. Inspired by Ultra Instinct
// (the owner's "Ultra Instinct Fight Mode" doc): the body moves before the
// mind decides. Character and franchise names stay out of the app; the
// training carries the identity.
//
// Fight pillars, from the owner's doc:
//   REPETITION   one strike a whole round, then one combination a whole round,
//                last round as fast as you can ("fear the man who has practiced
//                one kick ten thousand times").
//   ANGLES       cone shadowboxing: L-step, pivot, shift, Cuban cross turn,
//                Tyson shift. Never stand on the line of fire.
//   DODGING      rope / bar ducks, slip bag, tennis-ball dodgeball.
//   REFLEX       tennis-ball hat drill, wall bounce, random-light app.
//   COUNTERS     check → roundhouse, block, duck / slip → strike, angle strike.
//   FLOW         4 shadow rounds (no opponent → slow opponent → moderate ×2),
//                then the flow bag at 30–40 % effort. Meditation first.
//
// Fit: five days — Strength, Plyometrics, Agility, High-volume, Functional.
// Tiers read ROOKIE / NORMAL / ELITE:
//   • row.easy — the ROOKIE version, used as written. Muscle-ups regress to
//     pull-up negatives (the ring-row → negative → muscle-up ladder).
//   • row.hard — the ELITE version where it is a different movement.
//   • row.home — the no-gym version. Reflex tools (tennis-ball hat, random-
//     light app, slip bag) always have a no-equipment, partner-free fallback:
//     ball or sock drop catches, coin catches, shadow slips to a called side.
//
// SUPER: SILVER FLOW — the last 30 s of each fight day's last round, a
// counter-and-exit combination called on a fixed beat until the bell.

const R = (name, sets, n, rest, equip, extra = {}) => ({ name, sets, ...(typeof n === 'string' ? { seconds: parseInt(n, 10) } : { reps: n }), rest, equip, ...extra });
const s = (n) => `${n}s`;

const SILVER_FLOW = {
  name: 'Silver Flow',
  every: 5,
  calls: ['Slip, cross, hook, pivot out', 'Check, roundhouse, cross, L-step out', 'Duck, uppercut, hook, shift, cross'],
  easy: { every: 6, calls: ['Slip, cross, pivot out', 'Check, roundhouse'] },
};

export const FLOW_STATE = {
  id: 'flow-state',
  title: 'FLOW STATE',
  tagline: 'Move before you think. Slip, angle, counter, flow.',
  reward: { title: 'FLOW STATE', xp: 500, frame: 'silver-aura' },
  accent: '#7dd3fc',
  tierLabels: { easy: 'ROOKIE', normal: 'NORMAL', hard: 'ELITE' },
  art: {
    poster: '/static/concepts/flow-state/poster.webp',
    wide: '/static/concepts/flow-state/wide.webp',
    card: '/static/concepts/flow-state/card.webp',
    arcade: '/static/series/posters/ultra-instinct.webp',
  },

  // Fit: five training days, 4 weeks. Wednesday is the meditation day;
  // Sunday is full rest.
  fit: {
    weeks: 4,
    minutes: 45,
    blurb: 'Strength, plyometrics, agility, volume and functional power: a body that reacts on its own.',
    days: [
      {
        label: 'ROOTED', focus: 'STRENGTH',
        intro: 'Five minutes of jump rope, scapula pull-ups, hip circles. Fast intent on every rep, full reset between them.',
        exercises: [
          R('Jumping Bar Squats', 5, 5, 90, 'barbell', { swap: 'Jump Squats', note: 'Light bar, 20 to 30 percent of your squat. Sit, jump, land soft, reset. Speed, not load.',
            easy: { name: 'Goblet Squat', sets: 3, reps: 10, equip: 'dumbbell', swap: 'Bodyweight Squats', note: 'Elbows inside the knees, chest up. Earn the jump first.' } }),
          R('Jumping Muscle-Ups', 5, 3, 120, 'bar', { note: 'Low bar, a small jump to help. Pull to the hips, roll the wrists over fast, press out. The turnover is the skill.',
            hard: { name: 'Strict Muscle-Ups', sets: 5, reps: 3, note: 'Dead hang, no kip. Stop the set when a rep turns into a swing.' },
            easy: { name: 'Pull-Up Negatives', sets: 4, reps: 4, note: 'Muscle-up ladder: ring rows, then negatives, then chest-to-bar. Jump to the top, lower for five seconds.' },
            home: { name: 'Table-Row Negatives', note: 'Under a sturdy table: pull fast, lower for five seconds.' } }),
          R('Dumbbell Clean to Snatch', 4, 5, 90, 'dumbbell', { swap: 'Backpack Clean to Press', note: 'Each arm. Clean to the shoulder, dip, then snap the hips and punch it overhead. Lock out, breathe, lower.',
            easy: { name: 'Dumbbell Hang Clean and Press', sets: 3, reps: 6, equip: 'dumbbell', swap: 'Backpack Clean to Press', note: 'Light. Hips snap, catch at the shoulder, press. Each arm.' } }),
          R('Flow Core Chain', 4, 6, 60, 'parallettes', { note: 'L-sit, roll into a V-up, kick out to a plank, tuck the knees in. One chain is one rep. No pauses: it should feel like one movement.',
            easy: { name: 'Bent-Knee Core Chain', sets: 3, reps: 6, equip: 'bodyweight', note: 'Seated tuck, bent-knee V-up, knee plank, tuck-in. Slow and smooth.' },
            home: { name: 'Floor Core Chain', note: 'Hands beside the hips on the floor: lift what you can, then V-up, kick out, tuck in.' } }),
          R('Slow-Eccentric Push-Ups', 4, 8, 60, 'bodyweight', { note: 'Four seconds down, explode up. Slow to load, fast to fire.',
            easy: { name: 'Incline Push-Ups', sets: 3, reps: 10, note: 'Hands on a bench. Three seconds down.' } }),
          R('Hollow Body Hold', 3, s(30), 45, 'bodyweight', { note: 'Low back pressed down, arms by the ears. Breathe through the nose.',
            easy: { name: 'Tuck Hollow Hold', sets: 3, seconds: 20, note: 'Knees bent toward the chest, low back down.' } }),
        ],
      },
      {
        label: 'SPARK', focus: 'PLYOMETRICS',
        intro: 'Skips, pogo hops, arm swings. Every rep explosive, then a full reset. Quality over fatigue.',
        exercises: [
          R('Burpee High Jumps', 4, 8, 75, 'bodyweight', { note: 'Chest to the floor, snap up, jump as high as you can with the knees driving. Land quiet.',
            easy: { name: 'Step-Back Burpees', sets: 3, reps: 6, note: 'Step back, step in, small hop at the top.' } }),
          R('Uneven Platform Explosive Push-Ups', 4, 8, 75, 'medball', { note: 'One hand on a med ball or plate. Push off hard, switch sides in the air or every rep.',
            hard: { name: 'Med-Ball Crossover Push-Ups', sets: 4, reps: 10, note: 'Push-up, explode across the ball to the other side, push-up. Fast hands.' },
            easy: { name: 'Staggered Incline Push-Ups', sets: 3, reps: 8, equip: 'bodyweight', note: 'Hands on a bench, one hand forward. Switch the stagger halfway.' },
            home: { name: 'Staggered Explosive Push-Ups', equip: 'bodyweight', note: 'One hand on a thick book. Push off hard, switch sides each rep.' } }),
          R('Ball Throw to Squat', 4, 10, 60, 'medball', { swap: 'Jump Squats', note: 'Throw the ball up from the chest, catch it, sink straight into a squat. Throw, catch, absorb.',
            easy: { sets: 3, reps: 8, note: 'Light ball, small throw. Catch, then squat.' } }),
          R('Single-Arm Wall Ball to Sprawl', 4, 6, 75, 'medball', { note: 'Each arm. Throw at the wall like a cross, catch, drop the ball and sprawl. Hips to the floor, back up fast.',
            easy: { name: 'Med-Ball Chest Pass', sets: 3, reps: 10, note: 'Two hands to the wall, full body behind it. No sprawl yet.' },
            home: { name: 'Shadow Cross to Sprawl', equip: 'bodyweight', note: 'Hard cross, then sprawl and get back to stance. Each side.' } }),
          R('Lunge to Single-Leg Jump', 3, 6, 60, 'bodyweight', { note: 'Each leg. Reverse lunge, drive the knee up and jump off the front foot. Stick the landing.',
            easy: { name: 'Reverse Lunge to Knee Drive', sets: 3, reps: 8, note: 'No jump: lunge back, stand and drive the knee up. Each leg.' } }),
          R('Tennis Ball Wall Bounce', 3, s(60), 45, 'bodyweight', { note: 'Reflex finisher. Throw a tennis ball at the wall from two metres, catch it on any bounce. Alternate hands. Closer is harder.',
            easy: { name: 'Ball Drop Catch', sets: 3, seconds: 45, note: 'Hold a ball or a balled-up sock at shoulder height, let go, catch it before it hits the floor. Alternate hands.' },
            home: { name: 'Coin Drop Catch', note: 'Coin on the back of your hand: flip it up, snatch it out of the air. Alternate hands. No ball needed.' } }),
        ],
      },
      { rest: true, label: 'STILL MIND', focus: 'MEDITATE', intro: 'Ten minutes sitting, eyes closed: breathe in for four, out for six. Then picture your combinations, slips and pivots one by one, clean and calm. Walk or stretch after. Before you face an opponent, you face your mind.' },
      {
        label: 'LIGHT FEET', focus: 'AGILITY',
        intro: 'High knees, side steps, Ali shuffle for 5 minutes. Stay on the balls of the feet all session. Fast feet, quiet feet.',
        exercises: [
          R('Alternating Ladder Drills', 4, s(30), 45, 'ladder', { note: 'Two-in, lateral in-out, then hopscotch. Change the pattern every set. Eyes up, not on your feet.',
            easy: { sets: 3, seconds: 30, note: 'One pattern only: two feet in each box. Get it clean, then get it fast.' },
            home: { name: 'Floor-Line Ladder', note: 'Tape lines or tiles as rungs. Same patterns.' } }),
          R('Ickey Shuffle', 3, s(30), 45, 'ladder', { note: 'In, in, out, down the ladder. Light, rhythmic, arms loose.',
            home: { name: 'Line Ickey Shuffle', note: 'Along one floor line: in, in, out.' } }),
          R('Ali Shuffle', 3, s(20), 40, 'bodyweight', { note: 'Feet scissor fast under you, hands up. Stay relaxed, it should look easy.' }),
          R('Lead-Foot In-and-Outs', 4, s(30), 40, 'bodyweight', { note: 'Fighting stance. Lead foot snaps in and back out of range. Back foot stays loaded. Tiny, fast, never flat.' }),
          R('Cone Angle Drill', 4, 5, 60, 'cones', { note: 'Three to five cones: each one is an opponent\'s range. Move in, and as your foot reaches a cone, cut out: L-step, pivot or shift. Five cones is one rep.',
            easy: { sets: 3, reps: 3, note: 'Three cones, walk it first: approach, L-step, reset. Then jog it.' },
            home: { name: 'Shoe Angle Drill', note: 'Shoes or water bottles as cones. Same drill.' } }),
          R('Depth Jumps', 4, 5, 75, 'box', { note: 'Step off a low box, touch the floor and jump straight up. Floor contact as short as you can make it.',
            hard: { name: 'Depth Jump to Broad Jump', sets: 4, reps: 5, note: 'Step off, rebound forward into a broad jump. Stick it.' },
            easy: { name: 'Depth Drop Stick', sets: 3, reps: 5, note: 'Step off a low step and freeze the landing: knees soft, chest up. No jump.' },
            home: { name: 'Stair Depth Drops', note: 'Off the bottom stair: drop, land soft, jump up.' } }),
          R('Freestyle Footwork with Strikes', 3, s(60), 45, 'bodyweight', { note: 'Move like it is a 3D fighting game: in, out, side to side, around. Throw a jab or cross whenever you land in range.' }),
        ],
      },
      {
        label: 'THE THOUSAND', focus: 'HIGH VOLUME',
        intro: 'Two minutes of jumping jacks and arm circles. Big numbers, steady pace. This is the day the body learns to keep going without asking.',
        exercises: [
          R('Bodyweight Squats', 5, 25, 45, 'bodyweight', { note: 'Full depth, steady rhythm. Breathe out on the way up.' }),
          R('Push-Ups', 5, 20, 45, 'bodyweight', { note: 'Chest to the floor, body in one line.',
            easy: { name: 'Incline Push-Ups', sets: 4, reps: 10, note: 'Hands on a bench.' } }),
          R('Inverted Rows', 5, 12, 45, 'bar', { note: 'Bar at hip height, heels down, chest to the bar.',
            easy: { sets: 4, reps: 8, note: 'Raise the bar: the more upright, the easier.' },
            home: { name: 'Table Rows', note: 'Under a sturdy table, chest to the edge.' } }),
          R('Dips', 4, 12, 60, 'bar', { note: 'Parallel bars. Shoulders below the elbows, lock out at the top.',
            easy: { name: 'Bench Dips', sets: 4, reps: 10, equip: 'bodyweight', note: 'Knees bent, shoulders down.' },
            home: { name: 'Chair Dips', note: 'Two sturdy chairs or a bench.' } }),
          R('Tuck-Ins', 4, 20, 30, 'bodyweight', { note: 'Seated, lean back on your hands, knees in, legs out. Feet never touch.' }),
          R('Russian Twists', 4, 30, 30, 'bodyweight', { note: 'Feet up if you can. Turn the shoulders, not just the hands. Each touch counts.' }),
          R('V-Ups', 4, 15, 45, 'bodyweight', { note: 'Hands and feet meet over the hips. Lower slow.',
            hard: { name: 'Pike-Ups', sets: 4, reps: 12, note: 'Hanging from a bar: legs straight, toes to the bar. No swing.' },
            easy: { name: 'Crunches', sets: 4, reps: 25, note: 'Shoulder blades off the floor, slow down.' } }),
        ],
      },
      {
        label: 'ONE BODY', focus: 'FUNCTIONAL',
        intro: 'Five minutes of easy movement: world\'s greatest stretch, halos, hip openers. Everything today connects the hips to the hands.',
        exercises: [
          R('Bulgarian Split Squat', 4, 8, 75, 'dumbbell', { swap: 'Bodyweight Bulgarian Split Squat', note: 'Each leg. Back foot on a bench, drop the back knee straight down, drive through the front heel.',
            easy: { name: 'Split Squat', sets: 3, reps: 8, equip: 'bodyweight', note: 'Both feet on the floor. Each leg. Hold something for balance if you need it.' } }),
          R('Single-Arm Inverted Row with Reach', 4, 6, 60, 'bar', { note: 'Each arm. Row up with one arm, reach the free hand to the ceiling, lower slow. Hips stay square.',
            easy: { name: 'Inverted Rows', sets: 3, reps: 8, note: 'Two hands, bar high, body straight.' },
            home: { name: 'Single-Arm Table Row with Reach', note: 'Under a sturdy table, one hand on the edge.' } }),
          R('Shoulder Plate Rotations', 3, 10, 45, 'dumbbell', { swap: 'Backpack Halos', note: 'Plate or dumbbell. Circle it around the head, elbows close. Each direction. Ribs down.',
            easy: { sets: 3, reps: 8, note: 'Light. Slow circles, each direction.' } }),
          R('Barbell Push-Out to Press', 4, 8, 75, 'barbell', { swap: 'Backpack Push-Out to Press', note: 'Press the bar straight out from the chest, pull it back, then press it overhead. Brace the whole time.',
            easy: { name: 'Dumbbell Push-Out to Press', sets: 3, reps: 8, equip: 'dumbbell', swap: 'Backpack Push-Out to Press', note: 'Light pair. Out, back, overhead.' } }),
          R('Kettlebell Around the World to High Catch', 3, 6, 60, 'kettlebell', { swap: 'Backpack Halos', note: 'Pass the bell around the waist twice, then swing it up and catch it at chest height. Each direction. Soft hands.',
            easy: { name: 'Kettlebell Around the World', sets: 3, reps: 8, note: 'Pass it around the waist. No catch yet. Each direction.' } }),
          R('Weighted Turkish Get-Up', 3, 3, 75, 'kettlebell', { swap: 'Turkish Get-Up', note: 'Each side. Eyes on the bell, arm locked, one step at a time up and down.',
            easy: { name: 'Half Turkish Get-Up', sets: 3, reps: 3, equip: 'bodyweight', note: 'To the hand, then back down. A shoe balanced on your fist. Each side.' } }),
        ],
      },
      { rest: true, label: 'REST', focus: 'RECOVER', intro: 'Full rest, or a walk, a stretch and ten minutes of breathing.' },
    ],
  },

  // Fight: Kickboxing on the owner's pillars. Four days: repetition, angles,
  // dodging and counters, flow. Every day ends with Silver Flow.
  fight: {
    discipline: 'Kickboxing',
    blurb: 'One strike a thousand times, angles, slips and counters, then the flow round where you stop thinking.',
    roundMin: 3,
    restSec: 60,
    weeks: 3,
    // ROOKIE: three 2-minute rounds (the last keeps its super).
    easy: { roundMin: 2, maxRounds: 3 },
    days: [
      {
        label: 'ONE THOUSAND TIMES', focus: 'REPETITION · 5 BAG',
        rounds: [
          { title: 'Bag · One Strike: Hands', prompt: 'One strike the whole round. Perfect form every rep, then a little faster. Simple strikes first.',
            combos: ['Jab'],
            easyCombos: ['Jab'] },
          { title: 'Bag · One Strike: Legs', prompt: 'One kick the whole round. Same chamber, same pivot, same return.',
            combos: ['Rear roundhouse'],
            easyCombos: ['Rear roundhouse'] },
          { title: 'Bag · One Combination', prompt: 'Same combination until the bell. Distance, technique, timing. Build the memory with intent.',
            combos: ['Jab, cross, hook, rear roundhouse'],
            easyCombos: ['Jab, roundhouse'] },
          { title: 'Bag · The Long Chain', prompt: 'The long combination, over and over. Slow it down until it is clean, then let it run.',
            combos: ['Jab, cross to the body, low switch kick, cross, lead shovel, high roundhouse'],
            easyCombos: ['Jab, cross, roundhouse'] },
          { title: 'Bag · No Thought', prompt: 'Same combination, as fast as you can. Stop thinking about technique and just act. The last 30 seconds is your super.',
            combos: ['Jab, cross to the body, low switch kick, cross, lead shovel, high roundhouse', 'Jab, roundhouse'],
            easyCombos: ['Jab, roundhouse'],
            super: SILVER_FLOW },
        ],
      },
      {
        label: 'OFF THE LINE', focus: 'ANGLES · 3 SHADOW · 2 BAG',
        rounds: [
          { title: 'Shadow · Footwork Only', prompt: 'Three to five cones mark their range. No strikes: reach a cone, take the angle. No cones: shoes or bottles.',
            combos: ['L-step', 'Pivot left', 'Pivot right', 'Shift', 'Cuban cross turn', 'In, out, pivot'],
            easyCombos: ['Step in, step out', 'Pivot left', 'L-step'] },
          { title: 'Shadow · Angle After the Combination', prompt: 'Throw, then leave the line before they can answer. You cannot cut an angle from too far.',
            combos: ['Jab, cross, L-step', 'Jab, cross, hook, pivot out', 'Jab, cross, shift, cross', 'Cross, hook, Cuban cross turn'],
            easyCombos: ['Jab, cross, pivot', 'Jab, cross, L-step'] },
          { title: 'Shadow · Angle Inside the Combination', prompt: 'Change the angle mid-combination. Up, down, left, right are just suggestions.',
            combos: ['Jab, L-step, hook, cross', 'Jab, cross, Tyson shift, cross, hook', 'Slip, shift, cross, hook', 'Jab, pivot, rear roundhouse'],
            easyCombos: ['Jab, step, hook', 'Jab, pivot, cross'] },
          { title: 'Bag · One Strike, Every Angle', prompt: 'Jab only. Pivot or L-step after every one, so the bag never sees you on the same line twice.',
            combos: ['Jab, pivot', 'Jab, L-step', 'Double jab, shift', 'Jab, pivot, jab'],
            easyCombos: ['Jab, pivot', 'Jab, step out'] },
          { title: 'Bag · Angle Strikes', prompt: 'Step off, strike from the new angle. The last 30 seconds is your super.',
            combos: ['Jab, L-step, hook, cross', 'Cross, Cuban cross turn, hook, low kick', 'Jab, cross, Tyson shift, cross, roundhouse', 'Pivot, spinning back kick'],
            easyCombos: ['Jab, pivot, cross', 'Jab, cross, L-step'],
            super: SILVER_FLOW },
        ],
      },
      {
        label: 'UNTOUCHABLE', focus: 'DODGE · COUNTER · 2 SHADOW · 3 BAG', restSec: 45,
        rounds: [
          { title: 'Shadow · Head Movement Only', prompt: 'React to the call. Rope or slip bag: duck under it on every call. Nothing to hang? Shadow the slip to the called side.',
            combos: ['Slip left', 'Slip right', 'Duck', 'Roll under', 'Pull back', 'Slip, slip, duck'],
            easyCombos: ['Slip left', 'Slip right', 'Duck'] },
          { title: 'Shadow · Slip and Return', prompt: 'See it, slip it, answer it. The counter comes off the slip, not after a pause.',
            combos: ['Slip, cross', 'Slip, slip, hook', 'Duck, uppercut', 'Pull back, cross', 'Roll under, hook, cross'],
            easyCombos: ['Slip, cross', 'Duck, uppercut'] },
          { title: 'Bag · Check and Return', prompt: 'Check the kick, then fire back with the same leg. Block, then hit the gap it leaves.',
            combos: ['Check, roundhouse', 'Check, cross, roundhouse', 'Block, hook, low kick', 'Parry, cross, hook'],
            easyCombos: ['Check, roundhouse', 'Block, cross'] },
          { title: 'Bag · Slip to Strike', prompt: 'Imagine the bag throws first. Slip or duck, then counter hard.',
            combos: ['Slip, cross, hook', 'Duck, uppercut, hook', 'Slip, slip, cross, low kick', 'Pull back, cross, roundhouse'],
            easyCombos: ['Slip, cross', 'Duck, uppercut'] },
          { title: 'Bag · Angle Counters', prompt: 'Make them miss, take the angle, punish. The last 30 seconds is your super.',
            combos: ['Slip, pivot, hook', 'Duck, L-step, uppercut, hook', 'Check, roundhouse, pivot out', 'Slip, shift, cross'],
            easyCombos: ['Slip, cross, pivot', 'Check, roundhouse'],
            super: SILVER_FLOW },
        ],
      },
      {
        label: 'FLOW STATE', focus: '4 SHADOW · 2 FLOW BAG', restSec: 45,
        rounds: [
          { title: 'Flow · No Opponent', prompt: 'First minute: stand still, eyes closed, breathe, picture every strike. Then move. Minimum thought, nobody in front of you. Let the combinations float.' },
          { title: 'Flow · Slow Opponent', prompt: 'Now someone is in front of you, striking very slowly. See it, answer it. Stay relaxed.',
            combos: ['Slip, cross', 'Check, roundhouse', 'Pull back, jab, cross'],
            easyCombos: ['Slip, cross', 'Check, roundhouse'] },
          { title: 'Flow · Moderate Pace', prompt: 'Your opponent picks up the pace: a challenge you can keep up with. Basic combinations, and you see every strike coming.',
            combos: ['Slip, cross, hook', 'Check, roundhouse', 'Duck, uppercut, pivot', 'Jab, cross, L-step'],
            easyCombos: ['Slip, cross', 'Jab, cross, pivot'] },
          { title: 'Flow · Moderate Pace, Deeper', prompt: 'Same pace, longer exchanges. Defend, counter, move, without stopping to think.',
            combos: ['Slip, cross, hook, shift, cross', 'Check, roundhouse, jab, cross', 'Duck, uppercut, hook, pivot out', 'Block, cross, low kick, L-step'],
            easyCombos: ['Slip, cross, hook', 'Check, roundhouse'] },
          { title: 'Flow Bag · 30 to 40 Percent', prompt: 'Thirty to forty percent effort, perfect form. Flow through the combinations like a dance. Never stop moving.',
            combos: ['Jab, cross, hook, roundhouse', 'Slip, cross, pivot', 'Jab, cross to the body, low switch kick', 'Check, roundhouse, cross'],
            easyCombos: ['Jab, cross, roundhouse', 'Slip, cross'] },
          { title: 'Flow Bag · Silver Flow', prompt: 'Stay light, stay loose, it should feel like the prior days are doing the work. The last 30 seconds is your super.',
            combos: ['Slip, cross, hook, pivot out', 'Jab, L-step, hook, roundhouse', 'Duck, uppercut, hook, shift, cross'],
            easyCombos: ['Slip, cross, pivot', 'Jab, cross, roundhouse'],
            super: SILVER_FLOW },
        ],
      },
    ],
  },

  // Arcade: one ladder, three paths. easyItems = the ROOKIE stations.
  arcade: {
    fit: [
      { title: 'FIRST STEP', format: '3 rounds', plan: { rounds: 3, len: 180, rest: 60 }, items: ['20 squats', '30 s high knees', '10 push-ups'], easyItems: ['15 squats', '20 s high knees', '8 incline push-ups'] },
      { title: 'THE THOUSAND', format: '4 rounds', plan: { rounds: 4, len: 150, rest: 45 }, items: ['25 squats', '20 push-ups', '20 tuck-ins'], easyItems: ['15 squats', '10 incline push-ups', '12 tuck-ins'] },
      { title: 'LIGHT FEET', format: '4 × 2:30', plan: { rounds: 4, len: 150, rest: 45 }, items: ['30 s ladder drill', '20 s Ali shuffle', '30 s lead-foot in-and-outs'], easyItems: ['30 s floor-line ladder', '15 s Ali shuffle', '20 s lead-foot in-and-outs'] },
      { title: 'CUT THE ANGLE', format: '3 rounds', plan: { rounds: 3, len: 180, rest: 60 }, items: ['5-cone angle drill × 2', '5 depth jumps', '10 skater hops'], easyItems: ['3-cone angle drill × 2', '5 depth drop sticks', '8 lateral steps'] },
      { title: 'SPARK', format: 'EMOM 10 min', plan: { rounds: 10, len: 60, rest: 5 }, items: ['4 burpee high jumps', '4 explosive push-ups'], easyItems: ['3 step-back burpees', '5 incline push-ups'] },
      { title: 'NO TOUCH', format: '4 rounds', plan: { rounds: 4, len: 150, rest: 45 }, items: ['1:00 tennis ball wall bounce', '10 lunge to single-leg jumps', '20 Russian twists'], easyItems: ['45 s ball or sock drop catch', '8 reverse lunge to knee drive', '16 Russian twists'] },
      { title: 'STILL WATER', format: '3 rounds', plan: { rounds: 3, len: 180, rest: 60 }, items: ['3 Turkish get-ups each side', '30 s hollow hold', '10 Bulgarian split squats each leg'], easyItems: ['2 half get-ups each side', '20 s tuck hollow hold', '8 split squats each leg'] },
      { title: 'COUNTER', format: '8 × 30 s on / 30 s off', plan: { rounds: 8, len: 30, rest: 30 }, items: ['single-arm wall ball to sprawl', 'ball throw to squat'], easyItems: ['med-ball chest pass', 'squats'] },
      { title: 'SILVER EDGE', format: '5 × 3:00', plan: { rounds: 5, len: 180, rest: 60 }, items: ['3 jumping muscle-ups', '10 dips', '12 inverted rows', '15 V-ups'], easyItems: ['3 pull-up negatives', '10 bench dips', '8 inverted rows', '20 crunches'] },
      { title: 'BOSS · EMPTY MIND', format: 'For time', boss: true, plan: { rounds: 1, len: 1500, rest: 0 }, items: ['100 squats', '10 muscle-ups', '50 push-ups', '40 burpee high jumps', '30 V-ups', '3:00 ladder and cone footwork'], easyItems: ['60 squats', '10 pull-up negatives', '30 incline push-ups', '20 step-back burpees', '40 crunches', '3:00 floor-line footwork'] },
    ],
    fight: [
      { title: 'FIRST STEP', format: '3 × 2:00', plan: { rounds: 3, len: 120, rest: 60 }, items: ['jab only, perfect form', '1:00 stance footwork'] },
      { title: 'THE THOUSAND', format: '4 × 2:30', plan: { rounds: 4, len: 150, rest: 45 }, items: ['100 jabs', '50 rear roundhouses', 'jab, roundhouse until the bell'], easyItems: ['60 jabs', '30 rear roundhouses', 'jab, roundhouse until the bell'] },
      { title: 'LIGHT FEET', format: '4 × 2:30', plan: { rounds: 4, len: 150, rest: 45 }, items: ['lead-foot in-and-outs', 'jab off every step in'] },
      { title: 'CUT THE ANGLE', format: '3 × 3:00', plan: { rounds: 3, len: 180, rest: 60 }, items: ['L-step, pivot, shift, Cuban cross turn', 'jab, cross, angle out'], easyItems: ['L-step and pivot only', 'jab, cross, pivot'] },
      { title: 'SPARK', format: 'EMOM 10 min', plan: { rounds: 10, len: 60, rest: 5 }, items: ['jab, cross, hook, roundhouse × 3', '3 sprawls'] },
      { title: 'NO TOUCH', format: '4 × 2:30', plan: { rounds: 4, len: 150, rest: 45 }, items: ['slip bag or rope ducks on the call', 'tennis ball hat drill or wall bounce'], easyItems: ['shadow slips to the called side', 'ball or sock drop catch'] },
      { title: 'STILL WATER', format: '3 × 3:00', plan: { rounds: 3, len: 180, rest: 60 }, items: ['1:00 eyes closed, breathe, visualize', 'flow shadow at 30–40 percent'] },
      { title: 'COUNTER', format: '8 × 30 s on / 30 s off', plan: { rounds: 8, len: 30, rest: 30 }, items: ['check, roundhouse', 'slip, cross, hook', 'duck, uppercut'] },
      { title: 'SILVER EDGE', format: '4 × 3:00', plan: { rounds: 4, len: 180, rest: 45 }, items: ['jab, cross to the body, low switch kick, cross, lead shovel, high roundhouse', 'Tyson shift and angle counters'], easyItems: ['jab, cross, roundhouse', 'slip, cross, pivot'] },
      { title: 'BOSS · EMPTY MIND', format: '5 × 3:00', boss: true, plan: { rounds: 5, len: 180, rest: 60 }, items: ['the four-round flow progression', 'Silver Flow: slip, cross, hook, pivot out'], easyItems: ['flow shadow: no opponent, then slow opponent', 'Silver Flow: slip, cross, pivot out'] },
    ],
    stages: [
      { title: 'FIRST STEP', format: '3 rounds', plan: { rounds: 3, len: 180, rest: 60 }, items: ['20 squats', '10 push-ups', '1:00 jab only'], easyItems: ['15 squats', '8 incline push-ups', '1:00 jab only'] },
      { title: 'THE THOUSAND', format: '4 rounds', plan: { rounds: 4, len: 150, rest: 45 }, items: ['25 squats', '20 push-ups', '1:00 jab, roundhouse'], easyItems: ['15 squats', '10 incline push-ups', '1:00 jab, roundhouse'] },
      { title: 'LIGHT FEET', format: '4 × 2:30', plan: { rounds: 4, len: 150, rest: 45 }, items: ['30 s ladder drill', '20 s Ali shuffle', '1:00 lead-foot in-and-outs with a jab'], easyItems: ['30 s floor-line ladder', '15 s Ali shuffle', '1:00 lead-foot in-and-outs with a jab'] },
      { title: 'CUT THE ANGLE', format: '3 rounds', plan: { rounds: 3, len: 180, rest: 60 }, items: ['5-cone angle drill', '5 depth jumps', '1:00 jab, cross, angle out'], easyItems: ['3-cone angle drill', '5 depth drop sticks', '1:00 jab, cross, pivot'] },
      { title: 'SPARK', format: 'EMOM 10 min', plan: { rounds: 10, len: 60, rest: 5 }, items: ['4 burpee high jumps', 'jab, cross, hook, roundhouse'], easyItems: ['3 step-back burpees', 'jab, cross, roundhouse'] },
      { title: 'NO TOUCH', format: '4 rounds', plan: { rounds: 4, len: 150, rest: 45 }, items: ['1:00 tennis ball wall bounce', '1:00 slip bag or rope ducks', '20 Russian twists'], easyItems: ['45 s ball or sock drop catch', '1:00 shadow slips to the called side', '16 Russian twists'] },
      { title: 'STILL WATER', format: '3 rounds', plan: { rounds: 3, len: 180, rest: 60 }, items: ['3 Turkish get-ups each side', '1:00 eyes closed, breathe', '1:00 flow shadow'], easyItems: ['2 half get-ups each side', '1:00 eyes closed, breathe', '1:00 flow shadow'] },
      { title: 'COUNTER', format: '8 × 30 s on / 30 s off', plan: { rounds: 8, len: 30, rest: 30 }, items: ['single-arm wall ball to sprawl', 'check, roundhouse; slip, cross; duck, uppercut'], easyItems: ['med-ball chest pass', 'check, roundhouse; slip, cross'] },
      { title: 'SILVER EDGE', format: '5 × 3:00', plan: { rounds: 5, len: 180, rest: 60 }, items: ['3 jumping muscle-ups', '10 dips', '1:00 angle counters on the bag'], easyItems: ['3 pull-up negatives', '10 bench dips', '1:00 slip, cross, pivot'] },
      { title: 'BOSS · EMPTY MIND', format: 'For time', boss: true, plan: { rounds: 1, len: 1500, rest: 0 }, items: ['100 squats', '10 muscle-ups', '50 push-ups', '40 burpee high jumps', '3:00 flow bag', '1:00 Silver Flow'], easyItems: ['60 squats', '10 pull-up negatives', '30 incline push-ups', '20 step-back burpees', '3:00 flow bag', '1:00 Silver Flow, rookie calls'] },
    ],
  },
};

// Library rows for movements the Fit library does not have, so the player
// counts and coaches them properly.
const E = (name, primaryMuscle, equipment, count, coachNote, cadence) => ({ name, primaryMuscle, equipment, voiceCountingType: count, ...(cadence ? { voiceCadenceSeconds: cadence } : {}), coachNote });
export const FLOW_STATE_EXERCISES = [
  // Strength
  E('Jumping Bar Squats', 'Legs', 'Weighted', 'rep_count', 'Light bar. Sit, jump, land soft, reset.', 4),
  E('Jump Squats', 'Legs', 'Bodyweight', 'rep_count', 'Sit back, jump tall, land soft.', 3),
  E('Goblet Squat', 'Legs', 'Weighted', 'rep_count', 'Elbows inside the knees, chest up.', 3),
  E('Bodyweight Squats', 'Legs', 'Bodyweight', 'rep_count', 'Full depth, steady rhythm.', 2.5),
  E('Jumping Muscle-Ups', 'Back', 'Bodyweight', 'rep_count', 'Small jump, fast turnover, press out.', 5),
  E('Strict Muscle-Ups', 'Back', 'Bodyweight', 'rep_count', 'Dead hang, no kip.', 5),
  E('Pull-Up Negatives', 'Back', 'Bodyweight', 'rep_count', 'Five seconds down.', 6),
  E('Table-Row Negatives', 'Back', 'Bodyweight', 'rep_count', 'Pull fast, five seconds down.', 6),
  E('Dumbbell Clean to Snatch', 'Full Body', 'Weighted', 'rep_count', 'Clean, dip, snap the hips, punch it overhead.', 5),
  E('Dumbbell Hang Clean and Press', 'Full Body', 'Weighted', 'rep_count', 'Hips snap, catch at the shoulder, press.', 4),
  E('Backpack Clean to Press', 'Full Body', 'Bodyweight', 'rep_count', 'Loaded backpack. Same shape as the lift.', 4),
  E('Flow Core Chain', 'Core', 'Bodyweight', 'rep_count', 'L-sit, V-up, kick-out plank, tuck-in. One smooth rep.', 7),
  E('Bent-Knee Core Chain', 'Core', 'Bodyweight', 'rep_count', 'Tuck, bent-knee V-up, knee plank, tuck-in.', 7),
  E('Floor Core Chain', 'Core', 'Bodyweight', 'rep_count', 'Hands by the hips, lift, V-up, kick out, tuck in.', 7),
  E('Slow-Eccentric Push-Ups', 'Chest', 'Bodyweight', 'rep_count', 'Four seconds down, explode up.', 5),
  E('Incline Push-Ups', 'Chest', 'Bodyweight', 'rep_count', 'Hands on a bench, body in one line.', 3),
  E('Hollow Body Hold', 'Core', 'Bodyweight', 'manual_only', 'Low back down, arms by the ears.'),
  E('Tuck Hollow Hold', 'Core', 'Bodyweight', 'manual_only', 'Knees in, low back down.'),
  // Plyometrics
  E('Burpee High Jumps', 'Full Body', 'Bodyweight', 'rep_count', 'Chest down, snap up, jump high, land quiet.', 4),
  E('Step-Back Burpees', 'Full Body', 'Bodyweight', 'rep_count', 'Step back, step in, small hop.', 4),
  E('Uneven Platform Explosive Push-Ups', 'Chest', 'Weighted', 'rep_count', 'One hand on the ball, push off hard.', 3),
  E('Med-Ball Crossover Push-Ups', 'Chest', 'Weighted', 'rep_count', 'Push-up, explode across the ball, push-up.', 3.5),
  E('Staggered Incline Push-Ups', 'Chest', 'Bodyweight', 'rep_count', 'One hand forward, switch halfway.', 3),
  E('Staggered Explosive Push-Ups', 'Chest', 'Bodyweight', 'rep_count', 'One hand on a book, push off hard.', 3),
  E('Explosive Push-Ups', 'Chest', 'Bodyweight', 'rep_count', 'Hands leave the floor every rep.', 2.5),
  E('Ball Throw to Squat', 'Full Body', 'Weighted', 'rep_count', 'Throw, catch, sink into the squat.', 3.5),
  E('Single-Arm Wall Ball to Sprawl', 'Full Body', 'Weighted', 'rep_count', 'Throw like a cross, catch, sprawl, back up.', 5),
  E('Med-Ball Chest Pass', 'Chest', 'Weighted', 'rep_count', 'Drive it from the chest with the whole body.', 2.5),
  E('Shadow Cross to Sprawl', 'Full Body', 'Bodyweight', 'rep_count', 'Hard cross, sprawl, back to stance.', 3.5),
  E('Sprawls', 'Full Body', 'Bodyweight', 'rep_count', 'Hips to the floor, back to stance fast.', 2.5),
  E('Lunge to Single-Leg Jump', 'Legs', 'Bodyweight', 'rep_count', 'Lunge back, drive the knee, jump, stick it.', 3.5),
  E('Reverse Lunge to Knee Drive', 'Legs', 'Bodyweight', 'rep_count', 'Lunge back, stand, knee up.', 3),
  E('Tennis Ball Wall Bounce', 'Full Body', 'Bodyweight', 'manual_only', 'Throw at the wall, catch on any bounce. Alternate hands.'),
  E('Ball Drop Catch', 'Full Body', 'Bodyweight', 'manual_only', 'Drop it from the shoulder, catch before the floor.'),
  E('Coin Drop Catch', 'Forearms', 'Bodyweight', 'manual_only', 'Flip the coin off your hand, snatch it out of the air.'),
  // Agility
  E('Alternating Ladder Drills', 'Legs', 'Bodyweight', 'manual_only', 'Eyes up, light feet, change the pattern.'),
  E('Floor-Line Ladder', 'Legs', 'Bodyweight', 'manual_only', 'Tape lines as rungs. Same patterns.'),
  E('Ickey Shuffle', 'Legs', 'Bodyweight', 'manual_only', 'In, in, out. Light and rhythmic.'),
  E('Line Ickey Shuffle', 'Legs', 'Bodyweight', 'manual_only', 'Along one line: in, in, out.'),
  E('Ali Shuffle', 'Legs', 'Bodyweight', 'manual_only', 'Feet scissor fast, hands up, relaxed.'),
  E('High Knees', 'Full Body', 'Bodyweight', 'manual_only', 'Knees to the hips, fast arms.'),
  E('Lead-Foot In-and-Outs', 'Legs', 'Bodyweight', 'manual_only', 'Lead foot snaps in and out. Back foot loaded.'),
  E('Cone Angle Drill', 'Legs', 'Bodyweight', 'rep_count', 'Reach the cone, cut the angle.', 8),
  E('Shoe Angle Drill', 'Legs', 'Bodyweight', 'rep_count', 'Shoes as cones. Reach, cut the angle.', 8),
  E('Depth Jumps', 'Legs', 'Bodyweight', 'rep_count', 'Step off, touch, jump. Short contact.', 4),
  E('Depth Jump to Broad Jump', 'Legs', 'Bodyweight', 'rep_count', 'Step off, rebound forward, stick it.', 5),
  E('Depth Drop Stick', 'Legs', 'Bodyweight', 'rep_count', 'Step off, freeze the landing.', 4),
  E('Stair Depth Drops', 'Legs', 'Bodyweight', 'rep_count', 'Off the bottom stair, land soft, jump up.', 4),
  E('Freestyle Footwork with Strikes', 'Full Body', 'Bodyweight', 'manual_only', 'Move in every direction, strike when in range.'),
  // High volume
  E('Push-Ups', 'Chest', 'Bodyweight', 'rep_count', 'Chest to the floor, body in one line.', 2.5),
  E('Inverted Rows', 'Back', 'Bodyweight', 'rep_count', 'Heels down, chest to the bar.', 3),
  E('Table Rows', 'Back', 'Bodyweight', 'rep_count', 'Chest to the table edge.', 3),
  E('Dips', 'Chest', 'Bodyweight', 'rep_count', 'Below the elbows, lock out.', 3),
  E('Bench Dips', 'Triceps', 'Bodyweight', 'rep_count', 'Knees bent, shoulders down.', 3),
  E('Chair Dips', 'Triceps', 'Bodyweight', 'rep_count', 'Sturdy chairs only.', 3),
  E('Tuck-Ins', 'Core', 'Bodyweight', 'rep_count', 'Lean back, knees in, legs out.', 2),
  E('Russian Twists', 'Core', 'Bodyweight', 'rep_count', 'Turn the shoulders. Each touch counts.', 1.5),
  E('V-Ups', 'Core', 'Bodyweight', 'rep_count', 'Hands and feet meet. Lower slow.', 3),
  E('Pike-Ups', 'Core', 'Bodyweight', 'rep_count', 'Hanging, legs straight, toes to the bar.', 3.5),
  E('Crunches', 'Core', 'Bodyweight', 'rep_count', 'Shoulder blades up, slow down.', 2),
  // Functional
  E('Bulgarian Split Squat', 'Legs', 'Weighted', 'rep_count', 'Back foot up, knee straight down, drive the front heel.', 3.5),
  E('Bodyweight Bulgarian Split Squat', 'Legs', 'Bodyweight', 'rep_count', 'Back foot on a chair, knee straight down.', 3.5),
  E('Split Squat', 'Legs', 'Bodyweight', 'rep_count', 'Both feet down, knee straight down.', 3),
  E('Single-Arm Inverted Row with Reach', 'Back', 'Bodyweight', 'rep_count', 'Row one arm, reach the other to the ceiling.', 4),
  E('Single-Arm Table Row with Reach', 'Back', 'Bodyweight', 'rep_count', 'One hand on the table edge, row and reach.', 4),
  E('Shoulder Plate Rotations', 'Shoulders', 'Weighted', 'rep_count', 'Circle it around the head, ribs down.', 3),
  E('Backpack Halos', 'Shoulders', 'Bodyweight', 'rep_count', 'Loaded backpack around the head, slow.', 3),
  E('Barbell Push-Out to Press', 'Shoulders', 'Weighted', 'rep_count', 'Out from the chest, back, then overhead.', 4),
  E('Dumbbell Push-Out to Press', 'Shoulders', 'Weighted', 'rep_count', 'Out, back, overhead.', 4),
  E('Backpack Push-Out to Press', 'Shoulders', 'Bodyweight', 'rep_count', 'Hug the pack: out, back, overhead.', 4),
  E('Kettlebell Around the World to High Catch', 'Core', 'Weighted', 'rep_count', 'Two passes around the waist, swing, catch at the chest.', 5),
  E('Kettlebell Around the World', 'Core', 'Weighted', 'rep_count', 'Pass it around the waist, hips still.', 2.5),
  E('Weighted Turkish Get-Up', 'Full Body', 'Weighted', 'manual_only', 'Eyes on the bell, arm locked, one step at a time.'),
  E('Turkish Get-Up', 'Full Body', 'Bodyweight', 'manual_only', 'Shoe on the fist, one step at a time.'),
  E('Half Turkish Get-Up', 'Full Body', 'Bodyweight', 'manual_only', 'Up to the hand and back down.'),
];
