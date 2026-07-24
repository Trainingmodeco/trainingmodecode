# 20 · TRAINING ARCADE — HYPERBOLIC GRAVITY CHAMBER: TEMPO PROTOCOL (build prompts)

A FIT-ONLY, 10-stage tempo / time-under-tension campaign — no fight, no
split. Content in `protocol-src/data/campaigns/ARC_GRAVITY/`. Runs on the
shared arcade engine but adds a TEMPO + VOICE-COUNT mechanic. Grounded in
`protocol-src/research/gravity-research-report.md`.

--- PROMPT 1: Register the fit-only campaign ---

Load `campaigns/ARC_GRAVITY/{campaign,stages,modules}.json`. This is the first
FIT-ONLY arcade campaign: stages have fit_available true, fight_available and
full_arc_available FALSE, no split. The stage selection screen shows only the
FIT path (no PATH row, no FORMAT row) and a single DIFFICULTY row: EASY "LOW
GRAVITY" · NORMAL "HYPER GRAVITY" · HARD "MAX GRAVITY". Landing: name
"HYPERBOLIC GRAVITY CHAMBER — TEMPO PROTOCOL", tagline "Control the tension.
Breathe through it.", core rule chip «Tension is the challenge — breath is the
release.» 10-node map; each node titled by its gravity multiplier ("50x
GRAVITY — FIND THE CADENCE"). Stage 10 is the finale node.

HONESTY: do NOT claim slow tempo builds more muscle (research says it doesn't).
Copy frames it as control, tension, strength-endurance, focus, discipline. The
"gravity multiplier" is motivational theming, not a real training variable.

--- PROMPT 2: Tempo engine + voice-count cadence (the mechanic) ---

Each fit module carries a `tempo` {eccentric_sec, pause_bottom_sec,
concentric_sec, pause_top_sec} and a `voice_count_mode` (none | reps |
cadence). The guided session runner drives reps by this tempo:
- The rep timer/animation paces the lowering, hold, and lifting phases to the
  tempo seconds (scaled by difficulty via campaign.difficulty_scaling.tempo:
  Easy 2/0/2, Normal 3/1/3, Hard 4/1/3). NEVER let a full rep exceed ~10s
  (research: over-10s reps are inferior — enforce the cap).
- VOICE-COUNT MODE per stage:
  · none (Stage 1) — no count; the athlete finds their baseline reps.
  · reps (Stage 2) — coach counts completed reps out loud.
  · cadence (Stage 3+) — coach paces the tempo: "down 1...2...3... hold... up
    1...2...3... hold". The signature mode. Voice cue on every phase.
- tempo_mode per stage (normal / slow / very_slow / mixed / recovery /
  gauntlet) adjusts the cadence emphasis (Stage 7 "mixed" = slow lowering then
  a controlled faster press).

--- PROMPT 3: Isometric holds — target times, never failure ---

Modules with `hold_targets_sec` (planks, wall-sits, squat-holds, horse-stance)
run a hold TIMER to the target, then STOP. NEVER "unlimited" or to-failure.
Show a countdown to the target; a persistent breathing cue runs the whole
hold. Hold targets scale by difficulty (campaign.difficulty_scaling.
hold_target_sec).

--- PROMPT 4: Safety — the breathing rule + stops (from research) ---

Encode campaign.safety_scaffolding as hard behavior:
- BREATHE, NEVER VALSALVA: the coach cues continuous breathing on every rep
  and hold ("breathe... exhale on the press"). Modules carry
  "breath_hold_stop": true — if the app detects (or the user reports) a
  persistent breath-hold, pause and re-cue. This is the campaign's #1 safety
  rule (breath-holding spikes blood pressure severely).
- TARGET HOLDS, LIGHT LOAD, GRADUAL RAMP: never prescribe to-failure, never
  heavy load, and keep the gravity stages in order (the ramp is what makes it
  safe — the repeated-bout effect).
- STAGE 9 IS A DELOAD: a deliberate easy back-off before the finale. Completing
  it earns the ADAPTATION achievement — reward recovery, never treat it as
  skipping.
- STOP CRITERIA always available: dizziness/faintness (esp. on standing after
  holds), headache/vision change during a hold, severe/unusual muscle pain or
  swelling or dark urine (rhabdo signs), chest pain / shortness of breath. Any
  one halts with a plain-language caution and no XP penalty. On first entry,
  surface the high-blood-pressure note (keep holds short, load light, breathe).

--- PROMPT 5: Achievements + finale ---

- 8 achievements from campaign.achievements (Baseline Set, In the Cadence,
  Never Break Breath = a full stage with zero breath-hold flags, Iron Hold,
  The Weight of Worlds, Adaptation, 1000x Gravity, Chamber Master).
- FINALE (Stage 10, "1000x Gravity — The Chamber's Limit"): a target-based
  tempo gauntlet through all the movements — hit each target with clean tempo
  and steady breath, then STOP. Never to failure. FINAL CLEAR → victory screen
  + 1000x Gravity / Chamber Master.

--- SOURCING NOTE ---

Eccentric strength benefit, isometric/tempo legitimacy, and ALL safety rules
(breathe-don't-Valsalva, DOMS/rhabdo risk, repeated-bout ramp, target holds,
light load, sub-10s reps) are peer-reviewed. The "slow tempo builds more
muscle" premise is REFUTED by 2025-26 meta-analyses — framing avoids that
claim. Exact tempos/hold-times are conservative convention, not from sources.

--- END ---
