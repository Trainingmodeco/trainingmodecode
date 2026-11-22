# Retention features: the owner's plan (2026-11-22)

The brief is `PROMPT-RETENTION-1.md` (branch `claude/console-handoff-2026-11-17-retention`). The looks are the
hidden gallery at `/retention-looks` (code in `components/training-mode/retention/`), also published privately for the owner.

## What the owner decided

- **Build now:** 1. weekly streak + daily mission + freezes, 2. the path + stars, 3. near-miss retry.
- **Leagues become a game-over score board.** After a finished session in any feature, show the athlete's score for
  that mode and where it ranks against real players around the world, with their levels, like an arcade
  "GAME OVER / HIGH SCORES" list. Real players only, no bots (the brief's rule). Needs a server table and security
  rules; design them and show the owner before building.
- **Nothing new is switched on for users until Training Mode is in the App Store** (planned for January). Every
  feature is built behind its own switch, on for the owner's phone (owner preview) and off for everyone else.
- **After launch, drop the rest a few at a time, one batch per quarter** (every 3 to 4 months): the score board,
  squads, the season reward track, and the notifications pass.

## Defaults used while the open questions are unanswered

The owner said "just work on" features 1 to 3, so the gallery's recommendations are the defaults, each easy to change:
weekly target 4 days (2 to 6 in settings), one freeze per 4 weeks on target, hold at most 2, new athletes start with 1,
all features free.

## Release order (proposal, the owner sets the dates)

| When | What |
| --- | --- |
| Launch (January) | Weekly streak + daily mission + freezes, the path + stars, near-miss retry |
| Launch + 1 quarter | Game-over score board |
| Launch + 2 quarters | Squads |
| Launch + 3 quarters | Season reward track, notifications pass |
