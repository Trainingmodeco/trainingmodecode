# 15 · Cardio route map + run history (RUN-1)

Reference: the Astra-class running apps — TRACK ON MAP, a career header, a
weekly goal, a splits table with a unit toggle, and a scrolling list of past
activities you recognise by the **shape** of the route.

Cardio Mode already had the hard half: a GPS watch, wall-clock timing, pace
coaching, splits, ghosts. What it did not have was a **record**. A run finished,
XP was awarded, a summary line went into `tm_cardio_sessions`, and the route the
phone had just drawn was thrown away. This spec is the other half.

---

## 1 · The route is kept, not truncated

The player used to hold at most 240 fixes and `shift()` the oldest off the
front. By mile two the first streets of the run were gone from the map — the
one part of a route an athlete always recognises.

The track is now **simplified, never cut**:

- Every accepted fix appends `{ lat, lng, t, m }` — the second it happened and
  the cumulative metres by then.
- Past `ROUTE_SOFT_MAX` (600) points, **Ramer–Douglas–Peucker** thins it back to
  `ROUTE_KEEP` (300): corners kept, straights dropped, first and last always
  present.
- The finish thins once more to 200 for storage.

A 1 km run stores **146 points in 4.3 KB**. Sixty runs is about 260 KB, which is
why the log caps at 60 and, on a quota failure, sheds the **oldest routes**
before it sheds a run.

`data/geoRoute.js` holds all of it, and is pure numbers — no React, no storage.

## 2 · The map projects like a map

The old trail stretched latitude and longitude independently to fill a 300×64
box, so a square lap came out a smear. `RouteMap` uses **Web Mercator at a
single scale for both axes** — the projection every slippy map uses — and
measures its own element so the SVG viewBox is 1:1 with CSS pixels.

Measured on a synthetic 150 m × 100 m rectangle: real aspect **1.500**, drawn
aspect **1.500**, fitted inside the 14 px padding and centred.

**Colour is pace.** Each segment's speed is a subtraction on the `(t, m)` the
points carry, compared against the run's target pace: green at or under it,
through to orange well behind. Five bands, one `<path>` per band.

**Pins.** Green START, orange FINISH, a gold dot at every half unit and a
numbered one at every whole unit. Labels flip above the dot near the bottom
edge, and a loop run — which finishes where it starts — puts FINISH on the
opposite side of START.

### Raster tiles are optional and off

`EXPO_PUBLIC_MAP_TILES_URL` takes a `{z}/{x}/{y}` template. Set it and real
streets appear under the same projection at an integer zoom; leave it unset —
the default — and the route draws on the app’s own grid.

Off is the default on purpose: it costs nothing, works with no signal, and
sends the athlete’s coordinates to no third party. One out-of-band probe tile
decides whether the layer loads at all, so a blocked host falls back cleanly
instead of showing a grid of broken rectangles.

**Recommended provider: Geoapify**, style `dark-matter-dark-purple`. The app
takes payment, and that single fact eliminates most free map tiers:

| Provider | Free volume | Commercial on free? |
|---|---|---|
| OpenStreetMap standard | n/a | Requires a unique User-Agent a browser cannot send, and bans prefetch/offline — which is what a PWA is |
| Stadia Maps | 200k credits/mo | No |
| MapTiler | 100k req/mo | Non-commercial |
| Mapbox Static Tiles | 200k req/mo | Points at a separate Commercial Application Licence |
| **Geoapify** | **3k credits/day** | **Yes, explicitly** |

`data/mapTiles.js` holds the choice, and the required credit is derived from
the host rather than left to whoever sets the variable — getting attribution
wrong is a licence breach, not a cosmetic slip. The override can replace the
credit, never remove it. The key is a client key that ships in every tile URL,
so it belongs in a public env var locked to the domain in the provider’s
dashboard, not in the secrets pile with Stripe and Supabase.

## 3 · Where the map appears

| Screen | Height | Notes |
|---|---|---|
| Run player, live | 124 | `YOUR ROUTE`, pulsing head, draws as you move |
| Finish card | 160 | `WHERE YOU RAN`, plus a KCAL EST stat |
| Log screen | 168 | Above the form, with the splits table under it |
| Logged confirmation | 130 | `ROUTE SAVED` |
| History row | 50 | Thumbnail — the shape is how you find a run |
| History detail | 175 | Timestamped, with the splits table |

## 4 · Splits table

`shared/RunSplits.jsx`. Columns **DIST · TIME · PACE**, with a `0.5 / 1 / 2`
unit toggle. The player records a split every half unit, so the coarser views
are subsets, not estimates. The last row is always the finish even when it
lands between markers, and the fastest split reads gold.

## 5 · Calories

