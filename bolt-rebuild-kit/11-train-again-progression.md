# 11 · TRAIN AGAIN + last-time progression (WB-E)

> Two surfaces that make day 2 a one-tap experience and show progress on
> every row. Both REMOVE decisions — no new configuration inputs anywhere.
> The app already logs weight + reps of every completed set; these surfaces
> show that data back.
>
> Status: **SHIPPED** (app repo 854ea2f — builderProgression.js,
> FitBuilderSetup, FitBuilderWorkout, FitBuilderGuidedPlayer, weightLog).
> This file preserves the designer prompts delivered in chat 2026-08-19
> (the designer session's copy never landed on GitHub).

---

## PROMPT 1 — WB-E functionality (code)

Progression logic (drives every number):

* Athlete hit the top of the rep range on every set last time → nudge up:
  +1 rep (bodyweight), +2.5 lb (weighted).
* Missed reps anywhere → hold the same target.
* Brand-new exercise → no suggestion; the coach sets the pace.
* Suggested load beats their all-time best → flag it a PR attempt.

**1 · TRAIN AGAIN card** — top of the setup screen, above TARGET MUSCLES,
full column width, ≤150px tall (must not push TARGET MUSCLES fully below
the fold).

* Contents: eyebrow `⚡ TRAIN AGAIN · PROGRESSION APPLIED` · title = last
  workout's name (`UPPER BODY BODYWEIGHT`) · meta `2 days ago · 6 exercises
  · Chest, Back · Normal` · 2–3 progression chips (`▲ +1 REP × 4 MOVES`,
  `▲ +2.5 LB ARCHER ROWS` in gold; `= HOLD × 1` faint; an all-hold session
  shows one chip `STEADY — SAME TARGETS`) · round ▶ GO pill.
* Whole card tappable → goes STRAIGHT to the generated list with progression
  applied, skipping all config. Beneath it: quiet link "or build something
  new below ↓".
* State B (no history): card doesn't exist — setup renders exactly as today.
* State C (stale, >10 days): meta leads with `12 days ago — ease back in`;
  all chips = HOLD. Never red.

**2 · Last-time line** — every exercise row of the generated list gains a
third line (rows stay ≤ ~64px):

* Weighted nudge: `LAST 8·8·6 @ 25 LB` + gold chip `→ TRY 27.5`
* Bodyweight nudge: `LAST 8·8·8` + gold chip `→ TRY 9 REPS`
* Held: `LAST 6·5·5 @ 25 LB` + faint chip `= HOLD 25`
* PR attempt: gold-gradient chip `→ TRY 30 🏆 PR` (row border also gold)
* New exercise: no line; small faint `NEW` tag beside the name.
* List keeps `↻ REGENERATE` / `💾 SAVE ROUTINE` side-by-side, `▶ START` in
  flow below them. Every number must be plausible against the row's `4×4-8`
  prescription.

**3 · Get-ready load callout** (weighted first set) — the existing big gold
LOAD number + −/＋ steppers stays, but the suggestion is pre-loaded into it
(shows 30, not 27.5).

* Story line under the number: `LAST TIME 27.5 LB → SUGGESTED 30 ·
  pre-loaded above` (arrow + suggestion gold).
* PR attempts add a slim gold banner: `🏆 PR ATTEMPT — YOUR BEST IS 27.5`.
* `CHANGE WT` and `▶ START — LIFT` keep their exact positions.

Acceptance: A/B/C states render from history recency; tapping TRAIN AGAIN
lands on the generated list with zero config steps; held targets never
render red; new exercises show no numbers; the get-ready number equals the
suggested load.

## PROMPT 2 — WB-E design/visual spec

Style these surfaces to match the existing app exactly. Deep violet/black bg
(`#080012`–`#0a0014`), gold `#fde047` = progress/nudge/primary, violet
`#a855f7` = secondary chrome, red `#ef4444` reserved for warnings — never
for a held target (holding is normal, not failure). Orbitron display,
Rajdhani body, arcade-cabinet framing, 412×883, bottom tab bar. No new fonts
or colours. Gold = nudge, faint = hold — that two-tone rule carries the
meaning everywhere.

**TRAIN AGAIN card** (the one gold-accented element on setup; config
sections stay violet):

* Lean proportions: padding 9×12px, radius 14px (rounded like the other
  cards).
* Border: 1.5px violet `rgba(168,85,247,0.6)` with an inset gold ring
  (`inset 0 0 0 1px rgba(253,224,71,0.2)`).
* Fill: `linear-gradient(100deg, rgba(168,85,247,0.18),
  rgba(253,224,71,0.12) 65%)` — violet sweeping into gold.
* Glow: dual, violet + gold (`0 0 20px -6px rgba(168,85,247,.5),
  0 0 20px -8px rgba(253,224,71,.4)`).
* Eyebrow 7px Orbitron: `⚡ TRAIN AGAIN ·` in violet `#c9a6ff`,
  `PROGRESSION APPLIED` in gold.
* Title 12.5px white Orbitron, single line, ellipsized. Meta 8px Rajdhani
  `#c4a4d8`.
* Chips 6.5px Orbitron: nudges solid gold on dark text; holds transparent
  with faint white outline, `#9a90b8` text.
* GO pill: 46px circle, gradient mostly gold — `linear-gradient(135deg,
  #c9a6ff, #fde047 45%, #f59e0b)` (violet only a top-corner tint),
  gold-dominant glow, `▶ GO` in 11px dark Orbitron.
* Stale variant: identical card; the day-gap phrase in the meta renders
  gold (`12 days ago — ease back in`).

**Generated-list rows**: card `rgba(8,2,18,0.85)`, violet 1px border, radius
11px, padding 8×11px; letter chip 24px rounded-7px violet-tinted; name 10px
white Orbitron; prescription 8px `#9a90b8`; last-time line 8px `#c4a4d8`
with the chip inline (gold solid for TRY, faint outline for HOLD, gold
gradient + 🏆 for PR — PR rows upgrade their border to
`rgba(253,224,71,0.4)` and the letter chip to gold tint). NEW tag: 7px
Orbitron, faint white border, `#6d5a8f` text.

**Get-ready screen**: violet eyebrow `NEXT UP · SET 1 OF 4`, white exercise
name 22px, LOAD number 44px gold Orbitron with gold text-glow, 44px round
violet-outline steppers either side; story line 9.5px Rajdhani with LAST
TIME value in white and `→ SUGGESTED 30` in gold weight-800; PR banner
full-width, `linear-gradient(90deg, rgba(253,224,71,0.16),
rgba(245,158,11,0.12))`, 1px gold border at 55%, radius 10px, single 9px
gold Orbitron line. Buttons: CHANGE WT 124px violet-outline, START — LIFT
flex-fill gold gradient with gold glow.

---

## Implementation notes (as shipped)

* `data/builderProgression.js` — `recordBuilderWorkout` (writes
  `tm_last_builder_workout` only once ≥1 exercise is completed, so an
  untouched generate never clobbers real history), `rowProgression`
  (per-row verdict: new / nudge / hold, PR flag, LAST line), and
  `trainAgainPlan` (nudges baked into the rows: bumped reps, suggested
  loads pre-set so get-ready and the rest logger pre-fill them).
* Weighted increment is `stepFor(unit)/2` → +2.5 lb / +1.25 kg.
* `weightLog.getWeightHistory()` powers per-set `LAST 8·8·6` lines and the
  all-time best behind PR attempts.
* Verified live: state B untouched setup + NEW tags → one completed
  exercise → state A card (`▲ +1 REP × 1 MOVE` / `= HOLD × 5`) → GO lands
  on the list with `4x5-9`, `LAST 8·8·8·8 → TRY 9 REPS`, holds elsewhere.
