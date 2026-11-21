# Worker guide: rendering a shard of stretches from the board's whole-video proxies

You are one worker of a run that makes avatar loops for the Exercise Loop Board. The owner (Training Mode app owner) has queued the stretches and
said: use the automatic cuts, push them forward, he edits afterwards on the board. Credits are real money: follow the rules exactly.

Read `/home/user/trainingmodecode/exercise-loops/factory/RUNBOOK.md` sections **B4 to B10** and **Rules that hold everywhere** once, now: this guide
only says what is different in this run. Where they disagree, this guide wins.

## Fixed names (use them in every command)

```
R=/home/user/trainingmodecode
T=$R/exercise-loops/factory/tools
W=$R/.loop-factory/batch-pc            # everything this run writes; shared by all workers; files are named by stretch id, so they never clash
DB=$W/dbexport                         # the board's database as exported for this run (segs/, items/, srcs/): read only
REQ=2026-11-20T22:30:17.773Z           # the request this run belongs to (run-log key)
BOARD=https://claude.ai/artifact/PyNEAD4AtbxzpoFu3S1Wst
FRONT=eb56d9ea-c749-4fcd-9eb9-236531afc656      BACK=aa0b5c45-9d02-432c-8438-59175a4b1c9a
RL="flock $W/.runlog.lock node $T/run-log.mjs $W"     # EVERY run-log call goes through flock: many workers share the book
```
Your shard file: `$W/shards/<shard>.json` = `{ shard, items: [...] }`, the items as queue-plan.mjs planned them: `segId, name, entryId, source, src: { asset }, start, end,
span, period, view, refImage, kind, warn, prep: [arguments for prep.mjs]`. `warn` holds the scan's remarks and earlier remarks by Claude (for example "the head touches
the top edge"): hints, not orders: the owner queued the stretch knowing them.

## What is special about this run: the source is a small proxy, not the original