ACSM's horizontal-running equation, the one trackers use:
`VO2 = 0.2 × m/min + 3.5`, one MET being 3.5, then
`kcal = MET × 3.5 × kg / 200` per minute. Mass comes from the profile
(`weightVal` / `weightUnit`, defaulting to 75 kg).

No heart rate is involved, so **every screen that shows it says EST**. The log
screen prefills the estimate instead of asking the athlete to guess a number
the app can work out.

## 6 · PROGRESS → RUNS

A third tab beside OVERVIEW and TROPHIES. `RunHistory.jsx`.

- **Career totals** — total distance, total time, run count, total kcal.
- **Weekly goal** — distance this week against a target you set (default 10 km,
  editable, km or mi), a progress bar, and seven day-bars Monday-first so the
  week matches the calendar the athlete looks at rather than UTC.
- **Personal bests** — fastest completed GPS run at each goal distance. The
  ghost store keeps the trace to *race*; this is the number to *show*.
- **Your runs** — route thumbnail, distance, date, time, pace, kcal, a GPS/EST
  tag, `★ BEST` and `👻 BEATEN` marks. Tap to expand: the full map, the stat
  row, the splits table, and DELETE RUN.
- Footer: *Routes are recorded and stored on this device only.*

## 7 · Storage

`data/runLog.js`, key `tm_run_log_v1`, deliberately **separate** from
`tm_cardio_sessions`. That log feeds XP, streaks and the cloud mirror and has to
stay small and boring; a route is kilobytes. The cardio session carries a
`runId` and the two are joined by it, so nothing double-counts.

Route points encode as 4-number tuples `[lat, lng, t, m]` at five decimal places
— about 1.1 m, finer than any phone's fix, and roughly a third the bytes of the
object form.

`tm_run_week_goal_v1` holds the weekly goal.

## 8 · Not built

- **Route discovery** ("find new routes near you") needs a route database and a
  server. Out of scope for a device-local store.
- **Elevation.** `watchPosition` reports altitude, but consumer GPS altitude is
  noisy enough that a gain figure would be fiction without barometric input.
- **Live map tiles by default.** See §2.

---

## Session survival (same pass)

Being in `ACTIVE_SESSION_SCREENS` is what makes a session survive the OS: it is
stashed on the way out and restored on the next launch. Leaving a player out of
it is invisible until the day the phone rings mid-session.

Four holes, all the same shape:

| Screen | Rebuilt from | Was |
|---|---|---|
| `camp_session` | `campCtx` | Not in the set, context not in the snapshot |
| `camp_full` | `campCtx` | Same |
| `cardio_finisher` | `cardioContext` | Same |
| `cardio_mode` (intervals) | its own setup | In the set, but reported no state, so `isSessionScreenLive` was always false and nothing was ever stashed |

Adding the screens alone would not have been enough: each restores into a
router branch whose guard reads a context the snapshot did not carry, so it
would have fallen through to the splash anyway. `campCtx` and `cardioContext`
are now in the snapshot and restored with it.

**Every block now restores its own clock**, not just its screen:

- `FightFocusTimer` (Fight Focus, camp skill blocks, full-camp block 1) — round
  and clock, as before.
- `CampFitRunner` (camp conditioning, full-camp block 2) — phase, round and
  clock. Resuming at or past the boss-reveal round suppresses the slam, because
  replaying a cutscene the athlete has seen is worse than skipping one they
  have not.
- `CampFitSetRunner` (prescribed arcade fit stages) — movement, set, reps, rest
  and the RESOLVED PLAN. A weighted block generates its plan from the review
  screen, so the plan itself rides in the stash; rebuilding it from cfg would
  discard the loads already lifted against it. The integrity unit is reopened
  on restore, since the countdown effect that normally opens it is skipped.
- `CardioProtocolPlayer` (Cardio Mode intervals/Tabata/HIIT, Cardio Finisher) —
  the whole clock is one number. Wall time restarts at zero and the served time
  goes into `offsetSec`, so tapping RESUME folds the hold into `pauseAccumMs`
  and the effective clock continues exactly where it was. A `displayBaseRef`
  adds the served time back to the DISPLAYED total, or the session would appear
  to rewind to 0:00 on resume.

A restored camp session **skips the NEXT UP interstitial and the warm-up** —
both are for a session about to start, not one already underway. A full camp
restores only the block that was interrupted; the next one starts clean.

**A cardio block always reopens held.** Its clock is wall time, and resuming it
silently would bank the seconds the athlete spent away from the phone.

### One bug this uncovered

`goCardioMode` was the only session entry point not clearing `resumeData`,
because Cardio Mode is a setup screen that *becomes* a session. Harmless until
an interval session started restoring from it — then tapping CARDIO MODE fresh
dropped you into yesterday’s Tabata. It now clears it like every other entry.
