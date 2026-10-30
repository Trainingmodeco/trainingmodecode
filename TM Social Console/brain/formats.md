# Formats

Repeatable post types, the template that makes each, and where the content
comes from. The first eight come from the "Content Arcade: Batch 01" playbook
(https://claude.ai/code/artifact/fe647984-a92c-49a3-913f-fe8dc08f80c2); the
rest from the production schedule in `scripts/`.

| # | Format | Template | Content |
|---|---|---|---|
| 1 | **Boss Intro**: every workout announced like a boss fight ("STAGE 3 / LEG DAY / FIGHT!") | `BossIntro`, or as the hook in front of footage | named workouts and Arcade stages in `brand/brand.json` |
| 2 | **Stage Clear sting**: STAGE CLEAR + ★★★ + sign-off on every video | built into every template's end card | — |
| 3 | **Rank Ladder**: Rookie → Champion, "where did you stall?" | `hyperframes/` | `brand.json` → `ranks` |
| 4 | **Drop trailer**: the live concept drop and the next one | `ScriptShort` with drop art (`tm/drops/<id>/…`) | `brand.json` → `drops` (tagline, window, limited title) |
| 5 | **Mission Failed memes**: relatable gym fails, red glitch | `ScriptShort` (gold beats for the punchline) | owner's ideas; keep it kind |
| 6 | **Trophy unlocks**: console-style achievement pops | to build | app trophies |
| 7 | **Choose your fighter**: Boxing / Kickboxing / Muay Thai / MMA | `ScriptShort` or footage | app disciplines |
| 8 | **Share card loop**: users' workout cards and the QR poster | footage / stills | `../public/social/` |
| 9 | **App explainers**: Founder story, Fit Mode, Fight Mode, Arcade, Practice, how to start | `ScriptShort` or talking-head `FootageShort` | `scripts/` production schedule (High priority) |
| 10 | **Weekly dev log**: what changed in the app this week | `FootageShort` (screen recording) | git log of the app |
| 11 | **UGC tester reaction**: "I tried Training Mode for 7 days" | `FootageShort` | testers' clips |

## Drop calendar (plan trailers a week ahead)

- **SHOTO**: live 2026-10-23 → 2026-11-30. "Three styles. One path."
- **ULTRA EGO**: 2026-12-01 → 2027-01-31 (replaces The Destroyer saga).
  Trailer week: Nov 24.
- **FLOW STATE**: 2027-02-01 → 2027-03-31.
- **ONE HUNDRED**: 2027-04-01 → 2027-05-31.
- **WARRIOR QUEEN**: 2027-06-01 → 2027-07-31.
- **NIGHT VIGILANTE**: 2027-08-01 → 2027-09-30.

Always re-check dates in `brand/brand.json` (run `npm run sync` first).

## Cadence

Start at 4 posts a week (Mon / Wed / Fri / Sun), the same video to TikTok,
Reels, Shorts and Facebook with platform captions. Move to 1 a day once the
inbox keeps up. Reddit: at most 1 a week, value first.

## Writing a hook

First second, on screen, under 8 words, a problem or a dare: "Shadowboxing
alone?", "Your workout is the boss.", "Where did you stall?". One idea per
post. Highlight one or two words with `*stars*`.
