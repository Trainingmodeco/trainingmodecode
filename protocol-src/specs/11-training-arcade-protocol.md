# 11 · TRAINING ARCADE PROTOCOL v2 (game layer on the camp engine)

Upgrades 06-training-arcade.md: Arcade campaigns become themed skins over
the Training Camp engine (file 10). Requires 10 Prompt 1 (data model)
first. Paste one prompt block at a time, in order.

--- PROMPT 1: Fit / Fight / Full-Arc stage paths ---

Every Arcade stage exposes a PATH choice, driven by per-stage availability
flags in the stage catalog:
- FIT — physique, movement, strength, stamina. Available whenever the
  campaign has meaningful non-combat training.
- FIGHT — combat training and discipline simulation, powered by the
  Training Camp engine: the stage's fight path references a discipline +
  archetype + camp level (e.g. boxing / slick_counter_boxer / level 7), so
  Arcade reuses camp modules instead of duplicating content.
- FULL ARC — both layers. Only shown when the stage has both Fit and Fight.
  Selecting it reveals a FORMAT choice: SPLIT CAMP (AM fit / PM fight, per
  10 Prompt 5) or FULL CAMP SESSION (one block with the 8–15 min
  transition), plus SEPARATE difficulty selectors for Fit and Fight.
- A campaign can be Fit-only (pure conditioning/transformation fantasy),
  Fight-only, or both — the stage map badges show which paths each stage
  offers.

--- PROMPT 2: Stage selection screen ---

Rebuild the Arcade stage detail into a full selection screen (keep the
existing card style and mini badge art):
- HEADER: stage number + title, phase chip (FOUNDATION / HARD CAMP / FIGHT
  PREP etc.), estimated total duration, estimated active time, XP
  available, achievement badge preview.
- PATH row: FIT · FIGHT · FULL ARC (only available paths shown).
- FORMAT row (Full Arc only): SPLIT CAMP · FULL CAMP SESSION.
- DIFFICULTY row: EASY · NORMAL · HARD (gold selected); when Full Arc,
  two rows: FIT DIFFICULTY and FIGHT DIFFICULTY.
- EQUIPMENT row: icon chips from the stage's equipment profile — 🧍 Open
  Space · ⏱ Timer/Phone · 💧 Water · 🪢 Jump Rope · 🧤 Gloves · 🥊 Heavy
  Bag · 🏋 Light Weights · 🧵 Band · 🧘 Mat. Required items solid,
  recommended dimmed; missing-required shows the substitution notice.
- WARNINGS block (contextual, small): "No heavy bag? Shadowboxing version
  available." · "Hard mode is intended for experienced fighters." · "If
  you feel sharp pain, dizziness, or concussion symptoms, stop training."
- PREVIEW block: round count, round lengths, rest lengths, target RPE,
  major skill theme, substitutions available — generated live from the
  selected path/format/difficulty so changing a selector updates the
  preview.
- START runs the daily readiness check (10 Prompt 6) first, then the
  session.

--- PROMPT 3: Equipment-aware routing ---

Add equipment intelligence:
- User equipment profile in settings (toggle the same icon list). Every
  workout module declares required / recommended equipment + substitutions.
- Default to MINIMUM VIABLE EQUIPMENT: every stage must be completable with
  open space + phone. Richer gear routes to richer module variants.
- Substitution map (data-driven): jump rope → invisible rope, fast feet,
  lateral shuffles · light dumbbells → bodyweight tempo work, backpack,
  bands · heavy bag → power shadowboxing rounds, wall target markers ·
  mitts/Thai pads → bag rounds or cue-based shadowboxing · band →
  isometrics or bodyweight · mat → towel or carpet-safe floor.
- When a substitution is active, the session shows a small chip ("BAG →
  SHADOWBOX POWER ROUNDS") and XP is unaffected — never punish equipment,
  only effort.

--- PROMPT 4: XP formula + achievement families ---

Standardize XP across Camp and Arcade:
- XP = active_minutes × 10 × difficulty_multiplier × completion_multiplier
  × quality_bonus. Multipliers: Easy 1.0 · Normal 1.15 · Hard 1.30 ·
  Full-Arc completion +15% · clean-technique bonus +5% · no-difficulty-drop
  weekly bonus +10%. Store as a remote-configurable XP_RULESET, not
  constants in code.
- Balancing rule enforced by the formula: clean completion on Easy always
  beats repeated failure on Hard (failed sessions earn partial XP at most,
  per the 09 outcome mapping).
- Achievement families (each a badge series wired to real events): FIT
  CLEAR · FIGHT CLEAR · FULL ARC CLEAR · NO-DROP RUN (finish a campaign
  without lowering difficulty) · PERFECT DEFENSE · LATE-ROUND SURGE ·
  TACTICAL BOSS CLEAR · MINIMAL EQUIPMENT MASTER (clear stages with zero
  gear) · CONSISTENCY STREAK.
- These join the existing trophy grid on the Progress tab as an ARCADE
  section expansion.

--- END ---
