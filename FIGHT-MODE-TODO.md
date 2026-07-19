# Fight Mode revamp — build checklist

Working plan for the Fight Mode overhaul. We build **one item at a time, in
order** — later items depend on earlier ones. Check items off (`[x]`) as they
ship. Nothing here is built yet.

> The user will implement **most but not all** of these — confirm each item is
> still wanted before starting it.

**Build rules (apply to every item):**
- Match existing design tokens: Orbitron/Rajdhani, gold `#fde047`, violet
  `#a855f7`, danger red, existing card style.
- Reuse the existing ring timers and the shared Mission Complete flow — do
  **not** fork new versions of screens that already exist.

---

## PHASE 1 — FOUNDATIONS (everything else builds on these)
- [x] 1.1 Practice Mode completion loop: finishing DRILL IT marks a lesson
      done ✓, advances the lesson unlock chain, and adds the strike to the
      user's learned "arsenal" (persisted per discipline).
      → data/arsenal.js (canonical strike tokens, per-discipline persistence,
        name→strike normalizer); wired into PracticeMode basics + technique
        drills with a "STRIKE ADDED TO YOUR ARSENAL" toast. Verified: Jab/Cross
        bank, Stance/Guard/Defense bank nothing.
- [ ] 1.2 Combo Coach ← arsenal link: combos call only learned strikes;
      "YOUR ARSENAL: n" chip + ALL STRIKES toggle; lesson-complete toast.
- [ ] 1.3 Combo Coach upgrades: DEFENSE CALLS toggle (SLIP/ROLL/CHECK/PIVOT
      in violet), stance setting (orthodox/southpaw), custom combo builder
      with saved combo chips.
- [ ] 1.4 Strike counter pipeline: accelerometer sampling during WORK phases,
      high-pass filter, magnitude peak detection with ~200ms refractory
      window, adaptive threshold. One shared module used by every Fight Mode
      feature. Live "STRIKES" HUD counter + placement hint sheet.
- [ ] 1.5 Fight Mode stats: STRIKES THROWN · ROUNDS · BEST STREAK row on
      Mission Complete; lifetime totals persisted for trophies/ghosts.
- [ ] 1.6 Anti-cheat wiring: strike counter feeds the integrity evaluation
      (strikes verify effort; low count = soft flag only; stationary device
      falls back to plain motion gate).

## PHASE 2 — PROGRESSION (the retention layer)
- [ ] 2.1 Session recipe format + runner: a camp session = JSON list of
      blocks (lesson / fightFocus / comboCoach / conditioning) chained with
      transition cards, ending in the normal Mission Complete flow.
- [ ] 2.2 TRAINING CAMP map screen: 12 nodes, phase labels (FUNDAMENTALS /
      BUILDING / CONDITIONING / FIGHT SIM / TITLE FIGHT), node states,
      session detail cards, saved cursor {discipline, tier, sessionIndex}.
- [ ] 2.3 TITLE FIGHT session + "TITLE FIGHT WON" outcome screen; camp
      completion → CAMP CHAMPION trophy + bonus XP → offer next camp/tier.
- [ ] 2.4 Home integration: active camp drives Today's Bout ("TRAINING CAMP
      · SESSION n").
- [ ] 2.5 Fight Mode trophies live: CAMP CHAMPION · COMBO MACHINE · SCHOLAR
      OF THE SWEET SCIENCE · IRON ROUNDS, wired to real events.

## PHASE 3 — DIFFERENTIATORS (competitive layer; needs Phase 1)
- [ ] 3.1 REACTION MODE: opponent windup cues → defense calls → motion-
      verified reactions, PERFECT/GOOD/HIT grading, HP bars, counter-combo
      windows, KO/decision outcomes, avg-reaction-time stat on Progress.
- [ ] 3.2 GHOST BATTLES data: record per-10s strike buckets on every
      verified Fight Mode session; "MY BEST" ghost always available.
- [ ] 3.3 GHOST BATTLES live screen: split strike bar (you vs ghost replay),
      lead chip, per-round bars, VICTORY/DEFEAT outcome + rematch.
- [ ] 3.4 Challenge codes: "SET AS CHALLENGE" on verified completions →
      shareable code/link; entering a code downloads the ghost. Verified-
      only ghosts ("No fake scores").
- [ ] 3.5 Share cards: ghost battle + reaction mode results with the
      VERIFIED shield badge.

## DESIGN CHECKLIST (assets needed, can run in parallel)
- [ ] Training Camp map art direction (path bg, phase dividers, 👑 boss node)
- [ ] /assets/fight/placement-hint.png (phone/pocket/watch illustration)
- [ ] /assets/fight/opponent-{discipline}.png (reaction-mode opponents)
- [ ] "TITLE FIGHT WON" + KO splash outcome art
- [ ] Ghost battle share card layout (two avatars, result, VERIFIED shield)
- [ ] Camp Champion belt trophy + 3 other Fight Mode trophy images
