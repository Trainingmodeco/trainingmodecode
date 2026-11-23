# Retention features: the owner's plan (2026-11-22)

The brief is `PROMPT-RETENTION-1.md` (branch `claude/console-handoff-2026-11-17-retention`). The looks are the
hidden gallery at `/retention-looks` (code in `components/training-mode/retention/`), also published privately for the owner.

## What the owner decided

- **Build now:** 1. weekly streak + daily mission + freezes, 2. the path + stars, 3. near-miss retry.
- **Leagues become a game-over score board.** After a finished session in any feature, show the athlete's score for
  that mode and where it ranks against real players around the world, with their levels, like an arcade
  "GAME OVER / HIGH SCORES" list. Needs a server table and security rules; design them and show the owner before building.
- **CPU house scores while the beta is small (owner, 2026-11-22).** Each mode's board has 10 slots; empty slots are
  filled with arcade-style house scores, clearly tagged `CPU`, at a spread of levels. Real players rank among them.
  Once a mode has 5 or more real players, house scores stay only below the lowest real score, so they fade out as
  people join. House scores are never shown as real people.
- **Release now (owner, 2026-11-23, replacing the January plan for this batch):** "Everything that we worked on now,
  the retry, the scoreboard, everything that was a question that we just reviewed: you could push that into the app
  once generated." So this batch is switched on for everyone (its switches set in `FOR_EVERYONE`) as each piece is
  built, reviewed and passes the full check: the weekly streak with Today's Bout and 1UPs, the path and stars (camp
  stars too), near-miss retry, POWER / RUSTY / REVIVE, the Fit workout card, the owner's board answers, and the
  game-over score board (its server table and security rules are shown to the owner before anything is created on the
  live database).
- **Next year, one batch per quarter:** "the team workouts, the league, and all that other stuff": squads (team
  workouts), weekly leagues, the season reward track, and the notifications pass (low-POWER alerts, "Remind me
  tomorrow"). They stay off until their quarter.

## Defaults used while the open questions are unanswered

The owner said "just work on" features 1 to 3, so the gallery's recommendations are the defaults, each easy to change:
weekly target 4 days (2 to 6 in settings), one freeze per 4 weeks on target, hold at most 2, new athletes start with 1,
all features free.

## Release order (owner, 2026-11-23)

| When | What |
| --- | --- |
| Now, as each piece passes its checks | Weekly streak + Today's Bout + 1UPs, the path + stars (camp stars too), near-miss retry, POWER / RUSTY / REVIVE, the Fit workout card, the board answers, the game-over score board (after the owner approves its server design) |
| Next year, quarter 1 to 4 (one batch per quarter) | Squads (team workouts), weekly leagues, the season reward track, the notifications pass |

## Visual rule for every new screen (owner, 2026-11-22)

Everything fits its frame on a phone: no wording, design or frame cut off, nothing squeezed or crowded. Check every
new or changed screen at phone sizes (360, 390 and 430 px wide) by measuring overflow and clipped text, show the
owner a preview, and fix anything before it ships. When in doubt, take something out rather than squeeze it in.

## Owner's idea, 2026-11-23: 1UP and a POWER bar (not built; answers on the preview board)

- Keep the freeze numbers (start with 1, +1 per 4 weeks on target, hold 2). The owner likes a game name: 1UP
  (recommended), REVIVE or RECOVER. Board question `q-1up`; rename once answered.
- A POWER bar that drains while the athlete stays away and refills with a finished session; a phone alert when it is
  low ("losing power"); the owner suggested dropping a level after a month. Recommended instead: never take XP or
  levels away; after a month the fighter shows RUSTY (greyed portrait) until one session REVIVES it; alerts only with
  the notifications release after the App Store launch, opt-in, at most one a week, positive words, stop after three
  are ignored. Board questions `q-power`, `q-month`, `q-drain`, `q-alerts`
  (https://claude.ai/artifact/8rkLzhnBSc19h5L5pitdys).
