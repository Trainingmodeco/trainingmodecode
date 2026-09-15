# TRAINING MODE — THE GAME: One-Stage Prototype Plan

**Status:** production plan, ready to act on or hand to a game developer.
**Scope:** one stage. Not a demo of the game. A demo of *the idea*.
**Written against:** the repo at `/home/user/trainingmodecode`, branch `claude/fight-mode-improvements-se9gas`, on 2026-09-15 — the 11 design docs in `docs/game-concept/` (1,941 lines), the working stat engine in `game-sync/`, the UI kit in `game-ui-kit/`, and the 404 files (398 images) in `public/`.

> **Branch caveat, and what it already cost.** This plan was verified against a feature branch, not the deployed `app` branch. That matters: an earlier draft of this document cited campaign directories (`ARC_BAKI`, `ARC_BERSERK`) and poster filenames (`baki-grappler`, `berserk-struggler`) that have since been renamed — the rename map is in `components/training-mode/data/arcadeIdMigration.js`. Every path, filename and count below was re-checked on disk on 2026-09-15. Before anything here is quoted to a contractor or an investor, re-confirm campaign ids, poster filenames and asset counts against `app`.

---

## 0. The short answer

You need **one 4-minute fight, one opponent, one background, one character, and a result screen that reads a fighter profile** — plus about **three weeks** of somebody making punching feel good before a single finished sprite gets drawn.

Everything else on the "what does a game need" list is production, not prototype. The prototype exists to make a person in a room say *"wait — so if I do my cardio, my guy actually stops gassing out?"* If it does that, it has done its whole job. If it looks gorgeous and doesn't do that, it has failed.

You are further along than you think. You have a **working, tested, dependency-free app→game stat engine already in the repo** (`game-sync/fighterProfile.js`; `node game-sync/demo.mjs` passes its own assertions today — I ran it). You have a locked art direction, a written Stage 1 with a named boss and three lines of his dialogue, a story outline, a 55-word move vocabulary, a 272-entry combo pool, a canonical strike-numbering system, 12 fighter archetypes, and a complete UI palette.

What you do **not** have is: a single frame of animation, a single line of engine code, a single sound effect other than a boxing bell, and — the thing this document had to fix before it could be trusted — **a stamina drain rate**. More on that in §7, because the entire demo hangs on it.

---

## 1. What "one stage" should be

### The recommended slice: **THE CITY RUN — Round One**

`docs/game-concept/08-STAGES-WEAPONS-MINIGAMES.md` locks Stage 1 as THE CITY RUN, and `docs/game-concept/09-STORY-SCRIPT.md:35-44` already names and writes its boss:

> **BOSS — [FLEX], THE FRIEND:** a beloved neighborhood fitness bro. All muscle, perfect form, zero fight IQ.
> **FLEX:** *"Bro. BRO. I love you. But I can't let you pass without a pump check. It's the CODE."*
> *He hits like a truck and gasses in 20 seconds — he IS the "fitness-only build" made flesh.*
> **FLEX** *(beaten, thrilled)*: *"That's the most cardio I've done in my LIFE. Respect. Hydrate or die-drate, king."*

That is not a coincidence to waste. The first boss of this game *is* the thesis of this game, and it is already written.

**One conflict to resolve before the artist starts.** The same doc, at `08-STAGES-WEAPONS-MINIGAMES.md:68`, describes a *different* CITY RUN boss — "the local bar-athlete champion (fights hanging FROM the pull-up bar)". The FLEX version at line 84+ is the founder-locked one (dated 2026-08-09) and is the one this plan builds. Delete or demote the bar-athlete line so the artist and the writer do not diverge. See §13.

**The slice, precisely:**

| Beat | Duration | What happens |
|---|---|---|
| 0. Profile load | 3s | Fighter profile JSON is read; HUD populates with stats, perks, weaknesses. A persistent **SIMULATED PROFILE** tag appears and never leaves the screen (§2b) |
| 1. Versus screen | 5s | Your tier portrait vs. FLEX. Stat bars visible. `game-ui-kit/screens/versus-screen.html` is the layout — with every string replaced (§4f) |
| 2. Walk-and-brawl | 60–90s | One screen-and-a-half of scrolling, 5–7 grunts in 2 waves, a barricade that locks the camera |
| 3. Boss encounter | 90–120s | FLEX. Two phases. Phase 2 at 50% HP is where stamina decides the fight |
| 4. Result screen | 20s | Rank (S/A/B/C), time, XP, and the money shot — **"THE TRAINING DID THIS"**: which stats carried the fight and which one lost it |
| *(stretch)* Workout pop-up QTE | 15s | Pull-up bar mid-stage; command string + mash meter. **Cut from the minimum viable slice** — see below |

**Total playtime: 3:00–4:00 per build.**

> **The demo is twice as long as the stage.** §2's test requires a stranger to play **both** builds. That is 8–9 minutes plus a title-screen reset, not 4. Plan the in-person demo at 10 minutes, and expect the second playthrough to be the one that matters.

### In scope

- One playable character (**pick one gender** — the male protagonist in `docs/game-concept/05-ART-PROMPTS.md`; the female variant is production)
- 9 moves + 1 special + 1 ultimate, all drawn from the app's existing strike vocabulary (§5)
- 1 grunt enemy, 2 palette variants, dumb-but-readable AI
- 1 two-phase boss with a written spec (§6c)
- 1 three-screen stage, 4 parallax layers
- HUD, boss bar, combo counter, versus screen, stage title, result screen
- Fighter profile loaded from a **JSON fixture generated by the repo's own engine** (§7)
- A **build-switcher on the title screen**: BUILD A (the lifter) / BUILD B (the striker). This is the single most important feature in the prototype and it is one dropdown.
- Desktop-browser web build, plus a desktop executable for in-person demos
- Gamepad + keyboard

### Out of scope — explicitly, in writing

- ❌ The workout pop-up QTE. It is the signature mechanic of the *finished* Stage 1 and it is **not** load-bearing for the stat thesis. It costs a minigame, a mash meter, an overlay UI and an art pass. Ship the slice without it; add it in Option B if the schedule holds.
- ❌ Any second stage, second boss, other saga
- ❌ Live Supabase sync, login, `feature_sessions`, `usage_snapshot`, the `fighter-profile` edge function. **All of it.** (§7 and §12 explain why this is the most expensive trap available.)
- ❌ Two-player co-op, online anything, leaderboards
- ❌ Save games, cross-session progression
- ❌ Story cutscenes, dialogue boxes, portraits, voice acting (FLEX's three lines appear as on-screen text only)
- ❌ The female protagonist, weapons, grabs beyond one boss grab
- ❌ Menus, options, key rebinding, resolution settings, pause beyond ESC→resume
- ❌ **Touch controls, and therefore phones.** See §3's honest reach statement.
- ❌ Console, Steam page
- ❌ The 8 arcade campaigns, the 71 campaign badges, the 272-combo pool as content

If someone proposes adding one of these, the answer is: *does it help a stranger understand that their squats made this guy hit harder?* It doesn't. Cut it.

---

## 2. The one thing the prototype must prove

> **A stranger, in under 90 seconds, with no explanation, must see that two different training histories produce two visibly, feel-ably different fighters — and prefer one of them.**

That is the sentence. Everything in this document is subordinate to it.

**Why this and not "does punching feel good?"** — `docs/game-concept/04-HOW-THE-GAME-GETS-BUILT.md` step 2 says the prototype's only question is *does punching feel good.* That is correct advice for a generic beat-'em-up and incomplete for this one. Hit feel is a **prerequisite**, not the proof. Nobody funds, joins, or covers a project because its jab is crunchy — there are four thousand crunchy indie brawlers. They fund it because of the hook, and your hook is the only one of its kind: **the character sheet is a real human being's training log.**

So hit feel is a hard gate — a prototype with mushy punches proves nothing because nobody will look past it — but it is the floor, not the ceiling. Build the feel first (§6), then spend everything else on making the stat difference *legible on screen*.

### 2a. The test, pre-registered before it is run

A test whose only permitted failure diagnosis is "present it better" cannot disconfirm anything. So the terms are fixed in advance:

| | |
|---|---|
| **n** | 5 people who have never seen the project. Recruit **two populations separately and report them separately**: 3 people who play games (they judge hit feel) and 2 gym coaches or training clients (they judge the hook). A coach who doesn't play games is the target buyer and a poor judge of whether a punch is crunchy; don't average them together. |
| **Protocol** | Play BUILD A to the end. Play BUILD B to the end. Then, and only then, one question: *"Tell me what just happened."* Nothing else is said. |
| **Pass bar** | 4 of 5 spontaneously describe the difference as being about the *kind* of training — "the first guy was strong but out of shape", "the second one knew more moves". |
| **Fail** | Fewer than 4 of 5, or anyone who needs the mechanic explained before they can describe it. |
| **Iteration cap** | **Two** presentation revisions. Not more. |
| **Disconfirming outcome** | If two revisions still fail to reach 4/5, the conclusion is recorded as: *the hook does not read without narration.* That is a real finding, not a prompt for a third revision. It means either the game must show the training log on screen (see §2c), or the hook is a marketing asset rather than a game mechanic — and the strategy changes accordingly. |

### 2b. Honesty rules that are not negotiable

The fighter profiles in this prototype are **fixtures for invented users**. They were produced by the repo's real engine, but they are not anyone's actual training history, and no live data connection exists or will exist during the prototype.

Therefore:

1. A **SIMULATED PROFILE** tag is rendered on the versus screen and the result screen, persistently, for the entire life of the prototype. Not just in the video.
2. The result screen does **not** address the viewer in second person. It says `STRENGTH 100 — FROM WORKOUT BUILDER`, never *"your Workout Builder sessions"*. The headline is **"THE TRAINING DID THIS"**, not "YOUR TRAINING DID THIS".
3. The demo video's closing claim is **"This is our stat engine, running on a training log."** It is not "Every stat came from a real training session." That would be false.
4. The honest line the demo *can* keep, and should: **"The engine is real and runs today. The connection to your account is next."**

Breaking any of these makes the artifact a lie about a product that cannot yet keep the promise. It also makes the first live-data demo a disappointment instead of a reveal.

### 2c. The three places the difference must be unmissable

- **The gas-out.** When the stamina pool empties, the fighter visibly slows (gassed idle and walk animations, hands down, chest heaving), the HUD bar goes red **and** a `GASSED` text tag appears, breathing audio kicks in, and frame data stretches ×1.45. BUILD A must gas out during the boss fight. Every time. This is the demo's emotional beat, and §7c is the arithmetic that makes it reliable.
- **The move list.** BUILD A's attack buttons do nothing for 6 of 9 inputs, with a grey `NOT TRAINED — PRACTICE MODE` flash on the HUD move strip. BUILD B has all nine lit plus a special and an ultimate. `LIMITED_ARSENAL` should feel like a locked door.
- **The result screen.** Three attribution lines, third person: *"STRENGTH 100 — FROM WORKOUT BUILDER. Damage ×1.8."* / *"STAMINA 33 — NO CARDIO. Gassed at 0:36."* / *"STRIKES 3 OF 19 — PRACTICE MODE UNLOCKS THE REST."*

**Consider a 5-second pre-roll.** The thesis is currently carried entirely by video captions. Inside the build, two preset characters behind a dropdown is indistinguishable from a class-select screen. A 5-second pre-roll showing the app's own Progress screen, then the versus card assembling from it, closes that gap for near-zero cost using screenshots you already have. Treat it as the first presentation revision if the test fails.

---

## 3. Engine choice

### The call: **Godot 4.x, 2D. Desktop executable as the primary demo artifact; web export as the shareable link; the 90-second video as the artifact that actually travels.**

Here is the reasoning and the honest costs.

#### The three real candidates

**Godot 4.x — RECOMMENDED**

- Free, MIT, zero royalties, zero seat cost. On a small budget this is not a tiebreaker, it's most of the decision.
- 2D is first-class. `AnimationPlayer` + `AnimationTree` state machines, `Area2D` hit/hurtboxes, `YSort` for the depth-sorted brawler floor, `Parallax2D` layers, and `_physics_process` at a locked 60 Hz — exactly the five things a beat-'em-up needs and exactly the five you'd hand-roll in a web stack.
- Exports to HTML5, so a link exists. (Read the reach caveat below before leaning on it.)
- Handles both cameras in one project: the side-scroller AND the locked versus framing. `04-HOW-THE-GAME-GETS-BUILT.md` already reached this conclusion independently.
- `game-sync/fighterProfile.js` is pure dependency-free JS. Godot can't run it directly, but the prototype doesn't need it to — it loads the engine's **output JSON**. The contract travels as JSON, which is the whole point of how it was written. Porting the ~100 lines of arithmetic to GDScript later is an afternoon.
- GDScript is Python-shaped, with stable well-documented APIs — good ground for AI-assisted coding.

**Honest Godot costs — read these before committing:**

- **Reach.** Godot 4's *threaded* web export needs `SharedArrayBuffer`, which requires `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`. Godot 4.3+ also ships a **single-threaded** web export that needs neither, at a performance cost. Pick one in week 1. If you go threaded, host on a **separate Netlify site or subdomain** — `netlify.toml` currently sets no such headers, and adding them to `apptrainingmode.com` would break the two subresources that actually matter: the **Plausible script** injected by `scripts/copy-public-assets.mjs`, and the **Google Fonts** `@import` in `components/training-mode/Styles.js:26` plus its `.woff2` files. (An earlier draft of this document claimed Stripe and Supabase would break too. They wouldn't: `data/stripe.js:30-35` does a full-page `window.location.assign()` to a hosted Payment Link, and Supabase is CORS `fetch`. Corrected here so nobody over-scopes the fix.)
- **Godot 4 web export on iOS Safari is unreliable** (audio and threading both misbehave).
- **And the bigger reach problem is your own scope decision.** §1 puts touch input out of scope. That makes the link **unplayable on every phone**, not just iOS. So: *the shareable link is a desktop-browser demo.* Stop using "gym coaches with phones" as the argument for web export. Coaches get the video (§10) and, in person, a laptop.
- Web payload for a slice like this: **~25–45 MB (estimate**, based on typical Godot 4 2D exports with a few hundred sprite frames and a handful of audio loops**)**. Add a loading screen.
- **Browser gamepad caveat:** the Gamepad API reports no pad until a button is pressed. The title screen needs a "press any button" gate or the controller appears dead.

