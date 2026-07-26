# Paste-ready build prompts

One prompt per item. Paste the whole block into the Training Mode revamp code
agent. Each prompt is self-contained: it names the real files, the real
exported functions, and the real art paths that already exist in this repo.

Build rules that apply to every prompt (already true elsewhere in the app):
Orbitron/Rajdhani, gold `#fde047`, violet `#a855f7`, danger red; reuse existing
shared components (VoiceMixer, confirm-modal, ring timers, PrimaryButton /
SecondaryButton / Card); no new design system.

---

## PROMPT 0 — pull the Grappler (Baki) content update into the revamp

> Pull the latest `app` branch. The Grappler campaign (`ARC_BAKI`) has been
> reviewed stage-by-stage, fixed, and **restructured from 12 stages to 10**.
> Everything is already in the app mirror at `components/training-mode/protocol/`
> — you do not need to author content, just make sure the player renders it.
>
> **What changed**
>
> 1. **Baki is now a 10-stage campaign.** The Arcade caps campaigns at 10
>    (`ARCADE_MAX_STAGES` in `data/arcadeCampaignSeries.js`) and was silently
>    dropping the old S10 and S11 — which were the two T4 ramp stages — so the
>    curve went from T3 straight into the boss and two authored stages were
>    unreachable. The old S10 "Arena's Strongest" folded into **S08 (Jack)**,
>    the old S11 "Strongest Teen" folded into **S09 (Pickle)**, and the Ogre
>    moved from S12 to **S10**. `capToArcadeLength` now passes Baki through
>    untouched. Module ids `MOD_BH_S12_*` are now `MOD_BH_S10_*`; stage id
>    `ARC_BAKI_STG12` is now `ARC_BAKI_STG10`. **Saved Baki progress from
>    before this change will not line up — clear it or migrate it.**
> 2. **Tier ladder re-cut** to T1 S1–3, T2 S4–5, T3 S6–7, T4 S8–10, so the back
>    half carries the T4 volume. `stage_count`, `split_stages`,
>    `double_training_stages`, `peak_stage`, `final_boss.stage_id`, the persona
>    progression and the achievement triggers all follow.
> 3. **Stage 4 (One-Punch Power)** was five rounds of nothing but the cross.
>    R1 and R4 stay pure `complexity: "single"` (the one-perfect-straight drill);
>    R2, R3 and R5 now carry `allowed_strikes: ["1","2","2b"]` at intro/basic so
>    the generator sets the straight up instead of repeating it.
> 4. **Mixed rounds.** A grappling round can now set `mixed_with_cue: true`
>    alongside `generate_combos: true` — it generates combos AND keeps its
>    `technique_cues`. Three rounds use it: S06 R1 (`strike_entry_into_clinch`),
>    S07 R5 (`strike_entry_into_submission_chain`), S08 R6
>    (`all_around_every_tool`). Before this, S06 and S07 ran ten consecutive
>    rounds with no combos called at all.
> 5. **Every fight module now carries a `tier`**, matching the fit modules —
>    across all campaigns, not just Baki.
>
> **Code already updated for you (verify, don't rewrite)**
> - `protocol/engine/arcade-session-engine.ts` — `ComboSpec.mixed_with_cue`,
>   `ComboParams.mixedWithCue`. `mode` is still `"generate"` for mixed rounds,
>   so no existing consumer changes behaviour.
> - `protocol/campaigns.ts` — `buildComboCalls` interleaves when
>   `p.mixedWithCue`: two generated calls, then one technique cue, repeating.
>
> **What to verify in the running app**
> - Baki shows **10 stages**, the Ogre sits at position 10, and the map no
>   longer truncates. 20 modules, 41 generated / 19 cue-based fight rounds.
> - S08 and S09 read as peak stages: S08 keeps the weighted compounds (timed
>   with adaptive rest) and gains a dips block plus a 6th "every tool" mixed
>   round; S09 is 8 exercises and 7 rounds.
> - Stage 4 FIGHT: R1 and R4 still call one strike and nothing else. The 60/40
>   variety rule exempts `single`, so they must NOT gain secondary strikes.
> - S06 R1, S07 R5, S08 R6: the voice alternates generated combos with the
>   grappling cue. The other rounds in those stages stay cue-only — intentional,
>   grip and ground work does not map to numbered punch combos.
>
> Full stage-by-stage detail is in `protocol-src/reviews/ARC_BAKI-review.md`.
> Run `node protocol-src/scripts/validate-campaigns.mjs` (8/8) after any content
> edit. Do not change the volume ladder, `pass-rules.json`, or the counted-set
> pacing — those are calibrated and playtested.

---

## PROMPT R — review + make a campaign ready (run this per campaign)

> Bring one Training Arcade campaign up to the standard `ARC_BAKI` now meets.
> Replace `<CAMPAIGN_ID>` below with the campaign you're working (start with
> `ARC_ULTRAEGO` — it's the cleanest of the remaining seven).
>
> **Step 1 — generate the review sheet**
> ```
> node protocol-src/scripts/review-campaign.mjs <CAMPAIGN_ID>
> ```
> Writes `protocol-src/reviews/<CAMPAIGN_ID>-review.md`: every FIT prescription,
> every FIGHT round with its combo seed, and an auto-flag section. Read the
> flags first, then the stage tables.
>
> **Step 2 — fix what the flags found.** These are the same five problems found
> in the Baki review, and each has a settled fix:
>
> | Flag | Fix |
> |---|---|
> | Campaign is 12 stages, Arcade caps at 10 | Fold the two dropped stages' content forward into the last two pre-boss stages, renumber the boss, re-cut the tier ladder back-loaded. Follow the ARC_BAKI restructure exactly. |
> | Module has no counted `prescription` | Author one per the volume ladder in `arcade-session-standards.json`: sets × reps/sec + `category` + `count_mode` + `load_type` + `rest_sec`, at the module's tier. |
> | Module has zero generated rounds | Convert at least one round to `mixed_with_cue: true` (keeps its `technique_cues`, adds `allowed_strikes`) so the stage still calls combos. |
> | Single-strike monotony | Keep the one or two rounds where a single strike IS the drill; open the rest to a 3-strike pool at intro/basic so the generator can set the strike up. |
> | Single long round instead of short rounds | Split into 5–6 rounds of 120s with 45–60s rest, each with its own `goal` and `combo_spec`. |
>
> **Step 3 — hold these invariants.** Every strike must map to one of the four
> disciplines. Combos are never hardcoded — a round carries a `combo_spec` that
> seeds the generator. Cue-based rounds are legitimate when the work genuinely
> isn't punch combos (grappling, stance, implement work); the goal is no
> *consecutive stages* running dry, not zero cue rounds. Fight modules get the
> same `tier` as the fit module for their stage.
>
> **Step 4 — verify and sync.**
> ```
> node protocol-src/scripts/validate-campaigns.mjs        # must stay 8/8
> node protocol-src/scripts/review-campaign.mjs <CAMPAIGN_ID>   # flags should be gone
> ```
> Mirror every edited file from `protocol-src/data/` into
> `components/training-mode/protocol/data/` — the app reads the mirror, not
> `protocol-src`. Then present the regenerated review sheet for sign-off before
> moving to the next campaign.

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
