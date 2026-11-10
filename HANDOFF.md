# Console ⇄ App handoff

Two chats work on this repo, each on its own code. This file is how they
share what the other needs. Both read it before starting work and add to the
log below (newest first).

| Chat | Owns | Branch | Ships to |
|---|---|---|---|
| **App chat** (fight mode improvements, the app) | the app: `app/`, `components/`, `public/`, `scripts/`, the to-do files | `app` and its own working branches | apptrainingmode.com (Netlify builds `app`) |
| **Console chat** (TM Social Console: social videos, Practice tutorials) | `TM Social Console/` | `claude/training-mode-social-console-zfcf8f` | the owner's social accounts; tutorial videos for the app |

**The code stays separate.** The console branch is never merged into `app`,
and the app chat doesn't edit `TM Social Console/`.

**How information moves**

- **App → console.** The console reads the app's facts from `origin/app`
  (Technique Library `components/training-mode/practiceData.js`, path lessons
  `components/training-mode/data/practiceLessons.js`, brand facts via
  `content-kit/`). It merges `app` into its own branch before cutting a
  tutorial, so the words on screen match the app.
- **Console → app.** Deliveries arrive as a `claude/console-handoff-<date>`
  branch cut from `app` that carries only app files: tutorial videos and
  posters in `public/static/practice/`, the slot links (`videoUrl`) in the two
  data files, the image lock, and any app code a delivery needs. The app chat
  (or the owner) reviews and merges it like any other PR. The console makes it
  with `npm run app-video` then `npm run handoff` (TM Social Console).
- **Words the app changes.** If the app chat rewords, renames or removes a
  Technique Library entry or lesson that has a `videoUrl`, add a line under
  *Needs* so the console re-cuts the tutorial; the video's on-screen words come
  from the entry.
- **Footage.** The owner sends clips to the console chat. What's still to film
  lives in `TM Social Console/brain/shoot-list.md` on the console branch; the
  short version is under *Needs* here.

## Needs (open)

- **App needs from the console:** the four stances and all the punches
  (filmed Saturday); lead and rear teep, low kick, rear side kick, check;
  clinch knee and clinch side knee; the specials (flying knee, hurricane kick,
  spinning back fist, double-hand punch, fake teep to sliding elbow, spinning
  jump kick optional); lead and rear spear elbow (the owner names the clips).
- **Console needs from the app:** nothing right now.

## Log

### 2026-11-08 · app → console · Combo Coach guide videos to film to, plus an audio aligner (owner asked for them)

- **What.** Eight Combo Coach screen videos (2 each: boxing, kickboxing, Muay
  Thai, MMA), about a minute each: 10 combos called at 4.5 s, a 3-beep
  count-in and the app's bell. Video 1 of each style is a level 5 athlete,
  video 2 a level 10 one. The owner plays one out loud, films themselves on
  the bag to it, and sends the clip; the guide sound in their clip is how the
  two get lined up. Level 5 videos also hold 2 or 3 one-word defence calls
  (the app's own rule).
- **Tools.** `npm run app-broll -- --only sync` records them (about 3 minutes
  a video, real time; fixed seeds; speech is intercepted in the page and
  rendered offline with eSpeak NG + MBROLA, `tools/sync-audio.mjs`);
  `npm run align -- <guide.mp4> <owner-clip.mp4>` finds where the guide's 0:00
  falls on the owner's clip by audio (`npm run test:align`: 18 cases, worst
  error 6 ms). Timing sheets (JSON + CSV per video) and the owner's film
  guide are in `brain/combo-sync/` (text only; the videos are git-ignored).
- **Voice.** A robotic offline voice, chosen by measurement, not by ear.
  Whoever has a speaker should play one video before the owner films. The
  Higgsfield announcer lines can replace it later: the lines and their frame
  times are in the sheets.
- **Next.** When the owner's clips arrive in raw-footage/drive: align each
  with `npm run align`, then cut a reel with the app screen and their
  striking side by side or picture-in-picture (new template, not built).

### 2026-11-07 · app → console · five update reels, drafted from app B-roll (owner asked for them)

- **What.** Five ScriptShort posts in `TM Social Console/queue/2026-11-07-*`:
  Quick Mission for people short on time, your level sets the difficulty,
  guided or at your pace, Combo Coach by level, and a what's-new roundup. All
  five are **rendered, not approved**; the owner approves every post. Each post
  carries its platform captions and a `voiceover` script (the reels are silent;
  Coach TM records the voice).
