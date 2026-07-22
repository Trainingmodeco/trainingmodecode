# FIGHT MODE / PROTOCOL v2 — DESIGN SPEC (for the designer)

Screen-by-screen design spec for the Training Camp + Training Arcade v2
revamp. Hand this file to the designer (or paste sections into Claude
designer one screen at a time). All copy shown here is sourced from the
JSON in `protocol-src/data/` — design the containers, don't invent copy.

## Design tokens (non-negotiable, match the live app)

- Background near-black violet `#080012`; cards `rgba(8,2,18,0.8)` with 1px
  `rgba(168,85,247,0.25)` border, 11–14px radius
- Gold `#fde047` = CTAs, selection, XP · Violet `#a855f7` = secondary
  accent, defense/ghost · Red `#ef4444` = danger/fight · Green `#22c55e` =
  success · Teal/green tint = warm-up state
- Orbitron 700/900 uppercase for headers/numbers/buttons; Rajdhani 500–700
  for body
- Reuse the existing ring timers and Mission Complete flow — never fork a
  new version of a screen that already exists. Text is overlaid in-app,
  never baked into images.

---

## S1 · Training Camp ladder + level modal (design 45a / 45b)

Rebuilt entirely in UI — a neon "spine" ladder drawn in CSS/SVG over the
existing dark app backdrop (reuse FightRingBackdrop; NO new bespoke map
art). Replaces the old badge-tree concept.

### 45a · Camp ladder (`tap a level →` opens 45b)

- Layout: one vertical neon spine climbing bottom → top — node 01 at the
  bottom, node 12 (Title Fight) at the top. The spine is a 2–3px gradient
  rail (violet `#a855f7` → gold near the current node) with a soft glow;
  segments below the current node read brighter (cleared), segments above
  dim to ~35% (locked).
- Header (fixed, top): `TRAINING CAMP · {DISCIPLINE}` (Orbitron 900, gold)
  over a status line `Level {n} of 12 · {PHASE} · {progress}`, where
  progress = "Round r of R" on single-session foundation levels or
  "Session s of 2" on split levels.
- Node = a code-drawn circle showing the zero-padded level number
  (`01`…`12`), NOT badge art:
  · complete → green ring `#22c55e` + ✓, number dimmed
  · current → gold ring `#fde047` + glow + a `you are here` caption beneath
  · locked → greyscale ~45% + number; node 12 also shows 🔒
  Node 12 (Title Fight) is larger with 🏆 and a gold/red glow.
