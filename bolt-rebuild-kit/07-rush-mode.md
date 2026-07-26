# 07 · Rush Mode — 46b redesign spec

Owner: Training Mode app (`components/training-mode`).
Designs: **46b** (the Rush modal + call generation, this spec) with **46a** as
the visual reference for the active-surge treatment.

Rush Mode is the all-out surge system inside Fight Focus and Combo Coach: at
scheduled moments the round ignites and the coach drives maximum output. The
46b redesign upgrades the surge from *hype lines only* to **called work** —
explosive movements, strike combos, or both.

---

## 1 · The modal (46b)

Opened from the RUSH MODE toggle row on the Fight Focus / Combo Coach setup
screens. Two sections, in this order, then Cancel / 🔥 ACTIVATE:

### CALL MIX — ordered Explosive → Strikes → Both
| Option | What the coach calls during a surge |
|---|---|
| **EXPLOSIVE** | Random explosive movements (burpees, tuck jumps, sprawls…) |
| **STRIKES** | All-out combos — half freestyle, half discipline signatures |
| **BOTH** | Alternates explosive movements with strike combos |

### SURGE TIMING — four rows (unchanged from the existing pattern set)
| Row | Behaviour |
|---|---|
| RANDOM SURGES | Random 5–10s bursts throughout the round |
| MINUTE RUSH · 10s | 10s rush at the end of every minute (0:50, 1:50…) |
| MINUTE RUSH · 5s | 5s rush at the end of every minute (0:55, 1:55…) |
| END OF ROUND | 20–30s all-out push at the end of each round |

**No cadence control.** Surge pacing belongs to the timing pattern; the modal
never exposes a call-speed slider.

Stored shape: `rush = { on, pattern, mix }` → session cfg
`{ rushMode, rushPattern, rushMix }`.

## 2 · Generation rules

- **Explosive** — fully random from the movement pool (shuffle-bag: every move
  heard once before any repeats, never back-to-back).
- **Strikes** — 50% **freestyle** (a 2–4 strike combo assembled live from the
  discipline's strike vocabulary) / 50% **discipline-specific** (a signature
  combo of that discipline; in Combo Coach the session's own combo pool is the
  signature source so rush calls match what the athlete has been drilling).
- **Both** — strict alternation explosive ↔ strikes.
- A hype push line ("Empty the tank!") lands every **third** call; calls are
  spaced 8–10s (same cue spacing as LT-2). During an END OF ROUND surge the
  final 10 seconds stay reserved for the number countdown.

## 3 · Explosive movement pool (~30 moves, discipline-filtered)

Jump squats · Burpees · Tuck jumps · Clap push-ups · Running high knees ·
Sprawls · Machine gun kicks* · Check kicks* · Mountain climbers ·
Squat thrusts · Jumping lunges · Star jumps · Plyo push-ups ·
Broad jump back-pedal · Skater bounds · Fast feet · Plank jacks ·
Burpee tuck jumps · Split jumps · 180 jump squats · Up-downs · Power skips ·
Lateral bounds · Speed squats · Push-up to shoulder tap ·
Shadow sprint in place · Drop and pop · Switch knees* · Flying knee bursts* ·
Sprawl to jump†

**Discipline filter:** *kick/knee strike moves only appear in Kickboxing /
Muay Thai / MMA sessions; †Sprawl-to-jump is MMA-only. Boxing keeps the pure
bodyweight set. Running high knees is conditioning, not a strike — every
discipline gets it.

## 4 · Visual (46a reference)

The active-surge treatment (RUSH MODE slam overlay, embers, edge glow, timer
aura) carries over from 46a. Constraint: **reuse `ring-combo.webp` for the
timer ring — do not draw a circle.** No new drawn-ring art anywhere in the
rush treatment; the .webp ring assets under `/static/` are the only rings.

## 5 · Implementation map

| Piece | File |
|---|---|
| Call generation + pools + mixes | `components/training-mode/data/rushMoves.js` |
| Surge timing (4 patterns) | `components/training-mode/shared/rushSchedule.js` |
| Modal + toggle row | `components/training-mode/shared/RushMode.jsx` |
| Activation/complete lines + cue spacing | `components/training-mode/data/rushVoice.js` |
| Surge visuals (46a) | `components/training-mode/RushEffects.jsx` |
| Consumers | `FightFocusTimer.jsx`, `ComboCoachActive.jsx` (setup screens pass `rushMix`) |
