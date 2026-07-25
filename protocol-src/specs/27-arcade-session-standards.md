# 27 · ARCADE SESSION STANDARDS — FIT + FIGHT (build prompts)

A general standard for ALL Training Arcade campaigns: how FIT and FIGHT sessions
are prescribed, counted, voiced, and (for weights) set up. Config + single source
of truth: `data/arcade-session-standards.json`. Applies across every campaign's
`modules.json`. Uses the shared voice-guidance timer (specs/22).

STATUS: standard defined; volume numbers are PROPOSED (safety-passed) and the
timing behaviours are marked "need to add + test" — confirm before rolling the
rep/set prescriptions across all live modules.

================================================================
PART A — ALL FIT PROTOCOL
================================================================

--- PROMPT A1: Every bodyweight exercise gets reps × sets, counted ---

No more un-quantified "do push-ups." EVERY bodyweight movement in a FIT module
carries an explicit prescription: `{name, category, sets, reps (or
duration_sec), count_mode, load_type, rest_sec}`. Reps are COUNTED so the user
follows along — the voice counts each rep and an on-screen counter runs. Counting
follows the voice-guidance contract; it's suppressed only when the announcer/
voice is toggled OFF (the on-screen counter still shows). Baseline start: ~3×10
(pull-ups 3-4 sets on their own lower curve).

--- PROMPT A2: The volume ladder — start basic, climb per stage ---

Reps/sets START basic and rise PER STAGE. Volume scales by three things
(`arcade-session-standards.json > volume_ladder`):
1. Stage TIER (foundation → development → hard → peak).
2. Movement CATEGORY — a pull-up is NOT a squat. pull scales low (3×8 → 5×12);
   push/squat scale high (up to 5×40-50); holds use time; explosive reps count
   toward the plyo cap.
3. DIFFICULTY — easy ×0.7 (trims sets first), normal ×1.0, hard ×1.25, always
   rounded to sane whole reps and never above a category's safety cap.
SIGNATURE CHALLENGE: a finale MAY carry ONE high-volume "century"-style challenge
for the anime feel — but only on a SAFE low-skill category (squats, calf raises,
easy core), spread across sets, difficulty-scaled. The user's brainstorm ("1 set
of 250", "10 sets of 20") is interpreted as high-volume EASY movements, capped —
never 250 in one set of a hard movement, never sets to failure.

--- PROMPT A3: The WEIGHTED path — a review-and-generate flow ---

When a movement needs/allows weight, the FIT session works partly like Workout
Builder + Quick Mission (`arcade-session-standards.json > weighted_flow`):
1. SETUP SCREEN — the announcer states the STAGE + TITLE, then "review your
   workouts and get ready," giving the user time to set up.
2. Per exercise, the user can: ✓ APPROVE (check mark) · SWAP (similar weighted
   movement) · MAKE BODYWEIGHT (converts to a bodyweight equivalent, RE-RANGED to
   a very high rep count equivalent to the weighted work) · MAKE WEIGHTED
   (converts a bodyweight move to a weighted one at a user-entered load, re-ranged
   to a lower heavy rep band).
3. The GENERATE button stays inactive until all exercises are approved/adjusted,
   then ACTIVATES and GLOWS. Tap → the session is generated.
4. Countdown announcer: "3, 2, 1. Stage {n}: {persona}. {count} workout(s).
   {exercise}, {setIndex} of {sets} sets, {reps} reps! Ready — go!"
   (e.g. "Stage 5: Jack Hanma. 1 workout, Muscle-ups, 1 of 5 sets, 20 reps! Ready
   go!")

--- PROMPT A4: Session-timing behaviours (need to add + test) ---

- BODYWEIGHT → REP-COUNTED: voice + counter count each rep so the user follows
  along (suppressed if voice is toggled off; counter still runs).
- WEIGHTED → TIMED: after "go", a timer counts how long the set/round takes. The
  user presses COMPLETE → a bell rings → rest begins. Rest length is ADAPTIVE —
  computed from how long the set took AND the load entered (heavier + longer →
  more rest). Formula TBD (engine placeholder); flag as to-test.

================================================================
PART B — ALL FIGHT PROTOCOL
================================================================

--- PROMPT B1: Fight-focus / combo-coach rounds, franchise-skinned ---

FIGHT sessions are FIGHT-FOCUS rounds (or COMBO-COACH based). A round MAY be named
for a franchise specialty, but every strike MUST resolve to one of the 4 canonical
disciplines (boxing / kickboxing / muay_thai / mma) — pick the move equivalent.
The NAME is thematic; the executed technique is canonical
(`arcade-session-standards.json > fight_standard.franchise_move_equivalents`),
e.g. "hard karate straight" → hard cross (boxing); "kung-fu chain punch" → rapid
straight-punch combination; "low-kick sweep" → low roundhouse (kickboxing).

--- PROMPT B2: Bodyweight finishers between/after rounds ---

Random explosive BODYWEIGHT movements (burpees, tuck jumps, jumping lunges,
mountain climbers, sprawls, squat jumps, high knees) may be inserted BETWEEN
rounds or as an END finisher. Short capped bursts (≈20-40s or a small rep count),
never to failure; jump movements count toward the campaign's plyo foot-contact
cap.

--- PROMPT B3: All guided + voiced ---

Every round, combination, franchise callout, and finisher is guided and called
aloud by the voice (voice-guidance contract, specs/22) using the campaign's voice
pack. The fighter never has to read the screen.

================================================================

--- WORKED REFERENCE (the prescription shape) ---

A FIT module exercise BEFORE (current): "Bodyweight squats"
AFTER (this standard): {
  "name": "Bodyweight squats", "category": "squat_legs",
  "sets": 4, "reps": 30, "count_mode": "reps", "load_type": "either", "rest_sec": 60
}
A weighted swap of the same slot: {
  "name": "Goblet squat", "category": "squat_legs", "load_type": "weighted",
  "sets": 4, "reps": 10, "count_mode": "reps", "rest_sec": 90, "load": "user_entered"
}

--- ROLLOUT NOTE ---

This standard is defined in data + spec. Applying the rep/set prescriptions to
every live module across all 8 campaigns is a content pass that should follow (1)
sign-off on the proposed volume ladder and (2) a decision on campaigns whose FIT
model is NOT classic reps×sets — Sonic (sprint/plyo/agility) and Gravity (tempo
holds / voice-count) already use their own quantified models and should keep
them; the reps×sets ladder applies to the strength/calisthenics FIT modules
(Grappler, Dark Knight, Ultra Ego, Ultra Instinct, Berserk, Garou-fit).

--- END ---
