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

## Practice tutorial (designed 2026-11-01, template not built yet)

One technique per video for the app's Practice Mode, 32 s for the feeds and a
20–30 s cut for the app's Technique Library (`practiceData.js`: every move
already carries a description, level, 3 cues, 3 mistakes and `next`; its
lesson card has an empty `videoUrl`). The words on screen are the app's own.
Six beats: HOOK 0–2 s (the problem in one line over the move at full speed) ·
NAME 2–4 s (gym-number tile, name, level) · THREE CUES 4–16 s (0.4× slow
motion, the cue landing on the frame it matters, a marker on the body part,
one cue at a time, numbered like the app's key points) · WATCH FOR 16–22 s
(freeze, red ✕ on the fault, then the fix in green) · DRILL 22–28 s (real
speed, the Practice Round ring calling "20 slow, 20 fast") · NEXT UP 28–32 s
(the move ticked, the next named, OPEN PRACTICE MODE). Look: the app's
Practice screens (ground #0A0716, violet #B794FF, gold #F2BE45, red #EF4444,
green #4ADE80; Chakra Petch names and labels, Orbitron numbers and calls,
Barlow cues; gold clip-corner button; violet ring timer). Design canvas:
https://claude.ai/artifact/KMkYzevv2EQmgMD86tqiKx. Owner decisions pending:
voice (coach reads cues; announcer on DRILL), the in-app 16:9 cut, filming
one wrong rep per move. Footage: raw-footage/practice/p1–p7 (ring, 2026-10-31).
