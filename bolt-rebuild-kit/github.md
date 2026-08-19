# bolt-rebuild-kit · change log

Design-tracked changes shipped to the Training Mode app
(github.com/Trainingmodeco/trainingmodecode, branch `app`).

- **2026-08-19 · 10-workout-map-free-select.md** — Workout Builder guided
  player gets its navigation layer: binder tab above the tab bar opens a
  full-height WORKOUT MAP (pauses the workout; closing auto-resumes with a
  3-2-1 count). Any non-done exercise starts with press-and-hold (700ms
  violet→gold charge), hold+swipe skips, hold+drag ↕ reorders with a live
  DROP HERE placeholder while DONE/SKIPPED rows stay pinned in place. On an
  exercise's last set the map auto-slides up: gold `+15 XP` toast, finished
  row locks to `✓ DONE · just now`, the next target glows with a `▶ NEXT`
  chip, and any close starts it. Player is keyed on a stable per-row `_uid`
  so reordering never remounts the current exercise (set progress survives).
  Implemented in `FitBuilderGuidedPlayer.jsx` + `FitBuilderWorkout.jsx`;
  `XP_PER_FIT_EXERCISE` exported from `data/userStats.js` so the toast shows
  the real award. Gesture move/up delegated to `window` (per-row handlers
  died when the drag placeholder re-rendered the row).
- **2026-07-25 · 09-answer-the-bell.md (designs 49a / 49b / 49c)** — mandatory
  Answer the Bell gate before any **Training Arcade** final-boss session
  (black, breathing vignette + scanlines, eyes-only art, name slam, stat line,
  win/loss record pill, one tap target, no back button, bell + haptic, folded
  device-placement check), plus the once-per-session 2-second boss slam that
  **pauses the round clock**, fires on the reveal round's first work call, and
  is tap-to-skip for athletes who have cleared the boss before. Boss art added
  at `/static/fight/boss-eyes.webp`. Training Camp is unaffected.
- **2026-07-25 · Boss finale (design 47a "Boss reveal — round 10 / 12")** —
  universal final-boss experience for Training Arcade: "answer the bell"
  splash gate before the session, persisting boss HP bar that chips per
  cleared round, and the 47a late-fight reveal (round 10/12 on the fit
  burnout, final circuit on the fight gauntlet). `shared/BossFinale.jsx`,
  gated in `ScreenRouter`, driven by `bossFinale`/`bossName` on the arcade cfg.
- **2026-07-25 · 07-rush-mode.md (design 46b, 46a reference)** — Rush Mode
  redesign: surges now CALL work instead of hype-only. New CALL MIX in the Rush
  modal ordered Explosive → Strikes → Both above the four surge-timing rows,
  no cadence control. Explosive calls are fully random from a ~30-move
  discipline-filtered pool; strike calls run 50% freestyle / 50%
  discipline-specific. Visuals keep the 46a treatment — ring stays
  `ring-combo.webp`, no drawn circles. Implemented in
  `data/rushMoves.js` + `shared/RushMode.jsx`, wired through
  `FightFocusTimer` and `ComboCoachActive`.
