# ⚔ TRAINING MODE
### Tactical Combat Fitness System — *Train · Fight · Win*

**Training Mode turns your real workout into a retro beat-em-up video game — your reps are the attacks, the workout is the boss, and you don't log exercise… you defeat it.**

A combat-fitness training system wrapped in a neon-purple arcade universe. It coaches real training — boxing rounds, bodyweight circuits, strength workouts — and presents every session the way an arcade game presents a fight: stage select, a boss health bar, combo counters, star rankings, and a K.O. moment when you finish.

Built as an installable **PWA** — no app store, no download friction. Tap a link, add to home screen, works offline.

---

## 🕹 The Training Arcade

The crown jewel — the part no other fitness app has:

- **Saga Select** — a full-bleed poster carousel of training sagas. Live now: **One Punch Protocol**, 10 stages built around the legendary 100 push-ups / 100 squats / 100 sit-ups regimen.
- **The Climb** — a branching arcade-style stage ladder. Cleared stages fill green and show your earned ★★★; the ladder ends at a crowned **BOSS** and a skull-marked **ELITE mythic boss** (500/500/500 + 20 km).
- **The Battle HUD** — the workout screen *is* a boss fight. The stage has an **HP bar that drains with every rep**, live rep combos, a pace meter (AHEAD / BEHIND), and a voice announcer counting your reps out loud.
- **Rest = round break** — between rounds you stay in the fight: HP frozen, countdown, "NEXT ▶" preview.
- **STAGE CLEAR!** — land the last rep and get a gold K.O. flash, then results: your time, XP count-up, **1–3 stars against real time cutoffs**, and a **★ NEW BEST** badge when you beat your record.
- **Real scoring** — a time-ranked S/A/B/C benchmark stage, persistent best times, per-stage star goals.
- **Anti-cheat** — the Mission Integrity system invalidates impossible runs. You can't fake a stage clear.
- **Loot** — XP, badges, titles ("Endurance Hero," "One Punch Legend"), and stat rewards (Strength / Endurance / Discipline / Cardio / Balance).

## 🥊 Fight Mode
- **Fight Focus** — voice-coached round timer across Boxing, Kickboxing, Muay Thai, MMA
- **Combo Coach** — strike combinations called at your pace
- **Practice Mode** — guided breakdowns of strikes, defense, and footwork

## 💪 Fit Mode
- **Workout Builder** — pick target muscles on a glowing anatomy body map, generate a workout, swap exercises, edit sets/reps/rest, save named routines
- **Voice-Guided Player** — reps counted out loud on an adjustable cadence; weighted lifts get timed windows; holds get motivational call-outs
- **Quick Mission** — instant round-based workouts
- **Combat Conditioning** — the fitness × fight crossover mode
- **Cardio finishers** — bolt a run, intervals, or Tabata onto any session

## 📈 Progression
Every session earns XP → levels → ranks (**Rookie → Adept → Veteran → Elite → Champion**) with an evolving avatar, 🔥 daily streaks, a daily **Today's Bout** mission, trophies, and one-tap share cards.

---

## 🛠 Tech

- **Expo / React Native Web** (single codebase), exported as a static web build
- **PWA**: offline app shell, safe auto-updating service worker (new builds activate on next launch), installable with full icon set
- **WebP-first image pipeline** with automatic PNG fallback and a build-time asset manifest
- All progress stored on-device (localStorage) — no account required

### Run it

```bash
npm install
npm run dev:web        # local dev server
npm run build:web      # production build → dist/ (deploy this folder)
```

Useful scripts: `npm run optimize:images` (WebP pipeline + manifest), `npm run check:assets` (verifies every referenced image exists), `node scripts/prune-unused-assets.mjs` (finds unreferenced art).

---

*Beta — built with [Claude Code](https://claude.com/claude-code).*
