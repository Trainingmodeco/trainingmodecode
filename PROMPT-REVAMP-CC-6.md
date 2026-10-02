# PROMPT REVAMP-CC-6 — Multiple opponents (SWITCH calls) in Fight Focus and Combo Coach, MMA spinning back elbow

**Scope: commit `fa13dc3` on `trainingmodeco/trainingmodecode`, branch
`app` — the multiple-opponents round and the MMA spinning strikes. Nothing
else.** Run CC-5 first; this builds on it.

Run this in the revamp app repo. Every path and string here was checked
against the working tree on 2026-10-02. **Read the source files below**
before writing — match them line-close. Where this prompt and the source
disagree, the source wins.

| Purpose | Path |
|---|---|
| Shared rules + call list (new file) | `components/training-mode/data/multiOpponent.js` |
| Fight Focus round pool (multi entries) | `components/training-mode/data/fightFocusData.js` |
| Generator passes `multi` through | `components/training-mode/data/sessionGenerator.js` (`generateFightFocusSession`) |
| Fight Focus switch calls | `components/training-mode/FightFocusTimer.jsx` |
| Combo Coach multi round | `components/training-mode/ComboCoachActive.jsx` |
| MMA advanced strikes + combos | `components/training-mode/data/comboCoachData.js`, `components/training-mode/data/customCombos.js` |

---

## 1. What it is

A **multiple-opponents round**: the fighter works one target, then on the
SWITCH call pivots to the next — a second bag, or (one bag / shadow boxing)
a new imagined opponent. Strikes come in streams, one target at a time.

## 2. `data/multiOpponent.js` (new — copy verbatim)

- `MULTI_TITLE = 'Multiple Opponents'`
- `MULTI_PROMPT = 'Two bags: on switch, pivot to the other bag. One bag or shadow: pivot to face the next opponent.'`
- `MULTI_ANNOUNCE = 'Multiple opponents. ' + MULTI_PROMPT`
- `SWITCH_CALLS` (display / speech):
  `SWITCH!` / "Switch!" · `PIVOT · NEXT OPPONENT` / "Pivot! Next opponent!" ·
  `SWITCH BAGS!` / "Switch bags!" · `BEHIND YOU · TURN!` / "Behind you! Turn!"
- `nextSwitchCall()` — random, never the same call twice in a row.
- `switchGapSec(difficulty)` — Fight Focus seconds between calls:
  advanced 8, hard 10, normal 12, easy 14.
- `switchEveryCombos(difficulty)` — Combo Coach combos per target:
  advanced 2, otherwise 3.
- `comboCoachMultiRound(difficulty, rounds)` — 0-based index of the multi
  round: only Hard/Advanced with 3+ rounds, and it is `rounds - 2` (the
  second to last); otherwise `-1`.

## 3. Fight Focus

- `fightFocusData.js`: push one entry per discipline (`boxing`,
  `kickboxing`, `muay-thai`, `mma`): `id: '<discipline>-multi'`,
  `minDifficulty: 'hard'`, `multi: true`, `title: MULTI_TITLE`,
  `coachingCue: MULTI_PROMPT`. It joins the normal LRU pick, so it appears
  in some Hard sessions and never on Easy/Normal.
- `generateFightFocusSession` copies `multi: true` onto the round object
  (both the eligible path and the fallback path).
- The round intro already speaks `Round N. <title>. <coach_prompt>` — that
  IS the announcement; the rest line already says `Up next: <title>`.
- `FightFocusTimer`, in the per-second round tick right after the combo
  block: when `rounds[i].multi`, from 6 s into the round, while more than
  5 s remain and no rush is on, every `switchGapSec(diff)` seconds (and not
  in the same second as a combo call): show the switch call in the combo
  line — rendered big and teal (22 px Orbitron 900, `#5eead4`, glow) when
  the line is a switch call — clear it after 2.5 s if nothing replaced it, and speak it with
  `priority: 2, preempt: true`. Refs: `switchRoundRef`, `lastSwitchAtRef`
  (reset when the round changes).
- Any block round (camp, arcade, concept) may set `multi: true` and gets
  the same calls.

## 4. Combo Coach

- `multiRound = comboCoachMultiRound(cfg.difficulty, totalRounds)`.
- `switchInRef` counts combos to the next switch; reset to
  `switchEveryCombos(difficulty)` whenever the round changes. Each combo
  call decrements it (alongside `defenseInRef`).
- Round intro on the multi round: countdown sub-label
  `MULTIPLE OPPONENTS`, spoken `Round N. <MULTI_ANNOUNCE>` instead of
  `Round N. <discipline>. <speed>.`
- Rest before it: speak `Rest. Up next: multiple opponents.` instead of
  `Rest.`
- Combo loop, checked **before** the defense call: on the multi round, no
  rush, `switchInRef <= 0` → show the switch call, speak it at
  `voiceRate + 0.1` (cap 1.3), then wait `max(cadenceMs × 0.6 − spoken,
  700 ms)` so the fighter can turn and square up. Reset `switchInRef`.
- Display: new `isSwitch` state. Switch calls render **teal** `#5eead4`
  with a teal glow; combos stay gold, defense calls violet. Combo and
  defense calls clear `isSwitch`.

## 5. MMA spinning strikes

- `ADVANCED_STRIKES.mma` gains `'Spinning Back Elbow'` (after
  `'Spinning Backfist'`); the MMA custom-combo strike list gains it too.
- New MMA combos: `mma-69` advanced "Jab Cross Spinning Back Elbow",
  `mma-70` advanced "Lead Hook Low Kick Spinning Backfist", `mma-71` hard
  "Jab Cross Spinning Backfist" (cues in source).

## Acceptance

1. `npm run check:all` passes.
2. Fight Focus, MMA, Hard, 6 rounds: across several sessions a "Multiple
   Opponents" round appears; it is announced with the prompt and calls a
   switch about every 10 s. Never on Easy.
3. Combo Coach, Hard, 4 rounds: rest before round 3 says "Up next:
   multiple opponents"; round 3 opens with the announcement and shows a
   teal SWITCH call after every 3 combos. Normal difficulty never has it.
4. MMA advanced calls can include the spinning back elbow.

## 6. Fight Focus — UP NEXT card during rest (commit after `ae18348`)

The rest line was voice-only ("Rest. Up next: <title>"). During rest,
`FightFocusTimer` now shows an **UP NEXT** card where the round's focus card
sits: `UP NEXT · ROUND N` (blue `#7fb0ff`, Orbitron 9 px), the next round's
title (Orbitron 800, 15 px, uppercase), and its description + coach prompt
(Rajdhani 13 px; description omitted when it equals the prompt). Blue border
`rgba(79,140,255,0.4)`. The small UP NEXT chip is hidden while the card shows.
