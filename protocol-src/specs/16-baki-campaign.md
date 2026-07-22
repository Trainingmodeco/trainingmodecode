# 16 · TRAINING ARCADE — THE GRAPPLER: STRONGEST TEEN PROTOCOL (Baki, build prompts)

Fourth data-driven campaign, content in
`protocol-src/data/campaigns/ARC_BAKI/`. Same shared engine as spec 13 — if
those five prompts are built, this needs only Prompt 1 (register). Prompts
2-4 cover what is UNIQUE to Baki: the phantom shadow-fight motif, the
fantasy-vs-real safety flagging, and the all-around composure-gated boss.
Grounded in `protocol-src/research/baki-research-report.md`.

--- PROMPT 1: Register the campaign ---

Load `campaigns/ARC_BAKI/{campaign,stages,modules}.json` into the campaign
registry. Renders through the spec-13 screens: landing (name "THE GRAPPLER
— STRONGEST TEEN PROTOCOL", tagline "Fight the phantom. Chase the ogre.",
core rule chip «Chase the monster, train like a human.»), 12-node stage map,
stage selection, skill-first split runner, boss, achievements, independent
fit/fight failure logic. Difficulty labels: EASY "CHALLENGER" · NORMAL
"GRAPPLER" · HARD "STRONGEST". Persona label per stage from stage.persona
(Young Baki → Underground Arena → Katsumi → Retsu → Hanayama → Izou → Jack →
Pickle → Underground Peak → Yujiro boss). New equipment icon: 🤜 Grip
Trainer.

--- PROMPT 2: Phantom rounds (shadow-fight motif) ---

Fight rounds whose goal starts with "phantom_" are shadow-fights against an
IMAGINED opponent — Baki's signature training, and the real trainable form
of his "phantom" fighting. Render them with a distinct treatment:
- A subtle "PHANTOM" chip on the round HUD; the round prompt frames an
  imagined attacker ("he strikes slow — read and counter", "beat his next
  move"). Voice cue at the bell describes the phantom's behavior.
- These double as mental/visualization training — keep the coach quieter
  mid-round (like Ultra Instinct flow rounds); let the user focus.
- Completing EVERY phantom round across the campaign earns THE PHANTOM
  achievement (13 rounds total). Track per-round completion.

--- PROMPT 3: Fantasy-vs-real flagging + striking safety ---

This campaign leans on characters with impossible/unsafe canon. Surface the
`stage.fantasy_lore` string on the relevant stages (Katsumi 4, Jack 8,
Yujiro 12) as a flavor card with a "⚠ ANIME FANTASY — NOT A TRAINING GOAL"
tag. Rules the app MUST enforce (from campaign.safety_notes):
- KARATE/KUNG-FU STRIKING (stages 4-5): bag work with proper wrist/knuckle
  alignment and gradual volume ONLY. Never prescribe bare-knuckle makiwara
  board conditioning. The safety_stop list adds "hand/knuckle pain from
  striking (stop bag work)" — surface it during striking rounds.
- JACK STAGE (8): normal, safe heavy-compound strength with predetermined
  targets. NO PED content, NO extreme-bulk protocol, NO "30-hour training"
  — the lore card says so explicitly; the prescription is ordinary strength
  work.
- Demon Back, titanium teeth, superhuman feats: lore/imagery only, always
  fantasy-tagged, never a goal or a prescription.

--- PROMPT 4: The Ogre boss — all-around, composure-gated ---

Stage 12 is the father-son fight — an all-around test, not a power grind:
- 12 rounds, each objective from campaign.final_boss.round_objectives
  cycling every campaign skill (jab, one-punch, kung-fu, phantom, clinch,
  ground, explosive, all-around, mental dominance, survival, finish).
  Timing from final_boss.timing[difficulty] (Easy 12×1:00/45s ·
  Normal 12×2:00/30s · Hard 12×3:00/30s).
- COMPOSURE / FORM GATE (core mechanic): output scores only while form AND
  composure hold. Rounds track technique-breakdown flags; exceeding the
  limit fails the round ("Yujiro's edge is mental — rushing loses"). Surface
  as a live "COMPOSURE" meter that drains on breakdown. Capped survival
  rounds still apply their volume cap.
- Outcome: FINAL BOSS CLEAR with no composure-breakdown fail → victory +
  "BEAT THE OGRE" achievement.

--- SOURCING NOTE ---

Fan-program structure (SuperheroJacked) and per-character themes (Baki wiki)
are researched; the persona→stage arc is the campaign's design. NOTHING was
refuted, but the FLAGGED fantasy (Jack PEDs/titanium teeth/30hr, Yujiro
Demon Back, superhuman feats) must never become training content. Makiwara/
grip/kung-fu safety was not deeply sourced, so the campaign uses
conservative, well-established safe practice and caps volume on peak stages.

--- END ---
