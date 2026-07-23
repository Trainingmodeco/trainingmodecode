// Step scripts for the ⓘ ScreenGuide walkthroughs — one entry per screen.
// Each step: { target: data-guide value (null = centered intro card), title, body }.
// Tone: direct "this is / choose this if…" per the product owner's script.

export const SCREEN_GUIDES = {
  home: [
    { target: null, title: '🏠 HOME', body: 'This is Home — your daily command center. Everything you need for today lives on this screen.' },
    { target: 'home-level', title: 'YOUR LEVEL & STREAK', body: 'Your level, XP bar, and 🔥 streak. Every workout you finish feeds this — keep the streak alive.' },
    { target: 'todays-bout', title: "TODAY'S BOUT", body: 'A daily mission picked for you from your discipline and level. Tap START to jump straight into training.' },
    { target: 'home-arcade', title: 'YOUR ARCADE CHALLENGE', body: 'Your active Training Arcade saga — continue the climb right from here.' },
    { target: 'home-favorites', title: 'FAVORITES', body: 'One-tap shortcuts to your go-to modes. Quick, HIIT, Fight, or Build — no menus needed.' },
  ],

  profile: [
    { target: null, title: '👤 YOUR PROFILE', body: 'This is your fighter profile — your avatar, stats, and app settings all live here.' },
    { target: 'pr-avatar', title: 'YOUR FIGHTER', body: 'Your avatar and rank. It evolves as you level up — Rookie to Champion… and there are secret tiers beyond.' },
    { target: 'pr-stats', title: 'YOUR STATS', body: 'Your body profile — avatar style, age, height, weight, experience. Tap any row to edit.' },
    { target: 'pr-menu', title: 'SETTINGS & MORE', body: 'Game Link, audio settings, notifications — and REPLAY INTRO GUIDE any time you want the tour again.' },
  ],

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
    { target: 'fh-camp', title: 'TRAINING CAMP', body: 'A 12-level fight camp that builds you toward a Title Fight — real periodization: Foundation, Development, Hard Camp, Taper, then the belt. Clear a level to unlock the next. Choose Training Camp.' },
    { target: 'fh-fight-focus', title: 'FIGHT FOCUS', body: 'Voice-coached rounds like a real session — a round timer with a coach calling the work. Choose Fight Focus.' },
    { target: 'fh-combo', title: 'COMBO COACH', body: 'The coach calls strike combinations and you throw them — builds speed, rhythm, and reaction. Choose Combo Coach.' },
    { target: 'fh-practice', title: 'PRACTICE MODE', body: 'New to striking? Learn strikes, defense, and footwork step by step. Choose Practice Mode.' },
  ],

  training_camp: [
    { target: null, title: '🏕 TRAINING CAMP', body: 'This is your fight camp — 12 levels that build you to a Title Fight the way real camps do. Train it in order: clear the level you are on to unlock the next.' },
    { target: 'tc-current', title: 'THE RAMP — 5 PHASES', body: 'The camp ramps up like a real fight camp. FOUNDATION (1–3) drills the basics → DEVELOPMENT (4–6) builds volume and combinations → HARD CAMP (7–9) is your peak, highest-load block → TAPER (10–11) sharpens you while cutting volume so you arrive fresh → Level 12 is the TITLE FIGHT. The gold ring highlighted here is where you are now.' },
    { target: 'tc-pips', title: 'SESSION 1 vs SESSION 2', body: 'From Level 4 up, each level is a real two-a-day — the pips here show both. SESSION 1 · SKILL is your combat work (bag, pads, footwork, sparring drills), done FIRST while you are fresh so technique stays sharp. SESSION 2 · CONDITIONING is the physical side (roadwork, intervals, strength) done later.' },
    { target: 'tc-pips', title: 'WHY SPLIT THEM?', body: 'Skill degrades when you are tired, so combat work goes first; conditioning handles fatigue fine, so it goes second. Leave 4–8 hours between the two. The level only clears — and the next one unlocks — once BOTH sessions are done ✓✓.' },
    { target: null, title: 'PICK YOUR DIFFICULTY', body: 'Every session runs at EASY, NORMAL, or HARD — you choose in the level card. Higher difficulty adds rounds, volume, and complexity. Important: a clean EASY session always beats a sloppy HARD one, so pick the level you can actually finish with good form.' },
    { target: null, title: 'READINESS & SAFETY', body: 'Before every session a quick gut-check appears — sleep, energy, soreness, stress, mood. Feeling rough? It offers an EASIER session that still counts and keeps your streak. Flag a danger symptom (dizziness, chest, sharp pain, concussion signs) and the camp tells you to REST — no penalty, no streak lost, ever.' },
    { target: null, title: 'EARN THE BELT', body: 'Every session you finish earns XP toward your fighter level. Clear all 12 levels — Foundation through the Title Fight — and the belt is yours.' },
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
    { target: null, title: 'HOW A STAGE WORKS', body: 'Every stage is a real workout with an HP bar — each rep you finish chips it down. Clear the stage to unlock the next one on the ladder.' },
    { target: null, title: '★ STAR RANKS', body: 'Beat a stage fast enough to earn stars — ★, ★★, or ★★★. Your best time is saved on the stage, and an elite MYTHIC tier waits above three stars for the fastest fighters.' },
    { target: null, title: '👑 THE BOSS', body: 'The final stage of every saga is the boss — the hardest session of the storyline. Beat it to finish the saga and claim its trophy.' },
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
    { target: null, title: '🔧 WORKOUT BUILDER', body: 'This screen builds a strength workout around exactly what you want to train. Leave everything on its default for a solid balanced session.' },
    { target: 'wb-muscles', title: 'TARGET MUSCLES', body: 'Tap the muscle groups you want to hit — they light up on the body map. Fewer groups = more focused volume.' },
    { target: 'wb-equipment', title: 'EQUIPMENT', body: 'Bodyweight, Weighted, or Hybrid — set what you actually have so every exercise is doable.' },
    { target: 'wb-difficulty', title: 'DIFFICULTY', body: 'Easy, Normal, or Hard — scales the reps, sets, and rest.' },
    { target: 'wb-programming', title: 'WORKOUT PROGRAMS', body: 'Optional. Open this for set schemes (5×5, 3×10…), popular programs (Push/Pull/Legs, Upper/Lower…), and session length. Leave it on AUTO and the generator picks for you.' },
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