**Unity — NOT RECOMMENDED for this prototype**

Better console path, bigger asset store, far more hireable contractors — all of which matters in year two and none of which matters in week six. Unity's 2D brawler workflow is not meaningfully better than Godot's, its WebGL export is larger and slower to load, and its licensing has been a moving target. **The one condition that flips this:** you hire a dev who already knows Unity cold. A prototype shipped in an engine your dev knows beats a better engine your dev doesn't. That is the only condition — and it has an expiry date (§8).

**Phaser / PixiJS — the near-miss, and worth knowing why you're passing**

The case *for* is genuinely strong:
- It's your stack. `fighterProfile.js` would run **unmodified** in the browser. No port, ever.
- Shareability is unconditional: it's a webpage, it works on iOS Safari, touch is natural, and it could be **embedded inside the PWA**.
- Zero cost, zero install, instant iteration.

The case *against*, which wins on a six-to-sixteen-week prototype:
- Phaser gives you a renderer, tweens and arcade physics. It does not give you an animation state machine, a hitbox authoring workflow, depth-sorted floors, or a scene editor. **You would spend the first three weeks building a beat-'em-up framework instead of building hit feel** — which is most of Option A's entire budget.
- Frame-accurate hitstop, cancel windows and a 6–8 frame input buffer are all doable in JS, but you're implementing a fixed-timestep combat loop by hand while `requestAnimationFrame` fights you.
- Pixel-art tooling (atlas import, per-frame hitbox keys, Aseprite import) is one-click in Godot and build-it-yourself in Phaser.

**Revisit only if the answer to §13's decision zero changes** from "fundraising and recruiting artifact" to "playable teaser inside the PWA." If that becomes the priority, Phaser wins outright, touch becomes mandatory, and you should switch deliberately rather than drift.

> One correction to the in-app argument as it's usually made: there is **no paywall to put it behind today.** `components/training-mode/data/entitlements.js:27` sets `PAYWALL_ENABLED = false`, and the only three gates that exist are arcade stage 4+, camp level 4+, and a second Builder routine. Gating a game demo means a fourth gate *and* flipping the launch switch. It is a real option, just not a free one.

**OpenBOR — no.** `04-HOW-THE-GAME-GETS-BUILT.md` calls it a sketchbook and is right. No app sync, weak versus mode, dead-end codebase, nothing transferable.

#### Decision summary

| | Godot 4 | Unity | Phaser/Pixi |
|---|---|---|---|
| Cost | $0 | $0 → licensed | $0 |
| 2D brawler tooling | Excellent, built-in | Good | Build it yourself |
| Shareable link | Desktop browsers | Desktop, heavier | Everywhere incl. phones |
| Embeddable in the PWA | Awkward | Awkward | Trivial |
| Reuses `fighterProfile.js` | Via JSON | Via JSON | Directly, unmodified |
| Time to first crunchy punch | ~1 week | ~1.5 weeks | ~3 weeks |
| Path to the real game | Strong | Strongest | Weak |
| **Verdict** | **Build here** | If you hire a Unity dev | If the goal becomes in-app |

---

## 4. Art: what one stage needs, what you own, what to buy

### 4a. The bill of materials

Pixel art animates at 10–15 *drawn* frames per second, with frames held across engine ticks. So "4-frame jab" (drawn) and "3-frame startup at 60 Hz" (engine timing) are both true and refer to different things. The counts below are **drawn frames**, and every count is an **estimate** based on standard 2D beat-'em-up animation sets.

**PLAYER CHARACTER — 1 character, ~125–160 frames**

| Animation | Frames | Notes |
|---|---|---|
| Idle | 6 | Breathing loop, guard up |
| Walk | 8 | Brawler floors need up/down drift |
| Dash / step | 4 | Discipline perk: boxing gets the angle-out pivot |
| Jab (1) | 4 | The first animation to draw |
| Cross (2) | 5 | |
| Lead Hook (3) | 5 | |
| Rear Uppercut (6) | 6 | Launcher |
| Low Kick / Teep | 6 | |
| Knee | 4 | |
| Block / guard | 2 | +2-frame block impact |
| Hurt (light) | 3 | |
| Hurt (heavy) / launch | 4 | |
| Knockdown | 6 | |
| Get-up | 5 | With invuln frames |
| Special | 10 | From `ADVANCED_STRIKES` |
| Ultimate | 16 | Plus a cut-in illustration |
| Victory | 8 | |
| Defeat / KO'd | 6 | |
| **Gassed-out idle** | 6 | **Mandatory.** Hands down, chest heaving. |
| **Gassed-out walk** | 6 | **Mandatory.** Visibly slower, shorter stride. |

The last two are not polish. They are how the stamina stat becomes visible without a UI element, and §2c names them as one of the three unmissable signals.

**GRUNT ENEMY — ~35–45 frames.** Idle 4, walk 6, attack A 5, attack B 5, hurt 2, knockdown 5, get-up 4, death 6. Two palette swaps = three enemy types for free.

**BOSS (FLEX) — ~80–110 frames, two phases.** Intro 10, idle 6, walk 6, shoulder charge 6, grab-and-slam (telegraphed) 10, phase-2 ground pound 8, hurt 3, stagger 5, phase-2 transition 12, knockdown 6, defeat 10. **Phase 2 is a palette shift + torn shirt**, not a second sprite set — a standard, cheap, legible trick. FLEX also needs a **gassed** idle of his own; see §6c.

**BACKGROUND — 4 parallax layers, ~3 screens wide.** Sky/skyline (1 tiling layer), mid buildings/park (2× screen width), near props — pull-up bars, basketball hoop, benches (2× width), floor plane with perspective (3× width, tileable), plus 2 foreground occluders. The stage is **outdoors**. Nothing in `public/` depicts an outdoor city.

**VFX — ~40–50 frames.** Light hit spark 5, heavy impact 7, block spark 4, landing dust 5, dash trail 4, KO burst 10, super cut-in (1 illustration + 4-frame flash), speed lines 4.

