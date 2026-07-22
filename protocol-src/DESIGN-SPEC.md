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

## S1 · Training Camp map

Tree-ladder of 12 session nodes over the existing splash/app background
(no new bg art). Single trunk climbing bottom → top, boss node last.
- Phase group labels along the ladder: FOUNDATION (1–3) → DEVELOPMENT
  (4–6) → HARD CAMP (7–9) → TAPER (10–11) → FINAL BOSS (12).
- Node = existing arcade stage badge art + code-drawn state ring:
  done (green ring + ✓) · current (gold ring + glow + "UP NEXT ▸") ·
  locked (greyscale 45% + 🔒). Node 12 uses the new Title Fight boss badge,
  larger, gold/red glow.
- Header: discipline + archetype name + difficulty chip (e.g. "BOXING ·
  SLICK COUNTER BOXER · NORMAL"), camp progress "n/12".
- Tapping a node opens the Session Card: session name, contents list built
  from its blocks (e.g. "🥊 3 RDS FIGHT FOCUS · 🎯 2 COMBO SETS"), est.
  time, +XP chip, gold ▶ START. Split-capable levels (4–11) show the AM/PM
  chips here (see S5).

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

On the session card and camp map: two mission chips —
🌅 MORNING MISSION (fit block) and 🌙 EVENING MISSION (fight block) —
each with its own done ✓ / pending state. Hint line: "Leave 4–8 hours
between missions." Before the PM mission, a 4-question mini-check (eaten/
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

NEW, needed now (3):
- [ ] Title Fight boss node badge (square, matches s1–s10 badge family)
- [ ] TITLE FIGHT WON victory art (portrait, no text)
- [ ] Camp Champion belt trophy (or map an existing belt trophy)

REUSE: splash/app bg (map), s1–s10 stage badges (nodes), discipline art
(headers), ring timers, trophy frame style.

LATER (Reaction Mode / Ghost Battles phase): placement-hint illustration,
4 opponent portraits, KO splash, ghost share-card background, 3 remaining
trophy images, optional 12 archetype card icons.
