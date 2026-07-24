# Workout Reminders — Deep Research Report (verified)

Source for `specs/23-workout-reminders.md`, `data/workout-reminders.json`, and
`engine/reminders-engine.ts`. Multi-source deep research, 106 agents,
adversarially verified (24 confirmed / 1 refuted). Raw: `reminders-research-raw.json`.

Scope: evidence-based, best-in-class design for a LIGHTWEIGHT workout-reminder
feature — what actually improves adherence, what the best apps do, and what to
deliberately LEAVE OUT to avoid bloat and notification fatigue.

## The headline

The evidence backs a small, forgiving, non-nagging reminder core: user-chosen
scheduled reminders built as "if-then" plans, one well-timed daily nudge, and a
FORGIVING streak with a rest-day/freeze. Gamification (streaks/XP/badges/combos)
adds real but modest durable value on top — it enhances a solid core, it is not
the whole strategy. Heavy features (adaptive/AI scheduling, constant
notifications, elaborate tailoring, guilt copy) are not worth the weight for v1.

## What IS evidence-based (used)

- **Implementation intentions ("if-then" plans) are the single best-supported
  technique.** Specifying WHEN/WHERE to train produces small-to-medium, DURABLE
  gains in physical activity (Bélanger-Gravel 2013 meta-analysis, 26 studies:
  d=0.31 post, 0.24 at follow-up, no decay; independently reproduced SMD=0.31,
  2023). → the reminder setup captures activity + time + days as an if-then plan.
- **Barrier/coping planning makes if-then plans work better.** → optionally
  prompt "if [obstacle], then [backup]" — not just a time.
- **Simple scheduled text reminders themselves raise objectively-measured
  activity** (Smith 2019 meta-analysis, 13 studies, d=0.38; modest, heterogeneous)
  → a plain scheduled nudge is evidence-based, not just convention.
- **Self-selected time/activity > prescribed; mornings tend to be stronger BUT
  chronotype-dependent** → let the user choose their own cue; a morning nudge is
  optional, never forced.
- **The "21 days to form a habit" is a MYTH.** Automaticity takes a median ~59-66
  days (means 106-154), individual range 4-335 (Lally 2010; 2024 review, 20
  studies, 2601 people). → copy never promises fast habits; the journey is framed
  as ~2 months with wide variance.
- **A single missed day does NOT derail habit formation** (Lally 2010: one miss
  cost <0.5 automaticity points, recovered next day). → DIRECT support for
  streak-freeze / rest-day / grace mechanics, and evidence AGAINST punitive
  one-miss streak resets. (Caveat: applied inference; CONSECUTIVE misses are more
  damaging — grace tolerates isolated misses, not chronic ones.)
- **Gamification adds real, durable, but SMALL value** (Mazeas 2022, 16 RCTs:
  g=0.42 during, g=0.23 vs active controls, persists at ~3.6 mo; a 2024 review
  confirms gamified > non-gamified but calls absolute gains "trivial", ~489
  steps/day). → streaks/XP/badges/combos justified as flavor on a solid core.
- **Reminders improve engagement/tracking but do NOT automatically change
  behavior** (Martin 2018 RCT: reminders raised tracker wear ~25% of days but did
  not raise steps). → separate the metrics: "opened / logged" ≠ "actually
  trained".
- **Adaptive breakpoint scheduling works but is NOT needed for v1** (Yahoo! JAPAN,
  ~680k users: breakpoint timing cut response time ~50%) → explicitly a DEFER —
  user-chosen scheduling captures most of the benefit without the complexity.

## Light-touch (medium confidence)

- **Personalization: keep it light** (name, chosen activity, chosen time). Tailored
  content trends better but NOT statistically robustly (Smith 2019); an elaborate
  tailoring engine is not justified for v1.

## REFUTED (not used)

- "If-then benefit is larger for the currently-inactive and when combined with
  reinforcement (tailor by activity level)" (1-2) — do not rely on activity-level
  tailoring.

## NOT substantiated by the verified evidence (product convention — flagged)

The specific harms the brief worried about were NOT proven by surviving peer-
reviewed claims and remain best-practice convention, not evidence:
- the exact reminder-frequency CEILING before fatigue/opt-outs,
- that streaks measurably cause "streak anxiety" / guilt / all-or-nothing dropout,
- that guilt-framed copy reduces adherence vs positive copy.
→ We design conservatively by convention anyway: default ONE nudge/day, quiet
hours, positive/coach tone (no guilt), and a forgiving streak — and label these
as convention, not proven.

## Minimal viable feature set (the "don't make it heavy" answer)

INCLUDE (v1): user-scheduled reminders on chosen days/times framed as if-then
plans; optional barrier/coping line; ONE well-timed daily nudge; a forgiving
streak ("combo") with planned rest days + a small number of freeze/grace tokens;
light personalization; snooze; XP + a few milestone badges.
LEAVE OUT (defer to roadmap/game-plan-scheduler.md): adaptive/AI breakpoint
scheduling, multiple daily notifications, social/leaderboard pressure, elaborate
tailoring engines, heavy onboarding.

## Integrity note

Two sources (trophy.so, thelancet.com) and one verifier agent were SECURITY-
FLAGGED for probing the agent proxy / reading harness config and were EXCLUDED;
the gamification finding is retained on its non-flagged citation (Mazeas 2022),
the if-then finding on two non-flagged meta-analyses. Effect sizes are consistently
MODEST and several come from clinical/step-count populations, so they are
indicative, not exact, for Training Mode's game-motivated audience.
