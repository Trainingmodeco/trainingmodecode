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
| `npm run approve -- <id>` | your OK to post |
| `npm run studio` | preview templates in the browser |
| `npm run hf:render -- raw-footage/clip.mp4 9 50 0.5` | render the Rank Ladder over a clip (from 9 s, centred, at half speed) |
| `npm run reference -- <url>` | save a reference reel to study |

Head tracking (`npm run track`) needs Python once: `winget install
Python.Python.3.12`, then `py -m pip install mediapipe`. The pose model
downloads itself the first time.

## What's inside

- `brain/`: your Drive scripts as a searchable library, the content formats,
  platform setup, ManyChat flow.
- `src/`: video templates (Remotion): **ScriptShort** (motion graphic from a
  script), **FootageShort** (your clip + captions + HUD), **BossIntro**,
  **FightFocusRounds** (your training footage cut into called rounds),
  **PracticeTutorial** (one technique from Practice Mode, 32 s).
- `hyperframes/`: HTML video templates (HyperFrames): **Rank Ladder**.
- `queue/`: one file per post with its captions for every platform.
- `raw-footage/`, `references/`, `exports/`: your media (kept out of git).

Look: violet and gold arcade, Orbitron + Rajdhani, the app's own boxing bell.