**UI.** Player HUD, boss bar, combo counter, versus screen, stage title, **result screen**, pause. The first five exist as HTML mockups. The result screen does not.

### 4b. What the repo gives you — a real head start

Verified on disk, 2026-09-15:

| Asset | Count / spec | Use in the prototype |
|---|---|---|
| `public/static/tiers/` | 32 files — 8 ranks × 2 genders × 2 formats, 312×520 portraits (`rookie`, `novice`, `warrior`, `elite`, `champion`, `peak-physique`, `fight-ascendant`, `final-form`) | **Character design reference**, and the versus-screen portrait unmodified |
| `public/static/ghost/` | 6 files, 375×666 (`vs-male-1..3`, `vs-female-1..3`) | **Drop-in versus-screen character plates.** Ready today |
| `public/static/arcade/` | `stage-complete`, `partial-complete`, `mission-failure`, `validation-fail` | **The result screen's four outcome states, already drawn** |
| `public/static/trophies/fight/` | 9 trophies at 500×500 | Result-screen reward flourish |
| `game-ui-kit/` | 7 runnable HTML/CSS mockups: player HUD, boss bar, combo counter, versus screen, stage title, colour + type tokens | Layout and CSS spec — **strings must be replaced, see §4f** |
| `components/training-mode/Styles.js` | **18-key palette (16 distinct colours** — `neon` aliases `violetBright`, `gold` aliases `yellow`**)**: `bg #080012`, `panel #180030`, `violet #a855f7`, `magenta #d946ef`, `gold #fde047`, `rush #ff6b00`, `cardio #ff8a4a`, `text #f5e9ff` …; 3 fonts; plus a CSS FX kit (scanlines, grain, glitch-rgb, danger-stripes, ember) | The visual identity, pre-decided. Port the tokens verbatim |
| `ArcadeUI.jsx` | `goldGradient`, `glowViolet`, `glowGold`, 4-state stage-node palette | Exact values for HUD chrome |
| `docs/game-concept/05-ART-PROMPTS.md` | Protagonist designs to wardrobe detail, reusable STYLE BLOCK, turnaround-sheet prompt | **The art brief is written.** Hand it over on day one |
| `docs/game-concept/09-STORY-SCRIPT.md:35-44` | FLEX's design note and three lines | The boss's personality, written |
| `public/static/practice/` | 16 files, 800×267 action art per discipline × gender | Pose and silhouette reference for animators |
| `public/static/fight/boss-eyes.webp` | 640×172 | Boss intro sting |

**What you cannot reuse, and must accept:**

- **Not one animation frame exists.** 398 images, zero sprite sheets, zero atlases, zero frame data. Every character asset is a single static illustrated pose.
- **The style is wrong.** The app's art is smooth cel/illustration; the stated bar (`00-MASTER-CONCEPT.md`) is *TMNT: Shredder's Revenge* / *Marvel Cosmic Invasion* pixel work. The tier portraits are excellent **design references** and unusable **as sprites**.
- **The backgrounds are the wrong shape.** `series/stage-bg/stage-1..10.webp` are 528×880 portrait plates, single-layer, gym/ring/abstract.
- **`seriesTint.js` is an admission in code**: all 13 visible series share the same ten stage images, differentiated only by CSS `hue-rotate`. Don't inherit that.
- **Nothing in the app's audio layer is reusable.** `data/audioEngine.js` synthesises everything at runtime (Web Audio) and `voiceCoach.js` uses browser TTS. `public/audio/boxing-bell-signals.mp3` is the entire transferable library. The audio budget starts from zero.

### 4c. The IP problem, stated accurately

This is broader than the earlier draft said, and one part of it sits inside the file §11 tells you to copy.

**1. Campaign art notes — five campaigns, not one.** `art_note: "Placeholder banner reuse — swap for an original asset before launch (IP)."` appears in `ARC_BLUEBLUR`, `ARC_GRAPPLER`, `ARC_GRAVITY`, `ARC_MARTIALMONSTER` and `ARC_VIGILANTE` — in both `components/training-mode/protocol/data/campaigns/*/campaign.json` and the `protocol-src/` mirror. (An earlier draft cited `ARC_BAKI`, which no longer exists.)

**2. Posters — de-IP'ing is in progress, not untouched.** `public/static/series/posters/` holds 13 posters × 2 formats. Two have already been renamed to archetypes: `grappler-protocol` and `struggler-protocol`. The nine still franchise-derived by filename: `one-punch`, `dark-knight`, `ultra-instinct`, `ultra-ego`, `demon-back`, `hero-hunter`, `blue-blur`, `hyperbolic-gravity`, `the-wall-crawler`. The *titles* were de-IP'd in `arcadeCampaignSeries.js`; the *art* was not. **Do not put those posters in a fundraising demo.** The tier portraits and ghost plates are original — use those.

**3. MIKE BISON is hardcoded in the UI kit you were told to copy.** `grep -ri bison` returns 5 files inside `game-ui-kit/`: `hud/boss-bar.html`, `screens/versus-screen.html`, `screens/stage-title.html`, `tokens/type.html`, `DESIGNER-PROMPT.md`. `docs/game-concept/00-MASTER-CONCEPT.md` states the derivation outright: *"Mike Bison (Mike Tyson × M. Bison)"*. Following §11 literally would put a Street Fighter / Tyson portmanteau on the boss bar of a fundraising demo — exactly the risk the poster warning exists to prevent.
**Instruction: port the kit's tokens, layout and CSS; replace every string.** The Stage 1 boss is FLEX. Run one `grep -ri` for character names across `docs/game-concept/` and `game-ui-kit/` before the artist starts, and record the result in `ASSET-LICENSES.md`.

**4. Provenance of the app's own art is unanswered.** §4b hands tier portraits, ghost plates and result art straight into a second, commercial repo. Nobody has established who owns them or whether the commission terms extend to a separate game product. **Answer that before copying those files.** It is a one-email question and an expensive omission.

**5. Fonts.** Orbitron, Rajdhani and Press Start 2P load from Google Fonts at runtime in the app. A packaged game must embed them. All three are OFL-family in the Google Fonts catalogue, but **verify and record each licence in `ASSET-LICENSES.md`** rather than assuming.

### 4d. Commission costs, honestly

Indie pixel-artist rates, 2026, for someone competent at combat animation — not top-shelf, not bargain-basement. **These are estimates**, based on prevailing freelance rates of **$30–65/hr** and **$10–30 per drawn frame** for character animation, plus **$300–800** for a design sheet and turnaround before any animation.

| Item | Low | High |
|---|---|---|
| Player: design sheet + turnaround | $300 | $800 |
| Player: ~140 animation frames | $1,400 | $4,200 |
| Boss: design + ~95 frames (phase 2 = palette shift) | $1,400 | $3,800 |
| Grunt: ~40 frames + 2 palette variants | $450 | $1,200 |
| Background: 4 parallax layers + floor, 3 screens | $700 | $2,000 |
| VFX: ~45 frames | $350 | $900 |
| UI art: result screen, HUD polish | $400 | $1,100 |
| **All-commissioned, one stage** | **$5,000** | **$14,000** |

**Two revision rounds are not free.** An earlier version of this section priced a world where "one good artist doesn't need three revision rounds" — that is a budget assumption disguised as an aside. Add **~15% for two rounds per animation set**, and put the rounds in the contract.

### 4e. The three realistic alternatives

**1. Asset packs — $150–400, available this week.**
itch.io and the Godot/Unity stores carry beat-'em-up-ready character packs with full animation sets, enemy packs, city parallax and VFX sheets ($15–80 each). You could have a playable stage's worth of animated art in days.

- *Risk — consistency.* A player from pack A, a boss from pack B and a background from pack C will not share a palette, outline weight, pixel density or light direction. It reads as a mock-up. Mitigate by buying within one artist's catalogue where possible and doing a **palette re-index pass in Aseprite to the `Styles.js` tokens — budget 6–10 hours**, which the earlier draft required and priced at nothing.
- *Risk — licensing.* Most itch packs permit commercial use; many forbid redistribution, some forbid AI/NFT use, a few are personal-use-only. **Read every licence. Keep `ASSET-LICENSES.md` from day one.** You cannot retrofit this.
- *Risk — it isn't your character.* Pack art cannot carry the protagonist design in `05-ART-PROMPTS.md`. Fine for an internal feel prototype; weak for a fundraising demo.
- **Use for:** the feel prototype, and grunts + VFX permanently.

**2. AI-assisted pipeline — $20–200/mo + your time.**
Generate concepts and background layers from the STYLE BLOCK prompt you already wrote, then hand-clean and animate in Aseprite (~$20 one-time).

- *Risk — frame-to-frame consistency.* This is the killer, and nobody has solved it. A generated idle and a generated jab will not be the same character. The workable pipeline is: generate **one** approved pose → clean it to a base sprite → **animate by hand**. You save concept time, not animation time, and animation is ~80% of the cost.
- *Risk — provenance.* Terms vary by tool and change. For a demo shown to investors, be able to say where every asset came from; some storefronts now require disclosure.
- *Risk — the style gap.* AI will happily produce "pixel-art-styled smooth illustration", which is the worst of both and instantly legible to anyone who plays games.
- **Use for:** parallax background layers (genuinely strong — a real $700–2,000 saving), concept exploration, and the boss caricature designs later.

**3. Hybrid — recommended.**
Asset packs for grunts and VFX. AI-assisted + hand-cleaned background. **One paid human artist for the player and the boss only.**

That is **~235 of the ~325 frames done by hand** (player 140 + boss 95) and **~85 handled cheaply** (grunt 40 + VFX 45). *(An earlier draft had these two buckets reversed, which made the hybrid look three times cheaper than it is.)*

| Hybrid line item | Low | High |
|---|---|---|
| Player design sheet + ~140 frames | $1,700 | $5,000 |
| Boss design + ~95 frames | $1,400 | $3,800 |
| Two revision rounds (~15% of the above) | $465 | $1,320 |
| Asset packs (grunt, VFX, UI bits) | $150 | $400 |
| Aseprite + AI tooling | $40 | $240 |
| Audio (§4f) | $150 | $1,500 |
| **Hybrid total** | **$3,905** | **$12,260** |

