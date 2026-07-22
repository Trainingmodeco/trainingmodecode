# 10 · TRAINING CAMP PROTOCOL v2 (the sport engine)

Upgrades the simple 12-session camp from 05b Prompt 1 into a full periodized
engine: 4 disciplines × 3 archetypes × 3 difficulties = 36 camp variants.
KEEP the existing camp map UI (tree-ladder, node states, splash bg) — this
file replaces what's INSIDE the sessions and how progression works. Paste
one prompt block at a time, in order.

--- PROMPT 1: Content data model (build this first) ---

Restructure training content as a data-driven model, stored as editable JSON
content files (not hardcoded in screens):
- Entities: CAMPAIGN → contains STAGES; each STAGE exposes STAGE_PATHS
  (fit / fight); paths use reusable WORKOUT_MODULES; modules have
  DIFFICULTY_VARIANTS (easy/normal/hard) and reference EQUIPMENT_ITEMS and
  VIDEO_LINKS; stages award via ACHIEVEMENT_RULES and score via an
  XP_RULESET; USER_PROGRESS tracks per-stage state.
- Content files: stage-catalog.json, workout-modules.json, ui-copy.json —
  adding a new camp or arcade campaign means adding data, never new screens.
- Workout module shape: { module_id, module_type: "fit"|"fight", discipline,
  difficulty, format: "single"|"morning"|"evening", duration_min,
  warmup: [...], rounds: [{ index, length_sec, rest_sec, goal }],
  target_rpe: [lo, hi], completion_rules: { min_rounds_completed,
  technique_breakdown_limit, pain_flag_stop: true },
  substitutions: { equipment_id: alternative } }.
- Stage shape: { stage_id, campaign_id, title, phase, fit_available,
  fight_available, full_arc_available, default_format, paths: { fit:
  { module_ids, difficulty[] }, fight: { protocol_family: "training_camp",
  discipline, archetype, level_reference, difficulty[] } }, equipment:
  { required[], recommended[], alternatives{} }, readiness_checks[],
  xp_rule_id, achievement_rule_ids[], video_ids[] }.
- The same fight modules power BOTH Training Camp levels and Arcade stages —
  one engine, many skins.

--- PROMPT 2: 12-level camp structure + phases ---

