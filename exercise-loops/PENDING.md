# Waiting on the owner (read this first, and remind them)

Written 2026-11-22. The owner said: do not record now, remind me later, and tell me what is submitted and what is missing.

## 1. Reminder: new exercise names still to be added and recorded

Approved loops that show moves the app has no exact entry for. Not added to the library, not recorded. When the owner says go,
follow the voice rule in CLAUDE.md (add the exercises, run `npm run voice:coverage` and `npm run -s test:spoken`, record every new name in both voices).
Candidates (21 names, 24 loops in `factory-loops/`):

- Lat pulldowns: Lat Pulldowns, Close-Grip, Wide-Grip, Single-Arm (4 loops)
- Bulgarian Jump Lunges with High Knee (2), Squat to Fake Thai Roundhouse, Stienborn Squat, Alternating Dumbbell Punches to the Sky,
  Windshield Wipers, Crossed-Leg Crunches, Cross Push-Ups, Landmine single-arm / single-side row (2)
- Extra loops of moves the app already has (no new name): Jumping Lunges (2), Weighted Punches (2), Dumbbell Bench Press, Kettlebell Swings,
  Parallel-Bar Dips, Alternating Roundhouse Kicks
- Cardio, not an exercise entry: Treadmill sled hands on handles, Treadmill sprint

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