- Level label sits to the left of each node: `{PHASE} · {TITLE}` (Orbitron,
  phase-tinted). Titles are NEW copy — add a `title` per level to
  `camp-levels.json`:
  FOUNDATION → L1 BASICS · L2 RHYTHM · L3 FINISHER; DEVELOPMENT → L4 BASE ·
  L5 VOLUME · L6 POWER; HARD CAMP → L7 ENGINE · L8 GRIND · L9 PEAK; TAPER →
  L10 SPEED · L11 SHARPEN; FINAL BOSS → L12 TITLE FIGHT ("final test · the
  belt").
- Session pips: from DEVELOPMENT (L4) up, each node carries two small pips —
  `S1` (AM) and `S2` (PM) — with per-session state (done ✓ / up-next ▸ /
  pending). Foundation levels (L1–3) are single-session; the current one
  shows round pips instead (e.g. `R1✓ R2▸`). The boss (L12) shows none.
- Phase color key (spine + labels + pips), matching the in-app PHASE_ACCENT:
  FOUNDATION teal-green, DEVELOPMENT violet, HARD CAMP red, TAPER teal,
  FINAL BOSS gold.
- Tap any unlocked node → Level modal (45b). Locked nodes are inert (small
  "clears L{n−1} first" tip is fine).

### 45b · Level modal (routines · time · gear)

Bottom-anchored modal over the dimmed ladder.
- Header: level-number circle (state-colored) + `{PHASE} · {TITLE}` +
  subtitle `{n} sessions · {AM/PM split | single session} · unlocks
  L{n+1}` + close ✕.
- Stat tiles (3, existing card style): `~{total} MIN / TOTAL TIME` ·
  `+{xp} XP` (gold) · `GEAR` (equipment icon chips). Total time + XP are
  engine-derived — sum the level's modules; XP via `xpFor`.
- Session cards (one per session; single-session levels show one):
  · Header row: `S{k} · {AM|PM} — {SKILL|CONDITIONING}` + a state pill
    (`✓ COMPLETE` green / `▶ UP NEXT` gold / pending).
  · Contents line: the module's block summary (e.g. "Combo ladder 4 rounds ·
    footwork drill · shadowbox finisher") — from `workout-modules.json` block
    goals, never invented.
  · Meta line: `⏱ {min} min · {gear icons + labels} · {done-time when
    complete}`.
- Rule line (muted): "Level clears when both sessions are complete ✓✓ —
  then L{n+1} unlocks." (single-session: "Complete this session to clear
  the level.")
- Primary CTA (gold): `▶ START SESSION {next incomplete}` (or `▶ START` on
  single-session) → runs the S4 readiness check first.

⚠ OPEN (needs your call): the mockup labels S1/AM = SKILL (combat) and
S2/PM = CONDITIONING (physical); spec 10 Prompt 5 has it the other way
(AM = physical prep, PM = combat work). Pick one so split content is
consistent — 45b above is written as the mockup shows.

Content this design adds: `title` per level in `camp-levels.json`; real
per-session blocks + `gear` + `duration_min` in `workout-modules.json` so
45b renders from data. The in-app `TrainingCampMap.jsx` v0 (plain stacked
list) is the scaffold 45a/45b replaces.

## S2 · Archetype picker (new screen)

Appears after discipline select, before difficulty.
- 3 tall cards per discipline (vertical stack or swipe row): archetype
  NAME (Orbitron), tagline (e.g. "Relentless forward pressure"), and the
  currently-selected difficulty's variant description underneath.
- Selected card: gold border + glow; unselected: standard card style.
- Copy source: `data/archetypes.json` (12 archetypes × 3 variants).
- Optional art slot per card (silhouette/icon) — not required for v1;
  cards work text-only in the existing style.

## S3 · Camp setup order

Setup form, top to bottom: WARM-UP (− / + stepper with tappable numeric
keypad value, 0 = off — SAME control style as rounds/rest) → ROUNDS →
ROUND LENGTH → REST → difficulty already chosen upstream. Round values are
engine-derived defaults the user can view but not contradict (camp
sessions prescribe; free sessions configure).

## S4 · Readiness check sheet (new, before every camp session)

Compact bottom sheet, calm not clinical:
- Five 1–5 tap rows: SLEEP · FATIGUE · SORENESS · STRESS · MOOD (5 dots
  per row, gold fill on tap).
- One danger question with a distinct visual weight (red-tinted row):
  "Any dizziness, chest symptoms, sharp pain, concussion symptoms, or new
  injury?" YES/NO.
- Three result states:
  · GO — sheet dismisses into the session.
  · LOW READINESS — soft violet state: "Feeling rough today? An easier
    session still counts." with EASY VARIANT and RECOVERY SESSION options
    (both keep the streak).
  · HALT (danger = yes) — red state, clear stop-training advisory, no
    session start, explicitly no penalty messaging.
- Copy source: `data/readiness.json`.

## S5 · Split day card (levels 4–11)

NOTE: the AM/PM split now lives inside the Level modal (45b) as the two
session cards (S1 AM / S2 PM), each with its own state pill. This section
covers only the extra split-specific behaviour layered on top.
- Hint line under the two session cards: "Leave 4–8 hours between missions." Before the PM mission, a 4-question mini-check (eaten/
hydrated · heavy or slow · AM effort ok · pain) using the S4 sheet style;
bad answers offer "move PM to tomorrow" or Easy variant, copy never shames.
FULL CAMP alternative shows one chip with the internal sequence: warm-up →
fit → transition (8–15 min) → fight → cooldown.

## S6 · Arcade stage selection screen

Stacked blocks, existing card style:
1. HEADER — stage number + title, phase chip, est. duration, active time,
   +XP, achievement badge preview.
2. PATH row — FIT · FIGHT · FULL ARC pills (only available paths render).
3. FORMAT row (Full Arc only) — SPLIT CAMP · FULL CAMP SESSION.
4. DIFFICULTY row — EASY · NORMAL · HARD; Full Arc shows two rows (FIT
   DIFFICULTY / FIGHT DIFFICULTY).
5. EQUIPMENT row — icon chips (🧍 ⏱ 💧 🪢 🧤 🥊 🏋 🧵 🧘): required =
   solid, recommended = dimmed; a missing required item swaps in the
   substitution notice chip.
6. WARNINGS — small muted lines from `data/ui-copy.json` (no bag /
   hard mode / stop-training).
7. PREVIEW — round count, lengths, rests, target RPE, skill theme,
   substitutions; re-renders live when any selector changes.
8. Gold ▶ START (triggers S4 readiness first).

## S7 · Session runner transition card

Between blocks in multi-block sessions: full-screen ~3s interstitial —
"NEXT UP" label, block name large (Orbitron), block icon, round count ·
duration line, thin auto-advance progress bar. Matches existing rest-state
visual language (blue/violet tint).

## S8 · Outcome states

Reuse the four existing outcome screens; protocol v2 adds the failure
*reason line* under the header, from `data/pass-rules.json` responses:
- Conditioning fail → retry-modified option emphasized.
- Technical fail → "DRILL IT IN PRACTICE MODE" secondary CTA.
- Tactical fail → "RUN IT BACK" (repeat same mission) primary.
- Safety halt → calm recovery note, no retry pressure, no red shame UI.
- TITLE FIGHT WON — the one new outcome screen: full-page gold/red radial
  burst, belt art, camp trophy reveal, stats row, share.

## S9 · Existing components to reuse as-is

Ring timers (fight/combo/conditioning), VoiceMixer speaker overlay,
AudioLevelRow, Mission Complete + share flow, trophy grid, streak/XP bars.

---

## Asset checklist (image generation prompts live on `main`:
## bolt-rebuild-kit/prompts/05e-fight-mode-design-prompts.md)

NEW, needed now (2 — the ladder nodes are CSS-drawn per 45a, so no
per-node badge art is required):
- [ ] TITLE FIGHT WON victory art (portrait, no text)
- [ ] Camp Champion belt trophy (or map an existing belt trophy)
Optional: a 🏆 boss glyph/badge for node 12 if the emoji isn't enough.

REUSE: dark app backdrop / FightRingBackdrop (behind the CSS spine),
discipline art (headers), ring timers, trophy frame style. Ladder nodes,
spine, pips, and state rings are all code-drawn — no image assets.

LATER (Reaction Mode / Ghost Battles phase): placement-hint illustration,
4 opponent portraits, KO splash, ghost share-card background, 3 remaining
trophy images, optional 12 archetype card icons.
