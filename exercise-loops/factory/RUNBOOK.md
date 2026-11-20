# Loop Factory runbook

How Claude turns a folder of raw workout footage into avatar loops on the board. Two procedures: **A. scan a folder** (free) and **B. run a queue** (costs credits). Follow the steps in order.

```
T=<repo>/exercise-loops/factory/tools
RAW=<the folder of raw videos>          # one sub-folder per topic, e.g. "push-ups/", "barbell workouts/"
WORK=/home/user/trainingmodecode/.loop-factory/<name>   # everything the tools write; kept between runs; never inside RAW
BOARD=<the board's claude.ai artifact URL>
BOARDJSON=<the board's board.json: { entries: [{ id, name, kind, ... }] }, the file the board was built from>
DB=$WORK/dbexport                       # where the board's database is saved for the tools to read
```

**$WORK must live under the session's working directory** (`/home/user/trainingmodecode/.loop-factory/<name>`), because the Artifact tool takes a group of files (`file_paths`) only from there; a file outside it goes in a call of its own. The runner lists the folder in `.git/info/exclude` once (`echo '.loop-factory/' >> /home/user/trainingmodecode/.git/info/exclude`), so it is never committed. If `$WORK` is somewhere else, upload one file a call with `file_path` (A4, B10).

Tools needed: Node 22, ffmpeg, ffprobe. `overview.mjs` also needs Playwright (`NODE_PATH=$(npm root -g)`). Every tool prints one line of JSON on stdout and its usage text when called wrongly.

The database: collection `segs` (one document per stretch, id `<clipId>-<nn>`) is written **only by Claude**. Collection `items` is written **only by the board page**: `seg.<segId>` holds the owner's choices, `add.<id>` a stretch the owner added (section 0) and `control.queue` the queue request. Never write to `items`. Every `segs` document Claude adds (a scan, a cut into parts) carries `newAt` (ISO time, now): the board lists a stretch with a recent `newAt` that the owner has not yet ticked or skipped, and every video the owner parked with "This video shows several workouts", in a NEW AND TO CUT group at the top of RAW FOOTAGE (21 days at most). Without `newAt` a new stretch sits in its folder like the old ones.