- **B-roll is the app itself.** New `npm run app-broll` (`tools/app-broll.mjs`)
  serves a built app export, seeds a level 1, level 3 and level 10 athlete,
  and records 14 portrait clips to `raw-footage/app/` (not in git). Re-run it
  whenever the app changes: `npm run build:web` at the app root, then
  `npm run app-broll -- --dist ../dist`. It needs the app repo's
  `node_modules` (playwright-core) and `CHROME_PATH` (or `--chrome`).
- **Render here.** Remotion renders headless with `CHROME_PATH` set (tools/render.mjs
  and doctor.mjs now honour it; nothing changes when it is unset). About 5.6 s
  of render per video second; one render at a time.
- **Template.** ScriptShort gained off-by-default options for app-screen
  B-roll (true colours, light scrim, caption panels in the safe zone:
  `src/parts/AppCaption.tsx`). Existing posts render as before.
- **Synced facts.** `npm run sync` refreshed `brand/brand.json` from the
  merged app: ranks now start at XP 0 / 1,500 / 3,000 / 4,500 / 6,000, the
  December drop is titled THE DESTROYER in the app (Ultra Ego is caption-only:
  CLAUDE.md still shows it as an example name), and the tape is One-Bell 300.
- **What changed in the app (the reels' facts).** Quick Mission: TIME 5 to 60
  minutes in 1-minute steps, the card changes live; GUIDED | AT YOUR PACE;
  it opens on your level (1-2 EASY, 3-5 MEDIUM, 6-9 HARD, 10+ ADVANCED) with
  your Fit progress counting most; Combo Coach opens on your Fight level;
  Profile > avatar opens the Level page with an AT YOUR LEVEL block; MAX OUT:
  five max-rep workouts.

### 2026-11-03 · console → app · 17 Practice tutorials (`claude/console-handoff-2026-11-03`)

- **Lesson card plays tutorials.** `PracticeMode.jsx › DetailCard`: when a
  lesson or library entry has a `videoUrl`, the 16:9 player shows its poster
  (same path, `.webp`) and the gold play button, then plays the video inline
  (muted, native controls). Moves without one keep the read-aloud guide.
  Library tiles with a video show "· ▶" by the level.
- **Videos.** 17 owner tutorials, 720p, about 1 MB each (21 MB), in
  `public/static/practice/`:

  | Video | Slots |
  |---|---|
  | lead-hook-elbow | Muay Thai › Lead Hook Elbow · lesson mt_elbow |
  | rear-hook-elbow, lead-uppercut-elbow, rear-uppercut-elbow, lead-diagonal-elbow, rear-diagonal-elbow, tomahawk-elbow, spinning-back-elbow | the Muay Thai entry of the same name |
  | machine-gun-kick, lead-shuffle-knee, roundhouse-knee | the Muay Thai entry of the same name |
  | lead-side-kick, stepping-side-kick, spinning-back-kick | the Kickboxing entry of the same name |
  | switch-kick | Kickboxing, Muay Thai, MMA › Switch Kick |
  | rear-roundhouse-kick | Kickboxing, Muay Thai, MMA › Rear Roundhouse Kick · lessons kb_roundhouse, mt_roundhouse |
  | rear-knee | Kickboxing, Muay Thai, MMA › Rear Knee · lesson mt_knee |

- **Technique Library (owner's names and Thai or karate names).** Added:
  Kickboxing › Stepping Side Kick, Spinning Back Kick; Muay Thai › Lead
  Diagonal, Rear Hook, Lead Uppercut, Rear Uppercut, Rear Diagonal, Tomahawk
  and Spinning Back Elbow, Switch Kick, Machine Gun Kick, Lead Shuffle Knee,
  Roundhouse Knee; MMA › Switch Kick. Renamed: Muay Thai › Lead Horizontal
  Elbow → Lead Hook Elbow. Kickboxing › Rear Roundhouse Kick now uses the same
  key points as Muay Thai and MMA (one video fits all three). Descriptions
  carry the Thai or karate name (Sok Tat, Te Tat, Khao Trong, Yoko Geri…);
  `next` links updated to chain the new entries.
- **Service worker** (`public/sw.js`) leaves `.mp4` to the network: video
  streams in byte ranges (Safari plays video only from 206 responses) and the
  Cache API refuses partial responses.
- **Checks.** `assets.lock.json` gains the 17 posters. `npm run smoke:web` has
  a new step, "practice tutorial plays" (Muay Thai › Rear Knee). Lint, types,
  the asset check and the full web smoke test passed on the console branch.
- FIGHT-MODE-TODO.md 1.7 records it.
