# 01 · ENTRY & ONBOARDING

--- PROMPT 1: Hero Enter splash ---

Build the app's entry splash screen (route: /, shown before anything else):
- Full-screen background image /assets/hero-enter.webp (object-position: center 20%) under a vertical dark gradient (heavier at top ~45% and bottom ~95%).
- Rising fire-spark particles from the bottom edge: ~8 small glowing orange/gold dots (3–5px) that float upward on CSS keyframes at varied heights — some fade out mid-screen, some travel near the top — staggered delays, slight horizontal drift.
- Thin violet corner brackets (22×22, 2px, #b06aff) in all four corners.
- Centered stack (vertical): "TACTICAL COMBAT FITNESS SYSTEM" (Orbitron 700 12px, gold #f5b301, glowing) → the T logo mark /assets/logo-mark.png (70px) → "TRAINING MODE" (Orbitron 900 46px white, violet glow, two lines) → "BOXING · KICKBOXING / MUAY THAI · MMA" (Orbitron 700 10px violet, 2 lines) → "TRAIN LIKE A FIGHTER" (Orbitron 900 18px white) → "TAP ANYWHERE TO ENTER" (Orbitron 700 11px, #c9a6ff, slow 2.6s glow-in/out animation — subtle, not a button) → thin violet gradient divider → "TRAIN · FIGHT · WIN" (letter-spaced).
- Whole screen is one tap target → onboarding (first run) or Home (returning user).

--- PROMPT 2: Onboarding (4 steps) ---

Build a 4-step onboarding flow shown once after the splash:
1. Welcome — logo, one-line pitch, "GET STARTED".
2. About you — gender selector (MALE/FEMALE segmented pills, gold = selected; this drives avatar art app-wide), age, height, weight inputs.
3. Experience & discipline — experience pills (ROOKIE / MID / ADVANCED, calibrates workout difficulty) and primary discipline dropdown (Boxing, Kickboxing, Muay Thai, MMA).
4. Goal — pick a training goal (Get fighting fit / Learn to strike / Build muscle / All of it).
Progress dots at bottom, gold active pill-shaped dot. Store answers in the user state. Finish → "How It Works" guide.

--- PROMPT 3: "How It Works" guide modal ---

Build a one-time, skippable 4-card guide shown as a bottom-sheet modal (rounded 28px top corners, dark violet gradient sheet over dimmed app) after onboarding:
- Card 1 WELCOME: logo mark, "WELCOME TO / TRAINING MODE", 2-line pitch (real workouts, fighter's-game progression, 4 disciplines).
- Card 2 WAYS TO TRAIN ("Two core modes, two ways to bridge them"): 4 tiles — 💪 FIT MODE (violet) workout builder/quick missions/cardio/conditioning; 🥊 FIGHT MODE (red) combo coach/fight focus/practice; ⚡ COMBAT CONDITIONING (orange) "the bridge — strength + striking circuits"; 🕹 TRAINING ARCADE (green) timed stages & bosses for big XP.
- Card 3 EVERY REP LEVELS YOU UP: avatar tier ladder (5 tier images small→big→small, center Veteran highlighted gold), copy about XP, streaks, Rookie→Champion, trophies.
- Card 4 TRAIN HERE, WIN THERE: avatar → 🎮 flow visual, "COMING SOON" chip, copy about the future companion game sync. CTA "▶ START TRAINING" (gold).
- SKIP top-right on cards 1–3; progress dots; swipe or NEXT button advances. Set a localStorage flag so it shows once; add a "Replay intro guide" row in Settings later.

--- END ---
