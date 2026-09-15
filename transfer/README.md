# Transfer kit → Training Mode revamp

Everything shipped to branch `app` of `github.com/Trainingmodeco/trainingmodecode`
between 2026-09-05 and 2026-09-15, ready to move into the revamp codebase.
The authoritative instructions are **PROMPT REVAMP-2** in `BUILD-PROMPTS.md`;
this folder is the payload it refers to.

| Range | Base | Head | Files |
|---|---|---|---|
| The fortnight | `8ce2c13` | `86d4ceb` | 124 (56 changed, 16 new, 2 deleted, 50 renamed) |

## What is in it

| Feature | Commits |
|---|---|
| Sessions survive the OS taking the app (session survival + restored clock) | `1642416` `d75acf8` |
| Volume: bell off the VOICE fader, fixed level, arcade chrome owns the mixer | `58faaf6` `a0d057f` `afd0213` |
| Floating mini-player: engine, MP-D paint, one window per session, auto-open routes, every timer, live-preview button | `16457ed` `7f0cf89` `095a45c` `3bc43fe` `a3c2f22` `be4ca67` |
| Cardio Mode as a run app: auto-start, voice, distance first, wall clock, GPS, elite time | `aa8bf29` |
| Ghost mode for runs: selector, live strip, coach calls who is winning | `45dfb92` |
| Run history: route map, splits, a RUNS log | `c1bc2f7` |
| Six launch blockers: webhook, cancellations, subscription screen, analytics, crash reporting | `47e9b64` |
| Honesty pass: stray glyph, camp copy, dead placeholders, real notification permission, reminder card | `e9169da` |
| AN-04 last franchise strings | `08ee279` |
| Franchise names out of the arcade **identifiers**, with a progress migration | `2011819` |
| cloudSync stops being a binary file | `86d4ceb` |

## Three things to know before you start

**The arcade ids were renamed, and they are progress keys.** `2011819` moved
`ARC_BAKI` → `ARC_GRAPPLER`, `baki-grappler` → `grappler-protocol` and six more
like them, across campaign ids, stage ids, series ids, fourteen campaign data
directories and eight image files. Those same ids are the keys of
`tm_arcade_progress`, `tm_arcade_v2`, `tm_arcade_intro_seen` and
`tm_active_arcade_challenge`. `data/arcadeIdMigration.js` rewrites them on
boot and again after every cloud restore. **Take that file, and take the
`App.jsx` and `cloudSync.js` calls with it** — the rename without the
migration resets every athlete's Arcade ladder to stage 1 and then syncs the
reset to their other devices.

**The campaign content lives in two places.** `protocol-src/data/campaigns/` is
the authoring source of truth and
`components/training-mode/protocol/data/campaigns/` is the copy the app
imports; they are kept in step by hand. The rename touched both, so both are in
this kit. If you take only the app copy, the revamp's source of truth still
says `ARC_BAKI`, and the next person to re-sync `protocol-src` → app silently
undoes the rename and breaks every athlete's ladder a second time.

**`cloudSync.js` was a binary file until `86d4ceb`.** `hashSnapshot` built its
fingerprint with two raw control bytes in the source, and git classifies any
file containing a NUL as binary — so the previous transfer patch carried
"Binary files differ" instead of the change, and would have dropped the
migration hook in `applySnapshot` without saying so. The bytes are now written
as escapes: identical strings, identical fingerprint, no spurious sync on any
device. In the patch below that one file is still a binary delta hunk, because
the *old* side of the diff is binary; see the note under Option B.

## Option A — pull the files straight from GitHub (recommended)

Run inside the revamp repo. It takes the exact files from `app` and touches
nothing else. This is the only option that handles the renames and the binary
file without special cases. Verified end to end: run against a checkout of the
base commit it reproduces the `app` tree exactly, with `tsc`, `expo lint` and
`build:web` all green.

