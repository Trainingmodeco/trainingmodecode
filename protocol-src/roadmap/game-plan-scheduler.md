# ROADMAP — GAME PLAN (adaptive workout scheduler)

STATUS: FUTURE / POST-LAUNCH · PRO-TIER FEATURE. Concept captured for later;
nothing built yet. This is the retention layer — it addresses the #1 reason
people stop training: TIME, not motivation or equipment.

## One-line
A cross-cutting layer that learns the user's schedule and free time, then
tells them WHEN to train and gives them a session that FITS the gap they
actually have — turning "I don't have time" into "you have 20 minutes at 2pm,
here's a Quick Mission."

## Naming
Recommended: **GAME PLAN** (fighter/coach term for the strategy; literally a
plan; on-brand). Alternatives: "The Corner", "Battle Plan". Avoid generic
"Workout Scheduler".

## Structure — standalone, cross-cutting (NOT a 4th mode, NOT inside Fight/Fit)
Its value is routing ACROSS all modes, so it sits above them. Three
touchpoints, not a new tab:
1. SETUP FLOW — the questionnaire + optional calendar connect (in onboarding
   or from Profile).
2. HOME SURFACING — powers the EXISTING "Today's Bout" card. Game Plan
   upgrades it from "here's a session" to "here's a session that fits your
   free hour at 2pm." No new screen — makes the existing one smarter.
3. SMART NOTIFICATIONS — opportunistic daily nudges.

## The questionnaire (short)
- What's your biggest hurdle to training? (time / equipment / motivation /
  don't know what to do)
- Days per week you want to train (2-7)
- Time per session you can usually give (10 / 20 / 30 / 45+ min)
- Rough weekly shape (work/school days + hours, or "connect calendar")
- Equipment on hand (reuses the existing equipment profile)

## Calendar integration (the trust make-or-break)
- Read FREE/BUSY ONLY — never event titles/details. You need "free 2-3pm",
  not "therapy at 2". This distinction IS the trust story.
- Use the DEVICE calendar (iOS EventKit / Android Calendar Provider), which
  already aggregates Google + Apple + Outlook — one integration covers
  everyone, no per-provider OAuth.
- Fully OPT-IN. Must work WITHOUT calendar too — the questionnaire alone
  gives a good plan; calendar is the upgrade, not the requirement.

## Time → session mapping (the engine)
Match the user's available block to a session type:
- < 20 min free  → Quick Mission / Fight Focus / Combo Coach
- 20-40 min      → Combat Conditioning / one Camp session
- 45+ min        → an Arcade stage / full Camp session
Also: respect rest days (ties into the readiness system already built);
busy weeks lean short-format, open weeks unlock the deep features (Arcade,
Camp).

## Notifications (opportunistic, never naggy)
- Fire BECAUSE a gap appears: "Free hour at 2 — 20-min Quick Mission?"
- Respect quiet hours; back off if the user already trained today.
- Adaptive tone; celebrate consistency (ties into streaks).
- A fitness app that nags gets muted/deleted; one that helps you FIND time
  gets kept.

## Monetization
Natural PRO feature (fits the "once we go pro" plan): free tier = manual
reminders; Pro = calendar-aware auto-plan + adaptive session routing.

## Privacy summary
Opt-in; free/busy only; device-calendar (no cloud calendar scraping);
works without calendar; no location; no selling of schedule data. State this
plainly in the connect flow — this feature lives or dies on trust.

## Build dependencies (when the time comes)
- Reuses: equipment profile, readiness system, Today's Bout card, all mode
  session types, streaks.
- New: questionnaire flow, device-calendar free/busy read, a scheduling
  rule engine (gap → session type), and a local notification scheduler.
- Suggested first version: questionnaire + manual availability + smart
  notifications, NO calendar (ship the value, add calendar as the Pro
  upgrade in v2).
