# Transfer kit → Training Mode revamp

Everything shipped to branch `app` of `github.com/Trainingmodeco/trainingmodecode`
between 2026-09-05 and 2026-09-11, ready to move into the revamp codebase.
The authoritative instructions are **PROMPT REVAMP-2** in `BUILD-PROMPTS.md`;
this folder is the payload it refers to.

| Range | Base | Head | Code files |
|---|---|---|---|
| The week | `8ce2c13` | `e9169da` | 52 (44 changed, 8 new, 2 deleted) |

## What is in the week

| Feature | Commits |
|---|---|
| Sessions survive the OS taking the app (session survival + restored clock) | `1642416` |
| Volume: bell off the VOICE fader, fixed level, arcade chrome owns the mixer | `58faaf6` `a0d057f` `afd0213` |
| Floating mini-player: engine, MP-D paint, one window per session, auto-open routes, every timer, live-preview button | `16457ed` `7f0cf89` `095a45c` `3bc43fe` `a3c2f22` `be4ca67` |
| Cardio Mode as a run app: auto-start, voice, distance first, wall clock, GPS, elite time | `aa8bf29` |
| Ghost mode for runs: selector, live strip, coach calls who is winning | `45dfb92` |
| Six launch blockers: webhook, cancellations, subscription screen, analytics, crash reporting | `47e9b64` |
| Honesty pass: stray glyph, camp copy, dead placeholders, real notification permission, reminder card | `e9169da` |
| AN-04 last franchise strings | `08ee279` |

## Option A — pull the files straight from GitHub (recommended)

Run inside the revamp repo. It takes the exact files from `app` and touches
nothing else. The list is every code file the week changed; the two deleted
files are removed explicitly at the end.

```bash
git fetch https://github.com/Trainingmodeco/trainingmodecode.git app
git checkout FETCH_HEAD -- \
  app/+html.tsx \
  netlify/functions/stripe-webhook.js \
  scripts/copy-public-assets.mjs \
  supabase/config.toml \
  public/pip-test.html \
  components/training-mode/App.jsx \
  components/training-mode/ScreenRouter.jsx \
  components/training-mode/HomeDashboard.jsx \
  components/training-mode/Profile.jsx \
  components/training-mode/Notifications.jsx \
  components/training-mode/ManageSubscription.jsx \
  components/training-mode/CardioMode.jsx \
  components/training-mode/CardioProtocolPlayer.jsx \
  components/training-mode/CardioSummary.jsx \
  components/training-mode/RunPlayer.jsx \
  components/training-mode/FitModeHub.jsx \
  components/training-mode/FitBuilderGuidedPlayer.jsx \
  components/training-mode/FitRepCoach.jsx \
  components/training-mode/ComboCoachActive.jsx \
  components/training-mode/FightFocusTimer.jsx \
  components/training-mode/CombatConditioningActive.jsx \
  components/training-mode/QuickMissionActive.jsx \
  components/training-mode/ArcadeBenchmarkPlayer.jsx \
  components/training-mode/ArcadeSeriesDetail.jsx \
  components/training-mode/ArcadeSessionPlayer.jsx \
  components/training-mode/CampFitRunner.jsx \
  components/training-mode/CampFitSetRunner.jsx \
  components/training-mode/PracticeMode.jsx \
  components/training-mode/TrainingCampMap.jsx \
  components/training-mode/data/audioEngine.js \
  components/training-mode/data/authClient.js \
  components/training-mode/data/entitlements.js \
  components/training-mode/data/stripe.js \
  components/training-mode/data/shareUtils.js \
  components/training-mode/data/reminderEngine.js \
  components/training-mode/data/liveRun.js \
  components/training-mode/data/runCoach.js \
  components/training-mode/data/runGhosts.js \
  components/training-mode/hooks/useAutoPauseOnHidden.js \
  components/training-mode/hooks/useMiniPlayer.js \
  components/training-mode/shared/miniPlayer.js \
  components/training-mode/shared/MiniPlayerButton.jsx \
  components/training-mode/shared/BuilderWarmup.jsx \
  components/training-mode/shared/StageChrome.jsx \
  components/training-mode/shared/VoiceMixer.jsx \
  components/training-mode/shared/WorkoutPreviewCard.jsx \
  components/training-mode/shared/screenGuides.js \
  components/training-mode/shared/Emoji.jsx \
  components/training-mode/shared/ReminderCard.jsx \
  components/training-mode/protocol/data/arcade-session-standards.json
git rm -q --ignore-unmatch supabase/functions/stripe-webhook/index.ts supabase/functions/stripe-webhook/README.md
npx tsc --noEmit && npx expo lint && npm run build:web
```

`App.jsx`, `ScreenRouter.jsx`, `Profile.jsx` and `HomeDashboard.jsx` are
whole-file copies. If the revamp carries its own edits in those four, take
them from Option B instead and keep the rest from Option A.

## Option B — apply the patch

`week-2026-09-05-to-09-11.patch` is the full diff of the 52 code files
(documentation excluded). It reverse-applies cleanly against `e9169da`.

```bash
git apply --3way transfer/week-2026-09-05-to-09-11.patch
```

## Option C — cherry-pick the commits

If the revamp shares history with this repo:

```bash
git fetch https://github.com/Trainingmodeco/trainingmodecode.git app
git cherry-pick 08ee279 58faaf6 1642416 a0d057f afd0213 16457ed 7f0cf89 095a45c 3bc43fe a3c2f22 aa8bf29 45dfb92 be4ca67 47e9b64 e9169da
```

## Also bring over (documentation)

`SETUP-MONETIZATION.md` (steps 5–8 are new), `STATUS-2026-09-11.md`,
`BUILD-PROMPTS.md` (SV-1/2, VOL-1/2, MP-1/2/3, MP-D, RUN-1, GHOST-R1,
REVAMP-1, REVAMP-2).

## Dependencies already in the app

`voiceCoach.js`, `data/audioEngine.js`, `hooks/useWakeLock.js`,
`shared/TrainingCTA.jsx`, `SafeImage.jsx`, `data/userProfile.js`,
`data/userStats.js`, `data/analytics.js`, `data/notificationMessages.js`,
`data/links.js`, the ghost art at `public/static/ghost/vs-*.webp`, the
Supabase migration `20260815211807_create_entitlements.sql` (the webhook
writes `status`, `stripe_subscription_id`, `cancel_at_period_end`, which that
migration defines).
