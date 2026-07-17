// Step scripts for the ⓘ ScreenGuide walkthroughs — one entry per screen.
// Each step: { target: data-guide value (null = centered intro card), title, body }.
// Tone: direct "this is / choose this if…" per the product owner's script.

export const SCREEN_GUIDES = {
  train_hub: [
    { target: null, title: '🥊 THE TRAIN TAB', body: 'This is your mission select. Every training path in Training Mode starts from this screen — tap a banner to enter.' },
    { target: 'hub-fight', title: 'FIGHT MODE', body: 'For striking skill — voice-coached rounds, strike combos, and technique lessons. Choose Fight Mode.' },
    { target: 'hub-fit', title: 'FIT MODE', body: 'For building the body — custom strength workouts, fast circuits, and cardio. Choose Fit Mode.' },
    { target: 'hub-combat', title: 'COMBAT CONDITIONING', body: 'Fit + Fight blended into ring-pace circuits that build your fight gas tank. Choose Combat Conditioning.' },
    { target: 'hub-arcade', title: 'TRAINING ARCADE', body: 'Workouts as a retro video game — sagas, stages, bosses, and star ranks. Every rep hits the stage HP bar. Choose Training Arcade.' },
  ],

  fight_hub: [
    { target: null, title: '🥊 FIGHT MODE', body: 'This is the Fight Mode hub — the striking-skill side of Training Mode. Pick a discipline first, then choose how to train it.' },
    { target: 'fh-disciplines', title: 'SELECT DISCIPLINE', body: 'Boxing, Kickboxing, Muay Thai, or MMA — your session is built around the one you pick.' },
    { target: 'fh-fight-focus', title: 'FIGHT FOCUS', body: 'Voice-coached rounds like a real session — a round timer with a coach calling the work. Choose Fight Focus.' },
    { target: 'fh-combo', title: 'COMBO COACH', body: 'The coach calls strike combinations and you throw them — builds speed, rhythm, and reaction. Choose Combo Coach.' },
    { target: 'fh-practice', title: 'PRACTICE MODE', body: 'New to striking? Learn strikes, defense, and footwork step by step. Choose Practice Mode.' },
  ],

  fit_hub: [
    { target: null, title: '💪 FIT MODE', body: 'This is the Fit Mode hub — it holds all the fitness portion of Training Mode. Tap a banner to enter.' },
    { target: 'fit-builder', title: 'WORKOUT BUILDER', body: 'Want a workout built off the muscle groups you select? Pick your muscles, gear, and difficulty — choose Workout Builder.' },
    { target: 'fit-quick', title: 'QUICK MISSION', body: 'Circuit/HIIT-based workouts for when you are short on time and need a challenge — choose Quick Mission.' },
    { target: 'fit-cardio', title: 'CARDIO MODE', body: 'For cardio-specific workouts — timed pace, interval runs, distance running — choose Cardio Mode.' },
    { target: 'fit-codex', title: 'WORKOUT CODEX', body: 'Have your own workout? Training Mode will turn it into a follow-along routine — Workout Codex. Coming soon.' },
  ],

  arcade_saga_select: [
    { target: null, title: '🕹 TRAINING ARCADE', body: 'This is the Training Arcade — workouts as a retro game. Each saga is a training storyline with stages to climb and a boss to beat.' },
    { target: 'ar-carousel', title: 'CHOOSE YOUR SAGA', body: 'Swipe left and right to browse sagas. Tap a card to open its stage ladder and start climbing.' },
    { target: 'ar-player', title: 'YOUR PLAYER BAR', body: 'Your arcade progress lives here — XP, badges, and your active challenge carry across sagas.' },
  ],

  fight_focus_setup: [
    { target: null, title: '🎯 FIGHT FOCUS', body: 'This screen builds your round session. Set the difficulty and rounds, then hit start — the coach handles the rest.' },
    { target: 'ff-difficulty', title: 'DIFFICULTY', body: 'How hard the coaching pushes — round focuses get more demanding as you go up.' },
    { target: 'ff-steppers', title: 'BUILD YOUR ROUNDS', body: 'Set how many rounds, how long each one runs, and your rest between them. TOTAL shows your full session time.' },
    { target: 'ff-start', title: 'START SESSION', body: 'Ready? Tap here — the coach announces each round and the timer runs the fight.' },
  ],

  combo_coach_setup: [
    { target: null, title: '⚡ COMBO COACH', body: 'This screen sets up combo training — the coach calls combinations, you throw them.' },
    { target: 'cc-difficulty', title: 'DIFFICULTY', body: 'Higher difficulty means longer, trickier combinations to react to.' },
    { target: 'cc-mode', title: 'MODE', body: 'Pick how the combos are called — stick with the default if you are new.' },
    { target: 'cc-steppers', title: 'ROUNDS & CADENCE', body: 'Rounds, round length, rest — and CADENCE, the seconds between combo calls. Lower cadence = faster calls.' },
    { target: 'cc-start', title: 'START COMBOS', body: 'Tap here and the first call comes in. React, throw, reset your stance.' },
  ],

  workout_builder: [
    { target: null, title: '🔧 WORKOUT BUILDER', body: 'This screen builds a strength workout around exactly what you want to train.' },
    { target: 'wb-type', title: 'TYPE', body: 'Strength for lifting focus, Hybrid to mix in conditioning, or Cardio Only to skip straight to engine work.' },
    { target: 'wb-muscles', title: 'TARGET MUSCLES', body: 'Tap the muscle groups you want to hit — they light up on the body map. Fewer groups = more focused volume.' },
    { target: 'wb-equipment', title: 'EQUIPMENT', body: 'Bodyweight, Weighted, or Hybrid — set what you actually have so every exercise is doable.' },
    { target: 'wb-difficulty', title: 'DIFFICULTY', body: 'Easy, Normal, or Hard — scales the reps, sets, and rest.' },
    { target: 'wb-cardio', title: 'ADD CARDIO', body: 'Optional finisher — tack a run, intervals, or Tabata onto the end of your workout.' },
    { target: 'wb-generate', title: 'GENERATE WORKOUT', body: 'Tap here and your workout is built. You can swap any exercise, edit sets and reps, and save it as a routine.' },
  ],

  quick_mission_setup: [
    { target: null, title: '⏱ QUICK MISSION', body: 'No planning needed — pick a time and intensity and the app builds the whole session for you.' },
    { target: 'qm-length', title: 'HOW LONG?', body: 'Pick your mission length — or hit SURPRISE ME and let the app roll the dice.' },
    { target: 'qm-intensity', title: 'INTENSITY', body: 'Easy, Normal, or Hard — how dense the work gets inside your time.' },
    { target: 'qm-cardio', title: 'ADD CARDIO', body: 'Optional cardio finisher bolted onto the end of the mission.' },
    { target: 'qm-start', title: 'START MISSION', body: 'Tap here and the guided flow takes over — timer, coach, and all.' },
  ],

  combat_conditioning_setup: [
    { target: null, title: '🔥 COMBAT CONDITIONING', body: 'This screen builds a fight-pace circuit — explosive, athletic conditioning that trains your gas tank.' },
    { target: 'ccs-style', title: 'CIRCUIT STYLE', body: 'Pick the style of circuit — it shapes which drills show up in your rounds.' },
    { target: 'ccs-discipline', title: 'DISCIPLINE', body: 'Your fight base — drills lean toward the striking style you choose.' },
    { target: 'ccs-config', title: 'ROUNDS & INTENSITY', body: 'Set rounds, work time, and rest. Shorter rests run hotter.' },
    { target: 'ccs-start', title: 'START CIRCUIT', body: 'Tap here and fight through each round — recover on the rest, reset, go again.' },
  ],

  cardio_mode: [
    { target: null, title: '🏃 CARDIO MODE', body: 'This screen sets up a pure cardio session — pick how you move, the protocol, and your goal. We set your pace.' },
    { target: 'cm-method', title: 'METHOD', body: 'How you want to move — running, machines, jump rope, swimming, and more.' },
    { target: 'cm-protocol', title: 'PROTOCOL', body: 'Steady holds one pace. Intervals, Tabata, and HIIT alternate hard work with recovery.' },
    { target: 'cm-goal', title: 'YOUR GOAL', body: 'Set a distance or time target — AUTO PACE calculates the pace to hold for your level.' },
    { target: 'cm-start', title: 'START CARDIO', body: 'Tap here and the timer, pace coaching, and logging handle the rest.' },
  ],
};
