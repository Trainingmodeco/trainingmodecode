# 03 · FIT MODE (list · Workout Builder · Quick Mission · Combat Conditioning)

--- PROMPT 1: Fit Mode list ---

Build the FIT MODE landing: header banner, then feature cards each with art + one-line description of what it's for: WORKOUT BUILDER ("Build a custom session — pick focus, muscles & gear"), QUICK MISSION ("No-setup preset workout, start in one tap"), CARDIO MODE ("Run, treadmill & HIIT with GPS + voice coach"), COMBAT CONDITIONING ("Hybrid strength × striking circuits"). Workout Codex appears last with a BETA chip, 60% opacity ("Import & program external workouts — in testing").

--- PROMPT 2: Workout Builder setup ---

Build Workout Builder setup:
- FOCUS pills: STRENGTH / HYPERTROPHY / ENDURANCE / HYBRID / CARDIO ONLY (gold selected). IMPORTANT: focus MUST be preserved into the generator config — generateFitModeWorkout(cfg) safeCfg includes focus: cfg?.focus || "Strength", and the config signature includes focus so regenerate history is per-focus. Strength/Endurance/Hybrid must produce noticeably different exercise selection, rep/set schemes and rest.
- Body-map muscle targeting: front/back toggle of the gender-matched body map images (/assets/bodymap/...), tappable regions highlight violet.
- Difficulty (uses profile experience as default), equipment chips, duration slider.
- ADD CARDIO banner (replaces old HIIT finisher): orange strip "🏃 ADD CARDIO FINISHER — tap to configure" → navigates to Cardio setup; if selected, the cardio session auto-prompts immediately after the strength workout finishes and grants bonus XP.
- GENERATE WORKOUT (gold CTA) → generated list screen: exercise rows (name, sets × reps, rest) in the Option-2 list style (compact rows, no per-exercise images — small colored initial/icon square instead), a prominent ⟳ REGENERATE button (violet, clearly visible), swap icon per row → exercise-swap picker (bottom sheet listing alternates for that muscle + equipment), and START.
- Generator quality bar: fewer repeated exercises across regenerations, better exercise-to-muscle matching, difficulty scales load/volume, strong fallback logic when the pool is small.

--- PROMPT 3: Workout Builder active (guided) ---

Guided active screen: current exercise large (name, set x/y, target reps), rep/set tap-to-confirm checkpoints (feeds anti-cheat), rest countdown between sets with skip, next-exercise preview strip, progress bar, finish → Mission Complete flow. Form-demo slot per exercise (image/video placeholder + swap picker access).

--- PROMPT 4: Quick Mission + Combat Conditioning ---

QUICK MISSION: one-tap preset flow — pick length (10/20/30 min) + intensity → straight into a guided circuit using the Quick Mission ring timer art (/assets/rings/ring-conditioning.png style HUD, 380–400px, number centered, count line around the ring). Dimmed mission-themed art behind.
COMBAT CONDITIONING: setup (rounds, work/rest, strength-vs-striking blend slider) → active circuit screen with its own red-accent ring timer (/assets/rings/ring-conditioning.png at ~394px), exercise call-outs alternating lifts and strikes, round counter, rest states. Cross-listed from Fight Mode and Train hub. Completing with cardio add-on grants bonus XP.

--- END ---