**Plan around ~$7,000.** That is the midpoint, and it is the number §8's Option B uses. There is now exactly one art budget in this document; every other section references it rather than restating it.

### 4f. Audio — small budget, enormous return

Minimum viable audio for one stage:
- Punch/kick impact set (light, medium, heavy), whiff, block, KO stinger — **8–12 SFX**
- Footsteps, land, dash — **4 SFX**
- UI: select, confirm, combo tick, rank reveal — **5 SFX**
- Enemy grunts and boss barks — **6–10 one-shots**
- One stage loop, one boss loop

**$150–200** from royalty-free libraries, or **$600–2,000** commissioned. `docs/game-concept/06-STAGE-CONCEPT-THE-CLUB.md` already specifies original music to dodge licensing — correct instinct, keep it.

**Spend at least $150.** Audio is the cheapest hit-feel multiplier that exists: a three-layer impact makes a mediocre animation feel good, and silence makes a great one feel dead.

**Audio licensing gets the same discipline as art.** freesound.org is mixed CC0 / CC-BY / CC-BY-NC, and NC-licensed audio in a fundraising demo for a commercial product is a live problem. **Filter to CC0 at search time, or buy commercial.** Log every file's source URL and licence in `ASSET-LICENSES.md` *as you download it*, not afterwards.

---

## 5. The move list — derived from what the app already names

Do not invent a move list. The app has four overlapping vocabularies that already agree.

**The sources, verified:**
- `components/training-mode/data/strikeNumbering.js` — `NUMBERED`: **13 entries — 8 numbered punches (Jab 1, Cross 2, Lead Hook 3, Rear Hook 4, Lead Uppercut 5, Rear Uppercut 6, Lead Overhand 7, Rear Overhand 8) plus 5 body variants (1B–5B).** Kicks/knees/elbows are deliberately unnumbered because gym conventions vary.
- `components/training-mode/data/comboCoachData.js` — `SINGLE_STRIKES` per discipline, and `ADVANCED_STRIKES`, which **is your super-move roster, pre-written**: boxing [Bolo Punch, Check Hook, Shovel Hook, Overhand]; kickboxing [Spinning Back Kick, Tornado Kick, Question Mark Kick, Axe Kick, Superman Punch, Spinning Backfist, Flying Knee, Hook Kick]; muay-thai [Spinning Back Elbow, Spinning Back Kick, Question Mark Kick, Flying Knee, Jumping Elbow, Axe Kick, Spinning Heel Kick]; mma [Spinning Back Kick, Spinning Backfist, Superman Punch, Flying Knee, Question Mark Kick, Wheel Kick, Oblique Kick].
- `game-sync/fighterProfile.js` — `LESSON_TO_MOVE`: 18 lesson ids → 18 unique move values, plus `DEFAULT_MOVES = ['jab','cross','shove']`. Since `jab` and `cross` overlap, **the maximum moveList length is 19**, which is why the HUD reads `3 OF 19 STRIKES`.
- `components/training-mode/data/arsenal.js` — the unlock mechanic **already shipped in the app**: learned strikes persist per discipline with `STARTER_ARSENAL` floors and `filterCombosToArsenal()`. The game's move-unlock system is a port, not an invention.

**The prototype's move list** — the 9 ids the fixture gates, mapped to buttons:

| Input | Move id | App name | Call no. | Gated by |
|---|---|---|---|---|
| LIGHT ×1 | `jab` | Jab | 1 | Always (`DEFAULT_MOVES`) |
| LIGHT ×2 | `cross` | Cross | 2 | Always |
| LIGHT ×3 | `lead_hook` | Lead Hook | 3 | Practice Mode |
| HEAVY | `rear_uppercut` | Rear Uppercut | 6 | Practice Mode |
| HEAVY (hold) | `low_kick` | Low Kick | — | Practice Mode |
| FORWARD + HEAVY | `teep` | Teep | — | Practice Mode |
| BACK + LIGHT | `slip_counter` | Slip | — | Practice Mode |
| CLOSE + HEAVY | `knee_strike` | Knee | — | Practice Mode |
| GRAB | `shove` | — | — | Always |
| SPECIAL (1 meter) | `ADVANCED_STRIKES` by discipline — muay-thai **Spinning Back Elbow** | — | — | `specials.slotsUnlocked ≥ 1` |
| ULTIMATE (full meter) | muay-thai **Flying Knee** | — | — | `specials.ultimateUnlocked` |

**This is the demo.** BUILD A has three. BUILD B has nine plus both specials. Same controller, radically different fighter. When BUILD A presses HEAVY and gets a grey `NOT TRAINED — PRACTICE MODE` flash instead of an uppercut, the product thesis lands in half a second with no dialogue.

**Do NOT use the 272-combo `COMBO_POOL`** as a command list. It is coach display text ("Jab Cross Knee Elbow Level Change Ground Pound"), not fighting-game notation. It is a *production-phase* source for enemy attack scripts and combo trials.

### 5a. The canonical mapping table — one file, one owner

Four vocabularies disagree today. This is irrelevant to the prototype (it loads a fixture) and **mandatory** before any live wire-up. It belongs in one file with one named owner:

| Concept | The app says | The contract says | Resolution |
|---|---|---|---|
| **Tier** | `rookie / novice / warrior / elite / champion` + 3 secret (`tiers.js:12-24`) | `rookie / adept / veteran / elite / champion` (`fighterProfile.js:41`) | **The app's ladder wins.** `adept` and `veteran` have no art on disk; `novice` and `warrior` do. Amend the `@typedef` and `demo.mjs` |
| **Discipline slug** | `muay-thai` (hyphen) in `comboCoachData.js`, `arsenal.js` | `muay_thai` (underscore) in `fighterProfile.js`, `disciplines.json` | Pick one and map. A naive `ADVANCED_STRIKES[profile.discipline]` returns `undefined` today |
| **Strike tokens** | Display tokens (`'Low Kick'`, `'Spinning Back Kick'`) in `tm_arsenal` | snake_case lesson ids (`low_kick`) in `LESSON_TO_MOVE` | Needs a table. No `lessonsCompleted` array exists anywhere in the app |
| **Feature names** | 10 session `type` strings in `userStats.js` | 8 feature keys in `AppUsageSnapshot` | See §7e — three of the eight have no app-side source at all |

---

## 6. Animation, feel, and the boss

Build this **before any finished art exists**. Coloured rectangles. `04-HOW-THE-GAME-GETS-BUILT.md` calls it "boxes punching boxes" and is right. If a white box punching a red box doesn't feel good, a beautiful sprite punching a beautiful sprite won't either — you'll just be slower and poorer when you find out.

### 6a. The seven things that must be right

**1. Hitstop (freeze frames on impact)** — the single highest-value item. Both fighters freeze; the attacker's sprite holds, the victim vibrates 1px.

| Hit type | Hitstop (60 Hz frames) |
|---|---|
| Light (jab/cross) | 4 |
| Medium (hook) | 6 |
| Heavy (uppercut/kick) | 9 |
| Special | 12 |
| Ultimate | 16 + 30-frame slowmo at 0.25× |
| KO blow | 20 + 45-frame slowmo + zoom |

Scale hitstop by `strikeDamageMultiplier`: BUILD A's 1.8× gets ~1.3× hitstop. A big hit *feels* big before the number is read.

**2. Knockback and hitstun** — light 8px + 10 frames; heavy 26px + 20; launcher 40px + airborne. Knockback scales with damage multiplier so BUILD A visibly shoves enemies further. Wall-bounce into the barricade is a free "wow".

**3. Screen shake** — light 2px/4f, heavy 6px/8f, KO 12px/14f with a 200ms decay. **Directional** along the hit vector, not random jitter. Cap it; constant shake is nausea.

**4. Hit sparks** — at the **contact point**, not the sprite centre, persisting ~6 frames past the hitstop. Different spark for light / heavy / blocked. 2-frame white sprite flash on the victim.

**5. Audio layering** — every impact is **three simultaneous sounds**: transient (crack), body (thud), tail (cloth/breath/reverb). Pitch-randomize ±8% so a five-hit combo doesn't machine-gun one sample. Music ducks 3 dB for 150ms on heavy hits. **Sound fires on the first frame of hitstop, not on animation start.**

**6. Input buffer** — 6–8 frames (100–133ms). A press during hitstop or the last 8 recovery frames queues and fires on the first available frame. Without this, playtesters say "the controls are laggy" when the real problem is buffering. **This is the most common reason a prototype gets dismissed.** Non-negotiable.

**7. Cancel windows** — light cancels into light on hit from active frame 1 through recovery frame 4; light into heavy on hit only; heavy into special on hit only; **nothing cancels on whiff** (which is what makes whiffing feel bad, correctly). **`maxComboLength` caps the chain** — BUILD A stops at 4 links and physically cannot continue; BUILD B chains to 11.

### 6b. Target frame data (60 Hz)

Beat-'em-ups run looser than fighting games. Readability beats precision.

| Move | Startup | Active | Recovery | Total | On hit | On block |
|---|---|---|---|---|---|---|
| **Jab (1)** | 3 | 2 | 7 | 12 | +6 | +1 |
| Cross (2) | 5 | 3 | 10 | 18 | +5 | −2 |
| Lead Hook (3) | 7 | 3 | 12 | 22 | +4 | −4 |
| **Rear Uppercut (6)** | 9 | 4 | 16 | 29 | launcher | −9 |
| Low Kick | 8 | 4 | 14 | 26 | +3 | −6 |
| Teep | 6 | 3 | 15 | 24 | pushback | −7 |
| Knee (close) | 7 | 3 | 13 | 23 | +4 | −5 |
| Shove (grab) | 6 | 3 | 11 | 20 | throw | — |
| Slip (defensive) | 2 | 8 invuln | 10 | 20 | — | — |
| Special | 12 | 6 | 22 | 40 | 6 armour frames | −14 |
| Ultimate | 18 | 10 | 30 | 58 | full invuln through active | — |

**Gassed modifier:** ×1.45 on startup and recovery, active unchanged. The jab goes 12 → 17 frames. Players feel this immediately and describe it correctly without being told — *"he got slow."* That reaction is the prototype working.

