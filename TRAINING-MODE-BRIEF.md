# Training Mode — full product brief

*Written to be pasted into a fresh chat as background for scripting filmed
content. Everything here describes what the app actually does today unless
marked ROADMAP.*

---

## 1. What Training Mode is

Training Mode is a **gamified combat-fitness app**. It trains you like a
fighter — real boxing, kickboxing, Muay Thai and MMA work, plus real strength
and conditioning — and wraps that training in the language and structure of a
video game: stages, bosses, XP, levels, ranks, trophies, campaigns.

The tagline in the app is *TACTICAL COMBAT FITNESS SYSTEM*, and the splash
reads **TRAIN · FIGHT · WIN**.

It runs as a web app / installable PWA. Sessions are **voice-coached** — the
app calls the work out loud, so you are never reading a screen mid-round.

### The core idea, in one line

**You don't follow a workout. You run a protocol, and the protocol levels you up.**

### What makes it different

- **It coaches out loud.** Every session is voiced — round calls, combo
  call-outs, rep counts, technique cues. Phone on the floor, hands up.
- **Combos are generated, never a fixed playlist.** The app composes
  combinations live from a discipline's real strike vocabulary, so the same
  round is never the same twice.
- **It's honest about fantasy.** Campaigns are themed on anime and comic
  archetypes, but every prescription is real, scaled and safe. Superhuman feats
  appear as flavour only, explicitly flagged as lore.
- **Everything is earned.** There's an anti-cheat integrity gate: a session
  that can't be verified earns nothing.

### Who it's for

People who find normal fitness apps boring, and who grew up on video games and
fight anime. Beginners are supported (guided tutorials, easy difficulty, a
health screening) but the ceiling is genuinely high.

---

## 2. The two halves: FIGHT MODE and FIT MODE

The app splits into two hubs. Both feed the same progression system.

### FIGHT MODE — the combat side

You pick one of **four disciplines**: **Boxing · Kickboxing · Muay Thai · MMA.**
That choice shapes every strike the app will call.

You choose how the coach calls strikes — **CALL STYLE**, two options:
**NAMES** ("jab, cross, lead hook") or **NUMBERS** — the standard boxing
count every real gym uses (1 jab · 2 cross · 3 lead hook · 4 rear hook ·
5/6 uppercuts · 7/8 overhands, and any number "to the body" is the same
punch downstairs). NUMBERS never mixes alphabets: a combo is called
numerically only when every strike in it is a numbered punch, so you get
"1-2-3B" or "Jab Slip Cross" — never a half-and-half call. Kicks, knees,
elbows and defensive sequences have no standard number, so those combos
stay in words.

**Features inside Fight Mode:**

**Training Camp** — the flagship. A 12-level campaign ending in a Title Fight.
Full description in section 4.

**Fight Focus** — the round timer. You set rounds, round length and rest, and
it runs a real fight-paced session with bell sounds, a work/rest ring, coach
prompts per round, and a live elapsed clock. This is the "shadowbox or hit the
bag on the bell" mode.

**Combo Coach** — the same round structure, but the app *calls combinations* at
a cadence. It generates them live from your discipline's strike pool, mixing in
body shots, defence and head movement so it never becomes a loop. Cadence
tightens with difficulty. This is the mode that most feels like having a coach
on the pads.

**Practice Mode** — tutorials, fundamentals and form. A technique library plus
a "Start Here" path for people who have never thrown a punch.

**Combat Conditioning** — generated combat-flavoured conditioning missions:
striking drills mixed with explosive bodyweight work.

**Ghost Battles** — race the recorded pace of a past session. The app stores a
"ghost" of a verified run (your own best, or a friend's, shared as a paste-able
challenge code). During the round a split bar shows you versus the ghost's
replayed pace in real time. At the final bell you get a verdict —
*"▲ 26s FASTER · GHOST DEFEATED"* — a head-to-head breakdown, a rematch option,
and a share card. There is no live multiplayer; you're racing a replay, which
means it works offline and at any hour.

**Rush Mode** — an intensity modifier that layers surprise bursts into a
session.

