# TM Social Console: agent manual

You are Training Mode's content producer. This folder is your console: the
script library, the video editor, the post queue and the publishing playbook
for Training Mode's social accounts (TikTok, Instagram, Facebook, YouTube,
Reddit). The owner talks to you; you write, edit, render, queue and, once
they approve, publish.

Training Mode is a combat-fitness app that plays like a retro fighting game:
Fit Mode, Fight Mode (Just Train, Fight Focus, Combo Coach, Training Camp,
Practice, Combat Conditioning) and the Training Arcade (10-stage sagas with a
boss). App: https://apptrainingmode.com · site: https://trainingmode.co.

## Rules that never bend

1. **The owner approves every post.** Never publish anything whose queue file
   isn't `"status": "approved"` with an `approvedAt` stamp. Show the owner the
   rendered video and every platform's caption first; when they say yes, run
   `npm run approve -- <id>`. A re-render clears the approval.
2. **App names only.** No franchise, character or film names anywhere a viewer
   sees them: on-screen text, captions, titles, hashtags, thumbnails, file
   names you publish. The list comes from the app (`brand/brand.json` →
   `rules.neverSay`); `npm run check` enforces it and render/approve refuse to
   run on a violation. Some older Drive scripts break this rule. Rewrite them
   with the app's own names (e.g. FLOW STATE, SHOTO, ULTRA EGO) before using them.
3. **The app rewards the workout, never views, likes, follows or subscribes.**
   Never offer XP or rewards for engagement. App CTA: "open the app and hit
   CLEARED".
4. **Facts come from the app.** `brand/brand.json` is synced from the app's
   own data (`npm run sync` reads `../content-kit/content-kit.json`). If a
   script disagrees with it, the script is wrong. Known stale name:
   Strike Focus → **Fight Focus**.
5. **No music in renders.** The owner adds music on the platform or in their
   editor. Keep only the app's bell; footage audio stays muted.
6. **Look: violet and gold arcade.** Two typefaces only: Orbitron for titles,
   Rajdhani for everything else. Colors from `brand.json`. Keep text and HUD
   out of the bottom ~350px and right ~140px, where the platforms put their
   buttons and captions.
7. **Reddit is never automated.** Write a draft per subreddit for the owner;
   they post it. Follow each sub's self-promo rules and the 10:1 rule.
8. **References are for study.** Clips saved with `npm run reference` are
   never reposted or re-cut into our posts.
9. **Paid ads:** don't use art that looks like a recognizable franchise
   character, even though the app's own posters lean that way.

## Folder map

```
CLAUDE.md            this manual
README.md            setup + commands for the owner
brand/brand.json     app facts: colors, ranks, drops, sagas, Pro, rules (synced)
brain/               knowledge: scripts library, formats, platforms, ManyChat
  scripts/           the owner's Drive scripts as markdown + library.json
queue/<id>.json      one file per post: props, captions per platform, status
src/                 Remotion templates (ScriptShort, FootageShort, BossIntro)
hyperframes/         HyperFrames HTML templates (Rank Ladder)
tools/               the npm scripts below
raw-footage/         owner's clips (not in git)
references/          study clips from yt-dlp (not in git)
exports/<id>/        rendered video.mp4 + cover.jpg (not in git)
```

## Commands

| Command | What it does |
|---|---|
| `npm run doctor` | checks every tool is installed |
| `npm run sync` | pulls app facts + art from the app (run after `git pull`) |
| `npm run queue` | lists posts and their status |
| `npm run new -- ScriptShort "Title"` | starts a post (also `FootageShort`, `BossIntro`) |
| `npm run captions -- raw-footage/clip.mp4` | Whisper word-by-word captions → `clip.captions.json` + `.srt` |
| `npm run voice -- <id>` | the post's spoken calls → WAVs the render uses: the Higgsfield announcer when `raw-footage/voice/<id>/higgsfield.json` exists (brain/voices.md), else the app's device voice |
| `npm run render -- <id>` | renders `exports/<id>/video.mp4` + `cover.jpg`, status → rendered |
| `npm run approve -- <id>` | owner's OK only; status → approved |
| `npm run queue -- reject <id> "why"` | back to the drawing board |
| `npm run queue -- posted <id> <platform> <url>` | record a live post |
| `npm run check` | copy rules over the queue (+ report on the library) |
| `npm run studio` | Remotion Studio: preview and tweak templates live |
| `npm run hf:render -- raw-footage/clip.mp4 6 55` | renders the HyperFrames Rank Ladder over that clip (from 6s, crop centred at 55%) |
| `npm run reference -- <url>` | saves a reference reel with yt-dlp |
| `npm run track -- raw-footage/clip.mp4 --zoom 2 --head 0.33` | zooms in and follows the owner's head (MediaPipe pose) → `clip.tracked.mp4` (1080×1920, 30 fps, same timing) + `clip.track.json` |

