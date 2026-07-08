# 09 · ANTI-CHEAT / INTEGRITY PROTOCOLS

Principle: reward VERIFIED EFFORT, not clock time. Be carrot-forward — quietly
reduce XP on low-signal sessions rather than hard-failing genuine users
(false positives erode trust faster than cheaters do). The visible layer is
already built (Stage Cleared / Mission Failed / Validation Failed / Partial).

--- PROMPT ---

Implement a workout-integrity evaluation that runs during every timed session (Arcade stages, Quick Mission, Combat Conditioning, Fight Focus, Cardio) and decides the outcome screen + XP multiplier:

TIER 1 — ship now (cheap, sensor-based):
1. Motion gate (primary): sample device accelerometer during WORK phases. Sustained near-zero motion while "working" = flag. Rest phases exempt.
2. Rep-cadence sanity cap: per-exercise max plausible rep rate (e.g. pushups ≤ 1/1.2s sustained). Confirmed reps faster than the cap = invalid reps, flag.
3. Human-rhythm variance: real effort shows variance and fatigue drift (reps slow over a set). Perfectly metronomic/linear pacing across a session = robotic flag.
4. Rest-phase logging: skipping every rest phase across many rounds = flag (already surfaced on the Validation Failed screen as "timer skipped — no rest logged").
5. Set/rep tap checkpoints: guided screens require per-set confirmation taps; jumping straight to "done" without intermediate checkpoints = incomplete session (Partial at best).

TIER 2 — fast follow:
6. HealthKit / heart-rate (opt-in, Apple Watch): XP scales with exertion; flat HR through a "hard" session halves XP. Strongest single signal — also a marketing feature ("verified training").
7. Diminishing returns: sessions with 1 soft flag complete normally but earn reduced XP (no scary screen); 2+ flags or any hard flag (impossible reps, zero motion) → VALIDATION FAILED screen with the specific flagged signals listed; partial checkpoints + honest effort → PARTIAL COMPLETION with partial XP.

TIER 3 — post-launch (v2):
8. Camera/pose rep counting for form-demo exercises. High fidelity, heavy build + privacy ask. Not for beta.

OUTCOME MAPPING:
- 0 flags + target met → STAGE CLEARED / MISSION COMPLETE, full XP (+ cardio bonus if applicable).
- Target time missed, effort verified → MISSION FAILED (retry, no penalty).
- Session abandoned ≥50% with verified effort → PARTIAL COMPLETION, partial XP, no unlock.
- Hard integrity flags → VALIDATION FAILED, 0 XP, redo required, show which signals fired.
Log every evaluation (signals, score, outcome) so thresholds can be tuned from beta data without an app update (remote config).

--- END ---
