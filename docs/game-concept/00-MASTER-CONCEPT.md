# TRAINING MODE: THE GAME — Master Concept Document

> **Status:** Concept / brainstorm capture — v0.1
> **Companion to:** The Training Mode app (trainingmode.co / apptraining.com)
> This document is the master bullet list of every concept point for the game,
> organized so each section can grow into its own design doc later.

---

## 1. High Concept (Elevator Pitch)

- A **retro 90s-anime, pixel-art, cyberpunk beat 'em up** that is the playable
  extension of the Training Mode fitness app.
- **Your real training builds your fighter.** The app tracks what you actually
  do (lifting, cardio, fight training, arcade protocols) and your in-game
  character inherits those strengths *and* weaknesses.
- Tongue-in-cheek but played straight: **funny, action-packed, over-the-top** —
  a love letter to fitness culture and combat sports, where the bosses are
  humorous exaggerated caricatures of famous fitness/combat celebrities.
- One line: **"Scott Pilgrim vs. The World meets Streets of Rage 4 meets
  Dragon Ball FighterZ — powered by your actual workouts."**

---

## 2. Tone, Humor & References

- **Humor register:** Scott Pilgrim + One Punch Man — self-aware, deadpan,
  absurd, but the action is treated 100% seriously.
- **Move-set energy:** Dragon Ball Z / DBZ FighterZ — wildly over-exaggerated
  supers, screen-filling ults, dramatic anime cut-ins.
- **Combat feel & structure:** Streets of Rage 4 / Scott Pilgrim vs. The World:
  The Game — crunchy beat 'em up fundamentals, co-op-friendly, juggle combos.
- **Pixel art bar:** the modern-premium pixel style of
  **TMNT: Shredder's Revenge** and **Marvel Cosmic Invasion** (Tribute
  Games-tier sprite work, big expressive frames, chunky hit effects).
- Serious-but-silly rule: the *world* is ridiculous, the *characters* never
  think they are. Bosses genuinely believe their own hype.

---

## 3. Art Direction & Brand Alignment

- **Aesthetic pillars:** retro 90s anime · pixel art · cyberpunk · neon gym
  culture.
- Must feel native to the Training Mode brand (pull directly from the app's
  design system):
  - Background world tone: near-black violet `#080012`.
  - Accent gold `#fde047` (XP, ranks, CTAs) · violet `#a855f7` (energy, UI)
    · danger red `#ef4444` · success green `#22c55e` · cardio orange `#ff8a4a`.
  - UI type: **Orbitron** (big numbers, headers) + **Rajdhani** (body) — the
    game HUD should read like the app's timers and rings.
  - Reuse app iconography: ring timers, stage badges, trophy art, tier avatars.
- VHS/CRT-era touches: scanline options, anime "episode title cards" per stage,
  90s dub-style voice barks, freeze-frame finish screens (mirrors the app's
  Mission Complete share card).

---

## 4. The Core Hook — App-to-Game Character Sync

- **Account link:** player can log into the game with their Training Mode app
  account; the game pulls their training data and builds their fighter from it.
- **Your training IS your build.** What you do most in the app becomes your
  character's strengths; what you neglect becomes an exploitable weakness.
- Example mappings (to be tuned):
  - **Fit Mode / Workout Builder heavy, Cardio light** → huge strike damage,
    but **gasses out fast** (small stamina bar) and **limited technique**
    (small move list — haymakers and slams, no real combos).
  - **Cardio Mode heavy** → deep stamina bar, fast movement/recovery, chip
    damage resistance — but noodle-arm damage output.
  - **Fight Mode (Combo Coach / Practice Mode) heavy** → unlocks real
    technique: longer combo strings, slips/parries, footwork cancels,
    discipline-flavored move sets (boxing / kickboxing / Muay Thai / MMA).
  - **Combat Conditioning** → the hybrid stat — bridges damage + stamina.
  - **Training Arcade stage clears** → special meter gain rate / super moves.
  - **Streaks & consistency** → passive regen, "In The Zone" buff.
  - **Skipped rest days / overtraining flags** → fun debuffs (e.g. "DOMS":
    slower dodge for one stage).
- **App XP & tiers carry over:** LV1 Rookie → LV2 Adept → LV3 Veteran →
  LV4 Elite → LV5 Champion gates gear, auras, and stage access.
- Playable without the app (default balanced build), but the app link is the
  premium identity hook — *"my character is literally built from my training."*
- Anti-cheat parity: game respects the app's validation (unverified workouts
  don't level your fighter).

---

## 5. Player Character & Customization

- Base it **semi-loosely on the founder — but not directly**; reads as a
  fairly generic, customizable trainee ("the newest member of Training Mode").
- **Light cosmetic customization only — nothing major:**
  - Skin tone (light ↔ dark, full range).
  - Hairstyles + hair color.
  - Body type: slim / average / heavyset; taller / shorter.
  - Eye color.
  - Clothing/outfits (gym fits, fight kits, cyberpunk streetwear; tier-gated
    unlocks).
  - Male / female presentation (matches the app's gendered tier/discipline
    art).