**Strike Counter** — uses the phone's motion sensors to count strikes actually
thrown (phone in hand), so counts can be motion-verified rather than assumed.

### FIT MODE — the strength and conditioning side

**Workout Builder** — build your own session from an exercise library, then run
it in a fully guided, voiced player: counted reps, timed holds, rest between
sets, skip, rewind, pause, and a session summary at the end.

**Quick Mission** — a generated workout on demand. Pick a workout type, a
difficulty and a length; it builds and runs the session. This is the "I have 20
minutes, tell me what to do" mode.

**Cardio Mode** (marked BETA in-app) — cardio protocols and a cardio finisher
that can be bolted onto the end of another session.

*(Workout Codex is on hold and should not be mentioned in content.)*

---

## 3. TRAINING ARCADE — the concept

**Training Arcade is the campaign mode.** It's the most "video game" part of
the app and the strongest visual hook for filming.

You choose a **saga** from a swipeable carousel of poster cards — each one a
full illustrated cover in the style of an arcade cabinet or a game case. Each
saga is a **10-stage campaign** themed on a fighter archetype from anime and
comics, and every stage is a real, complete workout.

**How a campaign works:**

- **10 stages**, climbed as a zig-zag ladder. Stage 10 is the **boss**, locked
  until you clear 9.
- Each stage offers **three paths**: **FIT** (strength/conditioning),
  **FIGHT** (rounds and combos), or **FULL ARC** (both).
- Each path runs at **easy / normal / hard**, and difficulty is real: the same
  stage resolves different set and rep counts from a calibrated volume ladder.
- Every stage has a **theme and a persona** — you're not doing "workout 4",
  you're doing *One-Punch Power* against a karate archetype.
- The FIT side counts your reps out loud, set by set. The FIGHT side calls
  generated combinations that match the stage's theme.
- Boss stages get their own presentation — a splash, an HP bar, an
  "answer the bell" gate.

**The sagas open today**, in carousel order:

1. **One Punch Protocol** — cadence rep endurance.
2. **Gravity Chamber / Tempo Protocol** — everything under slow tempo and long
   time-under-tension. A rep can take nine seconds.
3. **Hero Hunter** — learn every style and get faster with each fight. Boxing,
   Dutch kickboxing and Wing Chun; lean, explosive, fighter-sprinter build.
4. **Destroyer Protocol** — the heaviest striking-and-power campaign.
5. **The Grappler / Strongest Teen Protocol** — calisthenics mastery, an iron
   core, grip work, ground flow and a father-son boss trial. This is the most
   playtested campaign and the best one to film first.

More sagas exist and are deliberately locked until each is playtested.

---

## 4. TRAINING CAMP — the concept

**Training Camp is the fight-camp simulator.** Where Arcade is themed and
episodic, Camp is the disciplined 12-week-style progression a real fighter runs
before a bout.

- **12 levels**, climbed on a map, ending at **Level 12: the TITLE FIGHT.**
- Each level has a **phase** — foundation, development, hard camp, taper,
  final boss — and the programming actually changes with the phase. The taper
  levels genuinely reduce volume so you arrive at the Title Fight fresh, not
  fried.
- Levels can be run as a **split** (two sessions: skill in the morning,
  conditioning in the evening, with hours between) or as **FULL CAMP** (both
  blocks back to back).
- Before starting you choose a **fighter archetype** — 12 exist, three per
  discipline: Pressure Dog, Slick Counter Boxer, Twelve-Round Finisher, Dutch
  Volume Pressure, Long-Range Kicker, Angle Counter Kickboxer, Muay Femur
  Technician, Muay Khao Clinch Grinder, Muay Mat Power Puncher, Wrestle-Box
  Control, Anti-Wrestling Sniper, Chaos Finisher. Each reads differently at
  each difficulty.
- **Safety is built in**: a one-time PAR-Q health screening, a readiness check
  before hard sessions (sleep, fatigue, soreness, stress, pain), and a gear
  check.
- **The Title Fight** is twelve rounds with a scored objective each — feel him
  out, establish the jab, work the body, take the centre, defence only, and
  three championship rounds at the end. It is **form-gated**: technique
  breaking down ends the fight, not just the round. Winning it completes the
  camp and awards the Camp Champion trophy.

