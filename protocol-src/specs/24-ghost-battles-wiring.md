# 24 · GHOST BATTLES — PER-MODE WIRING (build prompts)

How the Ghost Battles engine plugs into each real mode's workout flow. This is
the app-team integration guide — the "where does it live and how does a session
become a race" spec. Complements `specs/18-ghost-battles.md` (the mechanic) with
concrete per-surface wiring. Engine: `engine/ghost-engine.ts`. Config + data
model: `data/ghost-battles.json` (see the new `mode_wiring` block).

--- WHERE GHOST BATTLES LIVE (the answer) ---

Ghost Battles is fundamentally a FIGHT MODE feature — it races your recorded
STRIKE output against a saved ghost. But the engine also supports a TIME race
(faster-completion wins), so it maps onto any STAGE-BASED mode. Per surface:

- COMBO COACH (Fight Mode) — **primary home.** Win metric: STRIKES. The ghost
  icon (👻) already lives on its setup screen. Open striking session, no fixed
  end → most strikes wins.
- FIGHT FOCUS (Fight Mode) — native. Win metric: STRIKES. Same as Combo Coach.
- TRAINING CAMP — strong fit. Stage-based fight runs → win metric TIME
  (beat-the-clock) for a full stage, or STRIKES for a single striking round.
- TRAINING ARCADE, fight / both stages — inherits it. A fight-capable arcade
  stage races the same way Camp does (TIME for the stage, STRIKES for a round).
- TRAINING ARCADE, FIT-ONLY campaigns (Sonic, Gravity, and the fit path of any
  campaign) — a ghost here can only be a TIME/pace race; there are no strikes to
  replay. This is a lighter variant — see PROMPT 5; RECOMMEND DEFERRING it for
  v1 to keep the feature light, and shipping ghost battles as a Fight-Mode-first
  feature (Combo Coach + Fight Focus + Camp).

RECOMMENDATION for v1 scope: ship Combo Coach + Fight Focus + Training Camp
(the strike/time races that reuse the existing verified-session pipeline). Treat
fit-only arcade ghosts as a fast-follow, not v1.

--- PROMPT 1: One ghost pipeline, mode-tagged ---

Every VERIFIED session (any of the above modes) can produce a ghost via
`makeGhost(...)`. The ghost stores its `source.mode` (combo_coach | fight_focus |
arcade | camp) and its `win_metric` (strikes | time). The mode determines the
win metric and which UI surfaces offer the race — read it from the new
`mode_wiring` block in `data/ghost-battles.json`. Nothing about recording changes
per mode except which metric is authoritative.

--- PROMPT 2: Combo Coach & Fight Focus (STRIKES race — the core) ---

- ENTRY: the 👻 icon on the Combo Coach / Fight Focus setup screen (already
  specced, 18·Prompt 3). Tap → ghost picker (MY BEST / recent / enter code).
- FORMAT: the battle inherits the ghost's `rounds_config` (you fight its format
  so the comparison is fair) — show it read-only on setup.
- DURING: run the normal striking session. A live counter uses
  `ghostCountAtTime(ghost, elapsedSec)` vs your live strikes; `liveLead(...)`
  drives an ahead/behind bar ("+6 vs ghost").
- END: `resolveGhostBattle(...)` with win_metric "strikes" → higher total wins,
  tiebreak best_round. Outcome via `battleHeadline` ("▲ +12 STRIKES · GHOST
  DEFEATED"). Loss still grants normal XP (never punish showing up).

--- PROMPT 3: Training Camp (TIME race on a stage) ---

- ENTRY: on a Camp stage's setup/complete screen, "RACE A GHOST" (MY BEST for
  that stage/discipline, or a challenge code). Ghosts are stage-specific
  (`stage_label`, `discipline_or_campaign`).
- WIN METRIC: TIME — faster full-stage completion wins (this reuses the Arcade/
  Camp target-time model). `completion_sec` is authoritative; the strike buckets
  still drive the live pace replay.
- DURING: the live replay shows the ghost's pace (from `buckets`); the user sees
  whether they're ahead of the ghost's clock.
- END: `resolveGhostBattle(...)` win_metric "time" → lower completion_sec wins;
  tiebreak more strikes. Headline "▲ 26s FASTER · GHOST DEFEATED".
- A single striking ROUND inside camp may also be offered as a STRIKES race
  (optional) — same as Combo Coach.

--- PROMPT 4: Training Arcade — fight / both stages ---

Fight-capable arcade stages wire exactly like Camp (PROMPT 3): TIME race for the
stage, optional STRIKES race for a round. The ghost's `source.mode` = "arcade",
`discipline_or_campaign` = the campaign id (e.g. ARC_GAROU), `stage_label` = the
stage. Matchmaking and share card (40e) are unchanged.

--- PROMPT 5: Training Arcade — FIT-ONLY (the lighter variant, recommend defer) ---

Fit-only campaigns (Sonic, Gravity, the fit path of any campaign) have NO strikes
to record, so a ghost there is a pure TIME/pace race:
- win_metric "time"; `buckets` are unused for strikes — instead the live replay
  can show pace as % of stage complete over time (or reps/round if the module
  reports a countable rep). `total_strikes`/`best_round` are 0 or repurposed to a
  generic "work units" count.
- Because this needs a non-strike replay path and a rep/progress signal that not
  every fit module emits cleanly, it is EXTRA WEIGHT. Ship it only after the
  Fight-Mode-first version proves out. When it does ship, reuse the same 40e card
  with a time delta and a stage/campaign label instead of strike stats.
- Guardrail: fit-only ghosts must never turn a safety-capped stage into a "go
  faster / beat the clock" incentive that undermines the campaign's caps (e.g.
  Sonic's full-recovery sprints, Gravity's tempo holds). For those, a ghost race
  on TIME is INAPPROPRIATE — prefer "did you complete it" over "how fast." So
  fit-only ghosts are opt-in per campaign, and campaigns whose whole point is
  controlled tempo/recovery (Gravity; Sonic sprints) OPT OUT.

--- PROMPT 6: Surfacing & sharing (shared across modes) ---

Unchanged from 18·Prompts 3-4 and `data/ghost-battles.json`:
- Combo Coach 👻 icon (always present, empty-state explains how to make a ghost).
- VS pop-up: `shouldShowVsPrompt(...)` — at most once / ~2-3 days, only on a real
  fresh event (a downloaded friend ghost, or someone beat your challenge), never
  mid-session, always dismissible.
- SET AS CHALLENGE on every verified Mission Complete → challenge code / link;
  only verified sessions can be shared. Share card 40e; trophies 40f.

--- SOURCING / SCOPE NOTE ---

No new research — this wires the existing, already-built engine + data model into
the real modes. It reuses the verified-session integrity guarantee (only verified
sessions become ghosts) and the existing Arcade/Camp target-time model for the
TIME races. The only genuinely new surface is fit-only arcade ghosts (PROMPT 5),
which is flagged as deferred and safety-gated so ghost racing never undermines a
campaign's built-in safety caps.

--- END ---
