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
