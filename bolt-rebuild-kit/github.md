# bolt-rebuild-kit · change log

Design-tracked changes shipped to the Training Mode app
(github.com/Trainingmodeco/trainingmodecode, branch `app`).

- **2026-08-19 · 12-exercise-history-sheet.md (WB-F)** — tap an exercise's
  last-time line (list rows + weighted get-ready) to open the EXERCISE
  HISTORY bottom sheet: gold BEST pill, SVG trend of the last 8 sessions
  (gold dots on a violet dot-grid, glowing PR dots, dashed BEST line,
  first/last date labels only) and a newest-first session list with PR
  tags. First session is always a PR; ties are neutral. Bodyweight
  completions now log too (weight-0 entries) so the reps trend builds
  going forward. Same day: 90s builder warm-up gate (follow-along counted
  moves / freestyle, 5s auto-start, pixel-clock face), shake + message on
  zero-muscle GENERATE, and the two beta-pass guards (final-set SET DONE
  re-taps, capped LAST lines).
- **2026-08-19 · 11-train-again-progression.md (WB-E)** — day 2 is one tap:
  TRAIN AGAIN card on the builder setup screen repeats the last workout with
  progression baked in (+1 rep bodyweight / +2.5 lb weighted when every set
  landed; hold on misses or a >10-day gap; PR flag when the suggestion beats
  the all-time best). Every generated-list row gains a last-time line
  (`LAST 8·8·8 → TRY 9 REPS` gold, `= HOLD` faint, `🏆 PR` gradient, `NEW`
  tag), and the weighted get-ready screen pre-loads the suggested load with
  a `LAST TIME → SUGGESTED` story line + PR banner. New
  `data/builderProgression.js` + `tm_last_builder_workout` record (only
  written once ≥1 exercise is completed). Same day: saved routines moved
  into the WORKOUT PROGRAMS page under DURATION (max 10, two rows then a
  visible scrollbar), and the list's START button moved into the flow an
  inch below REGENERATE / SAVE ROUTINE.
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
