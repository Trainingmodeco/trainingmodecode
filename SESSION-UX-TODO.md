# Session UX fixes — playtest checklist (Workout Builder + all features)

From the Workout Builder playtest ("~95% great"). We build **one item at a
time, in order** — check items off (`[x]`) as they ship.

**Build rules (apply to every item):**
- Match existing design tokens: Orbitron/Rajdhani, gold `#fde047`, violet
  `#a855f7`, danger red, existing card style.
- Reuse existing shared components — do **not** fork new versions of things
  that already exist (VoiceMixer, confirm-modal patterns, ring timers).

---

## Workout Builder (FitBuilderSetup / FitBuilderWorkout / FitBuilderGuidedPlayer)

- [x] **1. Back button** — on the builder workout screen, a clear back control
  that returns to the workouts list (FitBuilderSetup ↔ FitBuilderWorkout
  navigation). Never dead-ends the user.
- [x] **2. Stop button + confirm modal** — during a guided builder session, a
  STOP control that opens the same "End session? Are you sure?" confirm modal
  used by the other features (match FightFocusTimer / CampFitSetRunner's
  confirmEnd pattern). Confirm → end + summary; cancel → resume.
- [x] **3. Skip workout** — during a guided builder session, a SKIP control
  that advances past the current exercise/workout to the next one (voice
  announces the skip target; skipped items count as not-completed, never as
  done — completion/XP integrity unchanged).
- [ ] **3b. Rewind / previous** — the mirror of SKIP: a REWIND control that
  goes BACK to the previous exercise/workout (playtest: "accidentally skipped
  forward and couldn't go back"). Re-announces the exercise on return; a
  rewound-then-completed exercise counts normally. Place it symmetric to SKIP
  (prev | pause | skip).
- [ ] **3c. Header bar with back-out** — the guided builder session needs a
  header on top (like the other session screens) so the user can leave the
  page. Backing out mid-session PAUSES the session (same paused-session
  resume flow the app already has — savePausedSession) rather than silently
  killing or completing it.

## All features (every session player: FightFocusTimer, CampFitRunner,
## CampFitSetRunner, FitBuilderGuidedPlayer, ComboCoachActive, QuickMission,
## CombatConditioning, Cardio, Arcade players)

- [x] **4. Volume control on top** — surface the existing shared
  `shared/VoiceMixer.jsx` (or a compact volume popover built on it) in the TOP
  bar of EVERY feature's session screen. One consistent placement + icon
  everywhere. Controls the voice/cue volume live mid-session.
- [x] **5. Auto-pause on leaving the app** — when the app is backgrounded or
  the tab loses visibility (`visibilitychange` → `document.hidden`), every
  running session AUTO-PAUSES (same state as pressing PAUSE: timer halts,
  speech cancels, wake lock releases). On return, show the normal paused state
  with RESUME. Implement once as a shared hook (e.g. `useAutoPauseOnHidden`)
  and wire it into every session player. IMPORTANT: coordinate with
  `utils/missionIntegrity.js` — backgrounding currently raises an integrity
  flag; an auto-pause triggered this way must NOT double-penalize the user
  (pausing is the honest behavior we want).

---

## Answered / roadmap (do not build now)

- **Shadowboxing movement tracking (phone propped on a chair, camera facing
  you):** NOT in the app today. What exists is `hooks/useStrikeCounter.js` —
  accelerometer/device-motion strike counting (phone in hand). Camera-based
  pose tracking is feasible (on-device pose estimation) but heavy; captured as
  a future idea in `protocol-src/roadmap/camera-motion-tracking.md`. Marked
  nice-to-have, not needed.
