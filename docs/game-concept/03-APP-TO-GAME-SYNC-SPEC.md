# TRAINING MODE — App-to-Game Sync Spec (Fighter Profile)

> **Status:** v1 spec + working reference code · **Priority: CORE.**
> This is the entire point of the game: the app reads what you actually
> train, and the game builds your fighter from it. Everything here exists
> preemptively so app chats and the future game chat build against the same
> contract.
>
> **Reference implementation (runnable today):**
> - `game-sync/fighterProfile.js` — the engine: `computeFighterProfile(snapshot)`
> - `game-sync/demo.mjs` — sanity demo + assertions (`node game-sync/demo.mjs`)

---

## 1. The Law — feature → fighter mapping

These mappings are product law. Balance numbers live in `TUNING`; the
*directions* below do not change without founder sign-off.

| App feature (Fit/Fight) | Game effect | Neglect penalty |
|---|---|---|
| **Workout Builder** | **STRENGTH** — strike damage multiplier | `PILLOW_FISTS` — weak hits |
| **Cardio Mode** | **STAMINA** — the gas tank (seconds of all-out output) | `GASSES_OUT` — tiny tank |
| **Quick Mission** | **ENDURANCE** — stamina regen / recovery between exchanges & rounds | `SLOW_RECOVERY` |
| **Combat Conditioning** | Hybrid — trains strength AND stamina at half weight each | — |
| **Fight Focus** | **HIT XP** — bonus XP/meter per landed strike + strike-range bonus | low meter gain |
| **Combo Coach** | **COMBO MASTERY** — max combo length + combo damage scaling | 3–4 hit combo cap |
| **Practice Mode** | **MOVE LIST** — each completed lesson unlocks that strike in-game | `LIMITED_ARSENAL` — jab/cross/shove only |
| **Training Arcade** | **SPECIAL MOVES** — stage clears unlock super slots; boss clears unlock the ultimate | no specials at all |
| **XP level & tier** | Carries over 1:1 (LV1 Rookie → LV5 Champion) | — |
| **Streak** | `IN_THE_ZONE` regen perk at 7+ days | — |

**Canonical example (founder):** heavy Workout Builder + declines Cardio →
great strength, gasses out quickly, limited strikes. The demo asserts this
exact build and fails CI if a tuning change ever breaks it.

**Anti-cheat:** only *validated* sessions feed the snapshot. The app already
zeroes XP on `validation_failed` (`protocol/data/xp-rules.json`) — the
snapshot builder must apply the same rule to minutes and sessions.

## 2. How stats are computed (see code for exact formulas)

- **Share-driven:** each stat is dominated by that feature's *share* of the
  user's total validated training minutes — "what they do most" is the
  signal, so a cardio-only user and a lifter differ sharply.
- **Volume-bonused:** a log curve on lifetime minutes rewards consistency
  without letting grinders cap everything.
- **Floored & capped:** every stat lives in [15, 100] — nobody is
  unplayable, nobody outgrows the cap.
- **Derived game values:** stats map linearly onto game-facing ranges
  (damage ×0.7–1.8, gas tank 12–60s, combos 3–12 hits, hit-XP ×1.0–2.5…)
  — the game engine consumes `derived`, never raw stats.
- **Perks/weaknesses:** named flags (`GLASS_CANNON`, `MARATHON_ENGINE`,
  `GASSES_OUT`…) so UI, commentary, and bosses can react to the build.

## 3. Data pipeline

```
APP (Expo/JS)                    SUPABASE                        GAME (engine TBD)
─────────────                    ────────                        ─────────────────
per-feature session logs   →     feature_sessions table    →     GET /fighter-profile
(already exist as local          (user_id, feature, minutes,     (edge function runs
data modules: cardioSessions,    xp, outcome, validated,         computeFighterProfile,
campSessions, comboCoachData,    started_at)                     returns FighterProfile
fightFocusData, arcadeProgress,  + view: usage_snapshot          JSON, schemaVersion: 1)
practice lessons, xp-rules)      aggregated per user
```