```bash
git fetch https://github.com/Trainingmodeco/trainingmodecode.git app

# 1. the changed and new files
git checkout FETCH_HEAD -- \
  app/+html.tsx \
  assets.lock.json \
  components/training-mode/App.jsx \
  components/training-mode/ArcadeBenchmarkPlayer.jsx \
  components/training-mode/ArcadeSeriesDetail.jsx \
  components/training-mode/ArcadeSessionPlayer.jsx \
  components/training-mode/CampFitRunner.jsx \
  components/training-mode/CampFitSetRunner.jsx \
  components/training-mode/CardioMode.jsx \
  components/training-mode/CardioProtocolPlayer.jsx \
  components/training-mode/CardioSummary.jsx \
  components/training-mode/CombatConditioningActive.jsx \
  components/training-mode/ComboCoachActive.jsx \
  components/training-mode/FightFocusTimer.jsx \
  components/training-mode/FitBuilderGuidedPlayer.jsx \
  components/training-mode/FitModeHub.jsx \
  components/training-mode/FitRepCoach.jsx \
  components/training-mode/HomeDashboard.jsx \
  components/training-mode/ManageSubscription.jsx \
  components/training-mode/Notifications.jsx \
  components/training-mode/PracticeMode.jsx \
  components/training-mode/Profile.jsx \
  components/training-mode/ProgressScreen.jsx \
  components/training-mode/QuickMissionActive.jsx \
  components/training-mode/RunHistory.jsx \
  components/training-mode/RunPlayer.jsx \
  components/training-mode/ScreenRouter.jsx \
  components/training-mode/TrainingArcade.jsx \
  components/training-mode/TrainingCampMap.jsx \
  components/training-mode/data/arcadeCampaignSeries.js \
  components/training-mode/data/arcadeIdMigration.js \
  components/training-mode/data/audioEngine.js \
  components/training-mode/data/authClient.js \
  components/training-mode/data/cardioSessions.js \
  components/training-mode/data/challengeCodes.js \
  components/training-mode/data/cloudSync.js \
  components/training-mode/data/entitlements.js \
  components/training-mode/data/geoRoute.js \
  components/training-mode/data/liveRun.js \
  components/training-mode/data/optimizedImageMap.js \
  components/training-mode/data/reminderEngine.js \
  components/training-mode/data/runCoach.js \
  components/training-mode/data/runGhosts.js \
  components/training-mode/data/runLog.js \
  components/training-mode/data/seriesTint.js \
  components/training-mode/data/shareUtils.js \
  components/training-mode/data/stripe.js \
  components/training-mode/data/trainingArcadeData.js \
  components/training-mode/data/webpManifest.js \
  components/training-mode/hooks/useAutoPauseOnHidden.js \
  components/training-mode/hooks/useMiniPlayer.js \
  components/training-mode/protocol/campaigns.ts \
  components/training-mode/protocol/data/arcade-session-standards.json \
  components/training-mode/protocol/data/ghost-battles.json \
  components/training-mode/protocol/data/voice-packs.json \
  components/training-mode/shared/BuilderWarmup.jsx \
  components/training-mode/shared/Emoji.jsx \
  components/training-mode/shared/MiniPlayerButton.jsx \
  components/training-mode/shared/ReminderCard.jsx \
  components/training-mode/shared/RouteMap.jsx \
  components/training-mode/shared/RunSplits.jsx \
  components/training-mode/shared/StageChrome.jsx \
  components/training-mode/shared/VoiceMixer.jsx \
  components/training-mode/shared/WorkoutPreviewCard.jsx \
  components/training-mode/shared/miniPlayer.js \
  components/training-mode/shared/screenGuides.js \
  netlify/functions/stripe-webhook.js \
  protocol-src/data/ghost-battles.json \
  protocol-src/data/voice-packs.json \
  public/banners/arcade/destroyer-protocol.png \
  public/banners/arcade/destroyer-protocol.webp \
  public/banners/arcade/vigilante-protocol.png \
  public/banners/arcade/vigilante-protocol.webp \
  public/pip-test.html \
  public/static/series/posters/grappler-protocol.png \
  public/static/series/posters/grappler-protocol.webp \
  public/static/series/posters/struggler-protocol.png \
  public/static/series/posters/struggler-protocol.webp \
  scripts/copy-public-assets.mjs \
  supabase/config.toml

# 2. the fourteen renamed campaign data directories (app copy + authoring source)
git checkout FETCH_HEAD -- \
  components/training-mode/protocol/data/campaigns/ARC_BLUEBLUR \
  components/training-mode/protocol/data/campaigns/ARC_DESTROYER \
  components/training-mode/protocol/data/campaigns/ARC_FLOWSTATE \
  components/training-mode/protocol/data/campaigns/ARC_GRAPPLER \
  components/training-mode/protocol/data/campaigns/ARC_MARTIALMONSTER \
  components/training-mode/protocol/data/campaigns/ARC_STRUGGLER \
  components/training-mode/protocol/data/campaigns/ARC_VIGILANTE \
  protocol-src/data/campaigns/ARC_BLUEBLUR \
  protocol-src/data/campaigns/ARC_DESTROYER \
  protocol-src/data/campaigns/ARC_FLOWSTATE \
  protocol-src/data/campaigns/ARC_GRAPPLER \
  protocol-src/data/campaigns/ARC_MARTIALMONSTER \
  protocol-src/data/campaigns/ARC_STRUGGLER \
  protocol-src/data/campaigns/ARC_VIGILANTE

# 3. drop what the renames and the webhook cleanup left behind
git rm -rq --ignore-unmatch \
  public/banners/arcade/dark-knight-protocol.png \
  public/banners/arcade/dark-knight-protocol.webp \
  public/banners/arcade/ultra-ego-style.png \
  public/banners/arcade/ultra-ego-style.webp \
  public/static/series/posters/baki-grappler.png \
  public/static/series/posters/baki-grappler.webp \
  public/static/series/posters/berserk-struggler.png \
  public/static/series/posters/berserk-struggler.webp \
  supabase/functions/stripe-webhook/README.md \
  supabase/functions/stripe-webhook/index.ts \
  components/training-mode/protocol/data/campaigns/ARC_BAKI \
  components/training-mode/protocol/data/campaigns/ARC_BERSERK \
  components/training-mode/protocol/data/campaigns/ARC_DARKKNIGHT \
  components/training-mode/protocol/data/campaigns/ARC_GAROU \
  components/training-mode/protocol/data/campaigns/ARC_SONIC \
  components/training-mode/protocol/data/campaigns/ARC_ULTRAEGO \
  components/training-mode/protocol/data/campaigns/ARC_ULTRAINSTINCT \
  protocol-src/data/campaigns/ARC_BAKI \
  protocol-src/data/campaigns/ARC_BERSERK \
  protocol-src/data/campaigns/ARC_DARKKNIGHT \
  protocol-src/data/campaigns/ARC_GAROU \
  protocol-src/data/campaigns/ARC_SONIC \
  protocol-src/data/campaigns/ARC_ULTRAEGO \
  protocol-src/data/campaigns/ARC_ULTRAINSTINCT

npx tsc --noEmit && npx expo lint && npm run build:web
```

