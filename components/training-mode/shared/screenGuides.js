// Step scripts for the ⓘ ScreenGuide walkthroughs — one entry per screen.
// Each step: { target: data-guide value (null = centered intro card), title, body }.
// Tone: direct "this is / choose this if…" per the product owner's script.

export const SCREEN_GUIDES = {
  home: [
    { target: null, title: '🏠 HOME', body: 'Your daily command center. If you only ever tap one thing, tap TODAY\'S BOUT — everything else on this screen is a shortcut.' },
    { target: 'home-level', title: 'LEVEL · XP · STREAK', body: 'Every finished workout adds XP and fills the bar. Fill it and you level up. The 🔥 number is how many days in a row you\'ve trained — miss a day and it resets.' },
    { target: 'todays-bout', title: "TODAY'S BOUT", body: 'One workout, picked for you from your discipline and level, so you never have to decide. Tap it and you\'re training in seconds.' },
    { target: 'home-arcade', title: 'CONTINUE CHALLENGE', body: 'Training Arcade turns workouts into a game — sagas with stages and a boss at the end. This card is a bookmark: it shows the stage you\'re on and drops you straight back in. It only appears once you\'ve started a saga.' },
    { target: 'home-favorites', title: 'FAVORITES', body: 'Four one-tap shortcuts to the workouts you use most — QUICK, HIIT, FIGHT and BUILD. Use these when you know exactly what you want and don\'t want to hunt through menus.' },
    { target: 'nav-tabs', title: 'THE FOUR TABS', body: 'HOME is here. TRAIN is every workout in the app. PROGRESS holds your stats, trophies and badges. PROFILE has your fighter, settings and sign-in.' },
    { target: 'help-icon', title: '❓ LOST? TAP THIS ICON', body: 'This glowing "?" sits in the corner of every screen. Tap it any time and it walks you through whatever you\'re looking at — you can never get stuck.' },
  ],

  move_lab: [
    { target: null, title: '🥊 MOVE LAB', body: 'Your fighting-game command list — build your own moves and signature specials. They join the Combo Coach call rotation.' },
    { target: 'ml-create', title: '+ CREATE A MOVE', body: 'Name it, then BUILD IT (chain real strikes) or TYPE IT (a spoken special like “Hadouken”). Signature specials collect in the ★ tier.' },
    { target: null, title: 'ROTATION & GAME-READY', body: 'Toggle a move into the Combo Coach rotation so the coach calls it. Moves built from real strikes get a 🎮 GAME-READY tag — those sync to your in-game fighter when Game Link launches.' },
  ],

  profile: [
    { target: null, title: '👤 YOUR PROFILE', body: 'This is your fighter profile — your avatar, stats, account, and every app setting. Here is what each button does.' },
    { target: 'pr-avatar', title: 'YOUR FIGHTER', body: 'Your avatar and rank. It evolves as you level up — Rookie to Champion… and there are secret tiers beyond.' },
    { target: 'pr-stats', title: 'YOUR STATS', body: 'Your body profile — avatar style, age, height, weight, experience. Tap any row to edit.' },
    { target: 'pr-google', title: '🔐 GOOGLE SIGN-IN', body: 'Continue with Google to attach your progress to your account. Optional — everything trains fine without it; signing in backs up your fighter identity.' },
    { target: 'pr-pro', title: '👑 GO PRO', body: 'Opens the Training Mode Pro page — plans, pricing, and everything Pro unlocks (full Camp levels, all Arcade stages, and more). Browsing never charges you; you always confirm first.' },
    { target: 'pr-gamelink', title: '🎮 GAME LINK — TRAIN HERE, WIN THERE', body: 'Training Mode connects to the upcoming companion FIGHTING GAME. The Game Link page explains it: your real training — rank, XP, unlocked tiers — will sync INTO the game and level up your in-game fighter. Tap to open the page and join the free launch list.' },
    { target: 'pr-settings', title: '⚙ SETTINGS', body: 'The full settings page: audio mixer and voice options, units, manage your subscription and billing, and the privacy policy. Anything adjustable lives in here.' },
    { target: 'pr-notifs', title: '🔔 NOTIFICATIONS', body: 'Workout reminders and alerts: your if-then training plan (what, which days, what time), quiet hours, streak-safety nudges, and browser push permission.' },
    { target: 'pr-replay', title: '🔁 REPLAY INTRO GUIDE', body: 'Runs the first-run feature tour again — the spotlight walkthrough of Home, the Train tab, Arcade, Camp, Progress, and Game Link. Replay it any time.' },
  ],

  // The FULL walkthrough — runs after the questionnaire and from Profile →
  // "Replay intro guide", and nowhere else. It crosses screens: a step naming
  // a `screen` drives the app there first, so each feature is spotlighted on
  // its REAL button. Hosted by App.jsx — a guide rendered inside one screen
  // would unmount the instant it navigates away.
  // Beta AN-03 — the mandatory pass is now a 4-step CORE (~30 seconds:
  // Today's Bout → Choose Your Path → the tabs → the ? icon) followed by an
  // OFFER step. NEXT on the offer continues into the full walk-every-mode
  // tour; ✕ starts training (the close path already marks the tour done).
  // Everything cut from the core is covered by each screen's own ? guide,
  // and the whole tour stays available under Profile → Replay Intro Guide.
  full_intro: [
    { screen: 'home', target: 'todays-bout', title: "⚔️ TODAY'S BOUT", body: 'One workout, picked for you from your discipline and level, so you never have to decide. Tap it and you\'re training in seconds. If you only ever tap one thing, tap this.' },

    { screen: 'training_hub', target: null, title: '🥊 CHOOSE YOUR PATH', body: 'Every workout in the app starts here. FIGHT MODE builds striking skill, FIT MODE builds strength and cardio, COMBAT CONDITIONING blends the two, and the TRAINING ARCADE turns it all into a game. You are never locked in — mix them however you like.' },
    { screen: 'training_hub', target: 'nav-tabs', title: 'WHERE THINGS LIVE', body: 'TRAIN is this screen. HOME is your daily pick. PROGRESS holds your stats, trophies and badges. PROFILE has your fighter, settings and sign-in.' },
    { screen: 'training_hub', target: 'help-icon', title: '❓ LOST? TAP THIS ICON', body: 'This glowing "?" sits in the corner of every screen. Tap it any time and it walks you through whatever you\'re looking at — you can never get stuck.' },

    { screen: 'training_hub', target: null, title: '🎬 WANT THE GRAND TOUR?', body: 'That\'s everything you need to start training. Tap NEXT for the full walkthrough — inside every mode, the camp, the arcade and the rewards, about two minutes. Or tap ✕ to start now; you can replay all of this any time from PROFILE → Replay Intro Guide.' },

    { screen: 'training_hub', target: 'hub-fight', title: 'FIGHT MODE — LEARN TO STRIKE', body: 'Choose this to build fighting skill: striking, rounds, combos and technique. Let\'s go inside and look at what it holds.' },
    { screen: 'fight_hub', target: 'fh-camp', title: '⛺ TRAINING CAMP', body: 'A 12-level fight camp that builds you toward a Title Fight, like a real camp: Foundation, Development, Hard Camp, Taper, then the belt. Clear a level to unlock the next.' },
    { screen: 'fight_hub', target: 'fh-fight-focus', title: '⏱️ FIGHT FOCUS', body: 'Voice-coached rounds on a fight timer. A coach calls the work, the bell starts and ends each round, and you get rest between them. The closest thing to a real session.' },
    { screen: 'fight_hub', target: 'fh-combo', title: '🥊 COMBO COACH', body: 'The coach calls combinations and you throw them — "one-two, slip, hook". Builds speed, rhythm and reaction. You set how often the calls come.' },
    { screen: 'fight_hub', target: 'fh-practice', title: '📚 PRACTICE MODE', body: 'New to striking? Start here. Strikes, defense and footwork taught one at a time, with form cues — no timer pressure.' },
    { screen: 'fight_hub', target: 'fh-movelab', title: '⚡ COMBO CREATOR (MOVE LAB)', body: 'Build your own combos and signature moves — chain real strikes into a sequence, or type your own call. Anything you save joins Combo Coach\'s rotation.' },

    { screen: 'training_hub', target: 'hub-fit', title: 'FIT MODE — BUILD THE BODY', body: 'Choose this for strength and cardio, no fighting required. Here is what is inside.' },
    { screen: 'fit_hub', target: 'fit-builder', title: '🛠 WORKOUT BUILDER', body: 'Tell it which muscles to hit, what equipment you have and how hard — it builds the workout. Then shape it: tap a name for form cues, swipe to remove, hold to reorder, and double-tap ⛓ to link exercises into a superset or circuit that runs back-to-back with no rest inside.' },
    { screen: 'fit_hub', target: 'fit-quick', title: '🎯 QUICK MISSION', body: 'Short on time? Pick a length and it generates a circuit on the spot. No setup, no decisions — just start moving.' },
    { screen: 'fit_hub', target: 'fit-cardio', title: '❤ CARDIO MODE', body: 'Cardio on its own: runs, intervals, Tabata and HIIT, with pace coaching and a target you can set by distance or time.' },

    { screen: 'training_hub', target: 'hub-combat', title: '🔥 COMBAT CONDITIONING — THE BLEND', body: 'Fight and fitness in one: ring-pace circuits that build your gas tank. Strike work and hard conditioning in the same round. Pick this when you want to be exhausted and sharp at the same time.' },

    { screen: 'training_hub', target: 'hub-arcade', title: '🕹 TRAINING ARCADE — THE GAME', body: 'The same real workouts, played like a retro game. Let\'s step inside and see how it works.' },
    { screen: 'arcade', target: 'ar-carousel', title: 'THE CAMPAIGN SHELF', body: 'Every card is a saga — a themed campaign of 10 stages with a boss at the end. Swipe to browse them; locked ones say COMING SOON. Tap a card to open its stage ladder.' },
    { screen: 'arcade_series', target: 'arc-ladder', title: 'THE STAGE LADDER', body: 'Inside a saga you climb bottom to top. Each node is one real workout — clear it to unlock the next, and finish fast for ★ ratings. Stage 10 is the boss: answer the bell, survive the finale, and it pays DOUBLE XP.' },

    { screen: 'training_hub', target: null, title: '⚡ XP, LEVELS & REWARDS', body: 'Every finished session earns XP, and XP raises your fighter level and rank. Beat arcade stages fast enough for ★ ratings, train days in a row to grow your 🔥 streak, and unlock trophies and badges as you go. Bosses pay double XP.' },
    { screen: 'profile', target: 'pr-gamelink', title: '🎮 LINKED TO THE UPCOMING GAME', body: 'Training Mode connects to a companion FIGHTING GAME in development. Your real training — rank, XP, unlocked tiers — will sync INTO the game and level up your in-game fighter. Tap GAME LINK any time to read more and join the free launch list.' },
    // The grand tour lands back on Home — the two cards the core pass skipped,
    // ending where the athlete actually starts training. (The tabs and ? steps
    // live in the mandatory core now, so they don't repeat here.)
    { screen: 'home', target: 'home-arcade', title: '🕹 TRAINING ARCADE — YOUR CHALLENGE', body: 'This card is your arcade bookmark. START CHALLENGE begins a saga — a 10-stage campaign with a boss at the end — and once you\'re climbing, it drops you straight back onto the stage you\'re on.' },
    { screen: 'home', target: 'home-favorites', title: '❤ FAVORITES', body: 'Four one-tap shortcuts to the workouts you use most — QUICK, HIIT, FIGHT and BUILD. Use these when you know exactly what you want. That\'s the tour — go train.' },
  ],

  // The everyday "?" on Choose Your Path — compact and single-screen. The
  // full cross-screen walkthrough above only runs after the questionnaire or
  // from Profile → Replay intro guide.
  train_hub: [
    { target: null, title: '🥊 CHOOSE YOUR PATH', body: 'Every workout in the app starts here. Pick the path that matches your goal today — you are never locked in, and you can mix them however you like.' },
    { target: 'hub-fight', title: 'FIGHT MODE — LEARN TO STRIKE', body: 'Choose this to build fighting skill. Inside: TRAINING CAMP (a 12-level camp to a Title Fight), FIGHT FOCUS (coached rounds), COMBO COACH (combos called out to throw), PRACTICE MODE (learn strikes step by step), COMBO CREATOR (build your own moves) and CONDITIONING.' },
    { target: 'hub-fit', title: 'FIT MODE — BUILD THE BODY', body: 'Choose this for strength and cardio, no fighting required. Inside: WORKOUT BUILDER (a workout around the muscles you pick), QUICK MISSION (instant workout when you\'re short on time), CARDIO MODE (runs, intervals, Tabata) and WORKOUT CODEX, coming soon.' },
    { target: 'hub-combat', title: '🔥 COMBAT CONDITIONING — THE BLEND', body: 'Fight and fitness in one: ring-pace circuits that build your gas tank. Pick this when you want to be exhausted and sharp at the same time.' },
    { target: 'hub-arcade', title: '🕹 TRAINING ARCADE — THE GAME', body: 'The same real workouts, played like a retro game. Each saga is 10 stages with a boss at the end. Every rep you complete damages the stage, and clearing one unlocks the next.' },
    { target: 'help-icon', title: '❓ LOST? TAP THIS ICON', body: 'This glowing "?" sits in the corner of every screen. Tap it any time and it walks you through whatever you\'re looking at — you can never get stuck.' },
  ],

  fight_hub: [
    { target: null, title: '🥊 FIGHT MODE', body: 'This is the Fight Mode hub — the striking-skill side of Training Mode. Pick a discipline first, then choose how to train it.' },
    { target: 'fh-disciplines', title: 'SELECT DISCIPLINE', body: 'Boxing, Kickboxing, Muay Thai, or MMA — your session is built around the one you pick.' },
    { target: 'fh-camp', title: 'TRAINING CAMP', body: 'A 12-level fight camp that builds you toward a Title Fight — real periodization: Foundation, Development, Hard Camp, Taper, then the belt. Clear a level to unlock the next. Choose Training Camp.' },
    { target: 'fh-fight-focus', title: 'FIGHT FOCUS', body: 'Voice-coached rounds like a real session — a round timer with a coach calling the work. Choose Fight Focus.' },
    { target: 'fh-combo', title: 'COMBO COACH', body: 'The coach calls strike combinations and you throw them — builds speed, rhythm, and reaction. Choose Combo Coach.' },
    { target: 'fh-practice', title: 'PRACTICE MODE', body: 'New to striking? Learn strikes, defense, and footwork step by step. Choose Practice Mode.' },
    { target: 'fh-movelab', title: 'MOVE LAB', body: 'Build your own combos and signature moves — tap strikes into a sequence or type your own call. Saved moves join Combo Coach’s rotation, and game-ready ones sync to your fighter later. Choose Move Lab.' },
    { target: 'fh-conditioning', title: 'CONDITIONING', body: 'A fight-pace circuit that trains your gas tank — explosive, athletic conditioning that blends fitness with fight work. Choose Conditioning.' },
  ],

  // `campModal: true` steps open the current level's card so the guide can
  // highlight the REAL controls inside it (TrainingCampMap drives this from
  // onStep); the modal closes again on any step without the flag.
  training_camp: [
    { target: null, title: '🏕 TRAINING CAMP', body: 'This is your fight camp — 12 levels that build you to a Title Fight the way real camps do. Train it in order: clear the level you are on to unlock the next.' },
    { target: 'tc-current', title: 'THE RAMP — 5 PHASES', body: 'The camp ramps up like a real fight camp. FOUNDATION (1–3) drills the basics → DEVELOPMENT (4–6) builds volume and combinations → HARD CAMP (7–9) is your peak, highest-load block → TAPER (10–11) sharpens you while cutting volume so you arrive fresh → Level 12 is the TITLE FIGHT. The gold ring highlighted here is where you are now.' },
    { target: 'tc-pips4', title: 'SESSION 1 vs SESSION 2', body: 'From Level 4 up, each level is a real two-a-day — the S1 and S2 boxes highlighted here show both. SESSION 1 · SKILL is your combat work (bag, pads, footwork, sparring drills), done FIRST while you are fresh so technique stays sharp. SESSION 2 · CONDITIONING is the physical side (roadwork, intervals, strength) done later.' },
    { target: 'tc-pips4', title: 'WHY SPLIT THEM?', body: 'Skill degrades when you are tired, so combat work goes first; conditioning handles fatigue fine, so it goes second. Leave 4–8 hours between the two. The level only clears — and the next one unlocks — once BOTH sessions are done ✓✓.' },
    { target: 'tc-difficulty', campModal: true, title: 'PICK YOUR DIFFICULTY', body: 'This is your level card — every session runs at EASY, NORMAL, or HARD, and you choose right here. Higher difficulty adds rounds, volume, and complexity. Important: a clean EASY session always beats a sloppy HARD one, so pick the level you can actually finish with good form.' },
    { target: 'tc-archetype', campModal: true, title: '🥊 FIGHTER ARCHETYPE', body: 'Your fighting identity for this camp. Each card is a real style — think relentless forward pressure, slick defense-into-counters, or a composed twelve-round pace — and your pick shapes what the coach drills every session: the combos called, the footwork, the round goals. The blurb on each card previews its plan at the difficulty you just chose. Not locked in — switch archetypes any time and the camp adapts.' },
    { target: 'tc-readiness', campSheet: true, title: 'READINESS & SAFETY', body: 'This gut-check appears before every session — rate sleep, energy, soreness, stress and mood, 5 being best. Feeling rough? It offers an EASIER session that still counts and keeps your streak. Flag a danger symptom (dizziness, chest, sharp pain, concussion signs) and the camp tells you to REST — no penalty, no streak lost, ever.' },
    { target: 'tc-belt', title: 'EARN THE BELT', body: 'Every session you finish earns XP toward your fighter level. Clear all 12 levels — Foundation through this TITLE FIGHT at the top — and the belt is yours.' },
  ],

  fit_hub: [
    { target: null, title: '💪 FIT MODE', body: 'This is the Fit Mode hub — it holds all the fitness portion of Training Mode. Tap a banner to enter.' },
    { target: 'fit-builder', title: 'WORKOUT BUILDER', body: 'Want a workout built off the muscle groups you select? Pick your muscles, gear, and difficulty — choose Workout Builder.' },
    { target: 'fit-quick', title: 'QUICK MISSION', body: 'Circuit/HIIT-based workouts for when you are short on time and need a challenge — choose Quick Mission.' },
    { target: 'fit-cardio', title: 'CARDIO MODE', body: 'For cardio-specific workouts — timed pace, interval runs, distance running — choose Cardio Mode.' },
    { target: 'fit-codex', title: 'WORKOUT CODEX', body: 'Have your own workout? Training Mode will turn it into a follow-along routine — Workout Codex. Coming soon.' },
  ],

  // Crosses into the stage ladder for the last three steps (hosted by
  // App.jsx like full_intro); closing it lands back on the saga page.
  arcade_saga_select: [
    { screen: 'arcade', target: null, title: '🕹 TRAINING ARCADE', body: 'This is the Training Arcade — workouts as a retro game. Each saga is a training storyline with stages to climb and a boss to beat.' },
    { screen: 'arcade', target: 'ar-carousel', title: 'CHOOSE YOUR SAGA', body: 'Swipe left and right to browse sagas. Tap a card to open its stage ladder and start climbing.' },
    { screen: 'arcade', target: 'ar-player', title: 'YOUR PLAYER BAR', body: 'Your arcade progress lives here — XP, badges, and your active challenge carry across sagas.' },
    { screen: 'arcade', target: null, title: 'HOW A STAGE WORKS', body: 'Every stage is a real workout with an HP bar — each rep you finish chips it down. Clear the stage to unlock the next one on the ladder. Let\'s look at a real ladder.' },
    { screen: 'arcade_series', target: 'arc-stage', title: '▶ ENTER A STAGE', body: 'Tap a stage node like this one to open its mission card — you\'ll see the workout, your best time and ★ goals. ENTER STAGE starts it, and then the timer takes over.' },
    { screen: 'arcade_series', target: 'arc-stars', title: '★ STAR RANKS', body: 'Beat a stage fast enough to earn stars — ★, ★★, or ★★★. Your best time is saved on the stage, this counter tracks your clears, and an elite MYTHIC tier waits above three stars for the fastest fighters.' },
    { screen: 'arcade_series', target: 'arc-boss', title: '👑 THE BOSS', body: 'The final stage of every saga is the boss — those eyes at the top of the ladder. It\'s the hardest session of the storyline: answer the bell, survive it, and the saga\'s trophy and DOUBLE XP are yours.' },
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
    { target: 'wb-programming', title: 'WORKOUT PROGRAMS', body: 'Optional. Open this for set schemes (5×5, 3×10…), popular programs (Push/Pull/Legs, Upper/Lower…), session length, and your saved routines (up to 10). Leave it on AUTO and the generator picks for you.' },
    { target: 'wb-cardio', title: 'ADD CARDIO', body: 'Optional finisher — tack a run, intervals, or Tabata onto the end of your workout.' },
    { target: 'wb-generate', title: 'GENERATE WORKOUT', body: 'Tap here and your workout is built. You can swap any exercise, edit sets and reps, and save it as a routine.' },
    { target: 'wb-generate', title: 'ON THE WORKOUT LIST', body: 'Once it\'s built, the list is yours to shape. Tap an exercise NAME for a demo, form cues and common mistakes. Tap ⇄ to swap it. Swipe a row sideways to remove it (with an undo), and press and hold to drag it up or down.' },
    { target: 'wb-generate', title: '⛓ SUPERSETS & CIRCUITS', body: 'Double-tap the ⛓ on any exercise and it starts glowing — now tap another exercise to link them. Two moves is a SUPERSET, three or more is a CIRCUIT with a rounds setting. Linked moves run back-to-back with NO rest between them, resting once at the end of each round. Tap ✕ on the bracket to unlink.' },
  ],

  quick_mission_setup: [
    { target: null, title: '⏱️ QUICK MISSION', body: 'No planning needed — pick a time and intensity and the app builds the whole session for you.' },
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

  combat_conditioning_active: [
    { target: null, title: '🔥 COMBAT CONDITIONING', body: 'This is your live circuit — fight-pace rounds with a coach calling every drill. Here is what everything on this screen does.' },
    { target: 'cca-title', title: 'SESSION TITLE', body: 'Shows COMBAT CONDITIONING plus your mission name below it, so you always know which circuit you are running.' },
    { target: 'cca-status', title: 'STYLE, DISCIPLINE & ROUND', body: 'Your circuit style and difficulty pills, plus ROUND X / Y — how far you are through the full session.' },
    { target: 'cca-volume', title: '🔊 SOUND', body: 'Tap to open the volume mixer — separate VOICE and MUSIC sliders, adjustable mid-round without pausing.' },
    { target: 'cca-ring', title: 'THE TIMER', body: 'The ring counts down your work or rest time, or tracks your rep count on cadence drills. It runs blue on REST, red on WORK.' },
    { target: 'cca-drillcard', title: 'DRILL CARD', body: 'Shows the current drill and its coaching cue — and in red, any safety note for that movement. Read it before the drill starts.' },
    { target: 'cca-rewind', title: '⟲ REWIND', body: 'Step back to redo the drill before this one — useful if you got cut off or want another attempt.' },
    { target: 'cca-pause', title: '⏸ PLAY / PAUSE', body: 'Pause anytime — the timer and coach hold until you resume. Stepping away from the app auto-pauses too.' },
    { target: 'cca-skip', title: '⏭ SKIP', body: 'Jump straight to the next drill or round if you need to move on early.' },
    { target: 'cca-stop', title: '■ STOP', body: 'Ends the session — asks you to confirm first. Only the drills you completed before stopping count toward your stats.' },
    { target: 'cca-back', title: '‹ BACK BUTTON', body: 'The top-left arrow does the same thing as STOP — it asks you to confirm before ending, so a stray tap never wipes your progress.' },
  ],

  quick_mission_active: [
    { target: null, title: '⏱️ QUICK MISSION', body: 'This is your guided workout — the timer and coach move you through every exercise. Here is what everything on this screen does.' },
    { target: 'qma-title', title: 'MISSION TITLE', body: 'Shows QUICK MISSION plus your generated mission name below it, so you always know which session you are running.' },
    { target: 'qma-status', title: 'ROUND, TYPE & DIFFICULTY', body: 'Your round count, workout type (Bodyweight, Weighted, or Hybrid), and difficulty — set back on the setup screen.' },
    { target: 'qma-volume', title: '🔊 SOUND', body: 'Tap to open the volume mixer — separate VOICE and MUSIC sliders, adjustable mid-round without pausing.' },
    { target: 'qma-ring', title: 'THE TIMER', body: 'Counts down your work or rest time, or tracks reps on cadence-counted exercises. Gold on WORK, blue on REST.' },
    { target: 'qma-exercisecard', title: 'EXERCISE CARD', body: 'Shows your current exercise (or the next one, during rest), and flags a FINISHER move when one comes up.' },
    { target: 'qma-rewind', title: '⟲ REWIND', body: 'Step back to redo the exercise before this one — useful if you got cut off or want another attempt.' },
    { target: 'qma-pause', title: '⏸ PLAY / PAUSE', body: 'Pause anytime — the timer and coach hold until you resume. Stepping away from the app auto-pauses too.' },
    { target: 'qma-skip', title: '⏭ SKIP', body: 'Jump straight to the next exercise or round if you need to move on early.' },
    { target: 'qma-stop', title: '■ STOP', body: 'Ends the mission — asks you to confirm first. Only the exercises you completed before stopping count toward your stats.' },
    { target: 'qma-back', title: '‹ BACK BUTTON', body: 'The top-left arrow does the same thing as STOP — it asks you to confirm before ending, so a stray tap never wipes your progress.' },
  ],
};
