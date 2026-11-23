# The game-over score board: server design (for the owner, before building)

Status: **looks only**. The screens are at `/score-looks` (one phone screen per state) and in the retention
gallery, section 4 (`/retention-looks#f4`). Nothing in this file has been created on any server and no database
has been touched. Per RETENTION-PLAN.md (owner, 2026-11-23) it is built for real only after the owner approves this
design, behind its own switch, on for the owner's phone only, and opens to everyone with the rest in January.

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
| Fight Focus | discipline, rounds x round length, difficulty | strikes the phone counted (STRIKES ✓) | more | strike counting on, every round done, the integrity check passed |
| Just Train | same as Fight Focus, its own boards | strikes counted | more | same |
| Combo Coach | discipline, rounds x round length, speed, difficulty | strikes counted | more | same (without counting, the called count is the coach's pace: the same for everyone, so it does not post) |
| Quick Mission SOLO | mission, level | the mission's own score: time (for time), rounds + reps (AMRAP), sets held (EMOM), reps (intervals) | less time; more of the rest | finished, not scaled, no swap to an easier move, SOLO's own clock checks passed. A for-time run stopped by the cap ranks under every finisher, by its reps at the cap |
| Max Out | mission, level (the level sets the rounds) | total reps, every set added | more | every set credited. Reps are typed by the athlete, so the caps are tight (each move's rep cap at that level is already in the mission data) |
| Arcade stages | saga, stage, side (fit, fight or both) | stage time | less | cleared and valid |
| Cardio run | distance and unit (5 km, 1 mi, ...) | run time | less | finished with GPS on (the rule personal bests already use) |

No board at first, and why:

- **Workout Builder**: a built routine is the athlete's own, two are rarely the same, and its row keeps only the
  exercises done (no time). Later: library workouts run unchanged, timed, once the finish time is recorded.
- **Training Camp**: every full camp day pays the same, so its board would be all ties.
- **Combat Conditioning, a guided or generated Quick Mission, Practice, Coach's Tapes, cardio logged by hand**:
  different every time, an honor-system video, or minutes typed in.

How a board is keyed (`board` text, one per mode and setting):

```
ff:boxing:3x3:normal           Fight Focus
jt:boxing:3x3                  Just Train
cc:boxing:3x3:medium:normal    Combo Coach
qm:room_12:standard            Quick Mission SOLO
max:boss_rush:standard         Max Out
arc:<saga id>:3:fit            Arcade stage
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
| `get_my_place(board)` | signed in | my best, my place, how many players, what the next place needs |
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
   - the score is inside the board's cap (no 0:40 5 km, no 2,000 strikes in 9 minutes), and a time is not shorter
     than the time since the ticket;
   - this session id has not posted before;
   - I am under the rate limits: 40 tickets and 30 scores a day, 6 scores a board a day.
3. Only a better score replaces my old best on that board (one best per athlete per board). A worse one is noted as
   "not a new best" and changes nothing.
4. A score within 5% of the cap, or more than 30% better than my own best, is accepted and also written to
   `board_flags` for a look. Nothing is shown to the athlete.

The app itself only sends what its own checks already passed: the integrity check (`missionIntegrity`), SOLO's
clock checks (`missionSolo`), the arcade clear verdict, a GPS run. The server checks above are the second lock, for
anyone who skips the app.

One honest limit: strikes counted by the phone are already "win only" in the app (`rushVerdict.js`) until a gym
test proves the counter is fair. The fight boards should wait for that test, or open marked BETA.

## Display name, opt-in and the name filter

- Asked once, the first time a finished session could post: JOIN or NOT NOW (the `optin` look). NOT NOW goes on to
  the end screen; joining later is one switch in Profile, next to the name, the country and LEAVE BOARDS.
- The display name is the only thing shown: never the email, photo, Google name or location. The country is off
  until the athlete turns it on.
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
  "of 2,310 players" or in anyone's world rank.

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
| App: the board key and score for each mode from its session results, tickets, the submit queue, the local copy | 3 |
| Screens: wire the looks' components, the opt-in, Profile (name, country, LEAVE BOARDS), offline and signed-out lines | 2 |
| Name filter, reserved names, caps checked against real sessions, a short moderation guide | 1 to 2 |
| Tests, phone previews at 360, 390 and 430, owner review | 1 to 2 |
