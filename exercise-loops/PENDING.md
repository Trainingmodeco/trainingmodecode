# Waiting on the owner (read this first, and remind them)

Written 2026-11-22. The owner said: do not record now, remind me later, and tell me what is submitted and what is missing.

## 1. New exercise names: ADDED and RECORDED 2026-11-27 (loops still staged)

The owner said "21 new exercise names please add". The 24 loops in `factory-loops/` that had no exact library entry came to 21 names; 10 of
them are new exercises and were added to the library (`fitModeExerciseDataLoops.js`, each with a `// loop: <slug>` comment naming its staged
loop, no `videoUrl`; the loops are NOT copied into `public/` and the loop catalogue and board files are untouched). 402 exercises now.

- Lat pulldowns (Cable): Lat Pulldowns, Close-Grip Lat Pulldowns, Wide-Grip Lat Pulldowns, Single-Arm Lat Pulldowns (each side)
- Bulgarian Jump Lunges with High Knee (Bodyweight, Hard; each side; gear chip BODYWEIGHT + BENCH OR STEP via `gearNote.js`)
- Squat to Fake Thai Roundhouse, Stienborn Squat (the owner's spelling; the lift is usually written Steinborn), Alternating Dumbbell Punches to the Sky
- Crossed-Leg Crunches, Cross Push-Ups (the cue was written from the loop frames: one hand across and ahead of the other, hands switching each rep; worth a look)

Recorded in both voices (bank v30): 9 names x 5 lines (name, complete, straight into, skipping to, back to) = 45 keys, 90 clips. Cross Push-Ups needs no
clip of its own (both banks already play it from "cross" + "push ups", so `test:spoken` lists nothing for it); record "cross push ups" and its four lines
if the owner wants it as one take.

Not added, and why (21 names = 10 added + 3 already there + 6 extra loops + 2 cardio):
- Windshield Wipers: the same move as **Seated Ab Windshield Wipers**, already in the library (library-questions.md says so).
- Landmine single-arm row and Landmine single-side row: the same move, already **Landmine Single-Arm Rows** in the library.
- Extra loops of moves the app already has (no new name): Jumping Lunges (2), Weighted Punches (2), Dumbbell Bench Press, Kettlebell Swings,
  Parallel-Bar Dips, Alternating Roundhouse Kicks.
- Cardio, not an exercise entry: Treadmill sled hands on handles, Treadmill sprint.

When the owner says push the loops, attach them to these entries (the `// loop:` comments name them).

## 2. Where things stand (276 of 552 exercises have a loop; a majority is 277)

One more exercise with a loop reaches a majority. Lunge Hops was left out on purpose (two checks disagreed, the app does not describe it): the owner can say it is the same move as Jumping Lunges.
Nothing is shipped to the app until the owner says push.

## 3. Ticked on the board but never made (40 stretches)

Needs a Generate run. Six of them are exercises the app still lacks a loop for: Calf Raises, Concentration Curls, Dumbbell Shrugs, Glute Bridges, Hack Squat (Hack Squats), Kettlebell Presses.

- **Reverse Curls**: DONE 2026-11-27. Added to the library (`biceps_reverse_curls_core`) and its five coach lines (name, complete,
  straight into, skipping to, back to) recorded in both voices (bank v29).
- **"Your pace. Tap DONE when the set is done."**: nothing to record. Both phrases ("your pace", "tap done when the set is
  done") are in both banks since 2026-11-23; the note that it was silent was out of date (the comment near line 288 of
  scripts/spoken-sweeps.mjs says the same and is stale too). If the owner still hears silence on that line, it is a
  playback problem, not a missing clip.

## 4. After the app is published on the app store: film the rest (owner, 2026-11-28)

The owner films the most-used moves first (the "Film today" tab) and the rest later, slowly, once the app is on the app store.
The rest is the "Film later" tab of the filming doc, 241 moves in the same muscle and gear order, tickable:
https://claude.ai/artifact/428RJ5fSspnKYNLdTYwqey#451cc61f-26c3 (doc id 1873bb56-add3-4037-8d4e-3f7dd71dae7a). The 35 new TRX base moves
(and Ring Rows) were moved to the "Film today" tab on 2026-11-28 at the owner's request: when those clips come in, they also need library entries.

- Reminders are scheduled as one-shot tasks: **2027-02-01** (Quarter 1) and **2027-04-01** (Quarter 2 fallback), 10:00 Pacific, push to the owner's phone.
  When the owner talks about loops, exercises or recording, say in one line that the rest of the filming is due then.
- When a batch of clips comes in: add the exercises to the library (the new TRX moves are not in the app yet and need entries, group and gear),
  record the coach names in both voices (CLAUDE.md, "The coach's voice"), and attach the loops only when the owner says push.
- The list's data is from the board of 2026-11-21; re-run `exercise-loops/board/gen-list.mjs` before the reminder is acted on, because loops
  approved since then are not taken off it.