---

## 5. THE PROGRESSION SYSTEM — the RPG layer

This is the spine that connects everything, and the part that leads into the
game (section 6).

**XP and Levels.** Every completed session earns XP based on active minutes,
difficulty and how much you actually finished. 500 XP per level. XP is earned,
not given: a session that fails the integrity check earns nothing, and a
partially completed session earns partial credit.

**Combat Ranks (tiers).** Five visible ranks you climb with total XP:

| Rank | XP |
|---|---|
| Combat Rookie | 0 |
| Combat Novice | 500 |
| Combat Warrior | 1,500 |
| Combat Elite | 3,500 |
| Combat Champion | 7,000 |

Plus **three secret tiers** beyond Champion — Peak Physique, Fight Ascendant,
and Final Form — which are hidden until reached.

**Streaks and weekly goals.** A daily streak, and a weekly target of 5
sessions, both surfaced on the home dashboard.

**Three reward systems** (they're distinct — don't blur them on camera):

1. **Fight Trophies (9)** — the prestige set, each with its own art:
   *Camp Champion* (win the Title Fight) · *Combo Machine* (1,000 called
   strikes) · *Sweet Science* (5 technique lessons) · *Iron Rounds* (100 rounds)
   · *Knockout King* (25 complete sessions) · *Power Surge* (50-strike streak)
   · *Rhythm Breaker* (10 Combo Coach + 10 Fight Focus) · *Ring General*
   (500 rounds) · *Shadow Striker* (5,000 strikes).
2. **Milestones (9)** — cross-cutting goals like Fit Clear, Fight Clear,
   Full Arc Clear, No-Drop Run, Perfect Defense, Consistency Streak.
3. **Campaign Badges (71)** — 8–12 per saga, one per stage or campaign
   milestone.

**Outcome screens.** Every session ends on one of four verdicts, decided by an
engine against real pass rules: **CLEARED · PARTIAL COMPLETION · MISSION
FAILED · VALIDATION FAILED.** Failing is a real state with real consequences —
that's what makes clearing mean something.

**Share cards.** Wins render as a shareable image with your rank, level, streak
and the session result.

**Supporting systems**: workout reminders, a Game Plan weekly scheduler,
selectable voice packs, live volume control mid-session, auto-pause when you
leave the app, and a paused-session resume.

---

## 6. ROADMAP — the beat-'em-up

**This is the north star, and the best story to tell on camera.**

The progression system above is deliberately built like an RPG character sheet,
because the intent is that it eventually *becomes* one.

The vision: **a beat-'em-up video game where your character is levelled by your
real training.** The reps you actually do, the rounds you actually finish, the
campaigns you actually clear — those become your character's stats. Train your
grip in the app, your character grapples better. Clear a striking campaign,
your character's hands get faster. You don't grind the game with a controller;
you grind it in your living room, on a bag, on a pull-up bar.

Which reframes everything in the app: XP, ranks, trophies, campaign badges and
archetypes aren't decoration on a fitness tracker — they're **the character
sheet you're building for a game that hasn't shipped yet.**

Status: this is the direction, not a shipped feature. Talk about it as the
vision, never as something available today.

---

## 7. Tone and language notes for scripting

- The app's voice is **coach-like and direct**: short imperatives, no fluff.
  "Hands up." "Form holds or the fight stops." "Chase the monster, train like a
  human."
- Visual identity: deep violet and black, gold accents, arcade-cabinet framing,
  Orbitron display type. It looks like a fighting game menu.
- **Never oversell safety-adjacent claims.** The app is explicit that fantasy
  feats are lore, spot reduction is a myth, and nothing trains to failure.
  Keep that honesty in the content — it's a differentiator, not a limitation.
- **Don't mention Workout Codex** — on hold, possibly a separate product.
- Good on-camera hooks: the poster carousel; the counted-rep ring calling
  "SET 1/3 · 5 REPS"; combos being called live; the boss stage locked behind
  CLEAR 9; the ghost battle split bar; the twelve-round Title Fight.
