# 13 · TRAINING ARCADE — ULTRA EGO STYLE: DESTROYER PROTOCOL (build prompts)

In-depth prompts to build/rebuild the Ultra Ego arcade campaign on the
protocol v2 engine. All content lives in
`protocol-src/data/campaigns/ARC_ULTRAEGO/` (campaign.json, stages.json,
modules.json) — the prompts below wire it up; they add NO hardcoded content.
Paste one prompt at a time, in order.

--- PROMPT 1: Load campaign content + campaign map ---

Rebuild the Ultra Ego arcade campaign as a data-driven campaign on the
protocol engine:
- Load `campaigns/ARC_ULTRAEGO/{campaign,stages,modules}.json`. Validate
  stages against `schemas/stage.schema.json` (fight paths here use direct
  `module_ids`, not camp references — the schema supports both).
- Campaign landing: banner (campaign art slot), name "ULTRA EGO STYLE —
  DESTROYER PROTOCOL", tagline "Build the frame. Control the pressure.
  Unleash the power.", core rule chip «Power without control is failure.»,
  path badges (FIT · FIGHT · FULL ARC), stages cleared n/12.
- Stage map: 12 nodes with phase group labels from stage data (FOUNDATION
  1–3 · DEVELOPMENT 4–6 · HARD CAMP 7–9 · TAPER 10–11 · FINAL BOSS 12).
  Node states: cleared ✓ per-path (a node can show FIT CLEAR / FIGHT CLEAR
  / FULL ARC CLEAR chips), current (gold glow), locked (greyscale + 🔒).
  Stage 12 is the 👑 boss node — larger, gold/red glow, titled
  "DESTROYER'S TRIAL".
- Unlock rule: clearing ANY available path on a stage unlocks the next
  stage. Per-path clears are tracked separately for the Full Arc Ascension
  achievement (all 12 stages cleared on BOTH fit and fight).

--- PROMPT 2: Stage selection screen (path / format / dual difficulty) ---

Stage selection screen for every Ultra Ego stage, all values read from the
stage + module data:
- HEADER: "STAGE n · TITLE", phase chip, purpose line, mission target
  ("Maintain posture and guard without rushing." etc.), est. duration,
  +XP, achievement opportunity badge when the stage has one.
- PATH row: FIT · FIGHT · FULL ARC (from availability flags).
- FORMAT row (Full Arc on stages 4–11 only, from split_available):
  SPLIT CAMP · FULL CAMP SESSION. Stages 1–3 and 12 never show it.
- DIFFICULTY: single row for Fit-only/Fight-only; TWO independent rows for
  Full Arc (FIT DIFFICULTY / FIGHT DIFFICULTY — they may differ). Labels
  from campaign difficulty_scaling: EASY "AWAKENING" · NORMAL "DESTROYER"
  · HARD "GOD OF DESTRUCTION". Hard shows the experienced-fighters
  warning.
- EQUIPMENT panel near the bottom: required row (🧍 ⏱ 💧 always), stage
  recommended icons, and auto-shown substitution lines for anything the
  user's equipment profile lacks ("No heavy bag? Power shadowboxing
  version."). Every stage must resolve to at least the MINIMAL profile.
- TRAINING PREVIEW: recomputed live on any selector change — number of
  sessions (1 or 2), round count, round/rest lengths (resolved from the
  selected difficulty via campaign difficulty_scaling.fight, module
  overrides, and taper multipliers for stages 10–11), target RPE band,
  major exercises (first 4 from the module), combat focus, XP estimate.
- ▶ START runs the readiness check first (halt on danger symptoms; low
  readiness offers Easy or recovery — completing either keeps the streak).

--- PROMPT 3: Session runner — Fit / Fight / Full Arc ---

