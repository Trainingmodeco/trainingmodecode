# TM Social Console

Training Mode's content console: one folder that holds the script library, a
video editor, the post queue and the publishing playbook for TikTok,
Instagram, Facebook, YouTube and Reddit. Claude runs it (it reads
`CLAUDE.md`); you approve every post before it goes live.

It lives inside the Training Mode app folder, next to `content-kit/`, so every
video and caption uses the app's real names, ranks, drops and colors.

## Set up on your Windows laptop (once)

1. **Get the folder.** It's in the app repo on the branch
   `claude/training-mode-social-console-zfcf8f`. If `TM APP 2026` is your copy of
   the app repo, pull that branch and the console appears at
   `TM APP 2026\TM Social Console`. Otherwise download the repo as a zip from
   GitHub (that branch) and unzip it into `TM APP 2026`.
2. **Install Node.js 22 LTS** from nodejs.org.
3. **Install yt-dlp and FFmpeg** (open PowerShell):
   ```
   winget install yt-dlp
   winget install Gyan.FFmpeg
   ```
4. **Install the console** (PowerShell, inside `TM Social Console`):
   ```
   npm install
   npm run sync
   npm run setup
   npm run doctor
   ```
   `setup` downloads Remotion's browser and Whisper (about 200 MB). `doctor`
   should show all ✓.

## Get clips from your phone / Google Photos

Google Photos can't be connected to Claude directly, so clips go through the
shared Drive folder **TM Social Console › raw footage**:

