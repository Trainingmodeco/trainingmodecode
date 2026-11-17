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
| `board/` | Source of the Exercise Loop Board artifact (`index.html`) and the data it loads (`board.json`). |
| `contact-sheet.jpg` | All 45 posters in one picture. |

## The 16 new exercises

These loops have no library exercise yet: seated-cable-rows, straight-arm-pulldowns, alternate-arm-dead-hang, hanging-knee-raises, heel-touches, barbell-clean, pull-up-hold, landmine-rows, zercher-squats, reverse-lunge-knee-drives, front-barbell-squats, pull-up-negatives, wide-grip-pull-ups, decline-pike-push-ups, seated-knee-tucks, tuck-ups.

Three of them (zercher-squats, reverse-lunge-knee-drives, front-barbell-squats) already exist as mission or Quick Mission moves, so the draft file has records for the other 13 only.

## Known loop issues

- `alligator-push-ups`: starts from a blank frame, so it dips dark on every repeat. Needs a re-cut.
- `reclined-leg-raises`: 0.93 s, shorter than the others.
- `pistol-squats`: slight judder in the fast part.
- `wide-grip-pull-ups`: two versions exist. This is the newest (from the owner's 2026-11-16 clip). The older one was 1.9 s with a closer frame.
- Squat loops: the owner is naming them on the board. `squats` is a bodyweight squat at about shoulder width. No loop shows a clearly wide stance.

## To push these into the app (not started)

1. Add the approved new exercises to the library data (`components/training-mode/fit-mode/fitModeExerciseDataCore.js`), from the draft file.
2. Record every new exercise name in both coach voices. See `CLAUDE.md` ("The coach's voice"). `npm run voice:coverage` and `npm run -s test:spoken` fail until the names have clips.
3. Copy the loops to `public/static/exercise-demos/<exercise id>.mp4` and add a video branch to the info sheet demo panel (`data/exerciseInfo.js`, `shared/ExerciseInfoSheet.jsx`). Show the loop in the guided player, Quick Mission and the at-your-pace list where there is room (concept page: "Timer Screen Concepts").
4. Run `npm run check:all`.