- No stat impact from cosmetics — **stats come only from training data**.
- Silhouette must stay readable in pixel art at gameplay scale.

---

## 6. Genre, Structure & Core Gameplay

- **Genre:** side-scrolling beat 'em up (1P first; co-op is a design goal).
- **Stage flow:** fight waves of themed enemies → mid-stage gimmick → boss.
- **Early stages = gym settings** (weight room, cardio floor, boxing gym,
  MMA cage room) — the "tutorial biome" that mirrors the app's modes.
- Each stage's workout theme differs by boss type:
  - **Fitness bosses** → mid-fight *workout mechanics*: button-mash /
    controller **motion-detection** sequences where the player must physically
    grind (rep out) while also fighting — striking the boss *and* completing a
    physical-feeling workout.
  - **Combat-sports bosses** → traditional fighting: button-mash/tap-timing
    combat, combos, reads.
- **Signature transition:** for higher-ranking bosses, the stage shifts from
  side-scroller **into a 1-v-1 versus-fighter stage** (camera locks, health
  bars flip to fighting-game layout, DBZ-FighterZ-style spectacle) — the
  "title fight" moment.
- Over-exaggerated move sets: supers, beam-clash-style struggles, screen-wide
  ults earned via training-based special meter.
- Score/rank per stage (S1–S6 style, matching the Training Arcade), replay for
  better ranks and XP.

---

## 7. Boss Roster — 10–20 Bosses (Humorous Caricatures)

> Bosses are **exaggerated parodies** of famous fitness & combat-sports
> celebrities. Each has: a themed stage, a gimmick, and a running joke they do
> NOT find funny.

### Confirmed concepts (from brainstorm)

- **Mike Bison** *(Mike Tyson × M. Bison)* — boxing boss.
  - Call him a knockoff of Iron Mike and he gets **offended**: insists he's
    *way better* and that Tyson "stole his thunder."
  - Peek-a-boo rush-downs, psycho-uppercuts, lisped trash talk.
- **D. Wayne Rockson** *(The Rock)* — movie-set / franchise-gym boss.
  - Fights **with a film crew**: camera dollies, boom mics, stunt doubles as
    adds; "cut!" resets, take counters.
  - **Shiny bald head blinds the player** (screen flare mechanic).
  - **Deflates when he misses his "medication"** — mid-fight phase where he
    shrinks and scrambles for his gym bag; his moves weaken until he re-ups.
- **Sly Stallion** *(Sylvester Stallone caricature)* — meat-locker /
  mountain-run training-montage stage; mumble-dialogue subtitle gags;
  montage music makes him stronger until you interrupt it.
- **Conor McGregor caricature** ("The Notorious C.O.N.") — press-conference
  arena stage; trash-talk projectiles, struts, throws a dolly; leaves early
  if losing and has to be dragged back.
- **Jackie Chan caricature** ("Action Jack Sun") — prop-fighting stage where
  EVERYTHING is a weapon (ladders, benches, shopping carts); he's the
  friendly boss who apologizes mid-combo; outtake reel on defeat.
- **David Goggins caricature** ("Sgt. Stay Hard") — **military-base stage**.
  - Periodically **rounds everyone up (player included) for PT**: forced
    button-mash sequences — push-ups, 4x4x48-style runs — while he yells
    catchphrases ("WHO'S GONNA CARRY THE CONTROLLERS?!").
  - Never staggers, never blocks, just keeps coming; his health bar is
    labeled "GOVERNOR: 40%".

### Candidate pool to reach 10–20 (brainstorm)

- **Arnold caricature** ("The Austrian Yolk") — golden-era bodybuilding
  colosseum; pump-up phases, one-liner puns as attacks.
- **Bruce Lee homage** ("Water Style Master Li") — hidden dojo; one-inch-punch
  counters; secret honorable boss (respect ending, not humiliation).
- **Chuck Norris caricature** — the joke IS the memes; the game's stats screen
  refuses to show his health bar.
- **Jean-Claude Van Damme caricature** ("Jon-Clod Von Splits") — does splits
  between two of everything; helicopter-kick screensaver phase.
- **Ronnie Coleman caricature** ("Colonel Lightweight") — "LIGHTWEIGHT BABY!"
  yells that shockwave; everything he lifts is comically not lightweight.
- **Richard Simmons-type** ("Cardio Wizard") — pastel neon aerobics dungeon;
  the mandatory rhythm/dance-mash fight.
- **Ronda Rousey / women's MMA caricature** — armbar grab-loops you must mash
  to escape.
- **Liver-King-style influencer** ("The Organ Baron") — raw-liver projectiles;
  deflates when his "all natural" claim is disproven mid-fight (evidence
  pickup item).
- **Yoga/wellness guru caricature** ("Guru Flex") — floats, pretzel poses,
  passive-aggressive namaste attacks.
- **CrossFit cult leader** ("Box King WOD") — endless burpee minions; kipping
  everything.
