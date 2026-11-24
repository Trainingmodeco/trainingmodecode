# The game-over score board: server design (approved 2026-11-23, built 2026-11-24)

Status: **built, owner-only, the migration not yet applied.** The owner approved this design on 2026-11-23. It is
built for real behind its own switch, `scores` (`data/retentionFlags.js`), off in `FOR_EVERYONE` and on only with the
owner preview, so only the owner's phone sees it until January. The migration is in the repo
(`supabase/migrations/20261123120000_create_score_boards.sql`) and has been run only on a local test database
(PGlite); the live database has not been touched. Until it is applied, the switch on asks for a ticket, gets no
answer it can use and shows no board (only the one-line reasons that need no server, such as a setting off the board). What was built, which boards, how to apply and roll back: **Built** at the end
of this file. The looks are still at `/score-looks` and in the retention gallery, section 4.

## What it is

After a finished session, the athlete sees their score for that mode and where it ranks in the world, like an
arcade HIGH SCORES list: ten places, each with a display name, a level and a score. While a board is new, CPU house
scores fill the empty places. Real players rank among them. Once a board has 5 real players, house scores stay only
below the lowest real score, so they fade out as people join. A house score is never shown as a person.

## Where it shows (pick one)

- **A. Full screen straight after FINISH** (GAME OVER, HIGH SCORES, CONTINUE to the end screen). Big moment, but one
  more tap after every session.
- **B. A HIGH SCORES card on the end screen** (the top 3, your row, VIEW BOARD). No extra tap. On a 360 phone it
  pushes the end screen's buttons below the fold.

**Recommendation: B every time, and A only when it is news**: a new best that lands in the top 10 or moves you up,
or your first score on a board. A full screen after every session gets skipped by habit; saved for a new best it
stays a moment worth having.

## What a score is, mode by mode

One board is one mode at one setting, so every score on it was made under the same conditions. Ties go to whoever
set the score first.

