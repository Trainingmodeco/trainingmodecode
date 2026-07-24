# 25 · REACTION MODE (build prompts)

A fast, physical reflex game: the app throws cues (a called combo, a colour, a
number, an attack to slip) and you RESPOND with a real movement — a strike, a
slip/roll, a direction change, a squat-to-target. It measures reaction time +
accuracy and gives it a game/anime skin. Works in Fight Mode (strike/defend on
cue) and Fit (move on cue). Data model: `data/reaction-mode.json`. Reuses the
shared voice-guidance timer (specs/22) and can feed Ghost Battles.

--- HONESTY / EVIDENCE FRAMING (read first) ---

Frame Reaction Mode as an ENGAGING conditioning + sport-response game, NOT as a
proven general-reflex booster. In our own speed/striking deep-research, whether
"reaction/reflex drills" transfer to faster real-world reaction was NOT among the
supported claims — it is debated. So:
- What's honestly true and used: it's fun, it gets you moving and conditioning,
  and it's sport-specific PRACTICE of responding (throwing the called shot,
  slipping the called attack). Simple/choice reaction time DOES improve at the
  trained task with practice.
- Flag as NOT established: that it makes your reflexes faster in general life or
  other sports (transfer is unproven). Copy must not promise "superhuman
  reflexes."
- FANTASY (flavor only): "dodge bullets", Ultra-Instinct auto-dodge, seeing in
  slow-motion. Skin only, never a claim.

--- PROMPT 1: The core loop ---

A round is a stream of CUES; the user RESPONDS; the app scores each. Loop:
1. Warm-up gate (shared) — never start explosive reactions cold; include
   shoulder/wrist prep if striking.
2. For each cue: present it (see cue types), open a response window, detect the
   response (see response types), score reaction time (ms) + correctness.
3. Between cues: a randomized inter-cue interval (so it can't be anticipated).
4. End: show average reaction time, accuracy %, best streak, false-starts, and a
   Reaction Rank. Loss/miss never punishes showing up (normal XP).

--- PROMPT 2: Cue types (from data/reaction-mode.json) ---

- VOICE_CALL — the coach voice calls a combo/number ("jab-cross!", "TWO!"). Uses
  the voice-guidance TTS; the campaign's voice pack skins it.
- SCREEN_SIGNAL — a colour/number/arrow flashes (visual reaction).
- ATTACK_CUE — a slip/roll/block prompt ("SLIP LEFT", incoming from a side).
- GO_NO_GO — respond only to VALID cues, hold on invalid ones (e.g. strike on
  GREEN, freeze on RED) — trains decision/inhibition, not just speed.
- CHOICE — different cues map to different responses (1→jab, 2→cross, 3→slip) —
  choice reaction (harder than simple reaction).

--- PROMPT 3: Response types (physical — this is the fitness part) ---

Responses are MOVEMENTS, not just screen taps, so it doubles as conditioning:
- STRIKE — throw the called strike/combo (shadow or bag). Detection via the
  existing strike-detection (device motion) or a timed self-report tap.
- DEFEND — slip / roll / block the called attack.
- MOVE — touch a target, change direction, drop to a squat, lateral shuffle
  (agility / footwork; fit-friendly, no striking needed).
- TAP — a screen/pad tap as the minimal fallback when no space/bag.
Each cue in the data declares its allowed response type(s).

--- PROMPT 4: Difficulty (scales the challenge, not the risk) ---

`difficulty_scaling` (easy/normal/hard) tunes: inter-cue interval (slower→faster),
response window (generous→tight), cue complexity (simple → go/no-go → choice),
number of cues per round, and round count. SAFETY caps ride ALONGSIDE difficulty
and never scale away: warm-up required, form-over-speed, wrist/shoulder
protection for any bag contact, and no explosive reaction under heavy fatigue.
Hard makes you react FASTER and DECIDE more — it never removes the warm-up or
asks you to sacrifice landing/joint safety.

--- PROMPT 5: Scoring, ranks, streak ---

- Metrics: mean reaction time (ms), accuracy % (correct responses), best streak,
  false-starts (reacting before the cue — penalized so anticipation isn't
  rewarded), and a composite "Reflex Score".
- False-start rule: reacting before the cue window opens = a miss (this is what
  keeps it honest reaction, not guessing).
- Reaction Rank ladder (skin over the composite): Rookie → Quick → Sharp →
  Lightning → Untouchable. Ranks are per this task only (no transfer claim).
- Ties into the COMBO streak (specs/23) for showing up, and can produce a
  reaction-time GHOST (specs/24) — a reaction-time race against your own best.

--- PROMPT 6: Surfaces + framing per mode ---

- FIGHT: strike/defend reactions — a natural Combo Coach / Fight Focus companion
  ("react to the phantom"). Ultra Instinct / Garou "sense the attack" skin.
- FIT: move/touch/dodge reactions — agility & footwork quickness (Sonic "quick
  feet", speed pillars). No striking required.
- Session length is short by default (it's intense) — a few 60-120s rounds.

--- PROMPT 7: Safety ---

- Warm-up gate first (shoulders/wrists for striking; ankles for footwork/dodge).
- Form over speed: a fast but sloppy/again-through-pain response scores worse,
  not better — the quality gate stays on.
- Wrap hands + gloves for any bag striking; never bare-knuckle.
- Dodge/roll responses reuse the ankle-first / soft-landing safety from the speed
  work (specs 19/24) — no flips, controlled movements only.
- Stop criteria (wrist/shoulder/joint pain, dizziness) halt with no XP penalty.

--- SOURCING NOTE ---

No dedicated deep-research run; this reuses the striking/speed research already
in the repo. Its key honest constraint — that reaction/reflex-drill TRANSFER to
general or real-world reaction is DEBATED/unproven — comes directly from the
Sonic and Garou research reports (reaction drills were not among the supported
claims). Everything trainable here is task-specific response practice +
conditioning + engagement, which is real; the "faster reflexes everywhere" and
anime auto-dodge framings are flagged as unproven / fantasy.

--- END ---
