# Paste-ready build prompts — items 9, 10, 11 (Ghost Battle), 14

One prompt per item. Paste the whole block into the Training Mode revamp code
agent. Each prompt is self-contained: it names the real files, the real
exported functions, and the real art paths that already exist in this repo.

Build rules that apply to every prompt (already true elsewhere in the app):
Orbitron/Rajdhani, gold `#fde047`, violet `#a855f7`, danger red; reuse existing
shared components (VoiceMixer, confirm-modal, ring timers, PrimaryButton /
SecondaryButton / Card); no new design system.

---

## PROMPT 9 — Universal outcome screens (pass / partial / fail / validation-fail)

> Training Mode already has four beautiful outcome screens, but only Training
> Arcade uses them. Make them universal.
>
> **What exists today**
> - `components/training-mode/ArcadeStageClearOverlay.jsx` contains four
>   screens: `StageClearedScreen`, `PartialCompletionScreen`,
>   `MissionFailedScreen`, `ValidationFailedScreen`.
> - Their art is already shipped:
>   `/static/arcade/stage-complete.webp`, `/static/arcade/partial-complete.webp`,
>   `/static/arcade/mission-failure.webp`, `/static/arcade/validation-fail.webp`.
> - Training Camp instead uses `components/training-mode/shared/MissionComplete.jsx`,
>   which only knows `success | partial` — no fail, no validation-fail — and it
>   never asks the engine what actually happened.
> - The engine already resolves the outcome:
>   `evaluate(result, difficulty)` exported from
>   `components/training-mode/protocol/content.ts` (wraps `evaluateSession`
>   against `pass-rules.json`) returns pass / partial / fail / validation_failed.
>
> **9a. Extract into one shared component**
> Create `components/training-mode/shared/SessionOutcome.jsx`. Move the four
> screens' markup and styling in as-is — same art, same layout, no restyle.
> Mode-agnostic props:
> ```
> { outcome,            // 'pass' | 'partial' | 'fail' | 'validation_failed'
>   title, subtitle,
>   stats,              // [{ label, value }]
>   xpEarned,
>   stars,              // optional 0-3
>   onRetry, onExit }
> ```
> Then make `ArcadeStageClearOverlay.jsx` render `SessionOutcome` instead of its
> own four copies. Arcade must look and behave exactly as it does now — this
> step is a pure refactor with zero visual diff.
>
> **9b. Route Training Camp through it**
> In the camp session end path (`CampFullSession.jsx` / `CampFitSetRunner.jsx` /
> `CampFitRunner.jsx`), build the `SessionResult` the engine expects, call
> `evaluate(result, difficulty)`, and render `SessionOutcome` with the returned
> outcome. Feed the resulting outcome into `campSessionXp({ ..., outcome })`
> (already accepts an outcome override) so XP matches the verdict — do not
> re-derive the outcome in the component. Keep the anti-cheat gate:
> `utils/missionIntegrity.js` failing still means `validation_failed` and 0 XP.
> `shared/MissionComplete.jsx` becomes unused by camp; delete it only if nothing
> else imports it.
>
> **9c. Then Quick Mission and Combat Conditioning** — same treatment, so every
> mode in the app ends on the same four screens.
>
> Do not invent new art or new copy tones. Do not change `pass-rules.json`.

---

## PROMPT 10 — Achievements → Progress tab

> Training Mode has a full achievements dataset that nothing reads. Wire it up.
>
> **What exists today**
> - `components/training-mode/protocol/data/achievements.json` — 9 achievement
>   families.
> - Every Arcade campaign JSON has its own `campaign.achievements[]` with an id,
>   name, and trigger text (Baki has 8, Garou 12) under
>   `components/training-mode/protocol/campaigns/`.
> - `ProgressScreen.jsx` exists but has no achievements section.
> - `data/userStats.js` is the established localStorage persistence pattern —
>   follow it exactly.
>
> **10a. Store** — create `components/training-mode/data/achievements.js`:
> load the 9 families plus every campaign's `achievements[]`, persist earned ids
> + earned timestamps to localStorage, and export
> `earned()`, `award(id)`, `progressFor(family)`, `allAchievements()`.
> `award()` must be idempotent and return whether this call was the first unlock
> (so the caller can show a toast exactly once).
>
> **10b. Triggers** — award on events the app already fires, not new ones:
> session complete, stage clear (`arcadeCampaignProgress.js`), streak milestones
> (`userStats.js`), ghost victory (`ghostBattles.js` → `finishGhostBattle`),
> campaign clear. When `award()` reports a first unlock, show a compact unlock
> toast over the outcome screen from item 9 — badge + name + one line.
>
> **10c. Progress tab section** — add an achievements grid to
> `ProgressScreen.jsx`: earned = full-colour badge, locked = silhouette with the
> unlock condition in text. Group by family, campaign achievements grouped under
> their campaign name. Show `earned / total` at the top of the section.
>
> Badge art does not exist yet — until it does, render a themed placeholder
> (family glyph on the existing card style) rather than blocking on assets.