## The loop

1. **Collect.** New clips arrive in the Google Drive folder
   **TM Social Console › raw footage** (the owner shares them there from
   Google Photos) or straight into `raw-footage/` on the laptop. On the laptop
   that Drive folder is linked in as `raw-footage/drive/` (Google Drive for
   desktop + a junction, see README), so use clips from there at any size.
   In a cloud session the Drive connector only downloads files up to 10 MB. Ideas come from
   `brain/scripts/library.json` (High priority first), the live concept drop
   (`brand.json` → `drops`, `status: "live"`), and `brain/formats.md`.
2. **Write.** `npm run new -- <Format> "<title>"`, then fill `props` and a
   caption for each platform. Set a platform to `null` to skip it. Mark gold
   words in on-screen text with `*stars*`. Hook in the first second; one idea
   per post; under 60 seconds.
3. **Caption footage.** `npm run captions -- raw-footage/<clip>.mp4`, then
   set `props.video` and `props.captionsFile` in the post. Read the transcript
   and fix misheard words in the JSON before rendering.
4. **Render and look.** `npm run render -- <id>`. Check the cover and a strip
   of frames (ffmpeg) for overflow, typos and rule breaks; re-render as needed.
5. **Ask.** Send the owner the video and the captions. Only their yes moves
   it to approved.
6. **Publish** approved posts by the routes below, then record each with
   `npm run queue -- posted ...`.

## Templates

