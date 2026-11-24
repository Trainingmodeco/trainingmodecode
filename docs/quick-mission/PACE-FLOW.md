# AT YOUR PACE: the new start and the coach's voice

Owner's words, 2026-11-24: "we should add a 5 minute warm-up first, in the beginning, and then it should have a
bypass, and then it should go to a screen that shows all the different workouts", "have the switch-out be there
beforehand", and "some of these things should have a voice to explain".

## The start, in order

START on the Quick Mission page (today's mission or a library mission set to AT YOUR PACE), and Home's START when
the saved choice is AT YOUR PACE, now go:

1. **WARM-UP, 5:00.** The same ring timer Build Workout's warm-up uses (teal ring, the time large in the middle).
   Under it, the mission's own warm-up taken from its notes (FIRST BELL: "3 easy rounds of 5 prying goblet squats,
   5 halos each way and 10 hip bridges, light bell") or, when it has none (today's generated mission), easy warm-up
   ideas. A big teal **SKIP WARM-UP** goes straight on; the end of the 5 minutes goes on by itself. The warm-up
   gives no XP, counts in no stats and is not part of the mission's time, score or checks.
2. **WORKOUTS.** Every move of the mission in order, as big and bright as the run's rows (name, reps or time), the
   format in one gold line (`EMOM · 21 MIN · REST 1:00`, `FOR TIME · 3 ROUNDS · CAP 20:00`), a **SWAP** button on
   each move that can swap and UNDO on a swapped one. The round **i** opens ABOUT THIS WORKOUT: the pace targets
   (ELITE / STANDARD / BEGINNER and how they were set), the load, the safety line, the mission's notes and "Beeps
   play while the screen is on". The gold **START** sits where PAUSE / STOP will be. Back goes to the Quick Mission
   page with the same library mission still picked, at its level and with the swaps made here (today's generated
   mission simply shows again). On the WORKOUTS screen each name keeps the row's whole width: its reps and SWAP sit
   on the line under it, so a name like "Kettlebell Presses" is never split in the middle of a word on a small phone.
   - Today's generated mission has no SWAP here (it says "Every move, in order. Tap START when you are ready."):
     its moves come from the generator, not the library, so there is nothing to swap them for (the run screen never
     offered it either).
3. **GET READY**, then the run, as before. Swapping during the run is still there, quietly (the small arrows).

Saving: nothing is kept for Continue until GET READY. Leaving the warm-up or WORKOUTS just leaves. A run brought
back from a pause (Continue on Home, the floating resume) goes straight into the run: no warm-up, no WORKOUTS, no
spoken start.

Not changed: the Fit card's CHECK-OFF run keeps its own start (straight to GET READY) and stays silent. Giving it
the warm-up would mean new saved states in a separate runner (FitCheckOffSolo); it was left as it is.

## What the coach says

All lines live in `components/training-mode/data/paceVoice.js`. It uses the same voice as the guided runs (the
profile's coach), the same VOICE volume (the speaker in the top corner of the warm-up and of the run) and the same
ducking. Nothing waits for speech: with no clip and a silent phone voice, every timer runs exactly as it would
without it. PAUSE, STOP, leaving the screen and SKIP cut the voice at once.

| When | What is said | Had a clip in both voices? |
|---|---|---|
| Warm-up starts | "Warm up. 5 minutes. Tap skip when you are ready." | "Warm up" and "5 minutes" yes; "Tap skip when you are ready" **no** |
| Warm-up, halfway | "Halfway through the warm up. Keep moving." | yes |
| Warm-up, 12 s left (before the beeps of the last ten) | "Last 10 seconds." | **no** |
| Warm-up ends (after its bell) | "Warm up complete." | yes |
| WORKOUTS opens | "Your workout is set. At your own pace. Swap any move before you start." | "At your own pace" yes; "Your workout is set" and "Swap any move before you start" **no** |
| WORKOUTS opens, today's generated mission | "Your workout is set. At your own pace. Tap start when you are ready." | "Tap start when you are ready" **no** |
| GET READY, every format | "Workout starting. At your own pace." then the line for its format below | "Workout starting" **no** |
| … EMOM | "Each set starts on the bell." | **no** |
| … intervals | "Work and rest on the bell." | **no** |
| … AMRAP | "Tap round after each round." | **no** |
| … for time, 2 or more rounds | "Tap round after each round. Tap finish when you are done." | **no** |
| … for time, a ladder (BURNOUT 21, CONTINUE? · BELL, OXYGEN DEBT) | "Tap round after each rung. Tap finish when you are done." | **no** |
| … for time, one round (and a one-round generated mission) | "Tap finish when you are done." | **no** |
| … until the bell is down (NO CONTINUES) | "Tap set after each set. Tap I put it down when the bell is down." | **no** |
| … until down in rounds (UPPER LOWER DIPS) | "Tap round after each round. Tap I'm done." | "Tap I'm done." yes, "Tap round after each round." no |
| … max reps (BOSS RUSH and the other MAX OUTs) | "Tap done when the set is done." (the guided mission's own clip) | yes |
| A rest of 30 s or more begins (1.8 s after its beeps) | "Rest." | yes |
| Work starts after such a rest (1.8 s after the bell) | "Back to work." | only as two pieces ("back to" + "work"); a whole take is on the list |
| Last minute of a capped run (after the warning beep), or of a one-block AMRAP of 3 min or more | "Last minute." | **no** |
| PAUSE | "Paused." | yes |
| RESUME (only when the clock is on work: a pause in a rest resumes in silence, since the ring still says REST) | "Back to work." | as above |
| The clock or the cap runs out (after the three bells) | "Time." | yes |
| FINISH, I PUT IT DOWN or I'M DONE | "Great work." | yes |

GET READY lasts 5 seconds, or, with the voice on, as long as the start needs so it ends before the 3-2-1 beeps
(its length is read from the recorded clips, never from the playing: at most 12 s). The first beep cuts anything
still talking. A cue whose moment passed while the phone was locked is skipped, like the bells.

The mission's own warm-up advice is shown, not said: none of it is a recorded line yet.

## To record

`/tmp/…/scratchpad/pace/record.json` (17 keys, both voices; copied into the result of this job). With it assumed,
`npm run -s test:spoken` and `npm run voice:coverage -- --strict` pass. The sweep that holds these lines is
`scripts/sweeps/pace-voice.mjs` (every library mission at every level and today's generated mission over the
setup's choices). Until the clips are recorded, the missing sentences fall back to the phone's speech engine.

Voice off: a mission set to no voice is silent in the warm-up too (the beeps and the bell still play). "Time." after
the final bells is dropped if the screen is left, or the phone is locked, before it is said.
