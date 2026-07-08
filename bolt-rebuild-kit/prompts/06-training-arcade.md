# 06 · TRAINING ARCADE (series · stage map · live · outcomes)

--- PROMPT 1: Series list + stage map ---

TRAINING ARCADE: anime-style workout "protocols" (series) → each is a ladder of timed stages.
- Series list: banner rows (wide 4:1 series art /assets/series/...), name, difficulty ★, stages cleared n/10, locked series greyed with 🔒.
- Stage map (per series): 3-col grid of the mini stage badges /assets/stages/s1.webp … s10.webp shown FULL (object-fit: contain, no crop, no dark overlay covering the art — the badge art already contains the stage number). State ring per cell: green border + ✅ cleared, gold border + glow + "CURRENT ▸" caption for active, greyscale+dim + 🔒 locked, 👑 for boss stages.
- Stage detail card: mini badge (56px, contain) left; "STAGE n · NAME" gold + "+XP" chip right; requirement line (e.g. "100 push-ups · 100 squats · cadence-paced. Beat the clock."); TARGET TIME row; gold "▶ START STAGE n".

--- PROMPT 2: Live stage + outcome states ---

Live stage: countdown vs target time, exercise call-outs with rep checkpoints, elapsed vs target bar.
Four outcome screens (full-page, radial glow matching the outcome color, art from /assets/arcade/):
1. STAGE CLEARED (green) — /assets/arcade/stage-complete.webp art, stage name, stats row (YOUR TIME / +XP / ★ rating), "UP NEXT · UNLOCKED" teaser row with the next stage's 44px mini badge, "▶ START STAGE n+1" + share/back.
2. MISSION FAILED (red) — /assets/arcade/mission-failure.webp, "you didn't beat the stage timer", comparison card YOUR TIME vs TARGET vs MISSED BY, ↻ RETRY / back to map.
3. VALIDATION FAILED (yellow, anti-cheat) — /assets/arcade/validation-fail.webp, "your run couldn't be verified", FLAGGED SIGNALS list (⚠ reps faster than physically possible · ⚠ little/no device motion during work · ⚠ timer skipped, no rest logged), "↻ REDO — FOR REAL THIS TIME" + "WHY WE VERIFY →".
4. PARTIAL COMPLETION (violet) — /assets/arcade/partial-complete.webp, "you finished most of the stage", stats row (+partial XP / % complete / next stage 🔒), "↻ FINISH THE STAGE" / save & exit.

BEHAVIOR: clearing unlocks the next stage; partial grants reduced XP but no unlock; validation failure grants nothing and requires a redo. Outcome chosen by the anti-cheat evaluation in 09-anti-cheat-protocols.md.

--- END ---