`App.jsx`, `ScreenRouter.jsx`, `Profile.jsx`, `HomeDashboard.jsx` and
`ProgressScreen.jsx` are whole-file copies. If the revamp carries its own edits
in those five, take them from Option B instead and keep the rest from Option A.

Then confirm the migration is wired — all three call sites must be present, or
progress is lost on the first boot:

```bash
grep -rn "migrateArcadeIds" components/ | sort
# expected: the definition in data/arcadeIdMigration.js,
#           the module-scope call in App.jsx,
#           and the call inside cloudSync's applySnapshot
```

And confirm no legacy id survives outside the alias map:

```bash
grep -rn --include=*.js --include=*.jsx --include=*.ts --include=*.json \
  -E "ARC_BAKI|ARC_BERSERK|ARC_SONIC|ARC_GAROU|ARC_DARKKNIGHT|ARC_ULTRAINSTINCT|ARC_ULTRAEGO" \
  components/ protocol-src/
# expected: only data/arcadeIdMigration.js (the alias map and its comments)
#           and the explanatory comment at the top of App.jsx
```

## Option B — apply the patch

`week-2026-09-05-to-09-15.patch` is the full diff of the 124 files.

```bash
git apply -3 --binary transfer/week-2026-09-05-to-09-15.patch
```

`--binary` is required: the eight image renames and `cloudSync.js` need it.
`cloudSync.js` is a **delta** hunk against blob `1a190f7`, so it only applies in
a repo that already has that exact blob. If the revamp does not share history,
git will reject that one file — take it with Option A:

```bash
git checkout FETCH_HEAD -- components/training-mode/data/cloudSync.js
```

This is the last patch that will ever have the problem; the file is text from
`86d4ceb` onward.

## Option C — cherry-pick the commits

If the revamp shares history with this repo:

```bash
git fetch https://github.com/Trainingmodeco/trainingmodecode.git app
git cherry-pick 08ee279 58faaf6 1642416 a0d057f afd0213 16457ed 7f0cf89 \
  095a45c 3bc43fe a3c2f22 aa8bf29 45dfb92 be4ca67 47e9b64 e9169da 2011819 \
  c1bc2f7 d75acf8 86d4ceb
```

## Also bring over (documentation)

`SETUP-MONETIZATION.md` (steps 5–8 are new), `STATUS-2026-09-11.md`,
`SESSION-UX-TODO.md`, the root `README.md`, `BUILD-PROMPTS.md` (SV-1/2,
VOL-1/2, MP-1/2/3, MP-D, RUN-1, GHOST-R1, REVAMP-1, REVAMP-2, AN-05), and the
three specs: `PROMPT-MONEY-90.md`, `PROMPT-GAMELINK-1.md`,
`GAME-PROTOTYPE-PLAN.md`.

## Dependencies already in the app

The kit imports 129 modules it does not carry. All of them predate this
fortnight and the revamp already has them; the ones worth naming because the
new code leans on them hardest are `voiceCoach.js`, `data/audioEngine.js`,
`hooks/useWakeLock.js`, `hooks/useIntegritySession.js`, `shared/TrainingCTA.jsx`,
`shared/ScreenGuide.jsx`, `SafeImage.jsx`, `PhoneFrame.jsx`, `Styles.js`,
`data/userProfile.js`, `data/userStats.js`, `data/analytics.js`,
`data/arcadeProgress.js`, `data/notificationMessages.js`, `data/links.js`,
the untouched `protocol/data/campaigns/ARC_GRAVITY/`, the ghost art at
`public/static/ghost/vs-*.webp`, and the Supabase migration
`20260815211807_create_entitlements.sql` (the webhook writes `status`,
`stripe_subscription_id` and `cancel_at_period_end`, which that migration
defines).
