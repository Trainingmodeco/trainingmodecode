# Fight Mode revamp — build checklist

Working plan for the Fight Mode overhaul. We build **one item at a time, in
order** — later items depend on earlier ones. Check items off (`[x]`) as they
ship. Nothing here is built yet.

> The user will implement **most but not all** of these — confirm each item is
> still wanted before starting it.

**Build rules (apply to every item):**
- Match existing design tokens: Orbitron/Rajdhani, gold `#fde047`, violet
  `#a855f7`, danger red, existing card style.
- Reuse the existing ring timers and the shared Mission Complete flow — do
  **not** fork new versions of screens that already exist.

---

## LIVE-TESTING FIXES (from the user's real-device testing — build in order,
## one at a time, BEFORE resuming the phases below)

- [x] LT-1 AUDIO MIX — **CUE-BOOST ONLY for now** (user decision Jul 20).
      A web PWA cannot duck another app's audio (the music burying cues in
      testing was the phone's own Spotify/Apple Music), so this pass makes
      the app's own voice as loud and clear as possible:
      · Raise cue gain: voice/bells/beeps at 90–100% of master, boosted
        over the current mix; ensure nothing else competes.
      · Speaker icon on every ring-timer screen → compact overlay with a
        🔊 VOICE slider (MUSIC slider hidden until in-app music exists),
        adjustable mid-session WITHOUT pausing, auto-dismisses after 3s,
        persists as the new default.
      · Setup screens: replace the voice on/off toggle with an AUDIO row
        showing the cue level; one-time "Voice cues are off" hint if 0.
      · Practical note for users: phone music should be turned down by the
        user — we can't touch it from the web.
      SHIPPED (Jul 20):
      · audioEngine defaults now put voice AND sfx at full master (was
        sfx 0.9). A one-time versioned migration (v:2) boosts mixes saved
        before this, without clobbering a level the athlete chose later.
        BUG CAUGHT IN TEST: the first cut read the version off the MERGED
        settings, and since DEFAULTS carries v:2 the migration never ran
        for anyone — it now reads the version off the STORED object.
      · shared/VoiceMixer.jsx — speaker button top-right of every ring
        timer (Combo Coach, Fight Focus, Combat Conditioning). Tap → 🔊
        VOICE slider, auto-hides after 3s, persists, and does NOT pause.
        No MUSIC slider (nothing to fade until the Pro music player).
      · shared/AudioLevelRow.jsx — AUDIO row on the three setup screens
        showing cue level, with an explicit "Voice cues are off" state and
        an honest note that phone music must be turned down on the phone.
      VERIFIED live: mixer opened mid-round at 02:05 with combos still
      firing; slider → 55 persisted to storage and the very next call-outs
      carried volume 0.55; panel self-dismissed; migration turned a seeded
      0.9/0.8 mix into 1.0/1.0 on load.
- [x] LT-2 RUSH MODE VOICE — stop repeating "rush mode go".
      · Activation once: "RUSH MODE — GO!" + riser sting + orange ring.
      · Then a shuffled motivational pool (~every 8–10s, no immediate
        repeats): "Give it everything you've got!" / "Strike hard and
        fast!" / "Empty the tank!" / "Push the pace — faster!" / "Don't
        slow down now!" / "Finish strong!" / "Hands up — keep firing!" /
        "Leave nothing behind!"
      · After rush (if session continues): "Rush mode complete." + normal
        ring; if rush ends at the final bell, skip the line — just bell.
      · Pool = simple string array; cues never talk over combo call-outs
        (wait until the call finishes).
      SHIPPED (Jul 20):
      · data/rushVoice.js — "Rush mode — go!" once on activation (+ a
        synthesised riser sting, playRiser(), no new asset), then a
        SHUFFLE-BAG of the 8 push lines every 8–10s: every line is heard
        before any repeats and a reshuffle never puts one back-to-back.
        "Rush mode complete." only when the session continues; at the
        final bell the bell speaks for itself.
      · Wired into Combo Coach and Fight Focus. Cues are skipped while a
        combo is mid-call and during the last-10s number countdown, then
        retried on the next tick.
      VERIFIED: 7500 simulated draws → 0 immediate repeats, all 8 lines
      even (929–943 each), delays all within 8–10s. Live session recorded
      via speechSynthesis: "rush mode — go!" exactly once, old "Rush! Go!"
      gone, one pool line ("leave nothing behind!") between combos, clean
      10→1 countdown with ZERO pool lines over it.
