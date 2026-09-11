# Transfer kit → Training Mode revamp

Everything from the three commits below, ready to drop into the revamp
codebase. Source of truth is branch `app` of
`github.com/Trainingmodeco/trainingmodecode`.

| Commit | What |
|---|---|
| `aa8bf29` | Cardio Mode as a run app: auto-start, voice, distance first, survives leaving (PROMPT RUN-1) |
| `45dfb92` | Ghost mode for runs: selector, live strip, coach calls who is winning (PROMPT GHOST-R1) |
| `be4ca67` | Mini-player: the button is a live preview so the window can open by itself (PROMPT MP-3) |

## Files (13)

New:
- `components/training-mode/RunPlayer.jsx`
- `components/training-mode/data/runCoach.js`
- `components/training-mode/data/runGhosts.js`
- `components/training-mode/data/liveRun.js`

Changed:
- `components/training-mode/CardioMode.jsx`
- `components/training-mode/CardioProtocolPlayer.jsx`
- `components/training-mode/CardioSummary.jsx`
- `components/training-mode/FitModeHub.jsx`
- `components/training-mode/App.jsx`
- `components/training-mode/ScreenRouter.jsx`
- `components/training-mode/shared/miniPlayer.js`
- `components/training-mode/shared/MiniPlayerButton.jsx`
- `public/pip-test.html`

## Option A — copy the files straight from GitHub (recommended)

Run inside the revamp repo. It pulls the exact files from `app` without
touching anything else:

```bash
git fetch https://github.com/Trainingmodeco/trainingmodecode.git app
git checkout FETCH_HEAD -- \
  components/training-mode/RunPlayer.jsx \
  components/training-mode/data/runCoach.js \
  components/training-mode/data/runGhosts.js \
  components/training-mode/data/liveRun.js \
  components/training-mode/CardioMode.jsx \
  components/training-mode/CardioProtocolPlayer.jsx \
  components/training-mode/CardioSummary.jsx \
  components/training-mode/FitModeHub.jsx \
  components/training-mode/App.jsx \
  components/training-mode/ScreenRouter.jsx \
  components/training-mode/shared/miniPlayer.js \
  components/training-mode/shared/MiniPlayerButton.jsx \
  public/pip-test.html
npx tsc --noEmit && npm run build:web
```

`App.jsx` and `ScreenRouter.jsx` are whole-file copies. If the revamp has
its own edits in those two, use Option B for them instead and keep the
rest from Option A.

## Option B — apply the patch

`cardio-ghost-minipreview.patch` is the full diff of the 13 files.

```bash
git apply --3way transfer/cardio-ghost-minipreview.patch
```

Conflicts, if any, land only in `App.jsx` / `ScreenRouter.jsx`; the changes
there are small and listed in PROMPT RUN-1 and GHOST-R1 (`ACTIVE_SESSION_SCREENS`
+ `isSessionScreenLive`, `cardioEntry` state, the `CardioMode` props).

## Option C — have the revamp session do it

Paste PROMPT RUN-1, GHOST-R1 and MP-3 from `BUILD-PROMPTS.md`. Each names
the files and the verify steps.

## Dependencies already in the app

`voiceCoach.js` (speakAsync, primeSpeech), `data/audioEngine.js` (playBell,
playBeep, unlockAudio), `hooks/useWakeLock.js`, `hooks/useMiniPlayer.js`,
`shared/TrainingCTA.jsx`, `SafeImage.jsx`, `data/userProfile.js`,
`data/analytics.js`, the ghost art at `public/static/ghost/vs-*.webp`.
