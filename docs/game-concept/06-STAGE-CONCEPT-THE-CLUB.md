# TRAINING MODE: THE GAME — Stage Concept: THE CLUB

> **Status:** v1.0 — founder brainstorm + deep-research pass (86 agents,
> 17 claims verified 3-0, 2 refuted & discarded). Findings marked
> **[VERIFIED]** carry citations; genre references marked **[LORE]** are
> well-known but weren't independently verified this pass.

---

## 1. The Hook

**The DJ controls the stage.** While the set simmers, it's a classic
side-scroller brawl. When the DJ **"turns it up," the camera itself is
the escalation** — the stage flips between three play modes. The music
isn't background; it's the level's director.

Precedent — this is franchise-sacred ground done right: Streets of Rage's
composer Yuzo Koshiro built its soundtrack from his real Tokyo nightclub
nights, not from other game music; "Go Straight" (SoR2) is the canonical
rave track of the genre, and the sound influenced real producers (Just
Blaze took his name from SoR's Blaze Fielding; Flying Lotus cites it).
SoR4's composer Olivier Deriviere explicitly rebuilt the club identity as
a core design pillar. **A club stage where the DJ runs the fight is the
most Streets-of-Rage idea possible.** [VERIFIED — NPR, corroborated by
Koshiro primary interviews]

## 2. Music Direction (founder-locked)

- Reference energy: **Natsu Fuji's remix of Rihanna — "Bitch Better Have
  My Money" × Busta Rhymes — "Touch It."** "Touch It" is structured
  around DJ commands ("turn it up / turn it down") — the song's structure
  IS the stage mechanic. BBHMM brings menace and strut.
- **FOUNDER-CONFIRMED (2026-08-06): the game uses an ORIGINAL track
  built on the CONCEPT of that mashup — not the actual songs.** No
  licensing needed. The reference mashup is the composer brief only:
  female-menace hook (BBHMM energy), male command vocals, explicit
  turn-it-up/turn-it-down sections the game hooks events onto, club-rap
  swagger over a rave-ready beat.

## 3. The Three Modes

1. **THE FLOOR (side-scroller, base mode).** Classic brawl across the
   club: dance floor → bar → VIP mezzanine. Crowd NPCs dance in the
   background layers; bouncer/clubber enemy waves.
2. **THE CIRCLE-UP (behind-the-back).** The crowd shoves a champion
   forward; camera swings behind the player's shoulders —
   Rock'em Sock'em / Punch-Out!!-style 1-v-1 boxing framing. Read the
   opponent's tells between light pulses, slip and counter. [LORE
   precedent: Punch-Out!!'s behind-the-back boxing camera]
3. **THE PIT (top-down).** Lights drop to a single overhead spot; camera
   goes overhead; the crowd forms a human ring around the player.
   Enemies rush from all sides — fight with strikes OR clear a
   workout-mash burst (the fitness mechanic) to shockwave the ring.

**Mode flow:** FLOOR → CIRCLE-UP → FLOOR → PIT → finale. The DJ's vocal
command ("TURN IT UP!") telegraphs every switch 2 bars early so players
can finish their combo.

## 4. The Transition (signature moment)

1. The beat crests; the whole crowd raises their hands on the downbeat.
2. Lights bloom toward white **as a moving-head stage light swings past
   the camera lens** — the swinging beam IS the wipe frame.
3. When the beam clears, the new camera mode is live and the drop hits.

Safety-compliant version of the "lights go white" beat (see §7): the
bloom is a fast bright *sweep* (the beam crossing), not a full-screen
strobe — one luminance event per transition, well under flash limits.

## 5. The DJ (mini-boss: "DJ REPZ")

- Booth towers over the floor like a pulpit; he never comes down until
  the finale. Mid-stage he attacks via the club itself: speaker
  shockwaves on the beat, laser fans, dropping the mirror ball, sending
  hype-men waves.
- **Finale:** win the third mode and the crowd turns on him — he does a
  desperate "final drop," the booth descends to the floor, and you fight
  him amid his own collapsing light rig. Beating him ends the set; the
  crowd chants T-M! T-M! (early game) or boos you out (late game,
  propaganda arc — see §8).
- Story slot: the club is Fit-side territory — a "cardio rave" gym-club
  hybrid. Its pre-stage **commercial** is a nightclub promo-style ad
  (per the escalating-ads system in 02-MAIN-STORY-OUTLINE.md).

## 6. What It Looks Like (art direction)

- **Palette:** Void Violet #080012 room; gold #FDE047 and violet #A855F7
  light beams; green laser fans; **saturated red only on STATIC neon
  signs, never strobing** (red flashing has a stricter hazard threshold —
  see §7). [VERIFIED constraint]
- 90s-anime rave: silhouetted crowd layers against beam light, sweat-mist
  haze, mirror-ball glints, CRT scanline overlay in cutaways; chibi crowd
  reactions on comedy beats.
- Pixel technique: dance-floor palette cycling for "animated" floor tiles;
  crowd sprites share 2–3 dance loops offset by frame; beams drawn as
  additive translucent triangles that rotate with the moving heads.
- **GPT art prompt** (use with STYLE + GAME CONTEXT blocks from
  05-ART-PROMPTS.md):

```
Wide side-scrolling background layout for a beat 'em up stage: packed
underground nightclub, near-black violet room #080012, gold and violet
moving-head light beams cutting through haze, green laser fan, mirror
ball, silhouetted dancing crowd in foreground and mid layers, elevated
DJ booth like a pulpit with glowing gold "T" decals (no readable text),
static red neon bar sign in the far background. Flat parallax layers,
90s anime cel style, no characters in focus.
```

## 7. Strobe & Flash Safety (non-negotiable, verified numbers)

- **Baseline (WCAG 2.3.1, Level A):** nothing flashes more than **3
  times per second** unless below thresholds. A "flash" = a pair of
  opposing luminance changes ≥10% of max, darker state below 0.80
  relative luminance. Area exemption: flashing confined to a small
  region (WCAG quantifies ~87,296 CSS px / ~25% of a 10° field) can
  pass — a flashing DJ-booth prop is fine; a full-screen white strobe is
  exactly what fails. [VERIFIED — W3C]
- **Xbox XAG 118 (game-industry adaptation):** failure when flashing
  exceeds ~3/sec and occupies ~20%+ of screen; **saturated red**
  (R/(R+G+B) ≥ 0.8) fails at a LOWER luminance change — avoid strobing
  red washes entirely. High-contrast alternating spatial patterns
  (scrolling bands/checkered floors at >10% contrast over ~20% screen)
  are a separate hazard class; Microsoft recommends Harding FPA testing.
  [VERIFIED — Microsoft Learn]
- **Prevention beats reaction:** W3C — hazardous flashing "cannot be
  allowed even for a second... turning the flash off is also not an
  option since the seizure could occur faster than most users could turn
  it off." Microsoft: eliminating hazardous content is preferred over
  splash warnings (~1 in 4,000 people are photosensitive; many learn it
  from their first seizure). **Design consequence: the club ships
  DEFAULT-SAFE** — SoR3-style on/off room strobes are implemented as
  ≤3 Hz, ≤20%-screen events (alternating localized fixtures create the
  strobe *feeling* without a global flash), and the optional "FULL RAVE"
  intensity is opt-in from the pre-stage/options screen, never mid-scene.
  [VERIFIED — W3C + Microsoft]

## 8. Build Notes (verified pattern)

- **Audio clock is the timing authority.** Drive strobes, crowd bounce,
  enemy spawns, and DJ escalations from the audio system's own clock,
  not frame time (frame clock drifts from playback). Compute
  `secPerBeat = 60 / BPM` and
  `songPositionInBeats = (audioClock − songStart) / secPerBeat`.
  Godot: `AudioStreamPlayer.get_playback_position() +
  get_time_since_last_mix() − output_latency`. [VERIFIED — Game
  Developer/Yu Chao pattern, corroborated by Godot's official docs]
- **One "SongManager" / stage-director node** owns song position and
  emits beat/bar/section signals; the DJ's escalations are just section
  markers in the track data. Camera-mode switches subscribe to the same
  signals — the light-beam wipe is a scene that plays over the switch.
- Mode implementations: FLOOR = standard side-scroll scene; CIRCLE-UP =
  locked 1-v-1 scene with behind-back sprite set (needs back-view
  sprites — already in the turnaround sheets); PIT = top-down scene
  reusing the workout-mash mechanic from fitness-boss fights.
- Track data format: the commissioned song ships with a beat-map file
  (BPM, section markers: NORMAL / TURN_UP_1 / TURN_UP_2 / FINALE) so
  audio and design iterate independently.

## 9. Open Questions (carried from research)

- Original-track commission cost/vendor research (no verified data yet).
- Verified best practices for mid-stage perspective switches (wipe
  timing, control remapping) — genre precedents are [LORE] for now;
  prototype will answer feel questions directly.
- Godot latency/drift tuning at 60fps; whether the beam-wipe frame can
  double as the masking frame for the camera switch (likely yes).
