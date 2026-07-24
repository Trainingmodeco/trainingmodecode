# 19 · TRAINING ARCADE — SONIC: SPEED PROTOCOL (build prompts)

A FIT-ONLY, 12-stage SPEED campaign — no fight, no split. "Gotta go fast,"
built the way athletes actually build speed. Content in
`protocol-src/data/campaigns/ARC_SONIC/`. Runs on the shared arcade engine but
adds a MANDATORY WARM-UP GATE + QUALITY-CAPPED speed mechanic. Grounded in
`protocol-src/research/sonic-research-report.md`.

--- PROMPT 1: Register the fit-only campaign ---

Load `campaigns/ARC_SONIC/{campaign,stages,modules}.json`. Like Gravity Chamber,
this is FIT-ONLY: stages have fit_available true, fight_available and
full_arc_available FALSE, no split. The stage selection screen shows only the
FIT path (no PATH row, no FORMAT row) and a single DIFFICULTY row: EASY "JOG
PACE" · NORMAL "GOTTA GO FAST" · HARD "SUPERSONIC". Landing: name "SONIC — SPEED
PROTOCOL: THE BLUE BLUR", tagline "Gotta go fast — safely.", core rule chip
«Speed is a quality, not a grind — warm up first, go max, then fully recover.»
12-node map themed as Sonic zones (Green Hill → Final Zone); each node titled by
its zone + focus. Stage 12 is the finale node.

THEMING/HONESTY: the Sonic "speed" theming is motivational packaging. The
cartoon fantasy elements — superhuman top speed and flips/tricks — are FLAVOR
ONLY and never become trainable content. Use original speed-lines / Green-Hill-
style art, not trademarked Sonic character art.

--- PROMPT 2: The mandatory WARM-UP GATE (the mechanic) ---

Every module carries `warmup_gate: true` and every stage's first exercise IS a
~15-min neuromuscular / dynamic warm-up (FIFA 11+ style: joint mobility,
activation, dynamic stretch, progressive-intensity running). The guided runner
must GATE the high-intensity work behind it:
- The warm-up runs first and `completion_rules.warmup_gate_required` is true —
  sprint/plyo/agility work stays locked until the warm-up is complete.
- This is not a nag: the research shows the warm-up BOTH reduces lower-extremity
  injury AND acutely improves sprint, jump, and balance. Frame it as the thing
  that makes you faster, not a chore.
- Achievement ACH_SN_NOSKIP ("Never Skip the Warm-Up") = complete a full stage
  with the gate done and zero pain flags.

--- PROMPT 3: Quality-capped speed work (plyo + sprint) ---

Speed is trained fresh, in small quality doses — encode the caps as hard limits:
- PLYOMETRICS: modules carry `plyo {foot_contact_cap, set_reps, rest_sec,
  min_recovery_between_plyo_h, amplitude, progression}`. Count foot-contacts and
  STOP at the cap (beginner 40/60/80 by Easy/Normal/Hard — the research beginner
  band is 60-80; Easy sits below it, Hard sits at the top, never above). Sets of
  5-10 reps, ≥60s rest, 48h between plyo sessions (24h only for low-amplitude
  pogo/ankle/line hops). Bilateral before unilateral. On pain: cut foot-contacts
  50% and land soft (bent knees, never "stick").
- SPRINTS: max-velocity modules carry `sprint_session {reps, distance_m,
  range_m, total_volume_m, recovery}`. Low-volume/high-quality: 40-60m × 3-4
  reps (~120-240m), FULL recovery between every rep. `full_recovery_required`
  and `volume_capped` are true — the runner must enforce full rest and never
  let the athlete trade recovery for density. Stop while reps are still fast.
- ACCELERATION modules carry `accel {reps, distance_m, recovery}` — short
  10-20m starts, mechanics-focused, full recovery.

--- PROMPT 4: Safety scaffolding (from research) ---

