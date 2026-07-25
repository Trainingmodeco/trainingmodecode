# Launch path — remaining build items (post Session-UX)

Session UX (SESSION-UX-TODO.md) is **complete** — all 7 items shipped. This is
what remains on the path to "2 Training Arcade campaigns perfect, then
marketing." One item at a time, in order. Check off (`[x]`) as they ship.

Goal order: **Baki perfect → Garou perfect → marketing.**

---

## 9. UNIVERSAL OUTCOME SCREENS (pass / partial / fail / validation-fail)

STATUS: **Arcade = built. Camp = not wired. Make it universal.**

Already built in `ArcadeStageClearOverlay.jsx` with art:
| Screen | Component | Art |
|---|---|---|
| Cleared | `StageClearedScreen` | `/static/arcade/stage-complete.webp` |
| Partial (24d) | `PartialCompletionScreen` | `/static/arcade/partial-complete.webp` |
| Failed | `MissionFailedScreen` | `/static/arcade/mission-failure.webp` |
| Validation failed | `ValidationFailedScreen` | `/static/arcade/validation-fail.webp` |

Training Camp instead uses `shared/MissionComplete.jsx`, which only has
`success | partial` — no fail, no validation-fail, and it does NOT route
through the engine's `evaluateSession`.

- [ ] **9a. Extract the 4 Arcade outcome screens into a shared component**
  (e.g. `shared/SessionOutcome.jsx`) taking a mode-agnostic props contract:
  `{ outcome, title, subtitle, stats[], xpEarned, stars?, onRetry, onExit }`.
  Keep the existing art; do not restyle. Arcade keeps working unchanged.
- [ ] **9b. Route TRAINING CAMP through it** — wire the engine's
  `evaluateSession(result, difficulty, passRules)` (already exported from
  `protocol/content.ts`) so a camp session resolves to
  pass / partial / fail / validation_failed and renders the shared screen.
  `pass-rules.json` already holds the thresholds + the 4 fail types.
- [ ] **9c. (optional) Route Quick Mission / Combat Conditioning through it**
  so every mode ends the same way.

## 10. ACHIEVEMENTS → PROGRESS TAB

STATUS: **not built.** `protocol/data/achievements.json` holds the 9 families;
nothing in the app reads them. `ProgressScreen.jsx` exists but has no
achievements section, and there is no unlock/earn tracking anywhere.

- [ ] **10a. Achievement store** — `data/achievements.js`: load the families,
  persist earned IDs (localStorage, same pattern as `userStats`), expose
  `earned()`, `award(id)`, `progressFor(family)`.
- [ ] **10b. Trigger wiring** — award on the real events already firing:
  session complete, stage clear, streak milestones, ghost victory, campaign
  clear. Campaign-specific achievements already live in each campaign JSON
  (`campaign.achievements[]` with trigger text) — Baki has 8, Garou 12.
- [ ] **10c. Progress tab section** — grid of earned/locked badges with the
  family name + unlock condition. Locked = silhouette, earned = full art.

## 11. GHOST BATTLES — the VS experience (design 40e)

STATUS: **engine + data + art DONE. The screens are missing.**

- Data layer complete: `data/ghostBattles.js` (record, export/import challenge
  code, `finishGhostBattle`, `getMyBestGhost`, `getRecentGhosts`).
- Recording already live inside `FightFocusTimer` (strike timestamps, per-round
  totals, `ghostCountAtTime` live race math).
- **Art already delivered:** `/static/ghost/vs-{male,female}-{1,2,3}.webp` —
  the gender + rotating variants.
- Missing: every actual ghost SCREEN. `GhostButton.jsx` is a generic button,
  not ghost UI.

- [ ] **11a. VS pre-fight screen** — uses the 6 art variants (pick by the
  user's gender + rotate the 1/2/3 variant per battle). Shows YOU vs GHOST,
  the ghost's stats (strikes / time / stage), and ACCEPT · VS.
- [ ] **11b. Live race HUD** — during the round, a split bar of you vs the
  ghost's replayed pace (`ghostCountAtTime` already returns the number).
- [ ] **11c. Result screen** — victory / defeat / draw with the delta headline
  (`battleHeadline` in the engine already produces "▲ 26s FASTER · GHOST
  DEFEATED").
- [ ] **11d. Share card (40e)** — render the result as an image using the
  existing share infra (`CompletedWorkoutShareCard` / `ShareActions`).

## 13. TITLE FIGHT (Camp L12)

STATUS: **map-only.** `TrainingCampMap.jsx` already shows the boss node,
"🏆 TITLE FIGHT" label, and a locked state — but there is no special session
behavior and no win outcome.

- [ ] **13a. Title-fight session** — L12 runs a distinct final structure
  (longer/boss rounds, form-gated like the Baki Ogre trial) rather than a
  normal camp session.
- [ ] **13b. "TITLE FIGHT WON" outcome** — a distinct celebration on top of
  the shared outcome screen (item 9), plus camp-completion state so the whole
  12-level camp reads as finished.

## 14. CAMP SETUP FLOW — archetype picker

STATUS: **not built.** 12 archetypes exist in
`protocol/data/archetypes.json` (pressure_dog, slick_counter_boxer,
twelve_round_finisher, …) each with easy/normal/hard variants, but the only
mention of "archetype" in the app is inside `TrainingCampMap.jsx` — there is
no picker screen.

- [ ] **14a. DISCIPLINE → ARCHETYPE → DIFFICULTY setup flow** before starting
  a camp: pick discipline (existing art), then one of the 12 archetypes
  (name + one-line style description + the difficulty variant blurb from the
  JSON), then difficulty. Feeds the existing camp engine — no new content.

---

## Not on the launch path (defer past marketing)

Reaction Mode (3.1) · camera pose verification (3.0) · camera motion tracking
roadmap · music player + Pro gating · custom combo builder (on hold).