- [x] LT-3 WARM-UP TIMER — new setup option on Fight Focus, Combo Coach,
      Combat Conditioning (NOT Practice/Drill It).
      · Setup row "WARM-UP": OFF · 5 · 10 · 15 · 20 MIN pills (gold
        selected); remembers last choice per feature.
      · Session opens in a WARM-UP phase on the same ring timer before
        round 1: teal/green ring (distinct from red WORK / blue REST),
        large countdown, "WARM-UP · STRETCH & GET LOOSE", voice cue at
        start + halfway, last-10s flash + beeps, then bell → 3-2-1 →
        round 1. One tap starts everything.
      · "SKIP → START" button visible during warm-up.
      · Motion-gate exempt (like rest), no XP, doesn't count toward
        strike/round stats.
      SHIPPED (Jul 20):
      · shared/WarmupRow.jsx — OFF · 5 · 10 · 15 · 20 pills, teal, saved
        PER FEATURE (tm_warmup_<feature>) since a warm-up before Combat
        Conditioning is a different habit than before Combo Coach.
      · shared/WarmupTimer.jsx — teal ring on the same geometry as the
        work timers, big countdown, "WARM-UP · STRETCH & GET LOOSE",
        5 MIN / NO XP chips, last-10s flash + beeps, bell at zero, and
        the VoiceMixer so cue level is adjustable here too.
      · shared/WithWarmup.jsx — wraps the session in ScreenRouter instead
        of adding a phase to three different state machines. children is
        a JSX element, so the session's timers/voice don't start until
        the warm-up hands over. Skipped when resuming a paused session.
      · No XP, no rounds, no integrity — nothing to motion-gate.
      VERIFIED live (5-min warm-up, clock time-warped in the harness so
      the real completion path ran, not just SKIP): 05:00→00:00, opening
      cue, halfway cue at 2:30, "warm up complete. here we go.", then
      auto-handoff → 3-2-1 → ROUND 1/3 at 03:00. SKIP → START jumps
      straight in. Setting persisted and was remembered on return.
- [ ] LT-4 SHARE FIX — share a rendered IMAGE, never plain text.
      · Card image: dark app bg, avatar tier art prominent, "MISSION
        COMPLETE" header, session summary, stats row (LEVEL · 🔥 STREAK ·
        SESSIONS), XP, trophies strip, VERIFIED shield when integrity
        passed, logo + handle footer.
      · Two formats with preview toggle: STORY 1080×1920 (IG-safe
        margins) · POST 1080×1080; preview IS the rendered image.
      · Targets (hide if app not installed): INSTAGRAM Stories · FACEBOOK
        Stories → feed fallback · TIKTOK Share Kit → SAVE + toast
        fallback · native SHARE sheet with image attached · SAVE to
        photos. Render on demand with shimmer; never placeholder art.
      ⚠ PWA CONSTRAINT: direct IG/FB/TikTok SDK integrations are
        native-app mechanisms. Web build delivers: real canvas-rendered
        image + preview + native share sheet with the image file + SAVE.
        Deep links can OPEN those apps but can't attach the image from
        web — full Stories/TikTok integration lands with the native
        wrapper. Fallbacks above cover it meanwhile.
