# 14 · TRAINING ARCADE — ULTRA INSTINCT STYLE: FLOW STATE PROTOCOL (build prompts)

Second data-driven campaign, content in
`protocol-src/data/campaigns/ARC_ULTRAINSTINCT/`. The wiring is IDENTICAL to
Ultra Ego (spec 13) — if spec 13's five prompts are built, this campaign
needs only Prompt 1 below (load + register). The rest of this file covers
what is UNIQUE to Ultra Instinct.

--- PROMPT 1: Register the campaign ---

Load `campaigns/ARC_ULTRAINSTINCT/{campaign,stages,modules}.json` into the
campaign registry alongside ARC_ULTRAEGO. Everything renders through the
same screens built for spec 13: campaign landing (name "ULTRA INSTINCT
STYLE — FLOW STATE PROTOCOL", tagline "Train it a thousand times. Then stop
thinking.", core rule chip «Flow is earned, not rushed.»), 12-node stage
map with phase labels, stage selection (path / format / dual difficulty /
equipment / live preview), skill-first split runner, boss trial, campaign
achievements, independent fit/fight failure logic. Difficulty labels for
this campaign: EASY "SIGN" · NORMAL "INSTINCT" · HARD "MASTERED".

--- PROMPT 2: Campaign-specific behaviors ---

Three things Ultra Instinct adds beyond the shared engine:
1. MEDITATION BLOCKS (rounds flagged "completion_only": true): render with
   a calm violet ring state (no work/rest urgency), breathing-paced pulse,
   no RPE, no fail state — skipping never fails a session, but completing
   every meditation block across the campaign earns CALM MIND. Voice cue at
   start: "Breathe. Visualize every strike." No motivational cues during.
2. FLOW ROUNDS (goals prefixed flow_): the coach voice goes QUIET during
   the round — one cue at the bell describing the round, then silence
   until the last-10s warning. Flow means no chatter. Bag-work flow rounds
   display "30–40% EFFORT" as a persistent hint chip.
3. ANTI-RUSH scoring: per the core rule, strike-counter output above the
   round's intent (e.g. flow rounds) never adds bonus XP — this campaign
   rewards clean completion, not volume. Reuse the technique-breakdown
   flags; rushing/flailing counts as breakdown.

--- PROMPT 3: Reflex rounds (optional enhancement) ---

Rounds with goals containing "reflex": if the device supports it, overlay
random visual cues (screen edge flashes gold at random 2-6s intervals —
user reacts with a slip/duck/strike). Reuse the Reaction Mode cue engine if
built; otherwise render the goal text and let the tennis-ball drill be
self-directed. Never require a partner — solo alternatives always shown.

--- END ---
