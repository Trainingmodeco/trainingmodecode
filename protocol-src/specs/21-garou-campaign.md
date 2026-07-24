# 21 · TRAINING ARCADE — THE HERO HUNTER: MARTIAL EVOLUTION (build prompts)

A DUAL-PATH (FIT / FIGHT / BOTH), 10-stage campaign — a lean, explosive
fighter-sprinter who "learns every style." Content in
`protocol-src/data/campaigns/ARC_GAROU/`. Runs on the shared arcade engine.
Grounded in `protocol-src/research/garou-research-report.md`.

--- PROMPT 1: Register the dual-path campaign ---

Load `campaigns/ARC_GAROU/{campaign,stages,modules}.json`. type: **fit_fight**.
Every stage has fit_available, fight_available, and full_arc_available TRUE
(split_available false, default_format "full") — so the stage-select screen
shows the PATH row (FIT · FIGHT · BOTH) and the DIFFICULTY row: EASY "STUDENT" ·
NORMAL "HERO HUNTER" · HARD "AWAKENED". Landing: name "THE HERO HUNTER — MARTIAL
EVOLUTION PROTOCOL", tagline "Learn. Adapt. Get faster.", core rule chip «Speed
and explosiveness are trained fresh and capped — never chase a 'one-punch'
knockout or train through pain.» 10-node map, Stage 10 the finale.

HONESTY / FANTASY (bake into copy): "one-punch" knockout power, mid-fight
"evolving," and monster transformation are FANTASY — flavor only. What's real is
faster, more explosive, better-conditioned striking. Spot reduction is a MYTH —
abs come from whole-body fat loss (diet/energy balance) + preserved muscle, not
ab exercises. Use original art, not trademarked One Punch Man / Garou character
art.

--- PROMPT 2: Dual paths + the style progression (the mechanic) ---

Each stage runs as FIT (fighter-sprinter build), FIGHT (fast explosive
striking), or BOTH (combined). The FIGHT path "learns a new style" as it climbs:
boxing (S1-3) → Dutch kickboxing (S4) → Wing Chun (S5) → power/conditioning
(S6-7) → contrast (S8, advanced) → integration (S9-10). The FIT path builds the
evidence-backed engine behind fast striking: jump-rope/plyo (S2), explosive
legs + sprints (S3), explosive bodyweight (S4), shoulder resilience + dense arms
(S5), med-ball/upper-body power (S6), sprint+shadowbox conditioning (S7),
contrast (S8), deload (S9). Cross-mixing (as requested): cardio stages fold in
shadowboxing + plyometrics; striking stages fold in explosive bodyweight
(burpees, tuck jumps, side lunges).

--- PROMPT 3: Quality-capped explosive work (the safety spine) ---

Encode as hard limits:
- PLYO: modules carry `plyo {foot_contact_cap, set_reps, rest_sec,
  min_recovery_between_plyo_h, amplitude}`. Beginner caps 60/80/100 by
  Easy/Normal/Hard (top of the 60-100 beginner band, never above). 48h between
  moderate plyo sessions / 72h high; NO back-to-back plyo days. Jump rope counts.
- SPRINTS: `sprint_session {reps, distance_m, recovery}` — low-volume, FULL
  recovery between reps.
- STRIKING: `striking_rounds` + `round_len_sec` — train SPEED and power-ENDURANCE
  (3s bursts), NOT max single-punch force. Combinations are called out by voice.
- CONTRAST (Stage 8, `advanced_only: true`): heavy/loaded effort paired with an
  explosive one; full rest between pairs; moderate load; unlocked only here.

--- PROMPT 4: Striking safety + honesty (from research + convention) ---

- WARM UP FIRST incl. shoulder (scapular/rotator-cuff) and wrist prep before any
  striking; high-intensity work waits for it.
- PROTECT HANDS + SHOULDERS: wraps + gloves for bag work, progressive contact,
  wrist aligned; never bare-knuckle a heavy bag; never load-strike a bag with
  weights in hand.
- LEGS DRIVE THE PUNCH: power is a whole-body chain from the floor — program
  explosive legs; do not sell arm strength as the source of power.
- HONESTY ON LEANNESS: visible abs = whole-body fat loss (energy balance +
  nutrition) + preserved muscle; you cannot out-train a poor diet. Surface the
  spot-reduction myth in Stage 1 copy.
- STOP CRITERIA: wrist/hand/knuckle pain, shoulder pain/impingement, sharp joint
  pain, shin pain during running, dizziness/chest pain/SOB. Any halts with a
  plain-language caution, no XP penalty.
- Stage 9 is a DELOAD ("Real Evolution") — completing it earns ACH_GA_ADAPT;
  never treat it as skipping. Beginners start STUDENT, low end of every cap.

--- PROMPT 5: Achievements + finale ---

- 12 achievements from campaign.achievements (The Student, Fast Hands, Legs Drive
  the Punch, Dutch Rhythm, Centerline, Ballistic Power, The Hunter's Engine,
  Contrast, Real Evolution, The Hero Hunter, Every Style, and Fighter-Sprinter =
  clear a stage as BOTH).
- FINALE (Stage 10, "The Hero Hunter"): FIT = warm-up → explosive legs → sprint →
  capped med-ball/plyo finisher → conditioning. FIGHT = boxing combos → Dutch
  combo into kicks → Wing Chun chain-punch burst → power-endurance → free flow.
  Fast, capped, controlled, NEVER to exhaustion or max-force chasing. Enter
  rested (Stage 9 deload). FINAL CLEAR → victory + The Hero Hunter / Every Style
  (+ Fighter-Sprinter if run as BOTH).

--- SOURCING NOTE ---

Grounded in a 107-agent deep-research report (21 confirmed / 4 refuted). REAL &
used: plyo/jump-rope → punch speed/reaction/RFD; lower-body strength drives
punch force; med-ball/upper-body plyo add ballistic (throwing-proxy) power;
contrast training (advanced) improves punch speed/force/power; plyo dosing
50-200 contacts, 48-72h recovery. HONESTY: one-punch power / mid-fight evolving
= fantasy; spot reduction = myth; leanness = nutrition/energy balance. NOT
research-graded (conventional coaching, flagged): the striking-technique pillars
(boxing/Dutch/Wing Chun fundamentals, chain punching, trapping, centerline),
reaction drills, shoulder-resilience and hand/wrist protection protocols. Two
sources (boxingfitness.com, performancepurpose.ca) were security-flagged for
probing the agent proxy endpoint and EXCLUDED.

--- END ---