Drawn frames per attack at 12fps: jab 4, cross 5, hook 5, uppercut 6, special 10, ultimate 16. The 60 Hz numbers above are hold durations, not drawings.

**Lock this table before commissioning animation.** Frame data will change five times during feel week. Grey boxes are free to re-time; commissioned frames at $10–30 each are not.

### 6c. The boss spec — FLEX, THE FRIEND

An earlier version of this plan spent two thousand words on the player's frame data and gave the opponent one clause. That is how prototypes lose a month. Here is the one-pager; write it fully before week 5.

**Design brief** (from `09-STORY-SCRIPT.md`): all muscle, perfect form, zero fight IQ. *"He hits like a truck and gasses in 20 seconds."* He is a mirror of BUILD A — which creates the one real thematic risk in this whole plan (see below).

**Attacks, in the §6b format:**

| Attack | Startup | Active | Recovery | Damage | Telegraph |
|---|---|---|---|---|---|
| Shoulder charge | 24 | 12 | 40 | medium | Wind-up flash + audio bark, 0.4s |
| Grab-and-slam | 30 | 8 | 48 | high | Arms wide, 0.5s; whiffs into a long recovery |
| Ground pound (phase 2 only) | 26 | 10 | 44 | medium, wide | Jump arc, shadow marker on floor |

**Rhythm.** Fixed and readable: attack → **40-frame punish window** → reposition. Average one swing every **2.4 seconds**. The player's opening is always the recovery, never a read.

**Phase 2** triggers at 50% HP and is **one variable**: recovery frames ×0.75, plus the ground pound enters the rotation. Presentation is a palette shift, torn shirt, and a 12-frame transition. No second AI.

**FLEX gasses too, and that is the point.** He is written to gas in 20 seconds. Give him a visible gassed state on the same rules as the player. **The fight is decided by who gasses first.** Without this, a stranger watching a lifter lose to a lifter learns *"the boss is stronger"*, not *"you skipped cardio"* — which would quietly destroy the demo's meaning. With it, BUILD A and FLEX trade haymakers, both wilt, and the one who ran out of air first goes down. BUILD B outlasts him and finishes with the ultimate.

**Balance pass — 1.5 weeks, named and budgeted.** §7c gives the stamina arithmetic; boss HP and damage are *playtest-tuned*, not spreadsheet-derived, and this document will not pretend otherwise. The acceptance test, written before the pass begins:

> Five playthroughs of BUILD A and five of BUILD B by the owner, then three of each by a stranger. Required: **BUILD A loses 8/8. BUILD B wins ≥7/8.** BUILD A must gas before the loss in 8/8.

### 6d. Build order for feel week

1. One box walks on a depth-sorted floor
2. One box jabs — hitbox, hurtbox, contact detection, debug boxes visible
3. **Hitstop.** Feel it. Tune it for an hour. This is the day the project becomes real.
4. Knockback + hitstun + screen shake
5. Hit spark placeholder + one impact sound
6. Input buffer + the light→light→light chain
7. A second box that fights back
8. **Stop. Show one person. Ask "does that punch feel good?"**

**Exit criterion, so a three-week timebox does not become six:** three of three people asked say yes without qualification, AND measured input-to-hit-sound latency is under 40 ms on the target build. Then move on. You are not shipping *Streets of Rage 4*; you are proving a thesis.

---

## 7. The stat hook — how the prototype consumes a fighter profile

### 7a. The rule: no backend. None.

`docs/game-concept/03-APP-TO-GAME-SYNC-SPEC.md` specifies the real pipeline — a `feature_sessions` table, a `usage_snapshot` view, a `fighter-profile` edge function. **None exist**, and building them first is the most seductive way to burn a quarter producing nothing anyone can watch. §7e details why the input they'd need doesn't exist either.

**The prototype loads a JSON file from disk. That is the entire integration.**

```
res://data/fighter_profile_a.json   → "THE LIFTER"
res://data/fighter_profile_b.json   → "THE STRIKER"
```

A title-screen toggle swaps which one loads. That toggle is the demo.

```gdscript
# One function. The entire app→game surface for the prototype.
func load_fighter(path: String) -> Dictionary:
    var p = JSON.parse_string(FileAccess.get_file_as_string(path))
    assert(p.schemaVersion == 1)
    assert(FileAccess.file_exists(portrait_path_for(p.tier)))  # tier art must exist
    return p
```

### 7b. The wires — eight, not seven

Nothing else in the game may read the profile.

| Profile field | Combat system |
|---|---|
| `derived.strikeDamageMultiplier` | Base damage ×N; also scales hitstop ×(0.7+0.3N), knockback, **and stamina drain (§7c)** |
| `derived.staminaPoolSeconds` | Size of the stamina pool, in seconds-of-continuous-output |
| `derived.staminaRegenPerSecond` | Refill rate, applied only after the regen delay (§7c) |
| `derived.maxComboLength` | Hard cap on cancel-chain links |
| `derived.comboDamageMultiplier` | Damage scaling from link 2 onward |
| `derived.hitXpMultiplier` | Meter gain per landed hit → how fast SPECIAL and ULTIMATE charge |
| `derived.strikeRangeBonus` | Hitbox reach × `(1 + bonus)`. **One multiplier on the `Area2D` extent.** Wire it — it is a 5× spread between the builds (0.022 vs 0.108) and makes BUILD B's teep visibly outrange BUILD A's jab. Dropping it silently would leave Fight Focus with no visible in-game consequence |
| `moveList`, `specials` | Which inputs produce a move vs. a grey `NOT TRAINED` flash |

Secondary (HUD only, no mechanical effect): `level`, `tier` (selects the portrait), `discipline` (selects the special set), `perks`, `weaknesses`, `stats`, `meta.trainingShares` (drives the result-screen attribution lines).

### 7c. The stamina model — the number the contract does not have

**This is the hole that had to be fixed before anything else in the plan was safe.**

The contract defines a **pool** (`staminaPoolSeconds`, 12–60) and a **regen rate** (`staminaRegenPerSecond`, 0.5–3.0) in the same units — and **no drain rate**. Taken at face value, both builds regenerate faster than one unit per second, so **neither could ever gas out**, and the demo's entire emotional beat is impossible. Every claim in §2c, §6c and §10 rests on closing this.

**The model — three rules, no new contract field:**

1. **Drain happens only during attack animations**, at a rate of `strikeDamageMultiplier` units per second of animation. A heavy hitter burns more air per punch. This ties two contract fields together and needs nothing new: a move costs `animationSeconds × strikeDamageMultiplier`.
2. **Blocking costs stamina**: `BLOCK_COST` units per blocked boss swing. Without this, a turtling player never gasses, which breaks the demo for cautious playstyles.
3. **Regen applies only after `REGEN_DELAY` seconds with no attack input**, at `staminaRegenPerSecond`.

That leaves exactly **two game-side constants** — `REGEN_DELAY` and `BLOCK_COST`. They belong to the game, not the profile, and they are tuned by simulation and playtest.

**The simulation, run against the real fixtures.** Three play styles (cautious: 2-hit bursts, 3.0s pauses, blocks 90%; average: 4-hit bursts, 1.6s pauses, blocks 60%; mashing: max-length bursts, 0.5s pauses, blocks 25%), boss swinging every 2.4s, over a 150s horizon. Time to gas-out:

| `BLOCK_COST` (at `REGEN_DELAY` = 1.0s) | A cautious | A average | A mashing | B cautious | B average | B mashing |
|---|---|---|---|---|---|---|
| 0.8 | never | 41s | 21s | never | 130s | 42s |
| 1.2 | never | 36s | 20s | never | 96s | 40s |
| **1.6** | **113s** | **31s** | **20s** | **never** | **77s** | **38s** |

**Recommended: `REGEN_DELAY = 1.0s`, `BLOCK_COST = 1.6`.** At those values BUILD A gasses under every play style, and BUILD B gasses only under sustained mashing — which is a lesson, not a failure. Below `BLOCK_COST` 1.5 a cautious BUILD A never gasses and the demo has a hole.

**Do this in week 1, not week 6.** `game-sync/stamina-sim.mjs` — ~60 lines — is checked in alongside the fixture generator, and its assertion (`BUILD A gasses in all three styles; BUILD B survives cautious and average`) runs in the same command as `demo.mjs`. If a `TUNING` change ever breaks the separation, the test fails instead of the video quietly becoming false.

**If the live pipeline eventually makes a drain rate a first-class contract field**, add `staminaDrainPerSecond` to `fighterProfile.js` derived from a stat rather than hardcoding it in the game. Until then, the model above is the game's, documented, and reproducible.

### 7d. The fixtures — matched on volume, generated not transcribed

Both fixtures are produced by `game-sync/make-fixtures.mjs`, which is checked in and which calls `computeFighterProfile` from the repo's shipped engine. **They are generated, not pasted.** Run it to reproduce them exactly.

**Both builds train exactly 1,200 validated minutes.** An earlier draft claimed "same level, same XP, same streak — nobody can say he just played more" while shipping fixtures at 905 and 1,550 minutes: the striker had trained 71% more, and the engine's `VOLUME_GAIN` log bonus means part of that advantage genuinely *was* extra volume. The one objection the comparison exists to pre-empt was the one it failed to close, one field away from where anyone would look. **Fixed: the only variable is now the distribution of those 1,200 minutes across features.** The versus screen says so: **"1,200 TRAINING MINUTES. BOTH."**

Two notes on fidelity:
- `displayName` is added by hand for the demo UI. **The engine does not emit it.**
- `level` and `tier` are passthrough fields the engine copies from the snapshot; it never computes them. Both are set to **level 7 / `warrior` / 3,200 XP**, which is what the app's own `getLevel()` and `tierIndexForLevel()` produce for that XP. `warrior` is used rather than the contract's `veteran` because **`warrior-male.png` exists on disk and `veteran-*` does not** — see §5a. Fix the contract, not the fixture.

**`fighter_profile_a.json` — "THE LIFTER"**
*Inputs: 1,010 min Workout Builder · 120 min Combat Conditioning · 40 min Quick Mission · 30 min Cardio · 0 fight training · 12-day streak · 1,200 min total.*