Restructure Training Camp's 12 levels into 5 phases with hard product rules
(update the camp map's phase labels to match):
- FOUNDATION (L1–3): single sessions only, no two-a-day. Mobility,
  bodyweight basics, aerobic intro + stance, movement, guard, basic strikes
  and defense.
- DEVELOPMENT (L4–6): Split or Full sessions, split recommended. Roadwork,
  jump rope, bodyweight strength, foundational resistance + shadowboxing,
  combinations, bag work, defense, footwork.
- HARD CAMP (L7–9): highest total load of the whole camp. Intervals,
  strength progression, power, strength-endurance + tactical rounds, high
  output, sport-specific conditioning.
- TAPER (L10–11): L10 reduces total volume 20–30% from L9; L11 reduces
  further. Keep intensity and precision, cut volume: accuracy, reaction,
  clean rounds, game-plan rehearsal, recovery cardio, mobility.
- FINAL BOSS (L12): one single extended mission with scoring objectives.
  The user should enter fresh, not fried — L11 must be light.
- Excluded by design (never prescribe or reward): hard sparring, rapid
  weight cutting, dehydration practices.

--- PROMPT 3: Discipline → archetype → difficulty selection ---

Camp setup flow: pick DISCIPLINE (Boxing / Kickboxing / Muay Thai / MMA,
using existing discipline art) → pick ARCHETYPE (3 per discipline, card
UI: name + fighting-style description) → pick DIFFICULTY (Easy / Normal /
Hard). Archetype drives drill selection and tactical objectives; difficulty
drives volume, rest, complexity and decision load. The 12 archetypes:
- BOXING · Pressure Dog — relentless forward pressure. E: jab-cross-hook
  pressure basics; N: ring-cutting, body jab, body-head combos; H: high
  output, body-attack volume, late-round surges.
- BOXING · Slick Counter Boxer — defense into offense. E: guard, slip line,
  jab and exit; N: slip-counter, pull-counter, pivot finishes; H:
  multi-layer defense, trap counters, angle resets under fatigue.
- BOXING · Twelve-Round Finisher — pace and championship endurance. E:
  relaxed output, breathing; N: even pace, composure, steady volume; H:
  championship-round simulation, late surges, short-rest finishers.
- KICKBOXING · Dutch Volume Pressure — punch–low-kick chains. E: basics;
  N: 3–4 strike Dutch chains, compact defense; H: long chains, low-kick
  attrition, high-density rounds.
- KICKBOXING · Long-Range Kicker — distance and kick volume. E: jab, teep,
  round-kick mechanics; N: distance control, body kick and reset; H:
  interception, long-range scoring, kick volume with short rest.
- KICKBOXING · Angle Counter Kickboxer — catch, return, angle out. E: basic
  exits; N: catch-return, check-return, step-outs; H: reactive counter
  layers, hand–kick counters, pace changes.
- MUAY THAI · Muay Femur Technician — the technician. E: teep, balance,
  long guard; N: technical kicking, timing, scoring awareness; H:
  teep-kick-counter control, ring craft, high precision.
- MUAY THAI · Muay Khao Clinch Grinder — knees and clinch. E: knee posture,
  bag-clinch basics; N: knees, turns, inside control, clinch endurance; H:
  high clinch density, knees under fatigue, balance recovery.
- MUAY THAI · Muay Mat Power Puncher — hands with kicks. E: boxing entries
  with kicks; N: punch-heavy pressure, low kick, elbow entries; H: power
  chains, forward pressure, body-head-elbow aggression.
- MMA · Wrestle-Box Control — strike to takedown to control. E: jab to
  level-change mechanics; N: cage entries, top control drills, mat returns;
  H: long control rounds, wall pressure, chain entries under fatigue.
- MMA · Anti-Wrestling Sniper — sprawl and punish. E: sprawl form,
  circling, straight strikes; N: underhooks, wall exits, strike-on-break;
  H: defensive wrestling into counters, layered get-ups, punish entries.
- MMA · Chaos Finisher — scrambles and finishes. E: basic transitions,
  technical stand-up; N: scramble chains, finish reactions, ground-and-
  pound patterns; H: high-transition rounds, unstable-position offense,
  finish scenarios.

--- PROMPT 4: Round timing engine ---

Drive all camp round timers from a timing table keyed by discipline, level
band and difficulty (data, not hardcoded). Rounds build toward each sport's
real competition timing.
STRIKING (Boxing / Kickboxing / Muay Thai):
- L1–2 — E: 4–6×1:00, rest 60–75s · N: 5–6×1:00, rest 45–60s · H: 6×1:00–
  2:00, rest 45–60s.
- L3–4 — E: 4–6×1:30, rest 45–60s · N: 5–6×2:00, rest 45–60s · H: 6–8×2:00,
  rest 30–45s.
- L5–6 — E: 5×2:00, rest 45–60s · N: 6×2:00, rest 45s · H: 6–8×2:00–3:00,
  rest 30–45s.
- L7–9 Boxing/Muay Thai — E: 5×2:00–3:00 · N: 6×3:00 · H: 7–8×3:00.
- L7–9 Kickboxing (intentionally shorter — amateur kickboxing is 2-minute
  based) — E: 5×2:00 · N: 6×2:00–3:00 · H: 6–8×3:00 (pro-style simulation).
- L10–11 (taper): KEEP round length, reduce round count 20–50%.
- L12 Final Boss — E: 20–30 active min of structured objective rounds ·
  N: 24–30 · H: 30+ active min ONLY if the readiness check passes.
MMA (builds toward 5:00 pro rounds):
- L1–2 — E: 4–5×1:00 circuits · N: 5–6×1:00–2:00 · H: 6×2:00.
- L3–4 — E: 5×2:00 · N: 6×2:00 · H: 6×2:00–3:00.
- L5–6 — E: 5×2:00–3:00 · N: 6×3:00 · H: 6–7×3:00.
- L7–8 — E: 5×3:00 · N/H: 5–6×4:00.
- L9 — E: 5×3:00 · N: 5×4:00 · H: 5×5:00 simulation.
- L10–11: keep 3–5 min technical flow rounds, reduce total volume.
- L12 — E: 4×4:00 · N: 5×5:00 · H: 5×5:00 only if prior levels passed
  cleanly.
Rest is 1:00 between rounds unless the band says otherwise.

--- PROMPT 5: Split Camp / Full Camp Session ---

Add the two-a-day option for levels 4–11 (L1–3 and L12 are single-session
only):
- SPLIT CAMP (recommended default L4–11): MORNING MISSION = physical prep
  (roadwork, jump rope, intervals, bodyweight/loaded strength, mobility,
  core, optional low-volume explosive work). EVENING MISSION = combat work
  (shadowboxing, bag, footwork, defense, tactical rounds, discipline
  conditioning). Recommend 4–8 hours between; show both missions on the
  level card as AM / PM chips with independent completion states.
- Between AM and PM, a quick 4-question check: Have you eaten and hydrated?
  Feeling unusually heavy or slow? Did the morning stay within the assigned
  effort? Any sharp pain or new injury? Bad answers → suggest moving PM to
  tomorrow or an Easy variant (never shame).
- FULL CAMP SESSION (single-block alternative): warm-up → Fit block →
  8–15 min transition break → Fight block → cooldown, as one continuous
  guided session.
- A level passes when its required mission(s) are completed per the pass
  rules (Prompt 7).

--- PROMPT 6: Safety gate + daily readiness ---

Two-stage safety system:
- STAGE 1 (once, at camp onboarding): PAR-Q+ style pre-participation
  screening. Any "yes" answer → recommend medical guidance before training
  and default the user toward Easy; never hard-block silently.
- STAGE 2 (before every session): quick readiness check — sleep quality,
  fatigue, muscle soreness, stress, mood/motivation (simple 1–5 taps), plus
  a danger-symptom question (dizziness, chest symptoms, sharp pain,
  concussion symptoms, acute injury). Danger symptom = halt the session,
  clearly advise stopping exercise, no progression penalty.
- Low readiness (poor sleep/high soreness) → offer the Easy variant or a
  recovery session instead; completing it keeps the streak.
- Hard rule: the app never rewards or requires dehydration, rapid weight
  cutting, or hard sparring.

--- PROMPT 7: Pass rules + adaptive failure ---

Level pass/fail evaluated at session end (feeds the existing outcome
screens and anti-cheat from 09):
- PASS thresholds by difficulty — completion of prescribed work: Easy ≥85%,
  Normal ≥90%, Hard ≥95%; technique integrity: no major breakdown / no
  repeated breakdown / clean under fatigue; RPE within the assigned band;
  zero safety flags; tactical objective: attempted / completed / completed
  cleanly.
- FAIL TYPES with different responses (never random punishment):
  · Conditioning fail (didn't complete the work) → retry a modified
    session, or reduce only the affected section by one step.
  · Technical fail (form broke down) → recommend Practice Mode drills +
    suggest a lower difficulty.
  · Tactical fail (objective missed) → repeat the same mission once; if
    missed again, lower only the tactical layer.
  · Safety flag → stop progression, show a recovery/medical advice note.
- Balancing principle everywhere XP is granted: clean completion on Easy is
  worth MORE than repeated failure on Hard.

--- END ---
