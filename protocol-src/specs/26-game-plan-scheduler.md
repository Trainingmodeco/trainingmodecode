# 26 · GAME PLAN — ADAPTIVE SCHEDULER (build prompts)

The retention layer. Learns the user's schedule + free time and routes them to a
session that FITS the gap they actually have — turning "I don't have time" into
"you have 20 minutes at 2pm, here's a Quick Mission." Cross-cutting: it sits
ABOVE the modes and powers the EXISTING "Today's Bout" card + smart
notifications — NOT a 4th tab. Data: `data/game-plan.json`. Pure logic:
`engine/game-plan-engine.ts`. Concept: `roadmap/game-plan-scheduler.md`.

--- PROMPT 1: Tiers (free vs pro) ---

- FREE = Manual Game Plan: questionnaire, a manual weekly plan (you pick days/
  times), scheduled reminders (specs/23), the combo streak, and time→session
  matching for a block you tell it you have. NO calendar.
- PRO = Adaptive Game Plan: everything free + opt-in device-calendar FREE/BUSY
  read, an auto weekly plan around your real availability, opportunistic "a gap
  appeared" nudges, and adaptive routing (busy week → short formats; open week →
  Arcade/Camp). Natural Pro monetization.
Engine enforces tier: `sessionsForGap(..)` hides Pro-only sessions on free;
`opportunisticNudge(..)` returns null unless tier is "pro".

--- PROMPT 2: Setup questionnaire ---

Short (onboarding or Profile), reuses the existing equipment profile + readiness
system. Questions (see `data/game-plan.json > questionnaire`): biggest hurdle
(time/equipment/motivation/don't-know), days/week (2-7), time/session
(10/20/30/45+), weekly shape (manual busy-day picker on free · connect calendar
on Pro), preferred time of day. Preferred time seeds the default reminder cue
(self-selected time beats prescribed — reminders research).

--- PROMPT 3: Time → session matching (the core) ---

`bestSessionForGap(gapMin, catalog, prefs)` picks the RICHEST session that fits a
free gap. A session is a flexible range [minMin, maxMin]; it "fits" when its
FLOOR ≤ the gap (a 20-40 min session can be done in a 30-min gap). Banding
(from the roadmap): <20 min → Combo Coach / Fight Focus / Quick Mission /
Reaction; 20-40 → Combat Conditioning / Camp session; 45+ → Arcade stage / full
Camp. It never routes a session whose floor overruns the gap; if nothing fits,
offer a short mobility/Reaction micro-session. Game Plan NEVER invents a
workout — it picks an existing mode/session that fits.

--- PROMPT 4: Weekly plan ---

`generateWeeklyPlan(prefs)` distributes exactly days_per_week training slots
across the week, evenly spaced (deterministic, non-clustered), honoring explicit
rest days. Non-training days are planned REST days — they never break the combo
(specs/23). Busy week → short formats; open week → unlock Arcade/Camp. Before
every session, the readiness gate applies: "halt" → reschedule/rest;
"suggest_easy_or_recovery" → offer the Easy variant or a recovery session
(completing it keeps the combo).

--- PROMPT 5: Today's Bout (home card, not a new screen) ---

`pickTodaySession(ctx)` powers the EXISTING "Today's Bout" card. It returns one
of: `rest_day`, `already_trained`, `halt`, `recovery`, or `train` (with the
chosen session, the free block, and the gap). Logic: readiness halt → rest;
planned rest day → rest (combo safe); already trained → don't double up; low
readiness → recovery/Easy; else pick the best session for today's LARGEST known
free block (Pro: calendar free/busy; Free: stated availability) and show block +
session + one-tap start. It upgrades the card from "here's a session" to "here's
a session that fits your free 2-3pm."

--- PROMPT 6: Opportunistic nudge (Pro) ---

`opportunisticNudge(ctx)` fires BECAUSE a real free gap appears that fits a
session. Guards (all must hold): tier pro, a training day, not yet trained today,
outside quiet hours (default 21:30-07:00, wraps midnight via `isQuietHours`),
past the cooldown (default 5h), not dismissed already today, and a session fits
the gap. Positive/coach tone, celebrates consistency; never guilt. If the user
already trained or dismissed, back off for the day. (Baseline one scheduled
nudge/day still comes from reminders, specs/23.)

--- PROMPT 7: Calendar + privacy (the trust story) ---

Pro + fully opt-in, and Game Plan MUST work without it. Read FREE/BUSY ONLY —
never event titles/details ("free 2-3pm", not "therapy at 2") — via the DEVICE
calendar (iOS EventKit / Android Calendar Provider, which already aggregates
Google/Apple/Outlook, so one integration covers everyone, no per-provider OAuth).
No location, no cloud calendar scraping, schedule data never sold/shared. State
this plainly in the connect flow — the feature lives or dies on trust.

--- PROMPT 8: Reuse, don't rebuild ---

Game Plan reuses: equipment profile, readiness system, combo streak + reminders
engine, all mode session types, and the existing Today's Bout card. New pieces:
the questionnaire flow, the device-calendar free/busy read (Pro), the scheduling
rule engine (already built — `game-plan-engine.ts`), and the local notification
scheduler. RECOMMENDED first version: questionnaire + manual availability + smart
notifications, NO calendar — ship the value, add calendar as the Pro v2 upgrade.

--- SOURCING / HONESTY NOTE ---

Scheduling behavior reuses the verified reminders research (implementation
intentions / self-selected time, forgiving streak, one well-timed nudge,
engagement ≠ behavior). The exact gap→session minute bands, weekly-plan spacing,
and cooldown/quiet-hours defaults are product CONVENTION (flagged in the data) —
tune them with real usage. No health/location data is used.

--- END ---
