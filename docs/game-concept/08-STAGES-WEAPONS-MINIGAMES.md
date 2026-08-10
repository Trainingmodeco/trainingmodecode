# TRAINING MODE: THE GAME — Signature Stages, Weapons & Load-Time Minigames

> **Status:** v0.1 brainstorm — founder concepts developed. Companion to
> the Club stage (06); every stage below follows the same rule the Club
> proved: **each stage has one signature gimmick that only lives there.**

---

## 1. Signature Stage Concepts (Club-style: one gimmick each)

1. **THE CYCLE CULT (spin studio).** The whole stage moves: fights on
   spin bikes, moving treadmill floors, conveyor belts. The instructor
   (mini-boss) barks cadence — when she yells "SPRINT!", the floor speeds
   up and the stage becomes an auto-scroller; fall behind and you take
   crush damage. Gimmick: **the floor is the enemy.**
2. **THE SUPPLEMENT LAB (cyberpunk pre-workout factory).** Vats of
   glowing pre-workout; spills create buff/debuff puddles (step in =
   random speed boost or jitter-crash), protein-powder clouds white-out
   parts of the screen, exploding shaker-bottle hazards. Gimmick:
   **the stage hands out unstable power-ups — risk management.**
3. **THE CONTENT HOUSE (influencer rooftop gym).** Camera drones film
   everything; a live-chat overlay scrolls reactions to your fight in
   real time (comedy engine). A "VIRAL METER" rises with stylish play —
   go viral and influencer enemies swarm to get in your shot; ring
   lights and selfie sticks are weapons. Gimmick: **style scoring made
   diegetic — the crowd IS the meter.**
4. **THE MEAT LOCKER (Stallone montage homage).** Frozen sides of beef
   as swinging obstacles AND punchable training props; freezing breath
   timer pushes you forward; montage music builds verse by verse and
   the boss gets stronger every chorus until you interrupt the montage.
   Gimmick: **the boss's power is the soundtrack — cut the music.**
5. **THE PRESS CONFERENCE (arena media day).** Fight through a hostile
   press scrum to the stage; the boss throws mics (sound-wave attacks),
   water bottles, and a dolly. Opens with a STAREDOWN minigame (hold
   your gaze, don't blink first = start with a buff). Heavy versus-mode
   usage. Gimmick: **the crowd's allegiance shifts mid-fight with your
   showmanship.**
6. **THE HOT BOX (sauna & hot-yoga studio).** Steam limits visibility in
   rolling waves; heat drains stamina constantly (the cardio build's
   nightmare, the yoga master's home turf); hold-a-pose sections restore
   stamina but leave you exposed. Gimmick: **stamina management as level
   design.**
7. **THE MIDNIGHT SUBWAY (transit between territories).** Classic
   beat-em-up train-car brawl, Training Mode flavored: car lights flicker
   station to station (safe, sub-threshold flashes), enemies board at
   each stop, fight spills onto the platform. Gimmick: **wave defense on
   a timetable — the doors chime tells you what's coming.**
8. **MEGAGYM HQ (finale tower).** Floor-by-floor ascent: elevator brawls
   (genre classic), COACH on every screen, brainwashed elite members,
   each floor a corrupted mini-version of an earlier gym — the whole
   game recapped as a gauntlet before the Promoter fight. Gimmick:
   **remix reprise of every stage's signature mechanic.**

*(Already specced elsewhere: Stage 1 gym tutorial, THE CLUB (06),
Goggins' military base with PT round-ups (00).)*

---

## 2. Pickup Weapons (gym equipment arsenal — founder concept)

| Weapon | Moveset | Character |
|---|---|---|
| **Dumbbell** | one-hand smash, short throw | the genre's "pipe" |
| **Barbell (loaded)** | slow two-hand wide sweep, ground slam | high strength stat = swings faster |
| **Kettlebell** | momentum swing arc, long throw | swing builds up damage |
| **Jump rope** | whip crack, trip sweep, PULL enemies to you | the "chain" weapon; doubles as a rhythm taunt |
| **Weight plate** | frisbee throw, held = arm shield | bounces off walls |
| **Resistance band** | tether an enemy to a post, slingshot yourself | mobility + crowd control |
| **Medicine ball** | heavy bouncing projectile | ricochets between enemies |
| **Foam roller** | fast bonk stick, low damage, high hitstun | comedy weapon, chibi-flip friendly |
| **Protein shaker** | throwable; bursts into powder cloud (blinds) | the "flash bang" |
| **Bench** | massive two-hander, breaks after 3 hits | screen-clearer |

- **Boxing gloves pickup = power-up, not weapon:** golden gloves upgrade
  your bare-hand strikes (damage + gold impact VFX) for a timer —
  respects that fists are the core verb.
- Weapon handling ties to the Fighter Profile: high **strength** swings
  heavy weapons at normal speed; low strength telegraphs them (another
  place your app training shows up).

## 3. Power-Ups (consumables)

- **Protein shake** — health (small/med/large sizes)
- **Pre-workout** — attack + speed up for 15s, then a 3s jitter "crash"
  debuff (risk/reward, very on-brand)
- **BCAA drink** — stamina regen boost for a stretch
- **Chalk bag** — grip: weapons last longer, can't be disarmed
- **Towel** — clears debuffs (wipe the sweat)
- **Smelling salts** — second wind: auto-revive once (rare)
- **Headphones** — "in the zone": brief super-meter gain multiplier
- **Gold T token** — fills one super segment; hidden in breakables

## 4. Load-Time Minigames (founder concept)

> Legal note: Namco's infamous loading-screen minigame patent
> (US 5,718,632) expired in 2015 — this is now free to do, and almost
> nobody does it. Easy differentiator.

- **Concept:** every load screen is a 5–15 second micro-workout at the
  gym — earn a trickle of XP with button prompts. Small per-load, adds
  up over a playthrough (founder intent: "not as much as the app, but
  it adds up").
- **The set (rotates):**
  - **BENCH PRESS** — alternate L2/R2 (or A/B) to rep; bar speed = mash
    rhythm; PB counter persists across loads.
  - **SPRINT** — mash A; hit the pace line to keep the treadmill maxed.
  - **HEAVY BAG** — QTE combo prompts (←→▲B...) matching real combo
    strings from Combo Coach; clean strings chain a multiplier.
  - **JUMP ROPE** — rhythm taps on the beat (reuses the club stage's
    beat-sync SongManager).
  - **PLANK** — hold two buttons perfectly still; wobble = shake.
- **Economy guardrail (important):** load-XP feeds **game XP** (level,
  meter, cosmetics, PB leaderboards) but NEVER fighter *stats* — stats
  stay app-training-driven only, or the core promise ("your real
  training builds your fighter") inflates away. Per-session soft cap so
  idle-load farming doesn't pay.
- If a load finishes early, the minigame offers "one more rep?" —
  players can stay voluntarily (Namco-era trick, still charming).
- Ties into anti-cheat tone: COACH sarcastically "validates" your loading
  workouts ("reps counted: 12. reps that would survive MY validation: 4").

---

## Design rules extracted (apply to all future stages)

1. One signature gimmick per stage; the gimmick is mechanical, not just
   visual.
2. Every gimmick stress-tests a Fighter Profile stat (Hot Box → stamina,
   heavy weapons → strength, jump rope/beat stages → combo timing) — the
   app-sync build should FEEL different in every stage.
3. Comedy through systems (live chat, COACH validation, chibi flips),
   not just dialogue.
4. All flashing/strobing content obeys the verified safety limits in
   06 §7.
