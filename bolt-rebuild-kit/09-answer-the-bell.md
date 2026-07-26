# 09 · Answer the Bell — boss gate + slam (49a / 49b / 49c)

Owner: Training Mode app (`components/training-mode`).
Designs: **49a** (gate · fight), **49b** (gate · fit), **49c** (the 2-second slam).

**Training Arcade only.** Training Camp boss levels keep their normal
warm-up flow — this is the Arcade's final-stage ceremony.

Palette: pure black `#000`, blood-red `#ef4444` / `#ff2626`, gold `#fde047`,
muted label `#9a90b8`. Orbitron headings, Rajdhani body.
Boss art is `/static/fight/boss-eyes.webp` — **the boss is never fully shown**:
eyes only, always faded.

---

## 1 · The gate (49a fight / 49b fit)

Any Arcade final-boss session opens here. Nothing starts until the athlete
taps — no warm-up, no auto-countdown, no chrome.

Background: black, a breathing red radial vignette (~3.8s) and 3px horizontal
red scanlines.

Centred stack, top → bottom:

| # | Element |
|---|---|
| 1 | Series eyebrow, red Orbitron, letter-spacing `.26em` — fight `THE GRAPPLER · FINAL STAGE`, fit `THE FURNACE · FINAL STAGE` |
| 2 | `boss-eyes.webp` ~250px, opacity 0.5, red drop-shadow glow, 3s pulse |
| 3 | Boss name, 46px white Orbitron, `line-height:.96`, red glow + dark-red drop shadow, scale-pop ~350ms |
| 4 | Hairline red divider (transparent → `#ef4444` → transparent) |
| 5 | Stat line, red Orbitron `line-height:1.9`, fades in ~400ms after the name — fight `9 ROUNDS / EVERY SKILL / NO SECOND CHANCES`, fit `12 ROUNDS / EVERY MUSCLE / NO SECOND CHANCES` |
| 6 | Record pill — `YOUR RECORD 0 — 2 · best 6 of 9 rounds`; first-timers get `FIRST ATTEMPT · nobody clears this cold` |

Footer: `🔔 TAP TO ANSWER THE BELL` in red Orbitron with a glow in/out, and the
sub-line "Nothing starts until you do. 90s to loosen up, then round 1."

**Interaction.** The whole screen is the tap target. No back button, no
cancel — swipe-down is the only escape. The tap fires a real ring-bell sample
plus a heavy haptic. The device-placement check (hand / pocket / watch) folds
into this tap rather than living on its own screen, because boss rounds are
motion-verified and the tap is the user gesture iOS needs for the DeviceMotion
prompt.

### The mobility block

The bell drops the normal 3-minute warm-up, but going into a 39-minute
max-effort gauntlet stone cold is a real injury risk. The compromise is a
**90-second guided mobility block** between the bell and round 1 — six named
moves at 15s each (shoulder rolls, arm swings, hip openers, leg swings, torso
twists, bounce + shadow), each called out loud, auto-advancing, with a
`SKIP → ROUND 1` out for anyone who warmed up already. Black/blood-red so it
reads as part of the boss ceremony rather than a detour out of it.

Flow: **gate → 90s mobility → round 1.**

## 2 · The 2-second slam (49c)

Fires **once per session** when the boss shows himself:

* **fit** — entering round 10 of the 12-round burnout
* **fight** — entering the final circuit of the 9-round gauntlet

Trigger on that round's first WORK call, never mid-rest.

Content: `ROUND 10 / 12` pulsing red → `boss-eyes.webp` ~290px / opacity 0.72
with a hard scale-pop → boss name 42px white → `SHOWS HIMSELF` in gold →
`FINISH IT` at 26px white. Red claw-slash streaks rotate across the background
at ~−11° and +9°. Footer: a 2s depleting bar + "auto-dismisses · back to the
round in 2s".

**It pauses the round clock for its duration.** If the timer keeps running
through the cutscene the athlete loses reps and will resent it. Suppressed on
same-session retries, and tap-to-skip once the athlete has cleared this boss
before — respect the veteran without cheapening the first run.

## 3 · Refinement table

### Make the gate earn its tap
| # | Refinement |
|---|---|
| 1 | **Real bell audio + haptic.** The tap fires an actual ring-bell sample and a heavy haptic thud — the gate is the one moment worth a sound cue. |
| 2 | **Fold the placement check in.** Boss rounds are motion-verified, so the gate is the natural place to confirm hand / pocket / watch instead of a separate screen (46b). |
| 3 | **Show the record, not just the threat.** "0 — 2 · best 6 of 9 rounds" makes it personal and gives the retry a reason. First-timers get "nobody clears this cold" instead. |
| 4 | **Let the name land alone.** Name slams in first; the stat line fades in ~400ms later. Two beats read as menace — everything at once reads as a form. |
| 5 | **No back button, one escape.** The gate has no chrome. Swipe-down exits. Removing the "cancel" affordance is what makes it feel like a threshold. |

### Make the slam hurt
| # | Refinement |
|---|---|
| 6 | **Interrupt, don't overlay.** The 2s slam pauses the round clock. |
| 7 | **Fire it on the entry, not a timer.** Trigger on round 10's first call (fit) / the final circuit's first call (fight) so it always lands on a work beat, never mid-rest. |
| 8 | **Once per session, ever.** Suppress on retries within the same session. A slam you've seen three times is a loading screen. |
| 9 | **Skippable after the first time.** Tap-to-dismiss once the athlete has cleared this boss before. |

## 4 · Acceptance

- [x] No boss session auto-starts.
- [x] The gate has zero chrome and one tap target.
- [x] Fit and fight stat lines differ.
- [x] The slam fires once, pauses the clock, and auto-dismisses in 2s.

## 5 · Implementation map

| Piece | File |
|---|---|
| Gate + slam | `components/training-mode/shared/AnswerTheBell.jsx` |
| 90s guided mobility block | `components/training-mode/shared/MobilityBlock.jsx` |
| Gate mounting (arcade boss only, warm-up skipped) | `components/training-mode/ScreenRouter.jsx` |
| Slam trigger + clock hold — fight | `components/training-mode/FightFocusTimer.jsx` |
| Slam trigger + clock hold — fit | `components/training-mode/CampFitRunner.jsx` |
| Win/loss record | `data/arcadeProgress.js` (`recordBossAttempt`, `getBossRecord`), written from `App.jsx` |
| Boss art | `public/static/fight/boss-eyes.webp` |

### Resolved
The first cut sent the bell straight into round 1 with no prep at all, which
was a real injury-risk trade on a 39-minute max-effort gauntlet. Closed with
the 90-second guided mobility block above.
