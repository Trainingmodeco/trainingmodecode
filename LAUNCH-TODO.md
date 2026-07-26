# Launch path — status

Updated at the end of the build session that closed items 9–14. Everything
below is on branch `app`. Build is green: `tsc` 0 errors, `expo lint` clean,
`build:web` exits 0, validator 8/8, review script 0 flags on all 8 campaigns.

Goal order was **Baki perfect → Garou perfect → marketing.** Baki is perfect
and confirmed running in the built app; all eight campaigns are now content-
complete.

---

## ✅ Built

### Session UX (items 1–8)
Back button · STOP + confirm modal · skip · rewind · header with resumable
back-out · VoiceMixer in every session top bar · auto-pause on backgrounding
without double-penalising integrity.

### 9. Universal outcome screens
`shared/sessionOutcome.js` → `resolveOutcome()` is the single judge of
pass / partial / fail / validation_failed, running the engine's
`evaluateSession` against `pass-rules.json`. `MissionComplete` gained the two
missing variants (red / amber, matching the Arcade overlay) plus a `failReason`
line. Fight Focus, Combo Coach, Quick Mission, Combat Conditioning and the
Arcade all take the verdict from the same call.

XP note: pass and partial keep each mode's own figure — those already count
completed units, so applying the ruleset's completion multiplier on top would
penalise a partial session twice. Fail and validation_failed take the authored
multipliers (0.15 and 0).

### 10. Achievements
`data/achievements.js` (store) + `data/achievementTriggers.js` (award points) +
`shared/AchievementToast.jsx` + a grouped grid on the Progress tab. 80
achievements: 9 universal families and 71 across the campaigns. `award()` is
idempotent, so a replayed stage never re-fires the toast. Stage triggers parse
every stage number a trigger names and require all of them cleared, so
"stages (1-2)" waits for stage 2.

### 11. Ghost battles
`GhostVsScreen` (pre-fight, six art variants, pose rotated and persisted) and
`GhostResultScreen` (headline, head-to-head, best round, your round breakdown,
rematch, challenge code, share card). The live VS strip was already in
`FightFocusTimer`. Entry points: the Fight Focus setup card, and
`👻 BEAT THIS RUN` on a session summary.

### 13. Title Fight (camp L12)
`resolveTitleFight()` — twelve rounds with an objective each, round length
chosen so they land in the difficulty's active-minutes band, last three flagged
as championship rounds, and form-gated. MMA keeps its 4-5 × 4-5 min shape.
Winning it sets a separate camp-completion flag and shows
TITLE FIGHT WON / CAMP COMPLETE instead of "LEVEL 12 CLEAR".

### 14. Archetype picker
DISCIPLINE → DIFFICULTY → ARCHETYPE. Each card shows the
`variants[difficulty]` blurb for the difficulty already chosen. Persists per
discipline. The round engine takes no archetype input, so it is a label there.

### Campaign content — all 8 flag-free, all 10 stages
| Campaign | Fight rounds gen/cue |
|---|---|
| Ultra Ego | 60 / 6 |
| Ultra Instinct | 48 / 17 |
| Garou | 45 / 5 |
| Dark Knight | 43 / 17 |
| Baki | 41 / 19 |
| Berserk | 23 / 35 |
| Sonic · Gravity | fit-only, fully prescribed |

Every 12-stage campaign was fused to 10 so nothing is dropped by the Arcade
cap. Garou's single long blocks became real rounds. Sonic and Gravity got
counted prescriptions. Berserk got mixed rounds so no stage runs dry.

### Tooling
`protocol-src/scripts/review-campaign.mjs` — generates a stage-by-stage review
sheet per campaign and auto-flags the six known problems.
`BUILD-PROMPTS.md` — PROMPT R (per-campaign readiness), PROMPT D (diagnose).

---

## ⚠️ Needs a human

- [ ] **Sign off each campaign to unlock it.** Six sagas are still gated in
  `data/trainingArcadeData.js` → `UNDER_CONSTRUCTION`. The content is complete
  and validated; the gate is deliberate ("re-locked until individually
  playtested & signed off"). Unlocking one = deleting its id from that set.
- [ ] **Playtest.** Baki stages 3–10, and all of Garou / Ultra Ego / Dark
  Knight / Ultra Instinct / Berserk / Sonic / Gravity, have never been trained.
- [ ] **Look at the screens.** Items 9, 10, 11, 13, 14 are verified by logic
  harness and a driven browser session, not by eye. Specific layout risks: the
  archetype picker adds 3 cards inside the level modal; the achievements grid
  is 80 items across 9 groups; the ghost VS art crop.
- [ ] **Badge art for achievements.** Tiles render a themed glyph placeholder.

## Not on the launch path (deferred)

Reaction Mode (3.1) · camera pose verification (3.0) · camera motion tracking
roadmap · music player + Pro gating · custom combo builder.
