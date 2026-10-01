// ULTRA EGO — concept drop #1. Power at all costs: the pressure fighter who
// takes the hit and gives it back harder. Built from the owner's Ultra Ego
// regime (Fit) and Striking Mode pt. 2 (Fight), plus a hybrid Arcade gauntlet.
//
// Content only. data/concepts/index.js turns this into Fit days, Fight
// rounds and Arcade stages; nothing here knows about screens.
//
// Exercise rows: { name, sets, reps | seconds, rest, note, equip, swap }
//   equip — 'bodyweight' | 'dumbbell' | 'barbell' | 'kettlebell' | 'bar' | 'band'
//   swap  — the no-equipment version, used when the athlete trains at home
// Tier scaling (EASY / NORMAL / HARD) multiplies sets and reps in index.js,
// so the numbers below are NORMAL.

export const ULTRA_EGO = {
  id: 'ultra-ego',
  title: 'ULTRA EGO',
  tagline: 'Power at all costs. Take the hit, give it back harder.',
  reward: { title: 'DESTROYER', xp: 500, frame: 'violet-aura' },
  accent: '#e879f9',
  // Owner-supplied reference art, used for now (owner's call); swap for
  // original art in public/static/concepts/ultra-ego/ when it is ready.
  art: {
    poster: '/static/concepts/ultra-ego/poster.webp',
    wide: '/static/concepts/ultra-ego/wide.webp',
    card: '/static/concepts/ultra-ego/card.webp',
  },

  fit: {
    weeks: 4,
    minutes: 45,
    blurb: 'Thick neck, big traps and lats, legs that hold you up when you get hit.',
    days: [
      {
        label: 'NECK & SHOULDERS', focus: 'BRACE',
        intro: 'A strong neck keeps your head from snapping back on impact. Start light, every rep controlled.',
        exercises: [
          { name: 'Neck Curls (Front)', sets: 2, reps: 25, rest: 45, equip: 'bodyweight', note: 'Lying face up, head off the bench. Chin to chest, slow. Bodyweight only until it feels easy.' },
          { name: 'Neck Curls (Back)', sets: 2, reps: 25, rest: 45, equip: 'bodyweight', note: 'Face down, head off the bench. Lift to neutral only, never past it.' },
          { name: 'Barbell Overhead Press (Military Press)', sets: 4, reps: 8, rest: 90, equip: 'barbell', swap: 'Pike Push-Ups' },
          { name: 'Dumbbell Shrugs', sets: 3, reps: 12, rest: 60, equip: 'dumbbell', note: 'Kirk-style: three seconds down on every rep.', swap: 'Hanging Shrugs' },
          { name: 'Lateral Raises', sets: 3, reps: 15, rest: 45, equip: 'dumbbell', swap: 'Y-W-T Raises' },
          { name: 'Typewriter Push-Ups', sets: 3, reps: 10, rest: 60, equip: 'bodyweight', note: 'Shift side to side at the bottom. Five each way.' },
        ],
      },
      {
        label: 'BACK & LATS', focus: 'PULL',
        intro: 'Wide back for the frame, false grip for the forearms. Two seconds up, two seconds down.',
        exercises: [
          { name: 'Wide Grip Pull-Ups', sets: 4, reps: 8, rest: 90, equip: 'bar', note: 'Two seconds up, two seconds down.', swap: 'Inverted Rows' },
          { name: 'Chin-Ups', sets: 3, reps: 8, rest: 75, equip: 'bar', swap: 'Archer Inverted Rows' },
          { name: 'Dumbbell Bent-Over Rows', sets: 4, reps: 10, rest: 60, equip: 'dumbbell', note: 'Superset straight into inverted rows.' },
          { name: 'Inverted Rows', sets: 4, reps: 12, rest: 75, equip: 'bar', note: 'Overhand two sets, underhand two sets. Max reps.' },
          { name: 'False-Grip Body Rows', sets: 3, reps: 10, rest: 60, equip: 'bar', note: 'Wrist over the bar. Pull to the face. Forearms will burn.' },
        ],
      },
      {
        label: 'LEGS', focus: 'BASE',
        intro: 'Heavy, then burn out. A planted base is where the power comes from.',
        exercises: [
          { name: 'Goblet Squats', sets: 4, reps: 8, rest: 90, equip: 'dumbbell', note: 'Heels raised on a plate. Moderate to heavy.' },
          { name: 'Dumbbell Sumo Squats', sets: 3, reps: 20, rest: 60, equip: 'dumbbell', note: 'Burnout: narrow, mid, then wide stance, no rest between.', swap: 'Jump Squats' },
          { name: 'Kettlebell Swings', sets: 4, reps: 15, rest: 60, equip: 'kettlebell', note: 'Rise onto your toes at the top of every swing.', swap: 'Single-Leg Romanian Deadlift' },
          { name: 'Calf Raises', sets: 3, reps: 25, rest: 45, equip: 'bodyweight' },
        ],
      },
      { rest: true, label: 'REST OR LIGHT CARDIO', focus: 'RECOVER', intro: 'Rest, stretch, or an easy jog. Muscle is built here.' },
      {
        label: 'FULL-BODY BURNOUT', focus: 'VOLUME',
        intro: 'High reps, nothing held back. Every set to the edge of failure.',
        exercises: [
          { name: 'Dive Bomber Push-Ups', sets: 4, reps: 12, rest: 60, equip: 'bodyweight', note: 'Swoop down through the chest, press up through the arms.' },
          { name: 'Jump Squats', sets: 4, reps: 15, rest: 60, equip: 'bodyweight', note: 'Land on your toes, absorb, explode again.' },
          { name: 'Archer Pull-Ups', sets: 3, reps: 6, rest: 90, equip: 'bar', swap: 'Archer Inverted Rows' },
          { name: 'Tiger Push-Ups', sets: 3, reps: 10, rest: 60, equip: 'bodyweight', note: 'Forearms to hands and back, body straight.' },
          { name: 'V-Ups', sets: 4, reps: 15, rest: 45, equip: 'bodyweight' },
          { name: 'Neck Curls (Front)', sets: 2, reps: 25, rest: 45, equip: 'bodyweight' },
        ],
      },
      { rest: true, label: 'ACTIVE RECOVERY', focus: 'FLOW', intro: 'Shadowbox three easy rounds, then stretch neck, traps and hips.' },
      { rest: true, label: 'REST', focus: 'REST', intro: 'Full rest. Come back hungry.' },
    ],
  },

  // Fight: five days of 3:00 rounds on the Fight Focus timer. Every round is a
  // called objective. Solo-friendly: sparring from the source became a
  // forward-pressure circuit so nobody needs a partner.
  fight: {
    discipline: 'Muay Thai',
    blurb: 'Pressure fighting. Absorb, plant, answer back harder.',
    roundMin: 3,
    restSec: 60,
    days: [
      {
        label: 'GROUNDED POWER', focus: '5 × 3:00 BAG',
        rounds: [
          { title: 'Planted Jab-Cross', prompt: 'Feet planted, hips through every cross. Power from the floor up.' },
          { title: 'Power Hooks', prompt: 'Short hooks from a wide base. Turn the hip, not the arm.' },
          { title: 'Teep and Push', prompt: 'Teep to push them back, then step in with the cross.' },
          { title: 'Body Shots', prompt: 'Drop the level, hammer the body. Liver, ribs, liver.' },
          { title: 'Everything Planted', prompt: 'Throw anything you like, but never come off your base.' },
        ],
      },
      {
        label: 'AGGRESSION', focus: '5 × 3:00 SHADOW', rush: true,
        rounds: [
          { title: 'Walk Them Down', prompt: 'Forward pressure, constant feints, never a step back.' },
          { title: 'Combo Chains', prompt: 'Three-strike chains, then four, then five. Keep them coming.' },
          { title: 'Kicks Off the Hands', prompt: 'Jab-cross then the round kick. Every combination ends with a kick.' },
          { title: 'Knees in Range', prompt: 'Imagine the clinch. Pull down, knee, knee, push off.' },
          { title: 'Ultra Ego', prompt: 'All of it, as fast and as hard as you can for the full three minutes.' },
        ],
      },
      {
        label: 'ROLL & ANSWER', focus: '5 × 3:00 BAG',
        rounds: [
          { title: 'Slip and Roll', prompt: 'Slip the jab, roll under the hook. Head off the line every time.' },
          { title: 'Roll Then Hook', prompt: 'Roll under, come up with the hook. Defence feeds offence.' },
          { title: 'Catch and Return', prompt: 'Parry the jab, return a cross before they reset.' },
          { title: 'Check and Kick', prompt: 'Check the kick, plant, kick back on the same side.' },
          { title: 'Take It, Give It', prompt: 'Brace, absorb, answer with three. Every exchange ends with you.' },
        ],
      },
      {
        label: 'NO RETREAT', focus: 'PRESSURE CIRCUIT', rush: true,
        rounds: [
          { title: 'Forward Only', prompt: 'Shadowbox moving forward only. Cut the ring, corner them.' },
          { title: 'Slam and Strike', prompt: 'Ten slam ball reps or sprawls, then thirty seconds of bag, repeat.' },
          { title: 'Sprawl and Brawl', prompt: 'Sprawl, back up, three-punch combination. Again.' },
          { title: 'Rope Burn', prompt: 'Battle ropes or fast shadowboxing hands, thirty on, thirty easy.' },
          { title: 'Last Stand', prompt: 'Empty the tank. Nothing left after this.' },
        ],
      },
      {
        label: 'TECHNIQUE SHARPEN', focus: '5 × 3:00 COMBOS',
        rounds: [
          { title: 'Clean Jab-Cross', prompt: 'Perfect form at speed. Snap back to guard.' },
          { title: 'Hook-Kick', prompt: 'Lead hook into the rear round kick. Smooth, then fast.' },
          { title: 'Elbow Entries', prompt: 'Close distance and land the elbow off the jab.' },
          { title: 'Parry-Counter', prompt: 'Parry, counter, angle out. Repeat both sides.' },
          { title: 'Footwork Bag', prompt: 'Circle, cut the angle, strike, move. Never stand still.' },
        ],
      },
    ],
  },

  // Arcade gauntlet: hybrid fit × fight stations, HYROX-style. Stages 1–9
  // open to everyone; the boss unlocks when the athlete finishes the Fit OR
  // the Fight program.
  arcade: {
    stages: [
      { title: 'AWAKENING', format: '3 rounds', plan: { rounds: 3, len: 180, rest: 60 }, items: ['200 m run', '15 dive bomber push-ups', '1:00 shadowbox'] },
      { title: 'PLANTED', format: '4 rounds', plan: { rounds: 4, len: 150, rest: 45 }, items: ['10 kettlebell swings', '20 power straights', '10 burpees'] },
      { title: 'BRACE FOR IMPACT', format: '3 rounds', plan: { rounds: 3, len: 180, rest: 60 }, items: ['60 s plank', '15 wall-ball throws or 15 squat thrusts', '1:00 body shots'] },
      { title: 'SEES RED', format: 'EMOM 10 min', plan: { rounds: 10, len: 60, rest: 5 }, items: ['8 sprawls', '6 knees each side'] },
      { title: 'IRON BACK', format: '4 rounds', plan: { rounds: 4, len: 150, rest: 45 }, items: ['8 pull-ups or 12 inverted rows', '12 inverted rows', '30 hooks'] },
      { title: 'ROLL & ANSWER', format: '3 rounds', plan: { rounds: 3, len: 180, rest: 60 }, items: ['20 squats', '1:00 slip and roll', '20 counter straights'] },
      { title: 'DESTROYER LEGS', format: '4 rounds', plan: { rounds: 4, len: 150, rest: 45 }, items: ['10 goblet squats', '20 alternating teeps', '200 m run'] },
      { title: 'NO RETREAT', format: '8 × 30 s on / 30 s off', plan: { rounds: 8, len: 30, rest: 30 }, items: ['slam ball or sprawls', 'bag flurry'] },
      { title: 'PRIDE', format: '5 × 3:00', plan: { rounds: 5, len: 180, rest: 60 }, items: ['1:00 bag', '1:00 push-up ladder', '1:00 clinch knees'] },
      { title: 'BOSS · ULTRA EGO', format: 'For time', plan: { rounds: 1, len: 1500, rest: 0 }, boss: true, items: ['1 km run', '50 kettlebell swings', '100 straights', '40 sprawls', '20 pull-ups', '3:00 all-out bag'] },
    ],
  },
};