The footage is on the owner's PC and is not reachable now. The board holds a whole-video proxy of every video (longest side 480 px, 15 fps, crf 34, upright, no audio,
time 0 = the original's time 0). A first pilot of two stretches rendered well from such proxies (a kettlebell squat cropped by hand; seated dumbbell curls on the whole frame),
so we render from them. What that means for you:
- prep.mjs will often warn "the camera moves ... the whole picture is used; give --crop by hand": normal here (the proxy is noisy). Look at the check picture and give the
  box by hand: `--crop w:h:x:y --exact-crop`, pixels of the proxy picture as shown (the check picture is drawn at the proxy's size), around the WHOLE athlete and
  the equipment he uses (bar, bench, dumbbells), with a small margin. Never cut a limb or the bar off. Do not make the box so tight that a rep moves out of it.
- "blurry or soft" and "the athlete is small ... enlarged N x" are expected. Make the clip if N is 4.5 or less. If the athlete would be enlarged more than 4.5 x, or is not
  recognisable at that size, SKIP the stretch (see Skip).
- Footage that shows sideways (the proxy has no rotation tag for some phone videos): `--rotate 90|180|270` (the box is then in pixels of the turned picture).
- The scan's span can start where the athlete is not in the picture yet. If the check picture shows no athlete, look at the whole video once:
  `ffmpeg -nostdin -loglevel error -y -i "$W/srcs/<segId>.mp4" -vf "fps=0.5,scale=240:-2,tile=6x6" -frames:v 1 /tmp/<segId>-all.jpg` (a picture every 2 s), Read it, and
  pick `--start/--end` where the athlete is doing the exercise (the span you give must hold at least 2 repetitions). Keep the owner's own from/to when the item has them
  (`span` says "owner"): never change those, only add a `--crop`.
- One repetition must be clean: prep's `repLength` of 1 to 7 s. Longer than 7 s, or "no clear repetition": try `--period <seconds of one rep>` or a narrower span (max 3 prep tries per stretch).
- Everything the proxy cannot give (detail) is accepted. The owner reviews every loop on the board and redoes the weak ones from the originals later.

## STAGE A: prep and prompts (free). Output: `$W/shards/<shard>-ready.json` and `-skipped.json`

1. `Read` your shard file. Download each distinct proxy: Artifact tool `{ action: "read", url: BOARD, path: <item.src.asset>, out_dir: "$W/dl" }` (it saves `$W/dl/<asset>.mp4`;
   do all the reads in ONE message, in parallel). Then copy each to its item's `source` path (`cp $W/dl/<asset>.mp4 <source>`; several stretches of one video share an asset).
2. `node $T/prep-shard.mjs $W/shards/<shard>.json $W` runs prep.mjs with the planned arguments for every item and saves `$W/prep/<segId>.json` (`ok`, `result`). Then
   `Read` `$W/prep/<segId>-check.jpg` and `$W/prep/<segId>-sheet.jpg` of every item, all in one message (the check picture shows the frame the clip starts on with the crop box
   in red; the sheet shows ONE repetition on its top row and the whole driving clip on its bottom row).
3. For each item decide:
   - GOOD: the whole body (and the equipment it uses) is inside the red box, nobody else is in the box, the top row of the sheet is one whole repetition (it ends where it starts),
     the bottom row shows the reps following each other.
   - FIX: run prep.mjs again by hand with a better `--crop ... --exact-crop`, `--rotate`, `--period`, `--start/--end` (always with `--out $W/prep/<segId>`; the arguments of
     the item's `prep` list show how; `--dry` only measures). Look at the new check picture and sheet. At most 3 tries.
   - SKIP: see below.
4. Write the motion prompt for every GOOD item with `node $T/build-prompt.mjs --view <front|side|back> --opening "<...>" [--equip barbell,dumbbells,kettlebell,bench-back,bench-hips,pullup-bar,dipbars]
   [--extra "<sentence for other equipment>"] [--others]`. The opening describes what you SEE on the sheet's top row, from the start position through one repetition
   and back, ending with the plain exercise name in brackets, e.g. `standing tall with ..., bending the knees ..., then driving back up to standing (kettlebell front squat)`.
   Camera view: back -> `back`, a view from the side -> `side`, anything else -> `front`. Equipment only if it is really in the clip; other equipment (machine, cable, sled, rope, box, chair, ball, band)
   goes in `--extra` as one sentence: `Draw the <thing> as a simple glossy dark violet <shape> with glowing neon magenta edges.` (a machine or cable: describe only the part the athlete touches).
   Add `--others` when someone else is in the raw picture. The tool prints `{ refImage, refId, prompt }`.
5. Write `$W/shards/<shard>-ready.json` (Write tool): an array of `{ segId, name, view, refImage, refId, prompt, driveFile: "$W/prep/<segId>.mp4", repLength, clipLength, footage, crop, hold: false, notes }`
   (`repLength`, `clipLength`, `footage`, `crop` from prep's last JSON for that item; `notes` = anything the owner should know: a hand crop, a changed span, a head that touches the edge). And
   `$W/shards/<shard>-skipped.json`: an array of `{ segId, name, reason }`. Every item of the shard is in exactly one of the two files.

**Skip (nothing is rendered; it goes on the list for a proper export from the PC) when:** no athlete in the whole video; the athlete is too small or too blurred to read the movement
(enlarged more than 4.5 x, or you cannot tell what exercise it is); the body is cut off by the picture edge for most of the clip; the movement is not the named exercise; no repetition can be
found in 3 tries. A head that touches the top edge only in the standing position is NOT a reason to skip (the pilot squat had that and was fine); say it in `notes`.
Do not skip a stretch only because the scan's `warn` says Claude once decided not to render it: the owner queued it anyway.

## STAGE B: render (credits). Input: `-ready.json`. Output: `$W/shards/<shard>-made.json`, `-failed.json`

You pay here. Load the tools first: ToolSearch `select:mcp__Higgsfield__media_upload,mcp__Higgsfield__media_confirm,mcp__Higgsfield__generate_video_batch,mcp__Higgsfield__estimate_video_cost,mcp__Higgsfield__jobs_wait,mcp__Higgsfield__balance,ArtifactData`.

**Hard rules.** Credits only: every submission has `use_unlim: false` (if a tool ever answers with `unlim_choice`: submit nothing, stop, report it). Never submit a stretch twice except the ONE
retry of the retry rule. Never disable TLS or unset the proxy variables. Never write to the `items` collection, never write a document without `if_version`. The run's cap is 800 credits in
total for all workers together: the budget check below is how that is kept; if it says STOP, you stop paying at once and everything not yet submitted is "not made: cap reached".

1. Upload the driving clips (one `media_upload` call with `files: [{ filename: "<segId>.mp4", content_type: "video/mp4" }, ...]`, at most 20; then for each file
   `curl -sS -o /dev/null -w '%{http_code}\n' -X PUT -H 'Content-Type: video/mp4' --data-binary @"<driveFile>" '<upload_url>'` must print 200 (copy the URL exactly, one curl per
   file); then `media_confirm` with `type: "video"`, `media_ids`). Keep `segId -> media_id`.
2. Price: `estimate_video_cost` with the very `params` you will submit (see 4c), once per distinct `clipLength` among your items; the price of an item is the quote of its clipLength (a 4 s clip costs 4 credits).
3. Work in batches of up to 6 items (in the order of the file). For each batch:
   a. `balance`, then `$RL budget --requested-at $REQ --balance <balance> --quote <sum of the batch's prices>`. Exit 3 = STOP (rule above).
   b. Mark each item generating: `node $T/result-doc.mjs <segId> --state generating --db $DB` prints the JSON to write (its stderr shows the call); write it with ArtifactData
      `{ action: "update", url: BOARD, collection: "segs", doc_id: <segId>, if_version: <version from the export: it is in $DB/segs/<segId>.json as "version", or whatever the last write returned>, data: <the JSON> }`.
      Keep the `version` the write returns (every later write to that document needs it). If the write fails: `get` the document, write once more with its version; still failing: leave this item out of the batch and report it.
   c. Submit: `generate_video_batch` with `requests: [ { index: <0..5>, params: { model: "hf_mult_motion_control_flash", resolution: "480p", use_unlim: false, prompt: <the item's prompt>,
      medias: [ { value: <refId>, role: "image_references" }, { value: <media_id>, role: "video_references" } ] } }, ... ]` and `context: "Motion transfer of an exercise clip onto a stylised character for a fitness demo loop."`.
      No other parameter. Right after the answer, for each job: `$RL job --requested-at $REQ --seg <segId> --job <job id> --seconds <clipLength>`.
      If the call errors or times out with no job ids, the outcome is unknown: never submit these again; `balance`, and write each such item as failed (outcome unknown) as in 3h.
   d. Wait: `jobs_wait` with all the batch's jobs (`timeout_seconds: 15`) repeatedly until every job is terminal (up to 120 calls; a job still not terminal after that is NEVER submitted again: write it
      failed "outcome unknown: job <id> was not finished after 120 polls; it may still finish", cost = its price, and give the job id in your report). Renders take 2 to 10 minutes.
   e. Download each completed one: `mkdir -p $W/renders; curl -sS -m 180 -o $W/renders/<segId>.mp4 '<result_url>' -w '%{http_code} %{size_download}\n'` must print 200 and a size above 100000 (twice more, 10 s apart, if not).
      A paid render is never a reason to submit again just because the download failed.
   f. Look at it: `ffmpeg -nostdin -loglevel error -y -i $W/renders/<segId>.mp4 -vf "fps=4,scale=320:-2,tile=8x4" -frames:v 1 $W/renders/<segId>-look.jpg`, `Read` it (and the item's `$W/prep/<segId>-sheet.jpg` to compare the movement).
      Avatar rule (RUNBOOK B9), it passes only if in EVERY frame: it is the house character of the reference picture and nobody else (no real person, no second figure); one whole body (no extra or missing
      limb, no limb melting into the trunk, head the right way round); the gold emblems where the reference has them and nowhere else; plain dark purple background, no scenery, no text; the movement is the
      exercise of the driving clip with its equipment drawn as asked.
   g. Passed: `node $T/cut.mjs $W/renders/<segId>.mp4 --seconds <repLength> --out $W/loops/<segId>` (mkdir -p $W/loops). Exit 1 = unusable render: treat as failed. It writes `<segId>.mp4`, `.webp`, `-sheet.jpg`; the JSON has `mode` (`loop` or `once`).
      Do NOT upload the loop and do NOT write the review document: STAGE C does that after an independent look.
   h. Failed (job failed/nsfw, or the avatar rule fails, or cut exit 1): the ONE retry. `balance`, `$RL budget ... --quote <price>` (exit 3 = STOP), for an avatar failure change the prompt first (name what went wrong: "exactly one head and two arms",
      "nobody else in the picture", the missing equipment, "the background empty"), submit that single request as in 3c (the run-log refuses a third submission), then d to g again. If the retry also fails the item fails:
      `node $T/result-doc.mjs <segId> --state failed --error "<what went wrong, plain words>" --cost <credits both tries cost> --version <version> --db $DB` and write it with ArtifactData update (if_version = the version of your last write).
   i. After each item is settled: `$RL item --requested-at $REQ --seg <segId> --cost <total credits of its submissions> --outcome made|failed|unknown` (cost = the quoted prices; with many workers the balance cannot be split per item).
4. Write `$W/shards/<shard>-made.json`: an array of `{ segId, name, cost, version (of the last write to its segs document), attempts, render: "$W/renders/<segId>.mp4", look: "$W/renders/<segId>-look.jpg",
   loop: "$W/loops/<segId>.mp4", poster: "$W/loops/<segId>.webp", loopSheet: "$W/loops/<segId>-sheet.jpg", driveSheet: "$W/prep/<segId>-sheet.jpg", repLength, mode, notes }` and `$W/shards/<shard>-failed.json`:
   `[ { segId, name, reason, cost } ]` (failed here, documents already written as failed) plus the items never submitted (`reason: "not made: ..."`, cost 0). Write the file after every item (rewrite it whole), not only at the end, so
   a stopped run keeps its record.

## STAGE C: independent check and publish (a fresh look). Input: `-made.json`. Output: `$W/shards/<shard>-published.json`

You did not render these; judge them with fresh eyes. For each made item `Read` its `look` sheet and `driveSheet` (and `loopSheet`).
- **Reject only for a hard failure:** not the house character (a real person, a second figure, a face or skin), a broken body (extra or missing limb, limbs fused into the trunk, head wrong way), the emblems clearly in the wrong place or
  repeated, scenery or text in the background, a movement that is not the exercise the sheet shows. Soft detail, a slightly different pose, `mode: once` and a head cut by the frame edge are NOT reasons to reject: the owner reviews on the board.
  Rejected: `node $T/result-doc.mjs <segId> --state failed --error "the render failed the avatar check: <what is wrong>" --cost <cost> --version <version> --db $DB`, then ArtifactData update (if_version = version).
- **Publish the rest:** upload `loop` and `poster` as assets of the board in groups: Artifact tool `{ action: "publish", url: BOARD, asset: true, file_paths: [<up to 24 files: loop and poster of each item>] }`; the answer lists the asset id of each
  file. Then per item `node $T/result-doc.mjs <segId> --state review --loop <loop asset id> --poster <poster asset id> --cost <cost> --version <version> --db $DB` and ArtifactData update `{ collection: "segs", doc_id: <segId>, if_version: <version>, data: <the JSON> }`.
  If the write is refused (version): `get` the document and write again with the version it shows. Then `$RL item --requested-at $REQ --seg <segId> --outcome made` (no cost: it is booked).
- Write `$W/shards/<shard>-published.json`: `{ published: [{ segId, name, loopAsset, posterAsset }], rejected: [{ segId, name, reason }] }`.

## What every worker returns

A short JSON object as the structured output the task asks for. Never paste long logs. If something unexpected happens (a tool refuses, the cap is reached, credits fall faster than the quotes say), stop paying and say so in `problems`.

## What the 2026-11-21 queue run taught (8 stretches, 42 credits, two retries)

- **The prompt must say what the footage shows, not what the exercise "should" show.** Crossed-Leg Crunches came back with a stray third hand three times (two renders in the earlier request, one in this one) because the prompt said "both hands behind the head" while the athlete keeps one hand on the mat beside the hip: the generator drew the footage's hand AND the two the prompt asked for. Look at the hands in the driving-clip sheet before writing a hand position; when the footage shows a hand on the floor, say "one hand behind the head, the other hand resting flat on the floor beside the hip" and "exactly one head, two arms and two hands in total". With that prompt the render had two hands.
- **Never crop a lying or reaching exercise tight on one side.** A `--crop 300:200:120:15 --exact-crop` that held the athlete's body cut his head off at the right edge whenever he lay back (about half the frames). Check the FIRST and LAST frames of the span and the frame where he is longest, not only the frame the clip starts on, before choosing an exact crop.
- **Extra headroom around the driving clip does not give the render more headroom.** The kettlebell swing's raised hand and bell leave the top of the source picture; shrinking the clip into a padded canvas gave the same framing (the avatar came out the same size) and a ghosted bell in one frame. When the footage itself cuts the movement off, say so in the stretch's warning instead of spending the retry on padding.
- **Expect `once` from the proxies.** Three of the eight renders (dumbbell bench press, deadlift, squats) had no clean repeat in 4 to 5 s; trying other `--seconds` (1.8 to 3.6) did not find one that closes without a visible jump, so the standard cut (`--seconds <repLength>`) was kept and the stretch's warning says it plays once and fades.
- **Reading the cost:** a 4 s render is 4 credits and a 5 s render 5 (480p flash model), so a request of eight stretches with two retries is about 42 credits.

## What the 2026-11-21 shoulder run taught (11 stretches, 73 credits, 6 retries: 8 made, 3 failed)

- **`build-prompt.mjs` gives the FRONT reference picture to `--view side`.** Only `--view back` uses the BACK picture (`aa0b5c45...`). A retry submitted by hand with the back picture for a side view (and a prompt that said "seen from the side" and named the chest emblem) went through the check by luck; copy `refId` from `shard-ready.json`, never type it.
- **Extra room under the feet worked once, not twice.** Padding the driving clip at the bottom (`scale=612:612, pad=720:720:54:0`, 0.85x with the footroom below) brought both feet back in picture for the weighted punches (front view). The same padding did not help the bent-over rear delt raise (side view): the avatar was still at the far right and cut by the bottom edge, so the stretch is `failed` after its one retry.
- **A retry that keeps the old prompt and adds one plain sentence for the fault seen mostly fixes it** ("Two clearly separate legs with two separate feet in every frame", "The whole body stays inside the picture"). It did not fix a turning torso (jumping lunges with the hands thrown overhead: the avatar turned its back in the first render, and a 3/4 turn in the second) or missing upper-arm emblems (alternating punches overhead: missing in both renders, the one fault this clip has).
- **Disk:** the container's write allowance is small. Contact sheets, check images and the scratch folders of earlier runs fill it (258 MB left at one point, and a workflow's output file was truncated when it ran out: 7 of 11 verdicts lost). Delete your own look folders as soon as the checker has seen them, and tell every checker to write 30 small images at most and delete them.
- **`estimate_video_cost` returned an output-schema error three times**: use the known price (clip seconds = credits at 480p) and check the balance difference after the batch.
- **Checks:** one agent per render (a fresh look, with the driving clip and the move described in words) found what the first look missed: a stray emblem on the back, a leg fused into the hips for 4 frames, feet cut by the bottom edge. Give the checker the faults of the first render of the same clip.
