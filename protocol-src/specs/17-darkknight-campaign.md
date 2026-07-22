# 17 · TRAINING ARCADE — THE DARK KNIGHT: PEAK HUMAN PROTOCOL (build prompts)

The FLAGSHIP campaign — the app's hardest, the only one integrating all six
pillars (gymnastics, calisthenics, strength, cardio, fight, parkour). Content
in `protocol-src/data/campaigns/ARC_DARKKNIGHT/`. Same shared engine as spec
13 — if built, this needs only Prompt 1 (register). Prompts 2-4 cover what is
UNIQUE: the six-pillar load management, parkour + gymnastics safety
scaffolding, and the all-pillar boss. Grounded in
`protocol-src/research/darkknight-research-report.md`.

--- PROMPT 1: Register the campaign ---

Load `campaigns/ARC_DARKKNIGHT/{campaign,stages,modules}.json`. Renders
through the spec-13 screens: landing (name "THE DARK KNIGHT — PEAK HUMAN
PROTOCOL", tagline "Become more than a man.", core rule chip «The body is a
tool — sharpen it, don't shatter it.»), 12-node stage map, stage selection,
skill-first split runner, boss, achievements. Difficulty labels: EASY
"VIGILANTE" · NORMAL "DETECTIVE" · HARD "DARK KNIGHT". Each stage shows its
PILLAR (gymnastics / calisthenics / strength / cardio / fight / parkour /
integration) as a chip. New equipment icons: ⭕ Gymnastic Rings, 📦 Low Step.
Mark this campaign as the flagship (hardest) in the arcade list.

--- PROMPT 2: Six-pillar load management (the core design risk) ---

No real program safely fuses six pillars — the app must manage it (from
campaign.safety_scaffolding.overtraining_management):
- PILLAR ROTATION: each session leads with ONE primary pillar; the module
  content already keeps the others light. Never render a session that stacks
  heavy strength + high-impact parkour + gymnastics together.
- DELOAD: stages flagged "deload_after": true (8, 9) prompt a recovery/lighter
  day before the next hard stage. Completing every prescribed deload earns the
  DISCIPLINE achievement — recovery is rewarded, not treated as skipping.
- ENHANCED READINESS GATE on integration/peak stages (10-12): stage
  readiness_checks add "joint_soreness" — the readiness sheet shows an extra
  joint-soreness (and sleep-debt) question; poor answers push toward Easy or a
  movement-quality day.
- Peak stages carry "volume_capped": true — predetermined targets, rest
  floors, no max-until-collapse.

--- PROMPT 3: Parkour + gymnastics safety scaffolding ---

The two highest-risk pillars need explicit, non-skippable safety (from
campaign.safety_scaffolding). Surface stage.fantasy_lore as a "⚠" flavor card
on stages 4, 5, 12.
PARKOUR (stages 5, 9, 10, 11, 12 — flagged parkour_safety):
- Beginner precision-jump targets ~1-2 ft; confirm landing CLEARED before any
  jump; land soft (bend knees, balls-to-heel, quiet); roll FROM A SQUAT (head
  tucked, diagonal over one shoulder).
- NEVER auto-prescribe flips or advanced acrobatics — framed as advanced,
  deferred. Show "start low, land soft, no flips" cues during parkour rounds.
GYMNASTICS (stages 4, 8, 10, 11, 12 — flagged gymnastics_safety):
- Every gymnastics module OPENS with wrist prehab (lacrosse ball + mobility).
  Screen for front-of-wrist "pinch" pain — if present, STOP that work and
  regress (it's on the safety_stop list).
- Levers / muscle-ups / advanced ring skills are GATED behind their
  progression — never assigned cold. Build support holds + straight-arm
  strength first.
- Both stops ("front-of-wrist pinch pain", "fall/landing injury") halt the
  session with a plain-language caution and no XP penalty.

--- PROMPT 4: Become the Bat boss — all six pillars, control-gated ---

Stage 12 is the peak-human trial:
- 12 rounds, each objective from campaign.final_boss.round_objectives cycling
  every pillar (center → calisthenic power → strength → conditioning → boxing
  → Muay Thai → defense → gymnastic control → movement/parkour → all-around →
  composure → finish). Timing from final_boss.timing[difficulty].
- CONTROL/FORM GATE: output scores only while form, safety, and composure
  hold; exceeding the round breakdown limit fails the round. Parkour rounds
  stay low/cleared; gymnastics rounds keep wrist prehab + pinch-pain stop.
  Surface a live "CONTROL" meter.
- Outcome: FINAL BOSS CLEAR with no control-breakdown fail → victory +
  "BECOME THE BAT" achievement; clearing fit+fight on all 12 → PEAK HUMAN.

--- SOURCING / SAFETY NOTE ---

Calisthenics structure and parkour progression are researched (blog-tier,
corroborated); gymnastics wrist safety is peer-reviewed (highest confidence).
Six-pillar periodization is NOT sourced — the fusion is conservative design.
"127 martial arts" is comic lore, fantasy-flagged. One research sub-source was
security-flagged and EXCLUDED. Nothing was refuted.

--- END ---