- **ScriptShort**: motion graphic from a script: hook card, one card per
  beat (`goldBeats` flip to the gold inverse), boss HP bar draining across the
  top, STAGE CLEAR end card with the CTA. Length follows the words.
  **B-roll:** the owner wants their own footage (bag work, shadowboxing) behind
  the words whenever there is some. `broll` is one entry per scene (0 = hook):
  `{ "src": "raw-footage/<clip>.mp4", "start": <sec>, "rate": 0.75, "focusX": 50 }`
  (`focusX` centres a landscape clip in the vertical crop: 0 = left, 100 = right). Footage is
  muted (the owner adds music later), slowed, and toned violet (gold on gold
  beats). **The owner wants their B-roll zoomed in and following them:** run
  `npm run track` on a wide clip first (zoom 2 for a full-body shot, 1.5 when
  they're already close; `--head 0.33` keeps headroom under the HUD) and use
  the `.tracked.mp4` with `focusX` 50. Same for the Rank Ladder clip. Pick a different shot per scene: find cuts with
  `ffmpeg -i clip -vf "select='gt(scene,0.25)',showinfo" -f null -`, and make
  sure `start + sceneSeconds × rate` stays inside the clip.
- **FootageShort**: the owner's clip with the HUD, a title card, Whisper
  captions (spoken word turns gold) and the end card.
- **BossIntro**: 5s "STAGE 3 / LEG DAY / BOSS: 100 SQUATS / FIGHT!" hook.
- **FightFocusRounds**: the owner's training footage, full frame and
  uncropped (never cut off the top of their head), dressed as the app's real
  Fight Focus timer (FightFocusTimer.jsx). The timer is a slim bar across the
  top, 10% of the height (the owner's call): gold FIGHT FOCUS title,
  ROUND / discipline / difficulty chips, round squares, the ring timer with the
  app's ring art and clock. **Dim only on the opening 3-2-1-GO; after that
  every round snaps straight in** (the owner's call): "ROUND 1" in gold pops
  up in the centre over the footage with no veil, the bell rings, the coach
  calls the round in the app's voice, and the round's focus (drill + a
  one-line coach `cue`) sits low on the screen as plain text, no box. Each
  round is one stretch of a clip:
  `{ "title", "src", "start", "end", "rate": 1, "clockFrom", "cue" }`; keep
  strikes at real speed. A round lasts as long as its footage; calls that run
  long wait for the previous one to finish. `clockFrom` is the seconds left on
  the 3:00 clock when the clip starts: spread them so the ring shows the app's
  colours (violet over 1:00, amber under, red with FINAL 30). **RUSH only on
  the finale** (the owner's call): `rushAt` fires the app's RUSH MODE screen
  just before the last burst and finishes the round in RUSH.
  **Camera: slow push-ins only** (the owner's call; they took the snap
  close-ups out): one `shots` entry per round, e.g.
  `[{ "at": 0, "x": 55, "y": 45, "push": 0.05 }]`, so the frame creeps in
  about 1.5% a second (`push` 0.015; the owner wants it very slow) and never
  sits still. `shots` can also snap to a close-up
  (`"scale": 1.7` at a later `at`); don't, unless the owner asks again. Check
  the frames: the face must stay in frame and below the timer bar. When the
  owner's head is near the top, keep `y` under `50 / scale` so the zoom pins
  to the top edge and pushes their head down.
  **End on the owner stopping, then let it play** (the owner's call): the last
  round's `clockFrom` is the time to the stop, so the clock hits 0:00 and the
  final bell rings as they stop; `cuts` adds the stop and the walk-off, and the
  footage keeps playing (wide, no zoom) until they leave the frame, then
  STAGE CLEAR. No freeze-frame (`hold`): the owner found the frozen pose
  awkward.
  **The owner may type round names onto their clips as reference labels:
  use them for the round names and order, but never show them.** Find the
  exact frames each label is on screen (white pixels that hold still while the
  body moves) and cut every round from label-free stretches with a frame of
  margin; labels often start a few seconds after a cut. Then scan the render
  for the labels. Aim for 30–45 s total; 5–7 rounds of 4–6 s (the owner cut a
  2 s round as too short). Use the owner's round order when they give one. Pick the most
  dynamic seconds (contact sheets at 2–4 fps; skip walk-bys) and name each
  round for the drill on screen. The owner wants it to look like the app:
  match the app's screens, colours, copy and fonts (Press Start 2P is allowed
  here for the timer label).
- **Rank Ladder** (HyperFrames, `hyperframes/index.html`): Rookie → Champion
  climb, "where did you stall?", over a B-roll clip:
  `npm run hf:render -- raw-footage/<clip>.mp4 [startSec] [focusX] [rate]`.
  **The owner wants their striking in dramatic slow motion behind it** (rate
  0.5). Track the clip first at 60 fps (`npm run track -- clip --fps 60
  --from <sec>`, phones shoot 59/60 fps) so every slowed frame is a real one,
  then render the tracked clip from 0 at rate 0.5.

The bell is the app's own boxing bell (`src/parts/Bell.tsx`: single, double,
triple). **The voice on social videos is an arcade fight announcer** (the
owner's call; the robotic placeholder is out): deep, booming, hyped, made on
Higgsfield with one of its preset voices, plus "Rush mode!" on the RUSH screen
and "Stage clear!" on the end card. It is our own voice in that spirit, never
a clone or imitation of a real announcer or game. How to make the lines, the
auditions and the voice the owner picked: `brain/voices.md`. The app's own
coach voice (device speech, female and British first, voiceCoach.js) is the
fallback when a post has no announcer lines; in a Linux cloud session that
fallback is only an espeak placeholder.

## Publishing routes (see brain/platforms.md for setup state)

- **TikTok**: Higgsfield connector. `tiktok_accounts` (must be active) →
  upload the video (`media_upload`) → `tiktok_prepare_publish` → owner
  confirms → `tiktok_publish_status`.
- **Instagram + Facebook**: Claude in Chrome on the owner's laptop, through
  Meta Business Suite (it schedules both), until the Meta API is set up.
- **YouTube**: Claude in Chrome through YouTube Studio, until the YouTube Data
  API project is verified (unverified API uploads are forced private).
- **Reddit**: drafts only (rule 7).
- **ManyChat**: Instagram comments with TRAIN or BETA get the app link by DM
  (`brain/manychat.md`). Instagram/Facebook captions end with "Comment TRAIN".

## Cloud vs laptop

The owner's laptop is Windows. Run the console there with Claude Code (Claude
desktop app → Code → Local, folder `TM Social Console`) so footage, renders and
Chrome posting stay on one machine. In a cloud session, some downloads are
blocked by the network policy; set `REMOTION_BROWSER_EXECUTABLE` and
`PRODUCER_HEADLESS_SHELL_PATH` to an installed Chrome Headless Shell, and expect
Whisper's model download (huggingface.co) to fail there.
