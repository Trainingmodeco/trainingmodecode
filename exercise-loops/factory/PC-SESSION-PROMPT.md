Two jobs for the Exercise Loop Board (https://claude.ai/artifact/PyNEAD4AtbxzpoFu3S1Wst).
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
