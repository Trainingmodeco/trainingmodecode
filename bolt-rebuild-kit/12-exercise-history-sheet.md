# 12 · Exercise History sheet (WB-F)

> One display-only surface: tap an exercise's last-time line to open an
> EXERCISE HISTORY bottom sheet. The app already records every saved set
> (weight · reps · date) — show it back; no new inputs.
>
> Status: **SHIPPED** to the app repo. This file preserves the designer
> prompt delivered in chat 2026-08-19 (design refs 55a–55d in the designer
> canvas; the designer session's own save never landed on GitHub).

## PROMPT — Exercise History sheet (code)

Palette: sheet `rgba(14,5,26,0.97)`, gold `#fde047` = progress/PR only,
violet `#a855f7` chrome; Orbitron display, Rajdhani body; the sheet fully
covers the tab bar.

**Entry points** (same sheet): the `LAST 8·8·6 @ 25 LB` line on
generated-list rows and the `LAST TIME 25 LB → SUGGESTED 27.5` line on the
weighted get-ready screen. Affordance is subtle — faint dotted underline +
tiny `⟩`, no buttons.

**Sheet**: grab handle + ✕; header = exercise name (white Orbitron,
ellipsized) · muscle tag · gold pill `🏆 BEST 52.5 LB` (bodyweight:
`🏆 BEST 12 REPS`).

**Trend chart (hero)**: last 8 sessions — one gold dot per session joined by
a thin gold line over a faint violet dot-grid; Y = top working weight
(bodyweight: top reps). PR sessions get a bigger, glowing dot. No axis
clutter: only first/last date labels and a faint gold dashed line at the
BEST value. Glanceable in one second, no legend.

**Session list**: newest first, ~44px rows (`AUG 15 · 8·8·8 @ 52.5 LB`),
solid-gold `PR` tag on record days, faint dividers, scrolls inside the
sheet.

**Four states**:
- rich history (6+ sessions, PR mid-run)
- single session (one glowing dot + "one more session unlocks the trend";
  first log is always a PR)
- bodyweight (reps trend, no LB)
- empty (NEW tag, 📜 "Your first session writes the first line.")

**Rules**: numbers plausible against 4×4-8 and 2.5 lb steps; steady is
neutral, never red; layout stays stable across states.

## Design states (turn 55, designer canvas)

- **55a Weighted, rich** — shown in context: the dimmed list row behind
  carries the entry affordance (faint dotted underline + ⟩ on
  `LAST 8·8·6 @ 25 LB`, no button). Sheet: ARCHER ROWS + muscle tag + gold
  🏆 BEST 52.5 LB pill; the hero trend — 8 gold dots joined by a thin gold
  line on a faint violet dot-grid, two glowing PR dots, dashed BEST line,
  just JUN 30 / AUG 15 date labels; session list newest-first with PR tags,
  scrolling inside the sheet.
- **55b Single session** — chart area holds a single glowing dot + "one
  more session unlocks the trend"; the one session row (first log = PR).
- **55c Bodyweight** — same sheet with a reps trend (BEST 12), sessions as
  `12·11·10`.
- **55d Empty** — NEW-tagged exercise, 📜 "Your first session writes the
  first line."

## Implementation notes (as shipped)

- Bodyweight exercises never wrote to the weight log (it was
  weighted-only), so the reps trend had no data source. The guided player
  now logs completed bodyweight exercises too (`logBodyweightSets` —
  weight 0 marks a bodyweight entry), building the trend going forward.
- PR = a session's top value beats every prior session; the first session
  is always a PR.
- Chart renders as inline SVG (dot grid, polyline, dashed BEST line) — no
  chart library.