```json
{
  "schemaVersion": 1,
  "userId": "demo-lifter",
  "displayName": "THE LIFTER",
  "level": 7,
  "tier": "warrior",
  "discipline": "boxing",
  "stats": { "strength": 100, "stamina": 33, "endurance": 25, "hitXp": 15, "comboMastery": 15 },
  "derived": {
    "strikeDamageMultiplier": 1.8,
    "staminaPoolSeconds": 28,
    "staminaRegenPerSecond": 1.13,
    "hitXpMultiplier": 1.23,
    "strikeRangeBonus": 0.022,
    "maxComboLength": 4,
    "comboDamageMultiplier": 1.09
  },
  "moveList": ["jab", "cross", "shove"],
  "specials": { "slotsUnlocked": 0, "ultimateUnlocked": false },
  "perks": ["GLASS_CANNON", "IN_THE_ZONE"],
  "weaknesses": ["GASSES_OUT", "LIMITED_ARSENAL", "SLOW_RECOVERY"],
  "meta": {
    "totalTrainedMinutes": 1200,
    "trainingShares": {
      "workoutBuilder": 0.8417, "combatConditioning": 0.1,
      "quickMission": 0.0333, "cardio": 0.025,
      "fightFocus": 0, "comboCoach": 0, "practiceMode": 0, "arcade": 0
    }
  }
}
```