- **App job:** persist every validated session as a `feature_sessions` row
  (feature enum matches the table in §1; source modules already track this
  locally on the `app` branch).
- **Supabase job:** `usage_snapshot` view/RPC aggregates rows into the
  `AppUsageSnapshot` shape; a `fighter-profile` edge function imports
  `game-sync/fighterProfile.js` (pure JS, zero deps — runs in Deno as-is)
  and returns the profile. Game logs in with the user's Training Mode
  account (Supabase auth — same login as the app).
- **Game job:** fetch profile at login, apply `derived` values, `moveList`,
  and `specials`; re-fetch on session start; cache offline with
  last-known-good.
- **Two-way (later):** game reports back events (bosses beaten, ghost
  workouts cleared) to unlock app trophies/protocols.

## 4. Contract stability

- `schemaVersion` gates breaking changes; additive fields are free.
- `TUNING` lives server-side (edge function) so balance patches never
  require a game-client update.
- The demo assertions in `game-sync/demo.mjs` are the acceptance tests:
  any change that breaks the founder's canonical builds is a bug.

---

## 5. BUILD PROMPT (copy-paste into a code chat)

> Use in the app revamp / fight mode chat to wire the app side, or in the
> future game chat to wire the consumption side.

```
Read docs/game-concept/03-APP-TO-GAME-SYNC-SPEC.md and game-sync/
(fighterProfile.js + demo.mjs) in this repo first. Run `node
game-sync/demo.mjs` to see the contract working.

Task: implement the app→game Fighter Profile pipeline against that spec,
WITHOUT changing the feature→stat mappings (they are product law; balance
lives only in TUNING).

APP SIDE (Expo app, Supabase):
1. Create a `feature_sessions` table: id, user_id, feature (enum:
   workout_builder | quick_mission | cardio | combat_conditioning |
   fight_focus | combo_coach | practice_mode | arcade), active_minutes,
   xp_earned, outcome (pass|partial|fail|validation_failed), metadata
   jsonb (arcade: stages/boss clears; practice: lesson ids), started_at.
   RLS: users read/write only their own rows.
2. On every session completion, insert a row from the existing data
   modules (cardioSessions, campSessions, comboCoachData, fightFocusData,
   arcadeProgress, practice lessons). Respect xp-rules.json:
   validation_failed contributes 0 XP and 0 minutes to the snapshot.
3. Create a `usage_snapshot` RPC/view aggregating a user's validated rows
   into the AppUsageSnapshot shape in game-sync/fighterProfile.js.
4. Deploy a `fighter-profile` Supabase edge function that imports
   game-sync/fighterProfile.js verbatim, calls computeFighterProfile on
   the snapshot for the authed user, and returns the JSON.
5. Add a "GAME PROFILE" preview card in the app's Progress tab: render
   stats, perks/weaknesses, move list, and special slots from the edge
   function — this ships value before the game exists and validates the
   pipeline with real users.

GAME SIDE (when the game chat starts):
6. On login (same Supabase auth as the app), GET fighter-profile; apply
   `derived` values, moveList, and specials to the player character.
   Cache last-known-good for offline play. Refuse nothing: users with no
   app data get the default snapshot (floors + default moves).

Acceptance: `node game-sync/demo.mjs` passes unchanged, and a
builder-heavy/no-cardio test user comes out strong, gassy, and
limited-arsenal end-to-end through Supabase.
```

---

## 6. Open tuning questions (founder input welcome, defaults shipped)

- Recency: should shares use a rolling 90-day window / decay so lapsed
  training fades? (Current: lifetime minutes; snapshot builder can window.)
- Should tier (Rookie→Champion) also scale stat caps, or stay cosmetic+level?
- Exact lesson-id list for LESSON_TO_MOVE once Practice Mode lesson ids are
  final on the app branch.
- Per-discipline flavor: same stats, different animations — or small
  discipline stat biases (boxing = hands, muay thai = knees/elbows)?