1. **Phone:** open the folder link
   (https://drive.google.com/drive/folders/1757yh44bvNfuaMklKBWzpHTkpEViosN0)
   in the Drive app → **+** → **Upload** → pick the videos (Google Photos shows
   up in the picker). Or from Google Photos: select videos → **Share** →
   **Drive** → choose the Training Mode account → My Drive › TM Social Console ›
   raw footage.
2. **Laptop, once:** install **Google Drive for desktop** and sign in with the
   Training Mode Google account, then link the folder into the console
   (PowerShell, inside `TM Social Console`; change `G:` if Drive uses another
   letter):
   ```
   New-Item -ItemType Junction -Path "raw-footage\drive" -Target "G:\My Drive\TM Social Console\raw footage"
   ```
   Every clip you upload from your phone then shows up in
   `raw-footage\drive\`, any size.

## Use it with Claude

Open the Claude desktop app → **Code** → **Local** → pick the
`TM Social Console` folder. Then talk to it normally:

- "Make a post from the Fit Mode explainer script."
- "Caption raw-footage/heavy-bag.mp4 and cut it into a Fight Mode short."
- "Show me what's waiting for approval." → "Approve it." → "Post it to TikTok."

For posting to Instagram, Facebook and YouTube from the laptop, install
**Claude in Chrome** (the Claude browser extension) and sign in to those sites
in Chrome. Claude uploads approved videos there for you.

## Commands

| | |
|---|---|
| `npm run doctor` | check the tools |
| `npm run sync` | refresh app facts + art (after pulling app changes) |
| `npm run queue` | what's drafted, rendered, approved, posted |
| `npm run new -- ScriptShort "Title"` | start a post |
| `npm run captions -- raw-footage/clip.mp4` | Whisper captions |
| `npm run voice -- <id>` | the announcer's calls (or the app's voice) |
| `npm run track -- raw-footage/clip.mp4 --zoom 2` | zoom in on you and follow your head → `clip.tracked.mp4` |
| `npm run pose -- raw-footage/clip.mp4` | find your body in every frame → `clip.pose.json` (the Practice tutorials' markers) |
| `npm run deblur -- raw-footage/clip.mp4 --sigma 2` | fix soft-focus footage (deconvolution) → `clip.deblur.mp4` at 1080p |
| `npm run render -- <id>` | make the video + cover |
| `npm run render -- <id> PracticeLessonApp` | the 16:9 in-app cut of a Practice tutorial |
| `npm run app-video -- <id>` | put a finished tutorial into the app's Practice Mode (video + poster in the app's `public/static/practice/`, URL into its library and lesson slots) |
| `npm run handoff -- --log "…"` | send that to the app: an app-only `claude/console-handoff-<date>` branch for the app chat to merge (the console's own code never goes to `app`; HANDOFF.md on `app` is the shared note) |
| `npm run app-broll -- --only qm-slider,hub` | record the app's own screens as B-roll (1080×1920, silent) → `raw-footage/app/<name>.mp4` |
| `npm run sync-broll` | record the eight Combo Coach sync videos (one per style and level) with their guide sound and timing sheets → `raw-footage/app/sync/` and `exports/cc-sync/` |
| `npm run align -- <guide.mp4> <your-clip.mp4>` | find where a guide video sits inside your own recording of it, from the sound |
| `npm run test:align` | test that on made-up recordings (a table of PASS and FAIL) |
| `npm run test:sync` | check the guide voice's phrasing and the plain-words lists against every combo of the app's pool |
| `npm run approve -- <id>` | your OK to post |
| `npm run studio` | preview templates in the browser |
| `npm run hf:render -- raw-footage/clip.mp4 9 50 0.5` | render the Rank Ladder over a clip (from 9 s, centred, at half speed) |
| `npm run reference -- <url>` | save a reference reel to study |

## B-roll from the app itself (`npm run app-broll`)

Videos about an update (Quick Mission, the level system, MAX OUT) can be made
from the app's own screens instead of a camera. `npm run app-broll` opens a
built web export of the app in Chromium at the app's phone size, seeds an
athlete (a new account, a level 3, a level 10 …) into its localStorage, plays a
choreography with a finger (smooth taps and drags, each touch marked by a subtle
gold ripple) and records it to `raw-footage/app/<name>.mp4`: 1080×1920, 30 fps,
H.264, silent, the app's true colours, no phone frame. Nothing is added to the
app and the console gets no new dependency.

- **Needs:** the app repo's own dependencies (`npm install` in the app folder:
  it uses its `playwright-core`), a built export of the app (`npm run build:web`
  in the app, then `dist/`; or `--dist <folder>`), FFmpeg on the PATH, and a
  browser: Chrome, or `CHROME_PATH=<exe>` (in a cloud session, the installed
  Chromium; `--chrome <exe>` does the same).
- `npm run app-broll -- --list` shows every clip and what it shows;
  `npm run app-broll -- --only qm-slider,max-out` records just those;
  `--contact <folder>` also writes a frame-a-second sheet of each to look at.
- **A new clip is one entry** in `CLIPS` at the top of `tools/app-broll.mjs`
  (a persona, a few steps to get to the first screen, the steps to record). Its
  `expect` and `waitText` steps stop a clip whose screen no longer says what it
  should, so re-run it after the app changes. Athletes are seeded with the
  neutral name Trainee (the Profile prints it, so it is on screen); get-ready
  countdowns run in real time and only long waits are leapt (`jump`, or `hide`
  to cut straight past them).
- Use the clips in a **ScriptShort** post with `"brollGrade": "app"` in `props`:
  the footage keeps its true colours at full size, the words sit in a caption
  panel that each scene places over the part of the screen that isn't live
  (`broll[i].textY`, and `shiftY` to slide a screen's top rows below the HUD),
  and the HUD stays clear of the right 140 px and the bottom 350 px. Without
  `brollGrade`, a post renders exactly as before.

### Combo Coach sync videos (film yourself striking to the app)

`npm run sync-broll` (or `npm run app-broll -- --only cc-sync-boxing-1`) records
eight videos of the app's real Combo Coach session screen: boxing, kickboxing,
Muay Thai and MMA, two each (video 1 plays as a level 5 athlete, video 2 as a
level 10 one). Each runs from the app's own 3-2-1 through ten combos
(51 to 58 seconds), with a guide sound: three beeps, the app's boxing bell on GO,
and the coach's voice calling each combo on the frame its words show. You play the
video out loud, film yourself hitting the bag to it, and the two are lined up
later from the sound (`npm run align`). No music anywhere.

- **Output:** `raw-footage/app/sync/<name>.mp4` (1080×1920, 30 fps, H.264, AAC
  stereo, about -16 LUFS), copied to `exports/cc-sync/` with `<name>.timing.json`
  and `.csv` (when each beep, the bell and each call lands, how long the voice
  takes, when the next call comes, and the strikes of each call in plain words),
  `FILM-GUIDE.md` (one page for whoever films) and `CALLS.md` (every call of every
  video). All git-ignored (`exports/` and `raw-footage/`); copies of the text files
  are kept in `brain/combo-sync/`. The videos are about 10 MB each: they are not in
  git, so the owner gets them as files (`--files-at "<where>"` puts that sentence
  into FILM-GUIDE.md; `--pages-only` rewrites the two pages from the sheets without
  recording again).
- **Time:** a video is recorded in real time, about 2.5 minutes each, so all eight
  take about 20 minutes (`npm run sync-broll`; nothing else is needed from you). The
  tool checks before it records that ffmpeg is a full build (a missing or slim ffmpeg
  stops it in seconds, with how to install one) and that the browser starts.
- **What is on screen:** names call style, COMBO mode, warm-up off, 1 round of
  1 minute, cadence 4.5 s, RUSH off. The setup is done off camera, with every
  value checked in the page; the athlete is a Fight level 5 (NORMAL mix) or
  level 10 (ADVANCED mix, the app's own `YOUR LEVEL`). At level 5 the app also
  calls "SLIP!", "ROLL!", "CHECK!", "PIVOT!" or "SPRAWL!" between combos (its own
  rule, every 3 to 5 combos, a slot of about 2.8 s), so those videos hold ten
  combos and two or three defence calls; the sheet marks them (`kind: defence`).
  The coach's between-combo encouragement is switched off (the app's own
  setting) so nothing speaks over a call.
- **Options:** `--cadence 4.5` (seconds per combo), `--calls 10` (combos per
  video), `--voice <name>`, `--no-voice`, `--sync-out <folder>`, `--files-at <text>`,
  `--pages-only`, `--probe-seeds 8` (nothing recorded: lists the combos the seeds 1
  to 8 deal; `--probe-seeds 24,85` just those).
- **The seeds** are fixed per video (`SYNC_SEEDS` in `tools/app-broll.mjs`:
  boxing 1 and 24, kickboxing 8 and 2, Muay Thai 16 and 92, MMA 16 and 85): a re-run
  deals the same combos, and the two videos of a style share none. They were picked
  over the seeds 1 to 200 with the app's own dealer for what can be filmed on a
  hanging bag in a 4.5 s slot: no Ground Pound, Throw or Pass, at most one short
  clinch-and-knee combo, no combo over 6 pieces (7 at most), no two 6-piece combos in
  a row, no combo ending on a stray "Head" or "Body". **The seeds are fixed for cadence
  4.5.** The dealer sizes the round from the call count, which the cadence sets, so
  another `--cadence` can deal other combos at level 5. Re-run `--probe-seeds` and
  update `SYNC_SEEDS` if you change it.
- **Same combos, not the same file:** a re-run deals the same combos in the same order, but
  the timings are not repeatable to the frame: a call can land a frame (33 ms) earlier or
  later, a beep 10 ms, and the mp4's bytes differ. The one-word defence calls of the level 5
  videos (SLIP!, PIVOT! ...) are drawn by the app while it runs, so which ones come, and
  after which combo, can differ from run to run (the combos never do). Each timing sheet is exact for the mp4 it was
  written with: treat a video and its sheet as a pair, and do not swap a re-recorded
  video in once the owner has filmed to the old one.
- **The voice:** the app speaks with the device's voice, which a headless
  browser has no copy of. The tool stands in for it, lets the app run exactly as
  it does with a real voice (it is told how long each line takes to say), logs
  every line with its time, and speaks the lines offline afterwards, each at the
  frame its words appear. It needs a text-to-speech program. The one it uses:
  eSpeak NG with the MBROLA `us2` voice (`apt-get install -y espeak-ng mbrola
  mbrola-us2`), speed 200, pitch 35, each strike its own beat, then an
  announcer's EQ (a lot of presence), compression and a limiter (the bell is
  ducked 30 dB under the first call, as a mixer would). It was picked
  from every voice installable offline (eSpeak NG formant voices, MBROLA
  us1/us2/us3/en1, Flite rms/awb/slt/kal16, SVOX Pico) by a closed-vocabulary
  recognition test: PocketSphinx reading the strike words, clean and through room
  noise at 18, 12 and 8 dB with a phone-microphone lowpass; tuned, this one
  recognised 99% of the strike words clean and 76% through noise at 12 dB, where
  the other voices (same polish) got 8% to 59%. **Nobody has listened to it yet:
  play one video and check the calls are clear and loud before the owner films.**
  Other voices are in `VOICES` in `tools/sync-audio.mjs` (`--voice espeak-us-m3`,
  `flite-rms`, `pico-us`). Without any engine the videos still come out, with the
  beeps, the bell and a tick per call (also `--no-voice`), and the tool says so loudly.
- **Timing of the voice:** `startSec` of a call is the frame where its words first show. The
  voice is HEARD to start on that frame. A very soft start ("h" of "Hook", "f" of "Feint",
  "p" of "Pivot") has a first breath of sound up to 80 ms before the loudness a listener
  hears as the word, so the voice is never placed with that first sound more than 40 ms
  ahead of the frame: a call with such a start is heard up to about 40 ms after the frame.
  The sheet has both measured on the finished file: `audioOnsetSec` (heard) and
  `audioFirstSoundSec` (the first sound).
- **Checked on every video, in the finished file:** the picture (the frame where
  each call's words first appear, found from the pixels), and the sound (each
  beep, the bell and each call read back from the AAC track and found where the
  sheet says: the sound as placed within 10 ms, its heard start within 50 ms and
  its first sound at most 55 ms ahead of the words).
- **Lining up your clip:** `npm run align -- exports/cc-sync/cc-sync-boxing-1.mp4
  raw-footage/boxing-1.mp4` prints the second of your clip at which the guide
  video's 0:00 falls and how sure it is (`--json` writes it too). It reads the
  sound only, so room noise, bag hits, a lowpassed phone microphone and extra audio
  before and after do not matter. When the guide is not in the clip (the wrong video,
  or its sound was not picked up) it says so, gives no offset, and exits 2 (the JSON has
  `"reliable": false`). `npm run test:align` proves that on made-up recordings (twelve
  offsets within 40 ms, a clip with no guide, and the command line's own answers).
  `npm run test:sync` checks every combo of the app's pool: the voice's phrases are the
  app's own pieces, and the plain-words lists have one entry per piece.

Head tracking (`npm run track`) needs Python once: `winget install
Python.Python.3.12`, then `py -m pip install mediapipe`. The pose model
downloads itself the first time.

## What's inside

- `brain/`: your Drive scripts as a searchable library, the content formats,
  platform setup, ManyChat flow.
- `src/`: video templates (Remotion): **ScriptShort** (motion graphic from a
  script, over camera footage or the app's own screens), **FootageShort** (your clip + captions + HUD), **BossIntro**,
  **FightFocusRounds** (your training footage cut into called rounds),
  **PracticeTutorial** (one technique from Practice Mode, 32 s).
- `hyperframes/`: HTML video templates (HyperFrames): **Rank Ladder**.
- `queue/`: one file per post with its captions for every platform.
- `raw-footage/`, `references/`, `exports/`: your media (kept out of git).

Look: violet and gold arcade, Orbitron + Rajdhani, the app's own boxing bell.