| Mode | One board per | Score | Better | Posts only when |
| --- | --- | --- | --- | --- |
| Fight Focus | discipline, board setting (below: rounds x length and rest), difficulty | strikes the phone counted (STRIKES ✓) | more | strike counting on, a board setting, no Rush Mode or ghost, every round done, the integrity check passed |
| Just Train | discipline, one of its four built-in presets | strikes counted | more | same |
| Combo Coach | discipline, board setting, MODE, difficulty (which sets the cadence) | strikes counted | more | same, at the difficulty's own cadence (without counting, the called count is the coach's pace: the same for everyone, so it does not post) |
| Quick Mission SOLO | mission, level | the mission's own score, **entered by the athlete** (below): time (for time), rounds + reps (AMRAP), sets held (EMOM), reps (intervals) | less time; more of the rest | finished, not scaled, no swap to an easier move, inside the caps below. A for-time run stopped by the cap ranks under every finisher, by its reps at the cap. Opens marked BETA |
| Max Out | mission, level (the level sets the rounds) | total reps, every set added | more | every set credited. Reps are typed by the athlete, so the caps are tight (each move's rep cap at that level is already in the mission data). Opens marked BETA |
| Arcade stages | saga, stage, side (fit, fight or both: each takes a different time) | stage time, pauses counted | less | cleared and valid, not resumed from a saved run |
| Cardio run | distance and unit (5 km, 1 mi, ...) | run time, pauses counted | less | finished with GPS on (the rule personal bests already use) |

**Fight boards are a few fixed settings.** The setups let rounds go from 1 to 12, a round from 0:30 to 8:00 in half
minutes and the rest from 0 to 120 s, and Combo Coach's CADENCE from 2 to 8 s. A board for every mix would leave
nearly all of them empty (mostly CPU rows), and the rest changes how many strikes a work round can hold. So a fight
session posts only at a board setting, rest included; any other mix trains as today and the end screen says why in
one line (Fight Focus: "Board settings only: 3 × 3 or 5 × 3 min, 60 s rest.").

- Fight Focus and Combo Coach: **3 × 3 min, 60 s rest** (the setups' default) and **5 × 3 min, 60 s rest**.
- Just Train: its four built-in presets, each with its own rest (Bag 6×3, Pads 8×2, Spar 5×3, Tabata 8×0:20). A saved
  custom preset does not post.
- Combo Coach: the cadence is the difficulty's own (Easy 4.0 s, Normal 3.5 s, Hard 3.0 s, Advanced 2.5 s, the setup's
  `CADENCE_BY_DIFF`), so the difficulty in the key says the cadence; a run with the CADENCE stepper moved off it does
  not post. There is no separate speed word in the key. MODE (Technical or Combo) is in the key: it changes what is
  called.
- Rush Mode and a ghost challenge add surges, so those sessions do not post.

**SOLO and Max Out scores are typed, so they are capped.** SOLO is honor-system (`missionSolo.js`: "SOLO is
honor-system: the floor is the check"). The athlete enters the score at the end, prefilled from the round taps, and a
for-time time is only as honest as the moment FINISH was pressed. The clock checks keep the XP fair; they do not prove
the score. So a SOLO board takes the Max Out kind of caps on the score itself, in the app and again on the server:

- every rep at least half the move's elite time (`repsCeiling`, the ceiling Max Out uses), so an AMRAP, an interval
  or a capped for-time run can never hold more reps than its clock could; a loaded move also keeps its set cap
  (`repCapFor` in `missionMoves.js`); a minutes-held EMOM never more than its minutes;
- a for-time time never under SOLO's own floor (half the elite time, `soloFloorSec`), the line the app already
  refuses today;
- the board's `cap` is the most the clock can hold at that ceiling, and a score near it is flagged (below).

Both open marked BETA, like the fight boards, until the caps have been checked against real sessions (a BETA mark
after the mode, as on the `board-top10` and `board-early` looks).

**A board time counts pauses.** Every time board ranks the time from START to FINISH with pauses in it, so pausing
can only make a time slower. A time without pauses could be gamed by resting on PAUSE. The arcade's stage time is
already wall time from the end of the briefing, so it takes in the pause button and the auto-pause when the app is
hidden. SOLO's
clock and a run's clock stop on PAUSE, so their board time adds the paused seconds back (SOLO keeps `pausedSec`; a
live run keeps its pause total, and the saved run must keep it too).

**The arcade needs a time per side.** A stage cleared on the fit side, the fight side or both takes very different
times, so its boards stay per side. Today the app cannot feed them: `completeStage` (`arcadeProgress.js`) marks fit
and fight both done on any clear and keeps one `bestTimeSeconds` per stage, so a best on one side overwrites the
other's, and a run has no id of its own. The build records the side of the run and a best time per side, and the
ticket's id is the run's session id. A run resumed from a saved session restarts its clock at the resume (the time
before the save is lost), so it does not post.

No board at first, and why:

- **Workout Builder**: a built routine is the athlete's own, two are rarely the same, and its row keeps only the
  exercises done (no time). Later: library workouts run unchanged, timed, once the finish time is recorded.
- **Training Camp**: every full camp day pays the same, so its board would be all ties.
- **Combat Conditioning, a guided or generated Quick Mission, Practice, Coach's Tapes, cardio logged by hand**:
  different every time, an honor-system video, or minutes typed in.

How a board is keyed (`board` text, one per mode and setting):

```
ff:boxing:3x3r60:normal        Fight Focus, 3 × 3 min, 60 s rest, Normal
jt:boxing:bag6x3               Just Train, the Bag 6×3 preset (its rest is part of it)
cc:boxing:3x3r60:combo:normal  Combo Coach, MODE Combo, Normal (so a 3.5 s cadence)
qm:room_12:standard            Quick Mission SOLO
max:boss_rush:standard         Max Out
arc:<saga id>:3:fit            Arcade stage 3, fit side
run:5km                        Cardio run (GPS)
```

## The backend it builds on

The app already uses **Supabase** (`data/authClient.js`: Google sign-in; `data/cloudSync.js`: one
`progress_snapshots` row per athlete; `supabase/migrations/`). The closest pattern is ghost sharing
(`…_create_ghost_sharing.sql`): row-level security on with **no client policies**, table privileges revoked, and every
read and write through a few `security definer` functions that use `auth.uid()`. The score board follows it exactly.

## Tables

**`board_players`**: one row per athlete who joined.

- `user_id` uuid, primary key, references `auth.users`, deleted with the account
- `display_name` text: 3 to 12 letters, numbers, spaces, dots, dashes or underscores; unique ignoring case
- `country` text or null: two capital letters, only if the athlete turned it on
- `level` int, 1 to 999: shown on their rows (display only)
- `hidden` boolean: set by moderation, takes every row of theirs off every board at once
- `blocked_until` timestamptz or null: no new scores until then
- `name_changed_at`, `joined_at`

**`board_scores`**: one best per athlete per board and period.

- `id` bigint identity, primary key
- `board` text (the key above), `period` text (`all` for now; see Periods)
- `user_id` uuid, references `board_players`, deleted with them
- `value` int: the count; seconds for a time; rounds x 1000 + reps for rounds + reps
- `rank_value` int: `value` for a "less is better" board, `-value` otherwise, so every board sorts the same way
- `level` int: the level when the score was set
- `session_id` text: the app's session row id, so one session posts once
- `set_at` timestamptz
- unique (`board`, `period`, `user_id`); unique (`user_id`, `session_id`)
- index (`board`, `period`, `rank_value`, `set_at`): the top 10 and anyone's rank are one index range each

**`board_rules`**: one row per board the server accepts, written only by migrations (generated from the app's own
data: the missions and their levels, the stages, the run distances, the fight settings the setup screens offer).

- `board` text, primary key; `direction` (`more` or `less`); `unit`
- `cap`: the best score that is humanly possible (for a time, the fastest; for a count, the most)
- `min_seconds`: the shortest a real session at this setting can take
- `house` int[12]: the house ladder, best first; `house_kind`: `fight`, `fit` or `run` (which names it uses)

**`board_runs`**: start tickets. `id` uuid, `user_id`, `board`, `started_at`, `used_at`.

**`board_name_blocklist`**: words no display name may contain. Service role only.

**`board_flags`**: scores the server accepted but wants a person to look at (near the cap, a big jump on a
player's own best). Service role only.

## Who can do what (row-level security)

- RLS is on for every table with **no policies**, and `select, insert, update, delete` are revoked from `anon` and
  `authenticated`. Nobody reads or writes a table directly; they call these functions:

| Function | Who | What it does |
| --- | --- | --- |
| `get_board(board)` | anyone, signed in or not | the ten rows: display name, country, level, score, CPU or not. Never a user id or email |
| `get_my_place(board)` | signed in | my best; my place on the list (house rows included, as `get_board` shows it); my rank among players only; how many players; what the next place needs |
| `join_boards(name, country)` | signed in | creates my player row after the name check |
| `set_board_profile(name, country)` | signed in | changes my name (once a week) or country |
| `leave_boards()` | signed in | deletes my player row and every score of mine, at once |
| `start_board_run(board)` | signed in, joined | a ticket for a session about to start |
| `submit_score(ticket, value, session_id, level)` | signed in, joined | accepts or refuses one finished session (below) |

- Every function works on `auth.uid()` only: there is no argument that names another user, so **a user can only
  ever write their own rows**.
- **No client can write a CPU row**: house scores are not rows at all. They are the twelve numbers in
  `board_rules.house`, which only a migration writes, merged into the ten when `get_board` runs.
- Moderation (hide a player, block them, delete one score, edit the blocklist) is service role only: the Supabase
  dashboard or a small admin script, never the app.

## How a score is accepted

1. When the athlete presses START on a board-eligible session (online, signed in, joined), the app asks for a
   ticket. Offline at the start: no ticket, and that session does not post (the end screen says so plainly).
2. At FINISH, the app sends the ticket, the score, its session id and its level. `submit_score` refuses it unless:
   - the ticket is mine, for this board, unused and under 24 hours old;
   - at least `min_seconds` passed between the ticket and now (a 3 x 3 min fight cannot finish in 4 minutes);
   - the score is inside the board's cap (no 0:40 5 km, no 2,000 strikes in 9 minutes), and a time is not longer
     than the time since the ticket (it counts pauses, so an honest one always fits inside it);
   - this session id has not posted before;
   - I am under the rate limits: 40 tickets and 30 scores a day, 6 scores a board a day.
3. Only a better score replaces my old best on that board (one best per athlete per board). A worse one is noted as
   "not a new best" and changes nothing.
4. A score within 5% of the cap, or more than 30% better than my own best, is accepted and also written to
   `board_flags` for a look. Nothing is shown to the athlete.

The app itself only sends what its own checks already passed: the integrity check (`missionIntegrity`), SOLO's
floor and the score caps above (`missionSolo`), the arcade clear verdict, a GPS run. The server checks above are the
second lock, for anyone who skips the app.

Two honest limits: strikes counted by the phone are already "win only" in the app (`rushVerdict.js`) until a gym
test proves the counter is fair, so the fight boards should wait for that test, or open marked BETA. And a SOLO or
Max Out score is typed by the athlete: the caps stop the impossible, not a small fib, so those boards open marked BETA
too.

## Display name, opt-in and the name filter

- Asked once, the first time a finished session could post: JOIN or NOT NOW (the `optin` look). NOT NOW goes on to
  the end screen; joining later is one switch in Profile, next to the name, the country and LEAVE BOARDS.
- Others see the display name and the level. Never the email, photo or Google name. The country (two letters) is the
  only place ever shown, and only once the athlete turns it on; the opt-in says so in those words, above the switch.
- Signed out, the board is read-only and the athlete's own score shows only to them, with "Sign in and join to post".
- **There is no name filter in the app today** (the squads note in the gallery assumes one). This design adds one,
  on the server, in `join_boards` and `set_board_profile`: the name is lower-cased, common look-alikes are mapped
  (0 to o, 1 to i, 3 to e, 4 to a, 5 to s, 7 to t, @ to a, $ to s), the rest of the punctuation is dropped, and it
  must not contain a word on `board_name_blocklist`. Reserved too: every house name, CPU, YOU, Training Mode, coach,
  admin, official, support. A refused name gets one plain line: "Pick another name."
- Later, if needed: REPORT on a name; three reports hide it until someone looks.

## Removing a player

- **The athlete**: LEAVE BOARDS in Profile deletes their player row and every score, at once. Deleting the account
  does the same (the rows reference `auth.users`).
- **Moderation**: `hidden = true` takes all their rows off every board at once and keeps them for review;
  `blocked_until` stops new scores; one bad score can be deleted on its own.
- Whoever was under a removed player moves up on the next read: places are worked out when the board is read,
  never stored.

## Periods

- **All-time only at launch.** A board is one mode at one setting, which already splits the players thin. A weekly
  board would be mostly CPU rows for a long time and would reset the one thing worth chasing.
- The `period` column is there from day one (always `all`), so a weekly board later is new rows, not a new table.
  Worth adding once a board sees about 100 players a week.

## The CPU house rows

- Each board has a fixed ladder of twelve house scores (`board_rules.house`), made from the app's own numbers for
  that setting: a mission's pace targets (elite, standard, beginner), a stage's star times, the run coach's target
  paces, a strikes-per-minute table for the fight settings. So a house score is always a fair, reachable target.
- Names are gym and track equipment, in capitals, with a CPU tag: HEAVY BAG, SPEED BAG, KETTLEBELL, SANDBAG,
  TREADMILL, STOPWATCH and so on (`retention/scoreBoards.js`). Things, never people, so a house row cannot be read
  as a real athlete even before the tag is seen. They are reserved names. Levels are a fixed spread (26 down to 2),
  so every tier colour shows on a new board.
- **The fade rule**, worked out on every read: fewer than 5 real players, all twelve house scores are merged in and
  the best ten rows show; 5 or more real players, only house scores worse than the lowest real score are merged in;
  10 or more real players, the ten are all real. House scores are never stored as players and never counted in
  a player count ("of 2,310 players").
- **Place and rank are two numbers.** A row's place on the list (the PLACE column) counts every row above it, CPU
  included, arcade style: the owner's "real players rank among them", so beating a house score moves you up a place.
  A player's rank
  counts players only. While CPU rows sit above you, YOUR SCORE says both ("6TH PLACE · 3RD OF 4 PLAYERS"); from 5
  players on, house rows sit only under the lowest real score, so the two are the same for every player, and a world
  rank such as "#143 of 2,310" is both.

## What the app shows offline or on a server problem

- The end screen never waits for the server. The card shows the last copy of that board kept on the phone ("as of
  Tuesday"), with this session's score in its place.
- A session that had a ticket but finished offline is kept on the phone and sent the next time the app is online
  (the ticket is good for 24 hours). The card says "Goes up when you are back online."
- A session started offline says "Started offline, so it can't go on the board." Nothing else on the screen
  changes.
- A server error hides the card. Training, XP, the streak and everything else work as today.

## Build estimate

About two weeks of work, after the owner says yes to this design:

| Part | Days |
| --- | --- |
| Migration: tables, functions, RLS and grants, the rules rows generated from the app's data, SQL tests | 2 to 3 |
| App: the board key and score for each mode from its session results (fight board settings, SOLO caps, pauses added back, the arcade's side and time per side), tickets, the submit queue, the local copy | 3 to 4 |
| Screens: wire the looks' components, the opt-in, Profile (name, country, LEAVE BOARDS), offline and signed-out lines | 2 |
| Name filter, reserved names, caps checked against real sessions, a short moderation guide | 1 to 2 |
| Tests, phone previews at 360, 390 and 430, owner review | 1 to 2 |

## Built (2026-11-24)

### The pieces

| Piece | Where |
| --- | --- |
| Migration: 8 tables, RLS on with no client policies, privileges revoked (the two identity sequences too), 8 client functions and 5 internal ones (security definer, `search_path = ''`, `auth.uid()` only, a lock on the athlete before any limit is counted), the hourly ticket and hold purge, and the generated rows (203 boards, the house names, the name filter's words) | `supabase/migrations/20261123120000_create_score_boards.sql` |
| The boards' rules from the app's data (keys, more or less, unit, cap, `min_seconds`, the twelve house scores), each mode's board at START and score at FINISH, eligibility and the one-line reasons, the view the components draw | `components/training-mode/data/scoreBoardRules.js` |
| The generator of the migration's rows (`--check`; `--out` for a later update) | `scripts/score-board-rules.mjs` (`npm run scoreboard:rules`) |
| The client: tickets at START, the submit at FINISH, the opt-in, get_board and get_my_place, the profile calls, the offline queue | `components/training-mode/data/scoreBoardCloud.js` |
| The end screen's slot (the line, the opt-in, the HIGH SCORES card, the GAME OVER board) and Profile's SCORE BOARD row and page | `retention/ui/ScoreBoardSlot.jsx`, `retention/ui/BoardProfile.jsx` |
| Wiring (all behind `scores`) | `App.jsx` (goTimer, goSummary, goComboActive, goComboEnd, goQuickMissionActive, goQuickMissionComplete), `ScreenRouter.jsx`, `SessionSummary.jsx`, `QuickMissionComplete.jsx`, `shared/MissionComplete.jsx` (a `board` slot under the summary), `Profile.jsx` |
| Tests | `npm run test:scoreboard` (125 checks, in `check:all`), `npm run test:scoreboard-sql` (200 checks on PGlite, see below), `npm run preview:scores` (photos of the real app) |

### The boards (203, every one marked BETA)

| Mode | Boards | Key | Score |
| --- | --- | --- | --- |
| Fight Focus | 24: 4 disciplines × 2 settings (3 × 3 or 5 × 3 min, 60 s rest) × Easy, Normal, Hard | `ff:boxing:3x3r60:normal` | strikes the phone counted |
| Just Train | 16: 4 disciplines × the 4 built-in presets | `jt:boxing:bag6x3` | strikes counted |
| Combo Coach | 64: 4 disciplines × 2 settings × MODE (Technical, Combo) × 4 levels, at the level's own cadence | `cc:boxing:3x3r60:combo:normal` | strikes counted |
| Quick Mission at your pace | 84: 28 missions × 3 levels (for time, AMRAP, EMOM, intervals) | `qm:room_12:standard` | time with pauses added back; rounds × 1000 + reps; sets held; reps |
| Max Out | 15: 5 missions × 3 levels, run guided or at your pace | `max:boss_rush:standard` | total reps |

Caps: a fight board 200 strikes a minute of work; a for-time time no faster than SOLO's own floor (half the elite
time); an AMRAP or intervals score no more reps than the clock holds at half the elite rep time (a loaded move keeps
its set cap); an EMOM no more than its windows; Max Out every set at its move's cap and no more than the run's cap can
hold. `min_seconds`: 90% of a fight setting's work (rests are not counted), SOLO's own floor for a mission. House
ladders: the looks' strikes-a-minute table for fights (scaled by level), the mission's elite, standard and beginner
paces for missions (rungs 1, 5 and 9, a lower rung 12).

### Left out, and why

- **Arcade stages.** The app cannot feed them yet: `completeStage` keeps one best time per stage for both sides, a
  run has no id of its own, and a run resumed from a saved session restarts its clock. Building the per-side record
  touches the arcade's saved progress and its several players (classic, v2, concept stages); it is its own step.
- **The GPS run.** Its clock stops on PAUSE and neither the live run nor the saved run keeps a pause total, so a
  board time could not count the pauses as this design requires. It needs the run player to keep that total first.
- **Three SOLO missions**: NO CONTINUES and UPPER LOWER DIPS (until the bell is down: sets + reps against a hidden
  backstop) and TOUCH THE SKY (rounds held, with a time). The design's SOLO scores are time, rounds + reps, sets held
  and reps; these have none of them.
- **A for-time run stopped by its cap** does not post (the board is for finishers). The design ranked it under every
  finisher by its reps at the cap; one number per row cannot say both without a second column.
- Generated Quick Missions, guided Quick Missions (other than Max Out), Workout Builder, Training Camp, Combat
  Conditioning, Practice and Coach's Tapes: as the design says, no board.

### Where it differs from the text above (each small, each easy to change)

- **A ticket does not need a player row.** A signed-in athlete who has never been asked gets a ticket at START, so
  JOIN at the end of that session posts it. `submit_score` is what needs the player row. After NOT NOW (or LEAVE
  BOARDS) the app asks for no ticket until the athlete joins from Profile.
- **The limits count scores taken.** 30 a day and 6 a board a day count accepted posts; refusals do not count (the
  40 tickets a day already bound them), so an honest athlete is never locked out by a refusal.
- **Flags only on a new best** (a score that is not a best is not stored).
- **A first rename is allowed at once** (`name_changed_at` is empty on joining); after that, once a week.
- **`board_house`** holds the house names and levels (gym gear, from `retention/scoreBoards.js`), and
  **`get_board_profile()`** reads my own name and country for Profile.
- **The full board shows when the answer comes within 4 s of the end screen** (always right after JOIN). A slower
  answer only fills the card, which says NEW BEST; VIEW BOARD opens the full board.
- **The card has one quiet line when today did not beat the best** ("Today: 899. Your best (939) stays on the board.").
- **LEAVE BOARDS does not wash away moderation or the limits** (found in review, 2026-11-24). It still deletes the
  player row and every score at once, but a hidden or blocked state and the week a rename waits move to
  **`board_holds`** (service role only, kept only while in force, purged hourly once nothing in it is) and come back
  if the athlete joins again; JOIN under a new name inside a rename's week is refused like a rename ("A name changes
  once a week. You can join again on …"). The day's tickets (the 40, 30 and 6 limits) and the flags are not touched:
  the purge takes tickets after 2 days, and the flags stay for a person to look at. Deleting the account takes all of it.
- **One athlete's calls queue behind each other.** `join_boards`, `leave_boards`, `start_board_run` and
  `submit_score` first take a transaction lock on the athlete (`board_lock`), so parallel calls cannot all pass the
  same count.
- **A hidden player is not told.** `get_my_place` answers only value, level, rank, place, players and next place,
  and a hidden player still sees their own row and counts themself (no one else sees them).
- **The phone's copies belong to one account.** The opt-in, the name and the boards' copies carry the user id;
  another account signed in starts them afresh, and SIGN OUT clears them. A waiting score goes up only under the
  account that started it.
- **A score the server never answered waits.** Offline, signed out since START, an expired token, a busy or failing
  server (401, 404, 408, 429, 5xx): the score stays on the phone for its ticket's 24 hours and goes up when the app
  opens or comes back online. Any answer, a refusal too, ends it. Right after JOIN the athlete always hears back: the
  board, or one line ("You're on the world board. This score tries again next time you open the app.", "…with this
  score.", or "…This score did not go up.").

### Applying the migration (the lead, after review)

1. Read `supabase/migrations/20261123120000_create_score_boards.sql`. It creates only `board_*` tables and functions
   and one cron job; it changes nothing that exists. `pg_cron` is already on (the haunt-code purge uses it).
2. Apply it to the project like the other migrations (`supabase db push`, or the dashboard's SQL editor with the
   file's whole text). It is safe to run twice.
3. Check, in the SQL editor:
   - `select count(*) from public.board_rules;` → 203
   - `select has_function_privilege('anon', 'public.submit_score(uuid, int, text, int)', 'execute');` → false;
     the same for `authenticated` → true; `public.get_board(text)` for `anon` → true
   - `select has_table_privilege('authenticated', 'public.board_scores', 'select');` → false
   - `select jobname, schedule from cron.job where jobname = 'purge-board-runs';` → `41 * * * *`
   - the security advisor: no new warnings for the `board_*` tables (RLS on, no policies is intended).
4. If the app's calls answer 404 right after, PostgREST has not reloaded its schema yet: `notify pgrst, 'reload schema';`.
5. The owner's phone must be signed in (Profile, Google) for tickets; signed out, the end screen says so in one line.
6. When missions or paces change later, write the new rows as a new migration (every row is an upsert):
   `npm run -s scoreboard:rules -- --out supabase/migrations/<timestamp>_update_score_board_rules.sql`.
   `npm run test:scoreboard` fails while the migration's generated block is behind the app's data (until it is applied,
   regenerate the block in place with `npm run -s scoreboard:rules`).
7. Moderation (service role, dashboard): `update public.board_players set hidden = true where display_name = '…';`,
   `blocked_until = now() + interval '7 days'`, `delete from public.board_scores where id = …;`, words added to
   `public.board_name_blocklist (word, exact)` in their filter key (lower case, a to z only), flags in
   `public.board_flags`. A player who left the boards: their hold is in `public.board_holds` (to block or hide one
   who is not joined, `insert into public.board_holds (user_id, hidden, blocked_until) values (…)`).

### Rolling it back

Nothing outside the score board depends on it. In the SQL editor:

```sql
select cron.unschedule('purge-board-runs');
drop function if exists
  public.submit_score(uuid, int, text, int), public.start_board_run(text), public.leave_boards(),
  public.set_board_profile(text, text), public.join_boards(text, text), public.get_board_profile(),
  public.get_my_place(text), public.get_board(text), public.purge_board_runs(),
  public.board_place_of(text, uuid), public.board_name_problem(text, uuid), public.board_lock(uuid),
  public.board_name_key(text);
drop table if exists
  public.board_holds, public.board_flags, public.board_runs, public.board_scores, public.board_players,
  public.board_name_blocklist, public.board_house, public.board_rules;
```

The app needs no change for a rollback: with the functions gone, a ticket request gets no usable answer and the end
screen shows no board. The switch is off for everyone already; to hide it on the owner's phone as well, have
`retentionOn` return false for `scores` (`data/retentionFlags.js`).

### The SQL tests

`scripts/test-scoreboard-sql.mjs` applies the migration (twice) to PGlite, Postgres 17 in WebAssembly, in memory,
with a stub `auth` schema (`auth.users`, `auth.uid()` reading the request's JWT subject), the roles `anon`,
`authenticated` and `service_role`, Supabase's default privileges (so the revokes are what keeps clients out) and a
stand-in `cron.schedule`. It proves: no client role reads or writes any table or draws from its sequences; who may
call which function; every
function has a fixed `search_path` and none a client calls takes a user id; a ticket only for a signed-in athlete; no
post before joining, too early, over the cap, past 24 hours, with someone else's ticket, twice for one session, past
the limits (6 a board, 30 a day, 40 tickets); only a better score replaces a best (more and less boards); flags; the
name filter (shape, reserved house names and look-alikes, blocked words, taken ignoring case); the profile (country
any time, a rename once a week); moderation (blocked, hidden); `get_board` against the app's own `composeBoard` at 3,
5, 6 and 10 players and after a player hides or leaves, never an id or an email; `get_my_place`'s place, rank and next
place (CPU above, a tie, from 5 players on); a hidden player not told (no flag, their own row and count); the lock on
the athlete held by join, leave, a ticket and a submit (one key per athlete); `leave_boards` deleting the player row
and every score while the day's tickets and the flags stay; LEAVE then JOIN keeping a block, a hidden state, the day's
limits and the rename week, a plain LEAVE keeping no hold, and the purge dropping a hold once nothing is in force; an
account deletion taking every row. PGlite is 27 MB, so it is not a dependency: install it once anywhere and run
`PGLITE_DIR=<that folder> npm run -s test:scoreboard-sql` (the script's header says how). It is not in `check:all`.
