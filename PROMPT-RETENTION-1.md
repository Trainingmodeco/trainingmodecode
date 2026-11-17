# PROMPT RETENTION-1 — Make coming back the game: daily mission, streak freeze, the path, near-miss, leagues, squads, season track

**From the console chat, at the owner's request (2026-11-17).** Scope: the app
on branch `app`. Read the source before writing; where this prompt and the
source disagree, the source wins, and say so in your reply.

## What the owner wants

Training Mode should pull people back the way the best mobile games do
(the level map and "one more try" of match-3 games; the base, clans, leagues
and seasons of base-building games), without their dark patterns. Six
features, **done one by one, in the order below**.

**The owner's process, which is not optional:**

1. **Looks first.** Before any feature code, make the visual design of all six
   as screens the owner can open on a phone (see *Phase 0*). No data wiring.
2. **The owner approves each look** (or asks for changes). Nothing is built
   until its look is approved.
3. **Then build one feature at a time**, each its own branch and pull request
   into `app`, each behind a flag until the owner says ship. Do not start
   feature N+1 until N is merged or the owner says to.

## Rules that hold for all six

- **Only the workout moves progress.** No lives, no energy bars, no paying or
  watching ads to skip a wait, no XP for opening the app, sharing or inviting.
  XP, stars and rewards come from finished, valid sessions only (keep the
  mission-integrity checks as they are).
- **Rest is part of training.** Nothing may punish a planned rest day or push
  someone to train hurt. Streaks count training days per week, not every day.
