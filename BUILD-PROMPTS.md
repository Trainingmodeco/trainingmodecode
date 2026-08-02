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
>   name, and trigger text — **71 across the 8 campaigns** (Garou 12, Sonic 11,
>   the rest 8 each) — in
>   `components/training-mode/protocol/data/campaigns/<ID>/campaign.json`.
>   Trigger text references stage numbers, and every campaign was just
>   renumbered to 10 stages, so read the triggers as they are now.
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

## PROMPT 14 — Camp setup flow: archetype picker (difficulty first)

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
> - `shared/Stepper.jsx` and `ArcadeDifficultySelector.jsx` are the styling
>   references. Discipline art already exists.
>
> **14a. DISCIPLINE → DIFFICULTY → ARCHETYPE flow**
> A three-step setup before a camp level starts, using the existing
> `shared/Stepper.jsx`:
>
> 1. **Discipline** — existing discipline cards + art.
> 2. **Difficulty** — easy / normal / hard, styled like
>    `ArcadeDifficultySelector.jsx`.
> 3. **Archetype** — cards from `archetypesFor(discipline)`, filtered to the
>    chosen discipline. **Each card shows the name, the tagline, and the
>    `variants[difficulty]` string for the difficulty already chosen in step 2**
>    — never a generic blurb, never the "normal" text as a placeholder. So on
>    hard, Pressure Dog reads "High-output pressure, body attack volume,
>    late-round surges", and on easy the same card reads "Basic jab-cross-hook
>    pressure, short rounds, longer rest". Selected card gets the gold border.
>
> Difficulty comes **before** archetype on purpose: the archetype description is
> only meaningful once the intensity is known, and it lets the user compare all
> 12 styles at the exact intensity they're about to train.
>
> Going back to step 2 and changing difficulty must **re-render every archetype
> card's blurb** for the new difficulty, keeping the current archetype selected
> if it's still valid. Back navigation must never dead-end.
>
> Persist the choice per camp level (same pattern as `campProgress.js`) and pass
> it into the existing camp engine — this is a selection screen over content
> that already exists, so **no new workout content and no engine changes**.


---

## PROMPT G — Garou: split the single long blocks into real rounds

> `ARC_GAROU` is 10 stages and fully prescribed on the FIT side, but every one
> of its 10 fight modules holds **one 18–30 minute round** instead of the short
> rounds every other campaign uses. So `10 generated / 0 cue` is one long block
> per stage, not ten good rounds. Fix all 10.
>
> **The data is already there — you are reshaping, not authoring.** Each module
> (e.g. `MOD_GA_S04_FIGHT`, "Dutch Rhythm") already carries:
> - `exercises[]` — the drill list, in order, one line per intended round
> - `canonical_map[]` — the same drills mapped to discipline + canonical move
> - `striking_rounds` and `round_len_sec` — the intended round count and length
> - a single `rounds[0]` with one `combo_spec` covering the whole block
>
> **For each fight module:**
> 1. Build one round per entry in `canonical_map[]` (5–6 rounds; the first
>    `exercises[]` line is the warm-up, not a round). Use the module's own
>    `round_len_sec` for `length_sec` (150s where present, else 120s) and
>    45–75s `rest_sec` — shorter rest on the speed/burst stages, longer on the
>    power ones, matching how `ARC_BAKI` does it.
> 2. Give each round its own `goal` (snake_case, derived from the drill name)
>    and its own `combo_spec`, seeded from that round's canonical move — not a
>    copy of the block-level spec. Narrow `allowed_strikes` to what the drill
>    actually is: a teep round is `["tp"]` plus a setup, a low-kick round is
>    `["1","2","lk"]`, a hands-only speed round is `["1","2","3"]`.
> 3. Set `complexity` to match the drill — `single` only where one strike IS
>    the drill, `intro`/`basic` for setups, `standard` for flow rounds, `burst`
>    for speed rounds. Do not leave every round at `standard`.
> 4. Keep `finishers`, `canonical_map`, `tier`, `warmup` and `duration_min` as
>    they are. Only `rounds[]` changes.
>
> Garou's disciplines are boxing, Dutch kickboxing and Wing Chun — every strike
> must map to one of the four disciplines in
> `data/arcade-session-standards.json`. Chain-punch / trapping rounds that don't
> map to numbered strikes should be `mixed_with_cue: true` (generate combos AND
> keep technique cues) rather than pure cue.
>
> Verify: `node protocol-src/scripts/review-campaign.mjs ARC_GAROU` should drop
> to 0 flags and report roughly 50 rounds instead of 10. Then
> `node protocol-src/scripts/validate-campaigns.mjs` (8/8) and mirror
> `protocol-src/data/campaigns/ARC_GAROU/` into
> `components/training-mode/protocol/data/campaigns/ARC_GAROU/`.

---

## PROMPT S — Sonic + Gravity: add counted prescriptions