// Movements the core library does not carry. index.js registers these so the
// Fit player can show cues and count reps for them like any other exercise.
export const ULTRA_EGO_EXERCISES = [
  { name: 'Neck Curls (Front)', primaryMuscle: 'Neck', equipment: 'Bodyweight', voiceCountingType: 'rep_count', voiceCadenceSeconds: 2.5, coachNote: 'Slow and controlled. Bodyweight only until it is easy.' },
  { name: 'Neck Curls (Back)', primaryMuscle: 'Neck', equipment: 'Bodyweight', voiceCountingType: 'rep_count', voiceCadenceSeconds: 2.5, coachNote: 'Lift to neutral only, never past it.' },
  { name: 'Typewriter Push-Ups', primaryMuscle: 'Chest', equipment: 'Bodyweight', voiceCountingType: 'rep_count', voiceCadenceSeconds: 3, coachNote: 'Shift side to side at the bottom.' },
  { name: 'Dive Bomber Push-Ups', primaryMuscle: 'Shoulders', equipment: 'Bodyweight', voiceCountingType: 'rep_count', voiceCadenceSeconds: 3, coachNote: 'Swoop through, press up, reverse.' },
  { name: 'Tiger Push-Ups', primaryMuscle: 'Triceps', equipment: 'Bodyweight', voiceCountingType: 'rep_count', voiceCadenceSeconds: 2.5, coachNote: 'Forearms to hands and back.' },
  { name: 'Hanging Shrugs', primaryMuscle: 'Back', equipment: 'Bodyweight', voiceCountingType: 'rep_count', voiceCadenceSeconds: 2, coachNote: 'Dead hang, shrug the shoulders up without bending the arms.' },
  { name: 'Wide Grip Pull-Ups', primaryMuscle: 'Back', equipment: 'Bodyweight', voiceCountingType: 'rep_count', voiceCadenceSeconds: 4, coachNote: 'Two seconds up, two seconds down.' },
  { name: 'False-Grip Body Rows', primaryMuscle: 'Back', equipment: 'Bodyweight', voiceCountingType: 'rep_count', voiceCadenceSeconds: 3, coachNote: 'Wrist over the bar, pull to the face.' },
  { name: 'Y-W-T Raises', primaryMuscle: 'Shoulders', equipment: 'Bodyweight', voiceCountingType: 'rep_count', voiceCadenceSeconds: 3, coachNote: 'Y, W, T is one rep. Squeeze the shoulder blades.' },
];