- **Steven Seagal-type** ("Sensei Sleeveless") — barely moves, wrist-grab
  counters only, increasingly winded; comically protected by an entourage.
- **Mr. Miyagi-style sensei** — potential mentor-turned-final-gauntlet twist.
- **Final boss slot reserved** — tied to whatever storyline we land on
  (see §9): e.g. the algorithm/AI coach gone rogue, or a mega-caricature
  fusing every fitness fad at once.

### Boss design rules

- Every boss = **stage theme + signature gimmick + humor beat + a "call-out"
  interaction** (the player can taunt/press their sore spot to trigger rage or
  vulnerability phases — like calling Mike Bison a knockoff).
- Fitness bosses get workout-mechanic phases; combat bosses get versus-mode
  phases; top-tier bosses get **both**.
- ⚠️ **Legal note (veteran flag):** parody names and transformed designs are
  the right instinct, but right-of-publicity risk is real — keep designs
  clearly transformative, avoid real names/likeness/logos, and get counsel
  review before marketing. Budget for renames.

---

## 8. Stages & Enemies (Brainstorm)

- Stage arc: **gym → city → spectacle**, difficulty and absurdity scaling
  together:
  1. Training Mode HQ gym (tutorial — the app made playable).
  2. Franchise mega-gym (D. Wayne Rockson's turf).
  3. Old-school boxing gym (Mike Bison).
  4. Press-conference arena (McGregor caricature).
  5. Movie backlot (Stallone caricature / stunt crew enemies).
  6. Military base (Sgt. Stay Hard + PT round-ups).
  7. Neon cardio dungeon, bodybuilding colosseum, rooftop dojo, cyberpunk
     supplement lab, underground fight circuit, final venue TBD w/ story.
- Enemy families as fitness archetypes: curl bros, treadmill zombies,
  supplement goblins, form-police refs, influencer paparazzi drones,
  personal-trainer clipboard knights.
- Environmental weapons: dumbbells, kettlebells, barbells (heavy = slow/huge),
  protein shakers (throwable), resistance bands (whip/grapple), benches.
- Stage badges/ranks reuse the app's Training Arcade stage-map language
  (cleared ✅ / current ▸ / locked 🔒 / boss 👑).

---

## 9. Storyline — To Brainstorm Later (Seed Pitches)

- **Deliberately open** — no locked storyline yet. Requirements it must serve:
  humor + action, justifies 10–20 celebrity-caricature bosses, ties into the
  app's world (XP, tiers, arcade), scalable for sequels/DLC bosses.
- Seed pitches to react to (pick, mix, or discard):
  - **"The Grand Opening":** every famous fitness ego tries to crush the new
    Training Mode gym before it opens; you fight up the celebrity ladder to
    put your gym on the map. (Scott Pilgrim "evil exes" structure — proven.)
  - **"The Algorithm":** a rogue fitness AI has turned every celebrity trainer
    into a maxed-out caricature of their own brand; beating them "deprograms"
    them. (Explains the exaggeration in-universe; sets up an AI final boss.)
  - **"The Tournament of Gains":** a mysterious promoter's invitational —
    winner becomes "the face of fitness"; brackets naturally structure
    10–20 bosses and versus-stage finals.

---

## 10. Tech, Engine & Scalability

- **Engine requirement:** must support the app-login/data-sync pipeline
  (app account → API → character stats), 2D pixel pipelines, and multiple
  platforms. Evaluate **Godot** (2D-first, lightweight, open) vs **Unity**
  (ecosystem, console ports). Backend sync via the existing app stack
  (Supabase) — game reads a "fighter profile" computed from app usage.
- Optional **controller motion detection** (gyro mash for workout mechanics)
  with a button-mash fallback on all platforms.
- **Scalable product design:**
  - Boss-as-content-unit: each boss ships as a self-contained pack (stage +
    gimmick + moveset) → DLC/seasonal boss drops.
  - Two-way loop with the app: game milestones grant app trophies/XP events;
    app events (streaks, arcade clears) unlock game cosmetics.
  - Roadmap surface for later: co-op, PvP versus mode using synced builds,
    community boss votes.

---

## 11. Immediate Next Steps (Where We Start)

- [ ] **Concept-art pass 1:** player avatar sheet (base body + customization
      matrix from §5) in the target pixel style.
- [ ] **Boss one-pagers:** lock the first 6 bosses (Bison, Rockson, Stallion,
      C.O.N., Action Jack, Sgt. Stay Hard) — design, gimmick, stage, jokes.
- [ ] **Stage mockups:** Training Mode HQ gym + one boss arena in brand
      palette (#080012 world, gold/violet accents).
- [ ] **Stat-mapping spec:** exact formula from app data → fighter stats
      (damage / stamina / technique / meter), with the workout-builder-heavy
      vs cardio-heavy example as the tuning benchmark.
- [ ] **Storyline workshop:** react to the three seed pitches in §9.
- [ ] **Vertical-slice target:** one gym stage + one boss (Mike Bison) +
      app-login stat sync stub.
