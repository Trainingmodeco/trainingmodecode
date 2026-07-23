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
- [x] LT-4 SHARE FIX — share a rendered IMAGE, never plain text.
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
      SHIPPED (Jul 20):
      · data/shareCard.js — canvas renderer at real export sizes: STORY
        1080×1920 (250px kept clear top and bottom for IG's own chrome)
        and POST 1080×1080. Dark app background with the violet glows and
        grid, tier avatar in a glowing gold ring, MISSION COMPLETE header,
        session line, XP hero, LEVEL / DAY STREAK / SESSIONS pills, teal
        VERIFIED SESSION shield, apptrainingmode.com footer. Waits on
        document.fonts.ready or canvas silently substitutes a system face.
      · ShareCardSheet.jsx — STORY/POST toggle where the preview IS the
        rendered PNG (never a mock-up), shimmer while rendering, SHARE
        IMAGE / SAVE / COPY TEXT.
      · SHARE hands the file to navigator.share when the browser accepts
        files (phones), which puts Instagram/TikTok/etc in the OS sheet.
        Where files aren't shareable (most desktop browsers) it saves the
        PNG instead so you still end up with the image, never nothing.
      TWO BUGS CAUGHT IN REVIEW: the VERIFIED pill was a fixed width, so
      the shield sat on top of the "V" — it now measures its own text.
      And the 1:1 layout ran past the canvas (stats row landed on the
      footer) because story/post ternaries were scattered through the draw
      code; both formats now read from one LAYOUT table, checked to clear
      the footer even with an optional title line (story 108px, post 73px).
      VERIFIED live: real 1080×1920 and 1080×1080 PNGs rendered from a
      finished session, both formats screenshotted, SAVE produced
      training-mode-post.png with the confirmation toast.
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
- [~] 1.3b Custom combo builder — ON HOLD (Jul 21, user decision). The UI
      (MY COMBOS section + builder sheet) was removed from the Combo Coach
      setup; the user wants to redesign this in the designer first and will
      revisit. The data modules (data/customCombos.js, ComboBuilderSheet.jsx)
      remain in the repo, unused, as a reference for the redesign. Original
      build notes kept below.
      → data/customCombos.js persists combos per discipline (tm_custom_combos,
        capped 24). Palette = the discipline's full strike vocabulary for
        experienced fighters, or the effective arsenal for beginners (same gate
        as Basic Mode). ComboBuilderSheet.jsx: tap strikes to chain them (each
        appended chip removable), name + SAVE, saved list with delete. A "MY
        COMBOS" section on the Combo Coach setup shows saved combos as toggle
        chips + a "＋ BUILD" button; selecting ≥1 flips the CTA to "DRILL MY
        COMBOS" and generateComboCoachSession returns exactly those (shuffled),
        overriding the generated pool. Verified live: built "Jab Cross Hook",
        saved + persisted, selected, drilled — every call-out was that combo,
        nothing from the pool.
- [~] 1.3c Custom strikes — user is REBUILDING (Jul 21). User-defined strikes
      (tap to create/name your own techniques) that then feed Combo Coach /
      Fight Focus, sibling to 1.3b custom combos. User is redesigning in the
      designer and will bring the spec back.
      TIER RECOMMENDATION (freemium-limited, matches the existing GATES pattern
      in data/entitlements.js): free users can CREATE a small number for the
      taste (e.g. GATES.freeCustomStrikes = 3, like freeRoutineSlots = 1);
      unlimited custom strikes + saved library become PRO. This hooks free users
      on personalization, then converts at the cap — same shape as the arcade
      (3 free stages) and routine (1 free slot) gates. Nothing to enforce until
      PAYWALL_ENABLED flips; add the gate constant when the redesign lands.
      FINAL free-vs-Pro call still pending user.
- [x] 1.4 Strike counter pipeline. SHIPPED (Jul 21).
      → data/strikeCounter.js — pure detector: gravity removal (high-pass, or
        the device's linear accel when available) → magnitude → adaptive
        threshold (max of an absolute floor and 3× a slow noise-floor EMA) →
        peak detection with a 200ms refractory window + hysteresis re-arm.
      → hooks/useStrikeCounter.js — DeviceMotion subscription (only while the
        WORK round is live), iOS DeviceMotionEvent.requestPermission() from a
        user gesture, grant remembered (tm_motion_granted). Exposes count +
        motionSeen so callers can tell "granted but phone on a table" from a
        real zero.
      → shared/StrikeHud.jsx — the 👊 pill: a COUNT STRIKES CTA that opens the
        sheet, then a live count once enabled. shared/StrikeCounterSheet.jsx —
        placement tips (pocket/waistband · armband · lead hand) + the enable
        button; honest "it's an estimate" note.
      → Wired into Combo Coach and Fight Focus (HUD + sheet + count gated to the
        work round). Feeds 1.5: when motion counted this session the summary
        shows the motion-verified thrown count as "STRIKES ✓" and lifetime
        fightStats records it; otherwise the called count.
      VERIFIED: detector unit-tested (7 synthetic cases — normal/fast/weak/
        linear/rest-only/refractory all pass). Full pipeline exercised in the
        browser by dispatching synthetic DeviceMotion events: 10 punch spikes →
        HUD counted exactly 10 → summary showed STRIKES ✓ 10 → lifetime +10.
      ⚠ REAL-DEVICE TESTING STILL NEEDED (the user's phone): the desktop pane
        has no accelerometer, so real punches weren't tested. The thresholds
        (minThreshold 12 m/s² ≈ 1.2 g, peakFactor 3×) are sensible defaults but
        will likely want calibration once tested against real punches in each
        placement — if it under-counts, lower minThreshold / peakFactor.
- [x] 1.5 Fight Mode stats: STRIKES · ROUNDS · BEST STREAK row on Mission
      Complete; lifetime totals persisted for trophies/ghosts. SHIPPED (Jul 20).
      → arsenal.countStrikes() counts strike occurrences in a combo (longest-
        match-first, so "Low Kick" ≠ 2 kicks). ComboCoachActive tallies total
        strikes called + peak streak, handed to the summary via onEnd. Combo
        Coach summary shows ROUNDS · STRIKES · BEST STREAK (4-up with XP);
        Fight Focus keeps ROUNDS · MINUTES (no combo call-outs to count).
        data/fightStats.js persists lifetime rounds/strikes/bestStreak/sessions
        (tm_fight_stats). Verified: "Jab Cross Hook" ×5 → STRIKES 15, BEST
        STREAK 5, and lifetime totals persisted.
      ⚠ HONEST LABEL: "STRIKES" here = strikes the coach CALLED and you
        shadowboxed, not motion-verified throws. When 1.4 (accelerometer)
        lands it replaces this with verified thrown strikes and the label can
        become "STRIKES THROWN". The plumbing (countStrikes + fightStats) is
        already the right shape for that swap.
- [x] 1.6 Anti-cheat wiring. SHIPPED (Jul 21), REVAMPED to POSITIVE-ONLY
      (Jul 21). Strike count folds into calculateMissionIntegrity(session,
      motion) as a bonus signal that can only ADD trust — it NEVER penalizes or
      withholds credit. Rationale: a phone accelerometer only senses strikes
      when the phone is ON the body, but the common/correct setup is OFF the
      body (floor by the bag, propped, or mounted to watch the timer). A
      stationary phone there is normal, and the sensor can't tell "on the floor,
      working hard" from "did nothing" — so a low count must never be a flag.
      effort ∈ {unmeasured, measured, verified}: motion on + ≥1 valid round +
      ≥6 strikes/round → 'verified' (✓ bonus, motionVerified true); any lower
      positive count → 'measured'; motion off / phone off-body / zero →
      'unmeasured'. leaderboardEligible = isFullyValid ALWAYS (time gate only;
      motion never gates). Removed the old 'low' soft-flag + its banner note.
      Baseline anti-cheat stays the time/idle/rapid-action gate, which holds
      regardless of phone placement. Real motion verification for the
      competitive layer is deferred to camera pose tracking (Phase 3), which
      works for the mounted/floor-facing setup. effort/motionVerified/
      strikesThrown persisted to tm_integrity_log. Unit-tested (8 cases:
      on-floor zero = no penalty, tiny count = no penalty, verified bonus,
      boundaries, "never emits low"). Real-device calibration pending a phone.

## PHASE 2 — TRAINING CAMP + ARCADE v2 (protocol-driven; PRO tier)
> PROTOCOL LANDED Jul 21 (`protocol-src/` on `app`, merged via PR #2 from the
> fight-mode chat). Contents: specs 10 (camp) + 11 (arcade), DESIGN-SPEC.md
> (designer handoff), INTEGRATION.md (wiring steps), 14 JSON content files,
> 2 JSON schemas, and one framework-free `training-engine.ts` (pure functions:
> resolveRoundTemplate / evaluateSession / calcXp / assessReadiness + lookups).
> STATUS: STAGED, NOT integrated — nothing in the app imports the engine yet.
> It SUPERSEDES the old simple 12-session camp. Design principle: ONE ENGINE,
> MANY SKINS — Arcade stages are themed layers over the Camp engine. 36 camp
> variants (4 disciplines × 3 archetypes × 3 difficulties). Content is fully
> data-driven: adding a camp/campaign/archetype/module = editing JSON, zero
> new screens. Pro-tier, bundled with Phase 3. User-led this week.
- [x] 2.0 Engine integrated (Jul 21). `protocol-src/` copied into
      `components/training-mode/protocol/` (data/ + engine/trainingEngine.ts +
      schemas/). `protocol/content.ts` binds the JSON to the pure engine and
      exposes bound helpers (roundTemplate / archetypesFor / campLevel /
      isSplitAvailable / evaluate / xpFor / readiness) so screens never pass
      content by hand. Node smoke-test = 28 cases pass (all JSON parse, 12
      levels, 12 archetypes, resolveRoundTemplate covers all 144 disc×level×diff
      combos with no gaps, taper reduces L10/11 count & keeps length, L12 boss
      shapes, XP balancing rule, evaluateSession order, readiness gate, sample
      stages/modules pass their schemas). typecheck + lint + build:web clean.
      TRAINING CAMP entry added ATOP the Fight Mode hub (gold, Tent icon, NEW
      badge) → routes to `training_camp` screen. TrainingCampMap.jsx v0 renders
      the 12-level / 5-phase ladder from content with LIVE engine round previews
      (verified in-browser: EASY/NORMAL/HARD re-preview the whole ladder, taper
      shows L9 6×3:00 → L10 5×3:00 → L11 4×3:00, TITLE FIGHT ~27–38 active min).
- [ ] 2.1 Content data model wired: CAMPAIGN → STAGES → STAGE_PATHS (fit/fight)
      → reusable WORKOUT_MODULES (easy/normal/hard variants). Replace the sample
      stage-catalog + workout-modules with the real catalogs (samples show shape).
- [ ] 2.2 Camp setup flow: DISCIPLINE (existing art) → ARCHETYPE (12 in
      archetypes.json, card UI: name + tagline + selected-difficulty variant) →
      DIFFICULTY (E/N/H). Archetype drives drills/tactics; difficulty drives
      volume/rest/complexity/decision load. (DESIGN-SPEC S2.)
- [~] 2.3 TRAINING CAMP map → 45a ladder BUILT (Jul 21), 45b modal interim.
      45a: CSS neon-spine ladder over a full-bleed tower backdrop, LOCKED to one
      viewport (verified: docScrollH == winH, no scroll). 12 numbered nodes on a
      green→gold→violet→red progress spine, {PHASE·TITLE} labels left (phase-
      tinted), S1/S2 pips right (L4–11), completed ✓ / current "you are here" +
      R1✓ R2▶ / locked / 🏆 TITLE FIGHT. Rendered bare (no bottom nav) so it
      fills the frame; back chevron → Fight hub. Current level from
      tm_camp_progress (placeholder until 2.4 wires real completion).
      ⚠ AWAITING ART: background reads /static/training-camp-tower.webp — user
      must drop the tower image there (CSS gradient fallback stands in until
      then). 45b modal is the interim (round plan + combat/physical chips + E/N/H);
      full 45b (TOTAL TIME·XP·GEAR tiles + per-session S1/S2 cards) needs the
      workout-modules content.
      Remaining for full 45a/45b: real per-session blocks/gear/duration in
      workout-modules.json; then wire the fuller modal (per-session S1/S2 cards
      + TOTAL TIME·XP·GEAR tiles). Full spec: DESIGN-SPEC S1.
      Decisions locked (Jul 21): `title` per level added; AM/PM = S1 SKILL
      (combat, fresh) / S2 CONDITIONING (physical), skill-first, spec 10 P5
      updated to match.
- [x] 2.4 Session runner — COMPLETE (Jul 23; slices Jul 21–23). Slice 1 SHIPPED (Jul 21): a camp level is now
      PLAYABLE end-to-end. 45b START builds a cfg from the engine round template
      (rounds/length/rest) and launches the session on the shared FightFocusTimer
      (reuse, not a fork) → onEnd → MissionComplete outcome. New: data/
      campProgress.js (tm_camp_progress, loadCampProgress/completeCampLevel),
      userStats.addCampSession (type 'Training Camp'), App campCtx/campResult +
      goCampSession/goCampComplete/goCampMap, ScreenRouter camp_session +
      camp_complete screens. Camp progression RESPECTS the 1.6 anti-cheat: a
      valid full completion clears the level (advances the cursor, unlocks the
      next) and awards XP; a too-fast/suspicious session earns 0 XP and does NOT
      clear. Verified in-browser (time-warped): valid run → LEVEL 3 CLEAR +170XP
      + CONTINUE→L4 + session recorded; rushed run → GOOD EFFORT +0XP, progress
      stays L3. No console errors.
      2.6 readiness gate SHIPPED (Jul 21): shared/ReadinessSheet.jsx — 5×1–5
      taps + danger question → engine assessReadiness → go (launch) /
      suggest_easy_or_recovery (offer Easy variant or start anyway, keeps streak)
      / halt (danger → REST TODAY advisory, blocks, no penalty). START now runs
      the check first. Verified in-browser (go → session launches; danger → halt
      blocks). Also unified GOOD EFFORT (partial) with MISSION COMPLETE layout
      (same padding + badge size).
      SPLIT SEQUENCING + S7 TRANSITION SHIPPED (Jul 21, slice 2): split levels
      (L4–11) now run S1 · AM — SKILL then S2 · PM — CONDITIONING as separate
      missions with independent completion (data/campSessions.js,
      tm_camp_sessions); the level clears ONLY at ✓✓, then unlocks the next.
      45b modal shows both mission cards with real state (✓ COMPLETE / ▶ UP
      NEXT / PENDING) + "leave 4–8 h" rule; ladder pips are live (S1✓ S2▶);
      START SESSION {next} auto-targets the first incomplete mission. Every camp
      session opens with the S7 transition card (shared/CampTransitionCard.jsx —
      "NEXT UP · S{n} · {SKILL|CONDITIONING}", blue/violet, auto-advance bar)
      via CampSessionRunner, which is the chaining point for future multi-block
      sessions. S1-done outcome = "SESSION 1 COMPLETE · S2 tonight — leave
      4–8 h" (no unlock); S2-done = LEVEL CLEAR + CONTINUE → L{n+1}. Each
      mission awards XP; anti-cheat still gates (invalid session marks nothing).
      Verified in-browser end-to-end with a clock+timer warp (integrity saw
      full-length rounds): L4 S1 → SESSION 1 COMPLETE +170XP → pips flip →
      START SESSION 2 → LEVEL 4 CLEAR +170XP → progress 5, sessions
      {4:{s1,s2}} persisted through reload. Trophy size unified (maxWidth
      clamp — wide GOOD EFFORT emblem now matches the other badges).
      REAL BLOCK CONTENT WIRED (Jul 22, slice 3): S1/S2 now carry distinct real
      content. protocol/data/workout-modules.json — authored starter catalog
      (boxing FIGHT per phase + multi FIT per phase). content.ts adds campModule
      (module resolver by discipline/type/phase/difficulty) + campBlock
      (module-first, falls back to camp-levels combat_emphasis [skill] /
      physical_emphasis [conditioning] so EVERY discipline & level has content
      today) + blockRoundsFor + humanizeGoal. FightFocusTimer takes an optional
      cfg.blockRounds that overrides the generated combos with the block's real
      per-round goals (gated; normal Fight Focus untouched). 45b modal shows each
      mission's real goals + ~duration; the running timer shows the goal as the
      round title (verified: boxing L5 S1 → "JAB CROSS RING CUT / Sharp
      technique…"; S2 conditioning → "Jump Rope Intervals" etc.). The fight-mode
      chat's future camp modules drop into workout-modules.json over the fallback.
      FULL FIGHT MODULE CATALOG AUTHORED (Jul 22): workout-modules.json now has
      52 modules — 48 FIGHT (4 disciplines × 4 phases × 3 difficulties, all
      discipline-authentic: boxing combos/ring craft, kickboxing Dutch chains/
      low kicks, Muay Thai teeps/knees/clinch/elbows, MMA level-change/wall/
      ground) + 4 FIT (multi). Every discipline×level(1–11)×difficulty resolves
      to an EXACT-difficulty module (132/132, verified in Node); L12 boss falls
      back to combat_emphasis. Difficulty variants distinct + round plan scales
      (verified MT L8: NORMAL 6×3:00 "High Kick Output…" vs HARD 8×3:00 "Max
      Kick Volume · High Clinch Density · Knees Under Fatigue…"). Generated from
      a compact goal table via a one-off script for consistency.
      FIT-SPECIFIC S2 RUNNER SHIPPED (Jul 22): CampFitRunner.jsx — a dedicated
      conditioning timer (teal palette, 🔥 WORK / ☕ REST, exercise goal front-
      and-centre, round pips, no strike counter, no fight framing). Isolated
      from FightFocusTimer but produces the identical onEnd(rounds, cfg,
      completed, integrityResult) via useIntegritySession('combatConditioning')
      so the 1.6 anti-cheat gate + goCampComplete work unchanged. ScreenRouter's
      CampSessionRunner routes S2 (split slot s2) → CampFitRunner, S1/skill →
      FightFocusTimer. Verified in-browser: boxing L5 S2 launched via readiness →
      "CONDITIONING · ROUND 1/6" running "JUMP ROPE INTERVALS / Move with intent"
      (teal ring, WORK 2:00); END → GOOD EFFORT +0 XP 0/6 (integrity gate intact,
      routed through camp_complete). No console errors.
      FIT EASY/HARD VARIANTS SHIPPED (Jul 22): workout-modules.json now 60
      modules — 48 fight + 12 fit (4 phases × 3 difficulties). Every discipline×
      level(1–11)×difficulty resolves to an exact-difficulty module for BOTH
      fight AND fit (verified Node: fit 33/33). S2 now scales with difficulty —
      verified in-browser (boxing L5 fit: EASY "Easy Rope · Light Roadwork ·
      Bodyweight Circuit…" ~18m vs NORMAL "Jump Rope Intervals · Roadwork
      Tempo…"). Full camp content matrix is complete.
      WARM-UP PHASE SHIPPED (Jul 23): every camp session (split S1/S2 and full)
      opens with an optional warm-up — shared/WithWarmup.jsx wraps the runner
      with a "WARM UP · {mode}" teal timer (3 min, NO XP, "SKIP → START" to jump
      straight in); cfg.warmupMin drives it (buildCfg sets 3). Verified in-browser
      (WARM UP · FULL CAMP teal timer → SKIP → session starts).
      FULL CAMP SHIPPED (Jul 23): the two split missions now run back-to-back as
      ONE sitting. 45b modal shows a SPLIT · 2 DAYS / FULL CAMP · 1 SITTING toggle
      on fresh split levels (canFull); FULL CAMP launches CampFullSession.jsx
      (intro1 → skill FightFocusTimer → intro2 CampTransitionCard → fit
      CampFitRunner) via App.goCampSession(format:'full') → screen camp_full
      (WithNav + WithWarmup), and reports a combined {skill, fit} to
      goCampFullComplete — each block judged by the SAME 1.6 anti-cheat gate,
      both slots mark done + level clears at ✓✓ in one go, XP awarded per valid
      block. Verified in-browser (clock+timer warp so integrity saw full-length
      rounds): boxing L5 FULL CAMP → warm-up → skill 6 rounds ("JAB CROSS RING
      CUT" … "SLIP COUNTER PIVOT") → S2 · CONDITIONING transition → fit 6 rounds
      ("JUMP ROPE INTERVALS" … "MOBILITY FLUSH") → LEVEL 5 CLEAR +340 XP 12/12
      ROUNDS → CONTINUE → L6; tm_camp_progress=6, tm_camp_sessions {5:{s1,s2}}
      persisted, no console errors. 2.4 content + runner matrix now COMPLETE.
- [x] 2.4b Session runner (full): SHIPPED (Jul 23) — see FULL CAMP note above.
      FULL CAMP chains skill+fit blocks back-to-back with an inter-block
      transition card → combined Mission Complete; SPLIT CAMP (default L4–11) runs
      S1 · SKILL / S2 · CONDITIONING as independent sessions with per-slot chips
      and readiness check. L1–3 and L12 are single-session. (spec 10 P5.)
- [x] 2.5 Round timing from timing-tables.json via resolveRoundTemplate —
      SHIPPED (Jul 23). The engine's resolveRoundTemplate (protocol/engine) is
      the single source of round counts/lengths/rest; content.roundTemplate wraps
      it and TrainingCampMap.buildCfg drives EVERY camp/full timer from it (no
      hardcoded rounds). Striking vs MMA bands honoured (verified: boxing L5
      6×2:00·45s vs MMA L7 6×4:00·60s vs MMA L9 hard 5×5:00 fight_simulation);
      L10–11 taper reduces round COUNT, keeps LENGTH (verified: boxing L10 5×3:00
      [TAPER], L11 4×3:00 [TAPER], down from the L9-band 6×3:00); L12 final-boss
      table resolves (MMA 5×5:00, striking → active-minute target e.g. boxing L12
      hard ~38 active min). The 45b modal preview surfaces the plan + a TAPER tag
      + the "~N active min · objective rounds" line for the boss. NOTE: the L12
      active-minute RUNNER (a timed objective session vs fixed rounds) is built
      under 2.11 TITLE FIGHT; the timing itself is done here.
- [x] 2.6 Safety gates (two-stage) — SHIPPED (Jul 23). Stage 2 (daily readiness)
      landed Jul 21 (shared/ReadinessSheet.jsx: 5×1–5 taps + danger question →
      engine assessReadiness → halt / suggest_easy_or_recovery / go; recovery
      keeps the streak; runs before every camp session). Stage 1 (PAR-Q+) now
      landed: shared/ParQSheet.jsx + data/parq.js (tm_camp_parq) show a ONE-TIME
      6-question pre-participation screening the first time a camp opens. Any
      "yes" NEVER hard-blocks — it shows a "CHECK IN FIRST" advisory (see a
      professional; not medical advice) and softly defaults the camp to Easy with
      a "⚕ EASY RECOMMENDED" header chip (changeable any time). All-NO enters
      normally. Result is persisted so it never nags again. Questions/copy come
      from readiness.json onboarding_screening. Verified in-browser both paths
      (all-NO → normal entry, no chip; one-YES → advisory → Easy default + chip +
      L6 modal pre-selects EASY 5×2:00 easy content; re-entry skips the gate;
      tm_camp_parq {done,anyYes} persisted; no console errors). Hard rules from
      readiness.json (never reward dehydration / weight-cut / hard sparring;
      danger halts) hold. (readiness.json, DESIGN-SPEC S3.)
- [ ] 2.7 Pass rules + adaptive failure: evaluateSession → pass / partial /
      fail / validation_failed onto the EXISTING outcome screens + 1.6 anti-
      cheat. 4 fail types (safety/conditioning/technical/tactical), each with
      its own response line — never random punishment. (pass-rules.json.)
- [x] 2.8 XP via calcXp + xp-rules.json — SHIPPED (Jul 23). Camp XP is now the
      engine ruleset, not a flat round count: content.campSessionXp() computes
      active_minutes (done rounds × round length) × base(10) × difficulty ×
      completion, + full-arc bonus for FULL CAMP. Outcome derived from completion
      ratio + the 1.6 gate (pass/partial/fail; invalid → validation_failed → 0),
      so anti-cheat is preserved; when 2.7 lands it can pass an explicit outcome.
      userStats.addCampSession takes the precomputed xpAward; App.jsx goCampComplete
      + goCampFullComplete compute it from cfg.roundMin/difficulty. Node-verified
      economy (Easy pass 100 / Normal 138 / Hard 156 for L5 6×2:00; partial 0.5×;
      fail 0.15×; cheat 0; MMA L9 5×5:00 = 325) and the balancing rule holds
      (clean Easy pass 100 > Hard fail 4). Verified in-browser: boxing L5 NORMAL
      S1 → +138 XP recorded (was flat 170), total 850→988, no console errors.
      xp-rules.json is the remote-configurable ruleset.
- [x] 2.9 Equipment-aware routing — SHIPPED (Jul 23). data/equipmentProfile.js
      (tm_equipment) holds the athlete's gear (default: all owned, so no noise);
      Profile → MY GEAR is the settings screen (7 toggles keyed to the module
      substitution IDs + "JUST A PHONE" / "FULL GYM" presets, bodyweight-first
      framing). content.campSubs() exposes a block's gear→substitution map;
      TrainingCampMap computes neededSubstitutions() for the block(s) about to run
      and shows a "GEAR SWAPS · NO XP LOST" panel ("🔁 No Heavy Bag → Power
      Shadowboxing"). XP is unchanged — the 2.8 formula is active-minutes based,
      so substitutions never dock XP (only effort counts). Verified in-browser:
      phone-only → swap chip shows; own the bag → chip gone; MY GEAR presets flip
      0/7 ↔ 7/7 and persist; no console errors. (equipment.json / workout-modules
      substitutions are the data source.)
      REPOSITIONED (Jul 23, user): gear is contextual, not a global setting — the
      Profile → MY GEAR screen was REMOVED and replaced by shared/GearSheet.jsx,
      a small in-flow modal shown in the camp start flow AFTER the readiness/vibe
      check (START → readiness → gear → warm-up → session), with the same presets
      + live "GEAR SWAPS · NO XP LOST" line. The 45b pre-start swap chips were
      removed (gear is now picked in-flow). Verified in-browser: START → readiness
      → GEAR CHECK (phone-only default, live "No Heavy Bag → Power Shadowboxing")
      → CONTINUE → warm-up → session; MY GEAR no longer in Profile.
      CAMP PAYWALL (Jul 23, user): free levels 1–3, 4–12 Pro
      (entitlements.GATES.freeCampLevels=3 + canAccessCampLevel). A free user on a
      Pro level sees "Levels 1–3 are free · 👑 UNLOCK WITH PRO" → Paywall (onPaywall
      threaded via ScreenRouter). Verified in-browser with ?paywall=preview: L5 →
      UNLOCK WITH PRO → Paywall; L3 → normal START SESSION. Custom combo (1.3b,
      rebuilt later) is also Pro. ORIGINAL TODO TEXT BELOW:
      user equipment profile in settings; MINIMUM
      VIABLE = open space + phone (every stage completable bare); data-driven
      substitutions (bag → shadowbox power rounds, rope → fast feet, etc.) show
      a chip and NEVER dock XP — punish nothing but effort. (equipment.json.)
- [~] 2.10 ARCADE v2 — SLICE 1 SHIPPED (Jul 23): campaign content foundation. The
      5 campaigns (Baki, Berserk, Dark Knight, Ultra Ego, Ultra Instinct) copied
      into components/training-mode/protocol/data/campaigns/ (12 stages + 24
      modules each); new protocol/campaigns.ts loads them + exposes arcadeCampaigns
      metadata and resolvers (getCampaign, campaignStages, arcadeStage,
      stageModule, stageFormats, stageEquipment, resolveArcadeRounds — the runner
      bridge). Node-validated: 360 resolutions (5×12×fit/fight×easy/normal/hard),
      0 failures; typecheck + lint + build clean.
      SLICE 2 SHIPPED (Jul 23): the selection flow + runner handoff. ArcadeV2Hub
      (campaign chips + 12-stage grid with lock/current/done from
      arcadeCampaignProgress) → ArcadeStageSelect (DESIGN-SPEC S6: header · PATH
      FIT/FIGHT/FULL ARC · FORMAT split/full for full arc · DIFFICULTY (two rows on
      full arc) · EQUIPMENT chips (required solid / recommended dim) · WARNINGS ·
      LIVE PREVIEW re-rendering on selector change · gold START). The arcade entry
      (goTrainingArcade) now opens arcade_v2. campaigns.ts adds arcadeCfg /
      arcadeBlockRounds / arcadeSubs (the runner bridge). START reuses the camp
      engine: goArcadeV2Start builds a camp-style cfg and routes to
      camp_session/camp_full; goCampComplete/goCampFullComplete branch on
      campCtx.arcade to update arcade progress (clearArcadeStage) + the 2.8 XP + the
      1.6 gate, with a paywall gate (canAccessStage, free stages 1–3). Verified:
      typecheck + lint + build clean; campaign resolvers Node-validated (360); no
      console errors. ⚠ IN-APP CLICK-THROUGH NOT YET DONE — browser pane input was
      wedged this session; confirm the v2 screens + a stage play-through when the
      pane recovers.
      SLICE 3 POLISH (remaining): the shared camp_complete screen shows "LEVEL N"
      not "STAGE N" for arcade + records sessions as 'Training Camp' — relabel for
      arcade; add readiness+gear before an arcade START (currently straight to
      warm-up); wire the 9 achievements; original campaign banners (IP). Keep names
      ORIGINAL. (spec 11 P1–P2, DESIGN-SPEC S6.)
- [ ] 2.11 TITLE FIGHT (L12) + "TITLE FIGHT WON" outcome; camp completion →
      CAMP CHAMPION trophy + bonus XP → offer next camp/tier.
- [ ] 2.12 Achievements (9 families → Progress tab arcade section, wired to
      real events): FIT CLEAR · FIGHT CLEAR · FULL ARC CLEAR · NO-DROP RUN ·
      PERFECT DEFENSE · LATE-ROUND SURGE · TACTICAL BOSS CLEAR · MINIMAL
      EQUIPMENT MASTER · CONSISTENCY STREAK. (achievements.json.)
- [ ] 2.13 Home integration: active camp drives Today's Bout ("TRAINING CAMP ·
      L n"). Fight Mode trophies (CAMP CHAMPION etc.) wired to camp events.

## PHASE 3 — DIFFERENTIATORS (competitive layer; PRO tier; needs Phase 1)
> TIER (Jul 21, user decision): Phase 3 is PRO — the whole competitive layer
> (camera pose verification, reaction mode, ghost battles, verified leaderboards)
> ships gated behind Pro and bundled with TRAINING CAMP (Phase 2). User is
> building/integrating this later this week. Casual play stays free and
> sensor-optional; the accelerometer bonus (1.6) remains free and positive-only.
- [ ] 3.0 CAMERA POSE VERIFICATION (the real anti-cheat engine). On-device
      browser pose estimation (TensorFlow.js MoveNet/BlazePose or MediaPipe
      Tasks) via getUserMedia — counts real punches from wrist/elbow keypoints
      and confirms a person is actually moving, REGARDLESS of where the phone
      sits, as long as the camera faces the athlete. Solves the accelerometer
      blind spot (phone on the floor / mounted / propped to watch the timer =
      the common setup). 100% on-device: no video leaves the phone, needs
      explicit camera permission + a lit, framed view. This — not the
      accelerometer — is what powers a trustworthy VERIFIED leaderboard, ghost
      battles, and reaction mode. Cost: ~3–6 MB model, CPU/battery, tuning.
      Gate the competitive tier behind it; keep casual play sensor-free.
- [ ] 3.1 REACTION MODE: opponent windup cues → defense calls → motion-
      verified reactions (via 3.0 camera pose), PERFECT/GOOD/HIT grading, HP
      bars, counter-combo windows, KO/decision outcomes, avg-reaction-time
      stat on Progress.
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
> Screen specs for the v2 protocol are in `protocol-src/DESIGN-SPEC.md`
> (containers only — all copy comes from `protocol-src/data/*.json`). New
> screens it defines: archetype picker (S2), stage-selection (S…), readiness
> sheet (S3), split-day AM/PM card (S5). Art-generation prompts live on the
> `main` branch at bolt-rebuild-kit/prompts/05e-fight-mode-design-prompts.md.
- [ ] Training Camp map art direction (path bg, phase dividers, 👑 boss node)
- [ ] /assets/fight/placement-hint.png (phone/pocket/watch illustration)
- [ ] /assets/fight/opponent-{discipline}.png (reaction-mode opponents)
- [ ] "TITLE FIGHT WON" + KO splash outcome art
- [ ] Ghost battle share card layout (two avatars, result, VERIFIED shield)
- [ ] Camp Champion belt trophy + 3 other Fight Mode trophy images