> `ARC_SONIC` and `ARC_GRAVITY` are fit-only (10 stages, 10 modules each) and
> are the only two campaigns that never received the arcade session standard.
> Every module has **zero counted `prescription`**, so the volume ladder and the
> counted-set runner cannot drive them — they play as one undifferentiated
> block. 20 modules to convert.
>
> **The content exists as prose.** Each module has an `exercises[]` array of
> strings (e.g. Sonic S04: "Wall drives (posture + knee drive)", "Falling starts
> into a 10-20m acceleration", "A-skips / dribble drills"). Convert each line
> into a `prescription` entry:
>
> ```json
> { "name": "...", "category": "...", "sets": 3, "reps": 12,
>   "count_mode": "reps", "load_type": "bodyweight", "rest_sec": 60 }
> ```
> - `category` ∈ pull · push · squat_legs · core · hold · carry · explosive ·
>   conditioning · mobility — the same set the volume ladder keys on.
> - `count_mode`: `"reps"` for counted movements, `"time"` with `duration_sec`
>   for holds and intervals, `"none"` with `duration_sec` for warm-ups,
>   mobility flows and cooldowns (they play but aren't counted).
> - Stored numbers are the **NORMAL baseline** at the module's `tier` — the app
>   re-resolves easy/hard from `data/arcade-session-standards.json`. Read the
>   ladder before picking numbers; do not invent a second scale.
>
> **Campaign-specific rules that must survive the conversion:**
> - **Sonic** — the mandatory warm-up gate stays (`warmup_gate: true`, and the
>   warm-up line becomes a `count_mode: "none"` entry, never a counted set).
>   Sprint work keeps full recovery between reps: the `accel` / max-velocity
>   blocks are low-rep, long-rest quality work (e.g. `sets: 4, reps: 1,
>   rest_sec: 180`), never conditioning circuits. Respect the plyo foot-contact
>   caps (40/60/80 by tier) — the explosive entries must sum under the cap.
>   Stage 9 is the deload; keep it light.
> - **Gravity** — the signature is tempo/cadence, not volume. Each module has a
>   `tempo` block (`eccentric_sec`, `pause_bottom_sec`, `concentric_sec`) and
>   `voice_count_mode: "cadence"`. Prescriptions must keep rep counts LOW because
>   each rep is 6–7 seconds long: a tempo push-up set is `3 × 8`, not `3 × 40`.
>   Do not let the volume ladder push cadence work to peak rep counts.
>
> Neither campaign has a fight side, so there is nothing to do on combos.
>
> Verify per campaign with
> `node protocol-src/scripts/review-campaign.mjs ARC_SONIC` (and `ARC_GRAVITY`)
> — both should go from 10 flags to 0. Then the validator (8/8) and mirror both
> campaign folders into `components/training-mode/protocol/data/campaigns/`.

---

## PROMPT B — Berserk: give the swordsman campaign its combos back

> `ARC_BERSERK` runs **4 generated / 54 cue-based** rounds. Nine of its ten
> fight modules have **zero** generated rounds, including the 12-round boss
> (`MOD_BK_S10_FIGHT`), and there are two long dry stretches: stages 1–3 and
> stages 5–10. A fight-only player goes six consecutive stages without a single
> combo called.
>
> **This one needs a decision, not just a script.** Berserk's fight side is
> greatsword, club, mace and sledgehammer work — implement swings that
> genuinely do not map to numbered punch combos. That is why it was authored
> cue-only, and that judgement was correct. The problem is the *amount*, not the
> existence, of cue rounds.
>
> **The fix — one mixed round per stage, minimum:**
> 1. In every fight module with zero generated rounds, convert **at least one**
>    round to `mixed_with_cue: true` — it keeps its `technique_cues` AND gains
>    `allowed_strikes`, so the app interleaves two generated calls with one cue.
>    Pick the round where an unarmed strike honestly fits: a guard/close-quarters
>    round, a "drop the weapon and fight" round, a footwork-into-strike round.
>    Do not bolt punches onto a two-handed swing round where they make no sense.
> 2. **The boss (`MOD_BK_S10_FIGHT`, 12 rounds) needs more than one.** Aim for
>    4–5 generated or mixed rounds across the twelve, so the finale has real
>    combo variety. Its round objectives already include
>    `defensive_brace_recover`, `the_beast_stirs_keep_form` and
>    `controlled_fury_form_gate` — those are the natural candidates.
> 3. Target: **no two consecutive stages with zero combos**, and the campaign
>    lands somewhere near 25–30 generated of ~60 rounds. It will stay the most
>    cue-heavy campaign in the game and that is correct — it is a greatsword
>    campaign, not a boxing one.
>
> Every strike still has to map to one of the four disciplines. Keep the
> implement-safety notes, the capped output rules and the Eclipse-phase framing
> exactly as authored.
>
> Verify: `node protocol-src/scripts/review-campaign.mjs ARC_BERSERK` — the
> "zero generated rounds" and "consecutive stages" flags should be gone. Then
> the validator (8/8) and mirror the folder.

---

## PROMPT A — after any content prompt: get it into the app

> Content lives in `protocol-src/data/`. **The app reads
> `components/training-mode/protocol/data/` — a mirror.** Nothing you author in
> `protocol-src` reaches the app until it is copied across. Every campaign
> folder must be byte-identical between the two trees.
>
> ```
> node protocol-src/scripts/validate-campaigns.mjs          # 8/8
> node protocol-src/scripts/review-campaign.mjs --all       # flag counts
> for c in protocol-src/data/campaigns/*/; do
>   diff -rq "$c" "components/training-mode/protocol/data/campaigns/$(basename $c)"
> done                                                      # must print nothing
> ```
>
> A new campaign additionally needs registering in
> `components/training-mode/protocol/campaigns.ts` — import its three JSON
> files, add it to `RAW`, add it to `CAMPAIGN_ORDER`, and add its coach lines to
> `CAMPAIGN_COACH`. Editing an existing campaign needs none of that.
>
> Then commit and push to `app`.


---

## PROMPT D — diagnose the build: did everything land, and what is broken?

> Nine items were implemented directly in this repo rather than pasted in as
> prompts, so nothing is "waiting to be built" — but nothing has been seen on a
> screen either. Every item below was verified with a logic harness only. Your
> job is to confirm it is all wired, then find what a test harness could not.
>
> **Step 1 — confirm the files are there.** All of these should exist:
> ```
> components/training-mode/shared/sessionOutcome.js        # item 9
> components/training-mode/data/achievements.js            # item 10
> components/training-mode/data/achievementTriggers.js     # item 10
> components/training-mode/shared/AchievementToast.jsx     # item 10
> components/training-mode/shared/GhostVsScreen.jsx        # item 11
> components/training-mode/shared/GhostResultScreen.jsx    # item 11
> components/training-mode/shared/ArchetypePicker.jsx      # item 14
> components/training-mode/data/campArchetype.js           # item 14
> protocol-src/scripts/review-campaign.mjs                 # tooling
> ```
> Then: `npm install && npx tsc --noEmit && npm run lint && npm run build:web`.
> Report every error — the logic harnesses ran the engines in isolation and
> never type-checked or rendered the JSX.
>
> **Step 2 — content, which IS verifiable by script.**
> ```
> node protocol-src/scripts/validate-campaigns.mjs     # expect 8/8 valid
> node protocol-src/scripts/review-campaign.mjs --all  # expect 0 flags on all 8
> ```
> Expected shape: every campaign is exactly **10 stages**. Fight rounds
> gen/cue — Ultra Ego 60/6, Ultra Instinct 48/17, Garou 45/5, Dark Knight 43/17,
> Baki 41/19, Berserk 23/35; Sonic and Gravity are fit-only and fully
> prescribed. Then confirm `protocol-src/data/campaigns/` and
> `components/training-mode/protocol/data/campaigns/` are byte-identical —
> the app reads the mirror.
>
> **Step 3 — run each flow and check the specific things I could not.**
>
> *Item 9 (outcome screens).* `shared/sessionOutcome.js` → `resolveOutcome()`
> is now the only judge of pass/partial/fail/validation_failed, and
> `MissionComplete` gained `fail` and `validation_failed` variants.
> - Inside `MissionComplete`, `partial` is now true for BOTH failure variants —
>   it drives the muted layout (no rays, no pulse). Check nothing else keyed off
>   that variable in a way that now misfires.
> - In `SessionSummary`, `stoppedEarly` now means "not a pass", so a
>   validation-failed session shows a RETRY label. Confirm that reads right.
> - Finish a session at ~80% and at ~30% completion. 80% should be PARTIAL, 30%
>   should be MISSION FAILED. Confirm a failed session shows "NO XP AWARDED" and
>   that XP actually banked matches.
>
> *Item 10 (achievements).* Clear Baki stage 1 then stage 2 — the Young Baki
> achievement names stages 1-2 and must fire on **stage 2, not stage 1**. Replay
> stage 2: the toast must NOT fire again. Check the Progress tab grid renders
> 80 achievements in 9 groups without overflowing on a small phone.
> `ProgressScreen` remounts the section via `key={tick}` on every unlock event —
> confirm that is not visibly janky.
>
> *Item 11 (ghost battles).* Load a ghost, start a session: the VS screen shows
> before the timer, with art matching the profile gender. Finish it: the result
> screen shows the same pose (the VS screen advances the rotation, the result
> screen reads it). Check the VS and result screens render OUTSIDE `WithNav` —
> full-screen with no tab bar — and that BACK and DONE both escape cleanly.
> Check `👻 BEAT THIS RUN` appears on a normal session summary once a verified
> ghost exists.
>
> *Item 13 (title fight).* Camp L12 must now run **twelve rounds** with an
> objective per round, not one long block. Confirm the round length lands in the
> difficulty's band (~2 min easy/normal, 3 min hard) and the last three rounds
> read as championship rounds. Win it: the outcome must say TITLE FIGHT WON /
> CAMP COMPLETE, not "LEVEL 12 CLEAR", with no CONTINUE button, and the camp map
> header must switch to CAMP COMPLETE. MMA keeps 4-5 rounds of 4-5 minutes.
>
> *Item 14 (archetype picker).* Open a camp level: the picker sits under the
> difficulty row and each card shows the blurb for the difficulty **currently
> selected**. Switch easy→hard and confirm every card's text changes. The picker
> adds 3 cards inside the level modal — check it does not push the START button
> off a small screen.
>
> **Step 4 — the migration hazard.** Every campaign was renumbered from 12
> stages to 10. Stage ids and module ids changed (`ARC_BAKI_STG12` →
> `ARC_BAKI_STG10`, `MOD_BH_S12_*` → `MOD_BH_S10_*`). Saved arcade progress from
> before this will not line up. Decide whether to migrate or clear
> `tm_arcade_v2`, and check `highestCleared()` — it still clamps to 12, which is
> now above the real maximum.
>
> **Step 5 — report.** For each item: wired correctly / wired but buggy / not
> wired. Fix what is clearly broken; for anything ambiguous, describe it and
> ask rather than guessing. Do not change the volume ladder, `pass-rules.json`,
> `xp-rules.json`, or the counted-set pacing — those are calibrated and
> playtested.


---

## PROMPT V — "I opened the app and none of it is there": verify what is actually live

> Everything below was written into this repo on branch `app` on 2026-07-26 and
> 2026-07-27 and pushed. If the running app does not show it, the code is not
> the suspect — the delivery path is. Work these in order and STOP at the first
> one that explains it.
>
> ### Step 1 — which branch is the app actually built from?
> `origin/app` is the real app: 817 files, `netlify.toml`, the whole
> `components/training-mode/` tree. `origin/main` is **not** — it is 127 files,
> its tip commit is "initial setup", it contains only `bolt-rebuild-kit/`, and
> it has no `netlify.toml`. It sits **294 commits behind `app`**.
>
> Confirm the deploy (Netlify site settings → Build & deploy → Branch to
> deploy) is pointed at **`app`**. If it says `main`, that alone explains
> everything and nothing else in this list matters.
>
> ### Step 2 — did the deploy actually run and succeed?
> Check the deploy log for a build newer than commit `a4e5714`. Netlify builds
> with `npm run build:web` → `dist`. If the last successful deploy predates
> 2026-07-26, the code is on GitHub but was never shipped.
>
> ### Step 3 — service worker cache (the most likely culprit for a PWA)
> This app registers a service worker that precaches the bundle.
> `public/sw.js` stamps a fresh `BUILD_ID` each build, and `netlify.toml`
> carries an explicit warning about clients getting stuck on an old worker.
> If the app was opened as an installed PWA or a returning tab, it can serve a
> months-old bundle with no visible sign.
>
> To rule it out: DevTools → Application → Service Workers → **Unregister**,
> then Application → Storage → **Clear site data**, then hard reload. On a
> phone: fully close the PWA, or reinstall it. Do this BEFORE concluding a
> feature is missing.
>
> ### Step 4 — know where each thing actually surfaces
> Several of these have no presence on the home screen. "Not visible" is
> expected until you go to the exact place:
>
> | What | Where it appears | How to see it |
> |---|---|---|
> | 10-stage campaigns | Arcade → any open saga | Ladder reads "0 of 10", boss at 10 gated on CLEAR 9 |
> | Saga order + Hero Hunter | Arcade carousel | One Punch · Gravity Chamber · Hero Hunter · Ultra Ego · The Grappler, then locked |
> | Counted sets | Arcade → stage → FIT → past the warm-up | "COUNTED SETS · MOVE 1/6", "SET 1/3 · 5 REPS" |
> | 60/40 combo variety | Arcade → stage → FIGHT → round 2+ | A jab-cross round also calls lead hook / body shots |
> | Outcome screens (9) | End of ANY session | Four variants incl. MISSION FAILED and VALIDATION FAILED |
> | Achievements (10) | Progress tab, scroll down | Three sections: FIGHT TROPHIES · MILESTONES · CAMPAIGN BADGES |
> | Archetype picker (14) | Training Camp → tap a level | Under the difficulty row, blurbs change with difficulty |
> | Ghost VS + result (11) | Fight Focus → load a ghost → START | VS screen before the timer; result screen after |
> | Title Fight (13) | Training Camp Level 12 | Twelve objective rounds; win reads TITLE FIGHT WON |
>
> Note four of these only exist deep in a flow: the outcome screens need a
> finished session, ghost screens need a recorded ghost, the Title Fight needs
> 11 camp levels cleared, and the archetype picker is inside the level modal.
>
> ### Step 5 — stale local progress
> Every campaign was renumbered from 12 stages to 10, so stage and module ids
> changed. `highestCleared()` now clamps to the campaign's real length, but if
> the ladder looks wrong, clear `tm_arcade_v2` in localStorage.
>
> ### Step 6 — only if 1–5 all check out
> Then and only then treat it as a code problem. Run
> `npx tsc --noEmit && npm run lint && npm run build:web` (all three passed
> here), then `node protocol-src/scripts/validate-campaigns.mjs` (8/8) and
> `node protocol-src/scripts/review-campaign.mjs --all` (0 flags on all 8).
> Report which specific item is missing and what the console says — do not
> rebuild anything that is already in the tree.

---

## PROMPT T — reachability audit: no gold or violet action button may be buried

> **The bug this exists to prevent.** In the Workout Builder, the EDIT sheet's
> gold **APPLY** button rendered correctly, sat in the DOM, and was completely
> untappable. Editing sets/reps/rest therefore looked like it silently did
> nothing — the only way out of the sheet was the ✕, which discards. It was
> reported as "the edit doesn't activate or update."
>
> **The mechanism, because it will recur.** `PhoneFrame` sets
> `isolation: isolate`, which opens a new stacking context. Every `z-index`
> inside it is therefore ranked *within the frame only* — `z-index: 9999` on a
> sheet does not beat anything outside. `ScreenRouter`'s `BottomNav` wrapper is
> a **sibling** of that frame at `z-index: 100`, so the tab bar paints over any
> sheet, always. The bar is ~58px tall plus
> `env(safe-area-inset-bottom)` — and a bottom-anchored sheet puts its primary
> action in exactly that band.
>
> ### The rule
>
> **Any bottom-anchored overlay must use `components/training-mode/shared/BottomSheet.jsx`.**
> It portals to `document.body`, so it escapes the frame's stacking context and
> genuinely overlays the nav; it caps its own height and scrolls its body; and
> it takes the action button as a `footer` prop, pinned so it never scrolls out
> of reach. Do not hand-roll `position: fixed; inset: 0; z-index: 9999` again —
> that is the exact shape of the bug.
>
> Two more rules that follow from the same geometry:
> - A **fixed** bottom CTA in normal screen chrome must offset the bar:
>   `bottom: calc(70px + env(safe-area-inset-bottom, 0px))`, as
>   `FitBuilderWorkout`'s START button already does.
> - A CTA in **normal flow** relies on `WithNav`'s
>   `paddingBottom: calc(110px + env(safe-area-inset-bottom, 0px))`. Screens
>   rendered with `lock` get `paddingBottom: 0` instead, so a locked screen must
>   reserve its own clearance.
>
> ### The task
>
> 1. Run the audit against a real build:
>    ```
>    npm run build:web
>    npx serve -s dist -l 4599      # or: python3 -m http.server 4599 -d dist
>    npm i --no-save playwright-core
>    npm run audit:tap -- --depth 3 --budget 420 --shots /tmp/tap-audit
>    ```
>    It crawls the app breadth-first across a 375×667 and a 412×883 viewport
>    and, for every clickable element in every state it reaches, runs
>    `document.elementFromPoint()` at that element's centre — the same hit test
>    a real finger triggers. Anything the browser says is covered by something
>    else, or is off-screen with nothing able to scroll it into view, is
>    reported. It probes at both ends of the scroll and only reports a control
>    that is unreachable in **both**, so "you just need to scroll" is not
>    counted as a defect. It exits non-zero when an ACTION control (APPLY,
>    START, SAVE, EXECUTE, GENERATE, CONFIRM, COMPLETE, CONTINUE…) is buried.
>
> 2. Fix every ✗ ACTION finding. Prefer moving the offender onto `BottomSheet`
>    over nudging a magic number — a hard-coded offset breaks again on the next
>    device with a different safe-area inset.
>
> 3. Re-run until `0 ACTION control(s) unreachable`, then confirm by hand on the
>    real screen: open it, tap the button, verify the value it commits actually
>    changed in the list behind the sheet. A button that is reachable but wired
>    to nothing passes the audit and still fails the athlete.
>
> ### What the first run found (all fixed — this is the shape to expect)
>
> | Control | Where | Why it was buried |
> |---|---|---|
> | **APPLY** | Workout Builder → edit a row | sheet's z-index trapped in `PhoneFrame` |
> | **APPLY & BACK** | Workout Builder → WORKOUT PROGRAMS | same, and on *every* phone size, not just small ones |
> | **GENERATE WORKOUT** | Workout Builder setup | screen rendered with `lock`, content taller than a 375x667 viewport, nothing could scroll |
> | **START CIRCUIT** | Combat Conditioning setup | same `lock` cause |
>
> The two `lock` cases were fixed once, in `WithNav`: `lock` is now a
> preference rather than a cage — if the content overflows anyway, the
> container scrolls and takes the standard nav clearance. That fixes every
> locked screen at once instead of one screen at a time.
>
> ### The sibling bug class: things that are reachable but do nothing
>
> A reachability audit cannot see these. Both were found by playtest and both
> were total blockers, so check them by hand after any timing or verdict change:
>
> - **PAUSE that does not pause.** Four rep players waited on a wall-clock
>   deadline (`while (Date.now() - start < cadenceMs)`) with a `pausedRef` check
>   inside. That reads as pause-aware but is not: the clock runs during the
>   pause, the deadline expires, and the rep is counted anyway. Always wait
>   *accumulated unpaused time* — use `shared/pausableWait.js`.
> - **A verdict decided on a case-sensitive compare.** Fight Focus and Combo
>   Coach store `difficulty: 'Normal'`; `resolveOutcome` compared against
>   `'normal'`. The tactical default silently dropped to `'attempted'` while the
>   threshold tier still resolved to `normal`, which demands `'completed'` — so
>   *every* session failed on the tactical rule with 0 XP, however well it went.
>   Normalise case at the boundary before comparing.
>
> ### What the audit does NOT cover
>
> It cannot reach states behind a live workout (it will not run a timed session
> to completion), behind a paywall, or behind a code-entry field. Outcome
> screens — CLEARED / PARTIAL / MISSION FAILED / VALIDATION FAILED — the Title
> Fight, the Ghost result screen and the boss finale therefore still need one
> human pass each on a small phone. Those are the screens where a buried
> CONTINUE would strand an athlete who just finished the work.

---

## PROMPT W — walk the app: update it, then diagnose it end to end

> Paste this whole block. Work it in order and report as specified at the end.
> Do not skip the automated gates — they are cheap and they catch the boring
> half. Do not skip the manual walk — the automated gates provably cannot catch
> the expensive half (see § D).
>
> ### A · Get current before diagnosing anything
>
> 1. `git fetch origin app && git status` — the real app lives on **`app`**, not
>    `main` (`main` is ~300 commits behind and has no `netlify.toml`). If you are
>    not on `app` or a branch rebased onto it, stop and fix that first.
> 2. Confirm the deploy branch is `app` (Netlify → Build & deploy → Branch to
>    deploy). If it says `main`, nothing else in this list matters.
> 3. **Clear the service worker before judging anything as missing.** This is a
>    PWA that precaches its bundle; a returning tab or installed app can serve a
>    stale build with no visible sign. DevTools → Application → Service Workers →
>    Unregister, then Storage → Clear site data, then hard reload. On a phone:
>    fully close and reopen the PWA, or reinstall it. Note the build id stamped
>    into `dist/sw.js` and check the running app reports the same one.
>
> ### B · Automated gates (all must be clean)
>
> ```
> npm run lint          # expect 0
> npm run typecheck     # expect 0
> npm run build:web     # expect exit 0
> node protocol-src/scripts/validate-campaigns.mjs         # expect 8/8
> node protocol-src/scripts/review-campaign.mjs --all      # expect 0 flags
>
> npx serve -s dist -l 4599     # or: python3 -m http.server 4599 -d dist
> npm i --no-save playwright-core
> npm run audit:tap -- --depth 3 --budget 420 --shots /tmp/tap-audit
> ```
>
> `audit:tap` crawls the app across a 375×667 and a 412×883 viewport and runs
> `document.elementFromPoint()` at the centre of every clickable element — the
> same hit test a real touch performs. It exits non-zero if any ACTION control
> (APPLY / START / SAVE / GENERATE / CONFIRM / CONTINUE…) is buried or
> off-screen-and-unscrollable. Expect **0 unreachable on both viewports**.
>
> If `package-lock.json` shows as modified after any npm command, revert it:
> `git checkout HEAD -- package-lock.json`.
>
> ### C · Grep for the two bug classes that already bit us
>
> These are cheap to check and both were total blockers in shipped code.
>
> **C1 — a pause that does not pause.** Never gate a wait on a wall-clock
> deadline. `Date.now()` keeps advancing while the athlete is paused, so the
> deadline expires mid-pause and the rep is counted, beeped and spoken anyway.
>
> ```
> grep -rn "Date.now() - .* <" components/training-mode --include=*.jsx
> grep -rn "await delay(cadence" components/training-mode --include=*.jsx
> ```
>
> Every hit must either accumulate unpaused time via
> `shared/pausableWait.js` (`waitUnpaused` + `awaitResume`) or have no pause
> concept at all. Already routed through it: the Workout Builder guided player,
> Quick Mission, Combat Conditioning, and both Arcade rep players.
>
> **C2 — display casing leaking into logic.** Fight Focus and Combo Coach store
> `difficulty: 'Normal'` (capitalised, for the UI). `resolveOutcome` compared
> `=== 'normal'`, the compare failed, the tactical default fell to `'attempted'`
> while the tier still resolved to `normal` (which demands `'completed'`) — so
> **every** session returned fail / `failType: tactical` with 0 XP, on fully
> completed verified work.
>
> ```
> grep -rn "=== 'normal'\|=== 'hard'\|=== 'easy'" components/training-mode | grep -v toLowerCase
> ```
>
> Any comparison against a difficulty, discipline or mode string must lowercase
> at the boundary first. `AddCardioSheet` and `ComboCoachActive` already do;
> follow their shape.
>
> ### D · Manual walk — what the automated gates cannot reach
>
> The crawler cannot enter states behind a live workout, a paywall or a
> code-entry field, and it cannot tell "button is tappable" from "button does the
> right thing". Everything below needs a human on a **small phone (375×667)**.
>
> For every screen, three questions: **can I reach the action, does it commit
> what it claims, and does the screen agree with itself?**
>
> | # | Walk | Pass criteria |
> |---|---|---|
> | 1 | Workout Builder → generate → tap a row's `4x8 · 120s` line → change sets/reps → APPLY | APPLY is fully on screen; the row behind updates to the new numbers |
> | 2 | Same, on a **weighted** workout (Equipment: WEIGHTED) | The WORKING WEIGHT block appears and APPLY is still reachable — this is the tallest the sheet gets |
> | 3 | Builder → WORKOUT PROGRAMS → pick a scheme → APPLY & BACK | Row changes from `AUTO` to e.g. `5×5 · 40m` |
> | 4 | Builder → START → let reps count → **PAUSE** → wait 15s | The number **freezes**. No beeps, no spoken counts. RESUME continues from the same rep |
> | 5 | Repeat step 4 in **Quick Mission** and **Combat Conditioning** | Same |
> | 6 | Repeat step 4 in an **Arcade** rep stage (One Punch stage 1) | Same, and on resume the next rep waits a full cadence rather than firing instantly |
> | 7 | **Fight Focus** → 3 short rounds → finish every round | **CLEARED / GOOD WORK**, XP > 0. Not MISSION FAILED. The integrity banner and the headline must agree |
> | 8 | Fight Focus → stop after 1 of 3 rounds | PARTIAL or FAIL — the gate must still bite. A fully completed session passing is the fix; a half session passing is a new bug |
> | 9 | Same as 7 for **Combo Coach**, at **each** of Easy / Normal / Hard | All three pass when completed |
> | 10 | **Training Camp** → any level, especially a **low** one | The modal is centred and START is fully visible without scrolling the page |
> | 11 | **Training Arcade** → open the **lowest** stage node on the ladder | ENTER STAGE fully visible, not tucked under the tab bar |
> | 12 | **Cardio Mode** → run → finish → log it | Pause works during the run; the summary offers a share, and the share card shows the XP actually awarded |
> | 13 | Every mode's outcome screen | CLEARED / PARTIAL / MISSION FAILED / VALIDATION FAILED each render with CONTINUE reachable. A failed session must **not** offer "share your win" |
> | 14 | Progress tab | FIGHT TROPHIES · MILESTONES · CAMPAIGN BADGES render as three separate labelled sections |
>
> The five open sagas are ONE PUNCH · GRAVITY CHAMBER · HERO HUNTER · ULTRA EGO ·
> THE GRAPPLER. Only The Grappler has been played past stage 2 — treat the other
> four as unproven and walk at least stage 1 of each.
>
> ### E · Report back in this shape
>
> 1. **Build identity** — commit sha on `app`, `dist/sw.js` build id, whether the
>    running app matched it.
> 2. **Gate results** — one line each for lint / typecheck / build / validator /
>    review / audit:tap, with the actual numbers.
> 3. **Findings** — one row per real defect: screen, what you did, what happened,
>    what should have happened, and which of the three classes it is
>    (unreachable · does-nothing · disagrees-with-itself). Say plainly if a walk
>    step could not be completed and why.
> 4. **What you changed** — file by file, with the reasoning, and the re-run
>    output proving it. Prefer fixing the shared cause once
>    (`shared/pausableWait.js`, `shared/BottomSheet.jsx`,
>    `shared/OverlayPortal.jsx`, `shared/sessionOutcome.js`) over patching each
>    screen; a hard-coded pixel offset or a per-screen copy of the same guard
>    will break again on the next device.
> 5. **Still unverified** — be explicit. An unwalked screen is unknown, not
>    passing.

---

## PROMPT N — strike numbering: numbers option for Combo Coach, Practice, Camp & Arcade

> ### Context — what exists today (verified against this repo)
>
> The app has NO numbering system anywhere. Combo Coach speaks word combos
> (`data/comboCoachData.js`, 120 entries like `'Jab Cross Hook'`), Practice
> Mode teaches strikes by name, and `data/arsenal.js` stores learned strikes as
> word tokens. There is no `callStyle` setting, hidden or otherwise. The owner's
> old custom systems (K1–K4 for kicks, E1–E8 for elbows) are deliberately
> DROPPED — research confirmed no such standard exists, and inventing one
> confuses athletes who train at real gyms.
>
> ### The system to build (research-backed, nothing custom)
>
> Punches numbered 1–8, identical across all four disciplines. Kicks, knees,
> elbows, teeps and defense stay as WORDS in every style — that is how real
> gyms call it ("1-2, low kick"), and kick numbering genuinely varies gym to
> gym, so we do not invent one.
>
> | # | Strike | Body version | Tier |
> |---|---|---|---|
> | 1 | Jab | 1 to the body | universal |
> | 2 | Cross | 2 to the body | universal |
> | 3 | Lead Hook | 3 to the body | universal |
> | 4 | Rear Hook | 4 to the body | universal |
> | 5 | Lead Uppercut | 5 to the body | universal |
> | 6 | Rear Uppercut | 6 to the body | universal |
> | 7 | Lead Overhand | — | common extension |
> | 8 | Rear Overhand | — | common extension |
>
> Odd = lead hand, even = rear hand. 1–6 is the universal boxing standard;
> 7–8 = overhands is a recognized common extension (some gyms use 7–8
> differently, so the teach layer must state ours explicitly).
>
> **Body shots**: the SAME number sent downstairs — every number 1–6 has a
> body version. Speech is always "<number> to the body" ("One to the body,
> two to the body"), never "one b". Display uses the compact `1B` badge form
> (`1 - 2 - 3B`), and the teach layer says both: "Three to the body — lead
> hook downstairs."
>
> Ambiguity rule for existing combo text: unqualified `Hook` → 3, `Body Hook`
> → 3B, unqualified `Uppercut` → 6, unqualified `Overhand` → 8, `Body Jab`
> → 1B, `Body Cross` → 2B. Named
> technique punches (`Check Hook`, `Shovel Hook`, `Superman Punch`,
> `Bolo Punch`) stay as words — they are techniques, not numbers. Defense
> calls (Slip/Roll/Check/Pivot/Sprawl) are never numbered.
>
> ### The setting — CALL STYLE
>
> `callStyle` on the profile (`data/userProfile.js` DEFAULT_PROFILE), three
> values:
>
> - `names` — today's behaviour. DEFAULT, so nothing changes for anyone
>   until they opt in.
> - `numbers` — display shows `1 - 2 - 3B · LOW KICK`; speech says
>   "One, two, three to the body, low kick". Speech must use number WORDS,
>   never digits, so TTS cannot read "1-2" as "one minus two".
> - `teach` — CALL + NAME: speech says "One — jab. Two — cross." Slower
>   cadence tolerated; this is the learning bridge.
>
> Surface the picker in TWO places, both persisting via the profile:
> 1. Profile → Audio Settings, under COACH STYLE — persist ON PICK via the
>    `persistProfile` callback (the pattern the encouragement row now uses;
>    do NOT rely on the SAVE button alone).
> 2. Combo Coach setup card — a compact 3-pill row, same ids.
>
> ### Where the code goes — the seam is two files
>
> Build ONE formatter and use it everywhere:
>
> **New `data/strikeNumbering.js`**
> - the canonical map above, plus per-token `{ display, speech }`
> - `formatCall(comboText, style)` → `{ display, speech }`. Tokenise with the
>   longest-first token approach `data/arsenal.js` already uses (import or
>   mirror its STRIKE_TOKENS ordering so `Low Kick` never splits into
>   `Low` + `Kick`).
> - Pure data + pure functions, no React, so it can be harness-tested.
>
> **Call sites (ALL combo speech in the app flows through these two files):**
> 1. `ComboCoachActive.jsx` — the combo call (`setCurrentCombo(next)` +
>    `speakAsync(next, …)`) and nothing else; defense calls stay words.
> 2. `FightFocusTimer.jsx` — the arcade round caller
>    (`curR.combos[…]` cadence calls). This ONE change covers Training Arcade
>    fight rounds AND Training Camp skill blocks, because camp runs its skill
>    sessions through FightFocusTimer.
>
> Do NOT rewrite `comboCoachData.js` or any campaign JSON — words stay the
> stored format; numbering is a render/speech transform only. That keeps all
> 8 campaigns and 120 combos untouched and lets athletes switch styles freely.
>
> ### Practice Mode — the teaching layer
>
> 1. Strike lessons for numbered punches show and speak their number:
>    "Jab — this is your ONE." Add the number as a badge on the technique
>    card. Numbers come from the same `strikeNumbering.js` map — no second
>    copy of the table.
> 2. Add ONE new Start Here drill: "KNOW YOUR NUMBERS" — walks 1 through 8
>    with the coach calling number + name, then a short called-by-number-only
>    sequence. Completing it can use the existing `addStartHereLesson` stat
>    (feeds the Sweet Science trophy path).
> 3. When the arsenal banks a strike (`data/arsenal.js`), nothing changes —
>    tokens stay words. The number is presentation.
>
> ### Order of work
>
> 1. `strikeNumbering.js` + harness test: run every one of the 120 combos in
>    `comboCoachData.js` through `formatCall` in all three styles; assert no
>    output ever contains an unconverted token in `numbers` mode that should
>    have converted, and that kicks/knees/elbows/defense are NEVER numbered.
> 2. Setting + the two pickers (profile default `names`).
> 3. Combo Coach wiring.
> 4. FightFocusTimer wiring (covers Camp + Arcade).
> 5. Practice Mode badges + KNOW YOUR NUMBERS drill.
> 6. Fix the false line in `TRAINING-MODE-BRIEF.md` — it currently claims the
>    app already uses numbered vocabulary. After this ships it will be true;
>    update the wording to describe the three call styles.
>
> ### Verify before calling it done
>
> - Harness: the 120-combo sweep above, plus spot checks:
>   `'Jab Cross Hook'` → display `1 - 2 - 3`, speech "One, two, three";
>   `'Jab Body Cross'` → `1 - 2B` / "One, two to the body";
>   `'Jab Cross Switch Kick'` → `1 - 2 · SWITCH KICK`;
>   `'Overhand Clinch Knee'` → `8 · CLINCH · KNEE`.
> - Browser: set `numbers`, run a Combo Coach round, confirm the big display
>   and the spoken call agree; set `names`, confirm zero change from today;
>   run an Arcade fight stage and confirm seeded combos convert too.
> - `npm run lint` 0 · `npm run typecheck` 0 · `npm run audit:tap` 0
>   unreachable (the new pill rows must not bury anything).

---

## PROMPT N-D — Designer brief: the CALL STYLE (strike numbering) surfaces

> Paste this into the design tool. It describes only the VISUAL surfaces for
> the strike-numbering feature; the logic spec lives in PROMPT N.
>
> ### Brand rules (match the existing app exactly)
>
> Deep violet/black background (#080012–#0a0014), gold accent #fde047 for
> primary actions and numbers, violet #a855f7 for secondary chrome, Orbitron
> for display/headers, Rajdhani for body text, arcade-cabinet framing, mobile
> 412×883 with a bottom tab bar (HOME · TRAIN · PROGRESS · PROFILE) that any
> sheet must clear. Pill selectors look like the existing MID-ROUND
> ENCOURAGEMENT row: rounded pills, violet glow on the active one.
>
> ### The numbering being visualised
>
> 1 jab · 2 cross · 3 lead hook · 4 rear hook · 5 lead uppercut · 6 rear
> uppercut · 7 lead overhand · 8 rear overhand. Any number 1–6 "to the body"
> is the same punch downstairs — shown compact as 1B…6B, spoken "one to the
> body". Kicks, knees, elbows, teeps and defense are always words, never
> numbers.
>
> ### Screens to design (5)
>
> 1. **CALL STYLE row — Audio Settings.** A labelled section "CALL STYLE"
>    under COACH STYLE with three pills: NAMES · NUMBERS · CALL + NAME.
>    Under the pills, one small live-preview line that changes with the pick:
>    - NAMES → `"Jab, cross, lead hook."`
>    - NUMBERS → `"One, two, three to the body."`
>    - CALL + NAME → `"One — jab. Two — cross."`
> 2. **Combo Coach setup card version.** Same three pills, compact, sitting
>    with the existing difficulty/rounds controls. No preview line — space is
>    tight; the pills alone.
> 3. **In-round call display (NUMBERS style).** The big mid-round call panel:
>    huge gold Orbitron numbers `1 - 2 - 3B`, then any word strikes on a
>    second line in smaller violet caps `· LOW KICK`. Must stay readable from
>    six feet away — this is glanced at mid-combo, phone on the floor.
> 4. **Practice Mode technique card with number badge.** The existing lesson
>    card (name, description, cues) plus a gold circular badge with the
>    number: Jab card carries "1", Cross "2", body variants show "1B" etc.
>    Badge reads as a rank/level medallion, arcade style.
> 5. **KNOW YOUR NUMBERS drill card + one drill screen.** A Start Here tile
>    ("KNOW YOUR NUMBERS — learn the 1–8 count") and one in-drill frame:
>    the current number huge in gold, the strike name under it in white
>    Orbitron, a 1→8 progress dots row, coach caption line at the bottom
>    ("Three — lead hook").
>
> ### Rules
>
> - Never place a primary action in the bottom ~90px band (tab bar + safe
>   area) unless the design is an overlay that covers the tab bar entirely.
> - NUMBERS is gold, words stay violet — the two-tone split is the visual
>   language for "numbered punch vs named strike".
> - No new fonts, no new colours; reuse the app's existing tokens.

---

## PROMPT N-M — Designer brief: THE NUMBER MAP (visual chart of the strike numbering)

> Paste into the design tool. One deliverable: a visual MAP of the strike
> numbering system — the reference chart an athlete glances at to learn the
> count. It must match the system that is already SHIPPED in the app, exactly
> as written below; do not invent numbers for kicks.
>
> ### Brand
>
> Deep violet/black (#080012–#0a0014), gold #fde047, violet #a855f7,
> Orbitron display type, Rajdhani body, arcade-cabinet framing. Gold = numbered
> punch, violet = named strike — that two-tone rule is already the app's visual
> language for this feature; the map must follow it.
>
> ### The system to map (exact, already live)
>
> Two columns by hand — ODD = LEAD, EVEN = REAR:
>
> | LEAD (odd) | REAR (even) |
> |---|---|
> | 1 · JAB | 2 · CROSS |
> | 3 · LEAD HOOK | 4 · REAR HOOK |
> | 5 · LEAD UPPERCUT | 6 · REAR UPPERCUT |
> | 7 · LEAD OVERHAND | 8 · REAR OVERHAND |
>
> Plus the body rule, shown once as its own callout: **any number 1–6 “to the
> body” is the same punch downstairs** — displayed 1B…6B, spoken “one to the
> body”. Example: 3B = lead hook to the ribs.
>
> And one footnote strip in violet: kicks, knees, elbows, teeps and defense
> are ALWAYS called by name — “1-2, LOW KICK” — never numbered.
>
> ### Layouts to produce (3)
>
> 1. **Full-screen reference map (in-app, 412×883).** Title THE NUMBER MAP.
>    A fighter silhouette or stance figure centered; the eight numbers arranged
>    around it in two arcs — odd numbers arcing off the lead side, even off the
>    rear side — each as a gold medallion (the number, large) with the strike
>    name under it in white Orbitron caps. Body-rule callout card beneath the
>    figure; the violet kicks-stay-named strip at the bottom, clear of the
>    ~90px tab-bar band. This screen ships inside Practice Mode next to the
>    KNOW YOUR NUMBERS lesson.
> 2. **Compact card (square-ish, shareable).** The same map condensed into the
>    two-column table form above, gold numbers / white names on the dark
>    ground, TRAINING MODE wordmark small in a corner. Built to be screenshotted
>    and posted — this is also the content asset for filming.
> 3. **Cheat-strip (horizontal, in-round).** One row: `1 JAB · 2 CROSS ·
>    3 L.HOOK · 4 R.HOOK · 5 L.UPPER · 6 R.UPPER · 7 L.OVER · 8 R.OVER` —
>    tiny, legible, designed to sit at the bottom of the Combo Coach round
>    screen above the tab bar as an optional learning aid.
>
> ### Rules
>
> - The medallion style should match the gold number badges already on the
>   Practice Mode technique cards (circular, gold ring, dark fill).
> - Never show a number on a kick, knee, elbow, teep or defensive move.
> - No new fonts or colours; the two-tone gold/violet split carries the
>   meaning everywhere.
