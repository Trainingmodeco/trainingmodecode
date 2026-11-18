# Exercise loops (staged, not shipped)

Violet outline avatar demo loops for exercises, made 2026-11-14 to 2026-11-17. They are **not** part of the app yet. This folder is outside `public/`, so the Expo build and Netlify do not ship it. The owner's rule: push to the app once most of the workouts are animated, not all of them.

## What is here

| Path | What |
| --- | --- |
| `loops/<id>.mp4` | 45 loops. 640x640, h264, no audio, about 1 to 5 s, about 11 MB in total. |
| `posters/<id>.webp` | 320 px still of each loop (a frame at about 35 percent). |
| `originals/` | The three loops before ghost frames were trimmed (`narrow-squats`, `zercher-squats`, `snatch-to-zercher-squat`). |
| `loops.json` | Per loop: file, poster, size, duration, where it came from, flags. |
| `catalog.json` | Every exercise the app can ask for (library, Quick Mission pool, mission moves) with which loop shows it. `match` is `direct` (shows exactly that move), `close` (a variation that could stand in), `none`, or `new` (loop has no library entry yet). |
| `usage.json`, `usage-unmatched.json` | How often the app puts each move in front of a person (programs weigh most), and the moves programs show that the library does not have. |
| `new-exercises.draft.js.txt` | Draft library records for 13 of the 16 new exercises. Rename to `.js` to use. All copy needs the owner's review. |
| `exercises-to-submit.md` | The 363 exercises that still need a video, most used first. |
| `board/` | Source of the Exercise Loop Board artifact (`index.html`), the data it loads (`board.json`), the scripts that build that data (`merge.mjs`, `gen-list.mjs`) and its tests (`test/`). |
| `factory/` | The Loop Factory: the tools and runbook that turn raw workout footage into loops. See below. |
| `contact-sheet.jpg` | All 45 posters in one picture. |

## The 16 new exercises

These loops have no library exercise yet: seated-cable-rows, straight-arm-pulldowns, alternate-arm-dead-hang, hanging-knee-raises, heel-touches, barbell-clean, pull-up-hold, landmine-rows, zercher-squats, reverse-lunge-knee-drives, front-barbell-squats, pull-up-negatives, wide-grip-pull-ups, decline-pike-push-ups, seated-knee-tucks, tuck-ups.

Three of them (zercher-squats, reverse-lunge-knee-drives, front-barbell-squats) already exist as mission or Quick Mission moves, so the draft file has records for the other 13 only.

## Known loop issues

- `alligator-push-ups`: was starting from a blank frame (dipped dark on every repeat). Re-cut on 2026-11-18 from the original render; the pre-recut file is not kept.
- `reclined-leg-raises`: 0.93 s, shorter than the others.
- `pistol-squats`: slight judder in the fast part.
- `wide-grip-pull-ups`: two versions exist. This is the newest (from the owner's 2026-11-16 clip). The older one was 1.9 s with a closer frame.
- Squat loops: the owner is naming them on the board. `squats` is a bodyweight squat at about shoulder width. No loop shows a clearly wide stance.

## To push these into the app (not started)

1. Add the approved new exercises to the library data (`components/training-mode/fit-mode/fitModeExerciseDataCore.js`), from the draft file.
2. Record every new exercise name in both coach voices. See `CLAUDE.md` ("The coach's voice"). `npm run voice:coverage` and `npm run -s test:spoken` fail until the names have clips.
3. Copy the loops to `public/static/exercise-demos/<exercise id>.mp4` and add a video branch to the info sheet demo panel (`data/exerciseInfo.js`, `shared/ExerciseInfoSheet.jsx`). Show the loop in the guided player, Quick Mission and the at-your-pace list where there is room (concept page: "Timer Screen Concepts").
4. Run `npm run check:all`.

## The Loop Factory (raw footage to loops)

Published board: https://claude.ai/artifact/PyNEAD4AtbxzpoFu3S1Wst (its database holds the stretches and the owner's choices; this folder holds the code).

The flow: a session on the owner's PC scans the raw footage and writes `segs` (one document per exercise stretch), `clips` (a small copy of each whole video for the cut editor) and, on request, `srcs` (the source clip of each queued stretch). The owner names, cuts and ticks stretches on the board and presses Generate. A cloud session then renders each one on Higgsfield (motion transfer onto the violet avatar, 480p, about 4 credits a loop), cuts the loop and writes it back to the board's REVIEW tab for Approve, Redo or Reject.

| Path | What |
| --- | --- |
| `factory/RUNBOOK.md` | The step-by-step procedure, the budget and retry rules, and the contract for every collection (section 0 covers footage on the PC). |
| `factory/PC-SESSION-PROMPT.md` | What to paste into the PC session: make the whole-video copies (`clips`) and export the queue (`srcs`). |
| `factory/tools/` | Node 22 + ffmpeg tools. `scan.mjs`, `split*.mjs` (find exercise stretches in a long video), `prep.mjs` (crop to the athlete, pick one clean rep, cut the driving clip), `cut.mjs` (render to a seamless loop), `queue-plan.mjs`, `result-doc.mjs`, `run-log.mjs`, `db-docs.mjs`, `dups.mjs` and the rest. Each prints its usage when called wrongly. |

On the board, each stretch has a cut editor (CUT THE VIDEO): watch the whole video, drag or step the start and end, split a stretch, add one Claude missed, or go back to the auto cut. Stretches that repeat an exercise already looped or already chosen are hidden (only when the guessed name is 60 % sure or more, never one you touched); Show them brings them back.

### Tests

```
node exercise-loops/board/test/build.cjs     # wraps index.html with the mock runtime (needs Playwright, Node 22)
node exercise-loops/board/test/smoke.cjs      # 210 checks, runs fixes.cjs and extra checks too
node exercise-loops/board/test/cut.cjs        # cut editor, 56 checks
node exercise-loops/board/test/cut-fixes.cjs  # replays of the review findings with real touch, 34 checks
node exercise-loops/board/test/dups.cjs       # duplicate hiding, 20 checks
```

`board/test/index.html` and `board/test/board.json` are written by `build.cjs` and are not committed. Run the scripts from `exercise-loops/board/test/` or anywhere: they find their own files. The splitter's accuracy test set (11 videos with truth files) is not in the repo: the videos are large.

### Not here

The loop made through the factory so far (Vertical Leg Crunches, 4 credits) is waiting for the owner's verdict on the board, so it is not in `loops/`. The raw footage and the PC session's scan live on the owner's PC and in the board's database.