---

## PROMPT 11 — Ghost Battles: the VS experience

> The ghost battle engine, data layer, and art are all finished. The screens are
> the only thing missing — build them.
>
> **What exists today**
> - `components/training-mode/protocol/ghost-engine.ts` — `makeGhost`,
>   `ghostCountAtTime` (the live race math), `resolveGhostBattle`,
>   `battleHeadline` (already returns strings like
>   `"▲ 26s FASTER · GHOST DEFEATED"`).
> - `components/training-mode/data/ghostBattles.js` — `getMyBestGhost`,
>   `getRecentGhosts`, `recordGhostFromSession`, `exportGhostCode`,
>   `importGhostCode`, `finishGhostBattle`, `getLastBattle`.
> - Recording is already live inside `FightFocusTimer.jsx` (strike timestamps,
>   per-round totals).
> - **Art already shipped:** `/static/ghost/vs-{male,female}-{1,2,3}.webp` —
>   gender variant × 3 rotating poses.
> - `shared/GhostButton.jsx` is a plain button, not ghost UI.
> - Challenge-code UI already exists: `shared/ChallengeShareModal.jsx`,
>   `shared/CodeEntryModal.jsx`, `shared/ChallengeInboundModal.jsx`.
>
> **11a. VS pre-fight screen** (`shared/GhostVsScreen.jsx`)
> Full-bleed art picked by the user's gender setting, rotating the 1/2/3 variant
> per battle so it doesn't repeat back-to-back. Split layout: YOU (name, best
> stats) vs GHOST (source label — "Your best" / "Challenge code" / a friend's
> name — strikes, time, stage, difficulty). Bottom: ACCEPT · VS · BACK.
>
> **11b. Live race HUD**
> During a ghost battle round, render a split bar in `FightFocusTimer.jsx`
> showing your live strike count against `ghostCountAtTime(ghost, elapsedSec)`.
> Ahead = gold and pulling right, behind = red. Reuse `shared/StrikeHud.jsx` /
> `shared/BattleHUD.jsx` rather than forking a third HUD. Keep it quiet — a thin
> bar plus the delta number, never covering the combo callout line.
>
> **11c. Result screen** (`shared/GhostResultScreen.jsx`)
> Victory / defeat / draw using `finishGhostBattle` + `battleHeadline` for the
> headline. Show the per-round comparison, the delta, and REMATCH ·
> CHALLENGE A FRIEND (opens the existing `ChallengeShareModal`) · DONE.
>
> **11d. Share card**
> Render the result as an image through the existing share infra
> (`CompletedWorkoutShareCard` / `ShareActions`) — ghost art background,
> headline, both stat columns, Training Mode mark.
>
> Entry points: a GHOST BATTLE action on the Fight Focus setup screen and on the
> post-session outcome screen ("Beat this run"). Do not change the engine or the
> recording logic — it already works.

---

## PROMPT 14 — Camp setup flow: archetype picker

> Training Camp has 12 fighter archetypes in the content layer that the user can
> never choose. Build the picker.
>
> **What exists today**
> - `components/training-mode/protocol/data/archetypes.json` — 12 archetypes,
>   each `{ id, discipline, name, tagline, variants: { easy, normal, hard } }`
>   (pressure_dog, slick_counter_boxer, twelve_round_finisher,
>   dutch_volume_pressure, …).
> - `archetypesFor(discipline)` is already exported from
>   `components/training-mode/protocol/content.ts`.
> - The only mention of "archetype" in the app is a label inside
>   `TrainingCampMap.jsx`. There is no picker.
> - Discipline art and the difficulty selector already exist
>   (`ArcadeDifficultySelector.jsx` is the styling reference).
>
> **14a. DISCIPLINE → ARCHETYPE → DIFFICULTY flow**
> A three-step setup before a camp level starts, using the existing
> `shared/Stepper.jsx`:
> 1. **Discipline** — existing discipline cards + art.
> 2. **Archetype** — cards from `archetypesFor(discipline)`: name, tagline, and
>    the blurb for the currently-selected difficulty (or normal before one is
>    picked). Selected card gets the gold border treatment.
> 3. **Difficulty** — easy / normal / hard; each option shows that archetype's
>    `variants[difficulty]` string so the choice is concrete.
>
> Persist the choice per camp level (same pattern as `campProgress.js`) and
> pass it into the existing camp engine — this is a selection screen over
> content that already exists, so **no new workout content and no engine
> changes**. Back navigation between steps must never dead-end.
