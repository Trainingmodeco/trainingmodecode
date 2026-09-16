# Truth audit — what the app sells, what it actually delivers

Written 2026-09-16 against `origin/app` at `6e8a7c1`. Every file and line
number was checked by hand before landing here; treat them as hints — line
numbers drift as the file changes.

The problem is small, concrete and fixable in a day. This document lists every
place the app makes a claim that is not backed by working code, splits them
into what we fix IN THE CODE and what we fix OFF THE WEBSITE (marketing,
support, what we tell people we are selling), and closes with cheap offers we
can actually deliver so the paywall stops being a fiction.

Also included: the QR code failure the monetization research surfaced, and the
paywall placement recommendation the owner accepted.

---

## 1. WHAT WE ACTUALLY GATE (the ground truth)

`data/entitlements.js` enforces exactly three things behind Pro:

- `canAccessStage(n)` — Arcade stages past a preview count
- `canAccessCampLevel(l)` — Training Camp beyond a preview level
- `routineSlotLimit()` — how many Builder routines a free account may save

That is the entire universe of Pro benefits today. `PAYWALL_ENABLED = false`
so nothing is enforced live yet — which is why we have time to fix this now
rather than after a refund.

## 2. WHAT WE CLAIM WE SELL (the four bullets, in four places)

`Paywall.jsx:12-17`:

    All Arcade protocols & boss stages          ← real (matches §1)
    Unlimited Workout Builder & routines        ← real (matches §1)
    Every avatar tier + exclusive skins         ← FAKE — no data model
    Full voice coaching + game-link rewards     ← FAKE — voice is free, no rewards

The same fake claim ships in the two highest-traffic paywall entry points:

- `Profile.jsx:433` — banner:  `"Unlock all protocols, builder & skins"`
- `Profile.jsx:649` — settings row: `"Unlock all protocols, builder & skins."`

And a soft claim with a date:

- `Profile.jsx:651` — `"GAME LINK — Connect your fighter — launches 2026."`

`ManageSubscription.jsx:14-18` is already truthful — it lists Arcade, Camp
levels 4–12 and unlimited routines. That is the model for the other three.

## 3. THE QR CODE FAILURE

`data/qrCode.js` caps at version 5 / EC-L / **108 data bytes**. When the
challenge URL overflows, `qrMatrix()` returns null, `QRCode.jsx:9` returns
null, and the modal shows **an empty box with no explanation**.

Measured against the app's real ids (`martial-monster-protocol`,
`ARC_MARTIALMONSTER_STG10`, origin `https://apptrainingmode.com`):

| Payload                                       | Bytes | Fits 108? |
|-----------------------------------------------|-------|-----------|
| Today, 24-char name (the current `from` cap)  | 141   | no        |
| Today, 10-char name                           | 123   | no        |
| Today, 6-char name                            | 117   | no        |
| Compact stage number, 10-char name            | 103   | **yes**   |

So the QR is already dead for the longer campaigns. Failure is invisible,
which is why nobody has noticed.

## 4. THE PROBLEMS AS A BULLET LIST — FIX IN CODE, or FIX OFF THE WEBSITE

**A. Fix in code — an afternoon**

- Remove the two fake bullets from `Paywall.jsx:14-15`. Replace with the
  ManageSubscription three.
- Rewrite `Profile.jsx:433` from "protocols, builder & skins" to
  "Arcade + Camp + Builder".
- Rewrite `Profile.jsx:649` the same way.
- Remove the date from `Profile.jsx:651` — either the row says
  "IN THE WORKS" (like `GameLink.jsx:10-11` already does) or the row goes.
  A committed 2026 launch with three months left is a promise we do not have
  the code to keep.
- Compact the challenge URL: stage NUMBER in place of stage id, `from` cap
  10 chars, so the QR fits. Spec is in `PROMPT-MONEY-90.md §4b`.
- Give the QR a visible fallback: when `QRCode` returns null, show the code
  and link with "Too long for a QR — send the link instead." An empty box
  is worse than an explanation.
