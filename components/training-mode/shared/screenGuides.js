// Step scripts for the ⓘ ScreenGuide walkthroughs — one entry per screen.
// Each step: { target: data-guide value (null = centered intro card), title, body }.
// Tone: direct "this is / choose this if…" per the product owner's script.

export const SCREEN_GUIDES = {
  home: [
    { target: null, title: '🏠 HOME', body: 'Your daily command center. If you only ever tap one thing, tap the gold START at the top — everything else on this screen is a way to choose something different.' },
    { target: 'home-level', title: 'LEVEL · RANK · STREAK', body: 'Every finished workout adds XP and fills the bar. Fill it and you level up and climb the ranks. The 🔥 number is how many days in a row you\'ve trained.' },
    { target: 'home-continue', title: 'CONTINUE', body: 'The session you paused, or the last one you started — START runs it again with the same settings. A program moves on to its next day. New here? It shows a workout picked for you instead. SURPRISE ME deals a random quick mission; ADJUST opens the settings first.' },
    { target: 'home-modes', title: 'FIT OR FIGHT', body: 'The two sides of Training Mode. FIT MODE builds strength and cardio; FIGHT MODE builds striking skill. Everything else in the app lives inside one of these.' },
    { target: 'home-arcade', title: 'TRAINING ARCADE', body: 'Real workouts played like a game — sagas with stages and a boss at the end. Clear a stage to unlock the next.' },
    { target: 'home-quick', title: 'QUICK ACCESS', body: 'Three shortcuts for when you know what you want: an instant Quick Mission, the Just Train round timer, and Combat Conditioning.' },
    { target: null, title: '👻 GHOST CHALLENGES', body: 'Every so often a past session comes back as a ghost and dares you to beat it — one of your own Fight Focus sessions or runs, or an anonymous fighter\'s. While one is live, a 👻 floats beside the title of the top card; tap it. NOT NOW never makes it leave — the bonus just shrinks: full for four days, half for three more, then it\'s for pride.' },
    { target: 'nav-tabs', title: 'THE FOUR TABS', body: 'HOME is here. TRAIN is every workout in the app. PROGRESS holds your stats, trophies and badges. PROFILE has your fighter, settings and sign-in.' },
    { target: 'help-icon', title: '❓ LOST? TAP THIS ICON', body: 'This glowing "?" sits in the corner of every screen. Tap it any time and it walks you through whatever you\'re looking at — you can never get stuck.' },
  ],


  profile: [
    { target: null, title: '👤 YOUR PROFILE', body: 'This is your fighter profile — your avatar, stats, account, and every app setting. Here is what each button does.' },
    { target: 'pr-avatar', title: 'YOUR FIGHTER', body: 'Your avatar and rank. It evolves as you level up — Rookie to Champion… and there are secret tiers beyond.' },
    { target: 'pr-stats', title: 'YOUR STATS', body: 'Your body profile and your setup answers — experience, goal and discipline, the same questions you answered on day one. Tap any row to change them: your goal decides the workout Home picks for you, and your discipline is the tab Fight Mode opens on.' },
    { target: 'pr-google', title: '🔐 GOOGLE SIGN-IN', body: 'Continue with Google to attach your progress to your account. Optional — everything trains fine without it; signing in backs up your fighter identity.' },
    { target: 'pr-pro', title: '👑 GO PRO', body: 'Opens the Training Mode Pro page — plans, pricing, and everything Pro unlocks (full Camp levels, all Arcade stages, and more). Browsing never charges you; you always confirm first.' },
    { target: 'pr-gamelink', title: '🎮 GAME LINK — TRAIN HERE, WIN THERE', body: 'Training Mode connects to the upcoming companion FIGHTING GAME. The Game Link page explains it: your real training — rank, XP, unlocked tiers — will sync INTO the game and level up your in-game fighter. Tap to open the page and join the free launch list.' },
    { target: 'pr-settings', title: '⚙ SETTINGS', body: 'The full settings page: weight units (pounds unless you change them), the audio mixer and voice options, how strikes are called out — by name or by number — plus your subscription and the privacy policy. Anything adjustable lives in here.' },
    { target: 'pr-notifs', title: '🔔 NOTIFICATIONS', body: 'Workout reminders and alerts: your if-then training plan (what, which days, what time), quiet hours, streak-safety nudges, and browser push permission.' },
    { target: 'pr-replay', title: '🔁 REPLAY INTRO GUIDE', body: 'Runs the intro walkthrough again — Home, Fight Mode and Practice, Fit Mode and Cardio, Combat Conditioning, the Arcade, rewards and Game Link. Replay it any time.' },
  ],

  // The FULL walkthrough — runs after the questionnaire and from Profile →
  // "Replay intro guide", and nowhere else. It crosses screens: a step naming
  // a `screen` drives the app there first, so each feature is spotlighted on
  // its REAL button. Hosted by App.jsx — a guide rendered inside one screen
  // would unmount the instant it navigates away.
  // Beta AN-03 — the mandatory pass is a 4-step CORE (~30 seconds: Home's
  // top card → the Fit / Fight tabs → the tab bar → the ? icon) followed by an
  // OFFER step. NEXT on the offer continues into the full walk-every-mode
  // tour; ✕ starts training (the close path already marks the tour done).
  // Everything cut from the core is covered by each screen's own ? guide,
  // and the whole tour stays available under Profile → Replay Intro Guide.
  full_intro: [
    { screen: 'home', target: 'home-continue', title: '▶ START HERE', body: 'This card always holds your next workout — one picked for you today, and after that, whatever you trained last, ready to run again with the same settings. If you only ever tap one thing, tap START.' },

    { screen: 'fit_hub', target: null, title: '🥊 FIT OR FIGHT', body: 'Every workout in the app lives under one of these two tabs. FIGHT MODE builds striking skill, FIT MODE builds strength and cardio. They sit side by side at the top of both training hubs, so you are never more than one tap from the other — mix them however you like.' },
    { screen: 'fit_hub', target: 'nav-tabs', title: 'WHERE THINGS LIVE', body: 'TRAIN opens your training tabs. HOME is your daily pick. PROGRESS holds your stats, trophies and badges. PROFILE has your fighter, settings and sign-in.' },
    { screen: 'fit_hub', target: 'help-icon', title: '❓ LOST? TAP THIS ICON', body: 'This glowing "?" sits in the corner of every screen. Tap it any time and it walks you through whatever you\'re looking at — you can never get stuck.' },

    { screen: 'fit_hub', target: null, title: '🎬 WANT THE GRAND TOUR?', body: 'That\'s everything you need to start training. Tap NEXT for the full walkthrough — inside every mode, the camp, the arcade and the rewards, about two minutes. Or tap ✕ to start now; you can replay all of this any time from PROFILE → Replay Intro Guide.' },

    { screen: 'fit_hub', target: 'mode-fight', title: 'FIGHT MODE — LEARN TO STRIKE', body: 'Choose this to build fighting skill: striking, rounds, combos and technique. Let\'s go inside and look at what it holds.' },
    { screen: 'fight_hub', target: 'fh-just-train', title: '⏱ JUST TRAIN', body: 'A plain round timer for bag work, pads or sparring. Pick a preset or set your own rounds, and the bell does the rest — no coach talking unless you turn on Rush Mode. Save the setups you use most.' },
    { screen: 'fight_hub', target: 'fh-fight-focus', title: '🎯 FIGHT FOCUS', body: 'Voice-coached rounds on a fight timer. A coach calls the work, the bell starts and ends each round, and you get rest between them. The closest thing to a real session.' },
    { screen: 'fight_hub', target: 'fh-combo', title: '🥊 COMBO COACH', body: 'The coach calls combinations and you throw them — "one-two, slip, hook". Builds speed, rhythm and reaction. You set how often the calls come.' },
    { screen: 'fight_hub', target: 'fh-camp', title: '⛺ TRAINING CAMP', body: 'A 12-level fight camp that builds you toward a Title Fight, like a real camp: Foundation, Development, Hard Camp, Taper, then the belt. Clear a level to unlock the next.' },
    { screen: 'fight_hub', target: null, title: '👻 GHOST CHALLENGES', body: 'Your best sessions come back to haunt you. Every so often a past Fight Focus session or run returns as a ghost — beat it for bonus XP and the Ghost Hunter trophy. Other fighters\' ghosts turn up too, anonymous — just their level. After a Fight Focus session that counted your strikes, HAUNT A FRIEND sends it as a short code or link: whoever opens it races your exact session.' },
    { screen: 'fight_hub', target: 'fh-practice', title: '📚 PRACTICE MODE', body: 'New to striking? Start here. A seven-lesson path per discipline plus a library of strikes, defense and footwork. Every lesson ends in a Practice Round — the coach calls what you just learned, and the rounds grow as you learn more.' },

    { screen: 'fit_hub', target: 'mode-fit', title: 'FIT MODE — BUILD THE BODY', body: 'Choose this for strength and cardio, no fighting required. Here is what is inside.' },
    { screen: 'fit_hub', target: 'fit-builder', title: '🛠 BUILD WORKOUT', body: 'Tell it which muscles to hit, what equipment you have and how hard — it builds the workout. Then shape it: tap any exercise name for a demo and form cues, swipe to remove, hold to reorder, and double-tap ⛓ to link exercises into a superset or circuit. Once you have trained once, TRAIN AGAIN repeats your last session with the progression already added.' },
    { screen: 'fit_hub', target: 'fit-builder', title: 'AND WHILE YOU TRAIN', body: 'The coach counts your reps out loud and times your rest. You are never locked into the order — a WORKOUT MAP sits above the tab bar, and holding any exercise starts that one instead. Every set you log builds a history, so the app knows what to ask of you next time.' },
    { screen: 'fit_hub', target: 'fit-quick', title: '🎯 QUICK MISSION', body: 'Short on time? Pick a length and it generates a circuit on the spot. No setup, no decisions — just start moving.' },
    { screen: 'fit_hub', target: 'fit-programs', title: '📋 PROGRAMS', body: 'Rather follow a plan? Programs runs a split for you — Push/Pull/Legs, Upper/Lower and more — and remembers which day is next, so every session is one tap.' },
    { screen: 'fit_hub', target: 'fit-cardio', title: '❤ CARDIO MODE', body: 'Cardio on its own: runs on GPS or a treadmill, machine work, and fight rounds or Tabata, with pace coaching and a target you set by distance or time.' },
    { screen: 'fit_hub', target: 'fit-cardio', title: '🗺️ AND IT TRACKS YOUR RUN', body: 'Start an outdoor run and Training Mode maps it. The route draws itself as you move, coloured green where you are on pace and orange where you drop off it, with a split called at every half mile or kilometre. Afterwards it all goes to PROGRESS → RUNS — career totals, a weekly distance goal, your best time at each distance, and the map of every run you have done.' },

    { screen: 'fight_hub', target: 'fh-conditioning', title: '🔥 COMBAT CONDITIONING — THE BLEND', body: 'Fight and fitness in one: ring-pace circuits that build your gas tank. Strike work and hard conditioning in the same round. Pick this when you want to be exhausted and sharp at the same time.' },

    { screen: 'home', target: 'home-arcade', title: '🕹 TRAINING ARCADE — THE GAME', body: 'The same real workouts, played like a retro game. Let\'s step inside and see how it works.' },
    { screen: 'arcade', target: 'ar-carousel', title: 'THE CAMPAIGN SHELF', body: 'Every card is a saga — a themed campaign of 10 stages with a boss at the end. Swipe to browse them; locked ones say COMING SOON. Tap a card to open its stage ladder.' },
    { screen: 'arcade_series', target: 'arc-ladder', title: 'THE STAGE LADDER', body: 'Inside a saga you climb bottom to top. Each node is one real workout — clear it to unlock the next, and finish fast for ★ ratings. Stage 10 is the boss: answer the bell, survive the finale, and it pays DOUBLE XP.' },

    { screen: 'home', target: null, title: '⚡ XP, LEVELS & REWARDS', body: 'Every finished session earns XP, and XP raises your fighter level and rank. Beat arcade stages fast enough for ★ ratings, train days in a row to grow your 🔥 streak, and unlock trophies and badges as you go. Bosses pay double XP.' },
    { screen: 'profile', target: 'pr-gamelink', title: '🎮 LINKED TO THE UPCOMING GAME', body: 'Training Mode connects to a companion FIGHTING GAME in development. Your real training — rank, XP, unlocked tiers — will sync INTO the game and level up your in-game fighter. Tap GAME LINK any time to read more and join the free launch list.' },
    // The grand tour lands back on Home — the two cards the core pass skipped,
    // ending where the athlete actually starts training. (The tabs and ? steps
    // live in the mandatory core now, so they don't repeat here.)
    { screen: 'home', target: 'home-arcade', title: '🕹 TRAINING ARCADE', body: 'Your way into the arcade from Home — a 10-stage saga with a boss at the end. Tap it any time to pick a saga or carry on with the one you\'re climbing.' },
    { screen: 'home', target: 'home-quick', title: '⚡ QUICK ACCESS', body: 'Three one-tap shortcuts — Quick Mission, Just Train and Combat Conditioning — for when you know exactly what you want. That\'s the tour — go train.' },
  ],

  // The everyday "?" on each screen — compact and single-screen. The full
  // cross-screen walkthrough above only runs after the questionnaire or from
  // Profile → Replay intro guide.

  fight_hub: [
    { target: null, title: '🥊 FIGHT MODE', body: 'This is the Fight Mode hub — the striking-skill side of Training Mode. Pick a discipline, then one of the four ways to train it. They go from least to most structured.' },
    { target: 'fh-disciplines', title: 'DISCIPLINE', body: 'Boxing, Kickboxing, Muay Thai or MMA. Your pick carries everywhere — the timers, Practice Mode and Combat Conditioning all use it.' },
    { target: 'fh-just-train', title: 'JUST TRAIN', body: 'A plain round timer for bag work, pads or sparring. Pick a preset or set your own and go — just the bell and the clock. Choose Just Train.' },
    { target: 'fh-fight-focus', title: 'FIGHT FOCUS', body: 'Voice-coached rounds like a real session — a round timer with a coach calling the work. Choose Fight Focus.' },
    { target: 'fh-combo', title: 'COMBO COACH', body: 'The coach calls strike combinations and you throw them — builds speed, rhythm and reaction. Choose Combo Coach.' },
    { target: 'fh-camp', title: 'TRAINING CAMP', body: 'A 12-level fight camp that builds you toward a Title Fight — Foundation, Development, Hard Camp, Taper, then the belt. Clear a stage to unlock the next. Choose Training Camp.' },
    { target: 'fh-practice', title: 'PRACTICE MODE', body: 'New to striking? Learn strikes, defense and footwork step by step, then drill each one in a Practice Round. Choose Practice Mode.' },
    { target: 'fh-conditioning', title: 'COMBAT CONDITIONING', body: 'A fight-pace circuit that trains your gas tank — explosive, athletic conditioning that blends fitness with fight work.' },
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
    { target: 'tc-archetype', campModal: true, title: '🥊 FIGHTING STYLE', body: 'How you like to fight — a Pressure Fighter, a Counter Fighter, or Well-Rounded (each discipline has its own three). Your pick shapes what the coach drills every session: the combos called, the footwork, the round goals. The line under the buttons says what that style means at the difficulty you chose. Switch any time and the camp adapts.' },
    { target: 'tc-readiness', campSheet: true, title: 'READINESS & SAFETY', body: 'This gut-check appears before every session — rate sleep, energy, soreness, stress and mood, 5 being best. Feeling rough? It offers an EASIER session that still counts and keeps your streak. Flag a danger symptom (dizziness, chest, sharp pain, concussion signs) and the camp tells you to REST — no penalty, no streak lost, ever.' },
    { target: 'tc-belt', title: 'EARN THE BELT', body: 'Every session you finish earns XP toward your fighter level. Clear all 12 levels — Foundation through this TITLE FIGHT at the top — and the belt is yours.' },
  ],

  programs: [
    { target: null, title: '📋 PROGRAMS', body: 'A program is a plan you follow across sessions, so you are not rebuilding your workout every day.' },
    { target: 'pg-equipment', title: 'TRAIN WITH', body: 'Pick what you have: bodyweight, weights, or a mix. The program keeps its sets and reps; this decides which exercises fill them.' },
    { target: 'pg-continue', title: 'YOUR NEXT DAY', body: 'The program you are on and which day of it is next. RESUME builds that day — you can review and edit it before you start.' },
    { target: 'pg-library', title: 'PROGRAM LIBRARY', body: 'Every program, with the day each one would give you next. Tap one to switch to it.' },
    { target: 'pg-more', title: 'MORE PROGRAMS', body: 'Full training plans with their own exercises — a 7-day shadowboxing starter, a bodyweight week, bodyweight circuits at three levels, shadowbox routines for every discipline, and the signature plans. Fit and Fight tabs; each one remembers which day is next. PRO plans are part of Training Mode Pro.' },
  ],

  fit_hub: [
    { target: null, title: '💪 FIT MODE', body: 'This is the Fit Mode hub — strength, conditioning and cardio, no fighting required. The card at the top is today\'s workout; everything below it is for when you want to choose your own.' },
    { target: 'fit-today', title: "TODAY'S MISSION", body: 'A workout picked for you from your goal and your last session. The line under the title is exactly what START runs. Not feeling it? SURPRISE ME deals a random one in its place, and ADJUST lets you set the length and intensity yourself.' },
    { target: 'fit-quick', title: 'QUICK MISSION', body: 'Circuit-style workouts for when you are short on time — pick a length and an intensity and it builds the circuit on the spot.' },
    { target: 'fit-builder', title: 'BUILD WORKOUT', body: 'Want a workout built off the muscle groups you select? Pick your muscles, gear and difficulty. It remembers what you lifted and pushes you a little further each time, and TRAIN AGAIN repeats your last session in one tap.' },
    { target: 'fit-programs', title: 'PROGRAMS', body: 'Follow a plan instead of deciding each day. Pick a split — Full Body, Push/Pull/Legs, Upper/Lower or Bro Split — and it remembers which day is next.' },
    { target: 'fit-cardio', title: 'CARDIO', body: 'Runs on GPS or a treadmill, machine work and intervals, with pace coaching and a target you set by distance or time.' },
  ],

  // Crosses into the stage ladder for the last three steps (hosted by
  // App.jsx like full_intro); closing it lands back on the saga page.
  arcade_saga_select: [
    { screen: 'arcade', target: null, title: '🕹 TRAINING ARCADE', body: 'This is the Training Arcade — workouts as a retro game. Each saga is a training storyline with stages to climb and a boss to beat.' },
    { screen: 'arcade', target: 'ar-carousel', title: 'CHOOSE YOUR SAGA', body: 'Swipe left and right to browse sagas. Tap a card to open its stage ladder and start climbing.' },
    { screen: 'arcade', target: 'ar-player', title: 'YOUR PLAYER BAR', body: 'Your arcade progress lives here — XP, badges, and your active challenge carry across sagas.' },
    { screen: 'arcade', target: 'ar-code', title: '⚔️ CHALLENGE CODES', body: 'Someone cleared a stage and sent you a code? Paste it here and you drop straight into that exact stage, set up the same way, racing their run. Clear a stage yourself and you can copy your own code to send back.' },
    { screen: 'arcade', target: null, title: 'HOW A STAGE WORKS', body: 'Every stage is a real workout with an HP bar — each rep you finish chips it down. Clear the stage to unlock the next one on the ladder. Let\'s look at a real ladder.' },
    { screen: 'arcade_series', target: 'arc-stage', title: '▶ ENTER A STAGE', body: 'Tap a stage node like this one to open its mission card — you\'ll see the workout, your best time and ★ goals. ENTER STAGE starts it, and then the timer takes over.' },
    { screen: 'arcade_series', target: 'arc-stars', title: '★ STAR RANKS', body: 'Beat a stage fast enough to earn stars — ★, ★★, or ★★★. Your best time is saved on the stage, this counter tracks your clears, and an elite MYTHIC tier waits above three stars for the fastest fighters.' },
    { screen: 'arcade_series', target: 'arc-boss', title: '👑 THE BOSS', body: 'The final stage of every saga is the boss — those eyes at the top of the ladder. It\'s the hardest session of the storyline: answer the bell, survive it, and the saga\'s trophy and DOUBLE XP are yours.' },
    { screen: 'arcade_series', target: 'arc-boss', title: '🔔 ANSWERING THE BELL', body: 'Before a boss session there is no menu and no back button — just the bell, your win-loss record against it, and one tap. Put the phone down where you can see it and go. The boss has an HP bar that chips away as you clear rounds, and it does not fall until the last one.' },
  ],

  fight_focus_setup: [
    { target: null, title: '🎯 FIGHT FOCUS', body: 'This screen builds your round session. Set the difficulty and rounds, then hit start — the coach handles the rest.' },
    { target: 'ff-difficulty', title: 'DIFFICULTY', body: 'How hard the coaching pushes — round focuses get more demanding as you go up.' },
    { target: 'ff-steppers', title: 'BUILD YOUR ROUNDS', body: 'Set how many rounds, how long each one runs, and your rest between them. TOTAL shows your full session time.' },
    { target: 'ff-rush', title: '⚡ RUSH MODE', body: 'Optional. Turn it on and the coach interrupts your rounds with surges — sudden calls to go explosive, throw strikes, or both. You choose how often they hit. It is the difference between pacing a round and being made to empty the tank. Opened from a ghost challenge? This row shows the challenge instead, with surprise rushes locked on.' },
    { target: 'ff-ghost', title: '👻 GHOST BATTLES', body: 'Race a recorded session instead of the clock. MY BEST races your own best verified run; CODE loads one a friend sent you. Most verified strikes wins, and a result screen compares you at the end. The button below copies YOUR best as a code you can send to anyone.' },
    { target: 'ff-start', title: 'START SESSION', body: 'Ready? Tap here — the coach announces each round and the timer runs the fight.' },
  ],

  combo_coach_setup: [
    { target: null, title: '⚡ COMBO COACH', body: 'This screen sets up combo training — the coach calls combinations, you throw them.' },
    { target: 'cc-difficulty', title: 'DIFFICULTY', body: 'Higher difficulty means longer, trickier combinations to react to.' },
    { target: 'cc-callstyle', title: 'CALL STYLE — NAMES or NUMBERS', body: 'NAMES calls every strike by its name: "jab, cross, hook". NUMBERS calls punches the way a boxing gym does — 1-2-3 — which is faster to hear and react to once you know the count. Your pick follows you into Camp and Arcade too.' },
    { target: 'cc-callstyle', title: 'WHY NUMBERS SOMETIMES SAYS WORDS', body: 'Punches 1 to 8 are standard in every gym. Kicks, knees and elbows are not — no two gyms number them the same way. So on NUMBERS a punch-only combo is called 1-2-3, and any combo with a kick, knee, slip or roll is called by name instead. You will never get half numbers and half words in one call.' },
    { target: 'cc-mode', title: 'MODE', body: 'TECHNICAL calls one strike at a time so you can drill clean technique. COMBO calls full combinations to chain together for flow and speed. Not sure? Leave it on COMBO.' },
    { target: 'cc-steppers', title: 'ROUNDS & CADENCE', body: 'Rounds, round length, rest — and CADENCE, the seconds between combo calls. Lower cadence = faster calls.' },
    { target: 'cc-rush', title: '⚡ RUSH MODE', body: 'Optional. Surges cut into your rounds — sudden calls to go explosive, throw strikes, or both, at whatever frequency you set. Turn it on when a steady cadence has stopped costing you anything.' },
    { target: 'cc-start', title: 'START COMBOS', body: 'Tap here and the first call comes in. React, throw, reset your stance.' },
  ],

  workout_builder: [
    { target: null, title: '🔧 BUILD WORKOUT', body: 'This screen builds a strength workout around exactly what you want to train. Leave everything on its default for a solid balanced session. Rather follow a plan? PROGRAMS on the Fit Mode hub runs one day by day.' },
    { target: 'wb-trainagain', title: '⚡ TRAIN AGAIN', body: 'The fastest way to train. It repeats your last workout with the progression already applied — an extra rep, or a little more weight, on every exercise you finished cleanly last time. One tap and you skip this whole screen. It only appears once you have a workout behind you.' },
    { target: 'wb-duration', title: 'DURATION', body: 'How long you have. The number of exercises comes from this — fifteen minutes is four lifts, an hour is eight — so the list always fits the time.' },
    { target: 'wb-difficulty', title: 'DIFFICULTY', body: 'Easy, Normal, or Hard — scales the reps, sets, and rest.' },
    { target: 'wb-muscles', title: 'TARGET', body: 'Tap to pick the muscle groups you want to hit — they light up on the body map. Fewer groups = more focused volume. Pick at least one, or GENERATE has nothing to build from.' },
    { target: 'wb-equipment', title: 'EQUIPMENT', body: 'Bodyweight, Weighted (dumbbells, a bar, kettlebells, bands), or Hybrid — set what you actually have so every exercise is doable. Nothing here needs a cable stack.' },
    { target: 'wb-programming', title: 'SET SCHEME', body: 'Optional. AUTO lets the generator pick sets and reps; 5×5, 3×10 and the rest apply one scheme to every weighted lift, and CUSTOM is your own numbers. You can still change any single exercise in the player.' },
    { target: 'wb-cardio', title: 'ADD CARDIO', body: 'Optional finisher — tack a run, intervals, or Tabata onto the end of your workout.' },
    { target: 'wb-generate', title: 'GENERATE WORKOUT', body: 'Tap here and your workout is built. Nothing is locked in — the next screen lets you swap, reorder, remove and link exercises before you start. It sits in the build card, which reads back what you picked. SURPRISE ME under the settings rolls the muscles and gear for you.' },
    { target: 'wb-routines', title: 'SAVED ROUTINES', body: 'ROUTINES holds every list you saved with SAVE ROUTINE, up to ten. Tap one to load it exactly as you left it.' },
  ],

  // The generated list. Everything the athlete can do to a workout BEFORE
  // starting it lives here, which is why it gets its own guide rather than a
  // paragraph tacked onto the setup screen.
  fit_workout: [
    { target: null, title: '📋 YOUR WORKOUT', body: 'This is the workout the builder made you — and none of it is fixed. Shape it however you like, then hit START. Nothing counts until you start.' },
    { target: 'fw-legend', title: '↕ ↔ ⇄ ⛓ THE FOUR GESTURES', body: 'This strip is your cheat sheet, and it stays on screen the whole time. Press and HOLD a row to drag it up or down. SWIPE a row sideways to remove it. TAP ⇄ to swap that exercise for a different one. DOUBLE-TAP ⛓ to link exercises together.' },
    { target: 'fw-row', title: 'TAP THE NAME — WHAT IS THIS?', body: 'Never seen the exercise before? Tap its NAME. You get a demo, numbered how-to cues, the two mistakes people actually make, and EASIER / HARDER versions you can swap straight to. Use it any time you are not sure — that is what it is for.' },
    { target: 'fw-row', title: 'LAST TIME · YOUR HISTORY', body: 'Under an exercise you have done before, a line shows what you managed last time and what to try today — TRY 9 REPS in gold, or = HOLD if it says repeat it. Tap that line to open the full history: your best ever, every past session, and a chart of the trend. 🏆 marks a personal record.' },
    { target: 'fw-row', title: 'REMOVE & PUT BACK', body: 'Swipe a row away and it leaves a gap where it used to be, with a small gold UNDO on the right. That offer waits — it does not time out — so you can change your mind. It only disappears once you move one of the rows beside it.' },
    { target: 'fw-legend', title: '⛓ SUPERSETS & CIRCUITS', body: 'Double-tap the ⛓ on an exercise and it starts glowing — now tap any other exercise to link them. Two moves is a SUPERSET, three or more is a CIRCUIT with a rounds setting you can step up or down. Linked moves run back-to-back with NO rest between them; the rest comes once at the end of each round. Tap ✕ on the bracket to unlink and get plain rows back.' },
    { target: 'fw-row', title: 'SETS · REPS · REST', body: 'The number on the right of a row is its dose — 4 × 8, or 3 × 40s for a hold. Tap it to change sets, reps or rest for that exercise, or leave it: you can also change any of them from inside the player before a set starts.' },
    { target: 'fw-actions', title: 'REGENERATE · SAVE ROUTINE', body: 'REGENERATE rolls a whole new workout from the same settings. SAVE ROUTINE keeps this exact list — exercises, sets, reps, chains and all — so you can run it again in one tap. Saved routines live under SAVED ROUTINES on the Build Workout screen, up to 10 of them.' },
    { target: 'fw-start', title: '▶ START', body: 'Starts the session. First comes a 90-second warm-up — follow the coach or freestyle it — and then the guided workout takes over, calling every rep.' },
  ],

  // The guided player. Two things here are genuinely new to a first-timer:
  // the WORKOUT MAP (you are not locked into the order) and the chain pill.
  fit_guided: [
    { target: null, title: '🏋 GUIDED WORKOUT', body: 'The coach runs the session from here — announcing each exercise, counting your reps out loud, and timing your rest. You do not have to touch anything unless you want to.' },
    { target: 'fg-header', title: 'WHERE YOU ARE', body: 'Exercise 3 of 6, set 2 of 4 — how far through the workout you are, and how far through this exercise. The bar underneath fills as you go.' },
    { target: 'fg-name', title: 'TAP THE NAME MID-SET', body: 'Forgot the form halfway through? Tap the exercise name and the how-to sheet opens right there — cues, mistakes, demo. Your set is waiting where you left it when you close it.' },
    { target: 'fg-display', title: 'THE COUNT', body: 'On rep exercises the coach counts every rep aloud and the number climbs with you. On holds and timed work it counts the seconds down instead. Finish early? Hit SET DONE and it moves on.' },
    { target: 'fg-adjust', title: 'ADJUST · SETS, REPS, REST', body: 'The gold pill under the name is this exercise\'s dose. Tap it between sets to change the sets, reps or rest — the defaults are a starting point, not a rule. It disappears while a set is running.' },
    { target: 'fg-controls', title: 'LEAVE THE APP, KEEP THE CLOCK', body: 'Step out to your music or a message and the set follows you as a small floating window — the count, the exercise, what is next. It pops up by itself when you leave, on phones that support it, and stays hidden until then, warm-up included. Nothing pauses while the window is up.' },
    { target: 'fg-controls', title: 'THE CONTROLS', body: '⟲ REWIND replays the previous set. ⏸ pauses everything (leaving the app pauses it too). SKIP SET jumps to the next set — during rest it becomes SKIP REST. SKIP EXERCISE moves on without completing it. STOP ends the session and asks first; whatever you finished still counts.' },
    { target: 'fg-map', title: '≡ THE WORKOUT MAP', body: 'Swipe this tab up — or tap it — for the map, and the workout pauses while it is open. You are NOT locked into the order: press and HOLD any exercise to start that one instead, HOLD + SWIPE to skip it, HOLD + DRAG to move it. Finished exercises lock so you cannot lose them. Closing the map counts you back in 3-2-1.' },
    { target: 'fg-map', title: 'WHEN AN EXERCISE FINISHES', body: 'The map slides up on its own, your finished exercise locks with a ✓, and the next one glows. Swipe the map down to start it, or hold a different one if you would rather do that instead.' },
    { target: 'fg-header', title: '⛓ INSIDE A CHAIN', body: 'If you linked exercises, a ⛓ pill shows which move of the chain you are on. There is no rest between them — the coach says GO STRAIGHT IN and hands you the next one. The rest comes at the end of the round, and the counter tells you which round you are on.' },
  ],

  quick_mission_setup: [
    { target: null, title: '⏱️ QUICK MISSION', body: 'No planning needed — pick a time and intensity and the app builds the whole session for you.' },
    { target: 'qm-length', title: "TODAY'S MISSION", body: 'The mission you would run right now: its name, every move and how many reps or seconds each gets. The line under the list is how long it really takes with the count and the rest included.' },
    { target: 'qm-intensity', title: 'SURPRISE ME · ADJUST', body: 'SURPRISE ME deals a different mission. ADJUST opens the three choices — focus (upper, lower, core, combat or full body), length and intensity — and the card rebuilds as you pick.' },
    { target: 'qm-classics', title: 'CLASSICS', body: 'The workouts people know by name — Murph, Half Murph, the Sally Up challenge, Deadly Seven and 5 Minutes of Hell. Tap one to put it on the card, then START. The coach calls every move; on a run, tap DONE when you are back.' },
    { target: 'qm-cardio', title: 'ADD CARDIO', body: 'Optional cardio finisher bolted onto the end of the mission. Flip the switch to set it up; EDIT changes it.' },
    { target: 'qm-start', title: 'START', body: 'Runs exactly the mission on the card — timer, coach, and all.' },
  ],

  combat_conditioning_setup: [
    { target: null, title: '🔥 COMBAT CONDITIONING', body: 'This screen builds a fight-pace circuit — explosive, athletic conditioning that trains your gas tank.' },
    { target: 'ccs-discipline', title: 'DISCIPLINE', body: 'Your fight base — drills lean toward the striking style you pick. It is the same choice as on the Fight Mode hub.' },
    { target: 'ccs-style', title: 'PICK A CIRCUIT', body: 'Each circuit is a complete workout with its own rounds, work, rest and gear. Pick one and you can start straight away.' },
    { target: 'ccs-customize', title: 'CUSTOMIZE (OPTIONAL)', body: 'Only if you want to change it: intensity, equipment, rounds, work and rest. The gold number is the time the circuit will take. This appears once you have picked a circuit.' },
    { target: 'ccs-start', title: 'START CIRCUIT', body: 'Tap here and fight through each round — recover on the rest, reset, go again.' },
  ],

  just_train_setup: [
    { target: null, title: '⏱ JUST TRAIN', body: 'A plain round timer for bag work, pads or sparring — no coaching, just the bell and the clock.' },
    { target: 'jt-presets', title: 'SAVED PRESETS', body: 'Four common setups to start from. Change the numbers and + SAVE CURRENT keeps your own; your three most recent are kept.' },
    { target: 'jt-steppers', title: 'YOUR ROUNDS', body: 'Rounds, round length and rest. Tap a number to type it — round length is in minutes, so 3 means 3:00. TOTAL is the whole session.' },
    { target: 'jt-rush', title: '⚡ RUSH MODE', body: 'Optional. Turns on surges — sudden calls to go all-out. Rushes are spoken, so the coach only talks when this is on.' },
    { target: 'jt-start', title: 'START TIMER', body: 'The bell starts round one. Pause, skip or end any time from the timer.' },
  ],

  practice: [
    { target: null, title: '📚 PRACTICE MODE', body: 'Learn a move, then drill it. Everything here is one lesson or one technique at a time.' },
    { target: 'pm-discipline', title: 'DISCIPLINE', body: 'Each discipline has its own path and library. Your pick is shared with Fight Mode and Combat Conditioning.' },
    { target: 'pm-continue', title: 'CONTINUE LEARNING', body: 'Opens the next lesson on your path. Each lesson has step-by-step key points — press play and the coach reads them to you.' },
    { target: 'pm-path', title: 'FUNDAMENTALS PATH', body: 'Seven lessons, in order. Gold ✓ is done, the glowing ring is next. Tap any dot to open that lesson.' },
    { target: 'pm-library', title: 'TECHNIQUE LIBRARY', body: 'Every strike, defense and footwork move for this discipline. Tap one for its key points and what to watch for. SEE ALL shows the full list.' },
    { target: 'pm-combo', title: '🥊 DRILL A COMBO', body: 'Opens Combo Coach, where the coach calls full combinations for you to throw.' },
    { target: null, title: 'PRACTICE ROUNDS', body: 'Every lesson and technique ends with START PRACTICE ROUND: a short round where the coach calls what you just learned mixed with what you already know. It starts at 1 × 1:00 and grows to 3 × 3:00 as you learn more.' },
  ],

  cardio_mode: [
    { target: null, title: '🏃 CARDIO MODE', body: 'This screen sets up a pure cardio session — pick how you move, the protocol, and your goal. We set your pace.' },
    { target: 'cm-method', title: 'ACTIVITY', body: 'How you move: RUN or WALK outdoors on GPS (or on a treadmill — pick that under CUSTOMIZE), MACHINE for a bike, rower, elliptical or stairs, or INTERVALS — fight rounds, Tabata or your own, with the coach calling every switch.' },
    { target: 'cm-start', title: 'THE PREVIEW', body: 'The panel shows what you are about to do: the route map for a GPS run, or the timer for everything else, with the target pace or the total time on it. The stats underneath fill in once you start.' },
    { target: 'cm-options', title: 'CUSTOMIZE', body: 'Everything else lives here, folded away: where you are running, the protocol, the goal distance or time, your target pace, and a ghost to race. The one-line summary on the row says what is set.' },
    { target: 'cm-protocol', title: 'PROTOCOL', body: 'STEADY holds one pace the whole way. INTERVALS and TABATA alternate hard work with recovery.' },
    { target: 'cm-goal', title: 'YOUR GOAL', body: 'Set a distance or a time target. The app works out the pace to hold for your level, and the coach keeps you on it.' },
    { target: 'cm-ghost', title: '👻 GHOST RUN', body: 'Race a past run at this distance — your LAST or your BEST. Your ghost runs beside you and the coach tells you whether you are ahead or behind. Every measured finish becomes the ghost for next time.' },
    { target: 'cm-start', title: 'START', body: 'Tap here and the timer, pace coaching, and logging handle the rest. The three presets at the foot of the screen skip the setup entirely: treadmill intervals, a 3-mile outdoor run, or a Tabata cardio blast.' },
    { target: null, title: '🗺️ YOUR ROUTE IS RECORDED', body: 'On a GPS run the map draws itself as you move — the real shape of where you went, coloured by how fast you were running each stretch. Green is at or under your target pace, orange is behind it. The route, your splits and an estimated calorie burn are saved when you log the run.' },
    { target: null, title: 'WHERE YOUR RUNS LIVE', body: 'Every logged run goes to PROGRESS → RUNS: your career totals, a weekly distance goal you can set, your personal best at each distance, and the map of every run you can tap open. Routes stay on this device.' },
  ],

  combat_conditioning_active: [
    { target: null, title: '🔥 COMBAT CONDITIONING', body: 'This is your live circuit — fight-pace rounds with a coach calling every drill. Here is what everything on this screen does.' },
    { target: 'cca-title', title: 'SESSION TITLE', body: 'Shows COMBAT CONDITIONING plus your mission name below it, so you always know which circuit you are running.' },
    { target: 'cca-status', title: 'STYLE, DISCIPLINE & ROUND', body: 'Your circuit style and difficulty pills, plus ROUND X / Y — how far you are through the full session.' },
    { target: 'cca-volume', title: '🔊 SOUND', body: 'Tap to open the volume mixer — separate VOICE and MUSIC sliders, adjustable mid-round without pausing.' },
    { target: 'cca-volume', title: 'LEAVE THE APP, KEEP THE CLOCK', body: 'Switch apps mid-circuit and the round follows you as a small floating window — the clock, the drill, what is next. It pops up by itself when you leave, on phones that support it, and stays hidden until then. The timer keeps running while the window is up.' },
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
    { target: 'qma-volume', title: 'LEAVE THE APP, KEEP THE CLOCK', body: 'Switch to your music or answer a text and the round follows you as a small floating window — the clock, the exercise, what is next. It pops up by itself when you leave, on phones that support it, and stays hidden until then. The timer keeps running while the window is up.' },
    { target: 'qma-ring', title: 'THE TIMER', body: 'Counts down your work or rest time, or tracks reps on cadence-counted exercises. Gold on WORK, blue on REST.' },
    { target: 'qma-exercisecard', title: 'EXERCISE CARD', body: 'Shows your current exercise (or the next one, during rest), and flags a FINISHER move when one comes up.' },
    { target: 'qma-rewind', title: '⟲ REWIND', body: 'Step back to redo the exercise before this one — useful if you got cut off or want another attempt.' },
    { target: 'qma-pause', title: '⏸ PLAY / PAUSE', body: 'Pause anytime — the timer and coach hold until you resume. Stepping away from the app auto-pauses too.' },
    { target: 'qma-skip', title: '⏭ SKIP', body: 'Jump straight to the next exercise or round if you need to move on early.' },
    { target: 'qma-stop', title: '■ STOP', body: 'Ends the mission — asks you to confirm first. Only the exercises you completed before stopping count toward your stats.' },
    { target: 'qma-back', title: '‹ BACK BUTTON', body: 'The top-left arrow does the same thing as STOP — it asks you to confirm before ending, so a stray tap never wipes your progress.' },
  ],
};
