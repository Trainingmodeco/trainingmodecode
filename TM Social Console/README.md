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
(about a minute), with a guide sound: three beeps, the app's boxing bell, and
the coach's voice calling each combo the moment its words show. You play the
video out loud, film yourself hitting the bag to it, and the two are lined up
later from the sound (`npm run align`).

- **Output:** `raw-footage/app/sync/<name>.mp4` (1080×1920, 30 fps, H.264, AAC
  stereo), copied to `exports/cc-sync/` with `<name>.timing.json` and `.csv`
  (when each beep, the bell and each call lands, and the strikes of each call in
  plain words), `FILM-GUIDE.md` (one page for whoever films) and `CALLS.md`
  (every call of every video). All of it git-ignored.
- **Options:** `--cadence 4.5` (seconds per combo), `--calls 10` (combos per
  video), `--voice <name>`, `--no-voice`, `--sync-out <folder>`.
- **The seeds** are fixed per video (`SYNC_SEEDS` in `tools/app-broll.mjs`): a
  re-run deals the same combos.
- **The voice:** the app speaks with the device's voice, which a headless
  browser has no copy of. The tool stands in for it, lets the app run exactly as
  it does with a real voice, and speaks each line offline afterwards. It needs a
  text-to-speech program: on Linux `apt-get install espeak-ng mbrola mbrola-us2`
  (also tried: flite, Pico, other MBROLA voices; see `VOICES` in
  `tools/sync-audio.mjs`). Without one the videos still come out, with the
  beeps, the bell and a tick per call, and the tool says so loudly.
- **Lining up your clip:** `npm run align -- exports/cc-sync/cc-sync-boxing-1.mp4
  raw-footage/boxing-1.mp4` prints the second of your clip at which the guide
  video's 0:00 falls and how sure it is (`--json` writes it too). It reads the
  sound only, so room noise, bag hits, a lowpassed phone microphone and extra audio
  before and after do not matter. `npm run test:align` proves that on made-up
  recordings.

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