- [x] LT-5 OUTCOME SCREENS TOO TALL — Mission Complete / SESSION STOPPED /
      GOOD EFFORT and every other outcome screen must fit WITHOUT
      scrolling, with ~10–15% clear space at the bottom.
      · Crunch the stack: smaller badge art, tighter section gaps, merge
        or shrink the stat blocks (VALID ROUNDS / XP / LEADERBOARD and
        ROUNDS / MINUTES overlap conceptually), condense Round Recap.
      · Move SHARE higher — directly above or below YOUR PROGRESS rather
        than buried at the bottom.
      · Applies to: Fit/Quick Mission/Combat Conditioning completes,
        Fight Focus SessionSummary, arcade stage clear.
      SHIPPED (Jul 20). What actually changed:
      · Root cause of the scrolling wasn't only height — MissionComplete
        wrapped itself in minHeight:100dvh + its own 12dvh scroller INSIDE
        ScreenRouter, which already reserves 110px under every screen for
        the tab bar. That double-count made the screen scrollable past its
        own content. Removed; the shell is now the only scroll container.
      · XP hero card + stat grid merged into ONE row: XP EARNED · ROUNDS ·
        MINUTES (every mode passes exactly 2 stats, so it's always 3-up).
      · Integrity banner: XP column dropped (duplicated the XP card),
        stats + completion bar merged into one block, icon tile removed.
        On a fully-valid session it now collapses to a single line
        ("🏆 MISSION COMPLETE — All rounds verified"); the full forensic
        breakdown still renders for partial / too-fast / failed.
      · Round recap: one tight line per round, capped at 3 + "+n more
        rounds completed" so a 12-round session can't blow the layout.
      · SHARE moved above the CTAs, directly under YOUR PROGRESS, and runs
        a tighter inline variant (no subtitle, smaller icon/buttons).
      · Hero badge 122→60px, plus a pass over every font/gap/CTA height.
      · ScrollDownIndicator was firing on EVERY screen because scrollHeight
        includes the reserved tab-bar padding — now measures real content,
        so the chevron no longer invites a scroll to nowhere (app-wide fix).
      · @media (max-height:740px): on iPhone-SE-class phones the recap/chips
        and the beta-feedback link drop out and the badge shrinks, so the
        CTAs stay above the tab bar there too.
      MEASURED at 375×812: MISSION COMPLETE content ends 627px, tab bar at
      750px → 123.6px clear (15.2%). SESSION STOPPED → 139px (17.2%).
      Worst case (12 rounds, 3-row recap + "+9 more") → 687px, still clear.
      At 375×667 (SE): 568px vs tab bar 606px — fits, nothing clipped.

---

## LATER — IN-APP TRAINING MUSIC (Pro perk; unlocks true ducking)
User decision Jul 20: build this AFTER the LT queue and monetization.
Once the app plays its own music, real hard-ducking (music → 20% under
every cue) becomes possible and the 🎵 MUSIC slider returns.
- [ ] Music player + per-phase playlists (warm-up / work / rush / rest)
- [ ] Restore MUSIC slider in the mixer + hard ducking (<50ms attack,
      ~400ms release), bells/beeps duck too
- [ ] Gate music behind Pro (free tier keeps cues only)
HOW MUCH TO MAKE (guidance):
  · Minimum viable: 6 seamless loops × 2–3 min ≈ 15 min unique audio.
  · Good launch: 10–12 tracks ≈ 30 min — enough that a 12-min session
    never repeats and back-to-back sessions feel fresh.
  · Cover 4 moods: WARM-UP (calm build) · WORK (driving, steady BPM ~140
    –150 to match cadence) · RUSH (aggressive, ~160+) · REST (ambient).
    2–3 tracks per mood.
  · Encode 96–128 kbps mp3/m4a (~1.5–3 MB per track). LAZY-LOAD/stream —
    do NOT bundle into dist (it's already ~69 MB).
  · Must be royalty-free/owned with commercial rights (a paid app makes
    licensing non-negotiable).

---

## PHASE 1 — FOUNDATIONS (everything else builds on these)
- [x] 1.1 Practice Mode completion loop: finishing DRILL IT marks a lesson
      done ✓, advances the lesson unlock chain, and adds the strike to the
      user's learned "arsenal" (persisted per discipline).
      → data/arsenal.js (canonical strike tokens, per-discipline persistence,
        name→strike normalizer); wired into PracticeMode basics + technique
        drills with a "STRIKE ADDED TO YOUR ARSENAL" toast. Verified: Jab/Cross
        bank, Stance/Guard/Defense bank nothing.
- [x] 1.2 Combo Coach ← arsenal link (REVISED per user): BEGINNER LEARNERS
      (new + "learn combat basics") are LOCKED to 🔒 BASIC MODE — no ALL
      STRIKES escape hatch — with a "YOUR ARSENAL: n" chip and the subtitle
      "Calling basic strikes plus ones you've learned through Practice. Do
      more Practice Mode training to unlock combos." Experienced users see NO
      gating UI at all (full pool, no toggle).
      → Starter basics so beginners aren't hostage: Boxing Jab/Cross/Hook/
        Uppercut · Kickboxing +Rear Roundhouse · Muay Thai +Rear Knee · MMA
        all of it (sprawl/footwork/defense are movements, never gated).
        getEffectiveArsenal = starter ∪ Practice-learned. Filtering ignores
        non-strike movements and never leaves a session empty. Verified both
        views live.
- [x] 1.3a Combo Coach upgrades (REVISED per user) — defense is EMBEDDED
      automatically, no toggle: TECHNICAL every 2–3 calls (most defense);
      COMBO Easy ~3 · Normal ~4 · Hard ~5 · Advanced none standalone (defense
      already lives inside advanced combo text). Calls render violet #a855f7
      (SLIP/ROLL/PIVOT, +CHECK kick sports, +SPRAWL MMA), snappier window,
      never during Rush. NO stance setting — instead a "Southpaw Round" card
      joined every discipline's Fight Focus rotation (all difficulties).
      YOUR ARSENAL chip removed (Basic Mode chip is enough); setup page keeps
      ~15% clear space at the bottom. Verified live: SLIP! violet auto-fired
      in a Normal session with no toggle.
- [ ] 1.3b Custom combo builder with saved combo chips (the bigger half —
      still to do).
- [ ] 1.4 Strike counter pipeline: accelerometer sampling during WORK phases,
      high-pass filter, magnitude peak detection with ~200ms refractory
      window, adaptive threshold. One shared module used by every Fight Mode
      feature. Live "STRIKES" HUD counter + placement hint sheet.
- [ ] 1.5 Fight Mode stats: STRIKES THROWN · ROUNDS · BEST STREAK row on
      Mission Complete; lifetime totals persisted for trophies/ghosts.
- [ ] 1.6 Anti-cheat wiring: strike counter feeds the integrity evaluation
      (strikes verify effort; low count = soft flag only; stationary device
      falls back to plain motion gate).

## PHASE 2 — PROGRESSION (the retention layer)
- [ ] 2.1 Session recipe format + runner: a camp session = JSON list of
      blocks (lesson / fightFocus / comboCoach / conditioning) chained with
      transition cards, ending in the normal Mission Complete flow.
- [ ] 2.2 TRAINING CAMP map screen: 12 nodes, phase labels (FUNDAMENTALS /
      BUILDING / CONDITIONING / FIGHT SIM / TITLE FIGHT), node states,
      session detail cards, saved cursor {discipline, tier, sessionIndex}.
- [ ] 2.3 TITLE FIGHT session + "TITLE FIGHT WON" outcome screen; camp
      completion → CAMP CHAMPION trophy + bonus XP → offer next camp/tier.
- [ ] 2.4 Home integration: active camp drives Today's Bout ("TRAINING CAMP
      · SESSION n").
- [ ] 2.5 Fight Mode trophies live: CAMP CHAMPION · COMBO MACHINE · SCHOLAR
      OF THE SWEET SCIENCE · IRON ROUNDS, wired to real events.

## PHASE 3 — DIFFERENTIATORS (competitive layer; needs Phase 1)
- [ ] 3.1 REACTION MODE: opponent windup cues → defense calls → motion-
      verified reactions, PERFECT/GOOD/HIT grading, HP bars, counter-combo
      windows, KO/decision outcomes, avg-reaction-time stat on Progress.
- [ ] 3.2 GHOST BATTLES data: record per-10s strike buckets on every
      verified Fight Mode session; "MY BEST" ghost always available.
- [ ] 3.3 GHOST BATTLES live screen: split strike bar (you vs ghost replay),
      lead chip, per-round bars, VICTORY/DEFEAT outcome + rematch.
- [ ] 3.4 Challenge codes: "SET AS CHALLENGE" on verified completions →
      shareable code/link; entering a code downloads the ghost. Verified-
      only ghosts ("No fake scores").
- [ ] 3.5 Share cards: ghost battle + reaction mode results with the
      VERIFIED shield badge.

## DESIGN CHECKLIST (assets needed, can run in parallel)
- [ ] Training Camp map art direction (path bg, phase dividers, 👑 boss node)
- [ ] /assets/fight/placement-hint.png (phone/pocket/watch illustration)
- [ ] /assets/fight/opponent-{discipline}.png (reaction-mode opponents)
- [ ] "TITLE FIGHT WON" + KO splash outcome art
- [ ] Ghost battle share card layout (two avatars, result, VERIFIED shield)
- [ ] Camp Champion belt trophy + 3 other Fight Mode trophy images
