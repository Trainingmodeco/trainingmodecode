# PROTOCOL-SRC · Integration Guide

Real code + content for the Training Camp / Training Arcade protocol v2
(specs: `specs/10-training-camp-protocol.md` and
`specs/11-training-arcade-protocol.md`). Everything here is
framework-free: JSON content + one pure TypeScript engine file.

```
protocol-src/
├── INTEGRATION.md            ← you are here
├── specs/                    protocol v2 spec docs (camp + arcade)
├── data/
│   ├── disciplines.json          4 disciplines + timing anchors + art paths
│   ├── archetypes.json           12 archetypes × easy/normal/hard variants
│   ├── camp-levels.json          12 levels: phases, emphases, taper rules
│   ├── timing-tables.json        round templates by discipline/band/difficulty
│   ├── equipment.json            items, icons, substitutions, minimum-viable rule
│   ├── xp-rules.json             XP formula constants
│   ├── achievements.json         9 achievement families
│   ├── readiness.json            PAR-Q+ gate, daily check, split-day check
│   ├── pass-rules.json           pass thresholds + 4 fail types
│   ├── ui-copy.json              labels, warnings, phase names
│   ├── stage-catalog.sample.json    2 example arcade stages
│   └── workout-modules.sample.json  5 example workout modules
├── schemas/
│   ├── stage.schema.json         validates stage-catalog entries
│   └── workout-module.schema.json validates workout modules
└── engine/
    └── training-engine.ts        pure functions: timing, evaluation, XP, readiness
```

## For Claude Code (or Bolt) — the integration prompt

Paste this into the coding agent working on the app:

> Integrate the `protocol-src/` folder into the app as the training content
> engine:
> 1. Copy `protocol-src/data/*.json` into the app's `src/content/` and
>    `protocol-src/engine/training-engine.ts` into `src/engine/`.
> 2. All camp/arcade session screens must derive their timers from
>    `resolveRoundTemplate(discipline, level, difficulty, timingTables,
>    campLevels)` — never hardcode round counts or lengths in components.
> 3. Wire session completion through `evaluateSession(result, difficulty,
>    passRules)` and grant XP via `calcXp(...)` with `XP_STANDARD` from
>    `xp-rules.json`. Map `Evaluation.outcome` onto the existing outcome
>    screens (pass → Stage Cleared / Mission Complete, partial → Partial
>    Completion, fail → Mission Failed with the failType's `response` line,
>    validation_failed → Validation Failed).
> 4. Run `assessReadiness(answers)` before every camp session; "halt" shows
>    the stop-training advisory, "suggest_easy_or_recovery" offers the Easy
>    variant or recovery session (completing it keeps the streak).
> 5. Build the discipline → archetype → difficulty picker from
>    `archetypes.json` (`getArchetypes(archetypes, discipline)`), the camp
>    map phases from `camp-levels.json`, and the equipment chips +
>    substitution behavior from `equipment.json`.
> 6. Arcade stages load from the stage catalog (see
>    `stage-catalog.sample.json` for the shape; validate against
>    `schemas/stage.schema.json`). A stage's fight path references the camp
>    engine by discipline + archetype + level_reference — resolve it through
>    the same functions as Training Camp.
> 7. All UI strings for paths/formats/difficulties/warnings come from
>    `ui-copy.json`. Do not inline-copy them into components.
> 8. Treat every file in `data/` as editable content: adding a campaign,
>    archetype, or module must require zero component changes.

## For the designer — screens this adds

New UI to design (all in the existing design system — Orbitron/Rajdhani,
gold/violet on near-black; art-asset generation prompts live on the `main`
branch in `bolt-rebuild-kit/prompts/05e-fight-mode-design-prompts.md`):
1. **Archetype picker** — 3 cards per discipline: name, tagline, and the
   selected difficulty's variant description (content in
   `archetypes.json`).
2. **Stage selection screen** — header / path / format / difficulty /
   equipment chips / warnings / live preview blocks (layout spec in
   `specs/11-training-arcade-protocol.md` Prompt 2).
3. **Readiness check sheet** — five 1–5 tap rows + one danger-symptom
   question; a calm "easier session still counts" state, and a clear
   stop-training state (content in `readiness.json`).
4. **Split day card** — AM / PM mission chips with independent completion
   states and the 4–8 h gap hint.

## Notes

- Sample campaign IDs use original names (`ARC_NIGHTGUARD`, `ARC_ENDLESS`)
  — keep arcade campaign names/visuals original, not trademarked IP.
- The engine enforces the balancing rule in code: completion multipliers
  make a clean Easy pass always outscore a repeated Hard fail.
- `timing-tables.json` levels 10–11 are resolved from the level-9 band with
  the taper reduction applied to round count — round length is preserved,
  matching taper best practice.