Encode campaign.safety_scaffolding as hard behavior:
- WARM-UP GATE (above) — mandatory, not optional.
- ANKLE-FIRST PARKOUR: Stage 2 teaches soft landing + safety roll + ankle
  stability BEFORE any jumps (the ankle is the highest-risk joint). Stage 9
  parkour modules carry `no_flips: true` and `parkour.forbidden: [flips,
  tricks, high drops]`. Keep jump heights to what the athlete can land
  perfectly — copy says "master before progressing," NEVER a landing-rep count.
- CONDITION THE VULNERABLE LINKS: Nordic curls / eccentric hamstring work and
  ankle/calf work are seeded from Stage 3 (lack of conditioning is an
  independent injury factor).
- GRADUAL RUN VOLUME: run modules carry a ~10%/week ramp note; Stage 11 is a
  deliberate DELOAD (deload:true) before the finale — completing it earns the
  ADAPTATION-style achievement (ACH_SN_DELOAD "Rest Is Speed"); never treat it
  as skipping.
- STOP CRITERIA always available: sharp ankle/knee/shin pain, shin pain building
  during running (shin-splint/stress warning), Achilles/patellar tendon pain,
  sharp posterior-thigh (hamstring) pain, dizziness/chest pain/shortness of
  breath. Any one halts with a plain-language caution and no XP penalty. On
  first entry, surface the beginner note (start JOG PACE, low end of every cap,
  add volume slowly).
- RECOVERY = FUNDAMENTALS: sleep, nutrition, hydration — not gadgets.

--- PROMPT 5: Achievements + finale ---

- 11 achievements from campaign.achievements (Warm-Up Complete, Soft Landing,
  Aerobic Base, First Hops, Quick Feet, Top Speed, Free Runner, Never Skip the
  Warm-Up, Rest Is Speed, The Blue Blur, Sonic Speed = clear all 12).
- FINALE (Stage 12, "Final Zone — The Blue Blur"): full warm-up gate → capped
  acceleration → one capped max-velocity sprint set (full recovery) → agility
  circuit → small capped plyo finisher. Fast, clean, capped — NEVER to
  exhaustion. Enter rested (Stage 11 was the deload). FINAL CLEAR → victory
  screen + The Blue Blur / Sonic Speed.

--- STAGE MAP (12) ---

1 Green Hill (warm-up + running form) · 2 Loop-de-Loop (landing + ankle) ·
3 Emerald Hills (running base) · 4 Chemical Plant (low-intensity plyo) ·
5 Star Light (acceleration) · 6 Sky Sanctuary (agility/footwork) ·
7 Hydrocity (plyo progression) · 8 Flying Battery (max-velocity sprints) ·
9 Mystic Cave (parkour fundamentals) · 10 Chaos Emerald (speed combine) ·
11 Angel Island (deload) · 12 Final Zone (the Blue Blur finale).

--- SOURCING NOTE ---

Grounded in a 105-agent multi-source deep-research report (24 claims confirmed,
1 refuted). PEER-REVIEWED / verified and used: the mandatory neuromuscular
warm-up (injury reduction + performance gain), plyometric foot-contact caps and
progression, bilateral-before-unilateral, 48h plyo recovery, low-volume/high-
quality max-velocity sprints with full recovery, eccentric hamstring benefit,
ankle as highest-risk parkour joint, landing/rolling before advanced jumps,
recovery via sleep/nutrition/hydration. REFUTED (not used as literal content):
the "~100 landings per height increment" scheme — principle kept ("master
before progressing"), the exact number dropped. FANTASY (flavor only): super-
human top speed, flips. CONSERVATIVE CONVENTION (flagged, not from a source):
exact per-stage rep/distance/rest numbers, agility-drill parameters, the
~10%/week run-volume ramp, and the deload cadence. One research source
(garagegymreviews.com) was security-flagged during the run for probing the
agent proxy status endpoint and was EXCLUDED from synthesis.

--- END ---