- **Notifications say something true and useful** ("recovered", "your squad
  needs 6 rounds", "the drop ends Sunday"). No guilt copy. Respect the
  existing reminder settings and quiet hours.
- **App names only**: no franchise, character or film names in any user text
  (the existing franchise guard test must still pass).
- **Pro stays as it is.** None of these features is a new paywall and none
  changes what Pro unlocks. Cosmetic rewards only, unless the owner says
  otherwise.
- **Look**: the app's own violet and gold arcade style and components
  (`Styles`, `ArcadeUI`, `ArcadeBackdrop`, the existing toasts and overlays).
  Reuse before inventing.
- **Honest numbers**: leagues and squads show real people only. No bots, no
  padded leaderboards. If a league would be empty, don't show one yet.

## What already exists (start from these, don't rebuild)

Check each against the source; this list is from a file search, not a full
read.

| Piece | Where |
|---|---|
| Day streak in the home header, streak nudges | `HomeDashboard.jsx`, `data/comboStreak.js` |
| XP, ranks, stakes, banners | `data/xpStakes.js`, `data/xpBanners.js`, `data/fightSessionXp.js`, `data/quickMissionXp.js`, `protocol/data/xp-rules.json` |
| Arcade sagas, stage stars, stage intro/clear overlays | `TrainingArcade.jsx`, `ArcadeSeriesDetail.jsx`, `ArcadeStageIntroOverlay.jsx`, `ArcadeStageClearOverlay.jsx`, `data/arcadeProgress.js`, `data/arcadeCampaignProgress.js` |
| A stage map with pulsing nodes and a boss node | `ArcadeConstellationMap.jsx` |
| Achievements, trophies, badges (three systems) | `REWARDS.md`, `data/achievements.js`, `data/achievementTriggers.js`, `shared/AchievementToast.jsx` |
| Ghost challenges and versus screens | `GhostChallenge.jsx`, `data/ghostChallenges.js`, `data/ghostBattles.js`, `data/ghostCloud.js`, `shared/GhostVsScreen.jsx`, `shared/GhostResultScreen.jsx` |
| Reminders | `data/reminderEngine.js`, `protocol/reminders-engine.ts`, `protocol/data/workout-reminders.json`, `ReminderCard.jsx`, `Notifications.jsx` |
| Concept drops (the two-month seasons) | `data/concepts/index.js`, `ConceptScreen.jsx`, `shared/ConceptDropPopup.jsx` |
| Session end screens | `shared/MissionComplete.jsx`, `QuickMissionComplete.jsx`, `SessionSummary.jsx` |
| Sharing | `ChallengeShareModal.jsx`, `CompletedWorkoutShareCard.jsx`, `ShareActions.jsx` |
| Accounts and cloud data | the Supabase client and tables the app already uses |

## Phase 0 — the looks (do this now, before anything else)

Build **one design gallery** the owner can open on a phone: a hidden route or
dev screen (for example `/#retention-looks`, not linked from the app's menus,
left out of production navigation) that shows every screen below as a real
rendered component with made-up sample data, at phone size, in the app's own
style. One screen per card, with its name and a one-line note. Where a moment
is animated (a pop, a pulse, a count-up), animate it.

For each feature show **every state** listed. Send the owner the link to the
deploy preview and a contact sheet of screenshots, and ask for a yes, a no or
changes per feature. Keep the sample names neutral (Trainee, Squad Alpha).

### Looks to make

**1. Daily mission + streak freeze**
- Home header: the streak chip as it is today, and the new chip showing the
  week (e.g. 3 of 4 training days done, dots for the days) and a freeze count.
- Home: a DAILY MISSION card at the top: a 3-minute mission, one tap to start,
  its XP, and its done state.
- The streak-kept moment after a session; the "freeze used" notice the next
  day; the "freeze earned" moment; the week-complete moment.
- Settings: the weekly target picker (2 to 6 days; default 4).

**2. The path + stars**
- A full-screen path for a saga and for Training Camp: cleared nodes with 1 to
  3 stars, the current node pulsing with START on it, locked nodes, the boss
  node. Start from `ArcadeConstellationMap` and say what changes.
- Home: a "NEXT UP" row that jumps straight to the current node.
- A cleared node's replay sheet: best stars, what the third star needs.
- The stage-clear overlay with the stars landing one by one.

**3. Near-miss retry**
- The end screen after a failed or partial boss/stage: how close it was in
  plain words ("8 reps short", "one round to go"), a RETRY button, and a
  "come back fresh tomorrow" option that is just as easy to press.
- The same screen after a clear with fewer than 3 stars ("12 s off 3 stars").

**4. Weekly leagues**
- The league screen: league name and tier, the list of about 30 real athletes
  with weekly XP, the promotion and relegation zones marked, time left.
- The home entry point (a small card: league, position, days left).
- Week end: promoted / stayed / dropped moments.
- The empty state before there are enough athletes, and the opt-out switch.
- Propose tier names in the app's own voice (reuse the rank art if it fits).

**5. Squads**
- Create or join a squad (code or link), a squad of 5 to 20.
- The squad screen: members, this week's shared goal with a progress bar
  (e.g. 100 rounds), who added what today, the squad chest locked and opened.
- The home entry point, and the chest-opened moment.
- Leave, report and remove-member controls. No free-text chat in the first
  version: preset cheers only.

**6. Season reward track**
- On the concept drop page: a track of rewards for training days in the drop
  (e.g. 4, 8, 12, 16, 20 days), claimed / next / locked states, days left.
- The reward-claimed moment. Rewards are cosmetic: a drop badge, a profile
  frame, a title. Propose the set for the live drop.

**Also in the gallery: the CLEARED moment.** Show the current stage-clear
screen next to a louder version (bigger type, count-up, stars, sound cue
note), since every feature above lands on it.

**What to send back for Phase 0:** the preview link, the screenshots, and for
each feature a short note: what you reused, what is new, and the open
questions below with your recommendation.

## Phases 1–6 — the builds (only after that feature's look is approved)

Each feature is its own branch and pull request, behind a flag, with tests,
in this order. For each one, write the rules down in the pull request before
coding them, and add a line to `FIGHT-MODE-TODO.md` (or the to-do file that
fits) and to the HANDOFF log.

**1. Daily mission + streak freeze** (smallest; proves the loop)
- A streak is kept by reaching the weekly target of training days (owner's
  default: 4), not by training every day. Decide with the owner how the
  existing day streak in `comboStreak.js` carries over; nobody loses a streak
  on update.
- A freeze covers one missed target. Earned by training (suggest: one per
  completed 4-week run, hold at most 2). Never bought, never an ad.
- The daily mission is a short valid session (suggest 3 minutes: one round of
  Fight Focus or a Quick Mission), drawn so it fits the athlete's level and
  yesterday's work. Finishing it counts as a training day. One a day.
- Tests: week boundaries and time zones, freeze use and earn, clock changes,
  offline finish then sync.

**2. The path + stars**
- One path component for sagas and Training Camp; opens on the current node.
- Stars use the stage's existing star rules; if a stage type has none, propose
  one (completion, pace, form) and get the owner's yes.
- Replay keeps the best result; replays give stars, and XP by the existing
  rules only.

**3. Near-miss retry**
- "How close" comes from the session's real numbers. Offer RETRY only when a
  retry is safe: not after a max-effort boss, not past a sensible daily load
  (use the readiness and recovery data the app already has). Otherwise the
  screen says when to come back.

**4. Weekly leagues** (first feature that needs the server)
- Weekly XP from valid sessions only; groups of about 30 by tier; top few
  promote, bottom few drop; week runs Monday to Sunday in the athlete's own
  time zone, settled on the server. Opt-in, display name only, no email or
  location shown.
- Design the tables and row-level security first and show the owner; decide
  what an offline week does. Cheating: reuse mission integrity; cap XP per day
  at a sane level.

**5. Squads**
- Squad of 5 to 20, joined by code or link; one squad at a time. Shared weekly
  goal sized to the squad; everyone who contributed gets the chest (cosmetic).
- Safety: report, remove, leave, block; preset cheers only; no minors'
  details; follow the store rules for user-generated content.

**6. Season reward track**
- Counts training days inside the live drop's window (`CONCEPT_SCHEDULE`).
  Rewards are cosmetic and kept forever; a missed drop's rewards do not come
  back for money.

## Notifications (one pass, after features 1 and 4 exist)

Add at most these, each with its own switch, through the existing reminder
engine: mission ready (at the athlete's usual training time), streak at risk
(only on the last day it can be saved, once), recovered and next stage open,
league ends tomorrow, squad close to its goal, drop ends in 3 days.

## What not to build

Lives or energy; paying, ads or invites to skip waits or buy freezes; loot
boxes or random paid rewards; fake urgency timers; bots in leagues; streaks
that break on a rest day; XP for sharing, following or inviting.

## Open questions for the owner (answer in Phase 0)

1. Weekly training-day target: default 4, range 2 to 6?
2. Freezes: earned how often, and how many can be held?
3. League tier names, and is the league opt-in or on by default?
4. Squad size limits, and are squads open to the beta now or at launch?
5. Which cosmetic rewards for the live drop's track?
6. Which features are free and which (if any) are Pro? The console's
   recommendation: all six free, since they exist to bring people back.

## What the console chat needs back

Screen recordings or the preview link for each approved look, so the social
videos can show them; and a HANDOFF log line when each feature ships, so the
console's brand facts stay right.