**Standing answers of the owner** (write each with its date when given):
- Unlimited generations or credits (Higgsfield's `unlim_choice` question): **not answered yet (asked 2026-11-17)**. Until it is: credits only, every submission carries `use_unlim: false` (B8 step 3), so the question never comes up. See B8 step 4.

## 0. Footage on the owner's PC (from 2026-11-18)

The raw footage lives on the owner's Windows PC (`C:\Users\murde\Desktop\TM APP 2026\TM Social Console folder\<folder>`), where a Claude Code session (the "batch" session) can read it. That session does the scan (procedure A: it wrote the 261 `segs` of 2026-11-18 for folders kettlebell, bodyweight workout 1, various kb home tm fitness workouts, tm ode fit) and everything else that needs the original files. This cloud session never sees the originals: it renders from clips the batch session sends through the board.

New collections and documents (the board reads all of them):
- `clips/<clipId>`, written by the batch session at scan time: `{ clipId, folder, file, dur, proxy, w, h, fps, updatedAt }`. `proxy` is the asset id of the WHOLE video, small (longest side 480, 15 fps, a key frame every second, h264 crf about 34, no audio, +faststart, at most 20 MB), whose time 0 is the original's time 0 (no trim, no -ss): the cut editor on the board plays it, and every time on the board is in seconds of the original.
- `items/add.<clipId>-uNN`, written by the PAGE when the owner presses Split here or Add a stretch here: `{ kind: "add", segId, clipId, folder, file, clipDur, start, end, fromSeg, createdAt, updatedAt }`. The board shows it as a stretch of its own until a `segs/<same id>` exists; its choices are in `items/seg.<id>` like any other. It can be in `control.queue.ids`.
- `items/seg.<id>.split` (boolean, the owner's tick "This video shows several workouts"): the stretch is parked, never rendered, and the queue takes it out (queue-plan.mjs skips it with a reason). Claude or the PC session cuts such a video into one stretch per workout (PC-SESSION-PROMPT.md, job 3); the owner can also use the cut editor on the board. Do not confuse it with `hold` ("This is a hold": one still pose such as a plank, made as a still loop): a stretch marked hold with no from / to, over 40 s and with no still part found by the scan is skipped by queue-plan.mjs as well.
- `srcs/<segId>`, written by the batch session when the owner says "export the queue": `{ segId, clipId, asset, from, to, w, h, fps, exportedAt }`: `asset` is the source clip to render from (the owner's cut with 0.5 s either side, longest side at most 1280, h264 crf 20, no audio, at most 40 s: the middle 40 s of a longer cut), `from`/`to` its place in the original, in seconds.

The cut of a stretch, everywhere: `items/seg.<id>.from` / `.to` when set (the owner's), else the stretch's `start` / `end` (Claude's auto cut, or where the owner added it).

Running a queue with the footage on the PC (replaces "prep from $RAW" in B4):
1. B1 as written; an id with no `segs` document is an added stretch: read `items/add.<id>` for its clip and range, and before marking it `generating` write `segs/<id>` with `{ clipId, folder, file, clipDur, idx: 100 + NN, start, end, kind: "exercise", guess: null, warn: [], why: "", added: true }` (the board then shows Claude's copy).
2. For each item read `srcs/<id>`. Missing: stop and tell the owner to say "export the queue" in the batch session; never render from the 12 s preview.
3. Download it: Artifact `read` with `url: BOARD` and `path: <asset>` (saved under the scratchpad); run prep.mjs on that file with `--start <cutFrom - from> --end <cutTo - from>`.
4. Everything after (B5 to B11) as written.

---

## A. Scan a folder (no credits)

**A1. Scan.**
```
node $T/scan.mjs "$RAW" "$WORK"
```
One line per video, then a JSON summary. A second run only handles new videos. A video that was moved or renamed keeps its id and its names. `--force` splits again and keeps the id of every stretch that still covers the same seconds. Read the lines: `FAILED` (unreadable file), `left out: the same video as ...` (a copy), `found only by the second splitter` (low score, look at it), `exercise(s) joined from pieces` (A2), `stretch(es) with a loop NO LONGER FOUND` (a re-split lost a stretch that had a loop: it stays on the board, see A5), `still stretch(es) that may be a hold`.

**A2. Look.**
```
NODE_PATH=$(npm root -g) node $T/overview.mjs "$RAW" "$WORK"
```
Read every picture in `$WORK/overview/` with the Read tool. The label of each row says what the scan wrote: `why`, `WARN` (every warning), `HOLD?` (a still stretch of 4 s or more: a plank, a hang, or a rest) and `JOINED` (see below). For each exercise stretch decide the name, the board entry it belongs to and the camera view (`front`, `side`, `back`, `other`). Do not trust the numbers alone: check that each exercise stretch really shows one exercise, and that junk is junk. A junk stretch with `HOLD?` may be a plank or a hang: if it is one, name it (A3), so the board shows it.

For **every `JOINED` row** (the scan joined pieces of an exercise done on alternating sides, such as cross push-ups): look at the strip. If the pieces are one exercise, go on. If they are different exercises (the second one has no document of its own), undo it for that video and look again:
```
node $T/scan.mjs "$RAW" "$WORK" --only <part of the video's path> --force --no-join
```
A joined stretch always scores 0.6 at most and says "Joined from N pieces: check it is one exercise" in `warn`; the board shows it.

**A3. Name.** Never edit `segs.json` by hand.
```
node $T/name.mjs "$WORK" --template "$WORK/names.json"     # a skeleton: one row per unnamed exercise stretch and per still junk stretch
```
Fill `name`, `view`, `confidence` (0.9 sure, 0.6 likely, 0.3 a guess) for the rows you name and delete the others (Write tool). `entryId` is the board entry the exercise belongs to; leave it out and the tool looks the name up in `$BOARDJSON` (`entries[].id`: same name ignoring case, punctuation and a plural s; kind `library` first, then `quick`, `mission`, `program`, `new`); an exercise the board has no entry of gets `null` and is listed under `noEntry`.
```
node $T/name.mjs "$WORK" "$WORK/names.json" --board "$BOARDJSON"
```
It sets `updatedAt` on each named stretch and lists what it skipped and why.

**A4. Upload the pictures** (strip and preview of every stretch) as assets of the board artifact.
```
node $T/db-docs.mjs "$WORK" --uploads        # -> { groups: [[up to 25 files], ...] }
```
For each group, one Artifact call: `{ action: "publish", url: BOARD, asset: true, file_paths: [the group] }` (needs `$WORK` under the working directory, see above). Try the first group alone and read which files it refused; if none went through, upload one file a call with `file_path`. The result gives an id for each file. Write them to a file `$WORK/uploaded.json` as `{ "<file name>": "<asset id>", ... }` (Write tool), then
```
node $T/db-docs.mjs "$WORK" --assets "$WORK/uploaded.json"
```
Repeat until `--uploads` prints `"files": 0`. A file that fails to upload: try that one once more on its own, then go on without it (the stretch shows no picture).

**A5. Write the stretches to the board.**
0. Empty the export folder (a step of its own, every time): `node $T/db-docs.mjs "$WORK" --clear-export "$DB"`. ArtifactData only writes the documents that exist now, so a file left from an earlier export would be read as current.
1. Save what is on the board: ArtifactData `{ action: "list", url: BOARD, collection: "segs", out_dir: DB, query: { limit: 1000 } }` (follow `next_cursor` if there is one). On a board with no `segs` yet this saves nothing: then leave `"$DB"` out of the next command.
2. `node $T/db-docs.mjs "$WORK" "$DB"` -> `{ set, update, delete, same, keptWithLoop, batches: [files] }`. It refuses an export whose files were written more than 30 minutes apart (step 0 was skipped).
3. For each file in `batches`: Read it and pass its content as `writes` of ArtifactData `{ action: "batch", url: BOARD, writes: [...] }` (at most 50 per call; every entry points to its document by `file_path`, existing documents are pinned by `if_version`).
4. If a batch is refused because a document changed: do steps 0-3 again. Never drop the `if_version`.

Tell the owner: how many videos, exercise stretches and junk stretches, which stretches carry a warning, which were joined from pieces, which may be holds, what failed, and `keptWithLoop`: board documents that a re-split no longer finds but that have a loop or a render: they were NOT deleted, the owner decides.

---

## B. Run a queue (credits)

The owner picks stretches on the board and presses the queue button. That writes `items/control.queue` = `{ requestedAt, count, cap, ids }`. `cap` is the most credits this request may spend. **One press is one request**: `$WORK/queue-runs.json` (kept by `run-log.mjs`) remembers for each `requestedAt`: `{ requestedAt, cap, startBalance, spent, largest, finished, jobs: { segId: jobId }, items: { segId: { cost, outcome, jobs } } }`. A request that is finished is never run again; a request that was cut short is resumed with what it spent, not with a fresh cap.

**B1. Read the request.**
0. Empty the export folder (a step of its own, every time): `node $T/db-docs.mjs "$WORK" --clear-export "$DB"`.
1. Export: ArtifactData `{ action: "list", url: BOARD, collection: "items", out_dir: DB, query: { limit: 1000 } }` and the same for `collection: "segs"` and `collection: "srcs"` (the source clips the batch session sent: section 0). queue-plan.mjs takes the board's `segs` over the work folder's segs.json, plans the owner's added stretches (`items/add.<id>`), and plans from `srcs` when there is one for the item: then `item.src.asset` is downloaded first (Artifact `read` with `url: BOARD`, `path: <asset>`, saved to `item.source`), and `item.prep` already counts its times from the clip's start. **STOP if the export has no `control.queue` in `items`** (`$DB/items/control.queue.json` missing, or it holds null): the owner has not pressed the button; nothing is rendered without a request.
2. `node $T/queue-plan.mjs "$WORK" "$DB"` (a resumed request: add `--spent <the spent that run-log.mjs start printed>`) -> `{ stop, requestedAt, cap, count, spent, resumed, estEach, estCredits, items, skipped, overCap, stuck }`.
   - `stop` is not null: the request was already run to the end. Stop, tell the owner what that run made (`run-log.mjs $WORK show --requested-at <t>`) and that they press the button again for more.
   - `items` is the work list, in the owner's order. Each item: `segId, name, entryId, source, start, end, span` (where the times come from: `scan`, `owner`, `owner and scan`, ...), `spanNote` (said whenever the times used are not exactly what the owner typed: read it), `crop` (null when the scan's box was left out: see `cropNote`), `scanCrop, cropNote, period, hold, redoNote, estCredits, view, refImage, kind` (`exercise` or `junk`), `warn` (the scan's warnings), `prep` (the arguments for prep.mjs). The owner's from / to win over the scan's. A stretch is planned only if the owner's document still says queued (or carries a live redo), is not marked skip and does not have the verdict approved or rejected; a redo asked for an EARLIER loop is not repeated.
   - `skipped` and `overCap` are reported to the owner at the end, with their reasons; nothing in them is rendered.
   - If `items` is empty, stop and say why.
3. `stuck`: stretches left in state `generating` by a run that died. For each: if a job is noted, poll it with `jobs_wait` (never submit it again) and finish that item from B9 on; if none is noted, `node $T/result-doc.mjs <segId> --state back --db "$DB" --work "$WORK"` (back to review when it has a loop, else ready) and write the printed JSON as in B10; if the balance fell more than the costs in `queue-runs.json` explain, tell the owner: a job may have been submitted without being noted.

**B2. Load the paid tools, note the balance, open the request.** ToolSearch `select:mcp__Higgsfield__media_upload,mcp__Higgsfield__media_confirm,mcp__Higgsfield__generate_video_batch,mcp__Higgsfield__estimate_video_cost,mcp__Higgsfield__jobs_wait,mcp__Higgsfield__balance`. (A notice may say the Higgsfield server failed to connect; try the tools all the same. If they do not load, stop: nothing can be rendered.) Call `balance` once: `START`. Then
```
node $T/run-log.mjs "$WORK" start --requested-at <requestedAt> --cap <cap> --balance <START> --count <count>
```
Exit 3 = this request was finished already: stop (B1 step 2, `stop`).

**The budget rule** (the tool does the arithmetic, from the balance, never from guessing):
- **At the top of every item**, before any work on it: `balance`, then `node $T/run-log.mjs "$WORK" budget --requested-at <t> --balance <balance now>`. E = the largest real cost of an item seen so far in any request (6 before the first). It is ok only if `spent + E <= cap`. Exit 3 = STOP: submit nothing more, touch nothing more; every item not yet made stays as it is and is listed for the owner as "not made: the cap was reached". Never spend past the cap to finish an item.
- **Before every submission** (first tries and retries alike): ask the price of that exact request (B8 step 1) and run `run-log.mjs budget ... --quote <credits>`: ok only if `spent + price <= cap`. Exit 3 = STOP, as above.
- `spent` is `START - balance now`, and never less than the costs noted with `run-log.mjs item`.

**Work through `items` one at a time, B3 to B10.** Order matters: everything free (prep, look, prompt, upload) comes first; the stretch is marked `generating` only just before the paid submission.

**B3. Top of the item: the budget rule** (above).

**B4. Prep** (free). Run prep.mjs with the item's `prep` arguments:
```
node $T/prep.mjs <item.prep...>
```
That is `<source> --start --end [--crop w:h:x:y] [--period s | --hold] --out $WORK/prep/<segId>`. It prints `{ start, repLength, clipLength, footage, frames, crop, warnings, ... }` and writes `$WORK/prep/<segId>.mp4` (the 720x720 driving clip), `-sheet.jpg` and `-check.jpg`.
- `repLength` is the ONE clean repetition (cut.mjs `--seconds` takes it in B10). `clipLength` is the length of the driving clip: real footage from the rep's start for `max(4, ceil(repLength + 0.4))` whole seconds, with exactly `clipLength x 30` frames: Higgsfield never renders under 4.0 s and rounds to whole seconds. `footage` is `real`, or `looped` when the span was too short and the rep was repeated (a warning says so; a wider `--start`/`--end` helps). A hold gives 4 s of the steadiest footage (`footage: held` = 3 s and the last frame held).
- Exit 0 = clip written. Exit 1 = the span cannot be used (too short for a rep, or under 3 s as a hold): the item fails (B10, no credits spent). Exit 2 = bad arguments or an unreadable file (message on stderr): look at the message; the span may lie outside the video; fix the arguments once, else the item fails (B10, no credits spent).

**B5. Look at the check picture and the sheet** (Read both). Go on only if:
- the whole body is inside the red box in the check picture, with the bar, dumbbells or bench the exercise uses; nobody else is in the box;
- the sheet (two rows) shows, in the top row, ONE whole repetition (it ends where it starts) and, in the bottom row, the whole driving clip with the reps following each other (two reps are visible when the rep is under 2 s); for a hold a still body in both rows;
- every warning prep.mjs printed has been read and is harmless for this clip.

If the body is cut off, run prep.mjs again with a wider box: the check picture is drawn 480 px wide (or tall), so take the numbers from `crop` in prep's JSON (full pixels of the picture), widen them, and pass `--crop w:h:x:y --exact-crop` (exact = the box as given, not merged with or narrowed to what moves). If the box is far too wide for the athlete, prep.mjs already narrowed it (warning, blue box = the box given). If the repetition is half a rep or two reps, run it again with a better `--period`, or a narrower `--start`/`--end`. If `redoNote` is set, it is the owner's complaint about the last loop: change the crop, the span or the prompt so that it is answered. If no usable clip comes out after two tries, the item fails (B10) without spending credits; it was never marked generating, so the document stays as it was.

**B6. Write the motion prompt.** One paragraph, built from these blocks (from batch 6, proven):

- Reference picture by camera view: **back view -> BACK, every other view -> FRONT**.
  - FRONT = `eb56d9ea-c749-4fcd-9eb9-236531afc656`
  - BACK = `aa0b5c45-9d02-432c-8438-59175a4b1c9a`
- Opening: `The character from the reference image, seen from <the side | the front | behind>, <start position>, <the movement, step by step>, then <the way back> (<plain name of the exercise>).` Describe what you SEE in the sheet, in the order it happens, one repetition. For a hold: `... holds <the position> perfectly still (<name>).`
- Equipment, only what is in the clip:
  - barbell: `Keep the barbell: one straight bar with a round weight plate on each end, drawn as a glossy dark violet bar and plates with glowing neon magenta edges.`
  - dumbbells: `Draw each dumbbell as a short glossy dark violet bar with a round weight on each end and glowing neon magenta edges.`
  - bench or seat: `Draw the bench as one simple dark violet block with glowing neon magenta edges under the <back | hips>.`
  - pull-up bar: `Draw the bar as a thin glowing gold bar that stays still at the top.` (dip bars: `Draw the two bars as thin glowing gold bars that stay still at hip height.`)
- Background, always: `Plain flat very dark purple studio background, colour #0a0014, empty space with no scenery: no gym, no machines, no rack, no mirrors, no posts, no sky, no grass, no people, no mat, no other objects, only a faint violet glow on the floor under the body.`
- Emblems, always, last:
  - with FRONT: `The gold emblem on the chest and the small gold emblems on the upper arms keep exactly the same shape, size and place on the body throughout, and no emblem appears anywhere else.`
  - with BACK: `The large gold emblem on the upper back and the small gold emblems on the upper arms keep exactly the same shape, size and place on the body throughout, and no emblem appears anywhere else.`
- If someone else was in the raw picture: add `Only this one character, nobody else in the picture.`

**B7. Upload the driving clip** (free).
1. `media_upload` with `files: [{ filename: "<segId>.mp4", content_type: "video/mp4" }]` -> `media_id`, `upload_url`.
2. `curl -sS -o /dev/null -w '%{http_code}\n' -X PUT -H 'Content-Type: video/mp4' --data-binary @"$WORK/prep/<segId>.mp4" '<upload_url>'` must print 200. Never disable TLS checks, never unset the proxy variables.
3. `media_confirm` with `type: "video"`, `media_ids: [media_id]`: must say uploaded.

**B8. Price, mark, submit, wait** (the paid step; one item per call so its cost is known).
1. **Price.** `balance` -> `B0`. Ask what exactly this request costs: `estimate_video_cost` with `params` = the very `params` of step 3 (same model, resolution, prompt, medias). It submits nothing. (On 2026-11-18 `generate_video` with `params.get_cost: true` was seen to answer `{ cost: { credits } }`, a 4 s 480p flash render costing 4 credits; the tool's own schema of the same day says it does not accept `get_cost` and points to `estimate_video_cost`. Use `estimate_video_cost`; if `generate_video` is ever used for the price and it answers with a job id instead of a price, a render was submitted by mistake: note the job at once with `run-log.mjs job` and count its cost.) Then `node $T/run-log.mjs "$WORK" budget --requested-at <t> --balance <B0> --quote <credits>`. Exit 3 = STOP (the budget rule). If no price can be had, the price is E and the report says so.
2. **Mark it**, only now: `node $T/result-doc.mjs <segId> --state generating --db "$DB" --work "$WORK"`, then ArtifactData `{ action: "update", url: BOARD, collection: "segs", doc_id: <segId>, if_version: <version>, data: <the JSON line it printed> }` (the tool prints the whole call on stderr). `generating` keeps the loop, poster and cost the stretch has: a redo's old loop stays on the board until the new one is there. Keep the `version` this write returns: B10 needs it. **If this write fails, submit nothing for this item** (read the document, write again once; still failing: the item is not made, say so in the report).
3. **Submit.** `generate_video_batch` with `requests: [ { index: 0, params: { model: "hf_mult_motion_control_flash", resolution: "480p", use_unlim: false, prompt: <the prompt>, medias: [ { value: <FRONT or BACK id>, role: "image_references" }, { value: <media_id>, role: "video_references" } ] } } ]` and `context: "Motion transfer of an exercise clip onto a stylised character for a fitness demo loop."` No other parameter (no `duration`: the render takes the driving clip's whole seconds; `use_unlim` is `false` until a dated standing answer at the top says otherwise). The answer holds the job id: **at once** `node $T/run-log.mjs "$WORK" job --requested-at <t> --seg <segId> --job <job id> --seconds <clipLength> [--hold]`. **If the call errors or times out with no job id, the outcome is unknown: never submit it again in this run.** Call `balance`: if it fell by about the quote, a job was made (bill it); either way `run-log.mjs item --seg <segId> --cost <the fall, or E> --outcome unknown`, write the stretch `failed` with `--error "outcome unknown: the submission gave no job id"` (B10), and name it in the report.
4. **If the tool answers with `unlim_choice` instead of submitting** (it submitted nothing): that question belongs to the owner, never to Claude. Submit nothing more. If a dated standing answer is written at the top, call again with the same params and that answer as `use_unlim`. Otherwise ask the owner ("use the unlimited generations, or credits?"), write the answer with its date at the top, and only then go on; if the owner cannot be asked now, stop the run here (B11) and say the question is waiting.
5. **Wait.** Poll `jobs_wait` with `jobs: [ { index: 0, job_id: <job id> } ]` and `timeout_seconds: 15` until the job is terminal (at most 120 calls). **A job that is not terminal after 120 polls is never submitted again** (a timeout is not a failure: it may still finish and bill): `run-log.mjs item --seg <segId> --cost <E> --outcome unknown` (it counts as spent), `result-doc.mjs <segId> --state failed --error "outcome unknown: job <id> was not finished after 120 polls; it may still finish" --cost <E>` and write it (B10), and tell the owner the job id.
6. **Download:** `mkdir -p "$WORK/renders"`, then `curl -sS -m 180 -o "$WORK/renders/<segId>.mp4" '<result url>' -w '%{http_code} %{size_download}\n'` must print 200 and a size above 100000. On anything else try the same curl twice more, 10 s apart. **The render is paid: a failed download is never a reason to submit again.** Still failing: write the stretch `failed` with `--error "the render is made but could not be downloaded: <result url>"` (B10) and give the URL in the report, so it can be fetched later.
7. `balance` -> `B1`. The cost of this render = `B0 - B1`: `node $T/run-log.mjs "$WORK" item --requested-at <t> --seg <segId> --cost <B0 - B1>`.

**B9. Verify the avatar** (the avatar rule). Make a sheet of the render and Read it: a frame every 0.25 s at 320 px, 32 frames, so a whole render of 4 to 8 s is in it:
```
ffmpeg -nostdin -loglevel error -y -i "$WORK/renders/<segId>.mp4" -vf "fps=4,scale=320:-2,tile=8x4" -frames:v 1 "$WORK/renders/<segId>-look.jpg"
```
For the emblems and the limbs also look at three single frames at full size: `ffmpeg -nostdin -loglevel error -y -ss <t> -i "$WORK/renders/<segId>.mp4" -frames:v 1 "$WORK/renders/<segId>-t<t>.png"` at the start, the middle and the end. The render passes only if ALL of this holds in every frame:
- it shows the house character of the reference picture and nobody else: no real person, no second figure, no face or skin of the athlete;
- the body is whole and stays one body: no extra or missing limb, no limb melting into the trunk, head the right way round;
- the gold emblems are where the reference has them (chest, or upper back, and upper arms) and nowhere else;
- the background is the plain dark purple, with no gym, no scenery and no text;
- the movement is the exercise of the driving clip, the right way up, with its equipment drawn as asked;
- for a hold: the body is still.

A render that fails is never uploaded and never cut into a loop that goes to the board.

**The retry rule.** One retry per item, no more, whether the job itself failed (B8: status failed or nsfw, the outcome is KNOWN) or the render failed the avatar check (B9); `run-log.mjs job` refuses a third submission. Before the retry apply the budget rule again (B8 step 1: balance, price, `run-log.mjs budget --quote`). For a failed job resubmit the same request. For a failed avatar check change the prompt first (name what went wrong: "one head", "two arms", "nobody else", the missing equipment). A job that is merely not finished is NOT a failed job (B8 step 5). If the retry also fails, the item fails (B10) and its cost is what both tries spent.

**B10. Cut, upload, write the result.**
- Passed: cut the loop (free)
  ```
  node $T/cut.mjs "$WORK/renders/<segId>.mp4" --seconds <repLength prep.mjs printed> --out "$WORK/loops/<segId>"     # an exercise
  node $T/cut.mjs "$WORK/renders/<segId>.mp4" --hold --out "$WORK/loops/<segId>"                                   # a hold
  ```
  It writes `<segId>.mp4` (640x640, no audio), `<segId>.webp` (poster) and `<segId>-sheet.jpg`. Read the sheet: first frame not blank, the loop closes (`loopJump` near 1; mode `once` means no clean repeat was found and it plays once and fades back, which is acceptable but say so). Exit 1 = the render is unusable (the first frame is blank, or the render is under 1.5 s): treat it as a failed render (retry rule). A hold render that moves (warning "the render moves all through") is a failed render too.
  Upload both files as assets: Artifact `{ action: "publish", url: BOARD, asset: true, file_paths: ["$WORK/loops/<segId>.mp4", "$WORK/loops/<segId>.webp"] }` -> the loop's id and the poster's id. Then
  ```
  node $T/result-doc.mjs <segId> --state review --loop <loop asset id> --poster <poster asset id> --cost <credits> --version <version> --db "$DB" --work "$WORK"
  node $T/run-log.mjs "$WORK" item --requested-at <t> --seg <segId> --outcome made
  ```
- Failed: `node $T/result-doc.mjs <segId> --state failed --error "<why, in plain words>" --cost <credits spent, leave --cost out if none> --version <version> --db "$DB" --work "$WORK"` and `run-log.mjs item ... --outcome failed`. (A failed redo keeps the old loop on the board.) An item that failed in B4 or B5 was never marked generating: there is nothing to write on the board; tell the owner in the report.

Either way write the printed JSON to the board: ArtifactData `{ action: "update", url: BOARD, collection: "segs", doc_id: <segId>, if_version: <version>, data: <the JSON line> }`. `<version>` is the one the **last write to that document returned** (B8 step 2); pass it with `--version`, so the printed call carries it, never the export's older one. If the write is refused, read the document (`action: "get"`) and write again with its version. `updatedAt` in the JSON is already later than the owner's last change to that stretch, so the board shows the result.

**B11. Finish.** `balance` once more, then `node $T/run-log.mjs "$WORK" finish --requested-at <t> --balance <balance now>` (a stop on the cap is also a finish of this run: the owner presses the button again for the rest). Tell the owner, in plain words: credits at the start and at the end and the cap; one line per item (name, made / failed and why / outcome unknown with the job id / not made because the cap was reached, credits); the stretches the plan skipped and why; the open unlimited-or-credits question if it is still open. Do not clear `items/control.queue`: it belongs to the page.

---

## Rules that hold everywhere

- **Budget:** the budget rule in B2, at the top of every item and before every submission. Spent is measured from the balance, not guessed.
- **One request, one run:** `queue-runs.json` remembers it. A finished request is never run again; an unfinished one is resumed with its `spent`. A stretch whose job is noted is never submitted again in that request.
- **Retry:** one retry per failed item, never a second. A job that is not terminal is not a failed job.
- **Avatar:** nothing that fails B9 reaches the board.
- **Holds:** an item with `hold: true` uses `prep.mjs --hold` (the steadiest 4 s) and `cut.mjs --hold` (2.6 s loop, end crossfaded into start).
- **Export folders:** emptied before every export (A5 step 0, B1 step 0), always as a step of its own.
- **Never** write to `items`, never write a document without its `if_version` once it exists, never disable TLS or the proxy, never call a paid tool other than the ones named in B2 (`estimate_video_cost` only prices; it submits nothing).
- If a tool exits with an error, read its message; it says what is wrong in plain words. Do not work around a refusal.

## The other tools

- `strip.mjs <video> --start --end --out <base>`: the strip and preview of one span (scan.mjs calls it).
- `split2.mjs <video> --out <json> [--proxy <small copy>] [--no-join]`: the splitter scan.mjs runs; `split.mjs` and `split-alt.mjs` are its two halves. Its output lists every pair the join rules looked at (`joinChecks`).
- `ingest.mjs <rawRoot> <workDir>`: the list of videos (`clips.json`) and their small proxies (scan.mjs calls it).
- `prep.mjs ... --dry`: measure and print only, to try a crop or a period without writing a clip. `--exact-crop`: the box as given.
- `run-log.mjs <workDir> start|budget|job|item|finish|show`: the book of a queue request (B2, B8, B10, B11).
- `db-docs.mjs <workDir> --clear-export <dbExportDir>`: empties an export folder before a new export.
- `name.mjs <workDir> --template <file> | <names.json> [--board <board.json>]`: names stretches without editing `segs.json` (A3).
