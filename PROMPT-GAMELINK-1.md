## PROMPT GAMELINK-1 — link the app and the game: one identity, one fighter, one server that decides

> Run this in the Training Mode revamp codebase (audited on branch
> `claude/fight-mode-improvements-se9gas`; `git diff origin/app HEAD -- components/training-mode/data netlify scripts`
> is empty, so the paths cited here match deployed `app`).
> **Verify first; implement only what is missing. Safe to re-run — every
> migration below uses the repo's existing `if not exists` / `drop policy if
> exists` convention.**
>
> Nothing in here needs the game to exist. Every step is buildable today, and
> steps 1–3 are worth shipping even if the game is never built.
>
> ---
>
> ## 0. The owner's question, answered first
>
> **CAN the app and the game be linked directly? Yes.**
>
> The thing that makes it possible is already shipped and already
> server-authoritative: **Supabase Auth issues a stable `auth.users.id` uuid per
> athlete, and every table in the project is row-scoped to it by RLS on
> `(select auth.uid()) = user_id`.** Both existing tables prove the pattern —
> `progress_snapshots`
> (`supabase/migrations/20260815203207_create_progress_snapshots.sql:41-64`) and
> `entitlements` (`…211807_create_entitlements.sql:38-45`) — and the Stripe
> webhook already writes past RLS with the `service_role` key from a Netlify
> Function (`netlify/functions/stripe-webhook.js:70-78`). A second product
> authenticated as the same user reads the same rows through the same
> auto-generated PostgREST. There is nothing to invent at the identity layer.
>
> **But the game must NOT be given that access as it stands, for two reasons
> found in the code:**
>
> 1. `progress_snapshots` grants the owning user **select AND insert AND update
>    AND delete**. There is no read-only scope. A game signed in as the player
>    could silently overwrite or wipe the athlete's entire training history.
> 2. `progress_snapshots.data` is a flat map of **34 localStorage keys → raw
>    strings** (`data/cloudSync.js:28-45`; `collectSnapshot` stores
>    `localStorage.getItem(k)` verbatim). It is unversioned, unqueryable, and its
>    schemas exist only implicitly inside the JS modules that wrote them. No
>    Godot/Unity/C# client should ever parse it.
>
> So the link is: **the game never touches the app's storage.** It reads one new,
> read-only, versioned projection — `fighter_profiles` — through one small server
> API. The app writes; the server decides; the game reads. That separation is the
> whole architecture.
>
> ### What is already built, and what is missing
>
> | Already real | Where | Missing |
> |---|---|---|
> | A dependency-free fighter engine, 196 lines of pure functions | `game-sync/fighterProfile.js` | Its input. Every stat is driven by per-feature `activeMinutes`, and **no session type except Cardio records any duration at all** |
> | An executable acceptance test | `game-sync/demo.mjs` (runs today, all assertions pass) | Its fixtures are built from `activeMinutes`, so they do not survive the input change — §3 and step 7 rewrite them |
> | A written sync spec | `docs/game-concept/03-APP-TO-GAME-SYNC-SPEC.md` | The three things it specifies (`feature_sessions`, `usage_snapshot`, a `fighter-profile` edge function) do not exist |
> | Session records | `data/userStats.js:64-71` — `{ id, type, completedAt, completedCount, totalCount, xpEarned }` | Duration, discipline, campaign/stage, difficulty, and the integrity verdict are all discarded at session end |
>
> ---
>
> ## 0.1 OWNER DECISIONS REQUIRED BEFORE STEP 4
>
> Everything else in this document is an implementer call. These five are not.
> Do not start the migrations until each has a yes/no.
>
> | # | Decision | Default recommended here | Consequence |
> |---|---|---|---|
> | **D1** | **The feature→stat mapping changes.** `game-sync/fighterProfile.js:8-22` and `03-APP-TO-GAME-SYNC-SPEC.md` call the current mapping "product law, not suggestions." §3.1 changes it, because two of its eight features (`workoutBuilder`, `practiceMode`) are not session types the app writes, and Training Camp — a 12-level flagship — has no home in it at all. | Adopt §3.1's mapping; it preserves the spirit of every original rule and adds one new source (Training Camp → GRIT). | The header comment in `fighterProfile.js` and §1 of the sync spec must be rewritten in the same change, or three documents disagree. |
> | **D2** | **Backfill.** Existing athletes have years of history in localStorage and zero rows in the new ledger. | Yes — one-time import, §4.6. | Without it, the GameLink screen and the server return different fighters for the same person on day one. |
> | **D3** | **Does Pro touch the game?** | **No, in v1.** Omit `entitlement` from the FighterProfile response entirely. | Shipping the field "so the game can gate cosmetics" *is* a promise that Pro buys game content. `Paywall.jsx:12-17` already sells "game-link rewards" that no gate enforces (§8). |
> | **D4** | **Tier threshold fix demotes one band.** §3.9. Exactly one XP band loses a rank: 6,000–6,999 XP, currently Combat Champion, becomes Combat Elite under the authored thresholds — including their avatar portrait. | Fix the thresholds **and** ship the `highestTierId` grandfather in the same release, so nobody is demoted. | Without the grandfather this is a silent rank removal from the app's most emotionally loaded asset. |
> | **D5** | **Season cap on/off.** §3.7 rule 3. | On, with the no-cap floor at stat 60 so beginners are never throttled. | Off means a maxed stat is reachable in roughly 4–5 months of daily training (basis: 20,000 points at ~150 XP/session ≈ 133 sessions). |
>
> ---
>
> ## 1. THE JOIN KEY
>
> **The join key is `auth.users.id` (uuid). It is sound.** It is already the
> primary key of both tables, already the `client_reference_id` sent to Stripe
> (`data/stripe.js:18-25`), and already the only thing `cloudSync` keys on. Use
> it verbatim. Do not mint a parallel "player id."
>
> ### What the game client does to authenticate — and the console problem
>
> The app's sign-in is Google OAuth *only*, and `signInWithGoogle()` hardcodes
> `redirectTo: window.location.origin` with no override parameter
> (`data/authClient.js:53-58`). A console, TV or desktop game client cannot
> complete that flow: there is no browser origin to return to, and nobody wants
> to type a Google password on a gamepad.
>
> Therefore: **the game never performs OAuth.**
>
> | Path | For | How |
> |---|---|---|
> | **A — Device pairing (primary, build this)** | Every platform: console, TV, desktop, mobile, web. | The athlete is already signed in *in the app*. The app shows a short code; the game types it; the server exchanges it for a durable game credential. The game holds no Google session, no Supabase JWT, and never sees a password. |
> | **B — Native PKCE (optional, desktop/Steam only)** | A desktop build with a system browser. | GoTrue is already configured `flowType: 'pkce'` (`authClient.js:33-38`), the correct flow for a native client. Requires (a) a `redirectTo` parameter on `signInWithGoogle()` instead of the hardcoded origin, (b) a loopback (`http://127.0.0.1:<port>/cb`) or custom-scheme redirect added to the Supabase dashboard URL allow-list. **Do not build B first** — it is a convenience and it drags dashboard-only config into the critical path. |
>
> ### The case nobody has handled yet
>
> Onboarding never asks for an email and never offers sign-in
> (`Onboarding.jsx:36-45`), so a large share of athletes have real progress and
> **no account at all**. GameLink must therefore:
>
> - Require sign-in *before* a pairing code can be generated, with honest copy:
>   "Your fighter lives on your account. Sign in once so the game can find it."
> - Push the local snapshot up immediately after that first sign-in. The normal
>   `cloudSync` push path covers this; the `freshDevice` rule (`cloudSync.js:216`)
>   covers the reverse. Verify both directions — a fighter computed from an empty
>   cloud row is the failure mode that makes this feel broken.
> - Run the backfill (§4.6) on that first sign-in, once.
>
> ---
>
> ## 2. THE PAIRING FLOW
>
> ### The code
>
> ```
> Displayed:   H7K4-9PXM
> Stored:      sha256(normalized) hex — the plaintext code is NEVER persisted
> Alphabet:    23456789ABCDEFGHJKMNPQRSTVWXYZ   (30 chars: digits 2-9 plus
>              A-Z minus I, L, O, U — no glyph pairs a person can confuse)
> Length:      8 characters → 30^8 = 656,100,000,000 combinations
> Normalize:   uppercase, strip '-' and whitespace. O / I / L / U are NOT in the
>              alphabet, so a typo'd O is rejected, never silently coerced to 0.
> Lifetime:    10 minutes, or first successful claim, whichever comes first
> Attempts:    5 wrong guesses against one code burns that code
> Live codes:  3 per user (429 `too_many_codes` beyond that)
> IP budget:   20 claim attempts / hour / IP hash
> Global:      600 claim attempts / minute across all IPs (the real ceiling)
> ```
>
> **Say the security margin honestly.** 30^8 is the strength of *one* code, not of
> the system. With N codes live worldwide, a blind guess succeeds with probability
> N / 6.561×10^11. The per-code 5-attempt burn does nothing against an attacker
> who never guesses the same code twice, so the actual defense is the IP budget
> plus the global per-minute ceiling — both of which need shared state, and
> neither of which Netlify Functions provide. Both live in Postgres (§6.1,
> `game_link_attempts`). Expired codes are reaped opportunistically inside
> `game-link-start`; there is no cron in this repo and this does not add one.
>
> The **QR** on the GameLink screen encodes `<PUBLIC_APP_URL>/link?p=H7K49PXM` —
> the same code, nothing more, so a phone camera and a gamepad keyboard are the
> same path. Reuse `shared/QRCode.jsx` and `data/qrCode.js`, which already render
> an inline SVG QR for challenge links.
>
> **Settle the host before any QR is generated.** `data/links.js:1` falls back to
> `https://trainingmode.co`, `EXPO_PUBLIC_APP_URL` is not set in `netlify.toml`
> (its `[build.environment]` holds only `NODE_VERSION` and `NODE_OPTIONS`), and
> the app plus Plausible both live on `apptrainingmode.com`. Set
> `EXPO_PUBLIC_APP_URL` in `netlify.toml` to the canonical host and fix
> `ShareActions.jsx:86`'s hardcoded fallback in the same change. A QR is printed,
> screenshotted and scanned months later — it cannot point at the wrong host.
>
> ### The flow
>
> ```
> APP (signed in)                SERVER                        GAME
>   │ tap LINK MY GAME             │                             │
>   ├─ POST /game-link-start ─────►│ mint code, store sha256,    │
>   │   Bearer <user JWT>          │ expires_at = now()+10min    │
>   │◄──── { code, expires_at } ───┤                             │
>   │ show code + QR + countdown   │                             │
>   │                              │◄── POST /game-link-claim ───┤ types code
>   │                              │    { code, device_name,     │
>   │                              │      platform }             │
>   │                              │ verify hash, not expired,   │
>   │                              │ not claimed, attempts < 5,  │
>   │                              │ IP + global budgets ok      │
>   │                              │ mint link_secret (32 bytes),│
>   │                              │ store sha256 only           │
>   │                              ├── { link_id, link_secret, ──►│ stores secret
>   │                              │     user_id, display_name,  │ in its own
>   │ screen flips to LINKED ◄─────┤     fighter }               │ keystore
> ```
>
> The durable credential is:
>
> ```
> link_secret   tml_<43 chars base64url of 32 random bytes>
> ```
>
> Shown to the game exactly once. The server keeps only `sha256(link_secret)`. The
> game sends it as `Authorization: Bearer tml_…` on every read. The app's GameLink
> screen lists every live link (device name, platform, last seen) with a **REVOKE**
> button — revocation is a single `revoked_at` write and takes effect on the next
> read.
>
> ### Reuse or replace the existing portable tokens? **Replace. Do not reuse.**
>
> The codebase has two precedents and both are disqualified:
>
> - `data/challengeCodes.js` — `TMC1.<url-safe base64 of a pipe record>`, no HMAC,
>   no key, no expiry, no nonce (`:10-13`). Anyone can hand-craft one.
> - `data/ghostBattles.js` — `TMG1.<standard base64 of the whole JSON ghost>`
>   (`:76`), and `importGhostCode`'s entire trust check is `g.verified` being
>   truthy — **a field inside the attacker-supplied payload** (`:83`). A forged
>   ghost wins a battle and pays `VICTORY_XP = 75` (`:14`). That is a live XP
>   exploit today, and it is exactly the failure a game granting real power from a
>   token would inherit at 100× the stakes.
>
> The two formats are also mutually inconsistent (TMC1 strips padding and uses
> `-_`; TMG1 keeps padding and uses `+/`), so a cross-product codec cannot be
> written once.
>
> **The rule this prompt establishes, and it is not negotiable:**
>
> > A portable token may carry **content selection** (which stage to open). A
> > portable token may never carry **entitlement or power**. Anything that grants
> > stats, XP, Pro, or in-game capability is a *reference to server state*, never
> > a *payload the client hands over*.
>
> The pairing code obeys this by carrying **no payload at all** — it is a random
> lookup key with a 10-minute life and a burn budget. There is nothing to forge.
>
> ### Where a signed token is genuinely needed — offline play
>
> If the game must run a match with no network, it caches a server-issued token:
>
> ```
> TMF1.<b64url(payload)>.<b64url(hmac_sha256(key, payload))>
>
> payload = { v:1, kid:"k1", sub:<user_id>, aud:"game", link:<link_id>,
>             iat:<unix>, exp:<iat + 86400>,
>             stats:{…}, derived:{…}, fpv:<fighter version> }
> ```
>
> - HMAC-SHA256 with `GAME_TOKEN_SECRET`, a Netlify env var — the same primitive
>   the Stripe webhook already uses (`crypto.createHmac('sha256', …)`,
>   `stripe-webhook.js:53-62`). Zero new dependencies.
> - **Issued only by the server.** The app and the game may verify; neither may
>   mint.
> - URL-safe base64 on **both** halves, fixing the TMC1/TMG1 split. `TMF1` is the
>   only token in this codebase permitted to carry power.
> - `kid` names the signing key so a rotation can run two keys in overlap instead
>   of invalidating every cached token at once.
> - 24-hour `exp`. **Revocation does not reach a cached token** — a revoked link
>   keeps working offline until the token expires. Say so in the doc, in the
>   offline badge ("OFFLINE — stats as of <date>"), and require the game to check
>   `link` against the server on the first reconnect and at least once every 24
>   hours of play.
>
> ---
>
> ## 3. THE STAT MAPPING (`schemaVersion: 1`)
>
> ### 3.1 The product-law change — OWNER DECISION D1
>
> This is not a rename. `fighterProfile.js:8-22` states the feature→stat mapping
> as product law. Two of its eight features are not things the app records, so the
> mapping cannot be implemented as written. Here is the old mapping, the new one,
> and why each line moved.
>
> | Old (product law) | New | Why |
> |---|---|---|
> | `workoutBuilder` → STRENGTH | `xp('Fit Mode')` → POWER | Builder workouts are written as `type: 'Fit Mode'` (`userStats.js:124`). There is no `workoutBuilder` session type. Same intent, real field. |
> | `cardio` → STAMINA | `xp('Cardio')` → STAMINA | Unchanged. |
> | `quickMission` → ENDURANCE (regen) | `xp('Quick Mission')` → GRIT | Unchanged; the stat is renamed, the source is not. |
> | `fightFocus` → HIT XP | `xp('Fight Focus')` → TECHNIQUE | Unchanged; the stat is renamed. |
> | `comboCoach` → COMBO MASTERY | `xp('Combo Coach')` → SPEED | Unchanged; the stat is renamed. |
> | `practiceMode` → MOVE LIST, 0.25 into combo mastery | `xp('Start Here')` → 0.25 SPEED, **and 0.5 TECHNIQUE** | Practice Mode writes `type: 'Start Here'` (`userStats.js:180`). The 0.25 into SPEED is preserved exactly. The 0.5 into TECHNIQUE is **new** — justified because the stat was renamed from "hit XP" to TECHNIQUE, and learning technique is what Practice Mode is. |
> | `arcade` → SPECIAL MOVES | unchanged | Arcade clears drive `specials`, not a stat. Preserved. |
> | `combatConditioning` → hybrid strength/stamina | unchanged (0.5 POWER, 0.5 STAMINA) | Preserved exactly. |
> | *(nothing)* | `xp('Training Camp')` → 0.5 GRIT, plus 100 per camp level cleared | **New.** The flagship 12-level mode fed no stat under the old law. GRIT (the grind stat) is its natural home. |
> | *(nothing)* | benchmark reps → POWER, cardio minutes → STAMINA, best streak → GRIT | **New.** These are measurements the app already takes that the old mapping, being minutes-only, could not use. |
>
> **Not counted toward any stat, deliberately:** `'Mission of the Day'` (25 XP),
> `'Hybrid Training Bonus'` (40 XP) — both are bonuses paid on top of a session
> that is already counted, so counting them again double-pays. `addComboBonus()`
> (`userStats.js:205-212`) pushes no session row at all and is therefore invisible
> to this pipeline by construction. **Consequence to state in the code comment:
> lifetime `stats.xp` will always exceed the sum of the stat sources. That is
> correct, not a bug.**
>
> ### 3.2 The five stats, and the crosswalk to the engine already built
>
> Rename `fighterProfile.js`'s five stat keys and keep **every** derived-value lerp
> intact:
>
> | Game stat | Engine key it replaces | Drives (unchanged `TUNING` ranges) |
> |---|---|---|
> | **POWER** | `strength` | `strikeDamageMultiplier` 0.7 → 1.8 |
> | **SPEED** | `comboMastery` | `maxComboLength` 3 → 12, `comboDamageMultiplier` 1.0 → 1.6 |
> | **STAMINA** | `stamina` | `staminaPoolSeconds` 12 → 60 |
> | **TECHNIQUE** | `hitXp` | `hitXpMultiplier` 1.0 → 2.5, `strikeRangeBonus` 0 → 0.15 |
> | **GRIT** | `endurance` | `staminaRegenPerSecond` 0.5 → 3.0 |
>
> ### 3.3 The design conflict in the current engine — fix it
>
> `computeStat` is driven by **share of total training minutes**
> (`fighterProfile.js:106-130`). Share is **not monotonic**: an athlete who starts
> running lowers their cardio-free strength share and therefore *loses POWER*.
> That violates the rule that a player never loses power from a bad week, and it
> punishes the exact cross-training the app exists to sell.
>
> **The fix:** stat values are computed only from **monotone lifetime
> accumulators**. `trainingShares()` is **deleted**, not repurposed. Its only
> remaining consumer would have been `isNeglected()`, and `isNeglected()` reads
> `share < 0.06 && activeMinutes < 45` — both inputs are minutes, which no session
> except Cardio records, so with zero minutes every feature is "neglected" and
> every athlete gets every weakness flag on day one. §3.11 replaces the flag rules
> with ones that degrade sanely at zero data.
>
> ### 3.4 Two trust tiers, stated plainly
>
> The previous draft said "only verified sessions convert to game power." That is
> not implementable and it was wrong to state as a rule, because
> `MODE_RULES` (`utils/missionIntegrity.js:15-72`) contains exactly five modes —
> `quickMission`, `combatConditioning`, `fightFocus`, `comboCoach`,
> `trainingArcade` — and `useIntegritySession` is imported by six components
> (`CombatConditioningActive`, `ComboCoachActive`, `CampFitRunner`,
> `CampFitSetRunner`, `FightFocusTimer`, `QuickMissionActive`). **Fit Mode, Cardio
> and Start Here have no integrity session at all.** Applying the rule literally
> would pin POWER, STAMINA and TECHNIQUE at the floor for every athlete.
>
> So the model is two tiers, both converting, both labelled:
>
> | Tier | Modes | What the server can check |
> |---|---|---|
> | **V — validated** | Quick Mission, Combat Conditioning, Fight Focus, Combo Coach, Arcade, Camp fit runners | Clock, duration plausibility, XP arithmetic, replay, daily cap — **plus** the in-session verdict: idle timeout, too-fast units, rapid-action (SUSPICIOUS) flags |
> | **R — recorded** | Fit Mode / Builder, Cardio, Start Here | Clock, duration plausibility, XP arithmetic, replay, daily cap. No in-session verdict, because the mode never built one |
>
> **Why Tier R still converts, at full weight, with no invented discount factor:**
> the app's own integrity gate is itself a clock and an input-cadence limiter, not
> a measurement — `leaderboardEligible = isFullyValid`
> (`missionIntegrity.js:316`), and motion is positive-only and never gates
> (`:297-325`). A server-side clock check on a Tier R claim is therefore not
> materially weaker than a Tier V verdict; what is genuinely missing is the
> idle/rapid-action signal. Applying an arbitrary 0.6 multiplier would be a made-up
> number dressed as security. Instead: report the split
> (`meta.trust.validatedPoints` / `recordedPoints` / `importedPoints` per stat),
> and **empty Tier R out** by adding `MODE_RULES` entries and
> `useIntegritySession` wiring for `fitMode`, `cardio` and `startHere` in
> sequencing step 3d. Until then, `meta.sourceQuality` says `"mixed"`.
>
> ### 3.5 Stat points — the formulas
>
> Every input below is derived from the **server-side ledger** (`feature_sessions`
> plus the backfill import), never from a synced localStorage blob. That
> distinction is the whole point: `tm_arsenal`, `tm_benchmarks`,
> `tm_camp_progress`, `tm_arcade_v2` and `tm_user_stats` are all in `SYNC_KEYS`
> and reach the server only as verbatim client strings. Reading a stat out of
> those would be a larger exploit than the one this document closes — editing
> `tm_arsenal` in devtools would be worth thousands of stat points. So the server
> derives its counters from accepted claims, and the app's local GameLink preview
> (which does read localStorage) is labelled as an estimate for that exact reason.
>
> ```
> xp(T)     = Σ xp_accepted over accepted, non-revoked ledger rows of session type T
>
> POWER     = 1.00·xp('Fit Mode')
>           + 0.50·xp('Combat Conditioning')
>           + 4·benchmarkReps
>
> STAMINA   = 1.00·xp('Cardio')
>           + 0.50·xp('Combat Conditioning')
>           + 8·cardioMinutes
>
> GRIT      = 1.00·xp('Quick Mission')
>           + 0.25·xp('Cardio')
>           + 0.50·xp('Training Camp')
>           + 100·campLevelsCleared
>           + 20·bestStreakDays
>
> TECHNIQUE = 1.00·xp('Fight Focus')
>           + 0.50·xp('Start Here')
>
> SPEED     = 1.00·xp('Combo Coach')
>           + 0.25·xp('Start Here')
> ```
>
> **Counter definitions — each one is a ledger derivation, and each one names the
> app-side bug it fixes:**
>
> | Counter | Ledger derivation | App-side note |
> |---|---|---|
> | `benchmarkReps` | Σ over `{pushUps, squats, sitUps}` of the **max reps ever accepted** for that exercise, across all campaigns | `latestBaseline()` (`data/benchmarkLog.js:72-81`) returns the **most recent** number, not the best — a worse re-test lowers it — and it is keyed per campaign. A new helper `bestBenchmarks()` is needed for the local preview. Using `latestBaseline` would break monotonicity at the point level. |
> | `cardioMinutes` | Σ `round(active_seconds / 60)` over accepted Cardio rows | Cardio already records `completedTimeSeconds` (`data/cardioSessions.js:24`), the only mode that does. |
> | `campLevelsCleared` | count of distinct `camp_level_cleared` values in accepted rows, 0–12 | `tm_camp_progress` is the **cursor**, not a cleared count: it defaults to 1 with nothing cleared (`campProgress.js:6-12`), and `completeCampLevel` never advances past 12, so the L12 clear is recorded separately in `tm_camp_complete` (`:40-47`). For the local preview and the backfill: `max(0, loadCampProgress() - 1) + (isCampComplete() ? 1 : 0)`. Reading the raw cursor would hand a brand-new athlete 100 free GRIT points. |
> | `bestStreakDays` | monotone max run of consecutive **server** day-keys over accepted rows | `getStreak()` returns the *current* streak, which falls, and it keys off local calendar days from a client clock (`userStats.js:284-317`) — moving the device clock forward manufactures streak days. The server derivation is forgery-proof; §6.4 adds a monotone client mirror for the preview only. |
> | `arcadeStagesCleared` / `bossStagesCleared` | distinct `(campaign_id, stage_id)` in accepted rows; a boss clear is a stage whose number equals its campaign's stage count | `tm_arcade_v2` stores only a highest-stage integer per campaign (`arcadeCampaignProgress.js:27-40`), and the only boss-attempt record in the repo is `recordBossAttempt` in the **legacy** `arcadeProgress.js`, which the v2 campaigns never write. These feed `specials`, not a stat. |
>
> **Deliberately excluded, with reasons:**
>
> - `fightStats.strikes` — the same integer mixes accelerometer-thrown strikes
>   with strikes the coach merely *called* (`App.jsx:706` vs `:724-725`). It cannot
>   distinguish a real punch from a played audio cue. Excluded until provenance is
>   split into `strikesThrown` / `strikesCalled`.
> - `fightStats.rounds` — redundant. Fight XP is already `rounds × 20 + 50`, so a
>   per-round term would only re-weight what `xp('Fight Focus')` already carries.
> - Arsenal token count — tokens drive `moveList` (which is product law) and
>   nothing else. `tm_arsenal` is keyed by discipline slug and the same token
>   appears in several (`Jab` is in all four), so a naive sum double-counts, and
>   `getEffectiveArsenal()` unions in `STARTER_ARSENAL` — 4–6 free tokens per
>   discipline (`arsenal.js:99-105`) — which would hand a brand-new athlete
>   hundreds of free points. Use `getArsenal()` (learned only) and a **set union
>   across the four slugs** for the move list.
> - `tm_weight_log` tonnage — capped at 60 entries per exercise
>   (`data/weightLog.js:16-24`), so lifetime tonnage silently truncates. If tonnage
>   is wanted in v2, accumulate it at write time into a monotone counter; never
>   recompute it from the log.
> - `statXp` on `tm_arcade_progress` — 16 authored stat names exist, but
>   `getStatXP` has no callers outside its own file and never aggregates across
>   series (`data/arcadeProgress.js:181-184`). It is write-only dead data. Leave it
>   alone.
>
> ### 3.6 The curve — one shared function, diminishing returns
>
> ```js
> const FLOOR = 15, SPAN = 85, PIVOT = 400, SATURATION = 20000;
> const DENOM = Math.log1p(SATURATION / PIVOT);        // ln(51) = 3.93183
>
> stat = clamp(Math.round(FLOOR + SPAN * Math.log1p(P / PIVOT) / DENOM), 15, 100);
> ```
>
> `FLOOR = 15` and the cap of 100 are taken straight from `TUNING.STAT_FLOOR` /
> `STAT_CAP` — nobody starts unplayable, nobody breaks the ceiling. The curve
> lands exactly on 100 at 20,000 points (verified by evaluation, not by eye).
>
> Marginal value of one more point of training is `SPAN / (DENOM · (PIVOT + P))`:
>
> | Accumulated points | Stat | Marginal stat per point |
> |---|---|---|
> | 0 | 15 | 0.0540 |
> | 100 | 20 | — |
> | 400 | 30 | — |
> | 1,000 | 39 | 0.0154 |
> | 2,807 | 60 | — |
> | 8,000 | 84 | 0.0026 |
> | 20,000 | 100 | 0.0011 |
>
> The 8,000th point is worth about a twenty-first of the first. A grinder cannot
> break the curve; a beginner feels every session.
>
> ### 3.7 The three rules, stated as law
>
> **1. Monotonic.** Stored `stats` are the element-wise `max(previous, computed)`.
> A bad week, a deload, a switch to cardio, or a snapshot restore can never lower
> a number. **The single exception is integrity revocation:** a revoked ledger row
> is dropped, the accumulators are rebuilt from scratch, and the monotone max is
> rebuilt with them. That is the only path down, and it is logged and notified
> (§6.5, §7).
>
> **2. Diminishing returns.** The log curve in §3.6, shared by all five stats, so
> the curve is auditable in one place and a balance change is one constant.
>
> **3. Season cap — OWNER DECISION D5.** Fully specified, one unit, no scheduled
> job:
>
> - A season is **90 days**, anchored per user to `fighter_profiles.created_at`.
>   `season_index = floor((now() - created_at) / 90 days)`. Rollover is evaluated
>   **lazily** on every recompute — there is no cron, no `pg_cron`, no Netlify
>   scheduled function in this repo, and this does not add one.
> - Two values are stored per stat: `stats_uncapped` (the raw curve output, always
>   the monotone max) and `stats` (what is granted and exported).
> - **No cap below 60.** `granted = uncapped` while `uncapped ≤ 60`. Basis: 60 on
>   the curve is 2,807 accumulated points, roughly 19 full Fit Mode sessions — a
>   committed athlete reaches it in a couple of months, and throttling beginners
>   is the wrong thing to optimise.
> - **Above 60: at most +8 per season.**
>   `granted = min(uncapped, max(60, season_start_granted + 8))`, where
>   `season_start_granted` is snapshotted per stat at each rollover.
> - **Nothing is lost, only delayed.** `uncapped` keeps rising; each rollover lets
>   `granted` move up to 8 further toward it. 60 → 100 takes 5 seasons ≈ 450 days
>   of sustained training. That figure is a design target, tunable in one constant.
> - **The cap does not apply to the first computation.** The initial profile —
>   whether from a fresh athlete or the §4.6 backfill — sets `granted = uncapped`
>   and snapshots `season_start_granted` there. Existing athletes are not pinned to
>   their season-1 ceiling on day one, and §3.8's worked example is reachable
>   immediately.
>
> ### 3.8 Worked example — a plausible mixed athlete
>
> Every figure below is producible by the app's actual XP arithmetic (Fit Mode and
> Quick Mission pay `exercises × 15 + 30` on full completion —
> `XP_FIT_FULL_BONUS = 30`, `userStats.js:8`, **not** the 50-point session bonus;
> Fight Focus and Combo Coach pay `rounds × 20 + 50`; Start Here pays exactly 20
> per lesson; Cardio pays `20 + 5 × minutes`).
>
> ```
> Fit Mode            4 sessions × (8 exercises + full bonus) = 4 × 150 =   600
> Combat Conditioning 3 sessions × (6 drills + full bonus)    = 3 × 120 =   360
> Cardio              20 / 25 / 30 min → 120 + 145 + 170      =            435   (75 min)
> Quick Mission       3 sessions × (4 exercises + full bonus) = 3 ×  90 =   270
> Fight Focus         3 sessions × (5 rounds + bonus)         = 3 × 150 =   450
> Combo Coach         1 session  × (5 rounds + bonus)         =            150
> Start Here          5 lessons × 20                          =            100
> Training Camp       engine-computed across 4 sessions       =            600
> Mission of the Day  3 × 25                                  =             75   (excluded)
> Hybrid Bonus        1 × 40                                  =             40   (excluded)
>                                                       total XP = 3,080 · level 7
>
> counters: benchmarkReps 117 (32 push-ups + 45 squats + 40 sit-ups)
>           cardioMinutes 75 · campLevelsCleared 2 · arcadeStagesCleared 7
>           bossStagesCleared 0 · bestStreakDays 11 · currentStreak 4
>           accepted sessions 24 · learned arsenal tokens mapping to 5 moves
> ```
>
> | Stat | Points | Stat value |
> |---|---|---|
> | POWER | 600 + 180 + 468 = **1,248** | **46** |
> | STAMINA | 435 + 180 + 600 = **1,215** | **45** |
> | GRIT | 270 + 108.75 + 300 + 200 + 220 = **1,099** | **44** |
> | TECHNIQUE | 450 + 50 = **500** | **33** |
> | SPEED | 150 + 25 = **175** | **23** |
>
> Derived, through the existing `TUNING` lerps (values as the engine emits them —
> `+lerp(...).toFixed(2)` drops trailing zeros, which is why two of these read as
> one decimal place):
>
> ```
> strikeDamageMultiplier  1.21     (POWER 46)
> staminaPoolSeconds      34       (STAMINA 45)
> staminaRegenPerSecond   1.6      (GRIT 44)
> hitXpMultiplier         1.5      (TECHNIQUE 33)
> strikeRangeBonus        0.05     (TECHNIQUE 33)
> maxComboLength          5        (SPEED 23)
> comboDamageMultiplier   1.14     (SPEED 23)
>
> moveList    8 entries (3 defaults + 5 mapped)  → LIMITED_ARSENAL does NOT fire
>                                                   (it fires at ≤ 4, fighterProfile.js:171)
> specials    slotsUnlocked 2 (7 stages clears 3 and 6, not 10) · ultimate false
> perks       []            ← IN_THE_ZONE reads the CURRENT streak (4), not bestStreakDays
> weaknesses  ['NO_COMBINATIONS']   ← SPEED 23 ≤ 25, and 24 ≥ 10 accepted sessions
> ```
>
> This is the retention hook working correctly: the one weakness names the next
> session to do, and it is true — this athlete has run Combo Coach once.
>
> **Tier for this athlete is `warrior` both before and after the D4 fix** (3,080 XP
> falls in the current 3,000–4,499 warrior band and in the authored 1,500–3,499
> warrior band), so the example is stable across that change.
>
> ### 3.9 Tier and level — and the ladder that contradicts itself
>
> `VISIBLE_TIERS` carries `xp` thresholds 0 / 500 / 1500 / 3500 / 7000
> (`data/tiers.js:12-18`) that are **never read**. `getCurrentTier` picks the tier
> via `tierIndexForLevel(getLevel(xp)) = floor((level-1)/3)` (`:66-68, :87`), i.e.
> one tier every 3 levels = every 1,500 XP. The bands the app actually renders are
> 0 / 1500 / 3000 / 4500 / 6000.
>
> Comparing band by band, **exactly one band demotes** under the fix:
>
> | XP band | Renders today | Authored thresholds | Effect of the fix |
> |---|---|---|---|
> | 0–499 | Rookie | Rookie | none |
> | 500–1,499 | Rookie | Novice | promotion |
> | 1,500–2,999 | Novice | Warrior | promotion |
> | 3,000–3,499 | Warrior | Warrior | none |
> | 3,500–4,499 | Warrior | Elite | promotion |
> | 4,500–5,999 | Elite | Elite | none |
> | **6,000–6,999** | **Champion** | **Elite** | **DEMOTION** |
> | 7,000+ | Champion | Champion | none |
>
> **Ship the grandfather in the same release (D4).** Add `highestTierId` to
> `tm_user_stats` — monotone, populated from the *current* ladder on first load
> after the update — and have every display take the higher of the authored tier
> and `highestTierId`. `tm_user_stats` stores no tier today, so there is nothing to
> grandfather against unless this field lands first.
>
> **Tier cannot be computed server-side as the code stands**, which would break the
> "the client is never the authority" rule. `getCurrentTier` calls
> `fullyClearedSagaCount()` → `getSeriesProgress()` → a direct
> `localStorage.getItem('tm_arcade_progress')` (`arcadeProgress.js:4-10`), and
> imports `TRAINING_ARCADE_SERIES` from a 1,200-line app data module. None of that
> runs in a Netlify Function. So, in sequencing step 1:
>
> - Split `tiers.js` into a pure
>   `tierForStats({ xp, fitXp, fightXp, ccXp, fullyClearedSagas, highestTierId })`
>   with **zero storage imports**, plus a thin app-side wrapper that gathers those
>   values from localStorage.
> - The claim carries `fully_cleared_sagas` as a plain integer; the server calls
>   the same pure function. **One implementation, two callers.**
> - While in that file, fix the mode-XP buckets too: `FIGHT_TYPES` includes
>   `'Practice'`, which `userStats` never writes (Practice Mode writes
>   `'Start Here'`, `PracticeMode.jsx:684`), and four real types — `'Start Here'`,
>   `'Training Camp'`, `'Mission of the Day'`, `'Hybrid Training Bonus'` — fall
>   into no bucket, so a Training-Camp-only athlete can never reach Final Form
>   (`tiers.js:38-39`).
>
> Also fix the contract: `fighterProfile.js:39` types tier as
> `'rookie'|'adept'|'veteran'|'elite'|'champion'`. **`adept` and `veteran` do not
> exist in this app.** The enum is the app's eight ids: `rookie`, `novice`,
> `warrior`, `elite`, `champion`, `peak-physique`, `fight-ascendant`,
> `final-form`.
>
> `level` stays `floor(xp / 500) + 1`, unbounded (`userStats.js:260-262`). The
> game reads `level` and `tier` from the export and never recomputes either.
>
> ### 3.10 Discipline, move list, display name
>
> - **Discipline** is not recorded on any session, even though the content knows it
>   (`protocol/data/disciplines.json`, `module.discipline`, `canonical_map`). v1
>   derives it: `argmax` over per-discipline learned-token counts in `tm_arsenal`
>   (`arsenal.js:11-17`), tie-broken by the most recent `tm_camp_archetype`. If
>   there is nothing to go on, **emit `discipline: null`, not a guess** — and emit
>   `disciplineSource: 'derived' | 'recorded' | 'unknown'` alongside. Telling a Muay
>   Thai athlete their fighter is a boxer, with no hedge, is the kind of small lie
>   this app does not tell. **Every new claim must carry a real `discipline`** —
>   Combo Coach and Fight Focus both know it at runtime — and v2 switches
>   `disciplineSource` to `'recorded'`.
> - **Move list.** `LESSON_TO_MOVE` (`fighterProfile.js:84-91`) expects snake_case
>   lesson ids (`lead_hook`, `teep`, `sprawl`); the app stores display tokens in
>   `tm_arsenal` (`'Low Kick'`, `'Spinning Back Kick'`), and `lessonsCompleted`
>   does not exist anywhere. Write **one** canonical mapping table,
>   `data/moveVocabulary.js`, keyed by the **34 tokens** in `arsenal.js:21-28` and
>   the **36 tokens** in `data/strikeNumbering.js` `WORD_TOKENS` (`:61-68`), and
>   make it the only place the two vocabularies meet. One owner, one table, not a
>   derivation at two call sites.
> - **Display name** comes from `tm_user_profile.name` (`data/userProfile.js:3-18`)
>   — free text the athlete typed, never validated. Cap it at 20 characters, fall
>   back to `'FIGHTER'` when empty (matching `HomeDashboard.jsx:84`), and **do not
>   show it to any other player in v1.** A name shown to strangers needs a
>   moderation policy this product does not have.
>
> ### 3.11 Perks and weaknesses — rewritten, because their inputs do not exist
>
> `GLASS_CANNON`, `MARATHON_ENGINE` and `COMPLETE_ATHLETE` read stat values only
> and survive the rename with their thresholds intact. `IN_THE_ZONE` reads
> `streakDays` — **feed it the CURRENT streak, not `bestStreakDays`**, or the perk
> becomes permanent once earned and therefore meaningless.
>
> `GASSES_OUT`, `PILLOW_FISTS` and `SLOW_RECOVERY` all come from
> `isNeglected(feature, share)` (`fighterProfile.js:132-134`), whose two inputs are
> both minutes-derived. With no minutes recorded, every athlete gets all three on
> day one. Replace the rule:
>
> ```
> A weakness fires only when acceptedSessions >= 10.   ← nobody is told they have
>                                                        four weaknesses before
>                                                        their first workout
> PILLOW_FISTS      POWER      <= 25
> GASSES_OUT        STAMINA    <= 25
> SLOW_RECOVERY     GRIT       <= 25
> NO_COMBINATIONS   SPEED      <= 25     (new — SPEED had no voice)
> TELEGRAPHED       TECHNIQUE  <= 25     (new — TECHNIQUE had no voice)
> LIMITED_ARSENAL   moveList.length <= DEFAULT_MOVES.length + 1   (unchanged, fires at <= 4)
> ```
>
> Two new flags is the cheap half of the fix and it means all five stats can name
> the next session to do. Every flag string is exported so the game's commentary,
> UI and boss reactions have a stable vocabulary.
>
> ---
>
> ## 4. ANTI-CHEAT
>
> ### 4.1 The rule
>
> **The client is never the authority on its own stats.** Today it is: XP is
> computed in the browser, written to localStorage, and mirrored verbatim to the
> cloud — anyone can set `tm_user_stats.xp` to 999999 in devtools and `cloudSync`
> will push it.
>
> ### 4.2 What "accepted" means, precisely
>
> A Tier V claim is accepted at full value when, from `utils/missionIntegrity.js`
> and `shared/sessionOutcome.js`:
>
> - `integrityResult.awardXp === true`, and
> - `validityStatus` is not one of `tooFast`, `suspicious`, `expired`,
>   `idleTimeout` (the four `CHEAT_FLAGS`, `sessionOutcome.js:68-79`), and
> - `outcome !== 'validation_failed'`.
>
> A Tier R claim is accepted when the server checks in §4.3 pass. Both are subject
> to those checks; only Tier V carries the verdict as well.
>
> **On partial runs, the server follows the app, not the integrity module.**
> `missionIntegrity.js:283-291` computes `xpMultiplier = partialCompletionRatio`,
> but `xpForOutcome` (`shared/sessionOutcome.js:149-154`) deliberately does **not**
> apply it: pass and partial both bank the mode's own unit-counted figure, and only
> `fail` (×0.15) and `validation_failed` (×0) read the ruleset. The XP already
> sitting in `tm_user_stats.sessions` was computed under the app's rule, so the
> server must use the app's rule or every historical session disagrees with its own
> recomputation. **Rule: `xp_accepted` uses `xpForOutcome`'s semantics.**
>
> ### 4.3 The server-side checks
>
> The app posts a **session claim**; the server decides. `fighter_profiles` and
> `feature_sessions` have **no client insert/update/delete policy at all** —
> exactly the pattern `entitlements` already uses to stop a client granting itself
> Pro (`…211807_create_entitlements.sql:38-45`, header comment `:1-5`). Only
> `service_role` writes them.
>
> | Check | How | Failure |
> |---|---|---|
> | Time is real | `server_received_at timestamptz default now()`. Reject `completed_at` in the future, or more than 48h in the past. | `reason: 'clock'` |
> | Duration is plausible | Mirror `MODE_RULES` (`missionIntegrity.js:15-72`) server-side for the five modes that have rules; for Tier R modes use the rules added in step 3d. Require `minValidSeconds × units ≤ active_seconds ≤ maxValidSeconds × units`. | `reason: 'implausible_duration'` |
> | XP is arithmetic, not assertion | §4.4. Store `xp_claimed` **and** `xp_accepted`. Only `xp_accepted` feeds stats. | clamped, row still stored |
> | No replay | `unique (user_id, client_session_id)`. Re-posting is a no-op 200 so the offline queue can retry safely. | idempotent |
> | No firehose | Per-day caps: **12 accepted sessions, 180 accepted active minutes.** Basis: `WEEKLY_GOAL = 5` (`userStats.js:3`) ≈ 0.7 sessions/day, so 12 is more than 16× a committed athlete's target — an estimate chosen to be un-hittable by real training and hard-hittable by a script. Over the cap → `accepted: false, reason: 'daily_cap'`, row stored and flagged, never silently dropped. | surfaced in the UI, §6.5 |
> | Integrity travels with the claim | The claim carries `validity_status`, `valid_units`, `total_units`, `partial_ratio`, `effort`, `motion_verified`, `strikes_thrown`. Today none of this is attached to a session row, and `tm_integrity_log` is **not** in `SYNC_KEYS` — the audit trail never leaves the device while the XP it justifies does. | — |
> | Revocation | `revoked_at` on `feature_sessions`. Recompute drops revoked rows and rebuilds the monotone max from scratch. | §3.7 rule 1 |
>
> ### 4.4 Recomputing XP — what is possible and what is not
>
> The XP constants are **module-private** in `data/userStats.js` (only
> `XP_PER_FIT_EXERCISE` is exported). A copied set of constants in a Netlify
> Function is a second, drifting source of truth for the app's economy — the exact
> mistake §6.2 forbids for the fighter engine. **Extract them first.**
>
> Create `components/training-mode/data/xpRules.js`: pure, no localStorage, no
> `window`, no module-scope listeners. It exports the constants
> (`XP_PER_FIT_EXERCISE 15`, `XP_FIT_FULL_BONUS 30`, `XP_PER_FIGHT_ROUND 20`,
> `XP_PER_COMBO_ROUND 20`, `XP_SESSION_BONUS 50`, `XP_START_HERE_LESSON 20`,
> `XP_CARDIO_BASE 20`, `XP_CARDIO_PER_MINUTE 5`, `XP_PER_LEVEL 500`) and one
> `xpForSession({ type, completedCount, totalCount, activeSeconds })`.
> `data/userStats.js` imports it; the function imports it; nobody else defines
> these numbers.
>
> Three types cannot be recomputed from counts, and the doc must say so rather than
> pretend:
>
> - **Fit Mode / Quick Mission / Combat Conditioning** use `XP_FIT_FULL_BONUS = 30`
>   on full completion, **not** the 50-point session bonus. (The previous draft had
>   this wrong; a server using 50 would flag 100% of honest athletes.)
> - **Cardio** is `20 + 5 × round(completedTimeSeconds / 60)`
>   (`userStats.js:214-238`) — recomputable exactly from `active_seconds`.
> - **Training Camp** is engine-computed: `addCampSession(level, roundsCompleted,
>   totalRounds, xpAward)` takes an `xpAward` produced by `calcXp` in
>   `protocol/engine/trainingEngine.ts:325-339` (active minutes × difficulty ×
>   completion × bonuses). Running 375 lines of TypeScript in a Netlify Function is
>   not in scope for v1. **Accept the client's figure, bounded by a ceiling derived
>   from the authored ruleset:** `protocol/data/xp-rules.json` gives
>   `base_xp_per_active_minute 10`, max difficulty multiplier 1.3, and max bonus
>   stack 1 + 0.15 + 0.05 + 0.10 = 1.30 → **16.9 XP per active minute**, so
>   `xp_accepted = min(xp_claimed, ceil(16.9 × active_minutes))`. That is a real
>   number from the shipped ruleset, not a guess.
>
> **A persistent gap between `xp_claimed` and `xp_accepted` is the cheat signal
> worth alerting on** — but only once the three cases above are handled, or the
> alert fires on everyone.
>
> ### 4.5 Say the limit out loud
>
> This closes the "edit localStorage to 999999" hole completely, because no stat
> reads a synced localStorage value. It does **not** close the "leave the phone on
> the table and tap DONE on schedule" hole, because the app's integrity system is a
> clock and an input-cadence limiter, not a measurement
> (`leaderboardEligible = isFullyValid`, `missionIntegrity.js:316`; motion is
> positive-only and never gates, `:297-325`, and the module says so in its own
> comment). Design accordingly:
>
> - App training → **single-player game power**: fine at this trust level.
> - App training → **leaderboards, PvP, tournaments, anything with a prize**: needs
>   a stronger signal (camera pose, wearable HR) that does not exist yet. **Do not
>   ship a competitive surface on a clock.**
>
> ### 4.6 Backfill — OWNER DECISION D2
>
> Without this, every existing athlete's server fighter is FLOOR 15 across all five
> stats while the GameLink screen shows the local numbers, and the two never agree.
> The `completed_at`-within-48h check and the 12/day cap make a normal replay
> impossible by design, so the import is a separate code path:
>
> ```
> POST /.netlify/functions/fighter-bootstrap
>   auth: Authorization: Bearer <supabase user JWT>
>   body: { sessions: [...tm_user_stats.sessions],
>           benchmarks, campProgress, campComplete, arcadeV2, arsenal,
>           cardioSessions, fullyClearedSagas }
>   200 → { imported: 412, skipped: 0, fighter_version: 1 }
>   409 → { error: 'already_bootstrapped' }
> ```
>
> Rules, all of them:
>
> - **Runs once per user, ever.** `fighter_profiles.bootstrapped_at` is the guard.
> - Exempt from the 48h clock check and the daily caps. Subject to the replay check
>   (`client_session_id` unique), so a retry imports nothing twice.
> - Every row is written with `source: 'backfill'`, `trust: 'imported'`,
>   `validity_status: 'backfilled'`, `motion_verified: false`,
>   `server_received_at: now()`, and `xp_accepted = xp_claimed`. Pre-existing XP is
>   already banked and displayed; revoking it retroactively is not on the table.
> - Counters are imported as one-off baselines (`benchmarkReps` from
>   `bestBenchmarks()`, `campLevelsCleared` per §3.5, `bestStreakDays` from the
>   local history, arcade clears from `tm_arcade_v2`), each flagged as imported.
> - The imported points are reported separately in `meta.trust.importedPoints`, and
>   the GameLink provenance line says so in plain words (§6.5, §8).
> - **Cap the import at 2,000 session rows** (the largest plausible history: 5
>   sessions/week × 5 years ≈ 1,300) and reject anything larger as `reason:
>   'implausible_history'` — a hand-edited snapshot is the obvious attack here, and
>   it is the one moment the server accepts client XP wholesale.
>
> ---
>
> ## 5. THE API
>
> **Where it lives: Netlify Functions.** The repo already sets
> `functions = "netlify/functions"` in `netlify.toml`, and
> `netlify/functions/stripe-webhook.js` already has a checked service-role REST
> helper and zero-dependency HMAC. `supabase/config.toml` records that a second
> Deno copy of the webhook was **deliberately deleted** "so two implementations can
> never both grant Pro" — reintroducing Edge Functions recreates exactly that
> split. `docs/game-concept/03-APP-TO-GAME-SYNC-SPEC.md:107-127` specifies a
> Supabase edge function; **this overrides that, and step 10 updates the spec so
> the repo does not carry two conflicting designs.**
>
> Six endpoints. That is the whole surface.
>
> ```
> POST /.netlify/functions/game-link-start
>   auth: Authorization: Bearer <supabase user JWT>
>   200 → { code: "H7K4-9PXM", expires_at: "…Z", ttl_seconds: 600 }
>   429 → { error: "too_many_codes", live: 3 }
>
> POST /.netlify/functions/game-link-claim
>   auth: none (the game has no identity yet)
>   body: { code, device_name, platform }
>   200 → { link_id, link_secret: "tml_…", user_id, display_name,
>           fighter: <FighterProfile> }
>   404 → { error: "invalid_or_expired" }   ← IDENTICAL body for wrong, expired
>   429 → { error: "rate_limited" }            and already-claimed. Never leak which.
>
> GET  /.netlify/functions/fighter-profile
>   auth: Authorization: Bearer tml_…         (game)
>      or Authorization: Bearer <user JWT>    (the app's own preview)
>   headers: If-None-Match: "<version>"
>   200 → FighterProfile        304 → not modified
>   401 → { error: "revoked" }
>   404 → { error: "no_profile" }             ← paired but never claimed a session
>
> POST /.netlify/functions/session-claim
>   auth: Authorization: Bearer <supabase user JWT>   ← app only, never the game
>   body: one SessionClaim (§6.3)
>   200 → { accepted, feature_session_id, xp_claimed, xp_accepted,
>           fighter_version, stat_deltas, reason? }
>   503 → { error: "claims_paused" }          ← the kill switch, §9
>
> POST /.netlify/functions/fighter-bootstrap      (§4.6)
>
> POST /.netlify/functions/game-link-revoke
>   auth: Authorization: Bearer <user JWT>
>   body: { link_id }        200 → { revoked: true }
> ```
>
> **When the fighter is recomputed.** Inside `session-claim`, after the ledger row
> commits, in the same request. The ledger write and the recompute are separate
> statements: **if the recompute fails, the ledger row stays and the response
> returns `fighter_version` unchanged with `recompute: 'deferred'`.** The next
> successful claim, or any `GET /fighter-profile`, recomputes from the ledger, which
> is the source of truth. A user who has paired but never claimed a session has no
> `fighter_profiles` row — `GET` returns 404 `no_profile`, and the game shows its
> own "train something first" state rather than a floor-15 fighter.
>
> **Updates: poll, do not webhook.** A game client has no public URL to receive a
> webhook. The game calls `GET /fighter-profile` with `If-None-Match` on launch, on
> returning to the menu, and after every match — a 304 costs almost nothing. The
> monotone `version` integer is the ETag. (Supabase Realtime on `fighter_profiles`
> is a later upgrade and only works for a client holding a user JWT, i.e. path B —
> note it, do not build it.)
>
> **Response shape** — `game-sync/fighterProfile.js`'s return value plus the
> envelope:
>
> ```json
> {
>   "schemaVersion": 1,
>   "version": 47,
>   "computedAt": "2026-09-14T18:22:10.441Z",
>   "userId": "b3f1…",
>   "displayName": "MARCUS",
>   "level": 7,
>   "tier": "warrior",
>   "discipline": "boxing",
>   "disciplineSource": "derived",
>   "stats": { "power": 46, "speed": 23, "stamina": 45, "technique": 33, "grit": 44 },
>   "derived": {
>     "strikeDamageMultiplier": 1.21, "staminaPoolSeconds": 34,
>     "staminaRegenPerSecond": 1.6, "hitXpMultiplier": 1.5,
>     "strikeRangeBonus": 0.05, "maxComboLength": 5,
>     "comboDamageMultiplier": 1.14
>   },
>   "moveList": ["jab","cross","shove","lead_hook","rear_uppercut","low_kick","teep","slip_counter"],
>   "specials": { "slotsUnlocked": 2, "ultimateUnlocked": false },
>   "perks": [],
>   "weaknesses": ["NO_COMBINATIONS"],
>   "meta": {
>     "acceptedSessions": 24,
>     "sourceQuality": "mixed",
>     "trust": { "validatedPoints": 1380, "recordedPoints": 1235, "importedPoints": 1622 },
>     "season": { "index": 0, "capApplies": false },
>     "statsUncapped": { "power": 46, "speed": 23, "stamina": 45, "technique": 33, "grit": 44 }
>   }
> }
> ```
>
> - `sourceQuality`: `"imported"` (backfill only), `"mixed"` (some Tier R), or
>   `"measured"` (every contributing session carried a real duration and a validity
>   verdict). The game reads it and can say so.
> - **`entitlement` is deliberately absent — OWNER DECISION D3.** Shipping it "so
>   the game can gate cosmetics" is the promise that Pro buys game content. If D3
>   comes back yes, the function must select an **explicit column list** from
>   `entitlements`: that table's RLS policy is row-scoped but **not** column-scoped
>   (`…211807:42-45`), so a lazy `select *` would echo `stripe_customer_id` and
>   `stripe_subscription_id` into a response the game client can read.
>
> ---
>
> ## 6. WHAT TO BUILD IN THE APP NOW (no game required)
>
> ### 6.1 Migrations
>
> Match the repo's conventions exactly — `create table if not exists`,
> `drop policy if exists` before every `create policy`, `drop trigger if exists`
> before every `create trigger`, and reuse the existing
> `public.tm_touch_updated_at()`.
>
> `supabase/migrations/2026…_create_fighter_profiles.sql`:
>
> ```sql
> create table if not exists public.fighter_profiles (
>   user_id             uuid primary key references auth.users (id) on delete cascade,
>   schema_version      int    not null default 1,
>   version             bigint not null default 1,            -- monotone; the ETag
>   profile             jsonb  not null default '{}'::jsonb,  -- the full response body
>   stats               jsonb  not null default '{}'::jsonb,  -- granted (monotone max)
>   stats_uncapped      jsonb  not null default '{}'::jsonb,  -- raw curve output
>   season_index        int    not null default 0,
>   season_start_stats  jsonb  not null default '{}'::jsonb,  -- per-stat baseline at rollover
>   level               int,
>   tier                text,
>   discipline          text,
>   bootstrapped_at     timestamptz,
>   computed_at         timestamptz not null default now(),
>   updated_at          timestamptz not null default now(),
>   created_at          timestamptz not null default now()
> );
> alter table public.fighter_profiles enable row level security;
> drop policy if exists "fighter_profiles_select_own" on public.fighter_profiles;
> create policy "fighter_profiles_select_own"
>   on public.fighter_profiles for select to authenticated
>   using ((select auth.uid()) = user_id);
> -- NO insert / update / delete policy. service_role only, same as entitlements.
> drop trigger if exists fighter_profiles_touch on public.fighter_profiles;
> create trigger fighter_profiles_touch before insert or update
>   on public.fighter_profiles for each row
>   execute function public.tm_touch_updated_at();
> ```
>
> `feature_sessions` — the append-only ledger everything rests on:
>
> ```sql
> create table if not exists public.feature_sessions (
>   id                 uuid primary key default gen_random_uuid(),
>   user_id            uuid not null references auth.users (id) on delete cascade,
>   client_session_id  text not null,                 -- userStats makeId()
>   feature            text not null check (feature in (
>                        'workoutBuilder','quickMission','cardio','combatConditioning',
>                        'fightFocus','comboCoach','startHere','arcade','trainingCamp')),
>   session_type       text not null,                 -- the app's own `type` string
>   trust              text not null default 'validated'
>                        check (trust in ('validated','recorded','imported')),
>   discipline         text, campaign_id text, stage_id text, difficulty text,
>   camp_level_cleared int,
>   benchmark          jsonb,                         -- { exercise, reps } when tested
>   lesson_tokens      text[],                        -- arsenal tokens a lesson taught
>   started_at         timestamptz, completed_at timestamptz not null,
>   server_received_at timestamptz not null default now(),
>   active_seconds     int not null default 0,
>   completed_count    int not null default 0, total_count int not null default 0,
>   xp_claimed         int not null default 0, xp_accepted int not null default 0,
>   accepted           boolean not null default true,
>   reject_reason      text,
>   outcome            text check (outcome in ('pass','partial','fail','validation_failed')),
>   validity_status    text, valid_units int, total_units int, partial_ratio numeric,
>   effort             text, motion_verified boolean not null default false,
>   strikes_thrown     int not null default 0,
>   metadata           jsonb not null default '{}'::jsonb,
>   revoked_at         timestamptz,
>   unique (user_id, client_session_id)
> );
> create index if not exists feature_sessions_user_completed
>   on public.feature_sessions (user_id, completed_at desc);
> alter table public.feature_sessions enable row level security;
> drop policy if exists "feature_sessions_select_own" on public.feature_sessions;
> create policy "feature_sessions_select_own"
>   on public.feature_sessions for select to authenticated
>   using ((select auth.uid()) = user_id);
> -- NO client write policy.
> ```
>
> **The session type ↔ feature crosswalk is a table, owned in one place**
> (`data/moveVocabulary.js`'s sibling, `data/featureMap.js`), not free text at each
> call site:
>
> | App `type` (10 values) | `feature` | Stat sources |
> |---|---|---|
> | `Fit Mode` | `workoutBuilder` | POWER 1.0 |
> | `Quick Mission` | `quickMission` | GRIT 1.0 |
> | `Cardio` | `cardio` | STAMINA 1.0, GRIT 0.25 |
> | `Combat Conditioning` | `combatConditioning` | POWER 0.5, STAMINA 0.5 |
> | `Fight Focus` | `fightFocus` | TECHNIQUE 1.0 |
> | `Combo Coach` | `comboCoach` | SPEED 1.0 |
> | `Start Here` | `startHere` | TECHNIQUE 0.5, SPEED 0.25 |
> | `Training Camp` | `trainingCamp` | GRIT 0.5 + level clears |
> | `Mission of the Day` | `quickMission` (bonus) | none — excluded, §3.1 |
> | `Hybrid Training Bonus` | `workoutBuilder` (bonus) | none — excluded, §3.1 |
>
> Note the divergence from `03-APP-TO-GAME-SYNC-SPEC.md`, which lists eight
> snake_case values and no `trainingCamp` or `startHere`. Step 10 updates that spec
> rather than leaving two enums in the repo.
>
> Plus two more tables:
>
> ```sql
> create table if not exists public.game_links (
>   id           uuid primary key default gen_random_uuid(),
>   user_id      uuid not null references auth.users (id) on delete cascade,
>   code_hash    text unique,            -- sha256 of the normalized pairing code
>   secret_hash  text,                   -- sha256 of the tml_ secret
>   device_name  text, platform text,
>   attempts     int not null default 0,
>   expires_at   timestamptz not null,
>   claimed_at   timestamptz, last_seen_at timestamptz, revoked_at timestamptz,
>   created_at   timestamptz not null default now()
> );
> create index if not exists game_links_user_live
>   on public.game_links (user_id) where revoked_at is null;
> alter table public.game_links enable row level security;
> drop policy if exists "game_links_select_own" on public.game_links;
> create policy "game_links_select_own" on public.game_links
>   for select to authenticated using ((select auth.uid()) = user_id);
> -- NO client write policy. code_hash / secret_hash are never returned by the API.
>
> create table if not exists public.game_link_attempts (
>   bucket       text not null,           -- 'ip:<sha256(ip)>' or 'global'
>   window_start timestamptz not null,
>   attempts     int not null default 0,
>   primary key (bucket, window_start)
> );
> alter table public.game_link_attempts enable row level security;
> -- NO policy at all: service_role only.
> ```
>
> The `3 live codes / user` limit is a `count(*) where user_id = ? and claimed_at
> is null and revoked_at is null and expires_at > now()` before insert. The IP and
> global budgets are upserts into `game_link_attempts`. `game-link-start`
> opportunistically deletes `game_links where claimed_at is null and expires_at <
> now() - interval '1 day'` — that is the reaper, and it needs no scheduler.
>
> ### 6.2 The engine is one file, vendored once
>
> `game-sync/fighterProfile.js` stays the **single canonical** implementation,
> imported by the app bundle and by `netlify/functions/fighter-profile.mjs` alike.
> **Do not copy it.** The in-repo cautionary tale is `protocol-src/` vs
> `components/training-mode/protocol/`, which have already drifted —
> `reaction-mode.json` exists only in one, `workout-modules.json` only in the
> other, and even the engine filename differs.
>
> **Packaging landmine, verify before building on it.** `package.json` has no
> `"type": "module"`, `game-sync/fighterProfile.js` uses ESM `export`, and
> `node game-sync/demo.mjs` only works today because Node reparses it as ESM on a
> syntax-detection heuristic (it emits `MODULE_TYPELESS_PACKAGE_JSON`). The one
> existing function, `netlify/functions/stripe-webhook.js`, is CommonJS
> (`require('crypto')`, `exports.handler`). So:
>
> - Rename to `game-sync/fighterProfile.mjs` and update `demo.mjs`'s import. **Do
>   not** add `"type": "module"` to `package.json` — that would break the Stripe
>   webhook, which is the one piece of server code that must never break.
> - Import it from the Expo bundle by relative path
>   (`../../../game-sync/fighterProfile.mjs` from
>   `components/training-mode/data/`) and confirm Metro resolves a repo-root path in
>   a real `npm run build:web` before anything depends on it. Nothing in the app
>   imports `game-sync/` today; this resolution is untested.
> - Add a guard to the existing prebuild chain — `scripts/check-fighter-engine.mjs`,
>   invoked from `build:web` alongside `check-public-assets.mjs` and
>   `lock-assets.mjs` — that fails the build if a second definition of
>   `computeFighterProfile` appears anywhere. There is no CI in this repo (no
>   `.github/`, no workflows); the build command is the only enforcement point that
>   exists.
>
> ### 6.3 The write path
>
> There is no DB trigger here — a trigger cannot validate a session it never saw.
> The write is a claim posted from the app.
>
> **Hang the claim off `data/userStats.js`, not off the analytics helper.** The
> nine `trackEvent('session_complete', …)` call sites (`App.jsx:452, 553, 617, 651,
> 681, 699, 716, 735, 763`) cover only seven modes. **Four session types never fire
> that event at all:**
>
> | Writer | Type | Why it matters |
> |---|---|---|
> | `data/cardioSessions.js:85` → `addCardioSession` | `Cardio` | **the primary STAMINA source** |
> | `PracticeMode.jsx:684` → `addStartHereLesson` | `Start Here` | **a TECHNIQUE and SPEED source** |
> | `App.jsx:100` → `addDailyMissionBonus` | `Mission of the Day` | excluded from stats, still needs a ledger row for the day-key streak |
> | `App.jsx:786` → `addHybridTrainingBonus` | `Hybrid Training Bonus` | same |
>
> Wiring the claim only into a `session_complete` helper produces a fighter whose
> STAMINA and TECHNIQUE never move. So:
>
> - **Every `add*Session` function in `userStats.js` must return
>   `{ id, xpEarned }`**, not the bare number it returns today. `makeId()`
>   (`userStats.js:55-57`) is module-private and no writer returns it, so
>   `client_session_id` is otherwise unobtainable and the replay key cannot be
>   populated. Every existing call site reads the bare number and must be updated in
>   the same change.
> - Add `data/sessionClaim.js` exporting `claimSession(claim)`, called from one
>   shared helper that every `add*Session` path goes through — all thirteen writers,
>   including the two in `ArcadeSessionPlayer.jsx:314` and
>   `ArcadeBenchmarkPlayer.jsx:427`.
> - Separately, collapse the nine `session_complete` call sites into one helper so
>   analytics and the ledger cannot drift. Worth doing; not the same set.
> - **Carry the fields the app currently throws away**: `active_seconds` (real
>   elapsed working time — the field the entire stat engine wants and the one thing
>   almost nothing records), `discipline`, `campaign_id` / `stage_id` (Arcade
>   sessions currently launder themselves into generic `'Fit Mode'` / `'Fight
>   Focus'` rows, `ArcadeSessionPlayer.jsx:314`), `difficulty`,
>   `camp_level_cleared`, `benchmark`, `lesson_tokens`, and the whole integrity
>   result.
> - **Where `active_seconds` comes from, per mode** — this is the real work in step
>   3c, and there is no single answer:
>
>   | Mode | Source |
>   |---|---|
>   | Quick Mission, Combat Conditioning, Fight Focus, Combo Coach, Arcade, Camp fit runners | already tracked inside `IntegritySession` — sum of unit `activeElapsedSeconds` |
>   | Cardio | `completedTimeSeconds`, already recorded |
>   | Fit Mode / Builder guided player | **no timer exists** — add one |
>   | Start Here | **no timer exists** — add one |
>   Until a mode has a real number it sends `active_seconds: 0` and the server
>   skips the duration check for that row, flags it `trust: 'recorded'`, and the
>   profile reports `sourceQuality: "mixed"`. No invented durations, ever.
> - **Queue and retry.** Failures go to `tm_claim_queue` in localStorage and flush
>   on `online`, on `visibilitychange`, and on a 5-minute interval — mirror
>   `startCloudSync`'s trigger set (`cloudSync.js:253-300`). The unique
>   `client_session_id` makes every retry idempotent. **Each queued claim carries its
>   own `claimVersion`;** a v1 claim flushed after a v2 deploy is accepted with the
>   fields it has, never reshaped by guesswork.
> - `tm_claim_queue` is **not** added to `SYNC_KEYS` — it is device-local outbound
>   state, like the paused-session snapshot.
>
> ### 6.4 Four small app-side additions
>
> - `tm_user_stats.schemaVersion` — it has none, which makes any future migration of
>   a 34-key opaque snapshot guesswork.
> - `tm_user_stats.bestStreakDays` — `max(bestStreakDays, getStreak(stats))` updated
>   on every session save. This is the **local preview's** streak input only; the
>   server derives its own from server day-keys (§3.5).
> - `tm_user_stats.highestTierId` — the D4 grandfather (§3.9).
> - `data/benchmarkLog.js`: add `bestBenchmarks()` returning the max reps ever
>   recorded per exercise across all campaigns. `latestBaseline()` stays as-is for
>   the One Punch scaling it was written for.
>
> ### 6.5 GameLink screen: waitlist → **YOUR FIGHTER**
>
> `GameLink.jsx` today is 100% copy: three benefit strings, a `🚧 IN THE WORKS`
> banner, a `warrior-{sex}.png` → 🎮 placeholder graphic, a
> `GAME LAUNCHES 2026 · RESERVE YOUR FIGHTER EARLY` footer, and a button whose
> entire behaviour is `setNotified(true)`. Replace the body with a real preview,
> computed locally from the canonical engine so it works offline and before any
> server exists.
>
> 1. **YOUR FIGHTER** header, the athlete's tier portrait
>    (`/static/tiers/${tierId}-${sex}.png`, `tiers.js:91-94`), name, level, tier
>    label, discipline (or "not set yet" when `disciplineSource === 'unknown'`).
> 2. **Five stat bars** — POWER / SPEED / STAMINA / TECHNIQUE / GRIT, gold `#fde047`
>    fill on a violet track, value 15–100, Orbitron numerals. Reuse the
>    `ArcadeUI.jsx` tokens; no new design system.
> 3. **What it means** — the derived line in plain language: "Your strikes hit
>    1.21×. You chain up to 5. You have 34 seconds of all-out output."
> 4. **Perks and weaknesses** as chips, each with its honest one-liner
>    ("NO COMBINATIONS — you've run Combo Coach once. Run it again to chain longer
>    strings."). This is the retention hook: the weakness *names the next session to
>    do*.
> 5. **Provenance line, always visible, and it must not say "verified" before
>    anything has been verified.** Exact copy by state:
>    - Pre-server: *"Estimated from 24 recorded sessions on this device. Not yet
>      saved to your account."*
>    - After bootstrap: *"412 sessions imported from your history, 24 checked on the
>      server since."*
>    - Steady state: *"Computed from 436 sessions · updated 2 hours ago."*
> 6. **Why a stat did not move.** When the last claim came back
>    `accepted: false, reason: 'daily_cap'`, show it: *"Daily cap reached — this
>    session still counts toward your XP, but it'll count toward your fighter
>    tomorrow."* When `xp_accepted < xp_claimed`, show both numbers and the reason.
>    An athlete who trains and sees nothing move, with no explanation, is the worst
>    outcome this design can produce.
> 7. **Revocation notice.** If a recompute lowered a stat (the only path down,
>    §3.7), say so once, with what and why. Never silently.
> 8. **LINK A DEVICE** panel — pairing code + QR + countdown + live links list with
>    REVOKE, plus **SIGN OUT EVERYWHERE** (revokes every link at once). Rendered
>    **disabled** with the reason ("The game isn't released yet. Your fighter is
>    saved and ready.") until a `GAME_LINK_ENABLED` flag flips — read through a
>    helper, never the raw constant, exactly the way `paywallActive()` wraps
>    `PAYWALL_ENABLED` (`data/entitlements.js:27, :59-61`).
> 9. **Inbound `?p=` handler in `App.jsx`**, next to the existing `?ch=` reader
>    (`App.jsx:390`): resolve the code, de-dupe via `sessionStorage`
>    (`tm_pair_seen`, mirroring `tm_challenge_seen`), strip the param from the URL,
>    and route to GameLink. **Signed out, it routes to the sign-in prompt and keeps
>    the code** — it never silently drops it.
>
> ### 6.6 Environments, migrations, and a test harness
>
> Twelve of the VERIFY steps below deliberately forge claims, exceed caps and set
> `revoked_at`. None of that may touch the project that holds the live
> `entitlements` table the Stripe webhook writes to. Before sequencing step 4:
>
> - **Staging.** Stand up a second Supabase project (or a Supabase branch) and put
>   its URL and publishable key behind the `EXPO_PUBLIC_SUPABASE_URL` /
>   `EXPO_PUBLIC_SUPABASE_ANON_KEY` env vars that `data/authClient.js:15-16` already
>   honours — today both fall back to the production project ref hardcoded in the
>   shipped bundle. Point a Netlify deploy preview at it.
> - **Migrations.** There is no Supabase CLI in `package.json` and no mechanism in
>   the repo for applying the three `.sql` files that already exist. Add
>   `supabase` as a devDependency and a `db:push` script, or commit to applying each
>   file through the dashboard SQL editor with the file checked in first. Either is
>   fine; leaving it undefined is not.
> - **Tests.** Add `"test": "node --test"` and a `game-sync/*.test.mjs` covering the
>   curve, the monotone-max store, the season cap and the XP recompute. `demo.mjs`
>   is currently the only executable check in the entire repo.
>
> ---
>
> ## 7. PRIVACY, RETENTION AND ACCOUNT LIFECYCLE
>
> `feature_sessions` is a detailed per-session behavioural log — timestamps,
> durations, integrity verdicts, strike counts, motion flags — leaving the device
> in a structured, queryable form for the first time. Today only an opaque
> localStorage mirror syncs. That is a real change in what this product holds about
> a person, and it ships with its own rules or it does not ship.
>
> - **Consent.** The bootstrap (§4.6) is the moment to ask, once, in plain words:
>   what is stored, why (to build your fighter), and that it can be deleted. It is
>   not buried in a settings toggle and it is not opt-out.
> - **Retention.** Keep raw `feature_sessions` rows for **24 months**. Beyond that,
>   roll them into per-month aggregates and delete the raw rows — the accumulators
>   are sums, so the stats are unaffected. Basis: two years is long enough to
>   rebuild any fighter and short enough that the log does not become a permanent
>   behavioural archive.
> - **Export and purge.** The athlete can export their ledger as JSON and can delete
>   it. Deleting the ledger resets the fighter to floor; say so before confirming.
>   This is a user-facing button, not a support ticket.
> - **Privacy policy.** It must name `feature_sessions` and the pairing credential
>   before either ships. This document does not authorise shipping without that.
> - **Account deletion** cascades through `on delete cascade` on all three new
>   tables. Verify it, do not assume it.
> - **Sign-out does not revoke links** — they are account-bound, not device-bound,
>   which is what makes a console pairing survive the athlete closing the app. The
>   SIGN OUT EVERYWHERE button (§6.5.8) is how a shared console gets cleaned up, and
>   it must be visible, not buried.
> - **Two athletes, one console.** A game device holds one `link_secret` at a time.
>   Claiming a new code on the same device does not revoke the old link — both stay
>   live until revoked, and the app's device list shows both. The game decides which
>   it holds.
>
> ---
>
> ## 8. HONESTY GUARDRAILS
>
> The standard is already set elsewhere in this codebase: `ManageSubscription`'s
> PERKS list tells the truth where `Paywall.jsx:12-17` does not. GameLink must meet
> the same bar.
>
> **What the screen MAY claim:**
>
> - That the fighter profile is real, computed from the athlete's own sessions, and
>   saved to their account.
> - Exactly which app features feed which stat — that is now true and checkable
>   against §3.5.
> - That the game is in development, with no date.
>
> **What it MAY NOT claim, and must stop claiming today:**
>
> | Remove | Why |
> |---|---|
> | `🎮 GAME LAUNCHES 2026 · RESERVE YOUR FIGHTER EARLY` (`GameLink.jsx:67`) | A release commitment nobody can keep. There is no game project in the repo at all — `game-sync/` is a stat engine and `game-ui-kit/` is static HTML mockups. Step 2 of the owner's own 6-step plan ("boxes punching boxes", `docs/game-concept/04`) has not started. |
> | `🏆 Exclusive skins from training streaks` (`:11`) | There is no skins data model anywhere in the repo. |
> | `🔔 NOTIFY ME AT LAUNCH` → `✓ YOU'RE ON THE LIST` (`:68`) | **Verified: the button's entire implementation is `setNotified(true)`.** Nothing is stored, nothing is sent, there is no list. Either write the signal to a real table or delete the button. Telling someone they are on a list that does not exist is the one thing this app does not do. |
> | `Unlocked avatar tiers appear in-game` (`:10`) | Keep, but as "will", not "does" — and only because `tier` is now genuinely in the exported contract (§5). |
> | The word **"verified"** anywhere on the screen before a server has verified anything | §6.5.5. "Recorded on this device" is the honest word pre-server. |
> | `Full voice coaching + game-link rewards` in `Paywall.jsx:12-17` | No gate enforces it. Flipping `PAYWALL_ENABLED` with that copy sells a feature that is not withheld. Match `ManageSubscription`'s honest PERKS list (`:14-18`). |
>
> **Replacement footer copy:**
>
> > Your fighter is being built right now, by your training. The game is in
> > development — no date yet. When it ships, this screen is where you link it.
>
> ---
>
> ## 9. OPS, COST AND KILL SWITCHES
>
> - **Poll volume.** The game reads `GET /fighter-profile` on launch, on menu
>   return, and after every match. Estimate, clearly labelled as one: a 45-minute
>   play session ≈ 12 reads, of which ~11 return 304. At 10,000 daily players that
>   is ~120k invocations/day, and Netlify's free tier is 125k/month — so this needs
>   a paid plan the moment the game has any real audience, and the 304 path must be
>   cheap (read `version` only; do not materialise the profile jsonb on a
>   `If-None-Match` hit).
> - **Two kill switches, both server-side and both independent of
>   `GAME_LINK_ENABLED`** (which gates UI only): `CLAIMS_PAUSED` makes
>   `session-claim` return 503 and the client queue holds everything (no data is
>   lost); `PAIRING_PAUSED` makes `game-link-start` and `-claim` return 503 while
>   existing links keep reading.
> - **Observability.** There is no table, log or endpoint recording sync failures,
>   restore events or conflicts today — `cloudSync` only broadcasts to an in-memory
>   listener set. At minimum, log every rejected claim with its `reject_reason` (the
>   `feature_sessions` row is already stored for rejects) and alert on a sustained
>   `xp_claimed` / `xp_accepted` gap per user once §4.4's three special cases are
>   handled.
>
> ---
>
> ## 10. DOCS THAT MUST CHANGE IN THE SAME WORK
>
> Leaving the repo with two conflicting specs is how this gets built wrong later.
>
> - `game-sync/fighterProfile.mjs` header comment (`:8-22`) — rewrite the product-law
>   block to §3.1's mapping, with the old mapping preserved in a "superseded" note.
> - `docs/game-concept/03-APP-TO-GAME-SYNC-SPEC.md` — §1's mapping table, §3's
>   `feature_sessions` RLS line (it says "users read/write only their own rows",
>   which directly contradicts the no-client-write rule and is the whole point of
>   the design), the eight-value feature enum, the dropped `usage_snapshot` RPC, and
>   the edge-function decision overridden in §5.
> - `docs/game-concept/00-MASTER-CONCEPT.md` and `07-MASTER-CHECKLIST.md` — mark the
>   app-side of the sync as built once step 7 lands, so the checklist stays true.
>
> ---
>
> ## DO NOT
>
> - **Do NOT give the game access to `progress_snapshots`.** That grant includes
>   insert, update and delete for the owning user. A bug in a game build would wipe
>   an athlete's training history. The game reads `fighter_profiles` and nothing
>   else.
> - **Do NOT let any client write `fighter_profiles`, `feature_sessions`,
>   `game_links` or `game_link_attempts`.** No insert/update/delete RLS policy on
>   any of them. `service_role` only, from a Netlify Function. Copy the
>   `entitlements` pattern exactly.
> - **Do NOT compute a stat from a synced localStorage key.** `tm_arsenal`,
>   `tm_benchmarks`, `tm_camp_progress`, `tm_arcade_v2` and `tm_user_stats` are all
>   in `SYNC_KEYS` and reach the server as verbatim client strings. Stats come from
>   the ledger; the local GameLink preview reads localStorage and is labelled an
>   estimate for exactly that reason.
> - **Do NOT reuse `TMC1.` or `TMG1.` for anything that grants power.** Both are
>   unsigned base64, and `importGhostCode` trusts a `verified: true` field inside
>   the attacker-supplied payload (`ghostBattles.js:83`) for a 75 XP award. That is
>   the bug not to scale up.
> - **Do NOT mint a `TMF1.` token client-side**, ever, under any refactor.
> - **Do NOT compute a stat from a share, a ratio, or the current streak.** Monotone
>   lifetime accumulators only. `trainingShares()` is deleted, not repurposed.
> - **Do NOT trust `completedAt`, `getStreak()`, or any client clock.** Server
>   `now()` stamps everything that matters. The 28-day `ACH_CONSISTENCY` check
>   (`achievementTriggers.js:23`) is already forgeable by changing the device clock;
>   do not extend that hole into game power.
> - **Do NOT use `fightStats.strikes` for any stat** until strike provenance is
>   split (`App.jsx:706` vs `:724-725` mix thrown and called strikes in one
>   integer).
> - **Do NOT recompute tier or level in the game.** Read both from the export. The
>   app's own two tier ladders already disagree (`tiers.js:12-18` vs `:66-68`); a
>   third opinion in the game would be the worst outcome.
> - **Do NOT copy `fighterProfile.mjs` or the XP constants.** One file each,
>   imported by both the app and the functions. `protocol-src/` vs `protocol/` is the
>   in-repo proof of what a second copy costs.
> - **Do NOT add a Supabase Edge Function.** `supabase/config.toml` records why the
>   last one was deleted.
> - **Do NOT add a cron, `pg_cron`, or a scheduled function.** Season rollover is
>   lazy on read; code reaping is opportunistic. This repo has no scheduler and this
>   work does not introduce one.
> - **Do NOT run the destructive VERIFY steps against the production Supabase
>   project.** It holds the live `entitlements` table.
> - **Do NOT ship a leaderboard, PvP or prize surface on this trust level.** The
>   integrity system is a clock, not a measurement, and it says so in its own source
>   comment.
> - **Do NOT put a launch date back on the GameLink screen.**
>
> ---
>
> ## VERIFY — app side (browser, no server yet)
>
> 1. `npm test` and `node game-sync/demo.mjs` both pass after the input change. Note
>    what actually changes in `demo.mjs`: its fixtures are built entirely from
>    `activeMinutes` (`usage(900)`, `usage(300)`), which §3.5 replaces, so **the
>    fixtures are rewritten, not renamed**. The assertions that must survive, with
>    keys updated, are `lifter.stats.power >= 70`, `lifter.stats.stamina <= 35`,
>    `GLASS_CANNON`, `LIMITED_ARSENAL`, the four striker-vs-lifter derived
>    comparisons, and `lifter.specials.slotsUnlocked === 0`. `demo.mjs` never
>    asserted `endurance`; do not add an assertion that was not there. **Re-derive
>    what the two canonical builds now produce and have the owner confirm they are
>    still the intended fighters before locking the assertions.**
> 2. Seed the §3.8 athlete into `tm_user_stats` / `tm_benchmarks` /
>    `tm_camp_progress` / `tm_arcade_v2` / `tm_arsenal` / `tm_cardio_sessions` and
>    open GameLink. The bars read **POWER 46 · SPEED 23 · STAMINA 45 · TECHNIQUE
>    33 · GRIT 44**; derived shows `1.21×` damage, `5`-hit combos, `34s` stamina,
>    `1.6/s` regen, `1.5×` hit XP; `perks` is empty; the only weakness chip is
>    `NO_COMBINATIONS`; tier reads Combat Warrior, level 7.
> 3. **Monotone store.** Compute the fighter, then manually lower a source counter
>    (drop a Fit Mode session), recompute, and assert the stored stat is unchanged.
>    Keep the weaker "add a pure-cardio week, POWER does not move down" check as
>    well — it is a tautology under §3.5's formulas, which is exactly the point: it
>    is a contract test that fails loudly if anyone reintroduces share-based
>    computation.
> 4. **Season cap.** Force `stats_uncapped.power` to 80 with `season_start_stats.power`
>    at 62 in season 0: `stats.power` reads 70. Advance the anchor by 90 days and
>    recompute: it reads 78, then 80. Nothing is lost, only delayed. Then set a fresh
>    profile's first computation to 74 and assert it grants 74 — the cap does not
>    apply to the first computation.
> 5. Finish any session offline. `tm_claim_queue` holds one entry. Go online: the
>    queue drains, and re-running the flush a second time posts nothing new.
> 6. GameLink signed out shows the sign-in prompt, not a fighter. Sign in on a device
>    with local progress and an empty cloud row: the push happens, the bootstrap
>    runs once, and the fighter is non-zero on the next render.
> 7. `GAME_LINK_ENABLED = false`: the LINK A DEVICE panel renders disabled with its
>    reason, no code can be generated, and **the word "verified" does not appear
>    anywhere on the screen**.
> 8. The screen contains no launch date, no skins claim, and no button that reports
>    success without storing anything.
> 9. `data/moveVocabulary.js` maps every one of the 34 `arsenal.js` tokens and 36
>    `strikeNumbering.js` `WORD_TOKENS` either to a `LESSON_TO_MOVE` id or to an
>    explicit `null` with a comment. No token is silently unmapped.
> 10. The build fails if a second `computeFighterProfile` is added anywhere
>     (§6.2's guard).
> 11. `tm_user_stats.highestTierId` is populated on first load after the update, and
>     an athlete seeded at 6,400 XP still shows Combat Champion after the threshold
>     fix.
>
> ## VERIFY — server side (staging project only)
>
> 12. As an authenticated non-service user, `insert into public.fighter_profiles …`
>     and `update public.feature_sessions set xp_accepted = 9999` both fail.
>     `select` on your own row succeeds; another user's row returns zero rows, not
>     an error. `select` on `game_link_attempts` returns zero rows for everyone.
> 13. `POST /session-claim` with `xp_claimed: 999999` for a 3-round Fight Focus
>     returns `accepted: true, xp_accepted: 60` (3 × 20, no completion bonus on a
>     partial) and the fighter moves only by the honest amount.
> 14. A Fit Mode claim of 8 completed of 8 returns `xp_accepted: 150`
>     (8 × 15 + 30) — **not 190.** This is the `XP_FIT_FULL_BONUS = 30` case that a
>     server copying `XP_SESSION_BONUS` would get wrong for every honest athlete.
> 15. A Training Camp claim of 900 XP over 20 active minutes is clamped to
>     `ceil(16.9 × 20) = 338`, and a claim of 200 XP over the same 20 minutes is
>     accepted unchanged.
> 16. The same claim posted twice returns 200 both times and creates one row.
> 17. A claim with `completed_at` two days in the future is rejected
>     (`reason: 'clock'`). One with `active_seconds: 4` for a five-round Fight Focus
>     is rejected (`reason: 'implausible_duration'`). One from Fit Mode with
>     `active_seconds: 0` is accepted with `trust: 'recorded'` and the profile
>     reports `sourceQuality: "mixed"`.
> 18. Thirteen claims in one day: the thirteenth returns
>     `accepted: false, reason: 'daily_cap'`, the row is still stored and flagged,
>     and the GameLink screen shows the cap message.
> 19. Set `revoked_at` on the largest accepted session and recompute. Assert the
>     stat equals **the curve evaluated at the reduced accumulator** — not a fixed
>     subtraction, because the curve is logarithmic and the delta is non-linear by
>     design — and that this is the only scenario in which any stat falls. Assert
>     the athlete is notified.
> 20. Bootstrap: import a 400-session history, then call it again — the second call
>     returns 409 `already_bootstrapped` and imports nothing. A 3,000-session
>     payload is rejected `implausible_history`. After a successful import, the
>     GameLink local preview and `GET /fighter-profile` return **the same five stat
>     values**.
> 21. `CLAIMS_PAUSED = true`: `session-claim` returns 503, the client queue grows,
>     and nothing is lost when it is turned back off.
>
> ## VERIFY — pairing (simulate the game with curl)
>
> 22. `POST /game-link-start` with a user JWT returns an 8-character code drawn only
>     from the 30-character alphabet and `ttl_seconds: 600`. A fourth live code
>     returns 429 `too_many_codes`.
> 23. `POST /game-link-claim` with that code returns a `tml_…` secret plus the full
>     fighter. The **same** code posted again returns `404 invalid_or_expired` — a
>     byte-identical body to a wrong code and to an expired one.
> 24. Five wrong guesses burn the code; the sixth attempt on the *correct* code also
>     returns 404. Twenty-one attempts from one IP hash in an hour return 429, and
>     the global ceiling trips independently of IP.
> 25. `GET /fighter-profile` with `Authorization: Bearer tml_…` returns the profile;
>     with `If-None-Match: "<version>"` it returns 304. Post a session claim and the
>     next read returns 200 with `version` incremented.
> 26. A user who has paired but never claimed a session gets `404 no_profile`, not a
>     floor-15 fighter.
> 27. Revoke the link from GameLink. The next `GET /fighter-profile` with that secret
>     returns 401, and the link disappears from the app's device list. SIGN OUT
>     EVERYWHERE revokes all of them.
> 28. **No response body from any endpoint contains the substring `stripe_`**, and
>     the `fighter-profile` function's entitlements query (if D3 ever comes back
>     yes) uses an explicit column list, never `select *`. No response contains
>     `code_hash` or `secret_hash`.
> 29. A `TMF1` token verifies with the current `kid`, is rejected past its `exp`,
>     and is rejected with a tampered payload. Rotating the signing key with both
>     keys present keeps existing tokens valid; removing the old key invalidates
>     them.
> 30. `?p=<code>` in the URL routes to GameLink, is stripped from the address bar,
>     does not re-fire on reload, and — signed out — lands on the sign-in prompt with
>     the code preserved.
>
> ---
>
> ## Sequencing (each step is shippable on its own)
>
> | # | Step | Notes |
> |---|---|---|
> | **0** | **Get D1–D5 answered.** | Blocks step 4 onward. |
> | **1** | **`tiers.js`**: split out pure `tierForStats()`, use the authored `xp` thresholds, add `highestTierId` grandfather, fix the `'Practice'` / unbucketed-type bug in `getModeXp`. | Player-visible. Ships alone. Do not bundle. |
> | **2** | **`data/xpRules.js`** (shared XP constants, pure) + **`data/moveVocabulary.js`** (token ↔ move id) + **`data/featureMap.js`** (type ↔ feature ↔ stat sources). | Pure refactors, no behaviour change. |
> | **3a** | `add*Session` returns `{ id, xpEarned }`; one shared session-record helper; collapse the nine `session_complete` call sites. | Touches every call site that reads the bare XP number. |
> | **3b** | Add `discipline`, `campaign_id`/`stage_id`, `difficulty`, `camp_level_cleared`, `benchmark`, `lesson_tokens` to the record. | Cheap. Fixes the Arcade laundering at `ArcadeSessionPlayer.jsx:314`. |
> | **3c** | Add `active_seconds` per mode — including new timers for Fit Mode / Builder and Start Here. | **The largest single piece of work in this document.** Every mode runner. Worth doing even if the game is never built. |
> | **3d** | `MODE_RULES` entries + `useIntegritySession` wiring for `fitMode`, `cardio`, `startHere`. | Four mode runners. Empties out Tier R. Requires defining unit semantics and min/max valid seconds for modes that have none. |
> | **4** | Staging project, migration mechanism, `npm test`. | §6.6. Blocks everything server-side. |
> | **5** | **Migrations**: `fighter_profiles`, `feature_sessions`, `game_links`, `game_link_attempts`. | |
> | **6** | **`session-claim.mjs`** + `fighter-bootstrap.mjs` + the client queue. | |
> | **7** | **Rename the engine to `.mjs`, rewrite `demo.mjs` fixtures, re-derive the canonical builds, get owner sign-off, lock the assertions.** | This is the acceptance test for every later balance change. |
> | **8** | **GameLink: waitlist → YOUR FIGHTER**, computed locally. | Ship the day 3c lands. Needs no server. |
> | **9** | **`fighter-profile.mjs`**, then `game-link-start` / `-claim` / `-revoke`, behind `GAME_LINK_ENABLED = false`. | |
> | **10** | **Docs**: `fighterProfile.mjs` header, `03-APP-TO-GAME-SYNC-SPEC.md`, the master checklist. | §10. Same PR as step 7. |
> | **11** | **Privacy policy update + consent copy.** | Blocks step 6 going live, not step 6 being written. |
> | **12** | **`TMF1.` offline token** — only when a game build actually needs offline play. | |