- Move the paywall from a screen to an overlay. Spec in `PROMPT-MONEY-90.md
  §5` — solves three problems at once (losing the user's place, back-button
  edge case, breaking the mini-player).

**B. Fix off the website — no code, marketing decision**

- Decide what Pro is worth. $34.99/yr and $59 lifetime are already
  configured; the plan can survive as-is with the truthful benefit list,
  but the perceived value drops when "skins" comes out. Add one of the
  cheap offers in §5 to hold the price.
- Update the App Store / social copy to match the truthful benefits (search
  for "skins" and "avatar tiers" anywhere off the site, including the
  Instagram bio, any pinned tweet, the beta email templates).
- Write a one-line policy: "we only advertise features that exist today".
  It is the rule that stops this happening again — every new banner gets
  greppable proof of the feature it names.

**C. Won't fix, or fix later**

- Skins as a real feature: cheap art, but no data model, no earned-vs-Pro
  distinction and no player to show them on. Not worth building for launch.
- Game Link rewards: the companion game does not exist. Everything the
  research doc's `PROMPT-GAMELINK-1.md` proposes is future work.
- Voice packs / celebrity coaches: interesting, but a week each to record
  well, and every one adds a maintenance burden.

## 5. WHAT WE CAN OFFER INSTEAD — real value we can deliver this week

Ranked by how much value they add per hour of work. Every one of these uses
something we already ship or something small enough for the owner to build in
an evening.

- **20 custom-built workouts** (owner's suggestion). Delivered as a "COACH'S
  PICKS" section in the Builder — a locked list until they pay. Big
  perceived value, and it plays to the owner's skill rather than the code.
  Ships in a day once the workouts are written; the loader for prebuilt
  routines already exists (`CC_PREBUILT_WORKOUTS`, 69 entries), we just add
  a `pro: true` flag and a filter.
- **Founder badge on the profile**. A small crown or number next to the
  name for the first 100 payers. Costs one image and a check against the
  `foundersCount`. Nobody else has one.
- **Extra ghost slots**. Free accounts keep MY LAST + MY BEST per distance;
  Pro keeps a THIRD slot — MY BEST AT PACE (fastest even splits) or MY
  BEST HILL. Uses the exact `runGhosts.js` storage we already have.
- **Weekly programmed session**. The owner picks one session on Sunday
  night, saves it as a routine, and every Pro account gets it in their
  Builder on Monday. Uses the routines table that already exists. Takes
  fifteen minutes of the owner's time a week, and it makes Pro feel alive.
- **Coach's corner voice pack**. Ten to twenty extra lines recorded by the
  owner — "let's go", "hands up", "breathe" — swapped in during Fight
  Rounds. Voice engine and clip loader already exist; the work is the
  recording, and it is genuinely different from anything free voice can do.
- **Priority reply on beta feedback**. Zero code — the BetaFeedback screen
  already labels submissions; Pro entries go to the top of the owner's
  inbox. A support promise that costs nothing to keep at 100 users and
  disappears naturally at 10,000.

Not on this list because they are premium ideas without proof they matter:
custom TTS voices (a week each, none of them will be as good as a real
recording), leaderboards (need a moderation policy first), and a native
wrapper (real infrastructure work, not a benefit).

## 6. THE ORDER

1. Fix the four claim sites in §2. That is the refund exposure and it is
   the smallest change on this list.
2. Fix the QR in §3. Everybody who shares one of the longer campaigns is
   silently failing today.
3. Decide the offer from §5 you actually want to ship. My suggestion:
   the 20 custom workouts, because they play to the owner's strength and
   the perceived value is highest per hour spent.
4. Then the paywall overlay refactor in `PROMPT-MONEY-90.md §5`.

Everything else in the monetization plan waits until these four are done.
The claim is the only one that can lose money in a way we cannot recover
from — a chargeback for "skins that don't exist" ends payment processing,
not just this cohort.
