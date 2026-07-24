# 23 · WORKOUT REMINDERS + COMBO STREAK (build prompts)

A LIGHTWEIGHT, forgiving workout-reminder + streak feature — the free-tier slice
of the Game Plan roadmap. Real, evidence-based reminders with light video-game /
anime flavor (streak = "COMBO", XP, ranks). Data + copy:
`data/workout-reminders.json`. Pure logic: `engine/reminders-engine.ts`.
Grounded in `research/reminders-research-report.md`.

DESIGN NORTH STAR: capture most of the adherence benefit with the SMALLEST
feature set. Never make the app heavy or naggy. Everything is either
EVIDENCE-BACKED or flagged as product CONVENTION; nothing promises fast habits.

--- PROMPT 1: Reminders are if-then plans (not just alarms) ---

A reminder is stored as an IMPLEMENTATION INTENTION — the single best-supported
technique (Bélanger-Gravel 2013, d=0.31 durable). Setup captures: activity
(user-chosen), days (user-chosen), a cue time (user-chosen — self-selected beats
prescribed; offer a morning slot but never force it), and an optional coping
line ("If {barrier}, then {backup}" — barrier planning strengthens the plan).
The app composes and shows the plan text ("If it's 07:30 on Mon/Wed/Fri, then I
train Combo Coach."). Engine: `ifThenText(reminder)`.

--- PROMPT 2: One nudge a day, quiet hours, snooze ---

Default ONE scheduled nudge per training day (CONVENTION — the evidence didn't
fix a frequency ceiling, so v1 stays minimal to avoid fatigue). Optional single
"keep your combo" safety nudge later in the day IF a scheduled day has no logged
workout and the user opted in — positive framing only. Respect quiet hours
(default 21:30–07:00), offer snooze (10/30/60 min), and let the user disable all
notifications. Engine: `nextReminder(reminders, nowDate, nowTime)` computes the
next fire (pure — the caller supplies "now"; the engine never reads the clock,
so the OS scheduler drives it).

--- PROMPT 3: The COMBO streak — forgiving by design (the important part) ---

The streak is a COMBO. EVIDENCE-CRITICAL: a single missed day does NOT derail
habit formation (Lally 2010), so the combo is FORGIVING and punitive one-miss
resets are AVOIDED (they drive all-or-nothing dropout). Rules (engine:
`applyComboEvent`):
- A completed/verified workout → combo +1.
- A PLANNED REST DAY never breaks the combo (recovery is training — fighter
  framing). This is the primary grace mechanic (default 2 rest days/week,
  user-set).
- A GUARD token (freeze) auto-absorbs ONE isolated unplanned miss so the combo
  survives ("blocked a hit", not a failure). Earn 1 GUARD per 7-day milestone,
  hold up to 2.
- Grace tolerates ISOLATED misses, not chronic ones: the combo only breaks after
  TWO CONSECUTIVE unplanned missed training days with no GUARD.
- On break: reset to 0, KEEP the longest combo, show encouraging restart copy
  (no guilt), one-tap new run.
Outcomes surfaced for the UI: trained · rest · guarded · held · milestone ·
broken (pick the matching copy pack).

--- PROMPT 4: XP + ranks (light gamification) ---

Gamification adds real but SMALL durable value (Mazeas 2022, g=0.23 vs active
controls) — so it ENHANCES the reminder core, it isn't the whole thing. XP for
showing up (100 scheduled / 60 any / 150 milestone). Combo milestones map to
ranks: 3 Warm-Up · 7 First Blood (+1 GUARD) · 14 Contender · 30 Ranked · 66
Second Nature · 100 Champion. The 66-day rank is a deliberate nod to the REAL
science (median ~66 days to automaticity) replacing the debunked "21-day" myth.

--- PROMPT 5: Copy tone + personalization ---

TONE: encouraging, coach/sensei-like, action-oriented — NEVER guilt, shame, or
fake social pressure ("everyone else trained"). Light video-game/anime flavor
("Guard up", "your arc continues", "combo"). Personalization is LIGHT only —
name, chosen activity, chosen time, combo, guards (Smith 2019: heavy tailoring
not justified). Rotate copy variants (engine: `fillCopy(lines, index, tokens)`,
deterministic by a caller-supplied index) to fight habituation. All copy packs +
the forbidden-tone list live in `data/workout-reminders.json`.

--- PROMPT 6: Metrics — engagement ≠ behavior ---

SEPARATE the metrics: a reminder that opens the app or logs a tap is NOT the same
as one that produced a workout (Martin 2018). Track delivered/opened/snoozed/
dismissed AND workout_completed_after_reminder; judge success on the latter.

--- DELIBERATELY LEFT OUT of v1 (keep it light) ---

Deferred to `roadmap/game-plan-scheduler.md` (the heavy adaptive version):
adaptive/AI "breakpoint" notification scheduling (proven to cut response time
~50% but not worth the v1 complexity), multiple daily notifications, social/
leaderboard pressure by default, an elaborate tailoring engine, and heavy
onboarding.

--- SOURCING NOTE ---

Grounded in a 106-agent deep-research report (24 confirmed / 1 refuted).
EVIDENCE-BACKED: if-then plans, barrier planning, plain scheduled reminders raise
activity, self-selected cue time, single-miss-doesn't-derail (grace mechanics),
gamification adds small durable value, engagement≠behavior, ~66-day habit median
(21-day myth rejected). CONVENTION (flagged, not proven): the 1/day nudge cap,
quiet hours, positive-only tone, variant rotation, GUARD/rest-day defaults.
REFUTED (not used): tailoring by activity level. Two sources (trophy.so,
thelancet.com) + one verifier agent were security-flagged for probing the agent
proxy and EXCLUDED; the retained findings stand on non-flagged citations.

--- END ---
