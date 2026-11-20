Jobs for the Exercise Loop Board (https://claude.ai/artifact/PyNEAD4AtbxzpoFu3S1Wst).
The board now has a cut editor that plays each WHOLE video, so it needs a small copy of every video you scanned.
Write only to the db collections "clips", "srcs" and (when scanning new footage) "segs". Never write to "items": that is mine.

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

JOB 2b (when I say "export the ticked stretches", or "clips for the cuts"): the same clips, without the queue button
The queue button has not been pressed, so items/control.queue does not exist. The stretches I ticked and named are listed in the repo, in exercise-loops/factory/export-plan.json (git pull the branch claude/fight-mode-improvements-se9gas first): 138 stretches in 133 videos, each with folder, file and start / end (my cut when custom is true, else the scan's stretch). Do not read items/control.queue for this job.
1. node exercise-loops/factory/tools/export-clips.mjs exercise-loops/factory/export-plan.json "<the footage folder: TM Social Console folder>" <outDir>
   It makes <outDir>/<id>-src.mp4 for each (the cut with 0.5 s either side, at most 40 s, 1280 px, crf 20, no audio, at most 20 MB) and <outDir>/srcs.jsonl (one line per clip, its "doc" is the srcs document without the asset id). It skips what it has already made, so it can be run again; "failed" in its last line lists what it could not make and why.
2. Upload each <id>-src.mp4 to the board as an asset (Artifact tool: url = the board, asset: true; up to 25 files per call; the board holds 1 GB, so check "assets" usage after the first 25).
3. For each uploaded clip write db document "srcs/<id>" = the line's "doc" with "asset" set to the uploaded asset's id (32 characters). Write nothing to "items".
4. Tell me how many you uploaded, the total size, and the ids that failed with the reason. Then tell the cloud session: run the queue (the stretches to render are the ones with a srcs document, ticked and named; it asks me for the go-ahead and the credit budget first).

JOB 3 (when I say "split the parked videos")
The board has a tick "This video shows several workouts" (db document items/seg.<id>, field split: true). Those videos show several different exercises in one stretch, and each exercise needs its own stretch.
1. List the items documents with split == true. For each one, the stretch is segs/<id> (clipId, file, start, end); items/seg.<id> has my note, if any, as a hint (for example "Around the world catch").
2. Cut each video into one stretch per distinct exercise, between the start and end of that stretch (the repo's exercise-loops/factory/tools/split2.mjs and strip.mjs can be used; or look at the video yourself). Drop setup, rest and walking. Name each exercise as well as you can.
3. Write one db document segs/<clipId>-w01, -w02, ... for each exercise, in the same fields as the other segs (clipId, folder, file, clipDur, idx, start, end, period, reps, kind "exercise", group, guess { name, entryId, confidence, view }, strip, preview, state "ready", warn [], why ""). Make the strip and preview assets like the other stretches. Then delete the long stretch segs/<id> it replaces (do not touch items).
4. Tell me which videos you split, how many exercises each gave, and any you could not split. I then un-park them on the board and you name and tick the parts.