`GLASS_CANNON` now fires (it needs `stamina ≤ 35`; the earlier draft landed on 36 and silently lost it — and would have failed `demo.mjs`'s own canonical assertion). It is a free, legible HUD tag next to `GASSES_OUT`, and it is the build's personality in one word.

**`fighter_profile_b.json` — "THE STRIKER"**
*Inputs: 340 min Combo Coach · 300 min Fight Focus · 200 min Cardio · 130 min Practice Mode (8 lessons: jab, cross, lead_hook, rear_uppercut, slip, teep, low_kick, knee) · 120 min Quick Mission · 80 min Training Arcade (11 stages, 2 bosses cleared) · 30 min Workout Builder · 12-day streak · 1,200 min total.*

```json
{
  "schemaVersion": 1,
  "userId": "demo-striker",
  "displayName": "THE STRIKER",
  "level": 7,
  "tier": "warrior",
  "discipline": "muay_thai",
  "stats": { "strength": 21, "stamina": 54, "endurance": 48, "hitXp": 72, "comboMastery": 84 },
  "derived": {
    "strikeDamageMultiplier": 0.93,
    "staminaPoolSeconds": 38,
    "staminaRegenPerSecond": 1.7,
    "hitXpMultiplier": 2.08,
    "strikeRangeBonus": 0.108,
    "maxComboLength": 11,
    "comboDamageMultiplier": 1.5
  },
  "moveList": ["jab","cross","shove","lead_hook","rear_uppercut","slip_counter","teep","low_kick","knee_strike"],
  "specials": { "slotsUnlocked": 3, "ultimateUnlocked": true },
  "perks": ["IN_THE_ZONE"],
  "weaknesses": ["PILLOW_FISTS"],
  "meta": {
    "totalTrainedMinutes": 1200,
    "trainingShares": {
      "comboCoach": 0.2833, "fightFocus": 0.25, "cardio": 0.1667,
      "practiceMode": 0.1083, "quickMission": 0.1, "arcade": 0.0667,
      "workoutBuilder": 0.025, "combatConditioning": 0
    }
  }
}
```

**Why these two.** Same level, same tier, same XP, same streak, **same total minutes** — every difference comes from *what kind of training* was done. The lifter hits for 1.8× and runs out of air at 28 seconds of continuous output, with three strikes and no specials. The striker hits for 0.93× and chains eleven with three specials and an ultimate. Neither is strictly better: the lifter shreds grunts and loses the boss; the striker struggles with the barricade wave and wins. **That asymmetry is the product.** It says: train everything, or the game will tell on you.

### 7e. When to build the real pipeline

**After** the prototype has done its job. Then, in this order. It is longer than it looks, which is precisely why it is not in the prototype.

**0. Decide the anti-cheat boundary — before app XP grants real in-game power.**
XP is 100% client-authoritative today: `userStats.js` computes it in the browser, `cloudSync.js:161-169` mirrors localStorage verbatim to `progress_snapshots`, and the server recomputes nothing. Worse, the audit trail that would justify it — `tm_integrity_log` — is deliberately **not** in `SYNC_KEYS`, so it never leaves the device. A game server has no way to re-verify a claimed session, and anyone can set `tm_user_stats.xp` in devtools. Either accept this in writing ("the game grants cosmetic and stat power from unverified client data, and we are fine with that for now"), or build server-side validation first. Do not discover this after launch.

**1. Record what the engine actually needs — this is three tasks, not one.**
- (a) **Add `activeMinutes` to every session writer.** Today only Cardio records duration (`completedTimeSeconds`). `tm_user_stats.sessions` rows carry a fixed core of `{id, type, completedAt, completedCount, totalCount, xpEarned}` plus a handful of per-mode extras (`difficulty`, `campLevel`, `roundsCompleted`, `lessonTitle`, cardio fields) — **none of which is a duration outside Cardio, a discipline, or a campaign/stage tag.** Every stat in `computeFighterProfile` is driven by per-feature active minutes. Without this, nothing works.
- (b) **Three of the engine's eight features have no app-side source at all.** `workoutBuilder` is recorded as type `'Fit Mode'` (is Fit Mode Workout Builder, or does Builder need its own type? This determines whether the result screen may say "Workout Builder" at all). `practiceMode` has **no session writer whatsoever** — grep returns nothing — so `LIMITED_ARSENAL`, the demo's second-biggest beat, has no live data. `arcade` progress lives in `tm_arcade_v2` as highest-stage-cleared per campaign, with **no `bossStagesCleared` counter** — so the ULTIMATE has no live gate either.
- (c) **Add a discipline and campaign/stage tag** to session rows. Arcade sessions currently launder themselves into generic `'Fit Mode'` / `'Fight Focus'` rows, so a Garou stage-9 boss is indistinguishable from a Quick Mission.

**2.** `feature_sessions` table, RLS own-rows, written from the client on session complete.
**3.** `usage_snapshot` view or RPC.
**4.** A `fighter-profile` **edge function** — `fighterProfile.js` is dependency-free ESM and runs in Deno unmodified. The cheapest of the four.
**5.** Add a `redirectTo` parameter to `signInWithGoogle()` and register a custom-scheme redirect. Today `authClient.js:58` hardcodes `window.location.origin` and Google is the only provider, so a non-web client cannot authenticate at all.
**6.** Give the game a **read-only path** — an edge function or a select-only view. `progress_snapshots` currently grants the owning authenticated user select **and insert and update and delete**, so a game signed in as the player could silently wipe their entire training history. **Never let the game touch that table.**

**What changes in the game when that day comes:** the combat system does not — only the loader is replaced. But budget **~1 week** for the fetch, retry, cached last-known profile, offline fallback, loading/error states, and the auth handoff. That is real work, and describing it as zero would be the same kind of understatement this document just spent a section fixing.

---

## 8. Scope, team and time — three options

Assumptions: hit feel is built first in all three; the stage is THE CITY RUN; the QTE is a stretch goal; "week" means a real working week, part-time weeks are marked; every phase carries **15% slack**, stated rather than hoped for. All figures are estimates; their basis is given.

### Option A — Solo (owner + AI-assisted coding) with asset packs

**Time: 14–20 part-time weeks (12–18 hrs/week ≈ 170–360 hrs) · Cash: $300–1,400**

*An earlier draft said 8–12 weeks. That was 96–216 hours for: learning Godot from zero, a full combat system, profile wiring, a three-screen stage, two enemy waves, grunt AI, a two-phase boss, eight UI screens, an audio pass, a web export with cross-origin headers, a balance pass, playtesting AND a produced video — with zero ramp-up and zero slack. The low end was not achievable by anyone. This is the honest number.*

| | |
|---|---|
| Weeks 1–2 | **Godot ramp-up (~25 hrs, explicitly budgeted)** + boxes punching boxes. Stamina sim written and run. Audio-latency spike on the web export. |
| Weeks 3–4 | Hitstop / knockback / shake / input buffer / cancels tuned until crunchy. **Feel exit criterion met (§6d) before proceeding.** |
| Weeks 5–6 | Profile loading, the eight wires, BUILD A/B switcher, move gating, gassed state |
| Weeks 7–10 | Asset-pack art dropped in and palette-unified to `Styles.js` (6–10 hrs); stage built; two enemy waves; boss with two phases per §6c |
| Weeks 11–13 | HUD / boss bar / combo counter ported from `game-ui-kit/` (**strings replaced**); result screen; audio pass |
| Weeks 14–15 | **Balance pass (§6c acceptance test)** |
| Weeks 16–18 | Web + desktop export, playtesting, **demo video capture and edit (3 days)** |
| Weeks 19–20 | Slack |

**Produces:** a genuinely playable, genuinely crunchy 4-minute stage where the stat hook works, on borrowed art that doesn't quite match. Good enough to recruit a developer, convince a co-founder, and run the §2a test. **Not** good enough for a publisher pitch or a Steam page.
**Cash:** asset packs $150–400 · audio $0–200 · Aseprite $20 · AI tooling $0–200 · capture/edit software $0–300 · hosting $0 · misc $100–300.
**Main risk:** you are the art director, the programmer and the producer. Failure mode is week 8, when the boxes work and the pull to start drawing beautiful sprites instead of finishing the stage becomes overwhelming.

> **Option A's unstated premise, stated.** This plan assumes the owner can read a stack trace, step a debugger, and get unstuck when an AI's output doesn't work. **If that is not true, Option A is not 14–20 weeks — it is indefinite**, because day 4's hitstop tuning is the kind of problem that cannot be prompted around. If it is not true, skip to Option B and pair the artist commission with a part-time contract programmer. Answer this honestly before spending week one.

### Option B — Owner + one contract pixel artist — **RECOMMENDED SECOND STEP**

**Time: 16–20 weeks (owner part-time; artist ≈ 235 delivered frames + 2 design sheets) · Cash: $4,200–13,000, plan ~$7,500**

| | |
|---|---|
| Weeks 1–5 | Owner: feel prototype, greybox stage, profile wiring. Artist (parallel): **milestone 1** — protagonist design sheet + turnaround, approved before anything else is drawn; then **milestone 2** — jab / cross / idle / walk, approved |
| Weeks 6–11 | Artist: **milestone 3** — full player set (~140 frames); then **milestone 4** — boss (~95 frames). Owner: enemy AI, waves, boss phases per §6c, UI |
| Weeks 12–14 | Artist: background + VFX (or AI-assisted + clean-up). Owner: integration, result screen, audio |
| Weeks 15–16 | **Balance pass (§6c acceptance test)** |
| Weeks 17–18 | Polish, playtesting, web + desktop builds, **demo video (3 days)** |
| Weeks 19–20 | Slack |

**Produces:** a true **vertical slice** — one stage at final quality with your actual characters. This is what you show to get funding, partners and press. Grunts can stay asset-pack art with a palette pass; nobody looks at grunts.
**Cash:** hybrid art $3,905–12,260 (§4e) + tooling/hosting/capture ~$300–700.
**Note:** `04-HOW-THE-GAME-GETS-BUILT.md` step 3 defines the vertical slice with **Mike Bison** as the boss, and `07-MASTER-CHECKLIST.md:52,66` still lists Stage 1 as a **gym interior**. Both predate the 2026-08-09 CITY RUN / FLEX lock. **Amend those two docs with one line each** before handing anything to a developer, or they will build the stale spec.
**Why this is the recommended second step:** the art gap is the repo's single biggest hole (zero animation frames), the owner's superpower is art direction rather than animation throughput, and one good contract artist closes it for less than a used car. Option A proves the idea to you; Option B proves it to everyone else.

### Option C — Small studio / contract team

**Time: 16–22 weeks · Cash: $35,000–90,000 (estimate, based on 1 FT programmer + 1 FT animator + 1 PT background artist at prevailing contract rates for 4–5 months)**

Team: 1 gameplay programmer (FT), 1 pixel artist/animator (FT), 1 background artist (PT), audio contracted, owner as creative director.

**Produces:** a trailer-grade vertical slice with both protagonists, 3–4 enemy types, two bosses, full audio, the workout-pop-up QTE, controller/keyboard/Steam Deck support, and a Steam page. Publisher-pitchable and Kickstarter-ready.
**When it's right:** after A or B has proven the hook to five strangers, and you're deploying raised money rather than savings. **Do not start here.** Spending $50k to discover the hook doesn't land is the expensive version of a $400 experiment.

### The recommendation — and it is one recommendation

**Do A, then B.**

Spend 14–20 part-time weeks and under $1,400 to get a playable stage with the BUILD A/B switcher on pack art. Run the §2a test. If it passes, commission the artist and roll straight into B **using the same codebase** — none of the A work is thrown away, only the art is replaced. If it fails twice, you have learned that for $1,400 instead of $50,000.

*(An earlier draft labelled B "RECOMMENDED" and then closed with "do A, then decide", leaving the reader unsure what was actually being recommended. It is A-then-B.)*

**Engine freeze date.** §3 says to switch to Unity if a Unity developer appears — which would discard all of Option A. So: **the engine is frozen at the end of feel week (week 4).** A Unity dev who turns up after that joins a Godot project or doesn't join.

### Costs and risks the plan must carry

**Artist sourcing and contracting.** Option B rests entirely on one contractor. Before committing:
- **Vet with a paid test.** Pay for a single 5-frame jab against your STYLE BLOCK before signing anything. It costs ~$100 and tells you more than any portfolio.
- **Milestone payments**, per the four milestones above. Never pay the full sum up front.
- **Kill fee** defined in writing for each milestone.
- **Written work-for-hire / IP assignment.** In a document that flags IP risk four times, the worst outcome would be paying for 235 frames and not owning them.
- **Contingency for the artist going dark mid-contract** — the single most common failure of an owner-plus-one-contractor project. Milestone payments cap the loss; a second vetted artist on standby caps the delay.

**Version control for a project with binary assets.** Separate repo (§11). Use Git LFS for sprite sheets, audio and `.blend`/`.aseprite` sources from the first commit — retrofitting LFS is painful. Keep exported builds out of the repo. Define how the artist delivers (a shared drive folder → owner commits, rather than giving a contractor repo write access).

**Playtest logistics.** §2a needs 5 strangers × ~10 minutes each. On a desktop-only build. Decide *now*: your own laptop, in person, at a gym or a café, scheduled — not "I'll find people later." Recruiting is the step that silently slips.

**Legal and brand, unanswered.** Can the game use the TRAINING MODE name and branding? Is the mark registered? **What is the game even called?** And once real training data is displayed, is there any privacy obligation? This document handles asset IP and has nothing to say about product IP. Somebody should.

### Technical acceptance criteria

The §2a test checks the hook. Nothing currently checks the build. These do:

| | Target |
|---|---|
| Frame rate | Locked 60 fps at 1280×720 on a 2019-era laptop with integrated graphics (the stated demo venue) |
| Input → hit sound | **< 40 ms** measured on the web build in Chrome and Safari. Above that, punches feel mushy and §2's hard gate fails |
| Web payload | ≤ 45 MB, with a loading screen |
| Browser matrix | Desktop Chrome, Edge, Firefox, Safari. **Phones explicitly unsupported** (§3) |
| Gamepad | Xbox-layout pad + keyboard fallback; "press any button" gate on the title screen |
| Crash budget | Zero crashes across the §6c balance-pass runs (16 playthroughs) |

---

## 9. Accessibility and safety

Cheap, and easy to skip until it embarrasses you in front of a room.

- **Cap full-screen flashes at 3 Hz.** §6a calls for a white flash on heavy hits and a 16-frame flash on the ultimate; at beat-'em-up hit rates that is a photosensitivity risk. Rate-limit the flash independently of the hit rate.
- **The gas-out must be legible without colour.** §2c's red flashing bar is *redundancy*, not the signal. The animation change, the breathing audio and the `GASSED` text tag carry it. Anyone with red-green colour deficiency should still read it instantly.
- **Check contrast at the two places numbers are read on camera**: the stat bars on the versus screen and the result-screen attribution lines. Gold `#fde047` on `#080012` is strong; gold on violet `#a855f7` is not.
- **No screen shake option.** Not for the prototype — but note it as a known omission so nobody thinks it was overlooked.

---

## 10. The demo script — 90 seconds, on camera

The prototype's job is fundraising and recruiting, which makes the **video** the deliverable and the playable build the proof behind it. Shoot one take per build, cut together. No voiceover during gameplay — let the screen talk. Captions only. **Budget 3 days and $0–300**, which is now a line in all three options.

| Time | On screen | Why |
|---|---|---|
| **0:00–0:06** | Black. White text, one line at a time: "A beat-'em-up." / "Your character is levelled by your real workouts." / "Not by playing." | The hook stated flat, before anything distracts from it |
| **0:06–0:12** | Title screen. Cursor hovers **BUILD A — THE LIFTER** / **BUILD B — THE STRIKER**. Selects A. | Plants the device. The viewer knows a comparison is coming |
| **0:12–0:20** | Versus screen. `SIMULATED PROFILE` tag visible. BUILD A: STRENGTH **100**, STAMINA **33**, STRIKES **3 / 19**. Tags: `GLASS_CANNON`, `GASSES_OUT`. Footer: **"1,200 TRAINING MINUTES. BOTH."** Caption: *"This log is all Workout Builder. No cardio."* | The profile made visual, with the volume control stated on screen so the obvious objection never forms |
| **0:20–0:38** | Two grunts **deleted** — one hit each, huge hitstop, heavy shake, bodies off screen. Caption: *"Damage ×1.8."* Then HEAVY is mashed: grey flash `NOT TRAINED — PRACTICE MODE`. Caption: *"3 strikes. No striking training."* | Power fantasy, then the locked door, in eighteen seconds |
| **0:38–0:56** | FLEX appears, boss bar fills, phase 2 at 50%. **Both fighters wilt.** At ~0:31 BUILD A's stamina hits zero and flashes red, `GASSED` tag appears, the fighter visibly slows (gassed idle, hands down, frame data ×1.45). He eats a shoulder charge. **KO.** Caption: *"He ran out of air first."* | **The most important eight seconds.** The failure is diegetic, legible and earned — and the mirror makes it about air, not about the boss being stronger |
| **0:56–1:00** | Result screen: **RANK C** · DEFEATED. Three third-person lines: *STRENGTH 100 — FROM WORKOUT BUILDER* / *STAMINA 33 — NO CARDIO. Gassed at 0:31* / *STRIKES 3 OF 19 — PRACTICE MODE UNLOCKS THE REST* | The game diagnoses the training. This is what a coach leans forward at |
| **1:00–1:04** | Hard cut to the title screen, silent. Toggle flips to **BUILD B**. Caption: *"Same level. Same XP. Same 1,200 minutes. Different training."* | The turn. Four seconds, no fat. The claim is now true |
| **1:04–1:14** | Versus: STRENGTH **21**, STAMINA **54**, COMBO MASTERY **84**, STRIKES **9 / 19**, **ULTIMATE UNLOCKED**. Gameplay: an 11-hit chain — jab, cross, hook, low kick, teep, knee — combo counter climbing in gold. Caption: *"Combo Coach. Fight Focus. Practice Mode."* | Visibly a different game, same buttons |
| **1:14–1:26** | Boss phase 2. Stamina holds. Meter fills fast (`hitXpMultiplier 2.08`). **ULTIMATE** — cut-in, 16-frame flash, slowmo, KO burst. FLEX down. **RANK S.** | The payoff, and proof the asymmetry is real rather than a difficulty slider |
| **1:26–1:32** | Result screen, then black. Two lines: *"This is our stat engine, running on a training log."* / *"The engine is real and runs today. The connection to your account is next."* Then: **TRAINING MODE — apptrainingmode.com** | Ends on a claim the product can keep |

**Shooting notes.** 1080p60, **captured at 60fps** — hitstop and screen shake do not survive 30fps and the entire feel argument dies with them. Clean game audio, no music bed over the top. HUD visible at all times. The cut at 1:00 is hard and silent; a beat of nothing makes the comparison land.

**Second asset, same day:** a 15-second vertical cut of the gas-out and the ultimate, for social. That's the piece that travels.

**Distribution plan — decide before you shoot.** Where does the link live (a one-page site? a Notion? unlisted YouTube?). Who are the first ten people it goes to, by name. What does a "yes" look like from each of them — a developer joining, a coach piloting it with clients, an investor taking a second meeting. A video with no list of recipients is a hobby.

---

## 11. What would make this fail

Blunt list. Each has killed a project like this one.

**1. Scope creep into a full game.** 8 campaigns, 80 authored stages, a boss roster brief, a story outline, 71 badges — a genuinely intoxicating amount of designed content. Every one will whisper "just one more stage." **One stage. One boss. One character.** Write it on the wall. `docs/game-concept/` is a production backlog, and touching it before the slice ships is the most likely way this dies.

**2. Building the backend first.** The most seductive trap, because it feels like real engineering. §7e shows it is *seven* steps, not one — and three of the engine's eight features have no app-side data source at all. That is a full quarter, and at the end of it you have zero seconds of playable footage. **The prototype loads a JSON file.**

**3. Letting the demo imply a live data connection.** The failure mode §2b exists to prevent. A `SIMULATED PROFILE` tag costs one label. Saying "every stat came from a real training session" over fixture data, to the exact people whose trust you most need, costs everything.

**4. Chasing 3D.** It looks cheaper than it is because assets are downloadable. Then you need rigging, retargeting, lighting, cameras, collision and an animator who costs three times a pixel artist. Your entire visual identity — `Styles.js`, the poster art, the UI kit, the stated references — is 2D pixel. No version of this is faster, cheaper, or more on-brand in 3D.

**5. Building the stage before the hit feel.** You'll get a beautiful stage that feels like moving a sticker around, and then you'll be reluctant to make the deep combat changes that fixing feel requires, because they'd mean redoing the stage. **Boxes first. The stage is the last thing you build.**

**6. Drawing finished sprites before the feel is locked.** Frame data will change five times during feel week. At $10–30 a commissioned frame, each change costs hundreds and a week of turnaround. **Lock §6b, then commission against it.**

**7. Making both protagonists.** Doubles the most expensive line item to prove nothing new.

**8. Letting the app's content define the game's content.** The 272-combo pool, the 77 Practice techniques, the 80 arcade stages and the 12 archetypes are a **vocabulary**, not a spec. There is **zero combat mechanics data** in the repo — no frame data, no hitboxes, no damage values, no cancel rules, no knockback vectors. "Implement all 272 combos" is a year of work that makes the game worse. Nine moves.

**9. Shipping the IP-risk art.** Five campaign files flag their own banners. Nine of thirteen posters are franchise-derived. **And MIKE BISON is hardcoded in five files of the UI kit §11 tells you to copy** — a Street Fighter / Tyson portmanteau on the boss bar of a fundraising demo. Grep before the artist starts.

**10. Perfectionism about hit feel with no exit criterion.** The opposite failure. §6d's timebox is three weeks and its exit test is written down. Use it.

**11. No playtest until the end.** Put the boxes build in front of one person in week 3. Ninety seconds of watching a stranger's hands teaches more than three more weeks of solo tuning.

**12. Balancing the demo so BUILD A wins.** Subtle and fatal. If both builds beat the boss, you've built a character-select screen instead of a thesis. **BUILD A must lose, 8/8.** Protect it.

**13. The gas-out reading as "unfair" instead of "illuminating."** The real risk on the other side of #12. Forced-loss playtests commonly produce *"this game cheated me"*, not *"I skipped cardio."* Three mitigations, in order of preference: **(a)** FLEX gasses too, so the loss is about air rather than about the boss being tuned to win (§6c — this is the primary fix); **(b)** let BUILD A destroy the grunt waves spectacularly so the loss lands after a genuine power fantasy, not on top of frustration; **(c)** if playtesters still read it as unfair, offer an immediate rematch on BUILD B rather than a game-over — the switch *is* the lesson. If none of the three work, that is a §2a disconfirming outcome, not a tuning problem.

---

## 12. First two weeks, concretely

If the answer is yes, this is Monday.

1. **Install Godot 4.x and Aseprite** (~$20). Create `trainingmode-game/` as a **separate repository** with Git LFS configured from the first commit. Do not put a game project inside the PWA repo.
2. **Copy three things across:** the palette tokens from `components/training-mode/Styles.js`; `game-ui-kit/` as a **layout and CSS reference only** — and immediately `grep -ri bison` and strip every character name (§4c); and `docs/game-concept/05-ART-PROMPTS.md` as the art brief.
3. **Commit `game-sync/make-fixtures.mjs` and `game-sync/stamina-sim.mjs`** into the PWA repo, add their assertions to `demo.mjs`, and generate `fighter_profile_a.json` / `_b.json` into the game repo. The fixtures are now reproducible by a command, and a `TUNING` change fails CI instead of quietly falsifying the video.
4. **Day 1–4:** Godot ramp-up. A box that walks on a depth-sorted floor and throws a jab with a visible debug hitbox.
5. **Day 5:** hitstop. Tune it for an hour. This is the day you'll know whether you enjoy this.
6. **Day 6–9:** knockback, hitstun, screen shake, one placeholder impact sound, input buffer, light→light→light chain.
7. **Day 10:** **audio-latency spike.** Export to web, measure input-to-hit-sound in Chrome and Safari. If it's over 40 ms, decide now whether the desktop build is the primary demo or whether you pool/pre-load audio streams. Do not discover this in week fourteen.
8. **Day 11–12:** a second box that fights back. Two boxes, hitting each other, crunchily.
9. **Day 13:** load `fighter_profile_a.json`. Wire `strikeDamageMultiplier`, `maxComboLength` and the stamina model. Switch to `_b.json`. **Feel the difference with zero art.**
10. **Day 14:** show one person. Say nothing. Watch their hands. Write down what they said, and answer §13's decision zero.

If step 9 gives you a chill, this project works. If it doesn't, you've spent two weeks and $20 finding out — a spectacularly good trade.

---

## 13. Open decisions only the owner can make

**0. What is this demo FOR?** Ahead of everything else, because three sections depend on it. *A fundraising and recruiting artifact* — which is what this plan assumes — or *a Pro-tier conversion feature inside the PWA*? If the latter: Phaser wins outright (§3), touch input moves from out-of-scope to mandatory (§1), asset-pack licensing becomes a shipping-to-paying-customers problem rather than a pitch-meeting one (§4e), and you would also need a fourth paywall gate and `PAYWALL_ENABLED` flipped, neither of which exists today.

**1. Can the owner program?** Option A's premise. If no, Option A is indefinite, not 14–20 weeks (§8).

**2. Which protagonist** ships in the slice — male or female. One. Not both.

**3. Which discipline** for the striker build. **Recommend `muay_thai`**: the most visually distinct move set (teep, knee, spinning back elbow as the special, flying knee as the ultimate) against the lifter's boxing. Note the slug mismatch in §5a before wiring `ADVANCED_STRIKES`.

**4. Confirm CITY RUN and FLEX**, and amend the two stale docs. `04-HOW-THE-GAME-GETS-BUILT.md` step 3 names Mike Bison as the slice boss; `07-MASTER-CHECKLIST.md:52,66` still lists Stage 1 as a gym interior. Also delete or demote the competing "bar-athlete champion" boss at `08-STAGES-WEAPONS-MINIGAMES.md:68` so the artist and the writer build the same character.

**5. FLEX's name and face.** *(An earlier draft claimed this boss was unwritten. He isn't —* `09-STORY-SCRIPT.md:35-44` *gives him a name, a design note and three lines, including "Bro. BRO. I love you. But I can't let you pass without a pump check. It's the CODE."*) The open questions are narrower: is **[FLEX]** the final name (it's bracketed as a placeholder), and what does he look like? He needs a face before the artist starts. The trash talk is done.

**6. Own the mapping table** (§5a) — tiers, discipline slugs, strike tokens, feature names. One file, one named person, before two codebases disagree in public. Start by amending the `tier` `@typedef` in `game-sync/fighterProfile.js:41` and `demo.mjs` to the app's ladder, since the app's art is what exists.

**7. Who owns `public/static/` art**, and do the commission terms extend to a separate commercial game product (§4c item 4)? One email. Answer it before copying those files.

**8. Option A first, or straight to B** — a funding-*timing* question, not a strategic one. The strategy is A-then-B (§8); the only question is whether the ~$7,500 is available now or must be raised by the demo itself.

---

## 14. Two things worth knowing about the repo before anyone builds on it

**`protocol/` is vendored twice and has drifted.** `protocol-src/` (the upstream source of truth, with `INTEGRATION.md`, `DESIGN-SPEC.md` and 15 specs) and `components/training-mode/protocol/` are separate copies. `reaction-mode.json` exists only in `protocol-src/`; `workout-modules.json` only in the app copy; the engine filename differs (`training-engine.ts` vs `trainingEngine.ts`). Both hold all eight campaign directories and both carry the five `art_note` IP flags. **If the game ever consumes `protocol/` content, declare which copy is canonical and add a CI sync check** — the engines are genuinely framework-free and directly consumable by a non-React client, which makes this worth fixing rather than working around.

**`GameLink.jsx` is pure copy today.** No auth handoff, no link code, no account binding, no API call. Its three benefit strings promise "Workout XP → in-game stat points", "Unlocked avatar tiers appear in-game", and "Exclusive skins from training streaks" — the third has **no data model anywhere in the repo**. When the demo exists, that screen is the natural place to put it. Until then, be aware the app is already promising something a little ahead of what it has.

---

**Bottom line.** One stage, one opponent, one character, one background, nine moves, two generated JSON fixtures, two stamina constants and a toggle. Three weeks of making a box punch well, eight or nine of building the stage around it, a named balance pass to make the loss land every time, and either ~$1,400 of asset packs or ~$7,500 of a real artist depending on who the demo is for. The hook is already written, already coded and already tested — `node game-sync/demo.mjs` passes today. What was missing was a body to put it in, and a drain rate. The drain rate is now solved and simulated. The body is the next fourteen weeks.