Session execution for Ultra Ego stages:
- FIT-only: guided session from the fit module's exercise list — exercise
  call-outs, set/rep checkpoints (tap-to-confirm, feeds anti-cheat), rest
  timers. Sets per difficulty from campaign difficulty_scaling.fit
  (Easy 2–3, Normal 3–4, Hard 4–5 working sets).
- FIGHT-only: ring-timer rounds from the fight module's rounds array, one
  GOAL per round displayed large ("ROUND 3 · CROSS-HOOK-LOW KICK") with
  voice call-out at the bell. Round length/rest/count resolved from the
  selected difficulty (Easy 1:00 technical rounds, Normal 2:00,
  Hard 3:00 + shorter rest), taper multiplier applied on stages 10–11.
  Strike counter runs; warm-up option applies as everywhere else.
- FULL ARC: per selected format —
  · SPLIT CAMP: AM fit mission / PM evening fight mission with independent
    completion states and the between-session mini-check.
  · FULL CAMP SESSION: warm-up → fit block → 8–15 min transition break
    (countdown card, skippable after 8 min) → fight block → cooldown, one
    continuous flow.
- Completion maps to the campaign completion states: FIT_CLEAR /
  FIGHT_CLEAR / FULL_ARC_CLEAR, shown as chips on the node and outcome
  screen.

--- PROMPT 4: Stage 12 — Destroyer's Trial (Final Boss) ---

The boss experience:
- Entry gate: no separate hard morning workout — if a fit session was
  already completed today, warn and offer to schedule the trial for
  tomorrow instead (never block outright).
- FIGHT trial = the Twelve-Round Destruction Trial: 12 rounds, each with
  its named objective from campaign.final_boss.round_objectives displayed
  as the round title ("ROUND 8 · PRESSURE AGAINST A RETREATING OPPONENT")
  + voice call-out at each bell. Timing strictly from
  final_boss.timing[difficulty]: Easy 12×1:00/45s (~20 min) · Normal
  12×2:00/30s (~30 min) · Hard 12×3:00/30s (~42 min).
- FIT final test: the test battery with predetermined targets shown before
  each category — never "max until collapse". Progress = targets met, not
  exhaustion.
- FULL ARC final test: short activation circuit → transition → the
  twelve-round trial → cooldown → final readiness report (a summary card:
  rounds completed, objectives hit, RPE vs target).
- Boss outcome: FINAL BOSS CLEAR → full-page victory screen (gold/red
  radial, campaign trophy reveal, "DESTROYER CLEAR" achievement), stats
  row, share card. Failure → normal fail flow with retry; no penalty
  beyond no-clear.

--- PROMPT 5: Achievements, failure logic, and the core rule ---

Wire the campaign's integrity layer:
- 8 campaign achievements from campaign.achievements, each triggered by
  real session events (e.g. Grounded Power = Stage 4 cleared with zero
  balance-failure flags; No Hesitation = Stage 8 with no missed
  transition checkpoints; Perfect Taper = Stages 10 AND 11 completed
  within their RPE band). Show earned badges on the campaign map and the
  Progress tab arcade section.
- Adaptive failure per campaign.failure_logic — the two paths are
  INDEPENDENT: a fit failure reduces reps/resistance and suggests one
  difficulty lower WITHOUT touching fight difficulty; a fight failure
  recommends Practice Mode, shortens rounds, increases rest, drops fight
  difficulty one level WITHOUT lowering the fit path.
- Safety stop list (sharp pain, chest pain, dizziness, faintness,
  concussion symptoms, severe breathing difficulty, acute injury) halts
  immediately with the stop-training advisory — no XP penalty, no shame
  copy.
- Enforce the core rule in scoring: reckless output never scores.
  Technique-breakdown flags reduce quality bonuses; XP always favors a
  clean Easy clear over a broken Hard attempt (already guaranteed by
  calcXp completion multipliers). Hard difficulty NEVER requires taking
  punches, unsupervised hard sparring, training through sharp pain,
  dehydration, or sets to failure — these appear nowhere in prescriptions.

--- END ---
