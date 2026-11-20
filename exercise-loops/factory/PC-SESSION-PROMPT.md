Two jobs for the Exercise Loop Board (https://claude.ai/artifact/PyNEAD4AtbxzpoFu3S1Wst).
The board now has a cut editor that plays each WHOLE video, so it needs a small copy of every video you scanned.
Write only to the db collections "clips", "srcs" and (when scanning new footage) "segs". Never write to "items": that is mine.
Every segs document you add (a scan, a cut) carries newAt: <now, ISO>. The board lists those stretches at the top of RAW FOOTAGE until I name, tick or skip them.

JOB 1 (now, and from now on at every scan): a whole-video copy of each video
For every clipId in "segs" (its folder and file say where the original is):
1. ffmpeg -i "<original>" -an -vf "fps=15,scale=480:480:force_original_aspect_ratio=decrease:force_divisible_by=2,format=yuv420p" -c:v libx264 -preset slow -crf 34 -g 15 -keyint_min 15 -sc_threshold 0 -movflags +faststart "<clipId>-proxy.mp4"
   No -ss and no trim: second 0 must be the original's second 0 (every time on the board is in seconds of the original).
   Over 20 MB: run it again with -crf 38, then with fps=12.
2. Upload it to the board as an asset (Artifact tool: url = the board, asset: true; up to 25 files per call).
3. Write db document "clips/<clipId>": { clipId, folder, file, dur: <seconds of the original, the same number as clipDur in segs>, proxy: <asset id>, w, h, fps: 15, updatedAt: <now, ISO> }.
After the first 20, check the board's storage (Artifact list, scope "assets": it shows the use out of 1 GB). At the end tell me how many clips documents you wrote, the total size, and any video that failed.

JOB 2 (when I say "export the queue")
1. Read db document items/control.queue: its "ids". For each id the stretch is segs/<id>, or, when there is none, items/add.<id> (a stretch I added on the board: clipId, folder, file, start, end).
2. Its cut: items/seg.<id> "from" and "to" when set, else the stretch's start and end. Take the cut with 0.5 s more on each side (inside the video). If that is longer than 40 s, take the middle 40 s.
3. ffmpeg -ss <from> -i "<original>" -t <to minus from> -an -vf "scale=1280:1280:force_original_aspect_ratio=decrease:force_divisible_by=2,format=yuv420p" -c:v libx264 -preset medium -crf 20 -movflags +faststart "<id>-src.mp4"   (over 20 MB: -crf 24)
4. Upload it to the board as an asset and write db document "srcs/<id>": { segId: <id>, clipId, asset: <asset id>, from, to, w, h, fps: <its frame rate>, exportedAt: <now, ISO> }.
5. Tell me how many you exported and any that failed. I then tell the cloud session: run the queue.

JOB 3 (when I say "split the parked videos")
The board has a tick "This video shows several workouts" (db document items/seg.<id>, field split: true). Those videos show several different exercises in one stretch, and each exercise needs its own stretch.
1. List the items documents with split == true. For each one, the stretch is segs/<id> (clipId, file, start, end); items/seg.<id> has my note, if any, as a hint (for example "Around the world catch").
2. Cut each video into one stretch per distinct exercise, between the start and end of that stretch (the repo's exercise-loops/factory/tools/split2.mjs and strip.mjs can be used; or look at the video yourself). Drop setup, rest and walking. Name each exercise as well as you can.
3. Write one db document segs/<clipId>-w01, -w02, ... for each exercise, in the same fields as the other segs (clipId, folder, file, clipDur, idx, start, end, period, reps, kind "exercise", group, guess { name, entryId, confidence, view }, strip, preview, state "ready", warn [], why "", newAt <now, ISO>). Make the strip and preview assets like the other stretches. Then delete the long stretch segs/<id> it replaces (do not touch items).
4. Tell me which videos you split, how many exercises each gave, and any you could not split. I then un-park them on the board and you name and tick the parts.

